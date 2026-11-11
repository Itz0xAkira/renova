/**
 * Colony life, rendered by the scene:
 * - construction drones hover over the core, fly out to build every new
 *   building, and pave routes once they've worn into roads;
 * - rovers drive between the core and your buildings, preferring roads;
 * - crew walk out to work at buildings by day and head inside at night and
 *   during solar flares.
 * Rovers accelerate and brake, face where they drive, queue behind each other,
 * haul ore home in their hopper, kick up dust off-road, blink a beacon (cyan
 * while charging in a bay) and light the ground ahead at night.
 * Rovers and crew wear the ground as they go: busy routes become tyre tracks,
 * then roads (stored in the sim, so they're saved). The units themselves are
 * cosmetic and aren't saved.
 */
import Phaser from 'phaser'
import { BEAM_AX, BEAM_AY, BEAM_H, BEAM_W, ROVER_HALF_LENGTH, ROVER_AX, ROVER_AY, ROVER_H, ROVER_SH_H, ROVER_SH_W, ROVER_W, ROVER_WHEEL_FRAMES, roverKey, roverPoint } from '@/game/art/sprites'
import { BUILDINGS, MAP, type Dir } from '@/game/core/data'
import type { Ent, Sim } from '@/game/core/sim'
import { CORE_PLINTH, coreLayout, nearCore, type CoreLayout } from '@/game/render/coreLayout'
import { setDep, setTex } from '@/game/render/display'
import { centreX, centreY, DEPTH, depthFor, inFront, screenOverlap, unitDepth, type Box } from '@/game/render/iso'

/** Ground point under the middle of a building's footprint. */
function footCentre(e: Ent) {
  const fi = e.i + (BUILDINGS[e.kind].w - 1) / 2
  const fj = e.j + (BUILDINGS[e.kind].h - 1) / 2
  return [centreX(fi, fj), centreY(fi, fj)] as const
}

/** Drones settle on their pads this high: the core's plinth plus their landing legs. */
const PAD_LIFT = 3
const WALKER_FRAMES = ['walker_0', 'walker_1']
/** Half the rover's width across its heading, in tiles. */
const ROVER_HALF_WIDTH = 0.3
const WALKER_HALF = 0.2
/** A parked rover nose-to a building backs off this far, so it never pokes into the footprint. */
const PARK_BACKOFF = ROVER_HALF_LENGTH - 0.45
const DIR_I = [1, 0, -1, 0] as const
const DIR_J = [0, 1, 0, -1] as const
const DRONE_SPEED = 90 // world px per second
const DRONE_ALT = 26
const ROVER_SPEED = 1.5 // tiles per second, off-road
const ROVER_ACCEL = 2.2 // tiles per second², speeding up
const ROVER_BRAKE = 3 // tiles per second², slowing for a stop or a turn
/** How fast the wheels turn: wheel frames per tile driven. */
const WHEEL_FRAMES_PER_TILE = 9
const MAX_ROVERS = 6
const DUST_POOL = 48
const BEACON_AMBER = 0xffb347
const BEACON_CYAN = 0x65c9e8
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
  /** Rovers only. */
  rover?: RoverState
  /** Cached draw order, and what it was worked out for. */
  depth: number
  depthAt: { fi: number; fj: number; dir: number; rev: number }
}

type RoverState = {
  beacon: Phaser.GameObjects.Image
  beam: Phaser.GameObjects.Image
  dir: Dir
  /** Current speed, tiles per second. */
  v: number
  /** Distance driven, for turning the wheels. */
  odo: number
  /** Hauling ore home. */
  loaded: boolean
  /** Seconds spent waiting for another rover to clear the way. */
  blocked: number
  dust: number
  phase: number
}

export type Env = { shadowAlpha: number; daytime: boolean; flare: boolean; storm: boolean; /** 0 by day … 1 at full night. */ night: number }

