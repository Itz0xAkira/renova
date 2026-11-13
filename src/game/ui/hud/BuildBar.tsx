'use client'

import { useState } from 'react'
import { BUILD_ORDER, BUILDINGS, HOTKEYS, RESEARCH, type BuildingDef, type Kind } from '@/game/core/data'
import type { GameStore } from '@/game/store'
import { btn, btnOn, CATEGORY, Cost, Icon, panel, Recipe, TONE } from './kit'

/** The build bar, grouped by category, and the info card for the building being hovered or placed. */

export function BuildCard({ store, def }: { store: GameStore; def: BuildingDef }) {
  const { sim, ui } = store
  const dirs = ['↘', '↙', '↖', '↗']
  const locked = !sim.unlocked(def.kind)
  return (
    <div className={`${panel} max-w-xl border-t-2 border-t-[#C8754D] p-2.5`}>
      <p className="flex flex-wrap items-center gap-2 text-sm text-white">
        {def.name}
        <span className="border border-[#3F4246] px-1 text-[10px] text-[#8A8A8A]">
          {def.w}×{def.h}
        </span>
        <span className="ml-auto inline-flex items-center gap-2 text-[12px]">
          <Cost def={def} poor={!sim.affordable(def.kind)} />
          {def.power > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[#BFBFBF]">
              <Icon name="power" size={16} />
              {def.power}kW
            </span>
          )}
          {def.gen && (
            <span className={`inline-flex items-center gap-0.5 ${TONE.cyan}`}>
              <Icon name="power" size={16} />+{def.gen}kW
            </span>
          )}
        </span>
      </p>
      <p className="mt-1 font-sans text-[14px] normal-case leading-snug text-[#D9D9D9]">{def.desc}</p>
      {(def.recipe || def.mines) && (
        <p className="mt-1.5 font-sans text-[13px] normal-case">
          <Recipe def={def} />
        </p>
      )}
      {locked && (
        <p className={`mt-1.5 flex items-center gap-1.5 ${TONE.warn}`}>
          <Icon name="lock" size={16} /> Research {RESEARCH.find((r) => r.id === def.research)?.name}
        </p>
      )}
      {ui.tool === def.kind && (
        <p className={`mt-1.5 ${TONE.label}`}>
          Facing {dirs[ui.dir]} · R rotate · drag to build · right-click remove
        </p>
      )}
    </div>
  )
}

export function BottomBar({ store, thumbs }: { store: GameStore; thumbs: Record<Kind, string> }) {
  const { sim, ui } = store
  const [peek, setPeek] = useState<Kind | null>(null)
  const show = peek ?? ui.tool
  return (
    <div className="pointer-events-auto flex flex-col gap-1.5">
      <div className="flex flex-wrap items-end justify-between gap-1.5">
        {show ? (
          <BuildCard store={store} def={BUILDINGS[show]} />
        ) : (
          <p className={`${panel} hidden px-2.5 py-1.5 text-[#8A8A8A] sm:block`}>Click a building to inspect · drag to pan · wheel to zoom · H for help</p>
        )}
        <div className="flex gap-1">
          <button type="button" className={btn} onClick={() => (store.zoomRequest = -1)} aria-label="Zoom out">
            −
          </button>
          <button type="button" className={btn} onClick={() => (store.zoomRequest = 1)} aria-label="Zoom in">
            +
          </button>
          <button type="button" className={`${btn} ${ui.powerView ? btnOn : ''}`} onClick={() => store.togglePowerView()} aria-pressed={ui.powerView} title="Power view · P">
            <Icon name="power" size={18} /> Grid · P
          </button>
          <button type="button" className={btn} onClick={() => (store.centerRequest = true)}>
            <Icon name="crew" size={18} /> Core · C
          </button>
        </div>
      </div>
      <div className={`${panel} flex items-stretch gap-0 overflow-x-auto border-t-2 border-t-[#A95738]`} role="toolbar" aria-label="Build">
        {CATEGORY.map((cat) => {
          const kinds = BUILD_ORDER.filter((k) => BUILDINGS[k].group === cat.id)
          if (!kinds.length) return null
          return (
            <div key={cat.id} className="flex flex-col border-r border-[#3F4246] last:border-r-0">
              <p className="flex items-center gap-1 px-1.5 pt-1 text-[10px] text-[#8A8A8A]">
                <Icon name={cat.icon} size={13} /> {cat.name}
              </p>
              <div className="flex gap-1 p-1">
                {kinds.map((k) => {
                  const d = BUILDINGS[k]
                  const locked = !sim.unlocked(k)
                  const poor = !sim.affordable(k)
                  const sel = ui.tool === k
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={sel}
                      aria-label={d.name}
                      aria-disabled={locked}
                      title={locked ? `${d.name} · locked` : `${d.name}${HOTKEYS[k] ? ` · ${HOTKEYS[k]}` : ''}`}
                      onClick={() => !locked && store.setTool(k)}
                      onMouseEnter={() => setPeek(k)}
                      onMouseLeave={() => setPeek(null)}
                      onFocus={() => setPeek(k)}
                      onBlur={() => setPeek(null)}
                      className={`relative flex w-[5.6rem] shrink-0 flex-col items-center border px-1 pb-1 pt-0.5 transition-colors ${
                        sel ? 'border-[#C8754D] bg-[#A95738]/30 shadow-[inset_0_0_0_1px_#D58B59]' : 'border-[#3F4246] bg-[#2E3033] hover:border-[#8A8A8A]'
                      } ${locked ? 'cursor-not-allowed opacity-40' : ''}`}
                    >
                      {HOTKEYS[k] && <span className="absolute left-1 top-0.5 text-[10px] text-[#8A8A8A]">{HOTKEYS[k]}</span>}
                      {(d.w > 1 || d.h > 1) && (
                        <span className="absolute right-0.5 top-0.5 bg-[#151618] px-0.5 text-[9px] text-[#65C9E8]">
                          {d.w}×{d.h}
                        </span>
                      )}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={thumbs[k]} alt="" width={40} height={48} className="pixelated h-16 w-[3.35rem]" />
                      <span className="text-[11px] leading-tight text-white">{d.short}</span>
                      <span className="mt-0.5 text-[10px] leading-none">{locked ? <Icon name="lock" size={13} /> : <Cost def={d} poor={poor} />}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
