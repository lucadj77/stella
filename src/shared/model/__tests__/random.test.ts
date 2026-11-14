import { describe, expect, it } from 'vitest'
import { cellFields } from '../cells'
import { evaluateFormula, usesRandom } from '../formula'
import { emptyColumn, generateCards, regenerateSheet, type SetGenerator } from '../generate'
import { setUsesRandom } from '../random'
import { normalizeTemplate } from '../normalize'

const card = (n: number, seed = ''): Record<string, string> => ({
  'card.number': String(n),
  'set.seed': seed
})

describe('RAND e RANDBETWEEN', () => {
  it('danno lo stesso numero a ogni disegno della stessa carta', () => {
    const a = evaluateFormula('=RANDBETWEEN(1; 6)', card(3)).value
    expect(evaluateFormula('=RANDBETWEEN(1; 6)', card(3)).value).toBe(a)
    expect(Number(a)).toBeGreaterThanOrEqual(1)
    expect(Number(a)).toBeLessThanOrEqual(6)
  })

  it('cambiano con la carta e con il seme', () => {
    const values = (seed: string): string[] =>
      Array.from(
        { length: 20 },
        (_, i) => evaluateFormula('=RANDBETWEEN(1; 1000)', card(i + 1, seed)).value
      )
    expect(new Set(values('')).size).toBeGreaterThan(15)
    expect(values('7')).toEqual(values('7'))
    expect(values('7')).not.toEqual(values('8'))
  })

  it('due chiamate nella stessa formula danno numeri diversi', () => {
    const v = evaluateFormula('=RAND() & "|" & RAND()', card(1)).value.split('|')
    expect(v[0]).not.toBe(v[1])
    const r = Number(v[0])
    expect(r).toBeGreaterThanOrEqual(0)
    expect(r).toBeLessThan(1)
  })

  it('RANDBETWEEN con un solo numero possibile', () => {
    expect(evaluateFormula('=RANDBETWEEN(4; 4)', card(1)).value).toBe('4')
    expect(evaluateFormula('=RANDBETWEEN(1)', card(1)).error).toBeTruthy()
  })

  it('riconosce le formule con il caso', () => {
    expect(usesRandom('=RAND()')).toBe(true)
    expect(usesRandom('=PICK({cell.random}; "a"; "b")')).toBe(true)
    expect(usesRandom('=DEAL("a"; 2)')).toBe(true)
    expect(usesRandom('=OPERAND({x})')).toBe(false)
    expect(usesRandom('{random}')).toBe(false)
  })
})

describe('seme del set nelle griglie', () => {
  it('senza seme i numeri restano quelli di prima', () => {
    expect(cellFields('g', 0, 4, 16, 1)).toEqual(cellFields('g', 0, 4, 16, 1, ''))
  })
  it('con un seme cambiano, e lo stesso seme dà gli stessi', () => {
    const base = cellFields('g', 0, 4, 16, 1)
    const a = cellFields('g', 0, 4, 16, 1, '42')
    expect(a['cell.random']).not.toBe(base['cell.random'])
    expect(a['cell.seed']).not.toBe(base['cell.seed'])
    expect(cellFields('g', 0, 4, 16, 1, '42')).toEqual(a)
  })
})

describe('rigenerare', () => {
  const column = { ...emptyColumn('colore'), values: ['rosso', 'blu', 'verde', 'giallo'] }
  const generator: SetGenerator = {
    spec: {
      columns: [column],
      filter: '',
      copies: 1,
      random: { count: 6, seed: 1, unique: false }
    },
    from: 2
  }
  const sheet = {
    name: 'S',
    headers: ['nome', 'colore', 'amount'],
    rows: [
      ['a', 'x', '1'],
      ['b', 'x', '1'],
      ...generateCards(generator.spec).rows.map((r, i) => [`n${i}`, r[0], '2'])
    ]
  }

  it('riscrive solo le righe generate e le colonne generate', () => {
    const out = regenerateSheet(sheet, generator, 99)
    expect(out.rows.slice(0, 2)).toEqual(sheet.rows.slice(0, 2))
    expect(out.rows.map((r) => r[0])).toEqual(sheet.rows.map((r) => r[0]))
    expect(out.rows.slice(2).every((r) => r[2] === '2')).toBe(true)
    const again = regenerateSheet(sheet, generator, 99)
    expect(again).toEqual(out)
    const colors = (seed: number): string[] =>
      regenerateSheet(sheet, generator, seed)
        .rows.map((r) => r[1])
        .slice(2)
    expect(
      Array.from({ length: 5 }, (_, i) => colors(i + 10).join()).some(
        (c) => c !== colors(99).join()
      )
    ).toBe(true)
  })

  it('un set con generazione a caso o con formule a caso si può rigenerare', () => {
    const tpl = normalizeTemplate({ name: 'T', front: [{ type: 'text', name: 'nome' }] })
    expect(setUsesRandom({ template: 'T', data: sheet }, [tpl])).toBe(false)
    expect(setUsesRandom({ template: 'T', data: sheet, generator }, [tpl])).toBe(true)
    const data = { ...sheet, rows: [['=RANDBETWEEN(1; 3)', '', '1']] }
    expect(setUsesRandom({ template: 'T', data }, [tpl])).toBe(true)
  })
})
