/**
 * The colony rover: a six-wheeled rocker-bogie hauler in the colony's
 * gunmetal, rust and cyan, drawn for all four headings so the light always
 * comes from the upper left (flipping a sprite would flip its lighting too).
 *
 * The rover is modelled as a few boxes and cylinders in its own frame
 * (a along its heading, b across, z up, in tiles) and rasterised into a
 * pixel z-buffer, then shaded with the same dithered material ramps as the
 * buildings. Wheel frames spin the tyre tread; the hopper has an empty and
 * a loaded version.
 */
import { DI, DJ, type Dir } from '@/game/core/data'
import { INK, RAMP, tone, type Ramp } from '@/game/art/pixel'
import { canvas } from '@/game/art/canvas'

/** Rover sprites are ROVER_W × ROVER_H with the ground point under the rover's middle at (ROVER_AX, ROVER_AY). */
export const ROVER_W = 40
export const ROVER_H = 38
export const ROVER_AX = 20
export const ROVER_AY = 27
/** Shadow canvases are roomier, so the cast shadow isn't clipped. Same anchor. */
export const ROVER_SH_W = 60
export const ROVER_SH_H = 44
export const ROVER_WHEEL_FRAMES = 4

/** Vertical pixels per tile of height. Heights are exaggerated a little, like the buildings. */
const ZS = 22
/** The model is laid out in a unit box; this stretches it over the ground (tiles per model unit). */
const SPREAD = 1.3
/** Toward the light: mostly from above, from the +j side (the lit, screen-left walls). */
const L = (() => {
  const v = [0.1, 0.55, 0.82]
  const n = Math.hypot(v[0], v[1], v[2])
  return v.map((x) => x / n) as [number, number, number]
})()

type Vec = [number, number, number]
/** Which surface of a part is being drawn, and where on it (0–1), for patterns. */
type Face = 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right' | 'tread' | 'cap'
type Paint = (face: Face, u: number, v: number) => { ramp: Ramp; shift?: number } | null

type Part =
  | { kind: 'box'; a: [number, number]; b: [number, number]; z: [number, number]; paint: Paint }
  | { kind: 'wheel'; a: number; b: number; z: number; r: number; w: number; paint: Paint }

const solid = (ramp: Ramp, shift = 0): Paint => () => ({ ramp, shift })

/* ------------------------------- the model ------------------------------- */

const WHEEL_R = 0.11
const WHEEL_W = 0.07
const TRACK = 0.29 // wheel centre, either side of the middle
const AXLES = [-0.3, 0, 0.3]

