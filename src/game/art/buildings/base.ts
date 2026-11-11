/**
 * The colony core, the lander, and the research lab.
 *
 * Each function draws one building on ground point (x, y), the centre of its
 * footprint. A w×h footprint spans ±(w+h)·8 px across and ±(w+h)·4 px down.
 * `t` is animation time; frame 0 (t = 0) doubles as the idle pose.
 * The core and lab are modelled with the iso renderer from ./life.
 */
import { rect, type Ctx } from '@/site/pixel/engine'
import { band, cyl, getTier, GLOW, INK, plinth, RAMP, tone } from '@/game/art/pixel'
import { M, MH, R, S, CY, SG, OLIVE } from '@/game/art/buildings/kit'
import { ALERT, all, armour, at, cyanWin, grille, hazard, hazardDim, Iso, label, litDoor, louvre, roofFan, seams, WARM, warmWin, type Pat } from '@/game/art/buildings/life'

/* --------------------------------- lander -------------------------------- */

/** The lander / supply rocket. Base at (x, y); spans x − 10…x + 10 and 46 px up. */
export function rocket(ctx: Ctx, x: number, y: number, t: number) {
  const N = RAMP.neutral
  // landing legs with foot pads
  for (let k = 0; k < 7; k++) {
    rect(ctx, x - 6 - (k >> 1), y - 7 + k, 1, 1, M[3])
    rect(ctx, x + 5 + (k >> 1), y - 7 + k, 1, 1, M[1])
  }
  rect(ctx, x - 7, y - 4, 2, 1, M[4]) // leg struts
  rect(ctx, x + 5, y - 4, 2, 1, M[2])
  rect(ctx, x - 10, y, 3, 1, M[2])
  rect(ctx, x + 8, y, 3, 1, M[1])
  rect(ctx, x - 10, y - 1, 3, 1, M[4])
  rect(ctx, x + 8, y - 1, 3, 1, M[2])
  // engine bell
  for (let k = 0; k < 3; k++) rect(ctx, x - 2 - k, y - 3 + k, 5 + k * 2, 1, M[k + 1])
  rect(ctx, x - 1, y - 1, 3, 1, (t * 3) % 1 < 0.5 ? SG[1] : M[0])
  // hull
  cyl(ctx, x, y - 3, 5, 30, N, M)
  band(ctx, x, y - 3, 5, 2, 2, (dx) => ((dx + 5) % 4 < 2 ? INK : SG[dx < 0 ? 4 : 2])) // hazard skirt
  band(ctx, x, y - 3, 5, 6, 2, (dx) => (dx < 0 ? R[4] : R[2]))
  band(ctx, x, y - 3, 5, 18, 3, (dx) => ((dx + 5) % 4 < 2 ? INK : dx < 0 ? R[4] : R[2]))
  band(ctx, x, y - 3, 5, 26, 1, (dx) => (dx < 0 ? N[1] : N[0])) // panel seams
  band(ctx, x, y - 3, 5, 12, 1, (dx) => (dx < 0 ? N[1] : N[0]))
  for (let k = 0; k < 24; k += 3) rect(ctx, x + 2, y - 30 + k, 1, 2, N[0])
  // nose cone
  for (let k = 0; k < 10; k++) {
    const w = Math.max(1, Math.round(5 * (1 - k / 10)))
    for (let dx = -w; dx < w; dx++) rect(ctx, x + dx, y - 34 - k, 1, 1, tone(N, 0.85 - ((dx + w) / (2 * w)) * 0.6, x + dx, y - k))
  }
  rect(ctx, x - 3, y - 36, 6, 1, R[2]) // nose band
  // fins
  for (const s of [-1, 1]) for (let k = 0; k < 5; k++) rect(ctx, x + s * (5 + (k >> 1)) - (s < 0 ? 1 : 0), y - 11 + k, 1, 1, s < 0 ? R[4] : R[1])
  // RCS thruster quads
  rect(ctx, x - 6, y - 31, 1, 2, M[3])
  rect(ctx, x + 5, y - 31, 1, 2, M[1])
  // crew windows and hatch
  rect(ctx, x - 2, y - 25, 3, 3, INK)
  rect(ctx, x - 1, y - 24, 1, 1, GLOW)
  rect(ctx, x - 2, y - 30, 2, 2, INK)
  rect(ctx, x - 2, y - 30, 1, 1, CY[4])
  rect(ctx, x - 3, y - 16, 4, 6, N[1])
  rect(ctx, x - 2, y - 15, 2, 4, M[2])
  rect(ctx, x - 1, y - 14, 1, 1, WARM[3])
  lamp2(ctx, x, y - 45, (t * 1.2) % 1 < 0.3 ? ALERT[4] : ALERT[0], ALERT[1])
}

