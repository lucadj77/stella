import { describe, expect, it } from 'vitest'
import { bindCard, cellFields, parseValue, rowToCard, substituteFields } from '../bind'
import { normalizeTemplate } from '../normalize'
import type { GridLayer, ShapeLayer, TextLayer } from '../template'
import { gridGeometry } from '../grid'

const template = normalizeTemplate({
  name: 't',
  front: [
    { type: 'text', name: 'nome', text: 'x', size: 12 },
    { type: 'text', name: 'testo', text: 'Forza {forza}, {spada}' },
    { type: 'shape', name: 'banda', fill: '#000000' },
    { type: 'group', name: 'gruppo', children: [{ type: 'image', name: 'cover', src: '{nome}' }] }
  ]
})

describe('bindCard', () => {
  it('applica valore principale, proprietà e campi', () => {
    const card = rowToCard(
      ['amount', 'nome', 'nome.size', 'banda', 'forza', 'nome.color'],
      ['2', 'Drago', '14', '#A33A2A', '6', '']
    )
    const bound = bindCard(template, card)
    const [nome, testo, banda, gruppo] = bound.template.front
    expect(bound.amount).toBe(2)
    expect((nome as TextLayer).text).toBe('Drago')
    expect((nome as TextLayer).size).toBe(14)
    // cella vuota: resta il valore del template
    expect((nome as TextLayer).color).toBe('#000000')
    expect((banda as ShapeLayer).fill).toBe('#A33A2A')
    expect((testo as TextLayer).text).toBe('Forza 6, {spada}')
    expect(
      gruppo.type === 'group' && gruppo.children[0].type === 'image' && gruppo.children[0].src
    ).toBe('Drago')
    expect(bound.problems).toEqual([])
  })

  it('segnala i font mancanti del livello e del markup', () => {
    const tpl = normalizeTemplate({
      name: 't',
      front: [
        { type: 'text', name: 'nome', font: 'Cinzel', text: '[x]{font=Nunito} [y]{font=Pippo}' }
      ]
    })
    const hasFont = (f: string): boolean => f === 'Nunito'
    const bound = bindCard(tpl, rowToCard([], []), { hasFont })
    expect(bound.problems.map((p) => p.params?.font)).toEqual(['Cinzel', 'Pippo'])
  })

  it('segnala proprietà inesistenti e valori non validi', () => {
    const bound = bindCard(template, rowToCard(['nome.pippo', 'nome.size'], ['1', 'grande']))
    expect(bound.problems.map((p) => p.key)).toEqual(['bind.unknownProperty', 'bind.invalidValue'])
  })

  it('copie: 1 se assente o non valida, 0 ammesso', () => {
    expect(rowToCard(['nome'], ['a']).amount).toBe(1)
    expect(rowToCard(['amount'], ['x']).amount).toBe(1)
    expect(rowToCard(['amount'], ['0']).amount).toBe(0)
  })
})

describe('parseValue', () => {
  it('converte numeri, booleani, contorni e none', () => {
    expect(parseValue('size', 10, '12,5')).toBe(12.5)
    expect(parseValue('visible', true, 'no')).toBe(false)
    expect(parseValue('visible', true, 'sì')).toBe(true)
    expect(parseValue('stroke', null, 'white/8%')).toEqual({ color: 'white', width: '8%' })
    expect(parseValue('stroke', null, 'red/0.5')).toEqual({ color: 'red', width: 0.5 })
    expect(parseValue('fill', '#fff', 'none')).toBeNull()
  })
})

describe('substituteFields', () => {
  it('lascia intatte variabili sconosciute, ripetizioni e graffe con escape', () => {
    expect(substituteFields('{a} {b} {spada*3} \\{a}', { a: '1' })).toBe('1 {b} {spada*3} \\{a}')
  })
})

describe('fonte del valore', () => {
  const t = normalizeTemplate({
    name: 't',
    front: [
      { type: 'text', name: 'fisso', text: 'sempre', source: { kind: 'fixed' } },
      { type: 'text', name: 'altro', text: '', source: { kind: 'column', column: 'titolo' } },
      { type: 'text', name: 'energia', text: '', source: { kind: 'formula', expr: '{forza}+2' } },
      { type: 'image', name: 'cover', source: { kind: 'formula', expr: '{nome}.png' } }
    ]
  })
  const texts = (headers: string[], row: string[]): string[] =>
    bindCard(t, rowToCard(headers, row)).template.front.map((l) =>
      l.type === 'text' ? l.text : l.type === 'image' ? l.src : ''
    )

  it('fisso ignora la colonna, colonna può avere un altro nome, formula calcola', () => {
    expect(
      texts(['fisso', 'titolo', 'forza', 'nome', 'fisso.color'], ['no', 'Re', '3', 'Drago', '#F00'])
    ).toEqual(['sempre', 'Re', '5', 'Drago.png'])
  })

  it('le colonne delle proprietà valgono anche con valore fisso', () => {
    const bound = bindCard(t, rowToCard(['fisso.color'], ['#FF0000']))
    expect((bound.template.front[0] as TextLayer).color).toBe('#FF0000')
  })

  it('segnala i campi mancanti nelle formule', () => {
    const bound = bindCard(t, rowToCard(['nome'], ['x']))
    expect(bound.problems.map((p) => p.params?.field)).toEqual(['forza'])
  })
})

