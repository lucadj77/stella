import { describe, expect, it } from 'vitest'
import {
  documentComments,
  withoutComments,
  cardRefSource,
  DEFAULT_DOC_SETTINGS,
  documentProblems,
  documentProperties,
  figureAlign,
  imageSourceWith,
  splitImageSource,
  documentSettings,
  documentText,
  findCard,
  parseCardRef,
  anatomySource,
  layerBounds,
  parseDocument,
  tableSource,
  withDocumentProperties,
  withDocumentSettings
} from '../document'
import { applyStyle, changedRange, setHeading, toggleLines, toggleWrap } from '../docEdit'
import type { LoadedSet } from '../../project'

const sets: LoadedSet[] = [
  {
    name: 'Personaggi',
    template: 'personaggio',
    data: {
      name: 'Personaggi',
      headers: ['nome', 'forza'],
      rows: [
        ['Mago', '2'],
        ['Guerriero', '5']
      ]
    }
  }
]

describe('documenti: blocchi', () => {
  it('riconosce titoli, paragrafi, elenchi, citazioni, righe e codice', () => {
    const src = [
      '# Regole',
      '',
      'Prima riga',
      'stesso paragrafo.',
      '',
      '## Preparazione',
      '- uno',
      '  - dentro',
      '- due',
      '',
      '3. tre',
      '4. quattro',
      '',
      '> Nota **importante**',
      '',
      '---',
      '```',
      '{non markup}',
      '```',
      '#### Quarto livello'
    ].join('\n')
    const blocks = parseDocument(src)
    expect(blocks.map((b) => b.kind)).toEqual([
      'heading',
      'paragraph',
      'heading',
      'list',
      'list',
      'quote',
      'rule',
      'code',
      'heading'
    ])
    expect(blocks[1]).toMatchObject({ text: 'Prima riga stesso paragrafo.' })
    expect(blocks[3]).toMatchObject({
      items: [
        { text: 'uno', depth: 0, ordered: false },
        { text: 'dentro', depth: 1 },
        { text: 'due', depth: 0 }
      ]
    })
    expect(blocks[4]).toMatchObject({
      items: [
        { text: 'tre', number: 3 },
        { text: 'quattro', number: 4 }
      ]
    })
    expect(blocks[7]).toMatchObject({ text: '{non markup}' })
    expect(blocks[8]).toMatchObject({ level: 3, text: 'Quarto livello' })
  })

  it('una riga con sole immagini è una figura, con la posizione di ogni immagine', () => {
    const src = 'Testo\n\n![Mago](card:Personaggi/1) ![](card:Personaggi/2?side=back)'
    const [, fig] = parseDocument(src)
    expect(fig.kind).toBe('figure')
    if (fig.kind !== 'figure') return
    expect(fig.images.map((i) => [i.alt, i.src])).toEqual([
      ['Mago', 'card:Personaggi/1'],
      ['', 'card:Personaggi/2?side=back']
    ])
    expect(src.slice(fig.images[0].from, fig.images[0].to)).toBe('![Mago](card:Personaggi/1)')
  })

  it('legge le tabelle con allineamento e \\| nelle celle', () => {
    const [t] = parseDocument('| Carta | Costo |\n|:--|--:|\n| Mago | 2 \\| 3 |\n| Re |')
    expect(t).toMatchObject({
      kind: 'table',
      header: ['Carta', 'Costo'],
      align: ['left', 'right'],
      rows: [
        ['Mago', '2 | 3'],
        ['Re', '']
      ]
    })
  })

  it('va a capo con due spazi o \\ a fine riga', () => {
    const [p] = parseDocument('uno  \ndue\\\ntre')
    expect(p).toMatchObject({ text: 'uno\ndue\ntre' })
  })
})

