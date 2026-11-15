/**
 * Smelter (4×4), clean isometric style. The same works with room: a white
 * furnace hall whose lit face carries the "furnace eye", a big round port
 * glowing with the melt; a gold-foil crucible dome on its roof, ducted to a
 * white stack with orange day-marker bands (a second stack from level 2); a
 * heat-rejection radiator wing at the back, glowing at its root; an ore hopper
 * on legs fed by an inclined belt; and out front the casting line, where poured
 * ingots slide along cooling from orange to silver and stack on a pallet.
 * Level 3 adds a small gantry crane over the pallet.
 */
import type { Ctx } from '@/site/pixel/engine'
import { all, at, Iso, status } from '@/game/art/buildings/life'
import { block, crate, door, flat, FRAME, LIT, LIT_HI, MAT, pad, slats, win, type Mat } from './flat'

const WHITE: Mat = { t: '#f2ece4', l: '#ddd3cc', r: '#b6a6aa', hi: '#fffcf6', lo: '#8c7a83' }
const GOLD: Mat = { t: '#f3cf6a', l: '#d9ad45', r: '#a87a2e', hi: '#ffeaa6', lo: '#6e4c1e' }
const ORE = ['#4a2626', '#6e3434', '#98544a', '#b8705e'] as const
const SMOKE = ['#e2dcd8', '#bdb3b3', '#948a8e'] as const
const MELT = ['#fff3c4', '#ffd27a', '#ff9d5a', '#e2703a', '#a8441f'] as const
const SILVER = ['#e8eaf0', '#bfc3d0', '#8d92a6'] as const
const OR = MAT.crate
const NE = MAT.metal
const band = (m: Mat, l: number) => (l > 0.86 ? m.hi : l > 0.64 ? m.t : l > 0.44 ? m.l : m.r)

