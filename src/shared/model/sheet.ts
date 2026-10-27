import type { Sheet } from '../project'
import { splitLanguage } from './language'
import { plainText } from './markup'
import { walkLayers } from './normalize'
import type { Template } from './template'

// Modifiche ai fogli dati. Tutte pure: restituiscono un nuovo foglio.

export function setCell(s: Sheet, row: number, col: number, value: string): Sheet {
  if (s.rows[row]?.[col] === value) return s
  const rows = s.rows.map((r, i) => {
    if (i !== row) return r
    const next = [...r]
    while (next.length < s.headers.length) next.push('')
    next[col] = value
    return next
  })
  return { ...s, rows }
}

/** Lo stesso valore nella colonna di più righe: la modifica in blocco delle carte selezionate */
export function setCells(s: Sheet, rows: number[], col: number, value: string): Sheet {
  return rows.reduce((acc, r) => setCell(acc, r, col, value), s)
}

/** Riga vuota inserita alla posizione indicata (in fondo se assente) */
export function insertRow(s: Sheet, at = s.rows.length, values?: string[]): Sheet {
  const row = s.headers.map((_, i) => values?.[i] ?? '')
  const rows = [...s.rows]
  rows.splice(at, 0, row)
  return { ...s, rows }
}

export function duplicateRows(s: Sheet, indexes: number[]): Sheet {
  const sorted = [...new Set(indexes)].sort((a, b) => a - b)
  const rows: string[][] = []
  s.rows.forEach((r, i) => {
    rows.push(r)
    if (sorted.includes(i)) rows.push([...r])
  })
  return { ...s, rows }
}

export function removeRows(s: Sheet, indexes: number[]): Sheet {
  const drop = new Set(indexes)
  return { ...s, rows: s.rows.filter((_, i) => !drop.has(i)) }
}

/** Sposta una riga: `to` è la posizione che avrà dopo lo spostamento */
export function moveRow(s: Sheet, from: number, to: number): Sheet {
  if (from === to || from < 0 || from >= s.rows.length) return s
  const rows = [...s.rows]
  const [row] = rows.splice(from, 1)
  rows.splice(Math.max(0, Math.min(rows.length, to)), 0, row)
  return { ...s, rows }
}

/**
 * Sposta più righe insieme, nel loro ordine, davanti alla riga `before` (indice nel foglio di
 * partenza; il numero delle righe per metterle in fondo). Restituisce anche i loro nuovi indici.
 */
export function moveRows(
  s: Sheet,
  indexes: number[],
  before: number
): { sheet: Sheet; rows: number[] } {
  const moving = new Set(indexes.filter((i) => i >= 0 && i < s.rows.length))
  if (!moving.size) return { sheet: s, rows: [] }
  const picked = s.rows.filter((_, i) => moving.has(i))
  const rest = s.rows.filter((_, i) => !moving.has(i))
  // la posizione tra le righe che restano: quante di quelle prima di `before` non si spostano
  let at = 0
  for (let i = 0; i < Math.min(before, s.rows.length); i++) if (!moving.has(i)) at++
  const rows = [...rest.slice(0, at), ...picked, ...rest.slice(at)]
  const unchanged = rows.every((r, i) => r === s.rows[i])
  return {
    sheet: unchanged ? s : { ...s, rows },
    rows: picked.map((_, k) => at + k)
  }
}

// ——— Ordinamento e filtro della vista: non cambiano il foglio ———

export interface RowView {
  /** Colonna su cui ordinare, null per l'ordine del foglio */
  sort: string | null
  desc: boolean
  /** Testo cercato, senza distinguere maiuscole e accenti */
  filter: string
  /** Colonna in cui cercare, null per tutte */
  filterColumn: string | null
}

export const NO_VIEW: RowView = { sort: null, desc: false, filter: '', filterColumn: null }

const fold = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/** Confronto di due celle: numeri come numeri, vuote in fondo, il resto in ordine alfabetico */
export function compareCells(a: string, b: string): number {
  const x = a.trim()
  const y = b.trim()
  if (!x || !y) return x ? -1 : y ? 1 : 0
  const nx = Number(x.replace(',', '.'))
  const ny = Number(y.replace(',', '.'))
  if (Number.isFinite(nx) && Number.isFinite(ny)) return nx - ny
  return collator.compare(plainText(x), plainText(y))
}

