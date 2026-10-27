// Cerca e sostituisci nei testi: documenti, note, celle, testi e formule dei livelli. Si cerca il
// testo com'è scritto (niente espressioni regolari), con le maiuscole e la parola intera a scelta.

export interface FindOptions {
  /** Distingue maiuscole e minuscole */
  matchCase?: boolean
  /** Solo parole intere: prima e dopo non c'è una lettera, una cifra o _ */
  wholeWord?: boolean
}

export interface TextMatch {
  from: number
  to: number
}

const WORD = /[\p{L}\p{N}_]/u

/** Le occorrenze di `query` nel testo, senza sovrapporsi */
export function findMatches(text: string, query: string, o: FindOptions = {}): TextMatch[] {
  if (!query) return []
  const hay = o.matchCase ? text : text.toLowerCase()
  const needle = o.matchCase ? query : query.toLowerCase()
  // toLowerCase può cambiare la lunghezza (İ): in quel caso si cerca sul testo com'è
  const same = hay.length === text.length
  const src = same ? hay : text
  const what = same ? needle : query
  const out: TextMatch[] = []
  let at = src.indexOf(what)
  while (at >= 0) {
    const end = at + what.length
    const whole = !o.wholeWord || (!WORD.test(text[at - 1] ?? '') && !WORD.test(text[end] ?? ''))
    if (whole) out.push({ from: at, to: end })
    at = src.indexOf(what, whole ? end : at + 1)
  }
  return out
}

/** Il testo con le occorrenze scelte sostituite */
export function replaceMatches(text: string, matches: TextMatch[], replacement: string): string {
  let out = ''
  let last = 0
  for (const m of [...matches].sort((a, b) => a.from - b.from)) {
    if (m.from < last) continue
    out += text.slice(last, m.from) + replacement
    last = m.to
  }
  return out + text.slice(last)
}

/** Sostituisce tutte le occorrenze */
export const replaceAll = (
  text: string,
  query: string,
  replacement: string,
  o: FindOptions = {}
): string => replaceMatches(text, findMatches(text, query, o), replacement)
