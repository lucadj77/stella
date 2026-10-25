import { useState } from 'react'
import type { Sheet } from '../../../shared/project'
import { isValidSheetName, propertyColumns, templateColumns } from '../../../shared/model/sheet'
import { walkLayers } from '../../../shared/model/normalize'
import type { Template } from '../../../shared/model/template'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'

export function NewSetDialog({
  templates,
  existing,
  unusedSheets,
  usedSheets = [],
  onCreate,
  onClose
}: {
  templates: Template[]
  /** Nomi già usati da set e fogli */
  existing: string[]
  unusedSheets: string[]
  /** Fogli già usati da un set: il nuovo set ne condivide i dati */
  usedSheets?: { sheet: string; set: string }[]
  onCreate(name: string, template: string, sheet: string | null): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [template, setTemplate] = useState(templates[0]?.name ?? '')
  // foglio esistente non collegato, oppure '' per crearne uno nuovo
  const [sheet, setSheet] = useState('')
  const shared = usedSheets.some((x) => x.sheet === sheet)
  const error = !name
    ? null
    : !isValidSheetName(name)
      ? t('newSet.invalidName')
      : existing.includes(name) && (name !== sheet || shared)
        ? t('newSet.exists')
        : null
  const valid = !!name && !error && !!template
  const tpl = templates.find((x) => x.name === template)

  return (
    <Dialog title={t('newSet.title')} onClose={onClose} guide="set">
      <form
        className="dialog-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) onCreate(name, template, sheet || null)
        }}
      >
        <label>
          {t('prop.name')}
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {error && <p className="field-error">{error}</p>}
        <label>
          {t('newSet.template')}
          <select value={template} onChange={(e) => setTemplate(e.target.value)}>
            {templates.map((x) => (
              <option key={x.name} value={x.name}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        {!templates.length && <p className="field-error">{t('newSet.noTemplates')}</p>}
        {(unusedSheets.length > 0 || usedSheets.length > 0) && (
          <label>
            {t('newSet.sheet')}
            <select
              value={sheet}
              onChange={(e) => {
                setSheet(e.target.value)
                const used = usedSheets.some((x) => x.sheet === e.target.value)
                if (e.target.value && !name && !used) setName(e.target.value)
              }}
            >
              <option value="">{t('newSet.newSheet')}</option>
              {unusedSheets.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
              {usedSheets.length > 0 && (
                <optgroup label={t('newSet.sharedGroup')}>
                  {usedSheets.map((x) => (
                    <option key={x.sheet} value={x.sheet}>
                      {t('newSet.sharedOption', { sheet: x.sheet, set: x.set })}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
        )}
        {shared && <p className="muted small">{t('newSet.sharedNote')}</p>}
        {!sheet && tpl && (
          <p className="muted small">
            {t('newSet.columns', { columns: templateColumns(tpl).join(', ') })}
          </p>
        )}
        <div className="dialog-buttons">
          <button type="button" onClick={onClose}>
            {t('dialog.cancel')}
          </button>
          <button type="submit" className="primary" disabled={!valid}>
            {t('newSet.create')}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

/** Aggiunge una colonna: quelle che il template legge e mancano, le proprietà dei livelli, o libera */
export function AddColumnDialog({
  sheet,
  template,
  onAdd,
  onClose
}: {
  sheet: Sheet
  template: Template | null
  onAdd(header: string): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [layer, setLayer] = useState('')
  const missing = template
    ? templateColumns(template).filter((c) => !sheet.headers.includes(c))
    : []
  const layers = template
    ? walkLayers([...template.front, ...template.back]).map((l) => l.name)
    : []
  const propCols = layer
    ? propertyColumns(template!, layer).filter((c) => !sheet.headers.includes(c))
    : []
  const clean = name.trim()
  const error =
    clean && sheet.headers.includes(clean)
      ? t('addColumn.exists')
      : clean && /[{}]/.test(clean)
        ? t('addColumn.invalid')
        : null

  return (
    <Dialog title={t('addColumn.title')} onClose={onClose}>
      <div className="dialog-form">
        {missing.length > 0 && (
          <>
            <p className="muted small">{t('addColumn.missing')}</p>
            <div className="chips">
              {missing.map((c) => (
                <button
                  key={c}
                  onClick={() => onAdd(c)}
                  title={t('tip.addThisColumn', { column: c })}
                >
                  {c}
                </button>
              ))}
            </div>
          </>
        )}
        {layers.length > 0 && (
          <>
            <label>
              {t('addColumn.property')}
              <select value={layer} onChange={(e) => setLayer(e.target.value)}>
                <option value="">{t('addColumn.chooseLayer')}</option>
                {layers.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            {propCols.length > 0 && (
              <div className="chips">
                {propCols.map((c) => (
                  <button
                    key={c}
                    onClick={() => onAdd(c)}
                    title={t('tip.addThisColumn', { column: c })}
                  >
                    {c.slice(c.indexOf('.') + 1)}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        <form
          className="dialog-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (clean && !error) onAdd(clean)
          }}
        >
          <label>
            {t('addColumn.custom')}
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          {error && <p className="field-error">{error}</p>}
          <div className="dialog-buttons">
            <button type="button" onClick={onClose}>
              {t('dialog.cancel')}
            </button>
            <button type="submit" className="primary" disabled={!clean || !!error}>
              {t('addColumn.add')}
            </button>
          </div>
        </form>
      </div>
    </Dialog>
  )
}

/** Chiede il nome della copia di un set o di un template */
export function DuplicateDialog({
  title,
  initial,
  validate,
  onDuplicate,
  onClose,
  okLabel
}: {
  title: string
  /** Testo del pulsante di conferma; di base "Duplica" */
  okLabel?: string
  initial: string
  /** Messaggio di errore, oppure null se il nome va bene */
  validate(name: string): string | null
  onDuplicate(name: string): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const [name, setName] = useState(initial)
  const error = validate(name)
  return (
    <Dialog title={title} onClose={onClose}>
      <form
        className="dialog-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!error) onDuplicate(name)
        }}
      >
        <label>
          {t('prop.name')}
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {error && <p className="field-error">{error}</p>}
        <div className="dialog-buttons">
          <button type="button" onClick={onClose}>
            {t('dialog.cancel')}
          </button>
          <button type="submit" className="primary" disabled={!!error}>
            {okLabel ?? t('duplicate.ok')}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
