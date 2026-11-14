import { describe, expect, it } from 'vitest'
import { parseDocument } from '../../../shared/model/document'
import { setupSource, type Setup } from '../../../shared/model/setup'
import { setupView, textBoxes, textExtent } from '../render/setupGeometry'

const setup = (src: string): Setup => {
  const b = parseDocument('```setup\n' + src + '\n```')[0]
  if (b?.kind !== 'setup') throw new Error('not a setup')
  return b
}
const inside = (outer: { x: number; y: number; w: number; h: number }, b: typeof outer): boolean =>
  b.x >= outer.x - 1e-6 &&
  b.y >= outer.y - 1e-6 &&
  b.x + b.w <= outer.x + outer.w + 1e-6 &&
  b.y + b.h <= outer.y + outer.h + 1e-6

describe('area dello schema del tavolo', () => {
  it('contiene le didascalie più larghe della carta', () => {
    const s = setup(
      'card set/1 0,0 "Non sballi se scopri una **carta verde** o una **carta rossa** in fondo"'
    )
    const view = setupView(s, [], [], 170, 3.4)
    const [label] = textBoxes(s, view.boxes, view.font)
    expect(label.w).toBeGreaterThan(view.boxes[0].w)
    expect(inside(view.area, label)).toBe(true)
  })

  it('contiene tutte le righe di una didascalia lunga e dei testi', () => {
    const s = setup(
      'card set/1 0,0 "Puoi fermarti (e prendere 3 carte a scelta) o pescare una carta"\ntext 70,0 width=20 "Un testo che va a capo più volte"'
    )
    const view = setupView(s, [], [], 170, 3.4)
    for (const b of textBoxes(s, view.boxes, view.font)) expect(inside(view.area, b)).toBe(true)
  })

  it('stima righe e larghezza', () => {
    expect(textExtent('uno due', 100, 4).lines).toBe(1)
    expect(textExtent('uno due tre quattro', 10, 4).lines).toBeGreaterThan(1)
    expect(textExtent('[AREA]{fill=#000}', 100, 4).w).toBeCloseTo(4 * 0.56 * 4)
  })
})

describe('margine dello schema', () => {
  it('si legge, si scrive e allarga l’area', () => {
    const base = setup('card set/1 0,0')
    const wide = setup('margin 10\ncard set/1 0,0')
    expect(wide.margin).toBe(10)
    expect(setupSource(wide)).toContain('\nmargin 10\n')
    expect(setupSource(base)).not.toContain('margin')
    const a = setupView(base, [], [], 500, 3).area
    const b = setupView(wide, [], [], 500, 3).area
    expect(b.w - a.w).toBeCloseTo(14)
    expect(b.x - a.x).toBeCloseTo(-7)
  })

  it('senza didascalie non lascia spazio sotto', () => {
    const v = setupView(setup('card set/1 0,0'), [], [], 500, 3)
    expect(v.area.y + v.area.h).toBeCloseTo(v.boxes[0].h + 3)
  })
})
