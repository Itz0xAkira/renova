/**
 * Bakes every RENOVA sprite into canvases with the website's pixel engine,
 * so the game and the landing page share one art style.
 */
import { box, C, cliffColumn, cylinder, diamond, diamondOutline, dome, drawObject, ellipseRows, hash, rect, rover, speckle, walker, type Ctx } from '@/site/pixel/engine'
import { BUILDINGS, DI, DJ, ITEMS, MAP, type Dir, type Ground, type ItemId, type Kind } from './data'
import { GLOW, INK, RAMP as PAL } from './pixel'
import { battery, berm, bigGreenhouse, bigHabitat, bigKiln, bigLab, bigReactor, bigSmelter, bigWasher, coreBuilding, excavator, iceDrill, melter, moxie, rocket, solarArray } from './structures'

export const FRAMES = 8
/**
 * Building canvases are SPR_W × SPR_H with the tile centre at (SPR_AX, SPR_AY).
 * They're wider on the right to leave room for the cast shadow.
 */
export const SPR_W = 96
export const SPR_H = 100
export const SPR_AX = 36
export const SPR_AY = 68
export const CORE_W = 160
export const CORE_H = 130
export const CORE_AX = 60
export const CORE_AY = 84

/** Terrain bake: tile (i, j)'s top corner sits at (TER_OX + (i-j)*16, TER_OY + (i+j)*8). */
export const TER_OX = MAP * 16 + 16
export const TER_OY = 8
export const TER_W = MAP * 32 + 32
export const TER_H = MAP * 16 + 64

function canvas(w: number, h: number, draw: (ctx: Ctx) => void) {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  // sprites are read back for lighting, outlines and shadows while baking
  const ctx = cv.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = false
  draw(ctx)
  return cv
}

function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, c: string) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let k = 0; k <= n; k++) rect(ctx, Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), 1, 1, c)
}

/* ---------------------------- new structures ---------------------------- */

function core(ctx: Ctx, x: number, y: number, t: number) {
  coreBuilding(ctx, x, y, t)
}

const hasSlab = (k: Kind) => k !== 'belt' && k !== 'junction' && k !== 'core' && k !== 'shield'

/** Multi-tile buildings use the big canvas, anchored at the centre of their footprint. */
export const isBig = (k: Kind) => BUILDINGS[k].w > 1 || BUILDINGS[k].h > 1

/** Which ground-layer foundation texture a building sits on, if any. */
export const slabKey = (k: Kind): string | null => {
  void k
  return null // every building now stands on its own plinth, drawn as part of its sprite
}

export function drawKind(ctx: Ctx, kind: Kind, x: number, y: number, t: number, opt: { dim?: boolean; level?: number; noSlab?: boolean } = {}) {
  switch (kind) {
    case 'drill':
      return iceDrill(ctx, x, y, t)
    case 'excavator':
      return excavator(ctx, x - 3, y, t)
    case 'melter':
      return melter(ctx, x, y, t, opt.level ?? 0.5)
    case 'smelter':
      return bigSmelter(ctx, x, y, t)
    case 'kiln':
      return bigKiln(ctx, x, y, t)
    case 'washer':
      return bigWasher(ctx, x, y, t)
    case 'greenhouse':
      return bigGreenhouse(ctx, x, y, t, !!opt.dim)
    case 'moxie':
      return moxie(ctx, x, y, t)
    case 'habitat':
      return bigHabitat(ctx, x, y, t)
    case 'shield':
      return berm(ctx, x, y, t)
    case 'solar':
      return solarArray(ctx, x, y, t)
    case 'battery':
      return battery(ctx, x, y, t)
    case 'reactor':
      return bigReactor(ctx, x, y, t)
    case 'lab':
      return bigLab(ctx, x, y, t)
    case 'core':
      return core(ctx, x, y, t)
    case 'belt':
      return
  }
}

/* -------------------------------- belts --------------------------------- */

/**
 * Texture key for a belt tile. `mask` says which sides feed it (1 back, 2 the
 * +b side, 4 the −b side), which picks its shape:
 *   0 open start · 1 straight · 2/4 corner · 3/5 straight with a merging side
 *   line (3 ends) · 6 a Y where two side lines join · 7 merges from both sides (4 ends).
 * `capEnd` closes the output end when it leads nowhere.
 */
