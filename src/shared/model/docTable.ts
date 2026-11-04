// Aspetto delle tabelle dei documenti e immagini nelle celle. Il Markdown non ha un modo per dire
// bordi e colori di una tabella: Stella li scrive in un commento subito sotto l'ultima riga,
//   <!-- table width=100% columns=30,20,50 border=#c8c8c2 lines=rows header=#f3f3f0 -->
// che gli altri programmi non mostrano e l'esportazione in Markdown non scrive. Nelle celle
// un'immagine o una carta si scrive come altrove: ![didascalia](icone/mappa.png?width=12).

/** Quali linee si disegnano: tutte, solo tra le righe, solo il contorno, nessuna */
export type TableLines = 'all' | 'rows' | 'outer' | 'none'
export const TABLE_LINES: TableLines[] = ['all', 'rows', 'outer', 'none']

export interface TableStyle {
  /** Larghezza in % della larghezza del testo; null per quella del contenuto */
  width: number | null
  /** Larghezza delle colonne in % della tabella; vuota (o più corta) per quella del contenuto */
  columns: number[]
  /** Colore delle linee (anche una variabile del progetto) */
  border: string
  /** Spessore delle linee in mm */
  borderWidth: number
  lines: TableLines
  /** Sfondo dell'intestazione; null per nessuno */
  header: string | null
  /** Sfondo delle altre righe; null per nessuno */
  fill: string | null
  /** Sfondo di una riga sì e una no (la seconda, la quarta...); null per nessuno */
  stripes: string | null
}

export const DEFAULT_TABLE_STYLE: TableStyle = {
  width: null,
  columns: [],
  border: '#c8c8c2',
  borderWidth: 0.25,
  lines: 'all',
  header: '#f3f3f0',
  fill: null,
  stripes: null
}

const LINE = /^\s*<!--\s*table(\s(?:(?!-->).)*)?-->\s*$/

/** Il commento dell'aspetto sotto una tabella? */
export const isTableStyleLine = (line: string | undefined): boolean =>
  line !== undefined && LINE.test(line)

/** Legge la riga dell'aspetto; `bad` sono le opzioni che non si capiscono */
export function parseTableStyle(line: string): { style: TableStyle; bad: string[] } {
  const style: TableStyle = { ...DEFAULT_TABLE_STYLE, columns: [] }
  const bad: string[] = []
  const body = LINE.exec(line)?.[1] ?? ''
  const color = (v: string): string | null => (v === 'none' || v === '' ? null : v)
  for (const part of body.trim().split(/\s+/)) {
    if (!part) continue
    const eq = part.indexOf('=')
    const k = eq < 0 ? part : part.slice(0, eq)
    const v = eq < 0 ? '' : part.slice(eq + 1)
    const n = parseFloat(v)
    if (k === 'width') {
      if (v === 'auto') style.width = null
      else if (n > 0 && n <= 100) style.width = n
      else bad.push(part)
    } else if (k === 'columns') {
      // 0 (o vuoto) è una colonna senza larghezza, che segue il contenuto: la scrive anche la
      // finestra della tabella quando una larghezza resta vuota
      const list = v.split(',').map((x) => (x.trim() === '' ? 0 : Number(x)))
      if (list.length && list.every((x) => Number.isFinite(x) && x >= 0 && x <= 100))
        style.columns = list
      else bad.push(part)
    } else if (k === 'border' && v) style.border = v
    else if (k === 'borderWidth' && n >= 0) style.borderWidth = n
    else if (k === 'lines' && TABLE_LINES.includes(v as TableLines)) style.lines = v as TableLines
    else if (k === 'header') style.header = color(v)
    else if (k === 'fill') style.fill = color(v)
    else if (k === 'stripes') style.stripes = color(v)
    else bad.push(part)
  }
  return { style, bad }
}

/** La riga dell'aspetto, solo con ciò che cambia rispetto a quello di base; vuota se niente */
export function tableStyleSource(s: TableStyle): string {
  const d = DEFAULT_TABLE_STYLE
  const opts: string[] = []
  const color = (c: string | null): string => c ?? 'none'
  if (s.width !== null) opts.push(`width=${round(s.width)}%`)
  if (s.columns.length) opts.push(`columns=${s.columns.map(round).join(',')}`)
  if (s.border !== d.border) opts.push(`border=${s.border}`)
  if (s.borderWidth !== d.borderWidth) opts.push(`borderWidth=${round(s.borderWidth)}`)
  if (s.lines !== d.lines) opts.push(`lines=${s.lines}`)
  if (s.header !== d.header) opts.push(`header=${color(s.header)}`)
  if (s.fill !== d.fill) opts.push(`fill=${color(s.fill)}`)
  if (s.stripes !== d.stripes) opts.push(`stripes=${color(s.stripes)}`)
  return opts.length ? `<!-- table ${opts.join(' ')} -->` : ''
}

const round = (n: number): string => String(Math.round(n * 100) / 100)

/** Un pezzo del testo di una cella: testo con il markup o un'immagine */
export type CellPart = { kind: 'text'; text: string } | { kind: 'image'; alt: string; src: string }

const IMAGE = /!\[([^\]]*)\]\(([^)]*)\)/g

/** Divide il testo di una cella nei testi e nelle immagini, in ordine */
export function cellParts(text: string): CellPart[] {
  const out: CellPart[] = []
  let last = 0
  for (const m of text.matchAll(IMAGE)) {
    const at = m.index ?? 0
    if (at > last) out.push({ kind: 'text', text: text.slice(last, at) })
    out.push({ kind: 'image', alt: m[1], src: m[2].trim() })
    last = at + m[0].length
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) })
  return out
}

/** Chiave dell'immagine k della cella: l'esportazione ritrova così l'immagine disegnata */
export const cellImageKey = (table: number, row: number, col: number, k: number): string =>
  `${table}:${row}:${col}:${k}`

/** Le linee di ciascun lato di una cella, per tabelle con `rows` righe (intestazione compresa) */
export function cellBorders(
  lines: TableLines,
  row: number,
  col: number,
  rows: number,
  cols: number
): { top: boolean; right: boolean; bottom: boolean; left: boolean } {
  const outer = lines === 'all' || lines === 'outer'
  const between = lines === 'all' || lines === 'rows'
  return {
    top: row === 0 ? outer || between : between,
    bottom: row === rows - 1 ? outer || between : between,
    left: col === 0 ? outer : lines === 'all',
    right: col === cols - 1 ? outer : lines === 'all'
  }
}
