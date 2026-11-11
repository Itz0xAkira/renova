import Phaser from 'phaser'
import { ANIMATED, bakeAll, beltKey, isBig, PORT_AX, PORT_AY, PORT_H, PORT_W, CORE_AX, CORE_AY, CORE_H, CORE_W, FRAMES, slabKey, SPR_AX, SPR_AY, SPR_H, SPR_W, TER_H, TER_OX, TER_OY, TER_W, terrainCanvas } from './art'
import { BUILDINGS, DI, DJ, MAP, type Dir, type Kind } from './data'
import { CORE_AT, outTile, outTileFor, SHIELD_RADIUS, type Ent } from './sim'
import type { GameStore } from './store'
import { ROVER_BAYS, Units } from './units'

const STEP = 1 / 20
const ZOOMS = [1, 2, 3, 4, 5, 6]

/** World position of tile (i, j)'s top corner. Fractional (i, j) give any point on the ground. */
const top = (i: number, j: number) => [TER_OX + (i - j) * 16, TER_OY + (i + j) * 8] as const

/** Ground point at the centre of a building's footprint, where its sprite is anchored. */
const centreOf = (kind: Kind, i: number, j: number) => top(i + BUILDINGS[kind].w / 2, j + BUILDINGS[kind].h / 2)

/**
 * Draw order. 1×1: by its tile's row (i + j). Multi-tile: between the last row
 * behind it and the first row in front of it, so neighbours on every side sort
 * correctly for 2×2 and 3×2 footprints.
 */
const depthFor = (kind: Kind, i: number, j: number) => {
  const { w, h } = BUILDINGS[kind]
  return w === 1 && h === 1 ? (i + j) * 10 + 5 : (i + j + Math.max(w, h) - 2) * 10 + 6
}

const originOf = (kind: Kind) => (isBig(kind) ? [CORE_AX / CORE_W, CORE_AY / CORE_H] : [SPR_AX / SPR_W, SPR_AY / SPR_H]) as [number, number]

/** The cursor sits over the middle of a multi-tile footprint: its top-corner tile. */
const anchorFor = (kind: Kind, hi: number, hj: number) => [hi - ((BUILDINGS[kind].w - 1) >> 1), hj - ((BUILDINGS[kind].h - 1) >> 1)] as const

export class MarsScene extends Phaser.Scene {
  private store: GameStore
  private sprites = new Map<number, Phaser.GameObjects.Image>()
  private icons = new Map<number, Phaser.GameObjects.Image>()
  private slabs = new Map<number, Phaser.GameObjects.Image>()
  /** Belt docks and output chutes on building edges, rebuilt whenever the layout changes. */
  private ports: { img: Phaser.GameObjects.Image; owner: number; kind: 'in' | 'out'; dir: Dir }[] = []
  private units!: Units
  /** Tyre tracks and roads worn in by rovers and crew. */
  private roads?: Phaser.GameObjects.RenderTexture
  private roadRev = -1
  /** All building shadows, stamped opaque and faded as one layer so overlaps never stack. */
  private shadows?: Phaser.GameObjects.RenderTexture
  private items: Phaser.GameObjects.Image[] = []
  private terrain?: Phaser.GameObjects.Image
  private hover!: Phaser.GameObjects.Image
  private ghost!: Phaser.GameObjects.Image
  private ghostArrow!: Phaser.GameObjects.Image
  private range!: Phaser.GameObjects.Graphics
  private ship!: Phaser.GameObjects.Image
  private flame!: Phaser.GameObjects.Image
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private acc = 0
  private rev = -1
  private epoch = -1
  private lastShip = -1
  private lastBump = 0
  private rangeKey = ''
  /** Footprint outlines under the cursor. */
  private foot!: Phaser.GameObjects.Graphics
  /** Additive copy of the hovered building's sprite, so it lights up. */
  private glow!: Phaser.GameObjects.Image
  private drag: null | { mode: 'place' | 'remove' | 'pan'; last: [number, number] | null; sx: number; sy: number; scrollX: number; scrollY: number; moved: boolean; placed: Set<number> } = null
  private pinch: null | { d: number; zoom: number } = null

  constructor(store: GameStore) {
    super('mars')
    this.store = store
  }

