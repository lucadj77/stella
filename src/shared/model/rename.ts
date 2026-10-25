import type { Sheet } from '../project'
import { splitLanguage } from './language'
import type { Template } from './template'
import type { Variables } from './variables'
import { walkLayers } from './normalize'

// Rinomina di una variabile o di uno stile in tutti i punti che li richiamano: testi con markup,
// proprietà dei livelli, formule, celle dei fogli, altre variabili e stili. Funzioni pure.

export type RefKind = 'variable' | 'style'

/** Attributi del markup il cui valore può essere una variabile colore o immagine */
const VALUE_KEYS = new Set([
  'color',
  'bg',
  'bg-color',
  'fill',
  'highlight',
  'tint',
  'border',
  'stroke'
])

/** Proprietà dei livelli che possono contenere solo il nome di una variabile, senza graffe */
const PLAIN_KEYS = new Set(['color', 'fill', 'tint', 'src'])

/** Il contenuto di una coppia di graffe: `spada*3 tint=red`, `.flavor center`, `color=rosso` */
function renameInBraces(
  inner: string,
  kind: RefKind,
  from: string,
  to: string,
  leadingName = true
): string {
  let first = leadingName
  return inner
    .split(/(\s+)/)
    .map((tok) => {
      if (!tok || /^\s+$/.test(tok)) return tok
      const isFirst = first
      first = false
      if (kind === 'style') return tok === `.${from}` ? `.${to}` : tok
      // {spada}, {spada*3}, {spada*forza}: il nome è all'inizio
      if (isFirst) {
        const star = tok.indexOf('*')
        const name = star < 0 ? tok : tok.slice(0, star)
        if (name === from) return to + (star < 0 ? '' : tok.slice(star))
      }
      // font={titoli} negli stili: senza graffe il valore è il nome di una famiglia
      if (tok === `font={${from}}`) return `font={${to}}`
      // color=rosso, border=rosso/0.3, bg=scudo
      const eq = tok.indexOf('=')
      if (eq > 0 && VALUE_KEYS.has(tok.slice(0, eq))) {
        const value = tok.slice(eq + 1)
        const slash = value.indexOf('/')
        const head = slash < 0 ? value : value.slice(0, slash)
        if (head === from) return tok.slice(0, eq + 1) + to + (slash < 0 ? '' : value.slice(slash))
      }
      return tok
    })
    .join('')
}

/** Rinomina i riferimenti dentro un testo con markup o una formula; `\{` resta letterale */
export function renameInText(text: string, kind: RefKind, from: string, to: string): string {
  if (!text.includes(from)) return text
  return text.replace(/(\\?)\{([^{}]*)\}/g, (all, esc: string, inner: string) =>
    esc ? all : `{${renameInBraces(inner, kind, from, to)}}`
  )
}

/** Un valore: per le proprietà colore e immagine vale anche il nome scritto senza graffe */
function renameValue(v: string, plain: boolean, kind: RefKind, from: string, to: string): string {
  if (plain && kind === 'variable' && v.trim() === from) return v.replace(from, to)
  return renameInText(v, kind, from, to)
}

/** Copia profonda di un oggetto con le stringhe rinominate; la chiave dice se il valore è "semplice" */
function renameDeep<T>(o: T, kind: RefKind, from: string, to: string, key = ''): T {
  if (typeof o === 'string') {
    if (key === 'style') return (kind === 'style' && o === from ? to : o) as T
    if (key === 'name' || key === 'id' || key === 'type') return o
    return renameValue(o, PLAIN_KEYS.has(key), kind, from, to) as T
  }
  if (Array.isArray(o)) {
    let changed = false
    const out = o.map((x) => {
      const y = renameDeep(x, kind, from, to, key)
      if (y !== x) changed = true
      return y
    })
    return (changed ? out : o) as T
  }
  if (o && typeof o === 'object') {
    let changed = false
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(o)) {
      const y = renameDeep(v, kind, from, to, k)
      if (y !== v) changed = true
      out[k] = y
    }
    return (changed ? out : o) as T
  }
  return o
}

/** Nomi dei campi del template: dove un campo ha il nome della variabile, {nome} è il campo */
const fieldNames = (t: Template): Set<string> =>
  new Set(walkLayers([...t.front, ...t.back]).map((l) => l.name))

export function renameInTemplate(t: Template, kind: RefKind, from: string, to: string): Template {
  if (kind === 'variable' && fieldNames(t).has(from)) return t
  const front = renameDeep(t.front, kind, from, to)
  const back = renameDeep(t.back, kind, from, to)
  return front === t.front && back === t.back ? t : { ...t, front, back }
}

/**
 * Celle di un foglio. Le colonne delle immagini e delle forme e quelle delle proprietà colore
 * (`nome.color`) accettano il nome della variabile anche senza graffe.
 */
export function renameInSheet(
  s: Sheet,
  t: Template | null,
  kind: RefKind,
  from: string,
  to: string
): Sheet {
  if (kind === 'variable' && (s.headers.includes(from) || (t && fieldNames(t).has(from)))) return s
  const plainLayers = new Set(
    t
      ? walkLayers([...t.front, ...t.back])
          .filter((l) => l.type === 'image' || l.type === 'shape' || l.type === 'grid')
          .map((l) => l.name)
      : []
  )
  // una colonna tradotta (nome@en) è come la sua colonna
  const plain = s.headers.map((header) => {
    const h = splitLanguage(header).base
    const dot = h.indexOf('.')
    if (dot < 0) return plainLayers.has(h)
    return PLAIN_KEYS.has(h.slice(dot + 1))
  })
  let changed = false
  const rows = s.rows.map((r) => {
    let rowChanged = false
    const out = r.map((c, i) => {
      const v = renameValue(c, plain[i], kind, from, to)
      if (v !== c) rowChanged = true
      return v
    })
    if (rowChanged) changed = true
    return rowChanged ? out : r
  })
  return changed ? { ...s, rows } : s
}

/**
 * Le altre variabili (testi che ne richiamano altre, colori scritti come un'altra variabile,
 * tinta e sfondo delle immagini) e gli stili (colori, stili di base). Il file di una variabile
 * immagine non si tocca: può avere lo stesso nome della variabile.
 */
export function renameInDefinitions(
  variables: Variables,
  styles: Record<string, string>,
  kind: RefKind,
  from: string,
  to: string
): { variables: Variables; styles: Record<string, string> } {
  const vars = Object.fromEntries(
    Object.entries(variables).map(([k, v]) => {
      if (v.type === 'text') return [k, { ...v, text: renameInText(v.text, kind, from, to) }]
      if (v.type === 'value') return [k, { ...v, value: renameInText(v.value, kind, from, to) }]
      if (v.type === 'color')
        return [k, { ...v, color: renameValue(v.color, true, kind, from, to) }]
      if (v.type === 'image') {
        // tinta e colore dello sfondo possono essere variabili colore, lo sfondo un'altra immagine
        const out = { ...v }
        if (v.tint) out.tint = renameValue(v.tint, true, kind, from, to)
        if (v.bgColor) out.bgColor = renameValue(v.bgColor, true, kind, from, to)
        if (v.bg) out.bg = renameValue(v.bg, true, kind, from, to)
        return [k, out]
      }
      return [k, v]
    })
  )
  return {
    variables: vars,
    styles: Object.fromEntries(
      Object.entries(styles).map(([k, def]) => [k, renameInBraces(def, kind, from, to, false)])
    )
  }
}
