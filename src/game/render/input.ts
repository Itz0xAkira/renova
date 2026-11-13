/**
 * Map input for the scene: camera pan / zoom (keys, wheel, drag, pinch) and the
 * pointer tools — place, drag-to-build belts (with junctions where a line runs
 * straight across another), right-click remove, and click to select.
 *
 * Everything here is ignored while `store.ui.inputBlocked` is set (a panel,
 * popup or the guide covers the map).
 */
import type Phaser from 'phaser'
import { BUILDINGS, type Dir, type Kind } from '@/game/core/data'
import type { GameStore } from '@/game/store'
import { anchorAt, anchorFor, centreOf, groundUV, stepDir, tileAtWorld, type Tile } from '@/game/render/iso'

const ZOOMS = [1, 2, 3, 4, 5, 6]
/** Screen px a press may wander before it counts as a drag. */
const DRAG_SLOP = 6
const PAN_SPEED = 420

type Drag = {
  mode: 'place' | 'remove' | 'pan'
  /** Last map tile the drag acted on (null until it enters the map). */
  last: Tile | null
  /** Where the press started (screen px), to tell a click from a drag. */
  sx: number
  sy: number
  /** Pointer at the last move (screen px): pans move by the difference. */
  px: number
  py: number
  moved: boolean
  /** Placing: the footprint's first tile relative to the tile under the cursor, fixed at the press so a dragged row stays evenly spaced. */
  off: { kind: Kind; di: number; dj: number } | null
  /** Entities built during this drag. */
  placed: Set<number>
  /** Touch: the first tile, placed only once the finger moves or lifts (a second finger cancels it). */
  pending: Tile | null
  /** A perpendicular belt the drag entered, with the direction it entered in: it becomes a junction only if the drag leaves straight out the far side. */
  crossing: { i: number; j: number; dir: Dir } | null
}

export class MapInput {
  private drag: Drag | null = null
  private pinch: null | { d: number; zoom: number } = null
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  /** A mouse is over the canvas (set by moves, cleared when it leaves). */
  private mouseOver = false

  constructor(
    private scene: Phaser.Scene,
    private store: GameStore,
  ) {}

  attach() {
    const input = this.scene.input
    this.keys = input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT', false) as Record<string, Phaser.Input.Keyboard.Key>
    input.addPointer(1)
    input.mouse?.disableContextMenu()
    input.on('pointerdown', this.onDown, this)
    input.on('pointermove', this.onMove, this)
    input.on('pointerup', this.onUp, this)
    input.on('pointerupoutside', this.onUp, this)
    input.on('gameout', this.onOut, this)
    input.on('wheel', this.onWheel, this)
  }

  private get blocked() {
    return this.store.ui.inputBlocked
  }

  /** Forget any gesture in progress (new game, blocked input). */
  cancel() {
    this.drag = null
    this.pinch = null
  }

  /* -------------------------------- camera -------------------------------- */

  centerOnCore() {
    const c = this.store.sim.core
    const [x, y] = centreOf(c.kind, c.i, c.j)
    this.scene.cameras.main.centerOn(x, y)
  }

