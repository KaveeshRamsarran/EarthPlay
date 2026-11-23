/* EarthPlay — world grid storage, procedural generation, landmasses and the living environment. */
(function () {
'use strict';
const EP = globalThis.EP;
const { T, TERRAIN, TREE } = EP;

// ================================================================ World
class World {
    constructor(w, h) {
        this.w = w; this.h = h;
        const n = w * h;
        this.terrain = new Uint8Array(n);
        this.height = new Uint8Array(n);
        this.tree = new Uint8Array(n);
        this.fire = new Uint8Array(n);       // remaining burn time
        this.wear = new Uint8Array(n);       // foot traffic → roads
        this.owner = new Int16Array(n).fill(-1);  // city id
        this.bld = new Int32Array(n).fill(-1);    // building id
        this.landmass = new Int32Array(n).fill(-1);
        this.waterbody = new Int32Array(n).fill(-1); // connected open water (for boats)
        this.ore = new Uint8Array(n);        // EP.ORE type
        this.oreAmt = new Uint8Array(n);     // units left in the vein
        this.dirty = new Set();              // tiles needing re-render
        this.version = 0;                    // bumps on any terrain change (minimap)
        this.ownerVersion = 0;               // bumps on territory change
        this.landDirty = true;
    }
    idx(x, y) { return y * this.w + x; }
    inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    t(x, y) { return this.inb(x, y) ? this.terrain[y * this.w + x] : T.DEEP; }
    walkableI(i) { return TERRAIN[this.terrain[i]].walk; }
    walkable(x, y) { x |= 0; y |= 0; return this.inb(x, y) && TERRAIN[this.terrain[y * this.w + x]].walk; }
    isWater(x, y) { x |= 0; y |= 0; return this.inb(x, y) && TERRAIN[this.terrain[y * this.w + x]].water; }
    isLandI(i) { const t = this.terrain[i]; return t !== T.DEEP && t !== T.SHALLOW; }

    touch(i) {
        this.dirty.add(i); this.version++;
    }
    setTerrain(i, t) {
        const old = this.terrain[i];
        if (old === t) return;
        this.terrain[i] = t;
        if (TERRAIN[old].walk !== TERRAIN[t].walk || TERRAIN[old].water !== TERRAIN[t].water) this.landDirty = true;
        // Keep height consistent with the terrain class so later raise/lower behaves.
        const h = this.height[i];
        if (t === T.DEEP) this.height[i] = Math.min(h, EP.SHALLOW - 8);
        else if (t === T.SHALLOW) this.height[i] = EP.clamp(h, EP.SHALLOW, EP.SEA - 2);
        else if (t === T.MOUNTAIN) this.height[i] = Math.max(h, EP.PEAK + 6);
        else if (t === T.HILLS) this.height[i] = EP.clamp(h, EP.HILLS + 2, EP.PEAK - 2);
        else this.height[i] = EP.clamp(h, EP.SEA + 2, EP.HILLS - 2);
        if (this.tree[i] && !EP.canHoldTree(t)) this.tree[i] = 0;
        if (this.ore[i] && !EP.canHoldOre(t)) { this.ore[i] = 0; this.oreAmt[i] = 0; }
        if (this.fire[i] && !TERRAIN[t].burn && !this.tree[i]) this.fire[i] = 0;
        this.touch(i);
    }
    setOre(i, type, amt) {
        if (type && !EP.canHoldOre(this.terrain[i])) return;
        this.ore[i] = type; this.oreAmt[i] = type ? amt : 0;
        if (type && this.tree[i]) this.tree[i] = 0;
        this.touch(i);
    }
    setTree(i, v) {
        if (this.tree[i] === v) return;
        this.tree[i] = v; this.touch(i);
    }
    // Re-derive terrain class after a raw height edit (raise/lower tools).
    reclassify(i, rng) {
        const h = this.height[i], t = this.terrain[i];
        let nt = t;
        if (h < EP.SHALLOW) nt = T.DEEP;
        else if (h < EP.SEA) nt = T.SHALLOW;
        else if (h >= EP.PEAK) nt = T.MOUNTAIN;
        else if (h >= EP.HILLS) nt = (t === T.SNOW ? T.SNOW : T.HILLS);
        else if (t === T.DEEP || t === T.SHALLOW) nt = h < EP.SEA + 5 ? T.SAND : T.GRASS;
        else if (t === T.MOUNTAIN || t === T.HILLS) nt = T.GRASS;
        if (nt !== t) {
            const keepH = this.height[i];
            this.setTerrain(i, nt);
            this.height[i] = keepH;
        }
        this.touch(i);
    }

    // Flood-fill walkable regions so AI only targets reachable places.
    computeLandmasses() {
        const { w, h, landmass } = this;
        landmass.fill(-1);
        let id = 0;
        const stack = new Int32Array(w * h);
        this.landmassSizes = [];
        for (let s = 0; s < w * h; s++) {
            if (landmass[s] !== -1 || !this.walkableI(s)) continue;
            let sp = 0, size = 0;
            stack[sp++] = s; landmass[s] = id;
            while (sp) {
                const i = stack[--sp]; size++;
                const x = i % w, y = (i / w) | 0;
                if (x > 0 && landmass[i - 1] === -1 && this.walkableI(i - 1)) { landmass[i - 1] = id; stack[sp++] = i - 1; }
                if (x < w - 1 && landmass[i + 1] === -1 && this.walkableI(i + 1)) { landmass[i + 1] = id; stack[sp++] = i + 1; }
                if (y > 0 && landmass[i - w] === -1 && this.walkableI(i - w)) { landmass[i - w] = id; stack[sp++] = i - w; }
                if (y < h - 1 && landmass[i + w] === -1 && this.walkableI(i + w)) { landmass[i + w] = id; stack[sp++] = i + w; }
            }
            this.landmassSizes[id] = size;
            id++;
        }
        // Open-water bodies: boats can sail anywhere inside one.
        const wb = this.waterbody, T0 = T.DEEP, T1 = T.SHALLOW, ter = this.terrain;
        const isW = i => ter[i] === T0 || ter[i] === T1;
        wb.fill(-1);
        this.waterSizes = [];
        id = 0;
        for (let s = 0; s < w * h; s++) {
            if (wb[s] !== -1 || !isW(s)) continue;
            let sp = 0, size = 0;
            stack[sp++] = s; wb[s] = id;
            while (sp) {
                const i = stack[--sp]; size++;
                const x = i % w, y = (i / w) | 0;
                if (x > 0 && wb[i - 1] === -1 && isW(i - 1)) { wb[i - 1] = id; stack[sp++] = i - 1; }
                if (x < w - 1 && wb[i + 1] === -1 && isW(i + 1)) { wb[i + 1] = id; stack[sp++] = i + 1; }
                if (y > 0 && wb[i - w] === -1 && isW(i - w)) { wb[i - w] = id; stack[sp++] = i - w; }
                if (y < h - 1 && wb[i + w] === -1 && isW(i + w)) { wb[i + w] = id; stack[sp++] = i + w; }
            }
            this.waterSizes[id] = size;
            id++;
        }
        this.landDirty = false;
        this.landVersion = (this.landVersion || 0) + 1;
    }
    sameLand(ax, ay, bx, by) {
        if (!this.inb(ax | 0, ay | 0) || !this.inb(bx | 0, by | 0)) return false;
        const a = this.landmass[this.idx(ax | 0, ay | 0)];
        return a !== -1 && a === this.landmass[this.idx(bx | 0, by | 0)];
    }
}
EP.World = World;

// ================================================================ Pathfinding
// Grid A* with 8-way moves. cost(i) returns the step cost into tile i, or a negative number when blocked.
// goal is a tile index. Returns an array of tile indices from start to goal, or null.
class Heap {
    constructor() { this.n = []; this.f = []; }
    get size() { return this.n.length; }
    push(node, f) {
        const n = this.n, F = this.f; let i = n.length;
        n.push(node); F.push(f);
        while (i > 0) { const p = (i - 1) >> 1; if (F[p] <= f) break; n[i] = n[p]; F[i] = F[p]; i = p; }
        n[i] = node; F[i] = f;
    }
    pop() {
        const n = this.n, F = this.f, top = n[0], ln = n.pop(), lf = F.pop();
        if (n.length) {
            let i = 0; const len = n.length;
            for (;;) {
                let c = 2 * i + 1; if (c >= len) break;
                if (c + 1 < len && F[c + 1] < F[c]) c++;
                if (F[c] >= lf) break;
                n[i] = n[c]; F[i] = F[c]; i = c;
            }
            n[i] = ln; F[i] = lf;
        }
        return top;
    }
}
const PDX = [1, -1, 0, 0, 1, 1, -1, -1], PDY = [0, 0, 1, -1, 1, -1, 1, -1];
EP.findPath = function (w, start, goal, cost, maxNodes = 12000) {
    const N = w.w * w.h;
    if (start < 0 || goal < 0 || start >= N || goal >= N) return null;
    if (!w._pf || w._pf.g.length !== N) w._pf = { g: new Float32Array(N), from: new Int32Array(N), seen: new Int32Array(N), stamp: 0 };
    const pf = w._pf;
    const stamp = ++pf.stamp;
    const gx = goal % w.w, gy = (goal / w.w) | 0;
    const hfun = i => { const dx = Math.abs(i % w.w - gx), dy = Math.abs(((i / w.w) | 0) - gy); return (dx + dy - 0.59 * Math.min(dx, dy)) * 0.45; };
    const open = new Heap();
    pf.g[start] = 0; pf.from[start] = -1; pf.seen[start] = stamp;
    open.push(start, hfun(start));
    let expanded = 0;
    while (open.size) {
        const i = open.pop();
        if (i === goal) {
            const path = [];
            for (let c = goal; c !== -1; c = pf.from[c]) path.push(c);
            return path.reverse();
        }
        if (++expanded > maxNodes) return null;
        const x = i % w.w, y = (i / w.w) | 0, gi = pf.g[i];
        for (let k = 0; k < 8; k++) {
            const nx = x + PDX[k], ny = y + PDY[k];
            if (nx < 0 || ny < 0 || nx >= w.w || ny >= w.h) continue;
            const j = ny * w.w + nx;
            let c = j === goal ? Math.max(0.5, cost(j)) : cost(j);
            if (c < 0) continue;
            if (k > 3) { // no corner cutting
                if (cost(y * w.w + nx) < 0 || cost(ny * w.w + x) < 0) continue;
                c *= 1.414;
            }
            const ng = gi + c;
            if (pf.seen[j] === stamp && ng >= pf.g[j]) continue;
            pf.seen[j] = stamp; pf.g[j] = ng; pf.from[j] = i;
            open.push(j, ng + hfun(j));
        }
    }
    return null;
};

// Scatter ore veins through hills and mountains.
EP.seedOres = function (world, rng) {
    const { w, h } = world, ter = world.terrain;
    const rocky = [], high = [], mountain = [], open = [];
    for (let i = 0; i < w * h; i++) {
        const t = ter[i];
        if (t === T.MOUNTAIN) { rocky.push(i); high.push(i); mountain.push(i); }
        else if (t === T.HILLS || t === T.ROCK || (t === T.SNOW && world.height[i] >= EP.HILLS)) { rocky.push(i); if (rng.next() < 0.3) high.push(i); }
        else if (t === T.GRASS || t === T.SAVANNA || t === T.DESERT || t === T.SNOW) open.push(i);
    }
    // Flat worlds still get ore: veins push up small rocky outcrops on open ground.
    const basis = Math.max(rocky.length, (rocky.length + open.length) * 0.1);
    if (!basis) return;
    const outcrop = 1 - rocky.length / basis;
    for (const [type, o] of Object.entries(EP.ORE_INFO)) {
        const mtn = o.rock === 'mountain';
        let pool = mtn ? mountain : o.rock === 'high' ? (high.length ? high : rocky) : rocky;
        const clusters = Math.max(o.density >= 1 ? 1 : 0, Math.round(basis / 1000 * o.density * (0.8 + rng.next() * 0.4)));
        for (let c = 0; c < clusters; c++) {
            const raise = !mtn && open.length && (!pool.length || rng.next() < outcrop);
            if (!raise && !pool.length) break;
            let i = raise ? open[(rng.next() * open.length) | 0] : pool[(rng.next() * pool.length) | 0];
            const n = rng.int(o.size[0], o.size[1]);
            let placed = 0;
            for (let s = 0; s < 40 && placed < n; s++) {
                if (raise && !world.ore[i] && (ter[i] === T.GRASS || ter[i] === T.SAVANNA || ter[i] === T.DESERT || ter[i] === T.SNOW)) {
                    ter[i] = ter[i] === T.SNOW ? T.SNOW : T.HILLS;
                    world.height[i] = Math.max(world.height[i], EP.HILLS + 2 + rng.int(0, 8));
                }
                if (!world.ore[i] && EP.canHoldOre(ter[i]) && (!mtn || ter[i] === T.MOUNTAIN || rng.next() < 0.25)) {
                    world.ore[i] = +type; world.oreAmt[i] = rng.int(o.amt[0], o.amt[1]); world.tree[i] = 0; placed++;
                }
                const k = (rng.next() * 4) | 0, nx = (i % w) + DX8[k], ny = ((i / w) | 0) + DY8[k];
                if (nx >= 0 && ny >= 0 && nx < w && ny < h) i = ny * w + nx;
            }
        }
    }
};

EP.canHoldTree = t => t === T.GRASS || t === T.SAVANNA || t === T.DESERT || t === T.SAND || t === T.SWAMP || t === T.SNOW || t === T.HILLS || t === T.SOIL;

// ================================================================ Generation
EP.generateWorld = function (world, opts) {
    const { w, h } = world;
    const seed = opts.seed >>> 0;
    const shape = opts.shape || 'continent';
    const seaShift = { low: 0.07, normal: 0, high: -0.07 }[opts.sea || 'normal'] || 0;
    const nE = new EP.Noise(seed), nR = new EP.Noise(seed + 101), nT = new EP.Noise(seed + 202),
          nM = new EP.Noise(seed + 303), nF = new EP.Noise(seed + 404);
    const rng = new EP.RNG(seed ^ 0xabcdef);
    const temp = new Float32Array(w * h), moist = new Float32Array(w * h);

    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x, nx = x / w, ny = y / h;
        const ex = 2 * nx - 1, ey = 2 * ny - 1;
        let e;
        switch (shape) {
            case 'pangaea': {
                const d = Math.hypot(ex, ey * 1.05);
                e = nE.fbm(x / 80, y / 80, 6) * 0.8 + 0.3 - d * d * 0.85;
                break;
            }
            case 'archipelago': {
                e = nE.fbm(x / 34, y / 34, 6) * 1.25 - 0.03;
                e -= EP.smoothstep(0.82, 1.0, Math.max(Math.abs(ex), Math.abs(ey))) * 0.6;
                break;
            }
            case 'lakes': {
                e = nE.fbm(x / 70, y / 70, 6) * 0.9 + 0.3;
                e -= EP.smoothstep(0.9, 1.0, Math.max(Math.abs(ex), Math.abs(ey))) * 0.8;
                break;
            }
            default: { // continent
                e = nE.fbm(x / 95, y / 95, 6) + nE.fbm(x / 30 + 50, y / 30 + 50, 3) * 0.18 + 0.06;
                e -= EP.smoothstep(0.72, 1.0, Math.max(Math.abs(ex), Math.abs(ey))) * 0.75;
            }
        }
        e += seaShift;
        let hh;
        if (e > 0) {
            const ridge = nR.ridged(x / 42, y / 42, 4);
            hh = EP.SEA + 2 + e * 125 + Math.max(0, e - 0.12) * ridge * 240;
        } else {
            hh = EP.SEA - 1 + e * 170;
        }
        world.height[i] = EP.clamp(Math.round(hh), 4, 255);
        const lat = Math.abs(ey);
        temp[i] = 1.02 - lat * 0.85 + nT.fbm(x / 70, y / 70, 3) * 0.3 - Math.max(0, hh - EP.SEA) / 420;
        moist[i] = nM.fbm(x / 60, y / 60, 4) * 0.75 + 0.5;
    }

    // Classify base terrain
    for (let i = 0; i < w * h; i++) world.terrain[i] = classify(world.height[i], temp[i], moist[i]);

    // Rivers flow downhill from the highlands to the sea.
    const rivers = Math.round((w * h) / 4200);
    for (let r = 0; r < rivers; r++) carveRiver(world, rng);

    // Beaches: land touching ocean becomes sand when low.
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x, t = world.terrain[i];
        if (t === T.GRASS || t === T.SAVANNA || t === T.SWAMP) {
            if (world.height[i] < EP.SEA + 6 && (world.terrain[i - 1] === T.DEEP || world.terrain[i + 1] === T.DEEP || world.terrain[i - w] === T.DEEP || world.terrain[i + w] === T.DEEP))
                world.terrain[i] = T.SAND;
        }
    }

    // Forests
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x, t = world.terrain[i];
        const f = nF.fbm(x / 22, y / 22, 4);
        let p = 0;
        switch (t) {
            case T.GRASS: p = f > 0.08 ? 0.72 : 0.03; break;
            case T.HILLS: p = f > -0.05 ? 0.5 : 0.08; break;
            case T.SNOW: p = f > 0.1 ? 0.45 : 0.04; break;
            case T.SWAMP: p = 0.28; break;
            case T.SAVANNA: p = f > 0.2 ? 0.25 : 0.04; break;
            case T.DESERT: p = 0.015; break;
            case T.SAND: p = 0.04; break;
        }
        if (p && rng.next() < p) world.tree[i] = EP.treeFor(t, rng.next());
    }
    EP.seedOres(world, new EP.RNG(seed ^ 0x0fe5));
    world.computeLandmasses();
    world.version++;
    return world;
};

