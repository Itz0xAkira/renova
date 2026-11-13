/**
 * Power: solar (panel, array, station), pylons, battery banks and the fission
 * surface power unit, in the clean space-agency look: white composite panels,
 * light-grey structure, safety-orange and gold-foil accents, deep-blue cells,
 * small red/green status lamps, and red regolith dust on everything low.
 *
 * Each function draws one building on ground point (x, y), the centre of its
 * footprint. A w×h footprint spans ±(w+h)·8 px across and ±(w+h)·4 px down.
 * `t` is animation time; frame 0 (t = 0) doubles as the idle pose.
 *
 * Positions inside a footprint are given in iso pixels (p, q): p runs along the
 * footprint's w axis (screen right-down), q along its h axis (screen left-down),
 * z is height. A 2×2 footprint spans p, q ∈ [-16, 16]; a 3×3 one ±24.
 */
import { rect, type Ctx } from '@/site/pixel/engine'
import { band, cyl, dome, getTier, GLOW, hull, hullTop, INK, lamp, plinth, RAMP, stencilPx, tone, trefoil, type Ramp } from '@/game/art/pixel'
import { line, CY } from '@/game/art/buildings/kit'

/* ------------------------------ local kit ------------------------------- */

/** White composite panels. */
const WH = RAMP.hull
/** Off-white and neutral greys. */
const NT = RAMP.neutral
/** Light-grey structure. */
const LG = RAMP.metalHi
const OR = RAMP.orange
const AU = RAMP.gold
const NV = RAMP.navy
const DU = RAMP.regolith
const AL = RAMP.alert
const STONE = RAMP.stone
const LED_G = '#7ee07a'
const LED_G0 = '#2f6a3a'
const LED_R = '#ff5a4f'
const SKY = '#dbe7f4'
const STEN = '#3a3442'

type Px = (c: number, r: number) => string | null

/** Screen point of iso position (p, q) at height z above the base G. */
const iso = (X: number, G: number, p: number, q: number, z = 0) => [X + p - q, Math.round(G + (p + q) / 2 - z)] as const

/** A stable pseudo-random number in [0, 1) for a pixel. */
function hash(a: number, b: number, s = 0) {
  let n = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

const blink = (t: number, rate = 1.5, phase = 0) => (t * rate + phase) % 1 < 0.45
/** A red beacon with a soft halo. */
const beacon = (ctx: Ctx, x: number, y: number, t: number, phase = 0) => lamp(ctx, x, y, blink(t, 1.5, phase) ? LED_R : AL[0], AL[1])
/** A 1px status LED: green, or red when `red`. */
const led = (on: boolean, red = false) => (red ? (on ? LED_R : AL[0]) : on ? LED_G : LED_G0)

/** Pixel art from strings; '.' is transparent. */
function art(ctx: Ctx, x: number, y: number, rows: string[], pal: Record<string, string>) {
  rows.forEach((row, r) => [...row].forEach((ch, c) => pal[ch] && rect(ctx, x + c, y + r, 1, 1, pal[ch])))
}
/** A white plate with an orange high-voltage bolt. */
const PLATE = ['kkkkk', 'kwwok', 'kwoww', 'kooow', 'kwowk', 'kowwk', 'kkkkk']
const hvPlate = (ctx: Ctx, x: number, y: number) => art(ctx, x, y, PLATE, { k: LG[2], w: WH[4], o: OR[2] })

/** Regolith dust settling on a face's lower rows: none up top, thick at the foot. */
const dustPx =
  (hh: number, seed = 0, k = 0.55): Px =>
  (c, r) => {
    const f = (r + 1) / Math.max(1, hh)
    if (f < 0.5) return null
    const v = hash(c, r, seed)
    return v < ((f - 0.5) / 0.5) ** 1.5 * k ? (v < 0.25 * k ? DU[2] : DU[3]) : null
  }
/** Radiator fins: bright rails with shaded channels between. */
const finsPx =
  (lit: boolean): Px =>
  (c, r) =>
    r === 0 ? NT[4] : c % 2 ? (lit ? NT[2] : NT[1]) : lit ? NT[4] : NT[3]

/** A rectangular box: lit face on q = q1, shaded face on p = p1. Returns its roof's front corner. */
type Box = { fx: number; fy: number; a: number; b: number; h: number }
function box(ctx: Ctx, X: number, G: number, p0: number, p1: number, q0: number, q1: number, z: number, h: number, ramp: Ramp, o: { roof?: Ramp; seams?: number } = {}): Box {
  const a = p1 - p0
  const b = q1 - q0
  const fx = X + p1 - q1
  const fy = Math.round(G + (p1 + q1) / 2 - z - h)
  const roof = o.roof ?? ramp
  for (let c = 0; c < a; c++) {
    const xx = fx - a + c
    const yt = fy - ((a - 1 - c) >> 1)
    for (let r = 0; r <= h; r++) rect(ctx, xx, yt + r, 1, 1, tone(ramp, 0.74 - (0.22 * r) / Math.max(1, h) + (c > a - 3 ? 0.06 : 0), xx, yt + r))
    rect(ctx, xx, yt + h, 1, 1, ramp[0])
    if (o.seams && c > 0 && c % o.seams === 0) rect(ctx, xx, yt + 1, 1, h - 1, ramp[2])
  }
  for (let c = 0; c < b; c++) {
    const xx = fx + c
    const yt = fy - (c >> 1)
    for (let r = 0; r <= h; r++) rect(ctx, xx, yt + r, 1, 1, tone(ramp, 0.4 - (0.18 * r) / Math.max(1, h) - 0.12 * (c / b), xx, yt + r))
    rect(ctx, xx, yt + h, 1, 1, ramp[0])
    if (o.seams && c > 0 && c % o.seams === 0) rect(ctx, xx, yt + 1, 1, h - 1, ramp[1])
  }
  rect(ctx, fx - 1, fy, 1, h + 1, ramp[4])
  rect(ctx, fx, fy, 1, h + 1, ramp[1])
  const xl = fx - a
  const xr = fx + b
  const yL = fy - ((a - 1) >> 1)
  const yR = fy - ((b - 1) >> 1)
  for (let xx = xl; xx < xr; xx++) {
    const lo = xx < fx ? fy - ((fx - 1 - xx) >> 1) : fy - ((xx - fx) >> 1)
    const up = Math.min(lo, xx < xl + b ? yL - ((xx - xl) >> 1) : yR - ((xr - 1 - xx) >> 1))
    for (let yy = up; yy < lo; yy++) rect(ctx, xx, yy, 1, 1, tone(roof, 0.58 + 0.3 * ((lo - yy) / Math.max(1, (a + b) / 2)) - (xx >= fx ? 0.08 : 0), xx, yy))
    rect(ctx, xx, lo, 1, 1, xx < fx ? roof[4] : roof[2])
    rect(ctx, xx, up, 1, 1, roof[3])
  }
  return { fx, fy, a, b, h }
}
/** Paint on a box's lit face; c from its left corner, r down from the roof edge. */
function onL(ctx: Ctx, B: Box, c0: number, w: number, r0: number, hh: number, col: string | Px) {
  for (let c = Math.max(0, c0); c < Math.min(B.a, c0 + w); c++)
    for (let r = r0; r < r0 + hh; r++) {
      const v = typeof col === 'string' ? col : col(c - c0, r - r0)
      if (v) rect(ctx, B.fx - B.a + c, B.fy - ((B.a - 1 - c) >> 1) + r, 1, 1, v)
    }
}
/** Same on the shaded face; c from the front corner. */
function onR(ctx: Ctx, B: Box, c0: number, w: number, r0: number, hh: number, col: string | Px) {
  for (let c = Math.max(0, c0); c < Math.min(B.b, c0 + w); c++)
    for (let r = r0; r < r0 + hh; r++) {
      const v = typeof col === 'string' ? col : col(c - c0, r - r0)
      if (v) rect(ctx, B.fx + c, B.fy - (c >> 1) + r, 1, 1, v)
    }
}
/** Red dust on the lower part of both faces of a box. */
function dustBox(ctx: Ctx, B: Box, seed = 0, k = 0.55) {
  onL(ctx, B, 0, B.a, 0, B.h + 1, dustPx(B.h + 1, seed, k))
  onR(ctx, B, 0, B.b, 0, B.h + 1, dustPx(B.h + 1, seed + 5, k))
}

/** A cable run on the ground along p (or q): a light tray with a black cable, orange clamps and rare pulses of power. */
function tray(ctx: Ctx, X: number, G: number, p0: number, q0: number, p1: number, q1: number, z: number, t: number, live = true) {
  const n = Math.max(Math.abs(p1 - p0), Math.abs(q1 - q0))
  const alongP = Math.abs(p1 - p0) >= Math.abs(q1 - q0)
  for (let k = 0; k <= n; k++) {
    const p = p0 + ((p1 - p0) * k) / n
    const q = q0 + ((q1 - q0) * k) / n
    const [sx, sy] = iso(X, G, p, q, z)
    const ox = alongP ? -1 : 1
    rect(ctx, sx + ox, sy - 1, 1, 1, hash(k, p0 + q0, 3) < 0.3 ? DU[3] : NT[4])
    rect(ctx, sx, sy - 1, 1, 1, k % 4 === 0 ? OR[2] : INK)
    rect(ctx, sx - ox, sy - 1, 1, 1, NT[2])
    rect(ctx, sx, sy, 1, 1, NT[1])
    if (live && t > 0 && (k - Math.floor(t * 12)) % 11 === 0) rect(ctx, sx, sy - 1, 1, 1, GLOW)
  }
}

/** A white junction box with an orange lid, status lamps and a stencilled tag. (p, q) is its ground centre. */
function junction(ctx: Ctx, X: number, G: number, p: number, q: number, z: number, s: number, h: number, t: number, seed = 1) {
  const B = box(ctx, X, G, p - s, p + s, q - s, q + s, z, h, WH, { roof: NT })
  onL(ctx, B, 0, B.a, 0, 1, OR[3])
  onR(ctx, B, 0, B.b, 0, 1, OR[1])
  onL(ctx, B, 1, 1, 2, 1, led(blink(t, 2)))
  onL(ctx, B, 3, 1, 2, 1, led(false, true))
  onL(ctx, B, 1, B.a - 2, 4, 3, stencilPx(0b1011011 + seed))
  dustBox(ctx, B, seed)
  return B
}

/** A small orange-capped bollard. */
function bollard(ctx: Ctx, sx: number, sy: number, h = 5) {
  rect(ctx, sx, sy - h, 1, h, NT[4])
  rect(ctx, sx + 1, sy - h, 1, h, NT[2])
  rect(ctx, sx, sy - h, 2, 2, OR[3])
  rect(ctx, sx + 1, sy - h, 1, 2, OR[1])
  rect(ctx, sx, sy - 1, 2, 1, DU[3])
}

/** A sign on two light posts from legBase up to the panel at (x, y). */
function signPost(ctx: Ctx, x: number, y: number, w: number, h: number, legBase: number, face: (c: number, r: number) => string) {
  for (const lx of [x - Math.floor(w / 3), x + Math.floor(w / 3)])
    for (let k = y + h; k <= legBase; k++) {
      rect(ctx, lx, k, 1, 1, k > legBase - 2 ? DU[3] : NT[4])
      rect(ctx, lx + 1, k, 1, 1, LG[2])
    }
  const x0 = x - (w >> 1)
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) rect(ctx, x0 + c, y + r, 1, 1, c === 0 || r === 0 || c === w - 1 || r === h - 1 ? (r === h - 1 || c === w - 1 ? LG[2] : NT[4]) : face(c - 1, r - 1))
}

