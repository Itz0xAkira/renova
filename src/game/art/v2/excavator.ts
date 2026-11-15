/**
 * Excavator (3×3), clean isometric style: a fixed regolith mine, not a vehicle.
 * A terraced dig pit is cut into the front right of the pad. Over it stands a
 * gantry of two A-frames carrying a bucket-chain elevator: orange buckets ride
 * down into the pit and back up, tipping regolith into a chute that runs to the
 * hopper on top of a white processing house (vents, an orange band, lit
 * windows). A stacker belt carries the sorted regolith out to a stockpile at
 * the left corner, and a small control cabin watches the pit from the back.
 * Level 2 adds solar panels on the house roof, level 3 a comms mast and
 * floodlights on the gantry.
 */
import type { Ctx } from '@/site/pixel/engine'
import { all, at, Iso, status } from '@/game/art/buildings/life'
import { block, crate, door, flat, FRAME, LIT, LIT_HI, MAT, slats, win, type Mat } from './flat'

const WHITE: Mat = { t: '#f2ece4', l: '#ddd3cc', r: '#b6a6aa', hi: '#fffcf6', lo: '#8c7a83' }
const SOIL = ['#5a2b1f', '#7d4029', '#9e5836', '#c07448', '#d99862'] as const
const SOLAR = ['#2f3a63', '#46558a', '#6c7fb8'] as const
const OR = MAT.crate
const NE = MAT.metal

