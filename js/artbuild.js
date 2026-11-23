/* EarthPlay — pixel-art buildings & vehicles in the same char-grid style as creature sprites.
 * Buildings come with a night "lit" layer and animation marks (windows, chimneys, flags, forges, windmill hubs). */
(function () {
'use strict';
const EP = globalThis.EP;
const { Color } = EP;

const OUT = 'rgba(20,16,24,0.85)';
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// Render a char-grid template with a palette; automatic 1px outline (same as sprites.js).
function fromTemplate(rows, pal, outline = OUT, flip = false) {
    const h = rows.length, w = Math.max(...rows.map(r => r.length));
    const o = outline ? 1 : 0;
    const c = mk(w + o * 2, h + o * 2), g = c.getContext('2d');
    const solid = (x, y) => y >= 0 && y < h && x >= 0 && x < w && rows[y][x] && rows[y][x] !== '.' && rows[y][x] !== ' ' && pal[rows[y][x]];
    if (outline) {
        g.fillStyle = outline;
        for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
            if (solid(x, y)) continue;
            if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
                const dx = flip ? w - 1 - x : x;
                g.fillRect(dx + o, y + o, 1, 1);
            }
        }
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (!solid(x, y)) continue;
        g.fillStyle = pal[rows[y][x]];
        g.fillRect((flip ? w - 1 - x : x) + o, y + o, 1, 1);
    }
    return c;
}

// ---------------------------------------------------------------- char grid drawing helpers
// Drawn bottom-aligned on a tall grid; empty rows at the top are cropped when compiled.
class Grid {
    constructor(w, h = 64) { this.w = w; this.h = h; this.c = Array.from({ length: h }, () => new Array(w).fill('.')); }
    get B() { return this.h - 1; }   // ground row
    px(x, y, ch) { x |= 0; y |= 0; if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y][x] = ch; }
    at(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.c[y][x] : '.'; }
    rect(x, y, w, h, ch) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.px(xx, yy, ch); }
    hl(x, y, w, ch) { this.rect(x, y, w, 1, ch); }
    vl(x, y, h, ch) { this.rect(x, y, 1, h, ch); }
    // Fill a rect with fn(x,y,lx,ly) → char (or null to skip).
    fill(x, y, w, h, fn) { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { const ch = fn(xx, yy, xx - x, yy - y); if (ch) this.px(xx, yy, ch); } }
    // Rows of increasing half-width around centre cx (span [cx-hw, cx+hw)). fn(x, y, i, left) → char.
    tri(yTop, n, cx, hw0, step, fn) {
        for (let i = 0; i < n; i++) {
            const hw = Math.round(hw0 + i * step), y = yTop + i;
            for (let x = Math.ceil(cx - hw); x < cx + hw; x++) { const ch = fn(x, y, i, x < cx, hw); if (ch) this.px(x, y, ch); }
        }
    }
    ellipse(cx, cy, rx, ry, fn) {
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
            const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
            if (dx * dx + dy * dy <= 1) { const ch = fn(x, y, dx, dy); if (ch) this.px(x, y, ch); }
        }
    }
}
const hsh = (x, y, s) => EP.hash2(x, y, s);

// Brick/stone texture with a darker shaded right side.
function stone(g, x, y, w, h, shade = 3, L = 's', D = 'S', m = 'k') {
    g.fill(x, y, w, h, (xx, yy, lx, ly) => {
        const dark = lx >= w - shade;
        if (ly % 3 === 2 && hsh(xx, yy, 3) < 0.45) return m;
        if (ly % 3 !== 2 && (xx + ((ly / 3) | 0) * 2) % 4 === 0 && hsh(xx, yy, 4) < 0.35) return m;
        return dark ? D : L;
    });
}
// Plaster walls with exposed timber frame.
function timber(g, x, y, w, h, shade = 3) {
    g.fill(x, y, w, h, (xx, yy, lx, ly) => {
        if (ly === 0 || lx === 0) return 't';
        if (lx === w - 1) return 'T';
        if (ly === h - 1) return 'T';
        return lx >= w - shade ? 'W' : 'w';
    });
}
// Horizontal log walls.
function logs(g, x, y, w, h) {
    g.fill(x, y, w, h, (xx, yy, lx, ly) => (ly % 2 ? 'X' : (lx === 0 || lx === w - 1 ? 'X' : 'x')));
}
// Shingled two-tone roof rows (left light, right mid).
const shingle = (x, y, i, left) => (left ? ((i % 2 && (x % 3) === 0) ? 'r' : 'L') : ((i % 2 && (x % 3) === 1) ? 'R' : 'r'));
function gable(g, yTop, n, cx, hw0, step = 1) { g.tri(yTop, n, cx, hw0, step, shingle); }
function door(g, x, y, w, h, gold) {
    g.rect(x, y, w, h, 'd');
    if (h > 3) { g.px(x, y, 'D'); g.px(x + w - 1, y, 'D'); }
    g.px(x + w - 1 - (w > 2 ? 1 : 0), y + (h >> 1) + 1, gold ? 'y' : 'D');
}
function win(g, x, y, w = 2, h = 2, sill = 't') { g.rect(x, y, w, h, 'G'); if (sill) g.hl(x, y + h, w, sill); }
function chimney(g, x, yTop, h, w = 2) { g.rect(x, yTop, w, h, 'c'); g.px(x, yTop, 'K'); for (let k = 1; k < w; k++) g.px(x + k, yTop, 'k'); }
function flag(g, x, yTop, h) { g.vl(x, yTop + 1, h - 1, 'p'); g.px(x, yTop, 'P'); }

