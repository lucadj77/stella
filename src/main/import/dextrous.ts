import JSZip from 'jszip'
import { mkdir, readFile, readdir, stat, writeFile } from 'fs/promises'
import { exists } from '../fs'
import { basename, dirname, join } from 'path'
import { MessageError, msg } from '../../shared/messages'
import { normalizeTemplate } from '../../shared/model/normalize'
import { isImageAsset } from '../../shared/model/assets'
import {
  convertDextrous,
  isDextrousLayout,
  isDextrousProject,
  layoutInfo,
  requirements
} from '../../shared/import/dextrous'
import { PROJECT_FILE } from '../../shared/project'
import type { DextrousImportOptions, DextrousImportResult, DextrousScan } from '../../shared/api'
import { PROJECT_FOLDERS } from '../project/create'
import { saveTemplate } from '../project/templates'
import { writeSpreadsheet } from '../project/spreadsheet'

// Importazione di un progetto Dextrous da una cartella in cui si mettono i file scaricati da
// Dextrous: il JSON del progetto, i JSON dei layout e le cartelle di immagini (ZIP o già
// estratte). La cartella si legge soltanto. `scanDextrous` dice cosa c'è e cosa manca, così la
// finestra può chiedere di scaricare il resto; `importDextrous` crea il progetto comunque. La
// conversione è in src/shared/import/dextrous.ts.

const MAX_DEPTH = 3
const MAX_FILES = 20000
/** I JSON più grandi non sono di Dextrous (o non si leggono in tempo ragionevole) */
const MAX_JSON = 20 * 1024 * 1024

interface Found {
  /** JSON dei progetti: percorso relativo → contenuto */
  projects: Map<string, unknown>
  layouts: { file: string; json: unknown }[]
  /** Immagini sciolte nella cartella, relative con / */
  images: string[]
  /** ZIP con immagini: file → percorsi delle immagini dentro */
  zips: Map<string, string[]>
}

async function listFiles(root: string): Promise<string[]> {
  const out: string[] = []
  const walk = async (dir: string, rel: string, depth: number): Promise<void> => {
    if (depth > MAX_DEPTH || out.length > MAX_FILES) return
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue
      const r = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) await walk(join(dir, e.name), r, depth + 1)
      else out.push(r)
    }
  }
  await walk(root, '', 0)
  return out.sort((a, b) => a.localeCompare(b))
}

async function scanFolder(source: string): Promise<Found> {
  const files = await listFiles(source)
  const found: Found = { projects: new Map(), layouts: [], images: [], zips: new Map() }
  for (const f of files) {
    const path = join(source, ...f.split('/'))
    if (/\.json$/i.test(f)) {
      if ((await stat(path)).size > MAX_JSON) continue
      let json: unknown
      try {
        json = JSON.parse(await readFile(path, 'utf8'))
      } catch {
        continue
      }
      if (isDextrousProject(json)) found.projects.set(f, json)
      else if (isDextrousLayout(json)) found.layouts.push({ file: f, json })
    } else if (/\.zip$/i.test(f)) {
      try {
        const zip = await JSZip.loadAsync(await readFile(path))
        const images = Object.values(zip.files)
          .filter((e) => !e.dir && isImageAsset(e.name) && !/(^|\/)(__MACOSX|\.)/.test(e.name))
          .map((e) => e.name)
        if (images.length) found.zips.set(f, images)
      } catch {
        // uno ZIP che non si legge non è una cartella di Dextrous
      }
    } else if (isImageAsset(f)) found.images.push(f)
  }
  return found
}

/** Il progetto scelto, o il primo trovato */
function pickProject(found: Found, project?: string): [string, unknown] {
  if (project && found.projects.has(project)) return [project, found.projects.get(project)]
  const first = [...found.projects.entries()][0]
  if (!first) throw new MessageError(msg('dextrous.noProject'))
  return first
}

/** Tutte le immagini disponibili, come percorsi (dentro gli ZIP: il percorso nello ZIP) */
const available = (found: Found): string[] => [...found.images, ...[...found.zips.values()].flat()]

