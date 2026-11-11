/**
 * RENOVA building art, in the industrial style of the reference sheet:
 * gunmetal plating, rust-orange armour, glowing cyan glass, hazard-yellow
 * signals, every building standing on a dark cross-braced steel plinth.
 *
 * Each function draws one building on ground point (x, y): the tile centre for
 * 1×1 buildings, the footprint centre for bigger ones. A w×h footprint spans
 * ±(w+h)·8 px. `t` is animation time; frame 0 (t = 0) doubles as the idle
 * pose, so smoke, steam and sparks only appear when t > 0.
 *
 * Belt docks, output chutes, drone pads and rover bays are drawn by the scene
 * from the live layout (see ports in ./art), not baked in here.
 */
import { rect, type Ctx } from '@/site/pixel/engine'
import {
  armourPx,
  band,
  cyanWindow,
  cyl,
  dome,
  faceL,
  faceR,
  fan,
  GLOW,
  hazardPx,
  hull,
  hullTop,
  INK,
  lamp,
  pipe,
  plinth,
  RAMP,
  signboard,
  stencilPx,
  tone,
  trefoil,
  ventPx,
  waterDrop,
  type Ramp,
} from '@/game/art/pixel'

export function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, c: string) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let k = 0; k <= n; k++) rect(ctx, Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), 1, 1, c)
}

const M = RAMP.metal
const MH = RAMP.metalHi
const R = RAMP.rust
const S = RAMP.sand
const CY = RAMP.cyan
const SG = RAMP.signal
const SOIL: Ramp = ['#24160f', '#3b281b', '#573b27', '#785536', '#9c7450']
const OLIVE: Ramp = ['#3a3b26', '#5c5d39', '#858653', '#9aa66a', '#b9c48a']
const SMOKE: Ramp = ['#3a3a3e', '#55555b', '#74747a', '#96969b', '#bdbdc0']
const STEAM: Ramp = ['#9fb0c0', '#bccad6', '#d5e0e9', '#ebf2f7', '#ffffff']

/** Rising puffs of smoke or steam above (x, y), growing as they climb. */
function puffs(ctx: Ctx, x: number, y: number, t: number, ramp: Ramp) {
  if (t <= 0) return
  for (let k = 0; k < 4; k++) {
    const rise = (t * 6 + k * 3.2) % 13
    const r = rise > 8 ? 2 : rise > 3 ? 1.5 : 1
    const px = x + Math.round(Math.sin(k * 2.1 + rise * 0.3) * 1.5 + rise / 5)
    dome(ctx, px, Math.round(y - rise), Math.ceil(r + 0.5), Math.ceil(r), Math.ceil(r), ramp, false)
  }
}

/** A vertical cyan glow strip on a tank, lit up to `level` (0–1). */
function glowStrip(ctx: Ctx, x: number, bottom: number, h: number, level = 1) {
  rect(ctx, x - 1, bottom - h - 1, 4, h + 2, INK)
  const lit = Math.round(h * level)
  for (let k = 0; k < h; k++) {
    const on = k < lit
    rect(ctx, x, bottom - k, 1, 1, on ? GLOW : CY[0])
    rect(ctx, x + 1, bottom - k, 1, 1, on ? CY[4] : CY[0])
  }
}

/** A small exhaust stack with a dark mouth. */
function stack(ctx: Ctx, x: number, base: number, h: number, rx = 2, ramp: Ramp = M) {
  cyl(ctx, x, base, rx, h, ramp, M)
  dome(ctx, x, base - h, rx - 1, 0, 0, [INK, INK, INK, INK, INK], false)
}

/** A cluster of thin antennas and a tiny dish on a roof. */
function antennas(ctx: Ctx, x: number, y: number, t: number) {
  for (const [dx, h] of [
    [0, 9],
    [3, 6],
    [-3, 5],
  ]) {
    rect(ctx, x + dx, y - h, 1, h, M[3])
    rect(ctx, x + dx - 1, y - h, 3, 1, MH[3])
  }
  dome(ctx, x + 6, y - 4, 3, 2, 2, MH, false)
  rect(ctx, x + 6, y - 2, 1, 2, M[2])
  lamp(ctx, x, y - 11, (t * 1.5) % 1 < 0.4 ? RAMP.alert[4] : RAMP.alert[0], RAMP.alert[1])
}

/* -------------------------------- 1 × 1 --------------------------------- */

export function iceDrill(ctx: Ctx, x: number, y: number, t: number) {
  const g = plinth(ctx, x, y, 1, 1, 4)
  // pump house, back left
  const cx = x - 5
  const top = hullTop(g, 8, 7)
  hull(ctx, cx, top, 8, 7, M, { seams: 4, roof: MH })
  faceL(ctx, cx, top, 8, 1, 3, 1, 3, cyanWindow(3, 3))
  faceL(ctx, cx, top, 8, 0, 8, 5, 2, R[3])
  faceR(ctx, cx, top, 8, 0, 8, 5, 2, R[1])
  // lattice derrick, front right
  const bx = x + 5
  const by = g + 2
  const H = 26
  const legL = (k: number) => bx - 5 + Math.round((k * 4) / H)
  const legR = (k: number) => bx + 4 - Math.round((k * 4) / H)
  for (let k = 2; k + 5 <= H - 2; k += 5) {
    line(ctx, legL(k), by - k, legR(k + 5), by - k - 5, M[1])
    line(ctx, legR(k), by - k, legL(k + 5), by - k - 5, M[2])
    rect(ctx, legL(k), by - k, legR(k) - legL(k) + 1, 1, M[2])
  }
  for (let k = 0; k <= H; k++) {
    rect(ctx, legL(k), by - k, 1, 1, MH[3])
    rect(ctx, legR(k), by - k, 1, 1, M[1])
  }
  const stroke = Math.round(Math.sin(t * Math.PI) * 2)
  rect(ctx, bx - 1, by - H + 4 + stroke, 1, H - 5, MH[2])
  rect(ctx, bx, by - H + 4 + stroke, 1, H - 5, M[0])
  rect(ctx, bx - 2, by - H + 8 + stroke, 4, 3, R[3])
  rect(ctx, bx - 2, by - H + 8 + stroke, 2, 1, R[4])
  rect(ctx, bx - 3, by - H - 1, 6, 2, R[3])
  rect(ctx, bx - 3, by - H - 1, 3, 1, R[4])
  lamp(ctx, bx, by - H - 3, (t * 2) % 1 < 0.5 ? SG[4] : SG[1], SG[2])
  // glowing ice-core canister on a hose
  cyl(ctx, x - 9, g + 6, 3, 7, MH, M)
  glowStrip(ctx, x - 10, g + 5, 5)
  pipe(ctx, x - 6, g + 1, bx - 3, by - 1, M)
}