function lamp2(ctx: Ctx, x: number, y: number, core: string, halo: string) {
  rect(ctx, x - 1, y, 3, 1, halo)
  rect(ctx, x, y - 1, 1, 3, halo)
  rect(ctx, x, y, 1, 1, core)
}

/* ------------------------------ shared parts ----------------------------- */

/** A three-legged lattice mast from z0 to z1 with zig-zag bracing, tapering to the top. */
function mast(s: Iso, u: number, v: number, z0: number, z1: number, w = 0.24) {
  const leg = (k: number, z: number): [number, number] => {
    const f = w * (1 - 0.6 * ((z - z0) / (z1 - z0)))
    const a = (k / 3) * Math.PI * 2 + 0.6
    return [u + Math.cos(a) * f, v + Math.sin(a) * f]
  }
  for (let k = 0; k < 3; k++) {
    const [ua, va] = leg(k, z0)
    const [ub, vb] = leg(k, z1)
    s.line(ua, va, z0, ub, vb, z1, k === 1 ? MH[4] : k === 2 ? MH[3] : MH[1])
  }
  for (let z = z0; z < z1 - 2; z += 7)
    for (let k = 0; k < 3; k++) {
      const [ua, va] = leg(k, z)
      const [ub, vb] = leg((k + 1) % 3, z + 7)
      s.line(ua, va, z, ub, vb, z + 7, k === 1 ? MH[2] : M[3], -0.02)
    }
}

/** A comms dish on a post: a tilted bowl facing the sky to the upper left, with a feed horn. */
function dish(s: Iso, u: number, v: number, z: number, r: number) {
  s.post(u, v, z - 7, z - 1, M)
  const cx = s.X(u, v)
  const cy = s.Y(u, v, z)
  const d = u + v + z / 24 + 0.15
  const ca = Math.cos(0.45)
  const sa = Math.sin(0.45)
  const rb = r * 0.5
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const a = (dx + 0.5) * ca + (dy + 0.5) * sa
      const b = -(dx + 0.5) * sa + (dy + 0.5) * ca
      const q = (a / r) ** 2 + (b / rb) ** 2
      if (q > 1) continue
      const px = Math.floor(cx) + dx
      const py = Math.floor(cy) + dy
      let col: string
      if (q > 0.72) col = b < 0 ? MH[4] : b > rb * 0.4 ? M[2] : MH[2]
      else col = tone(MH, 0.12 + 0.7 * ((a / r + b / rb) / 2 + 0.5), px, py)
      s.put(px, py, d, col)
    }
  // feed horn on three struts
  const fx = Math.floor(cx) - 2
  const fy = Math.floor(cy) - Math.round(r * 0.7)
  for (let k = 0; k <= 4; k++) s.put(Math.round(fx + (2 * k) / 4), Math.round(fy + ((Math.round(r * 0.7)) * k) / 4), d + 0.01, M[4])
  s.put(fx, fy, d + 0.02, SG[4])
  s.put(fx - 1, fy, d + 0.02, M[3])
}