describe('valori predefiniti e livelli valore', () => {
  const t = normalizeTemplate({
    name: 'v',
    front: [
      { type: 'value', name: 'forza', value: '3' },
      { type: 'value', name: 'doppia', source: { kind: 'formula', expr: '={forza}*2' } },
      {
        type: 'text',
        name: 'giudizio',
        source: { kind: 'formula', expr: '=IF({doppia}>6; "Forte"; "Debole")' }
      },
      { type: 'text', name: 'titolo', text: 'Drago' },
      { type: 'text', name: 'eco', source: { kind: 'formula', expr: '{titolo}!' } }
    ]
  })
  const text = (b: ReturnType<typeof bindCard>, i: number): string =>
    (b.template.front[i] as TextLayer).text

  it('senza riga usa i valori del template', () => {
    const b = bindCard(t, { fields: {}, amount: 1 })
    expect(text(b, 2)).toBe('Debole')
    expect(text(b, 4)).toBe('Drago!')
    expect(b.problems).toEqual([])
  })

  it('la riga cambia i valori e i livelli valore si ricalcolano', () => {
    const b = bindCard(t, rowToCard(['forza', 'titolo'], ['5', 'Orco']))
    expect(text(b, 2)).toBe('Forte')
    expect(text(b, 4)).toBe('Orco!')
  })

  it('una cella vuota lascia il valore del template, una con soli spazi lo svuota', () => {
    const vuota = bindCard(t, rowToCard(['titolo', 'titolo.size'], ['', '']))
    expect(text(vuota, 3)).toBe('Drago')
    const spazi = bindCard(t, rowToCard(['titolo', 'titolo.size'], [' ', '  ']))
    expect(text(spazi, 3)).toBe('')
    expect(text(spazi, 4)).toBe('!')
    expect(spazi.problems).toEqual([])
  })

  it('un livello valore non ha riquadro e non sposta i gruppi', () => {
    const g = normalizeTemplate({
      name: 'g',
      front: [
        {
          type: 'group',
          name: 'gr',
          children: [
            { type: 'value', name: 'v' },
            { type: 'shape', name: 's', x: 10, y: 10, w: 5, h: 5 }
          ]
        }
      ]
    }).front[0]
    expect([g.x, g.y, g.w, g.h]).toEqual([10, 10, 5, 5])
  })
})

describe('markup nelle carte', () => {
  it("usa un campo come numero di ripetizioni di un'icona", () => {
    expect(substituteFields('{spada*forza}', { forza: ' 3' })).toBe('{spada*3}')
  })

  it('segnala errori del markup, stili e immagini che non esistono', () => {
    const card = rowToCard(['testo'], ['[a]{colour=red} [b]{.nessuno} {spada} {scudo}'])
    const { problems } = bindCard(template, card, { assets: ['icons/spada.svg'], styles: {} })
    expect(problems).toEqual([
      {
        key: 'bind.markup',
        params: {
          layer: 'testo',
          problem: { key: 'markup.unknownAttribute', params: { name: 'colour' } }
        }
      },
      {
        key: 'bind.markup',
        params: {
          layer: 'testo',
          problem: { key: 'markup.unknownStyle', params: { name: 'nessuno' } }
        }
      },
      { key: 'bind.unknownRef', params: { layer: 'testo', name: 'scudo' } }
    ])
  })
})

describe('campi immagine nel testo', () => {
  const tpl = normalizeTemplate({
    name: 't',
    front: [
      { type: 'image', name: 'img', src: 'scudo' },
      { type: 'image', name: 'ritratto', src: '{nome}' },
      { type: 'text', name: 'testo', text: '' }
    ]
  })
  const text = (fields: Record<string, string>): string => {
    const card = bindCard(tpl, { fields, amount: 1 })
    return (card.template.front[2] as TextLayer).text
  }

  it("{img} e {img*3} disegnano l'immagine del campo", () => {
    expect(text({ img: 'spada', testo: 'Ottieni {img} e {img*3}, poi {img*2 tint=red}' })).toBe(
      'Ottieni {spada} e {spada*3}, poi {spada*2 tint=red}'
    )
    // senza cella vale l'immagine del template; un campo del numero funziona ancora
    expect(text({ n: '2', testo: '{img*n}' })).toBe('{scudo*2}')
  })

  it("l'immagine composta da un altro campo e i campi di testo ripetuti", () => {
    expect(text({ nome: 'Arciere', testo: '{ritratto} {nome}' })).toBe('{Arciere} Arciere')
    expect(text({ risorsa: '{legno}', testo: '{risorsa*2}' })).toBe('{legno*2}')
  })
})