export function excavator(ctx: Ctx, x: number, y: number, t: number) {
  // crawler tracks with moving treads
  const tt = hullTop(y + 1, 10, 3)
  hull(ctx, x - 2, tt, 10, 3, M)
  faceL(ctx, x - 2, tt, 10, 0, 10, 1, 2, (c) => ((c + Math.floor(t * 8)) % 2 ? INK : null))
  faceR(ctx, x - 2, tt, 10, 0, 10, 1, 2, (c) => ((c + Math.floor(t * 8)) % 2 ? INK : null))
  // rust body and armoured cab
  const bt = hullTop(y - 3, 9, 5)
  hull(ctx, x - 2, bt, 9, 5, R, { seams: 4, roof: M })
  faceL(ctx, x - 2, bt, 9, 1, 7, 4, 1, hazardPx)
  const ct = hullTop(y - 9, 5, 6)
  hull(ctx, x - 5, ct, 5, 6, M, { roof: MH })
  faceL(ctx, x - 5, ct, 5, 1, 3, 1, 3, cyanWindow(3, 3))
  stack(ctx, x + 2, y - 11, 4, 1)
  if (t > 0) rect(ctx, x + 2, y - 18 - Math.floor((t * 4) % 3), 1, 1, SMOKE[2])
  // boom and bucket wheel
  pipe(ctx, x + 1, y - 10, x + 10, y - 6, R)
  const wx = x + 11
  const wy = y - 4
  dome(ctx, wx, wy, 5, 5, 5, M, false)
  dome(ctx, wx, wy, 2, 2, 2, MH, false)
  for (let k = 0; k < 6; k++) {
    const a = t * 3 + (k * Math.PI) / 3
    const bx = Math.round(wx + Math.cos(a) * 5)
    const by = Math.round(wy + Math.sin(a) * 5)
    rect(ctx, bx - 1, by - 1, 2, 2, R[3])
    rect(ctx, bx - 1, by - 1, 1, 1, R[4])
  }
  if (t > 0 && (t * 4) % 1 < 0.5) rect(ctx, wx + 3, wy + 4, 2, 1, S[4])
}

/** Ice melter: a small water plant — process block, glowing tank, water-drop sign. */
export function melter(ctx: Ctx, x: number, y: number, t: number, level: number) {
  const g = plinth(ctx, x, y, 1, 1, 4)
  // tank, back right, with a glow strip showing how full it is
  cyl(ctx, x + 7, g - 2, 4, 15, M, MH)
  glowStrip(ctx, x + 5, g - 4, 10, Math.max(0.1, level))
  // process block
  const top = hullTop(g + 1, 9, 10)
  hull(ctx, x - 3, top, 9, 10, M, { seams: 3, roof: MH })
  faceL(ctx, x - 3, top, 9, 1, 5, 1, 3, cyanWindow(5, 3))
  faceL(ctx, x - 3, top, 9, 0, 9, 7, 2, R[3])
  faceR(ctx, x - 3, top, 9, 0, 9, 7, 2, R[1])
  faceR(ctx, x - 3, top, 9, 2, 5, 2, 3, ventPx)
  pipe(ctx, x + 1, g - 10, x + 3, g - 10)
  // water-drop sign on a truss mast
  for (let k = 0; k < 9; k++) {
    rect(ctx, x - 5, top + 3 - k, 1, 1, M[3])
    rect(ctx, x - 1, top + 3 - k, 1, 1, M[1])
    if (k % 3 === 0) rect(ctx, x - 5, top + 3 - k, 5, 1, M[2])
  }
  waterDrop(ctx, x - 3, top - 10, 4)
  puffs(ctx, x + 7, g - 20, t, STEAM)
}

/** MOXIE: a central oxygen tank with a roof fan, wrapped in fan-cooled container modules. */
export function moxie(ctx: Ctx, x: number, y: number, t: number) {
  const g = plinth(ctx, x, y, 1, 1, 4)
  // exhaust stacks behind
  stack(ctx, x + 3, g - 8, 12, 2)
  stack(ctx, x + 6, g - 6, 10, 2)
  // central tank with a cyan window band and roof fan
  cyl(ctx, x, g - 1, 5, 15, MH, M)
  band(ctx, x, g - 1, 5, 9, 2, (dx) => (dx % 3 === 0 ? INK : dx < 0 ? CY[4] : CY[2]))
  fan(ctx, x, g - 16, 3, t)
  // container modules, front left (rust) and front right (sand), each with a fan
  const lt = hullTop(g + 4, 6, 6)
  hull(ctx, x - 8, lt, 6, 6, R, { roof: R })
  fan(ctx, x - 10, lt + 7, 2, t * 1.3)
  const rt = hullTop(g + 4, 6, 5)
  hull(ctx, x + 8, rt, 6, 5, S, { roof: S })
  faceR(ctx, x + 8, rt, 6, 1, 4, 1, 3, ventPx)
  lamp(ctx, x, g - 21, (t * 2) % 1 < 0.5 ? RAMP.veg[4] : RAMP.veg[1], RAMP.veg[0])
}

