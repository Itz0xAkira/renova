/**
 * RENOVA pixel toolkit: hue-shifted material ramps, light-shaded primitives
 * (boxes, domes, cylinders) with ordered dithering, and small details
 * (windows, lights, pipes, vents, stripes). Light comes from the upper left.
 */
import { rect, type Ctx } from '@/site/pixel/engine'

/** Five tones, darkest → lightest. Shadows lean violet/cool, highlights warm. */
export type Ramp = readonly [string, string, string, string, string]

export const RAMP = {
  hull: ['#5b5265', '#8c8496', '#bab3bd', '#e2dcd6', '#fbf8f1'],
  steel: ['#272c3a', '#454d5f', '#687284', '#8f9aaa', '#c0c9d3'],
  navy: ['#10182a', '#1b283e', '#2a3b58', '#3d5376', '#5d789e'],
  gold: ['#5e4019', '#946b25', '#c99a3a', '#ecc865', '#fff0b4'],
  brick: ['#4a211f', '#763327', '#a24832', '#c86a44', '#e7976a'],
  stone: ['#3f3438', '#655a5a', '#8d817b', '#b3a69b', '#d6cabd'],
  regolith: ['#57291f', '#894a34', '#b66d48', '#d99862', '#f2c08b'],
  orange: ['#6e2a16', '#a8441f', '#e2703a', '#ff9d5a', '#ffd3a2'],
  glass: ['#1c3049', '#2c5174', '#4c82ad', '#8cbde4', '#dff3ff'],
  leaf: ['#1d4628', '#2d6834', '#4b9643', '#7cc657', '#c3ec8b'],
  ice: ['#3d6a8c', '#6aa0c4', '#a3cde6', '#d3ebf6', '#ffffff'],
  // ── the reference palette ──────────────────────────────────────────
  /** Metals & shadows: gunmetal plating. */
  metal: ['#1F2022', '#2E3033', '#3F4246', '#5A5D60', '#858789'],
  /** Lighter metal for tanks, rims and highlights. */
  metalHi: ['#3F4246', '#5A5D60', '#6F7174', '#858789', '#BFBFBF'],
  /** Martian earth: rust-orange armour panels. */
  rust: ['#6E3522', '#A95738', '#B86742', '#C8754D', '#D58B59'],
  /** Martian earth, light: sand, beige container panels. */
  sand: ['#A95738', '#C8754D', '#D58B59', '#E5B07A', '#F0CFA2'],
  /** Glass & energy. */
  cyan: ['#1F5566', '#2E6F83', '#3E8DA8', '#59B8D6', '#65C9E8'],
  /** Signal accents: hazard yellow through burnt orange. */
  signal: ['#A03F00', '#B05E00', '#C17A00', '#E6B800', '#F4D03F'],
  /** Alert & light. */
  alert: ['#8F2F3F', '#B03E53', '#C4586A', '#D86B7B', '#F3A6B6'],
  /** Vegetation. */
  veg: ['#4F6F3E', '#668B45', '#7BA750', '#9AA66A', '#A8B87A'],
  /** Neutral lights. */
  neutral: ['#5F5F5F', '#8A8A8A', '#BFBFBF', '#D9D9D9', '#F6F6F6'],
} as const satisfies Record<string, Ramp>

/** Near-black used for recesses, frames and outlines. */
export const INK = '#151618'
/** The bright core of cyan glow. */
export const GLOW = '#C9F4FF'

/** Stable per-pixel noise (0–1). */
export const noise = (a: number, b: number, s = 0) => {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16)
const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)]

/** Pick a ramp tone for brightness v (0–1), dithering between neighbouring tones. */
export function tone(ramp: Ramp, v: number, x: number, y: number) {
  const f = Math.max(0, Math.min(0.999, v)) * 4
  const k = Math.floor(f)
  return ramp[Math.min(4, f - k > bayer(x, y) ? k + 1 : k)]
}

const LX = -0.52
const LY = -0.62
const LZ = 0.59

