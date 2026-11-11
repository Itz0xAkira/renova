/**
 * Power: solar (panel, array, station), pylons, battery banks and the Kilopower reactor.
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
import { armourPx, band, cyanWindow, cyl, dome, fan, getTier, GLOW, hazardPx, hull, hullTop, INK, lamp, pipe, plinth, RAMP, signboard, stencilPx, tone, trefoil, ventPx, type Ramp } from '@/game/art/pixel'
import { line, glowStrip, M, MH, R, S, CY, SG } from '@/game/art/buildings/kit'

/* ------------------------------ local kit ------------------------------- */

const AL = RAMP.alert
/** Deep blue-cyan photovoltaic cells. */
const CELL: Ramp = ['#0a1530', '#0f2347', '#16365f', '#1e4b78', '#2b6592']
const GRID = '#4a7ba3'

type Px = (c: number, r: number) => string | null

/** Screen point of iso position (p, q) at height z above the base G. */
const iso = (X: number, G: number, p: number, q: number, z = 0) => [X + p - q, Math.round(G + (p + q) / 2 - z)] as const

const blink = (t: number, rate = 1.5, phase = 0) => (t * rate + phase) % 1 < 0.45
const redLamp = (ctx: Ctx, x: number, y: number, t: number, phase = 0) => lamp(ctx, x, y, blink(t, 1.5, phase) ? AL[4] : AL[0], AL[1])

