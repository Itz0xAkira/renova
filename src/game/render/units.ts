/**
 * Colony life, rendered by the scene:
 * - construction drones hover over the core, fly out to build every new
 *   building, and pave routes once they've worn into roads;
 * - rovers drive between the core and your buildings, preferring roads;
 * - crew walk out to work at buildings by day and head inside at night and
 *   during solar flares.
 * Rovers and crew wear the ground as they go: busy routes become tyre tracks,
 * then roads (stored in the sim, so they're saved). The units themselves are
 * cosmetic and aren't saved.
 */
import Phaser from 'phaser'
import { BUILDINGS, MAP } from '@/game/core/data'
import { CORE_AT, type Ent, type Sim } from '@/game/core/sim'
import { setDep, setTex } from '@/game/render/display'
import { centreX, centreY, DEPTH, unitDepth } from '@/game/render/iso'

/** Ground point under the middle of a building's footprint. */
function footCentre(e: Ent) {
  const fi = e.i + (BUILDINGS[e.kind].w - 1) / 2
  const fj = e.j + (BUILDINGS[e.kind].h - 1) / 2
  return [centreX(fi, fj), centreY(fi, fj)] as const
}

/** Where drones live: the centre of the core's 2×2 footprint. */
const HOME_X = centreX(CORE_AT + 0.5, CORE_AT + 0.5)
const HOME_Y = centreY(CORE_AT + 0.5, CORE_AT + 0.5)

/** Drone landing pads on the core's back sub-tile, as offsets from its footprint centre (ground px), on a 6 px plinth. */
const DRONE_PADS: [number, number][] = [
  [-7, -8],
  [7, -8],
]
const PAD_ALT = 6 + 3
const ROVER_FRAMES = ['rover_0', 'rover_1']
const WALKER_FRAMES = ['walker_0', 'walker_1']

/** Rover charging bays: the open tiles along the core's two front edges. */
export const ROVER_BAYS: [number, number][] = [
  [CORE_AT + 2, CORE_AT],
  [CORE_AT + 2, CORE_AT + 1],
  [CORE_AT, CORE_AT + 2],
  [CORE_AT + 1, CORE_AT + 2],
]
const DRONE_SPEED = 90 // world px per second
const DRONE_ALT = 26
const ROVER_SPEED = 1.5 // tiles per second, off-road
const WALK_SPEED = 0.7
const ROAD_BOOST = 1.6
/** Shadows fall down-right, matching the buildings: offset per px of height. */
const SHADOW_DX = 0.58
const SHADOW_DY = 0.29

type Job = { x: number; y: number; pave?: boolean }

type Drone = {
  img: Phaser.GameObjects.Image
  sh: Phaser.GameObjects.Image
  x: number
  y: number
  alt: number
  state: 'idle' | 'go' | 'work' | 'back'
  job: Job | null
  t: number
  angle: number
}

/** Anything that drives or walks the grid. */
type Mover = {
  img: Phaser.GameObjects.Image
  sh: Phaser.GameObjects.Image
  fi: number
  fj: number
  path: [number, number][]
  wait: number
  toCore: boolean
  /** Walkers only: heading inside to end their shift. */
  leaving?: boolean
  lastTile: number
}

export type Env = { shadowAlpha: number; daytime: boolean; flare: boolean; storm: boolean }

export class Units {
  private drones: Drone[] = []
  private rovers: Mover[] = []
  private crew: Mover[] = []
  private jobs: Job[] = []
  private known = new Set<number>()
  private sparks: Phaser.GameObjects.Image[] = []
  private time = 0

  constructor(private scene: Phaser.Scene) {}

  reset(sim: Sim) {
    for (const u of this.drones) {
      u.img.destroy()
      u.sh.destroy()
    }
    for (const list of [this.rovers, this.crew])
      for (const u of list) {
        u.img.destroy()
        u.sh.destroy()
      }
    for (const s of this.sparks) {
      this.scene.tweens.killTweensOf(s)
      s.destroy()
    }
    this.drones = []
    this.rovers = []
    this.crew = []
    this.sparks = []
    this.jobs = []
    // buildings that already exist (a loaded save) don't need building
    this.known = new Set(sim.ents.keys())
    sim.newRoads.length = 0
  }

