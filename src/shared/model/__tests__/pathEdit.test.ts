import { describe, expect, it } from 'vitest'
import {
  insertPathPoint,
  layerSegments,
  movePathPoint,
  parseSegments,
  pathHandles,
  removePathPoint,
  segmentsToPath,
  shapeAsPath,
  withSegments
} from '../pathEdit'
import { normalizeLayer } from '../normalize'
import { anchorPoint, rotateAround } from '../geometry'
import type { ShapeLayer } from '../template'

const shape = (props: Record<string, unknown>): ShapeLayer =>
  normalizeLayer({ type: 'shape', name: 's', ...props }, 0) as ShapeLayer

describe('modifica dei punti', () => {
  it('legge un tracciato come segmenti assoluti', () => {
    const segs = parseSegments('m1 1 h2 v2 l-2 0 z')
    expect(segs.map((s) => s.c)).toEqual(['M', 'L', 'L', 'L', 'Z'])
    expect(segs[2].pts[0]).toEqual({ x: 3, y: 3 })
    expect(segmentsToPath(segs)).toBe('M1,1 L3,1 L3,3 L1,3 Z')
  })

  it('un rettangolo ha quattro punti; un’ellisse quattro punti e otto controlli', () => {
    const r = shape({ x: 0, y: 0, w: 10, h: 10, shape: 'rect' })
    expect(pathHandles(parseSegments(shapeAsPath(r))).length).toBe(4)
    const e = shape({ x: 0, y: 0, w: 10, h: 10, shape: 'ellipse' })
    const hs = pathHandles(parseSegments(shapeAsPath(e)))
    expect(hs.filter((h) => h.kind === 'anchor').length).toBe(4)
    expect(hs.filter((h) => h.kind === 'control').length).toBe(8)
  })

  it('spostando un punto il riquadro si adatta', () => {
    const r = { ...shape({ x: 10, y: 10, w: 10, h: 10 }), shape: 'path' as const }
    const p = { ...r, path: shapeAsPath({ ...r, shape: 'rect' }) }
    // il punto in basso a destra (segmento 2) va a 30, 25
    const segs = movePathPoint(layerSegments(p), 2, 0, { x: 30, y: 25 })
    const out = withSegments(p, segs)
    expect(out).toMatchObject({ x: 10, y: 10, w: 20, h: 15 })
    expect(layerSegments(out)[2].pts[0]).toEqual({ x: 30, y: 25 })
  })

  it('con la rotazione i punti restano dove sono sulla carta', () => {
    const p = { ...shape({ x: 0, y: 0, w: 10, h: 10, rotation: 30 }), shape: 'path' as const }
    const base = { ...p, path: 'M0,0 L1,0 L1,1 L0,1 Z' }
    const world = (l: ShapeLayer, i: number): { x: number; y: number } =>
      rotateAround(layerSegments(l)[i].pts[0], anchorPoint(l), l.rotation)
    const before = world(base, 0)
    const out = withSegments(base, movePathPoint(layerSegments(base), 2, 0, { x: 20, y: 15 }))
    const after = world(out, 0)
    expect(after.x).toBeCloseTo(before.x, 2)
    expect(after.y).toBeCloseTo(before.y, 2)
  })

  it('il punto di partenza di un tracciato chiuso trascina anche l’ultimo arrivo', () => {
    const segs = parseSegments('M0,0 L10,0 L10,10 L0,0 Z')
    expect(pathHandles(segs).length).toBe(3)
    const moved = movePathPoint(segs, 0, 0, { x: 2, y: 2 })
    expect(moved[3].pts[0]).toEqual({ x: 2, y: 2 })
  })

  it('un punto di una curva si porta dietro i controlli vicini', () => {
    const segs = parseSegments('M0,0 C0,5 5,10 10,10 C15,10 20,5 20,0')
    const moved = movePathPoint(segs, 1, 2, { x: 10, y: 12 })
    expect(moved[1].pts[1]).toEqual({ x: 5, y: 12 })
    expect(moved[2].pts[0]).toEqual({ x: 15, y: 12 })
  })

  it('aggiunge e toglie punti', () => {
    const segs = parseSegments('M0,0 L10,0 L10,10 L0,10 Z')
    const more = insertPathPoint(segs, { x: 5, y: 0.2 }, 1)!
    expect(more.filter((s) => s.c === 'L').length).toBe(4)
    expect(more[1].pts[0].x).toBeCloseTo(5, 0)
    expect(insertPathPoint(segs, { x: 5, y: 5 }, 1)).toBeNull()
    const fewer = removePathPoint(more, 1)
    expect(segmentsToPath(fewer)).toBe(segmentsToPath(segs))
    // un triangolo non scende sotto i tre punti
    const tri = parseSegments('M0,0 L10,0 L5,5 Z')
    expect(removePathPoint(tri, 1)).toBe(tri)
  })

  it('divide una curva senza cambiarne la forma', () => {
    const segs = parseSegments('M0,0 C0,10 10,10 10,0')
    const split = insertPathPoint(segs, { x: 5, y: 7.5 }, 0.5)!
    expect(split.map((s) => s.c)).toEqual(['M', 'C', 'C'])
    expect(split[1].pts[2].x).toBeCloseTo(5, 1)
    expect(split[1].pts[2].y).toBeCloseTo(7.5, 1)
  })
})
