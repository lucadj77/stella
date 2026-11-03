// Statistiche di un set: i valori che le carte mostrano davvero (la cella, o il valore del
// template se la cella è vuota, o il risultato delle formule), contati con le copie di amount.
// Lo usano il pannello delle statistiche e `stella stats`.
import type { NumberFormatting } from './numberFormat'
import type { Sheet } from '../project'
import { computedValues, defaultValue, rowToCard } from './bind'
import { cardTemplate } from './inherit'
import { walkLayers } from './normalize'
import { readNumber } from './number'
import type { Layer, Template } from './template'
import type { Variables } from './variables'

/** Un valore della colonna: quante righe e quante carte (con le copie di amount) lo hanno */
export interface StatsGroup {
  value: string
  rows: number
  cards: number
  /** Carte che hanno il valore perché la cella è vuota e vale quello del template */
  fromTemplate?: number
}

/** Le statistiche dei numeri di una colonna, contando le copie */
export interface NumberSummary {
  /** Carte con un numero */
  count: number
  sum: number
  mean: number
  median: number
  /** I valori più frequenti: più di uno quando sono a pari merito */
  mode: number[]
  min: number
  max: number
  /** Deviazione standard: quanto i valori si allontanano in media dalla media */
  sd: number
}

export interface ColumnStats {
  column: string
  /** Righe e carte considerate */
  rows: number
  cards: number
  /** Valori diversi, i numeri in ordine crescente, gli altri dal più frequente */
  groups: StatsGroup[]
  /** Solo se tutti i valori non vuoti sono numeri; contano le copie */
  numeric?: NumberSummary
  /** Numeri interi mancanti tra il più piccolo e il più grande (al massimo 100 di distanza) */
  gaps?: number[]
}

/** Un numero scritto in una cella: 2, 2,5, 2.5; null se non lo è */
export const asNumber = (s: string): number | null => {
  const t = s.trim()
  if (!t) return null
  const n = readNumber(t)
  return n !== null && Number.isFinite(n) ? n : null
}

/** Il livello che prende il valore da una colonna: quello con la colonna scelta o con quel nome */
function columnLayer(t: Template, column: string): Layer | undefined {
  return walkLayers([...t.front, ...t.back]).find(
    (l) => l.source.kind === 'column' && (l.source.column ?? l.name) === column
  )
}

/** I valori che una colonna ha sulle carte, e quali vengono dal template */
export interface FieldValues {
  values: string[]
  fromTemplate: boolean[]
}

/**
 * Valori effettivi di una colonna per le righe indicate: la cella; se è vuota il valore del
 * template del livello che la usa; per un livello fisso, con formula o un valore calcolato
 * senza colonna, quello calcolato sulla carta.
 */
export function fieldValues(
  sheet: Sheet,
  column: string,
  rows: number[],
  template: Template | null,
  templates: Template[],
  variables?: Variables,
  numbers?: NumberFormatting
): FieldValues {
  const i = sheet.headers.indexOf(column)
  const values: string[] = []
  const fromTemplate: boolean[] = []
  for (const r of rows) {
    const row = sheet.rows[r] ?? []
    const cell = i >= 0 ? (row[i] ?? '') : ''
    if (cell.trim() || !template) {
      values.push(cell.trim())
      fromTemplate.push(false)
      continue
    }
    const t = cardTemplate(sheet.headers, row, template, templates).template
    if (i >= 0) {
      const l = columnLayer(t, column)
      const v = l ? (defaultValue(l) ?? '').trim() : ''
      values.push(v)
      fromTemplate.push(v !== '')
      continue
    }
    values.push(
      (computedValues(t, rowToCard(sheet.headers, row), variables, numbers)[column] ?? '').trim()
    )
    fromTemplate.push(false)
  }
  return { values, fromTemplate }
}

/** Solo i valori: vedi fieldValues */
export function columnValues(
  sheet: Sheet,
  column: string,
  rows: number[],
  template: Template | null,
  templates: Template[],
  variables?: Variables,
  numbers?: NumberFormatting
): string[] {
  return fieldValues(sheet, column, rows, template, templates, variables, numbers).values
}

/** Copie di ogni riga indicata: la colonna amount, o 1 */
export function rowAmounts(sheet: Sheet, rows: number[]): number[] {
  return rows.map((r) => rowToCard(sheet.headers, sheet.rows[r] ?? []).amount)
}

/** Vero se tutti i valori non vuoti sono numeri, e almeno uno c'è */
export function isNumeric(values: string[]): boolean {
  let any = false
  for (const v of values) {
    if (!v.trim()) continue
    if (asNumber(v) === null) return false
    any = true
  }
  return any
}

