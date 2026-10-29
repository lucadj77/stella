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

type Fn = (args: (() => Value)[]) => Value

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
      return fn(node.args.map((a) => () => ev(a)))
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
  try {
    return { value: toText(evaluateNode(node, fields)) }
  } catch (e) {
    if (e instanceof FormulaError) return { value: '', error: e.message }
    throw e
  } finally {
    shownFormat = undefined
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
