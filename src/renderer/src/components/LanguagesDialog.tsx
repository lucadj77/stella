import { useState } from 'react'
import {
  isLanguageCode,
  missingTranslationColumns,
  missingTranslations
} from '../../../shared/model/language'
import {
  languageStyle,
  numberExample,
  NUMBER_STYLES,
  type NumberStyle
} from '../../../shared/model/numberFormat'
import { textColumns } from '../../../shared/model/sheet'
import type { LoadedProject } from '../../../shared/project'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import { languageName } from '../i18n/languageName'

/** Lingue proposte quando se ne aggiunge una; si può scrivere qualunque codice */
const COMMON = ['it', 'en', 'fr', 'de', 'es', 'pt', 'nl', 'pl', 'cs', 'ru', 'ja', 'zh', 'ko']

export interface LanguagesChange {
  languages: string[]
  /** Nome del progetto per lingua */
  names: Record<string, string>
  /** Nomi dei set per lingua, per indice del set */
  setNames: Record<string, string>[]
  /** Colonne `campo@lingua` da aggiungere, per indice del set */
  columns: string[][]
  /** Come si scrivono i numeri nella lingua principale */
  numberFormat: NumberStyle
  /** Come si scrivono i numeri nelle altre lingue, solo dove non è quello abituale della lingua */
  numberFormats: Record<string, NumberStyle>
}

/**
 * Lingue del progetto: la prima è la principale, quella delle colonne senza @. Per le altre si
 * scrivono i nomi tradotti di progetto e set, e si aggiungono ai fogli le colonne da tradurre.
 */
