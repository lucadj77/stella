import { useEffect, useRef, useState } from 'react'
import { dragHasFiles, importDropped } from './dropImages'
import { confirmKey } from './confirm'
import type { Sheet } from '../../../shared/project'
import {
  boolText,
  moveRow,
  parseBool,
  removeColumn,
  writeCells,
  type ColumnInfo
} from '../../../shared/model/sheet'
import { useI18n } from '../i18n/context'
import MarkupTextarea from './MarkupTextarea'

interface Props {
  sheet: Sheet
  /** Colonne da mostrare, nell'ordine (vedi setColumns), già senza quelle nascoste */
  columns: ColumnInfo[]
  /** Colonne vero/falso, mostrate come caselle, con il valore del template per le celle vuote */
  booleans: Map<string, boolean | null>
  /** Valori dei livelli fissi e con formula di una riga */
  computed(row: number): Record<string, string>
  /** Righe selezionate; la prima è quella mostrata nell'anteprima */
  selected: number[]
  onSelect(rows: number[]): void
  /** `key` raggruppa le modifiche consecutive della stessa cella in un solo annullamento */
  onChange(sheet: Sheet, key?: string): void
  /** Righe mostrate, come indici del foglio, nell'ordine della vista (di base tutte) */
  rows?: number[]
  /** Colonna dell'ordinamento della vista e verso */
  sort?: { column: string | null; desc: boolean }
  /** Clic sull'intestazione: ordina per quella colonna */
  onSort?(column: string): void
}

interface Cell {
  row: number
  /** Intestazione della colonna */
  col: string
}

/**
 * Tabella del set modificabile come un foglio di calcolo: clic per scegliere la cella, doppio
 * clic, Invio o una lettera per scriverci. Le colonne che il foglio non ha ancora si creano
 * scrivendoci; quelle dei livelli fissi e con formula mostrano il valore e non si modificano.
 */
