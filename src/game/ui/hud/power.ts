/**
 * Power explained in words, for the cursor hint, the inspector and the power panel.
 * The grid has two ranges, and every message names the one that matters:
 *  - the AREA a node powers: a square reaching N tiles out from the core or a pylon.
 *    Any building with a tile inside a connected node's area is on the grid.
 *  - the CABLE reach: a pylon joins the grid only if a cable reaches it from the core or
 *    a connected pylon (centre to centre, the longer of the two reaches).
 */
import { BUILDINGS, PYLON_REACH, SOLAR_KW, UPGRADES, type Kind } from '@/game/core/data'
import { needsGrid, RESERVE_KJ, type Ent, type Sim } from '@/game/core/sim'

export type PowerHint = { ok: boolean; text: string }

/** "the core", or "a power pylon" / "a power tower" / "a substation". */
export function nodeName(n: Ent) {
  if (n.kind === 'core') return 'the core'
  const name = UPGRADES.pylon!.names[n.level - 1].toLowerCase()
  return `${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name}`
}

const tiles = (n: number) => `${Math.round(n)} tile${Math.round(n) === 1 ? '' : 's'}`

/** Would a `kind` built at (i, j) get power, and why (not)? Null for things that don't use the grid. */
export function placeHint(sim: Sim, kind: Kind, i: number, j: number): PowerHint | null {
  if (!needsGrid(kind)) return null
  if (kind === 'pylon') {
    const l = sim.pylonLink(i, j)
    if (l.via) return { ok: true, text: `Cable to ${nodeName(l.via)} (${tiles(l.dist)} away) · powers ${tiles(PYLON_REACH[0])} all round` }
    const short = Math.ceil(l.dist - l.reach)
    return { ok: false, text: `Out of cable reach: ${tiles(l.dist)} from ${l.near ? nodeName(l.near) : 'the grid'}, cables reach ${tiles(l.reach)}. Move it ${tiles(short)} closer.` }
  }
  const def = BUILDINGS[kind]
  const src = sim.gridSource(kind, i, j)
  const what = def.gen ? ` · makes up to ${kind === 'solar' ? SOLAR_KW[0] : def.gen} kW` : def.power > 0 ? ` · uses ${def.power} kW` : ''
  if (src) return { ok: true, text: `Powered by ${nodeName(src)}${what}` }
  return { ok: false, text: 'No power here: no blue area reaches it. Build it in the blue, or put a pylon nearby.' }
}

/** Why a built building is or isn't on the grid. Null for things that don't use it. */
export function gridHint(sim: Sim, e: Ent): PowerHint | null {
  if (!needsGrid(e.kind) || e.kind === 'core') return null
  if (e.kind === 'pylon') {
    if (e.onGrid) {
      const link = sim.links.find(([a, b]) => a === e.id || b === e.id)
      const other = link ? sim.ents.get(link[0] === e.id ? link[1] : link[0]) : null
      return { ok: true, text: `Connected by cable${other ? ` to ${nodeName(other)}` : ''}` }
    }
    const l = sim.pylonLink(e.i, e.j)
    return { ok: false, text: `Out of cable reach: ${tiles(l.dist)} from ${l.near ? nodeName(l.near) : 'the grid'}, cables reach ${tiles(l.reach)}. Build a pylon in between.` }
  }
  const src = sim.gridSource(e.kind, e.i, e.j)
  if (src) return { ok: true, text: `Connected through ${nodeName(src)}` }
  return { ok: false, text: 'Not connected: no pylon’s area reaches it. Build a pylon within reach of the grid, close to it.' }
}

/** One plain sentence on how the grid is doing right now. */
export function gridSummary(sim: Sim): { tone: 'good' | 'warn' | 'bad'; text: string } {
  const P = sim.power
  const net = P.gen - P.demand
  const offGrid = [...sim.ents.values()].filter((e) => e.status === 'nogrid').length
  const off = offGrid ? ` ${offGrid} building${offGrid === 1 ? ' isn’t' : 's aren’t'} connected to the grid.` : ''
  if (P.demand < 0.5 && P.gen < 0.5) return { tone: offGrid ? 'warn' : 'good', text: `Nothing is using or making power yet.${off}` }
  if (P.lifeSat < 0.99) return { tone: 'bad', text: `Blackout: not even life support is fully powered. Build solar panels or batteries now.${off}` }
  if (P.indSat < 0.99) return { tone: 'warn', text: `Not enough power: life support comes first, so the factories are running at ${Math.round(P.indSat * 100)}%.${off}` }
  if (net < -0.5 && P.discharge > 0.5) {
    const secs = P.stored / Math.max(0.01, P.discharge)
    return { tone: 'warn', text: `Running on batteries: ${Math.round(P.discharge)} kW more is used than made. They’ll last about ${fmtTime(secs)}.${off}` }
  }
  if (net > 0.5 && P.stored < P.cap + RESERVE_KJ - 1) return { tone: 'good', text: `Making ${Math.round(net)} kW more than you use: the batteries are charging.${off}` }
  return { tone: offGrid ? 'warn' : 'good', text: `All powered: making ${Math.round(P.gen)} kW, using ${Math.round(P.demand)} kW.${off}` }
}

/** Game seconds as "45 s" or "2 min" (a sol is 120 s). */
export function fmtTime(secs: number) {
  if (!Number.isFinite(secs)) return 'a long time'
  return secs < 90 ? `${Math.max(1, Math.round(secs))} s` : `${Math.round(secs / 60)} min`
}
