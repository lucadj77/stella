import type { LoadedSet, ProjectNote } from '../project'
import { bindRow } from './bind'
import { BLOCK_STYLE, parseMarkup } from './markup'
import { walkLayers } from './normalize'
import type { Layer, Template } from './template'
import type { Variables } from './variables'

// Usi che la ricerca della rinomina (usages.ts) non vede, per la finestra «Gestisci il
// progetto»:
// - variabili che arrivano da un campo o da una formula: si lega ogni riga, come per le
//   immagini, e si guardano i valori che ne escono ({alfa}, o «alfa» da solo in un campo), più
//   i nomi tra virgolette nelle formule (=IF(...;"alfa";"beta"));
// - gli stili dei paragrafi creati con #, ## e > (heading1, heading2, note), nei testi dei
//   componenti e nelle note. I titoli dei documenti hanno le impostazioni del documento.
// Funzioni pure.

export interface ComputedProject {
  templates: Template[]
  sets: Pick<LoadedSet, 'name' | 'template' | 'data'>[]
  variables: Variables
  styles: Record<string, string>
  assets?: string[]
  notes?: ProjectNote[]
}

export interface ExtraUsage {
  templates: Set<string>
  /** Nome del set → numeri delle carte (da 1) */
  sets: Map<string, Set<number>>
  variables: Set<string>
  notes: Set<string>
}

const empty = (): ExtraUsage => ({
  templates: new Set(),
  sets: new Map(),
  variables: new Set(),
  notes: new Set()
})

/** Tutte le stringhe di un livello, tranne nome, id e tipo */
function strings(o: unknown, key = '', out: string[] = []): string[] {
  if (typeof o === 'string') {
    if (key !== 'name' && key !== 'id' && key !== 'type') out.push(o)
  } else if (Array.isArray(o)) o.forEach((x) => strings(x, key, out))
  else if (o && typeof o === 'object')
    for (const [k, v] of Object.entries(o)) if (k !== 'children') strings(v, k, out)
  return out
}

/** Nomi di variabile richiamati da un valore: {nome…}, il nome da solo, "nome" in una formula */
function variableRefs(text: string, names: Set<string>): string[] {
  const out = new Set<string>()
  const t = text.trim()
  if (names.has(t)) out.add(t)
  for (const m of text.matchAll(/(?<!\\)\{([^{}:*\s|=]+)/g)) if (names.has(m[1])) out.add(m[1])
  if (t.startsWith('='))
    for (const m of t.matchAll(/"([^"]+)"/g)) if (names.has(m[1].trim())) out.add(m[1].trim())
  return [...out]
}

/** Variabili che arrivano da campi e formule: per carta, legando ogni riga */
export function computedVariableUsages(
  p: ComputedProject,
  names: string[]
): Map<string, ExtraUsage> {
  const out = new Map(names.map((n) => [n, empty()]))
  const wanted = new Set(names)
  if (!wanted.size) return out
  const markLayers = (layers: Layer[], onRef: (name: string) => void): void => {
    for (const l of walkLayers(layers))
      for (const s of strings(l)) for (const n of variableRefs(s, wanted)) onRef(n)
  }
  // {nome} dove il template ha un campo con quel nome è il campo, non la variabile
  const fields = (t: Template): Set<string> =>
    new Set([...walkLayers([...t.front, ...t.back]).map((l) => l.name)])
  for (const t of p.templates) {
    const own = fields(t)
    markLayers([...t.front, ...t.back], (n) => {
      if (!own.has(n)) out.get(n)!.templates.add(t.name)
    })
  }
  for (const set of p.sets) {
    const tpl = p.templates.find((x) => x.name === set.template)
    if (!tpl || !set.data) continue
    const own = new Set([...fields(tpl), ...set.data.headers])
    set.data.rows.forEach((row, i) => {
      const mark = (n: string): void => {
        if (own.has(n)) return
        const sets = out.get(n)!.sets
        if (!sets.has(set.name)) sets.set(set.name, new Set())
        sets.get(set.name)!.add(i + 1)
      }
      for (const c of row) for (const n of variableRefs(c, wanted)) mark(n)
      const bound = bindRow(set.data!.headers, row, tpl, p.templates, {
        assets: p.assets ?? [],
        variables: p.variables,
        styles: p.styles
      })
      markLayers(
        [...bound.template.front, ...bound.template.back].filter((l) => l.visible),
        mark
      )
    })
  }
  return out
}

/** Stili dei paragrafi con #, ## e >: dove si scrivono paragrafi così */
export function blockStyleUsages(p: ComputedProject, names: string[]): Map<string, ExtraUsage> {
  const kinds = new Map(Object.entries(BLOCK_STYLE).map(([k, s]) => [s, k]))
  const out = new Map(names.filter((n) => kinds.has(n)).map((n) => [n, empty()]))
  if (!out.size) return out
  const used = (text: string): string[] => {
    if (!/(^|\n)\s*(\{[^}\n]*\}\s*)?(#|>)/.test(text)) return []
    const found = new Set<string>()
    for (const b of parseMarkup(text).blocks) {
      const s = BLOCK_STYLE[b.kind]
      if (s && out.has(s)) found.add(s)
    }
    return [...found]
  }
  const textsOf = (layers: Layer[]): string[] =>
    walkLayers(layers).flatMap((l) => (l.type === 'text' ? [l.text] : []))
  for (const t of p.templates)
    for (const s of textsOf([...t.front, ...t.back]).flatMap(used))
      out.get(s)!.templates.add(t.name)
  for (const set of p.sets) {
    const tpl = p.templates.find((x) => x.name === set.template)
    if (!set.data) continue
    const textCols = new Set(
      tpl
        ? walkLayers([...tpl.front, ...tpl.back]).flatMap((l) =>
            l.type === 'text' ? [l.name] : []
          )
        : []
    )
    set.data.rows.forEach((row, i) =>
      row.forEach((c, j) => {
        const h = set.data!.headers[j] ?? ''
        if (!textCols.has(h.replace(/@.*$/, ''))) return
        for (const s of used(c)) {
          const sets = out.get(s)!.sets
          if (!sets.has(set.name)) sets.set(set.name, new Set())
          sets.get(set.name)!.add(i + 1)
        }
      })
    )
  }
  for (const [name, v] of Object.entries(p.variables))
    if (v.type === 'text') for (const s of used(v.text)) out.get(s)!.variables.add(name)
  for (const n of p.notes ?? []) for (const s of used(n.text)) out.get(s)!.notes.add(n.name)
  return out
}
