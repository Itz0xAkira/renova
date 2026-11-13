/**
 * Processing: the ice melter (2×2), smelter, sinter kiln and soil washer (3×3).
 *
 * Drawn as near-future space-agency hardware: white composite panels and
 * pressure hulls, light-grey structure, inflatable fabric modules with seams
 * and restraint straps, gold MLI foil on hot or cold machinery, safety-orange
 * stripes, rails and hatches, small red/green status lamps, warm-lit windows,
 * and red regolith dust creeping up every lower wall.
 *
 * Each function draws one building on ground point (x, y), the centre of its
 * footprint. A w×h footprint spans ±(w+h)·8 px across and ±(w+h)·4 px down.
 * `t` is animation time; frame 0 (t = 0) doubles as the idle pose.
 *
 * Positions on the deck are given as (s, r): s runs toward the lower right
 * (screen +1, +½ per px), r toward the lower left (screen −1, +½). A 2×2 deck
 * covers s, r ∈ [−16, 16], a 3×3 deck s, r ∈ [−24, 24].
 */
import { rect, type Ctx } from '@/site/pixel/engine'
import { band, cyl, dome, GLOW, getTier, INK, lamp, pipe, plinth, RAMP, stencilPx, tone, type Ramp } from '@/game/art/pixel'
import { line, glowStrip, puffs, MH, CY, STEAM } from '@/game/art/buildings/kit'

/** White and off-white composite. */
const W = RAMP.hull
/** Neutral light greys. */
const N = RAMP.neutral
const OR = RAMP.orange
const GD = RAMP.gold
const NV = RAMP.navy
const ICE = RAMP.ice
const REG = RAMP.regolith
/** Inflatable module fabric: a soft, warm off-white. */
const FAB: Ramp = ['#837a80', '#ada5a6', '#d3ccc5', '#ede7dc', '#fffbf2']
/** A water bladder's coated fabric: cooler and a touch darker. */
const BLAD: Ramp = ['#5a5868', '#86889a', '#b4b8c4', '#dadde2', '#f4f6f6']
/** Warm interior light. */
const WARM: Ramp = ['#7a4a1c', '#c98a3a', '#ffcf7a', '#ffe3a3', '#fff0c0']
/** Shell heat, from dull red to white-hot. */
const HEAT: Ramp = ['#4a1a12', '#8a2a14', '#c94c1a', '#f3902e', '#ffe08a']
/** A finished metal ingot (the Metal item's colours). */
const INGOT: Ramp = ['#4a5260', '#7d8794', '#a9b2bd', '#d6dbe2', '#f4f6f9']
/** Sintered regolith bricks. */
const BRICK: Ramp = ['#5a2a1e', '#874232', '#a95c40', '#c77b55', '#e09c74']
/** A polished concentrator mirror. */
const MIRROR: Ramp = ['#34465f', '#5d7896', '#93adc6', '#cddcea', '#ffffff']
/** Murky process water. */
const MURK: Ramp = ['#24393f', '#33525a', '#4d7377', '#76a19d', '#b9dcd2']
/** Dark washed soil. */
const SOIL: Ramp = ['#24160f', '#3b281b', '#573b27', '#785536', '#9c7450']
const FRAME = '#3a3442'
const RED: readonly [string, string] = ['#ff5a4f', '#6a1c18']
const GRN: readonly [string, string] = ['#7dffa8', '#1f5a35']

type Px = string | ((c: number, r: number) => string | null)

/** Ground-to-screen mapping for a deck whose top centre is (x, g). */
const deck = (x: number, g: number) => (s: number, r: number, z = 0) => [Math.round(x + s - r), Math.round(g + (s + r) / 2) - z] as const

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
 * light 0–1); `cap` colours the visible front end from (across, up, light).
 */
function drum(ctx: Ctx, ox: number, oy: number, s0: number, s1: number, R0: number, Rz: number, paint: (s: number, a: number, v: number, X: number, Y: number) => string | null, cap: (v: number, z: number, X: number, Y: number) => string | null) {
  const A = Math.hypot(R0, Rz)
  const phi = Math.atan2(Rz, R0)
  for (let X = ox + s0 - R0 - 1; X <= ox + s1 + R0 + 1; X++)
    for (let Y = oy + Math.floor(s0 / 2) - R0 - Rz - 2; Y <= oy + Math.ceil(s1 / 2) + R0 + Rz + 2; Y++) {
      const xq = X + 0.5 - ox
      const yq = Y + 0.5 - oy
      // end cap
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

/** A row of tiny status lamps, green and red, one of them blinking. */
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

/** A white ribbed pressure vessel with a domed head. */
function vessel(ctx: Ctx, cx: number, base: number, rx: number, h: number, rib = 5, head = 3) {
  cyl(ctx, cx, base, rx, h, W, W)
  for (let z = rib; z < h - 1; z += rib) band(ctx, cx, base, rx, z, 1, (dx) => (dx < -rx / 3 ? W[2] : dx < rx / 3 ? W[1] : W[0]))
  if (head) dome(ctx, cx, base - h, rx, (rx >> 1) + head, rx >> 1, W, false)
  band(ctx, cx, base, rx, h, 1, (dx) => (dx < 0 ? W[2] : W[1]))
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
    if (r === (h >> 1) + 1 && c === w - 3) return INK
    return lit ? W[3] : W[1]
  }

/** A window glowing with warm interior light. */
const warmPx = (w: number, h: number) => (c: number, r: number) => (c === 0 || r === 0 || c === w - 1 || r === h - 1 ? FRAME : r === 1 ? WARM[4] : (c + r) % 5 === 0 ? WARM[3] : WARM[2])

/** A light-grey louvred grille. */
const grillePx = (lit: boolean) => (c: number, r: number) => (r % 2 ? (lit ? W[0] : FRAME) : c % 4 === 3 ? null : lit ? N[3] : N[2])

/** Safety-orange stripe. */
const orangePx = (lit: boolean) => (lit ? OR[3] : OR[1])

/**
 * A soft fabric dome: an inflatable shell with meridian seams, a ring of
 * restraint straps and regolith sandbags weighing down its hem.
 */
function fabricDome(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, rb: number, straps = 2, bags = true) {
  dome(ctx, cx, cy, rx, ry, rb, FAB, false)
  const half = (dy: number) => Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2)))
  // meridian seams
  for (const f of [-0.72, -0.4, 0, 0.4, 0.72])
    for (let dy = -ry + 2; dy <= 0; dy++) {
      const X = cx + Math.round(f * half(dy))
      rect(ctx, X, cy + dy, 1, 1, f > 0.1 ? FAB[1] : FAB[2])
    }
  // restraint straps: latitude rings
  for (let k = 1; k <= straps; k++) {
    const dy0 = -Math.round((ry * k) / (straps + 1))
    const w0 = half(dy0)
    for (let dx = -w0; dx < w0; dx++) {
      const e = Math.round(Math.sqrt(Math.max(0, 1 - ((dx + 0.5) / w0) ** 2)) * rb * (w0 / rx))
      rect(ctx, cx + dx, cy + dy0 + e, 1, 1, dx < -w0 / 3 ? N[2] : dx < w0 / 3 ? N[1] : N[0])
    }
  }
  if (!bags) return
  // sandbag ballast along the front hem
  for (let k = 0; k < 9; k++) {
    const a = Math.PI * (0.08 + (k / 8) * 0.84)
    const bx = cx + Math.round(Math.cos(a) * (rx - 1))
    const by = cy + Math.round(Math.sin(a) * rb)
    rect(ctx, bx - 2, by - 1, 4, 2, k < 4 ? REG[3] : REG[2])
    rect(ctx, bx - 2, by - 1, 2, 1, REG[4])
    rect(ctx, bx - 2, by + 1, 4, 1, REG[1])
  }
}

