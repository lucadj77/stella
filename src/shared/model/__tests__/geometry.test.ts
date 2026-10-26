import { describe, expect, it } from 'vitest'
import {
  shapeFrame,
  lineEnds,
  lineFromEnds,
  constrainAxis,
  HEXAGON_RATIO,
  hexagonFit,
  hexagonPoints,
  anchorPoint,
  hitTest,
  normalizeAngle,
  polygonVertices,
  resizeWithHandle,
  rotateAround,
  roundedPolygonPath,
  type Point
} from '../geometry'
import type { ShapeLayer } from '../template'
import { normalizeLayer } from '../normalize'

const rect = normalizeLayer({ type: 'shape', name: 'r', x: 10, y: 10, w: 20, h: 10 }, 0)

const close = (a: number, b: number): void => expect(a).toBeCloseTo(b, 6)

describe('geometria', () => {
  it('colpisce i livelli tenendo conto della rotazione', () => {
    expect(hitTest(rect, { x: 12, y: 12 })).toBe(true)
    expect(hitTest(rect, { x: 20, y: 22 })).toBe(false)
    const rotated = { ...rect, rotation: 90 }
    // ruotato di 90° intorno al centro (20, 15): diventa alto 20 e largo 10
    expect(hitTest(rotated, { x: 20, y: 22 })).toBe(true)
    expect(hitTest(rotated, { x: 12, y: 15 })).toBe(false)
  })

  it('ridimensiona dal lato tenendo fermo quello opposto', () => {
    expect(resizeWithHandle(rect, 'e', { x: 40, y: 0 })).toEqual({ x: 10, y: 10, w: 30, h: 10 })
    expect(resizeWithHandle(rect, 'nw', { x: 5.2, y: 4.9 }, { step: 0.5 })).toEqual({
      x: 5,
      y: 5,
      w: 25,
      h: 15
    })
    const kept = resizeWithHandle(rect, 'se', { x: 50, y: 21 }, { keepRatio: true })
    expect(kept.w / kept.h).toBeCloseTo(2)
  })

  it("con le proporzioni bloccate un lato trascina anche l'altra misura, centrata", () => {
    expect(resizeWithHandle(rect, 'e', { x: 50, y: 0 }, { keepRatio: true })).toEqual({
      x: 10,
      y: 5,
      w: 40,
      h: 20
    })
    expect(resizeWithHandle(rect, 'n', { x: 0, y: 5 }, { keepRatio: true })).toEqual({
      x: 5,
      y: 5,
      w: 30,
      h: 15
    })
  })

  it('con il livello ruotato il lato opposto resta fermo sulla carta', () => {
    const r = { ...rect, rotation: 30 }
    const fixedBefore = rotateAround({ x: r.x, y: r.y + r.h / 2 }, anchorPoint(r), r.rotation)
    const b = resizeWithHandle(r, 'e', { x: 45, y: 15 })
    const after = { ...r, ...b }
    const fixedAfter = rotateAround(
      { x: after.x, y: after.y + after.h / 2 },
      anchorPoint(after),
      r.rotation
    )
    close(fixedAfter.x, fixedBefore.x)
    close(fixedAfter.y, fixedBefore.y)
    close(b.w, 35)
  })

  it('normalizza gli angoli', () => {
    expect(normalizeAngle(190)).toBe(-170)
    expect(normalizeAngle(-180)).toBe(180)
    expect(normalizeAngle(45)).toBe(45)
  })
})

describe('roundedPolygonPath', () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 }
  ]
  it('senza raggio disegna angoli vivi', () => {
    expect(roundedPolygonPath(square, 0)).toBe('M0,0 L10,0 L10,10 L0,10 Z')
  })
  it('arrotonda gli angoli del quadrato come un rettangolo con raggio', () => {
    const d = roundedPolygonPath(square, 2)
    expect(d.startsWith('M0,2 A2,2 0 0 1 2,0 L8,0 A2,2 0 0 1 10,2')).toBe(true)
  })
  it('riduce il raggio se i lati sono troppo corti', () => {
    expect(roundedPolygonPath(square, 20)).toContain('A5,5')
  })
  it("negli angoli interni della stella l'arco gira al contrario", () => {
    const star = polygonVertices(
      normalizeLayer(
        { type: 'shape', shape: 'star', name: 's', sides: 5, innerRatio: 0.5, w: 20, h: 20 },
        0
      ) as ShapeLayer
    )
    const sweeps = [...roundedPolygonPath(star, 1).matchAll(/A[\d.]+,[\d.]+ 0 0 (\d)/g)].map(
      (m) => m[1]
    )
    expect(sweeps).toEqual(['1', '0', '1', '0', '1', '0', '1', '0', '1', '0'])
  })
})

