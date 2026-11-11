'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { thumbURL } from './art'
import { BATTERY_KJ_LEVEL, BUILD_ORDER, BUILDINGS, HOTKEYS, ITEMS, MAX_LEVEL, NEEDS, RESEARCH, SOL, STATION_MAX_PLANTS, UPGRADES, type BuildingDef, type ItemId, type Kind, type StockId } from './data'
import { HowToPlay } from './HowToPlay'
import { iconURL, type IconName } from './icons'
import { MISSIONS } from './missions'
import { type Ent, type Status } from './sim'
import type { GameStore } from './store'

/* ------------------------------ design tokens ----------------------------- */
// Gunmetal panels with a lit top edge, rust and cyan accents — the same palette as the buildings.

const panel = 'border border-[#3F4246] bg-[#1F2022]/95 shadow-[inset_0_1px_0_#5A5D60,0_3px_0_rgba(0,0,0,0.45)]'
const btn =
  'flex items-center gap-1.5 border border-[#3F4246] bg-[#2E3033] px-2 py-1.5 uppercase text-[#D9D9D9] shadow-[inset_0_1px_0_#5A5D60] transition-colors hover:border-[#C8754D] hover:text-white active:translate-y-px disabled:opacity-40'
const btnOn = 'border-[#C8754D] bg-[#A95738]/35 text-white'
const TONE = { label: 'text-[#8A8A8A]', good: 'text-[#A8B87A]', bad: 'text-[#D86B7B]', warn: 'text-[#F4D03F]', cyan: 'text-[#65C9E8]' }

const fmt = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : Math.floor(n).toString())
const signed = (n: number) => `${n >= 0 ? '▲' : '▼'}${Math.abs(n).toFixed(0)}`

const STATUS: Record<Status, [string, string]> = {
  ok: ['Running', 'bg-[#7BA750]'],
  idle: ['Idle', 'bg-[#5F5F5F]'],
  nopower: ['No power', 'bg-[#F4D03F]'],
  nogrid: ['Not connected — build a pylon', 'bg-[#D86B7B]'],
  noinput: ['Waiting for input', 'bg-[#8A8A8A]'],
  blocked: ['Output blocked', 'bg-[#D86B7B]'],
  unshielded: ['Unshielded — radiation!', 'bg-[#F4D03F]'],
  badground: ['Wrong ground', 'bg-[#D86B7B]'],
}

const CATEGORY: { id: BuildingDef['group']; name: string; icon: IconName }[] = [
  { id: 'logistics', name: 'Logistics', icon: 'logistics' },
  { id: 'extract', name: 'Mining', icon: 'extract' },
  { id: 'process', name: 'Processing', icon: 'process' },
  { id: 'life', name: 'Life support', icon: 'life' },
  { id: 'power', name: 'Power', icon: 'power' },
  { id: 'science', name: 'Science', icon: 'science' },
]

export function Icon({ name, size = 18, className = '' }: { name: IconName; size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={iconURL(name)} alt="" width={size} height={size} className={`pixelated inline-block shrink-0 ${className}`} style={{ width: size, height: size }} />
}

function Bar({ value, color, className = '' }: { value: number; color: string; className?: string }) {
  return (
    <span className={`block h-1.5 border border-[#151618] bg-[#151618] ${className}`}>
      <span className="block h-full" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)' }} />
    </span>
  )
}

/** Item counts as icons: 2 [ore] + 1 [water]. */
function Items({ list }: { list: Partial<Record<ItemId, number>> }) {
  const entries = Object.entries(list).filter(([, n]) => (n ?? 0) > 0) as [ItemId, number][]
  if (!entries.length) return <span className={TONE.label}>—</span>
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {entries.map(([k, n], i) => (
        <span key={k} className="inline-flex items-center gap-0.5" title={ITEMS[k].name}>
          {i > 0 && <span className={TONE.label}>+</span>}
          <span>{n}</span>
          <Icon name={k} size={14} />
        </span>
      ))}
    </span>
  )
}

function Recipe({ def }: { def: BuildingDef }) {
  if (def.recipe)
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <Items list={def.recipe.in} />
        <span className="text-[#C8754D]">→</span>
        <Items list={def.recipe.out} />
        <span className={TONE.label}>· {def.recipe.time}s</span>
      </span>
    )
  if (def.mines)
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        {Object.entries(def.mines).map(([g, item]) => (
          <span key={g} className="inline-flex items-center gap-1">
            <span className={TONE.label}>{g}</span>
            <span className="text-[#C8754D]">→</span>
            <Icon name={item as ItemId} size={14} />
          </span>
        ))}
      </span>
    )
  return null
}

function Cost({ def, poor }: { def: BuildingDef; poor?: boolean }) {
  const c = def.cost
  if (!c.metal && !c.brick) return <span className={TONE.label}>free</span>
  return (
    <span className={`inline-flex items-center gap-1 ${poor ? TONE.bad : ''}`}>
      {c.metal ? (
        <span className="inline-flex items-center gap-0.5">
          <Icon name="metal" size={12} />
          {c.metal}
        </span>
      ) : null}
      {c.brick ? (
        <span className="inline-flex items-center gap-0.5">
          <Icon name="brick" size={12} />
          {c.brick}
        </span>
      ) : null}
    </span>
  )
}

