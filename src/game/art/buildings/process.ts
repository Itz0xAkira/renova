/**
 * Processing: the ice melter (2×2), smelter, sinter kiln and soil washer (3×3).
 *
 * Each function draws one building on ground point (x, y), the centre of its
 * footprint. A w×h footprint spans ±(w+h)·8 px across and ±(w+h)·4 px down.
 * `t` is animation time; frame 0 (t = 0) doubles as the idle pose.
 *
 * Positions on the deck are given as (s, r): s runs toward the lower right
 * (screen +1, +½ per px), r toward the lower left (screen −1, +½). A 2×2 deck
 * covers s, r ∈ [−16, 16], a 3×3 deck s, r ∈ [−24, 24].
 */
import { rect, type Ctx } from '@/site/pixel/engine'
import { armourPx, band, cyanWindow, cyl, dome, fan, GLOW, getTier, hazardPx, INK, lamp, pipe, plinth, RAMP, stencilPx, tone, ventPx, waterDrop, type Ramp } from '@/game/art/pixel'
import { line, glowStrip, puffs, stack, M, MH, R, S, CY, SG, SOIL, SMOKE, STEAM } from '@/game/art/buildings/kit'

const AL = RAMP.alert
const ICE = RAMP.ice
const REG = RAMP.regolith
const BRICK = RAMP.brick
/** Shell heat, from dull red to white-hot. */
const HEAT: Ramp = ['#4a1a12', '#8a2a14', '#c94c1a', '#f3902e', '#ffe08a']
/** A finished metal ingot (the Metal item's colours). */
const INGOT: Ramp = ['#4a5260', '#7d8794', '#a9b2bd', '#d6dbe2', '#f4f6f9']

type Px = string | ((c: number, r: number) => string | null)

/** Ground-to-screen mapping for a deck whose top centre is (x, g). */
const deck = (x: number, g: number) => (s: number, r: number, z = 0) => [Math.round(x + s - r), Math.round(g + (s + r) / 2) - z] as const

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

/**
 * A horizontal drum lying along s. Its axis passes screen point (ox, oy) at
 * s = 0 and it spans s0…s1, R across and Rz up. `paint` colours the shell
 * from (s, angle around the axis — 0 faces lower left, π/2 is the top — and
 * light 0–1); `cap` colours the visible front end from (across, up, light).
 */
