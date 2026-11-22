/* EarthPlay — static game data: terrain, trees, species, buildings, ages, traits, names, tools. */
(function () {
'use strict';
const EP = globalThis.EP;

// ---------------------------------------------------------------- Timing
EP.TPS = 30;                 // simulation ticks per second at 1x
EP.TICKS_PER_YEAR = 240;     // 8 seconds per year at 1x
EP.DAY_TICKS = 1800;         // one visual day/night cycle (60 s at 1x)
EP.TILE = 8;                 // world pixels per tile

// ---------------------------------------------------------------- Heights
EP.SEA = 100;                // height < SEA is water
EP.SHALLOW = 86;             // height >= SHALLOW (and < SEA) is shallow water
EP.HILLS = 168;
EP.PEAK = 196;               // mountain
EP.SNOWCAP = 232;

// ---------------------------------------------------------------- Terrain
const T = EP.T = {
    DEEP: 0, SHALLOW: 1, SAND: 2, GRASS: 3, SAVANNA: 4, DESERT: 5, SWAMP: 6, SNOW: 7,
    HILLS: 8, MOUNTAIN: 9, LAVA: 10, ASH: 11, FARM: 12, ROAD: 13, ROCK: 14, SOIL: 15,
};
// colors: 4 shades light→dark used for dithered texture.
// walk: land creatures can stand here. slow: movement multiplier. burn: chance to catch fire.
// build: settlements can build. grow: trees can spread here. graze: food for grazers.
EP.TERRAIN = [];
const def = (id, o) => (EP.TERRAIN[id] = Object.assign({ id, walk: true, slow: 1, burn: 0, build: false, grow: false, graze: 0, water: false }, o));
def(T.DEEP,     { name: 'Ocean',        colors: ['#1d5d9b', '#1a5590', '#174e86', '#14467a'], walk: false, water: true });
def(T.SHALLOW,  { name: 'Shallows',     colors: ['#3d8fc7', '#3685bd', '#2f7cb3', '#2a73a8'], slow: 0.5, water: true });
def(T.SAND,     { name: 'Sand',         colors: ['#ecd9a0', '#e3cd8f', '#d9c182', '#cdb373'], build: true, grow: true, graze: 0.1 });
def(T.GRASS,    { name: 'Grassland',    colors: ['#7cc152', '#6fb548', '#64a940', '#589b38'], build: true, grow: true, burn: 0.008, graze: 1 });
def(T.SAVANNA,  { name: 'Savanna',      colors: ['#c4c35a', '#b8b650', '#aaa847', '#9c9a3f'], build: true, grow: true, burn: 0.016, graze: 0.7 });
def(T.DESERT,   { name: 'Desert',       colors: ['#f0c87a', '#e7bc6c', '#dcb062', '#d0a355'], build: true, graze: 0 });
def(T.SWAMP,    { name: 'Swamp',        colors: ['#5f7d4a', '#567343', '#4d693c', '#445e36'], slow: 0.6, grow: true, graze: 0.5 });
def(T.SNOW,     { name: 'Tundra',       colors: ['#f4f8fb', '#e8eff5', '#dbe5ee', '#ccd9e5'], build: true, grow: true, slow: 0.8, graze: 0.1 });
def(T.HILLS,    { name: 'Hills',        colors: ['#7e9b55', '#73904d', '#688545', '#5c783d'], slow: 0.7, grow: true, build: false, burn: 0.006, graze: 0.5 });
def(T.MOUNTAIN, { name: 'Mountain',     colors: ['#9a958e', '#8a857e', '#7a756f', '#69655f'], walk: false });
def(T.LAVA,     { name: 'Lava',         colors: ['#ffb43a', '#ff8a1f', '#f0611a', '#d43f12'], walk: false });
def(T.ASH,      { name: 'Scorched',     colors: ['#4d4744', '#45403d', '#3d3836', '#35312f'], build: true, graze: 0 });
def(T.FARM,     { name: 'Farmland',     colors: ['#a8c94e', '#97b845', '#7e5a36', '#6d4c2d'], build: false, burn: 0.012 });
def(T.ROAD,     { name: 'Road',         colors: ['#c7a77b', '#b99a70', '#ab8d66', '#9c805b'], build: false, slow: 1.25 });
def(T.ROCK,     { name: 'Basalt',       colors: ['#5d5a5e', '#545155', '#4b484c', '#424043'], build: true });
def(T.SOIL,     { name: 'Soil',         colors: ['#9b7653', '#8e6b4a', '#816142', '#73563a'], build: true, grow: true, graze: 0.2 });

EP.isWaterT = t => t === T.DEEP || t === T.SHALLOW;

// ---------------------------------------------------------------- Trees
const TR = EP.TREE = { NONE: 0, OAK: 1, PINE: 2, PALM: 3, CACTUS: 4, WILLOW: 5, BUSH: 6, SNOWPINE: 7, BIRCH: 8 };
EP.TREE_INFO = {
    [TR.OAK]:      { name: 'Oak',       wood: 6, burn: 0.35 },
    [TR.PINE]:     { name: 'Pine',      wood: 6, burn: 0.4 },
    [TR.PALM]:     { name: 'Palm',      wood: 4, burn: 0.25 },
    [TR.CACTUS]:   { name: 'Cactus',    wood: 1, burn: 0.05 },
    [TR.WILLOW]:   { name: 'Willow',    wood: 5, burn: 0.15 },
    [TR.BUSH]:     { name: 'Shrub',     wood: 2, burn: 0.45 },
    [TR.SNOWPINE]: { name: 'Fir',       wood: 6, burn: 0.2 },
    [TR.BIRCH]:    { name: 'Birch',     wood: 5, burn: 0.35 },
};
// Which tree a given terrain naturally grows.
EP.treeFor = function (t, rnd) {
    switch (t) {
        case T.GRASS: return rnd < 0.7 ? TR.OAK : rnd < 0.9 ? TR.BIRCH : TR.BUSH;
        case T.SAVANNA: return rnd < 0.7 ? TR.BUSH : TR.PALM;
        case T.DESERT: return TR.CACTUS;
        case T.SAND: return TR.PALM;
        case T.SWAMP: return TR.WILLOW;
        case T.SNOW: return TR.SNOWPINE;
        case T.HILLS: return TR.PINE;
        case T.SOIL: return TR.BUSH;
        default: return TR.NONE;
    }
};

// ---------------------------------------------------------------- Species
// speed: tiles per tick. kind: civ | animal | aquatic | monster.
EP.SPECIES = {
    human: { name: 'Human', plural: 'Humans', kind: 'civ', hp: 60, atk: 8, speed: 0.062, life: [60, 85], adult: 5, aggression: 0.35, fertility: 1.0, skin: ['#f1c27d', '#e0ac69', '#c68642', '#8d5524'], hair: ['#2b1b0e', '#5a3825', '#a0522d', '#d9b26f', '#1c1c1c'], desc: 'Adaptable builders who spread quickly across fertile land.' },
    elf:   { name: 'Elf', plural: 'Elves', kind: 'civ', hp: 50, atk: 7, speed: 0.07, life: [220, 380], adult: 9, aggression: 0.15, fertility: 0.6, ranged: 5, skin: ['#f6dcc0', '#eacba8'], hair: ['#f2e6a0', '#e8e8e8', '#c7a14a', '#9fcf7a'], desc: 'Long-lived forest archers. Slow to grow, deadly at range.' },
    dwarf: { name: 'Dwarf', plural: 'Dwarves', kind: 'civ', hp: 85, atk: 9, speed: 0.052, life: [130, 210], adult: 7, aggression: 0.3, fertility: 0.75, miner: true, skin: ['#e9b48a', '#d49a6a'], hair: ['#b5541c', '#7a3b12', '#d4a03a', '#9a9a9a'], desc: 'Stout miners who thrive in hills and hoard stone and gold.' },
    orc:   { name: 'Orc', plural: 'Orcs', kind: 'civ', hp: 75, atk: 11, speed: 0.065, life: [40, 60], adult: 4, aggression: 0.75, fertility: 1.25, skin: ['#6f9a3c', '#5e8a33', '#7fa84a'], hair: ['#1c1c1c', '#2f2a20'], desc: 'Fierce, fast-breeding raiders who love a good war.' },
    deer:   { name: 'Deer', plural: 'Deer', kind: 'animal', diet: 'herb', hp: 30, atk: 2, speed: 0.07, life: [14, 20], adult: 2, herd: true, fertility: 0.9, cap: 0.008, food: 14, desc: 'Graceful grazers. Wolves love them.' },
    sheep:  { name: 'Sheep', plural: 'Sheep', kind: 'animal', diet: 'herb', hp: 25, atk: 1, speed: 0.045, life: [10, 14], adult: 1, herd: true, fertility: 1.0, cap: 0.007, food: 12, desc: 'Fluffy, slow and delicious.' },
    rabbit: { name: 'Rabbit', plural: 'Rabbits', kind: 'animal', diet: 'herb', hp: 10, atk: 1, speed: 0.085, life: [5, 8], adult: 1, fertility: 1.6, cap: 0.008, food: 5, desc: 'Breeds like... well, rabbits.' },
    wolf:   { name: 'Wolf', plural: 'Wolves', kind: 'animal', diet: 'carn', hp: 45, atk: 8, speed: 0.08, life: [12, 16], adult: 2, herd: true, fertility: 0.55, cap: 0.004, prey: ['deer', 'sheep', 'rabbit'], desc: 'Pack hunters. Will attack lone villagers when starving.' },
    bear:   { name: 'Bear', plural: 'Bears', kind: 'animal', diet: 'carn', hp: 110, atk: 14, speed: 0.058, life: [20, 30], adult: 3, fertility: 0.35, cap: 0.002, prey: ['deer', 'sheep', 'rabbit', 'fish'], desc: 'Solitary, powerful and grumpy.' },
    fish:   { name: 'Fish', plural: 'Fish', kind: 'aquatic', hp: 6, atk: 0, speed: 0.05, life: [5, 9], adult: 1, fertility: 1.2, cap: 0.006, food: 4, desc: 'Peaceful swimmers. Food for fishermen and bears.' },
    zombie: { name: 'Zombie', plural: 'Zombies', kind: 'monster', hp: 55, atk: 7, speed: 0.042, life: [18, 26], adult: 0, infect: 0.55, desc: 'Shambling undead. Victims may rise again.' },
    dragon: { name: 'Dragon', plural: 'Dragons', kind: 'monster', hp: 900, atk: 30, speed: 0.09, life: [400, 600], adult: 0, fly: true, ranged: 7, desc: 'An ancient wyrm that rains fire from the sky.' },
};
EP.CIV_RACES = ['human', 'elf', 'dwarf', 'orc'];

// ---------------------------------------------------------------- Traits
EP.TRAITS = {
    strong:   { name: 'Strong',    atk: 1.25, good: true },
    tough:    { name: 'Tough',     hp: 1.3, good: true },
    swift:    { name: 'Swift',     speed: 1.2, good: true },
    wise:     { name: 'Wise',      tech: 2, good: true },
    brave:    { name: 'Brave',     atk: 1.1, good: true },
    coward:   { name: 'Coward',    atk: 0.8, good: false },
    weak:     { name: 'Frail',     hp: 0.75, good: false },
    longlife: { name: 'Long-lived', life: 1.4, good: true },
    fertile:  { name: 'Fertile',   good: true },
    giant:    { name: 'Giant',     hp: 1.8, atk: 1.6, speed: 0.85, good: true, rare: true },
    blessed:  { name: 'Blessed',   atk: 1.2, hp: 1.2, good: true, divine: true },
};
EP.RANDOM_TRAITS = ['strong', 'tough', 'swift', 'wise', 'brave', 'coward', 'weak', 'longlife', 'fertile'];

// ---------------------------------------------------------------- Ages
EP.AGES = [
    { name: 'Stone Age',  tech: 0,    atk: 1.0, hp: 1.0,  weapon: '#8b6a45' },
    { name: 'Bronze Age', tech: 260,  atk: 1.15, hp: 1.1, weapon: '#c98a3b' },
    { name: 'Iron Age',   tech: 800,  atk: 1.3, hp: 1.2,  weapon: '#9aa3ab' },
    { name: 'Steel Age',  tech: 1900, atk: 1.5, hp: 1.35, weapon: '#d9e1e8' },
    { name: 'Golden Age', tech: 4200, atk: 1.75, hp: 1.5, weapon: '#ffd34d' },
];

// ---------------------------------------------------------------- Buildings
EP.BUILDINGS = {
    hall:     { name: 'Town Hall', w: 3, h: 3, hp: 700, cost: {}, housing: 6, time: 200, desc: 'Heart of every settlement. Lose it and the town falls.' },
    house:    { name: 'House', w: 2, h: 2, hp: 160, cost: { wood: 12 }, housing: 4, time: 120 },
    farm:     { name: 'Farm', w: 3, h: 3, hp: 1, cost: { wood: 4 }, time: 70, field: true },
    temple:   { name: 'Temple', w: 2, h: 2, hp: 300, cost: { wood: 30, stone: 12 }, minAge: 1, time: 240, desc: 'Speeds research and heals the faithful.' },
    tower:    { name: 'Watchtower', w: 1, h: 1, hp: 280, cost: { wood: 15, stone: 10 }, minAge: 1, time: 150, range: 6.5, desc: 'Shoots arrows at invaders and beasts.' },
    barracks: { name: 'Barracks', w: 3, h: 2, hp: 380, cost: { wood: 40, stone: 18 }, minAge: 2, time: 260, desc: 'Trains a larger standing army.' },
    mine:     { name: 'Mine', w: 2, h: 2, hp: 220, cost: { wood: 18 }, time: 160, desc: 'Extracts stone and gold from nearby hills.' },
};

// ---------------------------------------------------------------- Names
EP.KINGDOM_NAMES = {
    human: [['New', 'Old', 'Great', 'United', 'Eastern', 'Western', 'Northern', 'Southern', 'Holy', 'Royal'],
            ['york', 'haven', 'spring', 'ford', 'castle', 'keep', 'warren', 'shire', 'field', 'mount'],
            ['', ' Kingdom', ' Empire', ' Realm', ' Domain', ' March']],
    elf:   [['Silver', 'Golden', 'Eternal', 'Ancient', 'Mystic', 'Twilight', 'Moonlit', 'Crystal', 'Starlight', 'Verdant'],
            ['wood', 'vale', 'glade', 'haven', 'realm', 'throne', 'crown', 'light', 'star', 'mist'],
            ['', ' of the Woods', ' of Stars', ' Eternal', ' Court']],
    dwarf: [['Iron', 'Stone', 'Deep', 'Grand', 'Mighty', 'Ancient', 'High', 'Low', 'Copper', 'Granite'],
            ['hold', 'forge', 'hall', 'deep', 'stone', 'gate', 'breach', 'horn', 'rock', 'guard'],
            ['', ' Kingdom', ' Stronghold', ' Citadel', ' Clans']],
    orc:   [['Dark', 'War', 'Wild', 'Savage', 'Storm', 'Blood', 'Fire', 'Tusk', 'Claw', 'Bone'],
            ['hold', 'tribe', 'clan', 'horde', 'peak', 'ridge', 'skull', 'tooth', 'fang', 'maw'],
            ['', ' Horde', ' Tribe', ' Clan', ' Dominion']],
};
EP.UNIT_NAMES = {
    human: [['Al', 'Bran', 'Cor', 'Ed', 'Gar', 'Hal', 'Jon', 'Mar', 'Ro', 'Wil', 'Ann', 'Bea', 'Cla', 'El', 'Ma', 'Ro'], ['ric', 'den', 'win', 'mund', 'ard', 'ton', 'ah', 'ina', 'ella', 'wen', 'bert', 'ie']],
    elf:   [['Ae', 'Cael', 'Ela', 'Fae', 'Gal', 'Ith', 'Lae', 'Mir', 'Syl', 'Thal', 'Yl'], ['lindor', 'riel', 'wen', 'dril', 'thas', 'anor', 'ion', 'iel', 'ara', 'enna']],
    dwarf: [['Bor', 'Dur', 'Gim', 'Thor', 'Bal', 'Dwa', 'Grun', 'Kil', 'Mor', 'Thra'], ['in', 'li', 'grim', 'dain', 'rak', 'nar', 'dok', 'gar', 'unn', 'bek']],
    orc:   [['Gr', 'Mag', 'Ur', 'Az', 'Bol', 'Gor', 'Kru', 'Nar', 'Sha', 'Zug'], ['ash', 'gul', 'mok', 'nak', 'rog', 'thak', 'uk', 'zog', 'bash', 'grim']],
};
EP.CITY_SUFFIX = {
    human: ['ton', 'bury', 'ford', 'ham', 'wick', 'stead', 'field', 'port', 'gate', 'by'],
    elf: ['dell', 'lorien', 'wyn', 'thil', 'aris', 'enor', 'ias', 'ath'],
    dwarf: ['heim', 'dun', 'karak', 'grad', 'hold', 'rock', 'delve'],
    orc: ['gash', 'mog', 'durz', 'krag', 'thul', 'gor', 'ruk'],
};
EP.KINGDOM_COLORS = ['#e6492e', '#2e86e6', '#f2c12e', '#9b4de0', '#2ec27e', '#ff7f2a', '#e64598', '#26c6da', '#8bc34a',
    '#b0702b', '#ffffff', '#5c6bc0', '#d4e157', '#ec407a', '#00897b', '#ff5252', '#7e57c2', '#ffa726', '#29b6f6', '#c0ca33'];

// ---------------------------------------------------------------- Tools
// type: inspect | brush | spawn | power. repeat: ms between applications while held (0 = once per click).
EP.TOOL_CATEGORIES = [
    { id: 'terrain', name: 'Shape', icon: 'cat_terrain' },
    { id: 'life', name: 'Life', icon: 'cat_life' },
    { id: 'nature', name: 'Nature', icon: 'cat_nature' },
    { id: 'destroy', name: 'Wrath', icon: 'cat_destroy' },
    { id: 'realm', name: 'Realms', icon: 'cat_realm' },
];
const tool = (cat, id, name, type, extra) => Object.assign({ cat, id, name, type, icon: id, repeat: 60, sized: type === 'brush' }, extra);
EP.TOOLS = [
    tool('terrain', 'raise', 'Raise', 'brush', { desc: 'Lift the ground. Hold to build hills and mountains.', repeat: 40 }),
    tool('terrain', 'lower', 'Lower', 'brush', { desc: 'Sink the ground. Hold to carve lakes and seas.', repeat: 40 }),
    tool('terrain', 'deep', 'Ocean', 'brush', { desc: 'Paint deep ocean.', terrain: T.DEEP }),
    tool('terrain', 'shallow', 'Shallows', 'brush', { desc: 'Paint wadeable shallow water and rivers.', terrain: T.SHALLOW }),
    tool('terrain', 'sand', 'Sand', 'brush', { desc: 'Paint beaches and dunes.', terrain: T.SAND }),
    tool('terrain', 'grass', 'Grassland', 'brush', { desc: 'Fertile land where towns and forests flourish.', terrain: T.GRASS }),
    tool('terrain', 'savanna', 'Savanna', 'brush', { desc: 'Warm dry grassland.', terrain: T.SAVANNA }),
    tool('terrain', 'desert', 'Desert', 'brush', { desc: 'Barren dunes. Nothing grazes here.', terrain: T.DESERT }),
    tool('terrain', 'swamp', 'Swamp', 'brush', { desc: 'Boggy, slow ground with willows.', terrain: T.SWAMP }),
    tool('terrain', 'snow', 'Tundra', 'brush', { desc: 'Frozen land with hardy firs.', terrain: T.SNOW }),
    tool('terrain', 'hills', 'Hills', 'brush', { desc: 'Rolling hills. Dwarves love them; mines need them.', terrain: T.HILLS }),
    tool('terrain', 'mountain', 'Mountain', 'brush', { desc: 'Impassable peaks.', terrain: T.MOUNTAIN }),
    tool('terrain', 'forest', 'Plant Trees', 'brush', { desc: 'Grow trees suited to the land beneath.' }),
    tool('terrain', 'erase', 'Clear', 'brush', { desc: 'Remove trees, fire and structures.' }),

    ...EP.CIV_RACES.map(r => tool('life', r, EP.SPECIES[r].plural, 'spawn', { desc: EP.SPECIES[r].desc, species: r, repeat: 120, sized: false })),
    ...['deer', 'sheep', 'rabbit', 'wolf', 'bear', 'fish', 'zombie', 'dragon'].map(s =>
        tool('life', s, EP.SPECIES[s].plural, 'spawn', { desc: EP.SPECIES[s].desc, species: s, repeat: s === 'dragon' ? 0 : 120, sized: false })),

    tool('nature', 'bless', 'Blessing', 'power', { desc: 'Heal creatures and grant them divine strength.', repeat: 150, sized: true }),
    tool('nature', 'rain', 'Rain Cloud', 'power', { desc: 'Summon rain: douses fires, cools lava, greens the land.', repeat: 500 }),
    tool('nature', 'bloom', 'Bloom', 'power', { desc: 'Restore scorched land and sprout new forests.', repeat: 100, sized: true }),
    tool('nature', 'heal', 'Cure', 'power', { desc: 'Cure plague and undeath in an area.', repeat: 150, sized: true }),

    tool('destroy', 'lightning', 'Lightning', 'power', { desc: 'Smite the land with a bolt from the heavens.', repeat: 180 }),
    tool('destroy', 'fire', 'Fire', 'power', { desc: 'Set the world ablaze. Spreads through forests.', repeat: 60, sized: true }),
    tool('destroy', 'meteor', 'Meteor', 'power', { desc: 'Call down a burning rock from the sky.', repeat: 450 }),
    tool('destroy', 'quake', 'Earthquake', 'power', { desc: 'Shake the earth, toppling buildings and cracking the ground.', repeat: 0 }),
    tool('destroy', 'tornado', 'Tornado', 'power', { desc: 'A roaming twister that flings everything aside.', repeat: 0 }),
    tool('destroy', 'volcano', 'Volcano', 'power', { desc: 'Raise an erupting volcano.', repeat: 0 }),
    tool('destroy', 'plague', 'Plague', 'power', { desc: 'A contagious sickness that spreads between creatures.', repeat: 200, sized: true }),
    tool('destroy', 'curse', 'Undeath', 'power', { desc: 'Raise the living as zombies.', repeat: 200, sized: true }),
    tool('destroy', 'nuke', 'Cataclysm', 'power', { desc: 'An apocalyptic blast that leaves only ash.', repeat: 0 }),

    tool('realm', 'inspect', 'Inspect', 'inspect', { desc: 'Click a creature, building or realm to learn about it. Drag to pan.', repeat: 0 }),
    tool('realm', 'discord', 'Discord', 'power', { desc: 'Sow hatred between realms in the area. War follows.', repeat: 0 }),
    tool('realm', 'harmony', 'Harmony', 'power', { desc: 'Force peace upon warring realms in the area.', repeat: 0 }),
    tool('realm', 'rebel', 'Rebellion', 'power', { desc: 'Incite a town to break away and form its own realm.', repeat: 0 }),
    tool('realm', 'prosper', 'Prosperity', 'power', { desc: 'Shower a realm with food, wood, stone and knowledge.', repeat: 300 }),
];
EP.TOOL_BY_ID = Object.fromEntries(EP.TOOLS.map(t => [t.id, t]));

// ---------------------------------------------------------------- World settings
EP.WORLD_SIZES = {
    small:  { w: 160, h: 100, label: 'Small' },
    medium: { w: 240, h: 150, label: 'Medium' },
    large:  { w: 320, h: 200, label: 'Large' },
    huge:   { w: 440, h: 275, label: 'Huge' },
};
EP.WORLD_SHAPES = {
    continent:   { label: 'Continents' },
    pangaea:     { label: 'Pangaea' },
    archipelago: { label: 'Archipelago' },
    lakes:       { label: 'Lakeland' },
};
})();
