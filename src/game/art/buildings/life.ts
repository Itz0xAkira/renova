/**
 * Life support: the MOXIE oxygen plant, habitat, regolith shield and greenhouse,
 * in the expedition style: off-white composite and fabric pressure hulls, light
 * grey structure, safety-orange stripes and hatches, gold MLI foil, dark solar
 * cells, small red/green status lamps and warm-lit windows, with red regolith
 * dust creeping up every wall.
 *
 * Each function draws one building on ground point (x, y), the centre of its
 * footprint. A w×h footprint spans ±(w+h)·8 px across and ±(w+h)·4 px down.
 * `t` is animation time; frame 0 (t = 0) doubles as the idle pose.
 *
 * The buildings are modelled in footprint space with the small z-buffered
 * renderer below (`Iso`): u runs down-right, v down-left (both in tiles from
 * the footprint centre), z up in px. Left (+v) faces are lit, right (+u) faces
 * shaded. base.ts uses the same renderer and palette for the core and the lab.
 */
import { rect, type Ctx } from '@/site/pixel/engine'
import { getTier, GLOW, INK, plinth, RAMP, signboard, tone, trefoil, ventPx, type Ramp } from '@/game/art/pixel'
import { puffs, M, MH, R, CY, SG, STEAM } from '@/game/art/buildings/kit'

/* ------------------------- a small iso renderer ------------------------- */

const SQ2 = Math.SQRT2
const LU = -0.303
const LV = 0.505
const LZ = 0.808
/** Brightness (0–1) of a surface with world normal (nu, nv, nz). */
const lightN = (nu: number, nv: number, nz: number) => 0.38 + 0.55 * (nu * LU + nv * LV + nz * LZ)
/** Height in px of one tile of horizontal length. */
export const KZ = 19.6
/** Screen px of horizontal radius per tile (a round thing of radius rx px is rx / PXT tiles). */
export const PXT = 22.63

export type Paint = string | ((px: number, py: number) => string)
/** A face pattern: (column, row below the face's top edge, face width, face height) → colour, or null for the default shading. */
export type Pat = (c: number, r: number, W: number, H: number) => string | null | undefined
/** Pattern for round things: nx is −1…1 across the silhouette, r the row from the top, l the lit brightness. */
export type RoundPat = (nx: number, r: number, H: number, l: number, px: number, py: number) => string | null | undefined

/** A pattern moved to (c0, r0) and clipped to w×h. */
export const at =
  (c0: number, r0: number, w: number, h: number, p: Pat | string): Pat =>
  (c, r) =>
    c >= c0 && c < c0 + w && r >= r0 && r < r0 + h ? (typeof p === 'string' ? p : p(c - c0, r - r0, w, h)) : null
/** The first pattern that paints a pixel wins. */
export const all =
  (...ps: (Pat | false | undefined)[]): Pat =>
  (c, r, W, H) => {
    for (const p of ps)
      if (p) {
        const v = p(c, r, W, H)
        if (v) return v
      }
    return null
  }

type BoxOpt = { roof?: Ramp; l?: Pat; r?: Pat; t?: Pat; glass?: boolean; edge?: boolean }

const hexRGB = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

/**
 * Depth-buffered pixel scene in footprint space around ground point (ox, oy).
 * Shapes are rasterised into a buffer; `flush()` paints it onto the canvas.
 * Glass goes into its own buffer and tints whatever solid lies behind it.
 */
