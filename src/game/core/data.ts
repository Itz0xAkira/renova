/**
 * RENOVA game data: items, buildings, research, grid and upgrade tables (missions live in missions.ts).
 * Rates are tuned so one sol (SOL seconds of game time) is a natural planning unit.
 */

export const SOL = 120 // game seconds per sol
export const MAP = 96 // map is MAP × MAP tiles

export type Dir = 0 | 1 | 2 | 3 // 0:+i  1:+j  2:-i  3:-j
export const DI = [1, 0, -1, 0] as const
export const DJ = [0, 1, 0, -1] as const

export type Ground = 'sand' | 'ice' | 'ore' | 'rock' | 'crater'

export type ItemId = 'ice' | 'water' | 'regolith' | 'ore' | 'metal' | 'brick' | 'soil' | 'food'
export const ITEMS: Record<ItemId, { name: string; color: string; dark: string }> = {
  ice: { name: 'Ice', color: '#dff3ff', dark: '#8fc6e6' },
  water: { name: 'Water', color: '#58b0ea', dark: '#2c6fa8' },
  regolith: { name: 'Regolith', color: '#e3a474', dark: '#a8653f' },
  ore: { name: 'Hematite ore', color: '#8e4a5a', dark: '#4c2433' },
  metal: { name: 'Metal', color: '#d6dbe2', dark: '#7d8794' },
  brick: { name: 'Brick', color: '#c96a43', dark: '#7b3b2c' },
  soil: { name: 'Clean soil', color: '#6b4a32', dark: '#3d2a1d' },
  food: { name: 'Food', color: '#7ed36a', dark: '#3f7f3d' },
}

/** Things the colony stockpile tracks (items delivered to the core, plus oxygen). */
export type StockId = ItemId | 'o2'

export type Kind =
  | 'core'
  | 'belt'
  | 'junction'
  | 'drill'
  | 'excavator'
  | 'melter'
  | 'smelter'
  | 'kiln'
  | 'washer'
  | 'greenhouse'
  | 'moxie'
  | 'solar'
  | 'battery'
  | 'reactor'
  | 'habitat'
  | 'shield'
  | 'lab'
  | 'pylon'

export type Recipe = { in: Partial<Record<ItemId, number>>; out: Partial<Record<ItemId, number>>; time: number }

export type BuildingDef = {
  kind: Kind
  name: string
  short: string
  desc: string
  fact: string
  cost: { metal?: number; brick?: number }
  /** kW drawn while active. Generators use `gen` instead. */
  power: number
  gen?: number
  /** Footprint in tiles: w along +i, h along +j. From 1×1 (belts, junctions, pylons) up to 6×6 (habitat). */
  w: number
  h: number
  recipe?: Recipe
  /** Miners: which ground they work and what each yields. */
  mines?: Partial<Record<Ground, ItemId>>
  mineTime?: number
  /** Has an output side that the player rotates. */
  outputs?: boolean
  housing?: number
  research?: ResearchId
  group: 'logistics' | 'extract' | 'process' | 'life' | 'power' | 'science'
}

