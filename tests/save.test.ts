import { OutdatedSaveError, Sim, SAVE_VERSION } from '@/game/core/sim'
import { MISSIONS } from '@/game/core/missions'
import { c, check, must, natural, reload, run } from './helpers'

// solar stations remember how many panels they planted
{
  const n = natural(7, 12, 12, true)
  let s = n.s
  const [x, y] = [n.at[0] + 5, n.at[1] + 5]
  must(s.place('solar', x, y, 0))
  const st = s.entAt(x, y)!
  must(s.upgrade(st))
  must(s.upgrade(st))
  run(s, 25 * 10)
  const panels = s.count('solar')
  check(st.planted === 8 && panels === 9, `station planted ${st.planted}`)
  for (let k = 0; k < 2; k++) {
    s = reload(s)
    run(s, 25 * 10)
  }
  check(s.count('solar') === panels, `reloads let the station plant more: ${s.count('solar')}`)
  // the countdown survives too
  const t = natural(7, 12, 12, true).s
  must(t.place('solar', x, y, 0))
  const e = t.entAt(x, y)!
  e.level = 3
  run(t, 10)
  check(Math.abs(reload(t).entAt(x, y)!.plantIn - e.plantIn) < 1e-9, 'plantIn not saved')
}

// live state: belt items (with curves), junction lanes, machine buffers and progress, owed, tips, rng
{
  const { s, at } = natural(42, 10, 10)
  const [x, y] = at
  s.time = 60
  // a 2×2 excavator feeding a line of belts, with a side line merging in
  must(s.place('excavator', x + 8, y + 3, 2)) // outputs west onto (x+7, y+3)
  for (let i = x; i <= x + 7; i++) must(s.place('belt', i, y + 3, 2))
  must(s.place('belt', x + 4, y + 1, 1))
  must(s.place('belt', x + 4, y + 2, 1))
  must(s.place('kiln', x, y + 5, 0))
  must(s.place('junction', x + 6, y + 6, 0))
  run(s, 30)
  const kiln = s.entAt(x, y + 5)!
  kiln.inBuf.regolith = 3
  kiln.crafting = true
  kiln.progress = 0.4
  kiln.outBuf.brick = 2
  s.entAt(x + 6, y + 6)!.lanes[1].push({ item: 'ore', pos: 0.6 })
  s.entAt(x + 4, y + 2)!.items.push({ item: 'ice', pos: 0.2 })
  s.owed.food = 0.7
  const a = s.save()
  const b = reload(s)
  const json = (x: unknown) => JSON.stringify(x)
  check(json(b.save()) === json(a), 'save → load → save is not stable')
  const belts = [...s.ents.values()].filter((e) => e.kind === 'belt' && e.items.length)
  check(belts.length > 0, 'expected belt items in flight')
  for (const e of belts) check(json(b.entAt(e.i, e.j)!.items) === json(e.items), 'belt items not restored')
  const k2 = b.entAt(x, y + 5)!
  check(k2.crafting && k2.progress === 0.4 && k2.inBuf.regolith === 3 && k2.outBuf.brick === 2, 'machine state not restored')
  check(b.entAt(x + 6, y + 6)!.lanes[1][0].item === 'ore', 'junction lanes not restored')
  check(b.owed.food === 0.7, 'owed not restored')
  check(json(b.save().tips) === json(a.tips), 'tips not restored')
  check(s.rng() === b.rng() && s.rng() === b.rng(), 'rng sequence does not continue after load')
  check(a.v === SAVE_VERSION && typeof a.mission === 'string', 'save version / mission id')
}

// a lost game stays lost
{
  const s = new Sim(42)
  s.stock.food = s.stock.water = s.stock.o2 = 0
  run(s, 600)
  check(s.over === 'lost', 'expected a loss')
  const b = reload(s)
  check(b.over === 'lost' && b.popups.some((p) => p.kind === 'lose'), 'lost game resumed after reload')
  const t0 = b.time
  run(b, 5)
  check(b.time === t0, 'lost game keeps running')
}

// missions are saved by id
{
  const s = new Sim(42)
  s.mission = MISSIONS.findIndex((m) => m.id === 'brick')
  check(reload(s).mission === s.mission, 'mission id round trip')
  s.mission = MISSIONS.length
  check(reload(s).mission === MISSIONS.length, 'all-done round trip')
}

// saves from the old layout (v1: tuples, v2: small buildings on a 64 map) are refused, not migrated
{
  const v1 = { v: 1, seed: 42, time: 100, stock: {}, colonists: 4, health: 90, stored: 4500, rp: 3, done: [], current: 'washing', mission: 5, delivered: {}, ents: [['belt', 33, 33, 0]], ev: {}, won: false }
  const v2 = { ...new Sim(42).save(), v: 2 }
  for (const old of [v1, v2]) {
    let err: unknown = null
    try {
      Sim.load(old)
    } catch (e) {
      err = e
    }
    check(err instanceof OutdatedSaveError && err.version === old.v && err.name === 'OutdatedSaveError', `v${old.v} save should throw OutdatedSaveError`)
  }
  check(SAVE_VERSION === 3, 'save version')
}

// damaged saves load with defaults; hopeless ones throw
{
  const good = new Sim(42).save() as unknown as Record<string, unknown>
  const bad = {
    ...good,
    time: 'soon',
    health: NaN,
    rp: null,
    reserve: Infinity,
    colonists: -3,
    stock: { metal: 'lots', water: 5 },
    done: ['washing', 'teleporters'],
    current: 'teleporters',
    mission: 'no-such-mission',
    ev: { storm: { start: 'x' }, nextShip: NaN },
    ents: [{ k: 'belt', i: c + 4, j: c + 4, d: 9, it: [['unobtanium', 0.5], ['ice', 7]] }, { k: 'core', i: 0, j: 0, d: 0 }, { k: 'warpgate', i: 1, j: 1, d: 0 }, null, 'x'],
    wear: [[5, 300], [-1, 4], 'x'],
  }
  const s = Sim.load(bad)
  run(s, 2)
  check(Number.isFinite(s.time) && s.health === 100 && s.rp >= 0 && s.colonists === 0, 'scalar defaults')
  check(s.stock.water === 5 && s.stock.metal === 100, 'stock defaults')
  check(s.done.size === 1 && s.current === 'leds', `research ids: ${[...s.done]} / ${s.current}`)
  check(s.mission === 0 && s.ev.storm === null && Number.isFinite(s.ev.nextShip), 'mission / events defaults')
  const belt = s.entAt(c + 4, c + 4)!
  check(belt.dir === 0 && belt.items.length === 1 && belt.items[0].pos === 1, 'belt sanitised')
  check(s.wear[5] === 255 && Number.isFinite(s.power.stored) && Number.isFinite(s.power.sat), 'wear / power finite')
  for (const junk of [null, 42, 'save', { v: 4, seed: 1 }, { v: 3 }, { v: 'x', seed: 1 }]) {
    let err: unknown = null
    try {
      Sim.load(junk)
    } catch (e) {
      err = e
    }
    check(err instanceof Error && !(err instanceof OutdatedSaveError), `should throw a plain error on ${JSON.stringify(junk)}`)
  }
}

console.log('OK save v3: stations, live state, lost game, mission ids, old layouts refused, damaged saves')
