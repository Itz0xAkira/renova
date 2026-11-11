'use client'

import { useEffect, useState, type ReactNode } from 'react'

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center font-display font-semibold tracking-[0.16em] ${className}`} role="img" aria-label="RENOVA">
      <span aria-hidden>REN</span>
      <svg aria-hidden viewBox="0 0 24 24" className="mr-[0.16em] h-[0.8em] w-[0.8em] overflow-visible">
        <circle cx="12" cy="12" r="9.3" fill="none" stroke="currentColor" strokeWidth="2.7" />
        <ellipse cx="12" cy="12" rx="15" ry="4.4" fill="none" stroke="#E8753B" strokeWidth="1.7" transform="rotate(-22 12 12)" />
      </svg>
      <span aria-hidden>VA</span>
    </span>
  )
}

export function Chapter({ n, title, className = '' }: { n: string; title: string; className?: string }) {
  return (
    <p className={`label flex items-center gap-4 ${className}`}>
      <span>{n}</span>
      <span aria-hidden className="h-px w-10 bg-current opacity-40" />
      <span>{title}</span>
    </p>
  )
}

export function Arrow({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 12" className={`h-3 w-5 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M0 6h18M13 1l5 5-5 5" />
    </svg>
  )
}

type CtaProps = { children: ReactNode; href?: string; onClick?: () => void; variant?: 'solid' | 'line' | 'line-dark'; className?: string }

export function Cta({ children, href, onClick, variant = 'solid', className = '' }: CtaProps) {
  const tone =
    variant === 'solid'
      ? 'bg-mars text-navy hover:bg-star'
      : variant === 'line'
        ? 'text-star ring-1 ring-inset ring-star/35 hover:bg-star hover:text-navy'
        : 'text-navy ring-1 ring-inset ring-navy/35 hover:bg-navy hover:text-star'
  const cls = `group inline-flex items-center gap-4 px-6 py-4 text-[0.8125rem] font-semibold uppercase tracking-[0.16em] transition-colors duration-300 ${tone} ${className}`
  const inner = (
    <>
      <span>{children}</span>
      <Arrow className="transition-transform duration-300 group-hover:translate-x-1" />
    </>
  )
  return href ? (
    <a href={href} className={cls}>
      {inner}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  )
}

/** Fixed "mission log" index of the current chapter (desktop only). */
export function ChapterIndicator({ hidden }: { hidden: boolean }) {
  const [cur, setCur] = useState<{ n: string; t: string } | null>(null)
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('[data-chapter]')
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          const el = e.target as HTMLElement
          if (e.isIntersecting) setCur({ n: el.dataset.chapter!, t: el.dataset.title! })
        }),
      { rootMargin: '-50% 0px -50% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
  const show = !hidden && cur && cur.n !== '01' && cur.n !== '05'
  return (
    <div
      aria-hidden
      className={`label pointer-events-none fixed bottom-8 left-5 z-40 hidden rotate-180 items-center gap-3 text-star mix-blend-difference transition-opacity duration-500 [writing-mode:vertical-rl] xl:flex ${show ? 'opacity-100' : 'opacity-0'}`}
    >
      <span>{cur?.n ?? '01'} / 09</span>
      <span className="h-10 w-px bg-current" />
      <span>{cur?.t}</span>
    </div>
  )
}