  create() {
    if (process.env.NODE_ENV !== 'production') (window as unknown as { __scene: MarsScene }).__scene = this
    bakeAll((k, cv) => {
      if (!this.textures.exists(k)) this.textures.addCanvas(k, cv)
    })
    this.units = new Units(this)
    this.hover = this.add.image(0, 0, 'hover').setDepth(-0.5).setVisible(false)
    this.range = this.add.graphics().setDepth(-0.6)
    this.foot = this.add.graphics().setDepth(-0.55)
    this.glow = this.add.image(0, 0, 'b_solar_0').setBlendMode(Phaser.BlendModes.ADD).setVisible(false)
    this.ghost = this.add.image(0, 0, 'b_solar_0').setAlpha(0.6).setVisible(false)
    this.ghostArrow = this.add.image(0, 0, 'arrow_0').setDepth(1e6).setVisible(false)
    // supply ships land on the open front sub-tile of the core's pad, so they sort just in front of the core
    this.ship = this.add.image(0, 0, 'ship').setOrigin(0.5, 59 / 66).setVisible(false).setDepth((CORE_AT * 2 + 1) * 10 + 7)
    this.flame = this.add.image(0, 0, 'flame').setVisible(false).setDepth((CORE_AT * 2 + 1) * 10 + 6.5)

    const cam = this.cameras.main
    cam.setRoundPixels(true)
    this.store.ui.zoom = window.innerWidth < 700 ? 2 : 3
    cam.setZoom(this.store.ui.zoom)
    // the camera only knows its real size after the first resize, so centre on the next frame
    this.store.centerRequest = true

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT', false) as Record<string, Phaser.Input.Keyboard.Key>
    this.input.addPointer(1)
    this.input.mouse?.disableContextMenu()
    this.input.on('pointerdown', this.onDown, this)
    this.input.on('pointermove', this.onMove, this)
    this.input.on('pointerup', this.onUp, this)
    this.input.on('pointerupoutside', this.onUp, this)
    this.input.on('gameout', () => {
      this.store.ui.hover = null
      this.store.ui.pointer = null
    })
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.zoomBy(dy > 0 ? -1 : 1, p.x, p.y))
  }

  /* -------------------------------- camera -------------------------------- */

  private centerOnCore() {
    const [x, y] = top(CORE_AT, CORE_AT)
    this.cameras.main.centerOn(x, y + 16)
  }

  private zoomBy(step: number, sx = this.scale.width / 2, sy = this.scale.height / 2) {
    const cam = this.cameras.main
    const k = ZOOMS.indexOf(this.store.ui.zoom)
    const next = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, (k < 0 ? 2 : k) + step))]
    if (next === cam.zoom) return
    const before = cam.getWorldPoint(sx, sy)
    cam.setZoom(next)
    cam.preRender()
    const after = cam.getWorldPoint(sx, sy)
    cam.scrollX += before.x - after.x
    cam.scrollY += before.y - after.y
    this.store.ui.zoom = next
    this.store.bump()
  }

  private tileAt(sx: number, sy: number): [number, number] | null {
    const p = this.cameras.main.getWorldPoint(sx, sy)
    const a = (p.x - TER_OX) / 16
    const b = (p.y - TER_OY - 8) / 8
    const i = Math.round((a + b) / 2)
    const j = Math.round((b - a) / 2)
    return i < 0 || j < 0 || i >= MAP || j >= MAP ? null : [i, j]
  }

  /* -------------------------------- input --------------------------------- */

  private onDown(p: Phaser.Input.Pointer) {
    const pts = this.input.manager.pointers.filter((q) => q.isDown)
    if (pts.length >= 2) {
      this.drag = null
      this.pinch = { d: Phaser.Math.Distance.Between(pts[0].x, pts[0].y, pts[1].x, pts[1].y), zoom: this.store.ui.zoom }
      return
    }
    const cam = this.cameras.main
    const t = this.tileAt(p.x, p.y)
    const base = { sx: p.x, sy: p.y, scrollX: cam.scrollX, scrollY: cam.scrollY, moved: false, last: t, placed: new Set<number>() }
    if (p.rightButtonDown()) {
      this.drag = { mode: 'remove', ...base }
      if (t) this.store.removeAt(t[0], t[1])
    } else if (p.middleButtonDown() || !this.store.ui.tool) {
      this.drag = { mode: 'pan', ...base }
    } else {
      this.drag = { mode: 'place', ...base }
      if (t) this.placeAt(t[0], t[1])
    }
  }

  private onMove(p: Phaser.Input.Pointer) {
    const t = this.tileAt(p.x, p.y)
    this.store.ui.hover = t
    this.store.ui.pointer = [p.x, p.y]
    if (this.pinch) {
      const pts = this.input.manager.pointers.filter((q) => q.isDown)
      if (pts.length >= 2) {
        const d = Phaser.Math.Distance.Between(pts[0].x, pts[0].y, pts[1].x, pts[1].y)
        const want = this.pinch.zoom * (d / this.pinch.d)
        const k = ZOOMS.reduce((best, z) => (Math.abs(z - want) < Math.abs(best - want) ? z : best), ZOOMS[0])
        if (k !== this.store.ui.zoom) this.zoomBy(ZOOMS.indexOf(k) - ZOOMS.indexOf(this.store.ui.zoom))
      }
      return
    }
    const d = this.drag
    if (!d || !p.isDown) return
    if (Math.abs(p.x - d.sx) + Math.abs(p.y - d.sy) > 6) d.moved = true
    if (d.mode === 'pan') {
      const cam = this.cameras.main
      cam.scrollX = d.scrollX - (p.x - d.sx) / cam.zoom
      cam.scrollY = d.scrollY - (p.y - d.sy) / cam.zoom
      return
    }
    if (!t || (d.last && d.last[0] === t[0] && d.last[1] === t[1])) return
    // walk the grid from the last tile to this one so fast drags leave no gaps
    let [ci, cj] = d.last ?? t
    while (ci !== t[0] || cj !== t[1]) {
      const pi = ci
      const pj = cj
      if (ci !== t[0]) ci += Math.sign(t[0] - ci)
      else cj += Math.sign(t[1] - cj)
      if (d.mode === 'remove') this.store.removeAt(ci, cj)
      else {
        if (this.store.ui.tool === 'belt') {
          const dir = (ci > pi ? 0 : cj > pj ? 1 : ci < pi ? 2 : 3) as Dir
          this.store.ui.dir = dir
          const prev = this.store.sim.entAt(pi, pj)
          if (prev && prev.kind === 'belt' && d.placed.has(prev.id)) this.store.sim.setDir(prev, dir)
        }
        this.placeAt(ci, cj)
      }
    }
    d.last = t
  }

  private onUp(p: Phaser.Input.Pointer) {
    const d = this.drag
    this.pinch = null
    this.drag = null
    if (!d || d.moved || d.mode !== 'pan' || p.button !== 0) return
    // a click without a tool selects
    const t = this.tileAt(p.x, p.y)
    const e = t ? this.store.sim.entAt(t[0], t[1]) : null
    this.store.ui.selected = e ? e.id : null
    this.store.bump()
  }

  private placeAt(hi: number, hj: number) {
    const tool = this.store.ui.tool
    if (!tool) return
    const [i, j] = anchorFor(tool, hi, hj)
    const sim = this.store.sim
    const there = sim.entAt(i, j)
    if (tool === 'belt' && there?.kind === 'belt' && this.drag && !this.drag.placed.has(there.id) && there.dir % 2 !== this.store.ui.dir % 2) {
      // dragging a belt across a perpendicular one: swap it for a junction so both lines cross
      sim.remove(i, j)
      const err = sim.place('junction', i, j, 0)
      if (err) sim.place('belt', i, j, there.dir)
      else this.drag.placed.add(sim.entAt(i, j)!.id)
      this.store.bump()
      return
    }
    if (tool === 'belt' && there?.kind === 'junction') return // run straight through existing junctions
    const err = sim.place(tool, i, j, this.store.ui.dir)
    if (!err) {
      const e = this.store.sim.entAt(i, j)
      if (e) this.drag?.placed.add(e.id)
      this.store.bump()
    } else if (err === 'Not enough materials' || err === 'Not researched yet') {
      this.store.sim.log(`${BUILDINGS[tool].name}: ${err.toLowerCase()}.`, 'warn')
      this.store.bump()
    }
  }


  /* -------------------------------- frame --------------------------------- */

  update(_time: number, delta: number) {
    const store = this.store
    const sim = store.sim
    if (store.epoch !== this.epoch) this.rebuild()
    if (store.centerRequest) {
      store.centerRequest = false
      this.centerOnCore()
    }
    if (store.zoomRequest) {
      this.zoomBy(store.zoomRequest)
      store.zoomRequest = 0
    }

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

    // keyboard pan
    const cam = this.cameras.main
    const v = (delta / 1000) * (420 / cam.zoom)
    const k = this.keys
    if (k.A.isDown || k.LEFT.isDown) cam.scrollX -= v
    if (k.D.isDown || k.RIGHT.isDown) cam.scrollX += v
    if (k.W.isDown || k.UP.isDown) cam.scrollY -= v
    if (k.S.isDown || k.DOWN.isDown) cam.scrollY += v

    sim.ensureBelts()
    if (sim.rev !== this.rev) this.syncSprites()
    this.animate()
    this.drawItems()
    this.drawCursor()
    this.drawShip()
    if (sim.roadRev !== this.roadRev) this.drawRoads()
    const sun = sim.sun()
    this.units.update(sim, simDt, delta / 1000, {
      shadowAlpha: 0.08 + 0.32 * sun,
      daytime: sun > 0.15,
      flare: !!sim.ev.flare && sim.time >= sim.ev.flare.start,
      storm: !!sim.ev.storm && sim.time >= sim.ev.storm.start,
    })

    const now = performance.now()
    if (now - this.lastBump > 125) {
      this.lastBump = now
      store.bump()
    }
  }

  private rebuild() {
    this.epoch = this.store.epoch
    for (const s of this.sprites.values()) s.destroy()
    for (const s of this.icons.values()) s.destroy()
    for (const s of this.slabs.values()) s.destroy()
    this.sprites.clear()
    this.icons.clear()
    this.slabs.clear()
    this.shadows?.destroy()
    this.shadows = this.add.renderTexture(0, 0, TER_W, TER_H).setOrigin(0).setDepth(-0.8)
    this.units.reset(this.store.sim)
    this.roads?.destroy()
    this.roads = this.add.renderTexture(0, 0, TER_W, TER_H).setOrigin(0).setDepth(-5)
    this.roadRev = -1
    this.rev = -1
    this.lastShip = this.store.sim.ev.ship
    const key = `terrain_${this.store.sim.seed}`
    if (!this.textures.exists(key)) this.textures.addCanvas(key, terrainCanvas(this.store.sim.ground))
    this.terrain?.destroy()
    this.terrain = this.add.image(0, 0, key).setOrigin(0).setDepth(-10)
  }

  private syncSprites() {
    this.rev = this.store.sim.rev
    const ents = this.store.sim.ents
    for (const [id, s] of this.sprites)
      if (!ents.has(id)) {
        s.destroy()
        this.sprites.delete(id)
        this.icons.get(id)?.destroy()
        this.icons.delete(id)
        this.slabs.get(id)?.destroy()
        this.slabs.delete(id)
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
      const [ox, oy] = originOf(e.kind)
      if (e.kind === 'belt') s.setPosition(x, cy).setOrigin(0.5).setDepth(-1)
      else if (e.kind === 'junction') s.setPosition(x, cy).setOrigin(17 / 34, 13 / 22).setDepth(-0.95)
      else s.setPosition(x, cy).setOrigin(ox, oy).setDepth(depthFor(e.kind, e.i, e.j))
      const sk = slabKey(e.kind)
      if (sk && !this.slabs.has(e.id)) this.slabs.set(e.id, this.add.image(x, cy, sk).setOrigin(ox, oy).setDepth(-0.9))
    }
    this.drawShadows()
    this.syncPorts()
    this.roadRev = -1 // rover bays depend on what's built in front of the core
    this.units.noticeBuilds(this.store.sim)
  }

  /**
   * Where belts meet buildings: an output chute on the edge each machine's arrow
   * faces, and a loader dock (with a pickup arm) on every edge a belt delivers to.
   */
  private syncPorts() {
    for (const p of this.ports) p.img.destroy()
    this.ports = []
    const sim = this.store.sim
    const add = (owner: Ent, fi: number, fj: number, dir: Dir, kind: 'in' | 'out') => {
      // the dock sits on the midpoint of the footprint edge facing `dir`
      const [x, y] = top(fi + 0.5 + 0.5 * DI[dir], fj + 0.5 + 0.5 * DJ[dir])
      const back = dir === 2 || dir === 3
      const img = this.add
        .image(x, y, `port_${kind}_${dir}_0`)
        .setOrigin(PORT_AX / PORT_W, PORT_AY / PORT_H)
        .setDepth(depthFor(owner.kind, owner.i, owner.j) + (back ? -0.5 : 0.5))
      this.ports.push({ img, owner: owner.id, kind, dir })
    }
    for (const e of sim.ents.values()) {
      if (!BUILDINGS[e.kind].outputs) continue
      const [ti, tj] = outTile(e)
      if (e.kind !== 'belt') add(e, ti - DI[e.dir], tj - DJ[e.dir], e.dir, 'out')
      // a belt delivering into a machine or the core gets a loader dock on that edge
      const target = sim.entAt(ti, tj)
      if (e.kind === 'belt' && target && target.kind !== 'belt' && (target.kind === 'core' || BUILDINGS[target.kind].recipe))
        add(target, ti, tj, ((e.dir + 2) % 4) as Dir, 'in')
    }
  }

  private drawRoads() {
    const sim = this.store.sim
    const rt = this.roads
    if (!rt) return
    this.roadRev = sim.roadRev
    rt.clear()
    for (let j = 0; j < MAP; j++)
      for (let i = 0; i < MAP; i++) {
        const lvl = sim.roadLevel(i, j)
        if (!lvl) continue
        let mask = 0
        for (let d = 0; d < 4; d++) if (sim.roadLevel(i + DI[d], j + DJ[d])) mask |= 1 << d
        const [x, y] = top(i, j)
        rt.stamp(`road_${lvl}_${mask}`, undefined, x, y + 8)
      }
    // rover charging bays on the open tiles in front of the core
    for (const [i, j] of ROVER_BAYS) {
      const g = sim.groundAt(i, j)
      if (!g || g === 'rock' || g === 'crater' || sim.entAt(i, j)) continue
      const [x, y] = top(i, j)
      rt.stamp('bay', undefined, x, y + 8, { originX: 17 / 34, originY: 21 / 30 })
    }
  }

  private drawShadows() {
    const rt = this.shadows
    if (!rt) return
    rt.clear()
    for (const e of this.store.sim.ents.values()) {
      if (e.kind === 'belt' || e.kind === 'junction') continue
      if (!this.textures.exists(`sh_${e.kind}`)) continue
      const [x, cy] = centreOf(e.kind, e.i, e.j)
      const big = isBig(e.kind)
      rt.stamp(`sh_${e.kind}`, undefined, x - (big ? CORE_AX : SPR_AX), cy - (big ? CORE_AY : SPR_AY), { originX: 0, originY: 0 })
    }
  }

  private texFor(e: Ent, f: number) {
    if (e.kind === 'belt') return beltKey(e.dir, e.inMask, e.capEnd, f)
    if (e.kind === 'junction') return `junction_${f}`
    if (e.kind === 'melter') {
      const w = (e.outBuf.water ?? 0) + (e.crafting ? 1 : 0)
      return `b_melter_${Math.min(4, Math.floor(w * 0.7))}_${e.working ? f : 0}`
    }
    if (e.kind === 'greenhouse') return e.working ? `b_greenhouse_${f}` : `b_greenhouse_dim_0`
    if (ANIMATED.includes(e.kind) || e.kind === 'habitat' || e.kind === 'shield') {
      const on = e.working || e.kind === 'solar' || e.kind === 'core' || e.kind === 'battery' || e.kind === 'reactor'
      return `b_${e.kind}_${on ? f : 0}`
    }
    return `b_${e.kind}_0`
  }

  private animate() {
    const sim = this.store.sim
    const t = performance.now() / 1000
    const f = Math.floor(t * 4) % FRAMES
    const beltF = Math.floor(sim.time * (sim.done.has('maglev') ? 14 : 8)) % FRAMES
    const blink = Math.floor(t * 2) % 2 === 0
    const sel = this.store.ui.selected
    this.shadows?.setAlpha(0.08 + 0.32 * sim.sun())
    for (const p of this.ports) {
      const owner = sim.ents.get(p.owner)
      const busy = owner && (owner.working || owner.kind === 'core')
      p.img.setTexture(`port_${p.kind}_${p.dir}_${busy ? f : 0}`)
    }
    for (const e of sim.ents.values()) {
      const s = this.sprites.get(e.id)
      if (!s) continue
      s.setTexture(this.texFor(e, e.kind === 'belt' || e.kind === 'junction' ? beltF : f))
      const st = e.status
      const show = st === 'nopower' || st === 'noinput' || st === 'blocked' || st === 'unshielded' || st === 'badground'
      let icon = this.icons.get(e.id)
      if (show) {
        if (!icon) {
          icon = this.add.image(0, 0, `icon_${st}`).setDepth(1e6)
          this.icons.set(e.id, icon)
        }
        const [x, cy] = centreOf(e.kind, e.i, e.j)
        const lift = isBig(e.kind) ? 46 : e.kind === 'drill' ? 34 : 26
        icon.setTexture(`icon_${st}`).setPosition(x, cy - lift).setVisible(blink || st === 'noinput')
        icon.setAlpha(st === 'noinput' ? 0.75 : 1)
      } else if (icon) icon.setVisible(false)
    }
  }

  private drawItems() {
    const sim = this.store.sim
    let n = 0
    const vec = (d: Dir) => [(DI[d] - DJ[d]) * 16, (DI[d] + DJ[d]) * 8] as const
    const put = (key: string, px: number, py: number, depth: number) => {
      let img = this.items[n]
      if (!img) {
        img = this.add.image(0, 0, key).setOrigin(0.5, 0.7)
        this.items.push(img)
      }
      img.setTexture(key).setPosition(Math.round(px), Math.round(py - 1)).setDepth(depth).setVisible(true)
      n++
    }
    for (const e of sim.ents.values()) {
      if (e.kind !== 'belt' && e.kind !== 'junction') continue
      const [x, y] = top(e.i, e.j)
      const cx = x
      const cy = y + 8
      if (e.kind === 'junction') {
        // each lane crosses the tile in its own travel direction
        for (let d = 0; d < 4; d++) {
          const [ux, uy] = vec(d as Dir)
          const sgn = d === 0 || d === 1 ? 1 : -1
          for (const it of e.lanes[d]) {
            const o = it.pos - 0.5
            put(`item_${it.item}`, cx + ux * o, cy + uy * o - 2, (e.i + e.j + o * sgn) * 10 + 3)
          }
        }
        continue
      }
      const [ux, uy] = vec(e.dir)
      const sgn = e.dir === 0 || e.dir === 1 ? 1 : -1
      for (const it of e.items) {
        const o = it.pos - 0.5
        let px = cx + ux * o
        let py = cy + uy * o
        // items that came in round a corner or a Y follow a quarter circle from their side
        if (it.from !== undefined) {
          const [sx, sy] = vec(it.from)
          const th = (it.pos * Math.PI) / 2
          const kx = cx + 0.5 * ux + 0.5 * sx
          const ky = cy + 0.5 * uy + 0.5 * sy
          px = kx - 0.5 * ux * Math.cos(th) - 0.5 * sx * Math.sin(th)
          py = ky - 0.5 * uy * Math.cos(th) - 0.5 * sy * Math.sin(th)
        }
        put(`item_${it.item}`, px, py, (e.i + e.j + o * sgn) * 10 + 3)
      }
    }
    for (let k = n; k < this.items.length; k++) this.items[k].setVisible(false)
  }


  private outline(kind: Kind, i: number, j: number, color: number, alpha: number) {
    const { w, h } = BUILDINGS[kind]
    const pts = [top(i, j), top(i + w, j), top(i + w, j + h), top(i, j + h)].map(([x, y]) => new Phaser.Math.Vector2(x, y))
    this.foot.lineStyle(1, color, alpha).strokePoints(pts, true, true)
    this.foot.fillStyle(color, alpha * 0.12).fillPoints(pts, true)
  }

  private drawCursor() {
    const ui = this.store.ui
    const sim = this.store.sim
    const h = ui.hover
    const tool = ui.tool
    const pulse = 0.65 + 0.35 * Math.sin(performance.now() / 180)
    this.foot.clear()
    this.glow.setVisible(false)
    this.hover.setVisible(false)
    this.ghost.setVisible(false)
    this.ghostArrow.setVisible(false)
    ui.hoverErr = null

    // the selected building keeps a steady outline
    const sel = this.store.selectedEnt()
    if (sel && sel.kind !== 'belt') this.outline(sel.kind, sel.i, sel.j, 0xe8753b, 0.9)

    if (h && tool) {
      // build preview: footprint outline, ghost sprite and output arrow
      const [i, j] = anchorFor(tool, h[0], h[1])
      const err = sim.placeError(tool, i, j)
      ui.hoverErr = err
      this.outline(tool, i, j, err ? 0xff5a4f : 0xfff7e8, 0.95)
      const def = BUILDINGS[tool]
      const f = Math.floor(performance.now() / 250) % FRAMES
      const [x, cy] = centreOf(tool, i, j)
      if (tool === 'belt') this.ghost.setTexture(`belt_${ui.dir}_${f}`).setOrigin(0.5).setPosition(x, cy).setDepth(-0.9)
      else {
        const [ox, oy] = originOf(tool)
        this.ghost.setTexture(tool === 'melter' ? `b_melter_2_${f}` : `b_${tool}_${f}`).setOrigin(ox, oy).setPosition(x, cy).setDepth(depthFor(tool, i, j) + 1)
      }
      this.ghost.setVisible(true).setAlpha(err ? 0.35 : 0.7).setTint(err ? 0xff6a5f : 0xffffff)
      if (def.outputs && tool !== 'belt') {
        const [ti, tj] = outTileFor(tool, i, j, ui.dir)
        const [ax, ay] = top(ti, tj)
        this.ghostArrow.setTexture(`arrow_${ui.dir}`).setPosition(ax, ay + 8).setVisible(true)
      }
    } else if (h) {
      const e = sim.entAt(h[0], h[1])
      if (!e) {
        const [x, y] = top(h[0], h[1])
        this.hover.setTexture('hover').setPosition(x, y + 8).setVisible(true)
      } else {
        // hover highlight: pulsing footprint outline, and the sprite lights up
        this.outline(e.kind, e.i, e.j, 0xffe7b8, pulse)
        const s = this.sprites.get(e.id)
        if (s && e.kind !== 'belt')
          this.glow
            .setTexture(s.texture.key)
            .setOrigin(s.originX, s.originY)
            .setPosition(s.x, s.y)
            .setDepth(s.depth + 0.01)
            .setAlpha(0.16 + 0.1 * pulse)
            .setVisible(true)
        if (BUILDINGS[e.kind].outputs && e.kind !== 'belt') {
          const [ti, tj] = outTileFor(e.kind, e.i, e.j, e.dir)
          const [ax, ay] = top(ti, tj)
          this.ghostArrow.setTexture(`arrow_${e.dir}`).setPosition(ax, ay + 8).setVisible(true)
        }
      }
    }

    // shield coverage preview, measured from the whole footprint
    let area: [Kind, number, number] | null = null
    if ((tool === 'shield' || tool === 'habitat') && h) area = [tool, ...anchorFor(tool, h[0], h[1])]
    else if (sel && (sel.kind === 'shield' || sel.kind === 'habitat')) area = [sel.kind, sel.i, sel.j]
    const key = area ? `${area}` : ''
    if (key === this.rangeKey) return
    this.rangeKey = key
    this.range.clear()
    if (!area) return
    const [k, ai, aj] = area
    const { w, h: fh } = BUILDINGS[k]
    this.range.fillStyle(0x7ee07a, 0.18)
    for (let j = aj - SHIELD_RADIUS; j < aj + fh + SHIELD_RADIUS; j++)
      for (let i = ai - SHIELD_RADIUS; i < ai + w + SHIELD_RADIUS; i++) {
        const [x, y] = top(i, j)
        this.range.fillPoints([new Phaser.Math.Vector2(x, y), new Phaser.Math.Vector2(x + 16, y + 8), new Phaser.Math.Vector2(x, y + 16), new Phaser.Math.Vector2(x - 16, y + 8)], true)
      }
  }


  private drawShip() {
    const sim = this.store.sim
    if (sim.ev.ship === this.lastShip) return
    this.lastShip = sim.ev.ship
    const [x, y] = top(CORE_AT, CORE_AT)
    // core centre is (x, y + 16); its front sub-tile centre is 8px lower
    const tx = x
    const ty = y + 24 - 6 // the core's plinth is 6 px tall
    this.ship.setPosition(tx, ty - 240).setVisible(true)
    this.flame.setVisible(true)
    const follow = () => this.flame.setPosition(this.ship.x, this.ship.y + 6)
    this.tweens.chain({
      targets: this.ship,
      tweens: [
        { y: ty, duration: 1800, ease: 'Cubic.easeOut', onUpdate: follow },
        { y: ty, duration: 1400, onStart: () => this.flame.setVisible(false) },
        { y: ty - 260, duration: 1600, ease: 'Cubic.easeIn', onStart: () => this.flame.setVisible(true), onUpdate: follow },
      ],
      onComplete: () => {
        this.ship.setVisible(false)
        this.flame.setVisible(false)
      },
    })
  }
}
