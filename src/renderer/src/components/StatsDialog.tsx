import { useContext, useMemo, useState } from 'react'
import type { Sheet } from '../../../shared/project'
import type { ColumnInfo } from '../../../shared/model/sheet'
import { columnStats, columnValues, rowAmounts } from '../../../shared/model/stats'
import type { Template } from '../../../shared/model/template'
import type { Variables } from '../../../shared/model/variables'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import { NumberSettingsContext } from '../render/assets'
import { numberFormatting } from '../../../shared/model/numberFormat'

const fmt = (n: number): string =>
  Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, '')

/** Statistiche di una colonna del set: quante carte per valore, e somma e media dei numeri */
export default function StatsDialog({
  sheet,
  rows,
  columns,
  template,
  templates,
  variables,
  filtered,
  onClose
}: {
  sheet: Sheet
  /** Righe della vista: con un filtro attivo solo quelle filtrate */
  rows: number[]
  columns: ColumnInfo[]
  template: Template | null
  templates: Template[]
  variables?: Variables
  filtered: boolean
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const names = columns.map((c) => c.header).filter((h) => h && h !== 'amount' && !h.includes('.'))
  const [column, setColumn] = useState(names[0] ?? '')
  const hasAmount = sheet.headers.includes('amount')
  const [copies, setCopies] = useState(true)
  const settings = useContext(NumberSettingsContext)
  const stats = useMemo(() => {
    const numbers = numberFormatting(settings)
    const values = columnValues(sheet, column, rows, template, templates, variables, numbers)
    const amounts = hasAmount && copies ? rowAmounts(sheet, rows) : rows.map(() => 1)
    return columnStats(column, values, amounts)
  }, [sheet, column, rows, template, templates, variables, hasAmount, copies, settings])
  const top = Math.max(1, ...stats.groups.map((g) => g.cards))

  return (
    <Dialog title={t('stats.title')} onClose={onClose}>
      <div className="dialog-form stats-dialog">
        <label>
          {t('stats.column')}
          <select autoFocus value={column} onChange={(e) => setColumn(e.target.value)}>
            {names.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        {hasAmount && (
          <label className="stats-check">
            <input type="checkbox" checked={copies} onChange={(e) => setCopies(e.target.checked)} />
            {t('stats.copies')}
          </label>
        )}
        <p className="muted small">
          {t(filtered ? 'stats.summaryFiltered' : 'stats.summary', {
            rows: stats.rows,
            cards: stats.cards,
            values: stats.groups.length
          })}
        </p>
        {stats.numeric && (
          <p className="stats-numbers">
            {t('stats.numbers', {
              sum: fmt(stats.numeric.sum),
              mean: fmt(stats.numeric.mean),
              min: fmt(stats.numeric.min),
              max: fmt(stats.numeric.max)
            })}
          </p>
        )}
        <div className="stats-table-wrap">
          <table className="stats-table">
            <thead>
              <tr>
                <th>{t('stats.value')}</th>
                <th>{t('stats.cards')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {stats.groups.map((g) => (
                <tr key={g.value}>
                  <td>
                    {g.value === '' ? <em className="muted">{t('stats.empty')}</em> : g.value}
                  </td>
                  <td className="num" title={t('stats.rowsHint', { n: g.rows })}>
                    {g.cards}
                  </td>
                  <td className="bar">
                    <span style={{ width: `${(g.cards / top) * 100}%` }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="dialog-buttons">
          <button className="primary" onClick={onClose}>
            {t('dialog.close')}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
