// Le caselle di una regola scelte con il clic: la condizione =INLIST({cell.index}; "2, 4, 10-12").

const INLIST = /^=?\s*INLIST\(\s*\{cell\.index\}\s*;\s*"([^"]*)"\s*\)\s*$/i

/** Le caselle di una condizione =INLIST({cell.index}; "…"), o null se è un'altra condizione */
export function pickedCells(when: string): number[] | null {
  const m = INLIST.exec(when)
  if (!m) return null
  const out = new Set<number>()
  for (const item of m[1].split(',')) {
    const range = /^\s*(\d+)\s*-\s*(\d+)\s*$/.exec(item)
    if (range) for (let i = Number(range[1]); i <= Number(range[2]); i++) out.add(i)
    else if (/^\s*\d+\s*$/.test(item)) out.add(Number(item))
  }
  return [...out].sort((a, b) => a - b)
}

/** Le caselle scritte con gli intervalli: 1-4, 9 */
export function cellsList(cells: number[]): string {
  const sorted = [...new Set(cells)].sort((a, b) => a - b)
  const parts: string[] = []
  for (let i = 0; i < sorted.length;) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++
    parts.push(j - i >= 2 ? `${sorted[i]}-${sorted[j]}` : sorted.slice(i, j + 1).join(', '))
    i = j + 1
  }
  return parts.join(', ')
}

/** La condizione per queste caselle */
export const cellsCondition = (cells: number[]): string =>
  `=INLIST({cell.index}; "${cellsList(cells)}")`
