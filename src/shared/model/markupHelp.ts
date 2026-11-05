import { NAMED_COLORS } from './colors'
import { IMAGE_ATTRIBUTES, hasParameters, type Variables } from './variables'
import { SYSTEM_VARIABLES } from './system'
import { ATTRIBUTES, BUILTIN_SHAPES, BUILTIN_STYLES, type AttributeName } from './markup'

// Aiuto alla scrittura del markup (docs/specifica.md, 2.1): cosa proporre dove si trova il cursore.

export type SuggestionKind =
  'attribute' | 'style' | 'color' | 'shape' | 'image' | 'field' | 'value' | 'variable' | 'system'

export interface Suggestion {
  kind: SuggestionKind
  /** Testo mostrato ed eventualmente inserito */
  label: string
  /** Testo che sostituisce la parola sotto il cursore */
  insert: string
  /** Dopo l'inserimento si continua a proporre (per esempio i valori dopo "color=") */
  more?: boolean
  /** Attributo: chiave della spiegazione di una riga */
  attribute?: AttributeName | `image.${ImageAttributeName}`
  /** Colore del campione, se diverso dall'etichetta (colori del progetto) */
  swatch?: string
}

export interface SuggestionResult {
  /** Parte del testo che l'inserimento sostituisce */
  from: number
  to: number
  items: Suggestion[]
}

export interface HelpContext {
  /** Campi della carta: livelli e colonne */
  fields: string[]
  /** File in assets/ */
  assets: string[]
  /** Stili del progetto */
  styles: string[]
  /** Variabili del progetto */
  variables?: Variables
}

type ImageAttributeName = keyof typeof IMAGE_ATTRIBUTES

const MAX = 40

/** Ordine: prima ciò che comincia con quanto scritto, poi ciò che lo contiene */
function rank<T extends { label: string }>(items: T[], typed: string): T[] {
  const q = typed.toLowerCase()
  // a parità di inizio prima le parole più corte: "re" propone red prima di rebeccapurple
  const starts = items
    .filter((i) => i.label.toLowerCase().startsWith(q))
    .sort((a, b) => (q ? a.label.length - b.label.length : 0))
  const contains = q
    ? items.filter((i) => !i.label.toLowerCase().startsWith(q) && i.label.toLowerCase().includes(q))
    : []
  return [...starts, ...contains].slice(0, MAX)
}

