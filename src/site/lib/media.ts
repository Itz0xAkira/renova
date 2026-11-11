const U = 'https://images.unsplash.com/'

/** Unsplash sources. `rect` crops are measured against each original. */
const PHOTOS = {
  hero: { id: 'photo-1612892483236-52d32a0e0ac1', alt: 'A vast red desert at dusk under the first stars, tyre tracks leading toward distant mountains' },
  mars: { id: 'photo-1630694093867-4b947d812bf0', rect: '270,120,1760,1760', alt: 'The planet Mars, half in shadow' },
  mesa: { id: 'photo-1763365803423-48d4b9402c5e', alt: 'Aerial view of a red mesa rising from an empty plain at dusk' },
  seedling: { id: 'photo-1767457108672-79c6dd48a165', alt: 'A seedling with two pairs of leaves rising from dark soil' },
  led: { id: 'photo-1632833019620-4385e9240833', alt: 'Plants silhouetted under blue and violet grow lights' },
  cells: { id: 'photo-1714844437236-de8ef1c7286f', alt: 'Plant cells seen through a microscope' },
  leaves: { id: 'photo-1723110569402-6eec857daa4d', alt: 'Dense, healthy lettuce leaves' },
  night: { id: '20/dusty-sky.JPG', alt: 'Dunes beneath a deep starry sky, a faint orange glow on the horizon' },
} as const

export type PhotoKey = keyof typeof PHOTOS

export function photo(key: PhotoKey, w: number, h?: number) {
  const p = PHOTOS[key]
  const rect = 'rect' in p ? `&rect=${p.rect}` : ''
  return `${U}${p.id}?auto=format&fit=crop&q=72&w=${w}${h ? `&h=${h}` : ''}${rect}`
}

export function srcSet(key: PhotoKey, widths: number[], ratio?: number) {
  return widths.map((w) => `${photo(key, w, ratio ? Math.round(w * ratio) : undefined)} ${w}w`).join(', ')
}

export const alt = (key: PhotoKey) => PHOTOS[key].alt
