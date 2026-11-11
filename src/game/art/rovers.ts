/**
 * The colony rover: a pressurised crew rover for long trips across the
 * plains. A long white cabin with a raked, wraparound windscreen rides on six
 * big balloon-tread wheels; the roof carries a solar array, a dish and a whip
 * antenna; an airlock hatch opens onto a pickup bed at the back, which is empty
 * heading out and loaded with ore, sacks and a crate heading home.
 *
 * It's drawn for all four headings so the light always comes from the upper
 * left (flipping a sprite would flip its lighting too). The rover is modelled
 * as boxes (one with a raked top) and cylinders in its own frame (a along its
 * heading, b across, z up, in tiles), rasterised into a pixel z-buffer and
 * shaded with the same dithered material ramps as the buildings. Wheel frames
 * turn the tread.
 */
import { DI, DJ, type Dir } from '@/game/core/data'
import { INK, RAMP, tone, type Ramp } from '@/game/art/pixel'
import { canvas } from '@/game/art/canvas'

/** Rover sprites are ROVER_W × ROVER_H with the ground point under the rover's middle at (ROVER_AX, ROVER_AY). */
export const ROVER_W = 56
export const ROVER_H = 42
export const ROVER_AX = 28
export const ROVER_AY = 30
/** Shadow canvases are roomier, so the cast shadow isn't clipped. Same anchor. */
export const ROVER_SH_W = 80
export const ROVER_SH_H = 48
export const ROVER_WHEEL_FRAMES = 4
/** Half the rover's length in tiles, for effects that start at its tail. */
export const ROVER_HALF_LENGTH = 0.6

/** Vertical pixels per tile of height. Heights are exaggerated a little, like the buildings. */
const ZS = 24
/** The model is drawn a little longer than it's laid out, so it reads as a long expedition vehicle. */
const LONG = 1.22
/** Toward the light: mostly from above, from the +j side (the lit, screen-left walls). */
const L = (() => {
  const v = [0.1, 0.55, 0.82]
  const n = Math.hypot(v[0], v[1], v[2])
  return v.map((x) => x / n) as [number, number, number]
})()

type Vec = [number, number, number]
/** Which surface of a part is being drawn, and where on it (0–1), for patterns. `slope` is a raked top. */
type Face = 'top' | 'slope' | 'bottom' | 'front' | 'back' | 'left' | 'right' | 'tread' | 'cap'
type Paint = (face: Face, u: number, v: number) => { ramp: Ramp; shift?: number } | null

type Part =
  | {
      kind: 'box'
      a: [number, number]
      b: [number, number]
      z: [number, number]
      /** Rake the top down toward the front: from `from` (along a) to the nose, dropping `drop`. */
      rake?: { from: number; drop: number }
      paint: Paint
    }
  | { kind: 'wheel'; a: number; b: number; z: number; r: number; w: number; paint: Paint }

const solid = (ramp: Ramp, shift = 0): Paint => () => ({ ramp, shift })

/* ------------------------------- the model ------------------------------- */

const WHEEL_R = 0.135
const WHEEL_W = 0.1
const TRACK = 0.3 // wheel centre, either side of the middle
const AXLES = [-0.34, 0.0, 0.34]

/** The cabin's shape, shared by the paint so windows follow the rake. */
const CAB = { a: [-0.12, 0.48] as [number, number], b: [-0.235, 0.235] as [number, number], z: [0.25, 0.53] as [number, number], rakeFrom: 0.22, drop: 0.15 }
const rakeU = (CAB.rakeFrom - CAB.a[0]) / (CAB.a[1] - CAB.a[0])

