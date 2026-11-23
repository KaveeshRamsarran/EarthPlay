/* EarthPlay — HUD: tool dock, inspector & info panels, event feed, modals, tooltips. */
(function () {
'use strict';
const EP = globalThis.EP;
const { SPECIES, AGES, BUILDINGS, Sprites } = EP;
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const JOB_LABEL = { farmer: 'Farmer', woodcutter: 'Woodcutter', miner: 'Miner', builder: 'Builder', warrior: 'Warrior', smith: 'Smith' };
const RES = EP.RESOURCES.slice(0, 4).map(r => [r, EP.RES_INFO[r].name, EP.RES_INFO[r].color]);
const ORES = EP.RESOURCES.slice(4).map(r => [r, EP.RES_INFO[r].name, EP.RES_INFO[r].color]);
const gearName = (u, slot) => {
    const t = u[slot] || 0;
    if (slot === 'wpn') return t ? `${EP.GEAR[t].name} ${EP.WEAPON_NAME[u.species] || 'weapon'}` : 'Crude ' + (u.species === 'elf' ? 'bow' : 'club');
    return t ? `${EP.GEAR[t].name} armour` : 'None';
};
const LOG_COLOR = { war: '#ff6b5a', fall: '#ff9b6b', peace: '#7dd3fc', found: '#8be08b', age: '#ffd34d', king: '#e9c46a', death: '#c9a7ff', hero: '#ffe066', disaster: '#ff8a3d' };
const SPARK_COLOR = '#3987e5';

function iconCanvas(id, size = 32, cls = '') {
    const c = document.createElement('canvas');
    c.className = 'px-icon ' + cls;
    Sprites.paintInto(c, Sprites.icon(id), size);
    return c;
}
// Paint every <canvas data-icon="id" data-size="n"> under root with its pixel icon.
function paintIcons(root) {
    root.querySelectorAll('canvas[data-icon]').forEach(c => {
        c.classList.add('px-icon');
        const size = +c.dataset.size || 16;
        Sprites.paintInto(c, Sprites.icon(c.dataset.icon), size);
        c.style.width = c.style.height = size + 'px';
    });
}
EP.paintIcons = paintIcons;
const CLOSE_BTN = '<button class="icon-btn close" data-act="close" data-close aria-label="Close"><canvas data-icon="ui_close" data-size="18"></canvas></button>';
function bannerHTML(k, size = 18) {
    return `<img class="banner" width="${size}" height="${Math.round(size * 1.2)}" src="${Sprites.banner(k.color, k.sym).toDataURL()}" alt="">`;
}

class UI {
    constructor(game) {
        this.game = game;
        this.panel = null;          // {kind, id}
        this.cat = 'terrain';
        this.lastUpdate = 0;
        this.feed = [];
        this.panelHTML = '';
        this.bannerCache = new Map();
    }
    get sim() { return this.game.sim; }

    // ------------------------------------------------------------ build
    build() {
        paintIcons(document);
        const cats = $('#dock-cats'), tools = $('#dock-tools');
        cats.innerHTML = '';
        for (const c of EP.TOOL_CATEGORIES) {
            const b = document.createElement('button');
            b.className = 'cat-btn'; b.dataset.cat = c.id;
            b.append(iconCanvas(c.icon, 28));
            const s = document.createElement('span'); s.textContent = c.name; b.append(s);
            b.setAttribute('aria-label', c.name);
            b.addEventListener('click', () => { this.setCategory(c.id); this.game.audio.play('click'); });
            cats.append(b);
        }
        this.toolButtons = {};
        tools.innerHTML = '';
        for (const t of EP.TOOLS) {
            const b = document.createElement('button');
            b.className = 'tool-btn'; b.dataset.tool = t.id; b.dataset.cat = t.cat;
            b.setAttribute('aria-label', t.name);
            b.append(iconCanvas(t.icon, 32));
            const s = document.createElement('span'); s.textContent = t.name; b.append(s);
            b.addEventListener('click', () => { this.game.selectTool(t.id); this.game.audio.play('select'); });
            b.addEventListener('pointerenter', e => this.showTip(b, `<b>${esc(t.name)}</b><p>${esc(t.desc || '')}</p>`));
            b.addEventListener('pointerleave', () => this.hideTip());
            tools.append(b);
            this.toolButtons[t.id] = b;
        }
        const slider = $('#brush-size');
        slider.addEventListener('input', () => { this.game.brushSize = +slider.value; $('#brush-val').textContent = slider.value; });

        // Top bar
        document.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => { this.game.setSpeed(+b.dataset.speed); this.game.audio.play('click'); }));
        const act = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', () => { this.game.audio.play('click'); fn(); }); };
        act('#btn-borders', () => this.game.toggleBorders());
        act('#btn-realms', () => this.togglePanel('realms'));
        act('#btn-chronicle', () => this.togglePanel('chronicle'));
        act('#btn-stats', () => this.togglePanel('stats'));
        act('#btn-save', () => this.openSaveLoad('save'));
        act('#btn-load', () => this.openSaveLoad('load'));
        act('#btn-settings', () => this.openSettings());
        act('#btn-help', () => this.openHelp());
        act('#btn-menu', () => this.openNewWorld());
        act('#btn-minimap', () => this.toggleMinimap());

        // Panel actions (pointerdown so live re-renders never swallow a click)
        $('#panel').addEventListener('pointerdown', e => {
            const el = e.target.closest('[data-act]');
            if (!el) return;
            e.preventDefault();
            this.game.audio.play('click');
            this.panelAction(el.dataset.act, el.dataset);
        });
        $('#feed').addEventListener('pointerdown', e => {
            const el = e.target.closest('[data-x]');
            if (el) { this.game.renderer.centerOn(+el.dataset.x, +el.dataset.y, Math.max(this.game.renderer.cam.zoom, 2.5)); }
        });
        this.setCategory('terrain');
        this.syncSpeed();
    }

    setCategory(cat) {
        this.cat = cat;
        document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
        document.querySelectorAll('.tool-btn').forEach(b => b.hidden = b.dataset.cat !== cat);
    }
    syncTool() {
        const id = this.game.tool && this.game.tool.id;
        for (const k in this.toolButtons) this.toolButtons[k].classList.toggle('active', k === id);
        const t = this.game.tool;
        $('#dock-brush').classList.toggle('disabled', !(t && t.sized));
        if (t && t.cat !== this.cat) this.setCategory(t.cat);
    }
    syncSpeed() {
        document.querySelectorAll('[data-speed]').forEach(b => b.classList.toggle('active', +b.dataset.speed === this.game.speed));
    }
    toggleMinimap() { $('#minimap-wrap').classList.toggle('collapsed'); }

    showTip(anchor, html) {
        const tip = $('#tooltip');
        tip.innerHTML = html; tip.hidden = false;
        const r = anchor.getBoundingClientRect(), tr = tip.getBoundingClientRect();
        tip.style.left = EP.clamp(r.left + r.width / 2 - tr.width / 2, 8, innerWidth - tr.width - 8) + 'px';
        tip.style.top = (r.top - tr.height - 10) + 'px';
    }
    hideTip() { $('#tooltip').hidden = true; }

    toast(msg, kind = '') {
        const t = document.createElement('div');
        t.className = 'toast ' + kind; t.textContent = msg;
        $('#toasts').append(t);
        setTimeout(() => t.classList.add('out'), 2600);
        setTimeout(() => t.remove(), 3100);
    }

    // ------------------------------------------------------------ event feed
    pushLog(e) {
        const feed = $('#feed');
        const el = document.createElement('div');
        el.className = 'feed-item';
        el.style.setProperty('--c', LOG_COLOR[e.type] || '#ccc');
        if (e.x != null && Number.isFinite(e.x)) { el.dataset.x = e.x; el.dataset.y = e.y; el.classList.add('link'); }
        el.innerHTML = `<span class="yr">Y${e.year}</span>${esc(e.text)}`;
        feed.prepend(el);
        while (feed.children.length > 4) feed.lastChild.remove();
        setTimeout(() => el.classList.add('fade'), 14000);
        setTimeout(() => el.remove(), 15000);
        if (this.panel && this.panel.kind === 'chronicle') this.panelHTML = '';
    }

    // ------------------------------------------------------------ HUD tick
    update() {
        const now = performance.now();
        if (now - this.lastUpdate < 250) return;
        this.lastUpdate = now;
        const sim = this.sim, env = sim.env;
        let civPop = 0, all = 0;
        for (const u of sim.units) { if (u.dead) continue; all++; if (u.kind === 'civ') civPop++; }
        $('#hud-year').textContent = `Year ${sim.year}`;
        $('#hud-pop').textContent = EP.fmt(civPop);
        $('#hud-life').textContent = EP.fmt(all);
        $('#hud-realms').textContent = sim.civ.aliveKingdoms().length;
        const day = env.daylight();
        const wt = env.weather.type;
        const sky = wt === 'storm' ? 'storm' : wt === 'rain' ? 'rain' : day > 0.5 ? 'sun' : 'moon';
        if (sky !== this.sky) {
            this.sky = sky;
            $('#hud-sky').innerHTML = `<canvas data-icon="ui_${sky}" data-size="18"></canvas><span>${{ sun: 'Day', moon: 'Night', rain: 'Rain', storm: 'Storm' }[sky]}</span>`;
            paintIcons($('#hud-sky'));
        }
        this.renderPanel();
    }

    // ------------------------------------------------------------ panels
    togglePanel(kind) {
        if (this.panel && this.panel.kind === kind) this.closePanel();
        else this.openPanel(kind);
    }
    openPanel(kind, id) {
        this.panel = { kind, id };
        this.panelHTML = '';
        $('#panel').hidden = false;
        document.querySelectorAll('[data-panel-btn]').forEach(b => b.classList.toggle('active', b.dataset.panelBtn === kind));
        const r = this.game.renderer;
        r.selection = kind === 'unit' || kind === 'building' || kind === 'city' || kind === 'vehicle' ? { type: kind, id } : null;
        this.lastUpdate = 0; this.update();
    }
    closePanel() {
        this.panel = null;
        $('#panel').hidden = true;
        this.game.renderer.selection = null;
        this.game.renderer.follow = -1;
        document.querySelectorAll('[data-panel-btn]').forEach(b => b.classList.remove('active'));
    }
    renderPanel() {
        if (!this.panel) return;
        const p = this.panel;
        let html = '';
        try {
            switch (p.kind) {
                case 'unit': html = this.unitHTML(p.id); break;
                case 'building': html = this.buildingHTML(p.id); break;
                case 'city': html = this.cityHTML(p.id); break;
                case 'kingdom': html = this.kingdomHTML(p.id); break;
                case 'vehicle': html = this.vehicleHTML(p.id); break;
                case 'ore': html = this.oreHTML(p.id); break;
                case 'realms': html = this.realmsHTML(); break;
                case 'chronicle': html = this.chronicleHTML(); break;
                case 'stats': html = this.statsHTML(); break;
            }
        } catch (e) { console.error(e); html = ''; }
        if (!html) { this.closePanel(); return; }
        if (html === this.panelHTML) return;
        this.panelHTML = html;
        const body = $('#panel-body');
        const scroll = body.scrollTop;
        body.innerHTML = html;
        body.scrollTop = scroll;
        body.querySelectorAll('canvas[data-sprite]').forEach(c => this.paintSprite(c));
        paintIcons(body);
        if (p.kind === 'stats') this.drawSparks();
    }
    paintSprite(c) {
        const [kind, a, b] = c.dataset.sprite.split(':');
        if (kind === 'unit') {
            const u = this.sim.unitMap.get(+a);
            if (!u) return;
            const k = this.sim.civ.kingdoms.get(u.kingdomId);
            Sprites.paintInto(c, Sprites.unit({ ...u, face: 1, kind: u.kind, species: u.species }, k ? k.color : '#9a9a9a', 0), +b || 64);
        } else if (kind === 'icon') Sprites.paintInto(c, Sprites.icon(a), +b || 24);
        else if (kind === 'bld') {
            const bl = this.sim.civ.buildings.get(+a);
            if (bl) Sprites.paintInto(c, Sprites.building(bl, this.sim.civ.buildingKingdom(bl)), +b || 64);
        }
    }
    head(title, sub, extra = '') {
        return `<div class="ph"><div class="ph-text"><h2>${title}</h2>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${extra}${CLOSE_BTN}</div>`;
    }
    bar(v, max, color, label) {
        const pct = max > 0 ? EP.clamp(v / max * 100, 0, 100) : 0;
        return `<div class="bar"><div class="bar-fill" style="width:${pct}%;background:${color}"></div><span>${label}</span></div>`;
    }
    kLink(k) { return k ? `<a class="klink" data-act="kingdom" data-id="${k.id}" style="--kc:${k.color}">${bannerHTML(k, 14)}${esc(k.name)}</a>` : '<span class="muted">No realm</span>'; }
    doing(u) {
        const sim = this.sim;
        if (u.frozen > 0) return 'Frozen solid!';
        if (u.madT > 0) return u.state === 'fight' ? 'Raving mad — attacking everything' : 'Gone mad!';
        if (u.state === 'abduct') { const t = sim.unitMap.get(u.targetId); return t ? `Abducting ${t.name ? esc(t.name) : 'a ' + SPECIES[t.species].name.toLowerCase()}` : 'Scanning for specimens'; }
        if (u.state === 'smash') return 'Smashing a building';
        if (u.state === 'fight') { const t = sim.unitMap.get(u.targetId); return t ? `Fighting ${t.name ? esc(t.name) : 'a ' + SPECIES[t.species].name.toLowerCase()}` : 'Fighting'; }
        if (u.state === 'siege') return 'Besieging a building';
        if (u.state === 'flee') return 'Fleeing!';
        if (u.state === 'graze') return 'Grazing';
        if (u.boarded > 0) { const v = sim.vehicles.map.get(u.boarded); return v && v.job && v.job.kind === 'invade' ? 'Sailing to invade' : 'Sailing to distant shores'; }
        if (u.carry) return `Carrying ${u.carry.amt} ${u.carry.type} home`;
        const t = u.task && u.task.kind;
        const oreName = t === 'ore' && EP.ORE_INFO[sim.world.ore[u.task.i]] ? EP.ORE_INFO[sim.world.ore[u.task.i]].name.toLowerCase() : 'ore';
        const m = { chop: u.state === 'work' ? 'Chopping wood' : 'Walking to a tree', farm: u.state === 'work' ? 'Tending crops' : 'Heading to the fields', fish: u.state === 'work' ? 'Fishing' : 'Going fishing', mine: u.state === 'work' ? 'Quarrying stone' : 'Heading to the quarry', build: u.state === 'work' ? 'Building' : 'Heading to a building site', raid: 'Marching to war', patrol: 'On patrol', settle: 'Travelling to found a new town', hunt: 'Hunting',
            ore: u.state === 'work' ? `Mining ${oreName}` : `Heading to a ${oreName} vein`, road: u.state === 'work' ? 'Laying road' : 'Off to build a road', forge: u.state === 'work' ? 'Forging at the anvil' : 'Heading to the smithy', board: 'Boarding a ship' };
        if (m[t]) return m[t];
        if (u.kind === 'civ' && !u.adult) return 'Playing';
        if (u.kind === 'civ' && u.kingdomId < 0) return u.lonely > 100 ? 'Seeking land to found a realm' : 'Wandering';
        return u.tx != null ? 'Wandering' : 'Resting';
    }
    unitHTML(id) {
        const u = this.sim.unitMap.get(id);
        if (!u) return '';
        const sp = SPECIES[u.species], civ = this.sim.civ;
        const k = civ.kingdoms.get(u.kingdomId), c = civ.cities.get(u.cityId);
        const isKing = k && k.kingId === u.id, rulerTitle = isKing ? civ.rulerTitle(k) : '';
        const title = u.name ? esc(u.name) : sp.name;
        const role = u.kind === 'monster' ? 'Monster' : u.kind === 'aquatic' ? (sp.diet === 'carn' ? 'Sea predator' : 'Sea creature') : sp.diet === 'carn' ? 'Predator' : sp.fly ? 'Pollinator' : 'Grazer';
        const sub = `${isKing ? `<span class="crown">♛ ${rulerTitle}</span> · ` : ''}${u.kind === 'civ' ? sp.name + (u.adult ? '' : ' child') + (u.job ? ' · ' + JOB_LABEL[u.job] : '') : role + (u.adult ? '' : ' · young')}`;
        const traits = u.traits.map(t => `<span class="chip ${EP.TRAITS[t].good ? 'good' : 'bad'}">${EP.TRAITS[t].name}</span>`).join('');
        const following = this.game.renderer.follow === u.id;
        return this.head(title, sub) + `
            <div class="portrait-row"><canvas class="portrait" data-sprite="unit:${u.id}:72"></canvas>
              <div class="pr-info"><div class="doing">${this.doing(u)}</div>${u.kind === 'civ' ? `<div>${this.kLink(k)}</div>${c ? `<div class="muted">of <a data-act="city" data-id="${c.id}">${esc(c.name)}</a></div>` : ''}` : ''}</div></div>
            ${this.bar(u.hp, u.hpMax, u.hp / u.hpMax > 0.5 ? '#5fd16a' : '#ff6b4d', `Health ${Math.ceil(u.hp)} / ${u.hpMax}`)}
            ${u.kind === 'animal' || (u.kind === 'aquatic' && sp.diet === 'carn') ? this.bar(u.hunger, 100, '#e9c46a', `Fed ${Math.round(u.hunger)}%`) : ''}
            <div class="kv">
              <div><span>Age</span><b>${Math.floor(u.age)} <small>of ${Math.round(u.lifespan)}</small></b></div>
              <div><span>Attack</span><b>${u.atk.toFixed(1)}</b></div>
              <div><span>Level</span><b>${u.level}</b></div>
              <div><span>Kills</span><b>${u.kills}</b></div>
            </div>
            ${u.kind === 'civ' && u.adult ? `<div class="kv gear"><div><span>Weapon</span><b style="color:${EP.GEAR[u.wpn || 0].color}">${gearName(u, 'wpn')}</b></div><div><span>Armour</span><b style="color:${u.arm ? EP.GEAR[u.arm].color : 'inherit'}">${gearName(u, 'arm')}</b></div></div>` : ''}
            ${u.sick ? `<div class="warn">${u.kind === 'civ' ? 'Sick with plague' : 'Sick'}</div>` : ''}
            ${u.frozen > 0 ? '<div class="warn ice">Frozen in ice</div>' : ''}
            ${u.kind !== 'civ' ? `<p class="muted small">${esc(sp.desc || '')}</p>` : ''}
            ${traits ? `<div class="chips">${traits}</div>` : ''}
            <div class="actions">
              <button class="btn ${following ? 'on' : ''}" data-act="follow" data-id="${u.id}">${following ? 'Following' : 'Follow'}</button>
              <button class="btn" data-act="bless-unit" data-id="${u.id}">Bless</button>
              <button class="btn danger" data-act="smite" data-id="${u.id}">Smite</button>
            </div>`;
    }
    buildingHTML(id) {
        const civ = this.sim.civ, b = civ.buildings.get(id);
        if (!b) return '';
        const d = BUILDINGS[b.type], c = civ.cities.get(b.cityId), k = civ.buildingKingdom(b);
        return this.head(esc(d.name), c ? `in <a data-act="city" data-id="${c.id}">${esc(c.name)}</a>` : '') + `
            <div class="portrait-row"><canvas class="portrait" data-sprite="bld:${b.id}:72"></canvas><div class="pr-info"><div>${this.kLink(k)}</div><div class="muted">${esc(d.desc || '')}</div></div></div>
            ${b.done ? this.bar(b.hp, b.maxHp, '#5fd16a', `Integrity ${Math.ceil(b.hp)} / ${b.maxHp}`) : this.bar(b.progress, 1, '#e9c46a', `Under construction ${Math.round(b.progress * 100)}%`)}
            ${d.housing ? `<div class="kv"><div><span>Houses</span><b>${d.housing}</b></div></div>` : ''}
            ${b.type === 'docks' || b.type === 'market' ? `<div class="kv"><div><span>${b.type === 'docks' ? 'Boats' : 'Caravans out'}</span><b>${this.sim.vehicles.list.filter(v => !v.dead && v.home === b.id).length}</b></div></div>` : ''}
            ${b.type === 'smithy' && k ? `<div class="kv"><div><span>Best forge</span><b>${EP.GEAR[civ.bestTier(k)].name}</b></div><div><span>Forged so far</span><b>${EP.GEAR[k.forged || 0].name}</b></div></div>` : ''}`;
    }
    vehicleHTML(id) {
        const sim = this.sim, v = sim.vehicles.map.get(id);
        if (!v) return '';
        const civ = sim.civ, k = civ.kingdoms.get(v.kingdomId), c = civ.cities.get(v.cityId), d = EP.VEHICLES[v.type];
        const what = {
            fishing: { dock: 'Moored at the docks', go: 'Sailing to the fishing grounds', fish: 'Casting nets', back0: 'Heading home', back: v.cargo ? `Bringing ${v.cargo.amt} fish home` : 'Heading home' },
            transport: { idle: 'Moored at the docks', wait: `Waiting for passengers (${v.pass.length} aboard)`, sail: v.job && v.job.kind === 'invade' ? `Carrying ${v.pass.length} warriors to invade` : `Carrying ${v.pass.length} settlers overseas`, return: 'Returning to port', homeward: 'Returning to port' },
        }[v.type] || { go: 'Travelling to trade', back0: 'Trading', back: 'Heading home with profits' };
        return this.head(d.name, c ? `of <a data-act="city" data-id="${c.id}">${esc(c.name)}</a>` : '') + `
            <div class="pr-info"><div class="doing">${what[v.state] || 'Idle'}</div><div>${this.kLink(k)}</div></div>
            ${this.bar(v.hp, v.maxHp, '#5fd16a', `Hull ${Math.ceil(v.hp)} / ${v.maxHp}`)}`;
    }
    oreHTML(i) {
        const w = this.sim.world, o = EP.ORE_INFO[w.ore[i]];
        if (!o) return '';
        return this.head(`${o.name} vein`, EP.TERRAIN[w.terrain[i]].name) + `
            <div class="portrait-row"><canvas class="portrait" data-sprite="icon:ore_${o.id}:48"></canvas><div class="pr-info"><div>${w.oreAmt[i]} loads left to mine</div>
            <div class="muted">${{ copper: 'Smiths forge copper weapons and armour from it in the Bronze Age.', iron: 'Forged into iron kit in the Iron Age — and, with coal, into steel.', coal: 'Fuel for smelting steel, mithril and adamantine.', gold: 'Wealth: buys timber, builds libraries.', gems: 'Cut and sold at markets for gold.', mithril: 'A shining, light metal for legendary weapons.', adamantine: 'The hardest metal of all. Only Golden Age smiths can work it.' }[o.id]}</div></div></div>`;
    }
    cityHTML(id) {
        const civ = this.sim.civ, c = civ.cities.get(id);
        if (!c) return '';
        const k = civ.kingdoms.get(c.kingdomId);
        const lvl = c.pop < 8 ? 'Hamlet' : c.pop < 20 ? 'Village' : c.pop < 40 ? 'Town' : 'City';
        const counts = c.count || {};
        const blds = Object.entries(counts).map(([t, n]) => `<span class="chip">${BUILDINGS[t].name} × ${n}</span>`).join('');
        const jobs = Object.entries(c.jobs || {}).filter(([j]) => j !== 'none').map(([j, n]) => `<div><span>${JOB_LABEL[j] || j}</span><b>${n}</b></div>`).join('');
        return this.head(esc(c.name), `${lvl}${k && k.capital === c.id ? ' · Capital' : ''}`) + `
            <div class="row-gap">${this.kLink(k)}</div>
            ${this.bar(c.pop, Math.max(c.housing, 1), '#7dd3fc', `Population ${c.pop} / ${c.housing} homes`)}
            <div class="kv"><div><span>Founded</span><b>Year ${c.founded}</b></div><div><span>Territory</span><b>${c.tiles} tiles</b></div>${c.threat ? `<div><span>Threats</span><b class="bad">${c.threat}</b></div>` : ''}</div>
            ${jobs ? `<h3>Workforce</h3><div class="kv">${jobs}</div>` : ''}
            ${blds ? `<h3>Buildings</h3><div class="chips">${blds}</div>` : ''}
            <div class="actions"><button class="btn" data-act="goto" data-x="${c.x}" data-y="${c.y}">Go to town</button>${k && k.cities.length > 1 ? `<button class="btn danger" data-act="rebel" data-id="${c.id}">Incite revolt</button>` : ''}</div>`;
    }
    kingdomHTML(id) {
        const sim = this.sim, civ = sim.civ, k = civ.kingdoms.get(id);
        if (!k) return '';
        const king = sim.unitMap.get(k.kingId);
        const next = AGES[k.age + 1];
        const ageBar = next ? this.bar(k.tech - AGES[k.age].tech, next.tech - AGES[k.age].tech, '#ffd34d', `${AGES[k.age].name} → ${next.name}`) : this.bar(1, 1, '#ffd34d', AGES[k.age].name);
        const wars = Object.keys(k.wars).map(Number).map(i => civ.kingdoms.get(i)).filter(Boolean);
        const rel = Object.entries(k.relations).map(([i, v]) => [civ.kingdoms.get(+i), v]).filter(([o]) => o && o.alive && !k.wars[o.id] && !(k.allies && k.allies[o.id] != null)).sort((a, b) => b[1] - a[1]);
        const friends = rel.filter(r => r[1] > 30).slice(0, 3), rivals = rel.filter(r => r[1] < -30).slice(-3).reverse();
        const towns = k.cities.map(i => civ.cities.get(i)).filter(Boolean).sort((a, b) => b.pop - a.pop);
        const allies = Object.keys(k.allies || {}).map(Number).map(i => civ.kingdoms.get(i)).filter(o => o && o.alive);
        let equipped = 0, best = 0;
        for (const id of k.cities) { const c = civ.cities.get(id); if (c) for (const u of c.members) if (u.wpn || u.arm) { equipped++; best = Math.max(best, u.wpn || 0, u.arm || 0); } }
        let boats = 0, carts = 0;
        for (const v of sim.vehicles.list) if (!v.dead && v.kingdomId === k.id) { if (v.type === 'cart') carts++; else boats++; }
        return this.head(`${bannerHTML(k, 22)} ${esc(k.name)}`, `${k.alive ? `<b style="color:${k.color}">${civ.rankName(k)}</b> of ` : ''}${SPECIES[k.race].plural} · founded year ${k.founded}${k.alive ? '' : ` · <span class="bad">fell in year ${k.fell}</span>`}`) + `
            ${k.alive ? ageBar : ''}
            <div class="kv">
              <div><span>Population</span><b>${k.pop}</b></div><div><span>Army</span><b>${k.warriors}</b></div>
              <div><span>Towns</span><b>${k.cities.length}</b></div><div><span>Peak</span><b>${k.peakPop}</b></div>
              <div><span>Kills</span><b>${k.kills}</b></div><div><span>Losses</span><b>${k.deaths}</b></div>
            </div>
            ${k.alive ? `<div class="res">${RES.map(([r, n, col]) => `<div style="--rc:${col}"><i></i>${n}<b>${Math.floor(k[r])}</b></div>`).join('')}</div>` : ''}
            ${k.alive ? `<h3>Ores</h3><div class="res ores">${ORES.map(([r, n, col]) => `<div style="--rc:${col}" class="${k[r] >= 1 ? '' : 'none'}"><i></i>${n}<b>${Math.floor(k[r] || 0)}</b></div>`).join('')}</div>
            <div class="kv"><div><span>Equipped</span><b>${equipped}</b></div><div><span>Best kit</span><b style="color:${EP.GEAR[best].color}">${EP.GEAR[best].name}</b></div><div><span>Ships</span><b>${boats}</b></div><div><span>Carts</span><b>${carts}</b></div></div>` : ''}
            ${king ? `<h3>${civ.rulerTitle(k)}</h3><a class="ulink" data-act="unit" data-id="${king.id}"><canvas data-sprite="unit:${king.id}:28"></canvas><span><b>${esc(king.name)}</b><br><small>Age ${Math.floor(king.age)} · Level ${king.level} · ${king.kills} kills</small></span></a>` : ''}
            ${wars.length ? `<h3 class="bad">At war with</h3><div class="klist">${wars.map(o => this.kLink(o)).join('')}</div>` : ''}
            ${allies.length ? `<h3>Allies</h3><div class="klist">${allies.map(o => this.kLink(o)).join('')}</div>` : ''}
            ${friends.length ? `<h3>Friendly</h3><div class="klist">${friends.map(([o]) => this.kLink(o)).join('')}</div>` : ''}
            ${rivals.length ? `<h3>Rivals</h3><div class="klist">${rivals.map(([o]) => this.kLink(o)).join('')}</div>` : ''}
            ${towns.length ? `<h3>Towns</h3><div class="towns">${towns.map(c => `<a data-act="city" data-id="${c.id}"><span>${c.id === k.capital ? '♛ ' : ''}${esc(c.name)}</span><b>${c.pop}</b></a>`).join('')}</div>` : ''}`;
    }
    realmsHTML() {
        const civ = this.sim.civ;
        const alive = civ.aliveKingdoms().sort((a, b) => b.pop - a.pop);
        const fallen = [...civ.kingdoms.values()].filter(k => !k.alive).slice(-8).reverse();
        const row = k => `<a class="realm-row" data-act="kingdom" data-id="${k.id}" style="--kc:${k.color}">${bannerHTML(k, 18)}<span class="rn"><b>${esc(k.name)}</b><small>${k.alive ? civ.rankName(k) + ' · ' : ''}${SPECIES[k.race].plural} · ${AGES[k.age].name}${Object.keys(k.wars).length ? ' · <em class="bad">at war</em>' : ''}</small></span><span class="rp">${k.alive ? k.pop : '—'}<small>${k.alive ? k.cities.length + (k.cities.length === 1 ? ' town' : ' towns') : 'fell y' + k.fell}</small></span></a>`;
        return this.head('Realms', `${alive.length} standing`) +
            (alive.length ? alive.map(row).join('') : '<p class="muted pad">No realms yet. Place Humans, Elves, Dwarves or Orcs from the <b>Peoples</b> tab and they will found one.</p>') +
            (fallen.length ? `<h3>Fallen</h3>${fallen.map(row).join('')}` : '');
    }
    chronicleHTML() {
        const log = this.sim.logEntries.slice(-120).reverse();
        return this.head('Chronicle', 'The history of your world') + (log.length ? `<div class="chron">${log.map(e =>
            `<a class="chron-item" ${e.x != null && Number.isFinite(e.x) ? `data-act="goto" data-x="${e.x}" data-y="${e.y}"` : ''} style="--c:${LOG_COLOR[e.type] || '#999'}"><span class="yr">Year ${e.year}</span>${esc(e.text)}</a>`).join('')}</div>` : '<p class="muted pad">Nothing has happened yet.</p>');
    }
    statsHTML() {
        const sim = this.sim, pop = sim.census();
        const groups = [['Peoples', EP.CIV_RACES], ['Animals', EP.ANIMALS], ['Monsters', EP.MONSTERS]];
        const w = sim.world;
        if (this.oreV !== w.version) {
            this.oreV = w.version; this.oreCount = {};
            for (let i = 0; i < w.w * w.h; i++) if (w.ore[i]) this.oreCount[w.ore[i]] = (this.oreCount[w.ore[i]] || 0) + 1;
        }
        const oreTbl = `<h3>Ore veins</h3><div class="species">${Object.entries(EP.ORE_INFO).map(([t, o]) => `<div class="${this.oreCount[t] ? '' : 'none'}"><canvas data-sprite="icon:ore_${o.id}:28"></canvas><span>${o.name}</span><b>${this.oreCount[t] || 0}</b></div>`).join('')}</div>`;
        const tbl = groups.map(([g, list]) => `<h3>${g}</h3><div class="species">${list.map(s => `<div class="${pop[s] ? '' : 'none'}"><canvas data-sprite="icon:${s}:28"></canvas><span>${SPECIES[s].plural}</span><b>${pop[s] || 0}</b></div>`).join('')}</div>`).join('');
        const h = sim.history;
        const spark = EP.CIV_RACES.map(r => `<div class="spark" data-series="${r}"><div class="spark-h"><span>${SPECIES[r].plural}</span><b>${pop[r] || 0}</b></div><canvas height="44"></canvas></div>`).join('');
        return this.head('World statistics', `Year ${sim.year} · ${sim.world.w}×${sim.world.h} · seed ${sim.seed}`) + `
            <h3>Population over time <small class="muted">(per year, shared scale)</small></h3>
            ${h.length > 1 ? `<div class="sparks">${spark}</div>` : '<p class="muted">History appears after the first year.</p>'}
            ${tbl}${oreTbl}`;
    }
    drawSparks() {
        const h = this.sim.history;
        if (h.length < 2) return;
        const max = Math.max(4, ...h.map(e => Math.max(...EP.CIV_RACES.map(r => e[r] || 0))));
        document.querySelectorAll('.spark').forEach(el => {
            const c = el.querySelector('canvas'), r = el.dataset.series;
            const W = c.clientWidth || 240, H = 44, dpr = window.devicePixelRatio || 1;
            c.width = W * dpr; c.height = H * dpr;
            const g = c.getContext('2d'); g.scale(dpr, dpr);
            this.drawSparkOne(g, h, r, W, H, max, -1);
            const onMove = ev => {
                const rect = c.getBoundingClientRect();
                const i = EP.clamp(Math.round((ev.clientX - rect.left - 2) / (W - 4) * (h.length - 1)), 0, h.length - 1);
                this.showTip(c, `<b>Year ${h[i].year}</b><p>${SPECIES[r].plural}: ${h[i][r] || 0}</p>`);
                const tip = $('#tooltip'); tip.style.left = EP.clamp(ev.clientX - tip.offsetWidth / 2, 8, innerWidth - tip.offsetWidth - 8) + 'px';
                g.clearRect(0, 0, W, H);
                this.drawSparkOne(g, h, r, W, H, max, i);
            };
            c.onpointermove = onMove;
            c.onpointerleave = () => { this.hideTip(); g.clearRect(0, 0, W, H); this.drawSparkOne(g, h, r, W, H, max, -1); };
        });
    }
    drawSparkOne(g, h, r, W, H, max, hi) {
        const xs = i => 2 + (i / (h.length - 1)) * (W - 4), ys = v => H - 3 - (v / max) * (H - 8);
        g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, H - 2.5); g.lineTo(W, H - 2.5); g.stroke();
        g.beginPath(); h.forEach((e, i) => i ? g.lineTo(xs(i), ys(e[r] || 0)) : g.moveTo(xs(i), ys(e[r] || 0)));
        g.lineTo(xs(h.length - 1), H - 3); g.lineTo(xs(0), H - 3); g.closePath(); g.fillStyle = 'rgba(57,135,229,0.16)'; g.fill();
        g.beginPath(); h.forEach((e, i) => i ? g.lineTo(xs(i), ys(e[r] || 0)) : g.moveTo(xs(i), ys(e[r] || 0)));
        g.strokeStyle = SPARK_COLOR; g.lineWidth = 2; g.stroke();
        if (hi >= 0) {
            g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1; g.beginPath(); g.moveTo(xs(hi), 0); g.lineTo(xs(hi), H); g.stroke();
            g.fillStyle = SPARK_COLOR; g.strokeStyle = '#161a26'; g.lineWidth = 2;
            g.beginPath(); g.arc(xs(hi), ys(h[hi][r] || 0), 4, 0, Math.PI * 2); g.fill(); g.stroke();
        }
    }

    panelAction(act, d) {
        const sim = this.sim, g = this.game;
        switch (act) {
            case 'close': this.closePanel(); break;
            case 'kingdom': this.openPanel('kingdom', +d.id); break;
            case 'city': { this.openPanel('city', +d.id); const c = sim.civ.cities.get(+d.id); if (c) g.renderer.centerOn(c.x, c.y); break; }
            case 'unit': { this.openPanel('unit', +d.id); const u = sim.unitMap.get(+d.id); if (u) g.renderer.centerOn(u.x, u.y, Math.max(g.renderer.cam.zoom, 3)); break; }
            case 'goto': g.renderer.centerOn(+d.x, +d.y, Math.max(g.renderer.cam.zoom, 2.5)); break;
            case 'follow': g.renderer.follow = g.renderer.follow === +d.id ? -1 : +d.id; if (g.renderer.follow >= 0) g.renderer.cam.tz = Math.max(g.renderer.cam.tz, 3); this.panelHTML = ''; break;
            case 'smite': { const u = sim.unitMap.get(+d.id); if (u) sim.powers.lightning(u.x, u.y, false); break; }
            case 'bless-unit': { const u = sim.unitMap.get(+d.id); if (u) sim.powers.apply('bless', u.x, u.y, 1); break; }
            case 'rebel': { const c = sim.civ.cities.get(+d.id); if (c) sim.civ.rebel(c, true); break; }
        }
    }

    // ------------------------------------------------------------ modals
    modal(html, cls = '') {
        this.closeModal();
        const root = $('#modal-root');
        root.innerHTML = `<div class="modal-back"></div><div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div>`;
        root.hidden = false;
        paintIcons(root);
        root.querySelector('.modal-back').addEventListener('click', () => this.closeModal());
        root.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => this.closeModal()));
        this.game.modalOpen = true;
        return root.querySelector('.modal');
    }
    closeModal() { const root = $('#modal-root'); root.hidden = true; root.innerHTML = ''; this.game.modalOpen = false; }

    async openSaveLoad(mode) {
        const slots = EP.Save.SLOTS.map(s => ({ s, m: EP.Save.meta(s) }));
        const m = this.modal(`
            <div class="mh"><h2>${mode === 'save' ? 'Save world' : 'Load world'}</h2>${CLOSE_BTN}</div>
            <div class="slots">${slots.map(({ s, m }) => `
                <div class="slot ${m ? '' : 'empty'}" data-slot="${s}">
                  <div class="thumb">${m && m.thumb ? `<img src="${m.thumb}" alt="">` : ''}</div>
                  <div class="slot-info"><b>${s === 'auto' ? 'Autosave' : 'Slot ' + s}</b>${m ? `<small>Year ${m.year} · ${m.pop} people · ${m.kingdoms} realms<br>${m.size} · ${new Date(m.date).toLocaleString()}</small>` : '<small>Empty</small>'}</div>
                  <div class="slot-act">${mode === 'save' && s !== 'auto' ? `<button class="btn primary" data-do="save">Save</button>` : ''}${mode === 'load' && m ? `<button class="btn primary" data-do="load">Load</button>` : ''}${m && s !== 'auto' ? `<button class="icon-btn" data-do="del" aria-label="Delete"><canvas data-icon="ui_trash" data-size="18"></canvas></button>` : ''}</div>
                </div>`).join('')}</div>
            <div class="mf"><button class="btn" data-do="export">Export to file</button><label class="btn">Import file<input type="file" accept=".world,.txt" hidden data-do="import"></label></div>`, 'wide');
        m.addEventListener('click', async e => {
            const b = e.target.closest('[data-do]');
            if (!b || b.tagName === 'INPUT') return;
            const slot = b.closest('[data-slot]')?.dataset.slot;
            try {
                if (b.dataset.do === 'save') { b.textContent = 'Saving…'; await this.game.saveTo(slot); this.toast('World saved'); this.closeModal(); }
                else if (b.dataset.do === 'load') { b.textContent = 'Loading…'; await this.game.loadFrom(slot); this.closeModal(); }
                else if (b.dataset.do === 'del') { EP.Save.remove(slot); this.openSaveLoad(mode); }
                else if (b.dataset.do === 'export') { await EP.Save.exportFile(this.sim); this.toast('World exported'); }
            } catch (err) { this.toast(err.message || String(err), 'bad'); }
        });
        m.querySelector('input[type=file]').addEventListener('change', async e => {
            const f = e.target.files[0];
            if (!f) return;
            try { const sim = await EP.Save.importFile(f); this.game.useSim(sim); this.toast('World imported'); this.closeModal(); }
            catch (err) { this.toast('Could not read that file: ' + err.message, 'bad'); }
        });
    }
    openSettings() {
        const r = this.game.renderer.settings, a = this.game.audio;
        const m = this.modal(`
            <div class="mh"><h2>Settings</h2>${CLOSE_BTN}</div>
            <div class="settings">
              <label class="toggle"><input type="checkbox" data-set="sound" ${a.enabled ? 'checked' : ''}><span>Sound</span></label>
              <label class="range">Volume<input type="range" min="0" max="1" step="0.05" value="${a.volume}" data-set="volume"></label>
              <label class="toggle"><input type="checkbox" data-set="daynight" ${r.daynight ? 'checked' : ''}><span>Day & night cycle</span></label>
              <label class="toggle"><input type="checkbox" data-set="weather" ${r.weather ? 'checked' : ''}><span>Weather effects</span></label>
              <label class="toggle"><input type="checkbox" data-set="borders" ${r.borders ? 'checked' : ''}><span>Realm borders</span></label>
              <label class="toggle"><input type="checkbox" data-set="autosave" ${this.game.autosave ? 'checked' : ''}><span>Autosave every 3 minutes</span></label>
            </div>`);
        m.addEventListener('input', e => {
            const k = e.target.dataset.set;
            if (k === 'sound') a.setEnabled(e.target.checked);
            else if (k === 'volume') a.setVolume(+e.target.value);
            else if (k === 'autosave') this.game.autosave = e.target.checked;
            else if (k) { r[k] = e.target.checked; if (k === 'borders') this.game.minimap.v = -1; }
            this.game.saveSettings();
        });
    }
    openHelp() {
        this.modal(`
            <div class="mh"><h2>How to play</h2>${CLOSE_BTN}</div>
            <div class="help">
              <p>You are the god of a living world. Shape the land, seed life, and watch realms rise, trade blows and fall — or rain ruin upon them.</p>
              <div class="help-grid">
                <div><kbd>Left drag</kbd> Use the selected power</div>
                <div><kbd>Right / middle drag</kbd> Pan the camera</div>
                <div><kbd>Scroll</kbd> Zoom toward the cursor</div>
                <div><kbd>W A S D</kbd> / arrows — pan</div>
                <div><kbd>Space</kbd> Pause / resume</div>
                <div><kbd>1</kbd>–<kbd>4</kbd> Speed 1×, 2×, 5×, 10×</div>
                <div><kbd>[</kbd> <kbd>]</kbd> Brush size</div>
                <div><kbd>I</kbd> Inspect tool</div>
                <div><kbd>B</kbd> Toggle realm borders</div>
                <div><kbd>K</kbd> Realms · <kbd>C</kbd> Chronicle · <kbd>G</kbd> Stats</div>
                <div><kbd>F</kbd> Follow selected creature</div>
                <div><kbd>Ctrl</kbd>+<kbd>S</kbd> Quick save</div>
              </div>
              <h3>Tips</h3>
              <ul>
                <li>Drop a few people of one race on fertile grassland. They will found a realm, farm, chop wood, build houses and grow.</li>
                <li>Realms research their way through five ages. Watch towers, temples and barracks appear as they advance.</li>
                <li>Crowded towns send settlers to found new towns. Big empires suffer rebellions.</li>
                <li>Neighbouring realms grow to hate each other. Use <b>Discord</b> to start wars, <b>Harmony</b> to end them.</li>
                <li>Click any creature, building or territory with <b>Inspect</b> to learn its story.</li>
                <li>Over 20 kinds of animal live in their own biomes: camels in deserts, penguins on tundra, crocodiles in swamps, sharks in the deep. Bees plant shrubs and heal burnt land.</li>
                <li>Monsters bring chaos: demons crawl out of volcanoes and set fires, ice golems freeze the land, UFOs abduct people. Turn on <b>Disasters</b> when creating a world for surprise events.</li>
                <li><b>Madness</b> turns creatures on everyone; <b>Cure</b> calms them and thaws the frozen. <b>Fireworks</b> cheer realms up.</li>
                <li>Hills and mountains hold <b>ore</b>: copper, iron, coal, gold, gems, mithril and adamantine. Miners dig it out and <b>smithies</b> forge it into weapons and armour you can see on every soldier. Paint more veins from the <b>Ores</b> tab; meteors leave star-metal in their craters.</li>
                <li>Towns lay roads to every building and to their sister towns, pave them in the Iron Age and bridge rivers. Markets send trade carts and ships; docks launch fishing boats, settler ships and invasion fleets.</li>
                <li>Realms grow from <b>Tribe</b> to <b>Chiefdom</b>, <b>Kingdom</b> and <b>Empire</b>. Friendly kingdoms form <b>alliances</b> and join each other's wars — red arrows on the map show who is marching on whom.</li>

              </ul>
            </div>`, 'wide');
    }
    openNewWorld() {
        const o = this.game.lastOpts || {};
        const m = this.modal(`
            <div class="mh"><h2>Create a new world</h2>${CLOSE_BTN}</div>
            ${EP.worldFormHTML(o)}
            <div class="mf"><button class="btn" data-close>Cancel</button><button class="btn primary" data-do="create">Create world</button></div>`, 'wide');
        EP.bindWorldForm(m);
        m.querySelector('[data-do=create]').addEventListener('click', () => { const opts = EP.readWorldForm(m); this.closeModal(); this.game.newWorld(opts); });
    }
}
EP.UI = UI;

