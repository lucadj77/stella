import { describe, expect, it } from 'vitest'
import { cleanColors, colorKeys, keyColor, keyOf, VALUE_COLORS } from '../setColors'

describe('colori della tabella', () => {
  it("i testi hanno un colore per valore, nell'ordine in cui compaiono", () => {
    const keys = colorKeys(['Regno', 'Bosco', '', 'Regno'])
    expect(keys.map((k) => k.key)).toEqual(['Regno', 'Bosco'])
    expect(keyOf(keys, 'Bosco')).toBe('Bosco')
    expect(keyOf(keys, '')).toBeNull()
    expect(keyColor({ column: 'f' }, keys, 'Bosco')).toBe(VALUE_COLORS[1])
    expect(keyColor({ column: 'f', colors: { Bosco: '#ff0000' } }, keys, 'Bosco')).toBe('#ff0000')
  })

  it('i numeri con molti valori vanno in tre fasce, anche con i decimali', () => {
    const keys = colorKeys(['1', '2', '3', '4', '5', '6', '7', '8', '9'])
    expect(keys.map((k) => k.label)).toEqual(['1–3', '4–6', '7–9'])
    expect(keyOf(keys, '5')).toBe('b1')
    const dec = colorKeys(['0,5', '1', '1,5', '2', '2,5', '3'], true)
    expect(dec).toHaveLength(3)
    expect(dec[0].label).toBe('0,5–1,3')
    expect(keyOf(dec, '3')).toBe('b2')
    expect(keyOf(dec, '0.5')).toBe('b0')
  })

  it('pochi numeri diversi hanno un colore ciascuno', () => {
    const keys = colorKeys(['1', '2', '2'])
    expect(keys.map((k) => k.label)).toEqual(['1', '2'])
    expect(keyOf(keys, '2')).toBe('=2')
  })

  it('pulisce ciò che si salva: la riga intera solo con un campo', () => {
    expect(cleanColors({ columns: [] })).toBeUndefined()
    expect(
      cleanColors({ columns: [{ column: 'a' }, { column: 'b' }, { column: 'a' }], wholeRow: true })
    ).toEqual({ columns: [{ column: 'a' }, { column: 'b' }] })
    expect(cleanColors({ columns: [{ column: 'a', colors: {} }], wholeRow: true })).toEqual({
      columns: [{ column: 'a' }],
      wholeRow: true
    })
  })
})