describe('esagono della carta', () => {
  const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y)
  it('è regolare: sei lati uguali, in qualunque riquadro', () => {
    for (const [w, h] of [
      [40, 30],
      [30, 40],
      [63, 88],
      [50, 50]
    ]) {
      const pts = hexagonPoints(0, 0, w, h)
      expect(pts).toHaveLength(6)
      const sides = pts.map((p, i) => dist(p, pts[(i + 1) % 6]))
      for (const s of sides) expect(s).toBeCloseTo(sides[0], 6)
      // diagonali lunghe uguali: angoli tutti di 120°
      expect(dist(pts[0], pts[3])).toBeCloseTo(2 * sides[0], 6)
      expect(dist(pts[1], pts[4])).toBeCloseTo(2 * sides[0], 6)
      for (const p of pts) {
        expect(p.x).toBeGreaterThanOrEqual(-1e-9)
        expect(p.x).toBeLessThanOrEqual(w + 1e-9)
        expect(p.y).toBeGreaterThanOrEqual(-1e-9)
        expect(p.y).toBeLessThanOrEqual(h + 1e-9)
      }
    }
  })

  it('lati piatti in alto se è più largo, punte se è più alto; riempie le misure adatte', () => {
    expect(hexagonPoints(0, 0, 40, 30)[0].y).toBe(hexagonPoints(0, 0, 40, 30)[1].y)
    expect(hexagonPoints(0, 0, 30, 40)[0].x).toBe(15)
    const fit = hexagonFit(60, 40)
    expect(fit).toEqual({ w: 60, h: 52 })
    expect(hexagonFit(40, 60)).toEqual({ w: 52, h: 60 })
    const pts = hexagonPoints(0, 0, 60, 60 * HEXAGON_RATIO)
    expect(pts[5].x).toBeCloseTo(0, 9)
    expect(pts[0].y).toBeCloseTo(0, 9)
  })
})

describe('linea da A a B', () => {
  it('ricava posizione, lunghezza e angolo dagli estremi e viceversa', () => {
    const l = normalizeLayer({ type: 'shape', shape: 'line', x: 0, y: 0, w: 10, h: 0 }, 0)
    const A = { x: 10, y: 20 }
    const B = { x: 40, y: 60 }
    const placed = { ...l, ...lineFromEnds(l, A, B) }
    expect(placed.w).toBeCloseTo(50)
    const [a, b] = lineEnds(placed)
    expect(a.x).toBeCloseTo(10)
    expect(a.y).toBeCloseTo(20)
    expect(b.x).toBeCloseTo(40)
    expect(b.y).toBeCloseTo(60)
    // con l'ancoraggio in alto a sinistra gli estremi restano gli stessi
    const corner = { ...l, anchor: 'top-left' as const, h: 4 }
    const [c, d] = lineEnds({ ...corner, ...lineFromEnds(corner, A, B) })
    expect([c.x, c.y, d.x, d.y].map((v) => Math.round(v * 1000) / 1000)).toEqual([10, 20, 40, 60])
  })
})

describe('modificatori del trascinamento', () => {
  it('Maiuscolo: l asse più vicino tra orizzontale, verticale e 45°', () => {
    expect(constrainAxis(10, 2)).toBe('x')
    expect(constrainAxis(-1, 9)).toBe('y')
    expect(constrainAxis(5, -6)).toBe('diagonal')
    expect(constrainAxis(0, 0)).toBe(null)
  })

  it('dal centro: il lato opposto si muove in modo simmetrico', () => {
    const l = { x: 10, y: 10, w: 20, h: 10, rotation: 0 }
    expect(resizeWithHandle(l as never, 'e', { x: 35, y: 0 }, { fromCenter: true })).toEqual({
      x: 5,
      y: 10,
      w: 30,
      h: 10
    })
    // angolo con le proporzioni: si allarga attorno al centro
    expect(
      resizeWithHandle(l as never, 'se', { x: 40, y: 15 }, { fromCenter: true, keepRatio: true })
    ).toEqual({ x: 0, y: 5, w: 40, h: 20 })
  })
})

describe('forma della carta girata', () => {
  it('senza rotazione né specchi non trasforma', () => {
    expect(shapeFrame({}, 0, 0, 50, 43.3)).toEqual({ x: 0, y: 0, w: 50, h: 43.3 })
  })

  it('un quarto di giro disegna nel riquadro con i lati scambiati e lo gira', () => {
    const f = shapeFrame({ shapeRotation: 90 }, 0, 0, 43.3, 50)
    expect([f.w, f.h]).toEqual([50, 43.3])
    expect(f.transform).toBe('translate(21.65 25) rotate(90) translate(-25 -21.65)')
  })

  it('gli specchi vengono dopo la rotazione', () => {
    const f = shapeFrame({ shapeRotation: 180, shapeFlipH: true }, 1, 1, 40, 60)
    expect([f.w, f.h]).toEqual([40, 60])
    expect(f.transform).toBe('translate(21 31) scale(-1 1) rotate(180) translate(-20 -30)')
  })
})
