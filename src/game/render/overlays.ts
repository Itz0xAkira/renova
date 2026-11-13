/**
 * Everything the scene draws over the world that isn't a building or a unit:
 * the cursor (hover tile, footprint outlines, glow on the hovered building,
 * build ghost and output arrows), shield range, power grid coverage and the
 * power cables strung between grid nodes.
 *
 * Coverage and cables change rarely, so they are drawn once into render
 * textures when their inputs change instead of being re-tessellated as
 * Graphics every frame.
 */
import Phaser from 'phaser'
import { FRAMES, TER_H, TER_W } from '@/game/art/sprites'
import { PYLON_TOP } from '@/game/art/structures'
import { BUILDINGS, CORE_LINK, MAP, PYLON_LINK, PYLON_REACH, SHIELD_REACH, type Kind } from '@/game/core/data'
import type { Ent } from '@/game/core/sim'
import type { GameStore } from '@/game/store'
import { CORE_ANTENNA } from '@/game/render/coreLayout'
import { setDep, setTex } from '@/game/render/display'
import { centreOf, centreX, centreY, DEPTH, depthFor, JUNCTION_ORIGIN, originOf, top } from '@/game/render/iso'

/** Cables hang above the map's top edge (pylon tops on the back rows), so their layer starts higher. */
const CABLE_PAD = 64
const COVER_ALPHA = 0.14
const COVERED = 0x65c9e8
const PREVIEW = 0xf4d03f
const OFF_GRID_TINT = 0xff9a8e
/** A solid white tile diamond (34 × 18, centre at (17, 9)), tinted per stamp. Baked here so the overlay owns it. */
const TILE_KEY = 'overlay_tile'
const COVERED_STAMP = { tint: COVERED, skipBatch: true }
const PREVIEW_STAMP = { tint: PREVIEW, skipBatch: true }

type Sprites = Map<number, Phaser.GameObjects.Image>

/** The same 32 × 16 pixel diamond as the hover outline, filled: rows 1–16 of a 34 × 18 canvas. */
function tileCanvas() {
  const cv = document.createElement('canvas')
  cv.width = 34
  cv.height = 18
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  for (let r = 0; r < 16; r++) {
    const w = r < 8 ? (r + 1) * 2 : (16 - r) * 2
    ctx.fillRect(17 - w, 1 + r, w * 2, 1)
  }
  return cv
}

export class Overlays {
  private hover: Phaser.GameObjects.Image
  private glow: Phaser.GameObjects.Image
  private ghost: Phaser.GameObjects.Image
  /** Arrows along each belt a hovered building sends its products out on (pooled). */
  private arrows: Phaser.GameObjects.Image[] = []
  private arrowsShown = 0
  private foot: Phaser.GameObjects.Graphics
  private range: Phaser.GameObjects.Graphics
  /** Grid coverage tiles, stamped opaque and faded as one layer so overlapping tile edges never darken. */
  private cover: Phaser.GameObjects.RenderTexture
  /** The cables a pylon being placed would string. */
  private coverLines: Phaser.GameObjects.Graphics
  private cables: Phaser.GameObjects.RenderTexture
  /** Off-screen pen the cables are drawn with, then rendered into `cables`. */
  private pen: Phaser.GameObjects.Graphics
  private coverageKey = ''
  private rangeKey = ''
  private cablesKey = ''

