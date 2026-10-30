// Assistente formule: catalogo delle funzioni per categoria, ricette già impostate e operazioni
// sull'albero di una formula (vedi FormulaNode in formula.ts). La finestra lavora sull'albero e
// scrive la formula come testo: il formato dei template non cambia.

import {
  COMPARISON_OPERATORS,
  parseExpression,
  printExpression,
  type BinaryOperator,
  type FormulaNode
} from './formula'
import { gridSize } from './grid'
import { parseAttrs, serializeAttrs, type Attrs } from './markup'
import { walkLayers } from './normalize'
import type { Template } from './template'

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
  COUNTIN: { args: [a('text', 'text'), a('wanted', 'text')] },
  INLIST: { args: [a('value', 'value'), a('list', 'text')], variadic: true, min: 2 }
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
  /** Nelle regole delle caselle: i livelli del contenuto che si possono contare */
  counters?: string[]
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
    { id: 'isblank', fn: 'ISBLANK', make: () => call('ISBLANK', E) },
    { id: 'inlist', fn: 'INLIST', make: () => call('INLIST', E, E) }
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
export function openFormula(expr: string, decimalComma = false): OpenedFormula {
  const src = expr.trim()
  if (!src) return { node: E }
  if (src.startsWith('=')) {
    const p = parseExpression(src.slice(1), decimalComma)
    return p.node ? { node: p.node } : { error: p.error }
  }
  // un calcolo si riconosce dall'operatore scritto fuori dalle graffe, come nella composizione
  if (/[-+*/]/.test(src.replace(/\{[^{}]*\}/g, ''))) {
    const p = parseExpression(src, decimalComma)
    if (p.node) return { node: p.node }
  }
  return { node: writeText({ parts: partsFromTemplate(src, () => true), attrs: { styles: [] } }) }
}

/**
 * La formula da scrivere nel campo. Un testo con soli campi resta una composizione senza =
 * ("Forza {forza}"), che nei livelli testo legge le colonne tradotte; il resto è un'espressione.
 */
export function formulaText(node: FormulaNode, decimalComma = false): string {
  const t = readText(node)
  if (t && !serializeAttrs(t.attrs)) {
    const plain = templateFromParts(t.parts)
    const literals = t.parts.map((p) => ('text' in p ? p.text : '')).join('')
    // nella composizione un operatore farebbe un calcolo e una graffa un campo
    if (!/[-+*/{}\\]/.test(literals) && plain) return plain
  }
  return '=' + printExpression(node, decimalComma)
}

// --- dove si trova il livello ---

/** Caselle della griglia che ripete il livello: il suo gruppo è il contenuto di una griglia */
export interface CellContext {
  grid: string
  rows: number
  columns: number
  /** I campi di ogni casella, se già calcolati (con i valori del contenuto, nelle regole) */
  fields?: Record<string, string>[]
  /** I livelli del contenuto che una condizione può contare al posto di {cell.index} */
  counters?: string[]
}

/**
 * La griglia di cui il livello fa parte del contenuto (il gruppo stesso o un suo livello), dove
 * valgono {cell.*}; null fuori dal contenuto di una griglia.
 */
export function contentGrid(template: Template, layerId: string): CellContext | null {
  for (const side of [template.front, template.back]) {
    const all = walkLayers(side)
    // ogni gruppo della griglia, quello del contenuto e quelli delle regole
    for (const g of all)
      if (g.type === 'grid' && walkLayers(g.groups).some((l) => l.id === layerId))
        return { grid: g.name, ...gridSize(g) }
  }
  return null
}

/** La prima casella vuota, nell'ordine in cui si legge la formula */
export function firstEmpty(n: FormulaNode, path: NodePath = []): NodePath | null {
  if (n.k === 'empty') return path
  const c = children(n)
  for (let i = 0; i < c.length; i++) {
    const p = firstEmpty(c[i], [...path, i])
    if (p) return p
  }
  return null
}

