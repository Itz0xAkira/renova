/**
 * Ice melter (3×3), clean isometric style. The same plant with room: a white
 * ribbed pressure vessel standing on a gold-foil heater jacket with a glowing
 * heater seam, a sight glass up its lit side showing the water `level`, an ice
 * hopper and an orange handrail on its domed head, and a relief valve puffing
 * steam. Out front, the fabric water bladder strapped down to the pad swells as
 * the tank fills, fed by an insulated pipe. On the left, the white control
 * module with a warm window and a hatch; at the back, an ice conveyor feeding
 * the hopper. Level 2 adds a heat-exchanger radiator, level 3 a second bladder.
 */
import type { Ctx } from '@/site/pixel/engine'
import { all, at, Iso, PXT, status } from '@/game/art/buildings/life'
import { block, crate, door, flat, FRAME, MAT, pad, slats, win, type Mat } from './flat'

const WHITE: Mat = { t: '#f2ece4', l: '#ddd3cc', r: '#b6a6aa', hi: '#fffcf6', lo: '#8c7a83' }
const GOLD: Mat = { t: '#f3cf6a', l: '#d9ad45', r: '#a87a2e', hi: '#ffeaa6', lo: '#6e4c1e' }
const STRAP: Mat = { t: '#c5b9b2', l: '#a99b94', r: '#82737a', hi: '#dcd2ca', lo: '#5f5059' }
const BLADDER: Mat = { t: '#bfe0ee', l: '#98c9de', r: '#6f9fba', hi: '#e6f6fc', lo: '#4c7590' }
const WATER = ['#2e6f9e', '#4c97c9', '#8fd0f0'] as const
const ICE = ['#e9f8ff', '#bfe6f7', '#8fcbe6'] as const
const STEAM = ['#ffffff', '#e6eef4', '#c9d6e0'] as const
const OR = MAT.crate
const NE = MAT.metal
const band = (m: Mat, l: number) => (l > 0.86 ? m.hi : l > 0.64 ? m.t : l > 0.44 ? m.l : m.r)

