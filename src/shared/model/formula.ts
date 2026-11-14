// Formule dei livelli, in due forme.
// - Composizione: {campo} prende il valore della riga; se il risultato è un'espressione
//   aritmetica (numeri, + - * / e parentesi) si calcola, altrimenti resta testo.
//   Esempi: "{forza}+2" → "5", "{nome}.png" → "Drago.png".
// - Espressione, se inizia con "=" come in Excel: =IF({forza}>3; "Forte"; "Debole").
//   Vedi docs/specifica.md, "Formule".

import { localizeNumber, readNumber, writeNumber, type NumberFormat } from './number'

export interface FormulaResult {
  value: string
  /** Campi citati che la riga non ha */
  missing: string[]
  /** Errore di sintassi o di calcolo, solo per le espressioni */
  error?: string
}

/**
 * Opzioni dei numeri (vedi model/numberFormat.ts): `shown` scrive il risultato come sulla carta,
 * 1.234,5; con `decimalComma` nelle espressioni 2,5 è un numero
 */
export interface FormulaNumbers {
  shown?: NumberFormat
  decimalComma?: boolean
}

export function evaluateFormula(
  expr: string,
  fields: Record<string, string>,
  numbers?: FormulaNumbers
): FormulaResult {
  if (expr.trimStart().startsWith('='))
    return evaluateExpression(expr.trimStart().slice(1), fields, numbers)
  const missing: string[] = []
  const text = expr.replace(/(?<!\\)\{([^{}*]+)\}/g, (_, raw: string) => {
    const name = raw.trim()
    if (Object.prototype.hasOwnProperty.call(fields, name)) return fields[name]
    missing.push(name)
    return ''
  })
  // si calcola solo se l'operatore è scritto nella formula: una data come 2026-10-18 in un
  // campo non deve diventare una sottrazione
  const hasOperator = /[-+*/]/.test(expr.replace(/\{[^{}]*\}/g, ''))
  const n = hasOperator ? arithmetic(text) : null
  if (n !== null) return { value: writeNumber(n, numbers?.shown), missing }
  // un testo: i campi che sono numeri si scrivono come sulla carta
  const shown = numbers?.shown
  return {
    value: shown
      ? expr.replace(/(?<!\\)\{([^{}*]+)\}/g, (_, raw: string) =>
          Object.prototype.hasOwnProperty.call(fields, raw.trim())
            ? localizeNumber(fields[raw.trim()], shown)
            : ''
        )
      : text,
    missing
  }
}

/** Il risultato di una condizione: vuoto, 0, FALSE e no valgono falso */
export function truthy(v: string): boolean {
  const s = v.trim().toLowerCase()
  return s !== '' && s !== '0' && s !== 'false' && s !== 'no'
}

function formatNumber(n: number): string {
  return writeNumber(n, shownFormat)
}

/** Formato dei numeri del risultato mentre si calcola un'espressione (evaluateNodeText) */
let shownFormat: NumberFormat | undefined

/**
 * Calcola un'espressione con + - * / e parentesi; null se non è un'espressione numerica. Un
 * numero può essere una percentuale, come la mostra il foglio: 50%*2 fa 1.
 */
export function arithmetic(src: string): number | null {
  const s = src.trim()
  // serve almeno un operatore o una cifra, e nient'altro che numeri e operatori
  if (!s || !/^[\d\s+\-*/().,%]+$/.test(s) || !/\d/.test(s)) return null
  const tokens = s.match(/\d+(?:[.,]\d+)?%?|[-+*/()%]/g) ?? []
  let i = 0
  const peek = (): string | undefined => tokens[i]
  const expr = (): number => {
    let v = term()
    while (peek() === '+' || peek() === '-') v = tokens[i++] === '+' ? v + term() : v - term()
    return v
  }
  const term = (): number => {
    let v = factor()
    while (peek() === '*' || peek() === '/') v = tokens[i++] === '*' ? v * factor() : v / factor()
    return v
  }
  const factor = (): number => {
    const t = tokens[i++]
    if (t === '-') return -factor()
    if (t === '+') return factor()
    if (t === '(') {
      const v = expr()
      if (tokens[i++] !== ')') throw new Error('parenthesis')
      return v
    }
    const n = t === undefined ? NaN : (readNumber(t) ?? NaN)
    if (t === undefined || !Number.isFinite(n)) throw new Error('number')
    return n
  }
  try {
    const v = expr()
    return i === tokens.length && Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}

// --- espressioni ---

export type Value = number | string | boolean

type Token =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'field'; v: string }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string }

