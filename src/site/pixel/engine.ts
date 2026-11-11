/**
 * RENOVA pixel engine — renders the isometric Mars mesa colony with crisp
 * fillRect pixel art at a low native resolution (scaled up with
 * `image-rendering: pixelated`). Shared by the website and the game entry.
 */
export type Ctx = CanvasRenderingContext2D

export const C = {
  w0: '#f7f2ea',
  w1: '#ddd4c7',
  w2: '#b3a99c',
  w3: '#82786e',
  ink: '#141c2b',
  ink2: '#26344a',
  orange: '#e8753b',
  orange2: '#ffb070',
  win: '#ffd48a',
  glassT: '#ead3f2',
  glassL: '#bf93d8',
  glassR: '#946bb6',
  leaf0: '#a6dc72',
  leaf1: '#62ad4b',
  leaf2: '#3f7f3d',
  dry1: '#c8b05a',
  dry2: '#9c8540',
  pv0: '#4068bd',
  pv1: '#2c4c98',
  pv2: '#1d3272',
  pvHi: '#b4cbff',
  water: '#58b0ea',
  red: '#ff5a4f',
  green: '#7ee07a',
  sand: ['#e3a474', '#dd9d6c', '#e8ac7c'],
  sandHi: '#f2c194',
  sandLo: '#c5845b',
  road: '#c98c63',
  roadLo: '#ac7350',
  pad: '#aa9c8f',
  padLo: '#8d8075',
  padHi: '#c4b7a9',
  rock: '#cf8b5f',
  fL: ['#bb6342', '#ab573b', '#c46d48'],
  fR: ['#8c4431', '#7b3b2c', '#954a35'],
  rimL: '#de9266',
  rimR: '#ab5a3e',
  deep: '#5b2b25',
  reg: ['#d99862', '#c07c50', '#9f613f'],
}

export function hash(a: number, b: number, s = 0) {
  let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1442695041)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)
const easeOut = (k: number) => 1 - (1 - k) ** 3

export function rect(ctx: Ctx, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c
  ctx.fillRect(x, y, w, h)
}

/** 2:1 pixel diamond. hw = half width (even); its height equals hw. */
export function diamond(ctx: Ctx, cx: number, top: number, hw: number, c: string) {
  ctx.fillStyle = c
  const half = hw >> 1
  for (let r = 0; r < hw; r++) {
    const w = r < half ? (r + 1) * 2 : (hw - r) * 2
    ctx.fillRect(cx - w, top + r, w * 2, 1)
  }
}

export function diamondOutline(ctx: Ctx, cx: number, top: number, hw: number, c: string) {
  ctx.fillStyle = c
  const half = hw >> 1
  for (let r = 0; r < hw; r++) {
    const w = r < half ? (r + 1) * 2 : (hw - r) * 2
    ctx.fillRect(cx - w, top + r, 2, 1)
    ctx.fillRect(cx + w - 2, top + r, 2, 1)
  }
}

/** Isometric box: top diamond plus lit left face and shaded right face. */
export function box(ctx: Ctx, cx: number, top: number, hw: number, h: number, cTop: string, cL: string, cR: string, rim = true) {
  for (let c = 0; c < hw; c++) {
    rect(ctx, cx - hw + c, top + (hw >> 1) + (c >> 1), 1, h + 1, cL)
    rect(ctx, cx + c, top + hw - 1 - (c >> 1), 1, h + 1, cR)
  }
  diamond(ctx, cx, top, hw, cTop)
  if (rim && h > 1) {
    for (let c = 0; c < hw; c++) {
      rect(ctx, cx - hw + c, top + (hw >> 1) + (c >> 1) + 1, 1, 1, cTop)
      rect(ctx, cx + c, top + hw - (c >> 1), 1, 1, shade(cTop))
    }
  }
}

const SHADE: Record<string, string> = {}
function shade(hex: string) {
  if (SHADE[hex]) return SHADE[hex]
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.round(v * 0.86)
  const out = `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`
  SHADE[hex] = out
  return out
}

export function ellipseRows(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, c: string) {
  ctx.fillStyle = c
  for (let dy = -Math.floor(ry); dy <= Math.floor(ry); dy++) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + 0.5)) ** 2)))
    if (w > 0) ctx.fillRect(cx - w, cy + dy, w * 2, 1)
  }
}