describe('documenti: carte', () => {
  it('legge i riferimenti alle carte', () => {
    expect(parseCardRef('card:Personaggi/2')).toEqual({ set: 'Personaggi', row: 2, side: 'front' })
    expect(parseCardRef('card:Carte rare/nome=Re%20nero?side=back&width=40')).toEqual({
      set: 'Carte rare',
      field: 'nome',
      value: 'Re nero',
      side: 'back',
      width: 40
    })
    expect(parseCardRef('card:Personaggi')).toMatchObject({ key: 'doc.card.badRef' })
    expect(parseCardRef('card:Personaggi/1?zoom=2')).toMatchObject({ key: 'doc.card.badOption' })
  })

  it('scrive i riferimenti in modo che si rileggano uguali', () => {
    const ref = { set: 'P', field: 'nome', value: 'A (b)?', side: 'back' as const, width: 30 }
    expect(cardRefSource(ref)).toBe('card:P/nome=A (b%29%3F?side=back&width=30')
    expect(parseCardRef(cardRefSource(ref))).toEqual(ref)
  })

  it('trova la carta per numero o per valore di un campo, senza badare alle maiuscole', () => {
    expect(findCard({ set: 'personaggi', row: 2, side: 'front' }, sets)).toMatchObject({ row: 1 })
    expect(
      findCard({ set: 'Personaggi', field: 'NOME', value: 'guerriero', side: 'front' }, sets)
    ).toMatchObject({ row: 1 })
    expect(findCard({ set: 'Mostri', row: 1, side: 'front' }, sets)).toMatchObject({
      key: 'doc.card.noSet'
    })
    expect(findCard({ set: 'Personaggi', row: 3, side: 'front' }, sets)).toMatchObject({
      key: 'doc.card.noRow'
    })
    expect(
      findCard({ set: 'Personaggi', field: 'nome', value: 'Re', side: 'front' }, sets)
    ).toMatchObject({ key: 'doc.card.noValue' })
  })
})

describe('documenti: testo e controllo', () => {
  it('sostituisce le variabili di testo e i collegamenti', () => {
    const variables = { vita: { type: 'text' as const, text: '3 vite' } }
    expect(
      documentText('Hai {vita} in {project.name}, vedi [qui](https://x.it)', {
        project: 'Farmony',
        variables
      })
    ).toBe('Hai 3 vite in Farmony, vedi [qui]{underline}')
  })

  it('segnala carte, immagini, stili e nomi che non si trovano', () => {
    const src = [
      'Ottieni {cuore} e {mistero} con [x]{.nessuno}',
      '',
      '![](card:Personaggi/9) ![](card:Personaggi/1) ![](icone/nulla.png)'
    ].join('\n')
    const problems = documentProblems(src, {
      sets,
      assets: ['icons/cuore.svg'],
      styles: {}
    })
    expect(problems.map((p) => p.message.key).sort()).toEqual([
      'doc.card.noRow',
      'doc.missingImage',
      'doc.unknownRef',
      'markup.unknownStyle'
    ])
    const row = problems.find((p) => p.message.key === 'doc.card.noRow')!
    expect(src.slice(row.from, row.to)).toBe('![](card:Personaggi/9)')
  })
})

describe('impostazioni della pagina', () => {
  const src =
    '---\nsize: 12\nlineHeight: 1,6\nfont: "Alegreya"\ncolour: red\nalign: center\n---\n# Regole\n'

  it('si leggono dalla testa, che non è testo', () => {
    const { settings, problems } = documentSettings(src)
    expect(settings).toMatchObject({ size: 12, lineHeight: 1.6, font: 'Alegreya', page: 'A4' })
    expect(problems.map((p) => p.message.key)).toEqual(['doc.setting.unknown', 'doc.setting.bad'])
    expect(src.slice(problems[0].from, problems[0].to)).toBe('colour: red')
    expect(parseDocument(src)).toEqual([
      { kind: 'heading', level: 1, text: 'Regole', from: src.indexOf('#') }
    ])
  })

  it('un --- che non apre impostazioni resta una riga', () => {
    expect(documentSettings('---\nTesto\n---\n').settings).toEqual(DEFAULT_DOC_SETTINGS)
    expect(parseDocument('---\nTesto')[0].kind).toBe('rule')
  })

  it('si scrivono e si tolgono', () => {
    const one = withDocumentSettings('# Regole\n', { size: 12, page: 'A5' })
    expect(one).toBe('---\nsize: 12\npage: A5\n---\n\n# Regole\n')
    const two = withDocumentSettings(one, { size: 11, margin: 10 })
    expect(two).toBe('---\npage: A5\nmargin: 10\n---\n\n# Regole\n')
    expect(withDocumentSettings(two, { page: 'A4', margin: 18 })).toBe('# Regole\n')
  })
})