/**
 * Solar, by level: a single panel on two posts (1), three panels in rust frames
 * (2), then a station (3): three steeper panels in cyan frames, an inverter
 * cabinet and a weather mast with a spinning anemometer.
 */
export function solarArray(ctx: Ctx, x: number, y: number, t: number, tier = 1) {
  const g = plinth(ctx, x, y, 1, 1, 4)
  const V = 0.38
  const steep = tier === 3 ? 16 : 13
  const lift = (v: number) => 4 + (V - v) * steep
  const at = (u: number, v: number) => [Math.round(x + (u - v) * 16), Math.round(g + (u + v) * 8 - lift(v))] as const
  const panels: [number, number][] =
    tier === 1
      ? [[-0.3, 0.3]]
      : [
          [-0.42, -0.16],
          [-0.13, 0.13],
          [0.16, 0.42],
        ]
  const frameL = tier === 3 ? CY[4] : R[3]
  const frameD = tier === 3 ? CY[2] : R[1]
  if (tier === 3) {
    // inverter cabinet behind the panels, with a glowing readout
    const it = hullTop(g - 4, 5, 8)
    hull(ctx, x + 8, it, 5, 8, M, { roof: MH })
    faceL(ctx, x + 8, it, 5, 1, 3, 1, 3, cyanWindow(3, 3))
    // weather mast with a spinning anemometer
    rect(ctx, x - 9, g - 28, 1, 22, M[3])
    const a = t * 6
    for (let k = 0; k < 3; k++) {
      const ang = a + (k * Math.PI * 2) / 3
      rect(ctx, x - 9 + Math.round(Math.cos(ang) * 3), g - 28 + Math.round(Math.sin(ang) * 1.2), 1, 1, MH[4])
    }
    lamp(ctx, x - 9, g - 30, (t * 1.5) % 1 < 0.4 ? RAMP.alert[4] : RAMP.alert[0], RAMP.alert[1])
  }
  // posts
  for (const [u0, u1] of panels) {
    const u = (u0 + u1) / 2
    for (const v of [-V + 0.06, V - 0.06]) {
      const px = Math.round(x + (u - v) * 16)
      const py = Math.round(g + (u + v) * 8)
      const z = Math.round(lift(v))
      rect(ctx, px, py - z, 1, z, M[3])
      rect(ctx, px + 1, py - z + 1, 1, z - 1, M[1])
    }
  }
  const sweep = (t * 0.5) % 2.4 - 0.6
  for (const [u0, u1] of panels)
    for (let u = u0; u <= u1; u += 1 / 48)
      for (let v = -V; v <= V; v += 1 / 48) {
        const [px, py] = at(u, v)
        const frame = u - u0 < 0.025 || u1 - u < 0.025 || Math.abs(v) > V - 0.03
        const gu = ((u - u0) / (u1 - u0)) * (tier === 1 ? 4 : 3)
        const gv = ((v + V) / (2 * V)) * 5
        const grid = Math.abs(gu - Math.round(gu)) < 0.08 || Math.abs(gv - Math.round(gv)) < 0.08
        let c: string
        if (frame) c = v > V - 0.03 || u1 - u < 0.025 ? frameD : frameL
        else if (grid) c = tier === 3 ? CY[1] : RAMP.neutral[1]
        else c = tone(tier === 3 ? RAMP.navy : M, 0.32 + (V - v) * 0.35, px, py)
        if (!frame && Math.abs(u * 0.6 - v - sweep) < 0.05) c = RAMP.neutral[3]
        rect(ctx, px, py, 1, 1, c)
      }
  if (tier === 3) for (let k = 0; k < 6; k++) rect(ctx, x - 6 + k * 2, g + 5 - (k >> 1), 1, 1, (t * 3 + k) % 2 < 1 ? GLOW : CY[2])
}

/** Height above the ground where a pylon's cables attach, by level. */
export const PYLON_TOP = [26, 32, 38]

/** Power pylon: a lattice mast with a cross-arm and glass insulators; a substation at level 3. */
export function pylon(ctx: Ctx, x: number, y: number, t: number, tier = 1) {
  // concrete footing
  hull(ctx, x, hullTop(y + 1, 6, 2), 6, 2, RAMP.stone, { roof: RAMP.stone })
  if (tier === 3) {
    // substation transformer at the foot
    const tt = hullTop(y + 4, 7, 7)
    hull(ctx, x - 6, tt, 7, 7, M, { seams: 2, roof: MH })
    faceL(ctx, x - 6, tt, 7, 0, 7, 0, 1, hazardPx)
    glowStrip(ctx, x - 9, y - 1, 4)
  }
  const H = PYLON_TOP[tier - 1] + 2
  const by = y - 1
  const legL = (k: number) => x - 4 + Math.round((k * 3) / H)
  const legR = (k: number) => x + 3 - Math.round((k * 3) / H)
  for (let k = 2; k + 5 <= H - 4; k += 5) {
    line(ctx, legL(k), by - k, legR(k + 5), by - k - 5, M[1])
    line(ctx, legR(k), by - k, legL(k + 5), by - k - 5, M[2])
  }
  for (let k = 0; k <= H; k++) {
    rect(ctx, legL(k), by - k, 1, 1, MH[3])
    rect(ctx, legR(k), by - k, 1, 1, M[1])
  }
  // cross-arms with hanging insulators
  const arms = tier === 1 ? [H - 4] : [H - 4, H - 10]
  for (const ay of arms) {
    rect(ctx, x - 8, by - ay, 17, 1, MH[3])
    rect(ctx, x - 8, by - ay + 1, 17, 1, M[1])
    for (const ix of [-7, 7]) {
      rect(ctx, x + ix, by - ay + 2, 1, 2, CY[4])
      rect(ctx, x + ix, by - ay + 4, 1, 1, CY[2])
    }
  }
  lamp(ctx, x, by - H - 1, (t * 2) % 1 < 0.5 ? GLOW : CY[2], CY[1])
}

