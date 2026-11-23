/* EarthPlay — renderer: baked terrain chunks, territory overlay, entities, effects, lighting, weather, minimap. */
(function () {
'use strict';
const EP = globalThis.EP;
const { T, TERRAIN, Color, Sprites } = EP;
const TS = 8;          // world px per tile
const CH = 32;         // tiles per chunk edge
const TERR_S = 4;      // territory overlay px per tile

const TPAL = TERRAIN.map(d => d.colors.map(c => Color.hexToRgb(c)));
const WATER_STOPS = [[0, [14, 52, 98]], [0.45, [24, 84, 145]], [0.78, [44, 125, 186]], [1, [84, 168, 214]]];
const FOAM = [222, 241, 250];
const SNOWS = [[244, 248, 251], [228, 236, 244], [210, 221, 233]];
const CARRY_COL = Object.fromEntries(Object.entries(EP.RES_INFO).map(([k, v]) => [k, v.color]));
const isWaterish = t => t <= 1 || t === T.BRIDGE;

function waterColor(f) {
    for (let k = 1; k < WATER_STOPS.length; k++) {
        if (f <= WATER_STOPS[k][0]) {
            const [a0, c0] = WATER_STOPS[k - 1], [a1, c1] = WATER_STOPS[k];
            const t = (f - a0) / (a1 - a0);
            return [c0[0] + (c1[0] - c0[0]) * t, c0[1] + (c1[1] - c0[1]) * t, c0[2] + (c1[2] - c0[2]) * t];
        }
    }
    return WATER_STOPS[WATER_STOPS.length - 1][1];
}

class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.cam = { x: 0, y: 0, zoom: 2, tz: 2, ax: null, ay: null };
        this.settings = { borders: true, daynight: true, weather: true };
        this.time = 0;
        this.follow = -1;
        this.selection = null;  // {type:'unit'|'building'|'city', id}
        this.cursor = null;     // {tx,ty, tool, size}
        this.lastTerr = 0;
        this.resize();
    }

    // ------------------------------------------------------------ setup
    attach(sim) {
        this.sim = sim;
        const w = sim.world;
        this.cw = Math.ceil(w.w / CH); this.chh = Math.ceil(w.h / CH);
        this.chunks = [];
        for (let cy = 0; cy < this.chh; cy++) for (let cx = 0; cx < this.cw; cx++) {
            const c = document.createElement('canvas');
            c.width = CH * TS; c.height = CH * TS;
            const g = c.getContext('2d');
            this.chunks.push({ canvas: c, ctx: g, img: g.createImageData(CH * TS, CH * TS), cx, cy });
        }
        for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) this.paintTile(x, y);
        for (const ch of this.chunks) ch.ctx.putImageData(ch.img, 0, 0);
        w.dirty.clear();
        // Territory overlay
        this.terr = document.createElement('canvas');
        this.terr.width = w.w * TERR_S; this.terr.height = w.h * TERR_S;
        this.terrCtx = this.terr.getContext('2d');
        this.terrImg = this.terrCtx.createImageData(this.terr.width, this.terr.height);
        this.terr32 = new Uint32Array(this.terrImg.data.buffer);
        this.fill = document.createElement('canvas');
        this.fill.width = w.w; this.fill.height = w.h;
        this.fillCtx = this.fill.getContext('2d');
        this.fillImg = this.fillCtx.createImageData(w.w, w.h);
        this.fill32 = new Uint32Array(this.fillImg.data.buffer);
        this.terrVersion = -1;
        this.litQueue = [];
        // Clouds
        this.clouds = [];
        const n = 4 + Math.round(w.w * w.h / 6000);
        for (let i = 0; i < n; i++) this.clouds.push({ x: Math.random() * w.w * TS, y: Math.random() * w.h * TS, s: 0.7 + Math.random() * 0.9 });
        if (!this.cloudShadow) {
            const c = document.createElement('canvas'); c.width = Sprites.cloud.width; c.height = Sprites.cloud.height;
            const g = c.getContext('2d'); g.drawImage(Sprites.cloud, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgba(10,20,40,0.35)'; g.fillRect(0, 0, c.width, c.height);
            this.cloudShadow = c;
        }
        this.fitWorld();
    }
    resize() {
        this.dpr = Math.min(2, window.devicePixelRatio || 1);
        this.W = this.canvas.clientWidth || window.innerWidth;
        this.H = this.canvas.clientHeight || window.innerHeight;
        this.canvas.width = Math.round(this.W * this.dpr);
        this.canvas.height = Math.round(this.H * this.dpr);
    }
    minZoom() {
        const w = this.sim.world;
        return Math.min(this.W / (w.w * TS), this.H / (w.h * TS)) * 0.8;
    }
    fitWorld() {
        const w = this.sim.world;
        this.cam.x = w.w * TS / 2; this.cam.y = w.h * TS / 2;
        this.cam.zoom = this.cam.tz = Math.max(this.minZoom(), Math.min(this.W / (w.w * TS), this.H / (w.h * TS)) * 1.05);
    }
    zoomAt(factor, sx, sy) {
        this.cam.tz = EP.clamp(this.cam.tz * factor, this.minZoom(), 10);
        this.cam.ax = sx; this.cam.ay = sy;
    }
    centerOn(tx, ty, zoom) {
        this.cam.x = tx * TS; this.cam.y = ty * TS;
        if (zoom) this.cam.zoom = this.cam.tz = EP.clamp(zoom, this.minZoom(), 10);
    }
    screenToTile(sx, sy) {
        return { x: ((sx - this.W / 2) / this.cam.zoom + this.cam.x) / TS, y: ((sy - this.H / 2) / this.cam.zoom + this.cam.y) / TS };
    }
    tileToScreen(tx, ty) {
        return { x: (tx * TS - this.cam.x) * this.cam.zoom + this.W / 2, y: (ty * TS - this.cam.y) * this.cam.zoom + this.H / 2 };
    }

    // ------------------------------------------------------------ terrain baking
    paintTile(tx, ty) {
        const w = this.sim.world, W = w.w, H = w.h;
        const ch = this.chunks[((ty / CH) | 0) * this.cw + ((tx / CH) | 0)];
        const data = ch.img.data, stride = CH * TS;
        const ox = (tx % CH) * TS, oy = (ty % CH) * TS;
        const i0 = ty * W + tx, t0 = w.terrain[i0];
        const hAt = (x, y) => w.height[EP.clamp(y, 0, H - 1) * W + EP.clamp(x, 0, W - 1)];
        const hl = (hAt(tx - 1, ty - 1) - hAt(tx + 1, ty + 1));
        const land0 = t0 > 1;
        const shade = land0 ? EP.clamp(1 + hl * 0.0065, 0.74, 1.24) * (1 + (w.height[i0] - 140) * 0.0011) : 1;
        const structured = t0 === T.FARM || t0 === T.ROAD || t0 === T.PAVED || t0 === T.BRIDGE;
        const ore = w.ore[i0], opx = ore ? Sprites.orePix[ore][(EP.hash2(tx, ty, 61) * 3) | 0] : null;
        let bridgeH = false;
        if (t0 === T.BRIDGE) { const n = w.t(tx, ty - 1), s = w.t(tx, ty + 1); bridgeH = n <= 1 || s <= 1; }
        const tree = w.tree[i0];
        const tpx = tree ? Sprites.treePix[tree] : null;
        const tAt = (px, py) => {
            const sx = EP.clamp(Math.floor(px / TS), 0, W - 1), sy = EP.clamp(Math.floor(py / TS), 0, H - 1);
            return w.terrain[sy * W + sx];
        };
        for (let py = 0; py < TS; py++) for (let px = 0; px < TS; px++) {
            const wx = tx * TS + px, wy = ty * TS + py;
            let t = t0, si = i0;
            if (!structured) {
                const bx = wx >> 1, by = wy >> 1;
                const sx = EP.clamp(Math.floor((wx + (EP.hash2(bx, by, 11) - 0.5) * 5.5) / TS), 0, W - 1);
                const sy = EP.clamp(Math.floor((wy + (EP.hash2(bx, by, 23) - 0.5) * 5.5) / TS), 0, H - 1);
                si = sy * W + sx;
                const ts = w.terrain[si];
                if (ts !== T.FARM && ts !== T.ROAD && ts !== T.PAVED && ts !== T.BRIDGE) t = ts; else si = i0;
            }
            let r, g, b;
            if (t <= 1) {
                const f = EP.clamp((w.height[si] - 20) / (EP.SEA - 20), 0, 1);
                [r, g, b] = waterColor(f);
                const n = (EP.hash2(wx >> 1, wy >> 1, 3) - 0.5) * 7;
                r += n; g += n; b += n;
                if (!isWaterish(tAt(wx + 3, wy)) || !isWaterish(tAt(wx - 3, wy)) || !isWaterish(tAt(wx, wy + 3)) || !isWaterish(tAt(wx, wy - 3))) {
                    if (EP.hash2(wx, wy, 9) < 0.7) { r = r * 0.45 + FOAM[0] * 0.55; g = g * 0.45 + FOAM[1] * 0.55; b = b * 0.45 + FOAM[2] * 0.55; }
                } else if (EP.hash2(wx, wy, 31) < 0.012) { r += 30; g += 30; b += 26; }
            } else {
                const P = TPAL[t];
                let c;
                switch (t) {
                    case T.FARM: {
                        const row = (wy + (tx & 1)) % 4;
                        c = row === 0 ? P[3] : (EP.hash2(wx, wy, 4) < 0.5 ? P[0] : P[1]);
                        if (row !== 0 && EP.hash2(wx, wy, 41) < 0.07) c = [217, 196, 90];
                        break;
                    }
                    case T.MOUNTAIN: {
                        const n = EP.hash2(wx, wy, 5) * 0.5 + EP.hash2(wx >> 2, wy >> 2, 6) * 0.5;
                        c = P[(n * 4) | 0];
                        const hh = w.height[si] + (EP.hash2(wx >> 1, wy >> 1, 12) - 0.5) * 14 - py * 0.6;
                        if (hh > EP.SNOWCAP) c = SNOWS[EP.hash2(wx, wy, 13) < 0.55 ? 0 : (((px + py * 2 + (EP.hash2(wx >> 2, wy >> 1, 14) * 3 | 0)) % 5) === 0 ? 2 : 1)];
                        else if (((px + py + (EP.hash2(tx, ty, 2) * 4 | 0)) % 6) === 0) c = P[3];
                        break;
                    }
                    case T.HILLS: {
                        const n = EP.hash2(wx, wy, 5) * 0.6 + EP.hash2(wx >> 2, wy >> 2, 6) * 0.4;
                        c = P[(n * 4) | 0];
                        if (((wy + ((wx >> 2) & 1) * 2) & 3) === 0 && EP.hash2(wx >> 2, wy, 8) < 0.6) c = P[3];
                        break;
                    }
                    case T.LAVA: c = P[(EP.hash2(wx >> 1, wy >> 1, 17) * 4) | 0]; if (EP.hash2(wx, wy, 18) < 0.05) c = [255, 240, 170]; break;
                    case T.ROAD: c = P[(EP.hash2(wx, wy, 5) * 3) | 0]; if (EP.hash2(wx, wy, 19) < 0.07) c = P[3]; break;
                    case T.PAVED: { // cobbles with mortar lines
                        const row = wy % 3, off = ((wy / 3) | 0) & 1 ? 2 : 0;
                        c = row === 2 || (wx + off) % 4 === 3 ? P[3] : P[(EP.hash2((wx + off) >> 2, wy, 5) * 3) | 0];
                        break;
                    }
                    case T.BRIDGE: { // planks over water, rails on the edges
                        const along = bridgeH ? px : py, across = bridgeH ? py : px;
                        if (across === 0 || across === 7) { const wc = waterColor(0.85); c = wc; }
                        else if (across === 1 || across === 6) c = P[3];
                        else c = along % 2 ? P[1] : (EP.hash2(wx, wy, 5) < 0.5 ? P[0] : P[2]);
                        break;
                    }
                    default: {
                        const n = EP.hash2(wx, wy, 5) * 0.55 + EP.hash2(wx >> 2, wy >> 2, 6 + t) * 0.45;
                        c = P[EP.clamp((n * 4) | 0, 0, 3)];
                        if (t === T.GRASS && EP.hash2(wx, wy, 44) < 0.012) c = EP.hash2(wx, wy, 45) < 0.5 ? [240, 220, 90] : [235, 120, 160];
                    }
                }
                const sh = t === T.LAVA || t === T.BRIDGE ? 1 : shade;
                r = c[0] * sh; g = c[1] * sh; b = c[2] * sh;
            }
            if (opx) { const p = opx[py * TS + px]; if (p) { r = p[0]; g = p[1]; b = p[2]; } }
            if (tpx) {
                const p = tpx[py * TS + px];
                if (p) { r = p[0] * shade; g = p[1] * shade; b = p[2] * shade; }
                else if (px > 0 && py > 0 && tpx[(py - 1) * TS + px - 1]) { r *= 0.68; g *= 0.68; b *= 0.72; }
            }
            const o = ((oy + py) * stride + ox + px) * 4;
            data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
        }
    }
    flushDirty() {
        const w = this.sim.world;
        if (!w.dirty.size) return;
        const todo = new Set();
        for (const i of w.dirty) {
            const x = i % w.w, y = (i / w.w) | 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx, ny = y + dy;
                if (nx >= 0 && ny >= 0 && nx < w.w && ny < w.h) todo.add(ny * w.w + nx);
            }
        }
        w.dirty.clear();
        const rects = new Map();
        for (const i of todo) {
            const x = i % w.w, y = (i / w.w) | 0;
            this.paintTile(x, y);
            const ci = ((y / CH) | 0) * this.cw + ((x / CH) | 0);
            const lx = x % CH, ly = y % CH;
            const r = rects.get(ci);
            if (!r) rects.set(ci, [lx, ly, lx, ly]);
            else { if (lx < r[0]) r[0] = lx; if (ly < r[1]) r[1] = ly; if (lx > r[2]) r[2] = lx; if (ly > r[3]) r[3] = ly; }
        }
        for (const [ci, r] of rects) {
            const ch = this.chunks[ci];
            ch.ctx.putImageData(ch.img, 0, 0, r[0] * TS, r[1] * TS, (r[2] - r[0] + 1) * TS, (r[3] - r[1] + 1) * TS);
        }
    }
    rebuildTerritory() {
        const sim = this.sim, w = sim.world, civ = sim.civ;
        const W = w.w, H = w.h, S = TERR_S, SW = W * S;
        const d32 = this.terr32, f32 = this.fill32;
        d32.fill(0); f32.fill(0);
        const info = new Map();
        for (const c of civ.cities.values()) {
            const k = civ.kingdoms.get(c.kingdomId);
            if (!k) continue;
            const [r, g, b] = Color.hexToRgb(k.color);
            info.set(c.id, { k: k.id, r, g, b });
        }
        const own = w.owner;
        const kid = (x, y) => { if (x < 0 || y < 0 || x >= W || y >= H) return -1; const o = own[y * W + x]; if (o < 0) return -1; const f = info.get(o); return f ? f.k : -1; };
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const o = own[y * W + x];
            if (o < 0) continue;
            const f = info.get(o);
            if (!f) continue;
            const k = f.k;
            const kN = kid(x, y - 1), kS = kid(x, y + 1), kW = kid(x - 1, y), kE = kid(x + 1, y);
            const oN = y > 0 ? own[(y - 1) * W + x] : -1, oS = y < H - 1 ? own[(y + 1) * W + x] : -1, oW = x > 0 ? own[y * W + x - 1] : -1, oE = x < W - 1 ? own[y * W + x + 1] : -1;
            const rgb = (f.b << 16) | (f.g << 8) | f.r;
            f32[y * W + x] = (255 << 24) | rgb;
            for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
                let a = 40;
                if ((sy === 0 && kN !== k) || (sy === S - 1 && kS !== k) || (sx === 0 && kW !== k) || (sx === S - 1 && kE !== k)) a = 235;
                else if ((sy === 1 && kN !== k) || (sy === S - 2 && kS !== k) || (sx === 1 && kW !== k) || (sx === S - 2 && kE !== k)) a = 110;
                else if (((sy === 0 && oN !== o) || (sy === S - 1 && oS !== o) || (sx === 0 && oW !== o) || (sx === S - 1 && oE !== o)) && ((sx + sy) & 1)) a = 120;
                d32[(y * S + sy) * SW + x * S + sx] = (a << 24) | rgb;
            }
        }
        this.terrCtx.putImageData(this.terrImg, 0, 0);
        this.fillCtx.putImageData(this.fillImg, 0, 0);
    }

    // ------------------------------------------------------------ frame
    render(alpha, dt) {
        const sim = this.sim, ctx = this.ctx, cam = this.cam, w = sim.world;
        this.time += dt;
        this.flushDirty();
        const now = performance.now();
        if (w.ownerVersion !== this.terrVersion && now - this.lastTerr > 250) { this.terrVersion = w.ownerVersion; this.lastTerr = now; this.rebuildTerritory(); }

        // Camera: smooth zoom around anchor, follow target, clamp.
        if (Math.abs(cam.tz - cam.zoom) > 0.0005) {
            let before = null;
            if (cam.ax != null) before = this.screenToTile(cam.ax, cam.ay);
            cam.zoom += (cam.tz - cam.zoom) * Math.min(1, dt * 14);
            if (before) { const after = this.screenToTile(cam.ax, cam.ay); cam.x += (before.x - after.x) * TS; cam.y += (before.y - after.y) * TS; }
        } else cam.zoom = cam.tz;
        if (this.follow >= 0) {
            const u = sim.unitMap.get(this.follow);
            if (u) { cam.x += (u.x * TS - cam.x) * Math.min(1, dt * 6); cam.y += (u.y * TS - cam.y) * Math.min(1, dt * 6); }
            else this.follow = -1;
        }
        cam.x = EP.clamp(cam.x, 0, w.w * TS); cam.y = EP.clamp(cam.y, 0, w.h * TS);

        const z = cam.zoom, dpr = this.dpr;
        const shake = sim.fx.shakeAmt * 5;
        const ox = Math.round((this.W / 2 - cam.x * z + (Math.random() - 0.5) * shake) * dpr);
        const oy = Math.round((this.H / 2 - cam.y * z + (Math.random() - 0.5) * shake) * dpr);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#0c2440';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.setTransform(z * dpr, 0, 0, z * dpr, ox, oy);
        ctx.imageSmoothingEnabled = false;

        // Visible world-pixel rect
        const vx0 = cam.x - this.W / 2 / z - 16, vy0 = cam.y - this.H / 2 / z - 16;
        const vx1 = cam.x + this.W / 2 / z + 16, vy1 = cam.y + this.H / 2 / z + 32;
        const tx0 = Math.max(0, (vx0 / TS) | 0), ty0 = Math.max(0, (vy0 / TS) | 0);
        const tx1 = Math.min(w.w - 1, (vx1 / TS) | 0), ty1 = Math.min(w.h - 1, (vy1 / TS) | 0);
        this.view = { tx0, ty0, tx1, ty1 };

        // Terrain
        for (const ch of this.chunks) {
            const x = ch.cx * CH * TS, y = ch.cy * CH * TS;
            if (x > vx1 || y > vy1 || x + CH * TS < vx0 || y + CH * TS < vy0) continue;
            ctx.drawImage(ch.canvas, x, y);
        }
        // Water shimmer
        if (z >= 1.1) this.drawShimmer(ctx, tx0, ty0, tx1, ty1);
        // Territory: solid realm colours when zoomed out, crisp borders up close.
        if (this.settings.borders) {
            const fa = EP.clamp(0.66 - z * 0.3, 0, 0.5);
            if (fa > 0.01) { ctx.globalAlpha = fa; ctx.drawImage(this.fill, 0, 0, w.w, w.h, 0, 0, w.w * TS, w.h * TS); }
            ctx.globalAlpha = z > 3 ? 0.7 : 1;
            ctx.drawImage(this.terr, 0, 0, this.terr.width, this.terr.height, 0, 0, w.w * TS, w.h * TS);
            ctx.globalAlpha = 1;
        }
        this.litQueue.length = 0;
        const lights = [];
        this.drawFires(ctx, vx0, vy0, vx1, vy1, lights);
        this.drawEntities(ctx, alpha, vx0, vy0, vx1, vy1, lights);
        this.drawEffects(ctx, lights, vx0, vy0, vx1, vy1);
        this.drawClouds(ctx, dt);
        // Lighting
        const dark = this.settings.daynight ? (1 - sim.env.daylight()) * 0.78 : 0;
        if (dark > 0.02) this.drawNight(ctx, dark, lights, tx0, ty0, tx1, ty1, ox, oy);
        if (this.settings.weather) this.drawWeather(ctx);
        // Overlays in world space
        ctx.setTransform(z * dpr, 0, 0, z * dpr, ox, oy);
        this.drawCursor(ctx);
        this.drawSelection(ctx, alpha);
        // Screen-space
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.drawWars(ctx);
        this.drawRealmLabels(ctx);
        this.drawTexts(ctx);
        if (sim.fx.flashAmt > 0.01) {
            ctx.globalAlpha = Math.min(1, sim.fx.flashAmt);
            ctx.fillStyle = sim.fx.flashColor; ctx.fillRect(0, 0, this.W, this.H);
            ctx.globalAlpha = 1;
        }
    }

    drawShimmer(ctx, tx0, ty0, tx1, ty1) {
        const w = this.sim.world, t = this.time * 0.35;
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
            const i = y * w.w + x;
            if (w.terrain[i] > 1) continue;
            const ph = (EP.hash2(x, y, 77) + t) % 1;
            if (ph < 0.06) {
                const s = ph / 0.06;
                ctx.fillRect(x * TS + 1 + ((EP.hash2(x, y, 78) * 4) | 0) + s * 2, y * TS + ((EP.hash2(x, y, 79) * 7) | 0), 2 + (s < 0.5 ? 1 : 0), 1);
            }
        }
    }
    drawFires(ctx, vx0, vy0, vx1, vy1, lights) {
        const sim = this.sim, w = sim.world;
        const f = (this.time * 12) | 0;
        for (const i of sim.env.fires) {
            const x = (i % w.w) * TS, y = ((i / w.w) | 0) * TS;
            if (x < vx0 || y < vy0 || x > vx1 || y > vy1) continue;
            ctx.drawImage(Sprites.flame(f + i), x + 1, y - 2);
            if (lights.length < 600 && (i & 1)) lights.push([x + 4, y + 2, 14, 'fire']);
        }
    }

    drawEntities(ctx, alpha, vx0, vy0, vx1, vy1, lights) {
        const sim = this.sim, civ = sim.civ, z = this.cam.zoom;
        const list = [];
        for (const b of civ.buildings.values()) {
            const x = b.x * TS, y = (b.y + b.h) * TS;
            if (x > vx1 || y < vy0 || x + b.w * TS < vx0 || y - 40 > vy1) continue;
            list.push({ y: y - 0.1, b });
        }
        const dots = z < 0.75;
        for (const v of sim.vehicles.list) {
            if (v.dead) continue;
            const x = (v.px + (v.x - v.px) * alpha) * TS, y = (v.py + (v.y - v.py) * alpha) * TS;
            if (x < vx0 - 16 || x > vx1 + 16 || y < vy0 || y > vy1 + 16) continue;
            list.push({ y: y + 1, v, x, py: y });
        }
        for (const u of sim.units) {
            if (u.dead || u.boarded > 0) continue;
            const x = (u.px + (u.x - u.px) * alpha) * TS, y = (u.py + (u.y - u.py) * alpha) * TS;
            if (x < vx0 || x > vx1 || y < vy0 || y > vy1 + 16) continue;
            list.push({ y: y + (u.sp.fly ? 40 : 0), u, x, py: y });
        }
        list.sort((a, b) => a.y - b.y);
        // Shadows first
        if (!dots) {
            ctx.fillStyle = 'rgba(0,0,0,0.28)';
            for (const e of list) if (e.u && e.u.kind !== 'aquatic') {
                const fly = e.u.sp.fly;
                const sw = Math.max(3, Math.round(Sprites.bodyWidth(e.u.species) * (fly ? 0.8 : 0.7)));
                ctx.fillRect(Math.round(e.x - sw / 2), Math.round(e.py - 1 + (fly ? 4 : 0)), sw, fly ? 3 : 2);
                if (!fly && sw > 4) ctx.fillRect(Math.round(e.x - sw / 2) + 1, Math.round(e.py), sw - 2, 1);
            }
        }
        const frameT = this.time * 7;
        for (const e of list) {
            if (e.b) { this.drawBuilding(ctx, e.b, lights); continue; }
            if (e.v) { this.drawVehicle(ctx, e.v, e.x, e.py, lights, dots); continue; }
            const u = e.u;
            const k = u.kingdomId >= 0 ? civ.kingdoms.get(u.kingdomId) : null;
            if (dots) {
                ctx.fillStyle = k ? k.color : u.kind === 'monster' ? '#ff3355' : u.kind === 'aquatic' ? '#9fd3ff' : u.kind === 'civ' ? '#dddddd' : '#c9a36b';
                const s = u.species === 'dragon' || u.species === 'ufo' ? 10 : 2.4 / z;
                ctx.fillRect(e.x - s / 2, e.py - s, s, s);
                continue;
            }
            const color = k ? k.color : '#9a9a9a';
            const frame = (u.moving || u.state === 'work') ? ((frameT + u.id * 0.37) | 0) & 1 : 0;
            const spr = Sprites.unit(u, color, frame);
            let s = 1;
            if (u.kind === 'civ' && !u.adult) s = 0.7;
            else if (u.kind === 'animal' && !u.adult) s = 0.7;
            if (u.traits.includes('giant')) s = 1.35;
            const sw = spr.width * s, sh = spr.height * s;
            const frozen = u.frozen > 0;
            const lift = u.sp.fly ? (u.sp.lift || 10) + (frozen ? 0 : Math.sin(this.time * 3 + u.id) * 2) : (u.kind === 'aquatic' ? -2 : 0);
            const dx = Math.round(e.x - sw / 2), dy = Math.round(e.py - sh + 1 - lift);
            if (u.species === 'ufo' && u.state === 'abduct' && u.workT > 0) this.drawBeam(ctx, u, e.x, dy + sh, lights);
            if (u.kind === 'aquatic' || (u.sp.amphibious && sim.world.isWater(u.x, u.y))) ctx.globalAlpha = 0.75;
            ctx.drawImage(spr, dx, dy, sw, sh);
            if (u.hitT > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.7; ctx.drawImage(spr, dx, dy, sw, sh); ctx.globalCompositeOperation = 'source-over'; }
            ctx.globalAlpha = 1;
            if (frozen) { // encased in an ice cube
                ctx.fillStyle = 'rgba(170,225,255,0.5)'; ctx.fillRect(dx - 1, dy - 1, sw + 2, sh + 2);
                ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(dx - 1, dy - 1, sw + 2, 1); ctx.fillRect(dx - 1, dy, 1, Math.max(1, sh - 2));
                ctx.fillStyle = 'rgba(60,140,200,0.7)'; ctx.fillRect(dx - 1, dy + sh + 1, sw + 2, 1); ctx.fillRect(dx + sw + 1, dy, 1, sh + 1);
            }
            if (u.madT > 0 && ((this.time * 4 + u.id) & 1)) { ctx.fillStyle = '#ff3b3b'; ctx.fillRect(Math.round(e.x) - 2, dy - 4, 1, 1); ctx.fillRect(Math.round(e.x) + 1, dy - 4, 1, 1); ctx.fillRect(Math.round(e.x) - 1, dy - 3, 2, 1); }
            if (u.kind === 'civ' && u.adult) {
                const wx = dx + (u.face > 0 ? sw - 1 : 0);
                if (u.job === 'warrior' || (u.wpn && (u.state === 'fight' || u.state === 'siege'))) this.drawWeapon(ctx, u, wx, dy);
                else if (!u.carry && z >= 1.5 && (u.job === 'miner' || u.job === 'woodcutter' || u.job === 'smith')) {
                    ctx.fillStyle = '#7a5230'; ctx.fillRect(wx, dy + 4, 1, 5);
                    ctx.fillStyle = '#9aa3ab';
                    if (u.job === 'miner') ctx.fillRect(wx - 1, dy + 3, 3, 1);
                    else if (u.job === 'smith') ctx.fillRect(wx - 1, dy + 3, 3, 2);
                    else ctx.fillRect(wx + (u.face > 0 ? 1 : -1), dy + 4, 1, 2);
                }
                if (u.carry) { ctx.fillStyle = CARRY_COL[u.carry.type] || '#fff'; ctx.fillRect(Math.round(e.x) - 1, dy - 3, 3, 2); }
                if (k && k.kingId === u.id) { ctx.fillStyle = '#ffd34d'; ctx.fillRect(dx + 2, dy - 2, 5, 1); ctx.fillRect(dx + 2, dy - 3, 1, 1); ctx.fillRect(dx + 4, dy - 3, 1, 1); ctx.fillRect(dx + 6, dy - 3, 1, 1); }
            }
            if (u.sick > 0 && ((this.time * 2 + u.id) % 1) < 0.5) { ctx.fillStyle = 'rgba(140,220,80,0.85)'; ctx.fillRect(Math.round(e.x), dy - 2, 1, 1); }
            if (z >= 1.4 && u.hp < u.hpMax && u.kind !== 'aquatic') {
                const bw = Math.max(6, sw - 2);
                ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(Math.round(e.x - bw / 2), dy - 5, bw, 2);
                ctx.fillStyle = u.hp / u.hpMax > 0.5 ? '#6fdc5a' : u.hp / u.hpMax > 0.25 ? '#ffc14d' : '#ff4d4d';
                ctx.fillRect(Math.round(e.x - bw / 2), dy - 5, Math.max(1, Math.round(bw * u.hp / u.hpMax)), 1);
            }
            if (lights.length < 600) {
                if (u.species === 'dragon' || u.species === 'demon') lights.push([e.x, dy + 6, 14, 'fire']);
                else if (u.species === 'ufo') lights.push([e.x, dy + 4, 20, 'magic']);
                else if (u.species === 'icegolem') lights.push([e.x, dy + 4, 12, 'magic']);
            }
        }
    }
    // Forged weapons: the race decides the shape, the metal decides the colour.
    drawWeapon(ctx, u, wx, dy) {
        const metal = EP.GEAR[u.wpn || 0].color, f = u.face > 0 ? 1 : -1;
        const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
        switch (u.species) {
            case 'elf':
                R(wx, dy + 3, 1, 6, u.wpn ? metal : '#8b6a45');
                R(wx - f, dy + 2, 1, 1, u.wpn ? metal : '#8b6a45'); R(wx - f, dy + 9, 1, 1, u.wpn ? metal : '#8b6a45');
                R(wx - f, dy + 3, 1, 6, '#e8e0cc');
                break;
            case 'dwarf':
                R(wx, dy + 3, 1, 6, '#5c3c22');
                R(wx - 1, dy + 2, 3, 2, metal); R(wx + f, dy + 1, 1, 4, metal);
                break;
            case 'orc':
                R(wx, dy + 4, 1, 5, '#3d2b1c');
                R(f > 0 ? wx : wx - 1, dy + 1, 2, 4, metal); R(f > 0 ? wx + 1 : wx - 1, dy + 1, 1, 1, Color.shade(metal, 0.7));
                break;
            default: // sword
                R(wx, dy + 7, 1, 2, '#5c3c22'); R(wx - 1, dy + 6, 3, 1, u.wpn >= 3 ? '#ffcf3a' : '#8a6a3c');
                R(wx, dy + 1, 1, 5, metal); R(wx, dy, 1, 1, Color.shade(metal, 1.15));
        }
    }
    drawVehicle(ctx, v, x, y, lights, dots) {
        const k = this.sim.civ.kingdoms.get(v.kingdomId), color = k ? k.color : '#9a9a9a';
        if (dots) { ctx.fillStyle = color; const s = 3 / this.cam.zoom; ctx.fillRect(x - s / 2, y - s, s, s); return; }
        const sea = EP.VEHICLES[v.type].sea;
        const frame = ((this.time * (sea ? 2 : 6) + v.id * 0.3) | 0) & 1;
        const spr = EP.BuildingArt.vehicle(v.type, color, v.moving || !sea ? frame : 0, v.face < 0);
        const bob = sea ? Math.round(Math.sin(this.time * 2.2 + v.id) * 0.6) : 0;
        const dx = Math.round(x - spr.width / 2), dy = Math.round(y + (sea ? 3 : 2) - spr.height + bob);
        if (!sea) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(dx + 2, Math.round(y) + 1, spr.width - 4, 2); }
        ctx.drawImage(spr, dx, dy);
        if (v.hitT > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6; ctx.drawImage(spr, dx, dy); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
        // Passengers peek over the gunwale.
        if (v.pass && v.pass.length) {
            const n = Math.min(5, v.pass.length);
            for (let j = 0; j < n; j++) {
                const u = this.sim.unitMap.get(v.pass[j]);
                const hx = dx + Math.round(spr.width / 2 - n + j * 2), hy = dy + spr.height - 8;
                ctx.fillStyle = u && u.skin ? u.skin : '#e0ac69'; ctx.fillRect(hx, hy, 1, 1);
                ctx.fillStyle = color; ctx.fillRect(hx, hy + 1, 1, 1);
            }
        }
        if (lights.length < 600) lights.push([x, dy + 4, sea ? 10 : 7, 'window']);
    }
    drawBeam(ctx, u, x, y0, lights) {
        const t = this.sim.unitMap.get(u.targetId);
        if (!t) return;
        const tx = t.x * TS, ty = t.y * TS;
        const pulse = 0.22 + Math.sin(this.time * 14) * 0.06;
        ctx.fillStyle = `rgba(160,255,190,${pulse})`;
        ctx.beginPath(); ctx.moveTo(x - 3, y0); ctx.lineTo(x + 3, y0); ctx.lineTo(tx + 7, ty + 1); ctx.lineTo(tx - 7, ty + 1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(230,255,240,0.5)';
        for (let k = 0; k < 4; k++) {
            const f = ((this.time * 1.5 + k / 4) % 1);
            const yy = ty + (y0 - ty) * f, hw = 3 + 4 * (1 - f);
            ctx.fillRect(Math.round(x + (tx - x) * (1 - f) - hw), Math.round(yy), Math.round(hw * 2), 1);
        }
        lights.push([tx, ty - 4, 16, 'magic']);
    }
    drawBuilding(ctx, b, lights) {
        const sim = this.sim, k = sim.civ.buildingKingdom(b);
        if (b.type === 'farm') {
            if (!b.done) return;
            const x = (b.x + 1) * TS + 3, y = (b.y + 1) * TS;
            ctx.fillStyle = '#6b4a2b'; ctx.fillRect(x + 1, y, 1, 7); ctx.fillRect(x - 1, y + 2, 5, 1);
            ctx.fillStyle = '#d9b26f'; ctx.fillRect(x, y - 1, 3, 2);
            ctx.fillStyle = k ? k.color : '#888'; ctx.fillRect(x, y + 3, 3, 2);
            return;
        }
        const art = EP.BuildingArt.building(b.type, k ? k.race : 'human', k ? k.color : '#888888', k ? k.age : 0);
        const spr = art.img;
        const X = b.x * TS - 1, Yb = (b.y + b.h) * TS + 1, top = Yb - spr.height;
        if (!b.done) {
            ctx.globalAlpha = 0.22; ctx.drawImage(spr, X, top); ctx.globalAlpha = 1;
            const ph = Math.max(2, Math.round(spr.height * b.progress));
            ctx.drawImage(spr, 0, spr.height - ph, spr.width, ph, X, Yb - ph, spr.width, ph);
            ctx.fillStyle = '#8a6a45';
            ctx.fillRect(X, top + 3, 1, spr.height - 3); ctx.fillRect(X + spr.width - 1, top + 3, 1, spr.height - 3);
            for (let y = Yb - 4; y > top + 3; y -= 5) ctx.fillRect(X, y, spr.width, 1);
        } else {
            ctx.drawImage(spr, X, top);
            if (b.hitT > 0) { b.hitT--; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; ctx.drawImage(spr, X, top); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
            this.animateBuilding(ctx, b, art, X, top, k);
            this.litQueue.push([art.lit, X, top, b.id]);
            if (lights.length < 600) {
                const m = art.marks;
                for (let j = 0; j < m.windows.length && j < 3; j++) lights.push([X + m.windows[j][0] + 1, top + m.windows[j][1] + 1, 7, 'window']);
                for (const f of m.forge) lights.push([X + f[0], top + f[1], 12, 'fire']);
                if (b.type === 'tower') lights.push([X + 5, top + 4, 12, 'fire']);
                else if (b.type === 'temple') lights.push([X + spr.width / 2, top + 4, 18, 'magic']);
            }
        }
        if (this.cam.zoom >= 1.2 && b.hp < b.maxHp * 0.98 && b.done) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(X, top - 3, spr.width, 2);
            ctx.fillStyle = b.hp / b.maxHp > 0.5 ? '#6fdc5a' : '#ff6b4d'; ctx.fillRect(X, top - 3, Math.max(1, Math.round(spr.width * b.hp / b.maxHp)), 1);
        }
    }

    // Chimney smoke, waving banners, turning windmill sails, a flickering forge.
    animateBuilding(ctx, b, art, X, top, k) {
        const z = this.cam.zoom, t = this.time, m = art.marks;
        if (z < 0.9) return;
        const seed = EP.hash2(b.id, 3, 9);
        const wind = this.sim.env.wind.x;
        const smoky = b.type === 'smithy';
        for (const c of m.chimneys) {
            const n = smoky ? 5 : 3;
            for (let j = 0; j < n; j++) {
                const ph = (t * (smoky ? 0.55 : 0.35) + j / n + seed) % 1;
                const s = 1 + Math.round(ph * (smoky ? 3 : 2.5));
                const sx = X + c[0] + Math.sin(ph * 5 + b.id) * 1.2 + ph * wind * 5 - s / 2, sy = top + c[1] - 1 - ph * (smoky ? 14 : 11);
                ctx.globalAlpha = (smoky ? 0.65 : 0.5) * (1 - ph);
                ctx.fillStyle = smoky ? '#8a8580' : '#d9d4cc';
                ctx.fillRect(Math.round(sx), Math.round(sy), s, s);
            }
        }
        ctx.globalAlpha = 1;
        if (m.flags.length) {
            const col = k ? k.color : '#888888', dk = Color.shade(col, 0.72);
            for (const f of m.flags) {
                const fx = X + f[0] + 1, fy = top + f[1];
                const ph = ((t * 3 + b.id * 0.7) | 0) % 3;
                ctx.fillStyle = col;
                ctx.fillRect(fx, fy, 4, 1);
                ctx.fillRect(fx, fy + 1, ph === 1 ? 5 : 4, 1);
                ctx.fillStyle = dk;
                ctx.fillRect(fx, fy + 2, ph === 2 ? 3 : 4, 1);
                if (ph === 0) ctx.fillRect(fx + 4, fy + 1, 1, 1);
            }
        }
        for (const h of m.hub) {
            const hx = X + h[0], hy = top + h[1], a0 = t * 1.4 + b.id;
            for (let s = 0; s < 4; s++) {
                const a = a0 + s * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a);
                for (let r = 1; r <= 9; r++) {
                    ctx.fillStyle = '#5c3c22';
                    ctx.fillRect(Math.round(hx + ca * r), Math.round(hy + sa * r), 1, 1);
                    if (r >= 3) { ctx.fillStyle = '#efe6d0'; ctx.fillRect(Math.round(hx + ca * r - sa * 1.4), Math.round(hy + sa * r + ca * 1.4), 1, 1); }
                }
            }
            ctx.fillStyle = '#3d2b1c'; ctx.fillRect(hx - 1, hy - 1, 2, 2);
        }
        for (const f of m.forge) {
            const fl = 0.55 + Math.sin(t * 11 + b.id) * 0.25 + Math.sin(t * 23) * 0.15;
            ctx.globalAlpha = fl; ctx.fillStyle = '#ffd36a'; ctx.fillRect(X + f[0], top + f[1], 1, 1);
            for (let j = 0; j < 2; j++) {
                const ph = (t * 1.6 + j * 0.5 + seed) % 1;
                ctx.globalAlpha = 1 - ph; ctx.fillStyle = j ? '#ffb43a' : '#fff3a0';
                ctx.fillRect(Math.round(X + f[0] + Math.sin((Math.floor(t * 1.6 + j * 0.5) + j) * 7.3) * 2), Math.round(top + f[1] - ph * 6), 1, 1);
            }
            ctx.globalAlpha = 1;
        }
    }

    // Red battle arrows between realms at war, crossed swords where they meet.
    drawWars(ctx) {
        const sim = this.sim, civ = sim.civ, z = this.cam.zoom;
        const alpha = z > 4 ? 0.35 : 0.9;
        const seen = new Set();
        for (const a of civ.kingdoms.values()) {
            if (!a.alive) continue;
            for (const bid of Object.keys(a.wars)) {
                const b = civ.kingdoms.get(+bid);
                if (!b || !b.alive) continue;
                const key = a.id < b.id ? a.id + ':' + b.id : b.id + ':' + a.id;
                if (seen.has(key)) continue;
                seen.add(key);
                // Each side marches on its war target, or on the nearest enemy town.
                const fronts = [];
                for (const [s, o] of [[a, b], [b, a]]) {
                    let tc = civ.cities.get(s.warTarget);
                    if (tc && tc.kingdomId !== o.id) tc = null;
                    let best = null, bd = Infinity;
                    for (const id of s.cities) {
                        const c = civ.cities.get(id); if (!c) continue;
                        if (tc) { const d = EP.dist2(c.x, c.y, tc.x, tc.y); if (d < bd) { bd = d; best = [c, tc]; } }
                        else for (const oid of o.cities) { const oc = civ.cities.get(oid); if (!oc) continue; const d = EP.dist2(c.x, c.y, oc.x, oc.y); if (d < bd) { bd = d; best = [c, oc]; } }
                    }
                    if (best) fronts.push([s, best[0], best[1], !!tc]);
                }
                if (!fronts.length) continue;
                let mid = null;
                for (const [s, from, to, marching] of fronts) {
                    const p0 = this.tileToScreen(from.x, from.y), p1 = this.tileToScreen(to.x, to.y);
                    const m = this.drawArrow(ctx, p0, p1, s.color, marching, alpha, s.id < (s === a ? b.id : a.id) ? 1 : -1);
                    if (!mid) mid = m;
                }
                if (mid) {
                    const spr = Sprites.icon('war_swords');
                    const pulse = 1 + Math.sin(this.time * 6) * 0.12, sc = 2.6 * pulse;
                    ctx.globalAlpha = Math.min(1, alpha + 0.1);
                    ctx.fillStyle = 'rgba(150,10,0,0.6)'; ctx.strokeStyle = '#1a0a10'; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.arc(mid.x, mid.y, 17 * pulse, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                    ctx.imageSmoothingEnabled = false;
                    ctx.drawImage(spr, Math.round(mid.x - spr.width * sc / 2), Math.round(mid.y - spr.height * sc / 2), spr.width * sc, spr.height * sc);
                    ctx.globalAlpha = 1;
                }
            }
        }
    }
    drawArrow(ctx, p0, p1, color, marching, alpha, side) {
        const dx = p1.x - p0.x, dy = p1.y - p0.y, len = Math.hypot(dx, dy);
        if (len < 20) return { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
        const ux = dx / len, uy = dy / len, nx = -uy * side, ny = ux * side;
        // Start and stop short of the towns, bow outward so two opposing arrows don't overlap.
        const s = { x: p0.x + ux * 14, y: p0.y + uy * 14 }, e = { x: p1.x - ux * 16, y: p1.y - uy * 16 };
        const bow = Math.min(60, len * 0.18);
        const c = { x: (s.x + e.x) / 2 + nx * bow, y: (s.y + e.y) / 2 + ny * bow };
        ctx.globalAlpha = alpha;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.quadraticCurveTo(c.x, c.y, e.x, e.y);
        ctx.strokeStyle = 'rgba(26,10,16,0.9)'; ctx.lineWidth = 9; ctx.stroke();
        ctx.strokeStyle = '#ff3a2e'; ctx.lineWidth = 5.5;
        if (marching) { ctx.setLineDash([9, 6]); ctx.lineDashOffset = -this.time * 22; }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.globalAlpha = alpha * 0.8; ctx.stroke(); ctx.globalAlpha = alpha;
        // Head
        const tx = e.x - c.x, ty = e.y - c.y, tl = Math.hypot(tx, ty) || 1, hx = tx / tl, hy = ty / tl;
        const hw = 10, hl = 16;
        ctx.beginPath();
        ctx.moveTo(e.x + hx * 4, e.y + hy * 4);
        ctx.lineTo(e.x - hx * hl - hy * hw, e.y - hy * hl + hx * hw);
        ctx.lineTo(e.x - hx * hl + hy * hw, e.y - hy * hl - hx * hw);
        ctx.closePath();
        ctx.fillStyle = '#ff3a2e'; ctx.fill();
        ctx.strokeStyle = 'rgba(26,10,16,0.9)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.globalAlpha = 1; ctx.lineCap = 'butt';
        return { x: 0.25 * s.x + 0.5 * c.x + 0.25 * e.x, y: 0.25 * s.y + 0.5 * c.y + 0.25 * e.y };
    }
    // Kingdom banners over capitals when zoomed out; town names at middle zoom.
    drawRealmLabels(ctx) {
        const sim = this.sim, civ = sim.civ, z = this.cam.zoom;
        if (z > 3.4) return;
        const a = z < 2.6 ? 1 : (3.4 - z) / 0.8;
        ctx.textAlign = 'center';
        const outline = (str, x, y, col) => {
            ctx.fillStyle = '#1a1230';
            for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1], [0, 2]]) ctx.fillText(str, x + ox, y + oy);
            ctx.fillStyle = col; ctx.fillText(str, x, y);
        };
        ctx.globalAlpha = a;
        if (z > 0.9) {
            ctx.font = '500 11px "Pixelify Sans", monospace';
            for (const c of civ.cities.values()) {
                const k = civ.kingdoms.get(c.kingdomId);
                if (!k || k.capital === c.id) continue;
                const p = this.tileToScreen(c.x, c.y + 2.2);
                if (p.x < -50 || p.y < -20 || p.x > this.W + 50 || p.y > this.H + 20) continue;
                outline(c.name, Math.round(p.x), Math.round(p.y + 12), '#f2ecd8');
            }
        }
        for (const k of civ.kingdoms.values()) {
            if (!k.alive) continue;
            const c = civ.cities.get(k.capital);
            if (!c) continue;
            const p = this.tileToScreen(c.x, c.y + 2.2);
            if (p.x < -120 || p.y < -40 || p.x > this.W + 120 || p.y > this.H + 40) continue;
            const x = Math.round(p.x), y = Math.round(p.y + 14);
            ctx.font = '700 13px "Pixelify Sans", monospace';
            const tw = ctx.measureText(k.name).width;
            const bn = Sprites.banner(k.color, k.sym);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(bn, Math.round(x - tw / 2 - 24), y - 15, 20, 24);
            outline(k.name, x, y, '#ffffff');
            ctx.font = '500 10px "Pixelify Sans", monospace';
            const war = Object.keys(k.wars).length;
            outline(`${civ.rankName(k)} · ${k.pop}${war ? ' · at war' : ''}`, x, y + 12, war ? '#ff8a7a' : '#f2ecd8');
        }
        ctx.globalAlpha = 1;
    }

    drawEffects(ctx, lights, vx0, vy0, vx1, vy1) {
        const sim = this.sim, fx = sim.fx, pw = sim.powers;
        // Projectiles
        for (const p of sim.projectiles) {
            const f = p.t / p.dur;
            const arc = p.kind === 'laser' ? 0 : Math.sin(Math.PI * f) * Math.min(2.5, Math.hypot(p.tx - p.sx, p.ty - p.sy) * 0.18);
            const x = p.x * TS, y = (p.y - arc) * TS;
            if (p.kind === 'laser') {
                const bx = EP.lerp(p.sx, p.tx, Math.max(0, f - 0.35)) * TS, by = EP.lerp(p.sy, p.ty, Math.max(0, f - 0.35)) * TS;
                ctx.lineCap = 'square';
                ctx.strokeStyle = 'rgba(120,255,170,0.45)'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(x, y); ctx.stroke();
                ctx.strokeStyle = '#eafff0'; ctx.lineWidth = 0.9; ctx.stroke();
                ctx.lineCap = 'butt';
                lights.push([x, y, 10, 'magic']);
            } else if (p.kind === 'arrow') {
                const a = Math.atan2((p.ty - p.sy) * TS - Math.cos(Math.PI * f) * arc * TS * 2, (p.tx - p.sx) * TS);
                ctx.strokeStyle = '#5c3c22'; ctx.lineWidth = 0.8;
                ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * 3, y - Math.sin(a) * 3); ctx.lineTo(x, y); ctx.stroke();
                ctx.fillStyle = '#e6ebf0'; ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
            } else {
                ctx.fillStyle = '#ff7b1f'; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2); ctx.fill();
                lights.push([x, y, 14, 'fire']);
            }
        }
        // Falling objects
        for (const f of pw.falling) {
            const p = f.t / f.dur;
            const x = EP.lerp(f.sx, f.x, p) * TS, y = EP.lerp(f.sy, f.y, p) * TS;
            if (f.kind !== 'lavabomb' && f.kind !== 'napalm') {
                ctx.strokeStyle = `rgba(255,80,60,${0.4 + 0.4 * Math.sin(this.time * 12)})`; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(f.x * TS, f.y * TS, 4 + (1 - p) * 10, 0, Math.PI * 2); ctx.stroke();
                ctx.fillStyle = `rgba(0,0,0,${0.15 + p * 0.25})`; ctx.beginPath(); ctx.ellipse(f.x * TS, f.y * TS, 2 + p * 6, 1 + p * 3, 0, 0, Math.PI * 2); ctx.fill();
            }
            if (f.kind === 'meteor') {
                ctx.fillStyle = '#ff9f1c'; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#6b5a4a'; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
                lights.push([x, y, 26, 'fire']);
            } else if (f.kind === 'nuke') {
                ctx.fillStyle = '#3a3f4a'; ctx.fillRect(x - 1.5, y - 4, 3, 6); ctx.fillStyle = '#ffd34d'; ctx.fillRect(x - 1.5, y - 1, 3, 1);
                ctx.fillStyle = '#2a2d35'; ctx.fillRect(x - 2.5, y - 5, 5, 1);
            } else if (f.kind === 'bomb') {
                ctx.fillStyle = '#1a1230'; ctx.fillRect(x - 2.5, y - 2, 5, 5); ctx.fillRect(x - 1.5, y - 3, 3, 7);
                ctx.fillStyle = '#6b6f80'; ctx.fillRect(x - 1.5, y - 1, 1, 1);
                ctx.fillStyle = (this.time * 10 | 0) & 1 ? '#ffe066' : '#ff8a1f'; ctx.fillRect(x + 1, y - 4.5, 1.5, 1.5);
            } else if (f.kind === 'napalm') {
                ctx.fillStyle = '#5a6b3a'; ctx.fillRect(x - 1, y - 2, 2, 4);
                ctx.fillStyle = '#ff8a1f'; ctx.fillRect(x - 1, y + 2, 2, 1.5);
                lights.push([x, y, 8, 'fire']);
            } else { ctx.fillStyle = '#ffb43a'; ctx.fillRect(x - 1, y - 1, 2, 2); lights.push([x, y, 10, 'lava']); }
        }
        // Tornados
        for (const t of pw.tornados) {
            const x = t.x * TS, y = t.y * TS;
            for (let k = 0; k < 12; k++) {
                const yy = y - k * 2.6, rx = 2 + k * 1.2, sx = Math.sin(this.time * 7 + k * 0.6) * k * 0.45;
                ctx.fillStyle = `rgba(${170 - k * 4},${160 - k * 4},${145 - k * 3},${0.22 + k * 0.012})`;
                ctx.beginPath(); ctx.ellipse(x + sx, yy, rx, rx * 0.35, 0, 0, Math.PI * 2); ctx.fill();
            }
        }
        // Volcano glow
        for (const v of pw.volcanoes) lights.push([v.x * TS, v.y * TS - 4, 30, 'lava']);
        // Particles
        for (const p of fx.particles) {
            const x = p.x * TS, y = (p.y - p.z) * TS;
            if (x < vx0 || x > vx1 || y < vy0 || y > vy1) continue;
            ctx.globalAlpha = p.fade ? Math.min(1, (p.life / p.max) * 1.4) : 1;
            ctx.fillStyle = p.color;
            ctx.fillRect(x - p.size / 2, y - p.size / 2, p.size, p.size);
            if (p.glow && lights.length < 700) lights.push([x, y, 5 + p.size * 2, 'warm']);
        }
        ctx.globalAlpha = 1;
        // Emote bubbles
        for (const em of fx.emotes) {
            const spr = Sprites.emote(em.kind);
            const x = em.x * TS, y = em.y * TS;
            if (x < vx0 || x > vx1 || y < vy0 || y > vy1) continue;
            const age = em.max - em.life;
            const pop = age < 4 ? 0.6 + age * 0.1 : 1;
            ctx.globalAlpha = Math.min(1, em.life / 15);
            const w = spr.width * pop, h = spr.height * pop;
            ctx.drawImage(spr, Math.round(x - w / 2), Math.round(y - 12 - h), w, h);
        }
        ctx.globalAlpha = 1;
        // Bolts
        for (const b of fx.bolts) {
            const a = b.life / b.maxLife;
            ctx.lineJoin = 'round';
            ctx.strokeStyle = `rgba(150,180,255,${a * 0.5})`; ctx.lineWidth = 3.5;
            ctx.beginPath(); b.pts.forEach(([x, y], i) => i ? ctx.lineTo(x * TS, y * TS) : ctx.moveTo(x * TS, y * TS)); ctx.stroke();
            ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 1.2; ctx.stroke();
            const e = b.pts[b.pts.length - 1];
            lights.push([e[0] * TS, e[1] * TS, 40, 'magic']);
        }
        for (const r of fx.rings) {
            ctx.strokeStyle = Color.rgba(r.color, (r.life / r.maxLife) * 0.8); ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(r.x * TS, r.y * TS, r.r * TS, 0, Math.PI * 2); ctx.stroke();
        }
        // Player rain clouds
        for (const cl of this.sim.env.clouds) {
            const a = Math.min(1, cl.life / 60, (360 - cl.life) / 30 + 0.2);
            const s = cl.r * TS * 2.4 / Sprites.cloud.width;
            ctx.globalAlpha = 0.85 * a;
            ctx.drawImage(this.cloudShadow, cl.x * TS - Sprites.cloud.width * s / 2 + 6, cl.y * TS - Sprites.cloud.height * s / 2 + 10, Sprites.cloud.width * s, Sprites.cloud.height * s);
            ctx.strokeStyle = 'rgba(160,200,255,0.6)'; ctx.lineWidth = 0.6;
            ctx.beginPath();
            for (let i = 0; i < 40; i++) {
                const rx = (EP.hash2(i, 1, 5) - 0.5) * cl.r * TS * 1.8, ph = (EP.hash2(i, 2, 5) + this.time * 1.6) % 1;
                const ry = (ph - 0.5) * cl.r * TS * 1.2;
                ctx.moveTo(cl.x * TS + rx, cl.y * TS + ry - 18); ctx.lineTo(cl.x * TS + rx - 1, cl.y * TS + ry - 14);
            }
            ctx.stroke();
            ctx.globalAlpha = 0.9 * a;
            ctx.drawImage(Sprites.cloud, cl.x * TS - Sprites.cloud.width * s / 2, cl.y * TS - Sprites.cloud.height * s / 2 - 22, Sprites.cloud.width * s, Sprites.cloud.height * s);
            ctx.globalAlpha = 1;
        }
    }
    drawClouds(ctx, dt) {
        const z = this.cam.zoom, w = this.sim.world, wind = this.sim.env.wind;
        const a = EP.clamp((1.25 - z) / 0.9, 0, 0.38);
        const Wp = w.w * TS, Hp = w.h * TS;
        for (const c of this.clouds) {
            c.x += wind.x * dt * 6; c.y += wind.y * dt * 6;
            if (c.x < -200) c.x += Wp + 400; if (c.x > Wp + 200) c.x -= Wp + 400;
            if (c.y < -150) c.y += Hp + 300; if (c.y > Hp + 150) c.y -= Hp + 300;
            if (a <= 0) continue;
            const sw = Sprites.cloud.width * c.s * 1.6, sh = Sprites.cloud.height * c.s * 1.6;
            ctx.globalAlpha = a * 0.8;
            ctx.drawImage(this.cloudShadow, c.x + 30, c.y + 45, sw, sh);
            ctx.globalAlpha = a;
            ctx.drawImage(Sprites.cloud, c.x, c.y, sw, sh);
        }
        ctx.globalAlpha = 1;
    }
    drawNight(ctx, dark, lights, tx0, ty0, tx1, ty1, ox, oy) {
        const w = this.sim.world, z = this.cam.zoom, dpr = this.dpr;
        // Lava glows
        if (z >= 0.5) {
            const step = z < 1 ? 2 : 1;
            for (let y = ty0; y <= ty1 && lights.length < 900; y += step) for (let x = tx0; x <= tx1; x += step)
                if (w.terrain[y * w.w + x] === T.LAVA) lights.push([x * TS + 4, y * TS + 4, 12 * step, 'lava']);
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'multiply';
        const r = Math.round(255 - dark * 190), g = Math.round(255 - dark * 175), b = Math.round(255 - dark * 110);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.globalCompositeOperation = 'lighter';
        ctx.setTransform(z * dpr, 0, 0, z * dpr, ox, oy);
        ctx.globalAlpha = Math.min(0.85, dark * 1.1);
        for (const [x, y, rad, kind] of lights) {
            const s = Sprites.glows[kind] || Sprites.glows.warm;
            const flick = kind === 'fire' || kind === 'lava' ? 1 + Math.sin(this.time * 9 + x) * 0.08 : 1;
            const R = rad * flick;
            ctx.drawImage(s, x - R, y - R, R * 2, R * 2);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        // Lit windows glow through the dark.
        if (this.litQueue.length) {
            ctx.globalAlpha = Math.min(1, dark * 1.6);
            for (const [img, x, y, id] of this.litQueue) {
                // Late at night a few homes go dark.
                if (dark > 0.6 && EP.hash2(id, (this.sim.tick / 600) | 0, 4) < 0.25) continue;
                ctx.drawImage(img, x, y);
            }
            ctx.globalAlpha = 1;
        }
    }
    drawWeather(ctx) {
        const wt = this.sim.env.weather, wi = wt.type === 'clear' ? wt.intensity * 0.5 : wt.intensity;
        if (wi < 0.05) return;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.fillStyle = `rgba(30,40,60,${wi * 0.22})`;
        ctx.fillRect(0, 0, this.W, this.H);
        const n = Math.round(wi * 260 * (this.W * this.H) / 1.4e6);
        const wind = this.sim.env.wind.x * 0.5;
        ctx.strokeStyle = 'rgba(190,210,240,0.45)'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < n; i++) {
            const x = ((EP.hash2(i, 0, 3) * this.W + this.time * 80 * wind) % this.W + this.W) % this.W;
            const y = (EP.hash2(i, 1, 3) * this.H + this.time * (600 + EP.hash2(i, 2, 3) * 300)) % this.H;
            ctx.moveTo(x, y); ctx.lineTo(x + wind * 6, y + 12);
        }
        ctx.stroke();
    }
    drawCursor(ctx) {
        const c = this.cursor;
        if (!c || !c.tool) return;
        const z = this.cam.zoom, tool = c.tool;
        ctx.lineWidth = 1.5 / z;
        const cx = (Math.floor(c.tx) + 0.5) * TS, cy = (Math.floor(c.ty) + 0.5) * TS;
        if (tool.type === 'inspect') return;
        if (tool.type === 'spawn') {
            ctx.strokeStyle = 'rgba(255,255,255,0.85)';
            ctx.beginPath(); ctx.arc(c.tx * TS, c.ty * TS, 4, 0, Math.PI * 2); ctx.stroke();
            return;
        }
        const r = tool.sized ? (Math.max(0, c.size - 0.6) + 0.5) * TS : 1.5 * TS;
        ctx.strokeStyle = tool.cat === 'destroy' ? 'rgba(255,120,90,0.9)' : 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath(); ctx.arc(cx, cy, r + 1.5 / z, 0, Math.PI * 2); ctx.stroke();
        if (!tool.sized) { ctx.beginPath(); ctx.moveTo(cx - 3, cy); ctx.lineTo(cx + 3, cy); ctx.moveTo(cx, cy - 3); ctx.lineTo(cx, cy + 3); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.stroke(); }
    }
    drawSelection(ctx, alpha) {
        const sel = this.selection, sim = this.sim;
        if (!sel) return;
        const z = this.cam.zoom;
        ctx.lineWidth = 1.5 / z;
        const pulse = 0.6 + Math.sin(this.time * 5) * 0.3;
        if (sel.type === 'unit') {
            const u = sim.unitMap.get(sel.id);
            if (!u) return;
            const x = (u.px + (u.x - u.px) * alpha) * TS, y = (u.py + (u.y - u.py) * alpha) * TS;
            ctx.strokeStyle = `rgba(255,230,120,${pulse})`;
            ctx.beginPath(); ctx.ellipse(x, y, u.sp.fly ? 9 : 5, u.sp.fly ? 4 : 2.5, 0, 0, Math.PI * 2); ctx.stroke();
            if (u.tx != null && u.state !== 'idle') {
                ctx.setLineDash([2 / z * 2, 2 / z * 2]); ctx.strokeStyle = 'rgba(255,255,255,0.4)';
                ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(u.tx * TS, u.ty * TS); ctx.stroke(); ctx.setLineDash([]);
            }
        } else if (sel.type === 'vehicle') {
            const v = sim.vehicles.map.get(sel.id);
            if (!v) return;
            const x = (v.px + (v.x - v.px) * alpha) * TS, y = (v.py + (v.y - v.py) * alpha) * TS;
            ctx.strokeStyle = `rgba(255,230,120,${pulse})`;
            ctx.beginPath(); ctx.ellipse(x, y + 2, 9, 4, 0, 0, Math.PI * 2); ctx.stroke();
        } else if (sel.type === 'building') {
            const b = sim.civ.buildings.get(sel.id);
            if (!b) return;
            ctx.strokeStyle = `rgba(255,230,120,${pulse})`;
            ctx.strokeRect(b.x * TS - 1, b.y * TS - 1, b.w * TS + 2, b.h * TS + 2);
        } else if (sel.type === 'city') {
            const c = sim.civ.cities.get(sel.id);
            if (!c) return;
            ctx.strokeStyle = `rgba(255,230,120,${pulse})`;
            ctx.beginPath(); ctx.arc(c.x * TS, c.y * TS, c.radius * TS, 0, Math.PI * 2); ctx.stroke();
        }
    }
    drawTexts(ctx) {
        const fx = this.sim.fx;
        ctx.font = '600 12px "Pixelify Sans", monospace';
        ctx.textAlign = 'center';
        for (const t of fx.texts) {
            const p = this.tileToScreen(t.x, t.y);
            ctx.globalAlpha = Math.min(1, t.life / 20);
            ctx.fillStyle = '#1a1230';
            for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, 1], [-1, 1], [1, -1], [0, 3]]) ctx.fillText(t.str, Math.round(p.x) + ox, Math.round(p.y) + oy);
            ctx.fillStyle = t.color; ctx.fillText(t.str, Math.round(p.x), Math.round(p.y));
        }
        ctx.globalAlpha = 1;
        // Label selected unit
        const sel = this.selection;
        if (sel && sel.type === 'unit') {
            const u = this.sim.unitMap.get(sel.id);
            if (u) {
                const p = this.tileToScreen(u.x, u.y);
                const label = u.name || EP.SPECIES[u.species].name;
                ctx.font = '600 12px "Pixelify Sans", monospace';
                const tw = Math.ceil(ctx.measureText(label).width);
                const y = Math.round(p.y - 12 * this.cam.zoom - 14), lx = Math.round(p.x - tw / 2 - 6), lw = tw + 12;
                ctx.fillStyle = '#1a1230'; ctx.fillRect(lx - 2, y - 12, lw + 4, 18); ctx.fillRect(lx, y - 14, lw, 22);
                ctx.fillRect(Math.round(p.x) - 3, y + 8, 6, 2); ctx.fillRect(Math.round(p.x) - 1, y + 10, 2, 2);
                ctx.fillStyle = '#3a2f68'; ctx.fillRect(lx, y - 12, lw, 18);
                ctx.fillStyle = '#4a3d82'; ctx.fillRect(lx, y - 12, lw, 2);
                ctx.fillStyle = '#ffe27a'; ctx.fillText(label, Math.round(p.x), y + 1);
            }
        }
    }

    // Small image of the world for save slots.
    thumbnail(maxW = 160) {
        const w = this.sim.world, s = Math.min(1, maxW / w.w);
        const c = document.createElement('canvas'); c.width = Math.round(w.w * s); c.height = Math.round(w.h * s);
        const g = c.getContext('2d'); g.imageSmoothingEnabled = true;
        for (const ch of this.chunks) g.drawImage(ch.canvas, ch.cx * CH * s, ch.cy * CH * s, CH * s, CH * s);
        if (this.settings.borders) g.drawImage(this.terr, 0, 0, c.width, c.height);
        return c.toDataURL('image/jpeg', 0.7);
    }
}
EP.Renderer = Renderer;

