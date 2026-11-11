import { Sim, CORE_AT as c } from '@/game/core/sim'
// a 2×2 drill outputs south onto a belt that turns the corner and runs west into the core
const s = new Sim(42)
s.stock.metal = 500
const P = (k: any, i: number, j: number, d: any) => { const e = s.place(k, i, j, d); if (e) throw new Error(`${k} ${i},${j}: ${e}`) }
P('drill', c + 10, c, 1) // tiles c+10..c+11 × c..c+1; outputs south onto (c+10, c+2)
P('belt', c + 10, c + 2, 2) // fed from the north side → corner
for (let i = c + 9; i >= c + 3; i--) P('belt', i, c + 2, 2) // → core tile (c+2, c+2)
P('belt', c + 5, c + 6, 0) // lone belt: both ends open
s.ensureBelts()
const show = (i: number, j: number) => { const e = s.entAt(i, j)!; return `${i - c},${j - c} dir${e.dir} curve=${e.curve} capStart=${e.capStart} capEnd=${e.capEnd}` }
console.log(show(c + 10, c + 2)); console.log(show(c + 9, c + 2)); console.log(show(c + 3, c + 2)); console.log(show(c + 5, c + 6))
for (let n = 0; n < 20 * 30; n++) s.step(1 / 20)
console.log('ice delivered', s.delivered.ice)
if (!(s.delivered.ice > 3)) throw new Error('items did not flow round the corner')
const corner = s.entAt(c + 10, c + 2)!
if (corner.curve !== 3 || corner.capStart) throw new Error('corner not detected')
if (s.entAt(c + 3, c + 2)!.capEnd) throw new Error('belt into the core should not be capped')
if (!s.entAt(c + 5, c + 6)!.capStart || !s.entAt(c + 5, c + 6)!.capEnd) throw new Error('lone belt caps wrong')
console.log('OK')
