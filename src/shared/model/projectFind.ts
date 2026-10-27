import type { LoadedSet, ProjectNote } from '../project'
import { findMatches, replaceMatches, type FindOptions, type TextMatch } from './findReplace'
import { patchLayer } from './edit'
import { walkLayers } from './normalize'
import type { Layer, Side, Template } from './template'
import type { Variables } from './variables'

// Cerca e sostituisci in tutto il progetto: documenti, note, celle dei fogli, testi e formule dei
// livelli, variabili di testo e valore. I nomi (set, template, livelli, colonne, variabili) non si
// toccano: per quelli c'è la rinomina, che aggiorna anche i riferimenti.

export type FindPlace =
  | { kind: 'document' | 'note'; name: string; line: number }
  | { kind: 'cell'; set: number; setName: string; row: number; column: string }
  | {
      kind: 'layer'
      template: string
      side: Side
      id: string
      layer: string
      prop: 'text' | 'value' | 'formula'
    }
  | { kind: 'variable'; name: string }

export interface FindHit {
  /** Unico nel risultato: serve a scegliere le occorrenze da sostituire */
  key: string
  place: FindPlace
  /** Il testo dove si è trovato (per documenti e note la riga) */
  text: string
  matches: TextMatch[]
}

export interface FindScope {
  documents: ProjectNote[]
  notes: ProjectNote[]
  sets: LoadedSet[]
  templates: Template[]
  variables: Variables
}

/** Le colonne che non sono testo da cercare: il nome del template e le copie */
const SKIPPED_COLUMNS = new Set(['template', 'amount'])

/** Il testo cercabile di un livello: il testo, il valore fisso o la formula */
function layerTexts(l: Layer): { prop: 'text' | 'value' | 'formula'; text: string }[] {
  const out: { prop: 'text' | 'value' | 'formula'; text: string }[] = []
  if (l.source.kind === 'formula') out.push({ prop: 'formula', text: l.source.expr })
  else if (l.type === 'text') out.push({ prop: 'text', text: l.text })
  else if (l.type === 'value') out.push({ prop: 'value', text: l.value })
  return out
}

/** Le occorrenze nel progetto, nell'ordine: documenti, note, fogli, template, variabili */
export function findInProject(scope: FindScope, query: string, o: FindOptions = {}): FindHit[] {
  if (!query) return []
  const out: FindHit[] = []
  const lines = (kind: 'document' | 'note', list: ProjectNote[]): void => {
    for (const d of list)
      d.text.split('\n').forEach((text, line) => {
        const matches = findMatches(text, query, o)
        if (matches.length)
          out.push({
            key: `${kind}:${d.name}:${line}`,
            place: { kind, name: d.name, line },
            text,
            matches
          })
      })
  }
  lines('document', scope.documents)
  lines('note', scope.notes)
  // un foglio usato da più set si cerca una volta
  const seen = new Set<string>()
  scope.sets.forEach((s, set) => {
    const data = s.data
    if (!data || seen.has(data.name)) return
    seen.add(data.name)
    data.rows.forEach((r, row) =>
      data.headers.forEach((column, c) => {
        if (SKIPPED_COLUMNS.has(column)) return
        const text = r[c] ?? ''
        const matches = findMatches(text, query, o)
        if (matches.length)
          out.push({
            key: `cell:${data.name}:${row}:${c}`,
            place: { kind: 'cell', set, setName: s.name, row, column },
            text,
            matches
          })
      })
    )
  })
  const byName = new Map(scope.templates.map((t) => [t.name, t]))
  for (const tpl of scope.templates) {
    const base = tpl.extends ? byName.get(tpl.extends) : undefined
    const inherited = base
      ? new Map(walkLayers([...base.front, ...base.back]).map((l) => [l.id, l]))
      : null
    for (const side of ['front', 'back'] as const)
      for (const l of walkLayers(tpl[side]))
        for (const { prop, text } of layerTexts(l)) {
          // un derivato che ha lo stesso testo del base lo eredita: si cambia nel base
          const b = inherited?.get(l.id)
          if (b && layerTexts(b).some((x) => x.prop === prop && x.text === text)) continue
          const matches = findMatches(text, query, o)
          if (matches.length)
            out.push({
              key: `layer:${tpl.name}:${l.id}:${prop}`,
              place: { kind: 'layer', template: tpl.name, side, id: l.id, layer: l.name, prop },
              text,
              matches
            })
        }
  }
  for (const [name, v] of Object.entries(scope.variables)) {
    const text = v.type === 'text' ? v.text : v.type === 'value' ? v.value : null
    if (text === null) continue
    const matches = findMatches(text, query, o)
    if (matches.length)
      out.push({ key: `variable:${name}`, place: { kind: 'variable', name }, text, matches })
  }
  return out
}

