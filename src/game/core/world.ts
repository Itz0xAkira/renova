/**
 * World helpers: seeded randomness, ground generation and building geometry.
 * Pure functions, shared by the simulation and the renderer.
 */
import { BUILDINGS, MAP, type Dir, type Ground, type Kind } from '@/game/core/data'

/* ------------------------------ randomness ------------------------------ */

/** One step of the mulberry32 generator: the next value in [0, 1) and the next state. */
export function mulberryNext(state: number): [number, number] {
  const a = (state + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a]
}

/** A seeded generator as a plain function. */
export const mulberry = (seed: number) => {
  let a = seed | 0
  return () => {
    const [v, next] = mulberryNext(a)
    a = next
    return v
  }
}

export function hash2(a: number, b: number, s: number) {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

export function noise(x: number, y: number, scale: number, seed: number) {
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

/* --------------------------------- ground --------------------------------- */

/** Top-left tile of the 2×2 colony core, in the middle of the map. */
export const CORE_AT = MAP / 2 - 1

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

/* -------------------------------- geometry -------------------------------- */

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