// --- frasi guidate ---
// Il modo guidato mostra la formula come una frase con gli spazi da riempire. Ogni modello
// riconosce la propria forma nell'albero e ne elenca i pezzi: testo, spazio (un nodo), operatore
// o pulsante per aggiungere una voce. Una formula che non corrisponde a nessun modello si apre nel
// modo avanzato.

export type SentencePart =
  | { text: string }
  /** Uno spazio da riempire: il nodo in `blank`; `also` sono copie da tenere uguali */
  | {
      blank: NodePath
      kind: SlotKind
      label: string
      also?: NodePath[]
      /** Lo spazio vuole un'immagine anche se la formula dà un testo: un'icona */
      image?: boolean
    }
  | { op: NodePath; ops: readonly BinaryOperator[] }
  /** Una scelta tra testi fissi, nel testo in `choice`: le etichette sono chiavi della traduzione */
  | {
      choice: NodePath
      /** Le etichette sono testo da mostrare così com'è con raw */
      options: readonly { value: string; label: string; raw?: boolean }[]
      /** La scelta scrive un campo {nome} e non un testo */
      field?: boolean
    }
  /** Aggiunge una voce: un argomento alla funzione in `add`, o una fascia se `band` (con il campo in `field`) */
  | { add: NodePath; label: string; band?: boolean; field?: NodePath }
  /** Aggiunge un confronto alla condizione in `join`, con AND (e anche) o OR (oppure) */
  | { join: NodePath; fn: 'AND' | 'OR'; label: string }
  /** Toglie il confronto in `drop` da un AND o un OR */
  | { drop: NodePath; label: string }

export interface SentenceDefaults {
  /** Il campo da proporre: la prima colonna numerica, se c'è */
  field: string
  /** Risultati proposti secondo ciò che il livello si aspetta */
  yes: FormulaNode
  no: FormulaNode
  /** L'immagine da proporre per un'icona: la prima variabile immagine, se c'è */
  icon?: string
}

export interface SentenceTemplate {
  id: string
  /** Vale solo dentro il contenuto di una griglia */
  cell?: boolean
  /** Usa il contatore (casella o componente): fuori da una griglia conta i componenti */
  counter?: boolean
  /** Dà vero o falso: per il filtro del generatore e per mostrare o nascondere un gruppo */
  condition?: boolean
  /** Dà un testo da mostrare: solo nei livelli testo */
  text?: boolean
  make(ctx: CatalogContext, d: SentenceDefaults): FormulaNode
  /** I pezzi della frase, o null se il nodo non ha questa forma */
  parts(node: FormulaNode, ctx: CatalogContext): SentencePart[] | null
}

const isCall = (
  n: FormulaNode,
  fn: string,
  args?: number
): n is Extract<FormulaNode, { k: 'call' }> =>
  n.k === 'call' && n.fn === fn && (args === undefined || n.args.length === args)
const isBin = (n: FormulaNode, ops: readonly string[]): n is Extract<FormulaNode, { k: 'bin' }> =>
  n.k === 'bin' && ops.includes(n.op)
const isNum = (n: FormulaNode, v?: number): boolean =>
  n.k === 'num' && (v === undefined || n.v === v)
const isCounter = (n: FormulaNode, ctx: CatalogContext): boolean =>
  n.k === 'field' &&
  (n.name === (ctx.inCell ? 'cell.index' : 'card.number') ||
    (ctx.inCell && !!ctx.counters?.includes(n.name)))

/** «contando [la posizione / un livello del contenuto]», se ci sono livelli da contare */
const countBy = (path: NodePath, ctx: CatalogContext): SentencePart[] =>
  ctx.inCell && ctx.counters?.length
    ? [
        txt('fx.s.countingBy'),
        {
          choice: path,
          field: true,
          options: [
            { value: 'cell.index', label: 'fx.cn.position' },
            ...ctx.counters.map((name) => ({ value: name, label: name, raw: true }))
          ]
        }
      ]
    : []
const ARITH: readonly BinaryOperator[] = ['+', '-', '*', '/']

