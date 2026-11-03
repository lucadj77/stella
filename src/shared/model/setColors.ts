// Colori della tabella del set: le celle (o la riga intera) prendono un colore secondo il
// valore di un campo. È solo una vista: non cambia le carte. Si salva nel progetto, nel set.
import { asNumber, isNumeric } from './stats'

export interface SetColorColumn {
  /** Il campo: una colonna del foglio o un livello calcolato */
  column: string
  /** Colori scelti a mano: valore (o fascia, per i numeri) → colore #rrggbb */
  colors?: Record<string, string>
}

export interface SetColors {
  /** I campi colorati, ognuno nella sua colonna */
  columns: SetColorColumn[]
  /** Con un solo campo colorato, il colore va su tutta la riga */
  wholeRow?: boolean
}

/** Un valore o una fascia di numeri con il suo colore */
export interface ColorKey {
  key: string
  label: string
  lo?: number
  hi?: number
}

/** Tre toni caldi per le fasce di numeri, dal più chiaro */
export const BAND_COLORS = ['#fdf0dc', '#f8d6a0', '#efad55']
/** Toni tenui per i valori di testo */
export const VALUE_COLORS = [
  '#dfe8f8',
  '#dcefdc',
  '#ebe2f6',
  '#fde7cf',
  '#fbe0e0',
  '#d9f0ef',
  '#f3efcf',
  '#e6e6e6'
]
export const ALL_COLORS = [...BAND_COLORS, ...VALUE_COLORS]

/** Un numero con al massimo un decimale, con la virgola se serve */
const short = (n: number, comma: boolean): string => {
  const s = String(Math.round(n * 10) / 10)
  return comma ? s.replace('.', ',') : s
}

/**
 * Valori o fasce di un campo: i testi uno per uno, nell'ordine in cui compaiono; i numeri con
 * pochi valori diversi uno per uno, altrimenti in tre fasce dal più piccolo al più grande
 */
export function colorKeys(values: string[], comma = false): ColorKey[] {
  const filled = values.map((v) => v.trim()).filter(Boolean)
  if (!isNumeric(filled)) {
    const seen: string[] = []
    for (const v of filled) if (!seen.includes(v)) seen.push(v)
    return seen.map((v) => ({ key: v, label: v }))
  }
  const nums = filled.map((v) => asNumber(v)!)
  const distinct = [...new Set(nums)].sort((a, b) => a - b)
  if (distinct.length <= 4)
    return distinct.map((n) => ({ key: `=${n}`, label: short(n, comma), lo: n, hi: n }))
  const lo = distinct[0]
  const hi = distinct[distinct.length - 1]
  const out: ColorKey[] = []
  if (distinct.every(Number.isInteger)) {
    const span = (hi - lo + 1) / 3
    let from = lo
    for (let b = 0; b < 3; b++) {
      const to = b === 2 ? hi : Math.max(from, Math.round(lo + (b + 1) * span) - 1)
      out.push({ key: `b${b}`, lo: from, hi: to, label: from === to ? `${from}` : `${from}–${to}` })
      from = to + 1
      if (from > hi) break
    }
    return out
  }
  const step = (hi - lo) / 3
  for (let b = 0; b < 3; b++) {
    const a = lo + b * step
    const z = b === 2 ? hi : lo + (b + 1) * step
    out.push({ key: `b${b}`, lo: a, hi: z, label: `${short(a, comma)}–${short(z, comma)}` })
  }
  return out
}

/** La chiave di un valore tra quelle del campo, o null (vuoto, o fuori dalle fasce) */
export function keyOf(keys: ColorKey[], value: string): string | null {
  const v = value.trim()
  if (!v) return null
  if (keys.length && keys[0].lo === undefined) return keys.some((k) => k.key === v) ? v : null
  const n = asNumber(v)
  if (n === null) return null
  // le fasce di numeri decimali si toccano: vale la prima che contiene il numero
  const hit = keys.find((k, i) =>
    i === keys.length - 1
      ? n >= k.lo! && n <= k.hi!
      : n >= k.lo! && n < (keys[i + 1].lo ?? Infinity)
  )
  return hit?.key ?? null
}

/** Il colore di una chiave: quello scelto a mano, o quello della tavolozza per la sua posizione */
export function keyColor(column: SetColorColumn, keys: ColorKey[], key: string): string {
  const chosen = column.colors?.[key]
  if (chosen) return chosen
  const i = Math.max(
    0,
    keys.findIndex((k) => k.key === key)
  )
  // numeri: dal tono più chiaro al più scuro; testi: toni tenui diversi
  return keys[0]?.lo !== undefined
    ? ALL_COLORS[i % ALL_COLORS.length]
    : VALUE_COLORS[i % VALUE_COLORS.length]
}

/** Toglie i campi senza nome e i doppioni; null se non resta nulla */
export function cleanColors(c: SetColors | undefined): SetColors | undefined {
  if (!c) return undefined
  const seen = new Set<string>()
  const columns = c.columns.filter((x) => x.column && !seen.has(x.column) && seen.add(x.column))
  if (!columns.length) return undefined
  return {
    columns: columns.map((x) =>
      x.colors && Object.keys(x.colors).length ? x : { column: x.column }
    ),
    ...(c.wholeRow && columns.length === 1 ? { wholeRow: true } : {})
  }
}