/* --------------------------- tilted flat planes -------------------------- */

type V3 = readonly [number, number, number]
type AB = (sx: number, sy: number) => readonly [number, number]
type Shade = (a: number, b: number, edge: boolean, sx: number, sy: number, ab: AB) => string | null

/**
 * A flat plate through centre C spanned by axes e1, e2 (in p, q, z), filled
 * screen pixel by screen pixel so its pattern stays crisp. `inside(a, b)` cuts
 * its outline; `shade` colours it; `rim` gives the thickness under its lower edge.
 */
function plane(ctx: Ctx, X: number, G: number, C: V3, e1: V3, e2: V3, ext: number, inside: (a: number, b: number) => boolean, shade: Shade, rim: readonly string[] = [NT[1], LG[0]]) {
  const m11 = e1[0] - e1[1]
  const m12 = e2[0] - e2[1]
  const m21 = (e1[0] + e1[1]) / 2 - e1[2]
  const m22 = (e2[0] + e2[1]) / 2 - e2[2]
  const det = m11 * m22 - m12 * m21
  const cx = X + C[0] - C[1]
  const cy = G + (C[0] + C[1]) / 2 - C[2]
  const ab: AB = (sx, sy) => {
    const dx = sx + 0.5 - cx
    const dy = sy + 0.5 - cy
    return [(dx * m22 - m12 * dy) / det, (m11 * dy - m21 * dx) / det]
  }
  const ins = (sx: number, sy: number) => {
    const [a, b] = ab(sx, sy)
    return inside(a, b)
  }
  const rx = Math.ceil(ext * (Math.abs(m11) + Math.abs(m12))) + 1
  const ry = Math.ceil(ext * (Math.abs(m21) + Math.abs(m22))) + 1
  for (let sy = Math.floor(cy - ry); sy <= cy + ry + rim.length; sy++)
    for (let sx = Math.floor(cx - rx); sx <= cx + rx; sx++) {
      if (!ins(sx, sy)) {
        for (let k = 0; k < rim.length; k++)
          if (ins(sx, sy - 1 - k)) {
            rect(ctx, sx, sy, 1, 1, rim[k])
            break
          }
        continue
      }
      const [a, b] = ab(sx, sy)
      const edge = !ins(sx - 1, sy) || !ins(sx + 1, sy) || !ins(sx, sy - 1) || !ins(sx, sy + 1)
      const c = shade(a, b, edge, sx, sy, ab)
      if (c) rect(ctx, sx, sy, 1, 1, c)
    }
}

