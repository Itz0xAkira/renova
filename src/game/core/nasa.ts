/**
 * Real NASA data used in RENOVA, curated from the NASA Space Apps 2026
 * "Junior Astronaut Mission Trainer" challenge resources. Everything here is
 * archived (copied in when the game was built) unless it says it's live; the
 * game says which it is wherever it shows it.
 *
 * Sources
 * - DONKI, NASA's Space Weather Database Of Notifications, Knowledge, Information
 *   (CCMC): solar flare records. Archived X-class flares from 2024 below; the game
 *   also fetches the last 30 days live (see `fetchRecentFlares`).
 * - RadLab, the OSDR Radiation Dosimetry Database: Curiosity's Radiation
 *   Assessment Detector (MSL-RAD) on the surface of Mars, 2015-01-01 to
 *   2024-06-03, about 275,000 readings of absorbed dose rate.
 * - OSDR, NASA's Open Science Data Repository: spaceflight biology studies.
 * - Mars Trek: Viking colour mosaic of Mars (Mars_Viking_MDIM21_ClrMosaic_global_232m).
 * - CSA (Canadian Space Agency): food production on the Moon and in remote areas.
 */

/* --------------------------------- DONKI ---------------------------------- */

export type FlareRecord = {
  /** DONKI flare ID, e.g. 2024-05-14T16:46:00-FLR-001 */
  id: string
  /** GOES X-ray class, e.g. "X8.7" */
  cls: string
  /** Peak time (UTC), ISO */
  peak: string
  /** NOAA active region number, when DONKI gives one */
  region: number | null
  /** DONKI page for the event */
  link: string
}

