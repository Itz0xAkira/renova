/**
 * Sinter kiln (4×4), clean isometric style. A long rotary drum on concrete
 * piers, riding rings and a girth gear: white at the cool feed end, wrapped in
 * gold foil in the middle, glowing through its seams at the hot end. Regolith
 * goes in through a hopper at the feed end; the hot end runs into a white firing
 * hood whose receiver window blazes, heated by a row of flat heliostat mirrors
 * at the back that throw a shimmering beam into it. A boxy exhaust tower stands
 * behind, a railed catwalk runs along the front, and pallets of sintered bricks
 * wait at the discharge. Level 2 adds two more mirrors, level 3 a second
 * exhaust tower and a brick conveyor.
 */
import type { Ctx } from '@/site/pixel/engine'
import { all, at, Iso, KZ, status } from '@/game/art/buildings/life'
import { block, crate, door, flat, FRAME, LIT, LIT_HI, MAT, pad, slats, win, type Mat } from './flat'

const WHITE: Mat = { t: '#f2ece4', l: '#ddd3cc', r: '#b6a6aa', hi: '#fffcf6', lo: '#8c7a83' }
const GOLD: Mat = { t: '#f3cf6a', l: '#d9ad45', r: '#a87a2e', hi: '#ffeaa6', lo: '#6e4c1e' }
const CONCRETE: Mat = { t: '#c9bcb4', l: '#ab9c95', r: '#857680', hi: '#ddd2ca', lo: '#5f5059' }
const BRICK: Mat = { t: '#c8704b', l: '#a95738', r: '#7d3f2a', hi: '#e08a5e', lo: '#5a2b1f' }
const MIRROR = ['#e6f6fc', '#a9d8ee', '#6fa6c8', '#3e6f96'] as const
const MELT = ['#fff3c4', '#ffd27a', '#ff9d5a', '#e2703a'] as const
const SOIL = ['#7d4029', '#9e5836', '#c07448', '#d99862'] as const
const SMOKE = ['#e2dcd8', '#bdb3b3', '#948a8e'] as const
const OR = MAT.crate
const NE = MAT.metal
const band = (m: Mat, l: number) => (l > 0.86 ? m.hi : l > 0.64 ? m.t : l > 0.44 ? m.l : m.r)

