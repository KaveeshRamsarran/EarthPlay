// Main Game Logic
class WorldboxGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Load settings from sessionStorage
        const settings = JSON.parse(sessionStorage.getItem('gameSettings') || '{"worldSize":"medium","worldShape":"rectangular"}');
        this.worldSize = settings.worldSize;
        this.worldShape = settings.worldShape;
        
        // Set canvas size based on world size
        this.setCanvasSize();
        
        // Game state
        this.tileSize = 16;
        this.gridWidth = Math.floor(this.canvas.width / this.tileSize);
        this.gridHeight = Math.floor(this.canvas.height / this.tileSize);
        
        this.grid = [];
        this.creatures = [];
        this.particles = [];
        this.buildings = [];  // Array to store buildings
        this.vehicles = [];    // Array to store vehicles (cars, boats)
        this.weapons = [];     // Array to store weapons in the world
        
        this.isPaused = false;
        this.gameSpeed = 1;
        this.year = 0;
        this.updateCounter = 0;
        
        // UI state
        this.currentBrush = 'grass';
        this.currentCreature = 'human';
        this.currentHazard = null;
        this.brushSize = 3;
        
        // Sprite generator
        this.spriteGen = new SpriteGenerator();
        
        // FPS tracking
        this.frameCount = 0;
        this.lastFpsTime = Date.now();
        this.fps = 0;
        
        // Zoom and camera
        this.zoom = 1.0;
        this.minZoom = 0.5;
        this.maxZoom = 3.0;
        this.cameraX = 0;
        this.cameraY = 0;
        this.mouseX = 0;
        this.mouseY = 0;
        
        // Animation frame counter
        this.animationFrame = 0;
        
        // Sound manager
        this.soundManager = new SoundManager();
        
        // Civilization system
        this.civSystem = new CivilizationSystem();
        this.selectedKingdom = null;
        this.selectedCreature = null;
        
        // Destruction powers
        this.destructionPowers = new DestructionPowerSystem(this);
        this.currentPower = null;
        
        // Biome system
        this.biomeSystem = new BiomeSystem();
        
        this.initializeGrid();
        this.setupEventListeners();
        this.setupUI();
        this.startGameLoop();
    }

    static getInstance() {
        if (!WorldboxGame.instance) {
            WorldboxGame.instance = new WorldboxGame();
        }
        return WorldboxGame.instance;
    }

    setCanvasSize() {
        const sizes = {
            small: { width: 1600, height: 1200 },
            medium: { width: 2400, height: 1800 },
            large: { width: 3200, height: 2400 },
            huge: { width: 4000, height: 3000 }
        };
        
        const size = sizes[this.worldSize] || sizes.medium;
        this.canvas.width = size.width;
        this.canvas.height = size.height;
    }

    initializeGrid() {
        this.grid = [];
        for (let y = 0; y < this.gridHeight; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.gridWidth; x++) {
                const isValid = this.isValidTile(x, y);
                
                // Generate terrain based on noise-like pattern
                let terrainType = 'water';
                if (isValid) {
                    const noiseValue = this.perlinLike(x, y);
                    if (noiseValue < 0.3) {
                        terrainType = 'sand';
                    } else if (noiseValue < 0.6) {
                        terrainType = 'grass';
                    } else if (noiseValue < 0.8) {
                        terrainType = 'forest';
                    } else {
                        terrainType = 'mountain';
                    }
                }
                
                this.grid[y][x] = {
                    type: terrainType,
                    height: 0,
                    temperature: 70,
                    humidity: 50,
                    hasForest: terrainType === 'forest',
                    isMountain: terrainType === 'mountain',
                    isValidTile: isValid
                };
            }
        }

        // Generate roads after terrain
        this.generateRoads();
    }

    // Simple Perlin-like noise generator
    perlinLike(x, y) {
        const scale = 0.05;
        const n = Math.sin(x * scale) * Math.cos(y * scale) + Math.sin((x + y) * scale * 0.7) * Math.cos((x - y) * scale * 0.7);
        return (n + 2) / 4; // Normalize to 0-1
    }

    isValidTile(x, y) {
        if (this.worldShape === 'rectangular') {
            return true; // All tiles are valid land
        }
        
        const centerX = this.gridWidth / 2;
        const centerY = this.gridHeight / 2;
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        switch (this.worldShape) {
            case 'circular':
                return dist < Math.min(centerX, centerY) * 0.9;
            case 'island':
                return dist < Math.min(centerX, centerY) * 0.7;
            case 'archipelago':
                const islandDist = dist % 30;
                return islandDist < 15;
            default:
                return true;
        }
        // Invalid tiles will be automatically filled with water in initializeGrid
    }

    generateRoads() {
        // Create pathways between different biomes - optimized
        const roadCount = this.worldSize === 'huge' ? 3 : (this.worldSize === 'large' ? 2 : 1);
        
        for (let r = 0; r < roadCount; r++) {
            // Random start and end points
            let startX = Math.floor(Math.random() * this.gridWidth);
            let startY = Math.floor(Math.random() * this.gridHeight);
            let endX = Math.floor(Math.random() * this.gridWidth);
            let endY = Math.floor(Math.random() * this.gridHeight);
            
            // Create path from start to end
            let x = startX;
            let y = startY;
            
            while (x !== endX || y !== endY) {
                // Randomly step towards target
                if (Math.random() < 0.5) {
                    x += Math.sign(endX - x);
                } else {
                    y += Math.sign(endY - y);
                }
                
                x = Math.max(0, Math.min(this.gridWidth - 1, x));
                y = Math.max(0, Math.min(this.gridHeight - 1, y));
                
                // Place road if on valid land (not water or mountain)
                if (this.isValidTile(x, y) && this.grid[y][x].type !== 'water' && this.grid[y][x].type !== 'mountain') {
                    this.grid[y][x].type = 'road';
                }
            }
        }
    }

    setupEventListeners() {
        // Canvas interaction
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mouseup', () => this.isDrawing = false);
        this.canvas.addEventListener('mouseleave', () => this.isDrawing = false);
        
        // Zoom with mouse wheel - zoom toward cursor
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSpeed = 0.1;
            const direction = e.deltaY > 0 ? -1 : 1;
            
            // Get mouse position relative to canvas
            const rect = this.canvas.getBoundingClientRect();
            const mouseCanvasX = e.clientX - rect.left;
            const mouseCanvasY = e.clientY - rect.top;
            
            // Calculate old zoom
            const oldZoom = this.zoom;
            this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom + direction * zoomSpeed));
            
            // Adjust camera to zoom toward cursor
            const zoomChange = this.zoom - oldZoom;
            this.cameraX -= mouseCanvasX * (zoomChange / oldZoom);
            this.cameraY -= mouseCanvasY * (zoomChange / oldZoom);
        });
        
        // Keyboard zoom controls - zoom toward center
        document.addEventListener('keydown', (e) => {
            if (e.key === '+' || e.key === '=') {
                const oldZoom = this.zoom;
                this.zoom = Math.min(this.maxZoom, this.zoom + 0.1);
                const zoomChange = this.zoom - oldZoom;
                this.cameraX -= (this.canvas.width / 2) * (zoomChange / oldZoom);
                this.cameraY -= (this.canvas.height / 2) * (zoomChange / oldZoom);
            } else if (e.key === '-' || e.key === '_') {
                const oldZoom = this.zoom;
                this.zoom = Math.max(this.minZoom, this.zoom - 0.1);
                const zoomChange = this.zoom - oldZoom;
                this.cameraX -= (this.canvas.width / 2) * (zoomChange / oldZoom);
                this.cameraY -= (this.canvas.height / 2) * (zoomChange / oldZoom);
            }
        });

        // Middle-mouse button panning
        let isMiddleMouseDown = false;
        let middleMouseStartX = 0;
        let middleMouseStartY = 0;
        let middleMouseStartCameraX = 0;
        let middleMouseStartCameraY = 0;

        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 1) { // Middle mouse button
                e.preventDefault();
                isMiddleMouseDown = true;
                const rect = this.canvas.getBoundingClientRect();
                middleMouseStartX = e.clientX - rect.left;
                middleMouseStartY = e.clientY - rect.top;
                middleMouseStartCameraX = this.cameraX;
                middleMouseStartCameraY = this.cameraY;
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (isMiddleMouseDown) {
                const rect = this.canvas.getBoundingClientRect();
                const currentX = e.clientX - rect.left;
                const currentY = e.clientY - rect.top;
                
                // Calculate drag distance and convert to world coordinates
                const dragDeltaX = (middleMouseStartX - currentX) / this.zoom;
                const dragDeltaY = (middleMouseStartY - currentY) / this.zoom;
                
                // Update camera position
                this.cameraX = middleMouseStartCameraX + dragDeltaX;
                this.cameraY = middleMouseStartCameraY + dragDeltaY;
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (e.button === 1) { // Middle mouse button
                isMiddleMouseDown = false;
            }
        });

        // Brush selection
        document.querySelectorAll('.brush-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectBrush(e.target.closest('.brush-btn')));
        });

        // Creature selection
        document.querySelectorAll('.creature-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectCreature(e.target.closest('.creature-btn')));
        });

        // Hazard selection
        document.querySelectorAll('.hazard-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectHazard(e.target.closest('.hazard-btn')));
        });

        // Tool buttons - find pause button
        const pauseBtn = document.querySelector('[data-tool]');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => this.togglePause());
        }

        // Speed control
        document.getElementById('speed').addEventListener('change', (e) => {
            this.gameSpeed = parseFloat(e.target.value);
            document.getElementById('speedDisplay').textContent = e.target.value + 'x';
        });

        // Brush size
        document.getElementById('brushSize').addEventListener('change', (e) => {
            this.brushSize = parseInt(e.target.value);
            document.getElementById('brushSizeDisplay').textContent = e.target.value;
        });

        // Action buttons
        document.getElementById('clearBtn').addEventListener('click', () => this.clearWorld());
        document.getElementById('generateBtn').addEventListener('click', () => this.generateTerrain());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
    }

    setupUI() {
        // Initialize tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
        
        // Civilization buttons
        document.querySelectorAll('.kingdom-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.createKingdomFromUI(e.target.closest('.kingdom-btn').dataset.kingdom));
        });
        
        // Divine power buttons
        document.querySelectorAll('.power-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.selectPower(e.target.closest('.power-btn')));
        });
        
        // Default select grass brush
        document.querySelector('[data-brush="grass"]').classList.add('selected');
        
        // Update kingdoms list initially
        this.updateKingdomsList();
    }
    
    createKingdomFromUI(race) {
        // Create a kingdom at random valid location
        for (let attempt = 0; attempt < 10; attempt++) {
            const x = Math.floor(Math.random() * this.gridWidth);
            const y = Math.floor(Math.random() * this.gridHeight);
            if (this.isValidTile(x, y)) {
                const kingdom = this.civSystem.createKingdom(x, y, race);
                // Spawn initial creatures
                for (let i = 0; i < 15; i++) {
                    this.spawnCreature(x, y, race, 1);
                }
                this.updateKingdomsList();
                return;
            }
        }
    }
    
    selectPower(btn) {
        document.querySelectorAll('.power-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.currentPower = btn.dataset.power;
        this.currentBrush = null;
        this.currentCreature = null;
        this.currentHazard = null;
    }
    
    updateKingdomsList() {
        const kingdomsContainer = document.getElementById('kingdomsList');
        if (!kingdomsContainer) return;
        
        if (this.civSystem.kingdoms.length === 0) {
            kingdomsContainer.innerHTML = '<p style="color: #999;">No kingdoms yet. Spawn races to create civilizations!</p>';
            return;
        }
        
        let html = '';
        this.civSystem.kingdoms.forEach(kingdom => {
            const raceData = this.civSystem.races[kingdom.race];
            html += `
                <div class="kingdom-entry" style="padding: 8px; border: 1px solid ${kingdom.color}; margin: 5px 0; cursor: pointer;" onclick="window.game.selectKingdom(${kingdom.id})">
                    <div style="font-weight: bold; color: ${kingdom.color};">${kingdom.name}</div>
                    <div style="font-size: 0.8em; color: #ccc;">
                        Pop: ${kingdom.citizenCount} | Tech: ${kingdom.techLevel} | Happy: ${Math.floor(kingdom.happiness)}%
                    </div>
                </div>
            `;
        });
        kingdomsContainer.innerHTML = html;
    }
    
    selectKingdom(kingdomId) {
        this.selectedKingdom = kingdomId;
        const kingdom = this.civSystem.kingdoms.find(k => k.id === kingdomId);
        if (kingdom) {
            // Center camera on kingdom
            this.cameraX = kingdom.centerX - this.canvas.width / (2 * this.zoom * this.tileSize);
            this.cameraY = kingdom.centerY - this.canvas.height / (2 * this.zoom * this.tileSize);
        }
    }
    
    updatePowerCooldowns() {
        const container = document.getElementById('powerCooldownsContainer');
        if (!container) return;
        
        let html = '<div style="font-size: 0.8em;">';
        Object.keys(this.destructionPowers.powers).forEach(powerName => {
            const percent = this.destructionPowers.getPowerCooldownPercent(powerName);
            const isReady = percent >= 100;
            const color = isReady ? '#4CAF50' : '#999';
            html += `<div style="color: ${color}; margin: 3px 0;">${this.destructionPowers.powers[powerName].emoji} ${Math.floor(percent)}%</div>`;
        });
        html += '</div>';
        container.innerHTML = html;
    }

    switchTab(tabName) {
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update active tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');
    }

    selectBrush(btn) {
        document.querySelectorAll('.brush-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.currentBrush = btn.dataset.brush;
        this.currentCreature = null;
        this.currentHazard = null;
    }

    selectCreature(btn) {
        document.querySelectorAll('.creature-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.currentCreature = btn.dataset.creature;
        this.currentBrush = null;
        this.currentHazard = null;
    }

    selectHazard(btn) {
        document.querySelectorAll('.hazard-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.currentHazard = btn.dataset.hazard;
        this.currentBrush = null;
        this.currentCreature = null;
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.mouseX = x;
        this.mouseY = y;

        // Update crosshair
        document.querySelector('.crosshair').style.left = (x - 15) + 'px';
        document.querySelector('.crosshair').style.top = (y - 15) + 'px';

        // Update info bar
        const gridX = Math.floor(x / this.tileSize);
        const gridY = Math.floor(y / this.tileSize);
        document.getElementById('mouseInfo').textContent = `X: ${gridX}, Y: ${gridY}`;

        // Handle continuous drawing
        if (this.isDrawing) {
            this.drawOnGrid(gridX, gridY);
        }
    }

    handleMouseDown(e) {
        this.isDrawing = true;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const gridX = Math.floor(x / this.tileSize);
        const gridY = Math.floor(y / this.tileSize);
        this.drawOnGrid(gridX, gridY);
    }

    handleCanvasClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = e.clientX - rect.left;
        const canvasY = e.clientY - rect.top;
        
        // Convert canvas coordinates to world coordinates accounting for zoom and camera
        const worldX = (canvasX / this.zoom) - (this.canvas.width / (2 * this.zoom)) + this.cameraX + (this.canvas.width / (2 * this.zoom));
        const worldY = (canvasY / this.zoom) - (this.canvas.height / (2 * this.zoom)) + this.cameraY + (this.canvas.height / (2 * this.zoom));
        
        const gridX = Math.floor(worldX / this.tileSize);
        const gridY = Math.floor(worldY / this.tileSize);

        if (this.currentCreature) {
            this.spawnCreature(gridX, gridY, this.currentCreature, 5);
        } else if (this.currentHazard) {
            this.triggerHazard(gridX, gridY, this.currentHazard);
        } else if (this.currentPower) {
            this.destructionPowers.triggerPower(this.currentPower, gridX, gridY);
            this.updatePowerCooldowns();
        }
    }

    drawOnGrid(centerX, centerY) {
        const radius = this.brushSize;

        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const x = centerX + dx;
                const y = centerY + dy;

                if (x >= 0 && x < this.gridWidth && y >= 0 && y < this.gridHeight) {
                    if (this.currentBrush) {
                        this.grid[y][x].type = this.currentBrush;
                        this.grid[y][x].hasForest = this.currentBrush === 'forest';
                        this.grid[y][x].isMountain = this.currentBrush === 'mountain';
                    }
                }
            }
        }
    }

    spawnCreature(x, y, type, count = 1) {
        for (let i = 0; i < count; i++) {
            const offsetX = (Math.random() - 0.5) * 5;
            const offsetY = (Math.random() - 0.5) * 5;
            const gridX = Math.max(0, Math.min(this.gridWidth - 1, Math.floor(x + offsetX)));
            const gridY = Math.max(0, Math.min(this.gridHeight - 1, Math.floor(y + offsetY)));

            // Use enhanced creature creation with traits and genetics
            const creature = this.civSystem.createCreatureWithTraits(gridX, gridY, type, []);
            if (creature) {
                this.creatures.push(creature);
                
                // Assign to kingdom if civilized race
                const raceData = this.civSystem.races[type];
                if (raceData && raceData.isCivilized !== false) {
                    // Find or create kingdom
                    let kingdom = this.civSystem.kingdoms.find(k => k.race === type && 
                        Math.hypot(k.centerX - gridX, k.centerY - gridY) < 50);
                    
                    if (!kingdom) {
                        kingdom = this.civSystem.createKingdom(gridX, gridY, type);
                    }
                    
                    if (kingdom) {
                        this.civSystem.assignCreatureToKingdom(creature, kingdom);
                    }
                }
            }
        }
    }

    spawnWeapon(x, y, weaponType = 'sword') {
        const gridX = Math.max(0, Math.min(this.gridWidth - 1, Math.floor(x)));
        const gridY = Math.max(0, Math.min(this.gridHeight - 1, Math.floor(y)));

        this.weapons.push({
            x: gridX,
            y: gridY,
            type: weaponType,
            age: 0
        });
    }

    spawnVehicle(x, y, vehicleType = 'car') {
        const gridX = Math.max(0, Math.min(this.gridWidth - 1, Math.floor(x)));
        const gridY = Math.max(0, Math.min(this.gridHeight - 1, Math.floor(y)));

        this.vehicles.push({
            x: gridX,
            y: gridY,
            type: vehicleType,
            direction: Math.random() * Math.PI * 2,
            speed: 0.15,
            health: 200,
            passengers: []  // Can hold creatures
        });
    }

    constructBuilding(x, y, buildingType, ownerRace = 'human') {
        const gridX = Math.floor(x);
        const gridY = Math.floor(y);

        // Check if tile is valid for building
        if (gridX < 0 || gridX >= this.gridWidth || gridY < 0 || gridY >= this.gridHeight) return;
        if (!this.isValidTile(gridX, gridY)) return;

        const tile = this.grid[gridY][gridX];
        // Buildings can only be built on grass or sand
        if (tile.type !== 'grass' && tile.type !== 'sand') return;

        // Check if space is already occupied by building
        if (this.buildings.some(b => b.x === gridX && b.y === gridY)) return;

        // Create building
        const building = {
            x: gridX,
            y: gridY,
            type: buildingType,
            owner: ownerRace,
            age: 0,
            population: 0  // For houses
        };

        // Building effects - DON'T change tile type (avoid duplication)
        if (buildingType === 'house') {
            building.maxPopulation = 8;
            building.population = 3;
        } else if (buildingType === 'townhall') {
            building.maxPopulation = 50;
            building.population = 10;
        } else if (buildingType === 'farm') {
            building.production = 100;
        } else if (buildingType === 'tower') {
            building.defense = 50;
        } else if (buildingType === 'castle') {
            building.maxPopulation = 200;
            building.population = 50;
            building.defense = 100;
        } else if (buildingType === 'market') {
            building.commerce = 75;
        } else if (buildingType === 'temple') {
            building.morale = 50;
        } else if (buildingType === 'road') {
            // Road specific logic
        }

        this.buildings.push(building);
    }

    // Humanoid creatures randomly build around them
    updateBuildings() {
        // Humanoids occasionally build structures - more variety
        for (let humanoid of this.creatures) {
            const race = humanoid.type;
            if (['human', 'elf', 'dwarf', 'orc', 'undead'].includes(race) && Math.random() < 0.0001) {
                // Find empty nearby tiles for building
                const buildRadius = 5;
                const buildX = humanoid.x + (Math.random() - 0.5) * buildRadius * 2;
                const buildY = humanoid.y + (Math.random() - 0.5) * buildRadius * 2;

                // Random building type with proper distribution
                const rand = Math.random();
                let buildType = 'house';
                if (rand < 0.4) buildType = 'house';
                else if (rand < 0.6) buildType = 'road';
                else if (rand < 0.75) buildType = 'farm';
                else if (rand < 0.85) buildType = 'townhall';
                else if (rand < 0.92) buildType = 'tower';
                else if (rand < 0.96) buildType = 'market';
                else buildType = 'temple';

                this.constructBuilding(buildX, buildY, buildType, race);
            }
        }
    }

    triggerHazard(x, y, hazard) {
        const radius = 10;

        // Play hazard sound if zoomed in
        if (this.zoom >= 1.5) {
            this.soundManager.playHazardSound(this.zoom, hazard);
        }

        switch (hazard) {
            case 'meteor':
                this.createMeteor(x, y, radius);
                break;
            case 'plague':
                this.spreadPlague(x, y, radius);
                break;
            case 'lightning':
                this.strikeWithLightning(x, y, radius);
                break;
            case 'volcano':
                this.eruptVolcano(x, y, radius);
                break;
            case 'tsunami':
                this.triggerTsunami(x, y, radius);
                break;
            case 'blizzard':
                this.triggerBlizzard(x, y, radius);
                break;
            case 'earthquake':
                this.triggerEarthquake(x, y, radius);
                break;
            case 'wildfire':
                this.triggerWildfire(x, y, radius);
                break;
        }
    }

    createMeteor(x, y, radius) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= radius) {
                    const gx = x + dx;
                    const gy = y + dy;
                    if (gx >= 0 && gx < this.gridWidth && gy >= 0 && gy < this.gridHeight) {
                        this.grid[gy][gx].type = 'lava';
                        this.particles.push({
                            x: gx,
                            y: gy,
                            type: 'fire',
                            life: 30
                        });
                    }
                }
            }
        }

        // Kill creatures in area
        this.creatures = this.creatures.filter(c => {
            const dist = Math.sqrt((c.x - x) ** 2 + (c.y - y) ** 2);
            return dist > radius;
        });
    }

    spreadPlague(x, y, radius) {
        // Damage creatures
        this.creatures.forEach(c => {
            const dist = Math.sqrt((c.x - x) ** 2 + (c.y - y) ** 2);
            if (dist <= radius) {
                c.health -= 50;
            }
        });

        // Remove dead creatures
        this.creatures = this.creatures.filter(c => c.health > 0);
    }

    strikeWithLightning(x, y, radius) {
        // Devastate area
        for (let dy = -radius / 2; dy <= radius / 2; dy++) {
            for (let dx = -radius / 2; dx <= radius / 2; dx++) {
                const gx = x + dx;
                const gy = y + dy;
                if (gx >= 0 && gx < this.gridWidth && gy >= 0 && gy < this.gridHeight) {
                    this.grid[gy][gx].type = 'dirt';
                    this.particles.push({
                        x: gx,
                        y: gy,
                        type: 'spark',
                        life: 20
                    });
                }
            }
        }

        this.creatures = this.creatures.filter(c => {
            const dist = Math.sqrt((c.x - x) ** 2 + (c.y - y) ** 2);
            return dist > radius / 2;
        });
    }

    eruptVolcano(x, y, radius) {
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= radius) {
                    const gx = x + dx;
                    const gy = y + dy;
                    if (gx >= 0 && gx < this.gridWidth && gy >= 0 && gy < this.gridHeight) {
                        this.grid[gy][gx].type = 'lava';
                        this.grid[gy][gx].temperature = 200;
                    }
                }
            }
        }

        this.creatures = this.creatures.filter(c => {
            const dist = Math.sqrt((c.x - x) ** 2 + (c.y - y) ** 2);
            return dist > radius;
        });
    }

    triggerTsunami(x, y, radius) {
        // Find nearby water and convert to lava temporarily, destroy terrain
        for (let dy = -radius * 2; dy <= radius * 2; dy++) {
            for (let dx = -radius * 2; dx <= radius * 2; dx++) {
                const gx = x + dx;
                const gy = y + dy;
                if (gx >= 0 && gx < this.gridWidth && gy >= 0 && gy < this.gridHeight) {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist <= radius * 2) {
                        if (this.grid[gy][gx].type === 'sand' || this.grid[gy][gx].type === 'dirt') {
                            this.grid[gy][gx].type = 'water';
                            this.particles.push({
                                x: gx,
                                y: gy,
                                type: 'water',
                                life: 40
                            });
                        }
                    }
                }
            }
        }

        // Damage creatures
        this.creatures = this.creatures.filter(c => {
            const dist = Math.sqrt((c.x - x) ** 2 + (c.y - y) ** 2);
            if (dist <= radius * 2) {
                c.health -= 60;
            }
            return c.health > 0;
        });
    }

    triggerBlizzard(x, y, radius) {
        // Cover terrain in snow (represented as light gray)
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const gx = x + dx;
                const gy = y + dy;
                if (gx >= 0 && gx < this.gridWidth && gy >= 0 && gy < this.gridHeight) {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist <= radius) {
                        // Temporarily damage creatures in blizzard
                        this.particles.push({
                            x: gx,
                            y: gy,
                            type: 'snow',
                            life: 50
                        });
                    }
                }
            }
        }

        // Slow down and damage creatures
        this.creatures.forEach(c => {
            const dist = Math.sqrt((c.x - x) ** 2 + (c.y - y) ** 2);
            if (dist <= radius) {
                c.speed *= 0.5;
                c.health -= 30;
            }
        });

        this.creatures = this.creatures.filter(c => c.health > 0);
    }

    triggerEarthquake(x, y, radius) {
        // Randomly shuffle terrain
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const gx = x + dx;
                const gy = y + dy;
                if (gx >= 0 && gx < this.gridWidth && gy >= 0 && gy < this.gridHeight) {
                    // Randomly change terrain type
                    if (Math.random() < 0.3) {
                        const terrainTypes = ['dirt', 'stone', 'sand'];
                        this.grid[gy][gx].type = terrainTypes[Math.floor(Math.random() * terrainTypes.length)];
                    }
                    
                    this.particles.push({
                        x: gx,
                        y: gy,
                        type: 'dust',
                        life: 30
                    });
                }
            }
        }

        // Damage creatures
        this.creatures = this.creatures.filter(c => {
            const dist = Math.sqrt((c.x - x) ** 2 + (c.y - y) ** 2);
            if (dist <= radius) {
                c.health -= 50;
            }
            return c.health > 0;
        });
    }

    triggerWildfire(x, y, radius) {
        // Spread fire through forests and grasslands
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const gx = x + dx;
                const gy = y + dy;
                if (gx >= 0 && gx < this.gridWidth && gy >= 0 && gy < this.gridHeight) {
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist <= radius) {
                        const tile = this.grid[gy][gx];
                        if (tile.type === 'forest' || tile.type === 'grass') {
                            tile.type = 'dirt';
                            for (let i = 0; i < 3; i++) {
                                this.particles.push({
                                    x: gx,
                                    y: gy,
                                    type: 'fire',
                                    life: 50
                                });
                            }
                        }
                    }
                }
            }
        }

        // Damage creatures
        this.creatures = this.creatures.filter(c => {
            const dist = Math.sqrt((c.x - x) ** 2 + (c.y - y) ** 2);
            if (dist <= radius) {
                c.health -= 70;
            }
            return c.health > 0;
        });
    }

    generateTerrain() {
        this.initializeGrid();

        // Generate basic terrain with Perlin-like noise (simplified)
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                if (!this.grid[y][x].isValidTile) {
                    this.grid[y][x].type = 'water';
                    continue;
                }

                const nx = x / this.gridWidth;
                const ny = y / this.gridHeight;
                const noise = this.simpleNoise(nx * 4, ny * 4);

                if (noise > 0.7) {
                    this.grid[y][x].type = 'mountain';
                    this.grid[y][x].isMountain = true;
                } else if (noise > 0.6) {
                    this.grid[y][x].type = 'forest';
                    this.grid[y][x].hasForest = true;
                } else if (noise > 0.5) {
                    this.grid[y][x].type = 'stone';
                } else if (noise > 0.4) {
                    this.grid[y][x].type = 'dirt';
                } else if (noise > 0.2) {
                    this.grid[y][x].type = 'sand';
                } else {
                    this.grid[y][x].type = 'water';
                }
            }
        }

        // Spawn initial humanoid creatures - balanced for performance
        const humanoidTypes = ['human', 'elf', 'dwarf', 'orc'];
        humanoidTypes.forEach(type => {
            const count = this.worldSize === 'huge' ? 4 : (this.worldSize === 'large' ? 3 : 2);
            for (let i = 0; i < count; i++) {
                let x, y, found = false;
                for (let attempts = 0; attempts < 10; attempts++) {
                    x = Math.floor(Math.random() * this.gridWidth);
                    y = Math.floor(Math.random() * this.gridHeight);
                    const tile = this.grid[y][x];
                    if (tile.isValidTile && tile.type !== 'water' && tile.type !== 'mountain') {
                        found = true;
                        break;
                    }
                }
                if (found) this.spawnCreature(x, y, type, 2);
            }
        });

        // Spawn initial animals - balanced for performance
        const animalTypes = ['wolf', 'bear', 'deer', 'eagle'];
        animalTypes.forEach(type => {
            const count = this.worldSize === 'huge' ? 3 : (this.worldSize === 'large' ? 2 : 1);
            for (let i = 0; i < count; i++) {
                let x, y, found = false;
                for (let attempts = 0; attempts < 10; attempts++) {
                    x = Math.floor(Math.random() * this.gridWidth);
                    y = Math.floor(Math.random() * this.gridHeight);
                    const tile = this.grid[y][x];
                    // Eagles can fly over mountains, others need valid land
                    if (type === 'eagle') {
                        if (tile.isValidTile && tile.type !== 'water') found = true;
                    } else {
                        if (tile.isValidTile && tile.type !== 'water' && tile.type !== 'mountain') found = true;
                    }
                    if (found) break;
                }
                if (found) this.spawnCreature(x, y, type, 3);
            }
        });

        // Spawn fish in water - optimized for performance
        const fishCount = this.worldSize === 'huge' ? 8 : (this.worldSize === 'large' ? 5 : 3);
        for (let i = 0; i < fishCount; i++) {
            let x, y;
            for (let attempts = 0; attempts < 10; attempts++) {
                x = Math.floor(Math.random() * this.gridWidth);
                y = Math.floor(Math.random() * this.gridHeight);
                if (this.grid[y][x].type === 'water') break;
            }
            if (this.grid[y][x].type === 'water') {
                this.spawnCreature(x, y, 'fish', 4);
            }
        }

        // Spawn initial vehicles on roads - balanced for performance
        const vehicleCount = this.worldSize === 'huge' ? 2 : 1;
        for (let i = 0; i < vehicleCount; i++) {
            let x, y, found = false;
            for (let attempts = 0; attempts < 15; attempts++) {
                x = Math.floor(Math.random() * this.gridWidth);
                y = Math.floor(Math.random() * this.gridHeight);
                if (this.grid[y][x].type === 'road' || this.grid[y][x].type === 'grass') {
                    found = true;
                    break;
                }
            }
            if (found) {
                const vehicleTypes = ['car', 'boat'];
                this.spawnVehicle(x, y, vehicleTypes[i % 2]);
            }
        }

        // Spawn initial weapons scattered across map - optimized for performance
        const weaponCount = this.worldSize === 'huge' ? 4 : (this.worldSize === 'large' ? 3 : 2);
        for (let i = 0; i < weaponCount; i++) {
            let x, y, found = false;
            for (let attempts = 0; attempts < 10; attempts++) {
                x = Math.floor(Math.random() * this.gridWidth);
                y = Math.floor(Math.random() * this.gridHeight);
                if (this.grid[y][x].isValidTile && this.grid[y][x].type !== 'water') {
                    found = true;
                    break;
                }
            }
            if (found) {
                const weaponTypes = ['sword', 'axe', 'bow'];
                this.spawnWeapon(x, y, weaponTypes[i % 3]);
            }
        }
    }

    simpleNoise(x, y) {
        // Simple noise function for terrain generation
        const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        return n - Math.floor(n);
    }

    updateGame() {
        if (this.isPaused) return;

        this.updateCounter++;
        
        // Update creatures
        for (let i = this.creatures.length - 1; i >= 0; i--) {
            const c = this.creatures[i];
            c.age++;
            c.energy -= 0.1;

            // Random movement
            if (Math.random() < 0.02) {
                c.direction = Math.random() * Math.PI * 2;
            }

            // Calculate next position
            const nextX = c.x + Math.cos(c.direction) * c.speed;
            const nextY = c.y + Math.sin(c.direction) * c.speed;
            
            // Check collision before moving
            const nextTileX = Math.floor(nextX);
            const nextTileY = Math.floor(nextY);
            
            // Check if next tile is valid and passable
            let canMove = true;
            if (nextTileX < 0 || nextTileX >= this.gridWidth || nextTileY < 0 || nextTileY >= this.gridHeight) {
                canMove = false; // Out of bounds
            } else if (!this.isValidTile(nextTileX, nextTileY)) {
                canMove = false; // Invalid based on world shape
            } else {
                // Check terrain type with aquatic restrictions
                const nextTile = this.grid[nextTileY][nextTileX];
                const isAquatic = c.type === 'fish';
                const isFlying = c.type === 'eagle';
                
                if (nextTile.type === 'mountain' && !isFlying) {
                    canMove = false; // Can't walk through mountains (unless flying)
                } else if (nextTile.type === 'water') {
                    // Only aquatic and flying creatures can move through water
                    canMove = isAquatic || isFlying;
                } else if (isAquatic) {
                    // Aquatic creatures can only move through water
                    canMove = false;
                    canMove = false;
                }
            }

            // Move if collision check passed
            if (canMove) {
                c.x = nextX;
                c.y = nextY;
                
                // Play creature sound occasionally when zoomed in
                if (Math.random() < 0.01 && this.zoom >= 1.5) {
                    this.soundManager.playCreatureSound(this.zoom, c.type);
                }
            } else {
                // Pick a new random direction if blocked
                c.direction = Math.random() * Math.PI * 2;
            }

            // Keep creatures in bounds (fallback)
            c.x = Math.max(0, Math.min(this.gridWidth - 1, c.x));
            c.y = Math.max(0, Math.min(this.gridHeight - 1, c.y));

            // Death conditions - only die if health is depleted, NOT from age or energy
            if (c.health <= 0) {
                this.creatures.splice(i, 1);
                continue;
            }

            // Creature interaction with terrain
            const terrainX = Math.floor(c.x);
            const terrainY = Math.floor(c.y);
            const tile = this.grid[terrainY][terrainX];

            if (tile.type === 'water') {
                c.energy -= 0.2; // Slow down in water
            }

            if (tile.type === 'lava') {
                c.health -= 10; // Lava damage
            }
            
            // Apply biome effects
            const biome = this.biomeSystem.getBiomeAt(this, terrainX, terrainY);
            if (biome) {
                this.biomeSystem.applyBiomeEffects(c, biome, this);
            }

            // Reproduction
            if (c.energy > 150 && Math.random() < 0.001) {
                this.spawnCreature(c.x, c.y, c.type, 1);
                c.energy -= 50;
            }
        }

        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].life--;
            if (this.particles[i].life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Update buildings (humanoids build)
        this.updateBuildings();

        // Update vehicles (move around)
        this.vehicles.forEach(v => {
            v.x += Math.cos(v.direction) * v.speed;
            v.y += Math.sin(v.direction) * v.speed;

            // Random direction change
            if (Math.random() < 0.02) {
                v.direction = Math.random() * Math.PI * 2;
            }

            // Bounce off boundaries
            if (v.x < 0 || v.x >= this.gridWidth) v.direction = Math.PI - v.direction;
            if (v.y < 0 || v.y >= this.gridHeight) v.direction = -v.direction;
        });

        // Update weapons (can be picked up by creatures)
        for (let i = this.weapons.length - 1; i >= 0; i--) {
            const w = this.weapons[i];
            w.age++;

            // Check if any humanoid is near weapon and pick it up
            for (let j = 0; j < this.creatures.length; j++) {
                const c = this.creatures[j];
                if (['human', 'elf', 'dwarf', 'orc', 'undead'].includes(c.type)) {
                    const dist = Math.hypot(c.x - w.x, c.y - w.y);
                    if (dist < 1.5) {
                        c.weapon = w.type;  // Equip weapon
                        this.weapons.splice(i, 1);
                        break;
                    }
                }
            }
        }

        // Random mob spawning
        if (this.updateCounter % 120 === 0) { // Spawn check every 2 seconds
            const creatureTypes = ['human', 'elf', 'dwarf', 'orc', 'undead', 'wolf', 'bear', 'deer', 'eagle', 'fish'];
            
            // Count creatures by type
            const counts = {};
            creatureTypes.forEach(type => { counts[type] = 0; });
            this.creatures.forEach(c => { 
                if (counts[c.type] !== undefined) counts[c.type]++;
            });

            // Spawn limits and biome preferences
            const spawnLimits = {
                'human': 30, 'elf': 25, 'dwarf': 20, 'orc': 20, 'undead': 15,
                'wolf': 15, 'bear': 8, 'deer': 25, 'eagle': 12, 'fish': 30
            };

            // Randomly pick a creature type to spawn
            if (Math.random() < 0.3 && this.creatures.length < 150) {
                const typeToSpawn = creatureTypes[Math.floor(Math.random() * creatureTypes.length)];
                
                if (counts[typeToSpawn] < spawnLimits[typeToSpawn]) {
                    // Find a valid spawn location
                    let spawned = false;
                    for (let attempts = 0; attempts < 10; attempts++) {
                        const x = Math.random() * this.gridWidth;
                        const y = Math.random() * this.gridHeight;
                        const tile = this.grid[Math.floor(y)][Math.floor(x)];
                        
                        // Spawn in valid terrain based on creature type
                        let validTerrain = false;
                        
                        if (typeToSpawn === 'fish') {
                            // Fish only spawn in water
                            validTerrain = tile.type === 'water';
                        } else if (typeToSpawn === 'eagle') {
                            // Eagles can spawn almost anywhere except water
                            validTerrain = tile.type !== 'water' && tile.type !== 'lava' && tile.type !== 'mountain';
                        } else {
                            // All other creatures spawn on land (grass, sand, forest)
                            validTerrain = tile.type === 'grass' || tile.type === 'sand' || tile.type === 'forest';
                        }
                        
                        if (validTerrain) {
                            this.spawnCreature(x, y, typeToSpawn, 0.5);
                            spawned = true;
                            break;
                        }
                    }
                }
            }
        }

        // Update year counter
        if (this.updateCounter % 60 === 0) {
            this.year++;
            
            // Auto-create kingdoms for civilized races
            const civilizedRaces = ['human', 'elf', 'dwarf', 'orc', 'undead'];
            civilizedRaces.forEach(race => {
                this.checkAndCreateAutoKingdom(race);
            });
            
            // Update kingdoms
            this.civSystem.kingdoms.forEach(kingdom => {
                // Update population count
                kingdom.population = this.creatures.filter(c => c.kingdom === kingdom.id).length;
                
                // Happiness changes based on population and tech
                kingdom.happiness = Math.max(0, Math.min(100, kingdom.happiness + (kingdom.techLevel - 2)));
                
                // Resource production based on buildings and tech
                kingdom.resources.food += kingdom.techLevel * 10;
                kingdom.resources.gold += kingdom.techLevel * 5;
                kingdom.resources.wood += kingdom.techLevel * 8;
                
                // Auto-construct capital when population threshold reached
                if (this.civSystem.shouldConstructCapital(kingdom)) {
                    const territoryTiles = this.getTerritoryTiles(kingdom.id);
                    this.civSystem.constructCapital(kingdom, territoryTiles);
                }
            });
            
            // Diplomacy changes
            for (let i = 0; i < this.civSystem.kingdoms.length; i++) {
                for (let j = i + 1; j < this.civSystem.kingdoms.length; j++) {
                    const k1 = this.civSystem.kingdoms[i];
                    const k2 = this.civSystem.kingdoms[j];
                    
                    // Random relation changes
                    if (Math.random() < 0.3) {
                        const change = (Math.random() - 0.5) * 10;
                        this.civSystem.updateDiplomacy(k1.id, k2.id, change);
                    }
                }
            }
        }

        this.updateStats();
        this.updatePowerCooldowns();
    }

    updateStats() {
        const creatureCounts = {
            human: 0,
            elf: 0,
            dwarf: 0,
            orc: 0,
            undead: 0,
            wolf: 0,
            bear: 0,
            deer: 0,
            eagle: 0,
            fish: 0
        };

        this.creatures.forEach(c => {
            if (creatureCounts[c.type] !== undefined) {
                creatureCounts[c.type]++;
            }
        });

        const total = this.creatures.length;

        document.getElementById('populationCount').textContent = total;
        document.getElementById('humanCount').textContent = creatureCounts.human;
        document.getElementById('elfCount').textContent = creatureCounts.elf;
        document.getElementById('dwarfCount').textContent = creatureCounts.dwarf;
        document.getElementById('orcCount').textContent = creatureCounts.orc;
        document.getElementById('undeadCount').textContent = creatureCounts.undead;
        document.getElementById('wolfCount').textContent = creatureCounts.wolf;
        document.getElementById('bearCount').textContent = creatureCounts.bear;
        document.getElementById('deerCount').textContent = creatureCounts.deer;
        document.getElementById('eagleCount').textContent = creatureCounts.eagle;
        document.getElementById('fishCount').textContent = creatureCounts.fish;
        document.getElementById('yearCount').textContent = this.year;
    }

    render() {
        // Increment animation frame
        this.animationFrame = (this.animationFrame + 1) % 12; // 12-frame cycle
        
        // Play/stop background music based on zoom
        this.soundManager.playBackgroundMusic(this.zoom);
        
        // Clear canvas
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Save context for zoom
        this.ctx.save();
        
        // Apply zoom transform with camera offset
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.scale(this.zoom, this.zoom);
        this.ctx.translate(-this.canvas.width / (2 * this.zoom) + this.cameraX, -this.canvas.height / (2 * this.zoom) + this.cameraY);

        // Draw grid
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const tile = this.grid[y][x];
                
                // Draw water for non-rectangular shapes outside valid tiles
                if (!tile.isValidTile) {
                    this.drawWaterTile(x, y);
                    continue;
                }

                const sprite = this.spriteGen.getSprite(tile.type);
                this.ctx.drawImage(
                    sprite,
                    x * this.tileSize,
                    y * this.tileSize,
                    this.tileSize,
                    this.tileSize
                );
            }
        }

        // Draw creatures with animation
        this.creatures.forEach(c => {
            const animFrame = this.animationFrame;
            const offsetX = Math.sin(animFrame * Math.PI / 6) * 0.5;
            const offsetY = Math.cos(animFrame * Math.PI / 6) * 0.3;
            
            const sprite = this.spriteGen.getSprite(c.type);
            this.ctx.drawImage(
                sprite,
                Math.floor(c.x) * this.tileSize + offsetX,
                Math.floor(c.y) * this.tileSize + offsetY,
                this.tileSize,
                this.tileSize
            );

            // Draw health bar for low health
            if (c.health < 50) {
                this.ctx.fillStyle = '#FF0000';
                this.ctx.fillRect(
                    Math.floor(c.x) * this.tileSize + offsetX,
                    Math.floor(c.y) * this.tileSize + offsetY - 3,
                    (this.tileSize * c.health) / 100,
                    2
                );
            }
        });

        // Draw buildings
        this.buildings.forEach(b => {
            const sprite = this.spriteGen.getSprite(b.type);
            this.ctx.drawImage(
                sprite,
                b.x * this.tileSize,
                b.y * this.tileSize,
                this.tileSize * 2,
                this.tileSize * 2
            );

            // Draw building label above
            if (b.type === 'house' && b.population > 0) {
                this.ctx.fillStyle = '#FFD700';
                this.ctx.font = '8px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(
                    b.population,
                    b.x * this.tileSize + this.tileSize / 2,
                    b.y * this.tileSize - 3
                );
            }
        });

        // Draw kingdom structures (castles, towers, walls)
        this.civSystem.kingdoms.forEach(kingdom => {
            kingdom.structures.forEach(structure => {
                const screenX = structure.x * this.tileSize;
                const screenY = structure.y * this.tileSize;

                // Draw structure
                this.ctx.fillStyle = structure.color;
                this.ctx.strokeStyle = '#FFFFFF';
                this.ctx.lineWidth = 2;

                if (structure.type === 'castle') {
                    // Large castle keep
                    this.ctx.fillRect(screenX + 2, screenY + 2, this.tileSize - 4, this.tileSize - 4);
                    this.ctx.strokeRect(screenX + 2, screenY + 2, this.tileSize - 4, this.tileSize - 4);
                    // Castle flags on top
                    this.ctx.fillStyle = '#FFD700';
                    this.ctx.fillRect(screenX + 6, screenY, 4, 4);
                    this.ctx.fillRect(screenX + this.tileSize - 10, screenY, 4, 4);
                } else if (structure.type === 'tower') {
                    // Tower (circular)
                    this.ctx.beginPath();
                    this.ctx.arc(screenX + this.tileSize / 2, screenY + this.tileSize / 2, 6, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.stroke();
                    // Arrow indicator
                    this.ctx.fillStyle = '#FFD700';
                    this.ctx.fillRect(screenX + this.tileSize / 2 - 2, screenY + 2, 4, 3);
                } else if (structure.type === 'wall') {
                    // Wall segment
                    this.ctx.fillRect(screenX + 4, screenY + 4, this.tileSize - 8, this.tileSize - 8);
                    this.ctx.strokeRect(screenX + 4, screenY + 4, this.tileSize - 8, this.tileSize - 8);
                } else if (structure.type === 'hall') {
                    // Meeting hall
                    this.ctx.fillRect(screenX + 3, screenY + 3, this.tileSize - 6, this.tileSize - 6);
                    this.ctx.strokeRect(screenX + 3, screenY + 3, this.tileSize - 6, this.tileSize - 6);
                    // Door
                    this.ctx.fillStyle = '#8B4513';
                    this.ctx.fillRect(screenX + this.tileSize / 2 - 2, screenY + this.tileSize - 4, 4, 4);
                } else if (structure.type === 'house') {
                    // Small house
                    this.ctx.fillRect(screenX + 4, screenY + 4, this.tileSize - 8, this.tileSize - 8);
                    this.ctx.strokeRect(screenX + 4, screenY + 4, this.tileSize - 8, this.tileSize - 8);
                    // Window
                    this.ctx.fillStyle = '#87CEEB';
                    this.ctx.fillRect(screenX + 6, screenY + 6, 3, 3);
                }

                // Draw health bar if damaged
                if (structure.health < structure.maxHealth) {
                    const healthPercent = structure.health / structure.maxHealth;
                    this.ctx.fillStyle = '#FF0000';
                    this.ctx.fillRect(screenX, screenY - 4, this.tileSize * healthPercent, 2);
                    this.ctx.strokeStyle = '#FFFFFF';
                    this.ctx.strokeRect(screenX, screenY - 4, this.tileSize, 2);
                }
            });
        });

        // Draw vehicles
        this.vehicles.forEach(v => {
            const sprite = this.spriteGen.getSprite(v.type);
            this.ctx.save();
            this.ctx.translate(v.x * this.tileSize + this.tileSize / 2, v.y * this.tileSize + this.tileSize / 2);
            this.ctx.rotate(v.direction);
            this.ctx.drawImage(
                sprite,
                -this.tileSize / 2,
                -this.tileSize / 2,
                this.tileSize,
                this.tileSize
            );
            this.ctx.restore();
        });

        // Draw weapons
        this.weapons.forEach(w => {
            const sprite = this.spriteGen.getSprite(w.type);
            this.ctx.drawImage(
                sprite,
                w.x * this.tileSize,
                w.y * this.tileSize,
                this.tileSize,
                this.tileSize
            );
        });

        // Draw particles
        this.particles.forEach(p => {
            const alpha = p.life / 30;
            if (p.type === 'fire') {
                this.ctx.fillStyle = `rgba(255, 107, 53, ${alpha})`;
            } else if (p.type === 'spark') {
                this.ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
            } else if (p.type === 'water') {
                this.ctx.fillStyle = `rgba(33, 150, 243, ${alpha})`;
            } else if (p.type === 'snow') {
                this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            } else if (p.type === 'dust') {
                this.ctx.fillStyle = `rgba(200, 150, 100, ${alpha})`;
            }
            this.ctx.fillRect(p.x * this.tileSize + 4, p.y * this.tileSize + 4, 8, 8);
        });
        
        // Restore context from zoom
        this.ctx.restore();

        // Update FPS
        this.frameCount++;
        const now = Date.now();
        if (now - this.lastFpsTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsTime = now;
        }
        document.getElementById('fpsInfo').textContent = `FPS: ${this.fps} | Zoom: ${this.zoom.toFixed(1)}x`;
    }

    // Draw static water tile for void areas
    drawWaterTile(x, y) {
        // Use base pattern that doesn't animate (position-based only)
        const waterShades = ['#1565C0', '#1976D2', '#1E88E5', '#2196F3'];
        const shade = waterShades[(x + y) % waterShades.length];
        
        this.ctx.fillStyle = shade;
        this.ctx.fillRect(x * this.tileSize, y * this.tileSize, this.tileSize, this.tileSize);
        
        // Draw static wave pattern based on position
        this.ctx.fillStyle = '#0D47A1';
        const wavePattern = (x + y) % 4;
        for (let i = 0; i < 4; i++) {
            const offset = (i + wavePattern) % 4;
            this.ctx.fillRect(x * this.tileSize, y * this.tileSize + offset * 4, this.tileSize, 2);
        }
    }

    createExplosionParticles(x, y, count = 10) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 3 + 2;
            
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 60,
                maxLife: 60,
                type: 'explosion',
                size: Math.random() * 2 + 1,
                color: '#FF6600'
            });
        }
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseBtn = document.querySelector('[data-tool="pause"]');
        pauseBtn.classList.toggle('active', this.isPaused);
        pauseBtn.textContent = this.isPaused ? '▶️ Resume' : '⏸️ Pause';
    }

    toggleSpeed() {
        // Cycle through speeds
        const speeds = [0.5, 1, 2, 3];
        const currentIndex = speeds.indexOf(this.gameSpeed);
        const nextIndex = (currentIndex + 1) % speeds.length;
        this.gameSpeed = speeds[nextIndex];
        document.getElementById('speed').value = this.gameSpeed;
        document.getElementById('speedDisplay').textContent = this.gameSpeed + 'x';
    }

    clearWorld() {
        this.initializeGrid();
        this.creatures = [];
        this.particles = [];
        this.year = 0;
    }

    reset() {
        this.clearWorld();
        this.generateTerrain();
    }

    checkAndCreateAutoKingdom(race) {
        // Find all creatures of this race not in a kingdom
        const unKingdomedCreatures = this.creatures.filter(c => 
            c.type === race && !c.kingdom
        );

        // Group nearby creatures together
        const clusters = [];
        const processed = new Set();

        unKingdomedCreatures.forEach(creature => {
            if (processed.has(creature)) return;

            const cluster = [creature];
            processed.add(creature);

            // Find all nearby creatures (within distance of 30 tiles)
            unKingdomedCreatures.forEach(other => {
                if (processed.has(other)) return;
                const dist = Math.hypot(creature.x - other.x, creature.y - other.y);
                if (dist < 30) {
                    cluster.push(other);
                    processed.add(other);
                }
            });

            if (cluster.length >= 5) { // Need at least 5 creatures to form kingdom
                clusters.push(cluster);
            }
        });

        // Create kingdom for each viable cluster
        clusters.forEach(cluster => {
            // Calculate cluster center
            const centerX = cluster.reduce((sum, c) => sum + c.x, 0) / cluster.length;
            const centerY = cluster.reduce((sum, c) => sum + c.y, 0) / cluster.length;

            // Check if kingdom already exists at this location
            const existingKingdom = this.civSystem.kingdoms.find(k => 
                k.race === race && 
                Math.hypot(k.centerX - centerX, k.centerY - centerY) < 40
            );

            if (!existingKingdom) {
                // Create new kingdom for this cluster
                const newKingdom = this.civSystem.createKingdom(
                    Math.round(centerX), 
                    Math.round(centerY), 
                    race
                );

                // Assign all creatures in cluster to kingdom
                cluster.forEach(creature => {
                    this.civSystem.assignCreatureToKingdom(creature, newKingdom);
                });
            }
        });
    }

    getTerritoryTiles(kingdomId) {
        const territory = [];
        const kingdom = this.civSystem.kingdoms.find(k => k.id === kingdomId);
        if (!kingdom) return territory;

        // Find all tiles that belong to kingdom (within distance)
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const dist = Math.hypot(x - kingdom.centerX, y - kingdom.centerY);
                if (dist < 40) { // Territory radius
                    territory.push({ x, y });
                }
            }
        }
        return territory;
    }

    startGameLoop() {
        const updateGame = () => {
            // Update multiple times per frame based on game speed
            const updates = Math.floor(this.gameSpeed);
            for (let i = 0; i < updates; i++) {
                this.updateGame();
            }

            this.render();
            requestAnimationFrame(updateGame);
        };

        updateGame();
    }
}