// ================================================================ Minimap
const OREC = Object.fromEntries(Object.entries(EP.ORE_INFO).map(([k, o]) => [k, Color.hexToRgb(o.color)]));

class Minimap {
    constructor(canvas, renderer) {
        this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.r = renderer;
        this.v = -1; this.ov = -1; this.last = 0;
    }
    attach(sim) {
        this.sim = sim;
        const w = sim.world;
        this.base = document.createElement('canvas'); this.base.width = w.w; this.base.height = w.h;
        this.bctx = this.base.getContext('2d');
        this.img = this.bctx.createImageData(w.w, w.h);
        this.canvas.width = w.w * 2; this.canvas.height = w.h * 2;
        this.v = -1;
    }
    rebuild() {
        const sim = this.sim, w = sim.world, d = this.img.data;
        const kc = new Map();
        for (const c of sim.civ.cities.values()) { const k = sim.civ.kingdoms.get(c.kingdomId); if (k) kc.set(c.id, Color.hexToRgb(k.color)); }
        for (let i = 0; i < w.w * w.h; i++) {
            const t = w.terrain[i];
            let c = t <= 1 ? waterColor(EP.clamp((w.height[i] - 20) / (EP.SEA - 20), 0, 1)) : TPAL[t][1];
            let r = c[0], g = c[1], b = c[2];
            if (t === T.MOUNTAIN && w.height[i] > EP.SNOWCAP) { r = 236; g = 242; b = 248; }
            if (w.tree[i]) { r *= 0.72; g *= 0.8; b *= 0.72; }
            if (w.ore[i]) { const oc = OREC[w.ore[i]]; r = r * 0.4 + oc[0] * 0.6; g = g * 0.4 + oc[1] * 0.6; b = b * 0.4 + oc[2] * 0.6; }
            const o = w.owner[i];
            if (o >= 0 && this.r.settings.borders) { const k = kc.get(o); if (k) { r = r * 0.38 + k[0] * 0.62; g = g * 0.38 + k[1] * 0.62; b = b * 0.38 + k[2] * 0.62; } }
            if (w.fire[i]) { r = 255; g = 120; b = 40; }
            d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
        }
        this.bctx.putImageData(this.img, 0, 0);
    }
    draw() {
        const w = this.sim.world, now = performance.now();
        if ((w.version !== this.v || w.ownerVersion !== this.ov || this.sim.env.fires.size) && now - this.last > 500) {
            this.v = w.version; this.ov = w.ownerVersion; this.last = now; this.rebuild();
        }
        const g = this.ctx;
        g.imageSmoothingEnabled = false;
        g.drawImage(this.base, 0, 0, this.canvas.width, this.canvas.height);
        // Viewport
        const r = this.r, z = r.cam.zoom;
        const vw = r.W / z / TS * 2, vh = r.H / z / TS * 2;
        const vx = r.cam.x / TS * 2 - vw / 2, vy = r.cam.y / TS * 2 - vh / 2;
        g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 3; g.strokeRect(vx, vy, vw, vh);
        g.strokeStyle = '#ffffff'; g.lineWidth = 1.5; g.strokeRect(vx, vy, vw, vh);
    }
    toTile(ev) {
        const rect = this.canvas.getBoundingClientRect(), w = this.sim.world;
        return { x: (ev.clientX - rect.left) / rect.width * w.w, y: (ev.clientY - rect.top) / rect.height * w.h };
    }
}
EP.Minimap = Minimap;
})();
