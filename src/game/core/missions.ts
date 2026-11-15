import type { Sim } from '@/game/core/sim'
import { BUILDINGS, type Kind } from '@/game/core/data'

/** A building's footprint as text, e.g. "4×4", so mission texts never go stale. */
const size = (k: Kind) => `${BUILDINGS[k].w}×${BUILDINGS[k].h}`

export type Mission = {
  /** Stable id, stored in saves (list positions change when missions are added). */
  id: string
  title: string
  text: string
  tip: string
  check: (s: Sim) => boolean
  progress?: (s: Sim) => [number, number]
  win?: boolean
}

const has = (s: Sim, k: Parameters<Sim['count']>[0], n = 1) => s.count(k) >= n
const any = (s: Sim, k: Parameters<Sim['list']>[0], f: (e: ReturnType<Sim['list']>[number]) => boolean) => s.list(k).some(f)

export const MISSIONS: Mission[] = [
  {
    id: 'power',
    title: 'Power up',
    text: 'Build 2 solar panels (key 7).',
    tip: 'Mars gets about 43% of the sunlight Earth does. Panels only work by day.',
    check: (s) => has(s, 'solar', 2),
    progress: (s) => [Math.min(2, s.count('solar')), 2],
  },
  {
    id: 'water',
    title: 'Find water',
    text: 'Place an ice drill (key 2) on a pale blue ice deposit.',
    tip: 'Water ice hides under the dust. Orbiters spot it with radar.',
    check: (s) => any(s, 'drill', (e) => e.mineItem === 'ice'),
  },
  {
    id: 'melt',
    title: 'Melt it down',
    text: 'Belt ice into an ice melter, then belt its water into the colony core. Deliver 10 water.',
    tip: 'Lay a belt beside the drill pointing away from it, or put a melter right against it. Drag to lay belts; R turns them.',
    check: (s) => s.delivered.water >= 10,
    progress: (s) => [Math.min(10, s.delivered.water), 10],
  },
  {
    id: 'battery',
    title: 'Night shift',
    text: 'Build a battery bank to keep life support running after sunset.',
    tip: 'Watch the power bar at dusk. Surplus by day must cover the whole night.',
    check: (s) => has(s, 'battery'),
  },
  {
    id: 'grid',
    title: 'Extend the grid',
    text: 'Build a power pylon. Buildings only get power inside the core’s or a pylon’s square — press P to see the grid.',
    tip: 'Pylons link to the core or to each other by cable. Out of reach, they carry nothing.',
    check: (s) => any(s, 'pylon', (e) => e.onGrid),
  },
  {
    id: 'metal',
    title: 'Metal works',
    text: 'Excavate hematite ore (dark red ground), smelt it and deliver 10 metal to the core.',
    tip: 'Hematite is iron oxide — the rust that makes Mars red.',
    check: (s) => s.delivered.metal >= 10,
    progress: (s) => [Math.min(10, s.delivered.metal), 10],
  },
  {
    id: 'brick',
    title: 'Brick by brick',
    text: 'Excavate regolith from plain sand, bake it in a sinter kiln and deliver 10 bricks.',
    tip: 'Sintering fuses dust grains with heat alone — no water or cement.',
    check: (s) => s.delivered.brick >= 10,
    progress: (s) => [Math.min(10, s.delivered.brick), 10],
  },
  {
    id: 'moxie',
    title: 'Breathe easy',
    text: 'Build a MOXIE oxygen plant (key 0) to make oxygen from the CO₂ air.',
    tip: 'Mars air is 95% carbon dioxide. MOXIE pulls the oxygen atoms out.',
    check: (s) => has(s, 'moxie'),
  },
  {
    id: 'washer',
    title: 'Clean the soil',
    text: `Build a soil washer (${size('washer')}) and feed it regolith and water from two sides.`,
    tip: 'Martian soil holds ~0.6% toxic perchlorate. Water rinses it out.',
    check: (s) => has(s, 'washer'),
  },
  {
    id: 'harvest',
    title: 'First harvest',
    text: `Build a greenhouse (${size('greenhouse')}), feed it clean soil and water, and deliver 10 food.`,
    tip: 'Greenhouse: 2 soil + 3 water → 4 food. Give each ingredient its own belt.',
    check: (s) => s.delivered.food >= 10,
    progress: (s) => [Math.min(10, s.delivered.food), 10],
  },
  {
    id: 'science',
    title: 'Do science',
    text: 'Build a research lab and complete a research project.',
    tip: 'Open Research (key T). LED grow lights make greenhouses 50% faster.',
    // the core researches slowly on its own, so this needs a project a lab helped finish
    // (or, if everything is already researched, just a lab)
    check: (s) => has(s, 'lab') && (s.labProjects >= 1 || s.current === null),
  },
  {
    id: 'habitat',
    title: 'Safe at home',
    text: 'Build a habitat (key 8) within 3 tiles of a regolith shield (key 9).',
    tip: 'About 2 m of regolith blocks most surface radiation. Supply ships bring crew only if there’s room.',
    check: (s) => any(s, 'habitat', (e) => e.shielded),
  },
  {
    id: 'upgrade',
    title: 'Upgrade',
    text: 'Select any building and upgrade it (U). Try turning a solar panel into an array — and then a station.',
    tip: 'A solar station plants new panels around itself. Upgrades cost more but save space.',
    check: (s) => s.upgrades > 0, // any building above level 1
  },
  {
    id: 'colony',
    title: 'Colony 001',
    text: 'Grow the colony to 20 colonists with no shortages.',
    tip: 'Each colonist needs 2 food, 2 water and 2 oxygen every sol.',
    check: (s) => s.colonists >= 20 && s.shortages.size === 0,
    progress: (s) => [Math.min(20, s.colonists), 20],
    win: true,
  },
]

