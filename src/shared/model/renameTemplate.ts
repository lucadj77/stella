import type { LoadedSet, ProjectFile, SetDefinition } from '../project'
import { renameInSpec } from './generate'
import { renameInOrder } from './order'
import type { Template } from './template'

// Rinomina di un template: il template (il file cambia nome al salvataggio, vedi
// Template.origin), i derivati che lo usano come base, i set e la colonna `template` delle carte,
// anche nelle impostazioni del generatore (Rigenera e generazioni salvate).
// Funzione pura.

export interface TemplateRename {
  templates: Template[]
  sets: LoadedSet[]
  file: ProjectFile
}

export function renameTemplate(p: TemplateRename, from: string, to: string): TemplateRename {
  const templates = p.templates.map((t) => {
    if (t.name === from) {
      const origin = t.origin ?? t.file ?? t.name
      const renamed: Template = { ...t, name: to, origin }
      delete renamed.file
      // tornando al nome del file sul disco non c'è più nulla da rinominare
      if (origin === to) delete renamed.origin
      return renamed
    }
    return t.extends === from ? { ...t, extends: to } : t
  })
  const sets = p.sets.map((s) => {
    const col = s.data?.headers.indexOf('template') ?? -1
    const data =
      s.data && col >= 0 && s.data.rows.some((r) => r[col]?.trim() === from)
        ? {
            ...s.data,
            rows: s.data.rows.map((r) =>
              r[col]?.trim() === from ? r.map((v, i) => (i === col ? to : v)) : r
            )
          }
        : s.data
    const gen = withGenerators(s, from, to)
    if (s.template !== from && data === s.data && gen === s) return s
    return { ...gen, template: s.template === from ? to : s.template, data }
  })
  return {
    templates,
    sets,
    file: {
      ...p.file,
      sets: p.file.sets.map((d) => {
        const g = withGenerators(d, from, to)
        return d.template === from ? { ...g, template: to } : g
      }),
      order: renameInOrder(p.file.order, 'templates', from, to)
    }
  }
}

/** Il set con il template rinominato nei valori della colonna `template` del generatore */
function withGenerators<S extends SetDefinition>(s: S, from: string, to: string): S {
  let out = s
  if (s.generator) {
    const spec = renameInSpec(s.generator.spec, 'template', from, to)
    if (spec !== s.generator.spec) out = { ...out, generator: { ...s.generator, spec } }
  }
  if (s.generations) {
    let changed = false
    const generations = s.generations.map((g) => {
      const spec = renameInSpec(g.spec, 'template', from, to)
      if (spec === g.spec) return g
      changed = true
      return { ...g, spec }
    })
    if (changed) out = { ...out, generations }
  }
  return out
}
