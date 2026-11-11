import { Sim } from '@/game/core/sim'
import { BUILDINGS, STATION_MAX_PLANTS, STATION_PLANT_EVERY } from '@/game/core/data'
import { c, check, clean, must, run } from './helpers'

// a level-3 solar station plants whole 2×2 panels in free spots right around itself
{
  const s = clean(7)
  must(s.place('solar', c + 6, c + 6, 0))
  const st = s.entAt(c + 6, c + 6)!
  must(s.upgrade(st))
  must(s.upgrade(st))
  s.ev.nextShip = Infinity // no supply-ship metal muddling the sums
  const metal = s.stock.metal
  run(s, STATION_PLANT_EVERY * (STATION_MAX_PLANTS + 2))
  const planted = s.list('solar').filter((e) => e !== st)
  check(st.planted === STATION_MAX_PLANTS && planted.length === STATION_MAX_PLANTS, `planted ${st.planted} / ${planted.length}`)
  check(s.stock.metal === metal - STATION_MAX_PLANTS * (BUILDINGS.solar.cost.metal ?? 0), 'each panel costs a solar panel’s metal')
  for (const p of planted) {
    check(p.level === 1 && p.onGrid, 'planted panels are level 1 and connected')
    for (let dj = 0; dj < 2; dj++) for (let di = 0; di < 2; di++) check(s.entAt(p.i + di, p.j + dj) === p, 'planted panel owns its whole 2×2 footprint')
    check(Sim.gap(st, p) <= 3, `panel planted too far away: ${Sim.gap(st, p)}`)
  }
  check(planted.some((p) => Sim.gap(st, p) === 1), 'the nearest ring is used first')
}

// no free 2×2 spot within reach: nothing is planted and no metal is spent
{
  const s = clean(7)
  must(s.place('solar', c + 6, c + 6, 0))
  const st = s.entAt(c + 6, c + 6)!
  st.level = 3
  // fence every tile within 3 of the station with belts, leaving only single free tiles
  for (let j = c + 2; j <= c + 11; j++)
    for (let i = c + 2; i <= c + 11; i++) if (!s.entAt(i, j) && (i + j) % 2 === 0) must(s.place('belt', i, j, 0))
  s.ev.nextShip = Infinity
  const before = s.stock.metal
  run(s, STATION_PLANT_EVERY * 2)
  check(st.planted === 0 && s.count('solar') === 1 && s.stock.metal === before, 'planted into a space with no 2×2 room')
}

console.log('OK solar stations plant 2×2 panels in the nearest free spots')