/** A flat ellipse painted on the plinth top (screen-space decal). */
function decal(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, col: (nx: number, ny: number, d: number, px: number, py: number) => string | null) {
  for (let dy = -ry; dy < ry; dy++)
    for (let dx = -rx; dx < rx; dx++) {
      const nx = (dx + 0.5) / rx
      const ny = (dy + 0.5) / ry
      const d = Math.hypot(nx, ny)
      if (d > 1) continue
      const c = col(nx, ny, d, cx + dx, cy + dy)
      if (c) rect(ctx, cx + dx, cy + dy, 1, 1, c)
    }
}

/* ---------------------------------- core --------------------------------- */

/** Drone pads and the ship's landing ring, as ground-px offsets from the footprint centre, on the plinth top. */
const CORE_PADS = [
  [-7, -16],
  [7, -16],
] as const
const CORE_RING = [0, 16] as const
const CORE_P = 6

/**
 * Colony core (3×3): the command centre. The back tile is a flat apron with
 * two drone pads, the front tile the supply ship's landing ring with chase
 * lights. Tall parts stand on the side corners so neither is hidden: on the
 * left, the armoured command block with a control tower and its glass cab; on
 * the right, the comms and power block with a big dish and a lattice mast.
 * A fuel skid and pipes sit on the low middle tile.
 */
