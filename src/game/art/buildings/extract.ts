/**
 * Mining: the ice drill and the excavator, both on 2×2 footprints.
 *
 * Each function draws one building on ground point (x, y), the centre of its
 * footprint. A w×h footprint spans ±(w+h)·8 px across and ±(w+h)·4 px down.
 * `t` is animation time; frame 0 (t = 0) doubles as the idle pose.
 *
 * Positions on the deck are given as (s, r): s runs toward the lower right
 * (screen +1, +½ per px), r toward the lower left (screen −1, +½). A 2×2 deck
 * covers s, r ∈ [−16, 16].
 */
import { rect, type Ctx } from '@/site/pixel/engine'
import { band, cyanWindow, cyl, dome, GLOW, hazardPx, INK, lamp, pipe, plinth, RAMP, getTier, stencilPx, tone, ventPx, type Ramp } from '@/game/art/pixel'
import { line, glowStrip, puffs, stack, M, MH, R, S, CY, SG, SMOKE, STEAM } from '@/game/art/buildings/kit'

const AL = RAMP.alert
const ICE = RAMP.ice
const REG = RAMP.regolith

type Px = string | ((c: number, r: number) => string | null)

/**
 * An iso box standing on ground point (gx, gy): half-length a along s, b along r,
 * h tall. Returns painters for its lit left face, shaded right face, and roof.
 */
function box(ctx: Ctx, gx: number, gy: number, a: number, b: number, h: number, ramp: Ramp, o: { roof?: Ramp; seams?: number; rivets?: boolean } = {}) {
  const roof = o.roof ?? ramp
  const fx = gx + a - b
  const fy = gy + ((a + b) >> 1) - h
  const lx = gx - a - b
  const bx = gx - a + b
  const rx = gx + a + b
  const ly = fy - a + 1
  const wallTop = (X: number) => (X < fx ? fy - ((fx - 1 - X) >> 1) : fy - ((X - fx) >> 1))
  const roofTop = (X: number) => (X < bx ? ly - ((X - lx) >> 1) : ly - b + 1 + ((X - bx) >> 1))
  for (let X = lx; X < rx; X++) {
    const left = X < fx
    const c = left ? X - lx : X - fx
    const n = left ? 2 * a : 2 * b
    const y0 = wallTop(X)
    for (let r = 0; r <= h; r++) {
      const k = r / Math.max(1, h)
      const v = left ? 0.74 - 0.22 * k + (c > n - 3 ? 0.06 : 0) : 0.4 - 0.18 * k - 0.12 * (c / n)
      rect(ctx, X, y0 + r, 1, 1, r === h ? ramp[0] : tone(ramp, v, X, y0 + r))
    }
    if (o.seams && c > 0 && c < n - 1 && c % o.seams === 0) {
      rect(ctx, X, y0 + 1, 1, h - 1, left ? ramp[1] : ramp[0])
      if (o.rivets && left) {
        rect(ctx, X + 1, y0 + 2, 1, 1, ramp[4])
        rect(ctx, X + 1, y0 + h - 2, 1, 1, ramp[4])
      }
    }
    const t0 = roofTop(X)
    for (let Y = t0; Y < y0; Y++) rect(ctx, X, Y, 1, 1, tone(roof, 0.95 - 0.3 * ((Y - t0) / Math.max(1, y0 - t0)) - (left ? 0 : 0.08), X, Y))
    rect(ctx, X, y0, 1, 1, left ? roof[4] : roof[2])
  }
  rect(ctx, fx - 1, fy + 1, 1, h, ramp[4])
  rect(ctx, fx, fy + 1, 1, h, ramp[1])
  const paint = (X: number, Y: number, col: Px, c: number, r: number) => {
    const v = typeof col === 'string' ? col : col(c, r)
    if (v) rect(ctx, X, Y, 1, 1, v)
  }
  return {
    fx,
    fy,
    lx,
    rx,
    top: gy - h,
    /** Paint the lit face: columns from the left corner, rows from the wall top. */
    L(c0: number, w: number, r0: number, hh: number, col: Px) {
      for (let c = c0; c < c0 + w; c++) for (let r = r0; r < r0 + hh; r++) paint(lx + c, wallTop(lx + c) + r, col, c - c0, r - r0)
    },
    /** Paint the shaded face: columns from the front corner. */
    R(c0: number, w: number, r0: number, hh: number, col: Px) {
      for (let c = c0; c < c0 + w; c++) for (let r = r0; r < r0 + hh; r++) paint(fx + c, wallTop(fx + c) + r, col, c - c0, r - r0)
    },
    /** Screen point on the roof at (s, r) from its centre. */
    at: (s: number, r: number) => [Math.round(gx + s - r), Math.round(gy - h + (s + r) / 2)] as const,
  }
}

