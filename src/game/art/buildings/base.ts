/**
 * The colony core, the lander, and the research lab, in the expedition style
 * (white composite hulls, light grey structure, orange accents, gold foil).
 *
 * Each function draws one building on ground point (x, y), the centre of its
 * footprint. A w×h footprint spans ±(w+h)·8 px across and ±(w+h)·4 px down.
 * `t` is animation time; frame 0 (t = 0) doubles as the idle pose.
 * The core and lab are modelled with the iso renderer from ./life.
 */
import { rect, type Ctx } from '@/site/pixel/engine'
import { getTier, INK, plinth, RAMP, tone } from '@/game/art/pixel'
import { ALERT, all, at, AU, dust, dustPx, fanTop, foil, hatch, hose, Iso, LAMP, NE, NV, OR, orange, panels, radiator, solarTop, status, stencil, vent, WARM, WH, winW, type Pat } from '@/game/art/buildings/life'

const ST = RAMP.stone

/* --------------------------------- lander -------------------------------- */

/**
 * The supply lander. Base at (x, y); spans x − 10…x + 10 and 46 px up: light
 * grey legs, a gold-foil descent stage over a dark engine bell, a white
 * capsule with an orange band, a warm-lit window and a hatch, a docking
 * collar and a beacon.
 */
export function rocket(ctx: Ctx, x: number, y: number, t: number) {
  // legs with foot pads
  for (let k = 0; k < 8; k++) {
    rect(ctx, x - 6 - (k >> 1), y - 8 + k, 1, 1, NE[3])
    rect(ctx, x + 5 + (k >> 1), y - 8 + k, 1, 1, NE[1])
  }
  for (let k = 0; k < 5; k++) {
    rect(ctx, x - 4 - (k >> 1), y - 5 + k, 1, 1, NE[2])
    rect(ctx, x + 3 + (k >> 1), y - 5 + k, 1, 1, NE[0])
  }
  rect(ctx, x - 10, y, 3, 1, NE[2])
  rect(ctx, x + 8, y, 3, 1, NE[1])
  rect(ctx, x - 10, y - 1, 3, 1, NE[4])
  rect(ctx, x + 8, y - 1, 3, 1, NE[2])
  // engine bell
  for (let k = 0; k < 3; k++) rect(ctx, x - 1 - k, y - 4 + k, 3 + k * 2, 1, k === 2 ? INK : RAMP.steel[k + 1])
  rect(ctx, x - 1, y - 2, 3, 1, (t * 3) % 1 < 0.5 ? OR[2] : INK)
  // descent stage wrapped in gold foil, chamfered octagon
  for (let r = 0; r < 9; r++) {
    const w = r < 2 ? 5 + r : r > 6 ? 7 - (r - 6) : 7
    const yy = y - 13 + r
    for (let dx = -w; dx < w; dx++) {
      const l = 0.85 - ((dx + w) / (2 * w)) * 0.6 - (r === 8 ? 0.15 : 0)
      rect(ctx, x + dx, yy, 1, 1, r === 3 ? (dx < 0 ? NE[3] : NE[1]) : foil(l, x + dx, yy))
    }
  }
  // capsule: a white frustum with a dark heat-shield rim
  for (let r = 0; r < 23; r++) {
    const yy = y - 14 - r
    const w = Math.round(7 - (r / 22) * 4)
    for (let dx = -w; dx < w; dx++) {
      const f = (dx + w) / (2 * w)
      let c = tone(WH, 0.95 - f * 0.65, x + dx, yy)
      if (r === 0) c = dx < 0 ? NV[2] : NV[0]
      else if (r === 7 || r === 8) c = dx < 0 ? OR[3] : OR[1]
      else if (r === 15 && f > 0.2 && f < 0.8) c = WH[1]
      rect(ctx, x + dx, yy, 1, 1, c)
    }
  }
  // hatch, window, stencil
  rect(ctx, x - 4, y - 20, 3, 5, OR[3])
  rect(ctx, x - 3, y - 19, 1, 3, WH[4])
  rect(ctx, x - 3, y - 27, 3, 3, INK)
  rect(ctx, x - 2, y - 26, 1, 1, WARM[4])
  rect(ctx, x - 3, y - 26, 1, 1, WARM[2])
  rect(ctx, x + 1, y - 27, 1, 1, '#4a4450')
  rect(ctx, x + 1, y - 25, 2, 1, '#4a4450')
  // RCS quads
  rect(ctx, x - 5, y - 31, 1, 2, NE[2])
  rect(ctx, x + 4, y - 31, 1, 2, NE[1])
  // docking collar and beacon mast
  rect(ctx, x - 2, y - 38, 4, 2, NE[3])
  rect(ctx, x, y - 38, 2, 2, NE[1])
  rect(ctx, x - 1, y - 40, 2, 2, NE[4])
  rect(ctx, x, y - 43, 1, 3, NE[2])
  lamp2(ctx, x, y - 45, (t * 1.2) % 1 < 0.3 ? ALERT[4] : ALERT[0], ALERT[1])
}