export default function LanguagesDialog({
  project,
  onSave,
  onClose
}: {
  project: LoadedProject
  onSave(change: LanguagesChange): void
  onClose(): void
}): React.JSX.Element {
  const { t, lang: ui } = useI18n()
  const [languages, setLanguages] = useState<string[]>(() => {
    const l = project.file.languages ?? []
    return l.length ? l : [ui]
  })
  const [names, setNames] = useState<Record<string, string>>(project.file.names ?? {})
  const [setTitles, setSetTitles] = useState<Record<string, string>[]>(() =>
    project.sets.map((s) => s.names ?? {})
  )
  const [mainNumbers, setMainNumbers] = useState<NumberStyle>(project.file.numberFormat ?? 'plain')
  const [numbers, setNumbers] = useState<Record<string, NumberStyle>>(
    project.file.numberFormats ?? {}
  )
  const [code, setCode] = useState('')
  const [addColumns, setAddColumns] = useState(true)
  const others = languages.slice(1)
  const clean = code.trim()
  const codeError =
    clean && !isLanguageCode(clean)
      ? t('languages.invalid')
      : languages.includes(clean)
        ? t('languages.exists')
        : null

  const columns = project.sets.map((s) => {
    const tpl = project.templates.find((x) => x.name === s.template)
    if (!tpl || !s.data) return []
    const text = textColumns(tpl)
    return others.flatMap((l) => missingTranslationColumns(s.data!, l, text))
  })
  // due set possono leggere lo stesso foglio: le colonne si contano una volta sola
  const sheets = new Map<string, number>()
  project.sets.forEach((s, i) => {
    const key = s.sheet ?? s.name
    sheets.set(key, Math.max(sheets.get(key) ?? 0, columns[i].length))
  })
  const missing = [...sheets.values()].reduce((a, b) => a + b, 0)
  // testi ancora da tradurre (livelli fissi, variabili, celle @lingua vuote), come in stella check
  const untranslated = (l: string): number =>
    missingTranslations(
      { templates: project.templates, variables: project.file.variables, sets: project.sets },
      l
    ).length

  const add = (): void => {
    if (!clean || codeError) return
    setLanguages((l) => [...l, clean])
    setCode('')
  }
  const remove = (l: string): void => setLanguages((ls) => ls.filter((x) => x !== l))
  const save = (): void => {
    // i nomi delle lingue tolte non restano nel file
    const keep = (r: Record<string, string>): Record<string, string> =>
      Object.fromEntries(Object.entries(r).filter(([k, v]) => others.includes(k) && v.trim()))
    onSave({
      languages: others.length ? languages : [],
      names: keep(names),
      setNames: setTitles.map(keep),
      columns: addColumns ? columns : project.sets.map(() => []),
      numberFormat: mainNumbers,
      // lo stile abituale della lingua non serve scriverlo
      numberFormats: Object.fromEntries(
        Object.entries(numbers).filter(([l, s]) => others.includes(l) && s !== languageStyle(l))
      )
    })
  }

  return (
    <Dialog title={t('languages.title')} onClose={onClose}>
      <div className="dialog-form languages-dialog">
        <p className="muted small">{t('languages.hint')}</p>
        <ul className="language-list">
          {languages.map((l, i) => (
            <li key={l}>
              <span>{languageName(l, ui)}</span>
              <select
                className="language-numbers"
                value={i === 0 ? mainNumbers : (numbers[l] ?? languageStyle(l))}
                title={t('languages.numbersHint')}
                aria-label={t('languages.numbers')}
                onChange={(e) => {
                  const s = e.target.value as NumberStyle
                  if (i === 0) setMainNumbers(s)
                  else setNumbers((n) => ({ ...n, [l]: s }))
                }}
              >
                {NUMBER_STYLES.map((s) => (
                  <option key={s} value={s}>
                    {t('languages.numbersExample', { example: numberExample(s) })}
                  </option>
                ))}
              </select>
              {i === 0 ? (
                <span className="muted small">{t('languages.main')}</span>
              ) : (
                <>
                  {untranslated(l) > 0 && (
                    <span className="muted small" title={t('languages.untranslatedHint')}>
                      {t('languages.untranslated', { n: untranslated(l) })}
                    </span>
                  )}
                  <button
                    className="danger"
                    onClick={() => remove(l)}
                    title={t('languages.removeHint')}
                  >
                    {t('languages.remove')}
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        <form
          className="language-add"
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
        >
          <input
            list="language-codes"
            value={code}
            placeholder={t('languages.codePlaceholder')}
            onChange={(e) => setCode(e.target.value)}
            aria-label={t('languages.add')}
          />
          <datalist id="language-codes">
            {COMMON.filter((c) => !languages.includes(c)).map((c) => (
              <option key={c} value={c}>
                {languageName(c, ui)}
              </option>
            ))}
          </datalist>
          <button type="submit" disabled={!clean || !!codeError}>
            {t('languages.add')}
          </button>
        </form>
        {codeError && <p className="field-error">{codeError}</p>}

        {others.length > 0 && (
          <>
            <h3>{t('languages.names')}</h3>
            <p className="muted small">{t('languages.namesHint')}</p>
            <table className="language-names">
              <thead>
                <tr>
                  <th />
                  {others.map((l) => (
                    <th key={l}>{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>{project.file.name}</th>
                  {others.map((l) => (
                    <td key={l}>
                      <input
                        value={names[l] ?? ''}
                        placeholder={project.file.name}
                        onChange={(e) => setNames((n) => ({ ...n, [l]: e.target.value }))}
                      />
                    </td>
                  ))}
                </tr>
                {project.sets.map((s, i) => (
                  <tr key={s.name}>
                    <th>{s.name}</th>
                    {others.map((l) => (
                      <td key={l}>
                        <input
                          value={setTitles[i]?.[l] ?? ''}
                          placeholder={s.name}
                          onChange={(e) =>
                            setSetTitles((all) =>
                              all.map((r, k) => (k === i ? { ...r, [l]: e.target.value } : r))
                            )
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {missing > 0 && (
              <label className="language-check">
                <input
                  type="checkbox"
                  checked={addColumns}
                  onChange={(e) => setAddColumns(e.target.checked)}
                />
                {t('languages.addColumns', { n: missing })}
              </label>
            )}
            <p className="muted small">{t('languages.columnsHint')}</p>
          </>
        )}
        <div className="dialog-buttons">
          <button onClick={onClose}>{t('dialog.cancel')}</button>
          <button className="primary" onClick={save}>
            {t('languages.save')}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
