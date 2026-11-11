import { Sim } from '@/game/core/sim'
import { MISSIONS } from '@/game/core/missions'
import { c, check, clean, must, reload, run } from './helpers'

const m = (id: string) => MISSIONS.find((x) => x.id === id)!
check(new Set(MISSIONS.map((x) => x.id)).size === MISSIONS.length, 'mission ids must be unique')

// "Do science" needs a lab: the core's own slow research doesn't count
{
  const s = clean()
  run(s, 200)
  check(s.done.size >= 1 && !m('science').check(s), 'core-only research passed Do science')
  for (let k = 0; k < 8; k++) must(s.place('solar', c - 4 + k, c - 4, 0))
  must(s.place('lab', c + 3, c - 3, 0))
  s.time = 24 + 240 // noon, so the lab has power
  run(s, 5)
  check(!m('science').check(s), 'building a lab alone should not pass')
  run(s, 120)
  check(s.labProjects >= 1 && m('science').check(s), `lab research should pass (labProjects ${s.labProjects})`)
}

// "Upgrade" counts levels, so it survives a reload
{
  const s = clean()
  check(!m('upgrade').check(s), 'nothing upgraded yet')
  must(s.place('solar', c + 4, c + 4, 0))
  must(s.upgrade(s.entAt(c + 4, c + 4)!))
  check(s.upgrades === 1 && m('upgrade').check(s), 'upgrade counted')
}
{
  const s = new Sim(42)
  s.stock.metal = 999
  must(s.place('belt', c + 3, c + 3, 0))
  must(s.place('solar', c + 4, c + 3, 0))
  must(s.upgrade(s.entAt(c + 4, c + 3)!))
  check(m('upgrade').check(reload(s)), 'Upgrade mission lost its progress on reload')
}

// "Power up" asks for what it checks
check(/solar panels/.test(m('power').text) && !/arrays/.test(m('power').text), 'Power up text')

console.log('OK missions: ids, Do science needs a lab, Upgrade from levels, Power up text')