/**
 * Parts an upgrade adds to any building: a back-corner equipment module with a
 * glowing strip from level 2, and a mast with a beacon at level 3. Drawn behind
 * the building so it peeks out without covering its face.
 */
export function upgradeKit(ctx: Ctx, x: number, y: number, w: number, h: number, t: number, tier: number) {
  if (tier < 2) return
  const P = w > 1 || h > 1 ? 6 : 4
  // back corner of the footprint, pulled in a little, on top of the plinth
  const bx = Math.round(x + (h - w) * 8 * 0.55)
  const byy = Math.round(y - (w + h) * 4 * 0.55 - P)
  const mt = hullTop(byy, 5, 7)
  hull(ctx, bx, mt, 5, 7, M, { roof: MH })
  faceL(ctx, bx, mt, 5, 1, 1, 1, 5, (_, r) => (r === 0 ? GLOW : CY[4]))
  faceR(ctx, bx, mt, 5, 1, 3, 2, 2, ventPx)
  if (tier < 3) return
  rect(ctx, bx + 3, mt - 14, 1, 16, M[3])
  rect(ctx, bx + 4, mt - 13, 1, 15, M[1])
  dome(ctx, bx + 6, mt - 9, 3, 2, 2, MH, false)
  lamp(ctx, bx + 3, mt - 16, (t * 1.5) % 1 < 0.4 ? RAMP.alert[4] : RAMP.alert[0], RAMP.alert[1])
}

export function berm(ctx: Ctx, x: number, y: number, t: number) {
  void t
  const rx = 15
  const ry = 9
  const rb = 7
  dome(ctx, x, y - 1, rx, ry, rb, S, false)
  for (let row = 0; row < 5; row++) {
    const dy = -8 + row * 3
    const k = dy <= 0 ? 1 - (dy / (ry + 0.5)) ** 2 : 1 - (dy / (rb + 0.5)) ** 2
    const w = Math.round(rx * Math.sqrt(Math.max(0, k)))
    for (let j = -w + 1 + (row % 2) * 2; j < w - 3; j += 4) {
      const lit = 0.75 - ((j + w) / (2 * w)) * 0.5 - row * 0.03
      rect(ctx, x + j, y - 1 + dy, 3, 1, tone(S, lit + 0.2, x + j, y + dy))
      rect(ctx, x + j, y + dy, 3, 1, tone(R, lit + 0.1, x + j, y + dy + 1))
      rect(ctx, x + j + 3, y - 1 + dy, 1, 2, R[0])
    }
  }
  // shelter hatch in a steel frame with a cyan status light
  for (let r = 0; r < 6; r++) rect(ctx, x - 10, y - 4 + r, 6, 1, r < 2 ? INK : M[1])
  rect(ctx, x - 11, y - 5, 8, 1, M[4])
  rect(ctx, x - 11, y - 5, 1, 7, M[3])
  rect(ctx, x - 4, y - 5, 1, 7, M[1])
  lamp(ctx, x - 7, y - 7, GLOW, CY[2])
  // radiation sign on the crest
  signboard(ctx, x + 5, y - 15, 7, 6, y - 7, trefoil(7, 6))
}

export function battery(ctx: Ctx, x: number, y: number, t: number) {
  const g = plinth(ctx, x, y, 1, 1, 4)
  const hw = 11
  const h = 9
  const top = hullTop(g + 1, hw, h)
  hull(ctx, x, top, hw, h, M, { seams: 2, roof: MH })
  faceL(ctx, x, top, hw, 0, hw, 0, 1, hazardPx)
  faceR(ctx, x, top, hw, 0, hw, h - 2, 2, R[1])
  // charge cells glow cyan and fill in a loop
  const lit = Math.floor(t * 2) % 5
  for (let k = 0; k < 4; k++) {
    faceL(ctx, x, top, hw, 2 + k * 2, 1, 2, 6, INK)
    if (k < lit || t === 0) faceL(ctx, x, top, hw, 2 + k * 2, 1, 3, 4, (_, r) => (r === 0 ? GLOW : CY[4]))
  }
  faceR(ctx, x, top, hw, 2, 8, 3, 1, stencilPx(0b11011011))
  rect(ctx, x - 5, top + 3, 3, 2, RAMP.alert[1])
  rect(ctx, x - 5, top + 2, 3, 1, RAMP.alert[3])
  rect(ctx, x + 2, top + 3, 3, 2, M[2])
  rect(ctx, x + 2, top + 2, 3, 1, MH[4])
}

/* -------------------------------- lander --------------------------------- */

/** The lander / supply rocket. Base at (x, y). */
export function rocket(ctx: Ctx, x: number, y: number, t: number) {
  const N = RAMP.neutral
  for (let k = 0; k < 7; k++) {
    rect(ctx, x - 6 - (k >> 1), y - 7 + k, 1, 1, M[3])
    rect(ctx, x + 5 + (k >> 1), y - 7 + k, 1, 1, M[1])
  }
  rect(ctx, x - 10, y, 3, 1, M[2])
  rect(ctx, x + 8, y, 3, 1, M[1])
  for (let k = 0; k < 3; k++) rect(ctx, x - 2 - k, y - 3 + k, 5 + k * 2, 1, M[k + 1])
  cyl(ctx, x, y - 3, 5, 30, N, M)
  band(ctx, x, y - 3, 5, 6, 2, (dx) => (dx < 0 ? R[4] : R[2]))
  band(ctx, x, y - 3, 5, 18, 3, (dx) => ((dx + 5) % 4 < 2 ? INK : dx < 0 ? R[4] : R[2]))
  for (let k = 0; k < 10; k++) {
    const w = Math.max(1, Math.round(5 * (1 - k / 10)))
    for (let dx = -w; dx < w; dx++) rect(ctx, x + dx, y - 34 - k, 1, 1, tone(N, 0.85 - ((dx + w) / (2 * w)) * 0.6, x + dx, y - k))
  }
  for (const s of [-1, 1]) for (let k = 0; k < 5; k++) rect(ctx, x + s * (5 + (k >> 1)) - (s < 0 ? 1 : 0), y - 11 + k, 1, 1, s < 0 ? R[4] : R[1])
  rect(ctx, x - 2, y - 25, 3, 3, INK)
  rect(ctx, x - 1, y - 24, 1, 1, GLOW)
  lamp(ctx, x, y - 45, (t * 1.2) % 1 < 0.3 ? RAMP.alert[4] : RAMP.alert[0], RAMP.alert[1])
}

