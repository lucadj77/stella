// Le scorciatoie nei testi dell'interfaccia sono scritte per il Mac (⌘S, ⇧⌘Z, ⌫) o in tutte e
// due le forme (⌘S / Ctrl+S, ⌘/Ctrl). L'app mostra solo quella del sistema in uso.

const MAC_KEY = '⇧?⌘[^\\s,/]+'
const CTRL_KEY = 'Ctrl\\+(?:\\+|[^\\s,;).]+)'
const list = (key: string): string => `${key}(?:(?:, | e | and )${key})*`
/** "⌘C, ⌘X e ⌘V / Ctrl+C, Ctrl+X e Ctrl+V": la coppia scritta per esteso */
const PAIR = new RegExp(`(${list(MAC_KEY)}) / (${list(CTRL_KEY)})`, 'g')

/** Il nome del tasto Maiuscolo sulle tastiere di Windows e Linux */
const SHIFT: Record<string, string> = { it: 'Maiusc', en: 'Shift' }

export function platformKeys(text: string, mac: boolean, lang = 'en'): string {
  if (!/[⌘⇧⌫]/.test(text)) return text
  const out = text
    .replace(PAIR, (_, m: string, c: string) => (mac ? m : c))
    .replace(/⌘\/Ctrl/g, mac ? '⌘' : 'Ctrl')
  if (mac) return out
  const shift = SHIFT[lang] ?? SHIFT.en
  return out
    .replace(/⇧⌘(?=\S)/g, `Ctrl+${shift}+`)
    .replace(/⌘(?=[A-Z0-9+−=])/g, 'Ctrl+')
    .replace(/⌘/g, 'Ctrl')
    .replace(/⇧/g, shift)
    .replace(/⌫/g, lang === 'it' ? 'Canc' : 'Del')
}

export const isMacPlatform = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
