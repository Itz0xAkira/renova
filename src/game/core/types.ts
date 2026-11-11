/** Shared simulation types: entities, messages and the save format. */
import type { Dir, ItemId, Kind, ResearchId, StockId } from '@/game/core/data'

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
}

export type Tone = 'info' | 'good' | 'warn' | 'bad'
export type Msg = { id: number; text: string; tone: Tone; t: number }
export type Popup = { kind: 'research' | 'win' | 'lose' | 'intro'; title: string; body: string; field?: string }
/**
 * What the crew is short of. `housing`: more colonists than powered beds — the
 * extra crew bunk in the core, a gentle health drain until habitats are built.
 */
export type Shortage = 'food' | 'water' | 'o2' | 'power' | 'radiation' | 'housing'

/* --------------------------------- saves --------------------------------- */

/** Current save format. Older versions are migrated by `Sim.load`. */
export const SAVE_VERSION = 2

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
    flare: null | { start: number; end: number }
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
  /** Ground wear from rovers and crew, as sparse [tile index, wear] pairs. */
  wear: [number, number][]
}

/** The first save format: buildings as tuples, the mission as a list index, one shared power pool. */
export type SaveDataV1 = {
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
  ev: SaveData['ev']
  won: boolean
  wear?: [number, number][]
}
