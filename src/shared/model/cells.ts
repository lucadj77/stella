import { evaluateFormula, truthy } from './formula'
import { gridSize } from './grid'
import type { GridLayer } from './template'

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
  let h = 2166136261
  for (const c of `${card}|${grid}|${index}`) {
    h ^= c.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return {
    'cell.index': String(index + 1),
    'cell.row': String(Math.floor(index / columns) + 1),
    'cell.column': String((index % columns) + 1),
    'cell.count': String(count),
    'cell.rows': String(Math.ceil(count / columns)),
    'cell.columns': String(columns),
    'cell.random': String(((h >>> 0) % 999999) + 1)
  }
}

/**
 * La casella di riferimento del gruppo di una regola (k, da 0): la prima dove la regola vale con
 * i soli valori del template. Lì il gruppo si disegna com'è nell'editor; nelle altre caselle della
 * regola si sposta. 0 se la regola non vale in nessuna casella
 */
export function ruleAnchor(
  g: Pick<GridLayer, 'name' | 'rows' | 'columns' | 'cellRules'>,
  k: number
): number {
  const when = g.cellRules[k]?.when.trim()
  if (!when) return 0
  const { rows, columns } = gridSize(g)
  const count = rows * columns
  const expr = when.startsWith('=') ? when : `=${when}`
  for (let i = 0; i < count; i++) {
    const r = evaluateFormula(expr, cellFields(g.name, i, columns, count))
    if (!r.error && truthy(r.value)) return i
  }
  return 0
}
