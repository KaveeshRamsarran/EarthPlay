/* EarthPlay — procedural pixel-art: creatures, buildings, trees, flames, UI icons, banners. */
(function () {
'use strict';
const EP = globalThis.EP;
const { Color } = EP;

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// Render a char-grid template with a palette; optional automatic 1px outline.
function fromTemplate(rows, pal, outline = 'rgba(20,16,24,0.85)', flip = false) {
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
        const ch = rows[y][x];
        if (!solid(x, y)) continue;
        g.fillStyle = pal[ch];
        g.fillRect((flip ? w - 1 - x : x) + o, y + o, 1, 1);
    }
    return c;
}

// ---------------------------------------------------------------- creature templates (facing right)
// Two frames each: [stand/stride A, stride B].
const T = {
    human: [[
        '..hhh..', '.hhhhh.', '.hsses.', '..sss..', '.ccccc.', 's.ccc.s', '..CCC..', '..l.l..', '..l.l..', '..b.b..'], [
        '..hhh..', '.hhhhh.', '.hsses.', '..sss..', '.ccccc.', 's.ccc.s', '..CCC..', '.l...l.', '.l...l.', '.b...b.']],
    elf: [[
        '..hhh..', '.hhhhh.', 'shsses.', '..sss..', '.ccccc.', 's.ccc.s', '..ccc..', '..CCC..', '..l.l..', '..b.b..'], [
        '..hhh..', '.hhhhh.', 'shsses.', '..sss..', '.ccccc.', 's.ccc.s', '..ccc..', '..CCC..', '.l...l.', '.b...b.']],
    dwarf: [[
        '..mmm..', '.mmmmm.', '.ssses.', '.hhhhh.', 'shhhhhs', '.ccccc.', '.CCCCC.', '..l.l..', '.bb.bb.'], [
        '..mmm..', '.mmmmm.', '.ssses.', '.hhhhh.', 'shhhhhs', '.ccccc.', '.CCCCC.', '.l...l.', 'bb...bb']],
    orc: [[
        '..hhh..', '.sssss.', '.sssse.', '.ststs.', 'ccccccc', 's.ccc.s', '..CCC..', '..l.l..', '..l.l..', '.bb.bb.'], [
        '..hhh..', '.sssss.', '.sssse.', '.ststs.', 'ccccccc', 's.ccc.s', '..CCC..', '.l...l.', '.l...l.', 'bb...bb']],
    zombie: [[
        '..hh...', '.hsss..', '.hsesss', '..sss.s', '.ccccc.', '..ccc..', '..cCc..', '..l.l..', '..l.l..', '..b.b..'], [
        '..hh...', '.hsss..', '.hsesss', '..sss.s', '.ccccc.', '..ccc..', '..cCc..', '..l..l.', '.l...l.', '.b...b.']],
    deer: [[
        '.......a.a', '.......aa.', '.......dde', '.ddddddddn', 'dDddddddd.', '.dDDDdd...', '.l.l..l.l.', '.k.k..k.k.'], [
        '.......a.a', '.......aa.', '.......dde', '.ddddddddn', 'dDddddddd.', '.dDDDdd...', 'l...l.l..l', 'k...k.k..k']],
    sheep: [[
        '........', '.wwwww..', 'wwwwwwkk', 'wwwwwwke', '.wwwww..', '.k.k.k..'], [
        '........', '.wwwww..', 'wwwwwwkk', 'wwwwwwke', '.wwwww..', 'k..k..k.']],
    rabbit: [[
        '....g.g', '....ggg', '.gggge.', 'gggggg.', '.gW.g..'], [
        '....g.g', '....ggg', '.gggge.', 'gggggg.', 'g.W..g.']],
    wolf: [[
        '.......g.g', '.......ggg', '.gggggggge', 'gGgggggggn', 'g.GGGgg...', '.l.l..l.l.', '.l.l..l.l.'], [
        '.......g.g', '.......ggg', '.gggggggge', 'gGgggggggn', 'g.GGGgg...', 'l..l..l..l', 'l...l..l.l']],
    bear: [[
        '.......bb..', '..bbbbbbbbb', '.bbbbbbbbbe', 'bbbbbbbbbbn', 'bbBBBBbbbb.', '.bb.bb.bb..', '.bb.bb.bb..'], [
        '.......bb..', '..bbbbbbbbb', '.bbbbbbbbbe', 'bbbbbbbbbbn', 'bbBBBBbbbb.', 'bb..bb..bb.', 'bb...bb.bb.']],
    fish: [[
        '..fff.', 'tffffe', '..FFF.'], [
        '..fff.', 'tfffFe', 't.FFF.']],
    dragon: [[
        '..w.............', '..ww............', '..www........rr.', '...www......rrre', '....wwwrrrrrrryn', '...rrrrrrrrrry..', '.rrRrrrrrrrr....', 'rr..RRyyyyRR....', 'r....r.r..r.r...', '.....k.k..k.k...'], [
        '................', '................', '.............rr.', '............rrre', '....rrrrrrrrrryn', '...rrrrrrrrrry..', '.rrRwwwwwrrr....', 'rr..wwwwwwRR....', 'r....wwwr.r.r...', '.....k.k..k.k...']],
};

const ANIMAL_PAL = {
    deer: { d: '#a86b3c', D: '#8a5530', a: '#e9d6b0', e: '#1b1b1b', n: '#2b1b14', l: '#7a4a28', k: '#3a2a1e' },
    sheep: { w: '#f2efe6', k: '#3b3434', e: '#f2efe6' },
    rabbit: { g: '#b9a58e', e: '#1b1b1b', W: '#f2efe6' },
    wolf: { g: '#8e939b', G: '#6f747c', e: '#ffd34d', n: '#222', l: '#5f646b' },
    bear: { b: '#6b4429', B: '#55351f', e: '#1b1b1b', n: '#2a1a10' },
    fish: { f: '#ffb44a', F: '#e08a2a', t: '#ff8a1f', e: '#1b1b1b' },
    dragon: { r: '#c6372b', R: '#8f2219', w: '#7a1f3a', y: '#ffcf5a', e: '#ffe066', n: '#3a0d0d', k: '#2a1010' },
    zombie: { h: '#3b3a2e', s: '#8fa874', e: '#d4202a', c: '#4a4f5c', C: '#33363f', l: '#3a3f4a', b: '#2a2a2a' },
};

// ---------------------------------------------------------------- tree templates (8x8, baked into terrain)
// Palette letters: L light, M mid, D dark, t trunk, T trunk dark, S snow/highlight, X special
const TREES = {
    1: { rows: ['..LLM...', '.LLMMMD.', 'LLMMMMDD', 'LMMMMMDD', '.MMMMDD.', '..DttD..', '...tT...', '...tT...'], pal: { L: '#6fc04a', M: '#4f9e36', D: '#3a7d29', t: '#7a5230', T: '#5c3c22' } },
    2: { rows: ['...L....', '...LM...', '..LMMD..', '..LMMD..', '.LMMMDD.', '.LMMMMD.', 'LMMMMMDD', '...tT...'], pal: { L: '#4f9a5a', M: '#2f7a45', D: '#235e36', t: '#6b4a2b', T: '#4f361f' } },
    3: { rows: ['.LL..LL.', 'LMMLLMMD', '.D.MM.D.', '...tT...', '...tT...', '..tT....', '..tT....', '..tT....'], pal: { L: '#8fd05a', M: '#5fae3a', D: '#3f8a2a', t: '#b08850', T: '#8a6a3c' } },
    4: { rows: ['........', '...LM...', '.L.LM...', '.LMLM.L.', '..MLMLM.', '...LMM..', '...LM...', '...LM...'], pal: { L: '#6fb35a', M: '#4f8f3e' } },
    5: { rows: ['..LMMD..', '.LMMMMD.', 'LMMDMMDD', 'MDM.MDMD', 'M.D.M.DM', '...tT..D', '...tT...', '...tT...'], pal: { L: '#7fa84a', M: '#5f8a3a', D: '#476b2c', t: '#5c4630', T: '#45331f' } },
    6: { rows: ['........', '........', '........', '..LLM...', '.LMMMD..', 'LMMXMDD.', '.MMMDD..', '........'], pal: { L: '#9bbf4a', M: '#7a9e3a', D: '#5e7d2c', X: '#d45050' } },
    7: { rows: ['...S....', '...SM...', '..SMMD..', '..SSMD..', '.SMMMDD.', '.SSMMSD.', 'SMMMMMDD', '...tT...'], pal: { S: '#f2f6fa', M: '#2f6a4a', D: '#245238', t: '#6b4a2b', T: '#4f361f' } },
    8: { rows: ['..LLM...', '.LLMMMD.', 'LLMMMMDD', '.LMMMDD.', '..MMDD..', '...wW...', '...wW...', '...wW...'], pal: { L: '#a6d65a', M: '#86bb43', D: '#6a9a34', w: '#f0eee6', W: '#5a5a5a' } },
};

// Flame frames (6x8)
const FLAMES = [
    ['..y...', '.yy.y.', '.yoyy.', 'yooyo.', 'yorroy', '.orro.', '..rr..', '......'],
    ['...y..', '.y.yy.', '.yyoy.', '.yoooy', 'yorroy', '.orro.', '..rr..', '......'],
    ['.y....', '.yy.y.', 'yyoyy.', 'yooyoy', '.orroy', '.orro.', '..rr..', '......'],
];
const FLAME_PAL = { y: '#fff3a0', o: '#ffb43a', r: '#f0611a' };

// ---------------------------------------------------------------- icon templates (12x12)
const ICONS = {
    lightning: [['.......yyy..', '......yyy...', '.....yyy....', '....yyy.....', '...yyyyyyy..', '......yyy...', '.....yyy....', '....yyy.....', '...yy.......', '..yy........', '.y..........', '............'], { y: '#ffe066' }],
    fire: [['.....r......', '....rr..r...', '....ror.rr..', '...roorrr...', '..roooorr.r.', '..royyyorrr.', '.royyyyyorr.', '.royywyyor..', '.royywwyor..', '..royyyyor..', '...roooor...', '....rrrr....'], { r: '#d63a1a', o: '#ff8a1f', y: '#ffd34d', w: '#fff8d0' }],
    meteor: [['y...........', '.yo.........', '..ooy.......', '...oro......', '....orr.....', '.....rkkk...', '.....kKKkk..', '....kKKKkk..', '....kKKkkk..', '.....kkkk...', '............', '............'], { y: '#fff3a0', o: '#ffb43a', r: '#f0611a', k: '#6b5a4a', K: '#8a7a66' }],
    quake: [['............', '............', 'gggggggggggg', 'GGGGG.GGGGGG', 'gggg..gggggg', 'GGGGG..GGGGG', 'gggg.r..gggg', 'GGG..rr..GGG', 'ggg.r...gggg', 'GGGG..GGGGGG', 'gggg.ggggggg', 'GGGGGGGGGGGG'], { g: '#8a7a66', G: '#6b5d4c', r: '#ff7b1f' }],
    tornado: [['gggggggggggg', '.gGGGGGGGGg.', '..gggggggg..', '..GGGGGGGG..', '...gggggg...', '...GGGGGG...', '....gggg....', '....GGGG....', '.....ggg....', '.....GG.....', '......g.....', '......g.....'], { g: '#b5b9c2', G: '#8e939b' }],
    volcano: [['....s..s....', '.....ss.....', '....rory....', '....kryk....', '...kkrkkk...', '...kkkrkk...', '..kKkkkkKk..', '..kkkkkkkkk.', '.kKkkkkkKkk.', '.kkkkkkkkkkk', 'kkKkkkkkkKkk', 'kkkkkkkkkkkk'], { s: '#777', r: '#ff5a1f', o: '#ffb43a', y: '#ffe066', k: '#6b5d55', K: '#857669' }],
    plague: [['............', '....gggg....', '...gGGGGg...', '..gGgGGgGg..', '..gGgGGgGg..', '..gGGGGGGg..', '...gGddGg...', '....gGGg....', '...g.gg.g...', '..g..gg..g..', '......g.....', '............'], { g: '#4f8f2a', G: '#9be15d', d: '#2a4a14' }],
    curse: [['............', '....pppp....', '...pPPPPp...', '..pPPPPPPp..', '..pkkPPkkp..', '..pkkPPkkp..', '..pPPkkPPp..', '...pPPPPp...', '...pPpPpP...', '....p.p.....', '............', '............'], { p: '#4a2470', P: '#b48cff', k: '#1a0d2b' }],
    nuke: [['...oooooo...', '..oyyyyyyo..', '.oyywwwyyo..', '.oyyyyyyyyo.', '..oooooooo..', '.....yy.....', '.....oy.....', '.....yo.....', '....oyyo....', '..ooyyyyoo..', '.oyyyyyyyyo.', 'oooooooooooo'], { o: '#d63a1a', y: '#ffb43a', w: '#fff3a0' }],
    bless: [['.....y......', '.....y......', '..y..y..y...', '...y.y.y....', '....yyy.....', 'yyyyyWyyyyy.', '....yyy.....', '...y.y.y....', '..y..y..y...', '.....y......', '.....y......', '............'], { y: '#ffd34d', W: '#ffffff' }],
    rain: [['...wwww.....', '..wWWWWww...', '.wWWWWWWWw..', 'wWWWWWWWWWw.', 'wwwwwwwwwww.', '............', '.b..b..b..b.', 'b..b..b..b..', '............', '..b..b..b...', '.b..b..b....', '............'], { w: '#9aa6b8', W: '#dfe6ef', b: '#5aa9e6' }],
    bloom: [['.....pp.....', '....pyyp....', '.....pp.....', '.....g......', '..gg.g......', '.gGGgg..gg..', '..gg.g.gGGg.', '.....ggg.gg.', '......g.....', '....kkkkk...', '...kKKKKKk..', '............'], { p: '#ff7eb6', y: '#ffe066', g: '#4f9e36', G: '#7fd05a', k: '#7a5230', K: '#9b7653' }],
    heal: [['............', '....gggg....', '....gGGg....', '....gGGg....', '.ggggGGgggg.', '.gGGGGGGGGg.', '.gGGGGGGGGg.', '.ggggGGgggg.', '....gGGg....', '....gGGg....', '....gggg....', '............'], { g: '#1f8a4c', G: '#7dffb0' }],
    inspect: [['............', '...kkkk.....', '..kWWWWk....', '.kWWbWWWk...', '.kWbWWWWk...', '.kWWWWWWk...', '.kWWWWWWk...', '..kWWWWk....', '...kkkkkk...', '.......kkk..', '........kkk.', '.........kk.'], { k: '#2a2a33', W: '#cfe9ff', b: '#ffffff' }],
    discord: [['k.........k.', '.kW......Wk.', '..kW....Wk..', '...kW..Wk...', '....kWWk....', '.....kk.....', '....kWWk....', '...hW..Wh...', '..hhk..khh..', '.hh......hh.', 'rr........rr', 'r..........r'], { k: '#9aa3ab', W: '#e6ebf0', h: '#7a5230', r: '#e6492e' }],
    harmony: [['............', '..rr...rr...', '.rRRr.rRRr..', 'rRWRRrRRRRr.', 'rRRRRRRRRRr.', 'rRRRRRRRRRr.', '.rRRRRRRRr..', '..rRRRRRr...', '...rRRRr....', '....rRr.....', '.....r......', '............'], { r: '#2e86e6', R: '#7dd3fc', W: '#ffffff' }],
    rebel: [['k...........', 'krrrrrr.....', 'krRRRRrr....', 'krRRRRRrr...', 'krRRRRrr....', 'krrrrrr.....', 'k...........', 'k...........', 'k...........', 'k...........', 'k...........', 'kk..........'], { k: '#5c3c22', r: '#a30000', R: '#e6492e' }],
    prosper: [['............', '.....yyy....', '....yYYYy...', '....yYyYy...', '.....yyy....', '..yyy..yyy..', '.yYYYyyYYYy.', '.yYyYyyYyYy.', '..yyy..yyy..', '.yyyyyyyyyy.', 'yYYYYYYYYYYy', 'yyyyyyyyyyyy'], { y: '#c98a1b', Y: '#ffd34d' }],
    raise: [['.....ww.....', '....wwww....', '...wwwwww...', '.....ww.....', '.....ww.....', '............', '.....gg.....', '....gGGg....', '...gGGGGg...', '..gGGGGGGg..', '.gGGGGGGGGg.', 'kkkkkkkkkkkk'], { w: '#ffffff', g: '#4f9e36', G: '#7cc152', k: '#6b5d4c' }],
    lower: [['.....ww.....', '.....ww.....', '...wwwwww...', '....wwww....', '.....ww.....', '............', 'gggg....gggg', 'GGGGb..bGGGG', 'kkkkbbbbkkkk', 'kkkkkbbkkkkk', 'kkkkkkkkkkkk', 'kkkkkkkkkkkk'], { w: '#ffffff', g: '#4f9e36', G: '#7cc152', b: '#2f7cb3', k: '#6b5d4c' }],
    erase: [['............', '.......kk...', '......kPPk..', '.....kPPPPk.', '....kPPPPk..', '...kWWPPk...', '..kWWWWk....', '.kWWWWk.....', '.kWWWk......', '..kkk.......', '............', 'gggggggggggg'], { k: '#2a2a33', P: '#ff7eb6', W: '#f2efe6', g: '#7cc152' }],
    cat_terrain: [['............', '......k.....', '.....kSk....', '....kSSkk...', '....kSkKk...', '...kkkKKkk..', '..kKkkkKKk..', '.kKKkkkkKKk.', 'gggggggggggg', 'GGGGGGGGGGGG', 'gggggggggggg', '............'], { k: '#7a756f', K: '#5c5853', S: '#f2f6fa', g: '#64a940', G: '#7cc152' }],
    cat_life: [['....hhh.....', '...hhhhh....', '...hsses....', '....sss.....', '...ccccc....', '..s.ccc.s...', '....CCC.....', '....l.l.....', '....l.l.....', '....b.b.....', '............', '............'], { h: '#5a3825', s: '#f1c27d', e: '#1b1b1b', c: '#2e86e6', C: '#1f5fa8', l: '#3a3f4a', b: '#2a1a10' }],
    cat_nature: [['............', '.......ggg..', '.....ggGGg..', '....gGGGGg..', '...gGGgGGg..', '...gGgGGg...', '..gGgGGg....', '..ggGgg.....', '..g.gg......', '.g..........', 'g...........', '............'], { g: '#2f7a45', G: '#7fd05a' }],
    cat_destroy: [['.....r......', '....rr..r...', '....ror.rr..', '...roorrr...', '..roooorr.r.', '..royyyorrr.', '.royyyyyorr.', '.royywyyor..', '.royywwyor..', '..royyyyor..', '...roooor...', '....rrrr....'], { r: '#d63a1a', o: '#ff8a1f', y: '#ffd34d', w: '#fff8d0' }],
    cat_realm: [['............', '............', '.y...y...y..', '.yy.yyy.yy..', '.yyyyyyyyy..', '.yYyyRyyYy..', '.yyyyyyyyy..', '.YYYYYYYYY..', '............', '............', '............', '............'], { y: '#ffd34d', Y: '#c98a1b', R: '#e6492e' }],
};

const Sprites = EP.Sprites = {
    cache: new Map(),
    treePix: {},
    init() {
        // Trees → RGB arrays for terrain baking
        for (const id in TREES) {
            const t = TREES[id];
            const px = new Array(64).fill(null);
            for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
                const ch = t.rows[y][x];
                if (ch !== '.' && t.pal[ch]) px[y * 8 + x] = Color.hexToRgb(t.pal[ch]);
            }
            this.treePix[id] = px;
        }
        this.flames = FLAMES.map(f => fromTemplate(f, FLAME_PAL, null));
        this.glows = {};
        for (const [k, c] of Object.entries({ warm: '#ffb347', fire: '#ff7b1f', lava: '#ff5a1f', magic: '#9fe8ff', white: '#ffffff', window: '#ffd27a' })) this.glows[k] = Sprites.makeGlow(c);
        this.cloud = Sprites.makeCloud();
    },
    makeGlow(color) {
        const c = mk(64, 64), g = c.getContext('2d');
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, Color.rgba(color, 0.65)); gr.addColorStop(0.35, Color.rgba(color, 0.22)); gr.addColorStop(1, Color.rgba(color, 0));
        g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
        return c;
    },
    makeCloud() {
        const c = mk(160, 90), g = c.getContext('2d');
        const puffs = [[50, 50, 30], [80, 40, 36], [112, 50, 28], [70, 58, 26], [100, 60, 24], [35, 58, 18], [130, 58, 18]];
        for (const [x, y, r] of puffs) {
            const gr = g.createRadialGradient(x, y, 0, x, y, r);
            gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
            g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
        }
        return c;
    },

    // ------------------------------------------------------------ creatures
    unit(u, color, frame) {
        const flip = u.face < 0;
        const key = u.kind === 'civ' ? `${u.species}|${color}|${u.skin}|${u.hair}|${frame}|${flip}` : `${u.species}|${frame}|${flip}`;
        let c = this.cache.get(key);
        if (c) return c;
        let pal;
        if (u.kind === 'civ') {
            pal = { h: u.hair, s: u.skin, e: '#1b1b1b', c: color, C: Color.shade(color, 0.7), l: '#3a3f4a', b: '#2a1a10', m: '#9aa3ab', t: '#f2efe6' };
        } else pal = ANIMAL_PAL[u.species];
        c = fromTemplate(T[u.species][frame], pal, 'rgba(20,16,24,0.8)', flip);
        this.cache.set(key, c);
        return c;
    },
    flame(i) { return this.flames[i % this.flames.length]; },

    // ------------------------------------------------------------ buildings
    building(b, k) {
        const race = k ? k.race : 'human', color = k ? k.color : '#888888', age = k ? k.age : 0;
        const key = `B|${b.type}|${race}|${color}|${b.type === 'hall' || b.type === 'house' ? age : 0}`;
        let c = this.cache.get(key);
        if (c) return c;
        c = this.drawBuilding(b.type, race, color, age);
        this.cache.set(key, c);
        return c;
    },
    drawBuilding(type, race, color, age) {
        const d = EP.BUILDINGS[type];
        const W = d.w * 8, extra = type === 'tower' ? 12 : type === 'hall' ? (age >= 3 ? 12 : 8) : 6;
        const H = d.h * 8 + extra;
        const c = mk(W, H), g = c.getContext('2d');
        const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
        const roof = color, roofD = Color.shade(color, 0.68), roofL = Color.mix(color, '#ffffff', 0.25);
        const style = {
            human: { wall: '#e8d8b0', wallD: '#c9b68a', trim: '#6b4a2b' },
            elf: { wall: '#eef3e2', wallD: '#cdd8bd', trim: '#6f8f4a' },
            dwarf: { wall: '#a39e96', wallD: '#7f7a73', trim: '#4f4a45' },
            orc: { wall: '#a07850', wallD: '#7d5c3c', trim: '#3d2b1c' },
        }[race];
        const stone = age >= 2 || race === 'dwarf';
        const base = H - d.h * 8; // y where footprint starts
        // ground shadow
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(2, H - 3, W - 2, 3);

        if (type === 'house') {
            if (race === 'orc') { // hide tent
                for (let y = 0; y < 14; y++) { const hw = Math.round(1 + y * 0.55); R(8 - hw, H - 15 + y, hw * 2, 1, y % 4 === 1 ? roof : (y < 7 ? style.wall : style.wallD)); }
                R(7, H - 6, 2, 5, '#2a1a10'); R(7, H - 17, 2, 3, style.trim); R(6, H - 18, 1, 2, style.trim); R(9, H - 18, 1, 2, style.trim);
                return c;
            }
            const wall = stone && race !== 'elf' ? '#b9b2a6' : style.wall;
            R(2, H - 10, 12, 9, wall); R(10, H - 10, 4, 9, stone && race !== 'elf' ? '#9a948a' : style.wallD);
            R(7, H - 6, 2, 5, '#4a2e1a'); R(3, H - 8, 2, 2, '#3a4f6a'); R(11, H - 8, 2, 2, '#3a4f6a');
            if (race === 'human' && !stone) { R(2, H - 10, 12, 1, style.trim); R(2, H - 5, 1, 4, style.trim); R(13, H - 5, 1, 4, style.trim); }
            if (race === 'elf') { // round leafy roof
                for (let y = 0; y < 7; y++) { const hw = [3, 5, 6, 7, 7, 8, 8][y]; R(8 - hw, H - 17 + y, hw * 2, 1, y < 3 ? roofL : roof); }
                R(4, H - 12, 8, 1, roofD);
            } else if (race === 'dwarf') {
                R(1, H - 13, 14, 3, roofD); R(1, H - 14, 14, 1, roof); R(3, H - 16, 2, 2, '#6b6560'); // chimney
            } else {
                for (let y = 0; y < 7; y++) { const hw = 2 + y; R(8 - hw, H - 17 + y, hw, 1, roofL); R(8, H - 17 + y, hw, 1, roof); }
                R(0, H - 11, 16, 1, roofD);
                R(11, H - 18, 2, 3, '#6b6560');
            }
            return c;
        }
        if (type === 'hall') {
            const wall = stone ? '#bdb5a8' : style.wall, wallD = stone ? '#9b9387' : style.wallD;
            if (age >= 3) { // castle
                R(1, base + 4, 22, 19, '#a9a294'); R(14, base + 4, 9, 19, '#8d877b');
                for (let x = 1; x < 23; x += 3) R(x, base + 2, 2, 2, '#a9a294');
                R(0, base - 6, 7, 28, '#b8b1a4'); R(17, base - 6, 7, 28, '#958f83');
                for (let x = 0; x < 7; x += 2) { R(x, base - 8, 1, 2, '#b8b1a4'); R(17 + x, base - 8, 1, 2, '#958f83'); }
                R(9, base + 14, 6, 9, '#3a2618'); R(10, base + 13, 4, 1, '#3a2618');
                R(2, base, 2, 2, '#2a2a33'); R(19, base, 2, 2, '#2a2a33'); R(3, base + 8, 2, 3, '#2a2a33'); R(19, base + 8, 2, 3, '#2a2a33');
                R(3, base - 12, 1, 6, '#3d2b1c'); R(4, base - 12, 4, 3, roof);
                R(20, base - 12, 1, 6, '#3d2b1c'); R(21, base - 12, 3, 3, roof);
                if (age >= 4) { R(10, base + 6, 4, 4, '#ffd34d'); R(11, base + 7, 2, 2, '#fff3a0'); }
                return c;
            }
            // longhall / stone hall
            R(1, base + 6, 22, 17, wall); R(15, base + 6, 8, 17, wallD);
            if (race === 'orc') {
                for (let y = 0; y < 12; y++) { const hw = Math.round(3 + y * 0.8); R(12 - hw, base - 6 + y, hw * 2, 1, y % 3 === 0 ? roof : (y < 6 ? style.wall : style.wallD)); }
                R(11, base - 9, 1, 4, '#e8e0cc'); R(13, base - 9, 1, 4, '#e8e0cc');
            } else if (race === 'elf') {
                for (let y = 0; y < 12; y++) { const hw = [4, 6, 8, 9, 10, 11, 11, 12, 12, 12, 12, 12][y]; R(12 - hw, base - 6 + y, hw * 2, 1, y < 4 ? roofL : roof); }
            } else {
                for (let y = 0; y < 11; y++) { const hw = 2 + y; R(12 - hw, base - 5 + y, hw, 1, roofL); R(12, base - 5 + y, hw, 1, roof); }
                R(0, base + 5, 24, 1, roofD);
            }
            R(10, base + 15, 4, 8, '#3a2618');
            R(4, base + 10, 3, 3, '#3a4f6a'); R(17, base + 10, 3, 3, '#3a4f6a');
            if (age >= 1) { R(19, base - 8, 4, 16, stone ? '#b0a89b' : style.wallD); R(19, base - 10, 1, 2, stone ? '#b0a89b' : style.wallD); R(22, base - 10, 1, 2, stone ? '#b0a89b' : style.wallD); }
            R(5, base - 10, 1, 7, '#3d2b1c'); R(6, base - 10, 5, 3, roof); R(6, base - 8, 5, 1, roofD);
            return c;
        }
        if (type === 'tower') {
            const s = race === 'orc' ? '#8a6a48' : race === 'elf' ? '#e6ead8' : '#b0a89b', sD = Color.shade(s, 0.8);
            R(1, 6, 6, H - 7, s); R(5, 6, 2, H - 7, sD);
            R(0, 4, 8, 3, s); R(0, 2, 2, 2, s); R(3, 2, 2, 2, s); R(6, 2, 2, 2, sD);
            R(3, 10, 2, 3, '#2a2a33'); R(3, H - 6, 2, 5, '#3a2618');
            R(3, 0, 1, 3, '#3d2b1c'); R(4, 0, 3, 2, roof);
            return c;
        }
        if (type === 'temple') {
            R(1, H - 12, 14, 11, '#efe9dc'); R(11, H - 12, 4, 11, '#d6cfbf');
            for (let x = 2; x < 14; x += 3) R(x, H - 11, 1, 9, '#c8c0ae');
            R(0, H - 14, 16, 2, '#d6cfbf'); R(6, H - 6, 4, 5, '#5a4a3a');
            for (let y = 0; y < 6; y++) { const hw = [2, 4, 5, 6, 6, 6][y]; R(8 - hw, H - 20 + y, hw * 2, 1, y < 3 ? '#ffe680' : '#e0b84a'); }
            R(7, H - 22, 2, 2, '#ffd34d');
            R(1, H - 1, 14, 1, roof);
            return c;
        }
        if (type === 'barracks') {
            R(1, H - 13, 22, 12, stone ? '#b0a89b' : style.wall); R(16, H - 13, 7, 12, stone ? '#958e82' : style.wallD);
            R(0, H - 16, 24, 3, roofD); R(0, H - 17, 24, 1, roof);
            R(10, H - 7, 4, 6, '#3a2618');
            for (let x = 3; x < 9; x += 2) { R(x, H - 11, 1, 6, '#6b4a2b'); R(x, H - 12, 1, 1, '#d9e1e8'); }
            R(18, H - 22, 1, 9, '#3d2b1c'); R(19, H - 22, 4, 4, roof); R(19, H - 20, 4, 1, roofD);
            return c;
        }
        if (type === 'mine') {
            R(1, H - 9, 14, 8, '#6b5d4c'); R(3, H - 12, 10, 4, '#7a6a58');
            R(5, H - 8, 6, 7, '#1e1812'); R(4, H - 10, 1, 9, '#7a5230'); R(11, H - 10, 1, 9, '#7a5230'); R(4, H - 10, 8, 1, '#7a5230');
            R(12, H - 4, 3, 2, '#5c4630'); R(12, H - 5, 3, 1, '#9a958e'); R(13, H - 6, 1, 1, '#ffd34d');
            R(1, H - 13, 1, 4, '#3d2b1c'); R(2, H - 13, 3, 2, roof);
            return c;
        }
        return c;
    },

    // ------------------------------------------------------------ UI
    icon(id) {
        const key = 'I|' + id;
        let c = this.cache.get(key);
        if (c) return c;
        if (ICONS[id]) c = fromTemplate(ICONS[id][0], ICONS[id][1], 'rgba(10,10,16,0.7)');
        else if (EP.SPECIES[id]) {
            const fake = { species: id, kind: EP.SPECIES[id].kind, face: 1, skin: EP.SPECIES[id].skin ? EP.SPECIES[id].skin[0] : null, hair: EP.SPECIES[id].hair ? EP.SPECIES[id].hair[1] : null };
            c = this.unit(fake, '#2e86e6', 0);
        } else {
            const tool = EP.TOOL_BY_ID[id];
            if (tool && (tool.terrain != null || id === 'forest')) c = this.terrainSwatch(tool.terrain != null ? tool.terrain : EP.T.GRASS, id === 'forest');
        }
        if (!c) c = mk(12, 12);
        this.cache.set(key, c);
        return c;
    },
    terrainSwatch(t, tree) {
        const c = mk(12, 12), g = c.getContext('2d');
        const cols = EP.TERRAIN[t].colors;
        for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) {
            g.fillStyle = cols[Math.floor(EP.hash2(x, y, t) * 4)];
            g.fillRect(x, y, 1, 1);
        }
        if (t === EP.T.MOUNTAIN) { g.fillStyle = '#f2f6fa'; g.fillRect(5, 1, 2, 1); g.fillRect(4, 2, 4, 1); g.fillStyle = '#69655f'; for (let y = 3; y < 12; y++) g.fillRect(6 + (y >> 1) - 1, y, 12, 1); }
        if (t === EP.T.HILLS) { g.fillStyle = '#5c783d'; g.fillRect(1, 7, 5, 2); g.fillRect(6, 4, 5, 2); }
        if (t === EP.T.LAVA) { g.fillStyle = '#fff3a0'; g.fillRect(3, 4, 2, 1); g.fillRect(7, 8, 3, 1); }
        if (t === EP.T.DEEP || t === EP.T.SHALLOW) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(2, 3, 3, 1); g.fillRect(7, 7, 3, 1); }
        if (tree) {
            const px = this.treePix[1];
            for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const p = px[y * 8 + x]; if (p) { g.fillStyle = `rgb(${p[0]},${p[1]},${p[2]})`; g.fillRect(x + 2, y + 2, 1, 1); } }
        }
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.strokeRect(0.5, 0.5, 11, 11);
        return c;
    },
    banner(color, sym, size = 14) {
        const key = `BN|${color}|${sym}|${size}`;
        let c = this.cache.get(key);
        if (c) return c;
        c = mk(10, 12);
        const g = c.getContext('2d');
        const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
        R(0, 0, 10, 8, '#1b1b24'); R(1, 8, 8, 1, '#1b1b24'); R(2, 9, 6, 1, '#1b1b24'); R(3, 10, 4, 1, '#1b1b24'); R(4, 11, 2, 1, '#1b1b24');
        R(1, 1, 8, 7, color); R(2, 8, 6, 1, color); R(3, 9, 4, 1, color); R(4, 10, 2, 1, color);
        R(1, 1, 8, 1, Color.mix(color, '#ffffff', 0.35));
        const fg = Color.hexToRgb(color).reduce((a, b) => a + b, 0) > 520 ? '#1b1b24' : '#ffffff';
        switch (sym % 6) {
            case 0: R(4, 3, 2, 4, fg); R(3, 4, 4, 2, fg); break;
            case 1: R(2, 3, 6, 1, fg); R(4, 2, 2, 6, fg); break;
            case 2: R(2, 6, 2, 1, fg); R(3, 5, 2, 1, fg); R(4, 4, 2, 1, fg); R(5, 5, 2, 1, fg); R(6, 6, 2, 1, fg); break;
            case 3: R(4, 2, 2, 6, fg); R(2, 4, 6, 2, fg); R(3, 3, 4, 4, fg); break;
            case 4: R(1, 4, 8, 2, fg); break;
            case 5: R(2, 4, 1, 3, fg); R(4, 3, 2, 4, fg); R(7, 4, 1, 3, fg); R(2, 6, 6, 1, fg); break;
        }
        this.cache.set(key, c);
        return c;
    },
    // Draw any sprite into a DOM canvas at integer scale.
    paintInto(canvas, src, size) {
        canvas.width = size; canvas.height = size;
        const g = canvas.getContext('2d');
        g.imageSmoothingEnabled = false;
        const s = Math.max(1, Math.floor(size / Math.max(src.width, src.height)));
        const w = src.width * s, h = src.height * s;
        g.drawImage(src, ((size - w) / 2) | 0, ((size - h) / 2) | 0, w, h);
    },
};
})();