function drum(ctx: Ctx, ox: number, oy: number, s0: number, s1: number, R0: number, Rz: number, paint: (s: number, a: number, v: number, X: number, Y: number) => string | null, cap: (v: number, z: number, X: number, Y: number) => string | null) {
  const A = Math.hypot(R0, Rz)
  const phi = Math.atan2(Rz, R0)
  for (let X = ox + s0 - R0 - 1; X <= ox + s1 + R0 + 1; X++)
    for (let Y = oy + Math.floor(s0 / 2) - R0 - Rz - 2; Y <= oy + Math.ceil(s1 / 2) + R0 + Rz + 2; Y++) {
      const xq = X + 0.5 - ox
      const yq = Y + 0.5 - oy
      // end cap
      const V = s1 - xq
      const Z = (s1 + V) / 2 - yq
      if ((V / R0) ** 2 + (Z / Rz) ** 2 <= 1) {
        const c = cap(V, Z, X, Y)
        if (c) rect(ctx, X, Y, 1, 1, c)
        continue
      }
      const q = (yq - xq / 2) / A
      if (Math.abs(q) > 1) continue
      const ac = Math.acos(q)
      const a1 = ac - phi
      const a2 = -ac - phi
      const d = (a: number) => 2 * R0 * Math.cos(a) + Rz * Math.sin(a)
      const a = d(a1) >= d(a2) ? a1 : a2
      const s = xq + R0 * Math.cos(a)
      if (s < s0 || s > s1) continue
      const v = 0.55 + 0.2 * Math.cos(a) + 0.35 * Math.sin(a)
      const c = paint(s, a, v, X, Y)
      if (c) rect(ctx, X, Y, 1, 1, c)
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

/** Front-surface y offset of a cylinder of radius rx at column dx. */
const rim = (rx: number, dx: number) => Math.round(Math.sqrt(Math.max(0, 1 - ((dx + 0.5) / rx) ** 2)) * (rx / 2))

/** Paint a column-wise pattern on a cylinder's front surface, rows counted up from z0. */
function wrap(ctx: Ctx, cx: number, base: number, rx: number, dx0: number, w: number, z0: number, hh: number, col: (c: number, r: number) => string | null) {
  for (let c = 0; c < w; c++) {
    const dx = dx0 + c
    const e = rim(rx, dx)
    for (let r = 0; r < hh; r++) {
      const v = col(c, r)
      if (v) rect(ctx, cx + dx, base - z0 - r + e, 1, 1, v)
    }
  }
}

/**
 * A round hopper: a cone widening from r0 at height z0 to r1 at z1 above
 * ground point (cx, cy), on three legs, heaped with `fill`.
 */
function hopper(ctx: Ctx, cx: number, cy: number, z0: number, z1: number, r0: number, r1: number, ramp: Ramp, fill: Ramp) {
  for (const [lx, ly] of [
    [cx - r0, cy - 1],
    [cx + r0 - 1, cy - 1],
    [cx, cy + (r0 >> 1)],
  ]) {
    rect(ctx, lx, ly - z0, 1, z0, lx < cx ? MH[3] : M[2])
  }
  line(ctx, cx - r0, cy - 2, cx + r0 - 1, cy - z0 + 2, M[2])
  line(ctx, cx - r0, cy - z0 + 2, cx + r0 - 1, cy - 2, M[1])
  for (let z = z0; z <= z1; z++) {
    const rr = r0 + ((r1 - r0) * (z - z0)) / (z1 - z0)
    const w = Math.round(rr)
    for (let dx = -w; dx < w; dx++) {
      const e = Math.round(Math.sqrt(Math.max(0, 1 - ((dx + 0.5) / rr) ** 2)) * (rr / 2))
      for (let yy = -e; yy <= e; yy++) rect(ctx, cx + dx, cy - z + yy, 1, 1, tone(ramp, 0.78 - 0.55 * ((dx + w) / (2 * w)) - (z === z0 ? 0.2 : 0), cx + dx, cy - z + yy))
    }
  }
  const w = Math.round(r1)
  for (let dx = -w + 1; dx < w - 1; dx++) {
    const e = Math.round(Math.sqrt(Math.max(0, 1 - ((dx + 0.5) / (r1 - 1)) ** 2)) * ((r1 - 1) / 2))
    for (let yy = -e; yy <= e; yy++) rect(ctx, cx + dx, cy - z1 + yy, 1, 1, M[0])
  }
  dome(ctx, cx, cy - z1, w - 2, 3, Math.max(0, (w >> 1) - 2), fill, false)
  for (let dx = -w; dx < w; dx++) rect(ctx, cx + dx, cy - z1 + Math.round(Math.sqrt(Math.max(0, 1 - ((dx + 0.5) / r1) ** 2)) * (r1 / 2)), 1, 1, dx < 0 ? ramp[4] : ramp[2])
}

/** A brick chimney with steel hoops and a sooty mouth. */
function brickStack(ctx: Ctx, cx: number, base: number, rx: number, h: number, t: number) {
  cyl(ctx, cx, base, rx, h, BRICK, M)
  for (let dx = -rx; dx < rx; dx++) {
    const e = rim(rx, dx)
    for (let z = 2; z < h - 2; z++) {
      const course = z >> 1
      const joint = z % 2 === 0 || (dx + rx + (course % 2) * 2) % 4 === 0
      if (joint) rect(ctx, cx + dx, base - z + e, 1, 1, dx < -1 ? BRICK[1] : BRICK[0])
    }
  }
  for (const at of [4, Math.round(h * 0.45), h - 4]) band(ctx, cx, base, rx, at, 1, (dx) => (dx < 0 ? M[4] : M[1]))
  dome(ctx, cx, base - h, rx - 1, 0, 0, [INK, INK, INK, INK, INK], false)
  dome(ctx, cx, base - h + 1, rx - 1, 0, 0, ['#2a1a16', '#2a1a16', '#2a1a16', '#2a1a16', '#2a1a16'], false)
  puffs(ctx, cx, base - h - 4, t, SMOKE)
  if (t > 0) puffs(ctx, cx - 1, base - h - 9, t + 0.7, SMOKE)
}

/* --------------------------------- melter -------------------------------- */

/**
 * Ice melter: a tall insulated tank in beige cladding, a sight glass showing
 * the water `level`, glowing heater coils round its base, an ice hopper and
 * railed catwalk on its lid; a control block with a radiator in front.
 */
export function melter(ctx: Ctx, x: number, y: number, t: number, level: number) {
  const tier = getTier()
  const g = plinth(ctx, x, y, 2, 2, 6)
  const at = deck(x, g)
  const lv = Math.max(0, Math.min(1, level))
  const glowOn = (t * 2) % 1 < 0.5 ? 0.06 : 0

  // main tank: beige insulation cladding on a steel frame
  const [tx, ty] = at(3, -7)
  const TR = 11
  const TH = 27
  // back half of the lid railing, behind everything on the lid
  cyl(ctx, tx, ty, TR, TH, S, MH)
  for (let dx = -TR + 3; dx < TR; dx += 4) {
    const e = rim(TR, dx)
    rect(ctx, tx + dx, ty - TH + e + 1, 1, TH - 2, dx < 0 ? S[1] : S[0])
  }
  for (const [z, th] of [
    [2, 2],
    [13, 1],
    [TH - 2, 1],
  ])
    band(ctx, tx, ty, TR, z, th, (dx) => (dx < -3 ? M[3] : dx < 4 ? M[2] : M[1]))
  // heater coils: glowing bands around the base, brighter with each upgrade
  const heat = 0.55 + tier * 0.1 + glowOn
  wrap(ctx, tx, ty, TR, -TR, 2 * TR, 4, 6, (c, r) => {
    if (r === 0 || r === 5) return M[c < TR ? 2 : 1]
    const lit = 1 - c / (2 * TR)
    const coil = (c + r * 2) % 4 < 2
    return tone(HEAT, heat * (coil ? 1 : 0.7) - 0.25 + lit * 0.35, c, r)
  })
  // sight glass with level ticks and rising bubbles
  const gx = -8
  const gw = 4
  const gz0 = 10
  const gh = 15
  wrap(ctx, tx, ty, TR, gx - 1, gw + 2, gz0 - 1, gh + 2, (c, r) => (c === 0 || c === gw + 1 || r === 0 || r === gh + 1 ? INK : null))
  const water = Math.round(gh * lv)
  wrap(ctx, tx, ty, TR, gx, gw, gz0, gh, (c, r) => {
    if (r >= water) return c === 0 && r % 3 === 0 ? CY[1] : r === water ? CY[1] : '#16303b'
    if (r === water - 1) return GLOW
    if (t > 0 && (r + Math.floor(t * 8) + c * 3) % 7 === 0 && c > 0) return CY[4]
    return tone(CY, 0.65 - (r / gh) * 0.2 + (c === 0 ? 0.15 : 0), c, r)
  })
  wrap(ctx, tx, ty, TR, gx + gw + 1, 1, gz0, gh, (_, r) => (r % 4 === 0 ? SG[3] : null))
  // ladder up the front of the tank
  ladder(ctx, tx + 1, ty - TH + rim(TR, 1) + 1, ty + rim(TR, 1) - 3)
  // water emblem and a hazard strip on the shaded side
  wrap(ctx, tx, ty, TR, 3, 7, 14, 8, (c, r) => (c === 0 || c === 6 || r === 0 || r === 7 ? M[1] : CY[0]))
  waterDrop(ctx, tx + 6, ty - 19 + rim(TR, 6), 2)
  wrap(ctx, tx, ty, TR, 3, 7, 11, 1, (c) => (c % 4 < 2 ? SG[3] : INK))
  // lid: ice hopper, steam vent and a railed catwalk
  const lidY = ty - TH
  for (let dx = -TR; dx < TR; dx += 3) rect(ctx, tx + dx, lidY - rim(TR, dx) - 3, 1, 3, M[2])
  for (let dx = -TR; dx < TR; dx++) rect(ctx, tx + dx, lidY - rim(TR, dx) - 3, 1, 1, SG[2])
  hopper(ctx, tx - 2, lidY + 1, 1, 7, 2, 5, MH, ICE)
  stack(ctx, tx + 6, lidY + 1, 4, 1, MH)
  puffs(ctx, tx + 6, lidY - 6, t, STEAM)
  for (let dx = -TR; dx < TR; dx += 3) rect(ctx, tx + dx, lidY + rim(TR, dx) - 3, 1, 3, M[3])
  for (let dx = -TR; dx < TR; dx++) rect(ctx, tx + dx, lidY + rim(TR, dx) - 3, 1, 1, SG[3])

  // holding tank (level 2+), right
  if (tier >= 2) {
    const [hx, hy] = at(12, -4)
    cyl(ctx, hx, hy, 4, 14, MH, M)
    band(ctx, hx, hy, 4, 11, 1, M[1])
    glowStrip(ctx, hx - 2, hy - 1, 10, lv)
    pipe(ctx, hx - 4, hy - 9, tx + TR - 3, hy - 11, M)
  }

  // control block, front left, with a radiator on its roof
  const [bx0, by0] = at(-7, 7)
  const blk = box(ctx, bx0, by0, 6, 6, 13, M, { seams: 4, rivets: true, roof: MH })
  blk.L(1, 5, 2, 4, cyanWindow(5, 4))
  blk.L(7, 4, 2, 4, cyanWindow(4, 4))
  blk.L(0, 12, 8, 5, (c, r) => (r === 0 ? INK : r === 4 ? ((c + r) % 4 < 2 ? SG[3] : INK) : c % 6 === 1 && r === 1 ? R[4] : R[3]))
  blk.L(2, 8, 9, 1, stencilPx(0b1011011101))
  blk.R(1, 4, 3, 3, (c, r) => (r === 0 || c === 0 ? INK : (c + r + Math.floor(t * 4)) % 3 === 0 ? GLOW : r === 1 ? AL[3] : CY[2]))
  fan(ctx, blk.fx + 8, blk.fy + 3, 2, t)
  blk.R(6, 5, 8, 4, ventPx)
  {
    const [rx0, ry0] = blk.at(-1, -1)
    const rad = box(ctx, rx0, ry0, 4, 3, 4, M, { roof: M })
    rad.L(0, 8, 1, 3, (c) => (c % 2 ? MH[3] : M[1]))
    rad.R(0, 6, 1, 3, (c) => (c % 2 ? M[2] : M[0]))
    if (tier >= 3) rad.L(0, 8, 0, 1, GLOW)
    lamp(ctx, rad.fx, rad.top - 3, (t * 1.5) % 1 < 0.4 ? CY[4] : CY[1], CY[2])
  }
  // feed pipes from the block to the tank, with a red valve wheel
  pipe(ctx, blk.fx + 6, blk.fy - 1, tx - TR + 1, ty - 9, MH)
  pipe(ctx, blk.fx + 6, blk.fy + 6, tx - TR + 2, ty - 3, M)
  rect(ctx, blk.fx + 9, blk.fy - 3, 3, 3, AL[2])
  rect(ctx, blk.fx + 10, blk.fy - 2, 1, 1, INK)
  rect(ctx, blk.fx + 9, blk.fy - 3, 1, 1, AL[4])
  // water outlet: a pump skid at the front with a valve and an outlet stub
  {
    const [px, py] = at(10, 9)
    pipe(ctx, tx - 3, ty + 4, px + 2, py - 5, MH)
    const pump = box(ctx, px, py, 3, 3, 5, MH, { roof: M })
    pump.L(0, 6, 1, 1, CY[3])
    pump.R(1, 4, 2, 2, ventPx)
    rect(ctx, pump.fx - 2, pump.top - 3, 3, 2, AL[2])
    rect(ctx, pump.fx - 2, pump.top - 3, 1, 1, AL[4])
    pipe(ctx, pump.fx - 6, pump.fy + 4, pump.fx - 10, pump.fy + 6, MH)
    blink(ctx, pump.fx + 3, pump.top - 2, t, 0.3)
  }
}

/* -------------------------------- smelter -------------------------------- */

/**
 * Smelter: an armoured furnace hall with two glowing arched mouths and a roof
 * monitor; a tall hazard-banded chimney (two from level 2) fed by an offtake
 * duct; an ore hopper on stilts filled by an inclined belt; and a casting line
 * where poured ingots cool from orange to silver and stack on a pallet.
 */
export function bigSmelter(ctx: Ctx, x: number, y: number, t: number) {
  const tier = getTier()
  const g = plinth(ctx, x, y, 3, 3, 6)
  const at = deck(x, g)
  const flick = (t * 3) % 1 < 0.5 ? 0.06 : 0

  // chimneys behind the hall
  const chimney = (cx: number, cy: number, rx: number, h: number, ph: number) => {
    cyl(ctx, cx, cy, rx, h, M, M)
    for (let z = 8; z < h - 8; z += 9) band(ctx, cx, cy, rx, z, 1, (dx) => (dx < 0 ? M[4] : M[1]))
    band(ctx, cx, cy, rx, h - 7, 4, (dx) => ((dx + 20) % 4 < 2 ? INK : dx < 0 ? SG[4] : SG[2]))
    band(ctx, cx, cy, rx, h - 1, 1, R[3])
    dome(ctx, cx, cy - h, rx - 1, 0, 0, [INK, INK, INK, INK, INK], false)
    ladder(ctx, cx - rx + 2, cy - h + 3, cy - 2)
    blink(ctx, cx + rx, cy - h - 1, t, ph)
    puffs(ctx, cx, cy - h - 4, t, SMOKE)
    if (t > 0) puffs(ctx, cx + 1, cy - h - 10, t + 1.1, SMOKE)
  }
  if (tier >= 2) {
    const [c2x, c2y] = at(-10, -18)
    chimney(c2x, c2y, 4, 42, 0.5)
  }
  const [c1x, c1y] = at(6, -16)
  chimney(c1x, c1y, 5, 54, 0)

  // furnace hall
  const [hx, hy] = at(-2, -2)
  const HH = 28
  const hall = box(ctx, hx, hy, 13, 11, HH, M, { seams: 6, rivets: true, roof: M })
  hall.L(0, 26, 10, 19, armourPx(4))
  hall.L(1, 24, 2, 5, (c, r) => (c % 8 === 7 ? null : cyanWindow(7, 5)(c % 8, r)))
  hall.L(0, 26, 8, 1, (c) => (c % 4 < 2 ? SG[3] : INK))
  // two arched furnace mouths with molten glow and sparks
  for (const c0 of [3, 14]) {
    hall.L(c0, 8, 13, 14, (c, r) => {
      if (r < 2 && (c < 2 - r || c > 5 + r)) return null
      return c === 0 || c === 7 || r === 0 || (r === 1 && (c === 1 || c === 6)) ? INK : c < 2 || c > 5 || r < 2 ? M[0] : null
    })
    hall.L(c0 + 2, 4, 15, 11, (c, r) => tone(SG, 0.3 + r * 0.07 + flick - (c === 3 ? 0.12 : 0), c0 + c, r))
    hall.L(c0 + 2, 4, 24, 2, (c, r) => (r === 0 ? (c % 2 ? HEAT[4] : '#ffffff') : HEAT[3]))
    if (t > 0) hall.L(c0 + 2 + (Math.floor(t * 7 + c0) % 4), 1, 15 + (Math.floor(t * 11 + c0) % 7), 1, '#ffffff')
  }
  // right face: rolling door, vents, stencil and a lamp
  hall.R(2, 9, 12, 16, (c, r) => (c === 0 || c === 8 || r === 0 ? INK : r % 2 ? M[1] : M[2]))
  hall.R(2, 9, 28, 1, hazardPx)
  hall.R(14, 6, 5, 4, ventPx)
  hall.R(14, 6, 13, 4, ventPx)
  hall.R(2, 12, 5, 1, stencilPx(0b110101110111))
  hall.R(0, 22, 9, 1, (c) => (c % 4 < 2 ? SG[2] : INK))
  lamp(ctx, hall.fx + 5, hall.fy + 8, (t * 2) % 1 < 0.5 ? SG[4] : SG[1], SG[2])
  // roof: a monitor with cyan clerestory, an offtake duct to the chimney, fans and a railing
  {
    const [mx, my] = hall.at(-3, -1)
    const mon = box(ctx, mx, my, 7, 4, 4, M, { roof: MH })
    mon.L(0, 14, 1, 2, (c) => (c % 3 === 2 ? INK : c % 3 ? CY[3] : GLOW))
    mon.R(0, 8, 1, 2, ventPx)
    const [dx0, dy0] = hall.at(4, -6)
    for (let k = 0; k < 3; k++) pipe(ctx, dx0, dy0 - k, c1x - 4, c1y - 34 - k, k === 2 ? MH : M)
    for (const [fs, fr] of [
      [6, 3],
      [-8, 6],
    ]) {
      const [fx, fy] = hall.at(fs, fr)
      dome(ctx, fx, fy, 3, 1, 1, MH, false)
      const a = t * Math.PI * 2
      rect(ctx, fx - 2 + Math.round(Math.cos(a) * 2), fy, 1, 1, M[0])
      rect(ctx, fx + 1 - Math.round(Math.cos(a) * 2), fy, 1, 1, M[0])
    }
    const [r0x, r0y] = hall.at(-13, 11)
    const [r1x, r1y] = hall.at(13, 11)
    rail(ctx, r0x, r0y, r1x, r1y, 3)
    const [r2x, r2y] = hall.at(13, -11)
    rail(ctx, r1x, r1y, r2x, r2y, 3, SG[2])
    ladder(ctx, hall.fx + 19, hall.fy - 8, hall.fy + HH - 9)
  }
  blink(ctx, hall.lx + 1, hall.top + 2, t, 0.25)

  // transformer and slag cart, front right
  {
    const [tx0, ty0] = at(17, -8)
    const tr = box(ctx, tx0, ty0, 4, 5, 10, M, { seams: 3, roof: MH })
    tr.L(0, 8, 7, 2, hazardPx)
    tr.R(1, 8, 2, 4, (c, r) => (r % 2 ? M[0] : c % 2 ? M[3] : M[2]))
    for (let k = 0; k < 3; k++) {
      const [ix, iy] = tr.at(-2 + k * 2, k - 1)
      rect(ctx, ix, iy - 4, 1, 4, CY[3])
      rect(ctx, ix, iy - 4, 1, 1, GLOW)
    }
    if (tier >= 3) {
      const [cx, cy] = at(18, -18)
      cyl(ctx, cx, cy, 4, 16, MH, M)
      glowStrip(ctx, cx - 2, cy - 2, 11, 0.8)
    }
  }

  // ore hopper on stilts, fed by an inclined belt from the left corner
  const [ox, oy] = at(-17, 11)
  {
    const [bx0, by0] = at(-23, 20)
    const top = [ox - 7, oy - 26] as const
    for (let k = 0; k < 3; k++) {
      const f = 0.3 + k * 0.3
      const lx = Math.round(bx0 + (top[0] - bx0) * f)
      const ly = Math.round(by0 + (top[1] - by0) * f)
      rect(ctx, lx, ly, 1, by0 - ly + Math.round((lx - bx0) / 2), M[2])
    }
    line(ctx, bx0, by0 - 2, top[0], top[1] - 2, MH[3])
    line(ctx, bx0, by0, top[0], top[1], M[1])
    line(ctx, bx0, by0 - 1, top[0], top[1] - 1, M[0])
    for (let k = 0; k < 4; k++) {
      const f = (t * 0.5 + k / 4) % 1
      rect(ctx, Math.round(bx0 + (top[0] - bx0) * f), Math.round(by0 + (top[1] - by0) * f) - 3, 2, 1, k % 2 ? '#a3565f' : REG[2])
    }
  }
  hopper(ctx, ox, oy, 12, 25, 3, 8, R, ['#4a2a30', '#6e3640', '#a3565f', '#c17a5c', '#d99862'])
  // chute from the hopper into the hall
  for (let k = 0; k < 3; k++) line(ctx, ox + 1, oy - 12 + k, ox + 7, oy - 16 + k, k === 0 ? R[4] : k === 1 ? R[2] : R[0])

  // casting line: moulds ride from the tap to the pallet, cooling as they go
  const [lx0, ly0] = at(5, 15)
  const cast = box(ctx, lx0, ly0, 13, 2, 4, M, { roof: MH })
  cast.L(0, 26, 0, 1, R[3])
  cast.L(0, 26, 1, 3, (c, r) => (c % 4 === 0 ? (r === 0 ? MH[4] : MH[2]) : r === 2 ? M[0] : null))
  cast.R(0, 4, 0, 1, R[1])
  const shift = (t * 2.5) % 5
  for (let s = -12; s <= 12; s += 5) {
    const ss = s + shift
    if (ss > 12) continue
    const [mx, my] = at(5 + ss, 15, 5)
    const cool = (ss + 12) / 24
    const hot = cool < 0.5
    rect(ctx, mx - 2, my, 5, 2, M[0])
    rect(ctx, mx - 1, my, 3, 1, hot ? tone(HEAT, 1 - cool * 0.9, mx, my) : INGOT[3])
    rect(ctx, mx - 1, my, 1, 1, hot ? '#ffffff' : INGOT[4])
    rect(ctx, mx - 1, my + 1, 3, 1, hot ? HEAT[2] : INGOT[1])
    if (hot && t > 0 && ((t * 4) | 0) % 2 === 0) rect(ctx, mx, my - 2, 1, 1, STEAM[2])
  }
  // tap spout from the right mouth pouring into the first mould
  {
    const [sx, sy] = at(-5, 10, 9)
    line(ctx, sx - 2, sy, sx + 2, sy + 2, R[2])
    line(ctx, sx - 2, sy - 1, sx + 2, sy + 1, R[4])
    const [px, py] = at(-5, 15, 5)
    const pour = (t * 4) % 1 < 0.5
    for (let yy = sy + 3; yy < py; yy++) rect(ctx, sx + 2, yy, 1, 1, pour ? HEAT[4] : HEAT[3])
    rect(ctx, px - 1, py - 1, 3, 1, HEAT[3])
    if (t > 0) for (let k = 0; k < 3; k++) rect(ctx, sx + 1 + ((Math.floor(t * 8) + k * 2) % 5) - 2, py - 2 - k, 1, 1, '#fff3c4')
  }
  // ingot pallet at the end of the line
  {
    const [px, py] = at(19, 17)
    box(ctx, px, py, 4, 4, 1, R, { roof: R })
    const rows = tier === 1 ? 2 : 3
    for (let k = 0; k < rows; k++)
      for (let j = 0; j < 3; j++) {
        const ix = px - 4 + j * 3 + (k % 2)
        const iy = py - 3 - k * 2 + (j >> 1)
        rect(ctx, ix, iy, 3, 1, INGOT[3])
        rect(ctx, ix, iy + 1, 3, 1, INGOT[1])
        rect(ctx, ix, iy, 1, 1, INGOT[4])
      }
  }
}

/* ---------------------------------- kiln --------------------------------- */

/**
 * Sinter kiln: a long rotary drum on two riding rings and a girth gear,
 * glowing hot toward the firing hood; a feed hood with a regolith hopper at
 * the cool end; brick chimneys behind; a railed catwalk in front and pallets
 * of finished bricks at the discharge.
 */
export function bigKiln(ctx: Ctx, x: number, y: number, t: number) {
  const tier = getTier()
  const g = plinth(ctx, x, y, 3, 3, 6)
  const at = deck(x, g)
  const spin = t * Math.PI * 0.5
  const flick = (t * 2) % 1 < 0.5 ? 0.05 : 0

  // brick chimneys behind
  if (tier >= 2) {
    const [sx, sy] = at(8, -19)
    brickStack(ctx, sx, sy, 3, 36, t + 0.4)
  }
  {
    const [sx, sy] = at(-9, -17)
    brickStack(ctx, sx, sy, 4, 46, t)
  }
  // flue from the feed hood to the chimney
  {
    const [ax, ay] = at(-21, 0, 21)
    const [bx, by] = at(-9, -17, 30)
    for (let k = 0; k < 3; k++) pipe(ctx, ax, ay - k, bx - 3, by - k, k === 2 ? MH : M)
  }

  // roller piers under the riding rings
  const RS = [-11, 7]
  for (const s of RS) {
    const [px, py] = at(s, 4)
    const pier = box(ctx, px, py, 3, 6, 6, M, { roof: M })
    pier.L(0, 6, 1, 1, hazardPx)
    for (const r of [-4, 4]) {
      const [rx, ry] = at(s, 4 + r, 7)
      dome(ctx, rx, ry, 2, 1, 1, MH, false)
    }
  }
  // drive motor and pinion by the girth gear
  {
    const [mx, my] = at(-3, -6)
    const mot = box(ctx, mx, my, 3, 3, 7, SG, { roof: M })
    mot.R(1, 4, 2, 3, ventPx)
  }

  // the rotary drum
  const [ox, oy] = at(0, 4, 14)
  const s0 = -19
  const s1 = 15
  drum(
    ctx,
    ox,
    oy,
    s0,
    s1,
    8,
    7,
    (s, a, v, X, Y) => {
      const rot = a + spin
      for (const rs of RS) if (Math.abs(s - rs) < 1.6) return tone(MH, v + (Math.abs(s - rs) < 0.6 ? 0.25 : 0), X, Y)
      if (s > -4.5 && s < -1.5) return Math.floor(rot * 10) % 2 ? M[1] : tone(M, v + 0.15, X, Y)
      const seam = ((rot % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3) < 0.12
      if (s > 4) {
        const hot = (s - 4) / (s1 - 4)
        return tone(HEAT, 0.02 + hot * 0.5 + v * 0.32 + flick - (seam ? 0.2 : 0), X, Y)
      }
      return seam ? M[2] : tone(MH, v * 0.85 - 0.05, X, Y)
    },
    () => M[1],
  )
  // shimmer over the hot zone
  if (t > 0)
    for (let k = 0; k < 4; k++) {
      const [hx, hy] = at(4 + k * 3, 4, 23 + ((Math.floor(t * 4) + k) % 3))
      rect(ctx, hx, hy, 1, 1, HEAT[3])
    }

  // feed hood with a hopper of raw regolith
  {
    const [fx, fy] = at(-21, 4)
    const hood = box(ctx, fx, fy, 2, 7, 21, M, { seams: 4, roof: MH })
    hood.L(0, 4, 3, 3, cyanWindow(4, 3))
    hood.L(0, 4, 18, 3, hazardPx)
    hood.R(1, 12, 6, 12, armourPx(4))
    const [hpx, hpy] = hood.at(0, 0)
    hopper(ctx, hpx, hpy + 1, 1, 10, 2, 6, R, REG)
  }
  // firing hood: burner, fuel line and a glowing sight port
  {
    const [fx, fy] = at(19, 4)
    const hood = box(ctx, fx, fy, 3, 8, 24, R, { seams: 4, rivets: true, roof: M })
    hood.L(0, 6, 1, 2, hazardPx)
    hood.R(0, 16, 1, 1, INK)
    hood.R(3, 10, 5, 10, (c, r) => {
      const d = Math.hypot(c - 4.5, r - 4.5)
      return d > 4.6 ? null : d > 3.6 ? M[0] : tone(HEAT, 1 - d * 0.16 + flick, c, r)
    })
    hood.R(12, 3, 4, 14, (c, r) => (r % 3 === 0 ? M[0] : c === 0 ? M[2] : M[1]))
    pipe(ctx, hood.fx + 8, hood.fy + 9, hood.fx + 13, hood.fy + 13, MH)
    rect(ctx, hood.fx + 11, hood.fy + 10, 2, 2, AL[2])
    blink(ctx, hood.fx, hood.top - 2, t)
    const [kx, ky] = hood.at(0, 0)
    stack(ctx, kx, ky + 1, 6, 2)
    if (tier >= 3) lamp(ctx, hood.fx - 4, hood.fy + 3, '#ffffff', SG[3])
  }
  // heat-recovery coolant tank (level 3), right corner
  if (tier >= 3) {
    const [cx, cy] = at(20, -12)
    cyl(ctx, cx, cy, 4, 16, MH, M)
    band(ctx, cx, cy, 4, 3, 1, M[1])
    glowStrip(ctx, cx - 2, cy - 3, 10, 0.75)
    pipe(ctx, cx - 4, cy - 12, cx - 9, cy - 14, MH)
  }

  // catwalk along the drum, railed, on posts, with a ladder down
  {
    const z = 5
    const [ax, ay] = at(-14, 13, z)
    const [bx, by] = at(13, 13, z)
    for (let k = 0; k <= 27; k += 9) {
      const [px, py] = at(-14 + k, 13)
      rect(ctx, px, py - z, 1, z, M[2])
    }
    for (let k = 0; k <= 1; k++) line(ctx, ax, ay + k, bx, by + k, k ? M[1] : R[3])
    rail(ctx, ax, ay, bx, by, 3)
    ladder(ctx, ax - 2, ay, ay + z)
  }

  // control cabin, front left
  {
    const [cx, cy] = at(-15, 15)
    const cab = box(ctx, cx, cy, 5, 5, 12, M, { seams: 5, roof: MH })
    cab.L(1, 8, 2, 4, cyanWindow(8, 4))
    cab.L(0, 10, 8, 4, armourPx(4))
    cab.R(2, 3, 4, 8, (c, r) => (c === 1 && r > 0 ? M[1] : INK))
    cab.R(6, 3, 3, 3, ventPx)
    const [ax, ay] = cab.at(0, 0)
    rect(ctx, ax, ay - 8, 1, 8, M[3])
    rect(ctx, ax - 1, ay - 8, 3, 1, MH[3])
    lamp(ctx, ax, ay - 10, (t * 1.5) % 1 < 0.4 ? CY[4] : CY[1], CY[2])
  }

  // discharge chute and pallets of finished bricks
  {
    const [cx, cy] = at(16, 13, 6)
    line(ctx, cx, cy, cx - 4, cy + 4, R[3])
    line(ctx, cx + 1, cy, cx - 3, cy + 4, R[1])
    if (t > 0) rect(ctx, cx - 2 + (Math.floor(t * 8) % 3), cy + 2, 2, 1, BRICK[3])
    const pallets: [number, number][] = [
      [9, 19],
      [17, 19],
      [5, 12],
    ]
    for (const [s, r] of pallets.slice(0, tier === 1 ? 2 : 3)) {
      const [px, py] = at(s, r)
      box(ctx, px, py, 3, 3, 1, M, { roof: M })
      const st = box(ctx, px, py - 1, 3, 3, 5, BRICK, { roof: BRICK })
      st.L(0, 6, 0, 5, (c, r) => (r % 2 === 1 || (c + (r >> 1) * 2) % 4 === 3 ? BRICK[1] : null))
      st.R(0, 6, 0, 5, (c, r) => (r % 2 === 1 || (c + (r >> 1) * 2) % 4 === 3 ? BRICK[0] : null))
    }
  }
}

/* --------------------------------- washer -------------------------------- */

/**
 * Soil washer: a rotating trommel with a perforated sieve shell under a spray
 * bar, fed from a regolith hopper; tall water tanks with sight glasses linked by
 * a railed catwalk behind; a settling pond with a pump; and a conveyor carrying
 * clean dark soil to a heap at the front.
 */
export function bigWasher(ctx: Ctx, x: number, y: number, t: number) {
  const tier = getTier()
  const g = plinth(ctx, x, y, 3, 3, 6)
  const at = deck(x, g)
  const spin = t * Math.PI * 0.5
  const wave = Math.floor(t * 4)

  // water tanks behind, with sight glasses and a catwalk between them
  const tank = (s: number, r: number, rx: number, h: number, fill: number) => {
    const [cx, cy] = at(s, r)
    cyl(ctx, cx, cy, rx, h, MH, M)
    for (let z = 6; z < h - 2; z += 8) band(ctx, cx, cy, rx, z, 1, (dx) => (dx < 0 ? M[3] : M[1]))
    band(ctx, cx, cy, rx, 2, 2, (dx) => ((dx + 20) % 4 < 2 ? INK : SG[3]))
    const gh = h - 12
    const lit = Math.round(gh * fill)
    wrap(ctx, cx, cy, rx, -rx + 2, 4, 5, gh + 2, (c, r) => {
      if (c === 0 || c === 3 || r === 0 || r === gh + 1) return INK
      const k = r - 1
      if (k >= lit) return '#16303b'
      if (k === lit - 1) return (c + wave) % 2 ? GLOW : CY[4]
      return tone(CY, 0.7 - (k / gh) * 0.3 + (c === 1 ? 0.1 : 0), c, k)
    })
    return [cx, cy - h] as const
  }
  const tops: (readonly [number, number])[] = []
  if (tier >= 2) tops.push(tank(-20, -8, 5, 24, 0.6))
  tops.push(tank(-8, -17, 7, 32, 0.8))
  tops.push(tank(9, -17, 6, 27, 0.7))
  {
    const [a, b] = tops.slice(-2)
    line(ctx, a[0] + 4, a[1] + 1, b[0] - 3, b[1] + 1, R[3])
    line(ctx, a[0] + 4, a[1] + 2, b[0] - 3, b[1] + 2, M[1])
    rail(ctx, a[0] + 4, a[1] + 1, b[0] - 3, b[1] + 1, 3)
    ladder(ctx, b[0] + 2, b[1] + 4, b[1] + 25)
    blink(ctx, a[0], a[1] - 4, t)
    rect(ctx, a[0], a[1] - 3, 1, 3, M[3])
  }
  // feed pipes from the tanks to the spray bar
  const [sbx0, sby0] = at(-12, 4, 23)
  const [sbx1, sby1] = at(9, 4, 23)
  pipe(ctx, tops[tops.length - 2][0] - 4, tops[tops.length - 2][1] + 14, sbx0 + 6, sby0 - 3, M)

  // trommel supports
  for (const s of [-10, 6]) {
    const [px, py] = at(s, 4)
    const [lx, ly] = at(s, -2)
    const [rx, ry] = at(s, 10)
    line(ctx, px, py - 14, lx, ly, M[1])
    line(ctx, px, py - 14, rx, ry, MH[3])
    line(ctx, (px + rx) >> 1, ((py + ry) >> 1) - 7, (px + lx) >> 1, ((py + ly) >> 1) - 7, M[2])
    rect(ctx, rx - 1, ry - 1, 3, 1, SG[3])
  }
  // the trommel: solid collars, a perforated sieve shell, rust rib rings
  const [ox, oy] = at(0, 4, 13)
  const s0 = -15
  const s1 = 12
  drum(
    ctx,
    ox,
    oy,
    s0,
    s1,
    8,
    7,
    (s, a, v, X, Y) => {
      const rot = a + spin
      if (s < -10 || s > 9) return tone(M, v * 0.9, X, Y)
      if (Math.abs(s + 3) < 1 || Math.abs(s - 5) < 1 || Math.abs(s + 9) < 0.8) return tone(R, v + 0.05, X, Y)
      const ka = Math.floor(((rot / (Math.PI * 2)) * 28 + 100) % 28)
      const hole = (Math.floor(s + 20) + ka) % 2 === 0 && ka % 2 === 0
      if (hole) return (ka + Math.floor(s) + wave) % 5 === 0 ? CY[4] : CY[1]
      return tone(MH, v * 0.8, X, Y)
    },
    (V, Z) => (Math.hypot(V / 8, Z / 7) > 0.7 ? MH[1] : Math.hypot(V / 8, Z / 7) > 0.5 ? INK : SOIL[2]),
  )
  // spray bar with nozzles misting the sieve
  for (let k = 0; k < 2; k++) line(ctx, sbx0, sby0 + k, sbx1, sby1 + k, k ? M[1] : MH[3])
  for (let k = 0; k <= 4; k++) {
    const nx = Math.round(sbx0 + ((sbx1 - sbx0) * k) / 4)
    const ny = Math.round(sby0 + ((sby1 - sby0) * k) / 4)
    rect(ctx, nx, ny + 2, 1, 1, M[0])
    if (t > 0) for (let j = 0; j < 3; j++) rect(ctx, nx - 1 + j, ny + 3 + ((wave + j + k) % 3), 1, 1, j === 1 ? GLOW : CY[3])
  }
  // regolith feed hopper at the back end
  {
    const [hx, hy] = at(-18, 4)
    hopper(ctx, hx, hy, 14, 26, 3, 7, R, REG)
    line(ctx, hx + 2, hy - 14, hx + 5, hy - 11, R[2])
  }

  // settling pond with a pump, front left
  {
    const [px, py] = at(-13, 14)
    const pond = box(ctx, px, py, 7, 6, 7, M, { seams: 4, roof: CY })
    pond.L(0, 14, 2, 2, hazardPx)
    pond.R(0, 12, 3, 3, ventPx)
    for (let k = 0; k < 6; k++) {
      const [wx, wy] = pond.at(-5 + ((k * 5 + wave) % 11), -4 + ((k * 3) % 9))
      rect(ctx, wx, wy, 2, 1, k % 2 ? GLOW : CY[4])
    }
    const [r0x, r0y] = pond.at(-7, 6)
    const [r1x, r1y] = pond.at(7, 6)
    rail(ctx, r0x, r0y, r1x, r1y, 3)
    if (tier >= 3) pond.L(1, 12, 5, 1, (c) => (c % 3 === 2 ? null : c % 3 ? CY[4] : GLOW)) // UV steriliser strip
    const [mx, my] = at(-3, 15)
    const pump = box(ctx, mx, my, 3, 3, 6, R, { roof: M })
    pump.R(1, 4, 1, 3, ventPx)
    pipe(ctx, pump.fx, pump.top - 2, ox - 10, oy + 8, MH)
    rect(ctx, pump.fx + 1, pump.top - 4, 2, 2, AL[2])
    rect(ctx, pump.fx + 1, pump.top - 4, 1, 1, AL[4])
  }

  // clean-soil conveyor from the discharge end to a heap at the front
  {
    const [ax, ay] = at(15, 5, 6)
    const [bx, by] = at(15, 17, 3)
    for (let k = 0; k < 3; k++) line(ctx, ax, ay + k, bx, by + k, k === 0 ? MH[3] : k === 1 ? M[2] : M[0])
    rect(ctx, ax, ay + 3, 1, 4, M[2])
    for (let k = 0; k < 4; k++) {
      const f = (t * 0.5 + k / 4) % 1
      rect(ctx, Math.round(ax + (bx - ax) * f), Math.round(ay + (by - ay) * f) - 1, 2, 1, k % 2 ? SOIL[3] : SOIL[2])
    }
    const [hx, hy] = at(14, 20)
    dome(ctx, hx, hy, 7, tier >= 2 ? 6 : 5, 2, SOIL, false)
    for (let k = 0; k < 5; k++) rect(ctx, hx - 4 + ((k * 3) % 8), hy - 2 + ((k * 5) % 4), 1, 1, k % 2 ? SOIL[4] : SOIL[1])
    if (t > 0) rect(ctx, bx - 1, by + 2 + (wave % 3), 1, 1, SOIL[3])
  }
  // sieve deck: a sloped vibrating screen draining into a sump, right
  {
    const [sx, sy] = at(17, -7)
    const sump = box(ctx, sx, sy, 5, 5, 5, M, { roof: CY })
    sump.L(0, 10, 1, 1, hazardPx)
    const jig = t > 0 && (t * 8) % 2 < 1 ? 1 : 0
    for (let k = 0; k < 8; k++) line(ctx, sx - 7 + k * 2, sy - 13 + jig + (k >> 1), sx - 3 + k * 2, sy - 7 + jig + (k >> 1), k % 2 ? M[1] : MH[3])
    rect(ctx, sx + 6, sy - 10, 1, 6, M[2])
    if (tier >= 2) lamp(ctx, sx + 7, sy - 12, tier >= 3 ? '#ffffff' : SG[4], SG[2])
  }
}
