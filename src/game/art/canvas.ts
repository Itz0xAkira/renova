/** Canvas helpers shared by every art module. */
import { rect, type Ctx } from '@/site/pixel/engine'

/** Animation frames baked for every moving sprite. */
export const FRAMES = 8

/** A fresh pixel canvas, drawn by `draw`. Sprites are read back while baking, so it's set up for frequent reads. */
export function canvas(w: number, h: number, draw: (ctx: Ctx) => void) {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = false
  draw(ctx)
  return cv
}

/** A 1px line, plotted pixel by pixel so it stays crisp. */
export function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, c: string) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let k = 0; k <= n; k++) rect(ctx, Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), 1, 1, c)
}

/** A hex colour scaled by `f` (below 1 darkens). */
export function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.round(v * f)
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`
}

/** A hex colour as [r, g, b]. */
export const hexRGB = (h: string) => {
  const n = parseInt(h.slice(1), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}
