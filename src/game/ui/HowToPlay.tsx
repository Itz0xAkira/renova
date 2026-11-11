'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { groundURL, itemURL, thumbURL } from '@/game/art/sprites'
import { BUILDINGS, ITEMS, NEEDS, SHIELD_REACH, type ItemId, type Kind } from '@/game/core/data'
import { MISSIONS } from '@/game/core/missions'

/**
 * Illustrated, paged guide to RENOVA. Used on first launch, from the in-game
 * HUD and menu, and from the website's title screen.
 */

type Art = { kinds: Record<string, string>; items: Record<ItemId, string>; ground: Record<'ice' | 'ore' | 'sand', string> }

const KINDS: Kind[] = ['core', 'belt', 'drill', 'excavator', 'melter', 'smelter', 'kiln', 'washer', 'greenhouse', 'moxie', 'habitat', 'shield', 'solar', 'battery', 'lab']

function Sprite({ src, label, size = 'md' }: { src: string; label?: string; size?: 'sm' | 'md' }) {
  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label ?? ''} className={`pixelated ${size === 'sm' ? 'h-7 w-7' : 'h-12 w-10'}`} />
      {label && <span className="text-[8px] leading-none text-star/70">{label}</span>}
    </span>
  )
}

const Arrow = () => (
  <span aria-hidden className="px-0.5 text-mars">
    →
  </span>
)

