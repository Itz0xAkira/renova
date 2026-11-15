/**
 * Ice drill (3×3), clean isometric style. Same machine as before, with room:
 * a lattice derrick with orange-and-white day-marker legs on a white drill
 * floor, its gold-foil top drive pumping the drill string into a foil-wrapped
 * thermal wellhead that breathes vapour. Out front, the core vault: a white
 * cold store whose glazed face shows the extracted ice cores glowing, fed by a
 * glass chute from the wellhead. On the left, the strapped inflatable crew
 * shelter with sandbags; at the back, the pump skid. Level 2 adds a floodlight
 * on the derrick, level 3 a gold-foil coolant tank.
 */
import type { Ctx } from '@/site/pixel/engine'
import { at, all, Iso, KZ, status } from '@/game/art/buildings/life'
import { block, door, flat, FRAME, LIT, LIT_HI, MAT, pad, slats, type Mat } from './flat'

const WHITE: Mat = { t: '#f2ece4', l: '#ddd3cc', r: '#b6a6aa', hi: '#fffcf6', lo: '#8c7a83' }
const GOLD: Mat = { t: '#f3cf6a', l: '#d9ad45', r: '#a87a2e', hi: '#ffeaa6', lo: '#6e4c1e' }
const STRAP: Mat = { t: '#c5b9b2', l: '#a99b94', r: '#82737a', hi: '#dcd2ca', lo: '#5f5059' }
const BAG: Mat = { t: '#e3c7a3', l: '#cda884', r: '#a07c67', hi: '#f1dcbf', lo: '#73534a' }
const ICE = ['#e9f8ff', '#bfe6f7', '#8fcbe6'] as const
const STEAM = ['#ffffff', '#e6eef4', '#c9d6e0'] as const
const OR = MAT.crate
const NE = MAT.metal
const band = (m: Mat, l: number) => (l > 0.86 ? m.hi : l > 0.64 ? m.t : l > 0.44 ? m.l : m.r)

