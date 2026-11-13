'use client'

import { BUILDINGS } from '@/game/core/data'
import type { GameStore } from '@/game/store'
import { Icon, panel, STATUS } from './kit'

/** The label that follows the cursor. */

/** Next to the cursor: why a build won't work, or the building under it. */
export function CursorHint({ store }: { store: GameStore }) {
  const { ui } = store
  if (!ui.pointer || ui.panel) return null
  // flip to the other side of the cursor near the right and bottom edges so the hint never leaves the screen
  const [x, y] = ui.pointer
  const vw = typeof window === 'undefined' ? 1e4 : window.innerWidth
  const vh = typeof window === 'undefined' ? 1e4 : window.innerHeight
  const at = {
    ...(x > vw - 240 ? { right: vw - x + 12 } : { left: x + 18 }),
    ...(y > vh - 120 ? { bottom: vh - y + 10 } : { top: y + 14 }),
  }
  if (ui.tool) {
    if (!ui.hoverErr) return null
    return (
      <p aria-hidden className={`${panel} pointer-events-none absolute z-10 flex items-center gap-1 whitespace-nowrap border-[#B03E53] px-2 py-1 text-[11px] text-[#F3A6B6]`} style={at}>
        <Icon name="warn" size={16} /> {ui.hoverErr}
      </p>
    )
  }
  const e = store.hovered()
  if (!e) return null
  const def = BUILDINGS[e.kind]
  const [label, dot] = STATUS[e.status]
  const flat = e.kind === 'belt' || e.kind === 'junction'
  return (
    <p aria-hidden className={`${panel} pointer-events-none absolute z-10 whitespace-nowrap px-2 py-1 text-[11px]`} style={at}>
      <span className="text-white">{def.name}</span>
      <span className="text-[#8A8A8A]">
        {' '}
        · {def.w}×{def.h}
      </span>
      {!flat && e.kind !== 'shield' && (
        <span className="mt-0.5 flex items-center gap-1">
          <span className={`inline-block h-1.5 w-1.5 ${dot}`} />
          {label}
        </span>
      )}
    </p>
  )
}
