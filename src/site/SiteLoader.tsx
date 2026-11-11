'use client'

import dynamic from 'next/dynamic'

// The landing site leans on canvas and scroll APIs throughout, so it renders on the client.
const SiteApp = dynamic(() => import('./SiteApp'), {
  ssr: false,
  loading: () => <div className="min-h-screen bg-navy" />,
})

export function SiteLoader() {
  return <SiteApp />
}
