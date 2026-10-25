import { Fragment, useContext, useMemo, useState } from 'react'
import { confirmKey } from './confirm'
import type { Sheet } from '../../../shared/project'
import { assetRefName, isImageAsset } from '../../../shared/model/assets'
import {
  addGenerated,
  countChoices,
  emptyColumn,
  generateCards,
  MAX_GENERATED,
  parseValues,
  type GenerateMode,
  type GeneratorColumn
} from '../../../shared/model/generate'
import { walkLayers } from '../../../shared/model/normalize'
import { templateColumns } from '../../../shared/model/sheet'
import type { Template } from '../../../shared/model/template'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import { AssetsContext } from '../render/assets'
import MarkupText from '../render/MarkupText'
import Segmented from './Segmented'
import FormulaDialog from './FormulaDialog'

// Generatore di carte: insiemi di valori → tutte le combinazioni come righe del set.
// Vedi docs/specifica.md, sezione 8.3.

const PREVIEW_ROWS = 8

/** Nella finestra i valori si scrivono come testo; nel modello sono un elenco */
interface Draft extends GeneratorColumn {
  text: string
}

export default function GenerateDialog({
  sheet,
  template,
  onApply,
  onClose
}: {
  sheet: Sheet
  template: Template | null
  onApply(sheet: Sheet): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const assets = useContext(AssetsContext)
  const columns = useMemo(
    () =>
      [
        ...new Set([
          ...(template ? templateColumns(template) : []),
          ...sheet.headers.filter((h) => h && !h.includes('.'))
        ])
      ].filter((c) => c !== 'amount'),
    [template, sheet.headers]
  )
  /** Colonne dei livelli immagine: vi si scrive il nome dell'immagine, non {icona} */
  const imageColumns = useMemo(
    () =>
      new Set(
        template
          ? walkLayers([...template.front, ...template.back])
              .filter((l) => l.type === 'image' && l.source.kind === 'column')
              .map((l) => (l.source.kind === 'column' && l.source.column) || l.name)
          : []
      ),
    [template]
  )
  const folders = useMemo(
    () =>
      [
        ...new Set(
          assets
            .filter(isImageAsset)
            .map((a) => (a.includes('/') ? a.slice(0, a.lastIndexOf('/')) : ''))
        )
      ].sort(),
    [assets]
  )

  const draft = (column = ''): Draft => ({
    ...emptyColumn(column),
    icons: !imageColumns.has(column),
    text: ''
  })
  const [list, setList] = useState<Draft[]>(() => [draft(columns[0] ?? '')])
  const [filter, setFilter] = useState('')
  const [copies, setCopies] = useState(1)
  const [assistant, setAssistant] = useState(false)
  const [mode, setMode] = useState<GenerateMode>(sheet.rows.length ? 'append' : 'replace')

  const update = (i: number, patch: Partial<Draft>): void =>
    setList((l) =>
      l.map((c, j) => {
        if (j !== i) return c
        const next = { ...c, ...patch }
        if (patch.text !== undefined) next.values = parseValues(patch.text)
        // cambiando colonna si sceglie di nuovo se i valori sono icone nel testo
        if (patch.column !== undefined && patch.icons === undefined)
          next.icons = !imageColumns.has(patch.column.trim())
        return next
      })
    )

  const fromFolder = (i: number, folder: string): void => {
    const names = assets
      .filter((a) => isImageAsset(a) && a.slice(0, Math.max(0, a.lastIndexOf('/'))) === folder)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((a) => assetRefName(a, assets))
    update(i, { text: names.join('\n') })
  }

  const result = useMemo(
    () => generateCards({ columns: list, filter, copies }),
    [list, filter, copies]
  )
  const active = list.filter((c) => c.column.trim() && c.values.length)
  /** Una colonna dell'anteprima mostra le icone se uno degli insiemi che la riempiono le usa */
  const iconColumn = (h: string): boolean => active.some((c) => c.column.trim() === h && c.icons)
  const shown = result.rows.slice(0, PREVIEW_ROWS)
  // aggiornando, le carte generate vanno nelle righe presenti; quelle in più si accodano
  const updated = mode === 'update' ? Math.min(sheet.rows.length, result.rows.length) : 0
  const added = result.rows.length - updated
  const cols = result.headers.length - 1

  return (
    <Dialog title={t('generate.title')} onClose={onClose} guide="generate">
      <div className="generate-dialog">
        <p className="field-note">{t('generate.intro')}</p>
        <datalist id="generate-columns">
          {columns.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        {list.map((c, i) => {
          const n = countChoices(c.values.length, c.pick, c.repeat, c.ordered, c.values, c.limits)
          return (
            <fieldset key={i} className="generate-set">
              <div className="generate-row">
                <label>
                  {t('generate.column')}
                  <input
                    list="generate-columns"
                    value={c.column}
                    onChange={(e) => update(i, { column: e.target.value })}
                  />
                </label>
                <label>
                  {t('generate.pick')}
                  <input
                    type="number"
                    className="num narrow"
                    min={1}
                    max={10}
                    value={c.pick}
                    onChange={(e) =>
                      update(i, { pick: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })
                    }
                  />
                </label>
                {list.length > 1 && (
                  <button
                    className="icon-btn danger"
                    title={t('generate.removeSet')}
                    onClick={() => setList((l) => l.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                )}
              </div>
              <label className="generate-values">
                {t('generate.values')}
                <textarea
                  rows={3}
                  value={c.text}
                  placeholder={t('generate.valuesHint')}
                  onChange={(e) => update(i, { text: e.target.value })}
                />
              </label>
              <div className="generate-row">
                {folders.length > 0 && (
                  <select
                    value=""
                    title={t('generate.fromFolderHint')}
                    onChange={(e) =>
                      e.target.value !== '' && fromFolder(i, e.target.value.slice(1))
                    }
                  >
                    <option value="">{t('generate.fromFolder')}</option>
                    {folders.map((f) => (
                      <option key={f} value={`/${f}`}>
                        {f || 'assets'}
                      </option>
                    ))}
                  </select>
                )}
                <label className="check">
                  <input
                    type="checkbox"
                    checked={c.icons}
                    onChange={(e) => update(i, { icons: e.target.checked })}
                  />
                  {t('generate.icons')}
                </label>
                {c.pick > 1 && (
                  <>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={c.repeat}
                        onChange={(e) => update(i, { repeat: e.target.checked })}
                      />
                      {t('generate.repeat')}
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={c.ordered}
                        onChange={(e) => update(i, { ordered: e.target.checked })}
                      />
                      {t('generate.ordered')}
                    </label>
                    <label>
                      {t('generate.separator')}
                      <input
                        className="narrow"
                        value={c.separator}
                        onChange={(e) => update(i, { separator: e.target.value })}
                      />
                    </label>
                  </>
                )}
                <span className="muted small spacer-left">
                  {c.values.length
                    ? t('generate.setCount', { values: c.values.length, n })
                    : t('generate.noValues')}
                </span>
              </div>
              {c.pick > 1 && c.values.length > 0 && (
                <details className="generate-limits">
                  <summary>{t('generate.limits')}</summary>
                  <p className="muted small">{t('generate.limitsHint')}</p>
                  <div className="generate-limit-grid">
                    <span />
                    <span className="muted small">{t('generate.min')}</span>
                    <span className="muted small">{t('generate.max')}</span>
                    {c.values.map((v) => {
                      const lim = c.limits?.[v] ?? {}
                      const setLim = (key: 'min' | 'max', raw: string): void => {
                        const next = { ...lim }
                        if (raw.trim() === '') delete next[key]
                        else next[key] = Math.max(0, Math.round(Number(raw)) || 0)
                        update(i, { limits: { ...c.limits, [v]: next } })
                      }
                      return (
                        <Fragment key={v}>
                          <span className="generate-limit-value">
                            {c.icons ? (
                              <MarkupText
                                text={`{${v}} ${v}`}
                                unit={3}
                                ratio={1}
                                paragraphSpacing={0}
                              />
                            ) : (
                              v
                            )}
                          </span>
                          <input
                            type="number"
                            className="num narrow"
                            min={0}
                            max={c.pick}
                            placeholder="0"
                            value={lim.min ?? ''}
                            onChange={(e) => setLim('min', e.target.value)}
                          />
                          <input
                            type="number"
                            className="num narrow"
                            min={0}
                            max={c.pick}
                            placeholder={String(c.repeat ? c.pick : 1)}
                            value={lim.max ?? ''}
                            onChange={(e) => setLim('max', e.target.value)}
                          />
                        </Fragment>
                      )
                    })}
                  </div>
                </details>
              )}
            </fieldset>
          )
        })}
        <div className="generate-row">
          <button onClick={() => setList((l) => [...l, draft('')])}>{t('generate.addSet')}</button>
        </div>
        <div className="generate-row">
          <label className="grow">
            {t('generate.filter')}
            <span className="generate-filter">
              <input
                value={filter}
                placeholder={t('generate.filterHint')}
                onChange={(e) => setFilter(e.target.value)}
              />
              <button
                type="button"
                className="pick-btn fx-button"
                title={t('fx.open')}
                onClick={() => setAssistant(true)}
              >
                fx
              </button>
            </span>
          </label>
          <label>
            {t('generate.copies')}
            <input
              type="number"
              className="num narrow"
              min={1}
              value={copies}
              onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
        </div>
        {result.filterError && (
          <p className="field-error">{t('generate.filterError', { error: result.filterError })}</p>
        )}
        <div className="generate-preview">
          <p className="small">
            <b>
              {result.rows.length === 1
                ? t('generate.oneCard')
                : t('generate.cards', { n: result.rows.length })}
            </b>
            {result.total !== result.rows.length &&
              ' ' + t('generate.ofTotal', { n: result.total })}
          </p>
          {result.truncated && (
            <p className="field-warning">{t('generate.truncated', { n: MAX_GENERATED })}</p>
          )}
          {shown.length > 0 && (
            <table>
              <thead>
                <tr>
                  {result.headers.slice(0, cols).map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r, i) => (
                  <tr key={i}>
                    {r.slice(0, cols).map((v, j) => (
                      <td key={j} title={v}>
                        {iconColumn(result.headers[j]) ? (
                          <MarkupText text={v} unit={3} ratio={1} paragraphSpacing={0} />
                        ) : (
                          v
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {result.rows.length > PREVIEW_ROWS && (
            <p className="muted small">
              {t('generate.more', { n: result.rows.length - PREVIEW_ROWS })}
            </p>
          )}
        </div>
        {mode === 'update' && result.rows.length > 0 && (
          <p className="field-note">
            {t('generate.updateNote', {
              columns: result.headers.slice(0, cols).join(', '),
              n: updated,
              rows: sheet.rows.length
            })}
            {added > 0 && ' ' + t('generate.updateExtra', { n: added })}
          </p>
        )}
        <div className="dialog-buttons">
          <Segmented<GenerateMode>
            value={mode}
            options={[
              ['append', t('generate.append'), t('generate.appendHint')],
              ...(sheet.rows.length
                ? [
                    ['update', t('generate.update'), t('generate.updateHint')] as [
                      GenerateMode,
                      string,
                      string
                    ]
                  ]
                : []),
              ['replace', t('generate.replace'), t('generate.replaceHint')]
            ]}
            onChange={setMode}
          />
          <span className="spacer" />
          <button onClick={onClose}>{t('dialog.cancel')}</button>
          <button
            className="primary"
            disabled={!result.rows.length}
            onClick={async () => {
              if (
                mode === 'replace' &&
                sheet.rows.length &&
                !(await confirmKey(
                  t,
                  'generate.replaceConfirm',
                  { n: sheet.rows.length },
                  { danger: true }
                ))
              )
                return
              onApply(addGenerated(sheet, result, mode))
            }}
          >
            {mode === 'update'
              ? t('generate.updateButton', { n: updated })
              : t('generate.create', { n: result.rows.length })}
          </button>
        </div>
      </div>
      {assistant && (
        <FilterAssistant
          filter={filter}
          list={list}
          onApply={setFilter}
          onClose={() => setAssistant(false)}
        />
      )}
    </Dialog>
  )
}

/** Assistente formule sul filtro: la condizione si calcola sulla prima carta senza filtro */
function FilterAssistant({
  filter,
  list,
  onApply,
  onClose
}: {
  filter: string
  list: GeneratorColumn[]
  onApply(filter: string): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const first = useMemo(() => generateCards({ columns: list, filter: '', copies: 1 }), [list])
  const sample: Record<string, string> = {}
  first.headers.forEach((h, i) => h !== 'amount' && (sample[h] = first.rows[0]?.[i] ?? ''))
  const f = filter.trim()
  return (
    <FormulaDialog
      title={t('fx.filterTitle')}
      value={f && !f.startsWith('=') ? '=' + f : f}
      expect="bool"
      condition
      columns={first.headers.filter((h) => h !== 'amount')}
      layers={[]}
      sample={sample}
      sampleLabel={first.rows.length ? t('fx.firstGenerated') : undefined}
      onApply={(expr) => onApply(expr.trim().replace(/^=/, ''))}
      onClose={onClose}
    />
  )
}