function model(spin: number, loaded: boolean): Part[] {
  const parts: Part[] = []

  // big balloon tyres: chunky tread blocks that roll with `spin`, deep-dish hubs
  const tyre: Paint = (face, u, v) => {
    if (face === 'cap') {
      // u: radius 0–1, v: angle 0–1
      if (u < 0.18) return { ramp: RAMP.metalHi, shift: 0.15 }
      if (u < 0.5) return { ramp: RAMP.neutral, shift: -0.05 + (Math.floor((v + spin / 32) * 8) % 2) * -0.15 }
      if (u < 0.6) return { ramp: RAMP.metal, shift: -0.25 }
      return { ramp: RAMP.metal, shift: (Math.floor((v + spin / 40) * 10) % 2) * 0.12 }
    }
    // tread: staggered blocks every 1/10 of the way round
    const g = (v * 10 + spin / ROVER_WHEEL_FRAMES + (u > 0.5 ? 0.5 : 0)) % 1
    return { ramp: RAMP.metal, shift: g < 0.4 ? -0.35 : 0.1 }
  }
  for (const a of AXLES) for (const s of [-1, 1]) parts.push({ kind: 'wheel', a, b: s * TRACK, z: WHEEL_R, r: WHEEL_R, w: WHEEL_W, paint: tyre })

  // fenders over every wheel, and the suspension arms that carry them
  for (const a of AXLES)
    for (const s of [-1, 1]) {
      const b: [number, number] = s < 0 ? [-TRACK - 0.06, -0.2] : [0.2, TRACK + 0.06]
      parts.push({ kind: 'box', a: [a - 0.15, a + 0.15], b, z: [0.275, 0.3], paint: (face) => ({ ramp: face === 'top' ? RAMP.hull : RAMP.metalHi, shift: face === 'top' ? -0.05 : -0.1 }) })
      parts.push({ kind: 'box', a: [a - 0.02, a + 0.02], b: s < 0 ? [-TRACK + 0.04, -0.2] : [0.2, TRACK - 0.04], z: [WHEEL_R - 0.02, 0.21], paint: solid(RAMP.metal, 0.05) })
    }

  // chassis: a grey skirt the length of the rover, with an orange rescue stripe
  parts.push({
    kind: 'box',
    a: [-0.5, 0.47],
    b: [-0.22, 0.22],
    z: [0.15, 0.25],
    paint: (face, u, v) => {
      if (face === 'top') return { ramp: RAMP.metalHi, shift: 0 }
      if (face === 'front') {
        // a bumper with tow points
        if (v < 0.4 && (u < 0.15 || u > 0.85)) return { ramp: RAMP.signal, shift: 0.1 }
        return { ramp: RAMP.metal, shift: 0.15 + (Math.floor(u * 10) % 2) * 0.08 }
      }
      if ((face === 'left' || face === 'right') && v > 0.55 && v < 0.85) return { ramp: RAMP.orange, shift: 0 }
      return { ramp: RAMP.metalHi, shift: -0.12 }
    },
  })

  // the pressurised cabin, its windscreen raked back over the nose
  const cabLen = CAB.a[1] - CAB.a[0]
  parts.push({
    kind: 'box',
    a: CAB.a,
    b: CAB.b,
    z: CAB.z,
    rake: { from: CAB.rakeFrom, drop: CAB.drop },
    paint: (face, u, v) => {
      if (face === 'slope') {
        // tinted glass with a glint running across it, framed at the edges
        if (v < 0.07 || v > 0.93) return { ramp: RAMP.hull, shift: -0.1 }
        const glint = Math.abs(u - (rakeU + 0.18) - (v - 0.5) * 0.3) < 0.03
        return { ramp: RAMP.navy, shift: glint ? 0.65 : 0.2 - (u - rakeU) * 0.4 }
      }
      if (face === 'top') {
        // roof hatch seams
        return { ramp: RAMP.hull, shift: (u * cabLen) % 0.2 < 0.015 ? -0.18 : 0.05 }
      }
      if (face === 'front') {
        // lower nose: headlights at the corners, sensor bar in the middle
        if (v > 0.25 && v < 0.5 && (u < 0.2 || u > 0.8)) return { ramp: RAMP.signal, shift: 0.45 }
        if (v > 0.3 && v < 0.45 && u > 0.35 && u < 0.65) return { ramp: RAMP.navy, shift: 0.2 }
        return { ramp: RAMP.hull, shift: -0.08 }
      }
      if (face === 'back') {
        // the airlock: a round hatch with a heavy frame and a handwheel
        const d = Math.hypot((u - 0.5) * 1.6, v - 0.48)
        if (d < 0.07) return { ramp: RAMP.metal, shift: 0.1 }
        if (d < 0.26) return { ramp: RAMP.hull, shift: -0.12 }
        if (d < 0.33) return { ramp: RAMP.metalHi, shift: 0 }
        return { ramp: RAMP.hull, shift: -0.06 }
      }
      if (face === 'left' || face === 'right') {
        // wraparound windows at the front, two portholes behind, panel seams
        const top = u > rakeU ? 1 - ((u - rakeU) / (1 - rakeU)) * (CAB.drop / (CAB.z[1] - CAB.z[0])) : 1
        if (u > rakeU - 0.12 && v > 0.42 && v < top - 0.08) return { ramp: RAMP.navy, shift: v > top - 0.2 ? 0.35 : 0.15 }
        for (const p of [0.22]) if (Math.hypot((u - p) * 3.2, v - 0.62) < 0.13) return { ramp: RAMP.navy, shift: 0.25 }
        if (v < 0.12) return { ramp: RAMP.metalHi, shift: -0.05 }
        return { ramp: RAMP.hull, shift: (u * cabLen) % 0.19 < 0.012 ? -0.2 : 0 }
      }
      return { ramp: RAMP.hull, shift: -0.2 }
    },
  })

  // solar array on the roof, raised on short legs
  for (const a of [-0.07, 0.13]) for (const b of [-0.18, 0.18]) parts.push({ kind: 'box', a: [a - 0.015, a + 0.015], b: [b - 0.015, b + 0.015], z: [0.53, 0.56], paint: solid(RAMP.metal, 0.1) })
  parts.push({
    kind: 'box',
    a: [-0.1, 0.17],
    b: [-0.25, 0.25],
    z: [0.56, 0.575],
    paint: (face, u, v) => {
      if (face !== 'top') return { ramp: RAMP.metalHi, shift: -0.05 }
      if (u < 0.04 || u > 0.96 || v < 0.05 || v > 0.95) return { ramp: RAMP.metalHi, shift: 0.05 }
      return { ramp: RAMP.cyan, shift: (u * 5) % 1 < 0.12 || (v * 4) % 1 < 0.12 ? -0.4 : 0.05 - u * 0.2 + (u + v > 0.9 && u + v < 1 ? 0.35 : 0) }
    },
  })

  // comms: a dish on a stub mast at the back, a whip antenna on the other side (its beacon is a separate sprite)
  parts.push({ kind: 'box', a: [-0.115, -0.085], b: [0.17, 0.2], z: [0.53, 0.66], paint: solid(RAMP.metalHi, 0) })
  parts.push({
    kind: 'wheel',
    a: -0.1,
    b: 0.215,
    z: 0.7,
    r: 0.065,
    w: 0.02,
    paint: (face, u) => (face === 'cap' ? { ramp: RAMP.hull, shift: u < 0.25 ? -0.3 : u > 0.85 ? -0.1 : 0.08 } : { ramp: RAMP.metalHi, shift: 0 }),
  })
  parts.push({ kind: 'box', a: [-0.115, -0.1], b: [-0.2, -0.185], z: [0.53, 0.86], paint: solid(RAMP.neutral, -0.1) })
  // forward camera pod on the roof, just behind the windscreen
  parts.push({
    kind: 'box',
    a: [0.185, 0.225],
    b: [-0.05, 0.05],
    z: [0.53, 0.58],
    paint: (face, u, v) => (face === 'front' && v > 0.3 && v < 0.75 && u > 0.25 && u < 0.75 ? { ramp: RAMP.cyan, shift: 0.35 } : { ramp: RAMP.metalHi, shift: 0.05 }),
  })

  // pickup bed behind the airlock: a floor with ribs, white side walls with the orange stripe,
  // a tailgate with tail lights, and a bump over each rear wheel
  const BED = { a: [-0.5, -0.12] as [number, number], b: [-0.225, 0.225] as [number, number], floor: 0.27, top: 0.39 }
  parts.push({
    kind: 'box',
    a: BED.a,
    b: BED.b,
    z: [0.25, BED.floor],
    paint: (face, u) => (face === 'top' ? { ramp: RAMP.metal, shift: (u * 7) % 1 < 0.25 ? 0.12 : -0.12 } : { ramp: RAMP.metalHi, shift: -0.1 }),
  })
  const bedWall: Paint = (face, u, v) => {
    if (face === 'top') return { ramp: RAMP.metalHi, shift: 0.12 }
    if (face === 'left' || face === 'right') {
      if (v > 0.25 && v < 0.5) return { ramp: RAMP.orange, shift: 0 }
      return { ramp: RAMP.hull, shift: (u * 3) % 1 < 0.05 ? -0.2 : -0.02 }
    }
    return { ramp: RAMP.hull, shift: -0.15 }
  }
  for (const s of [-1, 1]) parts.push({ kind: 'box', a: BED.a, b: s < 0 ? [BED.b[0], BED.b[0] + 0.025] : [BED.b[1] - 0.025, BED.b[1]], z: [BED.floor, BED.top], paint: bedWall })
  // tailgate: white with tail lights at the corners and a latch handle in the middle
  parts.push({
    kind: 'box',
    a: [BED.a[0], BED.a[0] + 0.025],
    b: [BED.b[0] + 0.025, BED.b[1] - 0.025],
    z: [BED.floor, BED.top - 0.01],
    paint: (face, u, v) => {
      if (face === 'top') return { ramp: RAMP.metalHi, shift: 0.1 }
      if (face === 'back') {
        if (v > 0.55 && v < 0.85 && (u < 0.14 || u > 0.86)) return { ramp: RAMP.alert, shift: 0.25 }
        if (v > 0.55 && v < 0.75 && u > 0.42 && u < 0.58) return { ramp: RAMP.metal, shift: 0 }
        if (v > 0.25 && v < 0.45) return { ramp: RAMP.orange, shift: -0.05 }
      }
      return { ramp: RAMP.hull, shift: -0.08 }
    },
  })
  // wheel-well humps inside the bed over the rear axle
  for (const s of [-1, 1]) parts.push({ kind: 'box', a: [AXLES[0] - 0.1, AXLES[0] + 0.1], b: s < 0 ? [BED.b[0] + 0.025, BED.b[0] + 0.09] : [BED.b[1] - 0.09, BED.b[1] - 0.025], z: [BED.floor, BED.floor + 0.045], paint: solid(RAMP.metalHi, -0.05) })
  if (loaded) {
    // a heap of ore, two sacks and a strapped crate, riding just over the walls
    const sack: Paint = (face, u, v) => ({ ramp: RAMP.sand, shift: face === 'top' ? 0.05 + ((u * 3 + v * 2) % 1 < 0.15 ? -0.2 : 0) : -0.1 })
    const ore: Paint = (face, u, v) => ({ ramp: RAMP.regolith, shift: face === 'top' ? ((Math.floor(u * 7) * 5 + Math.floor(v * 6) * 3) % 4) * 0.08 - 0.06 : -0.15 })
    parts.push({ kind: 'box', a: [-0.47, -0.15], b: [-0.195, 0.195], z: [BED.floor, BED.top - 0.02], paint: ore })
    parts.push({ kind: 'box', a: [-0.4, -0.27], b: [-0.12, 0.05], z: [BED.floor, BED.top + 0.025], paint: ore })
    parts.push({ kind: 'box', a: [-0.46, -0.37], b: [0.04, 0.18], z: [BED.floor, BED.top + 0.05], paint: sack })
    parts.push({ kind: 'box', a: [-0.27, -0.15], b: [0.03, 0.19], z: [BED.floor, BED.top + 0.07], paint: (face, u, v) => ({ ramp: RAMP.rust, shift: face === 'top' ? 0.1 + ((u > 0.45 && u < 0.55) ? -0.3 : 0) : u < 0.1 || u > 0.9 || v > 0.85 ? -0.2 : (u > 0.45 && u < 0.55 ? -0.3 : 0) }) })
  }
  return parts
}