export class Units {
  private drones: Drone[] = []
  private rovers: Mover[] = []
  private crew: Mover[] = []
  private jobs: Job[] = []
  private known = new Set<number>()
  private sparks: Phaser.GameObjects.Image[] = []
  private dust: { img: Phaser.GameObjects.Image; t: number; life: number; vx: number; vy: number }[] = []
  private time = 0
  /** The colony core's footprint, pads and bays, for the current sim. */
  private core!: CoreLayout
  private seen = new Set<number>()

  constructor(private scene: Phaser.Scene) {}

  /** Rover charging bays along the core's front edges (drawn on the ground by the scene). */
  get bays() {
    return this.core.bays
  }

  reset(sim: Sim) {
    this.core = coreLayout(sim.core)
    for (const u of this.drones) {
      u.img.destroy()
      u.sh.destroy()
    }
    for (const list of [this.rovers, this.crew]) for (const u of list) this.destroyMover(u)
    for (const d of this.dust) d.img.destroy()
    this.dust = []
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
    this.ensureMovers(sim, this.rovers, Math.min(MAX_ROVERS, 1 + Math.floor(buildings / 5)), 'rover')
    // crew go out by day in fair weather; at night, in flares and with nobody left they stay inside
    const outside = sim.colonists > 0 && env.daytime && !env.flare ? Math.min(10, Math.max(1, Math.floor(sim.colonists * 0.4)) - (env.storm ? 1 : 0)) : 0
    this.ensureMovers(sim, this.crew, outside, 'walker')
    this.updateDrones(dt, realDt, env)
    for (const r of this.rovers) this.driveRover(sim, r, dt, env)
    for (const w of this.crew) this.step(sim, w, dt, WALK_SPEED, 'walker', env)
    this.updateDust(realDt)
    // walkers who've reached the core at the end of their shift go inside
    for (let k = this.crew.length - 1; k >= 0; k--) {
      const w = this.crew[k]
      if (!w.leaving || w.path.length || w.wait > 0) continue
      this.destroyMover(w)
      this.crew.splice(k, 1)
    }
  }

  /* -------------------------------- drones -------------------------------- */

