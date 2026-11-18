import type { LoadedSet, ProjectFont, Sheet, SetDefinition } from '../project'
import type { Sources } from '../library'
import { isImageAsset } from './assets'
import { bindRow } from './bind'
import { markupFonts } from './fonts'
import { imageUsages } from './imageUsage'
import { TEMPLATE_COLUMN, variantsOf } from './inherit'
import { denormalizeTemplate, walkLayers, type RawTemplate } from './normalize'
import type { Template } from './template'
import { findUsages } from './usages'
import type { Variables } from './variables'

// Pacchetti di template e set (issue #204): uno ZIP con il template (e il suo base, se è un
// derivato), i dati del set, le immagini e i font che usano, le variabili e gli stili che
// richiamano. Qui si decide cosa entra e, all'importazione, cosa è già nel progetto.
// Lo ZIP lo scrive e lo legge renderer/src/package. Vedi docs/specifica.md, sezione 8.4.

export const PACKAGE_FORMAT = 1
export const PACKAGE_MANIFEST = 'stella-package.json'

export interface PackageSet {
  definition: SetDefinition
  sheet: Pick<Sheet, 'headers' | 'rows'>
}

/** Il contenuto di stella-package.json; i file degli asset stanno nello ZIP sotto assets/ */
export interface PackageManifest {
  format: number
  /** Cosa si è esportato: dà il nome al pacchetto */
  kind: 'template' | 'set'
  name: string
  templates: RawTemplate[]
  sets: PackageSet[]
  variables: Variables
  styles: Record<string, string>
  /** Percorsi sotto assets/ dei file nello ZIP */
  assets: string[]
  /** Voci di assets/sources.json dei file nel pacchetto */
  sources: Sources
}

export interface PackageProject {
  templates: Template[]
  sets: LoadedSet[]
  assets: string[]
  fonts: ProjectFont[]
  sources: Sources
  variables: Variables
  styles: Record<string, string>
}

/** Il template con i suoi base, dal più lontano */
function withBases(name: string, templates: Template[], out: Template[]): void {
  const t = templates.find((x) => x.name === name)
  if (!t || out.includes(t)) return
  if (t.extends) withBases(t.extends, templates, out)
  out.push(t)
}

/**
 * Cosa entra nel pacchetto di un template o di un set: template (con i base e quelli scelti
 * riga per riga dalla colonna template), dati, variabili e stili richiamati (anche
 * indirettamente), immagini e font usati
 */
