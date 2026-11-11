import type { Sim } from './sim'

export type Mission = {
  title: string
  text: string
  tip: string
  check: (s: Sim) => boolean
  progress?: (s: Sim) => [number, number]
  win?: boolean
}

const has = (s: Sim, k: Parameters<Sim['count']>[0], n = 1) => s.count(k) >= n

export const MISSIONS: Mission[] = [
  {
    title: 'Power up',
    text: 'Build 2 solar arrays (key 7).',
    tip: 'Mars gets about 43% of the sunlight Earth does. Panels only work by day.',
    check: (s) => has(s, 'solar', 2),
    progress: (s) => [Math.min(2, s.count('solar')), 2],
  },
  {
    title: 'Find water',
    text: 'Place an ice drill (key 2) on a pale blue ice deposit.',
    tip: 'Water ice hides under the dust. Orbiters spot it with radar.',
    check: (s) => [...s.ents.values()].some((e) => e.kind === 'drill' && e.mineItem === 'ice'),
  },
  {
    title: 'Melt it down',
    text: 'Belt ice into an ice melter, then belt its water into the colony core. Deliver 10 water.',
    tip: 'Point the drill’s arrow at a belt. Drag to lay belts. Press R to rotate before placing.',
    check: (s) => s.delivered.water >= 10,
    progress: (s) => [Math.min(10, s.delivered.water), 10],
  },
  {
    title: 'Night shift',
    text: 'Build a battery bank to keep life support running after sunset.',
    tip: 'Watch the power bar at dusk. Surplus by day must cover the whole night.',
    check: (s) => has(s, 'battery'),
  },
  {
    title: 'Extend the grid',
    text: 'Build a power pylon. Buildings only get power inside the core’s or a pylon’s square — press P to see the grid.',
    tip: 'Pylons link to the core or to each other by cable. Out of reach, they carry nothing.',
    check: (s) => [...s.ents.values()].some((e) => e.kind === 'pylon' && e.onGrid),
  },
  {
    title: 'Metal works',
    text: 'Excavate hematite ore (dark red ground), smelt it and deliver 10 metal to the core.',
    tip: 'Hematite is iron oxide — the rust that makes Mars red.',
    check: (s) => s.delivered.metal >= 10,
    progress: (s) => [Math.min(10, s.delivered.metal), 10],
  },
  {
    title: 'Brick by brick',
    text: 'Excavate regolith from plain sand, bake it in a sinter kiln and deliver 10 bricks.',
    tip: 'Sintering fuses dust grains with heat alone — no water or cement.',
    check: (s) => s.delivered.brick >= 10,
    progress: (s) => [Math.min(10, s.delivered.brick), 10],
  },
  {
    title: 'Breathe easy',
    text: 'Build a MOXIE oxygen plant (key 0) to make oxygen from the CO₂ air.',
    tip: 'Mars air is 95% carbon dioxide. MOXIE pulls the oxygen atoms out.',
    check: (s) => has(s, 'moxie'),
  },
  {
    title: 'Clean the soil',
    text: 'Build a soil washer (2×2) and feed it regolith and water from two sides.',
    tip: 'Martian soil holds ~0.6% toxic perchlorate. Water rinses it out.',
    check: (s) => has(s, 'washer'),
  },
  {
    title: 'First harvest',
    text: 'Build a greenhouse (3×2), feed it clean soil and water, and deliver 10 food.',
    tip: 'Greenhouse: 2 soil + 3 water → 4 food. Give each ingredient its own belt.',
    check: (s) => s.delivered.food >= 10,
    progress: (s) => [Math.min(10, s.delivered.food), 10],
  },
  {
    title: 'Do science',
    text: 'Build a research lab and complete a research project.',
    tip: 'Open Research (key T). LED grow lights make greenhouses 50% faster.',
    check: (s) => s.done.size >= 1,
  },
  {
    title: 'Safe at home',
    text: 'Build a habitat (key 8) within 2 tiles of a regolith shield (key 9).',
    tip: 'About 2 m of regolith blocks most surface radiation. Supply ships bring crew only if there’s room.',
    check: (s) => [...s.ents.values()].some((e) => e.kind === 'habitat' && e.shielded),
  },
  {
    title: 'Upgrade',
    text: 'Select any building and upgrade it (U). Try turning a solar panel into an array — and then a station.',
    tip: 'A solar station plants new panels around itself. Upgrades cost more but save space.',
    check: (s) => s.upgrades > 0,
  },
  {
    title: 'Colony 001',
    text: 'Grow the colony to 20 colonists with no shortages.',
    tip: 'Each colonist needs 2 food, 2 water and 2 oxygen every sol.',
    check: (s) => s.colonists >= 20 && s.shortages.size === 0,
    progress: (s) => [Math.min(20, s.colonists), 20],
    win: true,
  },
]
