'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { thumbURL } from './art'
import { HowToPlay } from './HowToPlay'
import { BUILD_ORDER, BUILDINGS, HOTKEYS, ITEMS, NEEDS, RESEARCH, SOL, type ItemId, type Kind, type StockId } from './data'
import { MISSIONS } from './missions'
import { BATTERY_KJ, type Ent, type Status } from './sim'
import type { GameStore } from './store'

const panel = 'border-2 border-star/15 bg-[#0c1220]/88 backdrop-blur-[2px]'
const btn = 'border-2 border-star/30 bg-[#0c1220]/88 px-2.5 py-1.5 uppercase transition-colors hover:border-mars hover:text-mars disabled:opacity-40 disabled:hover:border-star/30 disabled:hover:text-star'

const fmt = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : Math.floor(n).toString())
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(0)}`

const STATUS: Record<Status, [string, string]> = {
  ok: ['Running', 'text-[#7ee07a]'],
  idle: ['Idle', 'text-star/60'],
  nopower: ['No power', 'text-[#ffd24a]'],
  noinput: ['Waiting for input', 'text-star/70'],
  blocked: ['Output blocked', 'text-[#ff7a6e]'],
  unshielded: ['Unshielded — radiation!', 'text-[#ffd24a]'],
  badground: ['Wrong ground', 'text-[#ff7a6e]'],
}

export function Hud({ store }: { store: GameStore }) {
  const { sim, ui } = store
  const thumbs = useMemo(() => Object.fromEntries(BUILD_ORDER.map((k) => [k, thumbURL(k)])) as Record<Kind, string>, [])

  useEffect(() => {
    const byKey = Object.fromEntries(Object.entries(HOTKEYS).map(([k, v]) => [v, k])) as Record<string, Kind>
    const on = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key
      // while the guide is open, only let it be closed
      if (ui.panel === 'help' && k !== 'Escape' && k !== 'h') return
      if (byKey[k]) store.setTool(byKey[k])
      else if (k === 'r' || k === 'R') store.rotate(e.shiftKey ? -1 : 1)
      else if (k === 'q' || k === 'Q') store.pipette()
      else if (k === 'Escape') store.escape()
      else if (k === ' ') store.togglePause()
      else if (k === 't' || k === 'T') store.setPanel('research')
      else if (k === 'h' || k === '?') store.setPanel('help')
      else if (k === 'c' || k === 'C') store.centerRequest = true
      else if (k === '+' || k === '=') store.zoomRequest = 1
      else if (k === '-' || k === '_') store.zoomRequest = -1
      else if ((k === 'x' || k === 'X' || k === 'Delete') && ui.hover) store.removeAt(ui.hover[0], ui.hover[1])
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [store, ui])

  const inspect = store.selectedEnt()
  const popup = sim.popups[0]

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between gap-2 p-2 text-[10px] uppercase sm:p-3">
      <TopBar store={store} />
      <div className="flex min-h-0 flex-1 items-start justify-between gap-2">
        <Missions store={store} />
        {inspect && <Inspector store={store} e={inspect} />}
      </div>
      <BottomBar store={store} thumbs={thumbs} />
      {ui.panel === 'research' && <Research store={store} />}
      {ui.panel === 'menu' && <Menu store={store} />}
      {ui.panel === 'help' && <HowToPlay onClose={() => store.setPanel(null)} doneLabel={store.firstRun ? 'Begin mission' : 'Back to the colony'} />}
      {ui.paused && !ui.panel && !popup && (
        <p className="pointer-events-auto absolute left-1/2 top-1/3 -translate-x-1/2 border-2 border-mars bg-[#0c1220]/90 px-4 py-2 text-xs text-mars">
          Paused · space to resume
        </p>
      )}
      <CursorHint store={store} />
      {popup && <PopupCard store={store} />}
    </div>
  )
}

/* -------------------------------- top bar -------------------------------- */

function TopBar({ store }: { store: GameStore }) {
  const { sim, ui } = store
  const P = sim.power
  const sun = sim.sun()
  const storm = sim.ev.storm && sim.time >= sim.ev.storm.start
  const flare = sim.ev.flare && sim.time >= sim.ev.flare.start
  const reserve = P.cap + 1000
  const housing = sim.housing()
  const need = (r: 'food' | 'water' | 'o2') => (sim.colonists * NEEDS[r] * (r === 'water' && sim.done.has('recycling') ? 0.4 : 1)) / 1

  return (
    <div className="pointer-events-auto flex flex-col gap-1.5 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex items-center gap-1.5">
        <p className={`${panel} px-2.5 py-1.5 sm:text-xs`}>
          <span className="text-mars">RENOVA</span> · Sol {String(sim.solNumber()).padStart(3, '0')} · {sim.clock()}{' '}
          <span aria-label={sun > 0 ? 'Day' : 'Night'}>{sun > 0.05 ? '☀' : '☾'}</span>
        </p>
        {storm && <p className={`${panel} border-[#e0a072] px-2 py-1.5 text-[#e0a072]`}>Dust storm</p>}
        {flare && <p className={`${panel} border-[#ff5a4f] px-2 py-1.5 text-[#ff7a6e]`}>Solar flare</p>}
      </div>

      <dl className="grid grid-cols-4 gap-1 sm:grid-cols-8">
        <Readout label="Crew" value={`${sim.colonists}/${housing}`} warn={sim.colonists >= housing} hint="Colonists / housing" />
        <Readout label="Health" value={`${Math.round(sim.health)}%`} warn={sim.health < 50} bar={sim.health / 100} barColor={sim.health < 50 ? '#ff5a4f' : '#7ee07a'} />
        <Readout
          label="Power"
          value={`${Math.round(P.gen)}/${Math.round(P.demand)}kW`}
          warn={sim.shortages.has('power')}
          bar={P.stored / reserve}
          barColor="#ffd24a"
          hint={`Generation / demand. Bar: ${fmt(P.stored)} of ${fmt(reserve)} kJ stored`}
        />
        <Stock store={store} id="water" need={need('water')} />
        <Stock store={store} id="food" need={need('food')} />
        <Stock store={store} id="o2" need={need('o2')} />
        <Stock store={store} id="metal" />
        <Stock store={store} id="brick" />
      </dl>

      <div className="flex items-center gap-1">
        <button type="button" className={btn} onClick={() => store.togglePause()} aria-pressed={ui.paused}>
          {ui.paused ? '▶' : 'II'}
        </button>
        {([1, 2, 3] as const).map((s) => (
          <button key={s} type="button" className={`${btn} ${!ui.paused && ui.speed === s ? 'border-mars text-mars' : ''}`} onClick={() => store.setSpeed(s)}>
            {s}×
          </button>
        ))}
        <button type="button" className={btn} onClick={() => store.setPanel('research')}>
          Research · T
        </button>
        <button type="button" className={btn} onClick={() => store.setPanel('help')} title="How to play (H)">
          ? Guide
        </button>
        <button type="button" className={btn} onClick={() => store.setPanel('menu')}>
          Menu
        </button>
      </div>
    </div>
  )
}