export class Iso {
  readonly W: number
  readonly H: number
  private zb: Float32Array
  private cb: (string | null)[]
  private gz: Float32Array
  private gc: (string | null)[]
  constructor(
    readonly ctx: Ctx,
    readonly ox: number,
    readonly oy: number,
    readonly glassA = 0.34,
  ) {
    this.W = ctx.canvas.width
    this.H = ctx.canvas.height
    const n = this.W * this.H
    this.zb = new Float32Array(n).fill(-1e9)
    this.gz = new Float32Array(n).fill(-1e9)
    this.cb = new Array(n).fill(null)
    this.gc = new Array(n).fill(null)
  }
  X(u: number, v: number) {
    return this.ox + (u - v) * 16
  }
  Y(u: number, v: number, z = 0) {
    return this.oy + (u + v) * 8 - z
  }
  put(px: number, py: number, d: number, c: Paint, glass = false) {
    if (px < 0 || py < 0 || px >= this.W || py >= this.H) return
    const k = py * this.W + px
    const zb = glass ? this.gz : this.zb
    if (d < zb[k]) return
    zb[k] = d
    ;(glass ? this.gc : this.cb)[k] = typeof c === 'string' ? c : c(px, py)
  }
  pt(u: number, v: number, z: number, c: Paint, glass = false, bias = 0) {
    this.put(Math.floor(this.X(u, v)), Math.floor(this.Y(u, v, z)), u + v + z / 24 + bias, c, glass)
  }
  /** A light with a soft cross-shaped halo. */
  lamp(u: number, v: number, z: number, core: string, halo: string) {
    const px = Math.floor(this.X(u, v))
    const py = Math.floor(this.Y(u, v, z))
    const d = u + v + z / 24 + 0.06
    this.put(px - 1, py, d, halo)
    this.put(px + 1, py, d, halo)
    this.put(px, py - 1, d, halo)
    this.put(px, py + 1, d, halo)
    this.put(px, py, d + 0.01, core)
  }
  line(u0: number, v0: number, z0: number, u1: number, v1: number, z1: number, c: Paint, bias = 0) {
    const n = Math.ceil(Math.max(Math.abs(this.X(u1, v1) - this.X(u0, v0)), Math.abs(this.Y(u1, v1, z1) - this.Y(u0, v0, z0))) * 2) + 1
    for (let k = 0; k <= n; k++) {
      const f = k / n
      this.pt(u0 + (u1 - u0) * f, v0 + (v1 - v0) * f, z0 + (z1 - z0) * f, c, false, bias)
    }
  }
  /** A thin post (2 px: lit and shaded side) from z0 up to z1. */
  post(u: number, v: number, z0: number, z1: number, ramp: Ramp = M) {
    this.box(u - 1 / 32, u + 1 / 32, v - 1 / 32, v + 1 / 32, z0, z1, ramp, { l: () => ramp[3], r: () => ramp[1], t: () => ramp[4] })
  }
  /** An axis-aligned box: u0…u1 × v0…v1 × z0…z1. Patterns paint the lit (l), shaded (r) and top (t) faces. */
  box(u0: number, u1: number, v0: number, v1: number, z0: number, z1: number, ramp: Ramp, o: BoxOpt = {}) {
    const roof = o.roof ?? ramp
    const edge = o.edge !== false
    const g = !!o.glass
    if (z1 > z0) {
      // lit face, v = v1
      const xa = Math.round(this.X(u0, v1))
      const xb = Math.round(this.X(u1, v1))
      for (let px = xa; px < xb; px++) {
        const u = (px + 0.5 - this.ox) / 16 + v1
        const yb = this.oy + (u + v1) * 8
        const top = Math.round(yb - z1)
        const bot = Math.round(yb - z0) - 1
        const Hh = bot - top + 1
        for (let py = top; py <= bot; py++) {
          const c = px - xa
          const r = py - top
          let col: Paint | null | undefined = o.l?.(c, r, xb - xa, Hh)
          if (!col) col = edge && c === xb - xa - 1 ? ramp[4] : edge && py === bot && z0 < 0.5 ? ramp[0] : tone(ramp, 0.74 - 0.22 * (r / Math.max(1, Hh - 1)), px, py)
          this.put(px, py, u + v1 + (yb - py - 0.5) / 24, col, g)
        }
      }
      // shaded face, u = u1
      const xc = Math.round(this.X(u1, v1))
      const xd = Math.round(this.X(u1, v0))
      for (let px = xc; px < xd; px++) {
        const v = u1 - (px + 0.5 - this.ox) / 16
        const yb = this.oy + (u1 + v) * 8
        const top = Math.round(yb - z1)
        const bot = Math.round(yb - z0) - 1
        const Hh = bot - top + 1
        for (let py = top; py <= bot; py++) {
          const c = px - xc
          const r = py - top
          let col: Paint | null | undefined = o.r?.(c, r, xd - xc, Hh)
          if (!col) col = edge && c === 0 ? ramp[1] : edge && py === bot && z0 < 0.5 ? ramp[0] : tone(ramp, 0.4 - 0.18 * (r / Math.max(1, Hh - 1)) - 0.1 * (c / (xd - xc)), px, py)
          this.put(px, py, u1 + v + (yb - py - 0.5) / 24, col, g)
        }
      }
    }
    // top, z = z1
    const xa = Math.floor(this.X(u0, v1))
    const xb = Math.ceil(this.X(u1, v0))
    const ya = Math.floor(this.Y(u0, v0, z1))
    const yb = Math.ceil(this.Y(u1, v1, z1))
    const Wa = Math.round((u1 - u0) * 16)
    const Wb = Math.round((v1 - v0) * 16)
    for (let py = ya; py <= yb; py++)
      for (let px = xa; px <= xb; px++) {
        const sx = px + 0.5 - this.ox
        const sy = py + 0.5 - this.oy + z1
        const u = (sx / 16 + sy / 8) / 2
        const v = (sy / 8 - sx / 16) / 2
        if (u < u0 || u > u1 || v < v0 || v > v1) continue
        let col: Paint | null | undefined = o.t?.(Math.floor((u - u0) * 16), Math.floor((v - v0) * 16), Wa, Wb)
        if (!col)
          col =
            edge && (v1 - v) * 16 < 1
              ? roof[4]
              : edge && (u1 - u) * 16 < 1
                ? roof[2]
                : tone(roof, 0.92 - 0.3 * ((u - u0) / (u1 - u0 || 1) + (v - v0) / (v1 - v0 || 1)) / 2 - (sx > (u0 + u1 - v0 - v1) * 8 ? 0.06 : 0), px, py)
        this.put(px, py, u + v + z1 / 24, col, g)
      }
  }
  /** Upright cylinder at (uc, vc), screen radius rx px, from z0 to z1, with a lid. */
  vcyl(uc: number, vc: number, rx: number, z0: number, z1: number, ramp: Ramp, o: { lid?: Ramp | false; pat?: RoundPat; glass?: boolean; spec?: boolean } = {}) {
    const cx = Math.round(this.X(uc, vc))
    const cyB = this.Y(uc, vc, 0)
    const ry = rx / 2
    const rt = rx / PXT
    for (let dx = -rx; dx < rx; dx++) {
      const nx = (dx + 0.5) / rx
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx))
      const e = nz * ry
      const px = cx + dx
      const top = Math.round(cyB - z1 + e)
      const bot = Math.round(cyB - z0 + e) - 1
      const l = lightN((nx + nz) / SQ2, (nz - nx) / SQ2, 0)
      const dd = uc + vc + SQ2 * nz * rt
      for (let py = top; py <= bot; py++) {
        const r = py - top
        let col: Paint | null | undefined = o.pat?.(nx, r, bot - top + 1, l, px, py)
        if (!col) col = o.spec !== false && Math.abs(nx + 0.5) < 0.1 && r > 1 && r < bot - top - 1 ? ramp[4] : tone(ramp, l - (py >= bot - 1 && z0 < 0.5 ? 0.12 : 0), px, py)
        this.put(px, py, dd + (cyB + e - py - 0.5) / 24, col, o.glass)
      }
    }
    if (o.lid === false) return
    const L = o.lid ?? ramp
    const ly = Math.round(cyB - z1)
    const k = Math.ceil(ry)
    for (let dy = -k; dy <= k; dy++)
      for (let dx = -rx; dx < rx; dx++) {
        const q = ((dx + 0.5) / rx) ** 2 + ((dy + 0.5) / (ry + 0.25)) ** 2
        if (q > 1) continue
        const rim = q > 0.62 && dy >= 0
        const col = rim ? ramp[1] : tone(L, 0.92 - 0.3 * ((dx + rx) / (2 * rx)) + (dy < 0 ? 0.04 : -0.04), cx + dx, ly + dy)
        this.put(cx + dx, ly + dy, uc + vc + (dy + 0.5) / 8 + z1 / 24 + 0.01, col, o.glass)
      }
  }
  /**
   * Ellipsoid centred over (uc, vc) at height zc: screen radius rx px, vertical
   * semi-axis hz px. Parts below zc + cut are left off (cut 0 gives a dome).
   */
  ell(uc: number, vc: number, zc: number, rx: number, hz: number, ramp: Ramp, o: { cut?: number; pat?: (nu: number, nv: number, nz: number, l: number, px: number, py: number) => string | null | undefined; glass?: boolean; spec?: boolean } = {}) {
    const cx = this.X(uc, vc)
    const cy = this.Y(uc, vc, zc)
    const cut = o.cut ?? -1e9
    const A = 4 / (rx * rx) + 1 / (hz * hz)
    for (let py = Math.floor(cy - hz - rx / 2 - 1); py <= Math.ceil(cy + hz + rx / 2 + 1); py++)
      for (let px = Math.floor(cx - rx); px <= Math.ceil(cx + rx); px++) {
        const p = px + 0.5 - cx
        const Y = py + 0.5 - cy
        const B = (8 * Y) / (rx * rx)
        const C = (p * p + 4 * Y * Y) / (rx * rx) - 1
        const disc = B * B - 4 * A * C
        if (disc < 0) continue
        const z = (-B + Math.sqrt(disc)) / (2 * A)
        if (z < cut) continue
        const q = 2 * (Y + z)
        let np = p / (rx * rx)
        let nq = q / (rx * rx)
        let nz = z / (1.155 * hz * hz)
        const n = Math.hypot(np, nq, nz) || 1
        np /= n
        nq /= n
        nz /= n
        const nu = (np + nq) / SQ2
        const nv = (nq - np) / SQ2
        const l = lightN(nu, nv, nz)
        let col: Paint | null | undefined = o.pat?.(nu, nv, nz, l, px, py)
        if (!col) col = o.spec && l > 0.9 ? ramp[4] : tone(ramp, l, px, py)
        this.put(px, py, uc + vc + q / 16 + (zc + z) / 24, col, o.glass)
      }
  }
  /**
   * Horizontal cylinder along u or v, from a0 to a1, its axis at `c` on the
   * other axis and height zc; radius rad tiles. The end facing the viewer gets a cap.
   * pat gets s (px along the axis), th (0 = facing +other axis, π/2 = up) and the brightness.
   */
  hcyl(axis: 'u' | 'v', a0: number, a1: number, c: number, zc: number, rad: number, ramp: Ramp, o: { pat?: (s: number, th: number, l: number, px: number, py: number) => string | null | undefined; cap?: (rr: number, th: number, l: number) => string | null | undefined; glass?: boolean; upper?: boolean; ring?: number } = {}) {
    const rz = rad * KZ
    const nTh = Math.ceil(2 * Math.PI * Math.max(rz, rad * 16) * 2.5)
    const nS = Math.ceil((a1 - a0) * 40)
    for (let j = 0; j < nTh; j++) {
      const th = (j / nTh) * 2 * Math.PI
      const co = Math.cos(th)
      const si = Math.sin(th)
      const [nu, nv] = axis === 'u' ? [0, co] : [co, 0]
      if (nu * 0.612 + nv * 0.612 + si * 0.5 < -0.08) continue
      if (o.upper && si < -0.02) continue // a half-tube standing on the ground
      const l = lightN(nu, nv, si)
      for (let i = 0; i <= nS; i++) {
        const a = a0 + ((a1 - a0) * i) / nS
        const u = axis === 'u' ? a : c + rad * co
        const v = axis === 'u' ? c + rad * co : a
        const z = zc + rz * si
        const px = Math.floor(this.X(u, v))
        const py = Math.floor(this.Y(u, v, z))
        const col = o.pat?.((a - a0) * 16, th, l, px, py) ?? tone(ramp, l, px, py)
        this.put(px, py, u + v + z / 24, col, o.glass)
      }
    }
    // the end cap facing the viewer
    const nR = Math.ceil(Math.max(rz, rad * 16) * 2)
    const lc = axis === 'u' ? lightN(1, 0, 0) : lightN(0, 1, 0)
    for (let i = 0; i <= nR; i++)
      for (let j = 0; j < nTh; j++) {
        const rr = i / nR
        if (o.ring !== undefined && rr < o.ring) continue // an open ring, not a disc
        const th = (j / nTh) * 2 * Math.PI
        const u = axis === 'u' ? a1 : c + rad * rr * Math.cos(th)
        const v = axis === 'u' ? c + rad * rr * Math.cos(th) : a1
        const z = zc + rz * rr * Math.sin(th)
        if (o.upper && Math.sin(th) < -0.02) continue
        const px = Math.floor(this.X(u, v))
        const py = Math.floor(this.Y(u, v, z))
        const col = o.cap?.(rr, th, lc) ?? (rr > 0.86 ? ramp[axis === 'u' ? 1 : 3] : tone(ramp, lc + 0.08, px, py))
        this.put(px, py, u + v + z / 24, col, o.glass)
      }
  }
  /** Paint the buffers onto the canvas. */
  flush() {
    const a = this.glassA
    for (let k = 0; k < this.cb.length; k++) {
      const c = this.cb[k]
      const gc = this.gc[k]
      if (!c && !gc) continue
      const px = k % this.W
      const py = (k / this.W) | 0
      if (gc && this.gz[k] >= this.zb[k]) {
        const [gr, gg, gb] = hexRGB(gc)
        if (c) {
          const [r, g, b] = hexRGB(c)
          this.ctx.fillStyle = `rgb(${Math.round(r + (gr - r) * a)},${Math.round(g + (gg - g) * a)},${Math.round(b + (gb - b) * a)})`
        } else this.ctx.fillStyle = `rgba(${gr},${gg},${gb},0.6)`
        this.ctx.fillRect(px, py, 1, 1)
      } else if (c) rect(this.ctx, px, py, 1, 1, c)
    }
  }
}

