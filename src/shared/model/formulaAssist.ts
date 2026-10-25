// Assistente formule: catalogo delle funzioni per categoria, ricette già impostate e operazioni
// sull'albero di una formula (vedi FormulaNode in formula.ts). La finestra lavora sull'albero e
// scrive la formula come testo: il formato dei template non cambia.

import { parseExpression, printExpression, type BinaryOperator, type FormulaNode } from './formula'
import { parseAttrs, serializeAttrs, type Attrs } from './markup'

export const FORMULA_CATEGORIES = ['condition', 'selection', 'math', 'text', 'recipes'] as const
export type FormulaCategory = (typeof FORMULA_CATEGORIES)[number]

/** Cosa ci si aspetta in una casella: decide la scheda che si apre per prima */
export type SlotKind = 'condition' | 'number' | 'text' | 'value' | 'result'

export interface ArgSpec {
  /** Etichetta: chiave fx.arg.<key> */
  key: string
  kind: SlotKind
}

export interface FunctionSpec {
  args: ArgSpec[]
  /** Dall'ultimo argomento in poi se ne possono aggiungere altri uguali */
  variadic?: boolean
  /** Argomenti minimi; di base tutti */
  min?: number
}

const a = (key: string, kind: SlotKind): ArgSpec => ({ key, kind })

/** Argomenti delle funzioni, con il nome e il tipo di ogni casella */
export const FUNCTION_SPECS: Record<string, FunctionSpec> = {
  IF: {
    args: [a('condition', 'condition'), a('ifTrue', 'result'), a('ifFalse', 'result')],
    min: 2
  },
  AND: { args: [a('condition', 'condition')], variadic: true, min: 1 },
  OR: { args: [a('condition', 'condition')], variadic: true, min: 1 },
  NOT: { args: [a('condition', 'condition')] },
  ISBLANK: { args: [a('value', 'value')] },
  PICK: { args: [a('position', 'number'), a('item', 'result')], variadic: true, min: 2 },
  MIN: { args: [a('number', 'number')], variadic: true, min: 1 },
  MAX: { args: [a('number', 'number')], variadic: true, min: 1 },
  ROUND: { args: [a('number', 'number'), a('decimals', 'number')], min: 1 },
  FLOOR: { args: [a('number', 'number')] },
  CEILING: { args: [a('number', 'number')] },
  ABS: { args: [a('number', 'number')] },
  MOD: { args: [a('number', 'number'), a('divisor', 'number')] },
  UPPER: { args: [a('text', 'text')] },
  LOWER: { args: [a('text', 'text')] },
  LEN: { args: [a('text', 'text')] },
  CONCAT: { args: [a('text', 'text')], variadic: true, min: 1 },
  COUNTIN: { args: [a('text', 'text'), a('wanted', 'text')] }
}

/** Specifica dell'argomento i di una funzione, anche oltre gli argomenti scritti per le variadiche */
export function argSpec(fn: string, i: number): ArgSpec {
  const spec = FUNCTION_SPECS[fn]
  if (!spec) return a('value', 'value')
  return spec.args[Math.min(i, spec.args.length - 1)]
}

const E: FormulaNode = { k: 'empty' }
const num = (v: number): FormulaNode => ({ k: 'num', v })
const field = (name: string): FormulaNode => ({ k: 'field', name })
const call = (fn: string, ...args: FormulaNode[]): FormulaNode => ({ k: 'call', fn, args })
const bin = (op: BinaryOperator, l: FormulaNode, r: FormulaNode): FormulaNode => ({
  k: 'bin',
  op,
  l,
  r
})

export interface CatalogContext {
  /** Dentro il contenuto di una griglia: valgono {cell.*} */
  inCell: boolean
}

export interface CatalogEntry {
  /** Nome e descrizione: chiavi fx.entry.<id> e fx.entry.<id>.hint */
  id: string
  /** Funzione mostrata accanto al nome, se c'è */
  fn?: string
  make(ctx: CatalogContext): FormulaNode
  /** Solo in certi contesti */
  when?(ctx: CatalogContext): boolean
}

