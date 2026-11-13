'use client'

import { BATTERY_KJ_LEVEL, BUILDINGS, ITEMS, MAX_LEVEL, SHIELD_REACH, STATION_MAX_PLANTS, UPGRADES, type ItemId } from '@/game/core/data'
import { RESERVE_KJ, type Ent } from '@/game/core/sim'
import type { GameStore } from '@/game/store'
import { Bar, btn, fmt, Icon, Items, panel, Recipe, Row, STATUS, TONE } from './kit'

/** Details of the selected building: status, recipe, buffers, grid, level and its upgrade. */

export function Inspector({ store, e, thumb }: { store: GameStore; e: Ent; thumb: string }) {
  const { sim } = store
  const def = { ...BUILDINGS[e.kind], name: UPGRADES[e.kind]?.names[e.level - 1] ?? BUILDINGS[e.kind].name }
  const up = UPGRADES[e.kind]
  const cost = sim.upgradeCost(e)
  const canPay = !!cost && sim.stock.metal >= cost.metal && sim.stock.brick >= cost.brick
  const needsGrid = def.power > 0 || !!def.gen
  const [label, dot] = STATUS[e.status]
  const flat = e.kind === 'belt' || e.kind === 'junction'
  return (
    <aside className={`${panel} pointer-events-auto w-full max-w-[23rem] border-t-2 border-t-[#3E8DA8]`} aria-label={`${def.name} details`}>
      <div className="flex items-start gap-2 p-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb} alt="" width={40} height={48} className="pixelated h-16 w-[3.35rem] border border-[#3F4246] bg-[#151618]" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm text-white">
            {def.name}
            <span className="border border-[#3F4246] px-1 text-[10px] text-[#8A8A8A]">
              {def.w}×{def.h}
            </span>
          </p>
          {!flat && e.kind !== 'shield' && (
            <p className="mt-1 flex items-center gap-1.5 text-[11px]">
              <span className={`inline-block h-2.5 w-2.5 ${dot}`} />
              {label}
            </p>
          )}
        </div>
        <button type="button" onClick={() => ((store.ui.selected = null), store.bump())} className={`${TONE.label} hover:text-white`} aria-label="Close">
          ✕
        </button>
      </div>
      <dl className="space-y-1.5 border-t border-[#3F4246] px-2.5 py-2 font-sans text-[13px] normal-case">
        {up && (
          <Row
            k="Level"
            v={
              <span className="inline-flex items-center gap-1">
                {Array.from({ length: MAX_LEVEL }, (_, n) => n + 1).map((n) => (
                  <span key={n} className={`inline-block h-2.5 w-4 border border-[#151618] ${n <= e.level ? 'bg-[#65C9E8]' : 'bg-[#2E3033]'}`} />
                ))}
                <span className="ml-1">
                  {e.level}/{MAX_LEVEL}
                </span>
              </span>
            }
          />
        )}
        {needsGrid && <Row k="Grid" v={e.onGrid ? <span className={TONE.cyan}>Connected</span> : <span className={TONE.bad}>Not connected — build a pylon</span>} />}
        {(def.recipe || def.mines) && <Row k="Makes" v={<Recipe def={def} />} />}
        {def.mines && <Row k="Here" v={e.mineItem ? <Icon name={e.mineItem} size={18} /> : <span className={TONE.bad}>nothing to mine</span>} />}
        {def.recipe && <Row k="Input" v={<Items list={e.inBuf} />} />}
        {(def.recipe || def.mines) && <Row k="Output" v={<Items list={e.outBuf} />} />}
        {def.power > 0 && (
          <Row
            k="Power"
            v={
              <span className="inline-flex items-center gap-1">
                <Icon name="power" size={16} /> {Math.round(sim.draw(e))} kW
              </span>
            }
          />
        )}
        {def.gen && (
          <Row
            k="Makes"
            v={
              <span className={`inline-flex items-center gap-1 ${TONE.cyan}`}>
                <Icon name="power" size={16} /> {e.onGrid ? `${sim.genKW(e).toFixed(1)} kW now` : '0 kW — not connected'}
              </span>
            }
          />
        )}
        {e.kind === 'battery' && (
          <Row
            k="Bank"
            v={
              <span className="inline-flex items-center gap-1">
                <Icon name="battery" size={16} /> {fmt(e.charge)}/{fmt(BATTERY_KJ_LEVEL[e.level - 1])} kJ
                <span className={TONE.label}>(grid {fmt(sim.power.stored)}/{fmt(sim.power.cap + RESERVE_KJ)})</span>
              </span>
            }
          />
        )}
        {(e.kind === 'habitat' || e.kind === 'core') && (
          <Row
            k="Crew"
            v={
              <span className="inline-flex items-center gap-1">
                <Icon name="crew" size={16} /> {e.residents} / {sim.beds(e)}
              </span>
            }
          />
        )}
        {e.kind === 'habitat' && <Row k="Shielded" v={e.shielded ? <span className={TONE.good}>Yes</span> : <span className={TONE.warn}>No — shield within {SHIELD_REACH[0]} tiles</span>} />}
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
        <dl className="grid grid-cols-3 gap-1 border-t border-[#3F4246] px-2.5 py-2">
          {(Object.keys(ITEMS) as ItemId[]).map((k) => (
            <div key={k} className="flex min-w-0 items-center gap-1 tabular-nums" title={`${ITEMS[k].name}: ${Math.floor(sim.stock[k])}`}>
              <Icon name={k} size={18} />
              <span className="text-white">{fmt(sim.stock[k])}</span>
            </div>
          ))}
        </dl>
      )}
      {up && cost && (
        <div className="mx-2.5 mb-2 border border-[#3F4246] bg-[#151618]/60 p-2">
          <p className="flex items-center justify-between gap-2 text-[12px]">
            <span className="text-white">→ {up.names[e.level]}</span>
            <span className={`inline-flex items-center gap-1 ${canPay ? '' : TONE.bad}`}>
              <Icon name="metal" size={16} />
              {cost.metal}
              {cost.brick > 0 && (
                <>
                  <Icon name="brick" size={16} />
                  {cost.brick}
                </>
              )}
            </span>
          </p>
          <p className="mt-1 font-sans text-[13px] normal-case text-[#A8B87A]">{up.gains[e.level - 1]}</p>
          <button type="button" disabled={!canPay} className={`${btn} mt-1.5 w-full justify-center border-[#3E8DA8] text-[#65C9E8]`} onClick={() => store.upgrade(e)}>
            Upgrade · U
          </button>
        </div>
      )}
      <p className="mx-2.5 mb-2 flex gap-1.5 border border-[#3F4246] bg-[#151618]/60 p-1.5 font-sans text-[13px] normal-case leading-snug text-[#E5B07A]">
        <Icon name="tip" size={18} className="mt-0.5" />
        {def.fact}
      </p>
      <div className="flex gap-1 px-2.5 pb-2.5">
        {def.outputs && (
          <button type="button" className={btn} onClick={() => (store.sim.rotate(e), store.bump())}>
            <Icon name="rotate" size={18} /> Rotate · R
          </button>
        )}
        {e.kind !== 'core' && (
          <button type="button" className={btn} onClick={() => store.removeAt(e.i, e.j)}>
            <Icon name="remove" size={18} /> Remove
          </button>
        )}
      </div>
    </aside>
  )
}
