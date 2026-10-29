import type { ProjectFile } from '../project'
import { projectLanguages } from './language'
import type { NumberFormat } from './number'

// Come si scrivono i numeri sulle carte, per lingua: 1.234,5 in italiano, 1,234.5 in inglese.
// Dentro Stella i numeri restano come li dà il foglio (1 234.5, il punto per i decimali): solo il
// testo che si vede sulla carta cambia. Le migliaia si separano solo dove le separa il formato
// della cella; i risultati delle formule no, come in Excel, così un anno resta 2026.

export type NumberStyle = 'plain' | 'it' | 'en' | 'fr'

export const NUMBER_STYLES: NumberStyle[] = ['plain', 'it', 'en', 'fr']

const FORMATS: Record<NumberStyle, NumberFormat> = {
  plain: { decimal: '.', group: '\u00a0' },
  it: { decimal: ',', group: '.' },
  en: { decimal: '.', group: ',' },
  fr: { decimal: ',', group: '\u00a0' }
}

/** Un numero d'esempio scritto nello stile: 1.234,5 */
export function numberExample(style: NumberStyle): string {
  const f = FORMATS[style]
  return `1${f.group === '\u00a0' ? ' ' : f.group}234${f.decimal}5`
}

function isStyle(s: unknown): s is NumberStyle {
  return typeof s === 'string' && (NUMBER_STYLES as string[]).includes(s)
}

/** Lo stile abituale di una lingua: la virgola per i decimali in italiano, il punto in inglese */
export function languageStyle(code: string): NumberStyle {
  try {
    const parts = new Intl.NumberFormat(code).formatToParts(1234567.5)
    const decimal = parts.find((p) => p.type === 'decimal')?.value
    const group = parts.find((p) => p.type === 'group')?.value
    if (decimal === ',') return group === '.' ? 'it' : 'fr'
    if (decimal === '.' && group === ',') return 'en'
  } catch {
    // un codice che Intl non conosce
  }
  return 'plain'
}

export type NumberSettings = Pick<ProjectFile, 'languages' | 'numberFormat' | 'numberFormats'>

/**
 * Stile dei numeri in una lingua del progetto. La principale (anche con lingua assente o che il
 * progetto non ha) usa numberFormat, o i numeri come oggi; le altre il loro stile o quello
 * abituale della lingua.
 */
export function numberStyleOf(file: NumberSettings, language?: string | null): NumberStyle {
  const langs = projectLanguages(file)
  if (!language || !langs.includes(language) || language === langs[0])
    return isStyle(file.numberFormat) ? file.numberFormat : 'plain'
  const own = file.numberFormats?.[language]
  return isStyle(own) ? own : languageStyle(language)
}

/** Ciò che serve alle formule e alle carte per leggere e scrivere i numeri */
export interface NumberFormatting {
  /** Come si scrivono i numeri sulla carta, nella lingua in cui si mostra */
  shown: NumberFormat
  /** Nelle formule 2,5 è un numero: la lingua principale usa la virgola per i decimali */
  decimalComma: boolean
}

/** Le regole dei numeri per una lingua; nessuna se tutto resta come oggi */
export function numberFormatting(
  file: NumberSettings,
  language?: string | null
): NumberFormatting | undefined {
  const shown = numberStyleOf(file, language)
  const decimalComma = FORMATS[numberStyleOf(file)].decimal === ','
  return shown === 'plain' && !decimalComma ? undefined : { shown: FORMATS[shown], decimalComma }
}