/**
 * Colony core: lander on the left sub-tile, armoured crew module on the right,
 * two drone landing pads at the back, and the supply-ship landing ring in front.
 * Drone pad centres: (x ± 7, y − 6 − 8) — see DRONE_PADS in ./units.
 */
export function coreBuilding(ctx: Ctx, x: number, y: number, t: number) {
  const g = plinth(ctx, x, y, 2, 2, 6, RAMP.signal)
  // drone pads on the back sub-tile
  for (const dx of [-7, 7]) {
    const py = g - 8
    for (let dy = -3; dy <= 3; dy++) {
      const w = Math.round(6 * Math.sqrt(Math.max(0, 1 - (dy / 3.5) ** 2)))
      for (let k = -w; k < w; k++) rect(ctx, x + dx + k, py + dy, 1, 1, Math.abs(dy) === 3 || Math.abs(k) >= w - 1 ? SG[3] : tone(M, 0.55, x + k, py + dy))
    }
    // "H" marking and corner lights
    rect(ctx, x + dx - 2, py - 1, 1, 3, SG[4])
    rect(ctx, x + dx + 2, py - 1, 1, 3, SG[4])
    rect(ctx, x + dx - 1, py, 3, 1, SG[4])
    for (const [lx, ly] of [
      [-6, 0],
      [5, 0],
    ])
      rect(ctx, x + dx + lx, py + ly, 1, 1, (t * 2 + dx) % 1 < 0.5 ? GLOW : CY[2])
  }
  // supply-ship landing ring on the front sub-tile
  for (let dy = -4; dy <= 4; dy++) {
    const w = Math.round(9 * Math.sqrt(Math.max(0, 1 - (dy / 4.5) ** 2)))
    rect(ctx, x - w, g + 8 + dy, 1, 1, SG[3])
    rect(ctx, x + w - 1, g + 8 + dy, 1, 1, SG[3])
  }
  rect(ctx, x - 1, g + 7, 2, 2, SG[4])
  // the lander, on its legs
  rocket(ctx, x - 16, g + 1, t)
  // armoured crew module
  const ct = hullTop(g + 1, 11, 11)
  hull(ctx, x + 16, ct, 11, 11, M, { seams: 4, roof: M })
  faceL(ctx, x + 16, ct, 11, 1, 10, 6, 5, armourPx(4))
  faceL(ctx, x + 16, ct, 11, 2, 7, 1, 3, cyanWindow(7, 3))
  faceR(ctx, x + 16, ct, 11, 1, 9, 5, 5, (c, r) => armourPx(4)(c, r).replace(R[3], R[1]).replace(M[2], M[1]))
  antennas(ctx, x + 16, ct + 4, t)
}

/* -------------------------- multi-tile buildings ------------------------- */

/** Habitat: two armoured end modules flanking a glowing glass atrium, antennas on the roof. */
export function bigHabitat(ctx: Ctx, x: number, y: number, t: number) {
  const g = plinth(ctx, x, y, 2, 2, 6)
  // back machinery block
  const bt = hullTop(g - 8, 8, 7)
  hull(ctx, x, bt, 8, 7, M, { seams: 4, roof: MH })
  faceR(ctx, x, bt, 8, 1, 6, 2, 3, ventPx)
  // armoured end modules, right then left
  for (const sx of [14, -14]) {
    const top = hullTop(g + 1, 12, 13)
    hull(ctx, x + sx, top, 12, 13, M, { seams: 4, roof: M })
    faceL(ctx, x + sx, top, 12, 0, 12, 1, 12, armourPx(4))
    faceR(ctx, x + sx, top, 12, 0, 12, 1, 12, (c, r) => (r % 4 === 0 ? INK : Math.floor(r / 4) % 2 ? M[1] : R[1]))
    faceL(ctx, x + sx, top, 12, 3, 6, 2, 2, cyanWindow(6, 2))
  }
  // glass atrium in front, lit from within
  const at = hullTop(g + 7, 13, 14)
  hull(ctx, x, at, 13, 14, M, { roof: M })
  const atrium = (side: 'l' | 'r') => (c: number, r: number) => {
    if (r === 0 || r === 13 || c % 4 === 0) return INK
    if (r > 9) return r === 10 ? M[3] : M[1] // desks and floor
    if (r === 9 && c % 5 === 2) return GLOW // screens
    if (r > 6 && c % 7 === 3) return RAMP.veg[side === 'l' ? 3 : 1] // potted plants
    if (r < 3 && (c + r) % 6 === 1) return GLOW // reflections
    return side === 'l' ? (r < 5 ? CY[4] : CY[3]) : r < 5 ? CY[2] : CY[1]
  }
  faceL(ctx, x, at, 13, 0, 13, 0, 14, atrium('l'))
  faceR(ctx, x, at, 13, 0, 13, 0, 14, atrium('r'))
  antennas(ctx, x - 2, at + 6, t)
}

