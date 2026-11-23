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
    HILLS: 8, MOUNTAIN: 9, LAVA: 10, ASH: 11, FARM: 12, ROAD: 13, ROCK: 14, SOIL: 15, PAVED: 16, BRIDGE: 17,
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
def(T.PAVED,    { name: 'Paved road',   colors: ['#b5aea2', '#a39c90', '#8f897e', '#77726a'], build: false, slow: 1.4 });
def(T.BRIDGE,   { name: 'Bridge',       colors: ['#b0864f', '#9a7444', '#7f5e36', '#5f4527'], build: false, slow: 1.2, burn: 0.01 });

EP.isWaterT = t => t === T.DEEP || t === T.SHALLOW;
EP.isRoadT = t => t === T.ROAD || t === T.PAVED || t === T.BRIDGE;

// ---------------------------------------------------------------- Ores
// Veins sit in hills, mountains and basalt. amt: units per vein; yield: resource per mining trip.
// value: how keen miners are on it. density: clusters per 1000 rocky tiles. rock: any | high (mostly mountains) | mountain.
const O = EP.ORE = { NONE: 0, COPPER: 1, IRON: 2, COAL: 3, GOLD: 4, GEMS: 5, MITHRIL: 6, ADAMANTINE: 7 };
EP.ORE_INFO = {
    [O.COPPER]:     { id: 'copper', name: 'Copper', res: 'copper', color: '#e0823c', hi: '#ffc08a', dk: '#8a4a1f', amt: [10, 18], yield: 2, value: 1.2, density: 6, size: [4, 9], rock: 'any' },
    [O.IRON]:       { id: 'iron', name: 'Iron', res: 'iron', color: '#b8735a', hi: '#e6b8a0', dk: '#5e3a2e', amt: [10, 18], yield: 2, value: 1.6, density: 5, size: [4, 8], rock: 'any' },
    [O.COAL]:       { id: 'coal', name: 'Coal', res: 'coal', color: '#2b2a30', hi: '#6a6a78', dk: '#121216', amt: [12, 20], yield: 3, value: 1.1, density: 6, size: [4, 9], rock: 'any' },
    [O.GOLD]:       { id: 'gold', name: 'Gold', res: 'gold', color: '#ffcf3a', hi: '#fff4b0', dk: '#a87a10', amt: [6, 12], yield: 3, value: 2.4, density: 2.5, size: [3, 6], rock: 'high' },
    [O.GEMS]:       { id: 'gems', name: 'Gems', res: 'gems', color: '#ff4f8b', hi: '#ffd0e2', dk: '#8a1a45', amt: [4, 9], yield: 1, value: 2.6, density: 1.5, size: [2, 4], rock: 'high' },
    [O.MITHRIL]:    { id: 'mithril', name: 'Mithril', res: 'mithril', color: '#7fe3ff', hi: '#e6fbff', dk: '#2a7fa8', amt: [4, 8], yield: 1, value: 3.2, density: 0.9, size: [2, 4], rock: 'mountain' },
    [O.ADAMANTINE]: { id: 'adamantine', name: 'Adamantine', res: 'adamantine', color: '#b36bff', hi: '#ecd6ff', dk: '#5a2a99', amt: [3, 6], yield: 1, value: 4, density: 0.4, size: [1, 3], rock: 'mountain' },
};
EP.ORE_BY_ID = Object.fromEntries(Object.entries(EP.ORE_INFO).map(([k, v]) => [v.id, +k]));
EP.canHoldOre = t => t === T.HILLS || t === T.MOUNTAIN || t === T.ROCK || t === T.SNOW;
// Every stockpiled resource a realm can hold.
EP.RESOURCES = ['food', 'wood', 'stone', 'gold', 'copper', 'iron', 'coal', 'gems', 'mithril', 'adamantine'];
EP.RES_INFO = {
    food: { name: 'Food', color: '#c9e05a' }, wood: { name: 'Wood', color: '#a8763e' }, stone: { name: 'Stone', color: '#a39e96' },
    gold: { name: 'Gold', color: '#ffd34d' }, copper: { name: 'Copper', color: '#e0823c' }, iron: { name: 'Iron', color: '#c08a76' },
    coal: { name: 'Coal', color: '#8a8a98' }, gems: { name: 'Gems', color: '#ff4f8b' }, mithril: { name: 'Mithril', color: '#7fe3ff' },
    adamantine: { name: 'Adamantine', color: '#b36bff' },
};

