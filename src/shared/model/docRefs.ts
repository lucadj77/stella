import type { LoadedSet, ProjectNote } from '../project'
import {
  ANATOMY_FENCE,
  anatomyCardSource,
  CARD_PREFIX,
  cardRefSource,
  findCard,
  isMessage,
  parseCardRef,
  type CardRef
} from './document'
import { SETUP_FENCE } from './setup'
import { renameInText, type RefKind } from './rename'
import { walkLayers } from './normalize'
import type { Template } from './template'

// I documenti richiamano le carte per nome (card:Personaggi/nome=Mago) e i livelli nelle
// anatomie. Quando un set, una colonna, il valore di una carta o un livello cambiano nome, i
// riferimenti dei documenti li seguono. Funzioni pure: le usano l'app e la riga di comando.

type Part = 'text' | 'setup' | 'anatomy' | 'code'

/** Riscrive il documento a blocchi: `f` riceve le righe di testo una alla volta e i blocchi ``` interi */
function mapParts(src: string, f: (part: Part, lines: string[]) => string[]): string {
  const lines = src.split('\n')
  // a fine riga può restare un \r: le espressioni lavorano senza e lo si rimette dopo
  const cr = lines.map((l) => l.endsWith('\r'))
  const plain = lines.map((l, i) => (cr[i] ? l.slice(0, -1) : l))
  const out: string[] = []
  let i = 0
  while (i < plain.length) {
    const fence = /^\s*(```|~~~)\s*([\w-]*)/.exec(plain[i])
    if (!fence) {
      out.push(...f('text', [plain[i]]))
      i++
      continue
    }
    out.push(plain[i])
    const body: string[] = []
    i++
    while (i < plain.length && !plain[i].trimStart().startsWith(fence[1])) body.push(plain[i++])
    const name = fence[2].toLowerCase()
    const part: Part = name === SETUP_FENCE ? 'setup' : name === ANATOMY_FENCE ? 'anatomy' : 'code'
    out.push(...f(part, body))
    if (i < plain.length) out.push(plain[i++])
  }
  return out.map((l, k) => (cr[k] ? l + '\r' : l)).join('\n')
}

const IMAGE_REF = /(!\[[^\]\n]*\]\(\s*)(card:[^)\n]*?)(\s*\))/gi
const SETUP_CARD = /^(\s*(?:card|deck)\s+)(\S+)(.*)$/i
const ANATOMY_CARD = /^(\s*card\s*:\s*)(.*?)(\s*)$/i
const CALLOUT = /^(\s*[-*]\s*)(.+?)((?:\s*\((?:\s*(?:left|right|front|back)\s*,?)+\))?\s*:\s*.*)$/

/**
 * Applica `fn` a ogni carta richiamata (immagini, tabelle, schemi setup, anatomie): se
 * restituisce un riferimento nuovo lo si riscrive, se restituisce null resta com'è
 */
export function mapCardRefs(
  src: string,
  fn: (ref: CardRef) => CardRef | null
): { text: string; count: number } {
  let count = 0
  const next = (source: string): string | null => {
    const ref = parseCardRef(source)
    if (isMessage(ref)) return null
    const changed = fn(ref)
    if (!changed) return null
    count++
    return cardRefSource(changed)
  }
  // nello schema e nell'anatomia il prefisso card: è facoltativo: si tiene come era scritto
  const bare = (written: string, full: string): string =>
    written.trim().toLowerCase().startsWith(CARD_PREFIX) ? full : full.slice(CARD_PREFIX.length)
  const text = mapParts(src, (part, lines) => {
    if (part === 'text')
      return lines.map((l) =>
        l.replace(IMAGE_REF, (all, open: string, ref: string, close: string) => {
          const n = next(ref)
          return n === null ? all : open + n + close
        })
      )
    if (part === 'setup')
      return lines.map((l) => {
        const m = SETUP_CARD.exec(l)
        if (!m) return l
        const n = next(anatomyCardSource(m[2]))
        // nello schema le parti sono divise da spazi: quelli del nome si scrivono %20
        return n === null ? l : m[1] + bare(m[2], n).replace(/ /g, '%20') + m[3]
      })
    if (part === 'anatomy')
      return lines.map((l) => {
        const m = ANATOMY_CARD.exec(l)
        if (!m || !m[2]) return l
        const n = next(anatomyCardSource(m[2]))
        return n === null ? l : m[1] + bare(m[2], n) + m[3]
      })
    return lines
  })
  return { text, count }
}

/**
 * Rinomina un livello nelle etichette delle anatomie; `cards` dice se la carta del blocco
 * (come è scritta dopo `card:`) usa il template in cui il livello ha cambiato nome
 */
export function renameCalloutLayer(
  src: string,
  cards: (ref: CardRef) => boolean,
  from: string,
  to: string
): { text: string; count: number } {
  let count = 0
  const same = (a: string): boolean => a.trim().toLowerCase() === from.trim().toLowerCase()
  const text = mapParts(src, (part, lines) => {
    if (part !== 'anatomy') return lines
    const card = lines.map((l) => ANATOMY_CARD.exec(l)).find((m) => m && m[2])
    const ref = card ? parseCardRef(anatomyCardSource(card[2])) : null
    if (!ref || isMessage(ref) || !cards(ref)) return lines
    return lines.map((l) => {
      if (ANATOMY_CARD.test(l)) return l
      const m = CALLOUT.exec(l)
      if (!m || !same(m[2])) return l
      count++
      return m[1] + to + m[3]
    })
  })
  return { text, count }
}

/** Lo stato del progetto che i documenti richiamano */
export interface RefSnapshot {
  sets: LoadedSet[]
  templates: Template[]
  variables?: Record<string, unknown>
  styles?: Record<string, unknown>
}

const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase()
const findSet = (sets: LoadedSet[], name: string): number => {
  const exact = sets.findIndex((s) => s.name === name)
  return exact >= 0 ? exact : sets.findIndex((s) => same(s.name, name))
}
const findHeader = (headers: string[], name: string): number => {
  const exact = headers.indexOf(name)
  return exact >= 0 ? exact : headers.findIndex((h) => same(h, name))
}

/** Un nome sparito e uno nuovo nello stesso cambio: è una rinomina */
function renamedKey(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined
): [string, string] | null {
  if (!before || !after || before === after) return null
  const gone = Object.keys(before).filter((k) => !(k in after))
  const added = Object.keys(after).filter((k) => !(k in before))
  return gone.length === 1 && added.length === 1 ? [gone[0], added[0]] : null
}

/**
 * Il documento aggiornato a un cambio del progetto: set, colonne e carte rinominati (la carta
 * richiamata per nome=VALORE segue il suo nuovo valore se nessun'altra ha ancora quello vecchio),
 * livelli rinominati nelle anatomie, variabili e stili rinominati. `count` dice quanti
 * riferimenti sono cambiati.
 */
export function followProjectChanges(
  src: string,
  before: RefSnapshot,
  after: RefSnapshot
): { text: string; count: number } {
  let count = 0
  let text = src
  if (before.sets !== after.sets) {
    // set rinominati: stesso posto, nome nuovo, il vecchio non c'è più
    const sameList = before.sets.length === after.sets.length
    const counterpart = (i: number): LoadedSet | null => {
      const b = before.sets[i]
      if (sameList && after.sets[i].name !== b.name && findSet(after.sets, b.name) < 0)
        return after.sets[i]
      return after.sets.find((s) => s.name === b.name) ?? null
    }
    const r = mapCardRefs(text, (ref) => {
      const i = findSet(before.sets, ref.set)
      if (i < 0) return null
      const bs = before.sets[i]
      const as = counterpart(i)
      if (!as) return null
      const out: CardRef = { ...ref }
      if (as.name !== bs.name) out.set = as.name
      const bd = bs.data
      const ad = as.data
      if (ref.field !== undefined && bd && ad && bd !== ad) {
        const col = findHeader(bd.headers, ref.field)
        // colonna rinominata: stesso posto, nome nuovo
        if (
          col >= 0 &&
          bd.headers.length === ad.headers.length &&
          ad.headers[col] !== bd.headers[col] &&
          findHeader(ad.headers, ref.field) < 0
        )
          out.field = ad.headers[col]
        // valore cambiato: nessuna carta ha più quello vecchio, si segue la carta di prima
        const found = findCard(ref, [bs])
        const acol = findHeader(ad.headers, out.field ?? '')
        if (!isMessage(found) && acol >= 0 && bd.rows.length === ad.rows.length) {
          const now = findCard(out, [as])
          const value = (ad.rows[found.row]?.[acol] ?? '').trim()
          if (isMessage(now) && value) out.value = value
        }
      }
      return out.set === ref.set && out.field === ref.field && out.value === ref.value ? null : out
    })
    text = r.text
    count += r.count
  }
  if (before.templates !== after.templates)
    for (const tpl of after.templates) {
      const old = before.templates.find((t) => t.name === tpl.name)
      if (!old || old === tpl) continue
      const names = new Map(walkLayers([...old.front, ...old.back]).map((l) => [l.id, l.name]))
      const now = walkLayers([...tpl.front, ...tpl.back])
      const users = (ref: CardRef): boolean => {
        const i = findSet(after.sets, ref.set)
        return i >= 0 && after.sets[i].template === tpl.name
      }
      for (const l of now) {
        const was = names.get(l.id)
        if (was === undefined || was === l.name || now.some((x) => x.name === was)) continue
        const r = renameCalloutLayer(text, users, was, l.name)
        text = r.text
        count += r.count
      }
    }
  const kinds: [RefKind, [string, string] | null][] = [
    ['variable', renamedKey(before.variables, after.variables)],
    ['style', renamedKey(before.styles, after.styles)]
  ]
  for (const [kind, pair] of kinds) {
    if (!pair) continue
    const renamed = renameInText(text, kind, pair[0], pair[1])
    if (renamed !== text) {
      count += countChanges(text, renamed)
      text = renamed
    }
  }
  return { text, count }
}

/** Quante righe sono cambiate: per variabili e stili basta come conteggio */
const countChanges = (a: string, b: string): number => {
  const x = a.split('\n')
  const y = b.split('\n')
  return x.filter((l, i) => l !== y[i]).length
}

/** I documenti cambiati da un cambio del progetto, con il numero di riferimenti aggiornati */
export function followInDocuments(
  docs: ProjectNote[],
  before: RefSnapshot,
  after: RefSnapshot
): { changed: ProjectNote[]; count: number } {
  const changed: ProjectNote[] = []
  let count = 0
  for (const d of docs) {
    const r = followProjectChanges(d.text, before, after)
    if (r.text !== d.text) {
      changed.push({ ...d, text: r.text })
      count += r.count
    }
  }
  return { changed, count }
}
