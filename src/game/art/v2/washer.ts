/**
 * Soil washer (4×4), clean isometric style. At the back, the big inflatable
 * water reservoir: a soft round fabric dome on the ground, held down by straps
 * and a ring of sandbags, with a white ribbed pressure tank and sight glass
 * beside it. In front, the wash line: a regolith hopper feeds a perforated
 * trommel with orange rib rings that turns under a misting spray bar; washed
 * soil drops onto a shaking sieve deck, and a conveyor carries the clean dark
 * soil to a heap. Dirty rinse water settles in a basin with a pump at the
 * right. Level 2 adds a second spray bar and a filter skid, level 3 a second
 * pressure tank.
 */
import type { Ctx } from '@/site/pixel/engine'
import { all, at, Iso, KZ, PXT, status } from '@/game/art/buildings/life'
import { block, crate, flat, FRAME, MAT, pad, slats, type Mat } from './flat'

const WHITE: Mat = { t: '#f2ece4', l: '#ddd3cc', r: '#b6a6aa', hi: '#fffcf6', lo: '#8c7a83' }
const FAB: Mat = { t: '#eef2f2', l: '#d4dcde', r: '#a9b2ba', hi: '#ffffff', lo: '#7f8790' }
const STRAP: Mat = { t: '#c5b9b2', l: '#a99b94', r: '#82737a', hi: '#dcd2ca', lo: '#5f5059' }
const BAG: Mat = { t: '#e3c7a3', l: '#cda884', r: '#a07c67', hi: '#f1dcbf', lo: '#73534a' }
const WATER = ['#2e6f9e', '#4c97c9', '#8fd0f0', '#d7f1fb'] as const
const MURK = ['#7a5a48', '#9a7660', '#b8927a'] as const
const REG = ['#9e5836', '#c07448', '#d99862'] as const
const SOIL = ['#3d2c22', '#5a4030', '#765440', '#94705a'] as const
const OR = MAT.crate
const NE = MAT.metal
const band = (m: Mat, l: number) => (l > 0.86 ? m.hi : l > 0.64 ? m.t : l > 0.44 ? m.l : m.r)