function classify(hh, tp, mo) {
    if (hh < EP.SHALLOW) return T.DEEP;
    if (hh < EP.SEA) return T.SHALLOW;
    if (hh >= EP.PEAK) return T.MOUNTAIN;
    if (hh >= EP.HILLS) return tp < 0.2 ? T.SNOW : T.HILLS;
    if (tp < 0.2) return T.SNOW;
    if (hh < EP.SEA + 3) return T.SAND;
    if (tp > 0.7 && mo < 0.42) return T.DESERT;
    if (tp > 0.56 && mo < 0.52) return T.SAVANNA;
    if (mo > 0.74 && hh < EP.SEA + 26) return T.SWAMP;
    return T.GRASS;
}

function carveRiver(world, rng) {
    const { w, h } = world;
    let x = 0, y = 0, found = false;
    for (let a = 0; a < 80 && !found; a++) {
        x = rng.int(2, w - 3); y = rng.int(2, h - 3);
        const hh = world.height[y * w + x];
        found = hh > EP.HILLS - 20 && hh < EP.PEAK + 20;
    }
    if (!found) return;
    const visited = new Set();
    for (let step = 0; step < 700; step++) {
        const i = y * w + x;
        visited.add(i);
        if (world.terrain[i] === T.DEEP) return;
        if (world.terrain[i] !== T.MOUNTAIN) {
            world.terrain[i] = T.SHALLOW; world.tree[i] = 0;
            world.height[i] = Math.min(world.height[i], EP.SEA - 4);
            if (step > 50 && rng.chance(0.35)) {
                const nx = x + rng.int(-1, 1), ny = y + rng.int(-1, 1);
                if (world.inb(nx, ny)) { const j = ny * w + nx; if (world.terrain[j] !== T.MOUNTAIN && world.terrain[j] !== T.DEEP) { world.terrain[j] = T.SHALLOW; world.tree[j] = 0; world.height[j] = Math.min(world.height[j], EP.SEA - 4); } }
            }
        }
        // Step to the lowest unvisited 4-neighbour (with a little noise for meanders).
        let best = -1, bh = Infinity, bx = x, by = y;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (!world.inb(nx, ny)) return;
            const j = ny * w + nx;
            if (visited.has(j)) continue;
            const v = world.height[j] + rng.next() * 6;
            if (v < bh) { bh = v; best = j; bx = nx; by = ny; }
        }
        if (best < 0) return;
        x = bx; y = by;
    }
}

