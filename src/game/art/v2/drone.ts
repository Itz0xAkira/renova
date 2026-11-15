/**
 * The construction drone, clean isometric style: a white quadcopter body with
 * a gold-foil top, an orange stripe and a status light, four orange arms out to
 * motor pods with spinning rotor discs (two blur poses), landing skids, and a
 * small orange cargo pod slung underneath.
 *
 * Drawn on a DRONE_W × DRONE_H canvas with the body centre at (DRONE_AX, DRONE_AY).
 */
import { Iso } from '@/game/art/buildings/life'
import { canvas } from '@/game/art/canvas'
import { outlineOf } from '@/game/art/passes'
import { block, MAT, type Mat } from './flat'

export const DRONE_W = 36
export const DRONE_H = 28
export const DRONE_AX = 18
export const DRONE_AY = 15

const WHITE: Mat = { t: '#f2ece4', l: '#ddd3cc', r: '#b6a6aa', hi: '#fffcf6', lo: '#8c7a83' }
const GOLD: Mat = { t: '#f3cf6a', l: '#d9ad45', r: '#a87a2e', hi: '#ffeaa6', lo: '#6e4c1e' }
const OR = MAT.crate
const DARK = MAT.dark

export function droneCanvas(frame: number) {
  const body = canvas(DRONE_W, DRONE_H, (ctx) => {
    const s = new Iso(ctx, DRONE_AX, DRONE_AY, 0.5)
    const R = 0.42
    const rotors: [number, number][] = [
      [-R, -R],
      [R, -R],
      [-R, R],
      [R, R],
    ]
    // landing skids
    for (const v of [-0.12, 0.12]) {
      for (let u = -0.22; u <= 0.22; u += 1 / 32) s.pt(u, v, -5, DARK.l, false)
      s.line(-0.12, v, -5, -0.08, v, -1, DARK.r)
      s.line(0.12, v, -5, 0.08, v, -1, DARK.r)
    }
    // the cargo pod slung underneath
    block(s, -0.09, 0.09, -0.08, 0.08, -4, -1, OR, { ground: false, l: (c, r, w, h) => (r === Math.floor(h / 2) ? WHITE.l : null) })
    // arms out to the motor pods
    for (const [u, v] of rotors) {
      s.line(0, 0, 1, u, v, 1.5, OR.l)
      s.line(0, 0, 2, u, v, 2.5, OR.t)
      block(s, u - 0.05, u + 0.05, v - 0.05, v + 0.05, 1, 4, DARK, { ground: false })
    }
    // the body: white shell, gold-foil top, orange stripe, status light and a camera eye
    block(s, -0.18, 0.18, -0.15, 0.15, -1, 4, WHITE, {
      ground: false,
      l: (c, r, w, h) => (r === 2 ? OR.t : c === w - 3 && r === 1 ? '#3e3a5d' : null),
      r: (c, r) => (r === 2 ? OR.l : null),
      t: (c, r, w, h) => (c === 0 || r === h - 1 ? GOLD.hi : (c + r) % 3 === 0 ? GOLD.hi : GOLD.t),
    })
    s.pt(0, 0, 5.5, frame ? '#7ee07a' : '#2f7a3a', false, 0.2)
    // rotor discs: a pale blurred ring, the blades in one of two poses
    for (const [u, v] of rotors) {
      for (let a = 0; a < Math.PI * 2; a += 0.15) s.pt(u + Math.cos(a) * 0.2, v + Math.sin(a) * 0.2, 5, '#c3cad3', false, 0.1)
      const ang = frame ? Math.PI / 4 : -Math.PI / 4
      for (let k = -4; k <= 4; k++) s.pt(u + Math.cos(ang) * k * 0.045, v + Math.sin(ang) * k * 0.045, 5.2, '#f4f7fa', false, 0.12)
      s.pt(u, v, 5.4, DARK.r, false, 0.15)
    }
    s.flush()
  })
  return canvas(DRONE_W, DRONE_H, (ctx) => {
    ctx.drawImage(outlineOf(body, true), 0, 0)
    ctx.drawImage(body, 0, 0)
  })
}