/** Every X-class flare DONKI recorded from 1 May to 29 June and 1 Sep to 30 Oct 2024 (GOES-P EXIS). */
export const FLARE_ARCHIVE: FlareRecord[] = [
  { id: '2024-05-03T02:11:00-FLR-001', cls: 'X1.6', peak: '2024-05-03T02:22Z', region: 13663, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30403/-1' },
  { id: '2024-05-05T05:47:00-FLR-001', cls: 'X1.3', peak: '2024-05-05T06:01Z', region: 13663, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30457/-1' },
  { id: '2024-05-05T11:41:00-FLR-001', cls: 'X1.2', peak: '2024-05-05T11:54Z', region: 13663, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30461/-1' },
  { id: '2024-05-06T05:38:00-FLR-001', cls: 'X4.5', peak: '2024-05-06T06:35Z', region: 13663, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30484/-1' },
  { id: '2024-05-08T01:33:00-FLR-001', cls: 'X1.0', peak: '2024-05-08T01:41Z', region: 13663, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30548/-1' },
  { id: '2024-05-08T04:37:00-FLR-001', cls: 'X1.0', peak: '2024-05-08T05:09Z', region: 13664, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30551/-1' },
  { id: '2024-05-08T21:08:00-FLR-001', cls: 'X1.0', peak: '2024-05-08T21:40Z', region: 13664, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30601/-1' },
  { id: '2024-05-09T08:45:00-FLR-001', cls: 'X2.2', peak: '2024-05-09T09:13Z', region: 13664, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30605/-1' },
  { id: '2024-05-09T17:23:00-FLR-001', cls: 'X1.1', peak: '2024-05-09T17:44Z', region: 13664, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30634/-1' },
  { id: '2024-05-10T06:27:00-FLR-001', cls: 'X3.9', peak: '2024-05-10T06:54Z', region: 13664, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30666/-1' },
  { id: '2024-05-11T01:10:00-FLR-001', cls: 'X5.8', peak: '2024-05-11T01:23Z', region: 13664, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30711/-1' },
  { id: '2024-05-11T11:15:00-FLR-001', cls: 'X1.5', peak: '2024-05-11T11:44Z', region: 13664, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30722/-1' },
  { id: '2024-05-12T16:11:00-FLR-001', cls: 'X1.0', peak: '2024-05-12T16:26Z', region: 13664, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30760/-1' },
  { id: '2024-05-14T02:03:00-FLR-001', cls: 'X1.7', peak: '2024-05-14T02:09Z', region: 13664, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30832/-1' },
  { id: '2024-05-14T12:40:00-FLR-001', cls: 'X1.2', peak: '2024-05-14T12:55Z', region: 13664, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30837/-1' },
  { id: '2024-05-14T16:46:00-FLR-001', cls: 'X8.7', peak: '2024-05-14T16:51Z', region: 13664, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30849/-1' },
  { id: '2024-05-15T08:18:00-FLR-001', cls: 'X3.4', peak: '2024-05-15T08:37Z', region: 13664, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30879/-1' },
  { id: '2024-05-15T14:20:00-FLR-001', cls: 'X2.9', peak: '2024-05-15T14:38Z', region: 13685, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/30900/-1' },
  { id: '2024-05-27T06:49:00-FLR-001', cls: 'X2.8', peak: '2024-05-27T07:08Z', region: 13697, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/31158/-1' },
  { id: '2024-05-29T14:11:00-FLR-001', cls: 'X1.4', peak: '2024-05-29T14:37Z', region: 13697, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/31185/-1' },
  { id: '2024-05-31T21:52:00-FLR-001', cls: 'X1.1', peak: '2024-05-31T22:03Z', region: 13697, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/31248/-1' },
  { id: '2024-06-01T08:26:00-FLR-001', cls: 'X1.4', peak: '2024-06-01T08:48Z', region: 13697, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/31251/-1' },
  { id: '2024-06-01T18:24:00-FLR-001', cls: 'X1.0', peak: '2024-06-01T18:36Z', region: 13697, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/31254/-1' },
  { id: '2024-06-10T11:03:00-FLR-001', cls: 'X1.5', peak: '2024-06-10T11:08Z', region: 13697, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/31397/-1' },
  { id: '2024-09-12T09:31:00-FLR-001', cls: 'X1.3', peak: '2024-09-12T09:43Z', region: 13825, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/33340/-1' },
  { id: '2024-09-14T15:13:00-FLR-001', cls: 'X4.5', peak: '2024-09-14T15:29Z', region: 13825, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/33428/-1' },
  { id: '2024-10-01T21:58:00-FLR-001', cls: 'X7.1', peak: '2024-10-01T22:20Z', region: 13842, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/33656/-1' },
  { id: '2024-10-03T12:08:00-FLR-001', cls: 'X9.0', peak: '2024-10-03T12:18Z', region: 13842, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/33693/-1' },
  { id: '2024-10-07T19:02:00-FLR-001', cls: 'X2.1', peak: '2024-10-07T19:13Z', region: 13842, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/33824/-1' },
  { id: '2024-10-07T19:31:00-FLR-001', cls: 'X1.0', peak: '2024-10-07T20:59Z', region: 13842, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/33827/-1' },
  { id: '2024-10-09T01:25:00-FLR-001', cls: 'X1.8', peak: '2024-10-09T01:56Z', region: 13848, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/33863/-1' },
  { id: '2024-10-09T15:44:00-FLR-001', cls: 'X1.4', peak: '2024-10-09T15:47Z', region: 13842, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/33885/-1' },
  { id: '2024-10-24T03:30:00-FLR-001', cls: 'X3.3', peak: '2024-10-24T03:57Z', region: 13869, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/34148/-1' },
  { id: '2024-10-26T06:32:00-FLR-001', cls: 'X1.8', peak: '2024-10-26T07:19Z', region: 13873, link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/FLR/34206/-1' },
]

/**
 * How hard a flare hits in the game, from its X-ray class: an X1 flare is 1, and each
 * step of ten in peak X-ray brightness adds half (M1 = 0.5, X10 = 1.5), capped 0.4–1.6.
 * The class scale is logarithmic in real life too: an X1 is ten times an M1.
 */
export function flareStrength(cls: string) {
  const m = /^([ABCMX])(\d+(?:\.\d+)?)/.exec(cls)
  if (!m) return 1
  const exp = { A: -8, B: -7, C: -6, M: -5, X: -4 }[m[1] as 'A' | 'B' | 'C' | 'M' | 'X']
  const flux = Number(m[2]) * 10 ** exp // W/m², the GOES 1–8 Å scale
  return Math.max(0.4, Math.min(1.6, 1 + 0.5 * Math.log10(flux / 1e-4)))
}

/** "14 May 2024" from an ISO timestamp. */
export function dayOf(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** DONKI's flare web service (CORS-enabled, no key). */
const DONKI_FLR = 'https://ccmc.gsfc.nasa.gov/DONKI-API/get/FLR'

/**
 * Live: M- and X-class flares DONKI recorded in the last `days` days, strongest first.
 * Null if the request fails (offline, blocked); the game then uses the archive.
 */
export async function fetchRecentFlares(days = 30, signal?: AbortSignal): Promise<FlareRecord[] | null> {
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const end = new Date()
  const start = new Date(end.getTime() - days * 86400000)
  try {
    const res = await fetch(`${DONKI_FLR}?startDate=${iso(start)}&endDate=${iso(end)}`, { signal })
    if (!res.ok) return null
    const data = (await res.json()) as { flrID?: string; classType?: string; peakTime?: string; activeRegionNum?: number | null; link?: string }[]
    if (!Array.isArray(data)) return null
    return data
      .filter((f) => f.flrID && f.classType && /^[MX]/.test(f.classType))
      .map((f) => ({ id: f.flrID!, cls: f.classType!, peak: f.peakTime ?? '', region: f.activeRegionNum ?? null, link: f.link ?? 'https://ccmc.gsfc.nasa.gov/tools/DONKI/' }))
      .sort((a, b) => flareStrength(b.cls) - flareStrength(a.cls))
  } catch {
    return null
  }
}

/* --------------------------------- RadLab --------------------------------- */

/**
 * Radiation on the surface of Mars, measured by Curiosity's Radiation Assessment Detector
 * (MSL-RAD) in Gale Crater, from RadLab. Absorbed dose in micrograys (μGy).
 */
export const MARS_RADIATION = {
  source: 'RadLab (OSDR Radiation Dosimetry Database): Curiosity MSL-RAD, Mars surface',
  link: 'https://visualization.osdr.nasa.gov/radlab/gui/data-api/',
  /** Average per day over every reading from 1 Jan 2015 to 3 Jun 2024 (~275,000 readings). */
  averagePerDay: 188,
  /** The worst single day in the record: 20 May 2024, during the solar storm from region 13664. */
  stormDay: { date: '2024-05-20', perDay: 1664 },
  /** Daily dose in May 2024, around the storm. */
  may2024: [
    ['2024-05-08', 115], ['2024-05-09', 118], ['2024-05-10', 116], ['2024-05-11', 116], ['2024-05-12', 117], ['2024-05-13', 117],
    ['2024-05-14', 112], ['2024-05-15', 107], ['2024-05-16', 105], ['2024-05-17', 98], ['2024-05-18', 91], ['2024-05-19', 93],
    ['2024-05-20', 1664], ['2024-05-21', 299], ['2024-05-22', 130], ['2024-05-23', 110], ['2024-05-24', 111], ['2024-05-25', 108],
  ] as [string, number][],
}

/* ---------------------------------- OSDR ---------------------------------- */

export type Study = { id: string; title: string; what: string; link: string }

/** Studies from NASA's Open Science Data Repository, in plain words. */
export const OSDR_STUDIES: Record<'peppers' | 'muscle' | 'roots' | 'mice30', Study> = {
  peppers: {
    id: 'OSD-772',
    title: 'PH-04 Chile Peppers in Space',
    what: 'Astronauts grew chile peppers in the Advanced Plant Habitat on the ISS for 137 days, one of the longest plant experiments there, and harvested 26 peppers.',
    link: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-772',
  },
  muscle: {
    id: 'OSD-342',
    title: 'Targeting myostatin/activin A protects against skeletal muscle and bone loss during spaceflight',
    what: 'Mice that spent 33 days on the ISS lost a lot of muscle and bone, because floating in microgravity means muscles and bones barely work.',
    link: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-342',
  },
  roots: {
    id: 'OSD-615',
    title: 'Advanced Plant EXperiment (APEX) 03-1: Arabidopsis roots in spaceflight',
    what: 'Small plants grown in the Veggie garden on the ISS changed how their roots build their cell walls: plants feel microgravity and adapt to it.',
    link: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-615',
  },
  mice30: {
    id: 'OSD-111',
    title: 'Microgravity sensitive key genes in muscles of 30 days space flown mice',
    what: 'After 30 days in orbit on the BION-M1 satellite, mice muscles had started to shrink, which is why astronauts exercise about two hours a day.',
    link: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-111',
  },
}

/* -------------------------------- sources -------------------------------- */

export type Source = { name: string; by: string; link: string; use: string }

/** Every dataset the game uses, for the credits in the guide and on the website. */
export const SOURCES: Source[] = [
  {
    name: 'DONKI: Space Weather Database Of Notifications, Knowledge, Information',
    by: 'NASA CCMC',
    link: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/',
    use: 'Every solar flare in the game is a real one. The game asks DONKI for the last 30 days of flares (live); if it can’t, it replays 34 real X-class flares from 2024 (archived).',
  },
  {
    name: 'RadLab: OSDR Radiation Dosimetry Database',
    by: 'NASA OSDR',
    link: 'https://visualization.osdr.nasa.gov/radlab/gui/data-api/',
    use: 'Real radiation readings from the Curiosity rover on Mars (2015–2024), including the solar storm of 20 May 2024. Archived.',
  },
  {
    name: 'OSDR: Open Science Data Repository',
    by: 'NASA',
    link: 'https://osdr.nasa.gov/bio/repo/',
    use: 'Real space-biology studies: peppers grown on the ISS (OSD-772), plant roots in space (OSD-615), muscle and bone loss in microgravity (OSD-342, OSD-111). Archived.',
  },
  {
    name: 'Mars Trek',
    by: 'NASA',
    link: 'https://trek.nasa.gov/mars/',
    use: 'The Viking colour map of Mars in the guide, with the landing site. Archived.',
  },
  {
    name: 'Food production on the Moon and in remote areas',
    by: 'Canadian Space Agency',
    link: 'https://www.asc-csa.gc.ca/eng/youth-educators/toolkits/food-production/',
    use: 'Activities to try after playing, like Tomatosphere and the Deep Space Food Challenge.',
  },
]