/** Where the beacon (antenna tip) and the headlights sit, in the rover's frame. */
const BEACON: Vec = [-0.108, -0.193, 0.88]
const LAMPS: Vec = [0.48, 0, 0.32]

/* ------------------------------ rasteriser ------------------------------ */

/** The rover's frame → world (i, j, z) for a heading. */
function toWorld(dir: Dir, a: number, b: number, z: number): Vec {
  const ai = DI[dir]
  const aj = DJ[dir]
  // b is a's left-hand side, so the rover is the same way round whichever way it faces
  const al = a * LONG
  return [al * ai - b * aj, al * aj + b * ai, z]
}
const project = (ax: number, ay: number, p: Vec) => [ax + (p[0] - p[1]) * 16, ay + (p[0] + p[1]) * 8 - p[2] * ZS] as const
/** Larger is nearer the camera: the view ray runs along (1, 1, ½·ZS/16). */
const depthOf = (p: Vec) => p[0] + p[1] + (ZS / 32) * p[2]

/** Screen offset (px from the ground anchor) of a point on the rover, for a heading. */
export function roverPoint(dir: Dir, which: 'beacon' | 'lamps') {
  const [a, b, z] = which === 'beacon' ? BEACON : LAMPS
  const [x, y] = project(0, 0, toWorld(dir, a, b, z))
  return [Math.round(x), Math.round(y)] as const
}

