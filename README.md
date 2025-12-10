# 🌍 Worldbox Clone - World Simulator Game

A fully-featured Worldbox game clone built with vanilla HTML, CSS, and JavaScript. Create and manage entire civilizations with pixel art graphics and dynamic simulation!

## 🎮 Features

### Terrain Tools
- **Grass** 🌱 - Basic terrain
- **Dirt** 🟫 - Soft ground
- **Stone** ⬜ - Hard rock
- **Sand** 🟨 - Desert terrain
- **Water** 💧 - Liquid that creatures navigate around
- **Lava** 🔥 - Hazardous terrain that damages creatures
- **Forest** 🌲 - Dense vegetation
- **Mountain** ⛰️ - High elevation terrain

### Creatures
- **Humans** 👤 - Balanced creatures
- **Elves** 👳 - Graceful and quick
- **Dwarves** 🧔 - Strong and sturdy
- **Orcs** 👹 - Aggressive and powerful
- **Undead** 💀 - (Available for spawning)

### Hazards & Disasters
- **Meteor** ☄️ - Creates lava craters and destroys creatures
- **Plague** ☠️ - Damages nearby creatures
- **Lightning** ⚡ - Strikes and devastates terrain
- **Volcano** 🌋 - Erupts with massive lava flows

### Simulation Features
- **Living Creatures** - Move autonomously, consume energy, age
- **Reproduction** - Creatures can breed when well-fed
- **Terrain Interactions** - Creatures navigate and interact with environment
- **Health System** - Creatures take damage from hazards and lava
- **Population Tracking** - Monitor creature counts by species
- **Year Counter** - Track passage of time
- **Particle Effects** - Visual effects for disasters

### UI & Controls
- **Brush Size Control** - Adjust drawing size from 1-20 pixels
- **Game Speed Control** - Speed up or slow down simulation
- **Pause/Resume** - Stop time to plan your world
- **World Statistics** - Live population and year tracking
- **Auto-Generated Terrain** - Creates realistic random worlds
- **Clean, Intuitive Interface** - Green-themed dark UI

## 🚀 Getting Started

1. **Open in Browser**
   - Simply open `index.html` in any modern web browser
   - No server or installation required!

2. **Basic Controls**
   - **Left Click + Drag** - Paint terrain
   - **Right Click on terrain icon** - Select terrain type
   - **Click creature icon + Click map** - Spawn creatures
   - **Click hazard icon + Click map** - Trigger disasters
   - **Adjust slider** - Change brush size or speed

3. **First Steps**
   - Click "Generate Terrain" to create a random world
   - Select creatures from the sidebar and click on the map to spawn them
   - Watch them move, interact, and reproduce!
   - Use hazards to create chaos and destruction

## 🎯 Gameplay Tips

### Creating a Thriving Civilization
1. Generate terrain with forests and grasslands for creatures to live on
2. Spawn multiple creatures of different species
3. Give them time to breed and populate
4. Monitor population statistics in the sidebar
5. Watch different species interact and compete

### Strategic Disaster Management
- Use meteors to create obstacles for civilizations
- Cast plague to reduce overpopulation
- Use lightning to devastate enemy territories
- Erupt volcanoes for dramatic landscape changes

### Terrain Design
- Water slows creatures down and can be used as barriers
- Mountains create natural boundaries
- Forests attract and sustain populations
- Mix terrains to create interesting landscapes

## 📊 Statistics Panel

The sidebar displays real-time information:
- **Population** - Total creature count
- **Species Counts** - Individual counts for each race
- **Year** - Elapsed in-game time
- Great for monitoring civilization progress!

## ⚙️ Technical Details

- **Pure JavaScript** - No frameworks or dependencies
- **Canvas-based Rendering** - 16x16 pixel sprites
- **Procedural Generation** - Dynamic terrain creation
- **Optimized Performance** - Smooth 60 FPS gameplay
- **Responsive Design** - Adapts to different screen sizes

### Architecture
- `index.html` - Main HTML structure and UI
- `styles.css` - Beautiful dark theme with green accents
- `spriteGenerator.js` - Procedural pixelated sprite generation
- `game.js` - Core game logic and simulation engine

## 🎨 Art Style

All sprites are procedurally generated pixel art with:
- Consistent 16x16 pixel size
- Color-coded terrains for easy identification
- Distinct creature designs for each race
- Particle effects for visual feedback

## 🔄 Game Loop

The game runs at 60 FPS with:
- Creature AI (movement, energy management, reproduction)
- Environmental interactions
- Particle updates
- Real-time statistics
- Smooth rendering

## 💡 Advanced Features

### Creature AI
- Random pathfinding
- Energy-based survival
- Age-based death
- Reproduction when fed
- Damage from hazards and lava

### Terrain Generation
- Perlin-like noise for realistic landscapes
- Varied biome distribution
- Water bodies and mountains
- Forest clustering

### Physics Simulation
- Creature boundary detection
- Terrain collision avoidance
- Damage calculations
- Environmental effects

## 🐛 Browser Compatibility

Works on:
- Chrome/Chromium (Recommended)
- Firefox
- Edge
- Safari
- Any modern browser with Canvas support

## 🎓 Learning Resources

This project demonstrates:
- Canvas 2D API for graphics
- Event handling and user interaction
- Object-oriented JavaScript
- Game loop architecture
- Procedural generation algorithms
- Entity-component systems

## 📝 License

All rights belong to https://www.superworldbox.com/, this is just a personal project re-creation of the creator's game

## 🎉 Enjoy!

Create your own worlds, watch civilizations rise and fall, and experience the power of being a god in your own digital universe!

---

**Worldbox Clone v1.0** - Made with ❤️ using vanilla JavaScript
