/**
 * Belt flow under stress: throughput, compression without gaps, spacing at tile edges,
 * fair merging (T, Y, 4-way), junction crossings, conservation on random networks and
 * loops, refunds on removal, the atomic junction swap, and jam detection.
 */
import type { Ent, Sim } from '@/game/core/sim'
import { DI, DJ, type Dir, type ItemId } from '@/game/core/data'
import { check, clean, must } from './helpers'

const GAP = 0.3
const STEP = 1 / 20
/** Belt speed in tiles per second (BELT_SPEED in the sim). */
const SPEED = 1.5
const RATE = SPEED / GAP // items per second on a saturated belt

// an open patch well away from the core
const X = 8
const Y = 8

/** Put an item on the start of belt `b` if there's room. */
function inject(b: Ent, item: ItemId) {
  if (b.items.some((it) => it.pos < GAP - 1e-9)) return false
  b.items.push({ item, pos: 0 })
  return true
}

/** Take whatever has reached the end of belt `b` (a perfect sink). */
function drain(b: Ent, got: Partial<Record<ItemId, number>>) {
  while (b.items.length && b.items[0].pos >= 1) {
    const it = b.items.shift()!
    got[it.item] = (got[it.item] ?? 0) + 1
  }
}

const line = (s: Sim, i0: number, j0: number, n: number, dir: Dir) => {
  const out: Ent[] = []
  for (let k = 0; k < n; k++) {
    const i = i0 + DI[dir] * k
    const j = j0 + DJ[dir] * k
    must(s.place('belt', i, j, dir), `belt ${i},${j}`)
    out.push(s.entAt(i, j)!)
  }
  return out
}

/** Every belt keeps GAP between items, and (unless `edges` is false) across a straight tile edge too. */
function spacingOk(s: Sim, edges = true) {
  for (const b of s.list('belt')) {
    for (let k = 1; k < b.items.length; k++) if (b.items[k - 1].pos - b.items[k].pos < GAP - 1e-6) return `items too close on ${b.i},${b.j}`
    for (const it of b.items) if (it.pos < -1e-9 || it.pos > 1 + 1e-9) return `item out of range on ${b.i},${b.j}`
    const n = s.entAt(b.i + DI[b.dir], b.j + DJ[b.dir])
    if (edges && b.items.length && n && n.kind === 'belt' && n.dir === b.dir && n.items.length) {
      const gap = 1 - b.items[0].pos + n.items[n.items.length - 1].pos
      if (gap < GAP - 1e-6) return `items too close across the edge ${b.i},${b.j} → ${n.i},${n.j}: ${gap.toFixed(3)}`
    }
  }
  for (const jn of s.list('junction')) for (const lane of jn.lanes) for (let k = 1; k < lane.length; k++) if (lane[k - 1].pos - lane[k].pos < GAP - 1e-6) return `items too close in a junction lane`
  return null
}

const onBelts = (s: Sim) => {
  let n = 0
  for (const b of s.list('belt')) n += b.items.length
  for (const jn of s.list('junction')) for (const l of jn.lanes) n += l.length
  return n
}

/* 1 · a saturated straight line delivers at the full rate, and a blocked one packs tight */
{
  const s = clean()
  const belts = line(s, X, Y, 12, 0)
  const got: Partial<Record<ItemId, number>> = {}
  let sent = 0
  let full = 0 // delivered after the line has filled (12 tiles at 1.5 tiles/s ≈ 8 s)
  for (let n = 0; n < 30 / STEP; n++) {
    if (inject(belts[0], 'ice')) sent++
    s.step(STEP)
    const before = got.ice ?? 0
    drain(belts[11], got)
    if (n * STEP >= 10) full += (got.ice ?? 0) - before
    const bad = spacingOk(s)
    check(!bad, `straight line: ${bad}`)
  }
  check(sent === (got.ice ?? 0) + onBelts(s), 'straight line conserves items')
  const rate = full / 20
  check(rate >= RATE * 0.9, `straight line throughput ${rate.toFixed(2)}/s, want ≈${RATE.toFixed(2)}`)

  // block the end: the line fills solid, with no gaps left at tile edges
  const t = clean()
  const bl = line(t, X, Y, 8, 0)
  for (let n = 0; n < 40 / STEP; n++) {
    inject(bl[0], 'ore')
    t.step(STEP)
  }
  const along: number[] = []
  bl.forEach((b, k) => b.items.forEach((it) => along.push(k + it.pos)))
  along.sort((a, b) => a - b)
  for (let k = 1; k < along.length; k++) check(along[k] - along[k - 1] < GAP + 0.06, `blocked line has a gap of ${(along[k] - along[k - 1]).toFixed(2)} tiles`)
  check(bl[7].status === 'blocked', 'the end of a blocked line is jammed')
  check(bl[0].status === 'blocked', 'the whole backed-up line is jammed')
}