/** A railing between two points: posts every 3 px and a top rail h px up. */
function rail(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, h = 3, col: string = SG[3]) {
  const n = Math.max(Math.abs(x1 - x0), 1)
  for (let k = 0; k <= n; k += 3) rect(ctx, Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n) - h, 1, h, M[2])
  line(ctx, x0, y0 - h, x1, y1 - h, col)
}

/** A vertical ladder with rails at x and x + 2. */
function ladder(ctx: Ctx, x: number, y0: number, y1: number) {
  rect(ctx, x, y0, 1, y1 - y0, MH[3])
  rect(ctx, x + 2, y0, 1, y1 - y0, M[1])
  for (let yy = y0 + 1; yy < y1; yy += 2) rect(ctx, x + 1, yy, 1, 1, MH[2])
}

/** Blinking alert lamp. */
const blink = (ctx: Ctx, x: number, y: number, t: number, phase = 0) => lamp(ctx, x, y, (t * 2 + phase) % 1 < 0.5 ? AL[4] : AL[0], AL[1])

/** Ice-core canister: a frosted cylinder with a cyan level strip. */
function canister(ctx: Ctx, x: number, base: number, h: number, fill: number) {
  cyl(ctx, x, base, 3, h, MH, ICE)
  band(ctx, x, base, 3, h - 2, 1, M[1])
  band(ctx, x, base, 3, 2, 1, M[1])
  rect(ctx, x - 2, base - h + 2, 2, h - 3, INK)
  const lit = Math.round((h - 4) * fill)
  for (let k = 0; k < h - 4; k++) rect(ctx, x - 2, base - 2 - k, 1, 1, k < lit ? (k === lit - 1 ? GLOW : ICE[2]) : CY[0])
}

/* --------------------------------- drill --------------------------------- */

/**
 * Ice drill: a tapering lattice derrick on a hazard-striped drill floor, its
 * travelling block pumping the drill string; a control cabin on the left, and
 * a rack of frosted ice-core canisters fed by a hose up front.
 */