const blank = (path: NodePath, kind: SlotKind, label: string, also?: NodePath[]): SentencePart => ({
  blank: path,
  kind,
  label,
  also
})
const txt = (text: string): SentencePart => ({ text })

/** IF(MOD(contatore; N) = 0; A; B) */
const everyNth: SentenceTemplate = {
  id: 'everyN',
  counter: true,
  make: (c, d) => call('IF', bin('=', call('MOD', counter(c), num(10)), num(0)), d.yes, d.no),
  parts: (n, c) => {
    if (!isCall(n, 'IF', 3) || !isBin(n.args[0], ['=']) || !isNum(n.args[0].r, 0)) return null
    const mod = n.args[0].l
    if (!isCall(mod, 'MOD', 2) || !isCounter(mod.args[0], c)) return null
    return [
      txt('fx.s.every'),
      blank([0, 0, 1], 'number', 'fx.b.n'),
      ...(c.inCell && c.counters?.length
        ? [txt('fx.s.cells'), ...countBy([0, 0, 0], c), txt('fx.s.commaShow')]
        : [txt(c.inCell ? 'fx.s.cellsShow' : 'fx.s.componentsShow')]),
      blank([1], 'result', 'fx.b.show'),
      txt('fx.s.otherwise'),
      blank([2], 'result', 'fx.b.otherwise')
    ]
  }
}

/** IF(MOD(contatore; 2) = 1; A; B) */
const alternating: SentenceTemplate = {
  id: 'alternate',
  counter: true,
  make: (c, d) => call('IF', bin('=', call('MOD', counter(c), num(2)), num(1)), d.yes, d.no),
  parts: (n, c) => {
    if (!isCall(n, 'IF', 3) || !isBin(n.args[0], ['=']) || !isNum(n.args[0].r)) return null
    const mod = n.args[0].l
    if (!isCall(mod, 'MOD', 2) || !isCounter(mod.args[0], c) || !isNum(mod.args[1], 2)) return null
    return [
      txt('fx.s.alternate'),
      blank([1], 'result', 'fx.b.first'),
      txt('fx.s.and'),
      blank([2], 'result', 'fx.b.second')
    ]
  }
}

/** IF(MOD({cell.row} + {cell.column}; 2) = 0; A; B) */
const checker: SentenceTemplate = {
  id: 'checkerboard',
  cell: true,
  make: (_, d) =>
    call(
      'IF',
      bin('=', call('MOD', bin('+', field('cell.row'), field('cell.column')), num(2)), num(0)),
      d.yes,
      d.no
    ),
  parts: (n) => {
    if (!isCall(n, 'IF', 3) || !isBin(n.args[0], ['=']) || !isNum(n.args[0].r)) return null
    const mod = n.args[0].l
    if (!isCall(mod, 'MOD', 2) || !isNum(mod.args[1], 2)) return null
    const sum = mod.args[0]
    if (!isBin(sum, ['+']) || sum.l.k !== 'field' || sum.r.k !== 'field') return null
    if (![sum.l.name, sum.r.name].every((x) => x === 'cell.row' || x === 'cell.column')) return null
    return [
      txt('fx.s.checkerboard'),
      blank([1], 'result', 'fx.b.first'),
      txt('fx.s.and'),
      blank([2], 'result', 'fx.b.second')
    ]
  }
}

/** MOD(contatore; N) = 0: vero ogni N caselle o componenti, per le regole e i filtri */
const everyNthCond: SentenceTemplate = {
  id: 'everyNCond',
  counter: true,
  condition: true,
  make: (c) => bin('=', call('MOD', counter(c), num(10)), num(0)),
  parts: (n, c) => {
    if (!isBin(n, ['=']) || !isNum(n.r, 0)) return null
    const mod = n.l
    if (!isCall(mod, 'MOD', 2) || !isCounter(mod.args[0], c)) return null
    return [
      txt('fx.s.trueEvery'),
      blank([0, 1], 'number', 'fx.b.n'),
      txt(c.inCell ? 'fx.s.cells' : 'fx.s.components'),
      ...countBy([0, 0], c)
    ]
  }
}