export const beltKey = (dir: Dir, mask: number, capEnd: boolean, frame: number) => `belt_${dir}_${mask}${capEnd ? 1 : 0}_${frame}`

type Lane = { along: number; across: number; len: number }

/**
 * Belt tile drawn per pixel in local belt coords: `a` runs along the belt
 * (−0.5 → 0.5), `b` across it, with +b toward direction (dir + 1) % 4. Each
 * input contributes a lane: the straight main lane from the back, and a
 * quarter-circle curve from each fed side. The main lane wins where they
 * overlap, except its rail opens up where a side lane merges in.
 */
function beltCanvas(dir: Dir, frame: number, mask = 1, capEnd = false) {
  const back = (mask & 1) !== 0 || mask === 0
  const sideP = (mask & 2) !== 0
  const sideN = (mask & 4) !== 0
  const curve = (a: number, b: number, sign: 1 | -1): Lane | null => {
    const bb = b * sign
    let th = Math.atan2(bb - 0.5, a - 0.5)
    if (th < 0) th += Math.PI * 2
    const along = (th - Math.PI) / (Math.PI / 2)
    if (along < 0 || along > 1) return null
    return { along, across: 0.5 - Math.hypot(a - 0.5, bb - 0.5), len: 0.8 }
  }
  return canvas(34, 18, (ctx) => {
    for (let py = 0; py < 18; py++)
      for (let px = 0; px < 34; px++) {
        const dx = px + 0.5 - 17
        const dy = py + 0.5 - 9
        const ai = (dx / 16 + dy / 8) / 2
        const aj = (dy / 8 - dx / 16) / 2
        const [a, b] = dir === 0 ? [ai, aj] : dir === 1 ? [aj, -ai] : dir === 2 ? [-ai, -aj] : [-aj, ai]
        if (Math.abs(a) > 0.5 || Math.abs(b) > 0.5) continue
        const main: Lane | null = back && Math.abs(b) <= 0.34 ? { along: a + 0.5, across: b, len: 1 } : null
        const cp = sideP ? curve(a, b, 1) : null
        const cn = sideN ? curve(a, b, -1) : null
        const sideLanes = [cp, cn].filter((l): l is Lane => !!l && Math.abs(l.across) <= 0.34)
        let lane = main
        if (!lane) lane = sideLanes.sort((x, y) => Math.abs(x.across) - Math.abs(y.across))[0] ?? null
        if (!lane) continue
        // a side lane merging into the main lane opens a gap in its rail
        const merging = main && Math.abs(main.across) > 0.24 && sideLanes.some((l) => Math.abs(l.across) <= 0.24 && Math.sign(main.across) === (l === cp ? 1 : -1))
        let c = '#4a5262'
        if (Math.abs(lane.across) > 0.24 && !merging) c = Math.abs(lane.across) > 0.3 ? '#232a37' : lane.across < 0 ? '#c3cad3' : '#8d96a3'
        else {
          const src = merging ? sideLanes.find((l) => Math.abs(l.across) <= 0.24)! : lane
          const v = (src.along - 0.5) * src.len - Math.abs(src.across) * 0.9
          const st = (((v * 3 - frame / FRAMES) % 1) + 1) % 1
          if (st < 0.3) c = '#3a4150'
          if (st < 0.14) c = '#f08a4b'
          if (merging) c = st < 0.14 ? '#ffb070' : c // merge seam picks out the joining lane
        }
        if (mask === 0 && lane.along < 0.17) c = lane.along < 0.12 ? '#2b3240' : '#c3cad3'
        if (capEnd && lane === main && lane.along > 0.83) c = lane.along > 0.88 ? '#2b3240' : '#ff5a4f'
        if (capEnd && lane !== main && lane.along > 0.83) c = lane.along > 0.88 ? '#2b3240' : '#ff5a4f'
        rect(ctx, px, py, 1, 1, c)
      }
  })
}