// ---------------------------------------------------------------- palettes
const COMMON = {
    G: '#2f3f5a', K: '#4a4540', c: '#7a736a', p: '#5c3c22', P: '#3d2b1c', O: '#ffa030', H: '#5c3c22',
    y: '#ffd34d', Y: '#c98a1b', b: '#ece4cc', v: '#7fc65a', V: '#4f9e36', x: '#a8763e', X: '#6b4a2b',
    q: '#c4a070', Q: '#9a7a50', m: '#c4ccd4', M: '#6f777f', a: '#f4f0e6', f: '#8fcf4a', e: '#d94a3a',
    n: '#4a3f36', d: '#3a2618', D: '#7a5230', h: '#d9b26f', j: '#b08a48',
};
const STYLE = {
    human: { w: '#ecdcb4', W: '#cdb98c', t: '#7a5230', T: '#5c3c22', s: '#c4bcae', S: '#a09889', k: '#7d766c' },
    elf:   { w: '#f2f5e6', W: '#d3dcc2', t: '#8fae6a', T: '#6f8f4a', s: '#e6ebdc', S: '#c2cbb4', k: '#9aa88e', x: '#c9a870', X: '#8a6a44', d: '#4f3c28' },
    dwarf: { w: '#a8a39a', W: '#837e76', t: '#5a4f45', T: '#3f3830', s: '#a8a39a', S: '#837e76', k: '#5f5a53', x: '#8a6a48', X: '#5c4630' },
    orc:   { w: '#a07850', W: '#7d5c3c', t: '#5c3c22', T: '#3d2b1c', s: '#8f8579', S: '#6d655b', k: '#4a443e', x: '#8a5a32', X: '#5c3a1e', d: '#2a1a10' },
};
function palette(race, color, age, stoneWalls) {
    const st = STYLE[race] || STYLE.human;
    const p = Object.assign({}, COMMON, st, { r: color, R: Color.shade(color, 0.66), L: Color.mix(color, '#ffffff', 0.28) });
    if (stoneWalls) { p.w = st.s; p.W = st.S; }
    return p;
}

// ---------------------------------------------------------------- buildings
const FOOT = { hall: [3, 3], house: [2, 2], temple: [2, 2], tower: [1, 1], barracks: [3, 2], mine: [2, 2], granary: [2, 2], docks: [2, 2], smithy: [2, 2], windmill: [2, 2], market: [3, 2], library: [2, 2] };

