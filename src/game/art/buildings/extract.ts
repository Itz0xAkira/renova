/**
 * Mining: the ice drill and the excavator, both on 2×2 footprints.
 *
 * Drawn as near-future space-agency hardware: white composite panels,
 * light-grey structure, inflatable fabric shelters with straps and sandbags,
 * gold MLI foil on machinery, safety-orange stripes, rails and hatches, small
 * red/green status lamps, warm-lit windows, and red regolith dust creeping up
 * every lower wall.
 *
 * Each function draws one building on ground point (x, y), the centre of its
 * footprint. A w×h footprint spans ±(w+h)·8 px across and ±(w+h)·4 px down.
 * `t` is animation time; frame 0 (t = 0) doubles as the idle pose.
 *
 * Positions on the deck are given as (s, r): s runs toward the lower right
 * (screen +1, +½ per px), r toward the lower left (screen −1, +½). A 2×2 deck
 * covers s, r ∈ [−16, 16].
 */
import { rect, type Ctx } from '@/site/pixel/engine'
import { band, cyl, dome, getTier, INK, lamp, plinth, RAMP, stencilPx, tone, type Ramp } from '@/game/art/pixel'
import { line, puffs, MH, CY, STEAM } from '@/game/art/buildings/kit'

/** White and off-white composite. */
const W = RAMP.hull
/** Neutral light greys. */
const N = RAMP.neutral
const OR = RAMP.orange
const GD = RAMP.gold
const NV = RAMP.navy
const ICE = RAMP.ice
const REG = RAMP.regolith
/** Inflatable shelter fabric: a soft, warm off-white. */
const FAB: Ramp = ['#837a80', '#ada5a6', '#d3ccc5', '#ede7dc', '#fffbf2']
/** Warm interior light. */
const WARM: Ramp = ['#7a4a1c', '#c98a3a', '#ffcf7a', '#ffe3a3', '#fff0c0']
/** Kicked-up regolith dust. */
const DUST: Ramp = ['#894a34', '#a9603f', '#c27d55', '#d99a6c', '#ecbb8e']
const FRAME = '#3a3442'
const RED: readonly [string, string] = ['#ff5a4f', '#6a1c18']
const GRN: readonly [string, string] = ['#7dffa8', '#1f5a35']

type Px = string | ((c: number, r: number) => string | null)

/** Stable per-pixel noise in [0, 1). */
const n2 = (x: number, y: number) => {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return h - Math.floor(h)
}

/** Regolith dust on a wall: f is 0 at the dust line and 1 at the ground. */
const dustCol = (f: number, X: number, Y: number, lit: boolean): string | null => {
  if (n2(X, Y) > f * 1.15 - 0.1) return null
  return lit ? (f > 0.55 ? REG[2] : REG[3]) : f > 0.55 ? REG[1] : REG[2]
}

/**
 * An iso box standing on ground point (gx, gy): half-length a along s, b along r,
 * h tall. Returns painters for its lit left face, shaded right face, and roof.
 */
function box(ctx: Ctx, gx: number, gy: number, a: number, b: number, h: number, ramp: Ramp, o: { roof?: Ramp; seams?: number; rivets?: boolean } = {}) {
  const roof = o.roof ?? ramp
  const fx = gx + a - b
  const fy = gy + ((a + b) >> 1) - h
  const lx = gx - a - b
  const bx = gx - a + b
  const rx = gx + a + b
  const ly = fy - a + 1
  const wallTop = (X: number) => (X < fx ? fy - ((fx - 1 - X) >> 1) : fy - ((X - fx) >> 1))
  const roofTop = (X: number) => (X < bx ? ly - ((X - lx) >> 1) : ly - b + 1 + ((X - bx) >> 1))
  for (let X = lx; X < rx; X++) {
    const left = X < fx
    const c = left ? X - lx : X - fx
    const n = left ? 2 * a : 2 * b
    const y0 = wallTop(X)
    for (let r = 0; r <= h; r++) {
      const k = r / Math.max(1, h)
      const v = left ? 0.74 - 0.22 * k + (c > n - 3 ? 0.06 : 0) : 0.4 - 0.18 * k - 0.12 * (c / n)
      rect(ctx, X, y0 + r, 1, 1, r === h ? ramp[0] : tone(ramp, v, X, y0 + r))
    }
    if (o.seams && c > 0 && c < n - 1 && c % o.seams === 0) {
      rect(ctx, X, y0 + 1, 1, h - 1, left ? ramp[2] : ramp[0])
      if (o.rivets && left) {
        rect(ctx, X + 1, y0 + 2, 1, 1, ramp[4])
        rect(ctx, X + 1, y0 + h - 2, 1, 1, ramp[4])
      }
    }
    const t0 = roofTop(X)
    for (let Y = t0; Y < y0; Y++) rect(ctx, X, Y, 1, 1, tone(roof, 0.95 - 0.3 * ((Y - t0) / Math.max(1, y0 - t0)) - (left ? 0 : 0.08), X, Y))
    rect(ctx, X, y0, 1, 1, left ? roof[4] : roof[2])
  }
  rect(ctx, fx - 1, fy + 1, 1, h, ramp[4])
  rect(ctx, fx, fy + 1, 1, h, ramp[1])
  const paint = (X: number, Y: number, col: Px, c: number, r: number) => {
    const v = typeof col === 'string' ? col : col(c, r)
    if (v) rect(ctx, X, Y, 1, 1, v)
  }
  return {
    fx,
    fy,
    lx,
    rx,
    top: gy - h,
    /** Paint the lit face: columns from the left corner, rows from the wall top. */
    L(c0: number, w: number, r0: number, hh: number, col: Px) {
      for (let c = c0; c < c0 + w; c++) for (let r = r0; r < r0 + hh; r++) paint(lx + c, wallTop(lx + c) + r, col, c - c0, r - r0)
    },
    /** Paint the shaded face: columns from the front corner. */
    R(c0: number, w: number, r0: number, hh: number, col: Px) {
      for (let c = c0; c < c0 + w; c++) for (let r = r0; r < r0 + hh; r++) paint(fx + c, wallTop(fx + c) + r, col, c - c0, r - r0)
    },
    /** Red dust creeping up the lower `frac` of both walls. */
    grime(frac = 0.25) {
      const d0 = h * (1 - frac)
      for (let X = lx; X < rx; X++) {
        const y0 = wallTop(X)
        for (let r = Math.ceil(d0); r < h; r++) {
          const c = dustCol((r - d0) / (h - d0), X, y0 + r, X < fx)
          if (c) rect(ctx, X, y0 + r, 1, 1, c)
        }
      }
    },
    /** Screen point on the roof at (s, r) from its centre. */
    at: (s: number, r: number) => [Math.round(gx + s - r), Math.round(gy - h + (s + r) / 2)] as const,
  }
}

