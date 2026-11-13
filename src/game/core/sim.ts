/**
 * RENOVA simulation. Pure TypeScript — no Phaser, no DOM — so it can be
 * stepped headless, saved to JSON and rendered by anything.
 *
 * Types live in ./types, world generation and geometry in ./world; both are
 * re-exported from here so callers can keep importing from `@/game/core/sim`.
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
} from '@/game/core/data'
import { MISSIONS } from '@/game/core/missions'
import {
  IN_BACK,
  IN_N,
  IN_P,
  OutdatedSaveError,
  SAVE_VERSION,
  type BeltItem,
  type Ent,
  type Msg,
  type Outlet,
  type Popup,
  type SaveData,
  type SaveEnt,
  type Shortage,
  type Tone,
} from '@/game/core/types'
import { CORE_AT, generateGround, mulberryNext, outTile } from '@/game/core/world'

export * from '@/game/core/types'
export * from '@/game/core/world'

/* -------------------------------- tuning -------------------------------- */

/** Minimum spacing between items on a belt or junction lane (in tile lengths). */
/** Minimum spacing between items on a belt, in tiles. */
const GAP = 0.3
/** Items a junction lane holds: as many as fit at GAP spacing across one tile. */
const LANE_CAP = Math.floor(1 / GAP) + 1
/** Seconds a belt can sit full and still before it counts as jammed. */
const JAM_AFTER = 1
const BELT_SPEED = 1.5
/** Items a machine holds in its output before it stops working. */
const OUT_CAP = 6
/** The core carries a small reserve of its own, on top of any battery banks. */
export const RESERVE_KJ = 1000
/** Health weight of crew without a powered bed (gentle next to food/water/oxygen at 1). */
const HOMELESS_WEIGHT = 0.25

/** Life support gets power before industry when there isn't enough. */
const LIFE = new Set<Kind>(['core', 'habitat', 'moxie'])
const ITEM_IDS = Object.keys(ITEMS) as ItemId[]
/** Longest cable any grid node can run, which sizes the buckets of the grid search. */
const MAX_LINK = Math.max(CORE_LINK, ...PYLON_LINK)

/** Wear needed before tyre tracks show, and before a track becomes a road. */
export const TRACK_WEAR = 3
export const ROAD_WEAR = 12

