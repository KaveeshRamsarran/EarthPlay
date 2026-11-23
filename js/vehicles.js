/* EarthPlay — vehicles: fishing boats, transports, trade ships and merchant carts. DOM-free. */
(function () {
'use strict';
const EP = globalThis.EP;
const { T, TERRAIN } = EP;

// speed: tiles per tick. sea: sails on open water (else rolls over land).
EP.VEHICLES = {
    fishing:   { name: 'Fishing boat', speed: 0.045, hp: 40, sea: true },
    transport: { name: 'Transport ship', speed: 0.05, hp: 140, sea: true, seats: 8 },
    trade:     { name: 'Trade ship', speed: 0.048, hp: 90, sea: true },
    cart:      { name: 'Trade cart', speed: 0.04, hp: 60, sea: false },
};

class VehicleSystem {
    constructor(sim) {
        this.sim = sim;
        this.list = []; this.map = new Map(); this.next = 1;
    }

    // ------------------------------------------------------------ creation
    spawn(type, k, city, home, x, y, extra) {
        const d = EP.VEHICLES[type];
        const v = Object.assign({
            id: this.next++, type, kingdomId: k.id, cityId: city.id, home: home.id, x, y, px: x, py: y,
            face: 1, path: null, pi: 0, state: 'idle', t: 0, cargo: null, pass: [], expect: [], hp: d.hp, maxHp: d.hp, job: null,
        }, extra || {});
        this.list.push(v); this.map.set(v.id, v);
        return v;
    }
    remove(v, how) {
        if (!this.map.has(v.id)) return;
        const sim = this.sim;
        this.map.delete(v.id);
        v.dead = true;
        // Anyone aboard swims for the nearest shore — or drowns.
        for (const id of v.pass) {
            const u = sim.unitMap.get(id);
            if (!u || u.dead) continue;
            u.boarded = 0; u.task = null; u.state = 'idle';
            const spot = this.shoreNear(v.x, v.y, 3);
            if (spot && how !== 'sunk') { u.x = spot.x; u.y = spot.y; }
            else EP.Units.kill(sim, u, 'drowned', null);
        }
        v.pass = [];
        if (how === 'sunk' || how === 'wrecked') {
            sim.fx.burst(v.x, v.y - 0.3, 14, { colors: ['#7f5e36', '#b0864f', '#dff1fa'], speed: 0.06, life: 40, grav: 0.004, size: 1.5 });
            sim.emit('sfx', { name: 'collapse', x: v.x, y: v.y });
        }
    }
    shoreNear(x, y, r) {
        const w = this.sim.world;
        for (let d = 0; d <= r; d++) for (let k = 0; k < 8; k++) {
            const nx = Math.floor(x + EP.DX8[k] * d), ny = Math.floor(y + EP.DY8[k] * d);
            if (w.walkable(nx, ny) && !EP.isWaterT(w.t(nx, ny))) return { x: nx + 0.5, y: ny + 0.5 };
        }
        return null;
    }
    count(homeId, type) { let n = 0; for (const v of this.list) if (!v.dead && v.home === homeId && (!type || v.type === type)) n++; return n; }
    activeFrom(homeId) { return this.list.some(v => !v.dead && v.home === homeId && (v.type === 'cart' || v.type === 'trade')); }
    // A transport waiting at these docks (reused), or a new one.
    transportAt(dock, k, city) {
        const civ = this.sim.civ;
        const water = civ.dockWater(dock);
        if (water < 0) return null;
        let v = this.list.find(o => !o.dead && o.type === 'transport' && o.home === dock.id && o.state === 'idle');
        if (!v) {
            if (k.wood < 20) return null;
            k.wood -= 20;
            const w = this.sim.world;
            v = this.spawn('transport', k, city, dock, water % w.w + 0.5, ((water / w.w) | 0) + 0.5);
        }
        v.state = 'wait'; v.t = 0; v.pass = []; v.expect = [];
        return v;
    }
    board(v, u) {
        if (v.pass.length >= EP.VEHICLES[v.type].seats) { u.task = null; return; }
        v.pass.push(u.id);
        u.boarded = v.id; u.state = 'ride'; u.tx = null; u.carry = null;
        u.x = v.x; u.y = v.y;
    }

    // Keep each port's fishing fleet stocked.
    manageFleet(c, k) {
        const civ = this.sim.civ, w = this.sim.world;
        for (const dock of civ.builtIn(c, 'docks')) {
            const water = civ.dockWater(dock);
            if (water < 0) continue;
            const want = 1 + (k.age >= 2 ? 1 : 0) + (c.pop >= 40 ? 1 : 0);
            if (this.count(dock.id, 'fishing') < want && k.wood >= 12) {
                k.wood -= 12;
                const v = this.spawn('fishing', k, c, dock, water % w.w + 0.5, ((water / w.w) | 0) + 0.5);
                v.state = 'dock'; v.t = 60;
            }
        }
    }
    spawnCart(market, k, c, destB, dist) {
        const civ = this.sim.civ, w = this.sim.world;
        const a = civ.door(market), b = civ.door(destB);
        const cost = i => { const t = w.terrain[i]; if (!TERRAIN[t].walk || t === T.SHALLOW && !EP.isRoadT(t)) return t === T.SHALLOW ? 8 : -1; return EP.isRoadT(t) ? 0.3 : 1 + (w.tree[i] ? 0.5 : 0); };
        const path = EP.findPath(w, w.idx(a.x, a.y), w.idx(b.x, b.y), cost, 9000);
        if (!path || path.length < 4) return null;
        const v = this.spawn('cart', k, c, market, a.x + 0.5, a.y + 0.5, { dest: destB.id, dist });
        v.path = path; v.pi = 0; v.state = 'go';
        v.cargo = { type: this.sim.rng.pick(['wood', 'stone', 'food', 'gold', 'iron', 'copper']) };
        return v;
    }
    spawnTradeShip(market, dock, k, c, destDock, dist) {
        const civ = this.sim.civ, w = this.sim.world;
        const a = civ.dockWater(dock), b = civ.dockWater(destDock);
        if (a < 0 || b < 0) return null;
        const path = this.seaPath(a, b);
        if (!path) return null;
        const v = this.spawn('trade', k, c, market, a % w.w + 0.5, ((a / w.w) | 0) + 0.5, { dest: destDock.id, dist, port: dock.id });
        v.path = path; v.pi = 0; v.state = 'go';
        return v;
    }
    seaPath(a, b, maxNodes = 16000) {
        const w = this.sim.world, ter = w.terrain;
        return EP.findPath(w, a, b, i => ter[i] === T.DEEP ? 1 : ter[i] === T.SHALLOW ? 1.6 : -1, maxNodes);
    }
    landPath(a, b) {
        const w = this.sim.world;
        return EP.findPath(w, a, b, i => { const t = w.terrain[i]; return !TERRAIN[t].walk ? -1 : EP.isRoadT(t) ? 0.3 : t === T.SHALLOW ? 6 : 1; }, 9000);
    }

    // ------------------------------------------------------------ per tick
    update() {
        if (!this.list.length) return;
        for (const v of this.list) if (!v.dead) this.updateOne(v);
        if (this.list.some(v => v.dead)) this.list = this.list.filter(v => !v.dead);
    }
    homeOk(v) {
        const civ = this.sim.civ, b = civ.buildings.get(v.home);
        const k = civ.kingdoms.get(v.kingdomId);
        if (!k || !k.alive) return false;
        if (!b) return v.state === 'go' || v.state === 'sail'; // finish the voyage, then vanish
        const bk = civ.buildingKingdom(b);
        return !!bk && bk.id === v.kingdomId;
    }
    updateOne(v) {
        const sim = this.sim, w = sim.world, d = EP.VEHICLES[v.type];
        v.px = v.x; v.py = v.y; v.moving = false;
        if (v.hitT > 0) v.hitT--;
        const ti = w.idx(v.x | 0, v.y | 0), t = w.terrain[ti];
        // The ground (or sea) changed under us.
        if (d.sea ? !EP.isWaterT(t) : !TERRAIN[t].walk) { this.remove(v, 'wrecked'); return; }
        if (!d.sea && (w.fire[ti] || t === T.LAVA)) { v.hp -= 1; if (v.hp <= 0) { this.remove(v, 'wrecked'); return; } }
        if (!this.homeOk(v)) { this.remove(v, v.pass.length ? 'abandoned' : 'sunk'); return; }
        // Carry passengers along.
        for (const id of v.pass) { const u = sim.unitMap.get(id); if (u) { u.x = v.x; u.y = v.y; u.px = v.x; u.py = v.y; } }
        if (v.pass.length && (sim.tick + v.id) % 30 === 0) v.pass = v.pass.filter(id => { const u = sim.unitMap.get(id); return u && !u.dead; });
        if (d.sea && v.moving !== false && (sim.tick + v.id) % 14 === 0 && v.path) sim.fx.burst(v.x - v.face * 0.6, v.y, 1, { color: '#e8f6ff', speed: 0.01, life: 26, size: 1 });

        switch (v.type) {
            case 'fishing': this.fishingAI(v); break;
            case 'transport': this.transportAI(v); break;
            default: this.tradeAI(v);
        }
    }
    // Follow the path. Returns 1 arrived, 0 moving, -1 blocked.
    follow(v) {
        const w = this.sim.world, d = EP.VEHICLES[v.type];
        if (!v.path || v.pi >= v.path.length) return 1;
        const i = v.path[v.pi];
        const t = w.terrain[i];
        if (d.sea ? !EP.isWaterT(t) : !TERRAIN[t].walk) return -1;
        const tx = i % w.w + 0.5, ty = ((i / w.w) | 0) + 0.5;
        const dx = tx - v.x, dy = ty - v.y, dist = Math.hypot(dx, dy);
        let sp = d.speed;
        if (!d.sea) sp *= TERRAIN[w.terrain[w.idx(v.x | 0, v.y | 0)]].slow;
        if (dist <= sp) { v.x = tx; v.y = ty; v.pi++; return v.pi >= v.path.length ? 1 : 0; }
        v.x += dx / dist * sp; v.y += dy / dist * sp; v.moving = true;
        if (dx > 0.05) v.face = 1; else if (dx < -0.05) v.face = -1;
        return 0;
    }
    goTo(v, goal) {
        const w = this.sim.world, d = EP.VEHICLES[v.type];
        const here = w.idx(v.x | 0, v.y | 0);
        if (here === goal) { v.path = [goal]; v.pi = 0; return true; }
        const p = d.sea ? this.seaPath(here, goal) : this.landPath(here, goal);
        v.path = p; v.pi = 0;
        return !!p;
    }

    fishingAI(v) {
        const sim = this.sim, w = sim.world, civ = sim.civ;
        const dock = civ.buildings.get(v.home);
        const home = dock ? civ.dockWater(dock) : -1;
        if (home < 0) { this.remove(v, 'sunk'); return; }
        switch (v.state) {
            case 'dock':
                if (--v.t <= 0) {
                    const wb = w.waterbody[home], hx = home % w.w, hy = (home / w.w) | 0;
                    for (let a = 0; a < 20; a++) {
                        const ang = sim.rng.next() * Math.PI * 2, r = 4 + sim.rng.next() * 10;
                        const x = (hx + Math.cos(ang) * r) | 0, y = (hy + Math.sin(ang) * r) | 0;
                        if (!w.inb(x, y) || w.waterbody[w.idx(x, y)] !== wb) continue;
                        const p = this.seaPath(w.idx(v.x | 0, v.y | 0), w.idx(x, y), 3000);
                        if (p) { v.path = p; v.pi = 0; v.state = 'go'; break; }
                    }
                    if (v.state === 'dock') v.t = 200;
                }
                break;
            case 'go': { const r = this.follow(v); if (r === 1) { v.state = 'fish'; v.t = 200 + sim.rng.int(0, 120); } else if (r === -1) v.state = 'back0'; break; }
            case 'fish': {
                if ((sim.tick + v.id) % 40 === 0) sim.fx.burst(v.x + v.face * 0.8, v.y + 0.1, 2, { color: '#9fd3ff', speed: 0.02, life: 18, rise: 0.01, size: 1 });
                if (--v.t <= 0) {
                    const k = civ.kingdoms.get(v.kingdomId);
                    v.cargo = { type: 'food', amt: 14 + (k ? k.age * 3 : 0) };
                    v.state = 'back0';
                }
                break;
            }
            case 'back0': if (this.goTo(v, home)) v.state = 'back'; else { this.remove(v, 'sunk'); } break;
            case 'back': {
                const r = this.follow(v);
                if (r === 1) {
                    const k = civ.kingdoms.get(v.kingdomId);
                    if (k && v.cargo) { k.food += v.cargo.amt; }
                    v.cargo = null; v.state = 'dock'; v.t = 120 + sim.rng.int(0, 120);
                } else if (r === -1) v.state = 'back0';
                break;
            }
        }
    }

    transportAI(v) {
        const sim = this.sim, w = sim.world, civ = sim.civ;
        switch (v.state) {
            case 'idle': break;
            case 'wait': {
                v.t++;
                const pending = v.expect.filter(id => { const u = sim.unitMap.get(id); return u && !u.dead && !u.boarded && u.task && u.task.kind === 'board' && u.task.vid === v.id; });
                if (v.pass.length && (!pending.length || v.t > 900)) {
                    if (v.job && this.goTo(v, v.job.water)) {
                        v.state = 'sail';
                        sim.emit('sfx', { name: 'whoosh', x: v.x, y: v.y, quiet: true });
                    } else this.unloadAt(v, null);
                } else if (!v.pass.length && (v.t > 1500 || (!pending.length && v.t > 60))) { v.state = 'idle'; v.job = null; }
                break;
            }
            case 'sail': {
                const r = this.follow(v);
                if (r === 1) {
                    const job = v.job;
                    const pass = this.unloadAt(v, job.land);
                    civ.onLanded(v, pass);
                    v.state = 'return';
                } else if (r === -1) { if (!this.goTo(v, v.job.water)) this.remove(v, 'wrecked'); }
                break;
            }
            case 'return': {
                const dock = civ.buildings.get(v.home);
                const home = dock ? civ.dockWater(dock) : -1;
                if (home < 0 || !this.goTo(v, home)) { this.remove(v, 'sunk'); return; }
                v.state = 'homeward';
                break;
            }
            case 'homeward': { const r = this.follow(v); if (r === 1) { v.state = 'idle'; v.job = null; } else if (r === -1) v.state = 'return'; break; }
        }
    }
    unloadAt(v, land) {
        const sim = this.sim;
        const out = [];
        const spot = land || this.shoreNear(v.x, v.y, 3) || { x: v.x, y: v.y };
        for (const id of v.pass) {
            const u = sim.unitMap.get(id);
            if (!u || u.dead) continue;
            u.boarded = 0;
            u.x = spot.x + sim.rng.float(-0.3, 0.3); u.y = spot.y + sim.rng.float(-0.3, 0.3);
            if (!EP.Units.passable(sim, u, u.x, u.y)) { u.x = spot.x; u.y = spot.y; }
            u.px = u.x; u.py = u.y; u.state = 'idle'; u.task = null; u.tx = null;
            out.push(u);
        }
        v.pass = []; v.expect = [];
        return out;
    }

    // Carts and trade ships: out to the partner, trade, come home, done.
    tradeAI(v) {
        const sim = this.sim, w = sim.world, civ = sim.civ;
        switch (v.state) {
            case 'go': {
                const r = this.follow(v);
                if (r === 1) { civ.onTrade(v); v.state = 'back0'; v.t = 40; }
                else if (r === -1) v.state = 'back0';
                break;
            }
            case 'back0': {
                if (--v.t > 0) break;
                const b = civ.buildings.get(v.type === 'trade' ? v.port : v.home);
                if (!b) { this.remove(v); return; }
                const goal = v.type === 'trade' ? civ.dockWater(b) : (() => { const p = civ.door(b); return w.idx(p.x, p.y); })();
                if (goal < 0 || !this.goTo(v, goal)) { this.remove(v); return; }
                v.state = 'back';
                break;
            }
            case 'back': {
                const r = this.follow(v);
                if (r === 1) this.remove(v);
                else if (r === -1) { v.t = 0; v.state = 'back0'; }
                break;
            }
            default: this.remove(v);
        }
    }

    // Explosions, dragonfire and lightning hurt ships and carts too.
    damageAt(x, y, r, amt) {
        for (const v of this.list) {
            if (v.dead || Math.hypot(v.x - x, v.y - y) > r) continue;
            v.hp -= amt; v.hitT = 6;
            if (v.hp <= 0) this.remove(v, EP.VEHICLES[v.type].sea ? 'sunk' : 'wrecked');
        }
    }
    nearest(x, y, r) {
        let best = null, bd = r * r;
        for (const v of this.list) { if (v.dead) continue; const d = EP.dist2(v.x, v.y - 0.3, x, y); if (d < bd) { bd = d; best = v; } }
        return best;
    }
}
EP.VehicleSystem = VehicleSystem;
})();