/** Le scelte di CELLNUMBER, nell'ordine in cui le scrive l'assistente */
const CELLNUMBER_CHOICES = [
  ['up', 'down'],
  ['rows', 'columns'],
  ['straight', 'snake'],
  ['all', 'visible']
] as const

/**
 * CELLNUMBER("up"; "rows"; "straight"; "all"; 1): il numero continuo delle caselle, con le
 * scelte in parole
 */
const cellNumber: SentenceTemplate = {
  id: 'cellNumber',
  cell: true,
  make: () => call('CELLNUMBER', ...CELLNUMBER_CHOICES.map(([first]) => str(first)), num(1)),
  parts: (n) => {
    if (!isCall(n, 'CELLNUMBER', CELLNUMBER_CHOICES.length + 1)) return null
    const ok = CELLNUMBER_CHOICES.every((options, i) => {
      const a = n.args[i]
      return a.k === 'str' && (options as readonly string[]).includes(a.v)
    })
    if (!ok) return null
    const choice = (i: number): SentencePart => ({
      choice: [i],
      options: CELLNUMBER_CHOICES[i].map((value) => ({ value, label: `fx.cn.${value}` }))
    })
    return [
      txt('fx.s.cellNumber'),
      choice(0),
      choice(1),
      choice(2),
      txt('fx.s.comma'),
      choice(3),
      txt('fx.s.startFrom'),
      blank([4], 'number', 'fx.b.start')
    ]
  }
}

/** MOD({cell.row} + {cell.column}; 2) = 0: vero sulle caselle scure di una scacchiera */
const checkerCond: SentenceTemplate = {
  id: 'checkerboardCond',
  cell: true,
  condition: true,
  make: () =>
    bin('=', call('MOD', bin('+', field('cell.row'), field('cell.column')), num(2)), num(0)),
  parts: (n) => {
    if (!isBin(n, ['=']) || !isNum(n.r)) return null
    const mod = n.l
    if (!isCall(mod, 'MOD', 2) || !isNum(mod.args[1], 2)) return null
    const sum = mod.args[0]
    if (!isBin(sum, ['+']) || sum.l.k !== 'field' || sum.r.k !== 'field') return null
    if (![sum.l.name, sum.r.name].every((x) => x === 'cell.row' || x === 'cell.column')) return null
    return [txt('fx.s.trueCheckerboard')]
  }
}

const pickParts = (n: FormulaNode, intro: string): SentencePart[] => [
  txt(intro),
  ...(n.k === 'call' ? n.args.slice(1).map((_, i) => blank([i + 1], 'result', 'fx.b.item')) : []),
  { add: [], label: 'fx.addItem' }
]

/** PICK(contatore; voci…) */
const cycling: SentenceTemplate = {
  id: 'cycle',
  counter: true,
  make: (c, d) => call('PICK', counter(c), d.yes, d.no),
  parts: (n, c) =>
    isCall(n, 'PICK') && n.args.length >= 2 && isCounter(n.args[0], c)
      ? pickParts(n, 'fx.s.cycle')
      : null
}

/** PICK({cell.random}; voci…) */
const randomPick: SentenceTemplate = {
  id: 'random',
  cell: true,
  make: (_, d) => call('PICK', field('cell.random'), d.yes, d.no),
  parts: (n) =>
    isCall(n, 'PICK') &&
    n.args.length >= 2 &&
    n.args[0].k === 'field' &&
    n.args[0].name === 'cell.random'
      ? pickParts(n, 'fx.s.random')
      : null
}

