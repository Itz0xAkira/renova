import { Sim, CORE_AT } from '@/game/core/sim'
import { SOL } from '@/game/core/data'
const s = new Sim(42)
const c = CORE_AT
s.stock.metal = 400; s.stock.brick = 200
const P = (k: any, i: number, j: number, d: any) => { const e = s.place(k, c + i, c + j, d); if (e) console.log('FAIL', k, i, j, e, s.groundAt(c + i, c + j)) }
for (let n = 0; n < 8; n++) P('solar', -6 + n, -4, 0)
P('battery', -6, -5, 0); P('battery', -5, -5, 0)
// water
P('drill', 6, 0, 2); P('melter', 5, 0, 2); for (let i = 4; i >= 2; i--) P('belt', i, 0, 2)
// metal
P('excavator', -2, 8, 3); P('smelter', -2, 6, 0); for (let j = 6; j >= 2; j--) P('belt', 0, j, 3) // smelter is 2×2
// bricks
P('excavator', 4, 4, 3); P('kiln', 3, 2, 2); P('belt', 2, 2, 3); P('belt', 2, 1, 2) // kiln is 2×2, outputs west
P('moxie', -3, 0, 0); P('lab', -3, 1, 0)
for (let n = 0; n < 20 * SOL * 3; n++) s.step(1 / 20)
console.log('delivered', s.delivered)
console.log('stock', Object.fromEntries(Object.entries(s.stock).map(([k, v]) => [k, Math.round(v)])))
console.log('mission', s.mission, 'health', s.health.toFixed(0), 'colonists', s.colonists, 'rp', s.rp.toFixed(0), 'done', [...s.done], 'short', [...s.shortages])
console.log([...s.ents.values()].filter(e => e.kind !== 'belt' && e.kind !== 'solar').map(e => `${e.kind}:${e.status}`).join(' '))
console.log(s.messages.slice(-8).map(m => m.text).join('\n'))
