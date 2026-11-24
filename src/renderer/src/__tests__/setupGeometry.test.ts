import { describe, expect, it } from 'vitest'
import { parseDocument } from '../../../shared/model/document'
import { setupSource, type Setup } from '../../../shared/model/setup'
import { cardLabelPlace, setupView, textBoxes, textExtent } from '../render/setupGeometry'
import { normalizeTemplate, type RawTemplate } from '../../../shared/model/normalize'
import type { LoadedSet } from '../../../shared/project'

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

describe('file, mani, caselle e frecce agganciate', () => {
  const sets: LoadedSet[] = [
    {
      name: 'Plance',
      template: 'plancia',
      data: { name: 'Plance', headers: ['nome'], rows: [['A']] }
    },
    {
      name: 'Carte',
      template: 'carta',
      data: { name: 'Carte', headers: ['nome'], rows: [['a'], ['b'], ['c']] }
    }
  ]
  const templates = [
    normalizeTemplate({
      name: 'plancia',
      width: 100,
      height: 100,
      front: [
        {
          type: 'grid',
          name: 'g',
          x: 0,
          y: 0,
          w: 100,
          h: 100,
          rows: 2,
          columns: 2,
          gap: 0,
          padding: 0
        }
      ]
    } as RawTemplate),
    normalizeTemplate({ name: 'carta', width: 20, height: 30 } as RawTemplate)
  ]

  it('mette in fila le carte con lo spazio, e lo zoom le ingrandisce', () => {
    const s = setup('row Carte/1-3 10,10 gap=5 scale=200%')
    const v = setupView(s, sets, templates, 1000, 3)
    expect(v.boxes[0]).toMatchObject({ x: 10, y: 10, w: 3 * 40 + 2 * 5, h: 60 })
    const col = setup('row Carte/1-3 0,0 direction=down')
    expect(setupView(col, sets, templates, 1000, 3).boxes[0]).toMatchObject({ w: 20, h: 96 })
  })

  it('apre la mano a ventaglio, più larga di una carta', () => {
    const v = setupView(setup('hand Carte/1-3 0,0 spread=60'), sets, templates, 1000, 3)
    expect(v.boxes[0].w).toBeGreaterThan(40)
    expect(v.boxes[0]).toMatchObject({ x: 0, y: 0 })
  })

  it('mette il segnalino al centro della casella, anche con la plancia girata', () => {
    const s = setup('card Plance/1 10,10 name=p\ncard Carte/1 on=@p cell=2,1')
    const v = setupView(s, sets, templates, 1000, 3)
    const t = v.boxes[1]
    expect(t.x + t.w / 2).toBeCloseTo(10 + 25)
    expect(t.y + t.h / 2).toBeCloseTo(10 + 75)
    const turned = setup('card Plance/1 0,0 rotate=90 name=p\ncard Carte/1 on=@p cell=1,1')
    const b = setupView(turned, sets, templates, 1000, 3).boxes[1]
    // girata di 90° in senso orario la casella in alto a sinistra va in alto a destra
    expect(b.x + b.w / 2).toBeCloseTo(75)
    expect(b.y + b.h / 2).toBeCloseTo(25)
  })

  it('fa partire e arrivare le frecce agganciate dal bordo degli elementi', () => {
    const s = setup('zone 0,0 20x20 name=a\nzone 100,0 20x20 name=b\narrow @a -> @b')
    const v = setupView(s, sets, templates, 1000, 3)
    const a = v.items![2]
    expect(a).toMatchObject({ kind: 'arrow', y: 10, y2: 10 })
    if (a.kind !== 'arrow') return
    expect(a.x).toBeCloseTo(21.5)
    expect(a.x2).toBeCloseTo(98.5)
  })

  it('mette su una casella anche immagini e forme, con il centro', () => {
    const s = setup(
      'card Plance/1 10,10 name=p\nimage cubo.png on=@p cell=2,1 width=8\nshape rect on=@p cell=1,1 10x6'
    )
    const v = setupView(s, sets, templates, 1000, 3)
    expect(v.boxes[1].x + v.boxes[1].w / 2).toBeCloseTo(35)
    expect(v.boxes[1].y + v.boxes[1].h / 2).toBeCloseTo(85)
    expect(v.boxes[2].x + v.boxes[2].w / 2).toBeCloseTo(35)
    expect(v.boxes[2].y + v.boxes[2].h / 2).toBeCloseTo(35)
  })

  it('aggancia la freccia alle righe scritte di un testo, non alla prima riga', () => {
    const s = setup(
      'text 0,0 width=40 "una riga e poi un\'altra e poi un\'altra ancora e ancora"\nzone 0,100 40x10 name=z\narrow @t -> @z'.replace(
        'width=40 "',
        'width=40 name=t "'
      )
    )
    const v = setupView(s, sets, templates, 1000, 3)
    const a = v.items![2]
    if (a.kind !== 'arrow') throw new Error('freccia')
    // il testo va su più righe: la freccia parte sotto l'ultima, non dentro il testo
    expect(a.y).toBeGreaterThan(3 * 1.25 * 2)
  })

  it('mette l’etichetta laterale fuori dall’oggetto anche con una parola lunga', () => {
    const p = cardLabelPlace({ x: 100, y: 0, w: 60, h: 90 }, 'left', 'Mazzo nemicoddddddddddddd', 6)
    expect(p.x + p.w).toBeLessThanOrEqual(100)
    expect(p.w).toBeGreaterThan(40)
  })

  it('ruota zone e testi attorno al centro', () => {
    const v = setupView(setup('zone 0,0 40x20 rotate=90'), sets, templates, 1000, 3)
    expect(v.boxes[0]).toMatchObject({ x: 10, y: -10, w: 20, h: 40 })
  })
})
