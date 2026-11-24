import { describe, expect, it } from 'vitest'
import {
  alignSetupItems,
  arrowCurve,
  bendTowards,
  canReorderSetupItem,
  cardListSource,
  parseCardList,
  distributeSetupItems,
  moveSetupItem,
  parseSetup,
  reorderSetupItem,
  layerOrdered,
  sortByLayer,
  setupLine,
  setupSource,
  type SetupItem
} from '../setup'
import { anatomySource, documentProblems, parseDocument } from '../document'
import type { LoadedSet } from '../../project'

const lines = (src: string): { lines: string[]; starts: number[] } => {
  const ls = src.split('\n')
  const starts: number[] = []
  let at = 0
  for (const l of ls) {
    starts.push(at)
    at += l.length + 1
  }
  return { lines: ls, starts }
}
const parse = (src: string): ReturnType<typeof parseSetup> => {
  const { lines: ls, starts } = lines(src)
  return parseSetup(ls, starts)
}

describe('schema del tavolo', () => {
  it('legge ogni tipo di elemento', () => {
    const s = parse(
      [
        'size 280x180',
        'zone 0,0 280x60 "Giocatore 1"',
        'deck Personaggi/1?side=back 20,10 count=8 "Mazzo"',
        'card Personaggi/nome=Mago 60,10 rotate=90 "Il \\"mago\\""',
        'text 140,30 width=40 "Pesca **2** carte"',
        'arrow 40,50 -> 60,80 "pesca"',
        'image icons/moneta%20oro.png 200,20 width=10',
        '# un commento',
        ''
      ].join('\n')
    )
    expect(s.bad).toEqual([])
    expect(s.size).toEqual({ w: 280, h: 180 })
    expect(s.items.map((i) => i.kind)).toEqual(['zone', 'deck', 'card', 'text', 'arrow', 'image'])
    expect(s.items[0]).toMatchObject({ x: 0, y: 0, w: 280, h: 60, label: 'Giocatore 1' })
    expect(s.items[1]).toMatchObject({ card: 'Personaggi/1?side=back', count: 8, rotate: 0 })
    expect(s.items[2]).toMatchObject({ rotate: 90, label: 'Il "mago"' })
    expect(s.items[3]).toMatchObject({ w: 40, text: 'Pesca **2** carte' })
    expect(s.items[4]).toMatchObject({ x: 40, y: 50, x2: 60, y2: 80, label: 'pesca' })
    expect(s.items[5]).toMatchObject({ src: 'icons/moneta oro.png', w: 10 })
  })

  it("legge e riscrive l'allineamento dei testi, di base al centro", () => {
    const s = parse('text 0,0 "a"\ntext 0,10 width=40 align=left "b"\ntext 0,20 align=RIGHT "c"')
    expect(s.items.map((i) => (i.kind === 'text' ? (i.align ?? 'center') : ''))).toEqual([
      'center',
      'left',
      'right'
    ])
    expect(setupSource(s)).toContain('text 0,10 width=40 align=left "b"')
    expect(setupSource(s)).toContain('text 0,0 width=50 "a"')
    expect(parse('card X 0,0 align=left').bad).toHaveLength(1)
  })

  it('segnala le righe che non capisce', () => {
    const s = parse('zone 0,0 "senza misura"\ncard 10,10\nboh\nzone 1,1 5x5')
    expect(s.bad.map((b) => b.from)).toEqual([0, 24, 35])
    expect(s.items).toHaveLength(1)
  })

  it('riscrive lo stesso schema', () => {
    const src = [
      '```setup',
      'size 200x100',
      'zone 0,0 100x50 "Zona"',
      'deck Mazzo%20base/1 10,10 count=8 rotate=90 "Pesca"',
      'text 5,5 width=50 "Un \\"testo\\""',
      'arrow 1,2 -> 3,4',
      'arrow 1,2 -> 30,4 bend=-6.5 "gira"',
      'arrow 1,2 -> 30,4 heads=both size=150%',
      'image icone/a%20b.png 7,8 width=12',
      '```'
    ].join('\n')
    const s = parse(src.split('\n').slice(1, -1).join('\n'))
    expect(setupSource(s)).toBe(src)
  })

  it('nel documento controlla carte e righe', () => {
    const sets: LoadedSet[] = [
      {
        name: 'Personaggi',
        template: 'personaggio',
        data: { name: 'Personaggi', headers: ['nome'], rows: [['Mago']] }
      }
    ]
    const text = '```setup\ncard Personaggi/nome=Mago 0,0\ncard Personaggi/9 0,0\nboh\n```'
    expect(parseDocument(text)[0].kind).toBe('setup')
    const keys = documentProblems(text, { sets }).map((p) => p.message.key)
    expect(keys.sort()).toEqual(['doc.card.noRow', 'doc.setup.badLine'])
  })
})

