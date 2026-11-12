import { describe, expect, it } from 'vitest'
import { DEFAULT_PDF, inkFilter } from '../export'

describe('inchiostro del PDF', () => {
  it('a colori non ha filtro, ed è la scelta di base', () => {
    expect(DEFAULT_PDF.ink).toBe('color')
    expect(inkFilter('color')).toBeUndefined()
    expect(inkFilter(undefined)).toBeUndefined()
  })
  it('bianco e nero e bozza', () => {
    expect(inkFilter('gray')).toBe('grayscale(1)')
    // la bozza: invertire, scurire al 60%, invertire porta v a 0,4 + 0,6 v
    expect(inkFilter('draft')).toBe('grayscale(1) invert(1) brightness(0.6) invert(1)')
  })
})
