/* EarthPlay — creatures: movement/steering, wildlife & monster AI, combat, levelling, disease, frost & madness. */
(function () {
'use strict';
const EP = globalThis.EP;
const { T, TERRAIN, SPECIES, TRAITS } = EP;

class Unit {
    constructor(sim, id, species, x, y, opts = {}) {
        const sp = SPECIES[species];
        this.id = id; this.species = species; this.kind = sp.kind;
        this.x = x; this.y = y; this.px = x; this.py = y;
        this.tx = null; this.ty = null;
        this.face = sim.rng.chance(0.5) ? 1 : -1; this.moving = false;
        this.age = opts.age != null ? opts.age : sp.adult + sim.rng.float(0, 4);
        this.traits = opts.traits ? opts.traits.slice() : [];
        if (!opts.traits && sp.kind === 'civ') {
            if (sim.rng.chance(0.45)) this.traits.push(sim.rng.pick(EP.RANDOM_TRAITS));
            if (sim.rng.chance(0.004)) this.traits.push('giant');
        }
        this.lifespan = sim.rng.float(sp.life[0], sp.life[1]) * (this.traits.includes('longlife') ? 1.4 : 1);
        this.kingdomId = -1; this.cityId = -1;
        this.job = null; this.state = 'idle'; this.task = null; this.carry = null;
        this.workT = 0; this.atkCd = 0; this.targetId = -1;
        this.lastAttacker = -1; this.lastHitTick = -999; this.hitT = 0;
        this.hunger = 75; this.sick = 0;
        this.kills = 0; this.xp = 0; this.level = 1;
        this.wpn = 0; this.arm = 0; this.boarded = 0; // forged gear tiers (EP.GEAR); vehicle id when aboard
        this.stuck = 0; this.lastD = Infinity; this.detour = 0; this.detourT = 0;
        this.idleT = 0; this.lonely = 0;
        this.name = sp.kind === 'civ' ? EP.Units.makeName(sim.rng, species) : null;
        this.skin = sp.skin ? sim.rng.pick(sp.skin) : null;
        this.hair = sp.hair ? sim.rng.pick(sp.hair) : null;
        this.born = sim.tick;
        EP.Units.recalc(sim, this);
        this.hp = this.hpMax;
    }
    get sp() { return SPECIES[this.species]; }
    get adult() { return this.age >= SPECIES[this.species].adult; }
}
EP.Unit = Unit;

const OFFSETS = [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4, 2.0, -2.0, 2.6, -2.6];
const isLandWalker = sp => !sp.fly && sp.kind !== 'aquatic' && !sp.amphibious;

const Units = EP.Units = {
    makeName(rng, race) {
        const p = EP.UNIT_NAMES[race];
        return rng.pick(p[0]) + rng.pick(p[1]);
    },

    recalc(sim, u) {
        const sp = SPECIES[u.species];
        let hp = sp.hp, atk = sp.atk, speed = sp.speed;
        for (const t of u.traits) {
            const d = TRAITS[t]; if (!d) continue;
            if (d.hp) hp *= d.hp; if (d.atk) atk *= d.atk; if (d.speed) speed *= d.speed;
        }
        const k = u.kingdomId >= 0 ? sim.civ.kingdoms.get(u.kingdomId) : null;
        if (k) { const age = EP.AGES[k.age]; hp *= age.hp; atk *= age.atk; }
        const lv = 1 + (u.level - 1) * 0.12;
        hp *= lv; atk *= lv;
        if (u.wpn) atk *= EP.GEAR[u.wpn].atk;
        if (u.job === 'warrior') { hp *= 1.25; atk *= 1.3; }
        const ratio = u.hpMax ? u.hp / u.hpMax : 1;
        u.hpMax = Math.round(hp); u.atk = atk; u.speed = speed;
        if (u.hp != null) u.hp = Math.max(1, Math.min(u.hpMax, ratio * u.hpMax));
    },

    passable(sim, u, x, y) {
        const w = sim.world;
        if (x < 0 || y < 0 || x >= w.w || y >= w.h) return false;
        const sp = SPECIES[u.species];
        if (sp.fly) return true;
        const t = w.terrain[(y | 0) * w.w + (x | 0)];
        if (sp.kind === 'aquatic') return t === T.DEEP || t === T.SHALLOW;
        if (sp.amphibious) return t === T.SHALLOW || TERRAIN[t].walk;
        return TERRAIN[t].walk;
    },

    // Steer toward (tx,ty). Returns 1 arrived, 0 moving, -1 gave up.
    step(sim, u, tx, ty, mul = 1) {
        const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
        const w = sim.world, spec = SPECIES[u.species];
        let slow = 1;
        if (!spec.fly && spec.kind !== 'aquatic') {
            const t = w.terrain[(u.y | 0) * w.w + (u.x | 0)];
            slow = spec.amphibious && t === T.SHALLOW ? 0.9 : TERRAIN[t].slow;
        }
        const sp = u.speed * mul * slow;
        if (d <= Math.max(sp, 0.12)) { u.stuck = 0; u.lastD = Infinity; return 1; }
        if (d < u.lastD - 0.02) { u.lastD = d; u.stuck = Math.max(0, u.stuck - 2); } else u.stuck++;
        if (u.stuck > 70) { u.stuck = 0; u.lastD = Infinity; u.tx = null; return -1; }
        const s = Math.min(sp, d);
        if (u.detourT <= 0) { // fast path: straight line, no trig
            const c = dx / d, si = dy / d;
            const nx = u.x + c * s, ny = u.y + si * s;
            if (Units.passable(sim, u, nx + c * 0.3, ny + si * 0.3) && Units.passable(sim, u, nx, ny)) {
                u.x = nx; u.y = ny; u.moving = true;
                if (c > 0.2) u.face = 1; else if (c < -0.2) u.face = -1;
                return 0;
            }
        }
        let a = Math.atan2(dy, dx);
        if (u.detourT > 0) { u.detourT--; a += u.detour; }
        for (let k = 0; k < OFFSETS.length; k++) {
            const aa = a + OFFSETS[k];
            const c = Math.cos(aa), si = Math.sin(aa);
            const nx = u.x + c * s, ny = u.y + si * s;
            if (Units.passable(sim, u, nx + c * 0.3, ny + si * 0.3) && Units.passable(sim, u, nx, ny)) {
                u.x = nx; u.y = ny; u.moving = true;
                if (Math.abs(c) > 0.2) u.face = c > 0 ? 1 : -1;
                if (k > 0 && u.detourT <= 0) { u.detour = OFFSETS[k] * 0.6; u.detourT = 10; }
                return 0;
            }
        }
        u.detour = -u.detour; u.detourT = 0;
        return 0;
    },

    setTarget(u, x, y) { u.tx = x; u.ty = y; u.stuck = 0; u.lastD = Infinity; },

    // Pick a reachable random point near (cx,cy).
    wanderTarget(sim, u, cx, cy, r) {
        const w = sim.world, sp = SPECIES[u.species];
        for (let k = 0; k < 6; k++) {
            const x = cx + sim.rng.float(-r, r), y = cy + sim.rng.float(-r, r);
            if (!Units.passable(sim, u, x, y)) continue;
            if (isLandWalker(sp) && !w.sameLand(u.x, u.y, x, y)) continue;
            Units.setTarget(u, x, y);
            return true;
        }
        return false;
    },
    // Wildlife drifts back toward its preferred biome.
    seekHabitat(sim, u) {
        const sp = SPECIES[u.species], w = sim.world;
        if (!sp.habitat) return false;
        const here = w.terrain[(u.y | 0) * w.w + (u.x | 0)];
        if (sp.habitat.includes(here)) return false;
        for (let k = 0; k < 8; k++) {
            const x = u.x + sim.rng.float(-9, 9), y = u.y + sim.rng.float(-9, 9);
            if (!w.inb(x | 0, y | 0) || !sp.habitat.includes(w.terrain[(y | 0) * w.w + (x | 0)])) continue;
            if (!Units.passable(sim, u, x, y) || (isLandWalker(sp) && !w.sameLand(u.x, u.y, x, y))) continue;
            Units.setTarget(u, x, y);
            return true;
        }
        return false;
    },

    moveAlong(sim, u, mul = 1) {
        if (u.tx == null) return 1;
        const r = Units.step(sim, u, u.tx, u.ty, mul);
        if (r !== 0) u.tx = null;
        return r;
    },

    hostile(sim, a, b) {
        if (a === b || a.dead || b.dead) return false;
        const ka = a.kind, kb = b.kind;
        if (a.madT > 0 || b.madT > 0) return ka !== 'aquatic' && kb !== 'aquatic';
        if (ka === 'monster' || kb === 'monster') {
            if (ka === 'monster' && kb === 'monster') return false;
            return kb !== 'aquatic' && ka !== 'aquatic';
        }
        if (ka === 'civ' && kb === 'civ') return a.kingdomId >= 0 && b.kingdomId >= 0 && sim.civ.atWar(a.kingdomId, b.kingdomId);
        return false;
    },

    attack(sim, a, target) {
        const d = Math.hypot(target.x - a.x, target.y - a.y);
        const sp = SPECIES[a.species];
        const ranged = sp.ranged && (a.kind !== 'civ' || a.job === 'warrior' || (a.task && a.task.kind === 'hunt')) ? sp.ranged : 0;
        const reach = ranged ? ranged : 1.05;
        if (d > reach) return false;
        if (a.atkCd > 0) return true;
        a.face = target.x >= a.x ? 1 : -1;
        if (ranged && d > 1.4) {
            const kind = sp.projectile || 'arrow';
            a.atkCd = sp.cd || 32;
            sim.shoot(kind, a.x, a.y - 0.3, target.x, target.y, a.atk * (kind === 'arrow' ? 0.9 : 1), a, target.id);
        } else {
            a.atkCd = 20;
            Units.damage(sim, target, a.atk * sim.rng.float(0.75, 1.25), a);
            if (!target.dead) {
                if (sp.venom && target.kind !== 'monster') target.sick = Math.max(target.sick, 260 + sim.rng.int(0, 200));
                if (sp.frost) Units.freeze(sim, target, 70);
            }
        }
        return true;
    },

    damage(sim, u, amt, attacker, cause) {
        if (u.dead) return;
        if (u.arm) amt *= 1 - EP.GEAR[u.arm].def;
        u.hp -= amt; u.hitT = 6;
        if (attacker) { u.lastAttacker = attacker.id; u.lastHitTick = sim.tick; }
        const sp = SPECIES[u.species];
        const blood = sp.blood !== undefined ? sp.blood : (u.kind === 'monster' ? null : '#b3202a');
        if (blood) sim.fx.burst(u.x, u.y - 0.3, Math.min(6, 1 + (amt / 6) | 0), { color: blood, speed: 0.05, life: 22, grav: 0.006, size: 1 });
        if (u.hp <= 0) Units.kill(sim, u, cause || (attacker ? 'slain' : 'wounds'), attacker);
    },

    freeze(sim, u, ticks) {
        const sp = SPECIES[u.species];
        if (u.dead || sp.frost || sp.fireproof) return;
        if (!(u.frozen > 0)) sim.fx.burst(u.x, u.y - 0.4, 5, { colors: ['#dff4ff', '#9fd8ff', '#ffffff'], speed: 0.04, life: 24, rise: 0.01, size: 1 });
        u.frozen = Math.max(u.frozen || 0, ticks);
        u.tx = null;
        if (u.kind === 'civ') EP.CivAI.release(sim, u);
    },

    madden(sim, u, ticks) {
        if (u.dead || u.kind === 'monster' || u.kind === 'aquatic') return;
        if (!u.traits.includes('mad')) { u.traits.push('mad'); Units.recalc(sim, u); }
        if (u.kind === 'civ') EP.CivAI.release(sim, u);
        u.madT = Math.max(u.madT || 0, ticks);
        u.state = 'idle'; u.task = null; u.targetId = -1; u.tx = null;
        sim.fx.emote(u.x, u.y, 'angry');
    },
    calm(sim, u) {
        u.madT = 0;
        const i = u.traits.indexOf('mad');
        if (i >= 0) { u.traits.splice(i, 1); Units.recalc(sim, u); }
        u.state = 'idle'; u.targetId = -1; u.task = null;
    },

    kill(sim, u, cause, killer) {
        if (u.dead) return;
        u.dead = true; u.cause = cause;
        sim.onUnitDeath(u, killer, cause);
        if (killer && !killer.dead) {
            killer.kills++;
            killer.xp += 10 + u.level * 6 + (u.kind === 'monster' ? 30 : 0);
            while (killer.xp >= killer.level * 35) {
                killer.xp -= killer.level * 35; killer.level++;
                Units.recalc(sim, killer); killer.hp = killer.hpMax;
                sim.fx.text(killer.x, killer.y - 1.2, 'Lv ' + killer.level, '#ffe066');
                if (killer.level === 6 && killer.kind === 'civ') sim.log(`${killer.name} the ${SPECIES[killer.species].name} has become a legendary hero`, { x: killer.x, y: killer.y, type: 'hero', unit: killer.id });
            }
            // Predators & hunters eat their kill
            const food = SPECIES[u.species].food;
            if ((killer.kind === 'animal' || killer.kind === 'aquatic') && food) killer.hunger = Math.min(100, killer.hunger + food * 4 + 20);
            if (killer.kind === 'civ' && food && killer.kingdomId >= 0 && !killer.carry) killer.carry = { type: 'food', amt: Math.ceil(food * 0.6) };
            if (killer.kind === 'monster' && u.kind === 'civ') sim.fx.emote(u.x, u.y, 'skull');
            // Zombie infection
            if (killer.species === 'zombie' && (u.kind === 'civ' || u.kind === 'animal') && sim.rng.chance(SPECIES.zombie.infect)) {
                sim.pending.push(() => {
                    const z = sim.spawnUnit('zombie', u.x, u.y, { age: 0 });
                    if (z) sim.fx.burst(u.x, u.y, 8, { color: '#7fbf3f', speed: 0.04, life: 30, rise: 0.01 });
                });
            }
        }
    },

    // Called each tick for every living unit.
    update(sim, u) {
        u.px = u.x; u.py = u.y; u.moving = false;
        if (u.atkCd > 0) u.atkCd--;
        if (u.hitT > 0) u.hitT--;
        u.age += 1 / EP.TICKS_PER_YEAR;
        if (u.age > u.lifespan) { Units.kill(sim, u, 'old age', null); return; }
        if (u.boarded > 0) { // riding a ship: the vehicle moves us
            if (!sim.vehicles.map.has(u.boarded)) { u.boarded = 0; u.task = null; u.state = 'idle'; }
            else return;
        }


        const w = sim.world;
        const ti = (u.y | 0) * w.w + (u.x | 0);
        const t = w.terrain[ti];
        const sp = SPECIES[u.species];
        if (!sp.fly) {
            if (w.fire[ti] && !sp.fireproof) { Units.damage(sim, u, sp.melt ? 2 : 0.6, null, 'fire'); u.frozen = 0; if (u.dead) return; }
            if (t === T.LAVA && !sp.fireproof) { Units.damage(sim, u, sp.melt ? 12 : 4, null, sp.melt ? 'melted' : 'lava'); sim.fx.burst(u.x, u.y, 1, { color: '#ffb43a', speed: 0.04, life: 20, rise: 0.03 }); if (u.dead) return; }
            if (!Units.passable(sim, u, u.x, u.y)) { Units.rescue(sim, u, t); if (u.dead) return; }
        }
        if (u.sick > 0) {
            u.sick--;
            u.hp -= 0.035;
            if (u.hp <= 0) { Units.kill(sim, u, 'plague', null); return; }
            if ((sim.tick + u.id) % 30 === 0) {
                sim.grid.query(u.x, u.y, 1.8, o => { if (o !== u && !o.sick && o.kind !== 'monster' && o.kind !== 'aquatic' && sim.rng.chance(0.18)) o.sick = 500 + sim.rng.int(0, 400); });
                sim.fx.burst(u.x, u.y - 0.6, 1, { color: '#9be15d', speed: 0.01, life: 30, rise: 0.015, size: 1 });
            }
        }
        if ((sim.tick + u.id) % 20 === 0 && u.hp < u.hpMax && u.traits.length && u.traits.includes('blessed')) u.hp = Math.min(u.hpMax, u.hp + 1);

        // Frozen solid: no thinking, no moving.
        if (u.frozen > 0) {
            u.frozen--;
            if ((sim.tick + u.id) % 40 === 0) Units.damage(sim, u, 1, null, 'frostbite');
            return;
        }
        if (u.madT > 0) {
            if (--u.madT <= 0) Units.calm(sim, u);
            else { Units.madAI(sim, u); return; }
        }

        switch (u.kind) {
            case 'civ': EP.CivAI.update(sim, u); break;
            case 'animal': Units.animalAI(sim, u); break;
            case 'aquatic': Units.aquaticAI(sim, u); break;
            case 'monster':
                switch (u.species) {
                    case 'dragon': Units.dragonAI(sim, u); break;
                    case 'ufo': Units.ufoAI(sim, u); break;
                    default: Units.monsterAI(sim, u);
                }
                break;
        }
    },

    // Unit is standing somewhere it can't be (water painted under it, etc.).
    rescue(sim, u, t) {
        const maxR = t === T.MOUNTAIN ? 6 : 4;
        for (let r = 1; r <= maxR; r++) {
            for (let k = 0; k < 8; k++) {
                const nx = u.x + EP.DX8[k] * r, ny = u.y + EP.DY8[k] * r;
                if (!Units.passable(sim, u, nx, ny)) continue;
                if (t === T.MOUNTAIN) { u.x = nx; u.y = ny; return; } // squeezed out of rock
                u.x += EP.DX8[k] * 0.1; u.y += EP.DY8[k] * 0.1;  // swim toward safety
                r = maxR; break;
            }
        }
        if (t === T.MOUNTAIN) { Units.kill(sim, u, 'crushed', null); return; }
        if (u.kind === 'aquatic') Units.damage(sim, u, 0.3, null, 'stranded');
        else if (EP.TERRAIN[t].water) Units.damage(sim, u, 0.25, null, 'drowned');
    },

    thinking(sim, u, every = 6) { return (sim.tick + u.id) % every === 0; },

    // Chase & strike the current target. Returns false when the fight is over.
    pursue(sim, u, mul = 1, leash = 14) {
        const tgt = sim.unitMap.get(u.targetId);
        if (!tgt || tgt.dead || Math.hypot(tgt.x - u.x, tgt.y - u.y) > leash) { u.state = 'idle'; u.targetId = -1; return false; }
        if (!Units.attack(sim, u, tgt) && Units.step(sim, u, tgt.x, tgt.y, mul) === -1) { u.state = 'idle'; u.targetId = -1; return false; }
        return true;
    },
    grazeValue(sim, u) {
        const w = sim.world, t = w.terrain[(u.y | 0) * w.w + (u.x | 0)];
        return Math.max(TERRAIN[t].graze, SPECIES[u.species].forage || 0);
    },
    breed(sim, u, chance) {
        const sp = SPECIES[u.species], w = sim.world;
        const cnt = sim.speciesCount[u.species] || 0;
        const cap = Math.max(6, sp.cap * w.w * w.h);
        if (!u.adult || cnt >= cap || !sim.rng.chance(chance * sp.fertility * (1 - cnt / cap))) return;
        const mate = sp.solo || sim.grid.nearest(u.x, u.y, 4, o => o !== u && o.species === u.species && o.adult);
        if (!mate) return;
        const baby = sim.spawnUnit(u.species, u.x + sim.rng.float(-0.5, 0.5), u.y + sim.rng.float(-0.5, 0.5), { age: 0 });
        if (baby) { u.hunger -= 30; if (u.kind === 'animal') sim.fx.emote(u.x, u.y, 'heart'); }
    },

    animalAI(sim, u) {
        const sp = SPECIES[u.species];
        const w = sim.world;
        u.hunger -= sp.diet === 'carn' ? 0.014 : 0.03;
        if (u.hunger <= 0) { u.hunger = 0; u.hp -= 0.04; if (u.hp <= 0) { Units.kill(sim, u, 'starvation', null); return; } }

        if (u.state === 'fight' && Units.pursue(sim, u, 1.15)) return;
        if (u.state === 'flee') {
            if (Units.moveAlong(sim, u, 1.35) !== 0) u.state = 'idle';
            return;
        }
        if (u.state === 'graze') {
            u.workT--;
            u.hunger = Math.min(100, u.hunger + Units.grazeValue(sim, u) * 0.55);
            if (u.workT <= 0 || u.hunger >= 100) u.state = 'idle';
            if (!Units.thinking(sim, u, 8)) return;
        }

        if (Units.thinking(sim, u, 8)) {
            // Threats
            if (sp.diet === 'herb') {
                const threat = sim.grid.nearest(u.x, u.y, 5, o => !o.dead && o !== u && (o.kind === 'monster' || o.madT > 0 || (o.kind === 'animal' && SPECIES[o.species].prey && SPECIES[o.species].prey.includes(u.species)) || (o.kind === 'civ' && o.task && o.task.kind === 'hunt')));
                if (threat) {
                    if (sp.atk >= 8 && u.adult && threat.kind !== 'monster') { u.state = 'fight'; u.targetId = threat.id; return; } // stampede!
                    const a = Math.atan2(u.y - threat.y, u.x - threat.x) + sim.rng.float(-0.5, 0.5);
                    Units.setTarget(u, u.x + Math.cos(a) * 7, u.y + Math.sin(a) * 7);
                    if (u.state !== 'flee' && sim.rng.chance(0.5)) sim.fx.emote(u.x, u.y, 'alert');
                    u.state = 'flee';
                    return;
                }
            } else if (u.hunger < 65) {
                const starving = u.hunger < 25;
                const prey = sim.grid.nearest(u.x, u.y, starving ? 9 : 11, o => o !== u && (sp.prey.includes(o.species) || (starving && o.kind === 'civ' && o.adult) ||
                    (sp.amphibious && o.kind === 'civ' && w.isWater(o.x, o.y))));
                if (prey) { u.state = 'fight'; u.targetId = prey.id; return; }
            }
            // Fight back
            if (u.lastAttacker >= 0 && sim.tick - u.lastHitTick < 60) {
                const att = sim.unitMap.get(u.lastAttacker);
                if (att && !att.dead && (sp.diet === 'carn' || sp.hp >= 30)) { u.state = 'fight'; u.targetId = att.id; return; }
            }
            if (u.hunger > 55) Units.breed(sim, u, sp.diet === 'carn' ? 0.012 : 0.006);
            // Bees pollinate: shrubs sprout, burnt ground greens.
            if (sp.pollinate && sim.rng.chance(0.05)) {
                const tx = u.x | 0, ty = u.y | 0;
                if (w.inb(tx, ty)) {
                    const i = w.idx(tx, ty), t = w.terrain[i];
                    if (t === T.ASH || t === T.SOIL) w.setTerrain(i, T.GRASS);
                    else if (!w.tree[i] && w.bld[i] < 0 && !w.fire[i] && w.owner[i] < 0 && EP.canHoldTree(t) && sim.rng.chance(0.4)) w.setTree(i, sim.rng.chance(0.7) ? EP.TREE.BUSH : EP.treeFor(t, sim.rng.next()));
                }
            }
            // Graze
            if (sp.diet === 'herb' && u.hunger < 70 && Units.grazeValue(sim, u) > 0.2 && sim.rng.chance(0.5)) {
                u.state = 'graze'; u.workT = sim.rng.int(40, 100); u.tx = null;
                return;
            }
            // Wander, staying near the herd and home biome
            if (u.tx == null && sim.rng.chance(0.35)) {
                if (sim.rng.chance(0.3) && Units.seekHabitat(sim, u)) { /* heading home */ }
                else {
                    let cx = u.x, cy = u.y;
                    if (sp.herd) {
                        const leader = sim.grid.nearest(u.x, u.y, 12, o => o.species === u.species && o.id < u.id);
                        if (leader) { cx = leader.x; cy = leader.y; }
                    }
                    Units.wanderTarget(sim, u, cx, cy, sp.herd ? 4 : 7);
                }
            }
        }
        Units.moveAlong(sim, u, 0.6);
    },

    aquaticAI(sim, u) {
        const sp = SPECIES[u.species];
        if (sp.diet === 'carn') {
            u.hunger -= 0.012;
            if (u.hunger <= 0) { u.hunger = 0; u.hp -= 0.04; if (u.hp <= 0) { Units.kill(sim, u, 'starvation', null); return; } }
            if (u.state === 'fight' && Units.pursue(sim, u, 1.2, 12)) return;
        }
        if (Units.thinking(sim, u, 10)) {
            if (sp.diet === 'carn') {
                if (u.hunger < 60) {
                    const prey = sim.grid.nearest(u.x, u.y, 8, o => o !== u && (sp.prey.includes(o.species) || (o.kind === 'civ' && u.hunger < 35)) && Units.passable(sim, u, o.x, o.y));
                    if (prey) { u.state = 'fight'; u.targetId = prey.id; return; }
                }
                if (u.hunger > 50) Units.breed(sim, u, 0.01);
            } else Units.breed(sim, u, 0.03);
            if (u.tx == null && sim.rng.chance(0.5)) Units.wanderTarget(sim, u, u.x, u.y, sp.diet === 'carn' ? 10 : 6);
        }
        Units.moveAlong(sim, u, 0.6);
    },

    // Generic land monster: zombies, skeletons, demons, ice golems.
    monsterAI(sim, u) {
        const sp = SPECIES[u.species], w = sim.world;
        // Elemental auras
        if (sp.fireproof && (sim.tick + u.id) % 14 === 0) {
            if (sim.rng.chance(0.45) && !sim.env.ignite(u.x, u.y) && sim.rng.chance(0.15)) sim.env.ignite(u.x, u.y, true);
            sim.fx.burst(u.x, u.y - 0.5, 1, { colors: ['#ffd34d', '#ff7b1f'], speed: 0.01, life: 16, rise: 0.03, glow: true });
        }
        if (sp.frost && (sim.tick + u.id) % 16 === 0) {
            const tx = Math.floor(u.x + sim.rng.float(-1.6, 1.6)), ty = Math.floor(u.y + sim.rng.float(-1.6, 1.6));
            if (w.inb(tx, ty)) sim.env.freeze(w.idx(tx, ty));
            sim.fx.burst(u.x, u.y - 0.6, 1, { colors: ['#ffffff', '#dff4ff'], speed: 0.02, life: 30, grav: 0.001, size: 1 });
        }
        if (u.state === 'fight' && Units.pursue(sim, u, 1)) return;
        if (u.state === 'smash') { Units.smash(sim, u); return; }
        if (Units.thinking(sim, u, 10)) {
            const prey = sim.grid.nearest(u.x, u.y, 10, o => (o.kind === 'civ' || o.kind === 'animal') && !(o.kind === 'animal' && SPECIES[o.species].fly));
            if (prey) { u.state = 'fight'; u.targetId = prey.id; return; }
            if (sp.smash && sim.rng.chance(0.25)) {
                const b = sim.civ.nearestBuilding(u.x, u.y, 8);
                if (b && w.sameLand(u.x, u.y, b.x + b.w / 2, b.y + b.h)) { u.state = 'smash'; u.task = { kind: 'smash', bid: b.id }; return; }
            }
            if (u.tx == null) Units.wanderTarget(sim, u, u.x, u.y, 8);
        }
        Units.moveAlong(sim, u, u.species === 'zombie' ? 0.8 : 0.9);
    },
    smash(sim, u) {
        const b = sim.civ.buildings.get(u.task && u.task.bid);
        if (!b) { u.state = 'idle'; u.task = null; return; }
        const cx = EP.clamp(u.x, b.x - 0.2, b.x + b.w + 0.2), cy = EP.clamp(u.y, b.y - 0.2, b.y + b.h + 0.2);
        if (Math.hypot(cx - u.x, cy - u.y) > 0.8) { if (Units.step(sim, u, cx, cy, 1) === -1) { u.state = 'idle'; u.task = null; } return; }
        if (u.atkCd <= 0) {
            u.atkCd = 26; u.face = cx >= u.x ? 1 : -1;
            sim.civ.damageBuilding(b.id, u.atk * 1.4, u);
            sim.fx.burst(cx, cy - 0.3, 3, { color: '#c9b089', speed: 0.06, life: 14, size: 1 });
            if (SPECIES[u.species].fireproof) sim.env.ignite(cx, cy, true);
        }
        // Defend itself if someone is hitting it
        if (u.lastAttacker >= 0 && sim.tick - u.lastHitTick < 20) { u.state = 'fight'; u.targetId = u.lastAttacker; u.task = null; }
    },

    dragonAI(sim, u) {
        if (Units.thinking(sim, u, 12)) {
            if (u.atkCd <= 0) {
                const tgt = sim.grid.nearest(u.x, u.y, 7, o => o.kind === 'civ' || (o.kind === 'animal' && o.species !== 'rabbit' && o.species !== 'bee'));
                if (tgt) Units.attack(sim, u, tgt);
                else if (sim.rng.chance(0.25)) {
                    const b = sim.civ.nearestBuilding(u.x, u.y, 7);
                    if (b) {
                        u.atkCd = 70;
                        sim.shoot('fireball', u.x, u.y - 0.3, b.x + b.w / 2, b.y + b.h / 2, u.atk, u, -1);
                    }
                }
            }
            if (u.tx == null) Units.wanderTarget(sim, u, u.x, u.y, 22);
        }
        Units.moveAlong(sim, u, 0.7);
    },

    // Hovers about, zaps buildings with lasers and beams up unlucky creatures.
    ufoAI(sim, u) {
        const sp = SPECIES.ufo;
        if (u.state === 'abduct') {
            const t = sim.unitMap.get(u.targetId);
            if (!t || t.dead) { u.state = 'idle'; u.workT = 0; u.targetId = -1; return; }
            const d = Math.hypot(t.x - u.x, t.y - u.y);
            if (u.workT === 0 && d > 0.35) {
                if (d > 18 || Units.step(sim, u, t.x, t.y, 1.3) === -1) { u.state = 'idle'; u.targetId = -1; }
                return;
            }
            if (u.workT === 0) sim.emit('sfx', { name: 'zap', x: u.x, y: u.y });
            u.workT++;
            t.frozen = Math.max(t.frozen || 0, 2); t.tx = null;
            if (u.workT % 5 === 0) sim.fx.burst(t.x, t.y, 2, { colors: ['#9fffb0', '#e6fff0', '#7dd3fc'], speed: 0.02, life: 26, rise: 0.06, glow: true });
            if (u.workT >= 75) {
                sim.fx.burst(t.x, t.y - 1, 14, { colors: ['#9fffb0', '#ffffff'], speed: 0.05, life: 30, rise: 0.08, glow: true });
                if (t.kind === 'civ' && t.kingdomId >= 0 && (t.level >= 4 || sim.civ.kingdoms.get(t.kingdomId)?.kingId === t.id))
                    sim.log(`${t.name} was abducted by a UFO`, { x: t.x, y: t.y, type: 'disaster', kingdom: t.kingdomId });
                Units.kill(sim, t, 'abducted', u);
                u.state = 'idle'; u.workT = 0; u.targetId = -1; u.atkCd = 240;
            }
            return;
        }
        if (Units.thinking(sim, u, 12)) {
            if (u.lastAttacker >= 0 && sim.tick - u.lastHitTick < 60) {
                const att = sim.unitMap.get(u.lastAttacker);
                if (att && !att.dead) Units.attack(sim, u, att);
            }
            if (u.atkCd <= 0 && sim.rng.chance(0.3)) {
                const t = sim.grid.nearest(u.x, u.y, 8, o => o.kind !== 'monster' && o.kind !== 'aquatic');
                if (t) { u.state = 'abduct'; u.targetId = t.id; u.workT = 0; return; }
            } else if (u.atkCd <= 0 && sim.rng.chance(0.3)) {
                const b = sim.civ.nearestBuilding(u.x, u.y, sp.ranged + 1);
                if (b) { u.atkCd = sp.cd; sim.shoot('laser', u.x, u.y - 0.3, b.x + b.w / 2, b.y + b.h / 2, u.atk * 2, u, -1); }
            }
            if (u.tx == null) Units.wanderTarget(sim, u, u.x, u.y, 18);
        }
        Units.moveAlong(sim, u, 0.7);
    },

    // Madness: attack the nearest living thing, friend or foe.
    madAI(sim, u) {
        if (u.state === 'fight' && Units.pursue(sim, u, 1.1, 12)) return;
        if (Units.thinking(sim, u, 8)) {
            const t = sim.grid.nearest(u.x, u.y, 9, o => o !== u && o.kind !== 'aquatic' && !(o.kind === 'animal' && SPECIES[o.species].fly));
            if (t) { u.state = 'fight'; u.targetId = t.id; return; }
            if (u.tx == null) Units.wanderTarget(sim, u, u.x, u.y, 6);
        }
        if (Units.thinking(sim, u, 90)) sim.fx.emote(u.x, u.y, 'angry');
        Units.moveAlong(sim, u, 0.9);
    },
};
})();