export function coreBuilding(ctx: Ctx, x: number, y: number, t: number) {
  const g = plinth(ctx, x, y, 3, 3, CORE_P, RAMP.signal)
  const blink = (t * 1.5) % 1 < 0.4

  // drone pads: dark discs, yellow rings, an H, two corner lights
  for (const [dx, dy] of CORE_PADS) {
    const cx = x + dx
    const cy = y + dy - CORE_P
    decal(ctx, cx, cy, 6, 3, (nx, ny, d, px, py) => (d > 0.8 ? SG[3] : tone(M, 0.5 - ny * 0.1, px, py)))
    rect(ctx, cx - 2, cy - 1, 1, 3, SG[4])
    rect(ctx, cx + 1, cy - 1, 1, 3, SG[4])
    rect(ctx, cx - 1, cy, 2, 1, SG[4])
    rect(ctx, cx - 6, cy, 1, 1, (t * 2 + dx / 7) % 1 < 0.5 ? GLOW : CY[2])
    rect(ctx, cx + 5, cy - 1, 1, 1, (t * 2 + dx / 7 + 0.5) % 1 < 0.5 ? GLOW : CY[2])
  }
  // landing ring: hazard rim, dashed inner circle, centre cross, chase lights
  {
    const cx = x + CORE_RING[0]
    const cy = y + CORE_RING[1] - CORE_P
    decal(ctx, cx, cy, 14, 7, (nx, ny, d, px, py) => {
      if (d > 0.9) return (Math.round(Math.atan2(ny, nx) * 6) & 1) === 0 ? SG[4] : INK
      if (d > 0.84) return M[0]
      if (Math.abs(d - 0.55) < 0.07) return (Math.round(Math.atan2(ny, nx) * 5) & 1) === 0 ? SG[3] : null
      return tone(M, 0.52 - ny * 0.08, px, py)
    })
    rect(ctx, cx - 3, cy, 6, 1, SG[4])
    rect(ctx, cx - 1, cy - 1, 2, 3, SG[4])
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2
      const on = Math.floor(t * 4) % 8 === k
      rect(ctx, Math.round(cx + Math.cos(a) * 13) - (Math.cos(a) > 0 ? 1 : 0), Math.round(cy + Math.sin(a) * 6.5), 1, 1, on ? GLOW : CY[1])
    }
  }

  const s = new Iso(ctx, x, g)
  // low railing along the two back edges, behind the pads
  for (let a = -1.42; a <= 1.42; a += 1 / 16) {
    s.pt(a, -1.42, 3, M[3])
    s.pt(-1.42, a, 3, M[4])
  }
  for (let a = -1.4; a <= 1.42; a += 0.35) {
    s.line(a, -1.42, 0, a, -1.42, 3, M[2])
    s.line(-1.42, a, 0, -1.42, a, 3, M[3])
  }

  /* left: armoured command block with the control tower */
  const LH = 24
  s.box(-1.42, -0.5, 0.32, 1.42, 0, LH, M, {
    roof: MH,
    l: all(at(3, 7, 8, 14, litDoor(WARM[3])), at(2, 6, 10, 1, SG[4]), at(0, LH - 2, 99, 2, hazard), at(0, 0, 99, 4, armour(4, 'l')), seams(5, M, 'l')),
    r: all(at(2, 6, 6, 5, warmWin()), at(10, 6, 6, 5, warmWin()), at(2, 13, 14, 3, label(0b101110110101)), at(4, 17, 4, 4, louvre('r')), at(0, 0, 99, 4, armour(4, 'r')), seams(6, M, 'r')),
    t: (a, b) => (a === 2 || b === 2 ? M[2] : null),
  })
  // the tower shaft
  const T0 = LH
  const T1 = 50
  s.box(-1.22, -0.78, 0.55, 1.15, T0, T1, M, {
    roof: M,
    l: all(at(0, 0, 99, 1, MH[3]), (c, r) => (r % 6 === 3 && c > 0 && c < 6 ? WARM[2] : r % 6 === 2 || r % 6 === 4 ? (c > 0 && c < 6 ? INK : null) : null), seams(4, M, 'l')),
    r: all((c, r) => (c === 3 && r > 2 ? (r % 3 === 0 ? MH[3] : M[0]) : null), (c, r) => (c > 5 && c < 9 && r % 6 > 1 && r % 6 < 5 ? (r % 6 === 2 ? CY[3] : CY[1]) : null)),
  })
  // control cab: wider glass room
  const C0 = T1
  const C1 = 60
  const cab: Pat = (c, r, w, h) => {
    if (r === 0 || r === h - 1) return INK
    if (r === h - 2) return M[2]
    if (c % 4 === 0) return INK
    if (r === 1) return GLOW
    return (c + r) % 7 === 0 ? GLOW : r < 4 ? CY[4] : CY[3]
  }
  s.box(-1.34, -0.66, 0.43, 1.27, C0 - 2, C0, M, { roof: MH })
  s.box(-1.3, -0.7, 0.47, 1.23, C0, C1, M, { l: cab, r: (c, r, w, h) => (cab(c, r, w, h) === CY[4] ? CY[2] : cab(c, r, w, h) === CY[3] ? CY[1] : cab(c, r, w, h)) })
  s.box(-1.36, -0.64, 0.41, 1.29, C1, C1 + 2, M, { roof: MH, t: (a, b) => ((a + b) % 6 === 0 ? M[3] : null) })
  // cab catwalk railing
  for (let a = 0; a <= 1; a += 1 / 24) {
    s.pt(-1.4 + 0.8 * a, 1.33, C0 + 2, M[4])
    s.pt(-0.6, 0.37 + 0.96 * a, C0 + 2, M[2])
  }
  // antenna mast on the cab roof, with beacon
  s.post(-1.0, 0.85, C1 + 2, C1 + 11, MH)
  s.line(-1.08, 0.85, C1 + 8, -0.92, 0.85, C1 + 8, M[3])
  s.line(-1.08, 0.85, C1 + 5, -0.92, 0.85, C1 + 5, M[3])
  s.lamp(-1.0, 0.85, C1 + 13, blink ? ALERT[4] : ALERT[0], ALERT[1])
  s.post(-1.2, 1.05, C1 + 2, C1 + 8, M)
  s.lamp(-1.2, 1.05, C1 + 9, (t * 2) % 1 < 0.5 ? GLOW : CY[2], CY[1])
  // ladder up the tower's lit side
  for (let z = LH; z < C0 - 2; z++) {
    s.pt(-0.86, 1.16, z, M[4], false, 0.02)
    s.pt(-0.8, 1.16, z, M[4], false, 0.02)
    if (z % 3 === 0) s.line(-0.86, 1.16, z, -0.8, 1.16, z, MH[3], 0.02)
  }

  /* right: comms and power block with the big dish and the cable mast */
  const RH = 18
  s.box(0.32, 1.42, -1.42, -0.55, 0, RH, S, {
    roof: M,
    l: all(at(2, 4, 4, 9, litDoor(GLOW)), at(8, 4, 5, 4, cyanWin), at(0, RH - 2, 99, 2, hazard), (c) => (c % 3 === 0 ? S[1] : null)),
    r: all(at(2, 4, 12, 6, grille), at(2, 12, 12, 3, label(0b110101101011, INK, SG[2])), at(0, RH - 2, 99, 2, hazardDim), (c) => (c % 3 === 0 ? S[0] : null)),
    t: all(roofFan(13, 6, 3.5, t), (a, b) => (a % 5 === 0 || b === 0 ? M[1] : null)),
  })
  // battery cabinets along its front, glowing charge bars
  for (let k = 0; k < 3; k++) {
    const u0 = 0.42 + k * 0.32
    s.box(u0, u0 + 0.26, -0.55, -0.42, 0, 9, M, {
      l: (c, r) => (c > 0 && c < 3 && r > 1 && r < 8 ? (r > 7 - Math.round(((Math.sin(t * Math.PI + k) + 1) / 2) * 5) ? GLOW : CY[0]) : null),
    })
  }
  dish(s, 0.72, -0.95, RH + 11, 10)
  // lattice comms mast: the power cables attach to its top
  const MU = 1.1
  const MV = -1.16
  const MTOP = 58
  mast(s, MU, MV, RH, MTOP)
  s.line(MU - 0.2, MV, MTOP - 6, MU + 0.2, MV, MTOP - 6, MH[3])
  s.line(MU, MV - 0.2, MTOP - 10, MU, MV + 0.2, MTOP - 10, MH[2])
  s.lamp(MU, MV, MTOP + 2, blink ? ALERT[4] : ALERT[0], ALERT[1])
  s.lamp(MU + 0.2, MV, MTOP - 6, SG[4], SG[2])

  /* middle tile: low fuel skid and pipes (kept low so the pads stay in view) */
  for (const u of [-0.25, 0.2]) s.box(u - 0.05, u + 0.05, -0.42, 0.14, 0, 2, M, { edge: false })
  s.hcyl('u', -0.38, 0.32, -0.14, 5, 0.2, RAMP.neutral, { pat: (s0, th) => (Math.abs(s0 - 4) < 1.5 || Math.abs(s0 - 7) < 0.6 ? R[3] : th > 3.6 && th < 5.8 ? RAMP.neutral[1] : null) })
  // fuel and power lines to the landing ring
  s.line(0.35, -0.15, 1.5, 0.62, -0.15, 1.5, MH[3])
  s.line(0.35, 0.15, 1.5, 0.62, 0.15, 1.5, SG[3])
  s.box(0.56, 0.68, -0.2, 0.2, 0, 4, M, { l: (c) => (c === 1 ? SG[4] : null), r: (c, r) => (r === 1 && c > 0 ? CY[3] : null) })
  // floodlight posts at the side corners, aimed at the ring
  for (const [u, v] of [
    [-0.25, 1.38],
    [1.38, -0.25],
  ] as const) {
    s.post(u, v, 0, 14, M)
    s.box(u - 0.06, u + 0.06, v - 0.06, v + 0.06, 14, 16, M, { t: () => M[3] })
    s.lamp(u, v, 13, WARM[4], WARM[2])
  }
  // air-handling stack on the command block roof
  s.vcyl(-0.66, 0.5, 2, LH, LH + 6, M, { lid: [INK, INK, INK, INK, INK] })
  s.flush()
}

