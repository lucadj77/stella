import { parseImageAttrs, type ImageSettings } from './variables'
import { msg, type Message } from '../messages'
import type { HAlign } from './template'

// Markup del testo: Markdown di base più gli attributi [testo]{...}. Vedi docs/specifica.md, 2.1.
// Il parser non conosce stili, variabili e immagini del progetto: li risolve chi disegna.

/** Formattazione di una porzione di testo; ciò che manca si eredita */
export interface Attrs {
  styles: string[]
  color?: string
  highlight?: string
  /** "14" in pt, "+2"/"-1" relativa in pt, "80%" in percentuale */
  size?: string
  font?: string
  weight?: number
  italic?: boolean
  underline?: boolean
  strike?: boolean
  script?: 'sup' | 'sub'
  /** Colore e spessore in mm o in % della dimensione del testo */
  stroke?: { color: string; width: number | string }
  /** ‰ della dimensione */
  spacing?: number
  /** pt sopra la linea di base */
  raise?: number
  transform?: 'upper' | 'lower' | 'smallcaps'
  /** Il testo non va a capo dentro questa porzione */
  nowrap?: boolean
  // riquadro in linea
  border?: { color: string; width: number }
  fill?: string
  /** mm, oppure 'round' per una pillola */
  radius?: number | 'round'
  /** mm, verticale e orizzontale */
  pad?: [number, number]
  bg?: string
  bgColor?: string
  /** "140%" rispetto alla riga, oppure mm */
  bgSize?: string
  /** pt: sposta solo il testo dentro il riquadro, non il riquadro */
  textRaise?: number
  // solo per i paragrafi
  align?: HAlign
}

export type Inline =
  | { t: 'text'; text: string }
  | { t: 'br' }
  | { t: 'span'; attrs: Attrs; children: Inline[] }
  /**
   * {nome}, {nome*3} o {nome tint=red rotate=90}: variabile, campo o immagine, risolta da chi
   * disegna; image sono gli attributi scritti dopo il nome
   */
  | { t: 'ref'; name: string; count: number; raw: string; image?: ImageSettings }

export type BlockKind = 'p' | 'h1' | 'h2' | 'note' | 'bullet' | 'number' | 'rule'

export interface Block {
  kind: BlockKind
  /** Numero della voce negli elenchi numerati */
  number?: number
  attrs: Attrs
  children: Inline[]
}

export interface MarkupProblem {
  message: Message
  /** Posizione nel testo sorgente */
  from: number
  to: number
}

export interface ParsedMarkup {
  blocks: Block[]
  problems: MarkupProblem[]
}

/** Forme disponibili per bg= senza definire variabili */
export const BUILTIN_SHAPES = ['circle', 'square', 'rounded', 'hexagon', 'diamond'] as const

/** Stili presenti in ogni progetto: si usano con #, ## e > oppure con .nome */
export const BUILTIN_STYLES: Record<string, string> = {
  heading1: 'size=150% weight=800',
  heading2: 'size=125% weight=700',
  note: 'size=90% italic'
}

const ALIGNS = ['left', 'center', 'right', 'justify'] as const

/** Attributi riconosciuti, con il tipo di valore: per il parser e per l'aiuto alla scrittura */
export const ATTRIBUTES = {
  color: 'color',
  highlight: 'color',
  size: 'size',
  font: 'text',
  weight: 'number',
  stroke: 'stroke',
  spacing: 'number',
  raise: 'number',
  border: 'border',
  fill: 'color',
  radius: 'radius',
  pad: 'pad',
  bg: 'image',
  'bg-color': 'color',
  'bg-size': 'size',
  'text-raise': 'number',
  // parole senza valore
  bold: 'flag',
  italic: 'flag',
  underline: 'flag',
  strike: 'flag',
  upper: 'flag',
  lower: 'flag',
  smallcaps: 'flag',
  nowrap: 'flag',
  left: 'flag',
  center: 'flag',
  right: 'flag',
  justify: 'flag'
} as const

export type AttributeName = keyof typeof ATTRIBUTES

const num = (s: string): number | null => {
  const n = Number(s.trim().replace(',', '.'))
  return s.trim() !== '' && Number.isFinite(n) ? n : null
}