/** Righe da mostrare, come indici del foglio, nell'ordine della vista */
export function viewRows(s: Sheet, v: RowView): number[] {
  let rows = s.rows.map((_, i) => i)
  const q = fold(v.filter.trim())
  if (q) {
    const col = v.filterColumn === null ? -1 : s.headers.indexOf(v.filterColumn)
    const cols = col >= 0 ? [col] : s.headers.map((_, i) => i)
    rows = rows.filter((r) => cols.some((c) => fold(plainText(s.rows[r][c] ?? '')).includes(q)))
  }
  const col = v.sort === null ? -1 : s.headers.indexOf(v.sort)
  if (col >= 0) {
    const sign = v.desc ? -1 : 1
    // ordinamento stabile: a parità resta l'ordine del foglio; le celle vuote restano in fondo
    rows = [...rows].sort((a, b) => {
      const x = s.rows[a][col] ?? ''
      const y = s.rows[b][col] ?? ''
      const empty = Number(!x.trim()) - Number(!y.trim())
      return empty || sign * compareCells(x, y) || a - b
    })
  }
  return rows
}

/** Rende definitivo l'ordinamento della vista: le righe del foglio prendono quell'ordine */
export function applyOrder(s: Sheet, v: RowView): Sheet {
  const order = viewRows(s, { ...v, filter: '' })
  return { ...s, rows: order.map((i) => s.rows[i]) }
}

/**
 * Nuova colonna; le colonne delle proprietà e le traduzioni (`nome@en`) vanno subito dopo quella
 * del loro livello
 */
export function addColumn(s: Sheet, header: string): Sheet {
  if (s.headers.includes(header)) return s
  let at = s.headers.length
  const translated = splitLanguage(header)
  const dot = header.indexOf('.')
  const base = translated.language ? translated.base : dot > 0 ? header.slice(0, dot) : null
  if (base) {
    const last = s.headers.reduce(
      (found, h, i) =>
        h === base || h.startsWith(base + '.') || splitLanguage(h).base === base ? i : found,
      -1
    )
    if (last >= 0) at = last + 1
  }
  const headers = [...s.headers]
  headers.splice(at, 0, header)
  const rows = s.rows.map((r) => {
    const next = [...r]
    while (next.length < s.headers.length) next.push('')
    next.splice(at, 0, '')
    return next
  })
  return { ...s, headers, rows }
}

export function removeColumn(s: Sheet, col: number): Sheet {
  return {
    ...s,
    headers: s.headers.filter((_, i) => i !== col),
    rows: s.rows.map((r) => r.filter((_, i) => i !== col))
  }
}

export function renameColumn(s: Sheet, col: number, header: string): Sheet {
  if (s.headers.includes(header)) return s
  return { ...s, headers: s.headers.map((h, i) => (i === col ? header : h)) }
}

/**
 * Colonne che il template legge: amount, poi una per ogni testo, immagine o valore che prende il
 * valore da una colonna (con il nome del livello o quello indicato). Per un set nuovo sono le
 * intestazioni.
 */
export function templateColumns(t: Template): string[] {
  const cols = ['amount']
  for (const l of walkLayers([...t.front, ...t.back])) {
    if (l.source.kind !== 'column') continue
    // forme e gruppi (riempimento, visibilità) di solito sono decorazione: si aggiungono a mano
    if (l.type === 'group' || l.type === 'shape' || l.type === 'grid' || l.type === 'snap') continue
    const col = l.source.column ?? l.name
    if (!cols.includes(col)) cols.push(col)
  }
  return cols
}

/** Colonne di testo che il template legge: quelle che si traducono con `nome@lingua` */
export function textColumns(t: Template): Set<string> {
  const cols = new Set<string>()
  for (const l of walkLayers([...t.front, ...t.back]))
    if ((l.type === 'text' || l.type === 'value') && l.source.kind === 'column')
      cols.add(l.source.column ?? l.name)
  return cols
}

