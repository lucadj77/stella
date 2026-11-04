import type { LoadedProject } from '../project'
import { bindRow } from './bind'
import { systemOfSet } from './system'

// Confronto fra due versioni del progetto: un'impronta di come appare ogni carta (template già
// riempito con i dati, più le variabili e gli stili che richiama), per ristampare solo le carte
// cambiate. Il contenuto dei file immagine e dei font non entra nell'impronta.

/** Campi che non cambiano il disegno */
const SKIP = new Set(['id', 'name', 'locked', 'file', 'origin', 'extends'])

function clean(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(clean)
  if (!v || typeof v !== 'object') return v
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(v).sort())
    if (!SKIP.has(k)) out[k] = clean((v as Record<string, unknown>)[k])
  return out
}

/** Tutti i testi dentro un valore */
function strings(v: unknown): string[] {
  if (typeof v === 'string') return [v]
  if (Array.isArray(v)) return v.flatMap(strings)
  if (v && typeof v === 'object') return Object.values(v).flatMap(strings)
  return []
}

/** cyrb53: hash di una stringa, 53 bit in esadecimale */
function hash(s: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16)
}

type Version = Pick<LoadedProject, 'file' | 'sets' | 'templates'>

/** Variabili e stili richiamati da un testo, anche attraverso altre variabili e stili */
function definitions(text: string, p: Version): string {
  const vars = p.file.variables ?? {}
  const styles = p.file.styles ?? {}
  const found: Record<string, unknown> = {}
  const queue = [text]
  while (queue.length) {
    const s = queue.pop()!
    for (const [w] of s.matchAll(/[\p{L}\p{N}_-]+/gu)) {
      if (w in vars && !(`v:${w}` in found)) {
        found[`v:${w}`] = vars[w]
        queue.push(JSON.stringify(vars[w]))
      }
      if (w in styles && !(`s:${w}` in found)) {
        found[`s:${w}`] = styles[w]
        queue.push(styles[w])
      }
    }
  }
  return JSON.stringify(
    Object.keys(found)
      .sort()
      .map((k) => [k, found[k]])
  )
}

/** Impronta di ogni carta di ogni set, nell'ordine del foglio; assets sono quelli di adesso */
export function cardFingerprints(p: Version, assets: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const s of p.sets) {
    const tpl = p.templates.find((t) => t.name === s.template)
    if (!tpl || !s.data) continue
    const info = systemOfSet(p.file, s)
    const { headers, rows } = s.data
    out[s.name] = rows.map((row, i) => {
      const bound = bindRow(headers, row, tpl, p.templates, {
        assets,
        styles: p.file.styles,
        variables: p.file.variables,
        system: { ...info, number: i + 1 }
      })
      const look = clean(bound.template)
      // variabili e stili si cercano nei valori (testi, colori, immagini), non nei nomi dei campi
      return hash(JSON.stringify(look) + definitions(strings(look).join('\n'), p))
    })
  }
  return out
}

/**
 * Carte di adesso (indici delle righe) che nella versione di prima non c'erano uguali: nuove o
 * cambiate. Le carte si accoppiano per aspetto, quindi spostare una carta non la fa cambiare
 * (a meno che mostri il suo numero). Un set che prima non c'era è tutto nuovo.
 */
export function changedCards(
  now: Record<string, string[]>,
  before: Record<string, string[]>
): Record<string, number[]> {
  const out: Record<string, number[]> = {}
  for (const [set, prints] of Object.entries(now)) {
    const left = new Map<string, number>()
    for (const f of before[set] ?? []) left.set(f, (left.get(f) ?? 0) + 1)
    out[set] = []
    prints.forEach((f, i) => {
      const n = left.get(f) ?? 0
      if (n > 0) left.set(f, n - 1)
      else out[set].push(i)
    })
  }
  return out
}