export function collectPackage(
  p: PackageProject,
  what: { kind: 'template' | 'set'; name: string }
): PackageManifest {
  const sets = what.kind === 'set' ? p.sets.filter((s) => s.name === what.name) : []
  const templates: Template[] = []
  if (what.kind === 'template') withBases(what.name, p.templates, templates)
  for (const s of sets) {
    withBases(s.template, p.templates, templates)
    const col = s.data?.headers.indexOf(TEMPLATE_COLUMN) ?? -1
    if (col >= 0)
      for (const r of s.data!.rows)
        if (r[col]?.trim()) withBases(r[col].trim(), p.templates, templates)
  }
  // le varianti viaggiano con il loro template: sono parte di lui
  for (const t of [...templates])
    for (const v of variantsOf(p.templates, t.name)) withBases(v.name, p.templates, templates)
  const tNames = new Set(templates.map((t) => t.name))
  const sNames = new Set(sets.map((s) => s.name))
  const scope = {
    templates: p.templates,
    sets: p.sets,
    variables: p.variables,
    styles: p.styles
  }

  // variabili e stili: usati dai template e dai set, o da quelli già presi; fino a che non
  // se ne aggiunge nessuno
  const vars = new Set<string>()
  const styles = new Set<string>()
  const varUse = Object.keys(p.variables).map((n) => [n, findUsages(scope, 'variable', n)] as const)
  const styleUse = Object.keys(p.styles).map((n) => [n, findUsages(scope, 'style', n)] as const)
  for (let changed = true; changed;) {
    changed = false
    for (const [list, uses] of [
      [vars, varUse],
      [styles, styleUse]
    ] as const)
      for (const [n, u] of uses) {
        if (list.has(n)) continue
        if (
          u.templates.some((x) => tNames.has(x.name)) ||
          u.sets.some((x) => sNames.has(x.name)) ||
          u.variables.some((x) => vars.has(x)) ||
          u.styles.some((x) => styles.has(x))
        ) {
          list.add(n)
          changed = true
        }
      }
  }

  const assets = new Set<string>()
  for (const [path, u] of imageUsages({
    templates: p.templates,
    sets: p.sets,
    assets: p.assets,
    variables: p.variables,
    styles: p.styles
  }))
    if (
      u.templates.some((x) => tNames.has(x)) ||
      u.sets.some((x) => sNames.has(x)) ||
      u.variables.some((x) => vars.has(x)) ||
      u.styles.some((x) => styles.has(x))
    )
      assets.add(path)

  // font: quelli scritti nei livelli e nel markup, anche dopo aver legato le righe del set
  const families = new Set<string>()
  const addText = (font: string | undefined, text: string): void => {
    if (font) families.add(font.toLowerCase())
    for (const f of markupFonts(text, p.styles, p.variables)) families.add(f.toLowerCase())
  }
  const fromLayers = (t: Template): void => {
    for (const l of walkLayers([...t.front, ...t.back]))
      if (l.type === 'text') addText(l.font, l.text)
  }
  templates.forEach(fromLayers)
  for (const s of sets) {
    const tpl = p.templates.find((t) => t.name === s.template)
    if (!tpl || !s.data) continue
    for (const row of s.data.rows)
      fromLayers(
        bindRow(s.data.headers, row, tpl, p.templates, {
          assets: p.assets,
          variables: p.variables,
          styles: p.styles
        }).template
      )
  }
  for (const n of styles) addText(undefined, `[x]{.${n}}`)
  for (const f of p.fonts) if (families.has(f.family.toLowerCase())) assets.add(f.path)

  const list = [...assets].sort()
  return {
    format: PACKAGE_FORMAT,
    kind: what.kind,
    name: what.name,
    templates: templates.map((t) => ({ ...denormalizeTemplate(t), name: t.name })),
    sets: sets.map((s) => {
      const definition: SetDefinition = { ...s }
      delete (definition as Partial<LoadedSet>).data
      delete definition.sheet
      return { definition, sheet: { headers: s.data?.headers ?? [], rows: s.data?.rows ?? [] } }
    }),
    variables: Object.fromEntries([...vars].sort().map((n) => [n, p.variables[n]])),
    styles: Object.fromEntries([...styles].sort().map((n) => [n, p.styles[n]])),
    assets: list,
    sources: Object.fromEntries(list.filter((a) => p.sources[a]).map((a) => [a, p.sources[a]]))
  }
}

/** Il manifesto letto da uno ZIP, controllato quanto basta per non rompere il progetto */
export function parseManifest(json: unknown): PackageManifest | null {
  const m = json as Partial<PackageManifest> | null
  if (!m || typeof m !== 'object' || typeof m.format !== 'number') return null
  if (m.format > PACKAGE_FORMAT) return null
  const arr = <T>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : [])
  const obj = <T>(x: unknown): Record<string, T> =>
    x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, T>) : {}
  const assets = arr<string>(m.assets).filter(
    (a) => typeof a === 'string' && !a.split('/').some((p) => !p || p === '.' || p === '..')
  )
  return {
    format: m.format,
    kind: m.kind === 'set' ? 'set' : 'template',
    name: String(m.name ?? ''),
    templates: arr<RawTemplate>(m.templates).filter((t) => t && typeof t.name === 'string'),
    sets: arr<PackageSet>(m.sets).filter(
      (s) =>
        s &&
        typeof s.definition?.name === 'string' &&
        typeof s.definition?.template === 'string' &&
        Array.isArray(s.sheet?.headers) &&
        Array.isArray(s.sheet?.rows)
    ),
    variables: obj(m.variables),
    styles: obj<string>(m.styles),
    assets,
    sources: obj(m.sources)
  }
}