export function cylinder(ctx: Ctx, x: number, base: number, rx: number, h: number, l: string, m: string, d: string, top: string) {
  const ry = rx / 2
  for (let dx = -rx; dx < rx; dx++) {
    const e = Math.sqrt(Math.max(0, 1 - ((dx + 0.5) / rx) ** 2)) * ry
    const y0 = Math.round(base - h - e)
    const y1 = Math.round(base + e)
    rect(ctx, x + dx, y0, 1, y1 - y0, dx < -rx * 0.35 ? l : dx < rx * 0.3 ? m : d)
  }
  ellipseRows(ctx, x, base - h, rx, ry, top)
}

export function dome(ctx: Ctx, x: number, oy: number, rx: number, ry: number, rb: number, pal: [string, string, string]) {
  for (let dy = -ry; dy <= rb; dy++) {
    const k = dy <= 0 ? 1 - (dy / (ry + 0.5)) ** 2 : 1 - (dy / (rb + 0.5)) ** 2
    const hw = Math.round(rx * Math.sqrt(Math.max(0, k)))
    if (hw <= 0) continue
    const a = Math.round(-hw * 0.3)
    const b = Math.round(hw * 0.45)
    rect(ctx, x - hw, oy + dy, a + hw, 1, pal[0])
    rect(ctx, x + a, oy + dy, b - a, 1, pal[1])
    rect(ctx, x + b, oy + dy, hw - b, 1, pal[2])
  }
}

/* ------------------------------------------------------------------ */
/* Structures. (x, y) is the centre of the tile's top diamond.         */
/* ------------------------------------------------------------------ */

export type ObjKind = 'hab' | 'gh' | 'pv' | 'drill' | 'tank' | 'wrs' | 'shield' | 'rocket' | 'dish' | 'boulder'

export type Obj = {
  k: ObjKind
  i: number
  j: number
  born?: number
  dim?: boolean
  level?: number
  levelFrom?: number
  levelAt?: number
  alert?: boolean
}

function hab(ctx: Ctx, x: number, y: number) {
  box(ctx, x, y - 10, 14, 3, C.w1, C.w2, C.w3, false)
  const oy = y - 4
  dome(ctx, x, oy, 12, 14, 6, [C.w0, C.w1, C.w2])
  rect(ctx, x - 7, oy - 10, 3, 1, '#ffffff')
  rect(ctx, x - 8, oy - 9, 2, 2, '#ffffff')
  for (let wx = -9; wx <= 7; wx += 4) rect(ctx, x + wx, oy - 5, 2, 2, wx > 2 ? '#e0b46e' : C.win)
  rect(ctx, x - 12, oy - 1, 24, 1, C.orange)
  rect(ctx, x - 8, oy + 1, 4, 4, C.ink2)
  rect(ctx, x - 8, oy + 1, 4, 1, C.orange)
}

function gh(ctx: Ctx, x: number, y: number, dim?: boolean) {
  const hw = 14
  const h = 9
  const top = y - 7 - h
  const gT = dim ? '#c1abc9' : C.glassT
  const gL = dim ? '#94779f' : C.glassL
  const gR = dim ? '#735c84' : C.glassR
  box(ctx, x, top, hw, h, gT, gL, gR, false)
  const leaf = dim ? C.dry1 : C.leaf1
  const leafB = dim ? C.dry2 : C.leaf2
  for (let c = 0; c < hw; c++) {
    const yl = top + (hw >> 1) + (c >> 1) + 1
    const yr = top + hw - (c >> 1)
    if (c % 4 === 0) {
      rect(ctx, x - hw + c, yl, 1, h, C.w0)
      rect(ctx, x + c, yr, 1, h, C.w1)
      continue
    }
    for (let d = 4; d < h - 1; d++) {
      if (hash(c, d, 11) > 0.42) rect(ctx, x - hw + c, yl + d, 1, 1, d > 5 ? leafB : leaf)
      if (hash(c, d, 12) > 0.42) rect(ctx, x + c, yr + d, 1, 1, leafB)
    }
    rect(ctx, x - hw + c, yl + h - 1, 1, 1, C.w2)
    rect(ctx, x + c, yr + h - 1, 1, 1, C.w3)
  }
  for (let k = 0; k < 14; k++) rect(ctx, x - 7 + k, top + 3 + (k >> 1), 1, 1, C.w0)
  for (let k = 0; k < 8; k++) if (hash(k, 3, 7) > 0.3) rect(ctx, x - 6 + k * 2, top + 6 + (k & 1), 1, 1, dim ? C.dry1 : C.leaf0)
  diamondOutline(ctx, x, top, hw, C.w0)
}