/* ---------------------------------- lab ---------------------------------- */

/** Scrolling scope traces for lab screens. */
const screens =
  (t: number, side: 'l' | 'r'): Pat =>
  (c, r, w, h) => {
    if (c === 0 || r === 0 || c === w - 1 || r === h - 1) return INK
    if (c % 7 === 0) return INK
    const k = Math.floor(c / 7)
    const wave = Math.round(h / 2 - 1 + Math.sin((c + t * 8) * (0.7 + k * 0.3)) * (h / 2 - 2))
    if (k % 3 === 1 && r === wave) return RAMP.veg[4]
    if (k % 3 === 0 && r > h - 2 - (((c * 5 + k) % 4) + 1)) return side === 'l' ? GLOW : CY[4]
    if (k % 3 === 2 && (r === 2 || r === 4) && c % 7 < 5) return WARM[3]
    return side === 'l' ? (r < 2 ? CY[3] : CY[2]) : CY[1]
  }

/**
 * Research lab (3×3): an observatory at the back with a slotted dome and a
 * telescope, a two-storey lab block in front with a band of glowing screens
 * and a lit airlock, a sample-prep container on the left and a lattice sensor
 * mast with a sweeping radar on the right. Level 2 adds a roof dish and solar
 * trim; level 3 a second sensor array and a glowing data core.
 */
