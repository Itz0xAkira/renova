/**
 * Habitat (6×6), clean isometric style. Building high on Mars is hard, so the
 * crew's home spreads out instead: a cluster of low, round inflatable domes on
 * bolted footing rings, joined by strapped inflatable tunnels.
 *
 *  - Main dome (back): the commons, with a cupola, railing, antenna and beacon.
 *  - Sleeping pod (right), joined by a tunnel, its airlock opening on the yard.
 *  - Third pod (left): only its prepared footing and fabric crates at level 1,
 *    built at level 2. Level 3 lights the cupola and adds a radiator wall.
 *
 * Domes are sewn in gores and held by restraint straps with orange buckles,
 * with framed warm windows low down and portholes higher up. Round the pad: a
 * life-support module piped into the main dome, water tanks and a battery
 * cabinet, an EVA suit rack, cargo crates, a mission flag and lamps, a sandbag
 * wall and a planter of test crops.
 */
import type { Ctx } from '@/site/pixel/engine'
import { all, at, Iso, KZ, PXT, status, sprite, SUIT } from '@/game/art/buildings/life'
import { block, crate, flat, FRAME, GLASS, GLASS_HI, lampPost, LIT, LIT_HI, MAT, pad, planter, slats, type Mat } from './flat'

/** Dome fabric: near-white, shading toward a soft plum. */
const FAB: Mat = { t: '#f2ece4', l: '#ddd3cc', r: '#b6a6aa', hi: '#fffcf6', lo: '#8c7a83' }
/** Restraint straps. */
const STRAP: Mat = { t: '#c5b9b2', l: '#a99b94', r: '#82737a', hi: '#dcd2ca', lo: '#5f5059' }
/** Sandbags: regolith-filled cloth. */
const BAG: Mat = { t: '#e3c7a3', l: '#cda884', r: '#a07c67', hi: '#f1dcbf', lo: '#73534a' }
const HAZ = ['#f2c94c', '#3b3242'] as const
const OR = MAT.crate
const NE = MAT.metal

/** Four flat tones from a brightness: highlight, top, lit, shade. */
const band = (m: Mat, l: number) => (l > 0.86 ? m.hi : l > 0.64 ? m.t : l > 0.44 ? m.l : m.r)

/** Bolted footing ring with a hazard band, `h` px tall. */
function footing(s: Iso, uc: number, vc: number, rx: number, z0: number, h: number, lid = NE.t) {
  s.vcyl(uc, vc, rx, z0, z0 + h, flat(NE.l), {
    lid: flat(lid),
    spec: false,
    pat: (nx, r, _H, _l, px, py) => (r === 0 ? NE.hi : r === 1 ? HAZ[((px + (py >> 1)) >> 1) % 2] : Math.round(nx * 16) % 3 === 0 && r === 2 ? MAT.dark.l : nx < -0.4 ? NE.t : nx < 0.35 ? NE.l : NE.r),
  })
}

/**
 * A round inflatable dome on a footing. Azimuths: 0 points down-right (+u),
 * π/2 down-left (+v), π/4 at the viewer. `wins` and `ports` list azimuths.
 */
function dome(s: Iso, uc: number, vc: number, rx: number, rise: number, z0: number, wins: number[], ports: number[], vent?: number) {
  footing(s, uc, vc, rx + 2, z0, 4)
  const fz = z0 + 4
  s.ell(uc, vc, fz, rx, rise, flat(FAB.t), {
    cut: 0,
    spec: false,
    pat: (nu, nv, nz, l) => {
      const az = Math.atan2(nv, nu)
      const ca = Math.sqrt(Math.max(0, 1 - nz * nz))
      if (nz > 0.08 && nz < 0.38)
        for (const w of wins) {
          const dx = Math.abs(az - w) * ca * rx
          if (dx < 3) {
            if (nz < 0.12) return FAB.hi
            if (dx > 2 || nz < 0.16 || nz > 0.34) return FRAME
            return nz > 0.29 ? LIT_HI : LIT
          }
        }
      if (nz > 0.54 && nz < 0.72)
        for (const w of ports) {
          const d = Math.hypot(Math.abs(az - w) * ca * rx, (nz - 0.63) * rise)
          if (d < 2.4) return d > 1.5 ? FRAME : d < 0.7 ? GLASS_HI : GLASS
        }
      if (vent !== undefined && nz > 0.1 && nz < 0.3 && Math.abs(az - vent) * ca * rx < 3) return Math.round(nz * rise) % 2 ? NE.r : NE.l
      const q = (az + Math.PI) / (Math.PI / 4)
      const strap = Math.abs(q - Math.round(q)) * (Math.PI / 4) * ca * rx < 1.05 && nz < 0.93
      const belt = Math.abs(nz - 0.46) < 0.035 || Math.abs(nz - 0.8) < 0.03
      if (strap && belt) return l > 0.5 ? OR.t : OR.l
      if (strap || belt) return band(STRAP, l)
      const g = (az + Math.PI) / (Math.PI / 8)
      if (Math.abs(g - Math.round(g)) * (Math.PI / 8) * ca * rx < 0.45 && nz < 0.9) return band(FAB, l - 0.2)
      return band(FAB, l)
    },
  })
  return fz + rise
}