// ================================================================ Environment
class Environment {
    constructor(sim) {
        this.sim = sim;
        this.fires = new Set();
        this.weather = { type: 'clear', timer: 1800, intensity: 0 };
        this.wind = { x: 1, y: 0.2 };
        this.clouds = []; // local rain clouds summoned by the player
    }
    flammability(i) {
        const w = this.sim.world;
        const tr = w.tree[i];
        if (tr) return EP.TREE_INFO[tr].burn;
        if (w.bld[i] >= 0) return 0.25;
        return TERRAIN[w.terrain[i]].burn;
    }
    ignite(x, y, force = false) {
        const w = this.sim.world;
        x |= 0; y |= 0;
        if (!w.inb(x, y)) return false;
        const i = w.idx(x, y);
        if (w.fire[i]) return true;
        const t = w.terrain[i];
        if (TERRAIN[t].water || t === T.MOUNTAIN || t === T.LAVA) return false;
        if (!force && this.flammability(i) <= 0) return false;
        w.fire[i] = 50 + ((Math.random() * 70) | 0);
        this.fires.add(i);
        return true;
    }
    extinguish(i) {
        const w = this.sim.world;
        if (w.fire[i]) { w.fire[i] = 0; this.fires.delete(i); }
    }
    // Frost: ground turns to tundra, trees to firs, flames and lava die out.
    freeze(i) {
        const w = this.sim.world, t = w.terrain[i];
        this.extinguish(i);
        if (t === T.LAVA) w.setTerrain(i, T.ROCK);
        else if (t === T.GRASS || t === T.SAVANNA || t === T.SAND || t === T.SOIL || t === T.SWAMP || t === T.ASH || t === T.DESERT) w.setTerrain(i, T.SNOW);
        if (w.tree[i] && w.tree[i] !== TREE.SNOWPINE && w.terrain[i] === T.SNOW) w.setTree(i, TREE.SNOWPINE);
    }
    isRaining() { return this.weather.type !== 'clear' && this.weather.intensity > 0.3; }

