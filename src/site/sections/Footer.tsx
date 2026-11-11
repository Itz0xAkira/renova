'use client'

import { Cta, Logo } from '../components/ui'
import { useReveal } from '../lib/hooks'
import { alt, photo, srcSet } from '../lib/media'

export function Footer({ onPlay }: { onPlay: () => void }) {
  const ref = useReveal<HTMLElement>()
  return (
    <footer ref={ref} data-chapter="09" data-title="End of transmission" className="relative z-10 overflow-hidden bg-navy text-star">
      <img
        src={photo('night', 1920)}
        srcSet={srcSet('night', [960, 1600, 2400])}
        sizes="100vw"
        alt={alt('night')}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover object-bottom opacity-80"
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-navy via-navy/60 to-navy/30" />

      <div className="relative mx-auto flex min-h-[100svh] max-w-[1440px] flex-col px-6 pt-24 sm:px-10 lg:px-16 lg:pt-32">
        <div className="rv flex items-baseline justify-between border-b border-star/15 pb-5">
          <p className="label flex items-center gap-4">
            <span>09</span>
            <span aria-hidden className="h-px w-10 bg-current opacity-40" />
            <span>End of transmission</span>
          </p>
          <p className="label hidden text-star/60 sm:block">Signal delay 12 min 40 s</p>
        </div>

        <div className="flex flex-1 flex-col justify-center py-20">
          <h2 className="rv display max-w-[13ch] text-[clamp(2.9rem,8.4vw,8.75rem)]">The next world is yours to imagine.</h2>
          <div className="rv mt-12 flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-display text-xl tracking-[-0.01em] text-star/85 sm:text-2xl">
              Explore Beyond. <span className="text-mars">Sustain Within.</span>
            </p>
            <Cta onClick={onPlay}>Enter the game</Cta>
          </div>
        </div>

        <div className="grid gap-8 border-t border-star/15 py-8 text-star/60 sm:grid-cols-2 lg:grid-cols-12 lg:items-center">
          <div className="flex items-center gap-6 lg:col-span-3">
            <span className="text-lg text-star">
              <Logo />
            </span>
            <span className="label">© 2026</span>
          </div>
          <nav aria-label="Footer" className="flex gap-8 text-sm lg:col-span-3">
            <a href="#challenge" className="hover:text-star">
              Mission
            </a>
            <a href="#game" className="hover:text-star">
              The Game
            </a>
            <a href="#about" className="hover:text-star">
              About
            </a>
          </nav>
          <dl className="label grid grid-cols-2 gap-4 sm:col-span-2 lg:col-span-5">
            <div>
              <dt className="text-star/55">Landing site</dt>
              <dd className="mt-1 text-star/80">18.38°N 77.58°E · Jezero</dd>
            </div>
            <div>
              <dt className="text-star/55">Mission status</dt>
              <dd className="mt-1 flex items-center gap-2 text-star/80">
                <span aria-hidden className="blink h-1.5 w-1.5 bg-mars" /> Recruiting explorers
              </dd>
            </div>
          </dl>
          <a
            href="#top"
            aria-label="Back to the top"
            className="label flex items-center gap-3 justify-self-start text-star/80 hover:text-star sm:justify-self-end lg:col-span-1"
          >
            Top
            <span aria-hidden className="flex h-9 w-9 items-center justify-center border border-star/30">
              ↑
            </span>
          </a>
        </div>
      </div>
    </footer>
  )
}
