import { describe, expect, it } from 'vitest'
import { formatLength, fromUnit, toUnit, unitStep } from '../model/units'

describe('unità di misura', () => {
  it('converte da e verso i millimetri', () => {
    expect(toUnit(63, 'cm')).toBe(6.3)
    expect(toUnit(63.5, 'in')).toBe(2.5)
    expect(fromUnit(2.5, 'in')).toBeCloseTo(63.5)
    expect(fromUnit(8.8, 'cm')).toBeCloseTo(88)
    expect(formatLength(88, 'cm', 'it')).toBe('8,8 cm')
    expect(formatLength(88, 'mm')).toBe('88 mm')
  })

  it('sceglie passi tondi', () => {
    expect(unitStep(0.5, 'mm')).toBe(0.5)
    expect(unitStep(0.5, 'cm')).toBe(0.05)
    expect(unitStep(0.5, 'in')).toBe(0.02)
    expect(unitStep(1, 'cm')).toBe(0.1)
  })
})
