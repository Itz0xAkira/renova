/**
 * RENOVA simulation. Pure TypeScript — no Phaser, no DOM — so it can be
 * stepped headless, saved to JSON and rendered by anything.
 */
import {
  BATTERY_KJ_LEVEL,
  CORE_LINK,
  CORE_REACH,
  HABITAT_BEDS,
  MAX_LEVEL,
  POWER_SCALE,
  PYLON_LINK,
  PYLON_REACH,
  REACTOR_KW,
  SHIELD_REACH,
  SOLAR_KW,
  SPEED,
  STATION_MAX_PLANTS,
  STATION_PLANT_EVERY,
  UPGRADES,
  BUILDINGS,
  DI,
  DJ,
  ITEMS,
  MAP,
  NEEDS,
  RESEARCH,
  SOL,
  type Dir,
  type Ground,
  type ItemId,
  type Kind,
  type ResearchId,
  type StockId,
} from './data'
import { MISSIONS } from './missions'

export type Status = 'ok' | 'nopower' | 'nogrid' | 'noinput' | 'blocked' | 'unshielded' | 'badground' | 'idle'

/** An item on a belt. `from` is the side it entered from, when it came in round a corner or merge curve. */
export type BeltItem = { item: ItemId; pos: number; from?: Dir }

/** Belt input bits: fed from behind, from the +b side ((dir+1)%4), from the −b side ((dir+3)%4). */
export const IN_BACK = 1
export const IN_P = 2
export const IN_N = 4

export type Ent = {
  id: number
  kind: Kind
  i: number
  j: number
  dir: Dir
  inBuf: Partial<Record<ItemId, number>>
  outBuf: Partial<Record<ItemId, number>>
  progress: number
  crafting: boolean
  active: boolean
  working: boolean
  status: Status
  items: BeltItem[]
  mineItem: ItemId | null
  shielded: boolean
  residents: number
  outCursor: number
  born: number
  /** Belts only: the side a curve is fed from (a corner piece), or null if straight. */
  curve: Dir | null
  /** Belts only: which sides feed this belt (IN_BACK | IN_P | IN_N). */
  inMask: number
  /** Junctions only: one lane of items per travel direction. */
  lanes: BeltItem[][]
  /** Upgrade level, 1–3. */
  level: number
  /** Connected to the colony's power grid. */
  onGrid: boolean
  /** Solar stations: seconds until the next panel is planted, and how many it has planted. */
  plantIn: number
  planted: number
  /** Belts only: nothing feeds the back, so the start is closed off. */
  capStart: boolean
  /** Belts only: the output leads nowhere that will take items. */
  capEnd: boolean
}

export type Tone = 'info' | 'good' | 'warn' | 'bad'
export type Msg = { id: number; text: string; tone: Tone; t: number }
export type Popup = { kind: 'research' | 'win' | 'lose' | 'intro'; title: string; body: string; field?: string }
export type Shortage = 'food' | 'water' | 'o2' | 'power' | 'radiation'

const GAP = 0.3
const BELT_SPEED = 1.5
const OUT_CAP = 6
export const BATTERY_KJ = 3000

/** Life support gets power before industry when there isn't enough. */
const LIFE = new Set<Kind>(['core', 'habitat', 'moxie'])
export const SHIELD_RADIUS = 2

