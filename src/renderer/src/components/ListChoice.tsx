import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { cellChoice, findOption, isEmptyOption } from '../../../shared/model/template'
import type { ListColumn } from '../../../shared/model/sheet'
import { palette, resolveColor } from '../../../shared/model/variables'
import { plainText } from '../../../shared/model/markup'
import { OptionThumb } from '../editor/ListOptions'
import { useI18n } from '../i18n/context'
import { VariablesContext } from '../render/assets'

/**
 * Scelta di una voce dell'elenco di un livello nei campi della carta: miniature per le immagini,
 * campioni per i colori, una tendina per testi e valori. La voce vuota lascia il valore del
 * template; un valore fuori elenco (scritto nel foglio a mano) resta, segnalato.
 */
export default function ListChoice({
  list,
  value,
  column,
  onChange
}: {
  list: ListColumn
  /** null: più carte con valori diversi */
  value: string | null
  column: string
  onChange(v: string): void
}): React.JSX.Element {
  const { t } = useI18n()
  const variables = useContext(VariablesContext)
  const pal = useMemo(() => palette(variables), [variables])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const boxRef = useRef<HTMLSpanElement>(null)
  // un clic fuori chiude il menu
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent): void => {
      if (!boxRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    // il menu aperto in fondo al pannello si porta in vista
    boxRef.current?.querySelector('.list-popover')?.scrollIntoView({ block: 'nearest' })
    document.addEventListener('mousedown', down)
    return () => document.removeEventListener('mousedown', down)
  }, [open])
  const own = value === null ? '' : cellChoice(value)
  const picked = own ? findOption(list.options, own) : undefined
  const outside = own && !picked ? own : null
  // la voce del template: scelta, lascia la cella vuota. Una casella «Template» a parte serve
  // solo se il valore del template non è tra le voci
  const base = findOption(list.options, list.fallback)
  const fallback = base ?? list.fallback
  const label = (o: string): string =>
    isEmptyOption(o) ? t('list.empty') : plainText(o).replace(/\s+/g, ' ').trim() || '∅'

  if (list.type === 'text' || list.type === 'value')
    return (
      <span className="list-choice">
        <select
          data-column={column}
          className={own ? undefined : 'from-template'}
          value={value === null ? '\u0000' : picked === base ? '' : (picked ?? own)}
          onChange={(e) => onChange(e.target.value)}
        >
          {value === null && (
            <option value={'\u0000'} disabled>
              {t('cardForm.mixed')}
            </option>
          )}
          {!base && (
            <option value="">{t('list.fromTemplate', { value: label(list.fallback) })}</option>
          )}
          {list.options.map((o, i) => (
            <option key={i} value={o === base ? '' : o}>
              {o === base ? t('list.baseOption', { value: label(o) }) : label(o)}
            </option>
          ))}
          {outside && <option value={outside}>{t('list.notInList', { value: outside })}</option>}
        </select>
      </span>
    )

  const tile = (o: string, i: number | 'tpl'): React.JSX.Element => {
    const isTpl = i === 'tpl'
    const isBase = isTpl || o === base
    const on = value !== null && (isBase ? !own || picked === o : picked === o)
    return (
      <button
        key={i}
        type="button"
        className={'list-tile' + (on ? ' on' : '') + (isBase ? ' base' : '')}
        aria-pressed={on}
        title={isBase ? t('list.fromTemplate', { value: o }) : o}
        data-column={i === 0 ? column : undefined}
        onClick={(e) => {
          e.preventDefault()
          onChange(isBase ? '' : o)
        }}
      >
        {isEmptyOption(o) ? (
          <span className="list-swatch list-empty" aria-hidden="true" />
        ) : list.type === 'image' ? (
          <OptionThumb name={o} />
        ) : (
          <span className="list-swatch" style={{ background: resolveColor(o, pal) }} />
        )}
        <span className="list-tile-name">{isTpl ? t('list.template') : label(o)}</span>
        {isBase && !isTpl && <span className="list-base">{t('list.base')}</span>}
      </button>
    )
  }
  const warn = outside && (
    <span className="small warn">{t('list.notInList', { value: outside })}</span>
  )
  // poche voci: tutte le miniature; tante: la scelta attuale e un menu con la ricerca
  if (list.options.length <= MAX_TILES)
    return (
      <span className="list-choice tiles">
        {!base && tile(fallback, 'tpl')}
        {list.options.map((o, i) => tile(o, i))}
        {warn}
      </span>
    )
  const q = query.trim().toLowerCase()
  const shown = list.options
    .map((o, i) => [o, i] as const)
    .filter(([o]) => !q || o.toLowerCase().includes(q))
  const close = (): void => {
    setOpen(false)
    setQuery('')
  }
  return (
    <span className="list-choice menu" ref={boxRef}>
      <button
        type="button"
        className="list-current"
        data-column={column}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault()
          setOpen(!open)
        }}
      >
        {list.type === 'image' ? (
          <OptionThumb name={picked ?? (own || fallback)} />
        ) : (
          <span
            className="list-swatch"
            style={{ background: resolveColor(picked ?? (own || fallback), pal) }}
          />
        )}
        <span className="list-current-name">
          {value === null
            ? t('cardForm.mixed')
            : own
              ? label(own)
              : base
                ? t('list.baseOption', { value: base })
                : t('list.fromTemplate', { value: fallback })}
        </span>
        <span aria-hidden="true">▾</span>
      </button>
      {warn}
      {open && (
        <span
          className="list-popover"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              close()
            }
          }}
        >
          <input
            type="search"
            autoFocus
            placeholder={t('list.search', { n: String(list.options.length) })}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && shown.length) {
                e.preventDefault()
                onChange(shown[0][0])
                close()
              }
            }}
          />
          <span className="list-popover-grid" onClick={close}>
            {!q && !base && tile(fallback, 'tpl')}
            {shown.map(([o, i]) => tile(o, i))}
            {!shown.length && <span className="small muted">{t('list.noMatch')}</span>}
          </span>
        </span>
      )}
    </span>
  )
}

/** Oltre queste voci il campo mostra la scelta attuale e apre un menu con la ricerca */
const MAX_TILES = 8
