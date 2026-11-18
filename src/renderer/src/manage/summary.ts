import type { Usages } from '../../../shared/model/usages'
import type { useI18n } from '../i18n/context'

/** Riassunto di una riga: «2 template · 5 carte · 1 documento» o «Non usata» */
export function usageSummary(u: Usages, t: ReturnType<typeof useI18n>['t']): string {
  const cards = u.sets.reduce((n, s) => n + s.cards.length, 0)
  const parts: string[] = []
  if (u.templates.length) parts.push(t('manage.sum.templates', { n: u.templates.length }))
  if (cards) parts.push(t('manage.sum.cards', { n: cards }))
  if (u.documents.length) parts.push(t('manage.sum.documents', { n: u.documents.length }))
  if (u.variables.length + u.styles.length)
    parts.push(t('manage.sum.definitions', { n: u.variables.length + u.styles.length }))
  return parts.join(' · ')
}

/** «Elimina» per una voce, «Elimina 3» per più voci */
export const delLabel = (t: ReturnType<typeof useI18n>['t'], n: number): string =>
  n > 1 ? t('manage.deleteMany', { n }) : t('manage.delete')
