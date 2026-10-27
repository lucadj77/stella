import { useEffect, useRef, useState } from 'react'
import type { ColumnInfo } from '../../../shared/model/sheet'
import type { SetDefinition } from '../../../shared/project'
import { useI18n } from '../i18n/context'

interface Props {
  /** Tutte le colonne del set, anche nascoste e calcolate */
  columns: ColumnInfo[]
  hidden: Set<string>
  showComputed: boolean
  onChange(view: Pick<SetDefinition, 'hiddenColumns' | 'showComputed' | 'pinnedProperties'>): void
  /** Torna alla vista di base: solo le colonne dei livelli collegati, dettagli chiusi */
  onReset(): void
}

/**
 * Colonne mostrate nella tabella e nei campi della carta: di base tutte quelle modificabili;
 * i livelli fissi e con formula si aggiungono a richiesta, in sola lettura.
 */
function ColumnsMenu({
  columns,
  hidden,
  showComputed,
  onChange,
  onReset
}: Props): React.JSX.Element {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent): void => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const editable = columns.filter((c) => !c.computed)
  const computed = columns.filter((c) => c.computed)
  // le colonne nascoste che non esistono più non contano
  const hiddenNow = columns.filter(
    (c) => hidden.has(c.header) && (!c.computed || showComputed)
  ).length
  const toggle = (h: string): void => {
    const next = new Set(hidden)
    if (next.has(h)) next.delete(h)
    else next.add(h)
    onChange({ hiddenColumns: columns.map((c) => c.header).filter((x) => next.has(x)) })
  }
  const item = (c: ColumnInfo): React.JSX.Element => (
    <label key={c.header} className="columns-menu-item">
      <input type="checkbox" checked={!hidden.has(c.header)} onChange={() => toggle(c.header)} />
      <span className={c.index < 0 ? 'muted' : undefined}>
        {c.header === 'amount' ? t('cardForm.amount') : c.header}
      </span>
    </label>
  )

  return (
    <div className="columns-menu" ref={boxRef}>
      <button
        className={open ? 'active' : undefined}
        aria-expanded={open}
        title={t('tip.columns')}
        onClick={() => setOpen(!open)}
      >
        {hiddenNow ? t('columns.buttonHidden', { n: hiddenNow }) : t('columns.button')}
      </button>
      {open && (
        <div className="columns-menu-panel" role="menu">
          <p className="muted small">{t('columns.hint')}</p>
          <div className="columns-menu-list">{editable.map(item)}</div>
          <label className="columns-menu-item columns-menu-computed">
            <input
              type="checkbox"
              checked={showComputed}
              disabled={!computed.length}
              onChange={(e) => onChange({ showComputed: e.target.checked })}
            />
            <span>{t('columns.showComputed')}</span>
          </label>
          {showComputed && computed.length > 0 && (
            <div className="columns-menu-list">{computed.map(item)}</div>
          )}
          <div className="columns-menu-actions">
            {hidden.size > 0 && (
              <button onClick={() => onChange({ hiddenColumns: [] })}>
                {t('columns.showAll')}
              </button>
            )}
            <button
              title={t('columns.resetHint')}
              onClick={() => {
                onReset()
                setOpen(false)
              }}
            >
              {t('columns.reset')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ColumnsMenu