describe('colori da un campo', () => {
  const tpl = normalizeTemplate({
    name: 't',
    front: [
      {
        type: 'value',
        name: 'tinta',
        value: '',
        source: { kind: 'formula', expr: '=IF({forza}>3; "rosso"; "#2F5DA8")' }
      },
      { type: 'shape', name: 'fondo', fill: '{tinta}', stroke: { color: '{tinta}', width: 1 } },
      { type: 'text', name: 'titolo', text: 'x', color: '{vuoto}' }
    ]
  })
  const variables = { rosso: { type: 'color' as const, color: '#A33A2A' } }
  it('{campo} in una proprietà colore prende il valore calcolato, poi la tavolozza', () => {
    const forte = bindCard(tpl, rowToCard(['forza', 'vuoto'], ['5', '']), { variables })
    const [, fondo, titolo] = forte.template.front
    expect((fondo as ShapeLayer).fill).toBe('#A33A2A')
    expect((fondo as ShapeLayer).stroke?.color).toBe('#A33A2A')
    expect((titolo as TextLayer).color).toBe('transparent')
    const debole = bindCard(tpl, rowToCard(['forza'], ['1']), { variables })
    expect((debole.template.front[1] as ShapeLayer).fill).toBe('#2F5DA8')
  })
})

describe('errori delle formule', () => {
  it('segnala gli errori di sintassi dei livelli con formula e dei livelli valore', () => {
    const t = normalizeTemplate({
      name: 't',
      front: [
        { type: 'value', name: 'doppio', source: { kind: 'formula', expr: '=IF({forza}>3; "a"' } },
        { type: 'text', name: 'testo', source: { kind: 'formula', expr: '=NOPE(1)' } }
      ]
    })
    const bound = bindCard(t, rowToCard(['forza'], ['5']))
    expect(bound.problems.map((p) => `${p.key}:${p.params?.layer}`)).toEqual([
      'bind.formulaError:doppio',
      'bind.formulaError:testo'
    ])
  })
})

