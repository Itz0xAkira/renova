/**
 * The clean isometric style: flat-shaded faces (top light, lit left face mid,
 * shaded right face dark, shadows leaning plum), a 1px highlight on every top
 * edge and front corner, framed windows with sills, striped awnings, tiled pads
 * and rooftop clutter. No dithering, no gradients, no grain.
 *
 * Built on the depth-buffered `Iso` renderer: u runs down-right, v down-left
 * (tiles from the footprint centre), z up in px. Left (+v) faces are lit.
 */
import { all, at, Iso, type Pat } from '@/game/art/buildings/life'
import type { Ramp } from '@/game/art/pixel'

/** A flat material: top, lit face, shaded face, highlight edge, contact/low edge. */
export type Mat = { t: string; l: string; r: string; hi: string; lo: string }

export const MAT = {
  /** Habitat composite panels: warm cream. */
  wall: { t: '#f1e4d1', l: '#e4d0b8', r: '#b89c94', hi: '#fff8ec', lo: '#8c6e6c' },
  /** Roof membrane and parapets. */
  roof: { t: '#d3c7c6', l: '#b4a5a8', r: '#887985', hi: '#e9e1df', lo: '#5f4f5d' },
  /** Light structural metal. */
  metal: { t: '#aeabbd', l: '#8f8ba4', r: '#66627d', hi: '#d2d0e2', lo: '#45415b' },
  /** Dark machinery, frames, planters. */
  dark: { t: '#625a73', l: '#4e475e', r: '#39334a', hi: '#7b7390', lo: '#272233' },
  /** Life-support green trim and awnings. */
  green: { t: '#94c98d', l: '#74a96f', r: '#507d57', hi: '#b8dfad', lo: '#375842' },
  /** Cargo crates: safety orange. */
  crate: { t: '#eea061', l: '#d98549', r: '#a95d3a', hi: '#ffc58d', lo: '#7a3f2b' },
  /** Sintered-regolith pad, its sides. */
  pad: { t: '#d6a27b', l: '#bd7c55', r: '#8f5a41', hi: '#e9bd96', lo: '#6c3f2f' },
} satisfies Record<string, Mat>

export const GLASS = '#3e3a5d'
export const GLASS_HI = '#8784b6'
export const LIT = '#ffd27a'
export const LIT_HI = '#fff0bf'
export const FRAME = '#6a5466'
export const LEAF = ['#3f7a4a', '#5a9c55', '#7fbf63', '#a6d87c'] as const

/** A ramp made of one colour: shapes drawn with it come out flat. */
export const flat = (c: string): Ramp => [c, c, c, c, c]
const rampOf = (m: Mat): Ramp => [m.lo, m.r, m.l, m.t, m.hi]

