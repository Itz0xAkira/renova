'use client'

import { BUILDINGS } from '@/game/core/data'
import type { GameStore } from '@/game/store'
import { Icon, panel, STATUS } from './kit'
import { placeHint } from './power'

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
    if (ui.hoverErr)
      return (
        <p aria-hidden className={`${panel} pointer-events-none absolute z-10 flex items-center gap-1 whitespace-nowrap border-[#B03E53] px-2 py-1 text-[11px] text-[#F3A6B6]`} style={at}>
          <Icon name="warn" size={16} /> {ui.hoverErr}
        </p>
      )
    // anything on the grid: say whether this spot gets power, and through what
    const hint = ui.ghostAt && placeHint(store.sim, ui.tool, ui.ghostAt[0], ui.ghostAt[1])
    if (!hint) return null
    return (
      <p
        aria-hidden
        className={`${panel} pointer-events-none absolute z-10 flex max-w-[22rem] items-start gap-1.5 px-2 py-1 font-sans text-[12px] normal-case leading-snug ${hint.ok ? 'border-[#3E8DA8] text-[#9fe3f5]' : 'border-[#C17A00] text-[#F4D03F]'}`}
        style={at}
      >
        <Icon name="power" size={16} /> {hint.text}
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
      {flat && e.status === 'blocked' && (
        <span className="mt-0.5 flex items-center gap-1 text-[#F4D03F]">
          <span className={`inline-block h-1.5 w-1.5 ${dot}`} />
          Jammed
        </span>
      )}
      {!flat && e.kind !== 'shield' && (
        <span className="mt-0.5 flex items-center gap-1">
          <span className={`inline-block h-1.5 w-1.5 ${dot}`} />
          {label}
        </span>
      )}
    </p>
  )
}