// Shared world-creation form (title screen + in-game dialog)
EP.worldFormHTML = function (o = {}) {
    const seg = (name, items, val) => `<div class="seg" data-name="${name}">${items.map(([v, l]) => `<button type="button" data-v="${v}" class="${v === val ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    return `<div class="wform">
        <label>World size</label>${seg('size', Object.entries(EP.WORLD_SIZES).map(([k, v]) => [k, v.label]), o.size || 'medium')}
        <label>Land shape</label>${seg('shape', Object.entries(EP.WORLD_SHAPES).map(([k, v]) => [k, v.label]), o.shape || 'continent')}
        <label>Sea level</label>${seg('sea', [['low', 'Low'], ['normal', 'Normal'], ['high', 'High']], o.sea || 'normal')}
        <label>Starting life</label>${seg('life', [['civ', 'Civilisations'], ['wild', 'Wildlife only'], ['empty', 'Barren']], o.life || 'civ')}
        <label>Disasters</label>${seg('disasters', Object.entries(EP.DISASTER_LEVELS).map(([k, v]) => [k, v.label]), o.disasters || 'rare')}
        <label for="wf-seed">Seed</label><div class="seed-row"><input id="wf-seed" type="text" placeholder="Random" value="${esc(o.seedText || '')}" maxlength="24"><button type="button" class="btn" data-dice aria-label="Random seed" title="Random seed"><canvas data-icon="ui_dice" data-size="18"></canvas></button></div>
    </div>`;
};
EP.bindWorldForm = function (root) {
    paintIcons(root);
    root.querySelectorAll('.seg').forEach(s => s.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        s.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    }));
    const dice = root.querySelector('[data-dice]');
    if (dice) dice.addEventListener('click', () => { root.querySelector('#wf-seed').value = String((Math.random() * 1e6) | 0); });
};
EP.readWorldForm = function (root) {
    const v = n => root.querySelector(`.seg[data-name=${n}] .on`)?.dataset.v;
    const seedText = root.querySelector('#wf-seed').value.trim();
    const seed = seedText ? (/^\d+$/.test(seedText) ? +seedText >>> 0 : EP.hashString(seedText)) : ((Math.random() * 1e9) >>> 0);
    return { size: v('size'), shape: v('shape'), sea: v('sea'), life: v('life'), disasters: v('disasters'), seed, seedText };
};
})();