  private ensureDrones(n: number) {
    const [hx, hy] = this.core.centre
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
    const [hx, hy] = this.core.centre
    // the idle orbit scales with the core
    const orbit = (this.core.w + this.core.h) * 5.5
    const frame = `drone_${Math.floor(this.time * 20) % 2}`
    for (let n = 0; n < this.drones.length; n++) {
      const d = this.drones[n]
      if (d.state === 'idle') {
        const job = this.jobs.shift()
        const pad = this.core.pads[n]
        if (job) {
          d.job = job
          d.state = 'go'
        } else if (pad) {
          // park on its pad on the core, rotors idling
          const [tx, ty] = pad
          d.x += (tx - d.x) * Math.min(1, dt * 3)
          d.y += (ty - d.y) * Math.min(1, dt * 3)
          const close = Math.hypot(tx - d.x, ty - d.y) < 2
          d.alt += ((close ? CORE_PLINTH + PAD_LIFT : DRONE_ALT) - d.alt) * Math.min(1, dt * 2.5)
        } else {
          // lazy orbit above the core
          d.angle += dt * 0.9
          const tx = hx + Math.cos(d.angle) * orbit
          const ty = hy - 4 + Math.sin(d.angle) * orbit * 0.5
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
  private route(sim: Sim, si: number, sj: number, goals: Set<number>, avoid?: Set<number>): [number, number][] | null {
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
          if (avoid?.has(v)) continue
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
    const c = this.core
    while (list.length < n) {
      const spots = [...this.around(sim, c.i, c.j, c.w, c.h)]
      if (!spots.length) return
      const s = spots[Math.floor(Math.random() * spots.length)]
      const rover = kind === 'rover'
      const m: Mover = rover
        ? {
            img: this.scene.add.image(0, 0, roverKey(0, 0, false)).setOrigin(ROVER_AX / ROVER_W, ROVER_AY / ROVER_H),
            sh: this.scene.add.image(0, 0, 'rover_sh_0').setOrigin(ROVER_AX / ROVER_SH_W, ROVER_AY / ROVER_SH_H).setDepth(DEPTH.unitShadow),
            fi: s % MAP,
            fj: Math.floor(s / MAP),
            path: [],
            wait: 0.3 + list.length * 0.7,
            toCore: false,
            lastTile: s,
            depth: 0,
            depthAt: { fi: NaN, fj: 0, dir: 0, rev: 0 },
            rover: {
              beacon: this.scene.add.image(0, 0, 'rover_beacon').setBlendMode(Phaser.BlendModes.ADD),
              beam: this.scene.add.image(0, 0, 'rover_beam_0').setOrigin(BEAM_AX / BEAM_W, BEAM_AY / BEAM_H).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.unitShadow + 0.01),
              dir: 0,
              v: 0,
              odo: 0,
              loaded: false,
              blocked: 0,
              dust: 0,
              phase: Math.random() * 10,
            },
          }
        : {
            img: this.scene.add.image(0, 0, 'walker_0').setOrigin(6 / 12, 13 / 15),
            sh: this.scene.add.image(0, 0, 'walker_sh').setOrigin(6 / 22, 13 / 20).setDepth(DEPTH.unitShadow),
            fi: s % MAP,
            fj: Math.floor(s / MAP),
            path: [],
            wait: 0.3 + list.length * 0.7,
            toCore: false,
            lastTile: s,
            depth: 0,
            depthAt: { fi: NaN, fj: 0, dir: 0, rev: 0 },
          }
      list.push(m)
    }
  }

  private plan(sim: Sim, m: Mover, kind: 'rover' | 'walker') {
    const rover = kind === 'rover'
    const here = [Math.round(m.fi), Math.round(m.fj)] as const
    const c = this.core
    let goals: Set<number>
    if (m.toCore && rover) {
      // free charging bays first, else anywhere beside the core
      const bays = new Set(c.bays.filter(([i, j]) => this.passable(sim, i, j) && !this.rovers.some((r) => r !== m && r.path.length === 0 && Math.round(r.fi) === i && Math.round(r.fj) === j)).map(([i, j]) => j * MAP + i))
      goals = bays.size ? bays : this.around(sim, c.i, c.j, c.w, c.h)
    } else if (m.toCore || m.leaving) goals = this.around(sim, c.i, c.j, c.w, c.h)
    else {
      // rovers visit anything; crew favour places people work
      const sites = [...sim.ents.values()].filter(
        (e) => e.kind !== 'belt' && e.kind !== 'core' && (kind === 'rover' || !['solar', 'shield', 'battery'].includes(e.kind)),
      )
      if (!sites.length) {
        // nothing built yet: a short survey trip in front of the lander
        goals = new Set([(c.j + c.h + 1 + Math.floor(Math.random() * 4)) * MAP + c.i - 2 + Math.floor(Math.random() * (c.w + 4))])
      } else {
        const e = sites[Math.floor(Math.random() * sites.length)]
        goals = this.around(sim, e.i, e.j, BUILDINGS[e.kind].w, BUILDINGS[e.kind].h)
      }
    }
    // rovers steer round other rovers that are parked, and don't pick a spot one is parked on
    let avoid: Set<number> | undefined
    if (rover) {
      avoid = new Set()
      for (const r of this.rovers) if (r !== m && !r.path.length) avoid.add(Math.round(r.fj) * MAP + Math.round(r.fi))
      for (const k of avoid) goals.delete(k)
      // heading home after a visit means a full hopper
      m.rover!.loaded = m.toCore && !m.leaving && this.visited(sim, here[0], here[1])
    }
    const path = goals.size ? this.route(sim, here[0], here[1], goals, avoid) : null
    m.path = path ?? []
    if (!m.leaving) m.toCore = !m.toCore
    m.wait = path ? 0 : 2
  }

  private step(sim: Sim, m: Mover, dt: number, speed: number, kind: 'rover' | 'walker', env: Env) {
    const rover = kind === 'rover'
    this.evict(sim, m)
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
    setTex(m.img, WALKER_FRAMES[frame]).setPosition(x, y)
    setDep(m.img, this.depthOf(sim, m, m.fi, m.fj, 0, WALKER_HALF, WALKER_HALF))
    m.sh.setPosition(x, y).setAlpha(env.shadowAlpha)
  }

  /** Is (i, j) beside a building (somewhere a rover would have picked something up)? */
  private visited(sim: Sim, i: number, j: number) {
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const e = sim.entAt(i + di, j + dj)
      if (e && e.kind !== 'belt' && e.kind !== 'junction' && e.kind !== 'core') return true
    }
    return false
  }

  /** Tiles left to drive on the current path, counting the part-done one. */
  private remaining(m: Mover) {
    if (!m.path.length) return 0
    const [ti, tj] = m.path[0]
    return Math.hypot(ti - m.fi, tj - m.fj) + m.path.length - 1
  }

  /** Is another rover sitting on, or driving into, tile (i, j)? */
  private occupied(m: Mover, i: number, j: number) {
    for (const r of this.rovers) {
      if (r === m) continue
      if (Math.round(r.fi) === i && Math.round(r.fj) === j) return true
      // two rovers about to swap tiles: the one further along waits
      const next = r.path[0]
      if (next && next[0] === i && next[1] === j && Math.hypot(r.fi - i, r.fj - j) < Math.hypot(m.fi - i, m.fj - j)) return true
    }
    return false
  }

  private driveRover(sim: Sim, m: Mover, dt: number, env: Env) {
    const R = m.rover!
    let moved = 0
    this.evict(sim, m)
    if (!m.path.length) {
      R.v = 0
      m.wait -= dt
      if (m.wait <= 0) this.plan(sim, m, 'rover')
    } else {
      const [ti, tj] = m.path[0]
      if (!this.passable(sim, ti, tj)) {
        // something got built in the way: re-route
        m.path = []
        m.toCore = !m.toCore
        m.wait = 0.3
      } else if (this.occupied(m, ti, tj) && Math.hypot(ti - m.fi, tj - m.fj) > 0.55) {
        // queue behind the rover ahead; if it doesn't move, find another way
        R.v = Math.max(0, R.v - ROVER_BRAKE * 2 * dt)
        R.blocked += dt
        if (R.blocked > 1.5) {
          R.blocked = 0
          m.path = []
          m.toCore = !m.toCore
          m.wait = 0.2 + Math.random() * 0.5
        }
      } else {
        R.blocked = 0
        const di = ti - m.fi
        const dj = tj - m.fj
        const dist = Math.hypot(di, dj)
        const onRoad = sim.roadLevel(Math.round(m.fi), Math.round(m.fj)) === 2
        // brake for the stop at the end, and ease off for a corner coming up
        const turn = m.path.length > 1 && (m.path[1][0] - ti !== Math.sign(di) || m.path[1][1] - tj !== Math.sign(dj))
        const top = ROVER_SPEED * (onRoad ? ROAD_BOOST : 1)
        const stopCap = Math.sqrt(2 * ROVER_BRAKE * this.remaining(m)) + 0.15
        const turnCap = turn ? 0.6 + Math.sqrt(2 * ROVER_BRAKE * dist) : Infinity
        const want = Math.min(top, stopCap, turnCap)
        R.v = R.v < want ? Math.min(want, R.v + ROVER_ACCEL * dt) : Math.max(want, R.v - ROVER_BRAKE * dt)
        const stepLen = R.v * dt
        if (dist > 0.01) R.dir = (Math.abs(di) >= Math.abs(dj) ? (di > 0 ? 0 : 2) : dj > 0 ? 1 : 3) as Dir
        if (dist <= stepLen) {
          m.fi = ti
          m.fj = tj
          m.path.shift()
          moved = dist
          if (!m.path.length) {
            // unloading at home takes a little longer than loading
            m.wait = R.loaded ? 2 + Math.random() : 1.2 + Math.random()
            if (R.loaded && nearCore(this.core, m.fi, m.fj)) R.loaded = false
          }
        } else {
          m.fi += (di / dist) * stepLen
          m.fj += (dj / dist) * stepLen
          moved = stepLen
        }
        const k = Math.round(m.fj) * MAP + Math.round(m.fi)
        if (k !== m.lastTile) {
          m.lastTile = k
          sim.addWear(Math.round(m.fi), Math.round(m.fj))
        }
        // dust off bare ground, more in a storm and the faster it goes
        if (!onRoad && sim.roadLevel(Math.round(m.fi), Math.round(m.fj)) < 2) {
          R.dust += moved * (env.storm ? 9 : 5)
          while (R.dust >= 1) {
            R.dust -= 1
            this.puff(m)
          }
        }
      }
    }
    R.odo += moved
    const frame = Math.floor(R.odo * WHEEL_FRAMES_PER_TILE) % ROVER_WHEEL_FRAMES
    // a little suspension bounce on rough ground
    const bump = moved > 0 && sim.roadLevel(Math.round(m.fi), Math.round(m.fj)) < 2 && Math.floor(R.odo * 6 + R.phase) % 3 === 0 ? 1 : 0
    // parked nose-to a building or the core: back off so the body stays out of its footprint
    let fi = m.fi
    let fj = m.fj
    if (!m.path.length && !this.passable(sim, Math.round(m.fi) + DIR_I[R.dir], Math.round(m.fj) + DIR_J[R.dir])) {
      fi -= DIR_I[R.dir] * PARK_BACKOFF
      fj -= DIR_J[R.dir] * PARK_BACKOFF
    }
    const x = Math.round(centreX(fi, fj))
    const y = Math.round(centreY(fi, fj))
    setTex(m.img, roverKey(R.dir, frame, R.loaded)).setPosition(x, y - bump)
    const along = R.dir % 2 === 0
    const depth = this.depthOf(sim, m, fi, fj, R.dir, along ? ROVER_HALF_LENGTH : ROVER_HALF_WIDTH, along ? ROVER_HALF_WIDTH : ROVER_HALF_LENGTH)
    setDep(m.img, depth)
    setTex(m.sh, `rover_sh_${R.dir}`).setPosition(x, y).setAlpha(env.shadowAlpha)

    // beacon: amber blink while driving, slow cyan pulse while charging in a bay, dim when parked elsewhere
    const [bx, by] = roverPoint(R.dir, 'beacon')
    const charging = !m.path.length && this.core.bays.some(([i, j]) => Math.round(m.fi) === i && Math.round(m.fj) === j)
    const t = this.time + R.phase
    const glow = m.path.length ? (Math.floor(t * 2.5) % 2 ? 1 : 0.15) : charging ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.4)) : 0.25
    R.beacon
      .setPosition(x + bx, y + by - bump)
      .setTint(charging ? BEACON_CYAN : BEACON_AMBER)
      .setAlpha(glow * (0.55 + 0.45 * env.night))
    setDep(R.beacon, depth + 0.001)
    // headlights pool on the ground ahead after dark
    setTex(R.beam, `rover_beam_${R.dir}`).setPosition(x, y).setVisible(env.night > 0.05 && m.path.length > 0).setAlpha(0.7 * env.night)
  }

