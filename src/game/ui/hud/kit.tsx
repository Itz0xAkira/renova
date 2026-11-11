'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { iconURL, type IconName } from '@/game/art/icons'
import { ITEMS, type BuildingDef, type ItemId } from '@/game/core/data'
import type { Status } from '@/game/core/sim'

/** Shared HUD building blocks: design tokens (gunmetal panels with rust and cyan accents, matching the buildings), formatting, and small components. */

export const panel = 'border border-[#3F4246] bg-[#1F2022]/95 shadow-[inset_0_1px_0_#5A5D60,0_3px_0_rgba(0,0,0,0.45)]'

export const btn =
  'flex items-center gap-1.5 border border-[#3F4246] bg-[#2E3033] px-2 py-1.5 uppercase text-[#D9D9D9] shadow-[inset_0_1px_0_#5A5D60] transition-colors hover:border-[#C8754D] hover:text-white active:translate-y-px disabled:opacity-40'

export const btnOn = 'border-[#C8754D] bg-[#A95738]/35 text-white'

export const TONE = { label: 'text-[#8A8A8A]', good: 'text-[#A8B87A]', bad: 'text-[#D86B7B]', warn: 'text-[#F4D03F]', cyan: 'text-[#65C9E8]' }

export const fmt = (n: number) => (Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : Math.floor(n).toString())

/** A rate with an arrow; anything that rounds to zero reads as ±0, not ▲0. */
export const signed = (n: number) => (Math.round(Math.abs(n)) === 0 ? '±0' : `${n > 0 ? '▲' : '▼'}${Math.abs(n).toFixed(0)}`)

export const STATUS: Record<Status, [string, string]> = {
  ok: ['Running', 'bg-[#7BA750]'],
  idle: ['Idle', 'bg-[#5F5F5F]'],
  nopower: ['No power', 'bg-[#F4D03F]'],
  nogrid: ['Not connected — build a pylon', 'bg-[#D86B7B]'],
  noinput: ['Waiting for input', 'bg-[#8A8A8A]'],
  blocked: ['Output blocked', 'bg-[#D86B7B]'],
  unshielded: ['Unshielded — radiation!', 'bg-[#F4D03F]'],
  badground: ['Wrong ground', 'bg-[#D86B7B]'],
}

export const CATEGORY: { id: BuildingDef['group']; name: string; icon: IconName }[] = [
  { id: 'logistics', name: 'Logistics', icon: 'logistics' },
  { id: 'extract', name: 'Mining', icon: 'extract' },
  { id: 'process', name: 'Processing', icon: 'process' },
  { id: 'life', name: 'Life support', icon: 'life' },
  { id: 'power', name: 'Power', icon: 'power' },
  { id: 'science', name: 'Science', icon: 'science' },
]

export function Icon({ name, size = 18, className = '' }: { name: IconName; size?: number; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={iconURL(name)} alt="" width={size} height={size} className={`pixelated inline-block shrink-0 ${className}`} style={{ width: size, height: size }} />
}

export function Bar({ value, color, className = '' }: { value: number; color: string; className?: string }) {
  return (
    <span className={`block h-1.5 border border-[#151618] bg-[#151618] ${className}`}>
      <span className="block h-full" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)' }} />
    </span>
  )
}

/** Item counts as icons: 2 [ore] + 1 [water]. */
export function Items({ list }: { list: Partial<Record<ItemId, number>> }) {
  const entries = Object.entries(list).filter(([, n]) => (n ?? 0) > 0) as [ItemId, number][]
  if (!entries.length) return <span className={TONE.label}>—</span>
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {entries.map(([k, n], i) => (
        <span key={k} className="inline-flex items-center gap-0.5" title={ITEMS[k].name}>
          {i > 0 && <span className={TONE.label}>+</span>}
          <span>{n}</span>
          <Icon name={k} size={14} />
        </span>
      ))}
    </span>
  )
}

export function Recipe({ def }: { def: BuildingDef }) {
  if (def.recipe)
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <Items list={def.recipe.in} />
        <span className="text-[#C8754D]">→</span>
        <Items list={def.recipe.out} />
        <span className={TONE.label}>· {def.recipe.time}s</span>
      </span>
    )
  if (def.mines)
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        {Object.entries(def.mines).map(([g, item]) => (
          <span key={g} className="inline-flex items-center gap-1">
            <span className={TONE.label}>{g}</span>
            <span className="text-[#C8754D]">→</span>
            <Icon name={item as ItemId} size={14} />
          </span>
        ))}
      </span>
    )
  return null
}

export function Cost({ def, poor }: { def: BuildingDef; poor?: boolean }) {
  const c = def.cost
  if (!c.metal && !c.brick) return <span className={TONE.label}>free</span>
  return (
    <span className={`inline-flex items-center gap-1 ${poor ? TONE.bad : ''}`}>
      {c.metal ? (
        <span className="inline-flex items-center gap-0.5">
          <Icon name="metal" size={12} />
          {c.metal}
        </span>
      ) : null}
      {c.brick ? (
        <span className="inline-flex items-center gap-0.5">
          <Icon name="brick" size={12} />
          {c.brick}
        </span>
      ) : null}
    </span>
  )
}

export const Row = ({ k, v }: { k: string; v: ReactNode }) => (
  <div className="flex items-center justify-between gap-3">
    <dt className="text-[#8A8A8A]">{k}</dt>
    <dd className="text-right text-[#F6F6F6]">{v}</dd>
  </div>
)

export function Modal({ title, icon, children, onClose, wide }: { title: string; icon?: IconName; children: ReactNode; onClose?: () => void; wide?: boolean }) {
  // move focus into the dialog (its autofocus button if it has one) and give it back on close
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    const el = box.current
    if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true })
    return () => before?.focus?.({ preventScroll: true })
  }, [])
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-[#0c1220]/70 p-4" onClick={onClose}>
      <div
        ref={box}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`${panel} rise max-h-full outline-none w-full overflow-y-auto border-t-2 border-t-[#C8754D] ${wide ? 'max-w-2xl' : 'max-w-md'}`}
      >
        <div className="flex items-center gap-2 border-b border-[#3F4246] bg-[#2E3033] px-4 py-2.5">
          {icon && <Icon name={icon} />}
          <p className="flex-1 text-sm text-white">{title}</p>
          {onClose && (
            <button type="button" onClick={onClose} className="text-[#8A8A8A] hover:text-white" aria-label="Close">
              ✕
            </button>
          )}
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}
