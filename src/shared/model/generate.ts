import type { Sheet } from '../project'
import { evaluateFormula } from './formula'

// Generatore di carte: da alcuni insiemi di valori crea le righe di un set con tutte le
// combinazioni. Ogni colonna sceglie `pick` valori dal suo insieme (con o senza ripetizioni,
// con o senza ordine) e li scrive uniti nella stessa cella; le colonne si combinano tra loro
// in tutti i modi possibili. A caso, invece, si generano quante carte si vuole estraendo i valori:
// un insieme può riempire più colonne, una estrazione per colonna. Vedi docs/specifica.md, 8.3.

export interface GeneratorColumn {
  /** Intestazione della colonna del foglio */
  column: string
  values: string[]
  /** Quanti valori dell'insieme vanno nella stessa cella */
  pick: number
  /** Lo stesso valore può comparire più volte nella cella */
  repeat: boolean
  /** L'ordine conta: A B e B A sono carte diverse */
  ordered: boolean
  /** Ogni valore si scrive come {valore}, cioè come icona o variabile */
  icons: boolean
  /** Tra un valore e l'altro nella stessa cella */
  separator: string
  /**
   * Quante volte può comparire ogni valore nella cella; senza limite: da 0 a pick (o 1). A caso
   * contano le presenze in tutte le colonne dell'insieme.
   */
  limits?: Record<string, ValueLimit>
  /** A caso: altre colonne riempite dallo stesso insieme, ognuna con la sua estrazione */
  more?: string[]
}

export interface ValueLimit {
  min?: number
  max?: number
}

export interface GeneratorSpec {
  columns: GeneratorColumn[]
  /** Formula: la carta resta se il risultato è vero (vuoto = tutte) */
  filter: string
  /** Copie di ogni carta (colonna amount) */
  copies: number
  /** Carte a caso invece di tutte le combinazioni */
  random?: RandomOptions
  /** Nel filtro 2,5 è un numero: vedi model/numberFormat.ts */
  decimalComma?: boolean
}

export interface RandomOptions {
  /** Quante carte */
  count: number
  /** Lo stesso seme dà le stesse carte */
  seed: number
  /** Niente carte uguali */
  unique: boolean
}

/** Oltre questo numero di carte il generatore si ferma */
export const MAX_GENERATED = 5000

export function emptyColumn(column = ''): GeneratorColumn {
  return { column, values: [], pick: 1, repeat: false, ordered: false, icons: true, separator: '' }
}

/** Scelte di `k` valori: combinazioni o disposizioni, con o senza ripetizioni e limiti */
export function choices(
  values: string[],
  k: number,
  repeat: boolean,
  ordered: boolean,
  limits: Record<string, ValueLimit> = {}
): string[][] {
  const out: string[][] = []
  if (k <= 0) return [[]]
  const max = values.map((v) => {
    const m = limits[v]?.max ?? k
    return Math.max(0, repeat ? m : Math.min(1, m))
  })
  const min = values.map((v) => Math.max(0, limits[v]?.min ?? 0))
  const count = values.map(() => 0)
  // quante presenze obbligatorie mancano ancora: se superano i posti liberi si torna indietro
  const needed = (): number => min.reduce((n, m, i) => n + Math.max(0, m - count[i]), 0)
  const walk = (from: number, acc: string[]): void => {
    if (out.length > MAX_GENERATED) return
    if (needed() > k - acc.length) return
    if (acc.length === k) {
      out.push(acc)
      return
    }
    for (let i = ordered ? 0 : from; i < values.length; i++) {
      if (count[i] >= max[i]) continue
      count[i]++
      walk(i, [...acc, values[i]])
      count[i]--
    }
  }
  walk(0, [])
  return out
}

const hasLimits = (limits?: Record<string, ValueLimit>): boolean =>
  !!limits && Object.values(limits).some((l) => l.min !== undefined || l.max !== undefined)