describe('contenuto della griglia', () => {
  const tpl = normalizeTemplate({
    name: 't',
    front: [
      { type: 'grid', name: 'tracciato', rows: 2, columns: 3, content: 'numero' },
      {
        type: 'group',
        name: 'numero',
        children: [
          { type: 'text', name: 'n', text: '{cell.index}/{cell.count} r{cell.row}c{cell.column}' }
        ]
      }
    ]
  })

  it('un file di prima porta il gruppo dentro la griglia', () => {
    expect(tpl.front).toHaveLength(1)
    const grid = tpl.front[0]
    expect(grid.type === 'grid' && grid.groups.map((g) => g.name)).toEqual(['numero'])
  })

  it('lega una copia del gruppo per casella', () => {
    const bound = bindCard(tpl, rowToCard([], []))
    const [grid] = bound.template.front
    const cells = grid.type === 'grid' ? (grid.cells ?? []) : []
    expect(cells).toHaveLength(6)
    const text = (i: number): string => (cells[i].children[0] as TextLayer).text
    expect(text(0)).toBe('1/6 r1c1')
    expect(text(4)).toBe('5/6 r2c2')
    expect(bound.problems).toEqual([])
  })

  it('numero continuo per colonna, a serpentina, dall’ultima, saltando le nascoste', () => {
    const t = normalizeTemplate({
      name: 't',
      front: [
        {
          type: 'grid',
          name: 'g',
          rows: 2,
          columns: 3,
          content: 'c',
          cellRules: [{ when: '={cell.index}=2', hidden: true }],
          groups: [
            {
              type: 'group',
              name: 'c',
              children: [
                { type: 'text', name: 'a', source: { kind: 'formula', expr: '=CELLNUMBER()' } },
                {
                  type: 'text',
                  name: 'b',
                  source: { kind: 'formula', expr: '=CELLNUMBER("columns"; "snake")' }
                },
                {
                  type: 'text',
                  name: 'd',
                  source: { kind: 'formula', expr: '=CELLNUMBER("down"; "visible"; 10)' }
                }
              ]
            }
          ]
        }
      ]
    })
    const bound = bindCard(t, rowToCard([], []))
    const grid = bound.template.front[0]
    const cells = grid.type === 'grid' ? (grid.cells ?? []) : []
    const col = (k: number): string[] => cells.map((c) => (c.children[k] as TextLayer).text)
    expect(col(0)).toEqual(['1', '2', '3', '4', '5', '6'])
    // per colonna: 1 3 | 2 4 | … a serpentina la seconda colonna sale
    expect(col(1)).toEqual(['1', '4', '5', '2', '3', '6'])
    // la casella 2 è nascosta: restano 5 caselle, da 14 a 10
    expect(col(2)).toEqual(['14', '', '13', '12', '11', '10'])
    expect(bound.problems).toEqual([])
  })

  it('una regola con il suo gruppo prende il posto del contenuto', () => {
    const t = normalizeTemplate({
      name: 't',
      front: [
        {
          type: 'grid',
          name: 'g',
          rows: 1,
          columns: 3,
          content: 'c',
          cellRules: [{ when: '={cell.index}=3', content: 'r' }],
          groups: [
            { type: 'group', name: 'c', children: [{ type: 'text', name: 'a', text: 'base' }] },
            { type: 'group', name: 'r', children: [{ type: 'text', name: 'b', text: 'speciale' }] }
          ]
        }
      ]
    })
    const grid = bindCard(t, rowToCard([], [])).template.front[0]
    const cells = grid.type === 'grid' ? (grid.cells ?? []) : []
    expect(cells.map((c) => (c.children[0] as TextLayer).text)).toEqual([
      'base',
      'base',
      'speciale'
    ])
    // il gruppo della regola sta già nella sua casella (la terza): lì si disegna com'è
    const own = (t.front[0] as GridLayer).groups[1]
    const { centers } = gridGeometry(t.front[0] as GridLayer)
    expect(cells[2].x - own.x).toBeCloseTo(centers[0].x - centers[2].x)
  })

  it('segnala un gruppo che non c’è', () => {
    const t2 = normalizeTemplate({
      name: 't',
      front: [{ type: 'grid', name: 'g', content: 'manca' }]
    })
    expect(bindCard(t2, rowToCard([], [])).problems.map((p) => p.key)).toEqual(['bind.gridContent'])
  })

  it('il numero casuale è fisso per carta e casella', () => {
    const a = cellFields('g', 2, 3, 6, 1)['cell.random']
    expect(cellFields('g', 2, 3, 6, 1)['cell.random']).toBe(a)
    expect(Number(a)).toBeGreaterThan(0)
    expect(Number(a)).toBeLessThanOrEqual(999999)
  })

  it('porta sul livello immagine lo sfondo della variabile, con i colori risolti', () => {
    const tpl = normalizeTemplate({
      name: 't',
      front: [{ type: 'image', name: 'img', src: '{goccia}' }]
    })
    const variables = {
      goccia: { type: 'image' as const, src: 'icons/goccia', bg: 'circle', bgColor: 'rosso' },
      rosso: { type: 'color' as const, color: '#A33A2A' }
    }
    const img = bindCard(tpl, rowToCard([], []), { variables }).template.front[0]
    expect(img).toMatchObject({
      src: 'icons/goccia',
      backdrop: { shape: 'circle', color: '#A33A2A', pad: 0.18 }
    })
  })
})

describe('formula con risultato vuoto', () => {
  const tpl = normalizeTemplate({
    name: 't',
    front: [
      {
        type: 'text',
        name: 'nemici',
        text: '1',
        source: { kind: 'formula', expr: '=IF({forza} <= 4; "{forza}"; "")' }
      },
      {
        type: 'shape',
        name: 'fondo',
        fill: '#2F5DA8',
        source: { kind: 'formula', expr: '=IF({forza} <= 4; "#A33A2A"; "")' }
      }
    ]
  })
  it('un testo resta vuoto, un colore torna quello del template', () => {
    const [testo, fondo] = bindCard(tpl, rowToCard(['forza'], ['9'])).template.front
    expect((testo as TextLayer).text).toBe('')
    expect((fondo as ShapeLayer).fill).toBe('#2F5DA8')
    const [pieno] = bindCard(tpl, rowToCard(['forza'], ['3'])).template.front
    expect((pieno as TextLayer).text).toBe('3')
  })
})

describe('variabili con il nome di un campo', () => {
  const tpl = normalizeTemplate({
    name: 't',
    front: [
      { type: 'text', name: 'punti', text: '1' },
      { type: 'text', name: 'testo', text: '{punti} {forza}' }
    ]
  })
  it('avvisa se una variabile ha il nome di un livello o di una colonna', () => {
    const b = bindCard(tpl, rowToCard(['forza'], ['3']), {
      variables: {
        punti: { type: 'image', src: 'punti.png' },
        forza: { type: 'text', text: 'F' },
        oro: { type: 'text', text: 'O' }
      }
    })
    expect(b.problems.map((p) => `${p.key}:${p.params?.name}`)).toEqual([
      'bind.variableIsLayer:punti',
      'bind.variableIsColumn:forza'
    ])
  })
})
