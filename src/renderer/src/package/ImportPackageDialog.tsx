import { useState } from 'react'
import type { ConflictChoice, PackageConflict } from '../../../shared/model/package'
import { isImageAsset } from '../../../shared/model/assets'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import type { OpenedPackage } from './packageZip'

// Cosa contiene un pacchetto e, per quello che c'è già nel progetto, cosa farne: rinominare,
// sostituire o tenere quello del progetto. Le scelte proposte non perdono niente.

const key = (c: PackageConflict): string => `${c.kind}:${c.name}`

export default function ImportPackageDialog({
  opened,
  onImport,
  onClose
}: {
  opened: OpenedPackage
  onImport(choices: Record<string, ConflictChoice>): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const m = opened.manifest
  const [choices, setChoices] = useState<Record<string, ConflictChoice>>(() =>
    Object.fromEntries(opened.conflicts.map((c) => [key(c), c.choices[0]]))
  )
  const images = m.assets.filter(isImageAsset).length
  const fonts = m.assets.length - images
  const summary: [string, string][] = [
    [t('package.templates'), m.templates.map((x) => x.name).join(', ')],
    [
      t('package.sets'),
      m.sets.map((s) => `${s.definition.name} (${s.sheet.rows.length})`).join(', ')
    ],
    [t('package.files'), t('package.filesCount', { images, fonts })],
    [t('package.variables'), Object.keys(m.variables).join(', ')],
    [t('package.styles'), Object.keys(m.styles).join(', ')]
  ]
  const setAll = (c: ConflictChoice): void =>
    setChoices(
      Object.fromEntries(
        opened.conflicts.map((x) => [key(x), x.choices.includes(c) ? c : choices[key(x)]])
      )
    )

  return (
    <Dialog title={t('package.importTitle', { name: m.name || opened.file })} onClose={onClose}>
      <div className="dialog-form package-dialog">
        <dl className="package-summary">
          {summary
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
        </dl>
        {opened.conflicts.length === 0 ? (
          <p className="muted small">{t('package.noConflicts')}</p>
        ) : (
          <>
            <p>{t('package.conflictsHint', { n: opened.conflicts.length })}</p>
            {opened.conflicts.length > 1 && (
              <div className="package-all">
                <span className="muted small">{t('package.forAll')}</span>
                {(['rename', 'replace', 'keep'] as const).map((c) => (
                  <button key={c} type="button" className="small-btn" onClick={() => setAll(c)}>
                    {t(`package.choice.${c}`)}
                  </button>
                ))}
              </div>
            )}
            <ul className="package-conflicts">
              {opened.conflicts.map((c) => (
                <li key={key(c)}>
                  <span className="trash-kind">{t(`package.kind.${c.kind}`)}</span>
                  <span className="package-name">
                    <strong>{c.name}</strong>
                    {c.existing && c.existing !== c.name && (
                      <span className="muted small">
                        {t('package.existing', { file: `assets/${c.existing}` })}
                      </span>
                    )}
                  </span>
                  <select
                    value={choices[key(c)]}
                    onChange={(e) =>
                      setChoices((x) => ({ ...x, [key(c)]: e.target.value as ConflictChoice }))
                    }
                  >
                    {c.choices.map((ch) => (
                      <option key={ch} value={ch}>
                        {t(`package.choice.${ch}`)}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            <p className="muted small">{t('package.choicesHint')}</p>
          </>
        )}
        <p className="muted small">{t('package.backupHint')}</p>
        <div className="dialog-buttons">
          <button type="button" onClick={onClose}>
            {t('dialog.cancel')}
          </button>
          <button className="primary" onClick={() => onImport(choices)}>
            {t('package.import')}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
