import { cardRanges, isUnused, type Usages } from '../../../shared/model/usages'
import { useI18n } from '../i18n/context'

// Dove sono usati una variabile o uno stile, nella loro finestra: template con i livelli, set
// con le carte, altre variabili e stili. Un clic su un template o su un set lo apre.

export interface UsagesNav {
  usages: Usages
  openTemplate(name: string): void
  openSet(index: number): void
}

export default function UsagesSection({
  usages,
  openTemplate,
  openSet
}: UsagesNav): React.JSX.Element {
  const { t } = useI18n()
  const u = usages
  const cards = u.sets.reduce((n, s) => n + s.cards.length, 0)
  return (
    <details className="usages" open={!isUnused(u)}>
      <summary>
        {isUnused(u)
          ? t('usages.none')
          : t('usages.summary', { templates: u.templates.length, cards })}
      </summary>
      <ul>
        {u.templates.map((x) => (
          <li key={`t:${x.name}`}>
            <button className="link" onClick={() => openTemplate(x.name)}>
              {t('usages.template', { name: x.name })}
            </button>
            {x.layers.length > 0 && <span className="muted"> · {x.layers.join(', ')}</span>}
          </li>
        ))}
        {u.sets.map((x) => (
          <li key={`s:${x.name}`}>
            <button className="link" onClick={() => openSet(x.index)}>
              {t('usages.set', { name: x.name })}
            </button>
            <span className="muted">
              {' '}
              · {t('usages.cards')} {cardRanges(x.cards)}
            </span>
          </li>
        ))}
        {u.variables.length > 0 && (
          <li>{t('usages.variables', { names: u.variables.map((n) => `{${n}}`).join(', ') })}</li>
        )}
        {u.styles.length > 0 && (
          <li>{t('usages.styles', { names: u.styles.map((n) => `.${n}`).join(', ') })}</li>
        )}
        {u.documents.length > 0 && (
          <li>{t('usages.documents', { names: u.documents.join(', ') })}</li>
        )}
        {u.notes.length > 0 && <li>{t('usages.notes', { names: u.notes.join(', ') })}</li>}
      </ul>
    </details>
  )
}
