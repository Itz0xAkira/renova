'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { BUILD_ORDER, BUILDINGS, HOTKEYS, RESEARCH, type BuildingDef, type Kind } from '@/game/core/data'
import type { GameStore } from '@/game/store'
import { btn, btnOn, CATEGORY, categoryOf, Cost, Icon, panel, Recipe, TONE } from './kit'

/** The build bar, grouped by category, and the info card for the building being hovered or placed. */

export function BuildCard({ store, def }: { store: GameStore; def: BuildingDef }) {
  const { sim, ui } = store
  const dirs = ['↘', '↙', '↖', '↗']
  const locked = !sim.unlocked(def.kind)
  const cat = categoryOf(def.group)
  return (
    <div className={`${panel} max-w-xl p-2.5`} style={{ borderTop: `2px solid ${cat.color}` }}>
      <p className="flex flex-wrap items-center gap-2 text-sm text-white">
        {def.name}
        <span className="px-1 text-[10px]" style={{ color: cat.color, border: `1px solid ${cat.color}80` }}>
          {cat.name}
        </span>
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
          {def.kind === 'belt' ? `Facing ${dirs[ui.dir]} · R rotate · drag to lay a line · right-click remove` : def.outputs ? 'Belts plug into any side: pointing away takes products out, pointing in feeds it · touching buildings hand over directly' : 'Click to build · drag to build a row · right-click remove'}
        </p>
      )}
    </div>
  )
}

/** The tray of buildings that opens above a category tab, tinted in that category's colour. */
function Tray({ store, thumbs, cat, onPeek }: { store: GameStore; thumbs: Record<Kind, string>; cat: (typeof CATEGORY)[number]; onPeek: (k: Kind | null) => void }) {
  const { sim, ui } = store
  const kinds = BUILD_ORDER.filter((k) => BUILDINGS[k].group === cat.id)
  return (
    <div
      id="build-tray"
      role="toolbar"
      aria-label={`${cat.name} buildings`}
      className={`${panel} max-w-full overflow-x-auto motion-safe:animate-[rise_160ms_ease-out]`}
      style={{ borderTop: `3px solid ${cat.color}` }}
    >
      <p className="flex items-center gap-2 px-2.5 pt-1.5 text-[11px]">
        <span style={{ color: cat.color }}>{cat.name}</span>
        <span className="hidden font-sans normal-case text-[#8A8A8A] sm:inline">{cat.blurb}</span>
        <button type="button" onClick={() => store.toggleDrawer(cat.id)} className="ml-auto px-1 text-[#8A8A8A] hover:text-white" aria-label={`Close ${cat.name}`}>
          ✕
        </button>
      </p>
      <div className="flex gap-1.5 p-1.5">
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
              onMouseEnter={() => onPeek(k)}
              onMouseLeave={() => onPeek(null)}
              onFocus={() => onPeek(k)}
              onBlur={() => onPeek(null)}
              className={`relative flex w-[6.2rem] shrink-0 flex-col items-center border px-1 pb-1 pt-0.5 transition-colors hover:brightness-125 ${locked ? 'cursor-not-allowed opacity-40' : ''}`}
              style={{
                borderColor: sel ? cat.color : '#3F4246',
                background: sel ? `${cat.color}40` : `linear-gradient(to bottom, #2E3033 70%, ${cat.color}22)`,
                boxShadow: sel ? `inset 0 0 0 1px ${cat.color}` : `inset 0 -2px 0 ${cat.color}99`,
              }}
            >
              {HOTKEYS[k] && <span className="absolute left-1 top-0.5 text-[10px] text-[#BFBFBF]">{HOTKEYS[k]}</span>}
              {(d.w > 1 || d.h > 1) && (
                <span className="absolute right-0.5 top-0.5 bg-[#151618] px-0.5 text-[9px]" style={{ color: cat.color }}>
                  {d.w}×{d.h}
                </span>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbs[k]} alt="" width={40} height={48} className="pixelated h-[4.5rem] w-[3.75rem]" />
              <span className="text-[11px] leading-tight text-white">{d.short}</span>
              <span className="mt-0.5 text-[10px] leading-none">{locked ? <Icon name="lock" size={13} /> : <Cost def={d} poor={poor} />}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function BottomBar({ store, thumbs }: { store: GameStore; thumbs: Record<Kind, string> }) {
  const { sim, ui } = store
  const [peek, setPeek] = useState<Kind | null>(null)
  const show = peek ?? ui.tool
  const open = ui.drawer ? categoryOf(ui.drawer) : null
  // the tray opens right above its tab, kept on screen
  const root = useRef<HTMLDivElement>(null)
  const tray = useRef<HTMLDivElement>(null)
  const tabs = useRef<Partial<Record<string, HTMLButtonElement | null>>>({})
  const [trayLeft, setTrayLeft] = useState(0)
  useLayoutEffect(() => {
    const place = () => {
      const tab = ui.drawer && tabs.current[ui.drawer]
      if (!tab || !root.current || !tray.current) return
      const box = root.current.getBoundingClientRect()
      const t = tab.getBoundingClientRect()
      const w = tray.current.offsetWidth
      setTrayLeft(Math.max(0, Math.min(box.width - w, t.left - box.left + t.width / 2 - w / 2)))
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [ui.drawer])
  return (
    <div ref={root} className="pointer-events-auto flex flex-col gap-1.5">
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
      {open && (
        <div ref={tray} className="max-w-full self-start" style={{ marginLeft: trayLeft }}>
          <Tray store={store} thumbs={thumbs} cat={open} onPeek={setPeek} />
        </div>
      )}
      <div className={`${panel} flex items-stretch overflow-x-auto`} role="toolbar" aria-label="Build categories">
        {CATEGORY.map((cat) => {
          const kinds = BUILD_ORDER.filter((k) => BUILDINGS[k].group === cat.id)
          if (!kinds.length) return null
          const isOpen = ui.drawer === cat.id
          const ready = kinds.filter((k) => sim.unlocked(k)).length
          const holding = ui.tool && BUILDINGS[ui.tool].group === cat.id ? BUILDINGS[ui.tool] : null
          return (
            <button
              key={cat.id}
              ref={(el) => {
                tabs.current[cat.id] = el
              }}
              type="button"
              aria-expanded={isOpen}
              aria-controls="build-tray"
              onClick={() => store.toggleDrawer(cat.id)}
              title={`${cat.name}: ${cat.blurb}`}
              className="group relative flex min-w-[7rem] flex-1 sm:min-w-[8.5rem] items-center gap-2 border-r border-[#3F4246] px-2.5 py-2 text-left transition-colors last:border-r-0 hover:bg-white/5"
              style={{ boxShadow: `inset 0 ${isOpen ? 4 : 3}px 0 ${cat.color}`, background: isOpen ? `${cat.color}2E` : undefined }}
            >
              <span className="flex size-9 shrink-0 items-center justify-center border" style={{ borderColor: cat.color, background: `${cat.color}26` }}>
                <Icon name={cat.icon} size={22} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] leading-tight text-white">{cat.name}</span>
                <span className="block truncate text-[10px] leading-tight" style={{ color: holding ? cat.color : '#8A8A8A' }}>
                  {holding ? `● ${holding.short}` : ready ? `${ready} of ${kinds.length} ready` : 'Locked · research it'}
                </span>
              </span>
              <span className="text-[11px] transition-transform" style={{ color: cat.color, transform: isOpen ? 'rotate(180deg)' : undefined }} aria-hidden>
                ▲
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