/** A thin radiator panel standing along r (its visible face is the shaded +s side), hot at the root. */
function radiatorR(ctx: Ctx, x0: number, y0: number, len: number, h: number, heat: number) {
  for (let k = 0; k < len; k++) {
    const X = x0 - k
    const Yb = y0 + (k >> 1)
    for (let z = 0; z < h; z++) {
      const edge = k === 0 || k === len - 1 || z === h - 1
      let c: string = edge ? N[2] : z % 3 === 0 ? W[0] : tone(W, 0.42 - 0.12 * (k / len), X, Yb - z)
      const hv = heat * Math.max(0, 1 - z / (h * 0.45)) ** 1.5
      if (!edge && hv > 0.1) c = tone(HEAT, 0.3 + hv * 0.65 - (z % 3 === 0 ? 0.15 : 0), X, Yb - z)
      if (k === 0 || k === len - 1) c = k === 0 ? MH[1] : N[3]
      rect(ctx, X, Yb - z, 1, 1, c)
    }
    rect(ctx, X, Yb - h, 1, 1, N[3])
  }
}

/**
 * A round hopper: a cone widening from r0 at height z0 to r1 at z1 above
 * ground point (cx, cy), on three legs, heaped with `fill`.
 */
function hopper(ctx: Ctx, cx: number, cy: number, z0: number, z1: number, r0: number, r1: number, ramp: Ramp, fill: Ramp) {
  for (const [lx, ly] of [
    [cx - r0, cy - 1],
    [cx + r0 - 1, cy - 1],
    [cx, cy + (r0 >> 1)],
  ]) {
    rect(ctx, lx, ly - z0, 1, z0, lx < cx ? N[3] : MH[2])
  }
  line(ctx, cx - r0, cy - 2, cx + r0 - 1, cy - z0 + 2, MH[2])
  line(ctx, cx - r0, cy - z0 + 2, cx + r0 - 1, cy - 2, MH[1])
  for (let z = z0; z <= z1; z++) {
    const rr = r0 + ((r1 - r0) * (z - z0)) / (z1 - z0)
    const w = Math.round(rr)
    for (let dx = -w; dx < w; dx++) {
      const e = Math.round(Math.sqrt(Math.max(0, 1 - ((dx + 0.5) / rr) ** 2)) * (rr / 2))
      for (let yy = -e; yy <= e; yy++) rect(ctx, cx + dx, cy - z + yy, 1, 1, tone(ramp, 0.78 - 0.55 * ((dx + w) / (2 * w)) - (z === z0 ? 0.2 : 0), cx + dx, cy - z + yy))
    }
  }
  const w = Math.round(r1)
  for (let dx = -w + 1; dx < w - 1; dx++) {
    const e = Math.round(Math.sqrt(Math.max(0, 1 - ((dx + 0.5) / (r1 - 1)) ** 2)) * ((r1 - 1) / 2))
    for (let yy = -e; yy <= e; yy++) rect(ctx, cx + dx, cy - z1 + yy, 1, 1, INK)
  }
  dome(ctx, cx, cy - z1, w - 2, 3, Math.max(0, (w >> 1) - 2), fill, false)
  for (let dx = -w; dx < w; dx++) rect(ctx, cx + dx, cy - z1 + Math.round(Math.sqrt(Math.max(0, 1 - ((dx + 0.5) / r1) ** 2)) * (r1 / 2)), 1, 1, dx < 0 ? OR[3] : OR[1])
}

/** A white exhaust stack with orange day-marker bands, a ladder and a beacon. */
function ventStack(ctx: Ctx, cx: number, base: number, rx: number, h: number, t: number, ph: number) {
  cyl(ctx, cx, base, rx, h, W, N)
  for (let z = 6; z < h - 12; z += 6) band(ctx, cx, base, rx, z, 1, (dx) => (dx < 0 ? W[2] : W[1]))
  for (const z of [h - 2, h - 8]) band(ctx, cx, base, rx, z, 3, (dx) => (dx < -1 ? OR[3] : dx < 2 ? OR[2] : OR[1]))
  dome(ctx, cx, base - h, rx - 1, 0, 0, [INK, INK, INK, INK, INK], false)
  ladder(ctx, cx - rx + 2, base - h + 3, base - 2)
  cylDust(ctx, cx, base, rx, h, 0.18)
  blink(ctx, cx + rx, base - h - 1, t, ph)
  if (t > 0) {
    puffs(ctx, cx, base - h - 4, t, STEAM)
    for (let k = 0; k < 3; k++) rect(ctx, cx - 1 + ((Math.floor(t * 8) + k * 3) % 4), base - h - 2 - k * 2, 1, 1, '#f6efe6')
  }
}

/* --------------------------------- melter -------------------------------- */

/**
 * Ice melter: a white ribbed pressure vessel on a gold-foil heater jacket with
 * a glowing heater seam, its sight glass showing the water `level`, an ice
 * hopper and orange handrail on its domed head. Its signature is the fabric
 * water bladder strapped down out front, which swells as the tank fills.
 * A dusty white control module with a warm window and a hatch stands left.
 */
