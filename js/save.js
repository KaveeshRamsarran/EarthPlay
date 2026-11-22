/* EarthPlay — save/load: compact serialisation, gzip compression, local slots and file export. */
(function () {
'use strict';
const EP = globalThis.EP;
const VERSION = 2;

function toB64(u8) {
    if (typeof Buffer !== 'undefined') return Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength).toString('base64');
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
}
function fromB64(str) {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(str, 'base64'));
    const s = atob(str), u8 = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    return u8;
}
const bytes = ta => new Uint8Array(ta.buffer, ta.byteOffset, ta.byteLength);

const VOLATILE = new Set(['px', 'py', 'moving', 'stuck', 'lastD', 'detour', 'detourT', 'hitT']);

const Save = EP.Save = {
    serialize(sim) {
        const w = sim.world;
        const units = [];
        for (const u of sim.units) {
            if (u.dead) continue;
            const o = {};
            for (const k in u) if (!VOLATILE.has(k)) o[k] = u[k];
            units.push(o);
        }
        const strip = c => { const o = Object.assign({}, c); delete o.members; return o; };
        return {
            v: VERSION, opts: sim.opts, seed: sim.seed, tick: sim.tick, rng: sim.rng.state, nextUnitId: sim.nextUnitId,
            world: {
                w: w.w, h: w.h,
                terrain: toB64(w.terrain), height: toB64(w.height), tree: toB64(w.tree), fire: toB64(w.fire), wear: toB64(w.wear),
                owner: toB64(bytes(w.owner)), bld: toB64(bytes(w.bld)),
            },
            units,
            civ: {
                kingdoms: [...sim.civ.kingdoms.values()], cities: [...sim.civ.cities.values()].map(strip),
                buildings: [...sim.civ.buildings.values()], nextK: sim.civ.nextK, nextC: sim.civ.nextC, nextB: sim.civ.nextB,
            },
            env: { weather: sim.env.weather, wind: sim.env.wind, clouds: sim.env.clouds },
            log: sim.logEntries.slice(-150), history: sim.history,
        };
    },

    deserialize(d) {
        if (!d || !d.world || d.v > VERSION) throw new Error('Unrecognised save format');
        // Worlds saved before disasters existed keep a calm sky.
        const sim = new EP.Sim(Object.assign({ disasters: 'off' }, d.opts, { blank: true, w: d.world.w, h: d.world.h, seed: d.seed }));
        const w = sim.world;
        w.terrain.set(fromB64(d.world.terrain)); w.height.set(fromB64(d.world.height));
        w.tree.set(fromB64(d.world.tree)); w.fire.set(fromB64(d.world.fire)); w.wear.set(fromB64(d.world.wear));
        bytes(w.owner).set(fromB64(d.world.owner)); bytes(w.bld).set(fromB64(d.world.bld));
        for (let i = 0; i < w.fire.length; i++) if (w.fire[i]) sim.env.fires.add(i);
        w.computeLandmasses();
        w.version++; w.ownerVersion++;
        sim.tick = d.tick; sim.rng.state = d.rng; sim.nextUnitId = d.nextUnitId;
        for (const o of d.units) {
            const u = Object.assign(Object.create(EP.Unit.prototype), o);
            u.px = u.x; u.py = u.y; u.moving = false; u.stuck = 0; u.lastD = Infinity; u.detour = 0; u.detourT = 0; u.hitT = 0;
            sim.units.push(u); sim.unitMap.set(u.id, u);
            sim.speciesCount[u.species] = (sim.speciesCount[u.species] || 0) + 1;
            if (u.kind === 'civ') sim.civCount = (sim.civCount || 0) + 1;
        }
        const civ = sim.civ;
        for (const k of d.civ.kingdoms) { civ.kingdoms.set(k.id, k); civ.usedNames.add(k.name); }
        for (const c of d.civ.cities) { c.members = []; civ.cities.set(c.id, c); }
        for (const b of d.civ.buildings) civ.buildings.set(b.id, b);
        civ.nextK = d.civ.nextK; civ.nextC = d.civ.nextC; civ.nextB = d.civ.nextB;
        for (const u of sim.units) if (u.task && u.task.i != null && u.task.kind === 'chop') civ.reserved.set(u.task.i, u.id);
        if (d.env) { Object.assign(sim.env.weather, d.env.weather); sim.env.wind = d.env.wind || sim.env.wind; sim.env.clouds = d.env.clouds || []; }
        sim.logEntries = d.log || []; sim.history = d.history || [];
        civ.census();
        return sim;
    },

    async compress(str) {
        if (typeof CompressionStream === 'undefined') return 'raw:' + str;
        const stream = new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'));
        return 'gz:' + toB64(new Uint8Array(await new Response(stream).arrayBuffer()));
    },
    async decompress(s) {
        if (s.startsWith('raw:')) return s.slice(4);
        if (!s.startsWith('gz:')) return s;
        const stream = new Blob([fromB64(s.slice(3))]).stream().pipeThrough(new DecompressionStream('gzip'));
        return await new Response(stream).text();
    },
    async pack(sim) { return Save.compress(JSON.stringify(Save.serialize(sim))); },
    async unpack(s) { return Save.deserialize(JSON.parse(await Save.decompress(s))); },

    // ---------------------------------------------------------------- local slots (browser only)
    SLOTS: ['auto', '1', '2', '3', '4', '5'],
    meta(slot) {
        try { return JSON.parse(localStorage.getItem('earthplay.meta.' + slot) || 'null'); } catch (e) { return null; }
    },
    async store(slot, sim, thumb) {
        const data = await Save.pack(sim);
        const pop = sim.units.filter(u => u.kind === 'civ').length;
        const meta = {
            slot, year: sim.year, pop, kingdoms: sim.civ.aliveKingdoms().length, date: Date.now(),
            size: `${sim.world.w}×${sim.world.h}`, seed: sim.seed, thumb: thumb || null, bytes: data.length,
        };
        try {
            localStorage.setItem('earthplay.slot.' + slot, data);
            localStorage.setItem('earthplay.meta.' + slot, JSON.stringify(meta));
        } catch (e) {
            throw new Error('Browser storage is full. Delete an old save or use Export instead.');
        }
        return meta;
    },
    async load(slot) {
        const s = localStorage.getItem('earthplay.slot.' + slot);
        if (!s) throw new Error('That slot is empty.');
        return Save.unpack(s);
    },
    remove(slot) {
        localStorage.removeItem('earthplay.slot.' + slot);
        localStorage.removeItem('earthplay.meta.' + slot);
    },
    async exportFile(sim) {
        const data = await Save.pack(sim);
        const blob = new Blob([data], { type: 'application/octet-stream' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `earthplay-year${sim.year}-${sim.seed}.world`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    },
    async importFile(file) { return Save.unpack(await file.text()); },
};
})();
