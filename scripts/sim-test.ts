import { Sim, CORE_AT } from '../src/game/sim'
const s = new Sim(42)
const c = CORE_AT
const must = (e: string | null, what: string) => { if (e) throw new Error(what + ': ' + e) }
console.log('ground at drill', s.groundAt(c + 6, c))
must(s.place('solar', c - 3, c - 3, 0), 'solar1')
must(s.place('solar', c - 2, c - 3, 0), 'solar2')
must(s.place('solar', c - 1, c - 3, 0), 'solar3')
must(s.place('drill', c + 6, c, 2), 'drill')
must(s.place('melter', c + 5, c, 2), 'melter')
for (let i = c + 4; i >= c + 2; i--) must(s.place('belt', i, c, 2), 'belt ' + i)
for (let n = 0; n < 20 * 120; n++) s.step(1 / 20)
const ents = [...s.ents.values()].map((e) => `${e.kind}:${e.status}:${JSON.stringify(e.outBuf)}:${e.items.length}`)
console.log(ents.join('\n'))
console.log('delivered', s.delivered, 'stock water', s.stock.water.toFixed(1), 'o2', s.stock.o2.toFixed(1))
console.log('power', s.power, 'mission', s.mission, 'health', s.health.toFixed(1), 'rp', s.rp.toFixed(1))
console.log(s.messages.map((m) => m.text).join('\n'))
const saved = JSON.stringify(s.save()); const s2 = Sim.load(JSON.parse(saved)); console.log('reload ents', s2.ents.size, 'vs', s.ents.size)
