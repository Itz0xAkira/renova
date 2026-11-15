import { Sim, CORE_AT as c } from '@/game/core/sim'
import { MAP, SOLAR_KW } from '@/game/core/data'
const must = (e: string | null, w: string) => {
  if (e) throw new Error(`${w}: ${e}`)
}
const s = new Sim(42)
s.stock.metal = 5000
s.stock.brick = 5000
for (let j = 0; j < MAP; j++) for (let i = 0; i < MAP; i++) if (s.ground[j * MAP + i] !== 'ice' && s.ground[j * MAP + i] !== 'ore') s.ground[j * MAP + i] = 'sand'
// a 4×4 lab far outside the core's 12-tile reach is not connected…
const far = c + 20
must(s.place('lab', far, c, 0), 'lab')
s.ensureGrid()
const lab = s.entAt(far, c)!
if (lab.onGrid) throw new Error('far lab should be off grid')
s.step(0.05)
if (lab.status !== 'nogrid') throw new Error(`status ${lab.status}`)
// …until a line of pylons carries power out to it
for (let i = c + 11; i <= far - 2; i += 6) must(s.place('pylon', i, c - 2, 0), `pylon ${i}`)
s.ensureGrid()
if (!lab.onGrid) throw new Error('pylons should connect the lab')
if (s.links.length < 2) throw new Error('expected cable links')
// life support is served first: with too little power the crew module runs, industry starves
const t = new Sim(42)
t.time = 14 + 120 * 0.5 // night: no solar at all
t.reserve = 0
t.stock.metal = 999
t.stock.brick = 999
for (let j = 0; j < MAP; j++) for (let i = 0; i < MAP; i++) t.ground[j * MAP + i] = 'sand'
must(t.place('moxie', c - 4, c, 0), 'moxie')
must(t.place('lab', c + 5, c + 5, 0), 'lab')
t.reserve = 2 // a trickle of stored power
t.step(0.05)
if (!(t.power.lifeSat > t.power.indSat)) throw new Error(`priority: life ${t.power.lifeSat} ind ${t.power.indSat}`)
// upgrades: a solar panel becomes an array, then a station that plants panels
const u = new Sim(7)
u.stock.metal = 5000
u.stock.brick = 5000
for (let j = 0; j < MAP; j++) for (let i = 0; i < MAP; i++) u.ground[j * MAP + i] = 'sand'
must(u.place('solar', c + 6, c + 6, 0), 'solar')
const sp = u.entAt(c + 6, c + 6)!
must(u.upgrade(sp), 'to array')
must(u.upgrade(sp), 'to station')
if (sp.level !== 3 || u.upgrade(sp) === null) throw new Error('max level')
const before = u.count('solar')
for (let n = 0; n < 20 * 80; n++) u.step(1 / 20)
const after = u.count('solar')
if (after <= before) throw new Error('station planted nothing')
// upgraded panels make more power, and levels survive saving
u.time = 24 + 240 // noon
u.step(0.05)
if (!(u.sun() > 0.9) || Math.abs(u.power.solar - SOLAR_KW[0] * u.sun()) > 0.01) throw new Error('solar per panel')
if (Math.abs(u.genKW(sp) - SOLAR_KW[2] * u.sun()) > 0.01) throw new Error('station output')
const back = Sim.load(JSON.parse(JSON.stringify(u.save())))
if (back.entAt(c + 6, c + 6)!.level !== 3) throw new Error('level not saved')
console.log(`OK power grid, priority and upgrades · station planted ${after - before} panels`)