function lamp2(ctx: Ctx, x: number, y: number, core: string, halo: string) {
  rect(ctx, x - 1, y, 3, 1, halo)
  rect(ctx, x, y - 1, 1, 3, halo)
  rect(ctx, x, y, 1, 1, core)
}

/* ------------------------------ shared parts ----------------------------- */

/** A three-legged light-grey lattice mast from z0 to z1 with zig-zag bracing, tapering to the top. */
function mast(s: Iso, u: number, v: number, z0: number, z1: number, w = 0.24) {
  const leg = (k: number, z: number): [number, number] => {
    const f = w * (1 - 0.6 * ((z - z0) / (z1 - z0)))
    const a = (k / 3) * Math.PI * 2 + 0.6
    return [u + Math.cos(a) * f, v + Math.sin(a) * f]
  }
  for (let k = 0; k < 3; k++) {
    const [ua, va] = leg(k, z0)
    const [ub, vb] = leg(k, z1)
    s.line(ua, va, z0, ub, vb, z1, k === 1 ? NE[4] : k === 2 ? NE[3] : NE[2])
  }
  for (let z = z0; z < z1 - 2; z += 7)
    for (let k = 0; k < 3; k++) {
      const [ua, va] = leg(k, z)
      const [ub, vb] = leg((k + 1) % 3, z + 7)
      s.line(ua, va, z, ub, vb, z + 7, k === 1 ? NE[3] : NE[2], -0.02)
    }
}

/** A white comms dish on a post: a tilted bowl facing the sky to the upper left, with an orange-tipped feed horn. */
function dish(s: Iso, u: number, v: number, z: number, r: number) {
  s.post(u, v, z - 7, z - 1, NE)
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
      if (q > 0.72) col = b < 0 ? WH[4] : b > rb * 0.4 ? WH[1] : WH[2]
      else col = tone(WH, 0.2 + 0.75 * ((a / r + b / rb) / 2 + 0.5), px, py)
      s.put(px, py, d, col)
    }
  const fx = Math.floor(cx) - 2
  const fy = Math.floor(cy) - Math.round(r * 0.7)
  for (let k = 0; k <= 4; k++) s.put(Math.round(fx + (2 * k) / 4), Math.round(fy + (Math.round(r * 0.7) * k) / 4), d + 0.01, NE[2])
  s.put(fx, fy, d + 0.02, OR[3])
  s.put(fx - 1, fy, d + 0.02, NE[3])
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

