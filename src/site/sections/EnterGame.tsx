'use client'

import { useEffect, useRef, useState } from 'react'
import { Chapter, Cta } from '../components/ui'
import { PixelCanvas } from '../pixel/PixelCanvas'
import { WORLD } from '../pixel/scenes'
import { clamp, range, useReducedMotion, useScrollFrame } from '../lib/hooks'
import { photo } from '../lib/media'

// The game palette the photograph collapses into before the world rebuilds itself.
const PALETTE = [
  '#101827', '#1b2636', '#302b4b', '#45314f', '#5f3a4f', '#5b2b25', '#7b3b2c', '#86453f',
  '#a0544d', '#b75c42', '#c5845b', '#e0a072', '#ecb486', '#d9b99a', '#f4f0e8', '#e8753b',
].map((h) => {
  const n = parseInt(h.slice(1), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
})

function quantize(d: Uint8ClampedArray, amount: number) {
  for (let o = 0; o < d.length; o += 4) {
    let best = 0
    let bd = Infinity
    for (let k = 0; k < PALETTE.length; k++) {
      const c = PALETTE[k]
      const dist = (d[o] - c[0]) ** 2 * 0.3 + (d[o + 1] - c[1]) ** 2 * 0.59 + (d[o + 2] - c[2]) ** 2 * 0.11
      if (dist < bd) {
        bd = dist
        best = k
      }
    }
    const c = PALETTE[best]
    d[o] += (c[0] - d[o]) * amount
    d[o + 1] += (c[1] - d[o + 1]) * amount
    d[o + 2] += (c[2] - d[o + 2]) * amount
  }
}

const READOUT = ['Orbital feed · 4032 × 2268 px', 'Rendering RENOVA', 'World loaded · Colony 001 · Sol 1']

export function EnterGame({ onEnter }: { onEnter: () => void }) {
  const reduced = useReducedMotion()
  const track = useRef<HTMLDivElement>(null)
  const photoCv = useRef<HTMLCanvasElement>(null)
  const img = useRef<HTMLImageElement | null>(null)
  const small = useRef<HTMLCanvasElement | null>(null)
  const quantOk = useRef(true)
  const progress = useRef(0)
  const reveal = useRef(reduced ? 1 : 0)
  const readout = useRef<HTMLSpanElement>(null)
  const bar = useRef<HTMLSpanElement>(null)
  const [phase, setPhase] = useState(reduced ? 2 : 0)

  const drawPhoto = () => {
    const cv = photoCv.current
    const im = img.current
    if (!cv || !im) return 0
    const p = progress.current
    const r = cv.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const W = Math.round(r.width * dpr)
    const H = Math.round(r.height * dpr)
    if (!W || !H) return 0
    if (cv.width !== W || cv.height !== H) {
      cv.width = W
      cv.height = H
    }
    const ctx = cv.getContext('2d')!
    // keep a little extra scale so the photo's strip of (blue, Earth) sky stays cropped out
    const zoom = 1.24 - 0.1 * range(p, 0, 0.5)
    const s = Math.max(W / im.naturalWidth, H / im.naturalHeight) * zoom
    const dw = im.naturalWidth * s
    const dh = im.naturalHeight * s
    const dx = (W - dw) / 2
    const dy = (H - dh) * 0.92
    const k = range(p, 0.1, 0.48)
    const block = Math.max(1, Math.round(Math.pow(2, k * Math.log2(W / 46))))
    if (block <= 1) {
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(im, dx, dy, dw, dh)
      return block
    }
    const sw = Math.ceil(W / block)
    const sh = Math.ceil(H / block)
    const sm = small.current ?? (small.current = document.createElement('canvas'))
    if (sm.width !== sw || sm.height !== sh) {
      sm.width = sw
      sm.height = sh
    }
    const sc = sm.getContext('2d', { willReadFrequently: true })!
    sc.imageSmoothingEnabled = true
    sc.drawImage(im, dx / block, dy / block, dw / block, dh / block)
    const q = range(p, 0.2, 0.46)
    if (q > 0 && quantOk.current) {
      try {
        const data = sc.getImageData(0, 0, sw, sh)
        quantize(data.data, q)
        sc.putImageData(data, 0, 0)
      } catch {
        quantOk.current = false // cross-origin pixels unavailable: keep the plain mosaic
      }
    }
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(sm, 0, 0, sw * block, sh * block)
    return block
  }

  const update = () => {
    const el = track.current
    const cv = photoCv.current
    if (!el || !cv) return
    const r = el.getBoundingClientRect()
    const vh = window.innerHeight
    if (r.bottom < -vh || r.top > vh * 1.5) return
    const p = reduced ? 1 : clamp(-r.top / Math.max(1, r.height - vh))
    progress.current = p
    reveal.current = reduced ? 1 : range(p, 0.42, 0.86)
    const block = drawPhoto()
    cv.style.opacity = String(1 - range(p, 0.5, 0.76))
    const ph = p < 0.28 ? 0 : p < 0.76 ? 1 : 2
    setPhase(ph)
    if (readout.current) {
      readout.current.textContent =
        ph === 1 && block > 1 ? `${READOUT[1]} · ${Math.ceil(cv.width / block)} × ${Math.ceil(cv.height / block)} px` : READOUT[ph]
    }
    if (bar.current) bar.current.style.transform = `scaleX(${p.toFixed(3)})`
  }

  useEffect(() => {
    const im = new Image()
    im.crossOrigin = 'anonymous'
    im.decoding = 'async'
    im.src = photo('mesa', 1800)
    im.onload = () => {
      img.current = im
      update()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useScrollFrame(update)

  const built = phase === 2

  return (
    <section id="game" data-chapter="05" data-title="Enter the game" aria-labelledby="game-title" className="relative z-10 bg-navy text-star">
      <div ref={track} className={reduced ? 'relative h-[100svh]' : 'relative h-[330svh]'}>
        <div className="sticky top-0 h-[100svh] overflow-hidden bg-[#0c1220]">
          <PixelCanvas
            scene={WORLD}
            revealRef={reveal}
            label="RENOVA’s pixel-art world: a colony of domes, greenhouses and solar arrays on a Martian mesa"
            anchor={(W, H) => (W / H > 1.15 ? [0.66, 0.6] : [0.5, 0.77])}
            className="absolute inset-0"
          />
          <canvas ref={photoCv} aria-hidden className="absolute inset-0 h-full w-full" />
          <div aria-hidden className="absolute inset-0 hidden bg-gradient-to-r from-[#0c1220]/85 via-[#0c1220]/35 to-transparent md:block" />
          <div aria-hidden className="absolute inset-x-0 top-0 h-3/5 bg-gradient-to-b from-[#0c1220]/90 via-[#0c1220]/50 to-transparent md:hidden" />

          <div className="relative z-10 mx-auto flex h-full max-w-[1440px] flex-col gap-8 px-6 pb-[calc(6.25vw+1.25rem)] pt-24 sm:px-10 md:justify-between md:gap-0 lg:px-16 lg:pt-28">
            <Chapter n="05" title="Enter the game" className="text-star/80" />
            <div className="max-w-[44rem] md:mb-[8vh]">
              <h2 id="game-title" className="display text-[clamp(2.4rem,5.4vw,5.6rem)]">
                <span className="block">Enough planning.</span>
                <span className={`line ${built ? 'in' : ''}`}>
                  <span className="text-mars">Time to build.</span>
                </span>
              </h2>
              <div className={`transition-all duration-700 ease-expo ${built ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'}`}>
                <p className="mt-6 max-w-[36ch] text-lg leading-relaxed text-star/80">
                  Your mission is waiting. Take control, make your decisions, and see what you can create.
                </p>
                <div className="mt-8">
                  <Cta onClick={onEnter} className={built ? '' : 'invisible'}>
                    Enter the game
                  </Cta>
                </div>
              </div>
            </div>
            <div className="mt-auto flex items-end justify-between gap-6 md:mt-0">
              <p className="label text-star/65">
                <span ref={readout}>{READOUT[phase]}</span>
              </p>
              <span aria-hidden className="relative hidden h-px w-40 bg-star/20 sm:block">
                <span ref={bar} className="absolute inset-0 origin-left scale-x-0 bg-mars" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