/**
 * A horizontal drum lying along s. Its axis passes screen point (ox, oy) at
 * s = 0 and it spans s0…s1, R across and Rz up. `paint` colours the shell
 * from (s, angle around the axis — 0 faces lower left, π/2 is the top — and
 * light 0–1); `cap` colours the visible front end from (across, up).
 */
function drum(ctx: Ctx, ox: number, oy: number, s0: number, s1: number, R0: number, Rz: number, paint: (s: number, a: number, v: number, X: number, Y: number) => string | null, cap: (v: number, z: number, X: number, Y: number) => string | null) {
  const A = Math.hypot(R0, Rz)
  const phi = Math.atan2(Rz, R0)
  for (let X = ox + s0 - R0 - 1; X <= ox + s1 + R0 + 1; X++)
    for (let Y = oy + Math.floor(s0 / 2) - R0 - Rz - 2; Y <= oy + Math.ceil(s1 / 2) + R0 + Rz + 2; Y++) {
      const xq = X + 0.5 - ox
      const yq = Y + 0.5 - oy
      const V = s1 - xq
      const Z = (s1 + V) / 2 - yq
      if ((V / R0) ** 2 + (Z / Rz) ** 2 <= 1) {
        const c = cap(V, Z, X, Y)
        if (c) rect(ctx, X, Y, 1, 1, c)
        continue
      }
      const q = (yq - xq / 2) / A
      if (Math.abs(q) > 1) continue
      const ac = Math.acos(q)
      const a1 = ac - phi
      const a2 = -ac - phi
      const d = (a: number) => 2 * R0 * Math.cos(a) + Rz * Math.sin(a)
      const a = d(a1) >= d(a2) ? a1 : a2
      const s = xq + R0 * Math.cos(a)
      if (s < s0 || s > s1) continue
      const v = 0.55 + 0.2 * Math.cos(a) + 0.35 * Math.sin(a)
      const c = paint(s, a, v, X, Y)
      if (c) rect(ctx, X, Y, 1, 1, c)
    }
}

/** A safety-orange handrail between two points: grey posts every 3 px and a top rail h px up. */
function rail(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, h = 3, col: string = OR[3]) {
  const n = Math.max(Math.abs(x1 - x0), 1)
  for (let k = 0; k <= n; k += 3) rect(ctx, Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n) - h, 1, h, MH[2])
  line(ctx, x0, y0 - h, x1, y1 - h, col)
}

/** A vertical ladder with rails at x and x + 2. */
function ladder(ctx: Ctx, x: number, y0: number, y1: number) {
  rect(ctx, x, y0, 1, y1 - y0, N[3])
  rect(ctx, x + 2, y0, 1, y1 - y0, MH[1])
  for (let yy = y0 + 1; yy < y1; yy += 2) rect(ctx, x + 1, yy, 1, 1, MH[3])
}

/** Blinking red beacon. */
const blink = (ctx: Ctx, x: number, y: number, t: number, phase = 0) => lamp(ctx, x, y, (t * 2 + phase) % 1 < 0.5 ? RED[0] : RED[1], '#a8342c')