/** Dimensione: 14, +2, -1, 80% */
const isSize = (s: string): boolean => /^[+-]?\d+([.,]\d+)?%?$/.test(s)

/**
 * Legge il contenuto delle graffe di un attributo, per esempio ".keyword color=red size=+2".
 * `offset` è la posizione del contenuto nel testo, per indicare dove sta un errore.
 */
export function parseAttrs(src: string, offset = 0): { attrs: Attrs; problems: MarkupProblem[] } {
  const attrs: Attrs = { styles: [] }
  const problems: MarkupProblem[] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    const token = m[0]
    const from = offset + m.index
    const to = from + token.length
    const bad = (key: string, params?: Record<string, string>): void => {
      problems.push({ message: msg(key, params), from, to })
    }
    if (token.startsWith('.')) {
      if (token.length > 1) attrs.styles.push(token.slice(1))
      else bad('markup.emptyStyle')
      continue
    }
    const eq = token.indexOf('=')
    const key = (eq < 0 ? token : token.slice(0, eq)).toLowerCase()
    const value = eq < 0 ? '' : token.slice(eq + 1)
    if (!(key in ATTRIBUTES)) {
      bad('markup.unknownAttribute', { name: key })
      continue
    }
    const kind = ATTRIBUTES[key as AttributeName]
    if (kind === 'flag') {
      if (eq >= 0) bad('markup.noValue', { name: key })
      if (key === 'bold') attrs.weight = 700
      else if (key === 'italic') attrs.italic = true
      else if (key === 'underline') attrs.underline = true
      else if (key === 'strike') attrs.strike = true
      else if (key === 'upper' || key === 'lower' || key === 'smallcaps') attrs.transform = key
      else if (key === 'nowrap') attrs.nowrap = true
      else attrs.align = key as HAlign
      continue
    }
    if (eq < 0 || value === '') {
      bad('markup.missingValue', { name: key })
      continue
    }
    const invalid = (): void => bad('markup.invalidValue', { name: key, value })
    switch (key) {
      case 'color':
        attrs.color = value
        break
      case 'highlight':
        attrs.highlight = value
        break
      case 'fill':
        attrs.fill = value
        break
      case 'bg-color':
        attrs.bgColor = value
        break
      case 'font':
        // nei nomi con spazi si usa _ al posto dello spazio: font=Open_Sans
        attrs.font = value.replace(/_/g, ' ')
        break
      case 'bg':
        attrs.bg = value
        break
      case 'size':
      case 'bg-size':
        if (!isSize(value)) invalid()
        else if (key === 'size') attrs.size = value.replace(',', '.')
        else attrs.bgSize = value.replace(',', '.')
        break
      case 'weight': {
        const n = num(value)
        if (n === null || n < 100 || n > 1000) invalid()
        else attrs.weight = n
        break
      }
      case 'spacing':
      case 'raise':
      case 'text-raise': {
        const n = num(value)
        if (n === null) invalid()
        else if (key === 'spacing') attrs.spacing = n
        else if (key === 'raise') attrs.raise = n
        else attrs.textRaise = n
        break
      }
      case 'stroke':
      case 'border': {
        const [color, w] = value.split('/')
        const width = w === undefined ? 0.3 : w.endsWith('%') && key === 'stroke' ? w : num(w)
        if (!color || width === null || (typeof width === 'string' && !isSize(width))) invalid()
        else if (key === 'stroke') attrs.stroke = { color, width }
        else attrs.border = { color, width: width as number }
        break
      }
      case 'radius': {
        const n = value === 'round' ? 'round' : num(value)
        if (n === null) invalid()
        else attrs.radius = n
        break
      }
      case 'pad': {
        const parts = value.split('/').map(num)
        if (parts.length > 2 || parts.some((p) => p === null)) invalid()
        else attrs.pad = [parts[0]!, parts[1] ?? parts[0]!]
        break
      }
    }
  }
  return { attrs, problems }
}

/** Le graffe a inizio riga sono attributi del paragrafo se ogni parola lo sembra */
function looksLikeAttrs(src: string): boolean {
  const tokens = src.trim().split(/\s+/)
  return (
    tokens.length > 0 &&
    tokens[0] !== '' &&
    tokens.every(
      (tk) => tk.startsWith('.') || tk.includes('=') || (ALIGNS as readonly string[]).includes(tk)
    )
  )
}

