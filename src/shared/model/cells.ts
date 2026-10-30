import { cellsList } from './cellRules'
import { evaluateFormula, truthy, type FormulaNumbers } from './formula'
import { gridSize } from './grid'
import type { GridLayer, Layer } from './template'

// Le caselle di una griglia viste dalle formule: i campi {cell.…} e la casella di riferimento del
// gruppo di una regola.

/**
 * Campi di una casella della griglia: posizione da 1 riga per riga, numero di caselle e un
 * numero a caso fisso per carta, griglia e casella, da usare con PICK.
 */
export function cellFields(
  grid: string,
  index: number,
  columns: number,
  count: number,
  card = 0
): Record<string, string> {
  // FNV-1a: lo stesso numero a ogni disegno della stessa carta
  const hash = (text: string): number => {
    let h = 2166136261
    for (const c of text) {
      h ^= c.charCodeAt(0)
      h = Math.imul(h, 16777619)
    }
    return h >>> 0
  }
  const h = hash(`${card}|${grid}|${index}`)
  return {
    'cell.index': String(index + 1),
    'cell.row': String(Math.floor(index / columns) + 1),
    'cell.column': String((index % columns) + 1),
    'cell.count': String(count),
    'cell.rows': String(Math.ceil(count / columns)),
    'cell.columns': String(columns),
    'cell.random': String((h % 999999) + 1),
    // uguale in tutte le caselle della griglia: DEAL mescola con questo
    'cell.seed': String(hash(`${card}|${grid}`))
  }
}

/** I livelli del contenuto di tutte le caselle, senza i gruppi */
function contentLayers(g: Pick<GridLayer, 'content' | 'groups'>): Layer[] {
  const name = g.content.trim()
  const group = name ? g.groups.find((x) => x.name === name) : undefined
  const walk = (ls: Layer[]): Layer[] =>
    ls.flatMap((l) => (l.type === 'group' ? walk(l.children) : [l]))
  return group ? walk(group.children) : []
}

/**
 * I livelli del contenuto con una formula, che le condizioni delle regole possono leggere per
 * nome: {griglia_text} è il testo scritto in quella casella
 */
export function contentCounters(g: Pick<GridLayer, 'content' | 'groups'>): string[] {
  return contentLayers(g)
    .filter((l) => l.source.kind === 'formula')
    .map((l) => l.name)
}

/**
 * I campi di ogni casella per le condizioni delle regole: quelli della carta, quelli {cell.…}, le
 * caselle nascoste dalle regole ({cell.hidden}, per CELLNUMBER(…; "visible")) e il valore dei
 * livelli del contenuto con una formula, prima delle regole
 */
export function ruleCellFields(
  g: Pick<GridLayer, 'name' | 'rows' | 'columns' | 'cellRules' | 'content' | 'groups'>,
  fields: Record<string, string>,
  numbers?: FormulaNumbers,
  card = 0
): Record<string, string>[] {
  const { rows, columns } = gridSize(g)
  const count = rows * columns
  const formulas = contentLayers(g).flatMap((l) =>
    l.source.kind === 'formula' ? [[l.name, l.source.expr] as const] : []
  )
  const withContent = (f: Record<string, string>): Record<string, string> => {
    if (!formulas.length) return f
    const out = { ...f }
    for (const [name, expr] of formulas) out[name] = evaluateFormula(expr, f, numbers).value
    return out
  }
  const base = Array.from({ length: count }, (_, i) => ({
    ...fields,
    ...cellFields(g.name, i, columns, count, card),
    'cell.hidden': ''
  }))
  // le caselle nascoste: con le regole che nascondono, lette senza le caselle nascoste
  const hiding = g.cellRules.filter((r) => r.hidden !== undefined && r.when.trim())
  if (!hiding.length) return base.map(withContent)
  const first = base.map(withContent)
  const hidden = first.flatMap((f, i) => {
    let off = false
    for (const r of hiding) {
      const w = r.when.trim()
      const v = evaluateFormula(w.startsWith('=') ? w : `=${w}`, f, numbers)
      if (!v.error && truthy(v.value)) off = r.hidden!
    }
    return off ? [i + 1] : []
  })
  if (!hidden.length) return first
  const list = cellsList(hidden)
  return base.map((f) => withContent({ ...f, 'cell.hidden': list }))
}

/** Le caselle (da 1) di {cell.hidden}, scritte con gli intervalli: 1-4, 9 */
export function hiddenCells(fields: Record<string, string>): Set<number> {
  const out = new Set<number>()
  for (const item of (fields['cell.hidden'] ?? '').split(',')) {
    const m = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(item)
    if (!m) continue
    for (let i = Number(m[1]); i <= Number(m[2] ?? m[1]); i++) out.add(i)
  }
  return out
}

/**
 * La casella di riferimento del gruppo di una regola (k, da 0): la prima dove la regola vale con
 * i soli valori del template. Lì il gruppo si disegna com'è nell'editor; nelle altre caselle della
 * regola si sposta. 0 se la regola non vale in nessuna casella
 */
export function ruleAnchor(
  g: Pick<GridLayer, 'name' | 'rows' | 'columns' | 'cellRules' | 'content' | 'groups'>,
  k: number
): number {
  const when = g.cellRules[k]?.when.trim()
  if (!when) return 0
  const expr = when.startsWith('=') ? when : `=${when}`
  const cells = ruleCellFields(g, {})
  for (let i = 0; i < cells.length; i++) {
    const r = evaluateFormula(expr, cells[i])
    if (!r.error && truthy(r.value)) return i
  }
  return 0
}
