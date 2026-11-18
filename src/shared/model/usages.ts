import type { Sheet } from '../project'
import type { Template } from './template'
import type { Variables } from './variables'
import { walkLayers } from './normalize'
import {
  renameInDefinitions,
  renameInSheet,
  renameInTemplate,
  renameInText,
  type RefKind
} from './rename'

// Dove sono usati una variabile o uno stile. Si usa la stessa ricerca della rinomina: un
// riferimento c'è dove rinominare il nome cambierebbe qualcosa. Così le due cose trovano sempre
// gli stessi punti. Funzioni pure.

/** Nome che non può comparire in un progetto: serve solo a vedere cosa cambierebbe */
const PROBE = '\u0000usage'

export interface Usages {
  /** Template e nomi dei livelli che fanno riferimento al nome */
  templates: { name: string; layers: string[] }[]
  /** Set e numeri delle carte (da 1) le cui celle fanno riferimento al nome */
  sets: { name: string; index: number; cards: number[] }[]
  variables: string[]
  styles: string[]
  /** Documenti che lo richiamano nel testo */
  documents: string[]
  /** Note che lo richiamano: anche le note si mostrano con il markup */
  notes: string[]
}

export function findUsages(
  project: {
    templates: Template[]
    sets: { name: string; template: string; data?: Sheet | null }[]
    variables: Variables
    styles: Record<string, string>
    documents?: { name: string; text: string }[]
    notes?: { name: string; text: string }[]
  },
  kind: RefKind,
  name: string
): Usages {
  const templates = project.templates.flatMap((t) => {
    const renamed = renameInTemplate(t, kind, name, PROBE)
    if (renamed === t) return []
    const before = walkLayers([...t.front, ...t.back])
    const after = walkLayers([...renamed.front, ...renamed.back])
    // un livello cambia se cambia lui o un suo figlio: si tengono quelli cambiati senza figli
    const changed = before.filter(
      (l, i) => l.type !== 'group' && JSON.stringify(l) !== JSON.stringify(after[i])
    )
    return [{ name: t.name, layers: [...new Set(changed.map((l) => l.name))] }]
  })
  const sets = project.sets.flatMap((s, index) => {
    if (!s.data) return []
    const tpl = project.templates.find((t) => t.name === s.template) ?? null
    const renamed = renameInSheet(s.data, tpl, kind, name, PROBE)
    if (renamed === s.data) return []
    const cards = s.data.rows.flatMap((r, i) => (renamed.rows[i] !== r ? [i + 1] : []))
    return [{ name: s.name, index, cards }]
  })
  const defs = renameInDefinitions(project.variables, project.styles, kind, name, PROBE)
  const variables = Object.keys(project.variables).filter(
    (k) => k !== name && JSON.stringify(defs.variables[k]) !== JSON.stringify(project.variables[k])
  )
  const styles = Object.keys(project.styles).filter(
    (k) => !(kind === 'style' && k === name) && defs.styles[k] !== project.styles[k]
  )
  const inText = (list: { name: string; text: string }[] = []): string[] =>
    list.filter((d) => renameInText(d.text, kind, name, PROBE) !== d.text).map((d) => d.name)
  return {
    templates,
    sets,
    variables,
    styles,
    documents: inText(project.documents),
    notes: inText(project.notes)
  }
}

/** Nessun riferimento */
export const isUnused = (u: Usages): boolean =>
  !u.templates.length &&
  !u.sets.length &&
  !u.variables.length &&
  !u.styles.length &&
  !u.documents.length &&
  !u.notes.length

/** Numeri di carta come intervalli: 1, 3, 5–7 */
export function cardRanges(cards: number[]): string {
  const out: string[] = []
  for (let i = 0; i < cards.length; i++) {
    let j = i
    while (j + 1 < cards.length && cards[j + 1] === cards[j] + 1) j++
    out.push(
      j > i + 1
        ? `${cards[i]}–${cards[j]}`
        : j === i + 1
          ? `${cards[i]}, ${cards[j]}`
          : `${cards[i]}`
    )
    i = j
  }
  return out.join(', ')
}
