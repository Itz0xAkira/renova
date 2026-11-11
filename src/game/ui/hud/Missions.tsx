'use client'

import { useState } from 'react'
import { MISSIONS } from '@/game/core/missions'
import type { GameStore } from '@/game/store'
import { Bar, Icon, panel, TONE } from './kit'

/** The mission log: current mission, progress, tip and the latest messages. */

export function Missions({ store }: { store: GameStore }) {
  const { sim } = store
  // phones start with the log folded so it doesn't cover the map
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.matchMedia('(min-width: 640px)').matches)
  const m = MISSIONS[sim.mission]
  const prog = m?.progress?.(sim)
  const msgs = sim.messages.slice(-4).reverse()
  const toneIcon = { info: 'tip', good: 'check', warn: 'warn', bad: 'warn' } as const
  const toneText = { info: 'text-[#BFBFBF]', good: TONE.good, warn: TONE.warn, bad: TONE.bad }
  return (
    <section className={`${panel} pointer-events-auto w-full max-w-[18rem] border-t-2 border-t-[#A95738]`} aria-label="Mission log">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-2 px-2.5 py-2 text-left">
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
