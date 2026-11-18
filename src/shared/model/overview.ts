import type { LoadedSet, ProjectNote } from '../project'
import type { ImageUsage } from './imageUsage'
import type { Template } from './template'
import { findUsages, type Usages } from './usages'
import type { Variables } from './variables'
import type { RefKind } from './rename'

// Dati della finestra «Gestisci il progetto»: dove sono usati variabili e stili, e il contrario,
// cosa usa ogni template, set e documento (variabili, stili, immagini). Funzioni pure.

export interface OverviewProject {
  templates: Template[]
  sets: Pick<LoadedSet, 'name' | 'template' | 'data'>[]
  variables: Variables
  styles: Record<string, string>
  documents?: ProjectNote[]
  notes?: ProjectNote[]
}

/** Dove è usato ogni nome (variabili o stili) */
export function definitionUsages(
  p: OverviewProject,
  kind: RefKind,
  names: string[]
): Map<string, Usages> {
  const scope = {
    templates: p.templates,
    sets: p.sets,
    variables: p.variables,
    styles: p.styles,
    documents: p.documents,
    notes: p.notes
  }
  return new Map(names.map((n) => [n, findUsages(scope, kind, n)]))
}

/** Cosa usa un elemento del progetto */
export interface Uses {
  variables: string[]
  styles: string[]
  images: string[]
}

export interface UsesIndex {
  templates: Map<string, Uses>
  sets: Map<string, Uses>
  documents: Map<string, Uses>
}

const emptyUses = (): Uses => ({ variables: [], styles: [], images: [] })

/**
 * Il contrario degli usi: per ogni template, set e documento le variabili, gli stili e le
 * immagini che richiama
 */
export function usesIndex(
  variables: Map<string, Usages>,
  styles: Map<string, Usages>,
  images: Map<string, ImageUsage>
): UsesIndex {
  const out: UsesIndex = { templates: new Map(), sets: new Map(), documents: new Map() }
  const add = (where: keyof UsesIndex, name: string, what: keyof Uses, item: string): void => {
    const map = out[where]
    if (!map.has(name)) map.set(name, emptyUses())
    const list = map.get(name)![what]
    if (!list.includes(item)) list.push(item)
  }
  const fromUsages = (src: Map<string, Usages>, what: 'variables' | 'styles'): void => {
    for (const [name, u] of src) {
      u.templates.forEach((x) => add('templates', x.name, what, name))
      u.sets.forEach((x) => add('sets', x.name, what, name))
      u.documents.forEach((x) => add('documents', x, what, name))
    }
  }
  fromUsages(variables, 'variables')
  fromUsages(styles, 'styles')
  for (const [path, u] of images) {
    u.templates.forEach((x) => add('templates', x, 'images', path))
    u.sets.forEach((x) => add('sets', x, 'images', path))
    u.documents.forEach((x) => add('documents', x, 'images', path))
  }
  return out
}

export const usesOf = (index: Map<string, Uses>, name: string): Uses =>
  index.get(name) ?? emptyUses()

/** Un nome libero per una copia: «nome 2», «nome 3»… (o con il trattino dove servono i nomi) */
export function copyName(name: string, taken: Iterable<string>, sep = ' '): string {
  const used = new Set([...taken].map((x) => x.toLowerCase()))
  const base = name.replace(new RegExp(`${sep === ' ' ? ' ' : '-'}\\d+$`), '')
  for (let i = 2; ; i++) {
    const n = `${base}${sep}${i}`
    if (!used.has(n.toLowerCase())) return n
  }
}

/** Le prime parole di un testo, senza il markup più comune, per un'anteprima di una riga */
export function firstLine(text: string, max = 120): string {
  const plain = text
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\{[^}]*\}/g, '$1')
    .replace(/[#>*_`]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > max ? plain.slice(0, max - 1).trimEnd() + '…' : plain
}

/** Numero di carte del set, sommando la colonna amount quando presente */
export function countCards(sheet: { headers: string[]; rows: string[][] }): number {
  const col = sheet.headers.indexOf('amount')
  if (col < 0) return sheet.rows.length
  return sheet.rows.reduce((sum, r) => {
    const n = parseInt(r[col], 10)
    return sum + (Number.isFinite(n) && n >= 0 ? n : 1)
  }, 0)
}
