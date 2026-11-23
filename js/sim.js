/* EarthPlay — the simulation root. DOM-free: can run headless (tests/sim.test.js). */
(function () {
'use strict';
const EP = globalThis.EP;
const { T, SPECIES } = EP;
const Units = EP.Units;

const MAX_UNITS = 4000;

class Sim extends EP.Emitter {
    constructor(opts = {}) {
        super();
        const size = EP.WORLD_SIZES[opts.size] || EP.WORLD_SIZES.medium;
        this.opts = Object.assign({ size: 'medium', shape: 'continent', sea: 'normal', life: 'civ', disasters: 'rare' }, opts);
        this.seed = (opts.seed >>> 0) || ((Math.random() * 1e9) >>> 0);
        this.opts.seed = this.seed;
        const w = opts.w || size.w, h = opts.h || size.h;
        this.world = new EP.World(w, h);
        this.rng = new EP.RNG(this.seed ^ 0x5bd1e995);
        this.tick = 0;
        this.units = []; this.unitMap = new Map(); this.nextUnitId = 1;
        this.grid = new EP.SpatialHash(w, h, 8);
        this.speciesCount = {};
        this.deadCount = 0;
        this.fx = new EP.Effects();
        this.env = new EP.Environment(this);
        this.civ = new EP.CivSystem(this);
        this.vehicles = new EP.VehicleSystem(this);
        this.powers = new EP.Powers(this);
        this.projectiles = [];
        this.pending = [];
        this.logEntries = [];
        this.history = [];
        if (!opts.blank) {
            EP.generateWorld(this.world, this.opts);
            this.populate(this.opts.life);
            this.recordHistory();
        }
    }
    get year() { return Math.floor(this.tick / EP.TICKS_PER_YEAR); }

    spawnUnit(species, x, y, opts = {}) {
        if (!SPECIES[species] || this.units.length >= MAX_UNITS) return null;
        // Wildlife & monsters may only use part of the budget so realms can always grow.
        if (SPECIES[species].kind !== 'civ' && this.units.length - (this.civCount || 0) >= MAX_UNITS * 0.5) return null;
        const w = this.world;
        x = EP.clamp(x, 0.05, w.w - 0.05); y = EP.clamp(y, 0.05, w.h - 0.05);
        const u = new EP.Unit(this, this.nextUnitId++, species, x, y, opts);
        this.units.push(u);
        this.unitMap.set(u.id, u);
        this.speciesCount[species] = (this.speciesCount[species] || 0) + 1;
        if (u.kind === 'civ') this.civCount = (this.civCount || 0) + 1;
        return u;
    }

    update() {
        this.tick++;
        const w = this.world;
        if (w.landDirty && this.tick % 30 === 0) w.computeLandmasses();
        if (this.tick % 2 === 0 || this.gridStale) {
            this.grid.clear();
            for (let i = 0; i < this.units.length; i++) { const u = this.units[i]; if (!u.dead && !(u.boarded > 0)) this.grid.insert(u); }
            this.gridStale = false;
        }
        this.env.update();
        const n = this.units.length;
        for (let i = 0; i < n; i++) { const u = this.units[i]; if (!u.dead) Units.update(this, u); }
        this.civ.update();
        this.vehicles.update();
        this.powers.update();
        this.updateProjectiles();
        this.fx.update();
        if (this.tick % 600 === 0) { this.migrate(); this.naturalEvents(); }
        if (this.pending.length) { const p = this.pending; this.pending = []; for (const f of p) f(); }
        if (this.deadCount) { this.units = this.units.filter(u => !u.dead); this.deadCount = 0; }
    }

    onUnitDeath(u, killer, cause) {
        this.deadCount++;
        this.unitMap.delete(u.id);
        this.speciesCount[u.species] = Math.max(0, (this.speciesCount[u.species] || 1) - 1);
        if (u.kind === 'civ') this.civCount = Math.max(0, (this.civCount || 1) - 1);
        this.civ.onDeath(u, killer, cause);
        if (u.species === 'dragon') this.log(`A dragon was slain${killer && killer.name ? ' by ' + killer.name : ''}`, { x: u.x, y: u.y, type: 'death' });
        else if (u.level >= 6 && u.name) this.log(`The hero ${u.name} has died (${cause})`, { x: u.x, y: u.y, type: 'death', kingdom: u.kingdomId });
        this.emit('death', u);
    }

    shoot(kind, x, y, tx, ty, dmg, src, targetId, kid) {
        const d = Math.hypot(tx - x, ty - y);
        this.projectiles.push({
            kind, x, y, sx: x, sy: y, tx, ty, t: 0, dur: Math.max(kind === 'laser' ? 3 : 6, Math.round(d / (kind === 'arrow' ? 0.45 : kind === 'laser' ? 1.1 : 0.28))),
            dmg, srcId: src ? src.id : -1, targetId, kid: kid != null ? kid : (src ? src.kingdomId : -1),
        });
        if (kind === 'fireball') this.emit('sfx', { name: 'fireball', x, y });
        else if (kind === 'laser') this.emit('sfx', { name: 'zap', x, y, quiet: true });
    }
    updateProjectiles() {
        const P = this.projectiles;
        for (let i = P.length - 1; i >= 0; i--) {
            const p = P[i];
            p.t++;
            const f = p.t / p.dur;
            p.x = EP.lerp(p.sx, p.tx, f); p.y = EP.lerp(p.sy, p.ty, f);
            if (p.kind === 'fireball' && p.t % 2 === 0) this.fx.burst(p.x, p.y, 1, { colors: ['#ffd34d', '#ff7b1f'], speed: 0.01, life: 14, glow: true, size: 1.5 });
            if (p.t < p.dur) continue;
            P.splice(i, 1);
            const src = this.unitMap.get(p.srcId) || null;
            if (p.kind === 'arrow') {
                const tgt = this.unitMap.get(p.targetId);
                if (tgt && !tgt.dead && Math.hypot(tgt.x - p.tx, tgt.y - p.ty) < 1.4) Units.damage(this, tgt, p.dmg, src);
            } else if (p.kind === 'laser') {
                const tgt = this.unitMap.get(p.targetId);
                if (tgt && !tgt.dead && Math.hypot(tgt.x - p.tx, tgt.y - p.ty) < 1.6) Units.damage(this, tgt, p.dmg, src, 'vaporised');
                const w = this.world;
                if (p.targetId < 0 && w.inb(p.tx | 0, p.ty | 0)) { const b = w.bld[w.idx(p.tx | 0, p.ty | 0)]; if (b >= 0) this.civ.damageBuilding(b, p.dmg, src); }
                this.fx.burst(p.tx, p.ty, 6, { colors: ['#9fffb0', '#ffffff', '#7dd3fc'], speed: 0.05, life: 16, glow: true });
            } else {
                for (const u of this.grid.collect(p.tx, p.ty, 1.6, u => u.kind !== 'monster')) Units.damage(this, u, p.dmg, src, 'dragonfire');
                this.vehicles.damageAt(p.tx, p.ty, 1.6, p.dmg);

                for (let k = 0; k < 3; k++) this.env.ignite(p.tx + this.rng.int(-1, 1), p.ty + this.rng.int(-1, 1));
                const w = this.world;
                if (w.inb(p.tx | 0, p.ty | 0)) { const b = w.bld[w.idx(p.tx | 0, p.ty | 0)]; if (b >= 0) this.civ.damageBuilding(b, p.dmg * 2, src); }
                this.fx.burst(p.tx, p.ty, 12, { colors: ['#fff3a0', '#ffd34d', '#ff7b1f', '#d63a1a'], speed: 0.06, life: 26, rise: 0.02, glow: true, size: 1.5 });
            }
        }
    }

    log(text, meta = {}) {
        const e = Object.assign({ text, year: this.year, tick: this.tick }, meta);
        this.logEntries.push(e);
        if (this.logEntries.length > 400) this.logEntries.shift();
        this.emit('log', e);
    }

    // Wild species that die out slowly wander back in from the wilderness.
    migrate() {
        if (this.opts.life === 'empty' && !this.migrated) return;
        const w = this.world, rng = this.rng, area = w.w * w.h;
        let tiles = null;
        for (const s of EP.WILD) {
            const sp = SPECIES[s];
            const min = Math.max(2, Math.round(sp.cap * area * 0.08));
            if ((this.speciesCount[s] || 0) >= min) continue;
            if (!tiles) tiles = this.tilesByTerrain();
            const pool = sp.habitat.reduce((n, t) => n + tiles[t].length, 0);
            for (let a = 0; a < 12 && pool; a++) {
                const i = this.pickHabitatTile(tiles, sp.habitat, pool), x = i % w.w, y = (i / w.w) | 0;
                if (w.owner[i] >= 0) continue;
                const n = sp.herd ? rng.int(2, 4) : 1;
                for (let g = 0; g < n; g++) this.spawnUnit(s, x + 0.5 + rng.float(-1, 1), y + 0.5 + rng.float(-1, 1), {});
                break;
            }
        }
    }

    // Random disasters and visitors, if the world allows them.
    naturalEvents() {
        const lvl = EP.DISASTER_LEVELS[this.opts.disasters] || EP.DISASTER_LEVELS.off;
        if (!lvl.p || !this.rng.chance(lvl.p)) return;
        const w = this.world, rng = this.rng;
        let x = -1, y = -1;
        for (let a = 0; a < 60; a++) {
            const tx = rng.int(4, w.w - 5), ty = rng.int(4, w.h - 5);
            if (w.isLandI(w.idx(tx, ty)) && w.terrain[w.idx(tx, ty)] !== T.MOUNTAIN) { x = tx + 0.5; y = ty + 0.5; break; }
        }
        if (x < 0) return;
        const c = this.civ.cityAt(x, y);
        const where = c ? ` near ${c.name}` : '';
        const ev = rng.pick(['meteor', 'meteor', 'tornado', 'tornado', 'quake', 'volcano', 'ufo', 'blizzard', 'dragon']);
        const meta = { x, y, type: 'disaster' };
        switch (ev) {
            case 'meteor': this.powers.apply('meteor', x, y, 1); this.log(`A meteor fell from the sky${where}`, meta); break;
            case 'tornado': this.powers.apply('tornado', x, y, 1); this.log(`A tornado touched down${where}`, meta); break;
            case 'quake': this.powers.apply('quake', x, y, 1); this.log(`An earthquake shook the land${where}`, meta); break;
            case 'volcano': this.powers.apply('volcano', x, y, 1); this.log(`A volcano erupted${where}`, meta); break;
            case 'blizzard':
                for (let k = 0; k < 6; k++) this.powers.apply('blizzard', x + rng.float(-4, 4), y + rng.float(-4, 4), 4);
                for (let k = 0; k < 2; k++) this.spawnUnit('icegolem', x + rng.float(-2, 2), y + rng.float(-2, 2), {});
                this.log(`A great blizzard swept in${where}, bringing ice golems`, meta);
                break;
            case 'ufo': {
                const u = this.spawnUnit('ufo', x, y, {});
                if (u) this.log(`A strange craft appeared in the sky${where}`, Object.assign({ unit: u.id }, meta));
                break;
            }
            case 'dragon': {
                if ((this.speciesCount.dragon || 0) > 0) break;
                const u = this.spawnUnit('dragon', x, y, {});
                if (u) this.log(`A dragon descended from the mountains${where}`, Object.assign({ unit: u.id }, meta));
                break;
            }
        }
    }
    tilesByTerrain() {
        const w = this.world, out = EP.TERRAIN.map(() => []);
        for (let i = 0; i < w.w * w.h; i++) out[w.terrain[i]].push(i);
        return out;
    }
    pickHabitatTile(tiles, habitat, pool) {
        let r = this.rng.int(0, pool - 1);
        for (const t of habitat) { if (r < tiles[t].length) return tiles[t][r]; r -= tiles[t].length; }
        return tiles[habitat[0]][0];
    }
    census() {
        const pop = {};
        for (const u of this.units) if (!u.dead) pop[u.species] = (pop[u.species] || 0) + 1;
        return pop;
    }
    recordHistory() {
        const pop = this.census();
        const entry = { year: this.year, kingdoms: this.civ.aliveKingdoms().length };
        for (const r of EP.CIV_RACES) entry[r] = pop[r] || 0;
        entry.animals = EP.ANIMALS.reduce((s, k) => s + (SPECIES[k].kind === 'animal' ? pop[k] || 0 : 0), 0);
        entry.monsters = EP.MONSTERS.reduce((s, k) => s + (pop[k] || 0), 0);
        this.history.push(entry);
        if (this.history.length > 400) this.history.shift();
    }

    // ------------------------------------------------------------ initial life
    populate(life) {
        if (life === 'empty') return;
        const w = this.world, rng = this.rng;
        const area = w.w * w.h;
        const tiles = this.tilesByTerrain();
        for (const s of EP.WILD) {
            const sp = SPECIES[s];
            const pool = sp.habitat.reduce((n, t) => n + tiles[t].length, 0);
            // Rare biomes still get a few residents; vast ones are capped by the species' density.
            const target = Math.min(Math.round(sp.cap * area * 0.45), Math.max(2, Math.round(pool * sp.cap * 6)));
            let spawned = 0, tries = 0;
            while (pool && spawned < target && tries++ < target * 20) {
                const i = this.pickHabitatTile(tiles, sp.habitat, pool), x = i % w.w, y = (i / w.w) | 0;
                const group = sp.herd ? rng.int(2, 5) : 1;
                for (let g = 0; g < group && spawned < target; g++) {
                    const px = x + 0.5 + rng.float(-1.5, 1.5), py = y + 0.5 + rng.float(-1.5, 1.5);
                    if (Units.passable(this, { species: s, kind: sp.kind }, px, py) && this.spawnUnit(s, px, py, {})) spawned++;
                }
            }
        }
        if (life !== 'civ') return;
        const perRace = area > 90000 ? 3 : area > 50000 ? 2 : area > 30000 ? 2 : 1;
        const pref = {
            human: t => (t === T.GRASS ? 2 : t === T.SAVANNA ? 1 : 0),
            elf: (t, x, y) => (t === T.GRASS ? 1 : 0) + this.treesAround(x, y) * 0.15,
            dwarf: (t, x, y) => (TERRAIN_BUILD(t) ? 0.5 : 0) + this.hillsAround(x, y) * 0.25,
            orc: t => (t === T.SAVANNA || t === T.DESERT ? 2 : t === T.GRASS ? 1 : 0),
        };
        const placed = [];
        for (let round = 0; round < perRace; round++) {
            for (const race of EP.CIV_RACES) {
                let best = null, bs = -Infinity;
                for (let a = 0; a < 250; a++) {
                    const x = rng.int(4, w.w - 5), y = rng.int(4, w.h - 5);
                    const t = w.t(x, y);
                    if (!EP.TERRAIN[t].build) continue;
                    let s = pref[race](t, x, y) + rng.next();
                    const minD = placed.reduce((m, p) => Math.min(m, Math.hypot(p.x - x, p.y - y)), Infinity);
                    if (minD < 26) continue;
                    s += Math.min(minD, 60) * 0.02;
                    if (s > bs && this.civ.canFoundAt(x, y)) { bs = s; best = { x, y }; }
                }
                if (best && this.civ.seedKingdom(race, best.x, best.y, 6)) placed.push(best);
            }
        }
    }
    treesAround(x, y) {
        const w = this.world; let n = 0;
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (w.inb(x + dx, y + dy) && w.tree[w.idx(x + dx, y + dy)]) n++;
        return n;
    }
    hillsAround(x, y) {
        const w = this.world; let n = 0;
        for (let dy = -6; dy <= 6; dy += 2) for (let dx = -6; dx <= 6; dx += 2) { const t = w.t(x + dx, y + dy); if (t === T.HILLS || t === T.MOUNTAIN) n++; }
        return n;
    }
}
const TERRAIN_BUILD = t => EP.TERRAIN[t].build;
EP.Sim = Sim;
})();
