import { cardRanges, isUnused, type Usages } from '../../../shared/model/usages'
import type { Uses } from '../../../shared/model/overview'
import { baseOf } from '../../../shared/model/imageUsage'
import { useI18n } from '../i18n/context'
import { DetailList, Link, LinkList } from './ListPane'
import { useManageNav } from './manageTypes'

// Dove è usata una variabile o uno stile, e cosa usa un template, un set o un documento: nomi
// cliccabili che portano alla scheda dell'elemento.

export function UsagesLinks({ usages: u }: { usages: Usages }): React.JSX.Element {
  const { t } = useI18n()
  const { go } = useManageNav()
  if (isUnused(u)) return <p className="muted small">{t('usages.none')}</p>
  return (
    <DetailList
      rows={[
        [
          t('manage.where.templates'),
          u.templates.map((x, i) => (
            <span key={x.name}>
              {i > 0 && ', '}
              <Link onClick={() => go('templates', x.name)}>{x.name}</Link>
              {x.layers.length > 0 && <span className="muted"> ({x.layers.join(', ')})</span>}
            </span>
          )),
          u.templates.length > 0
        ],
        [
          t('manage.where.sets'),
          u.sets.map((x, i) => (
            <span key={x.name}>
              {i > 0 && ', '}
              <Link onClick={() => go('sets', x.name)}>{x.name}</Link>
              <span className="muted">
                {' '}
                ({t('usages.cards')} {cardRanges(x.cards)})
              </span>
            </span>
          )),
          u.sets.length > 0
        ],
        [
          t('manage.where.documents'),
          <LinkList key="d" items={u.documents} onClick={(n) => go('documents', n)} />,
          u.documents.length > 0
        ],
        [
          t('manage.where.notes'),
          <LinkList key="n" items={u.notes} onClick={(n) => go('notes', n)} />,
          u.notes.length > 0
        ],
        [
          t('manage.where.variables'),
          <LinkList
            key="v"
            items={u.variables}
            format={(n) => `{${n}}`}
            onClick={(n) => go('variables', n)}
          />,
          u.variables.length > 0
        ],
        [
          t('manage.where.styles'),
          <LinkList
            key="s"
            items={u.styles}
            format={(n) => `.${n}`}
            onClick={(n) => go('styles', n)}
          />,
          u.styles.length > 0
        ]
      ]}
    />
  )
}

/** Variabili, stili e immagini che un elemento usa */
export function UsesLinks({ uses }: { uses: Uses }): React.JSX.Element | null {
  const { t } = useI18n()
  const { go } = useManageNav()
  if (!uses.variables.length && !uses.styles.length && !uses.images.length) return null
  return (
    <DetailList
      rows={[
        [
          t('manage.uses.variables'),
          <LinkList
            key="v"
            items={uses.variables}
            format={(n) => `{${n}}`}
            onClick={(n) => go('variables', n)}
          />,
          uses.variables.length > 0
        ],
        [
          t('manage.uses.styles'),
          <LinkList
            key="s"
            items={uses.styles}
            format={(n) => `.${n}`}
            onClick={(n) => go('styles', n)}
          />,
          uses.styles.length > 0
        ],
        [
          t('manage.uses.images'),
          <LinkList
            key="i"
            items={uses.images}
            format={(p) => baseOf(p).replace(/\.[^.]+$/, '')}
            onClick={(p) => go('images', p)}
          />,
          uses.images.length > 0
        ]
      ]}
    />
  )
}