describe('disposizione nello schema', () => {
  const zone = (x: number, y: number, w = 10, h = 10): SetupItem => ({
    kind: 'zone',
    x,
    y,
    w,
    h,
    label: '',
    from: 0,
    to: 0
  })
  const boxesOf = (items: SetupItem[]): { x: number; y: number; w: number; h: number }[] =>
    items.map((it) => (it.kind === 'zone' ? it : { x: it.x, y: it.y, w: 5, h: 5 }))

  it('allinea ai lati della selezione', () => {
    const items = [zone(0, 0), zone(20, 5, 20), zone(50, 50)]
    const left = alignSetupItems(items, boxesOf(items), [0, 1], 'left')
    expect(left.map((i) => i.x)).toEqual([0, 0, 50])
    const right = alignSetupItems(items, boxesOf(items), [0, 1], 'right')
    expect(right.map((i) => i.x)).toEqual([30, 20, 50])
    const mid = alignSetupItems(items, boxesOf(items), [0, 1], 'vcenter')
    expect(mid.map((i) => i.y)).toEqual([2.5, 2.5, 50])
  })

  it('sposta la freccia con tutte e due le punte', () => {
    const arrow: SetupItem = { kind: 'arrow', x: 0, y: 0, x2: 10, y2: 5, label: '', from: 0, to: 0 }
    expect(moveSetupItem(arrow, 2, 3)).toMatchObject({ x: 2, y: 3, x2: 12, y2: 8 })
  })

  it('distribuisce con spazi uguali', () => {
    const items = [zone(0, 0), zone(12, 0), zone(40, 0)]
    const out = distributeSetupItems(items, boxesOf(items), [2, 0, 1], 'h')
    expect(out.map((i) => i.x)).toEqual([0, 20, 40])
  })

  it("cambia l'ordine tra tutti gli elementi", () => {
    const text: SetupItem = { kind: 'text', x: 0, y: 0, w: 10, text: 't', from: 0, to: 0 }
    const items = [zone(0, 0), text, zone(1, 1), zone(2, 2)]
    const up = reorderSetupItem(items, 0, 'up')
    expect(up.items[0]).toBe(text)
    expect(up.index).toBe(1)
    const top = reorderSetupItem(items, 0, 'top')
    expect(top.items.map((i) => i.x)).toEqual([0, 1, 2, 0])
    expect(top.index).toBe(3)
    expect(reorderSetupItem(items, 3, 'up').items).toBe(items)
    expect(canReorderSetupItem(items, 3, true)).toBe(false)
    expect(canReorderSetupItem(items, 1, true)).toBe(true)
    expect(canReorderSetupItem(items, 0, false)).toBe(false)
  })

  it("mette in ordine di strato e riconosce l'ordine libero", () => {
    const text: SetupItem = { kind: 'text', x: 0, y: 0, w: 10, text: 't', from: 0, to: 0 }
    const items = [text, zone(1, 1), zone(2, 2)]
    expect(layerOrdered(items)).toBe(false)
    const sorted = sortByLayer(items)
    expect(sorted.map((i) => i.kind)).toEqual(['zone', 'zone', 'text'])
    expect(sorted[0].x).toBe(1)
    expect(layerOrdered(sorted)).toBe(true)
  })
})

describe('larghezza e testo dei blocchi', () => {
  it('legge e scrive width e font nello schema', () => {
    const s = parse('width 60%\nfont: 80%\nzone 0,0 10x10\nwidth 5%')
    expect(s.width).toBe(0.6)
    expect(s.font).toBe(0.8)
    expect(s.bad).toHaveLength(1)
    expect(setupSource(s)).toContain('width: 60%\nfont: 80%\nzone')
    expect(setupSource({ ...s, width: 1, font: 1 })).not.toContain('width:')
  })

  it("legge width e font nell'anatomia", () => {
    const [b] = parseDocument('```anatomy\ncard: P/1\nwidth: 50%\nfont: 120%\n- nome: Nome\n```')
    expect(b).toMatchObject({ kind: 'anatomy', width: 0.5, font: 1.2, bad: [] })
    expect(anatomySource('P/1', [{ layer: 'nome', label: 'Nome' }], false, { width: 0.5 })).toBe(
      '```anatomy\ncard: P/1\nwidth: 50%\n- nome: Nome\n```'
    )
  })
})

