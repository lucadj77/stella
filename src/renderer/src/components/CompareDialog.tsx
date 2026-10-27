import { useEffect, useState } from 'react'
import type { BackupItem } from '../../../shared/api'
import { messageFromError, type Message } from '../../../shared/messages'
import { cardFingerprints } from '../../../shared/model/compare'
import type { LoadedProject, PrintedState } from '../../../shared/project'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'

/** Versione con cui confrontare: le impronte delle sue carte, per set */
export interface CompareBase {
  label: string
  before: Record<string, string[]>
}

/**
 * Sceglie la versione con cui confrontare il progetto: l'ultima esportazione o un backup. Le
 * carte cambiate da allora si segnano nei set e si possono esportare da sole.
 */
export default function CompareDialog({
  project,
  onCompare,
  onClose
}: {
  project: LoadedProject
  onCompare(base: CompareBase): void
  onClose(): void
}): React.JSX.Element {
  const { t, lang } = useI18n()
  const [printed, setPrinted] = useState<PrintedState | null>(null)
  const [backups, setBackups] = useState<BackupItem[] | null>(null)
  const [choice, setChoice] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Message | null>(null)

  useEffect(() => {
    void Promise.all([
      window.api.readPrinted().catch(() => null),
      window.api
        .backups()
        .then((s) => s.items)
        .catch(() => [] as BackupItem[])
    ]).then(([p, b]) => {
      setPrinted(p)
      setBackups(b)
      setChoice(p ? 'printed' : (b[0]?.file ?? ''))
    })
  }, [])

  const when = (ms: number): string =>
    new Date(ms).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' })

  const compare = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      if (choice === 'printed' && printed) {
        onCompare({
          label: t('compare.sincePrinted', { date: when(printed.date) }),
          before: printed.sets
        })
        return
      }
      const item = backups?.find((b) => b.file === choice)
      if (!item) return
      const version = await window.api.backupVersion(item.file)
      onCompare({
        label: t('compare.sinceBackup', { date: when(item.date) }),
        before: cardFingerprints(version, project.assets)
      })
    } catch (e) {
      setError(messageFromError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog title={t('compare.title')} onClose={onClose}>
      <div className="dialog-form compare-dialog">
        <p className="muted small">{t('compare.hint')}</p>
        {backups === null ? (
          <p className="muted">{t('compare.loading')}</p>
        ) : !printed && !backups.length ? (
          <p>{t('compare.nothing')}</p>
        ) : (
          <div className="compare-choices">
            {printed && (
              <label className="compare-choice">
                <input
                  type="radio"
                  checked={choice === 'printed'}
                  onChange={() => setChoice('printed')}
                />
                {t('compare.printed', { date: when(printed.date) })}
              </label>
            )}
            {backups.map((b) => (
              <label key={b.file} className="compare-choice">
                <input
                  type="radio"
                  checked={choice === b.file}
                  onChange={() => setChoice(b.file)}
                />
                {t(b.auto ? 'compare.autoBackup' : 'compare.backup', { date: when(b.date) })}
                {b.label ? ` · ${b.label}` : ''}
              </label>
            ))}
          </div>
        )}
        {error && <p className="field-error">{t(error)}</p>}
        <div className="dialog-buttons">
          <button onClick={onClose}>{t('dialog.cancel')}</button>
          <button className="primary" disabled={!choice || busy} onClick={compare}>
            {busy ? t('compare.running') : t('compare.run')}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
