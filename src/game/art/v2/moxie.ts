/**
 * MOXIE oxygen plant (3×3), clean isometric style. A louvred intake tower
 * draws in thin Mars air (CO₂) through a dust filter; the white solid-oxide
 * electrolysis unit's inspection window shows the ceramic cell stack glowing
 * orange-hot, with a CO₂ fan on its roof and a vent breathing out carbon
 * monoxide. A pump skid with status lamps sends the oxygen through hoses to
 * gold-foil capsule tanks on saddles. Level 2 adds a third tank, level 3 a
 * radiator wing.
 */
import type { Ctx } from '@/site/pixel/engine'
import { all, at, Iso, KZ, status } from '@/game/art/buildings/life'
import { block, crate, door, flat, FRAME, MAT, pad, slats, type Mat } from './flat'

const WHITE: Mat = { t: '#f2ece4', l: '#ddd3cc', r: '#b6a6aa', hi: '#fffcf6', lo: '#8c7a83' }
const GOLD: Mat = { t: '#f3cf6a', l: '#d9ad45', r: '#a87a2e', hi: '#ffeaa6', lo: '#6e4c1e' }
const HOT = ['#fff3c4', '#ffd27a', '#ff9d5a', '#e2703a'] as const
const DUST = ['#c07448', '#d99862', '#e8b282'] as const
const SMOKE = ['#e2dcd8', '#bdb3b3', '#948a8e'] as const
const OR = MAT.crate
const NE = MAT.metal
const band = (m: Mat, l: number) => (l > 0.86 ? m.hi : l > 0.64 ? m.t : l > 0.44 ? m.l : m.r)

