'use client'

import { BUILDINGS, SOL, type Kind } from '@/game/core/data'
import { RESERVE_KJ } from '@/game/core/sim'
import type { GameStore } from '@/game/store'
import { Bar, btn, btnOn, fmt, Icon, Modal, TONE } from '../kit'

/** Power panel: what's making and using power, battery state, and the last few sols on a graph. */
export function PowerPanel({ store }: { store: GameStore }) {
  const { sim } = store
  const P = sim.power
  const reserve = P.cap + RESERVE_KJ
  const hist = P.history
  const max = Math.max(10, ...hist.map((h) => Math.max(h.gen, h.demand)))
  const W = 560
  const H = 110
  const pts = (k: 'gen' | 'demand') => hist.map((h, n) => `${(n / Math.max(1, hist.length - 1)) * W},${H - (h[k] / max) * (H - 6)}`).join(' ')
  const charge = hist.map((h, n) => `${(n / Math.max(1, hist.length - 1)) * W},${H - (h.stored / Math.max(1, h.cap)) * (H - 6)}`).join(' ')
  const offGrid = [...sim.ents.values()].filter((e) => e.status === 'nogrid')
  const count = (k: Kind) => sim.list(k).filter((e) => e.onGrid).length
  const users = (Object.entries(P.byKind) as [Kind, number][]).sort((a, b) => b[1] - a[1])
  return (
    <Modal title="Power grid" icon="power" onClose={() => store.setPanel(null)} wide>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="border border-[#3F4246] bg-[#151618]/60 p-2">
          <p className={TONE.label}>Generating</p>
          <p className={`text-2xl ${TONE.cyan}`}>{Math.round(P.gen)} kW</p>
          <p className="font-sans text-[13px] normal-case text-[#BFBFBF]">
            Solar {Math.round(P.solarGen)} · Reactor {Math.round(P.reactorGen)}
          </p>
        </div>
        <div className="border border-[#3F4246] bg-[#151618]/60 p-2">
          <p className={TONE.label}>Using</p>
          <p className={`text-2xl ${P.gen < P.demand ? TONE.warn : 'text-white'}`}>{Math.round(P.demand)} kW</p>
          <p className="font-sans text-[13px] normal-case text-[#BFBFBF]">{P.discharge > 0.5 ? `Batteries supplying ${Math.round(P.discharge)} kW` : 'Running on generation'}</p>
        </div>
        <div className="border border-[#3F4246] bg-[#151618]/60 p-2">
          <p className={`flex items-center gap-1 ${TONE.label}`}>
            <Icon name="battery" size={16} /> Stored
          </p>
          <p className="text-2xl text-white">{Math.floor((P.stored / reserve) * 100)}%</p>
          <Bar value={P.stored / reserve} color="#65C9E8" />
          <p className="mt-1 font-sans text-[13px] normal-case text-[#BFBFBF]">
            {fmt(P.stored)} / {fmt(reserve)} kJ
          </p>
        </div>
      </div>

      {/* history: generation, demand and battery charge over the last few sols */}
      <div className="mt-3 border border-[#3F4246] bg-[#151618] p-2">
        <p className="flex flex-wrap gap-3 text-[11px]">
          <span className={TONE.cyan}>━ Generation</span>
          <span className="text-[#C8754D]">━ Demand</span>
          <span className="text-[#F4D03F]">┅ Battery charge</span>
          {hist.length > 1 && <span className={`ml-auto ${TONE.label}`}>last {Math.max(0.1, Math.round(((hist.length * 2) / SOL) * 10) / 10)} sols</span>}
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
          <p className="flex items-center justify-between gap-2 font-sans text-[13px] normal-case">
            <span>Life support (core, habitats, MOXIE)</span>
            <span className={P.lifeSat < 0.99 ? TONE.bad : TONE.good}>{Math.round(P.lifeSat * 100)}%</span>
          </p>
          <Bar value={P.lifeSat} color="#7BA750" className="mb-1.5 mt-0.5" />
          <p className="flex items-center justify-between gap-2 font-sans text-[13px] normal-case">
            <span>Industry</span>
            <span className={P.indSat < 0.99 ? TONE.warn : TONE.good}>{Math.round(P.indSat * 100)}%</span>
          </p>
          <Bar value={P.indSat} color="#C8754D" className="mt-0.5" />
          <p className={`mt-2 ${TONE.label}`}>Sources</p>
          <ul className="mt-1 space-y-0.5 font-sans text-[13px] normal-case">
            <li>Solar · {count('solar')} on the grid · {P.solar.toFixed(1)} kW per panel now</li>
            <li>Reactors · {count('reactor')}</li>
            <li>Batteries · {count('battery')}</li>
          </ul>
        </div>
        <div>
          <p className={`mb-1 ${TONE.label}`}>Biggest users</p>
          <ul className="space-y-0.5 font-sans text-[13px] normal-case">
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
            <p className={`mt-2 flex gap-1.5 border border-[#B03E53] p-1.5 font-sans text-[13px] normal-case ${TONE.bad}`}>
              <Icon name="warn" size={18} />
              {offGrid.length} building{offGrid.length === 1 ? ' is' : 's are'} not connected. Build power pylons to reach them.
            </p>
          )}
          <button type="button" className={`${btn} mt-2 ${store.ui.powerView ? btnOn : ''}`} onClick={() => store.togglePowerView()}>
            <Icon name="power" size={18} /> {store.ui.powerView ? 'Hide' : 'Show'} grid coverage · P
          </button>
        </div>
      </div>
    </Modal>
  )
}