function pv(ctx: Ctx, x: number, y: number, t: number) {
  const subs: [number, number][] = [
    [0, -4],
    [-8, 0],
    [8, 0],
    [0, 4],
  ]
  subs.forEach(([dx, dy], n) => {
    const px = x + dx
    const py = y + dy
    rect(ctx, px, py - 3, 1, 3, C.w3)
    const top = py - 9
    box(ctx, px, top, 6, 1, C.pv0, C.pv2, C.pv2, false)
    rect(ctx, px - 4, top + 3, 8, 1, C.pv1)
    rect(ctx, px - 1, top + 1, 1, 4, C.pv1)
    diamondOutline(ctx, px, top, 6, '#6f8fd8')
    if ((t * 0.9 + n * 0.29) % 2.4 < 0.18) rect(ctx, px - 3, top + 2, 2, 1, C.pvHi)
  })
}

function drill(ctx: Ctx, x: number, y: number, t: number) {
  box(ctx, x - 4, y - 7, 10, 4, C.w1, C.w2, C.w3)
  rect(ctx, x - 9, y - 3, 3, 2, C.ink2)
  const bx = x + 4
  const by = y - 1
  const H = 22
  rect(ctx, bx, by - H + 2, 1, H - 1, C.ink2)
  for (let k = 0; k < H; k++) {
    const inset = Math.floor((k * 4) / H)
    rect(ctx, bx - 5 + inset, by - k, 1, 1, C.w2)
    rect(ctx, bx + 4 - inset, by - k, 1, 1, C.w3)
    if (k % 5 === 2) rect(ctx, bx - 4 + inset, by - k, 8 - inset * 2, 1, C.w2)
  }
  rect(ctx, bx - 2, by - H - 1, 5, 2, C.orange)
  if ((t * 2) % 1 < 0.5) rect(ctx, bx, by - H - 3, 1, 2, C.orange2)
  rect(ctx, x + 9, y + 1, 5, 1, C.water)
}

function tank(ctx: Ctx, x: number, y: number, t: number, level = 0.8, alert = false) {
  const base = y + 1
  cylinder(ctx, x, base, 9, 15, C.w0, C.w1, C.w2, C.w0)
  for (let dx = -9; dx < 9; dx++) {
    const e = Math.sqrt(Math.max(0, 1 - ((dx + 0.5) / 9) ** 2)) * 4.5
    rect(ctx, x + dx, Math.round(base - 12 + e), 1, 1, C.orange)
  }
  const gy = base - 10
  rect(ctx, x - 2, gy, 4, 11, C.ink)
  const lv = Math.max(1, Math.round(9 * level))
  rect(ctx, x - 1, gy + 1 + (9 - lv), 2, lv, level < 0.25 ? C.red : C.water)
  ellipseRows(ctx, x, base - 15, 4, 1.5, C.w1)
  if (alert && (t * 2.5) % 1 < 0.5) rect(ctx, x - 1, base - 19, 2, 2, C.red)
}

function wrs(ctx: Ctx, x: number, y: number, t: number) {
  const top = y - 14
  box(ctx, x, top, 12, 8, C.w0, C.w1, C.w2)
  for (let c = 2; c < 12; c += 2) {
    const yl = top + 6 + (c >> 1) + 1
    rect(ctx, x - 12 + c, yl + 2, 1, 1, C.w3)
    rect(ctx, x - 12 + c, yl + 4, 1, 1, C.w3)
  }
  rect(ctx, x + 4, top + 12, 2, 2, t % 1 < 0.6 ? C.green : C.leaf2)
  diamond(ctx, x, top + 3, 6, C.w2)
  const a = Math.floor(t * 8) % 2
  rect(ctx, x - 4 + a * 2, top + 5 + a, 8 - a * 4, 1, C.ink2)
  rect(ctx, x - 1, top + 3 + a, 2, 5 - a * 2, C.ink2)
  rect(ctx, x + 11, y - 3, 4, 1, C.water)
}

function shield(ctx: Ctx, x: number, y: number) {
  const oy = y - 1
  dome(ctx, x, oy, 14, 10, 7, [C.reg[0], C.reg[1], C.reg[2]])
  for (let row = -8; row <= 2; row += 3) {
    const w = Math.round(14 * Math.sqrt(Math.max(0, 1 - (row / 10.5) ** 2)))
    for (let k = -w + 1; k < w - 1; k += 4) rect(ctx, x + k, oy + row, 3, 1, k < 0 ? '#c78855' : '#8f5537')
  }
  rect(ctx, x - 10, oy - 3, 6, 7, C.ink)
  rect(ctx, x - 11, oy - 4, 8, 1, C.orange)
  rect(ctx, x - 11, oy - 4, 1, 8, C.orange)
  rect(ctx, x + 5, oy - 6, 1, 1, '#ffd27a')
  rect(ctx, x + 3, oy - 4, 1, 1, '#ffd27a')
  rect(ctx, x + 7, oy - 4, 1, 1, '#ffd27a')
}

