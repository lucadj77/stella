import { describe, expect, it } from 'vitest'
import {
  markupProblems,
  parseAttrs,
  parseMarkup,
  plainText,
  resolveStyles,
  serializeAttrs,
  spanAt,
  type Inline
} from '../markup'

const inline = (src: string): Inline[] => parseMarkup(src).blocks[0].children

describe('markup: Markdown', () => {
  it('riconosce grassetto, corsivo e le altre decorazioni', () => {
    expect(inline('a **b** *c* ++d++ ~~e~~ ==f== x^2^ H~2~O')).toEqual([
      { t: 'text', text: 'a ' },
      { t: 'span', attrs: { styles: [], weight: 700 }, children: [{ t: 'text', text: 'b' }] },
      { t: 'text', text: ' ' },
      { t: 'span', attrs: { styles: [], italic: true }, children: [{ t: 'text', text: 'c' }] },
      { t: 'text', text: ' ' },
      { t: 'span', attrs: { styles: [], underline: true }, children: [{ t: 'text', text: 'd' }] },
      { t: 'text', text: ' ' },
      { t: 'span', attrs: { styles: [], strike: true }, children: [{ t: 'text', text: 'e' }] },
      { t: 'text', text: ' ' },
      {
        t: 'span',
        attrs: { styles: [], highlight: '#FFE58F' },
        children: [{ t: 'text', text: 'f' }]
      },
      { t: 'text', text: ' x' },
      { t: 'span', attrs: { styles: [], script: 'sup' }, children: [{ t: 'text', text: '2' }] },
      { t: 'text', text: ' H' },
      { t: 'span', attrs: { styles: [], script: 'sub' }, children: [{ t: 'text', text: '2' }] },
      { t: 'text', text: 'O' }
    ])
  })

  it('annida grassetto dentro corsivo', () => {
    const [span] = inline('*a **b** c*')
    expect(span).toMatchObject({ t: 'span', attrs: { italic: true } })
    expect(span.t === 'span' && span.children[1]).toMatchObject({ attrs: { weight: 700 } })
  })

  it('lascia come testo gli asterischi staccati e quelli senza chiusura', () => {
    expect(plainText('3 * 4 * 5')).toBe('3 * 4 * 5')
    expect(plainText('**aperto')).toBe('**aperto')
  })

  it('divide i paragrafi a ogni a capo e unisce le righe che finiscono con \\', () => {
    const { blocks } = parseMarkup('uno\\\ndue\n\ntre')
    expect(blocks.map((b) => b.children)).toEqual([
      [{ t: 'text', text: 'uno' }, { t: 'br' }, { t: 'text', text: 'due' }],
      [],
      [{ t: 'text', text: 'tre' }]
    ])
  })

  it('riconosce titoli, note, elenchi e separatori', () => {
    const { blocks } = parseMarkup('# T\n## S\n> n\n- a\n1. b\n2. c\n---')
    expect(blocks.map((b) => [b.kind, b.number])).toEqual([
      ['h1', undefined],
      ['h2', undefined],
      ['note', undefined],
      ['bullet', undefined],
      ['number', 1],
      ['number', 2],
      ['rule', undefined]
    ])
  })

  it('rispetta i caratteri con escape', () => {
    expect(plainText('\\{a\\} \\*b\\* \\[c]')).toBe('{a} *b* [c]')
  })
})

describe('markup: <br>', () => {
  it('va a capo dove il testo sta su una riga sola', () => {
    const br = [{ t: 'text', text: 'uno' }, { t: 'br' }, { t: 'text', text: 'due' }]
    expect(inline('uno<br>due')).toEqual(br)
    expect(inline('uno<br/>due')).toEqual(br)
    expect(inline('uno<BR />due')).toEqual(br)
    expect(plainText('uno<br>due')).toBe('uno due')
    expect(markupProblems('uno<br>due')).toEqual([])
  })

  it("il resto dell'HTML resta testo, e \\<br> si scrive com'è", () => {
    expect(inline('a <b> c')).toEqual([{ t: 'text', text: 'a <b> c' }])
    expect(inline('1 < 2')).toEqual([{ t: 'text', text: '1 < 2' }])
    expect(inline('\\<br>')).toEqual([{ t: 'text', text: '<br>' }])
  })
})

