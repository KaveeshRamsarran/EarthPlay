# EarthPlay

A god simulator in the browser. Shape a living pixel world, seed it with life, and watch civilisations farm, build, research, expand, go to war, and fall — or rain ruin upon them.

No build step, no dependencies. Open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari) and play.

## Playing

1. Pick a world size, land shape, sea level and starting life on the title screen, then **Create world**.
2. Choose a power from the dock at the bottom and **left-drag** on the map to use it.
3. **Right/middle-drag** to pan, **scroll** to zoom. Use **Inspect** to click any creature, building or territory.

| Key | Action |
| --- | --- |
| `Space` | Pause / resume |
| `1` `2` `3` `4` | Speed 1×, 2×, 5×, 10× |
| `W A S D` / arrows | Pan |
| `[` `]` | Brush size |
| `I` | Inspect tool |
| `B` | Toggle realm borders |
| `K` / `C` / `G` | Realms / Chronicle / Stats panels |
| `F` | Follow the selected creature |
| `M` | Toggle minimap |
| `Ctrl+S` / `Ctrl+O` | Quick-save / load |
| `H` | Help |

## What's in the world

**Terrain** — procedurally generated continents (fBm noise, ridged mountains, rivers that flow downhill, biomes from temperature and moisture). Ocean, shallows, beaches, grassland, savanna, desert, swamp, tundra, hills, mountains, lava. Forests spread on their own; fire spreads through them with the wind; lava cools to basalt; scorched land slowly heals.

**Peoples** — Humans, Elves, Dwarves and Orcs. Drop a few on good land and they found a realm. Each settlement:
- claims territory that grows with its population,
- assigns jobs (farmers, woodcutters, miners, builders, warriors),
- gathers food, wood, stone and gold and builds houses, farms, mines, temples, watchtowers and barracks,
- wears footpaths into roads where people walk,
- researches through five ages (Stone → Bronze → Iron → Steel → Golden), which upgrades weapons and town halls,
- sends settlers to found new towns when crowded.

Realms have rulers who age, die and are succeeded; heroes level up from kills. Neighbouring realms grow to dislike each other, declare war, march armies, besiege and capture towns, and eventually make peace. Large empires suffer rebellions. Everything is recorded in the **Chronicle**.

**Wildlife & monsters** — deer, sheep, rabbits, wolves, bears and fish with herding, grazing, hunting, breeding and migration; zombies that spread undeath; dragons that burn the sky.

**Powers** — terrain sculpting and painting; spawning life; Blessing, Rain, Bloom, Cure; Lightning, Fire, Meteor, Earthquake, Tornado, Volcano, Plague, Undeath, Cataclysm; and realm meddling: Discord, Harmony, Rebellion, Prosperity.

**Presentation** — chunk-baked pixel terrain with hill shading, shoreline foam and water shimmer, day/night lighting with lit windows and glowing lava, weather (rain and lightning storms), drifting clouds, particles, and synthesised sound.

**Saves** — five slots plus autosave in browser storage (gzip-compressed with thumbnails), and export/import to a `.world` file.

## Project layout

```
index.html          page shell
css/style.css       HUD & menus
js/core.js          RNG, noise, math, colour, spatial hash, events
js/data.js          terrain, species, buildings, ages, traits, names, tools
js/world.js         world grid, generation, landmasses, environment (fire, growth, weather)
js/units.js         creatures: steering, wildlife/monster AI, combat, levelling, disease
js/civ.js           kingdoms, cities, economy, buildings, research, diplomacy, war, civilian AI
js/powers.js        visual effects and god powers / disasters
js/sim.js           simulation root (DOM-free)
js/save.js          serialisation, compression, slots, file export
js/sprites.js       procedural pixel art: creatures, buildings, trees, icons, banners
js/render.js        renderer (terrain chunks, territory, entities, lighting, weather) and minimap
js/audio.js         WebAudio sound effects and ambience
js/ui.js            dock, panels, chronicle, stats, modals
js/game.js          main loop, input, modes, persistence glue
js/main.js          boot & title screen
tests/sim.test.js   headless simulation test
```

The simulation (`core` → `sim`, plus `save`) has no DOM dependency and runs at a fixed 30 ticks per second; rendering interpolates between ticks.

## Testing

```
npm test            # or: node tests/sim.test.js
```

Generates every world shape, runs ~37 in-game years on each, fires every tool, checks world/kingdom/building invariants and round-trips a save. Requires Node 18+.