function rocket(ctx: Ctx, x: number, y: number, t: number) {
  const base = y - 1
  for (let k = 0; k < 6; k++) {
    rect(ctx, x - 6 - (k >> 1), base - 6 + k, 1, 1, C.w3)
    rect(ctx, x + 5 + (k >> 1), base - 6 + k, 1, 1, C.w3)
  }
  cylinder(ctx, x, base - 2, 5, 30, C.w0, C.w1, C.w2, C.w1)
  for (let k = 0; k < 9; k++) {
    const w = Math.max(1, Math.round(5 * (1 - k / 9)))
    const yy = base - 34 - k
    rect(ctx, x - w, yy, w, 1, C.w0)
    rect(ctx, x, yy, w, 1, C.w2)
  }
  rect(ctx, x - 5, base - 12, 10, 2, C.orange)
  rect(ctx, x - 5, base - 27, 10, 1, C.orange)
  rect(ctx, x - 2, base - 22, 2, 2, C.ink2)
  rect(ctx, x - 2, base - 22, 1, 1, '#8fc0e8')
  rect(ctx, x - 7, base - 9, 2, 7, C.ink2)
  rect(ctx, x + 5, base - 9, 2, 7, C.ink2)
  if ((t * 1.2) % 1 < 0.3) rect(ctx, x, base - 43, 1, 1, C.red)
}

function dish(ctx: Ctx, x: number, y: number, t: number) {
  rect(ctx, x - 2, y - 1, 5, 2, C.w2)
  rect(ctx, x, y - 12, 1, 12, C.w3)
  const cx = x - 2
  const cy = y - 16
  for (let dy = -6; dy <= 6; dy++) {
    const w = Math.round(4.5 * Math.sqrt(Math.max(0, 1 - (dy / 6.5) ** 2)))
    rect(ctx, cx - w, cy + dy, w * 2, 1, dy < 0 ? C.w0 : C.w1)
  }
  for (let dy = -4; dy <= 4; dy++) {
    const w = Math.round(2.6 * Math.sqrt(Math.max(0, 1 - (dy / 4.5) ** 2)))
    rect(ctx, cx - w + 1, cy + dy, w * 2 - 1, 1, C.w2)
  }
  rect(ctx, cx + 3, cy - 1, 5, 1, C.w3)
  rect(ctx, cx + 8, cy - 2, 1, 3, C.ink2)
  if ((t * 1.5) % 1 < 0.35) rect(ctx, x, y - 13, 1, 1, C.red)
}

function boulder(ctx: Ctx, x: number, y: number) {
  box(ctx, x - 3, y - 5, 6, 4, C.rock, '#a85f40', '#7f4532')
  box(ctx, x + 5, y - 1, 4, 2, C.rock, '#a85f40', '#7f4532')
  rect(ctx, x - 7, y + 3, 2, 1, '#9b5a3c')
}

export function drawObject(ctx: Ctx, o: Pick<Obj, 'k' | 'dim' | 'level' | 'alert'>, x: number, y: number, t: number) {
  switch (o.k) {
    case 'hab':
      return hab(ctx, x, y)
    case 'gh':
      return gh(ctx, x, y, o.dim)
    case 'pv':
      return pv(ctx, x, y, t)
    case 'drill':
      return drill(ctx, x, y, t)
    case 'tank':
      return tank(ctx, x, y, t, o.level, o.alert)
    case 'wrs':
      return wrs(ctx, x, y, t)
    case 'shield':
      return shield(ctx, x, y)
    case 'rocket':
      return rocket(ctx, x, y, t)
    case 'dish':
      return dish(ctx, x, y, t)
    case 'boulder':
      return boulder(ctx, x, y)
  }
}

export function rover(ctx: Ctx, x: number, y: number, flip: boolean) {
  box(ctx, x, y - 8, 6, 3, C.w0, C.w1, C.w2, false)
  diamond(ctx, x, y - 8, 6, C.pv1)
  rect(ctx, x - 6, y - 2, 2, 2, C.ink)
  rect(ctx, x + 4, y - 2, 2, 2, C.ink)
  rect(ctx, x - 1, y + 1, 2, 2, C.ink)
  const mx = flip ? x - 3 : x + 3
  rect(ctx, mx, y - 13, 1, 6, C.w2)
  rect(ctx, mx - 1, y - 14, 3, 2, C.w0)
  rect(ctx, x - 1, y - 6, 3, 1, C.orange)
}

