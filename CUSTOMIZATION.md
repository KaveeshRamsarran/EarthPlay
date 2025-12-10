/*
 * WORLDBOX CLONE - CUSTOMIZATION GUIDE
 * ====================================
 * 
 * This file explains how to customize various aspects of the game.
 * You can modify these values without touching the main game code.
 * 
 * All customizations are made by editing the game.js file directly.
 */

// ==========================================
// GAME CONFIGURATION CONSTANTS
// ==========================================
// Add these at the top of game.js constructor to customize behavior

// CREATURE SETTINGS
// ==========================================
// Modify these values to change how creatures behave

// Energy consumption rate (higher = creatures need more food)
const ENERGY_DRAIN_RATE = 0.1;  // Default: 0.1

// Water speed penalty (higher = water slows them more)
const WATER_PENALTY = 0.2;  // Default: 0.2

// Lava damage per update
const LAVA_DAMAGE = 10;  // Default: 10

// Maximum age before creature dies
const MAX_AGE = 1000;  // Default: 1000

// Reproduction chance (lower = more frequent breeding)
const BREED_THRESHOLD = 0.001;  // Default: 0.001

// Energy required to reproduce
const BREED_COST = 50;  // Default: 50

// Reproduction energy requirement
const BREED_ENERGY_MIN = 150;  // Default: 150


// TERRAIN SETTINGS
// ==========================================

// Canvas dimensions (affects playable area)
const CANVAS_WIDTH = 1000;   // Default: 1000
const CANVAS_HEIGHT = 600;   // Default: 600

// Tile size in pixels (smaller = more detail, slower performance)
const TILE_SIZE = 16;  // Default: 16


// HAZARD SETTINGS
// ==========================================

// Meteor crater radius
const METEOR_RADIUS = 10;  // Default: 10

// Plague damage to creatures
const PLAGUE_DAMAGE = 50;  // Default: 50

// Lightning devastation radius
const LIGHTNING_RADIUS = 5;  // Default: 5

// Volcano eruption radius
const VOLCANO_RADIUS = 10;  // Default: 10


// SPAWN SETTINGS
// ==========================================

// Scatter distance when spawning creatures
const SPAWN_SCATTER = 5;  // Default: 5 (in tiles)

// Initial population when using "Generate Terrain"
const INITIAL_CREATURES_PER_SPECIES = 2;  // Default: 2
const SPECIES_COUNT = 4;  // Default: 4 (human, elf, dwarf, orc)


// UI SETTINGS
// ==========================================

// Update statistics every N frames
const STATS_UPDATE_INTERVAL = 10;  // Default: 10

// Year increment interval (frames)
const YEAR_UPDATE_INTERVAL = 60;  // Default: 60


// ==========================================
// COLOR CUSTOMIZATION
// ==========================================
// Modify these in spriteGenerator.js in the color constants

// Main theme color (green)
const PRIMARY_COLOR = '#4CAF50';
const PRIMARY_DARK = '#388E3C';
const PRIMARY_LIGHT = '#81C784';

// Terrain colors can be customized in each sprite generator function:
// - GRASS: '#4CAF50' (green)
// - DIRT: '#8B7355' (brown)
// - STONE: '#808080' (gray)
// - SAND: '#F4A460' (sandy)
// - WATER: '#2196F3' (blue)
// - LAVA: '#FF6B35' (orange-red)
// - FOREST: '#1B5E20' (dark green)
// - MOUNTAIN: '#4A4A4A' (dark gray)


// ==========================================
// HOW TO MODIFY GAME BEHAVIOR
// ==========================================

// 1. MAKE CREATURES FASTER/SLOWER
//    In WorldboxGame.spawnCreature():
//    this.creatures.push({
//        ...
//        speed: Math.random() * 0.5 + 0.5,  // Change 0.5 + 0.5
//        ...
//    });
//    Lower numbers = slower creatures
//    Higher numbers = faster creatures

// 2. MAKE CREATURES LIVE LONGER/SHORTER
//    In WorldboxGame.updateGame():
//    if (c.energy <= 0 || c.age > 1000 || c.health <= 0) {
//        1000 = max age in frames
//        Increase for longer life
//        Decrease for shorter life

// 3. INCREASE POPULATION GROWTH
//    In WorldboxGame.updateGame():
//    if (c.energy > 150 && Math.random() < 0.001) {
//        Change 0.001 to higher (e.g., 0.01) for more breeding
//        Change 150 to lower number for easier breeding