function model(spin: number, loaded: boolean): Part[] {
  const parts: Part[] = []

  // wheels: dark tyres with chevron tread that turns with `spin`, steel hubs
  const tyre: Paint = (face, u, v) => {
    if (face === 'cap') {
      // u: radius 0–1, v: angle 0–1
      if (u < 0.3) return { ramp: RAMP.metalHi, shift: 0.1 }
      if (u < 0.42) return { ramp: RAMP.metal, shift: -0.2 }
      if (u < 0.72) return { ramp: RAMP.metalHi, shift: -0.15 + (Math.floor((v + spin / 24) * 6) % 2) * 0.12 }
      return { ramp: RAMP.metal, shift: 0.05 }
    }
    // tread: grooves every 1/10 of the way round, moving with the spin
    const g = (v * 10 + spin * 2.5 + (u > 0.5 ? 0.5 : 0)) % 1
    return { ramp: RAMP.metal, shift: g < 0.35 ? -0.35 : 0.05 }
  }
  for (const a of AXLES) for (const s of [-1, 1]) parts.push({ kind: 'wheel', a, b: s * TRACK, z: WHEEL_R, r: WHEEL_R, w: WHEEL_W, paint: tyre })

  // rocker-bogie: a beam each side, a strut down to every hub, a pivot on the body
  const strut = solid(RAMP.metalHi, -0.1)
  for (const s of [-1, 1]) {
    const b: [number, number] = s < 0 ? [-TRACK + 0.035, -TRACK + 0.065] : [TRACK - 0.065, TRACK - 0.035]
    parts.push({ kind: 'box', a: [-0.32, 0.32], b, z: [0.165, 0.19], paint: solid(RAMP.metalHi, 0.05) })
    for (const a of AXLES) parts.push({ kind: 'box', a: [a - 0.014, a + 0.014], b, z: [WHEEL_R, 0.17], paint: strut })
    parts.push({ kind: 'box', a: [-0.06, 0.06], b: s < 0 ? [-0.25, -0.2] : [0.2, 0.25], z: [0.17, 0.24], paint: solid(RAMP.rust, 0.05) })
  }

  // chassis: gunmetal tub with a rust armour band and a hazard stripe at the nose
  parts.push({
    kind: 'box',
    a: [-0.36, 0.33],
    b: [-0.2, 0.2],
    z: [0.17, 0.3],
    paint: (face, u, v) => {
      if (face === 'top') return { ramp: RAMP.metalHi, shift: 0 }
      if (face === 'front') {
        // headlights either side, a dark grille between
        if (v > 0.45 && v < 0.75 && (u < 0.22 || u > 0.78)) return { ramp: RAMP.signal, shift: 0.35 }
        if (v > 0.35 && v < 0.8 && u > 0.32 && u < 0.68) return { ramp: RAMP.metal, shift: -0.3 + (Math.floor(u * 14) % 2) * 0.15 }
        return { ramp: RAMP.hull, shift: -0.1 }
      }
      if (face === 'left' || face === 'right') {
        // u runs along the rover; the band sits in the middle third of the wall
        if (v > 0.38 && v < 0.62) return { ramp: RAMP.rust, shift: 0.05 }
        if (u > 0.9 && v >= 0.62) return { ramp: RAMP.signal, shift: Math.floor(u * 40 + v * 6) % 2 ? 0.2 : -0.25 }
        if (v < 0.2) return { ramp: RAMP.metal, shift: 0.1 }
        // panel seams every fifth of the way along
        return { ramp: RAMP.hull, shift: (u * 5) % 1 < 0.08 ? -0.25 : 0 }
      }
      return { ramp: RAMP.hull, shift: -0.15 }
    },
  })

  // hopper at the back: rust walls; empty it shows its dark floor, loaded a heap of ore
  const wall: Paint = (face, u) => ({ ramp: RAMP.metalHi, shift: face === 'top' ? 0.1 : (u * 4) % 1 < 0.18 ? 0.12 : -0.1 })
  const hb: [number, number] = [-0.19, 0.19]
  parts.push({ kind: 'box', a: [-0.35, -0.32], b: hb, z: [0.3, 0.41], paint: wall })
  parts.push({ kind: 'box', a: [-0.05, -0.02], b: hb, z: [0.3, 0.41], paint: wall })
  parts.push({ kind: 'box', a: [-0.35, -0.02], b: [-0.19, -0.16], z: [0.3, 0.41], paint: wall })
  parts.push({ kind: 'box', a: [-0.35, -0.02], b: [0.16, 0.19], z: [0.3, 0.41], paint: wall })
  // the rim catches the light
  parts.push({ kind: 'box', a: [-0.35, -0.02], b: [-0.19, -0.18], z: [0.41, 0.42], paint: solid(RAMP.rust, 0.15) })
  parts.push({ kind: 'box', a: [-0.35, -0.02], b: [0.18, 0.19], z: [0.41, 0.42], paint: solid(RAMP.rust, 0.15) })
  if (loaded) {
    parts.push({
      kind: 'box',
      a: [-0.32, -0.05],
      b: [-0.16, 0.16],
      z: [0.3, 0.405],
      paint: (face, u, v) => (face === 'top' ? { ramp: RAMP.regolith, shift: ((Math.floor(u * 9) * 7 + Math.floor(v * 7) * 3) % 5) * 0.06 - 0.1 } : { ramp: RAMP.regolith, shift: -0.2 }),
    })
    // a heap, not a slab
    parts.push({ kind: 'box', a: [-0.24, -0.12], b: [-0.08, 0.08], z: [0.405, 0.44], paint: solid(RAMP.regolith, 0.05) })
  } else parts.push({ kind: 'box', a: [-0.32, -0.05], b: [-0.16, 0.16], z: [0.3, 0.31], paint: solid(RAMP.metal, -0.25) })

  // cab: beige container panels, cyan windscreen on the nose and the sides
  parts.push({
    kind: 'box',
    a: [0.01, 0.31],
    b: [-0.17, 0.17],
    z: [0.3, 0.45],
    paint: (face, u, v) => {
      if (face === 'top') return { ramp: RAMP.hull, shift: 0.1 }
      if (face === 'front' && v > 0.38 && v < 0.85 && u > 0.1 && u < 0.9) return { ramp: RAMP.cyan, shift: 0.15 - v * 0.3 + (u + v > 1.1 && u + v < 1.25 ? 0.4 : 0) }
      if ((face === 'left' || face === 'right') && v > 0.42 && v < 0.82 && u > 0.55 && u < 0.92) return { ramp: RAMP.cyan, shift: -0.05 }
      if (v < 0.14) return { ramp: RAMP.rust, shift: -0.05 }
      return { ramp: RAMP.hull, shift: (face === 'left' || face === 'right') && (u * 3) % 1 < 0.1 ? -0.2 : 0.05 }
    },
  })
  // solar wing on the cab roof
  parts.push({
    kind: 'box',
    a: [0.04, 0.28],
    b: [-0.2, 0.2],
    z: [0.45, 0.465],
    paint: (face, u, v) => (face === 'top' ? { ramp: RAMP.cyan, shift: (u * 4) % 1 < 0.14 || (v * 5) % 1 < 0.14 ? -0.35 : 0.05 - u * 0.15 } : { ramp: RAMP.metalHi, shift: 0 }),
  })

  // mast with a camera head looking forward
  parts.push({ kind: 'box', a: [0.2, 0.235], b: [0.09, 0.125], z: [0.465, 0.82], paint: solid(RAMP.metalHi, 0) })
  parts.push({
    kind: 'box',
    a: [0.17, 0.27],
    b: [0.055, 0.16],
    z: [0.82, 0.9],
    paint: (face, u, v) => (face === 'front' && v > 0.3 && v < 0.75 && (u < 0.4 || u > 0.6) ? { ramp: RAMP.cyan, shift: 0.3 } : { ramp: face === 'top' ? RAMP.neutral : RAMP.metalHi, shift: face === 'top' ? 0 : 0.05 }),
  })

  // whip antenna at the back corner (the beacon on top is a separate sprite, so it can blink)
  parts.push({ kind: 'box', a: [-0.33, -0.31], b: [-0.17, -0.15], z: [0.42, 0.78], paint: solid(RAMP.neutral, -0.1) })
  return parts
}