export function walker(ctx: Ctx, x: number, y: number, t: number, seed: number) {
  const step = Math.floor(t * 5 + seed) % 2
  rect(ctx, x - 1, y - 8, 3, 3, C.w0)
  rect(ctx, x, y - 7, 2, 1, '#e7a94a')
  rect(ctx, x - 1, y - 5, 3, 3, C.w1)
  rect(ctx, x - 2, y - 5, 1, 2, C.orange)
  rect(ctx, x - 1 + step, y - 2, 1, 2, C.w2)
  rect(ctx, x + 1 - step, y - 2, 1, 2, C.w2)
}

/* ------------------------------------------------------------------ */
/* Terrain + scene                                                     */
/* ------------------------------------------------------------------ */

export type CellType = 'sand' | 'road' | 'pad' | 'crater'
export type Cell = { e: number; t: CellType }
export type Terrain = { cols: number; rows: number; cells: (Cell | null)[] }
export type Path = { pts: [number, number][]; speed: number; kind: 'rover' | 'walker'; offset?: number }
export type Scene = { terrain: Terrain; objs: Obj[]; paths?: Path[] }

export type View = { W: number; H: number; ox: number; oy: number; E: number; horizon: number }

export const cellAt = (T: Terrain, i: number, j: number) =>
  i < 0 || j < 0 || i >= T.cols || j >= T.rows ? null : T.cells[j * T.cols + i]

export function makeView(W: number, H: number, T: Terrain, ax: number, ay: number, E: number, horizon: number): View {
  const cc = (T.cols - 1) / 2
  const rc = (T.rows - 1) / 2
  const ox = Math.round(W * ax - (cc - rc) * 16)
  const oy = Math.round(H * ay - (cc + rc) * 8 - 8 + E)
  return { W, H, ox, oy, E, horizon: Math.round(horizon) }
}

export const tileXY = (v: View, i: number, j: number, e: number) => [v.ox + (i - j) * 16, v.oy + (i + j) * 8 - v.E - e] as const

function threshold(T: Terrain, i: number, j: number) {
  const cc = (T.cols - 1) / 2
  const rc = (T.rows - 1) / 2
  return 0.02 + 0.5 * (Math.hypot(i - cc, j - rc) / Math.hypot(cc, rc)) + 0.2 * hash(i, j, 5)
}

export function cliffColumn(ctx: Ctx, x: number, y: number, h: number, left: boolean, e: number, jit: number) {
  const pal = left ? C.fL : C.fR
  let start = 1
  let col = left ? C.rimL : C.rimR
  for (let d = 2; d <= h + 1; d++) {
    let c = ''
    if (d <= h) c = d >= h - 2 ? C.deep : pal[Math.floor((d - e + jit + 64) / 5) % 3]
    if (c !== col) {
      ctx.fillStyle = col
      ctx.fillRect(x, y + start, 1, d - start)
      start = d
      col = c
    }
  }
}

export function speckle(ctx: Ctx, sx: number, sy: number, i: number, j: number, n: number, hi: string, lo: string) {
  for (let k = 0; k < n; k++) {
    const rx = Math.floor(hash(i, j, k * 3 + 1) * 28) - 14
    const ry = Math.floor(hash(i, j, k * 3 + 2) * 14) + 1
    if (Math.abs(rx) / 16 + Math.abs(ry - 8) / 8 > 0.8) continue
    rect(ctx, sx + rx, sy + ry, hash(i, j, k) > 0.7 ? 2 : 1, 1, hash(j, i, k) > 0.5 ? hi : lo)
  }
}

