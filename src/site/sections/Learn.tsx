'use client'

import { Chapter } from '../components/ui'
import { useReveal } from '../lib/hooks'
import { alt, photo, srcSet, type PhotoKey } from '../lib/media'

const STEPS: { sol: string; title: string; body: string; img: PhotoKey; note: string; h: string; ratio: number }[] = [
  {
    sol: 'Sol 001',
    title: 'Clean the soil',
    body: 'Martian regolith is laced with perchlorate salts. Before anything can grow, they have to be washed out.',
    img: 'seedling',
    note: 'Regolith · perchlorate 0.6%',
    h: 'lg:h-[8.5rem]',
    ratio: 0.42,
  },
  {
    sol: 'Sol 014',
    title: 'Tune the light',
    body: 'Plants feed mostly on red and blue light. Grow lamps skip the rest — and save precious energy.',
    img: 'led',
    note: 'λ 450 + 660 nm',
    h: 'lg:h-[13rem]',
    ratio: 0.62,
  },
  {
    sol: 'Sol 060',
    title: 'Make oxygen',
    body: 'Inside every leaf, living cells turn carbon dioxide — 95% of Mars’ air — into the oxygen we breathe.',
    img: 'cells',
    note: 'Plant tissue · ×400',
    h: 'lg:h-[17.5rem]',
    ratio: 0.82,
  },
  {
    sol: 'Sol 400',
    title: 'Close the loop',
    body: 'Air, water and nutrients, recycled again and again. A small, living copy of Earth — that you designed.',
    img: 'leaves',
    note: 'Water recovery 98%',
    h: 'lg:h-[22rem]',
    ratio: 1,
  },
]

export function Learn() {
  const ref = useReveal<HTMLElement>()
  return (
    <section ref={ref} id="learn" data-chapter="06" data-title="More than a game" className="relative z-10 bg-star text-navy">
      <PixelEdge />
      <div className="mx-auto max-w-[1440px] px-6 pb-24 pt-24 sm:px-10 lg:px-16 lg:pb-32 lg:pt-32">
        <header className="rv flex items-baseline justify-between border-b border-navy/15 pb-5">
          <Chapter n="06" title="More than a game" />
          <p className="label hidden text-navy/65 sm:block">From one seed to a living system</p>
        </header>

        <div className="mt-12 grid gap-8 lg:mt-16 lg:grid-cols-12">
          <h2 className="rv display text-[clamp(2.6rem,6.6vw,6.9rem)] lg:col-span-8">
            Big ideas start with <span className="text-rust">small steps.</span>
          </h2>
          <p className="rv max-w-[38ch] self-end text-lg leading-relaxed text-navy/75 lg:col-span-4 lg:pb-3">
            Discover the science behind growing food, managing resources, and building a sustainable future beyond Earth.
          </p>
        </div>

        {/* Each step climbs a little higher: a growth curve you can read left to right. */}
        <ol className="mt-16 grid gap-12 sm:grid-cols-2 lg:mt-24 lg:grid-cols-4 lg:items-end lg:gap-0">
          {STEPS.map((s, n) => (
            <li
              key={s.sol}
              className="rv border-l border-navy/20 pl-5 lg:border-t lg:pr-6 lg:pt-6"
              style={{ transitionDelay: `${n * 110}ms` }}
            >
              <p className="label flex items-center justify-between text-navy/65">
                <span className={`flex items-center gap-2 ${n === 3 ? 'text-navy' : ''}`}>
                  {n === 3 && <span aria-hidden className="h-1.5 w-1.5 bg-mars" />}
                  {s.sol}
                </span>
                <span>0{n + 1}</span>
              </p>
              <div className={`relative mt-5 h-48 overflow-hidden bg-navy/10 ${s.h}`}>
                <img
                  src={photo(s.img, 800)}
                  srcSet={srcSet(s.img, [480, 800, 1100])}
                  sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 90vw"
                  alt={alt(s.img)}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-[1.4s] ease-expo hover:scale-[1.04]"
                />
                <span className="label absolute bottom-0 left-0 bg-star px-2 py-1 text-[0.625rem] text-navy">{s.note}</span>
              </div>
              <h3 className="mt-5 font-display text-2xl font-medium tracking-[-0.02em]">{s.title}</h3>
              <p className="mt-2 max-w-[34ch] text-sm leading-relaxed text-navy/70">{s.body}</p>
            </li>
          ))}
        </ol>

        <p className="rv mt-16 flex flex-wrap items-baseline gap-x-6 gap-y-2 border-t border-navy/15 pt-6 text-navy/70 lg:mt-24">
          <span className="label text-navy">What you’ll explore</span>
          {['Botany', 'Chemistry', 'Physics', 'Engineering', 'Ecology', 'Systems thinking'].map((t, n) => (
            <span key={t} className="font-display text-lg tracking-[-0.01em]">
              {t}
              {n < 5 && <span aria-hidden className="ml-6 text-navy/25">/</span>}
            </span>
          ))}
        </p>
      </div>
    </section>
  )
}

const EDGE = Array.from({ length: 48 }, (_, i) => {
  const n = Math.sin(i * 12.9898 + 4.1) * 43758.5453
  const r = n - Math.floor(n)
  return r > 0.84 ? 3 : r > 0.52 ? 2 : r > 0.2 ? 1 : 0
})

/** Leaving the game world: the page resolves back out of pixels. */
function PixelEdge() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 48 3"
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      className="pointer-events-none absolute inset-x-0 top-0 h-[6.25vw] w-full -translate-y-full"
    >
      {EDGE.map((h, i) => (h ? <rect key={i} x={i} y={3 - h} width={1.02} height={h} className="fill-star" /> : null))}
    </svg>
  )
}