/** Where the beacon (antenna tip) and the headlights sit, in the rover's frame. */
const BEACON: Vec = [-0.32, -0.16, 0.8]
const LAMPS: Vec = [0.36, 0, 0.23]

/* ------------------------------ rasteriser ------------------------------ */

/** The rover's frame → world (i, j, z) for a heading. */
function toWorld(dir: Dir, a: number, b: number, z: number): Vec {
  const ai = DI[dir]
  const aj = DJ[dir]
  // b is a's left-hand side, so the rover is the same way round whichever way it faces
  return [(a * ai - b * aj) * SPREAD, (a * aj + b * ai) * SPREAD, z]
}
const project = (ax: number, ay: number, p: Vec) => [ax + (p[0] - p[1]) * 16, ay + (p[0] + p[1]) * 8 - p[2] * ZS] as const
/** Larger is nearer the camera: the view ray runs along (1, 1, ½). */
const depthOf = (p: Vec) => p[0] + p[1] + 0.5 * p[2]

/** Screen offset (px from the ground anchor) of a point on the rover, for a heading. */
export function roverPoint(dir: Dir, which: 'beacon' | 'lamps') {
  const [a, b, z] = which === 'beacon' ? BEACON : LAMPS
  const [x, y] = project(0, 0, toWorld(dir, a, b, z))
  return [Math.round(x), Math.round(y)] as const
}

