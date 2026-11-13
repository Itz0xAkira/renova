/** Communication delay: real Earth–Mars distance, supply orders that race the ship, and late storm warnings. */
import { earthMarsKm, lightMinutes, sunAngle } from '@/game/core/orbits'
import { PACK_LEAD, STORM_FORECAST } from '@/game/core/sim'
import { check, clean, reload } from './helpers'

// the orbit maths against known events: closest approaches (NASA: 62.07 and 96.08 million km) and a conjunction
const at = (d: string) => new Date(`${d}T12:00:00Z`)
check(Math.abs(earthMarsKm(at('2020-10-06')) / 1e6 - 62.07) < 0.5, `2020 close approach ${earthMarsKm(at('2020-10-06')) / 1e6}`)
check(Math.abs(earthMarsKm(at('2025-01-12')) / 1e6 - 96.08) < 0.5, `2025 close approach ${earthMarsKm(at('2025-01-12')) / 1e6}`)
check(sunAngle(at('2023-11-18')) < 2 && lightMinutes(at('2023-11-18')) > 20, 'November 2023 solar conjunction')
for (let y = 2020; y < 2030; y++)
  for (let m = 0; m < 12; m++) {
    const lm = lightMinutes(new Date(Date.UTC(y, m, 15)))
    check(lm > 3 && lm < 22.5, `light time out of range: ${lm} in ${y}-${m + 1}`)
  }

const step = (s: ReturnType<typeof clean>, secs: number) => {
  for (let n = 0; n < Math.round(secs * 20); n++) s.step(1 / 20)
}

// an order sent in time reaches Earth after the delay and makes the next ship
{
  const s = clean()
  s.setCommsDelay(10)
  const metal = () => s.stock.metal
  s.orderCargo('materials')
  check(s.cargo.atEarth === 'crew' && s.commsStatus().reachesIn > 9, 'order still travelling')
  step(s, 10.2)
  check(s.cargo.atEarth === 'materials', 'order reached Earth after the delay')
  const before = { m: metal(), b: s.stock.brick }
  step(s, s.ev.nextShip - s.time + 0.2)
  check(metal() - before.m >= 24 && s.stock.brick - before.b >= 12, 'the ship brought materials')
}

// an order sent too late goes on the ship after
{
  const s = clean()
  s.setCommsDelay(20)
  step(s, s.ev.nextShip - PACK_LEAD - 5 - s.time) // 5 s before packing, but the message needs 20
  s.orderCargo('supplies')
  check(!s.commsStatus().inTime, 'late order should miss the next ship')
  const landed = () => s.messages.filter((m) => m.text.startsWith('Supply ship landed')).at(-1)?.text ?? ''
  step(s, s.ev.nextShip - s.time + 0.2)
  check(!landed().includes('food'), `the next ship must not bring supplies: ${landed()}`)
  check(s.cargo.atEarth === 'supplies', 'but Earth has the order for the ship after')
  step(s, s.ev.nextShip - s.time + 0.2)
  check(landed().includes('16 food and 16 water'), `the ship after brings supplies: ${landed()}`)
  // and it all survives a save
  s.orderCargo('materials')
  const back = reload(s)
  check(back.cargo.want === 'materials' && back.cargo.atEarth === 'supplies', 'order saved')
}

// storm warnings arrive later when Mars is far
{
  const near = clean(3)
  near.setCommsDelay(4)
  const far = clean(3)
  far.setCommsDelay(22)
  const warnAt = (s: ReturnType<typeof clean>) => {
    while (!s.ev.storm) s.step(1 / 20)
    return s.ev.storm.start - s.time
  }
  const a = warnAt(near)
  const b = warnAt(far)
  check(Math.abs(a - (STORM_FORECAST - 4)) < 0.2 && Math.abs(b - (STORM_FORECAST - 22)) < 0.2, `storm lead ${a} vs ${b}`)
}
console.log('OK comms: real light time, orders race the ship, storm warnings shrink with distance')
