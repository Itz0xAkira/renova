/** The grid explanations: which node powers a spot, and whether a new pylon's cable reaches. */
import { CORE_LINK, CORE_REACH, PYLON_LINK, PYLON_REACH } from '@/game/core/data'
import { CORE_CENTRE } from '@/game/core/sim'
import { c, check, clean, must } from './helpers'

const s = clean()
// inside the core's area (CORE_REACH tiles out from the 3×3 footprint)
check(s.gridSource('solar', c + 3 + CORE_REACH - 2, c)?.kind === 'core', 'a spot inside the core’s area is powered by the core')
// a footprint with just one tile inside still counts
check(s.gridSource('solar', c + 3 + CORE_REACH - 1, c)?.kind === 'core', 'one tile inside the area is enough')
check(s.gridSource('solar', c + 3 + CORE_REACH, c) === null, 'just outside the core’s area is unpowered')

// a pylon within cable reach of the core links to it; one beyond doesn't, and says how far off it is
const near = s.pylonLink(CORE_CENTRE + CORE_LINK - 1, CORE_CENTRE)
check(near.via?.kind === 'core', 'a pylon within the core’s cable reach links to it')
const far = s.pylonLink(CORE_CENTRE + CORE_LINK + 3, CORE_CENTRE)
check(far.via === null && far.near?.kind === 'core' && Math.round(far.dist - far.reach) === 3, `far pylon: ${JSON.stringify({ d: far.dist, r: far.reach })}`)

// chain a pylon out: then its own area powers buildings further away, and the next pylon can link to it
must(s.place('pylon', CORE_CENTRE + CORE_LINK - 1, CORE_CENTRE, 0), 'pylon')
s.ensureGrid()
const p = s.entAt(CORE_CENTRE + CORE_LINK - 1, CORE_CENTRE)!
check(p.onGrid, 'chained pylon is on the grid')
const beyond = CORE_CENTRE + CORE_LINK - 1 + PYLON_REACH[0]
check(s.gridSource('battery', beyond - 1, CORE_CENTRE)?.id === p.id, 'a building in the pylon’s area is powered by the pylon')
check(s.pylonLink(CORE_CENTRE + CORE_LINK - 1 + PYLON_LINK[0], CORE_CENTRE).via?.id === p.id, 'the next pylon links to the chained one')
console.log('OK grid help: area and cable reach explained correctly')
