import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'fs/promises'
import { exists } from '../fs'
import { basename, dirname, extname, join } from 'path'
import { MessageError, msg, type Message } from '../../shared/messages'
import { normalizeTemplate, type RawLayer, type RawTemplate } from '../../shared/model/normalize'
import { LIBRARY_FOLDER, convertTtcProject, parseTtcJson } from '../../shared/import/ttc'
import { PROJECT_FILE, type Sheet } from '../../shared/project'
import type { TtcImportOptions, TtcImportResult } from '../../shared/api'
import {
  iconExtension,
  type IconCatalog,
  type IconCollection,
  type Sources
} from '../../shared/library'
import { iconCatalog } from '../library/catalogs'
import { iconFileData, iconSource } from '../library/icons'
import { updateSources } from '../library/sources'
import { listAssets } from '../project/assets'
import { saveTemplate } from '../project/templates'
import { writeSpreadsheet } from '../project/spreadsheet'

// Importazione di un progetto Tabletop Creator in una cartella nuova: la cartella di origine si
// legge soltanto. La conversione dei dati è in src/shared/import/ttc.ts.

async function readJson(path: string): Promise<unknown> {
  return parseTtcJson(await readFile(path, 'utf8'))
}

async function readJsonDir(dir: string, notes: Message[]): Promise<unknown[]> {
  let names: string[]
  try {
    names = (await readdir(dir)).filter((n) => n.endsWith('.json') && !n.startsWith('.')).sort()
  } catch {
    return []
  }
  const out: unknown[] = []
  for (const n of names) {
    try {
      out.push(await readJson(join(dir, n)))
    } catch (e) {
      notes.push(msg('ttc.unreadableFile', { file: n, error: String((e as Error).message ?? e) }))
    }
  }
  return out
}

import { isTtcProject } from './ttcDetect'
export { isTtcProject }

/** Nome proposto per la cartella del progetto convertito: accanto all'originale */
export function defaultTarget(source: string): string {
  return join(dirname(source), `${basename(source)} Stella`)
}

export async function importTtc(opts: TtcImportOptions): Promise<TtcImportResult> {
  const { source, target } = opts
  if (!(await isTtcProject(source)))
    throw new MessageError(msg('ttc.notTtcProject', { folder: source }))
  if (await exists(target)) {
    const entries = (await readdir(target)).filter((n) => !n.startsWith('.'))
    if (entries.length) throw new MessageError(msg('ttc.targetNotEmpty', { folder: target }))
  }

  const notes: Message[] = []
  const data = join(source, 'data')
  const files = {
    project: (await exists(join(data, 'project.json')))
      ? await readJson(join(data, 'project.json'))
      : undefined,
    blueprints: await readJsonDir(join(data, 'blueprints'), notes),
    sets: await readJsonDir(join(data, 'sets'), notes),
    variables: (await exists(join(data, 'variables.json')))
      ? await readJson(join(data, 'variables.json'))
      : undefined
  }
  const assets = await listAssets(source)
  const result = convertTtcProject(files, assets)
  notes.push(...result.notes)

  // le immagini del progetto si copiano con la stessa struttura di cartelle
  await mkdir(target, { recursive: true })
  for (const a of assets) {
    const to = join(target, 'assets', ...a.split('/'))
    await mkdir(dirname(to), { recursive: true })
    await copyFile(join(source, 'assets', ...a.split('/')), to)
  }

  // icone della libreria di Tabletop Creator: game-icons.net e Kenney si prendono dai cataloghi
  // dell'app, con autore e licenza in assets/sources.json; le altre si cercano nella cartella indicata
  const missing: string[] = []
  const sources: Sources = {}
  const fromCatalog = await catalogIndex()
  let found: Map<string, string> | null = null
  for (const ref of result.libraryIcons) {
    const base = join(target, 'assets', LIBRARY_FOLDER, ...ref.split('/'))
    const icon = findCatalogIcon(ref, fromCatalog)
    if (icon) {
      const { collection, catalog, id, value } = icon
      const file = `${base}.${iconExtension(value)}`
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file, iconFileData(catalog, value))
      sources[`${LIBRARY_FOLDER}/${ref}.${iconExtension(value)}`] = iconSource(
        collection,
        catalog,
        id
      )
      continue
    }
    found ??= opts.iconFolder ? await indexIcons(opts.iconFolder) : new Map<string, string>()
    const name = ref.slice(ref.lastIndexOf('/') + 1).toLowerCase()
    const path = found.get(name)
    if (!path) {
      missing.push(ref)
      continue
    }
    await mkdir(dirname(base), { recursive: true })
    await copyFile(path, base + extname(path))
  }
  if (Object.keys(sources).length) await updateSources(target, sources)

  for (const raw of result.templates) await saveTemplate(target, normalizeTemplate(raw))
  await mkdir(join(target, 'data'), { recursive: true })
  await writeSpreadsheet(join(target, result.file.dataFile), result.sheets)
  await writeFile(join(target, PROJECT_FILE), JSON.stringify(result.file, null, 2) + '\n', 'utf8')

  return {
    folder: target,
    templates: result.templates.length,
    sets: result.sheets.length,
    cards: result.sheets.reduce((n, s) => n + s.rows.length, 0),
    assets: assets.length,
    libraryIcons: Object.keys(sources).length,
    variables: Object.keys(result.file.variables ?? {}).length,
    notes,
    missingIcons: missing,
    fonts: usedFonts(result.templates, result.sheets)
  }
}