/** A row of tiny status lamps, green and red, the last one blinking. */
function leds(ctx: Ctx, x: number, y: number, n: number, t: number, seed = 0) {
  for (let k = 0; k < n; k++) {
    const red = (seed >> k) & 1
    const on = k !== n - 1 || (t * 2 + seed * 0.13) % 1 < 0.5
    rect(ctx, x + k * 2, y, 1, 1, red ? (on ? RED[0] : RED[1]) : on ? GRN[0] : GRN[1])
  }
}

/** Front-surface y offset of a cylinder of radius rx at column dx. */
const rim = (rx: number, dx: number) => Math.round(Math.sqrt(Math.max(0, 1 - ((dx + 0.5) / rx) ** 2)) * (rx / 2))

/** Paint a column-wise pattern on a cylinder's front surface, rows counted up from z0. */
function wrap(ctx: Ctx, cx: number, base: number, rx: number, dx0: number, w: number, z0: number, hh: number, col: (c: number, r: number) => string | null) {
  for (let c = 0; c < w; c++) {
    const dx = dx0 + c
    const e = rim(rx, dx)
    for (let r = 0; r < hh; r++) {
      const v = col(c, r)
      if (v) rect(ctx, cx + dx, base - z0 - r + e, 1, 1, v)
    }
  }
}

/** Lit brightness (0–1) of a cylinder's front surface at column dx. */
const cylLight = (rx: number, dx: number) => {
  const nx = (dx + 0.5) / rx
  return 0.15 + (nx * -0.52 + Math.sqrt(Math.max(0, 1 - nx * nx)) * 0.59) * 0.8
}

/** Crinkled gold MLI foil wrapped round a cylinder, from z0 for hh rows, with stitched seams. */
function foil(ctx: Ctx, cx: number, base: number, rx: number, z0: number, hh: number) {
  wrap(ctx, cx, base, rx, -rx, 2 * rx, z0, hh, (c, r) => {
    const X = cx - rx + c
    if (c % 6 === 5) return GD[1]
    if (r === 0 || r === hh - 1) return GD[c < rx ? 2 : 1]
    return tone(GD, cylLight(rx, c - rx) + (n2(X >> 1, (r / 3) | 0) - 0.5) * 0.45, X, r)
  })
}

/** Dust creeping up the lower `frac` of a cylinder. */
function cylDust(ctx: Ctx, cx: number, base: number, rx: number, h: number, frac = 0.25) {
  const d0 = Math.max(2, Math.round(h * frac))
  wrap(ctx, cx, base, rx, -rx, 2 * rx, 0, d0, (c, r) => dustCol(1 - r / d0, cx + c, base - r, c < rx))
}

/** Rounded-rectangle pressure hatch with an orange frame, a gasket and a warm porthole. */
const hatchPx =
  (w: number, h: number, lit = true) =>
  (c: number, r: number): string | null => {
    if ((c === 0 || c === w - 1) && (r === 0 || r === h - 1)) return null
    if (c === 0 || r === 0 || c === w - 1 || r === h - 1) return lit ? OR[3] : OR[1]
    if (c === 1 || r === 1 || c === w - 2 || r === h - 2) return lit ? W[1] : W[0]
    const mid = (w - 1) / 2
    if (r === 3 && Math.abs(c - mid) < 1) return lit ? WARM[3] : WARM[2]
    if (r === 2 && Math.abs(c - mid) < 1) return FRAME
    return lit ? W[3] : W[1]
  }

/** A window glowing with warm interior light. */
const warmPx = (w: number, h: number) => (c: number, r: number) => (c === 0 || r === 0 || c === w - 1 || r === h - 1 ? FRAME : r === 1 ? WARM[4] : (c + r) % 5 === 0 ? WARM[3] : WARM[2])

/** A light-grey louvred grille. */
const grillePx = (lit: boolean) => (c: number, r: number) => (r % 2 ? (lit ? W[0] : FRAME) : c % 4 === 3 ? null : lit ? N[3] : N[2])

/** Safety-orange stripe. */
const orangePx = (lit: boolean) => (lit ? OR[3] : OR[1])

/** A regolith sandbag lying on the ground at (x, y). */
function sandbag(ctx: Ctx, x: number, y: number, k: number) {
  rect(ctx, x - 2, y - 1, 4, 2, k % 2 ? REG[2] : REG[3])
  rect(ctx, x - 2, y - 1, 2, 1, REG[4])
  rect(ctx, x - 2, y + 1, 4, 1, REG[1])
}

/**
 * A patch of navy solar cells lying on a roof, raised `lift` px on posts:
 * `pt(s, r)` maps roof coordinates to the screen. A diagonal glint sweeps it.
 */
