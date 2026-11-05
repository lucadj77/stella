import { describe, expect, it } from 'vitest'
import { DEFAULT_PDF, DEFAULT_TTS, type ExportCard } from '../../export'
import { dieOutlineLines, planPdf, planTts } from '../../exportPlan'
import {
  applyDie,
  cubeFaces,
  D4_CORNERS,
  d4Corners,
  dieHeight,
  dieOf,
  dieSheet,
  dieShape,
  dieStarterLayers,
  dieUnitPolygon,
  insetPolygon,
  kiteGeometry,
  kiteHeightParam,
  pathPolygon
} from '../dice'
import { denormalizeTemplate, normalizeTemplate } from '../normalize'
import { systemFields } from '../system'

const face = (die?: string, w = 20, h = 20): ReturnType<typeof normalizeTemplate> =>
  normalizeTemplate({
    name: 'f',
    kind: 'die',
    ...(die ? { die: die as never } : {}),
    width: w,
    height: h,
    bleed: 0,
    front: [],
    back: []
  })

describe('dadi: modello', () => {
  it('die assente vale d6, si salva solo se diverso e solo per le facce di dado', () => {
    expect(dieOf(face())).toBe('d6')
    expect(dieOf(face('d8'))).toBe('d8')
    expect(dieOf(normalizeTemplate({ name: 'c', front: [], back: [] }))).toBeNull()
    expect(denormalizeTemplate(face('d8')).die).toBe('d8')
    expect(denormalizeTemplate(face('d6')).die).toBeUndefined()
    expect(normalizeTemplate({ name: 'x', kind: 'card', die: 'd8', front: [], back: [] }).die).toBe(
      undefined
    )
    expect(
      normalizeTemplate({ name: 'x', kind: 'die', die: 'd7' as never, front: [], back: [] }).die
    ).toBeUndefined()
  })

  it('proporzioni: triangoli e pentagoni fissi, il d10 tra 1 e 2', () => {
    expect(dieHeight('d8', 20, 99)).toBeCloseTo(17.32, 2)
    expect(dieHeight('d12', 20, 1)).toBeCloseTo(19.02, 2)
    expect(dieHeight('d6', 20, 3)).toBe(20)
    expect(dieHeight('d10', 16, 20)).toBe(20)
    expect(dieHeight('d10', 16, 50)).toBe(32)
    expect(dieHeight('d10', 16, 10)).toBe(16)
  })

  it('d10: la proporzione cercata è quella che esce, e la faccia è un aquilone convesso', () => {
    for (const r of [1, 1.25, 1.6, 2]) {
      const g = kiteGeometry(kiteHeightParam(r))
      expect(g.h / g.w).toBeCloseTo(r, 4)
      expect(g.mid).toBeGreaterThan(0)
      expect(g.mid).toBeLessThan(g.h)
    }
    const [, right, bottom] = dieUnitPolygon('d10', 16, 20)
    expect(right[0]).toBe(1)
    expect(bottom).toEqual([0.5, 1])
  })

  it('pentagono regolare: lati uguali', () => {
    const w = 20
    const h = dieHeight('d12', w, w)
    const pts = dieUnitPolygon('d12', w, h).map(([x, y]) => [x * w, y * h])
    const sides = pts.map((p, i) => {
      const q = pts[(i + 1) % pts.length]
      return Math.hypot(q[0] - p[0], q[1] - p[1])
    })
    for (const s of sides) expect(s).toBeCloseTo(sides[0], 2)
  })

  it('forma: tracciato per i poligoni, ellisse per la moneta, niente per i cubi', () => {
    expect(dieShape('d4', 20, 17.32)).toEqual({ shape: 'path', shapePath: 'M0.5 0L1 1L0 1Z' })
    expect(dieShape('d2', 20, 20)).toEqual({ shape: 'ellipse', shapePath: undefined })
    expect(dieShape('d6', 20, 20)).toBeNull()
    expect(pathPolygon('M0.5 0L1 1L0 1Z')).toEqual([
      [0.5, 0],
      [1, 1],
      [0, 1]
    ])
    expect(pathPolygon('M0 0C1 1 2 2 3 3Z')).toBeNull()
  })

  it('applyDie: misure, forma e ritorno al cubo', () => {
    const d8 = applyDie(face(), 'd8', 20, 20)
    expect(d8).toMatchObject({ die: 'd8', width: 20, shape: 'path' })
    expect(d8.height).toBeCloseTo(17.32, 2)
    const back = applyDie(d8, 'd6', 20, 20)
    expect(back.die).toBeUndefined()
    expect(back.shape).toBeUndefined()
  })

  it('rientro di un poligono: stessa distanza da ogni lato', () => {
    const tri: [number, number][] = [
      [10, 0],
      [20, 17.32],
      [0, 17.32]
    ]
    const inner = insetPolygon(tri, 1)
    // la base rientra di 1 mm
    expect(inner[1][1]).toBeCloseTo(16.32, 2)
    // un rientro troppo grande chiude il poligono al centro
    const gone = insetPolygon(tri, 50)
    expect(new Set(gone.map((p) => p.join(','))).size).toBe(1)
  })
})

