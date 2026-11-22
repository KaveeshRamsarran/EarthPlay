/* Headless simulation test. Run with:  node tests/sim.test.js
 * Generates worlds, runs thousands of ticks, fires every tool, checks invariants, round-trips a save. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..', 'js');
for (const f of ['core.js', 'data.js', 'world.js', 'units.js', 'civ.js', 'powers.js', 'sim.js', 'save.js'])
    vm.runInThisContext(fs.readFileSync(path.join(root, f), 'utf8'), { filename: f });
const EP = globalThis.EP;

let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.error('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

function invariants(sim, label) {
    const w = sim.world;
    let bad = 0;
    for (const u of sim.units) {
        if (u.dead) bad++;
        if (!Number.isFinite(u.x) || !Number.isFinite(u.y) || !Number.isFinite(u.hp)) bad++;
        if (u.x < 0 || u.y < 0 || u.x > w.w || u.y > w.h) bad++;
        if (u.kingdomId >= 0 && !sim.civ.kingdoms.has(u.kingdomId)) bad++;
    }
    check(bad === 0, `${label}: units valid (${sim.units.length})`);
    let bb = 0;
    for (const b of sim.civ.buildings.values()) {
        if (!sim.civ.cities.has(b.cityId)) bb++;
        for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) if (w.bld[w.idx(x, y)] !== b.id) bb++;
    }
    check(bb === 0, `${label}: buildings consistent (${sim.civ.buildings.size})`);
    let cb = 0;
    for (const c of sim.civ.cities.values()) {
        const k = sim.civ.kingdoms.get(c.kingdomId);
        if (!k || !k.alive || !k.cities.includes(c.id)) cb++;
    }
    for (const k of sim.civ.kingdoms.values()) if (k.alive) for (const id of k.cities) if (!sim.civ.cities.has(id)) cb++;
    check(cb === 0, `${label}: kingdoms/cities consistent (${sim.civ.aliveKingdoms().length} realms, ${sim.civ.cities.size} towns)`);
}

(async () => {
    for (const shape of ['continent', 'pangaea', 'archipelago', 'lakes']) {
        console.log(`\n[${shape}] medium world`);
        const t0 = Date.now();
        const sim = new EP.Sim({ size: 'medium', shape, seed: 12345, life: 'civ' });
        const land = sim.world.terrain.reduce((n, t) => n + (t > 1 ? 1 : 0), 0) / sim.world.terrain.length;
        check(land > 0.15 && land < 0.95, `land ratio ${(land * 100).toFixed(0)}% (gen ${Date.now() - t0}ms)`);
        check(sim.civ.aliveKingdoms().length >= 2, `starting realms: ${sim.civ.aliveKingdoms().length}`);
        const t1 = Date.now();
        const TICKS = 9000;
        for (let i = 0; i < TICKS; i++) sim.update();
        const dt = Date.now() - t1;
        console.log(`  ${TICKS} ticks in ${dt}ms (${(dt / TICKS).toFixed(2)} ms/tick), year ${sim.year}`);
        const pop = sim.census();
        console.log('  population:', JSON.stringify(pop));
        for (const k of sim.civ.aliveKingdoms()) console.log(`   - ${k.name} (${k.race}) pop ${k.pop} towns ${k.cities.length} ${EP.AGES[k.age].name} food ${k.food | 0} wood ${k.wood | 0} stone ${k.stone | 0} wars ${Object.keys(k.wars).length}`);
        invariants(sim, shape);
        const civPop = EP.CIV_RACES.reduce((s, r) => s + (pop[r] || 0), 0);
        check(civPop > 30, `civilisations grew (civ pop ${civPop})`);
        check(sim.civ.buildings.size > 10, `towns built things (${sim.civ.buildings.size} buildings)`);
        const types = {};
        for (const b of sim.civ.buildings.values()) types[b.type] = (types[b.type] || 0) + 1;
        console.log('  buildings:', JSON.stringify(types));
        console.log('  log tail:'); for (const e of sim.logEntries.slice(-6)) console.log(`    y${e.year}: ${e.text}`);
    }

    console.log('\n[tools] every tool on a live world');
    const sim = new EP.Sim({ size: 'small', shape: 'pangaea', seed: 777, life: 'civ' });
    for (let i = 0; i < 1500; i++) sim.update();
    const c = [...sim.civ.cities.values()][0];
    let errors = 0;
    for (const tool of EP.TOOLS) {
        try {
            const x = c ? c.x + 3 : sim.world.w / 2, y = c ? c.y + 3 : sim.world.h / 2;
            sim.powers.apply(tool.id, x, y, 4);
            for (let i = 0; i < 40; i++) sim.update();
        } catch (e) { errors++; console.error(`  ✗ tool ${tool.id}: ${e.stack}`); }
    }
    check(errors === 0, `all ${EP.TOOLS.length} tools applied without errors`);
    for (let i = 0; i < 3000; i++) sim.update();
    invariants(sim, 'after tools');

    console.log('\n[species] every creature spawns and lives');
    {
        const zoo = new EP.Sim({ size: 'small', shape: 'pangaea', seed: 4242, life: 'wild', disasters: 'often' });
        const wild = EP.WILD.filter(s => !(zoo.speciesCount[s] > 0));
        check(wild.length <= 3, `wildlife seeded in habitats (${EP.WILD.length - wild.length}/${EP.WILD.length}${wild.length ? ', missing ' + wild.join(' ') : ''})`);
        const w = zoo.world;
        let land = null, sea = null;
        for (let i = 0; i < w.w * w.h && (!land || !sea); i++) {
            const t = w.terrain[i];
            if (!land && t === EP.T.GRASS) land = { x: i % w.w + 0.5, y: ((i / w.w) | 0) + 0.5 };
            if (!sea && t === EP.T.DEEP) sea = { x: i % w.w + 0.5, y: ((i / w.w) | 0) + 0.5 };
        }
        let errs = 0, made = 0;
        for (const s of Object.keys(EP.SPECIES)) {
            const at = EP.SPECIES[s].kind === 'aquatic' ? sea : land;
            if (!at) continue;
            try { if (zoo.powers.spawn(s, at.x, at.y)) made++; } catch (e) { errs++; console.error(`  ✗ spawn ${s}: ${e.stack}`); }
        }
        check(made >= Object.keys(EP.SPECIES).length - 2, `spawned ${made}/${Object.keys(EP.SPECIES).length} species by hand`);
        try {
            zoo.powers.apply('madness', land.x, land.y, 4);
            zoo.powers.apply('blizzard', land.x + 3, land.y, 3);
            for (let i = 0; i < 4000; i++) zoo.update();
        } catch (e) { errs++; console.error('  ✗ zoo sim: ' + e.stack); }
        check(errs === 0, 'mixed ecosystem runs without errors');
        invariants(zoo, 'zoo');
        const pop = zoo.census();
        console.log('  census:', JSON.stringify(pop));
        console.log('  events:'); for (const e of zoo.logEntries.slice(-5)) console.log(`    y${e.year}: ${e.text}`);
        check(zoo.units.every(u => !(u.madT > 0) || u.traits.includes('mad')), 'madness state consistent');
    }

    console.log('\n[save] round trip');
    const packed = await EP.Save.pack(sim);
    const back = await EP.Save.unpack(packed);
    check(back.units.length === sim.units.length, `units restored (${back.units.length}) — ${(packed.length / 1024).toFixed(0)} KB packed`);
    check(back.civ.kingdoms.size === sim.civ.kingdoms.size && back.civ.buildings.size === sim.civ.buildings.size, 'civ restored');
    check(back.world.terrain.every((t, i) => t === sim.world.terrain[i]), 'terrain identical');
    for (let i = 0; i < 1000; i++) back.update();
    invariants(back, 'loaded world continues');

    console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
    process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
