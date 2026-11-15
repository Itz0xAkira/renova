/**
 * Kilopower fission surface power unit (5×5), clean isometric style. The
 * reactor sits in a pit behind a ring berm of bulldozed regolith, with only its
 * gold-foil shield top, the white Stirling converter ring and the stepped
 * converter housing showing. Its signature is the cross of white radiator
 * panels on the mast, heat visibly climbing the pipes. A trefoil sign stands
 * at the berm; a cable trench runs through a gap in the berm to the white
 * power-conditioning box. Level 2 completes the radiator cross, level 3 makes
 * it taller and paints a keep-out line round the berm.
 */
import type { Ctx } from '@/site/pixel/engine'
import { all, at, Iso, status } from '@/game/art/buildings/life'
import { block, door, flat, FRAME, MAT, slats, type Mat } from './flat'

const WHITE: Mat = { t: '#f2ece4', l: '#ddd3cc', r: '#b6a6aa', hi: '#fffcf6', lo: '#8c7a83' }
const GOLD: Mat = { t: '#f3cf6a', l: '#d9ad45', r: '#a87a2e', hi: '#ffeaa6', lo: '#6e4c1e' }
const BERM: Mat = { t: '#c98a5e', l: '#a9693f', r: '#7d4a30', hi: '#e0a679', lo: '#5a2b1f' }
const HEAT = ['#ffd27a', '#ff9d5a', '#e2703a'] as const
const OR = MAT.crate
const NE = MAT.metal
const band = (m: Mat, l: number) => (l > 0.86 ? m.hi : l > 0.64 ? m.t : l > 0.44 ? m.l : m.r)