  zoomBy(step: number, sx = this.scene.scale.width / 2, sy = this.scene.scale.height / 2) {
    const cam = this.scene.cameras.main
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

  tileAt(sx: number, sy: number): Tile | null {
    const p = this.scene.cameras.main.getWorldPoint(sx, sy)
    return tileAtWorld(p.x, p.y)
  }

  /** Per frame: HUD camera requests, keyboard panning, and keeping the hover tile under a still mouse. */
  update(delta: number) {
    const store = this.store
    const ui = store.ui
    if (store.centerRequest) {
      store.centerRequest = false
      this.centerOnCore()
    }
    if (store.zoomRequest) {
      this.zoomBy(store.zoomRequest)
      store.zoomRequest = 0
    }
    if (this.blocked) {
      this.cancel()
      if (ui.hover) ui.hover = null
      if (ui.pointer) ui.pointer = null
      return
    }
    const cam = this.scene.cameras.main
    const v = (delta / 1000) * (PAN_SPEED / cam.zoom)
    const k = this.keys
    if (k.A.isDown || k.LEFT.isDown) cam.scrollX -= v
    if (k.D.isDown || k.RIGHT.isDown) cam.scrollX += v
    if (k.W.isDown || k.UP.isDown) cam.scrollY -= v
    if (k.S.isDown || k.DOWN.isDown) cam.scrollY += v
    // the camera may have moved under the pointer (keys, zoom): re-pick the tile
    const p = this.scene.input.activePointer
    if (p.wasTouch ? p.isDown : this.mouseOver) this.pointAt(p.x, p.y)
  }

  /** Ground point under the pointer (continuous tile coords), for centring multi-tile builds under the cursor. */
  private uv: readonly [number, number] | null = null

  /** Track the ground under screen point (sx, sy): the hover tile and the exact point. */
  private pointAt(sx: number, sy: number) {
    const w = this.scene.cameras.main.getWorldPoint(sx, sy)
    const t = tileAtWorld(w.x, w.y)
    this.uv = t ? groundUV(w.x, w.y) : null
    this.setHover(t)
    return t
  }

  /**
   * The first tile of a `kind` footprint placed from where the pointer is: the
   * footprint centred under the cursor, or, mid-drag, offset from the hovered
   * tile the same way as at the press. Null off the map.
   */
  anchor(kind: Kind): readonly [number, number] | null {
    const h = this.store.ui.hover
    if (!h) return null
    const off = this.drag?.off
    if (off && off.kind === kind) return [h[0] + off.di, h[1] + off.dj]
    return this.uv ? anchorAt(kind, this.uv[0], this.uv[1]) : anchorFor(kind, h[0], h[1])
  }

  private setHover(t: Tile | null) {
    const h = this.store.ui.hover
    if (h === t || (h && t && h[0] === t[0] && h[1] === t[1])) return
    this.store.ui.hover = t
  }

  /* -------------------------------- pointer ------------------------------- */

  private onOut() {
    this.mouseOver = false
    this.store.ui.hover = null
    this.store.ui.pointer = null
  }

  private onWheel(p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) {
    if (this.blocked) return
    this.zoomBy(dy > 0 ? -1 : 1, p.x, p.y)
  }

  private onDown(p: Phaser.Input.Pointer) {
    if (this.blocked) return this.cancel()
    if (!p.wasTouch) this.mouseOver = true
    const pts = this.scene.input.manager.pointers.filter((q) => q.isDown)
    if (pts.length >= 2) {
      // a second finger: this is a pinch, and whatever the first finger started is dropped
      this.drag = null
      this.pinch = { d: Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y), zoom: this.store.ui.zoom }
      return
    }
    const t = this.pointAt(p.x, p.y)
    const tool = this.store.ui.tool
    const a = tool && t ? this.anchor(tool) : null
    const off = tool && t && a ? { kind: tool, di: a[0] - t[0], dj: a[1] - t[1] } : null
    const base = { sx: p.x, sy: p.y, px: p.x, py: p.y, moved: false, last: t, placed: new Set<number>(), pending: null, crossing: null, off }
    if (p.rightButtonDown()) {
      this.drag = { mode: 'remove', ...base }
      if (t) this.store.removeAt(t[0], t[1])
    } else if (p.middleButtonDown() || !this.store.ui.tool) {
      this.drag = { mode: 'pan', ...base }
    } else if (p.wasTouch) {
      // wait: this may be the first finger of a pinch
      this.drag = { mode: 'place', ...base, pending: t }
    } else {
      this.drag = { mode: 'place', ...base }
      if (t) this.placeAt(t[0], t[1])
    }
  }

  private onMove(p: Phaser.Input.Pointer) {
    if (this.blocked) return
    if (!p.wasTouch) this.mouseOver = true
    const t = this.pointAt(p.x, p.y)
    this.store.ui.pointer = [p.x, p.y]
    if (this.pinch) {
      const pts = this.scene.input.manager.pointers.filter((q) => q.isDown)
      if (pts.length >= 2) {
        const d = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y)
        const want = this.pinch.zoom * (d / this.pinch.d)
        const k = ZOOMS.reduce((best, z) => (Math.abs(z - want) < Math.abs(best - want) ? z : best), ZOOMS[0])
        if (k !== this.store.ui.zoom) this.zoomBy(ZOOMS.indexOf(k) - ZOOMS.indexOf(this.store.ui.zoom), (pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2)
      }
      return
    }
    const d = this.drag
    if (!d || !p.isDown) return
    if (!d.moved && Math.abs(p.x - d.sx) + Math.abs(p.y - d.sy) > DRAG_SLOP) d.moved = true
    if (d.mode === 'pan') {
      // move by this step's delta and keep within the camera bounds, so dragging past an edge and back has no dead zone
      const cam = this.scene.cameras.main
      cam.scrollX = cam.clampX(cam.scrollX - (p.x - d.px) / cam.zoom)
      cam.scrollY = cam.clampY(cam.scrollY - (p.y - d.py) / cam.zoom)
      d.px = p.x
      d.py = p.y
      return
    }
    if (d.pending) {
      if (!d.moved) return
      const [pi, pj] = d.pending
      d.pending = null
      this.placeAt(pi, pj)
    }
    if (!t) return
    if (!d.last) {
      // the drag has just come onto the map: this tile is its first
      d.last = t
      if (d.mode === 'remove') this.store.removeAt(t[0], t[1])
      else this.placeAt(t[0], t[1])
      return
    }
    if (d.last[0] === t[0] && d.last[1] === t[1]) return
    // walk the grid from the last tile to this one so fast drags leave no gaps
    let [ci, cj] = d.last
    while (ci !== t[0] || cj !== t[1]) {
      const pi = ci
      const pj = cj
      if (ci !== t[0]) ci += Math.sign(t[0] - ci)
      else cj += Math.sign(t[1] - cj)
      if (d.mode === 'remove') this.store.removeAt(ci, cj)
      else this.stepPlace(pi, pj, ci, cj)
    }
    d.last = t
  }

