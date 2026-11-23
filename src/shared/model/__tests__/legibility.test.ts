import { describe, expect, it } from 'vitest'
import {
  colorIsOnlySignal,
  confusedPairs,
  contrastRatio,
  deltaE2000,
  minHeightMm,
  parseColor,
  readableUpToCm,
  readingOf,
  textVerdict,
  upsideDownReading,
  xHeightMm
} from '../legibility'

describe('leggibilità', () => {
  it('distanza e capovolto dal tipo di componente', () => {
    expect(readingOf({})).toEqual({ cm: 40, upsideDown: false })
    expect(readingOf({ kind: 'board' }).cm).toBe(100)
    expect(readingOf({ kind: 'token' }).upsideDown).toBe(true)
  })

  it('misure dall’angolo visivo', () => {
    // a 40 cm, 0,2° sono circa 1,4 mm di x: circa 8 pt
    expect(minHeightMm(40, 0.2)).toBeCloseTo(1.396, 2)
    expect(xHeightMm(8)).toBeCloseTo(1.411, 2)
    expect(textVerdict(xHeightMm(8), 40)).toBe('ok')
    expect(textVerdict(xHeightMm(6), 40)).toBe('small')
    expect(textVerdict(xHeightMm(3), 40)).toBe('tooSmall')
    expect(readableUpToCm(1.4, 0.2)).toBeCloseTo(40.1, 0)
    expect(minHeightMm(40, 0.2, true)).toBeCloseTo(2.094, 2)
  })

  it('contrasto WCAG e differenza CIEDE2000', () => {
    expect(contrastRatio(parseColor('#000')!, parseColor('#fff')!)).toBeCloseTo(21, 1)
    expect(contrastRatio(parseColor('#777')!, parseColor('#fff')!)).toBeCloseTo(4.48, 1)
    expect(deltaE2000(parseColor('#ff0000')!, parseColor('#ff0000')!)).toBe(0)
    expect(deltaE2000(parseColor('#000000')!, parseColor('#ffffff')!)).toBeCloseTo(100, 0)
  })

  it('rosso e verde si confondono per chi ha la deuteranopia, blu e giallo no', () => {
    const pairs = confusedPairs(['#d62728', '#2ca02c', '#1f77b4', '#ffdd00'])
    expect(pairs.some((p) => p.a === '#d62728' && p.b === '#2ca02c')).toBe(true)
    expect(pairs.some((p) => p.a === '#1f77b4' && p.b === '#ffdd00')).toBe(false)
  })

  it('numeri che capovolti diventano altri', () => {
    expect(upsideDownReading('6')).toBe('9')
    expect(upsideDownReading('16')).toBe('91')
    expect(upsideDownReading('69')).toBeNull()
    expect(upsideDownReading('8')).toBeNull()
    expect(upsideDownReading('10')).toBeNull()
    expect(upsideDownReading('7')).toBeNull()
    expect(upsideDownReading('6.')).toBeNull()
  })

  it('colore come unico segnale', () => {
    const colors = ['#f00', '#f00', '#00f', '#00f']
    // solo i nomi cambiano: il colore è l'unico segnale del gruppo
    expect(colorIsOnlySignal(colors, { name: ['a', 'b', 'c', 'd'] })).toBe(true)
    // un'icona segue il colore: c'è un altro segnale
    expect(
      colorIsOnlySignal(colors, { name: ['a', 'b', 'c', 'd'], icon: ['x', 'x', 'y', 'y'] })
    ).toBe(false)
    // un colore per carta: nessun gruppo da riconoscere
    expect(colorIsOnlySignal(['#f00', '#0f0'], { name: ['a', 'b'] })).toBe(false)
  })
})
