// Main Game Logic
class WorldboxGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size
        this.canvas.width = 1000;
        this.canvas.height = 600;
        
        // Game state
        this.tileSize = 16;
        this.gridWidth = Math.floor(this.canvas.width / this.tileSize);
        this.gridHeight = Math.floor(this.canvas.height / this.tileSize);
        
        this.grid = [];
        this.creatures = [];
        this.particles = [];
        
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
        
        this.initializeGrid();
        this.setupEventListeners();
        this.setupUI();
        this.startGameLoop();
    }

    initializeGrid() {
        this.grid = [];
        for (let y = 0; y < this.gridHeight; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.gridWidth; x++) {
                this.grid[y][x] = {
                    type: 'grass',
                    height: 0,
                    temperature: 70,
                    humidity: 50,
                    hasForest: false,
                    isMountain: false
                };
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

        // Tool buttons
        document.querySelector('[data-tool="pause"]').addEventListener('click', () => this.togglePause());
        document.querySelector('[data-tool="speed"]').addEventListener('click', () => this.toggleSpeed());

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
        document.querySelector('[data-brush="grass"]').classList.add('selected');
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
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const gridX = Math.floor(x / this.tileSize);
        const gridY = Math.floor(y / this.tileSize);

        if (this.currentCreature) {
            this.spawnCreature(gridX, gridY, this.currentCreature, 5);
        } else if (this.currentHazard) {
            this.triggerHazard(gridX, gridY, this.currentHazard);
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

            this.creatures.push({
                x: gridX,
                y: gridY,
                type: type,
                age: 0,
                energy: 100,
                speed: Math.random() * 0.5 + 0.5,
                direction: Math.random() * Math.PI * 2,
                health: 100
            });
        }
    }

    triggerHazard(x, y, hazard) {
        const radius = 10;

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

    generateTerrain() {
        this.initializeGrid();

        // Generate basic terrain with Perlin-like noise (simplified)
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
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

        // Spawn initial creatures
        const creatureTypes = ['human', 'elf', 'dwarf', 'orc'];
        creatureTypes.forEach(type => {
            for (let i = 0; i < 3; i++) {
                const x = Math.floor(Math.random() * this.gridWidth);
                const y = Math.floor(Math.random() * this.gridHeight);
                this.spawnCreature(x, y, type, 2);
            }
        });
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

            c.x += Math.cos(c.direction) * c.speed;
            c.y += Math.sin(c.direction) * c.speed;

            // Keep creatures in bounds
            c.x = Math.max(0, Math.min(this.gridWidth - 1, c.x));
            c.y = Math.max(0, Math.min(this.gridHeight - 1, c.y));

            // Death conditions
            if (c.energy <= 0 || c.age > 1000 || c.health <= 0) {
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

        // Update year counter
        if (this.updateCounter % 60 === 0) {
            this.year++;
        }

        this.updateStats();
    }

    updateStats() {
        const creatureCounts = {
            human: 0,
            elf: 0,
            dwarf: 0,
            orc: 0,
            undead: 0
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
        document.getElementById('yearCount').textContent = this.year;
    }

    render() {
        // Clear canvas
        this.ctx.fillStyle = '#0a0a0a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid
        for (let y = 0; y < this.gridHeight; y++) {
            for (let x = 0; x < this.gridWidth; x++) {
                const tile = this.grid[y][x];
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

        // Draw creatures
        this.creatures.forEach(c => {
            const sprite = this.spriteGen.getSprite(c.type);
            this.ctx.drawImage(
                sprite,
                Math.floor(c.x) * this.tileSize,
                Math.floor(c.y) * this.tileSize,
                this.tileSize,
                this.tileSize
            );

            // Draw health bar for low health
            if (c.health < 50) {
                this.ctx.fillStyle = '#FF0000';
                this.ctx.fillRect(
                    Math.floor(c.x) * this.tileSize,
                    Math.floor(c.y) * this.tileSize - 3,
                    (this.tileSize * c.health) / 100,
                    2
                );
            }
        });

        // Draw particles
        this.particles.forEach(p => {
            const alpha = p.life / 30;
            if (p.type === 'fire') {
                this.ctx.fillStyle = `rgba(255, 107, 53, ${alpha})`;
            } else if (p.type === 'spark') {
                this.ctx.fillStyle = `rgba(255, 255, 0, ${alpha})`;
            }
            this.ctx.fillRect(p.x * this.tileSize + 4, p.y * this.tileSize + 4, 8, 8);
        });

        // Update FPS
        this.frameCount++;
        const now = Date.now();
        if (now - this.lastFpsTime >= 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsTime = now;
        }
        document.getElementById('fpsInfo').textContent = `FPS: ${this.fps}`;
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
    new WorldboxGame();
});