/* ---------------------------------- HUD ---------------------------------- */

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
      else if (k === 'p' || k === 'P') store.togglePowerView()
      else if (k === 'u' || k === 'U') {
        const target = store.selectedEnt() ?? store.hovered()
        if (target) store.upgrade(target)
      }
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
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between gap-2 p-2 text-[10px] uppercase text-[#D9D9D9] sm:p-3">
      <TopBar store={store} />
      <div className="flex min-h-0 flex-1 items-start justify-between gap-2">
        <Missions store={store} />
        {inspect && <Inspector store={store} e={inspect} thumb={thumbs[inspect.kind] ?? thumbURL(inspect.kind)} />}
      </div>
      <BottomBar store={store} thumbs={thumbs} />
      {ui.panel === 'research' && <Research store={store} />}
      {ui.panel === 'menu' && <Menu store={store} />}
      {ui.panel === 'power' && <PowerPanel store={store} />}
      {ui.panel === 'help' && <HowToPlay onClose={() => store.setPanel(null)} doneLabel={store.firstRun ? 'Begin mission' : 'Back to the colony'} />}
      {ui.paused && !ui.panel && !popup && (
        <p className={`${panel} pointer-events-auto absolute left-1/2 top-1/3 flex -translate-x-1/2 items-center gap-2 border-[#C8754D] px-4 py-2 text-xs text-white`}>
          <Icon name="pause" /> Paused · space to resume
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
  const need = (r: 'food' | 'water' | 'o2') => sim.colonists * NEEDS[r] * (r === 'water' && sim.done.has('recycling') ? 0.4 : 1)
  const res = RESEARCH.find((r) => r.id === sim.current)

  return (
    <div className="pointer-events-auto flex flex-col gap-1.5 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-start">
      {/* colony clock and events */}
      <div className="flex flex-wrap items-center gap-1.5 lg:justify-self-start">
        <div className={`${panel} flex w-[10.5rem] shrink-0 items-center gap-2 px-2.5 py-1.5 tabular-nums`}>
          <Icon name={sun > 0.05 ? 'sun' : 'moon'} size={22} />
          <span className="leading-tight">
            <span className="block whitespace-nowrap text-[#C8754D]">Colony 001</span>
            <span className="block whitespace-nowrap text-xs text-white">
              Sol {String(sim.solNumber()).padStart(3, '0')} · {sim.clock()}
            </span>
          </span>
        </div>
        {storm && (
          <p className={`${panel} flex items-center gap-1.5 border-[#C8754D] px-2 py-1.5 text-[#E5B07A]`}>
            <Icon name="storm" /> Dust storm
          </p>
        )}
        {flare && (
          <p className={`${panel} flex animate-pulse items-center gap-1.5 border-[#B03E53] px-2 py-1.5 text-[#F3A6B6]`}>
            <Icon name="warn" /> Solar flare
          </p>
        )}
      </div>

      {/* colony readouts */}
      <dl className={`${panel} flex flex-wrap divide-x divide-[#3F4246] lg:justify-self-center`}>
        <Stat icon="crew" label="Crew" value={`${sim.colonists}/${housing}`} tone={sim.colonists >= housing ? 'warn' : undefined} hint="Colonists / beds" />
        <Stat icon="heart" label="Health" value={`${Math.round(sim.health)}%`} tone={sim.health < 50 ? 'bad' : undefined} bar={[sim.health / 100, sim.health < 50 ? '#D86B7B' : '#7BA750']} />
        <Stat
          onClick={() => store.setPanel('power')}
          icon="power"
          label="Power"
          value={`${Math.round(P.gen)}/${Math.round(P.demand)}`}
          unit="kW"
          wide
          tone={sim.shortages.has('power') ? 'bad' : undefined}
          bar={[P.stored / reserve, '#65C9E8']}
          hint={`Generation / demand. Batteries: ${fmt(P.stored)} of ${fmt(reserve)} kJ. Click for the power panel.`}
        />
        <Stock store={store} id="water" need={need('water')} />
        <Stock store={store} id="food" need={need('food')} />
        <Stock store={store} id="o2" need={need('o2')} />
        <Stock store={store} id="metal" />
        <Stock store={store} id="brick" />
      </dl>

      {/* controls */}
      <div className="flex items-center gap-1 lg:justify-self-end">
        <button type="button" className={`${btn} ${ui.paused ? btnOn : ''}`} onClick={() => store.togglePause()} aria-label={ui.paused ? 'Resume' : 'Pause'} title="Pause · Space">
          <Icon name={ui.paused ? 'play' : 'pause'} />
        </button>
        <div className="flex">
          {([1, 2, 3] as const).map((s) => (
            <button key={s} type="button" className={`${btn} -ml-px px-2 ${!ui.paused && ui.speed === s ? btnOn : ''}`} onClick={() => store.setSpeed(s)} title={`Speed ${s}×`}>
              {s}×
            </button>
          ))}
        </div>
        <button type="button" className={`${btn} w-[7.5rem] shrink-0`} onClick={() => store.setPanel('research')} title="Research · T">
          <Icon name="research" />
          <span className="flex-1 text-left leading-tight">
            <span className="block">Research</span>
            {res ? <Bar value={sim.rp / res.cost} color="#65C9E8" className="mt-0.5" /> : <span className={`block text-[8px] ${TONE.good}`}>All done</span>}
          </span>
        </button>
        <button type="button" className={btn} onClick={() => store.setPanel('help')} title="How to play · H" aria-label="How to play">
          <Icon name="guide" />
        </button>
        <button type="button" className={btn} onClick={() => store.setPanel('menu')} title="Menu · Esc" aria-label="Menu">
          <Icon name="menu" />
        </button>
      </div>
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
  unit,
  tone,
  bar,
  sub,
  hint,
  wide,
  onClick,
}: {
  icon: IconName
  label: string
  value: string
  unit?: string
  tone?: keyof typeof TONE
  bar?: [number, string]
  sub?: ReactNode
  hint?: string
  /** For readouts that hold two numbers, like power. */
  wide?: boolean
  /** Makes the readout a button (the power readout opens the power panel). */
  onClick?: () => void
}) {
  // Fixed widths and tabular figures: the bar never shifts as values change.
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 overflow-hidden px-2 py-1 text-left ${wide ? 'w-[7.25rem]' : 'w-[5.4rem]'} ${onClick ? 'hover:bg-[#2E3033]' : ''}`}
      title={hint ?? label}
    >
      <Icon name={icon} size={18} />
      <div className="min-w-0 flex-1 leading-tight">
        <dt className="sr-only">{label}</dt>
        <dd className={`whitespace-nowrap text-xs tabular-nums sm:text-[13px] ${tone ? TONE[tone] : 'text-white'}`}>
          {value}
          {unit && <span className="ml-0.5 text-[8px] text-[#8A8A8A]">{unit}</span>}
        </dd>
        {bar ? <Bar value={bar[0]} color={bar[1]} className="mt-0.5" /> : <span className="block whitespace-nowrap text-[8px] tabular-nums">{sub ?? <span className={TONE.label}>{label}</span>}</span>}
      </div>
    </Tag>
  )
}

const STOCK: Record<StockId, { name: string; icon: IconName }> = {
  ...(Object.fromEntries((Object.keys(ITEMS) as ItemId[]).map((k) => [k, { name: ITEMS[k].name, icon: k }])) as Record<ItemId, { name: string; icon: IconName }>),
  o2: { name: 'Oxygen', icon: 'o2' },
}

function Stock({ store, id, need }: { store: GameStore; id: StockId; need?: number }) {
  const { sim } = store
  const v = sim.stock[id]
  const rate = sim.rates[id]
  const short = (id === 'food' || id === 'water' || id === 'o2') && sim.shortages.has(id)
  const sols = need && rate !== undefined && rate < 0 ? v / -rate : null
  const low = short || (sols !== null && sols < 1)
  return (
    <Stat
      icon={STOCK[id].icon}
      label={STOCK[id].name}
      value={fmt(v)}
      tone={low ? 'bad' : undefined}
      hint={`${STOCK[id].name}${need ? ` · crew needs ${need.toFixed(0)} per sol` : ''}${sols !== null ? ` · runs out in ${sols.toFixed(1)} sols` : ''}`}
      sub={rate === undefined ? <span className={TONE.label}>…</span> : <span className={rate < -0.5 ? TONE.bad : rate > 0.5 ? TONE.good : TONE.label}>{signed(rate)}/sol</span>}
    />
  )
}

/* -------------------------------- missions ------------------------------- */

function Missions({ store }: { store: GameStore }) {
  const { sim } = store
  const [open, setOpen] = useState(true)
  const m = MISSIONS[sim.mission]
  const prog = m?.progress?.(sim)
  const msgs = sim.messages.slice(-4).reverse()
  const toneIcon = { info: 'tip', good: 'check', warn: 'warn', bad: 'warn' } as const
  const toneText = { info: 'text-[#BFBFBF]', good: TONE.good, warn: TONE.warn, bad: TONE.bad }
  return (
    <section className={`${panel} pointer-events-auto w-full max-w-[18rem] border-t-2 border-t-[#A95738]`} aria-label="Mission log">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-2.5 py-2 text-left">
        <Icon name="flag" />
        <span className="flex-1 text-[#C8754D]">
          Mission {Math.min(sim.mission + 1, MISSIONS.length)}/{MISSIONS.length}
        </span>
        <span className={TONE.label}>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-[#3F4246] px-2.5 pb-2.5 pt-2">
          {m ? (
            <>
              <p className="text-xs text-white">{m.title}</p>
              <p className="font-sans text-[12px] normal-case leading-snug text-[#D9D9D9]">{m.text}</p>
              {prog && (
                <div className="flex items-center gap-2">
                  <Bar value={prog[0] / prog[1]} color="#C8754D" className="flex-1" />
                  <span className={TONE.label}>
                    {prog[0]}/{prog[1]}
                  </span>
                </div>
              )}
              <p className="flex gap-1.5 border border-[#3F4246] bg-[#151618]/60 p-1.5 font-sans text-[11px] normal-case leading-snug text-[#E5B07A]">
                <Icon name="tip" size={14} className="mt-0.5" />
                {m.tip}
              </p>
            </>
          ) : (
            <p className="flex gap-1.5 font-sans text-[12px] normal-case leading-snug text-[#D9D9D9]">
              <Icon name="check" size={14} /> All missions complete. The colony is yours — expand, optimise, survive the storms.
            </p>
          )}
          <ul aria-live="polite" className="space-y-1 border-t border-[#3F4246] pt-2 font-sans text-[11px] normal-case leading-snug">
            {msgs.map((msg, k) => (
              <li key={msg.id} className={`flex gap-1.5 ${toneText[msg.tone]} ${k ? 'opacity-70' : ''}`}>
                <Icon name={toneIcon[msg.tone]} size={12} className="mt-0.5" />
                {msg.text}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

/* ------------------------------- inspector ------------------------------- */

function Inspector({ store, e, thumb }: { store: GameStore; e: Ent; thumb: string }) {
  const { sim } = store
  const def = { ...BUILDINGS[e.kind], name: UPGRADES[e.kind]?.names[e.level - 1] ?? BUILDINGS[e.kind].name }
  const up = UPGRADES[e.kind]
  const cost = sim.upgradeCost(e)
  const canPay = !!cost && sim.stock.metal >= cost.metal && sim.stock.brick >= cost.brick
  const needsGrid = def.power > 0 || !!def.gen
  const [label, dot] = STATUS[e.status]
  const flat = e.kind === 'belt' || e.kind === 'junction'
  return (
    <aside className={`${panel} pointer-events-auto w-full max-w-[18rem] border-t-2 border-t-[#3E8DA8]`} aria-label={`${def.name} details`}>
      <div className="flex items-start gap-2 p-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb} alt="" width={40} height={48} className="pixelated h-12 w-10 border border-[#3F4246] bg-[#151618]" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs text-white">
            {def.name}
            <span className="border border-[#3F4246] px-1 text-[8px] text-[#8A8A8A]">
              {def.w}×{def.h}
            </span>
          </p>
          {!flat && e.kind !== 'shield' && (
            <p className="mt-1 flex items-center gap-1.5 text-[9px]">
              <span className={`inline-block h-2 w-2 ${dot}`} />
              {label}
            </p>
          )}
        </div>
        <button type="button" onClick={() => ((store.ui.selected = null), store.bump())} className={`${TONE.label} hover:text-white`} aria-label="Close">
          ✕
        </button>
      </div>
      <dl className="space-y-1.5 border-t border-[#3F4246] px-2.5 py-2 font-sans text-[11px] normal-case">
        {up && (
          <Row
            k="Level"
            v={
              <span className="inline-flex items-center gap-1">
                {[1, 2, 3].map((n) => (
                  <span key={n} className={`inline-block h-2 w-3 border border-[#151618] ${n <= e.level ? 'bg-[#65C9E8]' : 'bg-[#2E3033]'}`} />
                ))}
                <span className="ml-1">{e.level}/3</span>
              </span>
            }
          />
        )}
        {needsGrid && <Row k="Grid" v={e.onGrid ? <span className={TONE.cyan}>Connected</span> : <span className={TONE.bad}>Not connected — build a pylon</span>} />}
        {(def.recipe || def.mines) && <Row k="Makes" v={<Recipe def={def} />} />}
        {def.mines && <Row k="Here" v={e.mineItem ? <Icon name={e.mineItem} size={14} /> : <span className={TONE.bad}>nothing to mine</span>} />}
        {def.recipe && <Row k="Input" v={<Items list={e.inBuf} />} />}
        {(def.recipe || def.mines) && <Row k="Output" v={<Items list={e.outBuf} />} />}
        {def.power > 0 && (
          <Row
            k="Power"
            v={
              <span className="inline-flex items-center gap-1">
                <Icon name="power" size={12} /> {Math.round(sim.draw(e))} kW
              </span>
            }
          />
        )}
        {def.gen && (
          <Row
            k="Makes"
            v={
              <span className={`inline-flex items-center gap-1 ${TONE.cyan}`}>
                <Icon name="power" size={12} /> {e.kind === 'solar' ? `${((sim.power.solar / 20) * [20, 34, 52][e.level - 1]).toFixed(1)} kW now` : `${[120, 170, 240][e.level - 1]} kW`}
              </span>
            }
          />
        )}
        {e.kind === 'battery' && (
          <Row
            k="Bank"
            v={
              <span className="inline-flex items-center gap-1">
                <Icon name="battery" size={12} /> {fmt(BATTERY_KJ_LEVEL[e.level - 1])} kJ
                <span className={TONE.label}>(grid {fmt(sim.power.stored)}/{fmt(sim.power.cap + 1000)})</span>
              </span>
            }
          />
        )}
        {(e.kind === 'habitat' || e.kind === 'core') && (
          <Row
            k="Crew"
            v={
              <span className="inline-flex items-center gap-1">
                <Icon name="crew" size={12} /> {e.residents} / {sim.beds(e)}
              </span>
            }
          />
        )}
        {e.kind === 'habitat' && <Row k="Shielded" v={e.shielded ? <span className={TONE.good}>Yes</span> : <span className={TONE.warn}>No — shield within 2 tiles</span>} />}
        {e.kind === 'solar' && e.level === MAX_LEVEL && (
          <Row k="Planted" v={`${e.planted} / ${STATION_MAX_PLANTS} panels · next in ${Math.max(0, Math.ceil(e.plantIn))}s`} />
        )}
        {e.kind === 'belt' && (
          <Row
            k="Carrying"
            v={e.items.length ? <Items list={e.items.reduce((m, x) => ({ ...m, [x.item]: (m[x.item] ?? 0) + 1 }), {} as Partial<Record<ItemId, number>>)} /> : <span className={TONE.label}>nothing</span>}
          />
        )}
      </dl>
      {(def.recipe || def.mines) && (
        <div className="px-2.5 pb-2">
          <Bar value={e.progress} color="#C8754D" />
        </div>
      )}
      {e.kind === 'core' && (
        <dl className="grid grid-cols-4 gap-1 border-t border-[#3F4246] px-2.5 py-2">
          {(Object.keys(ITEMS) as ItemId[]).map((k) => (
            <div key={k} className="flex items-center gap-1" title={ITEMS[k].name}>
              <Icon name={k} size={14} />
              <span className="text-white">{fmt(sim.stock[k])}</span>
            </div>
          ))}
        </dl>
      )}
      {up && cost && (
        <div className="mx-2.5 mb-2 border border-[#3F4246] bg-[#151618]/60 p-2">
          <p className="flex items-center justify-between gap-2 text-[10px]">
            <span className="text-white">→ {up.names[e.level]}</span>
            <span className={`inline-flex items-center gap-1 ${canPay ? '' : TONE.bad}`}>
              <Icon name="metal" size={12} />
              {cost.metal}
              {cost.brick > 0 && (
                <>
                  <Icon name="brick" size={12} />
                  {cost.brick}
                </>
              )}
            </span>
          </p>
          <p className="mt-1 font-sans text-[11px] normal-case text-[#A8B87A]">{up.gains[e.level - 1]}</p>
          <button type="button" disabled={!canPay} className={`${btn} mt-1.5 w-full justify-center border-[#3E8DA8] text-[#65C9E8]`} onClick={() => store.upgrade(e)}>
            Upgrade · U
          </button>
        </div>
      )}
      <p className="mx-2.5 mb-2 flex gap-1.5 border border-[#3F4246] bg-[#151618]/60 p-1.5 font-sans text-[11px] normal-case leading-snug text-[#E5B07A]">
        <Icon name="tip" size={14} className="mt-0.5" />
        {def.fact}
      </p>
      <div className="flex gap-1 px-2.5 pb-2.5">
        {def.outputs && (
          <button type="button" className={btn} onClick={() => (store.sim.rotate(e), store.bump())}>
            <Icon name="rotate" size={14} /> Rotate · R
          </button>
        )}
        {e.kind !== 'core' && (
          <button type="button" className={btn} onClick={() => store.removeAt(e.i, e.j)}>
            <Icon name="remove" size={14} /> Remove
          </button>
        )}
      </div>
    </aside>
  )
}

const Row = ({ k, v }: { k: string; v: ReactNode }) => (
  <div className="flex items-center justify-between gap-3">
    <dt className="text-[#8A8A8A]">{k}</dt>
    <dd className="text-right text-[#F6F6F6]">{v}</dd>
  </div>
)

/* ------------------------------- build bar ------------------------------- */

function BuildCard({ store, def }: { store: GameStore; def: BuildingDef }) {
  const { sim, ui } = store
  const dirs = ['↘', '↙', '↖', '↗']
  const locked = !sim.unlocked(def.kind)
  return (
    <div className={`${panel} max-w-md border-t-2 border-t-[#C8754D] p-2.5`}>
      <p className="flex flex-wrap items-center gap-2 text-xs text-white">
        {def.name}
        <span className="border border-[#3F4246] px-1 text-[8px] text-[#8A8A8A]">
          {def.w}×{def.h}
        </span>
        <span className="ml-auto inline-flex items-center gap-2 text-[10px]">
          <Cost def={def} poor={!sim.affordable(def.kind)} />
          {def.power > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[#BFBFBF]">
              <Icon name="power" size={12} />
              {def.power}kW
            </span>
          )}
          {def.gen && (
            <span className={`inline-flex items-center gap-0.5 ${TONE.cyan}`}>
              <Icon name="power" size={12} />+{def.gen}kW
            </span>
          )}
        </span>
      </p>
      <p className="mt-1 font-sans text-[12px] normal-case leading-snug text-[#D9D9D9]">{def.desc}</p>
      {(def.recipe || def.mines) && (
        <p className="mt-1.5 font-sans text-[11px] normal-case">
          <Recipe def={def} />
        </p>
      )}
      {locked && (
        <p className={`mt-1.5 flex items-center gap-1.5 ${TONE.warn}`}>
          <Icon name="lock" size={12} /> Research {RESEARCH.find((r) => r.id === def.research)?.name}
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

function BottomBar({ store, thumbs }: { store: GameStore; thumbs: Record<Kind, string> }) {
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
          <button type="button" className={`${btn} ${ui.powerView ? btnOn : ''}`} onClick={() => store.togglePowerView()} title="Power view · P">
            <Icon name="power" size={14} /> Grid · P
          </button>
          <button type="button" className={btn} onClick={() => (store.centerRequest = true)}>
            <Icon name="crew" size={14} /> Core · C
          </button>
        </div>
      </div>
      <div className={`${panel} flex items-stretch gap-0 overflow-x-auto border-t-2 border-t-[#A95738]`} role="toolbar" aria-label="Build">
        {CATEGORY.map((cat) => {
          const kinds = BUILD_ORDER.filter((k) => BUILDINGS[k].group === cat.id)
          if (!kinds.length) return null
          return (
            <div key={cat.id} className="flex flex-col border-r border-[#3F4246] last:border-r-0">
              <p className="flex items-center gap-1 px-1.5 pt-1 text-[8px] text-[#8A8A8A]">
                <Icon name={cat.icon} size={10} /> {cat.name}
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
                      disabled={locked}
                      onClick={() => store.setTool(k)}
                      onMouseEnter={() => setPeek(k)}
                      onMouseLeave={() => setPeek(null)}
                      onFocus={() => setPeek(k)}
                      onBlur={() => setPeek(null)}
                      className={`relative flex w-[4.4rem] shrink-0 flex-col items-center border px-1 pb-1 pt-0.5 transition-colors ${
                        sel ? 'border-[#C8754D] bg-[#A95738]/30 shadow-[inset_0_0_0_1px_#D58B59]' : 'border-[#3F4246] bg-[#2E3033] hover:border-[#8A8A8A]'
                      } ${locked ? 'opacity-40' : ''}`}
                    >
                      {HOTKEYS[k] && <span className="absolute left-1 top-0.5 text-[8px] text-[#8A8A8A]">{HOTKEYS[k]}</span>}
                      {(d.w > 1 || d.h > 1) && (
                        <span className="absolute right-0.5 top-0.5 bg-[#151618] px-0.5 text-[7px] text-[#65C9E8]">
                          {d.w}×{d.h}
                        </span>
                      )}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={thumbs[k]} alt="" width={40} height={48} className="pixelated h-12 w-10" />
                      <span className="text-[9px] leading-tight text-white">{d.short}</span>
                      <span className="mt-0.5 text-[8px] leading-none">{locked ? <Icon name="lock" size={10} /> : <Cost def={d} poor={poor} />}</span>
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

/** Next to the cursor: why a build won't work, or the building under it. */
function CursorHint({ store }: { store: GameStore }) {
  const { ui } = store
  if (!ui.pointer || ui.panel) return null
  const at = { left: ui.pointer[0] + 18, top: ui.pointer[1] + 14 }
  if (ui.tool) {
    if (!ui.hoverErr) return null
    return (
      <p aria-hidden className={`${panel} pointer-events-none absolute z-10 flex items-center gap-1 whitespace-nowrap border-[#B03E53] px-2 py-1 text-[9px] text-[#F3A6B6]`} style={at}>
        <Icon name="warn" size={12} /> {ui.hoverErr}
      </p>
    )
  }
  const e = store.hovered()
  if (!e) return null
  const def = BUILDINGS[e.kind]
  const [label, dot] = STATUS[e.status]
  const flat = e.kind === 'belt' || e.kind === 'junction'
  return (
    <p aria-hidden className={`${panel} pointer-events-none absolute z-10 whitespace-nowrap px-2 py-1 text-[9px]`} style={at}>
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

/* -------------------------------- panels --------------------------------- */

function Modal({ title, icon, children, onClose, wide }: { title: string; icon?: IconName; children: ReactNode; onClose?: () => void; wide?: boolean }) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-[#0c1220]/70 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`${panel} rise max-h-full w-full overflow-y-auto border-t-2 border-t-[#C8754D] ${wide ? 'max-w-2xl' : 'max-w-md'}`}
      >
        <div className="flex items-center gap-2 border-b border-[#3F4246] bg-[#2E3033] px-4 py-2.5">
          {icon && <Icon name={icon} />}
          <p className="flex-1 text-sm text-white">{title}</p>
          {onClose && (
            <button type="button" onClick={onClose} className="text-[#8A8A8A] hover:text-white" aria-label="Close">
              ✕
            </button>
          )}
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

/** Power panel: what's making and using power, battery state, and the last few sols on a graph. */
function PowerPanel({ store }: { store: GameStore }) {
  const { sim } = store
  const P = sim.power
  const reserve = P.cap + 1000
  const hist = P.history
  const max = Math.max(10, ...hist.map((h) => Math.max(h.gen, h.demand)))
  const W = 560
  const H = 110
  const pts = (k: 'gen' | 'demand') => hist.map((h, n) => `${(n / Math.max(1, hist.length - 1)) * W},${H - (h[k] / max) * (H - 6)}`).join(' ')
  const charge = hist.map((h, n) => `${(n / Math.max(1, hist.length - 1)) * W},${H - (h.stored / Math.max(1, h.cap)) * (H - 6)}`).join(' ')
  const offGrid = [...sim.ents.values()].filter((e) => !e.onGrid && (BUILDINGS[e.kind].power > 0 || !!BUILDINGS[e.kind].gen))
  const count = (k: Kind) => [...sim.ents.values()].filter((e) => e.kind === k && e.onGrid).length
  const users = (Object.entries(P.byKind) as [Kind, number][]).sort((a, b) => b[1] - a[1])
  return (
    <Modal title="Power grid" icon="power" onClose={() => store.setPanel(null)} wide>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="border border-[#3F4246] bg-[#151618]/60 p-2">
          <p className={TONE.label}>Generating</p>
          <p className={`text-lg ${TONE.cyan}`}>{Math.round(P.gen)} kW</p>
          <p className="font-sans text-[11px] normal-case text-[#BFBFBF]">
            Solar {Math.round(P.solarGen)} · Reactor {Math.round(P.reactorGen)}
          </p>
        </div>
        <div className="border border-[#3F4246] bg-[#151618]/60 p-2">
          <p className={TONE.label}>Using</p>
          <p className={`text-lg ${P.gen < P.demand ? TONE.warn : 'text-white'}`}>{Math.round(P.demand)} kW</p>
          <p className="font-sans text-[11px] normal-case text-[#BFBFBF]">{P.discharge > 0.5 ? `Batteries supplying ${Math.round(P.discharge)} kW` : 'Running on generation'}</p>
        </div>
        <div className="border border-[#3F4246] bg-[#151618]/60 p-2">
          <p className={`flex items-center gap-1 ${TONE.label}`}>
            <Icon name="battery" size={12} /> Stored
          </p>
          <p className="text-lg text-white">{Math.round((P.stored / reserve) * 100)}%</p>
          <Bar value={P.stored / reserve} color="#65C9E8" />
          <p className="mt-1 font-sans text-[11px] normal-case text-[#BFBFBF]">
            {fmt(P.stored)} / {fmt(reserve)} kJ
          </p>
        </div>
      </div>

      {/* history: generation, demand and battery charge over the last few sols */}
      <div className="mt-3 border border-[#3F4246] bg-[#151618] p-2">
        <p className="flex flex-wrap gap-3 text-[9px]">
          <span className={TONE.cyan}>━ Generation</span>
          <span className="text-[#C8754D]">━ Demand</span>
          <span className="text-[#F4D03F]">┅ Battery charge</span>
          <span className={`ml-auto ${TONE.label}`}>last {Math.round((hist.length * 2) / SOL * 10) / 10} sols</span>
        </p>
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 h-28 w-full" preserveAspectRatio="none" role="img" aria-label="Power history">
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke="#2E3033" strokeWidth={1} />
          ))}
          {hist.length > 1 && (
            <>
              <polyline points={charge} fill="none" stroke="#F4D03F" strokeWidth={1.5} strokeDasharray="4 3" />
              <polyline points={pts('demand')} fill="none" stroke="#C8754D" strokeWidth={2} />
              <polyline points={pts('gen')} fill="none" stroke="#65C9E8" strokeWidth={2} />
            </>
          )}
        </svg>
        {hist.length < 2 && <p className={`text-center ${TONE.label}`}>Collecting data…</p>}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className={`mb-1 ${TONE.label}`}>Priority</p>
          <p className="flex items-center justify-between gap-2 font-sans text-[11px] normal-case">
            <span>Life support (core, habitats, MOXIE)</span>
            <span className={P.lifeSat < 0.99 ? TONE.bad : TONE.good}>{Math.round(P.lifeSat * 100)}%</span>
          </p>
          <Bar value={P.lifeSat} color="#7BA750" className="mb-1.5 mt-0.5" />
          <p className="flex items-center justify-between gap-2 font-sans text-[11px] normal-case">
            <span>Industry</span>
            <span className={P.indSat < 0.99 ? TONE.warn : TONE.good}>{Math.round(P.indSat * 100)}%</span>
          </p>
          <Bar value={P.indSat} color="#C8754D" className="mt-0.5" />
          <p className={`mt-2 ${TONE.label}`}>Sources</p>
          <ul className="mt-1 space-y-0.5 font-sans text-[11px] normal-case">
            <li>Solar · {count('solar')} on the grid · {P.solar.toFixed(1)} kW per panel now</li>
            <li>Reactors · {count('reactor')}</li>
            <li>Batteries · {count('battery')}</li>
          </ul>
        </div>
        <div>
          <p className={`mb-1 ${TONE.label}`}>Biggest users</p>
          <ul className="space-y-0.5 font-sans text-[11px] normal-case">
            {users.length ? (
              users.slice(0, 7).map(([k, kw]) => (
                <li key={k} className="flex items-center justify-between gap-2">
                  <span>{BUILDINGS[k].name}</span>
                  <span className="text-white">{Math.round(kw)} kW</span>
                </li>
              ))
            ) : (
              <li className={TONE.label}>Nothing is drawing power.</li>
            )}
          </ul>
          {offGrid.length > 0 && (
            <p className={`mt-2 flex gap-1.5 border border-[#B03E53] p-1.5 font-sans text-[11px] normal-case ${TONE.bad}`}>
              <Icon name="warn" size={14} />
              {offGrid.length} building{offGrid.length === 1 ? ' is' : 's are'} not connected. Build power pylons to reach them.
            </p>
          )}
          <button type="button" className={`${btn} mt-2 ${store.ui.powerView ? btnOn : ''}`} onClick={() => store.togglePowerView()}>
            <Icon name="power" size={14} /> {store.ui.powerView ? 'Hide' : 'Show'} grid coverage · P
          </button>
        </div>
      </div>
    </Modal>
  )
}

function Research({ store }: { store: GameStore }) {
  const { sim } = store
  const labs = sim.count('lab')
  const rate = (labs * 0.4 + 0.12) * SOL
  return (
    <Modal title="Research" icon="research" onClose={() => store.setPanel(null)} wide>
      <p className="font-sans text-[12px] normal-case text-[#BFBFBF]">
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
                className={`w-full border p-2.5 text-left transition-colors ${
                  cur ? 'border-[#C8754D] bg-[#A95738]/25' : done ? 'border-[#668B45] bg-[#4F6F3E]/15' : 'border-[#3F4246] bg-[#2E3033] hover:border-[#8A8A8A]'
                } ${locked ? 'opacity-40' : ''}`}
              >
                <span className="flex items-center gap-1.5 text-[11px]">
                  <Icon name={done ? 'check' : locked ? 'lock' : 'research'} size={14} />
                  <span className={`flex-1 ${done ? TONE.good : 'text-white'}`}>{r.name}</span>
                  <span className={TONE.label}>{done ? 'Done' : `${r.cost} RP`}</span>
                </span>
                <span className="mt-1 block text-[9px] text-[#E5B07A]">{r.field}</span>
                <span className="mt-1 block font-sans text-[11px] normal-case text-[#D9D9D9]">{r.effect}</span>
                {locked && <span className="mt-1 block text-[9px] text-[#8A8A8A]">Needs {RESEARCH.find((x) => x.id === r.needs)?.name}</span>}
                {cur && <Bar value={sim.rp / r.cost} color="#65C9E8" className="mt-1.5" />}
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
  const row = `${btn} justify-start py-2 text-xs`
  return (
    <Modal title="Paused" icon="menu" onClose={() => store.setPanel(null)}>
      <nav className="flex flex-col gap-1.5">
        <button type="button" className={row} onClick={() => store.setPanel(null)}>
          <Icon name="play" /> Resume
        </button>
        <button type="button" className={row} onClick={() => (store.save(), setSaved(true))}>
          <Icon name={saved ? 'check' : 'battery'} /> {saved ? 'Saved' : 'Save game'}
        </button>
        <button type="button" className={row} onClick={() => store.setPanel('help')}>
          <Icon name="guide" /> How to play
        </button>
        {confirm ? (
          <button type="button" className={`${row} border-[#B03E53] text-[#F3A6B6]`} onClick={() => store.newGame()}>
            <Icon name="warn" /> Really start over? Click to confirm
          </button>
        ) : (
          <button type="button" className={row} onClick={() => setConfirm(true)}>
            <Icon name="flag" /> New map
          </button>
        )}
        <Link href="/" className={row} onClick={() => store.save()}>
          <Icon name="remove" /> Exit to website
        </Link>
      </nav>
      <p className="mt-3 font-sans text-[11px] normal-case text-[#8A8A8A]">The game saves itself every few seconds in this browser.</p>
    </Modal>
  )
}

function PopupCard({ store }: { store: GameStore }) {
  const p = store.sim.popups[0]
  const kicker = { research: `Science unlocked · ${p.field}`, win: 'Mission accomplished', lose: 'Colony report', intro: 'Mission 001 · Sol 1' }[p.kind]
  const icon: IconName = { research: 'research', win: 'check', lose: 'warn', intro: 'flag' }[p.kind] as IconName
  const primary = `${btn} justify-center border-[#C8754D] bg-[#A95738] text-white hover:bg-[#C8754D]`
  return (
    <Modal title={p.title} icon={icon}>
      <p className="text-[10px] text-[#E5B07A]">{kicker}</p>
      <p className="mt-2 font-sans text-[13px] normal-case leading-relaxed text-[#F6F6F6]">{p.body}</p>
      <div className="mt-5 grid gap-2 text-xs sm:grid-cols-2">
        {p.kind === 'lose' ? (
          <>
            <button type="button" className={primary} onClick={() => store.newGame()} autoFocus>
              Try again
            </button>
            <Link href="/" className={`${btn} justify-center`}>
              Exit to website
            </Link>
          </>
        ) : (
          <button type="button" className={`${primary} sm:col-span-2`} onClick={() => store.closePopup()} autoFocus>
            {p.kind === 'intro' ? 'Begin mission' : p.kind === 'win' ? 'Keep building' : 'Continue'}
          </button>
        )}
      </div>
    </Modal>
  )
}
