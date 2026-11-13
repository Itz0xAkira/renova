'use client'

import { ITEMS, NEEDS, RESEARCH, type ItemId, type StockId } from '@/game/core/data'
import type { IconName } from '@/game/art/icons'
import { RESERVE_KJ } from '@/game/core/sim'
import type { GameStore } from '@/game/store'
import type { ReactNode } from 'react'
import { gridSummary } from './power'
import { dayOf } from '@/game/core/nasa'
import { Bar, btn, btnOn, fmt, Icon, panel, signed, TONE } from './kit'

/** The top bar: colony clock and events, fixed-width readouts with rates, and the time and panel controls. */

export function TopBar({ store }: { store: GameStore }) {
  const { sim, ui } = store
  const P = sim.power
  const sun = sim.sun()
  const storm = sim.ev.storm && sim.time >= sim.ev.storm.start
  const flare = sim.ev.flare && sim.time >= sim.ev.flare.start
  const reserve = P.cap + RESERVE_KJ
  const housing = sim.housing()
  const need = (r: 'food' | 'water' | 'o2') => sim.colonists * NEEDS[r] * (r === 'water' && sim.done.has('recycling') ? 0.4 : 1)
  const res = RESEARCH.find((r) => r.id === sim.current)
  const power = gridSummary(sim)

  return (
    <div className="pointer-events-auto grid grid-cols-[1fr_auto] items-start gap-2 2xl:grid-cols-[1fr_auto_1fr]">
      {/* colony clock and events */}
      <div className="order-1 flex flex-wrap items-center gap-2 justify-self-start">
        <div className={`${panel} flex w-[13rem] shrink-0 items-center gap-2 px-2.5 py-1.5 tabular-nums`}>
          <Icon name={sun > 0.05 ? 'sun' : 'moon'} size={30} />
          <span className="leading-tight">
            <span className="block whitespace-nowrap text-[#C8754D]">Colony 001</span>
            <span className="block whitespace-nowrap text-sm text-white">
              Sol {String(sim.solNumber()).padStart(3, '0')} · {sim.clock()}
            </span>
          </span>
        </div>
        {storm && (
          <p className={`${panel} flex items-center gap-1.5 border-[#C8754D] px-2 py-1.5 text-[#E5B07A]`}>
            <Icon name="storm" /> Dust storm
          </p>
        )}
        <SunData store={store} />
        <button
          type="button"
          onClick={() => store.setPanel('comms')}
          className={`${panel} flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-[#9fe3f5] hover:border-[#65C9E8]`}
          title={`Signal delay to Earth today: ${store.space.minutes.toFixed(1)} minutes each way. Click for Mission Control and your supply-ship order.`}
        >
          <Icon name="comms" size={18} /> {Math.round(store.space.minutes)} min to Earth
        </button>
        {flare && (
          <p className={`${panel} flex animate-pulse items-center gap-1.5 border-[#B03E53] px-2 py-1.5 text-[#F3A6B6]`}>
            <Icon name="warn" /> Solar flare
          </p>
        )}
      </div>

      {/* colony readouts */}
      <dl className={`${panel} order-3 col-span-2 flex flex-wrap justify-self-start divide-x divide-[#3F4246] 2xl:order-2 2xl:col-span-1 2xl:justify-self-center`}>
        <Stat icon="crew" label="Crew" value={`${sim.colonists}/${housing}`} tone={sim.shortages.has('housing') ? 'bad' : sim.colonists >= housing ? 'warn' : undefined}
          hint={sim.shortages.has('housing') ? 'Colonists / beds · some crew have no powered bed and are losing health. Build a habitat on the grid.' : 'Colonists / powered beds'}
        />
        <Stat icon="heart" label="Health" value={`${Math.round(sim.health)}%`} tone={sim.health < 50 ? 'bad' : undefined} bar={[sim.health / 100, sim.health < 50 ? '#D86B7B' : '#7BA750']} />
        <Stat
          onClick={() => store.setPanel('power')}
          icon="power"
          label="Power"
          value={signed(P.gen - P.demand)}
          unit="kW"
          wide
          tone={power.tone === 'good' ? 'good' : power.tone}
          bar={[P.stored / reserve, '#65C9E8']}
          hint={`${power.text} Making ${Math.round(P.gen)} kW, using ${Math.round(P.demand)} kW. Batteries ${Math.floor((P.stored / reserve) * 100)}% (${fmt(P.stored)} of ${fmt(reserve)} kJ). Click for the power panel.`}
        />
        <Stock store={store} id="water" need={need('water')} />
        <Stock store={store} id="food" need={need('food')} />
        <Stock store={store} id="o2" need={need('o2')} />
        <Stock store={store} id="metal" />
        <Stock store={store} id="brick" />
      </dl>

      {/* controls */}
      <div className="order-2 flex items-center gap-1.5 justify-self-end 2xl:order-3">
        <button type="button" className={`${btn} ${ui.paused ? btnOn : ''}`} onClick={() => store.togglePause()} aria-pressed={ui.paused} aria-label={ui.paused ? 'Resume' : 'Pause'} title="Pause · Space">
          <Icon name={ui.paused ? 'play' : 'pause'} />
        </button>
        <div className="flex">
          {([1, 2, 3] as const).map((s) => (
            <button key={s} type="button" className={`${btn} -ml-px px-2 ${!ui.paused && ui.speed === s ? btnOn : ''}`} onClick={() => store.setSpeed(s)} aria-pressed={!ui.paused && ui.speed === s} title={`Speed ${s}×`}>
              {s}×
            </button>
          ))}
        </div>
        <button type="button" className={`${btn} w-[9.5rem] shrink-0`} onClick={() => store.setPanel('research')} title="Research · T">
          <Icon name="research" />
          <span className="flex-1 text-left leading-tight">
            <span className="block">Research</span>
            {res ? <Bar value={sim.rp / res.cost} color="#65C9E8" className="mt-0.5" /> : <span className={`block text-[10px] ${TONE.good}`}>All done</span>}
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

/** Where the game's solar flares come from right now: NASA's live feed, or the 2024 archive. */
function SunData({ store }: { store: GameStore }) {
  const w = store.spaceWeather
  if (w.status === 'loading') return null
  const top = w.recs[0]
  const title =
    w.status === 'live'
      ? `Solar flares in this game are real: ${w.recs.length} flare${w.recs.length === 1 ? '' : 's'} from NASA DONKI in the last 30 days (live).${top ? ` Strongest: ${top.cls} on ${dayOf(top.peak)}.` : ''}`
      : 'Solar flares in this game are real X-class flares from 2024, from NASA DONKI (archived: the live feed couldn’t be reached).'
  return (
    <p className={`${panel} flex items-center gap-1.5 px-2 py-1.5 text-[11px] ${w.status === 'live' ? 'text-[#F4D03F]' : 'text-[#BFBFBF]'}`} title={title}>
      <Icon name="sun" size={18} /> {w.status === 'live' ? 'Live sun · NASA' : 'Sun · NASA 2024'}
    </p>
  )
}

export function Stat({
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
      className={`flex shrink-0 items-center gap-1.5 overflow-hidden px-2 py-1 text-left ${wide ? 'w-[9.6rem] xl:w-[10.6rem]' : 'w-[6.2rem] xl:w-[6.9rem]'} ${onClick ? 'hover:bg-[#2E3033]' : ''}`}
      title={hint ?? label}
    >
      <Icon name={icon} size={24} />
      <div className="min-w-0 flex-1 leading-tight">
        <dt className="sr-only">{label}</dt>
        <dd className={`whitespace-nowrap text-[15px] tabular-nums sm:text-[17px] ${tone ? TONE[tone] : 'text-white'}`}>
          {value}
          {unit && <span className="ml-0.5 text-[10px] text-[#8A8A8A]">{unit}</span>}
        </dd>
        {bar ? <Bar value={bar[0]} color={bar[1]} className="mt-0.5" /> : <span className="block whitespace-nowrap text-[10px] tabular-nums">{sub ?? <span className={TONE.label}>{label}</span>}</span>}
      </div>
    </Tag>
  )
}

export const STOCK: Record<StockId, { name: string; icon: IconName }> = {
  ...(Object.fromEntries((Object.keys(ITEMS) as ItemId[]).map((k) => [k, { name: ITEMS[k].name, icon: k }])) as Record<ItemId, { name: string; icon: IconName }>),
  o2: { name: 'Oxygen', icon: 'o2' },
}

export function Stock({ store, id, need }: { store: GameStore; id: StockId; need?: number }) {
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