  private puff(m: Mover) {
    const R = m.rover!
    let p = this.dust.find((d) => d.t >= d.life)
    if (!p) {
      if (this.dust.length >= DUST_POOL) return
      p = { img: this.scene.add.image(0, 0, 'dust'), t: 0, life: 1, vx: 0, vy: 0 }
      this.dust.push(p)
    }
    // from behind the rear wheels, drifting back and up
    const bi = -DIR_I[R.dir] * ROVER_HALF_LENGTH
    const bj = -DIR_J[R.dir] * ROVER_HALF_LENGTH
    const side = (Math.random() - 0.5) * 0.4
    const fi = m.fi + bi + DIR_J[R.dir] * side
    const fj = m.fj + bj - DIR_I[R.dir] * side
    p.img.setPosition(centreX(fi, fj), centreY(fi, fj) - 1).setVisible(true).setScale(0.6).setAlpha(0.55)
    setDep(p.img, unitDepth(fi, fj) - 0.002)
    p.t = 0
    p.life = 0.5 + Math.random() * 0.4
    p.vx = (centreX(bi, bj) - centreX(0, 0)) * 0.8 + (Math.random() - 0.5) * 6
    p.vy = -6 - Math.random() * 6
  }

  private updateDust(dt: number) {
    for (const p of this.dust) {
      if (p.t >= p.life) continue
      p.t += dt
      const k = Math.min(1, p.t / p.life)
      if (k >= 1) {
        p.img.setVisible(false)
        continue
      }
      p.img.x += p.vx * dt
      p.img.y += p.vy * dt
      p.img.setScale(0.6 + k * 0.9).setAlpha(0.55 * (1 - k))
    }
  }