/* 2 · a T merge (side into a fed belt) shares the output fairly */
{
  const s = clean()
  const main = line(s, X, Y + 4, 10, 0) // runs +i
  const side = line(s, X + 4, Y, 4, 1) // runs +j into main[4] from the side
  s.ensureBelts()
  const got: Partial<Record<ItemId, number>> = {}
  for (let n = 0; n < 40 / STEP; n++) {
    inject(main[0], 'ice')
    inject(side[0], 'ore')
    s.step(STEP)
    drain(main[9], got)
    const bad = spacingOk(s)
    check(!bad, `T merge: ${bad}`)
  }
  const a = got.ice ?? 0
  const b = got.ore ?? 0
  check(a + b >= RATE * 30, `T merge total ${a + b}`)
  check(Math.min(a, b) / (a + b) > 0.4, `T merge is unfair: main ${a}, side ${b}`)
}

/* 3 · a Y (two sides, nothing behind) shares fairly too */
{
  const s = clean()
  const out = line(s, X + 4, Y + 4, 6, 0)
  const left = line(s, X + 4, Y, 4, 1) // from −j
  const right = line(s, X + 4, Y + 8, 4, 3) // from +j
  s.ensureBelts()
  const got: Partial<Record<ItemId, number>> = {}
  for (let n = 0; n < 40 / STEP; n++) {
    inject(left[0], 'ice')
    inject(right[0], 'ore')
    s.step(STEP)
    drain(out[5], got)
  }
  const a = got.ice ?? 0
  const b = got.ore ?? 0
  check(a + b > 0 && Math.min(a, b) / (a + b) > 0.4, `Y merge is unfair: ${a} vs ${b}`)
}

/* 4 · a 4-way merge: three inputs each get a fair share */
{
  const s = clean()
  const main = line(s, X, Y + 4, 10, 0)
  const sa = line(s, X + 4, Y, 4, 1)
  const sb = line(s, X + 4, Y + 8, 4, 3)
  s.ensureBelts()
  const got: Partial<Record<ItemId, number>> = {}
  for (let n = 0; n < 60 / STEP; n++) {
    inject(main[0], 'ice')
    inject(sa[0], 'ore')
    inject(sb[0], 'regolith')
    s.step(STEP)
    drain(main[9], got)
  }
  const tot = (got.ice ?? 0) + (got.ore ?? 0) + (got.regolith ?? 0)
  for (const k of ['ice', 'ore', 'regolith'] as ItemId[]) check((got[k] ?? 0) / tot > 0.25, `4-way merge starves ${k}: ${JSON.stringify(got)}`)
}

/* 5 · two saturated lines cross through a junction at close to full speed, without mixing */
{
  const s = clean()
  const a = line(s, X, Y + 5, 11, 0)
  // the second line runs across the first: a junction where they meet
  s.remove(X + 5, Y + 5)
  must(s.place('junction', X + 5, Y + 5, 0), 'junction')
  const b = [...line(s, X + 5, Y, 5, 1), ...line(s, X + 5, Y + 6, 5, 1)]
  a.splice(5, 1, s.entAt(X + 5, Y + 5)!)
  const ga: Partial<Record<ItemId, number>> = {}
  const gb: Partial<Record<ItemId, number>> = {}
  for (let n = 0; n < 30 / STEP; n++) {
    inject(a[0], 'ice')
    inject(b[0], 'ore')
    s.step(STEP)
    drain(a[10], ga)
    drain(b[9], gb)
    const bad = spacingOk(s)
    check(!bad, `crossing: ${bad}`)
  }
  check(!ga.ore && !gb.ice, 'lines mixed at the junction')
  // about 7 s to fill 11 tiles, then the full rate through the junction on both lines
  check((ga.ice ?? 0) >= RATE * 20 && (gb.ore ?? 0) >= RATE * 20, `crossing throughput ${ga.ice} / ${gb.ore}`)
}