describe('tabelle', () => {
  it('si riscrivono dal testo e tornano uguali', () => {
    const md = tableSource(
      ['Azione', 'Costo'],
      [null, 'center'],
      [['Attacco | forte', '1'], ['Difesa']]
    )
    expect(md).toBe(
      '| Azione           | Costo |\n| ---------------- | :---: |\n| Attacco \\| forte | 1     |\n| Difesa           |       |'
    )
    const src = `Testo\n\n${md}\n\nAltro`
    const t = parseDocument(src).find((b) => b.kind === 'table')!
    expect(t).toMatchObject({
      header: ['Azione', 'Costo'],
      align: [null, 'center'],
      rows: [
        ['Attacco | forte', '1'],
        ['Difesa', '']
      ]
    })
    expect(src.slice(t.from, t.kind === 'table' ? t.to : 0)).toBe(md)
  })
})

describe('anatomia della carta', () => {
  const src = anatomySource('Personaggi/nome=Mago', [
    { layer: 'nome', label: 'Il **nome**' },
    { layer: 'forza', label: 'Forza', side: 'left' }
  ])

  it('si scrive e si rilegge', () => {
    expect(src).toBe(
      '```anatomy\ncard: Personaggi/nome=Mago\n- nome: Il **nome**\n- forza (left): Forza\n```'
    )
    const [b] = parseDocument(`${src}\n\nDopo`)
    expect(b).toMatchObject({
      kind: 'anatomy',
      card: 'Personaggi/nome=Mago',
      callouts: [
        { layer: 'nome', label: 'Il **nome**' },
        { layer: 'forza', label: 'Forza', side: 'left' }
      ],
      bad: [],
      from: 0,
      to: src.length
    })
  })

  it('fronte e retro: sides: both e (back) sulle etichette del retro', () => {
    const both = anatomySource(
      'Personaggi/1',
      [
        { layer: 'nome', label: 'Nome', face: 'front' },
        { layer: 'logo', label: 'Logo', face: 'back' }
      ],
      true
    )
    expect(both).toBe(
      '```anatomy\ncard: Personaggi/1\nsides: both\n- nome: Nome\n- logo (back): Logo\n```'
    )
    const [b] = parseDocument(both)
    expect(b).toMatchObject({
      kind: 'anatomy',
      both: true,
      callouts: [{ layer: 'nome' }, { layer: 'logo', face: 'back' }],
      bad: []
    })
    // le due opzioni insieme si leggono ancora
    const [c] = parseDocument('```anatomy\ncard: X/1\n- a (back, left): A\n```')
    expect(c).toMatchObject({ callouts: [{ layer: 'a', face: 'back', side: 'left' }] })
  })

  it('segnala righe, carte e livelli sbagliati', () => {
    const templates = [
      {
        name: 'personaggio',
        width: 63,
        height: 88,
        front: [
          { type: 'text', name: 'nome', x: 6, y: 4, w: 51, h: 9, rotation: 0, anchor: 'center' }
        ],
        back: []
      }
    ] as never
    const text = '```anatomy\ncard: Personaggi/1\n- nome: Nome\n- zampa: Zampa\nboh\n```'
    const problems = documentProblems(text, { sets, templates })
    expect(problems.map((p) => p.message.key)).toEqual([
      'doc.anatomy.noLayer',
      'doc.anatomy.badLine'
    ])
    expect(documentProblems('```anatomy\n- nome: x\n```', { sets })[0].message.key).toBe(
      'doc.anatomy.noCard'
    )
  })

  it('trova il riquadro del livello, anche ignorando le maiuscole', () => {
    const layers = [
      { type: 'text', name: 'Nome', x: 6, y: 4, w: 50, h: 10, rotation: 0, anchor: 'center' }
    ] as never
    expect(layerBounds(layers, 'nome')).toEqual({ x: 6, y: 4, w: 50, h: 10 })
    expect(layerBounds(layers, 'altro')).toBeNull()
  })
})