const DRAW = {
    // ------------------------------------------------ house
    house(g, race, age, P) {
        const B = g.B, stoneW = age >= 2;
        if (race === 'orc') {
            if (age < 2) { // hide tent
                g.tri(B - 14, 15, 8, 1, 0.5, (x, y, i, left) => (i % 4 === 2 ? (left ? 'r' : 'R') : (left ? 'q' : 'Q')));
                g.px(6, B - 16, 'b'); g.px(7, B - 15, 'p'); g.px(9, B - 15, 'p'); g.px(10, B - 16, 'b');
                g.px(8, B - 14, 'K');
                g.rect(7, B - 5, 2, 6, 'd'); g.rect(6, B - 2, 4, 3, 'd');
                g.px(1, B, 'b'); g.px(14, B, 'b');
            } else { // log cabin with hide roof & tusks
                logs(g, 2, B - 8, 12, 9);
                g.tri(B - 15, 7, 8, 2, 1, (x, y, i, left) => (i % 3 === 1 ? (left ? 'r' : 'R') : (left ? 'q' : 'Q')));
                g.px(0, B - 10, 'b'); g.px(0, B - 11, 'b'); g.px(15, B - 10, 'b'); g.px(15, B - 11, 'b');
                g.px(8, B - 15, 'K');
                door(g, 7, B - 5, 2, 6); win(g, 3, B - 6, 2, 2, null); win(g, 11, B - 6, 2, 2, null);
                g.px(7, B - 7, 'b'); g.px(8, B - 7, 'b');
            }
            return;
        }
        if (race === 'elf') {
            g.fill(3, B - 8, 10, 9, (x, y, lx) => (lx >= 7 ? 'W' : 'w'));
            g.vl(3, B - 8, 9, 't');
            door(g, 7, B - 4, 2, 5); g.px(7, B - 5, 'D'); g.px(8, B - 5, 'D');
            win(g, 4, B - 6, 2, 2, null); win(g, 11, B - 6, 1, 2, null);
            const widths = [3, 5, 6, 7, 8, 8, 8, 8];
            widths.forEach((hw, i) => {
                const y = B - 16 + i;
                for (let x = 8 - hw; x < 8 + hw; x++) {
                    let ch = i < 3 ? 'v' : 'V';
                    if (i >= 3 && hsh(x, y, 9) < 0.25) ch = 'v';
                    if (i === 7) ch = (x % 2) ? 'r' : 'R';
                    else if (hsh(x, y, 5) < 0.08) ch = 'r';
                    g.px(x, y, ch);
                }
            });
            if (age >= 4) { g.px(7, B - 17, 'y'); g.px(8, B - 17, 'y'); }
            return;
        }
        if (race === 'dwarf') {
            stone(g, 1, B - 8, 14, 9, 4);
            chimney(g, 3, B - 15, 5);
            g.fill(0, B - 11, 16, 3, (x, y, lx, ly) => (ly === 0 ? 'L' : ly === 1 ? ((x % 3) ? 'r' : 'R') : 'R'));
            g.hl(2, B - 12, 12, 'L');
            if (age >= 2) chimney(g, 12, B - 14, 3);
            door(g, 7, B - 5, 3, 6, age >= 4); g.hl(6, B - 6, 5, age >= 4 ? 'y' : 't');
            win(g, 3, B - 6, 2, 2, 'k'); win(g, 12, B - 6, 2, 2, 'k');
            return;
        }
        // human cottage
        if (stoneW) stone(g, 2, B - 9, 12, 10, 4); else timber(g, 2, B - 9, 12, 10, 4);
        if (!stoneW) { g.px(4, B - 4, 't'); g.px(5, B - 3, 't'); g.px(11, B - 4, 'T'); g.px(10, B - 3, 'T'); }
        gable(g, B - 18, 8, 8, 1);
        g.hl(0, B - 10, 16, 'R');
        chimney(g, 11, B - 19, 6);
        door(g, 6, B - 5, 3, 6, age >= 4);
        win(g, 3, B - 7); win(g, 11, B - 7);
        if (age >= 3) win(g, 7, B - 13, 2, 2, null);
        if (age >= 4) { g.px(7, B - 19, 'y'); g.px(8, B - 19, 'y'); }
    },

    // ------------------------------------------------ hall
    hall(g, race, age, P) {
        if (age >= 3) return castle(g, race, age);
        const B = g.B, stoneW = age >= 2, gold = age >= 4;
        if (race === 'orc') {
            logs(g, 1, B - 12, 22, 13);
            g.tri(B - 22, 10, 12, 5, 1, (x, y, i, left) => (i % 3 === 2 ? (left ? 'r' : 'R') : (left ? 'q' : 'Q')));
            g.px(12, B - 22, 'K');
            // tusks arching over the door
            [[8, B - 9], [7, B - 10], [7, B - 11], [8, B - 12], [15, B - 9], [16, B - 10], [16, B - 11], [15, B - 12]].forEach(([x, y]) => g.px(x, y, 'b'));
            door(g, 10, B - 7, 4, 8);
            g.rect(11, B - 10, 2, 2, 'b'); g.px(11, B - 9, 'n'); g.px(12, B - 9, 'n');
            win(g, 3, B - 8, 2, 2, null); win(g, 19, B - 8, 2, 2, null);
            g.px(0, B - 13, 'b'); g.px(23, B - 13, 'b');
            flag(g, 20, B - 26, 6);
            return;
        }
        if (race === 'elf') {
            // side wings with leaf roofs
            g.fill(1, B - 8, 7, 9, (x, y, lx) => (lx >= 5 ? 'W' : 'w'));
            g.fill(16, B - 8, 7, 9, (x, y, lx) => (lx >= 5 ? 'W' : 'w'));
            g.tri(B - 11, 3, 4.5, 3, 1, (x, y, i) => (i === 2 ? 'r' : 'v'));
            g.tri(B - 11, 3, 19.5, 3, 1, (x, y, i) => (i === 2 ? 'R' : 'V'));
            win(g, 3, B - 6, 2, 2, null); win(g, 19, B - 6, 2, 2, null);
            chimney(g, 20, B - 13, 3);
            // great tree trunk
            g.fill(8, B - 22, 8, 23, (x, y, lx) => (lx >= 5 ? 'X' : ((x + y) % 5 === 0 ? 'X' : 'x')));
            g.px(7, B, 'X'); g.px(7, B - 1, 'x'); g.px(16, B, 'X'); g.px(16, B - 1, 'X'); g.px(6, B, 'x'); g.px(17, B, 'X');
            door(g, 10, B - 6, 4, 7, gold); g.hl(10, B - 7, 4, 'd'); g.px(10, B - 7, 'x'); g.px(13, B - 7, 'X');
            win(g, 9, B - 14, 2, 2, null); win(g, 13, B - 18, 2, 2, null); win(g, 10, B - 22, 2, 2, null);
            // canopy
            g.ellipse(12, B - 26, 12, 7.5, (x, y, dx, dy) => {
                if (hsh(x, y, 5) < 0.07) return 'r';
                if (dy > 0.55) return (x % 2) ? 'r' : 'R';
                return dy < -0.2 && dx < 0.3 ? 'v' : (hsh(x, y, 9) < 0.2 ? 'v' : 'V');
            });
            if (gold) { g.px(5, B - 28, 'y'); g.px(18, B - 24, 'y'); g.px(12, B - 31, 'y'); }
            flag(g, 12, B - 37, 4);
            return;
        }
        if (race === 'dwarf') {
            // hall carved into a rock mound
            for (let x = 0; x < 24; x++) {
                const h = Math.round(17 - Math.pow(x - 11.5, 2) / 14);
                g.fill(x, B - h + 1, 1, h, (xx, yy) => (hsh(xx, yy, 7) < 0.12 ? 'k' : x > 15 ? 'S' : 's'));
            }
            g.fill(4, B - 17, 16, 2, (x, y, lx, ly) => (ly === 0 && lx % 3 === 1 ? null : (x > 15 ? 'S' : 's')));
            // carved gate
            g.rect(8, B - 10, 8, 11, 't'); g.rect(9, B - 9, 6, 10, 'd'); g.hl(10, B - 10, 4, 'd'); g.hl(9, B - 11, 6, 't');
            g.vl(11, B - 8, 9, 'n'); g.vl(12, B - 8, 9, 'n');
            g.px(11, B - 13, gold ? 'y' : 'Y'); g.px(12, B - 13, gold ? 'y' : 'Y');
            g.rect(10, B - 16, 4, 3, 'r'); g.px(10, B - 13, 'R'); g.px(13, B - 13, 'R');
            win(g, 3, B - 7, 2, 3, 'k'); win(g, 19, B - 7, 2, 3, 'k'); win(g, 5, B - 13, 2, 2, 'k'); win(g, 17, B - 13, 2, 2, 'k');
            chimney(g, 18, B - 21, 5);
            flag(g, 6, B - 23, 6);
            return;
        }
        // human longhall
        if (stoneW) stone(g, 1, B - 15, 22, 16, 7); else timber(g, 1, B - 15, 22, 16, 7);
        if (!stoneW) { g.vl(8, B - 15, 16, 't'); g.vl(15, B - 15, 16, 'T'); g.hl(1, B - 8, 22, 't'); }
        gable(g, B - 24, 8, 12, 5);
        g.hl(0, B - 16, 24, 'R');
        if (gold) g.hl(8, B - 25, 8, 'y');
        chimney(g, 17, B - 27, 6);
        flag(g, 5, B - 30, 8);
        g.rect(9, B - 8, 6, 1, gold ? 'y' : 'D'); g.vl(9, B - 7, 8, gold ? 'y' : 'D'); g.vl(14, B - 7, 8, gold ? 'y' : 'D');
        g.rect(10, B - 7, 4, 8, 'd'); g.vl(11, B - 6, 6, 'n'); g.px(10, B - 3, 'Y'); g.px(13, B - 3, 'Y');
        win(g, 3, B - 13, 3, 3); win(g, 18, B - 13, 3, 3); win(g, 3, B - 6, 2, 3); win(g, 19, B - 6, 2, 3);
    },

    // ------------------------------------------------ temple
    temple(g, race, age, P) {
        const B = g.B;
        P.w = '#f2ede2'; P.W = '#d8d0c0'; P.t = '#c4bba8';
        g.hl(0, B, 16, 'W'); g.hl(1, B - 1, 14, 'w');
        g.fill(2, B - 10, 12, 9, (x, y, lx) => (lx >= 9 ? 'W' : 'w'));
        for (const cx of [2, 5, 10, 13]) { g.vl(cx, B - 10, 9, 'w'); g.vl(cx + 1, B - 10, 9, 't'); }
        g.rect(6, B - 7, 4, 6, 'd'); g.rect(7, B - 6, 2, 4, 'G');
        g.hl(0, B - 11, 16, 'W'); g.hl(1, B - 12, 14, 'r');
        g.tri(B - 15, 3, 8, 3, 2, (x, y, i, left) => (left ? 'w' : 'W'));
        g.ellipse(8, B - 16, 4.2, 3.4, (x, y, dx, dy) => (dy > 0.2 ? null : (dx < -0.2 ? 'y' : 'Y')));
        g.px(8, B - 20, 'y'); g.px(8, B - 21, 'y'); g.px(7, B - 21, age >= 4 ? 'a' : 'y');
        g.vl(0, B - 9, 5, 'r'); g.vl(15, B - 9, 5, 'R');
        if (age >= 4) { g.hl(1, B - 12, 14, 'y'); g.px(8, B - 22, 'a'); }
    },

    // ------------------------------------------------ watchtower
    tower(g, race, age, P) {
        const B = g.B;
        if (race === 'orc') {
            g.fill(1, B - 15, 6, 16, (x, y, lx, ly) => (lx >= 4 ? 'X' : (ly % 3 === 2 ? 'X' : 'x')));
            g.fill(0, B - 17, 8, 2, (x, y, lx, ly) => (ly ? 'X' : 'x'));
            g.px(0, B - 19, 'b'); g.px(0, B - 18, 'x'); g.px(7, B - 19, 'b'); g.px(7, B - 18, 'X'); g.px(3, B - 18, 'x'); g.px(4, B - 18, 'X');
        } else {
            stone(g, 1, B - 15, 6, 16, 2);
            stone(g, 0, B - 17, 8, 2, 2);
            for (const x of [0, 3, 6]) { g.px(x, B - 18, 's'); g.px(x + 1, B - 18, x === 6 ? 'S' : 's'); }
            if (race === 'elf') { g.px(1, B - 4, 'v'); g.px(1, B - 5, 'V'); g.px(2, B - 7, 'v'); g.px(6, B - 9, 'V'); g.px(5, B - 10, 'v'); }
        }
        g.hl(1, B - 14, 6, 'r');
        g.rect(3, B - 11, 2, 3, 'G');
        door(g, 3, B - 4, 2, 5);
        flag(g, 4, B - 22, 4);
        if (age >= 4) { g.px(3, B - 14, 'y'); g.px(4, B - 14, 'y'); }
    },

    // ------------------------------------------------ barracks
    barracks(g, race, age, P) {
        const B = g.B, stoneW = age >= 2 || race === 'dwarf';
        if (race === 'orc' && !stoneW) logs(g, 1, B - 11, 22, 12);
        else if (stoneW) stone(g, 1, B - 11, 22, 12, 6);
        else timber(g, 1, B - 11, 22, 12, 6);
        chimney(g, 5, B - 18, 5);
        g.tri(B - 16, 5, 12, 8, 1, shingle);
        g.hl(0, B - 12, 24, 'R');
        flag(g, 20, B - 21, 6);
        door(g, 10, B - 5, 4, 6, age >= 4); g.vl(11, B - 4, 5, 'n');
        win(g, 3, B - 9, 3, 2); win(g, 18, B - 9, 3, 2);
        // weapon rack & shields
        g.hl(15, B - 4, 4, 'X');
        for (const x of [15, 17]) { g.vl(x, B - 8, 7, 'p'); g.px(x, B - 9, 'm'); }
        g.rect(6, B - 4, 2, 2, 'r'); g.px(6, B - 4, 'L'); g.px(7, B - 3, 'R');
        if (race === 'orc') { g.px(0, B - 13, 'b'); g.px(23, B - 13, 'b'); }
    },

    // ------------------------------------------------ mine
    mine(g, race, age, P) {
        const B = g.B;
        for (let x = 0; x < 16; x++) {
            const h = Math.max(3, Math.round(11 - Math.pow(x - 7.5, 2) / 6));
            g.fill(x, B - h + 1, 1, h, (xx, yy) => (hsh(xx, yy, 7) < 0.14 ? 'k' : (x > 10 ? 'S' : 's')));
        }
        g.rect(5, B - 7, 6, 8, 'd'); g.rect(6, B - 8, 4, 1, 'd');
        g.hl(4, B - 8, 8, 't'); g.vl(4, B - 7, 8, 't'); g.vl(11, B - 7, 8, 'T');
        g.px(4, B - 9, 'G');
        g.hl(6, B, 10, 'M'); g.px(8, B, 'X'); g.px(11, B, 'X'); g.px(14, B, 'X');
        g.rect(12, B - 3, 3, 2, 'M'); g.px(12, B - 4, 'y'); g.px(13, B - 4, 'n'); g.px(14, B - 4, 'y');
        g.px(0, B, 'n'); g.px(1, B, 'y'); g.px(1, B - 1, 'n');
        flag(g, 2, B - 13, 5);
    },

    // ------------------------------------------------ granary
    granary(g, race, age, P) {
        const B = g.B, stoneW = age >= 2;
        g.fill(3, B - 11, 10, 12, (x, y, lx, ly) => {
            if (ly === 3 || ly === 8) return 't';
            if (stoneW && ly % 3 === 1 && hsh(x, y, 2) < 0.3) return 'k';
            return lx >= 7 ? 'W' : 'w';
        });
        g.tri(B - 17, 6, 8, 1, 1, shingle);
        g.hl(2, B - 12, 12, 'R');
        g.rect(7, B - 9, 2, 2, 'G');
        door(g, 7, B - 4, 2, 5);
        // grain sacks
        for (const sx of [0, 13]) { g.rect(sx, B - 2, 3, 3, 'q'); g.px(sx + 2, B - 1, 'Q'); g.px(sx + 2, B, 'Q'); g.px(sx + 1, B - 3, 'T'); }
        g.px(1, B - 4, 'h'); g.px(14, B - 4, 'h');
        if (age >= 4) g.px(7, B - 18, 'y'), g.px(8, B - 18, 'y');
    },

    // ------------------------------------------------ docks
    docks(g, race, age, P) {
        const B = g.B;
        // pier planks along the waterline
        g.fill(0, B - 2, 16, 2, (x, y, lx, ly) => (x % 3 === 2 ? 'X' : (ly ? 'X' : 'x')));
        for (const x of [1, 7, 13]) g.px(x, B, 'X');
        // shed
        if (race === 'dwarf' || age >= 2) stone(g, 1, B - 9, 8, 7, 2); else g.fill(1, B - 9, 8, 7, (x, y, lx) => (lx >= 6 ? 'W' : (lx % 3 === 0 ? 't' : 'w')));
        g.tri(B - 15, 5, 5, 1, 1, shingle); g.hl(0, B - 10, 10, 'R');
        door(g, 4, B - 6, 2, 4); win(g, 7, B - 8, 1, 2, null); win(g, 2, B - 8, 1, 2, null);
        // crane with a hanging crate
        g.vl(12, B - 14, 12, 'X'); g.hl(9, B - 14, 7, 'x'); g.px(11, B - 13, 'X'); g.px(13, B - 13, 'x');
        g.vl(15, B - 13, 4, 'T');
        g.rect(14, B - 9, 2, 2, 'x'); g.px(15, B - 8, 'X');
        g.rect(9, B - 4, 2, 2, 'X'); g.px(9, B - 4, 'x');
        flag(g, 12, B - 17, 3);
    },

    // ------------------------------------------------ smithy
    smithy(g, race, age, P) {
        const B = g.B;
        stone(g, 0, B - 9, 12, 10, 3);
        g.tri(B - 12, 3, 6, 4, 2, shingle); g.hl(0, B - 10, 12, 'R');
        chimney(g, 1, B - 16, 7, 3);
        // open forge
        g.rect(4, B - 6, 5, 5, 'd'); g.hl(3, B - 7, 7, 't');
        g.rect(5, B - 3, 3, 2, 'O'); g.px(6, B - 4, 'O'); g.hl(4, B - 1, 5, 'n');
        win(g, 9, B - 7, 2, 2, null);
        g.vl(10, B - 4, 3, 'm'); g.px(10, B - 5, 'M');
        // anvil
        g.hl(12, B - 3, 4, 'm'); g.px(12, B - 3, 'M'); g.vl(13, B - 2, 2, 'M'); g.vl(14, B - 2, 2, 'M'); g.hl(12, B, 4, 'n');
        if (race === 'orc') g.px(11, B - 11, 'b');
    },

    // ------------------------------------------------ windmill
    windmill(g, race, age, P) {
        const B = g.B, stoneW = age >= 2 || race === 'dwarf';
        g.tri(B - 17, 18, 8, 3, 1 / 6, (x, y, i, left, hw) => {
            if (stoneW && (i % 3 === 2) && hsh(x, y, 3) < 0.4) return 'k';
            if (!stoneW && x === Math.ceil(8 - hw)) return 't';
            return x >= 8 + hw - 2 ? 'W' : 'w';
        });
        g.tri(B - 21, 4, 8, 2, 1, (x, y, i, left) => (left ? 'L' : 'r'));
        g.px(8, B - 22, 'R');
        door(g, 7, B - 4, 2, 5);
        g.rect(7, B - 11, 2, 2, 'G');
        g.px(8, B - 17, 'H'); g.px(7, B - 17, 'X');
        g.rect(13, B - 2, 3, 3, 'q'); g.px(15, B - 1, 'Q'); g.px(14, B - 3, 'T');
        if (age >= 4) g.px(8, B - 23, 'y');
    },

    // ------------------------------------------------ market
    market(g, race, age, P) {
        const B = g.B;
        const goods = [['f', 'e', 'f', 'e'], ['y', 'a', 'y', 'q'], ['m', 'X', 'x', 'm']];
        for (let s = 0; s < 3; s++) {
            const x0 = s * 8, up = s === 1 ? 2 : 0;
            g.vl(x0 + 1, B - 8 - up, 6 + up, 'p'); g.vl(x0 + 6, B - 8 - up, 6 + up, 'p');
            g.fill(x0, B - 11 - up, 8, 3, (x, y, lx, ly) => (ly === 0 ? 'R' : ((lx >> 1) % 2 ? 'a' : 'r')));
            for (let lx = 0; lx < 8; lx += 2) g.px(x0 + lx, B - 8 - up, ((lx >> 1) % 2) ? 'a' : 'r');
            g.fill(x0 + 1, B - 3, 6, 3, (x, y, lx, ly) => (ly === 2 ? 'X' : (lx === 5 ? 'X' : 'x')));
            goods[s].forEach((ch, k) => g.px(x0 + 2 + k, B - 4, ch));
            g.px(x0 + 6, B - 7 - up, 'G');
        }
        if (age >= 4) { g.px(11, B - 14, 'y'); g.px(12, B - 14, 'y'); }
    },

    // ------------------------------------------------ library
    library(g, race, age, P) {
        const B = g.B;
        stone(g, 1, B - 12, 14, 13, 4);
        gable(g, B - 18, 6, 8, 2);
        g.hl(0, B - 13, 16, 'R');
        for (const wx of [3, 11]) { g.rect(wx, B - 10, 2, 5, 'G'); g.px(wx, B - 11, 'k'); g.px(wx + 1, B - 11, 'k'); g.hl(wx, B - 5, 2, 'k'); }
        g.px(7, B - 16, 'G'); g.px(8, B - 16, 'G');
        door(g, 7, B - 5, 2, 6, age >= 4); g.hl(6, B - 6, 4, age >= 4 ? 'y' : 'k');
        // open-book sign above the door
        g.rect(6, B - 9, 4, 2, 'a'); g.vl(7, B - 9, 2, 'r'); g.vl(8, B - 9, 2, 'R'); g.hl(6, B - 7, 4, 'e');
        if (age >= 4) { g.px(7, B - 19, 'y'); g.px(8, B - 19, 'y'); }
    },
};