/* ---------------------------- shared patterns --------------------------- */

/** Warm interior light. */
export const WARM: Ramp = ['#7a4a1c', '#c98a3a', '#ffcf7a', '#ffe3a3', '#fff0c0']
export const ALERT = RAMP.alert

/** A window with a dark frame and a warm glow. */
export const warmWin =
  (lit = true): Pat =>
  (c, r, w, h) => {
    if (c === 0 || r === 0 || c === w - 1 || r === h - 1) return INK
    if (!lit) return r < h / 2 ? CY[1] : CY[0]
    if (r === 1) return WARM[4]
    if (c === w >> 1 && w > 5) return WARM[1]
    return (c + r) % 4 === 0 ? WARM[3] : WARM[2]
  }
/** A cyan-glass window with a bright reflection. */
export const cyanWin: Pat = (c, r, w, h) => {
  if (c === 0 || r === 0 || c === w - 1 || r === h - 1) return INK
  if (c + r === 2 || c + r === 3) return GLOW
  return r < h / 2 ? CY[4] : CY[2]
}
/** A pressure door in a lit frame. `side` darkens it on a shaded face. */
export const litDoor =
  (frame: string = GLOW, side: 'l' | 'r' = 'l'): Pat =>
  (c, r, w, h) => {
    if (c === 0 || c === w - 1 || r === 0) return frame
    if (c === 1 || c === w - 2 || r === 1) return INK
    if (r === h - 1) return INK
    const mid = c === w >> 1
    if (mid) return INK
    if (r === 3 && (c === 2 || c === w - 3)) return side === 'l' ? CY[3] : CY[1]
    return side === 'l' ? (r % 5 === 4 ? M[2] : M[3]) : r % 5 === 4 ? M[1] : M[2]
  }
/** Diagonal hazard stripes. */
export const hazard: Pat = (c, r) => ((c + r) % 4 < 2 ? SG[4] : INK)
/** Shaded-face hazard stripes. */
export const hazardDim: Pat = (c, r) => ((c + r) % 4 < 2 ? SG[2] : INK)
/** Vertical panel seams every `p` columns, with rivets near the top and bottom. */
export const seams =
  (p: number, ramp: Ramp, side: 'l' | 'r'): Pat =>
  (c, r, _w, h) => {
    if (c % p === 0 && c > 0) return side === 'l' ? ramp[1] : ramp[0]
    if (c % p === 1 && c > 0 && (r === 1 || r === h - 3)) return side === 'l' ? ramp[4] : ramp[2]
    return null
  }
/** Horizontal armour bands of rust and gunmetal with bolt heads. */
export const armour =
  (period: number, side: 'l' | 'r'): Pat =>
  (c, r) => {
    const band = Math.floor(r / period) % 2
    if (r % period === 0) return INK
    if (c % 6 === 1 && r % period === 1) return band ? M[4] : R[4]
    if (side === 'l') return band ? M[2] : R[3]
    return band ? M[1] : R[1]
  }
/** Louvred vent. */
export const louvre = (side: 'l' | 'r'): Pat => (c, r, w, h) => (c === 0 || c === w - 1 || r === 0 || r === h - 1 ? INK : r % 2 ? INK : side === 'l' ? M[3] : M[2])
/** Grille of a ventilation unit (rows of slots). */
export const grille: Pat = (c, r) => ventPx(c, r) ?? M[1]
/** A tiny stencilled label: rows of light dashes on a dark plate. */
export const label =
  (seed: number, ink: string = INK, bg: string = SG[3]): Pat =>
  (c, r, w, h) => {
    if (r === 0 || r === h - 1 || c === 0 || c === w - 1) return bg
    return (seed >> (c % 12)) & 1 && r % 2 === 1 ? ink : bg
  }

/** A round fan grille on a roof (top-face pattern), cx/cy/rad in roof px. */
export const roofFan =
  (cx: number, cy: number, rad: number, t: number): Pat =>
  (a, b) => {
    const dx = a + 0.5 - cx
    const dy = b + 0.5 - cy
    const d = Math.hypot(dx, dy)
    if (d > rad + 0.5) return null
    if (d > rad - 0.7) return M[4]
    if (d < 1) return MH[4]
    const ang = Math.atan2(dy, dx) - t * 9
    return Math.abs(Math.sin(ang * 2)) > 0.8 ? M[3] : INK
  }

/* ------------------------- the expedition palette ------------------------ */