type Cells = {
  a0: number
  a1: number
  b0: number
  b1: number
  cols: number
  rows: number
  glint: number
  /** Edge colours: the a0 side, a1 side, b0 (top) side, b1 (low) side. */
  frame: readonly [string, string, string, string]
  /** Dust density (0–1) at (a, b). */
  dust?: (a: number, b: number) => number
  /** Every n-th row line is a wider gap in this colour (blanket strings). */
  gap?: [number, string]
  /** Paint over the cells first (shadows, brushes). */
  over?: (a: number, b: number) => string | null
}

/** Deep-blue photovoltaic cells with a fine grid, a sweeping sky glint and settling dust. */
function cells(o: Cells): Shade {
  const ci = (a: number) => Math.floor(((a - o.a0) / (o.a1 - o.a0)) * o.cols)
  const ri = (b: number) => Math.floor(((b - o.b0) / (o.b1 - o.b0)) * o.rows)
  return (a, b, edge, sx, sy, ab) => {
    if (edge) {
      const d = [a - o.a0, o.a1 - a, b - o.b0, o.b1 - b]
      const k = d.indexOf(Math.min(...d))
      if (k === 3 && hash(sx, sy, 7) < 0.45) return DU[3]
      return o.frame[k]
    }
    const ov = o.over?.(a, b)
    if (ov) return ov
    const i = ci(a)
    const j = ri(b)
    const gv = ci(ab(sx + 1, sy)[0]) !== i
    const gh = ri(ab(sx, sy + 1)[1]) !== j
    const s = (a - o.a0) / (o.a1 - o.a0)
    const r = (b - o.b0) / (o.b1 - o.b0)
    let c: string
    if (gh && o.gap && (j + 1) % o.gap[0] === 0) c = o.gap[1]
    else if (gv || gh) c = NV[3]
    else {
      const v = 0.3 + 0.22 * (1 - r) + (((i * 7 + j * 3) % 5) - 2) * 0.03
      const top = ri(ab(sx, sy - 1)[1]) !== j
      c = NV[Math.max(0, Math.min(4, Math.floor(v * 4) + (top ? 1 : 0)))]
      if (o.dust && hash(sx, sy, 3) < o.dust(a, b)) c = hash(sx, sy, 4) < 0.5 ? DU[2] : DU[3]
    }
    // sky glint: a soft diagonal band with a bright core
    const g = Math.abs(s * 0.7 + r - o.glint)
    if (g < 0.035) c = c === NV[3] ? NV[4] : SKY
    else if (g < 0.1) c = c === NV[3] ? NV[4] : NV[3]
    return c
  }
}

/** A short light-grey post from the ground at (p, q) up to height `top`. */
function post(ctx: Ctx, X: number, G: number, p: number, q: number, top: number) {
  const [sx, sy] = iso(X, G, p, q)
  rect(ctx, sx, sy - top, 1, top + 1, NT[3])
  rect(ctx, sx + 1, sy - top, 1, top + 1, LG[1])
  rect(ctx, sx - 1, sy, 4, 1, STONE[1])
  rect(ctx, sx, sy - 1, 2, 1, DU[3])
}

/* -------------------------------- solar --------------------------------- */

/**
 * Level 1: one large fixed-tilt panel on posts. Its memorable part is the
 * cleaning robot: a brush gantry riding the panel's top and bottom rails,
 * sweeping the red dust off the cells as it crosses (parked clean at rest).
 */
function solarPanel1(ctx: Ctx, X: number, G: number, t: number, glint: number) {
  const pc = -1
  const qc = -3
  const [a0, a1, b0, b1] = [-13, 13, -9, 9]
  const zc = 12
  const k = 0.7
  const zAt = (b: number) => zc - k * b
  // posts and braces under the panel
  const ps = [-12, -1, 10]
  for (const p of ps) post(ctx, X, G, p, qc - 7, Math.round(zAt(-7)))
  for (const p of ps) post(ctx, X, G, p, qc + 7, Math.round(zAt(7)))
  for (let i = 0; i + 1 < ps.length; i++) {
    const [ax, ay] = iso(X, G, ps[i], qc + 7)
    const [bx, by] = iso(X, G, ps[i + 1], qc + 7)
    const h = Math.round(zAt(7))
    line(ctx, ax + 1, ay - 1, bx, by - h + 1, LG[2])
    line(ctx, ax + 1, ay - h + 1, bx, by - 1, LG[1])
  }
  // the brush crosses during the cycle and rests at the a1 end
  const aB = t === 0 ? a1 - 1.5 : a0 + 1.5 + (a1 - a0 - 3) * (t / 2)
  plane(
    ctx,
    X,
    G,
    [pc, qc, zc],
    [1, 0, 0],
    [0, 1, -k],
    13,
    (a, b) => a >= a0 && a < a1 && b >= b0 && b < b1,
    cells({
      a0,
      a1,
      b0,
      b1,
      cols: 8,
      rows: 5,
      glint,
      frame: [NT[4], NT[2], NT[3], NT[1]],
      dust: (a, b) => (a > aB ? 0.05 + 0.25 * ((b - b0) / (b1 - b0)) ** 3 : 0.015 * ((b - b0) / (b1 - b0))),
      over: (a) => (a > aB && a < aB + 1.8 ? NV[0] : null),
    }),
  )
  // the brush gantry, lifted off the glass, with orange trucks on the rails
  const [gx0, gy0] = iso(X, G, pc + aB, qc + b0, zAt(b0) + 2)
  const [gx1, gy1] = iso(X, G, pc + aB, qc + b1 - 1, zAt(b1 - 1) + 2)
  line(ctx, gx0, gy0, gx1, gy1, NT[4])
  line(ctx, gx0 + 1, gy0 + 1, gx1 + 1, gy1 + 1, LG[2])
  line(ctx, gx0, gy0 + 2, gx1, gy1 + 2, AU[2])
  for (const [tx, ty] of [
    [gx0, gy0],
    [gx1, gy1],
  ]) {
    rect(ctx, tx - 1, ty - 1, 3, 3, OR[2])
    rect(ctx, tx - 1, ty - 1, 3, 1, OR[4])
  }
  rect(ctx, gx1 + 1, gy1 - 2, 1, 1, led(blink(t, 2)))
  // cable from the panel's low corner down to the tray
  const [cx0, cy0] = iso(X, G, pc + a1 - 2, qc + b1, zAt(b1) - 1)
  const [cx1, cy1] = iso(X, G, pc + a1 - 2, 11)
  line(ctx, cx0, cy0, cx1, cy1 - 1, INK)
  tray(ctx, X, G, -12, 11, 6, 11, 0, t)
  junction(ctx, X, G, 11, 11, 0, 3, 7, t)
  const [sx, sy] = iso(X, G, -13, 13)
  rect(ctx, sx + 2, sy - 6, 1, 6, LG[3])
  hvPlate(ctx, sx, sy - 12)
}

