import { useEffect, useState } from 'react'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import { setConfirmHost, type ConfirmRequest } from './confirm'

/** La finestra delle conferme e degli avvisi, una alla volta: vedi confirm.ts */
export function ConfirmHost(): React.JSX.Element | null {
  const { t } = useI18n()
  const [queue, setQueue] = useState<ConfirmRequest[]>([])
  useEffect(() => {
    setConfirmHost((r) => setQueue((q) => [...q, r]))
    return () => setConfirmHost(null)
  }, [])
  const r = queue[0]
  if (!r) return null
  const done = (ok: boolean): void => {
    r.resolve(ok)
    setQueue((q) => q.slice(1))
  }
  return (
    <Dialog title={r.title} onClose={() => done(false)} className="confirm-backdrop">
      <div className="confirm">
        {r.message && <p className="confirm-message">{r.message}</p>}
        <div className="dialog-buttons">
          {r.cancel !== null && (
            <button type="button" autoFocus={r.danger} onClick={() => done(false)}>
              {r.cancel ?? t('dialog.cancel')}
            </button>
          )}
          <button
            type="button"
            autoFocus={!r.danger}
            className={r.danger ? 'danger' : 'primary'}
            onClick={() => done(true)}
          >
            {r.ok}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