/** Proprietà che si possono aggiungere come colonne per un livello: `nome.color`, ... */
export function propertyColumns(t: Template, layerName: string): string[] {
  const l = walkLayers([...t.front, ...t.back]).find((x) => x.name === layerName)
  if (!l) return []
  // vincoli e margini per lato non hanno una forma scritta in una cella
  const skip = new Set([
    'id',
    'name',
    'type',
    'children',
    'source',
    'exposed',
    'locked',
    'constraints',
    'fade',
    'paddingSides',
    'snap'
  ])
  return Object.keys(l)
    .filter((k) => !skip.has(k))
    .map((k) => `${layerName}.${k}`)
}

/** Un foglio nuovo per un set */
export function newSheet(name: string, t: Template | null): Sheet {
  return { name, headers: t ? templateColumns(t) : ['amount', 'name'], rows: [] }
}

/** Nome di un set o di un foglio: niente caratteri che Excel non accetta nei fogli */
export const isValidSheetName = (n: string): boolean =>
  n.trim() === n && n.length > 0 && n.length <= 31 && !/[\\/?*[\]:]/.test(n)

/** Proprietà che contengono un colore, per tipo di livello */
const COLOR_PROPERTIES: Record<string, string[]> = {
  text: ['color'],
  image: ['tint'],
  shape: ['fill'],
  grid: ['fill', 'background']
}

/**
 * Colonne che contengono un colore, con il colore del template come valore di partenza:
 * `nome.color`, `icona.tint`, `banda.fill` e il valore principale delle forme (il riempimento).
 */
export function colorColumns(t: Template): Map<string, string | null> {
  const out = new Map<string, string | null>()
  for (const l of walkLayers([...t.front, ...t.back])) {
    const props = COLOR_PROPERTIES[l.type] ?? []
    const column = l.source.kind === 'column' && l.source.column ? l.source.column : l.name
    const values = l as unknown as Record<string, string | null>
    for (const p of props) out.set(`${column}.${p}`, values[p] ?? null)
    if ((l.type === 'shape' || l.type === 'grid') && l.source.kind === 'column')
      out.set(column, l.fill)
  }
  return out
}

// ——— Colonne mostrate in tabella e nei campi della carta ———

export interface ColumnInfo {
  header: string
  /** Posizione nel foglio; -1 se il template la legge ma il foglio non l'ha ancora */
  index: number
  /**
   * Valore principale di un livello fisso o con formula: si mostra il valore del template o il
   * risultato, non si modifica
   */
  computed: boolean
}

/**
 * Colonne del set: quelle del foglio, poi quelle che il template legge e il foglio non ha ancora
 * (si creano scrivendoci), poi i livelli fissi e con formula. Una colonna del foglio con il nome di
 * un livello fisso o con formula è calcolata: il suo contenuto non arriva alla carta.
 */
export function setColumns(s: Sheet, t: Template | null, others: Template[] = []): ColumnInfo[] {
  // con un template diverso per alcune carte contano anche le colonne di quello
  const all = t ? [t, ...others.filter((o) => o !== t)] : []
  const layers = all.flatMap((x) => walkLayers([...x.front, ...x.back]))
  const read = new Set(
    layers
      .filter((l) => l.source.kind === 'column')
      .map((l) => (l.source.kind === 'column' && l.source.column) || l.name)
  )
  const computedNames = new Set(
    layers
      .filter((l) => l.source.kind !== 'column' && l.type !== 'group' && !read.has(l.name))
      .map((l) => l.name)
  )
  const out: ColumnInfo[] = s.headers.map((header, index) => ({
    header,
    index,
    computed: computedNames.has(header)
  }))
  const seen = new Set(s.headers)
  for (const header of all.flatMap(templateColumns))
    if (!seen.has(header)) {
      seen.add(header)
      out.push({ header, index: -1, computed: false })
    }
  for (const l of layers)
    if (computedNames.has(l.name) && l.type !== 'shape' && l.type !== 'grid' && !seen.has(l.name)) {
      seen.add(l.name)
      out.push({ header: l.name, index: -1, computed: true })
    }
  return out
}