/** Does this building do nothing unless it is connected to the grid? */
/** Buildings that only work when connected to the power grid. */
export const needsGrid = (k: Kind) => BUILDINGS[k].power > 0 || !!BUILDINGS[k].gen || k === 'battery' || k === 'pylon'

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export class Sim {
  seed: number
  ground: Ground[]
  occ: Int32Array
  ents = new Map<number, Ent>()
  nextId = 1
  /** Bumped on every layout change (place, remove, rotate, upgrade). Caches key off it. */
  rev = 0
  time = 0
  stock: Record<StockId, number> = { ice: 0, water: 30, regolith: 0, ore: 0, metal: 100, brick: 30, soil: 0, food: 30, o2: 40 }
  delivered: Record<ItemId, number> = { ice: 0, water: 0, regolith: 0, ore: 0, metal: 0, brick: 0, soil: 0, food: 0 }
  colonists = 4
  health = 100
  owed: Record<'food' | 'water' | 'o2', number> = { food: 0, water: 0, o2: 0 }
  shortages = new Set<Shortage>()
  /** kJ in the core's own reserve. Battery banks keep their charge in `Ent.charge`. */
  reserve = RESERVE_KJ
  power = {
    gen: 0,
    demand: 0,
    sat: 1,
    /** kJ stored in the core reserve and every connected battery bank. */
    stored: RESERVE_KJ,
    /** kJ capacity of connected battery banks (add RESERVE_KJ for the core's reserve). */
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
  /** Research projects finished with a lab's help (the core alone researches slowly). */
  labProjects = 0
  /** Index into MISSIONS of the current mission (MISSIONS.length once all are done). */
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
  /** Buildings just upgraded, for a drone to come and fit the new parts. */
  justUpgraded: number[] = []
  /** Seeded random numbers for events and solar stations; its state is saved. */
  rng: () => number
  ev: SaveData['ev'] = {
    storm: null,
    flare: null,
    nextStorm: SOL * 2.6,
    nextFlare: SOL * 3.4,
    nextShip: SOL * 1.1,
    ship: -1, // time of the last landing (for the animation)
  }

  private rngState: number
  private history: { t: number; s: Record<StockId, number> }[] = []
  private msgId = 1
  private tips = new Set<string>()
  /** Research points labs added since the last project finished. */
  private rpFromLabs = 0
  private coreEnt!: Ent

  constructor(seed = Math.floor(Math.random() * 1e9)) {
    this.seed = seed
    this.rngState = (seed ^ 0x5eed) | 0
    this.rng = () => {
      const [v, next] = mulberryNext(this.rngState)
      this.rngState = next
      return v
    }
    this.ground = generateGround(seed)
    this.occ = new Int32Array(MAP * MAP)
    this.coreEnt = this.add('core', CORE_AT, CORE_AT, 0)
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
  /** The colony core (always present). */
  get core() {
    return this.coreEnt
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

  private kindRev = -1
  private byKind = new Map<Kind, Ent[]>()
  /** Every building of one kind, in build order. Cached per layout; don't mutate the array. */
  list(kind: Kind): readonly Ent[] {
    if (this.kindRev !== this.rev) {
      this.kindRev = this.rev
      this.byKind.clear()
      for (const e of this.ents.values()) {
        const l = this.byKind.get(e.kind)
        if (l) l.push(e)
        else this.byKind.set(e.kind, [e])
      }
    }
    return this.byKind.get(kind) ?? []
  }
  count(kind: Kind) {
    return this.list(kind).length
  }
  /** Does this building's housing count? The core always; habitats only when on the grid. */
  hasBeds(e: Ent) {
    if (e.kind === 'core') return true
    if (e.kind !== 'habitat') return false
    this.ensureGrid()
    return e.onGrid
  }
  /** Beds the colony can use: the core plus every habitat connected to the grid. */
  housing() {
    let h = this.beds(this.coreEnt)
    for (const e of this.list('habitat')) if (this.hasBeds(e)) h += this.beds(e)
    return h
  }
  /** Total upgrade levels across all buildings (0 when nothing has been upgraded). */
  get upgrades() {
    let n = 0
    for (const e of this.ents.values()) n += e.level - 1
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
    if (!this.unlocked(kind)) return 'Not researched yet'
    const err = this.siteError(kind, i, j)
    if (err) return err
    if (!this.affordable(kind)) return 'Not enough materials'
    return null
  }

  /** Ground and space checks only (no cost or research). */
  private siteError(kind: Kind, i: number, j: number): string | null {
    const def = BUILDINGS[kind]
    for (let dj = 0; dj < def.h; dj++)
      for (let di = 0; di < def.w; di++) {
        const g = this.groundAt(i + di, j + dj)
        if (!g) return 'Off the map'
        if (g === 'rock') return 'Boulder in the way'
        if (g === 'crater') return 'Crater — unstable ground'
        if (this.occ[(j + dj) * MAP + i + di]) return 'Tile is taken'
      }
    if (def.mines && !this.mineItemAt(kind, i, j)) return kind === 'drill' ? 'Ice drills need an ice deposit' : 'Excavators need sand or ore'
    return null
  }

  /**
   * What a miner placed at (i, j) digs. It works if any tile of its footprint is minable,
   * and digs the yield of the most common minable ground under it (a tie goes to the
   * richer ground: ice, then ore, then sand). Null when nothing under it is minable.
   */
  mineItemAt(kind: Kind, i: number, j: number): ItemId | null {
    const def = BUILDINGS[kind]
    if (!def.mines) return null
    const order: Ground[] = ['ice', 'ore', 'sand']
    let best: Ground | null = null
    let bestN = 0
    for (const g of order) {
      if (!def.mines[g]) continue
      let n = 0
      for (let dj = 0; dj < def.h; dj++) for (let di = 0; di < def.w; di++) if (this.groundAt(i + di, j + dj) === g) n++
      if (n > bestN) {
        best = g
        bestN = n
      }
    }
    return best ? def.mines[best]! : null
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
      mineItem: this.mineItemAt(kind, i, j),
      shielded: false,
      residents: 0,
      outCursor: 0,
      outSide: 0,
      curve: null,
      inMask: 0,
      lanes: [[], [], [], []],
      level: 1,
      onGrid: false,
      plantIn: STATION_PLANT_EVERY,
      planted: 0,
      charge: 0,
      capStart: true,
      capEnd: true,
      wantAt: [-9, -9, -9, -9],
      lastOk: [-9, -9, -9, -9],
      stall: 0,
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

  /**
   * Take a building down and refund everything spent on it, upgrades included.
   * Items on it (belt items, buffers) and a battery's charge are lost.
   */
  remove(i: number, j: number): Ent | null {
    const e = this.entAt(i, j)
    if (!e || e.kind === 'core') return null
    const def = BUILDINGS[e.kind]
    const back = this.refundFor(e)
    this.stock.metal += back.metal
    this.stock.brick += back.brick
    // nothing is lost: whatever it was carrying or holding goes back to the core's stores
    for (const it of e.items) this.stock[it.item]++
    for (const lane of e.lanes) for (const it of lane) this.stock[it.item]++
    for (const buf of [e.inBuf, e.outBuf]) for (const k in buf) this.stock[k as ItemId] += buf[k as ItemId] ?? 0
    for (let dj = 0; dj < def.h; dj++) for (let di = 0; di < def.w; di++) this.occ[(e.j + dj) * MAP + e.i + di] = 0
    this.ents.delete(e.id)
    this.rev++
    if (e.kind === 'shield' || e.kind === 'habitat') this.updateShielding()
    return e
  }

  /** What removing this building gives back: its cost plus every upgrade paid for. */
  refundFor(e: { kind: Kind; level: number }) {
    return Sim.spent(e.kind, e.level)
  }

  private static spent(kind: Kind, level: number) {
    const c = BUILDINGS[kind].cost
    const total = { metal: c.metal ?? 0, brick: c.brick ?? 0 }
    for (let l = 1; l < level; l++) {
      const u = Sim.upgradeCostAt(kind, l)
      if (!u) break
      total.metal += u.metal
      total.brick += u.brick
    }
    return total
  }

  /** Turn a belt. Buildings don't turn: belts plug into any side of them. */
  rotate(e: Ent, by = 1) {
    if (e.kind !== 'belt') return
    e.dir = ((e.dir + by + 4) % 4) as Dir
    this.rev++
  }

  setDir(e: Ent, dir: Dir) {
    if (e.dir === dir) return
    e.dir = dir
    this.rev++
  }

  setResearch(id: ResearchId) {
    const r = RESEARCH.find((x) => x.id === id)
    if (!r || this.done.has(id) || (r.needs && !this.done.has(r.needs))) return
    this.current = id
  }

  log(text: string, tone: Tone = 'info') {
    this.messages.push({ id: this.msgId++, text, tone, t: this.time })
    if (this.messages.length > 40) this.messages.shift()
  }

  /* --------------------------------- roads -------------------------------- */

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

  /* ------------------------------ levels ------------------------------- */

  /** Work-speed multiplier from a building's level. */
  speed(e: Ent) {
    return SPEED[e.level - 1]
  }
  /** kW a building draws while active. */
  draw(e: Ent) {
    return BUILDINGS[e.kind].power * POWER_SCALE[e.level - 1]
  }
  /** Bed capacity of a building at its level (whether or not the beds are usable; see `hasBeds`). */
  beds(e: Ent) {
    if (e.kind === 'habitat') return HABITAT_BEDS[e.level - 1]
    return BUILDINGS[e.kind].housing ?? 0
  }
  batteryKJ(e: Ent) {
    return BATTERY_KJ_LEVEL[e.level - 1]
  }

  /** Materials to take a building to its next level, or null at the top / when it can't be upgraded. */
  upgradeCost(e: Ent): { metal: number; brick: number } | null {
    return Sim.upgradeCostAt(e.kind, e.level)
  }

  private static upgradeCostAt(kind: Kind, level: number): { metal: number; brick: number } | null {
    if (!UPGRADES[kind] || level >= MAX_LEVEL) return null
    const c = BUILDINGS[kind].cost
    const k = level === 1 ? 1.5 : 2.5
    return { metal: Math.ceil((c.metal ?? 0) * k) + (level === 1 ? 4 : 10), brick: Math.ceil((c.brick ?? 0) * k) + (level === 2 ? 6 : 0) }
  }

  upgrade(e: Ent): string | null {
    if (!UPGRADES[e.kind]) return `${BUILDINGS[e.kind].name}s can’t be upgraded`
    const cost = this.upgradeCost(e)
    if (!cost) return 'Already fully upgraded'
    if (this.stock.metal < cost.metal || this.stock.brick < cost.brick) return 'Not enough materials'
    this.stock.metal -= cost.metal
    this.stock.brick -= cost.brick
    e.level++
    this.rev++
    this.justUpgraded.push(e.id)
    const name = UPGRADES[e.kind]!.names[e.level - 1]
    this.log(`Upgraded to ${name}.`, 'good')
    if (e.kind === 'shield' || e.kind === 'habitat') this.updateShielding()
    return null
  }

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
    // nodes by index, with their centres and cable reach precomputed
    const nodes: Ent[] = [this.coreEnt, ...this.list('pylon')]
    const n = nodes.length
    const cx = new Float64Array(n)
    const cy = new Float64Array(n)
    const reach = new Float64Array(n)
    // bucket nodes into MAX_LINK-sized cells so each node only checks its 3×3 neighbourhood
    const cells = Math.ceil(MAP / MAX_LINK)
    const cellX = new Int32Array(n)
    const cellY = new Int32Array(n)
    const bucket: number[][] = Array.from({ length: cells * cells }, () => [])
    for (let k = 0; k < n; k++) {
      const e = nodes[k]
      cx[k] = e.i + (BUILDINGS[e.kind].w - 1) / 2
      cy[k] = e.j + (BUILDINGS[e.kind].h - 1) / 2
      reach[k] = this.nodeLink(e)
      cellX[k] = clamp(Math.floor(cx[k] / MAX_LINK), 0, cells - 1)
      cellY[k] = clamp(Math.floor(cy[k] / MAX_LINK), 0, cells - 1)
      bucket[cellY[k] * cells + cellX[k]].push(k)
    }
    const isJoined = new Uint8Array(n)
    isJoined[0] = 1
    const queue = [0]
    this.links = []
    for (let head = 0; head < queue.length; head++) {
      const a = queue[head]
      for (let y = Math.max(0, cellY[a] - 1); y <= Math.min(cells - 1, cellY[a] + 1); y++)
        for (let x = Math.max(0, cellX[a] - 1); x <= Math.min(cells - 1, cellX[a] + 1); x++)
          for (const b of bucket[y * cells + x]) {
            if (isJoined[b]) continue
            const dx = cx[a] - cx[b]
            const dy = cy[a] - cy[b]
            const r = Math.max(reach[a], reach[b])
            if (dx * dx + dy * dy <= r * r) {
              isJoined[b] = 1
              queue.push(b)
              this.links.push([nodes[a].id, nodes[b].id])
            }
          }
    }
    const joined = new Set<Ent>()
    for (let k = 0; k < n; k++) if (isJoined[k]) joined.add(nodes[k])
    this.covered.fill(0)
    for (const n of joined) {
      const r = this.nodeReach(n)
      const { w, h } = BUILDINGS[n.kind]
      for (let j = Math.max(0, n.j - r); j < Math.min(MAP, n.j + h + r); j++)
        for (let i = Math.max(0, n.i - r); i < Math.min(MAP, n.i + w + r); i++) this.covered[j * MAP + i] = 1
    }
    for (const e of this.ents.values()) {
      if (e.kind === 'pylon' || e.kind === 'core') {
        e.onGrid = joined.has(e)
        continue
      }
      e.onGrid = this.anyCovered(e.kind, e.i, e.j)
    }
  }

  /** The core and every pylon that is joined to it by cables: the nodes that actually power things. */
  private gridNodes(): Ent[] {
    this.ensureGrid()
    return [this.coreEnt, ...this.list('pylon').filter((p) => p.onGrid)]
  }

  /**
   * The grid node powering a `kind` footprint at (i, j): the core or a connected pylon whose
   * square reaches it (the nearest, if several do). Null if none does.
   */
  gridSource(kind: Kind, i: number, j: number): Ent | null {
    const { w, h } = BUILDINGS[kind]
    let best: Ent | null = null
    let bestD = Infinity
    for (const n of this.gridNodes()) {
      const r = this.nodeReach(n)
      const N = BUILDINGS[n.kind]
      const reaches = i < n.i + N.w + r && i + w > n.i - r && j < n.j + N.h + r && j + h > n.j - r
      if (!reaches) continue
      const d = Math.hypot(i + (w - 1) / 2 - (n.i + (N.w - 1) / 2), j + (h - 1) / 2 - (n.j + (N.h - 1) / 2))
      if (d < bestD) {
        best = n
        bestD = d
      }
    }
    return best
  }

  /**
   * Would a new pylon at (i, j) join the grid? It needs a cable to the core or a connected pylon:
   * within the longer of the two cable reaches, centre to centre. Returns the node it would link
   * to, or the nearest node and how far short it falls.
   */
  pylonLink(i: number, j: number): { via: Ent | null; near: Ent | null; dist: number; reach: number } {
    let near: Ent | null = null
    let nearGap = Infinity
    let nearDist = 0
    let nearReach = 0
    for (const n of this.gridNodes()) {
      const N = BUILDINGS[n.kind]
      const dist = Math.hypot(i - (n.i + (N.w - 1) / 2), j - (n.j + (N.h - 1) / 2))
      const reach = Math.max(PYLON_LINK[0], this.nodeLink(n))
      if (dist <= reach) return { via: n, near: n, dist, reach }
      if (dist - reach < nearGap) {
        nearGap = dist - reach
        near = n
        nearDist = dist
        nearReach = reach
      }
    }
    return { via: null, near, dist: nearDist, reach: nearReach }
  }

  /** Is any tile of a `kind` footprint at (i, j) inside grid coverage? (How buildings join the grid.) */
  private anyCovered(kind: Kind, i: number, j: number) {
    const { w, h } = BUILDINGS[kind]
    for (let dj = 0; dj < h; dj++)
      for (let di = 0; di < w; di++) {
        const x = i + di
        const y = j + dj
        if (x >= 0 && y >= 0 && x < MAP && y < MAP && this.covered[y * MAP + x]) return true
      }
    return false
  }

  /* ------------------------------- belts -------------------------------- */

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
    if (e.kind === 'belt') {
      const [oi, oj] = outTile(e)
      return oi === i && oj === j
    }
    // a machine feeds any belt beside it that points away from it
    const d = Sim.sideOf(e, i, j)
    const t = d === null ? null : this.entAt(i, j)
    return !!t && t.kind === 'belt' && t.dir === d
  }

  /**
   * Which way (i, j) lies off the edge of e's footprint: 0 east (+i), 1 south (+j), 2 west, 3 north.
   * Null if it isn't directly beside an edge (inside, diagonal from a corner, or further away).
   */
  static sideOf(e: { kind: Kind; i: number; j: number }, i: number, j: number): Dir | null {
    const { w, h } = BUILDINGS[e.kind]
    const inI = i >= e.i && i < e.i + w
    const inJ = j >= e.j && j < e.j + h
    if (inJ && i === e.i + w) return 0
    if (inI && j === e.j + h) return 1
    if (inJ && i === e.i - 1) return 2
    if (inI && j === e.j - 1) return 3
    return null
  }

  /** Where each machine sends its products (rebuilt when the layout changes). */
  private outletMap = new Map<number, Outlet[]>()

  /**
   * Everything a machine can hand its products to: every belt beside it that points away from
   * it, every junction beside it, and every building it touches that uses something it makes
   * (each building once). Several outlets take turns.
   */
  outletsOf(e: Ent): Outlet[] {
    this.ensureBelts()
    return this.outletMap.get(e.id) ?? []
  }

  private findOutlets(e: Ent): Outlet[] {
    const { w, h } = BUILDINGS[e.kind]
    const out: Outlet[] = []
    const seen = new Set<number>()
    const makes = BUILDINGS[e.kind].recipe ? (Object.keys(BUILDINGS[e.kind].recipe!.out) as ItemId[]) : e.mineItem ? [e.mineItem] : []
    const look = (i: number, j: number, dir: Dir) => {
      const n = this.entAt(i, j)
      if (!n || n === e) return
      if (n.kind === 'belt') {
        if (n.dir === dir) out.push({ i, j, dir, kind: 'belt' })
      } else if (n.kind === 'junction') out.push({ i, j, dir, kind: 'junction' })
      else if (!seen.has(n.id) && (n.kind === 'core' || makes.some((m) => BUILDINGS[n.kind].recipe?.in[m]))) {
        seen.add(n.id)
        out.push({ i, j, dir, kind: 'building' })
      }
    }
    for (let di = 0; di < w; di++) {
      look(e.i + di, e.j + h, 1)
      look(e.i + di, e.j - 1, 3)
    }
    for (let dj = 0; dj < h; dj++) {
      look(e.i + w, e.j + dj, 0)
      look(e.i - 1, e.j + dj, 2)
    }
    return out
  }

  private fedFrom(b: Ent, side: Dir) {
    const n = this.entAt(b.i + DI[side], b.j + DJ[side])
    return !!n && this.feeds(n, b.i, b.j)
  }

  private topoRev = -1

  /**
   * Recompute belt shapes (straight, corner, capped ends) after the layout changes.
   * Items that came in round a curve that no longer exists go straight from then on.
   */
  ensureBelts() {
    if (this.topoRev === this.rev) return
    this.topoRev = this.rev
    for (const b of this.list('belt')) {
      const d = b.dir
      const pSide = ((d + 1) % 4) as Dir
      const nSide = ((d + 3) % 4) as Dir
      const backFeeds = this.fedFrom(b, ((d + 2) % 4) as Dir)
      const pFeeds = this.fedFrom(b, pSide)
      const nFeeds = this.fedFrom(b, nSide)
      b.curve = !backFeeds && pFeeds !== nFeeds ? (pFeeds ? pSide : nSide) : null
      b.inMask = (backFeeds ? IN_BACK : 0) | (pFeeds ? IN_P : 0) | (nFeeds ? IN_N : 0)
      b.capStart = b.inMask === 0
      const front = this.entAt(b.i + DI[d], b.j + DJ[d])
      b.capEnd = !front || (front.kind === 'belt' ? front.dir === (d + 2) % 4 : front.kind !== 'core' && front.kind !== 'junction' && !BUILDINGS[front.kind].recipe)
      for (const it of b.items) {
        if (it.from === undefined) continue
        const still = !backFeeds && ((it.from === pSide && pFeeds) || (it.from === nSide && nFeeds))
        if (!still) delete it.from
      }
    }
    this.flow = this.flowOrder()
    this.outletMap.clear()
    for (const e of this.ents.values()) if (BUILDINGS[e.kind].outputs && e.kind !== 'belt') this.outletMap.set(e.id, this.findOutlets(e))
  }

  /** Belts and junctions in the order they move: furthest downstream first. */
  private flow: Ent[] = []

  /**
   * Order belts and junctions so each one moves before whatever feeds it. A full line then
   * advances as one, without a gap opening at every tile edge, whatever order the tiles were
   * built in. Loops have no "furthest" tile; they're cut at an arbitrary point.
   */
  private flowOrder(): Ent[] {
    const nodes = [...this.list('belt'), ...this.list('junction')]
    const next = (e: Ent): Ent[] => {
      const out: Ent[] = []
      const dirs = e.kind === 'belt' ? [e.dir] : [0, 1, 2, 3]
      for (const d of dirs) {
        const n = this.entAt(e.i + DI[d], e.j + DJ[d])
        if (n && (n.kind === 'belt' || n.kind === 'junction')) out.push(n)
      }
      return out
    }
    // iterative depth-first search; a node is emitted after everything downstream of it
    const done = new Set<number>()
    const order: Ent[] = []
    for (const root of nodes) {
      if (done.has(root.id)) continue
      const stack: [Ent, Ent[], number][] = [[root, next(root), 0]]
      done.add(root.id)
      while (stack.length) {
        const top = stack[stack.length - 1]
        const [e, kids] = top
        if (top[2] < kids.length) {
          const k = kids[top[2]++]
          if (!done.has(k.id)) {
            done.add(k.id)
            stack.push([k, next(k), 0])
          }
        } else {
          order.push(e)
          stack.pop()
        }
      }
    }
    return order
  }

  /* ------------------------------ machines ------------------------------ */

  /**
   * Square-wise distance between the nearest tiles of two footprints: 1 when they touch,
   * 2 with one tile of ground between them, 0 if they overlap.
   */
  static gap(a: { kind: Kind; i: number; j: number }, b: { kind: Kind; i: number; j: number }) {
    const A = BUILDINGS[a.kind]
    const B = BUILDINGS[b.kind]
    const gi = Math.max(0, a.i - (b.i + B.w - 1), b.i - (a.i + A.w - 1))
    const gj = Math.max(0, a.j - (b.j + B.h - 1), b.j - (a.j + A.h - 1))
    return Math.max(gi, gj)
  }

  private updateShielding() {
    const shields = this.list('shield')
    for (const e of this.list('habitat')) e.shielded = shields.some((s) => Sim.gap(s, e) <= SHIELD_REACH[s.level - 1])
  }

  /**
   * Does machine `e` take `item` now? Each ingredient is buffered up to 3 crafts' worth —
   * except while the machine is starved of another ingredient: then it keeps taking
   * whatever arrives, so one mixed belt carrying both ingredients can never jam.
   */
  private accepts(e: Ent, item: ItemId) {
    if (e.kind === 'core') return true
    const r = BUILDINGS[e.kind].recipe
    const need = r?.in[item]
    if (!need) return false
    return (e.inBuf[item] ?? 0) < need * 3 || !this.hasInputs(e)
  }

  private deliver(e: Ent, item: ItemId) {
    if (e.kind === 'core') {
      this.stock[item]++
      this.delivered[item]++
    } else e.inBuf[item] = (e.inBuf[item] ?? 0) + 1
  }

  /** Sim steps taken: the clock for fair merging. */
  private tick = 0

  /** Has another input of `t` been waiting longer than the one on `side`? Then `side` gives way. */
  private mustYield(t: Ent, side: Dir) {
    for (let d = 0; d < 4; d++) if (d !== side && t.wantAt[d] >= this.tick - 1 && t.lastOk[d] < t.lastOk[side]) return true
    return false
  }

  /**
   * Hand an item travelling in `dir` to whatever sits on tile (i, j). `over` is how far past the
   * tile edge it got this step; it carries on that far onto the next belt (as room allows), so
   * spacing isn't lost at every tile edge. Inputs that are turned away are remembered, so a busy
   * line has to leave a gap for a waiting side feed (see `mustYield`).
   */
  private push(i: number, j: number, item: ItemId, dir: Dir, over = 0): boolean {
    const t = this.entAt(i, j)
    if (!t) return false
    const side = ((dir + 2) % 4) as Dir // the side of t the item comes in from
    if (t.kind === 'belt') {
      if (t.dir === side) return false // head-on: belts pointing at each other
      // Straight in → start of the belt. From a side with nothing feeding the back (a corner or a Y):
      // start of that side's curve. From a side into a fed belt: merge in at the middle.
      const fromSide = t.dir !== dir
      const curved = fromSide && !(t.inMask & IN_BACK)
      const p = !fromSide || curved ? 0 : 0.5
      // room: the nearest item ahead of the entry point, and anything just behind a mid-belt merge
      let ahead = Infinity
      for (const it of t.items) {
        if (it.pos >= p) ahead = Math.min(ahead, it.pos)
        else if (p - it.pos < GAP) return this.refuse(t, side)
      }
      const at = p + Math.max(0, Math.min(over, ahead - GAP - p))
      // the main line entering at the back never competes with a mid-belt merge, so it never yields here
      if (ahead - at < GAP - 1e-9 || (fromSide && this.mustYield(t, side))) return this.refuse(t, side)
      let k = 0
      while (k < t.items.length && t.items[k].pos > at) k++
      t.items.splice(k, 0, curved ? { item, pos: at, from: side } : { item, pos: at })
      t.lastOk[side] = this.tick
      return true
    }
    if (t.kind === 'junction') {
      // crossing: each travel direction has its own lane, so lines pass through without mixing
      const lane = t.lanes[dir]
      const tail = lane.length ? lane[lane.length - 1].pos : Infinity
      const at = Math.max(0, Math.min(over, tail - GAP))
      if (lane.length >= LANE_CAP || tail - at < GAP - 1e-9) return false
      lane.push({ item, pos: at })
      return true
    }
    if (!this.accepts(t, item)) return false
    this.deliver(t, item)
    return true
  }

  private refuse(t: Ent, side: Dir) {
    t.wantAt[side] = this.tick
    return false
  }

  /**
   * Hand one finished item to the next outlet in turn (see `outletsOf`): belts and buildings
   * share a machine's output evenly, and if one outlet is full or doesn't want an item the
   * next one gets the chance.
   */
  private emit(e: Ent) {
    const outs = this.outletMap.get(e.id)
    if (!outs?.length) return
    for (let n = 0; n < outs.length; n++) {
      const k = (e.outSide + n) % outs.length
      const o = outs[k]
      for (let m = 0; m < ITEM_IDS.length; m++) {
        const idx = (e.outCursor + m) % ITEM_IDS.length
        const item = ITEM_IDS[idx]
        if (!(e.outBuf[item]! > 0)) continue
        if (this.push(o.i, o.j, item, o.dir)) {
          e.outBuf[item]!--
          e.outCursor = idx + 1
          e.outSide = k + 1
          return
        }
      }
    }
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

  private static outCount(kind: Kind) {
    const r = BUILDINGS[kind].recipe!
    let n = 0
    for (const k in r.out) n += r.out[k as ItemId] ?? 0
    return n
  }

  /** Research that speeds machines up. */
  private boost(kind: Kind) {
    if (kind === 'washer' && this.done.has('washing')) return 2
    if (kind === 'greenhouse' && this.done.has('leds')) return 1.5
    return 1
  }

  /* --------------------------- power helpers ---------------------------- */

  /** Sunlight on the panels right now: day/night, dust storms and self-cleaning research. */
  private solarFactor() {
    const dust = this.ev.storm && this.time >= this.ev.storm.start ? (this.done.has('dustproof') ? 0.6 : 0.25) : 1
    return this.sun() * dust * (this.done.has('dustproof') ? 1.3 : 1)
  }

  /** kW a generator makes right now (solar with the sun, storms and level; reactors by level); 0 off the grid. */
  genKW(e: Ent) {
    if (!e.onGrid) return 0
    if (e.kind === 'solar') return SOLAR_KW[e.level - 1] * this.solarFactor()
    if (e.kind === 'reactor') return REACTOR_KW[e.level - 1]
    return 0
  }

  /** Share of its power a building got last step (0 off the grid). */
  satFor(e: Ent) {
    return !e.onGrid ? 0 : LIFE.has(e.kind) ? this.power.lifeSat : this.power.indSat
  }

  /** Research points per second right now: every connected lab plus the core's share; 0 with nothing to research. */
  researchRate() {
    if (!this.current) return 0
    let r = 0.12 * this.satFor(this.coreEnt)
    for (const e of this.list('lab')) r += 0.4 * this.satFor(e) * this.speed(e)
    return r
  }

  /* ----------------------------- simulation ------------------------------- */

  step(dt: number) {
    if (this.over || !(dt > 0) || !Number.isFinite(dt)) return
    this.ensureBelts()
    this.ensureGrid()
    this.time += dt
    this.tick++
    this.stepPower(dt)
    this.stepMachines(dt)
    this.stepBelts(dt)
    this.stepResearch()
    this.stations(dt)
    this.lifeSupport(dt)
    this.events()
    this.missions()
    this.sampleRates()
    this.nudges()
  }

  /** Who wants power, who makes it, and how far it stretches: life support first, then industry; storage buffers both. */
  private stepPower(dt: number) {
    let lifeDemand = 0
    let indDemand = 0
    let gen = 0
    let solarGen = 0
    let cap = 0
    this.reserve = clamp(this.reserve, 0, RESERVE_KJ)
    let stored = this.reserve
    const byKind: Partial<Record<Kind, number>> = {}
    for (const e of this.ents.values()) {
      const def = BUILDINGS[e.kind]
      if (def.mines) e.active = !!e.mineItem && this.outTotal(e) < OUT_CAP
      else if (def.recipe) e.active = e.crafting ? e.progress < 1 : this.hasInputs(e) && this.outTotal(e) < OUT_CAP
      else if (e.kind === 'lab') e.active = !!this.current
      else e.active = def.power > 0
      if (!e.onGrid) continue
      if (def.gen) {
        const kw = this.genKW(e)
        gen += kw
        if (e.kind === 'solar') solarGen += kw
      } else if (e.kind === 'battery') {
        const kj = this.batteryKJ(e)
        e.charge = clamp(e.charge, 0, kj)
        cap += kj
        stored += e.charge
      }
      if (e.active && def.power > 0) {
        const kw = this.draw(e)
        if (LIFE.has(e.kind)) lifeDemand += kw
        else indDemand += kw
        byKind[e.kind] = (byKind[e.kind] ?? 0) + kw
      }
    }

    const P = this.power
    const reserveCap = cap + RESERVE_KJ
    const demand = lifeDemand + indDemand
    P.cap = cap
    P.gen = gen
    P.solar = SOLAR_KW[0] * this.solarFactor()
    P.demand = demand
    P.byKind = byKind
    P.solarGen = solarGen
    P.reactorGen = gen - solarGen
    let supply = gen * dt
    if (gen < demand) {
      const draw = Math.min((demand - gen) * dt, stored)
      stored -= draw
      supply += draw
      P.discharge = draw / dt
    } else {
      stored = Math.min(reserveCap, stored + (gen - demand) * dt)
      P.discharge = 0
    }
    // share the pool back out: every connected store ends at the same fill level, so energy is
    // conserved and a bank that gets cut off keeps what it holds
    const fill = stored / reserveCap
    this.reserve = fill * RESERVE_KJ
    for (const b of this.list('battery')) if (b.onGrid) b.charge = fill * this.batteryKJ(b)
    P.stored = stored

    const lifeNeed = lifeDemand * dt
    P.lifeSat = lifeNeed > 0 ? Math.min(1, supply / lifeNeed) : 1
    const left = Math.max(0, supply - lifeNeed)
    P.indSat = indDemand > 0 ? Math.min(1, left / (indDemand * dt)) : 1
    P.sat = demand > 0 ? Math.min(1, supply / (demand * dt)) : 1
    // a sample every 2 s for the power graph (about three sols of history)
    if (this.time - P.lastSample >= 2) {
      P.lastSample = this.time
      P.history.push({ gen, demand, stored, cap: reserveCap })
      if (P.history.length > 180) P.history.shift()
    }
  }

  /** Miners, crafters, MOXIE, labs: work, then push output and set status. */
  private stepMachines(dt: number) {
    let o2 = 0
    for (const e of this.ents.values()) {
      if (e.kind === 'belt' || e.kind === 'junction') continue
      const def = BUILDINGS[e.kind]
      e.working = false
      const sat = def.power > 0 ? this.satFor(e) : 1
      const spd = this.speed(e)
      if (def.mines) {
        if (e.mineItem && e.active) {
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
          // finished goods only go out when they fit under the output cap
          if (e.progress >= 1 && this.outTotal(e) + Sim.outCount(e.kind) <= OUT_CAP) {
            for (const k in r.out) e.outBuf[k as ItemId] = (e.outBuf[k as ItemId] ?? 0) + r.out[k as ItemId]!
            e.crafting = false
            e.progress = 0
          }
        }
      } else if (e.kind === 'moxie') {
        o2 += 0.1 * dt * sat * spd
        e.working = sat > 0
      } else if (e.kind === 'lab' && this.current) {
        const add = 0.4 * dt * sat * spd
        this.rp += add
        this.rpFromLabs += add
        e.working = sat > 0
      } else if (e.kind === 'core' && this.current) {
        this.rp += 0.12 * dt * sat
      }

      // output: round-robin over whatever is in the output buffer; if the next tile won't take one
      // kind of item, the others still get out
      if (def.outputs) this.emit(e)

      // status (habitats are set in lifeSupport, once residents are known)
      if (e.kind === 'habitat') continue
      if (def.mines && !e.mineItem) e.status = 'badground'
      else if (needsGrid(e.kind) && !e.onGrid) e.status = 'nogrid'
      else if (def.power > 0 && e.active && sat < 0.5) e.status = 'nopower'
      else if (def.mines) e.status = this.outTotal(e) >= OUT_CAP ? 'blocked' : 'ok'
      else if (def.recipe)
        e.status = this.outTotal(e) >= OUT_CAP || (e.crafting && e.progress >= 1) ? 'blocked' : !e.crafting && !this.hasInputs(e) ? 'noinput' : 'ok'
      else if (e.kind === 'lab') e.status = this.current ? 'ok' : 'idle'
      else e.status = 'ok'
    }
    this.stock.o2 += o2
  }

  /**
   * Move everything on belts and through junctions, furthest downstream first (see `flowOrder`).
   * Items keep at least GAP apart; the head item hands over to the next tile, carrying any
   * overshoot. Where a side feed merges into the middle of a fed belt, the main line holds back
   * at the merge point while the side waits its turn, so the two zip together evenly.
   */
  private stepBelts(dt: number) {
    const v = BELT_SPEED * (this.done.has('maglev') ? 1.75 : 1) * dt
    // Move one lane of items; true if anything moved. `hold` stops items that haven't reached it
    // yet (the merge hold). `crossed` is set when an item passes the middle of the tile.
    let crossed = false
    const move = (its: BeltItem[], hold: number, end: number) => {
      let moved = false
      for (let k = 0; k < its.length; k++) {
        const it = its[k]
        let limit = k === 0 ? end : its[k - 1].pos - GAP
        if (it.pos <= hold) limit = Math.min(limit, hold)
        let to = Math.max(it.pos, Math.min(it.pos + v, limit))
        // snap away float dust, so an item that has really reached the end hands over this step
        if (to > 1 - 1e-9) to = 1
        it.v = (to - it.pos) / dt
        if (to > it.pos + 1e-9) moved = true
        if (it.pos < 0.5 && to >= 0.5) crossed = true
        it.pos = to
      }
      return moved
    }
    /** How far past the tile edge an item that started this step at `from` would have got. */
    const carry = (from: number) => Math.min(v, Math.max(0, v - (1 - from)))
    /**
     * How far the front item may go: to the tile edge, unless the next tile's entry is still
     * occupied, in which case it queues GAP behind that item, so spacing holds across the edge.
     */
    const end = (i: number, j: number, dir: Dir, head: number) => {
      const n = this.entAt(i + DI[dir], j + DJ[dir])
      let tail = Infinity
      if (n?.kind === 'belt') {
        if (n.dir === (dir + 2) % 4) return 1
        // only an entry at the start of the next belt sits right at this edge; a mid-belt merge doesn't
        if (n.dir !== dir && n.inMask & IN_BACK) return 1
        for (const it of n.items) tail = Math.min(tail, it.pos)
        const lim = Math.min(1, 1 + tail - GAP)
        // queued for a side entry (a corner or Y): count as waiting, so merges stay fair
        if (n.dir !== dir && head + v >= lim) n.wantAt[(dir + 2) % 4] = this.tick
        return lim
      } else if (n?.kind === 'junction') {
        const lane = n.lanes[dir]
        if (lane.length) tail = lane[lane.length - 1].pos
      } else return 1
      return Math.min(1, 1 + tail - GAP)
    }
    for (const e of this.flow) {
      if (e.kind === 'belt') {
        const its = e.items
        if (!its.length) {
          e.stall = 0
          e.status = 'ok'
          continue
        }
        const back = ((e.dir + 2) % 4) as Dir
        const merges = e.inMask & IN_BACK && e.inMask & (IN_P | IN_N)
        // a side feed waiting to merge mid-belt, and it's its turn: keep the merge window clear
        const hold = merges && this.mustYield(e, back) ? 0.5 - GAP : Infinity
        const headFrom = its[0].pos
        crossed = false
        let moved = move(its, hold, end(e.i, e.j, e.dir, its[0].pos))
        // the back's turn is used up when one of its items crosses the merge point
        if (merges && crossed) e.lastOk[back] = this.tick
        if (its[0].pos >= 1 && this.push(e.i + DI[e.dir], e.j + DJ[e.dir], its[0].item, e.dir, carry(headFrom))) {
          its.shift()
          moved = true
        }
        e.stall = moved ? 0 : e.stall + dt
        e.status = e.stall > JAM_AFTER ? 'blocked' : 'ok'
      } else {
        let any = false
        let moved = false
        for (let d = 0; d < 4; d++) {
          const its = e.lanes[d]
          if (!its.length) continue
          any = true
          const headFrom = its[0].pos
          if (move(its, Infinity, end(e.i, e.j, d as Dir, its[0].pos))) moved = true
          if (its[0].pos >= 1 && this.push(e.i + DI[d], e.j + DJ[d], its[0].item, d as Dir, carry(headFrom))) {
            its.shift()
            moved = true
          }
        }
        e.stall = !any || moved ? 0 : e.stall + dt
        e.status = e.stall > JAM_AFTER ? 'blocked' : 'ok'
      }
    }
  }

  /**
   * Swap the belt at (i, j) for a junction in one step, carrying its items onto the junction's
   * lane in the belt's direction (any that don't fit go to the core's stores). Nothing changes
   * if it can't be done. Returns why not, or null.
   */
  replaceWithJunction(i: number, j: number): string | null {
    const belt = this.entAt(i, j)
    if (!belt || belt.kind !== 'belt') return 'There’s no belt here.'
    if (!this.unlocked('junction')) return `${BUILDINGS.junction.name}s aren’t available yet.`
    const jc = BUILDINGS.junction.cost
    const bc = BUILDINGS.belt.cost
    if (this.stock.metal + (bc.metal ?? 0) < (jc.metal ?? 0) || this.stock.brick + (bc.brick ?? 0) < (jc.brick ?? 0)) return `Not enough materials for a ${BUILDINGS.junction.name.toLowerCase()}.`
    const items = belt.items
    belt.items = [] // carried over below, not refunded
    this.remove(i, j)
    const err = this.place('junction', i, j, 0)
    const jn = err ? null : this.entAt(i, j)
    if (!jn) {
      // put the belt back exactly as it was
      this.place('belt', i, j, belt.dir)
      const back = this.entAt(i, j)
      if (back) back.items = items
      return err ?? 'Couldn’t build a junction here.'
    }
    // belt items are front first, as lanes are; keep each one that fits at proper spacing
    const lane = jn.lanes[belt.dir]
    for (const it of items) {
      if (lane.length < LANE_CAP && (lane.length === 0 || lane[lane.length - 1].pos - it.pos >= GAP - 1e-9)) lane.push({ item: it.item, pos: it.pos })
      else this.stock[it.item]++
    }
    return null
  }

  private stepResearch() {
    if (!this.current) return
    const r = RESEARCH.find((x) => x.id === this.current)!
    if (this.rp < r.cost) return
    this.rp -= r.cost
    this.done.add(r.id)
    if (this.rpFromLabs > 0) this.labProjects++
    this.rpFromLabs = 0
    this.current = this.nextResearch()
    this.log(`Research complete: ${r.name}. ${r.effect}`, 'good')
    this.popups.push({ kind: 'research', title: r.name, body: r.fact, field: r.field })
  }

  private nextResearch(): ResearchId | null {
    return RESEARCH.find((x) => !this.done.has(x.id) && (!x.needs || this.done.has(x.needs)))?.id ?? null
  }

  /** One-time hints for the common ways new players get stuck. */
  private nudges() {
    const tip = (id: string, when: () => boolean, text: string) => {
      if (this.tips.has(id) || !when()) return
      this.tips.add(id)
      this.log(text, 'warn')
    }
    tip('metal', () => this.stock.metal < 6 && this.delivered.metal === 0, 'Tip: low on metal? Right-click a building for a full refund, or mine ore → smelter → core.')
    tip(
      'night',
      () => this.power.demand > 0 && this.sun() === 0 && this.power.sat < 0.5 && this.count('battery') === 0,
      'Tip: it’s dark and the power is out. Battery banks store daytime solar for the night.',
    )
    tip('housing', () => this.time > SOL && this.colonists >= this.housing(), 'Tip: no free beds. Build a habitat (key 8) next to a regolith shield so the next ship can bring crew.')
    for (const r of ['food', 'water', 'o2'] as const) {
      tip(
        `low-${r}`,
        () => {
          const rate = this.rates[r] ?? 0
          return rate < 0 && this.stock[r] / -rate < 0.75 && this.stock[r] > 0
        },
        `Warning: ${r === 'o2' ? 'oxygen' : r} runs out in under a sol at this rate!`,
      )
    }
  }

  /** Solar stations slowly plant new panels on open, connected ground around them. */
  private stations(dt: number) {
    // list() is a snapshot: panels planted here go into a fresh list
    for (const e of this.list('solar')) {
      if (e.level < MAX_LEVEL || e.planted >= STATION_MAX_PLANTS) continue
      e.plantIn -= dt
      if (e.plantIn > 0) continue
      e.plantIn = STATION_PLANT_EVERY
      if (this.stock.metal < (BUILDINGS.solar.cost.metal ?? 0)) continue
      // free spots for a whole panel, nearest ring first: touching the station, then 1 or 2 tiles out
      const { w, h } = BUILDINGS.solar
      const spots: [number, number][] = []
      for (let r = 1; r <= 3 && !spots.length; r++)
        for (let j = e.j - h - r + 1; j <= e.j + h + r - 1; j++)
          for (let i = e.i - w - r + 1; i <= e.i + w + r - 1; i++)
            if (Sim.gap(e, { kind: 'solar', i, j }) === r && !this.placeError('solar', i, j) && this.anyCovered('solar', i, j)) spots.push([i, j])
      if (!spots.length) continue
      const [i, j] = spots[Math.floor(this.rng() * spots.length)]
      this.place('solar', i, j, 0)
      e.planted++
      if (e.planted === 1) this.log('A solar station has started planting its own panels around it.', 'good')
    }
  }

  /**
   * Crew needs. Residents fill the core, then shielded habitats, then unshielded ones;
   * habitats off the grid have no usable beds. Crew left without a bed bunk in the
   * core: a gentle 'housing' shortage until there is room.
   */
  private lifeSupport(dt: number) {
    let left = this.colonists
    const core = this.coreEnt
    core.residents = Math.min(left, this.beds(core))
    left -= core.residents
    let unshieldedResidents = 0
    const habitats = this.list('habitat')
    for (const e of habitats) e.residents = 0
    for (let pass = 0; pass < 2; pass++)
      for (const e of habitats) {
        if (e.shielded !== (pass === 0) || !e.onGrid) continue
        e.residents = Math.min(left, this.beds(e))
        left -= e.residents
        if (e.residents && !e.shielded) unshieldedResidents += e.residents
      }
    const homeless = left

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
    const lifeSat = this.power.lifeSat
    if (lifeSat < 0.5) this.shortages.add('power')
    const flare = this.ev.flare && this.time >= this.ev.flare.start
    if (unshieldedResidents > 0) this.shortages.add('radiation')
    if (homeless > 0) this.shortages.add('housing')

    for (const e of habitats)
      e.status = !e.onGrid ? 'nogrid' : lifeSat < 0.5 ? 'nopower' : e.residents > 0 && !e.shielded ? 'unshielded' : e.shielded ? 'ok' : 'idle'

    let weight = 0
    for (const s of this.shortages) weight += s === 'radiation' ? (flare ? 2 : 0.4) : s === 'power' ? 0.5 : s === 'housing' ? HOMELESS_WEIGHT : 1
    if (weight > 0) this.health = Math.max(0, this.health - dt * 0.35 * weight)
    else this.health = Math.min(100, this.health + dt * 0.25)

    if (this.health <= 0 && !this.over) {
      this.over = 'lost'
      this.popups.push(this.losePopup())
    }
  }

  private losePopup(): Popup {
    return {
      kind: 'lose',
      title: 'Mission failed',
      body: `On sol ${this.solNumber()} the crew had to evacuate. Every system depends on another — look at which resource ran out first, and build a buffer before it does.`,
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
    const ents: SaveEnt[] = []
    for (const e of this.ents.values()) {
      if (e.kind === 'core') continue
      const s: SaveEnt = { k: e.kind, i: e.i, j: e.j, d: e.dir }
      if (e.level > 1) s.l = e.level
      if (Object.values(e.inBuf).some((n) => n)) s.in = { ...e.inBuf }
      if (Object.values(e.outBuf).some((n) => n)) s.out = { ...e.outBuf }
      if (e.progress) s.p = e.progress
      if (e.crafting) s.c = true
      if (e.items.length) s.it = e.items.map((it) => (it.from === undefined ? [it.item, it.pos] : [it.item, it.pos, it.from]))
      if (e.lanes.some((l) => l.length)) s.ln = e.lanes.map((l) => l.map((it) => [it.item, it.pos] as [ItemId, number]))
      if (e.planted) s.pl = e.planted
      if (e.kind === 'solar' && e.level >= MAX_LEVEL) s.pi = e.plantIn
      if (e.charge) s.ch = e.charge
      ents.push(s)
    }
    return {
      v: SAVE_VERSION,
      seed: this.seed,
      time: this.time,
      stock: { ...this.stock },
      colonists: this.colonists,
      health: this.health,
      reserve: this.reserve,
      rp: this.rp,
      done: [...this.done],
      current: this.current,
      mission: MISSIONS[this.mission]?.id ?? null,
      labProjects: this.labProjects,
      delivered: { ...this.delivered },
      owed: { ...this.owed },
      ents,
      ev: { ...this.ev, storm: this.ev.storm && { ...this.ev.storm }, flare: this.ev.flare && { ...this.ev.flare } },
      won: this.won,
      over: this.over,
      tips: [...this.tips],
      rng: this.rngState,
      wear: [...this.wear].flatMap((w, k) => (w ? [[k, w] as [number, number]] : [])),
    }
  }

  /**
   * Rebuild a sim from a current (v3) save. Every field is validated and defaulted, so a
   * damaged save loads as far as it can. Saves from older layouts (v1, v2) throw
   * `OutdatedSaveError`; input that is hopeless (not an object, unknown version, no seed)
   * throws a plain Error.
   */
  static load(raw: unknown): Sim {
    if (!raw || typeof raw !== 'object') throw new Error('save is not an object')
    const d = raw as Record<string, unknown>
    if (typeof d.v === 'number' && Number.isInteger(d.v) && d.v >= 1 && d.v < SAVE_VERSION) throw new OutdatedSaveError(d.v)
    if (d.v !== SAVE_VERSION) throw new Error(`unknown save version ${String(d.v)}`)
    if (typeof d.seed !== 'number' || !Number.isFinite(d.seed)) throw new Error('save has no seed')
    const s = new Sim(d.seed)
    const num = (x: unknown, def: number, lo = -Infinity, hi = Infinity) => (typeof x === 'number' && Number.isFinite(x) ? clamp(x, lo, hi) : def)
    const int = (x: unknown, def: number, lo = -Infinity, hi = Infinity) => Math.round(num(x, def, lo, hi))
    const obj = (x: unknown) => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : {})
    const arr = (x: unknown) => (Array.isArray(x) ? (x as unknown[]) : [])
    const isItem = (x: unknown): x is ItemId => typeof x === 'string' && x in ITEMS
    const isDir = (x: unknown): x is Dir => x === 0 || x === 1 || x === 2 || x === 3
    const items = (x: unknown) => {
      const out: Partial<Record<ItemId, number>> = {}
      for (const [k, n] of Object.entries(obj(x))) if (isItem(k)) out[k] = int(n, 0, 0)
      return out
    }

    s.time = num(d.time, 0, 0)
    const stock = obj(d.stock)
    for (const k of Object.keys(s.stock) as StockId[]) s.stock[k] = num(stock[k], s.stock[k], 0)
    const delivered = obj(d.delivered)
    for (const k of ITEM_IDS) s.delivered[k] = int(delivered[k], 0, 0)
    s.colonists = int(d.colonists, 4, 0, 100000)
    s.health = num(d.health, 100, 0, 100)
    s.rp = num(d.rp, 0, 0)
    s.done = new Set(arr(d.done).filter((x): x is ResearchId => RESEARCH.some((r) => r.id === x)))
    const cur = RESEARCH.find((r) => r.id === d.current)
    s.current = cur && !s.done.has(cur.id) && (!cur.needs || s.done.has(cur.needs)) ? cur.id : s.nextResearch()
    s.labProjects = int(d.labProjects, 0, 0)
    s.won = d.won === true
    s.over = d.over === 'won' || d.over === 'lost' ? d.over : null
    const owed = obj(d.owed)
    for (const r of ['food', 'water', 'o2'] as const) s.owed[r] = num(owed[r], 0, 0, 1)
    for (const t of arr(d.tips)) if (typeof t === 'string') s.tips.add(t)
    if (typeof d.rng === 'number' && Number.isFinite(d.rng)) s.rngState = d.rng | 0

    // events
    const ev = obj(d.ev)
    const span = (x: unknown) => {
      const o = obj(x)
      return typeof o.start === 'number' && typeof o.end === 'number' && Number.isFinite(o.start) && Number.isFinite(o.end) ? { start: o.start, end: o.end } : null
    }
    s.ev = {
      storm: span(ev.storm),
      flare: span(ev.flare),
      nextStorm: num(ev.nextStorm, s.ev.nextStorm),
      nextFlare: num(ev.nextFlare, s.ev.nextFlare),
      nextShip: num(ev.nextShip, s.ev.nextShip),
      ship: num(ev.ship, -1),
    }

    for (const p of arr(d.wear)) {
      const [k, w] = arr(p)
      if (typeof k === 'number' && Number.isInteger(k) && k >= 0 && k < s.wear.length) s.wear[k] = int(w, 0, 0, 255)
    }

    // missions are stored by id (null once all are done; an unknown id starts the list again)
    const at = d.mission === null ? MISSIONS.length : MISSIONS.findIndex((m) => m.id === d.mission)
    s.mission = at < 0 ? 0 : at

    // buildings: anything that doesn't fit (or sits on ground it can't use) is refunded
    const list = arr(d.ents)
    for (const raw of list) {
      const se = obj(raw)
      const k = se.k as Kind
      if (typeof k !== 'string' || !(k in BUILDINGS) || k === 'core') continue
      if (!Number.isInteger(se.i) || !Number.isInteger(se.j)) continue
      const i = se.i as number
      const j = se.j as number
      const level = UPGRADES[k] ? int(se.l, 1, 1, MAX_LEVEL) : 1
      if (s.siteError(k, i, j)) {
        const back = Sim.spent(k, level)
        s.stock.metal += back.metal
        s.stock.brick += back.brick
        continue
      }
      const e = s.add(k, i, j, isDir(se.d) ? se.d : 0)
      e.level = level
      const def = BUILDINGS[k]
      if (def.recipe) {
        e.inBuf = items(se.in)
        e.crafting = se.c === true
        e.progress = e.crafting ? num(se.p, 0, 0, 1) : 0
      }
      if (def.mines) e.progress = num(se.p, 0, 0, 0.999)
      if (def.outputs && k !== 'belt') e.outBuf = items(se.out)
      if (k === 'belt')
        e.items = arr(se.it)
          .map((x) => arr(x))
          .filter(([item]) => isItem(item))
          .map(([item, pos, from]) => {
            const it: BeltItem = { item: item as ItemId, pos: num(pos, 0, 0, 1) }
            if (isDir(from)) it.from = from
            return it
          })
          .sort((a, b) => b.pos - a.pos)
      if (k === 'junction') {
        const ln = arr(se.ln)
        e.lanes = [0, 1, 2, 3].map((n) =>
          arr(ln[n])
            .map((x) => arr(x))
            .filter(([item]) => isItem(item))
            .map(([item, pos]) => ({ item: item as ItemId, pos: num(pos, 0, 0, 1) }))
            .sort((a, b) => b.pos - a.pos)
            .slice(0, 3),
        )
      }
      if (k === 'solar') {
        e.planted = int(se.pl, 0, 0, STATION_MAX_PLANTS)
        e.plantIn = num(se.pi, STATION_PLANT_EVERY, 0, STATION_PLANT_EVERY)
      }
      if (k === 'battery') e.charge = num(se.ch, 0, 0, s.batteryKJ(e))
    }
    s.rev++
    s.updateShielding()

    s.reserve = num(d.reserve, RESERVE_KJ, 0, RESERVE_KJ)
    s.ensureGrid()
    s.power.stored = s.reserve + s.list('battery').reduce((n, b) => n + (b.onGrid ? b.charge : 0), 0)

    if (s.over === 'lost') s.popups.push(s.losePopup())
    return s
  }
}