/** Caratteri usati, tranne Nunito che è incluso nell'app */
function usedFonts(templates: RawTemplate[], sheets: Sheet[]): string[] {
  const out = new Set<string>()
  const walk = (layers: RawLayer[] | undefined): void =>
    layers?.forEach((l) => {
      if (typeof l.font === 'string' && l.font) out.add(l.font)
      walk(l.children)
    })
  for (const tpl of templates) {
    walk(tpl.front)
    walk(tpl.back)
  }
  for (const sheet of sheets)
    sheet.headers.forEach((h, i) => {
      if (h.endsWith('.font')) for (const row of sheet.rows) if (row[i]) out.add(row[i])
    })
  out.delete(DEFAULT_FONT)
  return [...out].sort()
}

const DEFAULT_FONT = 'Nunito'

const ICON_EXT = ['.svg', '.png', '.webp', '.jpg', '.jpeg']

/**
 * Icone per nome di file, senza estensione e in minuscolo, cercate in tutte le sottocartelle.
 * A parità di nome si preferisce l'SVG, poi il PNG più grande (pacchetti con più dimensioni).
 */
async function indexIcons(root: string): Promise<Map<string, string>> {
  const best = new Map<string, { path: string; rank: number; size: number }>()
  let visited = 0
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > 8 || visited > 50000) return
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue
      const full = join(dir, e.name)
      if (e.isDirectory()) {
        await walk(full, depth + 1)
        continue
      }
      visited++
      const ext = extname(e.name).toLowerCase()
      const rank = ICON_EXT.indexOf(ext)
      if (rank < 0) continue
      const key = e.name.slice(0, -ext.length).toLowerCase()
      const size = (await stat(full)).size
      const prev = best.get(key)
      if (!prev || rank < prev.rank || (rank === prev.rank && size > prev.size))
        best.set(key, { path: full, rank, size })
    }
  }
  await walk(root, 0)
  return new Map([...best].map(([k, v]) => [k, v.path]))
}

interface CatalogIcon {
  collection: IconCollection
  catalog: IconCatalog
  id: string
  value: string
}

const LIBRARY_COLLECTIONS: IconCollection[] = ['game-icons', 'kenney-icons']

/** Icone dei cataloghi per nome (la parte dopo la cartella), in minuscolo */
export async function catalogIndex(): Promise<Map<IconCollection, Map<string, CatalogIcon>>> {
  const out = new Map<IconCollection, Map<string, CatalogIcon>>()
  for (const collection of LIBRARY_COLLECTIONS) {
    const catalog = await iconCatalog(collection)
    const byName = new Map<string, CatalogIcon>()
    for (const [id, value] of catalog.icons) {
      const name = id.slice(id.indexOf('/') + 1).toLowerCase()
      // a parità di nome vince la prima: in game-icons.net i nomi sono quasi tutti unici
      if (!byName.has(name)) byName.set(name, { collection, catalog, id, value })
    }
    out.set(collection, byName)
  }
  return out
}

/**
 * Icona dei cataloghi per un riferimento "Categoria/nome" della libreria di Tabletop Creator.
 * Le categorie con "Kenney" (Board-Kenney) sono le Board Game Icons di Kenney, le altre
 * (Shield, Gui, Star...) sono di game-icons.net con il nome del sito.
 */
export function findCatalogIcon(
  ref: string,
  index: Map<IconCollection, Map<string, CatalogIcon>>
): CatalogIcon | null {
  const slash = ref.lastIndexOf('/')
  const category = ref.slice(0, slash).toLowerCase()
  const name = ref.slice(slash + 1).toLowerCase()
  const order: IconCollection[] = category.includes('kenney')
    ? ['kenney-icons', 'game-icons']
    : ['game-icons', 'kenney-icons']
  for (const c of order) {
    const icon = index.get(c)?.get(name)
    if (icon) return icon
  }
  return null
}
