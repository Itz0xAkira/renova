'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { GAME_URL } from '../content'
import { useReducedMotion } from '../lib/hooks'
import { PixelCanvas } from './PixelCanvas'
import { WORLD } from './scenes'
import { HowToPlay } from '@/game/ui/HowToPlay'

type Phase = 'closed' | 'cover-in' | 'reveal-in' | 'open' | 'cover-out' | 'reveal-out'

const BLOCK_COLORS = ['#101827', '#1b2636', '#101827', '#26344a', '#1b2636', '#101827', '#b75c42', '#e8753b']

/** Full-screen pixel dissolve between the website and the game world. */
export function GameEntry({ open, onClose }: { open: boolean; onClose: () => void }) {
  const reduced = useReducedMotion()
  const [phase, setPhase] = useState<Phase>(open ? 'cover-in' : 'closed')
  const cv = useRef<HTMLCanvasElement>(null)
  const lastFocus = useRef<Element | null>(null)

  useEffect(() => {
    if (open && (phase === 'closed' || phase === 'reveal-out' || phase === 'cover-out')) {
      lastFocus.current = document.activeElement
      setPhase('cover-in')
    }
    if (!open && (phase === 'open' || phase === 'reveal-in' || phase === 'cover-in')) setPhase('cover-out')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    const root = document.documentElement
    if (phase === 'closed') {
      root.style.overflow = ''
      if (lastFocus.current instanceof HTMLElement) lastFocus.current.focus({ preventScroll: true })
    } else root.style.overflow = 'hidden'
  }, [phase])

  useEffect(() => {
    if (phase === 'closed' || phase === 'open') return
    const canvas = cv.current
    if (!canvas) return
    const cover = phase === 'cover-in' || phase === 'cover-out'
    const next: Record<string, Phase> = { 'cover-in': 'reveal-in', 'reveal-in': 'open', 'cover-out': 'reveal-out', 'reveal-out': 'closed' }
    const W = window.innerWidth
    const H = window.innerHeight
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!
    const B = Math.ceil(Math.max(W, H) / 22)
    const cols = Math.ceil(W / B)
    const rows = Math.ceil(H / B)
    const N = cols * rows
    const color = (n: number) => BLOCK_COLORS[(n * 2654435761) % 97 % BLOCK_COLORS.length]
    const paint = (n: number) => {
      ctx.fillStyle = color(n)
      ctx.fillRect((n % cols) * B, Math.floor(n / cols) * B, B, B)
    }
    if (!cover) for (let n = 0; n < N; n++) paint(n)
    if (reduced) {
      if (!cover) ctx.clearRect(0, 0, W, H)
      else for (let n = 0; n < N; n++) paint(n)
      const t = setTimeout(() => setPhase(next[phase]), 20)
      return () => clearTimeout(t)
    }
    const order = Array.from({ length: N }, (_, n) => n)
    for (let n = N - 1; n > 0; n--) {
      const k = Math.floor(Math.random() * (n + 1))
      ;[order[n], order[k]] = [order[k], order[n]]
    }
    let done = 0
    let raf = 0
    const start = performance.now()
    const dur = cover ? 520 : 620
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / dur)
      const target = Math.floor((k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2) * N)
      for (; done < target; done++) {
        const n = order[done]
        if (cover) paint(n)
        else ctx.clearRect((n % cols) * B, Math.floor(n / cols) * B, B, B)
      }
      if (k < 1) raf = requestAnimationFrame(step)
      else setPhase(next[phase])
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [phase, reduced])

  if (phase === 'closed') return null
  const showGame = phase === 'reveal-in' || phase === 'open' || phase === 'cover-out'
  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="RENOVA game">
      {showGame && <Screens onClose={onClose} />}
      <canvas ref={cv} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
    </div>
  )
}

function Screens({ onClose }: { onClose: () => void }) {
  const [how, setHow] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (how) setHow(false)
      else onClose()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [how, onClose])

  return (
    <div className="absolute inset-0 overflow-hidden bg-[#0c1220] font-pixel text-star">
      <Title onStart={() => router.push(GAME_URL)} onHow={() => setHow(true)} onClose={onClose} how={how} onHowClose={() => setHow(false)} />
    </div>
  )
}

function PixelButton({ children, onClick, primary, autoFocus }: { children: ReactNode; onClick?: () => void; primary?: boolean; autoFocus?: boolean }) {
  const cls = `group flex w-full items-center justify-between border-2 px-4 py-3 text-left text-xs uppercase transition-colors sm:text-sm ${
    primary ? 'border-mars bg-mars text-navy hover:bg-star hover:border-star' : 'border-star/40 bg-[#0c1220]/70 text-star hover:border-mars hover:text-mars'
  }`
  return (
    <button type="button" onClick={onClick} className={cls} autoFocus={autoFocus}>
      <span>{children}</span>
      <span aria-hidden className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        ◀
      </span>
    </button>
  )
}

function Title({ onStart, onHow, onClose, how, onHowClose }: { onStart: () => void; onHow: () => void; onClose: () => void; how: boolean; onHowClose: () => void }) {
  return (
    <>
      <PixelCanvas scene={WORLD} label="The RENOVA colony at dusk" anchor={(W, H) => [0.5, W / H > 1.15 ? 0.7 : 0.72]} className="absolute inset-0" />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-[#0c1220]/90 via-[#0c1220]/30 to-[#0c1220]/60" />
      <div className="relative z-10 flex h-full flex-col p-5 sm:p-8">
        <div className="flex items-center justify-between gap-4 text-[10px] uppercase text-star/70 sm:text-xs">
          <span>Colony factory sim · Build 0.2</span>
          <button type="button" onClick={onClose} className="border-2 border-star/40 px-3 py-2 text-star transition-colors hover:border-mars hover:bg-mars hover:text-navy">
            Exit · Esc
          </button>
        </div>
        <div className="mt-[7vh] text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-mars sm:text-xs">Mission 001 · Destination Mars</p>
          <h2 className="mt-4 text-[clamp(2.75rem,10vw,7rem)] font-bold leading-none tracking-wide text-star [text-shadow:4px_4px_0_#b75c42,8px_8px_0_#101827]">
            RENOVA
          </h2>
          <p className="mt-5 text-[10px] uppercase text-star/80 sm:text-xs">Explore beyond. Sustain within.</p>
        </div>
        <nav aria-label="Game menu" className="mx-auto mt-8 flex w-full max-w-xs flex-col gap-2">
          <PixelButton onClick={onStart} primary autoFocus={!how}>
            Start mission
          </PixelButton>
          <PixelButton onClick={onHow}>How to play</PixelButton>
          <PixelButton onClick={onClose}>Back to the website</PixelButton>
        </nav>
        <p className="mt-auto text-center text-[10px] uppercase text-star/50">Press esc to return to the website</p>
      </div>
      {how && <HowToPlay onClose={onHowClose} doneLabel="Got it" />}
    </>
  )
}