// ---------------------------------------------------------------- Equipment
// Forged at a smithy from ore. Tier 0 is the crude kit everyone starts with.
// atk multiplies attack; def is the fraction of damage armour absorbs.
EP.GEAR = [
    { id: 'crude', name: 'Crude', atk: 1, def: 0, color: '#8b6a45', age: 0, cost: {} },
    { id: 'copper', name: 'Copper', atk: 1.15, def: 0.1, color: '#e0823c', age: 1, cost: { copper: 3 } },
    { id: 'iron', name: 'Iron', atk: 1.3, def: 0.18, color: '#a9b1b8', age: 2, cost: { iron: 3 } },
    { id: 'steel', name: 'Steel', atk: 1.5, def: 0.28, color: '#e4ecf2', age: 3, cost: { iron: 3, coal: 2 } },
    { id: 'mithril', name: 'Mithril', atk: 1.75, def: 0.4, color: '#7fe3ff', age: 3, cost: { mithril: 2, coal: 1 } },
    { id: 'adamantine', name: 'Adamantine', atk: 2, def: 0.52, color: '#b36bff', age: 4, cost: { adamantine: 2, coal: 1 } },
];
EP.WEAPON_NAME = { human: 'sword', elf: 'bow', dwarf: 'axe', orc: 'cleaver' };