// Castle: the hall from the Steel Age on. Race tints the stone; Golden Age adds gilding.
function castle(g, race, age) {
    const B = g.B, gold = age >= 4;
    stone(g, 5, B - 19, 14, 20, 5);
    for (let x = 5; x < 19; x += 2) g.px(x, B - 20, x >= 14 ? 'S' : 's');
    stone(g, 0, B - 24, 6, 25, 2);
    stone(g, 18, B - 24, 6, 25, 3, 'S', 'S');
    // conical tower roofs
    for (const cx of [3, 21]) g.tri(B - 30, 6, cx, 0.5, 0.55, (x, y, i, left) => (left ? 'L' : (i % 2 ? 'R' : 'r')));
    g.hl(0, B - 25, 6, 'R'); g.hl(18, B - 25, 6, 'R');
    flag(g, 3, B - 34, 4); flag(g, 21, B - 34, 4);
    if (gold) { g.px(3, B - 30, 'y'); g.px(21, B - 30, 'y'); }
    // gate with portcullis
    g.rect(9, B - 8, 6, 9, 'd'); g.hl(10, B - 9, 4, 'd');
    for (let x = 9; x < 15; x += 2) g.vl(x, B - 8, 8, 'M');
    g.hl(9, B - 4, 6, 'M');
    g.hl(9, B - 10, 6, gold ? 'y' : 'k');
    // hanging banner
    g.rect(10, B - 17, 4, 5, 'r'); g.px(10, B - 12, 'R'); g.px(13, B - 12, 'R'); g.vl(13, B - 17, 5, 'R');
    if (gold) { g.px(11, B - 15, 'y'); g.px(12, B - 15, 'y'); g.hl(10, B - 18, 4, 'y'); }
    win(g, 2, B - 19, 2, 3, 'k'); win(g, 20, B - 19, 2, 3, 'k'); win(g, 2, B - 11, 2, 2, 'k'); win(g, 20, B - 11, 2, 2, 'k');
    win(g, 7, B - 16, 2, 2, 'k'); win(g, 15, B - 16, 2, 2, 'k');
    chimney(g, 16, B - 22, 3);
    if (race === 'orc') for (let x = 5; x < 19; x += 4) g.px(x, B - 21, 'b');
    if (race === 'elf') { g.px(5, B - 3, 'v'); g.px(5, B - 4, 'V'); g.px(6, B - 6, 'v'); g.px(18, B - 7, 'V'); g.px(17, B - 9, 'v'); }
}

