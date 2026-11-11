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
  for (let x = 0; x < W; x++) {
    let bottom = -1
    for (let y = cv.height - 1; y >= 0; y--)
      if (solid(x, y)) {
        bottom = y
        break
      }
    for (let y = 0; y < cv.height; y++) {
      if (!solid(x, y)) continue
      const o = (y * W + x) * 4
      // rim light: edges open to the sky catch it
      if (!solid(x, y - 1)) {
        const k = x < ax + 3 ? 1.1 : 1.04
        d[o] = Math.min(255, d[o] * k)
        d[o + 1] = Math.min(255, d[o + 1] * k)
        d[o + 2] = Math.min(255, d[o + 2] * k)
      }
      // red dust kicked up onto the lowest pixels of walls that stand on the ground
      if (bottom >= 0 && y >= bottom - 2 && y > ay - 6) {
        const k = y === bottom ? 0.4 : y === bottom - 1 ? 0.25 : 0.12
        d[o] = d[o] + (201 - d[o]) * k
        d[o + 1] = d[o + 1] + (128 - d[o + 1]) * k
        d[o + 2] = d[o + 2] + (88 - d[o + 2]) * k
      }
    }
  }
  ctx.putImageData(img, 0, 0)
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
        d[o] = src[s] * 0.12 + 14
        d[o + 1] = src[s + 1] * 0.1 + 14
        d[o + 2] = src[s + 2] * 0.12 + 18
        d[o + 3] = 245
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
