import { Sim, CORE_AT as c, CORE_CENTRE } from '@/game/core/sim'
import { BUILDINGS, MAP } from '@/game/core/data'
import { check, clean, must } from './helpers'

// footprints: every tile is taken, and nothing overlaps
check(c === 45 && CORE_CENTRE === 47 && MAP === 96, `core at ${c}, centre ${CORE_CENTRE}`)
const sizes: Record<string, string> = { core: '5×5', drill: '3×3', excavator: '3×3', melter: '3×3', moxie: '3×3', shield: '2×2', solar: '2×2', battery: '3×3', smelter: '4×4', kiln: '4×4', washer: '4×4', habitat: '6×6', reactor: '5×5', lab: '4×4', greenhouse: '6×4', belt: '1×1', junction: '1×1', pylon: '1×1' }
for (const [k, wh] of Object.entries(sizes)) check(`${BUILDINGS[k as keyof typeof BUILDINGS].w}×${BUILDINGS[k as keyof typeof BUILDINGS].h}` === wh, `${k} footprint`)
{
  const s = clean()
  for (let dj = 0; dj < 5; dj++) for (let di = 0; di < 5; di++) check(s.entAt(c + di, c + dj)?.kind === 'core', 'core footprint')
  check(s.entAt(c + 5, c)?.kind !== 'core' && s.entAt(c, c + 5)?.kind !== 'core', 'core footprint ends at c+4')
  must(s.place('greenhouse', c - 10, c + 6, 0), 'greenhouse') // 6×4: tiles c-10..c-5 × c+6..c+9
  for (let dj = 0; dj < 4; dj++) for (let di = 0; di < 6; di++) check(s.entAt(c - 10 + di, c + 6 + dj)?.kind === 'greenhouse', 'greenhouse footprint')
  check(s.entAt(c - 4, c + 6)?.kind !== 'greenhouse' && s.entAt(c - 10, c + 10)?.kind !== 'greenhouse', 'greenhouse footprint ends')
  check(s.placeError('solar', c - 5, c + 9) === 'Tile is taken' && s.placeError('solar', c - 6, c + 8) === 'Tile is taken', 'overlap allowed')
  check(!s.placeError('solar', c - 4, c + 6) && s.placeError('lab', c - 1, c + 1) === 'Tile is taken', 'neighbour placement')
}

// belts plug into any side: a belt beside a machine pointing away is an outlet, one pointing in feeds it,
// one running past along the edge is neither; several outlets take turns
{
  const s = clean()
  must(s.place('kiln', c + 8, c + 8, 0), 'kiln') // 4×4: tiles c+8..c+11
  check(Sim.sideOf(s.entAt(c + 8, c + 8)!, c + 12, c + 9) === 0 && Sim.sideOf(s.entAt(c + 8, c + 8)!, c + 12, c + 12) === null, 'sideOf')
  must(s.place('belt', c + 12, c + 9, 0), 'east, pointing away')
  must(s.place('belt', c + 9, c + 12, 1), 'south, pointing away')
  must(s.place('belt', c + 7, c + 9, 1), 'west, running past')
  must(s.place('belt', c + 9, c + 7, 1), 'north, pointing in')
  s.ensureBelts()
  const kiln = s.entAt(c + 8, c + 8)!
  check(!s.entAt(c + 12, c + 9)!.capStart && !s.entAt(c + 9, c + 12)!.capStart, 'belts pointing away should be fed by the kiln')
  check(s.entAt(c + 7, c + 9)!.capStart, 'a belt running past the edge is not an outlet')
  check(!s.entAt(c + 9, c + 7)!.capEnd, 'belt into an edge tile docks')
  check(s.outletsOf(kiln).length === 2, `kiln outlets ${s.outletsOf(kiln).length}`)
  s.entAt(c + 9, c + 7)!.items.push({ item: 'regolith', pos: 0.9 })
  s.step(0.1)
  check(kiln.inBuf.regolith === 1, 'regolith should enter the kiln through its top edge')
  // both outlets share the bricks
  kiln.outBuf.brick = 6
  for (let n = 0; n < 40; n++) s.step(1 / 20)
  const on = (i: number, j: number) => s.entAt(i, j)!.items.length
  check(on(c + 12, c + 9) >= 1 && on(c + 9, c + 12) >= 1, 'bricks should leave by both outlet belts')
}

// touching buildings hand over directly, but only what the neighbour uses
{
  const s = clean()
  for (let k = 0; k < 9; k++) s.ground[(c + 12 + Math.floor(k / 3)) * MAP + c + 12 + (k % 3)] = 'ice'
  must(s.place('drill', c + 12, c + 12, 0), 'drill')
  must(s.place('melter', c + 15, c + 12, 0), 'melter touching the drill')
  must(s.place('kiln', c + 12, c + 15, 0), 'kiln touching the drill (doesn’t use ice)')
  const drill = s.entAt(c + 12, c + 12)!
  check(s.outletsOf(drill).length === 1 && s.outletsOf(drill)[0].kind === 'building', `drill outlets ${JSON.stringify(s.outletsOf(drill))}`)
  drill.outBuf.ice = 3
  for (let n = 0; n < 20; n++) s.step(1 / 20)
  check((s.entAt(c + 15, c + 12)!.inBuf.ice ?? 0) + (s.entAt(c + 15, c + 12)!.crafting ? 1 : 0) >= 1, 'ice should go straight into the touching melter')
  check(!s.entAt(c + 12, c + 15)!.inBuf.ice, 'the kiln must not get ice')
}

// only belts turn
{
  const s = clean()
  must(s.place('kiln', c + 6, c + 6, 0), 'kiln')
  const k = s.entAt(c + 6, c + 6)!
  s.rotate(k)
  check(k.dir === 0, 'buildings should not turn')
}

// metal chain through a 4×4 smelter on the real map: starter ore → smelter → belts → core
const t = new Sim(42)
t.stock.metal = 999
t.stock.brick = 999
must(t.place('excavator', c - 2, c + 15, 3), 'excavator') // touches the smelter's south edge: ore goes straight in
must(t.place('smelter', c - 3, c + 11, 0), 'smelter') // tiles c-3..c × c+11..c+14
must(t.place('belt', c + 1, c + 12, 0), 'out belt') // points away from the smelter's east edge
for (let j = c + 12; j >= c + 5; j--) must(t.place('belt', c + 2, j, 3), `belt ${j}`)
for (let n = 0; n < 20 * 60; n++) t.step(1 / 20)
check(t.delivered.metal >= 3, `metal from 4×4 smelter: ${t.delivered.metal}`)
// habitats house 6, and the greenhouse and washer are available from the start
check(BUILDINGS.habitat.housing === 6 && t.unlocked('greenhouse') && t.unlocked('washer'), 'unlocks/housing')
// a save whose building overlaps another is refunded, not overlapped
const save = t.save()
save.ents.push({ k: 'lab', i: c - 3, j: c + 10, d: 0 })
const metal = t.stock.metal
const back = Sim.load(save)
check(![...back.ents.values()].some((e) => e.kind === 'lab') && back.stock.metal === metal + 15, 'overlapping lab loaded')
console.log('OK footprints · metal from 4×4 smelter:', t.delivered.metal)