/** IF(campo >= soglia; A; IF(campo >= soglia; B; C)): fasce dalla più alta */
const ranges: SentenceTemplate = {
  id: 'ranges',
  make: (_, d) =>
    call(
      'IF',
      bin('>=', field(d.field), num(7)),
      d.yes,
      call('IF', bin('>=', field(d.field), num(4)), { k: 'str', v: '' }, d.no)
    ),
  parts: (n) => {
    const len = chainLength(n)
    if (len < 2) return null
    const out: SentencePart[] = []
    const fieldPaths: NodePath[] = []
    for (let i = 0; i < len; i++) {
      const at = Array<number>(i).fill(2)
      const ifNode = nodeAt(n, at) as Extract<FormulaNode, { k: 'call' }>
      const cond = ifNode.args[0]
      if (!isBin(cond, ['>=']) || cond.l.k !== 'field') return null
      fieldPaths.push([...at, 0, 0])
    }
    for (let i = 0; i < len; i++) {
      const at = Array<number>(i).fill(2)
      out.push(txt(i === 0 ? 'fx.s.when' : 'fx.s.whenAlso'))
      if (i === 0) out.push(blank([0, 0], 'value', 'fx.b.field', fieldPaths.slice(1)))
      out.push(txt('fx.s.atLeast'))
      out.push(blank([...at, 0, 1], 'number', 'fx.b.threshold'))
      out.push(txt('fx.s.show'))
      out.push(blank([...at, 1], 'result', 'fx.b.show'))
    }
    out.push(txt('fx.s.otherwise'))
    out.push(blank(Array<number>(len).fill(2), 'result', 'fx.b.otherwise'))
    out.push({
      add: Array<number>(len - 1).fill(2),
      label: 'fx.addBand',
      band: true,
      field: [0, 0]
    })
    return out
  }
}

/**
 * Una condizione fatta di confronti: uno solo, oppure più confronti uniti da AND (e anche) o da OR
 * (oppure). null se dentro c'è altro.
 */
function condParts(cond: FormulaNode, at: NodePath): SentencePart[] | null {
  const fn =
    cond.k === 'call' && (cond.fn === 'AND' || cond.fn === 'OR') && cond.args.length >= 2
      ? cond.fn
      : null
  const items = fn && cond.k === 'call' ? cond.args : [cond]
  if (!items.every((c) => isBin(c, COMPARISON_OPERATORS))) return null
  const out: SentencePart[] = []
  items.forEach((_, i) => {
    const p = fn ? [...at, i] : at
    if (i > 0) out.push(txt(fn === 'AND' ? 'fx.s.and' : 'fx.s.or'))
    out.push(
      blank([...p, 0], 'value', 'fx.b.value'),
      { op: p, ops: COMPARISON_OPERATORS },
      blank([...p, 1], 'value', 'fx.b.comparedWith')
    )
    if (fn) out.push({ drop: p, label: 'fx.removeCondition' })
  })
  if (fn !== 'OR') out.push({ join: at, fn: 'AND', label: 'fx.addAnd' })
  if (fn !== 'AND') out.push({ join: at, fn: 'OR', label: 'fx.addOr' })
  return out
}

/** IF(a op b; A; B), anche con più confronti uniti da AND o OR */
const ifThen: SentenceTemplate = {
  id: 'if',
  make: (_, d) => call('IF', bin('>', field(d.field), num(3)), d.yes, d.no),
  parts: (n) => {
    if (!isCall(n, 'IF') || n.args.length < 2 || n.args.length > 3) return null
    const cond = condParts(n.args[0], [0])
    if (!cond) return null
    return [
      txt('fx.s.if'),
      ...cond,
      txt('fx.s.show'),
      blank([1], 'result', 'fx.b.show'),
      ...(n.args.length === 3
        ? [txt('fx.s.otherwise'), blank([2], 'result', 'fx.b.otherwise')]
        : [])
    ]
  }
}

/** IF(ISBLANK(campo); ""; A) */
const notEmpty: SentenceTemplate = {
  id: 'notEmpty',
  make: (_, d) => call('IF', call('ISBLANK', field(d.field)), { k: 'str', v: '' }, field(d.field)),
  parts: (n) => {
    if (!isCall(n, 'IF', 3) || !isCall(n.args[0], 'ISBLANK', 1)) return null
    if (n.args[1].k !== 'str' || n.args[1].v !== '') return null
    return [
      txt('fx.s.if'),
      blank([0, 0], 'value', 'fx.b.field'),
      txt('fx.s.isEmptyShowNothing'),
      blank([2], 'result', 'fx.b.show')
    ]
  }
}

