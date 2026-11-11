'use client'

import { useMemo } from 'react'
import { Chapter } from '../components/ui'
import { TEAM } from '../content'
import { useReveal } from '../lib/hooks'

const HELMET = [
  '....wwwwwwww....',
  '..wwwwwwwwwwww..',
  '.wwwwvvvvvvwwww.',
  '.wwwvvvvvvvvwww.',
  'wwwvvhhvvvvvvwww',
  'wwwvvhvvvvvvvwww',
  'wwwvvvvvvvvvvwww',
  'wwwvvvvvvvvvdwww',
  '.wwwvvvvvvvddww.',
  '.wwwwvvvvvvwwww.',
  '..gwwwwwwwwwwg..',
  '...gggwwwwggg...',
  '.aaaagwwwwgaaaa.',
  'aaaaawwppwwaaaaa',
  'aaaaawwppwwaaaaa',
  'aaaaawwwwwwaaaaa',
]
const VISORS = ['#e7a94a', '#58b0ea', '#bf93d8', '#e8753b', '#7cc46a', '#9fd8ff']
const SUITS = ['#26344a', '#b75c42', '#2c4c98', '#3f7f3d', '#6b3a5c', '#82786e']

function avatar(n: number) {
  const cv = document.createElement('canvas')
  cv.width = 16
  cv.height = 16
  const ctx = cv.getContext('2d')!
  const pal: Record<string, string> = {
    w: '#f4f0e8',
    g: '#b3a99c',
    v: VISORS[n % VISORS.length],
    d: 'rgba(16,24,39,0.35)',
    h: '#ffffff',
    a: SUITS[n % SUITS.length],
    p: '#e8753b',
  }
  HELMET.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.') return
      if (ch === 'd') {
        ctx.fillStyle = pal.v
        ctx.fillRect(x, y, 1, 1)
      }
      ctx.fillStyle = pal[ch]
      ctx.fillRect(x, y, 1, 1)
    }),
  )
  return cv.toDataURL()
}

export function Team() {
  const ref = useReveal<HTMLElement>()
  const faces = useMemo(() => TEAM.map((_, n) => avatar(n)), [])
  return (
    <section ref={ref} id="team" data-chapter="08" data-title="The team" className="relative z-10 bg-slate text-star">
      <div className="mx-auto max-w-[1440px] px-6 pb-24 pt-24 sm:px-10 lg:px-16 lg:pb-32 lg:pt-32">
        <header className="rv flex items-baseline justify-between border-b border-star/15 pb-5">
          <Chapter n="08" title="The team" />
          <p className="label hidden text-star/60 sm:block">Crew manifest · Mission 001</p>
        </header>

        <div className="mt-12 grid gap-8 lg:mt-16 lg:grid-cols-12">
          <h2 className="rv display text-[clamp(2.6rem,6.2vw,6.4rem)] lg:col-span-8">Meet the minds behind the mission.</h2>
          <p className="rv max-w-[34ch] self-end text-lg leading-relaxed text-star/70 lg:col-span-4 lg:pb-3">
            A team of creative minds working together to make life on Mars a little more imaginable.
          </p>
        </div>

        <ul className="mt-16 border-t border-star/15 lg:mt-24">
          <li aria-hidden className="label hidden grid-cols-[5rem_4.5rem_1.2fr_1fr_1.5fr] gap-6 border-b border-star/15 py-3 text-star/55 lg:grid">
            <span />
            <span>No.</span>
            <span>Name</span>
            <span>Role</span>
            <span>Contribution</span>
          </li>
          {TEAM.map((m, n) => (
            <li
              key={n}
              className="rv group grid grid-cols-[4rem_1fr] items-center gap-x-5 gap-y-1 border-b border-star/15 py-5 hover:bg-star/[0.04] lg:grid-cols-[5rem_4.5rem_1.2fr_1fr_1.5fr] lg:gap-6"
              style={{ transitionDelay: `${n * 60}ms` }}
            >
              <img
                src={faces[n]}
                alt=""
                width={64}
                height={64}
                className="pixelated row-span-3 h-14 w-14 bg-navy transition-transform duration-500 ease-expo group-hover:-translate-y-1 lg:row-span-1 lg:h-16 lg:w-16"
              />
              <span className="label hidden text-star/60 lg:block">Crew {String(n + 1).padStart(2, '0')}</span>
              <span className="font-display text-xl font-medium tracking-[-0.02em] sm:text-2xl">{m.name}</span>
              <span className="label text-mars">{m.role}</span>
              <span className="text-sm leading-relaxed text-star/65">{m.contribution}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
