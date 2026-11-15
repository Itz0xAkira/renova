/**
 * Colony core (5×5), clean isometric style: the command centre, kept low and
 * spread out. Same parts as before, now with room:
 *
 *  - back corner: the ribbed pressure tower with its warm-lit ops cupola
 *  - left: the white command module, its lit face carrying the amber SOL clock,
 *    a hatch and windows on its side
 *  - right: the comms and power block, solar-roofed, with a high-gain dish,
 *    battery cabinets out front, a radiator on its side and the lattice mast
 *    the power cables hang from
 *  - middle: two drone pads and a gold-foil cryo tank on saddles
 *  - front: the supply ship's landing ring with chase lights, fed by fuel and
 *    power lines, floodlights at the side corners, crates and a charging post
 *
 * Drone pads, the landing ring and the cable point must match
 * render/coreLayout.ts (CORE_PADS_UV, CORE_RING_UV, CORE_ANTENNA).
 */
import type { Ctx } from '@/site/pixel/engine'
import { all, at, Iso, KZ, status } from '@/game/art/buildings/life'
import { block, crate, door, flat, FRAME, LIT, LIT_HI, MAT, slats, win, type Mat } from './flat'
import { CORE_MAST, CORE_PADS_UV, CORE_PLINTH, CORE_RING_UV } from '@/game/render/coreLayout'

const WHITE: Mat = { t: '#f2ece4', l: '#ddd3cc', r: '#b6a6aa', hi: '#fffcf6', lo: '#8c7a83' }
const GOLD: Mat = { t: '#f3cf6a', l: '#d9ad45', r: '#a87a2e', hi: '#ffeaa6', lo: '#6e4c1e' }
const CONCRETE: Mat = { t: '#c9bcb4', l: '#ab9c95', r: '#857680', hi: '#ddd2ca', lo: '#5f5059' }
const OR = MAT.crate
const NE = MAT.metal
const AMBER = ['#ffb340', '#a8641c'] as const
const CYAN = '#65c9e8'
const SOLAR = ['#2f3a63', '#46558a', '#6c7fb8'] as const

/** Four flat tones from a brightness. */
const band = (m: Mat, l: number) => (l > 0.86 ? m.hi : l > 0.64 ? m.t : l > 0.44 ? m.l : m.r)

