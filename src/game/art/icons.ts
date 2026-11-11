/**
 * 9×9 pixel icons for the HUD, drawn from strings in the game palette and
 * cached as data URLs. `.` is transparent; every other letter is a colour.
 */

const PAL: Record<string, string> = {
  k: '#151618', // outline
  w: '#F6F6F6',
  g: '#BFBFBF',
  G: '#858789',
  d: '#3F4246',
  c: '#65C9E8',
  C: '#3E8DA8',
  b: '#1F5566',
  y: '#F4D03F',
  Y: '#C17A00',
  o: '#D58B59',
  O: '#A95738',
  s: '#E5B07A',
  r: '#D86B7B',
  R: '#B03E53',
  l: '#A8B87A',
  L: '#668B45',
  n: '#9c7450',
  N: '#573b27',
}

const ICONS = {
  crew: ['..kkkkk..', '.kwwwwgk.', 'kwkkkkkgk', 'kwkcwcCgk', 'kwkcccCgk', 'kgkkkkkGk', '.kgggGGk.', 'kOoooooOk', '.kkkkkkk.'],
  heart: ['.........', '.kk...kk.', 'krrk.krrk', 'krwrkrrRk', 'krrrrrrRk', '.krrrrRk.', '..krrRk..', '...kRk...', '....k....'],
  power: ['....kkk..', '...kyyk..', '..kyyk...', '.kyyyykk.', '.kkkyyyk.', '...kyyk..', '..kyyk...', '..kyk....', '..kk.....'],
  water: ['....k....', '...kck...', '...kck...', '..kcwck..', '.kccccck.', '.kcCcCck.', '.kCCCCCk.', '..kCCCk..', '...kkk...'],
  food: ['....kL...', '...kLlk..', '..kkkLkk.', '.kRrrrRRk', 'kRrwrrrRk', 'kRrrrrrRk', 'kRRrrrRRk', '.kRRRRRk.', '..kkkkk..'],
  o2: ['.....kk..', '....kcck.', '....kcwk.', '.kk..kk..', 'kcck.....', 'kcwck.kk.', 'kccck.kck', '.kkk..kk.', '.........'],
  metal: ['.........', '..kkkkk..', '.kwwwwgk.', 'kggggggGk', 'kggggggGk', 'kGGGGGGdk', '.kkkkkkk.', '.........', '.........'],
  brick: ['.........', '.........', 'kkkkkkkkk', 'koooOkook', 'kOOOOkOOk', 'kkkkkkkkk', 'kookooook', 'kOOkOOOOk', 'kkkkkkkkk'],
  ice: ['....k....', '...kwk...', '..kwcCk..', '.kwccCCk.', 'kwcccCCbk', '.kccCCbk.', '..kcCbk..', '...kbk...', '....k....'],
  ore: ['.........', '...kkkk..', '..kdGGdk.', '.kdRdGdk.', 'kdGdddRdk', 'kddRdGddk', '.kdddddk.', '..kkkkk..', '.........'],
  regolith: ['.........', '.........', '....kk...', '...kook..', '..kosook.', '.kosooOOk', 'kssooOOOk', 'kkkkkkkkk', '.........'],
  soil: ['....L....', '...LlL...', '....L....', '...kkk...', '..knnnk..', '.knNnnNk.', 'knNNnNNNk', 'kkkkkkkkk', '.........'],
  research: ['..kkkkk..', '...kgk...', '...kgk...', '..kgwgk..', '.kgcccgk.', 'kgcCcCcgk', 'kgCCCCCgk', '.kkkkkkk.', '.........'],
  menu: ['...kkk...', '.kkgggkk.', '.kgGkGgk.', 'kgGk.kGgk', 'kgk...kgk', 'kgGk.kGgk', '.kgGkGgk.', '.kkgggkk.', '...kkk...'],
  guide: ['.kkkkkkk.', 'kwwwwwwwk', 'kwwkkkwwk', 'kwwwwkwwk', 'kwwwkkwwk', 'kwwwkwwwk', 'kwwwwwwwk', 'kwwwkwwwk', '.kkkkkkk.'],
  pause: ['.........', '.kkk.kkk.', '.kwk.kwk.', '.kwk.kwk.', '.kwk.kwk.', '.kwk.kwk.', '.kwk.kwk.', '.kkk.kkk.', '.........'],
  play: ['.kk......', '.kwkk....', '.kwwwkk..', '.kwwwwwk.', '.kwwwwwwk', '.kwwwwwk.', '.kwwwkk..', '.kwkk....', '.kk......'],
  sun: ['....y....', '.y.....y.', '...kkk...', '..kyyyk..', 'y.kyyYk.y', '..kyYYk..', '...kkk...', '.y.....y.', '....y....'],
  moon: ['...kkk...', '..kgggk..', '.kgGkk...', '.kgk.....', '.kgk.....', '.kgGkk...', '..kgggk..', '...kkk...', '.........'],
  storm: ['.........', '.kkkkkk..', 'kooooook.', '.kkkkooOk', '.kooookk.', 'kOOkkk...', '.kooooook', '..kkkkkk.', '.........'],
  warn: ['....k....', '...kyk...', '..kykyk..', '..kykyk..', '.kyykyyk.', '.kyyyyyk.', 'kyyykyyyk', 'kyyyyyyyk', 'kkkkkkkkk'],
  flag: ['.k.......', '.kRRRRR..', '.kRrrrRk.', '.kRRRRRk.', '.k.......', '.k.......', '.k.......', '.k.......', 'kkk......'],
  tip: ['..kkkkk..', '.kyyyyyk.', 'kyyywyyyk', 'kyywyyyyk', '.kyyyyyk.', '..kyyyk..', '..kgggk..', '..kgggk..', '...kkk...'],
  check: ['.........', '.......kk', '......kLk', 'kk...kLk.', 'kLk.kLk..', '.kLkLk...', '..kLk....', '...k.....', '.........'],
  battery: ['...kkk...', '.kkgggkk.', '.kdddddk.', '.kcccccdk', '.kcwcccdk', '.kcccccdk', '.kcccccdk', '.kdddddk.', '.kkkkkkk.'],
  rotate: ['..kkkk...', '.kwwwwk..', 'kwk..kwk.', 'kk....kwk', '......kwk', '.kk..kkwk', '.kwkkwwk.', '..kwwwk..', '...kkk...'],
  remove: ['.........', '.kk...kk.', '.kRk.kRk.', '..kRkRk..', '...kRk...', '..kRkRk..', '.kRk.kRk.', '.kk...kk.', '.........'],
  lock: ['..kkkkk..', '.kGk.kGk.', '.kGk.kGk.', 'kkkkkkkkk', 'kyyyyyyYk', 'kyyykyyYk', 'kyyykyyYk', 'kYYYYYYYk', 'kkkkkkkkk'],
  // build categories
  logistics: ['.........', '.........', 'kkkkkkk..', 'koooooook', 'kOkOkOkOk', 'koooooook', 'kkkkkkk..', '.........', '.........'],
  extract: ['..kkkkk..', '.kgggggk.', 'kgk.k.kgk', 'kk..k..kk', '....k....', '....O....', '....O....', '....O....', '....k....'],
  process: ['...kkk...', '.kkoookk.', '.koOkOok.', 'koOk.kOok', 'kok...kok', 'koOk.kOok', '.koOkOok.', '.kkoookk.', '...kkk...'],
  life: ['......kk.', '....kkLk.', '...kLlLk.', '..kLlLLk.', '.kLlLLk..', '.kLLLk...', '..kkk....', '.k.......', 'k........'],
  science: ['..kkkkk..', '...kgk...', '...kgk...', '..kgwgk..', '.kgcccgk.', 'kgcCcCcgk', 'kgCCCCCgk', '.kkkkkkk.', '.........'],
} as const

export type IconName = keyof typeof ICONS

const cache: Partial<Record<IconName, string>> = {}

export function iconURL(name: IconName): string {
  const hit = cache[name]
  if (hit) return hit
  const rows = ICONS[name]
  const cv = document.createElement('canvas')
  cv.width = 9
  cv.height = 9
  const ctx = cv.getContext('2d')!
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const c = PAL[ch]
      if (!c) return
      ctx.fillStyle = c
      ctx.fillRect(x, y, 1, 1)
    }),
  )
  return (cache[name] = cv.toDataURL())
}
