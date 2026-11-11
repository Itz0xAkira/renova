# RENOVA — build a colony on Mars

An educational Mars colony factory game (think Factorio, on Mars), built for a NASA challenge.
Mine ice and rock, chain machines together with conveyor belts, and turn Mars itself into
water, metal, bricks, food, oxygen and power — while keeping your crew alive through cold
nights, dust storms and solar flares.

- **Website** (`/`): the RENOVA landing page.
- **Game** (`/play`): the colony sim, built with Phaser 3 inside Next.js.

## Play

- Pick a module from the build bar, click to place, **R** to rotate, right-click to remove.
- Drag to lay conveyor belts. Drag a belt across another to build a junction.
- Every machine pushes its output toward its orange arrow; anything that reaches the core is stored.
- Press **H** in game for the illustrated guide.

## Science inside

Every building and research card carries a real fact: MOXIE making oxygen from CO₂, perchlorate
in Martian soil, ice under the surface, 43% of Earth's sunlight, regolith radiation shielding,
NASA's Kilopower reactor and more.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run test:sim   # headless simulation tests
npm run build
```

### Layout

| Path | What |
| --- | --- |
| `src/app` | Next.js routes: `/` (site) and `/play` (game) |
| `src/site` | The landing page sections and its canvas pixel engine |
| `src/game/sim.ts` | The simulation: belts, machines, power, crew, events, saving |
| `src/game/data.ts`, `missions.ts` | Buildings, items, research and missions |
| `src/game/MarsScene.ts`, `units.ts` | Phaser rendering, input, drones, rovers and crew |
| `src/game/art.ts`, `structures.ts`, `pixel.ts` | All pixel art, generated in code at load |
| `src/game/Hud.tsx`, `HowToPlay.tsx` | The React HUD and the guide |
| `scripts/` | Headless sim tests |
