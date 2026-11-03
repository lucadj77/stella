import { describe, expect, it } from 'vitest'
import type { Sheet } from '../../project'
import { normalizeTemplate } from '../normalize'
import {
  atLeast,
  columnStats,
  columnValues,
  diceDistribution,
  fieldValues,
  measure,
  nearlyUnique,
  pivot,
  rowAmounts,
  scatter,
  shuffled,
  summarize,
  textCounts,
  toMarkdown,
  toTsv
} from '../stats'

const t = normalizeTemplate({
  name: 't',
  front: [
    { type: 'text', name: 'nome' },
    { type: 'value', name: 'costo', value: '0' },
    { type: 'value', name: 'doppio', source: { kind: 'formula', expr: '={costo}*2' } }
  ]
})

const sheet: Sheet = {
  name: 'S',
  headers: ['amount', 'nome', 'costo', 'tipo'],
  rows: [
    ['2', 'A', '1', 'arma'],
    ['', 'B', '3', 'arma'],
    ['3', 'C', '1', 'magia'],
    ['1', 'D', '', '']
  ]
}

describe('statistiche del set', () => {
  const rows = [0, 1, 2, 3]

  it('una cella vuota vale il valore del template, e si sa da dove viene', () => {
    const f = fieldValues(sheet, 'costo', rows, t, [t])
    expect(f.values).toEqual(['1', '3', '1', '0'])
    expect(f.fromTemplate).toEqual([false, false, false, true])
    const s = columnStats('costo', f.values, rowAmounts(sheet, rows), f.fromTemplate)
    expect(s.groups.find((g) => g.value === '0')).toEqual({
      value: '0',
      rows: 1,
      cards: 1,
      fromTemplate: 1
    })
  })

  it('conta le carte per valore, con le copie, e calcola le statistiche dei numeri', () => {
    const s = columnStats(
      'costo',
      columnValues(sheet, 'costo', rows, t, [t]),
      rowAmounts(sheet, rows)
    )
    expect(s.cards).toBe(7)
    expect(s.groups.map((g) => [g.value, g.cards])).toEqual([
      ['0', 1],
      ['1', 5],
      ['3', 1]
    ])
    expect(s.numeric).toMatchObject({ count: 7, sum: 8, min: 0, max: 3, median: 1, mode: [1] })
    expect(s.numeric!.mean).toBeCloseTo(8 / 7)
    expect(s.gaps).toEqual([2])
  })

  it('la moda dà tutti i valori a pari merito, la mediana di un numero pari è la media dei due', () => {
    const s = summarize([1, 2, 3, 4], [2, 2, 1, 1])!
    expect(s.mode).toEqual([1, 2])
    expect(s.median).toBe(2)
    expect(summarize([1, 3], [1, 1])!.median).toBe(2)
    expect(summarize([2, 4], [1, 1])!.sd).toBe(1)
    expect(measure('count', [null, null], [2, 3])).toEqual([5])
    expect(measure('sum', [null], [1])).toBeNull()
  })

  it('i testi vanno dal più frequente e non hanno somma', () => {
    const s = columnStats('tipo', columnValues(sheet, 'tipo', rows, t, [t]), [1, 1, 1, 1])
    expect(s.groups.map((g) => [g.value, g.cards])).toEqual([
      ['arma', 2],
      ['magia', 1],
      ['', 1]
    ])
    expect(s.numeric).toBeUndefined()
  })

  it('calcola i livelli con formula che non hanno una colonna, anche con il valore del template', () => {
    expect(columnValues(sheet, 'doppio', [0, 1, 3], t, [t])).toEqual(['2', '6', '0'])
  })

  it('incrocia due campi con una misura di un terzo', () => {
    const p = pivot(
      [0, 1, 2, 3],
      ['arma', 'arma', 'magia', 'arma'],
      ['1', '3', '1', '1'],
      ['4', '6', '5', ''],
      'mean',
      [1, 1, 1, 1]
    )
    expect(p.rowKeys).toEqual(['arma', 'magia'])
    expect(p.colKeys).toEqual(['1', '3'])
    expect(p.cells[0][0]).toMatchObject({ value: [4], cards: 2, rows: [0, 3] })
    expect(p.cells[1][1]).toMatchObject({ value: null, cards: 0 })
    expect(p.rowTotals[0].value).toEqual([5])
    expect(p.total.cards).toBe(4)
    const count = pivot([0, 1], ['a', 'b'], null, null, 'count', [2, 1])
    expect(count.colKeys).toEqual([])
    expect(count.rowTotals.map((c) => c.value)).toEqual([[2], [1]])
  })

  it('dispersione con linea di tendenza pesata e valori fuori linea', () => {
    const s = scatter([0, 1, 2, 3], ['1', '2', '3', '4'], ['2', '4', '6', '20'], [1, 1, 1, 1])
    expect(s.points).toHaveLength(4)
    expect(s.trend).not.toBeNull()
    expect(s.points[3].outlier).toBe(true)
    expect(scatter([0, 1], ['1', '1'], ['1', '2'], [1, 1]).trend).toBeNull()
  })

  it('probabilità di pesca ipergeometrica', () => {
    // 1 carta buona su 10, pescandone 1
    expect(atLeast(10, 1, 1, 1)).toBeCloseTo(0.1)
    // almeno 1 di 4 assi su 52 pescandone 5
    expect(atLeast(52, 4, 5, 1)).toBeCloseTo(
      1 - (48 * 47 * 46 * 45 * 44) / (52 * 51 * 50 * 49 * 48)
    )
    expect(atLeast(10, 2, 3, 3)).toBe(0)
    expect(atLeast(10, 10, 4, 4)).toBe(1)
    expect(shuffled([1, 2, 3, 4, 5], 7)).toEqual(shuffled([1, 2, 3, 4, 5], 7))
    expect([...shuffled([1, 2, 3, 4, 5], 7)].sort()).toEqual([1, 2, 3, 4, 5])
  })

  it('la somma di più dadi diversi', () => {
    const d = diceDistribution([
      [1, 2, 3, 4, 5, 6],
      [1, 2, 3, 4, 5, 6]
    ])
    expect(d[7]).toBeCloseTo(6 / 36)
    expect(d[2]).toBeCloseTo(1 / 36)
    expect(d.reduce((a, b) => a + b, 0)).toBeCloseTo(1)
    const mixed = diceDistribution([
      [1, 1, 2, 0, 0, 0],
      [0, 1]
    ])
    expect(mixed[0]).toBeCloseTo(0.25)
    expect(mixed[3]).toBeCloseTo(1 / 12)
  })

  it('conta icone, variabili di testo e grassetti, anche dentro i campi', () => {
    const c = textCounts(
      'Attacca {spada*2} e {forza}. **Volo**, {regola}',
      { forza: '{spada}', regola: 'x' },
      new Set(['spada', 'scudo']),
      new Set(['regola'])
    )
    expect(c.icons.get('spada')).toBe(3)
    expect(c.variables.get('regola')).toBe(1)
    expect(c.bold.get('Volo')).toBe(1)
  })

  it('riconosce i campi con quasi un valore per carta', () => {
    const names = columnStats('n', ['a', 'b', 'c', 'd', 'e', 'f'], [1, 1, 1, 1, 1, 1])
    expect(nearlyUnique(names)).toBe(true)
    expect(nearlyUnique(columnStats('n', ['a', 'a', 'b', 'b', 'a', 'a'], [1, 1, 1, 1, 1, 1]))).toBe(
      false
    )
  })

  it('copia la tabella per Excel e per Markdown', () => {
    expect(
      toTsv([
        ['a', 'b'],
        ['1', '2\t3']
      ])
    ).toBe('a\tb\n1\t2 3')
    expect(
      toMarkdown([
        ['a', 'b'],
        ['1', 'x|y']
      ])
    ).toBe('| a | b |\n| --- | --- |\n| 1 | x\\|y |')
  })
})
