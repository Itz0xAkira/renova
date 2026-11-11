'use client'

import { useEffect, useRef, useState } from 'react'
import { previewCanvas, spriteSpec } from '@/game/art/sprites'
import { BUILDINGS, type Kind } from '@/game/core/data'

/**
 * A development sheet of every building at levels 1–3, drawn at 2× on a sand
 * patch with its footprint outlined, so art changes can be checked at a glance.
 * `?kind=smelter` shows one building; `?t=0.5` picks the animation time.
 */
const KINDS: Kind[] = ['core', 'drill', 'excavator', 'melter', 'smelter', 'kiln', 'washer', 'greenhouse', 'moxie', 'habitat', 'shield', 'solar', 'pylon', 'battery', 'reactor', 'lab']
const ZOOM = 2

function Cell({ kind, tier, t }: { kind: Kind; tier: number; t: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const spec = spriteSpec(kind)
    const ctx = cv.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = '#d99862'
    ctx.fillRect(0, 0, cv.width, cv.height)
    // footprint outline on the ground
    const { w, h } = BUILDINGS[kind]
    const corner = (i: number, j: number) => [(spec.ax + (i - j) * 16 - ((w - h) * 16) / 2) * ZOOM, (spec.ay + (i + j) * 8 - ((w + h) * 8) / 2) * ZOOM] as const
    ctx.strokeStyle = 'rgba(60,20,10,0.5)'
    ctx.beginPath()
    for (const [i, j] of [[0, 0], [w, 0], [w, h], [0, h], [0, 0]] as const) {
      const [x, y] = corner(i, j)
      if (i === 0 && j === 0) ctx.moveTo(x, y)
      ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.drawImage(previewCanvas(kind, tier, t), 0, 0, spec.W * ZOOM, spec.H * ZOOM)
  }, [kind, tier, t])
  const spec = spriteSpec(kind)
  return <canvas ref={ref} width={spec.W * ZOOM} height={spec.H * ZOOM} className="pixelated" title={`${kind} level ${tier}`} />
}

export default function ArtSheet() {
  const [q] = useState(() => new URLSearchParams(window.location.search))
  const only = q.get('kind') as Kind | null
  const t = Number(q.get('t') ?? 0.3)
  const kinds = only ? [only] : KINDS
  return (
    <main className="min-h-screen bg-[#3a2018] p-4 font-mono text-xs text-white">
      <h1 className="mb-3 text-sm">RENOVA art sheet · t = {t}</h1>
      {kinds.map((k) => (
        <section key={k} className="mb-4">
          <p className="mb-1">
            {BUILDINGS[k].name} · {BUILDINGS[k].w}×{BUILDINGS[k].h}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            {[1, 2, 3].map((tier) => (
              <Cell key={tier} kind={k} tier={tier} t={t} />
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