/** A strapped inflatable tunnel along an axis, from a0 to a1, at cross position c. */
function tunnel(s: Iso, axis: 'u' | 'v', a0: number, a1: number, c: number, z0: number, rad: number) {
  s.hcyl(axis, a0, a1, c, z0 + rad * KZ, rad, flat(FAB.t), {
    pat: (s0, th, l) => {
      if (Math.abs(((s0 + 3) % 6) - 3) < 0.6) return band(STRAP, l)
      if (Math.abs(th - 1.15) < 0.2 && Math.round(s0) % 6 === 3) return LIT
      return band(FAB, l)
    },
  })
}

/** A ribbed rigid airlock along an axis with a round hatch, steps, handrails and lamps at its outer end a1. */
function airlock(s: Iso, axis: 'u' | 'v', a0: number, a1: number, c: number, z0: number, blink: boolean) {
  const R = 0.3
  const zc = z0 + 2 + R * KZ
  s.hcyl(axis, a0, a1, c, zc, R, flat(FAB.t), {
    pat: (s0, th, l) => {
      if (Math.round(s0) % 4 === 0 && s0 > 2) return band(FAB, l - 0.25)
      if (Math.abs(th - 0.6) < 0.09 && s0 > 3) return l > 0.5 ? OR.t : OR.l
      return band(FAB, l)
    },
    cap: (rr, th, l) => {
      if (rr > 0.9) return FAB.r
      if (rr > 0.76) return OR.t
      if (rr > 0.68) return FRAME
      if (rr < 0.26) return Math.sin(th) > 0 ? LIT_HI : LIT
      if (rr < 0.34) return FRAME
      if (Math.abs(Math.sin(th * 2)) < 0.12) return NE.r
      return l > 0.6 ? FAB.hi : FAB.t
    },
  })
  const P = (along: number, across: number): [number, number] => (axis === 'v' ? [c + across, along] : [along, c + across])
  // step
  const [su0, sv0] = P(a1, -0.26)
  const [su1, sv1] = P(a1 + 0.12, 0.26)
  block(s, Math.min(su0, su1), Math.max(su0, su1), Math.min(sv0, sv1), Math.max(sv0, sv1), z0, z0 + 2, NE)
  // handrails
  for (const side of [-0.3, 0.3]) {
    const [pu, pv] = P(a1 + 0.08, side)
    const [qu, qv] = P(a1 - 0.25, side)
    s.post(pu, pv, z0, z0 + 9, flat(OR.l))
    s.line(qu, qv, z0 + 9, pu, pv, z0 + 9, OR.t)
  }
  const [gu, gv] = P(a1 - 0.05, -0.42)
  const [ru, rv] = P(a1 - 0.05, 0.42)
  status(s, gu, gv, zc + 3, 'green', true)
  status(s, ru, rv, zc + 3, 'red', blink)
  const [lu, lv] = P(a1 - 0.1, 0)
  s.lamp(lu, lv, zc + R * KZ + 2, LIT_HI, LIT)
}

