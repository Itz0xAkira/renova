/**
 * Life support: the MOXIE oxygen plant, habitat, regolith shield and greenhouse.
 *
 * Each function draws one building on ground point (x, y), the centre of its
 * footprint. A w×h footprint spans ±(w+h)·8 px across and ±(w+h)·4 px down.
 * `t` is animation time; frame 0 (t = 0) doubles as the idle pose.
 *
 * The buildings are modelled in footprint space with the small z-buffered
 * renderer below (`Iso`): u runs down-right, v down-left (both in tiles from
 * the footprint centre), z up in px. Left (+v) faces are lit, right (+u) faces
 * shaded. base.ts uses the same renderer for the core and the lab.
 */
import { rect, type Ctx } from '@/site/pixel/engine'
import { getTier, GLOW, INK, plinth, RAMP, signboard, tone, trefoil, ventPx, type Ramp } from '@/game/art/pixel'
import { antennas, puffs, M, MH, R, S, CY, SG, SOIL, STEAM } from '@/game/art/buildings/kit'

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
  hcyl(axis: 'u' | 'v', a0: number, a1: number, c: number, zc: number, rad: number, ramp: Ramp, o: { pat?: (s: number, th: number, l: number, px: number, py: number) => string | null | undefined; cap?: (rr: number, th: number, l: number) => string | null | undefined } = {}) {
    const rz = rad * KZ
    const nTh = Math.ceil(2 * Math.PI * Math.max(rz, rad * 16) * 2.5)
    const nS = Math.ceil((a1 - a0) * 40)
    for (let j = 0; j < nTh; j++) {
      const th = (j / nTh) * 2 * Math.PI
      const co = Math.cos(th)
      const si = Math.sin(th)
      const [nu, nv] = axis === 'u' ? [0, co] : [co, 0]
      if (nu * 0.612 + nv * 0.612 + si * 0.5 < -0.08) continue
      const l = lightN(nu, nv, si)
      for (let i = 0; i <= nS; i++) {
        const a = a0 + ((a1 - a0) * i) / nS
        const u = axis === 'u' ? a : c + rad * co
        const v = axis === 'u' ? c + rad * co : a
        const z = zc + rz * si
        const px = Math.floor(this.X(u, v))
        const py = Math.floor(this.Y(u, v, z))
        const col = o.pat?.((a - a0) * 16, th, l, px, py) ?? tone(ramp, l, px, py)
        this.put(px, py, u + v + z / 24, col)
      }
    }
    // the end cap facing the viewer
    const nR = Math.ceil(Math.max(rz, rad * 16) * 2)
    const lc = axis === 'u' ? lightN(1, 0, 0) : lightN(0, 1, 0)
    for (let i = 0; i <= nR; i++)
      for (let j = 0; j < nTh; j++) {
        const rr = i / nR
        const th = (j / nTh) * 2 * Math.PI
        const u = axis === 'u' ? a1 : c + rad * rr * Math.cos(th)
        const v = axis === 'u' ? c + rad * rr * Math.cos(th) : a1
        const z = zc + rz * rr * Math.sin(th)
        const px = Math.floor(this.X(u, v))
        const py = Math.floor(this.Y(u, v, z))
        const col = o.cap?.(rr, th, lc) ?? (rr > 0.86 ? ramp[axis === 'u' ? 1 : 3] : tone(ramp, lc + 0.08, px, py))
        this.put(px, py, u + v + z / 24, col)
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

/* --------------------------------- MOXIE -------------------------------- */

/**
 * MOXIE oxygen plant (2×2): the tall solid-oxide electrolysis column at the
 * back with a glowing core window, white O₂ storage tanks along the right, a
 * sand-coloured compressor house with a roof fan on the left, and a pump skid
 * with the manifold in front. Upgrades add a third tank, then roof radiators.
 */
export function moxie(ctx: Ctx, x: number, y: number, t: number) {
  const tier = getTier()
  const g = plinth(ctx, x, y, 2, 2, 5)
  const s = new Iso(ctx, x, g)
  const pulse = (Math.sin(t * Math.PI * 2) + 1) / 2
  const N = RAMP.neutral

  // electrolysis column (back): gunmetal with a rust base, a ladder and a glowing core window
  const colH = 31
  s.vcyl(-0.5, -0.42, 9, 0, colH, M, {
    lid: MH,
    pat: (nx, r, H, l, px, py) => {
      if (r >= H - 5) return r === H - 5 ? INK : tone(R, l + 0.1, px, py)
      if (r === 4 || r === 18) return M[0]
      if (r >= 7 && r <= 14) {
        if (r === 7 || r === 14 || Math.abs(nx) > 0.85) return INK
        if (Math.round(nx * 6) % 3 === 0) return M[1]
        const hot = (r + Math.round(nx * 5) + Math.floor(t * 4)) % 5 === 0
        return hot ? GLOW : l > 0.5 ? CY[4] : pulse > 0.5 ? CY[3] : CY[2]
      }
      // ladder on the lit side
      if (nx > -0.72 && nx < -0.5 && r > 2 && r < H - 5) return Math.abs(nx + 0.61) > 0.07 ? M[4] : r % 3 === 0 ? MH[3] : null
      return null
    },
  })
  // top cap: a domed head with the feed pipe and a status lamp
  s.ell(-0.5, -0.42, colH, 7, 4, MH, { cut: 0, spec: true })
  s.post(-0.5, -0.42, colH + 3, colH + 8, M)
  s.lamp(-0.5, -0.42, colH + 10, (t * 2) % 1 < 0.5 ? RAMP.veg[4] : RAMP.veg[1], RAMP.veg[0])
  // railing ring round the cap
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2
    const u = -0.5 + Math.cos(a) * 0.43
    const v = -0.42 + Math.sin(a) * 0.43
    s.pt(u, v, colH + 4, M[3])
    if (k % 4 === 0) s.line(u, v, colH, u, v, colH + 4, M[2])
  }

  // O₂ storage tanks (right), white with cyan bands, domed heads
  const tanks: [number, number, number, number][] = [
    [0.12, -0.66, 6, 24],
    [0.64, -0.66, 6, 21],
  ]
  if (tier >= 2) tanks.push([0.68, -0.13, 5, 16])
  for (const [u, v, rx, h] of tanks) {
    s.vcyl(u, v, rx, 1, h, N, {
      lid: false,
      pat: (nx, r, H, l, px, py) => {
        if (r >= 5 && r <= 7) return r === 6 && Math.abs(nx + 0.2) < 0.35 ? (l > 0.5 ? INK : M[1]) : tone(CY, l + 0.15, px, py)
        if (r === H - 3) return M[1]
        if (r > H - 3) return tone(M, l, px, py)
        if (tier >= 3 && r === 10 && nx < 0.3) return GLOW
        return null
      },
    })
    s.ell(u, v, h, rx, 3, N, { cut: 0, spec: true })
    s.lamp(u, v, h + 3.5, Math.floor(t * 4 + u * 3) % 4 === 0 ? ALERT[4] : ALERT[1], ALERT[0])
    // a saddle ring and feet
    s.box(u - 0.2, u + 0.2, v - 0.2, v + 0.2, 0, 1.5, M, { edge: false })
  }
  // gas manifold: pipes from the column to the tanks
  for (let k = 0; k < 3; k++) {
    const z = 4 + k * 0.5
    s.line(-0.15, -0.6 + k * 0.02, z, 0.64, -0.6 + k * 0.02, z, k === 0 ? MH[3] : k === 1 ? MH[2] : M[1])
  }
  s.box(0.3, 0.42, -0.52, -0.4, 0, 7, SG, {})

  // compressor house (left): ribbed sand container with a roof fan
  const ch = 14
  s.box(-0.92, -0.12, 0.08, 0.92, 0, ch, S, {
    l: all(at(3, 3, 9, 7, louvre('l')), at(15, 2, 6, 8, litDoor(WARM[3])), at(0, ch - 2, 99, 2, hazard), (c) => (c % 3 === 0 ? S[2] : null)),
    r: all(at(3, 3, 7, 5, louvre('r')), (c) => (c % 3 === 0 ? S[0] : null)),
    t: all(roofFan(6.5, 7, 4.5, t), (a, b) => (a === 0 || b === 0 ? S[4] : null)),
  })
  // exhaust stack with steam
  s.vcyl(-0.82, 0.22, 2, ch, ch + 9, M, { lid: [INK, INK, INK, INK, INK] })
  if (tier >= 3)
    // roof radiators: a row of fins along the back
    for (let k = 0; k < 5; k++) s.box(-0.85 + k * 0.13, -0.8 + k * 0.13, 0.62, 0.86, ch, ch + 5, MH, { t: () => CY[3] })

  // pump skid in front: armoured box, gauge panel, valve wheel
  s.box(0.12, 0.88, 0.14, 0.9, 0, 10, M, {
    roof: MH,
    l: all(at(2, 2, 6, 5, cyanWin), at(10, 1, 3, 7, louvre('l')), at(0, 8, 99, 2, hazard), seams(5, M, 'l')),
    r: all(at(2, 2, 8, 4, label(0b101101110110)), at(11, 2, 3, 6, louvre('r')), seams(5, M, 'r')),
    t: (a, b) => (a === 3 || b === 3 ? M[2] : null),
  })
  // O₂ header pipe across the skid and up to the tanks
  s.line(0.2, 0.2, 12, 0.2, -0.45, 12, MH[3])
  s.line(0.2, 0.2, 11, 0.2, -0.45, 11, M[1])
  s.line(0.2, -0.45, 4, 0.2, -0.45, 12, MH[2])
  s.lamp(0.86, 0.88, 12, (t * 2 + 0.5) % 1 < 0.5 ? GLOW : CY[2], CY[1])
  s.flush()
  // steam from the stack
  puffs(ctx, Math.round(s.X(-0.82, 0.22)), Math.round(s.Y(-0.82, 0.22, ch + 10)), t, STEAM)
}

/* -------------------------------- habitat ------------------------------- */

/**
 * Habitat (3×3): a three-storey round tower at the back with warm-lit window
 * bands and a domed roof, two horizontal crew modules with portholes along the
 * left and right edges, and an armoured airlock node at the front corner where
 * they meet. Level 2 stacks a sleeping module on the left wing; level 3 a
 * second on the right wing, plus solar trim on the node.
 */
export function bigHabitat(ctx: Ctx, x: number, y: number, t: number) {
  const tier = getTier()
  const g = plinth(ctx, x, y, 3, 3, 6)
  const s = new Iso(ctx, x, g)
  const blink = (t * 1.5) % 1 < 0.4

  // the tower
  const TU = -0.66
  const TV = -0.66
  const TH = 40
  s.vcyl(TU, TV, 17, 0, TH, M, {
    lid: MH,
    pat: (nx, r, H, l, px, py) => {
      const fromBot = H - 1 - r
      if (fromBot < 5) return fromBot === 4 ? INK : Math.round(nx * 9) % 3 === 0 && fromBot === 2 ? R[4] : tone(R, l + 0.08, px, py)
      if (r === 0) return MH[3]
      // two floors of windows
      for (const w0 of [5, 18]) {
        if (r >= w0 && r < w0 + 6) {
          const seg = Math.round((nx + 1) * 5.5)
          const frame = r === w0 || r === w0 + 5 || Math.abs((nx + 1) * 5.5 - seg) < 0.18
          if (frame || Math.abs(nx) > 0.9) return INK
          if (w0 === 18 && seg === 3) return l > 0.45 ? CY[4] : CY[2]
          return r === w0 + 1 ? WARM[4] : (seg + r) % 5 === 0 ? WARM[3] : WARM[2]
        }
      }
      if (r === 12 || r === 13 || r === 25 || r === 26) return r % 13 === 12 ? M[1] : tone(MH, l, px, py)
      if (r === 30 && Math.round(nx * 10) % 2 === 0) return SG[3]
      // ladder
      if (nx > -0.82 && nx < -0.62 && r > 1) return Math.abs(nx + 0.72) > 0.07 ? M[4] : r % 3 === 0 ? MH[3] : null
      return null
    },
  })
  // domed roof with a skylight ring and a catwalk railing
  s.ell(TU, TV, TH, 15, 8, MH, {
    cut: 0,
    spec: true,
    pat: (_nu, _nv, nz, l) => (nz > 0.55 && nz < 0.68 ? (l > 0.6 ? GLOW : CY[3]) : null),
  })
  for (let k = 0; k < 40; k++) {
    const a = (k / 40) * Math.PI * 2
    const u = TU + Math.cos(a) * 0.78
    const v = TV + Math.sin(a) * 0.78
    s.pt(u, v, TH + 4, M[3])
    if (k % 4 === 0) s.line(u, v, TH, u, v, TH + 4, M[2])
  }

  // horizontal crew modules on saddles
  const rad = 0.44
  const zc = 2 + rad * KZ
  const porthole = (s0: number, th: number, l: number, px: number, py: number, lit: boolean) => {
    const ring = Math.abs(Math.round(s0 / 10) * 10 - s0)
    if (ring < 0.7 && s0 > 3) return M[1]
    if (th > 3.7 && th < 5.75) return tone(R, l + 0.05, px, py) // rust belly
    const win = Math.abs(((s0 + 5) % 10) - 5)
    if (win < 2.4 && th > 0.3 && th < 1.0) return win > 1.7 || th < 0.4 || th > 0.9 ? INK : lit ? (th > 0.75 ? WARM[4] : (px + py) % 3 === 0 ? WARM[3] : WARM[2]) : CY[3]
    if (Math.abs(th - 1.57) < 0.12) return MH[3] // top seam
    return null
  }
  // left wing along u, at v = +0.88
  s.hcyl('u', -1.36, 0.6, 0.94, zc, rad, MH, { pat: (s0, th, l, px, py) => porthole(s0, th, l, px, py, true) })
  // right wing along v, at u = +0.94
  s.hcyl('v', -1.36, 0.6, 0.94, zc, rad, MH, { pat: (s0, th, l, px, py) => porthole(s0, th, l, px, py, true) })
  for (const a of [-1.15, -0.45]) {
    s.box(a - 0.06, a + 0.06, 0.62, 1.26, 0, 3, M, { edge: false })
    s.box(0.62, 1.26, a - 0.06, a + 0.06, 0, 3, M, { edge: false })
  }

  // stacked modules on the wings, their ends closed by round hatches
  const hatchCap = (rr: number, th: number, l: number) => (rr > 0.86 ? M[1] : rr > 0.5 && rr < 0.62 ? INK : rr < 0.5 && Math.abs(Math.sin(th)) < 0.15 ? M[4] : rr < 0.5 ? tone(M, l + 0.2, 0, 0) : MH[l > 0.5 ? 3 : 1])
  const z2 = zc + rad * KZ + 1 + 0.32 * KZ
  if (tier >= 2) {
    s.hcyl('u', -1.2, 0.2, 0.94, z2, 0.32, MH, { pat: (s0, th, l, px, py) => (Math.abs(th - 1.57) < 0.15 ? CY[3] : porthole(s0, th, l, px, py, true)), cap: hatchCap })
    s.box(-0.95, -0.8, 0.86, 1.02, zc + rad * KZ - 1, z2 - 4, M)
    s.box(-0.1, 0.05, 0.86, 1.02, zc + rad * KZ - 1, z2 - 4, M)
  }
  if (tier >= 3) {
    s.hcyl('v', -1.2, 0.2, 0.94, z2, 0.32, MH, { pat: (s0, th, l, px, py) => (Math.abs(th - 1.57) < 0.15 ? CY[3] : porthole(s0, th, l, px, py, true)), cap: hatchCap })
    s.box(0.86, 1.02, -0.95, -0.8, zc + rad * KZ - 1, z2 - 4, M)
    s.box(0.86, 1.02, -0.1, 0.05, zc + rad * KZ - 1, z2 - 4, M)
  }

  // airlock node at the front corner
  const NH = 22
  s.box(0.42, 1.4, 0.42, 1.4, 0, NH, M, {
    roof: MH,
    l: all(at(5, 5, 8, 15, litDoor(WARM[3])), at(4, 4, 10, 1, SG[4]), at(16, 4, 9, 5, warmWin()), at(16, 11, 9, 2, label(0b110110101101)), at(0, NH - 2, 99, 2, hazard), at(0, 0, 99, 3, armour(3, 'l')), seams(8, M, 'l')),
    r: all(at(4, 5, 8, 15, litDoor(GLOW, 'r')), at(3, 4, 10, 1, CY[4]), at(15, 5, 6, 4, cyanWin), at(0, NH - 2, 99, 2, hazardDim), at(0, 0, 99, 3, armour(3, 'r')), seams(8, M, 'r')),
    t: (a, b) => (a > 5 && a < 11 && b > 5 && b < 11 ? (a === 6 || b === 6 || a === 10 || b === 10 ? INK : M[2]) : (a + b) % 8 === 0 ? MH[1] : null),
  })
  // entry steps in front of both doors
  s.box(0.66, 0.9, 1.38, 1.46, 0, 2, M, { roof: SG })
  s.box(1.38, 1.46, 0.6, 0.86, 0, 2, M, { roof: SG })
  // floodlights on the node corners
  s.lamp(1.36, 1.36, NH + 2, WARM[4], WARM[2])
  s.lamp(0.42, 1.36, NH + 2, blink ? ALERT[4] : ALERT[0], ALERT[1])
  if (tier >= 3)
    // solar trim on the node roof
    s.box(0.5, 1.26, 0.5, 1.26, NH, NH + 1.5, M, { t: (a, b) => (a % 4 === 0 || b % 4 === 0 ? MH[2] : (a + b) % 7 === 0 ? CY[4] : CY[1]) })
  s.flush()
  // roof antennas and dish over the tower
  antennas(ctx, Math.round(s.X(TU, TV)) - 3, Math.round(s.Y(TU, TV, TH + 7)), t)
  rect(ctx, Math.round(s.X(TU, TV)) - 3, Math.round(s.Y(TU, TV, TH + 7)) - 13, 1, 1, blink ? ALERT[4] : ALERT[0])
}

/* ---------------------------- regolith shield --------------------------- */

/** One sandbag course pattern: bags 6 px long and 4 px tall, staggered. */
const bags =
  (course: number, side: 'l' | 'r' | 't'): Pat =>
  (c, r) => {
    const off = (course % 2) * 3
    const cc = (c + off) % 6
    const lift = side === 'l' ? 0.1 : side === 'r' ? -0.22 : 0.25
    if (side === 't') return null
    if (cc === 5) return side === 'l' ? R[0] : SOIL[1]
    if (r === 0) return side === 'l' ? S[4] : S[2]
    if (r === 3) return side === 'l' ? R[1] : SOIL[2]
    const v = 0.55 + lift - (r - 1) * 0.12 - (cc === 0 || cc === 4 ? 0.12 : 0)
    return tone(cc % 2 ? S : R, v + 0.2, c * 3 + course, r * 5 + course)
  }

/**
 * Regolith shield (2×2): a low stepped berm of regolith-filled sandbags with a
 * packed crown, a steel-framed shelter hatch with a lit frame on the lit face,
 * a radiation sign on the crown and a dosimeter mast. Upgrades add rust armour
 * plates along the base, then a glowing sensor dome.
 */
export function berm(ctx: Ctx, x: number, y: number, t: number) {
  const tier = getTier()
  const g = plinth(ctx, x, y, 2, 2, 3)
  const s = new Iso(ctx, x, g)
  const COURSES = 5
  for (let k = 0; k < COURSES; k++) {
    const e = 0.92 - k * 0.13
    s.box(-e, e, -e, e, k * 4, k * 4 + 4, S, {
      l: bags(k, 'l'),
      r: bags(k, 'r'),
      t: (a, b) => {
        const ledge = Math.min(Math.round(2 * e * 16) - 1 - a, Math.round(2 * e * 16) - 1 - b)
        if (ledge > 2 && k < COURSES - 1) return null
        return (a * 7 + b * 3 + k) % 9 === 0 ? R[1] : null
      },
      roof: S,
    })
  }
  // packed crown
  const top = COURSES * 4
  s.ell(0, 0, top, 12, 5, S, {
    cut: 0,
    pat: (_nu, _nv, _nz, l, px, py) => ((px * 3 + py * 7) % 11 === 0 ? R[1] : tone(S, l + 0.12, px, py)),
  })
  // armour plates (level 2+) round the base
  if (tier >= 2) {
    s.box(-0.97, 0.97, 0.9, 0.97, 0, 6, R, { l: armour(3, 'l'), t: () => M[3] })
    s.box(0.9, 0.97, -0.97, 0.97, 0, 6, R, { r: armour(3, 'r'), t: () => M[2] })
  }
  // shelter hatch: a steel portal in the lit face with a lit frame and hazard sill
  s.box(-0.62, -0.08, 0.6, 0.99, 0, 13, M, {
    roof: MH,
    l: all(at(2, 2, 6, 10, litDoor(GLOW)), at(0, 12, 99, 1, SG[4]), seams(9, M, 'l')),
    r: seams(3, M, 'r'),
    t: (a) => (a % 3 === 0 ? MH[2] : null),
  })
  s.box(-0.62, -0.08, 0.99, 1.0, 10, 11, SG, { l: hazard, edge: false })
  s.lamp(-0.13, 0.99, 14, (t * 2) % 1 < 0.5 ? GLOW : CY[2], CY[1])
  // vent pipe through the crown
  s.vcyl(0.38, -0.3, 2, top - 4, top + 7, MH, { lid: [INK, INK, INK, INK, INK] })
  s.box(0.32, 0.44, -0.36, -0.24, top + 7, top + 8, M)
  // dosimeter mast with a blinking light
  s.post(-0.35, -0.4, top, top + 14, M)
  s.lamp(-0.35, -0.4, top + 15, (t * 1.5) % 1 < 0.4 ? ALERT[4] : ALERT[0], ALERT[1])
  if (tier >= 3) {
    s.ell(0.28, 0.32, top + 2, 5, 4, CY, { cut: 0, spec: true, pat: (_nu, _nv, nz, l) => (nz > 0.9 ? GLOW : l > 0.6 ? CY[4] : null) })
    s.box(0.18, 0.38, 0.22, 0.42, top - 1, top + 2, M)
  }
  s.flush()
  // radiation sign on the crown
  const sx = Math.round(s.X(0.4, 0.2))
  const sy = Math.round(s.Y(0.4, 0.2, top))
  signboard(ctx, sx, sy - 11, 7, 6, sy, trefoil(7, 6))
}

/* ------------------------------ greenhouse ------------------------------ */

/**
 * Greenhouse (4×3): a long geodesic vault — a triangulated steel lattice with
 * rust joints over cyan glass — on an armoured knee wall, with four rows of
 * crops in soil troughs either side of a lit walkway, hanging grow lights, an
 * airlock vestibule on the front end and water tanks at the back. `dim` (night
 * or no power) greys the glass, wilts the crops and turns the lights off.
 * Level 2 adds a crest catwalk with vents; level 3 a geodesic cupola.
 */
export function bigGreenhouse(ctx: Ctx, x: number, y: number, t: number, dim: boolean) {
  const tier = getTier()
  const g = plinth(ctx, x, y, 4, 3, 5)
  const s = new Iso(ctx, x, g, dim ? 0.45 : 0.4)
  const L = 1.8
  const RR = 1.32
  const KW = 4 // knee-wall height
  const Z = 34 // vault height above the knee wall
  const GL: Ramp = dim ? RAMP.neutral : CY
  const leaf: Ramp = dim ? ['#3d3420', '#5e5028', '#8a7638', '#b09a4c', '#cfbb6c'] : RAMP.veg
  const leaf2: Ramp = dim ? ['#3a3220', '#564a26', '#7a6a34', '#9a8844', '#b8a75e'] : RAMP.leaf

  // water tanks behind the back end
  for (const v of [-0.7, 0.7]) {
    s.vcyl(-1.86, v, 6, 0, 16, MH, { lid: M, pat: (_nx, r) => (r === 4 || r === 11 ? CY[2] : null) })
  }
  // knee wall
  s.box(-L, L, -RR, RR, 0, KW, M, { roof: MH, l: all(armour(4, 'l'), seams(12, M, 'l')), r: all(armour(4, 'r'), seams(12, M, 'r')), t: () => null })
  // floor: walkway and soil troughs
  const rows = [-0.92, -0.38, 0.38, 0.92]
  for (let u = -L + 0.04; u <= L - 0.04; u += 1 / 32)
    for (let v = -RR + 0.06; v <= RR - 0.06; v += 1 / 32) {
      const bed = rows.some((rv) => Math.abs(v - rv) < 0.17)
      const rim = rows.some((rv) => Math.abs(Math.abs(v - rv) - 0.19) < 0.03)
      const walk = Math.abs(v) < 0.12
      let c: Paint
      if (bed) c = (px, py) => tone(SOIL, 0.55, px, py)
      else if (rim) c = M[3]
      else if (walk) c = !dim && Math.round(u * 8) % 3 === 0 && Math.abs(v) < 0.03 ? GLOW : (px, py) => tone(MH, dim ? 0.3 : 0.6, px, py)
      else c = dim ? M[1] : M[3]
      s.pt(u, v, KW + (bed ? 2 : rim ? 3 : 0.5), c)
    }
  // crops: tall tomato vines on the outer rows, low lettuce on the inner rows
  for (const rv of rows) {
    const outer = Math.abs(rv) > 0.6
    for (let u = -L + 0.14; u <= L - 0.14; u += outer ? 0.16 : 0.11) {
      const seed = Math.sin(u * 37 + rv * 11)
      const hgt = outer ? (dim ? 6 : 9) + Math.floor(((seed + 1) / 2) * 4) : (dim ? 2 : 4) + Math.floor(((seed + 1) / 2) * 2)
      const wid = outer ? 0.1 : 0.13
      for (let z = 0; z <= hgt; z += 0.5)
        for (let dv = -wid; dv <= wid; dv += 1 / 32)
          for (const du of [-0.04, 0, 0.04]) {
            const k = 1 - (z / (hgt + 1)) * (outer ? 0.3 : 0.9)
            if (Math.abs(dv) > wid * k) continue
            const fruit = !dim && outer && (Math.floor(z) % 3 === 1) && Math.abs(dv) < 0.04 && seed > -0.2 && du === 0
            const ramp = outer ? leaf : leaf2
            s.pt(u + du, rv + dv, KW + 2 + z, fruit ? RAMP.alert[2] : (px, py) => tone(ramp, 0.25 + (z / hgt) * 0.55 + (dv > 0 ? 0.12 : 0), px, py))
          }
      if (outer) s.line(u, rv, KW + 2, u, rv, KW + 2 + hgt + 2, M[3], -0.01) // stake
    }
  }
  // hanging grow lights over each row
  for (const rv of rows)
    for (let u = -L + 0.3; u <= L - 0.25; u += 0.5) {
      const zl = KW + Z * Math.sqrt(Math.max(0, 1 - (rv / RR) ** 2)) - 6
      s.line(u, rv, zl, u, rv, zl + 4, M[2])
      s.line(u - 0.08, rv, zl, u + 0.08, rv, zl, dim ? M[2] : (t * 2 + u) % 1 < 0.8 ? RAMP.alert[4] : RAMP.alert[3])
    }

  // the lattice vault
  const ROWS = 6
  for (let u = -L; u <= L; u += 1 / 56)
    for (let a = 0; a <= Math.PI; a += Math.PI / 220) {
      const v = RR * Math.cos(a)
      const z = KW + Z * Math.sin(a)
      const sN = (u + L) / 0.5
      const q = (a / Math.PI) * ROWS
      const fq = q - Math.round(q)
      const d1 = sN + q / 2
      const d2 = sN - q / 2
      const f1 = d1 - Math.round(d1)
      const f2 = d2 - Math.round(d2)
      const lat = Math.abs(fq) < 0.06
      const diag = Math.abs(f1) < 0.04 || Math.abs(f2) < 0.04
      const node = lat && (Math.abs(f1) < 0.08 || Math.abs(f2) < 0.08)
      const lit = 0.5 + 0.45 * Math.cos(a - 0.7)
      if (node) s.pt(u, v, z, lit > 0.6 ? R[4] : R[2])
      else if (lat || diag || a < 0.03 || a > Math.PI - 0.03) s.pt(u, v, z, (px, py) => tone(M, 0.25 + lit * 0.5, px, py))
      else {
        const streak = (((u * 0.8 + a * 1.4) % 1.3) + 1.3) % 1.3
        const glint = !dim && a > 0.3 && a < 1.6 && streak < 0.12
        s.pt(u, v, z, glint ? GLOW : (px, py) => tone(GL, dim ? 0.02 + lit * 0.3 : 0.68 + lit * 0.4, px, py), true)
      }
    }
  // end walls: lattice and glass, the front one with an airlock frame
  for (const end of [-L, L])
    for (let v = -RR; v <= RR; v += 1 / 56) {
      const top = Z * Math.sqrt(Math.max(0, 1 - (v / RR) ** 2))
      for (let z = 0; z <= top; z += 0.5) {
        const edge = top - z < 1.2
        if (end > 0 && Math.abs(v) < 0.3 && z < 16) continue // vestibule covers it
        if (edge || Math.abs(v) < 0.02 || Math.abs(Math.abs(v) - 0.65) < 0.02 || Math.abs(z - top / 2) < 0.5) s.pt(end, v, KW + z, M[2])
        else s.pt(end, v, KW + z, (px, py) => tone(GL, dim ? 0.15 : 0.7, px, py), true)
      }
    }
  // airlock vestibule on the front end
  s.box(L - 0.1, L + 0.12, -0.36, 0.36, 0, 18, M, {
    roof: MH,
    l: all(at(0, 0, 99, 3, armour(3, 'l')), seams(4, M, 'l')),
    r: all(at(2, 4, 8, 13, litDoor(dim ? M[3] : GLOW, 'r')), at(1, 3, 10, 1, dim ? M[2] : CY[4]), at(0, 16, 99, 2, hazardDim), seams(11, M, 'r')),
    t: (a) => (a % 3 === 0 ? MH[2] : null),
  })
  s.lamp(L + 0.12, 0.36, 19, dim ? ALERT[1] : (t * 2) % 1 < 0.5 ? GLOW : CY[2], dim ? ALERT[0] : CY[1])
  // ridge catwalk with roof vents (level 2+)
  if (tier >= 2) {
    s.box(-L + 0.1, L - 0.1, -0.08, 0.08, KW + Z, KW + Z + 1, M, { t: (a) => (a % 2 ? M[3] : M[1]) })
    for (let u = -L + 0.1; u <= L - 0.1; u += 1 / 16) s.pt(u, 0.09, KW + Z + 3, M[3])
    for (let u = -L + 0.1; u <= L - 0.1; u += 0.25) s.line(u, 0.09, KW + Z + 1, u, 0.09, KW + Z + 3, M[2])
    for (const u of [-1.2, 1.2]) s.box(u - 0.12, u + 0.12, -0.12, 0.12, KW + Z, KW + Z + 3, MH, { roof: M, l: (c, r) => (r === 1 ? INK : null), r: (c, r) => (r === 1 ? INK : null) })
  }
  // geodesic cupola on the crest (level 3)
  if (tier >= 3)
    s.ell(0, 0, KW + Z - 2, 12, 9, GL, {
      cut: 0,
      pat: (nu, nv, nz, l, px, py) => {
        const ring = Math.acos(Math.min(1, nz)) / (Math.PI / 2)
        const k = Math.floor(ring * 3)
        const a = (Math.atan2(nv, nu) / Math.PI) * (5 - k) + (k % 2) * 0.5
        if (Math.abs(ring * 3 - Math.round(ring * 3)) < 0.1 || (ring > 0.2 && Math.abs(a - Math.round(a)) < 0.07)) return l > 0.55 ? M[4] : M[2]
        if (nz > 0.97) return M[3]
        return dim ? tone(RAMP.neutral, l * 0.35, px, py) : tone(CY, 0.3 + l * 0.7, px, py)
      },
    })
  s.flush()
}
