// Civilization, Race, and Genetics System
class CivilizationSystem {
    constructor() {
        this.races = this.initializeRaces();
        this.kingdoms = [];
        this.civilizations = []; // Collection of related creatures
        this.mutations = this.initializeMutations();
        this.achievements = [];
        this.techTrees = this.initializeTechTrees();
        this.nextKingdomId = 1;
        this.nextCivilizationId = 1;
        this.usedKingdomNames = new Set(); // Track unique kingdom names
        this.kingdomNameGenerators = this.initializeKingdomNameGenerators();
        this.usedKingdomColors = new Set(); // Track unique kingdom colors
    }

    initializeKingdomNameGenerators() {
        return {
            human: [
                ['New', 'Old', 'Great', 'United', 'Eastern', 'Western', 'Northern', 'Southern', 'Holy', 'Royal'],
                ['York', 'Haven', 'Spring', 'Ford', 'Castle', 'Keep', 'Warren', 'shire', 'field', 'mount'],
                ['', ' Kingdom', ' Empire', ' Realm', ' Domain', ' Territory']
            ],
            elf: [
                ['Silver', 'Golden', 'Eternal', 'Ancient', 'Mystical', 'Twilight', 'Moonlit', 'Crystal', 'Starlight', 'Enchanted'],
                ['wood', 'vale', 'glade', 'haven', 'realm', 'throne', 'crown', 'light', 'star', 'mist'],
                ['', ' of the Woods', ' of Stars', ' Eternal', ' Timeless']
            ],
            dwarf: [
                ['Iron', 'Stone', 'Deep', 'Grand', 'Mighty', 'Ancient', 'North', 'South', 'Mount', 'Peak'],
                ['hold', 'forge', 'hall', 'deep', 'stone', 'gate', 'breach', 'horn', 'rock', 'guard'],
                ['', ' Kingdom', ' Stronghold', ' Citadel', ' Fortress']
            ],
            orc: [
                ['Dark', 'War', 'Wild', 'Savage', 'Storm', 'Blood', 'Fire', 'Tusk', 'Claw', 'Bone'],
                ['hold', 'tribe', 'clan', 'horde', 'peak', 'ridge', 'skull', 'tooth', 'fang', 'maw'],
                ['', ' Horde', ' Tribe', ' Clan', ' Dominion']
            ],
            undead: [
                ['Cursed', 'Eternal', 'Dark', 'Vile', 'Forsaken', 'Doomed', 'Plague', 'Death', 'Unholy', 'Decay'],
                ['tomb', 'tomb', 'mire', 'grave', 'crypt', 'lair', 'realm', 'den', 'abyss', 'blight'],
                ['', ' Undead', ' of Death', ' Eternal', ' Accursed']
            ]
        };
    }

    generateUniqueName(race) {
        const generators = this.kingdomNameGenerators[race];
        if (!generators) return `${this.races[race].name} Kingdom ${this.nextKingdomId}`;

        let name;
        let attempts = 0;
        const maxAttempts = 20;

        do {
            const prefix = generators[0][Math.floor(Math.random() * generators[0].length)];
            const middle = generators[1][Math.floor(Math.random() * generators[1].length)];
            const suffix = generators[2][Math.floor(Math.random() * generators[2].length)];
            
            name = (prefix + middle + suffix).replace(/([a-z])([A-Z])/g, '$1 $2').trim();
            attempts++;
        } while (this.usedKingdomNames.has(name) && attempts < maxAttempts);

        this.usedKingdomNames.add(name);
        return name;
    }

    generateUniqueKingdomColor(baseColor) {
        const hex = baseColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);

        let color;
        let attempts = 0;
        const maxAttempts = 30;

        do {
            const variation = Math.floor(Math.random() * 50) - 25;
            const newR = Math.max(0, Math.min(255, r + variation));
            const newG = Math.max(0, Math.min(255, g + variation));
            const newB = Math.max(0, Math.min(255, b + variation));
            
            color = '#' + [newR, newG, newB].map(x => x.toString(16).padStart(2, '0')).join('');
            attempts++;
        } while (this.usedKingdomColors.has(color) && attempts < maxAttempts);