export const BUILDINGS: Record<Kind, BuildingDef> = {
  core: {
    kind: 'core',
    name: 'Colony core',
    short: 'Core',
    desc: 'Lander, storm shelter and stockpile. Belt anything in here to add it to colony stores. Houses 4.',
    fact: 'A Mars lander has to carry everything for the first weeks — after that, the crew lives on what they make.',
    cost: {},
    power: 5,
    w: 5,
    h: 5,
    housing: 4,
    group: 'logistics',
  },
  belt: {
    kind: 'belt',
    name: 'Conveyor belt',
    short: 'Belt',
    desc: 'Moves items in the direction of the arrow. Drag to lay a line.',
    fact: 'Low gravity (38% of Earth’s) means lighter conveyor frames — but abrasive dust wears every moving part.',
    cost: { metal: 1 },
    power: 0,
    w: 1,
    h: 1,
    outputs: true,
    group: 'logistics',
  },
  junction: {
    kind: 'junction',
    name: 'Belt junction',
    short: 'Junction',
    desc: 'Lets two belt lines cross without mixing. Drag a belt across another to build one.',
    fact: 'Factories on Mars must be compact: every metre of conveyor is metal shipped from the smelter, and every crossing saves a detour.',
    cost: { metal: 3 },
    power: 0,
    w: 1,
    h: 1,
    group: 'logistics',
  },
  drill: {
    kind: 'drill',
    name: 'Ice drill',
    short: 'Ice drill',
    desc: 'Place on ice deposits. Pulls up buried water ice.',
    fact: 'Radar from orbit has found thick sheets of water ice just under the surface at mid-latitudes on Mars.',
    cost: { metal: 10 },
    power: 10,
    w: 3,
    h: 3,
    mines: { ice: 'ice' },
    mineTime: 2.5,
    outputs: true,
    group: 'extract',
  },
  excavator: {
    kind: 'excavator',
    name: 'Excavator',
    short: 'Excavator',
    desc: 'Digs regolith from sand, or hematite ore from ore deposits.',
    fact: 'Hematite — iron oxide — is part of why Mars is red. Opportunity rover found tiny hematite “blueberries” everywhere.',
    cost: { metal: 10 },
    power: 10,
    w: 3,
    h: 3,
    mines: { sand: 'regolith', ore: 'ore' },
    mineTime: 2.5,
    outputs: true,
    group: 'extract',
  },
  melter: {
    kind: 'melter',
    name: 'Ice melter',
    short: 'Melter',
    desc: 'Melts and filters ice into water.',
    fact: 'At 0.6% of Earth’s air pressure, liquid water boils or freezes in the open — it has to be melted indoors.',
    cost: { metal: 8, brick: 4 },
    power: 15,
    w: 3,
    h: 3,
    recipe: { in: { ice: 1 }, out: { water: 2 }, time: 2 },
    outputs: true,
    group: 'process',
  },
  smelter: {
    kind: 'smelter',
    name: 'Smelter',
    short: 'Smelter',
    desc: 'Reduces hematite ore into metal. Power hungry.',
    fact: 'Iron can be made on Mars by stripping oxygen from iron oxide — and that oxygen is useful too.',
    cost: { metal: 12, brick: 6 },
    power: 30,
    w: 4,
    h: 4,
    recipe: { in: { ore: 2 }, out: { metal: 1 }, time: 3 },
    outputs: true,
    group: 'process',
  },
  kiln: {
    kind: 'kiln',
    name: 'Sinter kiln',
    short: 'Kiln',
    desc: 'Bakes loose regolith into building bricks.',
    fact: 'Heating regolith until the grains fuse (sintering) makes bricks without cement or water.',
    cost: { metal: 10 },
    power: 20,
    w: 4,
    h: 4,
    recipe: { in: { regolith: 2 }, out: { brick: 1 }, time: 3 },
    outputs: true,
    group: 'process',
  },
  washer: {
    kind: 'washer',
    name: 'Soil washer',
    short: 'Washer',
    desc: 'Rinses toxic perchlorate salts out of regolith to make clean soil.',
    fact: 'Phoenix lander found ~0.6% perchlorate in Martian soil — toxic to people, so it must be washed out before farming.',
    cost: { metal: 10, brick: 4 },
    power: 8,
    w: 4,
    h: 4,
    recipe: { in: { regolith: 1, water: 1 }, out: { soil: 1 }, time: 2.5 },
    outputs: true,
    group: 'process',
  },
  greenhouse: {
    kind: 'greenhouse',
    name: 'Greenhouse',
    short: 'Greenhouse',
    desc: 'A 6×4 glass greenhouse. Grows food from clean soil and water under red and blue LEDs, and releases oxygen.',
    fact: 'Real space farming: astronauts on the ISS grew chile peppers for 137 days and picked 26 of them (NASA OSDR study OSD-772).',
    cost: { metal: 20, brick: 20 },
    power: 30,
    w: 6,
    h: 4,
    recipe: { in: { soil: 2, water: 3 }, out: { food: 4 }, time: 10 },
    outputs: true,
    group: 'life',
  },
  moxie: {
    kind: 'moxie',
    name: 'MOXIE oxygen plant',
    short: 'MOXIE',
    desc: 'Splits carbon dioxide from the air into oxygen for the crew.',
    fact: 'NASA’s MOXIE on the Perseverance rover made oxygen from Mars air 16 times between 2021 and 2023.',
    cost: { metal: 15 },
    power: 25,
    w: 3,
    h: 3,
    group: 'life',
  },
  habitat: {
    kind: 'habitat',
    name: 'Habitat',
    short: 'Habitat',
    desc: 'Pressurised home for 6 colonists. Needs a regolith shield within 3 tiles.',
    fact: 'On Mars, NASA’s Curiosity rover measures about 190 micrograys of radiation a day. On 20 May 2024 a solar storm pushed it almost nine times higher (NASA RadLab data).',
    cost: { metal: 10, brick: 20 },
    power: 5,
    w: 6,
    h: 6,
    housing: 6,
    group: 'life',
  },
  shield: {
    kind: 'shield',
    name: 'Regolith shield',
    short: 'Shield',
    desc: 'A thick berm of packed regolith. Protects habitats within 3 tiles from radiation.',
    fact: 'About 2 metres of regolith overhead blocks most of the radiation that reaches the Martian surface.',
    cost: { brick: 15 },
    power: 0,
    w: 2,
    h: 2,
    group: 'life',
  },
  solar: {
    kind: 'solar',
    name: 'Solar panel',
    short: 'Solar',
    desc: 'Up to 20 kW in daylight. Nothing at night, much less in dust storms. Upgrade it into an array, then a station that plants its own panels.',
    fact: 'Mars is 1.5× farther from the Sun than Earth, so a panel there gets only about 43% of the sunlight.',
    cost: { metal: 6 },
    power: 0,
    gen: 20,
    w: 2,
    h: 2,
    group: 'power',
  },
  pylon: {
    kind: 'pylon',
    name: 'Power pylon',
    short: 'Pylon',
    desc: 'Carries power. Buildings in its square get connected; pylons link to the core and to each other by cable.',
    fact: 'NASA’s Fission Surface Power plan puts the reactor about a kilometre from the base and runs cable in — the distance itself is radiation shielding.',
    cost: { metal: 4 },
    power: 0,
    w: 1,
    h: 1,
    group: 'power',
  },
  battery: {
    kind: 'battery',
    name: 'Battery bank',
    short: 'Battery',
    desc: 'Stores 3,000 kJ of daytime surplus to run the colony through the night.',
    fact: 'A Mars day (a sol) lasts 24 hours 39 minutes — about 12 hours of darkness to store energy for.',
    cost: { metal: 10 },
    power: 0,
    w: 3,
    h: 3,
    group: 'power',
  },
  reactor: {
    kind: 'reactor',
    name: 'Kilopower reactor',
    short: 'Reactor',
    desc: 'A steady 120 kW, day or night, storm or not.',
    fact: 'NASA’s Kilopower project tested a small fission reactor in 2018 designed to power outposts on the Moon and Mars.',
    cost: { metal: 60, brick: 30 },
    power: 0,
    gen: 120,
    w: 5,
    h: 5,
    research: 'kilopower',
    group: 'power',
  },
  lab: {
    kind: 'lab',
    name: 'Research lab',
    short: 'Lab',
    desc: 'Crew scientists generate research points. Unlocks new tech.',
    fact: 'NASA keeps real space-biology experiments in its open data library, OSDR. In study OSD-342, mice on the ISS lost muscle and bone in just 33 days.',
    cost: { metal: 15, brick: 10 },
    power: 15,
    w: 4,
    h: 4,
    group: 'science',
  },
}

