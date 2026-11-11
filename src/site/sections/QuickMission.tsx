'use client'

import { useEffect, useMemo, useState } from 'react'
import { Chapter } from '../components/ui'
import { PixelCanvas } from '../pixel/PixelCanvas'
import { outpostScene } from '../pixel/scenes'
import { useReveal } from '../lib/hooks'

type Res = 'water' | 'energy' | 'food' | 'materials'

const START: Record<Res, number> = { water: 18, energy: 72, food: 64, materials: 60 }

const CHOICES: { label: string; fx: Partial<Record<Res, number>>; note: string }[] = [
  {
    label: 'Build a water recycling system',
    fx: { water: 28, energy: -15, materials: -15 },
    note: 'Recycling recovers most of the water you use — but the system runs on power, and your energy reserve takes the hit.',
  },
  {
    label: 'Reduce water consumption',
    fx: { water: 12, food: -14 },
    note: 'Shorter showers help, but your greenhouse gets less water too. A smaller harvest is on the way.',
  },
  {
    label: 'Expand water storage',
    fx: { water: 6, materials: -25 },
    note: 'More tanks buy you time — but storage doesn’t create water. You’ll still need a new source, soon.',
  },
]

const META: Record<Res, { name: string; color: string }> = {
  water: { name: 'Water', color: '#58b0ea' },
  energy: { name: 'Energy', color: '#f2c14e' },
  food: { name: 'Food', color: '#7cc46a' },
  materials: { name: 'Materials', color: '#d9b99a' },
}