    daylight() {
        const p = (this.sim.tick % EP.DAY_TICKS) / EP.DAY_TICKS; // 0 = dawn
        // Long day, short night: bright from 0.05..0.6, dark around 0.8
        const s = Math.sin(p * Math.PI * 2);
        return EP.clamp(s * 1.6 + 0.55, 0, 1);
    }

    update() {
        const sim = this.sim, w = sim.world, rng = sim.rng, tick = sim.tick;
        const raining = this.isRaining();

        // -------- Fire spread & burnout
        if (this.fires.size) {
            const dec = raining ? 9 : 3;
            for (const i of Array.from(this.fires)) {
                if ((i + tick) % 3) continue;
                const f = w.fire[i] - dec;
                const x = i % w.w, y = (i / w.w) | 0;
                // Spread to neighbours, biased downwind.
                for (let k = 0; k < 8; k++) {
                    const dx = DX8[k], dy = DY8[k];
                    const nx = x + dx, ny = y + dy;
                    if (!w.inb(nx, ny)) continue;
                    const j = ny * w.w + nx;
                    if (w.fire[j]) continue;
                    const fl = this.flammability(j);
                    if (!fl) continue;
                    const windBonus = 1 + (dx * this.wind.x + dy * this.wind.y) * 0.6;
                    const p = fl * windBonus * (k > 3 ? 0.5 : 1) * (raining ? 0.15 : 1) * 0.55;
                    if (rng.next() < p) this.ignite(nx, ny);
                }
                if (w.bld[i] >= 0) sim.civ.damageBuilding(w.bld[i], 4, null);
                if (f <= 0) this.burnOut(i);
                else w.fire[i] = f;
            }
        }

        // -------- Random tile ticks (growth, cooling, decay)
        const n = Math.max(60, (w.w * w.h / 260) | 0);
        const growMul = raining ? 3 : 1;
        for (let k = 0; k < n; k++) {
            const i = (rng.next() * w.w * w.h) | 0;
            const t = w.terrain[i];
            const x = i % w.w, y = (i / w.w) | 0;
            switch (t) {
                case T.ASH: if (rng.next() < 0.015 * growMul) w.setTerrain(i, T.SOIL); break;
                case T.SOIL: if (rng.next() < 0.02 * growMul) w.setTerrain(i, T.GRASS); break;
                case T.LAVA: {
                    let nearWater = false;
                    for (let d = 0; d < 4; d++) {
                        const nx = x + DX8[d], ny = y + DY8[d];
                        if (w.inb(nx, ny) && TERRAIN[w.terrain[ny * w.w + nx]].water) nearWater = true;
                        if (rng.next() < 0.15) this.ignite(nx, ny);
                    }
                    if (nearWater || rng.next() < (raining ? 0.05 : 0.006)) w.setTerrain(i, T.ROCK);
                    if (nearWater) sim.fx.burst(x + 0.5, y + 0.5, 4, { color: '#dddddd', speed: 0.03, life: 40, rise: 0.02, size: 1.5 });
                    break;
                }
                // Abandoned roads slowly return to nature (highways between towns decay slowly).
                case T.ROAD: if (w.owner[i] < 0 && rng.next() < 0.004) w.setTerrain(i, T.GRASS); break;
                case T.PAVED: if (w.owner[i] < 0 && rng.next() < 0.002) w.setTerrain(i, T.ROAD); break;
                case T.FARM: if (w.owner[i] < 0 && rng.next() < 0.06) w.setTerrain(i, T.GRASS); break;
            }
            // Forest spread
            if (!w.tree[i] && w.bld[i] < 0 && TERRAIN[t].grow && !w.fire[i]) {
                let nb = 0;
                if (x > 0 && w.tree[i - 1]) nb++;
                if (x < w.w - 1 && w.tree[i + 1]) nb++;
                if (y > 0 && w.tree[i - w.w]) nb++;
                if (y < w.h - 1 && w.tree[i + w.w]) nb++;
                const owned = w.owner[i] >= 0 ? 0.35 : 1;
                const p = (0.0015 + nb * 0.022) * growMul * owned * (nb >= 4 ? 0.2 : 1);
                if (rng.next() < p) w.setTree(i, EP.treeFor(t, rng.next()));
            }
        }

        // -------- Weather
        const wt = this.weather;
        wt.timer--;
        const target = wt.type === 'clear' ? 0 : wt.type === 'storm' ? 1 : 0.7;
        wt.intensity += (target - wt.intensity) * 0.01;
        if (wt.timer <= 0) {
            const r = rng.next();
            if (wt.type !== 'clear') { wt.type = 'clear'; wt.timer = rng.int(1800, 3600); }
            else if (r < 0.7) { wt.type = 'rain'; wt.timer = rng.int(600, 1200); }
            else { wt.type = 'storm'; wt.timer = rng.int(450, 900); }
            const a = rng.next() * Math.PI * 2;
            this.wind = { x: Math.cos(a), y: Math.sin(a) };
            sim.emit('weather', wt.type);
        }
        if (wt.type === 'storm' && wt.intensity > 0.6 && rng.next() < 0.012) {
            const x = rng.int(0, w.w - 1), y = rng.int(0, w.h - 1);
            if (w.isLandI(w.idx(x, y))) sim.powers.lightning(x + 0.5, y + 0.5, true);
        }
        if (raining && this.fires.size && tick % 10 === 0) {
            for (const i of this.fires) if (rng.next() < 0.05 * wt.intensity) this.extinguish(i);
        }

        // -------- Player rain clouds
        for (let c = this.clouds.length - 1; c >= 0; c--) {
            const cl = this.clouds[c];
            cl.x += this.wind.x * 0.02; cl.y += this.wind.y * 0.02;
            cl.life--;
            if (tick % 4 === 0) {
                const r = cl.r;
                for (let k = 0; k < 20; k++) {
                    const a = rng.next() * Math.PI * 2, d = Math.sqrt(rng.next()) * r;
                    const x = (cl.x + Math.cos(a) * d) | 0, y = (cl.y + Math.sin(a) * d) | 0;
                    if (!w.inb(x, y)) continue;
                    const i = w.idx(x, y), t = w.terrain[i];
                    this.extinguish(i);
                    if (t === T.LAVA) w.setTerrain(i, T.ROCK);
                    else if (t === T.ASH && rng.next() < 0.3) w.setTerrain(i, T.SOIL);
                    else if ((t === T.SOIL || t === T.DESERT) && rng.next() < 0.15) w.setTerrain(i, T.GRASS);
                    else if (!w.tree[i] && w.bld[i] < 0 && TERRAIN[t].grow && rng.next() < 0.02) w.setTree(i, EP.treeFor(t, rng.next()));
                }
            }
            if (cl.life <= 0) this.clouds.splice(c, 1);
        }
    }

    burnOut(i) {
        const w = this.sim.world;
        w.fire[i] = 0; this.fires.delete(i);
        const t = w.terrain[i];
        if (w.tree[i]) w.setTree(i, 0);
        if (t === T.BRIDGE) { w.setTerrain(i, T.SHALLOW); return; }
        if (t === T.GRASS
 || t === T.SAVANNA || t === T.FARM || t === T.SWAMP || t === T.SOIL) w.setTerrain(i, T.ASH);
        else w.touch(i);
    }
}
const DX8 = [1, -1, 0, 0, 1, 1, -1, -1], DY8 = [0, 0, 1, -1, 1, -1, 1, -1];
EP.DX8 = DX8; EP.DY8 = DY8;
EP.Environment = Environment;
})();
