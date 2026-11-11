'use client'

import { useEffect } from 'react'
import { HOTKEYS, type Kind } from '@/game/core/data'
import type { GameStore } from '@/game/store'

const BY_KEY = Object.fromEntries(Object.entries(HOTKEYS).map(([k, v]) => [v, k])) as Record<string, Kind>

/**
 * Game keyboard shortcuts. While a panel, popup or the guide is open only
 * Escape (and the open panel's own key) work, so nothing happens to the map
 * behind it. Keys are ignored while a HUD button or link has focus, so Space
 * and Enter press that button instead of also pausing the game.
 */
export function useHotkeys(store: GameStore) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target
      if (target instanceof HTMLElement && (target.closest('button, a, input, textarea, select') || target.isContentEditable) && e.key !== 'Escape') return
      const { ui, sim } = store
      const k = e.key
      const toggle = !e.repeat // held keys shouldn't flip toggles back and forth

      if (k === 'Escape') {
        if (toggle) store.escape()
        e.preventDefault()
        return
      }
      // a panel or popup is covering the map: only its own key closes it
      if (ui.panel || sim.popups.length) {
        if (toggle && ((ui.panel === 'research' && (k === 't' || k === 'T')) || (ui.panel === 'help' && (k === 'h' || k === '?')))) {
          store.setPanel(null)
          e.preventDefault()
        }
        return
      }

      if (BY_KEY[k]) store.setTool(BY_KEY[k])
      else if (k === 'r' || k === 'R') store.rotate(e.shiftKey ? -1 : 1)
      else if (k === 'q' || k === 'Q') store.pipette()
      else if (k === ' ' && toggle) store.togglePause()
      else if ((k === 't' || k === 'T') && toggle) store.setPanel('research')
      else if ((k === 'h' || k === '?') && toggle) store.setPanel('help')
      else if (k === 'c' || k === 'C') store.centerRequest = true
      else if (k === '+' || k === '=') store.zoomRequest = 1
      else if (k === '-' || k === '_') store.zoomRequest = -1
      else if ((k === 'p' || k === 'P') && toggle) store.togglePowerView()
      else if ((k === 'u' || k === 'U') && toggle) {
        const target = store.selectedEnt() ?? store.hovered()
        if (target) store.upgrade(target)
      } else if ((k === 'x' || k === 'X' || k === 'Delete') && ui.hover) store.removeAt(ui.hover[0], ui.hover[1])
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [store])
}
