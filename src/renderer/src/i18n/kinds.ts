import { kindOf, type Template } from '../../../shared/model/template'
import type { Translate } from './context'

type T = Translate

/** Le parole per i componenti di un template: carta, segnalino, faccia... */
export interface KindWords {
  /** Il nome al singolare, minuscolo */
  one: string
  many: string
  /** Il pulsante che aggiunge una riga: «+ Carta» */
  add: string
  /** Il nome con la maiuscola, per i titoli: «Carta 3» */
  title: string
  /** «1 carta», «3 carte» */
  count(n: number): string
}

export function kindWords(t: T, template: Pick<Template, 'kind'> | null | undefined): KindWords {
  const k = kindOf(template)
  const one = t(`kind.${k}.one`)
  const many = t(`kind.${k}.many`)
  return {
    one,
    many,
    add: t(`kind.${k}.add`),
    title: one.charAt(0).toUpperCase() + one.slice(1),
    count: (n) => `${n} ${n === 1 ? one : many}`
  }
}