export function washerV2(ctx: Ctx, x: number, y: number, t: number, tier: number) {
  const s = new Iso(ctx, x, y, 0.5)
  const blink = (t * 1.5) % 1 < 0.4
  const base = 3
  const H = 1.96

  // ── pad with the settling basin sunk into its right side ─────────────
  const BAS = { u0: 0.75, u1: 1.85, v0: -0.95, v1: 0.2 }
  block(s, -H, H, -H, H, 0, base, MAT.pad, {
    t: (c, r, W, Hh) => {
      const u = (c + 0.5) / 16 - H
      const v = (r + 0.5) / 16 - H
      if (u > BAS.u0 && u < BAS.u1 && v > BAS.v0 && v < BAS.v1) {
        const e = Math.min(u - BAS.u0, BAS.u1 - u, v - BAS.v0, BAS.v1 - v)
        if (e < 0.05) return NE.t // concrete lip
        if (e < 0.09) return (u - BAS.u0 < 0.09 || v - BAS.v0 < 0.09) ? NE.r : NE.l // inner wall
        // murky water clearing toward the outlet, ripples moving
        const ripple = Math.floor((u * 20 + v * 9 + t * 6) % 7) === 0
        return ripple ? MURK[2] : u > 1.4 ? WATER[1] : MURK[(c + r) % 2]
      }
      if (r >= Hh - 1) return MAT.pad.hi
      const e = Math.min(c, r, W - 1 - c, Hh - 1 - r)
      if (e === 3) return '#f2c94c'
      if (c % 8 === 0 || r % 8 === 0) return MAT.pad.r
      return (Math.floor(c / 8) + Math.floor(r / 8)) % 2 ? MAT.pad.t : '#cd9770'
    },
  })
  // the basin's pump
  block(s, 1.55, 1.9, 0.3, 0.65, base, base + 7, WHITE, {
    l: all((c, r, w, h) => (r === 1 ? OR.t : r === h - 1 ? WHITE.lo : null), at(2, 3, 1, 1, '#7ee07a')),
    r: slats(1, 2, 4, 4),
    top: MAT.roof.t,
  })

  // ── back left: the inflatable water reservoir ────────────────────────
  const RU = -1.0
  const RV = -1.0
  const RX = 21
  s.vcyl(RU, RV, RX + 2, base, base + 3, flat(NE.l), { lid: flat(NE.t), spec: false, pat: (nx, r) => (r === 0 ? NE.hi : nx < -0.4 ? NE.t : nx < 0.35 ? NE.l : NE.r) })
  s.ell(RU, RV, base + 3, RX, 19, flat(FAB.t), {
    cut: 0,
    spec: false,
    pat: (nu, nv, nz, l) => {
      const az = Math.atan2(nv, nu)
      const ca = Math.sqrt(Math.max(0, 1 - nz * nz))
      const q = (az + Math.PI) / (Math.PI / 4)
      const strap = Math.abs(q - Math.round(q)) * (Math.PI / 4) * ca * RX < 1.05 && nz < 0.93
      const belt = Math.abs(nz - 0.5) < 0.035
      if (strap && belt) return l > 0.5 ? OR.t : OR.l
      if (strap || belt) return band(STRAP, l)
      // a water-level window band and a stencilled H2O drop on the front
      if (nz > 0.18 && nz < 0.32 && Math.abs(az - Math.PI / 4) * ca * RX < 6) return nz < 0.21 || nz > 0.29 ? FRAME : nz < 0.25 ? WATER[1] : WATER[2]
      return band(FAB, l)
    },
  })
  const BR = RX / PXT + 0.22
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2
    const u = RU + Math.cos(a) * BR
    const v = RV + Math.sin(a) * BR
    if (Math.abs(u) > 1.9 || Math.abs(v) > 1.9) continue
    s.ell(u, v, base + 2, 4, 2.5, flat(BAG.t), { cut: -2, spec: false, pat: (_u, _v, nz, l) => (nz < 0.28 ? BAG.lo : nz > 0.75 && l > 0.5 ? BAG.hi : band(BAG, l)) })
  }

  // ── back right: the ribbed pressure tank(s) with a sight glass ───────
  const tank = (tu: number, tv: number) => {
    s.vcyl(tu, tv, 8, base, base + 26, flat(WHITE.t), {
      lid: flat(WHITE.hi),
      spec: false,
      pat: (nx, r, Hh, l) => {
        if (nx > -0.62 && nx < -0.38 && r > 3 && r < Hh - 3) return nx < -0.58 || nx > -0.42 ? FRAME : r < Hh * 0.45 ? '#3e3a5d' : nx < -0.5 ? WATER[2] : WATER[1]
        if (r % 6 === 0) return band(WHITE, l - 0.25)
        if (r === 2 || r === 3) return l > 0.5 ? OR.t : OR.l
        return band(WHITE, l)
      },
    })
    status(s, tu + 0.25, tv + 0.25, base + 22, 'green', true)
  }
  tank(0.75, -1.55)
  if (tier >= 3) tank(1.45, -1.55)
  // pipe from the reservoir over to the spray bar
  block(s, -0.15, 0.08, -0.4, 0.6, base + 15, base + 17, NE, { ground: false, l: (c, r) => (r === 0 ? NE.hi : null) })
  s.post(0.0, -0.3, base, base + 15, flat(NE.l))

  // ── front: hopper → trommel → sieve → conveyor → clean soil heap ─────
  const TV = 0.85
  const TR = 0.34
  const TZ = base + 5 + TR * KZ
  const T0 = -1.2
  const T1 = 0.6
  const spin = t * 5
  // regolith hopper on legs at the feed end
  for (const [du, dv] of [
    [-0.22, -0.22],
    [0.22, -0.22],
    [-0.22, 0.22],
    [0.22, 0.22],
  ])
    s.post(-1.5 + du, TV + dv, base, TZ + 2, flat(NE.l))
  for (let k = 0; k < 3; k++) {
    const half = 0.14 + k * 0.08
    block(s, -1.5 - half, -1.5 + half, TV - half, TV + half, TZ + 2 + k * 3, TZ + 5 + k * 3, NE, {
      ground: false,
      l: (c, r) => (r === 0 ? NE.hi : null),
      t: k === 2 ? (c, r, w, h) => (c < 2 || r < 2 || c > w - 3 || r > h - 3 ? NE.t : REG[(c + r * 2) % 3]) : undefined,
    })
  }
  // stands and the perforated trommel
  for (const u of [-0.9, 0.3]) block(s, u - 0.1, u + 0.1, TV - 0.28, TV + 0.28, base, base + 5, NE)
  s.hcyl('u', T0, T1, TV, TZ, TR, flat(NE.t), {
    pat: (s0, th, l) => {
      if (Math.round(s0) % 7 === 0) return l > 0.5 ? OR.t : OR.l // rib rings
      const hole = (Math.round(s0) + Math.round((th + spin) * 6)) % 3 === 0
      return hole ? MAT.dark.r : l > 0.7 ? NE.hi : l > 0.5 ? NE.t : NE.l
    },
    cap: (rr) => (rr > 0.8 ? OR.l : MAT.dark.l),
  })
  // the spray bar and its mist
  const bars = tier >= 2 ? [TV - 0.15, TV + 0.15] : [TV]
  for (const bv of bars) {
    block(s, T0 + 0.1, T1 - 0.1, bv - 0.03, bv + 0.03, TZ + TR * KZ + 3, TZ + TR * KZ + 4, NE, { ground: false })
    for (let k = 0; k < 10; k++) {
      const u = T0 + 0.2 + k * 0.16
      const fall = (t * 10 + k * 1.7) % 4
      s.pt(u, bv, TZ + TR * KZ + 2 - fall, fall < 2 ? WATER[3] : WATER[2], false, 0.2)
    }
  }
  // shaking sieve deck after the trommel
  const shake = Math.round(Math.sin(t * Math.PI * 8))
  block(s, 0.75, 1.3, TV - 0.25, TV + 0.25, base + 3 + (shake > 0 ? 1 : 0), base + 5 + (shake > 0 ? 1 : 0), NE, {
    ground: false,
    t: (c, r) => (c % 2 === 0 || r % 2 === 0 ? NE.hi : SOIL[2]),
  })
  for (const [u, v] of [
    [0.8, TV - 0.2],
    [1.25, TV - 0.2],
    [0.8, TV + 0.2],
    [1.25, TV + 0.2],
  ])
    s.post(u, v, base, base + 3, flat(NE.l))
  // conveyor to the clean soil heap
  for (let f = 0; f <= 1; f += 0.02) {
    const u = 1.3 + f * 0.2
    const v = TV + 0.2 + f * 0.6
    const z = base + 4 + f * 3
    s.pt(u - 0.05, v, z, NE.t, false, 0.02)
    s.pt(u, v, z + 1, Math.floor(f * 20 - t * 10) % 3 === 0 ? SOIL[3] : MAT.dark.l, false, 0.03)
  }
  s.ell(1.45, 1.55, base, 13, 9, flat(SOIL[2]), {
    cut: 0,
    spec: false,
    pat: (nu, nv, _nz, l) => (Math.sin(nu * 8) * Math.cos(nv * 7) > 0.6 ? SOIL[3] : l > 0.75 ? SOIL[3] : l > 0.5 ? SOIL[2] : l > 0.38 ? SOIL[1] : SOIL[0]),
  })

  // level 2: a filter skid by the basin
  if (tier >= 2)
    block(s, 0.85, 1.4, 0.35, 0.6, base, base + 9, WHITE, {
      l: (c, r, w, h) => (r === 1 ? MAT.green.l : r === h - 1 ? WHITE.lo : c % 3 === 1 && r > 3 && r < h - 2 ? WATER[1] : null),
      top: MAT.roof.t,
    })
  status(s, -1.5, TV + 0.35, TZ + 2, 'red', blink)
  crate(s, -1.85, 1.45, 0.3, base)
  s.flush()
}
