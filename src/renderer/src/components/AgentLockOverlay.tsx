import { useEffect } from 'react'
import { confirmKey } from './confirm'
import type { AgentLock } from '../../../shared/api'
import { useI18n } from '../i18n/context'

// Un'IA sta lavorando sul progetto con il comando stella (`stella begin`): l'app non si usa finché
// non finisce (`stella end`), poi ricarica il progetto da sola. Vedi docs/cli.md.

export default function AgentLockOverlay({
  lock,
  onUnlock
}: {
  lock: AgentLock
  onUnlock(): void
}): React.JSX.Element {
  const { t, lang } = useI18n()

  // nessuna scorciatoia (salva, annulla, copia…) arriva all'app sotto
  useEffect(() => {
    const block = (e: KeyboardEvent): void => {
      if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', block, true)
    return () => window.removeEventListener('keydown', block, true)
  }, [])

  const since = new Date(lock.since)
  const unlock = (): void => {
    void confirmKey(t, 'agent.unlockConfirm', undefined, { danger: true }).then(
      (ok) => ok && onUnlock()
    )
  }

  return (
    <div className="dialog-backdrop agent-lock">
      <div className="dialog" role="alertdialog" aria-label={t('agent.title')}>
        <h2>{t('agent.title')}</h2>
        <p>{t('agent.text')}</p>
        {lock.note && <p className="agent-note">{lock.note}</p>}
        {!isNaN(since.getTime()) && (
          <p className="muted small">
            {t('agent.since', { time: since.toLocaleTimeString(lang) })}
          </p>
        )}
        <div className="dialog-buttons">
          <button onClick={unlock} title={t('agent.unlockHint')}>
            {t('agent.unlock')}
          </button>
        </div>
      </div>
    </div>
  )
}