describe('markup: attributi', () => {
  it('legge stili, colori, dimensioni e contorni', () => {
    expect(parseAttrs('.keyword color=red size=+2 stroke=white/8% weight=800').attrs).toEqual({
      styles: ['keyword'],
      color: 'red',
      size: '+2',
      stroke: { color: 'white', width: '8%' },
      weight: 800
    })
  })

  it('legge i riquadri in linea', () => {
    expect(
      parseAttrs('border=red/0.3 radius=round pad=0.3/1 bg=shield bg-color=blue').attrs
    ).toEqual({
      styles: [],
      border: { color: 'red', width: 0.3 },
      radius: 'round',
      pad: [0.3, 1],
      bg: 'shield',
      bgColor: 'blue'
    })
  })

  it('segnala attributi sconosciuti e valori non validi', () => {
    const { problems } = parseAttrs('colour=red size=grande', 10)
    expect(problems.map((p) => [p.message.key, p.from, p.to])).toEqual([
      ['markup.unknownAttribute', 10, 20],
      ['markup.invalidValue', 21, 32]
    ])
  })

  it('applica gli attributi a una porzione di testo', () => {
    expect(inline('Bonus [pino]{.keyword} e [3]{bg=circle color=white}')).toEqual([
      { t: 'text', text: 'Bonus ' },
      { t: 'span', attrs: { styles: ['keyword'] }, children: [{ t: 'text', text: 'pino' }] },
      { t: 'text', text: ' e ' },
      {
        t: 'span',
        attrs: { styles: [], bg: 'circle', color: 'white' },
        children: [{ t: 'text', text: '3' }]
      }
    ])
  })

  it('riconosce gli attributi di paragrafo a inizio riga', () => {
    const [b] = parseMarkup('{.flavor center} *Il castello*').blocks
    expect(b.attrs).toEqual({ styles: ['flavor'], align: 'center' })
    expect(b.children[0]).toMatchObject({ t: 'span', attrs: { italic: true } })
  })

  it('a inizio riga una variabile resta una variabile', () => {
    expect(inline('{spada} attacca')[0]).toEqual({
      t: 'ref',
      name: 'spada',
      count: 1,
      raw: '{spada}'
    })
  })

  it('legge le icone ripetute', () => {
    expect(inline('{spada*3}')[0]).toMatchObject({ t: 'ref', name: 'spada', count: 3 })
  })
})

describe('markup: stili', () => {
  it('gli attributi scritti prevalgono sullo stile', () => {
    const a = resolveStyles(parseAttrs('.keyword color=blue').attrs, {
      keyword: 'color=green weight=700'
    })
    expect(a).toEqual({ styles: [], color: 'blue', weight: 700 })
  })

  it('i titoli hanno uno stile predefinito', () => {
    expect(resolveStyles({ styles: ['heading1'] }, {})).toMatchObject({ weight: 800 })
  })

  it('text-raise vale anche dentro uno stile', () => {
    const a = resolveStyles(parseAttrs('.cuore').attrs, {
      cuore: 'bg=cuore color=white text-raise=1'
    })
    expect(a).toMatchObject({ bg: 'cuore', color: 'white', textRaise: 1 })
    expect(parseAttrs('text-raise=alto').problems).toHaveLength(1)
  })

  it('segnala gli stili che non esistono', () => {
    expect(markupProblems('[a]{.nessuno}').map((p) => p.message)).toEqual([
      { key: 'markup.unknownStyle', params: { name: 'nessuno' } }
    ])
  })
})

describe('markup: scrittura degli attributi', () => {
  it('scrive gli attributi in modo che si rileggano uguali', () => {
    const src =
      '.keyword color=red size=+2 font=Open_Sans bold italic smallcaps stroke=white/8% border=red/0.3 radius=round pad=0.3/1 bg=circle bg-color=blue text-raise=1.5'
    const a = parseAttrs(src).attrs
    expect(serializeAttrs(a)).toBe(src)
    expect(parseAttrs(serializeAttrs(a)).attrs).toEqual(a)
  })

  it('trova la porzione con attributi intorno alla selezione', () => {
    const src = 'a [b [c]{color=red}]{.k} d'
    expect(spanAt(src, 6, 7)).toMatchObject({ start: 5, textFrom: 6, textTo: 7, end: 19 })
    expect(spanAt(src, 3, 4)).toMatchObject({ start: 2, attrsFrom: 21, attrsTo: 23 })
    expect(spanAt(src, 0, 1)).toBeNull()
  })
})

describe('markupProblems con i campi', () => {
  it('accetta un campo come numero di ripetizioni', () => {
    expect(markupProblems('{spada*forza}', {}, ['forza'])).toEqual([])
    expect(markupProblems('{spada*forza}').map((p) => p.message.key)).toEqual(['markup.badRepeat'])
    expect(markupProblems('{spada*x}', {}, ['forza']).map((p) => p.message.key)).toEqual([
      'markup.badRepeat'
    ])
  })
})

describe('porzioni da non spezzare', () => {
  it('_..._ è una porzione nowrap, anche con icone e spazi', () => {
    expect(parseMarkup('Paga _4{pp}_ e _2 {oro}_.').blocks[0].children).toMatchObject([
      { t: 'text', text: 'Paga ' },
      {
        t: 'span',
        attrs: { nowrap: true },
        children: [
          { t: 'text', text: '4' },
          { t: 'ref', name: 'pp' }
        ]
      },
      { t: 'text', text: ' e ' },
      { t: 'span', attrs: { nowrap: true } },
      { t: 'text', text: '.' }
    ])
    expect(parseMarkup('7{p} x _{ma}{mb}{mc}_{md}').blocks[0].children).toMatchObject([
      { t: 'text' },
      { t: 'ref', name: 'p' },
      { t: 'text', text: ' x ' },
      { t: 'span', attrs: { nowrap: true } },
      { t: 'ref', name: 'md' }
    ])
  })

  it('un _ dentro una parola resta testo', () => {
    expect(parseMarkup('nome_del_file e a_b').blocks[0].children).toEqual([
      { t: 'text', text: 'nome_del_file e a_b' }
    ])
    expect(parseMarkup('\\_4_').blocks[0].children).toEqual([{ t: 'text', text: '_4_' }])
  })

  it('nowrap tiene insieme una porzione intera', () => {
    expect(parseMarkup('[4 punti]{nowrap}').blocks[0].children[0]).toMatchObject({
      t: 'span',
      attrs: { nowrap: true }
    })
  })
})
