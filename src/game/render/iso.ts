/**
 * Isometric geometry and draw order shared by everything the scene renders.
 *
 * World pixels: tile (i, j)'s top corner sits at (TER_OX + (i − j)·16, TER_OY + (i + j)·8),
 * so each tile is a 32 × 16 diamond and its centre is 8 px below its top corner.
 */
import { CORE_AX, CORE_AY, CORE_H, CORE_W, isBig, SPR_AX, SPR_AY, SPR_H, SPR_W, TER_OX, TER_OY } from '@/game/art/sprites'
import { BUILDINGS, DI, DJ, MAP, type Dir, type Kind } from '@/game/core/data'

export type Tile = [number, number]

/** World position of tile (i, j)'s top corner. Fractional (i, j) give any point on the ground. */
export const top = (i: number, j: number) => [TER_OX + (i - j) * 16, TER_OY + (i + j) * 8] as const

/** World x / y of the centre of tile (i, j); fractional for units between tiles. Allocation-free. */
export const centreX = (i: number, j: number) => TER_OX + (i - j) * 16
export const centreY = (i: number, j: number) => TER_OY + (i + j) * 8 + 8

/** World position of the centre of tile (i, j). */
export const tileCentre = (i: number, j: number) => [centreX(i, j), centreY(i, j)] as const

/** Ground point at the centre of a building's footprint, where its sprite is anchored. */
export const centreOf = (kind: Kind, i: number, j: number) => top(i + BUILDINGS[kind].w / 2, j + BUILDINGS[kind].h / 2)

/** Screen offset (world px) of one tile step in each direction. */
export const DIR_VEC: readonly (readonly [number, number])[] = [0, 1, 2, 3].map((d) => [(DI[d] - DJ[d]) * 16, (DI[d] + DJ[d]) * 8] as const)

/** Direction of a single grid step from (pi, pj) to the neighbouring (ci, cj). */
export const stepDir = (pi: number, pj: number, ci: number, cj: number): Dir => (ci > pi ? 0 : cj > pj ? 1 : ci < pi ? 2 : 3)

/** The tile under a world point, or null off the map. */
export function tileAtWorld(x: number, y: number): Tile | null {
  const a = (x - TER_OX) / 16
  const b = (y - TER_OY - 8) / 8
  const i = Math.round((a + b) / 2)
  const j = Math.round((b - a) / 2)
  return i < 0 || j < 0 || i >= MAP || j >= MAP ? null : [i, j]
}

/** Sprite origin for a building texture: the footprint centre on the small or the big canvas. */
export const originOf = (kind: Kind) => (isBig(kind) ? [CORE_AX / CORE_W, CORE_AY / CORE_H] : [SPR_AX / SPR_W, SPR_AY / SPR_H]) as [number, number]

/** Junction textures are 34 × 22 with the tile centre at (17, 13). */
export const JUNCTION_ORIGIN = [17 / 34, 13 / 22] as const

/** The cursor sits over the middle of a multi-tile footprint: its top-corner tile. */
export const anchorFor = (kind: Kind, hi: number, hj: number) => [hi - ((BUILDINGS[kind].w - 1) >> 1), hj - ((BUILDINGS[kind].h - 1) >> 1)] as const

/* ------------------------------ draw order ------------------------------ */

/** Depth units per tile row (i + j). Things standing on the ground sort by row, then by slot. */
export const ROW = 10

/** Where things sort inside one row. */
export const SLOT = {
  item: 3,
  unit: 4,
  /** 1×1 buildings. */
  small: 5,
  /** Multi-tile buildings (placed by their first row in front, see depthFor). */
  big: 6,
  ship: 7,
} as const

/** Fixed layers below and above the sorted world. */
export const DEPTH = {
  terrain: -10,
  roads: -5,
  belt: -1,
  junction: -0.95,
  /** Build preview of a belt or junction, just above the ground pieces. */
  groundGhost: -0.9,
  shadows: -0.8,
  unitShadow: -0.7,
  range: -0.6,
  coverage: -0.58,
  coverageLines: -0.575,
  footprint: -0.55,
  hover: -0.5,
  cables: 1.5e6,
  /** Status icons and the output arrow: above cables, below flying drones. */
  overlay: 1.6e6,
  air: 2e6,
} as const

/**
 * Draw order of a building. 1×1: by its tile's row (i + j). Multi-tile: between
 * the last row behind it and the first row in front of it, so neighbours on every
 * side sort correctly for 2×2 and 3×2 footprints.
 */
export const depthFor = (kind: Kind, i: number, j: number) => {
  const { w, h } = BUILDINGS[kind]
  return w === 1 && h === 1 ? (i + j) * ROW + SLOT.small : (i + j + Math.max(w, h) - 2) * ROW + SLOT.big
}

/** A rover or walker at fractional tile (fi, fj). */
export const unitDepth = (fi: number, fj: number) => (fi + fj) * ROW + SLOT.unit

/** An item on the belt tile in row `row`, `o` tiles (−0.5 … 0.5) along the row axis. */
export const itemDepth = (row: number, o: number) => (row + o) * ROW + SLOT.item