class FormulaError extends Error {}

function tokenize(src: string, decimalComma = false): Token[] {
  const out: Token[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (/\s/.test(c)) {
      i++
    } else if (c === '{') {
      const end = src.indexOf('}', i)
      if (end < 0) throw new FormulaError('missing }')
      out.push({ t: 'field', v: src.slice(i + 1, end).trim() })
      i = end + 1
    } else if (c === '"') {
      // "" dentro una stringa è una virgoletta, come in Excel
      let v = ''
      i++
      for (;;) {
        if (i >= src.length) throw new FormulaError('missing "')
        if (src[i] === '"') {
          if (src[i + 1] === '"') {
            v += '"'
            i += 2
            continue
          }
          i++
          break
        }
        v += src[i++]
      }
      out.push({ t: 'str', v })
    } else if (/\d/.test(c) || (c === '.' && /\d/.test(src[i + 1] ?? ''))) {
      const comma = decimalComma ? /^\d+,\d+/.exec(src.slice(i)) : null
      if (comma) {
        // con la virgola per i decimali, come in Excel in italiano: gli argomenti si separano con ;
        out.push({ t: 'num', v: Number(comma[0].replace(',', '.')) })
        i += comma[0].length
        continue
      }
      const m = /^\d*\.?\d+|^\d+/.exec(src.slice(i))!
      // 2,5 sarebbe letto come due argomenti, 2 e 5: meglio un errore che un risultato sbagliato
      if (/^,\d/.test(src.slice(i + m[0].length)))
        throw new FormulaError(
          `write ${m[0]}.${/^,(\d+)/.exec(src.slice(i + m[0].length))![1]} with a dot; separate arguments with ;`
        )
      out.push({ t: 'num', v: Number(m[0]) })
      i += m[0].length
    } else if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!
      out.push({ t: 'id', v: m[0].toUpperCase() })
      i += m[0].length
    } else {
      const two = src.slice(i, i + 2)
      if (['<=', '>=', '<>', '!='].includes(two)) {
        out.push({ t: 'op', v: two === '!=' ? '<>' : two })
        i += 2
      } else if ('+-*/&=<>();,'.includes(c)) {
        out.push({ t: 'op', v: c })
        i++
      } else throw new FormulaError(`unexpected "${c}"`)
    }
  }
  return out
}

function toNumber(v: Value): number {
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v.trim() === '') return 0
  // anche 50%, 1 234,50 €: come li mostra il foglio
  const n = readNumber(v)
  if (n === null) throw new FormulaError(`"${v}" is not a number`)
  return n
}

function toText(v: Value): string {
  if (typeof v === 'number') return formatNumber(v)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  // un campo come 1 234.5 € resta testo, ma sulla carta si scrive nel suo formato
  return localizeNumber(v, shownFormat)
}

function toBool(v: Value): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  const s = v.trim().toLowerCase()
  return s !== '' && s !== '0' && s !== 'false' && s !== 'no'
}

/**
 * Un valore di un campo è un numero se lo sembra, altrimenti testo. 50% e 3,00 € restano testo,
 * così un IF li restituisce come li mostra il foglio; i calcoli e i confronti li leggono come numeri.
 */
function fieldValue(raw: string): Value {
  // anche 1,5 resta com'è scritto: un IF non deve cambiarlo in 1.5
  if (raw.includes(',')) return raw
  const n = Number(raw.trim())
  return raw.trim() !== '' && Number.isFinite(n) ? n : raw
}

function compare(a: Value, b: Value): number {
  const na = typeof a === 'number' || (typeof a === 'string' && readNumber(a) !== null)
  const nb = typeof b === 'number' || (typeof b === 'string' && readNumber(b) !== null)
  if (na && nb) return toNumber(a) - toNumber(b)
  // il testo si confronta senza badare alle maiuscole, come in Excel
  return toText(a).localeCompare(toText(b), undefined, { sensitivity: 'base' })
}

