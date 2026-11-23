import { DEFAULT_X_RATIO } from '../../../shared/model/legibility'

const cache = new Map<string, number>()

/**
 * Altezza della x rispetto al corpo per un font, misurata con un canvas. Il font deve essere già
 * caricato: finché non lo è (o senza canvas, nei test) si usa il valore comune di 0,5, senza
 * ricordarlo, così la misura vera arriva alla richiesta dopo.
 */
export function xRatio(font: string, weight = 400, italic = false): number {
  const key = `${font}|${weight}|${italic}`
  const known = cache.get(key)
  if (known !== undefined) return known
  try {
    const spec = `${italic ? 'italic ' : ''}${weight} 100px '${font}'`
    if (typeof document === 'undefined' || !document.fonts?.check(spec)) return DEFAULT_X_RATIO
    const ctx = document.createElement('canvas').getContext('2d')
    if (!ctx) return DEFAULT_X_RATIO
    ctx.font = spec
    const m = ctx.measureText('x')
    const r = m.actualBoundingBoxAscent / 100
    // valori assurdi (font simbolici, x mancante): meglio il valore comune
    const ratio = r > 0.25 && r < 0.85 ? r : DEFAULT_X_RATIO
    cache.set(key, ratio)
    return ratio
  } catch {
    return DEFAULT_X_RATIO
  }
}
