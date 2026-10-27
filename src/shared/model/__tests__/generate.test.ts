import { describe, expect, it } from 'vitest'
import { evaluateFormula } from '../formula'
import {
  addGenerated,
  choices,
  countChoices,
  emptyColumn,
  generateCards,
  parseValues,
  type GeneratorColumn,
  type GeneratorSpec
} from '../generate'

const col = (
  column: string,
  values: string[],
  extra: Partial<GeneratorColumn> = {}
): GeneratorColumn => ({
  ...emptyColumn(column),
  values,
  ...extra
})

const R = ['legno', 'pietra', 'grano', 'oro']

describe('generatore di carte', () => {
  it('conta e elenca combinazioni e disposizioni, con e senza ripetizioni', () => {
    for (const [repeat, ordered, n] of [
      [false, false, 4],
      [true, false, 20],
      [false, true, 24],
      [true, true, 64]
    ] as const) {
      expect(countChoices(4, 3, repeat, ordered)).toBe(n)
      expect(choices(R, 3, repeat, ordered)).toHaveLength(n)
    }
    expect(choices(['a', 'b'], 2, true, false)).toEqual([
      ['a', 'a'],
      ['a', 'b'],
      ['b', 'b']
    ])
  })

  it('4 risorse, 3 icone per carta con ripetizioni: 20 carte in un solo campo', () => {
    const g = generateCards({
      columns: [col('costo', R, { pick: 3, repeat: true })],
      filter: '',
      copies: 1
    })
    expect(g.headers).toEqual(['costo', 'amount'])
    expect(g.rows).toHaveLength(20)
    expect(g.rows[0]).toEqual(['{legno}{legno}{legno}', '1'])
  })

  it('limiti per valore: oro al massimo una volta, legno almeno una', () => {
    const limits = { oro: { max: 1 }, legno: { min: 1 } }
    const list = choices(R, 3, true, false, limits)
    expect(list.every((c) => c.filter((v) => v === 'oro').length <= 1)).toBe(true)
    expect(list.every((c) => c.includes('legno'))).toBe(true)
    expect(countChoices(4, 3, true, false, R, limits)).toBe(list.length)
    // legno almeno 1: 10 multinsiemi; senza quelli con 2 o 3 ori (legno+oro+oro): 9
    expect(list).toHaveLength(9)
  })

  it('6 semi per i numeri 1-5: 30 carte, in due colonne o nello stesso campo', () => {
    const semi = ['spade', 'coppe', 'denari', 'bastoni', 'stelle', 'lune']
    const two = generateCards({
      columns: [col('seme', semi), col('numero', parseValues('1-5'))],
      filter: '',
      copies: 2
    })
    expect(two.rows).toHaveLength(30)
    expect(two.rows[1]).toEqual(['{spade}', '2', '2'])
    const one = generateCards({
      columns: [col('testo', semi), col('testo', parseValues('1..5'))],
      filter: '',
      copies: 1
    })
    expect(one.headers).toEqual(['testo', 'amount'])
    expect(one.rows[0]).toEqual(['{spade} 1', '1'])
  })

  it('il filtro usa le colonne e i singoli valori scelti', () => {
    const g = generateCards({
      columns: [col('costo', R, { pick: 3, repeat: true })],
      filter: 'AND(COUNTIN({costo}; "oro")<2; {costo_1}<>"grano")',
      copies: 1
    })
    expect(g.rows.length).toBeGreaterThan(0)
    expect(g.rows.every((r) => !r[0].startsWith('{grano}'))).toBe(true)
    expect(g.rows.every((r) => r[0].split('{oro}').length - 1 < 2)).toBe(true)
    expect(
      generateCards({ columns: [col('a', R)], filter: '=(', copies: 1 }).filterError
    ).toBeTruthy()
  })

  it('personaggi da una cartella: nomi delle immagini senza graffe', () => {
    const g = generateCards({
      columns: [col('ritratto', ['mago', 'ladra'], { icons: false })],
      filter: '',
      copies: 1
    })
    expect(g.rows).toEqual([
      ['mago', '1'],
      ['ladra', '1']
    ])
  })

  it('nel foglio aggiunge le colonne che mancano o sostituisce le righe', () => {
    const sheet = { name: 's', headers: ['amount', 'nome'], rows: [['1', 'vecchia']] }
    const g = generateCards({ columns: [col('seme', ['a', 'b'])], filter: '', copies: 1 })
    expect(addGenerated(sheet, g, 'append')).toEqual({
      name: 's',
      headers: ['amount', 'nome', 'seme'],
      rows: [
        ['1', 'vecchia', ''],
        ['1', '', '{a}'],
        ['1', '', '{b}']
      ]
    })
    expect(addGenerated(sheet, g, 'replace').rows).toHaveLength(2)
  })

  it('aggiorna solo le colonne generate delle carte presenti e accoda quelle in più', () => {
    const sheet = {
      name: 's',
      headers: ['seme', 'numero', 'amount'],
      rows: [
        ['{a}', '1', '2'],
        ['{b}', '2', '1']
      ]
    }
    const g = generateCards({
      columns: [col('ritratto', ['mago', 'ladra', 'guerriero'], { icons: false })],
      filter: '',
      copies: 1
    })
    expect(addGenerated(sheet, g, 'update')).toEqual({
      name: 's',
      headers: ['seme', 'numero', 'amount', 'ritratto'],
      rows: [
        ['{a}', '1', '2', 'mago'],
        ['{b}', '2', '1', 'ladra'],
        ['', '', '1', 'guerriero']
      ]
    })
    const two = generateCards({ columns: [col('numero', ['9'])], filter: '', copies: 1 })
    expect(addGenerated(sheet, two, 'update').rows).toEqual([
      ['{a}', '9', '2'],
      ['{b}', '2', '1']
    ])
  })

  it('COUNTIN conta le occorrenze', () => {
    expect(evaluateFormula('=COUNTIN("{oro}{oro}{legno}"; "{oro}")', {}).value).toBe('2')
  })
})

