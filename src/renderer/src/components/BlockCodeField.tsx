import { useState } from 'react'
import { useI18n } from '../i18n/context'

// Il codice del blocco (```anatomy o ```setup) che la finestra scrive, modificabile a mano: la
// modifica vale quando si esce dal campo o con ⌘↵ / Ctrl+Invio; se non si capisce resta da
// correggere e la finestra tiene quello di prima.

export default function BlockCodeField({
  value,
  onApply,
  className = ''
}: {
  /** Il codice come lo scrive la finestra */
  value: string
  /** Applica il codice scritto a mano; false se non è un blocco del tipo giusto */
  onApply(text: string): boolean
  className?: string
}): React.JSX.Element {
  const { t } = useI18n()
  /** Il testo scritto e non ancora applicato */
  const [draft, setDraft] = useState<string | null>(null)
  const [bad, setBad] = useState(false)
  const commit = (): void => {
    if (draft === null) return
    if (draft === value || onApply(draft)) {
      setDraft(null)
      setBad(false)
    } else setBad(true)
  }
  return (
    <div className={'block-code ' + className}>
      <textarea
        className="insert-card-code"
        spellCheck={false}
        value={draft ?? value}
        title={t('documents.codeHint')}
        rows={Math.min(12, Math.max(3, (draft ?? value).split('\n').length))}
        onChange={(e) => {
          setDraft(e.target.value)
          setBad(false)
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            commit()
          } else if (e.key === 'Escape' && draft !== null) {
            e.stopPropagation()
            setDraft(null)
            setBad(false)
          }
          // le scorciatoie della finestra (frecce, Canc) restano del campo; Esc senza modifiche chiude
          if (e.key !== 'Escape') e.stopPropagation()
        }}
      />
      {bad ? (
        <p className="field-error small">{t('documents.codeBad')}</p>
      ) : (
        <p className="muted small">{t('documents.codeHint')}</p>
      )}
    </div>
  )
}