// Fallback for any footprint without bespoke art.
function hut(g, w) {
    const B = g.B, W = w * 8;
    g.fill(1, B - 7, W - 2, 8, (x, y, lx) => (lx >= W - 5 ? 'W' : 'w'));
    g.tri(B - 8 - Math.floor(W / 4), Math.floor(W / 4) + 1, W / 2, W / 4 - Math.floor(W / 4) + 1, 1, shingle);
    door(g, (W >> 1) - 1, B - 4, 2, 5);
    if (W >= 16) win(g, 2, B - 5, 2, 2);
}

// Compile a grid: crop empty top rows, render, build the lit layer and collect marks.
function compile(g, pal) {
    let top = 0;
    while (top < g.h - 1 && g.c[top].every(ch => ch === '.')) top++;
    const rows = g.c.slice(top).map(r => r.join(''));
    const img = fromTemplate(rows, pal, OUT);
    const h = rows.length, w = g.w;
    const lit = mk(w + 2, h + 2), lg = lit.getContext('2d');
    const marks = { windows: [], chimneys: [], flags: [], forge: [], hub: [] };
    const seen = new Set();
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const ch = rows[y][x];
        if (ch === 'G') {
            lg.fillStyle = y > 0 && rows[y - 1][x] === 'G' ? '#ffd27a' : '#fff0b8';
            lg.fillRect(x + 1, y + 1, 1, 1);
            if (!seen.has(y * w + x)) {
                marks.windows.push([x + 1, y + 1]);
                const st = [[x, y]];
                seen.add(y * w + x);
                while (st.length) {
                    const [cx, cy] = st.pop();
                    for (const [nx, ny] of [[cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]]) {
                        if (nx < 0 || ny < 0 || nx >= w || ny >= h || rows[ny][nx] !== 'G' || seen.has(ny * w + nx)) continue;
                        seen.add(ny * w + nx); st.push([nx, ny]);
                    }
                }
            }
        } else if (ch === 'K') marks.chimneys.push([x + 1, y + 1]);
        else if (ch === 'P') marks.flags.push([x + 1, y + 1]);
        else if (ch === 'O') { marks.forge.push([x + 1, y + 1]); lg.fillStyle = '#ffc46a'; lg.fillRect(x + 1, y + 1, 1, 1); }
        else if (ch === 'H') marks.hub.push([x + 1, y + 1]);
    }
    return { img, lit, marks };
}