/**
 * Box with bevelled, dithered faces. (cx, top) is the top diamond's top corner;
 * hw is its half-width (its height is hw), h the wall height.
 */
export function hull(
  ctx: Ctx,
  cx: number,
  top: number,
  hw: number,
  h: number,
  ramp: Ramp,
  o: { seams?: number; rivets?: boolean; roof?: Ramp } = {},
) {
  const roof = o.roof ?? ramp
  const half = hw >> 1
  // walls
  for (let c = 0; c < hw; c++) {
    const yl = top + half + (c >> 1)
    const yr = top + hw - 1 - (c >> 1)
    for (let r = 0; r <= h; r++) {
      const g = r / Math.max(1, h)
      const xl = cx - hw + c
      const xr = cx + c
      rect(ctx, xl, yl + r, 1, 1, tone(ramp, 0.74 - 0.22 * g + (c > hw - 3 ? 0.06 : 0), xl, yl + r))
      rect(ctx, xr, yr + r, 1, 1, tone(ramp, 0.4 - 0.18 * g - 0.12 * (c / hw), xr, yr + r))
    }
    // ground contact line
    rect(ctx, cx - hw + c, yl + h, 1, 1, ramp[0])
    rect(ctx, cx + c, yr + h, 1, 1, ramp[0])
  }
  // panel seams with rivets
  if (o.seams)
    for (let c = o.seams; c < hw - 1; c += o.seams) {
      const yl = top + half + (c >> 1)
      const yr = top + hw - 1 - (c >> 1)
      rect(ctx, cx - hw + c, yl + 1, 1, h - 1, ramp[1])
      rect(ctx, cx + c, yr + 1, 1, h - 1, ramp[0])
      if (o.rivets) {
        rect(ctx, cx - hw + c + 1, yl + 2, 1, 1, ramp[4])
        rect(ctx, cx - hw + c + 1, yl + h - 2, 1, 1, ramp[4])
      }
    }
  // front corner bevel: bright on the lit side, dark on the shaded side
  rect(ctx, cx - 1, top + hw - 1, 1, h + 1, ramp[4])
  rect(ctx, cx, top + hw - 1, 1, h + 1, ramp[1])
  // roof, brighter toward the back, with lit front edges
  for (let r = 0; r < hw; r++) {
    const w = r < half ? (r + 1) * 2 : (hw - r) * 2
    for (let x = cx - w; x < cx + w; x++) rect(ctx, x, top + r, 1, 1, tone(roof, 0.95 - 0.3 * (r / hw) - (x > cx ? 0.08 : 0), x, top + r))
  }
  for (let c = 0; c < hw; c++) {
    rect(ctx, cx - hw + c, top + half + (c >> 1), 1, 1, roof[4])
    rect(ctx, cx + c, top + hw - 1 - (c >> 1), 1, 1, roof[2])
  }
}

/** Top-corner y of a hull standing on ground point (cx, cy). */
export const hullTop = (cy: number, hw: number, h: number) => cy - (hw >> 1) - h

/** Paint on a hull's lit (left) face: columns c0…, rows r0… below the face's top edge. */
export function faceL(ctx: Ctx, cx: number, top: number, hw: number, c0: number, w: number, r0: number, hh: number, col: string | ((c: number, r: number) => string | null)) {
  for (let c = c0; c < c0 + w; c++)
    for (let r = r0; r < r0 + hh; r++) {
      const v = typeof col === 'string' ? col : col(c - c0, r - r0)
      if (v) rect(ctx, cx - hw + c, top + (hw >> 1) + (c >> 1) + r, 1, 1, v)
    }
}

/** Same on the shaded (right) face; c counts from the front corner. */
export function faceR(ctx: Ctx, cx: number, top: number, hw: number, c0: number, w: number, r0: number, hh: number, col: string | ((c: number, r: number) => string | null)) {
  for (let c = c0; c < c0 + w; c++)
    for (let r = r0; r < r0 + hh; r++) {
      const v = typeof col === 'string' ? col : col(c - c0, r - r0)
      if (v) rect(ctx, cx + c, top + hw - 1 - (c >> 1) + r, 1, 1, v)
    }
}