/** Quante scelte ci sono; con i limiti si contano elencandole */
export function countChoices(
  n: number,
  k: number,
  repeat: boolean,
  ordered: boolean,
  values?: string[],
  limits?: Record<string, ValueLimit>
): number {
  if (values && hasLimits(limits)) return choices(values, k, repeat, ordered, limits).length
  if (k <= 0) return 1
  if (!repeat && k > n) return 0
  if (ordered) {
    if (repeat) return n ** k
    let p = 1
    for (let i = 0; i < k; i++) p *= n - i
    return p
  }
  // combinazioni: C(n, k), con ripetizioni C(n + k - 1, k)
  const top = repeat ? n + k - 1 : n
  let c = 1
  for (let i = 1; i <= k; i++) c = (c * (top - k + i)) / i
  return Math.round(c)
}

/**
 * Valori distinti di un elenco scritto a mano: uno per riga o separati da virgole. "1-5" o
 * "1..5" sono tutti i numeri dell'intervallo.
 */
export function parseValues(text: string): string[] {
  const out: string[] = []
  for (const raw of text.split(/[\n,;]/)) {
    const v = raw.trim()
    const range = v.match(/^(-?\d+)\s*(?:-|\.\.)\s*(-?\d+)$/)
    if (range) {
      const [a, b] = [Number(range[1]), Number(range[2])]
      const step = a <= b ? 1 : -1
      for (let n = a; out.length < MAX_GENERATED; n += step) {
        out.push(String(n))
        if (n === b) break
      }
    } else if (v) out.push(v)
  }
  return [...new Set(out)]
}

/** I numeri restano numeri anche con "come icona": {3} non è un'icona */
const cell = (c: GeneratorColumn, pick: string[]): string =>
  pick
    .map((v) => (c.icons && !/^\{.*\}$/.test(v) && !/^-?\d+([.,]\d+)?$/.test(v) ? `{${v}}` : v))
    .join(c.separator)

export interface GeneratedCards {
  headers: string[]
  rows: string[][]
  /** Carte prima del filtro */
  total: number
  /** Il risultato supera MAX_GENERATED: le righe sono troncate */
  truncated: boolean
  /** Errore della formula del filtro, se c'è */
  filterError?: string
  /** A caso: i limiti per valore non si possono rispettare */
  impossible?: boolean
}

/**
 * Righe del generatore. Nel filtro ogni colonna vale il testo della sua cella; in più
 * {colonna_1}, {colonna_2}... sono i singoli valori scelti, senza graffe.
 */
export function generateCards(spec: GeneratorSpec): GeneratedCards {
  if (spec.random) return generateRandom(spec, spec.random)
  const cols = spec.columns.filter((c) => c.column.trim() && c.values.length)
  const total = cols.reduce(
    (n, c) => n * countChoices(c.values.length, c.pick, c.repeat, c.ordered, c.values, c.limits),
    cols.length ? 1 : 0
  )
  // più insiemi sulla stessa colonna finiscono nella stessa cella, separati da uno spazio
  const names = [...new Set(cols.map((c) => c.column.trim()))]
  const headers = [...names, 'amount']
  const rows: string[][] = []
  let filterError: string | undefined
  const lists = cols.map((c) => choices(c.values, c.pick, c.repeat, c.ordered, c.limits))
  const filter = spec.filter.trim()
  const walk = (i: number, picked: string[][]): boolean => {
    if (rows.length >= MAX_GENERATED) return false
    if (i === cols.length) {
      const cells = cols.map((c, j) => cell(c, picked[j]))
      const values = names.map((name) =>
        cells.filter((_, j) => cols[j].column.trim() === name).join(' ')
      )
      if (filter) {
        const fields: Record<string, string> = {}
        names.forEach((name, j) => (fields[name] = values[j]))
        cols.forEach((c, j) =>
          picked[j].forEach((v, n) => (fields[`${c.column.trim()}_${n + 1}`] ??= v))
        )
        const r = evaluateFormula(filter.startsWith('=') ? filter : `=${filter}`, fields, {
          decimalComma: spec.decimalComma
        })
        if (r.error) {
          filterError ??= r.error
          return true
        }
        if (!truthy(r.value)) return true
      }
      rows.push([...values, copiesOf(spec)])
      return true
    }
    for (const p of lists[i]) if (!walk(i + 1, [...picked, p])) return false
    return true
  }
  if (cols.length) walk(0, [])
  return {
    headers,
    rows,
    total,
    truncated: rows.length >= MAX_GENERATED && total > MAX_GENERATED,
    ...(filterError ? { filterError } : {})
  }
}