function DataTable({
  sheet,
  columns,
  booleans,
  computed,
  selected,
  onSelect,
  onChange,
  rows: shown,
  sort,
  onSort
}: Props): React.JSX.Element {
  const { t } = useI18n()
  const [active, setActive] = useState<Cell | null>(null)
  const [editing, setEditing] = useState<{ cell: Cell; original: string } | null>(null)
  const [dragRow, setDragRow] = useState<number | null>(null)
  const [dropRow, setDropRow] = useState<number | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const rows = shown ?? sheet.rows.map((_, i) => i)
  // con un ordinamento o un filtro le righe non si trascinano: l'ordine mostrato non è quello del foglio
  const reorderable = rows.length === sheet.rows.length && rows.every((r, k) => r === k)

  const info = new Map(columns.map((c) => [c.header, c]))
  const index = (h: string): number => sheet.headers.indexOf(h)
  const value = (c: Cell): string => sheet.rows[c.row]?.[index(c.col)] ?? ''
  const isComputed = (h: string): boolean => info.get(h)?.computed ?? false
  const write = (c: Cell, v: string): void => {
    if (isComputed(c.col)) return
    onChange(writeCells(sheet, [c.row], c.col, v), `cell:${c.row}:${c.col}`)
  }
  /** Valore di una casella: la cella, o il template se è vuota */
  const checked = (c: Cell): boolean => parseBool(value(c)) ?? booleans.get(c.col) ?? false
  const toggle = (c: Cell): void => write(c, boolText(sheet, c.col, !checked(c)))

  const activate = (c: Cell): void => {
    setActive(c)
    if (!selected.includes(c.row) || selected.length > 1) onSelect([c.row])
  }

  const startEdit = (c: Cell, replaceWith?: string): void => {
    if (isComputed(c.col)) return
    setEditing({ cell: c, original: value(c) })
    if (replaceWith !== undefined) write(c, replaceWith)
  }

  const move = (dr: number, dc: number): void => {
    if (!active) return
    const vi = columns.findIndex((v) => v.header === active.col)
    const col = columns[Math.max(0, Math.min(columns.length - 1, vi + dc))]?.header ?? active.col
    const at = rows.indexOf(active.row)
    const row = rows[Math.max(0, Math.min(rows.length - 1, at + dr))] ?? active.row
    activate({ row, col })
  }

  // la cella attiva resta visibile spostandosi con le frecce
  useEffect(() => {
    if (!active) return
    wrapRef.current
      ?.querySelector(`[data-cell="${active.row}:${CSS.escape(active.col)}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [active])

  // la selezione cambiata da fuori (PagSu, PagGiù) porta con sé la cella attiva e resta visibile
  const first = selected[0]
  const [prevFirst, setPrevFirst] = useState(first)
  if (first !== prevFirst) {
    setPrevFirst(first)
    if (active && first !== undefined && !selected.includes(active.row))
      setActive({ ...active, row: first })
  }
  useEffect(() => {
    if (first === undefined) return
    wrapRef.current?.querySelector(`tr[data-row="${first}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [first])

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (editing || !active || e.metaKey || e.ctrlKey) return
    const k = e.key
    if (k === 'ArrowUp') move(-1, 0)
    else if (k === 'ArrowDown') move(1, 0)
    else if (k === 'ArrowLeft') move(0, -1)
    else if (k === 'ArrowRight' || k === 'Tab') move(0, e.shiftKey && k === 'Tab' ? -1 : 1)
    else if (k === ' ' && booleans.has(active.col)) toggle(active)
    else if (k === 'Enter' || k === 'F2') startEdit(active)
    else if (k === 'Delete' || k === 'Backspace') write(active, '')
    else if (k.length === 1 && !e.altKey) startEdit(active, k)
    else return
    e.preventDefault()
  }

  const selectRow = (i: number, e: React.MouseEvent): void => {
    if (e.shiftKey && selected.length) {
      // intervallo nell'ordine mostrato
      const from = selected[0]
      const pa = rows.indexOf(from)
      const pb = rows.indexOf(i)
      const [a, b] = pa < pb ? [pa, pb] : [pb, pa]
      onSelect([from, ...rows.slice(Math.max(0, a), b + 1).filter((r) => r !== from)])
    } else if (e.metaKey || e.ctrlKey) {
      onSelect(selected.includes(i) ? selected.filter((r) => r !== i) : [...selected, i])
    } else onSelect([i])
    setActive(null)
    wrapRef.current?.focus()
  }

  return (
    <div className="table-wrap" ref={wrapRef} tabIndex={0} onKeyDown={onKeyDown}>
      <table className="data-table">
        <thead>
          <tr>
            <th className="row-num">#</th>
            {columns.map(({ header: h, index: i, computed: calc }) => (
              <th
                key={h}
                className={
                  [h.includes('.') && 'prop-col', calc && 'calc-col', i < 0 && 'new-col']
                    .filter(Boolean)
                    .join(' ') || undefined
                }
                title={
                  calc ? t('table.computedHint') : i < 0 ? t('table.newColumnHint') : undefined
                }
              >
                <span className="th-inner">
                  <span
                    title={onSort && i >= 0 && !calc ? t('table.sortHint', { column: h }) : h}
                    className={onSort && i >= 0 && !calc ? 'th-sort' : undefined}
                    onClick={() => i >= 0 && !calc && onSort?.(h)}
                  >
                    {calc && <span className="calc-mark">ƒ </span>}
                    {h}
                    {sort?.column === h && (
                      <span className="sort-mark">{sort.desc ? ' ↓' : ' ↑'}</span>
                    )}
                  </span>
                  {i >= 0 && (
                    <button
                      className="icon-btn danger th-remove"
                      title={t('table.removeColumn')}
                      onClick={async () => {
                        if (
                          await confirmKey(
                            t,
                            'table.removeColumnConfirm',
                            { column: h },
                            { danger: true }
                          )
                        )
                          onChange(removeColumn(sheet, i))
                      }}
                    >
                      ×
                    </button>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const row = sheet.rows[r]
            return (
              <tr
                key={r}
                data-row={r}
                className={[
                  selected.includes(r) && 'selected',
                  dropRow === r && dragRow !== null && (dragRow < r ? 'drop-after' : 'drop-before')
                ]
                  .filter(Boolean)
                  .join(' ')}
                onDragOver={(e) => {
                  if (dragRow === null) return
                  e.preventDefault()
                  if (dropRow !== r) setDropRow(r)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragRow !== null && dropRow !== null && dragRow !== dropRow) {
                    onChange(moveRow(sheet, dragRow, dropRow))
                    onSelect([dropRow])
                  }
                  setDragRow(null)
                  setDropRow(null)
                }}
              >
                <td
                  className="row-num"
                  draggable={reorderable}
                  title={reorderable ? t('table.rowHint') : t('table.rowHintSorted')}
                  onClick={(e) => selectRow(r, e)}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('text/plain', String(r + 1))
                    setDragRow(r)
                  }}
                  onDragEnd={() => {
                    setDragRow(null)
                    setDropRow(null)
                  }}
                >
                  {r + 1}
                </td>
                {columns.map(({ header: h, index: i, computed: calc }) => {
                  const c = { row: r, col: h }
                  const isActive = active?.row === r && active.col === h
                  const isEditing = editing?.cell.row === r && editing.cell.col === h
                  const raw = i >= 0 ? (row[i] ?? '') : ''
                  const bool = !calc && !isEditing && booleans.has(h)
                  return (
                    <td
                      key={h}
                      data-cell={`${r}:${h}`}
                      className={
                        [isActive && 'active-cell', calc && 'calc-cell', bool && 'bool-cell']
                          .filter(Boolean)
                          .join(' ') || undefined
                      }
                      onClick={() => activate(c)}
                      onDoubleClick={() => !bool && startEdit(c)}
                      // un'immagine trascinata dal computer sulla cella ne diventa il valore
                      onDragOver={(e) => {
                        if (!calc && !bool && dragHasFiles(e)) e.preventDefault()
                      }}
                      onDrop={async (e) => {
                        if (calc || bool || !dragHasFiles(e)) return
                        e.preventDefault()
                        e.stopPropagation()
                        const [name] = await importDropped(e)
                        if (name) write(c, name)
                      }}
                    >
                      {calc ? (
                        (computed(r)[h] ?? '')
                      ) : bool ? (
                        <input
                          type="checkbox"
                          className={raw.trim() ? undefined : 'bool-default'}
                          title={raw.trim() ? raw : t('table.boolDefault')}
                          checked={checked(c)}
                          onChange={() => toggle(c)}
                        />
                      ) : isEditing ? (
                        <CellEditor
                          value={raw}
                          fields={sheet.headers.filter((h) => h !== 'amount' && !h.includes('.'))}
                          onChange={(v) => write(c, v)}
                          onDone={(how) => {
                            if (how === 'cancel') write(c, editing.original)
                            setEditing(null)
                            wrapRef.current?.focus()
                            if (how === 'down') move(1, 0)
                            if (how === 'right') move(0, 1)
                            if (how === 'left') move(0, -1)
                          }}
                        />
                      ) : (
                        raw
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      {sheet.rows.length === 0 && <p className="muted table-empty">{t('table.empty')}</p>}
      {sheet.rows.length > 0 && rows.length === 0 && (
        <p className="muted table-empty">{t('table.noMatch')}</p>
      )}
    </div>
  )
}

/** Campo di una cella: le modifiche arrivano subito alla carta, Esc le annulla */
function CellEditor({
  value,
  onChange,
  onDone,
  fields
}: {
  value: string
  /** Campi proposti dentro {...} */
  fields: string[]
  onChange(v: string): void
  onDone(how: 'down' | 'right' | 'left' | 'cancel' | 'blur'): void
}): React.JSX.Element {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])
  return (
    <MarkupTextarea
      ref={ref}
      fields={fields}
      showProblems={false}
      className="cell-editor"
      value={value}
      rows={Math.max(1, value.split('\n').length)}
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => onDone('blur')}
      onKeyDown={(e) => {
        e.stopPropagation()
        // Alt+Invio va a capo dentro la cella, come in Excel
        if (e.key === 'Enter' && e.altKey) {
          e.preventDefault()
          const el = e.currentTarget
          const pos = el.selectionStart
          onChange(el.value.slice(0, pos) + '\n' + el.value.slice(el.selectionEnd))
          requestAnimationFrame(() => el.setSelectionRange(pos + 1, pos + 1))
        } else if (e.key === 'Enter') {
          e.preventDefault()
          onDone('down')
        } else if (e.key === 'Tab') {
          e.preventDefault()
          onDone(e.shiftKey ? 'left' : 'right')
        } else if (e.key === 'Escape') {
          e.preventDefault()
          onDone('cancel')
        }
      }}
    />
  )
}

export default DataTable
