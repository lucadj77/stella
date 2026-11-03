import { describe, expect, it } from 'vitest'
import { evaluateFormula } from '../formula'
import {
  addGenerated,
  choices,
  countChoices,
  emptyColumn,
  generateCards,
  countOrders,
  parseValues,
  parseWeighted,
  sequenceRound,
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

  it('più giri: finite le combinazioni si ricomincia dalla prima', () => {
    const P = ['orchi', 'golem', 'goblin', 'viverna']
    const spec = {
      columns: [col('para', P, { icons: false }), col('bonus', P, { icons: false })],
      filter: '{para}<>{bonus}',
      copies: 1
    }
    expect(generateCards(spec).rows).toHaveLength(12)
    const set = generateCards({ ...spec, repeatTo: 24 })
    expect(set.rows).toHaveLength(24)
    expect(set.rows[12]).toEqual(set.rows[0])
    expect(set.total).toBe(16)
    const odd = generateCards({ ...spec, repeatTo: 14 })
    expect(odd.rows[13]).toEqual(odd.rows[1])
    expect(generateCards({ ...spec, rounds: 3 }).rows).toHaveLength(36)
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

describe('generatore in sequenza', () => {
  const seqCol = (
    column: string,
    text: string,
    extra: Partial<GeneratorColumn> = {}
  ): GeneratorColumn => {
    const p = parseWeighted(text)
    return {
      ...col(column, p.values, { icons: false, ...extra }),
      sequence: p.sequence,
      weights: p.weights
    }
  }
  const run = (
    columns: GeneratorColumn[],
    count: number,
    shuffle: 'none' | 'block' | 'distinct' | 'all',
    seed = 7
  ): ReturnType<typeof generateCards> =>
    generateCards({ columns, filter: '', copies: 1, sequence: { count, shuffle, seed } })
  const firsts = (r: { rows: string[][] }): string[] => r.rows.map((x) => x[0])

  it('legge doppi e quantità', () => {
    expect(parseWeighted('a, a, b*3, 1-2*2')).toEqual({
      values: ['a', 'b', '1', '2'],
      weights: { a: 2, b: 3, '1': 2, '2': 2 },
      sequence: ['a', 'a', 'b', 'b', 'b', '1', '1', '2', '2']
    })
    expect(countOrders(['a', 'b', 'c'])).toBe(6)
    expect(countOrders(['a', 'a', 'b'])).toBe(3)
  })

  it('ripete la sequenza e fa girare gli insiemi ognuno per conto suo', () => {
    const r = run([seqCol('x', 'a, b, c'), seqCol('y', '1, 2')], 7, 'none')
    expect(r.headers).toEqual(['x', 'y', 'amount'])
    expect(r.rows.map((x) => x[0] + x[1])).toEqual(['a1', 'b2', 'c1', 'a2', 'b1', 'c2', 'a1'])
    expect(sequenceRound([seqCol('x', 'a, b, c'), seqCol('y', '1, 2')])).toBe(3)
    // più valori per carta: si prendono di seguito
    expect(firsts(run([seqCol('x', 'a, b, c', { pick: 2, separator: '+' })], 3, 'none'))).toEqual([
      'a+b',
      'c+a',
      'b+c'
    ])
  })

  it('mescola dentro ogni giro, con il seme', () => {
    const r = firsts(run([seqCol('x', 'a, b, c')], 30, 'block'))
    for (let i = 0; i < 30; i += 3) expect(r.slice(i, i + 3).sort()).toEqual(['a', 'b', 'c'])
    expect(firsts(run([seqCol('x', 'a, b, c')], 30, 'block'))).toEqual(r)
    expect(firsts(run([seqCol('x', 'a, b, c')], 30, 'block', 8))).not.toEqual(r)
  })

  it('senza ripetere un ordine finché ce ne sono', () => {
    const r = firsts(run([seqCol('x', 'a, b, c')], 18, 'distinct'))
    const rounds = (from: number): string[] =>
      [0, 1, 2, 3, 4, 5].map((k) => r.slice(from + k * 3, from + k * 3 + 3).join(''))
    expect(new Set(rounds(0)).size).toBe(6)
    // finiti i 6 ordini si ricomincia: altri 6, tutti diversi tra loro
    const more = firsts(run([seqCol('x', 'a, b, c')], 36, 'distinct'))
    const second = [0, 1, 2, 3, 4, 5].map((k) => more.slice(18 + k * 3, 21 + k * 3).join(''))
    expect(new Set(second).size).toBe(6)
    // con i doppi gli ordini diversi sono meno
    const d = firsts(run([seqCol('x', 'a, a, b')], 9, 'distinct'))
    expect(new Set([0, 3, 6].map((i) => d.slice(i, i + 3).join(''))).size).toBe(3)
  })

  it('mescola tutto il mazzo mantenendo le quantità', () => {
    const r = firsts(run([seqCol('x', 'rosso*4, blu*4, verde*4')], 12, 'all'))
    expect(r.filter((v) => v === 'rosso')).toHaveLength(4)
    expect(r.filter((v) => v === 'blu')).toHaveLength(4)
    expect(r).not.toEqual(firsts(run([seqCol('x', 'rosso*4, blu*4, verde*4')], 12, 'none')))
  })

  it('a caso le quantità sono pesi', () => {
    const r = generateCards({
      columns: [seqCol('x', 'oro*9, legno')],
      filter: '',
      copies: 1,
      random: { count: 1000, seed: 3, unique: false }
    })
    const oro = firsts(r).filter((v) => v === 'oro').length
    expect(oro).toBeGreaterThan(820)
    expect(oro).toBeLessThan(980)
  })
})