export function melter(ctx: Ctx, x: number, y: number, t: number, level: number) {
  const tier = getTier()
  const g = plinth(ctx, x, y, 2, 2, 5)
  const at = deck(x, g)
  const lv = Math.max(0, Math.min(1, level))
  const pulse = (Math.sin(t * Math.PI * 2) + 1) / 2

  // main vessel
  const [tx, ty] = at(2, -6)
  const TR = 10
  const TH = 24
  vessel(ctx, tx, ty, TR, TH, 4, 3)
  foil(ctx, tx, ty, TR, 1, 7)
  // the heater seam, glowing brighter with each upgrade
  band(ctx, tx, ty, TR, 8, 1, (dx) => tone(HEAT, 0.42 + tier * 0.08 + pulse * 0.12 - ((dx + TR) / (2 * TR)) * 0.3, tx + dx, 0))
  band(ctx, tx, ty, TR, TH - 2, 2, (dx) => (dx < -3 ? OR[3] : dx < 4 ? OR[2] : OR[1]))
  // sight glass with level ticks and rising bubbles
  const gx = -9
  const gw = 3
  const gz0 = 10
  const gh = 11
  wrap(ctx, tx, ty, TR, gx - 1, gw + 2, gz0 - 1, gh + 2, (c, r) => (c === 0 || c === gw + 1 || r === 0 || r === gh + 1 ? FRAME : null))
  const water = Math.round(gh * lv)
  wrap(ctx, tx, ty, TR, gx, gw, gz0, gh, (c, r) => {
    if (r >= water) return r === water ? CY[1] : '#20313a'
    if (r === water - 1) return GLOW
    if (t > 0 && (r + Math.floor(t * 8) + c * 3) % 7 === 0 && c > 0) return CY[4]
    return tone(CY, 0.65 - (r / gh) * 0.2 + (c === 0 ? 0.15 : 0), c, r)
  })
  wrap(ctx, tx, ty, TR, gx + gw + 1, 1, gz0, gh, (_, r) => (r % 3 === 0 ? OR[2] : null))
  // a bolted manway and a stencilled tank number
  wrap(ctx, tx, ty, TR, -3, 6, 11, 6, (c, r) => {
    const d = Math.hypot(c - 2.5, r - 2.5)
    return d > 3.1 ? null : d > 2.3 ? OR[c < 3 ? 3 : 2] : d < 0.9 ? FRAME : W[c < 3 ? 3 : 2]
  })
  wrap(ctx, tx, ty, TR, 4, 5, 17, 3, stencilPx(0b1101101))
  ladder(ctx, tx + 4, ty - TH + rim(TR, 4) + 1, ty + rim(TR, 4) - 3)
  cylDust(ctx, tx, ty, TR, TH, 0.22)
  // head: back half of the handrail, ice hopper, steam vent, front half of the rail
  const lidY = ty - TH
  for (let dx = -TR; dx < TR; dx += 3) rect(ctx, tx + dx, lidY - rim(TR, dx) - 4, 1, 3, MH[2])
  for (let dx = -TR; dx < TR; dx++) rect(ctx, tx + dx, lidY - rim(TR, dx) - 4, 1, 1, OR[2])
  hopper(ctx, tx - 2, lidY - 2, 1, 7, 2, 5, N, ICE)
  cyl(ctx, tx + 5, lidY - 2, 1, 5, N, N)
  puffs(ctx, tx + 5, lidY - 9, t, STEAM)
  for (let dx = -TR; dx < TR; dx += 3) rect(ctx, tx + dx, lidY + rim(TR, dx) - 3, 1, 3, MH[3])
  for (let dx = -TR; dx < TR; dx++) rect(ctx, tx + dx, lidY + rim(TR, dx) - 3, 1, 1, dx < 0 ? OR[3] : OR[2])

  // holding tank (level 2+), back right, wrapped in gold foil
  if (tier >= 2) {
    const [hx, hy] = at(13, -5)
    cyl(ctx, hx, hy, 4, 15, GD, W)
    foil(ctx, hx, hy, 4, 1, 13)
    band(ctx, hx, hy, 4, 15, 1, W[1])
    glowStrip(ctx, hx - 2, hy - 2, 9, lv)
    pipe(ctx, hx - 4, hy - 10, tx + TR - 2, hy - 12, MH)
    cylDust(ctx, hx, hy, 4, 15)
  }

  // control module, front left
  const [bx0, by0] = at(-8, 7)
  const blk = box(ctx, bx0, by0, 5, 6, 13, W, { seams: 5, roof: W })
  blk.L(0, 10, 1, 1, orangePx(true))
  blk.L(1, 4, 3, 4, warmPx(4, 4))
  blk.L(5, 5, 3, 10, hatchPx(5, 10))
  blk.L(1, 4, 8, 1, stencilPx(0b10110))
  blk.R(0, 12, 1, 1, orangePx(false))
  blk.R(1, 8, 3, 1, stencilPx(0b11011011))
  blk.R(2, 8, 6, 3, grillePx(false))
  blk.grime(0.28)
  leds(ctx, blk.fx + 2, blk.fy + 3, 3, t, 0b010)
  {
    const [ax, ay] = blk.at(2, -2)
    if (tier >= 3) {
      // a pair of white radiator fins dumping heater waste heat
      radiatorR(ctx, ax + 3, ay - 1, 8, 9, 0)
      radiatorR(ctx, ax - 1, ay + 1, 8, 9, 0)
    } else {
      rect(ctx, ax, ay - 9, 1, 9, N[3])
      rect(ctx, ax - 1, ay - 9, 3, 1, MH[3])
      blink(ctx, ax, ay - 11, t, 0.3)
    }
    if (tier >= 2) {
      const [ex, ey] = blk.at(-2, 3)
      const eb = box(ctx, ex, ey, 2, 2, 3, GD, { roof: GD })
      eb.L(0, 4, 1, 1, GD[1])
    }
  }
  // power umbilical along the deck and a water feed from the module
  line(ctx, blk.fx + 11, blk.fy + 8, tx - TR + 2, ty + 2, FRAME)
  pipe(ctx, blk.fx + 4, blk.fy - 2, tx - TR + 1, ty - 12, MH)

  // the fabric water bladder, front right, swelling with the level
  {
    const [bx, by] = at(9, 8)
    const bh = 2 + Math.round(lv * 8)
    // fill hose from the vessel, sagging to the bladder
    pipe(ctx, tx - 1, ty + 3, bx + 4, by - bh - 1, N)
    rect(ctx, bx + 4, by - bh - 2, 2, 2, RED[0])
    // a ground sheet under it, then the pillow with a dark hem
    for (let dx = -11; dx < 11; dx++) rect(ctx, bx + dx, by + Math.round(Math.sqrt(Math.max(0, 1 - ((dx + 0.5) / 11) ** 2)) * 5), 1, 1, MH[1])
    dome(ctx, bx, by, 10, bh, 4, BLAD, false)
    for (let dx = -10; dx < 10; dx++) rect(ctx, bx + dx, by + Math.round(Math.sqrt(Math.max(0, 1 - ((dx + 0.5) / 10) ** 2)) * 4), 1, 1, BLAD[0])
    for (let dx = -9; dx < 9; dx++) rect(ctx, bx + dx, by - 1 + Math.round(Math.sqrt(Math.max(0, 1 - ((dx + 0.5) / 9) ** 2)) * 3), 1, 1, dx < 0 ? BLAD[2] : BLAD[1])
    // two cross straps over the pillow, pegged to the deck
    const half = (dy: number) => (dy <= 0 ? 10 * Math.sqrt(Math.max(0, 1 - (dy / (bh + 0.5)) ** 2)) : 10 * Math.sqrt(Math.max(0, 1 - (dy / 4.5) ** 2)))
    for (const d of [-4, 4])
      for (let dy = -bh; dy <= 4; dy++) {
        const X = bx + d - Math.round(dy * 0.6)
        if (Math.abs(X + 0.5 - bx) < half(dy)) rect(ctx, X, by + dy, 1, 1, d < 0 ? OR[3] : OR[2])
      }
    for (const d of [-4, 4]) rect(ctx, bx + d - 3, by + 5, 2, 1, FRAME)
    rect(ctx, bx - 5, by - bh + 1, 3, 1, FAB[4])
    // a level gauge on a post beside it
    rect(ctx, bx + 11, by - 9, 1, 9, MH[2])
    glowStrip(ctx, bx + 9, by - 3, 6, lv)
  }
}

