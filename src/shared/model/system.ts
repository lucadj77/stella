import type { LoadedSet } from '../project'
import type { Side, Template } from './template'

// Variabili di sistema: valori che Stella conosce da sé (progetto, set, posizione della carta, data)
// e che si richiamano come i campi, con {set.name} nei testi e nelle formule. Il punto le separa
// dalle variabili del progetto, che non possono contenerlo. Vedi docs/specifica.md, 6.2.

export const SYSTEM_VARIABLES = [
  'project.name',
  'project.author',
  'project.version',
  'set.name',
  'template.name',
  'card.number',
  'set.rows',
  'set.cards',
  'card.copies',
  'card.copy',
  'card.side',
  'date'
] as const

export type SystemVariable = (typeof SYSTEM_VARIABLES)[number]

/** Ciò che dipende da dove si disegna la carta; ciò che manca resta vuoto */
export interface SystemInfo {
  project?: string
  /** Autore e versione del progetto, da Informazioni progetto */
  author?: string
  version?: string
  set?: string
  /** Riga della carta nel set, da 1 */
  number?: number
  rows?: number
  /** Carte del set con le copie: somma di amount */
  cards?: number
  /** Copia che si sta disegnando, da 1 */
  copy?: number
  /** Data del disegno, AAAA-MM-GG; di base oggi */
  date?: string
}

/** Oggi, AAAA-MM-GG nell'ora locale */
export function today(now = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

/** Nome, autore e versione del progetto, da stella.json */
export interface ProjectMeta {
  name: string
  author?: string
  version?: string
}

/** Nome, autore e versione da un nome solo o da stella.json */
export function projectMeta(project: string | ProjectMeta): ProjectMeta {
  return typeof project === 'string' ? { name: project } : project
}

/** Le variabili di sistema del progetto; con solo il nome, autore e versione restano vuoti */
export function projectSystem(project: string | ProjectMeta): SystemInfo {
  if (typeof project === 'string') return { project }
  return {
    project: project.name,
    ...(project.author ? { author: project.author } : {}),
    ...(project.version ? { version: project.version } : {})
  }
}

/** Le informazioni di un set per le sue carte; number e copy si aggiungono carta per carta */
export function systemOfSet(
  project: string | ProjectMeta,
  set: Pick<LoadedSet, 'name' | 'data'>
): SystemInfo {
  const amount = set.data?.headers.indexOf('amount') ?? -1
  const rows = set.data?.rows ?? []
  const cards = rows.reduce((sum, r) => {
    const n = amount >= 0 ? parseInt(r[amount] ?? '', 10) : NaN
    return sum + (Number.isFinite(n) && n >= 0 ? n : 1)
  }, 0)
  return { ...projectSystem(project), set: set.name, rows: rows.length, cards }
}

export function systemFields(
  info: SystemInfo | undefined,
  template: Template,
  amount: number,
  side: Side
): Record<SystemVariable, string> {
  const s = (v: number | string | undefined): string => (v === undefined ? '' : String(v))
  return {
    'project.name': s(info?.project),
    'project.author': s(info?.author),
    'project.version': s(info?.version),
    'set.name': s(info?.set),
    'template.name': template.name,
    'card.number': s(info?.number),
    'set.rows': s(info?.rows),
    'set.cards': s(info?.cards),
    'card.copies': String(amount),
    'card.copy': String(info?.copy ?? 1),
    'card.side': side,
    date: info?.date ?? today()
  }
}

const sideUse = new WeakMap<Template, boolean>()

/** Il template cambia tra fronte e retro con {card.side}: il retro va legato a parte */
export function usesSide(template: Template): boolean {
  let v = sideUse.get(template)
  if (v === undefined) {
    v = JSON.stringify(template).includes('card.side')
    sideUse.set(template, v)
  }
  return v
}

/** La carta cambia da copia a copia con {card.copy}: ogni copia va legata a parte */
export function usesCopy(template: Template, fields: Record<string, string>): boolean {
  const re = /card\.copy(?!ies)/
  return re.test(JSON.stringify(template)) || Object.values(fields).some((v) => re.test(v))
}
