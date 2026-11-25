import { useEffect, useState } from 'react'
import type { ProjectRescue } from '../../../shared/api'
import { messageFromError, type Message } from '../../../shared/messages'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import { confirmKey } from './confirm'
import { parentOf, restoreBackupFromFile } from './restoreBackupFile'

// Un progetto che non si apre (file di progetto rovinato, per esempio da un blocco della corrente
// durante il salvataggio): si rimette la copia del salvataggio precedente, o si estrae un backup
// in una cartella nuova, senza dover aprire il progetto. Vedi main/project/rescue.ts.

export default function RescueDialog({
  folder,
  onOpen,
  onClose
}: {
  /** Cartella del progetto che non si apre */
  folder: string
  /** Apre questa cartella: il progetto riparato o quello ripristinato */
  onOpen(folder: string): void
  onClose(): void
}): React.JSX.Element {
  const { t, lang } = useI18n()
  const [state, setState] = useState<ProjectRescue | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Message | null>(null)

  useEffect(() => {
    window.api.projectRescue(folder).then(setState, (e) => setError(messageFromError(e)))
  }, [folder])

  const run = async (job: () => Promise<string | null>): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const opened = await job()
      if (opened) {
        onClose()
        onOpen(opened)
      }
    } catch (e) {
      setError(messageFromError(e))
    } finally {
      setBusy(false)
    }
  }

  const useCopy = (): Promise<void> =>
    run(async () => {
      if (!(await confirmKey(t, 'rescue.copyConfirm'))) return null
      await window.api.restoreProjectFileCopy(folder)
      return folder
    })

  const restore = async (file: string): Promise<void> => {
    // nel web la cartella si sceglie prima di tutto: il browser apre la finestra solo subito
    // dopo il clic
    let parent: string | undefined
    if (window.api.isWeb) {
      parent = (await window.api.chooseFolder()) ?? undefined
      if (!parent) return
    }
    await run(async () => {
      if (!(await confirmKey(t, 'rescue.restoreConfirm'))) return null
      return window.api.restoreProjectBackup(folder, file, parent)
    })
  }

  const when = (ms: number): string => new Date(ms).toLocaleString(lang)

  return (
    <Dialog title={t('rescue.title')} onClose={onClose}>
      <div className="backup-dialog rescue-dialog">
        <p className="backup-intro">{t('rescue.intro')}</p>
        <p className="muted small rescue-folder">{folder}</p>
        {error && <div className="banner error">{t(error)}</div>}
        {!state && !error && <p className="muted">{t('backup.working')}</p>}
        {state && (
          <>
            {state.copy && (
              <section className="rescue-section">
                <h3>{t('rescue.copyTitle')}</h3>
                <p>{t('rescue.copyText', { when: when(state.copy.date) })}</p>
                <button className="primary" disabled={busy} onClick={useCopy}>
                  {t('rescue.copyOk')}
                </button>
              </section>
            )}
            <section className="rescue-section">
              <h3>{t('rescue.backupsTitle')}</h3>
              {state.backups.length ? (
                <table className="backup-list">
                  <tbody>
                    {state.backups.map((b) => (
                      <tr key={b.file}>
                        <td>{when(b.date)}</td>
                        <td className="muted">{b.auto ? t('backup.auto') : t('backup.manual')}</td>
                        <td>{b.label ?? ''}</td>
                        <td>
                          <button disabled={busy} onClick={() => restore(b.file)}>
                            {t('backup.restore')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="muted">{t('rescue.noBackups')}</p>
              )}
              {!window.api.isWeb && (
                <div className="backup-actions">
                  {state.backupFolder && (
                    <button onClick={() => window.api.showFolder(state.backupFolder!)}>
                      {t('backup.showFolder')}
                    </button>
                  )}
                  <button
                    disabled={busy}
                    onClick={() => run(() => restoreBackupFromFile(t, parentOf(folder)))}
                  >
                    {t('rescue.otherFile')}
                  </button>
                </div>
              )}
            </section>
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