describe('proprietà del documento', () => {
  const src = [
    '---',
    'title: Farmony',
    'tags:',
    '  - regolamento',
    '  - "bozza"',
    'versione: 0.3',
    'riassunto: "Un gioco',
    '  di fattorie"',
    'size: 12',
    '---',
    '# Regole',
    ''
  ].join('\n')

  it('si leggono dalla testa, accanto alle impostazioni', () => {
    expect(documentProperties(src)).toEqual([
      { key: 'title', value: 'Farmony', list: false },
      { key: 'tags', value: 'regolamento, bozza', list: true },
      { key: 'versione', value: '0.3', list: false },
      { key: 'riassunto', value: 'Un gioco di fattorie', list: false }
    ])
    const { settings, problems } = documentSettings(src)
    expect(settings.size).toBe(12)
    expect(problems).toEqual([])
    // non si stampano
    expect(parseDocument(src).map((b) => b.kind)).toEqual(['heading'])
  })

  it('con showProperties si stampano in una tabella senza intestazione', () => {
    const shown = withDocumentSettings(src, { showProperties: true })
    const [table] = parseDocument(shown)
    expect(table).toMatchObject({
      kind: 'table',
      header: [],
      rows: [
        ['**title**', 'Farmony'],
        ['**tags**', 'regolamento, bozza'],
        ['**versione**', '0.3'],
        ['**riassunto**', 'Un gioco di fattorie']
      ]
    })
    // le proprietà restano quando cambiano le impostazioni
    expect(documentProperties(shown)).toEqual(documentProperties(src))
  })

  it('si scrivono senza toccare le impostazioni', () => {
    // quelle che non cambiano restano scritte com'erano
    expect(withDocumentProperties(src, documentProperties(src))).toBe(src)
    const out = withDocumentProperties(src, [
      { key: 'title', value: 'Farmony: il gioco', list: false },
      { key: 'tags', value: 'regolamento, finale', list: true }
    ])
    expect(out).toBe(
      '---\ntitle: "Farmony: il gioco"\ntags: [regolamento, finale]\nsize: 12\n---\n# Regole\n'
    )
    expect(documentSettings(out).settings.size).toBe(12)
    expect(
      withDocumentProperties('# Regole\n', [{ key: 'autore', value: 'Luca', list: false }])
    ).toBe('---\nautore: Luca\n---\n\n# Regole\n')
    // senza proprietà e impostazioni la testa sparisce
    expect(withDocumentProperties('---\nautore: Luca\n---\n\n# Regole\n', [])).toBe('# Regole\n')
  })
})