describe('didascalia dello schema', () => {
  it('si legge e si riscrive, sopra o sotto', () => {
    const src = setupSource({
      size: null,
      items: [],
      width: null,
      font: null,
      caption: 'Preparazione',
      captionTop: true
    })
    expect(src).toBe('```setup\ncaption: Preparazione\ncaption-position: top\n```')
    const lines = ['caption: Preparazione', 'caption-position: top']
    const s = parseSetup(lines, [0, 22])
    expect(s).toMatchObject({ caption: 'Preparazione', captionTop: true, bad: [] })
    expect(parseSetup(['caption-position: middle'], [0]).bad).toHaveLength(1)
  })

  it('curva le frecce: il centro si scosta della curva, a destra di chi va verso la punta', () => {
    const a = { x: 0, y: 0, x2: 20, y2: 0, bend: 5 }
    // verso destra sullo schermo, la destra di chi cammina è in basso
    expect(arrowCurve(a).mid).toEqual({ x: 10, y: 5 })
    expect(arrowCurve(a).control).toEqual({ x: 10, y: 10 })
    expect(bendTowards(a, { x: 12, y: -3.33 })).toEqual({ bend: -3.3, shift: 2 })
    expect(parse('arrow 0,0 -> 20,0 bend=5').items[0]).toMatchObject({ bend: 5 })
  })

  it('il centro della curva si sposta lungo la freccia', () => {
    const a = { x: 0, y: 0, x2: 20, y2: 0, bend: 5, shift: 4 }
    expect(arrowCurve(a).mid).toEqual({ x: 14, y: 5 })
    expect(arrowCurve(a).control).toEqual({ x: 18, y: 10 })
    // senza curva lo spostamento non conta
    expect(arrowCurve({ ...a, bend: 0 }).mid).toEqual({ x: 10, y: 0 })
    const it = parse('arrow 0,0 -> 20,0 bend=5 shift=4').items[0]
    expect(it).toMatchObject({ bend: 5, shift: 4 })
    expect(setupLine(it as SetupItem)).toBe('arrow 0,0 -> 20,0 bend=5 shift=4')
    expect(parse('zone 0,0 10x10 shift=4').items).toHaveLength(0)
  })

  it('lo spessore della freccia si scrive a parte', () => {
    const it = parse('arrow 0,0 -> 20,0 size=150% thickness=1.2').items[0]
    expect(it).toMatchObject({ size: 1.5, thickness: 1.2 })
    expect(setupLine(it as SetupItem)).toBe('arrow 0,0 -> 20,0 size=150% thickness=1.2')
    expect(parse('text 0,0 thickness=1 "a"').items).toHaveLength(0)
  })
})