/**
 * Il percorso «a passi» tra le caselle (da 0, per righe) non nascoste: dalla prima, sempre alla
 * casella accanto non ancora contata, dritto se si può, altrimenti girando a destra, poi a
 * sinistra. Senza caselle accanto si salta alla più vicina. Segue un anello sul bordo, una
 * spirale o una strada disegnata nascondendo caselle
 */
function walkCells(
  rows: number,
  columns: number,
  hidden: Set<number>,
  byColumn: boolean
): number[] {
  const open = (r: number, c: number): boolean =>
    r >= 0 && r < rows && c >= 0 && c < columns && !hidden.has(r * columns + c)
  const all: [number, number][] = []
  for (let a = 0; a < (byColumn ? columns : rows); a++)
    for (let b = 0; b < (byColumn ? rows : columns); b++) {
      const [r, c] = byColumn ? [b, a] : [a, b]
      if (open(r, c)) all.push([r, c])
    }
  if (!all.length) return []
  const seen = new Set<number>()
  const order: number[] = []
  let [r, c] = all[0]
  // si parte verso destra (per riga) o verso il basso (per colonna)
  let [dr, dc] = byColumn ? [1, 0] : [0, 1]
  for (;;) {
    seen.add(r * columns + c)
    order.push(r * columns + c)
    const free = (rr: number, cc: number): boolean => open(rr, cc) && !seen.has(rr * columns + cc)
    // dritto, a destra, a sinistra
    const step = (
      [
        [dr, dc],
        [dc, -dr],
        [-dc, dr]
      ] as [number, number][]
    ).find(([a, b]) => free(r + a, c + b))
    if (step) {
      ;[dr, dc] = step
      r += dr
      c += dc
      continue
    }
    // nessuna casella accanto: la più vicina tra quelle che restano
    let best: [number, number] | null = null
    let dist = Infinity
    for (const [rr, cc] of all) {
      if (seen.has(rr * columns + cc)) continue
      const d = Math.abs(rr - r) + Math.abs(cc - c)
      if (d < dist) [best, dist] = [[rr, cc], d]
    }
    if (!best) return order
    ;[r, c] = best
  }
}

/** Le funzioni leggono gli argomenti; poche, come CELLNUMBER, anche i campi della casella */
type Fn = (args: (() => Value)[], fields: Record<string, string>) => Value