function drawCell(ctx: Ctx, v: View, T: Terrain, i: number, j: number, cell: Cell, dy: number, showL: boolean, showR: boolean) {
  const [sx, sy0] = tileXY(v, i, j, cell.e)
  const sy = sy0 + dy
  const h = v.E + cell.e - dy
  if (showL || showR) {
    const jit = Math.floor(hash(i, j, 3) * 3)
    for (let c = 0; c < 16; c++) {
      if (showL) cliffColumn(ctx, sx - 16 + c, sy + 8 + (c >> 1), h, true, cell.e, jit + ((c * 7 + i) % 3 === 0 ? 1 : 0))
      if (showR) cliffColumn(ctx, sx + c, sy + 15 - (c >> 1), h, false, cell.e, jit + ((c * 5 + j) % 3 === 0 ? 1 : 0))
    }
  }
  const cy = sy + 8
  if (cell.t === 'pad') {
    diamond(ctx, sx, sy, 16, C.pad)
    diamondOutline(ctx, sx, sy + 2, 12, C.padHi)
    diamondOutline(ctx, sx, sy + 4, 8, C.orange)
    rect(ctx, sx - 2, cy - 1, 4, 2, C.padLo)
    return
  }
  const base = cell.e > 0 ? C.rock : C.sand[Math.floor(hash(i, j, 1) * 3)]
  diamond(ctx, sx, sy, 16, cell.t === 'road' ? C.road : base)
  if (cell.t === 'road') {
    const alongI = cellAt(T, i - 1, j)?.t === 'road' || cellAt(T, i + 1, j)?.t === 'road'
    const alongJ = cellAt(T, i, j - 1)?.t === 'road' || cellAt(T, i, j + 1)?.t === 'road'
    for (let k = -12; k <= 12; k++) {
      for (const off of [-3, 2]) {
        if (alongI) {
          const yy = cy + Math.floor(k / 2) + off
          if (Math.abs(k) / 16 + Math.abs(yy - cy) / 8 < 0.92) rect(ctx, sx + k, yy, 1, 1, C.roadLo)
        }
        if (alongJ) {
          const yy = cy - Math.floor(k / 2) + off
          if (Math.abs(k) / 16 + Math.abs(yy - cy) / 8 < 0.92) rect(ctx, sx + k, yy, 1, 1, C.roadLo)
        }
      }
    }
    return
  }
  speckle(ctx, sx, sy, i, j, cell.e > 0 ? 9 : 6, C.sandHi, cell.e > 0 ? '#a9674a' : C.sandLo)
  if (cell.t === 'crater') {
    ellipseRows(ctx, sx, cy, 9, 4, C.sandLo)
    ellipseRows(ctx, sx + 1, cy + 1, 6, 2, '#b06f4a')
    for (let k = -6; k <= 6; k++) rect(ctx, sx + k, cy + 4 + (Math.abs(k) > 4 ? -1 : 0), 1, 1, C.sandHi)
  }
}

export type RenderOpts = {
  t: number
  now: number
  reveal: number
  hover?: [number, number] | null
  ghost?: ObjKind | null
  ghostOk?: boolean
}

function pathPoint(p: Path, t: number) {
  const pts = p.pts
  const seg: number[] = []
  let total = 0
  for (let k = 0; k < pts.length - 1; k++) {
    const d = Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1])
    seg.push(d)
    total += d
  }
  // ping-pong along the polyline
  let s = (t * p.speed + (p.offset ?? 0)) % (total * 2)
  const back = s > total
  if (back) s = total * 2 - s
  for (let k = 0; k < seg.length; k++) {
    if (s <= seg[k] || k === seg.length - 1) {
      const f = seg[k] ? Math.min(1, s / seg[k]) : 0
      const a = pts[k]
      const b = pts[k + 1]
      return { i: a[0] + (b[0] - a[0]) * f, j: a[1] + (b[1] - a[1]) * f, back, di: b[0] - a[0], dj: b[1] - a[1] }
    }
    s -= seg[k]
  }
  return { i: pts[0][0], j: pts[0][1], back, di: 1, dj: 0 }
}