describe('forme, colori e altri elementi dello schema', () => {
  it('legge e riscrive le forme con colori e tratto', () => {
    const s = parse(
      [
        'shape ellipse 60,10 30x30 stroke=#e5484d thickness=1 "1"',
        'shape star 0,0 20x20 sides=7 inner=40% fill={oro} rotate=15 opacity=60%',
        'shape polygon 0,0 20x20 fill=none line=dot radius=2'
      ].join('\n')
    )
    expect(s.bad).toEqual([])
    expect(s.items[0]).toMatchObject({
      kind: 'shape',
      shape: 'ellipse',
      stroke: '#e5484d',
      thickness: 1,
      label: '1'
    })
    expect(s.items[1]).toMatchObject({
      shape: 'star',
      sides: 7,
      inner: 0.4,
      fill: '{oro}',
      rotate: 15,
      opacity: 0.6
    })
    expect(s.items[2]).toMatchObject({ fill: 'none', line: 'dot', radius: 2 })
    expect(parse(setupSource(s).split('\n').slice(1, -1).join('\n')).items).toEqual(
      s.items.map((it) => ({ ...it, from: expect.any(Number), to: expect.any(Number) }))
    )
    expect(parse('shape hexagon 0,0 10x10').bad).toHaveLength(1)
    expect(parse('shape rect 0,0').bad).toHaveLength(1)
    expect(parse('card X/1 0,0 fill=red').bad).toHaveLength(1)
  })

  it('dà colori, tratto e rotazione a zone, testi e frecce', () => {
    const s = parse(
      [
        'zone 0,0 80x40 fill=#dfe8f5 stroke=none rotate=90 line=solid "A"',
        'text 0,0 width=30 color=red rotate=270 "b"',
        'arrow 0,0 -> 10,0 color={rosso} line=dash'
      ].join('\n')
    )
    expect(s.bad).toEqual([])
    expect(s.items[0]).toMatchObject({ fill: '#dfe8f5', stroke: 'none', rotate: 90, line: 'solid' })
    expect(s.items[1]).toMatchObject({ color: 'red', rotate: 270 })
    expect(s.items[2]).toMatchObject({ color: '{rosso}', line: 'dash' })
    const src = setupSource(s)
    expect(src).toContain('zone 0,0 80x40 rotate=90 fill=#dfe8f5 stroke=none line=solid "A"')
    expect(src).toContain('arrow 0,0 -> 10,0 color={rosso} line=dash')
  })

  it('legge zoom, posto delle etichette, nomi e blocco', () => {
    const s = parse('card P/1 0,0 scale=150% label=top name=mago lock "Mago"')
    expect(s.items[0]).toMatchObject({ scale: 1.5, labelAt: 'top', name: 'mago', lock: true })
    expect(setupLine(s.items[0])).toBe('card P/1 0,0 scale=150% label=top name=mago lock "Mago"')
    expect(parse('card P/1 0,0 label=sotto').bad).toHaveLength(1)
    expect(parse('arrow 0,0 -> 1,1 name=x').bad).toHaveLength(1)
  })

  it('legge le file e le mani con carte di set diversi', () => {
    const s = parse(
      'row Mercato/1-3,7,Eroi/nome=Mago 10,10 gap=5 direction=down\nhand P/2,P/1 0,0 spread=40'
    )
    expect(s.bad).toEqual([])
    expect(s.items[0]).toMatchObject({
      kind: 'row',
      cards: ['Mercato/1', 'Mercato/2', 'Mercato/3', 'Mercato/7', 'Eroi/nome=Mago'],
      gap: 5,
      direction: 'down'
    })
    expect(s.items[1]).toMatchObject({ kind: 'hand', cards: ['P/2', 'P/1'], spread: 40 })
    expect(setupLine(s.items[0])).toBe(
      'row Mercato/1-3,7,Eroi/nome=Mago 10,10 gap=5 direction=down'
    )
    expect(cardListSource(['A/1', 'A/2', 'B/3', 'B/4', 'A/5'])).toBe('A/1-2,B/3-4,A/5')
    expect(cardListSource(['A/1?side=back', 'A/2'])).toBe('A/1?side=back,2')
    expect(parseCardList('A/1?side=back,2')).toEqual(['A/1?side=back', 'A/2'])
    expect(parseCardList('3,4')).toBeNull()
    expect(parseCardList('A/5-2')).toBeNull()
  })

  it('aggancia le frecce agli elementi e i segnalini alle caselle', () => {
    const s = parse(
      'card P/1 0,0 name=plancia\ncard S/1 on=@plancia cell=2,3 rotate=45\narrow @plancia -> 50,50'
    )
    expect(s.bad).toEqual([])
    expect(s.items[1]).toMatchObject({ on: { item: 'plancia', row: 2, col: 3 }, rotate: 45 })
    expect(s.items[2]).toMatchObject({ fromItem: 'plancia', x2: 50, y2: 50 })
    expect(setupLine(s.items[1])).toBe('card S/1 on=@plancia cell=2,3 rotate=45')
    expect(setupLine(s.items[2])).toBe('arrow @plancia -> 50,50')
    expect(parse('card S/1 on=@plancia').bad).toHaveLength(1)
    expect(parse('card S/1 0,0 cell=1,1').bad).toHaveLength(1)
  })

  it("legge l'ordine libero e lo riscrive", () => {
    const s = parse('order: free\ntext 0,0 "a"\nzone 0,0 5x5')
    expect(s.free).toBe(true)
    expect(setupSource(s)).toContain('\norder: free\n')
    expect(parse('order: boh').bad).toHaveLength(1)
    expect(setupSource({ ...s, free: false })).not.toContain('order')
  })

  it('segnala i nomi che non ci sono', () => {
    const keys = documentProblems('```setup\narrow @mazzo -> 10,10\n```', { sets: [] }).map(
      (p) => p.message.key
    )
    expect(keys).toContain('doc.setup.unknownName')
  })
})