  constructor(
    private scene: Phaser.Scene,
    private store: GameStore,
    private sprites: Sprites,
    /** First tile of a footprint placed from the pointer (see MapInput.anchor). */
    private anchor: (kind: Kind) => readonly [number, number] | null,
  ) {
    const add = scene.add
    if (!scene.textures.exists(TILE_KEY)) scene.textures.addCanvas(TILE_KEY, tileCanvas())
    this.hover = add.image(0, 0, 'hover').setDepth(DEPTH.hover).setVisible(false)
    this.range = add.graphics().setDepth(DEPTH.range)
    this.foot = add.graphics().setDepth(DEPTH.footprint)
    this.cover = add.renderTexture(0, 0, TER_W, TER_H).setOrigin(0).setDepth(DEPTH.coverage).setAlpha(COVER_ALPHA).setVisible(false)
    this.coverLines = add.graphics().setDepth(DEPTH.coverageLines)
    this.cables = add.renderTexture(0, -CABLE_PAD, TER_W, TER_H + CABLE_PAD).setOrigin(0).setDepth(DEPTH.cables)
    this.pen = scene.make.graphics({}, false)
    this.glow = add.image(0, 0, 'b_solar_0').setBlendMode(Phaser.BlendModes.ADD).setVisible(false)
    this.ghost = add.image(0, 0, 'b_solar_0').setAlpha(0.6).setVisible(false)
  }

  /** A new sim: forget every cached drawing. */
  reset() {
    this.coverageKey = '-'
    this.rangeKey = '-'
    this.cablesKey = '-'
  }

  /** The layout changed: re-check coverage and the off-grid tint on the next draw. */
  invalidate() {
    this.coverageKey = '-'
  }

  /** Where a cable attaches to a grid node, in world px. */
  private nodeTop(e: Ent): [number, number] {
    const [x, y] = centreOf(e.kind, e.i, e.j)
    if (e.kind === 'pylon') return [x, y - 1 - PYLON_TOP[e.level - 1]]
    return [x + CORE_ANTENNA[0], y + CORE_ANTENNA[1]] // the antenna on the core's crew module
  }

  /** Sagging power cables between linked grid nodes, drawn pixel by pixel when the links change. */
  drawCables() {
    const sim = this.store.sim
    let key = ''
    for (const [a, b] of sim.links) key += `${a}.${sim.ents.get(a)?.level}-${b}.${sim.ents.get(b)?.level},`
    if (key === this.cablesKey) return
    this.cablesKey = key
    const g = this.pen
    g.clear()
    for (const [a, b] of sim.links) {
      const ea = sim.ents.get(a)
      const eb = sim.ents.get(b)
      if (!ea || !eb) continue
      const [x0, y0] = this.nodeTop(ea)
      const [x1, y1] = this.nodeTop(eb)
      const len = Math.hypot(x1 - x0, y1 - y0)
      const sag = Math.min(14, len * 0.08)
      const n = Math.ceil(len)
      for (let k = 0; k <= n; k++) {
        const s = k / n
        const x = Math.round(x0 + (x1 - x0) * s)
        const y = Math.round(y0 + (y1 - y0) * s + sag * 4 * s * (1 - s))
        g.fillStyle(0x151618, 1).fillRect(x, y, 1, 1)
        if (k % 3 === 0) g.fillStyle(0x3e8da8, 0.9).fillRect(x, y - 1, 1, 1)
      }
    }
    this.cables.clear()
    if (sim.links.length) this.cables.draw(g, 0, CABLE_PAD)
  }

  private diamond(g: Phaser.GameObjects.Graphics, i: number, j: number) {
    const [x, y] = top(i, j)
    g.fillTriangle(x, y, x + 16, y + 8, x, y + 16).fillTriangle(x, y, x, y + 16, x - 16, y + 8)
  }

  private outline(kind: Kind, i: number, j: number, color: number, alpha: number) {
    const { w, h } = BUILDINGS[kind]
    const [ax, ay] = top(i, j)
    const [bx, by] = top(i + w, j)
    const [cx, cy] = top(i + w, j + h)
    const [dx, dy] = top(i, j + h)
    const g = this.foot
    g.lineStyle(1, color, alpha).beginPath().moveTo(ax, ay).lineTo(bx, by).lineTo(cx, cy).lineTo(dx, dy).closePath().strokePath()
    g.fillStyle(color, alpha * 0.12).fillTriangle(ax, ay, bx, by, cx, cy).fillTriangle(ax, ay, cx, cy, dx, dy)
  }

