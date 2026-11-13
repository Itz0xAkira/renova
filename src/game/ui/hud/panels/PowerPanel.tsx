'use client'

import { BUILDINGS, CORE_LINK, CORE_REACH, PYLON_LINK, PYLON_REACH, SOL, UPGRADES, type Kind } from '@/game/core/data'
import { RESERVE_KJ } from '@/game/core/sim'
import type { GameStore } from '@/game/store'
import { Bar, btn, btnOn, fmt, Icon, Modal, TONE } from '../kit'
import { gridHint, gridSummary } from '../power'

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
  const status = gridSummary(sim)
  return (
    <Modal title="Power grid" icon="power" onClose={() => store.setPanel(null)} wide>
      <p
        className={`mb-3 border-l-4 px-3 py-2 font-sans text-[14px] normal-case leading-snug ${status.tone === 'bad' ? 'border-[#D86B7B] bg-[#D86B7B]/10 text-[#F3A6B6]' : status.tone === 'warn' ? 'border-[#F4D03F] bg-[#F4D03F]/10 text-[#F4D03F]' : 'border-[#7BA750] bg-[#7BA750]/10 text-[#A8B87A]'}`}
      >
        {status.text}
      </p>
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
            <div className={`mt-2 border border-[#B03E53] p-1.5 font-sans text-[13px] normal-case ${TONE.bad}`}>
              <p className="flex gap-1.5">
                <Icon name="warn" size={18} />
                {offGrid.length} building{offGrid.length === 1 ? ' isn’t' : 's aren’t'} connected:
              </p>
              <ul className="mt-1 space-y-1 pl-6 text-[#F3A6B6]">
                {offGrid.slice(0, 4).map((e) => (
                  <li key={e.id}>
                    <b className="text-white">{BUILDINGS[e.kind].name}</b> — {gridHint(sim, e)?.text}
                  </li>
                ))}
                {offGrid.length > 4 && <li>…and {offGrid.length - 4} more (press P to see them on the map)</li>}
              </ul>
            </div>
          )}
          <button type="button" className={`${btn} mt-2 ${store.ui.powerView ? btnOn : ''}`} onClick={() => store.togglePowerView()}>
            <Icon name="power" size={18} /> {store.ui.powerView ? 'Hide' : 'Show'} grid coverage · P
          </button>
        </div>
      </div>

      {/* the rules, with today's numbers */}
      <div className="mt-3 border border-[#3F4246] bg-[#151618]/60 p-3">
        <p className={`mb-2 ${TONE.label}`}>How the grid works</p>
        <div className="grid gap-3 md:grid-cols-[1fr_1.1fr]">
          <GridDiagram />
          <div className="space-y-2 font-sans text-[13px] normal-case leading-snug text-[#D9D9D9]">
            <p>
              The <b className="text-white">core</b> and every <b className="text-white">pylon</b> have two ranges:
            </p>
            <p>
              <b className={TONE.cyan}>Area</b>: the blue square around it. Any building with at least one tile in a connected area is on the grid.
            </p>
            <p>
              <b className="text-[#F4D03F]">Cable</b>: how far a cable stretches to the next pylon. A pylon only works if a cable reaches it from the core or a connected pylon. Upgrading a pylon makes both bigger.
            </p>
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className={TONE.label}>
                  <th className="py-0.5 text-left font-normal" />
                  <th className="py-0.5 text-right font-normal">Area</th>
                  <th className="py-0.5 text-right font-normal">Cable</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[#3F4246]">
                  <td className="py-0.5">Core</td>
                  <td className="text-right">{CORE_REACH} tiles</td>
                  <td className="text-right">{CORE_LINK} tiles</td>
                </tr>
                {UPGRADES.pylon!.names.map((name, k) => (
                  <tr key={name} className="border-t border-[#3F4246]">
                    <td className="py-0.5">{name}</td>
                    <td className="text-right">{PYLON_REACH[k]} tiles</td>
                    <td className="text-right">{PYLON_LINK[k]} tiles</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              <b className="text-[#F3A6B6]">Not connected</b> means no area reaches the building. <b className="text-[#F4D03F]">Not enough power</b> means it’s connected, but the colony is making less than it uses.
            </p>
          </div>
        </div>
      </div>
    </Modal>
  )
}

/** A top-down sketch of the two ranges: areas, cables, and what's in and out. */
function GridDiagram() {
  return (
    <svg viewBox="0 0 320 170" className="w-full" role="img" aria-label="Diagram: the core and a pylon each power a square area; a cable links the pylon to the core; a pylon too far for a cable powers nothing">
      {/* areas */}
      <rect x={10} y={30} width={110} height={110} fill="#65C9E8" fillOpacity={0.12} stroke="#65C9E8" strokeDasharray="4 3" />
      <rect x={120} y={40} width={90} height={90} fill="#65C9E8" fillOpacity={0.12} stroke="#65C9E8" strokeDasharray="4 3" />
      {/* cable core → pylon, and one that can't reach */}
      <line x1={65} y1={85} x2={165} y2={85} stroke="#F4D03F" strokeWidth={2} />
      <line x1={165} y1={85} x2={290} y2={85} stroke="#D86B7B" strokeWidth={1.5} strokeDasharray="3 4" />
      {/* core, pylons */}
      <rect x={52} y={72} width={26} height={26} fill="#5A5D60" stroke="#BFBFBF" />
      <text x={65} y={113} fill="#D9D9D9" fontSize={10} textAnchor="middle">core</text>
      <circle cx={165} cy={85} r={6} fill="#65C9E8" />
      <text x={165} y={103} fill="#D9D9D9" fontSize={10} textAnchor="middle">pylon</text>
      <circle cx={290} cy={85} r={6} fill="#5A5D60" stroke="#D86B7B" />
      <text x={290} y={103} fill="#F3A6B6" fontSize={10} textAnchor="middle">too far</text>
      <text x={228} y={78} fill="#F3A6B6" fontSize={9} textAnchor="middle">no cable</text>
      {/* buildings in and out */}
      <rect x={185} y={50} width={18} height={18} fill="#7BA750" />
      <text x={194} y={46} fill="#A8B87A" fontSize={9} textAnchor="middle">on grid</text>
      <rect x={232} y={130} width={18} height={18} fill="#D86B7B" />
      <text x={241} y={162} fill="#F3A6B6" fontSize={9} textAnchor="middle">not connected</text>
      <text x={65} y={22} fill="#65C9E8" fontSize={10} textAnchor="middle">area</text>
      <text x={115} y={80} fill="#F4D03F" fontSize={10} textAnchor="middle">cable</text>
    </svg>
  )
}