export async function scanDextrous(source: string, project?: string): Promise<DextrousScan> {
  const found = await scanFolder(source)
  const [file, json] = pickProject(found, project)
  const layouts = found.layouts.map((l) => l.json)
  const req = requirements(json, layouts, available(found))
  // la stessa conversione dell'importazione, per dire prima cosa non si converte del tutto
  const preview = convertDextrous(json, layouts, available(found))
  return {
    projects: [...found.projects.keys()],
    project: file,
    title: req.title,
    components: req.components,
    folders: req.folders,
    layoutFiles: found.layouts.map((l) => ({ file: l.file, ...layoutInfo(l.json) })),
    zips: [...found.zips.keys()],
    images: available(found).length,
    notes: preview.notes
  }
}

/** Nome proposto per la cartella del progetto convertito: accanto alla cartella dei file */
export function defaultDextrousTarget(source: string, title: string): string {
  const name = title.trim().replace(/[\\/:*?"<>|]/g, '_') || basename(source)
  return join(dirname(source), `${name} Stella`)
}

export async function importDextrous(opts: DextrousImportOptions): Promise<DextrousImportResult> {
  const { source, target } = opts
  if (await exists(target)) {
    const entries = (await readdir(target)).filter((n) => !n.startsWith('.'))
    if (entries.length) throw new MessageError(msg('ttc.targetNotEmpty', { folder: target }))
  }
  const found = await scanFolder(source)
  const [, json] = pickProject(found, opts.project)
  const layouts = found.layouts.map((l) => l.json)

  // le immagini da copiare: quelle degli ZIP (sono le cartelle di Dextrous) e quelle sciolte
  // richiamate dal progetto; dove vanno, relative ad assets/
  const copies = new Map<string, () => Promise<Uint8Array>>()
  const paths = new Set<string>()
  for (const [zipFile, entries] of found.zips) {
    const zip = await JSZip.loadAsync(await readFile(join(source, ...zipFile.split('/'))))
    // lo ZIP di una cartella va nella cartella con il suo nome, se dentro non ce n'è già una
    const folder = basename(zipFile).replace(/\.zip$/i, '')
    const rooted = entries.every((e) => e.includes('/'))
    for (const e of entries) {
      const to = rooted || /^images?$/i.test(folder) ? e : `${folder}/${e}`
      if (paths.has(to.toLowerCase())) continue
      paths.add(to.toLowerCase())
      copies.set(to, () => zip.file(e)!.async('uint8array'))
    }
  }
  const wanted = new Set(
    requirements(json, layouts, [])
      .folders.flatMap((f) => f.missing)
      .map((n) => n.toLowerCase())
  )
  const taken = new Set([...copies.keys()].map((k) => basename(k).toLowerCase()))
  for (const img of found.images) {
    const name = basename(img).toLowerCase()
    if (!wanted.has(name) || taken.has(name)) continue
    taken.add(name)
    copies.set(img, async () => new Uint8Array(await readFile(join(source, ...img.split('/')))))
  }
  const assets = [...copies.keys()]
  const result = convertDextrous(json, layouts, assets)

  await mkdir(target, { recursive: true })
  for (const sub of PROJECT_FOLDERS) await mkdir(join(target, sub), { recursive: true })
  for (const [rel, read] of copies) {
    const to = join(target, 'assets', ...rel.split('/'))
    await mkdir(dirname(to), { recursive: true })
    await writeFile(to, await read())
  }
  if (opts.name?.trim()) result.file.name = opts.name.trim()
  for (const raw of result.templates) await saveTemplate(target, normalizeTemplate(raw))
  await writeSpreadsheet(join(target, result.file.dataFile), result.sheets)
  await writeFile(join(target, PROJECT_FILE), JSON.stringify(result.file, null, 2) + '\n', 'utf8')

  return {
    folder: target,
    templates: result.templates.length,
    sets: result.sheets.length,
    cards: result.sheets.reduce((n, s) => n + s.rows.length, 0),
    images: assets.length,
    missingImages: result.missingImages,
    missingLayouts: result.missingLayouts,
    fonts: result.fonts,
    notes: result.notes
  }
}
