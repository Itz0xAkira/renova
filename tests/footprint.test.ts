import { Sim, CORE_AT as c, CORE_CENTRE, outTileFor } from '@/game/core/sim'
import { BUILDINGS, MAP } from '@/game/core/data'
import { check, clean, must } from './helpers'

// footprints: every tile is taken, and nothing overlaps
check(c === 46 && CORE_CENTRE === 47 && MAP === 96, `core at ${c}, centre ${CORE_CENTRE}`)
const sizes: Record<string, string> = { core: '3×3', drill: '2×2', excavator: '2×2', melter: '2×2', moxie: '2×2', shield: '2×2', solar: '2×2', battery: '2×2', smelter: '3×3', kiln: '3×3', washer: '3×3', habitat: '3×3', reactor: '3×3', lab: '3×3', greenhouse: '4×3', belt: '1×1', junction: '1×1', pylon: '1×1' }
for (const [k, wh] of Object.entries(sizes)) check(`${BUILDINGS[k as keyof typeof BUILDINGS].w}×${BUILDINGS[k as keyof typeof BUILDINGS].h}` === wh, `${k} footprint`)
{
  const s = clean()
  for (let dj = 0; dj < 3; dj++) for (let di = 0; di < 3; di++) check(s.entAt(c + di, c + dj)?.kind === 'core', 'core footprint')
  must(s.place('greenhouse', c - 8, c + 4, 0), 'greenhouse')
  for (let dj = 0; dj < 3; dj++) for (let di = 0; di < 4; di++) check(s.entAt(c - 8 + di, c + 4 + dj)?.kind === 'greenhouse', 'greenhouse footprint')
  check(s.placeError('solar', c - 5, c + 6) === 'Tile is taken' && s.placeError('solar', c - 6, c + 5) === 'Tile is taken', 'overlap allowed')
  check(!s.placeError('solar', c - 4, c + 4) && s.placeError('lab', c - 1, c + 1) === 'Tile is taken', 'neighbour placement')
}

// output comes out of the middle of the edge the arrow faces (just before the middle on even edges)
const out = (k: keyof typeof BUILDINGS, d: 0 | 1 | 2 | 3) => String(outTileFor(k, 10, 10, d))
check(out('smelter', 0) === '13,11' && out('smelter', 1) === '11,13' && out('smelter', 2) === '9,11' && out('smelter', 3) === '11,9', '3×3 output tiles')
check(out('greenhouse', 0) === '14,11' && out('greenhouse', 1) === '11,13' && out('greenhouse', 2) === '9,11' && out('greenhouse', 3) === '11,9', '4×3 output tiles')
check(out('drill', 0) === '12,10' && out('drill', 1) === '10,12' && out('drill', 2) === '9,10' && out('drill', 3) === '10,9', '2×2 output tiles')
check(out('belt', 0) === '11,10', '1×1 output tile')

// belts dock on the output tile only; any belt pointing into any edge tile feeds the machine
{
  const s = clean()
  must(s.place('kiln', c + 6, c + 6, 0), 'kiln') // 3×3, outputs east onto (c+9, c+7)
  must(s.place('belt', c + 9, c + 7, 0), 'out belt')
  must(s.place('belt', c + 9, c + 6, 0), 'beside the output')
  must(s.place('belt', c + 7, c + 5, 1), 'into the top edge')
  s.ensureBelts()
  check(!s.entAt(c + 9, c + 7)!.capStart, 'output belt should be fed by the kiln')
  check(s.entAt(c + 9, c + 6)!.capStart, 'belt beside the output tile is not fed')
  check(!s.entAt(c + 7, c + 5)!.capEnd, 'belt into an edge tile docks')
  s.entAt(c + 7, c + 5)!.items.push({ item: 'regolith', pos: 0.9 })
  s.step(0.1)
  check(s.entAt(c + 6, c + 6)!.inBuf.regolith === 1, 'regolith should enter the kiln through its top edge')
}

// metal chain through a 3×3 smelter on the real map: starter ore → smelter → belts → core
const t = new Sim(42)
t.stock.metal = 999
t.stock.brick = 999
must(t.place('excavator', c - 2, c + 12, 3), 'excavator') // outputs north onto (c-2, c+11), inside the smelter
must(t.place('smelter', c - 3, c + 9, 0), 'smelter') // tiles c-3..c-1 × c+9..c+11, outputs east onto (c, c+10)
for (let j = c + 10; j >= c + 3; j--) must(t.place('belt', c, j, 3), `belt ${j}`)
for (let n = 0; n < 20 * 60; n++) t.step(1 / 20)
check(t.delivered.metal >= 3, `metal from 3×3 smelter: ${t.delivered.metal}`)
// habitats house 6, and the greenhouse and washer are available from the start
check(BUILDINGS.habitat.housing === 6 && t.unlocked('greenhouse') && t.unlocked('washer'), 'unlocks/housing')
// a save whose building overlaps another is refunded, not overlapped
const save = t.save()
save.ents.push({ k: 'lab', i: c - 3, j: c + 8, d: 0 })
const metal = t.stock.metal
const back = Sim.load(save)
check(![...back.ents.values()].some((e) => e.kind === 'lab') && back.stock.metal === metal + 15, 'overlapping lab loaded')
console.log('OK footprints · metal from 3×3 smelter:', t.delivered.metal)