describe('dadi: facce e righe', () => {
  it('d3: ogni riga su due facce opposte del cubo', () => {
    expect(cubeFaces(['a', 'b', 'c'], 'd3')).toEqual(['a', 'b', 'c', 'c', 'b', 'a'])
    expect(cubeFaces(['a', 'b'], 'd6')).toEqual(['a', 'b', 'a', 'b', 'a', 'b'])
  })

  it('d4: ogni valore compare su tre facce e due facce condividono due vertici', () => {
    const counts = [0, 0, 0, 0]
    for (const f of D4_CORNERS) for (const k of f) counts[k]++
    expect(counts).toEqual([3, 3, 3, 3])
    for (let a = 0; a < 4; a++)
      for (let b = a + 1; b < 4; b++)
        expect(D4_CORNERS[a].filter((k) => D4_CORNERS[b].includes(k))).toHaveLength(2)
    // ogni faccia ha il suo valore in alto
    D4_CORNERS.forEach((f, i) => expect(f[0]).toBe(i))
    expect(d4Corners(['1', '2', '3', '4', '5'], 1)).toEqual(['1', '3', '4'])
    expect(d4Corners(['1', '2', '3', '4', '5'], 5)).toEqual(['5', '', ''])
  })

  it('d4: le variabili dei vertici leggono la colonna del nome delle righe', () => {
    const t = { ...face('d4', 25, 21.65), labelField: 'value' }
    const sheet = {
      headers: ['amount', 'value'],
      rows: [
        ['1', 'A'],
        ['1', 'B'],
        ['1', 'C'],
        ['1', 'D']
      ]
    }
    const f = systemFields({ number: 2, sheet }, t, 1, 'front')
    expect([f['die.corner1'], f['die.corner2'], f['die.corner3']]).toEqual(['B', 'D', 'C'])
    // senza dati: le righe valgono 1, 2, 3, 4
    const none = systemFields({}, t, 1, 'front')
    expect([none['die.corner1'], none['die.corner2'], none['die.corner3']]).toEqual(['1', '3', '4'])
    expect(systemFields({ number: 1, sheet }, face('d8'), 1, 'front')['die.corner1']).toBe('')
  })

  it('un set nuovo di dadi nasce con un dado, valori da 1 a N', () => {
    const t = { ...face('d8', 20, 17.32), labelField: 'value' }
    const s = dieSheet({ name: 's', headers: ['amount', 'value'], rows: [] }, t)
    expect(s.rows).toEqual(Array.from({ length: 8 }, (_, k) => ['1', String(k + 1)]))
    const card = normalizeTemplate({ name: 'c', front: [], back: [] })
    expect(dieSheet({ name: 's', headers: ['amount', 'value'], rows: [] }, card).rows).toEqual([])
  })

  it('livelli di partenza: il numero, o i tre vertici ruotati del d4', () => {
    expect(dieStarterLayers('d8', 20, 17.32).map((l) => l.name)).toEqual(['value'])
    const d4 = dieStarterLayers('d4', 25, 21.65)
    expect(d4.map((l) => [l.name, l.rotation])).toEqual([
      ['value', undefined],
      ['corner1', 0],
      ['corner2', -120],
      ['corner3', 120]
    ])
  })
})

describe('dadi: esportazione', () => {
  const card = (t: ReturnType<typeof face>, n: number): ExportCard => ({
    n,
    amount: 1,
    label: String(n),
    fields: {},
    template: t
  })

  it('PDF: il contorno dei triangoli come linea di taglio', () => {
    const t = applyDie(face(), 'd8', 20, 20)
    const plan = planPdf(
      { ...DEFAULT_PDF, bleed: false },
      [{ name: 'd8', kind: 'die', cards: [card(t, 1)] }],
      'p'
    )
    const page = plan.docs[0].pages[0]
    const it0 = page.items[0]
    const own = dieOutlineLines(page)
    expect(own).toHaveLength(3)
    expect(own[0]).toMatchObject({ x1: it0.x + 10, y1: it0.y })
    expect(page.lines).toEqual(expect.arrayContaining(own))
  })

  it('PDF da piegare: il d3 esce come cubo, gli altri con un avviso', () => {
    const d3 = applyDie(face(), 'd3')
    const plan = planPdf(
      { ...DEFAULT_PDF, dice: 'net' },
      [{ name: 'd3', kind: 'die', cards: [1, 2, 3].map((n) => card(d3, n)) }],
      'p'
    )
    expect(plan.notes).toEqual([])
    expect(plan.docs[0].pages[0].items.length).toBeGreaterThan(6)
    const d8 = applyDie(face(), 'd8')
    const later = planPdf(
      { ...DEFAULT_PDF, dice: 'net' },
      [{ name: 'd8', kind: 'die', cards: [card(d8, 1)] }],
      'p'
    )
    expect(later.notes).toEqual([{ key: 'export.dieNetLater', params: { set: 'd8', die: 'd8' } }])
  })

  it('Tabletop Simulator: il d3 come cubo, gli altri per ora come segnalini', () => {
    const d3 = applyDie(face(), 'd3')
    const [cube] = planTts(DEFAULT_TTS, [
      { name: 'd3', kind: 'die', cards: [1, 2, 3].map((n) => card(d3, n)) }
    ])
    expect(cube.dice.map((d) => d.cards.map((c) => c.n))).toEqual([[1, 2, 3, 3, 2, 1]])
    expect(cube.dice[0].padded).toBe(false)
    const d8 = applyDie(face(), 'd8')
    const [later] = planTts(DEFAULT_TTS, [
      { name: 'd8', kind: 'die', cards: [1, 2].map((n) => card(d8, n)) }
    ])
    expect(later.dieLater).toBe('d8')
    expect(later.object.type).toBe('token')
    expect(later.pieces).toHaveLength(2)
  })
})
