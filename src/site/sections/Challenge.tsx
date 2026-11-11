'use client'

import { useRef } from 'react'
import { Chapter } from '../components/ui'
import { clamp, useReveal, useScrollFrame } from '../lib/hooks'
import { alt, photo, srcSet } from '../lib/media'

const FACTS = [
  {
    k: '−63°C',
    v: 'Average surface temperature. Liquid water can’t last out in the open.',
    pos: 'lg:left-0 lg:bottom-[81%] lg:w-[25%]',
  },
  {
    k: '0.6%',
    v: 'Of Earth’s air pressure — and that thin air is 95% carbon dioxide.',
    pos: 'lg:right-0 lg:bottom-[75%] lg:w-[25%] lg:text-right',
  },
  {
    k: '43%',
    v: 'Of the sunlight we get on Earth. Energy matters.',
    pos: 'lg:right-0 lg:top-[79.5%] lg:w-[24%] lg:text-right',
  },
  {
    k: 'Ice',
    v: 'Water hides in polar caps and buried ice. Every drop counts.',
    pos: 'lg:left-0 lg:top-[83.5%] lg:w-[24%]',
  },
]

export function Challenge() {
  const ref = useReveal<HTMLElement>()
  const planet = useRef<HTMLDivElement>(null)

  useScrollFrame(() => {
    const el = planet.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const p = clamp((window.innerHeight - r.top) / (window.innerHeight + r.height))
    el.style.transform = `translate3d(0, ${((0.5 - p) * 60).toFixed(1)}px, 0) rotate(${((p - 0.5) * 8).toFixed(2)}deg)`
  })

  return (
    <section id="challenge" ref={ref} data-chapter="02" data-title="The Challenge" className="relative z-10 bg-star text-navy">
      <div className="mx-auto max-w-[1440px] px-6 pb-24 pt-24 sm:px-10 lg:px-16 lg:pb-32 lg:pt-36">
        <header className="rv flex items-baseline justify-between border-b border-navy/15 pb-5">
          <Chapter n="02" title="The Challenge" />
          <p className="label hidden text-navy/65 sm:block">Fig. 02 — The fourth planet from the Sun</p>
        </header>

        <h2 className="rv display mt-12 max-w-[14ch] text-[clamp(2.6rem,7vw,7.25rem)] lg:mt-16">A planet full of possibilities.</h2>
        <p className="rv display mt-5 text-[clamp(1.5rem,3.2vw,3.1rem)] leading-[1.02] tracking-[-0.03em] text-rust lg:pl-[38%]">
          A few challenges along the way.
        </p>

        <div className="mt-16 grid gap-14 lg:mt-20 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-4 lg:pt-28">
            <p className="rv max-w-[42ch] text-lg leading-relaxed text-navy/75">
              Mars is a fascinating place, but building a home there isn’t easy. Water is limited, energy matters, and every
              resource counts.
            </p>
            <p className="rv display mt-10 text-[2rem] leading-tight tracking-[-0.03em]">
              Can you figure it out?
              <span aria-hidden className="mt-4 block h-[3px] w-16 bg-mars" />
            </p>
          </div>

          <figure className="rv relative lg:col-span-8 lg:aspect-square">
            <div className="relative mx-auto aspect-square w-[80%] lg:absolute lg:inset-[16%] lg:w-auto">
              <div ref={planet} className="h-full w-full will-change-transform">
                <div className="h-full w-full overflow-hidden rounded-full bg-black">
                  <img
                    src={photo('mars', 1200, 1200)}
                    srcSet={srcSet('mars', [600, 900, 1200, 1600], 1)}
                    sizes="(min-width: 1024px) 40vw, 80vw"
                    alt={alt('mars')}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full scale-[1.06] object-cover"
                  />
                </div>
              </div>
            </div>
            <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 hidden h-full w-full text-navy/40 lg:block">
              {[
                'M25.5 26 L19 19.5 H0',
                'M76.5 28 L81 25.5 H100',
                'M74.5 74.5 L79.5 79 H100',
                'M26 74.5 L21.5 83 H0',
              ].map((d, n) => (
                <path
                  key={d}
                  d={d}
                  pathLength={1}
                  className="draw"
                  style={{ transitionDelay: `${300 + n * 150}ms` }}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="0.13"
                />
              ))}
              {[
                [25.5, 26],
                [76.5, 28],
                [74.5, 74.5],
                [26, 74.5],
              ].map(([x, y]) => (
                <circle key={x} cx={x} cy={y} r="0.6" fill="#E8753B" />
              ))}
            </svg>
            <ul className="mt-12 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:mt-0 lg:block">
              {FACTS.map((f) => (
                <li key={f.k} className={`border-t border-navy/15 pt-4 lg:absolute lg:border-0 lg:pt-0 ${f.pos}`}>
                  <p className="display text-[clamp(2.25rem,3.4vw,3.25rem)] tracking-[-0.04em]">{f.k}</p>
                  <p className="mt-2 text-sm leading-relaxed text-navy/70">{f.v}</p>
                </li>
              ))}
            </ul>
            <figcaption className="sr-only">Mars, with four of the conditions a colony has to solve.</figcaption>
          </figure>
        </div>

        {/* Earth → Mars: why the colony must sustain itself */}
        <div className="rv mt-24 lg:mt-32">
          <div className="label flex items-center gap-4 text-navy/70">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#3f7fc4]" /> Earth
            </span>
            <span className="relative h-px flex-1 bg-navy/20">
              <span
                aria-hidden
                className="absolute -top-[3px] h-[7px] w-[7px] -translate-x-1/2 rotate-45 bg-navy"
                style={{ animation: 'travel 14s linear infinite' }}
              />
            </span>
            <span className="flex items-center gap-2">
              Mars <span className="h-2 w-2 rounded-full bg-mars" />
            </span>
          </div>
          <div className="mt-8 grid gap-8 lg:grid-cols-12">
            <p className="display text-[clamp(1.6rem,2.6vw,2.4rem)] leading-[1.1] tracking-[-0.03em] lg:col-span-6">
              Too far for deliveries. What your colony needs, it has to make.
            </p>
            <dl className="grid gap-0 text-sm lg:col-span-6 lg:col-start-7 lg:grid-cols-3 lg:gap-6">
              {[
                ['225M km', 'Average distance'],
                ['~7 months', 'Travel time'],
                ['Up to 22 min', 'For one message to arrive'],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex flex-row-reverse items-baseline justify-between gap-4 border-t border-navy/15 py-3 lg:flex-col-reverse lg:justify-end lg:gap-1 lg:border-l lg:border-t-0 lg:py-0 lg:pl-4"
                >
                  <dt className="text-navy/70">{v}</dt>
                  <dd className="font-display text-xl font-medium tracking-tight sm:text-2xl">{k}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  )
}
