import type { LoadedSet, ProjectCover, ProjectNote } from '../project'
import { isImageAsset, resolveAsset } from './assets'
import { bindRow } from './bind'
import { parseAttrs, parseMarkup, type Attrs, type Inline } from './markup'
import { walkLayers } from './normalize'
import { listOptions, type Layer, type Template } from './template'
import { imageVariable, type Variables } from './variables'
import { IMAGES_FOLDER } from '../library'
import { MessageError, msg } from '../messages'

// Dove è usata ogni immagine di assets/: nei template (valore fisso dei livelli), nelle carte dei
// set (anche quando la sceglie una colonna o una formula: si legano tutte le righe), nei
// documenti, nelle variabili e negli stili, nella copertina. Serve alla finestra Immagini del
// progetto per filtrare, eliminare e spostare. Funzioni pure.

export interface ImageUsage {
  /** Template che la scrivono nei loro livelli */
  templates: string[]
  /** Set le cui carte la disegnano */
  sets: string[]
  documents: string[]
  /** Variabili immagine e stili che la richiamano */
  variables: string[]
  styles: string[]
  cover: boolean
}

export type ImageFilter = 'all' | 'templates' | 'sets' | 'documents' | 'unused'

export interface UsageProject {
  templates: Template[]
  sets: Pick<LoadedSet, 'name' | 'template' | 'data'>[]
  documents?: ProjectNote[]
  assets: string[]
  variables?: Variables
  styles?: Record<string, string>
  cover?: ProjectCover
}

const empty = (): ImageUsage => ({
  templates: [],
  sets: [],
  documents: [],
  variables: [],
  styles: [],
  cover: false
})

const IMAGE_LINK = /!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g

/** Uso di ogni immagine di assets/ (solo le immagini, non font e altri file) */
export function imageUsages(p: UsageProject): Map<string, ImageUsage> {
  const out = new Map<string, ImageUsage>()
  for (const a of p.assets) if (isImageAsset(a)) out.set(a, empty())
  const variables = p.variables ?? {}
  const styles = p.styles ?? {}

  /** Percorso dell'immagine richiamata da un nome, attraverso una variabile immagine */
  const resolve = (name: string): string | null => {
    // {cuore} nelle voci di un elenco vale quanto cuore
    const n = name.trim().replace(/^\{(.*)\}$/, '$1')
    if (!n) return null
    const v = imageVariable(n, variables)
    const r = resolveAsset(v ? v.src : n, p.assets)
    return r.ok && out.has(r.path) ? r.path : null
  }
  const mark = (name: string, key: Exclude<keyof ImageUsage, 'cover'>, who: string): void => {
    const path = resolve(name)
    if (!path) return
    const list = out.get(path)![key]
    if (!list.includes(who)) list.push(who)
  }

  /** Immagini richiamate da un testo con il markup: {nome}, bg= e gli stili */
  const markupNames = (text: string): string[] => {
    const names: string[] = []
    const fromAttrs = (a: Attrs): void => {
      if (a.bg) names.push(a.bg)
      for (const s of a.styles) {
        const def = styles[s]
        if (def) {
          const bg = parseAttrs(def).attrs.bg
          if (bg) names.push(bg)
        }
      }
    }
    const walk = (list: Inline[]): void =>
      list.forEach((n) => {
        if (n.t === 'ref') names.push(n.name)
        else if (n.t === 'span') {
          fromAttrs(n.attrs)
          walk(n.children)
        }
      })
    for (const b of parseMarkup(text).blocks) {
      fromAttrs(b.attrs)
      walk(b.children)
    }
    return names
  }

  /**
   * Immagini scritte nei livelli: nel template sono i valori salvati nel file (anche quelli che
   * una colonna può sostituire, perché il template li mostra quando manca il dato), nelle carte
   * quelli che restano dopo aver legato la riga
   */
  const layerNames = (layers: Layer[]): string[] => {
    const names: string[] = []
    for (const l of walkLayers(layers)) {
      if (l.type === 'image') {
        names.push(l.src)
        if (l.backdrop?.src) names.push(l.backdrop.src)
      } else if (l.type === 'text') names.push(...markupNames(l.text))
    }
    return names
  }

  for (const t of p.templates) {
    for (const n of layerNames([...t.front, ...t.back])) mark(n, 'templates', t.name)
    // le voci dell'elenco appartengono al template, anche quelle che nessuna carta sceglie
    for (const l of walkLayers([...t.front, ...t.back]))
      if (l.type === 'image') for (const n of listOptions(l) ?? []) mark(n, 'templates', t.name)
  }

  for (const set of p.sets) {
    const tpl = p.templates.find((x) => x.name === set.template)
    if (!tpl || !set.data) continue
    const seen = new Set<string>()
    for (const row of set.data.rows) {
      const bound = bindRow(set.data.headers, row, tpl, p.templates, {
        assets: p.assets,
        variables,
        styles
      })
      const visible = walkLayers([...bound.template.front, ...bound.template.back]).filter(
        (l) => l.visible
      )
      for (const n of layerNames(visible)) seen.add(n)
    }
    for (const n of seen) mark(n, 'sets', set.name)
  }

  for (const d of p.documents ?? []) {
    for (const m of d.text.matchAll(IMAGE_LINK)) {
      const src = m[1].split('?')[0]
      if (!/^card:/i.test(src)) mark(src.replace(/^\{(.*)\}$/, '$1'), 'documents', d.name)
    }
    for (const n of markupNames(d.text.replace(IMAGE_LINK, ''))) mark(n, 'documents', d.name)
  }

  for (const [name, v] of Object.entries(variables))
    if (v.type === 'image') {
      const r = resolveAsset(v.src, p.assets)
      if (r.ok && out.has(r.path)) out.get(r.path)!.variables.push(name)
    }
  for (const [name, def] of Object.entries(styles)) {
    const bg = parseAttrs(def).attrs.bg
    if (bg) mark(bg, 'styles', name)
  }
  if (p.cover && 'image' in p.cover) {
    const path = resolve(p.cover.image)
    if (path) out.get(path)!.cover = true
  }
  return out
}

