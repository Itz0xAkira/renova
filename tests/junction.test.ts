import { Sim, IN_BACK, IN_N, IN_P } from '@/game/core/sim'
import type { ItemId } from '@/game/core/data'
const must = (e: string | null, w: string) => {
  if (e) throw new Error(`${w}: ${e}`)
}
// a patch of open ground away from the core
const s = new Sim(42)
s.stock.metal = 999
const free = (i: number, j: number) => !s.placeError('belt', i, j)
let O: [number, number] = [0, 0]
search: for (let j = 4; j < 50; j++)
  for (let i = 4; i < 50; i++) {
    let ok = true
    for (let dj = -4; dj <= 4 && ok; dj++) for (let di = -4; di <= 4 && ok; di++) ok = free(i + di, j + dj)
    if (ok) {
      O = [i, j]
      break search
    }
  }
const [x, y] = O
// a 4-end merge: a line running +i with lines joining from both sides
for (let i = x - 3; i <= x + 3; i++) must(s.place('belt', i, y, 0), 'main')
must(s.place('belt', x, y - 2, 1), 'from -j a')
must(s.place('belt', x, y - 1, 1), 'from -j b')
must(s.place('belt', x, y + 2, 3), 'from +j a')
must(s.place('belt', x, y + 1, 3), 'from +j b')
s.ensureBelts()
const m = s.entAt(x, y)!
if (m.inMask !== (IN_BACK | IN_P | IN_N)) throw new Error(`4-end merge mask ${m.inMask}`)
// make it a 3-end (T) merge by removing one side
s.remove(x, y + 1)
s.ensureBelts()
if (s.entAt(x, y)!.inMask !== (IN_BACK | IN_N)) throw new Error(`T merge mask ${s.entAt(x, y)!.inMask}`)
// a Y: two side lines and nothing behind
s.remove(x - 1, y)
s.place('belt', x, y + 1, 3)
s.ensureBelts()
if (s.entAt(x, y)!.inMask !== (IN_P | IN_N)) throw new Error(`Y mask ${s.entAt(x, y)!.inMask}`)
// items from both sides of the Y reach the end of the line
const feed = (i: number, j: number, item: ItemId) => {
  const b = s.entAt(i, j)!
  if (!b.items.length) b.items.push({ item, pos: 0 })
}
for (let n = 0; n < 20 * 20; n++) {
  feed(x, y - 2, 'ice')
  feed(x, y + 2, 'ore')
  s.step(1 / 20)
}
const end = s.entAt(x + 3, y)!
if (!end.items.some((it) => it.item === 'ice') || !end.items.some((it) => it.item === 'ore')) throw new Error('Y did not merge both sides')
// a junction: two lines cross and never mix
const t = new Sim(42)
t.stock.metal = 999
for (let i = x - 3; i <= x + 3; i++) if (i !== x) must(t.place('belt', i, y, 0), 'i line')
for (let j = y - 3; j <= y + 3; j++) if (j !== y) must(t.place('belt', x, j, 1), 'j line')
must(t.place('junction', x, y, 0), 'junction')
for (let n = 0; n < 20 * 20; n++) {
  const a = t.entAt(x - 3, y)!
  const b = t.entAt(x, y - 3)!
  if (!a.items.length) a.items.push({ item: 'ice', pos: 0 })
  if (!b.items.length) b.items.push({ item: 'ore', pos: 0 })
  t.step(1 / 20)
}
const iEnd = t.entAt(x + 3, y)!.items.map((it) => it.item)
const jEnd = t.entAt(x, y + 3)!.items.map((it) => it.item)
if (!iEnd.length || !jEnd.length || iEnd.some((k) => k !== 'ice') || jEnd.some((k) => k !== 'ore')) throw new Error(`junction mixed: ${iEnd} / ${jEnd}`)
t.ensureBelts()
if (t.entAt(x + 1, y)!.capStart || t.entAt(x - 1, y)!.capEnd) throw new Error('belts either side of a junction should read as connected')
console.log('OK merges (T, Y, 4-way) and junction crossing')