export function kilnV2(ctx: Ctx, x: number, y: number, t: number, tier: number) {
  const s = new Iso(ctx, x, y, 0.5)
  const blink = (t * 1.5) % 1 < 0.4
  const flick = 0.5 + 0.5 * Math.sin(t * Math.PI * 6)
  const base = 3
  pad(s, 1.96, base)

  // ── back: exhaust tower(s) ───────────────────────────────────────────
  const tower = (u0: number, v0: number, h: number) => {
    block(s, u0, u0 + 0.45, v0, v0 + 0.45, base, base + h, WHITE, {
      l: (c, r, w, hh) => (r === 0 ? WHITE.hi : r < 10 && Math.floor(r / 3) % 2 === 1 ? OR.t : r === hh - 1 ? WHITE.lo : c === Math.floor(w / 2) ? WHITE.r : null),
      r: (c, r, w, hh) => (r === 0 ? WHITE.l : r < 10 && Math.floor(r / 3) % 2 === 1 ? OR.l : r === hh - 1 ? WHITE.lo : null),
      t: (c, r, w, hh) => (c > 1 && r > 1 && c < w - 2 && r < hh - 2 ? MAT.dark.r : null),
    })
    if (t > 0)
      for (let k = 0; k < 4; k++) {
        const rise = (t * 3 + k * 1.8) % 9
        s.pt(u0 + 0.22 + rise * 0.015, v0 + 0.22 - rise * 0.015, base + h + 2 + rise, SMOKE[rise > 6 ? 2 : rise > 3 ? 1 : 0], false, 0.3)
      }
  }
  tower(-1.9, -1.9, 34)
  if (tier >= 3) tower(-1.3, -1.9, 28)
  // duct from the firing hood back to the tower
  block(s, -1.45, 1.1, -1.55, -1.43, base + 18, base + 21, NE, { ground: false, l: (c, r) => (r === 0 ? NE.hi : c % 8 === 0 ? NE.r : null) })

  // ── back right: heliostat mirrors, beaming into the hood ─────────────
  const RU = 1.2 // receiver on the hood
  const RV = -0.35
  const RZ = base + 17
  const mirrors: [number, number][] = [
    [0.1, -1.6],
    [0.75, -1.65],
    ...(tier >= 2
      ? ([
          [1.4, -1.65],
          [1.75, -1.1],
        ] as [number, number][])
      : []),
  ]
  for (const [mu, mv] of mirrors) {
    s.post(mu, mv, base, base + 7, flat(NE.l))
    // a flat mirror panel tilted toward the receiver: a thin box, glass face up
    block(s, mu - 0.22, mu + 0.22, mv - 0.14, mv + 0.14, base + 7, base + 9, NE, {
      ground: false,
      t: (c, r, w, h) => (c === 0 || r === 0 || c === w - 1 || r === h - 1 ? NE.hi : (c + r) % 7 === 0 ? MIRROR[0] : c < w / 2 ? MIRROR[1] : MIRROR[2]),
    })
    // the shimmering beam
    for (let f = 0.05; f < 1; f += 0.02) {
      const on = Math.floor(f * 20 + t * 16) % 3 !== 0
      if (on) s.pt(mu + (RU - mu) * f, mv + (RV - mv) * f, base + 10 + (RZ - base - 10) * f, f > 0.7 ? '#fff3c4' : '#ffe9a0', false, 0.1)
    }
  }

  // ── the rotary drum ──────────────────────────────────────────────────
  const DV = 0.1
  const DR = 0.42
  const DZ = base + 6 + DR * KZ
  const D0 = -1.45
  const D1 = 0.85
  const LEN = (D1 - D0) * 16
  const spin = t * 6
  // piers under the riding rings
  for (const u of [-0.95, 0.35]) block(s, u - 0.14, u + 0.14, DV - 0.3, DV + 0.3, base, base + 6, CONCRETE)
  s.hcyl('u', D0, D1, DV, DZ, DR, flat(WHITE.t), {
    pat: (s0, th, l) => {
      const f = s0 / LEN
      // seams roll round as it turns
      const seam = Math.abs(((th * 4 + spin) % (Math.PI / 1)) - 0.2) < 0.12
      if (f < 0.3) return seam ? band(WHITE, l - 0.25) : band(WHITE, l) // cool feed end
      if (f < 0.72) return Math.round(s0 + th * 4 + spin) % 5 === 0 ? GOLD.hi : band(GOLD, l) // foil
      // hot end: dark steel, seams glowing
      if (seam || Math.round(s0) % 4 === 0) return flick > 0.5 ? MELT[1] : MELT[2]
      return l > 0.6 ? NE.l : NE.r
    },
    cap: (rr) => (rr > 0.8 ? NE.r : NE.l),
  })
  // riding rings and the girth gear
  for (const [u, gear] of [
    [-0.95, false],
    [0.35, false],
    [-0.35, true],
  ] as const)
    s.hcyl('u', u - 0.06, u + 0.06, DV, DZ, DR + 0.05, flat(NE.t), {
      pat: (s0, th, l) => (gear && Math.round(th * 10 + spin * 3) % 2 === 0 ? MAT.dark.l : l > 0.55 ? NE.hi : NE.l),
      cap: () => NE.t,
    })

  // ── feed hopper at the cool end ──────────────────────────────────────
  for (let k = 0; k < 3; k++) {
    const half = 0.16 + k * 0.08
    block(s, -1.75 - half, -1.75 + half, DV - half, DV + half, DZ + 2 + k * 3, DZ + 5 + k * 3, NE, {
      ground: false,
      l: (c, r) => (r === 0 ? NE.hi : null),
      t: k === 2 ? (c, r, w, h) => (c < 2 || r < 2 || c > w - 3 || r > h - 3 ? NE.t : SOIL[(c + r * 2) % 4]) : undefined,
    })
  }
  for (const [du, dv] of [
    [-0.25, -0.25],
    [0.25, -0.25],
    [-0.25, 0.25],
    [0.25, 0.25],
  ])
    s.post(-1.75 + du, DV + dv, base, DZ + 2, flat(NE.l))

  // ── the firing hood at the hot end, its receiver blazing ─────────────
  block(s, 0.8, 1.6, -0.55, 0.65, base, base + 22, WHITE, {
    l: all((c, r, w, h) => (r === 1 ? OR.t : r === h - 1 ? WHITE.lo : null), at(3, 4, 7, 6, win(0, 0, 7, 6, true))),
    r: all(
      (c, r, w, h) => (r === 1 ? OR.l : r === h - 1 ? WHITE.lo : null),
      at(4, 3, 9, 7, (c, r, w, h) => (c === 0 || r === 0 || c === w - 1 || r === h - 1 ? FRAME : MELT[Math.min(3, Math.floor(Math.hypot(c - w / 2, r - h / 2) / 1.3 + (1 - flick) * 0.5))])),
      at(4, 13, 6, 8, door(0, 0, 6, 8, NE)),
      slats(13, 13, 5, 6),
    ),
    top: MAT.roof.t,
  })
  status(s, 1.6, 0.0, base + 20, 'red', blink)
  status(s, 1.6, 0.4, base + 20, 'green', true)

  // ── front: railed catwalk along the drum ─────────────────────────────
  const CV = DV + 0.6
  block(s, -1.55, 0.75, CV, CV + 0.22, base + 6, base + 7, NE, { ground: false, t: (c, r) => (c % 3 === 0 ? NE.r : NE.t) })
  for (let a = -1.55; a <= 0.75; a += 1 / 32) s.pt(a, CV + 0.22, base + 11, OR.t, false, 0.02)
  for (let a = -1.55; a <= 0.76; a += 0.38) {
    s.line(a, CV + 0.22, base + 7, a, CV + 0.22, base + 11, OR.l, 0.02)
    s.post(a, CV + 0.11, base, base + 6, flat(NE.r))
  }
  for (let k = 0; k < 4; k++) block(s, -1.75 + k * 0.05, -1.55 + k * 0.05, CV, CV + 0.22, base + k * 1.5, base + k * 1.5 + 1.5, NE, { ground: k === 0 })

  // ── discharge: pallets of sintered bricks ────────────────────────────
  const pallet = (pu: number, pv: number, layers: number) => {
    block(s, pu, pu + 0.55, pv, pv + 0.5, base, base + 2, MAT.crate)
    for (let layer = 0; layer < layers; layer++)
      for (let k = 0; k < 2; k++)
        block(s, pu + 0.03 + k * 0.25, pu + 0.27 + k * 0.25, pv + 0.04, pv + 0.46, base + 2 + layer * 3, base + 5 + layer * 3, BRICK, {
          ground: false,
          l: (c, r) => (r === 0 ? BRICK.hi : c % 5 === (layer % 2) * 2 ? BRICK.lo : null),
        })
  }
  pallet(1.0, 1.0, 3)
  pallet(1.4, 1.45, 2)
  pallet(0.45, 1.4, 1)
  if (tier >= 3) {
    for (let f = 0; f <= 1; f += 0.02) {
      const u = 1.2 + f * 0.05
      const v = 0.65 + f * 0.35
      s.pt(u - 0.06, v, base + 6 - f * 2, NE.t, false, 0.02)
      s.pt(u, v, base + 7 - f * 2, Math.floor(f * 20 - t * 10) % 3 === 0 ? BRICK.t : MAT.dark.l, false, 0.03)
    }
  }
  crate(s, -1.8, 1.4, 0.3, base)
  s.lamp(0.8, 0.66, base + 16, LIT_HI, LIT)
  s.flush()
}