// Initialize game when page loads
window.addEventListener('DOMContentLoaded', () => {
    let selectedSize = 'medium';
    let selectedShape = 'rectangular';
    
    // Setup launcher buttons for size
    document.querySelectorAll('[data-size]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-size]').forEach(b => {
                b.style.backgroundColor = '';
                b.style.color = '';
                b.style.borderColor = '';
                b.classList.remove('selected');
            });
            btn.style.backgroundColor = '#4CAF50';
            btn.style.color = '#000';
            btn.style.borderColor = '#4CAF50';
            btn.classList.add('selected');
            selectedSize = btn.dataset.size;
        });
    });
    
    // Setup launcher buttons for shape
    document.querySelectorAll('[data-shape]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('[data-shape]').forEach(b => {
                b.style.backgroundColor = '';
                b.style.color = '';
                b.style.borderColor = '';
                b.classList.remove('selected');
            });
            btn.style.backgroundColor = '#4CAF50';
            btn.style.color = '#000';
            btn.style.borderColor = '#4CAF50';
            btn.classList.add('selected');
            selectedShape = btn.dataset.shape;
        });
    });
    
    // Start game button
    document.getElementById('startGameBtn').addEventListener('click', () => {
        // Save settings
        sessionStorage.setItem('gameSettings', JSON.stringify({
            worldSize: selectedSize,
            worldShape: selectedShape
        }));
        
        // Hide launcher and show game
        document.getElementById('launcherScreen').style.display = 'none';
        document.getElementById('gameScreen').style.display = 'block';
        
        // Initialize game
        const game = WorldboxGame.getInstance();
    });
});
