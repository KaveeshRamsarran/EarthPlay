# EarthPlay

A god simulator in the browser. Shape a living pixel world, seed it with life, and watch civilisations farm, build, research, expand, go to war, and fall — or rain ruin upon them.

No build step, no dependencies. Open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari) and play.

## Playing

1. Pick a world size, land shape, sea level, starting life and how often natural disasters strike on the title screen, then **Create world**.
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
- assigns jobs (farmers, woodcutters, miners, smiths, builders, warriors),
- gathers food, wood, stone, gold and ore, and builds houses, farms, granaries, windmills, mines, smithies, docks, markets, libraries, temples, watchtowers and barracks,
- lays roads to every building and highways to its sister towns, bridges rivers and paves streets in the Iron Age,
- forges copper, iron, steel, mithril and adamantine weapons and armour from the ore its miners dig up,
- launches fishing boats, trade carts and trade ships, settler ships to other islands and invasion fleets against overseas enemies,
- researches through five ages (Stone → Bronze → Iron → Steel → Golden), which unlocks better metals and upgrades buildings from huts to castles,
- sends settlers to found new towns when crowded.

Realms grow from Tribe to Chiefdom, Kingdom and Empire. They have rulers who age, die and are succeeded, and heroes level up from kills. Neighbouring realms grow to dislike each other, declare war, march armies (shown as red arrows on the map), besiege and capture towns, and eventually make peace. Friendly realms form alliances and defend each other. Large empires suffer rebellions. Everything is recorded in the **Chronicle**.

**Ores** — copper, iron, coal, gold, gems, mithril and adamantine veins lie in hills and mountains. Paint more from the **Ores** tab; meteors leave star-metal in their craters.

**Wildlife** — 21 animals, each living in its own biome, with herding, grazing, hunting, breeding and migration:
- grazers: deer, sheep, rabbits, chickens, cows, buffalo (which stampede at threats), desert camels, tundra penguins, monkeys, frogs, beach turtles and crabs, and bees that plant shrubs and heal burnt land;
- predators: foxes, wolves, hyena packs, bears, swamp crocodiles that snap at anyone wading in, and venomous snakes whose bite sickens;
- in the water: fish, and sharks that hunt anything swimming.

Penguins, frogs, turtles, crabs and crocodiles are amphibious and wade through shallow water.

**Monsters** — zombies that spread undeath; skeletons; demons that crawl out of volcanoes and set the ground alight; ice golems that freeze creatures and turn the land to tundra; UFOs that zap buildings and abduct people; dragons that burn the sky. Skeletons, demons and golems smash buildings.

**Natural disasters** (Off / Rare / Often, chosen per world) — meteors, tornadoes, earthquakes, volcanoes, blizzards with ice golems, UFO visits and dragons, all logged in the Chronicle.

**Powers** — terrain sculpting and painting; ore veins; spawning peoples, animals and monsters; Blessing, Rain, Bloom, Cure (also calms madness and thaws ice), Fireworks (realms cheer and warm to each other); Lightning, Fire, Bomb, Napalm, Acid, Blizzard (freezes land and creatures), Meteor, Earthquake, Tornado, Volcano, Plague, Madness (creatures attack friend and foe), Undeath, Cataclysm; and realm meddling: Discord, Harmony, Rebellion, Prosperity.

**Presentation** — pixel-art buildings for every race and age, with windows that light up at night, smoking chimneys, waving banners, turning windmills and glowing forges; realm colours and kingdom banners that stand out when zoomed out; chunk-baked pixel terrain with hill shading, shoreline foam and water shimmer, day/night lighting with lit windows and glowing lava, weather (rain and lightning storms), drifting clouds, particles, cartoon emote bubbles over creatures (hearts, alarms, skulls, music notes), ice-block and madness effects, UFO tractor beams, and synthesised sound. The HUD is a chunky pixel-art style: notched pixel frames, bevelled push buttons, the Pixelify Sans font throughout and hand-drawn pixel icons.

**Saves** — five slots plus autosave in browser storage (gzip-compressed with thumbnails), and export/import to a `.world` file.

## Project layout

```
index.html          page shell
css/style.css       HUD & menus (pixel/cartoon style)
js/core.js          RNG, noise, math, colour, spatial hash, events
js/data.js          terrain, species, buildings, ages, traits, names, tools
js/world.js         world grid, generation, ores, landmasses & seas, A* pathfinding, environment
js/units.js         creatures: steering, wildlife/monster AI, combat, levelling, disease, frost, madness
js/civ.js           kingdoms, cities, economy, ores & smithing, roads, trade, research, diplomacy, war, civilian AI
js/powers.js        visual effects (particles, emotes, fireworks) and god powers / disasters
js/vehicles.js      fishing boats, transports, trade ships and carts
js/sim.js           simulation root (DOM-free), habitats, migration, natural events
js/save.js          serialisation, compression, slots, file export
js/sprites.js       procedural pixel art: creatures, trees, ore, icons, banners
js/artbuild.js      pixel-art buildings and vehicles with animation marks
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

Generates every world shape, runs ~37 in-game years on each, fires every tool, checks world/kingdom/building invariants, checks that realms mine ore, equip people, build roads and launch boats, and round-trips a save. Requires Node 18+.
