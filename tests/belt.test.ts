import { Sim, CORE_AT as c } from '@/game/core/sim'
// a 3×3 drill puts ice on a belt pointing away from it (south), which turns the corner, runs west and up into the core
const s = new Sim(42)
s.stock.metal = 500
const P = (k: any, i: number, j: number, d: any) => { const e = s.place(k, i, j, d); if (e) throw new Error(`${k} ${i},${j}: ${e}`) }
P('drill', c + 12, c + 1, 1) // tiles c+12..c+14 × c+1..c+3; outputs south below its middle column
P('belt', c + 13, c + 4, 1) // points away from the drill's south edge: the drill's outlet
P('belt', c + 13, c + 5, 2) // fed from the north side → corner
for (let i = c + 12; i >= c + 5; i--) P('belt', i, c + 5, 2)
P('belt', c + 4, c + 5, 3) // fed from the east side → corner, up into core tile (c+4, c+4)
P('belt', c + 7, c + 8, 0) // lone belt: both ends open
s.ensureBelts()
const show = (i: number, j: number) => { const e = s.entAt(i, j)!; return `${i - c},${j - c} dir${e.dir} curve=${e.curve} capStart=${e.capStart} capEnd=${e.capEnd}` }
console.log(show(c + 13, c + 5)); console.log(show(c + 12, c + 5)); console.log(show(c + 4, c + 5)); console.log(show(c + 7, c + 8))
for (let n = 0; n < 20 * 30; n++) s.step(1 / 20)
console.log('ice delivered', s.delivered.ice)
if (!(s.delivered.ice > 3)) throw new Error('items did not flow round the corner')
const corner = s.entAt(c + 13, c + 5)!
if (corner.curve !== 3 || corner.capStart) throw new Error('corner not detected')
if (s.entAt(c + 4, c + 5)!.capEnd) throw new Error('belt into the core should not be capped')
if (s.entAt(c + 13, c + 4)!.capStart) throw new Error('belt pointing away from the drill should be fed by it')
if (!s.entAt(c + 7, c + 8)!.capStart || !s.entAt(c + 7, c + 8)!.capEnd) throw new Error('lone belt caps wrong')
console.log('OK')