/** Statistiche dei numeri, con il peso di ognuno (le copie); null senza numeri */
export function summarize(nums: number[], weights: number[]): NumberSummary | null {
  const pairs = nums.map((n, k) => [n, weights[k] ?? 1] as const).filter(([, w]) => w > 0)
  const count = pairs.reduce((s, [, w]) => s + w, 0)
  if (!count) return null
  pairs.sort((a, b) => a[0] - b[0])
  let sum = 0
  const freq = new Map<number, number>()
  for (const [n, w] of pairs) {
    sum += n * w
    freq.set(n, (freq.get(n) ?? 0) + w)
  }
  const mean = sum / count
  /** Il valore in posizione k (da 0) dei valori in ordine, con le copie */
  const at = (k: number): number => {
    let seen = 0
    for (const [n, w] of pairs) {
      seen += w
      if (k < seen) return n
    }
    return pairs[pairs.length - 1][0]
  }
  const median = count % 2 ? at((count - 1) / 2) : (at(count / 2 - 1) + at(count / 2)) / 2
  const top = Math.max(...freq.values())
  const mode = [...freq.entries()].filter(([, f]) => f === top).map(([n]) => n)
  const variance = pairs.reduce((s, [n, w]) => s + w * (n - mean) ** 2, 0) / count
  return {
    count,
    sum,
    mean,
    median,
    mode,
    min: pairs[0][0],
    max: pairs[pairs.length - 1][0],
    sd: Math.sqrt(variance)
  }
}

/** Ordina i gruppi: i numeri in ordine crescente, gli altri dal più frequente; il vuoto in fondo */
function sortGroups(groups: StatsGroup[], numeric: boolean): StatsGroup[] {
  return groups.sort((a, b) =>
    a.value === '' || b.value === ''
      ? (a.value === '' ? 1 : 0) - (b.value === '' ? 1 : 0)
      : numeric
        ? asNumber(a.value)! - asNumber(b.value)!
        : b.cards - a.cards || a.value.localeCompare(b.value)
  )
}

/**
 * Statistiche dei valori di una colonna; amounts sono le copie di ogni riga (1 se si ignorano),
 * fromTemplate dice quali valori vengono dal template
 */
export function columnStats(
  column: string,
  values: string[],
  amounts: number[],
  fromTemplate?: boolean[]
): ColumnStats {
  const map = new Map<string, StatsGroup>()
  let cards = 0
  values.forEach((v, k) => {
    const value = v.trim()
    const n = amounts[k] ?? 1
    cards += n
    const g = map.get(value) ?? { value, rows: 0, cards: 0 }
    g.rows++
    g.cards += n
    if (fromTemplate?.[k]) g.fromTemplate = (g.fromTemplate ?? 0) + n
    map.set(value, g)
  })
  const numeric = isNumeric(values)
  const groups = sortGroups([...map.values()], numeric)
  const out: ColumnStats = { column, rows: values.length, cards, groups }
  if (!numeric) return out
  const filled = groups.filter((g) => g.value !== '')
  const summary = summarize(
    filled.map((g) => asNumber(g.value)!),
    filled.map((g) => g.cards)
  )
  if (summary) out.numeric = summary
  const ints = filled.map((g) => asNumber(g.value)!)
  if (summary && ints.every(Number.isInteger) && summary.max - summary.min <= 100) {
    const have = new Set(ints)
    const gaps: number[] = []
    for (let n = summary.min + 1; n < summary.max; n++) if (!have.has(n)) gaps.push(n)
    out.gaps = gaps
  }
  return out
}

// ——— Misure: le stesse nella scheda Valori e nelle celle dell'incrocio ———

export type Measure = 'count' | 'sum' | 'mean' | 'median' | 'mode' | 'min' | 'max' | 'sd'
export const MEASURES: Measure[] = ['count', 'sum', 'mean', 'median', 'mode', 'min', 'max', 'sd']

/** Una misura dei numeri: il conteggio non li guarda; la moda dà tutti i valori a pari merito */
export function measure(
  kind: Measure,
  nums: (number | null)[],
  weights: number[]
): number[] | null {
  if (kind === 'count') return [weights.reduce((s, w) => s + w, 0)]
  const ns: number[] = []
  const ws: number[] = []
  nums.forEach((n, k) => {
    if (n === null) return
    ns.push(n)
    ws.push(weights[k] ?? 1)
  })
  const s = summarize(ns, ws)
  if (!s) return null
  return kind === 'mode' ? s.mode : [s[kind]]
}

// ——— Incrocio: due campi, e in ogni casella una misura di un terzo ———