const mulberry = (a: number) => () => {
  a |= 0
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

function hash2(a: number, b: number, s: number) {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

function noise(x: number, y: number, scale: number, seed: number) {
  const fx = x / scale
  const fy = y / scale
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const sx = fx - x0
  const sy = fy - y0
  const u = sx * sx * (3 - 2 * sx)
  const v = sy * sy * (3 - 2 * sy)
  const a = hash2(x0, y0, seed)
  const b = hash2(x0 + 1, y0, seed)
  const c = hash2(x0, y0 + 1, seed)
  const d = hash2(x0 + 1, y0 + 1, seed)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

export const CORE_AT = MAP / 2 - 1

/**
 * The tile a building pushes its output onto: just past the middle of the
 * footprint edge its arrow faces. For 1×1 buildings that's simply the
 * neighbour in direction `dir`.
 */
export function outTileFor(kind: Kind, i: number, j: number, dir: Dir): [number, number] {
  const { w, h } = BUILDINGS[kind]
  const mi = i + ((w - 1) >> 1)
  const mj = j + ((h - 1) >> 1)
  if (dir === 0) return [i + w, mj]
  if (dir === 1) return [mi, j + h]
  if (dir === 2) return [i - 1, mj]
  return [mi, j - 1]
}

export const outTile = (e: { kind: Kind; i: number; j: number; dir: Dir }) => outTileFor(e.kind, e.i, e.j, e.dir)

export function generateGround(seed: number): Ground[] {
  const g: Ground[] = []
  const c = CORE_AT + 0.5
  for (let j = 0; j < MAP; j++)
    for (let i = 0; i < MAP; i++) {
      const d = Math.hypot(i - c, j - c)
      let t: Ground = 'sand'
      const ice = noise(i, j, 6, seed) * 0.7 + noise(i, j, 2.5, seed + 1) * 0.3
      const ore = noise(i, j, 5, seed + 2) * 0.7 + noise(i, j, 2, seed + 3) * 0.3
      if (ice > 0.7) t = 'ice'
      else if (ore > 0.71) t = 'ore'
      const r = hash2(i, j, seed + 4)
      if (r > 0.972) t = 'rock'
      else if (r < 0.01) t = 'crater'
      if (d < 3.2) t = 'sand'
      g.push(t)
    }
  // guarantee a starter deposit of each close to the core
  const blob = (ci: number, cj: number, t: Ground, r: number) => {
    for (let j = Math.floor(cj - r); j <= Math.ceil(cj + r); j++)
      for (let i = Math.floor(ci - r); i <= Math.ceil(ci + r); i++)
        if (i >= 0 && j >= 0 && i < MAP && j < MAP && Math.hypot(i - ci, j - cj) <= r) g[j * MAP + i] = t
  }
  blob(CORE_AT + 7, CORE_AT - 1, 'ice', 1.8)
  blob(CORE_AT - 2, CORE_AT + 8, 'ore', 1.8)
  blob(CORE_AT - 8, CORE_AT - 4, 'ice', 1.3)
  return g
}

export type SaveData = {
  v: 1
  seed: number
  time: number
  stock: Record<StockId, number>
  colonists: number
  health: number
  stored: number
  rp: number
  done: ResearchId[]
  current: ResearchId | null
  mission: number
  delivered: Record<ItemId, number>
  ents: [Kind, number, number, Dir, number?][]
  ev: Sim['ev']
  won: boolean
  /** Ground wear from rovers and crew, as sparse [tile index, wear] pairs. */
  wear?: [number, number][]
}

/** Wear needed before tyre tracks show, and before a track becomes a road. */
export const TRACK_WEAR = 3
export const ROAD_WEAR = 12

export class Sim {
  seed: number
  ground: Ground[]
  occ: Int32Array
  ents = new Map<number, Ent>()
  nextId = 1
  rev = 0
  time = 0
  stock: Record<StockId, number> = { ice: 0, water: 30, regolith: 0, ore: 0, metal: 100, brick: 30, soil: 0, food: 30, o2: 40 }
  delivered: Record<ItemId, number> = { ice: 0, water: 0, regolith: 0, ore: 0, metal: 0, brick: 0, soil: 0, food: 0 }
  colonists = 4
  health = 100
  owed: Record<'food' | 'water' | 'o2', number> = { food: 0, water: 0, o2: 0 }
  shortages = new Set<Shortage>()
  power = {
    gen: 0,
    demand: 0,
    sat: 1,
    stored: 1000,
    cap: 0,
    /** kW one level-1 panel makes right now. */
    solar: 0,
    solarGen: 0,
    reactorGen: 0,
    discharge: 0,
    lifeSat: 1,
    indSat: 1,
    byKind: {} as Partial<Record<Kind, number>>,
    history: [] as { gen: number; demand: number; stored: number; cap: number }[],
    lastSample: -99,
  }
  rp = 0
  done = new Set<ResearchId>()
  current: ResearchId | null = 'washing'
  mission = 0
  messages: Msg[] = []
  popups: Popup[] = []
  over: 'won' | 'lost' | null = null
  won = false
  rates: Partial<Record<StockId, number>> = {}
  /** How worn each tile is by rovers and crew. Busy routes turn into tracks, then roads. */
  wear = new Uint8Array(MAP * MAP)
  /** Bumped whenever a tile becomes a track or a road, so the renderer can redraw. */
  roadRev = 0
  /** Tiles that just became roads, for drones to come and pave. */
  newRoads: number[] = []
  private history: { t: number; s: Record<StockId, number> }[] = []
  private msgId = 1
  private tips = new Set<string>()
  rng: () => number
  ev = {
    storm: null as null | { start: number; end: number },
    flare: null as null | { start: number; end: number },
    nextStorm: SOL * 2.6,
    nextFlare: SOL * 3.4,
    nextShip: SOL * 1.1,
    ship: -1, // time of the last landing (for the animation)
  }

  constructor(seed = Math.floor(Math.random() * 1e9)) {
    this.seed = seed
    this.rng = mulberry(seed ^ 0x5eed)
    this.ground = generateGround(seed)
    this.occ = new Int32Array(MAP * MAP)
    this.add('core', CORE_AT, CORE_AT, 0)
  }

  /* -------------------------------- queries ------------------------------- */

  groundAt(i: number, j: number): Ground | null {
    return i < 0 || j < 0 || i >= MAP || j >= MAP ? null : this.ground[j * MAP + i]
  }
  entAt(i: number, j: number): Ent | null {
    if (i < 0 || j < 0 || i >= MAP || j >= MAP) return null
    const id = this.occ[j * MAP + i]
    return id ? (this.ents.get(id) ?? null) : null
  }
  sun() {
    const phase = (this.time / SOL + 0.3) % 1
    return Math.max(0, Math.min(1, Math.sin(2 * Math.PI * (phase - 0.25)) * 1.5))
  }
  solNumber() {
    return Math.floor(this.time / SOL + 0.3) + 1
  }
  clock() {
    const phase = (this.time / SOL + 0.3) % 1
    const mins = Math.floor(phase * 24 * 60 + phase * 39)
    return `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
  }
  housing() {
    let h = 0
    for (const e of this.ents.values()) h += this.beds(e)
    return h
  }
  count(kind: Kind) {
    let n = 0
    for (const e of this.ents.values()) if (e.kind === kind) n++
    return n
  }
  unlocked(kind: Kind) {
    const r = BUILDINGS[kind].research
    return !r || this.done.has(r)
  }
  affordable(kind: Kind) {
    const c = BUILDINGS[kind].cost
    return (c.metal ?? 0) <= this.stock.metal && (c.brick ?? 0) <= this.stock.brick
  }

  /** Why a building can't go here, or null if it can. */
  placeError(kind: Kind, i: number, j: number): string | null {
    const def = BUILDINGS[kind]
    if (!this.unlocked(kind)) return 'Not researched yet'
    for (let dj = 0; dj < def.h; dj++)
      for (let di = 0; di < def.w; di++) {
        const g = this.groundAt(i + di, j + dj)
        if (!g) return 'Off the map'
        if (g === 'rock') return 'Boulder in the way'
        if (g === 'crater') return 'Crater — unstable ground'
        if (this.occ[(j + dj) * MAP + i + di]) return 'Tile is taken'
      }
    if (def.mines && !def.mines[this.groundAt(i, j)!]) return kind === 'drill' ? 'Ice drills need an ice deposit' : 'Excavators need sand or ore'
    if (!this.affordable(kind)) return 'Not enough materials'
    return null
  }

  /* -------------------------------- actions ------------------------------- */

  private add(kind: Kind, i: number, j: number, dir: Dir): Ent {
    const def = BUILDINGS[kind]
    const e: Ent = {
      id: this.nextId++,
      kind,
      i,
      j,
      dir,
      inBuf: {},
      outBuf: {},
      progress: 0,
      crafting: false,
      active: false,
      working: false,
      status: 'idle',
      items: [],
      mineItem: def.mines ? (def.mines[this.groundAt(i, j)!] ?? null) : null,
      shielded: false,
      residents: 0,
      outCursor: 0,
      born: this.time,
      curve: null,
      inMask: 0,
      lanes: [[], [], [], []],
      level: 1,
      onGrid: false,
      plantIn: STATION_PLANT_EVERY,
      planted: 0,
      capStart: true,
      capEnd: true,
    }
    this.ents.set(e.id, e)
    for (let dj = 0; dj < def.h; dj++) for (let di = 0; di < def.w; di++) this.occ[(j + dj) * MAP + i + di] = e.id
    this.rev++
    if (kind === 'shield' || kind === 'habitat') this.updateShielding()
    return e
  }

  place(kind: Kind, i: number, j: number, dir: Dir): string | null {
    const err = this.placeError(kind, i, j)
    if (err) return err
    const c = BUILDINGS[kind].cost
    this.stock.metal -= c.metal ?? 0
    this.stock.brick -= c.brick ?? 0
    this.add(kind, i, j, dir)
    return null
  }

  remove(i: number, j: number): Ent | null {
    const e = this.entAt(i, j)
    if (!e || e.kind === 'core') return null
    const def = BUILDINGS[e.kind]
    this.stock.metal += def.cost.metal ?? 0
    this.stock.brick += def.cost.brick ?? 0
    for (let dj = 0; dj < def.h; dj++) for (let di = 0; di < def.w; di++) this.occ[(e.j + dj) * MAP + e.i + di] = 0
    this.ents.delete(e.id)
    this.rev++
    if (e.kind === 'shield' || e.kind === 'habitat') this.updateShielding()
    return e
  }

  rotate(e: Ent, by = 1) {
    if (!BUILDINGS[e.kind].outputs) return
    e.dir = ((e.dir + by + 4) % 4) as Dir
    this.rev++
  }

  setDir(e: Ent, dir: Dir) {
    if (e.dir === dir) return
    e.dir = dir
    this.rev++
  }

  setResearch(id: ResearchId) {
    const r = RESEARCH.find((x) => x.id === id)!
    if (this.done.has(id) || (r.needs && !this.done.has(r.needs))) return
    this.current = id
  }

  log(text: string, tone: Tone = 'info') {
    this.messages.push({ id: this.msgId++, text, tone, t: this.time })
    if (this.messages.length > 40) this.messages.shift()
  }

  /** 0 bare ground, 1 tyre tracks, 2 road. */
  roadLevel(i: number, j: number) {
    if (i < 0 || j < 0 || i >= MAP || j >= MAP) return 0
    const w = this.wear[j * MAP + i]
    return w >= ROAD_WEAR ? 2 : w >= TRACK_WEAR ? 1 : 0
  }

  /** A rover or colonist passed over (i, j). */
  addWear(i: number, j: number, amount = 1) {
    if (i < 0 || j < 0 || i >= MAP || j >= MAP) return
    const k = j * MAP + i
    const before = this.wear[k]
    const after = Math.min(255, before + amount)
    this.wear[k] = after
    if ((before < TRACK_WEAR) !== (after < TRACK_WEAR) || (before < ROAD_WEAR) !== (after < ROAD_WEAR)) this.roadRev++
    if (before < ROAD_WEAR && after >= ROAD_WEAR) {
      this.newRoads.push(k)
      if (!this.tips.has('road')) {
        this.tips.add('road')
        this.log('Rovers have worn a busy route into a road. Drones are paving it — rovers drive faster on roads.', 'good')
      }
    }
  }

  /* ----------------------------- simulation ------------------------------- */

  private updateShielding() {
    const shields = [...this.ents.values()].filter((e) => e.kind === 'shield')
    for (const e of this.ents.values()) {
      if (e.kind !== 'habitat') continue
      // distance from the shield to the nearest tile of the habitat's footprint
      const { w, h } = BUILDINGS[e.kind]
      const gap = (s: Ent) => Math.max(Math.max(0, e.i - s.i, s.i - (e.i + w - 1)), Math.max(0, e.j - s.j, s.j - (e.j + h - 1)))
      e.shielded = shields.some((s) => gap(s) <= SHIELD_REACH[s.level - 1])
    }
  }

  private accepts(e: Ent, item: ItemId) {
    if (e.kind === 'core') return true
    const r = BUILDINGS[e.kind].recipe
    const need = r?.in[item]
    return !!need && (e.inBuf[item] ?? 0) < need * 3
  }

  private deliver(e: Ent, item: ItemId) {
    if (e.kind === 'core') {
      this.stock[item]++
      this.delivered[item]++
    } else e.inBuf[item] = (e.inBuf[item] ?? 0) + 1
  }

  /** Hand an item travelling in `dir` to whatever sits on tile (i, j). */
  private push(i: number, j: number, item: ItemId, dir: Dir): boolean {
    const t = this.entAt(i, j)
    if (!t) return false
    if (t.kind === 'belt') {
      if (t.dir === (dir + 2) % 4) return false
      // Straight in → start of the belt. From a side with nothing feeding the back (a corner or a Y):
      // start of that side's curve. From a side into a fed belt: merge in at the middle.
      const side = t.dir !== dir
      const curved = side && !(t.inMask & IN_BACK)
      const p = !side || curved ? 0 : 0.5
      for (const it of t.items) if (Math.abs(it.pos - p) < GAP) return false
      let k = 0
      while (k < t.items.length && t.items[k].pos > p) k++
      t.items.splice(k, 0, curved ? { item, pos: p, from: ((dir + 2) % 4) as Dir } : { item, pos: p })
      return true
    }
    if (t.kind === 'junction') {
      // crossing: each travel direction has its own lane, so lines pass through without mixing
      const lane = t.lanes[dir]
      if (lane.length >= 3 || lane.some((it) => it.pos < GAP)) return false
      lane.push({ item, pos: 0 })
      return true
    }
    if (!this.accepts(t, item)) return false
    this.deliver(t, item)
    return true
  }

  private outTotal(e: Ent) {
    let n = 0
    for (const k in e.outBuf) n += e.outBuf[k as ItemId] ?? 0
    return n
  }

  private hasInputs(e: Ent) {
    const r = BUILDINGS[e.kind].recipe!
    for (const k in r.in) if ((e.inBuf[k as ItemId] ?? 0) < (r.in[k as ItemId] ?? 0)) return false
    return true
  }

  /* ------------------------------ levels ------------------------------- */

  /** Work-speed multiplier from a building's level. */
  speed(e: Ent) {
    return SPEED[e.level - 1]
  }
  /** kW a building draws while active. */
  draw(e: Ent) {
    return BUILDINGS[e.kind].power * POWER_SCALE[e.level - 1]
  }
  beds(e: Ent) {
    if (e.kind === 'habitat') return HABITAT_BEDS[e.level - 1]
    return BUILDINGS[e.kind].housing ?? 0
  }
  batteryKJ(e: Ent) {
    return BATTERY_KJ_LEVEL[e.level - 1]
  }

  /** Materials to take a building to its next level, or null at the top. */
  upgradeCost(e: Ent): { metal: number; brick: number } | null {
    if (!UPGRADES[e.kind] || e.level >= MAX_LEVEL) return null
    const c = BUILDINGS[e.kind].cost
    const k = e.level === 1 ? 1.5 : 2.5
    return { metal: Math.ceil((c.metal ?? 0) * k) + (e.level === 1 ? 4 : 10), brick: Math.ceil((c.brick ?? 0) * k) + (e.level === 2 ? 6 : 0) }
  }

  upgrade(e: Ent): string | null {
    const cost = this.upgradeCost(e)
    if (!cost) return 'Already fully upgraded'
    if (this.stock.metal < cost.metal || this.stock.brick < cost.brick) return 'Not enough materials'
    this.stock.metal -= cost.metal
    this.stock.brick -= cost.brick
    e.level++
    this.rev++
    this.upgrades++
    this.justUpgraded.push(e.id)
    const name = UPGRADES[e.kind]!.names[e.level - 1]
    this.log(`Upgraded to ${name}.`, 'good')
    if (e.kind === 'shield' || e.kind === 'habitat') this.updateShielding()
    return null
  }

  /** Total upgrades made, for the mission log. */
  upgrades = 0
  /** Buildings just upgraded, for a drone to come and fit the new parts. */
  justUpgraded: number[] = []

  /* ------------------------------- grid -------------------------------- */

  private gridRev = -1
  /** Which tiles are inside the power grid's coverage. */
  covered = new Uint8Array(MAP * MAP)
  /** Cable links between grid nodes (core and pylons), as entity id pairs. */
  links: [number, number][] = []

  /** Coverage half-width (beyond the footprint) and cable reach of a grid node. */
  nodeReach(e: Ent) {
    return e.kind === 'core' ? CORE_REACH : PYLON_REACH[e.level - 1]
  }
  nodeLink(e: Ent) {
    return e.kind === 'core' ? CORE_LINK : PYLON_LINK[e.level - 1]
  }

  /**
   * Rebuild the grid: pylons join it when a cable reaches the core or another
   * joined pylon; every building with any tile inside a joined node's square is
   * connected. Pylons out of reach form no grid at all.
   */
  ensureGrid() {
    if (this.gridRev === this.rev) return
    this.gridRev = this.rev
    const nodes = [...this.ents.values()].filter((e) => e.kind === 'core' || e.kind === 'pylon')
    const centre = (e: Ent) => [e.i + (BUILDINGS[e.kind].w - 1) / 2, e.j + (BUILDINGS[e.kind].h - 1) / 2] as const
    const core = nodes.find((n) => n.kind === 'core')!
    const joined = new Set<Ent>([core])
    const queue = [core]
    this.links = []
    while (queue.length) {
      const a = queue.shift()!
      const [ai, aj] = centre(a)
      for (const b of nodes) {
        if (joined.has(b)) continue
        const [bi, bj] = centre(b)
        if (Math.hypot(ai - bi, aj - bj) <= Math.max(this.nodeLink(a), this.nodeLink(b))) {
          joined.add(b)
          queue.push(b)
          this.links.push([a.id, b.id])
        }
      }
    }
    this.covered.fill(0)
    for (const n of joined) {
      const r = this.nodeReach(n)
      const { w, h } = BUILDINGS[n.kind]
      for (let j = n.j - r; j < n.j + h + r; j++)
        for (let i = n.i - r; i < n.i + w + r; i++) if (i >= 0 && j >= 0 && i < MAP && j < MAP) this.covered[j * MAP + i] = 1
    }
    for (const e of this.ents.values()) {
      if (e.kind === 'pylon' || e.kind === 'core') {
        e.onGrid = joined.has(e)
        continue
      }
      const { w, h } = BUILDINGS[e.kind]
      let on = false
      for (let dj = 0; dj < h && !on; dj++) for (let di = 0; di < w && !on; di++) on = this.covered[(e.j + dj) * MAP + e.i + di] === 1
      e.onGrid = on
    }
  }

  /** Research that speeds machines up. */
  private boost(kind: Kind) {
    if (kind === 'washer' && this.done.has('washing')) return 2
    if (kind === 'greenhouse' && this.done.has('leds')) return 1.5
    return 1
  }

  /** Does `e` push its output onto tile (i, j)? */
  private feeds(e: Ent, i: number, j: number, depth = 0): boolean {
    if (e.kind === 'junction') {
      // a junction passes items straight through: it feeds a neighbour if something feeds it from the opposite side
      const di = i - e.i
      const dj = j - e.j
      if (Math.abs(di) + Math.abs(dj) !== 1 || depth > 64) return false
      const src = this.entAt(e.i - di, e.j - dj)
      return !!src && this.feeds(src, e.i, e.j, depth + 1)
    }
    if (!BUILDINGS[e.kind].outputs) return false
    const [oi, oj] = outTile(e)
    return oi === i && oj === j
  }

  private topoRev = -1

  /** Recompute belt shapes (straight, corner, capped ends) after the layout changes. */
  ensureBelts() {
    if (this.topoRev === this.rev) return
    this.topoRev = this.rev
    for (const b of this.ents.values()) {
      if (b.kind !== 'belt') continue
      const d = b.dir
      const back = this.entAt(b.i - DI[d], b.j - DJ[d])
      const backFeeds = !!back && this.feeds(back, b.i, b.j)
      const sides = ([(d + 1) % 4, (d + 3) % 4] as Dir[]).filter((sd) => {
        const n = this.entAt(b.i + DI[sd], b.j + DJ[sd])
        return !!n && this.feeds(n, b.i, b.j)
      })
      b.curve = !backFeeds && sides.length === 1 ? sides[0] : null
      b.inMask = (backFeeds ? IN_BACK : 0) | (sides.includes(((d + 1) % 4) as Dir) ? IN_P : 0) | (sides.includes(((d + 3) % 4) as Dir) ? IN_N : 0)
      b.capStart = b.inMask === 0
      const front = this.entAt(b.i + DI[d], b.j + DJ[d])
      b.capEnd = !front || (front.kind === 'belt' ? front.dir === (d + 2) % 4 : front.kind !== 'core' && front.kind !== 'junction' && !BUILDINGS[front.kind].recipe)
    }
  }

  step(dt: number) {
    if (this.over) return
    this.ensureBelts()
    this.time += dt
    const beltV = BELT_SPEED * (this.done.has('maglev') ? 1.75 : 1) * dt

    // 1 · who wants power this tick, split into life support and industry
    this.ensureGrid()
    let lifeDemand = 0
    let indDemand = 0
    let gen = 0
    let solarGen = 0
    let cap = 0
    const dust = this.ev.storm && this.time >= this.ev.storm.start ? (this.done.has('dustproof') ? 0.6 : 0.25) : 1
    const solarFactor = this.sun() * dust * (this.done.has('dustproof') ? 1.3 : 1)
    const byKind: Partial<Record<Kind, number>> = {}
    for (const e of this.ents.values()) {
      const def = BUILDINGS[e.kind]
      if (def.mines) e.active = !!e.mineItem && this.outTotal(e) < OUT_CAP
      else if (def.recipe) e.active = e.crafting ? e.progress < 1 : this.hasInputs(e) && this.outTotal(e) < OUT_CAP
      else if (e.kind === 'lab') e.active = !!this.current
      else e.active = def.power > 0
      if (!e.onGrid) continue
      if (e.kind === 'solar') {
        const kw = SOLAR_KW[e.level - 1] * solarFactor
        gen += kw
        solarGen += kw
      } else if (e.kind === 'reactor') gen += REACTOR_KW[e.level - 1]
      else if (e.kind === 'battery') cap += this.batteryKJ(e)
      if (e.active && def.power > 0) {
        const kw = this.draw(e)
        if (LIFE.has(e.kind)) lifeDemand += kw
        else indDemand += kw
        byKind[e.kind] = (byKind[e.kind] ?? 0) + kw
      }
    }

    // 2 · power balance: life support first, then industry; batteries buffer both
    const P = this.power
    const reserveCap = cap + 1000 // the core carries a small 1,000 kJ reserve
    P.cap = cap
    P.stored = Math.min(P.stored, reserveCap)
    const demand = lifeDemand + indDemand
    P.gen = gen
    P.solar = SOLAR_KW[0] * solarFactor
    P.demand = demand
    P.byKind = byKind
    P.solarGen = solarGen
    P.reactorGen = gen - solarGen
    let supply = gen * dt
    if (gen < demand) {
      const draw = Math.min((demand - gen) * dt, P.stored)
      P.stored -= draw
      supply += draw
      P.discharge = draw / dt
    } else {
      P.stored = Math.min(reserveCap, P.stored + (gen - demand) * dt)
      P.discharge = 0
    }
    const lifeNeed = lifeDemand * dt
    const lifeSat = lifeNeed > 0 ? Math.min(1, supply / lifeNeed) : 1
    const left = Math.max(0, supply - lifeNeed)
    const indSat = indDemand > 0 ? Math.min(1, left / (indDemand * dt)) : 1
    P.sat = demand > 0 ? Math.min(1, supply / (demand * dt)) : 1
    P.lifeSat = lifeSat
    P.indSat = indSat
    const satFor = (e: Ent) => (!e.onGrid ? 0 : LIFE.has(e.kind) ? lifeSat : indSat)
    // a sample every 2 s for the power graph (about three sols of history)
    if (this.time - P.lastSample >= 2) {
      P.lastSample = this.time
      P.history.push({ gen, demand, stored: P.stored, cap: reserveCap })
      if (P.history.length > 180) P.history.shift()
    }
    const sat = P.sat

    // 3 · machines
    let o2 = 0
    for (const e of this.ents.values()) {
      if (e.kind === 'belt' || e.kind === 'junction') continue
      const def = BUILDINGS[e.kind]
      e.working = false
      const sat = def.power > 0 ? satFor(e) : 1
      const spd = this.speed(e)
      if (def.mines) {
        if (!e.mineItem) e.status = 'badground'
        else if (e.active) {
          e.progress += (dt * sat * spd) / def.mineTime!
          e.working = sat > 0
          if (e.progress >= 1) {
            e.progress -= 1
            e.outBuf[e.mineItem] = (e.outBuf[e.mineItem] ?? 0) + 1
          }
        }
      } else if (def.recipe) {
        const r = def.recipe
        if (!e.crafting && this.hasInputs(e) && this.outTotal(e) < OUT_CAP) {
          for (const k in r.in) e.inBuf[k as ItemId]! -= r.in[k as ItemId]!
          e.crafting = true
          e.progress = 0
        }
        if (e.crafting) {
          if (e.progress < 1) {
            e.progress = Math.min(1, e.progress + (dt * sat * spd * this.boost(e.kind)) / r.time)
            e.working = sat > 0
            if (e.kind === 'greenhouse') o2 += 0.04 * dt * sat * spd
          }
          if (e.progress >= 1 && this.outTotal(e) < OUT_CAP) {
            for (const k in r.out) e.outBuf[k as ItemId] = (e.outBuf[k as ItemId] ?? 0) + r.out[k as ItemId]!
            e.crafting = false
            e.progress = 0
          }
        }
      } else if (e.kind === 'moxie') {
        o2 += 0.1 * dt * sat * spd
        e.working = sat > 0
      } else if (e.kind === 'lab' && this.current) {
        this.rp += 0.4 * dt * sat * spd
        e.working = sat > 0
      } else if (e.kind === 'core' && this.current) {
        this.rp += 0.12 * dt * sat
      }

      // output
      if (def.outputs) {
        const keys = (Object.keys(e.outBuf) as ItemId[]).filter((k) => (e.outBuf[k] ?? 0) > 0)
        if (keys.length) {
          const item = keys[e.outCursor++ % keys.length]
          const [oi, oj] = outTile(e)
          if (this.push(oi, oj, item, e.dir)) e.outBuf[item]!--
        }
      }

      // status
      if (e.kind === 'habitat') e.status = e.residents > 0 && !e.shielded ? 'unshielded' : e.shielded ? 'ok' : 'idle'
      else if ((def.power > 0 || def.gen) && !e.onGrid) e.status = 'nogrid'
      else if (def.power > 0 && e.active && sat < 0.5) e.status = 'nopower'
      else if (def.mines && e.mineItem) e.status = this.outTotal(e) >= OUT_CAP ? 'blocked' : 'ok'
      else if (def.recipe) e.status = this.outTotal(e) >= OUT_CAP ? 'blocked' : !e.crafting && !this.hasInputs(e) ? 'noinput' : 'ok'
      else if (e.kind === 'lab') e.status = this.current ? 'ok' : 'idle'
      else e.status = 'ok'
    }
    this.stock.o2 += o2

    // 4 · belts
    for (const e of this.ents.values()) {
      if (e.kind !== 'belt' || !e.items.length) continue
      const its = e.items
      for (let k = 0; k < its.length; k++) {
        const limit = k === 0 ? 1 : its[k - 1].pos - GAP
        its[k].pos = Math.max(its[k].pos, Math.min(its[k].pos + beltV, limit))
      }
      if (its[0].pos >= 1 && this.push(e.i + DI[e.dir], e.j + DJ[e.dir], its[0].item, e.dir)) its.shift()
    }
    // junction lanes
    for (const e of this.ents.values()) {
      if (e.kind !== 'junction') continue
      for (let d = 0; d < 4; d++) {
        const its = e.lanes[d]
        if (!its.length) continue
        for (let k = 0; k < its.length; k++) {
          const limit = k === 0 ? 1 : its[k - 1].pos - GAP
          its[k].pos = Math.max(its[k].pos, Math.min(its[k].pos + beltV, limit))
        }
        if (its[0].pos >= 1 && this.push(e.i + DI[d], e.j + DJ[d], its[0].item, d as Dir)) its.shift()
      }
    }

    // 5 · research
    if (this.current) {
      const r = RESEARCH.find((x) => x.id === this.current)!
      if (this.rp >= r.cost) {
        this.rp -= r.cost
        this.done.add(r.id)
        this.current = RESEARCH.find((x) => !this.done.has(x.id) && (!x.needs || this.done.has(x.needs)))?.id ?? null
        this.log(`Research complete: ${r.name}. ${r.effect}`, 'good')
        this.popups.push({ kind: 'research', title: r.name, body: r.fact, field: r.field })
      }
    }

    this.stations(dt)
    this.lifeSupport(dt, sat)
    this.events()
    this.missions()
    this.sampleRates()
    this.nudges()
  }

  /** One-time hints for the common ways new players get stuck. */
  private nudges() {
    const tip = (id: string, when: boolean, text: string) => {
      if (!when || this.tips.has(id)) return
      this.tips.add(id)
      this.log(text, 'warn')
    }
    tip('metal', this.stock.metal < 6 && this.delivered.metal === 0, 'Tip: low on metal? Right-click a building for a full refund, or mine ore → smelter → core.')
    tip('night', this.power.demand > 0 && this.sun() === 0 && this.count('battery') === 0 && this.power.sat < 0.5, 'Tip: it’s dark and the power is out. Battery banks store daytime solar for the night.')
    tip('housing', this.colonists >= this.housing() && this.time > SOL, 'Tip: no free beds. Build a habitat (key 8) next to a regolith shield so the next ship can bring crew.')
    for (const r of ['food', 'water', 'o2'] as const) {
      const rate = this.rates[r] ?? 0
      tip(`low-${r}`, rate < 0 && this.stock[r] / -rate < 0.75 && this.stock[r] > 0, `Warning: ${r === 'o2' ? 'oxygen' : r} runs out in under a sol at this rate!`)
    }
  }

  /** Solar stations slowly plant new panels on open, connected ground around them. */
  private stations(dt: number) {
    for (const e of [...this.ents.values()]) {
      if (e.kind !== 'solar' || e.level < MAX_LEVEL || e.planted >= STATION_MAX_PLANTS) continue
      e.plantIn -= dt
      if (e.plantIn > 0) continue
      e.plantIn = STATION_PLANT_EVERY
      if (this.stock.metal < (BUILDINGS.solar.cost.metal ?? 0)) continue
      const spots: [number, number][] = []
      for (let r = 1; r <= 2 && !spots.length; r++)
        for (let dj = -r; dj <= r; dj++)
          for (let di = -r; di <= r; di++) {
            if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue
            const i = e.i + di
            const j = e.j + dj
            if (!this.placeError('solar', i, j) && this.covered[j * MAP + i]) spots.push([i, j])
          }
      if (!spots.length) continue
      const [i, j] = spots[Math.floor(this.rng() * spots.length)]
      this.place('solar', i, j, 0)
      e.planted++
      if (e.planted === 1) this.log('A solar station has started planting its own panels around it.', 'good')
    }
  }

  private lifeSupport(dt: number, sat: number) {
    // assign residents: core first, then habitats
    let left = this.colonists
    const core = [...this.ents.values()].find((e) => e.kind === 'core')!
    core.residents = Math.min(left, this.beds(core))
    left -= core.residents
    let unshieldedResidents = 0
    for (const e of this.ents.values()) {
      if (e.kind !== 'habitat') continue
      e.residents = Math.min(left, this.beds(e))
      left -= e.residents
      if (e.residents && !e.shielded) unshieldedResidents += e.residents
    }

    this.shortages.clear()
    const waterUse = this.done.has('recycling') ? 0.4 : 1
    for (const r of ['food', 'water', 'o2'] as const) {
      this.owed[r] += ((this.colonists * NEEDS[r] * (r === 'water' ? waterUse : 1)) / SOL) * dt
      while (this.owed[r] >= 1 && this.stock[r] >= 1) {
        this.owed[r] -= 1
        this.stock[r] -= 1
      }
      if (this.owed[r] >= 1) {
        this.owed[r] = 1
        this.shortages.add(r)
      }
    }
    if (this.power.lifeSat < 0.5) this.shortages.add('power')
    const flare = this.ev.flare && this.time >= this.ev.flare.start
    if (unshieldedResidents > 0) this.shortages.add('radiation')

    let weight = 0
    for (const s of this.shortages) weight += s === 'radiation' ? (flare ? 2 : 0.4) : s === 'power' ? 0.5 : 1
    if (weight > 0) this.health = Math.max(0, this.health - dt * 0.35 * weight)
    else this.health = Math.min(100, this.health + dt * 0.25)

    if (this.health <= 0 && !this.over) {
      this.over = 'lost'
      this.popups.push({
        kind: 'lose',
        title: 'Mission failed',
        body: `On sol ${this.solNumber()} the crew had to evacuate. Every system depends on another — look at which resource ran out first, and build a buffer before it does.`,
      })
    }
  }

  private events() {
    const t = this.time
    const ev = this.ev
    // dust storms
    if (!ev.storm && t >= ev.nextStorm - 25) {
      const len = SOL * (0.45 + this.rng() * 0.35)
      ev.storm = { start: ev.nextStorm, end: ev.nextStorm + len }
      this.log('Dust storm approaching! Solar output will drop. Charge your batteries.', 'warn')
    }
    if (ev.storm && t >= ev.storm.end) {
      ev.storm = null
      ev.nextStorm = t + SOL * (2 + this.rng() * 2)
      this.log('The dust storm has passed. Skies clearing.', 'info')
    }
    // solar particle events
    if (!ev.flare && t >= ev.nextFlare - 20) {
      ev.flare = { start: ev.nextFlare, end: ev.nextFlare + 25 }
      this.log('Solar flare detected! Radiation spike in 20 s — unshielded habitats are at risk.', 'warn')
    }
    if (ev.flare && t >= ev.flare.end) {
      ev.flare = null
      ev.nextFlare = t + SOL * (2.5 + this.rng() * 2.5)
      this.log('Radiation levels back to normal.', 'info')
    }
    // supply ships
    if (t >= ev.nextShip) {
      ev.nextShip = t + SOL * 1.5
      ev.ship = t
      const free = this.housing() - this.colonists
      const stable = this.health >= 60 && !this.shortages.has('food') && !this.shortages.has('water') && !this.shortages.has('o2')
      this.stock.metal += 8
      if (free > 0 && stable) {
        const n = Math.min(4, free)
        this.colonists += n
        this.log(`Supply ship landed: ${n} new colonist${n > 1 ? 's' : ''} and 8 metal.`, 'good')
      } else if (!stable) this.log('Supply ship landed with 8 metal. Crew stayed aboard — the colony isn’t stable yet.', 'warn')
      else this.log('Supply ship landed with 8 metal. No free housing, so no new crew. Build habitats!', 'warn')
    }
  }

  private missions() {
    const m = MISSIONS[this.mission]
    if (!m || !m.check(this)) return
    this.mission++
    this.log(`Mission complete: ${m.title}.`, 'good')
    if (m.win && !this.won) {
      this.won = true
      this.popups.push({
        kind: 'win',
        title: 'Colony 001 is self-sufficient',
        body: `Sol ${this.solNumber()}: ${this.colonists} colonists live on water from ice, food from washed regolith, oxygen from CO₂ and power from the Sun. Keep building — or try a new map.`,
      })
    }
  }

  private sampleRates() {
    const last = this.history[this.history.length - 1]
    if (last && this.time - last.t < 5) return
    this.history.push({ t: this.time, s: { ...this.stock } })
    while (this.history.length > 2 && this.time - this.history[0].t > 60) this.history.shift()
    const first = this.history[0]
    const span = this.time - first.t
    if (span < 10) return
    for (const k of Object.keys(this.stock) as StockId[]) this.rates[k] = ((this.stock[k] - first.s[k]) / span) * SOL
  }

  /* ------------------------------ persistence ----------------------------- */

  save(): SaveData {
    return {
      v: 1,
      seed: this.seed,
      time: this.time,
      stock: { ...this.stock },
      colonists: this.colonists,
      health: this.health,
      stored: this.power.stored,
      rp: this.rp,
      done: [...this.done],
      current: this.current,
      mission: this.mission,
      delivered: { ...this.delivered },
      ents: [...this.ents.values()].filter((e) => e.kind !== 'core').map((e) => [e.kind, e.i, e.j, e.dir, e.level]),
      ev: { ...this.ev },
      won: this.won,
      wear: [...this.wear].flatMap((w, k) => (w ? [[k, w] as [number, number]] : [])),
    }
  }

  static load(d: SaveData): Sim {
    const s = new Sim(d.seed)
    s.time = d.time
    s.stock = { ...s.stock, ...d.stock }
    s.colonists = d.colonists
    s.health = d.health
    s.power.stored = d.stored
    s.rp = d.rp
    s.done = new Set(d.done)
    s.current = d.current
    s.mission = d.mission
    s.delivered = { ...s.delivered, ...d.delivered }
    s.ev = { ...s.ev, ...d.ev }
    s.won = d.won
    for (const [k, w] of d.wear ?? []) if (k >= 0 && k < s.wear.length) s.wear[k] = w
    // buildings from older saves may have grown since; any that no longer fit are refunded
    const fits = (k: Kind, i: number, j: number) => {
      const { w, h } = BUILDINGS[k]
      for (let dj = 0; dj < h; dj++) for (let di = 0; di < w; di++) if (!s.groundAt(i + di, j + dj) || s.entAt(i + di, j + dj)) return false
      return true
    }
    for (const [k, i, j, dir, level] of d.ents) {
      if (!BUILDINGS[k]) continue
      if (fits(k, i, j)) s.add(k, i, j, dir).level = Math.min(MAX_LEVEL, Math.max(1, level ?? 1))
      else {
        s.stock.metal += BUILDINGS[k].cost.metal ?? 0
        s.stock.brick += BUILDINGS[k].cost.brick ?? 0
      }
    }
    s.updateShielding()
    return s
  }
}

export const itemName = (k: ItemId) => ITEMS[k].name