function solar(ctx: Ctx, pt: (s: number, r: number) => readonly [number, number], s0: number, s1: number, r0: number, r1: number, lift: number) {
  for (const [s, r] of [
    [s0, r1],
    [s1, r1],
    [s1, r0],
  ]) {
    const [px, py] = pt(s, r)
    rect(ctx, px, py - lift, 1, lift, MH[1])
  }
  for (let s = s0; s <= s1; s++)
    for (let r = r0; r <= r1; r++) {
      const [px, py] = pt(s, r)
      const grid = (s - s0) % 3 === 0 || (r - r0) % 4 === 0
      const edge = s === s1 || r === r1
      const glint = Math.abs(s - r - (s0 - r0) * 0.3) < 1.2
      rect(ctx, px, py - lift, 2, 1, edge ? N[3] : glint ? (grid ? NV[3] : NV[4]) : grid ? NV[0] : (s + r) % 2 ? NV[2] : NV[1])
    }
}

/* --------------------------------- drill --------------------------------- */

/**
 * Ice drill: a slender lattice mast with orange-and-white day-marker legs on
 * a dusty white drill floor, its gold-foil top drive pumping the drill string
 * into a foil-wrapped thermal wellhead that breathes vapour. Its signature is
 * the core vault out front: a white cold store with a glazed face where the
 * extracted ice cores stand glowing, fed by a glass chute from the wellhead.
 * An inflatable fabric crew shelter, strapped and sandbagged, sits on the left.
 */