/** Il numero che cambia da elemento a elemento: la casella nella griglia, altrimenti il componente */
const counter = (ctx: CatalogContext): FormulaNode =>
  field(ctx.inCell ? 'cell.index' : 'card.number')

const everyN: CatalogEntry = {
  id: 'everyN',
  fn: 'MOD',
  make: (c) => call('IF', bin('=', call('MOD', counter(c), num(10)), num(0)), E, E)
}
const alternate: CatalogEntry = {
  id: 'alternate',
  fn: 'MOD',
  make: (c) => call('IF', bin('=', call('MOD', counter(c), num(2)), num(1)), E, E)
}
const checkerboard: CatalogEntry = {
  id: 'checkerboard',
  fn: 'MOD',
  when: (c) => c.inCell,
  make: () =>
    call(
      'IF',
      bin('=', call('MOD', bin('+', field('cell.row'), field('cell.column')), num(2)), num(0)),
      E,
      E
    )
}
const cycle: CatalogEntry = { id: 'cycle', fn: 'PICK', make: (c) => call('PICK', counter(c), E, E) }
const random: CatalogEntry = {
  id: 'random',
  fn: 'PICK',
  when: (c) => c.inCell,
  make: () => call('PICK', field('cell.random'), E, E)
}
const cases: CatalogEntry = {
  id: 'cases',
  fn: 'IF',
  make: () => call('IF', E, E, call('IF', E, E, E))
}

export const CATALOG: Record<FormulaCategory, CatalogEntry[]> = {
  condition: [
    { id: 'if', fn: 'IF', make: () => call('IF', E, E, E) },
    cases,
    { id: 'compare', make: () => bin('=', E, E) },
    { id: 'and', fn: 'AND', make: () => call('AND', E, E) },
    { id: 'or', fn: 'OR', make: () => call('OR', E, E) },
    { id: 'not', fn: 'NOT', make: () => call('NOT', E) },
    { id: 'isblank', fn: 'ISBLANK', make: () => call('ISBLANK', E) }
  ],
  selection: [
    { id: 'pick', fn: 'PICK', make: () => call('PICK', E, E, E) },
    cycle,
    random,
    everyN,
    alternate,
    checkerboard
  ],
  math: [
    { id: 'calc', make: () => bin('+', E, E) },
    { id: 'min', fn: 'MIN', make: () => call('MIN', E, E) },
    { id: 'max', fn: 'MAX', make: () => call('MAX', E, E) },
    { id: 'round', fn: 'ROUND', make: () => call('ROUND', E, num(0)) },
    { id: 'floor', fn: 'FLOOR', make: () => call('FLOOR', E) },
    { id: 'ceiling', fn: 'CEILING', make: () => call('CEILING', E) },
    { id: 'abs', fn: 'ABS', make: () => call('ABS', E) },
    { id: 'mod', fn: 'MOD', make: () => call('MOD', E, E) }
  ],
  text: [
    { id: 'join', make: () => bin('&', E, E) },
    { id: 'concat', fn: 'CONCAT', make: () => call('CONCAT', E, E) },
    { id: 'upper', fn: 'UPPER', make: () => call('UPPER', E) },
    { id: 'lower', fn: 'LOWER', make: () => call('LOWER', E) },
    { id: 'len', fn: 'LEN', make: () => call('LEN', E) },
    { id: 'countin', fn: 'COUNTIN', make: () => call('COUNTIN', E, E) }
  ],
  recipes: [
    everyN,
    alternate,
    checkerboard,
    cycle,
    random,
    {
      id: 'notEmpty',
      fn: 'ISBLANK',
      make: () => call('IF', call('ISBLANK', E), { k: 'str', v: '' }, E)
    },
    {
      id: 'byRange',
      fn: 'IF',
      make: () => call('IF', bin('>=', E, num(7)), E, call('IF', bin('>=', E, num(4)), E, E))
    }
  ]
}