  /** Per frame: cursor, selection, shield range and grid coverage. */
  draw() {
    const ui = this.store.ui
    const sim = this.store.sim
    const h = ui.inputBlocked ? null : ui.hover
    const tool = ui.tool
    const now = performance.now()
    const pulse = 0.65 + 0.35 * Math.sin(now / 180)
    this.foot.clear()
    this.glow.setVisible(false)
    this.hover.setVisible(false)
    this.ghost.setVisible(false)
    for (const a of this.arrows) a.setVisible(false)
    this.arrowsShown = 0
    ui.hoverErr = null

    // the selected building keeps a steady outline
    const sel = this.store.selectedEnt()
    if (sel && sel.kind !== 'belt') this.outline(sel.kind, sel.i, sel.j, 0xe8753b, 0.9)

    if (h && tool) {
      // build preview: footprint outline and ghost sprite
      const [i, j] = this.anchor(tool) ?? h
      const err = sim.placeError(tool, i, j)
      ui.hoverErr = err
      this.outline(tool, i, j, err ? 0xff5a4f : 0xfff7e8, 0.95)
      const f = Math.floor(now / 250) % FRAMES
      const [x, cy] = centreOf(tool, i, j)
      const ghost = this.ghost
      if (tool === 'belt') {
        setTex(ghost, `belt_${ui.dir}_${f}`).setOrigin(0.5)
        setDep(ghost, DEPTH.groundGhost)
      } else if (tool === 'junction') {
        setTex(ghost, `junction_${f}`).setOrigin(JUNCTION_ORIGIN[0], JUNCTION_ORIGIN[1])
        setDep(ghost, DEPTH.groundGhost)
      } else {
        const [ox, oy] = originOf(tool)
        setTex(ghost, tool === 'melter' ? `b_melter_2_${f}` : `b_${tool}_${f}`).setOrigin(ox, oy)
        setDep(ghost, depthFor(tool, i, j) + 1)
      }
      ghost.setPosition(x, cy).setVisible(true).setAlpha(err ? 0.35 : 0.7).setTint(err ? 0xff6a5f : 0xffffff)
    } else if (h) {
      const e = sim.entAt(h[0], h[1])
      if (!e) {
        const [x, y] = top(h[0], h[1])
        this.hover.setPosition(x, y + 8).setVisible(true)
      } else {
        // hover highlight: pulsing footprint outline, and the sprite lights up
        this.outline(e.kind, e.i, e.j, 0xffe7b8, pulse)
        const s = this.sprites.get(e.id)
        if (s && e.kind !== 'belt') {
          setTex(this.glow, s.texture.key).setOrigin(s.originX, s.originY).setPosition(s.x, s.y).setAlpha(0.16 + 0.1 * pulse).setVisible(true)
          setDep(this.glow, s.depth + 0.01)
        }
        // where its products go: an arrow along every belt or junction it feeds
        if (BUILDINGS[e.kind].outputs && e.kind !== 'belt') for (const o of sim.outletsOf(e)) if (o.kind !== 'building') this.showArrow(o.i, o.j, o.dir)
      }
    }

    this.drawCoverage(h)
    this.drawRange(h, sel)
  }

  private showArrow(ti: number, tj: number, dir: number) {
    const [ax, ay] = top(ti, tj)
    let a = this.arrows[this.arrowsShown++]
    if (!a) {
      a = this.scene.add.image(0, 0, `arrow_${dir}`).setDepth(DEPTH.overlay)
      this.arrows.push(a)
    }
    setTex(a, `arrow_${dir}`).setPosition(ax, ay + 8).setVisible(true)
  }


