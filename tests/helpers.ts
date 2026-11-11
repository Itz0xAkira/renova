/** Shared bits for the headless tests (not a test itself). */
import { Sim, CORE_AT } from '@/game/core/sim'
import { MAP } from '@/game/core/data'

export const c = CORE_AT

/** A sim on all-sand ground with plenty of materials. */
export function clean(seed = 42) {
  const s = new Sim(seed)
  for (let k = 0; k < MAP * MAP; k++) s.ground[k] = 'sand'
  s.stock.metal = 99999
  s.stock.brick = 99999
  return s
}

export const must = (e: string | null, what = '') => {
  if (e) throw new Error(`${what}: ${e}`)
}

export const check = (ok: unknown, what: string) => {
  if (!ok) throw new Error(what)
}

/** Step `secs` of game time at the game's 20 Hz. */
export const run = (s: Sim, secs: number) => {
  for (let n = 0; n < Math.round(secs * 20); n++) s.step(1 / 20)
}

/** Save to JSON and back, as the game does. */
export const reload = (s: Sim) => Sim.load(JSON.parse(JSON.stringify(s.save())))

/**
 * A sim on its real (seeded) ground, with plenty of materials, plus the top-left of an
 * open w×h patch of plain sand inside the core's power square — for tests that save and
 * reload (loading regenerates the ground from the seed).
 */
export function natural(seed = 42, w = 9, h = 9) {
  const s = new Sim(seed)
  s.stock.metal = 99999
  s.stock.brick = 99999
  for (let r = 0; r < 12; r++)
    for (let j = c - r; j <= c + r; j++)
      for (let i = c - r; i <= c + r; i++) {
        let ok = true
        for (let dj = 0; dj < h && ok; dj++) for (let di = 0; di < w && ok; di++) ok = s.groundAt(i + di, j + dj) === 'sand' && !s.entAt(i + di, j + dj)
        if (ok) return { s, at: [i, j] as [number, number] }
      }
  throw new Error('no open patch')
}
