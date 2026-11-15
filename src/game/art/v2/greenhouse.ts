/**
 * Greenhouse (6×4), clean isometric style: a long, low inflatable growing hall,
 * a half-tube of translucent skin between white arch ribs, its feet held down
 * by sandbags. Inside, three rows of tiered plant racks under LED strips flood
 * the hall with a pink glow that shows through the skin. A rigid white airlock
 * vestibule closes the front end; insulated water tanks and a nutrient skid
 * stand at the back. `dim` (night or no power) turns the lights off and greys
 * the skin. Level 2 adds a side airlock, level 3 gold-foil tanks and a lit ridge.
 */
import type { Ctx } from '@/site/pixel/engine'
import { all, at, Iso, KZ, status } from '@/game/art/buildings/life'
import { block, crate, door, flat, FRAME, LEAF, LIT, LIT_HI, MAT, padRect, slats, type Mat } from './flat'

const WHITE: Mat = { t: '#f2ece4', l: '#ddd3cc', r: '#b6a6aa', hi: '#fffcf6', lo: '#8c7a83' }
const GOLD: Mat = { t: '#f3cf6a', l: '#d9ad45', r: '#a87a2e', hi: '#ffeaa6', lo: '#6e4c1e' }
const BAG: Mat = { t: '#e3c7a3', l: '#cda884', r: '#a07c67', hi: '#f1dcbf', lo: '#73534a' }
const GLOW = { skin: ['#a8508e', '#c96aa8', '#e08cc2', '#f2b4dc'], led: '#ff8fd0', ledHi: '#ffe4f3', floor: '#4a2a44' } as const
const DARK = { skin: ['#7f7b85', '#a29ea6', '#c3c0c4', '#dedbdc'], led: '#6a6070', ledHi: '#8a8090', floor: '#3a3442' } as const
const OR = MAT.crate
const NE = MAT.metal
const band = (m: Mat, l: number) => (l > 0.86 ? m.hi : l > 0.64 ? m.t : l > 0.44 ? m.l : m.r)

