import { describe, expect, it } from 'vitest'
import { bindCard, computedValues, rowToCard } from '../bind'
import { evaluateFormula } from '../formula'
import { localizeNumber, writeNumber } from '../number'
import { languageStyle, numberFormatting, numberStyleOf } from '../numberFormat'
import { normalizeTemplate } from '../normalize'
import type { ImageLayer, TextLayer } from '../template'

const IT = { decimal: ',', group: '.' } as const
const EN = { decimal: '.', group: ',' } as const

describe('formato dei numeri', () => {
  it('scrive un numero nel formato e lascia stare il resto', () => {
    expect(localizeNumber('2.5', IT)).toBe('2,5')
    expect(localizeNumber('1 234.50 €', IT)).toBe('1.234,50 €')
    expect(localizeNumber('1 234.5', EN)).toBe('1,234.5')
    expect(localizeNumber('-3.25%', IT)).toBe('-3,25%')
    // niente migliaia dove il foglio non le mette: un anno resta com'è
    expect(localizeNumber('2026', IT)).toBe('2026')
    for (const s of ['2026-10-18', 'v1.2', 'Drago 2.5', '1.2.3', ''])
      expect(localizeNumber(s, IT)).toBe(s)
    expect(writeNumber(7 / 3, IT)).toBe('2,333333')
    expect(writeNumber(12000, IT)).toBe('12000')
  })

  it('sceglie lo stile per lingua', () => {
    expect(languageStyle('it')).toBe('it')
    expect(languageStyle('en')).toBe('en')
    expect(languageStyle('fr')).toBe('fr')
    const file = { languages: ['it', 'en', 'de'], numberFormat: 'it' as const }
    expect(numberStyleOf(file)).toBe('it')
    expect(numberStyleOf(file, 'it')).toBe('it')
    expect(numberStyleOf(file, 'en')).toBe('en')
    expect(numberStyleOf({ ...file, numberFormats: { en: 'plain' } }, 'en')).toBe('plain')
    // senza impostazione la lingua principale resta come prima
    expect(numberStyleOf({ languages: ['it', 'en'] })).toBe('plain')
    expect(numberFormatting({})).toBeUndefined()
    // le formule si scrivono nella notazione della lingua principale, anche sulle carte inglesi
    expect(numberFormatting(file, 'en')).toEqual({ shown: EN, decimalComma: true })
  })

  it('nelle formule legge 2,5 quando la lingua principale usa la virgola', () => {
    expect(evaluateFormula('=MIN(2,5; 3)', {}, { decimalComma: true }).value).toBe('2.5')
    expect(evaluateFormula('=MIN(2,5; 3)', {}, { decimalComma: true, shown: IT }).value).toBe('2,5')
    expect(evaluateFormula('={a} * 1,5', { a: '2' }, { decimalComma: true }).value).toBe('3')
    expect(evaluateFormula('=MIN(2,5; 3)', {}).error).toBeTruthy()
  })

  it('scrive i risultati delle formule nel formato', () => {
    const n = { shown: IT }
    expect(evaluateFormula('{a} / {b}', { a: '5', b: '2' }, n).value).toBe('2,5')
    expect(evaluateFormula('Forza {a}', { a: '2.5' }, n).value).toBe('Forza 2,5')
    expect(evaluateFormula('="Forza " & {a} / 2', { a: '5' }, n).value).toBe('Forza 2,5')
    expect(evaluateFormula('=IF({a} > 1; {a}; 0)', { a: '1 234.5 €' }, n).value).toBe('1.234,5 €')
    // i nomi dei file e le date non cambiano
    expect(evaluateFormula('{a}.png', { a: 'drago' }, n).value).toBe('drago.png')
    expect(evaluateFormula('{d}', { d: '2026-10-18' }, n).value).toBe('2026-10-18')
  })

  const template = normalizeTemplate({
    name: 't',
    front: [
      { type: 'text', name: 'costo', text: '' },
      { type: 'text', name: 'testo', text: 'Costa {costo}, vale {valore}' },
      {
        type: 'value',
        name: 'valore',
        value: '',
        source: { kind: 'formula', expr: '{costo} * 2' }
      },
      {
        type: 'text',
        name: 'forza',
        text: '',
        source: { kind: 'formula', expr: '=IF({costo} > 1,5; {costo} / 2; 0)' }
      },
      { type: 'image', name: 'icona', src: '', source: { kind: 'formula', expr: '{costo}.png' } },
      { type: 'text', name: 'numero', text: '', source: { kind: 'column', column: 'n' } }
    ]
  })
  const texts = (l: { front: unknown[] }): Record<string, string> =>
    Object.fromEntries(
      (l.front as (TextLayer | ImageLayer)[]).map((x) => [
        x.name,
        x.type === 'text' ? x.text : x.src
      ])
    )
  const card = rowToCard(['costo', 'n'], ['2.5', '1 234.5'])
  const file = { languages: ['it', 'en'], numberFormat: 'it' as const }

  it('sulla carta i numeri seguono la lingua in cui si mostra', () => {
    const it_ = bindCard(template, card, { numbers: numberFormatting(file) })
    expect(it_.problems).toEqual([])
    expect(texts(it_.template)).toMatchObject({
      costo: '2,5',
      testo: 'Costa 2,5, vale 5',
      forza: '1,25',
      // il nome di un file resta quello del foglio
      icona: '2.5.png',
      numero: '1.234,5'
    })
    const en = bindCard(template, card, {
      localization: { language: 'en' },
      numbers: numberFormatting(file, 'en')
    })
    expect(texts(en.template)).toMatchObject({
      costo: '2.5',
      forza: '1.25',
      numero: '1,234.5'
    })
    // nella tabella i valori calcolati restano come li dà il foglio
    expect(computedValues(template, card, undefined, numberFormatting(file))).toMatchObject({
      forza: '1.25'
    })
  })
})
