/**
 * Where things sit on and around the colony core, worked out from its real
 * footprint (any size), so drones, rovers, the supply ship and cables follow
 * the core wherever and however big it is.
 *
 * The core sprite should draw its drone pads, ship landing ring and cable
 * antenna at these same points (see the numbers in the comments).
 */
import { BUILDINGS } from '@/game/core/data'
import type { Ent } from '@/game/core/sim'
import { depthFor, top, type Tile } from '@/game/render/iso'

/** Height of the core's plinth (world px): pads and the landing ring sit on top of it. */
export const CORE_PLINTH = 6

/**
 * Where power cables attach to the core: the top of the comms mast on its
 * right-hand block, in world px from the footprint centre (see art/buildings/base.ts).
 */
export const CORE_ANTENNA: readonly [number, number] = [36, -64]

export type CoreLayout = {
  /** The footprint: first tile and size. */
  i: number
  j: number
  w: number
  h: number
  /** Ground point (world px) under the footprint centre. */
  centre: readonly [number, number]
  /**
   * Drone landing pads on the back tile, as ground points (world px). They are
   * drawn CORE_PLINTH px higher. For a 3×3 core: (±7, −16) from the centre;
   * for 2×2: (±7, −8).
   */
  pads: (readonly [number, number])[]
  /** Supply-ship landing ring: the front tile's centre, raised onto the plinth. For 3×3: (0, +16 − 6) from the centre. */
  ring: readonly [number, number]
  /** Rover charging bays: the tiles along the core's two front edges (one per tile of edge: 6 for a 3×3 core). */
  bays: Tile[]
  /** Draw order of things standing on the core's front tile (the landed ship): just in front of the core. */
  shipDepth: number
}

export function coreLayout(core: Ent): CoreLayout {
  const { w, h } = BUILDINGS[core.kind]
  const { i, j } = core
  const [rx, ry] = top(i + w - 0.5, j + h - 0.5)
  const bays: Tile[] = []
  for (let k = 0; k < h; k++) bays.push([i + w, j + k])
  for (let k = 0; k < w; k++) bays.push([i + k, j + h])
  return {
    i,
    j,
    w,
    h,
    centre: top(i + w / 2, j + h / 2),
    pads: [top(i + 0.72, j + 0.28), top(i + 0.28, j + 0.72)],
    ring: [rx, ry - CORE_PLINTH],
    bays,
    shipDepth: depthFor(core.kind, i, j) + 1,
  }
}

/** Is fractional tile (fi, fj) on the core or one of the tiles around it? */
export const nearCore = (c: CoreLayout, fi: number, fj: number) => fi > c.i - 1.5 && fi < c.i + c.w + 0.5 && fj > c.j - 1.5 && fj < c.j + c.h + 0.5