const copiesOf = (spec: GeneratorSpec): string => String(Math.max(1, Math.round(spec.copies) || 1))

/** Le colonne che un insieme riempie: a caso anche quelle in più */
export function fieldsOf(c: GeneratorColumn, random = false): string[] {
  const all = [c.column, ...(random ? (c.more ?? []) : [])].map((x) => x.trim()).filter(Boolean)
  return [...new Set(all)]
}

/** Generatore pseudo-casuale con seme (mulberry32): da 0 incluso a 1 escluso */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Tentativi al massimo per ogni carta chiesta, prima di arrendersi al filtro */
const TRIES_PER_CARD = 200
const MAX_TRIES = 50000

/**
 * Estrae `n` valori di un insieme rispettando ripetizioni e limiti: a ogni estrazione si sceglie
 * tra i valori ancora ammessi, e quando i posti rimasti bastano appena per i minimi si sceglie
 * solo tra quelli sotto il minimo. Alla fine si mescolano, così i minimi non finiscono sempre
 * nelle ultime colonne.
 */
function draw(
  values: string[],
  n: number,
  repeat: boolean,
  limits: Record<string, ValueLimit>,
  rnd: () => number
): string[] | null {
  const max = values.map((v) => Math.max(0, Math.min(repeat ? n : 1, limits[v]?.max ?? n)))
  const min = values.map((v) => Math.max(0, limits[v]?.min ?? 0))
  const count = values.map(() => 0)
  const out: string[] = []
  for (let left = n; left > 0; left--) {
    const needed = min.reduce((s, m, i) => s + Math.max(0, m - count[i]), 0)
    const ok = values
      .map((_, i) => i)
      .filter((i) => count[i] < max[i] && (needed < left || count[i] < min[i]))
    if (!ok.length) return null
    const i = ok[Math.floor(rnd() * ok.length)]
    count[i]++
    out.push(values[i])
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** I limiti dell'insieme si possono rispettare con `n` estrazioni? */
function feasible(
  values: string[],
  n: number,
  repeat: boolean,
  limits: Record<string, ValueLimit>
): boolean {
  let lo = 0
  let hi = 0
  for (const v of values) {
    const min = Math.max(0, limits[v]?.min ?? 0)
    const max = Math.max(0, Math.min(repeat ? n : 1, limits[v]?.max ?? n))
    if (min > max) return false
    lo += min
    hi += max
  }
  return lo <= n && n <= hi
}

/**
 * Carte a caso: per ogni carta ogni insieme estrae `pick` valori per ognuna delle sue colonne.
 * Con le ripetizioni è come tirare un dado per ogni valore; senza, come distribuire carte da un
 * mazzo: lo stesso valore non torna in nessuna colonna dell'insieme. I limiti contano le
 * presenze in tutte le colonne dell'insieme. Le carte che il filtro scarta (o già uscite, se
 * devono essere tutte diverse) si estraggono di nuovo, fino a un massimo di tentativi.
 */
function generateRandom(spec: GeneratorSpec, o: RandomOptions): GeneratedCards {
  const cols = spec.columns
    .map((c) => ({ c, fields: fieldsOf(c, true) }))
    .filter(({ c, fields }) => fields.length && c.values.length)
  const names = [...new Set(cols.flatMap(({ fields }) => fields))]
  const headers = [...names, 'amount']
  const count = Math.max(0, Math.min(MAX_GENERATED, Math.round(o.count) || 0))
  const empty = { headers, rows: [], total: count, truncated: false }
  if (!cols.length || !count) return empty
  const pick = (c: GeneratorColumn): number => Math.max(1, c.pick)
  if (
    cols.some(
      ({ c, fields }) => !feasible(c.values, pick(c) * fields.length, c.repeat, c.limits ?? {})
    )
  )
    return { ...empty, impossible: true }
  const rnd = seededRandom(o.seed)
  const filter = spec.filter.trim()
  const rows: string[][] = []
  const seen = new Set<string>()
  let filterError: string | undefined
  const tries = Math.min(MAX_TRIES, count * TRIES_PER_CARD)
  for (let t = 0; t < tries && rows.length < count; t++) {
    const cells = new Map<string, string[]>()
    const fields: Record<string, string> = {}
    let failed = false
    for (const { c, fields: targets } of cols) {
      const k = pick(c)
      const got = draw(c.values, k * targets.length, c.repeat, c.limits ?? {}, rnd)
      if (!got) {
        failed = true
        break
      }
      targets.forEach((name, f) => {
        let mine = got.slice(f * k, f * k + k)
        // senza ordine i valori della cella seguono l'ordine dell'elenco: A B e B A sono uguali
        if (!c.ordered) mine = [...mine].sort((a, b) => c.values.indexOf(a) - c.values.indexOf(b))
        cells.set(name, [...(cells.get(name) ?? []), cell(c, mine)])
        mine.forEach((v, n) => (fields[`${name}_${n + 1}`] ??= v))
      })
    }
    if (failed) continue
    const values = names.map((name) => (cells.get(name) ?? []).join(' '))
    if (o.unique) {
      const key = values.join('\u0000')
      if (seen.has(key)) continue
      seen.add(key)
    }
    if (filter) {
      names.forEach((name, j) => (fields[name] = values[j]))
      const r = evaluateFormula(filter.startsWith('=') ? filter : `=${filter}`, fields, {
        decimalComma: spec.decimalComma
      })
      if (r.error) {
        filterError ??= r.error
        break
      }
      if (!truthy(r.value)) continue
    }
    rows.push([...values, copiesOf(spec)])
  }
  return { headers, rows, total: count, truncated: false, ...(filterError ? { filterError } : {}) }
}

function truthy(v: string): boolean {
  const s = v.trim().toLowerCase()
  return s !== '' && s !== '0' && s !== 'false' && s !== 'no'
}

/** Come entrano le carte generate nel set */
export type GenerateMode = 'append' | 'replace' | 'update'

/**
 * Carte generate nel foglio del set: le colonne che mancano si aggiungono in fondo, le altre
 * colonne delle righe nuove restano vuote. "replace" toglie prima le righe esistenti; "update"
 * scrive le colonne generate nelle righe già presenti, una carta generata per riga nell'ordine
 * del foglio, senza toccare le altre colonne né amount. Le carte generate in più si aggiungono
 * in fondo.
 */
export function addGenerated(s: Sheet, gen: GeneratedCards, mode: GenerateMode): Sheet {
  const headers = [...s.headers]
  for (const h of gen.headers) if (!headers.includes(h)) headers.push(h)
  const widen = (r: string[]): string[] =>
    r.length < headers.length ? [...r, ...Array(headers.length - r.length).fill('')] : r
  const index = gen.headers.map((h) => headers.indexOf(h))
  const rows = gen.rows.map((r) => {
    const out = Array<string>(headers.length).fill('')
    r.forEach((v, i) => (out[index[i]] = v))
    return out
  })
  if (mode === 'update') {
    const updated = s.rows.map((r, i) => {
      const g = gen.rows[i]
      if (!g) return widen(r)
      const out = [...widen(r)]
      g.forEach((v, j) => gen.headers[j] !== 'amount' && (out[index[j]] = v))
      return out
    })
    return { ...s, headers, rows: [...updated, ...rows.slice(s.rows.length)] }
  }
  return { ...s, headers, rows: [...(mode === 'replace' ? [] : s.rows.map(widen)), ...rows] }
}