export function greenhouseV2(ctx: Ctx, x: number, y: number, t: number, dim: boolean, tier: number) {
  const s = new Iso(ctx, x, y, dim ? 0.5 : 0.26)
  const P = dim ? DARK : GLOW
  const blink = (t * 1.5) % 1 < 0.4
  const base = 3
  padRect(s, 2.95, 1.95, base)

  const HV = 0 // hall centre line (v)
  const HR = 1.5 // hall radius, tiles
  const H0 = -2.25
  const H1 = 2.05

  // ── back: water tanks and the nutrient skid ──────────────────────────
  const tankMat = tier >= 3 ? GOLD : WHITE
  for (const v of [-1.15, -0.25, 0.65]) {
    s.vcyl(-2.6, v, 6, base, base + 17, flat(tankMat.t), {
      lid: flat(WHITE.t),
      spec: false,
      pat: (nx, r, H, l) => (r <= 1 ? WHITE.hi : r === 4 || r === 5 ? MAT.green.l : r === H - 1 ? tankMat.lo : band(tankMat, l)),
    })
  }
  block(s, -2.9, -2.3, 1.15, 1.85, base, base + 10, WHITE, {
    l: all((c, r, w, h) => (r === 1 ? MAT.green.l : r === h - 1 ? WHITE.lo : null), slats(2, 3, 4, 4), at(8, 3, 1, 1, '#7ee07a')),
    r: (c, r, w, h) => (r === 1 ? MAT.green.r : r === h - 1 ? WHITE.lo : null),
    top: MAT.roof.t,
  })

  // ── inside the hall: floor, three rows of tiered racks under LEDs ─────
  block(s, H0, H1, HV - HR + 0.15, HV + HR - 0.15, base, base + 1, MAT.dark, { ground: false, top: P.floor })
  for (const rv of [-0.8, 0, 0.8]) {
    for (let tierK = 0; tierK < 2; tierK++) {
      const z0 = base + 1 + tierK * 9
      // shelf with a row of plants
      block(s, H0 + 0.2, H1 - 0.2, rv - 0.18, rv + 0.18, z0 + 2, z0 + 3, NE, {
        ground: false,
        t: (c, r) => LEAF[(c * 7 + r * 3 + tierK) % 4],
      })
      for (let k = 0; k < 24; k++) {
        const u = H0 + 0.25 + k * 0.17
        const v = rv - 0.12 + ((k * 5) % 3) * 0.12
        const h = 1 + ((k * 3 + tierK) % 3)
        for (let z = 0; z < h; z++) s.pt(u, v, z0 + 4 + z, LEAF[Math.min(3, 1 + z + (k % 2))], false, 0.01)
      }
      // LED strip above it
      if (tierK < 2) block(s, H0 + 0.2, H1 - 0.2, rv - 0.03, rv + 0.03, z0 + 8, z0 + 8.6, NE, { ground: false, top: dim ? P.led : P.ledHi, l: () => P.led })
    }
    // rack posts
    for (let u = H0 + 0.2; u <= H1 - 0.2; u += 0.8) s.post(u, rv - 0.18, base + 1, base + 19, flat(NE.l))
  }

  // ── the hall skin and its ribs ───────────────────────────────────────
  const zc = base
  s.hcyl('u', H0, H1, HV, zc, HR, flat(P.skin[1]), {
    glass: true,
    upper: true,
    pat: (s0, th, l) => {
      const ridge = Math.abs(th - Math.PI / 2) < 0.06
      if (ridge && tier >= 3 && !dim) return blink ? '#ffffff' : P.skin[3]
      return l > 0.8 ? P.skin[3] : l > 0.6 ? P.skin[2] : l > 0.42 ? P.skin[1] : P.skin[0]
    },
    cap: (rr) => (rr > 0.9 ? WHITE.l : P.skin[2]),
  })
  for (let u = H0; u <= H1 + 0.01; u += 0.54)
    s.hcyl('u', u - 0.035, u + 0.035, HV, zc, HR + 0.02, flat(WHITE.t), {
      upper: true,
      ring: 0.9,
      pat: (_s0, _th, l) => band(WHITE, l),
      cap: () => WHITE.t,
    })

  // sandbags along both feet
  for (const fv of [HV - HR - 0.12, HV + HR + 0.12])
    for (let u = H0 + 0.1; u < H1; u += 0.22)
      s.ell(u, fv, base + 2, 4, 2.5, flat(BAG.t), { cut: -2, spec: false, pat: (_u, _v, nz, l) => (nz < 0.28 ? BAG.lo : nz > 0.75 && l > 0.5 ? BAG.hi : band(BAG, l)) })

  // ── front end: the airlock vestibule ─────────────────────────────────
  block(s, H1, 2.75, HV - 0.65, HV + 0.65, base, base + 19, WHITE, {
    l: all((c, r, w, h) => (r === 1 ? MAT.green.l : r === h - 1 ? WHITE.lo : null), at(3, 4, 5, 4, (c, r, w, h) => (c === 0 || r === 0 || c === w - 1 || r === h - 1 ? FRAME : dim ? '#3e3a5d' : LIT))),
    r: all((c, r, w, h) => (r === 1 ? MAT.green.r : r === h - 1 ? WHITE.lo : null), at(6, 5, 8, 13, door(0, 0, 8, 13, NE)), at(16, 6, 1, 1, '#7ee07a'), at(16, 8, 1, 1, blink ? '#ff6a5a' : '#8f2f3f')),
    top: MAT.roof.t,
  })
  s.lamp(2.78, HV, base + 20, dim ? '#b9a27a' : LIT_HI, dim ? '#8a7a62' : LIT)
  // a step and a crate of harvest by the door
  block(s, 2.75, 2.92, HV - 0.35, HV + 0.35, base, base + 2, NE)
  crate(s, 2.4, 1.0, 0.3, base)
  block(s, 2.0, 2.3, 1.2, 1.5, base, base + 5, MAT.green, { t: (c, r) => LEAF[(c + r) % 4] })

  // level 2: a side airlock on the lit side
  if (tier >= 2) {
    const R = 0.3
    s.hcyl('v', HV + HR - 0.3, HV + HR + 0.35, -0.4, base + 2 + R * KZ, R, flat(WHITE.t), {
      pat: (s0, _th, l) => (Math.round(s0) % 4 === 0 ? band(WHITE, l - 0.25) : band(WHITE, l)),
      cap: (rr, th) => (rr > 0.86 ? WHITE.r : rr > 0.72 ? OR.t : rr < 0.3 && Math.sin(th) > -0.2 ? (dim ? '#3e3a5d' : LIT) : rr < 0.38 ? FRAME : WHITE.t),
    })
    status(s, -0.75, HV + HR + 0.35, base + 12, 'green', true)
  }
  s.flush()
}
