import { useEffect, useRef } from 'react'
import type { Selection } from './selection'
import { useI18n } from '../i18n/context'

// Parti comuni delle schede di «Gestisci il progetto»: filtri a pillola, barra con la ricerca,
// tabella con selezione multipla (clic, ⌘/Ctrl, ⇧, ⌘A) e pannello laterale con dettagli e azioni.

export interface Filter {
  id: string
  label: string
  count: number
  hint?: string
}

export function Filters({
  filters,
  value,
  onChange
}: {
  filters: Filter[]
  value: string
  onChange(id: string): void
}): React.JSX.Element {
  return (
    <div className="images-filters" role="tablist">
      {filters.map((f) => (
        <button
          key={f.id}
          role="tab"
          aria-selected={value === f.id}
          className={value === f.id ? 'on' : ''}
          onClick={() => onChange(f.id)}
          title={f.hint}
        >
          {f.label} <span className="images-count">{f.count}</span>
        </button>
      ))}
    </div>
  )
}

export interface Row {
  key: string
  cells: React.ReactNode[]
  className?: string
}

export default function ListPane({
  hint,
  filters,
  tools,
  query,
  onQuery,
  columns,
  rows,
  total,
  sel,
  onOpen,
  onMenu,
  onDelete,
  side,
  empty,
  tableClass
}: {
  hint?: string
  filters?: React.ReactNode
  /** Controlli in più nella barra, dopo la ricerca */
  tools?: React.ReactNode
  query: string
  onQuery(q: string): void
  columns: { label: string; className?: string }[]
  rows: Row[]
  /** Voci in tutto, prima di filtri e ricerca */
  total: number
  sel: Selection
  /** Doppio clic o Invio */
  onOpen?(key: string): void
  onMenu?(e: React.MouseEvent, keys: string[]): void
  /** Canc o ⌫ sulla selezione */
  onDelete?(keys: string[]): void
  side: React.ReactNode
  empty: string
  tableClass?: string
}): React.JSX.Element {
  const { t } = useI18n()
  const wrap = useRef<HTMLDivElement>(null)
  const first = sel.chosen[0]
  // la voce scelta da un collegamento si vede subito, anche in fondo all'elenco
  useEffect(() => {
    if (!first) return
    const el = wrap.current?.querySelector(`[data-key="${CSS.escape(first)}"]`)
    el?.scrollIntoView({ block: 'nearest' })
    // solo all'apertura: dopo, è l'utente a scorrere
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div
      className="manage-pane"
      tabIndex={-1}
      onKeyDown={(e) => {
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
        if ((e.key === 'Delete' || e.key === 'Backspace') && sel.chosen.length && onDelete) {
          e.preventDefault()
          onDelete(sel.chosen)
        } else if (e.key === 'a' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          sel.set(rows.map((r) => r.key))
        } else if (e.key === 'Enter' && sel.chosen.length === 1 && onOpen) {
          e.preventDefault()
          onOpen(sel.chosen[0])
        }
      }}
    >
      {hint && <p className="muted small">{hint}</p>}
      {filters}
      <div className="asset-picker-bar">
        <input
          type="search"
          value={query}
          placeholder={t('manage.search')}
          onChange={(e) => onQuery(e.target.value)}
        />
        {tools}
      </div>
      <div className="images-body">
        <div className="manage-table-wrap" ref={wrap}>
          {rows.length === 0 ? (
            <p className="muted">{total ? t('manage.noneHere') : empty}</p>
          ) : (
            <table className={'manage-table' + (tableClass ? ' ' + tableClass : '')}>
              <thead>
                <tr>
                  {columns.map((c, i) => (
                    <th key={i} className={c.className}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.key}
                    data-key={r.key}
                    className={
                      (sel.selected.has(r.key) ? 'on' : '') + (r.className ? ' ' + r.className : '')
                    }
                    aria-selected={sel.selected.has(r.key)}
                    onClick={(e) => {
                      // i collegamenti nella riga portano altrove senza cambiare la selezione
                      if ((e.target as HTMLElement).closest('a, button.link')) return
                      sel.click(e, r.key)
                    }}
                    onDoubleClick={(e) => {
                      if ((e.target as HTMLElement).closest('a, button.link')) return
                      onOpen?.(r.key)
                    }}
                    onContextMenu={(e) => {
                      if (!onMenu) return
                      const keys = sel.selected.has(r.key) ? sel.chosen : [r.key]
                      if (!sel.selected.has(r.key)) sel.only(r.key)
                      onMenu(e, keys)
                    }}
                  >
                    {r.cells.map((c, i) => (
                      <td key={i} className={columns[i]?.className}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <aside className="images-side">{side}</aside>
      </div>
      <p className="muted small manage-count">
        {t('manage.count', { n: rows.length, total })}
        {sel.chosen.length > 1 && ` · ${t('manage.selected', { n: sel.chosen.length })}`}
      </p>
    </div>
  )
}

/** Un nome che porta a un'altra scheda, o all'elemento nella stessa */
export function Link({
  children,
  onClick,
  title
}: {
  children: React.ReactNode
  onClick(): void
  title?: string
}): React.JSX.Element {
  return (
    <button type="button" className="link" title={title} onClick={onClick}>
      {children}
    </button>
  )
}

/** Elenco di nomi cliccabili separati da virgole */
export function LinkList({
  items,
  onClick,
  format = (x) => x
}: {
  items: string[]
  onClick(name: string): void
  format?(name: string): string
}): React.JSX.Element {
  return (
    <>
      {items.map((x, i) => (
        <span key={x}>
          {i > 0 && ', '}
          <Link onClick={() => onClick(x)}>{format(x)}</Link>
        </span>
      ))}
    </>
  )
}

/** Righe «etichetta: valori» del pannello laterale; quelle vuote non si mostrano */
export function DetailList({
  rows
}: {
  rows: [string, React.ReactNode, boolean][]
}): React.JSX.Element {
  return (
    <dl>
      {rows
        .filter(([, , show]) => show)
        .map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
    </dl>
  )
}
