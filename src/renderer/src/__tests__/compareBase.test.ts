import { describe, expect, it } from 'vitest'
import type { ExportCard } from '../../../shared/export'
import { pairBefore } from '../components/compareBase'

const card = (n: number, label: string): ExportCard =>
  ({ n, label, amount: 1, fields: {}, template: {} }) as unknown as ExportCard

describe('il prima di ogni componente', () => {
  it('stessa riga con lo stesso nome, poi lo stesso nome, poi la stessa riga', () => {
    const before = [card(1, 'A'), card(2, 'B'), card(3, 'C')]
    const now = [card(1, 'B'), card(2, 'X'), card(3, 'C'), card(4, 'D')]
    const pairs = pairBefore(now, before)
    expect(pairs.get(1)?.label).toBe('B')
    // la riga 2 ("B") è già presa dalla carta 1: nessun prima
    expect(pairs.get(2)).toBeUndefined()
    expect(pairs.get(3)?.label).toBe('C')
    expect(pairs.get(4)).toBeUndefined()
  })
})
