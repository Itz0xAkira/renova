'use client'

import { CARGO, PACK_LEAD, STORM_FORECAST } from '@/game/core/sim'
import type { Cargo } from '@/game/core/types'
import type { GameStore } from '@/game/store'
import { btn, btnOn, Icon, Modal, TONE } from '../kit'

const secs = (n: number) => `${Math.ceil(n)} s`

/**
 * Mission Control: the real signal delay to Earth today, the supply-ship order (which has to
 * reach Earth before the ship is packed), and the latest messages from Earth.
 */
export function CommsPanel({ store }: { store: GameStore }) {
  const { sim, space } = store
  const c = sim.commsStatus()
  const mins = space.minutes
  const lead = Math.max(5, STORM_FORECAST - c.delay)
  const inbox = sim.messages.filter((m) => m.text.startsWith('Mission Control')).slice(-4).reverse()
  return (
    <Modal title="Mission Control" icon="comms" onClose={() => store.setPanel(null)} wide>
      <div className="space-y-2 font-sans text-[14px] normal-case leading-relaxed text-[#D9D9D9]">
        <p>
          Today Earth is <b className="text-white">{Math.round(space.km / 1e6).toLocaleString('en')} million km</b> from Mars. A radio message travels at the speed of light, and still takes{' '}
          <b className="text-white">{mins.toFixed(1)} minutes</b> to get there, so a question and its answer take <b className="text-white">{(mins * 2).toFixed(0)} minutes</b>. In the game, every
          minute of delay is one second: your messages take <b className={TONE.cyan}>{Math.round(c.delay)} s</b> to reach Earth.
        </p>
        {space.sunAngle < 5 && (
          <p className={`border-l-4 border-[#F4D03F] bg-[#F4D03F]/10 px-3 py-2 ${TONE.warn}`}>
            Right now Mars is almost behind the Sun as seen from Earth (a solar conjunction). Real missions stop sending commands for a couple of weeks, because the Sun scrambles radio signals.
          </p>
        )}
      </div>

      {/* the supply-ship order */}
      <div className="mt-4 border border-[#3F4246] bg-[#151618]/60 p-3">
        <p className={`mb-2 ${TONE.label}`}>What should the next supply ship bring?</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(CARGO) as Cargo[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={c.want === k}
              onClick={() => (sim.orderCargo(k), store.bump())}
              className={`${btn} flex-col items-start gap-1 text-left ${c.want === k ? btnOn : ''}`}
            >
              <span className="text-[13px] text-white">{CARGO[k].name}</span>
              <span className="font-sans text-[12px] normal-case leading-snug text-[#BFBFBF]">{CARGO[k].brings}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 font-sans text-[13px] normal-case leading-snug text-[#D9D9D9]">
          {c.reachesIn > 0 ? (
            <>
              Your order is on its way: it reaches Earth in <b className={TONE.cyan}>{secs(c.reachesIn)}</b>.{' '}
            </>
          ) : (
            <>
              Mission Control has your order: <b className="text-white">{CARGO[c.atEarth].name.toLowerCase()}</b>.{' '}
            </>
          )}
          {c.packed ? (
            <>
              The next ship is already packed with <b className="text-white">{CARGO[c.packed].name.toLowerCase()}</b> and lands in {secs(c.landIn)}. A new order will go on the ship after.
            </>
          ) : c.reachesIn > 0 && !c.inTime ? (
            <span className={TONE.warn}>
              The next ship is packed in {secs(c.packIn)}, before your message arrives, so it brings {CARGO[c.atEarth].name.toLowerCase()}. Your order goes on the ship after. Next time, decide earlier!
            </span>
          ) : (
            <>
              The next ship is packed in {secs(c.packIn)} and lands {PACK_LEAD} s later.
            </>
          )}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="font-sans text-[13px] normal-case leading-snug text-[#D9D9D9]">
          <p className={`mb-1 font-pixel text-[11px] uppercase ${TONE.label}`}>Why it matters</p>
          <p>
            Nobody on Earth can help in a hurry. Mission Control’s dust-storm forecasts reach you {Math.round(c.delay)} s late, so today you get about <b className="text-white">{Math.round(lead)} s</b> of warning instead of{' '}
            {secs(STORM_FORECAST)}. When Mars is far from Earth, plan ahead and keep batteries charged: the crew has to solve problems on their own.
          </p>
        </div>
        <div>
          <p className={`mb-1 text-[11px] ${TONE.label}`}>Latest from Mission Control</p>
          <ul className="space-y-1 font-sans text-[13px] normal-case leading-snug">
            {inbox.length ? inbox.map((m) => <li key={m.id}>{m.text.replace(/^Mission Control:\s*/, '')}</li>) : <li className={TONE.label}>No messages yet.</li>}
          </ul>
        </div>
      </div>
      <p className="mt-3 font-sans text-[11px] normal-case text-[#8A8A8A]">
        Distance worked out for today’s date from the orbits of Earth and Mars (NASA JPL, “Approximate Positions of the Planets”).
      </p>
    </Modal>
  )
}