function rasterise(W: number, H: number, ax: number, ay: number, dir: Dir, parts: Part[]) {
  const zb = new Float32Array(W * H).fill(-Infinity)
  const col: string[] = new Array(W * H)
  const nrm = (n: Vec): Vec => toWorld(dir, n[0], n[1], n[2])
  const plot = (p: Vec, n: Vec, face: Face, u: number, v: number, paint: Paint) => {
    const [x, y] = project(ax, ay, p)
    const px = Math.floor(x)
    const py = Math.floor(y)
    if (px < 0 || py < 0 || px >= W || py >= H) return
    const d = depthOf(p)
    const k = py * W + px
    if (d <= zb[k]) return
    const look = paint(face, u, v)
    if (!look) return
    zb[k] = d
    const lit = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2])
    col[k] = tone(look.ramp, 0.2 + 0.72 * lit + (look.shift ?? 0), px, py)
  }
  const STEP = 0.009
  for (const part of parts) {
    if (part.kind === 'box') {
      const [a0, a1] = part.a
      const [b0, b1] = part.b
      const [z0, z1] = part.z
      const na = Math.max(1, Math.ceil((a1 - a0) / STEP))
      const nb = Math.max(1, Math.ceil((b1 - b0) / STEP))
      const nz = Math.max(1, Math.ceil((z1 - z0) / STEP))
      const at = (s: number, n: number, lo: number, hi: number) => lo + ((hi - lo) * s) / n
      // top and bottom (u along a, v across b)
      for (let s = 0; s <= na; s++)
        for (let t = 0; t <= nb; t++) {
          const a = at(s, na, a0, a1)
          const b = at(t, nb, b0, b1)
          plot(toWorld(dir, a, b, z1), nrm([0, 0, 1]), 'top', s / na, t / nb, part.paint)
          plot(toWorld(dir, a, b, z0), nrm([0, 0, -1]), 'bottom', s / na, t / nb, part.paint)
        }
      // nose and tail (u across b, v up)
      for (let t = 0; t <= nb; t++)
        for (let r = 0; r <= nz; r++) {
          const b = at(t, nb, b0, b1)
          const z = at(r, nz, z0, z1)
          plot(toWorld(dir, a1, b, z), nrm([1, 0, 0]), 'front', t / nb, r / nz, part.paint)
          plot(toWorld(dir, a0, b, z), nrm([-1, 0, 0]), 'back', t / nb, r / nz, part.paint)
        }
      // sides (u along a, v up)
      for (let s = 0; s <= na; s++)
        for (let r = 0; r <= nz; r++) {
          const a = at(s, na, a0, a1)
          const z = at(r, nz, z0, z1)
          plot(toWorld(dir, a, b1, z), nrm([0, 1, 0]), 'left', s / na, r / nz, part.paint)
          plot(toWorld(dir, a, b0, z), nrm([0, -1, 0]), 'right', s / na, r / nz, part.paint)
        }
    } else {
      // wheel: axle across b; tread round the outside, a cap on each face
      const { a, b, z, r, w, paint } = part
      const nθ = Math.ceil((2 * Math.PI * r) / (STEP * 0.7))
      const nw = Math.max(2, Math.ceil(w / STEP))
      const nr = Math.max(2, Math.ceil(r / (STEP * 0.7)))
      for (let k = 0; k < nθ; k++) {
        const th = (k / nθ) * Math.PI * 2
        const c = Math.cos(th)
        const s = Math.sin(th)
        for (let q = 0; q <= nw; q++) plot(toWorld(dir, a + c * r, b - w / 2 + (w * q) / nw, z + s * r), nrm([c, 0, s]), 'tread', q / nw, k / nθ, paint)
        for (let q = 0; q <= nr; q++) {
          const rr = (r * q) / nr
          for (const side of [-1, 1]) plot(toWorld(dir, a + c * rr, b + (side * w) / 2, z + s * rr), nrm([0, side, 0]), 'cap', q / nr, k / nθ, paint)
        }
      }
    }
  }
  return canvas(W, H, (ctx) => {
    for (let k = 0; k < W * H; k++) {
      if (!col[k]) continue
      ctx.fillStyle = col[k]
      ctx.fillRect(k % W, Math.floor(k / W), 1, 1)
    }
  })
}

/**
 * The rover's ground shadow: every point of the model slid down the light onto
 * the ground (+i, 0.58 px across per px of height, like the buildings' shadows).
 */
