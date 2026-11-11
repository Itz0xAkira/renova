/**
 * Bakes every RENOVA sprite into canvases with the website's pixel engine,
 * so the game and the landing page share one art style. The pieces live in:
 *   structures.ts / pixel.ts  the buildings and their pixel toolkit
 *   logistics.ts              belts, junctions, roads, docks, bays, items
 *   terrain.ts                the ground and the sky
 *   passes.ts                 lighting, outline and shadow passes
 * This file draws buildings per tier, bakes everything into textures and
 * makes the HUD's thumbnails. It re-exports the rest, so callers import from here.
 */
import { box, C, diamond, diamondOutline, ellipseRows, rect, walker, type Ctx } from '@/site/pixel/engine'
import { BUILDINGS, ITEMS, type Dir, type ItemId, type Kind } from '@/game/core/data'
import { setTier } from '@/game/art/pixel'
import { battery, berm, bigGreenhouse, bigHabitat, bigKiln, bigLab, bigReactor, bigSmelter, bigWasher, coreBuilding, excavator, iceDrill, melter, moxie, pylon, rocket, solarArray, upgradeKit } from '@/game/art/structures'
import { canvas, FRAMES, line } from '@/game/art/canvas'

export { FRAMES } from '@/game/art/canvas'
import { arrowCanvas, bayCanvas, beltCanvas, beltKey, itemCanvas, junctionCanvas, PORT_AX, PORT_AY, PORT_H, PORT_W, portCanvas, roadCanvas } from '@/game/art/logistics'
import { lit, outlineOf, shadeLayer, shadowOf } from '@/game/art/passes'
import { beaconCanvas, beamCanvas, dustCanvas, ROVER_H, ROVER_W, ROVER_WHEEL_FRAMES, roverCanvas, roverShadowCanvas } from '@/game/art/rovers'

export { beltKey, PORT_AX, PORT_AY, PORT_H, PORT_W } from '@/game/art/logistics'
export { BEAM_AX, BEAM_AY, BEAM_H, BEAM_W, ROVER_HALF_LENGTH, ROVER_AX, ROVER_AY, ROVER_H, ROVER_SH_H, ROVER_SH_W, ROVER_W, ROVER_WHEEL_FRAMES, roverPoint } from '@/game/art/rovers'

/** Texture key for a rover frame. */
export const roverKey = (dir: Dir, frame: number, loaded: boolean) => `rover_${dir}_${frame}${loaded ? '_l' : ''}`
export { groundURL, skyCanvas, terrainCanvas, TER_H, TER_OX, TER_OY, TER_W } from '@/game/art/terrain'

/**
 * Building canvases are sized from the footprint: a w×h building spans
 * ±(w+h)·8 px across, with room on the right for shading and above for
 * towers, masts and the lander. (ax, ay) is the footprint centre.
 */
export type SpriteSpec = { W: number; H: number; ax: number; ay: number }
const specs = new Map<Kind, SpriteSpec>()
export function spriteSpec(kind: Kind): SpriteSpec {
  let s = specs.get(kind)
  if (!s) {
    const span = BUILDINGS[kind].w + BUILDINGS[kind].h
    const hw = span * 8
    const tall = 72 + span * 12
    s = { W: hw * 2 + 36, H: tall + span * 4 + 10, ax: hw + 14, ay: tall }
    specs.set(kind, s)
  }
  return s
}

export const isBig = (k: Kind) => BUILDINGS[k].w > 1 || BUILDINGS[k].h > 1

export function drawKind(ctx: Ctx, kind: Kind, x: number, y: number, t: number, opt: { dim?: boolean; level?: number; tier?: number } = {}) {
  const tier = opt.tier ?? 1
  setTier(tier)
  try {
    if (tier > 1 && kind !== 'solar' && kind !== 'pylon' && kind !== 'excavator' && kind !== 'shield') upgradeKit(ctx, x, y, BUILDINGS[kind].w, BUILDINGS[kind].h, t, tier)
    drawKindInner(ctx, kind, x, y, t, opt, tier)
  } finally {
    setTier(1)
  }
}

function drawKindInner(ctx: Ctx, kind: Kind, x: number, y: number, t: number, opt: { dim?: boolean; level?: number }, tier: number) {
  switch (kind) {
    case 'pylon':
      return pylon(ctx, x, y, t, tier)
    case 'drill':
      return iceDrill(ctx, x, y, t)
    case 'excavator':
      return excavator(ctx, x, y, t)
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
      return solarArray(ctx, x, y, t, tier)
    case 'battery':
      return battery(ctx, x, y, t)
    case 'reactor':
      return bigReactor(ctx, x, y, t)
    case 'lab':
      return bigLab(ctx, x, y, t)
    case 'core':
      return coreBuilding(ctx, x, y, t)
    case 'belt':
      return
  }
}

/* ---------------------------- status badges ----------------------------- */

