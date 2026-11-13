/** Shared simulation types: entities, messages and the save format. */
import type { Dir, ItemId, Kind, ResearchId, StockId } from '@/game/core/data'
import type { FlareRecord } from '@/game/core/nasa'

export type Status = 'ok' | 'nopower' | 'nogrid' | 'noinput' | 'blocked' | 'unshielded' | 'badground' | 'idle'

/**
 * An item on a belt. `from` is the side it entered from, when it came in round a corner or merge curve.
 * `v` is how far it moved per second in the last step (not saved): the scene uses it to draw
 * items smoothly between the sim's fixed steps.
 */
export type BeltItem = { item: ItemId; pos: number; from?: Dir; v?: number }

/**
 * Somewhere a machine can hand its products: a belt beside it pointing away, a junction beside
 * it, or a touching building that uses them. (i, j) is that tile; `dir` points away from the machine.
 */
export type Outlet = { i: number; j: number; dir: Dir; kind: 'belt' | 'junction' | 'building' }

/** What a supply ship brings: new crew (and a little metal), building materials, or food and water. */
export type Cargo = 'crew' | 'materials' | 'supplies'

/**
 * The supply-ship order: what you asked for (`want`, sent at `sentAt`), what Mission Control
 * has received so far (`atEarth`; your message takes the signal delay to get there), and what
 * the next ship was packed with (null until it's packed).
 */
export type CargoOrder = { want: Cargo; sentAt: number; atEarth: Cargo; packed: Cargo | null }

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
  /** Machines (not saved): which output belt or neighbour gets the next item, so several share it in turn. */
  outSide: number
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
  /** Batteries: kJ held. Kept per bank, so a bank cut off from the grid keeps its charge. */
  charge: number
  /** Belts only: nothing feeds the back, so the start is closed off. */
  capStart: boolean
  /** Belts only: the output leads nowhere that will take items. */
  capEnd: boolean
  /**
   * Belts and junctions (not saved): fair merging. `wantAt[side]` is the last tick a push from
   * that side was turned away; `lastOk[side]` the last tick one got in (for a belt fed from
   * behind with side merges, the back's turn is counted when an item crosses the merge point).
   * Whoever has waited longest goes next, so no input can starve another.
   */
  wantAt: number[]
  lastOk: number[]
  /** Belts and junctions (not saved): seconds with items on it but nothing moving. Over a second, it's jammed. */
  stall: number
}

export type Tone = 'info' | 'good' | 'warn' | 'bad'
export type Msg = { id: number; text: string; tone: Tone; t: number }
export type Popup = { kind: 'research' | 'win' | 'lose' | 'intro' | 'science'; title: string; body: string; field?: string; link?: string }
/**
 * What the crew is short of. `housing`: more colonists than powered beds — the
 * extra crew bunk in the core, a gentle health drain until habitats are built.
 */
export type Shortage = 'food' | 'water' | 'o2' | 'power' | 'radiation' | 'housing'

/* --------------------------------- saves --------------------------------- */

/**
 * Current save format. v3 came with the bigger buildings and the 96-tile map; older
 * layouts can't be carried over, so `Sim.load` refuses them with `OutdatedSaveError`.
 */
export const SAVE_VERSION = 3

/** Thrown by `Sim.load` for a save from before the current layout (v1, v2): start a fresh colony. */
export class OutdatedSaveError extends Error {
  readonly version: number
  constructor(version: number) {
    super(`save version ${version} is from an older colony layout (current: ${SAVE_VERSION})`)
    this.name = 'OutdatedSaveError'
    this.version = version
  }
}

/** One saved building. Short keys keep the save small; everything but kind, position and dir is optional. */
export type SaveEnt = {
  k: Kind
  i: number
  j: number
  d: Dir
  /** level */
  l?: number
  /** input / output buffers */
  in?: Partial<Record<ItemId, number>>
  out?: Partial<Record<ItemId, number>>
  /** progress, crafting */
  p?: number
  c?: boolean
  /** belt items as [item, pos, from?] */
  it?: [ItemId, number, Dir?][]
  /** junction lanes, one per travel direction */
  ln?: [ItemId, number][][]
  /** solar station: planted, seconds to next plant */
  pl?: number
  pi?: number
  /** battery charge (kJ) */
  ch?: number
}

export type SaveData = {
  v: typeof SAVE_VERSION
  seed: number
  time: number
  stock: Record<StockId, number>
  colonists: number
  health: number
  /** kJ in the core's own reserve (battery banks hold theirs in `ents`). */
  reserve: number
  rp: number
  done: ResearchId[]
  current: ResearchId | null
  /** Id of the current mission, or null once every mission is done. */
  mission: string | null
  /** Research projects finished with a lab helping, for the "Do science" mission. */
  labProjects: number
  delivered: Record<ItemId, number>
  owed: Record<'food' | 'water' | 'o2', number>
  ents: SaveEnt[]
  ev: {
    storm: null | { start: number; end: number }
    /** A solar flare: `rec` is the real DONKI flare it replays (and `live` if it came from the live feed). */
    flare: null | { start: number; end: number; rec?: FlareRecord; live?: boolean }
    nextStorm: number
    nextFlare: number
    nextShip: number
    ship: number
  }
  won: boolean
  over: 'won' | 'lost' | null
  /** One-time tips already shown. */
  tips: string[]
  /** Event generator state, so storms and flares continue the same sequence. */
  rng: number
  /** The supply-ship order (older saves: crew). */
  cargo?: CargoOrder
  /** Ground wear from rovers and crew, as sparse [tile index, wear] pairs. */
  wear: [number, number][]
}
