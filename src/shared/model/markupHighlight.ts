// Colorazione del markup nei campi di testo: divide il sorgente in pezzi con un tipo, che il
// campo mostra con colori diversi. Non interpreta il testo come fa parseMarkup: segue solo la
// sintassi, così colora anche il markup scritto a metà.

export type HighlightKind =
  /** Graffe e quadre */
  | 'punct'
  /** {nome}: campo o variabile */
  | 'ref'
  /** .stile */
  | 'style'
  /** Nome di un attributo, anche senza valore (center, italic) */
  | 'attr'
  /** Valore di un attributo dopo = */
  | 'value'
  /** Segni Markdown: **, ==, # a inizio riga… */
  | 'md'
  /** \{ e simili */
  | 'escape'
  /** %% commento %% nei documenti */
  | 'comment'

export interface HighlightPiece {
  from: number
  to: number
  kind: HighlightKind
}

const ALIGNS = new Set(['left', 'center', 'right', 'justify'])

/** Come in parseMarkup: le graffe a inizio riga sono attributi se ogni parola lo sembra */
const looksLikeAttrs = (inner: string): boolean => {
  const tokens = inner.trim().split(/\s+/)
  return (
    tokens[0] !== '' && tokens.every((t) => t.startsWith('.') || t.includes('=') || ALIGNS.has(t))
  )
}

const LINE_START = /^(#{1,2} +|> ?|[-*•] +|\d+[.)] +|-{3,}\s*$)/
const DOUBLES = ['**', '++', '~~', '==']
const SINGLES = new Set(['*', '^', '~'])

function highlightPlain(src: string): HighlightPiece[] {
  const out: HighlightPiece[] = []
  const push = (from: number, to: number, kind: HighlightKind): void => {
    if (to > from) out.push({ from, to, kind })
  }

  /** Contenuto di una coppia di graffe, da `from` (dopo {) a `to` (prima di }) */
  const braces = (from: number, to: number, attrsOnly: boolean): void => {
    const inner = src.slice(from, to)
    // in mezzo alla riga e senza quadre prima, la prima parola è sempre un nome
    let first = !attrsOnly
    const re = /\S+/g
    let m: RegExpExecArray | null
    while ((m = re.exec(inner))) {
      const a = from + m.index
      const tok = m[0]
      if (first) {
        first = false
        // {spada*3}: il nome e il numero di ripetizioni
        const star = tok.indexOf('*')
        push(a, a + (star < 0 ? tok.length : star), 'ref')
        if (star >= 0) {
          push(a + star, a + star + 1, 'punct')
          push(a + star + 1, a + tok.length, 'value')
        }
      } else if (tok.startsWith('.')) push(a, a + tok.length, 'style')
      else {
        const eq = tok.indexOf('=')
        if (eq < 0) push(a, a + tok.length, 'attr')
        else {
          push(a, a + eq + 1, 'attr')
          push(a + eq + 1, a + tok.length, 'value')
        }
      }
    }
  }

  let lineStart = true
  for (let i = 0; i < src.length;) {
    const c = src[i]
    if (lineStart) {
      lineStart = false
      // attributi del paragrafo prima dei segni di riga
      if (c === '{') {
        const close = src.indexOf('}', i)
        const nl = src.indexOf('\n', i)
        if (close > 0 && (nl < 0 || close < nl) && looksLikeAttrs(src.slice(i + 1, close))) {
          push(i, i + 1, 'punct')
          braces(i + 1, close, true)
          push(close, close + 1, 'punct')
          i = close + 1
          while (src[i] === ' ') i++
        }
      }
      const m = src
        .slice(i, src.indexOf('\n', i) < 0 ? undefined : src.indexOf('\n', i))
        .match(LINE_START)
      if (m) {
        push(i, i + m[0].trimEnd().length, 'md')
        i += m[0].length
        continue
      }
      continue
    }
    if (c === '\n') {
      lineStart = true
      i++
      continue
    }
    if (c === '\\') {
      // \ a fine riga: a capo nello stesso paragrafo
      push(
        i,
        Math.min(src.length, i + 2),
        src[i + 1] === '\n' || i + 1 === src.length ? 'md' : 'escape'
      )
      i += src[i + 1] === '\n' ? 1 : 2
      continue
    }
    if (c === '{') {
      const close = src.indexOf('}', i)
      const nl = src.indexOf('\n', i)
      if (close > 0 && (nl < 0 || close < nl)) {
        push(i, i + 1, 'punct')
        braces(i + 1, close, src[i - 1] === ']')
        push(close, close + 1, 'punct')
        i = close + 1
        continue
      }
    }
    if (c === '[' || (c === ']' && src[i + 1] === '{')) {
      push(i, i + 1, 'punct')
      i++
      continue
    }
    const two = src.slice(i, i + 2)
    if (DOUBLES.includes(two)) {
      push(i, i + 2, 'md')
      i += 2
      continue
    }
    // un asterisco staccato dal testo (3 * 4) resta un asterisco
    if (SINGLES.has(c) && !(/\s/.test(src[i - 1] ?? ' ') && /\s/.test(src[i + 1] ?? ' '))) {
      push(i, i + 1, 'md')
      i++
      continue
    }
    i++
  }
  return out
}

/**
 * I pezzi colorati del markup. Con `comments` (nei documenti) le parti tra %% e %% sono commenti:
 * si colorano come tali e il markup che contengono non si colora
 */
export function highlightMarkup(src: string, opts: { comments?: boolean } = {}): HighlightPiece[] {
  if (!opts.comments || !src.includes('%%')) return highlightPlain(src)
  const comments: HighlightPiece[] = [...src.matchAll(/%%[\s\S]*?(?:%%|$)/g)].map((m) => ({
    from: m.index,
    to: m.index + m[0].length,
    kind: 'comment'
  }))
  let masked = src
  for (const c of comments)
    masked = masked.slice(0, c.from) + ' '.repeat(c.to - c.from) + masked.slice(c.to)
  return [...highlightPlain(masked), ...comments].sort((a, b) => a.from - b.from)
}