/** Pixel art from strings; '.' is transparent. */
function art(ctx: Ctx, x: number, y: number, rows: string[], pal: Record<string, string>) {
  rows.forEach((row, r) => [...row].forEach((ch, c) => pal[ch] && rect(ctx, x + c, y + r, 1, 1, pal[ch])))
}
const WARN = ['..k..', '.kyk.', '.kkk.', 'kykyk', 'kkkkk']
const BOLT = ['kkkkk', 'kyyik', 'kyiyk', 'kiiyk', 'kyiyk', 'kkkkk']
const warnSign = (ctx: Ctx, x: number, y: number) => art(ctx, x, y, WARN, { k: INK, y: SG[4] })
const boltSign = (ctx: Ctx, x: number, y: number) => art(ctx, x, y, BOLT, { k: INK, y: SG[4], i: INK })

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
    if (o.seams && c > 0 && c % o.seams === 0) rect(ctx, xx, yt + 1, 1, h - 1, ramp[1])
  }
  for (let c = 0; c < b; c++) {
    const xx = fx + c
    const yt = fy - (c >> 1)
    for (let r = 0; r <= h; r++) rect(ctx, xx, yt + r, 1, 1, tone(ramp, 0.4 - (0.18 * r) / Math.max(1, h) - 0.12 * (c / b), xx, yt + r))
    rect(ctx, xx, yt + h, 1, 1, ramp[0])
    if (o.seams && c > 0 && c % o.seams === 0) rect(ctx, xx, yt + 1, 1, h - 1, ramp[0])
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

/** A cable tray on the ground along p (or q), with cables and travelling cyan pulses. */
function tray(ctx: Ctx, X: number, G: number, p0: number, q0: number, p1: number, q1: number, z: number, t: number, live = true) {
  const n = Math.max(Math.abs(p1 - p0), Math.abs(q1 - q0))
  const alongP = Math.abs(p1 - p0) >= Math.abs(q1 - q0)
  for (let k = 0; k <= n; k++) {
    const p = p0 + ((p1 - p0) * k) / n
    const q = q0 + ((q1 - q0) * k) / n
    const [sx, sy] = iso(X, G, p, q, z)
    // rails either side, dark bed between
    const [ox, oy] = alongP ? [-1, 0] : [1, 0]
    rect(ctx, sx + ox, sy - 1, 1, 1, M[4])
    rect(ctx, sx, sy - 1, 1, 1, k % 3 === 0 ? MH[3] : INK)
    rect(ctx, sx - ox, sy - 1, 1, 1, M[2])
    rect(ctx, sx, sy, 1, 1, M[1])
    const pulse = live && t > 0 && (k - Math.floor(t * 12)) % 9 === 0
    if (pulse) rect(ctx, sx, sy - 1, 1, 1, GLOW)
  }
}

/** A junction box with a hazard plate. (p, q) is its ground centre. */
function junction(ctx: Ctx, X: number, G: number, p: number, q: number, z: number, s: number, h: number, t: number) {
  const B = box(ctx, X, G, p - s, p + s, q - s, q + s, z, h, M, { roof: MH })
  onL(ctx, B, 1, B.a - 2, 2, h - 3, (c, r) => (c === 0 || r === 0 || c === B.a - 3 || r === h - 4 ? INK : r === 1 && c === 1 ? (blink(t, 2) ? '#7ee07a' : '#2f7a3a') : null))
  onR(ctx, B, 1, B.b - 2, 2, 1, hazardPx)
  return B
}

/* -------------------------------- solar --------------------------------- */

type Panel = { p0: number; p1: number; q0: number; q1: number; z0: number; kp: number; kq: number; cols: number; rows: number; frame: Ramp; glint: number }

/**
 * A photovoltaic panel: a plane z = z0 + kp·p + kq·q over [p0,p1]×[q0,q1], filled
 * screen-pixel by screen-pixel so the cell grid stays crisp. It has a framed edge,
 * a 2px rim underneath, deep blue cells and a sky glint that sweeps with `glint`.
 */
function solarPanel(ctx: Ctx, X: number, G: number, P: Panel) {
  const { p0, p1, q0, q1, z0, kp, kq } = P
  const A = 0.5 - kp
  const Bq = 0.5 - kq
  const pq = (sx: number, sy: number) => {
    const dx = sx + 0.5 - X
    const dy = sy + 0.5 - G + z0
    const q = (dy - A * dx) / (A + Bq)
    return [dx + q, q] as const
  }
  const inside = (sx: number, sy: number) => {
    const [p, q] = pq(sx, sy)
    return p >= p0 && p < p1 && q >= q0 && q < q1
  }
  const ci = (sx: number, sy: number) => Math.floor(((pq(sx, sy)[0] - p0) / (p1 - p0)) * P.cols)
  const ri = (sx: number, sy: number) => Math.floor(((pq(sx, sy)[1] - q0) / (q1 - q0)) * P.rows)
  const zf = (p: number, q: number) => z0 + kp * p + kq * q
  const cs = [
    [p0, q0],
    [p1, q0],
    [p0, q1],
    [p1, q1],
  ].map(([p, q]) => [X + p - q, G + (p + q) / 2 - zf(p, q)])
  const xa = Math.floor(Math.min(...cs.map((c) => c[0]))) - 1
  const xb = Math.ceil(Math.max(...cs.map((c) => c[0]))) + 1
  const ya = Math.floor(Math.min(...cs.map((c) => c[1]))) - 1
  const yb = Math.ceil(Math.max(...cs.map((c) => c[1]))) + 3
  const F = P.frame
  const half = Math.round(P.cols / 2)
  for (let sy = ya; sy <= yb; sy++)
    for (let sx = xa; sx <= xb; sx++) {
      if (!inside(sx, sy)) {
        // the panel's thickness under its lower edges
        if (inside(sx, sy - 1)) rect(ctx, sx, sy, 1, 1, F[1])
        else if (inside(sx, sy - 2)) rect(ctx, sx, sy, 1, 1, M[0])
        continue
      }
      const [p, q] = pq(sx, sy)
      const edge = !inside(sx - 1, sy) || !inside(sx + 1, sy) || !inside(sx, sy - 1) || !inside(sx, sy + 1)
      let c: string
      if (edge) {
        const d = [p - p0, p1 - p, q - q0, q1 - q]
        const k = d.indexOf(Math.min(...d))
        c = [F[4], F[1], F[3], F[2]][k]
      } else {
        const i = ci(sx, sy)
        const j = ri(sx, sy)
        const s = (p - p0) / (p1 - p0)
        const r = (q - q0) / (q1 - q0)
        if (i !== ci(sx + 1, sy) && i + 1 === half) c = F[2]
        else if (i !== ci(sx + 1, sy) || j !== ri(sx, sy + 1)) c = GRID
        else {
          const v = 0.3 + 0.3 * (1 - r) + (((i * 7 + j * 3) % 5) - 2) * 0.04
          const top = j !== ri(sx, sy - 1)
          c = CELL[Math.max(0, Math.min(4, Math.floor(v * 4) + (top ? 1 : 0)))]
        }
        // sky glint: a soft diagonal band with a bright core
        const g = Math.abs(s * 0.7 + r - P.glint)
        if (g < 0.03) c = c === GRID ? CY[4] : GLOW
        else if (g < 0.09) c = c === GRID ? CY[3] : CY[2]
        else if (s * 0.7 + r < 0.18) c = c === GRID ? CY[1] : CELL[4]
      }
      rect(ctx, sx, sy, 1, 1, c)
    }
}

/** A short steel post from the ground at (p, q) up to height z. */
function post(ctx: Ctx, X: number, G: number, p: number, q: number, z: number, top: number) {
  const [sx, sy] = iso(X, G, p, q, z)
  rect(ctx, sx, sy - top, 1, top + 1, M[4])
  rect(ctx, sx + 1, sy - top, 1, top + 1, M[1])
  rect(ctx, sx - 1, sy, 4, 1, M[0])
}

/** Fixed-tilt panel bank: front and back posts, braces, then the panel. */
function fixedBank(ctx: Ctx, X: number, G: number, p0: number, p1: number, q0: number, q1: number, zLo: number, zHi: number, cols: number, rows: number, frame: Ramp, glint: number, posts: number) {
  const kq = -(zHi - zLo) / (q1 - q0)
  const z0 = zLo - kq * q1
  const zAt = (q: number) => z0 + kq * q
  const ps = Array.from({ length: posts }, (_, k) => Math.round(p0 + 2 + ((p1 - p0 - 4) * k) / Math.max(1, posts - 1)))
  // back posts (mostly hidden) and the front row with a rail and cross braces
  for (const p of ps) post(ctx, X, G, p, q0 + 2, 0, Math.round(zAt(q0 + 2)))
  for (const p of ps) post(ctx, X, G, p, q1 - 2, 0, Math.round(zAt(q1 - 2)))
  for (let k = 0; k + 1 < ps.length; k++) {
    const [ax, ay] = iso(X, G, ps[k], q1 - 2)
    const [bx, by] = iso(X, G, ps[k + 1], q1 - 2)
    const h = Math.round(zAt(q1 - 2))
    line(ctx, ax + 1, ay - 1, bx, by - h + 2, M[2])
    line(ctx, ax + 1, ay - h + 2, bx, by - 1, M[1])
    line(ctx, ax + 1, ay - (h >> 1), bx, by - (h >> 1), M[3])
  }
  solarPanel(ctx, X, G, { p0, p1, q0, q1, z0, kp: 0, kq, cols, rows, frame, glint })
}

/** A sun-tracking panel on a single pedestal with a gimbal head; it rolls with `roll`. */
function tracker(ctx: Ctx, X: number, G: number, pc: number, qc: number, s: number, d: number, zc: number, tilt: number, roll: number, glint: number) {
  // concrete footing, mast and gimbal
  const [fx, fy] = iso(X, G, pc, qc)
  hull(ctx, fx, hullTop(fy + 1, 4, 2), 4, 2, RAMP.stone, { roof: RAMP.stone })
  rect(ctx, fx - 1, fy - zc, 1, zc, MH[3])
  rect(ctx, fx, fy - zc, 1, zc, M[2])
  rect(ctx, fx + 1, fy - zc, 1, zc, M[0])
  rect(ctx, fx - 2, fy - zc - 1, 5, 3, M[3])
  rect(ctx, fx - 2, fy - zc + 1, 5, 1, M[1])
  // actuator arm
  line(ctx, fx + 1, fy - 3, fx + 4, fy - zc + 1, MH[2])
  const kq = -tilt / d
  const kp = roll / s
  solarPanel(ctx, X, G, {
    p0: pc - s,
    p1: pc + s,
    q0: qc - d,
    q1: qc + d,
    z0: zc - kp * pc - kq * qc,
    kp,
    kq,
    cols: 6,
    rows: 4,
    frame: CY,
    glint,
  })
}

/**
 * Solar, by level, on a 2×2 footprint:
 * 1, solar panel: one big tilted bank on posts with a junction box and cable tray;
 * 2, solar array: four smaller banks in two rows, a combiner box and a warning sign;
 * 3, solar station: three sun-tracking panels round a control hut with a mast.
 */
export function solarArray(ctx: Ctx, x: number, y: number, t: number, tier = 1) {
  const G = plinth(ctx, x, y, 2, 2, 4)
  const glint = -0.3 + ((0.75 + t * 0.8) % 1.6)
  if (tier === 1) {
    fixedBank(ctx, x, G, -14, 13, -12, 6, 5, 19, 8, 5, R, glint, 3)
    // cable tray along the front to a junction box at the front corner
    tray(ctx, x, G, -12, 11, 6, 11, 0, t)
    junction(ctx, x, G, 11, 11, 0, 3, 7, t)
    warnSign(ctx, x - 1, G + 5)
    return
  }
  if (tier === 2) {
    fixedBank(ctx, x, G, -15, -1, -15, -5, 4, 11, 4, 3, SG, glint, 2)
    fixedBank(ctx, x, G, 1, 15, -15, -5, 4, 11, 4, 3, SG, glint - 0.15, 2)
    fixedBank(ctx, x, G, -15, -1, 0, 10, 4, 11, 4, 3, SG, glint + 0.1, 2)
    fixedBank(ctx, x, G, 1, 15, 0, 10, 4, 11, 4, 3, SG, glint - 0.05, 2)
    tray(ctx, x, G, -14, 13, 7, 13, 0, t)
    tray(ctx, x, G, 0, -12, 0, 12, 0, t)
    junction(ctx, x, G, 11, 12, 0, 3, 8, t)
    // warning sign on a post at the front-left
    const [sx, sy] = iso(x, G, -10, 15)
    rect(ctx, sx + 2, sy - 6, 1, 6, M[3])
    boltSign(ctx, sx, sy - 11)
    return
  }
  // station: tracking panels round a control hut
  const roll = Math.round(Math.sin(t * Math.PI) * 2)
  const tilt = 4 + Math.round(Math.cos(t * Math.PI))
  tracker(ctx, x, G, -8, -8, 7, 5, 11, tilt, roll, glint)
  // control hut on the right
  const hut = box(ctx, x, G, 3, 15, -15, -3, 0, 11, S, { roof: M, seams: 4 })
  onL(ctx, hut, 1, 5, 3, 4, cyanWindow(5, 4))
  onL(ctx, hut, 7, 3, 3, 8, (c, r) => (c === 0 || r === 0 || c === 2 ? INK : r === 3 && c === 1 ? MH[4] : S[1]))
  onL(ctx, hut, 0, hut.a, 9, 1, (c) => (c % 2 ? R[1] : R[3]))
  onR(ctx, hut, 2, 6, 3, 3, ventPx)
  onR(ctx, hut, 2, 8, 8, 1, stencilPx(0b1101101))
  // roof gear: AC unit, mast, dish and beacon
  {
    const [rx, ry] = iso(x, G, 9, -9, 11)
    rect(ctx, rx - 5, ry - 2, 4, 2, M[3])
    rect(ctx, rx - 5, ry, 4, 1, M[1])
    rect(ctx, rx + 3, ry - 18, 1, 18, M[4])
    rect(ctx, rx + 4, ry - 18, 1, 18, M[1])
    for (let k = 4; k < 18; k += 4) rect(ctx, rx + 2, ry - k, 3, 1, M[2])
    dome(ctx, rx + 1, ry - 10, 3, 2, 1, MH, false)
    rect(ctx, rx - 1, ry - 10, 1, 1, CY[4])
    redLamp(ctx, rx + 3, ry - 20, t)
  }
  tracker(ctx, x, G, -8, 8, 7, 5, 10, tilt, roll, glint + 0.1)
  // conduits to the hut, carrying pulses of power
  tray(ctx, x, G, -1, 1, 12, 1, 0, t)
  tray(ctx, x, G, -1, -12, -1, 14, 0, t)
  tracker(ctx, x, G, 8, 8, 7, 5, 9, tilt, roll, glint - 0.1)
  const [jx, jy] = iso(x, G, 14, 13)
  rect(ctx, jx - 2, jy - 6, 4, 6, M[2])
  rect(ctx, jx - 2, jy - 6, 4, 1, MH[4])
  rect(ctx, jx - 1, jy - 4, 2, 1, blink(t, 2) ? GLOW : CY[1])
}

/* -------------------------------- pylon --------------------------------- */

/** Height above the ground where a pylon's cables attach, by level (the scene draws them at y − 1 − PYLON_TOP). */
export const PYLON_TOP = [30, 38, 46]

/** A string of glass insulator discs hanging from (x, y), n discs long. */
function insulator(ctx: Ctx, x: number, y: number, n: number) {
  rect(ctx, x, y, 1, 1, M[3])
  for (let k = 0; k < n; k++) {
    rect(ctx, x - 1, y + 1 + k * 2, 3, 1, k % 2 ? CY[2] : CY[3])
    rect(ctx, x, y + 2 + k * 2, 1, 1, CY[4])
  }
  rect(ctx, x, y + 1 + n * 2, 1, 1, MH[4])
}

/** An upright cap insulator under the cable saddle at (x, ya). */
function capInsulator(ctx: Ctx, x: number, ya: number) {
  rect(ctx, x - 2, ya, 5, 1, MH[4])
  rect(ctx, x - 1, ya - 1, 3, 1, MH[3])
  for (let k = 0; k < 3; k++) {
    rect(ctx, x - 2, ya + 1 + k * 2, 5, 1, k === 0 ? GLOW : CY[3])
    rect(ctx, x - 1, ya + 2 + k * 2, 3, 1, CY[1])
  }
}

/** A cross-arm at height ay, half-span s, with hanging insulators at both ends. */
function crossArm(ctx: Ctx, x: number, ay: number, s: number, n: number) {
  rect(ctx, x - s, ay, s * 2 + 1, 1, MH[3])
  rect(ctx, x - s, ay + 1, s * 2 + 1, 1, M[1])
  line(ctx, x - s + 2, ay + 1, x - 2, ay + 5, M[2])
  line(ctx, x + s - 2, ay + 1, x + 2, ay + 5, M[1])
  insulator(ctx, x - s, ay + 2, n)
  insulator(ctx, x + s, ay + 2, n)
}

/** Power pylon: a guyed steel pole (1), a lattice tower (2), a tower over a transformer substation (3). */
export function pylon(ctx: Ctx, x: number, y: number, t: number, tier = 1) {
  const ya = y - 1 - PYLON_TOP[tier - 1]
  if (tier === 1) {
    hull(ctx, x, hullTop(y + 1, 7, 2), 7, 2, RAMP.stone, { roof: RAMP.stone })
    // tapered pole with climbing pegs, on a bolted base flange
    for (let yy = ya + 6; yy < y; yy++) {
      if (yy > y - 12) rect(ctx, x - 2, yy, 1, 1, MH[2])
      rect(ctx, x - 1, yy, 1, 1, MH[4])
      rect(ctx, x, yy, 1, 1, MH[2])
      rect(ctx, x + 1, yy, 1, 1, M[2])
      if ((yy - ya) % 4 === 0 && yy < y - 4) rect(ctx, (yy - ya) % 8 ? x - 3 : x + 2, yy, 1, 1, MH[4])
    }
    rect(ctx, x - 4, y - 3, 8, 2, M[3])
    rect(ctx, x - 4, y - 1, 8, 1, M[1])
    rect(ctx, x - 3, y - 3, 1, 1, MH[4])
    rect(ctx, x + 2, y - 3, 1, 1, MH[4])
    crossArm(ctx, x, ya + 8, 7, 2)
    // hazard band, warning plate and a meter box low down
    for (let k = 0; k < 4; k++) rect(ctx, x - 1, y - 16 + k, 2, 1, k % 2 ? INK : SG[4])
    boltSign(ctx, x - 7, y - 20)
    rect(ctx, x + 1, y - 9, 4, 5, M[2])
    rect(ctx, x + 1, y - 9, 4, 1, MH[4])
    rect(ctx, x + 2, y - 7, 1, 1, blink(t, 2) ? '#7ee07a' : '#2f7a3a')
    capInsulator(ctx, x, ya)
    return
  }
  const base = tier === 3 ? y - 3 : y
  if (tier === 3) {
    // substation yard: pad, transformer with radiator fins, bushings
    hull(ctx, x, hullTop(y + 2, 14, 3), 14, 3, RAMP.stone, { roof: RAMP.stone })
    const tt = hullTop(y - 1, 8, 10)
    hull(ctx, x - 6, tt, 8, 10, M, { seams: 2, roof: MH })
    for (let c = 1; c < 8; c += 2) rect(ctx, x - 6 + c, tt + 8 - (c >> 1), 1, 8, MH[1])
    rect(ctx, x - 14, tt + 6, 8, 1, INK)
    for (let k = 0; k < 8; k++) rect(ctx, x - 14 + k, tt + 5 + (k >> 1), 1, 1, hazardPx(k, 0))
    boltSign(ctx, x - 13, tt + 8)
    for (const bx of [-9, -5, -2]) {
      rect(ctx, x + bx, tt - 4, 1, 5, CY[3])
      rect(ctx, x + bx - 1, tt - 3, 3, 1, CY[2])
      rect(ctx, x + bx - 1, tt - 1, 3, 1, CY[2])
      rect(ctx, x + bx, tt - 5, 1, 1, GLOW)
    }
    glowStrip(ctx, x - 11, tt + 15, 4, blink(t, 1) ? 1 : 0.5)
  } else {
    hull(ctx, x, hullTop(y + 1, 9, 2), 9, 2, RAMP.stone, { roof: RAMP.stone })
  }
  // lattice tower from the footing up to the cable saddle
  const top = ya + 6
  const H = base - top
  const legL = (k: number) => x - 6 + Math.round((k * 4) / H)
  const legR = (k: number) => x + 6 - Math.round((k * 4) / H)
  for (let k = 0; k + 7 <= H; k += 7) {
    line(ctx, legL(k) + 1, base - k, legR(k + 7) - 1, base - k - 7, MH[1])
    line(ctx, legR(k) - 1, base - k, legL(k + 7) + 1, base - k - 7, MH[2])
    rect(ctx, legL(k), base - k, legR(k) - legL(k), 1, MH[2])
  }
  for (let k = 0; k <= H; k++) {
    rect(ctx, legL(k), base - k, 1, 1, MH[4])
    rect(ctx, legL(k) + 1, base - k, 1, 1, MH[2])
    rect(ctx, legR(k), base - k, 1, 1, M[2])
  }
  // feet
  rect(ctx, legL(0) - 1, base, 3, 1, M[3])
  rect(ctx, legR(0) - 1, base, 3, 1, M[1])
  crossArm(ctx, x, ya + 8, 8, 2)
  crossArm(ctx, x, ya + 16, 7, 2)
  // warning plate on the tower and a red aircraft lamp beside the saddle
  boltSign(ctx, x - 2, base - 13)
  capInsulator(ctx, x, ya)
  rect(ctx, x + 3, ya + 2, 3, 1, M[2])
  redLamp(ctx, x + 5, ya + 1, t)
  if (tier === 3) {
    rect(ctx, x - 6, ya + 2, 3, 1, M[2])
    lamp(ctx, x - 6, ya + 1, blink(t, 1, 0.5) ? GLOW : CY[2], CY[1])
  }
}

/* ------------------------------- battery -------------------------------- */

/** A segmented charge bar on a box's lit face: n segments, `lit` of them on. */
function chargeBar(ctx: Ctx, B: Box, c: number, r: number, n: number, lit: number) {
  onL(ctx, B, c, 2, r - 1, n * 2 + 1, INK)
  for (let k = 0; k < n; k++) {
    const on = k < lit
    const col = on ? (k === lit - 1 ? GLOW : CY[4]) : CY[0]
    onL(ctx, B, c, 2, r + (n - 1 - k) * 2, 1, (cc) => (on && cc === 1 ? CY[3] : col))
  }
}

/**
 * Battery bank, 2×2: a cabinet of three cell racks with animated charge bars,
 * a finned cooling wall and roof terminals. Level 2 adds roof radiators and a
 * chiller; level 3 adds supercapacitor drums and a lightning mast.
 */
export function battery(ctx: Ctx, x: number, y: number, t: number) {
  const tier = getTier()
  const G = plinth(ctx, x, y, 2, 2, 5)
  // ground cable tray along the front, feeding the front-corner junction box
  const B = box(ctx, x, G, -14, 8, -14, 6, 0, 20, MH, { roof: MH })
  // lit face: armour band, three racks with charge bars, hazard foot
  onL(ctx, B, 0, B.a, 1, 3, armourPx(3))
  onL(ctx, B, 0, B.a, 4, 1, INK)
  const step = Math.floor(t * 4)
  for (let k = 0; k < 3; k++) {
    const c0 = 1 + k * 7
    onL(ctx, B, c0 - 1, 1, 4, 14, INK)
    onL(ctx, B, c0, 6, 5, 13, (c, r) => (r === 0 ? MH[4] : c === 5 ? MH[1] : c === 0 ? MH[3] : null))
    const lit = t === 0 ? 4 + k : ((step + k * 2) % 6) + 1
    chargeBar(ctx, B, c0 + 1, 6, 6, lit)
    onL(ctx, B, c0 + 3, 2, 6, 1, (c) => (c ? M[1] : k === 2 && tier === 1 ? AL[3] : '#7ee07a'))
    onL(ctx, B, c0 + 3, 2, 9, 3, stencilPx(0b101101 + k))
    onL(ctx, B, c0 + 3, 2, 14, 3, (c, r) => (r === 1 ? INK : M[2]))
  }
  onL(ctx, B, 21, 1, 4, 14, INK)
  onL(ctx, B, 0, B.a, 18, 2, hazardPx)
  // shaded face: cooling fins round a high-voltage sign
  onR(ctx, B, 0, B.b, 1, 3, (c, r) => (r === 1 ? INK : c % 6 === 2 ? S[3] : S[1]))
  onR(ctx, B, 1, B.b - 2, 5, 12, (c, r) => (r === 0 ? MH[3] : c % 3 === 0 ? MH[3] : c % 3 === 1 ? MH[1] : M[1]))
  onR(ctx, B, 3, 5, 6, 6, (c, r) => BOLT[r][c] === 'k' ? INK : BOLT[r][c] === 'y' ? SG[4] : INK)
  onR(ctx, B, 0, B.b, 18, 2, (c, r) => ((c + r) % 4 < 2 ? SG[3] : INK))
  // roof: vent box, terminals and a glowing busbar
  const [vx, vy] = iso(x, G, -8, -8, 20)
  rect(ctx, vx - 5, vy - 3, 10, 3, M[2])
  rect(ctx, vx - 5, vy - 4, 10, 1, MH[3])
  for (let k = 0; k < 9; k += 2) rect(ctx, vx - 4 + k, vy - 2, 1, 2, INK)
  const [px, py] = iso(x, G, 4, 0, 20)
  const [nx, ny] = iso(x, G, -6, 4, 20)
  line(ctx, nx, ny - 2, px, py - 2, blink(t, 2) ? GLOW : CY[3])
  cyl(ctx, px, py, 2, 3, AL, AL)
  cyl(ctx, nx, ny, 2, 3, M, MH)
  rect(ctx, px, py - 6, 1, 2, AL[4])
  rect(ctx, nx - 1, ny - 5, 2, 1, MH[4])
  if (tier >= 2) {
    // roof radiator plates and a chiller unit on the right
    for (let p = -12; p <= 4; p += 3)
      for (let z = 0; z < 6; z++) {
        const [ax, ay] = iso(x, G, p, -13, 20 + z)
        const [bx, by] = iso(x, G, p, -9, 20 + z)
        line(ctx, ax, ay, bx, by, z === 5 ? MH[4] : (p >> 1) % 2 ? M[3] : M[2])
      }
    const C = box(ctx, x, G, 9, 15, -12, 2, 0, 7, MH, { roof: M })
    onR(ctx, C, 1, C.b - 2, 1, 5, (c, r) => (c % 2 ? INK : r === 0 ? MH[4] : M[2]))
    onL(ctx, C, 1, 4, 2, 3, (c, r) => (r === 1 ? (blink(t, 2) ? GLOW : CY[2]) : INK))
  }
  if (tier >= 3) {
    // supercapacitor drums on the roof and a lightning mast
    for (const [p, q] of [
      [-11, -2],
      [-3, -11],
    ]) {
      const [cx, cy] = iso(x, G, p, q, 20)
      cyl(ctx, cx, cy, 3, 9, MH, M)
      band(ctx, cx, cy, 3, 2, 1, SG[3])
      glowStrip(ctx, cx - 1, cy - 1, 5, 0.4 + (((step + p) % 4) + 4) % 4 * 0.2)
    }
    const [lx, ly] = iso(x, G, 2, -6, 20)
    rect(ctx, lx, ly - 15, 1, 15, M[4])
    rect(ctx, lx + 1, ly - 14, 1, 14, M[1])
    redLamp(ctx, lx, ly - 16, t)
  }
  tray(ctx, x, G, -13, 12, 6, 12, 0, t)
  junction(ctx, x, G, 11, 11, 0, 3, 8, t)
}

/* ------------------------------- reactor -------------------------------- */

/** Radiator fins of the umbrella cone round (cx, cy); `front` picks the half nearer the viewer. */
function radiatorCone(ctx: Ctx, cx: number, cy: number, n: number, rIn: number, rOut: number, lift: number, front: boolean, glowTips: boolean) {
  for (let k = 0; k < n; k++) {
    const a = ((k + 0.5) / n) * Math.PI * 2
    const sn = Math.sin(a)
    if (front !== sn >= 0) continue
    const cs = Math.cos(a)
    const lit = cs < 0.2
    for (let s = 0; s <= 1.0001; s += 1 / 28) {
      const r = rIn + (rOut - rIn) * s
      const fx = Math.round(cx + r * cs)
      const fy = Math.round(cy + (r * sn) / 2 - lift * s)
      const hh = Math.round(5 - 2 * s)
      for (let z = 0; z < hh; z++) rect(ctx, fx, fy - z, 1, 1, z === hh - 1 ? (lit ? MH[4] : MH[2]) : lit ? tone(MH, 0.55 - s * 0.2, fx, fy - z) : tone(M, 0.45 - s * 0.2, fx, fy - z))
      if (s > 0.97) rect(ctx, fx, fy - hh, 1, 1, glowTips ? GLOW : MH[4])
    }
  }
  // the outer hoop, back or front half
  for (let k = 0; k < 160; k++) {
    const a = (k / 160) * Math.PI * 2
    if (front !== Math.sin(a) >= 0) continue
    rect(ctx, Math.round(cx + rOut * Math.cos(a)), Math.round(cy + (rOut * Math.sin(a)) / 2 - lift - 3), 1, 1, Math.cos(a) < 0 ? MH[3] : M[2])
  }
}

/** A flat radiator wing standing along p (at q) or along q (at p): fins with coolant lines. */
function radiatorWing(ctx: Ctx, X: number, G: number, alongP: boolean, at: number, s0: number, s1: number, h: number, t: number) {
  for (let s = s0; s <= s1; s++) {
    const [sx, sy] = alongP ? iso(X, G, s, at) : iso(X, G, at, s)
    const k = s - s0
    for (let z = 0; z < h; z++) {
      let c: string = alongP ? (k % 3 === 0 ? MH[3] : M[2]) : k % 3 === 0 ? M[3] : M[1]
      if (z === h - 1 || z === 0) c = MH[4]
      if (z === 4 || z === h - 5) c = alongP ? CY[2] : CY[1]
      if ((z === 4 || z === h - 5) && t > 0 && (k + Math.floor(t * 10)) % 7 === 0) c = GLOW
      rect(ctx, sx, sy - z, 1, 1, c)
    }
  }
  for (const s of [s0, s1]) {
    const [sx, sy] = alongP ? iso(X, G, s, at) : iso(X, G, at, s)
    rect(ctx, sx, sy - h, 1, h + 1, M[4])
  }
}

/**
 * Kilopower reactor, 3×3: an armoured bunker with a sealed vault, the shielded
 * reactor vessel with a glowing core slit and Stirling pods, and the umbrella
 * radiator on top. Level 2 widens the radiator and adds coolant tanks; level 3
 * adds radiator wings and a brighter core.
 */
export function bigReactor(ctx: Ctx, x: number, y: number, t: number) {
  const tier = getTier()
  const G = plinth(ctx, x, y, 3, 3, 6)
  const pulse = 0.5 + 0.5 * Math.cos(t * Math.PI * 2)
  if (tier >= 3) {
    radiatorWing(ctx, x, G, true, -22, -4, 14, 26, t)
    radiatorWing(ctx, x, G, false, -22, -4, 14, 26, t)
  }
  // bunker
  const B = box(ctx, x, G, -20, 12, -20, 12, 0, 14, M, { roof: R })
  onL(ctx, B, 0, B.a, 1, 13, armourPx(3))
  onL(ctx, B, 0, B.a, 0, 1, hazardPx)
  // vault door with a glowing seal
  onL(ctx, B, 11, 11, 2, 12, (c, r) => {
    if (c === 0 || c === 10 || r === 0) return M[4]
    if (c === 1 || c === 9 || r === 1) return INK
    if (c === 5 && r > 2) return pulse > 0.5 ? GLOW : CY[4]
    if ((c === 3 || c === 7) && r > 3 && r < 9) return M[1]
    return (c + r) % 2 ? M[3] : M[2]
  })
  onL(ctx, B, 3, 5, 5, 5, (c, r) => trefoil(7, 7)(c, r))
  // shaded face: armour bands, a vent bank and a cooling grille
  onR(ctx, B, 0, B.b, 1, 13, (c, r) => (r % 4 === 0 ? INK : Math.floor(r / 4) % 2 ? M[1] : R[1]))
  onR(ctx, B, 3, 10, 3, 6, ventPx)
  onR(ctx, B, 16, 12, 2, 10, (c) => (c % 2 ? INK : M[2]))
  onR(ctx, B, 0, B.b, 13, 1, (c) => (c % 4 < 2 ? SG[3] : INK))
  // vessel on the bunker roof
  const [vx, vy] = iso(x, G, -4, -4, 14)
  const rOut = tier === 1 ? 17 : tier === 2 ? 21 : 23
  const fins = tier === 1 ? 12 : tier === 2 ? 16 : 20
  const coneY = vy - 17
  // Stirling pods behind
  for (const dx of [-8, 8]) cyl(ctx, vx + dx, vy - 4, 3, 6, MH, M)
  radiatorCone(ctx, vx, coneY, fins, 9, rOut, 12, false, tier === 3)
  cyl(ctx, vx, vy, 10, 20, MH, M)
  band(ctx, vx, vy, 10, 2, 2, (dx) => ((dx + 20) % 4 < 2 ? SG[4] : INK))
  band(ctx, vx, vy, 10, 12, 1, R[2])
  band(ctx, vx, vy, 10, 17, 1, M[1])
  // core slit, glowing through the shield
  for (let k = 0; k < 9; k++) {
    rect(ctx, vx - 6, vy - 15 + k, 4, 1, INK)
    const glow = (k + Math.floor(t * 4)) % 3 === 0 && t > 0
    rect(ctx, vx - 5, vy - 15 + k, 2, 1, glow || tier === 3 ? GLOW : pulse > 0.5 ? CY[4] : CY[3])
  }
  rect(ctx, vx - 7, vy - 16, 6, 1, M[4])
  rect(ctx, vx - 7, vy - 6, 6, 1, M[1])
  // Stirling pods in front, with glowing rings
  for (const [dx, dy] of [
    [-11, 2],
    [11, 2],
  ]) {
    cyl(ctx, vx + dx, vy + dy, 3, 7, MH, M)
    band(ctx, vx + dx, vy + dy, 3, 4, 1, CY[3])
  }
  radiatorCone(ctx, vx, coneY, fins, 9, rOut, 12, true, tier === 3)
  // heat-pipe column and cap
  cyl(ctx, vx, coneY + 2, 3, 12, MH, M)
  dome(ctx, vx, coneY - 11, 4, 3, 1, MH)
  redLamp(ctx, vx, coneY - 15, t)
  // red lamps on the bunker corners
  for (const [p, q, ph] of [
    [-20, 12, 0],
    [12, -20, 0.5],
    [12, 12, 0.25],
  ]) {
    const [lx, ly] = iso(x, G, p, q, 15)
    redLamp(ctx, lx, ly - 1, t, ph)
  }
  // front-right yard: fan box (and coolant tanks from level 2)
  if (tier >= 2) {
    for (const [p, q] of [
      [19, -17],
      [19, -8],
    ]) {
      const [cx, cy] = iso(x, G, p, q)
      cyl(ctx, cx, cy, 4, 13, MH, M)
      band(ctx, cx, cy, 4, 10, 1, SG[3])
      glowStrip(ctx, cx - 2, cy - 2, 7, 0.5 + 0.5 * pulse)
    }
    pipe(ctx, x + 22, G - 12, x + 15, G - 9, MH)
  }
  const E = box(ctx, x, G, 15, 23, -2, 8, 0, 9, MH, { roof: M })
  onL(ctx, E, 0, E.a, 1, 1, hazardPx)
  fan(ctx, E.fx - 4, E.fy + 1 + 4, 2, t)
  onR(ctx, E, 1, 8, 2, 5, ventPx)
  // coolant pipes from the bunker to the fan box
  pipe(ctx, x + 6, G + 3, x + 13, G + 7, MH)
  // front-left yard: trefoil billboard and a cable tray
  const [sx, sy] = iso(x, G, -16, 20)
  signboard(ctx, sx + 2, sy - 24, 15, 13, sy, trefoil(15, 13))
  lamp(ctx, sx + 9, sy - 25, blink(t, 1.5) ? SG[4] : SG[0], SG[1])
  tray(ctx, x, G, -6, 18, 14, 18, 0, t)
  tray(ctx, x, G, 14, 18, 14, 14, 0, t)
}
