import { Sim, CORE_AT } from '@/game/core/sim'
// first steps on the real seed-42 map: three panels, the starter ice → a melter → belts → the 3×3 core
const s = new Sim(42)
const c = CORE_AT
const must = (e: string | null, what: string) => { if (e) throw new Error(what + ': ' + e) }
must(s.place('solar', c - 6, c - 4, 0), 'solar1')
must(s.place('solar', c - 4, c - 4, 0), 'solar2')
must(s.place('solar', c - 2, c - 4, 0), 'solar3')
must(s.place('drill', c + 10, c, 2), 'drill') // 2×2 on the starter ice, outputs west onto (c+9, c)
must(s.place('melter', c + 8, c, 2), 'melter') // 2×2 at c+8..c+9, outputs west onto (c+7, c)
for (let i = c + 7; i >= c + 3; i--) must(s.place('belt', i, c, 2), 'belt ' + i) // → core's east edge
for (let n = 0; n < 20 * 120; n++) s.step(1 / 20)
console.log([...s.ents.values()].map((e) => `${e.kind}:${e.status}:${JSON.stringify(e.outBuf)}:${e.items.length}`).join('\n'))
console.log('delivered', s.delivered, 'stock water', s.stock.water.toFixed(1), 'o2', s.stock.o2.toFixed(1))
if (s.delivered.water < 10) throw new Error(`water delivered ${s.delivered.water}`)
const s2 = Sim.load(JSON.parse(JSON.stringify(s.save())))
if (s2.ents.size !== s.ents.size) throw new Error(`reload ents ${s2.ents.size} vs ${s.ents.size}`)
console.log('OK basics: drill → melter → core, water delivered', s.delivered.water)