/**
 * Colonne da nascondere per tornare alla vista di base: restano quelle lette da un livello
 * collegato a una colonna (con le loro proprietà, `nome.color`, che vanno nei dettagli) e le
 * copie; spariscono le colonne del foglio che nessun livello legge, per esempio quelle rimaste da
 * un progetto TTC importato.
 */
export function defaultHiddenColumns(
  columns: ColumnInfo[],
  t: Template | null,
  others: Template[] = []
): string[] {
  const all = t ? [t, ...others.filter((o) => o !== t)] : []
  const read = new Set(['amount'])
  for (const l of all.flatMap((x) => walkLayers([...x.front, ...x.back])))
    if (l.source.kind === 'column') read.add(l.source.column ?? l.name)
  const linked = (h: string): boolean =>
    read.has(h) || (h.includes('.') && read.has(h.slice(0, h.indexOf('.'))))
  return columns.filter((c) => !c.computed && !linked(c.header)).map((c) => c.header)
}

/**
 * Scrive lo stesso valore nella colonna di più righe; se il foglio non ha la colonna la aggiunge,
 * ma solo per un valore non vuoto
 */
export function writeCells(s: Sheet, rows: number[], header: string, value: string): Sheet {
  let sheet = s
  if (!sheet.headers.includes(header)) {
    if (value === '') return s
    sheet = addColumn(sheet, header)
  }
  return setCells(sheet, rows, sheet.headers.indexOf(header), value)
}

/** Vero o falso scritto in una cella: true e false, in qualsiasi maiuscolo */
export function parseBool(v: string): boolean | null {
  const s = v.trim().toLowerCase()
  return s === 'true' ? true : s === 'false' ? false : null
}

/**
 * Colonne con valori vero o falso, da mostrare come caselle, con il valore del template quando
 * la cella è vuota (null se il template non ne ha uno). Sono le proprietà vero/falso dei livelli
 * (`stemma.visible`, `nome.italic`) e le colonne in cui ogni cella piena vale true o false; per
 * una colonna letta da un livello conta anche il valore del template.
 */
export function booleanColumns(s: Sheet, t: Template | null): Map<string, boolean | null> {
  const out = new Map<string, boolean | null>()
  const layers = t ? walkLayers([...t.front, ...t.back]) : []
  const byColumn = new Map<string, Record<string, unknown>>()
  for (const l of layers) {
    const column = l.source.kind === 'column' && l.source.column ? l.source.column : l.name
    byColumn.set(column, l as unknown as Record<string, unknown>)
  }
  const headers = [...new Set([...s.headers, ...(t ? templateColumns(t) : [])])]
  for (const h of headers) {
    if (h === 'amount') continue
    const dot = h.indexOf('.')
    const layer = byColumn.get(dot < 0 ? h : h.slice(0, dot))
    if (dot > 0) {
      const v = layer?.[h.slice(dot + 1)]
      if (typeof v === 'boolean') out.set(h, v)
      continue
    }
    // valore principale: il testo di un livello testo, il valore di un livello valore
    const fallback = layer
      ? parseBool(
          String(layer.type === 'text' ? layer.text : layer.type === 'value' ? layer.value : '')
        )
      : null
    const col = s.headers.indexOf(h)
    const cells = col < 0 ? [] : s.rows.map((r) => (r[col] ?? '').trim()).filter((v) => v !== '')
    if (!cells.every((v) => parseBool(v) !== null)) continue
    if (cells.length || fallback !== null) out.set(h, fallback)
  }
  return out
}

/** Testo da scrivere per vero o falso, con il maiuscolo già usato nella colonna */
export function boolText(s: Sheet, header: string, value: boolean): string {
  const col = s.headers.indexOf(header)
  const sample = col < 0 ? '' : (s.rows.map((r) => (r[col] ?? '').trim()).find((v) => v) ?? '')
  const text = value ? 'true' : 'false'
  return sample && sample === sample.toUpperCase() ? text.toUpperCase() : text
}
