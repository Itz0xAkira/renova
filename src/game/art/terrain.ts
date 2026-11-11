/** The baked ground (ice, ore and sand with cliffs and boulders) and the sky behind it. */
import { C, cliffColumn, diamond, drawObject, ellipseRows, hash, rect, speckle } from '@/site/pixel/engine'
import { MAP, type Ground } from '@/game/core/data'
import { canvas, hexRGB as hex } from '@/game/art/canvas'

/** Terrain bake: tile (i, j)'s top corner sits at (TER_OX + (i-j)*16, TER_OY + (i+j)*8). */
export const TER_OX = MAP * 16 + 16
export const TER_OY = 8
export const TER_W = MAP * 32 + 32
export const TER_H = MAP * 16 + 64

const ICE = ['#eef8fc', '#e2f2f8', '#d3eaf3', '#c2e0ed']
const ORE = ['#98544a', '#8e4b44', '#85453f', '#7b3f3a']
const SAND = ['#e8ab7b', '#e3a474', '#de9e6e', '#d89768']
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16)
function vnoise(x: number, y: number, seed: number) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const sx = x - x0
  const sy = y - y0
  const u = sx * sx * (3 - 2 * sx)
  const v = sy * sy * (3 - 2 * sy)
  const a = hash(x0, y0, seed)
  const b = hash(x0 + 1, y0, seed)
  const c = hash(x0, y0 + 1, seed)
  const d = hash(x0 + 1, y0 + 1, seed)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