/** Research lab: a windowed central tower with a roof fan, ringed by fan-cooled containers. */
export function bigLab(ctx: Ctx, x: number, y: number, t: number) {
  const g = plinth(ctx, x, y, 2, 2, 6)
  // back: olive tank and exhaust pipes
  cyl(ctx, x - 7, g - 6, 4, 18, OLIVE, M)
  stack(ctx, x + 5, g - 9, 22, 2)
  stack(ctx, x + 9, g - 7, 20, 2)
  // back container
  const bt = hullTop(g - 5, 9, 8)
  hull(ctx, x + 1, bt, 9, 8, R, { roof: R })
  fan(ctx, x - 3, bt + 9, 2, t)
  // left (sand) and right (rust) containers with fans
  for (const [sx, ramp] of [
    [-15, S],
    [15, R],
  ] as const) {
    const top = hullTop(g + 2, 10, 9)
    hull(ctx, x + sx, top, 10, 9, ramp, { roof: ramp, seams: 5 })
    fan(ctx, x + sx - 5, top + 10, 3, t * 1.2)
    faceR(ctx, x + sx, top, 10, 2, 6, 2, 2, cyanWindow(6, 2))
  }
  // central tower with windows and a roof fan
  cyl(ctx, x, g + 1, 8, 24, MH, M)
  band(ctx, x, g + 1, 8, 14, 4, (dx) => (dx % 4 === 0 ? INK : dx < 0 ? CY[4] : CY[2]))
  band(ctx, x, g + 1, 8, 4, 2, (dx) => (dx < 0 ? R[3] : R[1]))
  fan(ctx, x, g - 24, 4, t)
  antennas(ctx, x + 4, g - 26, t)
  // front container with vents
  const ft = hullTop(g + 10, 8, 6)
  hull(ctx, x, ft, 8, 6, S, { roof: S })
  faceL(ctx, x, ft, 8, 1, 6, 1, 4, ventPx)
}

/** Smelter: an armoured furnace hall with glowing mouths and a hazard-banded chimney. */
export function bigSmelter(ctx: Ctx, x: number, y: number, t: number) {
  const g = plinth(ctx, x, y, 2, 2, 6)
  cyl(ctx, x + 13, g - 7, 5, 30, M, M)
  band(ctx, x + 13, g - 7, 5, 22, 4, (dx) => ((dx + 9) % 4 < 2 ? INK : dx < 0 ? SG[4] : SG[2]))
  dome(ctx, x + 13, g - 37, 3, 1, 1, R, false)
  puffs(ctx, x + 12, g - 41, t, SMOKE)
  const hw = 19
  const h = 15
  const cx = x - 4
  const top = hullTop(g + 3, hw, h)
  hull(ctx, cx, top, hw, h, M, { seams: 5, rivets: true, roof: M })
  faceL(ctx, cx, top, hw, 0, hw, 11, 3, armourPx(3))
  faceR(ctx, cx, top, hw, 0, hw, 11, 3, (c, r) => (r === 0 ? INK : R[1]))
  faceR(ctx, cx, top, hw, 3, 5, 3, 3, cyanWindow(5, 3))
  faceR(ctx, cx, top, hw, 10, 7, 4, 3, stencilPx(0b1101110111))
  // furnace mouths glowing through the signal ramp, with sparks
  const flick = (t * 3) % 1 < 0.5 ? 0.08 : 0
  for (const c0 of [2, 10]) {
    faceL(ctx, cx, top, hw, c0, 6, 2, 8, INK)
    faceL(ctx, cx, top, hw, c0 + 1, 4, 3, 6, (c, r) => tone(SG, 1 - r * 0.14 + flick - (c === 0 ? 0.1 : 0), c, r))
    if (t > 0) faceL(ctx, cx, top, hw, c0 + 1 + (Math.floor(t * 7) % 4), 1, 3 + (Math.floor(t * 11) % 3), 1, '#ffffff')
  }
  // ore hopper and roof vent
  hull(ctx, cx - 6, top + 3, 7, 4, R, { roof: M })
  for (let k = 0; k < 5; k++) rect(ctx, cx - 9 + k * 2, top + 5 + (k & 1), 1, 1, k % 2 ? '#a3565f' : '#6e3640')
  hull(ctx, cx + 8, top + 6, 4, 3, MH)
  lamp(ctx, cx - hw + 1, top + (hw >> 1) - 1, (t * 1.5) % 1 < 0.5 ? SG[4] : SG[0], SG[1])
}

/** Sinter kiln: a rust-brick dome bound with steel hoops, a fire-lit mouth and a flue. */
export function bigKiln(ctx: Ctx, x: number, y: number, t: number) {
  const g = plinth(ctx, x, y, 2, 2, 6)
  stack(ctx, x + 10, g - 20, 14, 2)
  puffs(ctx, x + 10, g - 38, t, SMOKE)
  const oy = g - 7
  const rx = 20
  const ry = 17
  const rb = 6
  dome(ctx, x, oy, rx, ry, rb, R, false)
  for (let dy = -ry + 2; dy <= rb; dy++) {
    const k = dy <= 0 ? 1 - (dy / (ry + 0.5)) ** 2 : 1 - (dy / (rb + 0.5)) ** 2
    const w = Math.round(rx * Math.sqrt(Math.max(0, k)))
    if (w < 2) continue
    const hoop = dy === -10 || dy === -2
    if (hoop) {
      for (let j = x - w; j < x + w; j++) rect(ctx, j, oy + dy, 1, 1, j < x ? M[3] : M[1])
      for (let j = x - w; j < x + w; j++) rect(ctx, j, oy + dy + 1, 1, 1, M[0])
      continue
    }
    const course = Math.floor((dy + ry) / 3)
    if ((dy + ry) % 3 === 0) for (let j = x - w + 1; j < x + w - 1; j++) rect(ctx, j, oy + dy, 1, 1, j < x ? R[1] : R[0])
    else for (let j = x - w + 1 + (course % 2) * 2; j < x + w - 1; j += 4) rect(ctx, j, oy + dy, 1, 1, j < x ? R[1] : R[0])
  }
  // steel-framed mouth with a fire gradient and embers
  const flick = (t * 2) % 1 < 0.5 ? 0.08 : 0
  for (let r = 0; r < 11; r++) rect(ctx, x - 13, oy - 6 + r, 11, 1, r === 0 ? M[4] : M[2])
  for (let r = 0; r < 9; r++) for (let k = -4; k < 4; k++) rect(ctx, x - 8 + k, oy - 5 + r, 1, 1, r < 2 ? INK : tone(SG, 0.4 + r * 0.08 + flick, x + k, r))
  if (t > 0) for (let k = 0; k < 3; k++) rect(ctx, x - 10 + ((Math.floor(t * 9) + k * 3) % 7), oy + 1 + k, 1, 1, '#fff3c4')
  // finished bricks stacked by the mouth
  for (let k = 0; k < 4; k++) {
    const bx = x + 7 + (k % 2) * 4
    const by = g + 6 - Math.floor(k / 2) * 2
    rect(ctx, bx, by, 4, 1, R[4])
    rect(ctx, bx, by + 1, 4, 1, R[2])
    rect(ctx, bx + 3, by, 1, 2, R[0])
  }
}

