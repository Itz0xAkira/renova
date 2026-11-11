/** Shared palette shortcuts and small parts (smoke, glow strips, stacks, antennas) for the building art. */
import { rect, type Ctx } from '@/site/pixel/engine'
import { cyl, dome, faceL, faceR, GLOW, hull, hullTop, INK, lamp, RAMP, ventPx, type Ramp } from '@/game/art/pixel'

export function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, c: string) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let k = 0; k <= n; k++) rect(ctx, Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), 1, 1, c)
}

export const M = RAMP.metal
export const MH = RAMP.metalHi
export const R = RAMP.rust
export const S = RAMP.sand
export const CY = RAMP.cyan
export const SG = RAMP.signal
export const SOIL: Ramp = ['#24160f', '#3b281b', '#573b27', '#785536', '#9c7450']
export const OLIVE: Ramp = ['#3a3b26', '#5c5d39', '#858653', '#9aa66a', '#b9c48a']
export const SMOKE: Ramp = ['#3a3a3e', '#55555b', '#74747a', '#96969b', '#bdbdc0']
export const STEAM: Ramp = ['#9fb0c0', '#bccad6', '#d5e0e9', '#ebf2f7', '#ffffff']

/** Rising puffs of smoke or steam above (x, y), growing as they climb. */
export function puffs(ctx: Ctx, x: number, y: number, t: number, ramp: Ramp) {
  if (t <= 0) return
  for (let k = 0; k < 4; k++) {
    const rise = (t * 6 + k * 3.2) % 13
    const r = rise > 8 ? 2 : rise > 3 ? 1.5 : 1
    const px = x + Math.round(Math.sin(k * 2.1 + rise * 0.3) * 1.5 + rise / 5)
    dome(ctx, px, Math.round(y - rise), Math.ceil(r + 0.5), Math.ceil(r), Math.ceil(r), ramp, false)
  }
}

/** A vertical cyan glow strip on a tank, lit up to `level` (0–1). */
export function glowStrip(ctx: Ctx, x: number, bottom: number, h: number, level = 1) {
  rect(ctx, x - 1, bottom - h - 1, 4, h + 2, INK)
  const lit = Math.round(h * level)
  for (let k = 0; k < h; k++) {
    const on = k < lit
    rect(ctx, x, bottom - k, 1, 1, on ? GLOW : CY[0])
    rect(ctx, x + 1, bottom - k, 1, 1, on ? CY[4] : CY[0])
  }
}

/** A small exhaust stack with a dark mouth. */
export function stack(ctx: Ctx, x: number, base: number, h: number, rx = 2, ramp: Ramp = M) {
  cyl(ctx, x, base, rx, h, ramp, M)
  dome(ctx, x, base - h, rx - 1, 0, 0, [INK, INK, INK, INK, INK], false)
}

/** A cluster of thin antennas and a tiny dish on a roof. */
export function antennas(ctx: Ctx, x: number, y: number, t: number) {
  for (const [dx, h] of [
    [0, 9],
    [3, 6],
    [-3, 5],
  ]) {
    rect(ctx, x + dx, y - h, 1, h, M[3])
    rect(ctx, x + dx - 1, y - h, 3, 1, MH[3])
  }
  dome(ctx, x + 6, y - 4, 3, 2, 2, MH, false)
  rect(ctx, x + 6, y - 2, 1, 2, M[2])
  lamp(ctx, x, y - 11, (t * 1.5) % 1 < 0.4 ? RAMP.alert[4] : RAMP.alert[0], RAMP.alert[1])
}

/**
 * Parts an upgrade adds to any building: a back-corner equipment module with a
 * glowing strip from level 2, and a mast with a dish and a beacon at level 3.
 * Drawn behind the building so it peeks out without covering its face. It
 * grows with the footprint: a 1×1 gets a small cabinet, a 3×3 or 4×3 a taller
 * plated module with a hazard band, a stencilled label and a lattice mast.
 */
