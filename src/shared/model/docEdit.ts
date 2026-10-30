import { parseAttrs, serializeAttrs, spanAt } from './markup'

// Comandi della barra di formattazione dei documenti: ciascuno prende il testo e la selezione e
// restituisce il testo nuovo con la selezione da rimettere. Scrivono il markup che si scriverebbe
// a mano (**grassetto**, ++sottolineato++, # titolo, - elenco, [testo]{.stile}).

export interface DocEdit {
  text: string
  from: number
  to: number
}

/** Segni Markdown che si mettono intorno al testo */
export type WrapMark = '**' | '*' | '++' | '~~' | '%%'

/** Il segno intorno a from..to, se c'è; per il corsivo non vale la stella di un grassetto */
function marked(src: string, from: number, to: number, mark: WrapMark): boolean {
  const m = mark.length
  if (src.slice(from - m, from) !== mark || src.slice(to, to + m) !== mark) return false
  if (mark !== '*') return true
  const before = src.slice(Math.max(0, from - 3), from)
  const after = src.slice(to, to + 3)
  // *x* dentro **…**: due stelle sono grassetto, tre grassetto e corsivo
  return (
    (before === '***' || !before.endsWith('**')) && (after === '***' || !after.startsWith('**'))
  )
}

/** Mette o toglie un segno intorno alla selezione; senza selezione lascia il cursore in mezzo */
export function toggleWrap(src: string, from: number, to: number, mark: WrapMark): DocEdit {
  const m = mark.length
  const sel = src.slice(from, to)
  // la selezione comprende i segni
  if (
    sel.length >= 2 * m &&
    sel.startsWith(mark) &&
    sel.endsWith(mark) &&
    marked(src, from + m, to - m, mark)
  )
    return {
      text: src.slice(0, from) + sel.slice(m, -m) + src.slice(to),
      from,
      to: to - 2 * m
    }
  if (marked(src, from, to, mark))
    return {
      text: src.slice(0, from - m) + sel + src.slice(to + m),
      from: from - m,
      to: to - m
    }
  // gli spazi ai bordi restano fuori: "**parola **" non è grassetto
  const lead = sel.length - sel.trimStart().length
  const trail = sel.trim() ? sel.length - sel.trimEnd().length : 0
  const a = from + lead
  const b = to - trail
  return {
    text: src.slice(0, a) + mark + src.slice(a, b) + mark + src.slice(b),
    from: a + m,
    to: b + m
  }
}

/** Righe toccate dalla selezione: dall'inizio della prima alla fine dell'ultima */
function lineRange(src: string, from: number, to: number): { start: number; end: number } {
  const start = src.lastIndexOf('\n', from - 1) + 1
  // una selezione che finisce a capo non comprende la riga dopo
  const last = to > from && src[to - 1] === '\n' ? to - 1 : to
  const nl = src.indexOf('\n', last)
  return { start, end: nl < 0 ? src.length : nl }
}

/** Riscrive le righe della selezione e seleziona tutte le righe cambiate */
function mapLines(
  src: string,
  from: number,
  to: number,
  fn: (line: string, index: number) => string
): DocEdit {
  const { start, end } = lineRange(src, from, to)
  let n = 0
  const lines = src
    .slice(start, end)
    .split('\n')
    .map((l) => (l.trim() ? fn(l, n++) : l))
    .join('\n')
  if (from === to) {
    // un cursore resta un cursore, spostato con la sua riga
    const shift = lines.length - (end - start)
    const at = Math.max(start, Math.min(start + lines.length, from + shift))
    return { text: src.slice(0, start) + lines + src.slice(end), from: at, to: at }
  }
  return {
    text: src.slice(0, start) + lines + src.slice(end),
    from: start,
    to: start + lines.length
  }
}

const HEADING = /^\s{0,3}#{1,6}\s+/
const PREFIX = {
  bullet: /^(\s*)[-*+]\s+/,
  number: /^(\s*)\d+[.)]\s+/,
  quote: /^\s{0,3}>\s?/
}

