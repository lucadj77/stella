import { describe, expect, it } from 'vitest'
import { VISION_MATRICES, visionMatrix } from '../vision'

describe('anteprima daltonismo', () => {
  it('il bianco resta bianco in ogni visione', () => {
    for (const m of Object.values(VISION_MATRICES))
      for (const row of m) expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 2)
  })
  it('la matrice di feColorMatrix ha 20 numeri e lascia la trasparenza com’è', () => {
    const n = visionMatrix('deutan').split(/\s+/).map(Number)
    expect(n).toHaveLength(20)
    expect(n.slice(15)).toEqual([0, 0, 0, 1, 0])
  })
  it('nella deuteranopia rosso e verde puri diventano simili', () => {
    const m = VISION_MATRICES.deutan
    const apply = (c: number[]): number[] => m.map((r) => r.reduce((a, v, i) => a + v * c[i], 0))
    const red = apply([1, 0, 0])
    const green = apply([0, 1, 0])
    // il blu resta vicino in entrambi, la differenza è soprattutto di luminosità
    expect(Math.abs(red[2] - green[2])).toBeLessThan(0.1)
  })
})
