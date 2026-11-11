import { MAP, type Ground, type ItemId } from '@/game/core/data'
import { c, check, clean, must, run } from './helpers'

// statuses: wrong ground is not overwritten; off-grid batteries and pylons say so
{
  const s = clean()
  must(s.place('excavator', c + 5, c + 5, 0))
  s.entAt(c + 5, c + 5)!.mineItem = null // as if the ground under it had changed
  must(s.place('battery', c + 30, c, 0))
  must(s.place('pylon', c + 30, c + 5, 0))
  must(s.place('battery', c + 4, c - 4, 0))
  run(s, 1)
  check(s.entAt(c + 5, c + 5)!.status === 'badground', `miner status ${s.entAt(c + 5, c + 5)!.status}`)
  check(s.entAt(c + 30, c)!.status === 'nogrid' && s.entAt(c + 30, c + 5)!.status === 'nogrid', 'off-grid battery/pylon should be nogrid')
  check(s.entAt(c + 4, c - 4)!.status === 'ok', 'connected battery ok')
}

// one mixed belt carrying both washer ingredients can't jam it
{
  const s = clean()
  s.time = 24
  for (let k = 0; k < 6; k++) must(s.place('solar', c - 8 + 2 * k, c - 8, 0))
  must(s.place('washer', c + 4, c, 0)) // 3×3, fed from above
  for (let j = c - 6; j <= c - 1; j++) must(s.place('belt', c + 4, j, 1))
  const seq: ItemId[] = ['regolith', 'regolith', 'regolith', 'regolith', 'regolith', 'water', 'water', 'water', 'water', 'water']
  let n = 0
  for (let k = 0; k < 20 * 60; k++) {
    const head = s.entAt(c + 4, c - 6)!
    if (n < seq.length && !head.items.some((it) => it.pos < 0.31)) head.items.push({ item: seq[n++], pos: 0 })
    s.step(1 / 20)
  }
  const w = s.entAt(c + 4, c)!
  const left = (w.inBuf.regolith ?? 0) + (w.inBuf.water ?? 0)
  const made = (w.outBuf.soil ?? 0) + s.delivered.soil + (w.crafting ? 1 : 0)
  check(n === seq.length && made === 5 && left === 0, `mixed belt jammed: made ${made}, buffered ${JSON.stringify(w.inBuf)}`)
  // with both ingredients present, the normal 3-craft buffer cap applies again
  w.inBuf = { regolith: 3, water: 3 }
  check(!(s as any).accepts(w, 'regolith'), 'cap should apply while the machine has everything it needs')
}

// finished goods never push the output buffer past its cap
{
  const s = clean()
  s.time = 24
  for (let k = 0; k < 6; k++) must(s.place('solar', c - 8 + 2 * k, c - 8, 0))
  must(s.place('greenhouse', c + 4, c + 4, 0)) // 4×3; output faces empty ground: nothing leaves
  const g = s.entAt(c + 4, c + 4)!
  let peak = 0
  for (let k = 0; k < 20 * 120; k++) {
    g.inBuf.soil = 6
    g.inBuf.water = 9
    s.step(1 / 20)
    peak = Math.max(peak, (g.outBuf.food ?? 0))
  }
  check(peak === 4 && g.status === 'blocked', `greenhouse output peaked at ${peak} (${g.status})`)
}

// 2×2 miners on mixed ground: they work if any tile is minable and dig the most common one
{
  const s = clean()
  const paint = (i: number, j: number, g: Ground[]) => g.forEach((t, k) => (s.ground[(j + (k >> 1)) * MAP + i + (k & 1)] = t as Ground))
  paint(c + 6, c + 6, ['ice', 'sand', 'sand', 'sand']) // one ice tile is enough for a drill
  must(s.place('drill', c + 6, c + 6, 0), 'drill on one ice tile')
  check(s.entAt(c + 6, c + 6)!.mineItem === 'ice', 'drill digs ice')
  paint(c + 9, c + 6, ['sand', 'sand', 'sand', 'rock'])
  check(s.placeError('drill', c + 9, c + 6) === 'Boulder in the way', 'boulders still block')
  paint(c + 9, c + 9, ['sand', 'sand', 'sand', 'sand'])
  check(s.placeError('drill', c + 9, c + 9) === 'Ice drills need an ice deposit', 'a drill needs at least one ice tile')
  paint(c + 12, c + 6, ['ore', 'ore', 'ore', 'sand'])
  must(s.place('excavator', c + 12, c + 6, 0), 'excavator on mostly ore')
  check(s.entAt(c + 12, c + 6)!.mineItem === 'ore', 'excavator digs the most common ground (ore)')
  paint(c + 12, c + 9, ['sand', 'sand', 'sand', 'ore'])
  must(s.place('excavator', c + 12, c + 9, 0), 'excavator on mostly sand')
  check(s.entAt(c + 12, c + 9)!.mineItem === 'regolith', 'excavator digs the most common ground (sand)')
  paint(c + 12, c + 12, ['sand', 'ore', 'ore', 'sand'])
  check(s.mineItemAt('excavator', c + 12, c + 12) === 'ore', 'a tie goes to ore')
  paint(c + 15, c + 6, ['ice', 'ice', 'ice', 'ice'])
  check(s.placeError('excavator', c + 15, c + 6) === 'Excavators need sand or ore', 'excavator on pure ice')
  run(s, 6)
  check((s.entAt(c + 6, c + 6)!.outBuf.ice ?? 0) >= 1 && s.entAt(c + 6, c + 6)!.status !== 'badground', 'mixed-ground drill works')
}

console.log('OK machines: statuses, mixed belts never jam, output cap respected')
