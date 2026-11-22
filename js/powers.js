/* EarthPlay — visual effects (cosmetic, non-deterministic) and god powers / disasters. */
(function () {
'use strict';
const EP = globalThis.EP;
const { T, TERRAIN, SPECIES } = EP;
const Units = EP.Units;
const R = Math.random;

// ================================================================ Effects
class Effects {
    constructor() {
        this.particles = []; this.bolts = []; this.rings = []; this.texts = []; this.emotes = [];
        this.shakeAmt = 0; this.flashAmt = 0; this.flashColor = '#ffffff';
    }
    burst(x, y, n, o = {}) {
        if (this.particles.length > 6000) return;
        const speed = o.speed != null ? o.speed : 0.05;
        for (let i = 0; i < n; i++) {
            const a = R() * Math.PI * 2, s = speed * (0.3 + R() * 0.9);
            const life = (o.life || 30) * (0.6 + R() * 0.7);
            this.particles.push({
                x: x + (o.spread ? (R() - 0.5) * o.spread : 0), y: y + (o.spread ? (R() - 0.5) * o.spread : 0),
                z: o.z || 0, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6,
                vz: (o.rise || 0) + (o.grav ? R() * 0.07 : 0) + (o.up ? R() * o.up : 0),
                g: o.grav || 0, life, max: life,
                color: o.colors ? o.colors[(R() * o.colors.length) | 0] : (o.color || '#fff'),
                size: (o.size || 1) * (0.7 + R() * 0.6), glow: !!o.glow, fade: o.fade !== false, grow: o.grow || 0,
            });
        }
    }
    ring(x, y, r, color = '#fff', life = 20) { this.rings.push({ x, y, r: 0, max: r, color, life, maxLife: life }); }
    bolt(x, y) {
        const pts = [];
        let cx = x + (R() - 0.5) * 6, cy = y - 28;
        pts.push([cx, cy]);
        for (let i = 1; i <= 12; i++) {
            const t = i / 12;
            cx = EP.lerp(cx, x, 0.25) + (R() - 0.5) * 2.2 * (1 - t);
            cy = EP.lerp(y - 28, y, t);
            pts.push([cx, cy]);
        }
        pts[pts.length - 1] = [x, y];
        this.bolts.push({ pts, life: 12, maxLife: 12 });
    }
    text(x, y, str, color = '#fff') { this.texts.push({ x, y, str, color, life: 60 }); }
    // Cartoon speech-bubble icons over creatures: heart, alert, skull, angry, note.
    emote(x, y, kind) { if (this.emotes.length < 160) this.emotes.push({ x, y, kind, life: 70, max: 70 }); }
    shake(a) { this.shakeAmt = Math.min(2.5, Math.max(this.shakeAmt, a)); }
    flash(a, color = '#ffffff') { if (a > this.flashAmt) { this.flashAmt = a; this.flashColor = color; } }
    update() {
        const P = this.particles;
        let j = 0;
        for (let i = 0; i < P.length; i++) {
            const p = P[i];
            p.x += p.vx; p.y += p.vy; p.z += p.vz; p.vz -= p.g;
            if (p.z < 0) { p.z = 0; p.vz = 0; p.vx *= 0.5; p.vy *= 0.5; }
            if (p.grow) p.size += p.grow;
            if (--p.life > 0) P[j++] = p;
        }
        P.length = j;
        for (let i = this.bolts.length - 1; i >= 0; i--) if (--this.bolts[i].life <= 0) this.bolts.splice(i, 1);
        for (let i = this.rings.length - 1; i >= 0; i--) { const r = this.rings[i]; r.r += (r.max - r.r) * 0.2; if (--r.life <= 0) this.rings.splice(i, 1); }
        for (let i = this.texts.length - 1; i >= 0; i--) { const t = this.texts[i]; t.y -= 0.015; if (--t.life <= 0) this.texts.splice(i, 1); }
        for (let i = this.emotes.length - 1; i >= 0; i--) { const e = this.emotes[i]; e.y -= 0.006; if (--e.life <= 0) this.emotes.splice(i, 1); }
        this.shakeAmt *= 0.9; if (this.shakeAmt < 0.02) this.shakeAmt = 0;
        this.flashAmt *= 0.9; if (this.flashAmt < 0.01) this.flashAmt = 0;
    }
}
EP.Effects = Effects;

const FIRE_COLS = ['#fff3a0', '#ffd34d', '#ff9f1c', '#ff5a1f', '#d63a1a'];
const SMOKE_COLS = ['#3a3a3a', '#555555', '#6e6e6e', '#888888'];
const FIREWORK_COLS = [['#ff5a7a', '#ffd0dc', '#ffffff'], ['#5fd0ff', '#d0f2ff', '#ffffff'], ['#ffe066', '#fff6c4', '#ff9f1c'], ['#8be08b', '#e0ffd0', '#ffffff'], ['#c79bff', '#efe2ff', '#ffffff']];

// ================================================================ Powers
class Powers {
    constructor(sim) {
        this.sim = sim;
        this.falling = []; this.tornados = []; this.quakes = []; this.volcanoes = []; this.rockets = [];
    }
    forTiles(x, y, r, fn) {
        const w = this.sim.world;
        const cx = Math.floor(x), cy = Math.floor(y), ri = Math.ceil(r);
        for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) {
            const d = Math.hypot(dx, dy);
            if (d > r + 0.25) continue;
            const tx = cx + dx, ty = cy + dy;
            if (!w.inb(tx, ty)) continue;
            fn(w.idx(tx, ty), tx, ty, d);
        }
    }
    unitsIn(x, y, r, pred) { return this.sim.grid.collect(x, y, r, pred); }
    afterTerrain(i) {
        const sim = this.sim, w = sim.world, t = w.terrain[i];
        if (w.bld[i] >= 0 && (TERRAIN[t].water || t === T.LAVA || t === T.MOUNTAIN)) {
            const b = sim.civ.buildings.get(w.bld[i]);
            if (b) { if (b.type === 'hall') { const c = sim.civ.cities.get(b.cityId); if (c) sim.civ.destroyCity(c, 'was swallowed by the land'); } else sim.civ.removeBuilding(b, true); }
        }
        if (w.fire[i] && TERRAIN[t].water) sim.env.extinguish(i);
        if (t === T.LAVA) for (let k = 0; k < 4; k++) if (R() < 0.3) sim.env.ignite((i % w.w) + EP.DX8[k], ((i / w.w) | 0) + EP.DY8[k]);
    }

    apply(id, x, y, size = 1) {
        const tool = EP.TOOL_BY_ID[id];
        if (!tool) return;
        const sim = this.sim, w = sim.world, rng = sim.rng;
        const r = Math.max(0, size - 0.6);
        if (tool.type === 'spawn') return this.spawn(tool.species, x, y);
        if (tool.terrain != null) {
            this.forTiles(x, y, r, (i, tx, ty, d) => {
                if (tool.terrain === T.MOUNTAIN) w.height[i] = Math.max(w.height[i], EP.PEAK + 6 + ((EP.hash2(tx, ty, 7) * 20) | 0));
                if (tool.terrain === T.HILLS) w.height[i] = EP.HILLS + 4 + ((EP.hash2(tx, ty, 7) * 18) | 0);
                if (tool.terrain === T.DEEP) w.height[i] = Math.min(w.height[i], EP.SHALLOW - 10 - ((d * 4) | 0));
                w.setTerrain(i, tool.terrain);
                if (w.terrain[i] === T.FARM || w.terrain[i] === T.ROAD) w.setTerrain(i, tool.terrain);
                this.afterTerrain(i);
            });
            return;
        }
        switch (id) {
            case 'raise': case 'lower': {
                const sgn = id === 'raise' ? 1 : -1;
                this.forTiles(x, y, r, (i, tx, ty, d) => {
                    const f = 1 - d / (r + 1);
                    w.height[i] = EP.clamp(w.height[i] + sgn * Math.max(1, Math.round(5 * f)), 2, 255);
                    w.reclassify(i);
                    this.afterTerrain(i);
                });
                break;
            }
            case 'forest':
                this.forTiles(x, y, r, i => {
                    if (!w.tree[i] && w.bld[i] < 0 && !w.fire[i] && EP.canHoldTree(w.terrain[i]) && rng.chance(r < 1 ? 1 : 0.3))
                        w.setTree(i, EP.treeFor(w.terrain[i], rng.next()));
                });
                break;
            case 'erase':
                this.forTiles(x, y, r, i => {
                    if (w.tree[i]) w.setTree(i, 0);
                    sim.env.extinguish(i);
                    const t = w.terrain[i];
                    if (t === T.LAVA || t === T.ASH || t === T.ROCK) w.setTerrain(i, T.SOIL);
                    if (w.bld[i] >= 0) {
                        const b = sim.civ.buildings.get(w.bld[i]);
                        if (b) { if (b.type === 'hall') { const c = sim.civ.cities.get(b.cityId); if (c) sim.civ.destroyCity(c, 'was erased'); } else sim.civ.removeBuilding(b, true); }
                    }
                });
                break;
            case 'bless':
                for (const u of this.unitsIn(x, y, r + 0.8, u => u.kind !== 'monster')) {
                    if (!u.traits.includes('blessed')) { u.traits.push('blessed'); Units.recalc(sim, u); }
                    u.hp = u.hpMax; u.sick = 0;
                }
                this.forTiles(x, y, r, i => { const b = sim.civ.buildings.get(w.bld[i]); if (b) b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.1); });
                sim.fx.burst(x, y, 6 + size * 3, { colors: ['#fff6b3', '#ffe066', '#ffffff'], speed: 0.03, life: 40, rise: 0.03, spread: r * 2, size: 1.2, glow: true });
                sim.emit('sfx', { name: 'bless', x, y });
                break;
            case 'heal':
                for (const u of this.unitsIn(x, y, r + 0.8)) {
                    u.sick = 0; u.frozen = 0;
                    if (u.madT > 0) Units.calm(sim, u);
                    if (u.species === 'zombie' || u.species === 'skeleton') {
                        const race = rng.pick(EP.CIV_RACES);
                        Units.kill(sim, u, 'cured', null);
                        sim.spawnUnit(race, u.x, u.y, {});
                    }
                }
                sim.fx.burst(x, y, 6 + size * 3, { colors: ['#b8ffd9', '#7dffb0', '#ffffff'], speed: 0.03, life: 40, rise: 0.03, spread: r * 2, glow: true });
                sim.emit('sfx', { name: 'bless', x, y });
                break;
            case 'rain':
                sim.env.clouds.push({ x, y, r: 6, life: 360 });
                sim.emit('sfx', { name: 'rain', x, y });
                break;
            case 'bloom':
                this.forTiles(x, y, r, i => {
                    const t = w.terrain[i];
                    if (t === T.ASH || t === T.SOIL || t === T.ROCK) w.setTerrain(i, T.GRASS);
                    else if (t === T.DESERT && rng.chance(0.3)) w.setTerrain(i, T.SAVANNA);
                    sim.env.extinguish(i);
                    if (!w.tree[i] && w.bld[i] < 0 && EP.canHoldTree(w.terrain[i]) && w.owner[i] < 0 && rng.chance(0.15)) w.setTree(i, EP.treeFor(w.terrain[i], rng.next()));
                });
                sim.fx.burst(x, y, 4 + size * 2, { colors: ['#9be15d', '#c6f68d', '#ffffff'], speed: 0.02, life: 35, rise: 0.02, spread: r * 2 });
                break;
            case 'lightning': this.lightning(x, y, false); break;
            case 'fire':
                this.forTiles(x, y, r, (i, tx, ty) => { if (rng.chance(0.7)) sim.env.ignite(tx, ty, true); });
                for (const u of this.unitsIn(x, y, r + 0.5)) Units.damage(sim, u, 6, null, 'fire');
                sim.fx.burst(x, y, 8, { colors: FIRE_COLS, speed: 0.03, life: 25, rise: 0.04, spread: r * 2, glow: true });
                sim.emit('sfx', { name: 'fire', x, y });
                break;
            case 'bomb':
                this.falling.push({ kind: 'bomb', x, y, sx: x, sy: y - 18, t: 0, dur: 26 });
                sim.emit('sfx', { name: 'whoosh', x, y });
                break;
            case 'napalm': {
                const dir = rng.chance(0.5) ? 1 : -1;
                for (let k = -5; k <= 5; k++) {
                    const bx = x + k * 1.25 * dir, by = y + rng.float(-0.6, 0.6);
                    this.falling.push({ kind: 'napalm', x: bx, y: by, sx: bx - 6 * dir, sy: by - 16, t: 0, dur: 22 + (k + 5) * 4 });
                }
                sim.emit('sfx', { name: 'whoosh', x, y });
                break;
            }
            case 'acid': {
                this.forTiles(x, y, r, (i, tx, ty) => {
                    if (!rng.chance(0.6)) return;
                    if (w.tree[i]) { w.setTree(i, 0); sim.fx.burst(tx + 0.5, ty + 0.5, 2, { colors: ['#8fff3a', '#5c8a2e'], speed: 0.03, life: 24, rise: 0.02 }); }
                    const t = w.terrain[i];
                    if (t === T.GRASS || t === T.SAVANNA || t === T.SOIL || t === T.SWAMP || t === T.SNOW || t === T.SAND) w.setTerrain(i, T.ASH);
                    if (w.bld[i] >= 0) sim.civ.damageBuilding(w.bld[i], 14, null);
                });
                for (const u of this.unitsIn(x, y, r + 0.7)) Units.damage(sim, u, 9, null, 'acid');
                sim.fx.burst(x, y, 6 + size * 3, { colors: ['#b6ff5a', '#8fff3a', '#e6ffb0'], speed: 0.02, life: 30, grav: 0.004, z: 2, spread: r * 2 + 1, size: 1.2 });
                sim.emit('sfx', { name: 'acid', x, y });
                break;
            }
            case 'blizzard': {
                this.forTiles(x, y, r, i => { if (rng.chance(0.7)) sim.env.freeze(i); });
                for (const u of this.unitsIn(x, y, r + 0.8)) { Units.freeze(sim, u, 160 + rng.int(0, 80)); if (!u.dead && !SPECIES[u.species].frost) Units.damage(sim, u, 2, null, 'frostbite'); }
                sim.fx.burst(x, y, 10 + size * 4, { colors: ['#ffffff', '#dff4ff', '#bfe8ff'], speed: 0.03, life: 50, grav: 0.002, z: 3, spread: r * 2 + 2, size: 1.2 });
                sim.emit('sfx', { name: 'freeze', x, y });
                break;
            }
            case 'madness': {
                const vic = this.unitsIn(x, y, r + 1, u => u.kind === 'civ' || u.kind === 'animal');
                for (const u of vic) Units.madden(sim, u, 700 + rng.int(0, 500));
                sim.fx.burst(x, y, 10 + size * 2, { colors: ['#ff3b3b', '#ff9b6b', '#a30000'], speed: 0.03, life: 40, rise: 0.02, spread: r * 2 });
                sim.emit('sfx', { name: 'mad', x, y });
                break;
            }
            case 'fireworks': {
                for (let k = 0; k < 5; k++) this.rockets.push({ x: x + rng.float(-2.5, 2.5), y: y + rng.float(-1.5, 1.5), z: 0, vz: 0.16 + rng.float(0, 0.06), t: 0, fuse: 26 + rng.int(0, 22), hue: rng.int(0, FIREWORK_COLS.length - 1) });
                const ks = sim.civ.kingdomsNear(x, y, 16);
                for (const a of ks) for (const b of ks) if (a !== b) a.relations[b.id] = Math.min(100, (a.relations[b.id] || 0) + 20);
                for (const u of this.unitsIn(x, y, 10, u => u.kind === 'civ' && !(u.madT > 0))) if (rng.chance(0.5)) sim.fx.emote(u.x, u.y, rng.chance(0.5) ? 'note' : 'heart');
                if (ks.length >= 2) sim.fx.text(x, y - 3, 'Celebration!', '#ffe066');
                break;
            }
            case 'meteor':
                this.falling.push({ kind: 'meteor', x, y, sx: x + 14, sy: y - 22, t: 0, dur: 42 });
                sim.emit('sfx', { name: 'whoosh', x, y });
                break;
            case 'nuke':
                this.falling.push({ kind: 'nuke', x, y, sx: x, sy: y - 30, t: 0, dur: 70 });
                sim.emit('sfx', { name: 'whoosh', x, y });
                break;
            case 'quake':
                this.quakes.push({ x, y, r: 11, life: 160 });
                sim.emit('sfx', { name: 'quake', x, y });
                break;
            case 'tornado':
                this.tornados.push({ x, y, a: rng.next() * Math.PI * 2, life: 540, r: 2.2 });
                sim.emit('sfx', { name: 'wind', x, y });
                break;
            case 'volcano': this.volcano(x, y); break;
            case 'plague': {
                const vic = this.unitsIn(x, y, r + 1, u => u.kind !== 'monster' && u.kind !== 'aquatic');
                for (const u of vic) u.sick = 600 + rng.int(0, 500);
                sim.fx.burst(x, y, 10 + size * 2, { colors: ['#9be15d', '#6bbf2a', '#d4ff8a'], speed: 0.02, life: 50, rise: 0.015, spread: r * 2 });
                sim.emit('sfx', { name: 'plague', x, y });
                break;
            }
            case 'curse': {
                const vic = this.unitsIn(x, y, r + 1, u => u.kind === 'civ' || u.kind === 'animal');
                for (const u of vic) { Units.kill(sim, u, 'cursed', null); sim.spawnUnit(u.kind === 'civ' && rng.chance(0.4) ? 'skeleton' : 'zombie', u.x, u.y, { age: 0 }); }
                if (!vic.length) for (let k = 0; k < 2; k++) sim.spawnUnit('zombie', x + rng.float(-1, 1), y + rng.float(-1, 1), { age: 0 });
                sim.fx.burst(x, y, 14, { colors: ['#7a3fbf', '#a86bff', '#2b1a3d'], speed: 0.03, life: 45, rise: 0.02, spread: r * 2 + 1 });
                sim.emit('sfx', { name: 'curse', x, y });
                break;
            }
            case 'discord': {
                const ks = sim.civ.kingdomsNear(x, y, 14);
                if (ks.length >= 2) {
                    for (let a = 0; a < ks.length; a++) for (let b = a + 1; b < ks.length; b++) {
                        ks[a].relations[ks[b].id] = ks[b].relations[ks[a].id] = -100;
                        sim.civ.declareWar(ks[a], ks[b]);
                    }
                } else if (ks.length === 1) {
                    const k = ks[0];
                    let best = null, bd = Infinity;
                    for (const o of sim.civ.aliveKingdoms()) if (o !== k && k.wars[o.id] == null) { const d = sim.civ.kingdomDistance(k, o); if (d < bd) { bd = d; best = o; } }
                    if (best) { k.relations[best.id] = best.relations[k.id] = -100; sim.civ.declareWar(k, best); }
                    else sim.emit('toast', 'There is no other realm to quarrel with.');
                } else sim.emit('toast', 'No realm here. Use Discord on a kingdom’s territory.');
                sim.fx.burst(x, y, 20, { colors: ['#ff3b3b', '#a30000', '#ff9b9b'], speed: 0.05, life: 40, rise: 0.02, spread: 6 });
                break;
            }
            case 'harmony': {
                const ks = sim.civ.kingdomsNear(x, y, 14);
                if (!ks.length) { sim.emit('toast', 'No realm here. Use Harmony on a kingdom’s territory.'); break; }
                let any = false;
                for (const k of ks) {
                    for (const eid of Object.keys(k.wars)) { const e = sim.civ.kingdoms.get(+eid); if (e) { sim.civ.makePeace(k, e); any = true; } }
                    for (const oid in k.relations) { k.relations[oid] = Math.min(100, k.relations[oid] + 50); const o = sim.civ.kingdoms.get(+oid); if (o) o.relations[k.id] = k.relations[oid]; }
                }
                if (!any) sim.emit('toast', 'Relations improved — but there was no war to end.');
                sim.fx.burst(x, y, 20, { colors: ['#9fe8ff', '#ffffff', '#7dd3fc'], speed: 0.04, life: 45, rise: 0.02, spread: 6, glow: true });
                sim.emit('sfx', { name: 'bless', x, y });
                break;
            }
            case 'rebel': {
                const c = sim.civ.cityAt(x, y);
                if (!c) { sim.emit('toast', 'Click on a town’s territory to incite rebellion.'); break; }
                const k = sim.civ.kingdoms.get(c.kingdomId);
                if (!k || k.cities.length < 2) { sim.emit('toast', `${c.name} is the realm's only town — there is nothing to break away from.`); break; }
                sim.civ.rebel(c, true);
                break;
            }
            case 'prosper': {
                const c = sim.civ.cityAt(x, y);
                if (!c) { sim.emit('toast', 'Click on a realm’s territory to bless it with prosperity.'); break; }
                const k = sim.civ.kingdoms.get(c.kingdomId);
                k.food += 80; k.wood += 80; k.stone += 50; k.gold += 20; k.tech += 120;
                sim.fx.burst(c.x, c.y, 24, { colors: ['#ffd34d', '#fff3a0', '#ffffff'], speed: 0.05, life: 50, rise: 0.03, spread: 4, glow: true });
                sim.fx.text(c.x, c.y - 2, 'Prosperity!', '#ffe066');
                sim.emit('sfx', { name: 'bless', x, y });
                break;
            }
        }
    }

    spawn(species, x, y) {
        const sim = this.sim, sp = SPECIES[species];
        const probe = { species, kind: sp.kind };
        for (let a = 0; a < 12; a++) {
            const px = x + (a ? sim.rng.float(-2, 2) : 0), py = y + (a ? sim.rng.float(-2, 2) : 0);
            if (!Units.passable(sim, probe, px, py)) continue;
            const u = sim.spawnUnit(species, px, py, {});
            if (u) {
                sim.fx.burst(px, py, 6, { colors: ['#ffffff', '#fff3a0'], speed: 0.03, life: 22, rise: 0.02, glow: true });
                sim.emit('sfx', { name: 'spawn', x, y });
                if (species === 'dragon') sim.log('A dragon has awoken', { x: px, y: py, type: 'death', unit: u.id });
                return u;
            }
        }
        return null;
    }

    lightning(x, y, natural) {
        const sim = this.sim, w = sim.world;
        sim.fx.bolt(x, y);
        sim.fx.flash(natural ? 0.18 : 0.3, '#dfe8ff');
        sim.fx.ring(x, y, 2.2, '#cfe0ff', 14);
        sim.fx.burst(x, y, 12, { colors: ['#ffffff', '#cfe0ff', '#ffe066'], speed: 0.1, life: 18, glow: true });
        for (const u of this.unitsIn(x, y, 1.8)) Units.damage(sim, u, 70, null, 'lightning');
        if (w.isWater(x, y)) for (const u of this.unitsIn(x, y, 3.5, u => w.isWater(u.x, u.y))) Units.damage(sim, u, 40, null, 'lightning');
        this.forTiles(x, y, 1.2, i => { if (w.bld[i] >= 0) sim.civ.damageBuilding(w.bld[i], 70, null); });
        sim.env.ignite(x, y);
        if (sim.rng.chance(0.5)) sim.env.ignite(x + sim.rng.int(-1, 1), y + sim.rng.int(-1, 1));
        sim.emit('sfx', { name: 'thunder', x, y });
    }

    explode(x, y, r, o) {
        const sim = this.sim, w = sim.world, rng = sim.rng;
        this.forTiles(x, y, r, (i, tx, ty, d) => {
            const f = 1 - d / r;
            if (w.terrain[i] === T.MOUNTAIN && d > r * 0.5) return;
            w.height[i] = EP.clamp(w.height[i] - Math.round(f * (o.depth || 30)), 2, 255);
            w.reclassify(i);
            if (w.tree[i]) w.setTree(i, 0);
            if (w.isLandI(i)) {
                if (d < r * (o.lava || 0)) w.setTerrain(i, T.LAVA);
                else if (d < r * 0.75) w.setTerrain(i, rng.chance(0.5) ? T.ROCK : T.ASH);
                else if (TERRAIN[w.terrain[i]].burn || w.terrain[i] === T.SAND) w.setTerrain(i, T.ASH);
                // restore height to land range in case setTerrain clamped it
            } else sim.fx.burst(tx + 0.5, ty + 0.5, 1, { color: '#e8f0ff', speed: 0.02, life: 50, rise: 0.03, size: 2 });
            if (w.bld[i] >= 0) sim.civ.damageBuilding(w.bld[i], (o.bdmg || 400) * f + 60, null);
            this.afterTerrain(i);
        });
        const R2 = r * 1.4;
        for (const u of this.unitsIn(x, y, R2)) {
            const d = Math.hypot(u.x - x, u.y - y), f = 1 - d / R2;
            const a = Math.atan2(u.y - y, u.x - x);
            const nx = u.x + Math.cos(a) * f * 2, ny = u.y + Math.sin(a) * f * 2;
            if (Units.passable(sim, u, nx, ny)) { u.x = nx; u.y = ny; }
            Units.damage(sim, u, (o.dmg || 150) * f + 10, null, o.cause || 'explosion');
        }
        this.forTiles(x, y, r + 2.5, (i, tx, ty, d) => { if (d > r * 0.8 && rng.chance(0.35)) sim.env.ignite(tx, ty); });
        sim.fx.burst(x, y, Math.min(120, 20 + r * 8), { colors: FIRE_COLS, speed: 0.04 + r * 0.02, life: 40, rise: 0.02, glow: true, size: 2 });
        sim.fx.burst(x, y, Math.min(120, 15 + r * 6), { colors: SMOKE_COLS, speed: 0.02 + r * 0.01, life: 120, rise: 0.025, size: 3, grow: 0.03, spread: r });
        sim.fx.burst(x, y, 20, { colors: ['#5d5249', '#8a7a66', '#3a332d'], speed: 0.12, life: 45, grav: 0.006, up: 0.12, size: 1.5 });
        sim.fx.ring(x, y, r * 1.8, '#fff1c4', 22);
        sim.fx.shake(Math.min(2.2, r / 4));
        sim.fx.flash(Math.min(0.9, r / 12), '#fff2cc');
    }

    volcano(x, y) {
        const sim = this.sim, w = sim.world;
        this.forTiles(x, y, 5, (i, tx, ty, d) => {
            if (d < 1.5) { w.height[i] = EP.PEAK + 10; w.setTerrain(i, T.LAVA); w.height[i] = EP.PEAK + 10; }
            else if (d < 3.2) { w.height[i] = Math.max(w.height[i], EP.PEAK + 20 - ((d * 6) | 0)); w.setTerrain(i, T.MOUNTAIN); }
            else { w.height[i] = Math.max(w.height[i], EP.HILLS + 10); w.reclassify(i); if (w.terrain[i] !== T.MOUNTAIN && w.terrain[i] !== T.HILLS) w.setTerrain(i, T.HILLS); }
            if (w.tree[i] && d < 3.2) w.setTree(i, 0);
            this.afterTerrain(i);
        });
        this.volcanoes.push({ x: Math.floor(x) + 0.5, y: Math.floor(y) + 0.5, life: 480 });
        sim.fx.shake(0.8);
        sim.emit('sfx', { name: 'quake', x, y });
    }

    impact(f) {
        const sim = this.sim, w = sim.world;
        switch (f.kind) {
            case 'meteor':
                this.explode(f.x, f.y, 3.6, { lava: 0.35, depth: 45, dmg: 220, bdmg: 500 });
                sim.emit('sfx', { name: 'explosion', x: f.x, y: f.y });
                break;
            case 'nuke':
                this.explode(f.x, f.y, 13, { lava: 0.22, depth: 70, dmg: 2000, bdmg: 99999, cause: 'cataclysm' });
                sim.fx.flash(1, '#ffffff');
                sim.fx.shake(2.5);
                sim.fx.burst(f.x, f.y, 160, { colors: ['#ffb43a', '#ff7b1f', '#6e6e6e', '#888', '#aaa'], speed: 0.015, life: 220, rise: 0.06, size: 4, grow: 0.05, spread: 3 });
                sim.fx.burst(f.x, f.y - 4, 80, { colors: ['#9a8f84', '#776e66', '#b8aea4'], speed: 0.08, life: 240, rise: 0.04, size: 5, grow: 0.05, spread: 4 });
                this.forTiles(f.x, f.y, 19, (i, tx, ty, d) => { if (d > 12 && sim.rng.chance(0.55)) sim.env.ignite(tx, ty, true); });
                sim.log('A cataclysm scorched the earth', { x: f.x, y: f.y, type: 'disaster' });
                sim.emit('sfx', { name: 'nuke', x: f.x, y: f.y });
                break;
            case 'bomb':
                this.explode(f.x, f.y, 2.3, { lava: 0, depth: 14, dmg: 120, bdmg: 260, cause: 'bomb' });
                sim.emit('sfx', { name: 'explosion', x: f.x, y: f.y });
                break;
            case 'napalm':
                this.forTiles(f.x, f.y, 1.4, (i, tx, ty) => { sim.env.ignite(tx, ty, true); if (w.tree[i] && sim.rng.chance(0.3)) w.setTree(i, 0); if (w.bld[i] >= 0) sim.civ.damageBuilding(w.bld[i], 40, null); });
                for (const u of this.unitsIn(f.x, f.y, 1.6)) Units.damage(sim, u, 35, null, 'napalm');
                sim.fx.burst(f.x, f.y, 14, { colors: FIRE_COLS, speed: 0.06, life: 30, rise: 0.03, glow: true, size: 1.5 });
                sim.fx.shake(0.4);
                sim.emit('sfx', { name: 'fire', x: f.x, y: f.y });
                break;
            case 'lavabomb': {
                if (!w.inb(f.x | 0, f.y | 0)) break;
                const i = w.idx(f.x | 0, f.y | 0), t = w.terrain[i];
                if (w.isLandI(i) && t !== T.MOUNTAIN) { if (sim.rng.chance(0.45)) { w.setTerrain(i, T.LAVA); this.afterTerrain(i); } else sim.env.ignite(f.x, f.y, true); }
                else if (!w.isLandI(i)) sim.fx.burst(f.x, f.y, 6, { color: '#e8f0ff', speed: 0.03, life: 40, rise: 0.03, size: 2 });
                for (const u of this.unitsIn(f.x, f.y, 1.2)) Units.damage(sim, u, 45, null, 'lava');
                if (w.bld[i] >= 0) sim.civ.damageBuilding(w.bld[i], 80, null);
                sim.fx.burst(f.x, f.y, 8, { colors: FIRE_COLS, speed: 0.05, life: 25, grav: 0.005, glow: true });
                break;
            }
        }
    }

    update() {
        const sim = this.sim, w = sim.world, rng = sim.rng;
        // Falling objects
        for (let i = this.falling.length - 1; i >= 0; i--) {
            const f = this.falling[i];
            f.t++;
            const p = f.t / f.dur;
            const cx = EP.lerp(f.sx, f.x, p), cy = EP.lerp(f.sy, f.y, p);
            if (f.kind === 'meteor') sim.fx.burst(cx, cy, 2, { colors: FIRE_COLS, speed: 0.01, life: 18, glow: true, size: 1.5 });
            if (f.kind === 'lavabomb' || f.kind === 'napalm') sim.fx.burst(cx, cy, 1, { colors: FIRE_COLS, speed: 0.005, life: 12, glow: true });
            if (f.t >= f.dur) { this.falling.splice(i, 1); this.impact(f); }
        }
        // Fireworks
        for (let i = this.rockets.length - 1; i >= 0; i--) {
            const r = this.rockets[i];
            r.t++; r.z += r.vz; r.vz *= 0.985;
            sim.fx.burst(r.x, r.y, 1, { z: r.z, colors: ['#fff3a0', '#ffb43a'], speed: 0.004, life: 12, glow: true });
            if (r.t < r.fuse) continue;
            this.rockets.splice(i, 1);
            sim.fx.burst(r.x, r.y, 46, { z: r.z, colors: FIREWORK_COLS[r.hue], speed: 0.11, life: 55, grav: 0.0035, glow: true, size: 1.3 });
            sim.fx.burst(r.x, r.y, 10, { z: r.z, color: '#ffffff', speed: 0.03, life: 20, glow: true, size: 1.6 });
            sim.emit('sfx', { name: 'firework', x: r.x, y: r.y });
        }
        // Quakes
        for (let i = this.quakes.length - 1; i >= 0; i--) {
            const q = this.quakes[i];
            q.life--;
            sim.fx.shake(0.45);
            if (q.life % 6 === 0) {
                for (const b of sim.civ.buildings.values()) if (EP.dist2(b.x + b.w / 2, b.y + b.h / 2, q.x, q.y) < q.r * q.r) sim.civ.damageBuilding(b.id, 9 + rng.next() * 9, null);
                for (const u of this.unitsIn(q.x, q.y, q.r, u => !SPECIES[u.species].fly)) {
                    u.x += rng.float(-0.12, 0.12); u.y += rng.float(-0.12, 0.12);
                    if (!Units.passable(sim, u, u.x, u.y)) { u.x = u.px; u.y = u.py; }
                    if (rng.chance(0.15)) Units.damage(sim, u, 2, null, 'earthquake');
                }
                for (let k = 0; k < 3; k++) sim.fx.burst(q.x + rng.float(-q.r, q.r), q.y + rng.float(-q.r, q.r), 3, { colors: ['#b59a77', '#8a7a66'], speed: 0.03, life: 35, rise: 0.01, size: 2 });
            }
            if (q.life % 40 === 0) this.fissure(q.x + rng.float(-q.r * 0.6, q.r * 0.6), q.y + rng.float(-q.r * 0.6, q.r * 0.6));
            if (q.life <= 0) this.quakes.splice(i, 1);
        }
        // Tornados
        for (let i = this.tornados.length - 1; i >= 0; i--) {
            const t = this.tornados[i];
            t.life--;
            t.a += rng.float(-0.18, 0.18);
            t.x += Math.cos(t.a) * 0.055; t.y += Math.sin(t.a) * 0.055;
            if (t.x < 2 || t.x > w.w - 2) t.a = Math.PI - t.a;
            if (t.y < 2 || t.y > w.h - 2) t.a = -t.a;
            t.x = EP.clamp(t.x, 1, w.w - 1); t.y = EP.clamp(t.y, 1, w.h - 1);
            for (const u of this.unitsIn(t.x, t.y, t.r + 0.6, u => u.species !== 'dragon')) {
                const a = Math.atan2(u.y - t.y, u.x - t.x) + 1.3;
                const nx = u.x + Math.cos(a) * 0.35, ny = u.y + Math.sin(a) * 0.35;
                if (Units.passable(sim, u, nx, ny)) { u.x = nx; u.y = ny; }
                Units.damage(sim, u, 0.7, null, 'tornado');
            }
            this.forTiles(t.x, t.y, t.r, (j, tx, ty) => {
                if (w.tree[j] && rng.chance(0.06)) { w.setTree(j, 0); sim.fx.burst(tx + 0.5, ty + 0.5, 4, { colors: ['#5c8a2e', '#7a5230'], speed: 0.1, life: 40, rise: 0.04, size: 1.5 }); }
                if (w.bld[j] >= 0 && rng.chance(0.3)) sim.civ.damageBuilding(w.bld[j], 6, null);
                if (w.fire[j] && rng.chance(0.2)) sim.env.ignite(tx + rng.int(-2, 2), ty + rng.int(-2, 2));
            });
            const water = w.isWater(t.x, t.y);
            sim.fx.burst(t.x + rng.float(-1.5, 1.5), t.y + rng.float(-0.8, 0.8), 2, { colors: water ? ['#cfe6ff', '#9fc7ef'] : ['#a89a86', '#8a7a66', '#c5b9a6'], speed: 0.03, life: 30, rise: 0.05, size: 1.5 });
            if (t.life <= 0) this.tornados.splice(i, 1);
        }
        // Volcanoes
        for (let i = this.volcanoes.length - 1; i >= 0; i--) {
            const v = this.volcanoes[i];
            v.life--;
            if (v.life % 2 === 0) sim.fx.burst(v.x, v.y - 1, 2, { colors: ['#3a3a3a', '#555', '#6e6e6e', '#ff7b1f'], speed: 0.01, life: 140, rise: 0.035, size: 3, grow: 0.03, spread: 1 });
            if (v.life % 7 === 0) {
                const a = rng.next() * Math.PI * 2, d = 2 + rng.next() * 8;
                this.falling.push({ kind: 'lavabomb', sx: v.x, sy: v.y - 1, x: v.x + Math.cos(a) * d, y: v.y + Math.sin(a) * d, t: 0, dur: 30 + (d * 2) | 0 });
            }
            if (v.life % 60 === 0) { sim.fx.shake(0.3); sim.emit('sfx', { name: 'rumble', x: v.x, y: v.y }); }
            if (v.life % 160 === 80 && rng.chance(0.3)) {
                const d = sim.spawnUnit('demon', v.x + rng.float(-1, 1), v.y + 1.5, {});
                if (d) { sim.fx.burst(d.x, d.y, 12, { colors: FIRE_COLS, speed: 0.05, life: 30, rise: 0.03, glow: true }); sim.log('A demon crawled out of the volcano', { x: d.x, y: d.y, type: 'disaster', unit: d.id }); }
            }
            if (v.life <= 0) this.volcanoes.splice(i, 1);
        }
    }
    fissure(x, y) {
        const sim = this.sim, w = sim.world, rng = sim.rng;
        let a = rng.next() * Math.PI * 2;
        const len = rng.int(6, 13);
        for (let s = 0; s < len; s++) {
            const tx = x | 0, ty = y | 0;
            if (!w.inb(tx, ty)) break;
            const i = w.idx(tx, ty);
            if (w.isLandI(i) && w.terrain[i] !== T.MOUNTAIN) {
                w.height[i] = Math.max(EP.SEA + 2, w.height[i] - 12);
                w.setTerrain(i, rng.chance(0.25) ? T.LAVA : T.ROCK);
                if (w.tree[i]) w.setTree(i, 0);
                this.afterTerrain(i);
            }
            a += rng.float(-0.5, 0.5);
            x += Math.cos(a); y += Math.sin(a);
        }
    }
}
EP.Powers = Powers;
})();
