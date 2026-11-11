'use client'

import dynamic from 'next/dynamic'

// The art is baked on canvases, so the sheet only renders in the browser.
const ArtSheet = dynamic(() => import('@/game/ui/ArtSheet'), { ssr: false })

export function ArtSheetLoader() {
  return <ArtSheet />
}
