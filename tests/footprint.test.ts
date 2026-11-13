import { Sim, CORE_AT as c, CORE_CENTRE } from '@/game/core/sim'
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

// belts plug into any side: a belt beside a machine pointing away is an outlet, one pointing in feeds it,
// one running past along the edge is neither; several outlets take turns
{
  const s = clean()
  must(s.place('kiln', c + 6, c + 6, 0), 'kiln') // 3×3: tiles c+6..c+8
  check(Sim.sideOf(s.entAt(c + 6, c + 6)!, c + 9, c + 7) === 0 && Sim.sideOf(s.entAt(c + 6, c + 6)!, c + 9, c + 9) === null, 'sideOf')
  must(s.place('belt', c + 9, c + 7, 0), 'east, pointing away')
  must(s.place('belt', c + 7, c + 9, 1), 'south, pointing away')
  must(s.place('belt', c + 5, c + 7, 1), 'west, running past')
  must(s.place('belt', c + 7, c + 5, 1), 'north, pointing in')
  s.ensureBelts()
  const kiln = s.entAt(c + 6, c + 6)!
  check(!s.entAt(c + 9, c + 7)!.capStart && !s.entAt(c + 7, c + 9)!.capStart, 'belts pointing away should be fed by the kiln')
  check(s.entAt(c + 5, c + 7)!.capStart, 'a belt running past the edge is not an outlet')
  check(!s.entAt(c + 7, c + 5)!.capEnd, 'belt into an edge tile docks')
  check(s.outletsOf(kiln).length === 2, `kiln outlets ${s.outletsOf(kiln).length}`)
  s.entAt(c + 7, c + 5)!.items.push({ item: 'regolith', pos: 0.9 })
  s.step(0.1)
  check(kiln.inBuf.regolith === 1, 'regolith should enter the kiln through its top edge')
  // both outlets share the bricks
  kiln.outBuf.brick = 6
  for (let n = 0; n < 40; n++) s.step(1 / 20)
  const on = (i: number, j: number) => s.entAt(i, j)!.items.length
  check(on(c + 9, c + 7) >= 1 && on(c + 7, c + 9) >= 1, 'bricks should leave by both outlet belts')
}

// touching buildings hand over directly, but only what the neighbour uses
{
  const s = clean()
  for (let k = 0; k < 4; k++) s.ground[(c + 12 + (k >> 1)) * MAP + c + 12 + (k & 1)] = 'ice'
  must(s.place('drill', c + 12, c + 12, 0), 'drill')
  must(s.place('melter', c + 14, c + 12, 0), 'melter touching the drill')
  must(s.place('kiln', c + 12, c + 14, 0), 'kiln touching the drill (doesn’t use ice)')
  const drill = s.entAt(c + 12, c + 12)!
  check(s.outletsOf(drill).length === 1 && s.outletsOf(drill)[0].kind === 'building', `drill outlets ${JSON.stringify(s.outletsOf(drill))}`)
  drill.outBuf.ice = 3
  for (let n = 0; n < 20; n++) s.step(1 / 20)
  check((s.entAt(c + 14, c + 12)!.inBuf.ice ?? 0) + (s.entAt(c + 14, c + 12)!.crafting ? 1 : 0) >= 1, 'ice should go straight into the touching melter')
  check(!s.entAt(c + 12, c + 14)!.inBuf.ice, 'the kiln must not get ice')
}

// only belts turn
{
  const s = clean()
  must(s.place('kiln', c + 6, c + 6, 0), 'kiln')
  const k = s.entAt(c + 6, c + 6)!
  s.rotate(k)
  check(k.dir === 0, 'buildings should not turn')
}

// metal chain through a 3×3 smelter on the real map: starter ore → smelter → belts → core
const t = new Sim(42)
t.stock.metal = 999
t.stock.brick = 999
must(t.place('excavator', c - 2, c + 12, 3), 'excavator') // touches the smelter's south edge: ore goes straight in
must(t.place('smelter', c - 3, c + 9, 0), 'smelter') // tiles c-3..c-1 × c+9..c+11
must(t.place('belt', c, c + 10, 0), 'out belt') // points away from the smelter's east edge
for (let j = c + 10; j >= c + 3; j--) must(t.place('belt', c + 1, j, 3), `belt ${j}`)
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
