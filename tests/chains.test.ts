import { Sim, CORE_AT } from '@/game/core/sim'
import { SOL } from '@/game/core/data'
// three sols of a small colony on the real seed-42 map: water, metal and bricks into the core
const s = new Sim(42)
const c = CORE_AT
s.stock.metal = 400; s.stock.brick = 200
const P = (k: any, i: number, j: number, d: any) => { const e = s.place(k, c + i, c + j, d); if (e) throw new Error(`${k} ${i},${j}: ${e} (${s.groundAt(c + i, c + j)})`) }
for (let n = 0; n < 8; n++) P('solar', -8 + 2 * n, -10, 0)
P('battery', -8, -12, 0); P('battery', -6, -12, 0)
// water: 2×2 drill → 2×2 melter → belts → core
P('drill', 10, 0, 2); P('melter', 8, 0, 2); for (let i = 7; i >= 3; i--) P('belt', i, 0, 2)
// metal: excavator on the starter ore → 3×3 smelter (outputs east onto (0, 10)) → belts north → core
P('excavator', -2, 12, 3); P('smelter', -3, 9, 0); for (let j = 10; j >= 3; j--) P('belt', 0, j, 3)
// bricks: excavator on sand → 3×3 kiln (outputs west onto (3, 4)) → belts → core
P('excavator', 5, 6, 3); P('kiln', 4, 3, 2); P('belt', 3, 4, 2); P('belt', 2, 4, 3); P('belt', 2, 3, 3)
P('moxie', -4, 0, 0); P('lab', -7, 3, 0)
for (let n = 0; n < 20 * SOL * 3; n++) s.step(1 / 20)
console.log('delivered', s.delivered)
console.log('stock', Object.fromEntries(Object.entries(s.stock).map(([k, v]) => [k, Math.round(v)])))
console.log('mission', s.mission, 'health', s.health.toFixed(0), 'colonists', s.colonists, 'rp', s.rp.toFixed(0), 'done', [...s.done], 'short', [...s.shortages])
console.log([...s.ents.values()].filter((e) => e.kind !== 'belt' && e.kind !== 'solar').map((e) => `${e.kind}:${e.status}`).join(' '))
for (const k of ['water', 'metal', 'brick'] as const) if (s.delivered[k] < 10) throw new Error(`${k} delivered ${s.delivered[k]}`)
if (s.health < 50) throw new Error(`colony health ${s.health}`)
console.log('OK chains: water', s.delivered.water, 'metal', s.delivered.metal, 'brick', s.delivered.brick)
