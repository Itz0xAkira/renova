/**
 * Battery bank (3×3), clean isometric style: a long white thermal-controlled
 * cabinet with a gold-foil roof, three module doors whose charge bars rise and
 * fall, and a bank of spacecraft thermal louvres on its shaded side that open
 * and close as the cells warm and cool. Out front, an inverter box with a
 * charge display feeds a cable into the grid. Level 2 adds a roof radiator and
 * a chiller; level 3 the regenerative fuel cell's hydrogen and oxygen tanks and
 * a beacon mast.
 */
import type { Ctx } from '@/site/pixel/engine'
import { all, at, Iso, status } from '@/game/art/buildings/life'
import { block, crate, door, flat, FRAME, MAT, pad, slats, type Mat } from './flat'

const WHITE: Mat = { t: '#f2ece4', l: '#ddd3cc', r: '#b6a6aa', hi: '#fffcf6', lo: '#8c7a83' }
const GOLD: Mat = { t: '#f3cf6a', l: '#d9ad45', r: '#a87a2e', hi: '#ffeaa6', lo: '#6e4c1e' }
const OR = MAT.crate
const NE = MAT.metal
const ON = '#7ee07a'
const OFF = '#2f6a3a'
const band = (m: Mat, l: number) => (l > 0.86 ? m.hi : l > 0.64 ? m.t : l > 0.44 ? m.l : m.r)

export function batteryV2(ctx: Ctx, x: number, y: number, t: number, tier: number) {
  const s = new Iso(ctx, x, y, 0.5)
  const blink = (t * 1.5) % 1 < 0.4
  const base = 3
  pad(s, 1.47, base)

  // ── level 2: chiller unit at the back left ───────────────────────────
  if (tier >= 2)
    block(s, -1.4, -0.85, -1.4, -0.95, base, base + 9, WHITE, {
      l: all((c, r, w, h) => (r === 1 ? MAT.green.l : r === h - 1 ? WHITE.lo : null), slats(1, 3, 6, 4)),
      t: (c, r, w, h) => {
        const d = Math.hypot(c - w / 2 + 0.5, r - h / 2 + 0.5)
        if (d > 3) return null
        return d < 1 ? NE.hi : Math.abs(Math.sin(Math.atan2(r - h / 2, c - w / 2) * 2 - t * 9)) > 0.75 ? NE.t : MAT.dark.r
      },
      top: MAT.roof.t,
    })

  // ── the cabinet ──────────────────────────────────────────────────────
  const CZ = base + 16
  const charge = (k: number) => Math.round(((Math.sin(t * Math.PI + k * 0.9) + 1) / 2) * 7)
  const module = (k: number, c0: number) =>
    at(c0, 3, 9, 12, (c, r, w, h) => {
      if (c === 0 || r === 0 || c === w - 1 || r === h - 1) return FRAME
      // a charge bar down the middle of each door
      if (c >= 3 && c <= 5 && r >= 2 && r <= h - 3) return r > h - 3 - charge(k) ? ON : OFF
      if (r === 1 && c === w - 2) return ON
      return c === 1 ? WHITE.r : WHITE.l
    })
  // louvres: slats that tilt open (wide gaps) and closed as the cells warm and cool
  const open = (Math.sin(t * Math.PI * 0.5) + 1) / 2
  const louvres = (c: number, r: number, w: number, h: number) => {
    if (c < 2 || c > w - 3 || r < 3 || r > h - 3) return null
    const k = (r - 3) % 3
    if (c === 2 || c === w - 3) return NE.l
    return k === 0 ? NE.hi : k === 1 ? (open > 0.5 ? MAT.dark.r : NE.t) : open > 0.25 ? MAT.dark.l : NE.l
  }
  block(s, -1.25, 0.95, -1.15, 0.2, base, CZ, WHITE, {
    l: all((c, r, w, h) => (r === 1 ? OR.t : r === h - 1 ? WHITE.lo : null), module(0, 2), module(1, 12), module(2, 22)),
    r: all((c, r, w, h) => (r === 1 ? OR.l : r === h - 1 ? WHITE.lo : null), louvres),
    t: (c, r, w, h) => (c === 0 || r === h - 1 ? GOLD.hi : (c * 3 + r * 5) % 17 === 0 ? GOLD.hi : (c + r) % 2 ? GOLD.t : GOLD.l),
  })
  status(s, 0.95, -0.95, CZ - 2, 'green', true)
  // level 2: a radiator raised on the roof
  if (tier >= 2) {
    for (const u of [-1.0, 0.6]) s.post(u, -0.5, CZ, CZ + 3, flat(NE.l))
    block(s, -1.1, 0.7, -0.55, -0.45, CZ + 3, CZ + 10, WHITE, {
      ground: false,
      l: (c, r, w, h) => (r === 0 ? OR.hi : r === h - 1 ? NE.r : c % 2 ? WHITE.hi : WHITE.r),
      r: () => NE.r,
    })
  }

  // ── front right: the inverter, cabled into the grid ──────────────────
  block(s, 0.55, 1.3, 0.6, 1.25, base, base + 11, WHITE, {
    l: all(
      (c, r, w, h) => (r === 1 ? MAT.green.l : r === h - 1 ? WHITE.lo : null),
      at(2, 3, 8, 5, (c, r, w, h) => {
        if (c === 0 || r === 0 || c === w - 1 || r === h - 1) return FRAME
        // a little charge readout: a bar filling with the average charge
        return c < 1 + Math.round(((Math.sin(t * Math.PI) + 1) / 2) * (w - 2)) ? '#65c9e8' : '#1f3a4a'
      }),
    ),
    r: all((c, r, w, h) => (r === 1 ? MAT.green.r : r === h - 1 ? WHITE.lo : null), at(2, 3, 6, 7, door(0, 0, 6, 7, NE))),
    top: MAT.roof.t,
  })
  // the cable from cabinet to inverter, and out to the grid
  for (let f = 0; f <= 1; f += 0.04) s.pt(0.3 + f * 0.3, 0.25 + f * 0.5, base + 1, MAT.dark.l, false, 0.01)
  for (let f = 0; f <= 1; f += 0.04) s.pt(1.3 + f * 0.17, 0.9, base + 1, MAT.dark.l, false, 0.01)

  // ── level 3: regenerative fuel cell tanks and a beacon mast ──────────
  if (tier >= 3) {
    for (const [tu, tv, stripe] of [
      [-1.0, 0.75, '#d86b7b'], // hydrogen
      [-0.45, 1.05, '#65c9e8'], // oxygen
    ] as const) {
      s.vcyl(tu, tv, 6, base, base + 18, flat(WHITE.t), {
        lid: flat(WHITE.hi),
        spec: false,
        pat: (nx, r, H, l) => (r === 3 || r === 4 ? stripe : r === H - 1 ? WHITE.lo : band(WHITE, l)),
      })
    }
    s.post(0.75, -1.05, CZ, CZ + 14, flat(NE.l))
    s.lamp(0.75, -1.05, CZ + 15, blink ? '#ff6a5a' : '#8f2f3f', '#b03e53')
  } else {
    crate(s, -1.1, 0.75, 0.3, base)
    crate(s, -0.75, 1.05, 0.26, base)
  }
  s.flush()
}
