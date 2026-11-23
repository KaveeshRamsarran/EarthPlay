/* EarthPlay — game shell: main loop, input, modes (title demo / play), persistence glue. */
(function () {
'use strict';
const EP = globalThis.EP;
const $ = s => document.querySelector(s);
const SPEEDS = [0, 1, 2, 5, 10];
const GLOBAL_SFX = new Set(['war', 'peace', 'age', 'fall', 'conquest', 'nuke']);

class Game {
    constructor() {
        this.canvas = $('#world');
        this.renderer = new EP.Renderer(this.canvas);
        this.minimap = new EP.Minimap($('#minimap'), this.renderer);
        this.audio = new EP.AudioFX();
        this.ui = new EP.UI(this);
        this.mode = 'title';
        this.speed = 1; this.prevSpeed = 1;
        this.tool = EP.TOOL_BY_ID.inspect;
        this.brushSize = 3;
        this.acc = 0; this.lastT = 0;
        this.keys = new Set();
        this.pointers = new Map();
        this.autosave = true; this.lastAutosave = performance.now();
        this.modalOpen = false;
        this.unsub = [];
        this.loadSettings();
        this.ui.build();
        if (window.innerWidth < 860) document.querySelector('#minimap-wrap').classList.add('collapsed');
        this.bindInput();
        window.addEventListener('resize', () => { this.renderer.resize(); });
        requestAnimationFrame(t => this.loop(t));
    }

    // ------------------------------------------------------------ worlds
    useSim(sim) {
        for (const f of this.unsub) f();
        this.unsub = [];
        this.sim = sim;
        this.renderer.attach(sim);
        this.minimap.attach(sim);
        this.renderer.follow = -1; this.renderer.selection = null;
        this.ui.closePanel();
        $('#feed').innerHTML = '';
        this.unsub.push(sim.on('sfx', e => this.onSfx(e)));
        this.unsub.push(sim.on('log', e => { if (this.mode === 'play') { this.ui.pushLog(e); if (e.type === 'war' || e.type === 'fall' || e.type === 'age') this.audio.play('notify', 0.6); } }));
        this.unsub.push(sim.on('toast', m => this.ui.toast(m)));
        this.unsub.push(sim.on('death', u => {
            if (this.mode === 'play' && this.renderer.selection && this.renderer.selection.type === 'unit' && this.renderer.selection.id === u.id)
                this.ui.toast(`${u.name || EP.SPECIES[u.species].name} has died (${u.cause})`);
        }));
        this.acc = 0;
    }
    newWorld(opts, demo = false) {
        $('#loading').hidden = false;
        $('#loading-text').textContent = demo ? 'Awakening a world…' : 'Shaping the world…';
        setTimeout(() => {
            const sim = new EP.Sim(opts);
            if (demo) for (let i = 0; i < 1600; i++) sim.update();
            this.useSim(sim);
            if (!demo) { this.lastOpts = opts; this.setMode('play'); this.setSpeed(1); }
            else { this.renderer.cam.zoom = this.renderer.cam.tz = 1.8; this.demoT = 0; }
            $('#loading').hidden = true;
        }, 40);
    }
    setMode(m) {
        this.mode = m;
        $('#title-screen').hidden = m !== 'title';
        $('#hud').hidden = m !== 'play';
        document.body.classList.toggle('playing', m === 'play');
        if (m === 'play') { this.renderer.fitWorld(); this.selectTool('inspect'); }
    }
    async saveTo(slot) {
        const meta = await EP.Save.store(slot, this.sim, this.renderer.thumbnail());
        this.lastAutosave = performance.now();
        return meta;
    }
    async loadFrom(slot) {
        const sim = await EP.Save.load(slot);
        this.useSim(sim);
        this.lastOpts = sim.opts;
        this.setMode('play');
        this.ui.toast(`Loaded — year ${sim.year}`);
    }
    loadSettings() {
        try {
            const s = JSON.parse(localStorage.getItem('earthplay.settings') || 'null');
            if (s) { Object.assign(this.renderer.settings, s.render || {}); if (s.autosave != null) this.autosave = s.autosave; }
        } catch (e) { /* ignore */ }
        $('#btn-borders').classList.toggle('active', this.renderer.settings.borders);
    }
    saveSettings() {
        try { localStorage.setItem('earthplay.settings', JSON.stringify({ render: this.renderer.settings, autosave: this.autosave })); } catch (e) { /* ignore */ }
        $('#btn-borders').classList.toggle('active', this.renderer.settings.borders);
    }

    // ------------------------------------------------------------ controls
    setSpeed(s) {
        if (s > 0) this.prevSpeed = s;
        this.speed = s;
        this.ui.syncSpeed();
    }
    togglePause() { this.setSpeed(this.speed === 0 ? this.prevSpeed || 1 : 0); }
    selectTool(id) {
        this.tool = EP.TOOL_BY_ID[id];
        this.ui.syncTool();
        this.canvas.style.cursor = this.tool.type === 'inspect' ? 'default' : 'crosshair';
    }
    toggleBorders() {
        this.renderer.settings.borders = !this.renderer.settings.borders;
        this.minimap.v = -1;
        this.saveSettings();
    }
    onSfx(e) {
        if (this.mode !== 'play') return;
        if (GLOBAL_SFX.has(e.name) || e.x == null) { this.audio.play(e.name); return; }
        const v = this.renderer.view;
        if (!v) return;
        const m = 6;
        if (e.x < v.tx0 - m || e.x > v.tx1 + m || e.y < v.ty0 - m || e.y > v.ty1 + m) return;
        const z = this.renderer.cam.zoom;
        let vol = EP.clamp(0.35 + z * 0.2, 0.3, 1);
        if (e.quiet) { if (z < 2) return; vol *= 0.5; }
        this.audio.play(e.name, vol);
    }

    // ------------------------------------------------------------ input
    bindInput() {
        const c = this.canvas;
        c.addEventListener('contextmenu', e => e.preventDefault());
        c.addEventListener('pointerdown', e => this.onDown(e));
        window.addEventListener('pointermove', e => this.onMove(e));
        window.addEventListener('pointerup', e => this.onUp(e));
        window.addEventListener('pointercancel', e => this.onUp(e));
        c.addEventListener('wheel', e => {
            e.preventDefault();
            if (this.mode !== 'play') return;
            const d = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
            this.renderer.zoomAt(Math.exp(-d * 0.0016), e.clientX, e.clientY);
        }, { passive: false });
        window.addEventListener('keydown', e => this.onKey(e, true));
        window.addEventListener('keyup', e => this.onKey(e, false));
        window.addEventListener('blur', () => { this.keys.clear(); this.painting = false; this.panning = false; });
        const mm = $('#minimap');
        let mmDrag = false;
        const mmGo = e => { const t = this.minimap.toTile(e); this.renderer.follow = -1; this.renderer.centerOn(t.x, t.y); };
        mm.addEventListener('pointerdown', e => { mmDrag = true; mm.setPointerCapture(e.pointerId); mmGo(e); });
        mm.addEventListener('pointermove', e => { if (mmDrag) mmGo(e); });
        mm.addEventListener('pointerup', () => { mmDrag = false; });
    }
    onDown(e) {
        this.audio.ensure();
        if (this.mode !== 'play') return;
        this.ui.hideTip();
        this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        this.canvas.setPointerCapture(e.pointerId);
        if (this.pointers.size === 2) { // pinch begins: cancel painting
            this.painting = false; this.panning = false;
            const [a, b] = [...this.pointers.values()];
            this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
            return;
        }
        this.downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
        const pan = e.button === 1 || e.button === 2 || (this.tool.type === 'inspect' && e.button === 0) || this.keys.has(' ');
        if (pan) { this.panning = { x: e.clientX, y: e.clientY }; return; }
        if (e.button === 0) {
            this.painting = true;
            const t = this.renderer.screenToTile(e.clientX, e.clientY);
            this.lastPaint = t;
            this.applyAt(t.x, t.y);
            this.lastApply = performance.now();
        }
    }
    onMove(e) {
        if (this.mode !== 'play') return;
        const p = this.pointers.get(e.pointerId);
        if (p) { p.x = e.clientX; p.y = e.clientY; }
        if (this.pinch && this.pointers.size === 2) {
            const [a, b] = [...this.pointers.values()];
            const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
            const r = this.renderer;
            r.cam.x -= (cx - this.pinch.cx) / r.cam.zoom; r.cam.y -= (cy - this.pinch.cy) / r.cam.zoom;
            r.cam.tz = r.cam.zoom = EP.clamp(r.cam.zoom * d / this.pinch.d, r.minZoom(), 10);
            this.pinch = { d, cx, cy };
            return;
        }
        const t = this.renderer.screenToTile(e.clientX, e.clientY);
        this.renderer.cursor = e.target === this.canvas || this.painting ? { tx: t.x, ty: t.y, tool: this.tool, size: this.brushSize } : null;
        this.mouse = { x: e.clientX, y: e.clientY };
        if (this.panning) {
            const r = this.renderer;
            r.cam.x -= (e.clientX - this.panning.x) / r.cam.zoom;
            r.cam.y -= (e.clientY - this.panning.y) / r.cam.zoom;
            this.panning = { x: e.clientX, y: e.clientY };
            if (Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) > 4) r.follow = -1;
            return;
        }
        if (this.painting && this.tool.type === 'brush') {
            // Interpolate so fast strokes leave no gaps.
            const lp = this.lastPaint, step = Math.max(0.5, this.brushSize * 0.5);
            const d = Math.hypot(t.x - lp.x, t.y - lp.y);
            if (d >= step) {
                const n = Math.min(40, Math.floor(d / step));
                for (let i = 1; i <= n; i++) this.applyAt(lp.x + (t.x - lp.x) * i / n, lp.y + (t.y - lp.y) * i / n);
                this.lastPaint = t; this.lastApply = performance.now();
            }
        }
    }
    onUp(e) {
        this.pointers.delete(e.pointerId);
        if (this.pointers.size < 2) this.pinch = null;
        if (this.mode !== 'play') return;
        if (this.panning && this.tool.type === 'inspect' && this.downAt && e.button === 0 && Math.hypot(e.clientX - this.downAt.x, e.clientY - this.downAt.y) < 5) {
            const t = this.renderer.screenToTile(e.clientX, e.clientY);
            this.inspectAt(t.x, t.y);
        }
        this.painting = false; this.panning = false;
    }
    onKey(e, down) {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (down) this.keys.add(k); else { this.keys.delete(k); return; }
        if (this.mode !== 'play') return;
        this.audio.ensure();
        if (e.ctrlKey || e.metaKey) {
            if (k === 's') { e.preventDefault(); this.saveTo('auto').then(() => this.ui.toast('Quick-saved')).catch(err => this.ui.toast(err.message, 'bad')); }
            if (k === 'o') { e.preventDefault(); this.ui.openSaveLoad('load'); }
            return;
        }
        if (this.modalOpen) { if (k === 'Escape') this.ui.closeModal(); return; }
        switch (k) {
            case ' ': e.preventDefault(); this.togglePause(); break;
            case '1': this.setSpeed(1); break;
            case '2': this.setSpeed(2); break;
            case '3': this.setSpeed(5); break;
            case '4': this.setSpeed(10); break;
            case '[': this.setBrush(this.brushSize - 1); break;
            case ']': this.setBrush(this.brushSize + 1); break;
            case 'i': this.selectTool('inspect'); break;
            case 'b': this.toggleBorders(); break;
            case 'k': this.ui.togglePanel('realms'); break;
            case 'c': this.ui.togglePanel('chronicle'); break;
            case 'g': this.ui.togglePanel('stats'); break;
            case 'm': this.ui.toggleMinimap(); break;
            case 'h': case '?': this.ui.openHelp(); break;
            case 'f': { const s = this.renderer.selection; if (s && s.type === 'unit') { this.renderer.follow = this.renderer.follow === s.id ? -1 : s.id; this.ui.panelHTML = ''; } break; }
            case '+': case '=': this.renderer.zoomAt(1.25, this.renderer.W / 2, this.renderer.H / 2); break;
            case '-': case '_': this.renderer.zoomAt(0.8, this.renderer.W / 2, this.renderer.H / 2); break;
            case 'Escape': if (this.ui.panel) this.ui.closePanel(); else this.selectTool('inspect'); break;
        }
    }
    setBrush(n) {
        this.brushSize = EP.clamp(n, 1, 20);
        $('#brush-size').value = this.brushSize; $('#brush-val').textContent = this.brushSize;
        if (this.renderer.cursor) this.renderer.cursor.size = this.brushSize;
    }
    applyAt(tx, ty) {
        const t = this.tool, w = this.sim.world;
        if (!t || t.type === 'inspect') return;
        if (tx < 0 || ty < 0 || tx >= w.w || ty >= w.h) return;
        this.sim.powers.apply(t.id, tx, ty, this.brushSize);
    }
    inspectAt(tx, ty) {
        const sim = this.sim;
        const u = sim.grid.nearest(tx, ty + 0.3, 1.1, () => true) || this.unitNear(tx, ty);
        if (u) { this.ui.openPanel('unit', u.id); this.audio.play('select'); return; }
        const v = sim.vehicles.nearest(tx, ty, 1.2);
        if (v) { this.ui.openPanel('vehicle', v.id); this.audio.play('select'); return; }
        const w = sim.world;
        if (!w.inb(tx | 0, ty | 0)) return;
        const bid = w.bld[w.idx(tx | 0, ty | 0)];
        if (bid >= 0 && sim.civ.buildings.get(bid)?.type !== 'farm') { this.ui.openPanel('building', bid); this.audio.play('select'); return; }
        const oi = w.idx(tx | 0, ty | 0);
        if (w.ore[oi]) { this.ui.openPanel('ore', oi); this.audio.play('select'); return; }
        const c = sim.civ.cityAt(tx, ty);
        if (c) { this.ui.openPanel('city', c.id); this.audio.play('select'); return; }
        this.ui.closePanel();
    }
    unitNear(tx, ty) {
        // Fallback linear scan (grid is rebuilt each tick, so it's normally enough)
        let best = null, bd = 1.2 * 1.2;
        for (const u of this.sim.units) { if (u.dead || u.boarded > 0) continue; const d = EP.dist2(u.x, u.y - 0.4, tx, ty); if (d < bd) { bd = d; best = u; } }
        return best;
    }

    // ------------------------------------------------------------ loop
    loop(t) {
        requestAnimationFrame(tt => this.loop(tt));
        const dt = Math.min(0.1, (t - (this.lastT || t)) / 1000);
        this.lastT = t;
        if (!this.sim) return;
        const sim = this.sim, r = this.renderer;
        const speed = this.mode === 'title' ? 2 : (this.modalOpen ? 0 : this.speed);
        if (speed > 0) {
            this.acc += dt * EP.TPS * speed;
            let n = Math.floor(this.acc);
            const max = 24;
            if (n > max) { n = max; this.acc = max; }
            const t0 = performance.now();
            for (let i = 0; i < n; i++) {
                sim.update();
                this.acc -= 1;
                if (performance.now() - t0 > 28) { this.acc = Math.min(this.acc, 1); break; }
            }
        }
        // Continuous tool use while held
        if (this.mode === 'play' && this.painting && this.tool.repeat > 0 && this.mouse) {
            const now = performance.now();
            if (now - this.lastApply >= this.tool.repeat) {
                const p = r.screenToTile(this.mouse.x, this.mouse.y);
                this.applyAt(p.x, p.y);
                this.lastApply = now; this.lastPaint = p;
            }
        }
        // Keyboard pan
        if (this.mode === 'play' && !this.modalOpen) {
            let kx = 0, ky = 0;
            if (this.keys.has('a') || this.keys.has('ArrowLeft')) kx--;
            if (this.keys.has('d') || this.keys.has('ArrowRight')) kx++;
            if (this.keys.has('w') || this.keys.has('ArrowUp')) ky--;
            if (this.keys.has('s') || this.keys.has('ArrowDown')) ky++;
            if (kx || ky) { r.follow = -1; r.cam.x += kx * 520 * dt / r.cam.zoom; r.cam.y += ky * 520 * dt / r.cam.zoom; }
        }
        if (this.mode === 'title') {
            this.demoT = (this.demoT || 0) + dt;
            r.cam.x += Math.cos(this.demoT * 0.07) * 14 * dt;
            r.cam.y += Math.sin(this.demoT * 0.05) * 9 * dt;
        }
        r.render(speed > 0 ? EP.clamp(this.acc, 0, 1) : 1, dt);
        if (this.mode === 'play') {
            this.minimap.draw();
            this.ui.update();
            this.audio.ambient(r.cam.zoom, sim.env.weather.type === 'clear' ? 0 : sim.env.weather.intensity);
            if (this.autosave && performance.now() - this.lastAutosave > 180000) {
                this.lastAutosave = performance.now();
                this.saveTo('auto').catch(() => { /* storage full; ignore */ });
            }
        }
    }
}
EP.Game = Game;
})();