function Chain({ art, steps }: { art: Art; steps: ({ item: ItemId } | { kind: Kind } | { ground: 'ice' | 'ore' | 'sand' })[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-2 border-star/10 bg-star/[0.03] px-2 py-1.5">
      {steps.map((s, k) => (
        <span key={k} className="inline-flex items-center gap-1">
          {k > 0 && <Arrow />}
          {'item' in s ? (
            <Sprite src={art.items[s.item]} label={ITEMS[s.item].name} size="sm" />
          ) : 'kind' in s ? (
            <Sprite src={art.kinds[s.kind]} label={BUILDINGS[s.kind].short} />
          ) : (
            <Sprite src={art.ground[s.ground]} label={s.ground === 'ice' ? 'Ice ground' : s.ground === 'ore' ? 'Ore ground' : 'Sand'} size="sm" />
          )}
        </span>
      ))}
    </div>
  )
}

const P = ({ children }: { children: ReactNode }) => <p className="font-sans text-[13px] normal-case leading-relaxed text-star/85">{children}</p>
const B = ({ children, className = 'text-star' }: { children: ReactNode; className?: string }) => <b className={`font-semibold ${className}`}>{children}</b>

function pages(art: Art): { title: string; kicker: string; body: ReactNode }[] {
  return [
    {
      title: 'Your mission',
      kicker: 'Mars is 225 million km from home',
      body: (
        <>
          <div className="flex items-end justify-center gap-4 py-2">
            <Sprite src={art.kinds.core} label="Colony core" />
            <Sprite src={art.kinds.habitat} label="Habitat" />
            <Sprite src={art.kinds.greenhouse} label="Greenhouse" />
            <Sprite src={art.kinds.solar} label="Solar" />
          </div>
          <P>
            You land with <B>4 crew</B>, a little food, water and air — and no deliveries for months. Build a factory that turns Mars itself into everything the colony needs.
          </P>
          <P>
            Follow the <B>mission log</B> on the left of the screen. Finish all {MISSIONS.length} missions and grow the colony to <B>20 colonists</B> to win.
          </P>
        </>
      ),
    },
    {
      title: '1 · Mine',
      kicker: 'Everything starts in the ground',
      body: (
        <>
          <Chain art={art} steps={[{ ground: 'ice' }, { kind: 'drill' }, { item: 'ice' }]} />
          <Chain art={art} steps={[{ ground: 'ore' }, { kind: 'excavator' }, { item: 'ore' }]} />
          <Chain art={art} steps={[{ ground: 'sand' }, { kind: 'excavator' }, { item: 'regolith' }]} />
          <P>
            <B>Ice drills</B> only work on pale blue ice. <B>Excavators</B> dig hematite ore from dark red ground, or regolith (dust and rock) from plain sand. Grey boulders and craters can’t be built on.
          </P>
        </>
      ),
    },
    {
      title: '2 · Move it',
      kicker: 'Conveyor belts are your factory’s veins',
      body: (
        <>
          <Chain art={art} steps={[{ kind: 'drill' }, { kind: 'belt' }, { kind: 'belt' }, { kind: 'melter' }, { kind: 'belt' }, { kind: 'core' }]} />
          <P>
            Buildings are big: from <B>2×2</B> up to <B>4×3 tiles</B> (belts, junctions and pylons take one) — the outline under your cursor shows the footprint. Every miner and machine has an <B>orange arrow</B>: it pushes what it makes onto the tile the arrow points at. Press <B>R</B> to rotate before you build.
          </P>
          <P>
            Pick the belt (key <B>1</B>) and <B>drag</B> to lay a line — it follows your mouse. Belts feed straight into machines. Anything that reaches the <B>colony core</B> goes into your stores, and stores pay for new buildings.
          </P>
          <P>
            Machines with two ingredients (washer, greenhouse) take them from <B>any side</B>. Give each ingredient its own belt so one can’t block the other.
          </P>
        </>
      ),
    },
    {
      title: '3 · Make it',
      kicker: 'Production chains',
      body: (
        <>
          <Chain art={art} steps={[{ item: 'ice' }, { kind: 'melter' }, { item: 'water' }]} />
          <Chain art={art} steps={[{ item: 'ore' }, { kind: 'smelter' }, { item: 'metal' }]} />
          <Chain art={art} steps={[{ item: 'regolith' }, { kind: 'kiln' }, { item: 'brick' }]} />
          <Chain art={art} steps={[{ item: 'regolith' }, { item: 'water' }, { kind: 'washer' }, { item: 'soil' }]} />
          <Chain art={art} steps={[{ item: 'soil' }, { item: 'water' }, { kind: 'greenhouse' }, { item: 'food' }]} />
          <P>
            <B>Metal</B> and <B>bricks</B> pay for buildings. Martian soil contains toxic perchlorate, so it has to be <B>washed</B> before a greenhouse can use it. <B>Research</B> (key T) makes machines faster — build a lab to speed it up.
          </P>
        </>
      ),
    },
    {
      title: '4 · Keep the crew alive',
      kicker: 'Every system depends on another',
      body: (
        <>
          <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
            {(
              [
                ['food', 'Food'],
                ['water', 'Water'],
                ['o2', 'Oxygen'],
              ] as const
            ).map(([k, n]) => (
              <div key={k} className="border-2 border-star/10 py-2">
                <p className="text-lg text-mars">{NEEDS[k]}</p>
                <p className="text-star/70">{n} / colonist / sol</p>
              </div>
            ))}
          </div>
          <div className="flex items-end justify-center gap-4">
            <Sprite src={art.kinds.moxie} label="MOXIE · O₂" />
            <Sprite src={art.kinds.habitat} label="Habitat · 4 crew" />
            <Sprite src={art.kinds.shield} label="Shield" />
          </div>
          <P>
            Watch the numbers at the top: each shows your stock and how fast it’s rising or falling per sol. If anything runs out, <B>colony health</B> drops — at 0% the mission fails. Build a <B>MOXIE</B> to make oxygen from the CO₂ air.
          </P>
          <P>
            A <B>supply ship</B> lands every 1.5 sols. It brings new crew only if there’s free housing and nothing is running out. Every <B>habitat</B> needs a <B>regolith shield</B> within {SHIELD_REACH[0]} tiles, or its crew soak up radiation.
          </P>
        </>
      ),
    },
    {
      title: '5 · Power and hazards',
      kicker: 'Mars gets 43% of Earth’s sunlight',
      body: (
        <>
          <div className="flex items-end justify-center gap-4">
            <Sprite src={art.kinds.solar} label="Solar · 20 kW" />
            <Sprite src={art.kinds.battery} label="Battery" />
          </div>
          <P>
            Power travels by <B>grid</B>: only buildings inside the core’s or a <B>pylon’s</B> square are connected, and pylons link by cable (press <B>P</B> to see it). Solar only works by day, so store the surplus in <B>batteries</B>. When power runs short, <B>life support comes first</B> and the factories slow down. Upgrade buildings with <B>U</B> — a solar station even plants its own panels.
          </P>
          <P>
            <B className="text-[#e0a072]">Dust storms</B> cut solar output for half a sol. <B className="text-[#ff7a6e]">Solar flares</B> blast unshielded habitats with radiation. You get a warning before each one — check the log.
          </P>
        </>
      ),
    },
    {
      title: 'Controls',
      kicker: 'Mouse, keyboard or touch',
      body: (
        <dl className="grid gap-1 text-[10px]">
          {(
            [
              ['Click', 'Build the selected module, or select a building to inspect'],
              ['Drag', 'Lay belts in a line · pan the map when nothing is selected'],
              ['Right-click', 'Remove a building — full refund. Drag to remove many'],
              ['R · Shift+R', 'Rotate the build direction (or the building under the cursor)'],
              ['Q', 'Copy the building under the cursor'],
              ['U', 'Upgrade the selected building (up to level 3)'],
              ['P', 'Power view: grid coverage and unconnected buildings'],
              ['1 – 0', 'Quick-select belt, drill, excavator, melter, smelter, kiln, solar, habitat, shield, MOXIE'],
              ['WASD · arrows', 'Pan · mouse wheel or + / − to zoom · C jumps to the core'],
              ['Space', 'Pause · 1× 2× 3× buttons change speed'],
              ['T · H · Esc', 'Research · this guide · menu / cancel'],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex gap-3 border-b border-star/10 pb-1">
              <dt className="w-24 shrink-0 text-mars">{k}</dt>
              <dd className="font-sans text-[12px] normal-case text-star/85">{v}</dd>
            </div>
          ))}
        </dl>
      ),
    },
  ]
}

export function HowToPlay({ onClose, doneLabel = 'Got it', closeable = true }: { onClose: () => void; doneLabel?: string; closeable?: boolean }) {
  const art = useMemo<Art>(
    () => ({
      kinds: Object.fromEntries(KINDS.map((k) => [k, thumbURL(k)])),
      items: Object.fromEntries((Object.keys(ITEMS) as ItemId[]).map((k) => [k, itemURL(k)])) as Record<ItemId, string>,
      ground: { ice: groundURL('ice'), ore: groundURL('ore'), sand: groundURL('sand') },
    }),
    [],
  )
  const list = useMemo(() => pages(art), [art])
  const [n, setN] = useState(0)
  const last = n === list.length - 1
  const page = list[n]

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setN((x) => Math.min(list.length - 1, x + 1))
      else if (e.key === 'ArrowLeft') setN((x) => Math.max(0, x - 1))
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  }, [list.length])

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-[#0c1220]/75 p-3 font-pixel uppercase text-star sm:p-6" onClick={closeable ? onClose : undefined}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How to play"
        onClick={(e) => e.stopPropagation()}
        className="rise flex max-h-full w-full max-w-xl flex-col border-2 border-mars bg-[#0c1220] shadow-[6px_6px_0_#b75c42]"
      >
        <div className="flex items-center justify-between gap-3 border-b-2 border-star/10 px-4 py-2.5 text-[10px]">
          <span className="text-star/60">
            How to play · {n + 1}/{list.length}
          </span>
          {closeable && (
            <button type="button" onClick={onClose} className="text-star/60 hover:text-mars" aria-label="Close guide">
              ✕
            </button>
          )}
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
          <div>
            <p className="text-[10px] text-sand/70">{page.kicker}</p>
            <h2 className="mt-1 font-pixel text-lg text-mars sm:text-xl">{page.title}</h2>
          </div>
          {page.body}
        </div>
        <div className="flex items-center justify-between gap-2 border-t-2 border-star/10 px-4 py-3 text-[11px]">
          <button type="button" onClick={() => setN(n - 1)} disabled={n === 0} className="border-2 border-star/30 px-3 py-2 transition-colors hover:border-mars hover:text-mars disabled:invisible">
            ◀ Back
          </button>
          <div className="flex gap-1.5" aria-hidden>
            {list.map((_, k) => (
              <button key={k} type="button" tabIndex={-1} onClick={() => setN(k)} className={`h-2 w-2 ${k === n ? 'bg-mars' : 'bg-star/25 hover:bg-star/50'}`} />
            ))}
          </div>
          <button
            type="button"
            autoFocus
            onClick={() => (last ? onClose() : setN(n + 1))}
            className="border-2 border-mars bg-mars px-3 py-2 text-navy transition-colors hover:border-star hover:bg-star"
          >
            {last ? doneLabel : 'Next ▶'}
          </button>
        </div>
      </div>
    </div>
  )
}