/** a op b con + - * / */
const calc: SentenceTemplate = {
  id: 'calc',
  make: (_, d) => bin('+', field(d.field), num(1)),
  parts: (n) =>
    isBin(n, ARITH)
      ? [
          txt('fx.s.calc'),
          blank([0], 'number', 'fx.b.first'),
          { op: [], ops: ARITH },
          blank([1], 'number', 'fx.b.second')
        ]
      : null
}

/** Testo con campi, anche formattato */
const join: SentenceTemplate = {
  id: 'join',
  make: (_, d) => bin('&', field(d.field), { k: 'str', v: '' }),
  parts: (n) => (readText(n) ? [txt('fx.s.text'), blank([], 'text', 'fx.b.text')] : null)
}

const str = (v: string): FormulaNode => ({ k: 'str', v })
const isStr = (n: FormulaNode, v: string): boolean => n.k === 'str' && n.v === v

/** "{" & icona & "*" & quante & "}": l'icona ripetuta, come {spada*3} nel testo */
const repeatIcon: SentenceTemplate = {
  id: 'repeatIcon',
  text: true,
  make: (_, d) =>
    bin(
      '&',
      bin('&', bin('&', bin('&', str('{'), d.icon ? str(d.icon) : E), str('*')), field(d.field)),
      str('}')
    ),
  parts: (n) => {
    if (!isBin(n, ['&']) || !isStr(n.r, '}')) return null
    const a = n.l
    if (!isBin(a, ['&'])) return null
    const b = a.l
    if (!isBin(b, ['&']) || !isStr(b.r, '*')) return null
    const c = b.l
    if (!isBin(c, ['&']) || !isStr(c.l, '{')) return null
    return [
      txt('fx.s.repeatIcon'),
      { ...blank([0, 0, 0, 1], 'result', 'fx.b.icon'), image: true },
      txt('fx.s.repeatTimes'),
      blank([0, 1], 'number', 'fx.b.times')
    ]
  }
}

/** a op b: vero o falso, per il filtro e i gruppi */
const comparing: SentenceTemplate = {
  id: 'compare',
  condition: true,
  make: (_, d) => bin('>', field(d.field), num(3)),
  parts: (n) => {
    const cond = condParts(n, [])
    return cond ? [txt('fx.s.trueWhen'), ...cond] : null
  }
}

/** NOT(ISBLANK(campo)) */
const notEmptyCond: SentenceTemplate = {
  id: 'notEmptyCond',
  condition: true,
  make: (_, d) => call('NOT', call('ISBLANK', field(d.field))),
  parts: (n) =>
    isCall(n, 'NOT', 1) && isCall(n.args[0], 'ISBLANK', 1)
      ? [txt('fx.s.trueWhen'), blank([0, 0], 'value', 'fx.b.field'), txt('fx.s.isNotEmpty')]
      : null
}

const isCellIndex = (n: FormulaNode): boolean => n.k === 'field' && n.name === 'cell.index'
const cellList = (): FormulaNode => ({ k: 'str', v: '1, 2, 3' })

/** IF(INLIST({cell.index}; "3, 8, 11"); A; B): qualcosa nelle caselle elencate */
const inCellsShow: SentenceTemplate = {
  id: 'inCells',
  cell: true,
  make: (_, d) => call('IF', call('INLIST', field('cell.index'), cellList()), d.yes, d.no),
  parts: (n) =>
    isCall(n, 'IF', 3) && isCall(n.args[0], 'INLIST', 2) && isCellIndex(n.args[0].args[0])
      ? [
          txt('fx.s.inCells'),
          blank([0, 1], 'text', 'fx.b.cells'),
          txt('fx.s.show'),
          blank([1], 'result', 'fx.b.show'),
          txt('fx.s.otherwise'),
          blank([2], 'result', 'fx.b.otherwise')
        ]
      : null
}

