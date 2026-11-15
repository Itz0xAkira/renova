/**
 * Regolith shield (2×2), clean isometric style: a stepped berm of sandbags,
 * three courses stepping inward, under a packed regolith crown. A white
 * storm-shelter portal with an orange hatch leads in. On the crown, a
 * space-weather siren mast carries a stack light (green when all is calm)
 * under an orange beacon, beside a radiation sign and a vent. Level 2 lays
 * water bladders on the crown (water is a good radiation shield); level 3
 * adds a solar panel and a boxy dosimeter.
 */
import type { Ctx } from '@/site/pixel/engine'
import { at, Iso } from '@/game/art/buildings/life'
import { block, door, flat, MAT, pad, type Mat } from './flat'

const WHITE: Mat = { t: '#f2ece4', l: '#ddd3cc', r: '#b6a6aa', hi: '#fffcf6', lo: '#8c7a83' }
const BAG: Mat = { t: '#e3c7a3', l: '#cda884', r: '#a07c67', hi: '#f1dcbf', lo: '#73534a' }
const DUSTY: Mat = { t: '#d9a77c', l: '#c08a64', r: '#946450', hi: '#ebc29a', lo: '#6a4436' }
const CROWN: Mat = { t: '#b8714a', l: '#9e5836', r: '#7d4029', hi: '#d08a5e', lo: '#5a2b1f' }
const BLADDER: Mat = { t: '#bfe0ee', l: '#98c9de', r: '#6f9fba', hi: '#e6f6fc', lo: '#4c7590' }
const SOLAR = ['#2f3a63', '#46558a', '#6c7fb8'] as const
const OR = MAT.crate
const NE = MAT.metal
const band = (m: Mat, l: number) => (l > 0.86 ? m.hi : l > 0.64 ? m.t : l > 0.44 ? m.l : m.r)

export function shieldV2(ctx: Ctx, x: number, y: number, t: number, tier: number) {
  const s = new Iso(ctx, x, y, 0.5)
  const blink = (t * 1.5) % 1 < 0.4
  const base = 3
  pad(s, 0.97, base)

  // packed regolith core, mostly hidden by the bags
  const top = base + 13
  block(s, -0.7, 0.62, -0.7, 0.62, base, top, CROWN, { top: CROWN.t, t: (c, r) => ((c * 7 + r * 3) % 11 === 0 ? CROWN.hi : (c + r * 2) % 9 === 0 ? CROWN.l : null) })

  // three courses of sandbags round the core, stepping in, the lowest caked in dust
  const PORTAL = { u0: -0.3, u1: 0.3 }
  for (let k = 0; k < 3; k++) {
    const e = 0.86 - k * 0.12
    const z = base + 2 + k * 4
    const m = k === 0 ? DUSTY : BAG
    const bag = (u: number, v: number) => s.ell(u, v, z, 4, 2.6, flat(m.t), { cut: -2, spec: false, pat: (_u, _v, nz, l) => (nz < 0.28 ? m.lo : nz > 0.75 && l > 0.5 ? m.hi : band(m, l)) })
    for (let a = -e; a <= e + 0.01; a += 0.2) {
      bag(a + (k % 2) * 0.1 - 0.05, -e) // back
      bag(-e, a + (k % 2) * 0.1 - 0.05) // left-back
      if (!(a > PORTAL.u0 - 0.1 && a < PORTAL.u1 + 0.1)) bag(a + (k % 2) * 0.1 - 0.05, e) // front-left, gap for the portal
      bag(e, a + (k % 2) * 0.1 - 0.05) // front-right
    }
  }

  // the storm-shelter portal: a white frame with an orange hatch
  block(s, PORTAL.u0, PORTAL.u1, 0.55, 0.98, base, base + 12, WHITE, {
    l: (c, r, w, h) => (r === 1 ? OR.t : r === h - 1 ? WHITE.lo : null) ?? at(2, 3, w - 4, 9, door(0, 0, w - 4, 9, OR))(c, r, w, h),
    r: (c, r, w, h) => (r === 1 ? OR.l : r === h - 1 ? WHITE.lo : null),
    top: MAT.roof.t,
  })

  // level 2: water bladders on the crown
  if (tier >= 2)
    for (const [bu, bv] of [
      [-0.35, -0.3],
      [0.15, 0.2],
    ])
      s.ell(bu, bv, top, 8, 3, flat(BLADDER.t), { cut: 0, spec: false, pat: (nu, nv, nz, l) => (Math.abs(nu) < 0.08 ? MAT.metal.l : nz > 0.8 ? BLADDER.hi : band(BLADDER, l)) })

  // radiation sign at the crown's front edge
  block(s, -0.55, -0.15, 0.45, 0.5, top, top + 7, MAT.dark, {
    ground: false,
    l: (c, r, w, h) => {
      if (c === 0 || r === 0 || c === w - 1 || r === h - 1) return '#1b1622'
      const cx = (w - 1) / 2
      const cy = (h - 1) / 2
      const d = Math.hypot(c - cx, r - cy)
      if (d < 1) return '#1b1622'
      const a = Math.atan2(r - cy, c - cx)
      return d < 2.6 && Math.sin(a * 3) > 0.2 ? '#1b1622' : '#ffd24a'
    },
  })
  // vent
  s.vcyl(-0.45, -0.45, 2, top, top + 5, flat(NE.l), { lid: flat(MAT.dark.r), spec: false })

  // the siren mast: stack light (green when calm) and an orange beacon
  const MU = 0.3
  const MV = -0.3
  s.post(MU, MV, top, top + 22, flat(NE.l))
  const lights = [
    ['#ff6a5a', '#5a2a2a'],
    ['#ffb340', '#5a4420'],
    ['#7ee07a', '#2f6a3a'],
  ] as const
  lights.forEach(([on, off], k) =>
    block(s, MU - 0.07, MU + 0.07, MV - 0.07, MV + 0.07, top + 10 + k * 3, top + 12.5 + k * 3, { t: k === 2 ? on : off, l: k === 2 ? on : off, r: k === 2 ? on : off, hi: k === 2 ? on : off, lo: off }, { ground: false }),
  )
  block(s, MU - 0.12, MU + 0.12, MV - 0.06, MV + 0.06, top + 19, top + 21, NE, { ground: false, l: () => NE.t })
  s.lamp(MU, MV, top + 23, blink ? OR.hi : OR.l, OR.l)

  // level 3: a solar panel and a boxy dosimeter
  if (tier >= 3) {
    s.post(-0.1, -0.55, top, top + 4, flat(NE.l))
    block(s, -0.4, 0.2, -0.75, -0.35, top + 4, top + 5, NE, {
      ground: false,
      t: (c, r, w, h) => (c === 0 || r === 0 || c === w - 1 || r === h - 1 ? NE.hi : r % 4 === 0 ? SOLAR[2] : (c + r) % 7 === 0 ? SOLAR[1] : SOLAR[0]),
    })
    block(s, 0.35, 0.55, 0.1, 0.3, top, top + 5, WHITE, { ground: false, l: (c, r) => (r === 2 && c === 1 ? (blink ? '#7ee07a' : '#2f6a3a') : null), t: (c, r) => (c === 1 && r === 1 ? OR.t : null) })
  }
  s.flush()
}
