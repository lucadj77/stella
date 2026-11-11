import { describe, expect, it } from 'vitest'
import { DEFAULT_PDF, cellPosition, pageSize, type Grid, type PdfOptions } from '../export'
import { backPoint, duplexTestPages, testPoints, wrap } from '../duplexTest'

const text = { front: 'Front', back: 'Back', frontHint: 'hint', steps: ['one', 'two'] }

describe('pagina di prova del fronte-retro', () => {
  it('ha due pagine, le croci sul fronte e le scale sul retro', () => {
    const pages = duplexTestPages({ ...DEFAULT_PDF, duplex: 'long' }, text)
    expect(pages).toHaveLength(2)
    expect(pages[0].lines).toHaveLength(10)
    expect(pages[1].lines.length).toBeGreaterThan(100)
    expect(pages.every((p) => p.items.length === 0)).toBe(true)
  })

  it('il retro specchia i punti come i retri delle carte, con lo spostamento', () => {
    for (const duplex of ['long', 'short'] as const)
      for (const landscape of [false, true]) {
        const o: PdfOptions = { ...DEFAULT_PDF, duplex, landscape, offsetX: 1.5, offsetY: -0.5 }
        // una cella grande zero si comporta come un punto
        const cell: Grid = {
          cols: 1,
          rows: 1,
          cellW: 0,
          cellH: 0,
          gap: 0,
          x0: 40,
          y0: 50,
          bleed: 0,
          rotated: false
        }
        const front = cellPosition(o, cell, 0, false)
        const back = cellPosition(o, cell, 0, true)
        expect(backPoint(o, front)).toEqual(back)
      }
  })

  it('con il retro girato sul lato lungo di una pagina verticale, il punto 2 va a destra', () => {
    const o: PdfOptions = { ...DEFAULT_PDF, duplex: 'long', landscape: false }
    const [, two] = testPoints(o)
    const { width } = pageSize(o)
    expect(backPoint(o, two)).toEqual({ x: width - two.x, y: two.y })
  })

  it('va a capo a parole intere', () => {
    const lines = wrap('uno due tre quattro cinque sei sette otto nove dieci', 20, 3)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines.join(' ')).toBe('uno due tre quattro cinque sei sette otto nove dieci')
  })
})