export function iceDrill(ctx: Ctx, x: number, y: number, t: number) {
  const tier = getTier()
  const g = plinth(ctx, x, y, 2, 2, 6)
  const at = (s: number, r: number) => [Math.round(x + s - r), Math.round(g + (s + r) / 2)] as const

  // coolant tank, back right (behind the derrick's right leg)
  if (tier >= 3) {
    const [tx, ty] = at(2, -14)
    cyl(ctx, tx + 4, ty, 4, 16, M, MH)
    band(ctx, tx + 4, ty, 4, 12, 2, (dx) => ((dx + 8) % 4 < 2 ? INK : SG[3]))
    glowStrip(ctx, tx + 1, ty - 2, 8, 0.7)
  }

  // drill floor: a raised substructure with hazard trim
  const [dx0, dy0] = at(-2, -6)
  const sub = box(ctx, dx0, dy0, 8, 8, 6, M, { seams: 4, roof: M })
  sub.L(0, 16, 1, 2, hazardPx)
  sub.R(0, 16, 1, 2, (c, r) => ((c + r) % 4 < 2 ? SG[2] : INK))
  sub.L(3, 10, 4, 2, ventPx)
  sub.R(4, 4, 3, 3, INK)
  // derrick
  const bx = dx0
  const by = dy0 - 6
  const H = 28
  const corner = (cs: number, cr: number, k: number) => {
    const f = 6 - (4.5 * k) / H
    return [Math.round(bx + (cs - cr) * f), Math.round(by + ((cs + cr) * f) / 2) - k] as const
  }
  const legs: Record<'B' | 'L' | 'R' | 'F', [number, number]> = { B: [-1, -1], L: [-1, 1], R: [1, -1], F: [1, 1] }
  const stages = [0, 8, 15, 22, H]
  const face = (p: 'B' | 'L' | 'R' | 'F', q: 'B' | 'L' | 'R' | 'F', c1: string, c2: string | null) => {
    for (let i = 0; i + 1 < stages.length; i++) {
      const [k0, k1] = [stages[i], stages[i + 1]]
      const a0 = corner(...legs[p], k0)
      const b0 = corner(...legs[q], k0)
      const a1 = corner(...legs[p], k1)
      const b1 = corner(...legs[q], k1)
      if (c2) {
        line(ctx, a0[0], a0[1], b1[0], b1[1], c2)
        line(ctx, b0[0], b0[1], a1[0], a1[1], c2)
      }
      line(ctx, a1[0], a1[1], b1[0], b1[1], c1)
    }
  }
  const leg = (p: 'B' | 'L' | 'R' | 'F', c: string, c2?: string) => {
    for (let k = 0; k <= H; k++) {
      const [lx, ly] = corner(...legs[p], k)
      rect(ctx, lx, ly, 1, 1, c)
      if (c2) rect(ctx, lx + 1, ly, 1, 1, c2)
    }
  }
  leg('B', R[0])
  // rotary table and wellhead with sublimating vapour
  dome(ctx, bx, by + 1, 5, 1, 2, M, false)
  dome(ctx, bx - 1, by, 2, 1, 1, MH, false)
  if (t > 0)
    for (let k = 0; k < 3; k++) {
      const rise = (t * 4 + k * 1.7) % 6
      rect(ctx, bx + 1 + k + Math.round(rise / 2), by - 2 - Math.round(rise), rise > 3 ? 2 : 1, 1, STEAM[rise > 3 ? 1 : 3])
    }
  // front faces of the lattice, lit left and shaded right
  face('L', 'F', R[4], R[3])
  face('F', 'R', R[2], R[1])
  // drill string, travelling block and cables
  const stroke = Math.round((1 - Math.cos(t * Math.PI)) * 5)
  const crownY = by - H - 1
  const blockY = crownY + 7 + stroke
  rect(ctx, bx - 2, blockY + 4, 1, by - blockY - 4, MH[4])
  rect(ctx, bx - 1, blockY + 4, 1, by - blockY - 4, MH[1])
  for (let k = blockY + 7; k < by - 1; k += 5) rect(ctx, bx - 3, k, 3, 1, MH[2]) // tool joints
  rect(ctx, bx - 3, crownY + 2, 1, blockY - crownY - 2, MH[3])
  rect(ctx, bx, crownY + 2, 1, blockY - crownY - 2, MH[1])
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) rect(ctx, bx - 4 + c, blockY + r, 1, 1, r === 3 ? INK : (c + r) % 4 < 2 ? SG[c < 2 ? 4 : 3] : INK)
  rect(ctx, bx - 2, blockY + 4, 1, 1, MH[3])
  leg('L', R[4], R[2])
  leg('R', R[2], R[0])
  leg('F', R[4], R[1])
  // racking platform with a rail, halfway up the left face
  {
    const [px, py] = corner(-1, 1, 17)
    rect(ctx, px - 3, py, 7, 1, R[3])
    rect(ctx, px - 3, py + 1, 7, 1, R[0])
    rail(ctx, px - 3, py, px + 3, py, 3, SG[3])
  }
  // ladder up the left leg's first stage
  {
    const [lx, ly] = corner(-1, 1, 0)
    ladder(ctx, lx + 1, ly - 16, ly)
  }
  // crown block, sheave and beacon
  rect(ctx, bx - 4, crownY - 1, 8, 3, M[2])
  rect(ctx, bx - 4, crownY - 1, 8, 1, MH[3])
  rect(ctx, bx + 1, crownY - 1, 3, 3, M[1])
  dome(ctx, bx - 1, crownY - 2, 2, 2, 0, R, false)
  rect(ctx, bx, crownY - 6, 1, 4, M[3])
  blink(ctx, bx, crownY - 7, t)
  if (tier >= 2) {
    // floodlight halfway up the right leg
    const [fx, fy] = corner(1, -1, 12)
    rect(ctx, fx + 1, fy, 2, 2, M[2])
    lamp(ctx, fx + 3, fy, tier >= 3 ? '#ffffff' : SG[4], SG[3])
  }

  // control cabin, left
  const [cx0, cy0] = at(-9, 9)
  const cab = box(ctx, cx0, cy0, 5, 6, 14, M, { seams: 5, rivets: true, roof: MH })
  cab.L(1, 8, 3, 4, cyanWindow(8, 4))
  cab.L(0, 10, 9, 5, (c, r) => (r === 0 ? INK : c % 5 === 2 && r === 1 ? R[4] : R[3]))
  cab.L(1, 7, 11, 1, stencilPx(0b101101101))
  cab.R(3, 4, 4, 10, (c, r) => (c === 0 || c === 3 || r === 0 ? INK : r === 2 && c > 0 && c < 3 ? CY[3] : M[2]))
  cab.R(8, 3, 4, 4, ventPx)
  lamp(ctx, cab.fx + 5, cab.fy + 1, (t * 2) % 1 < 0.5 ? SG[4] : SG[1], SG[2])
  // roof: an AC unit with a fan, an antenna and a railing
  {
    const [ax, ay] = cab.at(-1, 1)
    const ac = box(ctx, ax, ay, 3, 3, 3, MH, { roof: M })
    ac.R(1, 4, 1, 2, ventPx)
    rect(ctx, ax - 1, ay - 5 - (t > 0 ? Math.floor(t * 4) % 2 : 0), 2, 1, M[0])
    const [nx, ny] = cab.at(3, -4)
    rect(ctx, nx, ny - 9, 1, 9, M[3])
    rect(ctx, nx - 1, ny - 9, 3, 1, MH[3])
    rect(ctx, nx - 2, ny - 6, 5, 1, MH[2])
    const [r0x, r0y] = cab.at(-5, 6)
    const [r1x, r1y] = cab.at(5, 6)
    rail(ctx, r0x, r0y, r1x, r1y, 2, SG[3])
  }

  // hose from the wellhead to the canister rack, with a red valve wheel
  const [hx, hy] = at(7, 6)
  pipe(ctx, sub.fx + 3, sub.fy + 5, hx - 2, hy - 4, MH)
  rect(ctx, sub.fx + 6, sub.fy + 5, 2, 2, AL[2])
  rect(ctx, sub.fx + 6, sub.fy + 5, 1, 1, AL[4])

  // canister rack, front: a low frame with two (three, four) frosted cores
  const [rx0, ry0] = at(9, 6)
  const rack = box(ctx, rx0, ry0, 7, 4, 2, M, { roof: M })
  rack.L(0, 14, 1, 1, hazardPx)
  const cans: [number, number][] = [
    [4, 9],
    [10, 5],
    [12, 0],
    [7, 2],
  ]
  const n = tier === 1 ? 2 : tier === 2 ? 3 : 4
  const order = cans.slice(0, n).sort((p, q) => p[0] + p[1] - (q[0] + q[1]))
  for (const [s, r] of order) {
    const [cx, cy] = at(s, r)
    canister(ctx, cx, cy - 2, 10, 0.4 + ((s * 7 + r) % 5) * 0.12)
  }

  // pump skid, right: a compact box with a fan and a gauge
  const [px0, py0] = at(10, -8)
  const pump = box(ctx, px0, py0, 4, 3, 7, R, { seams: 3, roof: M })
  pump.R(1, 4, 2, 3, ventPx)
  pump.L(2, 4, 2, 2, (c, r) => (r === 0 ? GLOW : CY[2]))
  rect(ctx, pump.fx - 1, pump.fy + 6, 2, 1, SG[3])
}