// ---------------------------------------------------------------- importazione

/** Cosa fare di un elemento del pacchetto che c'è già nel progetto */
export type ConflictChoice = 'rename' | 'replace' | 'keep'

export type ConflictKind = 'template' | 'set' | 'variable' | 'style' | 'asset'

export interface PackageConflict {
  kind: ConflictKind
  /** Nome nel pacchetto (percorso sotto assets/ per i file) */
  name: string
  /** Per i file: il file del progetto con lo stesso nome */
  existing?: string
  /** Le scelte possibili; la prima è quella proposta */
  choices: ConflictChoice[]
}

/** Nome del file senza cartella e senza estensione, come lo cerca il progetto */
const stem = (path: string): string =>
  path
    .slice(path.lastIndexOf('/') + 1)
    .replace(/\.[^.]+$/, '')
    .toLowerCase()

/**
 * Elementi del pacchetto che esistono già nel progetto con un contenuto diverso. Quelli uguali
 * non si chiedono: si usano quelli del progetto. `same` dice se un file del pacchetto è uguale a
 * quello del progetto (lo confronta chi ha i byte).
 */
export function findConflicts(
  m: PackageManifest,
  p: {
    templates: Template[]
    sets: { name: string }[]
    assets: string[]
    variables: Variables
    styles: Record<string, string>
  },
  same: (pkgPath: string, projectPath: string) => boolean
): PackageConflict[] {
  const out: PackageConflict[] = []
  for (const t of m.templates) {
    const mine = p.templates.find((x) => x.name === t.name)
    if (!mine) continue
    const theirs = JSON.stringify({ ...denormalizeTemplate(mine), name: mine.name })
    if (theirs !== JSON.stringify(t))
      out.push({ kind: 'template', name: t.name, choices: ['rename', 'replace', 'keep'] })
  }
  for (const s of m.sets)
    if (p.sets.some((x) => x.name === s.definition.name))
      out.push({ kind: 'set', name: s.definition.name, choices: ['rename', 'replace', 'keep'] })
  for (const [n, v] of Object.entries(m.variables))
    if (p.variables[n] && JSON.stringify(p.variables[n]) !== JSON.stringify(v))
      out.push({ kind: 'variable', name: n, choices: ['keep', 'replace'] })
  for (const [n, v] of Object.entries(m.styles))
    if (p.styles[n] !== undefined && p.styles[n] !== v)
      out.push({ kind: 'style', name: n, choices: ['keep', 'replace'] })
  // un file con lo stesso nome in qualunque cartella: due file con lo stesso nome renderebbero
  // ambiguo il nome con cui le carte lo cercano
  for (const a of m.assets) {
    const existing =
      p.assets.find((x) => x.toLowerCase() === a.toLowerCase()) ??
      p.assets.find((x) => stem(x) === stem(a) && sameKind(x, a))
    if (existing && !same(a, existing))
      out.push({ kind: 'asset', name: a, existing, choices: ['keep', 'replace'] })
  }
  return out
}

/** Due immagini con lo stesso nome senza estensione: le carte non saprebbero quale usare */
const sameKind = (a: string, b: string): boolean => isImageAsset(a) && isImageAsset(b)

/** Nome libero: "Eroe", "Eroe 2", "Eroe 3"... */
export function freeName(base: string, taken: string[]): string {
  let name = base
  for (let i = 2; taken.includes(name); i++) name = `${base} ${i}`
  return name
}

export interface ImportPlan {
  /** Template da aggiungere o sostituire, già con i nomi nuovi */
  templates: { raw: RawTemplate; replace: boolean }[]
  sets: { set: PackageSet; replace: boolean }[]
  variables: Variables
  styles: Record<string, string>
  /** File da scrivere: dal percorso nello ZIP a quello nel progetto */
  files: { from: string; to: string; replaces?: string }[]
  sources: Sources
  /** Nomi cambiati, da dire a chi importa */
  renamed: { kind: 'template' | 'set'; from: string; to: string }[]
}