export function drillV2(ctx: Ctx, x: number, y: number, t: number, tier: number) {
  const s = new Iso(ctx, x, y, 0.5)
  const blink = (t * 1.5) % 1 < 0.4
  const base = 3
  pad(s, 1.47, base)

  // ── back: pump skid, and the coolant tank at level 3 ─────────────────
  block(s, 0.55, 1.35, -1.38, -0.85, base, base + 9, WHITE, {
    l: all((c, r, w, h) => (r === 1 ? OR.t : r === h - 2 ? WHITE.lo : null), slats(2, 3, 5, 5), at(9, 3, 1, 1, '#7ee07a'), at(9, 5, 1, 1, blink ? '#ffb340' : '#6e4a1c')),
    r: all((c, r, w, h) => (r === 1 ? OR.l : r === h - 2 ? WHITE.lo : null), slats(1, 3, 6, 5)),
    top: MAT.roof.t,
  })
  // pipe from the pump to the drill floor
  block(s, 0.35, 0.6, -1.0, -0.92, base + 4, base + 6, NE, { ground: false })
  if (tier >= 3) {
    s.vcyl(-1.12, -0.2, 7, base, base + 17, flat(GOLD.t), {
      lid: flat(WHITE.t),
      spec: false,
      pat: (nx, r, H) => (r <= 1 || r >= H - 2 ? (nx < 0 ? WHITE.t : WHITE.r) : Math.round(nx * 9 + r * 0.7) % 4 === 0 ? GOLD.hi : nx < -0.4 ? GOLD.t : nx < 0.35 ? GOLD.l : GOLD.r),
    })
  }

  // ── the drill floor ──────────────────────────────────────────────────
  const F = { u0: -0.75, u1: 0.45, v0: -0.75, v1: 0.45, top: base + 8 }
  block(s, F.u0, F.u1, F.v0, F.v1, base, F.top, WHITE, {
    l: all((c, r, w, h) => (r === 1 ? OR.t : r === h - 2 ? WHITE.lo : c % 6 === 0 && c > 0 ? WHITE.r : null), slats(3, 3, 6, 4), at(12, 3, 5, 4, (c, r, w, h) => (c === 0 || r === 0 || c === w - 1 || r === h - 1 ? FRAME : r === 1 ? LIT_HI : LIT))),
    r: all((c, r, w, h) => (r === 1 ? OR.l : r === h - 2 ? WHITE.lo : null), slats(4, 3, 8, 4)),
    top: NE.t,
    t: (c, r) => (c % 4 === 0 || r % 4 === 0 ? NE.l : null), // grated deck
  })
  // stairs up the lit face
  for (let k = 0; k < 4; k++) block(s, -0.55 + k * 0.12, -0.43 + k * 0.12, F.v1, F.v1 + 0.22, base + k * 2, base + k * 2 + 2, NE, { ground: k === 0 })

  // ── derrick ──────────────────────────────────────────────────────────
  const CU = -0.15
  const CV = -0.15
  const H = 30
  const top = F.top + H
  const spread = (z: number) => 0.5 - (0.36 * (z - F.top)) / H
  const corners: [number, number][] = [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]
  // legs: day-marker bands, lit on the left
  const leg = (cu: number, cv: number) => {
    for (let z = F.top; z <= top; z += 0.5) {
      const k = spread(z)
      const orange = Math.floor((top - z) / 5) % 2 === 0
      const lit = cu < 0 || cv > 0
      const col = orange ? (lit ? OR.t : OR.l) : lit ? WHITE.hi : WHITE.l
      s.pt(CU + cu * k, CV + cv * k, z, col, false, 0.02)
      s.pt(CU + cu * k + 1 / 32, CV + cv * k - 1 / 32, z, orange ? OR.r : WHITE.r, false, 0.019)
    }
  }
  // cross bracing between legs at each stage
  const stages = [F.top, F.top + 8, F.top + 15, F.top + 22, top]
  const brace = (a: [number, number], b: [number, number], c: string | null) => {
    for (let i = 0; i + 1 < stages.length; i++) {
      const [z0, z1] = [stages[i], stages[i + 1]]
      const [k0, k1] = [spread(z0), spread(z1)]
      // one diagonal per stage, alternating, and the horizontal girt
      if (c) i % 2 ? s.line(CU + a[0] * k0, CV + a[1] * k0, z0, CU + b[0] * k1, CV + b[1] * k1, z1, c) : s.line(CU + b[0] * k0, CV + b[1] * k0, z0, CU + a[0] * k1, CV + a[1] * k1, z1, c)
      s.line(CU + a[0] * k1, CV + a[1] * k1, z1, CU + b[0] * k1, CV + b[1] * k1, z1, c ?? NE.r)
    }
  }
  brace([-1, -1], [1, -1], null)
  brace([-1, -1], [-1, 1], null)
  leg(-1, -1)

  // wellhead in gold foil, breathing vapour
  s.vcyl(CU, CV, 5, F.top, F.top + 3, flat(NE.l), { lid: flat(NE.t), spec: false, pat: (nx) => (nx < -0.3 ? NE.t : nx < 0.3 ? NE.l : NE.r) })
  s.ell(CU, CV, F.top + 3, 4, 3, flat(GOLD.t), { cut: 0, spec: false, pat: (_u, _v, nz, l) => (nz > 0.8 ? GOLD.hi : band(GOLD, l)) })
  if (t > 0)
    for (let k = 0; k < 3; k++) {
      const rise = (t * 4 + k * 1.7) % 7
      s.pt(CU + 0.1 + k * 0.05, CV - 0.1, F.top + 7 + rise, STEAM[rise > 4 ? 2 : rise > 2 ? 1 : 0], false, 0.2)
      if (rise > 3) s.pt(CU + 0.16 + k * 0.05, CV - 0.1, F.top + 7 + rise, STEAM[2], false, 0.2)
    }
  // drill string and the gold top drive, pumping up and down
  const stroke = Math.round((1 - Math.cos(t * Math.PI)) * 5)
  const tdZ = top - 9 - stroke
  for (let z = F.top + 6; z < tdZ; z++) s.pt(CU, CV, z, (z - F.top) % 5 === 0 ? GOLD.l : NE.hi, false, 0.03)
  for (let z = tdZ + 5; z < top; z++) {
    s.pt(CU - 0.06, CV, z, NE.t, false, 0.03)
    s.pt(CU + 0.06, CV, z, NE.r, false, 0.03)
  }
  block(s, CU - 0.13, CU + 0.13, CV - 0.13, CV + 0.13, tdZ, tdZ + 5, GOLD, { ground: false, l: (c, r, w, h) => (r === h - 1 ? OR.t : null), r: (c, r, w, h) => (r === h - 1 ? OR.l : null) })

  brace([-1, 1], [1, 1], NE.hi)
  brace([1, -1], [1, 1], NE.l)
  leg(1, -1)
  leg(-1, 1)
  leg(1, 1)
  // racking platform with a rail, halfway up on the lit side
  const pz = F.top + 15
  const pk = spread(pz)
  block(s, CU - pk - 0.12, CU + pk, CV + pk, CV + pk + 0.16, pz - 1, pz, NE, { ground: false })
  for (let a = CU - pk - 0.12; a <= CU + pk; a += 1 / 32) s.pt(a, CV + pk + 0.16, pz + 3, OR.t, false, 0.02)
  // crown block, sheave, antenna and beacon
  block(s, CU - 0.18, CU + 0.18, CV - 0.18, CV + 0.18, top, top + 3, NE, { ground: false, t: (c, r) => (c < 3 ? OR.t : null) })
  s.vcyl(CU, CV, 2, top + 3, top + 4, flat(OR.t), { lid: flat(OR.hi), spec: false })
  s.post(CU + 0.1, CV - 0.1, top + 3, top + 9, flat(NE.l))
  status(s, CU + 0.1, CV - 0.1, top + 10, 'red', blink)
  if (tier >= 2) {
    const fz = F.top + 12
    const fk = spread(fz)
    block(s, CU + fk, CU + fk + 0.12, CV - fk - 0.06, CV - fk + 0.06, fz, fz + 2, NE, { ground: false })
    s.lamp(CU + fk + 0.14, CV - fk, fz + 1, '#ffffff', LIT)
  }

  // ── front: the core vault, its glazed face full of glowing ice cores ──
  const V = { u0: 0.55, u1: 1.38, v0: 0.15, v1: 1.35, top: base + 13 }
  const glow = 0.5 + 0.5 * Math.sin(t * Math.PI)
  block(s, V.u0, V.u1, V.v0, V.v1, base, V.top, WHITE, {
    // lit face (v = v1) is short: a narrow window. The long shaded face (u = u1) holds the glazed store.
    l: all((c, r, w, h) => (r === 1 ? OR.t : r === h - 2 ? WHITE.lo : null), at(2, 3, 9, 7, (c, r, w, h) => (c === 0 || r === 0 || c === w - 1 || r === h - 1 ? FRAME : ICE[(c + r) % 2 ? 1 : 2]))),
    r: all(
      (c, r, w, h) => (r === 1 ? OR.l : r === h - 2 ? WHITE.lo : null),
      at(2, 3, 13, 8, (c, r, w, h) => {
        if (c === 0 || r === 0 || c === w - 1 || r === h - 1) return FRAME
        // ice cores standing in racks: pale columns with a bright top
        if (c % 3 === 1) return r === 1 ? ICE[0] : glow > 0.5 && r < 3 ? '#ffffff' : ICE[1]
        return r === h - 2 ? NE.r : '#2e5d73'
      }),
      at(16, 3, 5, 8, door(0, 0, 5, 8, NE)),
    ),
    top: MAT.roof.t,
  })
  // a cooling fan on the vault roof
  block(s, 0.75, 1.15, 0.45, 0.85, V.top, V.top + 2, NE, {
    ground: false,
    t: (c, r, w, h) => {
      const d = Math.hypot(c - w / 2 + 0.5, r - h / 2 + 0.5)
      if (d > 3) return null
      if (d < 1) return NE.hi
      return Math.abs(Math.sin(Math.atan2(r - h / 2, c - w / 2) * 2 - t * 9)) > 0.75 ? NE.t : MAT.dark.r
    },
  })
  // glass chute from the drill floor down to the vault, an ice core sliding along it
  const chute = (f: number) => [F.u1 - 0.05 + (V.u0 + 0.2 - F.u1) * f, 0.1 + 0.35 * f, F.top + 5 - (F.top + 5 - V.top - 1) * f] as const
  for (let f = 0; f <= 1; f += 0.02) {
    const [u, v, z] = chute(f)
    s.pt(u, v, z, ICE[2], false, 0.04)
    s.pt(u, v, z + 1, ICE[1], false, 0.04)
    s.pt(u, v, z + 2, '#d7f1fb', false, 0.04)
  }
  {
    const [u, v, z] = chute((t * 0.5) % 1)
    s.pt(u, v, z + 1, '#ffffff', false, 0.06)
    s.pt(u + 0.03, v, z + 1, ICE[0], false, 0.06)
  }
  status(s, V.u1, 0.3, V.top - 2, 'green', true)

  // ── left: the inflatable crew shelter, strapped and sandbagged ───────
  const SR = 0.3
  s.hcyl('u', -1.4, -0.35, 0.95, base + SR * KZ, SR, flat(WHITE.t), {
    pat: (s0, th, l) => {
      if (Math.abs((s0 % 4) - 2) < 0.45) return band(STRAP, l)
      if (Math.abs(th - 1.57) < 0.08) return WHITE.r
      if (Math.abs(th - 1.0) < 0.18 && Math.round(s0) % 8 === 6) return LIT
      return band(WHITE, l)
    },
    cap: (rr, th, l) => (rr > 0.86 ? WHITE.r : rr < 0.5 && Math.sin(th) > -0.1 ? (rr < 0.36 ? (rr < 0.15 ? LIT_HI : FRAME) : OR.t) : l > 0.6 ? WHITE.hi : WHITE.t),
  })
  for (let k = 0; k < 6; k++) {
    const u = -1.35 + k * 0.18
    s.ell(u, 1.33, base + 2, 4, 2.5, flat(BAG.t), { cut: -2, spec: false, pat: (_u, _v, nz, l) => (nz < 0.28 ? BAG.lo : nz > 0.75 && l > 0.5 ? BAG.hi : band(BAG, l)) })
  }
  status(s, -0.33, 0.95, base + SR * KZ * 2 + 1, 'green', true)
  s.flush()
}
