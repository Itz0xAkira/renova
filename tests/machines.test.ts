import type { ItemId } from '@/game/core/data'
import { c, check, clean, must, run } from './helpers'

// statuses: wrong ground is not overwritten; off-grid batteries and pylons say so
{
  const s = clean()
  must(s.place('excavator', c + 4, c + 4, 0))
  s.entAt(c + 4, c + 4)!.mineItem = null // as if the ground under it had changed
  must(s.place('battery', c + 25, c, 0))
  must(s.place('pylon', c + 25, c + 5, 0))
  must(s.place('battery', c + 3, c - 3, 0))
  run(s, 1)
  check(s.entAt(c + 4, c + 4)!.status === 'badground', `miner status ${s.entAt(c + 4, c + 4)!.status}`)
  check(s.entAt(c + 25, c)!.status === 'nogrid' && s.entAt(c + 25, c + 5)!.status === 'nogrid', 'off-grid battery/pylon should be nogrid')
  check(s.entAt(c + 3, c - 3)!.status === 'ok', 'connected battery ok')
}

// one mixed belt carrying both washer ingredients can't jam it
{
  const s = clean()
  s.time = 24
  for (let k = 0; k < 6; k++) must(s.place('solar', c - 4 + k, c - 4, 0))
  must(s.place('washer', c + 4, c, 0))
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
  for (let k = 0; k < 6; k++) must(s.place('solar', c - 4 + k, c - 4, 0))
  must(s.place('greenhouse', c + 4, c + 3, 0)) // output faces empty ground: nothing leaves
  const g = s.entAt(c + 4, c + 3)!
  let peak = 0
  for (let k = 0; k < 20 * 120; k++) {
    g.inBuf.soil = 6
    g.inBuf.water = 9
    s.step(1 / 20)
    peak = Math.max(peak, (g.outBuf.food ?? 0))
  }
  check(peak === 4 && g.status === 'blocked', `greenhouse output peaked at ${peak} (${g.status})`)
}

console.log('OK machines: statuses, mixed belts never jam, output cap respected')
