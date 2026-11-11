import { RESERVE_KJ } from '@/game/core/sim'
import { c, check, clean, must, run } from './helpers'

// battery banks keep their own charge: cutting them off the grid no longer deletes it
{
  const s = clean()
  must(s.place('pylon', c + 12, c, 0))
  for (let k = 0; k < 4; k++) must(s.place('battery', c + 13 + k, c, 0))
  s.time = 60 // no panels, so nothing charges
  for (const b of s.list('battery')) b.charge = 3000
  s.step(0.05)
  const full = s.power.stored
  check(Math.abs(full - (RESERVE_KJ + 12000)) < 5, `connected pool ${full}`)
  s.remove(c + 12, c)
  s.step(0.05)
  check(s.power.stored <= RESERVE_KJ && s.list('battery').every((b) => b.charge > 2990), `cut-off banks lost charge: ${s.list('battery').map((b) => b.charge)}`)
  must(s.place('pylon', c + 12, c, 0))
  s.step(0.05)
  check(Math.abs(s.power.stored - full) < 10, `reconnected pool ${s.power.stored} vs ${full}`)
}

// energy is conserved while the pool is shared out: charge in = generation − demand
{
  const s = clean()
  for (let k = 0; k < 3; k++) must(s.place('battery', c + 3 + k, c + 3, 0))
  for (let k = 0; k < 6; k++) must(s.place('solar', c - 4 + k, c - 4, 0))
  s.time = 24 // noon
  s.reserve = 0
  s.step(0.05)
  check(s.power.gen > s.power.demand, 'expected a daytime surplus')
  let expected = s.power.stored
  for (let n = 0; n < 200; n++) {
    s.step(0.05)
    expected = Math.max(0, Math.min(RESERVE_KJ + s.power.cap, expected + (s.power.gen - s.power.demand) * 0.05))
  }
  check(Math.abs(s.power.stored - expected) < 1e-6, `stored ${s.power.stored} expected ${expected}`)
  const fills = [s.reserve / RESERVE_KJ, ...s.list('battery').map((b) => b.charge / s.batteryKJ(b))]
  check(fills.every((f) => Math.abs(f - fills[0]) < 1e-9), 'stores should share one fill level')
  // upgrading a bank keeps its charge and adds room
  const b = s.list('battery')[0]
  const before = b.charge
  must(s.upgrade(b))
  s.step(0.05)
  check(s.power.cap === 3000 * 2 + 6500 && b.charge > 0 && Math.abs(s.power.stored - (expected + (s.power.gen - s.power.demand) * 0.05)) < 1, `upgrade ${before} → ${b.charge}`)
}

// at night with no generation, stored power runs life support first
{
  const s = clean()
  must(s.place('battery', c + 3, c + 3, 0))
  must(s.place('lab', c - 4, c + 3, 0))
  s.time = 14 + 120 * 0.5
  s.reserve = 0
  s.list('battery')[0].charge = 0.5
  s.step(0.05)
  check(s.power.lifeSat > s.power.indSat, 'life support first')
  run(s, 2)
  check(s.power.stored === 0 && s.power.lifeSat === 0, 'drained')
}

console.log('OK batteries: charge kept per bank, energy conserved, shared fill level')