  /** Call after the layout changes: queues a drone trip to each brand-new building. */
  noticeBuilds(sim: Sim) {
    for (const e of sim.ents.values()) {
      if (this.known.has(e.id)) continue
      this.known.add(e.id)
      const [x, y] = footCentre(e)
      this.queue({ x, y: y - 6 })
    }
    for (const id of this.known) if (!sim.ents.has(id)) this.known.delete(id)
  }

  /** One trip covers everything close together (a dragged belt line, a stretch of new road). */
  private queue(job: Job) {
    const near = (j: Job | null) => !!j && Math.hypot(j.x - job.x, j.y - job.y) < 40
    if (this.jobs.some(near) || this.drones.some((d) => near(d.job))) return
    this.jobs.push(job)
  }

  update(sim: Sim, dt: number, realDt: number, env: Env) {
    this.time += realDt
    let buildings = 0
    for (const e of sim.ents.values()) if (e.kind !== 'belt' && e.kind !== 'core') buildings++
    while (sim.justUpgraded.length) {
      const e = sim.ents.get(sim.justUpgraded.shift()!)
      if (!e) continue
      const [x, y] = footCentre(e)
      this.queue({ x, y: y - 10 })
    }
    while (sim.newRoads.length) {
      const k = sim.newRoads.shift()!
      const i = k % MAP
      const j = Math.floor(k / MAP)
      this.queue({ x: centreX(i, j), y: centreY(i, j) - 2, pave: true })
    }
    this.ensureDrones(Math.min(6, 2 + Math.floor(buildings / 8)))
    this.ensureMovers(sim, this.rovers, Math.min(4, 1 + Math.floor(buildings / 5)), 'rover')
    // crew go out by day in fair weather; at night, in flares and with nobody left they stay inside
    const outside = sim.colonists > 0 && env.daytime && !env.flare ? Math.min(10, Math.max(1, Math.floor(sim.colonists * 0.4)) - (env.storm ? 1 : 0)) : 0
    this.ensureMovers(sim, this.crew, outside, 'walker')
    this.updateDrones(dt, realDt, env)
    for (const r of this.rovers) this.step(sim, r, dt, ROVER_SPEED, 'rover', env)
    for (const w of this.crew) this.step(sim, w, dt, WALK_SPEED, 'walker', env)
    // walkers who've reached the core at the end of their shift go inside
    for (let k = this.crew.length - 1; k >= 0; k--) {
      const w = this.crew[k]
      if (!w.leaving || w.path.length || w.wait > 0) continue
      w.img.destroy()
      w.sh.destroy()
      this.crew.splice(k, 1)
    }
  }

  /* -------------------------------- drones -------------------------------- */

  private ensureDrones(n: number) {
    const hx = HOME_X
    const hy = HOME_Y
    while (this.drones.length < n) {
      const k = this.drones.length
      this.drones.push({
        img: this.scene.add.image(hx, hy, 'drone_0').setOrigin(11 / 22, 11 / 14).setDepth(DEPTH.air),
        sh: this.scene.add.image(hx, hy, 'drone_shadow').setDepth(DEPTH.unitShadow),
        x: hx,
        y: hy,
        alt: DRONE_ALT + 10,
        state: 'idle',
        job: null,
        t: 0,
        angle: (k / 3) * Math.PI * 2,
      })
    }
  }

