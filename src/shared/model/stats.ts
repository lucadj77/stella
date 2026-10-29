import type { NumberFormatting } from './numberFormat'
import type { Sheet } from '../project'
import { computedValues, rowToCard } from './bind'
import { cardTemplate } from './inherit'
import type { Template } from './template'
import type { Variables } from './variables'

/** Un valore della colonna: quante righe e quante carte (con le copie di amount) lo hanno */
export interface StatsGroup {
  value: string
  rows: number
  cards: number
}

export interface ColumnStats {
  column: string
  /** Righe e carte considerate */
  rows: number
  cards: number
  /** Valori diversi, i numeri in ordine crescente, gli altri dal più frequente */
  groups: StatsGroup[]
  /** Solo se tutti i valori non vuoti sono numeri; somma e media contano le copie */
  numeric?: { sum: number; min: number; max: number; mean: number }
}

const asNumber = (s: string): number | null => {
  const t = s.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/**
 * Valori di una colonna per le righe indicate: quelli del foglio o, per un livello fisso o con
 * formula che non ha una colonna, quelli calcolati sulla carta
 */
export function columnValues(
  sheet: Sheet,
  column: string,
  rows: number[],
  template: Template | null,
  templates: Template[],
  variables?: Variables,
  numbers?: NumberFormatting
): string[] {
  const i = sheet.headers.indexOf(column)
  if (i >= 0 || !template) return rows.map((r) => (i >= 0 ? (sheet.rows[r]?.[i] ?? '') : ''))
  return rows.map((r) => {
    const row = sheet.rows[r] ?? []
    const t = cardTemplate(sheet.headers, row, template, templates).template
    return computedValues(t, rowToCard(sheet.headers, row), variables, numbers)[column] ?? ''
  })
}

/** Statistiche dei valori di una colonna; amounts sono le copie di ogni riga (1 se si ignorano) */
export function columnStats(column: string, values: string[], amounts: number[]): ColumnStats {
  const map = new Map<string, StatsGroup>()
  let cards = 0
  values.forEach((v, k) => {
    const value = v.trim()
    const n = amounts[k] ?? 1
    cards += n
    const g = map.get(value) ?? { value, rows: 0, cards: 0 }
    g.rows++
    g.cards += n
    map.set(value, g)
  })
  const groups = [...map.values()]
  const filled = groups.filter((g) => g.value !== '')
  const numeric = filled.length > 0 && filled.every((g) => asNumber(g.value) !== null)
  if (numeric) {
    groups.sort((a, b) =>
      a.value === '' ? 1 : b.value === '' ? -1 : asNumber(a.value)! - asNumber(b.value)!
    )
    let sum = 0
    let counted = 0
    let min = Infinity
    let max = -Infinity
    for (const g of filled) {
      const n = asNumber(g.value)!
      sum += n * g.cards
      counted += g.cards
      min = Math.min(min, n)
      max = Math.max(max, n)
    }
    return {
      column,
      rows: values.length,
      cards,
      groups,
      numeric: { sum, min, max, mean: counted ? sum / counted : 0 }
    }
  }
  groups.sort(
    (a, b) =>
      (a.value === '' ? 1 : 0) - (b.value === '' ? 1 : 0) ||
      b.cards - a.cards ||
      a.value.localeCompare(b.value)
  )
  return { column, rows: values.length, cards, groups }
}

/** Copie di ogni riga indicata: la colonna amount, o 1 */
export function rowAmounts(sheet: Sheet, rows: number[]): number[] {
  return rows.map((r) => rowToCard(sheet.headers, sheet.rows[r] ?? []).amount)
}