export function moxieV2(ctx: Ctx, x: number, y: number, t: number, tier: number) {
  const s = new Iso(ctx, x, y, 0.5)
  const blink = (t * 1.5) % 1 < 0.4
  const glow = 0.5 + 0.5 * Math.sin(t * Math.PI * 3)
  const base = 3
  pad(s, 1.47, base)

  // ── back right: gold-foil oxygen tanks on saddles ────────────────────
  const tanks = tier >= 2 ? [-1.25, -0.72, -0.19] : [-1.2, -0.6]
  const TR = 0.22
  for (const tv of tanks) {
    for (const u of [0.45, 1.15]) block(s, u - 0.05, u + 0.05, tv - 0.18, tv + 0.18, base, base + 3, NE)
    s.hcyl('u', 0.25, 1.38, tv, base + 3 + TR * KZ, TR, flat(GOLD.t), {
      pat: (s0, th, l) => (s0 < 1.5 ? band(WHITE, l) : Math.round(s0 * 1.3 + th * 4) % 6 === 0 ? GOLD.hi : band(GOLD, l)),
      cap: (rr, _th, l) => (rr > 0.8 ? WHITE.r : rr < 0.25 ? '#4c97c9' : l > 0.5 ? WHITE.hi : WHITE.t),
    })
  }
  // level 3: radiator wing along the back edge
  if (tier >= 3) {
    block(s, -1.4, 0.15, -1.45, -1.39, base + 3, base + 20, WHITE, {
      ground: false,
      l: (c, r, w, h) => (r === 0 ? OR.hi : r === h - 1 ? NE.r : c % 3 === 0 ? WHITE.r : c % 3 === 1 ? WHITE.hi : WHITE.l),
      r: () => NE.r,
    })
    for (const u of [-1.3, 0.05]) s.post(u, -1.42, base, base + 3, flat(NE.l))
  }

  // ── back left: the intake tower, pulling in Mars air ─────────────────
  block(s, -1.4, -0.75, -1.2, -0.55, base, base + 20, WHITE, {
    l: all((c, r, w, h) => (r === 1 ? OR.t : r === h - 1 ? WHITE.lo : null), slats(1, 3, w0(-1.4, -0.75) - 2, 12)),
    r: all((c, r, w, h) => (r === 1 ? OR.l : r === h - 1 ? WHITE.lo : null), slats(1, 3, 8, 12)),
    t: (c, r, w, h) => (c > 1 && r > 1 && c < w - 2 && r < h - 2 ? (c % 2 ? MAT.dark.l : MAT.dark.r) : null),
    top: MAT.roof.t,
  })
  // dust motes drifting into the louvres
  for (let k = 0; k < 5; k++) {
    const f = (t * 0.6 + k / 5) % 1
    s.pt(-1.1 + 0.05 * k - 0.1, -0.2 + (1 - f) * 0.5, base + 6 + k * 2.5, DUST[k % 3], false, 0.2)
  }
  // duct from the tower into the electrolysis unit
  block(s, -1.1, -0.85, -0.55, 0.0, base + 13, base + 16, NE, { ground: false, l: (c, r) => (r === 0 ? NE.hi : null) })

  // ── front: the electrolysis unit, its cell stack glowing ─────────────
  const UZ = base + 17
  const stack = (c: number, r: number, w: number, h: number) => {
    // the inspection window: a framed view of the ceramic cells, red-hot plates in a stack
    if (c === 0 || r === 0 || c === w - 1 || r === h - 1) return FRAME
    if (r % 2 === 1) return c % 3 === 0 ? '#5a3a30' : glow > 0.5 ? HOT[1] : HOT[2]
    return c % 3 === 0 ? '#3a2a28' : HOT[3]
  }
  block(s, -1.35, 0.2, 0.0, 1.3, base, UZ, WHITE, {
    l: all((c, r, w, h) => (r === 1 ? OR.t : r === h - 1 ? WHITE.lo : c % 8 === 0 && c > 0 ? WHITE.r : null), at(4, 4, 14, 9, stack), at(20, 4, 3, 2, (c) => (c % 2 ? MAT.dark.r : MAT.dark.l))),
    r: all((c, r, w, h) => (r === 1 ? OR.l : r === h - 1 ? WHITE.lo : null), at(3, 5, 7, 11, door(0, 0, 7, 11, NE)), slats(12, 4, 7, 7)),
    t: (c, r, w, h) => {
      // the CO₂ fan on the roof
      const d = Math.hypot(c - w * 0.35, r - h * 0.55)
      if (d < 4.5) return d < 1 ? NE.hi : d > 3.8 ? NE.r : Math.abs(Math.sin(Math.atan2(r - h * 0.55, c - w * 0.35) * 2 - t * 9)) > 0.75 ? NE.t : MAT.dark.r
      return null
    },
    top: MAT.roof.t,
  })
  // the CO vent breathing out
  s.vcyl(-0.1, 0.25, 2, UZ, UZ + 6, flat(NE.l), { lid: flat(MAT.dark.r), spec: false })
  if (t > 0)
    for (let k = 0; k < 3; k++) {
      const rise = (t * 3 + k * 2) % 7
      s.pt(-0.1 + rise * 0.01, 0.25, UZ + 8 + rise, SMOKE[rise > 4 ? 2 : rise > 2 ? 1 : 0], false, 0.3)
    }
  // an O₂ stencil plate
  status(s, 0.22, 0.5, UZ - 3, 'green', true)

  // ── the pump skid and hoses to the tanks ─────────────────────────────
  block(s, 0.35, 1.1, 0.25, 0.75, base, base + 8, NE, {
    l: (c, r, w, h) => (r === 0 ? NE.hi : r === 2 && c > 1 && c < w - 2 ? (c % 3 === 0 ? (blink ? '#ff6a5a' : '#8f2f3f') : c % 3 === 1 ? '#7ee07a' : '#ffb340') : r === h - 1 ? NE.lo : null),
    r: slats(1, 2, 5, 4),
  })
  for (const tv of tanks) {
    // a hose from the skid up and over to each tank's end cap
    for (let f = 0; f <= 1; f += 0.04) {
      const u = 0.6 + (0.3 - 0.6) * f
      const v = 0.25 + (tv - 0.25) * f
      s.pt(u, v, base + 6 + Math.sin(f * Math.PI) * 3, f % 0.16 < 0.04 ? WHITE.hi : '#4c97c9', false, 0.02)
    }
  }
  crate(s, 1.05, 1.0, 0.3, base)
  crate(s, 0.7, 1.15, 0.24, base)
  s.flush()
}

/** Width in px of a lit face spanning u0…u1. */
function w0(u0: number, u1: number) {
  return Math.round((u1 - u0) * 16)
}