  private destroyMover(m: Mover) {
    m.img.destroy()
    m.sh.destroy()
    m.rover?.beacon.destroy()
    m.rover?.beam.destroy()
  }

  private atCore(m: Mover) {
    return nearCore(this.core, m.fi, m.fj)
  }

  /** Something got built on top of this unit: hop to the nearest open tile and think again. */
  private evict(sim: Sim, m: Mover) {
    const i = Math.round(m.fi)
    const j = Math.round(m.fj)
    if (this.passable(sim, i, j)) return
    for (let r = 1; r <= 6; r++)
      for (let dj = -r; dj <= r; dj++)
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r || !this.passable(sim, i + di, j + dj)) continue
          m.fi = i + di
          m.fj = j + dj
          m.path = []
          m.wait = 0.2
          if (m.rover) m.rover.v = 0
          return
        }
  }

  /**
   * Draw order for a unit at fractional tile (fi, fj) whose ground box reaches
   * hi/hj tiles either side of its centre: its own row, nudged past any building
   * it overlaps on screen so it is never drawn over a building it stands
   * behind (or under one it stands in front of) — which a row alone gets wrong
   * for a 1.2-tile rover beside big footprints. Cached until it moves or the
   * layout changes.
   */
  private depthOf(sim: Sim, m: Mover, fi: number, fj: number, dir: number, hi: number, hj: number) {
    const at = m.depthAt
    if (at.fi === fi && at.fj === fj && at.dir === dir && at.rev === sim.rev) return m.depth
    at.fi = fi
    at.fj = fj
    at.dir = dir
    at.rev = sim.rev
    const box: Box = { i0: fi + 0.5 - hi, i1: fi + 0.5 + hi, j0: fj + 0.5 - hj, j1: fj + 0.5 + hj }
    let lo = -Infinity
    let up = Infinity
    const seen = this.seen
    seen.clear()
    // buildings are at most 4 tiles across, so anything that can touch the box starts within 4 tiles of it
    for (let j = Math.floor(box.j0) - 4; j <= Math.floor(box.j1) + 1; j++)
      for (let i = Math.floor(box.i0) - 4; i <= Math.floor(box.i1) + 1; i++) {
        const e = sim.entAt(i, j)
        if (!e || seen.has(e.id) || e.kind === 'belt' || e.kind === 'junction') continue
        seen.add(e.id)
        const { w, h } = BUILDINGS[e.kind]
        const eb: Box = { i0: e.i, i1: e.i + w, j0: e.j, j1: e.j + h }
        if (!screenOverlap(box, eb, 1)) continue
        const d = depthFor(e.kind, e.i, e.j)
        if (inFront(box, eb)) lo = Math.max(lo, d + 0.1)
        else if (inFront(eb, box)) up = Math.min(up, d - 0.1)
      }
    const base = unitDepth(fi, fj)
    m.depth = lo > up ? lo : Math.min(Math.max(base, lo), up)
    return m.depth
  }
}