/* -------------------------------- smelter -------------------------------- */

/**
 * Smelter: a white composite furnace hall whose signature is the "furnace
 * eye", a big round port glowing with the melt; a gold-foil crucible dome on
 * its roof ducted to a white stack with orange day-marker bands (two from
 * level 2); a heat-rejection radiator wing on the right glowing at its root;
 * an ore hopper fed by an inclined belt; and a casting line where poured
 * ingots cool from orange to silver and stack on a pallet.
 */
export function bigSmelter(ctx: Ctx, x: number, y: number, t: number) {
  const tier = getTier()
  const g = plinth(ctx, x, y, 3, 3, 6)
  const at = deck(x, g)
  const flick = (t * 3) % 1 < 0.5 ? 0.06 : 0

  // stacks behind the hall
  if (tier >= 2) {
    const [c2x, c2y] = at(-12, -19)
    ventStack(ctx, c2x, c2y, 3, 40, t + 0.5, 0.5)
  }
  const [c1x, c1y] = at(6, -17)
  ventStack(ctx, c1x, c1y, 4, 50, t, 0)

  // furnace hall
  const [hx, hy] = at(-2, -2)
  const HH = 24
  const hall = box(ctx, hx, hy, 13, 11, HH, W, { seams: 6, roof: W })
  hall.L(0, 26, 1, 2, (c, r) => (r === 0 ? OR[3] : OR[2]))
  hall.L(2, 8, 5, 4, warmPx(8, 4))
  hall.L(2, 8, 10, 1, stencilPx(0b10110111))
  hall.L(2, 7, 12, 11, hatchPx(7, 11))
  // the furnace eye: an orange-framed port onto the glowing melt
  hall.L(12, 13, 6, 13, (c, r) => {
    const d = Math.hypot(c - 6, (r - 6) * 1.05)
    if (d > 6.5) return null
    if (d > 5.5) return OR[c < 6 ? 3 : 2]
    if (d > 4.6) return FRAME
    const crust = n2(c + Math.floor(t * 2), r) > 0.86
    const v = 1 - d * 0.13 + flick - (r < 3 ? 0.1 : 0)
    return crust ? HEAT[1] : tone(HEAT, v, c, r)
  })
  hall.L(14, 9, 20, 1, (c) => (c % 2 ? FRAME : null))
  if (t > 0) hall.L(15 + (Math.floor(t * 7) % 6), 1, 9 + (Math.floor(t * 11) % 5), 1, '#ffffff')
  // right face: a vehicle airlock, louvres, a number and status lamps
  hall.R(0, 22, 1, 2, (c, r) => (r === 0 ? OR[2] : OR[1]))
  hall.R(2, 10, 9, 15, hatchPx(10, 15, false))
  hall.R(14, 6, 6, 5, grillePx(false))
  hall.R(14, 6, 13, 1, stencilPx(0b110111))
  hall.R(14, 6, 16, 1, stencilPx(0b101101))
  hall.grime(0.26)
  leds(ctx, hall.fx + 15, hall.fy + 4, 3, t, 0b001)
  // roof: the crucible dome in gold foil, its glowing collar, and the offtake duct
  {
    const [mx, my] = hall.at(-3, -2)
    rect(ctx, mx - 9, my - 1, 18, 1, N[1])
    dome(ctx, mx, my, 8, 7, 3, GD, false)
    for (let dy = -6; dy <= 2; dy++)
      for (let dx = -7; dx < 7; dx++) if (n2(mx + dx, my + dy) > 0.82 && Math.hypot(dx / 8, dy / 7) < 0.9) rect(ctx, mx + dx, my + dy, 1, 1, dx < 0 ? GD[4] : GD[1])
    for (let dx = -8; dx < 8; dx++) rect(ctx, mx + dx, my + Math.round(Math.sqrt(Math.max(0, 1 - ((dx + 0.5) / 8) ** 2)) * 3), 1, 1, tone(HEAT, 0.62 + flick - ((dx + 8) / 16) * 0.3, mx + dx, my))
    dome(ctx, mx, my - 7, 3, 1, 1, N, false)
    for (let k = 0; k < 3; k++) pipe(ctx, mx + 2, my - 7 - k, c1x - 4, c1y - 36 - k, k === 2 ? N : MH)
    // a roof fan housing and a handrail along the front edges
    const [fx, fy] = hall.at(7, 4)
    dome(ctx, fx, fy, 3, 1, 1, N, false)
    const a = t * Math.PI * 2
    rect(ctx, fx - 2 + Math.round(Math.cos(a) * 2), fy, 1, 1, MH[0])
    const [r0x, r0y] = hall.at(-13, 11)
    const [r1x, r1y] = hall.at(13, 11)
    const [r2x, r2y] = hall.at(13, -11)
    rail(ctx, r0x, r0y, r1x, r1y, 3)
    rail(ctx, r1x, r1y, r2x, r2y, 3, OR[2])
    ladder(ctx, hall.fx + 12, hall.fy - 8, hall.fy + 7)
  }

  // heat-rejection radiator wings on the right, glowing at the root
  {
    const [wx, wy] = at(22, -22)
    rect(ctx, wx - 16, wy + 8, 17, 1, MH[1])
    radiatorR(ctx, wx, wy, 16, 30, 0.7 + flick)
    if (tier >= 3) {
      const [vx, vy] = at(18, -20)
      radiatorR(ctx, vx, vy, 14, 24, 0.6 + flick)
    }
    pipe(ctx, wx - 15, wy + 4, hall.fx + 26, hall.fy + 6, GD)
  }
  // power cabinet with status lamps, front right
  {
    const [tx0, ty0] = at(16, 3)
    const tr = box(ctx, tx0, ty0, 4, 4, 9, W, { seams: 4, roof: N })
    tr.L(0, 8, 1, 1, orangePx(true))
    tr.L(2, 4, 3, 2, (c, r) => (r === 0 ? FRAME : c % 2 ? CY[3] : GLOW))
    tr.R(1, 6, 2, 4, grillePx(false))
    tr.grime(0.3)
    leds(ctx, tr.lx + 3, tr.top + 3, 2, t, 0b01)
    line(ctx, tr.lx, tr.top + 9, hall.fx + 8, hall.fy + HH - 2, FRAME)
  }

  // ore hopper on stilts, fed by an inclined belt from the left corner
  const [ox, oy] = at(-17, 11)
  {
    const [bx0, by0] = at(-23, 20)
    const top = [ox - 7, oy - 26] as const
    for (let k = 0; k < 3; k++) {
      const f = 0.3 + k * 0.3
      const lx = Math.round(bx0 + (top[0] - bx0) * f)
      const ly = Math.round(by0 + (top[1] - by0) * f)
      rect(ctx, lx, ly, 1, by0 - ly + Math.round((lx - bx0) / 2), MH[2])
    }
    line(ctx, bx0, by0 - 2, top[0], top[1] - 2, N[3])
    line(ctx, bx0, by0, top[0], top[1], MH[1])
    line(ctx, bx0, by0 - 1, top[0], top[1] - 1, MH[0])
    for (let k = 0; k < 4; k++) {
      const f = (t * 0.5 + k / 4) % 1
      rect(ctx, Math.round(bx0 + (top[0] - bx0) * f), Math.round(by0 + (top[1] - by0) * f) - 3, 2, 1, k % 2 ? '#a3565f' : REG[2])
    }
  }
  hopper(ctx, ox, oy, 12, 25, 3, 8, W, ['#4a2a30', '#6e3640', '#a3565f', '#c17a5c', '#d99862'])
  for (let k = 0; k < 3; k++) line(ctx, ox + 1, oy - 12 + k, ox + 7, oy - 16 + k, k === 0 ? N[4] : k === 1 ? N[2] : MH[0])

  // casting line: moulds ride from the tap to the pallet, cooling as they go
  const [lx0, ly0] = at(5, 15)
  const cast = box(ctx, lx0, ly0, 13, 2, 4, W, { roof: N })
  cast.L(0, 26, 0, 1, OR[3])
  cast.L(0, 26, 1, 3, (c, r) => (c % 4 === 0 ? (r === 0 ? N[4] : N[2]) : r === 2 ? MH[0] : null))
  cast.R(0, 4, 0, 1, OR[1])
  cast.grime(0.5)
  const shift = (t * 2.5) % 5
  for (let s = -12; s <= 12; s += 5) {
    const ss = s + shift
    if (ss > 12) continue
    const [mx, my] = at(5 + ss, 15, 5)
    const cool = (ss + 12) / 24
    const hot = cool < 0.5
    rect(ctx, mx - 2, my, 5, 2, MH[0])
    rect(ctx, mx - 1, my, 3, 1, hot ? tone(HEAT, 1 - cool * 0.9, mx, my) : INGOT[3])
    rect(ctx, mx - 1, my, 1, 1, hot ? '#ffffff' : INGOT[4])
    rect(ctx, mx - 1, my + 1, 3, 1, hot ? HEAT[2] : INGOT[1])
    if (hot && t > 0 && ((t * 4) | 0) % 2 === 0) rect(ctx, mx, my - 2, 1, 1, STEAM[2])
  }
  // tap spout from the hall pouring into the first mould
  {
    const [sx, sy] = at(-5, 10, 9)
    line(ctx, sx - 2, sy, sx + 2, sy + 2, GD[1])
    line(ctx, sx - 2, sy - 1, sx + 2, sy + 1, GD[3])
    const [px, py] = at(-5, 15, 5)
    const pour = (t * 4) % 1 < 0.5
    for (let yy = sy + 3; yy < py; yy++) rect(ctx, sx + 2, yy, 1, 1, pour ? HEAT[4] : HEAT[3])
    rect(ctx, px - 1, py - 1, 3, 1, HEAT[3])
    if (t > 0) for (let k = 0; k < 3; k++) rect(ctx, sx + 1 + ((Math.floor(t * 8) + k * 2) % 5) - 2, py - 2 - k, 1, 1, '#fff3c4')
  }
  // ingot pallet at the end of the line
  {
    const [px, py] = at(19, 17)
    box(ctx, px, py, 4, 4, 1, MH, { roof: N })
    const rows = tier === 1 ? 2 : 3
    for (let k = 0; k < rows; k++)
      for (let j = 0; j < 3; j++) {
        const ix = px - 4 + j * 3 + (k % 2)
        const iy = py - 3 - k * 2 + (j >> 1)
        rect(ctx, ix, iy, 3, 1, INGOT[3])
        rect(ctx, ix, iy + 1, 3, 1, INGOT[1])
        rect(ctx, ix, iy, 1, 1, INGOT[4])
      }
  }
}