/** A belt junction: two belt lanes crossing under a raised steel plate, rollers on both axes. */
function junctionCanvas(frame: number) {
  return canvas(34, 22, (ctx) => {
    const oy = 4 // the plate is raised a few pixels
    for (let py = 0; py < 22; py++)
      for (let px = 0; px < 34; px++) {
        const dx = px + 0.5 - 17
        const dy = py + 0.5 - 13
        const ai = (dx / 16 + dy / 8) / 2
        const aj = (dy / 8 - dx / 16) / 2
        if (Math.abs(ai) > 0.5 || Math.abs(aj) > 0.5) continue
        const onI = Math.abs(aj) <= 0.3
        const onJ = Math.abs(ai) <= 0.3
        if (!onI && !onJ) continue
        const along = onI ? ai : aj
        const across = onI ? aj : ai
        let c = '#4a5262'
        if (Math.abs(across) > 0.22) c = Math.abs(across) > 0.27 ? '#232a37' : '#8d96a3'
        else {
          const st = (((Math.abs(along) * 3 - frame / FRAMES) % 1) + 1) % 1
          if (st < 0.3) c = '#3a4150'
        }
        rect(ctx, px, py, 1, 1, c)
      }
    // raised cross-over plate with hazard corners and a status light
    for (let py = 0; py < 22; py++)
      for (let px = 0; px < 34; px++) {
        const dx = px + 0.5 - 17
        const dy = py + 0.5 - 13 + oy
        const ai = (dx / 16 + dy / 8) / 2
        const aj = (dy / 8 - dx / 16) / 2
        if (Math.abs(ai) > 0.2 || Math.abs(aj) > 0.2) continue
        const edge = Math.abs(ai) > 0.16 || Math.abs(aj) > 0.16
        const corner = Math.abs(ai) > 0.12 && Math.abs(aj) > 0.12
        rect(ctx, px, py, 1, 1, corner ? ((px + py) % 2 ? PAL.signal[3] : INK) : edge ? PAL.metal[4] : PAL.metal[3])
      }
    // the plate's front faces, so it reads as raised
    for (let k = 0; k < oy; k++) {
      for (let c = 0; c < 6; c++) {
        rect(ctx, 11 + c, 15 - oy + (c >> 1) + k, 1, 1, PAL.metal[2])
        rect(ctx, 17 + c, 17 - oy - (c >> 1) + k, 1, 1, PAL.metal[1])
      }
    }
    rect(ctx, 16, 8, 2, 1, frame % 4 < 2 ? GLOW : PAL.cyan[2])
  })
}

/**
 * Road or tyre-track tile. `mask` has bit k set when the neighbour in direction k
 * is also worn, so pieces join into continuous routes. Level 1 is just tyre
 * ruts in the dust; level 2 is a graded, compacted regolith road.
 */
function roadCanvas(level: 1 | 2, mask: number) {
  return canvas(34, 18, (ctx) => {
    for (let py = 0; py < 18; py++)
      for (let px = 0; px < 34; px++) {
        const dx = px + 0.5 - 17
        const dy = py + 0.5 - 9
        const ai = (dx / 16 + dy / 8) / 2
        const aj = (dy / 8 - dx / 16) / 2
        if (Math.abs(ai) > 0.5 || Math.abs(aj) > 0.5) continue
        const half = 0.3
        // every stretch of route this pixel lies on, as its offset from that stretch's centre line
        const across: number[] = []
        const axisI = (mask & 0b0101) !== 0 || mask === 0
        const axisJ = (mask & 0b1010) !== 0
        if ((mask & 1 && ai >= 0) || (mask & 4 && ai <= 0) || (axisI && Math.abs(ai) <= half)) across.push(aj)
        if ((mask & 2 && aj >= 0) || (mask & 8 && aj <= 0) || (axisJ && Math.abs(aj) <= half)) across.push(ai)
        const inCentre = Math.abs(ai) <= half && Math.abs(aj) <= half
        const r = hash(px, py, 91)
        if (level === 2) {
          const on = inCentre || across.some((x) => Math.abs(x) <= half)
          if (!on) continue
          const edge = !inCentre && across.every((x) => Math.abs(x) > half - 0.06)
          let c = edge ? '#ac7350' : r > 0.9 ? '#d29a70' : r < 0.1 ? '#b97c55' : '#c98c63'
          if (across.some((x) => Math.abs(Math.abs(x) - 0.13) < 0.035)) c = '#a86c48'
          rect(ctx, px, py, 1, 1, c)
        } else {
          if (across.some((x) => Math.abs(Math.abs(x) - 0.13) < 0.04) && r > 0.25) rect(ctx, px, py, 1, 1, r > 0.7 ? '#b9764f' : '#c5845b')
        }
      }
  })
}

