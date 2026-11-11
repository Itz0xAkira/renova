'use client'

import { Chapter } from '../components/ui'
import { useReveal } from '../lib/hooks'

const FACTS = [
  ['The idea', 'A Mars agricultural strategy game.'],
  ['Our goal', 'Make complex scientific ideas fun and accessible.'],
  ['Made for', 'Curious minds and future explorers.'],
]

export function About() {
  const ref = useReveal<HTMLElement>()
  return (
    <section ref={ref} id="about" data-chapter="07" data-title="About RENOVA" className="relative z-10 bg-sand text-navy">
      <div className="mx-auto max-w-[1440px] px-6 pb-24 pt-24 sm:px-10 lg:px-16 lg:pb-32 lg:pt-32">
        <header className="rv flex items-baseline justify-between border-b border-navy/20 pb-5">
          <Chapter n="07" title="About RENOVA" />
          <p className="label hidden text-navy/75 sm:block">Explore Beyond. Sustain Within.</p>
        </header>

        <div className="mt-12 grid gap-10 lg:mt-16 lg:grid-cols-12">
          <h2 className="rv display text-[clamp(2.6rem,7vw,7.25rem)] lg:col-span-5">Why RENOVA?</h2>
          <div className="lg:col-span-6 lg:col-start-7 lg:pt-4">
            <p className="rv text-lg leading-relaxed text-navy/80">
              RENOVA is an educational Mars colony simulation game that turns the challenges of space exploration into an
              interactive experience.
            </p>
            <p className="rv display mt-8 text-[clamp(1.6rem,2.5vw,2.25rem)] leading-[1.15] tracking-[-0.025em]">
              Our goal is simple: make science exciting, make learning interactive, and inspire the next generation of
              problem-solvers.
            </p>
          </div>
        </div>

        <dl className="rv mt-16 border-t border-navy/25 lg:mt-24">
          {FACTS.map(([k, v]) => (
            <div key={k} className="group grid gap-2 border-b border-navy/25 py-6 sm:grid-cols-12 sm:items-baseline sm:gap-8 lg:py-8">
              <dt className="label text-navy/60 sm:col-span-3 lg:col-span-5">{k}</dt>
              <dd className="font-display text-[clamp(1.4rem,2.4vw,2.2rem)] font-medium tracking-[-0.025em] transition-transform duration-500 ease-expo group-hover:translate-x-2 sm:col-span-9 lg:col-span-7">
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
