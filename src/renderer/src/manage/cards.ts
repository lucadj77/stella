import { bindRow } from '../../../shared/model/bind'
import { projectSystem, systemOfSet } from '../../../shared/model/system'
import type { Template } from '../../../shared/model/template'
import type { LoadedProject, LoadedSet } from '../../../shared/project'
import { useBindContext } from '../render/assets'

// Miniature delle carte nella finestra «Gestisci il progetto»: le prime carte di un set, o un
// template con i dati della prima carta di un set che lo usa (come l'anteprima della barra).

export function useCards(
  project: LoadedProject
): (tpl: Template, set: LoadedSet | undefined, count: number) => Template[] {
  const ctx = useBindContext()
  return (tpl, set, count) => {
    const rows = set?.data?.rows.slice(0, count) ?? []
    const info = set ? systemOfSet(project.file, set) : projectSystem(project.file)
    return (rows.length ? rows : [[]]).map(
      (r, i) =>
        bindRow(set?.data?.headers ?? [], r, tpl, project.templates, {
          ...ctx,
          system: { ...info, number: rows.length ? i + 1 : undefined }
        }).template
    )
  }
}

/** Il set con carte che usa il template, per mostrarlo con dati veri */
export const setFor = (project: LoadedProject, name: string): LoadedSet | undefined =>
  project.sets.find((s) => s.template === name && s.data?.rows.length)
