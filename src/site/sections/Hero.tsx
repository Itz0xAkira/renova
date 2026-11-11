'use client'

import { useEffect, useRef, useState } from 'react'
import { Cta } from '../components/ui'
import { clamp, useReducedMotion, useScrollFrame } from '../lib/hooks'
import { alt, photo, srcSet } from '../lib/media'

export function Hero({ onReady }: { onReady: () => void }) {
  const reduced = useReducedMotion()
  // 0 black · 1 title card · 2 scene fades up, letterbox opens · 3 interface
  const [stage, setStage] = useState(0)
  const media = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const shade = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reduced || window.scrollY > 40) {
      setStage(3)
      onReady()
      return
    }
    const ts = [
      setTimeout(() => setStage(1), 150),
      setTimeout(() => setStage(2), 1350),
      setTimeout(() => {
        setStage(3)
        onReady()
      }, 2150),
    ]
    return () => ts.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The hero stays pinned while the next chapter slides over it: push the camera in and dim.
  useScrollFrame(() => {
    const vh = window.innerHeight
    const y = window.scrollY
    if (y > vh * 2) return
    const p = clamp(y / vh)
    if (media.current) media.current.style.transform = `translate3d(0, ${(-p * 3).toFixed(2)}%, 0) scale(${(1 + p * 0.1).toFixed(4)})`
    if (content.current) {
      content.current.style.transform = `translate3d(0, ${(-y * 0.3).toFixed(1)}px, 0)`
      content.current.style.opacity = String(clamp(1 - p * 1.4))
    }
    if (shade.current) shade.current.style.opacity = String(p * 0.85)
  })

  return (
    <div className="relative h-[200svh] -mb-[100svh]">
      <section id="top" data-chapter="01" data-title="Arrival" aria-label="Introduction" className="sticky top-0 h-[100svh] overflow-hidden bg-black">
        <div ref={media} className="absolute inset-0 will-change-transform">
          <img
            src={photo('hero', 1920)}
            srcSet={srcSet('hero', [828, 1280, 1920, 2560])}
            sizes="100vw"
            alt={alt('hero')}
            fetchPriority="high"
            decoding="async"
            className={`h-full w-full object-cover transition-[opacity,transform] duration-[3800ms] ease-expo ${
              stage >= 2 ? 'scale-100 opacity-100' : 'scale-[1.16] opacity-0'
            }`}
            style={{ objectPosition: '50% 60%' }}
          />
        </div>

        {/* grade: keep the sky deep, let the ground carry the type */}
        <div aria-hidden className="absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-navy/75 to-transparent" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-t from-navy via-navy/55 to-transparent" />

        {/* Home, as seen from Mars */}
        <div
          className={`absolute left-[14%] top-[19%] transition-opacity delay-500 duration-[1600ms] xl:left-auto xl:right-[18%] xl:top-[21%] ${stage >= 3 ? 'opacity-100' : 'opacity-0'}`}
        >
          <span aria-hidden className="block h-[5px] w-[5px] rounded-full bg-[#cfe8ff] shadow-[0_0_12px_3px_rgba(150,205,255,0.55)]" />
          <div className="absolute left-2 top-2 flex">
            <svg aria-hidden width="44" height="30" viewBox="0 0 44 30" className="text-star/50">
              <path d="M1 1 L18 22 H44" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
            <p className="label -ml-0.5 mt-4 whitespace-nowrap text-star/75">
              Earth
              <span className="block text-star/60">225,000,000 km away</span>
            </p>
          </div>
        </div>

        <div ref={content} className="absolute inset-0 z-10 flex flex-col justify-end px-6 pb-7 sm:px-10 lg:px-16 lg:pb-10">
          <div className={`mx-auto w-full max-w-[1440px] ${stage >= 3 ? 'in' : ''}`}>
            <p className="label mb-6 flex items-center gap-3 text-star/80 sm:mb-8">
              <span className="line">
                <span className="flex items-center gap-3">
                  <span aria-hidden className="h-1.5 w-1.5 bg-mars" />
                  Mission 001 — Destination: Mars
                </span>
              </span>
            </p>
            <h1 className="display text-[clamp(2.9rem,8.6vw,8.9rem)] text-star">
              <span className="line">
                <span>What if Mars</span>
              </span>
              <span className="line md:pl-[1.1em]">
                <span style={{ transitionDelay: '90ms' }}>
                  was <span className="text-mars">yours</span>
                </span>
              </span>
              <span className="line">
                <span style={{ transitionDelay: '180ms' }}>to build?</span>
              </span>
            </h1>
            <div
              className={`mt-8 grid items-end gap-6 border-t border-star/15 pt-6 transition-opacity delay-300 duration-1000 sm:mt-10 md:grid-cols-12 md:gap-8 ${
                stage >= 3 ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <p className="max-w-[40ch] text-base leading-relaxed text-star/80 sm:text-lg md:col-span-5 lg:col-span-4">
                It's a whole new planet. You've got a colony to build, resources to manage, and a future to shape.
              </p>
              <div className="flex flex-wrap items-center gap-x-8 gap-y-4 md:col-span-7 lg:col-span-5">
                <Cta href="#mission">Start your mission</Cta>
                <a href="#challenge" className="label group flex items-center gap-2 py-2 text-star/85 transition-colors hover:text-star">
                  Explore RENOVA
                  <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3 transition-transform group-hover:translate-y-0.5" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M6 1v9M2 6l4 4 4-4" />
                  </svg>
                </a>
              </div>
              <p className="label text-star/65 md:col-span-12 lg:col-span-3 lg:text-right">
                Status: <span className="text-star">Awaiting command</span>
                <span aria-hidden className="blink ml-1.5 inline-block h-2.5 w-1.5 translate-y-px bg-mars" />
              </p>
            </div>
          </div>
        </div>

        {/* opening title card + letterbox */}
        <p
          aria-hidden
          className={`label pointer-events-none absolute inset-0 z-20 flex items-center justify-center text-star transition-all duration-[1400ms] ease-expo ${
            stage === 1 ? 'tracking-[0.42em] opacity-100' : stage === 0 ? 'tracking-[0.8em] opacity-0' : 'tracking-[0.42em] opacity-0'
          }`}
        >
          Mission 001 — Destination: Mars
        </p>
        <div aria-hidden className={`absolute inset-x-0 top-0 z-20 h-[12vh] bg-black transition-transform duration-[1600ms] ease-expo ${stage >= 2 ? '-translate-y-full' : ''}`} />
        <div aria-hidden className={`absolute inset-x-0 bottom-0 z-20 h-[12vh] bg-black transition-transform duration-[1600ms] ease-expo ${stage >= 2 ? 'translate-y-full' : ''}`} />
        <div ref={shade} aria-hidden className="pointer-events-none absolute inset-0 z-30 bg-navy opacity-0" />
      </section>
    </div>
  )
}
