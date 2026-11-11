'use client'

import dynamic from 'next/dynamic'

// Phaser needs `window`, so the game only ever renders in the browser.
const GameRoot = dynamic(() => import('./GameRoot'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0c1220] font-pixel text-xs uppercase text-star/70">
      Landing on Mars<span className="blink">_</span>
    </div>
  ),
})

export function PlayLoader() {
  return <GameRoot />
}