/** Stable per-pixel noise (0–1), for leaves and tile variation. */
export const hash = (a: number, b: number, s = 0) => {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * A flat-shaded box. Patterns l / r / t paint over the lit face, shaded face and
 * top (top pattern gets u-px, v-px, u-span, v-span). `ground` darkens the bottom
 * row where the box meets the surface it stands on.
 */
export function block(s: Iso, u0: number, u1: number, v0: number, v1: number, z0: number, z1: number, m: Mat, o: { l?: Pat; r?: Pat; t?: Pat; ground?: boolean; top?: string; glass?: boolean } = {}) {
  const ground = o.ground ?? true
  const top = o.top ?? m.t
  s.box(u0, u1, v0, v1, z0, z1, rampOf(m), {
    edge: false,
    glass: o.glass,
    l: all(o.l, (c, r, W, H) => (r === 0 || c === W - 1 ? m.hi : ground && r === H - 1 ? m.lo : m.l)),
    r: all(o.r, (c, r, W, H) => (r === 0 ? m.l : ground && r === H - 1 ? m.lo : m.r)),
    t: all(o.t, (c, r, W, H) => (r >= H - 1 ? m.hi : c >= W - 1 ? m.l : top)),
  })
}

/** A framed window, w×h px at (c0, r0) on a face; dark glass with a glint, or lit warm. */
export const win = (c0: number, r0: number, w: number, h: number, lit = false): Pat =>
  at(c0, r0, w, h, (c, r, W, H) => {
    if (c === 0 || r === 0 || c === W - 1 || r === H - 1) return FRAME
    if (lit) return r === 1 ? LIT_HI : LIT
    const d = c - r
    return d === 0 || d === 1 ? GLASS_HI : GLASS
  })

/** A window plus its sill (one px wider each side, under it). */
export const sillWin = (c0: number, r0: number, w: number, h: number, sill: string, lit = false): Pat => all(win(c0, r0, w, h, lit), at(c0 - 1, r0 + h, w + 2, 1, sill))

/** An airlock door: frame, panel, round porthole, a green status light. */
export const door = (c0: number, r0: number, w: number, h: number, m: Mat = MAT.metal): Pat =>
  at(c0, r0, w, h, (c, r, W, H) => {
    if (c === 0 || r === 0 || c === W - 1) return FRAME
    const mx = (W - 1) / 2
    if (r >= 2 && r <= 4 && Math.abs(c - mx) <= 1) return r === 3 || Math.abs(c - mx) < 1 ? GLASS : GLASS_HI
    if (r === H - 1) return m.lo
    if (c === W - 2 && r === Math.floor(H * 0.55)) return '#7ee07a'
    return c === Math.floor(mx) ? m.r : m.l
  })

/** Horizontal slats: a roll shutter or a vent grille. */
export const slats = (c0: number, r0: number, w: number, h: number, m: Mat = MAT.metal): Pat =>
  at(c0, r0, w, h, (c, r, W, H) => (c === 0 || c === W - 1 || r === 0 ? FRAME : r % 2 ? m.r : m.l))

/** 3×5 pixel letters, for signs. */
const FONT: Record<string, string[]> = {
  H: ['101', '101', '111', '101', '101'],
  A: ['010', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
}
/** Letters stacked top to bottom (a blade sign), starting at (c0, r0). */
export const vtext = (text: string, c0: number, r0: number, ink: string): Pat => (c, r) => {
  const k = Math.floor((r - r0) / 6)
  const rr = (r - r0) % 6
  const ch = FONT[text[k]]
  if (!ch || r < r0 || rr > 4) return null
  const cc = c - c0
  return cc >= 0 && cc < 3 && ch[rr][cc] === '1' ? ink : null
}

/**
 * A striped awning over a lit-face opening: one canopy sloping out and down from
 * the wall at v = vWall over u0…u1 (top edge at height z, reaching `depth`
 * tiles out and dropping `drop` px), with a scalloped valance along its front.
 */
export function awning(s: Iso, u0: number, u1: number, vWall: number, z: number, a: Mat, b: Mat = MAT.wall, depth = 0.32, drop = 5) {
  const step = 1 / 48
  for (let u = u0; u < u1; u += step) {
    const stripe = Math.floor(((u - u0) * 16) / 3) % 2 ? b : a
    for (let d = 0; d <= depth; d += step) {
      const zz = z - (drop * d) / depth
      s.pt(u, vWall + d, zz, d < step * 2 ? stripe.hi : stripe.t, false, 0.05)
    }
    // valance: hangs 2 px at the front, scalloped every 3 px
    const lip = Math.floor(((u - u0) * 16) % 3) === 1 ? 3 : 2
    for (let k = 1; k <= lip; k++) s.pt(u, vWall + depth, z - drop - k, k === lip ? stripe.r : stripe.l, false, 0.06)
  }
}

/** A tiled pad (paving slabs with grout lines) covering ±half tiles, `h` px thick, with a dashed safety line painted round its edge. */
export function pad(s: Iso, half: number, h = 3, m: Mat = MAT.pad, tile = 8, line = true) {
  padRect(s, half, half, h, m, tile, line)
}

/** A tiled pad over ±hu × ±hv tiles, for footprints that aren't square. */
export function padRect(s: Iso, hu: number, hv: number, h = 3, m: Mat = MAT.pad, tile = 8, line = true) {
  const grout = m.r
  block(s, -hu, hu, -hv, hv, 0, h, m, {
    t: (c, r, W, H) => {
      if (r >= H - 1) return m.hi
      const e = Math.min(c, r, W - 1 - c, H - 1 - r)
      if (line && e === 3) return '#f2c94c'
      if (c % tile === 0 || r % tile === 0) return grout
      const k = (Math.floor(c / tile) + Math.floor(r / tile)) % 2
      return k ? m.t : '#cd9770'
    },
  })
}

/** A planter box with a leafy top and a few sprigs above it. */
export function planter(s: Iso, u0: number, u1: number, v0: number, v1: number, z0: number, h = 4) {
  block(s, u0, u1, v0, v1, z0, z0 + h, MAT.dark, {
    t: (c, r) => LEAF[Math.floor(hash(c, r, 5) * 3) + (hash(c >> 1, r, 6) > 0.7 ? 1 : 0)],
  })
  const n = Math.max(2, Math.round((u1 - u0 + v1 - v0) * 6))
  for (let k = 0; k < n; k++) {
    const u = u0 + (u1 - u0) * hash(k, 1, 9)
    const v = v0 + (v1 - v0) * hash(k, 2, 9)
    const tall = 1 + Math.floor(hash(k, 3, 9) * 3)
    for (let zz = 0; zz < tall; zz++) s.pt(u, v, z0 + h + 1 + zz, LEAF[Math.min(3, 1 + zz)], false, 0.02)
  }
}

/** A cargo crate: orange with a white band and dark corner edges. */
export function crate(s: Iso, u: number, v: number, size: number, z0: number) {
  const px = Math.round(size * 16)
  const band = (r: number, H: number) => r === Math.floor(H / 2) || r === Math.floor(H / 2) - 1
  block(s, u, u + size, v, v + size, z0, z0 + px, MAT.crate, {
    l: (c, r, W, H) => (r === 0 ? MAT.crate.hi : c === 0 || c === W - 1 || r === H - 1 ? MAT.crate.lo : band(r, H) ? MAT.wall.l : null),
    r: (c, r, W, H) => (r === 0 ? MAT.crate.l : c === W - 1 || r === H - 1 ? MAT.crate.lo : band(r, H) ? MAT.wall.r : null),
  })
}

/** A street lamp: a thin post and a warm light. */
export function lampPost(s: Iso, u: number, v: number, z0: number, h: number, on: boolean) {
  s.post(u, v, z0, z0 + h, flat(MAT.dark.l))
  block(s, u - 0.06, u + 0.06, v - 0.06, v + 0.06, z0 + h, z0 + h + 2, MAT.dark, { ground: false })
  s.lamp(u, v, z0 + h - 1, on ? LIT_HI : '#b9a27a', on ? LIT : '#8a7a62')
}
