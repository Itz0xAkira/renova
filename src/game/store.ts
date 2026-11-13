/**
 * The bridge between the simulation, the Phaser scene and the React HUD.
 * Phaser mutates the sim every frame; React re-reads it when `version` bumps.
 * All UI actions go through here so the HUD, the keyboard and the scene agree.
 */
import { type Dir, type Kind } from '@/game/core/data'
import { OutdatedSaveError, Sim, type Ent, type SaveData } from '@/game/core/sim'

const SAVE_KEY = 'renova-save-v1'
/** Where an unreadable save is kept, so a bad save never crashes the game twice and nothing is silently lost. */
const BROKEN_KEY = 'renova-save-broken'

export type Panel = null | 'research' | 'menu' | 'help' | 'power'

export type UIState = {
  tool: Kind | null
  dir: Dir
  selected: number | null
  speed: 1 | 2 | 3
  paused: boolean
  hover: [number, number] | null
  hoverErr: string | null
  /** Footprint top-left of the build ghost under the cursor (set by the scene), for hints. */
  ghostAt: [number, number] | null
  panel: Panel
  zoom: number
  /** Pointer position in screen pixels, for the cursor hint. */
  pointer: [number, number] | null
  /** Power view: grid coverage and unconnected buildings (key P). */
  powerView: boolean
  /**
   * True while a panel, popup or the guide covers the map. The scene must
   * ignore world input (keyboard panning, placing, hover) while it is set.
   * Recomputed on every bump.
   */
  inputBlocked: boolean
}

const freshUI = (zoom = 3): UIState => ({
  tool: null,
  dir: 0,
  selected: null,
  speed: 1,
  paused: false,
  hover: null,
  hoverErr: null,
  ghostAt: null,
  panel: null,
  zoom,
  pointer: null,
  powerView: false,
  inputBlocked: false,
})

export class GameStore {
  sim: Sim
  ui: UIState = freshUI()
  version = 0
  /** Bumped when a whole new sim replaces the old one, so the scene rebuilds. */
  epoch = 0
  private listeners = new Set<() => void>()
  /** Camera commands from the HUD, consumed by the scene. */
  zoomRequest = 0
  centerRequest = false
  /** True until the first guide is dismissed on a new game. */
  firstRun = false
  /** Where the guide was opened from, so closing it returns there. */
  helpFrom: Panel = null
  /** Set when another tab has taken over this save: this tab stops writing to it. */
  readOnly = false
  /** Notice shown when loading or saving went wrong. */
  notice: string | null = null

  constructor() {
    const saved = GameStore.readSave()
    let sim: Sim | null = null
    if (saved) {
      try {
        sim = Sim.load(saved)
      } catch (err) {
        // a save we can't read: keep a copy and start a fresh colony instead of crashing on every load
        try {
          localStorage.setItem(BROKEN_KEY, JSON.stringify(saved))
          localStorage.removeItem(SAVE_KEY)
        } catch {
          /* storage unavailable */
        }
        this.notice =
          err instanceof OutdatedSaveError
            ? 'RENOVA has grown: buildings are bigger and the map is larger, so older colonies no longer fit. A new colony was started. Your old save was kept.'
            : 'Your last save could not be loaded, so a new colony was started. A copy was kept.'
        if (!(err instanceof OutdatedSaveError)) console.warn('[renova] unreadable save', err)
      }
    }
    this.sim = sim ?? GameStore.fresh()
    // brand-new players start with the guide open
    if (!sim) {
      this.firstRun = true
      this.ui.panel = 'help'
    }
  }

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
      return d && typeof d === 'object' ? d : null
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
    this.ui.inputBlocked = !!this.ui.panel || this.sim.popups.length > 0
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

  /** Escape peels back one layer at a time: popup → guide/panel → tool → selection → menu. */
  escape() {
    const popup = this.sim.popups[0]
    if (popup) {
      // a lost game can't be dismissed: its card offers the only ways out
      if (popup.kind !== 'lose') this.sim.popups.shift()
    } else if (this.ui.panel === 'help') this.closeHelp()
    else if (this.ui.panel) {
      this.ui.panel = null
      this.firstRun = false
    } else if (this.ui.tool) this.ui.tool = null
    else if (this.ui.selected) this.ui.selected = null
    else this.ui.panel = 'menu'
    this.bump()
  }

  togglePowerView() {
    this.ui.powerView = !this.ui.powerView
    this.bump()
  }

  upgrade(e: Ent) {
    const err = this.sim.upgrade(e)
    if (err) this.sim.log(err, 'warn')
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
    const next = this.ui.panel === p ? null : p
    // the guide remembers where it was opened from
    if (next === 'help') this.helpFrom = this.ui.panel === 'help' ? this.helpFrom : this.ui.panel
    this.ui.panel = next
    if (!this.ui.panel) this.firstRun = false
    this.bump()
  }

  /** Close the guide and go back to wherever it was opened from. */
  closeHelp() {
    this.ui.panel = this.helpFrom === 'menu' ? 'menu' : null
    this.helpFrom = null
    this.firstRun = false
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
    this.ui = { ...freshUI(this.ui.zoom), panel: 'help' }
    this.firstRun = true
    this.helpFrom = null
    this.epoch++
    this.centerRequest = true
    this.save()
    this.bump()
  }

  /** Write the save. Returns false when it couldn't (storage blocked or full, or another tab owns the save). */
  save(): boolean {
    if (this.readOnly) return false
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.sim.save()))
      return true
    } catch {
      return false
    }
  }

  /* --------------------------- multi-tab safety --------------------------- */

  /**
   * Only one tab may own the save. Each tab announces itself on a broadcast
   * channel; when a newer tab opens the game, older tabs stop saving and say so,
   * instead of quietly overwriting each other every few seconds.
   */
  claimSave(): () => void {
    if (typeof BroadcastChannel === 'undefined') return () => {}
    const me = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const ch = new BroadcastChannel('renova-save')
    ch.onmessage = (ev: MessageEvent<{ type: string; id: string }>) => {
      if (ev.data?.type === 'claim' && ev.data.id !== me && !this.readOnly) {
        this.save() // hand over our latest progress first
        this.readOnly = true
        this.notice = 'RENOVA is open in another tab, so this tab has stopped saving. Reload here to continue in this tab.'
        this.ui.paused = true
        this.bump()
      }
    }
    ch.postMessage({ type: 'claim', id: me })
    return () => ch.close()
  }

  dismissNotice() {
    this.notice = null
    this.bump()
  }
}
