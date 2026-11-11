'use client'

import { useEffect, useRef, useState } from 'react'
import { useScrollFrame } from '../lib/hooks'
import { Logo } from './ui'

const LINKS = [
  { href: '#challenge', label: 'Mission' },
  { href: '#game', label: 'The Game' },
  { href: '#about', label: 'About' },
]

export function Nav({ onPlay, ready }: { onPlay: () => void; ready: boolean }) {
  const [solid, setSolid] = useState(false)
  const [tucked, setTucked] = useState(false)
  const [open, setOpen] = useState(false)
  const last = useRef(0)

  useScrollFrame(() => {
    const y = window.scrollY
    setSolid(y > window.innerHeight * 0.85)
    setTucked(y > last.current + 4 && y > window.innerHeight * 1.2)
    if (Math.abs(y - last.current) > 4) last.current = y
  })

  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open])

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-[transform,background-color,opacity] duration-500 ${
          solid ? 'bg-navy/95 shadow-[0_1px_0_rgba(244,240,232,0.06)]' : 'bg-transparent'
        } ${tucked && !open ? '-translate-y-full' : ''} ${ready ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      >
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-6 sm:px-10 lg:h-20 lg:px-16">
          <a href="#top" className="text-[1.15rem] text-star" aria-label="RENOVA — back to the start">
            <Logo />
          </a>
          <nav aria-label="Primary" className="hidden items-center gap-10 md:flex">
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} className="group relative text-sm text-star/75 transition-colors hover:text-star">
                {l.label}
                <span className="absolute -bottom-1 left-0 h-px w-0 bg-mars transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
            <button
              type="button"
              onClick={onPlay}
              className="group flex items-center gap-3 border border-star/25 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-star transition-colors hover:border-mars hover:bg-mars hover:text-navy"
            >
              <span aria-hidden className="grid grid-cols-2 gap-px">
                {[0, 1, 2, 3].map((n) => (
                  <span key={n} className={`h-1 w-1 ${n === 1 ? 'bg-mars group-hover:bg-navy' : 'bg-current'}`} />
                ))}
              </span>
              Enter the game
            </button>
          </nav>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            className="label flex items-center gap-3 text-star md:hidden"
          >
            {open ? 'Close' : 'Menu'}
            <span aria-hidden className="flex w-6 flex-col gap-1.5">
              <span className={`h-px bg-current transition-transform ${open ? 'translate-y-[3.5px] rotate-45' : ''}`} />
              <span className={`h-px bg-current transition-transform ${open ? '-translate-y-[3.5px] -rotate-45' : ''}`} />
            </span>
          </button>
        </div>
      </header>

      <div
        id="mobile-menu"
        className={`fixed inset-0 z-40 flex flex-col justify-between bg-navy px-6 pb-10 pt-28 transition-[opacity,visibility] duration-500 md:hidden ${
          open ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      >
        <nav aria-label="Mobile" className="flex flex-col gap-2">
          {LINKS.map((l, n) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="display flex items-baseline gap-4 py-2 text-5xl text-star">
              <span className="label text-mars">0{n + 1}</span>
              {l.label}
            </a>
          ))}
        </nav>
        <div className="space-y-6">
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onPlay()
            }}
            className="w-full bg-mars px-6 py-4 text-left text-sm font-semibold uppercase tracking-[0.16em] text-navy"
          >
            Enter the game →
          </button>
          <p className="label text-star/60">Explore Beyond. Sustain Within.</p>
        </div>
      </div>
    </>
  )
}
