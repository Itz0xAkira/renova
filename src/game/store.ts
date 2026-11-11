/**
 * The bridge between the simulation, the Phaser scene and the React HUD.
 * Phaser mutates the sim every frame; React re-reads it when `version` bumps.
 */
import { BUILDINGS, type Dir, type Kind } from './data'
import { Sim, type Ent, type SaveData } from './sim'

const SAVE_KEY = 'renova-save-v1'

export type Panel = null | 'research' | 'menu' | 'help'

export type UIState = {
  tool: Kind | null
  dir: Dir
  selected: number | null
  speed: 1 | 2 | 3
  paused: boolean
  hover: [number, number] | null
  hoverErr: string | null
  panel: Panel
  zoom: number
  /** Pointer position in screen pixels, for the cursor hint. */
  pointer: [number, number] | null
}

export class GameStore {
  sim: Sim
  ui: UIState = { tool: null, dir: 0, selected: null, speed: 1, paused: false, hover: null, hoverErr: null, panel: null, zoom: 3, pointer: null }
  version = 0
  /** Bumped when a whole new sim replaces the old one, so the scene rebuilds. */
  epoch = 0
  private listeners = new Set<() => void>()
  /** Camera commands from the HUD, consumed by the scene. */
  zoomRequest = 0
  centerRequest = false

  constructor() {
    const saved = GameStore.readSave()
    this.sim = saved ? Sim.load(saved) : GameStore.fresh()
    // brand-new players start with the guide open
    if (!saved) {
      this.firstRun = true
      this.ui.panel = 'help'
    }
  }

  /** True until the first guide is dismissed on a new game. */
  firstRun = false

  static fresh(seed?: number) {
    const s = new Sim(seed)
    s.log('Colony core online. Four crew aboard.', 'good')
    return s
  }

  static readSave(): SaveData | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY)
      if (!raw) return null
      const d = JSON.parse(raw) as SaveData
      return d.v === 1 ? d : null
    } catch {
      return null
    }
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  getVersion = () => this.version

  bump() {
    this.version++
    this.listeners.forEach((f) => f())
  }

  /* ---------------------------- UI actions ---------------------------- */

  setTool(k: Kind | null) {
    if (k && (!this.sim.unlocked(k) || k === 'core')) return
    this.ui.tool = this.ui.tool === k ? null : k
    if (this.ui.tool) this.ui.selected = null
    this.bump()
  }

  rotate(by: 1 | -1 = 1) {
    if (this.ui.tool) {
      this.ui.dir = ((this.ui.dir + by + 4) % 4) as Dir
    } else {
      const e = this.hovered() ?? this.selectedEnt()
      if (e) this.sim.rotate(e, by)
    }
    this.bump()
  }

  pipette() {
    const e = this.hovered()
    if (!e || e.kind === 'core') return
    this.ui.tool = e.kind
    this.ui.dir = e.dir
    this.ui.selected = null
    this.bump()
  }

  escape() {
    if (this.ui.panel) {
      this.ui.panel = null
      this.firstRun = false
    }
    else if (this.ui.tool) this.ui.tool = null
    else if (this.ui.selected) this.ui.selected = null
    else this.ui.panel = 'menu'
    this.bump()
  }

  togglePause() {
    this.ui.paused = !this.ui.paused
    this.bump()
  }

  setSpeed(s: 1 | 2 | 3) {
    this.ui.speed = s
    this.ui.paused = false
    this.bump()
  }

  setPanel(p: Panel) {
    this.ui.panel = this.ui.panel === p ? null : p
    if (!this.ui.panel) this.firstRun = false
    this.bump()
  }

  hovered(): Ent | null {
    const h = this.ui.hover
    return h ? this.sim.entAt(h[0], h[1]) : null
  }

  selectedEnt(): Ent | null {
    return this.ui.selected ? (this.sim.ents.get(this.ui.selected) ?? null) : null
  }

  removeAt(i: number, j: number) {
    const e = this.sim.remove(i, j)
    if (e && this.ui.selected === e.id) this.ui.selected = null
    if (e) this.bump()
    return e
  }

  closePopup() {
    this.sim.popups.shift()
    this.bump()
  }

  newGame() {
    this.sim = GameStore.fresh()
    this.ui = { ...this.ui, tool: null, selected: null, panel: 'help', paused: false }
    this.firstRun = true
    this.epoch++
    this.centerRequest = true
    this.save()
    this.bump()
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.sim.save()))
    } catch {
      /* storage can be unavailable (private mode); the game still runs */
    }
  }

  costLabel(k: Kind) {
    const c = BUILDINGS[k].cost
    return [c.metal ? `${c.metal} metal` : '', c.brick ? `${c.brick} brick` : ''].filter(Boolean).join(' · ') || 'free'
  }
}