/* ------------------------------ belt docks ------------------------------ */

/** Ports are drawn on a PORT_W × PORT_H canvas; the footprint edge's ground point sits at (PORT_AX, PORT_AY). */
export const PORT_W = 48
export const PORT_H = 44
export const PORT_AX = 24
export const PORT_AY = 28

/**
 * A dock built onto a building's edge where a belt meets it, facing outward in
 * direction `dir`. Local coords: a runs outward from the edge, b across, z up.
 * - 'out': a conveyor chute — rollers carry items out under a hazard lintel,
 *   with a cyan "running" lamp.
 * - 'in': a loader — a little robot arm reaches out over the belt, grabs an
 *   item and swings it back into the building, under an amber lamp.
 */
function portCanvas(dir: Dir, kind: 'in' | 'out', frame: number) {
  const M = PAL.metal
  const U = [(DI[dir] - DJ[dir]) * 16, (DI[dir] + DJ[dir]) * 8]
  const p = ((dir + 1) % 4) as Dir
  const V = [(DI[p] - DJ[p]) * 16, (DI[p] + DJ[p]) * 8]
  const P = (a: number, b: number, z: number) => [Math.round(PORT_AX + a * U[0] + b * V[0]), Math.round(PORT_AY + a * U[1] + b * V[1] - z)] as const
  const A0 = -0.1
  const A1 = 0.34
  const B = 0.26
  return canvas(PORT_W, PORT_H, (ctx) => {
    const dot = (a: number, b: number, z: number, c: string) => {
      const [x, y] = P(a, b, z)
      rect(ctx, x, y, 1, 1, c)
    }
    // floor: rollers that run outward (chute) or inward (loader)
    const phase = (frame / FRAMES) * (kind === 'out' ? 1 : -1)
    for (let a = A0; a <= A1; a += 1 / 64)
      for (let b = -B + 0.03; b <= B - 0.03; b += 1 / 48) {
        const r = (((a * 9 - phase * 2) % 1) + 1) % 1
        dot(a, b, 1, r < 0.35 ? M[1] : r < 0.5 ? M[3] : M[2])
      }
    // dark opening into the building at the inner end
    for (let b = -B; b <= B; b += 1 / 48) for (let z = 1; z <= 6; z += 0.5) dot(A0, b, z, z > 5 ? M[3] : INK)
    // which side wall is nearer the viewer?
    const near = P(0.1, B, 0)[1] >= P(0.1, -B, 0)[1] ? B : -B
    const wall = (b: number) => {
      const lit = P(0.1, b, 0)[0] < P(0.1, -b, 0)[0]
      for (let a = A0; a <= A1; a += 1 / 64)
        for (let z = 0; z <= 6; z += 0.5) dot(a, b, z, z > 5.4 ? PAL.rust[lit ? 4 : 2] : lit ? M[3] : M[1])
    }
    wall(-near)
    // the loader's arm: shoulder on the far wall, swinging out to the belt and back
    if (kind === 'in') {
      const k = (Math.sin((frame / FRAMES) * Math.PI * 2) + 1) / 2 // 0 = inside, 1 = over the belt
      const sh = [0.0, -near * 0.7, 7] as const
      const el = [0.12 + k * 0.12, -near * 0.15, 9 - k * 1.5] as const
      const hand = [0.18 + k * 0.2, near * 0.05, 4 - k * 1.5] as const
      const seg = (p0: readonly number[], p1: readonly number[], c1: string, c2: string) => {
        for (let s = 0; s <= 1; s += 1 / 24) {
          const a = p0[0] + (p1[0] - p0[0]) * s
          const b = p0[1] + (p1[1] - p0[1]) * s
          const z = p0[2] + (p1[2] - p0[2]) * s
          dot(a, b, z, c1)
          dot(a, b, z - 1, c2)
        }
      }
      seg(sh, el, PAL.signal[4], PAL.signal[1])
      seg(el, hand, PAL.signal[3], PAL.signal[0])
      const [hx, hy] = P(hand[0], hand[1], hand[2])
      rect(ctx, hx - 1, hy, 3, 2, M[3])
      rect(ctx, hx - 1, hy + 2, 1, 1, M[1])
      rect(ctx, hx + 1, hy + 2, 1, 1, M[1])
    }
    wall(near)
    // hazard lintel over the mouth, with the status lamp
    for (let b = -B; b <= B; b += 1 / 48)
      for (let z = 5.5; z <= 8; z += 0.5) {
        const [x, y] = P(A1, b, z)
        rect(ctx, x, y, 1, 1, (Math.floor((b + B) * 14) + Math.floor(z)) % 2 ? PAL.signal[3] : INK)
      }
    const [lx, ly] = P(A1, 0, 9.5)
    const on = frame % 4 < 2
    rect(ctx, lx - 1, ly, 3, 1, kind === 'out' ? PAL.cyan[2] : PAL.signal[1])
    rect(ctx, lx, ly - 1, 1, 3, kind === 'out' ? PAL.cyan[2] : PAL.signal[1])
    rect(ctx, lx, ly, 1, 1, kind === 'out' ? (on ? GLOW : PAL.cyan[3]) : on ? PAL.signal[4] : PAL.signal[2])
  })
}