// ---------------------------------------------------------------- Realm ranks
// A realm's title grows with its towns and people; rulers take grander titles.
EP.RANKS = [
    { name: 'Tribe', towns: 1, pop: 0 },
    { name: 'Chiefdom', towns: 1, pop: 25 },
    { name: 'Kingdom', towns: 2, pop: 45 },
    { name: 'Empire', towns: 5, pop: 160 },
];
EP.RULER_TITLE = {
    human: ['Chief', 'Lord', 'King', 'Emperor'], elf: ['Elder', 'Lord', 'High King', 'Eternal Monarch'],
    dwarf: ['Thane', 'Lord', 'King', 'High King'], orc: ['Warboss', 'Chieftain', 'Overlord', 'Warlord Supreme'],
};

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
// habitat: terrains where the species is seeded and migrates back to.
// amphibious: walks on land and wades through shallow water. forage: minimum food value of any ground (hardy grazers).
// venom: bites make the victim sick. pollinate: plants shrubs and greens scorched ground. fireproof: ignores fire & lava.
// blood: colour of hit particles (null = none). projectile/cd: ranged attack type and cooldown. lift: hover height (fliers).
EP.SPECIES = {
    human: { name: 'Human', plural: 'Humans', kind: 'civ', hp: 60, atk: 8, speed: 0.062, life: [60, 85], adult: 5, aggression: 0.35, fertility: 1.0, skin: ['#f1c27d', '#e0ac69', '#c68642', '#8d5524'], hair: ['#2b1b0e', '#5a3825', '#a0522d', '#d9b26f', '#1c1c1c'], desc: 'Adaptable builders who spread quickly across fertile land.' },
    elf:   { name: 'Elf', plural: 'Elves', kind: 'civ', hp: 50, atk: 7, speed: 0.07, life: [220, 380], adult: 9, aggression: 0.15, fertility: 0.6, ranged: 5, skin: ['#f6dcc0', '#eacba8'], hair: ['#f2e6a0', '#e8e8e8', '#c7a14a', '#9fcf7a'], desc: 'Long-lived forest archers. Slow to grow, deadly at range.' },
    dwarf: { name: 'Dwarf', plural: 'Dwarves', kind: 'civ', hp: 85, atk: 9, speed: 0.052, life: [130, 210], adult: 7, aggression: 0.3, fertility: 0.75, miner: true, skin: ['#e9b48a', '#d49a6a'], hair: ['#b5541c', '#7a3b12', '#d4a03a', '#9a9a9a'], desc: 'Stout miners who thrive in hills and hoard stone and gold.' },
    orc:   { name: 'Orc', plural: 'Orcs', kind: 'civ', hp: 75, atk: 11, speed: 0.065, life: [40, 60], adult: 4, aggression: 0.75, fertility: 1.25, skin: ['#6f9a3c', '#5e8a33', '#7fa84a'], hair: ['#1c1c1c', '#2f2a20'], desc: 'Fierce, fast-breeding raiders who love a good war.' },

    // Grazers
    deer:    { name: 'Deer', plural: 'Deer', kind: 'animal', diet: 'herb', hp: 30, atk: 2, speed: 0.07, life: [14, 20], adult: 2, herd: true, fertility: 0.9, cap: 0.006, food: 14, habitat: [T.GRASS, T.HILLS], desc: 'Graceful grazers. Wolves love them.' },
    sheep:   { name: 'Sheep', plural: 'Sheep', kind: 'animal', diet: 'herb', hp: 25, atk: 1, speed: 0.045, life: [10, 14], adult: 1, herd: true, fertility: 1.0, cap: 0.005, food: 12, habitat: [T.GRASS, T.SAVANNA], desc: 'Fluffy, slow and delicious.' },
    rabbit:  { name: 'Rabbit', plural: 'Rabbits', kind: 'animal', diet: 'herb', hp: 10, atk: 1, speed: 0.085, life: [5, 8], adult: 1, fertility: 1.6, cap: 0.006, food: 5, solo: true, habitat: [T.GRASS, T.SAVANNA, T.SNOW], desc: 'Breeds like... well, rabbits.' },
    chicken: { name: 'Chicken', plural: 'Chickens', kind: 'animal', diet: 'herb', hp: 8, atk: 1, speed: 0.05, life: [5, 9], adult: 1, fertility: 2.0, cap: 0.004, food: 5, solo: true, habitat: [T.GRASS, T.SAVANNA], desc: 'Clucks about pecking at seeds. Easy prey for foxes.' },
    cow:     { name: 'Cow', plural: 'Cows', kind: 'animal', diet: 'herb', hp: 45, atk: 3, speed: 0.04, life: [14, 20], adult: 2, herd: true, fertility: 0.7, cap: 0.004, food: 20, habitat: [T.GRASS], desc: 'Big, calm and a feast for a whole village.' },
    buffalo: { name: 'Buffalo', plural: 'Buffalo', kind: 'animal', diet: 'herb', hp: 95, atk: 9, speed: 0.05, life: [16, 24], adult: 2, herd: true, fertility: 0.55, cap: 0.003, food: 24, habitat: [T.SAVANNA], desc: 'Savanna herds that stampede at anything that threatens them.' },
    camel:   { name: 'Camel', plural: 'Camels', kind: 'animal', diet: 'herb', hp: 55, atk: 4, speed: 0.05, life: [20, 30], adult: 2, fertility: 0.5, cap: 0.002, food: 16, forage: 0.45, habitat: [T.DESERT], desc: 'Hardy desert wanderers that live where nothing else grows.' },
    penguin: { name: 'Penguin', plural: 'Penguins', kind: 'animal', diet: 'herb', hp: 16, atk: 2, speed: 0.04, life: [10, 16], adult: 1, herd: true, fertility: 0.9, cap: 0.003, food: 6, forage: 0.6, amphibious: true, habitat: [T.SNOW], desc: 'Waddling tundra birds that happily swim the cold shallows.' },
    monkey:  { name: 'Monkey', plural: 'Monkeys', kind: 'animal', diet: 'herb', hp: 18, atk: 3, speed: 0.075, life: [12, 20], adult: 2, herd: true, fertility: 0.9, cap: 0.003, food: 6, habitat: [T.SWAMP, T.SAVANNA], desc: 'Noisy tree-dwellers. They live where the jungle is thick.' },
    frog:    { name: 'Frog', plural: 'Frogs', kind: 'animal', diet: 'herb', hp: 5, atk: 0, speed: 0.06, life: [3, 6], adult: 1, fertility: 2.6, cap: 0.004, food: 2, solo: true, forage: 0.6, amphibious: true, habitat: [T.SWAMP, T.GRASS], desc: 'Croaks in the bog. Crocodile snack.' },
    turtle:  { name: 'Turtle', plural: 'Turtles', kind: 'animal', diet: 'herb', hp: 60, atk: 2, speed: 0.025, life: [80, 140], adult: 5, fertility: 0.5, cap: 0.002, food: 10, forage: 0.5, amphibious: true, habitat: [T.SAND], desc: 'Slow, tough and ancient. Lives for a century.' },
    crab:    { name: 'Crab', plural: 'Crabs', kind: 'animal', diet: 'herb', hp: 12, atk: 3, speed: 0.045, life: [6, 10], adult: 1, fertility: 1.2, cap: 0.003, food: 4, forage: 0.6, amphibious: true, habitat: [T.SAND], desc: 'Scuttles sideways along every beach.' },
    bee:     { name: 'Bee', plural: 'Bees', kind: 'animal', diet: 'herb', hp: 3, atk: 1, speed: 0.07, life: [4, 7], adult: 0, fertility: 2.5, cap: 0.003, forage: 1, fly: true, lift: 5, pollinate: true, solo: true, blood: '#ffe066', habitat: [T.GRASS, T.SAVANNA], desc: 'Buzzes from flower to flower, planting shrubs and healing burnt land.' },

    // Predators
    fox:     { name: 'Fox', plural: 'Foxes', kind: 'animal', diet: 'carn', hp: 28, atk: 6, speed: 0.08, life: [8, 12], adult: 1, fertility: 0.7, cap: 0.002, prey: ['rabbit', 'chicken', 'frog', 'crab'], habitat: [T.GRASS, T.SNOW], desc: 'Sly hunters of rabbits and chickens.' },
    wolf:    { name: 'Wolf', plural: 'Wolves', kind: 'animal', diet: 'carn', hp: 45, atk: 8, speed: 0.08, life: [12, 16], adult: 2, herd: true, fertility: 0.55, cap: 0.003, prey: ['deer', 'sheep', 'rabbit', 'chicken', 'cow'], habitat: [T.GRASS, T.SNOW, T.HILLS], desc: 'Pack hunters. Will attack lone villagers when starving.' },
    hyena:   { name: 'Hyena', plural: 'Hyenas', kind: 'animal', diet: 'carn', hp: 38, atk: 7, speed: 0.078, life: [10, 14], adult: 2, herd: true, fertility: 0.6, cap: 0.002, prey: ['buffalo', 'camel', 'monkey', 'sheep', 'rabbit', 'chicken'], habitat: [T.SAVANNA, T.DESERT], desc: 'Cackling savanna scavengers that hunt in packs.' },
    bear:    { name: 'Bear', plural: 'Bears', kind: 'animal', diet: 'carn', hp: 110, atk: 14, speed: 0.058, life: [20, 30], adult: 3, fertility: 0.35, cap: 0.0015, prey: ['deer', 'sheep', 'rabbit', 'fish', 'cow', 'penguin'], habitat: [T.HILLS, T.SNOW, T.GRASS], desc: 'Solitary, powerful and grumpy.' },
    crocodile: { name: 'Crocodile', plural: 'Crocodiles', kind: 'animal', diet: 'carn', hp: 130, atk: 15, speed: 0.045, life: [40, 70], adult: 3, fertility: 0.35, cap: 0.0015, amphibious: true, prey: ['frog', 'deer', 'monkey', 'fish', 'turtle', 'sheep', 'cow'], habitat: [T.SWAMP, T.SHALLOW], desc: 'Lurks in swamps and shallows. Snaps at anything that wades in.' },
    snake:   { name: 'Snake', plural: 'Snakes', kind: 'animal', diet: 'carn', hp: 16, atk: 4, speed: 0.05, life: [8, 14], adult: 1, fertility: 0.8, cap: 0.002, venom: true, prey: ['rabbit', 'frog', 'chicken'], habitat: [T.DESERT, T.SWAMP], desc: 'Venomous. Its bite leaves victims sick and weak.' },

    // Water
    fish:    { name: 'Fish', plural: 'Fish', kind: 'aquatic', hp: 6, atk: 0, speed: 0.05, life: [5, 9], adult: 1, fertility: 1.2, cap: 0.006, food: 4, habitat: [T.DEEP, T.SHALLOW], desc: 'Peaceful swimmers. Food for fishermen and bears.' },
    shark:   { name: 'Shark', plural: 'Sharks', kind: 'aquatic', diet: 'carn', hp: 90, atk: 16, speed: 0.07, life: [25, 40], adult: 2, fertility: 0.3, cap: 0.0012, food: 14, prey: ['fish', 'turtle', 'penguin', 'crocodile', 'crab'], habitat: [T.DEEP], desc: 'Prowls the deep. Anything swimming is fair game.' },

    // Monsters
    zombie:   { name: 'Zombie', plural: 'Zombies', kind: 'monster', hp: 55, atk: 7, speed: 0.042, life: [18, 26], adult: 0, infect: 0.55, blood: '#6b8f3a', desc: 'Shambling undead. Victims may rise again.' },
    skeleton: { name: 'Skeleton', plural: 'Skeletons', kind: 'monster', hp: 40, atk: 9, speed: 0.06, life: [30, 50], adult: 0, blood: '#e8e4d4', smash: true, desc: 'Rattling bones that hunt the living and smash their homes.' },
    demon:    { name: 'Demon', plural: 'Demons', kind: 'monster', hp: 180, atk: 14, speed: 0.055, life: [60, 90], adult: 0, fireproof: true, ranged: 4.5, projectile: 'fireball', cd: 70, blood: '#ff8a1f', smash: true, desc: 'Climbs out of lava. Sets the ground alight wherever it walks.' },
    icegolem: { name: 'Ice Golem', plural: 'Ice Golems', kind: 'monster', hp: 320, atk: 18, speed: 0.035, life: [60, 100], adult: 0, frost: true, melt: true, blood: '#bfe8ff', smash: true, desc: 'A walking glacier. Freezes creatures and turns the land to tundra.' },
    dragon:   { name: 'Dragon', plural: 'Dragons', kind: 'monster', hp: 900, atk: 30, speed: 0.09, life: [400, 600], adult: 0, fly: true, ranged: 7, projectile: 'fireball', cd: 55, blood: null, desc: 'An ancient wyrm that rains fire from the sky.' },
    ufo:      { name: 'UFO', plural: 'UFOs', kind: 'monster', hp: 300, atk: 12, speed: 0.08, life: [80, 120], adult: 0, fly: true, lift: 16, ranged: 6, projectile: 'laser', cd: 40, blood: '#9fe8ff', desc: 'Visitors from beyond. They zap buildings and abduct whoever they fancy.' },
};
EP.CIV_RACES = ['human', 'elf', 'dwarf', 'orc'];
EP.ANIMALS = ['deer', 'sheep', 'rabbit', 'chicken', 'cow', 'buffalo', 'camel', 'penguin', 'monkey', 'frog', 'turtle', 'crab', 'bee',
    'fox', 'wolf', 'hyena', 'bear', 'crocodile', 'snake', 'fish', 'shark'];