// ---------------------------------------------------------------- vehicles (facing right, two frames)
const VEH = {
    fishing: [[
        '....p......', '....paa....', '....paar...', '....paaaa..', 'x...p.....x', 'xxxxxxxxxxx', '.XxxxxxxxX.', '..XXXXXXX..'], [
        '....p......', '....paa....', '....paaar..', '....paaa...', 'x...p.....x', 'xxxxxxxxxxx', '.XxxxxxxxX.', '..XXXXXXX..']],
    transport: [[
        '.......r.......', '...xxxxpxxxx...', '...rrrrrrrrr...', '...rrraaarrr...', '...rrraaarrr...', '...Rrrrrrrrr...', '....RrrrrrR....',
        '.......p.......', 'x......p......x', 'xxxxxxxxxxxxxxx', 'XxxkxxxkxxxkxxX', '.XXXXXXXXXXXXX.', '..XXXXXXXXXXX..'], [
        '.......rr......', '...xxxxpxxxx...', '...rrrrrrrrr...', '...rrraaarrrr..', '...rrraaarrrr..', '...Rrrrrrrrrr..', '....RrrrrrrR...',
        '.......p.......', 'x......p......x', 'xxxxxxxxxxxxxxx', 'XxxkxxxkxxxkxxX', '.XXXXXXXXXXXXX.', '..XXXXXXXXXXX..']],
    trade: [[
        '.....r.....r....', '.....p.....p....', '...aaaaa.aaaaa..', '...arrra.arrra..', '...aaaaa.aaaaa..', '...arrra.arrra..', '....aaa...aaa...',
        '.....p.....p....', 'xx..cCp.cCcp.xxx', 'xxxxxxxxxxxxxxxx', 'XxyxxxyxxxyxxxyX', '.XXXXXXXXXXXXXX.', '..XXXXXXXXXXXX..'], [
        '.....rr....rr...', '.....p.....p....', '...aaaaa.aaaaa..', '...arrraaarrraa.', '...aaaaa.aaaaa..', '...arrra.arrra..', '....aaaa..aaaa..',
        '.....p.....p....', 'xx..cCp.cCcp.xxx', 'xxxxxxxxxxxxxxxx', 'XxyxxxyxxxyxxxyX', '.XXXXXXXXXXXXXX.', '..XXXXXXXXXXXX..']],
    cart: [[
        '..cCy.........', '.cCcCcr.....h.', 'xxxxxxx..ooOOh', 'XXXXXXXXXoooOe', 'wSw.wSw..o..o.', '.w...w...k..k.'], [
        '..cCy.........', '.cCcCcr.....h.', 'xxxxxxx..ooOOh', 'XXXXXXXXXoooOe', 'SwS.SwS...oo..', '.w...w....kk..']],
};