/** Height of a box's top at `a`, following its rake. */
function topAt(part: Extract<Part, { kind: 'box' }>, a: number) {
  const r = part.rake
  if (!r || a <= r.from) return part.z[1]
  return part.z[1] - (r.drop * (a - r.from)) / (part.a[1] - r.from)
}

/** Sample every surface of the model, calling `hit` with the world point, its world normal and paint info. */
function sample(dir: Dir, parts: Part[], step: number, hit: (p: Vec, n: Vec, face: Face, u: number, v: number, paint: Paint) => void) {
  const nrm = (n: Vec): Vec => toWorld(dir, n[0], n[1], n[2])
  for (const part of parts) {
    if (part.kind === 'box') {
      const [a0, a1] = part.a
      const [b0, b1] = part.b
      const [z0, z1] = part.z
      const na = Math.max(1, Math.ceil((a1 - a0) / step))
      const nb = Math.max(1, Math.ceil((b1 - b0) / step))
      const nz = Math.max(1, Math.ceil((z1 - z0) / step))
      const at = (s: number, n: number, lo: number, hi: number) => lo + ((hi - lo) * s) / n
      const r = part.rake
      const k = r ? r.drop / (a1 - r.from) : 0
      const slopeN = nrm([k / Math.hypot(k, 1), 0, 1 / Math.hypot(k, 1)])
      // top and bottom (u along a, v across b)
      for (let s = 0; s <= na; s++)
        for (let t = 0; t <= nb; t++) {
          const a = at(s, na, a0, a1)
          const b = at(t, nb, b0, b1)
          const raked = !!r && a > r.from
          hit(toWorld(dir, a, b, topAt(part, a)), raked ? slopeN : nrm([0, 0, 1]), raked ? 'slope' : 'top', s / na, t / nb, part.paint)
          hit(toWorld(dir, a, b, z0), nrm([0, 0, -1]), 'bottom', s / na, t / nb, part.paint)
        }
      // nose and tail (u across b, v up)
      for (let t = 0; t <= nb; t++)
        for (let q = 0; q <= nz; q++) {
          const b = at(t, nb, b0, b1)
          const z = at(q, nz, z0, z1)
          if (z <= topAt(part, a1)) hit(toWorld(dir, a1, b, z), nrm([1, 0, 0]), 'front', t / nb, q / nz, part.paint)
          hit(toWorld(dir, a0, b, z), nrm([-1, 0, 0]), 'back', t / nb, q / nz, part.paint)
        }
      // sides (u along a, v up)
      for (let s = 0; s <= na; s++)
        for (let q = 0; q <= nz; q++) {
          const a = at(s, na, a0, a1)
          const z = at(q, nz, z0, z1)
          if (z > topAt(part, a)) continue
          hit(toWorld(dir, a, b1, z), nrm([0, 1, 0]), 'left', s / na, q / nz, part.paint)
          hit(toWorld(dir, a, b0, z), nrm([0, -1, 0]), 'right', s / na, q / nz, part.paint)
        }
    } else {
      // wheel: axle across b; tread round the outside, a cap on each face
      const { a, b, z, r, w, paint } = part
      const nth = Math.ceil((2 * Math.PI * r) / (step * 0.7))
      const nw = Math.max(2, Math.ceil(w / step))
      const nr = Math.max(2, Math.ceil(r / (step * 0.7)))
      for (let k = 0; k < nth; k++) {
        const th = (k / nth) * Math.PI * 2
        const c = Math.cos(th)
        const s = Math.sin(th)
        for (let q = 0; q <= nw; q++) hit(toWorld(dir, a + c * r, b - w / 2 + (w * q) / nw, z + s * r), nrm([c, 0, s]), 'tread', q / nw, k / nth, paint)
        for (let q = 0; q <= nr; q++) {
          const rr = (r * q) / nr
          for (const side of [-1, 1]) hit(toWorld(dir, a + c * rr, b + (side * w) / 2, z + s * rr), nrm([0, side, 0]), 'cap', q / nr, k / nth, paint)
        }
      }
    }
  }
}

