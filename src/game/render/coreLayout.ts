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

/** Height of the core's pad (world px): drones and the landing ring sit on top of it. */
export const CORE_PLINTH = 3

/**
 * Points on the 5×5 core, in tiles from its footprint centre (u down-right,
 * v down-left). The core sprite (art/v2/core.ts) paints and builds on these.
 */
/** Drone landing pads, in the middle-back between the tower and the comms block. */
export const CORE_PADS_UV: readonly (readonly [number, number])[] = [
  [-0.6, -1.75],
  [-0.6, -0.62],
]
/** Centre of the supply ship's landing ring, near the front corner. */
export const CORE_RING_UV: readonly [number, number] = [1.3, 1.3]
/** The lattice mast the power cables hang from: u, v and the height of its top (world px). */
export const CORE_MAST: readonly [number, number, number] = [1.95, -2.1, 50]

/** Where power cables attach to the core: the mast top, in world px from the footprint centre. */
export const CORE_ANTENNA: readonly [number, number] = [(CORE_MAST[0] - CORE_MAST[1]) * 16, (CORE_MAST[0] + CORE_MAST[1]) * 8 - CORE_MAST[2]]

export type CoreLayout = {
  /** The footprint: first tile and size. */
  i: number
  j: number
  w: number
  h: number
  /** Ground point (world px) under the footprint centre. */
  centre: readonly [number, number]
  /** Drone landing pads, as ground points (world px); drawn CORE_PLINTH px higher. See CORE_PADS_UV. */
  pads: (readonly [number, number])[]
  /** Supply-ship landing ring (see CORE_RING_UV), raised onto the pad. */
  ring: readonly [number, number]
  /** Rover charging bays: the tiles along the core's two front edges (one per tile of edge: 10 for a 5×5 core). */
  bays: Tile[]
  /** Draw order of things standing on the core's front tile (the landed ship): just in front of the core. */
  shipDepth: number
}

export function coreLayout(core: Ent): CoreLayout {
  const { w, h } = BUILDINGS[core.kind]
  const { i, j } = core
  const ci = i + w / 2
  const cj = j + h / 2
  const [rx, ry] = top(ci + CORE_RING_UV[0], cj + CORE_RING_UV[1])
  const bays: Tile[] = []
  for (let k = 0; k < h; k++) bays.push([i + w, j + k])
  for (let k = 0; k < w; k++) bays.push([i + k, j + h])
  return {
    i,
    j,
    w,
    h,
    centre: top(i + w / 2, j + h / 2),
    pads: CORE_PADS_UV.map(([u, v]) => top(ci + u, cj + v)),
    ring: [rx, ry - CORE_PLINTH],
    bays,
    shipDepth: depthFor(core.kind, i, j) + 1,
  }
}

/** Is fractional tile (fi, fj) on the core or one of the tiles around it? */
export const nearCore = (c: CoreLayout, fi: number, fj: number) => fi > c.i - 1.5 && fi < c.i + c.w + 0.5 && fj > c.j - 1.5 && fj < c.j + c.h + 0.5
