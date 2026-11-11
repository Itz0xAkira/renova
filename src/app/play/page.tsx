import type { Metadata } from 'next'
import { PlayLoader } from '@/game/ui/PlayLoader'

export const metadata: Metadata = { title: 'Play RENOVA — Mars colony factory' }

export default function PlayPage() {
  return <PlayLoader />
}
