import { useEffect, useState } from 'react'
import { confirmKey } from './confirm'
import type { BackupSettings, BackupState } from '../../../shared/api'
import { messageFromError, type Message } from '../../../shared/messages'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'

// Backup del progetto aperto: elenco, backup a mano, ripristino e impostazioni.
// Vedi docs/specifica.md, sezione 12.

function size(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} kB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function BackupDialog({
  dirty,
  onSave,
  onRestored,
  onClose
}: {
  /** Ci sono modifiche non salvate */
  dirty: boolean
  onSave(): Promise<void>
  /** Il backup è stato estratto in questa cartella: si apre al posto del progetto */
  onRestored(folder: string): void
  onClose(): void
}): React.JSX.Element {
  const { t, lang } = useI18n()
  const [state, setState] = useState<BackupState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Message | null>(null)
  /** Nome del prossimo backup fatto a mano */
  const [label, setLabel] = useState('')
  /** Backup di cui si sta cambiando il nome, e il nome scritto */
  const [editing, setEditing] = useState<{ file: string; label: string } | null>(null)

  useEffect(() => {
    window.api.backups().then(setState, (e) => setError(messageFromError(e)))
  }, [])

  const run = async (job: () => Promise<void>): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await job()
    } catch (e) {
      setError(messageFromError(e))
    } finally {
      setBusy(false)
    }
  }

  const create = (): Promise<void> =>
    run(async () => {
      if (dirty) await onSave()
      await window.api.createBackup(label.trim() || undefined)
      setLabel('')
      setState(await window.api.backups())
    })

  const rename = (): void => {
    if (!editing) return
    const { file, label: next } = editing
    setEditing(null)
    run(async () => {
      await window.api.labelBackup(file, next)
      setState(await window.api.backups())
    })
  }

  const saveSettings = (patch: Partial<BackupSettings>): void => {
    if (!state) return
    run(async () => setState(await window.api.saveBackupSettings({ ...state.settings, ...patch })))
  }

  const restore = async (file: string): Promise<void> => {
    // nel web la cartella si sceglie prima di tutto: il browser apre la finestra solo subito
    // dopo il clic
    let parent: string | undefined
    if (window.api.isWeb) {
      parent = (await window.api.chooseFolder()) ?? undefined
      if (!parent) return
    }
    if (!(await confirmKey(t, window.api.isWeb ? 'web.restoreConfirm' : 'backup.restoreConfirm')))
      return
    run(async () => onRestored(await window.api.restoreBackup(file, parent)))
  }

  return (
    <Dialog title={t('backup.title')} onClose={onClose}>
      <div className="backup-dialog">
        <p className="backup-intro">{t('backup.intro')}</p>
        {error && <div className="banner error">{t(error)}</div>}
        <div className="backup-actions">
          <input
            className="backup-label-input"
            value={label}
            placeholder={t('backup.labelPlaceholder')}
            aria-label={t('backup.label')}
            maxLength={80}
            disabled={busy || !state}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !busy && state) create()
            }}
          />
          <button className="primary" disabled={busy || !state} onClick={create}>
            {dirty ? t('backup.saveAndCreate') : t('backup.create')}
          </button>
          {state && !window.api.isWeb && (
            <button
              onClick={() => window.api.showFolder(state.folder)}
              disabled={!state.items.length}
            >
              {t('backup.showFolder')}
            </button>
          )}
          {busy && <span className="muted">{t('backup.working')}</span>}
        </div>
        {state && (
          <>
            {state.items.length ? (
              <table className="backup-list">
                <tbody>
                  {state.items.map((b) => (
                    <tr key={b.file}>
                      <td>{new Date(b.date).toLocaleString(lang)}</td>
                      <td className="muted">{b.auto ? t('backup.auto') : t('backup.manual')}</td>
                      <td className="backup-label">
                        {editing?.file === b.file ? (
                          <input
                            autoFocus
                            value={editing.label}
                            maxLength={80}
                            aria-label={t('backup.label')}
                            onChange={(e) => setEditing({ file: b.file, label: e.target.value })}
                            onBlur={rename}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') rename()
                              if (e.key === 'Escape') {
                                e.stopPropagation()
                                setEditing(null)
                              }
                            }}
                          />
                        ) : (
                          <button
                            className="link"
                            disabled={busy}
                            title={t('backup.rename')}
                            onClick={() => setEditing({ file: b.file, label: b.label ?? '' })}
                          >
                            {b.label || <span className="muted">{t('backup.addLabel')}</span>}
                          </button>
                        )}
                      </td>
                      <td>
                        <button disabled={busy} onClick={() => restore(b.file)}>
                          {t('backup.restore')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            {state.items.length ? (
              <p className="muted small">{t('backup.total', { size: size(state.totalSize) })}</p>
            ) : (
              <p className="muted">{t('backup.none')}</p>
            )}
            <fieldset className="backup-settings">
              <legend>{t('backup.settings')}</legend>
              <label className="check">
                <input
                  type="checkbox"
                  checked={state.settings.auto}
                  disabled={busy}
                  onChange={(e) => saveSettings({ auto: e.target.checked })}
                />
                {t('backup.autoOnOpen')}
              </label>
              <label>
                {t('backup.keep')}
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={state.settings.keep}
                  disabled={busy || !state.settings.auto}
                  onChange={(e) => {
                    const keep = Math.round(Number(e.target.value))
                    if (keep >= 1) saveSettings({ keep })
                  }}
                />
              </label>
              <div className="backup-folder">
                <span>{t('backup.folder')}</span>
                {/* nel web la cartella di base è lo spazio del sito nel browser, senza percorso */}
                {state.settings.folder || state.defaultFolder ? (
                  <code>{state.settings.folder || state.defaultFolder}</code>
                ) : (
                  <span className="muted">{t('web.backupInSite')}</span>
                )}
                <button
                  disabled={busy}
                  onClick={async () => {
                    const folder = await window.api.chooseFolder(
                      state.settings.folder || state.defaultFolder
                    )
                    if (folder) saveSettings({ folder })
                  }}
                >
                  {t('backup.chooseFolder')}
                </button>
                {state.settings.folder && (
                  <button disabled={busy} onClick={() => saveSettings({ folder: '' })}>
                    {t('backup.defaultFolder')}
                  </button>
                )}
              </div>
              {window.api.isWeb && !state.settings.folder && (
                <p className="muted small">{t('web.backupInSiteHint')}</p>
              )}
            </fieldset>
          </>
        )}
        <div className="dialog-buttons">
          <span className="spacer" />
          <button onClick={onClose}>{t('dialog.close')}</button>
        </div>
      </div>
    </Dialog>
  )
}