/** Rover charging bay decal for a ground tile: yellow corner brackets and a charging post. */
function bayCanvas() {
  return canvas(34, 30, (ctx) => {
    const cx = 17
    const cy = 21
    const P = (u: number, v: number) => [Math.round(cx + (u - v) * 16), Math.round(cy + (u + v) * 8)] as const
    for (const [u, v, du, dv] of [
      [-0.38, -0.38, 1, 0],
      [-0.38, -0.38, 0, 1],
      [0.38, -0.38, -1, 0],
      [0.38, -0.38, 0, 1],
      [-0.38, 0.38, 1, 0],
      [-0.38, 0.38, 0, -1],
      [0.38, 0.38, -1, 0],
      [0.38, 0.38, 0, -1],
    ])
      for (let k = 0; k < 0.22; k += 1 / 40) {
        const [x, y] = P(u + du * k, v + dv * k)
        rect(ctx, x, y, 1, 1, PAL.signal[3])
      }
    // charging post at the back corner, with a cyan light
    const [px, py] = P(-0.3, -0.3)
    rect(ctx, px, py - 9, 2, 9, PAL.metal[3])
    rect(ctx, px + 1, py - 9, 1, 9, PAL.metal[1])
    rect(ctx, px - 1, py - 10, 4, 2, PAL.metal[2])
    rect(ctx, px, py - 7, 2, 2, GLOW)
    rect(ctx, px - 1, py, 4, 1, PAL.metal[0])
  })
}

function arrowCanvas(dir: Dir) {
  return canvas(34, 18, (ctx) => {
    for (let py = 0; py < 18; py++)
      for (let px = 0; px < 34; px++) {
        const dx = px + 0.5 - 17
        const dy = py + 0.5 - 9
        const ai = (dx / 16 + dy / 8) / 2
        const aj = (dy / 8 - dx / 16) / 2
        const [a, b] = dir === 0 ? [ai, aj] : dir === 1 ? [aj, -ai] : dir === 2 ? [-ai, -aj] : [-aj, ai]
        const head = a > 0.05 && a < 0.48 && Math.abs(b) < (0.48 - a) * 0.9
        const shaft = a > -0.35 && a <= 0.1 && Math.abs(b) < 0.08
        if (head || shaft) rect(ctx, px, py, 1, 1, head && Math.abs(b) > (0.48 - a) * 0.9 - 0.06 ? '#141c2b' : '#ffb070')
      }
  })
}

/* -------------------------------- items --------------------------------- */