/** Framed window on a face: dark glass, a diagonal sky reflection, or a warm interior glow. */
export const windowPx = (w: number, h: number, glow = false) => (c: number, r: number) => {
  if (c === 0 || r === 0 || c === w - 1 || r === h - 1) return '#3a3442'
  if (glow) return r === 1 ? '#fff0c0' : '#ffcf7a'
  if (c + r === 3 || c + r === 4) return '#b9dcf5'
  return r < h / 2 ? '#3c6b98' : '#284a6e'
}

/** A ventilation grille. */
export const ventPx = (c: number, r: number) => (r % 2 ? '#2b2531' : c % 3 === 2 ? null : '#6a6070')

/** Shaded ellipsoid dome: rx across, ry up, rb down (its base curve). */
export function dome(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, rb: number, ramp: Ramp, spec = true) {
  for (let dy = -ry; dy <= rb; dy++) {
    const ny = dy <= 0 ? dy / (ry + 0.5) : dy / (rb + 0.5)
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - ny * ny)))
    for (let dx = -w; dx < w; dx++) {
      const nx = (dx + 0.5) / (rx + 0.5)
      const nyy = dy <= 0 ? dy / (ry + 0.5) : 0.25 * (dy / (rb + 0.5))
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - nyy * nyy))
      const l = nx * LX + nyy * LY + nz * LZ
      const x = cx + dx
      const y = cy + dy
      let c = tone(ramp, 0.12 + l * 0.86, x, y)
      if (spec && l > 0.95) c = '#ffffff'
      rect(ctx, x, y, 1, 1, c)
    }
  }
}

/** Shaded upright cylinder standing on (cx, base), with an elliptical lid. */
export function cyl(ctx: Ctx, cx: number, base: number, rx: number, h: number, ramp: Ramp, lid?: Ramp) {
  const ry = rx / 2
  for (let dx = -rx; dx < rx; dx++) {
    const nx = (dx + 0.5) / rx
    const nz = Math.sqrt(Math.max(0, 1 - nx * nx))
    const l = nx * LX + nz * LZ
    const e = nz * ry
    const y0 = Math.round(base - h - e)
    const y1 = Math.round(base + e)
    for (let y = y0; y <= y1; y++) rect(ctx, cx + dx, y, 1, 1, tone(ramp, 0.15 + l * 0.8 - (y > y1 - 2 ? 0.12 : 0), cx + dx, y))
    // a vertical specular streak
    if (Math.abs(nx + 0.45) < 0.12) for (let y = y0 + 2; y < y1 - 2; y += 1) rect(ctx, cx + dx, y, 1, 1, ramp[4])
  }
  const L = lid ?? ramp
  for (let dy = -Math.floor(ry); dy <= Math.floor(ry); dy++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2)))
    for (let dx = -w; dx < w; dx++) rect(ctx, cx + dx, base - h + dy, 1, 1, tone(L, 0.9 - 0.25 * ((dx + w) / (2 * w)) + (dy < 0 ? 0.05 : -0.05), cx + dx, base - h + dy))
  }
  // lid rim
  for (let dx = -rx; dx < rx; dx++) {
    const e = Math.round(Math.sqrt(Math.max(0, 1 - ((dx + 0.5) / rx) ** 2)) * ry)
    rect(ctx, cx + dx, base - h + e, 1, 1, ramp[1])
  }
}

/** A band around a cylinder (stripe, hoop or hazard pattern). */
export function band(ctx: Ctx, cx: number, base: number, rx: number, at: number, thick: number, col: string | ((dx: number) => string)) {
  const ry = rx / 2
  for (let dx = -rx; dx < rx; dx++) {
    const e = Math.round(Math.sqrt(Math.max(0, 1 - ((dx + 0.5) / rx) ** 2)) * ry)
    const c = typeof col === 'string' ? col : col(dx)
    rect(ctx, cx + dx, base - at + e, 1, thick, c)
  }
}

