'use client'

import { useEffect, useState } from 'react'
import { Chapter } from '../components/ui'
import { useInView, useReducedMotion, useReveal } from '../lib/hooks'

type Sys = 'food' | 'energy' | 'water' | 'radiation'

const SYSTEMS: { id: Sys; n: string; name: string; tag: string; q: string; stat: [string, string]; needs: string }[] = [
  {
    id: 'food',
    n: '01',
    name: 'Food production',
    tag: 'Grow your food.',
    q: 'Can you grow enough to feed your colony?',
    stat: ['2,500 kcal', 'per colonist, every sol'],
    needs: 'Runs on water + energy',
  },
  {
    id: 'energy',
    n: '02',
    name: 'Energy',
    tag: 'Power your colony.',
    q: 'Keep your systems running, day and night.',
    stat: ['43%', 'of Earth’s sunlight reaches Mars'],
    needs: 'Powers every other system',
  },
  {
    id: 'water',
    n: '03',
    name: 'Water',
    tag: 'Every drop counts.',
    q: 'Make the most of every drop on Mars.',
    stat: ['98%', 'of used water can be recovered'],
    needs: 'Feeds the crew + the crops',
  },
  {
    id: 'radiation',
    n: '04',
    name: 'Radiation',
    tag: 'Keep everyone safe.',
    q: 'Protect your colony from Mars’ harsh environment.',
    stat: ['~2 m', 'of regolith overhead shields a habitat'],
    needs: 'Protects the crew + the crops',
  },
]

// Resource flows in the schematic, and which systems they belong to.
const FLOWS: { d: string; sys: Sys[] }[] = [
  { d: 'M154 96 H300 V246', sys: ['energy'] },
  { d: 'M97 132 V366 H178', sys: ['energy', 'food'] },
  { d: 'M154 72 H500 V96 H516', sys: ['energy'] },
  { d: 'M154 84 H404 V338', sys: ['energy'] },
  { d: 'M540 120 V358 H420', sys: ['water'] },
  { d: 'M372 338 V290 H344', sys: ['water'] },
  { d: 'M388 378 V420 H224 V392', sys: ['water', 'food'] },
  { d: 'M224 340 V290 H256', sys: ['food'] },
  { d: 'M300 334 V366 H270', sys: ['food'] },
]

const RAYS = [-72, -58, -44, -30, -16].map((a) => {
  const r = (a * Math.PI) / 180
  return { x1: 300 + Math.cos(r) * 260, y1: 290 + Math.sin(r) * 260, x2: 300 + Math.cos(r) * 154, y2: 290 + Math.sin(r) * 154 }
})