export function catalogEntries(category: FormulaCategory, ctx: CatalogContext): CatalogEntry[] {
  return CATALOG[category].filter((e) => !e.when || e.when(ctx))
}

// --- percorsi nell'albero ---

/** Indici dei figli dalla radice: argomenti di una funzione, [sinistra, destra] di un operatore */
export type NodePath = number[]

export function children(n: FormulaNode): FormulaNode[] {
  if (n.k === 'call') return n.args
  if (n.k === 'bin') return [n.l, n.r]
  if (n.k === 'neg') return [n.v]
  return []
}

export function nodeAt(root: FormulaNode, path: NodePath): FormulaNode | undefined {
  let n: FormulaNode | undefined = root
  for (const i of path) n = n && children(n)[i]
  return n
}

/** Una copia dell'albero con `sub` al posto del nodo in `path` */
export function replaceAt(root: FormulaNode, path: NodePath, sub: FormulaNode): FormulaNode {
  if (!path.length) return sub
  const [i, ...rest] = path
  const child = children(root)[i]
  if (!child) return root
  const next = replaceAt(child, rest, sub)
  if (root.k === 'call') return { ...root, args: root.args.map((x, j) => (j === i ? next : x)) }
  if (root.k === 'bin') return i === 0 ? { ...root, l: next } : { ...root, r: next }
  if (root.k === 'neg') return { ...root, v: next }
  return root
}

/** Toglie l'argomento in `path` da una funzione */
export function removeArg(root: FormulaNode, path: NodePath): FormulaNode {
  const parent = nodeAt(root, path.slice(0, -1))
  if (parent?.k !== 'call') return root
  const i = path[path.length - 1]
  return replaceAt(root, path.slice(0, -1), {
    ...parent,
    args: parent.args.filter((_, j) => j !== i)
  })
}

/** Aggiunge un argomento vuoto in fondo alla funzione in `path` */
export function addArg(root: FormulaNode, path: NodePath): FormulaNode {
  const n = nodeAt(root, path)
  if (n?.k !== 'call') return root
  return replaceAt(root, path, { ...n, args: [...n.args, E] })
}

export function hasEmpty(n: FormulaNode): boolean {
  return n.k === 'empty' || children(n).some(hasEmpty)
}

/** Lunghezza di una catena di IF annidati nel ramo "se falso": IF(a; x; IF(b; y; z)) è 2 */
export function chainLength(n: FormulaNode): number {
  let len = 0
  let cur: FormulaNode | undefined = n
  while (cur?.k === 'call' && cur.fn === 'IF' && cur.args.length === 3) {
    len++
    cur = cur.args[2]
  }
  return len
}

// --- testo con campi e formattazione ---

/** Un pezzo di testo: testo scritto o un campo */
export type TextPart = { text: string } | { field: string }

export interface FormattedText {
  parts: TextPart[]
  /** Formattazione del markup, [testo]{attributi}; vuota senza formattazione */
  attrs: Attrs
}

/** I pezzi di una catena di &, in ordine; null se dentro c'è altro che testo e campi */
function concatParts(n: FormulaNode): TextPart[] | null {
  if (n.k === 'str') return [{ text: n.v }]
  if (n.k === 'field') return [{ field: n.name }]
  if (n.k === 'bin' && n.op === '&') {
    const l = concatParts(n.l)
    const r = concatParts(n.r)
    return l && r ? [...l, ...r] : null
  }
  return null
}

function mergeParts(parts: TextPart[]): TextPart[] {
  const out: TextPart[] = []
  for (const p of parts) {
    const last = out[out.length - 1]
    if ('text' in p && last && 'text' in last) out[out.length - 1] = { text: last.text + p.text }
    else if (!('text' in p) || p.text) out.push(p)
  }
  return out
}

const FORMAT_END = /\]\{([^{}]*)\}$/