/** Off-white composite panels and pressure hulls: RAMP.hull lifted a step, so faces read white rather than grey. */
export const WH: Ramp = ['#77707f', '#a8a1ad', '#d3cdcd', '#efebe4', '#fdfbf6']
/** Neutral light grey: frames, struts, light structure. */
export const NE = RAMP.neutral
/** Safety orange: stripes, handrails, hatch frames. */
export const OR = RAMP.orange
/** Gold MLI foil. */
export const AU = RAMP.gold
/** Deep-blue solar cells. */
export const NV = RAMP.navy
/** Red-orange regolith dust. */
export const REG = RAMP.regolith
/** Woven sandbag cloth. */
export const BAG: Ramp = ['#6b4a3c', '#9c7a62', '#c4a585', '#dfc7a8', '#f1e4d0']
/** Webbing straps. */
export const STRAP = RAMP.stone
/** Pink-white LED grow light. */
export const PINK: Ramp = ['#4a1d3e', '#8a3270', '#cf5aa6', '#f39ad2', '#ffdcf1']
/** Status lamps: [core, halo] when on, and the unlit lens. */
export const LAMP = {
  red: ['#ff5a48', '#8f2f3f'],
  green: ['#7dff8a', '#2f7a3a'],
  amber: ['#ffc65a', '#a0601c'],
  redOff: '#5a2226',
  greenOff: '#24452c',
  amberOff: '#5a4220',
} as const
const OFF = { red: LAMP.redOff, green: LAMP.greenOff, amber: LAMP.amberOff }
/** Stencil ink on white panels. */
const STEN = '#4a4450'
const STEN_D = '#38333e'
/** Dark slot in a vent. */
const SLOT = '#2f2b36'

const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16)
/** Ordered-dither threshold (0–1) at a pixel. */
export const bay = (x: number, y: number) => BAY[(y & 3) * 4 + (x & 3)]
/** A stable pseudo-random number (0–1) for a pixel. */
export const hash = (x: number, y: number) => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * Regolith dust at height fraction hf (0 = ground, 1 = top) on pixel (x, y) of
 * brightness l, or null above the dust line `frac`. It thickens toward the ground.
 */
export function dustPx(hf: number, frac: number, x: number, y: number, l: number) {
  const f = 1 - hf / frac
  if (f <= 0) return null
  if (f * f * 1.25 < bay(x, y) * 0.8 + hash(x, y) * 0.3) return null
  return tone(REG, l * 0.8 + (f > 0.75 ? 0.02 : 0.12), x + 1, y)
}
/** Dust creeping up the bottom `frac` of a box face. */
export const dust =
  (side: 'l' | 'r' = 'l', frac = 0.28): Pat =>
  (c, r, _w, h) =>
    dustPx(1 - (r + 0.5) / h, frac, c * 3 + r, r * 5 + c, side === 'l' ? 0.72 : 0.42)
/** Composite panel joints: every p columns, plus an optional row j (no rivets). */
export const panels =
  (p: number, side: 'l' | 'r', j = -1): Pat =>
  (c, r) =>
    (c > 0 && c % p === 0) || r === j ? (side === 'l' ? WH[1] : WH[0]) : null
/** A safety-orange stripe. */
export const orange = (side: 'l' | 'r' = 'l') => (side === 'l' ? OR[2] : OR[1])
/** Stencilled lettering: two rows of dashes in dark grey, nothing in between. */
export const stencil =
  (seed: number, side: 'l' | 'r' = 'l'): Pat =>
  (c, r) =>
    (r === 0 || r === 2) && (seed >> c % 12) & 1 ? (side === 'l' ? STEN : STEN_D) : null
/**
 * A rounded-rectangle pressure hatch: orange frame, a dark gasket, an off-white
 * door with a small round porthole (warm-lit, or dark) and a latch handle.
 */
export const hatch =
  (side: 'l' | 'r' = 'l', lit = true): Pat =>
  (c, r, w, h) => {
    const ex = Math.min(c, w - 1 - c)
    const ey = Math.min(r, h - 1 - r)
    if (ex + ey === 0) return null
    if (ex === 0 || ey === 0 || (ex === 1 && ey === 1)) return side === 'l' ? OR[3] : OR[1]
    if (ex === 1 || ey === 1) return INK
    const dx = c - (w - 1) / 2
    const dy = r - 3.5
    if (w >= 6 && h >= 9 && Math.abs(dx) < 1.6 && Math.abs(dy) < 1.6) {
      if (Math.abs(dx) + Math.abs(dy) > 2.2) return side === 'l' ? WH[2] : WH[1]
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) return INK
      return lit ? (dy < 0 ? WARM[4] : WARM[2]) : dy < 0 ? NV[3] : NV[1]
    }
    if (r === Math.round(h * 0.62) && ex === 2) return side === 'l' ? NE[1] : INK
    if (side === 'l') return ex === 2 ? WH[4] : (c + r) % 7 === 0 ? WH[2] : WH[3]
    return ex === 2 ? WH[2] : WH[1]
  }
/** A window with a light frame and warm interior light, or dark glass when unlit. */
export const winW =
  (side: 'l' | 'r' = 'l', lit = true): Pat =>
  (c, r, w, h) => {
    if (c === 0 || r === 0 || c === w - 1 || r === h - 1) return side === 'l' ? NE[2] : NE[1]
    if (!lit) return r === 1 ? NV[3] : NV[1]
    if (r === 1) return WARM[4]
    return (c + r) % 4 === 0 ? WARM[3] : WARM[2]
  }
/** A louvred vent in a white panel. */
export const vent =
  (side: 'l' | 'r' = 'l'): Pat =>
  (c, r, w, h) =>
    c === 0 || c === w - 1 || r === 0 || r === h - 1 ? (side === 'l' ? WH[2] : WH[1]) : r % 2 ? SLOT : side === 'l' ? WH[3] : WH[2]
/** Radiator panel: fine vertical coolant tubes. */
export const radiator =
  (side: 'l' | 'r' = 'l'): Pat =>
  (c, r, _w, h) =>
    r === 0 || r === h - 1 ? NE[side === 'l' ? 2 : 1] : c % 2 ? WH[side === 'l' ? 4 : 2] : WH[side === 'l' ? 2 : 1]
/** Dark solar cells in a light frame, for a top face. */
export const solarTop: Pat = (a, b, w, h) => {
  if (a === 0 || b === 0 || a === w - 1 || b === h - 1) return NE[2]
  if (a % 5 === 0 || b % 4 === 0) return NV[3]
  return (a + b) % 9 === 0 ? NV[4] : (a * 3 + b) % 11 === 0 ? NV[2] : NV[1]
}
/** A round intake fan in a white housing, for a top face. */
export const fanTop =
  (cx: number, cy: number, rad: number, t: number): Pat =>
  (a, b) => {
    const dx = a + 0.5 - cx
    const dy = b + 0.5 - cy
    const d = Math.hypot(dx, dy)
    if (d > rad + 0.5) return null
    if (d > rad - 0.7) return NE[2]
    if (d < 1) return NE[4]
    const ang = Math.atan2(dy, dx) - t * 9
    return Math.abs(Math.sin(ang * 2)) > 0.8 ? NE[3] : SLOT
  }
/** Crinkled gold MLI foil at brightness l. */
export const foil = (l: number, x: number, y: number) => {
  const n = hash(x >> 1, y)
  if (n > 0.9 && l > 0.42) return AU[4]
  if (n < 0.08) return AU[1]
  return tone(AU, l + (n - 0.5) * 0.3, x, y)
}