function itemCanvas(id: ItemId) {
  const it = ITEMS[id]
  return canvas(10, 10, (ctx) => {
    if (id === 'water') {
      ellipseRows(ctx, 5, 6, 3, 3, it.dark)
      ellipseRows(ctx, 5, 5, 2.4, 2.4, it.color)
      rect(ctx, 5, 1, 1, 2, it.color)
      rect(ctx, 4, 4, 1, 1, '#d8f0ff')
      return
    }
    if (id === 'food') {
      ellipseRows(ctx, 5, 6, 3.4, 3, it.dark)
      ellipseRows(ctx, 4, 5, 2.4, 2.2, it.color)
      rect(ctx, 6, 1, 1, 3, '#3f7f3d')
      return
    }
    box(ctx, 5, 2, 4, 2, it.color, shade(it.color, 0.8), it.dark, false)
    if (id === 'ice') rect(ctx, 3, 4, 2, 1, '#ffffff')
    if (id === 'metal') rect(ctx, 4, 3, 3, 1, '#ffffff')
  })
}

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.round(v * f)
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`
}

/* -------------------------------- icons --------------------------------- */

const ICONS: Record<string, { art: string[]; pal: Record<string, string> }> = {
  nopower: {
    art: ['...yy.', '..yy..', '.yy...', 'yyyyy.', '..yy..', '.yy...', 'yy....'],
    pal: { y: '#ffd24a' },
  },
  noinput: {
    art: ['.wwww.', 'ww..ww', '...ww.', '..ww..', '..ww..', '......', '..ww..'],
    pal: { w: '#f4f0e8' },
  },
  blocked: {
    art: ['rr..rr', '.rrrr.', '..rr..', '.rrrr.', 'rr..rr'],
    pal: { r: '#ff5a4f' },
  },
  unshielded: {
    art: ['.yyyy.', 'yk..ky', 'y.kk.y', 'y.kk.y', 'yk..ky', '.yyyy.'],
    pal: { y: '#ffd24a', k: '#141c2b' },
  },
  badground: {
    art: ['rr..rr', '.rrrr.', '..rr..', '.rrrr.', 'rr..rr'],
    pal: { r: '#ff5a4f' },
  },
}

function iconCanvas(name: string) {
  const { art, pal } = ICONS[name]
  const w = art[0].length + 4
  const h = art.length + 4
  return canvas(w, h, (ctx) => {
    rect(ctx, 0, 0, w, h, '#101827')
    rect(ctx, 1, 1, w - 2, h - 2, '#26344a')
    art.forEach((row, y) => [...row].forEach((ch, x) => pal[ch] && rect(ctx, x + 2, y + 2, 1, 1, pal[ch])))
  })
}

/* ------------------------------- terrain -------------------------------- */

const ICE = ['#eef8fc', '#e2f2f8', '#d3eaf3', '#c2e0ed']
const ORE = ['#98544a', '#8e4b44', '#85453f', '#7b3f3a']
const SAND = ['#e8ab7b', '#e3a474', '#de9e6e', '#d89768']
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16)
const hex = (h: string) => {
  const n = parseInt(h.slice(1), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}

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

/* ----------------------------- registration ----------------------------- */

/* ------------------------------- volume --------------------------------- */

/**
 * Lighting pass on a structure layer: light comes from the upper left, so the
 * right side falls into shade and the base picks up ambient occlusion.
 */
function shadeLayer(cv: HTMLCanvasElement, ax: number, ay: number, reach: number) {
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
function outlineOf(cv: HTMLCanvasElement) {
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
function shadowOf(cv: HTMLCanvasElement) {
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

const SPEC = (big: boolean) => ({ W: big ? CORE_W : SPR_W, H: big ? CORE_H : SPR_H, ax: big ? CORE_AX : SPR_AX, ay: big ? CORE_AY : SPR_AY })

/** The bare structure: lit, no slab, no outline. */
function structure(kind: Kind, t: number, opt: { dim?: boolean; level?: number } = {}) {
  const big = isBig(kind)
  const { W, H, ax, ay } = SPEC(big)
  const layer = canvas(W, H, (ctx) => drawKind(ctx, kind, ax, ay, t, { ...opt, noSlab: true }))
  shadeLayer(layer, ax, ay, big ? 30 : 14)
  if (process.env.NODE_ENV !== 'production') {
    // anything wider than the tile would overlap its neighbours
    const d = layer.getContext('2d')!.getImageData(0, 0, W, H).data
    let lo = W
    let hi = 0
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (d[(y * W + x) * 4 + 3]) {
          lo = Math.min(lo, x)
          hi = Math.max(hi, x)
        }
    const reach = (BUILDINGS[kind].w + BUILDINGS[kind].h) * 8 - 1
    if (ax - lo > reach || hi - ax > reach) console.warn(`[art] ${kind} spills past its footprint: ${ax - lo}px left, ${hi - ax}px right (max ${reach})`)
  }
  return layer
}

/** Any freestanding object, lit and outlined like the buildings. */
function lit(w: number, h: number, ax: number, ay: number, draw: (ctx: Ctx) => void) {
  const layer = canvas(w, h, draw)
  shadeLayer(layer, ax, ay, 6)
  return canvas(w, h, (ctx) => {
    ctx.drawImage(outlineOf(layer), 0, 0)
    ctx.drawImage(layer, 0, 0)
  })
}

/** A finished building sprite: dark outline plus the lit structure. Slab and shadow live on the ground layer. */
function buildingCanvas(kind: Kind, t: number, opt: { dim?: boolean; level?: number } = {}) {
  const { W, H } = SPEC(isBig(kind))
  const layer = structure(kind, t, opt)
  return canvas(W, H, (ctx) => {
    ctx.drawImage(outlineOf(layer), 0, 0)
    ctx.drawImage(layer, 0, 0)
  })
}

export type TextureSink = (key: string, cv: HTMLCanvasElement) => void

export const ANIMATED: Kind[] = ['drill', 'excavator', 'smelter', 'kiln', 'washer', 'moxie', 'solar', 'battery', 'reactor', 'lab', 'core']

export function bakeAll(add: TextureSink) {
  const kinds: Kind[] = ['drill', 'excavator', 'melter', 'smelter', 'kiln', 'washer', 'greenhouse', 'moxie', 'habitat', 'shield', 'solar', 'battery', 'reactor', 'lab']
  for (const k of kinds) {
    for (let f = 0; f < FRAMES; f++) {
      const t = (f / FRAMES) * 2
      if (k === 'melter') {
        for (let L = 0; L < 5; L++) add(`b_melter_${L}_${f}`, buildingCanvas(k, t, { level: 0.1 + L * 0.2 }))
        continue
      }
      add(`b_${k}_${f}`, buildingCanvas(k, t))
      if (k === 'greenhouse') add(`b_greenhouse_dim_${f}`, buildingCanvas(k, t, { dim: true }))
    }
  }
  for (let f = 0; f < FRAMES; f++) add(`b_core_${f}`, buildingCanvas('core', (f / FRAMES) * 2))
  // ground layer: foundations and shadows, same canvas size and anchor as the sprites
  for (const k of [...kinds, 'core'] as Kind[]) add(`sh_${k}`, shadowOf(structure(k, 0, { level: 0.5 })))
  for (const d of [0, 1, 2, 3] as Dir[]) {
    for (let f = 0; f < FRAMES; f++) {
      add(`belt_${d}_${f}`, beltCanvas(d, f)) // plain straight piece, for the build ghost
      for (let m = 0; m < 8; m++) for (const ce of [false, true]) add(beltKey(d, m, ce, f), beltCanvas(d, f, m, ce))
    }
    add(`arrow_${d}`, arrowCanvas(d))
  }
  for (const id of Object.keys(ITEMS) as ItemId[]) add(`item_${id}`, itemCanvas(id))
  for (const d of [0, 1, 2, 3] as Dir[])
    for (let f = 0; f < FRAMES; f++) {
      add(`port_out_${d}_${f}`, lit(PORT_W, PORT_H, PORT_AX, PORT_AY, (ctx) => ctx.drawImage(portCanvas(d, 'out', f), 0, 0)))
      add(`port_in_${d}_${f}`, lit(PORT_W, PORT_H, PORT_AX, PORT_AY, (ctx) => ctx.drawImage(portCanvas(d, 'in', f), 0, 0)))
    }
  add('bay', bayCanvas())
  for (let f = 0; f < FRAMES; f++) add(`junction_${f}`, junctionCanvas(f))
  for (const n of Object.keys(ICONS)) add(`icon_${n}`, iconCanvas(n))
  add('hover', canvas(34, 18, (ctx) => diamondOutline(ctx, 17, 1, 16, '#fff7e8')))
  add('hover_bad', canvas(34, 18, (ctx) => diamondOutline(ctx, 17, 1, 16, C.red)))
  add('tile_tint', canvas(34, 18, (ctx) => diamond(ctx, 17, 1, 16, '#ffffff')))
  // construction drone: an X-frame quadcopter with four rotor discs; body centre at (11, 9)
  for (let f = 0; f < 2; f++)
    add(
      `drone_${f}`,
      lit(22, 14, 11, 11, (ctx) => {
        const rotors: [number, number][] = [
          [4, 6],
          [18, 6],
          [7, 10],
          [15, 10],
        ]
        // arms
        for (const [rx, ry] of rotors) line(ctx, 11, 8, rx, ry, C.ink2)
        // body: dark shell, orange stripe, status light
        box(ctx, 11, 5, 4, 2, '#5b6270', '#3a4150', '#262c38', false)
        rect(ctx, 8, 9, 7, 1, C.orange)
        rect(ctx, 10, 5, 2, 1, f ? C.green : '#2f7a3a')
        // rotor discs, blades blurred in two alternating poses
        for (const [rx, ry] of rotors) {
          ellipseRows(ctx, rx, ry - 1, 3, 1, '#c3cad3')
          if (f === 0) rect(ctx, rx - 3, ry - 1, 7, 1, '#f4f7fa')
          else rect(ctx, rx - 1, ry - 2, 3, 3, '#f4f7fa')
          rect(ctx, rx, ry - 1, 1, 1, C.ink)
        }
      }),
    )
  add('drone_shadow', canvas(18, 8, (ctx) => {
    ellipseRows(ctx, 9, 4, 8, 3, '#2a1012')
  }))
  // roads and tyre tracks, one piece per neighbour combination
  for (let m = 0; m < 16; m++) {
    add(`road_1_${m}`, roadCanvas(1, m))
    add(`road_2_${m}`, roadCanvas(2, m))
  }
  // crew: the website's astronaut, two walking frames, feet at (6, 12)
  for (let f = 0; f < 2; f++) add(`walker_${f}`, lit(12, 15, 6, 12, (ctx) => walker(ctx, 6, 12, f * 0.2, 0)))
  // shadow canvases are roomier than the sprite so the cast shadow isn't clipped
  add('walker_sh', shadowOf(lit(22, 20, 6, 12, (ctx) => walker(ctx, 6, 12, 0, 0))))
  add('spark', canvas(3, 3, (ctx) => {
    rect(ctx, 1, 0, 1, 3, '#fff3c4')
    rect(ctx, 0, 1, 3, 1, '#fff3c4')
  }))
  // rover: two suspension-bob frames, wheels touching the ground at (11, 16); flip in Phaser for the other heading
  for (let f = 0; f < 2; f++) add(`rover_${f}`, lit(22, 22, 11, 16, (ctx) => rover(ctx, 11, 16 - f, false)))
  add('rover_sh', shadowOf(lit(36, 30, 11, 16, (ctx) => rover(ctx, 11, 16, false))))
  add('ship', lit(26, 66, 13, 59, (ctx) => rocket(ctx, 13, 59, 0)))
  add('flame', canvas(10, 14, (ctx) => {
    ellipseRows(ctx, 5, 5, 4, 5, C.orange)
    ellipseRows(ctx, 5, 4, 2, 3, C.orange2)
  }))
}

/** A thumbnail for the build bar (tile + structure), as a data URL. */
export function thumbURL(kind: Kind) {
  return canvas(40, 48, (ctx) => {
    diamond(ctx, 20, 30, 16, C.sand[0])
    if (kind === 'belt') {
      const b = beltCanvas(0, 0)
      ctx.drawImage(b, 3, 29)
      return
    }
    if (kind === 'junction') {
      ctx.drawImage(junctionCanvas(0), 3, 25)
      return
    }
    if (!isBig(kind)) {
      ctx.drawImage(buildingCanvas(kind, 0.3, { level: 0.7 }), 20 - SPR_AX, 38 - SPR_AY)
      return
    }
    // multi-tile: draw the whole footprint, then shrink it to fit the button
    const { w, h } = BUILDINGS[kind]
    void w
    void h
    const full = canvas(CORE_W, CORE_H, (c) => c.drawImage(buildingCanvas(kind, 0.3), 0, 0))
    const k = 0.5
    ctx.imageSmoothingEnabled = true
    ctx.clearRect(0, 0, 40, 48)
    ctx.drawImage(full, 20 - CORE_AX * k, 40 - CORE_AY * k, CORE_W * k, CORE_H * k)
  }).toDataURL()
}

/** An item icon for the UI, as a data URL. */
export function itemURL(id: ItemId) {
  return itemCanvas(id).toDataURL()
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