/** Livello del titolo nella riga del cursore; 0 per un paragrafo */
export function headingAt(src: string, at: number): number {
  const start = src.lastIndexOf('\n', at - 1) + 1
  const m = /^\s{0,3}(#{1,6})\s/.exec(src.slice(start))
  return m ? m[1].length : 0
}

/** Rende titolo di livello 1-3 le righe della selezione, o paragrafo con 0 */
export function setHeading(src: string, from: number, to: number, level: number): DocEdit {
  return mapLines(src, from, to, (l) => {
    const body = l.replace(HEADING, '')
    return level > 0 ? `${'#'.repeat(level)} ${body}` : body
  })
}

/** Elenco puntato, numerato o citazione: lo mette alle righe, o lo toglie se c'è già in tutte */
export function toggleLines(
  src: string,
  from: number,
  to: number,
  kind: keyof typeof PREFIX
): DocEdit {
  const { start, end } = lineRange(src, from, to)
  const lines = src
    .slice(start, end)
    .split('\n')
    .filter((l) => l.trim())
  const all = lines.length > 0 && lines.every((l) => PREFIX[kind].test(l))
  return mapLines(src, from, to, (l, i) => {
    if (all) return l.replace(PREFIX[kind], kind === 'quote' ? '' : '$1')
    if (kind === 'quote') return `> ${l}`
    // un elenco prende il posto dell'altro
    const other = kind === 'bullet' ? PREFIX.number : PREFIX.bullet
    const indent = /^\s*/.exec(l)![0]
    const body = l.replace(other, '').replace(HEADING, '').trimStart()
    return `${indent}${kind === 'bullet' ? '-' : `${i + 1}.`} ${body}`
  })
}

/**
 * Applica uno stile: alla porzione [testo]{...} sotto il cursore (lo stile prende il posto di
 * quelli che aveva), al testo selezionato, o senza selezione a un testo d'esempio da riscrivere.
 */
export function applyStyle(
  src: string,
  from: number,
  to: number,
  style: string,
  sample: string
): DocEdit {
  const span = spanAt(src, from, to)
  if (span && from >= span.start) {
    const attrs = parseAttrs(src.slice(span.attrsFrom, span.attrsTo)).attrs
    const a = serializeAttrs({ ...attrs, styles: [style] })
    return {
      text: src.slice(0, span.attrsFrom) + a + src.slice(span.attrsTo),
      from: span.textFrom,
      to: span.textTo
    }
  }
  const sel = src.slice(from, to)
  if (!sel.trim()) {
    const piece = `[${sample}]{.${style}}`
    return {
      text: src.slice(0, from) + piece + src.slice(to),
      from: from + 1,
      to: from + 1 + sample.length
    }
  }
  // su più righe, una porzione per riga: una porzione non va a capo
  let out = ''
  let pos = 0
  for (const part of sel.split('\n')) {
    const prefix =
      (HEADING.exec(part) ??
        PREFIX.bullet.exec(part) ??
        PREFIX.number.exec(part) ??
        PREFIX.quote.exec(part))?.[0] ?? ''
    const body = part.slice(prefix.length)
    const lead = body.length - body.trimStart().length
    const core = body.trim()
    out +=
      (pos ? '\n' : '') +
      (core
        ? `${prefix}${body.slice(0, lead)}[${core}]{.${style}}${body.slice(lead + core.length)}`
        : part)
    pos++
  }
  return { text: src.slice(0, from) + out + src.slice(to), from, to: from + out.length }
}

/** Il tratto da sostituire per passare da un testo all'altro: serve ad annullare con ⌘Z */
export function changedRange(
  before: string,
  after: string
): { from: number; to: number; insert: string } {
  let a = 0
  const max = Math.min(before.length, after.length)
  while (a < max && before[a] === after[a]) a++
  let b = 0
  while (b < max - a && before[before.length - 1 - b] === after[after.length - 1 - b]) b++
  return { from: a, to: before.length - b, insert: after.slice(a, after.length - b) }
}