/** 3×5 font for the mission clock. */
const FONT: Record<string, string[]> = {
  S: ['###', '#..', '###', '..#', '###'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  L: ['#..', '#..', '#..', '#..', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
}

export function coreV2(ctx: Ctx, x: number, y: number, t: number) {
  const s = new Iso(ctx, x, y, 0.45)
  const blink = (t * 1.5) % 1 < 0.4
  const base = CORE_PLINTH
  const H = 2.45

  // ── the pad: tiled, a safety line, drone pads and the landing ring painted on ──
  const [ru, rv] = CORE_RING_UV
  const chase = Math.floor(t * 4) % 8
  block(s, -H, H, -H, H, 0, base, MAT.pad, {
    t: (c, r, W, Hh) => {
      if (r >= Hh - 1) return MAT.pad.hi
      const u = (c + 0.5) / 16 - H
      const v = (r + 0.5) / 16 - H
      // landing ring
      const dr = Math.hypot(u - ru, v - rv)
      if (dr < 1.0) {
        const a = Math.atan2(v - rv, u - ru)
        if (dr > 0.86) {
          const k = Math.round(((a + Math.PI) / (Math.PI * 2)) * 8) % 8
          if (Math.abs(dr - 0.93) < 0.05 && Math.abs(((a + Math.PI) / (Math.PI * 2)) * 8 - Math.round(((a + Math.PI) / (Math.PI * 2)) * 8)) < 0.12) return k === chase ? LIT_HI : OR.r
          return Math.floor(((a + Math.PI) / (Math.PI * 2)) * 16) % 2 ? OR.t : WHITE.hi
        }
        if (dr > 0.8) return CONCRETE.r
        if (Math.abs(dr - 0.5) < 0.035 && Math.floor(((a + Math.PI) / (Math.PI * 2)) * 20) % 2) return WHITE.t
        if ((Math.abs(u - ru) < 0.05 && Math.abs(v - rv) < 0.22) || (Math.abs(v - rv) < 0.05 && Math.abs(u - ru) < 0.22)) return OR.t
        return CONCRETE.t
      }
      // drone pads: white rim, dark ring, an orange H
      for (const [pu, pv] of CORE_PADS_UV) {
        const d = Math.hypot(u - pu, v - pv)
        if (d < 0.44) {
          if (d > 0.4) return CONCRETE.lo
          if (d > 0.33) return WHITE.hi
          if (d > 0.3) return CONCRETE.r
          const du = u - pu
          const dv = v - pv
          if ((Math.abs(Math.abs(du) - 0.12) < 0.035 && Math.abs(dv) < 0.17) || (Math.abs(du) < 0.12 && Math.abs(dv) < 0.03)) return OR.t
          return CONCRETE.l
        }
      }
      const e = Math.min(c, r, W - 1 - c, Hh - 1 - r)
      if (e === 3) return '#f2c94c'
      if (c % 8 === 0 || r % 8 === 0) return MAT.pad.r
      return (Math.floor(c / 8) + Math.floor(r / 8)) % 2 ? MAT.pad.t : '#cd9770'
    },
  })
  // pad edge lights (red / green) by each drone pad
  for (const [pu, pv] of CORE_PADS_UV) {
    status(s, pu - 0.42, pv, base + 1, 'green', (t * 2 + pu) % 1 < 0.5)
    status(s, pu, pv - 0.42, base + 1, 'red', (t * 2 + pu + 0.5) % 1 < 0.5)
  }

  // ── railing along the two back edges ────────────────────────────────
  for (let a = -2.4; a <= 2.4; a += 1 / 16) {
    s.pt(a, -2.42, base + 4, NE.t)
    s.pt(-2.42, a, base + 4, NE.hi)
  }
  for (let a = -2.4; a <= 2.42; a += 0.4) {
    s.line(a, -2.42, base, a, -2.42, base + 4, NE.l)
    s.line(-2.42, a, base, -2.42, a, base + 4, NE.t)
  }

  // ── back corner: the ribbed tower and ops cupola ─────────────────────
  const TU = -1.62
  const TV = -1.62
  const T1 = base + 26
  s.vcyl(TU, TV, 10, base, base + 3, flat(NE.l), { lid: flat(NE.t), spec: false, pat: (nx, r) => (r === 0 ? NE.hi : nx < -0.4 ? NE.t : nx < 0.35 ? NE.l : NE.r) })
  s.vcyl(TU, TV, 9, base + 3, T1, flat(WHITE.t), {
    lid: false,
    spec: false,
    pat: (nx, r, _H, l) => {
      if (r % 6 === 5) return band(WHITE, l - 0.25)
      if (r === 2 || r === 3) return l > 0.5 ? OR.t : OR.l
      // a ladder up the lit side
      if (nx > -0.8 && nx < -0.55 && r > 4) return Math.abs(nx + 0.67) > 0.07 ? NE.t : r % 3 === 0 ? NE.r : band(WHITE, l)
      if (Math.abs(nx - 0.15) < 0.14 && r % 6 === 2) return LIT
      return band(WHITE, l)
    },
  })
  const C1 = T1 + 7
  s.vcyl(TU, TV, 11, T1, C1, flat(WHITE.t), {
    lid: false,
    spec: false,
    pat: (nx, r, Hh, l) => {
      if (r === 0 || r === Hh - 1) return band(NE, l)
      const seg = Math.round((nx + 1) * 4)
      if (Math.abs((nx + 1) * 4 - seg) < 0.16 || Math.abs(nx) > 0.92) return FRAME
      if (seg === 3) return r === 1 ? '#c9f4ff' : CYAN
      return r === 1 ? LIT_HI : LIT
    },
  })
  s.ell(TU, TV, C1, 11, 5, flat(WHITE.t), { cut: 0, spec: false, pat: (_u, _v, nz, l) => (nz < 0.18 ? (l > 0.5 ? OR.t : OR.l) : band(WHITE, l)) })
  s.post(TU, TV, C1 + 4, C1 + 13, flat(NE.l))
  block(s, TU - 0.1, TU + 0.1, TV - 0.02, TV + 0.02, C1 + 9, C1 + 10, NE, { ground: false })
  status(s, TU, TV, C1 + 14, 'red', blink)

  // ── left: the command module and its SOL clock ───────────────────────
  const LH = base + 19
  const clock = at(3, 4, 15, 13, (c, r, w, h) => {
    if (c === 0 || r === 0 || c === w - 1 || r === h - 1) return FRAME
    const line = r >= 1 && r <= 5 ? 'SOL' : r >= 7 && r <= 11 ? '247' : null
    const cc = c - 1
    if (line && cc % 4 < 3 && cc < 12) {
      const row = FONT[line[Math.floor(cc / 4)]][line === 'SOL' ? r - 1 : r - 7]
      if (row[cc % 4] === '#') return line === 'SOL' ? AMBER[0] : '#ffd27a'
    }
    if (r === h - 2 && c === w - 2) return (t * 2) % 1 < 0.5 ? '#7ee07a' : '#2f6a3a'
    return '#1d1a22'
  })
  const seams = (every: number, m: Mat, side: 'l' | 'r') => (c: number, r: number, w: number, h: number) => (r === 1 ? (side === 'l' ? OR.t : OR.l) : r === h - 2 ? m.lo : c > 0 && c % every === 0 ? (side === 'l' ? m.r : m.lo) : null)
  block(s, -2.4, -1.0, 0.05, 2.3, base, LH, WHITE, {
    l: all(clock, seams(11, WHITE, 'l')),
    r: all(at(4, 5, 8, 14, door(0, 0, 8, 14)), at(16, 5, 6, 7, win(0, 0, 6, 7, true)), at(26, 5, 6, 7, win(0, 0, 6, 7, true)), slats(16, 14, 16, 3), seams(12, WHITE, 'r')),
    top: MAT.roof.t,
  })
  status(s, -0.98, 0.35, base + 17, 'green', true)
  status(s, -0.98, 0.85, base + 17, 'red', blink)
  // roof kit: an air-handling stack and a vent box
  s.vcyl(-1.85, 0.6, 3, LH, LH + 7, flat(NE.l), { lid: flat(MAT.dark.r), spec: false, pat: (nx) => (nx < -0.3 ? NE.hi : nx < 0.3 ? NE.l : NE.r) })
  block(s, -1.75, -1.25, 1.2, 1.9, LH, LH + 4, NE, { ground: false, l: slats(1, 1, 7, 3) })

  // ── right: comms and power block ─────────────────────────────────────
  const RH = base + 16
  block(s, 0.05, 2.3, -2.4, -1.15, base, RH, WHITE, {
    l: all(at(3, 4, 8, 12, door(0, 0, 8, 12)), at(14, 4, 6, 6, win(0, 0, 6, 6)), at(24, 4, 8, 6, win(0, 0, 8, 6, true)), seams(12, WHITE, 'l')),
    r: all((c, r, w, h) => (r === 1 ? OR.l : r > 2 && r < h - 2 && c > 1 && c < w - 2 ? (c % 2 ? WHITE.hi : WHITE.r) : null), seams(99, WHITE, 'r')),
    t: (c, r, W, Hh) => {
      // solar cells over most of the roof, a fan at the end
      if (r >= Hh - 1) return WHITE.hi
      const fx = c - (W - 6)
      const fy = r - Hh / 2
      const d = Math.hypot(fx, fy)
      if (d < 3.4) return d < 1 ? NE.hi : Math.abs(Math.sin(Math.atan2(fy, fx) * 2 - t * 9)) > 0.75 ? NE.t : MAT.dark.r
      if (c > 1 && c < W - 11 && r > 1 && r < Hh - 2) return c % 5 === 0 || r % 4 === 0 ? SOLAR[2] : (c + r) % 7 === 0 ? SOLAR[1] : SOLAR[0]
      return MAT.roof.t
    },
  })
  // battery cabinets along its front, green charge bars
  for (let k = 0; k < 3; k++) {
    const u0 = 0.35 + k * 0.42
    const level = Math.round(((Math.sin(t * Math.PI + k) + 1) / 2) * 6)
    block(s, u0, u0 + 0.32, -1.15, -0.95, base, base + 10, NE, {
      l: (c, r, w, h) => (r === 0 ? NE.hi : c > 1 && c < w - 2 && r > 1 && r < h - 2 ? (r > h - 3 - level ? '#7ee07a' : '#2f6a3a') : r === h - 1 ? NE.lo : null),
    })
  }
  // high-gain dish on the roof
  const DU = 0.75
  const DVV = -1.85
  s.post(DU, DVV, RH, RH + 5, flat(NE.l))
  s.ell(DU, DVV, RH + 7, 9, 2, flat(WHITE.t), {
    cut: 0,
    spec: false,
    // seen from above: a bright rim round a shaded bowl, darker toward the far side
    pat: (nu, nv, nz) => (nz < 0.45 ? WHITE.hi : nz < 0.6 ? WHITE.t : nu + nv < 0 ? WHITE.r : WHITE.l),
  })
  for (const [du, dv] of [
    [-0.25, 0],
    [0, -0.25],
    [0.18, 0.18],
  ])
    s.line(DU + du, DVV + dv, RH + 8, DU, DVV, RH + 14, NE.t)
  s.pt(DU, DVV, RH + 15, '#e8c15a', false, 0.1)
  // the lattice mast: the power cables attach at its top
  const [MU, MV, MTOP] = CORE_MAST
  for (const [du, dv] of [
    [-0.08, -0.08],
    [0.08, -0.08],
    [-0.08, 0.08],
    [0.08, 0.08],
  ])
    s.line(MU + du * 1.6, MV + dv * 1.6, RH, MU + du * 0.5, MV + dv * 0.5, MTOP, NE.l)
  for (let z = RH + 5; z < MTOP; z += 6) {
    const k = 1.6 - (1.1 * (z - RH)) / (MTOP - RH)
    s.line(MU - 0.08 * k, MV + 0.08 * k, z, MU + 0.08 * k, MV + 0.08 * k, z, NE.t)
    s.line(MU + 0.08 * k, MV - 0.08 * k, z, MU + 0.08 * k, MV + 0.08 * k, z, NE.r)
  }
  s.line(MU - 0.25, MV, MTOP - 6, MU + 0.25, MV, MTOP - 6, NE.t)
  s.lamp(MU, MV, MTOP + 2, blink ? '#ff6a5a' : '#8f2f3f', '#b03e53')
  s.lamp(MU + 0.25, MV, MTOP - 6, OR.hi, OR.l)

  // ── middle: gold-foil cryo tank on saddles, fuel and power lines ─────
  for (const u of [0.5, 1.3]) block(s, u - 0.06, u + 0.06, -0.7, -0.3, base, base + 3, NE)
  s.hcyl('u', 0.35, 1.5, -0.5, base + 3 + 0.24 * KZ, 0.24, flat(GOLD.t), {
    pat: (s0, th, l) => (s0 < 1.5 || Math.abs(s0 - 9) < 0.7 ? band(WHITE, l) : Math.round(s0 + th * 3) % 5 === 0 ? GOLD.hi : band(GOLD, l)),
    cap: (rr, _th, l) => (rr > 0.8 ? WHITE.r : l > 0.5 ? WHITE.hi : WHITE.t),
  })
  // hydrant box and lines out to the ring
  block(s, 0.62, 0.82, 0.05, 0.25, base, base + 5, WHITE, { l: (c, r) => (r === 1 ? OR.t : null), r: (c, r) => (r === 2 && c > 0 ? '#7ee07a' : null) })
  for (let v = -0.28; v < 0.42; v += 1 / 32) s.pt(0.72, v, base + 1, OR.t, false, 0.01)
  for (let v = 0.25; v < 0.48; v += 1 / 32) s.pt(0.66, v, base + 1, MAT.dark.l, false, 0.01)

  // ── front: floodlights, crates and a charging post ───────────────────
  for (const [u, v] of [
    [-0.35, 2.35],
    [2.35, -0.35],
  ] as const) {
    s.post(u, v, base, base + 15, flat(NE.l))
    block(s, u - 0.07, u + 0.07, v - 0.07, v + 0.07, base + 15, base + 17, NE, { ground: false })
    s.lamp(u, v, base + 14, LIT_HI, LIT)
  }
  crate(s, -0.85, 1.55, 0.3, base)
  crate(s, -0.85, 1.95, 0.28, base)
  crate(s, -0.8, 1.6, 0.24, base + 5)
  block(s, -0.4, -0.22, 0.75, 0.93, base, base + 9, NE, { l: (c, r, w, h) => (r === 0 ? NE.hi : r === 2 && c > 0 && c < w - 1 ? '#7ee07a' : r === 4 && c === 1 ? CYAN : null) })
  s.flush()
}