/** Little badges drawn over a building that needs attention, keyed by its status. */
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
  nogrid: {
    art: ['.y..y.', '.y..y.', 'yyyyyy', 'yyyyyy', '.yyyy.', '..yy..', '..r...'],
    pal: { y: '#d86b7b', r: '#ffd24a' },
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

/* -------------------------------- baking -------------------------------- */


/** The bare structure: lit, no slab, no outline. */
function structure(kind: Kind, t: number, opt: { dim?: boolean; level?: number; tier?: number } = {}) {
  const big = isBig(kind)
  const { W, H, ax, ay } = spriteSpec(kind)
  const layer = canvas(W, H, (ctx) => drawKind(ctx, kind, ax, ay, t, opt))
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

/** A finished building sprite: dark outline plus the lit structure. Slab and shadow live on the ground layer. */
function buildingCanvas(kind: Kind, t: number, opt: { dim?: boolean; level?: number; tier?: number } = {}) {
  const { W, H } = spriteSpec(kind)
  const layer = structure(kind, t, opt)
  return canvas(W, H, (ctx) => {
    ctx.drawImage(outlineOf(layer), 0, 0)
    ctx.drawImage(layer, 0, 0)
  })
}

export type TextureSink = (key: string, cv: HTMLCanvasElement) => void

export const ANIMATED: Kind[] = ['drill', 'excavator', 'smelter', 'kiln', 'washer', 'moxie', 'solar', 'battery', 'reactor', 'lab', 'core']

/** Texture key for a building frame. Level 1 keeps the original names; upgrades add `_T<n>`. `variant` is `_dim` or a melter's `_<water level>`. */
export const bKey = (kind: Kind, tier: number, f: number, variant = '') => (tier === 1 ? `b_${kind}${variant}_${f}` : `b_${kind}_T${tier}${variant}_${f}`)
export const shKey = (kind: Kind, tier: number) => (tier === 1 ? `sh_${kind}` : `sh_${kind}_T${tier}`)

/** Bake every frame of an upgraded building. Done on demand, the first time one appears. */
export function bakeTier(add: TextureSink, kind: Kind, tier: number) {
  for (let f = 0; f < FRAMES; f++) {
    const t = (f / FRAMES) * 2
    if (kind === 'melter') for (let L = 0; L < 5; L++) add(bKey(kind, tier, f, `_${L}`), buildingCanvas(kind, t, { level: 0.1 + L * 0.2, tier }))
    else add(bKey(kind, tier, f), buildingCanvas(kind, t, { tier }))
    if (kind === 'greenhouse') add(bKey(kind, tier, f, '_dim'), buildingCanvas(kind, t, { dim: true, tier }))
  }
  add(shKey(kind, tier), shadowOf(structure(kind, 0, { level: 0.5, tier })))
}

export function bakeAll(add: TextureSink) {
  const kinds: Kind[] = ['drill', 'excavator', 'melter', 'smelter', 'kiln', 'washer', 'greenhouse', 'moxie', 'habitat', 'shield', 'solar', 'pylon', 'battery', 'reactor', 'lab']
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
  // rovers: every heading, wheel frame and load, already lit; outlined like everything else
  for (const d of [0, 1, 2, 3] as Dir[]) {
    for (const loaded of [false, true])
      for (let f = 0; f < ROVER_WHEEL_FRAMES; f++) {
        const body = roverCanvas(d, f, loaded)
        add(roverKey(d, f, loaded), canvas(ROVER_W, ROVER_H, (ctx) => (ctx.drawImage(outlineOf(body), 0, 0), ctx.drawImage(body, 0, 0))))
      }
    add(`rover_sh_${d}`, roverShadowCanvas(d))
    add(`rover_beam_${d}`, beamCanvas(d))
  }
  add('rover_beacon', beaconCanvas())
  add('dust', dustCanvas())
  add('ship', lit(26, 66, 13, 59, (ctx) => rocket(ctx, 13, 59, 0)))
  add('flame', canvas(10, 14, (ctx) => {
    ellipseRows(ctx, 5, 5, 4, 5, C.orange)
    ellipseRows(ctx, 5, 4, 2, 3, C.orange2)
  }))
}

/** A building as the game shows it, for the dev art preview. */
export function previewCanvas(kind: Kind, tier: number, t: number) {
  return buildingCanvas(kind, t, { tier, level: 0.7 })
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
    // the whole footprint, shrunk to fit the button
    const { W, H, ax, ay } = spriteSpec(kind)
    const span = BUILDINGS[kind].w + BUILDINGS[kind].h
    const k = Math.min(1, 34 / (span * 16))
    ctx.imageSmoothingEnabled = k < 1
    ctx.clearRect(0, 0, 40, 48)
    ctx.drawImage(buildingCanvas(kind, 0.3, { level: 0.7 }), 20 - ax * k, 40 - ay * k, W * k, H * k)
  }).toDataURL()
}

/** An item icon for the UI, as a data URL. */
export function itemURL(id: ItemId) {
  return itemCanvas(id).toDataURL()
}
