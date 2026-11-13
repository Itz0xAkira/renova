'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { GameStore } from '@/game/store'
import { btn, Icon, Modal } from '../kit'

/** The pause menu. */

export function Menu({ store }: { store: GameStore }) {
  const [confirm, setConfirm] = useState(false)
  const [saved, setSaved] = useState<null | boolean>(null)
  const row = `${btn} justify-start py-2 text-sm`
  return (
    <Modal title="Paused" icon="menu" onClose={() => store.setPanel(null)}>
      <nav className="flex flex-col gap-1.5">
        <button type="button" className={row} onClick={() => store.setPanel(null)}>
          <Icon name="play" /> Resume
        </button>
        <button type="button" className={`${row} ${saved === false ? 'border-[#B03E53] text-[#F3A6B6]' : ''}`} onClick={() => setSaved(store.save())}>
          <Icon name={saved ? 'check' : saved === false ? 'warn' : 'battery'} /> {saved ? 'Saved' : saved === false ? 'Could not save' : 'Save game'}
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
      <p className="mt-3 font-sans text-[13px] normal-case text-[#8A8A8A]">
        {store.readOnly
          ? 'This tab has stopped saving because RENOVA is open in another tab.'
          : saved === false
            ? 'This browser blocked the save (private mode or full storage). Progress will be lost when you leave.'
            : 'The game saves itself every few seconds in this browser.'}
      </p>
    </Modal>
  )
}