  /** Shield coverage preview, measured from the whole footprint. */
  private drawRange(h: [number, number] | null, sel: Ent | null) {
    const tool = this.store.ui.tool
    let area: [Kind, number, number] | null = null
    let reach = SHIELD_REACH[0]
    const a = (tool === 'shield' || tool === 'habitat') && h ? this.anchor(tool) : null
    if (tool && a) area = [tool, a[0], a[1]]
    else if (sel && (sel.kind === 'shield' || sel.kind === 'habitat')) {
      area = [sel.kind, sel.i, sel.j]
      if (sel.kind === 'shield') reach = SHIELD_REACH[sel.level - 1]
    }
    const key = area ? `${area}:${reach}` : ''
    if (key === this.rangeKey) return
    this.rangeKey = key
    const g = this.range
    g.clear()
    if (!area) return
    const [k, ai, aj] = area
    const { w, h: fh } = BUILDINGS[k]
    g.fillStyle(0x7ee07a, 0.18)
    for (let j = aj - reach; j < aj + fh + reach; j++) for (let i = ai - reach; i < ai + w + reach; i++) this.diamond(g, i, j)
  }

  /**
   * Grid coverage: shown in the power view (P), and automatically while placing
   * a pylon or anything that uses or makes power. A pylon being placed also
   * previews its own square and the cables it would string. Buildings that need
   * the grid but aren't on it are tinted while it shows.
   */
  private drawCoverage(h: [number, number] | null) {
    const ui = this.store.ui
    const sim = this.store.sim
    const tool = ui.tool
    const def = tool ? BUILDINGS[tool] : null
    const show = ui.powerView || tool === 'pylon' || (!!def && (def.power > 0 || !!def.gen))
    const key = show ? `${sim.rev}:${tool}:${tool === 'pylon' && h ? h : ''}:${ui.powerView}` : ''
    if (key === this.coverageKey) return
    this.coverageKey = key
    for (const e of sim.ents.values()) {
      const s = this.sprites.get(e.id)
      if (!s || e.kind === 'belt' || e.kind === 'junction') continue
      const needs = BUILDINGS[e.kind].power > 0 || !!BUILDINGS[e.kind].gen
      s.setTint(show && needs && !e.onGrid ? OFF_GRID_TINT : 0xffffff)
    }
    const rt = this.cover
    const lines = this.coverLines
    rt.clear()
    lines.clear()
    rt.setVisible(show)
    if (!show) return
    const stamp = (i: number, j: number, config: typeof COVERED_STAMP) => rt.stamp(TILE_KEY, undefined, centreX(i, j), centreY(i, j), config)
    rt.beginDraw()
    for (let j = 0; j < MAP; j++) for (let i = 0; i < MAP; i++) if (sim.covered[j * MAP + i]) stamp(i, j, COVERED_STAMP)
    if (tool === 'pylon' && h) {
      const r = PYLON_REACH[0]
      for (let j = h[1] - r; j <= h[1] + r; j++) for (let i = h[0] - r; i <= h[0] + r; i++) if (i >= 0 && j >= 0 && i < MAP && j < MAP && !sim.covered[j * MAP + i]) stamp(i, j, PREVIEW_STAMP)
    }
    rt.endDraw()
    if (tool === 'pylon' && h) {
      // cables it would string to nodes in reach
      const [px, py] = top(h[0] + 0.5, h[1] + 0.5)
      for (const n of sim.ents.values()) {
        if ((n.kind !== 'pylon' && n.kind !== 'core') || !n.onGrid) continue
        const ci = n.i + (BUILDINGS[n.kind].w - 1) / 2
        const cj = n.j + (BUILDINGS[n.kind].h - 1) / 2
        if (Math.hypot(ci - h[0], cj - h[1]) > Math.max(PYLON_LINK[0], n.kind === 'core' ? CORE_LINK : PYLON_LINK[n.level - 1])) continue
        const [nx, ny] = this.nodeTop(n)
        lines.lineStyle(1, PREVIEW, 0.8).lineBetween(px, py - PYLON_TOP[0] - 1, nx, ny)
      }
    }
  }
}