/**
 * Applica le scelte: i template e i set rinominati prendono un nome libero e i riferimenti nel
 * pacchetto (set → template, derivato → base, colonna template) seguono
 */
export function planImport(
  m: PackageManifest,
  p: {
    templates: Template[]
    sets: { name: string }[]
    assets: string[]
    variables: Variables
    styles: Record<string, string>
  },
  conflicts: PackageConflict[],
  choices: Record<string, ConflictChoice>
): ImportPlan {
  const choice = (kind: ConflictKind, name: string): ConflictChoice | null => {
    const c = conflicts.find((x) => x.kind === kind && x.name === name)
    return c ? (choices[`${kind}:${name}`] ?? c.choices[0]) : null
  }
  const renamed: ImportPlan['renamed'] = []
  const tName = new Map<string, string>()
  const takenT = [...p.templates.map((t) => t.name), ...m.templates.map((t) => t.name)]
  const templates: ImportPlan['templates'] = []
  for (const t of m.templates) {
    const exists = p.templates.some((x) => x.name === t.name)
    const c = choice('template', t.name)
    if (exists && (c === null || c === 'keep')) continue
    if (c === 'rename') {
      const to = freeName(t.name, takenT)
      takenT.push(to)
      tName.set(t.name, to)
      renamed.push({ kind: 'template', from: t.name, to })
    }
    templates.push({ raw: t, replace: c === 'replace' })
  }
  const rt = (n: string): string => tName.get(n) ?? n
  for (const t of templates) {
    t.raw = { ...t.raw, name: rt(t.raw.name) }
    if (t.raw.extends) t.raw.extends = rt(t.raw.extends)
  }

  const takenS = [...p.sets.map((s) => s.name), ...m.sets.map((s) => s.definition.name)]
  const sets: ImportPlan['sets'] = []
  for (const s of m.sets) {
    const c = choice('set', s.definition.name)
    if (c === 'keep') continue
    let name = s.definition.name
    if (c === 'rename') {
      name = freeName(name, takenS)
      takenS.push(name)
      renamed.push({ kind: 'set', from: s.definition.name, to: name })
    }
    const col = s.sheet.headers.indexOf(TEMPLATE_COLUMN)
    sets.push({
      set: {
        definition: { ...s.definition, name, template: rt(s.definition.template) },
        sheet: {
          headers: s.sheet.headers,
          rows:
            col < 0 || !tName.size
              ? s.sheet.rows
              : s.sheet.rows.map((r) => r.map((x, i) => (i === col && x.trim() ? rt(x.trim()) : x)))
        }
      },
      replace: c === 'replace'
    })
  }

  const variables: Variables = {}
  for (const [n, v] of Object.entries(m.variables))
    if (!p.variables[n] || choice('variable', n) === 'replace') variables[n] = v
  const styles: Record<string, string> = {}
  for (const [n, v] of Object.entries(m.styles))
    if (p.styles[n] === undefined || choice('style', n) === 'replace') styles[n] = v

  const files: ImportPlan['files'] = []
  const sources: Sources = {}
  for (const a of m.assets) {
    const conflict = conflicts.find((x) => x.kind === 'asset' && x.name === a)
    const existing =
      conflict?.existing ??
      p.assets.find((x) => x.toLowerCase() === a.toLowerCase()) ??
      p.assets.find((x) => stem(x) === stem(a) && sameKind(x, a))
    if (existing && (!conflict || choice('asset', a) !== 'replace')) continue
    // sostituire: il file va nella cartella di quello del progetto, che va nel cestino se ha un
    // altro nome (per esempio un'altra estensione)
    const to = existing
      ? existing.slice(0, existing.lastIndexOf('/') + 1) + a.slice(a.lastIndexOf('/') + 1)
      : a
    files.push({ from: a, to, ...(existing && existing !== to ? { replaces: existing } : {}) })
    if (m.sources[a]) sources[to] = m.sources[a]
  }
  return { templates, sets, variables, styles, files, sources, renamed }
}
