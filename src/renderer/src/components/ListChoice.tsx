import { useContext, useMemo } from 'react'
import { findOption } from '../../../shared/model/template'
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
  const own = value?.trim() ?? ''
  const picked = own ? findOption(list.options, own) : undefined
  const outside = own && !picked ? own : null
  const fallback = findOption(list.options, list.fallback) ?? list.fallback
  const label = (o: string): string => plainText(o).replace(/\s+/g, ' ').trim() || '∅'

  if (list.type === 'text' || list.type === 'value')
    return (
      <span className="list-choice">
        <select
          data-column={column}
          className={own ? undefined : 'from-template'}
          value={value === null ? '\u0000' : (picked ?? own)}
          onChange={(e) => onChange(e.target.value)}
        >
          {value === null && (
            <option value={'\u0000'} disabled>
              {t('cardForm.mixed')}
            </option>
          )}
          <option value="">{t('list.fromTemplate', { value: label(list.fallback) })}</option>
          {list.options.map((o, i) => (
            <option key={i} value={o}>
              {label(o)}
            </option>
          ))}
          {outside && <option value={outside}>{t('list.notInList', { value: outside })}</option>}
        </select>
      </span>
    )

  const tile = (o: string, i: number | 'tpl'): React.JSX.Element => {
    const isTpl = i === 'tpl'
    const on = value !== null && (isTpl ? !own : picked === o)
    return (
      <button
        key={i}
        type="button"
        className={'list-tile' + (on ? ' on' : '') + (isTpl ? ' tpl' : '')}
        aria-pressed={on}
        title={isTpl ? t('list.fromTemplate', { value: o }) : o}
        data-column={i === 0 ? column : undefined}
        onClick={(e) => {
          e.preventDefault()
          onChange(isTpl ? '' : o)
        }}
      >
        {list.type === 'image' ? (
          <OptionThumb name={o} />
        ) : (
          <span className="list-swatch" style={{ background: resolveColor(o, pal) }} />
        )}
        <span className="list-tile-name">{isTpl ? t('list.template') : o}</span>
      </button>
    )
  }
  return (
    <span className="list-choice tiles">
      {tile(fallback, 'tpl')}
      {list.options.map((o, i) => tile(o, i))}
      {outside && <span className="small warn">{t('list.notInList', { value: outside })}</span>}
    </span>
  )
}
