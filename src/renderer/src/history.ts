import type { LoadedSet, ProjectFile } from '../../shared/project'
import type { Layer, Side, Template } from '../../shared/model/template'
import { walkLayers } from '../../shared/model/normalize'

// Cronologia unica del progetto, per annulla e ripristina: dati, set, stili, variabili e
// modifiche ai template stanno su una sola linea del tempo. Ogni passo ricorda dove è avvenuto,
// così annullando si torna in quella schermata, anche se nel frattempo se ne è aperta un'altra.

/** Schermata dell'app in cui è avvenuta una modifica */
export type Place =
  | { kind: 'set'; index: number }
  | { kind: 'template'; name: string }
  | { kind: 'document'; name: string }

/** Stato del progetto prima di una modifica */
export interface HistoryEntry {
  sets: LoadedSet[]
  file: ProjectFile
  /**
   * Template da rimettere annullando: c'è quando la modifica li ha cambiati (editor, rinomina).
   * Senza, annullare lascia i template come sono.
   */
  templates?: Template[]
  /** Modifica nell'editor: annullare rimette solo i template, non dati e file del progetto */
  tplOnly?: boolean
  /** Dove è avvenuta la modifica: annullando o ripristinando si torna lì */
  where?: Place
  /** Nell'editor: il lato e i livelli selezionati prima della modifica */
  side?: Side
  selection?: string[]
  /** Template com'erano, solo per descrivere il passo nella cronologia */
  view?: Template[]
  /** Quando è avvenuta la modifica (ms) */
  time?: number
}

/** Stato attuale, con cui si confronta l'ultimo passo per descriverlo */
export interface HistoryState {
  sets: LoadedSet[]
  file: ProjectFile
  templates: Template[]
}

/** Descrizione di un passo: una chiave dei messaggi e i suoi parametri */
export interface StepText {
  key: string
  params: Record<string, string | number>
}

const MAX_NAMES = 3

function names(list: string[]): string {
  const shown = list.slice(0, MAX_NAMES).join(', ')
  return list.length > MAX_NAMES ? `${shown}…` : shown
}

function layerMap(t: Template): Map<string, Layer> {
  const m = new Map<string, Layer>()
  for (const side of ['front', 'back'] as const) for (const l of walkLayers(t[side])) m.set(l.id, l)
  return m
}

/** Proprietà di primo livello diverse tra due oggetti; children si guarda a parte */
function changedKeys(a: object, b: object, skip: string[] = []): string[] {
  const out: string[] = []
  const ra = a as Record<string, unknown>
  const rb = b as Record<string, unknown>
  for (const k of new Set([...Object.keys(ra), ...Object.keys(rb)])) {
    if (skip.includes(k)) continue
    if (ra[k] !== rb[k] && JSON.stringify(ra[k]) !== JSON.stringify(rb[k])) out.push(k)
  }
  return out
}

/** Cosa è cambiato in un template: livelli aggiunti, tolti o modificati, o le sue proprietà */
export function describeTemplate(before: Template, after: Template): StepText {
  const tpl = after.name
  const a = layerMap(before)
  const b = layerMap(after)
  const added = [...b.keys()].filter((id) => !a.has(id)).map((id) => b.get(id)!.name)
  const removed = [...a.keys()].filter((id) => !b.has(id)).map((id) => a.get(id)!.name)
  if (added.length) return { key: 'history.layerAdded', params: { tpl, layers: names(added) } }
  if (removed.length)
    return { key: 'history.layerRemoved', params: { tpl, layers: names(removed) } }
  const changed: string[] = []
  const props = new Set<string>()
  for (const [id, l] of b) {
    const old = a.get(id)!
    if (old === l) continue
    const keys = changedKeys(old, l, ['children'])
    if (!keys.length) continue
    changed.push(l.name)
    for (const k of keys) props.add(k)
  }
  if (changed.length)
    return {
      key: 'history.layerChanged',
      params: { tpl, layers: names(changed), props: [...props].join(',') }
    }
  // nessun livello cambiato: l'ordine dei livelli o le proprietà del template
  const own = changedKeys(before, after, ['front', 'back'])
  if (own.length) return { key: 'history.templateProps', params: { tpl, props: own.join(',') } }
  return { key: 'history.layerOrder', params: { tpl } }
}

