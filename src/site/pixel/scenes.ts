import type { Cell, CellType, Obj, Scene, Terrain } from './engine'

function terrain(
  cols: number,
  rows: number,
  exists: (i: number, j: number) => boolean,
  elev: (i: number, j: number) => number,
  type: (i: number, j: number) => CellType,
): Terrain {
  const cells: (Cell | null)[] = []
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) cells.push(exists(i, j) ? { e: elev(i, j), t: type(i, j) } : null)
  return { cols, rows, cells }
}

/** The RENOVA mesa: a 10×10 plateau with a raised ridge at the back. */
export const MESA = terrain(
  10,
  10,
  (i, j) => !(i + j < 2 || i + j > 16 || i - j > 7 || j - i > 7 || (i === 9 && j === 7) || (i === 6 && j === 9)),
  (i, j) => (i + j === 2 ? 10 : i + j === 3 ? 5 : i === 9 && (j === 2 || j === 3) ? 6 : 0),
  (i, j) => {
    if (i === 2 && j === 2) return 'pad'
    if ((i === 8 && j === 7) || (i === 2 && j === 8)) return 'crater'
    if ((j === 4 && i >= 1 && i <= 8) || (i === 4 && j >= 1 && j <= 8)) return 'road'
    return 'sand'
  },
)

const o = (k: Obj['k'], i: number, j: number, extra: Partial<Obj> = {}): Obj => ({ k, i, j, ...extra })

export const WORLD: Scene = {
  terrain: MESA,
  objs: [
    o('rocket', 2, 2),
    o('hab', 3, 3),
    o('hab', 5, 3),
    o('wrs', 6, 2),
    o('drill', 7, 1),
    o('tank', 8, 2, { level: 0.75 }),
    o('gh', 3, 5),
    o('shield', 5, 5),
    o('gh', 6, 5),
    o('gh', 7, 5),
    o('pv', 1, 6),
    o('pv', 2, 6),
    o('pv', 1, 7),
    o('pv', 2, 7),
    o('dish', 6, 7),
    o('boulder', 9, 4),
    o('boulder', 3, 8),
    o('boulder', 0, 4),
  ],
  paths: [
    { kind: 'rover', pts: [[1, 4], [8, 4]], speed: 0.5 },
    { kind: 'walker', pts: [[4, 2], [4, 7]], speed: 0.32 },
    { kind: 'walker', pts: [[5, 4], [7, 4], [7, 3]], speed: 0.25, offset: 1.2 },
  ],
}

/** Starting state for the playable demo: only the lander and rocks. */
export const GAME_BASE: Obj[] = [o('rocket', 2, 2), o('boulder', 9, 4), o('boulder', 3, 8), o('boulder', 0, 4)]
export const GAME_PATHS = [{ kind: 'rover' as const, pts: [[1, 4], [8, 4]] as [number, number][], speed: 0.5 }]

export const OUTPOST = terrain(
  6,
  6,
  (i, j) => !(i + j < 1 || i + j > 9 || Math.abs(i - j) > 4),
  (i, j) => (i + j === 1 ? 6 : 0),
  (i, j) => (i === 4 && j === 4 ? 'crater' : 'sand'),
)

/** The quick-mission outpost reacts to the visitor's choice. */
export function outpostScene(choice: number | null, at: number): Scene {
  const level = choice === null ? 0.18 : [0.46, 0.3, 0.24][choice]
  const objs: Obj[] = [
    o('pv', 1, 1),
    o('pv', 0, 2),
    o('tank', 3, 1, { level, levelFrom: 0.18, levelAt: at, alert: choice === null || choice === 2 }),
    o('hab', 2, 2),
    o('gh', 1, 3, { dim: choice === 1 }),
    o('boulder', 0, 4),
  ]
  if (choice === 0) objs.push(o('wrs', 3, 3, { born: at }))
  if (choice === 2) objs.push(o('tank', 4, 2, { level: 0.55, born: at }))
  return {
    terrain: OUTPOST,
    objs,
    paths: [{ kind: 'walker', pts: [[2, 3], [3, 3], [3, 2]], speed: 0.3 }],
  }
}
