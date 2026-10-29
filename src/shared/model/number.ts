// Numeri scritti come li mostra un foglio di calcolo: con i decimali dopo il punto o la virgola,
// la percentuale, il simbolo della valuta, i separatori delle migliaia.

const CURRENCY = /^[€$£¥]|[€$£¥]$/g

/**
 * Valore di un testo come numero, o null se non lo è. Si leggono "1.5", "1,5", "50%" (0,5),
 * "1 234.50 €", "€ 3,00", "1.234,5" e "1,234.5". Con un solo separatore e nessun altro segno
 * il separatore è quello dei decimali: "1,234" vale 1,234.
 */
export function readNumber(text: string): number | null {
  const t = text.trim()
  if (t === '') return null
  // come si è sempre letto: 1.5, 1,5, -3, 1e3
  const plain = Number(t.replace(',', '.'))
  if (Number.isFinite(plain)) return plain
  let s = t
  let percent = false
  if (s.endsWith('%')) {
    percent = true
    s = s.slice(0, -1).trim()
  }
  s = s.replace(CURRENCY, '').trim()
  // il segno può stare prima o dopo il simbolo: -€3, €-3
  const sign = /^[-+]/.test(s) ? s[0] : ''
  s = s.slice(sign.length).replace(CURRENCY, '').trim()
  if (!/^\d[\d.,\u00a0\u202f' ]*$/.test(s)) return null
  const dot = s.lastIndexOf('.')
  const comma = s.lastIndexOf(',')
  // con entrambi i segni l'ultimo separa i decimali; un segno ripetuto separa le migliaia
  let decimal = ''
  if (dot >= 0 && comma >= 0) decimal = dot > comma ? '.' : ','
  else if (dot >= 0 && s.indexOf('.') === dot) decimal = '.'
  else if (comma >= 0 && s.indexOf(',') === comma) decimal = ','
  const at = decimal ? s.lastIndexOf(decimal) : -1
  const int = at >= 0 ? s.slice(0, at) : s
  const frac = at >= 0 ? s.slice(at + 1) : ''
  if (!/^\d*$/.test(frac)) return null
  // separatori delle migliaia: punto, virgola, spazio, spazio unificatore o stretto, apostrofo
  const groups = int.split(/[.,\u00a0\u202f' ]/)
  // le migliaia vanno a gruppi di tre cifre
  if (groups.length > 1 && !groups.every((g, i) => (i === 0 ? /^\d{1,3}$/ : /^\d{3}$/).test(g)))
    return null
  const n = Number(`${sign}${groups.join('')}${frac ? '.' + frac : ''}`)
  if (!Number.isFinite(n)) return null
  return percent ? n / 100 : n
}

/** Separatori di un numero scritto sulla carta (vedi model/numberFormat.ts) */
export interface NumberFormat {
  decimal: '.' | ','
  group: string
}

/** Un numero calcolato scritto nel formato, senza separatore delle migliaia: 2,5 */
export function writeNumber(n: number, format?: NumberFormat): string {
  const s = String(Math.round(n * 1e6) / 1e6)
  return format?.decimal === ',' ? s.replace('.', ',') : s
}

// un solo numero come lo dà il foglio, con le migliaia separate da spazi unificatori; intorno
// solo segno, valuta, percentuale e spazi
const SHEET_NUMBER =
  /^([-+\s\u00a0€$£¥₹%]*?)(\d{1,3}(?:\u00a0\d{3})+|\d+)(?:\.(\d+))?([\s\u00a0€$£¥₹%]*)$/

/**
 * Un valore che è un numero (2.5, 1 234.50 €, 50%) scritto nel formato; un altro testo resta
 * com'è, così una data, un codice o una frase non cambiano.
 */
export function localizeNumber(text: string, format?: NumberFormat): string {
  if (!format || (format.decimal === '.' && format.group === '\u00a0')) return text
  const m = SHEET_NUMBER.exec(text)
  if (!m) return text
  const [, before, int, frac, after] = m
  return `${before}${int.replace(/\u00a0/g, format.group)}${frac !== undefined ? format.decimal + frac : ''}${after}`
}