export function QuickMission() {
  const ref = useReveal<HTMLElement>()
  const [choice, setChoice] = useState<number | null>(null)
  const [at, setAt] = useState(0)
  const scene = useMemo(() => outpostScene(choice, at), [choice, at])

  const res = { ...START }
  if (choice !== null) (Object.keys(CHOICES[choice].fx) as Res[]).forEach((k) => (res[k] += CHOICES[choice].fx[k] ?? 0))

  const pickChoice = (n: number) => {
    if (choice !== null) return
    setAt(performance.now() / 1000)
    setChoice(n)
  }
  const reset = () => setChoice(null)

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = document.getElementById('mission')
      if (!el || e.target instanceof HTMLInputElement) return
      const r = el.getBoundingClientRect()
      if (r.top > window.innerHeight * 0.5 || r.bottom < window.innerHeight * 0.5) return
      if (['1', '2', '3'].includes(e.key)) pickChoice(Number(e.key) - 1)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  return (
    <section ref={ref} id="mission" data-chapter="04" data-title="Quick mission" className="relative z-10 overflow-hidden bg-navy text-star">
      <div className="mx-auto max-w-[1440px] px-6 pb-24 pt-24 sm:px-10 lg:px-16 lg:pb-32 lg:pt-32">
        <header className="rv flex items-baseline justify-between border-b border-star/15 pb-5">
          <Chapter n="04" title="Quick mission" />
          <p className="label hidden text-star/60 sm:block">Colony 001 · Sol 142 · 06:40 local</p>
        </header>

        <div className="mt-12 grid gap-6 lg:mt-16 lg:grid-cols-12">
          <h2 className="rv display text-[clamp(2.6rem,7vw,7.25rem)] lg:col-span-8">Think like an engineer.</h2>
          <p className="rv self-end text-lg text-star/75 lg:col-span-4 lg:pb-3">Your first mission starts now.</p>
        </div>

        {/* Mission console */}
        <div className="rv relative mt-14 grid border border-star/15 lg:mt-20 lg:grid-cols-12">
          {[
            'left-0 top-0 border-l border-t',
            'right-0 top-0 border-r border-t',
            'left-0 bottom-0 border-l border-b',
            'right-0 bottom-0 border-r border-b',
          ].map((c) => (
            <span key={c} aria-hidden className={`absolute -m-px h-3 w-3 border-mars ${c}`} />
          ))}

          {/* outpost feed */}
          <div className="relative border-b border-star/15 lg:col-span-6 lg:border-b-0 lg:border-r">
            <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#0c1220]">
              <PixelCanvas scene={scene} label="Pixel view of the outpost: a habitat, greenhouse, solar panels and a nearly empty water tank" base={150} minW={220} E={12} anchor={[0.5, 0.6]} horizon={0.3} />
              <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4 font-pixel text-[11px] uppercase text-star sm:text-xs">
                <span className="bg-navy/70 px-2 py-1">Outpost cam 02</span>
                <span className={`px-2 py-1 ${res.water < 25 ? 'bg-[#ff5a4f] text-navy' : 'bg-navy/70'}`}>
                  {res.water < 25 && <span className="blink mr-1">▲</span>}H₂O {res.water}%
                </span>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-px bg-star/10 sm:grid-cols-4">
              {(Object.keys(META) as Res[]).map((k) => {
                const d = choice !== null ? CHOICES[choice].fx[k] : undefined
                return (
                  <div key={k} className="bg-navy p-4">
                    <dt className="label flex justify-between text-star/60">
                      {META[k].name}
                      {d !== undefined && (
                        <span className={`rise ${d > 0 ? 'text-[#7ee07a]' : 'text-[#ff8a7a]'}`}>
                          {d > 0 ? '+' : '−'}
                          {Math.abs(d)}
                        </span>
                      )}
                    </dt>
                    <dd className="mt-3">
                      <span className="font-display text-2xl font-medium tabular-nums">{res[k]}%</span>
                      <span className="mt-2 block h-[3px] bg-star/10">
                        <span
                          className="block h-full transition-[width] duration-1000 ease-expo"
                          style={{ width: `${res[k]}%`, background: res[k] < 25 ? '#ff5a4f' : META[k].color }}
                        />
                      </span>
                    </dd>
                  </div>
                )
              })}
            </dl>
          </div>

          {/* briefing + decisions */}
          <div className="flex flex-col p-6 sm:p-8 lg:col-span-6 lg:p-12">
            <p className="label flex items-center gap-2 text-[#ff8a7a]">
              <span aria-hidden className="blink h-1.5 w-1.5 bg-[#ff5a4f]" /> Priority alert
            </p>
            <h3 className="display mt-5 text-[clamp(1.9rem,3.2vw,2.9rem)] leading-[1.02] tracking-[-0.035em]">
              Uh-oh. Your colony is running low on water!
            </h3>
            <p className="mt-4 text-star/70">You have limited resources. What’s your next move?</p>

            <ol className="mt-8 border-t border-star/15" aria-label="Choose your move">
              {CHOICES.map((c, n) => {
                const state = choice === null ? 'idle' : choice === n ? 'on' : 'off'
                return (
                  <li key={c.label} className="border-b border-star/15">
                    <button
                      type="button"
                      onClick={() => pickChoice(n)}
                      disabled={choice !== null}
                      aria-pressed={choice === n}
                      className={`group flex w-full items-center gap-5 py-4 text-left transition-colors duration-300 sm:py-5 ${
                        state === 'on' ? 'text-mars' : state === 'off' ? 'text-star/30' : 'text-star hover:text-mars'
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center border font-pixel text-xs transition-colors ${
                          state === 'on' ? 'border-mars bg-mars text-navy' : 'border-current'
                        }`}
                      >
                        {n + 1}
                      </span>
                      <span className="flex-1 font-display text-lg font-medium tracking-[-0.01em] sm:text-xl">{c.label}</span>
                      <span aria-hidden className={`text-lg transition-transform ${state === 'idle' ? 'opacity-0 group-hover:translate-x-1 group-hover:opacity-100' : 'opacity-0'}`}>
                        →
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>

            <div aria-live="polite" className="mt-8 min-h-[11rem]">
              {choice === null ? (
                <p className="label text-star/60">Select a move · or press 1, 2 or 3</p>
              ) : (
                <div key={choice} className="rise">
                  <p className="display text-[1.9rem] leading-tight tracking-[-0.03em] text-star">Nice thinking, future engineer!</p>
                  <p className="mt-3 text-star/75">{CHOICES[choice].note}</p>
                  <p className="mt-3 text-star/75">
                    Every decision has trade-offs. In RENOVA, you’ll discover how your choices shape your colony.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
                    <button type="button" onClick={reset} className="label text-star/70 underline decoration-star/30 underline-offset-4 hover:text-star">
                      Try another move
                    </button>
                    <a href="#game" className="label text-mars underline decoration-mars/40 underline-offset-4 hover:text-star">
                      Continue the mission ↓
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