/** A sagging umbilical hose from a to b (u, v, z), light grey with orange end collars. */
export function hose(s: Iso, a: readonly [number, number, number], b: readonly [number, number, number], sag = 3, ramp: Ramp = NE) {
  const n = 48
  for (let k = 0; k <= n; k++) {
    const f = k / n
    const u = a[0] + (b[0] - a[0]) * f
    const v = a[1] + (b[1] - a[1]) * f
    const z = a[2] + (b[2] - a[2]) * f - sag * 4 * f * (1 - f)
    const collar = f < 0.06 || f > 0.94
    s.pt(u, v, z + 1, collar ? OR[3] : ramp[3])
    s.pt(u, v, z, collar ? OR[1] : ramp[1])
  }
}
/** A tiny sprite placed at (u, v, z) in the depth buffer, anchored at its bottom row, column ax. */
export function sprite(s: Iso, u: number, v: number, z: number, rows: readonly string[], pal: Record<string, string>, ax: number) {
  const px0 = Math.floor(s.X(u, v)) - ax
  const py0 = Math.floor(s.Y(u, v, z)) - rows.length + 1
  const d = u + v + z / 24 + 0.05
  rows.forEach((row, j) => [...row].forEach((ch, i) => pal[ch] && s.put(px0 + i, py0 + j, d, pal[ch])))
}
/** A blinking lamp: red or green or amber, on while `on`. */
export function status(s: Iso, u: number, v: number, z: number, col: 'red' | 'green' | 'amber', on: boolean) {
  const [core, halo] = LAMP[col]
  if (on) s.lamp(u, v, z, core, halo)
  else s.pt(u, v, z, OFF[col], false, 0.06)
}

/* --------------------------------- MOXIE -------------------------------- */

/**
 * MOXIE oxygen plant (2×2): a white solid-oxide electrolysis unit whose
 * inspection window shows the ceramic cell stack glowing orange-hot, a CO₂
 * intake fan on its roof and a vent; two gold-foil oxygen spheres on cradles
 * behind it, fed by umbilical hoses through a pump skid with status lamps.
 * Upgrades add a third sphere, then a radiator wing.
 */
export function moxie(ctx: Ctx, x: number, y: number, t: number) {
  const tier = getTier()
  const g = plinth(ctx, x, y, 2, 2, 5)
  const s = new Iso(ctx, x, g)
  const pulse = (Math.sin(t * Math.PI * 2) + 1) / 2

  // radiator wing at the back (level 3)
  if (tier >= 3) {
    s.box(-0.95, -0.15, -0.97, -0.91, 6, 30, WH, { l: all(at(1, 1, 99, 22, radiator('l')), at(0, 0, 99, 1, OR[3])), r: () => NE[1], roof: NE })
    for (const u of [-0.85, -0.25]) s.post(u, -0.94, 0, 6, NE)
  }

  // gold-foil oxygen spheres on light cradles
  const spheres: [number, number, number][] = [
    [-0.48, -0.52, 9],
    [0.42, -0.58, 9],
  ]
  if (tier >= 2) spheres.push([0.72, 0.06, 6])
  for (const [u, v, r] of spheres) {
    const hz = Math.round(r * 0.87)
    const zc = hz + 3
    const k = (r / PXT) * 0.6
    for (const [du, dv] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ])
      s.post(u + du * k, v + dv * k, 0, zc - 2, NE)
    s.ell(u, v, zc, r, hz, AU, {
      pat: (_nu, _nv, nz, l, px, py) => (Math.abs(nz) < 0.09 ? (l > 0.5 ? WH[4] : WH[2]) : foil(l, px, py)),
    })
    // fill valve on top
    s.post(u, v, zc + hz - 1, zc + hz + 2, NE)
    s.pt(u, v, zc + hz + 3, OR[3])
  }

  // umbilicals: from the unit and the skid to the spheres
  hose(s, [-0.05, 0.3, 6], [0.3, 0.55, 6], 2)
  hose(s, [0.55, 0.48, 6], [0.45, -0.3, 4], 2)
  hose(s, [-0.4, 0.05, 9], [-0.4, -0.2, 5], 1)

  // the electrolysis unit
  const UH = 18
  const hot: Pat = (c, r, w, h) => {
    if (c === 0 || r === 0 || c === w - 1 || r === h - 1) return NE[2]
    if (c === 1 || r === 1 || c === w - 2 || r === h - 2) return INK
    if (r % 2 === 0) return '#5a160e'
    const flick = (c * 3 + r + Math.floor(t * 4)) % 7 === 0
    if (flick) return '#fff0c0'
    return pulse > 0.6 ? OR[4] : (c + r) % 3 === 0 ? OR[4] : OR[3]
  }
  s.box(-0.95, -0.05, 0.0, 0.95, 0, UH, WH, {
    roof: WH,
    l: all(dust('l'), at(1, 5, 9, 9, hot), at(0, 2, 99, 2, orange('l')), at(10, 6, 4, 3, stencil(0b1011011, 'l')), panels(7, 'l')),
    r: all(dust('r'), at(2, 5, 6, 11, hatch('r')), at(9, 5, 5, 6, vent('r')), at(0, 2, 99, 2, orange('r')), at(9, 12, 5, 3, stencil(0b11011, 'r'))),
    t: all(fanTop(7, 7.5, 5, t), (a, b) => (a === 0 || b === 0 ? WH[4] : null)),
  })
  // exhaust vent and a whip antenna with a beacon
  s.vcyl(-0.84, 0.86, 2, UH, UH + 6, NE, { lid: [INK, INK, INK, INK, INK] })
  s.line(-0.86, 0.12, UH, -0.86, 0.12, UH + 13, NE[3])
  status(s, -0.86, 0.12, UH + 14, 'red', (t * 1.5) % 1 < 0.4)

  // the pump skid in front, with an orange handrail and status lamps
  const KH = 9
  s.box(0.25, 0.95, 0.45, 0.95, 0, KH, WH, {
    roof: NE,
    l: all(dust('l', 0.35), at(1, 2, 5, 4, cyanWin), at(7, 2, 3, 3, stencil(0b101, 'l')), at(0, KH - 1, 99, 1, orange('l'))),
    r: all(dust('r', 0.35), at(1, 2, 6, 5, vent('r'))),
    t: (a, b) => (a === 3 || b === 3 ? NE[2] : null),
  })
  s.line(0.25, 0.95, KH + 3, 0.95, 0.95, KH + 3, OR[3])
  s.line(0.95, 0.45, KH + 3, 0.95, 0.95, KH + 3, OR[2])
  for (const [u, v] of [
    [0.27, 0.95],
    [0.95, 0.95],
    [0.95, 0.47],
  ])
    s.line(u, v, KH, u, v, KH + 3, OR[2])
  status(s, 0.5, 0.6, KH + 1.5, 'green', true)
  status(s, 0.7, 0.6, KH + 1.5, 'amber', pulse > 0.75)
  s.flush()
  puffs(ctx, Math.round(s.X(-0.84, 0.86)), Math.round(s.Y(-0.84, 0.86, UH + 7)), t, STEAM)
}

/* -------------------------------- habitat ------------------------------- */

/** An EVA suit seen from the front: white, gold visor, orange chest panel. 5×10. */
export const SUIT = ['.hhh.', 'hvvvs', '.hhs.', 'wwwws', 'wokws', 'wwwws', '.wws.', '.w.s.', '.w.s.', '.d.d.']

/**
 * Habitat (3×3): a big white inflatable dome, its fabric gores sewn with seam
 * lines and held down by a web of restraint straps with orange buckles, ringed
 * with sandbag ballast, warm light in its windows. A rigid ribbed airlock
 * juts out to the lit side with a round hatch and red/green lamps, and two EVA
 * suits hang on a rack beside it. Level 2 adds an inflatable sleeping tunnel
 * on the right; level 3 a lit crown cupola and a radiator wing.
 */