export function melterV2(ctx: Ctx, x: number, y: number, t: number, level: number, tier: number) {
  const s = new Iso(ctx, x, y, 0.5)
  const blink = (t * 1.5) % 1 < 0.4
  const base = 3
  pad(s, 1.47, base)

  const TU = -0.15
  const TV = -0.3
  const R = 15
  const J1 = base + 9 // top of the heater jacket
  const T1 = base + 30 // top of the vessel wall

  // ── back: the ice conveyor up to the hopper ──────────────────────────
  const C0 = [0.9, -1.3, base + 2] as const
  const C1 = [TU + 0.1, TV - 0.15, T1 + 12] as const
  for (let f = 0; f <= 1; f += 0.015) {
    const u = C0[0] + (C1[0] - C0[0]) * f
    const v = C0[1] + (C1[1] - C0[1]) * f
    const z = C0[2] + (C1[2] - C0[2]) * f
    s.pt(u, v - 0.06, z, NE.l, false, 0.02)
    s.pt(u, v + 0.06, z, NE.t, false, 0.02)
    // ice cubes riding up
    s.pt(u, v, z + 1, Math.floor(f * 30 - t * 10) % 4 === 0 ? ICE[0] : MAT.dark.l, false, 0.03)
    if (Math.round(f * 66) % 22 === 0 && f < 0.9) s.post(u, v, base, z, flat(NE.l))
  }
  block(s, 0.75, 1.3, -1.42, -1.05, base, base + 6, NE, { t: (c, r) => ((c + r) % 3 ? ICE[1] : ICE[0]) })

  // level 2: a heat-exchanger radiator on the right
  if (tier >= 2) {
    block(s, 1.3, 1.38, -0.9, 0.35, base + 2, base + 22, WHITE, {
      ground: false,
      l: () => WHITE.l,
      r: (c, r, w, h) => (r === 0 ? OR.l : r === h - 1 ? NE.r : c % 2 ? WHITE.hi : WHITE.r),
    })
    for (const v of [-0.8, 0.25]) s.post(1.34, v, base, base + 2, flat(NE.l))
    for (const z of [base + 8, base + 14]) block(s, 0.6, 1.3, -0.3, -0.24, z, z + 2, NE, { ground: false })
  }

  // ── the vessel ───────────────────────────────────────────────────────
  // gold-foil heater jacket with a glowing seam
  const heat = 0.5 + 0.5 * Math.sin(t * Math.PI * 2)
  s.vcyl(TU, TV, R + 2, base, J1, flat(GOLD.t), {
    lid: flat(NE.t),
    spec: false,
    pat: (nx, r, H, l) => {
      if (r === H - 3) return heat > 0.5 ? '#ffd27a' : '#ff9d5a'
      if (r === 0) return NE.hi
      return Math.round(nx * 12 + r * 0.6) % 5 === 0 ? GOLD.hi : band(GOLD, l)
    },
  })
  // the ribbed white wall with its sight glass
  s.vcyl(TU, TV, R, J1, T1, flat(WHITE.t), {
    lid: false,
    spec: false,
    pat: (nx, r, H, l) => {
      // sight glass: a framed strip on the lit side, water to `level`
      if (nx > -0.62 && nx < -0.4) {
        if (nx < -0.58 || nx > -0.44 || r < 2 || r > H - 3) return FRAME
        const fill = 2 + (H - 5) * (1 - level)
        if (r < fill) return '#3e3a5d'
        return r < fill + 1 ? WATER[2] : nx < -0.5 ? WATER[1] : WATER[0]
      }
      if (r % 6 === 0) return band(WHITE, l - 0.25)
      if (r === 2 || r === 3) return l > 0.5 ? OR.t : OR.l
      // a stencilled H2O plate
      if (r > 8 && r < 12 && nx > -0.1 && nx < 0.2) return (r === 9 || r === 11) && Math.round(nx * 20) % 2 ? MAT.dark.r : WHITE.hi
      return band(WHITE, l)
    },
  })
  // domed head, orange handrail ring, the ice hopper
  s.ell(TU, TV, T1, R, 6, flat(WHITE.t), { cut: 0, spec: false, pat: (_u, _v, nz, l) => (nz < 0.15 ? (l > 0.5 ? OR.t : OR.l) : band(WHITE, l)) })
  const RR = (R - 2) / PXT
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2
    const u = TU + Math.cos(a) * RR
    const v = TV + Math.sin(a) * RR
    s.pt(u, v, T1 + 6, OR.t, false, 0.02)
    if (k % 4 === 0) for (const z of [3, 4, 5]) s.pt(u, v, T1 + z, OR.l, false, 0.02)
  }
  for (let k = 0; k < 3; k++) {
    const half = 0.12 + k * 0.06
    block(s, TU - half, TU + half, TV - half, TV + half, T1 + 4 + k * 2, T1 + 6 + k * 2, NE, {
      ground: false,
      l: (c, r) => (r === 0 ? NE.hi : null),
      t: k === 2 ? (c, r, w, h) => (c < 2 || r < 2 || c > w - 3 || r > h - 3 ? NE.t : (c + r) % 3 ? ICE[1] : ICE[0]) : undefined,
    })
  }
  // relief valve puffing steam
  s.post(TU + 0.35, TV + 0.2, T1 + 2, T1 + 7, flat(NE.l))
  s.pt(TU + 0.35, TV + 0.2, T1 + 7, OR.t, false, 0.05)
  if (t > 0)
    for (let k = 0; k < 4; k++) {
      const rise = (t * 4 + k * 1.6) % 8
      s.pt(TU + 0.35 + rise * 0.01, TV + 0.2, T1 + 9 + rise, STEAM[rise > 5 ? 2 : rise > 2 ? 1 : 0], false, 0.3)
      if (rise > 4) s.pt(TU + 0.38 + rise * 0.01, TV + 0.2, T1 + 9 + rise, STEAM[2], false, 0.3)
    }
  status(s, TU + 0.55, TV + 0.45, J1 + 2, 'green', true)

  // ── front: the water bladder, swelling as the tank fills ─────────────
  const bladder = (bu: number, bv: number, size: number) => {
    const rx = 9 + size * 5
    const hz = 3 + size * 4
    s.ell(bu, bv, base, rx, hz, flat(BLADDER.t), {
      cut: 0,
      spec: false,
      pat: (nu, nv, nz, l) => {
        // two restraint straps across it
        if (Math.abs(nu) < 0.08 || Math.abs(nv) < 0.08) return band(STRAP, l)
        if (nz > 0.85) return BLADDER.hi
        return band(BLADDER, l)
      },
    })
    for (const [du, dv] of [
      [rx / PXT, 0],
      [-rx / PXT, 0],
      [0, rx / PXT],
      [0, -rx / PXT],
    ])
      block(s, bu + du - 0.04, bu + du + 0.04, bv + dv - 0.04, bv + dv + 0.04, base, base + 2, OR)
  }
  bladder(0.7, 0.85, level)
  if (tier >= 3) bladder(-0.2, 1.05, Math.max(0, level - 0.3))
  // insulated feed pipe from the tank to the bladder
  for (let f = 0; f <= 1; f += 0.02) {
    const u = TU + 0.6 + (0.7 - TU - 0.6) * f
    const v = TV + 0.6 + (0.85 - 0.5 - TV - 0.6) * f
    s.pt(u, v, base + 3, GOLD.l, false, 0.02)
    s.pt(u, v, base + 4, GOLD.t, false, 0.02)
  }

  // ── left: the control module ─────────────────────────────────────────
  block(s, -1.38, -0.75, 0.25, 1.35, base, base + 13, WHITE, {
    l: all((c, r, w, h) => (r === 1 ? OR.t : r === h - 1 ? WHITE.lo : null), at(2, 4, 6, 5, win(0, 0, 6, 5, true))),
    r: all((c, r, w, h) => (r === 1 ? OR.l : r === h - 1 ? WHITE.lo : null), at(3, 4, 6, 9, door(0, 0, 6, 9, NE)), slats(11, 4, 5, 6), at(13, 11, 1, 1, blink ? '#ff6a5a' : '#8f2f3f')),
    top: MAT.roof.t,
  })
  s.vcyl(-1.1, 0.6, 2, base + 13, base + 18, flat(NE.l), { lid: flat(MAT.dark.r), spec: false })
  crate(s, -1.3, -1.3, 0.3, base)
  s.flush()
}
