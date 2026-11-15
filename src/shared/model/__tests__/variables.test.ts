import { describe, expect, it } from 'vitest'
import { bindCard, cardFields, rowToCard, substituteFields } from '../bind'
import { parseMarkup } from '../markup'
import { suggestAt } from '../markupHelp'
import { normalizeTemplate } from '../normalize'
import type { ImageLayer, ShapeLayer, TextLayer } from '../template'
import {
  mergeImageSettings,
  palette,
  parseImageAttrs,
  resolveColor,
  resolveFont,
  usedColors,
  variableFields,
  type Variables
} from '../variables'

const variables: Variables = {
  spada: { type: 'image', src: 'sword', tint: 'rosso' },
  pino: { type: 'text', text: '[pino]{color=green weight=700}' },
  bosco: { type: 'text', text: '{pino} e {max_mano}' },
  max_mano: { type: 'value', value: '7' },
  rosso: { type: 'color', color: '#A33A2A' },
  red: { type: 'color', color: '#B00000' }
}

const template = normalizeTemplate({
  name: 't',
  front: [
    {
      type: 'text',
      name: 'testo',
      text: 'Tieni {max_mano} carte {spada*2} {bosco}',
      color: 'rosso'
    },
    { type: 'shape', name: 'banda', fill: '{red}' },
    { type: 'image', name: 'icona', src: 'spada' },
    { type: 'value', name: 'limite', source: { kind: 'formula', expr: '{max_mano}+1' } }
  ]
})

describe('variabili', () => {
  it('testi e valori si espandono anche dentro altre variabili', () => {
    expect(variableFields(variables)).toMatchObject({
      max_mano: '7',
      bosco: '[pino]{color=green weight=700} e 7'
    })
  })

  it('i colori con nome usano la tavolozza, anche ridefinendo quelli standard', () => {
    const pal = palette(variables)
    expect(resolveColor('rosso', pal)).toBe('#A33A2A')
    expect(resolveColor('{red}', pal)).toBe('#B00000')
    expect(resolveColor('blue', pal)).toBe('blue')
  })

  it('applicate alla carta: testo, valore, colore e immagine', () => {
    const bound = bindCard(template, rowToCard([], []), { variables, assets: ['sword.svg'] })
    const [testo, banda, icona] = bound.template.front
    expect((testo as TextLayer).text).toBe(
      'Tieni 7 carte {spada*2} [pino]{color=green weight=700} e 7'
    )
    expect((testo as TextLayer).color).toBe('#A33A2A')
    expect((banda as ShapeLayer).fill).toBe('#B00000')
    expect((icona as ImageLayer).src).toBe('sword')
    expect((icona as ImageLayer).tint).toBe('#A33A2A')
    expect(bound.problems).toEqual([])
    expect(cardFields(template, rowToCard([], []), variables).limite).toBe('8')
  })

  it('un campo con lo stesso nome vince sulla variabile', () => {
    const bound = bindCard(template, rowToCard(['max_mano'], ['5']), { variables })
    expect((bound.template.front[0] as TextLayer).text).toMatch(/^Tieni 5 carte/)
  })

  it('compaiono nei suggerimenti del markup', () => {
    const ctx = { fields: [], assets: ['sword.svg'], styles: [], variables }
    const refs = suggestAt('{sp', 3, ctx)!.items.map((i) => `${i.kind}:${i.label}`)
    expect(refs).toContain('variable:spada')
    const colors = suggestAt('[a]{color=ro', 12, ctx)!.items
    expect(colors[0]).toMatchObject({ kind: 'variable', label: 'rosso', swatch: '#A33A2A' })
  })
})

describe('image attributes', () => {
  it('reads attributes after the name in braces', () => {
    const b = parseMarkup('a {spada*2 tint=red size=150% rotate=90 flip=h opacity=50%} b').blocks
    const ref = b[0].children.find((n) => n.t === 'ref')
    expect(ref).toMatchObject({
      name: 'spada',
      count: 2,
      image: { tint: 'red', scale: 1.5, rotate: 90, flip: 'h', opacity: 0.5 }
    })
  })

  it('reports invalid attributes', () => {
    const { problems } = parseMarkup('{spada flip=x}')
    expect(problems.map((p) => p.message.key)).toContain('markup.badImageAttr')
  })

  it('keeps names that are not followed by attributes', () => {
    expect(parseImageAttrs(' due parole')).toBeNull()
  })

  it('reads the outline of an inline image', () => {
    expect(parseImageAttrs('stroke=white/0.4')?.settings).toEqual({
      stroke: { color: 'white', width: 0.4 }
    })
    expect(parseImageAttrs('stroke=rosso/8%')?.settings).toEqual({
      stroke: { color: 'rosso', width: '8%' }
    })
    expect(parseImageAttrs('stroke=#FFFFFF')?.settings).toEqual({
      stroke: { color: '#FFFFFF', width: 0.3 }
    })
    expect(parseImageAttrs('stroke=none')?.settings).toEqual({ stroke: null })
    expect(parseImageAttrs('stroke=white/0')?.bad).toEqual(['stroke=white/0'])
    expect(parseImageAttrs('stroke=white/abc')?.bad).toEqual(['stroke=white/abc'])
    expect(mergeImageSettings({ stroke: { color: 'red', width: 1 } }, { stroke: null })).toEqual({
      stroke: null
    })
  })

  it('lets inline attributes override the variable, including none', () => {
    expect(mergeImageSettings({ tint: 'red', flip: 'h' }, { tint: null, flip: undefined })).toEqual(
      { tint: null, flip: undefined }
    )
  })

  it('substitutes a field name followed by attributes', () => {
    expect(substituteFields('{icona tint=red}', { icona: 'spada' })).toBe('{spada tint=red}')
    expect(substituteFields('{spada*n tint=red}', { n: '3' })).toBe('{spada*3 tint=red}')
  })
})

describe('variabili nel font', () => {
  const vars: Variables = {
    titoli: { type: 'text', text: 'Open Sans' },
    corpo: { type: 'text', text: '{titoli}' }
  }
  const t = normalizeTemplate({
    name: 't',
    front: [
      {
        type: 'text',
        name: 'nome',
        font: '{titoli}',
        text: 'Il [drago]{font={corpo}} e [altro]{font=Cinzel}'
      }
    ]
  })

  it('il font di un livello e font= nel markup prendono il testo della variabile', () => {
    const bound = bindCard(t, rowToCard([], []), { variables: vars, hasFont: () => true })
    const l = bound.template.front[0] as TextLayer
    expect(l.font).toBe('Open Sans')
    // nel markup gli spazi diventano _ come in font=Open_Sans
    expect(l.text).toBe('Il [drago]{font=Open_Sans} e [altro]{font=Cinzel}')
  })

  it('resolveFont risolve solo i nomi tra graffe di variabili note', () => {
    expect(resolveFont('{corpo}', vars)).toBe('Open Sans')
    expect(resolveFont('titoli', vars)).toBe('titoli')
    expect(resolveFont('{boh}', vars)).toBe('{boh}')
  })
})

describe('usedColors', () => {
  it('raccoglie i codici dal più usato, senza ripetizioni', () => {
    const t = {
      front: [{ fill: '#ff0000' }, { color: '#00FF00' }, { stroke: { color: '#FF0000' } }]
    }
    expect(usedColors([t, { titolo: 'color=#00ff00 #123' }, [['x', '#0000ff80']]])).toEqual([
      '#FF0000',
      '#00FF00',
      '#0000FF80'
    ])
  })
})