function Readout({ label, value, warn, bar, barColor, hint }: { label: string; value: string; warn?: boolean; bar?: number; barColor?: string; hint?: string }) {
  return (
    <div className={`${panel} min-w-[4.6rem] px-2 py-1`} title={hint}>
      <dt className="text-[9px] text-star/50">{label}</dt>
      <dd className={`text-xs sm:text-sm ${warn ? 'text-[#ff7a6e]' : 'text-star'}`}>{value}</dd>
      {bar !== undefined && (
        <span className="mt-0.5 block h-1 bg-star/10">
          <span className="block h-full" style={{ width: `${Math.max(0, Math.min(1, bar)) * 100}%`, background: barColor }} />
        </span>
      )}
    </div>
  )
}

const STOCK_LABEL: Record<StockId, string> = { ...Object.fromEntries(Object.entries(ITEMS).map(([k, v]) => [k, v.name])), o2: 'Oxygen' } as Record<StockId, string>

function Stock({ store, id, need }: { store: GameStore; id: StockId; need?: number }) {
  const { sim } = store
  const v = sim.stock[id]
  const rate = sim.rates[id]
  const short = (id === 'food' || id === 'water' || id === 'o2') && sim.shortages.has(id)
  const sols = need && rate !== undefined && rate < 0 ? v / -rate : null
  return (
    <div className={`${panel} min-w-[4.6rem] px-2 py-1`} title={need ? `Crew needs ${need.toFixed(0)} per sol` : undefined}>
      <dt className="text-[9px] text-star/50">{id === 'o2' ? 'O₂' : STOCK_LABEL[id]}</dt>
      <dd className={`text-xs sm:text-sm ${short || (sols !== null && sols < 1) ? 'text-[#ff7a6e]' : 'text-star'}`}>{fmt(v)}</dd>
      <span className={`block text-[8px] ${rate === undefined ? 'text-star/30' : rate < -0.5 ? 'text-[#ff9a8e]' : rate > 0.5 ? 'text-[#9ee69a]' : 'text-star/40'}`}>
        {rate === undefined ? '…' : `${signed(rate)}/sol`}
      </span>
    </div>
  )
}