/* ------------------------------- excavator ------------------------------- */

/**
 * Bucket-wheel excavator: crawler tracks under a rust armoured house with a
 * glazed cab, engine stack and gantry; a short lattice boom carries a turning
 * wheel of hazard-yellow buckets that bites into a dig pit cut through the deck
 * at front right. Spoil rides the boom belt back and drops onto a heap at left.
 * Drawn centred on (x, y) like every other building.
 */
export function excavator(ctx: Ctx, x: number, y: number, t: number) {
  const tier = getTier()
  const g = plinth(ctx, x, y, 2, 2, 5)
  const at = (s: number, r: number, z = 0) => [Math.round(x + s - r), Math.round(g + (s + r) / 2) - z] as const
  const spin = t * Math.PI * 0.5
  const ph = Math.floor(t * 4)

  // the dig pit, front right: a cut through the deck into the regolith
  for (let s = 2; s <= 15; s++)
    for (let r = -8; r <= 7; r++) {
      const [px, py] = at(s, r)
      const near = r === 7 || s === 15
      const far = r === -8 || s === 2
      for (const ox of [0, 1]) {
        let c: string
        if (near) c = (px + ox + py) % 4 < 2 ? SG[3] : INK
        else if (far) c = M[3]
        else c = tone(REG, 0.12 + ((s - 2) / 13) * 0.25 + ((r + 8) / 15) * 0.25, px + ox, py)
        rect(ctx, px + ox, py, 1, 1, c)
      }
    }
  for (let s = 3; s <= 14; s++) {
    const [px, py] = at(s, -7)
    rect(ctx, px, py, 2, 2, REG[0])
  }
  for (let r = -7; r <= 6; r++) {
    const [px, py] = at(3, r)
    rect(ctx, px, py, 2, 2, REG[1])
  }

  // spoil heap at the left corner
  {
    const [hx, hy] = at(-10, 12)
    dome(ctx, hx, hy + 1, 8, 6, 2, REG, false)
    for (let k = 0; k < 7; k++) rect(ctx, hx - 6 + ((k * 5) % 12), hy - 2 + ((k * 3) % 5), 1, 1, k % 2 ? REG[4] : REG[1])
  }

  // crawler tracks, back one first, treads creeping
  for (const r of [-6, 6]) {
    const [tx, ty] = at(-7, r)
    const tr = box(ctx, tx, ty, 7, 3, 4, M, { roof: M })
    tr.L(0, 14, 0, 4, (c, rr) => (rr === 0 ? ((c + ph) % 2 ? M[4] : M[2]) : rr === 3 ? M[0] : (c + ph) % 3 === 0 ? INK : M[2]))
    for (let k = 0; k < 3; k++) tr.L(2 + k * 4, 2, 1, 2, MH[3])
    tr.R(0, 6, 0, 4, (c, rr) => (rr === 0 ? M[2] : (c + ph) % 3 === 0 ? INK : M[1]))
  }

  // upper house on a turntable ring
  const hz = 5
  const [hx0, hy0] = at(-7, 0)
  dome(ctx, hx0, hy0 - hz + 1, 8, 2, 2, M, false)
  const house = box(ctx, hx0, hy0 - hz, 7, 6, 10, R, { seams: 4, rivets: true, roof: M })
  house.L(0, 14, 0, 1, INK)
  house.L(0, 4, 1, 9, hazardPx) // counterweight
  house.L(6, 7, 2, 2, ventPx)
  house.L(6, 7, 6, 1, stencilPx(0b110101101))
  house.L(5, 9, 8, 1, M[1])
  house.R(0, 12, 0, 1, INK)
  house.R(2, 4, 2, 6, (c, r) => (c === 0 || c === 3 || r === 0 ? INK : r === 2 ? CY[2] : M[1]))
  house.R(8, 3, 2, 3, ventPx)
  // spoil chute from the house down to the heap
  {
    const [cx, cy] = house.at(-4, 6)
    const [hx, hy] = at(-10, 12)
    for (let k = 0; k < 2; k++) line(ctx, cx, cy + 4 + k, hx + 2, hy - 5 + k, k ? R[1] : R[3])
    if (t > 0) rect(ctx, hx + 1 - (ph % 2), hy - 4 + (ph % 3), 1, 1, REG[3])
  }
  // engine module and exhaust stack at the back of the roof
  {
    const [ex, ey] = house.at(-4, 2)
    const eng = box(ctx, ex, ey, 3, 3, 3, M, { roof: MH })
    eng.L(0, 6, 1, 2, ventPx)
    stack(ctx, ex + 2, ey - 2, 7, 2)
    if (tier >= 2) stack(ctx, ex - 1, ey - 3, 5, 1)
    puffs(ctx, ex + 2, ey - 11, t, SMOKE)
  }
  // gantry mast with the boom's hoist cable
  const [wx, wy] = at(12, -1, 9) // bucket wheel hub
  const [gx0, gy0] = house.at(-4, -4)
  rect(ctx, gx0, gy0 - 14, 1, 14, MH[3])
  rect(ctx, gx0 + 1, gy0 - 14, 1, 14, M[1])
  rect(ctx, gx0 - 1, gy0 - 15, 4, 2, R[3])
  line(ctx, gx0 + 2, gy0 - 14, wx - 1, wy - 8, M[3])
  blink(ctx, gx0, gy0 - 17, t)

  // boom: a rust lattice from the house front down to the wheel hub, with a belt of spoil
  const [b0x, b0y] = house.at(6, -2)
  const n = wx - b0x
  for (let k = 0; k <= n; k++) {
    const yy = Math.round(b0y + ((wy - b0y) * k) / n)
    rect(ctx, b0x + k, yy - 5, 1, 1, SG[3])
    rect(ctx, b0x + k, yy - 4, 1, 1, R[4])
    rect(ctx, b0x + k, yy, 1, 1, R[1])
    rect(ctx, b0x + k, yy + 1, 1, 1, R[0])
    if (k % 4 === 0) for (let j = -3; j < 0; j++) rect(ctx, b0x + k + ((j + 3) >> 1), yy + j, 1, 1, R[3])
  }
  for (let k = 0; k < 4; k++) {
    const f = (t * 0.5 + k / 4) % 1
    rect(ctx, Math.round(wx - 3 - (wx - 3 - b0x) * f), Math.round(wy - 5 - (wy - b0y) * f), 2, 1, k % 2 ? REG[3] : REG[2])
  }

  // cab on the front-left of the roof, glazed on both faces
  {
    const [cx, cy] = house.at(3, 1)
    const cab = box(ctx, cx, cy, 3, 3, 7, M, { roof: MH })
    cab.L(0, 6, 1, 4, cyanWindow(6, 4))
    cab.R(0, 6, 1, 4, (c, r) => (c === 0 || r === 0 || r === 3 || c === 5 ? INK : r === 1 ? CY[3] : CY[1]))
    cab.L(0, 6, 5, 1, SG[3])
    lamp(ctx, cab.fx - 1, cab.top - 2, tier >= 3 ? '#ffffff' : SG[4], SG[2])
  }
  // railed walkway along the house's left edge and a boarding ladder
  {
    const [r0x, r0y] = house.at(-7, 6)
    const [r1x, r1y] = house.at(-1, 6)
    rail(ctx, r0x, r0y, r1x, r1y, 3)
    const [lx, ly] = at(-1, 6)
    ladder(ctx, lx - 1, ly - hz - 9, ly - 3)
  }
  if (tier >= 2) {
    // spare fuel cell on the back of the house
    const [fx, fy] = house.at(-1, -4)
    cyl(ctx, fx, fy, 2, 5, SG, M)
    band(ctx, fx, fy, 2, 3, 1, INK)
  }
  if (tier >= 3) {
    // cyan running light and a mast beacon
    house.L(5, 7, 4, 1, (c) => (c % 3 === 2 ? null : c % 3 ? CY[4] : GLOW))
    const [mx, my] = house.at(-5, -4)
    rect(ctx, mx, my - 14, 1, 14, M[3])
    dome(ctx, mx + 2, my - 10, 2, 2, 1, MH, false)
    lamp(ctx, mx, my - 16, (t * 1.5) % 1 < 0.4 ? CY[4] : CY[1], CY[2])
  }

  // bucket wheel, its face toward the viewer: rim, spokes, hub and eight yellow buckets
  const Rw = 8
  const disc = (ox: number, oy: number, back: boolean) => {
    for (let Y = oy - Rw - 2; Y <= oy + Rw + 2; Y++)
      for (let X = ox - Rw; X <= ox + Rw; X++) {
        const u = (X + 0.5 - ox) / Rw
        const v = (0.5 * (X + 0.5 - ox) - (Y + 0.5 - oy)) / Rw
        const rho = Math.hypot(u, v)
        if (rho > 1) continue
        if (back) {
          if (rho > 0.8) rect(ctx, X, Y, 1, 1, M[0])
          continue
        }
        const th = Math.atan2(v, u)
        let c: string | null = null
        if (rho > 0.8) c = tone(MH, 0.55 + 0.35 * Math.sin(th + 0.8) - (rho > 0.93 ? 0.15 : 0), X, Y)
        else if (rho < 0.25) c = rho < 0.12 ? MH[4] : MH[2]
        else {
          const k = (((th - spin) % (Math.PI / 4)) + Math.PI / 4) % (Math.PI / 4)
          if (k < 0.16 || k > Math.PI / 4 - 0.06) c = tone(M, 0.75, X, Y)
          else c = (X + Y) % 2 ? M[0] : M[1]
        }
        rect(ctx, X, Y, 1, 1, c)
      }
  }
  disc(wx + 2, wy - 1, true)
  disc(wx, wy, false)
  for (let k = 0; k < 8; k++) {
    const a = spin + (k * Math.PI) / 4
    const px = Math.round(wx + Math.cos(a) * (Rw + 1))
    const py = Math.round(wy + (0.5 * Math.cos(a) - Math.sin(a)) * (Rw + 1))
    rect(ctx, px - 1, py - 1, 3, 3, SG[3])
    rect(ctx, px - 1, py - 1, 2, 1, SG[4])
    rect(ctx, px + 1, py, 1, 2, SG[1])
    rect(ctx, px, py, 1, 1, INK)
    if (Math.sin(a) > 0 && Math.cos(a) > -0.3) rect(ctx, px - 1, py - 2, 2, 1, REG[3]) // full buckets climbing
  }
  // the wheel's bite: the near lip of the pit and a heap of loose regolith over it
  {
    const [lx, ly] = at(12, 6)
    dome(ctx, lx, ly - 1, 6, 3, 1, REG, false)
    for (let s = 7; s <= 15; s++) {
      const [px, py] = at(s, 7)
      rect(ctx, px, py, 2, 1, (px + py) % 4 < 2 ? SG[3] : INK)
    }
  }
  if (t > 0)
    for (let k = 0; k < 3; k++) {
      const f = (t * 2 + k / 3) % 1
      rect(ctx, wx - 7 + k * 2 + Math.round(f * 3), wy + 7 - Math.round(f * 6), 1, 1, k ? REG[4] : S[4])
    }
}
