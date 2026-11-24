import { useEffect, useState } from 'react'
import type { ProjectZipSummary } from '../../../shared/api'
import { messageFromError, type Message } from '../../../shared/messages'
import { projectFolderName, zipBaseName } from '../../../shared/model/projectName'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'

// Importare un progetto intero da uno ZIP (scelto o trascinato sulla finestra): cosa contiene,
// dove estrarlo, poi si apre. Vedi src/main/project/projectZip.ts.

/** La cartella scelta l'ultima volta, la stessa di Nuovo progetto */
const PARENT_KEY = 'newProjectParent'

export interface OpenedProjectZip {
  file: string
  data: Uint8Array
  summary: ProjectZipSummary
}

export default function ImportProjectZipDialog({
  zip,
  onOpen,
  onClose
}: {
  zip: OpenedProjectZip
  /** Apre il progetto estratto */
  onOpen(folder: string): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const s = zip.summary
  const [parent, setParent] = useState(() => localStorage.getItem(PARENT_KEY) ?? '')
  // la cartella prende il nome del file ZIP (rinominato o no), non quello scritto dentro
  const [name, setName] = useState(() => zipBaseName(zip.file).trim() || s.folderName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Message | null>(null)

  useEffect(() => {
    if (parent) return
    window.api.defaultProjectsFolder().then(
      (f) => setParent((p) => p || f),
      () => undefined
    )
  }, [parent])

  const folderName = projectFolderName(name)
  const sep = parent.includes('\\') && !parent.includes('/') ? '\\' : '/'
  const target = folderName && parent ? parent.replace(/[\\/]+$/, '') + sep + folderName : ''

  const extract = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const folder = await window.api.extractProjectZip(zip.data, parent.trim(), name)
      localStorage.setItem(PARENT_KEY, parent.trim())
      onOpen(folder)
    } catch (e) {
      setError(messageFromError(e))
      setBusy(false)
    }
  }

  const rows: [string, string | number][] = [
    [t('projectZip.sets'), s.sets.length ? `${s.sets.length} (${s.sets.join(', ')})` : 0],
    [t('projectZip.templates'), s.templates],
    [t('projectZip.data'), s.dataFile ?? t('projectZip.noData')],
    [t('projectZip.images'), s.images],
    [t('projectZip.fonts'), s.fonts],
    [t('projectZip.documents'), s.documents],
    [t('projectZip.notes'), s.notes],
    [t('projectZip.files'), s.files]
  ]

  return (
    <Dialog title={t('projectZip.importTitle', { name: s.name })} onClose={onClose}>
      <form
        className="dialog-form project-zip"
        onSubmit={(e) => {
          e.preventDefault()
          if (target && !busy) void extract()
        }}
      >
        <p className="muted small">{t('projectZip.from', { file: zip.file })}</p>
        <table className="project-zip-summary">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <th>{label}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <label>
          {t('projectZip.folderName')}
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          {t('newProject.location')}
          <span className="field-control">
            {/* nel browser la cartella si sceglie solo con la finestra: non ha un percorso vero */}
            <input
              value={parent}
              title={parent}
              readOnly={window.api.isWeb}
              onChange={(e) => setParent(e.target.value)}
            />
            <button
              type="button"
              title={t('tip.chooseFolder')}
              onClick={async () => {
                const f = await window.api.chooseFolder(parent || undefined)
                if (f) setParent(f)
              }}
            >
              {t('export.choose')}
            </button>
          </span>
        </label>
        <p className="field-note">
          {target ? t('projectZip.target', { folder: target }) : t('projectZip.chooseFolder')}
        </p>
        {error && <p className="field-error">{t(error)}</p>}
        <div className="dialog-buttons">
          <button type="button" onClick={onClose}>
            {t('dialog.cancel')}
          </button>
          <button type="submit" className="primary" disabled={!target || busy}>
            {t('projectZip.extractOpen')}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
