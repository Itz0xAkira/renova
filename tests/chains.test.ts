import { Sim, CORE_AT } from '@/game/core/sim'
import { SOL } from '@/game/core/data'
// three sols of a small colony on the real seed-42 map: water, metal and bricks into the core
const s = new Sim(42)
const c = CORE_AT
s.stock.metal = 400; s.stock.brick = 200
const P = (k: any, i: number, j: number, d: any) => { const e = s.place(k, c + i, c + j, d); if (e) throw new Error(`${k} ${i},${j}: ${e} (${s.groundAt(c + i, c + j)})`) }
for (let n = 0; n < 8; n++) P('solar', -8 + 2 * n, -10, 0)
P('battery', -8, -13, 0); P('battery', -5, -13, 0)
// water: 3×3 drill touching a 3×3 melter → a belt pointing away west → core
P('drill', 13, -1, 2); P('melter', 10, -1, 2); for (let i = 9; i >= 5; i--) P('belt', i, 0, 2)
// metal: excavator on the starter ore, touching a 4×4 smelter → a belt pointing away east → belts north → core
P('excavator', -2, 15, 3); P('smelter', -3, 11, 0); P('belt', 1, 12, 0); for (let j = 12; j >= 5; j--) P('belt', 2, j, 3)
// bricks: excavator on sand, touching a 4×4 kiln → a belt pointing away west → belts → core
P('excavator', 7, 9, 3); P('kiln', 6, 5, 2); P('belt', 5, 6, 2); P('belt', 4, 6, 3); P('belt', 4, 5, 3)
P('moxie', -5, 0, 0); P('lab', -8, 3, 0)
for (let n = 0; n < 20 * SOL * 3; n++) s.step(1 / 20)
console.log('delivered', s.delivered)
console.log('stock', Object.fromEntries(Object.entries(s.stock).map(([k, v]) => [k, Math.round(v)])))
console.log('mission', s.mission, 'health', s.health.toFixed(0), 'colonists', s.colonists, 'rp', s.rp.toFixed(0), 'done', [...s.done], 'short', [...s.shortages])
console.log([...s.ents.values()].filter((e) => e.kind !== 'belt' && e.kind !== 'solar').map((e) => `${e.kind}:${e.status}`).join(' '))
for (const k of ['water', 'metal', 'brick'] as const) if (s.delivered[k] < 10) throw new Error(`${k} delivered ${s.delivered[k]}`)
if (s.health < 50) throw new Error(`colony health ${s.health}`)
console.log('OK chains: water', s.delivered.water, 'metal', s.delivered.metal, 'brick', s.delivered.brick)