/** FNV-1a di un testo, 32 bit */
function hashText(text: string): number {
  let h = 2166136261
  for (const c of text) {
    h ^= c.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Numeri a caso della formula che si sta calcolando (RAND, RANDBETWEEN): mulberry32 con un seme
 * dato dal seme del set, dalla carta, dalla casella e dal testo della formula, così ogni disegno
 * della stessa carta dà gli stessi numeri e due chiamate nella stessa formula danno numeri diversi
 */
let randomState: { node: FormulaNode | null; seed: number | null } = { node: null, seed: null }

function nextRandom(fields: Record<string, string>): number {
  if (randomState.seed === null) {
    const where = ['set.seed', 'card.number', 'card.copy', 'cell.index'].map((k) => fields[k] ?? '')
    const what = randomState.node ? printExpression(randomState.node) : ''
    randomState.seed = hashText(`${where.join('|')}|${what}`)
  }
  randomState.seed = (randomState.seed + 0x6d2b79f5) >>> 0
  let t = randomState.seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** La formula usa numeri a caso: RAND, RANDBETWEEN, DEAL o {cell.random} */
export function usesRandom(text: string): boolean {
  return /\b(?:RAND|RANDBETWEEN|DEAL)\s*\(|\{\s*cell\.random\s*\}/i.test(text)
}

/** Funzioni disponibili; gli argomenti si valutano solo se servono (IF non calcola il ramo scartato) */
const FUNCTIONS: Record<string, Fn> = {
  IF: (a) => {
    if (a.length < 2 || a.length > 3) throw new FormulaError('IF needs 2 or 3 arguments')
    return toBool(a[0]()) ? a[1]() : a.length > 2 ? a[2]() : ''
  },
  AND: (a) => a.every((x) => toBool(x())),
  OR: (a) => a.some((x) => toBool(x())),
  NOT: (a) => !toBool(a[0]?.() ?? false),
  MIN: (a) => {
    if (!a.length) throw new FormulaError('MIN needs at least one argument')
    return Math.min(...a.map((x) => toNumber(x())))
  },
  MAX: (a) => {
    if (!a.length) throw new FormulaError('MAX needs at least one argument')
    return Math.max(...a.map((x) => toNumber(x())))
  },
  ABS: (a) => Math.abs(toNumber(a[0]())),
  ROUND: (a) => {
    const f = 10 ** (a[1] ? toNumber(a[1]()) : 0)
    return Math.round(toNumber(a[0]()) * f) / f
  },
  FLOOR: (a) => Math.floor(toNumber(a[0]())),
  CEILING: (a) => Math.ceil(toNumber(a[0]())),
  UPPER: (a) => toText(a[0]()).toUpperCase(),
  LOWER: (a) => toText(a[0]()).toLowerCase(),
  LEN: (a) => toText(a[0]()).length,
  CONCAT: (a) => a.map((x) => toText(x())).join(''),
  ISBLANK: (a) => toText(a[0]()).trim() === '',
  /** Resto della divisione, con il segno del divisore come in Excel: MOD({cell.index}; 10) */
  MOD: (a) => {
    if (a.length !== 2) throw new FormulaError('MOD needs 2 arguments')
    const n = toNumber(a[0]())
    const d = toNumber(a[1]())
    if (d === 0) throw new FormulaError('division by zero')
    return n - d * Math.floor(n / d)
  },
  /**
   * Un numero a caso tra 0 e 1, uguale a ogni disegno della stessa carta: cambia con il seme del
   * set ({set.seed}), con la carta, con la casella della griglia e con la formula
   */
  RAND: (a, fields) => {
    if (a.length) throw new FormulaError('RAND takes no arguments')
    return nextRandom(fields)
  },
  /** Un numero intero a caso tra i due estremi compresi: RANDBETWEEN(1; 6) */
  RANDBETWEEN: (a, fields) => {
    if (a.length !== 2) throw new FormulaError('RANDBETWEEN needs 2 arguments')
    const x = toNumber(a[0]())
    const y = toNumber(a[1]())
    const lo = Math.ceil(Math.min(x, y))
    const hi = Math.floor(Math.max(x, y))
    if (hi < lo) throw new FormulaError('RANDBETWEEN: no whole number between the two')
    return lo + Math.floor(nextRandom(fields) * (hi - lo + 1))
  },
  /**
   * L'n-esimo di un elenco, da 1, ricominciando dall'inizio dopo l'ultimo:
   * PICK({cell.index}; "spada"; "scudo"). Un solo elenco scritto con le virgole vale come più
   * voci: PICK({cell.random}; {icone}) con icone = "spada, scudo, mano".
   */
  PICK: (a) => {
    if (a.length < 2) throw new FormulaError('PICK needs a number and at least one item')
    const n = Math.floor(toNumber(a[0]()))
    const raw = a.slice(1).map((x) => toText(x()))
    const items = raw.length === 1 ? raw[0].split(',').map((x) => x.trim()) : raw
    if (!items.length || (items.length === 1 && items[0] === '')) return ''
    const k = items.length
    return items[(((n - 1) % k) + k) % k]
  },
  /**
   * Numero continuo delle caselle di una griglia, con le scelte in parole:
   * CELLNUMBER("columns"; "snake"; "down"; "visible"; 10). Ordine "rows" (di base) o "columns";
   * percorso "straight" (di base) o "snake", che a ogni riga riparte dal lato più vicino a dove
   * è finita la riga prima, o "path", che passa sempre alla casella accanto (un anello sul bordo,
   * una spirale; vedi walkCells); verso "up" (di base) o "down", dall'ultima casella;
   * "visible" salta le caselle nascoste dalle regole (e le righe senza caselle); l'ultimo numero è
   * da dove si parte (1 di base). Le scelte valgono in qualsiasi ordine
   */
  CELLNUMBER: (a, fields) => {
    const num = (k: string): number => Number(fields[k] ?? NaN)
    const [row, column, rows, columns] = [
      'cell.row',
      'cell.column',
      'cell.rows',
      'cell.columns'
    ].map(num)
    if (![row, column, rows, columns].every(Number.isFinite))
      throw new FormulaError('CELLNUMBER works only in the cells of a grid')
    const words = new Set<string>()
    let start = 1
    for (const x of a) {
      const v = x()
      const n = typeof v === 'number' ? v : readNumber(toText(v))
      if (n !== null) start = n
      else words.add(toText(v).trim().toLowerCase())
    }
    for (const w of words)
      if (
        !['rows', 'columns', 'straight', 'snake', 'path', 'up', 'down', 'visible', 'all'].includes(
          w
        )
      )
        throw new FormulaError(`CELLNUMBER: unknown choice "${w}"`)
    const byColumn = words.has('columns')
    const hidden = new Set(
      words.has('visible')
        ? (fields['cell.hidden'] ?? '').split(',').flatMap((x) => {
            const m = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(x)
            if (!m) return []
            const to = Number(m[2] ?? m[1])
            return Array.from({ length: to - Number(m[1]) + 1 }, (_, k) => Number(m[1]) + k - 1)
          })
        : []
    )
    // le caselle (da 0, per righe) nell'ordine del percorso
    const [lines, size] = byColumn ? [columns, rows] : [rows, columns]
    const order: number[] = words.has('path') ? walkCells(rows, columns, hidden, byColumn) : []
    let forward = true
    let last = -1
    for (let line = 0; line < (words.has('path') ? 0 : lines); line++) {
      const minors = Array.from({ length: size }, (_, m) => m).filter(
        (m) => !hidden.has(byColumn ? m * columns + line : line * columns + m)
      )
      if (!minors.length) continue
      if (words.has('snake') && last >= 0) {
        // si riparte dal capo più vicino a dove si è finito; a pari distanza si torna indietro
        const near = Math.abs(minors[0] - last)
        const far = Math.abs(minors[minors.length - 1] - last)
        forward = near === far ? !forward : near < far
      }
      const run = forward ? minors : [...minors].reverse()
      for (const m of run) order.push(byColumn ? m * columns + line : line * columns + m)
      last = run[run.length - 1]
    }
    const pos = order.indexOf((row - 1) * columns + (column - 1))
    if (pos < 0) return ''
    return start + (words.has('down') ? order.length - 1 - pos : pos)
  },
  /**
   * Distribuisce a caso le voci nelle caselle visibili di una griglia, con quante volte compare
   * ognuna: DEAL("spada"; 4; "scudo"; "3-5"; "mano"; ""). La quantità è un numero (esatta), un
   * intervallo ("3-5", "2-" almeno, "-3" al massimo) o vuota (quante servono). Un intervallo con
   * un massimo vale un numero a caso tra minimo e massimo; poi le caselle che restano prendono a
   * caso le voci senza massimo; le caselle in più restano vuote, in posti a caso. Un argomento in
   * più alla fine dice quante voci in tutto: DEAL("a"; "-2"; "b"; "-2"; "2-"). Le posizioni sono mescolate, uguali a ogni disegno della stessa carta
   */
  DEAL: (a, fields) => {
    const index = Number(fields['cell.index'] ?? NaN)
    const count = Number(fields['cell.count'] ?? NaN)
    if (!Number.isFinite(index) || !Number.isFinite(count))
      throw new FormulaError('DEAL works only in the cells of a grid')
    if (a.length < 2) throw new FormulaError('DEAL needs pairs of a value and how many times')
    const hidden = new Set<number>()
    for (const item of (fields['cell.hidden'] ?? '').split(',')) {
      const m = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(item)
      if (m) for (let i = Number(m[1]); i <= Number(m[2] ?? m[1]); i++) hidden.add(i)
    }
    if (hidden.has(index)) return ''
    const total = count - [...hidden].filter((i) => i <= count).length
    const pos = index - 1 - [...hidden].filter((i) => i < index).length
    /** Una quantità: un numero (esatta), un intervallo o vuota (senza limiti) */
    const quantity = (q: Value): { min: number; max: number } | null => {
      const text = toText(q).trim()
      // "-3" è un massimo, non un numero negativo: gli intervalli si leggono prima dei numeri
      const range = typeof q === 'number' ? null : /^(\d*)\s*-\s*(\d*)$/.exec(text)
      const n = typeof q === 'number' ? q : readNumber(text)
      if (range && (range[1] || range[2]))
        return {
          min: range[1] ? Number(range[1]) : 0,
          max: range[2] ? Number(range[2]) : Infinity
        }
      if (n !== null) return { min: Math.max(0, n), max: Math.max(0, n) }
      if (!text) return null
      throw new FormulaError(`DEAL: "${text}" is not a quantity`)
    }
    const items: { value: string; min: number; max: number }[] = []
    for (let i = 0; i + 1 < a.length; i += 2)
      items.push({ value: toText(a[i]()), ...(quantity(a[i + 1]()) ?? { min: 0, max: Infinity }) })
    // un argomento in più, alla fine: quante voci in tutto nella griglia ("2-", "3-5", 4)
    const all = a.length % 2 ? quantity(a[a.length - 1]()) : null
    // mulberry32: numeri a caso ripetibili dalla griglia e dalla carta
    let seed = Number(fields['cell.seed'] ?? 0) >>> 0
    const rand = (): number => {
      seed = (seed + 0x6d2b79f5) >>> 0
      let t = seed
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    const pick = (ks: number[]): number => ks[Math.floor(rand() * ks.length)]
    const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0)
    // un intervallo con un massimo ("0-2", "-3", "3-5") vale un numero a caso tra i due estremi;
    // senza massimo ("", "2-") la voce riempie le caselle che restano
    const lo = items.map((x) => Math.max(0, Math.floor(x.min)))
    const hi = items.map((x) => (Number.isFinite(x.max) ? Math.floor(x.max) : Infinity))
    const fills = hi.some((x) => !Number.isFinite(x))
    // voci in tutto: senza totale nessun controllo, al massimo le caselle della griglia
    const top = Math.min(total, all ? all.max : Infinity)
    const least = Math.min(top, all ? Math.floor(all.min) : 0)
    const draw = (): number[] =>
      lo.map((l, k) =>
        Number.isFinite(hi[k]) && hi[k] > l ? l + Math.floor(rand() * (hi[k] - l + 1)) : l
      )
    const fits = (xs: number[]): boolean => {
      const n = sum(xs)
      return n <= top && (fills || n >= least)
    }
    // si sorteggia di nuovo finché il totale va bene; dopo molti tentativi si aggiusta a mano
    let times = draw()
    for (let i = 0; i < 200 && !fits(times); i++) times = draw()
    // troppe voci: si tolgono a caso da quelle sopra il minimo
    while (sum(times) > top) {
      const above = times.flatMap((x, k) => (x > lo[k] ? [k] : []))
      if (!above.length) break
      times[pick(above)]--
    }
    // troppo poche: si aggiungono a caso a quelle sotto il massimo
    while (sum(times) < least) {
      const below = times.flatMap((x, k) => (x < hi[k] ? [k] : []))
      if (!below.length) break
      times[pick(below)]++
    }
    // le voci senza massimo riempiono le caselle che restano: tutte, o con un totale fino a un
    // numero a caso tra minimo e massimo del totale
    const from = Math.max(least, sum(times))
    const goal =
      all && Number.isFinite(top) && top > from ? from + Math.floor(rand() * (top - from + 1)) : top
    while (fills && sum(times) < goal)
      times[pick(hi.flatMap((x, k) => (Number.isFinite(x) ? [] : [k])))]++
    const bag = items.flatMap((x, k) => Array<string>(times[k]).fill(x.value))
    // le caselle che restano senza voce si mescolano con le altre
    while (bag.length < total) bag.push('')
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[bag[i], bag[j]] = [bag[j], bag[i]]
    }
    return bag[pos] ?? ''
  },
  /**
   * Vero se il valore è nell'elenco: INLIST({cell.index}; "3, 8, 11"). Un elenco scritto con le
   * virgole vale come più voci, e una voce come 1-5 vale per tutti i numeri da 1 a 5. I testi si
   * confrontano senza badare alle maiuscole: INLIST({tipo}; "drago, orco")
   */
  INLIST: (a) => {
    if (a.length < 2) throw new FormulaError('INLIST needs a value and at least one item')
    const v = a[0]()
    const text = toText(v).trim().toLowerCase()
    const n = typeof v === 'number' ? v : readNumber(text)
    return a
      .slice(1)
      .flatMap((x) => toText(x()).split(','))
      .map((x) => x.trim().toLowerCase())
      .some((item) => {
        if (item === text) return true
        if (n === null) return false
        const range = /^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/.exec(item)
        if (range) return n >= Number(range[1]) && n <= Number(range[2])
        const m = readNumber(item)
        return m !== null && m === n
      })
  },
  /** Quante volte compare un testo: COUNTIN({risorse}; "legno") */
  COUNTIN: (a) => {
    const text = toText(a[0]()).toLowerCase()
    const part = toText(a[1]?.() ?? '').toLowerCase()
    return part ? text.split(part).length - 1 : 0
  }
}

export const FORMULA_FUNCTIONS = Object.keys(FUNCTIONS)

/** Nodo dell'albero di un'espressione con =: lo legge parseExpression, lo scrive printExpression */
export type FormulaNode =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'bool'; v: boolean }
  | { k: 'field'; name: string }
  | { k: 'call'; fn: string; args: FormulaNode[] }
  | { k: 'bin'; op: BinaryOperator; l: FormulaNode; r: FormulaNode }
  | { k: 'neg'; v: FormulaNode }
  /** Casella ancora da riempire, solo nell'assistente: non si calcola */
  | { k: 'empty' }

export const COMPARISON_OPERATORS = ['=', '<>', '<', '>', '<=', '>='] as const
export type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number]
export type BinaryOperator = ComparisonOperator | '&' | '+' | '-' | '*' | '/'

export interface ParsedExpression {
  node?: FormulaNode
  /** Campi citati, in ordine e con le ripetizioni, anche quelli letti prima di un errore */
  fields: string[]
  error?: string
}

/** Legge un'espressione senza il = iniziale */
export function parseExpression(src: string, decimalComma = false): ParsedExpression {
  const fields: string[] = []
  try {
    const tokens = tokenize(src, decimalComma)
    let i = 0
    const peek = (): Token | undefined => tokens[i]
    const isOp = (v: string): boolean => peek()?.t === 'op' && peek()!.v === v
    const expect = (v: string): void => {
      if (!isOp(v)) throw new FormulaError(`expected "${v}"`)
      i++
    }
    const binary = (ops: string[], next: () => FormulaNode) => (): FormulaNode => {
      let l = next()
      while (ops.some(isOp)) {
        const op = tokens[i++].v as BinaryOperator
        l = { k: 'bin', op, l, r: next() }
      }
      return l
    }

    // un solo confronto per livello, come prima: a = b = c è un errore
    const comparison = (): FormulaNode => {
      const l = concat()
      const t = peek()
      if (t?.t === 'op' && (COMPARISON_OPERATORS as readonly string[]).includes(t.v)) {
        i++
        return { k: 'bin', op: t.v as BinaryOperator, l, r: concat() }
      }
      return l
    }
    const unary = (): FormulaNode => {
      if (isOp('-')) {
        i++
        return { k: 'neg', v: unary() }
      }
      if (isOp('+')) {
        i++
        return unary()
      }
      return primary()
    }
    const term = binary(['*', '/'], unary)
    const additive = binary(['+', '-'], term)
    const concat = binary(['&'], additive)
    const primary = (): FormulaNode => {
      const t = tokens[i++]
      if (!t) throw new FormulaError('unexpected end')
      if (t.t === 'num') return { k: 'num', v: t.v }
      if (t.t === 'str') return { k: 'str', v: t.v }
      if (t.t === 'field') {
        fields.push(t.v)
        return { k: 'field', name: t.v }
      }
      if (t.t === 'id') {
        if (t.v === 'TRUE') return { k: 'bool', v: true }
        if (t.v === 'FALSE') return { k: 'bool', v: false }
        if (!FUNCTIONS[t.v]) throw new FormulaError(`unknown function ${t.v}`)
        expect('(')
        const args: FormulaNode[] = []
        if (!isOp(')')) {
          args.push(comparison())
          // ; come in Excel in italiano, oppure ,
          while (isOp(';') || isOp(',')) {
            i++
            args.push(comparison())
          }
        }
        expect(')')
        return { k: 'call', fn: t.v, args }
      }
      if (t.v === '(') {
        const v = comparison()
        expect(')')
        return v
      }
      throw new FormulaError(`unexpected "${t.v}"`)
    }

    const node = comparison()
    if (i < tokens.length) throw new FormulaError(`unexpected "${tokens[i].v}"`)
    return { node, fields }
  } catch (e) {
    if (e instanceof FormulaError) return { fields, error: e.message }
    throw e
  }
}

/** Calcola un nodo; gli argomenti delle funzioni solo se servono (IF non calcola il ramo scartato) */
export function evaluateNode(node: FormulaNode, fields: Record<string, string>): Value {
  const ev = (n: FormulaNode): Value => evaluateNode(n, fields)
  switch (node.k) {
    case 'num':
    case 'str':
    case 'bool':
      return node.v
    case 'empty':
      throw new FormulaError('empty slot')
    case 'field':
      return fieldValue(fields[node.name] ?? '')
    case 'neg':
      return -toNumber(ev(node.v))
    case 'call': {
      const fn = FUNCTIONS[node.fn]
      if (!fn) throw new FormulaError(`unknown function ${node.fn}`)
      return fn(
        node.args.map((a) => () => ev(a)),
        fields
      )
    }
    case 'bin': {
      const { op } = node
      if (op === '&') return toText(ev(node.l)) + toText(ev(node.r))
      if (op === '+') return toNumber(ev(node.l)) + toNumber(ev(node.r))
      if (op === '-') return toNumber(ev(node.l)) - toNumber(ev(node.r))
      if (op === '*') return toNumber(ev(node.l)) * toNumber(ev(node.r))
      if (op === '/') {
        const l = toNumber(ev(node.l))
        const d = toNumber(ev(node.r))
        if (d === 0) throw new FormulaError('division by zero')
        return l / d
      }
      const c = compare(ev(node.l), ev(node.r))
      return { '=': c === 0, '<>': c !== 0, '<': c < 0, '>': c > 0, '<=': c <= 0, '>=': c >= 0 }[op]
    }
  }
}

/** Il valore di un nodo come lo darebbe la formula, o l'errore */
export function evaluateNodeText(
  node: FormulaNode,
  fields: Record<string, string>,
  shown?: NumberFormat
): { value: string; error?: string } {
  shownFormat = shown
  const outer = randomState
  randomState = { node, seed: null }
  try {
    return { value: toText(evaluateNode(node, fields)) }
  } catch (e) {
    if (e instanceof FormulaError) return { value: '', error: e.message }
    throw e
  } finally {
    shownFormat = undefined
    randomState = outer
  }
}

const PRECEDENCE: Record<BinaryOperator, number> = {
  '=': 1,
  '<>': 1,
  '<': 1,
  '>': 1,
  '<=': 1,
  '>=': 1,
  '&': 2,
  '+': 3,
  '-': 3,
  '*': 4,
  '/': 4
}

function precedence(n: FormulaNode): number {
  if (n.k === 'bin') return PRECEDENCE[n.op]
  if (n.k === 'neg') return 5
  return 6
}

/** Scrive un nodo come testo, senza il = iniziale; le parentesi solo dove servono */
export function printExpression(node: FormulaNode, decimalComma = false): string {
  const wrap = (n: FormulaNode, min: number): string => {
    const s = printExpression(n, decimalComma)
    return precedence(n) < min ? `(${s})` : s
  }
  switch (node.k) {
    case 'num':
      return decimalComma ? String(node.v).replace('.', ',') : String(node.v)
    case 'str':
      return `"${node.v.replace(/"/g, '""')}"`
    case 'bool':
      return node.v ? 'TRUE' : 'FALSE'
    case 'field':
      return `{${node.name}}`
    case 'empty':
      return ''
    case 'neg':
      return `-${wrap(node.v, 5)}`
    case 'call':
      return `${node.fn}(${node.args.map((a) => printExpression(a, decimalComma)).join('; ')})`
    case 'bin': {
      const p = PRECEDENCE[node.op]
      // a sinistra basta la stessa precedenza (a - b - c); a destra serve più alta: a - (b - c)
      const l = wrap(node.l, p === 1 ? 2 : p)
      const r = wrap(node.r, p + 1)
      return p === 1 || p === 2 ? `${l} ${node.op} ${r}` : `${l}${node.op}${r}`
    }
  }
}

function evaluateExpression(
  src: string,
  fields: Record<string, string>,
  numbers?: FormulaNumbers
): FormulaResult {
  const parsed = parseExpression(src, numbers?.decimalComma)
  const missing = parsed.fields.filter((f) => !Object.prototype.hasOwnProperty.call(fields, f))
  if (!parsed.node) return { value: '', missing, error: parsed.error }
  const r = evaluateNodeText(parsed.node, fields, numbers?.shown)
  return r.error ? { value: '', missing, error: r.error } : { value: r.value, missing }
}