/** Il riquadro in linea: presente se c'è almeno uno degli attributi che lo disegnano */
export const isBox = (a: Attrs): boolean =>
  !!(a.border || a.fill || a.bg || a.pad || a.radius !== undefined)

/** Delimitatori Markdown in ordine di prova: i doppi prima dei singoli */
const DELIMS: { d: string; apply: Partial<Attrs>; tight?: boolean }[] = [
  { d: '**', apply: { weight: 700 } },
  { d: '++', apply: { underline: true } },
  { d: '~~', apply: { strike: true } },
  { d: '==', apply: {} },
  { d: '*', apply: { italic: true } },
  { d: '^', apply: { script: 'sup' }, tight: true },
  { d: '~', apply: { script: 'sub' }, tight: true },
  // _4{pp}_: una porzione che non va mai a capo, come [4{pp}]{nowrap}
  { d: '_', apply: { nowrap: true } }
]

/** Colore di evidenziazione del progetto per ==testo== */
export const DEFAULT_HIGHLIGHT = '#FFE58F'

/** Un _ dentro una parola (nome_file) resta testo */
const WORD = /[\p{L}\p{N}]/u

/** Un a capo scritto <br>, <br/> o <br /> */
const BR = /^<br\s*\/?>/i
const ESCAPABLE = '\\{}[]*~^=+#>-._<'

class InlineParser {
  problems: MarkupProblem[] = []
  constructor(private s: string) {}

  /** Analizza s[from, to) */
  parse(from: number, to: number): Inline[] {
    const out: Inline[] = []
    let text = ''
    const flush = (): void => {
      if (text) out.push({ t: 'text', text })
      text = ''
    }
    const s = this.s
    let i = from
    while (i < to) {
      const c = s[i]
      if (c === '\\' && s[i + 1] === '\n') {
        flush()
        out.push({ t: 'br' })
        i += 2
        continue
      }
      if (c === '\\' && i + 1 < to && ESCAPABLE.includes(s[i + 1])) {
        text += s[i + 1]
        i += 2
        continue
      }
      if (c === '\n') {
        flush()
        out.push({ t: 'br' })
        i++
        continue
      }
      // <br> va a capo dove il testo sta su una riga sola: celle delle tabelle dei documenti,
      // etichette delle anatomie, testi degli schemi; è l'unico pezzo di HTML che si legge
      if (c === '<') {
        const br = BR.exec(s.slice(i, Math.min(to, i + 8)))
        if (br) {
          flush()
          out.push({ t: 'br' })
          i += br[0].length
          continue
        }
      }
      if (c === '[') {
        const close = this.matching(i, to, '[', ']')
        if (close > 0 && s[close + 1] === '{') {
          const end = this.matching(close + 1, to, '{', '}')
          if (end > 0) {
            flush()
            const { attrs, problems } = parseAttrs(s.slice(close + 2, end), close + 2)
            this.problems.push(...problems)
            out.push({ t: 'span', attrs, children: this.parse(i + 1, close) })
            i = end + 1
            continue
          }
        }
      }
      if (c === '{') {
        const end = this.matching(i, to, '{', '}')
        if (end > 0) {
          flush()
          out.push(this.ref(i, end))
          i = end + 1
          continue
        }
        this.problems.push({ message: msg('markup.unclosedBrace'), from: i, to: i + 1 })
      }
      const delim = DELIMS.find(
        (d) => s.startsWith(d.d, i) && !(d.d === '_' && WORD.test(s[i - 1] ?? ''))
      )
      if (delim) {
        const close = this.closer(delim.d, i + delim.d.length, to, !!delim.tight)
        if (close > 0) {
          flush()
          const attrs: Attrs = { styles: [], ...delim.apply }
          if (delim.d === '==') attrs.highlight = DEFAULT_HIGHLIGHT
          out.push({ t: 'span', attrs, children: this.parse(i + delim.d.length, close) })
          i = close + delim.d.length
          continue
        }
        // un delimitatore senza chiusura resta com'è
        text += delim.d
        i += delim.d.length
        continue
      }
      text += c
      i++
    }
    flush()
    return out
  }

