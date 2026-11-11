import { Sim } from '@/game/core/sim'
import { MAP, SOLAR_KW } from '@/game/core/data'
import { c, check, clean, must, run } from './helpers'

// step(0) and bad dt are ignored instead of poisoning machines with NaN
{
  const s = clean()
  must(s.place('excavator', c + 4, c, 2))
  s.time = 24
  for (const dt of [0, -1, NaN, Infinity]) s.step(dt)
  run(s, 10)
  const ex = s.entAt(c + 4, c)!
  check(Number.isFinite(ex.progress) && Number.isFinite(s.power.sat) && s.time === 34, `NaN after bad dt: ${ex.progress} ${s.power.sat} ${s.time}`)
}

// upgrade messages, and removing an upgraded building refunds what was spent on it
{
  const s = clean()
  must(s.place('belt', c + 3, c + 3, 0))
  check(s.upgrade(s.entAt(c + 3, c + 3)!) === 'Conveyor belts can’t be upgraded', 'non-upgradable message')
  must(s.place('battery', c + 4, c + 4, 0))
  const b = s.entAt(c + 4, c + 4)!
  const m0 = s.stock.metal
  const b0 = s.stock.brick
  must(s.upgrade(b))
  must(s.upgrade(b))
  check(s.upgrade(b) === 'Already fully upgraded', 'max level message')
  const spentM = m0 - s.stock.metal + 10
  const spentB = b0 - s.stock.brick
  const back = s.refundFor(b)
  check(back.metal === spentM && back.brick === spentB, `refund ${JSON.stringify(back)} vs spent ${spentM}/${spentB}`)
  s.remove(c + 4, c + 4)
  check(s.stock.metal === m0 + 10 && s.stock.brick === b0, 'remove should refund cost and upgrades')
}

// items that came round a corner drop the curve when the belt is rotated or gets a straight feed
{
  const s = clean()
  must(s.place('belt', c + 6, c + 6, 0))
  must(s.place('belt', c + 6, c + 5, 1)) // feeds the side: corner
  s.ensureBelts()
  const corner = s.entAt(c + 6, c + 6)!
  check(corner.curve === 3, 'corner')
  corner.items.push({ item: 'ice', pos: 0.1, from: 3 })
  s.ensureBelts()
  check(corner.items[0].from === 3, 'curve kept while it still exists')
  must(s.place('belt', c + 5, c + 6, 0)) // now fed straight from behind as well
  s.ensureBelts()
  check(corner.items[0].from === undefined, 'stale curve after a back feed')
  corner.items[0].from = 3
  s.rotate(corner)
  s.ensureBelts()
  check(corner.items[0].from === undefined, 'stale curve after rotating')
}

// HUD helpers: generator output and research rate
{
  const s = clean()
  must(s.place('solar', c + 3, c + 3, 0))
  must(s.place('solar', c + 30, c + 30, 0))
  must(s.place('lab', c - 4, c + 3, 0))
  s.time = 24
  s.step(0.05)
  const on = s.entAt(c + 3, c + 3)!
  check(Math.abs(s.genKW(on) - SOLAR_KW[0] * s.sun()) < 1e-9 && s.genKW(s.entAt(c + 30, c + 30)!) === 0, 'genKW')
  const rp = s.rp
  const rate = s.researchRate()
  s.step(1)
  check(rate > 0.4 && Math.abs(s.rp - rp - rate) < 1e-6, `researchRate ${rate} vs ${s.rp - rp}`)
  s.current = null
  check(s.researchRate() === 0, 'no research, no rate')
}

// the grid search scales: hundreds of pylons rebuild quickly
{
  const s = clean()
  s.stock.metal = 1e7
  for (let j = 1; j < MAP - 1; j += 3) for (let i = 1; i < MAP - 1; i += 3) if (!s.entAt(i, j)) s.place('pylon', i, j, 0)
  const t0 = performance.now()
  for (let k = 0; k < 10; k++) {
    s.rev++
    s.ensureGrid()
  }
  const ms = (performance.now() - t0) / 10
  check(s.list('pylon').every((p) => p.onGrid), 'every pylon in a dense mesh joins')
  check(ms < 15, `ensureGrid took ${ms.toFixed(1)} ms with ${s.count('pylon')} pylons`)
  console.log(`ensureGrid ${ms.toFixed(2)} ms for ${s.count('pylon')} pylons`)
}

void Sim
console.log('OK misc: bad dt, upgrade messages and refunds, stale curves, HUD helpers, grid speed')