export function bigLab(ctx: Ctx, x: number, y: number, t: number) {
  const tier = getTier()
  const g = plinth(ctx, x, y, 3, 3, 6)
  const s = new Iso(ctx, x, g)
  const blink = (t * 1.5) % 1 < 0.4

  // observatory at the back: drum, rust band, slotted dome and telescope
  const OU = -0.72
  const OV = -0.72
  const OH = 31
  s.vcyl(OU, OV, 17, 0, OH, S, {
    lid: false,
    pat: (nx, r, H, l, px, py) => {
      if (r < 2) return M[1]
      if (r >= 4 && r <= 6) return tone(R, l + 0.05, px, py)
      if (r >= 10 && r <= 14 && Math.abs(nx + 0.25) < 0.22) return r === 10 || r === 14 || Math.abs(nx + 0.25) > 0.18 ? INK : r === 11 ? WARM[4] : WARM[2]
      if (r > H - 3) return tone(M, l, px, py)
      if (Math.round(nx * 8) % 2 === 0 && r % 5 === 0) return tone(S, l - 0.15, px, py)
      return null
    },
  })
  s.ell(OU, OV, OH, 16, 14, RAMP.neutral, {
    cut: 0,
    spec: true,
    pat: (nu, nv, nz) => {
      // a dark open slit running over the top, toward the upper left
      const across = nu + nv * 0.15
      if (Math.abs(across) < 0.14 && nz > 0.2) return Math.abs(across) > 0.1 ? M[2] : INK
      if (nz < 0.12) return M[3]
      if (Math.abs(nz - 0.5) < 0.03) return RAMP.neutral[1]
      return null
    },
  })
  // telescope tube poking out of the slit toward the upper left
  for (let k = 0; k < 12; k++) {
    const u = OU - 0.05 - k * 0.03
    const v = OV + 0.02 + k * 0.012
    const z = OH + 7 + k * 1.1
    s.pt(u, v, z + 1, k === 11 ? GLOW : MH[4], false, 0.6)
    s.pt(u, v, z, k === 11 ? CY[3] : MH[2], false, 0.6)
    s.pt(u + 0.03, v - 0.03, z, M[1], false, 0.59)
  }
  // sensor mast with a sweeping radar (right)
  const MU = 0.95
  const MV = -1.05
  const MT = 56
  mast(s, MU, MV, 0, MT)
  const ang = t * Math.PI
  const ru = Math.cos(ang) * 0.3
  const rv = Math.sin(ang) * 0.3
  s.line(MU - ru, MV - rv, MT + 1, MU + ru, MV + rv, MT + 1, MH[4], 0.1)
  s.line(MU - ru, MV - rv, MT, MU + ru, MV + rv, MT, M[2], 0.1)
  s.post(MU, MV, MT - 2, MT + 1, M)
  s.lamp(MU, MV, MT + 4, blink ? ALERT[4] : ALERT[0], ALERT[1])
  s.box(MU - 0.2, MU + 0.2, MV - 0.2, MV + 0.2, 0, 7, M, { l: louvre('l'), r: louvre('r'), roof: MH })
  if (tier >= 3) {
    // a second array: crossbars with sensor pods
    for (const z of [MT - 14, MT - 22]) {
      s.line(MU - 0.25, MV, z, MU + 0.25, MV, z, MH[3])
      s.pt(MU - 0.25, MV, z + 1, CY[4], false, 0.05)
      s.pt(MU + 0.25, MV, z + 1, CY[4], false, 0.05)
    }
  }

  // sample-prep container (left), olive with a fan
  s.box(-1.4, -0.5, 0.42, 1.38, 0, 13, OLIVE, {
    l: all(at(2, 3, 5, 5, cyanWin), at(9, 2, 5, 9, litDoor(WARM[3])), (c) => (c % 3 === 0 ? OLIVE[1] : null), at(0, 11, 99, 2, hazard)),
    r: all(at(3, 3, 9, 6, louvre('r')), (c) => (c % 3 === 0 ? OLIVE[0] : null)),
    t: roofFan(7, 8, 4, t * 1.3),
  })
  // sample hopper on its roof
  s.vcyl(-0.75, 0.62, 3, 13, 19, R, { lid: M })

  // the lab block: ground floor with a screen band, setback upper floor
  const LH = 15
  s.box(-0.3, 1.4, -0.3, 1.4, 0, LH, M, {
    roof: MH,
    l: all(at(2, 3, 20, 7, screens(t, 'l')), at(24, 2, 7, 12, litDoor(GLOW)), at(23, 1, 9, 1, CY[4]), at(0, LH - 2, 99, 2, hazard), seams(8, M, 'l')),
    r: all(at(2, 3, 13, 6, warmWin()), at(17, 3, 7, 6, louvre('r')), at(26, 2, 6, 10, litDoor(WARM[3], 'r')), at(0, LH - 2, 99, 2, hazardDim), seams(8, M, 'r')),
    t: (a, b) => (a === 1 || b === 1 ? M[3] : null),
  })
  const UH = LH + 13
  s.box(-0.15, 1.0, -0.15, 1.0, LH, UH, R, {
    roof: M,
    l: all(at(2, 3, 14, 6, screens(t + 0.5, 'l')), at(0, 0, 99, 1, R[4]), at(0, UH - LH - 2, 99, 2, armour(4, 'l'))),
    r: all(at(2, 3, 6, 5, cyanWin), at(10, 3, 6, 5, cyanWin), at(0, UH - LH - 2, 99, 2, armour(4, 'r'))),
    t: (a, b) => (a % 6 === 0 || b % 6 === 0 ? M[2] : null),
  })
  // balcony railing on the lower roof
  for (let a = -0.25; a <= 1.38; a += 1 / 16) {
    s.pt(a, 1.37, LH + 3, M[4])
    s.pt(1.37, a, LH + 3, M[2])
  }
  for (let a = -0.2; a <= 1.38; a += 0.3) {
    s.line(a, 1.37, LH, a, 1.37, LH + 3, M[3])
    s.line(1.37, a, LH, 1.37, a, LH + 3, M[2])
  }
  // roof gear on the upper floor
  s.box(0.0, 0.3, 0.0, 0.3, UH, UH + 4, M, { l: grille, r: grille })
  if (tier >= 2) {
    dish(s, 0.65, 0.55, UH + 8, 8)
    // solar trim along the lower roof
    s.box(1.05, 1.32, -0.2, 1.3, LH, LH + 1.5, M, { t: (a, b) => (b % 4 === 0 || a === 0 ? MH[2] : (a + b) % 5 === 0 ? CY[4] : CY[1]) })
  } else s.post(0.6, 0.6, UH, UH + 10, MH)
  if (tier >= 3)
    // a glowing data core on the roof
    s.vcyl(0.3, 0.75, 4, UH, UH + 7, M, { lid: CY, pat: (nx, r) => (r > 1 && r < 5 && Math.abs(nx) < 0.7 ? (r === 2 ? GLOW : CY[4]) : null) })
  s.lamp(1.38, 1.38, LH + 2, WARM[4], WARM[2])
  s.flush()
}
