import { notFound } from 'next/navigation'
import { ArtSheetLoader } from '@/game/ui/ArtSheetLoader'

/** Development only: every building at every level, at 2×, on its footprint. */
export default function ArtPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <ArtSheetLoader />
}
