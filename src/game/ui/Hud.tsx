'use client'

import { useMemo } from 'react'
import { thumbURL } from '@/game/art/sprites'
import { BUILD_ORDER, type Kind } from '@/game/core/data'
import type { GameStore } from '@/game/store'
import { HowToPlay } from './HowToPlay'
import { BottomBar } from './hud/BuildBar'
import { CursorHint } from './hud/CursorHint'
import { Inspector } from './hud/Inspector'
import { Icon, panel } from './hud/kit'
import { Missions } from './hud/Missions'
import { Menu } from './hud/panels/Menu'
import { PopupCard } from './hud/panels/PopupCard'
import { PowerPanel } from './hud/panels/PowerPanel'
import { CommsPanel } from './hud/panels/Comms'
import { Research } from './hud/panels/Research'
import { TopBar } from './hud/TopBar'
import { useHotkeys } from './hud/useHotkeys'

/**
 * The game HUD: composition and layering only. The wrapper ignores the pointer
 * so the map stays clickable between panels; each panel opts back in.
 * Layers, bottom to top: HUD panels → cursor hint → side panels (research,
 * power, menu) → popups → the guide.
 */
/** Where the game's flares come from, for the guide. */
function sunText(store: GameStore) {
  const w = store.spaceWeather
  if (w.status === 'loading') return 'checking NASA’s live feed…'
  if (w.status === 'archive') return 'the live feed couldn’t be reached, so the game is using the 2024 archive'
  return `live: ${w.recs.length} real flare${w.recs.length === 1 ? '' : 's'} from the last 30 days, the strongest an ${w.recs[0].cls}`
}

export function Hud({ store }: { store: GameStore }) {
  const { sim, ui } = store
  const thumbs = useMemo(() => Object.fromEntries(BUILD_ORDER.map((k) => [k, thumbURL(k)])) as Record<Kind, string>, [])
  useHotkeys(store)

  const inspect = store.selectedEnt()
  const popup = sim.popups[0]
  const blocked = !!ui.panel || !!popup

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between gap-2.5 p-2 text-[12px] uppercase text-[#D9D9D9] sm:p-4">
      <TopBar store={store} />
      <div className="flex min-h-0 flex-1 flex-col items-start justify-between gap-2 sm:flex-row">
        <Missions store={store} />
        {inspect && <Inspector store={store} e={inspect} thumb={thumbs[inspect.kind] ?? thumbURL(inspect.kind)} />}
      </div>
      <BottomBar store={store} thumbs={thumbs} />
      {!blocked && <CursorHint store={store} />}
      {ui.paused && !blocked && (
        <p className={`${panel} pointer-events-none absolute left-1/2 top-1/3 flex -translate-x-1/2 items-center gap-2 border-[#C8754D] px-4 py-2 text-sm text-white`}>
          <Icon name="pause" /> Paused · space to resume
        </p>
      )}
      {ui.panel === 'research' && <Research store={store} />}
      {ui.panel === 'menu' && <Menu store={store} />}
      {ui.panel === 'power' && <PowerPanel store={store} />}
      {ui.panel === 'comms' && <CommsPanel store={store} />}
      {popup && (
        <div className="absolute inset-0 z-30">
          <PopupCard store={store} />
        </div>
      )}
      {ui.panel === 'help' && (
        <div className="absolute inset-0 z-40">
          <HowToPlay sun={sunText(store)} onClose={() => store.closeHelp()} doneLabel={store.firstRun ? 'Begin mission' : store.helpFrom === 'menu' ? 'Back to the menu' : 'Back to the colony'} />
        </div>
      )}
    </div>
  )
}
