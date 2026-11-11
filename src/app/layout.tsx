import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RENOVA — Build a colony on Mars',
  description: 'RENOVA is an educational Mars colony factory game. Mine ice, grow food, power your base and keep your crew safe.',
}

export const viewport: Viewport = { themeColor: '#101827' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
