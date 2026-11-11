import { Sim, CORE_AT as c, outTileFor } from '../src/game/sim'
import { BUILDINGS } from '../src/game/data'
const must = (e: string | null, w: string) => {
  if (e) throw new Error(`${w}: ${e}`)
}
const s = new Sim(42)
s.stock.metal = 999
s.stock.brick = 999
// a 3×2 greenhouse occupies all six tiles
must(s.place('greenhouse', c - 6, c + 4, 0), 'greenhouse')
for (let dj = 0; dj < 2; dj++) for (let di = 0; di < 3; di++) if (s.entAt(c - 6 + di, c + 4 + dj)?.kind !== 'greenhouse') throw new Error('greenhouse footprint')
if (s.placeError('solar', c - 4, c + 5) !== 'Tile is taken') throw new Error('overlap allowed')
// output comes out of the middle of the edge the arrow faces
if (String(outTileFor('smelter', 10, 10, 0)) !== '12,10' || String(outTileFor('greenhouse', 10, 10, 1)) !== '11,12') throw new Error('output tile')
// metal chain through a 2×2 smelter: excavator on the starter ore → smelter → belts → core
const t = new Sim(42)
t.stock.metal = 999
t.stock.brick = 999
must(t.place('excavator', c - 2, c + 8, 3), 'excavator')
must(t.place('smelter', c - 2, c + 6, 0), 'smelter') // tiles c-2..c-1 × c+6..c+7, outputs east onto (c, c+6)
for (let j = c + 6; j >= c + 2; j--) must(t.place('belt', c, j, 3), `belt ${j}`)
for (let n = 0; n < 20 * 60; n++) t.step(1 / 20)
if (t.delivered.metal < 3) throw new Error(`metal from 2×2 smelter: ${t.delivered.metal}`)
// habitats house 6, and the greenhouse and washer are available from the start
if (BUILDINGS.habitat.housing !== 6 || !t.unlocked('greenhouse') || !t.unlocked('washer')) throw new Error('unlocks/housing')
// an old save whose building no longer fits is refunded, not overlapped
const save = t.save()
save.ents.push(['lab', c - 2, c + 6, 0])
const back = Sim.load(save)
if ([...back.ents.values()].some((e) => e.kind === 'lab')) throw new Error('overlapping lab loaded')
console.log('OK footprints · metal from 2×2 smelter:', t.delivered.metal)