export const BUILD_ORDER: Kind[] = [
  'belt',
  'junction',
  'drill',
  'excavator',
  'melter',
  'smelter',
  'kiln',
  'washer',
  'greenhouse',
  'moxie',
  'habitat',
  'shield',
  'solar',
  'pylon',
  'battery',
  'reactor',
  'lab',
]

export const HOTKEYS: Partial<Record<Kind, string>> = {
  belt: '1',
  drill: '2',
  excavator: '3',
  melter: '4',
  smelter: '5',
  kiln: '6',
  solar: '7',
  habitat: '8',
  shield: '9',
  moxie: '0',
}

/* ------------------------------------------------------------------ */

export type ResearchId = 'washing' | 'leds' | 'maglev' | 'dustproof' | 'recycling' | 'kilopower'

export type ResearchDef = { id: ResearchId; name: string; cost: number; needs?: ResearchId; effect: string; fact: string; field: string }

export const RESEARCH: ResearchDef[] = [
  {
    id: 'washing',
    name: 'Perchlorate washing',
    cost: 20,
    effect: 'Soil washers work twice as fast.',
    field: 'Chemistry',
    fact: 'Perchlorate salts dissolve easily in water. Rinsing regolith a few times removes almost all of them — and the rinse water can be cleaned and reused.',
  },
  {
    id: 'leds',
    name: 'LED grow lights',
    cost: 30,
    needs: 'washing',
    effect: 'Greenhouses grow 50% faster.',
    field: 'Botany',
    fact: 'Chlorophyll absorbs red and blue light best and reflects green — that’s why leaves look green and why grow rooms glow purple.',
  },
  {
    id: 'maglev',
    name: 'Fast conveyors',
    cost: 40,
    effect: 'Belts move 75% faster.',
    field: 'Engineering',
    fact: 'Fewer moving parts means less wear from sharp Martian dust, which has never been smoothed by flowing water.',
  },
  {
    id: 'dustproof',
    name: 'Self-cleaning panels',
    cost: 40,
    effect: 'Solar +30%. Dust storms hurt half as much.',
    field: 'Physics',
    fact: 'Dust slowly buried the Opportunity and InSight solar panels. Electrostatic “dust shields” can push dust off without wipers.',
  },
  {
    id: 'recycling',
    name: '98% water recovery',
    cost: 50,
    effect: 'Colonists need 60% less water.',
    field: 'Ecology',
    fact: 'The International Space Station recovers about 98% of its water — including from sweat, breath and urine.',
  },
  {
    id: 'kilopower',
    name: 'Kilopower fission',
    cost: 80,
    needs: 'dustproof',
    effect: 'Unlocks the Kilopower reactor.',
    field: 'Physics',
    fact: 'A reactor doesn’t care about night or dust storms. In 2018’s KRUSTY test, a small reactor ran for 28 hours in a vacuum chamber.',
  },
]

