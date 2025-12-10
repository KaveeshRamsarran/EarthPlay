# Kingdom Names Reference - Auto-Generated Examples

## 🏰 Example Kingdom Names

### Human Kingdoms
- New York
- Old Haven
- Great Spring
- United Ford
- Eastern Castle
- Western Keep
- Northern Warren
- Southern Shire Kingdom
- Holy Field
- Royal Mount Empire

### Elf Kingdoms
- Silverwood of the Woods
- Golden Vale of Stars
- Eternal Glade of the Woods
- Ancient Haven Eternal
- Mystical Realm Timeless
- Twilight Throne of the Woods
- Moonlit Crown Eternal
- Crystal Light of Stars
- Starlight Mist Timeless
- Enchanted Star of the Woods

### Dwarf Kingdoms
- Ironhold Kingdom
- Stoneforge Stronghold
- Deep Hall Citadel
- Grand Gate Fortress
- Mighty Breach Kingdom
- Ancient Horn Stronghold
- North Stone Citadel
- South Guard Fortress
- Mount Rock Kingdom
- Peak Throne Stronghold

### Orc Kingdoms
- Darkhold Horde
- Warhorde Tribe
- Wild Clan
- Savage Peak Horde
- Stormhold Tribe
- Bloodclan Dominion
- Firehorde Tribe
- Tuskclan Dominion
- Clawpeaks Horde
- Bonefang Tribe

### Undead Kingdoms
- Cursedtomb Undead
- Eternal Mire of Death
- Dark Grave Accursed
- Vile Crypt of Death
- Forsaken Abyss Eternal
- Doomedtomb Undead
- Plague Lair of Death
- Death Realm Accursed
- Unholy Blight Eternal
- Decay Abyss Accursed

---

## 🎨 Color-Coding System

Each kingdom gets a **unique color variation** of its race's base color:

### Race Base Colors
- **Human**: #FFD4A3 (tan/beige) → variations: golden, copper, bronze
- **Elf**: #90EE90 (light green) → variations: forest green, emerald, sage
- **Dwarf**: #C0C0C0 (silver) → variations: steel, platinum, iron gray
- **Orc**: #8B4513 (saddle brown) → variations: dark brown, rust, amber
- **Undead**: #4B0082 (indigo) → variations: deep purple, violet, dark blue

Each kingdom's color is randomly offset by ±25 in RGB values to ensure uniqueness!

### Example Color Sets for Same Race
```
Kingdom 1: #FFE5B4 (Light Tan)
Kingdom 2: #FFC280 (Gold)
Kingdom 3: #D9A574 (Copper)
Kingdom 4: #CD9D6A (Bronze)
```

No two kingdoms of the same race will ever have identical colors!

---

## 🏗️ Structure Placement Example

### Castle Layout (9-tile footprint)
```
       Tower
        │
      North Wall
   Tower—Castle—Tower
        │   │   │
      South Wall
        │
       Tower

Actual Grid Layout:
    [Tower]
      [Wall]
T-[Castle Core]-T
      [Wall]
    [Tower]
```

### Village Layout (9-tile footprint)
```
[House] [House] [House]
[House] [Hall]  [House]
[House] [House] [House]

(Hall has door facing South)
```

---

## 📊 Auto-Generation Statistics

### Creation Triggers
- **Kingdom Formation**: 5+ creatures within 30-tile radius
- **Capital Construction**: Population reaches 10 creatures
- **Auto-Check Frequency**: Every game year (60 updates)

### Naming Guarantees
- ✓ No duplicate names within session
- ✓ Culturally appropriate names per race
- ✓ Lore-consistent terminology
- ✓ Range: 2-6 words per kingdom name

### Color Guarantees
- ✓ No two kingdoms share same color
- ✓ 30 maximum unique colors per race (RGB variation space)
- ✓ Colors persist throughout kingdom's lifetime
- ✓ Unique colors help identify kingdoms on-screen

---

## 🎮 Player Experience Flow

**Turn 1-5**: Spawn humans/elves/dwarves
↓
**Turn 6-15**: Creatures wander and group naturally
↓
**Turn 15-25**: "Ironhold Kingdom has risen!" (5+ creatures cluster)
↓
**Turn 25-35**: "Ironhold Kingdom builds capital!" (10+ population)
↓
**Turn 35+**: Watch castle grow, defend territory, expand

---

## 🔄 Continuous Generation

Every game year:
1. Check each civilized race for new clusters
2. Generate cluster center
3. Find unclaimed creatures in cluster
4. If 5+ creatures and no nearby kingdom → Create kingdom with:
   - Generated name
   - Unique color
   - Territory bounds
5. Assign all cluster creatures to kingdom

If population reaches 10:
1. Calculate best location (territory center)
2. Build castle (9 main structures + 4 towers + 4 walls)
3. Mark as constructed (won't rebuild)

---

**The system is fully autonomous - sit back and watch civilizations emerge!** 🌍✨