/* 6 · random networks never lose, duplicate or squash items */
for (const seed of [1, 2, 3, 4, 5, 6]) {
  const s = clean(seed)
  let r = seed * 9301 + 49297
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280)
  for (let j = Y; j < Y + 12; j++)
    for (let i = X; i < X + 12; i++) {
      const x = rnd()
      if (x < 0.62) s.place('belt', i, j, Math.floor(rnd() * 4) as Dir)
      else if (x < 0.7) s.place('junction', i, j, 0)
    }
  const belts = s.list('belt')
  let sent = 0
  let rotated = -99
  for (let n = 0; n < 30 / STEP; n++) {
    // items arrive where lines start, as they would from a machine
    if (n % 3 === 0) {
      s.ensureBelts()
      const starts = belts.filter((b) => s.ents.has(b.id) && b.inMask === 0)
      const b = starts[Math.floor(rnd() * starts.length)]
      if (b && inject(b, rnd() < 0.5 ? 'ice' : 'ore')) sent++
    }
    // now and then turn a belt, as a player would
    if (n % 97 === 0) {
      const b = belts[Math.floor(rnd() * belts.length)]
      if (s.ents.has(b.id)) s.rotate(b)
      rotated = n
    }
    s.step(STEP)
    // turning a belt can put items close across a new edge; give the line a moment to sort itself out
    const bad = spacingOk(s, (n - rotated) * STEP > 2)
    check(!bad, `random network ${seed}: ${bad}`)
  }
  check(onBelts(s) === sent, `random network ${seed}: sent ${sent}, on belts ${onBelts(s)}`)
}

/* 7 · a loop keeps its items circulating (no loss, no deadlock while it has room) */
{
  const s = clean()
  // a 4×4 ring: +i along the top, +j down the right, −i along the bottom, −j up the left
  for (let k = 0; k < 3; k++) {
    must(s.place('belt', X + k, Y, 0), 'ring')
    must(s.place('belt', X + 3, Y + k, 1), 'ring')
    must(s.place('belt', X + 3 - k, Y + 3, 2), 'ring')
    must(s.place('belt', X, Y + 3 - k, 3), 'ring')
  }
  const first = s.entAt(X, Y)!
  for (let n = 0; n < 12; n++) {
    inject(first, 'ice')
    s.step(0.3)
  }
  const n0 = onBelts(s)
  const where = () => s.list('belt').map((b) => b.items.map((it) => it.pos.toFixed(2)).join(',')).join('|')
  const before = where()
  for (let n = 0; n < 5 / STEP; n++) s.step(STEP)
  check(onBelts(s) === n0, 'loop lost items')
  check(where() !== before, 'loop is deadlocked')
  check(!spacingOk(s), `loop: ${spacingOk(s)}`)
}

/* 8 · removing a belt or junction returns what it carried to the core */
{
  const s = clean()
  const [b] = line(s, X, Y, 1, 0)
  b.items.push({ item: 'ore', pos: 0.9 }, { item: 'ore', pos: 0.5 }, { item: 'ice', pos: 0.1 })
  const ore = s.stock.ore
  const ice = s.stock.ice
  s.remove(X, Y)
  check(s.stock.ore === ore + 2 && s.stock.ice === ice + 1, 'removed belt items were lost')
  must(s.place('junction', X, Y, 0), 'junction')
  s.entAt(X, Y)!.lanes[1].push({ item: 'metal', pos: 0.4 })
  const metal = s.stock.metal
  s.remove(X, Y)
  check(s.stock.metal >= metal + 1, 'removed junction items were lost')
}

/* 9 · swapping a belt for a junction keeps its items, and does nothing when it can't */
{
  const s = clean()
  line(s, X, Y, 3, 0)
  const mid = s.entAt(X + 1, Y)!
  mid.items.push({ item: 'ice', pos: 0.8 }, { item: 'ore', pos: 0.4 })
  must(s.replaceWithJunction(X + 1, Y), 'swap')
  const jn = s.entAt(X + 1, Y)!
  check(jn.kind === 'junction' && jn.lanes[0].length === 2, 'junction swap lost items')
  check(jn.lanes[0][0].pos >= jn.lanes[0][1].pos, 'junction lane out of order')

  const t = clean()
  line(t, X, Y, 3, 0)
  t.entAt(X + 1, Y)!.items.push({ item: 'ice', pos: 0.5 })
  t.stock.metal = 0
  t.stock.brick = 0
  check(!!t.replaceWithJunction(X + 1, Y), 'swap should fail without materials')
  const still = t.entAt(X + 1, Y)!
  check(still.kind === 'belt' && still.items.length === 1, 'failed swap changed the belt')
}

/* 10 · a free-running line is never marked jammed */
{
  const s = clean()
  const belts = line(s, X, Y, 6, 0)
  const got = {}
  for (let n = 0; n < 10 / STEP; n++) {
    inject(belts[0], 'ice')
    s.step(STEP)
    drain(belts[5], got)
    check(belts.every((b) => b.status !== 'blocked'), 'a moving line was marked jammed')
  }
}

console.log('OK belt flow: full-rate lines that pack tight, fair T/Y/4-way merges, junction crossings, no loss on random networks and loops, refunds, atomic junction swap, jams')
