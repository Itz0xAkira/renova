/**
 * RENOVA building art, in the industrial style of the reference sheet:
 * gunmetal plating, rust-orange armour, glowing cyan glass, hazard-yellow
 * signals, every building standing on a dark cross-braced steel plinth.
 * The drawings live in ./buildings, one file per group; this file gathers them.
 *
 * Belt docks, output chutes, drone pads and rover bays are drawn by the scene
 * from the live layout, not baked in here.
 */
export { line, upgradeKit } from '@/game/art/buildings/kit'
export { excavator, iceDrill } from '@/game/art/buildings/extract'
export { bigKiln, bigSmelter, bigWasher, melter } from '@/game/art/buildings/process'
export { berm, bigGreenhouse, bigHabitat, moxie } from '@/game/art/buildings/life'
export { battery, bigReactor, pylon, PYLON_TOP, solarArray } from '@/game/art/buildings/power'
export { bigLab, coreBuilding, rocket } from '@/game/art/buildings/base'