/**
 * Level 2: two flexible solar blankets rolled out either side of a white
 * deployment drum, edged in gold Kapton and held flat by leading-edge rollers.
 */
function solarArray2(ctx: Ctx, X: number, G: number, t: number, glint: number) {
  const k = 0.2
  const wing = (pc: number, gl: number) => {
    const [a0, a1, b0, b1] = [-6.5, 6.5, -10.5, 10.5]
    // low stands under the blanket corners
    for (const [da, db] of [
      [a0 + 1, b0 + 1],
      [a1 - 1, b0 + 1],
      [a0 + 1, b1 - 1],
      [a1 - 1, b1 - 1],
    ])
      post(ctx, X, G, pc + da, -1.5 + db, Math.round(5 - k * db))
    plane(
      ctx,
      X,
      G,
      [pc, -1.5, 5],
      [1, 0, 0],
      [0, 1, -k],
      11,
      (a, b) => a >= a0 && a < a1 && b >= b0 && b < b1,
      cells({ a0, a1, b0, b1, cols: 5, rows: 9, glint: gl, frame: [AU[4], AU[2], AU[3], AU[1]], gap: [3, AU[2]], dust: (_, b) => 0.03 + 0.2 * ((b - b0) / (b1 - b0)) ** 4 }),
      [LG[1]],
    )
  }
  /** The leading-edge roller across the outer end of a blanket. */
  const roller = (p: number, lit: boolean) => {
    const [x0, y0] = iso(X, G, p, -12, 5 + k * 10.5 + 1)
    const [x1, y1] = iso(X, G, p, 9, 5 - k * 10.5 + 1)
    line(ctx, x0, y0, x1, y1, lit ? NT[4] : NT[3])
    line(ctx, x0, y0 + 1, x1, y1 + 1, lit ? LG[2] : LG[1])
    rect(ctx, x0 - 1, y0 - 1, 2, 3, AU[3])
    rect(ctx, x1 - 1, y1 - 1, 2, 3, AU[2])
  }
  wing(-8.5, glint)
  roller(-15, true)
  // the deployment drum: a long white housing with orange end caps and slot seams
  const D = box(ctx, X, G, -2, 2, -13, 10, 0, 7, WH, { roof: NT })
  onL(ctx, D, 0, D.a, 0, D.h, (_, r) => (r === 0 ? OR[4] : OR[2]))
  onL(ctx, D, 1, 1, 2, 1, led(blink(t, 2)))
  onR(ctx, D, 0, D.b, 0, 1, OR[1])
  onR(ctx, D, 0, D.b, 3, 1, LG[1])
  onR(ctx, D, 3, 12, 1, 1, stencilPx(0b110101101101))
  onR(ctx, D, D.b - 3, 1, 1, 1, led(!blink(t, 2, 0.3), true))
  onR(ctx, D, 0, D.b, 0, D.h + 1, dustPx(D.h + 1, 4))
  {
    const [rx, ry] = iso(X, G, 0, -11, 7)
    rect(ctx, rx - 1, ry - 2, 3, 2, LG[3])
    rect(ctx, rx - 1, ry - 2, 3, 1, NT[4])
  }
  wing(8.5, glint - 0.12)
  roller(15, false)
  tray(ctx, X, G, -14, 13, 8, 13, 0, t)
  junction(ctx, X, G, 12, 13, 0, 3, 7, t, 2)
  const [sx, sy] = iso(X, G, -11, 15)
  rect(ctx, sx + 2, sy - 6, 1, 6, LG[3])
  hvPlate(ctx, sx, sy - 12)
}

/**
 * A circular fan-fold wing on a gimballed mast: ten gores of cells between
 * white ribs round a gold hub, tilted at the sun and slowly tracking it.
 */
function fanWing(ctx: Ctx, X: number, G: number, pc: number, qc: number, zc: number, R: number, tilt: number, yaw: number, glint: number) {
  const [mx, my] = iso(X, G, pc, qc)
  rect(ctx, mx - 2, my - 1, 5, 2, STONE[3])
  rect(ctx, mx - 2, my + 1, 5, 1, STONE[1])
  rect(ctx, mx - 1, my - zc, 1, zc, NT[4])
  rect(ctx, mx, my - zc, 1, zc, LG[1])
  rect(ctx, mx - 1, my - 2, 2, 1, DU[3])
  const ct = Math.cos(tilt)
  const st = Math.sin(tilt)
  const cyw = Math.cos(yaw)
  const syw = Math.sin(yaw)
  const n = 10
  const seg = (Math.PI * 2) / n
  const polar = (a: number, b: number) => {
    const r = Math.hypot(a, b)
    const ang = Math.atan2(b, a) + Math.PI * 2
    const d = ang % seg
    return [r, d] as const
  }
  const inside = (a: number, b: number) => {
    const [r, d] = polar(a, b)
    return r <= (R * Math.cos(seg / 2)) / Math.cos(d - seg / 2)
  }
  const ring = (a: number, b: number) => Math.floor(Math.hypot(a, b) / 2.3)
  plane(ctx, X, G, [pc, qc, zc], [cyw, syw, 0], [-syw * ct, cyw * ct, -st], R + 1, inside, (a, b, edge, sx, sy, ab) => {
    const [r, d] = polar(a, b)
    if (edge) return b > R * 0.4 && hash(sx, sy, 9) < 0.4 ? DU[3] : -0.6 * a - 0.8 * b > 0 ? NT[4] : NT[2]
    if (r < 1) return AU[3]
    if (r < 2) return WH[4]
    if (r * Math.sin(Math.min(d, seg - d)) < 0.55) return b > 0 ? NT[2] : NT[3]
    const k = ring(a, b)
    let c: string = k !== ring(...ab(sx + 1, sy)) || k !== ring(...ab(sx, sy + 1)) ? NV[3] : k !== ring(...ab(sx, sy - 1)) ? NV[2] : NV[1]
    const g = Math.abs((a / R) * 0.35 + (b / R) * 0.5 + 0.5 - glint)
    if (g < 0.035) c = c === NV[3] ? NV[4] : SKY
    else if (g < 0.1) c = c === NV[3] ? NV[4] : NV[3]
    return c
  })
  // gimbal head over the mast top
  const [hx, hy] = iso(X, G, pc, qc, zc)
  rect(ctx, hx - 1, hy - 1, 2, 2, AU[3])
}

/**
 * Level 3: three fan-fold wings round a white power-conditioning hut with a
 * gold-foil roof, a radiator and a comms mast.
 */
