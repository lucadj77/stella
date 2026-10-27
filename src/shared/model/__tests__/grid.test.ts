import { describe, expect, it } from 'vitest'
import { gridGeometry, placeCellPath, type GridSpec } from '../grid'

const base: GridSpec = {
  w: 50,
  h: 40,
  cell: 'square',
  rows: 4,
  columns: 5,
  cellRatio: 1,
  orientation: 'pointy',
  interlock: false,
  gap: 0,
  padding: 0,
  zoom: 1,
  alignX: 'center',
  alignY: 'center',
  radius: 0
}

/** Numeri di un tracciato, a coppie x y */
const points = (d: string): number[][] => {
  const v = d.match(/-?\d+(\.\d+)?/g)!.map(Number)
  const out: number[][] = []
  for (let i = 0; i + 1 < v.length; i += 2) out.push([v[i], v[i + 1]])
  return out
}

describe('griglia', () => {
  it('a zoom 1 (100%) riempie il riquadro senza deformare le caselle', () => {
    const g = gridGeometry(base)
    expect(g.cells).toHaveLength(20)
    // 5 colonne in 50 mm, 4 righe in 40: caselle da 10
    expect(g.bounds).toEqual({ x: 0, y: 0, w: 50, h: 40 })
    expect(points(g.cells[0])).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10]
    ])
  })

  it('lo spazio tra le caselle e il margine restano in mm', () => {
    const g = gridGeometry({ ...base, w: 100, gap: 2, padding: 1 })
    // l'altezza comanda: 40 = 2·1 + 4 s + 3·2 → s = 8
    expect(g.bounds.h).toBeCloseTo(40)
    expect(g.bounds.w).toBeCloseTo(2 + 5 * 8 + 4 * 2)
    expect(g.bounds.x).toBeCloseTo((100 - 50) / 2)
    expect(points(g.cells[1])[0][0] - points(g.cells[0])[0][0]).toBeCloseTo(10)
  })

  it('zoom e allineamento', () => {
    const g = gridGeometry({ ...base, zoom: 0.5, alignX: 'start', alignY: 'end' })
    expect(g.bounds).toEqual({ x: 0, y: 20, w: 25, h: 20 })
  })

  it('esagoni ad alveare: le righe dispari si spostano di mezza casella', () => {
    const g = gridGeometry({ ...base, cell: 'hex', interlock: true, rows: 2, columns: 2 })
    const top = (d: string): number[] => points(d)[0]
    // il vertice in alto della casella sotto, a destra di mezza casella
    const a = top(g.cells[0])
    const c = top(g.cells[2])
    const w = top(g.cells[1])[0] - a[0]
    expect(c[0] - a[0]).toBeCloseTo(w / 2)
    // e salita di un quarto: le caselle si toccano
    const h = (w * 2) / Math.sqrt(3)
    expect(c[1] - a[1]).toBeCloseTo(h * 0.75)
    expect(g.bounds.w).toBeLessThanOrEqual(50 + 1e-9)
    expect(g.bounds.h).toBeLessThanOrEqual(40 + 1e-9)
  })

  it('triangoli alternati e angoli arrotondati', () => {
    const g = gridGeometry({ ...base, cell: 'triangle', interlock: true, rows: 1, columns: 3 })
    expect(points(g.cells[0])[0][1]).toBeLessThan(points(g.cells[1])[0][1] + 1)
    const round = gridGeometry({ ...base, radius: 2 })
    expect(round.cells[0]).toContain('Q')
    expect(gridGeometry({ ...base, cell: 'circle', radius: 2 }).cells[0]).toContain('A')
  })
})

describe('forma e rotazione delle caselle', () => {
  const base = {
    w: 40,
    h: 20,
    cell: 'square' as const,
    rows: 1,
    columns: 2,
    cellRatio: 1,
    orientation: 'pointy' as const,
    interlock: false,
    gap: 0,
    padding: 0,
    zoom: 1,
    alignX: 'center' as const,
    alignY: 'center' as const,
    radius: 0
  }

  it('gira solo il contorno: centri e misure restano', () => {
    const plain = gridGeometry(base)
    const turned = gridGeometry({ ...base, cellRotation: 45 })
    expect(turned.centers).toEqual(plain.centers)
    expect(turned.cell).toEqual(plain.cell)
    // il quadrato girato di 45° ha un vertice sopra il centro
    expect(turned.cells[0]).toMatch(/^M10 -4\.142/)
  })

  it('porta una forma da immagine nella casella', () => {
    expect(placeCellPath('M0 0L1 0L0.5 1Z', 10, 10, 20, 20)).toBe('M0 0L20 0L10 20Z')
    expect(placeCellPath('M0 0L1 0L0.5 1Z', 10, 10, 20, 20, 180)).toBe('M20 20L0 20L10 0Z')
    expect(placeCellPath('M0 0h1z', 0, 0, 1, 1)).toBeNull()
    const g = gridGeometry({ ...base, cell: 'path', cellPath: 'M0 0L1 0L0.5 1Z' })
    expect(g.cells).toEqual(['M0 0L20 0L10 20Z', 'M20 0L40 0L30 20Z'])
  })
})