export interface PivotCell {
  /** La misura, null se nella casella non ci sono carte o numeri */
  value: number[] | null
  cards: number
  /** Righe del foglio nella casella */
  rows: number[]
}

export interface Pivot {
  rowKeys: string[]
  /** Vuoto senza un secondo campo: c'è solo la colonna dei totali */
  colKeys: string[]
  cells: PivotCell[][]
  rowTotals: PivotCell[]
  colTotals: PivotCell[]
  total: PivotCell
}

/**
 * Tabella incrociata: le righe sono i valori di `rowValues`, le colonne quelli di `colValues`
 * (null per nessuna), in ogni casella `kind` di `field` (i numeri del terzo campo).
 * sheetRows sono le righe del foglio, nello stesso ordine dei valori.
 */
export function pivot(
  sheetRows: number[],
  rowValues: string[],
  colValues: string[] | null,
  field: string[] | null,
  kind: Measure,
  weights: number[]
): Pivot {
  const keys = (vs: string[]): string[] => columnStats('', vs, weights).groups.map((g) => g.value)
  const rowKeys = keys(rowValues)
  const colKeys = colValues ? keys(colValues) : []
  const nums = field ? field.map(asNumber) : sheetRows.map(() => null)
  const cell = (pick: (k: number) => boolean): PivotCell => {
    const idx = sheetRows.map((_, k) => k).filter(pick)
    return {
      value: measure(
        kind,
        idx.map((k) => nums[k]),
        idx.map((k) => weights[k] ?? 1)
      ),
      cards: idx.reduce((s, k) => s + (weights[k] ?? 1), 0),
      rows: idx.map((k) => sheetRows[k])
    }
  }
  const cells = rowKeys.map((r) =>
    colKeys.map((c) => cell((k) => rowValues[k] === r && colValues![k] === c))
  )
  return {
    rowKeys,
    colKeys,
    cells,
    rowTotals: rowKeys.map((r) => cell((k) => rowValues[k] === r)),
    colTotals: colKeys.map((c) => cell((k) => colValues![k] === c)),
    total: cell(() => true)
  }
}

// ——— Dispersione: due numeri, con la linea di tendenza ———

export interface ScatterPoint {
  row: number
  x: number
  y: number
  weight: number
  /** Molto sopra o sotto la linea di tendenza */
  outlier: boolean
}

export interface Scatter {
  points: ScatterPoint[]
  /** y = slope * x + intercept, pesata con le copie; null con meno di due x diverse */
  trend: { slope: number; intercept: number } | null
}

export function scatter(
  sheetRows: number[],
  xs: string[],
  ys: string[],
  weights: number[]
): Scatter {
  const points: ScatterPoint[] = []
  sheetRows.forEach((row, k) => {
    const x = asNumber(xs[k] ?? '')
    const y = asNumber(ys[k] ?? '')
    if (x !== null && y !== null)
      points.push({ row, x, y, weight: weights[k] ?? 1, outlier: false })
  })
  let sw = 0
  let sx = 0
  let sy = 0
  let sxx = 0
  let sxy = 0
  for (const p of points) {
    sw += p.weight
    sx += p.weight * p.x
    sy += p.weight * p.y
    sxx += p.weight * p.x * p.x
    sxy += p.weight * p.x * p.y
  }
  const den = sw * sxx - sx * sx
  if (!sw || Math.abs(den) < 1e-9) return { points, trend: null }
  const slope = (sw * sxy - sx * sy) / den
  const intercept = (sy - slope * sx) / sw
  const ysOnly = points.map((p) => p.y)
  const limit = Math.max(1.2, 0.18 * (Math.max(...ysOnly) - Math.min(...ysOnly)))
  for (const p of points) p.outlier = Math.abs(p.y - (slope * p.x + intercept)) > limit
  return { points, trend: { slope, intercept } }
}

// ——— Pesca: probabilità di avere almeno k carte di un tipo ———

/** Coefficiente binomiale, come numero decimale */
export function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return r
}

/**
 * Probabilità di avere almeno `k` delle `K` carte buone pescandone `n` da un mazzo di `N`
 * (senza rimescolare): distribuzione ipergeometrica
 */
export function atLeast(N: number, K: number, n: number, k: number): number {
  if (k <= 0) return 1
  n = Math.max(0, Math.min(N, n))
  if (K < k || n < k) return 0
  const all = choose(N, n)
  if (!all) return 0
  let p = 0
  for (let i = 0; i < k; i++) p += choose(K, i) * choose(N - K, n - i)
  return Math.max(0, Math.min(1, 1 - p / all))
}

/** Carte viste dopo `turn` turni (1 = la mano iniziale) */
export const drawnAfter = (turn: number, hand: number, perTurn: number): number =>
  hand + (turn - 1) * perTurn