export function excavatorV2(ctx: Ctx, x: number, y: number, t: number, tier: number) {
  const s = new Iso(ctx, x, y, 0.5)
  const blink = (t * 1.5) % 1 < 0.4
  const base = 3
  const H = 1.47

  // ── the pad, with a terraced dig pit cut into its front right ─────────
  const PIT = { u0: 0.3, u1: 1.42, v0: -0.7, v1: 1.1 }
  block(s, -H, H, -H, H, 0, base, MAT.pad, {
    t: (c, r, W, Hh) => {
      const u = (c + 0.5) / 16 - H
      const v = (r + 0.5) / 16 - H
      if (u > PIT.u0 && u < PIT.u1 && v > PIT.v0 && v < PIT.v1) {
        const e = Math.min(u - PIT.u0, PIT.u1 - u, v - PIT.v0, PIT.v1 - v)
        if (e < 0.04) return OR.t // painted safety edge
        const step = Math.min(3, Math.floor(e / 0.12))
        const wall = (u - PIT.u0) % 0.12 < 0.04 || (v - PIT.v0) % 0.12 < 0.04
        return wall && step < 3 ? SOIL[Math.max(0, 2 - step) + 1] : SOIL[Math.max(0, 3 - step)]
      }
      if (r >= Hh - 1) return MAT.pad.hi
      const e = Math.min(c, r, W - 1 - c, Hh - 1 - r)
      if (e === 3) return '#f2c94c'
      if (c % 8 === 0 || r % 8 === 0) return MAT.pad.r
      return (Math.floor(c / 8) + Math.floor(r / 8)) % 2 ? MAT.pad.t : '#cd9770'
    },
  })
  for (let k = 0; k < 9; k++) s.pt(0.5 + ((k * 0.37) % 0.8), -0.45 + ((k * 0.53) % 1.3), base + 1, k % 2 ? SOIL[4] : SOIL[2], false, 0.01)

  // ── control cabin at the back right, watching the pit ────────────────
  block(s, 0.45, 1.32, -1.4, -0.85, base, base + 12, WHITE, {
    l: all((c, r, w, h) => (r === 1 ? OR.t : r === h - 1 ? WHITE.lo : null), at(2, 3, 9, 5, (c, r, w, h) => (c === 0 || r === 0 || c === w - 1 || r === h - 1 || c === 4 ? FRAME : r === 1 ? LIT_HI : LIT))),
    r: all((c, r, w, h) => (r === 1 ? OR.l : r === h - 1 ? WHITE.lo : null), at(2, 3, 4, 8, door(0, 0, 4, 8, NE))),
    top: MAT.roof.t,
  })
  s.post(1.2, -1.3, base + 12, base + 20, flat(NE.l))
  status(s, 1.2, -1.3, base + 21, 'red', blink)

  // ── processing house with the hopper on top ──────────────────────────
  const HZ = base + 16
  block(s, -1.38, 0.1, -1.38, -0.2, base, HZ, WHITE, {
    l: all((c, r, w, h) => (r === 1 ? OR.t : r === h - 1 ? WHITE.lo : c % 8 === 0 && c > 0 ? WHITE.r : null), at(3, 4, 6, 6, win(0, 0, 6, 6, true)), slats(12, 4, 8, 7), at(20, 9, 1, 1, '#7ee07a')),
    r: all((c, r, w, h) => (r === 1 ? OR.l : r === h - 1 ? WHITE.lo : null), at(3, 5, 6, 10, door(0, 0, 6, 10, NE)), slats(11, 4, 6, 7)),
    top: MAT.roof.t,
  })
  // the hopper: a funnel of steel rings widening upward, regolith heaped inside
  const HU = -0.65
  const HV = -0.8
  for (let k = 0; k < 4; k++) {
    const half = 0.18 + k * 0.07
    block(s, HU - half, HU + half, HV - half, HV + half, HZ + k * 2, HZ + k * 2 + 2, NE, {
      ground: false,
      l: (c, r) => (r === 0 ? NE.hi : k === 3 && c % 4 === 0 ? NE.r : null),
      t: k === 3 ? (c, r, w, h) => (c < 2 || r < 2 || c > w - 3 || r > h - 3 ? NE.t : (c + r) % 5 === 0 ? SOIL[4] : SOIL[3]) : undefined,
    })
  }
  // level 2: solar panels on the house roof
  if (tier >= 2)
    block(s, -1.3, -1.05, -0.95, -0.28, HZ, HZ + 2, NE, {
      ground: false,
      t: (c, r, w, h) => (c === 0 || r === 0 || c === w - 1 || r === h - 1 ? NE.hi : r % 4 === 0 ? SOLAR[2] : (c + r) % 7 === 0 ? SOLAR[1] : SOLAR[0]),
    })

  // ── the gantry over the pit, carrying the bucket-chain elevator ───────
  const GU = 0.86
  const GZ = base + 26
  for (const gv of [-0.55, 0.95]) {
    // an A-frame: two legs meeting at the top, a cross tie
    s.line(GU - 0.38, gv, base, GU, gv, GZ, NE.t)
    s.line(GU - 0.38 + 1 / 32, gv, base, GU + 1 / 32, gv, GZ, NE.l)
    s.line(GU + 0.38, gv, base, GU, gv, GZ, NE.r)
    s.line(GU - 0.19, gv, base + 13, GU + 0.19, gv, base + 13, NE.l)
    block(s, GU - 0.42, GU - 0.3, gv - 0.06, gv + 0.06, base, base + 2, NE)
    block(s, GU + 0.3, GU + 0.42, gv - 0.06, gv + 0.06, base, base + 2, NE)
  }
  // the beam along the top, orange
  block(s, GU - 0.06, GU + 0.06, -0.6, 1.0, GZ, GZ + 3, OR, { ground: false })
  // the elevator: a loop of chain down into the pit, buckets riding it
  const EV = 0.2
  const bottom = base - 1
  for (let z = bottom; z <= GZ; z++) {
    s.pt(GU - 0.1, EV, z, NE.hi, false, 0.04)
    s.pt(GU + 0.1, EV, z, NE.r, false, 0.04)
  }
  const len = (GZ - bottom) * 2
  for (let k = 0; k < 6; k++) {
    const p = (t * 8 + (k * len) / 6) % len
    const down = p < GZ - bottom
    const z = down ? GZ - p : bottom + (p - (GZ - bottom))
    const u = down ? GU - 0.1 : GU + 0.1
    block(s, u - 0.06, u + 0.06, EV - 0.07, EV + 0.07, z - 1.5, z + 1.5, OR, { ground: false, t: () => (down ? OR.t : SOIL[3]) })
  }
  s.vcyl(GU, EV, 3, GZ + 1, GZ + 3, flat(NE.l), { lid: flat(OR.t), spec: false })
  // chute from the head of the elevator down to the hopper, regolith sliding
  const chute = (f: number) => [GU - 0.05 + (HU - GU + 0.05) * f, EV + (HV - EV) * f, GZ - (GZ - HZ - 8) * f] as const
  for (let f = 0; f <= 1; f += 0.015) {
    const [u, v, z] = chute(f)
    s.pt(u, v, z, NE.l, false, 0.03)
    s.pt(u, v, z + 1, Math.floor(f * 30 + t * 10) % 3 === 0 ? SOIL[4] : SOIL[2], false, 0.03)
  }
  // dust where the buckets bite
  if (t > 0)
    for (let k = 0; k < 5; k++) {
      const rise = (t * 5 + k * 1.3) % 6
      s.pt(GU + 0.15 + k * 0.03, EV + 0.15 - k * 0.04, base + rise, rise > 3 ? SOIL[4] : SOIL[3], false, 0.3)
    }
  if (tier >= 3) {
    s.post(GU, -0.55, GZ + 3, GZ + 14, flat(NE.l))
    status(s, GU, -0.55, GZ + 15, 'red', blink)
    for (const v of [0.4, 0.75]) s.lamp(GU + 0.08, v, GZ - 1, '#ffffff', LIT)
  }

  // ── stacker belt out to the stockpile at the left corner ─────────────
  const P0 = [-0.95, -0.2, base + 10] as const
  const P1 = [-1.05, 0.72, base + 13] as const
  for (let f = 0; f <= 1; f += 0.02) {
    const u = P0[0] + (P1[0] - P0[0]) * f
    const v = P0[1] + (P1[1] - P0[1]) * f
    const z = P0[2] + (P1[2] - P0[2]) * f
    s.pt(u - 0.06, v, z, NE.t, false, 0.02)
    s.pt(u + 0.06, v, z, NE.r, false, 0.02)
    s.pt(u, v, z + 1, Math.floor(f * 30 - t * 10) % 3 === 0 ? SOIL[3] : MAT.dark.l, false, 0.03)
    if (Math.round(f * 50) % 24 === 0) s.post(u, v, base, z, flat(NE.l))
  }
  s.ell(-1.0, 1.0, base, 11, 9, flat(SOIL[3]), {
    cut: 0,
    spec: false,
    pat: (nu, nv, _nz, l) => (Math.sin(nu * 7) * Math.cos(nv * 6) > 0.6 ? SOIL[l > 0.6 ? 4 : 2] : l > 0.8 ? SOIL[4] : l > 0.55 ? SOIL[3] : l > 0.4 ? SOIL[2] : SOIL[1]),
  })
  crate(s, -0.3, 0.9, 0.28, base)
  crate(s, -0.25, 1.2, 0.24, base)
  s.flush()
}
