/**
 * Logistics art: belts and their junctions, roads and tyre tracks, the docks
 * where belts meet buildings, rover parking bays, direction arrows and the
 * items that ride the belts.
 */
import { box, ellipseRows, hash, rect } from '@/site/pixel/engine'
import { DI, DJ, ITEMS, type Dir, type ItemId } from '@/game/core/data'
import { GLOW, INK, RAMP as PAL } from '@/game/art/pixel'
import { canvas, FRAMES, shade } from '@/game/art/canvas'

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
export function beltCanvas(dir: Dir, frame: number, mask = 1, capEnd = false) {
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
export function junctionCanvas(frame: number) {
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
export function roadCanvas(level: 1 | 2, mask: number) {
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
export function portCanvas(dir: Dir, kind: 'in' | 'out', frame: number) {
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
export function bayCanvas() {
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

export function arrowCanvas(dir: Dir) {
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

export function itemCanvas(id: ItemId) {
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