EP.MONSTERS = ['zombie', 'skeleton', 'demon', 'icegolem', 'dragon', 'ufo'];
EP.WILD = Object.keys(EP.SPECIES).filter(s => EP.SPECIES[s].habitat);

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
    mad:      { name: 'Mad',       atk: 1.25, speed: 1.15, good: false, divine: true },
};
EP.RANDOM_TRAITS = ['strong', 'tough', 'swift', 'wise', 'brave', 'coward', 'weak', 'longlife', 'fertile'];

// ---------------------------------------------------------------- Ages
EP.AGES = [
    // Weapons & armour forged from ore (EP.GEAR) now carry most of a realm's military edge.
    { name: 'Stone Age',  tech: 0,    atk: 1.0,  hp: 1.0  },
    { name: 'Bronze Age', tech: 260,  atk: 1.05, hp: 1.05 },
    { name: 'Iron Age',   tech: 800,  atk: 1.1,  hp: 1.1  },
    { name: 'Steel Age',  tech: 1900, atk: 1.15, hp: 1.15 },
    { name: 'Golden Age', tech: 4200, atk: 1.2,  hp: 1.2  },
];

// ---------------------------------------------------------------- Buildings
EP.BUILDINGS = {
    hall:     { name: 'Town Hall', w: 3, h: 3, hp: 700, cost: {}, housing: 6, time: 200, desc: 'Heart of every settlement. Lose it and the town falls.' },
    house:    { name: 'House', w: 2, h: 2, hp: 160, cost: { wood: 12 }, housing: 4, time: 120 },
    farm:     { name: 'Farm', w: 3, h: 3, hp: 1, cost: { wood: 4 }, time: 70, field: true },
    temple:   { name: 'Temple', w: 2, h: 2, hp: 300, cost: { wood: 30, stone: 12 }, minAge: 1, time: 240, desc: 'Speeds research and heals the faithful.' },
    tower:    { name: 'Watchtower', w: 1, h: 1, hp: 280, cost: { wood: 15, stone: 10 }, minAge: 1, time: 150, range: 6.5, desc: 'Shoots arrows at invaders and beasts.' },
    barracks: { name: 'Barracks', w: 3, h: 2, hp: 380, cost: { wood: 40, stone: 18 }, minAge: 2, time: 260, desc: 'Trains a larger standing army.' },
    mine:     { name: 'Mine', w: 2, h: 2, hp: 220, cost: { wood: 18 }, time: 160, desc: 'Miners working near it dig out more stone and ore.' },
    granary:  { name: 'Granary', w: 2, h: 2, hp: 200, cost: { wood: 20 }, time: 130, desc: 'Stores grain: less spoilage, bigger harvests.' },
    docks:    { name: 'Docks', w: 2, h: 2, hp: 220, cost: { wood: 30 }, time: 170, desc: 'Launches fishing boats, transports for settlers and invasions, and trade ships.' },
    smithy:   { name: 'Smithy', w: 2, h: 2, hp: 300, cost: { wood: 25, stone: 15 }, minAge: 1, time: 200, desc: 'Forges weapons and armour from copper, iron, coal, mithril and adamantine.' },
    windmill: { name: 'Windmill', w: 2, h: 2, hp: 220, cost: { wood: 25, stone: 5 }, minAge: 1, time: 170, desc: 'Grinds grain: every farmer in town harvests more.' },
    market:   { name: 'Market', w: 3, h: 2, hp: 260, cost: { wood: 35, stone: 20 }, minAge: 2, time: 220, desc: 'Sends trade carts and ships to friendly towns and sells gems for gold.' },
    library:  { name: 'Library', w: 2, h: 2, hp: 280, cost: { wood: 30, stone: 25, gold: 10 }, minAge: 2, time: 240, desc: 'Scholars speed up research.' },
};

