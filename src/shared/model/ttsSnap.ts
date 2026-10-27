import { arrangeGroup } from './arrange'
import { anchorPoint, rotateAround, type Point } from './geometry'
import { gridGeometry } from './grid'
import type { Layer } from './template'

// Snap point e tag di Tabletop Simulator. Un livello con `snap` dà un punto al suo centro (una
// griglia uno per casella); i livelli di tipo snap sono solo questo. Le posizioni sono in mm
// sulla carta, con le rotazioni del livello e dei gruppi che lo contengono.

export interface SnapPoint {
  /** Centro in mm dall'angolo in alto a sinistra della carta */
  x: number
  y: number
  /** Rotazione data all'oggetto che si aggancia, in gradi in senso orario; null: nessuna */
  angle: number | null
  tags: string[]
}

/** "legno, Pietra,legno" → ["legno", "Pietra"]: separati da virgole, senza vuoti né doppi */
export function parseTags(s: string | undefined | null): string[] {
  const out: string[] = []
  for (const part of (s ?? '').split(',')) {
    const tag = part.trim()
    if (tag && !out.includes(tag)) out.push(tag)
  }
  return out
}

const round = (v: number): number => Math.round(v * 1000) / 1000

/** Angolo tra 0 e 360 */
const norm = (deg: number): number => round(((deg % 360) + 360) % 360)

/**
 * Gli snap point dei livelli di una faccia, già legati ai dati della carta. Anche quelli del
 * gruppo che una griglia ripete: uno per casella, spostato come la casella.
 */
export function snapPoints(layers: Layer[]): SnapPoint[] {
  const out: SnapPoint[] = []
  /** `toCard` porta un punto del livello sulla carta con le rotazioni dei contenitori */
  const visit = (list: Layer[], toCard: (p: Point) => Point, turn: number): void => {
    for (const l of list) {
      if (!l.visible) continue
      // il punto sulla carta: rotazione del livello, poi dei gruppi dal più interno
      const place = (p: Point): Point => toCard(rotateAround(p, anchorPoint(l), l.rotation))
      if (l.type === 'group') visit(arrangeGroup(l).children, place, turn + l.rotation)
      if (l.type === 'grid' && l.cells?.length) {
        const { centers } = gridGeometry(l)
        l.cells.forEach((cell, i) => {
          const c = centers[i]
          if (!c) return
          const dx = c.x - centers[0].x
          const dy = c.y - centers[0].y
          visit([cell], (p) => place({ x: p.x + dx, y: p.y + dy }), turn + l.rotation)
        })
      }
      if (!l.snap || l.type === 'value') continue
      const angle = l.snap.rotated ? norm(l.snap.angle ?? turn + l.rotation) : null
      const tags = parseTags(l.snap.tags)
      const centers =
        l.type === 'grid'
          ? gridGeometry(l).centers.map((c) => ({ x: l.x + c.x, y: l.y + c.y }))
          : [{ x: l.x + l.w / 2, y: l.y + l.h / 2 }]
      for (const c of centers) {
        const p = place(c)
        out.push({ x: round(p.x), y: round(p.y), angle, tags })
      }
    }
  }
  visit(layers, (p) => p, 0)
  return out
}
