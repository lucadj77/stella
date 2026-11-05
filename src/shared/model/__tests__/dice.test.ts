import { describe, expect, it } from 'vitest'
import { DEFAULT_IMAGE, DEFAULT_PDF, DEFAULT_TTS, type ExportCard } from '../../export'
import { diePage, dieOutlineLines, planImages, planPdf, planTts } from '../../exportPlan'
import {
  applyDie,
  cubeFaces,
  D4_CORNERS,
  d4WedgeRows,
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
import { bindCard, rowToCard } from '../bind'

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
  })

  it('d4: gli spicchi in basso vengono dalle righe che condividono i vertici', () => {
    const t = normalizeTemplate({
      name: 'f',
      kind: 'die',
      die: 'd4',
      width: 25,
      height: 21.65,
      front: [{ type: 'text', name: 'value', text: '', source: { kind: 'column' } }],
      back: []
    })
    const sheet = {
      headers: ['amount', 'value'],
      rows: [
        ['1', 'A'],
        ['1', 'B'],
        ['1', 'C'],
        ['1', 'D']
      ]
    }
    const text = (ls: unknown[]): string => (ls[0] as { text: string }).text
    const b = bindCard(t, rowToCard(sheet.headers, sheet.rows[1]), { system: { number: 2, sheet } })
    expect(text(b.template.front)).toBe('B')
    expect(b.template.wedges!.map(text)).toEqual(['D', 'C'])
    expect(d4WedgeRows(5, 4)).toBeNull()
    // senza dati niente spicchi: si ripete lo spicchio della carta
    expect(bindCard(t, rowToCard([], []), {}).template.wedges).toBeUndefined()
  })

  it('un set nuovo di dadi nasce con un dado, valori da 1 a N', () => {
    const t = { ...face('d8', 20, 17.32), labelField: 'value' }
    const s = dieSheet({ name: 's', headers: ['amount', 'value'], rows: [] }, t)
    expect(s.rows).toEqual(Array.from({ length: 8 }, (_, k) => ['1', String(k + 1)]))
    const card = normalizeTemplate({ name: 'c', front: [], back: [] })
    expect(dieSheet({ name: 's', headers: ['amount', 'value'], rows: [] }, card).rows).toEqual([])
  })

  it('livelli di partenza: il numero, sul d4 vicino al vertice in alto', () => {
    expect(dieStarterLayers('d8', 20, 17.32).map((l) => l.name)).toEqual(['value'])
    const [d4] = dieStarterLayers('d4', 25, 21.65)
    expect(d4.name).toBe('value')
    expect((d4.y as number) + (d4.h as number)).toBeLessThan((2 * 21.65) / 3)
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

  it('PDF: il contorno delle facce come linea di taglio', () => {
    const tri = planPdf(
      { ...DEFAULT_PDF, bleed: false },
      [{ name: 'd8', kind: 'die', cards: [card(applyDie(face(), 'd8', 20, 20), 1)] }],
      'p'
    )
    expect(tri.docs[0].pages[0].lines).toHaveLength(3)
    const t = applyDie(face(), 'd12', 20, 20)
    const plan = planPdf(
      { ...DEFAULT_PDF, bleed: false },
      [{ name: 'd12', kind: 'die', cards: [card(t, 1)] }],
      'p'
    )
    const page = plan.docs[0].pages[0]
    const it0 = page.items[0]
    const own = dieOutlineLines(page)
    expect(own).toHaveLength(5)
    expect(own[0]).toMatchObject({ x1: it0.x + 10, y1: it0.y })
    expect(page.lines).toEqual(expect.arrayContaining(own))
  })

  it('PDF da piegare: il d3 esce come cubo, il d8 come sviluppo, il d2 con un avviso', () => {
    const d3 = applyDie(face(), 'd3')
    const plan = planPdf(
      { ...DEFAULT_PDF, dice: 'net' },
      [{ name: 'd3', kind: 'die', cards: [1, 2, 3].map((n) => card(d3, n)) }],
      'p'
    )
    expect(plan.notes).toEqual([])
    expect(plan.docs[0].pages[0].items.length).toBeGreaterThan(6)
    const d8 = applyDie(face(), 'd8')
    const oct = planPdf(
      { ...DEFAULT_PDF, dice: 'net', marks: 'lines' },
      [{ name: 'd8', kind: 'die', cards: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => card(d8, n)) }],
      'p'
    )
    expect(oct.notes).toEqual([])
    const page = oct.docs[0].pages[0]
    // 8 facce e 5 linguette (12 spigoli, 7 pieghe), tutte girate liberamente
    expect(page.items).toHaveLength(13)
    expect(page.items.every((it) => it.matrix && it.clip)).toBe(true)
    expect(page.lines.filter((l) => l.dash)).toHaveLength(7 + 5)
    const d2 = applyDie(face(), 'd2')
    const coin = planPdf(
      { ...DEFAULT_PDF, dice: 'net' },
      [{ name: 'd2', kind: 'die', cards: [card(d2, 1), card(d2, 2)] }],
      'p'
    )
    expect(coin.notes).toEqual([{ key: 'export.dieNetCoin', params: { set: 'd2' } }])
  })

  it('Tabletop Simulator: il d3 come cubo, gli altri come solidi con una faccia per riga', () => {
    const d3 = applyDie(face(), 'd3')
    const [cube] = planTts(DEFAULT_TTS, [
      { name: 'd3', kind: 'die', cards: [1, 2, 3].map((n) => card(d3, n)) }
    ])
    expect(cube.dice.map((d) => d.cards.map((c) => c.n))).toEqual([[1, 2, 3, 3, 2, 1]])
    expect(cube.dice[0].padded).toBe(false)
    const d8 = applyDie(face(), 'd8')
    const [oct] = planTts(DEFAULT_TTS, [
      { name: 'd8', kind: 'die', cards: [1, 2, 3, 4, 5, 6, 7].map((n) => card(d8, n)) }
    ])
    expect(oct.object.type).toBe('die')
    // l'ultimo dado incompleto ripete le prime facce
    expect(oct.dice.map((d) => d.cards.map((c) => c.n))).toEqual([[1, 2, 3, 4, 5, 6, 7, 1]])
    expect(oct.dice[0].padded).toBe(true)
    // il foglio del d8: 3 × 3 celle
    expect(diePage(oct.dice[0])).toMatchObject({ width: 60, height: 3 * d8.height })
  })

  it('le facce di dado non hanno retro, né in PDF né in immagini', () => {
    const t = applyDie(face(), 'd8', 20, 20)
    const sets = [{ name: 'd8', kind: 'die' as const, cards: [card(t, 1), card(t, 2)] }]
    const both = planPdf({ ...DEFAULT_PDF, sides: 'both' }, sets, 'p')
    const items = both.docs.flatMap((d) => d.pages.flatMap((p) => p.items))
    expect(items.map((i) => i.side)).toEqual(['front', 'front'])
    expect(planPdf({ ...DEFAULT_PDF, sides: 'back' }, sets, 'p').docs).toEqual([])
    // in fronte-retro una pagina vuota dietro le facce
    const duplex = planPdf({ ...DEFAULT_PDF, duplex: 'long' }, sets, 'p')
    expect(duplex.docs[0].pages.map((p) => p.items.length)).toEqual([2, 0])
    const files = planImages({ ...DEFAULT_IMAGE, sides: 'both' }, sets)
    expect(files.map((f) => f.side)).toEqual(['front', 'front'])
  })

  it('d3: in PDF ogni riga si stampa su due facce', () => {
    const t = applyDie(face(), 'd3')
    const sets = [{ name: 'd3', kind: 'die' as const, cards: [1, 2, 3].map((n) => card(t, n)) }]
    const plan = planPdf(DEFAULT_PDF, sets, 'p')
    const items = plan.docs[0].pages.flatMap((p) => p.items)
    expect(items).toHaveLength(6)
  })
})