/** INLIST({cell.index}; "3, 8, 11"): vero nelle caselle elencate, per le regole delle caselle */
const inCellsCond: SentenceTemplate = {
  id: 'inCellsCond',
  cell: true,
  condition: true,
  make: () => call('INLIST', field('cell.index'), cellList()),
  parts: (n) =>
    isCall(n, 'INLIST', 2) && isCellIndex(n.args[0])
      ? [txt('fx.s.trueInCells'), blank([1], 'text', 'fx.b.cells')]
      : null
}

/** IF(INLIST(campo; "drago, orco"); A; B): un valore se il campo è uno di quelli elencati */
const inListShow: SentenceTemplate = {
  id: 'inList',
  make: (_, d) => call('IF', call('INLIST', field(d.field), { k: 'str', v: '' }), d.yes, d.no),
  parts: (n) =>
    isCall(n, 'IF', 3) && isCall(n.args[0], 'INLIST', 2)
      ? [
          txt('fx.s.if'),
          blank([0, 0], 'value', 'fx.b.field'),
          txt('fx.s.isOneOf'),
          blank([0, 1], 'text', 'fx.b.list'),
          txt('fx.s.show'),
          blank([1], 'result', 'fx.b.show'),
          txt('fx.s.otherwise'),
          blank([2], 'result', 'fx.b.otherwise')
        ]
      : null
}

/** INLIST(campo; "drago, orco"): vero se il campo è uno di quelli elencati */
const inListCond: SentenceTemplate = {
  id: 'inListCond',
  condition: true,
  make: (_, d) => call('INLIST', field(d.field), { k: 'str', v: '' }),
  parts: (n) =>
    isCall(n, 'INLIST', 2)
      ? [
          txt('fx.s.trueWhen'),
          blank([0], 'value', 'fx.b.field'),
          txt('fx.s.isOneOf'),
          blank([1], 'text', 'fx.b.list')
        ]
      : null
}

/** In ordine di riconoscimento: le forme più specifiche prima */
export const SENTENCES: SentenceTemplate[] = [
  cellNumber,
  everyNth,
  alternating,
  checker,
  randomPick,
  cycling,
  ranges,
  inCellsShow,
  inCellsCond,
  inListShow,
  inListCond,
  everyNthCond,
  checkerCond,
  ifThen,
  notEmpty,
  notEmptyCond,
  comparing,
  calc,
  repeatIcon,
  join
]

/** Ordine della schermata "cosa vuoi fare" */
export const START_ORDER = [
  'cellNumber',
  'if',
  'everyN',
  'alternate',
  'checkerboard',
  'inCells',
  'inList',
  'cycle',
  'random',
  'notEmpty',
  'ranges',
  'calc',
  'join',
  'repeatIcon',
  'inCellsCond',
  'everyNCond',
  'checkerboardCond',
  'compare',
  'inListCond',
  'notEmptyCond'
]

export interface SentenceContext extends CatalogContext {
  /** La formula deve dare vero o falso */
  condition: boolean
  /** Il livello è una griglia: le variazioni per casella passano dal contenuto, non da qui */
  onGrid: boolean
  /** Il risultato è vero o falso (un gruppo da mostrare o nascondere): valgono anche le condizioni */
  bool?: boolean
  /** Il risultato è un testo da mostrare: valgono anche i casi solo per i testi */
  text?: boolean
}

/** I modelli proposti in questo contesto, nell'ordine della schermata iniziale */
export function availableSentences(ctx: SentenceContext): SentenceTemplate[] {
  return START_ORDER.map((id) => SENTENCES.find((s) => s.id === id)!).filter((s) => {
    if (s.cell && !ctx.inCell) return false
    if (s.counter && ctx.onGrid) return false
    if (s.text && !ctx.text) return false
    if (ctx.condition) return !!s.condition
    return !s.condition || !!ctx.bool
  })
}

