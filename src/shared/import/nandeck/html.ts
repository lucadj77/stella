// Testo HTML di HTMLTEXT (nanDECK) nel markup di Stella (docs/specifica.md, 2.1): grassetto,
// corsivo, sottolineato, barrato, colori e a capo. I tag che Stella non ha si tolgono e si
// segnalano.

const ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  egrave: 'è',
  eacute: 'é',
  agrave: 'à',
  ograve: 'ò',
  ugrave: 'ù',
  igrave: 'ì',
  deg: '°',
  euro: '€',
  times: '×',
  middot: '·',
  bull: '•'
}

export interface HtmlConversion {
  text: string
  /** Tag non convertiti, senza parentesi angolari */
  unsupported: string[]
}

/**
 * Converte il testo. `<br>`, `<p>` e gli a capo diventano nuovi paragrafi; `<font color>` e
 * `<span style="color">` un colore; `<b>`, `<i>`, `<u>`, `<s>` i segni Markdown.
 */
export function htmlToMarkup(
  html: string,
  /** Tag dei font di HTMLFONT, con gli attributi del markup di Stella */
  fonts: Map<string, string> = new Map()
): HtmlConversion {
  const unsupported = new Set<string>()
  let out = ''
  // pila dei tag aperti, con ciò che va scritto alla chiusura
  const stack: { tag: string; close: string }[] = []
  const re = /<\s*(\/)?\s*([a-zA-Z][a-zA-Z0-9_-]*)([^>]*)>/g
  let last = 0
  let m: RegExpExecArray | null
  const decode = (s: string): string =>
    s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (e, code: string) => {
      if (code.startsWith('#x')) return String.fromCodePoint(parseInt(code.slice(2), 16))
      if (code.startsWith('#')) return String.fromCodePoint(Number(code.slice(1)))
      return ENTITIES[code.toLowerCase()] ?? e
    })
  const text = (s: string): string => escapeMarkup(decode(s))
  while ((m = re.exec(html))) {
    out += text(html.slice(last, m.index))
    last = re.lastIndex
    const closing = !!m[1]
    const tag = m[2].toLowerCase()
    const attrs = m[3]
    if (tag === 'br' || (tag === 'p' && !closing && out !== '')) {
      out += '\n'
      continue
    }
    if (tag === 'p') continue
    if (closing) {
      const i = stack.map((s) => s.tag).lastIndexOf(tag)
      if (i < 0) continue
      while (stack.length > i) out += stack.pop()!.close
      continue
    }
    const open = (marker: string, close = marker): void => {
      out += marker
      stack.push({ tag, close })
    }
    switch (tag) {
      case 'b':
      case 'strong':
        open('**')
        break
      case 'i':
      case 'em':
        open('*')
        break
      case 'u':
        open('++')
        break
      case 's':
      case 'strike':
      case 'del':
        open('~~')
        break
      case 'sup':
        open('^')
        break
      case 'sub':
        open('~')
        break
      case 'font':
      case 'span': {
        const color =
          /color\s*=\s*["']?(#[0-9a-f]{3,8}|[a-z]+)/i.exec(attrs)?.[1] ??
          /color\s*:\s*(#[0-9a-f]{3,8}|[a-z]+)/i.exec(attrs)?.[1]
        if (color) open('[', `]{color=${color}}`)
        else stack.push({ tag, close: '' })
        break
      }
      default: {
        const attrs = fonts.get(tag)
        if (attrs) {
          open('[', `]{${attrs}}`)
          break
        }
        unsupported.add(tag)
        stack.push({ tag, close: '' })
      }
    }
  }
  out += text(html.slice(last))
  while (stack.length) out += stack.pop()!.close
  return { text: out, unsupported: [...unsupported] }
}

/**
 * Testo semplice scritto nel markup: i segni che formerebbero una formattazione restano segni.
 * Si scrive la barra solo dove serve (un segno che compare una volta sola non apre nulla), così
 * il testo resta uguale a quello dei dati quando si può. I campi e le variabili tra graffe
 * restano come sono.
 */
export function escapeMarkup(s: string): string {
  const parts = s.split(/(\{[^{}\s]*\})/)
  const plain = parts.filter((_, i) => i % 2 === 0).join('')
  const paired = new Set([...'*~^=+_'].filter((c) => plain.split(c).length > 2))
  const out = parts
    .map((part, i) =>
      i % 2
        ? part
        : part.replace(/[*~^=+_[\]\\]/g, (c) =>
            c === '[' || c === ']' || c === '\\' || paired.has(c) ? `\\${c}` : c
          )
    )
    .join('')
  // inizio di riga: titoli, note, elenchi e linee
  return out.replace(/^(#{1,2} |> ?|[-*] |\d+[.)] |-{3,}\s*$)/gm, (m) =>
    /^\d/.test(m) ? m.replace(/[.)]/, (c) => `\\${c}`) : `\\${m}`
  )
}