/** Nessun uso, nemmeno da variabili, stili o copertina */
export function isUnusedImage(u: ImageUsage): boolean {
  return (
    !u.templates.length &&
    !u.sets.length &&
    !u.documents.length &&
    !u.variables.length &&
    !u.styles.length &&
    !u.cover
  )
}

export function matchesFilter(u: ImageUsage, f: ImageFilter): boolean {
  if (f === 'templates') return u.templates.length > 0
  if (f === 'sets') return u.sets.length > 0 && !u.templates.length
  if (f === 'documents') return u.documents.length > 0
  if (f === 'unused') return isUnusedImage(u)
  return true
}

/**
 * Cartella proposta da «Raggruppa per template» per le immagini usate da un solo template (con
 * i suoi set) e da nient'altro: `<cartella principale>/<template>/<file>`. Restano fuori quelle
 * già in quella cartella.
 */
export function groupByTemplate(
  usages: Map<string, ImageUsage>,
  templates: Template[],
  sets: Pick<LoadedSet, 'name' | 'template'>[]
): { path: string; folder: string }[] {
  const out: { path: string; folder: string }[] = []
  for (const [path, u] of usages) {
    if (u.documents.length || u.variables.length || u.styles.length || u.cover) continue
    const owners = new Set(u.templates)
    for (const s of u.sets) {
      const set = sets.find((x) => x.name === s)
      if (set) owners.add(set.template)
    }
    if (owners.size !== 1) continue
    const [template] = owners
    if (!templates.some((t) => t.name === template)) continue
    const top = path.includes('/') ? path.slice(0, path.indexOf('/')) : ''
    const folder = [top, safeFolderName(template)].filter(Boolean).join('/')
    if (dirOf(path) === folder) continue
    out.push({ path, folder })
  }
  return out.sort((a, b) => a.folder.localeCompare(b.folder) || a.path.localeCompare(b.path))
}

/** Cartella di un percorso di assets/, '' alla radice */
export const dirOf = (path: string): string =>
  path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''

/** Nome di file del percorso */
export const baseOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

