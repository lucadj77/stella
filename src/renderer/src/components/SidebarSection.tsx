import { useI18n } from '../i18n/context'
import { ChevronIcon, ExpandIcon } from './icons'

/** Sezione della barra laterale: il titolo apre e chiude l'elenco */
export default function SidebarSection({
  id,
  icon,
  title,
  open,
  count,
  onToggle,
  onManage,
  actions,
  children
}: {
  id: string
  icon: React.ReactNode
  title: string
  open: boolean
  /** Numero di voci, mostrato accanto al titolo */
  count?: number
  onToggle(open: boolean): void
  /** Apre la scheda della sezione in «Gestisci il progetto» */
  onManage?(): void
  /** Pulsanti a destra del titolo, per esempio "+" */
  actions?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  const { t } = useI18n()
  return (
    <section className={open ? 'sidebar-section' : 'sidebar-section closed'} id={`sidebar-${id}`}>
      <h2 className="with-action">
        <button className="section-toggle" aria-expanded={open} onClick={() => onToggle(!open)}>
          <ChevronIcon open={open} />
          <span className="section-icon">{icon}</span>
          {title}
          {count !== undefined && <span className="section-count">{count}</span>}
        </button>
        {actions}
        {onManage && (
          <button
            className="icon-btn section-manage"
            title={t('manage.sectionHint', { section: title })}
            aria-label={t('manage.sectionHint', { section: title })}
            onClick={onManage}
          >
            <ExpandIcon />
          </button>
        )}
      </h2>
      {open && children}
    </section>
  )
}