/* -------------------------------- missions ------------------------------- */

function Missions({ store }: { store: GameStore }) {
  const { sim } = store
  const [open, setOpen] = useState(true)
  const m = MISSIONS[sim.mission]
  const prog = m?.progress?.(sim)
  return (
    <section className={`${panel} pointer-events-auto w-full max-w-[17rem] p-2.5 normal-case`} aria-label="Mission log">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between uppercase text-mars">
        <span>
          Mission {Math.min(sim.mission + 1, MISSIONS.length)}/{MISSIONS.length}
        </span>
        <span className="text-star/50">{open ? '−' : '+'}</span>
      </button>
      {open &&
        (m ? (
          <div className="mt-2 space-y-1.5">
            <p className="text-xs uppercase text-star">{m.title}</p>
            <p className="font-sans text-[12px] leading-snug text-star/85">{m.text}</p>
            {prog && (
              <span className="block h-1.5 bg-star/10">
                <span className="block h-full bg-mars" style={{ width: `${(prog[0] / prog[1]) * 100}%` }} />
              </span>
            )}
            <p className="font-sans text-[11px] leading-snug text-sand/80">💡 {m.tip}</p>
          </div>
        ) : (
          <p className="mt-2 font-sans text-[12px] leading-snug text-star/85">All missions complete. The colony is yours — expand, optimise, survive the storms.</p>
        ))}
      <Log store={store} />
    </section>
  )
}

function Log({ store }: { store: GameStore }) {
  const msgs = store.sim.messages.slice(-4).reverse()
  const tone = { info: 'text-star/70', good: 'text-[#9ee69a]', warn: 'text-[#ffd27a]', bad: 'text-[#ff7a6e]' }
  return (
    <ul aria-live="polite" className="mt-2.5 space-y-1 border-t-2 border-star/10 pt-2 font-sans text-[11px] leading-snug">
      {msgs.map((m, k) => (
        <li key={m.id} className={`${tone[m.tone]} ${k ? 'opacity-70' : ''}`}>
          › {m.text}
        </li>
      ))}
    </ul>
  )
}

/* ------------------------------- inspector ------------------------------- */