export interface ReplaceResult {
  /** Solo i documenti e le note che cambiano */
  documents: ProjectNote[]
  notes: ProjectNote[]
  /** Le liste intere, uguali (stesso oggetto) se non cambia niente */
  sets: LoadedSet[]
  templates: Template[]
  variables: Variables
  /** Occorrenze sostituite */
  count: number
}

/** Sostituisce le occorrenze dei risultati scelti */
export function replaceInProject(
  scope: FindScope,
  hits: FindHit[],
  replacement: string
): ReplaceResult {
  let count = 0
  const swap = (h: FindHit): string => {
    count += h.matches.length
    return replaceMatches(h.text, h.matches, replacement)
  }
  const texts = (kind: 'document' | 'note', list: ProjectNote[]): ProjectNote[] =>
    list.flatMap((d) => {
      const mine = hits.filter((h) => h.place.kind === kind && h.place.name === d.name)
      if (!mine.length) return []
      const rows = d.text.split('\n')
      for (const h of mine)
        if (h.place.kind === kind && rows[h.place.line] === h.text) rows[h.place.line] = swap(h)
      return [{ ...d, text: rows.join('\n') }]
    })
  const documents = texts('document', scope.documents)
  const notes = texts('note', scope.notes)

  let sets = scope.sets
  for (const h of hits) {
    if (h.place.kind !== 'cell') continue
    const { set, row, column } = h.place
    const data = sets[set]?.data
    const c = data ? data.headers.indexOf(column) : -1
    if (!data || c < 0 || (data.rows[row]?.[c] ?? '') !== h.text) continue
    const rows = data.rows.map((r, i) => (i === row ? r.map((x, j) => (j === c ? swap(h) : x)) : r))
    sets = sets.map((s, i) => (i === set ? { ...s, data: { ...data, rows } } : s))
  }

  let templates = scope.templates
  for (const h of hits) {
    if (h.place.kind !== 'layer') continue
    const p = h.place
    const i = templates.findIndex((t) => t.name === p.template)
    const l = i < 0 ? undefined : walkLayers(templates[i][p.side]).find((x) => x.id === p.id)
    if (!l || !layerTexts(l).some((x) => x.prop === p.prop && x.text === h.text)) continue
    const value = swap(h)
    const patch: Partial<Layer> =
      p.prop === 'formula'
        ? { source: { kind: 'formula', expr: value } }
        : p.prop === 'text'
          ? ({ text: value } as Partial<Layer>)
          : ({ value } as Partial<Layer>)
    const next = patchLayer(templates[i], p.side, p.id, patch)
    templates = templates.map((t, k) => (k === i ? next : t))
  }

  let variables = scope.variables
  for (const h of hits) {
    if (h.place.kind !== 'variable') continue
    const v = variables[h.place.name]
    if (v?.type === 'text' && v.text === h.text)
      variables = { ...variables, [h.place.name]: { ...v, text: swap(h) } }
    else if (v?.type === 'value' && v.value === h.text)
      variables = { ...variables, [h.place.name]: { ...v, value: swap(h) } }
  }
  return { documents, notes, sets, templates, variables, count }
}
