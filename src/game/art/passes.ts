/**
 * Finishing passes run on every baked sprite: lighting, a selective outline,
 * and the ground shadow drawn on the scene's shadow layer.
 */
import { rect, type Ctx } from '@/site/pixel/engine'
import { canvas } from '@/game/art/canvas'

/**
 * Lighting pass on a structure layer: light comes from the upper left, so the
 * right side falls into shade and the base picks up ambient occlusion.
 */
export function shadeLayer(cv: HTMLCanvasElement, ax: number, ay: number, reach: number) {
  const ctx = cv.getContext('2d')!
  const img = ctx.getImageData(0, 0, cv.width, cv.height)
  const d = img.data
  let topY = ay
  for (let y = 0; y < cv.height && topY === ay; y++)
    for (let x = 0; x < cv.width; x++)
      if (d[(y * cv.width + x) * 4 + 3]) {
        topY = y
        break
      }
  const height = Math.max(8, ay - topY)
  for (let y = 0; y < cv.height; y++)
    for (let x = 0; x < cv.width; x++) {
      const o = (y * cv.width + x) * 4
      if (!d[o + 3]) continue
      const side = Math.max(0, Math.min(1, (x - ax + 2) / reach))
      const up = Math.max(0, Math.min(1, (ay - y) / height))
      const base = Math.max(0, Math.min(1, (y - (ay - 7)) / 9))
      const f = 1 + 0.03 * up * (1 - side) - 0.05 * side - 0.06 * base
      d[o] = Math.min(255, d[o] * f)
      d[o + 1] = Math.min(255, d[o + 1] * f)
      d[o + 2] = Math.min(255, d[o + 2] * f * (1 + 0.04 * side)) // shade leans cool
    }
  // finishing passes, read from the original alpha so they don't feed on each other
  const W = cv.width
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < cv.height && d[(y * W + x) * 4 + 3] > 0
  weather(d, W, cv.height, ay, height, solid)
  ctx.putImageData(img, 0, 0)
}

/** Weathering alone, for sprites that come already lit (the rovers). */
export function weatherLayer(cv: HTMLCanvasElement) {
  const ctx = cv.getContext('2d')!
  const W = cv.width
  const H = cv.height
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  let top = H
  let bottom = 0
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (d[(y * W + x) * 4 + 3]) {
        top = Math.min(top, y)
        bottom = Math.max(bottom, y)
      }
  if (top > bottom) return cv
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && d[(y * W + x) * 4 + 3] > 0
  weather(d, W, H, bottom, bottom - top + 1, solid)
  ctx.putImageData(img, 0, 0)
  return cv
}

const DUST = [196, 122, 82] // Martian dust, as it settles on paint
const GRIME = [92, 52, 40] // darker wind-blown grime

/**
 * Mars weathering, so the white hardware looks like it has stood out there for
 * a while: the warm butterscotch light and a little haze pull every colour
 * toward the landscape; red dust drifts up the foot of every wall in uneven
 * patches and settles along roof edges; faint grime streaks run down below
 * ledges; and a whisper of grain breaks up flat paint. Lamps, glass glow and
 * other bright saturated lights are left alone so they still shine.
 * All noise is fixed to the pixel, so animation frames don't flicker.
 */