export function bigHabitat(ctx: Ctx, x: number, y: number, t: number) {
  const tier = getTier()
  const g = plinth(ctx, x, y, 3, 3, 6)
  const s = new Iso(ctx, x, g)
  const blink = (t * 1.5) % 1 < 0.4

  const DU = -0.3
  const DV = -0.3
  const DR = 26
  const DZ = 6
  const DH = 31
  const near = (a: number, step: number, off: number) => {
    const q = (a - off) / step
    return Math.abs(q - Math.round(q)) * step
  }

  // radiator wing (level 3), standing at the back-right
  if (tier >= 3) {
    s.box(0.45, 1.3, -1.42, -1.36, 4, 30, WH, { l: all(at(1, 1, 99, 24, radiator('l')), at(0, 0, 99, 1, OR[3])), r: () => NE[1], roof: NE })
    for (const u of [0.55, 1.2]) s.post(u, -1.39, 0, 4, NE)
  }

  // the inflatable dome
  const wins = [-0.12, 0.5, 1.08, 1.68]
  s.ell(DU, DV, DZ, DR, DH, WH, {
    cut: -DZ,
    pat: (nu, nv, nz, l, px, py) => {
      const az = Math.atan2(nv, nu)
      const ca = Math.sqrt(Math.max(0, 1 - nz * nz))
      const dd = dustPx(Math.max(0, nz + 0.18), 0.3, px, py, l)
      if (dd) return dd
      // windows on a band round the front
      if (nz > 0.2 && nz < 0.42)
        for (const w of wins) {
          const dx = Math.abs(az - w) * ca * DR
          if (dx < 2.8) return dx > 1.9 || nz < 0.24 || nz > 0.38 ? NE[1] : nz > 0.34 ? WARM[4] : (px + py) % 3 === 0 ? WARM[3] : WARM[2]
        }
      const strap = near(az, Math.PI / 2, Math.PI / 4) * ca * DR < 1.05 && nz < 0.95
      const belt = Math.abs(nz - 0.48) < 0.03 || Math.abs(nz - 0.82) < 0.025
      if (strap && belt) return l > 0.5 ? OR[3] : OR[2]
      if (strap || belt) return l > 0.55 ? STRAP[3] : STRAP[2]
      if (near(az, Math.PI / 8, 0) * ca * DR < 0.45 && nz < 0.9) return tone(WH, l - 0.2, px, py)
      if (l > 0.94) return WH[4]
      // gores bulge a little between seams
      const q = az / (Math.PI / 8)
      return tone(WH, l + 0.07 * Math.sin((q - Math.floor(q)) * Math.PI) - 0.02, px, py)
    },
  })
  // crown ring with a cupola (lit at level 3), an antenna and a beacon
  const top = DZ + DH
  const CR = tier >= 3 ? 8 : 6
  s.vcyl(DU, DV, CR, top - 3, top + (tier >= 3 ? 5 : 1), NE, {
    lid: WH,
    pat: (nx, r, H, l, px, py) => {
      if (tier >= 3 && r >= 2 && r <= H - 3) return Math.round(nx * 4) % 2 === 0 ? NE[1] : r === 2 ? WARM[4] : WARM[2]
      if (r === H - 2) return OR[l > 0.5 ? 3 : 1]
      return tone(NE, l + 0.1, px, py)
    },
  })
  const ctop = top + (tier >= 3 ? 5 : 1)
  s.line(DU + 0.12, DV - 0.05, ctop, DU + 0.12, DV - 0.05, ctop + 12, NE[3])
  status(s, DU + 0.12, DV - 0.05, ctop + 13, 'red', blink)
  s.ell(DU - 0.15, DV + 0.1, ctop + 3, 4, 2, WH, { spec: true })
  s.post(DU - 0.15, DV + 0.1, ctop, ctop + 2, NE)

  // sandbag ballast round the base, two courses
  const BR = DR / PXT + 0.13
  const bag = (u: number, v: number, z: number) =>
    s.ell(u, v, z, 4, 2.6, BAG, {
      cut: -z,
      pat: (_nu, _nv, nz, l, px, py) => (hash(px, py) < 0.45 - nz * 0.3 ? tone(REG, l, px, py) : tone(BAG, l + 0.05, px, py)),
    })
  for (let k = 0; k < 28; k++) {
    for (const layer of [0, 1]) {
      const a = ((k + layer * 0.5) / 28) * Math.PI * 2
      const u = DU + Math.cos(a) * (BR - layer * 0.05)
      const v = DV + Math.sin(a) * (BR - layer * 0.05)
      if (Math.abs(u) > 1.4 || Math.abs(v) > 1.4) continue
      if (Math.abs(u - 0.5) < 0.42 && v > 0.2) continue // the airlock
      if (tier >= 2 && Math.abs(v + 0.45) < 0.5 && u > 0.3) continue // the tunnel
      bag(u, v, 2 + layer * 3.5)
    }
  }

  // rigid airlock module along +v, ribbed, with a round hatch at its end
  const AR = 0.34
  const AZ = 1.5 + AR * KZ
  s.hcyl('v', 0.25, 1.36, 0.5, AZ, AR, WH, {
    pat: (s0, th, l, px, py) => {
      const dd = dustPx((1 + Math.sin(th)) / 2, 0.3, px, py, l)
      if (dd) return dd
      if (s0 > 5 && Math.round(s0) % 5 === 0) return tone(WH, l - 0.28, px, py)
      if (Math.abs(th - 0.62) < 0.08 && s0 > 6 && s0 < 22) return OR[l > 0.5 ? 3 : 2]
      if (Math.abs(th - 1.57) < 0.1 && s0 > 8 && s0 < 15) return NE[1]
      return null
    },
    cap: (rr, th, l) => {
      if (rr > 0.9) return WH[1]
      if (rr > 0.72) return OR[3]
      if (rr > 0.64) return INK
      if (rr < 0.3) return Math.sin(th) > 0 ? WARM[4] : WARM[2]
      if (rr < 0.38) return INK
      return l > 0.6 ? WH[4] : WH[3]
    },
  })
  for (const v of [0.85, 1.25]) s.box(0.3, 0.7, v - 0.05, v + 0.05, 0, 3, NE, { edge: false })
  status(s, 0.5 - 0.46, 1.38, AZ + 3, 'green', true)
  status(s, 0.5 + 0.46, 1.38, AZ + 3, 'red', blink)
  s.lamp(0.5, 1.2, AZ + AR * KZ + 1.5, WARM[4], WARM[2])

  // EVA suit rack beside the airlock
  for (const v of [0.72, 1.4]) s.post(1.18, v, 0, 13, NE)
  s.line(1.18, 0.72, 13, 1.18, 1.4, 13, NE[3])
  const pal: Record<string, string> = { h: WH[4], s: WH[2], v: AU[3], w: WH[3], o: OR[3], k: NE[1], d: NE[1] }
  for (const v of [0.86, 1.24]) sprite(s, 1.2, v, 1, SUIT, pal, 2)

  // inflatable sleeping tunnel (level 2), with strap hoops and a rigid end bulkhead
  if (tier >= 2) {
    const TR = 0.4
    s.hcyl('u', 0.35, 1.36, -0.45, 1 + TR * KZ, TR, WH, {
      pat: (s0, th, l, px, py) => {
        const dd = dustPx((1 + Math.sin(th)) / 2, 0.3, px, py, l)
        if (dd) return dd
        if (Math.abs(((s0 + 3) % 7) - 3.5) < 0.6) return l > 0.55 ? STRAP[3] : STRAP[2]
        if (Math.abs(th - 1.2) < 0.18 && Math.round(s0) % 7 === 3) return WARM[3]
        return tone(WH, l + 0.06 * Math.sin(((s0 + 3) % 7) / 7 * Math.PI), px, py)
      },
      cap: (rr, th) => (rr > 0.86 ? NE[1] : rr < 0.32 && Math.sin(th) > -0.2 ? WARM[3] : rr < 0.4 ? INK : NE[3]),
    })
  }
  s.flush()
}