export function iceDrill(ctx: Ctx, x: number, y: number, t: number) {
  const tier = getTier()
  const g = plinth(ctx, x, y, 2, 2, 5)
  const at = (s: number, r: number, z = 0) => [Math.round(x + s - r), Math.round(g + (s + r) / 2) - z] as const

  // coolant tank in gold foil (level 3), back right
  if (tier >= 3) {
    const [tx, ty] = at(3, -14)
    cyl(ctx, tx + 4, ty, 4, 16, GD, W)
    foil(ctx, tx + 4, ty, 4, 1, 14)
    band(ctx, tx + 4, ty, 4, 16, 1, W[1])
    cylDust(ctx, tx + 4, ty, 4, 16)
  }
  // pump skid, back right
  {
    const [px0, py0] = at(11, -8)
    const pump = box(ctx, px0, py0, 4, 3, 7, W, { seams: 4, roof: N })
    pump.L(0, 8, 1, 1, orangePx(true))
    pump.R(1, 5, 2, 3, grillePx(false))
    pump.grime(0.35)
    leds(ctx, pump.lx + 2, pump.top + 2, 2, t, 0b10)
  }

  // drill floor: a raised white substructure with orange trim
  const [dx0, dy0] = at(-2, -6)
  const sub = box(ctx, dx0, dy0, 8, 8, 6, W, { seams: 4, roof: N })
  sub.L(0, 16, 1, 1, orangePx(true))
  sub.R(0, 16, 1, 1, orangePx(false))
  sub.L(3, 10, 3, 2, grillePx(true))
  sub.R(4, 6, 3, 2, grillePx(false))
  sub.grime(0.45)
  // derrick
  const bx = dx0
  const by = dy0 - 6
  const H = 30
  const corner = (cs: number, cr: number, k: number) => {
    const f = 6 - (4.5 * k) / H
    return [Math.round(bx + (cs - cr) * f), Math.round(by + ((cs + cr) * f) / 2) - k] as const
  }
  type Leg = 'B' | 'L' | 'R' | 'F'
  const legs: Record<Leg, [number, number]> = { B: [-1, -1], L: [-1, 1], R: [1, -1], F: [1, 1] }
  const stages = [0, 8, 15, 22, H]
  const face = (p: Leg, q: Leg, c1: string, c2: string | null) => {
    for (let i = 0; i + 1 < stages.length; i++) {
      const [k0, k1] = [stages[i], stages[i + 1]]
      const a0 = corner(...legs[p], k0)
      const b0 = corner(...legs[q], k0)
      const a1 = corner(...legs[p], k1)
      const b1 = corner(...legs[q], k1)
      if (c2) {
        line(ctx, a0[0], a0[1], b1[0], b1[1], c2)
        line(ctx, b0[0], b0[1], a1[0], a1[1], c2)
      }
      line(ctx, a1[0], a1[1], b1[0], b1[1], c1)
    }
  }
  // legs in orange-and-white day-marker bands
  const leg = (p: Leg, lit: boolean, wide = true) => {
    for (let k = 0; k <= H; k++) {
      const [lx, ly] = corner(...legs[p], k)
      const orange = Math.floor((H - k) / 5) % 2 === 0
      rect(ctx, lx, ly, 1, 1, orange ? (lit ? OR[3] : OR[2]) : lit ? W[4] : W[2])
      if (wide) rect(ctx, lx + 1, ly, 1, 1, orange ? OR[1] : W[1])
    }
  }
  leg('B', false, false)
  // rotary table and the thermal wellhead in gold foil, breathing vapour
  dome(ctx, bx, by + 1, 5, 1, 2, MH, false)
  dome(ctx, bx - 1, by, 3, 2, 1, GD, false)
  rect(ctx, bx - 3, by, 1, 1, GD[4])
  if (t > 0)
    for (let k = 0; k < 3; k++) {
      const rise = (t * 4 + k * 1.7) % 6
      rect(ctx, bx + 1 + k + Math.round(rise / 2), by - 3 - Math.round(rise), rise > 3 ? 2 : 1, 1, STEAM[rise > 3 ? 1 : 3])
    }
  face('L', 'F', N[3], N[2])
  face('F', 'R', MH[2], MH[1])
  // drill string, top drive and hoist cables
  const stroke = Math.round((1 - Math.cos(t * Math.PI)) * 5)
  const crownY = by - H - 1
  const blockY = crownY + 7 + stroke
  rect(ctx, bx - 2, blockY + 4, 1, by - blockY - 4, N[4])
  rect(ctx, bx - 1, blockY + 4, 1, by - blockY - 4, MH[1])
  for (let k = blockY + 7; k < by - 1; k += 5) rect(ctx, bx - 3, k, 3, 1, GD[2]) // tool joints
  rect(ctx, bx - 3, crownY + 2, 1, blockY - crownY - 2, MH[3])
  rect(ctx, bx, crownY + 2, 1, blockY - crownY - 2, MH[1])
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 5; c++) {
      const X = bx - 4 + c
      rect(ctx, X, blockY + r, 1, 1, r === 4 ? OR[c < 3 ? 3 : 1] : c === 4 ? GD[1] : tone(GD, 0.8 - c * 0.1 + (n2(X, blockY + r) - 0.5) * 0.4, X, r))
    }
  rect(ctx, bx - 2, blockY + 5, 1, 1, MH[3])
  leg('L', true)
  leg('R', false)
  leg('F', true)
  // racking platform with a rail, halfway up the left face
  {
    const [px, py] = corner(-1, 1, 17)
    rect(ctx, px - 3, py, 7, 1, N[3])
    rect(ctx, px - 3, py + 1, 7, 1, MH[1])
    rail(ctx, px - 3, py, px + 3, py, 3)
  }
  {
    const [lx, ly] = corner(-1, 1, 0)
    ladder(ctx, lx + 1, ly - 16, ly)
  }
  // crown block, sheave, antenna and beacon
  rect(ctx, bx - 4, crownY - 1, 8, 3, N[2])
  rect(ctx, bx - 4, crownY - 1, 8, 1, W[4])
  rect(ctx, bx + 1, crownY - 1, 3, 3, MH[1])
  dome(ctx, bx - 1, crownY - 2, 2, 2, 0, OR, false)
  rect(ctx, bx, crownY - 6, 1, 4, N[3])
  blink(ctx, bx, crownY - 7, t)
  if (tier >= 2) {
    // floodlight halfway up the right leg
    const [fx, fy] = corner(1, -1, 12)
    rect(ctx, fx + 1, fy, 2, 2, N[2])
    lamp(ctx, fx + 3, fy, '#ffffff', WARM[2])
  }

  // inflatable crew shelter, left: a strapped fabric half-tube with an end hatch
  {
    const [ox, oy] = at(0, 10)
    const s0 = -14
    const s1 = -3
    drum(
      ctx,
      ox,
      oy,
      s0,
      s1,
      6,
      9,
      (s, a, v, X, Y) => {
        if (Math.sin(a) < 0) return null
        if (Math.abs(((s - s0) % 4) - 2) < 0.45) return v > 0.6 ? N[2] : N[1] // restraint straps
        if (Math.abs(a - Math.PI / 2) < 0.08) return FAB[2]
        return tone(FAB, v + 0.05, X, Y)
      },
      (V, Z) => {
        if (Z < 0) return null
        if (Math.abs(V) <= 2.5 && Z < 7) return Math.abs(V) > 1.6 || Z > 6 ? OR[1] : Z > 4 && Z < 5.5 && Math.abs(V) < 1 ? WARM[2] : W[1]
        return Math.hypot(V / 6, Z / 9) > 0.86 ? FAB[1] : FAB[2]
      },
    )
    for (let k = 0; k < 4; k++) {
      const [sx, sy] = at(-13 + k * 3, 16)
      sandbag(ctx, sx, sy, k)
    }
    // a stencilled number and a status lamp over the door
    const [nx, ny] = at(-9, 16, 6)
    for (let c = 0; c < 6; c++) {
      const v = stencilPx(0b110101)(c, 0)
      if (v) rect(ctx, nx + c, ny + (c >> 1), 1, 1, v)
    }
    const [hx, hy] = at(-3, 10, 9)
    leds(ctx, hx + 1, hy, 1, t, 0)
  }

  // the core vault, front right: a glazed cold store full of ice cores
  const [vx0, vy0] = at(9, 6)
  const vault = box(ctx, vx0, vy0, 6, 4, 11, W, { seams: 6, roof: ICE })
  const cores = 2 + tier * 1
  vault.L(1, 10, 2, 7, (c, r) => {
    if (c === 0 || r === 0 || c === 9 || r === 6) return FRAME
    const slot = Math.floor((c - 1) / 2)
    if ((c - 1) % 2 === 0 && slot < cores) return r === 1 ? ICE[4] : r === 5 ? CY[3] : (c + r) % 3 ? ICE[3] : ICE[2]
    return r === 5 ? CY[1] : '#253a4f'
  })
  vault.L(0, 12, 1, 1, orangePx(true))
  vault.L(1, 6, 10, 1, stencilPx(0b101101))
  vault.R(0, 8, 1, 1, orangePx(false))
  vault.R(2, 4, 3, 7, hatchPx(4, 7, false))
  vault.grime(0.25)
  leds(ctx, vault.fx + 2, vault.fy + 2, 2, t, 0b01)
  // the glass chute from the wellhead to the vault roof, a core sliding down it
  {
    const [ax, ay] = [bx + 3, by - 4]
    const [cx, cy] = vault.at(-3, -1)
    const n = Math.max(Math.abs(cx - ax), Math.abs(cy - ay))
    const f = (t * 0.5) % 1
    for (let k = 0; k <= n; k++) {
      const X = Math.round(ax + ((cx - ax) * k) / n)
      const Y = Math.round(ay + ((cy - ay) * k) / n)
      rect(ctx, X, Y - 2, 1, 1, N[4])
      rect(ctx, X, Y - 1, 1, 1, CY[3])
      rect(ctx, X, Y, 1, 1, CY[1])
      rect(ctx, X, Y + 1, 1, 1, MH[1])
      if (t > 0 && Math.abs(k / n - f) < 0.12) rect(ctx, X, Y - 1, 1, 2, k % 2 ? ICE[4] : '#ffffff')
    }
    if (t === 0) rect(ctx, Math.round((ax + cx) / 2), Math.round((ay + cy) / 2) - 1, 2, 2, ICE[4])
    rect(ctx, cx - 1, cy - 2, 3, 3, N[2])
  }
  // power umbilical from the pump skid to the drill floor
  line(ctx, sub.fx + 14, sub.fy + 8, sub.fx + 6, sub.fy + 6, FRAME)
  // canisters of spare core liners beside the vault (level 2+)
  if (tier >= 2) {
    const [kx, ky] = at(15, 13)
    cyl(ctx, kx, ky, 2, 7, W, N)
    band(ctx, kx, ky, 2, 5, 1, OR[2])
    if (tier >= 3) {
      cyl(ctx, kx - 4, ky + 2, 2, 6, W, N)
      band(ctx, kx - 4, ky + 2, 2, 4, 1, OR[2])
    }
  }
}

