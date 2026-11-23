import type { Sheet } from '../project'
import { splitLanguage } from './language'
import { walkLayers } from './normalize'
import { renameInText } from './rename'
import type { Template } from './template'

// Rinomina di un livello: il suo nome è anche il campo che formule e testi richiamano ({img}) e
// la colonna del foglio da cui prende il valore. Quando il nome cambia seguono i richiami nel
// template e nei suoi derivati, e le colonne (img, img.src, img@en) nei fogli dei set che li usano.

/** Livelli rinominati fra due versioni dello stesso template, riconosciuti dall'id */
export function layerRenames(before: Template, after: Template): [string, string][] {
  const was = new Map(walkLayers([...before.front, ...before.back]).map((l) => [l.id, l.name]))
  const now = walkLayers([...after.front, ...after.back])
  const names = new Set(now.map((l) => l.name))
  const out: [string, string][] = []
  for (const l of now) {
    const old = was.get(l.id)
    // il nome vecchio è ancora di un altro livello (fronte e retro): i richiami restano suoi
    if (old === undefined || old === l.name || names.has(old)) continue
    if (!out.some(([a]) => a === old)) out.push([old, l.name])
  }
  return out
}

/** Copia profonda con i richiami {from} cambiati in {to} nelle stringhe; i nomi restano */
function renameDeep<T>(o: T, from: string, to: string, key = ''): T {
  if (typeof o === 'string') {
    if (key === 'name' || key === 'id' || key === 'type') return o
    // la colonna scelta a mano per il valore del livello: è il nome della colonna, senza graffe
    if (key === 'column') return (o === from ? to : o) as T
    return renameInText(o, 'variable', from, to) as T
  }
  if (Array.isArray(o)) {
    let changed = false
    const out = o.map((x) => {
      const y = renameDeep(x, from, to, key)
      if (y !== x) changed = true
      return y
    })
    return (changed ? out : o) as T
  }
  if (o && typeof o === 'object') {
    let changed = false
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(o)) {
      const y = renameDeep(v, from, to, k)
      if (y !== v) changed = true
      out[k] = y
    }
    return (changed ? out : o) as T
  }
  return o
}

/** Il template con i richiami al campo `from` (formule, testi, proprietà legate) cambiati */
export function renameFieldInTemplate(t: Template, from: string, to: string): Template {
  const front = renameDeep(t.front, from, to)
  const back = renameDeep(t.back, from, to)
  const changes = t.changes ? renameDeep(t.changes, from, to) : t.changes
  return front === t.front && back === t.back && changes === t.changes
    ? t
    : { ...t, front, back, ...(changes ? { changes } : {}) }
}

/**
 * Il foglio con la colonna del livello rinominata (anche `from.proprietà` e le traduzioni
 * `from@en`) e i richiami {from} nelle celle. Una colonna che esiste già con il nome nuovo non
 * si tocca: due colonne con lo stesso nome non si possono avere.
 */
export function renameFieldInSheet(s: Sheet, from: string, to: string): Sheet {
  const renamed = (header: string): string => {
    const { base, language } = splitLanguage(header)
    const suffix = language ? `@${language}` : ''
    if (base === from) return to + suffix
    if (base.startsWith(`${from}.`)) return to + base.slice(from.length) + suffix
    return header
  }
  let headersChanged = false
  const headers = s.headers.map((h) => {
    const n = renamed(h)
    if (n === h || s.headers.includes(n)) return h
    headersChanged = true
    return n
  })
  let rowsChanged = false
  const rows = s.rows.map((r) => {
    let changed = false
    const out = r.map((c) => {
      const v = renameInText(c, 'variable', from, to)
      if (v !== c) changed = true
      return v
    })
    if (changed) rowsChanged = true
    return changed ? out : r
  })
  if (!headersChanged && !rowsChanged) return s
  return { ...s, headers: headersChanged ? headers : s.headers, rows: rowsChanged ? rows : s.rows }
}
