/**
 * RENOVA game data: items, buildings, research and missions.
 * Rates are tuned so one sol (SOL seconds of game time) is a natural planning unit.
 */

export const SOL = 120 // game seconds per sol
export const MAP = 64 // map is MAP × MAP tiles

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
  /** Footprint in tiles: w along +i, h along +j. 1×1, 2×2 (4 tiles) or 3×2 (6 tiles). */
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
    w: 2,
    h: 2,
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
    w: 1,
    h: 1,
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
    w: 1,
    h: 1,
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
    w: 1,
    h: 1,
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
    w: 2,
    h: 2,
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
    w: 2,
    h: 2,
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
    w: 2,
    h: 2,
    recipe: { in: { regolith: 1, water: 1 }, out: { soil: 1 }, time: 2.5 },
    outputs: true,
    group: 'process',
  },
  greenhouse: {
    kind: 'greenhouse',
    name: 'Greenhouse',
    short: 'Greenhouse',
    desc: 'A 6-tile glass greenhouse. Grows food from clean soil and water under red and blue LEDs, and releases oxygen.',
    fact: 'Plants absorb mostly red (≈660 nm) and blue (≈450 nm) light, so grow lamps skip the rest to save power.',
    cost: { metal: 20, brick: 20 },
    power: 30,
    w: 3,
    h: 2,
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
    w: 1,
    h: 1,
    group: 'life',
  },
  habitat: {
    kind: 'habitat',
    name: 'Habitat',
    short: 'Habitat',
    desc: 'Pressurised home for 6 colonists. Needs a regolith shield within 2 tiles.',
    fact: 'Without a magnetic field or thick air, Mars’ surface gets far more space radiation than Earth’s.',
    cost: { metal: 10, brick: 20 },
    power: 5,
    w: 2,
    h: 2,
    housing: 6,
    group: 'life',
  },
  shield: {
    kind: 'shield',
    name: 'Regolith shield',
    short: 'Shield',
    desc: 'A thick berm of packed regolith. Protects habitats within 2 tiles from radiation.',
    fact: 'About 2 metres of regolith overhead blocks most of the radiation that reaches the Martian surface.',
    cost: { brick: 15 },
    power: 0,
    w: 1,
    h: 1,
    group: 'life',
  },
  solar: {
    kind: 'solar',
    name: 'Solar array',
    short: 'Solar',
    desc: 'Up to 20 kW in daylight. Nothing at night, much less in dust storms.',
    fact: 'Mars is 1.5× farther from the Sun than Earth, so a panel there gets only about 43% of the sunlight.',
    cost: { metal: 6 },
    power: 0,
    gen: 20,
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
    w: 1,
    h: 1,
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
    w: 2,
    h: 2,
    research: 'kilopower',
    group: 'power',
  },
  lab: {
    kind: 'lab',
    name: 'Research lab',
    short: 'Lab',
    desc: 'Crew scientists generate research points. Unlocks new tech.',
    fact: 'Every rover and lander on Mars is a science lab — Curiosity carries a full chemistry lab in its belly.',
    cost: { metal: 15, brick: 10 },
    power: 15,
    w: 2,
    h: 2,
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