export function habitatV2(ctx: Ctx, x: number, y: number, t: number, tier: number) {
  const s = new Iso(ctx, x, y, 0.45)
  const blink = (t * 1.5) % 1 < 0.4
  const base = 3
  pad(s, 2.95, base)

  // dome layout (tile coords from the footprint centre)
  const MAIN = { u: -0.6, v: -0.6, rx: 32, rise: 32 }
  const POD_B = { u: 1.95, v: -0.6, rx: 20, rise: 21 }
  const POD_C = { u: -0.6, v: 1.95, rx: 19, rise: 20 }
  const tiles = (rx: number) => rx / PXT

  // ── back corner: life-support module, piped into the main dome ───────
  const M = { u0: -2.88, u1: -2.2, v0: -1.1, v1: -0.2, top: base + 13 }
  block(s, M.u0, M.u1, M.v0, M.v1, base, M.top, MAT.wall, {
    l: all(
      (c, r, W, H) => (r === 1 || r === 2 ? MAT.green.l : r === H - 2 ? MAT.wall.lo : null),
      slats(1, 4, 4, 7),
      at(6, 4, 5, 5, (c, r, W, H) => (c === 0 || r === 0 || c === W - 1 || r === H - 1 ? FRAME : r === 2 + ((c + Math.floor(t * 4)) % 3 === 0 ? -1 : 0) ? '#c9f4ff' : '#2e6f83')),
      at(8, 10, 1, 1, '#7ee07a'),
      at(10, 10, 1, 1, blink ? '#ff6a5a' : '#8f2f3f'),
    ),
    r: all((c, r, W, H) => (r === 1 || r === 2 ? MAT.green.r : r === H - 2 ? MAT.wall.lo : null), slats(2, 4, 5, 7), slats(8, 4, 5, 7)),
    top: MAT.roof.t,
  })
  block(s, -2.75, -2.33, -0.95, -0.45, M.top, M.top + 2, NE, {
    ground: false,
    t: (c, r, W, H) => {
      const d = Math.hypot(c - W / 2 + 0.5, r - H / 2 + 0.5)
      if (d > 3.2) return null
      if (d < 1) return NE.hi
      return Math.abs(Math.sin(Math.atan2(r - H / 2, c - W / 2) * 2 - t * 9)) > 0.75 ? NE.t : MAT.dark.r
    },
  })
  for (const [z, v] of [
    [base + 9, -0.75],
    [base + 5, -0.55],
  ]) {
    block(s, M.u1, -1.85, v, v + 0.07, z, z + 2, NE, { ground: false })
    s.post(-2.05, v + 0.035, base, z, flat(MAT.dark.l))
  }

  // level 3: a low radiator wall along the back edge
  if (tier >= 3) {
    block(s, -1.6, 1.4, -2.95, -2.88, base + 3, base + 19, FAB, {
      ground: false,
      l: (c, r, W, H) => (r === 0 ? OR.hi : r === 1 ? OR.l : r === H - 1 ? NE.r : c % 3 === 0 ? FAB.r : c % 3 === 1 ? FAB.hi : FAB.l),
      r: () => NE.r,
    })
    for (const u of [-1.5, -0.1, 1.3]) s.post(u, -2.92, base, base + 3, flat(NE.l))
  }

  // ── right corner: water tanks and a battery cabinet ──────────────────
  for (const [tu, tv] of [
    [2.2, -2.5],
    [2.6, -1.95],
  ]) {
    footing(s, tu, tv, 8, base, 2)
    s.vcyl(tu, tv, 7, base + 2, base + 19, flat(NE.l), {
      lid: flat(NE.t),
      spec: false,
      pat: (nx, r, H) => (r === 0 ? NE.hi : nx > -0.55 && nx < -0.25 && r > 3 && r < H - 3 ? (r > 8 ? '#65c9e8' : MAT.dark.r) : r % 6 === 5 ? NE.r : nx < -0.45 ? NE.hi : nx < 0.3 ? NE.l : NE.r),
    })
  }
  block(s, 1.05, 1.6, -2.85, -2.45, base, base + 11, MAT.dark, {
    l: (c, r, W, H) => (r === 0 ? MAT.dark.hi : r === 3 && c > 1 && c < W - 2 ? (c < 5 ? '#7ee07a' : MAT.dark.r) : r === H - 1 ? MAT.dark.lo : c === Math.floor(W / 2) ? MAT.dark.r : null),
  })
  // pipes from the tanks to the sleeping pod
  block(s, 2.0, 2.1, -1.7, -1.35, base + 6, base + 8, NE, { ground: false })

  // ── the domes ────────────────────────────────────────────────────────
  // sandbag wall along the back of the main dome
  for (let k = 0; k < 10; k++) {
    const a = Math.PI + 0.15 + (k / 9) * (Math.PI / 2 - 0.3)
    const R = tiles(MAIN.rx) + 0.25
    const u = MAIN.u + Math.cos(a) * R
    const v = MAIN.v + Math.sin(a) * R
    for (const layer of [0, 1]) {
      const z = base + 2 + layer * 3.5
      s.ell(u + layer * 0.03, v + layer * 0.03, z, 4, 2.5, flat(BAG.t), { cut: -z + base, spec: false, pat: (_u, _v, nz, l) => (nz < 0.28 ? BAG.lo : nz > 0.75 && l > 0.5 ? BAG.hi : band(BAG, l)) })
    }
  }
  const mainTop = dome(s, MAIN.u, MAIN.v, MAIN.rx, MAIN.rise, base, [-0.5, 0.42, 0.79, 1.16, 2.1], [0.2, 0.79, 1.38], 2.6)
  dome(s, POD_B.u, POD_B.v, POD_B.rx, POD_B.rise, base, [0.15, 0.95, 1.5, 2.1], [0.6, 1.4], -0.4)
  tunnel(s, 'u', MAIN.u + tiles(MAIN.rx) - 0.2, POD_B.u - tiles(POD_B.rx) + 0.2, MAIN.v, base + 1, 0.34)
  airlock(s, 'v', POD_B.v + tiles(POD_B.rx) - 0.25, 0.95, POD_B.u, base, blink)

  if (tier >= 2) {
    dome(s, POD_C.u, POD_C.v, POD_C.rx, POD_C.rise, base, [-0.4, 0.15, 0.75, 2.1], [0.4, 1.9], 2.5)
    tunnel(s, 'v', MAIN.v + tiles(MAIN.rx) - 0.2, POD_C.v - tiles(POD_C.rx) + 0.2, MAIN.u, base + 1, 0.34)
    airlock(s, 'u', POD_C.u + tiles(POD_C.rx) - 0.25, 0.95, POD_C.v, base, blink)
  } else {
    // the third pod's footing is down, its fabric still in crates
    footing(s, POD_C.u, POD_C.v, POD_C.rx + 2, base, 3, MAT.pad.l)
    crate(s, -0.95, 1.6, 0.3, base + 4)
    crate(s, -0.55, 1.9, 0.26, base + 4)
    crate(s, -0.85, 1.65, 0.24, base + 9)
    // and a cone marking the gap
    s.vcyl(-0.6, 0.95, 2, base, base + 5, flat(OR.l), { lid: flat(OR.hi), spec: false, pat: (nx, r) => (r === 2 ? FAB.hi : nx < 0 ? OR.t : OR.l) })
  }

  // cupola, railing, antenna and beacon on the main dome
  const CR = 7
  const ctop = mainTop + 3
  s.vcyl(MAIN.u, MAIN.v, CR, mainTop - 3, ctop, flat(NE.l), {
    lid: flat(FAB.t),
    spec: false,
    pat: (nx, r, H, l) => {
      if (r >= 1 && r <= H - 3) return Math.round(nx * 4) % 2 === 0 ? FRAME : tier >= 3 ? (r === 1 ? LIT_HI : LIT) : r === 1 ? GLASS_HI : GLASS
      if (r === H - 2) return l > 0.5 ? OR.t : OR.r
      return band(NE, l + 0.1)
    },
  })
  const RR = (CR + 3) / PXT
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2
    const u = MAIN.u + Math.cos(a) * RR
    const v = MAIN.v + Math.sin(a) * RR
    s.pt(u, v, mainTop + 3, NE.hi, false, 0.02)
    if (k % 2 === 0) for (const z of [1, 2]) s.pt(u, v, mainTop + z, NE.r, false, 0.02)
  }
  const mu = MAIN.u + 0.12
  const mv = MAIN.v - 0.08
  s.post(mu, mv, ctop, ctop + 10, flat(NE.l))
  block(s, mu - 0.08, mu + 0.08, mv - 0.02, mv + 0.02, ctop + 6, ctop + 7, NE, { ground: false })
  status(s, mu, mv, ctop + 11, 'red', blink)

  // ── the yard (front corner) ──────────────────────────────────────────
  // EVA suit rack
  for (const v of [1.5, 2.3]) s.post(1.05, v, base, base + 14, flat(NE.l))
  s.line(1.05, 1.5, base + 14, 1.05, 2.3, base + 14, NE.t)
  const pal: Record<string, string> = { h: FAB.hi, s: FAB.l, v: '#e8c15a', w: FAB.t, o: OR.t, k: NE.r, d: NE.r }
  for (const v of [1.67, 1.97, 2.23]) sprite(s, 1.07, v, base + 1, SUIT, pal, 2)
  // cargo crates
  crate(s, 2.2, 1.75, 0.32, base)
  crate(s, 2.4, 2.2, 0.28, base)
  crate(s, 2.25, 1.8, 0.26, base + 5)
  // mission flag: orange and white on a pole
  s.post(0.15, 2.6, base, base + 24, flat(NE.l))
  for (let r = 0; r < 6; r++)
    for (let c = 0; c < 9; c++) s.pt(0.15, 2.6 - (c + 1) / 16, base + 23 - r - c * 0.15, r < 2 ? OR.t : r < 4 ? FAB.hi : OR.l, false, 0.02)
  // test crops in a planter, and lamps
  planter(s, -2.75, -1.75, 2.2, 2.55, base, 4)
  lampPost(s, 2.7, 0.75, base, 18, true)
  lampPost(s, -2.6, 0.6, base, 18, true)

  s.flush()
}
