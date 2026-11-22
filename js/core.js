/* EarthPlay — core utilities: namespace, seeded RNG, noise, math, colour, spatial hash, events.
 * Everything here is DOM-free so the simulation can run headless (see tests/). */
(function () {
'use strict';
const EP = (globalThis.EP = globalThis.EP || {});

// ---------------------------------------------------------------- RNG
// mulberry32: tiny, fast, good-quality 32-bit PRNG with serialisable state.
class RNG {
    constructor(seed = 1) { this.s = (seed >>> 0) || 0x9e3779b9; }
    next() {
        let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
    float(a, b) { return a + this.next() * (b - a); }
    chance(p) { return this.next() < p; }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    sign() { return this.next() < 0.5 ? -1 : 1; }
    get state() { return this.s; }
    set state(v) { this.s = v >>> 0; }
}
EP.RNG = RNG;

EP.hashString = function (str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
};

// Integer hash → [0,1). Stable, used for per-pixel / per-tile visual variation.
EP.hash2 = function (x, y, seed = 0) {
    let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
};

// ---------------------------------------------------------------- Noise
// Seeded 2D gradient (Perlin-style) noise with fBm helper.
class Noise {
    constructor(seed) {
        const rng = new RNG(seed);
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) p[i] = i;
        for (let i = 255; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
        this.perm = new Uint8Array(512);
        for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    }
    static fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    static grad(h, x, y) {
        switch (h & 7) {
            case 0: return x + y; case 1: return x - y; case 2: return -x + y; case 3: return -x - y;
            case 4: return x; case 5: return -x; case 6: return y; default: return -y;
        }
    }
    noise2(x, y) {
        const X = Math.floor(x), Y = Math.floor(y);
        const xf = x - X, yf = y - Y;
        const xi = X & 255, yi = Y & 255, p = this.perm;
        const u = Noise.fade(xf), v = Noise.fade(yf);
        const aa = p[p[xi] + yi], ab = p[p[xi] + yi + 1], ba = p[p[xi + 1] + yi], bb = p[p[xi + 1] + yi + 1];
        const x1 = Noise.grad(aa, xf, yf) + u * (Noise.grad(ba, xf - 1, yf) - Noise.grad(aa, xf, yf));
        const x2 = Noise.grad(ab, xf, yf - 1) + u * (Noise.grad(bb, xf - 1, yf - 1) - Noise.grad(ab, xf, yf - 1));
        return (x1 + v * (x2 - x1)) * 0.95; // ≈ [-1, 1]
    }
    fbm(x, y, octaves = 5, lacunarity = 2, gain = 0.5) {
        let amp = 1, freq = 1, sum = 0, norm = 0;
        for (let i = 0; i < octaves; i++) {
            sum += this.noise2(x * freq, y * freq) * amp;
            norm += amp; amp *= gain; freq *= lacunarity;
        }
        return sum / norm;
    }
    ridged(x, y, octaves = 4) {
        let amp = 0.5, freq = 1, sum = 0;
        for (let i = 0; i < octaves; i++) {
            const n = 1 - Math.abs(this.noise2(x * freq, y * freq));
            sum += n * n * amp; amp *= 0.5; freq *= 2;
        }
        return sum;
    }
}
EP.Noise = Noise;

// ---------------------------------------------------------------- Math
EP.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
EP.lerp = (a, b, t) => a + (b - a) * t;
EP.smoothstep = (a, b, v) => { const t = EP.clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
EP.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
EP.dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

// ---------------------------------------------------------------- Colour
const Color = {
    hexToRgb(hex) {
        const n = parseInt(hex.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    },
    rgbToHex(r, g, b) {
        return '#' + ((1 << 24) | (EP.clamp(r | 0, 0, 255) << 16) | (EP.clamp(g | 0, 0, 255) << 8) | EP.clamp(b | 0, 0, 255)).toString(16).slice(1);
    },
    shade(hex, f) { const [r, g, b] = Color.hexToRgb(hex); return Color.rgbToHex(r * f, g * f, b * f); },
    mix(a, b, t) {
        const A = Color.hexToRgb(a), B = Color.hexToRgb(b);
        return Color.rgbToHex(EP.lerp(A[0], B[0], t), EP.lerp(A[1], B[1], t), EP.lerp(A[2], B[2], t));
    },
    hsl(h, s, l) {
        s /= 100; l /= 100;
        const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
        const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        return Color.rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
    },
    rgba(hex, a) { const [r, g, b] = Color.hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; },
};
EP.Color = Color;

// ---------------------------------------------------------------- Spatial hash
// Buckets units by cell for O(1)-ish neighbourhood queries. Rebuilt every tick.
class SpatialHash {
    constructor(w, h, cell = 8) {
        this.cell = cell;
        this.cw = Math.ceil(w / cell); this.ch = Math.ceil(h / cell);
        this.cells = Array.from({ length: this.cw * this.ch }, () => []);
    }
    clear() { for (const c of this.cells) c.length = 0; }
    insert(u) {
        const cx = EP.clamp((u.x / this.cell) | 0, 0, this.cw - 1), cy = EP.clamp((u.y / this.cell) | 0, 0, this.ch - 1);
        this.cells[cy * this.cw + cx].push(u);
    }
    // Calls fn(unit, d2) for units within r; return true from fn to stop early.
    query(x, y, r, fn) {
        const c = this.cell, r2 = r * r;
        const x0 = EP.clamp(((x - r) / c) | 0, 0, this.cw - 1), x1 = EP.clamp(((x + r) / c) | 0, 0, this.cw - 1);
        const y0 = EP.clamp(((y - r) / c) | 0, 0, this.ch - 1), y1 = EP.clamp(((y + r) / c) | 0, 0, this.ch - 1);
        for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
            const list = this.cells[cy * this.cw + cx];
            for (let i = 0; i < list.length; i++) {
                const u = list[i];
                if (u.dead) continue;
                const dx = u.x - x, dy = u.y - y, d2 = dx * dx + dy * dy;
                if (d2 <= r2 && fn(u, d2)) return;
            }
        }
    }
    nearest(x, y, r, pred) {
        let best = null, bd = Infinity;
        this.query(x, y, r, (u, d2) => { if (d2 < bd && pred(u)) { bd = d2; best = u; } });
        return best;
    }
    collect(x, y, r, pred) {
        const out = [];
        this.query(x, y, r, u => { if (!pred || pred(u)) out.push(u); });
        return out;
    }
}
EP.SpatialHash = SpatialHash;

// ---------------------------------------------------------------- Events
class Emitter {
    constructor() { this.handlers = {}; }
    on(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn); return () => this.off(type, fn); }
    off(type, fn) { const h = this.handlers[type]; if (h) this.handlers[type] = h.filter(f => f !== fn); }
    emit(type, data) { const h = this.handlers[type]; if (h) for (const f of h.slice()) f(data); }
}
EP.Emitter = Emitter;

// ---------------------------------------------------------------- Misc
EP.uid = (() => { let n = 0; return () => ++n; })();
EP.fmt = n => (n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1) + 'k' : String(Math.round(n)));
})();