export function reactorV2(ctx: Ctx, x: number, y: number, t: number, tier: number) {
  const s = new Iso(ctx, x, y, 0.5)
  const blink = (t * 1.5) % 1 < 0.4
  const base = 3
  const H = 2.45
  const RU = -0.35 // reactor centre
  const RV = -0.35
  const PIT = 1.05 // pit radius, tiles
  const BR = 1.45 // berm radius, tiles
  const GAP = Math.PI / 4 // the berm opens toward the front for the cable trench

  // ── the pad: tiles, the dark pit, the cable trench, a keep-out ring ───
  block(s, -H, H, -H, H, 0, base, MAT.pad, {
    t: (c, r, W, Hh) => {
      const u = (c + 0.5) / 16 - H
      const v = (r + 0.5) / 16 - H
      const d = Math.hypot(u - RU, v - RV)
      if (d < PIT) return d > PIT - 0.06 ? NE.r : (c + r) % 5 === 0 ? MAT.dark.l : MAT.dark.r
      // the trench from the berm gap to the power box
      if (Math.abs(u - v) < 0.12 && u > RU + 0.6 && u < 1.55) return Math.abs(u - v) > 0.07 ? NE.l : MAT.dark.r
      if (tier >= 3 && Math.abs(d - (BR + 0.45)) < 0.05) return Math.floor((Math.atan2(v - RV, u - RU) + Math.PI) * 9) % 2 ? '#f2c94c' : '#3b3242'
      if (r >= Hh - 1) return MAT.pad.hi
      const e = Math.min(c, r, W - 1 - c, Hh - 1 - r)
      if (e === 3) return '#f2c94c'
      if (c % 8 === 0 || r % 8 === 0) return MAT.pad.r
      return (Math.floor(c / 8) + Math.floor(r / 8)) % 2 ? MAT.pad.t : '#cd9770'
    },
  })

  // ── the ring berm of bulldozed regolith ──────────────────────────────
  for (let k = 0; k < 34; k++) {
    const a = (k / 34) * Math.PI * 2 - Math.PI
    if (Math.abs(a - GAP) < 0.28) continue
    const u = RU + Math.cos(a) * BR
    const v = RV + Math.sin(a) * BR
    s.ell(u, v, base, 9, 8, flat(BERM.t), { cut: 0, spec: false, pat: (_u, _v, nz, l) => (nz > 0.85 ? BERM.hi : band(BERM, l)) })
  }

  // ── the reactor in its pit ───────────────────────────────────────────
  const R0 = base - 2
  s.vcyl(RU, RV, 12, R0, base + 6, flat(GOLD.t), {
    lid: flat(GOLD.l),
    spec: false,
    pat: (nx, r, H, l) => (r === 0 ? GOLD.hi : Math.round(nx * 10 + r) % 4 === 0 ? GOLD.hi : band(GOLD, l)),
  })
  // white Stirling converter ring with an orange band
  s.vcyl(RU, RV, 10, base + 6, base + 11, flat(WHITE.t), {
    lid: flat(WHITE.t),
    spec: false,
    pat: (nx, r, H, l) => (r === 2 ? (l > 0.5 ? OR.t : OR.l) : Math.round((nx + 1) * 6) % 2 === 0 && r > 2 ? WHITE.r : band(WHITE, l)),
  })
  // the stepped converter housing, narrowing upward
  for (let k = 0; k < 3; k++)
    s.vcyl(RU, RV, 7 - k * 2, base + 11 + k * 3, base + 14 + k * 3, flat(NE.t), {
      lid: flat(NE.hi),
      spec: false,
      pat: (nx) => (nx < -0.3 ? NE.hi : nx < 0.3 ? NE.t : NE.l),
    })

  // ── the radiator cross on the mast, heat climbing the pipes ──────────
  const MZ0 = base + 14
  const MZ1 = tier >= 3 ? base + 44 : base + 36
  s.post(RU, RV, base + 20, MZ1 + 4, flat(NE.l))
  status(s, RU, RV, MZ1 + 5, 'red', blink)
  const climb = (z: number) => {
    const f = ((z - MZ0) / (MZ1 - MZ0) - t * 0.5) % 1
    return (f + 1) % 1 < 0.25
  }
  const panel = (axis: 'u' | 'v', sign: number) => {
    const span = 0.9
    const [u0, u1, v0, v1] = axis === 'u' ? (sign > 0 ? [RU + 0.08, RU + 0.08 + span, RV - 0.03, RV + 0.03] : [RU - 0.08 - span, RU - 0.08, RV - 0.03, RV + 0.03]) : sign > 0 ? [RU - 0.03, RU + 0.03, RV + 0.08, RV + 0.08 + span] : [RU - 0.03, RU + 0.03, RV - 0.08 - span, RV - 0.08]
    block(s, u0, u1, v0, v1, MZ0, MZ1, WHITE, {
      ground: false,
      // fins with a heat pipe up every fourth column, glowing as the heat climbs
      l: (c, r, w, h) => (r === 0 ? OR.hi : r === h - 1 ? NE.r : c % 4 === 1 ? (climb(MZ1 - r) ? HEAT[0] : HEAT[2]) : c % 2 ? WHITE.hi : WHITE.l),
      r: (c, r, w, h) => (r === 0 ? OR.l : c % 4 === 1 ? (climb(MZ1 - r) ? HEAT[1] : HEAT[2]) : c % 2 ? WHITE.l : WHITE.r),
    })
  }
  panel('u', -1)
  panel('u', 1)
  if (tier >= 2) {
    panel('v', -1)
    panel('v', 1)
  }
  // braces from the panels' tips down to the berm
  for (const [du, dv] of [
    [-1.0, 0],
    [1.0, 0],
    ...(tier >= 2 ? ([[0, -1.0], [0, 1.0]] as [number, number][]) : []),
  ])
    s.line(RU + du * 0.98, RV + dv * 0.98, MZ0, RU + du * 0.6, RV + dv * 0.6, base + 6, NE.l)

  // ── a trefoil sign at the berm ───────────────────────────────────────
  const SU = RU - 0.6
  const SV = RV + BR + 0.4
  s.post(SU, SV, base, base + 8, flat(NE.l))
  block(s, SU - 0.2, SU + 0.2, SV - 0.03, SV + 0.03, base + 8, base + 15, MAT.dark, {
    ground: false,
    l: (c, r, w, h) => {
      if (c === 0 || r === 0 || c === w - 1 || r === h - 1) return '#1b1622'
      const d = Math.hypot(c - (w - 1) / 2, r - (h - 1) / 2)
      if (d < 1) return '#1b1622'
      return d < 2.6 && Math.sin(Math.atan2(r - (h - 1) / 2, c - (w - 1) / 2) * 3) > 0.2 ? '#1b1622' : '#ffd24a'
    },
  })

  // ── the power-conditioning box at the front ──────────────────────────
  block(s, 1.35, 2.3, 1.3, 2.3, base, base + 14, WHITE, {
    l: all((c, r, w, h) => (r === 1 ? OR.t : r === h - 1 ? WHITE.lo : null), slats(2, 4, 6, 6), at(10, 4, 4, 4, (c, r, w, h) => (c === 0 || r === 0 || c === w - 1 || r === h - 1 ? FRAME : r < 2 ? '#7ee07a' : '#2f6a3a'))),
    r: all((c, r, w, h) => (r === 1 ? OR.l : r === h - 1 ? WHITE.lo : null), at(3, 4, 6, 9, door(0, 0, 6, 9, NE))),
    top: MAT.roof.t,
  })
  for (const [u, v] of [
    [1.5, 1.45],
    [2.15, 1.45],
  ]) {
    s.post(u, v, base + 14, base + 19, flat(NE.l))
    for (let k = 0; k < 3; k++) s.pt(u, v, base + 15 + k, k % 2 ? WHITE.l : WHITE.hi, false, 0.05)
  }
  s.flush()
}