function solarStation3(ctx: Ctx, X: number, G: number, t: number, glint: number) {
  const yaw = 0.18 * Math.sin(t * Math.PI)
  tray(ctx, X, G, -3, -1, 8, -1, 0, t)
  tray(ctx, X, G, -1, -3, -1, 8, 0, t)
  const H = box(ctx, X, G, -15, -4, -15, -4, 0, 13, WH, { roof: AU })
  onL(ctx, H, 0, H.a, 1, 2, (_, r) => (r ? OR[2] : OR[3]))
  onL(ctx, H, 1, 5, 5, 4, (c, r) => (c === 0 || r === 0 || c === 4 || r === 3 ? INK : c + r === 3 ? GLOW : r === 1 ? CY[4] : CY[2]))
  onL(ctx, H, 7, 1, 5, 1, led(blink(t, 2)))
  onL(ctx, H, 9, 1, 5, 1, led(blink(t, 1.5, 0.5), true))
  onL(ctx, H, 1, 9, 10, 3, stencilPx(0b1101101011))
  onR(ctx, H, 0, H.b, 1, 1, OR[1])
  onR(ctx, H, 1, H.b - 2, 3, 8, finsPx(false))
  dustBox(ctx, H, 6)
  {
    // roof radiator plate and comms mast with a dish and a beacon
    for (let p = -14; p <= -8; p++) {
      const [sx, sy] = iso(X, G, p, -13, 13)
      rect(ctx, sx, sy - 6, 1, 6, p % 2 ? NT[4] : NT[3])
      rect(ctx, sx, sy - 7, 1, 1, LG[4])
    }
    const [rx, ry] = iso(X, G, -7, -9, 13)
    rect(ctx, rx, ry - 17, 1, 17, NT[4])
    rect(ctx, rx + 1, ry - 17, 1, 17, LG[1])
    for (let k = 4; k < 17; k += 4) rect(ctx, rx - 1, ry - k, 3, 1, LG[3])
    dome(ctx, rx - 3, ry - 11, 3, 2, 1, WH, false)
    rect(ctx, rx - 4, ry - 12, 1, 1, AU[3])
    beacon(ctx, rx, ry - 19, t)
  }
  fanWing(ctx, X, G, -5, 9, 14, 7, 0.85, yaw, glint)
  fanWing(ctx, X, G, 9, -5, 14, 7, 0.85, yaw, glint - 0.08)
  fanWing(ctx, X, G, 9, 9, 12, 7, 0.85, yaw, glint + 0.08)
}

/**
 * Solar, by level, on a 2×2 footprint:
 * 1, solar panel: a fixed-tilt panel swept clean by a brush robot;
 * 2, solar array: flexible blankets rolled out from a central drum;
 * 3, solar station: fan-fold wings round a power hut.
 */
export function solarArray(ctx: Ctx, x: number, y: number, t: number, tier = 1) {
  const G = plinth(ctx, x, y, 2, 2, 4)
  const glint = -0.3 + ((0.75 + t * 0.8) % 1.6)
  if (tier === 1) return solarPanel1(ctx, x, G, t, glint)
  if (tier === 2) return solarArray2(ctx, x, G, t, glint)
  solarStation3(ctx, x, G, t, glint)
}

/* -------------------------------- pylon --------------------------------- */

/** Height above the ground where a pylon's cables attach, by level (the scene draws them at y − 1 − PYLON_TOP). */
export const PYLON_TOP = [30, 38, 46]

/** A string of white ceramic insulator discs hanging from (x, y), n discs long. */
function insulator(ctx: Ctx, x: number, y: number, n: number) {
  rect(ctx, x, y, 1, 1, LG[3])
  for (let k = 0; k < n; k++) {
    rect(ctx, x - 1, y + 1 + k * 2, 3, 1, WH[4])
    rect(ctx, x - 1, y + 2 + k * 2, 3, 1, WH[1])
  }
  rect(ctx, x, y + 1 + n * 2, 1, 1, OR[2])
}

/** An upright ceramic stack under the cable saddle at (x, ya). */
function capInsulator(ctx: Ctx, x: number, ya: number) {
  rect(ctx, x - 2, ya, 5, 1, LG[4])
  rect(ctx, x - 1, ya - 1, 3, 1, OR[3])
  for (let k = 0; k < 3; k++) {
    rect(ctx, x - 2, ya + 1 + k * 2, 5, 1, k ? WH[3] : WH[4])
    rect(ctx, x - 1, ya + 2 + k * 2, 3, 1, WH[1])
  }
}

/** A cross-arm at height ay, half-span s, with hanging insulators at both ends. */
function crossArm(ctx: Ctx, x: number, ay: number, s: number, n: number) {
  rect(ctx, x - s, ay, s * 2 + 1, 1, NT[4])
  rect(ctx, x - s, ay + 1, s * 2 + 1, 1, LG[2])
  line(ctx, x - s + 2, ay + 1, x - 2, ay + 4, LG[3])
  line(ctx, x + s - 2, ay + 1, x + 2, ay + 4, LG[1])
  insulator(ctx, x - s, ay + 2, n)
  insulator(ctx, x + s, ay + 2, n)
}

/** A coilable lattice mast: three longerons, batten frames and diagonal tension cables, from base up to top. */
function latticeMast(ctx: Ctx, x: number, base: number, top: number) {
  const H = base - top
  // the far side of the lattice shows through as mid grey, so the mast reads solid but open
  rect(ctx, x - 3, top, 6, H + 1, LG[2])
  rect(ctx, x + 1, top, 2, H + 1, LG[1])
  for (let k = 0; k + 6 <= H; k += 6) {
    line(ctx, x - 3, base - k - 1, x + 2, base - k - 6, NT[3])
    line(ctx, x + 2, base - k - 1, x - 3, base - k - 6, LG[3])
  }
  for (let k = 0; k <= H; k++) {
    const yy = base - k
    rect(ctx, x - 4, yy, 1, 1, WH[4])
    rect(ctx, x, yy, 1, 1, k % 6 === 3 ? WH[4] : WH[3])
    rect(ctx, x + 3, yy, 1, 1, LG[2])
    if (k % 6 === 0) {
      rect(ctx, x - 4, yy, 8, 1, NT[3])
      rect(ctx, x + 1, yy, 3, 1, LG[3])
    }
  }
}

/**
 * Power pylon, 1×1:
 * 1, a guyed telescoping mast with orange-and-white aviation bands;
 * 2, a coilable lattice mast sprung from its white deployment canister;
 * 3, the same mast over a gold-foiled transformer with radiator fins and bushings.
 */