/* ---------------------------- regolith shield --------------------------- */

/** One sandbag course: bags 6 px long and 4 px tall, staggered, dustier toward the ground. */
const bags =
  (course: number, side: 'l' | 'r'): Pat =>
  (c, r) => {
    const cc = (c + (course % 2) * 3) % 6
    const lit = side === 'l'
    if (cc === 5) return lit ? REG[1] : REG[0]
    if (r === 3) return lit ? BAG[1] : BAG[0]
    if (r === 0) return cc === 0 || cc === 4 ? (lit ? BAG[3] : BAG[1]) : lit ? BAG[4] : BAG[2]
    const v = (lit ? 0.72 : 0.42) - (r - 1) * 0.1 - (cc === 0 || cc === 4 ? 0.1 : 0)
    const dusty = [0.8, 0.5, 0.25, 0.1, 0.05][course] ?? 0
    const px = c * 3 + course * 7
    const py = r * 5 + course
    if (hash(px, py) < dusty + (r === 2 ? 0.15 : 0)) return tone(REG, v + 0.05, px, py)
    if (cc === 2 && r === 1) return lit ? BAG[2] : BAG[0] // the tie
    return tone(BAG, v, px, py)
  }

/**
 * Regolith shield (2×2): a stepped berm of sandbags, the lower courses caked
 * in red dust, under a packed regolith crown. A white storm-shelter portal with
 * an orange hatch leads in; on the crown a space-weather siren mast carries a
 * stack light (green when all is calm) under an orange beacon, beside a
 * radiation sign and a vent. Level 2 lays white water bladders on the crown;
 * level 3 adds a solar panel and a dosimeter dome.
 */
export function berm(ctx: Ctx, x: number, y: number, t: number) {
  const tier = getTier()
  const g = plinth(ctx, x, y, 2, 2, 3)
  const s = new Iso(ctx, x, g)
  const COURSES = 5
  for (let k = 0; k < COURSES; k++) {
    const e = 0.92 - k * 0.13
    s.box(-e, e, -e, e, k * 4, k * 4 + 4, BAG, { l: bags(k, 'l'), r: bags(k, 'r'), roof: REG })
  }
  // packed crown
  const top = COURSES * 4
  s.ell(0, 0, top, 12, 5, REG, {
    cut: 0,
    pat: (_nu, _nv, _nz, l, px, py) => ((px * 3 + py * 7) % 11 === 0 ? REG[1] : hash(px, py) > 0.94 ? STRAP[3] : tone(REG, l + 0.1, px, py)),
  })

  // the shelter portal
  const PH = 14
  s.box(-0.62, -0.08, 0.6, 1.0, 0, PH, WH, {
    roof: NE,
    l: all(at(1, 2, 7, 11, hatch('l')), dust('l', 0.3), at(0, 0, 99, 1, OR[3])),
    r: all(dust('r', 0.3), panels(3, 'r')),
    t: (a) => (a % 3 === 0 ? NE[2] : null),
  })
  status(s, -0.6, 1.0, PH + 1.5, 'green', true)
  status(s, -0.1, 1.0, PH + 1.5, 'red', false)

  // vent through the crown
  s.vcyl(0.42, -0.32, 2, top - 4, top + 7, WH, { lid: [INK, INK, INK, INK, INK], pat: (_nx, r) => (r === 1 ? OR[2] : null) })

  // water bladders on the crown (level 2+)
  if (tier >= 2)
    for (const v of [0.12, 0.42]) {
      const BR2 = 0.13
      s.hcyl('u', -0.35, 0.3, v, top + 2 + BR2 * KZ, BR2, WH, {
        pat: (s0, th, l, px, py) => (Math.abs(s0 - 3) < 0.6 || Math.abs(s0 - 8) < 0.6 ? OR[l > 0.5 ? 3 : 1] : Math.abs(th - 1.4) < 0.2 && s0 > 4 && s0 < 7 ? STEN : tone(WH, l, px, py)),
      })
    }

  // space-weather siren mast: stack light under an orange beacon, a dosimeter box
  const MU = -0.36
  const MV = -0.42
  s.post(MU, MV, top, top + 16, NE)
  s.box(MU - 0.12, MU + 0.12, MV - 0.06, MV + 0.12, top + 6, top + 10, WH, { l: (c, r) => (r === 1 && c > 0 && c < 3 ? LAMP.green[0] : null), roof: NE })
  const stack: ['green' | 'amber' | 'red', boolean][] = [
    ['green', true],
    ['amber', false],
    ['red', false],
  ]
  stack.forEach(([col, on], k) => {
    const z = top + 17 + k * 2
    s.box(MU - 0.06, MU + 0.06, MV - 0.06, MV + 0.06, z, z + 2, NE, { l: () => (on ? LAMP[col][0] : OFF[col]), r: () => (on ? LAMP[col][1] : OFF[col]), t: () => NE[3] })
  })
  const spin = Math.floor(t * 4) % 2 === 0
  s.box(MU - 0.08, MU + 0.08, MV - 0.08, MV + 0.08, top + 23, top + 25, OR, { l: () => (spin ? OR[4] : OR[2]), r: () => (spin ? OR[2] : OR[3]), t: () => OR[4] })

  // level 3: a solar panel feeding the siren, and a dosimeter dome
  if (tier >= 3) {
    s.post(0.15, -0.6, top - 2, top + 6, NE)
    s.box(-0.1, 0.5, -0.82, -0.4, top + 6, top + 7, NE, { t: solarTop, l: () => NE[2], r: () => NE[1] })
    s.ell(0.3, 0.32, top + 2, 5, 4, WH, { cut: 0, spec: true, pat: (_nu, _nv, nz, l) => (nz < 0.2 ? OR[2] : l > 0.93 ? WH[4] : null) })
  }
  s.flush()
  // radiation sign on the crown
  const sx = Math.round(s.X(0.42, 0.18))
  const sy = Math.round(s.Y(0.42, 0.18, top))
  signboard(ctx, sx, sy - 11, 7, 6, sy, trefoil(7, 6))
}

/* ------------------------------ greenhouse ------------------------------ */

/**
 * Greenhouse (4×3): a long inflatable growing hall, translucent fabric between
 * white arch ribs, its feet ballasted with sandbags. Inside, tiered racks of
 * plants under pink-white LED strips flood the whole hall with a pink glow. A
 * rigid airlock vestibule closes the front end; insulated water tanks stand at
 * the back. `dim` (night or no power) turns the lights off and greys the skin.
 * Level 2 adds a side airlock; level 3 gold-foil tanks and a lit ridge.
 */