export function renderScene(ctx: Ctx, v: View, scene: Scene, backdrop: HTMLCanvasElement | null, o: RenderOpts) {
  const T = scene.terrain
  ctx.clearRect(0, 0, v.W, v.H)
  const bgA = clamp01(o.reveal / 0.3)
  if (backdrop && bgA > 0) {
    ctx.globalAlpha = bgA
    ctx.drawImage(backdrop, 0, 0)
    ctx.globalAlpha = 1
  }
  if (o.reveal <= 0) return

  const objAt = new Map<number, Obj>()
  for (const ob of scene.objs) objAt.set(ob.j * T.cols + ob.i, ob)

  // moving entities, bucketed by the tile they occupy so they sort correctly
  const movers = new Map<number, (() => void)[]>()
  if (o.reveal >= 1 && scene.paths) {
    scene.paths.forEach((p, n) => {
      const q = pathPoint(p, o.t)
      const ti = Math.round(q.i)
      const tj = Math.round(q.j)
      const cell = cellAt(T, ti, tj)
      if (!cell) return
      const x = Math.round(v.ox + (q.i - q.j) * 16)
      const y = Math.round(v.oy + (q.i + q.j) * 8 + 8 - v.E - cell.e)
      const key = tj * T.cols + ti
      const list = movers.get(key) ?? []
      const flip = (q.di - q.dj) * (q.back ? -1 : 1) < 0
      list.push(p.kind === 'rover' ? () => rover(ctx, x, y, flip) : () => walker(ctx, x, y, o.t, n))
      movers.set(key, list)
    })
  }

  const revealing = o.reveal < 1
  const hidden = (c: Cell | null, i: number, j: number) => !c || (revealing && threshold(T, i, j) > o.reveal)

  for (let s = 0; s <= T.cols + T.rows - 2; s++) {
    for (let i = Math.max(0, s - T.rows + 1); i <= Math.min(T.cols - 1, s); i++) {
      const j = s - i
      const cell = T.cells[j * T.cols + i]
      if (!cell) continue
      let dy = 0
      let th = 0
      if (revealing) {
        th = threshold(T, i, j)
        if (o.reveal < th) continue
        dy = -Math.round((1 - easeOut(clamp01((o.reveal - th) / 0.12))) * 16)
      }
      const nL = cellAt(T, i, j + 1)
      const nR = cellAt(T, i + 1, j)
      const showL = hidden(nL, i, j + 1) || (nL !== null && nL.e < cell.e)
      const showR = hidden(nR, i + 1, j) || (nR !== null && nR.e < cell.e)
      drawCell(ctx, v, T, i, j, cell, dy, showL, showR)

      const [sx, sy] = tileXY(v, i, j, cell.e)
      const hovered = o.hover && o.hover[0] === i && o.hover[1] === j
      if (hovered) diamondOutline(ctx, sx, sy, 16, o.ghostOk === false ? C.red : '#fff7e8')

      const ob = objAt.get(j * T.cols + i)
      if (ob) {
        let ody = dy
        if (revealing) {
          const k = clamp01((o.reveal - th - 0.12) / 0.12)
          if (k <= 0) continue
          ody = -Math.round((1 - easeOut(k)) * 22)
        }
        if (ob.born !== undefined) {
          const k = clamp01((o.now - ob.born) / 0.45)
          ody += -Math.round((1 - easeOut(k)) * 18)
          if (k < 1) {
            const r = Math.round(4 + k * 10)
            ctx.globalAlpha = 1 - k
            ellipseRows(ctx, sx, sy + 9, r, r / 2, C.sandHi)
            ctx.globalAlpha = 1
          }
        }
        let level = ob.level
        if (ob.level !== undefined && ob.levelFrom !== undefined && ob.levelAt !== undefined) {
          const k = easeOut(clamp01((o.now - ob.levelAt) / 1.6))
          level = ob.levelFrom + (ob.level - ob.levelFrom) * k
        }
        drawObject(ctx, { ...ob, level }, sx, sy + 8 + ody, o.t)
      } else if (hovered && o.ghost) {
        ctx.globalAlpha = o.ghostOk === false ? 0.25 : 0.6
        drawObject(ctx, { k: o.ghost }, sx, sy + 8, o.t)
        ctx.globalAlpha = 1
      }
      movers.get(j * T.cols + i)?.forEach((f) => f())
    }
  }
}

/** Front-to-back hit test against tile tops (accounts for elevation). */
export function pick(v: View, T: Terrain, nx: number, ny: number): [number, number] | null {
  for (let s = T.cols + T.rows - 2; s >= 0; s--) {
    for (let i = Math.min(T.cols - 1, s); i >= Math.max(0, s - T.rows + 1); i--) {
      const j = s - i
      const cell = T.cells[j * T.cols + i]
      if (!cell) continue
      const [sx, sy] = tileXY(v, i, j, cell.e)
      if (Math.abs(nx - sx) / 16 + Math.abs(ny - (sy + 8)) / 8 <= 1) return [i, j]
    }
  }
  return null
}

/* ------------------------------------------------------------------ */
/* Backdrop: dithered dusk sky, ridges, plain and the mesa's shadow    */
/* ------------------------------------------------------------------ */