/** Nome di un'immagine come si scrive: senza cartella né estensione */
const imageName = (path: string): string => {
  const base = path.slice(path.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(0, dot) : base
}

const unique = (list: string[]): string[] => [...new Set(list)].sort((a, b) => a.localeCompare(b))

/**
 * Suggerimenti per il cursore in `pos`: attributi e valori dentro le graffe dopo "]" o a inizio
 * riga, campi e immagini dentro le altre graffe. Null se il cursore non è dentro graffe aperte.
 */
export function suggestAt(text: string, pos: number, ctx: HelpContext): SuggestionResult | null {
  const lineStart = text.lastIndexOf('\n', pos - 1) + 1
  // graffa aperta prima del cursore, sulla stessa riga e non ancora chiusa
  let open = -1
  for (let i = pos - 1; i >= lineStart; i--) {
    const c = text[i]
    if (c === '}') return null
    if (c === '{' && text[i - 1] !== '\\') {
      open = i
      break
    }
  }
  if (open < 0) return null
  // la parola sotto il cursore arriva fino al primo spazio o alla graffa che chiude
  let end = pos
  while (end < text.length && !/[\s{}]/.test(text[end])) end++
  const isAttr = text[open - 1] === ']'
  const atLineStart = open === lineStart

  let from = pos
  while (from > open + 1 && !/\s/.test(text[from - 1])) from--
  const token = text.slice(from, pos)

  if (!isAttr && !atLineStart) return refs(text, open, pos, end, ctx)
  if (
    atLineStart &&
    !isAttr &&
    from === open + 1 &&
    !token.startsWith('.') &&
    !token.includes('=')
  ) {
    // a inizio riga possono essere attributi del paragrafo o una variabile: si propone tutto
    const r = refs(text, open, pos, end, ctx)
    const a = attributes(token, ctx, true)
    return { from, to: end, items: [...a, ...r.items].slice(0, MAX) }
  }
  if (token.startsWith('.')) return { from, to: end, items: styles(token.slice(1), ctx) }
  const eq = token.indexOf('=')
  if (eq < 0) return { from, to: end, items: attributes(token, ctx, atLineStart) }
  return {
    from: from + eq + 1,
    to: end,
    items: values(token.slice(0, eq), token.slice(eq + 1), ctx)
  }
}

function refs(
  text: string,
  open: number,
  pos: number,
  end: number,
  ctx: HelpContext
): SuggestionResult {
  const typed = text.slice(open + 1, pos)
  // dopo il nome: attributi dell'immagine, {spada tint=red}
  const space = typed.search(/\s/)
  if (space > 0) return imageAttributes(text, open + 1 + space, pos, end, ctx)
  const star = typed.indexOf('*')
  // dopo l'asterisco: il numero di ripetizioni, anche da un campo
  if (star >= 0) {
    const items = unique(ctx.fields).map((f) => ({ kind: 'field' as const, label: f, insert: f }))
    return { from: open + 2 + star, to: end, items: rank(items, typed.slice(star + 1)) }
  }
  const close = text[end] === '}' ? '' : '}'
  const fields = unique(ctx.fields).map((f): Suggestion => ({
    kind: 'field',
    label: f,
    insert: f + close
  }))
  const fieldSet = new Set(ctx.fields)
  const vars = Object.entries(ctx.variables ?? {})
    .filter(([n, v]) => v.type !== 'color' && !fieldSet.has(n))
    .map(([n]) => n)
  // una variabile di testo con {1}, {2} chiede i parametri: si scrive {raccogli:2}
  const varItems = unique(vars).map((n): Suggestion => {
    const v = ctx.variables?.[n]
    return v?.type === 'text' && hasParameters(v.text)
      ? { kind: 'variable', label: `${n}:…`, insert: `${n}:` }
      : { kind: 'variable', label: n, insert: n + close }
  })
  // le variabili di sistema solo dopo il primo carattere: altrimenti coprono campi e variabili
  const system = typed.trim()
    ? SYSTEM_VARIABLES.filter((n) => !fieldSet.has(n)).map((n): Suggestion => ({
        kind: 'system',
        label: n,
        insert: n + close
      }))
    : []
  const taken = new Set([...ctx.fields, ...vars])
  const images = unique(ctx.assets.map(imageName))
    .filter((n) => !taken.has(n))
    .map((n): Suggestion => ({ kind: 'image', label: n, insert: n + close }))
  return {
    from: open + 1,
    to: end,
    items: rank([...fields, ...varItems, ...system, ...images], typed.trim())
  }
}

function imageAttributes(
  text: string,
  start: number,
  pos: number,
  end: number,
  ctx: HelpContext
): SuggestionResult {
  let from = pos
  while (from > start && !/\s/.test(text[from - 1])) from--
  const token = text.slice(from, pos)
  const eq = token.indexOf('=')
  if (eq < 0) {
    const names = Object.keys(IMAGE_ATTRIBUTES) as ImageAttributeName[]
    const items = names.map((n): Suggestion => ({
      kind: 'attribute',
      label: `${n}=`,
      insert: `${n}=`,
      more: true,
      attribute: `image.${n}`
    }))
    return { from, to: end, items: rank(items, token) }
  }
  const key = token.slice(0, eq) as ImageAttributeName
  const typed = token.slice(eq + 1)
  const list = (values: string[]): Suggestion[] =>
    rank(
      values.map((v): Suggestion => ({ kind: 'value', label: v, insert: v })),
      typed
    )
  const items =
    key === 'tint'
      ? [...list(['none', 'currentColor']), ...values('color', typed, ctx)]
      : key === 'flip'
        ? list(['h', 'v', 'hv', 'none'])
        : key === 'size'
          ? list(['80%', '120%', '150%', '200%'])
          : key === 'rotate'
            ? list(['90', '180', '-90', '45'])
            : key === 'opacity'
              ? list(['25%', '50%', '75%'])
              : []
  return { from: from + eq + 1, to: end, items }
}

function attributes(typed: string, ctx: HelpContext, paragraph: boolean): Suggestion[] {
  const names = Object.keys(ATTRIBUTES) as AttributeName[]
  const items = names
    .filter((n) => paragraph || !['left', 'center', 'right', 'justify'].includes(n))
    .map((n): Suggestion =>
      ATTRIBUTES[n] === 'flag'
        ? { kind: 'attribute', label: n, insert: n, attribute: n }
        : { kind: 'attribute', label: `${n}=`, insert: `${n}=`, more: true, attribute: n }
    )
  // gli stili si scrivono con il punto: si propongono anche senza averlo scritto
  const st = typed ? [] : styles('', ctx).slice(0, 8)
  return [...rank(items, typed), ...st]
}

function styles(typed: string, ctx: HelpContext): Suggestion[] {
  const names = unique([...Object.keys(BUILTIN_STYLES), ...ctx.styles])
  return rank(
    names.map((n): Suggestion => ({ kind: 'style', label: `.${n}`, insert: `.${n}` })),
    '.' + typed
  )
}

const COLOR_ITEMS = NAMED_COLORS.map((c): Suggestion => ({ kind: 'color', label: c, insert: c }))

function values(key: string, typed: string, ctx: HelpContext): Suggestion[] {
  const kind = ATTRIBUTES[key as AttributeName]
  // colore/spessore: dopo la barra non c'è altro da proporre
  if (typed.includes('/')) return []
  switch (kind) {
    case 'color':
    case 'stroke':
    case 'border': {
      // prima i colori del progetto, che possono anche ridefinire un nome standard
      const own = Object.entries(ctx.variables ?? {}).flatMap(([n, v]) =>
        v.type === 'color'
          ? [{ kind: 'variable' as const, label: n, insert: n, swatch: v.color }]
          : []
      )
      const names = new Set(own.map((o) => o.label))
      return rank([...own, ...COLOR_ITEMS.filter((c) => !names.has(c.label))], typed)
    }
    case 'image': {
      const shapes = BUILTIN_SHAPES.map((s): Suggestion => ({ kind: 'shape', label: s, insert: s }))
      const vars = Object.entries(ctx.variables ?? {})
        .filter(([, v]) => v.type === 'image')
        .map(([n]): Suggestion => ({ kind: 'variable', label: n, insert: n }))
      const taken = new Set(vars.map((v) => v.label))
      const images = unique(ctx.assets.map(imageName))
        .filter((n) => !taken.has(n))
        .map((n): Suggestion => ({ kind: 'image', label: n, insert: n }))
      return rank([...shapes, ...vars, ...images], typed)
    }
    case 'radius':
      return rank([{ kind: 'value', label: 'round', insert: 'round' }], typed)
    case 'size':
      return rank(
        ['+1', '+2', '-1', '-2', '80%', '120%'].map((v): Suggestion => ({
          kind: 'value',
          label: v,
          insert: v
        })),
        typed
      )
    case 'number':
      return key === 'weight'
        ? rank(
            ['400', '600', '700', '800', '900'].map((v): Suggestion => ({
              kind: 'value',
              label: v,
              insert: v
            })),
            typed
          )
        : []
    default:
      return []
  }
}