/** Un nodo letto come testo con campi, con la formattazione [..]{..} se c'è; null se non lo è */
export function readText(n: FormulaNode): FormattedText | null {
  const raw = concatParts(n)
  if (!raw) return null
  const parts = mergeParts(raw)
  const first = parts[0]
  const last = parts[parts.length - 1]
  if (first && last && 'text' in first && 'text' in last && first.text.startsWith('[')) {
    const m = FORMAT_END.exec(last.text)
    if (m && (first !== last || last.text.length > m[0].length)) {
      const { attrs, problems } = parseAttrs(m[1])
      if (!problems.length) {
        const inner = [...parts]
        inner[0] = { text: first.text.slice(1) }
        const end = inner[inner.length - 1] as { text: string }
        inner[inner.length - 1] = { text: end.text.slice(0, end.text.length - m[0].length) }
        return { parts: mergeParts(inner), attrs }
      }
    }
  }
  return { parts, attrs: { styles: [] } }
}

/** Scrive il testo come catena di &: "[" & {campo} & "]{color=red}" */
export function writeText(t: FormattedText): FormulaNode {
  const attrs = serializeAttrs(t.attrs)
  const parts: TextPart[] = attrs ? [{ text: '[' }, ...t.parts, { text: `]{${attrs}}` }] : t.parts
  const merged = mergeParts(parts)
  if (!merged.length) return { k: 'str', v: '' }
  const nodes = merged.map((p): FormulaNode =>
    'text' in p ? { k: 'str', v: p.text } : { k: 'field', name: p.field }
  )
  return nodes.reduce((l, r) => bin('&', l, r))
}

/**
 * Pezzi di un testo scritto con i campi tra graffe: "Forza {forza}". Solo i nomi in `known`
 * diventano campi; le altre graffe restano testo (icone, variabili immagine, markup).
 */
export function partsFromTemplate(src: string, known: (name: string) => boolean): TextPart[] {
  const out: TextPart[] = []
  let last = 0
  for (const m of src.matchAll(/\{([^{}]+)\}/g)) {
    const name = m[1].trim()
    if (!known(name)) continue
    out.push({ text: src.slice(last, m.index) })
    out.push({ field: name })
    last = m.index! + m[0].length
  }
  out.push({ text: src.slice(last) })
  return mergeParts(out)
}

export function templateFromParts(parts: TextPart[]): string {
  return parts.map((p) => ('text' in p ? p.text : `{${p.field}}`)).join('')
}

// --- dal testo della formula all'albero e ritorno ---

export interface OpenedFormula {
  node?: FormulaNode
  error?: string
}

/**
 * Albero di una formula scritta: un'espressione con =, oppure una composizione come
 * "{nome}.png" (testo con campi) o "{forza}+2" (un calcolo). Nella composizione ogni graffa è un
 * campo, come quando si calcola.
 */
export function openFormula(expr: string): OpenedFormula {
  const src = expr.trim()
  if (!src) return { node: E }
  if (src.startsWith('=')) {
    const p = parseExpression(src.slice(1))
    return p.node ? { node: p.node } : { error: p.error }
  }
  // un calcolo si riconosce dall'operatore scritto fuori dalle graffe, come nella composizione
  if (/[-+*/]/.test(src.replace(/\{[^{}]*\}/g, ''))) {
    const p = parseExpression(src)
    if (p.node) return { node: p.node }
  }
  return { node: writeText({ parts: partsFromTemplate(src, () => true), attrs: { styles: [] } }) }
}

/**
 * La formula da scrivere nel campo. Un testo con soli campi resta una composizione senza =
 * ("Forza {forza}"), che nei livelli testo legge le colonne tradotte; il resto è un'espressione.
 */
export function formulaText(node: FormulaNode): string {
  const t = readText(node)
  if (t && !serializeAttrs(t.attrs)) {
    const plain = templateFromParts(t.parts)
    const literals = t.parts.map((p) => ('text' in p ? p.text : '')).join('')
    // nella composizione un operatore farebbe un calcolo e una graffa un campo
    if (!/[-+*/{}\\]/.test(literals) && plain) return plain
  }
  return '=' + printExpression(node)
}