const cache = new Map();
EP.BuildingArt = {
    building(type, race, color, age) {
        race = STYLE[race] ? race : 'human';
        age = age | 0;
        const key = `${type}|${race}|${color}|${age}`;
        let out = cache.get(key);
        if (out) return out;
        const bd = EP.BUILDINGS && EP.BUILDINGS[type];
        const f = FOOT[type];
        const w = bd ? bd.w : f ? f[0] : 2;
        const bespoke = f && DRAW[type] && f[0] === w && (!bd || f[1] === bd.h);
        const g = new Grid(w * 8, 72);
        const stoneW = age >= 2 || race === 'dwarf';
        const pal = palette(race, color, age, stoneW && type !== 'temple');
        if (bespoke) DRAW[type](g, race, age, pal); else hut(g, w);
        out = compile(g, pal);
        cache.set(key, out);
        return out;
    },
    vehicle(type, color, frame, flip) {
        const key = `V|${type}|${color}|${frame & 1}|${!!flip}`;
        let c = cache.get(key);
        if (c) return c;
        const t = VEH[type] || VEH.fishing;
        const pal = {
            p: '#5c3c22', x: '#9a6a3a', X: '#5c3a1e', a: '#f4f0e6', r: color, R: Color.shade(color, 0.68), k: '#2a1a10',
            c: '#c49a5c', C: '#8a6a3c', y: '#ffd34d', o: '#6e5034', O: '#b08c62', h: '#ece4cc', w: '#3d2b1c', S: '#c9a870', e: '#1b1b1b',
        };
        c = fromTemplate(t[frame & 1], pal, OUT, !!flip);
        cache.set(key, c);
        return c;
    },
};
})();
