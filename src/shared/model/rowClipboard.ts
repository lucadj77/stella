import type { Sheet } from '../project'

// Componenti copiati dalla vista a griglia di un set: righe del foglio con le loro intestazioni,
// così si incollano anche in un altro set (le colonne vanno per nome). Negli appunti di sistema
// vanno come testo separato da tabulazioni, che si incolla in Excel o in Fogli Google.

export interface CopiedRows {
  headers: string[]
  rows: string[][]
}

/** Tipo degli appunti con le righe in JSON, letto solo da Stella */
export const ROWS_MIME = 'application/x-stella-rows'

/** Le righe scelte, nell'ordine del foglio */
export function copyRows(s: Sheet, indexes: number[]): CopiedRows {
  const sorted = [...new Set(indexes)].filter((i) => i >= 0 && i < s.rows.length)
  sorted.sort((a, b) => a - b)
  return {
    headers: [...s.headers],
    rows: sorted.map((i) => s.headers.map((_, c) => s.rows[i][c] ?? ''))
  }
}

/** Una cella per il testo a tabulazioni: tra virgolette se contiene tab, a capo o virgolette */
const tsvCell = (v: string): string => (/[\t\n\r"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

/** Le righe come testo a tabulazioni, con le intestazioni nella prima riga */
export function rowsToTsv(c: CopiedRows): string {
  return [c.headers, ...c.rows].map((r) => r.map(tsvCell).join('\t')).join('\n')
}

/** Legge le righe dal JSON degli appunti; null se non sono righe di Stella */
export function parseCopiedRows(json: string): CopiedRows | null {
  try {
    const v = JSON.parse(json) as unknown
    if (!v || typeof v !== 'object') return null
    const { headers, rows } = v as Record<string, unknown>
    const strings = (a: unknown): a is string[] =>
      Array.isArray(a) && a.every((x) => typeof x === 'string')
    if (!strings(headers) || !Array.isArray(rows) || !rows.every(strings)) return null
    return { headers, rows }
  } catch {
    return null
  }
}

/**
 * Inserisce le righe copiate alla posizione `at`, ciascuna colonna in quella con lo stesso nome.
 * Le colonne che il foglio non ha si perdono; quelle che le righe non hanno restano vuote.
 * Restituisce anche gli indici delle righe nuove.
 */
export function pasteRows(s: Sheet, c: CopiedRows, at: number): { sheet: Sheet; added: number[] } {
  const where = Math.max(0, Math.min(s.rows.length, at))
  const index = s.headers.map((h) => c.headers.indexOf(h))
  const values = c.rows.map((r) => index.map((i) => (i < 0 ? '' : (r[i] ?? ''))))
  const rows = [...s.rows]
  rows.splice(where, 0, ...values)
  return { sheet: { ...s, rows }, added: values.map((_, k) => where + k) }
}

/** Colonne delle righe copiate che il foglio non ha, e che non hanno valori, per avvisare */
export function lostColumns(s: Sheet, c: CopiedRows): string[] {
  return c.headers.filter(
    (h, i) => h && !s.headers.includes(h) && c.rows.some((r) => (r[i] ?? '').trim() !== '')
  )
}