export function pylon(ctx: Ctx, x: number, y: number, t: number, tier = 1) {
  const ya = y - 1 - PYLON_TOP[tier - 1]
  if (tier === 1) {
    hull(ctx, x, hullTop(y + 1, 7, 2), 7, 2, STONE, { roof: STONE })
    const gy = ya + 11
    const stake = (sx: number, sy: number) => {
      rect(ctx, sx - 1, sy - 2, 2, 2, OR[2])
      rect(ctx, sx - 1, sy - 2, 1, 1, OR[4])
      rect(ctx, sx - 1, sy, 3, 1, DU[3])
    }
    // back guy first, behind the mast
    line(ctx, x, gy, x + 4, y - 7, NT[2])
    stake(x + 4, y - 6)
    // telescoping sections, widest at the foot, with grey collars
    const sec: [number, number, string[]][] = [
      [y - 1, y - 12, [WH[4], WH[3], WH[2], WH[1]]],
      [y - 12, y - 22, [WH[4], WH[2], WH[1]]],
      [y - 22, ya + 1, [WH[4], WH[1]]],
    ]
    for (const [b, tp, cols] of sec) {
      const x0 = x - (cols.length >> 1)
      for (let yy = tp; yy <= b; yy++) cols.forEach((c, i) => rect(ctx, x0 + i, yy, 1, 1, c))
      rect(ctx, x0 - 1, tp, cols.length + 2, 1, NT[4])
      rect(ctx, x0 - 1, tp + 1, cols.length + 2, 1, LG[2])
    }
    // orange aviation bands on the middle section
    for (const by of [y - 20, y - 16]) {
      rect(ctx, x - 1, by, 1, 2, OR[3])
      rect(ctx, x, by, 1, 2, OR[2])
      rect(ctx, x + 1, by, 1, 2, OR[1])
    }
    // dust on the foot and a base flange
    rect(ctx, x - 3, y - 2, 6, 2, LG[3])
    rect(ctx, x - 3, y - 2, 6, 1, NT[4])
    for (let k = 0; k < 6; k++) if (hash(k, 3) < 0.6) rect(ctx, x - 2 + (k % 4), y - 3 - (k >> 1), 1, 1, DU[3])
    // meter box with a status lamp and a tag
    rect(ctx, x + 2, y - 10, 4, 6, WH[2])
    rect(ctx, x + 2, y - 10, 4, 1, OR[3])
    rect(ctx, x + 5, y - 9, 1, 5, WH[1])
    rect(ctx, x + 3, y - 8, 1, 1, led(blink(t, 2)))
    rect(ctx, x + 2, y - 5, 3, 1, DU[3])
    crossArm(ctx, x, ya + 7, 6, 1)
    capInsulator(ctx, x, ya)
    rect(ctx, x + 2, ya + 3, 3, 1, LG[3])
    beacon(ctx, x + 5, ya + 2, t)
    // front guys over everything, to orange-capped stakes
    line(ctx, x - 1, gy, x - 12, y + 3, NT[3])
    stake(x - 12, y + 4)
    line(ctx, x + 1, gy, x + 11, y + 2, NT[2])
    stake(x + 11, y + 3)
    return
  }
  const base = tier === 3 ? y - 4 : y - 1
  if (tier === 3) hull(ctx, x, hullTop(y + 2, 14, 3), 14, 3, STONE, { roof: STONE })
  else hull(ctx, x, hullTop(y + 1, 9, 2), 9, 2, STONE, { roof: STONE })
  // deployment canister: a white drum with an orange band, the mast springing out of it
  const can = 7
  cyl(ctx, x, base, 6, can, WH, NT)
  band(ctx, x, base, 6, can - 2, 1, OR[2])
  band(ctx, x, base, 6, 1, 1, (dx) => (hash(dx, base) < 0.6 ? DU[3] : WH[1]))
  rect(ctx, x - 3, base - 3, 4, 1, STEN)
  rect(ctx, x + 2, base - 4, 1, 1, led(blink(t, 2)))
  const top = ya + 5
  latticeMast(ctx, x, base - can - 2, top)
  // top plate, cross-arms and the cable saddle
  rect(ctx, x - 5, top - 1, 11, 2, WH[4])
  rect(ctx, x - 5, top, 11, 1, LG[2])
  crossArm(ctx, x, ya + 8, 7, 1)
  crossArm(ctx, x, ya + 16, 6, 1)
  capInsulator(ctx, x, ya)
  rect(ctx, x + 3, ya + 2, 3, 1, LG[3])
  beacon(ctx, x + 5, ya + 1, t)
  // a white high-voltage plate on the mast
  hvPlate(ctx, x - 2, base - can - 12)
  if (tier === 3) {
    // transformer: white, gold-foil roof, radiator fins on the shade side, ceramic bushings
    const tt = hullTop(y - 1, 8, 10)
    hull(ctx, x - 7, tt, 8, 10, WH, { roof: AU })
    for (let c = 1; c < 8; c += 2) rect(ctx, x - 7 + c, tt + 8 - (c >> 1), 1, 8, NT[1])
    for (let c = 0; c < 8; c++) {
      rect(ctx, x - 15 + c, tt + 4 + (c >> 1), 1, 1, OR[3])
      rect(ctx, x - 15 + c, tt + 5 + (c >> 1), 1, 1, OR[2])
    }
    rect(ctx, x - 13, tt + 8, 1, 1, led(blink(t, 2)))
    rect(ctx, x - 11, tt + 9, 1, 1, led(blink(t, 1.5, 0.5), true))
    for (let c = 0; c < 6; c++) rect(ctx, x - 14 + c, tt + 11 + (c >> 1), 1, 1, STEN)
    for (let c = 0; c < 8; c++) for (let r = 0; r < 3; r++) if (hash(c, r, 21) < 0.2 + r * 0.25) rect(ctx, x - 15 + c, tt + 15 + (c >> 1) + r, 1, 1, DU[3])
    for (const bx of [-10, -7, -4]) {
      rect(ctx, x + bx, tt - 3, 1, 5, WH[4])
      rect(ctx, x + bx - 1, tt - 2, 3, 1, WH[2])
      rect(ctx, x + bx - 1, tt, 3, 1, WH[2])
      rect(ctx, x + bx, tt - 4, 1, 1, bx === -7 && blink(t, 1) ? GLOW : LG[4])
    }
    // keep-out bollards at the front
    bollard(ctx, x + 6, y + 6)
    bollard(ctx, x + 11, y + 3)
  }
}

/* ------------------------------- battery -------------------------------- */

/** A segmented charge bar on a box's lit face: n segments, `lit` of them on. */
function chargeBar(ctx: Ctx, B: Box, c: number, r: number, n: number, lit: number) {
  onL(ctx, B, c, 2, r - 1, n * 2 + 1, INK)
  for (let k = 0; k < n; k++) {
    const on = k < lit
    const col = on ? (k === lit - 1 ? GLOW : CY[3]) : CY[0]
    onL(ctx, B, c, 2, r + (n - 1 - k) * 2, 1, col)
  }
}

/**
 * Battery bank, 2×2: a white thermal-controlled cabinet with a gold-foil roof,
 * three module doors with charge bars, and its memorable part: a bank of
 * spacecraft thermal louvres on the shaded side that open and close as the
 * cells heat up and cool. Level 2 adds a roof radiator and a chiller; level 3
 * adds the regenerative fuel cell's hydrogen and oxygen tanks and a beacon mast.
 */
