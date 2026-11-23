/* EarthPlay — civilisations: kingdoms, cities, territory, economy, buildings, research, diplomacy, war. */
(function () {
'use strict';
const EP = globalThis.EP;
const { T, TERRAIN, SPECIES, BUILDINGS, AGES, GEAR } = EP;
const Units = EP.Units;

const TECH_MUL = { human: 1.0, elf: 1.2, dwarf: 1.1, orc: 0.85 };
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

class CivSystem {
    constructor(sim) {
        this.sim = sim;
        this.kingdoms = new Map(); this.cities = new Map(); this.buildings = new Map();
        this.nextK = 1; this.nextC = 1; this.nextB = 1;
        this.reserved = new Map();
        this.usedNames = new Set();
    }

    // ------------------------------------------------------------ queries
    atWar(a, b) { const k = this.kingdoms.get(a); return !!(k && k.wars[b] != null); }
    allied(a, b) { const k = this.kingdoms.get(a); return !!(k && k.allies && k.allies[b] != null); }
    rankName(k) { return EP.RANKS[k.rank || 0].name; }
    rulerTitle(k) { return EP.RULER_TITLE[k.race][k.rank || 0]; }
    // Fill in fields added after a kingdom was created (old saves).
    ensureKingdom(k) {
        for (const r of EP.RESOURCES) if (k[r] == null) k[r] = 0;
        if (!k.armory) k.armory = { wpn: GEAR.map(() => 0), arm: GEAR.map(() => 0) };
        if (!k.allies) k.allies = {};
        if (k.rank == null) k.rank = 0;
        if (k.forged == null) k.forged = 0;
        return k;
    }
    // Done buildings of a type in a city.
    builtIn(c, type) {
        const out = [];
        for (const id of c.buildings) { const b = this.buildings.get(id); if (b && b.done && b.type === type) out.push(b); }
        return out;
    }
    // Tile just outside a building's front (bottom edge), where people come and go.
    door(b) { return { x: b.x + (b.w >> 1), y: b.y + b.h }; }
    cityKingdom(cityId) { const c = this.cities.get(cityId); return c ? this.kingdoms.get(c.kingdomId) : null; }
    buildingKingdom(b) { return this.cityKingdom(b.cityId); }
    aliveKingdoms() { return [...this.kingdoms.values()].filter(k => k.alive); }
    cityAt(x, y) {
        const w = this.sim.world; x |= 0; y |= 0;
        if (!w.inb(x, y)) return null;
        const o = w.owner[w.idx(x, y)];
        return o >= 0 ? this.cities.get(o) || null : null;
    }
    // Kingdoms with territory within r of (x,y).
    kingdomsNear(x, y, r) {
        const w = this.sim.world, set = new Set();
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
            if (dx * dx + dy * dy > r * r) continue;
            const c = this.cityAt(x + dx, y + dy);
            if (c) set.add(c.kingdomId);
        }
        return [...set].map(id => this.kingdoms.get(id)).filter(k => k && k.alive);
    }
    nearestBuilding(x, y, r, pred) {
        let best = null, bd = r * r;
        for (const b of this.buildings.values()) {
            if (b.type === 'farm' || (pred && !pred(b))) continue;
            const d = EP.dist2(x, y, b.x + b.w / 2, b.y + b.h / 2);
            if (d < bd) { bd = d; best = b; }
        }
        return best;
    }
    hostileToKingdom(k, o) {
        if (o.dead) return false;
        if (o.kind === 'monster' || o.madT > 0) return true;
        if (o.kind === 'civ') return o.kingdomId >= 0 && k.wars[o.kingdomId] != null;
        if (o.kind === 'animal' && SPECIES[o.species].diet === 'carn') {
            const c = this.cityAt(o.x, o.y);
            return !!(c && c.kingdomId === k.id);
        }
        return false;
    }

    // ------------------------------------------------------------ creation
    genKingdomName(race) {
        const g = EP.KINGDOM_NAMES[race], rng = this.sim.rng;
        for (let a = 0; a < 30; a++) {
            const n = (rng.pick(g[0]) + rng.pick(g[1]) + rng.pick(g[2])).trim();
            if (!this.usedNames.has(n)) { this.usedNames.add(n); return n; }
        }
        return `${SPECIES[race].name} Realm ${this.nextK}`;
    }
    pickColor() {
        const used = new Set(this.aliveKingdoms().map(k => k.color));
        const free = EP.KINGDOM_COLORS.filter(c => !used.has(c));
        if (free.length) return free[0];
        return EP.Color.hsl(this.sim.rng.int(0, 359), 70, 55);
    }
    createKingdom(race) {
        const sim = this.sim;
        const k = {
            id: this.nextK++, race, name: this.genKingdomName(race), color: this.pickColor(), sym: sim.rng.int(0, 5),
            alive: true, founded: sim.year, fell: null, capital: -1, cities: [], relations: {}, wars: {},
            food: 70, wood: 40, stone: 10, gold: 0, tech: 0, age: 0, kingId: -1, pop: 0, warriors: 0,
            warTarget: -1, kills: 0, deaths: 0, births: 0, peakPop: 0, starving: false, expedition: null,
        };
        this.ensureKingdom(k);
        for (const o of this.kingdoms.values()) {
            if (!o.alive) continue;
            let r = o.race === race ? 25 : 0;
            if (race === 'orc' || o.race === 'orc') r -= 15;
            k.relations[o.id] = r; o.relations[k.id] = r;
        }
        this.kingdoms.set(k.id, k);
        return k;
    }
    discardKingdom(k) {
        this.kingdoms.delete(k.id); this.usedNames.delete(k.name);
        for (const o of this.kingdoms.values()) { delete o.relations[k.id]; delete o.wars[k.id]; if (o.allies) delete o.allies[k.id]; }
    }
    cityName(race) {
        const rng = this.sim.rng;
        return cap(rng.pick(EP.UNIT_NAMES[race][0]).toLowerCase() + rng.pick(EP.CITY_SUFFIX[race]));
    }
    claim(city, i) {
        const w = this.sim.world, prev = w.owner[i];
        if (prev === city.id) return;
        if (prev >= 0) { const pc = this.cities.get(prev); if (pc) pc.tiles--; }
        w.owner[i] = city.id; city.tiles++; w.ownerVersion++;
    }
    canClaim(i) {
        const w = this.sim.world;
        return w.owner[i] < 0 && w.terrain[i] !== T.DEEP && w.terrain[i] !== T.MOUNTAIN && w.terrain[i] !== T.LAVA;
    }
    // Is (x,y) a reasonable place to start a new town?
    canFoundAt(x, y) {
        const w = this.sim.world;
        x |= 0; y |= 0;
        if (!w.inb(x, y) || !TERRAIN[w.t(x, y)].build) return false;
        for (const c of this.cities.values()) if (EP.dist2(x, y, c.x, c.y) < 12 * 12) return false;
        let free = 0;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
            const nx = x + dx, ny = y + dy;
            if (!w.inb(nx, ny)) continue;
            const i = w.idx(nx, ny);
            if (w.owner[i] >= 0) return false;
            if (TERRAIN[w.terrain[i]].build) free++;
        }
        return free >= 22;
    }
    foundCity(k, x, y, prebuilt = false) {
        const sim = this.sim, w = sim.world;
        const city = {
            id: this.nextC++, kingdomId: k.id, name: this.cityName(k.race), x: x + 0.5, y: y + 0.5, hallId: -1,
            buildings: [], pop: 0, adults: 0, housing: 0, radius: 4, tiles: 0, founded: sim.year, members: [], jobs: {}, threat: 0, hills: null,
        };
        this.cities.set(city.id, city);
        const claimed = [];
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
            if (dx * dx + dy * dy > 12) continue;
            const nx = (x | 0) + dx, ny = (y | 0) + dy;
            if (!w.inb(nx, ny)) continue;
            const i = w.idx(nx, ny);
            if (this.canClaim(i)) { this.claim(city, i); claimed.push(i); }
        }
        const site = this.findSite(city, 'hall');
        if (!site) {
            for (const i of claimed) w.owner[i] = -1;
            w.ownerVersion++;
            this.cities.delete(city.id);
            return null;
        }
        const hall = this.createBuilding('hall', city, site.x, site.y, prebuilt);
        city.hallId = hall.id;
        city.x = site.x + 1.5; city.y = site.y + 1.5;
        k.cities.push(city.id);
        if (k.capital < 0) k.capital = city.id;
        return city;
    }
    // Fully formed starter settlement (world generation & demo).
    seedKingdom(race, x, y, n) {
        const sim = this.sim;
        if (!this.canFoundAt(x, y)) return null;
        const k = this.createKingdom(race);
        const c = this.foundCity(k, x, y, true);
        if (!c) { this.discardKingdom(k); return null; }
        for (let i = 0; i < n; i++) {
            const u = sim.spawnUnit(race, c.x + sim.rng.float(-2, 2), c.y + 2 + sim.rng.float(-1, 1), {});
            if (u) this.join(u, c);
        }
        const hs = this.findSite(c, 'house');
        if (hs) this.createBuilding('house', c, hs.x, hs.y, true);
        const fs = this.findSite(c, 'farm');
        if (fs) this.createBuilding('farm', c, fs.x, fs.y, true);
        sim.log(`The ${k.name} rises at ${c.name}`, { x: c.x, y: c.y, type: 'found', kingdom: k.id });
        return k;
    }
    join(u, city) {
        u.kingdomId = city.kingdomId; u.cityId = city.id; u.lonely = 0;
        u.job = null; u.state = 'idle'; u.task = null;
        Units.recalc(this.sim, u);
    }

    createBuilding(type, city, x, y, done) {
        const w = this.sim.world, d = BUILDINGS[type];
        const b = { id: this.nextB++, type, x, y, w: d.w, h: d.h, cityId: city.id, maxHp: d.hp, hp: done ? d.hp : Math.max(1, d.hp * 0.2), progress: done ? 1 : 0, done: !!done, atkCd: 0, hitT: 0 };
        this.buildings.set(b.id, b);
        city.buildings.push(b.id);
        for (let yy = y; yy < y + b.h; yy++) for (let xx = x; xx < x + b.w; xx++) {
            const i = w.idx(xx, yy);
            w.bld[i] = b.id;
            if (w.tree[i]) w.setTree(i, 0);
            if (w.fire[i]) this.sim.env.extinguish(i);
            if (d.field) w.setTerrain(i, done ? T.FARM : T.SOIL);
            else if (w.terrain[i] === T.SWAMP || w.terrain[i] === T.ASH) w.setTerrain(i, T.SOIL);
        }
        return b;
    }
    completeBuilding(b) {
        const sim = this.sim, w = sim.world;
        b.done = true; b.progress = 1; b.hp = b.maxHp;
        if (BUILDINGS[b.type].field)
            for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) w.setTerrain(w.idx(xx, yy), T.FARM);
        sim.fx.burst(b.x + b.w / 2, b.y + b.h / 2, 10, { color: '#d9c7a0', speed: 0.05, life: 30, size: 1.5 });
        sim.emit('sfx', { name: 'build', x: b.x, y: b.y });
    }
    removeBuilding(b, rubble = true) {
        const sim = this.sim, w = sim.world;
        if (!this.buildings.has(b.id)) return;
        this.buildings.delete(b.id);
        b.dead = true;
        const city = this.cities.get(b.cityId);
        if (city) {
            city.buildings = city.buildings.filter(id => id !== b.id);
            if (city.hallId === b.id) city.hallId = -1;
        }
        for (let yy = b.y; yy < b.y + b.h; yy++) for (let xx = b.x; xx < b.x + b.w; xx++) {
            const i = w.idx(xx, yy);
            if (w.bld[i] === b.id) w.bld[i] = -1;
            if (BUILDINGS[b.type].field && (w.terrain[i] === T.FARM || w.terrain[i] === T.SOIL)) w.setTerrain(i, T.SOIL);
            else w.touch(i);
        }
        if (rubble && b.type !== 'farm') {
            sim.fx.burst(b.x + b.w / 2, b.y + b.h / 2, 18, { colors: ['#8a7a66', '#5d5249', '#b0a08a'], speed: 0.08, life: 45, grav: 0.004, size: 2 });
            sim.emit('sfx', { name: 'collapse', x: b.x, y: b.y });
        }
    }
    damageBuilding(id, amt, attacker) {
        const b = this.buildings.get(id);
        if (!b || b.type === 'farm') return;
        b.hp -= amt; b.hitT = 6;
        if (b.hp > 0) return;
        const city = this.cities.get(b.cityId);
        if (b.type === 'hall' && city) {
            const ak = attacker && attacker.kingdomId >= 0 ? this.kingdoms.get(attacker.kingdomId) : null;
            if (ak && ak.alive && this.atWar(ak.id, city.kingdomId)) { b.hp = b.maxHp * 0.35; this.captureCity(city, ak); return; }
            this.destroyCity(city, attacker ? 'was overrun' : 'was destroyed');
            return;
        }
        this.removeBuilding(b, true);
    }

    // ------------------------------------------------------------ city fate
    detachCity(city) {
        const k = this.kingdoms.get(city.kingdomId);
        if (!k) return;
        k.cities = k.cities.filter(id => id !== city.id);
        if (k.capital === city.id) k.capital = k.cities.length ? this.largestCity(k).id : -1;
        if (k.warTarget === city.id) k.warTarget = -1;
    }
    largestCity(k) {
        let best = null;
        for (const id of k.cities) { const c = this.cities.get(id); if (c && (!best || c.pop > best.pop)) best = c; }
        return best;
    }
    rehome(u, k) {
        // Find another city of the same kingdom, else become a wanderer.
        let best = null, bd = Infinity;
        if (k && k.alive) for (const id of k.cities) {
            const c = this.cities.get(id);
            const d = c ? EP.dist2(u.x, u.y, c.x, c.y) : Infinity;
            if (d < bd) { bd = d; best = c; }
        }
        if (best) { u.cityId = best.id; u.state = 'idle'; u.task = null; }
        else { u.kingdomId = -1; u.cityId = -1; u.job = null; u.state = 'idle'; u.task = null; Units.recalc(this.sim, u); }
    }
    destroyCity(city, how) {
        const sim = this.sim, w = sim.world;
        const k = this.kingdoms.get(city.kingdomId);
        for (const id of city.buildings.slice()) { const b = this.buildings.get(id); if (b) this.removeBuilding(b, true); }
        for (let i = 0; i < w.owner.length; i++) if (w.owner[i] === city.id) w.owner[i] = -1;
        w.ownerVersion++;
        this.cities.delete(city.id);
        this.detachCity(city);
        for (const u of sim.units) if (!u.dead && u.cityId === city.id) this.rehome(u, k);
        sim.log(`${city.name} ${how}`, { x: city.x, y: city.y, type: 'fall', kingdom: k && k.id });
        if (k && k.alive && !k.cities.length) this.fallKingdom(k);
    }
    captureCity(city, newK) {
        const sim = this.sim, w = sim.world;
        const oldK = this.kingdoms.get(city.kingdomId);
        this.detachCity(city);
        city.kingdomId = newK.id;
        newK.cities.push(city.id);
        for (const id of city.buildings) { const b = this.buildings.get(id); if (b && !b.done) this.removeBuilding(b, false); }
        for (const u of sim.units) {
            if (u.dead || u.cityId !== city.id) continue;
            if (u.species === newK.race && sim.rng.chance(0.7)) { u.kingdomId = newK.id; u.job = null; u.state = 'idle'; u.task = null; Units.recalc(sim, u); }
            else this.rehome(u, oldK);
        }
        w.ownerVersion++;
        newK.warTarget = -1;
        // Invaders who took the town (perhaps from across the sea) make it their home.
        for (const u of sim.units) {
            if (u.dead || u.kingdomId !== newK.id || u.cityId === city.id || u.boarded > 0) continue;
            const home = this.cities.get(u.cityId);
            if (EP.dist(u.x, u.y, city.x, city.y) < city.radius + 10 && w.sameLand(u.x, u.y, city.x, city.y) && (!home || !w.sameLand(u.x, u.y, home.x, home.y))) u.cityId = city.id;
        }
        sim.log(`The ${newK.name} conquered ${city.name}${oldK ? ' from the ' + oldK.name : ''}`, { x: city.x, y: city.y, type: 'war', kingdom: newK.id });
        sim.emit('sfx', { name: 'conquest', x: city.x, y: city.y });
        if (oldK && oldK.alive && !oldK.cities.length) this.fallKingdom(oldK, newK);
    }
    fallKingdom(k, by) {
        const sim = this.sim;
        k.alive = false; k.fell = sim.year;
        for (const o of this.kingdoms.values()) { delete o.wars[k.id]; if (o.allies) delete o.allies[k.id]; if (o.warTarget >= 0 && !this.cities.has(o.warTarget)) o.warTarget = -1; }
        k.wars = {}; k.allies = {};
        for (const u of sim.units) if (!u.dead && u.kingdomId === k.id) { u.kingdomId = -1; u.cityId = -1; u.job = null; u.state = 'idle'; u.task = null; Units.recalc(sim, u); }
        sim.log(`The ${k.name} has fallen${by ? ' to the ' + by.name : ''}`, { type: 'fall', kingdom: k.id });
        sim.emit('sfx', { name: 'fall' });
    }
    rebel(city, forced = false) {
        const sim = this.sim;
        const oldK = this.kingdoms.get(city.kingdomId);
        if (!oldK || oldK.cities.length < 2) return null;
        const nk = this.createKingdom(oldK.race);
        this.detachCity(city);
        city.kingdomId = nk.id; nk.cities.push(city.id); nk.capital = city.id;
        nk.age = oldK.age; nk.tech = oldK.tech * 0.8;
        for (const res of EP.RESOURCES) { const s = Math.floor((oldK[res] || 0) * 0.25); oldK[res] -= s; nk[res] = s + (res === 'food' || res === 'wood' || res === 'stone' || res === 'gold' ? 20 : 0); }
        for (const u of sim.units) if (!u.dead && u.cityId === city.id) { u.kingdomId = nk.id; u.job = null; u.state = 'idle'; u.task = null; Units.recalc(sim, u); }
        sim.world.ownerVersion++;
        this.declareWar(nk, oldK, true);
        sim.log(`${city.name} ${forced ? 'is incited to revolt' : 'rebels'} against the ${oldK.name}, forming the ${nk.name}`, { x: city.x, y: city.y, type: 'war', kingdom: nk.id });
        return nk;
    }

    // ------------------------------------------------------------ diplomacy
    declareWar(a, b, silent = false, called = false) {
        if (!a.alive || !b.alive || a === b || a.wars[b.id] != null) return;
        if (a.allies[b.id] != null) this.breakAlliance(a, b, true);
        const y = this.sim.year;
        a.wars[b.id] = y; b.wars[a.id] = y;
        a.relations[b.id] = Math.min(a.relations[b.id] || 0, -60); b.relations[a.id] = a.relations[b.id];
        if (!silent) {
            const c = this.cities.get(b.capital);
            this.sim.log(`The ${a.name} declared war on the ${b.name}`, { x: c && c.x, y: c && c.y, type: 'war', kingdom: a.id });
        }
        this.sim.emit('sfx', { name: 'war' });
        if (called) return;
        // Call to arms: nearby allies of the defender usually rally to it.
        for (const [side, foe] of [[b, a]]) {
            for (const id of Object.keys(side.allies).map(Number)) {
                const al = this.kingdoms.get(id);
                if (!al || !al.alive || al === foe || al.allies[foe.id] != null || al.wars[foe.id] != null) continue;
                if (Object.keys(al.wars).length >= 2 || this.kingdomDistance(al, foe) > 100 || !this.sim.rng.chance(0.6)) continue;
                this.declareWar(al, foe, true, true);
                const c = this.cities.get(al.capital);
                this.sim.log(`The ${al.name} joins the war against the ${foe.name} to stand by its ally`, { x: c && c.x, y: c && c.y, type: 'war', kingdom: al.id });
            }
        }
    }
    formAlliance(a, b) {
        if (a.allies[b.id] != null || a.wars[b.id] != null) return;
        a.allies[b.id] = b.allies[a.id] = this.sim.year;
        const c = this.cities.get(a.capital);
        this.sim.log(`The ${a.name} and the ${b.name} formed an alliance`, { x: c && c.x, y: c && c.y, type: 'peace', kingdom: a.id });
        this.sim.emit('sfx', { name: 'peace' });
    }
    breakAlliance(a, b, silent = false) {
        if (a.allies[b.id] == null) return;
        delete a.allies[b.id]; delete b.allies[a.id];
        if (!silent) this.sim.log(`The alliance between the ${a.name} and the ${b.name} has ended`, { type: 'fall', kingdom: a.id });
    }
    makePeace(a, b) {
        if (a.wars[b.id] == null) return;
        delete a.wars[b.id]; delete b.wars[a.id];
        a.relations[b.id] = b.relations[a.id] = -5;
        if (a.warTarget >= 0 && this.cities.get(a.warTarget)?.kingdomId === b.id) a.warTarget = -1;
        if (b.warTarget >= 0 && this.cities.get(b.warTarget)?.kingdomId === a.id) b.warTarget = -1;
        this.sim.log(`The ${a.name} and the ${b.name} made peace`, { type: 'peace', kingdom: a.id });
        this.sim.emit('sfx', { name: 'peace' });
    }
    diplomacy() {
        const sim = this.sim, rng = sim.rng;
        const ks = this.aliveKingdoms();
        for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
            const a = ks[i], b = ks[j];
            let r = a.relations[b.id] || 0;
            const near = this.kingdomDistance(a, b) < 34;
            const aggr = (SPECIES[a.race].aggression + SPECIES[b.race].aggression) / 2;
            r += a.race === b.race ? 1.5 : -0.8;
            if (near) r -= 2 + aggr * 5;
            r += rng.float(-3, 3);
            const war = a.wars[b.id] != null, allied = a.allies[b.id] != null;
            if (war) r += 2;
            if (allied) r += near ? 4 + aggr * 5 : 2; // allies cancel out border friction
            // Sharing an enemy brings realms together.
            for (const e in a.wars) if (b.wars[e] != null) { r += 4; break; }
            r = EP.clamp(r, -100, 100);
            a.relations[b.id] = b.relations[a.id] = r;
            if (!war && !allied && near && r < -40 && a.warriors + b.warriors > 2 && rng.chance(0.1 + aggr * 0.3)) {
                rng.chance(0.5) ? this.declareWar(a, b) : this.declareWar(b, a);
            } else if (!war && !allied && r > 50 && this.kingdomDistance(a, b) < 90 && rng.chance(0.12)) {
                this.formAlliance(a, b);
            } else if (allied && r < 10) {
                this.breakAlliance(a, b);
            } else if (war) {
                const years = sim.year - a.wars[b.id];
                if (years >= 4 && rng.chance(0.06 + years * 0.025 - aggr * 0.05)) this.makePeace(a, b);
            }
        }
    }
    kingdomDistance(a, b) {
        let best = Infinity;
        for (const ia of a.cities) { const ca = this.cities.get(ia); if (!ca) continue;
            for (const ib of b.cities) { const cb = this.cities.get(ib); if (!cb) continue;
                const d = EP.dist(ca.x, ca.y, cb.x, cb.y); if (d < best) best = d; } }
        return best;
    }

    // ------------------------------------------------------------ site finding
    fits(city, type, x, y) {
        const w = this.sim.world, d = BUILDINGS[type];
        if (x < 1 || y < 1 || x + d.w >= w.w - 1 || y + d.h >= w.h - 1) return false;
        let nearHills = type !== 'mine';
        let coast = type !== 'docks';
        for (let yy = y - 1; yy <= y + d.h; yy++) for (let xx = x - 1; xx <= x + d.w; xx++) {
            const i = w.idx(xx, yy);
            const inside = xx >= x && yy >= y && xx < x + d.w && yy < y + d.h;
            if (inside) {
                if (w.owner[i] !== city.id || w.bld[i] >= 0 || w.fire[i]) return false;
                const t = w.terrain[i];
                if (d.field) { if (t !== T.GRASS && t !== T.SAVANNA && t !== T.SOIL && t !== T.ASH && t !== T.SWAMP) return false; }
                else if (!TERRAIN[t].build && !(type === 'mine' && t === T.HILLS)) return false;
                if (w.ore[i] && !d.field && type !== 'mine') return false; // don't bury a vein
            } else {
                const ob = w.bld[i];
                if (ob >= 0 && !(d.field && this.buildings.get(ob)?.type === 'farm')) return false;
                if (type === 'hall' && w.terrain[i] === T.DEEP) return false;
                if (!coast && w.waterbody[i] >= 0 && w.waterSizes[w.waterbody[i]] >= 120 && (xx === x - 1 || xx === x + d.w) !== (yy === y - 1 || yy === y + d.h)) coast = true;
            }
        }
        if (!coast) return false;
        if (!nearHills) {
            for (let yy = y - 2; yy <= y + d.h + 1 && !nearHills; yy++) for (let xx = x - 2; xx <= x + d.w + 1; xx++) {
                const t = w.t(xx, yy);
                if (t === T.HILLS || t === T.MOUNTAIN) { nearHills = true; break; }
            }
        }
        return nearHills;
    }
    findSite(city, type) {
        const rng = this.sim.rng, d = BUILDINGS[type];
        let best = null, bs = -Infinity;
        const R = Math.max(3, city.radius);
        const tries = type === 'docks' || type === 'mine' ? 140 : 60;
        for (let a = 0; a < tries; a++) {
            let r;
            if (type === 'hall') r = rng.next() * 2.2;
            else if (type === 'tower') r = R * (0.55 + rng.next() * 0.4);
            else if (type === 'farm') r = 3 + rng.next() * (R - 1);
            else if (type === 'docks') r = 1.5 + rng.next() * (R + 0.5);
            else r = 2.5 + rng.next() * (R - 1.5);
            const ang = rng.next() * Math.PI * 2;
            const x = Math.round(city.x + Math.cos(ang) * r - d.w / 2), y = Math.round(city.y + Math.sin(ang) * r - d.h / 2);
            if (!this.fits(city, type, x, y)) continue;
            let score = -r;
            if (type === 'tower') score = r;
            else if (type === 'farm') score = -Math.abs(r - 5.5);
            else if (type === 'mine') score = -r * 0.3 + this.oreAround(x + 1, y + 1, 7) * 0.6;
            score += rng.next() * 0.8;
            if (score > bs) { bs = score; best = { x, y }; }
        }
        return best;
    }
    findCitySite(src, k) {
        const sim = this.sim, w = sim.world, rng = sim.rng;
        let best = null, bs = -Infinity;
        for (let a = 0; a < 50; a++) {
            const ang = rng.next() * Math.PI * 2, r = 14 + rng.next() * 24;
            const x = Math.round(src.x + Math.cos(ang) * r), y = Math.round(src.y + Math.sin(ang) * r);
            if (!w.inb(x, y) || !w.sameLand(src.x, src.y + 2, x, y)) continue;
            if (!this.canFoundAt(x, y)) continue;
            let score = -r * 0.4;
            for (let dy = -4; dy <= 4; dy += 2) for (let dx = -4; dx <= 4; dx += 2) {
                const t = w.t(x + dx, y + dy);
                if (t === T.GRASS) score += 1;
                if (t === T.HILLS && k.race === 'dwarf') score += 1.5;
                if (w.inb(x + dx, y + dy) && w.tree[w.idx(x + dx, y + dy)] && k.race === 'elf') score += 0.8;
                if (EP.isWaterT(t)) score += 0.3;
            }
            if (score > bs) { bs = score; best = { x, y }; }
        }
        return best;
    }

    // ------------------------------------------------------------ resource finding
    findTree(city, u) {
        const w = this.sim.world;
        const cx = city.x | 0, cy = city.y | 0, R = Math.floor(Math.min(22, city.radius + 7));
        let best = -1, bd = Infinity;
        for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
            const x = cx + dx, y = cy + dy;
            if (!w.inb(x, y)) continue;
            const i = w.idx(x, y);
            if (!w.tree[i]) continue;
            const d = dx * dx + dy * dy + EP.hash2(x, y, this.sim.tick) * 6;
            if (d >= bd || w.fire[i] || this.reserved.has(i)) continue;
            if (!w.sameLand(x, y, u.x, u.y) && !this.adjWalkable(x, y, u)) continue;
            bd = d; best = i;
        }
        return best;
    }
    adjWalkable(x, y, u) {
        const w = this.sim.world;
        for (let k = 0; k < 4; k++) if (w.walkable(x + EP.DX8[k], y + EP.DY8[k]) && w.sameLand(x + EP.DX8[k], y + EP.DY8[k], u.x, u.y)) return true;
        return false;
    }
    findRock(city, u) {
        const w = this.sim.world;
        const cx = city.x | 0, cy = city.y | 0, R = Math.floor(Math.min(20, city.radius + 6));
        let best = null, bd = Infinity;
        for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
            const x = cx + dx, y = cy + dy, t = w.t(x, y);
            if (t !== T.HILLS && t !== T.MOUNTAIN) continue;
            const d = dx * dx + dy * dy;
            if (d >= bd) continue;
            for (let k = 0; k < 4; k++) {
                const nx = x + EP.DX8[k], ny = y + EP.DY8[k];
                if (w.walkable(nx, ny) && w.sameLand(nx, ny, u.x, u.y)) { bd = d; best = { x: nx + 0.5, y: ny + 0.5 }; break; }
            }
        }
        return best;
    }
    oreAround(x, y, r) {
        const w = this.sim.world; let n = 0;
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const xx = x + dx, yy = y + dy; if (w.inb(xx, yy) && w.ore[w.idx(xx, yy)]) n++; }
        return n;
    }
    // Best reachable ore vein for a miner: rarer ore and ore the realm lacks are worth a longer walk.
    findOre(city, u, k) {
        const w = this.sim.world;
        const cx = city.x | 0, cy = city.y | 0, R = Math.floor(Math.min(26, city.radius + 11));
        let best = null, bs = 0;
        for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
            const x = cx + dx, y = cy + dy;
            if (!w.inb(x, y)) continue;
            const i = w.idx(x, y), o = w.ore[i];
            if (!o || this.reserved.has(i)) continue;
            const info = EP.ORE_INFO[o];
            const want = info.value / (1 + (k[info.res] || 0) / 40);
            const s = want / (Math.sqrt(dx * dx + dy * dy) + 4);
            if (s <= bs) continue;
            let stand = null;
            if (w.walkable(x, y) && w.sameLand(x, y, u.x, u.y)) stand = { x: x + 0.5, y: y + 0.5 };
            else for (let d = 0; d < 8; d++) {
                const nx = x + EP.DX8[d], ny = y + EP.DY8[d];
                if (w.walkable(nx, ny) && w.sameLand(nx, ny, u.x, u.y)) { stand = { x: nx + 0.5 - EP.DX8[d] * 0.3, y: ny + 0.5 - EP.DY8[d] * 0.3 }; break; }
            }
            if (!stand) continue;
            bs = s; best = { i, x: stand.x, y: stand.y };
        }
        return best;
    }
    findFishingSpot(city, u) {
        const w = this.sim.world, rng = this.sim.rng;
        for (let a = 0; a < 30; a++) {
            const x = (city.x + rng.float(-10, 10)) | 0, y = (city.y + rng.float(-10, 10)) | 0;
            if (!w.walkable(x, y) || EP.isWaterT(w.t(x, y)) || !w.sameLand(x, y, u.x, u.y)) continue;
            for (let k = 0; k < 4; k++) if (w.t(x + EP.DX8[k], y + EP.DY8[k]) === T.DEEP || w.t(x + EP.DX8[k], y + EP.DY8[k]) === T.SHALLOW) return { x: x + 0.5, y: y + 0.5 };
        }
        return null;
    }
    // A walkable point on the edge of a building's footprint.
    approach(b, u) {
        const w = this.sim.world;
        const px = EP.clamp(u.x, b.x - 0.4, b.x + b.w + 0.4), py = EP.clamp(u.y, b.y - 0.4, b.y + b.h + 0.4);
        const cands = [[px, py], [b.x + b.w / 2, b.y + b.h + 0.4], [b.x - 0.4, b.y + b.h / 2], [b.x + b.w + 0.4, b.y + b.h / 2], [b.x + b.w / 2, b.y - 0.4]];
        for (const [x, y] of cands) if (w.walkable(x, y) && w.sameLand(x, y, u.x, u.y)) return { x, y };
        return null;
    }

    // ------------------------------------------------------------ per-tick
    // ------------------------------------------------------------ gear
    afford(k, cost) { for (const r in cost) if ((k[r] || 0) < cost[r]) return false; return true; }
    pay(k, cost) { for (const r in cost) k[r] -= cost[r]; }
    bestTier(k) {
        for (let t = GEAR.length - 1; t > 0; t--) if (k.age >= GEAR[t].age && this.afford(k, GEAR[t].cost)) return t;
        return 0;
    }
    // How many people still want gear of at least `tier`, minus what already waits in the armoury.
    gearDemand(c, k, tier) {
        if (tier <= 0) return { wpn: 0, arm: 0 };
        let wpn = 0, arm = 0;
        for (const u of c.members) {
            if (!u.adult) continue;
            const wt = u.job === 'warrior' ? 2 : 1;
            if ((u.wpn || 0) < tier) wpn += wt;
            if ((u.arm || 0) < tier) arm += wt;
        }
        for (let t = tier; t < GEAR.length; t++) { wpn -= k.armory.wpn[t] * 2; arm -= k.armory.arm[t] * 2; }
        return { wpn: Math.max(0, wpn), arm: Math.max(0, arm) };
    }
    forge(u, k) {
        const sim = this.sim, c = this.cities.get(u.cityId);
        const tier = this.bestTier(k);
        if (!c || tier <= 0) return false;
        const dem = this.gearDemand(c, k, tier);
        if (!dem.wpn && !dem.arm) return false;
        const slot = dem.wpn >= dem.arm ? 'wpn' : 'arm';
        this.pay(k, GEAR[tier].cost);
        k.armory[slot][tier]++;
        sim.fx.burst(u.x + u.face * 0.4, u.y - 0.4, 6, { colors: ['#fff3a0', '#ffb43a', GEAR[tier].color], speed: 0.06, life: 16, grav: 0.004, glow: true, size: 1 });
        if (tier > k.forged) {
            k.forged = tier;
            sim.log(`Smiths of the ${k.name} forged their first ${GEAR[tier].name.toLowerCase()} ${slot === 'wpn' ? 'weapons' : 'armour'}`, { x: u.x, y: u.y, type: 'age', kingdom: k.id });
        }
        return true;
    }
    // Hand out the armoury's best kit, warriors first. Old kit goes back for someone else.
    equip(c, k) {
        let stock = 0;
        for (let t = 1; t < GEAR.length; t++) stock += k.armory.wpn[t] + k.armory.arm[t];
        if (!stock) return;
        const people = c.members.filter(u => u.adult && !u.dead && !(u.boarded > 0));
        people.sort((a, b) => (b.job === 'warrior') - (a.job === 'warrior'));
        for (const u of people) {
            let changed = false;
            for (const slot of ['wpn', 'arm']) {
                const cur = u[slot] || 0, store = k.armory[slot];
                for (let t = GEAR.length - 1; t > cur; t--) {
                    if (!store[t]) continue;
                    store[t]--; if (cur > 0) store[cur]++;
                    u[slot] = t; changed = true;
                    break;
                }
            }
            if (changed) Units.recalc(this.sim, u);
        }
    }

    // ------------------------------------------------------------ roads
    roadCost(i) {
        const w = this.sim.world, t = w.terrain[i];
        if (w.bld[i] >= 0 || t === T.DEEP || t === T.MOUNTAIN || t === T.LAVA) return -1;
        if (EP.isRoadT(t)) return 0.35;
        if (t === T.SHALLOW) return 7;
        let c = t === T.HILLS ? 2.2 : t === T.SWAMP ? 2 : t === T.SNOW || t === T.SAND ? 1.3 : 1;
        if (w.tree[i]) c += 0.8;
        if (w.ore[i]) c += 6;
        if (w.fire[i]) c += 4;
        return c;
    }
    roadPath(a, b, maxNodes) {
        const w = this.sim.world;
        if (!w.inb(a.x, a.y) || !w.inb(b.x, b.y)) return null;
        return EP.findPath(w, w.idx(a.x, a.y), w.idx(b.x, b.y), i => this.roadCost(i), maxNodes);
    }
    queueRoad(c, path) {
        const w = this.sim.world;
        if (!path) return;
        for (const i of path) {
            const t = w.terrain[i];
            if (EP.isRoadT(t) || w.bld[i] >= 0 || t === T.DEEP || t === T.MOUNTAIN || t === T.LAVA) continue;
            c.roadQ.push(i);
        }
    }
    // Lay out streets to every building, highways to sister towns, then pave.
    planRoads(c, k) {
        const w = this.sim.world;
        if (c.roadQ && c.roadQ.length) return;
        c.roadQ = [];
        const hall = this.buildings.get(c.hallId);
        if (!hall || !hall.done) return;
        const from = this.door(hall);
        c.streets = (c.streets || []).filter(id => this.buildings.has(id));
        let planned = 0;
        for (const id of c.buildings) {
            const b = this.buildings.get(id);
            if (!b || !b.done || b.type === 'farm' || b.type === 'hall' || c.streets.includes(id)) continue;
            c.streets.push(id);
            this.queueRoad(c, this.roadPath(from, this.door(b), 1500));
            if (++planned >= 3) break;
        }
        if (c.roadQ.length) return;
        c.links = c.links || [];
        const sisters = k.cities.map(id => this.cities.get(id)).filter(o => o && o !== c && !c.links.includes(o.id) && EP.dist(c.x, c.y, o.x, o.y) < 75 && w.sameLand(c.x, c.y, o.x, o.y))
            .sort((a, b) => EP.dist2(c.x, c.y, a.x, a.y) - EP.dist2(c.x, c.y, b.x, b.y));
        for (const o of sisters) {
            const oh = this.buildings.get(o.hallId);
            c.links.push(o.id);
            if (!oh) continue;
            (o.links = o.links || []).push(c.id);
            this.queueRoad(c, this.roadPath(from, this.door(oh), 9000));
            if (c.roadQ.length) return;
        }
        if (k.age >= 2 && k.stone > 40) {
            const R = Math.ceil(c.radius);
            for (let dy = -R; dy <= R && c.roadQ.length < 40; dy++) for (let dx = -R; dx <= R; dx++) {
                const x = (c.x | 0) + dx, y = (c.y | 0) + dy;
                if (!w.inb(x, y)) continue;
                const i = w.idx(x, y);
                if (w.terrain[i] === T.ROAD && w.owner[i] === c.id) c.roadQ.push(i);
            }
        }
    }
    nextRoadTile(c, u) {
        const w = this.sim.world, k = this.kingdoms.get(c.kingdomId);
        while (c.roadQ && c.roadQ.length) {
            const i = c.roadQ.shift(), t = w.terrain[i];
            if (w.bld[i] >= 0 || t === T.DEEP || t === T.MOUNTAIN || t === T.LAVA || t === T.BRIDGE || t === T.PAVED) continue;
            if (t === T.ROAD && !(k && k.age >= 2)) continue;
            if (this.reserved.has(i)) continue;
            const x = i % w.w, y = (i / w.w) | 0;
            if (!w.sameLand(x, y, u.x, u.y)) continue;
            return i;
        }
        return -1;
    }
    layRoad(k, i) {
        const w = this.sim.world, t = w.terrain[i];
        if (w.bld[i] >= 0 || t === T.DEEP || t === T.MOUNTAIN || t === T.LAVA) return;
        if (t === T.SHALLOW) { if (k.wood >= 3) { k.wood -= 3; w.setTerrain(i, T.BRIDGE); } return; }
        if (k.age >= 2 && k.stone >= 15) { k.stone -= 1; w.setTerrain(i, T.PAVED); }
        else if (t !== T.ROAD && t !== T.PAVED && t !== T.BRIDGE) w.setTerrain(i, T.ROAD);
        w.wear[i] = 0;
    }

    // ------------------------------------------------------------ sea & trade
    // A water tile beside the docks that opens onto a sizeable sea.
    dockWater(b) {
        const w = this.sim.world;
        if (b.water != null && b.water >= 0 && EP.isWaterT(w.terrain[b.water])) return b.water;
        b.water = -1;
        for (let yy = b.y - 1; yy <= b.y + b.h; yy++) for (let xx = b.x - 1; xx <= b.x + b.w; xx++) {
            if (!w.inb(xx, yy)) continue;
            const i = w.idx(xx, yy), wb = w.waterbody[i];
            if (wb >= 0 && w.waterSizes[wb] >= 120) { b.water = i; return i; }
        }
        return -1;
    }
    isCoastal(c) {
        const w = this.sim.world;
        if (c.coastV === w.landVersion) return c.coastal;
        c.coastV = w.landVersion; c.coastal = false;
        const R = Math.ceil(c.radius) + 2;
        for (let dy = -R; dy <= R && !c.coastal; dy++) for (let dx = -R; dx <= R; dx++) {
            const x = (c.x | 0) + dx, y = (c.y | 0) + dy;
            if (!w.inb(x, y)) continue;
            const wb = w.waterbody[w.idx(x, y)];
            if (wb >= 0 && w.waterSizes[wb] >= 120) { c.coastal = true; break; }
        }
        return c.coastal;
    }
    // Search the sea around a town's docks for a free shore on another landmass.
    findLanding(water, accept, maxNodes = 7000) {
        const w = this.sim.world, rng = this.sim.rng, wb = w.waterbody[water];
        if (wb < 0) return null;
        const seen = new Set([water]), q = [water], shores = [];
        for (let h = 0; h < q.length && h < maxNodes; h++) {
            const i = q[h], x = i % w.w, y = (i / w.w) | 0;
            for (let k = 0; k < 4; k++) {
                const nx = x + EP.DX8[k], ny = y + EP.DY8[k];
                if (!w.inb(nx, ny)) continue;
                const j = w.idx(nx, ny);
                if (seen.has(j)) continue;
                seen.add(j);
                if (w.waterbody[j] === wb) q.push(j);
                else if (w.walkableI(j) && !EP.isWaterT(w.terrain[j]) && rng.chance(0.25)) shores.push([j, i]);
            }
        }
        for (let a = 0; a < 40 && shores.length; a++) {
            const [land, sea] = shores[(rng.next() * shores.length) | 0];
            const r = accept(land);
            if (r) return Object.assign({ land: { x: land % w.w + 0.5, y: ((land / w.w) | 0) + 0.5 }, water: sea }, r);
        }
        return null;
    }
    findOverseasSite(c, k) {
        const sim = this.sim, w = sim.world, rng = sim.rng;
        const dock = this.builtIn(c, 'docks').find(b => this.dockWater(b) >= 0);
        if (!dock) return null;
        const home = w.landmass[w.idx(c.x | 0, c.y | 0)];
        const res = this.findLanding(dock.water, land => {
            const lm = w.landmass[land];
            if (lm < 0 || lm === home || w.landmassSizes[lm] < 50) return null;
            const lx = land % w.w, ly = (land / w.w) | 0;
            for (let t = 0; t < 10; t++) {
                const x = lx + rng.int(-6, 6), y = ly + rng.int(-6, 6);
                if (w.inb(x, y) && w.landmass[w.idx(x, y)] === lm && this.canFoundAt(x, y)) return { site: { x, y } };
            }
            return null;
        });
        if (res) res.dock = dock;
        return res;
    }
    // Ship warriors across the sea to an enemy town no road can reach.
    planInvasion(k, enemies) {
        const sim = this.sim, w = sim.world, V = sim.vehicles;
        k.navalT = sim.tick + 2400;
        for (const cid of k.cities) {
            const c = this.cities.get(cid);
            if (!c) continue;
            const dock = this.builtIn(c, 'docks').find(b => this.dockWater(b) >= 0);
            if (!dock) continue;
            const wb = w.waterbody[dock.water];
            for (const e of enemies) for (const tid of e.cities) {
                const tc = this.cities.get(tid);
                if (!tc || w.sameLand(c.x, c.y, tc.x, tc.y)) continue;
                const tl = w.landmass[w.idx(tc.x | 0, tc.y | 0)];
                let land = null;
                for (let a = 0; a < 60 && !land; a++) {
                    const ang = sim.rng.next() * Math.PI * 2, r = tc.radius + 1 + sim.rng.next() * 8;
                    const x = (tc.x + Math.cos(ang) * r) | 0, y = (tc.y + Math.sin(ang) * r) | 0;
                    if (!w.inb(x, y) || w.landmass[w.idx(x, y)] !== tl || EP.isWaterT(w.terrain[w.idx(x, y)])) continue;
                    for (let d = 0; d < 4; d++) {
                        const nx = x + EP.DX8[d], ny = y + EP.DY8[d];
                        if (w.inb(nx, ny) && w.waterbody[w.idx(nx, ny)] === wb) { land = { x: x + 0.5, y: y + 0.5, water: w.idx(nx, ny) }; break; }
                    }
                }
                if (!land) continue;
                const troops = sim.units.filter(u => !u.dead && u.kingdomId === k.id && u.job === 'warrior' && u.adult && u.state !== 'fight' && !u.boarded && !(u.task && u.task.kind === 'board') && w.sameLand(u.x, u.y, c.x, c.y))
                    .sort((a, b) => EP.dist2(a.x, a.y, c.x, c.y) - EP.dist2(b.x, b.y, c.x, c.y)).slice(0, 7);
                if (troops.length < 3) return;
                const v = V.transportAt(dock, k, c);
                if (!v) return;
                v.job = { kind: 'invade', land: { x: land.x, y: land.y }, water: land.water, target: tc.id };
                v.expect = troops.map(u => u.id);
                k.naval = { vid: v.id, target: tc.id, started: sim.tick };
                k.warTarget = tc.id;
                const p = this.door(dock);
                for (const u of troops) { CivAI.release(sim, u); CivAI.goto(u, p.x + 0.5 + sim.rng.float(-0.6, 0.6), p.y + 0.5, { kind: 'board', vid: v.id }); }
                sim.log(`The ${k.name} launched a fleet against ${tc.name}`, { x: c.x, y: c.y, type: 'war', kingdom: k.id });
                return;
            }
        }
    }
    // Called by a transport once it reaches the far shore.
    onLanded(v, passengers) {
        const sim = this.sim, job = v.job || {};
        const k = this.kingdoms.get(v.kingdomId);
        for (const u of passengers) {
            if (job.kind === 'settle' && k && k.expedition) { u.task = { kind: 'settle', x: k.expedition.x, y: k.expedition.y }; u.state = 'goto'; Units.setTarget(u, k.expedition.x + 0.5 + sim.rng.float(-1, 1), k.expedition.y + 0.5 + sim.rng.float(-1, 1)); }
            else { u.task = null; u.state = 'idle'; }
        }
        if (k && job.kind === 'invade') { k.naval = null; k.warTarget = job.target; }
    }
    // Merchants: carts between markets over land, ships between ports over sea.
    trade(c, k) {
        const sim = this.sim, w = sim.world, V = sim.vehicles;
        const mk = this.builtIn(c, 'market')[0];
        if (!mk || V.activeFrom(mk.id)) return;
        const dock = this.builtIn(c, 'docks').find(b => this.dockWater(b) >= 0);
        let best = null, bs = -Infinity;
        for (const o of this.cities.values()) {
            if (o === c) continue;
            const ok = this.kingdoms.get(o.kingdomId);
            if (!ok || !ok.alive || this.atWar(k.id, ok.id) || (ok !== k && (k.relations[ok.id] || 0) < -10)) continue;
            const om = this.builtIn(o, 'market')[0];
            if (!om) continue;
            const d = EP.dist(c.x, c.y, o.x, o.y);
            if (d < 8 || d > 90) continue;
            const land = w.sameLand(c.x, c.y, o.x, o.y);
            let od = null;
            if (!land) {
                if (!dock) continue;
                od = this.builtIn(o, 'docks').find(b => this.dockWater(b) >= 0 && w.waterbody[b.water] === w.waterbody[dock.water]);
                if (!od) continue;
            }
            const s = (ok === k ? 0 : 6) + (k.allies[ok.id] != null ? 6 : 0) + sim.rng.next() * 4 - d * 0.03;
            if (s > bs) { bs = s; best = { o, om, od, land, d }; }
        }
        if (!best) return;
        if (best.land) V.spawnCart(mk, k, c, best.om, best.d);
        else V.spawnTradeShip(mk, dock, k, c, best.od, best.d);
    }
    // A caravan or ship arrived at its partner market.
    onTrade(v) {
        const sim = this.sim;
        const k = this.kingdoms.get(v.kingdomId), dest = this.buildings.get(v.dest);
        const ok = dest && this.buildingKingdom(dest);
        if (!k || !k.alive) return;
        const val = Math.round(4 + (v.dist || 20) * 0.1 + k.age * 1.5);
        k.gold += val;
        if (ok && ok.alive && ok !== k) {
            ok.gold += Math.round(val * 0.8);
            k.relations[ok.id] = ok.relations[k.id] = EP.clamp((k.relations[ok.id] || 0) + 3, -100, 100);
        }
        sim.fx.text(v.x, v.y - 1.2, '+' + val + 'g', '#ffe066');
    }

    update() {
        const sim = this.sim, tick = sim.tick;
        if (tick % 20 === 0) { this.census(); for (const c of [...this.cities.values()]) if (this.cities.has(c.id)) this.updateCity(c); }
        for (const k of this.kingdoms.values()) if (k.alive && (tick + k.id * 7) % 60 === 0) this.updateKingdom(k);
        if (tick % EP.TICKS_PER_YEAR === 0 && tick > 0) { this.diplomacy(); this.yearly(); }
        // Towers & temples
        if (tick % 10 === 0) for (const b of this.buildings.values()) {
            if (!b.done) continue;
            if (b.type === 'tower') this.towerFire(b);
            else if (b.type === 'temple' && (tick + b.id) % 60 === 0) this.templeHeal(b);
            if (b.hp < b.maxHp * 0.5 && sim.rng.chance(0.15)) sim.fx.burst(b.x + b.w * sim.rng.next(), b.y + 0.2, 1, { color: '#555', speed: 0.01, life: 50, rise: 0.025, size: 2 });
        }
    }
    census() {
        const sim = this.sim;
        for (const c of this.cities.values()) { c.pop = 0; c.adults = 0; c.members.length = 0; c.jobs = {}; }
        for (const k of this.kingdoms.values()) { k.pop = 0; k.adults = 0; k.warriors = 0; }
        for (const u of sim.units) {
            if (u.dead || u.kind !== 'civ' || u.kingdomId < 0) continue;
            const k = this.kingdoms.get(u.kingdomId);
            if (!k || !k.alive) { u.kingdomId = -1; u.cityId = -1; continue; }
            k.pop++;
            if (u.adult) k.adults++;
            if (u.job === 'warrior') k.warriors++;
            const c = this.cities.get(u.cityId);
            if (!c || c.kingdomId !== k.id) { if (!(u.task && u.task.kind === 'settle')) this.rehome(u, k); continue; }
            c.pop++; c.members.push(u);
            if (u.adult) { c.adults++; c.jobs[u.job || 'none'] = (c.jobs[u.job || 'none'] || 0) + 1; }
        }
    }
    updateCity(c) {
        const sim = this.sim, w = sim.world, rng = sim.rng;
        const k = this.kingdoms.get(c.kingdomId);
        if (!k || !k.alive) return;
        // Buildings summary
        let housing = 0, sites = 0; const count = {}, built = {};
        for (const id of c.buildings) {
            const b = this.buildings.get(id); if (!b) continue;
            count[b.type] = (count[b.type] || 0) + 1;
            if (b.done) { housing += BUILDINGS[b.type].housing || 0; built[b.type] = (built[b.type] || 0) + 1; }
            else { sites++; housing += (BUILDINGS[b.type].housing || 0) * 0.5; }
        }
        c.housing = housing | 0; c.count = count; c.built = built; c.sites = sites;
        const hall = this.buildings.get(c.hallId);
        // Threat level
        let threat = 0;
        sim.grid.query(c.x, c.y, c.radius + 3, o => { if (this.hostileToKingdom(k, o)) threat++; });
        c.threat = threat;
        // Territory growth
        const targetR = Math.min(18, 4 + Math.sqrt(c.pop) * 1.6 + (count.house || 0) * 0.15);
        c.radius += (targetR - c.radius) * 0.1;
        for (let s = 0; s < 24; s++) {
            const a = rng.next() * Math.PI * 2, r = Math.sqrt(rng.next()) * c.radius;
            const x = (c.x + Math.cos(a) * r) | 0, y = (c.y + Math.sin(a) * r) | 0;
            if (!w.inb(x, y)) continue;
            const i = w.idx(x, y);
            if (!this.canClaim(i)) continue;
            if ((x > 0 && w.owner[i - 1] === c.id) || (x < w.w - 1 && w.owner[i + 1] === c.id) || (y > 0 && w.owner[i - w.w] === c.id) || (y < w.h - 1 && w.owner[i + w.w] === c.id))
                this.claim(c, i);
        }
        if (c.pop === 0 && !this.expeditionTo(c)) {
            c.empty = (c.empty || 0) + 1;
            if (c.empty > 30) { this.destroyCity(c, 'was abandoned'); return; }
        } else c.empty = 0;
        if (!hall) return;
        // Births
        if (hall.done && c.pop < c.housing && k.food > 15 + k.pop * 1.6) {
            const temples = count.temple || 0;
            if (rng.chance(0.2 * SPECIES[k.race].fertility * (1 + temples * 0.15))) {
                const u = sim.spawnUnit(k.race, hall.x + 1.5, hall.y + 3.1, { age: 0 });
                if (u) { this.join(u, c); k.food -= 4; k.births++; }
            }
        }
        this.assignJobs(c, k);
        this.equip(c, k);
        if (hall.done) {
            this.plan(c, k, count, sites);
            const slot = (sim.tick + c.id * 37) % 600;
            if (slot < 20) this.planRoads(c, k);
            else if (slot >= 300 && slot < 320 && built.market) this.trade(c, k);
            else if (slot >= 200 && slot < 220 && built.docks) sim.vehicles.manageFleet(c, k);
        }
    }
    assignJobs(c, k) {
        const adults = c.members.filter(u => u.adult && !u.dead && !(u.boarded > 0) && !(u.task && (u.task.kind === 'settle' || u.task.kind === 'board')));
        const n = adults.length;
        if (!n) return;
        const wars = Object.keys(k.wars).length;
        let wantW = n < 4 ? 0 : Math.round(n * (wars ? 0.34 : 0.1) + ((c.count.barracks || 0) ? n * 0.08 : 0));
        if (c.threat > 0) wantW = Math.max(wantW, Math.round(n * 0.4));
        const roads = c.roadQ ? c.roadQ.length : 0;
        let wantB = c.sites > 0 ? Math.min(c.sites + 1, Math.max(1, Math.ceil(n * 0.25)), 4) : 0;
        const lowWood = k.wood < 35;
        if (roads && n >= 3 && !lowWood) wantB = Math.max(wantB, roads > 25 && n >= 10 ? 2 : 1);
        const hills = c.hills != null ? c.hills : (c.hills = this.hillsNear(c));
        if (c.oreT == null || this.sim.tick - c.oreT > 1200) { c.oreT = this.sim.tick; c.oreNear = this.oreAround(c.x | 0, c.y | 0, Math.min(24, Math.ceil(c.radius) + 9)); }
        const starving = k.food < k.pop * 1.5, hungry = k.food < k.pop * 3;
        const smithy = c.built && c.built.smithy;
        let wantM = starving ? 0 : (c.count.mine || c.oreNear) ? Math.max(1, Math.round(n * (k.race === 'dwarf' ? 0.16 : 0.09)) + (smithy && c.oreNear && n >= 12 ? 1 : 0)) : (hills && k.stone < 60 ? 1 : 0);
        if (lowWood) wantM = Math.min(wantM, 1);
        let wantS = 0;
        if (smithy && !starving && n >= 6) { const t = this.bestTier(k); if (t > 0) { const d = this.gearDemand(c, k, t); if (d.wpn + d.arm > 0) wantS = Math.min(smithy, 2); } }
        let rest = Math.max(0, n - wantW - wantB - wantM - wantS);
        const plenty = k.food > k.pop * 8 && k.wood < 60 + k.pop;
        const wantF = Math.round(rest * (starving ? 0.8 : hungry ? 0.62 : plenty ? 0.3 : lowWood ? 0.38 : 0.45));
        const target = { warrior: wantW, builder: wantB, miner: wantM, smith: wantS, farmer: wantF, woodcutter: Math.max(0, rest - wantF) };
        const have = { warrior: 0, builder: 0, miner: 0, smith: 0, farmer: 0, woodcutter: 0 };
        const free = [];
        for (const u of adults) {
            if (u.job && have[u.job] < target[u.job]) have[u.job]++;
            else free.push(u);
        }
        for (const u of free) {
            let job = 'farmer', deficit = -Infinity;
            for (const j in target) { const d = target[j] - have[j]; if (d > deficit) { deficit = d; job = j; } }
            have[job]++;
            if (u.job !== job) {
                const wasW = u.job === 'warrior';
                u.job = job;
                if (u.state !== 'fight' && u.state !== 'work') { EP.CivAI.release(this.sim, u); u.state = 'idle'; u.task = null; }
                if (wasW || job === 'warrior') Units.recalc(this.sim, u);
            }
        }
    }
    hillsNear(c) {
        const w = this.sim.world;
        for (let dy = -10; dy <= 10; dy += 2) for (let dx = -10; dx <= 10; dx += 2) {
            const t = w.t((c.x + dx) | 0, (c.y + dy) | 0);
            if (t === T.HILLS || t === T.MOUNTAIN) return true;
        }
        return false;
    }
    plan(c, k, count, sites) {
        if (sites >= 1 + Math.floor(c.pop / 14)) return;
        const has = t => count[t] || 0;
        const wars = Object.keys(k.wars).length > 0;
        const hills = c.hills != null ? c.hills : (c.hills = this.hillsNear(c));
        // Ordered wish-list; build the first one we can afford and place.
        const tick = this.sim.tick;
        const coastal = !has('docks') && c.pop >= 9 && (!c.dockT || tick - c.dockT > 3000) && this.isCoastal(c);
        const wish = [];
        if (c.housing < c.pop + 3) wish.push('house');
        if (has('farm') * 5 < c.pop && has('farm') < 8) wish.push('farm');
        if (!has('granary') && c.pop >= 10 && has('farm') >= 2) wish.push('granary');
        if (!has('mine') && c.pop >= 6 && (hills || c.oreNear)) wish.push('mine');
        if (coastal) wish.push('docks');
        if (k.age >= 1 && !has('smithy') && c.pop >= 10) wish.push('smithy');
        if (k.age >= 1 && !has('temple') && c.pop >= 10) wish.push('temple');
        if (k.age >= 1 && !has('windmill') && has('farm') >= 3) wish.push('windmill');
        if (k.age >= 1 && has('tower') < Math.min(4, 1 + Math.floor(c.pop / 14)) && (wars || c.pop >= 10)) wish.push('tower');
        if (k.age >= 2 && !has('market') && c.pop >= 16) wish.push('market');
        if (k.age >= 2 && !has('barracks') && c.pop >= 18) wish.push('barracks');
        if (k.age >= 2 && !has('library') && c.pop >= 20) wish.push('library');
        if (c.housing < c.pop + 8 && has('house') < 22) wish.push('house');
        for (const type of wish) {
            const d = BUILDINGS[type];
            if (!this.afford(k, d.cost)) continue;
            const site = this.findSite(c, type);
            if (!site) { if (type === 'mine') c.hills = false; if (type === 'docks') c.dockT = tick; continue; }
            for (const r in d.cost) k[r] -= d.cost[r];
            this.createBuilding(type, c, site.x, site.y, false);
            return;
        }
    }
    expeditionTo(c) {
        const k = this.kingdoms.get(c.kingdomId);
        return !!(k && c.founded === this.sim.year && c.buildings.length <= 1);
    }
    updateKingdom(k) {
        const sim = this.sim;
        if (!k.cities.length) { this.fallKingdom(k); return; }
        this.ensureKingdom(k);
        // Masons quarry a little stone in every town; surplus goods are traded for food.
        k.stone += k.cities.length * 0.5;
        let temples = 0, libraries = 0, markets = 0, granaries = 0;
        for (const id of k.cities) {
            const c = this.cities.get(id);
            if (!c || !c.built) continue;
            temples += c.built.temple || 0; libraries += c.built.library || 0; markets += c.built.market || 0; granaries += c.built.granary || 0;
        }
        // Markets cut and sell gems.
        if (markets && k.gems >= 1) { const n = Math.min(Math.floor(k.gems), markets * 2); k.gems -= n; k.gold += n * 6; }
        // Merchants import timber with gold or surplus stone.
        if (k.wood < 40) {
            if (k.gold >= 12) { k.gold -= 12; k.wood += 30; }
            else if (k.stone > 150) { k.stone -= 40; k.wood += 25; }
        }
        if (k.food < k.pop * 2) {

            for (const r of ['stone', 'wood', 'gold']) {
                const spare = k[r] - (r === 'gold' ? 10 : 80);
                if (spare > 20) { const amt = Math.min(spare, 40); k[r] -= amt; k.food += amt * (r === 'gold' ? 4 : 0.8); break; }
            }
        }
        // Food
        k.food -= (k.adults || 0) * 0.5 + (k.pop - (k.adults || 0)) * 0.2;
        k.starving = k.food < 0;
        if (k.food < 0) k.food = 0;
        if (k.food > 200 + k.pop * 15 + granaries * 150) k.food *= 0.97; // spoilage
        k.peakPop = Math.max(k.peakPop, k.pop);
        // Research
        let wise = 0;
        for (const id of k.cities) { const c = this.cities.get(id); if (c) for (const u of c.members) if (u.traits.includes('wise')) wise++; }
        k.tech += (k.pop * 0.35 + temples * 3 + libraries * 5 + wise * 0.5) * TECH_MUL[k.race];
        // Title: tribes grow into chiefdoms, kingdoms and empires.
        let rank = 0;
        for (let r = EP.RANKS.length - 1; r > 0; r--) if (k.cities.length >= EP.RANKS[r].towns && k.pop >= EP.RANKS[r].pop) { rank = r; break; }
        if (rank > (k.rankMax || 0)) {
            k.rankMax = rank;
            const c = this.cities.get(k.capital), king = sim.unitMap.get(k.kingId);
            sim.log(`The ${k.name} has grown into ${rank === 3 ? 'an' : 'a'} ${EP.RANKS[rank].name}${king ? ` — ${king.name} is proclaimed ${EP.RULER_TITLE[k.race][rank]}` : ''}`, { x: c && c.x, y: c && c.y, type: 'king', kingdom: k.id });
            sim.emit('sfx', { name: 'age' });
        }
        k.rank = rank;
        if (k.age < AGES.length - 1 && k.tech >= AGES[k.age + 1].tech) {
            k.age++;
            for (const u of sim.units) if (!u.dead && u.kingdomId === k.id) Units.recalc(sim, u);
            const c = this.cities.get(k.capital);
            sim.log(`The ${k.name} has entered the ${AGES[k.age].name}`, { x: c && c.x, y: c && c.y, type: 'age', kingdom: k.id });
            sim.emit('sfx', { name: 'age' });
        }
        // Ruler
        const king = sim.unitMap.get(k.kingId);
        if (!king || king.dead || king.kingdomId !== k.id) {
            const cap = this.cities.get(k.capital) || this.largestCity(k);
            if (cap) {
                let best = null, bs = -1;
                for (const u of cap.members) if (!u.dead && u.adult) { const s = u.level * 20 + u.age + u.kills * 2; if (s > bs) { bs = s; best = u; } }
                if (best) {
                    const had = k.kingId >= 0;
                    k.kingId = best.id;
                    if (had) sim.log(`${best.name} is crowned ruler of the ${k.name}`, { x: best.x, y: best.y, type: 'king', kingdom: k.id, unit: best.id });
                }
            }
        }
        // War target
        if (k.naval && (!sim.vehicles.map.has(k.naval.vid) || sim.tick - k.naval.started > 5000)) k.naval = null;
        const enemies = Object.keys(k.wars).map(Number).map(id => this.kingdoms.get(id)).filter(e => e && e.alive);
        if (enemies.length && k.warriors >= 3) {
            const tc = this.cities.get(k.warTarget);
            if (!tc || !this.atWar(k.id, tc.kingdomId)) {
                const home = this.cities.get(k.capital) || this.largestCity(k);
                let best = -1, bd = Infinity;
                if (home) for (const e of enemies) for (const id of e.cities) {
                    const c = this.cities.get(id);
                    if (!c || !sim.world.sameLand(home.x, home.y + 2, c.x, c.y + 2)) continue;
                    const d = EP.dist2(home.x, home.y, c.x, c.y);
                    if (d < bd) { bd = d; best = id; }
                }
                k.warTarget = best;
            }
            // No enemy town by land: take the war overseas.
            if (k.warTarget < 0 && k.age >= 1 && !k.naval && sim.tick > (k.navalT || 0) && k.warriors >= 4) this.planInvasion(k, enemies);
        } else if (!enemies.length) k.warTarget = -1;
        // Expansion
        this.expand(k);
    }
    expand(k) {
        const sim = this.sim;
        const ex = k.expedition;
        if (ex) {
            const alive = ex.units.map(id => sim.unitMap.get(id)).filter(u => u && !u.dead && u.task && (u.task.kind === 'settle' || u.task.kind === 'board'));
            if (!alive.length || sim.tick - ex.started > (ex.sea ? 7000 : 2400)) this.cancelExpedition(k);
            return;
        }
        if (k.cities.length >= 10 || k.food < 30 || k.wood < 25 || k.starving) return;
        for (const id of k.cities) {
            const c = this.cities.get(id);
            if (!c || c.pop < 14 || c.pop < c.housing - 2) continue;
            let site = this.findCitySite(c, k), sea = null;
            // Nowhere left on this land: sail settlers to another shore.
            if (!site && k.age >= 1 && c.built && c.built.docks && (!c.seaT || sim.tick - c.seaT > 1500)) {
                c.seaT = sim.tick;
                sea = this.findOverseasSite(c, k);
                if (sea) site = sea.site;
            }
            if (!site) continue;
            const settlers = c.members.filter(u => !u.dead && u.adult && u.job !== 'warrior' && u.state !== 'fight' && !u.boarded).slice(0, 4);
            if (settlers.length < 3) continue;
            if (sea) {
                const v = sim.vehicles.transportAt(sea.dock, k, c);
                if (!v) continue;
                v.job = { kind: 'settle', land: sea.land, water: sea.water };
                v.expect = settlers.map(u => u.id);
                k.food -= 15; k.wood -= 20;
                k.expedition = { x: site.x, y: site.y, started: sim.tick, units: settlers.map(u => u.id), sea: true };
                const p = this.door(sea.dock);
                for (const u of settlers) {
                    EP.CivAI.release(sim, u);
                    u.job = null;
                    CivAI.goto(u, p.x + 0.5 + sim.rng.float(-0.6, 0.6), p.y + 0.5, { kind: 'board', vid: v.id });
                }
                sim.log(`Settlers of the ${k.name} set sail from ${c.name} for distant shores`, { x: c.x, y: c.y, type: 'found', kingdom: k.id });
                return;
            }
            k.food -= 15; k.wood -= 20;
            k.expedition = { x: site.x, y: site.y, started: sim.tick, units: settlers.map(u => u.id) };
            for (const u of settlers) {
                EP.CivAI.release(sim, u);
                u.task = { kind: 'settle', x: site.x, y: site.y };
                u.state = 'goto'; u.job = null;
                Units.setTarget(u, site.x + 0.5 + sim.rng.float(-1, 1), site.y + 0.5 + sim.rng.float(-1, 1));
            }
            return;
        }
    }
    cancelExpedition(k) {
        const sim = this.sim, ex = k.expedition;
        if (!ex) return;
        for (const id of ex.units) { const u = sim.unitMap.get(id); if (u && !u.boarded && u.task && (u.task.kind === 'settle' || u.task.kind === 'board')) { u.task = null; u.state = 'idle'; } }
        k.expedition = null;
    }
    settle(u) {
        const sim = this.sim;
        const k = this.kingdoms.get(u.kingdomId);
        if (!k || !k.alive || !k.expedition) { u.task = null; u.state = 'idle'; return; }
        const ex = k.expedition;
        const c = this.canFoundAt(ex.x, ex.y) ? this.foundCity(k, ex.x, ex.y, false) : null;
        if (!c) { this.cancelExpedition(k); return; }
        for (const id of ex.units) {
            const s = sim.unitMap.get(id);
            if (s && !s.dead && s.task && s.task.kind === 'settle') { this.join(s, c); }
        }
        k.expedition = null;
        sim.log(`Settlers of the ${k.name} founded ${c.name}`, { x: c.x, y: c.y, type: 'found', kingdom: k.id });
    }
    yearly() {
        const sim = this.sim;
        for (const k of this.aliveKingdoms()) {
            if (k.cities.length < 3) continue;
            const capC = this.cities.get(k.capital);
            if (!capC) continue;
            const wars = Object.keys(k.wars).length;
            for (const id of k.cities) {
                if (id === k.capital) continue;
                const c = this.cities.get(id);
                if (!c || EP.dist(c.x, c.y, capC.x, capC.y) < 24) continue;
                if (sim.rng.chance(0.01 + (k.starving ? 0.03 : 0) + wars * 0.006 + k.cities.length * 0.002)) { this.rebel(c); break; }
            }
        }
        sim.recordHistory();
    }
    towerFire(b) {
        const sim = this.sim;
        if (b.atkCd > 0) { b.atkCd -= 10; return; }
        const k = this.buildingKingdom(b);
        if (!k) return;
        const cx = b.x + 0.5, cy = b.y + 0.5;
        const tgt = sim.grid.nearest(cx, cy, BUILDINGS.tower.range, o => this.hostileToKingdom(k, o));
        if (!tgt) return;
        b.atkCd = 30;
        sim.shoot('arrow', cx, cy - 1.2, tgt.x, tgt.y, 9 * (1 + k.age * 0.15), null, tgt.id, k.id);
    }
    templeHeal(b) {
        const sim = this.sim, k = this.buildingKingdom(b);
        if (!k) return;
        sim.grid.query(b.x + 1, b.y + 1, 5, u => {
            if (u.kingdomId !== k.id) return;
            if (u.hp < u.hpMax) { u.hp = Math.min(u.hpMax, u.hp + 4); sim.fx.burst(u.x, u.y - 0.5, 1, { color: '#fff3a0', speed: 0.01, life: 25, rise: 0.02, size: 1 }); }
            if (u.sick && sim.rng.chance(0.2)) u.sick = 0;
        });
    }
    onDeath(u, killer, cause) {
        const sim = this.sim;
        EP.CivAI.release(sim, u);
        if (killer && killer.kingdomId >= 0) { const kk = this.kingdoms.get(killer.kingdomId); if (kk) kk.kills++; }
        if (u.kingdomId < 0) return;
        const k = this.kingdoms.get(u.kingdomId);
        if (!k) return;
        k.deaths++;
        if (k.kingId === u.id) {
            k.kingId = -1;
            const by = killer ? (killer.name ? ` by ${killer.name}` : ` by a ${SPECIES[killer.species].name.toLowerCase()}`) : '';
            sim.log(`${u.name}, ruler of the ${k.name}, ${cause === 'old age' ? 'died of old age' : 'was killed' + (cause === 'slain' ? by : ` (${cause})`)}`, { x: u.x, y: u.y, type: 'death', kingdom: k.id });
        }
    }
}
EP.CivSystem = CivSystem;

