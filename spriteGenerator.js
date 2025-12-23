// Sprite Generator - Creates pixelated 2D sprites
class SpriteGenerator {
    constructor(pixelSize = 16) {
        this.pixelSize = pixelSize;
        this.sprites = {};
        this.generateAllSprites();
        this.loadCustomSprites();
    }

    loadCustomSprites() {
        // Load custom sprites from localStorage
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('sprite_')) {
                try {
                    const spriteData = JSON.parse(localStorage.getItem(key));
                    const sprite = this.buildSpriteFromData(spriteData);
                    this.sprites[spriteData.name] = sprite;
                } catch (e) {
                    console.error('Error loading custom sprite:', e);
                }
            }
        });
    }

    buildSpriteFromData(data) {
        const canvas = document.createElement('canvas');
        canvas.width = data.width * 16;
        canvas.height = data.height * 16;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        Object.entries(data.pixels || {}).forEach(([key, color]) => {
            const [x, y] = key.split(',').map(Number);
            ctx.fillStyle = color;
            ctx.fillRect(x * 16, y * 16, 16, 16);
        });

        return canvas;
    }

    generateAllSprites() {
        // Terrain sprites
        this.sprites.grass = this.generateGrass();
        this.sprites.dirt = this.generateDirt();
        this.sprites.stone = this.generateStone();
        this.sprites.sand = this.generateSand();
        this.sprites.water = this.generateWater();
        this.sprites.lava = this.generateLava();
        this.sprites.forest = this.generateForest();
        this.sprites.mountain = this.generateMountain();

        // Building sprites
        this.sprites.house = this.generateHouse();
        this.sprites.road = this.generateRoad();
        this.sprites.townhall = this.generateTownHall();
        this.sprites.farm = this.generateFarm();
        this.sprites.tower = this.generateTower();
        this.sprites.castle = this.generateCastle();
        this.sprites.market = this.generateMarket();
        this.sprites.temple = this.generateTemple();

        // Vehicle and transportation sprites
        this.sprites.boat = this.generateBoat();
        this.sprites.car = this.generateCar();

        // Weapon sprites
        this.sprites.sword = this.generateSword();
        this.sprites.axe = this.generateAxe();
        this.sprites.bow = this.generateBow();

        // Humanoid creature sprites
        this.sprites.human = this.generateHuman();
        this.sprites.elf = this.generateElf();
        this.sprites.dwarf = this.generateDwarf();
        this.sprites.orc = this.generateOrc();
        this.sprites.undead = this.generateUndead();
        
        // Animal sprites
        this.sprites.wolf = this.generateWolf();
        this.sprites.bear = this.generateBear();
        this.sprites.deer = this.generateDeer();
        this.sprites.eagle = this.generateEagle();
        this.sprites.fish = this.generateFish();
        
        // Special creatures
        this.sprites.dragon = this.generateDragon();
    }

    createCanvas(width = 16, height = 16) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    // Terrain generators
    generateGrass() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        // Base green
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(0, 0, 16, 16);

        // Add darker spots for grass texture
        ctx.fillStyle = '#388E3C';
        for (let i = 0; i < 8; i++) {
            const x = Math.random() * 16;
            const y = Math.random() * 16;
            ctx.fillRect(x, y, 2, 2);
        }

        // Add light spots
        ctx.fillStyle = '#81C784';
        for (let i = 0; i < 4; i++) {
            const x = Math.random() * 16;
            const y = Math.random() * 16;
            ctx.fillRect(x, y, 1, 1);
        }

        return canvas;
    }

    generateDirt() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#8B7355';
        ctx.fillRect(0, 0, 16, 16);

        // Add texture
        ctx.fillStyle = '#A0826D';
        for (let i = 0; i < 10; i++) {
            const x = Math.random() * 16;
            const y = Math.random() * 16;
            ctx.fillRect(x, y, 1, 1);
        }

        ctx.fillStyle = '#6D5A47';
        for (let i = 0; i < 6; i++) {
            const x = Math.random() * 16;
            const y = Math.random() * 16;
            ctx.fillRect(x, y, 1, 1);
        }

        return canvas;
    }

    generateStone() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, 16, 16);

        // Add cracks
        ctx.strokeStyle = '#4A4A4A';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(2, 0);
        ctx.lineTo(8, 16);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(12, 0);
        ctx.lineTo(6, 16);
        ctx.stroke();

        // Add highlights
        ctx.fillStyle = '#A9A9A9';
        ctx.fillRect(0, 0, 4, 4);
        ctx.fillRect(12, 12, 4, 4);

        return canvas;
    }

    generateSand() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#F4A460';
        ctx.fillRect(0, 0, 16, 16);

        // Add sandy texture
        ctx.fillStyle = '#E09447';
        for (let i = 0; i < 12; i++) {
            const x = Math.random() * 16;
            const y = Math.random() * 16;
            ctx.fillRect(x, y, 1, 1);
        }

        ctx.fillStyle = '#FFD89B';
        for (let i = 0; i < 5; i++) {
            const x = Math.random() * 16;
            const y = Math.random() * 16;
            ctx.fillRect(x, y, 1, 1);
        }

        return canvas;
    }

    generateWater() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#2196F3';
        ctx.fillRect(0, 0, 16, 16);

        // Water waves
        ctx.fillStyle = '#1976D2';
        ctx.fillRect(0, 2, 16, 2);
        ctx.fillRect(0, 6, 16, 2);
        ctx.fillRect(0, 10, 16, 2);

        // Highlights
        ctx.fillStyle = '#64B5F6';
        ctx.fillRect(2, 0, 3, 1);
        ctx.fillRect(8, 3, 3, 1);
        ctx.fillRect(13, 7, 3, 1);

        return canvas;
    }

    generateLava() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#FF6B35';
        ctx.fillRect(0, 0, 16, 16);

        // Lava patterns
        ctx.fillStyle = '#FF8A50';
        for (let i = 0; i < 6; i++) {
            const x = Math.random() * 16;
            const y = Math.random() * 16;
            ctx.fillRect(x, y, 2, 2);
        }

        // Dark spots
        ctx.fillStyle = '#D63F1F';
        for (let i = 0; i < 4; i++) {
            const x = Math.random() * 16;
            const y = Math.random() * 16;
            ctx.fillRect(x, y, 1, 1);
        }

        return canvas;
    }

    generateForest() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        // Base grass
        ctx.fillStyle = '#388E3C';
        ctx.fillRect(0, 0, 16, 16);

        // Tree top
        ctx.fillStyle = '#1B5E20';
        ctx.fillRect(6, 2, 4, 7);
        ctx.fillRect(5, 5, 6, 2);

        // Trunk
        ctx.fillStyle = '#8B6F47';
        ctx.fillRect(7, 8, 2, 8);

        return canvas;
    }

    generateMountain() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        // Grey mountain base
        ctx.fillStyle = '#696969';
        ctx.beginPath();
        ctx.moveTo(8, 3);
        ctx.lineTo(14, 12);
        ctx.lineTo(2, 12);
        ctx.fill();

        // White snow peak
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(8, 3);
        ctx.lineTo(11, 7);
        ctx.lineTo(5, 7);
        ctx.fill();

        return canvas;
    }

    // Building sprites
    generateHouse() {
        const canvas = this.createCanvas(32, 32);
        const ctx = canvas.getContext('2d');

        // Shadow
        ctx.fillStyle = '#2a1a1a';
        ctx.fillRect(8, 26, 18, 4);

        // Foundation (stone base)
        ctx.fillStyle = '#5a4a3a';
        ctx.fillRect(6, 22, 20, 6);
        ctx.fillStyle = '#6a5a4a';
        ctx.fillRect(7, 23, 18, 4);

        // Main walls (warm wood)
        ctx.fillStyle = '#b8956a';
        ctx.fillRect(6, 12, 20, 10);
        
        // Wall highlights
        ctx.fillStyle = '#d4a574';
        ctx.fillRect(7, 12, 2, 10);
        ctx.fillRect(14, 12, 4, 10);
        
        // Wall shadow
        ctx.fillStyle = '#8b7355';
        ctx.fillRect(24, 12, 2, 10);

        // Window frame left
        ctx.fillStyle = '#654321';
        ctx.fillRect(8, 14, 5, 4);
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(9, 15, 3, 2);
        ctx.fillStyle = '#aaddff';
        ctx.fillRect(9, 15, 1, 1);

        // Window frame right
        ctx.fillStyle = '#654321';
        ctx.fillRect(19, 14, 5, 4);
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(20, 15, 3, 2);
        ctx.fillStyle = '#aaddff';
        ctx.fillRect(20, 15, 1, 1);

        // Door
        ctx.fillStyle = '#4a2a1a';
        ctx.fillRect(13, 16, 6, 6);
        ctx.fillStyle = '#5a3a2a';
        ctx.fillRect(14, 17, 4, 4);
        
        // Door handle
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(16, 19, 1, 1);

        // Roof (triangular with shingles)
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.moveTo(3, 12);
        ctx.lineTo(16, 2);
        ctx.lineTo(29, 12);
        ctx.fill();

        // Roof highlight (left side lit)
        ctx.fillStyle = '#a05a2a';
        ctx.beginPath();
        ctx.moveTo(4, 12);
        ctx.lineTo(16, 3);
        ctx.lineTo(16, 12);
        ctx.fill();

        // Roof shadow (right side)
        ctx.fillStyle = '#6a3a1a';
        ctx.beginPath();
        ctx.moveTo(16, 3);
        ctx.lineTo(28, 12);
        ctx.lineTo(16, 12);
        ctx.fill();

        // Roof edge
        ctx.fillStyle = '#5a2a0a';
        ctx.fillRect(3, 11, 26, 2);

        // Chimney
        ctx.fillStyle = '#654321';
        ctx.fillRect(22, 4, 4, 6);
        ctx.fillStyle = '#7a5331';
        ctx.fillRect(23, 4, 2, 5);
        
        // Smoke
        ctx.fillStyle = '#aaaaaa';
        ctx.fillRect(23, 2, 2, 2);
        ctx.fillStyle = '#888888';
        ctx.fillRect(24, 0, 1, 2);

        return canvas;
    }

    generateRoad() {
        const canvas = this.createCanvas(32, 32);
        const ctx = canvas.getContext('2d');

        // Base grass
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(0, 0, 32, 32);

        // Road - light brown color
        ctx.fillStyle = '#D2B48C';
        ctx.fillRect(4, 12, 24, 8);

        // Road edge detail - darker brown
        ctx.fillStyle = '#A0826D';
        ctx.fillRect(4, 12, 24, 2);
        ctx.fillRect(4, 18, 24, 2);

        return canvas;
    }

    generateTownHall() {
        const canvas = this.createCanvas(32, 32);
        const ctx = canvas.getContext('2d');

        // Shadow
        ctx.fillStyle = '#2a1a1a';
        ctx.fillRect(4, 28, 24, 4);

        // Foundation (stone base)
        ctx.fillStyle = '#5a5a6a';
        ctx.fillRect(2, 24, 28, 8);
        ctx.fillStyle = '#6a6a7a';
        ctx.fillRect(3, 25, 26, 6);

        // Main walls (stone/marble)
        ctx.fillStyle = '#c0b8a8';
        ctx.fillRect(2, 10, 28, 14);
        
        // Wall highlight
        ctx.fillStyle = '#d0c8b8';
        ctx.fillRect(3, 10, 4, 14);
        
        // Wall shadow
        ctx.fillStyle = '#a09888';
        ctx.fillRect(26, 10, 4, 14);

        // Pillars (columns)
        ctx.fillStyle = '#d8d0c0';
        ctx.fillRect(4, 10, 3, 14);
        ctx.fillRect(12, 10, 3, 14);
        ctx.fillRect(17, 10, 3, 14);
        ctx.fillRect(25, 10, 3, 14);
        
        // Pillar highlights
        ctx.fillStyle = '#e8e0d0';
        ctx.fillRect(4, 10, 1, 14);
        ctx.fillRect(12, 10, 1, 14);
        ctx.fillRect(17, 10, 1, 14);
        ctx.fillRect(25, 10, 1, 14);

        // Grand doors (2 arched)
        ctx.fillStyle = '#5a3a2a';
        ctx.fillRect(8, 16, 5, 8);
        ctx.fillRect(19, 16, 5, 8);
        
        // Door arches
        ctx.fillStyle = '#6a4a3a';
        ctx.beginPath();
        ctx.arc(10.5, 16, 2.5, Math.PI, 0);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(21.5, 16, 2.5, Math.PI, 0);
        ctx.fill();
        
        // Door handles
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(9, 20, 1, 1);
        ctx.fillRect(11, 20, 1, 1);
        ctx.fillRect(20, 20, 1, 1);
        ctx.fillRect(22, 20, 1, 1);

        // Windows (upper, arched)
        ctx.fillStyle = '#3a3a4a';
        ctx.fillRect(8, 11, 4, 4);
        ctx.fillRect(20, 11, 4, 4);
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(9, 12, 2, 2);
        ctx.fillRect(21, 12, 2, 2);
        ctx.fillStyle = '#aaddff';
        ctx.fillRect(9, 12, 1, 1);
        ctx.fillRect(21, 12, 1, 1);

        // Roof (grand triangular pediment)
        ctx.fillStyle = '#4a4a5a';
        ctx.beginPath();
        ctx.moveTo(0, 10);
        ctx.lineTo(16, 0);
        ctx.lineTo(32, 10);
        ctx.fill();
        
        // Roof highlight
        ctx.fillStyle = '#5a5a6a';
        ctx.beginPath();
        ctx.moveTo(1, 10);
        ctx.lineTo(16, 1);
        ctx.lineTo(16, 10);
        ctx.fill();
        
        // Roof shadow
        ctx.fillStyle = '#3a3a4a';
        ctx.beginPath();
        ctx.moveTo(16, 1);
        ctx.lineTo(31, 10);
        ctx.lineTo(16, 10);
        ctx.fill();

        // Roof edge trim
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(0, 9, 32, 2);

        // Central emblem
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(14, 4, 4, 4);
        ctx.fillStyle = '#FF8800';
        ctx.fillRect(15, 5, 2, 2);

        // Flag pole and flag
        ctx.fillStyle = '#4a3a2a';
        ctx.fillRect(15, 0, 2, 5);
        ctx.fillStyle = '#8B0000';
        ctx.fillRect(17, 0, 5, 3);
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(18, 1, 3, 1);

        return canvas;
    }

    generateFarm() {
        const canvas = this.createCanvas(32, 32);
        const ctx = canvas.getContext('2d');

        // Base field (brown dirt with texture)
        ctx.fillStyle = '#6a5020';
        ctx.fillRect(0, 0, 32, 32);
        
        // Dirt texture variation
        ctx.fillStyle = '#7a6030';
        for (let i = 0; i < 8; i++) {
            ctx.fillRect((i * 5) % 32, (i * 7) % 32, 3, 2);
        }

        // Crop rows (different greens)
        ctx.fillStyle = '#228B22';
        for (let i = 0; i < 4; i++) {
            ctx.fillRect(0, i * 8 + 2, 32, 3);
        }
        ctx.fillStyle = '#32CD32';
        for (let i = 0; i < 4; i++) {
            ctx.fillRect(2, i * 8 + 2, 28, 1);
        }

        // Barn shadow
        ctx.fillStyle = '#3a2010';
        ctx.fillRect(5, 16, 14, 3);

        // Barn (red with detail)
        ctx.fillStyle = '#8B0000';
        ctx.fillRect(2, 4, 14, 14);
        ctx.fillStyle = '#B22222';
        ctx.fillRect(3, 5, 12, 12);
        
        // Barn highlight
        ctx.fillStyle = '#DC143C';
        ctx.fillRect(3, 5, 2, 12);

        // Barn roof (dark red with angle)
        ctx.fillStyle = '#5a0000';
        ctx.beginPath();
        ctx.moveTo(0, 4);
        ctx.lineTo(9, 0);
        ctx.lineTo(18, 4);
        ctx.fill();
        
        ctx.fillStyle = '#6a0000';
        ctx.beginPath();
        ctx.moveTo(1, 4);
        ctx.lineTo(9, 1);
        ctx.lineTo(9, 4);
        ctx.fill();

        // Barn door (large brown doors)
        ctx.fillStyle = '#4a2a10';
        ctx.fillRect(5, 8, 8, 9);
        ctx.fillStyle = '#5a3a20';
        ctx.fillRect(5, 8, 4, 8);
        
        // Door cross beams
        ctx.fillStyle = '#3a1a00';
        ctx.fillRect(5, 11, 8, 1);
        ctx.fillRect(8, 8, 2, 9);

        // Silo (cylinder with detail)
        ctx.fillStyle = '#708090';
        ctx.fillRect(20, 6, 10, 18);
        ctx.fillStyle = '#8898a8';
        ctx.fillRect(21, 7, 8, 16);
        ctx.fillStyle = '#a0b0c0';
        ctx.fillRect(21, 7, 2, 16);
        
        // Silo bands
        ctx.fillStyle = '#506070';
        ctx.fillRect(20, 10, 10, 1);
        ctx.fillRect(20, 16, 10, 1);
        ctx.fillRect(20, 22, 10, 1);

        // Silo top (dome)
        ctx.fillStyle = '#4a5a6a';
        ctx.beginPath();
        ctx.arc(25, 6, 5, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#5a6a7a';
        ctx.beginPath();
        ctx.arc(24, 6, 4, Math.PI, 0);
        ctx.fill();

        // Hay bales
        ctx.fillStyle = '#DAA520';
        ctx.fillRect(18, 26, 4, 4);
        ctx.fillRect(24, 28, 3, 3);
        ctx.fillStyle = '#F0C040';
        ctx.fillRect(19, 27, 2, 2);

        return canvas;
    }

    generateTower() {
        const canvas = this.createCanvas(32, 32);
        const ctx = canvas.getContext('2d');

        // Shadow
        ctx.fillStyle = '#1a1a2a';
        ctx.fillRect(6, 28, 20, 4);

        // Tower base (grey stone)
        ctx.fillStyle = '#5a5a6a';
        ctx.fillRect(6, 8, 20, 24);
        
        // Tower wall depth
        ctx.fillStyle = '#6a6a7a';
        ctx.fillRect(7, 9, 18, 22);
        
        // Wall highlight
        ctx.fillStyle = '#7a7a8a';
        ctx.fillRect(7, 9, 3, 22);
        
        // Wall shadow
        ctx.fillStyle = '#4a4a5a';
        ctx.fillRect(22, 9, 3, 22);

        // Tower windows (lit)
        ctx.fillStyle = '#2a1a3a';
        ctx.fillRect(10, 12, 5, 6);
        ctx.fillRect(17, 12, 5, 6);
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(11, 13, 3, 4);
        ctx.fillRect(18, 13, 3, 4);
        ctx.fillStyle = '#FFEE88';
        ctx.fillRect(11, 13, 1, 2);
        ctx.fillRect(18, 13, 1, 2);
        
        // Lower windows
        ctx.fillStyle = '#2a1a3a';
        ctx.fillRect(10, 22, 5, 5);
        ctx.fillRect(17, 22, 5, 5);
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(11, 23, 3, 3);
        ctx.fillRect(18, 23, 3, 3);

        // Crenellations (top)
        ctx.fillStyle = '#5a5a6a';
        ctx.fillRect(6, 6, 4, 4);
        ctx.fillRect(12, 6, 4, 4);
        ctx.fillRect(18, 6, 4, 4);
        ctx.fillRect(22, 6, 4, 4);

        // Pointed roof peak
        ctx.fillStyle = '#3a3a4a';
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(22, 6);
        ctx.lineTo(10, 6);
        ctx.fill();
        
        ctx.fillStyle = '#4a4a5a';
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(16, 6);
        ctx.lineTo(10, 6);
        ctx.fill();

        // Flag on top
        ctx.fillStyle = '#654321';
        ctx.fillRect(15, 0, 2, 3);
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(17, 0, 5, 3);
        ctx.fillStyle = '#FF8800';
        ctx.fillRect(18, 1, 3, 1);

        // Door at bottom
        ctx.fillStyle = '#4a2a1a';
        ctx.fillRect(13, 26, 6, 6);
        ctx.fillStyle = '#3a1a0a';
        ctx.fillRect(14, 27, 4, 4);
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(16, 29, 1, 1);

        return canvas;
    }

    generateCastle() {
        const canvas = this.createCanvas(32, 32);
        const ctx = canvas.getContext('2d');

        // Shadow
        ctx.fillStyle = '#1a1a2a';
        ctx.fillRect(2, 28, 28, 4);

        // Main castle base (dark stone)
        ctx.fillStyle = '#4a4a5a';
        ctx.fillRect(4, 16, 24, 14);
        
        // Castle walls with depth
        ctx.fillStyle = '#6a6a7a';
        ctx.fillRect(5, 17, 22, 12);
        
        // Wall highlight
        ctx.fillStyle = '#7a7a8a';
        ctx.fillRect(5, 17, 3, 12);
        
        // Wall shadow
        ctx.fillStyle = '#3a3a4a';
        ctx.fillRect(24, 17, 3, 12);

        // Main gate arch
        ctx.fillStyle = '#2a2a3a';
        ctx.fillRect(11, 20, 10, 10);
        ctx.fillStyle = '#3a3a4a';
        ctx.beginPath();
        ctx.arc(16, 20, 5, Math.PI, 0);
        ctx.fill();

        // Gate door
        ctx.fillStyle = '#5a3a2a';
        ctx.fillRect(12, 22, 8, 8);
        ctx.fillStyle = '#4a2a1a';
        ctx.fillRect(12, 22, 4, 8);
        
        // Gate details (metal bands)
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(12, 24, 8, 1);
        ctx.fillRect(12, 27, 8, 1);
        
        // Gate handles
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(14, 25, 1, 2);
        ctx.fillRect(17, 25, 1, 2);

        // Left tower
        ctx.fillStyle = '#5a5a6a';
        ctx.fillRect(0, 6, 10, 26);
        ctx.fillStyle = '#6a6a7a';
        ctx.fillRect(1, 7, 8, 24);
        ctx.fillStyle = '#7a7a8a';
        ctx.fillRect(1, 7, 2, 24);
        
        // Left tower crenellations
        ctx.fillStyle = '#4a4a5a';
        ctx.fillRect(0, 4, 3, 4);
        ctx.fillRect(4, 4, 3, 4);
        ctx.fillRect(7, 4, 3, 4);
        
        // Left tower windows
        ctx.fillStyle = '#2a1a3a';
        ctx.fillRect(3, 10, 4, 5);
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(4, 11, 2, 3);
        ctx.fillRect(3, 20, 4, 4);
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(4, 21, 2, 2);

        // Right tower
        ctx.fillStyle = '#5a5a6a';
        ctx.fillRect(22, 6, 10, 26);
        ctx.fillStyle = '#6a6a7a';
        ctx.fillRect(23, 7, 8, 24);
        ctx.fillStyle = '#4a4a5a';
        ctx.fillRect(29, 7, 2, 24);
        
        // Right tower crenellations
        ctx.fillStyle = '#4a4a5a';
        ctx.fillRect(22, 4, 3, 4);
        ctx.fillRect(26, 4, 3, 4);
        ctx.fillRect(29, 4, 3, 4);
        
        // Right tower windows
        ctx.fillStyle = '#2a1a3a';
        ctx.fillRect(25, 10, 4, 5);
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(26, 11, 2, 3);
        ctx.fillRect(25, 20, 4, 4);
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(26, 21, 2, 2);

        // Center top crenellations
        ctx.fillStyle = '#4a4a5a';
        ctx.fillRect(10, 14, 3, 3);
        ctx.fillRect(15, 14, 3, 3);
        ctx.fillRect(19, 14, 3, 3);

        // Flags on towers
        ctx.fillStyle = '#8B0000';
        ctx.fillRect(4, 0, 1, 5);
        ctx.fillRect(5, 0, 4, 3);
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(5, 0, 3, 2);
        
        ctx.fillStyle = '#8B0000';
        ctx.fillRect(27, 0, 1, 5);
        ctx.fillRect(28, 0, 4, 3);
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(28, 0, 3, 2);

        // Center banner
        ctx.fillStyle = '#4a2a1a';
        ctx.fillRect(15, 8, 2, 6);
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(13, 8, 6, 4);
        ctx.fillStyle = '#FF6600';
        ctx.fillRect(14, 9, 4, 2);

        return canvas;
    }

    generateMarket() {
        const canvas = this.createCanvas(32, 32);
        const ctx = canvas.getContext('2d');

        // Ground (cobblestone)
        ctx.fillStyle = '#6a6070';
        ctx.fillRect(0, 20, 32, 12);
        ctx.fillStyle = '#7a7080';
        for (let i = 0; i < 8; i++) {
            ctx.fillRect((i * 5) % 30, 22 + (i % 3) * 3, 3, 2);
        }

        // Market stalls base (wooden counter)
        ctx.fillStyle = '#6a4a30';
        ctx.fillRect(0, 16, 32, 6);
        ctx.fillStyle = '#8a6a50';
        ctx.fillRect(1, 17, 30, 4);
        
        // Counter highlight
        ctx.fillStyle = '#9a7a60';
        ctx.fillRect(1, 17, 30, 1);

        // Tent canopies (colorful striped awnings)
        const colors = [
            ['#DC143C', '#ff4060'],  // Red
            ['#DAA520', '#ffc040'],  // Gold
            ['#228B22', '#40b040'],  // Green
            ['#4169E1', '#6090ff']   // Blue
        ];
        
        for (let i = 0; i < 4; i++) {
            // Tent pole
            ctx.fillStyle = '#5a3a20';
            ctx.fillRect(i * 8 + 3, 8, 2, 8);
            
            // Awning
            ctx.fillStyle = colors[i][0];
            ctx.beginPath();
            ctx.moveTo(i * 8, 12);
            ctx.lineTo(i * 8 + 4, 4);
            ctx.lineTo(i * 8 + 8, 12);
            ctx.fill();
            
            // Awning highlight
            ctx.fillStyle = colors[i][1];
            ctx.beginPath();
            ctx.moveTo(i * 8 + 1, 11);
            ctx.lineTo(i * 8 + 4, 5);
            ctx.lineTo(i * 8 + 4, 11);
            ctx.fill();
            
            // Awning fringe
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(i * 8, 11, 8, 1);
        }

        // Goods on display
        // Fruits (left)
        ctx.fillStyle = '#ff4444';
        ctx.fillRect(2, 14, 3, 3);
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(6, 14, 3, 3);
        ctx.fillStyle = '#88ff44';
        ctx.fillRect(4, 15, 2, 2);
        
        // Pottery (center)
        ctx.fillStyle = '#cd853f';
        ctx.fillRect(13, 13, 3, 4);
        ctx.fillStyle = '#daa520';
        ctx.fillRect(16, 14, 3, 3);
        ctx.fillStyle = '#b8860b';
        ctx.fillRect(14, 14, 2, 2);
        
        // Cloth/goods (right)
        ctx.fillStyle = '#9932cc';
        ctx.fillRect(22, 14, 4, 3);
        ctx.fillStyle = '#00ced1';
        ctx.fillRect(26, 14, 4, 3);
        ctx.fillStyle = '#ff69b4';
        ctx.fillRect(24, 15, 3, 2);

        // Hanging goods from poles
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(4, 5, 1, 3);
        ctx.fillRect(12, 5, 1, 3);
        ctx.fillRect(20, 5, 1, 3);
        ctx.fillRect(28, 5, 1, 3);

        // Flags/banners on top
        ctx.fillStyle = '#ff6600';
        ctx.fillRect(0, 2, 3, 2);
        ctx.fillStyle = '#00ff88';
        ctx.fillRect(15, 1, 3, 3);
        ctx.fillStyle = '#ff00aa';
        ctx.fillRect(29, 2, 3, 2);

        return canvas;
    }

    generateTemple() {
        const canvas = this.createCanvas(32, 32);
        const ctx = canvas.getContext('2d');

        // Shadow
        ctx.fillStyle = '#2a2a3a';
        ctx.fillRect(4, 28, 24, 4);

        // Temple base steps
        ctx.fillStyle = '#a0a0b0';
        ctx.fillRect(0, 26, 32, 6);
        ctx.fillStyle = '#b0b0c0';
        ctx.fillRect(2, 24, 28, 4);
        ctx.fillStyle = '#c0c0d0';
        ctx.fillRect(4, 22, 24, 4);

        // Temple main body (marble)
        ctx.fillStyle = '#d0d0e0';
        ctx.fillRect(4, 10, 24, 12);
        
        // Wall highlight
        ctx.fillStyle = '#e0e0f0';
        ctx.fillRect(5, 10, 4, 12);
        
        // Wall shadow
        ctx.fillStyle = '#b0b0c0';
        ctx.fillRect(24, 10, 4, 12);

        // Grand entrance (dark recessed)
        ctx.fillStyle = '#2a1a2a';
        ctx.fillRect(10, 12, 12, 10);
        ctx.fillStyle = '#3a2a3a';
        ctx.beginPath();
        ctx.arc(16, 12, 6, Math.PI, 0);
        ctx.fill();

        // Temple door (ornate)
        ctx.fillStyle = '#5a3a2a';
        ctx.fillRect(12, 16, 8, 6);
        ctx.fillStyle = '#6a4a3a';
        ctx.fillRect(12, 16, 4, 5);
        
        // Door gold trim
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(12, 16, 8, 1);
        ctx.fillRect(15, 16, 2, 6);
        
        // Door handles
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(13, 19, 1, 1);
        ctx.fillRect(18, 19, 1, 1);

        // Pillars (ornate columns)
        ctx.fillStyle = '#e0e0f0';
        ctx.fillRect(5, 10, 4, 12);
        ctx.fillRect(23, 10, 4, 12);
        
        // Pillar shadows
        ctx.fillStyle = '#c0c0d0';
        ctx.fillRect(8, 10, 1, 12);
        ctx.fillRect(26, 10, 1, 12);
        
        // Pillar highlights
        ctx.fillStyle = '#f0f0ff';
        ctx.fillRect(5, 10, 1, 12);
        ctx.fillRect(23, 10, 1, 12);
        
        // Pillar capitals
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(4, 9, 6, 2);
        ctx.fillRect(22, 9, 6, 2);

        // Temple roof (triangular pediment)
        ctx.fillStyle = '#a0a0b0';
        ctx.beginPath();
        ctx.moveTo(2, 10);
        ctx.lineTo(16, 0);
        ctx.lineTo(30, 10);
        ctx.fill();
        
        // Roof highlight
        ctx.fillStyle = '#b0b0c0';
        ctx.beginPath();
        ctx.moveTo(3, 10);
        ctx.lineTo(16, 1);
        ctx.lineTo(16, 10);
        ctx.fill();
        
        // Roof shadow
        ctx.fillStyle = '#808090';
        ctx.beginPath();
        ctx.moveTo(16, 1);
        ctx.lineTo(29, 10);
        ctx.lineTo(16, 10);
        ctx.fill();

        // Holy symbol (golden star/sun)
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(16, 5, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFEE88';
        ctx.beginPath();
        ctx.arc(15, 4, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Rays
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(16, 1, 1, 2);
        ctx.fillRect(16, 7, 1, 2);
        ctx.fillRect(12, 5, 2, 1);
        ctx.fillRect(18, 5, 2, 1);

        return canvas;
    }

    // Vehicle and Transportation sprites
    generateBoat() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        // Hull (brown wood)
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.moveTo(3, 8);
        ctx.lineTo(13, 8);
        ctx.lineTo(12, 12);
        ctx.lineTo(4, 12);
        ctx.fill();

        // Boat outline
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(3, 8);
        ctx.lineTo(13, 8);
        ctx.lineTo(12, 12);
        ctx.lineTo(4, 12);
        ctx.closePath();
        ctx.stroke();

        // Sail (white)
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(8, 3);
        ctx.lineTo(10, 8);
        ctx.lineTo(8, 8);
        ctx.fill();

        // Mast (grey)
        ctx.fillStyle = '#696969';
        ctx.fillRect(7, 3, 2, 5);

        return canvas;
    }

    generateCar() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        // Car body (red)
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(2, 6, 12, 6);

        // Car roof (darker red)
        ctx.fillStyle = '#CC0000';
        ctx.fillRect(4, 3, 8, 3);

        // Windows (light blue)
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(5, 3, 3, 2);
        ctx.fillRect(9, 3, 3, 2);

        // Wheels (black)
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(4, 12, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(12, 12, 2, 0, Math.PI * 2);
        ctx.fill();

        // Wheel rims (grey)
        ctx.fillStyle = '#808080';
        ctx.beginPath();
        ctx.arc(4, 12, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(12, 12, 1.2, 0, Math.PI * 2);
        ctx.fill();

        return canvas;
    }

    // Weapon sprites
    generateSword() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        // Blade (silver)
        ctx.fillStyle = '#C0C0C0';
        ctx.fillRect(7, 1, 2, 10);

        // Blade edge highlight
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(7, 1, 1, 10);

        // Crossguard (gold)
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(5, 10, 6, 1);

        // Handle (brown)
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(6, 11, 4, 4);

        // Pommel (gold)
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(6, 14, 4, 1);

        return canvas;
    }

    generateAxe() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        // Axe head (dark grey)
        ctx.fillStyle = '#545454';
        ctx.beginPath();
        ctx.moveTo(4, 2);
        ctx.lineTo(12, 2);
        ctx.lineTo(10, 7);
        ctx.lineTo(6, 7);
        ctx.fill();

        // Axe edge highlight
        ctx.fillStyle = '#808080';
        ctx.fillRect(4, 2, 2, 5);

        // Handle (brown wood)
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(7, 6, 2, 9);

        // Handle detail
        ctx.fillStyle = '#654321';
        ctx.fillRect(7, 9, 2, 1);
        ctx.fillRect(7, 12, 2, 1);

        return canvas;
    }

    generateBow() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        // Bow stave (brown wood)
        ctx.fillStyle = '#8B4513';
        ctx.beginPath();
        ctx.arc(8, 8, 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(7, 2, 2, 12);

        // Bow curve (darker)
        ctx.fillStyle = '#654321';
        ctx.beginPath();
        ctx.arc(8, 8, 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Bowstring (white)
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(8, 2);
        ctx.quadraticCurveTo(12, 8, 8, 14);
        ctx.stroke();

        // Arrow (yellow/orange)
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(8, 7, 4, 1);

        // Arrow head (silver)
        ctx.fillStyle = '#C0C0C0';
        ctx.beginPath();
        ctx.moveTo(12, 7);
        ctx.lineTo(14, 7.5);
        ctx.lineTo(12, 8);
        ctx.fill();

        return canvas;
    }

    // Creature generators
    generateHuman() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        // Hair (brown)
        ctx.fillStyle = '#654321';
        ctx.fillRect(6, 0, 4, 2);

        // Head (skin tone)
        ctx.fillStyle = '#F4A460';
        ctx.fillRect(6, 1, 4, 3);
        
        // Eyes
        ctx.fillStyle = '#000000';
        ctx.fillRect(7, 1, 1, 1);
        ctx.fillRect(9, 1, 1, 1);

        // Nose
        ctx.fillStyle = '#E8A050';
        ctx.fillRect(8, 2, 1, 1);

        // Body (shirt - blue)
        ctx.fillStyle = '#4169E1';
        ctx.fillRect(5, 4, 6, 5);

        // Arms (skin)
        ctx.fillStyle = '#F4A460';
        ctx.fillRect(3, 5, 2, 4);
        ctx.fillRect(11, 5, 2, 4);

        // Hands
        ctx.fillStyle = '#F4A460';
        ctx.fillRect(3, 9, 2, 1);
        ctx.fillRect(11, 9, 2, 1);

        // Legs (pants - brown)
        ctx.fillStyle = '#8B7355';
        ctx.fillRect(6, 9, 2, 6);
        ctx.fillRect(8, 9, 2, 6);

        // Feet (shoes - black)
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(6, 15, 2, 1);
        ctx.fillRect(8, 15, 2, 1);

        return canvas;
    }

    generateElf() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        // Hair (blonde)
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(6, 0, 4, 2);

        // Head (pale skin)
        ctx.fillStyle = '#FDBCB4';
        ctx.fillRect(6, 1, 4, 3);

        // Pointed ears
        ctx.fillStyle = '#FDBCB4';
        ctx.fillRect(5, 2, 1, 2);
        ctx.fillRect(10, 2, 1, 2);

        // Eyes (green)
        ctx.fillStyle = '#00AA00';
        ctx.fillRect(7, 2, 1, 1);
        ctx.fillRect(9, 2, 1, 1);

        // Body (green tunic)
        ctx.fillStyle = '#228B22';
        ctx.fillRect(5, 4, 6, 5);

        // Arms (pale)
        ctx.fillStyle = '#FDBCB4';
        ctx.fillRect(3, 5, 2, 4);
        ctx.fillRect(11, 5, 2, 4);

        // Legs (green leggings)
        ctx.fillStyle = '#1B5E20';
        ctx.fillRect(6, 9, 2, 6);
        ctx.fillRect(8, 9, 2, 6);

        // Feet (green boots)
        ctx.fillStyle = '#1B5E20';
        ctx.fillRect(6, 15, 2, 1);
        ctx.fillRect(8, 15, 2, 1);

        return canvas;
    }

    generateDwarf() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        // Hair (brown)
        ctx.fillStyle = '#654321';
        ctx.fillRect(6, 2, 4, 2);

        // Head (stocky)
        ctx.fillStyle = '#D2B48C';
        ctx.fillRect(6, 3, 4, 3);

        // Beard (brown)
        ctx.fillStyle = '#654321';
        ctx.fillRect(6, 5, 4, 2);

        // Eyes
        ctx.fillStyle = '#000000';
        ctx.fillRect(7, 4, 1, 1);
        ctx.fillRect(9, 4, 1, 1);

        // Body (orange tunic)
        ctx.fillStyle = '#FF8C00';
        ctx.fillRect(5, 6, 6, 5);

        // Arms (tan)
        ctx.fillStyle = '#D2B48C';
        ctx.fillRect(3, 7, 2, 4);
        ctx.fillRect(11, 7, 2, 4);

        // Belt (leather)
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(5, 10, 6, 1);

        // Legs (brown pants)
        ctx.fillStyle = '#654321';
        ctx.fillRect(6, 11, 2, 5);
        ctx.fillRect(8, 11, 2, 5);

        return canvas;
    }

    generateOrc() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        // Hair (dark green)
        ctx.fillStyle = '#2F4F2F';
        ctx.fillRect(6, 0, 4, 2);

        // Head (green skin)
        ctx.fillStyle = '#556B2F';
        ctx.fillRect(6, 1, 4, 3);

        // Eyes (red)
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(7, 1, 1, 1);
        ctx.fillRect(9, 1, 1, 1);

        // Tusks (white)
        ctx.fillStyle = '#FFFFF0';
        ctx.fillRect(6, 3, 1, 1);
        ctx.fillRect(9, 3, 1, 1);

        // Body (dark brown)
        ctx.fillStyle = '#654321';
        ctx.fillRect(5, 4, 6, 5);

        // Arms (green)
        ctx.fillStyle = '#6B8E23';
        ctx.fillRect(3, 5, 2, 4);
        ctx.fillRect(11, 5, 2, 4);

        // Hands (green)
        ctx.fillStyle = '#556B2F';
        ctx.fillRect(3, 9, 2, 1);
        ctx.fillRect(11, 9, 2, 1);

        // Legs (dark brown)
        ctx.fillStyle = '#3D3D1F';
        ctx.fillRect(6, 9, 2, 6);
        ctx.fillRect(8, 9, 2, 6);

        // Feet (gray)
        ctx.fillStyle = '#4A4A4A';
        ctx.fillRect(6, 15, 2, 1);
        ctx.fillRect(8, 15, 2, 1);

        return canvas;
    }

    generateUndead() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        // Head (skull - bone color)
        ctx.fillStyle = '#D3D3D3';
        ctx.fillRect(6, 1, 4, 4);

        // Eye sockets (dark)
        ctx.fillStyle = '#000000';
        ctx.fillRect(7, 2, 1, 1);
        ctx.fillRect(9, 2, 1, 1);

        // Nose hole
        ctx.fillStyle = '#000000';
        ctx.fillRect(8, 3, 1, 1);

        // Jaw line
        ctx.fillStyle = '#A9A9A9';
        ctx.fillRect(6, 4, 4, 1);

        // Teeth
        ctx.fillStyle = '#F5F5F5';
        ctx.fillRect(6, 4, 1, 1);
        ctx.fillRect(9, 4, 1, 1);

        // Body (tattered robe - gray)
        ctx.fillStyle = '#696969';
        ctx.fillRect(5, 5, 6, 6);

        // Robe tears
        ctx.fillStyle = '#556B2F';
        ctx.fillRect(5, 6, 1, 2);
        ctx.fillRect(10, 7, 1, 2);

        // Arms (skeletal - bone)
        ctx.fillStyle = '#C0C0C0';
        ctx.fillRect(3, 6, 2, 4);
        ctx.fillRect(11, 6, 2, 4);

        // Hands (skeletal)
        ctx.fillStyle = '#A9A9A9';
        ctx.fillRect(3, 10, 2, 1);
        ctx.fillRect(11, 10, 2, 1);

        // Legs (skeletal)
        ctx.fillStyle = '#808080';
        ctx.fillRect(6, 11, 2, 5);
        ctx.fillRect(8, 11, 2, 5);

        return canvas;
    }

    // Animal sprites
    generateWolf() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        // Back body (darker gray)
        ctx.fillStyle = '#3A3A3A';
        ctx.fillRect(2, 7, 8, 5);

        // Front body (lighter gray)
        ctx.fillStyle = '#4A4A4A';
        ctx.fillRect(8, 6, 5, 5);

        // Head (dark)
        ctx.fillStyle = '#2A2A2A';
        ctx.fillRect(11, 4, 4, 4);

        // Snout (lighter)
        ctx.fillStyle = '#5A5A5A';
        ctx.fillRect(13, 5, 3, 2);

        // Ears (pointed)
        ctx.fillStyle = '#3A3A3A';
        ctx.fillRect(11, 3, 1, 2);
        ctx.fillRect(13, 3, 1, 2);

        // Eyes (yellow)
        ctx.fillStyle = '#FFFF00';
        ctx.fillRect(12, 5, 1, 1);
        ctx.fillRect(14, 5, 1, 1);

        // Nose (black)
        ctx.fillStyle = '#000000';
        ctx.fillRect(14, 6, 1, 1);

        // Tail (curved)
        ctx.fillStyle = '#3A3A3A';
        ctx.fillRect(1, 8, 2, 4);

        // Front legs
        ctx.fillStyle = '#4A4A4A';
        ctx.fillRect(8, 11, 2, 5);
        ctx.fillRect(12, 11, 2, 5);

        // Back legs
        ctx.fillStyle = '#3A3A3A';
        ctx.fillRect(4, 12, 2, 4);
        ctx.fillRect(6, 12, 2, 4);

        // Paws (darker)
        ctx.fillStyle = '#1A1A1A';
        ctx.fillRect(8, 16, 2, 1);
        ctx.fillRect(12, 16, 2, 1);

        return canvas;
    }

    generateBear() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        // Body (dark brown fur)
        ctx.fillStyle = '#5A3D1F';
        ctx.fillRect(3, 6, 10, 8);

        // Head (brown)
        ctx.fillStyle = '#654321';
        ctx.fillRect(8, 1, 5, 5);

        // Ears (rounded)
        ctx.fillStyle = '#654321';
        ctx.fillRect(8, 0, 2, 2);
        ctx.fillRect(11, 0, 2, 2);

        // Ear insides (lighter)
        ctx.fillStyle = '#8B7355';
        ctx.fillRect(8, 0, 1, 1);
        ctx.fillRect(11, 0, 1, 1);

        // Snout (lighter brown)
        ctx.fillStyle = '#8B7355';
        ctx.fillRect(9, 3, 3, 2);

        // Eyes (black)
        ctx.fillStyle = '#000000';
        ctx.fillRect(8, 2, 1, 1);
        ctx.fillRect(11, 2, 1, 1);

        // Nose (black)
        ctx.fillStyle = '#000000';
        ctx.fillRect(10, 4, 1, 1);

        // Front legs (thick)
        ctx.fillStyle = '#4A3320';
        ctx.fillRect(4, 14, 3, 3);
        ctx.fillRect(9, 14, 3, 3);

        // Back/side body detail
        ctx.fillStyle = '#4A3320';
        ctx.fillRect(3, 12, 10, 2);

        // Paws (dark)
        ctx.fillStyle = '#1A0F0A';
        ctx.fillRect(4, 16, 3, 1);
        ctx.fillRect(9, 16, 3, 1);

        return canvas;
    }

    generateDeer() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        // Back body (reddish-brown)
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(2, 8, 8, 5);

        // Front body (lighter)
        ctx.fillStyle = '#A0522D';
        ctx.fillRect(8, 7, 4, 6);

        // Neck
        ctx.fillStyle = '#A0522D';
        ctx.fillRect(10, 4, 2, 3);

        // Head (tan)
        ctx.fillStyle = '#B8860B';
        ctx.fillRect(10, 2, 3, 4);

        // Snout (lighter tan)
        ctx.fillStyle = '#CD853F';
        ctx.fillRect(12, 3, 2, 2);

        // Eyes (black)
        ctx.fillStyle = '#000000';
        ctx.fillRect(11, 3, 1, 1);

        // Nose (darker)
        ctx.fillStyle = '#654321';
        ctx.fillRect(13, 3, 1, 1);

        // Antlers (left)
        ctx.fillStyle = '#654321';
        ctx.fillRect(10, 0, 1, 2);
        ctx.fillRect(10, 1, 2, 1);

        // Antlers (right)
        ctx.fillStyle = '#654321';
        ctx.fillRect(12, 0, 1, 2);
        ctx.fillRect(11, 1, 2, 1);

        // White tail
        ctx.fillStyle = '#F5F5DC';
        ctx.fillRect(2, 9, 1, 3);

        // Front legs (thin)
        ctx.fillStyle = '#8B7355';
        ctx.fillRect(9, 13, 1, 4);
        ctx.fillRect(11, 13, 1, 4);

        // Back legs (thin)
        ctx.fillStyle = '#8B7355';
        ctx.fillRect(4, 13, 1, 4);
        ctx.fillRect(6, 13, 1, 4);

        // Hooves (dark)
        ctx.fillStyle = '#1A1A1A';
        ctx.fillRect(9, 17, 1, 1);
        ctx.fillRect(11, 17, 1, 1);

        return canvas;
    }

    generateEagle() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        // Body (brown)
        ctx.fillStyle = '#654321';
        ctx.fillRect(6, 8, 4, 5);

        // Chest (lighter brown)
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(7, 9, 2, 3);

        // Head (dark)
        ctx.fillStyle = '#4A2511';
        ctx.fillRect(8, 5, 3, 4);

        // Beak (yellow)
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(11, 6, 3, 1);
        ctx.fillRect(10, 7, 1, 1);

        // Eye (yellow)
        ctx.fillStyle = '#FFFF00';
        ctx.fillRect(10, 6, 1, 1);

        // Left wing (spread)
        ctx.fillStyle = '#654321';
        ctx.fillRect(1, 9, 5, 3);

        // Left wing detail
        ctx.fillStyle = '#4A2511';
        ctx.fillRect(1, 9, 5, 1);

        // Right wing (spread)
        ctx.fillStyle = '#654321';
        ctx.fillRect(10, 9, 5, 3);

        // Right wing detail
        ctx.fillStyle = '#4A2511';
        ctx.fillRect(10, 9, 5, 1);

        // Tail feathers (spread)
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(5, 13, 4, 3);

        // Talons (gold)
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(7, 12, 1, 2);
        ctx.fillRect(8, 12, 1, 2);

        return canvas;
    }

    generateFish() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        // Tail fin (left back)
        ctx.fillStyle = '#FF1493';
        ctx.fillRect(1, 7, 2, 2);
        ctx.fillRect(1, 6, 2, 1);
        ctx.fillRect(1, 9, 2, 1);

        // Body (scales - orange)
        ctx.fillStyle = '#FF8C00';
        ctx.fillRect(3, 7, 8, 3);

        // Body highlight (lighter)
        ctx.fillStyle = '#FFA500';
        ctx.fillRect(4, 7, 6, 1);

        // Head (orange)
        ctx.fillStyle = '#FF6347';
        ctx.fillRect(11, 7, 3, 3);

        // Eye (black with white)
        ctx.fillStyle = '#000000';
        ctx.fillRect(12, 7, 1, 1);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(12, 7, 1, 1);

        // Gill (darker)
        ctx.fillStyle = '#DC143C';
        ctx.fillRect(10, 8, 2, 1);

        // Dorsal fin (back top)
        ctx.fillStyle = '#FF69B4';
        ctx.fillRect(5, 6, 1, 1);
        ctx.fillRect(7, 6, 1, 1);

        // Dorsal fin (detail)
        ctx.fillStyle = '#FF1493';
        ctx.fillRect(6, 5, 1, 1);

        // Bottom fin (front)
        ctx.fillStyle = '#FF69B4';
        ctx.fillRect(7, 10, 2, 1);

        // Tail fin (right back)
        ctx.fillStyle = '#FF1493';
        ctx.fillRect(11, 7, 1, 3);
        ctx.fillRect(12, 6, 1, 1);
        ctx.fillRect(12, 10, 1, 1);

        // Belly (pale)
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(4, 9, 6, 1);

        return canvas;
    }

    generateDragon() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        // Body (red/dark red)
        ctx.fillStyle = '#8B0000';
        ctx.fillRect(4, 6, 8, 6);
        
        // Head
        ctx.fillStyle = '#B22222';
        ctx.fillRect(10, 4, 4, 4);
        
        // Wings
        ctx.fillStyle = '#FF4500';
        ctx.beginPath();
        ctx.moveTo(6, 6);
        ctx.lineTo(2, 2);
        ctx.lineTo(4, 6);
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(10, 6);
        ctx.lineTo(14, 2);
        ctx.lineTo(12, 6);
        ctx.fill();
        
        // Tail
        ctx.fillStyle = '#8B0000';
        ctx.fillRect(0, 8, 4, 2);
        
        // Eyes (yellow/orange)
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(12, 5, 1, 1);
        
        // Fire breath
        ctx.fillStyle = '#FF6600';
        ctx.fillRect(14, 5, 2, 2);

        return canvas;
    }

    getSprite(type) {
        return this.sprites[type] || this.sprites.grass;
    }

    // ============================================
    // UI ICON GENERATORS - Pixelated button icons
    // ============================================
    
    generateUIIcons() {
        // Generate all UI icons for buttons
        this.uiIcons = {};
        
        // Terrain icons
        this.uiIcons.grass = this.generateTerrainIcon('#4CAF50', '#81C784', '#2E7D32');
        this.uiIcons.dirt = this.generateTerrainIcon('#8B7355', '#A0826D', '#6D5A47');
        this.uiIcons.stone = this.generateTerrainIcon('#808080', '#A9A9A9', '#4A4A4A');
        this.uiIcons.sand = this.generateTerrainIcon('#F4A460', '#FFD89B', '#E09447');
        this.uiIcons.water = this.generateWaterIcon();
        this.uiIcons.lava = this.generateLavaIcon();
        this.uiIcons.forest = this.generateForestIcon();
        this.uiIcons.mountain = this.generateMountainIcon();
        
        // Creature icons
        this.uiIcons.human = this.generateHumanoidIcon('#FFD1AA', '#3366CC', '#FFE4C4');
        this.uiIcons.elf = this.generateElfIcon();
        this.uiIcons.dwarf = this.generateDwarfIcon();
        this.uiIcons.orc = this.generateOrcIcon();
        this.uiIcons.undead = this.generateUndeadIcon();
        this.uiIcons.wolf = this.generateWolfIcon();
        this.uiIcons.bear = this.generateBearIcon();
        this.uiIcons.deer = this.generateDeerIcon();
        this.uiIcons.eagle = this.generateEagleIcon();
        this.uiIcons.fish = this.generateFishIcon();
        
        // Power/Hazard icons
        this.uiIcons.meteor = this.generateMeteorIcon();
        this.uiIcons.nuke = this.generateNukeIcon();
        this.uiIcons.dragon = this.generateDragonIcon();
        this.uiIcons.ufo = this.generateUFOIcon();
        this.uiIcons.plague = this.generatePlagueIcon();
        this.uiIcons.tsunami = this.generateTsunamiIcon();
        this.uiIcons.lightning = this.generateLightningIcon();
        this.uiIcons.volcano = this.generateVolcanoIcon();
        this.uiIcons.earthquake = this.generateEarthquakeIcon();
        this.uiIcons.wildfire = this.generateWildfireIcon();
        this.uiIcons.blizzard = this.generateBlizzardIcon();
        
        // Tool icons
        this.uiIcons.pause = this.generatePauseIcon();
        this.uiIcons.step = this.generateStepIcon();
        this.uiIcons.clear = this.generateTrashIcon();
        this.uiIcons.generate = this.generateWorldIcon();
        this.uiIcons.reset = this.generateResetIcon();
        this.uiIcons.save = this.generateSaveIcon();
        this.uiIcons.load = this.generateLoadIcon();
        
        // Tab icons
        this.uiIcons.terrain_tab = this.generateTerrainTabIcon();
        this.uiIcons.creatures_tab = this.generateCreaturesTabIcon();
        this.uiIcons.civilizations_tab = this.generateCrownIcon();
        this.uiIcons.powers_tab = this.generateLightningIcon();
        this.uiIcons.hazards_tab = this.generateSkullIcon();
        this.uiIcons.stats_tab = this.generateStatsIcon();
        this.uiIcons.tools_tab = this.generateWrenchIcon();
        
        // Overlay icons
        this.uiIcons.biome = this.generateWorldIcon();
        this.uiIcons.population = this.generatePopulationIcon();
        this.uiIcons.temperature = this.generateTemperatureIcon();
        this.uiIcons.kingdoms = this.generateCrownIcon();
        
        return this.uiIcons;
    }
    
    createIconCanvas(size = 24) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        return canvas;
    }
    
    // Terrain icons
    generateTerrainIcon(baseColor, lightColor, darkColor) {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Base fill
        ctx.fillStyle = baseColor;
        ctx.fillRect(2, 2, 20, 20);
        
        // Texture details
        ctx.fillStyle = darkColor;
        for (let i = 0; i < 6; i++) {
            ctx.fillRect(4 + (i * 3) % 16, 4 + (i * 5) % 16, 2, 2);
        }
        ctx.fillStyle = lightColor;
        for (let i = 0; i < 4; i++) {
            ctx.fillRect(6 + (i * 4) % 14, 6 + (i * 3) % 14, 2, 2);
        }
        
        // Border
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, 20, 20);
        
        return canvas;
    }
    
    generateWaterIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Base blue
        ctx.fillStyle = '#1E90FF';
        ctx.fillRect(2, 2, 20, 20);
        
        // Wave lines
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(4, 6, 16, 2);
        ctx.fillRect(6, 12, 14, 2);
        ctx.fillRect(4, 18, 16, 2);
        
        // Highlights
        ctx.fillStyle = '#B0E0E6';
        ctx.fillRect(8, 8, 4, 2);
        ctx.fillRect(12, 14, 4, 2);
        
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, 20, 20);
        
        return canvas;
    }
    
    generateLavaIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Base orange-red
        ctx.fillStyle = '#FF4500';
        ctx.fillRect(2, 2, 20, 20);
        
        // Hot spots
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(6, 6, 4, 4);
        ctx.fillRect(14, 10, 4, 4);
        ctx.fillRect(8, 14, 4, 4);
        
        // Dark cracks
        ctx.fillStyle = '#8B0000';
        ctx.fillRect(4, 10, 16, 2);
        ctx.fillRect(10, 4, 2, 16);
        
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, 20, 20);
        
        return canvas;
    }
    
    generateForestIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Ground
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(2, 16, 20, 6);
        
        // Tree trunk
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(10, 12, 4, 8);
        
        // Tree foliage (triangle)
        ctx.fillStyle = '#228B22';
        ctx.beginPath();
        ctx.moveTo(12, 2);
        ctx.lineTo(4, 14);
        ctx.lineTo(20, 14);
        ctx.fill();
        
        // Light highlights
        ctx.fillStyle = '#32CD32';
        ctx.fillRect(10, 6, 2, 2);
        ctx.fillRect(8, 10, 2, 2);
        
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, 20, 20);
        
        return canvas;
    }
    
    generateMountainIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Sky background
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(2, 2, 20, 20);
        
        // Mountain
        ctx.fillStyle = '#696969';
        ctx.beginPath();
        ctx.moveTo(12, 4);
        ctx.lineTo(2, 22);
        ctx.lineTo(22, 22);
        ctx.fill();
        
        // Snow cap
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(12, 4);
        ctx.lineTo(8, 10);
        ctx.lineTo(16, 10);
        ctx.fill();
        
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, 20, 20);
        
        return canvas;
    }
    
    // Creature icons
    generateHumanoidIcon(skinColor, clothesColor, hairColor) {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Head
        ctx.fillStyle = skinColor;
        ctx.fillRect(9, 3, 6, 6);
        
        // Hair
        ctx.fillStyle = hairColor;
        ctx.fillRect(9, 3, 6, 2);
        
        // Eyes
        ctx.fillStyle = '#000';
        ctx.fillRect(10, 5, 2, 2);
        ctx.fillRect(13, 5, 2, 2);
        
        // Body
        ctx.fillStyle = clothesColor;
        ctx.fillRect(8, 9, 8, 8);
        
        // Arms
        ctx.fillStyle = skinColor;
        ctx.fillRect(6, 9, 2, 6);
        ctx.fillRect(16, 9, 2, 6);
        
        // Legs
        ctx.fillStyle = '#4A4A4A';
        ctx.fillRect(9, 17, 3, 5);
        ctx.fillRect(13, 17, 3, 5);
        
        return canvas;
    }
    
    generateElfIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Head
        ctx.fillStyle = '#FFEFD5';
        ctx.fillRect(9, 4, 6, 5);
        
        // Pointed ears
        ctx.fillStyle = '#FFEFD5';
        ctx.fillRect(7, 5, 2, 2);
        ctx.fillRect(15, 5, 2, 2);
        
        // Hair (blonde)
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(9, 3, 6, 2);
        ctx.fillRect(8, 4, 2, 4);
        ctx.fillRect(14, 4, 2, 4);
        
        // Eyes (green)
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(10, 6, 2, 2);
        ctx.fillRect(13, 6, 2, 2);
        
        // Body (green tunic)
        ctx.fillStyle = '#228B22';
        ctx.fillRect(8, 9, 8, 7);
        
        // Arms
        ctx.fillStyle = '#FFEFD5';
        ctx.fillRect(6, 9, 2, 5);
        ctx.fillRect(16, 9, 2, 5);
        
        // Legs
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(9, 16, 3, 6);
        ctx.fillRect(13, 16, 3, 6);
        
        return canvas;
    }
    
    generateDwarfIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Head (wider)
        ctx.fillStyle = '#FFD1AA';
        ctx.fillRect(8, 4, 8, 6);
        
        // Beard (big brown)
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(8, 8, 8, 5);
        ctx.fillRect(7, 9, 2, 4);
        ctx.fillRect(15, 9, 2, 4);
        
        // Helmet
        ctx.fillStyle = '#B8860B';
        ctx.fillRect(7, 2, 10, 3);
        ctx.fillRect(9, 1, 6, 2);
        
        // Eyes
        ctx.fillStyle = '#000';
        ctx.fillRect(10, 6, 2, 2);
        ctx.fillRect(14, 6, 2, 2);
        
        // Body (armored)
        ctx.fillStyle = '#696969';
        ctx.fillRect(7, 13, 10, 6);
        
        // Legs (short)
        ctx.fillStyle = '#4A4A4A';
        ctx.fillRect(9, 19, 3, 3);
        ctx.fillRect(13, 19, 3, 3);
        
        return canvas;
    }
    
    generateOrcIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Head (green)
        ctx.fillStyle = '#228B22';
        ctx.fillRect(8, 4, 8, 7);
        
        // Tusks
        ctx.fillStyle = '#FFFFF0';
        ctx.fillRect(9, 9, 2, 3);
        ctx.fillRect(14, 9, 2, 3);
        
        // Red eyes
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(10, 6, 2, 2);
        ctx.fillRect(14, 6, 2, 2);
        
        // Body (leather armor)
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(7, 11, 10, 7);
        
        // Arms (muscular)
        ctx.fillStyle = '#228B22';
        ctx.fillRect(5, 11, 2, 6);
        ctx.fillRect(17, 11, 2, 6);
        
        // Legs
        ctx.fillStyle = '#4A4A4A';
        ctx.fillRect(9, 18, 3, 4);
        ctx.fillRect(13, 18, 3, 4);
        
        return canvas;
    }
    
    generateUndeadIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Skull
        ctx.fillStyle = '#FFFFF0';
        ctx.fillRect(8, 3, 8, 7);
        
        // Eye sockets (dark)
        ctx.fillStyle = '#000';
        ctx.fillRect(9, 5, 3, 3);
        ctx.fillRect(14, 5, 3, 3);
        
        // Glowing eyes
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(10, 6, 2, 2);
        ctx.fillRect(15, 6, 2, 2);
        
        // Teeth
        ctx.fillStyle = '#FFFFF0';
        ctx.fillRect(10, 9, 2, 2);
        ctx.fillRect(14, 9, 2, 2);
        
        // Ragged robes
        ctx.fillStyle = '#2F2F2F';
        ctx.fillRect(7, 10, 10, 8);
        ctx.fillRect(6, 12, 2, 6);
        ctx.fillRect(16, 12, 2, 6);
        
        // Bones (arms)
        ctx.fillStyle = '#FFFFF0';
        ctx.fillRect(5, 13, 2, 4);
        ctx.fillRect(17, 13, 2, 4);
        
        // Tattered bottom
        ctx.fillStyle = '#1F1F1F';
        ctx.fillRect(8, 18, 3, 4);
        ctx.fillRect(13, 18, 3, 4);
        
        return canvas;
    }
    
    generateWolfIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Body
        ctx.fillStyle = '#808080';
        ctx.fillRect(4, 10, 12, 6);
        
        // Head
        ctx.fillStyle = '#696969';
        ctx.fillRect(14, 8, 6, 6);
        
        // Ears
        ctx.fillStyle = '#696969';
        ctx.fillRect(16, 5, 2, 3);
        ctx.fillRect(19, 5, 2, 3);
        
        // Snout
        ctx.fillStyle = '#4A4A4A';
        ctx.fillRect(20, 10, 3, 3);
        
        // Eye
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(17, 9, 2, 2);
        
        // Tail
        ctx.fillStyle = '#808080';
        ctx.fillRect(2, 8, 3, 3);
        
        // Legs
        ctx.fillStyle = '#696969';
        ctx.fillRect(6, 16, 2, 4);
        ctx.fillRect(10, 16, 2, 4);
        ctx.fillRect(14, 14, 2, 4);
        
        return canvas;
    }
    
    generateBearIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Body
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(4, 8, 14, 10);
        
        // Head
        ctx.fillStyle = '#A0522D';
        ctx.fillRect(14, 5, 8, 8);
        
        // Ears
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(15, 3, 3, 3);
        ctx.fillRect(19, 3, 3, 3);
        
        // Snout
        ctx.fillStyle = '#D2691E';
        ctx.fillRect(20, 8, 3, 4);
        
        // Nose
        ctx.fillStyle = '#000';
        ctx.fillRect(21, 9, 2, 2);
        
        // Eye
        ctx.fillStyle = '#000';
        ctx.fillRect(17, 7, 2, 2);
        
        // Legs
        ctx.fillStyle = '#6B3E26';
        ctx.fillRect(6, 18, 3, 4);
        ctx.fillRect(13, 18, 3, 4);
        
        return canvas;
    }
    
    generateDeerIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Body
        ctx.fillStyle = '#D2691E';
        ctx.fillRect(6, 10, 10, 6);
        
        // Head
        ctx.fillStyle = '#CD853F';
        ctx.fillRect(14, 6, 5, 6);
        
        // Antlers
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(15, 3, 2, 4);
        ctx.fillRect(13, 4, 2, 2);
        ctx.fillRect(19, 4, 2, 2);
        
        // Eye
        ctx.fillStyle = '#000';
        ctx.fillRect(17, 8, 2, 2);
        
        // Nose
        ctx.fillStyle = '#000';
        ctx.fillRect(19, 10, 2, 1);
        
        // White belly
        ctx.fillStyle = '#FFFACD';
        ctx.fillRect(8, 14, 6, 2);
        
        // Legs (thin)
        ctx.fillStyle = '#A0522D';
        ctx.fillRect(7, 16, 2, 6);
        ctx.fillRect(13, 16, 2, 6);
        
        // Tail
        ctx.fillStyle = '#FFFACD';
        ctx.fillRect(4, 11, 3, 3);
        
        return canvas;
    }
    
    generateEagleIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Body
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(9, 10, 6, 6);
        
        // Head (white)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(13, 6, 5, 5);
        
        // Beak
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(17, 8, 4, 2);
        
        // Eye
        ctx.fillStyle = '#000';
        ctx.fillRect(15, 8, 2, 2);
        
        // Wings spread
        ctx.fillStyle = '#654321';
        ctx.fillRect(3, 8, 6, 4);
        ctx.fillRect(15, 8, 6, 4);
        
        // Wing tips
        ctx.fillStyle = '#4A3728';
        ctx.fillRect(2, 9, 2, 2);
        ctx.fillRect(20, 9, 2, 2);
        
        // Tail feathers
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(7, 14, 4, 4);
        
        // Talons
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(10, 16, 2, 3);
        ctx.fillRect(13, 16, 2, 3);
        
        return canvas;
    }
    
    generateFishIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Body
        ctx.fillStyle = '#FF8C00';
        ctx.fillRect(6, 9, 12, 6);
        
        // Tail
        ctx.fillStyle = '#FF6347';
        ctx.fillRect(3, 8, 4, 3);
        ctx.fillRect(3, 13, 4, 3);
        
        // Head
        ctx.fillStyle = '#FFA500';
        ctx.fillRect(16, 10, 4, 4);
        
        // Eye
        ctx.fillStyle = '#000';
        ctx.fillRect(17, 11, 2, 2);
        ctx.fillStyle = '#FFF';
        ctx.fillRect(17, 11, 1, 1);
        
        // Dorsal fin
        ctx.fillStyle = '#FF69B4';
        ctx.fillRect(10, 6, 4, 3);
        
        // Belly fin
        ctx.fillStyle = '#FF69B4';
        ctx.fillRect(10, 15, 4, 2);
        
        // Scales highlight
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(8, 11, 2, 2);
        ctx.fillRect(12, 11, 2, 2);
        
        return canvas;
    }
    
    // Power/Hazard icons
    generateMeteorIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Trail
        ctx.fillStyle = '#FF6600';
        ctx.fillRect(2, 2, 4, 4);
        ctx.fillRect(4, 4, 4, 4);
        ctx.fillRect(6, 6, 4, 4);
        
        // Core
        ctx.fillStyle = '#8B0000';
        ctx.fillRect(10, 10, 8, 8);
        
        // Hot center
        ctx.fillStyle = '#FF4500';
        ctx.fillRect(12, 12, 4, 4);
        
        // Bright core
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(13, 13, 2, 2);
        
        // Fire particles
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(8, 8, 2, 2);
        ctx.fillRect(18, 14, 2, 2);
        ctx.fillRect(14, 18, 2, 2);
        
        return canvas;
    }
    
    generateNukeIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Mushroom cloud top
        ctx.fillStyle = '#FF6600';
        ctx.fillRect(4, 4, 16, 8);
        
        // Cloud highlight
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(6, 5, 12, 4);
        
        // Stem
        ctx.fillStyle = '#8B0000';
        ctx.fillRect(9, 12, 6, 8);
        
        // Radiation symbol center
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(11, 14, 2, 2);
        
        // Ground blast
        ctx.fillStyle = '#FF4500';
        ctx.fillRect(4, 18, 16, 4);
        
        return canvas;
    }
    
    generateDragonIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Body
        ctx.fillStyle = '#8B0000';
        ctx.fillRect(6, 10, 10, 6);
        
        // Head
        ctx.fillStyle = '#B22222';
        ctx.fillRect(14, 7, 6, 5);
        
        // Wings
        ctx.fillStyle = '#FF4500';
        ctx.fillRect(4, 4, 4, 6);
        ctx.fillRect(12, 4, 4, 6);
        
        // Tail
        ctx.fillStyle = '#8B0000';
        ctx.fillRect(2, 12, 5, 3);
        
        // Eye
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(17, 9, 2, 2);
        
        // Fire
        ctx.fillStyle = '#FF6600';
        ctx.fillRect(20, 8, 3, 4);
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(21, 9, 2, 2);
        
        // Legs
        ctx.fillStyle = '#8B0000';
        ctx.fillRect(8, 16, 2, 4);
        ctx.fillRect(14, 16, 2, 4);
        
        return canvas;
    }
    
    generateUFOIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Dome
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(8, 4, 8, 5);
        
        // Saucer body
        ctx.fillStyle = '#C0C0C0';
        ctx.fillRect(4, 9, 16, 4);
        
        // Lights
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(6, 10, 2, 2);
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(11, 10, 2, 2);
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(16, 10, 2, 2);
        
        // Beam
        ctx.fillStyle = '#00FF0060';
        ctx.fillRect(9, 13, 6, 9);
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(10, 15, 4, 2);
        ctx.fillRect(11, 18, 2, 2);
        
        return canvas;
    }
    
    generatePlagueIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Skull
        ctx.fillStyle = '#FFFFF0';
        ctx.fillRect(7, 4, 10, 10);
        
        // Eye sockets
        ctx.fillStyle = '#000';
        ctx.fillRect(9, 7, 3, 3);
        ctx.fillRect(14, 7, 3, 3);
        
        // Nose
        ctx.fillStyle = '#000';
        ctx.fillRect(11, 11, 2, 2);
        
        // Teeth
        ctx.fillStyle = '#FFFFF0';
        ctx.fillRect(9, 14, 2, 3);
        ctx.fillRect(12, 14, 2, 3);
        ctx.fillRect(15, 14, 2, 3);
        
        // Green poison cloud
        ctx.fillStyle = '#32CD32';
        ctx.fillRect(3, 16, 4, 4);
        ctx.fillRect(17, 16, 4, 4);
        ctx.fillRect(5, 18, 3, 3);
        ctx.fillRect(16, 18, 3, 3);
        
        return canvas;
    }
    
    generateTsunamiIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Big wave
        ctx.fillStyle = '#1E90FF';
        ctx.fillRect(4, 8, 16, 12);
        
        // Wave crest
        ctx.fillStyle = '#00BFFF';
        ctx.fillRect(6, 4, 12, 6);
        
        // Foam
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(8, 4, 8, 2);
        ctx.fillRect(6, 6, 4, 2);
        ctx.fillRect(14, 6, 4, 2);
        
        // Wave details
        ctx.fillStyle = '#4169E1';
        ctx.fillRect(6, 12, 12, 2);
        ctx.fillRect(8, 16, 8, 2);
        
        return canvas;
    }
    
    generateLightningIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Background glow
        ctx.fillStyle = '#FFD70040';
        ctx.fillRect(6, 2, 12, 20);
        
        // Lightning bolt
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(12, 2, 4, 6);
        ctx.fillRect(10, 6, 6, 2);
        ctx.fillRect(10, 8, 4, 6);
        ctx.fillRect(8, 12, 6, 2);
        ctx.fillRect(8, 14, 4, 8);
        
        // Bright center
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(12, 4, 2, 4);
        ctx.fillRect(10, 10, 2, 4);
        
        return canvas;
    }
    
    generateVolcanoIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Mountain base
        ctx.fillStyle = '#4A4A4A';
        ctx.beginPath();
        ctx.moveTo(12, 6);
        ctx.lineTo(2, 22);
        ctx.lineTo(22, 22);
        ctx.fill();
        
        // Crater
        ctx.fillStyle = '#2F2F2F';
        ctx.fillRect(9, 6, 6, 3);
        
        // Lava
        ctx.fillStyle = '#FF4500';
        ctx.fillRect(10, 3, 4, 4);
        
        // Eruption particles
        ctx.fillStyle = '#FF6600';
        ctx.fillRect(8, 2, 2, 2);
        ctx.fillRect(14, 2, 2, 2);
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(11, 1, 2, 2);
        
        // Lava flow
        ctx.fillStyle = '#FF4500';
        ctx.fillRect(11, 9, 2, 13);
        
        return canvas;
    }
    
    generateEarthquakeIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Ground
        ctx.fillStyle = '#8B7355';
        ctx.fillRect(2, 12, 20, 10);
        
        // Crack lines
        ctx.fillStyle = '#000';
        ctx.fillRect(10, 12, 4, 10);
        ctx.fillRect(6, 14, 4, 2);
        ctx.fillRect(14, 14, 4, 2);
        ctx.fillRect(8, 18, 3, 2);
        ctx.fillRect(13, 18, 3, 2);
        
        // Shaking lines
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(4, 4, 3, 2);
        ctx.fillRect(8, 6, 3, 2);
        ctx.fillRect(13, 4, 3, 2);
        ctx.fillRect(17, 6, 3, 2);
        
        // Rocks
        ctx.fillStyle = '#696969';
        ctx.fillRect(3, 10, 4, 3);
        ctx.fillRect(17, 10, 4, 3);
        
        return canvas;
    }
    
    generateWildfireIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Fire base
        ctx.fillStyle = '#FF4500';
        ctx.fillRect(4, 10, 16, 12);
        
        // Flames
        ctx.fillStyle = '#FF6600';
        ctx.fillRect(6, 6, 4, 8);
        ctx.fillRect(10, 4, 4, 10);
        ctx.fillRect(14, 6, 4, 8);
        
        // Hot core
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(8, 8, 3, 6);
        ctx.fillRect(11, 6, 3, 8);
        ctx.fillRect(14, 8, 3, 6);
        
        // Bright center
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(10, 10, 4, 4);
        
        // Embers
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(4, 4, 2, 2);
        ctx.fillRect(18, 4, 2, 2);
        ctx.fillRect(6, 2, 2, 2);
        ctx.fillRect(16, 2, 2, 2);
        
        return canvas;
    }
    
    generateBlizzardIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Sky
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(2, 2, 20, 20);
        
        // Snow/ice
        ctx.fillStyle = '#FFFFFF';
        
        // Snowflake pattern
        ctx.fillRect(10, 4, 4, 16);
        ctx.fillRect(4, 10, 16, 4);
        ctx.fillRect(6, 6, 4, 4);
        ctx.fillRect(14, 6, 4, 4);
        ctx.fillRect(6, 14, 4, 4);
        ctx.fillRect(14, 14, 4, 4);
        
        // Center
        ctx.fillStyle = '#B0E0E6';
        ctx.fillRect(10, 10, 4, 4);
        
        return canvas;
    }
    
    // Tool icons
    generatePauseIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(6, 4, 4, 16);
        ctx.fillRect(14, 4, 4, 16);
        
        return canvas;
    }
    
    generateStepIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Play arrow
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.moveTo(6, 4);
        ctx.lineTo(16, 12);
        ctx.lineTo(6, 20);
        ctx.fill();
        
        // Bar
        ctx.fillRect(17, 4, 3, 16);
        
        return canvas;
    }
    
    generateTrashIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Lid
        ctx.fillStyle = '#FF6B6B';
        ctx.fillRect(4, 4, 16, 3);
        ctx.fillRect(10, 2, 4, 3);
        
        // Can body
        ctx.fillStyle = '#FF6B6B';
        ctx.fillRect(6, 7, 12, 14);
        
        // Lines
        ctx.fillStyle = '#CC5555';
        ctx.fillRect(9, 9, 2, 10);
        ctx.fillRect(13, 9, 2, 10);
        
        return canvas;
    }
    
    generateWorldIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Ocean
        ctx.fillStyle = '#1E90FF';
        ctx.beginPath();
        ctx.arc(12, 12, 10, 0, Math.PI * 2);
        ctx.fill();
        
        // Continents
        ctx.fillStyle = '#228B22';
        ctx.fillRect(6, 6, 6, 4);
        ctx.fillRect(14, 8, 4, 6);
        ctx.fillRect(8, 12, 4, 4);
        ctx.fillRect(4, 14, 3, 3);
        
        return canvas;
    }
    
    generateResetIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Circular arrow
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(12, 12, 8, 0.5, 5.5);
        ctx.stroke();
        
        // Arrow head
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.moveTo(18, 6);
        ctx.lineTo(20, 12);
        ctx.lineTo(14, 10);
        ctx.fill();
        
        return canvas;
    }
    
    generateSaveIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Disk body
        ctx.fillStyle = '#4169E1';
        ctx.fillRect(4, 4, 16, 16);
        
        // Metal slider
        ctx.fillStyle = '#C0C0C0';
        ctx.fillRect(8, 4, 8, 6);
        
        // Label area
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(6, 12, 12, 6);
        
        // Lines on label
        ctx.fillStyle = '#4169E1';
        ctx.fillRect(8, 14, 8, 1);
        ctx.fillRect(8, 16, 6, 1);
        
        return canvas;
    }
    
    generateLoadIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Folder back
        ctx.fillStyle = '#DAA520';
        ctx.fillRect(3, 6, 18, 14);
        
        // Folder tab
        ctx.fillStyle = '#B8860B';
        ctx.fillRect(3, 4, 8, 3);
        
        // Arrow
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(10, 10, 4, 6);
        ctx.beginPath();
        ctx.moveTo(7, 12);
        ctx.lineTo(12, 8);
        ctx.lineTo(17, 12);
        ctx.fill();
        
        return canvas;
    }
    
    // Tab icons
    generateTerrainTabIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Grass
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(2, 14, 20, 8);
        
        // Blades
        ctx.fillStyle = '#228B22';
        ctx.fillRect(4, 10, 2, 6);
        ctx.fillRect(8, 8, 2, 8);
        ctx.fillRect(12, 10, 2, 6);
        ctx.fillRect(16, 6, 2, 10);
        ctx.fillRect(20, 10, 2, 6);
        
        return canvas;
    }
    
    generateCreaturesTabIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Paw print
        ctx.fillStyle = '#8B4513';
        
        // Main pad
        ctx.fillRect(8, 12, 8, 6);
        
        // Toe pads
        ctx.fillRect(6, 6, 3, 4);
        ctx.fillRect(11, 4, 3, 4);
        ctx.fillRect(16, 6, 3, 4);
        
        return canvas;
    }
    
    generateCrownIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Crown base
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(4, 12, 16, 8);
        
        // Points
        ctx.fillRect(4, 6, 3, 8);
        ctx.fillRect(10, 4, 4, 10);
        ctx.fillRect(17, 6, 3, 8);
        
        // Jewels
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(5, 8, 2, 2);
        ctx.fillRect(17, 8, 2, 2);
        ctx.fillStyle = '#00BFFF';
        ctx.fillRect(11, 6, 2, 2);
        
        return canvas;
    }
    
    generateSkullIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Skull
        ctx.fillStyle = '#FFFFF0';
        ctx.fillRect(6, 4, 12, 12);
        
        // Eye sockets
        ctx.fillStyle = '#000';
        ctx.fillRect(8, 7, 3, 4);
        ctx.fillRect(14, 7, 3, 4);
        
        // Nose
        ctx.fillRect(11, 12, 3, 2);
        
        // Jaw
        ctx.fillStyle = '#FFFFF0';
        ctx.fillRect(7, 16, 10, 4);
        
        // Teeth
        ctx.fillStyle = '#000';
        ctx.fillRect(8, 16, 2, 2);
        ctx.fillRect(11, 16, 2, 2);
        ctx.fillRect(14, 16, 2, 2);
        
        return canvas;
    }
    
    generateStatsIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Bars
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(4, 14, 4, 6);
        ctx.fillStyle = '#2196F3';
        ctx.fillRect(10, 8, 4, 12);
        ctx.fillStyle = '#FF9800';
        ctx.fillRect(16, 4, 4, 16);
        
        return canvas;
    }
    
    generateWrenchIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Wrench handle
        ctx.fillStyle = '#696969';
        ctx.fillRect(4, 14, 12, 4);
        
        // Wrench head
        ctx.fillStyle = '#808080';
        ctx.fillRect(14, 10, 6, 4);
        ctx.fillRect(14, 14, 6, 4);
        
        // Jaw opening
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(16, 12, 4, 4);
        
        // Handle grip
        ctx.fillStyle = '#4CAF50';
        ctx.fillRect(4, 14, 4, 4);
        
        return canvas;
    }
    
    generatePopulationIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Person 1 (front)
        ctx.fillStyle = '#FFD1AA';
        ctx.fillRect(10, 6, 4, 4);
        ctx.fillStyle = '#3366CC';
        ctx.fillRect(9, 10, 6, 6);
        
        // Person 2 (left back)
        ctx.fillStyle = '#FFD1AA';
        ctx.fillRect(4, 4, 3, 3);
        ctx.fillStyle = '#228B22';
        ctx.fillRect(3, 7, 5, 5);
        
        // Person 3 (right back)
        ctx.fillStyle = '#FFD1AA';
        ctx.fillRect(17, 4, 3, 3);
        ctx.fillStyle = '#B22222';
        ctx.fillRect(16, 7, 5, 5);
        
        return canvas;
    }
    
    generateTemperatureIcon() {
        const canvas = this.createIconCanvas();
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        
        // Thermometer body
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(10, 4, 4, 12);
        
        // Bulb
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(8, 14, 8, 6);
        
        // Mercury
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(11, 8, 2, 8);
        ctx.fillRect(10, 16, 4, 3);
        
        // Scale marks
        ctx.fillStyle = '#000';
        ctx.fillRect(14, 6, 2, 1);
        ctx.fillRect(14, 9, 2, 1);
        ctx.fillRect(14, 12, 2, 1);
        
        return canvas;
    }
    
    getUIIcon(type) {
        if (!this.uiIcons) {
            this.generateUIIcons();
        }
        return this.uiIcons[type] || null;
    }
}