// 4. MAKE HAZARDS MORE POWERFUL
//    Increase radius values in triggerHazard() functions
//    Increase damage values (PLAGUE_DAMAGE, LAVA_DAMAGE)

// 5. CHANGE TERRAIN SIZE
//    In WorldboxGame constructor:
//    this.canvas.width = 1000;   // Wider = more playable area
//    this.canvas.height = 600;   // Taller = more playable area
//    this.tileSize = 16;         // Smaller = more detailed

// 6. ADJUST BRUSH SIZE RANGE
//    In index.html:
//    <input type="range" id="brushSize" min="1" max="20" value="3">
//    Change min/max for different brush sizes


// ==========================================
// ADVANCED TWEAKS
// ==========================================

// ADD NEW CREATURE SPECIES:
// 1. Create sprite in spriteGenerator.js:
//    generateNewSpecies() { ... }
// 2. Add to sprites: this.sprites.newspecies = this.generateNewSpecies();
// 3. Add button to HTML: <button class="creature-btn" data-creature="newspecies">🎭</button>
// 4. Add stats in HTML: <span id="newspeciesCount">0</span>
// 5. Update stats in updateStats() function

// ADD NEW TERRAIN TYPE:
// 1. Create sprite in spriteGenerator.js
// 2. Add button to HTML with data-brush attribute
// 3. Reference in drawOnGrid() method

// ADD NEW DISASTER:
// 1. Create hazard button in HTML with data-hazard attribute
// 2. Add case in triggerHazard() switch statement
// 3. Implement disaster function

// CHANGE GAME SPEED PRESETS:
// In WorldboxGame.toggleSpeed():
// const speeds = [0.5, 1, 2, 3];  // Modify these values


// ==========================================
// PERFORMANCE TIPS
// ==========================================

// If the game is too slow:
// 1. Reduce tile size (but less detailed)
// 2. Reduce canvas size
// 3. Reduce creature count
// 4. Increase update intervals

// If the game is too easy:
// 1. Increase hazard frequency
// 2. Reduce creature breeding chance
// 3. Increase energy drain
// 4. Reduce initial population

// If creatures are too smart/stupid:
// 1. Adjust random movement chance (0.02)
// 2. Change movement speed
// 3. Modify terrain penalties


// ==========================================
// EXAMPLE PRESETS
// ==========================================

// REALISTIC ECOSYSTEM
// - Low breeding chance (0.0005)
// - High energy drain (0.15)
// - More hazards
// - Smaller creatures spawn

// CHAOTIC WORLD
// - High breeding chance (0.005)
// - Low energy drain (0.05)
// - Frequent hazards
// - Large starting populations

// PEACEFUL OBSERVER
// - Very low hazard damage
// - Easy breeding
// - No hazards
// - Slow game speed

// CHALLENGE MODE
// - Constant hazards
// - Limited resources
// - High creature needs
// - Fast game speed


// ==========================================
// SAVE & LOAD WORLD
// ==========================================

// To add save/load functionality, add this to game.js:

function saveWorld() {
    const worldData = {
        grid: this.grid,
        creatures: this.creatures,
        year: this.year,
        timestamp: new Date()
    };
    localStorage.setItem('worldboxSave', JSON.stringify(worldData));
}

function loadWorld() {
    const saved = localStorage.getItem('worldboxSave');
    if (saved) {
        const worldData = JSON.parse(saved);
        this.grid = worldData.grid;
        this.creatures = worldData.creatures;
        this.year = worldData.year;
    }
}


// ==========================================
// DEBUGGING
// ==========================================

// Log creature info:
// console.log(`Creatures: ${this.creatures.length}, Year: ${this.year}`);

// Inspect specific creature:
// console.log(this.creatures[0]);

// Check grid state:
// console.log(this.grid[0][0]);

// Monitor FPS:
// console.log(`FPS: ${this.fps}`);


// ==========================================
// FUTURE ENHANCEMENT IDEAS
// ==========================================

// [ ] Trade between species
// [ ] Territory/civilization building
// [ ] Resource management
// [ ] Building structures
// [ ] Weather system
// [ ] Seasons
// [ ] Alliances and wars
// [ ] Tech trees
// [ ] Religion/culture
// [ ] Detailed AI behavior
// [ ] Pathfinding algorithms
// [ ] Zooming/panning camera
// [ ] Replays and save files
// [ ] Sound effects
// [ ] Custom creature designer
// [ ] Mod support

