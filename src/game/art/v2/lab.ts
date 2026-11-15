/**
 * Research lab (4×4), clean isometric style. At the back, a ribbed white
 * pressure vessel with a flat lid carrying a boxy gold-foil spectrometer. In
 * front, the white instrument module: its lit face holds the sample glovebox
 * (two gloves reaching for a red rock under bright light) and a pair of scope
 * screens. On the left, a rack of orange-capped core-sample tubes; on the
 * right, a weather mast with a spinning anemometer, a wind vane and a sensor
 * boom. Level 2 adds a roof dish and solar panels, level 3 a second sensor
 * mast and a gold-foil instrument box.
 */
import type { Ctx } from '@/site/pixel/engine'
import { all, at, Iso, status } from '@/game/art/buildings/life'
import { block, crate, door, flat, FRAME, LIT, MAT, pad, slats, type Mat } from './flat'

const WHITE: Mat = { t: '#f2ece4', l: '#ddd3cc', r: '#b6a6aa', hi: '#fffcf6', lo: '#8c7a83' }
const GOLD: Mat = { t: '#f3cf6a', l: '#d9ad45', r: '#a87a2e', hi: '#ffeaa6', lo: '#6e4c1e' }
const SOLAR = ['#2f3a63', '#46558a', '#6c7fb8'] as const
const ROCK = ['#a24832', '#e7976a'] as const
const OR = MAT.crate
const NE = MAT.metal
const band = (m: Mat, l: number) => (l > 0.86 ? m.hi : l > 0.64 ? m.t : l > 0.44 ? m.l : m.r)

/** Inside the glovebox: two dark gloves reaching in from the bottom, holding a red rock. */
const GLOVES = ['...........', '...gg.gg...', '..ggrRrgg..', '..g.rrr.g..', '.gg.....gg.', 'gg.......gg']