/** A lamp with a soft halo. */
export function lamp(ctx: Ctx, x: number, y: number, core: string, halo: string) {
  rect(ctx, x - 1, y, 3, 1, halo)
  rect(ctx, x, y - 1, 1, 3, halo)
  rect(ctx, x, y, 1, 1, core)
}

/** A 2px pipe with a highlight along its top. */
export function pipe(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, ramp: Ramp = RAMP.steel) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let k = 0; k <= n; k++) {
    const x = Math.round(x0 + ((x1 - x0) * k) / n)
    const y = Math.round(y0 + ((y1 - y0) * k) / n)
    rect(ctx, x, y, 1, 1, ramp[3])
    rect(ctx, x, y + 1, 1, 1, ramp[1])
  }
}

/** Hazard stripes along a face strip. */
export const hazardPx = (c: number, r: number) => ((c + r) % 4 < 2 ? '#ffd24a' : '#1b1622')

/** Tiny stencilled "lettering": a readable-at-a-glance texture for labels. */
export const stencilPx = (seed: number) => (c: number, r: number) => {
  if (r !== 0 && r !== 2) return null
  const bit = (seed >> (c % 12)) & 1
  return bit ? '#3a3442' : null
}

/* ------------------------- industrial details ------------------------- */

/**
 * Dark steel plinth under a w×h footprint centred on ground point (cx, cy),
 * P px tall: a grated top with a rust trim ring, and cross-braced truss walls.
 * Returns the y of its top surface's centre, where the building stands.
 */
/** Upgrade level of the building being drawn; plinth trim and level pips follow it. */
let TIER = 1
export const setTier = (n: number) => {
  TIER = n
}
export const getTier = () => TIER
/** Plinth trim by level: rust, then hazard yellow, then glowing cyan. */
const TIER_TRIM = [RAMP.rust, RAMP.signal, RAMP.cyan] as const