export function findSentence(
  node: FormulaNode,
  ctx: CatalogContext
): { template: SentenceTemplate; parts: SentencePart[] } | null {
  for (const template of SENTENCES) {
    const parts = template.parts(node, ctx)
    if (parts) return { template, parts }
  }
  return null
}

/** Uno spazio della frase guidata, con la frase più piccola che contiene se dentro c'è una funzione */
export type GuidedPart = SentencePart & { sub?: GuidedPart[] }

/** Ciò che sta in uno spazio senza bisogno di una frase: vuoto, numero, sì/no, campo, testo */
export function isLeafNode(n: FormulaNode): boolean {
  if (n.k === 'empty' || n.k === 'num' || n.k === 'bool' || n.k === 'field') return true
  if (n.k === 'neg') return n.v.k === 'num'
  return (n.k === 'str' || n.k === 'bin') && readText(n) !== null
}

const prefixed = (p: SentencePart, at: NodePath): SentencePart => {
  const pre = (x: NodePath): NodePath => [...at, ...x]
  if ('blank' in p) return { ...p, blank: pre(p.blank), also: p.also?.map(pre) }
  if ('op' in p) return { ...p, op: pre(p.op) }
  if ('choice' in p) return { ...p, choice: pre(p.choice) }
  if ('add' in p) return { ...p, add: pre(p.add), field: p.field && pre(p.field) }
  if ('join' in p) return { ...p, join: pre(p.join) }
  if ('drop' in p) return { ...p, drop: pre(p.drop) }
  return p
}

/**
 * La formula come frase guidata, con le frasi annidate: uno spazio che contiene una funzione
 * conosciuta diventa una frase più piccola dentro la frase. null se un pezzo non ha la forma di
 * nessuna frase: allora la formula si apre nel modo avanzato. I percorsi sono dalla radice.
 */
export function guide(
  node: FormulaNode,
  ctx: CatalogContext,
  at: NodePath = []
): GuidedPart[] | null {
  const found = findSentence(node, ctx)
  if (!found) return null
  const out: GuidedPart[] = []
  for (const part of found.parts) {
    const p: GuidedPart = prefixed(part, at)
    if ('blank' in part) {
      const inner = nodeAt(node, part.blank)
      if (inner && !isLeafNode(inner)) {
        const sub = guide(inner, ctx, [...at, ...part.blank])
        if (!sub) return null
        p.sub = sub
      }
    }
    out.push(p)
  }
  return out
}

type GuidedBlank = Extract<SentencePart, { blank: NodePath }> & { sub?: GuidedPart[] }

/** Tutti gli spazi della frase guidata in ordine, compresi quelli delle frasi annidate */
export function guidedBlanks(parts: GuidedPart[]): GuidedBlank[] {
  return parts.flatMap((p): GuidedBlank[] =>
    'blank' in p ? [p as GuidedBlank, ...(p.sub ? guidedBlanks(p.sub) : [])] : []
  )
}

/** Il primo spazio da riempire: il primo vuoto, o il primo spazio che non contiene una frase */
export function firstGuidedBlank(parts: GuidedPart[] | null, root: FormulaNode): NodePath | null {
  if (!parts) return null
  const blanks = guidedBlanks(parts).filter((b) => !b.sub)
  const empty = blanks.find((b) => nodeAt(root, b.blank)?.k === 'empty')
  return (empty ?? blanks[0])?.blank ?? null
}

/** Il campo da proporre: la prima colonna con un numero nella carta d'esempio, o la prima */
export function defaultField(
  columns: string[],
  fields: Record<string, string>,
  inCell = false
): string {
  const numeric = columns.find(
    (c) => fields[c] !== undefined && fields[c].trim() !== '' && readNumberLike(fields[c])
  )
  return numeric ?? columns[0] ?? (inCell ? 'cell.index' : 'card.number')
}

const readNumberLike = (v: string): boolean => Number.isFinite(Number(v.trim().replace(',', '.')))