// ================================================================ Civilian AI
const CivAI = EP.CivAI = {
    release(sim, u) {
        if (u.task && u.task.i != null && sim.civ.reserved.get(u.task.i) === u.id) sim.civ.reserved.delete(u.task.i);
    },
    goto(u, x, y, task) { u.task = task; u.state = 'goto'; Units.setTarget(u, x, y); },

    update(sim, u) {
        const civ = sim.civ;
        if (u.kingdomId < 0) { CivAI.kingless(sim, u); return; }
        const k = civ.kingdoms.get(u.kingdomId);
        if (!k || !k.alive) { u.kingdomId = -1; u.cityId = -1; return; }
        if (k.starving && (sim.tick + u.id) % 40 === 0) { Units.damage(sim, u, 1, null, 'starvation'); if (u.dead) return; }

        if (u.state === 'work') {
            if (sim.tick - u.lastHitTick < 3) { CivAI.release(sim, u); u.state = 'idle'; }
            else { u.workT--; CivAI.workFx(sim, u); if (u.workT <= 0) CivAI.finishWork(sim, u, k); return; }
        }
        if (Units.thinking(sim, u, u.job === 'warrior' || u.state === 'fight' || u.state === 'flee' ? 6 : 12) && u.task?.kind !== 'settle' && u.task?.kind !== 'board') CivAI.threats(sim, u, k);

        switch (u.state) {
            case 'fight': CivAI.fight(sim, u); break;
            case 'siege': CivAI.siege(sim, u); break;
            case 'flee': if (Units.moveAlong(sim, u, 1.3) !== 0) u.state = 'idle'; break;
            case 'goto': {
                const r = Units.moveAlong(sim, u, u.task && (u.task.kind === 'raid') ? 1.05 : 1);
                if (r === 1) CivAI.arrive(sim, u, k);
                else if (r === -1) { CivAI.release(sim, u); u.state = 'idle'; u.task = null; }
                break;
            }
            default:
                if (Units.thinking(sim, u, 8)) CivAI.plan(sim, u, k);
                else Units.moveAlong(sim, u, 0.6);
        }
        if (u.moving && (sim.tick + u.id) % 4 === 0) CivAI.wear(sim, u);
    },

    wear(sim, u) {
        const w = sim.world, i = (u.y | 0) * w.w + (u.x | 0);
        if (w.owner[i] < 0 || w.bld[i] >= 0 || w.tree[i]) return;
        const t = w.terrain[i];
        if (t !== T.GRASS && t !== T.SAVANNA && t !== T.SAND && t !== T.SOIL && t !== T.SNOW && t !== T.DESERT) return;
        const v = w.wear[i] + 10;
        if (v >= 250) { w.wear[i] = 0; w.setTerrain(i, T.ROAD); } else w.wear[i] = v;
    },

    kingless(sim, u) {
        const civ = sim.civ;
        if (u.state === 'fight') { CivAI.fight(sim, u); return; }
        if (Units.thinking(sim, u, 15) && u.adult) {
            u.lonely += 15;
            // Fight back when attacked
            if (u.lastAttacker >= 0 && sim.tick - u.lastHitTick < 30) { const a = sim.unitMap.get(u.lastAttacker); if (a && !a.dead) { u.state = 'fight'; u.targetId = a.id; return; } }
            // Join a nearby town of our people
            let best = null, bd = 18 * 18;
            for (const c of civ.cities.values()) {
                const k = civ.kingdoms.get(c.kingdomId);
                if (!k || !k.alive || k.race !== u.species) continue;
                const d = EP.dist2(u.x, u.y, c.x, c.y);
                if (d < bd && sim.world.sameLand(u.x, u.y, c.x, c.y + 2)) { bd = d; best = c; }
            }
            if (best) { civ.join(u, best); return; }
            // Found a new realm
            if (u.lonely > 100 && civ.canFoundAt(u.x, u.y)) {
                const k = civ.createKingdom(u.species);
                const c = civ.foundCity(k, u.x | 0, u.y | 0, false);
                if (!c) { civ.discardKingdom(k); u.lonely = 40; }
                else {
                    civ.join(u, c);
                    sim.grid.query(u.x, u.y, 10, o => { if (o.kind === 'civ' && o.kingdomId < 0 && o.species === u.species) civ.join(o, c); });
                    sim.log(`${u.name} founded the ${k.name}`, { x: c.x, y: c.y, type: 'found', kingdom: k.id, unit: u.id });
                    sim.emit('sfx', { name: 'found', x: c.x, y: c.y });
                    return;
                }
            }
            if (u.tx == null) Units.wanderTarget(sim, u, u.x, u.y, u.lonely > 100 ? 12 : 5);
        }
        Units.moveAlong(sim, u, 0.7);
    },

    threats(sim, u, k) {
        const civ = sim.civ;
        const warrior = u.job === 'warrior';
        const range = warrior ? 8 : 4.5;
        const enemy = sim.grid.nearest(u.x, u.y, range, o => civ.hostileToKingdom(k, o) || (o.id === u.lastAttacker && sim.tick - u.lastHitTick < 60));
        if (!enemy) { if (u.state === 'flee' && u.tx == null) u.state = 'idle'; return false; }
        if (u.state === 'fight' && u.targetId === enemy.id) return true;
        const attacked = u.lastAttacker === enemy.id && sim.tick - u.lastHitTick < 60;
        const brave = u.adult && !u.traits.includes('coward') && (warrior || u.traits.includes('brave') || (attacked && (enemy.kind !== 'monster' || enemy.species === 'zombie')));
        if (brave) {
            CivAI.release(sim, u);
            u.state = 'fight'; u.targetId = enemy.id; u.task = null;
            if (enemy.kind === 'civ' && sim.rng.chance(0.3)) sim.fx.emote(u.x, u.y, 'swords');
        } else if (u.state !== 'flee') {
            CivAI.release(sim, u);
            const c = civ.cities.get(u.cityId);
            let a = Math.atan2(u.y - enemy.y, u.x - enemy.x);
            if (c && EP.dist(c.x, c.y, enemy.x, enemy.y) > 3) a = Math.atan2(c.y - u.y, c.x - u.x);
            Units.setTarget(u, u.x + Math.cos(a) * 6, u.y + Math.sin(a) * 6);
            u.state = 'flee'; u.task = null;
        }
        return true;
    },

    fight(sim, u) {
        const t = sim.unitMap.get(u.targetId);
        if (!t || t.dead || Math.hypot(t.x - u.x, t.y - u.y) > 16) { u.state = 'idle'; u.targetId = -1; return; }
        if (!Units.attack(sim, u, t) && Units.step(sim, u, t.x, t.y, 1.1) === -1) { u.state = 'idle'; u.targetId = -1; }
    },

    siege(sim, u) {
        const b = sim.civ.buildings.get(u.task && u.task.bid);
        if (!b) { u.state = 'idle'; u.task = null; return; }
        const k = sim.civ.buildingKingdom(b);
        if (!k || !sim.civ.atWar(u.kingdomId, k.id)) { u.state = 'idle'; u.task = null; return; }
        const cx = EP.clamp(u.x, b.x - 0.2, b.x + b.w + 0.2), cy = EP.clamp(u.y, b.y - 0.2, b.y + b.h + 0.2);
        const d = Math.hypot(cx - u.x, cy - u.y);
        if (d > 0.8) { if (Units.step(sim, u, cx, cy, 1) === -1) { u.state = 'idle'; u.task = null; } return; }
        if (u.atkCd <= 0) {
            u.atkCd = 24; u.face = cx >= u.x ? 1 : -1;
            sim.civ.damageBuilding(b.id, u.atk * 1.2, u);
            sim.fx.burst(cx, cy - 0.3, 2, { color: '#ffd27f', speed: 0.06, life: 12, size: 1 });
            if (sim.rng.chance(0.06)) sim.env.ignite(cx, cy);
        }
    },

    plan(sim, u, k) {
        const civ = sim.civ;
        const c = civ.cities.get(u.cityId);
        if (!c) { civ.rehome(u, k); return; }
        // Cut off from home (landed by ship, or the land split): find a sister town here, or strike out alone.
        if (u.adult && !sim.world.sameLand(u.x, u.y, c.x, c.y)) {
            const tc = civ.cities.get(k.warTarget);
            if (!(u.job === 'warrior' && tc && sim.world.sameLand(u.x, u.y, tc.x, tc.y))) {
                const here = k.cities.map(id => civ.cities.get(id)).find(o => o && sim.world.sameLand(u.x, u.y, o.x, o.y));
                if (here) { u.cityId = here.id; u.stranded = 0; return; }
                u.stranded = (u.stranded || 0) + 8;
                if (u.stranded > 1200) { u.kingdomId = -1; u.cityId = -1; u.job = null; u.task = null; u.state = 'idle'; u.stranded = 0; u.lonely = 60; Units.recalc(sim, u); return; }
                if (u.tx == null) Units.wanderTarget(sim, u, u.x, u.y, 5);
                return;
            }
        } else u.stranded = 0;
        if (u.carry) {
            const hall = civ.buildings.get(c.hallId);
            const p = hall && civ.approach(hall, u);
            if (p) { CivAI.goto(u, p.x, p.y, { kind: 'deliver' }); return; }
            k[u.carry.type] = (k[u.carry.type] || 0) + u.carry.amt; u.carry = null;
            return;
        }
        if (!u.adult) { if (u.tx == null) Units.wanderTarget(sim, u, c.x, c.y + 2, 4); return; }
        switch (u.job) {
            case 'builder': {
                let best = null, bd = Infinity;
                for (const id of c.buildings) {
                    const b = civ.buildings.get(id);
                    if (!b || b.done) continue;
                    const d = EP.dist2(u.x, u.y, b.x, b.y);
                    if (d < bd) { bd = d; best = b; }
                }
                if (best) { const p = civ.approach(best, u); if (p) { CivAI.goto(u, p.x, p.y, { kind: 'build', bid: best.id }); return; } }
                const ri = civ.nextRoadTile(c, u);
                if (ri >= 0) {
                    const w = sim.world;
                    civ.reserved.set(ri, u.id);
                    CivAI.goto(u, ri % w.w + 0.5, ((ri / w.w) | 0) + 0.5, { kind: 'road', i: ri });
                    return;
                }
                break;
            }
            case 'smith': {
                const s = civ.builtIn(c, 'smithy')[0];
                if (s) { const p = civ.approach(s, u); if (p) { CivAI.goto(u, p.x, p.y, { kind: 'forge', bid: s.id }); return; } }
                break;
            }
            case 'farmer': {
                const farms = c.buildings.map(id => civ.buildings.get(id)).filter(b => b && b.type === 'farm' && b.done);
                if (farms.length) {
                    const f = sim.rng.pick(farms);
                    const x = f.x + sim.rng.int(0, f.w - 1), y = f.y + sim.rng.int(0, f.h - 1);
                    CivAI.goto(u, x + 0.5, y + 0.5, { kind: 'farm', bid: f.id, i: -1 });
                    return;
                }
                const prey = sim.grid.nearest(c.x, c.y, 12, o => o.kind === 'animal' && SPECIES[o.species].diet === 'herb' && !SPECIES[o.species].fly && !(o.frozen > 0));
                if (prey) { u.state = 'fight'; u.targetId = prey.id; u.task = { kind: 'hunt' }; return; }
                const spot = civ.findFishingSpot(c, u);
                if (spot) { CivAI.goto(u, spot.x, spot.y, { kind: 'fish' }); return; }
                break;
            }
            case 'woodcutter': {
                const i = civ.findTree(c, u);
                if (i >= 0) {
                    const w = sim.world, x = i % w.w, y = (i / w.w) | 0;
                    let tx = x + 0.5, ty = y + 0.5;
                    if (!w.walkable(x, y)) for (let d = 0; d < 4; d++) if (w.walkable(x + EP.DX8[d], y + EP.DY8[d])) { tx = x + 0.5 + EP.DX8[d] * 0.8; ty = y + 0.5 + EP.DY8[d] * 0.8; break; }
                    civ.reserved.set(i, u.id);
                    CivAI.goto(u, tx, ty + 0.3, { kind: 'chop', i });
                    return;
                }
                break;
            }
            case 'miner': {
                const needStone = k.stone < 40 + k.cities.length * 8 && sim.rng.chance(0.5);
                const ore = needStone ? null : civ.findOre(c, u, k);
                if (ore) { civ.reserved.set(ore.i, u.id); CivAI.goto(u, ore.x, ore.y, { kind: 'ore', i: ore.i }); return; }
                const mine = c.buildings.map(id => civ.buildings.get(id)).find(b => b && b.type === 'mine' && b.done);
                if (mine) { const p = civ.approach(mine, u); if (p) { CivAI.goto(u, p.x, p.y, { kind: 'mine', bid: mine.id }); return; } }
                const r = civ.findRock(c, u);
                if (r) { CivAI.goto(u, r.x, r.y, { kind: 'mine' }); return; }
                break;
            }
            case 'warrior': {
                const tc = civ.cities.get(k.warTarget);
                if (tc && c.threat === 0 && civ.atWar(k.id, tc.kingdomId) && sim.world.sameLand(u.x, u.y, tc.x, tc.y + 2)) {
                    const d = EP.dist(u.x, u.y, tc.x, tc.y);
                    if (d > Math.max(4, tc.radius * 0.6)) {
                        CivAI.goto(u, tc.x + sim.rng.float(-3, 3), tc.y + sim.rng.float(-3, 3), { kind: 'raid', city: tc.id });
                    } else {
                        let best = null, bd = Infinity;
                        for (const id of tc.buildings) {
                            const b = civ.buildings.get(id);
                            if (!b || b.type === 'farm') continue;
                            const dd = EP.dist2(u.x, u.y, b.x + b.w / 2, b.y + b.h / 2) + (b.type === 'hall' ? 30 : 0);
                            if (dd < bd) { bd = dd; best = b; }
                        }
                        if (best) { u.state = 'siege'; u.task = { kind: 'siege', bid: best.id }; }
                    }
                    return;
                }
                if (u.tx == null && sim.rng.chance(0.4)) {
                    const a = sim.rng.next() * Math.PI * 2, r = c.radius * (0.4 + sim.rng.next() * 0.5);
                    const x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r;
                    if (sim.world.walkable(x, y) && sim.world.sameLand(u.x, u.y, x, y)) CivAI.goto(u, x, y, { kind: 'patrol' });
                }
                return;
            }
        }
        if (u.tx == null && sim.rng.chance(0.5)) Units.wanderTarget(sim, u, c.x, c.y + 1, Math.max(3, c.radius * 0.5));
    },

    arrive(sim, u, k) {
        const t = u.task;
        u.state = 'idle';
        if (!t) return;
        switch (t.kind) {
            case 'deliver':
                if (u.carry) {
                    k[u.carry.type] = (k[u.carry.type] || 0) + u.carry.amt;
                    if (u.carry.type === 'gold') sim.fx.burst(u.x, u.y - 0.5, 3, { color: '#ffd34d', speed: 0.03, life: 20, rise: 0.02, size: 1 });
                    u.carry = null;
                }
                u.task = null; break;
            case 'build': u.state = 'work'; u.workT = 30; break;
            case 'farm': u.state = 'work'; u.workT = 50; break;
            case 'fish': u.state = 'work'; u.workT = 90; break;
            case 'chop': u.state = 'work'; u.workT = u.species === 'dwarf' ? 45 : 55; break;
            case 'mine': u.state = 'work'; u.workT = u.species === 'dwarf' ? 55 : 80; break;
            case 'ore': u.state = 'work'; u.workT = u.species === 'dwarf' ? 65 : 95; break;
            case 'road': u.state = 'work'; u.workT = 24; break;
            case 'forge': u.state = 'work'; u.workT = u.species === 'dwarf' ? 80 : 110; break;
            case 'board': {
                const v = sim.vehicles.map.get(t.vid);
                if (v && v.state === 'wait' && EP.dist(u.x, u.y, v.x, v.y) < 4) sim.vehicles.board(v, u);
                else { u.task = null; }
                break;
            }
            case 'settle': sim.civ.settle(u); break;
            default: u.task = null;
        }
    },

    workFx(sim, u) {
        if ((sim.tick + u.id) % 12 !== 0) return;
        u.face = -u.face;
        const t = u.task && u.task.kind;
        const col = t === 'chop' ? '#a8763e' : t === 'mine' ? '#9a958e' : t === 'build' || t === 'road' ? '#e8d6a8' : t === 'farm' ? '#8fbf4a' : t === 'fish' ? '#9fd3ff'
            : t === 'forge' ? '#ffb43a' : t === 'ore' ? (EP.ORE_INFO[sim.world.ore[u.task.i]] || {}).color || '#9a958e' : '#ccc';
        sim.fx.burst(u.x + u.face * 0.3, u.y - 0.2, 1, { color: col, speed: 0.03, life: 14, grav: 0.004, size: 1 });
    },

    finishWork(sim, u, k) {
        const civ = sim.civ, w = sim.world, t = u.task;
        u.state = 'idle';
        if (!t) return;
        const ageBonus = k.age;
        switch (t.kind) {
            case 'build': {
                const b = civ.buildings.get(t.bid);
                if (!b || b.done) { u.task = null; break; }
                b.progress += (30 / BUILDINGS[b.type].time) * (u.species === 'dwarf' ? 1.3 : 1);
                b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.12);
                if (b.progress >= 1) { civ.completeBuilding(b); u.task = null; }
                else { u.state = 'work'; u.workT = 30; }
                break;
            }
            case 'farm': {
                const b = civ.buildings.get(t.bid);
                const i = w.idx(u.x | 0, u.y | 0);
                if (b && w.bld[i] === b.id && w.terrain[i] !== T.FARM) w.setTerrain(i, T.FARM);
                else if (b) {
                    const c = civ.cities.get(u.cityId), built = (c && c.built) || {};
                    const amt = (10 + ageBonus * 2 + (built.granary ? 2 : 0)) * (1 + Math.min(2, built.windmill || 0) * 0.25);
                    u.carry = { type: 'food', amt: Math.round(amt) };
                }
                u.task = null; break;
            }
            case 'ore': {
                const o = w.ore[t.i], info = EP.ORE_INFO[o];
                if (info && w.oreAmt[t.i] > 0) {
                    const c = civ.cities.get(u.cityId);
                    const mine = c && civ.builtIn(c, 'mine').some(m => EP.dist(m.x + 1, m.y + 1, u.x, u.y) < 9);
                    u.carry = { type: info.res, amt: info.yield + (mine ? 1 : 0) + (u.species === 'dwarf' ? 1 : 0) };
                    if (--w.oreAmt[t.i] <= 0) w.setOre(t.i, 0, 0);
                    sim.emit('sfx', { name: 'chop', x: u.x, y: u.y, quiet: true });
                }
                CivAI.release(sim, u); u.task = null; break;
            }
            case 'road': {
                civ.layRoad(k, t.i);
                CivAI.release(sim, u); u.task = null; break;
            }
            case 'forge': {
                const b = civ.buildings.get(t.bid);
                if (b && b.done && civ.forge(u, k)) { sim.emit('sfx', { name: 'build', x: u.x, y: u.y, quiet: true }); u.state = 'work'; u.workT = u.species === 'dwarf' ? 80 : 110; }
                else u.task = null;
                break;
            }
            case 'fish': u.carry = { type: 'food', amt: 7 + ageBonus }; u.task = null; break;
            case 'chop': {
                if (w.tree[t.i] && !w.fire[t.i]) {
                    u.carry = { type: 'wood', amt: EP.TREE_INFO[w.tree[t.i]].wood + (ageBonus >> 1) };
                    w.setTree(t.i, 0);
                    sim.emit('sfx', { name: 'chop', x: u.x, y: u.y, quiet: true });
                }
                CivAI.release(sim, u); u.task = null; break;
            }
            case 'mine': {
                const bonus = t.bid ? 2 : 0;
                if (sim.rng.chance(0.05 + (u.species === 'dwarf' ? 0.05 : 0))) u.carry = { type: 'gold', amt: 1 + (bonus >> 1) };

                else u.carry = { type: 'stone', amt: 3 + bonus + (u.species === 'dwarf' ? 2 : 0) };
                u.task = null; break;
            }
            default: u.task = null;
        }
    },
};
})();