function rasterise(W: number, H: number, ax: number, ay: number, dir: Dir, parts: Part[]) {
  const zb = new Float32Array(W * H).fill(-Infinity)
  const col: string[] = new Array(W * H)
  sample(dir, parts, 0.008, (p, n, face, u, v, paint) => {
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
  })
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
  sample(dir, model(0, false), 0.02, (p) => {
    const [x, y] = project(ROVER_AX, ROVER_AY, [p[0] + p[2] * per, p[1], 0])
    const px = Math.floor(x)
    const py = Math.floor(y)
    if (px >= 0 && py >= 0 && px < W && py < H) hit[py * W + px] = 1
  })
  return canvas(W, H, (ctx) => {
    ctx.fillStyle = '#2a1012'
    for (let k = 0; k < W * H; k++) {
      // close pinholes: a pixel with three shadowed neighbours is in the shadow too
      const x = k % W
      const y = Math.floor(k / W)
      const n = (hit[k - 1] ?? 0) + (hit[k + 1] ?? 0) + (hit[k - W] ?? 0) + (hit[k + W] ?? 0)
      if (hit[k] || (x > 0 && x < W - 1 && n >= 3)) ctx.fillRect(x, y, 1, 1)
    }
  })
}

/** One rover frame, lit by its own shading (the scene's lighting pass isn't applied). */
export function roverCanvas(dir: Dir, frame: number, loaded: boolean) {
  return rasterise(ROVER_W, ROVER_H, ROVER_AX, ROVER_AY, dir, model(frame, loaded))
}

/** Headlight pool on the ground ahead of a rover, drawn additively at night. Anchored like the rover. */
export const BEAM_W = 80
export const BEAM_H = 52
export const BEAM_AX = 40
export const BEAM_AY = 26
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
        if (a < 0.58) continue
        const spread = 0.2 + (a - 0.58) * 0.55
        if (Math.abs(b) > spread || a > 1.8) continue
        const k = (1 - (a - 0.58) / 1.22) * (1 - Math.abs(b) / spread) ** 0.6
        const bands = k > 0.55 ? 3 : k > 0.3 ? 2 : k > 0.12 ? 1 : 0
        if (!bands) continue
        ctx.fillStyle = ['', '#4a3410', '#8a6420', '#d9a53c'][bands]
        ctx.fillRect(px, py, 1, 1)
      }
  })
}

/** The beacon: a small cross of light, tinted in the scene (amber driving, cyan charging). */
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