/** Soil washer: a process block between two glowing water tanks, all piped together. */
export function bigWasher(ctx: Ctx, x: number, y: number, t: number) {
  const g = plinth(ctx, x, y, 2, 2, 6)
  // central process block (drawn after the back tank, before the front one)
  const tanks: [number, number][] = [
    [16, -1],
    [-16, -1],
  ]
  for (const [sx] of tanks.slice(0, 1)) {
    cyl(ctx, x + sx, g + 1, 6, 22, M, MH)
    glowStrip(ctx, x + sx - 3, g - 3, 15, 0.8)
  }
  const top = hullTop(g + 4, 13, 16)
  hull(ctx, x, top, 13, 16, M, { seams: 4, rivets: true, roof: M })
  faceL(ctx, x, top, 13, 0, 13, 10, 5, armourPx(5))
  faceR(ctx, x, top, 13, 0, 13, 10, 5, (c, r) => (r === 0 ? INK : R[1]))
  faceL(ctx, x, top, 13, 3, 6, 2, 4, cyanWindow(6, 4))
  faceR(ctx, x, top, 13, 2, 8, 3, 4, ventPx)
  // wash drum turning in a roof frame
  const dy = top + 6
  dome(ctx, x, dy, 6, 3, 3, MH, false)
  dome(ctx, x, dy - 1, 4, 2, 1, M, false)
  for (let k = 0; k < 3; k++) {
    const a = t * 6 + k * 2.1
    rect(ctx, x + Math.round(Math.cos(a) * 3), dy - 1 + Math.round(Math.sin(a)), 1, 1, k ? CY[4] : GLOW)
  }
  for (const [sx] of tanks.slice(1)) {
    cyl(ctx, x + sx, g + 1, 6, 22, M, MH)
    glowStrip(ctx, x + sx + 1, g - 3, 15, 0.8)
  }
  // pipework with valve wheels between tanks and block
  for (const [x0, x1, py] of [
    [x - 10, x - 6, g - 14],
    [x + 10, x + 6, g - 12],
    [x - 10, x - 6, g - 6],
  ]) {
    pipe(ctx, x0, py, x1, py, MH)
    rect(ctx, Math.round((x0 + x1) / 2), py - 2, 2, 2, RAMP.alert[1])
  }
}

/** Kilopower reactor: a stepped armoured bunker with a vault and a radiation billboard. */
export function bigReactor(ctx: Ctx, x: number, y: number, t: number) {
  const g = plinth(ctx, x, y, 2, 2, 6)
  // tier 1: armoured base with the vault
  const t1 = hullTop(g + 2, 25, 8)
  hull(ctx, x, t1, 25, 8, M, { seams: 5, roof: R })
  faceL(ctx, x, t1, 25, 0, 25, 1, 7, armourPx(3))
  faceR(ctx, x, t1, 25, 0, 25, 1, 7, (c, r) => (r % 3 === 0 ? INK : Math.floor(r / 3) % 2 ? M[1] : R[1]))
  // tier 2
  const t2 = hullTop(t1 + 12, 18, 8)
  hull(ctx, x, t2, 18, 8, R, { seams: 6, roof: M })
  faceL(ctx, x, t2, 18, 0, 18, 6, 2, hazardPx)
  // capped dome
  dome(ctx, x, t2 + 6, 10, 8, 2, M)
  dome(ctx, x, t2 - 1, 3, 2, 1, MH)
  // vault on the lit face, its seal glowing cyan
  faceL(ctx, x, t1, 25, 9, 9, 1, 7, (c, r) => (c === 0 || c === 8 || r === 0 || r === 6 ? M[4] : c === 4 && r > 1 && r < 5 ? GLOW : (c + r) % 2 ? M[2] : M[1]))
  // equipment box with a fan, left
  const et = hullTop(g + 5, 6, 7)
  hull(ctx, x - 20, et, 6, 7, MH, { roof: M })
  fan(ctx, x - 22, et + 7, 2, t)
  // radiation billboard on legs
  signboard(ctx, x, t2 - 22, 17, 10, t2 + 2, trefoil(17, 10))
  lamp(ctx, x + 9, t2 - 23, (t * 1.5) % 1 < 0.4 ? SG[4] : SG[0], SG[1])
}

/**
 * Greenhouse (3×2): a geodesic vault — a triangulated steel lattice with rust
 * joints over translucent cyan glass — on a plinth with a glowing trim ring,
 * with planting beds and crop rows inside. Solids and glass use separate depth
 * buffers; glass in front tints whatever is behind it.
 */
