import { Sim, CORE_AT as c, TRACK_WEAR, ROAD_WEAR } from '@/game/core/sim'
const s = new Sim(7)
const i = c + 3
const j = c + 3
for (let n = 0; n < TRACK_WEAR; n++) s.addWear(i, j)
if (s.roadLevel(i, j) !== 1) throw new Error('should be tracks')
const rev = s.roadRev
for (let n = TRACK_WEAR; n < ROAD_WEAR; n++) s.addWear(i, j)
if (s.roadLevel(i, j) !== 2 || s.roadRev === rev) throw new Error('should be a road')
if (s.newRoads.length !== 1) throw new Error('road should be queued for paving')
if (!s.messages.some((m) => m.text.includes('road'))) throw new Error('first road should be announced')
const back = Sim.load(JSON.parse(JSON.stringify(s.save())))
if (back.roadLevel(i, j) !== 2) throw new Error('roads must survive save/load')
console.log('OK roads: tracks at', TRACK_WEAR, 'road at', ROAD_WEAR, 'saved', s.save().wear?.length, 'tile(s)')