const SKY = ['#0c1220', '#111a2d', '#182038', '#222644', '#302b4b', '#45314f', '#5f3a4f', '#7f434f', '#a0544d', '#bf6c50']
const GROUND = ['#b8714f', '#ab6648', '#9c5b41', '#8c4f39', '#7b4432', '#6b3a2c']
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16)
const rgb = (h: string) => {
  const n = parseInt(h.slice(1), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}

export function buildBackdrop(v: View, T: Terrain, seed = 3): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = v.W
  cv.height = v.H
  const ctx = cv.getContext('2d')!
  const img = ctx.createImageData(v.W, v.H)
  const d = img.data
  const sky = SKY.map(rgb)
  const gr = GROUND.map(rgb)
  const far = rgb('#6a3a4b')
  const near = rgb('#86453f')
  const hz = v.horizon
  for (let x = 0; x < v.W; x++) {
    const rf = Math.round(8 + 5 * Math.sin(x * 0.019 + seed) + 3 * Math.sin(x * 0.053 + seed * 2) + 1.5 * Math.sin(x * 0.14))
    const rn = Math.round(3 + 2.5 * Math.sin(x * 0.031 + 4) + 1.5 * Math.sin(x * 0.087 + 1))
    for (let y = 0; y < v.H; y++) {
      const b = BAYER[(y & 3) * 4 + (x & 3)]
      let c: number[]
      if (y < hz) {
        const f = Math.pow(y / hz, 1.25) * (sky.length - 1)
        const k = Math.floor(f)
        c = f - k > b ? sky[Math.min(k + 1, sky.length - 1)] : sky[k]
        if (y >= hz - rf) c = far
        if (y >= hz - rn) c = near
        else if (y < hz * 0.75 && y < hz - rf) {
          const n = hash(x, y, seed)
          if (n > 0.9972) {
            const lum = 150 + Math.floor(hash(y, x, 2) * 105)
            c = [lum, lum, Math.min(255, lum + 12)]
          }
        }
      } else {
        const f = Math.pow((y - hz) / Math.max(1, v.H - hz), 0.75) * (gr.length - 1)
        const k = Math.floor(f)
        c = f - k > b ? gr[Math.min(k + 1, gr.length - 1)] : gr[k]
        const n = hash(x, y, seed + 7)
        const ripple = (x + 2 * y + Math.floor(hash(x >> 3, y >> 2, 3) * 5)) % 19 === 0 && hash(x, y, 9) > 0.3
        if (n > 0.982) c = [c[0] + 18, c[1] + 12, c[2] + 8]
        else if (n < 0.014 || ripple) c = [c[0] - 16, c[1] - 11, c[2] - 8]
      }
      const o = (y * v.W + x) * 4
      d[o] = c[0]
      d[o + 1] = c[1]
      d[o + 2] = c[2]
      d[o + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)

  // Phobos and a pale-blue Earth
  const px = Math.round(v.W * 0.84)
  const py = Math.round(hz * 0.3)
  ellipseRows(ctx, px, py, 3, 2.6, '#b9a08c')
  rect(ctx, px + 1, py - 1, 2, 3, '#8a7565')
  rect(ctx, Math.round(v.W * 0.2), Math.round(hz * 0.22), 1, 1, '#9fd2ff')

  // plain craters
  for (let k = 0; k < 9; k++) {
    const cx = Math.floor(hash(k, 1, seed) * v.W)
    const cy = hz + 6 + Math.floor(hash(k, 2, seed) * (v.H - hz - 8))
    const r = 4 + Math.floor(hash(k, 3, seed) * 9 * ((cy - hz) / (v.H - hz) + 0.4))
    ellipseRows(ctx, cx, cy, r, r / 2, '#7a4231')
    ellipseRows(ctx, cx + 1, cy + 1, Math.max(1, r - 2), Math.max(1, r / 2 - 1), '#8f5039')
    rect(ctx, cx - r + 2, cy + Math.floor(r / 2), r * 2 - 4, 1, '#c07d59')
  }

  // mesa shadow cast toward the right
  const sh = document.createElement('canvas')
  sh.width = v.W
  sh.height = v.H
  const sctx = sh.getContext('2d')!
  for (let j = 0; j < T.rows; j++)
    for (let i = 0; i < T.cols; i++) {
      if (!T.cells[j * T.cols + i]) continue
      diamond(sctx, v.ox + (i - j) * 16 + 18, v.oy + (i + j) * 8 + 6, 16, '#2a1214')
    }
  ctx.globalAlpha = 0.32
  ctx.drawImage(sh, 0, 0)
  ctx.globalAlpha = 1
  return cv
}

/** Small standalone sprite (tile + structure) as a data URL, for UI thumbnails. */
const THUMBS: Partial<Record<ObjKind, string>> = {}
export function thumb(k: ObjKind) {
  if (THUMBS[k]) return THUMBS[k]!
  const cv = document.createElement('canvas')
  cv.width = 40
  cv.height = 48
  const ctx = cv.getContext('2d')!
  diamond(ctx, 20, 30, 16, C.sand[0])
  drawObject(ctx, { k, level: 0.7 }, 20, 38, 0)
  THUMBS[k] = cv.toDataURL()
  return THUMBS[k]!
}