/** Mescola con un seme: sempre lo stesso ordine con lo stesso seme */
export function shuffled<T>(items: T[], seed: number): T[] {
  let a = seed >>> 0
  const rand = (): number => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// ——— Dadi: la distribuzione esatta della somma di più dadi ———

/**
 * Probabilità di ogni totale lanciando i dadi: ognuno è l'elenco dei numeri delle sue facce
 * (tutte con la stessa probabilità). Il risultato va da 0 al totale massimo.
 */
export function diceDistribution(dice: number[][]): number[] {
  let dist = [1]
  for (const faces of dice) {
    if (!faces.length) continue
    const next: number[] = []
    for (let a = 0; a < dist.length; a++) {
      if (!dist[a]) continue
      for (const f of faces) {
        const k = a + Math.max(0, Math.round(f))
        next[k] = (next[k] ?? 0) + dist[a] / faces.length
      }
    }
    for (let z = 0; z < next.length; z++) next[z] = next[z] ?? 0
    dist = next
  }
  return dist
}

// ——— Testi: icone, variabili di testo e parole in grassetto ———

export interface TextCounts {
  /** {icona}: quante in tutto, con le ripetizioni {spada*3} */
  icons: Map<string, number>
  /** {variabile} di testo del progetto */
  variables: Map<string, number>
  /** **parola** */
  bold: Map<string, number>
}

/**
 * Le icone, le variabili di testo e le parole in grassetto di un testo. `fields` sono i campi
 * della carta: {campo} si sostituisce con il suo valore (anche più volte, se ne contiene altri);
 * images e texts sono i nomi delle variabili immagine e di testo del progetto.
 */
export function textCounts(
  text: string,
  fields: Record<string, string>,
  images: Set<string>,
  texts: Set<string>
): TextCounts {
  const out: TextCounts = { icons: new Map(), variables: new Map(), bold: new Map() }
  const add = (m: Map<string, number>, k: string, n = 1): void => {
    m.set(k, (m.get(k) ?? 0) + n)
  }
  let s = text
  // i campi della carta prendono il loro valore; icone e variabili restano per contarle
  for (let pass = 0; pass < 4; pass++) {
    const next = s.replace(/(?<!\\)\{([^{}*\s]+)\}/g, (m, name: string) =>
      !images.has(name) && !texts.has(name) && Object.prototype.hasOwnProperty.call(fields, name)
        ? fields[name]
        : m
    )
    if (next === s) break
    s = next
  }
  for (const m of s.matchAll(/(?<!\\)\{([^{}*\s]+)(?:\*(\d+))?[^{}]*\}/g)) {
    const name = m[1]
    const times = m[2] ? Number(m[2]) : 1
    if (texts.has(name)) add(out.variables, name)
    else if (images.has(name) || /\.(png|jpe?g|svg|webp|gif)$/i.test(name))
      add(out.icons, name, times)
  }
  for (const m of s.matchAll(/\*\*([^*]+?)\*\*/g)) {
    const w = m[1].trim()
    if (w) add(out.bold, w)
  }
  return out
}

/** Vero se il testo contiene la parola cercata, senza badare a maiuscole e accenti */
export function textHas(text: string, query: string): boolean {
  const fold = (x: string): string => x.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  return fold(text).includes(fold(query.trim()))
}

// ——— Panoramica: un riassunto di ogni campo ———

/** Un campo con quasi un valore diverso per carta (come il nome) non dice molto in un grafico */
export const nearlyUnique = (s: ColumnStats): boolean =>
  s.rows > 5 && s.groups.filter((g) => g.value !== '').length > s.rows * 0.8

// ——— Testo da copiare: la tabella della scheda per Excel o per Markdown ———

/** Righe separate da a capo e caselle da tabulazioni: si incolla in un foglio di calcolo */
export const toTsv = (rows: string[][]): string =>
  rows.map((r) => r.map((c) => c.replace(/[\t\n]+/g, ' ')).join('\t')).join('\n')

/** Tabella Markdown con la prima riga come intestazione */
export function toMarkdown(rows: string[][]): string {
  if (!rows.length) return ''
  const cell = (c: string): string => c.replace(/\|/g, '\\|').replace(/\n+/g, ' ')
  const width = Math.max(...rows.map((r) => r.length))
  const line = (r: string[]): string =>
    `| ${Array.from({ length: width }, (_, k) => cell(r[k] ?? '')).join(' | ')} |`
  return [line(rows[0]), `|${' --- |'.repeat(width)}`, ...rows.slice(1).map(line)].join('\n')
}