export function plinth(ctx: Ctx, cx: number, cy: number, w: number, h: number, P = 5, trimOverride?: Ramp) {
  const trim = trimOverride ?? TIER_TRIM[TIER - 1]
  const ringOn = TIER > 1 || !!trimOverride // a plain level-1 pad has no painted trim
  const inset = 0.06
  const at = (px: number, py: number) => {
    const dx = px + 0.5 - cx
    const dy = py + 0.5 - cy
    const du = (dx / 16 + dy / 8) / 2
    const dv = (dy / 8 - dx / 16) / 2
    return Math.abs(du) <= w / 2 - inset && Math.abs(dv) <= h / 2 - inset ? ([du, dv] as const) : null
  }
  const frontX = cx + (w - h) * 8
  const rx = (w + h) * 8 + 1
  const ry = (w + h) * 4 + 2
  // A pad of sintered regolith (Mars soil baked hard) sitting on a bank of packed
  // red dirt, so the building grows out of the ground instead of standing on a box.
  const PAD: Ramp = ['#6f4a3c', '#8d6550', '#a87d63', '#bf957a', '#d3ad90']
  const DIRT: Ramp = ['#5a2b1f', '#7d4029', '#9e5836', '#c07448', '#d99862']
  const DUST: Ramp = ['#a1593a', '#b96c46', '#cf8758', '#dd9c69', '#e8b282']
  const n = (px: number, py: number, s = 0) => noise(px, py, s)
  for (let py = cy - ry - P; py <= cy + ry; py++)
    for (let px = cx - rx; px <= cx + rx; px++) {
      const top = at(px, py + P)
      if (top) {
        const [du, dv] = top
        const edge = !at(px, py + P - 1) || !at(px - 1, py + P) || !at(px + 1, py + P)
        const ring = Math.abs(du) > w / 2 - inset - 0.08 || Math.abs(dv) > h / 2 - inset - 0.08
        // how far out toward the rim (0 centre, 1 edge): dust drifts in from there
        const rim = Math.max(Math.abs(du) / (w / 2), Math.abs(dv) / (h / 2))
        const drift = (rim - 0.55) * 2.2 + (n(px >> 1, py, 3) - 0.5) * 0.9
        let c: string
        if (edge) c = n(px, py, 4) < 0.5 ? DUST[4] : PAD[4]
        else if (ringOn && ring && drift < 0.9) c = du + dv < 0 ? trim[3] : trim[2]
        else if (drift > 0.35) c = tone(DUST, 0.55 + (n(px, py, 5) - 0.5) * 0.5 - (du + dv) * 0.05, px, py)
        else {
          // faint slab joints, a few cracks and pebbles, light falling off to the front right
          const joint = Math.abs(((du + w / 2) % 1) - 0.5) > 0.475 || Math.abs(((dv + h / 2) % 1) - 0.5) > 0.475
          const grit = n(px, py, 6)
          c = joint && grit > 0.25 ? PAD[1] : grit < 0.04 ? PAD[1] : grit > 0.97 ? PAD[4] : tone(PAD, 0.62 - (du + dv) * 0.05 + (n(px >> 2, py >> 1, 7) - 0.5) * 0.18, px, py)
        }
        rect(ctx, px, py, 1, 1, c)
        continue
      }
      for (let z = 0; z < P; z++) {
        const g = at(px, py + z)
        if (!g) continue
        const left = px < frontX
        // packed dirt: lit on the left face, in shade on the right; uneven strata
        // and pebbles, and the foot fading into loose sand like the ground around it
        const hz = z / Math.max(1, P - 1) // 0 at the top lip, 1 at the ground
        const strata = Math.sin((py + z * 0.5 + n(px >> 2, 0, 8) * 3) * 1.3) * 0.08
        let v = (left ? 0.62 : 0.38) - hz * 0.1 + strata + (n(px >> 1, py, 9) - 0.5) * 0.12
        if (z === 0) v += 0.18 // the lip catches the light
        let c = tone(DIRT, v, px, py)
        if (hz > 0.55 && n(px, py, 10) < (hz - 0.45) * 1.4) c = tone(DUST, left ? 0.6 : 0.35, px, py)
        if (n(px, py, 11) > 0.985) c = left ? DIRT[1] : DIRT[0]
        if (ringOn && z === 0 && (n(px >> 1, 0, 12) > 0.5)) c = left ? trim[3] : trim[1]
        rect(ctx, px, py, 1, 1, c)
        break
      }
    }
  // level pips on the front-left edge: one light per upgrade
  if (TIER > 1) {
    const fy = cy + (w + h) * 4 - P
    for (let k = 0; k < TIER; k++) {
      const px = frontX - 5 - k * 4
      const py = fy - ((frontX - px) >> 1) + 2
      rect(ctx, px, py, 2, 1, k === TIER - 1 ? GLOW : RAMP.cyan[3])
    }
  }
  return cy - P
}

/**
 * Loose dust spilling from a pad's front edges onto the ground. Drawn over the
 * finished sprite (after the outline), so the specks stay soft.
 */
export function dustApron(ctx: Ctx, cx: number, cy: number, w: number, h: number) {
  const DUST: Ramp = ['#a1593a', '#b96c46', '#cf8758', '#dd9c69', '#e8b282']
  const inset = 0.06
  const rx = (w + h) * 8 + 1
  const ry = (w + h) * 4 + 2
  const inside = (px: number, py: number) => {
    const dx = px + 0.5 - cx
    const dy = py + 0.5 - cy
    const du = (dx / 16 + dy / 8) / 2
    const dv = (dy / 8 - dx / 16) / 2
    return Math.abs(du) <= w / 2 - inset && Math.abs(dv) <= h / 2 - inset
  }
  for (let px = cx - rx; px <= cx + rx; px++) {
    let bottom = -1
    for (let py = cy + ry; py >= cy - ry; py--)
      if (inside(px, py)) {
        bottom = py
        break
      }
    if (bottom < 0) continue
    for (let k = 1; k <= 3; k++) if (noise(px, bottom + k, 13) < 0.6 - k * 0.17) rect(ctx, px, bottom + k, 1, 1, tone(DUST, 0.7 - k * 0.08, px, bottom + k))
  }
}

