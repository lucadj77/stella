import type { LoadedSet } from '../project'
import { d4Corners, dieOf } from './dice'
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
  'date',
  'die.corner1',
  'die.corner2',
  'die.corner3'
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
  /** Il foglio del set: i vertici del d4 leggono i valori delle altre righe del dado */
  sheet?: { headers: string[]; rows: string[][] }
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
  return {
    ...projectSystem(project),
    set: set.name,
    rows: rows.length,
    cards,
    ...(set.data ? { sheet: set.data } : {})
  }
}

/**
 * I vertici di una faccia di d4: il valore di ogni riga è quello del campo che dà il nome alle
 * carte se è una colonna, altrimenti della prima colonna. Senza foglio (l'editor senza dati) le
 * righe valgono 1, 2, 3, 4
 */
function cornersOf(info: SystemInfo | undefined, template: Template): [string, string, string] {
  if (dieOf(template) !== 'd4') return ['', '', '']
  const sheet = info?.sheet
  let values = ['1', '2', '3', '4']
  if (sheet) {
    const h = sheet.headers
    const col =
      template.labelField && h.includes(template.labelField)
        ? h.indexOf(template.labelField)
        : h.findIndex((x) => x !== 'amount' && !x.includes('.'))
    values = col >= 0 ? sheet.rows.map((r) => r[col] ?? '') : []
  }
  return d4Corners(values, info?.number ?? 1)
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
    date: info?.date ?? today(),
    ...(() => {
      const [c1, c2, c3] = cornersOf(info, template)
      return { 'die.corner1': c1, 'die.corner2': c2, 'die.corner3': c3 }
    })()
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