        this.usedKingdomColors.add(color);
        return color;
    }

    initializeRaces() {
        return {
            human: {
                name: 'Human',
                baseColor: '#FFD4A3',
                traits: ['adaptable', 'ambitious', 'builder'],
                baseStats: { strength: 5, intelligence: 6, speed: 5, happiness: 3 },
                techSpeed: 1.0,
                startingTechLevel: 0,
                lifespan: 80,
                reproductionAge: 18,
                culture: 'Human', 
                religion: null,
                canUseTechnology: true,
                dietType: 'omnivore'
            },
            elf: {
                name: 'Elf',
                baseColor: '#90EE90',
                traits: ['graceful', 'magical', 'archery'],
                baseStats: { strength: 4, intelligence: 8, speed: 7, happiness: 5 },
                techSpeed: 1.2,
                startingTechLevel: 1,
                lifespan: 500,
                reproductionAge: 50,
                culture: 'Elvish',
                religion: null,
                canUseTechnology: true,
                dietType: 'herbivore'
            },
            dwarf: {
                name: 'Dwarf',
                baseColor: '#C0C0C0',
                traits: ['sturdy', 'miner', 'builder'],
                baseStats: { strength: 7, intelligence: 5, speed: 3, happiness: 4 },
                techSpeed: 1.3,
                startingTechLevel: 0,
                lifespan: 250,
                reproductionAge: 20,
                culture: 'Dwarven',
                religion: null,
                canUseTechnology: true,
                dietType: 'omnivore'
            },
            orc: {
                name: 'Orc',
                baseColor: '#8B4513',
                traits: ['aggressive', 'tribal', 'warrior'],
                baseStats: { strength: 8, intelligence: 3, speed: 6, happiness: 2 },
                techSpeed: 0.8,
                startingTechLevel: 0,
                lifespan: 60,
                reproductionAge: 15,
                culture: 'Orcish',
                religion: null,
                canUseTechnology: true,
                dietType: 'carnivore'
            },
            undead: {
                name: 'Undead',
                baseColor: '#4B0082',
                traits: ['immortal', 'cursed', 'dark'],
                baseStats: { strength: 6, intelligence: 7, speed: 4, happiness: -5 },
                techSpeed: 1.1,
                startingTechLevel: 1,
                lifespan: Infinity,
                reproductionAge: Infinity,
                culture: 'Undead',
                religion: null,
                canUseTechnology: true,
                dietType: 'necro'
            },
            // Animals (non-civilized)
            wolf: {
                name: 'Wolf',
                baseColor: '#808080',
                traits: ['pack-hunter', 'intelligent', 'nocturnal'],
                baseStats: { strength: 6, intelligence: 3, speed: 8, happiness: 1 },
                techSpeed: 0,
                startingTechLevel: -1,
                lifespan: 15,
                reproductionAge: 3,
                culture: null,
                religion: null,
                canUseTechnology: false,
                dietType: 'carnivore',
                isCivilized: false
            },
            bear: {
                name: 'Bear',
                baseColor: '#8B4513',
                traits: ['powerful', 'solitary', 'hibernating'],
                baseStats: { strength: 9, intelligence: 2, speed: 5, happiness: 0 },
                techSpeed: 0,
                startingTechLevel: -1,
                lifespan: 30,
                reproductionAge: 4,
                culture: null,
                religion: null,
                canUseTechnology: false,
                dietType: 'omnivore',
                isCivilized: false
            },
            deer: {
                name: 'Deer',
                baseColor: '#8B4513',
                traits: ['swift', 'herd', 'herbivore'],
                baseStats: { strength: 3, intelligence: 1, speed: 9, happiness: 2 },
                techSpeed: 0,
                startingTechLevel: -1,
                lifespan: 15,
                reproductionAge: 2,
                culture: null,
                religion: null,
                canUseTechnology: false,
                dietType: 'herbivore',
                isCivilized: false
            },
            eagle: {
                name: 'Eagle',
                baseColor: '#8B4513',
                traits: ['predator', 'flying', 'keen-sight'],
                baseStats: { strength: 5, intelligence: 3, speed: 10, happiness: 1 },
                techSpeed: 0,
                startingTechLevel: -1,
                lifespan: 40,
                reproductionAge: 5,
                culture: null,
                religion: null,
                canUseTechnology: false,
                dietType: 'carnivore',
                isCivilized: false
            },
            fish: {
                name: 'Fish',
                baseColor: '#FF6347',
                traits: ['aquatic', 'schooling', 'instinctive'],
                baseStats: { strength: 1, intelligence: 0, speed: 7, happiness: 0 },
                techSpeed: 0,
                startingTechLevel: -1,
                lifespan: 10,
                reproductionAge: 1,
                culture: null,
                religion: null,
                canUseTechnology: false,
                dietType: 'omnivore',
                isCivilized: false
            }
        };
    }

    initializeMutations() {
        return [
            {
                name: 'Acid Blood',
                effect: 'creature damages attackers on contact',
                rarity: 0.05,
                traits: ['acidic', 'dangerous'],
                statModifiers: { strength: 2, speed: -1 }
            },
            {
                name: 'Regeneration',
                effect: 'health regenerates over time',
                rarity: 0.08,
                traits: ['regenerative', 'resilient'],
                statModifiers: { strength: 1, speed: -2 }
            },
            {
                name: 'Gigantism',
                effect: 'creature is oversized and stronger',
                rarity: 0.04,
                traits: ['gigantic', 'powerful'],
                statModifiers: { strength: 5, speed: -3 }
            },
            {
                name: 'Speed Boost',
                effect: 'creature moves faster',
                rarity: 0.10,
                traits: ['swift', 'energetic'],
                statModifiers: { strength: -1, speed: 5 }
            },
            {
                name: 'Telepathy',
                effect: 'creature can communicate psychically',
                rarity: 0.06,
                traits: ['psychic', 'intelligent'],
                statModifiers: { intelligence: 4, strength: -1 }
            },
            {
                name: 'Wings',
                effect: 'creature can fly',
                rarity: 0.03,
                traits: ['flying', 'airborne'],
                statModifiers: { speed: 4, strength: -2 }
            },
            {
                name: 'Thick Skin',
                effect: 'creature takes less damage',
                rarity: 0.07,
                traits: ['armored', 'tough'],
                statModifiers: { strength: 2, speed: -2 }
            },
            {
                name: 'Intelligence Boost',
                effect: 'creature is smarter and learns faster',
                rarity: 0.09,
                traits: ['intellectual', 'clever'],
                statModifiers: { intelligence: 4, strength: -1 }
            },
            {
                name: 'Bioluminescence',
                effect: 'creature glows and attracts mates',
                rarity: 0.06,
                traits: ['glowing', 'luminescent'],
                statModifiers: { intelligence: 1, happiness: 2 }
            },
            {
                name: 'Venom',
                effect: 'creature has poisonous attack',
                rarity: 0.05,
                traits: ['venomous', 'toxic'],
                statModifiers: { strength: 3, speed: 1 }
            }
        ];
    }

    initializeTechTrees() {
        return {
            human: [
                { level: 0, name: 'Stone Tools', cost: 0, description: 'Basic tool crafting' },
                { level: 1, name: 'Bronze Working', cost: 100, description: 'Bronze weapons and tools' },
                { level: 2, name: 'Iron Age', cost: 300, description: 'Iron working and construction' },
                { level: 3, name: 'Agriculture', cost: 200, description: 'Farming and irrigation' },
                { level: 4, name: 'Writing', cost: 250, description: 'Written language and records' },
                { level: 5, name: 'Monarchy', cost: 400, description: 'Organized government' },
                { level: 6, name: 'Military Strategy', cost: 350, description: 'Advanced warfare tactics' },
                { level: 7, name: 'Architecture', cost: 500, description: 'Grand structures and cities' }
            ],
            elf: [
                { level: 0, name: 'Archery', cost: 0, description: 'Bow making and archery' },
                { level: 1, name: 'Nature Magic', cost: 150, description: 'Control of nature' },
                { level: 2, name: 'Forestry', cost: 200, description: 'Advanced forest management' },
                { level: 3, name: 'Enchanting', cost: 400, description: 'Item enchantment' },
                { level: 4, name: 'Immortality Rituals', cost: 600, description: 'Extended lifespan magic' },
                { level: 5, name: 'Portal Magic', cost: 500, description: 'Teleportation and rifts' }
            ],
            dwarf: [
                { level: 0, name: 'Mining', cost: 0, description: 'Ore extraction' },
                { level: 1, name: 'Smelting', cost: 100, description: 'Metal refining' },
                { level: 2, name: 'Stonework', cost: 150, description: 'Fine stone construction' },
                { level: 3, name: 'Forging', cost: 250, description: 'Weapon and armor crafting' },
                { level: 4, name: 'Engineering', cost: 400, description: 'Complex mechanical systems' },
                { level: 5, name: 'Deep Drilling', cost: 500, description: 'Ultra-deep mining' }
            ],
            orc: [
                { level: 0, name: 'Tribal Warfare', cost: 0, description: 'Basic combat training' },
                { level: 1, name: 'Shamanism', cost: 150, description: 'Spiritual power' },
                { level: 2, name: 'Beast Taming', cost: 200, description: 'Taming wild creatures' },
                { level: 3, name: 'War Drums', cost: 250, description: 'Morale and coordination' },
                { level: 4, name: 'Conquest', cost: 400, description: 'Empire building' }
            ],
            undead: [
                { level: 0, name: 'Necromancy', cost: 0, description: 'Basic undeath magic' },
                { level: 1, name: 'Soul Binding', cost: 200, description: 'Bind souls to vessels' },
                { level: 2, name: 'Plague Spreading', cost: 300, description: 'Create undead armies' },
                { level: 3, name: 'Immortality', cost: 500, description: 'True undeath' }
            ]
        };
    }

    createKingdom(centerX, centerY, race, name = null) {
        const raceData = this.races[race];
        if (!raceData) return null;

        const kingdom = {
            id: this.nextKingdomId++,
            name: name || this.generateUniqueName(race),
            race: race,
            centerX: centerX,
            centerY: centerY,
            population: 0,
            citizenCount: 0,
            territory: [], // Grid tiles controlled by kingdom
            buildings: [],
            structures: [], // Castle, towers, etc
            resources: { food: 100, gold: 50, wood: 100, stone: 50 },
            techLevel: raceData.startingTechLevel,
            happiness: 50,
            culture: raceData.culture,
            religion: null,
            diplomaticRelations: {}, // kingdom.id -> relation (-100 to 100)
            isAtWar: false,
            warTargets: [],
            alliances: [],
            createdAt: Date.now(),
            color: this.generateUniqueKingdomColor(raceData.baseColor),
            hasConstructedCapital: false,
            populationThreshold: 10 // Minimum population to construct capital
        };

        this.kingdoms.push(kingdom);
        return kingdom;
    }

    createCreatureWithTraits(x, y, race, traits = []) {
        const raceData = this.races[race];
        if (!raceData) return null;

        // Apply mutations and generate random traits
        const mutations = [];
        if (Math.random() < 0.15) { // 15% chance of mutation
            const mutation = this.mutations[Math.floor(Math.random() * this.mutations.length)];
            mutations.push(mutation.name);
        }

        const creature = {
            x: x,
            y: y,
            type: race,
            race: race,
            age: 0,
            energy: 100,
            speed: raceData.baseStats.speed / 10,
            direction: Math.random() * Math.PI * 2,
            health: 100,
            weapon: null,
            traits: [...traits, ...mutations],
            stats: { ...raceData.baseStats },
            happiness: raceData.culture ? 50 : 0,
            hunger: 100,
            skills: {
                melee: Math.random() * 5,
                magic: Math.random() * 3,
                crafting: Math.random() * 5,
                farming: Math.random() * 4
            },
            knowledge: 0,
            family: {
                parents: [],
                children: [],
                mate: null
            },
            kingdom: null,
            job: null, // farmer, warrior, mage, builder, etc.
            gender: Math.random() > 0.5 ? 'male' : 'female',
            genes: this.generateGenes(raceData)
        };

        // Apply stat modifiers from mutations
        mutations.forEach(mutName => {
            const mutation = this.mutations.find(m => m.name === mutName);
            if (mutation) {
                Object.keys(mutation.statModifiers).forEach(stat => {
                    creature.stats[stat] = Math.max(0, creature.stats[stat] + mutation.statModifiers[stat]);
                });
            }
        });

        return creature;
    }

    generateGenes(raceData) {
        return {
            hair: ['brown', 'black', 'blonde', 'red', 'white'][Math.floor(Math.random() * 5)],
            skinTone: Math.random(),
            height: Math.random() * 0.4 + 0.8, // 0.8x to 1.2x normal
            strength: Math.random() * 0.5 + 0.75,
            intelligence: Math.random() * 0.5 + 0.75,
            speed: Math.random() * 0.5 + 0.75,
            rarity: Math.random()
        };
    }

    assignCreatureToKingdom(creature, kingdom) {
        creature.kingdom = kingdom.id;
        creature.culture = kingdom.culture;
        creature.religion = kingdom.religion;
        kingdom.citizenCount++;
        kingdom.population++;
    }

    generateCastleStructure(kingdom, centerX, centerY) {
        /**
         * Generate a castle layout:
         * Main castle (3x3), surrounded by towers and walls
         */
        const structures = [];
        
        // Main castle - keep structure (center 3x3)
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                structures.push({
                    type: 'castle',
                    x: centerX + dx,
                    y: centerY + dy,
                    kingdomId: kingdom.id,
                    health: 300,
                    maxHealth: 300,
                    color: kingdom.color,
                    radius: 1.5
                });
            }
        }

        // Corner towers (guard towers)
        const corners = [[-3, -3], [3, -3], [-3, 3], [3, 3]];
        corners.forEach(([cx, cy]) => {
            structures.push({
                type: 'tower',
                x: centerX + cx,
                y: centerY + cy,
                kingdomId: kingdom.id,
                health: 150,
                maxHealth: 150,
                color: kingdom.color,
                radius: 0.8,
                arrowRange: 8
            });
        });

        // Walls connecting castle to towers (4 cardinal walls)
        const wallPositions = [
            { x: centerX, y: centerY - 2 }, // North
            { x: centerX, y: centerY + 2 }, // South
            { x: centerX - 2, y: centerY }, // West
            { x: centerX + 2, y: centerY }  // East
        ];

        wallPositions.forEach(pos => {
            structures.push({
                type: 'wall',
                x: pos.x,
                y: pos.y,
                kingdomId: kingdom.id,
                health: 100,
                maxHealth: 100,
                color: kingdom.color,
                radius: 0.6
            });
        });

        return structures;
    }

    generateVillageStructures(kingdom, centerX, centerY) {
        /**
         * Generate a small village:
         * Few houses around a center building
         */
        const structures = [];
        
        // Center meeting hall
        structures.push({
            type: 'hall',
            x: centerX,
            y: centerY,
            kingdomId: kingdom.id,
            health: 100,
            maxHealth: 100,
            color: kingdom.color,
            radius: 1
        });

        // Houses in circle around center
        const housePositions = [
            [-2, -2], [0, -2], [2, -2],
            [-2, 0], [2, 0],
            [-2, 2], [0, 2], [2, 2]
        ];

        housePositions.forEach(([dx, dy]) => {
            structures.push({
                type: 'house',
                x: centerX + dx,
                y: centerY + dy,
                kingdomId: kingdom.id,
                health: 50,
                maxHealth: 50,
                color: kingdom.color,
                radius: 0.7
            });
        });

        return structures;
    }

    shouldConstructCapital(kingdom) {
        // Build castle when population reaches threshold and not already built
        return kingdom.population >= kingdom.populationThreshold && !kingdom.hasConstructedCapital;
    }

    constructCapital(kingdom, territoryTiles) {
        // Find center of kingdom territory or use kingdom center
        if (kingdom.hasConstructedCapital) return;

        let centerX = kingdom.centerX;
        let centerY = kingdom.centerY;

        // Find best position (center of territory)
        if (territoryTiles && territoryTiles.length > 0) {
            let sumX = 0, sumY = 0;
            territoryTiles.slice(0, Math.min(100, territoryTiles.length)).forEach(tile => {
                sumX += tile.x;
                sumY += tile.y;
            });
            centerX = Math.round(sumX / Math.min(100, territoryTiles.length));
            centerY = Math.round(sumY / Math.min(100, territoryTiles.length));
        }

        const castle = this.generateCastleStructure(kingdom, centerX, centerY);
        kingdom.structures.push(...castle);
        kingdom.hasConstructedCapital = true;
    }

    constructVillage(kingdom, centerX, centerY) {
        const village = this.generateVillageStructures(kingdom, centerX, centerY);
        kingdom.structures.push(...village);
    }

    updateDiplomacy(kingdomId1, kingdomId2, change) {
        const k1 = this.kingdoms.find(k => k.id === kingdomId1);
        const k2 = this.kingdoms.find(k => k.id === kingdomId2);
        
        if (!k1 || !k2) return;

        if (!k1.diplomaticRelations[kingdomId2]) k1.diplomaticRelations[kingdomId2] = 0;
        if (!k2.diplomaticRelations[kingdomId1]) k2.diplomaticRelations[kingdomId1] = 0;

        k1.diplomaticRelations[kingdomId2] = Math.max(-100, Math.min(100, k1.diplomaticRelations[kingdomId2] + change));
        k2.diplomaticRelations[kingdomId1] = Math.max(-100, Math.min(100, k2.diplomaticRelations[kingdomId1] + change));

        // Declare war if relations drop below -70
        if (k1.diplomaticRelations[kingdomId2] < -70 && !k1.isAtWar) {
            k1.isAtWar = true;
            k1.warTargets.push(kingdomId2);
        }
        if (k2.diplomaticRelations[kingdomId1] < -70 && !k2.isAtWar) {
            k2.isAtWar = true;
            k2.warTargets.push(kingdomId1);
        }
    }

    advanceTechnology(kingdomId) {
        const kingdom = this.kingdoms.find(k => k.id === kingdomId);
        if (!kingdom) return false;

        const raceData = this.races[kingdom.race];
        const techTree = this.techTrees[kingdom.race];
        
        if (!techTree || kingdom.techLevel >= techTree.length - 1) return false;

        const nextTech = techTree[kingdom.techLevel + 1];
        if (kingdom.resources.gold >= nextTech.cost) {
            kingdom.resources.gold -= nextTech.cost;
            kingdom.techLevel++;
            return true;
        }
        return false;
    }

    spreadCulture(kingdomId, radius = 5) {
        const kingdom = this.kingdoms.find(k => k.id === kingdomId);
        if (!kingdom) return;

        // Culture spreads to nearby creatures
        // This would interact with the main game loop
    }

    addAchievement(kingdomId, achievementName) {
        const achievement = {
            kingdomId: kingdomId,
            name: achievementName,
            unlockedAt: Date.now()
        };
        this.achievements.push(achievement);
    }

    getKingdomStats(kingdomId) {
        const kingdom = this.kingdoms.find(k => k.id === kingdomId);
        if (!kingdom) return null;

        return {
            name: kingdom.name,
            race: kingdom.race,
            population: kingdom.citizenCount,
            techLevel: kingdom.techLevel,
            happiness: kingdom.happiness,
            resources: { ...kingdom.resources },
            territory: kingdom.territory.length,
            isAtWar: kingdom.isAtWar,
            allies: kingdom.alliances.length
        };
    }

    createSubspecies(baseRace, mutations = [], name = null) {
        const raceData = this.races[baseRace];
        if (!raceData) return null;

        const subspecies = {
            name: name || `${raceData.name} (${mutations.join('/')})`,
            baseRace: baseRace,
            mutations: mutations,
            traits: [...raceData.traits, ...mutations],
            statModifiers: {}
        };

        mutations.forEach(mutName => {
            const mutation = this.mutations.find(m => m.name === mutName);
            if (mutation) {
                Object.keys(mutation.statModifiers).forEach(stat => {
                    subspecies.statModifiers[stat] = (subspecies.statModifiers[stat] || 0) + mutation.statModifiers[stat];
                });
            }
        });

        return subspecies;
    }
}

// Export for use in other files
window.CivilizationSystem = CivilizationSystem;