  private ref(open: number, close: number): Inline {
    const raw = this.s.slice(open, close + 1)
    let inner = this.s.slice(open + 1, close).trim()
    // attributi dell'immagine dopo il nome: {spada*2 tint=red}
    let image: ImageSettings | undefined
    const space = inner.search(/\s/)
    const attrs = space > 0 ? parseImageAttrs(inner.slice(space)) : null
    if (attrs) {
      inner = inner.slice(0, space)
      image = attrs.settings
      for (const a of attrs.bad)
        this.problems.push({
          message: msg('markup.badImageAttr', { text: a }),
          from: open,
          to: close + 1
        })
    }
    const star = inner.indexOf('*')
    const name = (star < 0 ? inner : inner.slice(0, star)).trim()
    let count = 1
    if (star >= 0) {
      const n = num(inner.slice(star + 1))
      if (n === null || n < 0) {
        this.problems.push({
          message: msg('markup.badRepeat', { text: raw }),
          from: open,
          to: close + 1
        })
      } else count = Math.min(50, Math.floor(n))
    }
    if (!name) this.problems.push({ message: msg('markup.emptyRef'), from: open, to: close + 1 })
    return image ? { t: 'ref', name, count, raw, image } : { t: 'ref', name, count, raw }
  }

  /** Parentesi di chiusura corrispondente, tenendo conto di annidamenti ed escape */
  private matching(open: number, to: number, o: string, c: string): number {
    let depth = 0
    for (let i = open; i < to; i++) {
      const ch = this.s[i]
      if (ch === '\\') {
        i++
        continue
      }
      if (ch === '\n' && o === '{') return -1
      if (ch === o) depth++
      else if (ch === c && --depth === 0) return i
    }
    return -1
  }

  /**
   * Chiusura di un delimitatore Markdown: il contenuto non comincia né finisce con uno spazio
   * (così "3 * 4 * 5" resta testo) e, per apice e pedice, non ne contiene.
   */
  private closer(d: string, start: number, to: number, tight: boolean): number {
    const s = this.s
    if (start >= to || /\s/.test(s[start])) return -1
    for (let i = start; i < to; i++) {
      const ch = s[i]
      if (ch === '\\') {
        i++
        continue
      }
      if (ch === '\n' || (tight && /\s/.test(ch))) return -1
      // si saltano le parti tra parentesi: [a*b]{...} non chiude un corsivo esterno
      if (ch === '[' || ch === '{') {
        const end = this.matching(i, to, ch, ch === '[' ? ']' : '}')
        if (end > 0) {
          i = end
          continue
        }
      }
      if (
        s.startsWith(d, i) &&
        i > start &&
        !/\s/.test(s[i - 1]) &&
        !(d === '_' && WORD.test(s[i + 1] ?? ''))
      ) {
        // un * singolo non chiude su un ** (che è un grassetto interno)
        if (d.length === 1 && (s[i + 1] === d || s[i - 1] === d)) {
          if (s[i + 1] === d) i++
          continue
        }
        return i
      }
    }
    return -1
  }
}

/**
 * Analizza un testo come un'unica riga, senza riconoscere titoli, elenchi e citazioni a inizio
 * riga: serve dove i blocchi li ha già divisi qualcun altro (i documenti, model/document.ts)
 */
export function parseInline(src: string): { children: Inline[]; problems: MarkupProblem[] } {
  const parser = new InlineParser(src)
  const children = parser.parse(0, src.length)
  return { children, problems: parser.problems }
}

