import { useEffect, useState } from 'react'
import type { BackupItem } from '../../../shared/api'
import { messageFromError, type Message } from '../../../shared/messages'
import type { LoadedProject, PrintedState } from '../../../shared/project'
import { readCompareBase, readCompareSources, type CompareBase } from './compareBase'

export type { CompareBase }
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'

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
    void readCompareSources().then(({ printed: p, backups: b }) => {
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
      const base = await readCompareBase(
        choice,
        { printed, backups: backups ?? [] },
        project,
        t,
        when
      )
      if (base) onCompare(base)
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