  private onUp(p: Phaser.Input.Pointer) {
    const d = this.drag
    this.cancel()
    if (!d || this.blocked) return
    // a touch tap places on release, with the drag's footprint offset
    if (d.pending) {
      this.drag = d
      this.placeAt(d.pending[0], d.pending[1])
      this.drag = null
      return
    }
    if (d.moved || d.mode !== 'pan' || p.button !== 0) return
    // a click without a tool selects
    const t = this.tileAt(p.x, p.y)
    const e = t ? this.store.sim.entAt(t[0], t[1]) : null
    this.store.ui.selected = e ? e.id : null
    this.store.bump()
  }

  /* ------------------------------- building ------------------------------- */

  /** One grid step of a placing drag, from (pi, pj) onto the neighbouring (ci, cj). */
  private stepPlace(pi: number, pj: number, ci: number, cj: number) {
    const d = this.drag!
    const sim = this.store.sim
    if (this.store.ui.tool === 'belt') {
      const dir = stepDir(pi, pj, ci, cj)
      // leaving a perpendicular belt straight out the far side: the lines cross, so it becomes a junction.
      // Turning on it instead (or stopping there) leaves it alone, which is a merge.
      const c = d.crossing
      d.crossing = null
      if (c && c.i === pi && c.j === pj && c.dir === dir) this.makeJunction(pi, pj)
      this.store.ui.dir = dir
      const prev = sim.entAt(pi, pj)
      if (prev && prev.kind === 'belt' && d.placed.has(prev.id)) sim.setDir(prev, dir)
      this.placeAt(ci, cj, dir)
      return
    }
    this.placeAt(ci, cj)
  }

  /** Build the current tool with the cursor over (hi, hj). `entry` is the drag's direction onto this tile. */
  private placeAt(hi: number, hj: number, entry?: Dir) {
    const tool = this.store.ui.tool
    if (!tool) return
    const off = this.drag?.off
    const [i, j] = off && off.kind === tool ? [hi + off.di, hj + off.dj] : anchorFor(tool, hi, hj)
    const sim = this.store.sim
    const there = sim.entAt(i, j)
    if (tool === 'belt' && there) {
      if (there.kind === 'junction') return // run straight through existing junctions
      if (there.kind === 'belt') {
        // someone else's belt: maybe a crossing, decided when the drag leaves the tile
        if (this.drag && entry !== undefined && !this.drag.placed.has(there.id) && there.dir % 2 !== entry % 2) this.drag.crossing = { i, j, dir: entry }
        return
      }
    }
    const err = sim.place(tool, i, j, this.store.ui.dir)
    if (!err) {
      const e = sim.entAt(i, j)
      if (e) this.drag?.placed.add(e.id)
      this.store.bump()
    } else if (err === 'Not enough materials' || err === 'Not researched yet') {
      sim.log(`${BUILDINGS[tool].name}: ${err.toLowerCase()}.`, 'warn')
      this.store.bump()
    }
  }

  /** Swap the belt at (i, j) for a junction (one atomic sim action that keeps its items), or say why not. */
  private makeJunction(i: number, j: number) {
    const sim = this.store.sim
    const belt = sim.entAt(i, j)
    if (!belt || belt.kind !== 'belt') return
    const err = sim.replaceWithJunction(i, j)
    if (err) sim.log(err, 'warn')
    else {
      if (this.store.ui.selected === belt.id) this.store.ui.selected = null
      const now = sim.entAt(i, j)
      if (now) this.drag?.placed.add(now.id)
    }
    this.store.bump()
  }
}
