'use client'

import { RESEARCH, SOL } from '@/game/core/data'
import type { GameStore } from '@/game/store'
import { Bar, fmt, Icon, Modal, TONE } from '../kit'

/** The research panel. */

export function Research({ store }: { store: GameStore }) {
  const { sim } = store
  const labs = sim.list('lab').filter((e) => e.onGrid).length
  const rate = sim.researchRate() * SOL
  return (
    <Modal title="Research" icon="research" onClose={() => store.setPanel(null)} wide>
      <p className="font-sans text-[12px] normal-case text-[#BFBFBF]">
        {fmt(sim.rp)} RP banked · {sim.current ? `about ${rate.toFixed(0)} RP per sol right now` : 'pick a project to start researching'} ({labs} connected lab{labs === 1 ? '' : 's'} + the core). Build more labs to research faster.
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