export function battery(ctx: Ctx, x: number, y: number, t: number) {
  const tier = getTier()
  const G = plinth(ctx, x, y, 2, 2, 5)
  const frame = Math.round(t * 4) % 8
  const B = box(ctx, x, G, -14, 8, -14, 6, 0, 18, WH, { roof: AU })
  // lit face: orange band, three module doors with charge bars and lamps
  onL(ctx, B, 0, B.a, 1, 2, (_, r) => (r ? OR[2] : OR[3]))
  for (let k = 0; k < 3; k++) {
    const c0 = 1 + k * 7
    onL(ctx, B, c0, 6, 4, 12, (c, r) => (c === 0 || r === 0 ? WH[4] : c === 5 || r === 11 ? WH[1] : null))
    const lit = t === 0 ? 2 + k : ((frame + k * 2) % 5) + 1
    chargeBar(ctx, B, c0 + 1, 6, 4, lit)
    onL(ctx, B, c0 + 4, 1, 6, 1, led(t === 0 || blink(t, 2, k * 0.3), k === 2 && tier === 1))
    onL(ctx, B, c0 + 3, 2, 8, 3, stencilPx(0b101101 + k))
    onL(ctx, B, c0 + 3, 2, 13, 1, LG[2])
  }
  onL(ctx, B, 0, B.a, 0, B.h + 1, dustPx(B.h + 1, 2))
  // shaded face: thermal louvres in a frame; slats turn through closed, half and open
  const stage = [1, 1, 2, 2, 1, 1, 0, 0][frame]
  onR(ctx, B, 0, B.b, 1, 1, OR[1])
  onR(ctx, B, 2, 16, 3, 13, (c, r) => {
    if (c === 0 || c === 15 || r === 0 || r === 12) return LG[2]
    const top = (r - 1) % 2 === 0
    if (stage === 0) return top ? NT[3] : NT[2]
    if (stage === 1) return top ? NT[4] : LG[1]
    return top ? NT[4] : '#1d2028'
  })
  onR(ctx, B, 0, B.b, 0, B.h + 1, dustPx(B.h + 1, 9))
  // roof terminals and a busbar
  const [px, py] = iso(x, G, 3, 1, 18)
  const [nx, ny] = iso(x, G, -7, 3, 18)
  line(ctx, nx, ny - 3, px, py - 3, blink(t, 2) && t > 0 ? GLOW : NT[4])
  cyl(ctx, px, py, 2, 3, OR, OR)
  cyl(ctx, nx, ny, 2, 3, LG, LG)
  rect(ctx, px, py - 6, 1, 2, OR[4])
  rect(ctx, nx - 1, ny - 5, 2, 1, NT[4])
  if (tier >= 2) {
    // an upright radiator plate on the roof and a chiller on the right
    for (let p = -12; p <= 4; p++) {
      const [sx, sy] = iso(x, G, p, -11, 18)
      rect(ctx, sx, sy - 8, 1, 8, p % 2 ? NT[4] : NT[3])
      rect(ctx, sx, sy - 9, 1, 1, LG[4])
      rect(ctx, sx, sy - 1, 1, 1, LG[2])
    }
    const C = box(ctx, x, G, 9, 15, -12, 2, 0, 7, WH, { roof: NT })
    onR(ctx, C, 1, C.b - 2, 1, 5, finsPx(false))
    onL(ctx, C, 0, C.a, 0, 1, OR[3])
    onL(ctx, C, 1, 1, 2, 1, led(blink(t, 2, 0.5)))
    dustBox(ctx, C, 13)
  }
  if (tier >= 3) {
    // regenerative fuel cell tanks: hydrogen (orange band) and oxygen (gold band)
    for (const [p, q, b] of [
      [-11, -2, OR[2]],
      [-3, -11, AU[3]],
    ] as const) {
      const [cx, cy] = iso(x, G, p, q, 18)
      cyl(ctx, cx, cy, 3, 10, WH, NT)
      band(ctx, cx, cy, 3, 7, 1, b)
      band(ctx, cx, cy, 3, 4, 1, STEN)
    }
    const [ax, ay] = iso(x, G, -11, -2, 24)
    const [bx, by] = iso(x, G, -3, -11, 24)
    line(ctx, ax + 2, ay, bx - 2, by, LG[3])
    const [lx, ly] = iso(x, G, 4, -6, 18)
    rect(ctx, lx, ly - 15, 1, 15, NT[4])
    rect(ctx, lx + 1, ly - 14, 1, 14, LG[1])
    beacon(ctx, lx, ly - 16, t)
  }
  tray(ctx, x, G, -13, 12, 6, 12, 0, t)
  junction(ctx, x, G, 11, 11, 0, 3, 8, t, 3)
}

/* ------------------------------- reactor -------------------------------- */

/**
 * One arm of the radiator cross: a tall white panel standing on the plane
 * through the mast, from s = 2 to L away from it. Heat pipes run up it, and
 * when it runs, warm pulses climb them.
 */
function radPanel(ctx: Ctx, X: number, G: number, pc: number, qc: number, axis: 'p' | 'q', sgn: number, L: number, z0: number, z1: number, t: number) {
  const lit = axis === 'p'
  // arms behind the mast sit a shade darker so the cross reads as four blades
  const back = sgn < 0 ? 0.16 : 0
  for (let s = 2; s <= L; s++) {
    const p = axis === 'p' ? pc + sgn * s : pc
    const q = axis === 'q' ? qc + sgn * s : qc
    const [sx, sy] = iso(X, G, p, q)
    const zt = Math.round(z1 - (s / L) * 4)
    const H = zt - z0
    for (let z = 0; z <= H; z++) {
      const yy = sy - z0 - z
      let c: string
      if (z === H) c = lit ? NT[4] : NT[3]
      else if (z === 0) c = hash(s, sgn, 5) < 0.4 ? DU[3] : LG[2]
      else if (s === L || s === 2) c = lit ? LG[4] : LG[2]
      else if (s % 3 === 0) c = lit && !back ? NT[2] : NT[1]
      else c = tone(WH, (lit ? 0.8 : 0.45) - back - (0.1 * z) / H, sx, yy)
      if (s % 6 === 3 && z > 0 && z < H && t > 0) {
        const k = (((z - Math.floor(t * 16) * 3 + s * 5) % 14) + 14) % 14
        if (k === 0) c = OR[3]
        else if (k === 1) c = OR[2]
      }
      rect(ctx, sx, yy, 1, 1, c)
    }
  }
}

/**
 * Fission surface power unit, 3×3: the reactor sits in a pit behind a ring
 * berm of bulldozed regolith, with only its gold-foiled shield top, the white
 * Stirling ring and the converter cone showing. Its memorable part is the tall
 * cross of white radiator panels on the mast, with heat visibly climbing the
 * pipes. A trefoil sign stands at the berm; a cable trench runs through a gap
 * in the berm to the white power-conditioning box. Level 2 completes the
 * radiator cross; level 3 makes it taller and adds a keep-out line.
 */