function Inspector({ store, e }: { store: GameStore; e: Ent }) {
  const { sim } = store
  const def = BUILDINGS[e.kind]
  const [label, color] = STATUS[e.status]
  const r = def.recipe
  const items = (rec: Partial<Record<ItemId, number>>) =>
    Object.entries(rec)
      .map(([k, n]) => `${n} ${ITEMS[k as ItemId].name.toLowerCase()}`)
      .join(' + ')
  const buf = (b: Partial<Record<ItemId, number>>) =>
    Object.entries(b)
      .filter(([, n]) => (n ?? 0) > 0)
      .map(([k, n]) => `${n} ${ITEMS[k as ItemId].name.toLowerCase()}`)
      .join(', ') || '—'
  return (
    <aside className={`${panel} pointer-events-auto w-full max-w-[17rem] p-2.5`} aria-label={`${def.name} details`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-mars">{def.name}</p>
        <button type="button" onClick={() => ((store.ui.selected = null), store.bump())} className="text-star/60 hover:text-mars" aria-label="Close">
          ✕
        </button>
      </div>
      {e.kind !== 'belt' && e.kind !== 'shield' && <p className={`mt-1 ${color}`}>● {label}</p>}
      <dl className="mt-2 space-y-1 font-sans text-[11px] normal-case leading-snug text-star/85">
        {r && <Row k="Recipe" v={`${items(r.in)} → ${items(r.out)} · ${r.time}s`} />}
        {def.mines && <Row k="Mines" v={e.mineItem ? ITEMS[e.mineItem].name : 'nothing here'} />}
        {def.power > 0 && <Row k="Power" v={`${def.power} kW`} />}
        {def.gen && <Row k="Output" v={e.kind === 'solar' ? `${sim.power.solar.toFixed(1)} kW now` : `${def.gen} kW`} />}
        {e.kind === 'battery' && <Row k="Bank" v={`${fmt(sim.power.stored)} / ${fmt(sim.power.cap + 1000)} kJ (${BATTERY_KJ} each)`} />}
        {r && <Row k="Input" v={buf(e.inBuf)} />}
        {(r || def.mines) && <Row k="Output" v={buf(e.outBuf)} />}
        {(e.kind === 'habitat' || e.kind === 'core') && <Row k="Residents" v={`${e.residents} / ${def.housing}`} />}
        {e.kind === 'habitat' && <Row k="Shielded" v={e.shielded ? 'Yes' : 'No — build a shield within 2 tiles'} />}
        {e.kind === 'belt' && <Row k="Carrying" v={e.items.map((x) => ITEMS[x.item].name.toLowerCase()).join(', ') || 'nothing'} />}
      </dl>
      {(r || def.mines) && (
        <span className="mt-2 block h-1.5 bg-star/10">
          <span className="block h-full bg-mars" style={{ width: `${Math.min(1, e.progress) * 100}%` }} />
        </span>
      )}
      {e.kind === 'core' && (
        <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 font-sans text-[11px] normal-case text-star/80">
          {(Object.keys(ITEMS) as ItemId[]).map((k) => (
            <Row key={k} k={ITEMS[k].name} v={fmt(sim.stock[k])} />
          ))}
        </dl>
      )}
      <p className="mt-2 font-sans text-[11px] normal-case leading-snug text-sand/80">{def.fact}</p>
      <div className="mt-2.5 flex gap-1">
        {def.outputs && (
          <button type="button" className={btn} onClick={() => (store.sim.rotate(e), store.bump())}>
            Rotate · R
          </button>
        )}
        {e.kind !== 'core' && (
          <button type="button" className={btn} onClick={() => store.removeAt(e.i, e.j)}>
            Remove
          </button>
        )}
      </div>
    </aside>
  )
}

const Row = ({ k, v }: { k: string; v: ReactNode }) => (
  <div className="flex justify-between gap-3">
    <dt className="text-star/50">{k}</dt>
    <dd className="text-right">{v}</dd>
  </div>
)

/* ------------------------------- build bar ------------------------------- */

function BottomBar({ store, thumbs }: { store: GameStore; thumbs: Record<Kind, string> }) {
  const { sim, ui } = store
  const [peek, setPeek] = useState<Kind | null>(null)
  const show = peek ?? ui.tool
  const def = show ? BUILDINGS[show] : null
  const dirs = ['↘', '↙', '↖', '↗']
  return (
    <div className="pointer-events-auto flex flex-col gap-1.5">
      <div className="flex flex-wrap items-end justify-between gap-1.5">
        {def ? (
          <div className={`${panel} max-w-md p-2`}>
            <p className="text-xs text-mars">
              {def.name} <span className="text-star/60">· {store.costLabel(def.kind)}</span>
              {def.power > 0 && <span className="text-star/60"> · {def.power} kW</span>}
            </p>
            <p className="mt-1 font-sans text-[12px] normal-case leading-snug text-star/85">{def.desc}</p>
            {!sim.unlocked(def.kind) && <p className="mt-1 text-[#ffd27a]">Locked · research {RESEARCH.find((r) => r.id === def.research)?.name}</p>}
            {ui.tool && !peek && (
              <p className="mt-1 text-star/60">
                Facing {dirs[ui.dir]} · R rotate · drag to build · right-click remove{ui.hoverErr ? <span className="text-[#ff7a6e]"> · {ui.hoverErr}</span> : null}
              </p>
            )}
          </div>
        ) : (
          <p className={`${panel} hidden px-2 py-1.5 text-star/60 sm:block`}>Click a building to inspect · drag to pan · wheel to zoom · H for help</p>
        )}
        <div className="flex gap-1">
          <button type="button" className={btn} onClick={() => (store.zoomRequest = -1)} aria-label="Zoom out">
            −
          </button>
          <button type="button" className={btn} onClick={() => (store.zoomRequest = 1)} aria-label="Zoom in">
            +
          </button>
          <button type="button" className={btn} onClick={() => (store.centerRequest = true)}>
            Core · C
          </button>
        </div>
      </div>
      <div className="flex items-stretch gap-1 overflow-x-auto pb-0.5" role="toolbar" aria-label="Build">
        {BUILD_ORDER.map((k) => {
          const d = BUILDINGS[k]
          const locked = !sim.unlocked(k)
          const poor = !sim.affordable(k)
          const sel = ui.tool === k
          return (
            <button
              key={k}
              type="button"
              aria-pressed={sel}
              disabled={locked}
              onClick={() => store.setTool(k)}
              onMouseEnter={() => setPeek(k)}
              onMouseLeave={() => setPeek(null)}
              onFocus={() => setPeek(k)}
              onBlur={() => setPeek(null)}
              className={`relative flex w-[4.4rem] shrink-0 flex-col items-center border-2 px-1 pb-1 pt-0.5 transition-colors ${
                sel ? 'border-mars bg-mars/20' : 'border-star/15 bg-[#0c1220]/88 hover:border-star/60'
              } ${locked ? 'opacity-35' : ''}`}
            >
              {HOTKEYS[k] && <span className="absolute left-1 top-0.5 text-[8px] text-star/45">{HOTKEYS[k]}</span>}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbs[k]} alt="" width={40} height={48} className="pixelated h-12 w-10" />
              <span className="text-[9px] leading-tight">{locked ? '🔒 Locked' : d.short}</span>
              {!locked && (
                <span className={`mt-0.5 text-[8px] leading-none ${poor ? 'text-[#ff9a8e]' : 'text-star/45'}`}>
                  {[d.cost.metal ? `${d.cost.metal}M` : '', d.cost.brick ? `${d.cost.brick}B` : ''].filter(Boolean).join(' ') || 'free'}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Next to the cursor: why a build won't work, or — with no tool selected —
 * the name and state of the building under the cursor.
 */
function CursorHint({ store }: { store: GameStore }) {
  const { ui } = store
  if (!ui.pointer || ui.panel) return null
  const at = { left: ui.pointer[0] + 18, top: ui.pointer[1] + 14 }
  if (ui.tool) {
    if (!ui.hoverErr) return null
    return (
      <p aria-hidden className="pointer-events-none absolute z-10 whitespace-nowrap border-2 border-[#ff5a4f]/70 bg-[#0c1220]/92 px-2 py-1 text-[9px] text-[#ff9a8e]" style={at}>
        {ui.hoverErr}
      </p>
    )
  }
  const e = store.hovered()
  if (!e) return null
  const def = BUILDINGS[e.kind]
  const [label, color] = STATUS[e.status]
  const showStatus = e.kind !== 'belt' && e.kind !== 'shield'
  return (
    <p aria-hidden className="pointer-events-none absolute z-10 whitespace-nowrap border-2 border-[#ffe7b8]/50 bg-[#0c1220]/92 px-2 py-1 text-[9px]" style={at}>
      <span className="text-star">{def.name}</span>
      <span className="text-star/45">
        {' '}
        · {def.w}×{def.h}
      </span>
      {showStatus && <span className={`block ${color}`}>● {label}</span>}
    </p>
  )
}

/* -------------------------------- panels --------------------------------- */

function Modal({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose?: () => void; wide?: boolean }) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-[#0c1220]/70 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`rise max-h-full w-full overflow-y-auto border-2 border-mars bg-[#0c1220] p-5 ${wide ? 'max-w-2xl' : 'max-w-md'}`}
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-mars sm:text-base">{title}</p>
          {onClose && (
            <button type="button" onClick={onClose} className="text-star/60 hover:text-mars" aria-label="Close">
              ✕
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}

function Research({ store }: { store: GameStore }) {
  const { sim } = store
  const labs = sim.count('lab')
  const rate = (labs * 0.4 + 0.12) * SOL
  return (
    <Modal title="Research" onClose={() => store.setPanel(null)} wide>
      <p className="mt-1 font-sans text-[12px] normal-case text-star/70">
        {fmt(sim.rp)} RP banked · about {rate.toFixed(0)} RP per sol ({labs} lab{labs === 1 ? '' : 's'} + the core). Build more labs to research faster.
      </p>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {RESEARCH.map((r) => {
          const done = sim.done.has(r.id)
          const cur = sim.current === r.id
          const locked = !!r.needs && !sim.done.has(r.needs)
          return (
            <li key={r.id}>
              <button
                type="button"
                disabled={done || locked}
                onClick={() => (sim.setResearch(r.id), store.bump())}
                className={`w-full border-2 p-2.5 text-left transition-colors ${
                  cur ? 'border-mars bg-mars/15' : done ? 'border-[#7ee07a]/40' : 'border-star/20 hover:border-star/60'
                } ${locked ? 'opacity-40' : ''}`}
              >
                <span className="flex justify-between gap-2 text-[11px]">
                  <span className={done ? 'text-[#9ee69a]' : 'text-star'}>{r.name}</span>
                  <span className="text-star/50">{done ? '✓' : `${r.cost} RP`}</span>
                </span>
                <span className="mt-1 block text-[9px] text-sand/70">{r.field}</span>
                <span className="mt-1 block font-sans text-[11px] normal-case text-star/75">{r.effect}</span>
                {locked && <span className="mt-1 block text-[9px] text-star/50">Needs {RESEARCH.find((x) => x.id === r.needs)?.name}</span>}
                {cur && (
                  <span className="mt-1.5 block h-1 bg-star/10">
                    <span className="block h-full bg-mars" style={{ width: `${Math.min(1, sim.rp / r.cost) * 100}%` }} />
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </Modal>
  )
}

function Menu({ store }: { store: GameStore }) {
  const [confirm, setConfirm] = useState(false)
  const [saved, setSaved] = useState(false)
  return (
    <Modal title="Paused" onClose={() => store.setPanel(null)}>
      <nav className="mt-4 flex flex-col gap-2 text-xs">
        <button type="button" className={btn} onClick={() => store.setPanel(null)}>
          Resume
        </button>
        <button type="button" className={btn} onClick={() => (store.save(), setSaved(true))}>
          {saved ? 'Saved ✓' : 'Save game'}
        </button>
        <button type="button" className={btn} onClick={() => store.setPanel('help')}>
          How to play
        </button>
        {confirm ? (
          <button type="button" className={`${btn} border-[#ff5a4f] text-[#ff7a6e]`} onClick={() => store.newGame()}>
            Really start over? Click to confirm
          </button>
        ) : (
          <button type="button" className={btn} onClick={() => setConfirm(true)}>
            New map
          </button>
        )}
        <Link href="/" className={`${btn} text-center`} onClick={() => store.save()}>
          Exit to website
        </Link>
      </nav>
      <p className="mt-4 font-sans text-[11px] normal-case text-star/50">The game saves itself every few seconds in this browser.</p>
    </Modal>
  )
}

function PopupCard({ store }: { store: GameStore }) {
  const p = store.sim.popups[0]
  const kicker = { research: `Science unlocked · ${p.field}`, win: 'Mission accomplished', lose: 'Colony report', intro: 'Mission 001 · Sol 1' }[p.kind]
  return (
    <Modal title={p.title}>
      <p className="mt-1 text-[10px] text-sand/70">{kicker}</p>
      <p className="mt-3 font-sans text-[13px] normal-case leading-relaxed text-star/90">{p.body}</p>
      <div className="mt-5 grid gap-2 text-xs sm:grid-cols-2">
        {p.kind === 'lose' ? (
          <>
            <button type="button" className={`${btn} border-mars bg-mars text-navy hover:bg-star hover:text-navy`} onClick={() => store.newGame()} autoFocus>
              Try again
            </button>
            <Link href="/" className={`${btn} text-center`}>
              Exit to website
            </Link>
          </>
        ) : (
          <button type="button" className={`${btn} border-mars bg-mars text-navy hover:bg-star hover:text-navy sm:col-span-2`} onClick={() => store.closePopup()} autoFocus>
            {p.kind === 'intro' ? 'Begin mission' : p.kind === 'win' ? 'Keep building' : 'Continue'}
          </button>
        )}
      </div>
    </Modal>
  )
}