export function Systems() {
  const ref = useReveal<HTMLElement>()
  const [active, setActive] = useState<Sys>('food')
  const [touched, setTouched] = useState(false)
  const [plateRef, inView] = useInView<HTMLDivElement>('-20% 0px')
  const reduced = useReducedMotion()

  // Walk through the four systems until the visitor takes over.
  useEffect(() => {
    if (touched || !inView || reduced) return
    const id = setInterval(() => setActive((a) => SYSTEMS[(SYSTEMS.findIndex((s) => s.id === a) + 1) % 4].id), 4200)
    return () => clearInterval(id)
  }, [touched, inView, reduced])

  const choose = (s: Sys) => {
    setTouched(true)
    setActive(s)
  }
  const on = (s: Sys[] | Sys) => (Array.isArray(s) ? s.includes(active) : s === active)
  const mod = (s: Sys) => (on(s) ? 'fill-mars/15 stroke-mars' : 'fill-transparent stroke-navy/55')

  return (
    <section ref={ref} id="systems" data-chapter="03" data-title="You’re in charge" className="relative z-10 bg-sand text-navy">
      <div className="mx-auto max-w-[1440px] px-6 pb-24 pt-24 sm:px-10 lg:px-16 lg:pb-32 lg:pt-32">
        <header className="rv flex items-baseline justify-between border-b border-navy/20 pb-5">
          <Chapter n="03" title="You’re in charge" />
          <p className="label hidden text-navy/75 sm:block">Four systems · One colony</p>
        </header>

        <div className="mt-12 grid gap-8 lg:mt-16 lg:grid-cols-12">
          <h2 className="rv display text-[clamp(2.6rem,7vw,7.25rem)] lg:col-span-8">
            Big planet.
            <br />
            Big decisions.
          </h2>
          <p className="rv max-w-[30ch] self-end text-lg leading-relaxed text-navy/75 lg:col-span-4 lg:pb-3">
            Running a Mars colony isn’t easy. But that’s where you come in.
          </p>
        </div>

        <div className="mt-16 grid gap-12 lg:mt-24 lg:grid-cols-12 lg:gap-10">
          {/* System index */}
          <div className="rv lg:col-span-5" role="tablist" aria-label="Colony systems" aria-orientation="vertical">
            {SYSTEMS.map((s) => {
              const sel = s.id === active
              return (
                <div key={s.id} className="border-t border-navy/20 last:border-b">
                  <button
                    type="button"
                    role="tab"
                    id={`tab-${s.id}`}
                    aria-selected={sel}
                    aria-controls="systems-panel"
                    onClick={() => choose(s.id)}
                    onMouseEnter={() => choose(s.id)}
                    onFocus={() => choose(s.id)}
                    className="group grid w-full grid-cols-[3rem_1fr_auto] items-baseline gap-2 py-5 text-left sm:py-6"
                  >
                    <span className={`label transition-colors ${sel ? 'text-navy' : 'text-navy/60'}`}>{s.n}</span>
                    <span>
                      <span className={`block font-display text-[clamp(1.6rem,2.6vw,2.4rem)] font-medium leading-none tracking-[-0.03em] transition-colors ${sel ? 'text-navy' : 'text-navy/60 group-hover:text-navy/75'}`}>
                        {s.name}
                      </span>
                      <span className={`mt-2 block text-sm transition-colors ${sel ? 'text-navy/80' : 'text-navy/65'}`}>{s.tag}</span>
                    </span>
                    <span aria-hidden className={`h-2 w-2 transition-all duration-500 ${sel ? 'bg-mars' : 'bg-navy/15'}`} />
                  </button>
                </div>
              )
            })}

            <div id="systems-panel" role="tabpanel" aria-labelledby={`tab-${active}`} aria-live="polite" className="mt-10 min-h-[9.5rem]">
              {SYSTEMS.filter((s) => s.id === active).map((s) => (
                <div key={s.id} className="rise">
                  <p className="display text-[1.75rem] leading-tight tracking-[-0.03em]">{s.q}</p>
                  <div className="mt-5 flex items-baseline gap-4 text-sm text-navy/70">
                    <span className="font-display text-2xl font-medium text-navy">{s.stat[0]}</span>
                    <span>{s.stat[1]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Colony schematic */}
          <figure ref={plateRef} className="rv lg:col-span-7">
            <svg viewBox="0 0 640 520" className="h-auto w-full" role="img" aria-label="Schematic of the colony: power, water and food flow between modules inside a radiation berm">
              <rect x="0.5" y="0.5" width="639" height="519" fill="none" className="stroke-navy/35" />
              {[80, 160, 240, 320, 400, 480, 560].map((x, n) => (
                <g key={x} className="fill-navy/45 stroke-navy/35">
                  <line x1={x} y1="0" x2={x} y2="6" />
                  <text x={x - 40} y="15" fontSize="8" textAnchor="middle" stroke="none" className="font-sans">
                    {String.fromCharCode(65 + n)}
                  </text>
                </g>
              ))}
              {[104, 208, 312, 416].map((y, n) => (
                <g key={y} className="fill-navy/45 stroke-navy/35">
                  <line x1="0" y1={y} x2="6" y2={y} />
                  <text x="11" y={y - 48} fontSize="8" stroke="none" className="font-sans">
                    {n + 1}
                  </text>
                </g>
              ))}

              {/* radiation: particles stopped by the berm */}
              <g className={on('radiation') ? 'stroke-mars' : 'stroke-navy/25'} strokeWidth="1.2">
                {RAYS.map((r, n) => (
                  <line
                    key={n}
                    x1={r.x1}
                    y1={r.y1}
                    x2={r.x2}
                    y2={r.y2}
                    strokeDasharray="2 8"
                    style={on('radiation') && !reduced ? { animation: `flow ${0.9 + n * 0.12}s linear infinite reverse` } : undefined}
                  />
                ))}
              </g>
              <circle cx="300" cy="290" r="150" fill="none" strokeDasharray="3 5" strokeWidth={on('radiation') ? 2.2 : 1} className={on('radiation') ? 'stroke-mars' : 'stroke-navy/50'} />
              <text x="300" y="130" fontSize="9" textAnchor="middle" letterSpacing="1.5" className={`font-sans font-semibold ${on('radiation') ? 'fill-rust' : 'fill-navy/60'}`}>
                BERM · 2 M REGOLITH
              </text>

              {/* flows */}
              {FLOWS.map((f, n) => {
                const lit = on(f.sys)
                return (
                  <path
                    key={n}
                    d={f.d}
                    fill="none"
                    strokeWidth={lit ? 1.8 : 1}
                    strokeDasharray={lit ? '6 4' : undefined}
                    className={`transition-[stroke] duration-500 ${lit ? 'stroke-mars' : 'stroke-navy/30'}`}
                    style={lit && !reduced ? { animation: 'flow 1s linear infinite' } : undefined}
                  />
                )
              })}

              {/* modules */}
              <g strokeWidth="1.2" className="transition-all duration-500">
                {[0, 1, 2].flatMap((r) =>
                  [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={40 + c * 40} y={60 + r * 26} width="34" height="20" className={mod('energy')} />),
                )}
                {[0, 1, 2].map((r) => (
                  <line key={r} x1={40} y1={70 + r * 26} x2={154} y2={70 + r * 26} className={on('energy') ? 'stroke-mars/50' : 'stroke-navy/20'} />
                ))}
                <circle cx="540" cy="96" r="24" className={mod('water')} />
                <path d="M540 80 V112 M524 96 H556" className={on('water') ? 'stroke-mars' : 'stroke-navy/40'} />
                <rect x="356" y="338" width="64" height="40" className={mod('water')} />
                <circle cx="388" cy="358" r="10" className={mod('water')} />
                <rect x="178" y="340" width="92" height="52" className={mod('food')} />
                {[352, 364, 376].map((y) => (
                  <line key={y} x1="186" y1={y} x2="262" y2={y} strokeDasharray="2 3" className={on('food') ? 'stroke-mars' : 'stroke-navy/35'} />
                ))}
                <circle cx="300" cy="290" r="44" className={on(['food', 'radiation']) ? 'fill-mars/10 stroke-navy/70' : 'fill-transparent stroke-navy/70'} />
                <circle cx="300" cy="290" r="16" strokeDasharray="2 3" className={on('radiation') ? 'fill-mars/25 stroke-mars' : 'fill-transparent stroke-navy/50'} />
              </g>

              {/* labels */}
              <g fontSize="9" letterSpacing="1.2" className="fill-navy/75 font-sans font-semibold">
                <text x="40" y="150">PV ARRAY · 120 KW</text>
                <text x="488" y="60">ICE-01 · EXTRACTOR</text>
                <text x="352" y="248">HAB-01 · CREW OF 12</text>
                <text x="178" y="408">GH-01 · GREENHOUSE</text>
                <text x="430" y="352">WRS · WATER</text>
                <text x="430" y="364">RECOVERY</text>
                <text x="282" y="294" fontSize="7" className="fill-navy/60">CORE</text>
              </g>
              <path d="M346 250 L330 262" className="stroke-navy/40" />

              {/* title block */}
              <g className="font-sans">
                <rect x="452" y="462" width="180" height="50" fill="none" className="stroke-navy/40" />
                <line x1="452" y1="487" x2="632" y2="487" className="stroke-navy/30" />
                <text x="460" y="479" fontSize="9" letterSpacing="1.4" className="fill-navy font-semibold">
                  RENOVA · COLONY 001
                </text>
                <text x="460" y="503" fontSize="8" letterSpacing="1.2" className="fill-navy/60">
                  DWG 03 — SYSTEMS · 1:500
                </text>
              </g>
              <g className="stroke-navy/50 fill-navy/50 font-sans" transform="translate(604 34)">
                <path d="M0 10 L0 -10 M-4 -4 L0 -10 L4 -4" fill="none" />
                <text x="-3" y="22" fontSize="8" stroke="none">
                  N
                </text>
              </g>
            </svg>
            <figcaption className="mt-6 grid gap-4 border-t border-navy/20 pt-5 text-sm text-navy/70 sm:grid-cols-[auto_1fr] sm:gap-8">
              <span className="label text-navy">{SYSTEMS.find((s) => s.id === active)!.needs}</span>
              <span>Every system depends on another. Cut the power and the water stops. Lose the water and the crops fail.</span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  )
}