export function bigReactor(ctx: Ctx, x: number, y: number, t: number) {
  const tier = getTier()
  const G = plinth(ctx, x, y, 3, 3, 6)
  const pc = -5
  const qc = -5
  const L = tier === 1 ? 15 : tier === 2 ? 17 : 19
  const z0 = 26
  const z1 = tier === 1 ? 54 : tier === 2 ? 60 : 68
  const cross = tier >= 2

  // berm: a ring mound round the pit, with a gap toward +p for the cable trench
  const Hb = 10
  const berm = (p: number, q: number) => {
    if (Math.abs(p) > 23.5 || Math.abs(q) > 23.5) return 0
    const r = Math.hypot(p - pc, q - qc)
    if (p > pc && Math.abs(q - qc) < 2.5) return 0
    const w = r < 12 ? 4.5 : 6
    return Hb * Math.max(0, 1 - ((r - 12) / w) ** 2)
  }
  const drawBerm = (front: boolean) => {
    for (let d = -40; d <= 30; d += 0.5)
      for (let p = pc - 18; p <= pc + 18; p += 0.5) {
        const q = d - p
        if (front !== d >= pc + qc) continue
        const h = berm(p, q)
        if (h <= 0.4) continue
        const dp = berm(p + 0.5, q) - berm(p - 0.5, q)
        const dq = berm(p, q + 0.5) - berm(p, q - 0.5)
        const l = Math.max(0, Math.min(1, 0.62 - 0.22 * dq + 0.22 * dp))
        const [sx, sy0] = iso(x, G, p, q)
        const top = Math.round(sy0 - h)
        for (let yy = top; yy <= sy0; yy++) {
          let c = tone(DU, 0.18 + l * 0.7 - (yy - top > 2 ? 0.08 : 0), sx, yy)
          const v = hash(sx, yy, 17)
          if (v < 0.03) c = DU[0]
          else if (v < 0.05) c = STONE[2]
          rect(ctx, sx, yy, 1, 1, c)
        }
      }
  }

  drawBerm(false)
  // radiator arms behind the mast
  radPanel(ctx, x, G, pc, qc, 'p', -1, L, z0, z1, t)
  if (cross) radPanel(ctx, x, G, pc, qc, 'q', -1, L, z0, z1, t)
  // the reactor: gold-foiled shield, Stirling ring with converter pods, cone and mast
  const [vx, vy] = iso(x, G, pc, qc)
  cyl(ctx, vx, vy, 8, 14, AU, LG)
  for (let k = 0; k < 4; k++) band(ctx, vx, vy, 8, 6 + k * 2, 1, (dx) => ((dx + k * 3) % 7 === 0 ? AU[1] : hash(dx, k, 2) < 0.3 ? AU[4] : AU[3]))
  cyl(ctx, vx, vy - 14, 10, 5, WH, NT)
  band(ctx, vx, vy - 14, 10, 4, 1, OR[2])
  for (let z = 19; z <= 25; z++) {
    const rx = Math.round(9 - ((z - 19) * 5) / 6)
    cyl(ctx, vx, vy - z, rx, 1, WH, NT)
  }
  for (const [dx, dy] of [
    [-10, 1],
    [10, 1],
    [-5, 4],
    [5, 4],
  ]) {
    cyl(ctx, vx + dx, vy - 14 + dy, 2, 5, WH, LG)
    rect(ctx, vx + dx - 1, vy - 18 + dy, 2, 1, OR[3])
  }
  const mastTop = z1 + 6
  cyl(ctx, vx, vy - 25, 2, mastTop - 25, WH, LG)
  for (let k = 0; k < 3; k++) band(ctx, vx, vy, 2, mastTop - 2 - k * 4, 2, k % 2 ? WH[4] : OR[2])
  // manifold collar where the panels meet the mast
  band(ctx, vx, vy, 3, z0 + 1, 2, LG[3])
  beacon(ctx, vx, vy - mastTop - 2, t)
  // radiator arms in front of the mast
  radPanel(ctx, x, G, pc, qc, 'p', 1, L, z0, z1, t)
  if (cross) radPanel(ctx, x, G, pc, qc, 'q', 1, L, z0, z1, t)
  // cable trench through the berm gap
  tray(ctx, x, G, pc + 7, qc, 13, qc, 0, t)
  drawBerm(true)

  // power-conditioning box on the right: white, radiator fins, a display and lamps
  const P = box(ctx, x, G, 13, 22, -10, 0, 0, 12, WH, { roof: NT })
  onL(ctx, P, 0, P.a, 1, 2, (_, r) => (r ? OR[2] : OR[3]))
  onL(ctx, P, 1, 5, 4, 4, (c, r) => (c === 0 || r === 0 || c === 4 || r === 3 ? INK : (c + r + Math.floor(t * 4)) % 5 === 0 ? GLOW : r === 1 ? CY[3] : CY[1]))
  onL(ctx, P, 7, 1, 4, 1, led(blink(t, 2)))
  onL(ctx, P, 7, 1, 6, 1, led(blink(t, 1.5, 0.4), true))
  onL(ctx, P, 1, 7, 9, 3, stencilPx(0b1110110101))
  onR(ctx, P, 0, P.b, 1, 1, OR[1])
  onR(ctx, P, 1, P.b - 2, 3, 7, finsPx(false))
  dustBox(ctx, P, 31)
  {
    const [rx, ry] = iso(x, G, 17, -6, 12)
    rect(ctx, rx - 3, ry - 2, 5, 2, LG[3])
    rect(ctx, rx - 3, ry - 2, 5, 1, NT[4])
    if (tier >= 2) {
      rect(ctx, rx + 2, ry - 14, 1, 13, NT[4])
      rect(ctx, rx + 1, ry - 1, 3, 1, LG[2])
      rect(ctx, rx + 2, ry - 15, 1, 1, led(blink(t, 1.5)))
    }
  }
  tray(ctx, x, G, 17, 1, 17, 18, 0, t)
  junction(ctx, x, G, 18, 20, 0, 3, 7, t, 4)

  // trefoil sign at the foot of the berm, front-left
  const [sx, sy] = iso(x, G, -14, 20)
  signPost(ctx, sx + 2, sy - 22, 15, 13, sy, trefoil(15, 13))
  lamp(ctx, sx + 9, sy - 23, blink(t, 1.5) ? OR[4] : OR[0], OR[1])
  if (tier >= 3) {
    // keep-out line of bollards with an orange-and-white chain
    const pts = [-8, -2, 4, 10].map((p) => iso(x, G, p, 21))
    for (let k = 0; k + 1 < pts.length; k++) {
      const [ax, ay] = pts[k]
      const [bx, by] = pts[k + 1]
      const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay))
      for (let i = 0; i <= n; i++) rect(ctx, Math.round(ax + ((bx - ax) * i) / n), Math.round(ay - 4 + ((by - ay) * i) / n + (i > 1 && i < n - 1 ? 1 : 0)), 1, 1, (i >> 1) % 2 ? OR[2] : WH[4])
    }
    for (const [bx, by] of pts) bollard(ctx, bx, by, 6)
  }
}
