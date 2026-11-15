import { Sim } from '@/game/core/sim'
import { MISSIONS } from '@/game/core/missions'
import { BUILDINGS, MAP, SHIELD_REACH } from '@/game/core/data'
import { c, check, clean, must, reload, run } from './helpers'

const m = (id: string) => MISSIONS.find((x) => x.id === id)!
check(new Set(MISSIONS.map((x) => x.id)).size === MISSIONS.length, 'mission ids must be unique')

// "Do science" needs a lab: the core's own slow research doesn't count
{
  const s = clean()
  run(s, 200)
  check(s.done.size >= 1 && !m('science').check(s), 'core-only research passed Do science')
  for (let k = 0; k < 8; k++) must(s.place('solar', c - 8 + 2 * k, c - 7, 0))
  must(s.place('lab', c + 4, c - 5, 0)) // 4×4, one row of ground above the core
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
  must(s.place('solar', c + 5, c + 5, 0))
  must(s.upgrade(s.entAt(c + 5, c + 5)!))
  check(s.upgrades === 1 && m('upgrade').check(s), 'upgrade counted')
}
{
  const s = new Sim(42)
  s.stock.metal = 999
  must(s.place('belt', c + 5, c + 5, 0))
  must(s.place('solar', c + 6, c + 5, 0))
  must(s.upgrade(s.entAt(c + 6, c + 5)!))
  check(m('upgrade').check(reload(s)), 'Upgrade mission lost its progress on reload')
}

// "Power up" asks for what it checks
check(/solar panels/.test(m('power').text) && !/arrays/.test(m('power').text), 'Power up text')

// texts that mention sizes and distances match the data
check(m('washer').text.includes(`(${BUILDINGS.washer.w}×${BUILDINGS.washer.h})`), 'washer size in text')
check(m('harvest').text.includes(`(${BUILDINGS.greenhouse.w}×${BUILDINGS.greenhouse.h})`), 'greenhouse size in text')
check(m('habitat').text.includes(`within ${SHIELD_REACH[0]} tiles`) && BUILDINGS.habitat.desc.includes(`within ${SHIELD_REACH[0]} tiles`), 'shield reach in text')

// the first missions stay quick on any map: starter ice and ore for a whole 3×3 miner inside the core's power square
for (const seed of [1, 7, 42, 1234, 99999, 31337]) {
  const s = new Sim(seed)
  s.ensureGrid()
  const fits = (kind: 'drill' | 'excavator', g: string) => {
    for (let j = 0; j < MAP - 2; j++)
      for (let i = 0; i < MAP - 2; i++) {
        let all = true
        for (let k = 0; k < 9 && all; k++) all = s.groundAt(i + (k % 3), j + Math.floor(k / 3)) === g && s.covered[(j + Math.floor(k / 3)) * MAP + i + (k % 3)] === 1
        if (all && !s.placeError(kind, i, j)) return true
      }
    return false
  }
  check(fits('drill', 'ice') && fits('excavator', 'ore'), `seed ${seed}: no starter ice/ore patch for a 3×3 miner on the grid`)
}

console.log('OK missions: ids, Do science needs a lab, Upgrade from levels, Power up text')
