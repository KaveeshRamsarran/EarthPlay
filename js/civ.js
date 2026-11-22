/* EarthPlay — civilisations: kingdoms, cities, territory, economy, buildings, research, diplomacy, war. */
(function () {
'use strict';
const EP = globalThis.EP;
const { T, TERRAIN, SPECIES, BUILDINGS, AGES } = EP;
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
        for (const o of this.kingdoms.values()) { delete o.relations[k.id]; delete o.wars[k.id]; }
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
        sim.log(`The ${newK.name} conquered ${city.name}${oldK ? ' from the ' + oldK.name : ''}`, { x: city.x, y: city.y, type: 'war', kingdom: newK.id });
        sim.emit('sfx', { name: 'conquest', x: city.x, y: city.y });
        if (oldK && oldK.alive && !oldK.cities.length) this.fallKingdom(oldK, newK);
    }
    fallKingdom(k, by) {
        const sim = this.sim;
        k.alive = false; k.fell = sim.year;
        for (const o of this.kingdoms.values()) { delete o.wars[k.id]; if (o.warTarget >= 0 && !this.cities.has(o.warTarget)) o.warTarget = -1; }
        k.wars = {};
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
        for (const res of ['food', 'wood', 'stone', 'gold']) { const s = Math.floor(oldK[res] * 0.25); oldK[res] -= s; nk[res] = s + 20; }
        for (const u of sim.units) if (!u.dead && u.cityId === city.id) { u.kingdomId = nk.id; u.job = null; u.state = 'idle'; u.task = null; Units.recalc(sim, u); }
        sim.world.ownerVersion++;
        this.declareWar(nk, oldK, true);
        sim.log(`${city.name} ${forced ? 'is incited to revolt' : 'rebels'} against the ${oldK.name}, forming the ${nk.name}`, { x: city.x, y: city.y, type: 'war', kingdom: nk.id });
        return nk;
    }

    // ------------------------------------------------------------ diplomacy
    declareWar(a, b, silent = false) {
        if (!a.alive || !b.alive || a === b || a.wars[b.id] != null) return;
        const y = this.sim.year;
        a.wars[b.id] = y; b.wars[a.id] = y;
        a.relations[b.id] = Math.min(a.relations[b.id] || 0, -60); b.relations[a.id] = a.relations[b.id];
        if (!silent) {
            const c = this.cities.get(b.capital);
            this.sim.log(`The ${a.name} declared war on the ${b.name}`, { x: c && c.x, y: c && c.y, type: 'war', kingdom: a.id });
        }
        this.sim.emit('sfx', { name: 'war' });
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
            const war = a.wars[b.id] != null;
            if (war) r += 2;
            r = EP.clamp(r, -100, 100);
            a.relations[b.id] = b.relations[a.id] = r;
            if (!war && near && r < -40 && a.warriors + b.warriors > 2 && rng.chance(0.1 + aggr * 0.3)) {
                rng.chance(0.5) ? this.declareWar(a, b) : this.declareWar(b, a);
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
        for (let yy = y - 1; yy <= y + d.h; yy++) for (let xx = x - 1; xx <= x + d.w; xx++) {
            const i = w.idx(xx, yy);
            const inside = xx >= x && yy >= y && xx < x + d.w && yy < y + d.h;
            if (inside) {
                if (w.owner[i] !== city.id || w.bld[i] >= 0 || w.fire[i]) return false;
                const t = w.terrain[i];
                if (d.field) { if (t !== T.GRASS && t !== T.SAVANNA && t !== T.SOIL && t !== T.ASH && t !== T.SWAMP) return false; }
                else if (!TERRAIN[t].build && !(type === 'mine' && t === T.HILLS)) return false;
            } else {
                const ob = w.bld[i];
                if (ob >= 0 && !(d.field && this.buildings.get(ob)?.type === 'farm')) return false;
                if (type === 'hall' && w.terrain[i] === T.DEEP) return false;
            }
        }
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
        for (let a = 0; a < 60; a++) {
            let r;
            if (type === 'hall') r = rng.next() * 2.2;
            else if (type === 'tower') r = R * (0.55 + rng.next() * 0.4);
            else if (type === 'farm') r = 3 + rng.next() * (R - 1);
            else r = 2.5 + rng.next() * (R - 1.5);
            const ang = rng.next() * Math.PI * 2;
            const x = Math.round(city.x + Math.cos(ang) * r - d.w / 2), y = Math.round(city.y + Math.sin(ang) * r - d.h / 2);
            if (!this.fits(city, type, x, y)) continue;
            let score = -r;
            if (type === 'tower') score = r;
            else if (type === 'farm') score = -Math.abs(r - 5.5);
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
        let housing = 0, sites = 0; const count = {};
        for (const id of c.buildings) {
            const b = this.buildings.get(id); if (!b) continue;
            count[b.type] = (count[b.type] || 0) + 1;
            if (b.done) housing += BUILDINGS[b.type].housing || 0; else { sites++; housing += (BUILDINGS[b.type].housing || 0) * 0.5; }
        }
        c.housing = housing | 0; c.count = count; c.sites = sites;
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
        if (hall.done) this.plan(c, k, count, sites);
    }
    assignJobs(c, k) {
        const adults = c.members.filter(u => u.adult && !u.dead && !(u.task && u.task.kind === 'settle'));
        const n = adults.length;
        if (!n) return;
        const wars = Object.keys(k.wars).length;
        let wantW = n < 4 ? 0 : Math.round(n * (wars ? 0.34 : 0.1) + ((c.count.barracks || 0) ? n * 0.08 : 0));
        if (c.threat > 0) wantW = Math.max(wantW, Math.round(n * 0.4));
        const wantB = c.sites > 0 ? Math.min(c.sites + 1, Math.max(1, Math.ceil(n * 0.25)), 4) : 0;
        const hills = c.hills != null ? c.hills : (c.hills = this.hillsNear(c));
        const starving = k.food < k.pop * 1.5, hungry = k.food < k.pop * 3;
        const wantM = starving ? 0 : (c.count.mine ? Math.max(1, Math.round(n * (k.race === 'dwarf' ? 0.2 : 0.12))) : (hills && k.stone < 60 ? 1 : 0));
        let rest = Math.max(0, n - wantW - wantB - wantM);
        const wantF = Math.round(rest * (starving ? 0.8 : hungry ? 0.62 : 0.45));
        const target = { warrior: wantW, builder: wantB, miner: wantM, farmer: wantF, woodcutter: Math.max(0, rest - wantF) };
        const have = { warrior: 0, builder: 0, miner: 0, farmer: 0, woodcutter: 0 };
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
        const wish = [];
        if (c.housing < c.pop + 3) wish.push('house');
        if (has('farm') * 5 < c.pop && has('farm') < 8) wish.push('farm');
        if (!has('mine') && c.pop >= 6 && hills) wish.push('mine');
        if (k.age >= 1 && !has('temple') && c.pop >= 10) wish.push('temple');
        if (k.age >= 1 && has('tower') < Math.min(4, 1 + Math.floor(c.pop / 14)) && (wars || c.pop >= 10)) wish.push('tower');
        if (k.age >= 2 && !has('barracks') && c.pop >= 18) wish.push('barracks');
        if (c.housing < c.pop + 8 && has('house') < 22) wish.push('house');
        for (const type of wish) {
            const d = BUILDINGS[type];
            let ok = true;
            for (const r in d.cost) if ((k[r] || 0) < d.cost[r]) ok = false;
            if (!ok) continue;
            const site = this.findSite(c, type);
            if (!site) { if (type === 'mine') c.hills = false; continue; }
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
        // Masons quarry a little stone in every town; surplus goods are traded for food.
        k.stone += k.cities.length * 0.5;
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
        if (k.food > 200 + k.pop * 15) k.food *= 0.97; // spoilage
        k.peakPop = Math.max(k.peakPop, k.pop);
        // Research
        let temples = 0, wise = 0;
        for (const id of k.cities) { const c = this.cities.get(id); if (c && c.count) temples += c.count.temple || 0; }
        for (const id of k.cities) { const c = this.cities.get(id); if (c) for (const u of c.members) if (u.traits.includes('wise')) wise++; }
        k.tech += (k.pop * 0.35 + temples * 3 + wise * 0.5) * TECH_MUL[k.race];
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
        } else if (!enemies.length) k.warTarget = -1;
        // Expansion
        this.expand(k);
    }
    expand(k) {
        const sim = this.sim;
        const ex = k.expedition;
        if (ex) {
            const alive = ex.units.map(id => sim.unitMap.get(id)).filter(u => u && !u.dead && u.task && u.task.kind === 'settle');
            if (!alive.length || sim.tick - ex.started > 2400) this.cancelExpedition(k);
            return;
        }
        if (k.cities.length >= 10 || k.food < 30 || k.wood < 25 || k.starving) return;
        for (const id of k.cities) {
            const c = this.cities.get(id);
            if (!c || c.pop < 14 || c.pop < c.housing - 2) continue;
            const site = this.findCitySite(c, k);
            if (!site) continue;
            const settlers = c.members.filter(u => !u.dead && u.adult && u.job !== 'warrior' && u.state !== 'fight').slice(0, 4);
            if (settlers.length < 3) continue;
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
        for (const id of ex.units) { const u = sim.unitMap.get(id); if (u && u.task && u.task.kind === 'settle') { u.task = null; u.state = 'idle'; } }
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
        sim.shoot('arrow', cx, cy - 1.2, tgt.x, tgt.y, 9 * AGES[k.age].atk, null, tgt.id, k.id);
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
        if (Units.thinking(sim, u, u.job === 'warrior' || u.state === 'fight' || u.state === 'flee' ? 6 : 12) && u.task?.kind !== 'settle') CivAI.threats(sim, u, k);

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
            case 'settle': sim.civ.settle(u); break;
            default: u.task = null;
        }
    },

    workFx(sim, u) {
        if ((sim.tick + u.id) % 12 !== 0) return;
        u.face = -u.face;
        const t = u.task && u.task.kind;
        const col = t === 'chop' ? '#a8763e' : t === 'mine' ? '#9a958e' : t === 'build' ? '#e8d6a8' : t === 'farm' ? '#8fbf4a' : t === 'fish' ? '#9fd3ff' : '#ccc';
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
                else if (b) u.carry = { type: 'food', amt: 10 + ageBonus * 2 };
                u.task = null; break;
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
                if (sim.rng.chance(0.18 + (u.species === 'dwarf' ? 0.12 : 0))) u.carry = { type: 'gold', amt: 1 + (bonus >> 1) };
                else u.carry = { type: 'stone', amt: 3 + bonus + (u.species === 'dwarf' ? 2 : 0) };
                u.task = null; break;
            }
            default: u.task = null;
        }
    },
};
})();
