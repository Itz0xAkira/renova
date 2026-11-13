/**
 * The Phaser scene: steps the simulation on a fixed clock and keeps the world's
 * sprites in step with it. Input lives in `input.ts`, the cursor and power
 * overlays in `overlays.ts`, colony units in `units.ts` and the shared
 * isometric maths and draw order in `iso.ts`.
 */
import Phaser from 'phaser'
import { bakeAll, bakeTier, beltKey, bKey, FRAMES, PORT_AX, PORT_AY, PORT_H, PORT_W, shKey, spriteSpec, TER_H, TER_W, terrainCanvas, type TextureSink } from '@/game/art/sprites'
import { BUILDINGS, DI, DJ, ITEMS, MAP, type Dir, type ItemId, type Kind } from '@/game/core/data'
import { outTile, type Ent } from '@/game/core/sim'
import type { GameStore } from '@/game/store'
import { setDep, setTex } from '@/game/render/display'
import { MapInput } from '@/game/render/input'
import { centreOf, centreX, centreY, DEPTH, depthFor, DIR_VEC, itemDepth, JUNCTION_ORIGIN, originOf, portDepth, top } from '@/game/render/iso'
import { Overlays } from '@/game/render/overlays'
import { coreLayout } from '@/game/render/coreLayout'
import { Units } from '@/game/render/units'

const STEP = 1 / 20

/** Kinds that show their running frames whenever they exist; every other building animates only while it works. */
const ALWAYS_ON = new Set<Kind>(['solar', 'core', 'battery', 'reactor', 'pylon'])

/** Statuses that put an icon over the building. */
const ICON_STATUS = new Set(['nopower', 'nogrid', 'noinput', 'blocked', 'unshielded', 'badground'])

const ITEM_KEY = Object.fromEntries(Object.keys(ITEMS).map((k) => [k, `item_${k}`])) as Record<ItemId, string>

/** How far the camera may wander past the map's edges (world px); more above, where tall buildings on the back rows reach. */
const CAMERA_MARGIN = { side: 160, top: 280, bottom: 160 }

/** Stamp settings for batched draws into a render texture (inside beginDraw / endDraw). */
const IN_BATCH = { skipBatch: true }
const BAY_STAMP = { originX: 17 / 34, originY: 21 / 30, skipBatch: true }
const SHADOW_STAMP = { originX: 0, originY: 0, skipBatch: true }

type Port = { img: Phaser.GameObjects.Image; owner: number; kind: 'in' | 'out'; dir: Dir }

export class MarsScene extends Phaser.Scene {
  private store: GameStore
  private sprites = new Map<number, Phaser.GameObjects.Image>()
  private icons = new Map<number, Phaser.GameObjects.Image>()
  /** Belt docks and output chutes on building edges, rebuilt when the set of them changes. */
  private ports: Port[] = []
  private portsKey = ''
  private units!: Units
  private controls!: MapInput
  private overlays!: Overlays
  /** Tyre tracks and roads worn in by rovers and crew. */
  private roads!: Phaser.GameObjects.RenderTexture
  private roadRev = -1
  /** Which rover bays had something built on them when the roads were last drawn. */
  private baysKey = ''
  /** All building shadows, stamped opaque and faded as one layer so overlaps never stack. */
  private shadows!: Phaser.GameObjects.RenderTexture
  private items: Phaser.GameObjects.Image[] = []
  private terrain?: Phaser.GameObjects.Image
  private terrainKey = ''
  private ship!: Phaser.GameObjects.Image
  private flame!: Phaser.GameObjects.Image
  private shipChain?: Phaser.Tweens.TweenChain
  private acc = 0
  private rev = -1
  private epoch = -1
  private lastShip = -1
  private lastBump = 0
  /** Upgrade levels whose textures have been baked, as "kind:level". */
  private tiers = new Set<string>()
  private addTexture: TextureSink = (k, cv) => {
    if (!this.textures.exists(k)) this.textures.addCanvas(k, cv)
  }

  constructor(store: GameStore) {
    super('mars')
    this.store = store
  }

