/**
 * Power pylon (1×1), clean isometric style, by level:
 *  1. a guyed telescoping mast with orange-and-white aviation bands;
 *  2. a lattice mast sprung from its white deployment canister;
 *  3. the same mast over a gold-foil transformer with radiator fins and white
 *     bushings.
 * The cables attach at the crossarm, PYLON_TOP px above the ground (the scene
 * draws them there, so the heights must not change).
 */
import type { Ctx } from '@/site/pixel/engine'
import { Iso, status } from '@/game/art/buildings/life'
import { PYLON_TOP } from '@/game/art/buildings/power'
import { block, flat, MAT, pad, type Mat } from './flat'

const WHITE: Mat = { t: '#f2ece4', l: '#ddd3cc', r: '#b6a6aa', hi: '#fffcf6', lo: '#8c7a83' }
const GOLD: Mat = { t: '#f3cf6a', l: '#d9ad45', r: '#a87a2e', hi: '#ffeaa6', lo: '#6e4c1e' }
const OR = MAT.crate
const NE = MAT.metal

export function pylonV2(ctx: Ctx, x: number, y: number, t: number, tier: number) {
  const s = new Iso(ctx, x, y, 0.5)
  const blink = (t * 1.5) % 1 < 0.4
  const base = 2
  pad(s, 0.47, base, MAT.pad, 8, false)
  const top = PYLON_TOP[tier - 1] + 1 // where the cables meet the crossarm

  // crossarm with two white insulators, and the beacon above
  const crossarm = (z: number) => {
    block(s, -0.28, 0.28, -0.03, 0.03, z - 1, z, NE, { ground: false, l: () => NE.t })
    for (const u of [-0.24, 0.24]) {
      for (let k = 0; k < 3; k++) s.pt(u, 0, z - 2 - k, k % 2 ? WHITE.l : WHITE.hi, false, 0.05)
    }
    s.lamp(0, 0, z + 3, blink ? '#ff6a5a' : '#8f2f3f', '#b03e53')
  }

  if (tier === 1) {
    // telescoping mast: three sections, each narrower, banded orange and white
    const sections = [
      [base, base + 12, 0.07],
      [base + 12, base + 22, 0.055],
      [base + 22, top, 0.04],
    ] as const
    for (const [z0, z1, h] of sections)
      block(s, -h, h, -h, h, z0, z1, WHITE, {
        ground: z0 === base,
        l: (c, r) => (Math.floor(r / 4) % 2 ? OR.t : WHITE.t),
        r: (c, r) => (Math.floor(r / 4) % 2 ? OR.r : WHITE.r),
      })
    // three guy wires down to anchors
    for (const [gu, gv] of [
      [-0.42, -0.42],
      [0.42, -0.1],
      [-0.1, 0.42],
    ]) {
      s.line(0, 0, base + 20, gu, gv, base, NE.hi)
      block(s, gu - 0.04, gu + 0.04, gv - 0.04, gv + 0.04, base, base + 1, OR)
    }
    crossarm(top)
  } else {
    // the deployment canister, white with an orange band
    const CZ = base + 9
    block(s, -0.2, 0.2, -0.2, 0.2, base, CZ, WHITE, {
      l: (c, r, w, h) => (r === 0 ? WHITE.hi : r === 2 || r === 3 ? OR.t : r === h - 1 ? WHITE.lo : null),
      r: (c, r, w, h) => (r === 2 || r === 3 ? OR.l : r === h - 1 ? WHITE.lo : null),
      top: NE.t,
    })
    status(s, 0.21, 0, CZ - 3, 'green', true)
    // level 3: the gold-foil transformer it stands on, with fins and bushings
    let mastBase = CZ
    if (tier >= 3) {
      block(s, -0.42, 0.42, -0.42, 0.42, base, base + 7, GOLD, {
        l: (c, r, w, h) => (r === 0 ? GOLD.hi : c % 2 && r > 1 && r < h - 1 ? GOLD.r : null),
        r: (c, r, w, h) => (c % 2 && r > 1 && r < h - 1 ? GOLD.lo : null),
        top: NE.t,
      })
      for (const [bu, bv] of [
        [0.3, -0.3],
        [-0.3, 0.3],
      ])
        for (let k = 0; k < 4; k++) s.pt(bu, bv, base + 8 + k, k % 2 ? WHITE.l : WHITE.hi, false, 0.05)
      mastBase = CZ
    }
    // the coilable lattice mast: three longerons with zig-zag battens
    const legs = [
      [-0.12, -0.08],
      [0.12, -0.08],
      [0, 0.12],
    ] as const
    for (const [lu, lv] of legs) s.line(lu, lv, mastBase, lu * 0.6, lv * 0.6, top - 1, NE.hi)
    for (let z = mastBase + 3, k = 0; z < top - 2; z += 3, k++) {
      const f = (z - mastBase) / (top - 1 - mastBase)
      const a = legs[k % 3]
      const b = legs[(k + 1) % 3]
      const sc = 1 - 0.4 * f
      s.line(a[0] * sc, a[1] * sc, z, b[0] * sc, b[1] * sc, z + 3, k % 2 ? NE.l : NE.t)
    }
    crossarm(top)
  }
  s.flush()
}