/** Un nome di cartella che va bene su tutti i sistemi */
export function safeFolderName(name: string): string {
  return (
    name
      .replace(/[<>:"\\|?*/]/g, '_')
      .replace(/[. ]+$/, '')
      .trim() || '_'
  )
}

/**
 * Una cartella scritta dall'utente sotto assets/: parti separate da /, senza .. e senza
 * caratteri vietati; null se non va bene
 */
export function cleanFolder(folder: string): string | null {
  const parts = folder
    .replace(/\\/g, '/')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean)
  if (!parts.length) return ''
  if (parts.some((p) => p === '.' || p === '..' || /[<>:"|?*]/.test(p) || /[. ]$/.test(p)))
    return null
  return parts.join('/')
}

/**
 * Cartella sotto assets/ dove vanno le immagini nuove (aggiunte, trascinate, scaricate): quella
 * scelta nel progetto (ProjectFile.imagesFolder), o images. Un nome non valido è un errore
 */
export function imagesTarget(folder?: string | null): string {
  if (!folder?.trim()) return IMAGES_FOLDER
  const clean = cleanFolder(folder)
  if (!clean) throw new MessageError(msg('images.badFolder', { folder }))
  return clean
}

/**
 * Riferimenti da riscrivere dopo uno spostamento: chi richiamava l'immagine con la cartella
 * (`images/spada`) deve trovarla nella cartella nuova. Il nome breve continua a funzionare
 * perché si cerca in tutte le sottocartelle. Percorsi senza estensione.
 */
export function movedRefs(moves: { from: string; to: string }[]): { from: string; to: string }[] {
  const strip = (p: string): string => p.replace(/\.[^./]+$/, '')
  return moves.filter((m) => m.from !== m.to).map((m) => ({ from: strip(m.from), to: strip(m.to) }))
}

export interface RetargetScope {
  templates: Template[]
  sets: LoadedSet[]
  documents: ProjectNote[]
  variables: Variables
  styles: Record<string, string>
  cover?: ProjectCover
}

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Riscrive i riferimenti con la cartella (`images/spada`, `images/spada.png`,
 * `assets/images/spada`) dopo uno spostamento, in template, celle, documenti, variabili, stili e
 * copertina. Restituisce gli stessi oggetti dove non cambia niente.
 */
export function retargetImageRefs(
  scope: RetargetScope,
  refs: { from: string; to: string }[]
): RetargetScope & { count: number } {
  let count = 0
  if (!refs.length) return { ...scope, count }
  // un'immagine che stava in assets senza cartella si richiama con il solo nome, che dopo lo
  // spostamento funziona ancora: si riscrive solo la forma `assets/nome`. Il nome da solo può
  // essere anche un testo qualsiasi («Goblin» nel nome di una carta) e non va toccato.
  const rules = refs.map((r) => {
    const root = !r.from.includes('/')
    const from = root ? `assets/${r.from}` : r.from
    return {
      re: new RegExp(`(?<![\\p{L}\\p{N}_.\\-])${escape(from)}(?![\\p{L}\\p{N}_\\-])`, 'giu'),
      to: root ? `assets/${r.to}` : r.to
    }
  })
  const swap = (s: string): string => {
    let out = s
    for (const r of rules)
      out = out.replace(r.re, () => {
        count++
        return r.to
      })
    return out
  }
  const deep = <T>(v: T): T => {
    if (typeof v === 'string') {
      const n = swap(v)
      return (n === v ? v : n) as T
    }
    if (Array.isArray(v)) {
      const n = v.map(deep)
      return (n.some((x, i) => x !== v[i]) ? n : v) as T
    }
    if (v && typeof v === 'object') {
      let changed = false
      const n: Record<string, unknown> = {}
      for (const [k, x] of Object.entries(v)) {
        n[k] = deep(x)
        if (n[k] !== x) changed = true
      }
      return (changed ? n : v) as T
    }
    return v
  }
  const templates = deep(scope.templates)
  const sets = scope.sets.map((s) => {
    if (!s.data) return s
    const rows = deep(s.data.rows)
    return rows === s.data.rows ? s : { ...s, data: { ...s.data, rows } }
  })
  return {
    templates,
    sets: sets.some((s, i) => s !== scope.sets[i]) ? sets : scope.sets,
    documents: deep(scope.documents),
    variables: deep(scope.variables),
    styles: deep(scope.styles),
    cover: deep(scope.cover),
    count
  }
}
