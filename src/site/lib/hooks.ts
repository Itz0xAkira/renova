'use client'

import { useEffect, useRef, useState } from 'react'

const RM = '(prefers-reduced-motion: reduce)'

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const m = window.matchMedia(RM)
    const on = () => setReduced(m.matches)
    on()
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return reduced
}

/** Adds `in` to every `.rv` descendant the first time it scrolls into view. */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return
          e.target.classList.add('in')
          io.unobserve(e.target)
        }),
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    )
    root.querySelectorAll('.rv').forEach((n) => io.observe(n))
    return () => io.disconnect()
  }, [])
  return ref
}

export function useInView<T extends Element>(rootMargin = '0px') {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [rootMargin])
  return [ref, inView] as const
}

/** Runs `fn` at most once per animation frame while the page scrolls or resizes. */
export function useScrollFrame(fn: () => void) {
  const fnRef = useRef(fn)
  fnRef.current = fn
  useEffect(() => {
    let raf = 0
    const run = () => {
      raf = 0
      fnRef.current()
    }
    const on = () => {
      if (!raf) raf = requestAnimationFrame(run)
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
    }
  }, [])
}

export const clamp = (n: number, a = 0, b = 1) => Math.min(b, Math.max(a, n))
export const range = (p: number, a: number, b: number) => clamp((p - a) / (b - a))
