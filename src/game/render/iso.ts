/**
 * Isometric geometry and draw order shared by everything the scene renders.
 *
 * World pixels: tile (i, j)'s top corner sits at (TER_OX + (i − j)·16, TER_OY + (i + j)·8),
 * so each tile is a 32 × 16 diamond and its centre is 8 px below its top corner.
 */
import { spriteSpec, TER_OX, TER_OY } from '@/game/art/sprites'
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

/** Continuous ground coordinates (u, v) of a world point: tile (i, j) covers [i, i+1) × [j, j+1). */
export const groundUV = (x: number, y: number) => [((x - TER_OX) / 16 + (y - TER_OY) / 8) / 2, ((y - TER_OY) / 8 - (x - TER_OX) / 16) / 2] as const

/** The tile under a world point, or null off the map. */
export function tileAtWorld(x: number, y: number): Tile | null {
  const a = (x - TER_OX) / 16
  const b = (y - TER_OY - 8) / 8
  const i = Math.round((a + b) / 2)
  const j = Math.round((b - a) / 2)
  return i < 0 || j < 0 || i >= MAP || j >= MAP ? null : [i, j]
}

/** Sprite origin for a building texture: the footprint centre on the small or the big canvas. */
export const originOf = (kind: Kind) => {
  const s = spriteSpec(kind)
  return [s.ax / s.W, s.ay / s.H] as [number, number]
}

/** Junction textures are 34 × 22 with the tile centre at (17, 13). */
export const JUNCTION_ORIGIN = [17 / 34, 13 / 22] as const

/** The footprint's first (back-corner) tile when the cursor is over tile (hi, hj): the hovered tile is a middle one. */
export const anchorFor = (kind: Kind, hi: number, hj: number) => [hi - ((BUILDINGS[kind].w - 1) >> 1), hj - ((BUILDINGS[kind].h - 1) >> 1)] as const

/**
 * The footprint's first tile with its centre nearest the ground point (u, v), so
 * the building sits centred under the cursor; for even sizes this picks the
 * tile corner nearest the cursor. Same as anchorFor for odd sizes.
 */
export const anchorAt = (kind: Kind, u: number, v: number) => [Math.round(u - BUILDINGS[kind].w / 2), Math.round(v - BUILDINGS[kind].h / 2)] as const

/* ------------------------------ draw order ------------------------------ */

/** Depth units per tile row (i + j). Things standing on the ground sort by row, then by slot. */
export const ROW = 10

/** Where things sort inside one row. */
export const SLOT = {
  item: 3,
  unit: 4,
  /** Buildings, by the row of their footprint centre (see depthFor). */
  building: 5,
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
 * Draw order of a building: the row of its footprint centre, i + j + (w + h)/2 − 1
 * (so a 1×1 sorts by its own row, as units and items do). Two footprints of the
 * same long shape (4×3 beside 4×3) can share a centre row while one is in front;
 * a tiny tie-break along the short axis settles it. Checked exhaustively against
 * the separating-axis order for every pair of 1×1, 2×1, 2×2, 3×3, 4×3, 3×4 and
 * 4×4 footprints that overlap on screen.
 */
export const depthFor = (kind: Kind, i: number, j: number) => {
  const { w, h } = BUILDINGS[kind]
  const tie = w > h ? j + h / 2 : w < h ? i + w / 2 : 0
  return (i + j + (w + h) / 2 - 1) * ROW + SLOT.building + 0.001 * tie
}

/** A ground-plane box in continuous tile coordinates: [i0, i1] × [j0, j1]. */
export type Box = { i0: number; i1: number; j0: number; j1: number }

/** Do two boxes overlap on screen horizontally (by more than `px` world px)? Sprites never reach past their footprint's diamond sideways. */
export const screenOverlap = (a: Box, b: Box, px = 0) => Math.min(a.i1 - a.j0, b.i1 - b.j0) * 16 - Math.max(a.i0 - a.j1, b.i0 - b.j1) * 16 > px

/** Is `a` in front of `b` (wholly on its +i or +j side)? */
export const inFront = (a: Box, b: Box) => a.i0 >= b.i1 - 1e-6 || a.j0 >= b.j1 - 1e-6

/**
 * A belt dock or output chute on the edge of a footprint, its edge midpoint at
 * ground point (u, v), facing `dir`. It sorts by the row of the part that juts
 * out over the belt tile (so a neighbour beside that tile, or the items coming
 * out under its lintel, sort against it properly), but always in front of its
 * own building on a front edge (+i, +j) and behind it on a back edge.
 */
export const portDepth = (owner: number, u: number, v: number, dir: Dir) => {
  const d = (u + v + 0.12 * (DI[dir] + DJ[dir]) - 1) * ROW + SLOT.building + 0.2
  return dir === 2 || dir === 3 ? Math.max(0, Math.min(d, owner - 0.5)) : Math.max(d, owner + 0.5)
}

/** A rover or walker at fractional tile (fi, fj). */
export const unitDepth = (fi: number, fj: number) => (fi + fj) * ROW + SLOT.unit

/** An item on the belt tile in row `row`, `o` tiles (−0.5 … 0.5) along the row axis. */
export const itemDepth = (row: number, o: number) => (row + o) * ROW + SLOT.item