/* ------------------------------- excavator ------------------------------- */

/**
 * Bucket-wheel excavator: dust-caked crawler tracks under a white composite
 * house with orange-chevron counterweight panels, a warm-lit cab and a
 * radiator for its electric drive; a light-grey lattice boom carries a turning
 * wheel of safety-orange buckets that bites into a dig pit at front right,
 * throwing up a curtain of red dust. Spoil rides the boom belt back and drops
 * onto a heap at left. Level 2 adds a solar canopy, level 3 a comms mast and
 * floodlights. Drawn centred on (x, y) like every other building.
 */
export function excavator(ctx: Ctx, x: number, y: number, t: number) {
  const tier = getTier()
  const g = plinth(ctx, x, y, 2, 2, 5)
  const at = (s: number, r: number, z = 0) => [Math.round(x + s - r), Math.round(g + (s + r) / 2) - z] as const
  const spin = t * Math.PI * 0.5
  const ph = Math.floor(t * 4)

  // the dig pit, front right: a cut through the pad into the regolith
  for (let s = 2; s <= 15; s++)
    for (let r = -8; r <= 7; r++) {
      const [px, py] = at(s, r)
      const near = r === 7 || s === 15
      const far = r === -8 || s === 2
      for (const ox of [0, 1]) {
        let c: string
        if (near) c = (px + ox + py) % 4 < 2 ? OR[3] : W[3]
        else if (far) c = N[3]
        else c = tone(REG, 0.12 + ((s - 2) / 13) * 0.25 + ((r + 8) / 15) * 0.25, px + ox, py)
        rect(ctx, px + ox, py, 1, 1, c)
      }
    }
  for (let s = 3; s <= 14; s++) {
    const [px, py] = at(s, -7)
    rect(ctx, px, py, 2, 2, REG[0])
  }
  for (let r = -7; r <= 6; r++) {
    const [px, py] = at(3, r)
    rect(ctx, px, py, 2, 2, REG[1])
  }

  // spoil heap at the left corner
  {
    const [hx, hy] = at(-10, 12)
    dome(ctx, hx, hy + 1, 8, 6, 2, REG, false)
    for (let k = 0; k < 7; k++) rect(ctx, hx - 6 + ((k * 5) % 12), hy - 2 + ((k * 3) % 5), 1, 1, k % 2 ? REG[4] : REG[1])
  }

  // crawler tracks, back one first, treads creeping, caked in dust
  for (const r of [-6, 6]) {
    const [tx, ty] = at(-7, r)
    const tr = box(ctx, tx, ty, 7, 3, 4, MH, { roof: MH })
    tr.L(0, 14, 0, 4, (c, rr) => (rr === 0 ? ((c + ph) % 2 ? N[3] : MH[2]) : rr === 3 ? MH[0] : (c + ph) % 3 === 0 ? FRAME : MH[2]))
    for (let k = 0; k < 3; k++) tr.L(2 + k * 4, 2, 1, 2, N[3])
    tr.R(0, 6, 0, 4, (c, rr) => (rr === 0 ? MH[2] : (c + ph) % 3 === 0 ? FRAME : MH[1]))
    tr.grime(0.7)
  }

  // upper house on a turntable ring
  const hz = 5
  const [hx0, hy0] = at(-7, 0)
  dome(ctx, hx0, hy0 - hz + 1, 8, 2, 2, MH, false)
  const house = box(ctx, hx0, hy0 - hz, 7, 6, 10, W, { seams: 4, roof: N })
  house.L(0, 14, 0, 1, OR[2])
  house.L(0, 4, 1, 9, (c, r) => ((c + r) % 4 < 2 ? OR[3] : W[4])) // counterweight chevrons
  house.L(6, 7, 2, 2, grillePx(true))
  house.L(6, 7, 6, 1, stencilPx(0b110101101))
  house.R(0, 12, 0, 1, OR[1])
  house.R(2, 4, 2, 7, hatchPx(4, 7, false))
  house.R(8, 3, 2, 3, grillePx(false))
  house.grime(0.4)
  leds(ctx, house.fx + 8, house.fy + 7, 2, t, 0b01)
  // spoil chute from the house down to the heap
  {
    const [cx, cy] = house.at(-4, 6)
    const [hx, hy] = at(-10, 12)
    for (let k = 0; k < 2; k++) line(ctx, cx, cy + 4 + k, hx + 2, hy - 5 + k, k ? MH[1] : N[3])
    if (t > 0) rect(ctx, hx + 1 - (ph % 2), hy - 4 + (ph % 3), 1, 1, REG[3])
  }
  // drive module: a gold-foil motor housing with a white radiator panel
  {
    const [ex, ey] = house.at(-4, 2)
    const eng = box(ctx, ex, ey, 3, 3, 3, GD, { roof: GD })
    eng.L(0, 6, 1, 1, GD[1])
    for (let k = 0; k < 6; k++) {
      const X = ex - 1 + k
      const Yb = ey - 3 - (k >> 1)
      for (let z = 0; z < 7; z++) rect(ctx, X, Yb - z, 1, 1, k === 0 ? MH[1] : z % 2 ? W[1] : W[3])
      rect(ctx, X, Yb - 7, 1, 1, N[3])
    }
  }
  // gantry mast with the boom's hoist cable
  const [wx, wy] = at(12, -1, 9) // bucket wheel hub
  const [gx0, gy0] = house.at(-4, -4)
  rect(ctx, gx0, gy0 - 14, 1, 14, N[3])
  rect(ctx, gx0 + 1, gy0 - 14, 1, 14, MH[1])
  rect(ctx, gx0 - 1, gy0 - 15, 4, 2, OR[3])
  line(ctx, gx0 + 2, gy0 - 14, wx - 1, wy - 8, MH[2])
  blink(ctx, gx0, gy0 - 17, t)

  // boom: a light-grey lattice from the house front down to the wheel hub, with a belt of spoil
  const [b0x, b0y] = house.at(6, -2)
  const n = wx - b0x
  for (let k = 0; k <= n; k++) {
    const yy = Math.round(b0y + ((wy - b0y) * k) / n)
    rect(ctx, b0x + k, yy - 5, 1, 1, OR[3])
    rect(ctx, b0x + k, yy - 4, 1, 1, N[3])
    rect(ctx, b0x + k, yy, 1, 1, MH[2])
    rect(ctx, b0x + k, yy + 1, 1, 1, MH[0])
    if (k % 4 === 0) for (let j = -3; j < 0; j++) rect(ctx, b0x + k + ((j + 3) >> 1), yy + j, 1, 1, N[2])
  }
  for (let k = 0; k < 4; k++) {
    const f = (t * 0.5 + k / 4) % 1
    rect(ctx, Math.round(wx - 3 - (wx - 3 - b0x) * f), Math.round(wy - 5 - (wy - b0y) * f), 2, 1, k % 2 ? REG[3] : REG[2])
  }

  // solar canopy over the back of the roof (level 2+)
  if (tier >= 2) solar(ctx, house.at, -7, 0, -6, 5, 5)

  // cab on the front-left of the roof, warm-lit glazing on both faces
  {
    const [cx, cy] = house.at(3, 1)
    const cab = box(ctx, cx, cy, 3, 3, 7, W, { roof: N })
    cab.L(0, 6, 1, 4, warmPx(6, 4))
    cab.R(0, 6, 1, 4, (c, r) => (c === 0 || r === 0 || r === 3 || c === 5 ? FRAME : r === 1 ? WARM[2] : WARM[1]))
    cab.L(0, 6, 5, 1, OR[3])
    cab.R(0, 6, 5, 1, OR[1])
    lamp(ctx, cab.fx - 1, cab.top - 2, tier >= 3 ? '#ffffff' : WARM[3], WARM[1])
  }
  // railed walkway along the house's left edge and a boarding ladder
  {
    const [r0x, r0y] = house.at(-7, 6)
    const [r1x, r1y] = house.at(-1, 6)
    rail(ctx, r0x, r0y, r1x, r1y, 3)
    const [lx, ly] = at(-1, 6)
    ladder(ctx, lx - 1, ly - hz - 9, ly - 3)
  }
  if (tier >= 3) {
    // comms mast with a dish and floodlights along the house
    const [mx, my] = house.at(-5, -4)
    rect(ctx, mx, my - 16, 1, 16, N[3])
    rect(ctx, mx + 1, my - 16, 1, 16, MH[1])
    dome(ctx, mx + 3, my - 11, 3, 2, 1, W, false)
    rect(ctx, mx + 2, my - 11, 1, 1, MH[1])
    blink(ctx, mx, my - 18, t, 0.5)
    house.L(5, 8, 4, 1, (c) => (c % 4 === 1 ? '#ffffff' : null))
  }

  // bucket wheel, its face toward the viewer: rim, spokes, hub and eight orange buckets
  const Rw = 8
  const disc = (ox: number, oy: number, back: boolean) => {
    for (let Y = oy - Rw - 2; Y <= oy + Rw + 2; Y++)
      for (let X = ox - Rw; X <= ox + Rw; X++) {
        const u = (X + 0.5 - ox) / Rw
        const v = (0.5 * (X + 0.5 - ox) - (Y + 0.5 - oy)) / Rw
        const rho = Math.hypot(u, v)
        if (rho > 1) continue
        if (back) {
          if (rho > 0.8) rect(ctx, X, Y, 1, 1, MH[0])
          continue
        }
        const th = Math.atan2(v, u)
        let c: string
        if (rho > 0.8) c = tone(W, 0.5 + 0.35 * Math.sin(th + 0.8) - (rho > 0.93 ? 0.15 : 0), X, Y)
        else if (rho < 0.25) c = rho < 0.12 ? GD[4] : GD[2]
        else {
          const k = (((th - spin) % (Math.PI / 4)) + Math.PI / 4) % (Math.PI / 4)
          if (k < 0.16 || k > Math.PI / 4 - 0.06) c = tone(N, 0.7, X, Y)
          else c = (X + Y) % 2 ? MH[0] : MH[1]
        }
        rect(ctx, X, Y, 1, 1, c)
      }
  }
  disc(wx + 2, wy - 1, true)
  disc(wx, wy, false)
  for (let k = 0; k < 8; k++) {
    const a = spin + (k * Math.PI) / 4
    const px = Math.round(wx + Math.cos(a) * (Rw + 1))
    const py = Math.round(wy + (0.5 * Math.cos(a) - Math.sin(a)) * (Rw + 1))
    rect(ctx, px - 1, py - 1, 3, 3, OR[3])
    rect(ctx, px - 1, py - 1, 2, 1, OR[4])
    rect(ctx, px + 1, py, 1, 2, OR[1])
    rect(ctx, px, py, 1, 1, INK)
    if (Math.sin(a) > 0 && Math.cos(a) > -0.3) rect(ctx, px - 1, py - 2, 2, 1, REG[3]) // full buckets climbing
  }
  // the wheel's bite: the near lip of the pit, loose regolith and a curtain of dust
  {
    const [lx, ly] = at(12, 6)
    dome(ctx, lx, ly - 1, 6, 3, 1, REG, false)
    for (let s = 7; s <= 15; s++) {
      const [px, py] = at(s, 7)
      rect(ctx, px, py, 2, 1, (px + py) % 4 < 2 ? OR[3] : W[3])
    }
    puffs(ctx, lx - 3, ly - 3, t, DUST)
  }
  if (t > 0)
    for (let k = 0; k < 3; k++) {
      const f = (t * 2 + k / 3) % 1
      rect(ctx, wx - 7 + k * 2 + Math.round(f * 3), wy + 7 - Math.round(f * 6), 1, 1, k ? REG[4] : DUST[4])
    }
  // a warning beacon on a post at the pit's far corner
  {
    const [px, py] = at(15, -8)
    rect(ctx, px, py - 6, 1, 6, N[3])
    blink(ctx, px, py - 7, t, 0.25)
    leds(ctx, px - 2, py - 3, 1, t, 0)
  }
}