/** Analizza il testo di un livello in paragrafi */
export function parseMarkup(src: string): ParsedMarkup {
  const blocks: Block[] = []
  const problems: MarkupProblem[] = []
  const parser = new InlineParser(src)
  let numbering = 0
  let pos = 0
  const lines = src.split('\n')
  for (let li = 0; li < lines.length; li++) {
    const start = pos
    // "\" a fine riga: a capo nello stesso paragrafo
    let end = start + lines[li].length
    while (endsWithBreak(src, start, end) && li + 1 < lines.length) {
      li++
      end += 1 + lines[li].length
    }
    pos = end + 1
    let i = start
    const block: Block = { kind: 'p', attrs: { styles: [] }, children: [] }
    // attributi del paragrafo: {.flavor center} a inizio riga
    if (src[i] === '{') {
      const close = src.indexOf('}', i)
      if (close > 0 && close < end && looksLikeAttrs(src.slice(i + 1, close))) {
        const r = parseAttrs(src.slice(i + 1, close), i + 1)
        block.attrs = r.attrs
        problems.push(...r.problems)
        i = close + 1
        while (src[i] === ' ') i++
      }
    }
    const rest = src.slice(i, end)
    let m: RegExpMatchArray | null
    if (/^-{3,}\s*$/.test(rest)) {
      block.kind = 'rule'
      blocks.push(block)
      numbering = 0
      continue
    } else if ((m = rest.match(/^(#{1,2}) +/))) {
      block.kind = m[1].length === 1 ? 'h1' : 'h2'
      i += m[0].length
    } else if ((m = rest.match(/^> ?/))) {
      block.kind = 'note'
      i += m[0].length
    } else if ((m = rest.match(/^[-*•] +/))) {
      block.kind = 'bullet'
      i += m[0].length
    } else if ((m = rest.match(/^(\d+)[.)] +/))) {
      block.kind = 'number'
      numbering = numbering ? numbering + 1 : Number(m[1])
      block.number = numbering
      i += m[0].length
    }
    if (block.kind !== 'number') numbering = 0
    block.children = parser.parse(i, end)
    blocks.push(block)
  }
  problems.push(...parser.problems)
  problems.sort((a, b) => a.from - b.from)
  return { blocks, problems }
}

function endsWithBreak(src: string, start: number, end: number): boolean {
  if (end <= start || src[end - 1] !== '\\') return false
  // "\\" a fine riga è una barra letterale
  let n = 0
  for (let i = end - 1; i >= start && src[i] === '\\'; i--) n++
  return n % 2 === 1
}

/** Unisce gli attributi: quelli di `top` prevalgono */
export function mergeAttrs(base: Attrs, top: Attrs): Attrs {
  const out: Attrs = { ...base }
  for (const [k, v] of Object.entries(top)) {
    if (k === 'styles') continue
    if (v !== undefined) (out as unknown as Record<string, unknown>)[k] = v
  }
  out.styles = [...base.styles, ...top.styles]
  return out
}

/** Stile dei paragrafi creati con #, ## e > */
export const BLOCK_STYLE: Partial<Record<BlockKind, string>> = {
  h1: 'heading1',
  h2: 'heading2',
  note: 'note'
}

/**
 * Risolve gli stili (.nome) di un insieme di attributi, ricorsivamente: uno stile può usarne
 * altri. Gli attributi scritti accanto allo stile prevalgono su quelli dello stile.
 */
export function resolveStyles(
  a: Attrs,
  styles: Record<string, string>,
  missing?: (name: string) => void,
  seen: Set<string> = new Set()
): Attrs {
  if (!a.styles.length) return a
  let base: Attrs = { styles: [] }
  for (const name of a.styles) {
    const def = styles[name] ?? BUILTIN_STYLES[name]
    if (def === undefined || seen.has(name)) {
      if (def === undefined) missing?.(name)
      continue
    }
    const parsed = resolveStyles(parseAttrs(def).attrs, styles, missing, new Set([...seen, name]))
    base = mergeAttrs(base, parsed)
  }
  return { ...mergeAttrs(base, { ...a, styles: [] }), styles: [] }
}

/** Problemi del markup che non dipendono dal progetto, più gli stili sconosciuti */
export function markupProblems(
  src: string,
  styles: Record<string, string> = {},
  /** Campi della carta: nel testo ancora da compilare {icona*campo} è corretto */
  fields: string[] = []
): MarkupProblem[] {
  const { blocks, problems } = parseMarkup(src)
  const out = problems.filter((p) => {
    if (p.message.key !== 'markup.badRepeat') return true
    const inner = src.slice(p.from + 1, p.to - 1)
    return !fields.includes(inner.slice(inner.indexOf('*') + 1).trim())
  })
  const check = (a: Attrs): void =>
    a.styles.forEach((name) => {
      if (!(name in styles) && !(name in BUILTIN_STYLES)) {
        const at = src.indexOf('.' + name)
        out.push({
          message: msg('markup.unknownStyle', { name }),
          from: at,
          to: at + name.length + 1
        })
      }
    })
  const walk = (list: Inline[]): void =>
    list.forEach((n) => {
      if (n.t === 'span') {
        check(n.attrs)
        walk(n.children)
      }
    })
  blocks.forEach((b) => {
    check(b.attrs)
    walk(b.children)
  })
  return out.sort((a, b) => a.from - b.from)
}

/** Nomi richiamati con {nome} nel testo */
export function markupRefs(src: string): string[] {
  const names: string[] = []
  const walk = (list: Inline[]): void =>
    list.forEach((n) => {
      if (n.t === 'ref') names.push(n.name)
      else if (n.t === 'span') walk(n.children)
    })
  parseMarkup(src).blocks.forEach((b) => walk(b.children))
  return names
}

/** Testo senza markup, per etichette e ricerche */
export function plainText(src: string): string {
  const walk = (list: Inline[]): string =>
    list
      .map((n) =>
        n.t === 'text' ? n.text : n.t === 'br' ? ' ' : n.t === 'span' ? walk(n.children) : n.raw
      )
      .join('')
  return parseMarkup(src)
    .blocks.map((b) => walk(b.children))
    .join('\n')
}

const fmtNum = (n: number): string => String(Math.round(n * 1000) / 1000)

/** Attributi come si scrivono tra graffe: l'inverso di parseAttrs */
export function serializeAttrs(a: Attrs): string {
  const out: string[] = a.styles.map((s) => '.' + s)
  const kv = (k: string, v: string | number | undefined): void => {
    if (v !== undefined && v !== '') out.push(`${k}=${v}`)
  }
  kv('color', a.color)
  kv('highlight', a.highlight)
  kv('size', a.size)
  kv('font', a.font?.replace(/ /g, '_'))
  if (a.weight === 700) out.push('bold')
  else kv('weight', a.weight)
  if (a.italic) out.push('italic')
  if (a.underline) out.push('underline')
  if (a.strike) out.push('strike')
  if (a.transform) out.push(a.transform)
  if (a.stroke)
    kv(
      'stroke',
      `${a.stroke.color}/${typeof a.stroke.width === 'number' ? fmtNum(a.stroke.width) : a.stroke.width}`
    )
  kv('spacing', a.spacing)
  kv('raise', a.raise)
  if (a.border) kv('border', `${a.border.color}/${fmtNum(a.border.width)}`)
  kv('fill', a.fill)
  kv('radius', typeof a.radius === 'number' ? fmtNum(a.radius) : a.radius)
  if (a.pad)
    kv('pad', a.pad[0] === a.pad[1] ? fmtNum(a.pad[0]) : `${fmtNum(a.pad[0])}/${fmtNum(a.pad[1])}`)
  kv('bg', a.bg)
  kv('bg-color', a.bgColor)
  kv('bg-size', a.bgSize)
  kv('text-raise', a.textRaise)
  if (a.align) out.push(a.align)
  return out.join(' ')
}

/** Porzione [testo]{attributi} nel sorgente: posizioni di inizio e fine delle sue parti */
export interface SpanRange {
  start: number
  /** Testo tra le quadre */
  textFrom: number
  textTo: number
  /** Contenuto delle graffe */
  attrsFrom: number
  attrsTo: number
  end: number
}

/** La porzione [testo]{...} più interna che contiene la selezione, se c'è */
export function spanAt(src: string, from: number, to: number): SpanRange | null {
  const match = (open: number, o: string, c: string): number => {
    let depth = 0
    for (let i = open; i < src.length; i++) {
      const ch = src[i]
      if (ch === '\\') {
        i++
        continue
      }
      if (ch === o) depth++
      else if (ch === c && --depth === 0) return i
    }
    return -1
  }
  let best: SpanRange | null = null
  for (let i = 0; i <= from && i < src.length; i++) {
    if (src[i] !== '[' || src[i - 1] === '\\') continue
    const close = match(i, '[', ']')
    if (close < 0 || src[close + 1] !== '{') continue
    const end = match(close + 1, '{', '}')
    if (end < 0 || to > end + 1) continue
    best = {
      start: i,
      textFrom: i + 1,
      textTo: close,
      attrsFrom: close + 2,
      attrsTo: end,
      end: end + 1
    }
  }
  return best
}