export function upgradeKit(ctx: Ctx, x: number, y: number, w: number, h: number, t: number, tier: number) {
  if (tier < 2) return
  const span = w + h
  const big = span > 2
  const k = Math.max(0, span - 2) // 0 for 1×1, 2 for 2×2, 4 for 3×3, 5 for 4×3
  const P = big ? 6 : 4
  const hw = 5 + k
  const mh = 7 + k
  // back corner of the footprint, pulled in a little and, on big footprints,
  // slid along the back-right edge so the mast clears the building's centre
  const pull = big ? 0.6 : 0.55
  const slide = k * 2
  const bx = Math.round(x + (h - w) * 8 * pull) + slide
  const byy = Math.round(y - (w + h) * 4 * pull - P + slide / 2)
  const mt = hullTop(byy, hw, mh)
  hull(ctx, bx, mt, hw, mh, M, { roof: MH, seams: big ? 3 : 0 })
  faceL(ctx, bx, mt, hw, 1, 1, 1, mh - 2, (_, r) => (r === 0 ? GLOW : CY[4]))
  faceR(ctx, bx, mt, hw, 1, Math.min(hw - 2, 3 + k), 2, Math.min(4, mh - 4), ventPx)
  if (big) {
    faceL(ctx, bx, mt, hw, 3, 1, 1, mh - 2, (_, r) => (r === 0 ? GLOW : CY[3]))
    faceL(ctx, bx, mt, hw, 5, hw - 6, 2, 1, (c) => (c % 3 === 2 ? null : INK))
    faceL(ctx, bx, mt, hw, 0, hw, mh - 2, 2, (c, r) => ((c + r) % 4 < 2 ? SG[4] : INK))
    faceR(ctx, bx, mt, hw, 0, hw, 0, 1, (c) => (c % 3 === 0 ? R[3] : R[1]))
    // roof vent box and, until the mast arrives, a whip antenna with a cyan tip
    rect(ctx, bx - 3, mt + 2, 4, 2, M[3])
    rect(ctx, bx - 3, mt + 4, 4, 1, M[1])
    if (tier < 3) {
      const wh = 10 + k * 2
      rect(ctx, bx + 2, mt + 2 - wh, 1, wh, M[4])
      rect(ctx, bx + 1, mt + 1, 3, 1, M[2])
      lamp(ctx, bx + 2, mt + 1 - wh, (t * 1.5) % 1 < 0.5 ? GLOW : CY[1], CY[0])
    }
  }
  if (tier < 3) return
  const mast = big ? 20 + k * 4 : 14
  const top = mt - mast
  rect(ctx, bx + 3, top, 1, mast + 2, M[3])
  rect(ctx, bx + 4, top + 1, 1, mast + 1, M[1])
  if (big) {
    for (let r = top + 4; r < mt; r += 4) rect(ctx, bx + 2, r, 4, 1, M[2])
    // yard-arm with two whip antennas
    rect(ctx, bx - 2, top + 3, 10, 1, MH[3])
    rect(ctx, bx - 2, top - 1, 1, 4, M[4])
    rect(ctx, bx + 7, top, 1, 3, M[4])
    lamp(ctx, bx - 2, top - 2, (t * 1.5 + 0.5) % 1 < 0.4 ? RAMP.cyan[4] : RAMP.cyan[0], RAMP.cyan[1])
  }
  const dr = big ? 4 : 3
  dome(ctx, bx + 3 + dr, top + Math.round(mast * 0.4), dr, 2, 2, MH, false)
  rect(ctx, bx + 3 + dr, top + Math.round(mast * 0.4) - 1, 1, 1, GLOW)
  lamp(ctx, bx + 3, top - 2, (t * 1.5) % 1 < 0.4 ? RAMP.alert[4] : RAMP.alert[0], RAMP.alert[1])
}