export function labV2(ctx: Ctx, x: number, y: number, t: number, tier: number) {
  const s = new Iso(ctx, x, y, 0.5)
  const blink = (t * 1.5) % 1 < 0.4
  const base = 3
  pad(s, 1.96, base)

  // ── back: the ribbed pressure vessel and its spectrometer ────────────
  const VU = -0.9
  const VV = -1.0
  const VZ = base + 24
  s.vcyl(VU, VV, 14, base, VZ, flat(WHITE.t), {
    lid: flat(MAT.roof.t),
    spec: false,
    pat: (nx, r, H, l) => {
      if (r % 6 === 5) return band(WHITE, l - 0.25)
      if (r === 2 || r === 3) return l > 0.5 ? OR.t : OR.l
      // a row of portholes on the lit side
      if (r >= 8 && r <= 11 && Math.abs(((nx + 1) * 5) % 2 - 1) < 0.35 && nx < 0.3) return r === 8 || r === 11 ? FRAME : LIT
      return band(WHITE, l)
    },
  })
  // the boxy spectrometer on the lid, wrapped in gold foil, with an aperture
  block(s, VU - 0.35, VU + 0.25, VV - 0.3, VV + 0.25, VZ, VZ + 7, GOLD, {
    ground: false,
    l: (c, r, w, h) => (r === 0 ? GOLD.hi : c > 2 && c < 6 && r > 2 && r < 5 ? MAT.dark.r : (c * 3 + r) % 7 === 0 ? GOLD.hi : null),
    r: (c, r) => ((c + r * 2) % 6 === 0 ? GOLD.lo : null),
  })
  status(s, VU + 0.25, VV + 0.25, VZ + 8, 'green', (t * 2) % 1 < 0.5)

  // ── front: the instrument module with the glovebox ───────────────────
  const MZ = base + 16
  const glovebox = at(3, 3, 13, 10, (c, r, w, h) => {
    if (c === 0 || r === 0 || c === w - 1 || r === h - 1) return NE.l
    if (c === 1 || r === 1 || c === w - 2 || r === h - 2) return FRAME
    const ch = GLOVES[r - 2]?.[c - 2]
    if (ch === 'g') return MAT.dark.l
    if (ch === 'r') return ROCK[0]
    if (ch === 'R') return ROCK[1]
    return r <= 3 ? '#f6fbff' : '#dfe8ea'
  })
  const screens = at(19, 3, 9, 6, (c, r, w, h) => {
    if (c === 0 || r === 0 || c === w - 1 || r === h - 1) return FRAME
    const wave = Math.round(h / 2 - 1 + Math.sin((c + t * 8) * 0.9) * (h / 2 - 2))
    return r === wave ? '#7ee07a' : r < 2 ? '#3e8da8' : '#2e6f83'
  })
  block(s, -1.4, 0.75, 0.05, 1.5, base, MZ, WHITE, {
    l: all((c, r, w, h) => (r === 1 ? OR.t : r === h - 1 ? WHITE.lo : c % 11 === 0 && c > 0 ? WHITE.r : null), glovebox, screens),
    r: all((c, r, w, h) => (r === 1 ? OR.l : r === h - 1 ? WHITE.lo : null), at(3, 4, 7, 11, door(0, 0, 7, 11, NE)), slats(13, 4, 7, 5), at(15, 11, 1, 1, '#7ee07a'), at(17, 11, 1, 1, blink ? '#ff6a5a' : '#8f2f3f')),
    top: MAT.roof.t,
  })
  // level 2: solar panels and a small dish on the module roof
  if (tier >= 2) {
    block(s, -1.3, -0.4, 0.15, 0.7, MZ, MZ + 2, NE, {
      ground: false,
      t: (c, r, w, h) => (c === 0 || r === 0 || c === w - 1 || r === h - 1 ? NE.hi : r % 4 === 0 ? SOLAR[2] : (c + r) % 7 === 0 ? SOLAR[1] : SOLAR[0]),
    })
    s.post(0.3, 1.0, MZ, MZ + 4, flat(NE.l))
    s.ell(0.3, 1.0, MZ + 6, 6, 1.5, flat(WHITE.t), { cut: 0, spec: false, pat: (_u, _v, nz) => (nz < 0.45 ? WHITE.hi : nz < 0.6 ? WHITE.t : WHITE.l) })
    s.line(0.3, 1.0, MZ + 6, 0.3, 1.0, MZ + 10, NE.t)
    s.pt(0.3, 1.0, MZ + 11, '#e8c15a', false, 0.1)
  }

  // ── front left: the rack of core-sample tubes ────────────────────────
  const RK = { u0: -1.92, u1: -1.2, v0: 1.58, v1: 1.92 }
  block(s, RK.u0, RK.u1, RK.v0, RK.v1, base, base + 2, NE)
  for (const u of [RK.u0, RK.u1]) for (const v of [RK.v0, RK.v1]) s.post(u, v, base, base + 13, flat(NE.l))
  block(s, RK.u0, RK.u1, RK.v0, RK.v1, base + 12, base + 13, NE, { ground: false })
  for (let k = 0; k < 5; k++) {
    const u = RK.u0 + 0.1 + k * 0.13
    for (const v of [RK.v0 + 0.1, RK.v1 - 0.1]) {
      s.vcyl(u, v, 1, base + 2, base + 10, flat(WHITE.l), { lid: flat(OR.t), spec: false, pat: (nx, r) => (r < 2 ? OR.t : nx < 0 ? WHITE.hi : WHITE.r) })
    }
  }

  // ── right: the weather mast ──────────────────────────────────────────
  const WU = 1.45
  const WV = -1.3
  const WZ = base + 30
  s.post(WU, WV, base, WZ, flat(NE.l))
  // anemometer: three cups spinning on arms
  for (let k = 0; k < 3; k++) {
    const a = t * 8 + (k * Math.PI * 2) / 3
    const cu = WU + Math.cos(a) * 0.18
    const cv = WV + Math.sin(a) * 0.18
    s.line(WU, WV, WZ, cu, cv, WZ, NE.t)
    block(s, cu - 0.04, cu + 0.04, cv - 0.04, cv + 0.04, WZ - 1, WZ + 1, OR, { ground: false })
  }
  // wind vane and a sensor boom
  s.line(WU - 0.25, WV + 0.05, WZ - 5, WU + 0.2, WV - 0.04, WZ - 5, NE.t)
  block(s, WU - 0.3, WU - 0.2, WV, WV + 0.1, WZ - 7, WZ - 3, OR, { ground: false })
  s.line(WU, WV, WZ - 12, WU, WV + 0.45, WZ - 12, NE.l)
  block(s, WU - 0.05, WU + 0.05, WV + 0.4, WV + 0.5, WZ - 14, WZ - 11, WHITE, { ground: false })
  status(s, WU, WV, WZ + 2, 'red', blink)
  block(s, WU - 0.2, WU + 0.2, WV - 0.2, WV + 0.2, base, base + 5, WHITE, { l: (c, r) => (r === 1 ? OR.t : null) })

  // level 3: a second sensor mast and a gold-foil instrument box
  if (tier >= 3) {
    s.post(1.5, 0.3, base, base + 20, flat(NE.l))
    for (const z of [base + 14, base + 18]) block(s, 1.38, 1.62, 0.25, 0.35, z, z + 2, WHITE, { ground: false })
    status(s, 1.5, 0.3, base + 21, 'green', true)
    block(s, 1.1, 1.85, 0.8, 1.6, base, base + 7, GOLD, { l: (c, r) => (r === 0 ? GOLD.hi : (c * 3 + r) % 7 === 0 ? GOLD.hi : null), top: WHITE.t })
  } else {
    crate(s, 1.2, 0.9, 0.3, base)
    crate(s, 1.55, 1.35, 0.26, base)
  }
  s.flush()
}
