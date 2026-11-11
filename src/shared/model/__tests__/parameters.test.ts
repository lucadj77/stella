import { describe, expect, it } from 'vitest'
import { bindCard, rowToCard, substituteFields } from '../bind'
import { normalizeTemplate } from '../normalize'
import type { TextLayer } from '../template'
import { variableFields, type Variables } from '../variables'

const variables: Variables = {
  raccogli: { type: 'text', text: '[Raccogli {1}]{.keyword}: pesca {1} carte' },
  scambio: { type: 'text', text: 'Dai {1}, ricevi {2}' },
  doppio: { type: 'text', text: '{raccogli:{1}} e {scambio:{1}:{2}}' },
  moneta: { type: 'text', text: '[{1}]{bg=circle}' },
  pesca: { type: 'text', text: 'prendi {1} {1|carta|carte}' },
  dai: { type: 'text', text: '{1|una moneta|{1} monete|niente}, {2} {2|legno|legni}' }
}
const fields = { ...variableFields(variables), forza: '3' }

describe('variabili con parametri', () => {
  it('mette i parametri al posto di {1}, {2}', () => {
    expect(substituteFields('{raccogli:2}', fields)).toBe('[Raccogli 2]{.keyword}: pesca 2 carte')
    expect(substituteFields('A {scambio:3:1} B {moneta:5}', fields)).toBe(
      'A Dai 3, ricevi 1 B [5]{bg=circle}'
    )
  })

  it('accetta un campo come parametro e più usi nello stesso testo', () => {
    expect(substituteFields('{moneta:{forza}} {moneta:1}', fields)).toBe(
      '[3]{bg=circle} [1]{bg=circle}'
    )
  })

  it('richiama altre variabili con parametri', () => {
    expect(substituteFields('{doppio:4:2}', fields)).toBe(
      '[Raccogli 4]{.keyword}: pesca 4 carte e Dai 4, ricevi 2'
    )
  })

  it('{1|carta|carte} sceglie il singolare con 1, il plurale altrimenti', () => {
    expect(substituteFields('{pesca:1}', fields)).toBe('prendi 1 carta')
    expect(substituteFields('{pesca:3}', fields)).toBe('prendi 3 carte')
    // un parametro che non è un numero (la X di un glossario) prende il plurale
    expect(substituteFields('{pesca:X}', fields)).toBe('prendi X carte')
    // senza terza forma lo zero è plurale
    expect(substituteFields('{pesca:0}', fields)).toBe('prendi 0 carte')
    expect(substituteFields('{pesca:{forza}}', { ...fields, forza: '1' })).toBe('prendi 1 carta')
  })

  it('la terza forma vale per lo zero, e le forme possono contenere il parametro', () => {
    expect(substituteFields('{dai:1:1}', fields)).toBe('una moneta, 1 legno')
    expect(substituteFields('{dai:4:2}', fields)).toBe('4 monete, 2 legni')
    expect(substituteFields('{dai:0:2}', fields)).toBe('niente, 2 legni')
  })

  it('\\: è un due punti scritto', () => {
    expect(substituteFields('{scambio:a\\:b:c}', fields)).toBe('Dai a:b, ricevi c')
  })

  it('un parametro che manca resta vuoto e si segnala', () => {
    const missing: string[] = []
    expect(substituteFields('{scambio:3}', fields, {}, (n, i) => missing.push(`${n}${i}`))).toBe(
      'Dai 3, ricevi '
    )
    expect(substituteFields('{moneta}', fields, {}, (n, i) => missing.push(`${n}${i}`))).toBe(
      '[]{bg=circle}'
    )
    expect(missing).toEqual(['scambio2', 'moneta1'])
  })

  it('lascia stare i nomi sconosciuti e le immagini con attributi', () => {
    expect(substituteFields('{boh:2} {spada tint=red}', fields)).toBe('{boh:2} {spada tint=red}')
  })

  it('sulla carta segnala il parametro mancante', () => {
    const t = normalizeTemplate({
      name: 't',
      front: [{ type: 'text', name: 'testo', text: '{scambio:1}' }]
    })
    const bound = bindCard(t, rowToCard([], []), { variables })
    expect((bound.template.front[0] as TextLayer).text).toBe('Dai 1, ricevi ')
    expect(bound.problems.map((p) => p.key)).toContain('bind.missingParameter')
  })
})

describe("variabili con parametri nell'editor", () => {
  it('colora nome, due punti e parametri', async () => {
    const { highlightMarkup } = await import('../markupHighlight')
    const src = 'Fai {scambio:3:1}'
    const parts = highlightMarkup(src).map((p) => [src.slice(p.from, p.to), p.kind])
    expect(parts).toEqual([
      ['{', 'punct'],
      ['scambio', 'ref'],
      [':', 'punct'],
      ['3', 'value'],
      [':', 'punct'],
      ['1', 'value'],
      ['}', 'punct']
    ])
  })

  it('i parametri con spazi non sono attributi di immagine', async () => {
    const { markupProblems } = await import('../markup')
    expect(markupProblems('{cerca:spada di fuoco}')).toEqual([])
  })

  it('i suggerimenti propongono raccogli: per le variabili con parametri', async () => {
    const { suggestAt } = await import('../markupHelp')
    const r = suggestAt('{racc', 5, { fields: [], assets: [], styles: [], variables })
    expect(r?.items[0]).toMatchObject({ label: 'raccogli:…', insert: 'raccogli:' })
  })
})

describe('rinomina', () => {
  it('aggiorna i richiami con parametri', async () => {
    const { renameInText } = await import('../rename')
    expect(
      renameInText(
        '{raccogli:2} {raccogli:{forza}} {raccogliere:1}',
        'variable',
        'raccogli',
        'pesca'
      )
    ).toBe('{pesca:2} {pesca:{forza}} {raccogliere:1}')
  })
})

describe('variabili con nomi di sole cifre', () => {
  it('nel testo di una variabile {1} resta un parametro', () => {
    const vars: Variables = { ...variables, '1': { type: 'text', text: 'uno' } }
    const f = variableFields(vars)
    expect(substituteFields('{raccogli:2}', f)).toBe('[Raccogli 2]{.keyword}: pesca 2 carte')
    expect(substituteFields('{1}', f)).toBe('uno')
  })

  it('un nome nuovo non può essere di sole cifre', async () => {
    const { isValidVariableName } = await import('../variables')
    expect(isValidVariableName('1')).toBe(false)
    expect(isValidVariableName('d6')).toBe(true)
  })
})
