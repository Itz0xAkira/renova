/** Real space weather: flares replay DONKI records, their class sets the danger, and they survive a save. */
import { FLARE_ARCHIVE, flareStrength, type FlareRecord } from '@/game/core/nasa'
import { SOL } from '@/game/core/data'
import { check, clean, reload, run } from './helpers'

// the class scale: X1 = 1, ten times brighter adds half, capped
check(flareStrength('X1.0') === 1 && Math.abs(flareStrength('X10') - 1.5) < 1e-9 && Math.abs(flareStrength('M1.0') - 0.5) < 1e-9, 'flare strength scale')
check(flareStrength('X8.7') > flareStrength('X2.0') && flareStrength('X2.0') > flareStrength('M5.0'), 'stronger flares hit harder')
check(flareStrength('C1.0') === 0.4 && flareStrength('X99') === 1.6 && flareStrength('nonsense') === 1, 'flare strength is clamped and safe')

// every flare replays a real archived record, and the first one explains itself once
const s = clean()
run(s, SOL * 6)
const seen = s.messages.filter((m) => m.text.startsWith('Solar flare warning'))
check(seen.length >= 1, 'a flare should happen within six sols')
check(seen.every((m) => FLARE_ARCHIVE.some((f) => m.text.includes(f.cls))), 'flare messages name a real flare class')
check(s.popups.filter((p) => p.kind === 'science').length === 1, 'the space-weather card shows once')

// a live pool replaces the archive, and the flare in progress is saved with its record
const live: FlareRecord[] = [{ id: '2026-11-01T10:00:00-FLR-001', cls: 'M4.2', peak: '2026-11-01T10:12Z', region: 14000, link: 'https://ccmc.gsfc.nasa.gov/DONKI/' }]
const t = clean(7)
t.setFlarePool(live, true)
check(t.flareSource.live && t.flareSource.count === 1, 'live pool in use')
t.setFlarePool([], true)
check(t.flareSource.count === 1, 'an empty live feed keeps the old pool')
while (!t.ev.flare) t.step(1 / 20)
check(t.ev.flare.rec?.cls === 'M4.2' && t.ev.flare.live === true, 'flare replays the live record')
const back = reload(t)
check(back.ev.flare?.rec?.id === live[0].id && back.ev.flare?.live === true, 'flare record survives a save')
console.log('OK space weather: real DONKI flares, class-scaled danger, live pool, saved records')