describe('barra di formattazione', () => {
  it('mette e toglie grassetto, corsivo, sottolineato', () => {
    const a = toggleWrap('una parola qui', 4, 10, '**')
    expect(a).toEqual({ text: 'una **parola** qui', from: 6, to: 12 })
    expect(toggleWrap(a.text, a.from, a.to, '**')).toEqual({
      text: 'una parola qui',
      from: 4,
      to: 10
    })
    expect(toggleWrap(a.text, 4, 14, '**').text).toBe('una parola qui')
    // il corsivo dentro un grassetto non toglie le stelle del grassetto
    expect(toggleWrap(a.text, 6, 12, '*').text).toBe('una ***parola*** qui')
    // gli spazi restano fuori
    expect(toggleWrap('a parola b', 1, 9, '++').text).toBe('a ++parola++ b')
    expect(toggleWrap('ab', 1, 1, '~~')).toEqual({ text: 'a~~~~b', from: 3, to: 3 })
  })

  it('titoli ed elenchi sulle righe scelte', () => {
    expect(setHeading('uno\n## due\ntre', 5, 6, 1).text).toBe('uno\n# due\ntre')
    expect(setHeading('# uno', 2, 2, 0)).toEqual({ text: 'uno', from: 0, to: 0 })
    const list = toggleLines('a\n\nb\nc', 0, 6, 'number')
    expect(list.text).toBe('1. a\n\n2. b\n3. c')
    expect(toggleLines(list.text, 0, list.text.length, 'number').text).toBe('a\n\nb\nc')
    expect(toggleLines('1. a\n2. b', 0, 9, 'bullet').text).toBe('- a\n- b')
    expect(toggleLines('a', 0, 0, 'quote').text).toBe('> a')
  })

  it('applica uno stile alla selezione o alla porzione', () => {
    expect(applyStyle('una parola', 4, 10, 'keyword', 'testo').text).toBe('una [parola]{.keyword}')
    expect(applyStyle('[x]{.a color=red}', 1, 1, 'b', 'testo').text).toBe('[x]{.b color=red}')
    expect(applyStyle('ab', 1, 1, 'note', 'testo')).toEqual({
      text: 'a[testo]{.note}b',
      from: 2,
      to: 7
    })
    expect(applyStyle('- uno\n- due', 0, 11, 'k', 't').text).toBe('- [uno]{.k}\n- [due]{.k}')
  })

  it('cambia solo il tratto diverso', () => {
    expect(changedRange('abcdef', 'abXYef')).toEqual({ from: 2, to: 4, insert: 'XY' })
    expect(changedRange('aa', 'aaa')).toEqual({ from: 2, to: 2, insert: 'a' })
  })
})

describe('opzioni delle immagini', () => {
  it('larghezza e allineamento dopo ?', () => {
    expect(splitImageSource('icone/mappa.png?width=40&align=left')).toEqual({
      path: 'icone/mappa.png',
      options: { width: 40, align: 'left' },
      bad: []
    })
    expect(splitImageSource('mappa.png?size=3').bad).toEqual(['size=3'])
    // un indirizzo web resta intero
    expect(splitImageSource('https://x.it/a.png?w=1').path).toBe('https://x.it/a.png?w=1')
    expect(imageSourceWith('mappa.png', { width: 30, align: 'right' })).toBe(
      'mappa.png?width=30&align=right'
    )
    expect(imageSourceWith('mappa.png', { align: 'center' })).toBe('mappa.png')
    expect(parseCardRef('card:Personaggi/1?align=right')).toMatchObject({ align: 'right' })
    expect(figureAlign([{ src: 'a.png' }, { src: 'card:S/1?align=left' }])).toBe('left')
    expect(figureAlign([{ src: 'a.png' }])).toBe('center')
  })

  it('si segnalano le opzioni sbagliate', () => {
    const problems = documentProblems('![](mappa.png?colore=rosso)\n', { assets: ['mappa.png'] })
    expect(problems.map((p) => p.message.key)).toContain('doc.image.badOption')
    expect(documentProblems('![](mappa.png?width=20)\n', { assets: ['mappa.png'] })).toEqual([])
  })
})

describe('commenti', () => {
  it('un commento sparisce dal documento, anche su più righe, e le posizioni restano', () => {
    const src = 'Prima %%da rivedere%% parte.\n\n%%Paragrafo\nnascosto%%\n\nUltimo.'
    const blocks = parseDocument(src)
    expect(blocks.map((b) => (b.kind === 'paragraph' ? b.text.trim() : b.kind))).toEqual([
      'Prima                 parte.',
      'Ultimo.'
    ])
    expect(blocks[1].from).toBe(src.indexOf('Ultimo'))
    expect(withoutComments(src)).toHaveLength(src.length)
  })
  it('senza la chiusura il commento arriva alla fine', () => {
    expect(documentComments('Testo %%resto')).toEqual([{ from: 6, to: 13 }])
    expect(parseDocument('Testo %%resto\n\naltro').length).toBe(1)
  })
})
