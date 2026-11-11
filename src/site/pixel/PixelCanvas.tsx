'use client'

import { useEffect, useRef } from 'react'
import { buildBackdrop, makeView, pick, renderScene, type ObjKind, type Scene, type View } from './engine'
import { useReducedMotion } from '../lib/hooks'

type Anchor = [number, number] | ((W: number, H: number) => [number, number])

type Props = {
  scene: Scene
  label: string
  /** 0–1 build-in progress; read every frame so scroll can drive it without re-rendering. */
  revealRef?: { current: number }
  anchor?: Anchor
  /** Native pixel height for landscape containers. */
  base?: number
  /** Minimum native width, so the mesa always fits in portrait. */
  minW?: number
  E?: number
  horizon?: number
  className?: string
  ghost?: ObjKind | null
  canPlace?: (i: number, j: number) => boolean
  onTile?: (i: number, j: number) => void
}

export function PixelCanvas({
  scene,
  label,
  revealRef,
  anchor = [0.5, 0.56],
  base = 288,
  minW = 340,
  E = 18,
  horizon = 0.36,
  className = '',
  ghost = null,
  canPlace,
  onTile,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduced = useReducedMotion()
  const st = useRef({
    scene,
    ghost,
    canPlace,
    onTile,
    reduced,
    hover: null as [number, number] | null,
    view: null as View | null,
    bg: null as HTMLCanvasElement | null,
    draw: (_now: number) => {},
  })
  Object.assign(st.current, { scene, ghost, canPlace, onTile, reduced })

  useEffect(() => {
    st.current.draw(performance.now())
  }, [scene, ghost])

  useEffect(() => {
    const cv = ref.current!
    const ctx = cv.getContext('2d')!
    let W = 0
    let H = 0
    const s = st.current

    s.draw = (now: number) => {
      if (!s.view) return
      const hv = s.hover
      renderScene(ctx, s.view, s.scene, s.bg, {
        t: s.reduced ? 0 : now / 1000,
        now: s.reduced ? Number.MAX_SAFE_INTEGER : now / 1000,
        reveal: revealRef ? revealRef.current : 1,
        hover: hv,
        ghost: s.ghost,
        ghostOk: hv && s.canPlace ? s.canPlace(hv[0], hv[1]) : true,
      })
    }

    const resize = () => {
      const r = cv.getBoundingClientRect()
      if (!r.width || !r.height) return
      const aspect = r.width / r.height
      let w = Math.round(base * aspect)
      let h = base
      if (w < minW) {
        w = minW
        h = Math.round(minW / aspect)
      }
      if (w === W && h === H) return
      W = w
      H = h
      cv.width = W
      cv.height = H
      const a = typeof anchor === 'function' ? anchor(W, H) : anchor
      const hz = H * (typeof horizon === 'number' ? horizon : 0.36)
      s.view = makeView(W, H, s.scene.terrain, a[0], a[1], E, Math.min(hz, H * a[1] - 40))
      s.bg = buildBackdrop(s.view, s.scene.terrain)
      s.draw(performance.now())
    }
    const ro = new ResizeObserver(resize)
    ro.observe(cv)

    let raf = 0
    let last = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (now - last < 33) return
      last = now
      s.draw(now)
    }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !raf) raf = requestAnimationFrame(loop)
      if (!e.isIntersecting && raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
    })
    io.observe(cv)
    return () => {
      ro.disconnect()
      io.disconnect()
      cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toTile = (clientX: number, clientY: number) => {
    const cv = ref.current
    const v = st.current.view
    if (!cv || !v) return null
    const r = cv.getBoundingClientRect()
    return pick(v, st.current.scene.terrain, ((clientX - r.left) / r.width) * v.W, ((clientY - r.top) / r.height) * v.H)
  }

  const interactive = Boolean(onTile)
  const moveCursor = (di: number, dj: number) => {
    const T = st.current.scene.terrain
    const [i, j] = st.current.hover ?? [Math.floor(T.cols / 2), Math.floor(T.rows / 2)]
    const ni = Math.max(0, Math.min(T.cols - 1, i + di))
    const nj = Math.max(0, Math.min(T.rows - 1, j + dj))
    if (T.cells[nj * T.cols + ni]) st.current.hover = [ni, nj]
  }

  return (
    <canvas
      ref={ref}
      role={interactive ? 'application' : 'img'}
      aria-label={label}
      tabIndex={interactive ? 0 : undefined}
      className={`pixelated block h-full w-full ${interactive ? 'cursor-crosshair outline-none' : ''} ${className}`}
      onPointerMove={interactive ? (e) => (st.current.hover = toTile(e.clientX, e.clientY)) : undefined}
      onPointerLeave={interactive ? () => (st.current.hover = null) : undefined}
      onClick={
        interactive
          ? (e) => {
              const t = toTile(e.clientX, e.clientY)
              if (t) onTile?.(t[0], t[1])
            }
          : undefined
      }
      onKeyDown={
        interactive
          ? (e) => {
              const k = e.key
              if (k === 'ArrowUp') moveCursor(0, -1)
              else if (k === 'ArrowDown') moveCursor(0, 1)
              else if (k === 'ArrowLeft') moveCursor(-1, 0)
              else if (k === 'ArrowRight') moveCursor(1, 0)
              else if ((k === 'Enter' || k === ' ') && st.current.hover) onTile?.(st.current.hover[0], st.current.hover[1])
              else return
              e.preventDefault()
            }
          : undefined
      }
    />
  )
}