function weather(d: Uint8ClampedArray, W: number, H: number, ay: number, height: number, solid: (x: number, y: number) => boolean) {
  const noise = (a: number, b: number, s: number) => {
    let n = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1442695041)
    n = Math.imul(n ^ (n >>> 13), 1274126177)
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296
  }
  // smooth-ish blotch noise: 3×2 px cells, so dust comes in patches, not salt and pepper
  const smooth = (x: number, y: number, s: number) => {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = x - x0
    const fy = y - y0
    const a = noise(x0, y0, s)
    const b = noise(x0 + 1, y0, s)
    const c = noise(x0, y0 + 1, s)
    const e = noise(x0 + 1, y0 + 1, s)
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + e) * fx * fy
  }
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
  // soft drifts: smooth noise in 5×3 px cells, dithered at the edges
  const blotch = (x: number, y: number, s: number) => smooth(x / 5, y / 3, s) * 0.8 + (BAYER[(y & 3) * 4 + (x & 3)] / 16 - 0.5) * 0.25
  const dustReach = Math.max(8, Math.min(22, height * 0.38))
  for (let x = 0; x < W; x++) {
    let bottom = -1
    for (let y = H - 1; y >= 0; y--)
      if (solid(x, y)) {
        bottom = y
        break
      }
    if (bottom < 0) continue
    // a grime streak hanging under some ledge in this column
    const streak = noise(x, 0, 41) < 0.16
    let streakLeft = 0
    for (let y = 0; y < H; y++) {
      if (!solid(x, y)) {
        streakLeft = 0
        continue
      }
      const o = (y * W + x) * 4
      let r = d[o]
      let g = d[o + 1]
      let b = d[o + 2]
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const sat = max ? (max - min) / max : 0
      const lum = (r * 0.3 + g * 0.59 + b * 0.11) / 255
      // emissive: lamps, glow strips, lit windows
      if (sat > 0.42 && max > 200 && lum > 0.5) continue
      // 1. light and haze: soften saturation a touch, warm the whites, mix in a little sky dust
      const grey = lum * 255
      r = r + (grey - r) * 0.14
      g = g + (grey - g) * 0.14
      b = b + (grey - b) * 0.14
      if (lum > 0.7) {
        const k = (lum - 0.7) / 0.3
        g *= 1 - 0.025 * k
        b *= 1 - 0.07 * k
      }
      r = r + (DUST[0] - r) * 0.07
      g = g + (DUST[1] - g) * 0.07
      b = b + (DUST[2] - b) * 0.07
      // 2. dust drifting up from the ground, in patches, thickest at the foot
      const up = bottom - y
      const near = y > ay - dustReach - 4 ? Math.max(0, 1 - up / dustReach) : 0
      let dust = 0
      if (near > 0 && blotch(x, y, 17) < near * 1.05) dust = 0.18 + near * 0.32
      // 3. dust settled on top edges (anything open to the sky)
      if (!solid(x, y - 1) && smooth(x / 3, y, 23) < 0.5) dust = Math.max(dust, 0.22)
      // 4. stray specks everywhere
      if (noise(x, y, 29) < 0.008) dust = Math.max(dust, 0.3)
      if (dust) {
        r = r + (DUST[0] - r) * dust
        g = g + (DUST[1] - g) * dust
        b = b + (DUST[2] - b) * dust
      }
      // 5. grime streaks: start under a ledge (open above, or a sharp brightness step), run a few px
      if (streak) {
        const above = solid(x, y - 1) ? (d[o - W * 4] + d[o - W * 4 + 1]) / 510 : 1
        if (streakLeft === 0 && (above - lum > 0.25 || !solid(x, y - 1)) && noise(x, y, 43) < 0.35) streakLeft = 3 + Math.floor(noise(x, y, 44) * 9)
        if (streakLeft > 0) {
          const k = 0.1 * Math.min(1, streakLeft / 4)
          r = r + (GRIME[0] - r) * k
          g = g + (GRIME[1] - g) * k
          b = b + (GRIME[2] - b) * k
          streakLeft--
        }
      }
      // 6. grain
      const grain = 1 + (noise(x, y, 31) - 0.5) * 0.035
      d[o] = Math.min(255, r * grain)
      d[o + 1] = Math.min(255, g * grain)
      d[o + 2] = Math.min(255, b * grain)
    }
  }
}

/**
 * A 1px selective outline: each outline pixel is a deep, slightly violet
 * version of the colour it borders, so edges read crisply without a flat
 * brown line around everything.
 */
export function outlineOf(cv: HTMLCanvasElement) {
  const w = cv.width
  const h = cv.height
  const src = cv.getContext('2d')!.getImageData(0, 0, w, h).data
  return canvas(w, h, (ctx) => {
    const img = ctx.createImageData(w, h)
    const d = img.data
    const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 0
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (solid(x, y)) continue
        // prefer the neighbour below (the edge we're outlining is usually a roof or top)
        const n = [
          [x, y + 1],
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
        ].find(([nx, ny]) => solid(nx, ny))
        if (!n) continue
        const s = (n[1] * w + n[0]) * 4
        const o = (y * w + x) * 4
        // a deep, warm version of the colour it borders: dark enough to read, not a black line
        d[o] = src[s] * 0.26 + 26
        d[o + 1] = src[s + 1] * 0.2 + 16
        d[o + 2] = src[s + 2] * 0.2 + 16
        // under the building, where it meets the ground, it's only a soft contact shadow
        d[o + 3] = solid(x, y - 1) && !solid(x, y + 1) ? 120 : 235
      }
    ctx.putImageData(img, 0, 0)
  })
}

/**
 * Ground shadow: every column of the structure is swept along the ground in the
 * light direction (down-right, along the +i axis) by a length set by its height.
 * Drawn opaque here; the scene fades the whole shadow layer at once, so shadows
 * that overlap never get darker.
 */
export function shadowOf(cv: HTMLCanvasElement) {
  const w = cv.width
  const h = cv.height
  const a = cv.getContext('2d')!.getImageData(0, 0, w, h).data
  return canvas(w, h, (ctx) => {
    for (let x = 0; x < w; x++) {
      let top = -1
      let bot = -1
      for (let y = 0; y < h; y++)
        if (a[(y * w + x) * 4 + 3]) {
          if (top < 0) top = y
          bot = y
        }
      if (top < 0) continue
      const len = (bot - top + 1) * 0.65
      for (let k = 0; k <= len; k += 0.5) rect(ctx, Math.round(x + k * 0.894), Math.round(bot - 1 + k * 0.447), 1, 2, '#2a1012')
    }
  })
}

/** Any freestanding object, lit and outlined like the buildings. */
export function lit(w: number, h: number, ax: number, ay: number, draw: (ctx: Ctx) => void) {
  const layer = canvas(w, h, draw)
  shadeLayer(layer, ax, ay, 6)
  return canvas(w, h, (ctx) => {
    ctx.drawImage(outlineOf(layer), 0, 0)
    ctx.drawImage(layer, 0, 0)
  })
}
