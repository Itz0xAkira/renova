import { c, check, clean, must, run } from './helpers'

const fed = () => {
  const s = clean()
  s.stock.food = s.stock.water = s.stock.o2 = 99999
  return s
}

// a habitat off the grid has no usable beds and says so
{
  const s = fed()
  must(s.place('habitat', c + 25, c + 20, 0))
  must(s.place('shield', c + 27, c + 20, 0))
  s.colonists = 10
  run(s, 2)
  const h = s.entAt(c + 25, c + 20)!
  check(!h.onGrid && h.residents === 0 && h.status === 'nogrid', `off-grid habitat: ${h.residents} ${h.status}`)
  check(s.housing() === 4, `off-grid beds counted: ${s.housing()}`)
  check(s.shortages.has('housing'), 'crew without beds should be short of housing')
  // a pylon brings it onto the grid
  for (const [i, j] of [[c + 9, c], [c + 15, c], [c + 21, c], [c + 21, c + 6], [c + 21, c + 12], [c + 24, c + 18]]) must(s.place('pylon', i, j, 0))
  run(s, 2)
  check(h.onGrid && h.residents === 6 && h.status === 'ok' && s.housing() === 10, `connected habitat: ${h.onGrid} ${h.residents} ${h.status}`)
  check(!s.shortages.has('housing'), 'housing shortage should clear')
}

// in a blackout a habitat reports no power
{
  const s = fed()
  must(s.place('habitat', c + 4, c + 4, 0))
  s.time = 14 + 120 * 0.5 // night
  s.reserve = 0
  run(s, 1)
  check(s.entAt(c + 4, c + 4)!.status === 'nopower', `blackout habitat: ${s.entAt(c + 4, c + 4)!.status}`)
}

// residents fill shielded habitats before unshielded ones
{
  const s = fed()
  must(s.place('habitat', c - 6, c, 0)) // unshielded, built first
  must(s.place('habitat', c + 5, c, 0))
  must(s.place('shield', c + 7, c, 0))
  s.colonists = 8
  run(s, 1)
  const a = s.entAt(c - 6, c)!
  const b = s.entAt(c + 5, c)!
  check(b.residents === 4 && a.residents === 0, `residents: shielded ${b.residents}, unshielded ${a.residents}`)
  check(!s.shortages.has('radiation'), 'nobody needs to live unshielded')
  s.colonists = 14
  run(s, 1)
  check(b.residents === 6 && a.residents === 4 && s.shortages.has('radiation') && a.status === 'unshielded', 'overflow goes to the unshielded habitat')
}

// removing habitats leaves crew without beds: a gentle drain, slower than a real shortage
{
  const s = fed()
  must(s.place('habitat', c + 4, c + 4, 0))
  s.colonists = 10
  run(s, 1)
  s.remove(c + 4, c + 4)
  run(s, 20)
  check(s.shortages.has('housing') && s.shortages.size === 1, `homeless shortages: ${[...s.shortages]}`)
  const homelessLoss = 100 - s.health
  const t = clean()
  t.stock.food = 0
  t.stock.water = t.stock.o2 = 99999
  run(t, 40) // owed food builds up for ~15 s before the shortage starts
  const hungryLoss = 100 - t.health
  check(homelessLoss > 0 && homelessLoss < hungryLoss / 2, `housing should be gentle: ${homelessLoss} vs ${hungryLoss}`)
}

console.log('OK habitats: grid beds, nopower, shielded first, gentle housing shortage')
