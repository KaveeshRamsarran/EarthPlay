# 🎪 Kingdom Auto-Generation - Quick Start Guide

## What's New? ✨

### Automatic Kingdom Creation
- **No manual kingdom creation needed!**
- Spawn 5+ creatures of the same race, watch them form kingdoms automatically
- Kingdoms get **unique, generated names** (Ironhold, Silverwood, etc.)
- Each kingdom has a **unique color** so you can tell them apart visually

### Automatic Capital Construction
- When a kingdom reaches **10 creatures**, a **full castle** spawns!
- Castles include:
  - Central keep (3×3 main structure)
  - 4 corner towers (defensive positions)
  - 4 connecting walls (perimeter defense)
  - Built within the kingdom's territory

### Visual Kingdom Identification
- **Kingdom names displayed in UI**
- **Color-coded structures** (red kingdom has red castle, etc.)
- **No duplicate colors** - each kingdom is visually distinct
- **Health bars** show structure damage

---

## How to Play

### Step 1: Spawn Creatures
```
Go to Creatures tab → Click "Humans" → Spawn 5+ on map
```

### Step 2: Watch Kingdom Form
```
Every game year, system checks if creatures cluster together
When 5+ are within 30-tile radius → Kingdom Forms!
(Kingdom gets random name + unique color)
```

### Step 3: Watch Capital Build
```
When kingdom population hits 10 → Castle spawns!
Full fortress appears at cluster center
```

### Step 4: Expand & Defend
```
More creatures spawn naturally
Kingdom grows
Multiple kingdoms can form from different clusters
```

---

## Kingdom Features

### Auto-Generated Names (Examples)

**Humans**: New York, Great Castle, Royal Mount, etc.

**Elves**: Silverwood, Golden Vale, Eternal Glade, etc.

**Dwarves**: Ironhold, Stoneforge, Deep Hall, etc.

**Orcs**: Darkhold, Warhorde, Savage Peak, etc.

**Undead**: Cursedtomb, Eternal Mire, Dark Grave, etc.

### Castle Architecture

```
        [Tower]
          |
       [Wall]
T---[Castle Keep]---T
          |
       [Wall]
        [Tower]
```

**Keep (3×3)**: Health 300 - Kingdom stronghold
**Towers (4)**: Health 150 each - Arrow defenders
**Walls (4)**: Health 100 each - Perimeter walls

### Villages (Optional)

```
[H] [H] [H]
[H] [Hall] [H]
[H] [H] [H]
```

(Constructible via `civSystem.constructVillage()`)

---

## Key Settings

### Auto-Creation Thresholds
- **Kingdom forms**: 5+ creatures in 30-tile radius
- **Capital builds**: 10+ creatures in kingdom
- **Check frequency**: Every game year
- **Territory radius**: 40 tiles from center

### Structure Health
- **Castle**: 300 HP (hardest to destroy)
- **Towers**: 150 HP each
- **Walls**: 100 HP each
- **Houses**: 50 HP (fragile)

---

## Things to Try

### Experiment 1: Multiple Kingdoms
1. Spawn 10 humans on left side
2. Spawn 10 elves on right side
3. Watch two separate kingdoms form!
4. They'll get different colors and names

### Experiment 2: Mixed Races
1. Spawn humans, elves, dwarves all in same area
2. Watch three kingdoms form (one per race)
3. They won't mix - each race stays with its own

### Experiment 3: Destroy a Kingdom
1. Let a kingdom build a castle
2. Use Divine Powers (Meteor, Tsunami) to damage structures
3. Watch kingdom respond

### Experiment 4: Large Empire
1. Spawn 50+ creatures of one race
2. Let them naturally cluster into multiple kingdoms
3. Watch multiple castles appear!

---

## Technical Details (For Reference)

### Files Modified
- `civilizationSystem.js` - Name/color generation, structure building
- `game.js` - Auto-formation logic, rendering

### No Manual Setup Needed!
- Just spawn creatures
- System handles everything else automatically

---

## FAQ

**Q: Why isn't a kingdom forming?**
A: Need 5+ creatures of same race within 30 tiles. Check the creature counts!

**Q: Can I have two kingdoms of the same race?**
A: Yes! If they cluster in different locations, each gets its own kingdom with different name/color.

**Q: Can kingdoms attack each other?**
A: Diplomacy system exists - they can ally or go to war! Check the Civilizations tab.

**Q: Can I destroy a castle?**
A: Yes! Use Divine Powers to damage structures (they have HP bars).

**Q: How long until a capital builds?**
A: Once kingdom has 10+ creatures, capital builds immediately next game year.

---

**Enjoy watching your civilizations rise!** 🏰✨

Open `index.html` and start creating kingdoms!