/* ---------------------------------- kiln --------------------------------- */

/**
 * Sinter kiln: a long rotary drum, white at the cool feed end, wrapped in gold
 * MLI foil in the middle and glowing through its seams at the hot end, on two
 * riding rings and a girth gear. Its signature is the solar concentrator: a
 * segmented mirror dish at the back right that throws a shimmering beam into
 * the receiver on the firing hood. A white exhaust tower stands behind, a
 * railed catwalk runs in front, and pallets of sintered bricks wait at the
 * discharge.
 */
export function bigKiln(ctx: Ctx, x: number, y: number, t: number) {
  const tier = getTier()
  const g = plinth(ctx, x, y, 3, 3, 6)
  const at = deck(x, g)
  const spin = t * Math.PI * 0.5
  const flick = (t * 2) % 1 < 0.5 ? 0.05 : 0

  // exhaust tower behind, with a flue from the feed hood
  {
    const [sx, sy] = at(-9, -17)
    ventStack(ctx, sx, sy, 4, 40, t, 0)
    const [ax, ay] = at(-21, 0, 21)
    for (let k = 0; k < 3; k++) pipe(ctx, ax, ay - k, sx - 3, sy - 30 - k, k === 2 ? N : MH)
  }
  // heat-recovery tank in gold foil (level 2+), back left
  if (tier >= 2) {
    const [cx, cy] = at(-21, -10)
    cyl(ctx, cx, cy, 4, 18, GD, W)
    foil(ctx, cx, cy, 4, 1, 16)
    band(ctx, cx, cy, 4, 18, 1, W[1])
    cylDust(ctx, cx, cy, 4, 18)
  }

  // the solar concentrator: a mirror dish on an az-el pedestal, back right
  const [dx0, dy0] = at(14, -18)
  const DR = 11
  const DZ = 13
  const dcx = dx0
  const dcy = dy0 - 14 - DZ
  {
    const ped = box(ctx, dx0, dy0, 3, 3, 12, W, { roof: N })
    ped.L(0, 6, 1, 1, orangePx(true))
    ped.grime(0.3)
    rect(ctx, dx0 - 1, dy0 - 18, 3, 6, MH[2])
    rect(ctx, dx0 - 1, dy0 - 18, 1, 6, N[3])
    // struts behind the dish
    line(ctx, dx0, dy0 - 16, dcx + DR - 2, dcy - 6, MH[1])
    line(ctx, dx0, dy0 - 16, dcx + 4, dcy + DZ - 2, MH[1])
    for (let Y = dcy - DZ; Y <= dcy + DZ; Y++)
      for (let X = dcx - DR; X <= dcx + DR; X++) {
        const u = (X + 0.5 - dcx) / DR
        const v = (Y + 0.5 - dcy) / DZ
        const d = Math.hypot(u, v)
        if (d > 1) continue
        let c: string
        if (d > 0.88) c = u + v < 0 ? N[4] : MH[2]
        else {
          const ang = Math.atan2(v, u)
          const petal = Math.abs(((ang / (Math.PI / 4)) % 1) + 1) % 1 < 0.08 || Math.abs(d - 0.5) < 0.04
          const sky = 0.35 + 0.45 * (1 - d) + 0.25 * (u - v) * 0.5
          c = petal ? MIRROR[1] : tone(MIRROR, sky, X, Y)
          if (Math.abs(u + v + 0.5) < 0.07 && d < 0.8) c = '#ffffff'
        }
        rect(ctx, X, Y, 1, 1, c)
      }
    rect(ctx, dcx - 1, dcy - 1, 2, 2, N[1])
  }

  // roller piers under the riding rings
  const RS = [-11, 7]
  for (const s of RS) {
    const [px, py] = at(s, 4)
    const pier = box(ctx, px, py, 3, 6, 6, W, { roof: N })
    pier.L(0, 6, 1, 1, orangePx(true))
    pier.R(0, 12, 1, 1, orangePx(false))
    pier.grime(0.4)
    for (const r of [-4, 4]) {
      const [rx, ry] = at(s, 4 + r, 7)
      dome(ctx, rx, ry, 2, 1, 1, MH, false)
    }
  }
  // drive motor, gold-foiled, by the girth gear
  {
    const [mx, my] = at(-3, -6)
    const mot = box(ctx, mx, my, 3, 3, 7, GD, { roof: N })
    mot.R(1, 4, 2, 3, grillePx(false))
  }

  // the rotary drum
  const [ox, oy] = at(0, 4, 14)
  const s0 = -19
  const s1 = 15
  drum(
    ctx,
    ox,
    oy,
    s0,
    s1,
    8,
    7,
    (s, a, v, X, Y) => {
      const rot = a + spin
      for (const rs of RS) if (Math.abs(s - rs) < 1.6) return tone(MH, v + (Math.abs(s - rs) < 0.6 ? 0.3 : 0.1), X, Y)
      if (s > -4.5 && s < -1.5) return Math.floor(rot * 10) % 2 ? MH[0] : tone(MH, v + 0.15, X, Y)
      const seam = ((rot % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3) < 0.13
      if (s < -12.6) return seam ? W[1] : tone(W, v * 0.95, X, Y)
      if (s > 5) {
        const hot = (s - 5) / (s1 - 5)
        if (seam) return tone(HEAT, 0.45 + hot * 0.5 + flick, X, Y)
        return tone(GD, v * 0.75 - hot * 0.35 + (n2(Math.floor(s), Math.floor(rot * 6)) - 0.5) * 0.3, X, Y)
      }
      if (Math.abs(s - 5) < 0.6) return GD[1]
      return seam ? GD[1] : tone(GD, v * 0.9 + (n2(Math.floor(s / 2), Math.floor(rot * 6)) - 0.5) * 0.35, X, Y)
    },
    (V, Z) => (Math.hypot(V / 8, Z / 7) > 0.75 ? HEAT[2] : tone(HEAT, 0.9 - Math.hypot(V / 8, Z / 7) * 0.4 + flick, V | 0, Z | 0)),
  )
  // shimmer over the hot zone
  if (t > 0)
    for (let k = 0; k < 4; k++) {
      const [hx, hy] = at(5 + k * 3, 4, 23 + ((Math.floor(t * 4) + k) % 3))
      rect(ctx, hx, hy, 1, 1, HEAT[3])
    }

  // feed hood with a hopper of raw regolith
  {
    const [fx, fy] = at(-21, 4)
    const hood = box(ctx, fx, fy, 2, 7, 21, W, { seams: 5, roof: N })
    hood.L(0, 4, 1, 1, orangePx(true))
    hood.L(0, 4, 3, 3, warmPx(4, 3))
    hood.R(0, 14, 1, 1, orangePx(false))
    hood.R(2, 6, 7, 12, hatchPx(6, 12, false))
    hood.R(9, 4, 6, 4, grillePx(false))
    hood.grime(0.26)
    leds(ctx, hood.fx + 9, hood.fy + 12, 2, t, 0b10)
    const [hpx, hpy] = hood.at(0, 0)
    hopper(ctx, hpx, hpy + 1, 1, 10, 2, 6, W, REG)
  }
  // firing hood with the solar receiver aperture on its roof
  {
    const [fx, fy] = at(19, 4)
    const hood = box(ctx, fx, fy, 3, 8, 22, W, { seams: 4, roof: N })
    hood.L(0, 6, 1, 2, (c, r) => (r === 0 ? OR[3] : OR[2]))
    hood.R(0, 16, 1, 2, (c, r) => (r === 0 ? OR[2] : OR[1]))
    hood.R(3, 10, 5, 10, (c, r) => {
      const d = Math.hypot(c - 4.5, r - 4.5)
      return d > 4.6 ? null : d > 3.8 ? OR[1] : d > 3.1 ? FRAME : tone(HEAT, 1 - d * 0.16 + flick, c, r)
    })
    hood.R(12, 3, 4, 12, grillePx(false))
    hood.grime(0.25)
    leds(ctx, hood.fx + 3, hood.fy + 17, 3, t, 0b100)
    // receiver: a glowing aperture in a white collar
    const [kx, ky] = hood.at(0, 0)
    cyl(ctx, kx, ky + 1, 4, 3, W, N)
    dome(ctx, kx, ky - 2, 3, 1, 1, HEAT, false)
    rect(ctx, kx - 1, ky - 3, 2, 1, '#ffffff')
    // the concentrated beam from the dish into the receiver
    const n = Math.max(Math.abs(kx - dcx), Math.abs(ky - 3 - dcy))
    for (let k = 0; k <= n; k++) {
      const X = Math.round(dcx + ((kx - dcx) * k) / n)
      const Y = Math.round(dcy + ((ky - 3 - dcy) * k) / n)
      const on = (k + Math.floor(t * 8)) % 4
      if (on === 3) continue
      rect(ctx, X, Y, 1, 1, on === 0 ? '#ffffff' : '#fff3c4')
    }
    blink(ctx, hood.lx + 1, hood.top + 1, t)
    if (tier >= 3) lamp(ctx, hood.fx - 4, hood.fy + 3, '#ffffff', WARM[2])
  }

  // catwalk along the drum, railed, on posts, with a ladder down
  {
    const z = 5
    const [ax, ay] = at(-14, 13, z)
    const [bx, by] = at(13, 13, z)
    for (let k = 0; k <= 27; k += 9) {
      const [px, py] = at(-14 + k, 13)
      rect(ctx, px, py - z, 1, z, MH[2])
    }
    for (let k = 0; k <= 1; k++) line(ctx, ax, ay + k, bx, by + k, k ? MH[1] : N[3])
    rail(ctx, ax, ay, bx, by, 3)
    ladder(ctx, ax - 2, ay, ay + z)
  }

  // control cabin, front left
  {
    const [cx, cy] = at(-15, 15)
    const cab = box(ctx, cx, cy, 5, 5, 12, W, { seams: 5, roof: W })
    cab.L(0, 10, 1, 1, orangePx(true))
    cab.L(1, 8, 3, 4, warmPx(8, 4))
    cab.L(1, 6, 9, 1, stencilPx(0b110101))
    cab.R(2, 5, 3, 9, hatchPx(5, 9, false))
    cab.R(0, 10, 1, 1, orangePx(false))
    cab.grime(0.3)
    leds(ctx, cab.fx + 8, cab.fy + 4, 1, t, 0)
    if (tier >= 3) {
      // a small solar panel on the roof
      for (let k = 0; k < 8; k++)
        for (let j = 0; j < 4; j++) {
          const [px, py] = cab.at(-4 + k, -2 + j)
          rect(ctx, px, py - 2, 2, 1, (k + j) % 4 === 0 ? NV[4] : j === 0 || k % 3 === 2 ? NV[0] : NV[2])
        }
    }
    const [ax, ay] = cab.at(2, 2)
    rect(ctx, ax, ay - 8, 1, 8, N[3])
    rect(ctx, ax - 1, ay - 8, 3, 1, MH[3])
    blink(ctx, ax, ay - 10, t, 0.4)
  }

  // discharge chute and pallets of sintered bricks
  {
    const [cx, cy] = at(16, 13, 6)
    line(ctx, cx, cy, cx - 4, cy + 4, N[3])
    line(ctx, cx + 1, cy, cx - 3, cy + 4, MH[1])
    if (t > 0) rect(ctx, cx - 2 + (Math.floor(t * 8) % 3), cy + 2, 2, 1, BRICK[3])
    const pallets: [number, number][] = [
      [9, 19],
      [17, 19],
      [5, 12],
    ]
    for (const [s, r] of pallets.slice(0, tier === 1 ? 2 : 3)) {
      const [px, py] = at(s, r)
      box(ctx, px, py, 3, 3, 1, MH, { roof: N })
      const st = box(ctx, px, py - 1, 3, 3, 5, BRICK, { roof: BRICK })
      st.L(0, 6, 0, 5, (c, r) => (r % 2 === 1 || (c + (r >> 1) * 2) % 4 === 3 ? BRICK[1] : null))
      st.R(0, 6, 0, 5, (c, r) => (r % 2 === 1 || (c + (r >> 1) * 2) % 4 === 3 ? BRICK[0] : null))
    }
  }
}

/* --------------------------------- washer -------------------------------- */

/**
 * Soil washer: its signature is the big inflatable water reservoir at the
 * back, a soft white fabric dome held down by restraint straps and a ring of
 * regolith sandbags. A white ribbed pressure tank with a sight glass stands
 * beside it. In front, a perforated trommel with orange rib rings turns under
 * a misting spray bar, fed from a regolith hopper; a settling basin with a
 * pump, a vibrating sieve deck, and a conveyor carrying clean dark soil to a
 * heap complete the line.
 */
export function bigWasher(ctx: Ctx, x: number, y: number, t: number) {
  const tier = getTier()
  const g = plinth(ctx, x, y, 3, 3, 6)
  const at = deck(x, g)
  const spin = t * Math.PI * 0.5
  const wave = Math.floor(t * 4)

  // gold-foil heated water tank (level 2+), back left
  if (tier >= 2) {
    const [cx, cy] = at(-20, -20)
    cyl(ctx, cx, cy, 4, 22, GD, W)
    foil(ctx, cx, cy, 4, 1, 20)
    band(ctx, cx, cy, 4, 22, 1, W[1])
    cylDust(ctx, cx, cy, 4, 22)
    blink(ctx, cx, cy - 26, t, 0.6)
  }
  // white pressure tank with a sight glass, back left
  const [tx, ty] = at(-20, -10)
  {
    const TR = 6
    const TH = 30
    vessel(ctx, tx, ty, TR, TH, 6, 2)
    band(ctx, tx, ty, TR, TH - 3, 2, (dx) => (dx < -2 ? OR[3] : dx < 2 ? OR[2] : OR[1]))
    const gh = 16
    const lit = Math.round(gh * 0.7)
    wrap(ctx, tx, ty, TR, -TR + 1, 4, 6, gh + 2, (c, r) => {
      if (c === 0 || c === 3 || r === 0 || r === gh + 1) return FRAME
      const k = r - 1
      if (k >= lit) return '#20313a'
      if (k === lit - 1) return (c + wave) % 2 ? GLOW : CY[4]
      return tone(CY, 0.7 - (k / gh) * 0.3 + (c === 1 ? 0.1 : 0), c, k)
    })
    wrap(ctx, tx, ty, TR, 0, 5, 20, 3, stencilPx(0b11011))
    ladder(ctx, tx + 3, ty - TH + 4, ty + 1)
    cylDust(ctx, tx, ty, TR, TH, 0.2)
    blink(ctx, tx, ty - TH - 6, t)
  }
  // the inflatable reservoir, back right
  const [rx0, ry0] = at(6, -17)
  fabricDome(ctx, rx0, ry0, 15, 22, 7, 3, true)
  {
    // an orange-framed hatch at the hem, a stencilled number and a fill port on top
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 5; c++) {
        const v = hatchPx(5, 8)(c, r)
        if (v) rect(ctx, rx0 - 11 + c, ry0 - 6 + r + (c >> 1), 1, 1, v)
      }
    for (let c = 0; c < 9; c++) {
      const v = stencilPx(0b101110111)(c, 0) ?? stencilPx(0b101110111)(c, 2)
      if (v) rect(ctx, rx0 + 1 + c, ry0 - 12 + (c >> 2), 1, 1, v)
    }
    cyl(ctx, rx0 - 3, ry0 - 21, 2, 2, N, N)
    rect(ctx, rx0 - 3, ry0 - 27, 1, 4, N[3])
    leds(ctx, rx0 - 4, ry0 - 28, 2, t, 0b01)
  }
  // umbilical hoses: reservoir to tank and tank to the spray bar
  const [sbx0, sby0] = at(-12, 4, 23)
  const [sbx1, sby1] = at(9, 4, 23)
  pipe(ctx, rx0 - 14, ry0 + 1, tx + 6, ty - 4, N)
  pipe(ctx, tx + 5, ty - 12, sbx0 + 4, sby0 - 3, MH)

  // trommel supports
  for (const s of [-10, 6]) {
    const [px, py] = at(s, 4)
    const [lx, ly] = at(s, -2)
    const [rx, ry] = at(s, 10)
    line(ctx, px, py - 14, lx, ly, MH[1])
    line(ctx, px, py - 14, rx, ry, N[3])
    line(ctx, (px + rx) >> 1, ((py + ry) >> 1) - 7, (px + lx) >> 1, ((py + ly) >> 1) - 7, MH[2])
    rect(ctx, rx - 1, ry - 1, 3, 1, OR[3])
  }
  // the trommel: white collars, a perforated sieve shell, orange rib rings
  const [ox, oy] = at(0, 4, 13)
  const s0 = -15
  const s1 = 12
  drum(
    ctx,
    ox,
    oy,
    s0,
    s1,
    8,
    7,
    (s, a, v, X, Y) => {
      const rot = a + spin
      if (s < -10 || s > 9) return tone(W, v * 0.9, X, Y)
      if (Math.abs(s + 3) < 1 || Math.abs(s - 5) < 1 || Math.abs(s + 9) < 0.8) return tone(OR, v + 0.05, X, Y)
      const ka = Math.floor(((rot / (Math.PI * 2)) * 28 + 100) % 28)
      const hole = (Math.floor(s + 20) + ka) % 2 === 0 && ka % 2 === 0
      if (hole) return (ka + Math.floor(s) + wave) % 5 === 0 ? CY[3] : MURK[0]
      return tone(N, v * 0.85, X, Y)
    },
    (V, Z) => (Math.hypot(V / 8, Z / 7) > 0.7 ? W[1] : Math.hypot(V / 8, Z / 7) > 0.5 ? INK : SOIL[2]),
  )
  // spray bar with nozzles misting the sieve
  for (let k = 0; k < 2; k++) line(ctx, sbx0, sby0 + k, sbx1, sby1 + k, k ? MH[1] : N[3])
  for (let k = 0; k <= 4; k++) {
    const nx = Math.round(sbx0 + ((sbx1 - sbx0) * k) / 4)
    const ny = Math.round(sby0 + ((sby1 - sby0) * k) / 4)
    rect(ctx, nx, ny + 2, 1, 1, MH[0])
    if (t > 0) for (let j = 0; j < 3; j++) rect(ctx, nx - 1 + j, ny + 3 + ((wave + j + k) % 3), 1, 1, j === 1 ? '#ffffff' : ICE[2])
  }
  // regolith feed hopper at the back end
  {
    const [hx, hy] = at(-18, 4)
    hopper(ctx, hx, hy, 14, 26, 3, 7, W, REG)
    line(ctx, hx + 2, hy - 14, hx + 5, hy - 11, N[2])
  }

  // settling basin with a pump, front left
  {
    const [px, py] = at(-13, 14)
    const pond = box(ctx, px, py, 7, 6, 7, W, { seams: 4, roof: MURK })
    pond.L(0, 14, 1, 1, orangePx(true))
    pond.L(2, 9, 3, 1, stencilPx(0b101101101))
    pond.R(0, 12, 1, 1, orangePx(false))
    pond.R(2, 8, 3, 2, grillePx(false))
    pond.grime(0.4)
    for (let k = 0; k < 6; k++) {
      const [wx, wy] = pond.at(-5 + ((k * 5 + wave) % 11), -4 + ((k * 3) % 9))
      rect(ctx, wx, wy, 2, 1, k % 2 ? MURK[4] : MURK[3])
    }
    const [r0x, r0y] = pond.at(-7, 6)
    const [r1x, r1y] = pond.at(7, 6)
    rail(ctx, r0x, r0y, r1x, r1y, 3)
    if (tier >= 3) pond.L(1, 12, 5, 1, (c) => (c % 3 === 2 ? null : c % 3 ? CY[4] : GLOW)) // UV steriliser strip
    const [mx, my] = at(-3, 15)
    const pump = box(ctx, mx, my, 3, 3, 6, W, { roof: N })
    pump.L(0, 6, 1, 1, orangePx(true))
    pump.R(1, 4, 2, 2, grillePx(false))
    pump.grime(0.35)
    leds(ctx, pump.lx + 2, pump.top + 1, 2, t, 0b10)
    pipe(ctx, pump.fx, pump.top - 2, ox - 10, oy + 8, N)
    rect(ctx, pump.fx + 1, pump.top - 4, 2, 2, RED[0])
  }

  // clean-soil conveyor from the discharge end to a heap at the front
  {
    const [ax, ay] = at(15, 5, 6)
    const [bx, by] = at(15, 17, 3)
    for (let k = 0; k < 3; k++) line(ctx, ax, ay + k, bx, by + k, k === 0 ? N[3] : k === 1 ? MH[2] : MH[0])
    rect(ctx, ax, ay + 3, 1, 4, MH[2])
    for (let k = 0; k < 4; k++) {
      const f = (t * 0.5 + k / 4) % 1
      rect(ctx, Math.round(ax + (bx - ax) * f), Math.round(ay + (by - ay) * f) - 1, 2, 1, k % 2 ? SOIL[3] : SOIL[2])
    }
    const [hx, hy] = at(14, 20)
    dome(ctx, hx, hy, 7, tier >= 2 ? 6 : 5, 2, SOIL, false)
    for (let k = 0; k < 5; k++) rect(ctx, hx - 4 + ((k * 3) % 8), hy - 2 + ((k * 5) % 4), 1, 1, k % 2 ? SOIL[4] : SOIL[1])
    if (t > 0) rect(ctx, bx - 1, by + 2 + (wave % 3), 1, 1, SOIL[3])
  }
  // sieve deck: a sloped vibrating screen draining into a sump, right
  {
    const [sx, sy] = at(20, -3)
    const sump = box(ctx, sx, sy, 5, 5, 5, W, { roof: MURK })
    sump.L(0, 10, 1, 1, orangePx(true))
    sump.grime(0.4)
    const jig = t > 0 && (t * 8) % 2 < 1 ? 1 : 0
    for (let k = 0; k < 8; k++) line(ctx, sx - 7 + k * 2, sy - 13 + jig + (k >> 1), sx - 3 + k * 2, sy - 7 + jig + (k >> 1), k % 2 ? MH[1] : N[3])
    rect(ctx, sx + 6, sy - 10, 1, 6, MH[2])
    if (tier >= 2) lamp(ctx, sx + 7, sy - 12, tier >= 3 ? '#ffffff' : WARM[3], WARM[1])
  }
}