export function roverShadowCanvas(dir: Dir) {
  const W = ROVER_SH_W
  const H = ROVER_SH_H
  const hit = new Uint8Array(W * H)
  const per = (0.58 * ZS) / 16 // tiles along +i per tile of height
  for (const part of model(0, false)) {
    const pts: Vec[] = []
    if (part.kind === 'box') {
      for (let a = part.a[0]; a <= part.a[1]; a += 0.01) for (let b = part.b[0]; b <= part.b[1]; b += 0.01) for (const z of part.z) pts.push(toWorld(dir, a, b, z))
    } else for (let k = 0; k < 24; k++) for (const s of [-1, 1]) pts.push(toWorld(dir, part.a + Math.cos((k / 24) * Math.PI * 2) * part.r, part.b + (s * part.w) / 2, part.z + Math.sin((k / 24) * Math.PI * 2) * part.r))
    for (const p of pts) {
      const [x, y] = project(ROVER_AX, ROVER_AY, [p[0] + p[2] * per, p[1], 0])
      const px = Math.floor(x)
      const py = Math.floor(y)
      if (px >= 0 && py >= 0 && px < W && py < H) hit[py * W + px] = 1
    }
  }
  return canvas(W, H, (ctx) => {
    ctx.fillStyle = '#2a1012'
    for (let k = 0; k < W * H; k++) {
      // close pinholes: a pixel with three lit neighbours is in the shadow too
      const x = k % W
      const y = Math.floor(k / W)
      const n = (hit[k - 1] ?? 0) + (hit[k + 1] ?? 0) + (hit[k - W] ?? 0) + (hit[k + W] ?? 0)
      if (hit[k] || (x > 0 && x < W - 1 && n >= 3)) ctx.fillRect(x, y, 1, 1)
    }
  })
}

/** One rover frame, unlit by the scene's passes (it carries its own lighting). */
export function roverCanvas(dir: Dir, frame: number, loaded: boolean, W = ROVER_W, H = ROVER_H) {
  return rasterise(W, H, ROVER_AX, ROVER_AY, dir, model(frame, loaded))
}

/** Headlight pool on the ground ahead of a rover, drawn additively at night. Anchored like the rover. */
export const BEAM_W = 72
export const BEAM_H = 48
export const BEAM_AX = 36
export const BEAM_AY = 24
export function beamCanvas(dir: Dir) {
  return canvas(BEAM_W, BEAM_H, (ctx) => {
    for (let py = 0; py < BEAM_H; py++)
      for (let px = 0; px < BEAM_W; px++) {
        // back from screen to the ground plane, then into the rover's frame
        const sx = (px + 0.5 - BEAM_AX) / 16
        const sy = (py + 0.5 - BEAM_AY) / 8
        const i = (sx + sy) / 2
        const j = (sy - sx) / 2
        const a = i * DI[dir] + j * DJ[dir]
        const b = -i * DJ[dir] + j * DI[dir]
        if (a < 0.3) continue
        const spread = 0.12 + (a - 0.3) * 0.55
        if (Math.abs(b) > spread || a > 1.5) continue
        const k = (1 - (a - 0.3) / 1.2) * (1 - Math.abs(b) / spread) ** 0.6
        const bands = k > 0.55 ? 3 : k > 0.3 ? 2 : k > 0.12 ? 1 : 0
        if (!bands) continue
        ctx.fillStyle = ['', '#4a3410', '#8a6420', '#d9a53c'][bands]
        ctx.fillRect(px, py, 1, 1)
      }
  })
}

/** The beacon: a 3×3 light, tinted in the scene (amber driving, cyan charging). */
export function beaconCanvas() {
  return canvas(5, 5, (ctx) => {
    ctx.fillStyle = INK
    ctx.fillRect(1, 1, 3, 3)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(2, 1, 1, 3)
    ctx.fillRect(1, 2, 3, 1)
  })
}

/** A puff of dust kicked up by the wheels. */
export function dustCanvas() {
  return canvas(8, 5, (ctx) => {
    ctx.fillStyle = '#c98a5c'
    ctx.fillRect(1, 1, 6, 3)
    ctx.fillRect(2, 0, 4, 5)
    ctx.fillStyle = '#e0a979'
    ctx.fillRect(2, 1, 3, 2)
  })
}
