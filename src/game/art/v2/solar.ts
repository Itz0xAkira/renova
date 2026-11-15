/**
 * Solar (2×2), clean isometric style, a different machine at each level:
 *  1. Solar panel: one fixed-tilt panel on a frame, swept clean by a little
 *     brush robot that runs along its top edge.
 *  2. Solar array: flexible solar blankets rolled out on both sides of a
 *     central drum, pegged to the ground.
 *  3. Solar station: a white power hut with four fan-folded (pleated) wings
 *     opened out round it, and a status light.
 */
import type { Ctx } from '@/site/pixel/engine'
import { all, at, Iso, KZ, status } from '@/game/art/buildings/life'
import { block, flat, FRAME, MAT, pad, slats, type Mat } from './flat'

const WHITE: Mat = { t: '#f2ece4', l: '#ddd3cc', r: '#b6a6aa', hi: '#fffcf6', lo: '#8c7a83' }
const CELL = ['#26305a', '#2f3a63', '#46558a', '#6c7fb8', '#a9b8e8'] as const
const OR = MAT.crate
const NE = MAT.metal

/** Solar cells: dark blue with a light grid and the odd glint. */
const cell = (a: number, b: number, edge: boolean) => (edge ? NE.hi : a % 5 === 0 || b % 4 === 0 ? CELL[3] : (a * 3 + b * 5) % 29 === 0 ? CELL[4] : b % 4 === 1 ? CELL[2] : CELL[1])

/** A flat panel tilted up toward the back: over u0…u1 × v0…v1, height zFront at v1 rising to zBack at v0. */
function tilted(s: Iso, u0: number, u1: number, v0: number, v1: number, zFront: number, zBack: number) {
  const step = 1 / 40
  const nu = Math.round((u1 - u0) / step)
  const nv = Math.round((v1 - v0) / step)
  for (let i = 0; i <= nu; i++)
    for (let j = 0; j <= nv; j++) {
      const u = u0 + i * step
      const v = v0 + j * step
      const z = zBack + ((zFront - zBack) * (v - v0)) / (v1 - v0)
      const edge = i === 0 || j === 0 || i === nu || j === nv
      s.pt(u, v, z, cell(Math.floor((u - u0) * 16), Math.floor((v - v0) * 16), edge), false, 0.02)
      // the panel's thin underside edge at the front
      if (j === nv) s.pt(u, v, z - 1, NE.r, false, 0.02)
    }
}

export function solarV2(ctx: Ctx, x: number, y: number, t: number, tier: number) {
  const s = new Iso(ctx, x, y, 0.5)
  const base = 3
  pad(s, 0.97, base)

  if (tier === 1) {
    // frame legs: short at the front, tall at the back
    for (const u of [-0.7, 0.6]) {
      s.post(u, 0.55, base, base + 5, flat(NE.l))
      s.post(u, -0.6, base, base + 15, flat(NE.l))
      s.line(u, 0.55, base + 3, u, -0.6, base + 9, NE.r)
    }
    tilted(s, -0.82, 0.72, -0.72, 0.62, base + 6, base + 17)
    // the brush robot running along the top edge, its brush a white bar
    const ru = -0.7 + ((Math.sin(t * Math.PI) + 1) / 2) * 1.2
    block(s, ru, ru + 0.18, -0.78, -0.62, base + 17, base + 21, WHITE, { ground: false, l: (c, r) => (r === 1 ? OR.t : null) })
    // its brush: a white bar lying on the panel, following the slope
    for (let v = -0.7; v <= 0.6; v += 1 / 40) {
      const z = base + 17 + ((base + 6 - (base + 17)) * (v + 0.72)) / (0.62 + 0.72)
      s.pt(ru + 0.09, v, z + 0.6, WHITE.hi, false, 0.05)
      s.pt(ru + 0.12, v, z + 0.6, WHITE.r, false, 0.05)
    }
    status(s, ru + 0.09, -0.62, base + 21, 'green', true)
    // a small junction box with its cable
    block(s, 0.5, 0.8, 0.55, 0.85, base, base + 5, NE, { l: (c, r, w) => (r === 2 && c === w - 2 ? '#7ee07a' : null) })
  } else if (tier === 2) {
    // the drum down the middle, blankets rolled out both sides
    const R = 0.17
    block(s, -0.85, 0.75, -0.18, 0.18, base, base + 2, NE)
    s.hcyl('u', -0.85, 0.75, 0, base + 2 + R * KZ, R, flat(WHITE.t), {
      pat: (s0, _th, l) => (Math.round(s0) % 8 === 0 ? OR.t : l > 0.6 ? WHITE.hi : l > 0.45 ? WHITE.t : WHITE.l),
      cap: (rr) => (rr > 0.7 ? OR.t : NE.l),
    })
    for (const [v0, v1] of [
      [-0.9, -0.2],
      [0.2, 0.9],
    ])
      block(s, -0.8, 0.7, v0, v1, base, base + 1, NE, { ground: false, t: (c, r, w, h) => cell(c, r, c === 0 || r === 0 || c === w - 1 || r === h - 1) })
    // pegs at the blanket corners
    for (const u of [-0.8, 0.7]) for (const v of [-0.9, 0.9]) block(s, u - 0.03, u + 0.03, v - 0.03, v + 0.03, base, base + 3, OR)
    block(s, 0.72, 0.92, -0.15, 0.15, base, base + 6, NE, { l: (c, r) => (r === 2 && c === 1 ? '#7ee07a' : null) })
  } else {
    // the power hut in the middle
    block(s, -0.3, 0.3, -0.3, 0.3, base, base + 13, WHITE, {
      l: all((c, r, w, h) => (r === 1 ? OR.t : r === h - 1 ? WHITE.lo : null), at(2, 4, 5, 6, (c, r, w, h) => (c === 0 || r === 0 || c === w - 1 || r === h - 1 ? FRAME : r < h / 2 ? '#7ee07a' : '#2f6a3a'))),
      r: all((c, r, w, h) => (r === 1 ? OR.l : r === h - 1 ? WHITE.lo : null), slats(2, 4, 6, 6)),
      top: MAT.roof.t,
    })
    status(s, 0, 0, base + 16, 'green', (t * 2) % 1 < 0.6)
    // four fan-folded wings, pleats alternating light and shade
    const pleat = (k: number, edge: boolean) => (edge ? NE.hi : k % 2 ? CELL[1] : CELL[3])
    const wing = (u0: number, u1: number, v0: number, v1: number, along: 'u' | 'v') =>
      block(s, u0, u1, v0, v1, base + 3, base + 4, NE, {
        ground: false,
        t: (c, r, w, h) => pleat(Math.floor((along === 'u' ? c : r) / 3), c === 0 || r === 0 || c === w - 1 || r === h - 1),
      })
    wing(-0.92, -0.35, -0.9, 0.9, 'v')
    wing(0.35, 0.92, -0.9, 0.9, 'v')
    wing(-0.3, 0.3, -0.92, -0.35, 'u')
    wing(-0.3, 0.3, 0.35, 0.92, 'u')
    for (const [u, v] of [
      [-0.85, -0.85],
      [0.85, -0.85],
      [-0.85, 0.85],
      [0.85, 0.85],
    ])
      s.post(u, v, base, base + 3, flat(NE.l))
  }
  s.flush()
}
