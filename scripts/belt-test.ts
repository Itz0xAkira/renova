import { Sim, CORE_AT as c } from '../src/game/sim'
// drill → belt east → corner turning north → belt north → core
const s = new Sim(42)
s.stock.metal = 500
const P = (k: any, i: number, j: number, d: any) => { const e = s.place(k, i, j, d); if (e) throw new Error(`${k} ${i},${j}: ${e}`) }
// drill on ice at (c+6, c) outputs west (2); belts go west to x=c+3, then a corner turns... keep simple: L shape into core from below
P('drill', c + 6, c, 1) // outputs south onto (c+6, c+1)
P('belt', c + 6, c + 1, 2) // fed from the north side → corner
for (let i = c + 5; i >= c + 2; i--) P('belt', i, c + 1, 2) // → core at (c+1, c+1)
P('belt', c + 4, c + 4, 0) // lone belt: both ends open
s.ensureBelts()
const show = (i: number, j: number) => { const e = s.entAt(i, j)!; return `${i - c},${j - c} dir${e.dir} curve=${e.curve} capStart=${e.capStart} capEnd=${e.capEnd}` }
console.log(show(c + 6, c + 1)); console.log(show(c + 5, c + 1)); console.log(show(c + 2, c + 1)); console.log(show(c + 4, c + 4))
for (let n = 0; n < 20 * 30; n++) s.step(1 / 20)
console.log('ice delivered', s.delivered.ice)
if (!(s.delivered.ice > 3)) throw new Error('items did not flow round the corner')
const corner = s.entAt(c + 6, c + 1)!
if (corner.curve !== 3 || corner.capStart) throw new Error('corner not detected')
if (!s.entAt(c + 4, c + 4)!.capStart || !s.entAt(c + 4, c + 4)!.capEnd) throw new Error('lone belt caps wrong')
console.log('OK')