/** 3×5 pixel font for the mission clock. */
const FONT: Record<string, string[]> = {
  S: ['###', '#..', '###', '..#', '###'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  L: ['#..', '#..', '#..', '#..', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
}
/** The mission clock: "SOL" over the day count in amber LEDs on a dark panel. */
const solClock =
  (t: number): Pat =>
  (c, r, w, h) => {
    if (c === 0 || r === 0 || c === w - 1 || r === h - 1) return NE[1]
    const line = r >= 1 && r <= 5 ? 'SOL' : r >= 7 && r <= 11 ? '247' : null
    const cc = c - 1
    if (line && cc % 4 < 3 && cc < 11) {
      const ch = line[Math.floor(cc / 4)]
      const row = FONT[ch][line === 'SOL' ? r - 1 : r - 7]
      if (row[cc % 4] === '#') return line === 'SOL' ? LAMP.amber[1] : LAMP.amber[0]
    }
    if (r === h - 2 && c === w - 2) return (t * 2) % 1 < 0.5 ? LAMP.green[0] : LAMP.greenOff
    return '#1d1a22'
  }

/**
 * Colony core (3×3): the command centre. The back tile is a flat apron with
 * two drone pads, the front tile the supply ship's landing ring with chase
 * lights. On the left, a white command module carrying a big amber "SOL"
 * mission clock, with a ribbed pressure-vessel tower up to a warm-lit ops
 * cupola; on the right, the comms and power block, solar-roofed, with a white
 * high-gain dish and the lattice mast the power cables hang from. A gold-foil
 * cryo tank sits on the low middle tile.
 */
export function coreBuilding(ctx: Ctx, x: number, y: number, t: number) {
  const g = plinth(ctx, x, y, 3, 3, CORE_P, RAMP.orange)
  const blink = (t * 1.5) % 1 < 0.4

  // drone pads: concrete discs, white rim, orange H, red/green edge lights
  for (const [dx, dy] of CORE_PADS) {
    const cx = x + dx
    const cy = y + dy - CORE_P
    decal(ctx, cx, cy, 6, 3, (nx, ny, d, px, py) => (d > 0.8 ? WH[4] : d > 0.66 ? ST[1] : tone(ST, 0.62 - ny * 0.1, px, py)))
    rect(ctx, cx - 2, cy - 1, 1, 3, OR[3])
    rect(ctx, cx + 1, cy - 1, 1, 3, OR[3])
    rect(ctx, cx - 1, cy, 2, 1, OR[3])
    rect(ctx, cx - 6, cy, 1, 1, (t * 2 + dx / 7) % 1 < 0.5 ? LAMP.green[0] : LAMP.greenOff)
    rect(ctx, cx + 5, cy - 1, 1, 1, (t * 2 + dx / 7 + 0.5) % 1 < 0.5 ? LAMP.red[0] : LAMP.redOff)
  }
  // landing ring: orange/white rim, dashed inner circle, centre cross, chase lights
  {
    const cx = x + CORE_RING[0]
    const cy = y + CORE_RING[1] - CORE_P
    decal(ctx, cx, cy, 14, 7, (nx, ny, d, px, py) => {
      if (d > 0.9) return (Math.round(Math.atan2(ny, nx) * 6) & 1) === 0 ? OR[3] : WH[4]
      if (d > 0.84) return ST[1]
      if (Math.abs(d - 0.55) < 0.07) return (Math.round(Math.atan2(ny, nx) * 5) & 1) === 0 ? WH[3] : null
      return tone(ST, 0.58 - ny * 0.08, px, py)
    })
    rect(ctx, cx - 3, cy, 6, 1, OR[3])
    rect(ctx, cx - 1, cy - 1, 2, 3, OR[3])
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2
      const on = Math.floor(t * 4) % 8 === k
      rect(ctx, Math.round(cx + Math.cos(a) * 13) - (Math.cos(a) > 0 ? 1 : 0), Math.round(cy + Math.sin(a) * 6.5), 1, 1, on ? WARM[4] : OR[1])
    }
  }

  const s = new Iso(ctx, x, g)
  // low railing along the two back edges, behind the pads
  for (let a = -1.42; a <= 1.42; a += 1 / 16) {
    s.pt(a, -1.42, 3, NE[3])
    s.pt(-1.42, a, 3, NE[4])
  }
  for (let a = -1.4; a <= 1.42; a += 0.35) {
    s.line(a, -1.42, 0, a, -1.42, 3, NE[2])
    s.line(-1.42, a, 0, -1.42, a, 3, NE[3])
  }

  /* left: the command module with the mission clock */
  const LH = 22
  s.box(-1.42, -0.5, 0.32, 1.42, 0, LH, WH, {
    roof: NE,
    l: all(at(1, 3, 13, 13, solClock(t)), dust('l'), at(0, 1, 99, 1, OR[3]), panels(7, 'l')),
    r: all(dust('r'), at(3, 5, 7, 13, hatch('r')), at(11, 5, 5, 4, winW('r')), at(11, 11, 6, 3, stencil(0b110101101, 'r')), at(0, 1, 99, 1, OR[1]), panels(6, 'r')),
    t: (a, b) => (a === 2 || b === 2 ? NE[2] : null),
  })
  // status lamps over the hatch
  status(s, -0.5, 0.42, 19.5, 'green', true)
  status(s, -0.5, 0.9, 19.5, 'red', blink)
  // the ribbed tower
  const TU = -0.96
  const TV = 0.87
  const T1 = 48
  s.vcyl(TU, TV, 9, LH, T1, WH, {
    lid: false,
    pat: (nx, r, _H, l, px, py) => {
      if (r % 6 === 5) return tone(WH, l - 0.28, px, py)
      if (r >= 2 && r <= 3) return OR[l > 0.5 ? 3 : 1]
      if (nx > -0.78 && nx < -0.56 && r > 4) return Math.abs(nx + 0.67) > 0.07 ? NE[3] : r % 3 === 0 ? NE[2] : null
      if (Math.abs(nx - 0.15) < 0.12 && r % 6 === 2) return WARM[2]
      return null
    },
  })
  // the ops cupola: a window band, warm inside, one cyan console
  const C0 = T1
  const C1 = 57
  s.vcyl(TU, TV, 11, C0, C1, WH, {
    lid: false,
    pat: (nx, r, H, l, px, py) => {
      if (r === 0 || r === H - 1) return NE[l > 0.5 ? 3 : 1]
      if (r >= 2 && r <= H - 3) {
        const seg = Math.round((nx + 1) * 4)
        if (Math.abs((nx + 1) * 4 - seg) < 0.16 || Math.abs(nx) > 0.92) return NE[l > 0.5 ? 2 : 1]
        if (seg === 3 && r > 3) return r === 4 ? RAMP.cyan[4] : RAMP.cyan[2]
        return r === 2 ? WARM[4] : (px + py) % 4 === 0 ? WARM[3] : WARM[2]
      }
      return tone(WH, l, px, py)
    },
  })
  s.ell(TU, TV, C1, 11, 5, WH, { cut: 0, spec: true, pat: (_nu, _nv, nz, l) => (nz < 0.15 ? OR[l > 0.5 ? 3 : 1] : null) })
  // antenna and beacon on the cupola
  s.post(TU, TV, C1 + 4, C1 + 14, NE)
  s.line(TU - 0.08, TV, C1 + 10, TU + 0.08, TV, C1 + 10, NE[3])
  status(s, TU, TV, C1 + 15, 'red', blink)
  s.post(TU - 0.2, TV + 0.2, C1 + 3, C1 + 8, NE)
  s.pt(TU - 0.2, TV + 0.2, C1 + 9, OR[3])
  // air-handling stack on the command module roof
  s.vcyl(-0.66, 0.5, 2, LH, LH + 6, NE, { lid: [INK, INK, INK, INK, INK] })

  /* right: comms and power block, solar roof, dish and the cable mast */
  const RH = 18
  s.box(0.32, 1.42, -1.42, -0.55, 0, RH, WH, {
    roof: NE,
    l: all(dust('l'), at(2, 4, 6, 12, hatch('l')), at(10, 4, 5, 4, winW('l')), at(10, 10, 6, 3, stencil(0b101101, 'l')), at(0, 1, 99, 1, OR[3]), panels(8, 'l')),
    r: all(dust('r'), at(1, 3, 12, 10, radiator('r')), at(0, 1, 99, 1, OR[1])),
    t: all(at(1, 1, 12, 10, solarTop), fanTop(14, 5, 2.5, t)),
  })
  // battery cabinets along its front, green charge bars
  for (let k = 0; k < 3; k++) {
    const u0 = 0.42 + k * 0.32
    s.box(u0, u0 + 0.26, -0.55, -0.42, 0, 9, NE, {
      roof: WH,
      l: (c, r) => (c > 0 && c < 3 && r > 1 && r < 8 ? (r > 7 - Math.round(((Math.sin(t * Math.PI + k) + 1) / 2) * 5) ? LAMP.green[0] : LAMP.greenOff) : dustPx(1 - r / 9, 0.3, c, r, 0.7)),
    })
  }
  dish(s, 0.72, -0.95, RH + 11, 10)
  // the lattice mast: the power cables attach to its top, (+36, −64) from the centre
  const MU = 1.1
  const MV = -1.16
  const MTOP = 58
  mast(s, MU, MV, RH, MTOP)
  s.line(MU - 0.2, MV, MTOP - 6, MU + 0.2, MV, MTOP - 6, NE[3])
  s.line(MU, MV - 0.2, MTOP - 10, MU, MV + 0.2, MTOP - 10, NE[2])
  s.lamp(MU, MV, MTOP + 2, blink ? ALERT[4] : ALERT[0], ALERT[1])
  s.lamp(MU + 0.2, MV, MTOP - 6, OR[4], OR[2])

  /* middle tile: a gold-foil cryo tank on saddles (kept low so the pads stay in view) */
  for (const u of [-0.25, 0.2]) s.box(u - 0.05, u + 0.05, -0.42, 0.14, 0, 2, NE, { edge: false })
  s.hcyl('u', -0.38, 0.32, -0.14, 5, 0.2, AU, {
    pat: (s0, _th, l, px, py) => (s0 < 1.2 || Math.abs(s0 - 8) < 0.6 ? (l > 0.5 ? WH[4] : WH[2]) : foil(l, px, py)),
    cap: (rr, _th, l) => (rr > 0.8 ? WH[2] : l > 0.5 ? WH[4] : WH[3]),
  })
  // fuel and power lines to the landing ring
  hose(s, [0.33, -0.15, 3], [0.58, -0.15, 2], 0.5)
  s.line(0.35, 0.15, 1.5, 0.62, 0.15, 1.5, OR[3])
  s.box(0.56, 0.68, -0.2, 0.2, 0, 4, WH, { l: (c) => (c === 1 ? OR[3] : null), r: (c, r) => (r === 1 && c > 0 ? LAMP.green[0] : null) })
  // floodlight posts at the side corners, aimed at the ring
  for (const [u, v] of [
    [-0.25, 1.38],
    [1.38, -0.25],
  ] as const) {
    s.post(u, v, 0, 14, NE)
    s.box(u - 0.06, u + 0.06, v - 0.06, v + 0.06, 14, 16, NE, { t: () => NE[4] })
    s.lamp(u, v, 13, WARM[4], WARM[2])
  }
  s.flush()
}

/* ---------------------------------- lab ---------------------------------- */

/** Scrolling scope traces for a lab screen. */
const screens =
  (t: number): Pat =>
  (c, r, w, h) => {
    if (c === 0 || r === 0 || c === w - 1 || r === h - 1) return NE[1]
    const wave = Math.round(h / 2 - 1 + Math.sin((c + t * 8) * 0.9) * (h / 2 - 2))
    if (r === wave) return LAMP.green[0]
    return r < 2 ? RAMP.cyan[2] : RAMP.cyan[1]
  }

/** Inside the glovebox: two dark gloves reaching in from the bottom, holding a red rock under bright light. */
const GLOVES = ['...........', '...gg.gg...', '..ggrRrgg..', '..g.rrr.g..', '.gg.....gg.', 'gg.......gg']
const glovebox: Pat = (c, r, w, h) => {
  if (c === 0 || r === 0 || c === w - 1 || r === h - 1) return NE[2]
  if (c === 1 || r === 1 || c === w - 2 || r === h - 2) return INK
  const row = GLOVES[r - 2]
  const ch = row?.[c - 2]
  if (ch === 'g') return NV[1]
  if (ch === 'r') return RAMP.regolith[2]
  if (ch === 'R') return RAMP.regolith[4]
  return r <= 3 ? '#f6fbff' : r === h - 3 ? NE[2] : '#dfe8ea'
}

/**
 * Research lab (3×3): a ribbed white pressure vessel at the back with a gold-
 * foil spectrometer on its dome, a white instrument module in front whose lit
 * face holds a sample glovebox (two gloves reaching for a red rock), a rack of
 * orange-capped core-sample tubes on the left, and on the right a weather mast
 * with a spinning anemometer, a wind vane and a sensor boom. Level 2 adds a
 * roof dish and solar panels; level 3 a second sensor array and a gold-foil
 * instrument box.
 */
export function bigLab(ctx: Ctx, x: number, y: number, t: number) {
  const tier = getTier()
  const g = plinth(ctx, x, y, 3, 3, 6)
  const s = new Iso(ctx, x, g)
  const blink = (t * 1.5) % 1 < 0.4

  // the pressure vessel at the back
  const OU = -0.72
  const OV = -0.72
  const OH = 28
  s.vcyl(OU, OV, 17, 0, OH, WH, {
    lid: false,
    pat: (nx, r, H, l, px, py) => {
      const dd = dustPx(1 - (r + 0.5) / H, 0.25, px, py, l)
      if (dd) return dd
      if (r >= 3 && r <= 4) return OR[l > 0.5 ? 3 : 1]
      if (r >= 9 && r <= 13 && Math.abs(nx + 0.25) < 0.2) return r === 9 || r === 13 || Math.abs(nx + 0.25) > 0.15 ? NE[1] : r === 10 ? WARM[4] : WARM[2]
      if (r % 6 === 0 && r > 5) return tone(WH, l - 0.25, px, py)
      return null
    },
  })
  s.ell(OU, OV, OH, 17, 10, WH, { cut: 0, spec: true, pat: (_nu, _nv, nz, l, px, py) => (Math.abs(nz - 0.55) < 0.04 ? tone(WH, l - 0.2, px, py) : null) })
  // the spectrometer turret and its gold-foil telescope aimed at the upper left
  s.vcyl(OU, OV, 5, OH + 8, OH + 12, NE, { lid: WH })
  for (let k = 0; k < 11; k++) {
    const u = OU - 0.05 - k * 0.03
    const v = OV + 0.02 + k * 0.012
    const z = OH + 13 + k * 1.1
    const tip = k === 10
    s.pt(u, v, z + 1, tip ? INK : foil(0.85, k, 1), false, 0.6)
    s.pt(u, v, z, tip ? NE[2] : foil(0.5, k, 2), false, 0.6)
    s.pt(u + 0.03, v - 0.03, z, RAMP.gold[1], false, 0.59)
  }

  // the weather mast (right)
  const MU = 0.95
  const MV = -1.05
  const MT = 54
  s.box(MU - 0.2, MU + 0.2, MV - 0.2, MV + 0.2, 0, 7, WH, { l: all(dust('l'), at(1, 1, 5, 4, vent('l'))), r: all(dust('r'), at(1, 1, 4, 3, stencil(0b1101, 'r'))), roof: NE })
  mast(s, MU, MV, 7, MT)
  // anemometer: three cups spinning on a spindle
  s.post(MU, MV, MT, MT + 4, NE)
  for (let k = 0; k < 3; k++) {
    const a = t * Math.PI * 3 + (k * 2 * Math.PI) / 3
    const cu = MU + Math.cos(a) * 0.22
    const cv = MV + Math.sin(a) * 0.22
    s.line(MU, MV, MT + 4, cu, cv, MT + 4, NE[3], 0.1)
    s.pt(cu, cv, MT + 4, k === 0 ? OR[3] : WH[4], false, 0.12)
    s.pt(cu, cv, MT + 3, k === 0 ? OR[1] : NE[1], false, 0.12)
  }
  status(s, MU, MV, MT + 7, 'red', blink)
  // wind vane and a sensor boom
  s.line(MU - 0.3, MV + 0.02, MT - 4, MU + 0.25, MV + 0.02, MT - 4, NE[3])
  s.pt(MU - 0.3, MV + 0.02, MT - 3, OR[3])
  s.pt(MU - 0.3, MV + 0.02, MT - 5, OR[2])
  s.line(MU, MV, MT - 14, MU, MV + 0.42, MT - 14, NE[3])
  s.box(MU - 0.05, MU + 0.05, MV + 0.38, MV + 0.48, MT - 17, MT - 14, WH, { roof: NE })
  if (tier >= 3)
    for (const z of [MT - 24, MT - 32]) {
      s.line(MU - 0.28, MV, z, MU + 0.28, MV, z, NE[3])
      s.pt(MU - 0.28, MV, z + 1, WH[4], false, 0.05)
      s.pt(MU + 0.28, MV, z + 1, OR[3], false, 0.05)
    }

  // sample store (left): a white locker with a rack of core-sample tubes on its roof
  const SH = 10
  s.box(-1.4, -0.5, 0.42, 1.38, 0, SH, WH, {
    roof: NE,
    l: all(dust('l', 0.35), at(1, 2, 5, 7, hatch('l')), at(7, 3, 6, 3, stencil(0b110111, 'l')), at(0, 0, 99, 1, OR[3])),
    r: all(dust('r', 0.35), at(2, 2, 10, 5, vent('r')), at(0, 0, 99, 1, OR[1])),
  })
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 2; j++) {
      const u = -1.25 + i * 0.2
      const v = 0.7 + j * 0.35
      s.post(u, v, SH, SH + 6, WH)
      s.pt(u, v, SH + 7, OR[3], false, 0.02)
    }

  // the instrument module: glovebox, screen, hatch
  const LH = 16
  s.box(-0.3, 1.4, -0.3, 1.4, 0, LH, WH, {
    roof: NE,
    l: all(at(2, 3, 15, 10, glovebox), at(19, 2, 7, 13, hatch('l')), dust('l'), at(0, 0, 99, 1, OR[3]), panels(9, 'l')),
    r: all(dust('r'), at(2, 3, 9, 6, screens(t)), at(13, 3, 6, 5, winW('r')), at(21, 3, 5, 7, vent('r')), at(2, 11, 9, 3, stencil(0b101101110110, 'r')), at(0, 0, 99, 1, OR[1]), panels(9, 'r')),
    t: (a, b) => (a === 1 || b === 1 ? NE[3] : null),
  })
  // the upper deck: a setback module with a warm window strip and a radiator
  const UH = LH + 11
  s.box(-0.15, 1.0, -0.15, 1.0, LH, UH, WH, {
    roof: NE,
    l: all(at(2, 3, 9, 4, winW('l')), at(12, 1, 6, 9, radiator('l')), at(0, 0, 99, 1, OR[3])),
    r: all(at(2, 2, 12, 7, radiator('r')), at(0, 0, 99, 1, OR[1])),
    t: (a, b) => (a % 6 === 0 || b % 6 === 0 ? NE[2] : null),
  })
  // orange handrail round the lower roof
  for (let a = -0.25; a <= 1.38; a += 1 / 16) {
    s.pt(a, 1.37, LH + 3, OR[3])
    s.pt(1.37, a, LH + 3, OR[2])
  }
  for (let a = -0.2; a <= 1.38; a += 0.3) {
    s.line(a, 1.37, LH, a, 1.37, LH + 3, NE[3])
    s.line(1.37, a, LH, 1.37, a, LH + 3, NE[2])
  }
  status(s, 1.0, 1.4, LH - 1.5, 'green', true)
  status(s, 1.3, 1.4, LH - 1.5, 'amber', blink)
  // roof gear
  s.box(0.0, 0.3, 0.0, 0.3, UH, UH + 4, WH, { l: vent('l'), r: vent('r'), roof: NE })
  if (tier >= 2) {
    dish(s, 0.65, 0.55, UH + 8, 8)
    s.box(1.05, 1.32, -0.2, 1.3, LH, LH + 1.5, NE, { t: solarTop })
  } else s.post(0.6, 0.6, UH, UH + 10, NE)
  if (tier >= 3) s.box(0.2, 0.5, 0.62, 0.92, UH, UH + 5, AU, { l: (c, r) => foil(0.75, c, r), r: (c, r) => foil(0.4, c, r), t: (a, b) => foil(0.9, a, b) })
  s.flush()
}