export function bigGreenhouse(ctx: Ctx, x: number, y: number, t: number, dim: boolean) {
  const g = plinth(ctx, x, y, 3, 2, 5, RAMP.cyan)
  const L = 1.5 - 0.12
  const RR = 1 - 0.14
  const Z = 22
  const bx0 = x - 48
  const by0 = g - 48
  const bw = 96
  const bh = 72
  const zb = new Float32Array(bw * bh).fill(-1e9)
  const col: (string | null)[] = new Array(bw * bh).fill(null)
  const gz = new Float32Array(bw * bh).fill(-1e9)
  const gcol: (string | null)[] = new Array(bw * bh).fill(null)
  const plot = (u: number, v: number, z: number, c: string | ((px: number, py: number) => string), glass = false) => {
    const px = Math.round(x + (u - v) * 16)
    const py = Math.round(g + (u + v) * 8 - z)
    if (px < bx0 || py < by0 || px >= bx0 + bw || py >= by0 + bh) return
    const k = (py - by0) * bw + (px - bx0)
    const d = u + v + z * 0.001
    const zbuf = glass ? gz : zb
    if (d >= zbuf[k]) {
      zbuf[k] = d
      ;(glass ? gcol : col)[k] = typeof c === 'string' ? c : c(px, py)
    }
  }
  const leaf: Ramp = dim ? ['#3d3420', '#5e5028', '#8a7638', '#b09a4c', '#cfbb6c'] : RAMP.veg
  // planting beds in steel troughs, either side of a centre walkway
  for (let u = -L; u <= L; u += 1 / 24)
    for (let v = -0.72; v <= 0.72; v += 1 / 24) {
      const trough = Math.abs(Math.abs(v) - 0.45) > 0.24
      plot(u, v, 0, Math.abs(v) < 0.16 ? (px, py) => tone(M, 0.6, px, py) : trough ? M[2] : (px, py) => tone(SOIL, 0.55, px, py))
    }
  for (let u = -L + 0.12; u <= L - 0.1; u += 0.125)
    for (const row of [-0.45, 0.45]) {
      const seed = Math.sin(u * 37 + row * 11)
      const hgt = (dim ? 2 : 4) + Math.floor(((seed + 1) / 2) * 3)
      for (let z = 1; z <= hgt; z++)
        for (let dv = -0.15; dv <= 0.15; dv += 1 / 24) {
          const fruit = !dim && z === hgt - 1 && seed > 0.55 && Math.abs(dv) < 0.05
          plot(u, row + dv, z, fruit ? RAMP.alert[2] : (px, py) => tone(leaf, 0.25 + (z / hgt) * 0.6 + (row > 0 ? 0.1 : 0), px, py))
        }
    }
  if (!dim)
    for (let u = -L + 0.2; u <= L - 0.1; u += 0.33) {
      const on = (t * 2 + u) % 1 < 0.75
      plot(u, -0.05, Z - 4, on ? RAMP.alert[4] : RAMP.alert[2])
      plot(u + 0.06, 0.08, Z - 4, on ? GLOW : CY[2])
    }
  // geodesic lattice over the vault
  const ROWS = 5
  for (let u = -L; u <= L; u += 1 / 48)
    for (let a = 0; a <= Math.PI; a += Math.PI / 96) {
      const v = RR * Math.cos(a)
      const z = Z * Math.sin(a)
      const s = (u + L) / 0.5
      const q = (a / Math.PI) * ROWS
      const fq = q - Math.round(q)
      const d1 = s + q / 2
      const d2 = s - q / 2
      const f1 = d1 - Math.round(d1)
      const f2 = d2 - Math.round(d2)
      const lat = Math.abs(fq) < 0.07
      const diag = Math.abs(f1) < 0.045 || Math.abs(f2) < 0.045
      const node = lat && (Math.abs(f1) < 0.09 || Math.abs(f2) < 0.09)
      const lit = 0.5 + 0.45 * Math.cos(a - 0.7)
      if (node) plot(u, v, z, lit > 0.6 ? R[4] : R[2])
      else if (lat || diag || a < 0.04 || a > Math.PI - 0.04) plot(u, v, z, (px, py) => tone(M, 0.25 + lit * 0.5, px, py))
      else plot(u, v, z, (px, py) => tone(dim ? RAMP.neutral : CY, 0.35 + lit * 0.6, px, py), true)
    }
  // end walls: lattice and glass, with an airlock frame on the front end
  for (const end of [-L, L])
    for (let v = -RR; v <= RR; v += 1 / 48) {
      const top = Z * Math.sqrt(Math.max(0, 1 - (v / RR) ** 2))
      for (let z = 0; z <= top; z += 0.5) {
        const edge = top - z < 1.2
        const lock = end > 0 && Math.abs(v) < 0.22 && z < 12
        if (lock) plot(end, v, z, z > 11 || Math.abs(Math.abs(v) - 0.21) < 0.02 ? M[4] : z < 2 ? R[3] : M[1])
        else if (edge || Math.abs(v) < 0.02 || Math.abs(z - top / 2) < 0.5) plot(end, v, z, M[2])
        else plot(end, v, z, (px, py) => tone(dim ? RAMP.neutral : CY, 0.55, px, py), true)
      }
    }
  const rgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
  for (let k = 0; k < col.length; k++) {
    const px = bx0 + (k % bw)
    const py = by0 + Math.floor(k / bw)
    const c = col[k]
    const gc = gcol[k]
    if (gc && gz[k] >= zb[k]) {
      const [gr, gg, gb] = rgb(gc)
      if (c) {
        const [r, gn, b] = rgb(c)
        const a = 0.34
        ctx.fillStyle = `rgb(${Math.round(r + (gr - r) * a)},${Math.round(gn + (gg - gn) * a)},${Math.round(b + (gb - b) * a)})`
      } else ctx.fillStyle = `rgba(${gr},${gg},${gb},0.55)`
      ctx.fillRect(px, py, 1, 1)
    } else if (c) rect(ctx, px, py, 1, 1, c)
  }
}
