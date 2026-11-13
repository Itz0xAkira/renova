'use client'

import Link from 'next/link'
import type { IconName } from '@/game/art/icons'
import type { GameStore } from '@/game/store'
import { btn, Modal } from '../kit'

/** Popups: research cards, win and lose. */

export function PopupCard({ store }: { store: GameStore }) {
  const p = store.sim.popups[0]
  const kicker = { research: `Science unlocked · ${p.field}`, win: 'Mission accomplished', lose: 'Colony report', intro: 'Mission 001 · Sol 1', science: `Real NASA data · ${p.field}` }[p.kind]
  const icon: IconName = { research: 'research', win: 'check', lose: 'warn', intro: 'flag', science: 'sun' }[p.kind] as IconName
  const primary = `${btn} justify-center border-[#C8754D] bg-[#A95738] text-white hover:bg-[#C8754D]`
  return (
    <Modal title={p.title} icon={icon}>
      <p className="text-[12px] text-[#E5B07A]">{kicker}</p>
      <p className="mt-2 font-sans text-[15px] normal-case leading-relaxed text-[#F6F6F6]">{p.body}</p>
      {p.link && (
        <a href={p.link} target="_blank" rel="noreferrer" className="mt-2 inline-block font-sans text-[13px] normal-case text-[#65C9E8] underline underline-offset-2 hover:text-white">
          See this event in NASA’s records ↗
        </a>
      )}
      <div className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
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