export function bigGreenhouse(ctx: Ctx, x: number, y: number, t: number, dim: boolean) {
  const tier = getTier()
  const g = plinth(ctx, x, y, 4, 3, 5)
  const s = new Iso(ctx, x, g, dim ? 0.55 : 0.36)
  const L = 1.8
  const RR = 1.3
  const KW = 3
  const Z = 36
  const lit = !dim
  const SKIN: Ramp = dim ? ['#5d5a63', '#7f7b85', '#a29ea6', '#c3c0c4', '#dedbdc'] : ['#9a4f86', '#c46fac', '#e597cc', '#f6bfe0', '#ffe4f3']
  const leaf: Ramp = dim ? ['#2e2c1e', '#454229', '#5f5c36', '#7a7646', '#959058'] : RAMP.leaf
  const vh = (v: number) => Z * Math.sqrt(Math.max(0, 1 - (v / RR) ** 2))

  // water tanks behind the back end
  for (const v of [-0.65, 0.65])
    s.vcyl(-1.88, v, 6, 0, 18, tier >= 3 ? AU : WH, {
      lid: NE,
      pat: (_nx, r, H, l, px, py) => {
        if (r === 3 || r === 4) return OR[l > 0.5 ? 3 : 1]
        if (tier >= 3) return r > H - 4 ? tone(NE, l, px, py) : foil(l, px, py)
        return dustPx(1 - r / H, 0.28, px, py, l)
      },
    })

  // white base ring
  s.box(-L, L, -RR, RR, 0, KW, WH, { l: all(dust('l', 0.7), panels(12, 'l')), r: all(dust('r', 0.7), panels(12, 'r')) })
  // floor: a grated walkway down the middle, catching the pink light
  for (let u = -L + 0.04; u <= L - 0.04; u += 1 / 32)
    for (let v = -RR + 0.06; v <= RR - 0.06; v += 1 / 32) {
      const walk = Math.abs(v) < 0.16
      const c: Paint = (px, py) => (lit && hash(px, py) < (walk ? 0.3 : 0.15) ? PINK[3] : tone(NE, walk ? (dim ? 0.3 : 0.62) : dim ? 0.2 : 0.42, px, py))
      s.pt(u, v, KW + 0.5, c)
    }

  // racks: shelves of plants, each shelf lit from the one above
  const racks = [-0.92, -0.42, 0.42, 0.92]
  for (const rv of racks) {
    const zs: number[] = []
    for (let z = KW + 2; z < KW + vh(rv) - 7; z += 7) zs.push(z)
    for (let u = -L + 0.15; u <= L - 0.1; u += 0.45) s.post(u, rv + 0.1, KW, zs[zs.length - 1] + 6, NE)
    zs.forEach((z, i) => {
      s.box(-L + 0.12, L - 0.12, rv - 0.11, rv + 0.11, z, z + 1, NE, { edge: false, l: () => (dim ? NE[1] : NE[2]), t: (a) => (a % 3 ? NE[1] : NE[2]) })
      // plants
      for (let u = -L + 0.18; u <= L - 0.18; u += 0.085) {
        const seed = hash(Math.round(u * 100), Math.round(rv * 100) + i * 31)
        const h = (dim ? 2 : 3) + Math.floor(seed * 3)
        for (let dz = 0; dz <= h; dz += 0.5)
          for (let dv = -0.09; dv <= 0.09; dv += 1 / 32) {
            if (Math.abs(dv) > 0.09 * (1 - (dz / (h + 1)) * 0.6)) continue
            const pink = lit && dz >= h - 0.5 && hash(Math.round(u * 97 + dv * 50), i) < 0.35
            s.pt(u, rv + dv, z + 1.5 + dz, pink ? PINK[4] : (px, py) => tone(leaf, 0.3 + (dz / h) * 0.5 + (dv > 0 ? 0.12 : 0), px, py))
          }
      }
      // the LED strip above this shelf
      const zl = i + 1 < zs.length ? zs[i + 1] - 0.5 : z + 6
      s.line(-L + 0.16, rv, zl, L - 0.16, rv, zl, lit ? ((t * 2 + i * 0.3) % 1 < 0.9 ? PINK[4] : PINK[3]) : NE[1], 0.02)
      if (lit) s.line(-L + 0.16, rv + 0.06, zl - 0.6, L - 0.16, rv + 0.06, zl - 0.6, PINK[2], 0.01)
    })
  }

  // the fabric vault: translucent skin between white arch ribs
  const RIB = 0.45
  for (let u = -L; u <= L + 1e-6; u += 1 / 56)
    for (let a = 0; a <= Math.PI; a += Math.PI / 240) {
      const v = RR * Math.cos(a)
      const z = KW + Z * Math.sin(a)
      const ribQ = (u + L) / RIB
      const rib = Math.abs(ribQ - Math.round(ribQ)) * RIB < 1 / 40
      const sun = 0.5 + 0.45 * Math.cos(a - 0.7)
      if (rib) s.pt(u, v, z, (px, py) => tone(WH, 0.35 + sun * 0.6, px, py))
      else if (Math.abs(a - Math.PI / 2) < 0.012 || Math.abs(a - 0.55) < 0.01 || Math.abs(a - Math.PI + 0.55) < 0.01) s.pt(u, v, z, (px, py) => tone(NE, 0.4 + sun * 0.5, px, py))
      else {
        const seam = Math.abs(((a / (Math.PI / 7)) % 1) - 0.5) > 0.46
        const glint = lit && a > 0.35 && a < 1.3 && (((u * 0.8 + a * 1.4) % 1.3) + 1.3) % 1.3 < 0.06
        s.pt(u, v, z, glint ? '#ffffff' : (px, py) => tone(SKIN, (dim ? 0.15 : 0.4) + sun * 0.45 - (seam ? 0.2 : 0), px, py), true)
      }
    }
  // end walls: skin with a light frame
  for (const end of [-L, L])
    for (let v = -RR; v <= RR; v += 1 / 56) {
      const top = vh(v)
      for (let z = 0; z <= top; z += 0.5) {
        if (end > 0 && Math.abs(v) < 0.42 && z < 18) continue // the vestibule
        if (top - z < 1.2 || Math.abs(Math.abs(v) - 0.65) < 0.02 || Math.abs(v) < 0.02) s.pt(end, v, KW + z, end > 0 ? WH[2] : WH[3])
        else s.pt(end, v, KW + z, (px, py) => tone(SKIN, dim ? 0.2 : 0.6, px, py), true)
      }
    }
  // sandbags along the lit side at every rib foot
  for (let u = -L; u <= L + 1e-6; u += RIB / 2) {
    if (tier >= 2 && Math.abs(u) < 0.45) continue
    s.ell(u, RR + 0.1, 2, 4, 2.4, BAG, { cut: -2, pat: (_nu, _nv, nz, l, px, py) => (hash(px, py) < 0.5 - nz * 0.3 ? tone(REG, l, px, py) : tone(BAG, l + 0.05, px, py)) })
  }

  // the airlock vestibule on the front end
  const VH = 19
  s.box(L - 0.12, L + 0.16, -0.42, 0.42, 0, VH, WH, {
    roof: NE,
    l: all(dust('l'), at(0, 2, 99, 2, orange('l'))),
    r: all(dust('r'), at(2, 5, 9, 13, hatch('r', lit)), at(0, 2, 99, 2, orange('r')), at(11, 6, 2, 3, stencil(0b101, 'r'))),
    t: (a) => (a % 3 === 0 ? NE[2] : null),
  })
  status(s, L + 0.16, -0.36, VH - 4, 'green', lit)
  status(s, L + 0.16, 0.36, VH - 4, 'red', dim && (t * 1.5) % 1 < 0.4)
  s.lamp(L + 0.16, 0, VH + 1.5, lit ? WARM[4] : NE[2], lit ? WARM[2] : NE[1])

  // a side airlock on the lit flank (level 2+)
  if (tier >= 2) {
    s.box(-0.32, 0.32, RR - 0.25, RR + 0.18, 0, 16, WH, {
      roof: NE,
      l: all(dust('l'), at(2, 3, 7, 12, hatch('l', lit)), at(0, 1, 99, 1, OR[3])),
      r: all(dust('r'), at(0, 1, 99, 1, OR[1])),
    })
    status(s, 0.3, RR + 0.18, 15, 'green', lit)
  }
  // a lit ridge walkway (level 3)
  if (tier >= 3) {
    s.box(-L + 0.2, L - 0.2, -0.07, 0.07, KW + Z, KW + Z + 1, NE, { t: (a) => (a % 2 ? NE[3] : NE[1]) })
    for (let u = -L + 0.3; u <= L - 0.3; u += 0.6) status(s, u, 0, KW + Z + 2.5, 'amber', lit)
  }
  s.flush()
}