// ---------------------------------------------------------------- Names
EP.KINGDOM_NAMES = {
    human: [['New', 'Old', 'Great', 'United', 'Eastern', 'Western', 'Northern', 'Southern', 'Holy', 'Royal'],
            ['york', 'haven', 'spring', 'ford', 'castle', 'keep', 'warren', 'shire', 'field', 'mount'],
            ['', ' Realm', ' Domain', ' March', ' Lands', ' Shire']],
    elf:   [['Silver', 'Golden', 'Eternal', 'Ancient', 'Mystic', 'Twilight', 'Moonlit', 'Crystal', 'Starlight', 'Verdant'],
            ['wood', 'vale', 'glade', 'haven', 'realm', 'throne', 'crown', 'light', 'star', 'mist'],
            ['', ' of the Woods', ' of Stars', ' Eternal', ' Court']],
    dwarf: [['Iron', 'Stone', 'Deep', 'Grand', 'Mighty', 'Ancient', 'High', 'Low', 'Copper', 'Granite'],
            ['hold', 'forge', 'hall', 'deep', 'stone', 'gate', 'breach', 'horn', 'rock', 'guard'],
            ['', ' Holds', ' Stronghold', ' Citadel', ' Clans']],
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
    { id: 'peoples', name: 'Peoples', icon: 'cat_life' },
    { id: 'animals', name: 'Animals', icon: 'cat_animals' },
    { id: 'monsters', name: 'Monsters', icon: 'cat_monsters' },
    { id: 'ores', name: 'Ores', icon: 'cat_ores' },
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

    ...EP.CIV_RACES.map(r => tool('peoples', r, EP.SPECIES[r].plural, 'spawn', { desc: EP.SPECIES[r].desc, species: r, repeat: 120, sized: false })),
    ...EP.ANIMALS.map(s => tool('animals', s, EP.SPECIES[s].plural, 'spawn', { desc: EP.SPECIES[s].desc, species: s, repeat: 120, sized: false })),
    ...EP.MONSTERS.map(s => tool('monsters', s, EP.SPECIES[s].plural, 'spawn', { desc: EP.SPECIES[s].desc, species: s, repeat: s === 'dragon' || s === 'ufo' ? 0 : 160, sized: false })),

    tool('ores', 'ore_mix', 'Ore Veins', 'brush', { desc: 'Seed common ore: copper, iron and coal. Soft ground is pushed up into hills.', ore: 'mix' }),
    ...Object.values(EP.ORE_INFO).map(o => tool('ores', 'ore_' + o.id, o.name, 'brush', { desc: `Place ${o.name.toLowerCase()} veins for miners to dig out.`, ore: o.id })),

    tool('nature', 'bless', 'Blessing', 'power', { desc: 'Heal creatures and grant them divine strength.', repeat: 150, sized: true }),
    tool('nature', 'rain', 'Rain Cloud', 'power', { desc: 'Summon rain: douses fires, cools lava, greens the land.', repeat: 500 }),
    tool('nature', 'bloom', 'Bloom', 'power', { desc: 'Restore scorched land and sprout new forests.', repeat: 100, sized: true }),
    tool('nature', 'heal', 'Cure', 'power', { desc: 'Cure plague, madness and undeath. Thaws frozen creatures.', repeat: 150, sized: true }),
    tool('nature', 'fireworks', 'Fireworks', 'power', { desc: 'A dazzling show. Nearby realms cheer up and warm to each other.', repeat: 220 }),

    tool('destroy', 'lightning', 'Lightning', 'power', { desc: 'Smite the land with a bolt from the heavens.', repeat: 180 }),
    tool('destroy', 'fire', 'Fire', 'power', { desc: 'Set the world ablaze. Spreads through forests.', repeat: 60, sized: true }),
    tool('destroy', 'bomb', 'Bomb', 'power', { desc: 'Drop a bomb. Small, loud and satisfying.', repeat: 260 }),
    tool('destroy', 'napalm', 'Napalm', 'power', { desc: 'A bomber run that carpets a strip of land in flames.', repeat: 0 }),
    tool('destroy', 'acid', 'Acid', 'power', { desc: 'Corrosive rain that melts trees, buildings and anything alive.', repeat: 90, sized: true }),
    tool('destroy', 'blizzard', 'Blizzard', 'power', { desc: 'Freeze the land to tundra and creatures solid.', repeat: 90, sized: true }),
    tool('destroy', 'meteor', 'Meteor', 'power', { desc: 'Call down a burning rock from the sky.', repeat: 450 }),
    tool('destroy', 'quake', 'Earthquake', 'power', { desc: 'Shake the earth, toppling buildings and cracking the ground.', repeat: 0 }),
    tool('destroy', 'tornado', 'Tornado', 'power', { desc: 'A roaming twister that flings everything aside.', repeat: 0 }),
    tool('destroy', 'volcano', 'Volcano', 'power', { desc: 'Raise an erupting volcano. Demons may crawl out.', repeat: 0 }),
    tool('destroy', 'plague', 'Plague', 'power', { desc: 'A contagious sickness that spreads between creatures.', repeat: 200, sized: true }),
    tool('destroy', 'madness', 'Madness', 'power', { desc: 'Drive creatures mad: they attack friend and foe alike.', repeat: 200, sized: true }),
    tool('destroy', 'curse', 'Undeath', 'power', { desc: 'Raise the living as zombies and skeletons.', repeat: 200, sized: true }),
    tool('destroy', 'nuke', 'Cataclysm', 'power', { desc: 'An apocalyptic blast that leaves only ash.', repeat: 0 }),

    tool('realm', 'inspect', 'Inspect', 'inspect', { desc: 'Click a creature, building or realm to learn about it. Drag to pan.', repeat: 0 }),
    tool('realm', 'discord', 'Discord', 'power', { desc: 'Sow hatred between realms in the area. War follows.', repeat: 0 }),
    tool('realm', 'harmony', 'Harmony', 'power', { desc: 'Force peace upon warring realms in the area.', repeat: 0 }),
    tool('realm', 'rebel', 'Rebellion', 'power', { desc: 'Incite a town to break away and form its own realm.', repeat: 0 }),
    tool('realm', 'prosper', 'Prosperity', 'power', { desc: 'Shower a realm with food, wood, stone, ore and knowledge.', repeat: 300 }),
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
// Natural disasters: chance per check (every 600 ticks) that something happens somewhere.
EP.DISASTER_LEVELS = { off: { label: 'Off', p: 0 }, rare: { label: 'Rare', p: 0.06 }, often: { label: 'Often', p: 0.2 } };
})();