describe('carte a caso', () => {
  const numbers = col('text1', ['1', '2', '3', '4'], { more: ['text2', 'text3', 'text4'] })
  const random = (extra: Partial<GeneratorSpec['random']> = {}): GeneratorSpec['random'] => ({
    count: 50,
    seed: 7,
    unique: false,
    ...extra
  })

  it('un numero da 1 a 4 in ogni colonna, sempre uguale con lo stesso seme', () => {
    const spec = { columns: [{ ...numbers, repeat: true }], filter: '', copies: 2 }
    const a = generateCards({ ...spec, random: random() })
    expect(a.headers).toEqual(['text1', 'text2', 'text3', 'text4', 'amount'])
    expect(a.rows).toHaveLength(50)
    for (const r of a.rows) {
      expect(r.slice(0, 4).every((v) => ['1', '2', '3', '4'].includes(v))).toBe(true)
      expect(r[4]).toBe('2')
    }
    expect(generateCards({ ...spec, random: random() }).rows).toEqual(a.rows)
    expect(generateCards({ ...spec, random: random({ seed: 8 }) }).rows).not.toEqual(a.rows)
  })

  it('senza ripetizioni nessun valore torna nelle colonne dello stesso insieme', () => {
    const r = generateCards({
      columns: [numbers],
      filter: '',
      copies: 1,
      random: random({ count: 20 })
    })
    for (const row of r.rows) expect(new Set(row.slice(0, 4)).size).toBe(4)
  })

  it('i limiti contano le presenze in tutte le colonne dell’insieme', () => {
    const r = generateCards({
      columns: [{ ...numbers, repeat: true, limits: { '4': { min: 1, max: 3 } } }],
      filter: '',
      copies: 1,
      random: random({ count: 200 })
    })
    expect(r.rows).toHaveLength(200)
    const fours = r.rows.map((row) => row.slice(0, 4).filter((v) => v === '4').length)
    expect(Math.min(...fours)).toBe(1)
    expect(Math.max(...fours)).toBe(3)
    // il 4 obbligatorio non finisce sempre nell'ultima colonna
    expect(new Set(r.rows.map((row) => row.indexOf('4'))).size).toBeGreaterThan(1)
  })

  it('limiti impossibili, filtro e carte tutte diverse', () => {
    const base = { columns: [{ ...numbers, repeat: true }], copies: 1 }
    expect(
      generateCards({
        ...base,
        columns: [{ ...numbers, limits: { '1': { min: 2 } } }],
        filter: '',
        random: random()
      }).impossible
    ).toBe(true)
    const odd = generateCards({ ...base, filter: '{text1} = 1', random: random() })
    expect(odd.rows).toHaveLength(50)
    expect(odd.rows.every((r) => r[0] === '1')).toBe(true)
    // solo 4 carte diverse con un valore per colonna e una sola colonna
    const few = generateCards({
      columns: [col('n', ['1', '2', '3', '4'])],
      filter: '',
      copies: 1,
      random: random({ count: 10, unique: true })
    })
    expect(few.rows.map((r) => r[0]).sort()).toEqual(['1', '2', '3', '4'])
    expect(few.total).toBe(10)
  })

  it('più valori nella stessa cella con il separatore, come icone', () => {
    const r = generateCards({
      columns: [col('costo', R, { pick: 2, repeat: true, separator: ' ', more: ['premio'] })],
      filter: 'COUNTIN({costo}; "{oro}") = 0',
      copies: 1,
      random: random({ count: 10 })
    })
    expect(r.headers).toEqual(['costo', 'premio', 'amount'])
    for (const row of r.rows) {
      expect(row[0]).toMatch(/^\{\w+\} \{\w+\}$/)
      expect(row[0]).not.toContain('oro')
    }
  })
})