  private updateDrones(dt: number, realDt: number, env: Env) {
    const hx = HOME_X
    const hy = HOME_Y
    const frame = `drone_${Math.floor(this.time * 20) % 2}`
    for (let n = 0; n < this.drones.length; n++) {
      const d = this.drones[n]
      if (d.state === 'idle') {
        const job = this.jobs.shift()
        const pad = DRONE_PADS[n]
        if (job) {
          d.job = job
          d.state = 'go'
        } else if (pad) {
          // park on its pad on the core, rotors idling
          const tx = hx + pad[0]
          const ty = hy + pad[1]
          d.x += (tx - d.x) * Math.min(1, dt * 3)
          d.y += (ty - d.y) * Math.min(1, dt * 3)
          const close = Math.hypot(tx - d.x, ty - d.y) < 2
          d.alt += ((close ? PAD_ALT : DRONE_ALT) - d.alt) * Math.min(1, dt * 2.5)
        } else {
          // lazy orbit above the core's pad
          d.angle += dt * 0.9
          const tx = hx + Math.cos(d.angle) * 22
          const ty = hy - 4 + Math.sin(d.angle) * 11
          d.x += (tx - d.x) * Math.min(1, dt * 3)
          d.y += (ty - d.y) * Math.min(1, dt * 3)
          d.alt += (DRONE_ALT + 14 + Math.sin(this.time * 2 + d.angle) * 2 - d.alt) * Math.min(1, dt * 2)
        }
      }
      if (d.state === 'go' || d.state === 'back') {
        const tx = d.state === 'go' ? d.job!.x : hx
        const ty = d.state === 'go' ? d.job!.y : hy
        const dist = Math.hypot(tx - d.x, ty - d.y)
        const step = DRONE_SPEED * dt
        if (dist <= step) {
          d.x = tx
          d.y = ty
          if (d.state === 'go') {
            d.state = 'work'
            d.t = d.job!.pave ? 1.4 : 0.9
          } else d.state = 'idle'
        } else {
          d.x += ((tx - d.x) / dist) * step
          d.y += ((ty - d.y) / dist) * step
        }
        d.alt += (DRONE_ALT - d.alt) * Math.min(1, dt * 3)
      }
      if (d.state === 'work') {
        d.t -= dt
        // paving drones sweep low over the road; builders hover just above the roof
        const low = d.job?.pave ? 10 : DRONE_ALT - 6
        d.alt += (low - d.alt) * Math.min(1, dt * 4)
        if (d.job?.pave) d.x += Math.sin(this.time * 6) * dt * 14
        if (dt > 0 && Math.random() < realDt * 14) this.spark(d.x, d.y - d.alt + 6)
        if (d.t <= 0) {
          d.state = 'back'
          d.job = null
        }
      }
      setTex(d.img, frame).setPosition(Math.round(d.x), Math.round(d.y - d.alt))
      // the higher the drone, the further and fainter its shadow
      d.sh
        .setPosition(Math.round(d.x + d.alt * SHADOW_DX), Math.round(d.y + d.alt * SHADOW_DY))
        .setAlpha(env.shadowAlpha * (1.15 - d.alt / 80))
    }
  }

  private spark(x: number, y: number) {
    const s = this.scene.add.image(x + (Math.random() - 0.5) * 10, y, 'spark').setDepth(DEPTH.air - 1)
    this.sparks.push(s)
    this.scene.tweens.add({
      targets: s,
      y: y + 8 + Math.random() * 6,
      alpha: 0,
      duration: 380,
      onComplete: () => {
        s.destroy()
        const k = this.sparks.indexOf(s)
        if (k >= 0) this.sparks.splice(k, 1)
      },
    })
  }

  /* ------------------------------ ground units ----------------------------- */

  private passable(sim: Sim, i: number, j: number) {
    const g = sim.groundAt(i, j)
    if (!g || g === 'rock' || g === 'crater') return false
    const e = sim.entAt(i, j)
    return !e || e.kind === 'belt' || e.kind === 'junction'
  }

