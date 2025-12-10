// Sprite Generator - Creates pixelated 2D sprites
class SpriteGenerator {
    constructor(pixelSize = 16) {
        this.pixelSize = pixelSize;
        this.sprites = {};
        this.generateAllSprites();
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

        // Creature sprites
        this.sprites.human = this.generateHuman();
        this.sprites.elf = this.generateElf();
        this.sprites.dwarf = this.generateDwarf();
        this.sprites.orc = this.generateOrc();
        this.sprites.undead = this.generateUndead();
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

        ctx.fillStyle = '#4A4A4A';
        ctx.fillRect(0, 0, 16, 16);

        // Mountain peak
        ctx.fillStyle = '#696969';
        ctx.beginPath();
        ctx.moveTo(8, 2);
        ctx.lineTo(14, 10);
        ctx.lineTo(2, 10);
        ctx.fill();

        // Snow peak
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(8, 2);
        ctx.lineTo(10, 6);
        ctx.lineTo(6, 6);
        ctx.fill();

        return canvas;
    }

    // Creature generators
    generateHuman() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        // Head
        ctx.fillStyle = '#FDBCB4';
        ctx.fillRect(6, 1, 4, 4);

        // Body
        ctx.fillStyle = '#FF6B9D';
        ctx.fillRect(6, 5, 4, 5);

        // Arms
        ctx.fillStyle = '#FDBCB4';
        ctx.fillRect(4, 6, 2, 3);
        ctx.fillRect(10, 6, 2, 3);

        // Legs
        ctx.fillStyle = '#4A90E2';
        ctx.fillRect(6, 10, 2, 6);
        ctx.fillRect(8, 10, 2, 6);

        // Eyes
        ctx.fillStyle = '#000000';
        ctx.fillRect(7, 2, 1, 1);
        ctx.fillRect(9, 2, 1, 1);

        return canvas;
    }

    generateElf() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        // Head (pointy ears)
        ctx.fillStyle = '#E8BB9B';
        ctx.fillRect(6, 2, 4, 3);

        // Ears
        ctx.fillStyle = '#D4A574';
        ctx.fillRect(5, 0, 1, 2);
        ctx.fillRect(10, 0, 1, 2);

        // Body
        ctx.fillStyle = '#00AA44';
        ctx.fillRect(6, 5, 4, 5);

        // Arms
        ctx.fillStyle = '#E8BB9B';
        ctx.fillRect(4, 6, 2, 3);
        ctx.fillRect(10, 6, 2, 3);

        // Legs
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(6, 10, 2, 6);
        ctx.fillRect(8, 10, 2, 6);

        // Eyes (pointed)
        ctx.fillStyle = '#00FF00';
        ctx.fillRect(7, 3, 1, 1);
        ctx.fillRect(9, 3, 1, 1);

        return canvas;
    }

    generateDwarf() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        // Head with beard
        ctx.fillStyle = '#D2B48C';
        ctx.fillRect(5, 2, 6, 3);

        // Beard
        ctx.fillStyle = '#8B7355';
        ctx.fillRect(5, 4, 6, 2);

        // Body (stocky)
        ctx.fillStyle = '#DC143C';
        ctx.fillRect(5, 6, 6, 4);

        // Arms
        ctx.fillStyle = '#D2B48C';
        ctx.fillRect(3, 7, 2, 2);
        ctx.fillRect(11, 7, 2, 2);

        // Legs (short)
        ctx.fillStyle = '#4A4A4A';
        ctx.fillRect(6, 10, 2, 3);
        ctx.fillRect(8, 10, 2, 3);

        // Axe
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(2, 7, 1, 4);

        return canvas;
    }

    generateOrc() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        // Head (green)
        ctx.fillStyle = '#6B8E23';
        ctx.fillRect(6, 1, 4, 4);

        // Tusks
        ctx.fillStyle = '#FFFFF0';
        ctx.fillRect(5, 4, 1, 2);
        ctx.fillRect(10, 4, 1, 2);

        // Body
        ctx.fillStyle = '#556B2F';
        ctx.fillRect(6, 5, 4, 5);

        // Arms
        ctx.fillStyle = '#6B8E23';
        ctx.fillRect(4, 6, 2, 3);
        ctx.fillRect(10, 6, 2, 3);

        // Legs
        ctx.fillStyle = '#3D4D17';
        ctx.fillRect(6, 10, 2, 6);
        ctx.fillRect(8, 10, 2, 6);

        // Eyes (red)
        ctx.fillStyle = '#FF0000';
        ctx.fillRect(7, 2, 1, 1);
        ctx.fillRect(9, 2, 1, 1);

        return canvas;
    }

    generateUndead() {
        const canvas = this.createCanvas();
        const ctx = canvas.getContext('2d');

        // Head (skull)
        ctx.fillStyle = '#D3D3D3';
        ctx.fillRect(6, 1, 4, 4);

        // Eye sockets
        ctx.fillStyle = '#000000';
        ctx.fillRect(7, 2, 1, 1);
        ctx.fillRect(9, 2, 1, 1);

        // Jaw
        ctx.fillStyle = '#A9A9A9';
        ctx.fillRect(6, 4, 4, 1);

        // Body (skeletal)
        ctx.fillStyle = '#C0C0C0';
        ctx.fillRect(6, 5, 4, 5);

        // Spine
        ctx.fillStyle = '#A9A9A9';
        ctx.fillRect(7, 5, 2, 5);

        // Legs
        ctx.fillStyle = '#808080';
        ctx.fillRect(6, 10, 2, 6);
        ctx.fillRect(8, 10, 2, 6);

        return canvas;
    }

    getSprite(type) {
        return this.sprites[type] || this.sprites.grass;
    }
}
