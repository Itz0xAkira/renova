/**
 * Where Earth and Mars are on any date, and how long a radio signal takes between
 * them. Uses NASA JPL's "Approximate Positions of the Planets" (E. M. Standish,
 * Table 1: Keplerian elements valid 1800–2050), which is accurate to well under a
 * percent of the distance: plenty for a light-travel time in minutes.
 * https://ssd.jpl.nasa.gov/planets/approx_pos.html
 */

type Elements = { a: [number, number]; e: [number, number]; I: [number, number]; L: [number, number]; peri: [number, number]; node: [number, number] }

/** [value at J2000, change per Julian century]; angles in degrees, a in AU. */
const EARTH: Elements = {
  a: [1.00000261, 0.00000562],
  e: [0.01671123, -0.00004392],
  I: [-0.00001531, -0.01294668],
  L: [100.46457166, 35999.37244981],
  peri: [102.93768193, 0.32327364],
  node: [0.0, 0.0],
}
const MARS: Elements = {
  a: [1.52371034, 0.00001847],
  e: [0.0933941, 0.00007882],
  I: [1.84969142, -0.00813131],
  L: [-4.55343205, 19140.30268499],
  peri: [-23.94362959, 0.44441088],
  node: [49.55953891, -0.29257343],
}

const RAD = Math.PI / 180
const AU_KM = 149597870.7
const LIGHT_KM_S = 299792.458

/** Heliocentric ecliptic position (AU) of a planet at Julian centuries T past J2000. */
function position(el: Elements, T: number): [number, number, number] {
  const at = (k: keyof Elements) => el[k][0] + el[k][1] * T
  const a = at('a')
  const e = at('e')
  const I = at('I') * RAD
  const node = at('node') * RAD
  const peri = at('peri') * RAD
  const w = peri - node
  let M = (at('L') - at('peri')) * RAD
  M = ((M + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI
  // Kepler's equation, by Newton's method
  let E = M + e * Math.sin(M)
  for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E))
  const xp = a * (Math.cos(E) - e)
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E)
  const cw = Math.cos(w)
  const sw = Math.sin(w)
  const cn = Math.cos(node)
  const sn = Math.sin(node)
  const ci = Math.cos(I)
  const si = Math.sin(I)
  return [(cw * cn - sw * sn * ci) * xp + (-sw * cn - cw * sn * ci) * yp, (cw * sn + sw * cn * ci) * xp + (-sw * sn + cw * cn * ci) * yp, sw * si * xp + cw * si * yp]
}

const centuries = (date: Date) => (date.getTime() / 86400000 + 2440587.5 - 2451545.0) / 36525

/** Earth–Mars distance in km on a date. */
export function earthMarsKm(date: Date) {
  const T = centuries(date)
  const p = position(EARTH, T)
  const q = position(MARS, T)
  return Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) * AU_KM
}

/** One-way light time between Earth and Mars on a date, in minutes (about 3 to 22). */
export function lightMinutes(date: Date) {
  return earthMarsKm(date) / LIGHT_KM_S / 60
}

/**
 * Is Mars nearly behind the Sun as seen from Earth (solar conjunction)? Missions stop
 * sending commands then, because the Sun scrambles radio signals. Returns the Sun–Earth–Mars
 * angle in degrees too.
 */
export function sunAngle(date: Date) {
  const T = centuries(date)
  const p = position(EARTH, T)
  const q = position(MARS, T)
  const toSun = [-p[0], -p[1], -p[2]]
  const toMars = [q[0] - p[0], q[1] - p[1], q[2] - p[2]]
  const dot = toSun[0] * toMars[0] + toSun[1] * toMars[1] + toSun[2] * toMars[2]
  return Math.acos(Math.max(-1, Math.min(1, dot / (Math.hypot(...toSun) * Math.hypot(...toMars))))) / RAD
}