  /**
   * Cheapest route over open ground to any tile in `goals`. Roads cost less
   * than bare ground, so traffic converges onto existing roads and the network
   * grows along the routes the colony actually uses. (Dial's algorithm: edge
   * costs are small integers, so a ring of buckets replaces a priority queue.)
   */
  private route(sim: Sim, si: number, sj: number, goals: Set<number>): [number, number][] | null {
    const N = MAP * MAP
    const dist = new Int32Array(N).fill(0x7fffffff)
    const prev = new Int32Array(N).fill(-1)
    const start = sj * MAP + si
    const buckets: number[][] = [[], [], [], []]
    dist[start] = 0
    buckets[0].push(start)
    let pending = 1
    for (let cur = 0; pending > 0; cur++) {
      const b = buckets[cur % 4]
      while (b.length) {
        const u = b.pop()!
        pending--
        if (dist[u] !== cur) continue
        if (goals.has(u)) {
          const out: [number, number][] = []
          for (let c = u; c !== start; c = prev[c]) out.push([c % MAP, Math.floor(c / MAP)])
          return out.reverse()
        }
        const ui = u % MAP
        const uj = Math.floor(u / MAP)
        for (const [di, dj] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const ni = ui + di
          const nj = uj + dj
          if (ni < 0 || nj < 0 || ni >= MAP || nj >= MAP || !this.passable(sim, ni, nj)) continue
          const v = nj * MAP + ni
          const nd = cur + (sim.roadLevel(ni, nj) === 2 ? 2 : 3)
          if (nd < dist[v]) {
            dist[v] = nd
            prev[v] = u
            buckets[nd % 4].push(v)
            pending++
          }
        }
      }
    }
    return null
  }

  /**
   * Open tiles touching a building (or the core) where a unit can stop.
   * Prefers the two front sides, so a parked unit is never hidden behind
   * (or seemingly perched on top of) the building it's visiting.
   */
  private around(sim: Sim, i0: number, j0: number, w: number, h: number) {
    const front = new Set<number>()
    const back = new Set<number>()
    for (let j = j0 - 1; j <= j0 + h; j++)
      for (let i = i0 - 1; i <= i0 + w; i++) {
        const edge = i === i0 - 1 || j === j0 - 1 || i === i0 + w || j === j0 + h
        const corner = (i === i0 - 1 || i === i0 + w) && (j === j0 - 1 || j === j0 + h)
        if (!edge || corner || !this.passable(sim, i, j)) continue
        ;(i === i0 + w || j === j0 + h ? front : back).add(j * MAP + i)
      }
    return front.size ? front : back
  }

  private ensureMovers(sim: Sim, list: Mover[], n: number, kind: 'rover' | 'walker') {
    // too many walkers: the newest ones end their shift
    if (kind === 'walker') {
      let active = 0
      for (const w of list) if (!w.leaving) active++
      for (let k = list.length - 1; k >= 0 && active > n; k--) {
        const w = list[k]
        if (w.leaving) continue
        w.leaving = true
        w.toCore = true
        w.path = []
        w.wait = 0.2 + Math.random()
        active--
      }
      n = Math.max(n, list.length) // the leavers are still on their way
    }
    while (list.length < n) {
      const spots = [...this.around(sim, CORE_AT, CORE_AT, 2, 2)]
      if (!spots.length) return
      const s = spots[Math.floor(Math.random() * spots.length)]
      const rover = kind === 'rover'
      list.push({
        img: this.scene.add.image(0, 0, rover ? 'rover_0' : 'walker_0').setOrigin(rover ? 11 / 22 : 6 / 12, rover ? 19 / 22 : 13 / 15),
        sh: this.scene.add.image(0, 0, rover ? 'rover_sh' : 'walker_sh').setOrigin(rover ? 11 / 36 : 6 / 22, rover ? 19 / 30 : 13 / 20).setDepth(DEPTH.unitShadow),
        fi: s % MAP,
        fj: Math.floor(s / MAP),
        path: [],
        wait: 0.3 + list.length * 0.7,
        toCore: false,
        lastTile: s,
      })
    }
  }