export function terrainCanvas(ground: Ground[]) {
  const pal = { sand: SAND.map(hex), ice: ICE.map(hex), ore: ORE.map(hex) }
  const spk = { sandHi: hex(C.sandHi), sandLo: hex(C.sandLo), white: [255, 255, 255], iceLo: hex('#9fcbe2'), nod: hex('#3a1c1a'), shine: hex('#d79a8c') }
  return canvas(TER_W, TER_H, (ctx) => {
    const img = ctx.createImageData(TER_W, TER_H)
    const d = img.data
    for (let py = 0; py < TER_H; py++) {
      const dy = py + 0.5 - TER_OY
      for (let px = 0; px < TER_W; px++) {
        const dx = px + 0.5 - TER_OX
        const u = (dx / 16 + dy / 8) / 2
        const v = (dy / 8 - dx / 16) / 2
        if (u < 0 || v < 0 || u >= MAP || v >= MAP) continue
        // warp the lookup with smooth noise so deposits get wavy, organic edges,
        // plus a little 2×1 pixel jitter so the edge stays crunchy pixel art
        const ju = u + (vnoise(px / 9, py / 5, 71) - 0.5) * 0.9 + (hash(px >> 1, py, 75) - 0.5) * 0.14
        const jv = v + (vnoise(px / 9, py / 5, 72) - 0.5) * 0.9 + (hash(py, px >> 1, 76) - 0.5) * 0.14
        const ti = Math.min(MAP - 1, Math.max(0, Math.floor(ju)))
        const tj = Math.min(MAP - 1, Math.max(0, Math.floor(jv)))
        const g = ground[tj * MAP + ti]
        const kind = g === 'ice' ? 'ice' : g === 'ore' ? 'ore' : 'sand'
        // shading noise in screen space, so it never lines up with the tile grid
        const n = vnoise(px / 70, py / 38, 9) * 0.55 + vnoise(px / 23, py / 13, 10) * 0.3 + vnoise(px / 7, py / 4, 11) * 0.15
        const lvl = Math.max(0, Math.min(3, Math.floor(n * 4.4 - 0.7 + (BAYER4[(py & 3) * 4 + (px & 3)] - 0.5) * 1.3)))
        let c = pal[kind][lvl]
        const r = hash(px, py, 73)
        if (kind === 'sand') {
          if (r > 0.988) c = spk.sandHi
          else if (r < 0.01) c = spk.sandLo
        } else if (kind === 'ice') {
          if (r > 0.975) c = spk.white
          else if (r < 0.012) c = spk.iceLo
        } else {
          const nd = hash(px >> 1, py >> 1, 74)
          if (nd > 0.94) c = (px & 1) === 0 && (py & 1) === 0 ? spk.shine : spk.nod
          else if (r < 0.015) c = spk.sandLo
        }
        const o = (py * TER_W + px) * 4
        d[o] = c[0]
        d[o + 1] = c[1]
        d[o + 2] = c[2]
        d[o + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)

    for (let s = 0; s <= 2 * MAP - 2; s++)
      for (let i = Math.max(0, s - MAP + 1); i <= Math.min(MAP - 1, s); i++) {
        const j = s - i
        const g = ground[j * MAP + i]
        const sx = TER_OX + (i - j) * 16
        const sy = TER_OY + (i + j) * 8
        // mesa cliffs on the two front edges
        if (i === MAP - 1 || j === MAP - 1) {
          for (let c = 0; c < 16; c++) {
            if (j === MAP - 1) cliffColumn(ctx, sx - 16 + c, sy + 8 + (c >> 1), 40, true, 0, (c * 7 + i) % 3 === 0 ? 1 : 0)
            if (i === MAP - 1) cliffColumn(ctx, sx + c, sy + 15 - (c >> 1), 40, false, 0, (c * 5 + j) % 3 === 0 ? 1 : 0)
          }
        }
        if (g === 'crater') {
          const cy = sy + 8
          ellipseRows(ctx, sx, cy, 11, 5, C.sandLo)
          ellipseRows(ctx, sx + 1, cy + 1, 8, 3, '#b06f4a')
          ellipseRows(ctx, sx + 2, cy + 1, 4, 1.5, '#9a5e3e')
          for (let k = -8; k <= 8; k++) rect(ctx, sx + k, cy + 5 + (Math.abs(k) > 6 ? -1 : 0), 1, 1, C.sandHi)
        }
        if (g === 'rock') drawObject(ctx, { k: 'boulder' }, sx, sy + 8, 0)
      }
  })
}

/** Dithered dusk sky and distant plain, fixed behind the mesa. */
export function skyCanvas(w: number, h: number) {
  const SKY = ['#0c1220', '#111a2d', '#182038', '#222644', '#302b4b', '#45314f', '#5f3a4f', '#7f434f', '#a0544d', '#bf6c50']
  const GROUND = ['#8c4f39', '#7b4432', '#6b3a2c', '#5b3127', '#4a2822']
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16)
  const hz = Math.round(h * 0.42)
  return canvas(w, h, (ctx) => {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const b = BAYER[(y & 3) * 4 + (x & 3)]
        let c: string
        if (y < hz) {
          const f = Math.pow(y / hz, 1.25) * (SKY.length - 1)
          const k = Math.floor(f)
          c = f - k > b ? SKY[Math.min(k + 1, SKY.length - 1)] : SKY[k]
          const ridge = Math.round(6 + 4 * Math.sin(x * 0.03 + 1) + 2 * Math.sin(x * 0.09))
          if (y >= hz - ridge) c = '#6a3a4b'
          else if (y < hz * 0.7 && hash(x, y, 5) > 0.996) c = '#e8e2f0'
        } else {
          const f = Math.pow((y - hz) / (h - hz), 0.8) * (GROUND.length - 1)
          const k = Math.floor(f)
          c = f - k > b ? GROUND[Math.min(k + 1, GROUND.length - 1)] : GROUND[k]
        }
        rect(ctx, x, y, 1, 1, c)
      }
    ellipseRows(ctx, Math.round(w * 0.82), Math.round(hz * 0.3), 3, 2.6, '#b9a08c')
    rect(ctx, Math.round(w * 0.2), Math.round(hz * 0.25), 1, 1, '#9fd2ff')
  })
}

/** A ground swatch (one tile) for the UI, as a data URL. */
export function groundURL(g: Ground) {
  return canvas(34, 18, (ctx) => {
    if (g === 'ice') {
      diamond(ctx, 17, 1, 16, ICE[1])
      speckle(ctx, 17, 1, 3, 4, 8, '#ffffff', '#9fcbe2')
    } else if (g === 'ore') {
      diamond(ctx, 17, 1, 16, ORE[1])
      speckle(ctx, 17, 1, 3, 4, 10, '#d79a8c', '#3a1c1a')
    } else {
      diamond(ctx, 17, 1, 16, SAND[1])
      speckle(ctx, 17, 1, 3, 4, 6, C.sandHi, C.sandLo)
    }
  }).toDataURL()
}