/** Cosa è cambiato nel foglio di un set */
function describeSheet(name: string, before: LoadedSet, after: LoadedSet): StepText {
  const x = before.data
  const y = after.data
  if (!x || !y) return { key: 'history.set', params: { set: name } }
  if (x.headers.join('\u0000') !== y.headers.join('\u0000'))
    return { key: 'history.columns', params: { set: name } }
  if (y.rows.length > x.rows.length)
    return { key: 'history.rowsAdded', params: { set: name, n: y.rows.length - x.rows.length } }
  if (y.rows.length < x.rows.length)
    return { key: 'history.rowsRemoved', params: { set: name, n: x.rows.length - y.rows.length } }
  const cells: [number, number][] = []
  y.rows.forEach((r, i) => {
    const o = x.rows[i]
    if (o === r) return
    r.forEach((v, j) => {
      if ((o?.[j] ?? '') !== (v ?? '')) cells.push([i, j])
    })
  })
  if (cells.length === 1) {
    const [row, col] = cells[0]
    return {
      key: 'history.cell',
      params: { set: name, row: row + 1, col: y.headers[col] ?? String(col + 1) }
    }
  }
  if (cells.length > 1) {
    const rows = new Set(cells.map((c) => c[0]))
    return rows.size === 1
      ? { key: 'history.rowCells', params: { set: name, row: cells[0][0] + 1, n: cells.length } }
      : { key: 'history.cells', params: { set: name, n: cells.length } }
  }
  return { key: 'history.rowsOrder', params: { set: name } }
}

/** Una chiave del file di progetto (stili, variabili) con le voci cambiate */
function changedNames(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined
): string[] {
  return changedKeys(a ?? {}, b ?? {})
}

/** Stato prima di un passo da ripristinare: `future` ha in fondo il primo passo da rifare */
export function futureBefore(
  future: HistoryEntry[],
  k: number,
  current: HistoryState
): HistoryEntry {
  const e = future[k + 1]
  const before: HistoryState = e
    ? { sets: e.sets, file: e.file, templates: e.templates ?? e.view ?? current.templates }
    : current
  const step = future[k]
  return {
    sets: before.sets,
    file: before.file,
    templates: before.templates,
    tplOnly: step.tplOnly,
    where: step.where
  }
}

/** Stato dopo un passo da ripristinare */
export function futureAfter(entry: HistoryEntry, current: HistoryState): HistoryState {
  return {
    sets: entry.sets,
    file: entry.file,
    templates: entry.templates ?? entry.view ?? current.templates
  }
}

/** Descrive il passo `entry`, che ha portato il progetto da `entry` ad `after` */
export function describeStep(entry: HistoryEntry, after: HistoryState): StepText {
  if (entry.tplOnly) {
    const before = entry.templates ?? []
    const name = entry.where?.kind === 'template' ? entry.where.name : undefined
    const x = before.find((t) => t.name === name)
    const y = after.templates.find((t) => t.name === name)
    if (x && y) return describeTemplate(x, y)
    return { key: 'history.templates', params: {} }
  }
  // template rinominati, aggiunti o tolti insieme ai dati (rinomina di stili e variabili)
  const sa = entry.sets
  const sb = after.sets
  if (sb.length > sa.length) {
    const added = sb.filter((s) => !sa.some((o) => o.name === s.name)).map((s) => s.name)
    return { key: 'history.setAdded', params: { set: names(added) } }
  }
  if (sb.length < sa.length) {
    const removed = sa.filter((s) => !sb.some((o) => o.name === s.name)).map((s) => s.name)
    return { key: 'history.setRemoved', params: { set: names(removed) } }
  }
  const fa = entry.file
  const fb = after.file
  const styles = changedNames(fa.styles, fb.styles)
  if (styles.length) return { key: 'history.style', params: { name: names(styles) } }
  const vars = changedNames(fa.variables, fb.variables)
  if (vars.length) return { key: 'history.variable', params: { name: names(vars) } }
  if (sa.some((s, i) => s.name !== sb[i].name)) {
    const sameSets = sa.every((s) => sb.some((o) => o.name === s.name))
    if (sameSets) return { key: 'history.setsOrder', params: {} }
    const i = sa.findIndex((s, k) => s.name !== sb[k].name)
    return { key: 'history.setRenamed', params: { from: sa[i].name, to: sb[i].name } }
  }
  for (let i = 0; i < sb.length; i++) {
    const x = sa[i]
    const y = sb[i]
    if (x.template !== y.template)
      return { key: 'history.setTemplate', params: { set: y.name, tpl: y.template } }
    if (x.data !== y.data) return describeSheet(y.name, x, y)
  }
  if (JSON.stringify(fa.order) !== JSON.stringify(fb.order))
    return { key: 'history.order', params: {} }
  return { key: 'history.project', params: {} }
}

/** Stato del progetto dopo il passo i di `past`: il passo dopo, o lo stato attuale */
export function stateAfter(past: HistoryEntry[], i: number, current: HistoryState): HistoryState {
  const next = past[i + 1]
  if (!next) return current
  return { sets: next.sets, file: next.file, templates: next.view ?? current.templates }
}