  private plan(sim: Sim, m: Mover, kind: 'rover' | 'walker') {
    const rover = kind === 'rover'
    const here = [Math.round(m.fi), Math.round(m.fj)] as const
    let goals: Set<number>
    if (m.toCore && rover) {
      // free charging bays first, else anywhere beside the core
      const bays = new Set(ROVER_BAYS.filter(([i, j]) => this.passable(sim, i, j) && !this.rovers.some((r) => r !== m && r.path.length === 0 && Math.round(r.fi) === i && Math.round(r.fj) === j)).map(([i, j]) => j * MAP + i))
      goals = bays.size ? bays : this.around(sim, CORE_AT, CORE_AT, 2, 2)
    } else if (m.toCore || m.leaving) goals = this.around(sim, CORE_AT, CORE_AT, 2, 2)
    else {
      // rovers visit anything; crew favour places people work
      const sites = [...sim.ents.values()].filter(
        (e) => e.kind !== 'belt' && e.kind !== 'core' && (kind === 'rover' || !['solar', 'shield', 'battery'].includes(e.kind)),
      )
      if (!sites.length) {
        // nothing built yet: a short survey trip near the lander
        goals = new Set([(CORE_AT + 3 + Math.floor(Math.random() * 4)) * MAP + CORE_AT - 2 + Math.floor(Math.random() * 6)])
      } else {
        const e = sites[Math.floor(Math.random() * sites.length)]
        goals = this.around(sim, e.i, e.j, BUILDINGS[e.kind].w, BUILDINGS[e.kind].h)
      }
    }
    const path = goals.size ? this.route(sim, here[0], here[1], goals) : null
    m.path = path ?? []
    if (!m.leaving) m.toCore = !m.toCore
    m.wait = path ? 0 : 2
  }

  private step(sim: Sim, m: Mover, dt: number, speed: number, kind: 'rover' | 'walker', env: Env) {
    const rover = kind === 'rover'
    if (!m.path.length) {
      m.wait -= dt
      if (m.wait <= 0 && !(m.leaving && this.atCore(m))) this.plan(sim, m, kind)
    } else {
      const [ti, tj] = m.path[0]
      if (!this.passable(sim, ti, tj)) {
        // something got built in the way: re-route
        m.path = []
        if (!m.leaving) m.toCore = !m.toCore
        m.wait = 0.3
      } else {
        const di = ti - m.fi
        const dj = tj - m.fj
        const dist = Math.hypot(di, dj)
        const onRoad = sim.roadLevel(Math.round(m.fi), Math.round(m.fj)) === 2
        const stepLen = speed * (onRoad ? ROAD_BOOST : 1) * dt
        if (dist <= stepLen) {
          m.fi = ti
          m.fj = tj
          m.path.shift()
          if (!m.path.length) m.wait = rover ? 1.2 + Math.random() : 2.5 + Math.random() * 3
        } else {
          m.fi += (di / dist) * stepLen
          m.fj += (dj / dist) * stepLen
        }
        // wear the ground each time a new tile is entered
        const k = Math.round(m.fj) * MAP + Math.round(m.fi)
        if (k !== m.lastTile) {
          m.lastTile = k
          if (rover || Math.random() < 0.3) sim.addWear(Math.round(m.fi), Math.round(m.fj))
        }
        // screen heading: right for +i / −j, left for −i / +j
        if (dist > 0.01) m.img.setFlipX(di - dj < 0)
      }
    }
    const x = Math.round(centreX(m.fi, m.fj))
    const y = Math.round(centreY(m.fi, m.fj))
    const moving = m.path.length > 0 && dt > 0
    const frame = moving ? Math.floor(this.time * (rover ? 8 : 5)) % 2 : 0
    setTex(m.img, rover ? ROVER_FRAMES[frame] : WALKER_FRAMES[frame]).setPosition(x, y)
    setDep(m.img, unitDepth(m.fi, m.fj))
    m.sh.setPosition(x, y).setAlpha(env.shadowAlpha)
  }

  private atCore(m: Mover) {
    return Math.abs(m.fi - (CORE_AT + 0.5)) <= 2 && Math.abs(m.fj - (CORE_AT + 0.5)) <= 2
  }
}