export function smelterV2(ctx: Ctx, x: number, y: number, t: number, tier: number) {
  const s = new Iso(ctx, x, y, 0.5)
  const blink = (t * 1.5) % 1 < 0.4
  const flick = 0.5 + 0.5 * Math.sin(t * Math.PI * 6)
  const base = 3
  pad(s, 1.96, base)

  // ── back: radiator wing, glowing at its root ─────────────────────────
  block(s, -0.4, 1.85, -1.95, -1.88, base + 3, base + 24, WHITE, {
    ground: false,
    l: (c, r, w, h) => (r === 0 ? OR.hi : r >= h - 3 ? (r === h - 1 ? MELT[3] : MELT[2]) : c % 3 === 0 ? WHITE.r : c % 3 === 1 ? WHITE.hi : WHITE.l),
    r: () => NE.r,
  })
  for (const u of [-0.3, 0.75, 1.75]) s.post(u, -1.92, base, base + 3, flat(NE.l))

  // ── the stack(s) ─────────────────────────────────────────────────────
  const stack = (su: number, sv: number, h: number) => {
    s.vcyl(su, sv, 5, base, base + h, flat(WHITE.t), {
      lid: flat(MAT.dark.r),
      spec: false,
      pat: (nx, r, H, l) => (r <= 1 ? NE.t : Math.floor(r / 4) % 2 === 0 && r < 12 ? (l > 0.5 ? OR.t : OR.l) : r % 8 === 7 ? WHITE.r : band(WHITE, l)),
    })
    if (t > 0)
      for (let k = 0; k < 4; k++) {
        const rise = (t * 3 + k * 1.8) % 9
        const d = rise * 0.015
        s.pt(su + d, sv - d, base + h + 2 + rise, SMOKE[rise > 6 ? 2 : rise > 3 ? 1 : 0], false, 0.3)
        if (rise > 3) s.pt(su + d + 0.04, sv - d, base + h + 2 + rise, SMOKE[2], false, 0.3)
      }
  }
  stack(-1.55, -1.5, 40)
  if (tier >= 2) stack(-1.0, -1.65, 34)

  // ── the furnace hall ─────────────────────────────────────────────────
  const HZ = base + 20
  const eye = (c: number, r: number, w: number, h: number) => {
    // the furnace eye: a big round port on the lit face, glowing with the melt
    const cx = 15
    const cy = 10
    const d = Math.hypot((c - cx) * 0.9, r - cy)
    if (d > 7.5) return null
    if (d > 6.4) return OR.l
    if (d > 5.6) return FRAME
    const k = Math.min(4, Math.floor(d / 1.4 + (1 - flick) * 0.6))
    return MELT[k]
  }
  block(s, -1.3, 0.65, -1.7, 0.25, base, HZ, WHITE, {
    l: all((c, r, w, h) => (r === 1 ? OR.t : r === h - 1 ? WHITE.lo : c % 10 === 0 && c > 0 ? WHITE.r : null), eye, at(25, 5, 5, 6, win(0, 0, 5, 6, true))),
    r: all((c, r, w, h) => (r === 1 ? OR.l : r === h - 1 ? WHITE.lo : null), at(4, 7, 8, 12, door(0, 0, 8, 12, NE)), slats(15, 5, 12, 6), at(30, 5, 1, 1, '#7ee07a'), at(30, 7, 1, 1, blink ? '#ffb340' : '#6e4a1c')),
    top: MAT.roof.t,
  })
  // a warm glow spilling out of the eye onto the pad
  for (let k = 0; k < 10; k++) s.pt(-0.6 + k * 0.05, 0.32 + (k % 3) * 0.03, base + 0.5, k % 2 ? MELT[2] : MELT[1], false, 0.01)
  // the furnace hood on the roof: a raised, louvred heat housing with a gold
  // heat-shield band, a glowing vent slit along its top, ducted to the stack
  const FH = HZ + 8
  block(s, -0.9, 0.2, -1.3, -0.2, HZ, FH, NE, {
    ground: false,
    l: (c, r, w, h) => (r === 0 ? NE.hi : r === 1 || r === 2 ? GOLD.l : r > 3 && r < h - 1 && c > 1 && c < w - 2 ? (r % 2 ? MAT.dark.l : NE.t) : null),
    r: (c, r, w, h) => (r === 0 ? NE.l : r === 1 || r === 2 ? GOLD.r : r > 3 && r < h - 1 && c > 1 && c < w - 2 ? (r % 2 ? MAT.dark.r : NE.l) : null),
    t: (c, r, w, h) => (c > 2 && c < w - 3 && Math.abs(r - h / 2) < 1.5 ? (flick > 0.5 ? MELT[1] : MELT[2]) : c === 0 || r === h - 1 ? NE.hi : NE.t),
  })
  // the duct: up from the hood, across to the stack
  block(s, -1.45, -0.75, -1.0, -0.86, FH - 4, FH - 1, NE, { ground: false, l: (c, r) => (r === 0 ? NE.hi : c % 6 === 0 ? NE.r : null) })
  // roof kit: an exhaust fan, a vent box and a short railing at the front edge
  block(s, -1.2, -0.95, -0.05, 0.15, HZ, HZ + 3, NE, { ground: false, l: slats(0, 1, 4, 2) })
  block(s, 0.25, 0.55, -1.55, -1.25, HZ, HZ + 2, NE, {
    ground: false,
    t: (c, r, w, h) => {
      const d = Math.hypot(c - w / 2 + 0.5, r - h / 2 + 0.5)
      if (d > 2.4) return null
      return d < 0.8 ? NE.hi : Math.abs(Math.sin(Math.atan2(r - h / 2, c - w / 2) * 2 - t * 9)) > 0.75 ? NE.t : MAT.dark.r
    },
  })
  for (let a = -1.25; a <= 0.6; a += 1 / 32) s.pt(a, 0.22, HZ + 3, OR.t, false, 0.02)
  for (let a = -1.25; a <= 0.6; a += 0.3) s.line(a, 0.22, HZ, a, 0.22, HZ + 3, OR.l, 0.02)
  status(s, 0.15, -0.25, FH + 1, 'red', blink)

  // ── left: the ore hopper on legs, fed by an inclined belt ────────────
  const HU = -1.55
  const HV = 0.75
  for (const [du, dv] of [
    [-0.25, -0.25],
    [0.25, -0.25],
    [-0.25, 0.25],
    [0.25, 0.25],
  ])
    s.post(HU + du, HV + dv, base, base + 12, flat(NE.l))
  for (let k = 0; k < 3; k++) {
    const half = 0.16 + k * 0.08
    block(s, HU - half, HU + half, HV - half, HV + half, base + 12 + k * 2, base + 14 + k * 2, NE, {
      ground: false,
      l: (c, r) => (r === 0 ? NE.hi : null),
      t: k === 2 ? (c, r, w, h) => (c < 2 || r < 2 || c > w - 3 || r > h - 3 ? NE.t : ORE[(c * 3 + r) % 4]) : undefined,
    })
  }
  // chute from the hopper into the hall
  for (let f = 0; f <= 1; f += 0.03) s.pt(HU + 0.3 + f * 0.4, HV - 0.3 - f * 0.4, base + 12 - f * 2, NE.r, false, 0.03)
  // the inclined feed belt up to the hopper, ore riding it
  const B0 = [-1.0, 1.85, base + 1] as const
  const B1 = [HU + 0.05, HV + 0.3, base + 19] as const
  for (let f = 0; f <= 1; f += 0.015) {
    const u = B0[0] + (B1[0] - B0[0]) * f
    const v = B0[1] + (B1[1] - B0[1]) * f
    const z = B0[2] + (B1[2] - B0[2]) * f
    s.pt(u - 0.06, v, z, NE.t, false, 0.02)
    s.pt(u + 0.06, v, z, NE.r, false, 0.02)
    s.pt(u, v, z + 1, Math.floor(f * 34 - t * 10) % 3 === 0 ? ORE[3] : MAT.dark.l, false, 0.03)
    if (Math.round(f * 66) % 33 === 0 && f > 0.1) s.post(u, v, base, z, flat(NE.l))
  }

  // ── front: the casting line, ingots cooling orange → silver ──────────
  const L = { u0: 0.0, u1: 1.6, v0: 0.6, v1: 0.92 }
  block(s, L.u0, L.u1, L.v0, L.v1, base, base + 5, NE, {
    l: (c, r, w, h) => (r === 0 ? NE.hi : c % 6 === 2 ? MAT.dark.l : r === h - 1 ? NE.lo : null),
    t: (c, r, w, h) => (r === 0 || r === h - 1 ? NE.l : c % 3 === 0 ? MAT.dark.r : MAT.dark.l),
  })
  // pour spout from the hall
  block(s, -0.05, 0.2, 0.25, 0.7, base + 9, base + 11, NE, { ground: false })
  s.pt(0.1, 0.72, base + 8, MELT[1], false, 0.05)
  s.pt(0.1, 0.72, base + 7, MELT[2], false, 0.05)
  const span = L.u1 - L.u0 - 0.25
  for (let k = 0; k < 5; k++) {
    const f = ((t * 0.25 + k / 5) % 1)
    const u = L.u0 + 0.1 + f * span
    const col = f < 0.3 ? MELT[1] : f < 0.5 ? MELT[3] : f < 0.7 ? SILVER[2] : SILVER[1]
    const side = f < 0.3 ? MELT[3] : f < 0.5 ? MELT[4] : SILVER[2]
    block(s, u, u + 0.2, L.v0 + 0.08, L.v1 - 0.08, base + 5, base + 7, { t: col, l: side, r: side, hi: col, lo: side }, { ground: false })
  }
  // the pallet of finished ingots
  block(s, 1.3, 1.85, 1.15, 1.75, base, base + 2, MAT.crate)
  for (let layer = 0; layer < 3; layer++)
    for (let k = 0; k < 3 - (layer > 1 ? 1 : 0); k++) {
      const u = 1.35 + k * 0.16 + layer * 0.06
      block(s, u, u + 0.14, 1.2 + layer * 0.03, 1.7 - layer * 0.03, base + 2 + layer * 2, base + 4 + layer * 2, { t: SILVER[0], l: SILVER[1], r: SILVER[2], hi: '#ffffff', lo: SILVER[2] }, { ground: false })
    }
  if (tier >= 3) {
    for (const v of [1.05, 1.85]) {
      s.post(1.2, v, base, base + 18, flat(OR.l))
      s.post(1.95, v, base, base + 18, flat(OR.l))
    }
    block(s, 1.15, 2.0, 1.4, 1.5, base + 18, base + 20, OR, { ground: false })
    block(s, 1.5, 1.65, 1.38, 1.52, base + 14, base + 17, NE, { ground: false })
  }
  crate(s, 0.9, -1.75, 0.3, base)
  crate(s, 1.3, -1.7, 0.26, base)
  s.lamp(0.65, 0.26, base + 18, LIT_HI, LIT)
  s.flush()
}