/** A round fan grille with spinning blades, seen face-on. */
export function fan(ctx: Ctx, x: number, y: number, r: number, t: number, ramp: Ramp = RAMP.metal) {
  for (let dy = -r; dy <= r; dy++)
    for (let dx = -r; dx <= r; dx++) {
      const d = Math.hypot(dx, dy)
      if (d > r + 0.3) continue
      let c = d > r - 0.8 ? ramp[3] : ramp[0]
      const a = Math.atan2(dy, dx) - t * 9
      if (d < r - 0.8 && d > 0.8 && Math.abs(Math.sin(a * 2)) > 0.86) c = ramp[2]
      if (d <= 0.8) c = ramp[4]
      rect(ctx, x + dx, y + dy, 1, 1, c)
    }
}

/** A sign panel on two thin truss legs. Draws legs from (x, legBase) up to the panel at (x, y). */
export function signboard(ctx: Ctx, x: number, y: number, w: number, h: number, legBase: number, face: (c: number, r: number) => string) {
  for (const lx of [x - Math.floor(w / 3), x + Math.floor(w / 3)]) {
    for (let k = y + h; k <= legBase; k++) {
      rect(ctx, lx, k, 1, 1, RAMP.metal[3])
      rect(ctx, lx + 1, k, 1, 1, RAMP.metal[1])
      if ((k - y) % 4 === 0) rect(ctx, lx - 1, k, 3, 1, RAMP.metal[2])
    }
  }
  const x0 = x - (w >> 1)
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) rect(ctx, x0 + c, y + r, 1, 1, c === 0 || r === 0 || c === w - 1 || r === h - 1 ? RAMP.neutral[2] : face(c - 1, r - 1))
}

/** Radiation trefoil face for a signboard (yellow with black blades). */
export const trefoil = (w: number, h: number) => (c: number, r: number) => {
  const dx = c - (w - 2) / 2 + 0.5
  const dy = r - (h - 2) / 2 + 0.5
  const d = Math.hypot(dx, dy)
  const a = Math.atan2(dy, dx)
  if (d < 1) return INK
  if (d < Math.min(w, h) * 0.36 && d > 1.6 && Math.cos(3 * (a + Math.PI / 2)) > 0.35) return INK
  return r < 1 ? RAMP.signal[4] : RAMP.signal[3]
}

/** A glossy water-drop icon. */
export function waterDrop(ctx: Ctx, x: number, y: number, s: number) {
  for (let dy = -s; dy <= s; dy++) {
    const w = dy < 0 ? Math.round(((dy + s) / s) * s * 0.65) : Math.round(Math.sqrt(Math.max(0, s * s - dy * dy)) * 0.95)
    for (let dx = -w; dx <= w; dx++) {
      const l = -dx * 0.5 - dy * 0.5
      rect(ctx, x + dx, y + dy, 1, 1, l > s * 0.35 ? RAMP.cyan[4] : l > 0 ? RAMP.cyan[3] : l > -s * 0.4 ? RAMP.cyan[2] : RAMP.cyan[1])
    }
  }
  rect(ctx, x - 1, y - 1, 1, 2, GLOW)
}

/** Glowing cyan window: dark frame, light-to-deep glass, a bright reflection. */
export const cyanWindow = (w: number, h: number) => (c: number, r: number) => {
  if (c === 0 || r === 0 || c === w - 1 || r === h - 1) return INK
  if (c + r === 2 || c + r === 3) return GLOW
  return r < h / 2 ? RAMP.cyan[4] : RAMP.cyan[2]
}

/** Armour plating: alternating rust and dark bands with bolt heads. */
export const armourPx = (period = 5) => (c: number, r: number) => {
  const band = Math.floor(r / period) % 2
  if (r % period === 0) return INK
  if (c % 6 === 1 && r % period === 1) return band ? RAMP.metal[4] : RAMP.rust[4]
  return band ? RAMP.metal[2] : RAMP.rust[3]
}