  create() {
    // Under React StrictMode the first game is destroyed before it boots; Phaser still
    // creates its scene, so skip the bake and leave the shared store alone.
    if ((this.game as unknown as { pendingDestroy?: boolean }).pendingDestroy) return
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __scene: MarsScene }).__scene = this
    bakeAll(this.addTexture)
    this.units = new Units(this)
    this.shadows = this.add.renderTexture(0, 0, TER_W, TER_H).setOrigin(0).setDepth(DEPTH.shadows)
    this.roads = this.add.renderTexture(0, 0, TER_W, TER_H).setOrigin(0).setDepth(DEPTH.roads)
    this.overlays = new Overlays(this, this.store, this.sprites, (kind) => this.controls.anchor(kind))
    this.ship = this.add.image(0, 0, 'ship').setOrigin(0.5, 59 / 66).setVisible(false)
    this.flame = this.add.image(0, 0, 'flame').setVisible(false)

    const cam = this.cameras.main
    cam.setRoundPixels(true)
    // buildings are big now (a 3×3 core): 2× shows the colony's heart on a desktop, 1× on a phone
    this.store.ui.zoom = window.innerWidth < 520 ? 1 : 2
    cam.setZoom(this.store.ui.zoom)
    // keep the map in view: the camera can't be panned off into empty space
    const m = CAMERA_MARGIN
    cam.setBounds(-m.side, -m.top, TER_W + 2 * m.side, TER_H + m.top + m.bottom)
    // the camera only knows its real size after the first resize, so centre on the next frame
    this.store.centerRequest = true

    this.controls = new MapInput(this, this.store)
    this.controls.attach()

    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      const w = window as unknown as { __scene?: MarsScene }
      if (w.__scene === this) delete w.__scene
      this.store.ui.hover = null
      this.store.ui.pointer = null
    })
  }

  /* -------------------------------- frame --------------------------------- */

  update(_time: number, delta: number) {
    if (!this.controls) return
    const store = this.store
    if (store.epoch !== this.epoch) this.rebuild()
    const sim = store.sim
    this.controls.update(delta)

    // fixed-step simulation
    const running = !store.ui.paused && !store.ui.panel && !sim.popups.length && !sim.over
    const simDt = running ? (Math.min(delta, 250) / 1000) * store.ui.speed : 0
    if (running) {
      this.acc += simDt
      let n = 0
      while (this.acc >= STEP && n++ < 40) {
        sim.step(STEP)
        this.acc -= STEP
      }
    }

    sim.ensureBelts()
    sim.ensureGrid()
    if (sim.rev !== this.rev) this.syncSprites()
    this.animate()
    this.drawItems()
    this.overlays.draw()
    this.drawShip()
    if (sim.roadRev !== this.roadRev) this.drawRoads()
    const sun = sim.sun()
    this.units.update(sim, simDt, delta / 1000, {
      shadowAlpha: 0.08 + 0.32 * sun,
      daytime: sun > 0.15,
      night: Math.max(0, Math.min(1, 1 - sun * 4)),
      flare: !!sim.ev.flare && sim.time >= sim.ev.flare.start,
      storm: !!sim.ev.storm && sim.time >= sim.ev.storm.start,
    })

    const now = performance.now()
    if (now - this.lastBump > 125) {
      this.lastBump = now
      store.bump()
    }
  }

  /** A whole new sim: drop everything drawn for the old one. */
  private rebuild() {
    this.epoch = this.store.epoch
    const sim = this.store.sim
    for (const s of this.sprites.values()) {
      this.tweens.killTweensOf(s)
      s.destroy()
    }
    for (const s of this.icons.values()) s.destroy()
    for (const p of this.ports) p.img.destroy()
    for (const it of this.items) it.setVisible(false)
    this.sprites.clear()
    this.icons.clear()
    this.ports = []
    this.portsKey = ''
    this.shadows.clear()
    this.roads.clear()
    this.roadRev = -1
    this.baysKey = ''
    this.rev = -1
    this.acc = 0
    this.units.reset(sim)
    // the ship lands on the core's front tile, so it sorts just in front of the core
    const shipDepth = coreLayout(sim.core).shipDepth
    this.ship.setDepth(shipDepth)
    this.flame.setDepth(shipDepth - 0.5)
    this.overlays.reset()
    this.controls.cancel()
    this.shipChain?.stop()
    this.shipChain = undefined
    this.ship.setVisible(false)
    this.flame.setVisible(false)
    this.lastShip = sim.ev.ship
    const key = `terrain_${sim.seed}`
    if (key !== this.terrainKey) {
      this.terrain?.destroy()
      this.terrain = undefined
      if (this.terrainKey && this.textures.exists(this.terrainKey)) this.textures.remove(this.terrainKey)
      if (!this.textures.exists(key)) this.textures.addCanvas(key, terrainCanvas(sim.ground))
      this.terrain = this.add.image(0, 0, key).setOrigin(0).setDepth(DEPTH.terrain)
      this.terrainKey = key
    }
  }

  /** The layout changed (built, removed, rotated, upgraded): bring sprites and everything derived from them up to date. */
  private syncSprites() {
    const sim = this.store.sim
    this.rev = sim.rev
    // upgraded buildings: bake their textures the first time each level appears
    for (const e of sim.ents.values()) {
      const key = `${e.kind}:${e.level}`
      if (e.level > 1 && !this.tiers.has(key)) {
        this.tiers.add(key)
        bakeTier(this.addTexture, e.kind, e.level)
      }
    }
    const ents = sim.ents
    for (const [id, s] of this.sprites)
      if (!ents.has(id)) {
        this.tweens.killTweensOf(s)
        s.destroy()
        this.sprites.delete(id)
        this.icons.get(id)?.destroy()
        this.icons.delete(id)
      }
    for (const e of ents.values()) {
      let s = this.sprites.get(e.id)
      if (!s) {
        s = this.add.image(0, 0, this.texFor(e, 0))
        this.sprites.set(e.id, s)
        if (e.kind !== 'belt') {
          // drop-in build animation
          s.setAlpha(0)
          this.tweens.add({ targets: s, alpha: 1, duration: 260 })
        }
      }
      const [x, cy] = centreOf(e.kind, e.i, e.j)
      s.setPosition(x, cy)
      if (e.kind === 'belt') s.setOrigin(0.5)
      else if (e.kind === 'junction') s.setOrigin(JUNCTION_ORIGIN[0], JUNCTION_ORIGIN[1])
      else s.setOrigin(...originOf(e.kind))
      setDep(s, e.kind === 'belt' ? DEPTH.belt : e.kind === 'junction' ? DEPTH.junction : depthFor(e.kind, e.i, e.j))
    }
    this.overlays.invalidate()
    this.drawShadows()
    this.overlays.drawCables()
    this.syncPorts()
    // rover bays are drawn with the roads, and only on open tiles in front of the core
    const bays = this.units.bays.map(([i, j]) => (sim.entAt(i, j) ? 1 : 0)).join('')
    if (bays !== this.baysKey) {
      this.baysKey = bays
      this.roadRev = -1
    }
    this.units.noticeBuilds(sim)
  }

  /**
   * Where belts meet buildings: an output chute on the edge each machine's arrow
   * faces, and a loader dock (with a pickup arm) on every edge a belt delivers to.
   */
  private syncPorts() {
    const sim = this.store.sim
    const specs: { owner: Ent; fi: number; fj: number; dir: Dir; kind: 'in' | 'out' }[] = []
    let key = ''
    const add = (owner: Ent, fi: number, fj: number, dir: Dir, kind: 'in' | 'out') => {
      specs.push({ owner, fi, fj, dir, kind })
      key += `${owner.id}${kind}${dir}@${fi},${fj};`
    }
    for (const e of sim.ents.values()) {
      if (!BUILDINGS[e.kind].outputs) continue
      const [ti, tj] = outTile(e)
      if (e.kind !== 'belt') add(e, ti - DI[e.dir], tj - DJ[e.dir], e.dir, 'out')
      // a belt delivering into a machine or the core gets a loader dock on that edge
      const target = sim.entAt(ti, tj)
      if (e.kind === 'belt' && target && target.kind !== 'belt' && (target.kind === 'core' || BUILDINGS[target.kind].recipe)) add(target, ti, tj, ((e.dir + 2) % 4) as Dir, 'in')
    }
    if (key === this.portsKey) return
    this.portsKey = key
    // reuse the images we have, make or drop the difference
    specs.forEach((p, k) => {
      // the dock sits on the midpoint of the footprint edge facing `dir`
      const u = p.fi + 0.5 + 0.5 * DI[p.dir]
      const v = p.fj + 0.5 + 0.5 * DJ[p.dir]
      const [x, y] = top(u, v)
      const tex = `port_${p.kind}_${p.dir}_0`
      let port = this.ports[k]
      if (!port) {
        port = { img: this.add.image(x, y, tex).setOrigin(PORT_AX / PORT_W, PORT_AY / PORT_H), owner: 0, kind: p.kind, dir: p.dir }
        this.ports.push(port)
      }
      setTex(port.img, tex).setPosition(x, y)
      setDep(port.img, portDepth(depthFor(p.owner.kind, p.owner.i, p.owner.j), u, v, p.dir))
      port.owner = p.owner.id
      port.kind = p.kind
      port.dir = p.dir
    })
    for (const p of this.ports.splice(specs.length)) p.img.destroy()
  }

  private drawRoads() {
    const sim = this.store.sim
    const rt = this.roads
    this.roadRev = sim.roadRev
    rt.clear()
    rt.beginDraw()
    for (let j = 0; j < MAP; j++)
      for (let i = 0; i < MAP; i++) {
        const lvl = sim.roadLevel(i, j)
        if (!lvl) continue
        let mask = 0
        for (let d = 0; d < 4; d++) if (sim.roadLevel(i + DI[d], j + DJ[d])) mask |= 1 << d
        rt.stamp(`road_${lvl}_${mask}`, undefined, centreX(i, j), centreY(i, j), IN_BATCH)
      }
    // rover charging bays on the open tiles in front of the core
    for (const [i, j] of this.units.bays) {
      const g = sim.groundAt(i, j)
      if (!g || g === 'rock' || g === 'crater' || sim.entAt(i, j)) continue
      rt.stamp('bay', undefined, centreX(i, j), centreY(i, j), BAY_STAMP)
    }
    rt.endDraw()
  }

  private drawShadows() {
    const rt = this.shadows
    rt.clear()
    rt.beginDraw()
    for (const e of this.store.sim.ents.values()) {
      if (e.kind === 'belt' || e.kind === 'junction') continue
      const sk = this.textures.exists(shKey(e.kind, e.level)) ? shKey(e.kind, e.level) : shKey(e.kind, 1)
      if (!this.textures.exists(sk)) continue
      const [x, cy] = centreOf(e.kind, e.i, e.j)
      const spec = spriteSpec(e.kind)
      rt.stamp(sk, undefined, x - spec.ax, cy - spec.ay, SHADOW_STAMP)
    }
    rt.endDraw()
  }

  private texFor(e: Ent, f: number) {
    if (e.kind === 'belt') return beltKey(e.dir, e.inMask, e.capEnd, f)
    if (e.kind === 'junction') return `junction_${f}`
    const L = this.textures.exists(bKey(e.kind, e.level, 0, e.kind === 'melter' ? '_0' : '')) ? e.level : 1
    if (e.kind === 'melter') {
      const w = (e.outBuf.water ?? 0) + (e.crafting ? 1 : 0)
      return bKey('melter', L, e.working ? f : 0, `_${Math.min(4, Math.floor(w * 0.7))}`)
    }
    if (e.kind === 'greenhouse') return e.working ? bKey('greenhouse', L, f) : bKey('greenhouse', L, 0, '_dim')
    return bKey(e.kind, L, e.working || ALWAYS_ON.has(e.kind) ? f : 0)
  }

  private animate() {
    const sim = this.store.sim
    const t = performance.now() / 1000
    const f = Math.floor(t * 4) % FRAMES
    const beltF = Math.floor(sim.time * (sim.done.has('maglev') ? 14 : 8)) % FRAMES
    const blink = Math.floor(t * 2) % 2 === 0
    this.shadows.setAlpha(0.08 + 0.32 * sim.sun())
    for (const p of this.ports) {
      const owner = sim.ents.get(p.owner)
      const busy = owner && (owner.working || owner.kind === 'core')
      setTex(p.img, `port_${p.kind}_${p.dir}_${busy ? f : 0}`)
    }
    for (const e of sim.ents.values()) {
      const s = this.sprites.get(e.id)
      if (!s) continue
      const flat = e.kind === 'belt' || e.kind === 'junction'
      // a jammed belt stops running, so a backed-up line reads at a glance
      setTex(s, this.texFor(e, flat ? (e.status === 'blocked' ? 0 : beltF) : f))
      const st = flat && !this.jamSource(e) ? 'ok' : e.status
      let icon = this.icons.get(e.id)
      if (ICON_STATUS.has(st)) {
        if (!icon) {
          const [x, cy] = centreOf(e.kind, e.i, e.j)
          // above the roof: taller for bigger footprints
          const lift = 22 + (BUILDINGS[e.kind].w + BUILDINGS[e.kind].h) * 8
          icon = this.add.image(x, cy - lift, `icon_${st}`).setDepth(DEPTH.overlay)
          this.icons.set(e.id, icon)
        }
        setTex(icon, `icon_${st}`)
          .setVisible(blink || st === 'noinput')
          .setAlpha(st === 'noinput' ? 0.75 : 1)
      } else if (icon) icon.setVisible(false)
    }
  }

  /**
   * Is this jammed belt or junction where the jam starts? Only that one gets the warning icon,
   * not every tile of the line backed up behind it.
   */
  private jamSource(e: Ent) {
    if (e.status !== 'blocked') return false
    const sim = this.store.sim
    const exits = e.kind === 'belt' ? (e.items[0]?.pos ?? 0) >= 1 ? [e.dir] : [] : [0, 1, 2, 3].filter((d) => (e.lanes[d][0]?.pos ?? 0) >= 1)
    return exits.some((d) => {
      const n = sim.entAt(e.i + DI[d], e.j + DJ[d])
      return !n || (n.kind !== 'belt' && n.kind !== 'junction') || n.status !== 'blocked'
    })
  }

  private drawItems() {
    const sim = this.store.sim
    const items = this.items
    // draw items where they'll be between fixed sim steps, so they glide instead of ticking along
    const lead = Math.min(this.acc, STEP)
    const at = (it: { pos: number; v?: number }) => Math.min(1, it.pos + (it.v ?? 0) * lead)
    let n = 0
    const put = (key: string, px: number, py: number, depth: number) => {
      let img = items[n++]
      if (!img) {
        img = this.add.image(0, 0, key).setOrigin(0.5, 0.7)
        items.push(img)
      }
      setTex(img, key).setPosition(Math.round(px), Math.round(py - 1)).setVisible(true)
      setDep(img, depth)
    }
    for (const e of sim.ents.values()) {
      if (e.kind !== 'belt' && e.kind !== 'junction') continue
      const cx = centreX(e.i, e.j)
      const cy = centreY(e.i, e.j)
      const row = e.i + e.j
      if (e.kind === 'junction') {
        // each lane crosses the tile in its own travel direction
        for (let d = 0; d < 4; d++) {
          const [ux, uy] = DIR_VEC[d]
          const sgn = d === 0 || d === 1 ? 1 : -1
          for (const it of e.lanes[d]) {
            const o = at(it) - 0.5
            put(ITEM_KEY[it.item], cx + ux * o, cy + uy * o - 2, itemDepth(row, o * sgn))
          }
        }
        continue
      }
      const [ux, uy] = DIR_VEC[e.dir]
      const sgn = e.dir === 0 || e.dir === 1 ? 1 : -1
      for (const it of e.items) {
        const pos = at(it)
        const o = pos - 0.5
        let px = cx + ux * o
        let py = cy + uy * o
        // items that came in round a corner or a Y follow a quarter circle from their side
        if (it.from !== undefined) {
          const [sx, sy] = DIR_VEC[it.from]
          const th = (pos * Math.PI) / 2
          const c = Math.cos(th)
          const s = Math.sin(th)
          px = cx + 0.5 * ux + 0.5 * sx - 0.5 * ux * c - 0.5 * sx * s
          py = cy + 0.5 * uy + 0.5 * sy - 0.5 * uy * c - 0.5 * sy * s
        }
        put(ITEM_KEY[it.item], px, py, itemDepth(row, o * sgn))
      }
    }
    for (let k = n; k < items.length; k++) {
      if (!items[k].visible) break // everything past here is already hidden
      items[k].setVisible(false)
    }
  }

  /** A supply ship lands on the core's front pad, waits, and lifts off again. */
  private drawShip() {
    const sim = this.store.sim
    if (sim.ev.ship === this.lastShip) return
    this.lastShip = sim.ev.ship
    this.shipChain?.stop()
    // the landing ring on the core's front tile, up on its plinth
    const [tx, ty] = coreLayout(sim.core).ring
    this.ship.setPosition(tx, ty - 240).setVisible(true)
    this.flame.setVisible(true)
    const follow = () => this.flame.setPosition(this.ship.x, this.ship.y + 6)
    follow()
    const chain = this.tweens.chain({
      targets: this.ship,
      tweens: [
        { y: ty, duration: 1800, ease: 'Cubic.easeOut', onUpdate: follow },
        { y: ty, duration: 1400, onStart: () => this.flame.setVisible(false) },
        { y: ty - 260, duration: 1600, ease: 'Cubic.easeIn', onStart: () => this.flame.setVisible(true), onUpdate: follow },
      ],
      onComplete: () => {
        this.ship.setVisible(false)
        this.flame.setVisible(false)
        if (this.shipChain === chain) this.shipChain = undefined
      },
    })
    this.shipChain = chain
  }
}