/* ------------------------------------------------------------------ */

/** Per colonist, per sol. */
export const NEEDS = { food: 2, water: 2, o2: 2 }

/* --------------------------------- grid ---------------------------------- */

/** Coverage half-width (tiles beyond the footprint) and cable reach of grid nodes. */
export const CORE_REACH = 12
export const CORE_LINK = 18

/* ------------------------------- upgrades -------------------------------- */

export const MAX_LEVEL = 3

/** What upgrading does, per kind. Index 0 is level 1 (as built). */
export type Upgrade = {
  names: [string, string, string]
  /** What each upgrade adds, shown on the button: [to level 2, to level 3]. */
  gains: [string, string]
}

const mk = (name: string, gains: [string, string]): Upgrade => ({ names: [name, `${name} Mk II`, `${name} Mk III`], gains })

export const UPGRADES: Partial<Record<Kind, Upgrade>> = {
  solar: { names: ['Solar panel', 'Solar array', 'Solar station'], gains: ['34 kW: three panels', '52 kW: tracking panels, and it plants new solar panels around itself'] },
  battery: { names: ['Battery bank', 'Battery stack', 'Grid storage'], gains: ['Stores 6,500 kJ', 'Stores 12,000 kJ'] },
  reactor: mk('Kilopower reactor', ['170 kW', '240 kW']),
  pylon: { names: ['Power pylon', 'Power tower', 'Substation'], gains: ['Wider coverage and longer cables', 'Widest coverage and longest cables'] },
  drill: mk('Ice drill', ['50% faster', '120% faster']),
  excavator: mk('Excavator', ['50% faster', '120% faster']),
  melter: mk('Ice melter', ['50% faster', '120% faster']),
  smelter: mk('Smelter', ['50% faster', '120% faster']),
  kiln: mk('Sinter kiln', ['50% faster', '120% faster']),
  washer: mk('Soil washer', ['50% faster', '120% faster']),
  greenhouse: mk('Greenhouse', ['50% faster', '120% faster']),
  moxie: mk('MOXIE', ['50% more oxygen', '120% more oxygen']),
  lab: mk('Research lab', ['50% more research', '120% more research']),
  habitat: mk('Habitat', ['Houses 8', 'Houses 10']),
  shield: mk('Regolith shield', ['Protects within 4 tiles', 'Protects within 6 tiles']),
}

/** Work-speed multiplier by level, and the extra power that speed costs. */
export const SPEED = [1, 1.5, 2.2]
export const POWER_SCALE = [1, 1.3, 1.6]
export const SOLAR_KW = [20, 34, 52]
export const BATTERY_KJ_LEVEL = [3000, 6500, 12000]
export const REACTOR_KW = [120, 170, 240]
export const HABITAT_BEDS = [6, 8, 10]
/** Tiles of open ground allowed between a shield's footprint and a habitat's. */
export const SHIELD_REACH = [3, 4, 6]
export const PYLON_REACH = [6, 9, 12]
export const PYLON_LINK = [13, 18, 24]
/** A solar station plants a new panel this often (game seconds), up to this many around it. */
export const STATION_PLANT_EVERY = 25
export const STATION_MAX_PLANTS = 8

