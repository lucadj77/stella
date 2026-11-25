import { mkdir, readFile, readdir } from 'fs/promises'
import { exists } from '../fs'
import { basename, extname, join } from 'path'
import {
  FORMAT_VERSION,
  PROJECT_FILE,
  type LoadedProject,
  type ProjectFile,
  type Sheet
} from '../../shared/project'
import { projectFilePath } from './projectFile'
import { PROJECT_FOLDERS } from './create'
import { readSpreadsheet, xlsxLosses } from './spreadsheet'
import { listAssets } from './assets'
import { readProjectFonts } from './fonts'
import { readDocuments, readNotes } from './notes'
import { readSources } from '../library/sources'
import { duplicateNames, normalizeTemplate } from '../../shared/model/normalize'
import { resolveTemplates } from '../../shared/model/inherit'
import type { Template } from '../../shared/model/template'
import { MessageError, messageFromError, msg, type Message } from '../../shared/messages'

export async function loadProject(folder: string): Promise<LoadedProject> {
  let file: ProjectFile
  const path = await projectFilePath(folder)
  try {
    const text = await readFile(path, 'utf8')
    // vuoto o pieno di zeri: quello che resta di un salvataggio interrotto (blocco della corrente)
    if (!text.replace(/\0/g, '').trim())
      throw new MessageError(msg('load.emptyProjectFile', { file: basename(path) }))
    file = JSON.parse(text)
  } catch (e) {
    if (e instanceof MessageError) throw e
    const err = e as NodeJS.ErrnoException
    if (err.code === 'ENOENT')
      throw new MessageError(msg('load.noProjectFile', { file: PROJECT_FILE }))
    throw new MessageError(
      msg('load.unreadableProjectFile', { file: basename(path), error: err.message })
    )
  }

  if (typeof file.dataFile !== 'string' || !Array.isArray(file.sets ?? []))
    throw new MessageError(
      msg('load.unreadableProjectFile', { file: basename(path), error: 'dataFile missing' })
    )
  // i progetti creati prima di documenti e note non hanno le loro cartelle: si aggiungono vuote
  for (const sub of PROJECT_FOLDERS)
    await mkdir(join(folder, sub), { recursive: true }).catch(() => undefined)
  const warnings: Message[] = []
  if (file.formatVersion > FORMAT_VERSION) {
    warnings.push(msg('load.newerFormat', { version: file.formatVersion }))
  }

  // un progetto nuovo non ha ancora il file dati: si crea al primo salvataggio di un set
  const dataPath = join(folder, file.dataFile)
  const sheets: Sheet[] = (await exists(dataPath)) ? await readSpreadsheet(dataPath) : []
  const byName = new Map(sheets.map((s) => [s.name, s]))

  const sets = (file.sets ?? []).map((def) => {
    const data = byName.get(def.sheet ?? def.name) ?? null
    if (!data)
      warnings.push(msg('load.missingSheet', { set: def.name, sheet: def.sheet ?? def.name }))
    return { ...def, data }
  })
  const used = new Set(sets.map((s) => s.data?.name))

  const templates = await loadTemplates(folder, warnings)
  for (const s of sets) {
    if (!templates.some((t) => t.name === s.template)) {
      warnings.push(msg('load.missingTemplate', { set: s.name, template: s.template }))
    }
  }

  const assets = await listAssets(folder)
  // un file che non si riesce a riscrivere lo dirà il salvataggio
  const dataFileLosses =
    extname(dataPath).toLowerCase() === '.xlsx' && (await exists(dataPath))
      ? await xlsxLosses(dataPath).catch(() => [])
      : []
  return {
    folder,
    file,
    sets,
    unusedSheets: sheets.map((s) => s.name).filter((n) => !used.has(n)),
    unusedData: sheets.filter((s) => !used.has(s.name)),
    diskSheets: sheets.map((s) => s.name),
    templates,
    assets,
    fonts: await readProjectFonts(folder, assets),
    sources: await readSources(folder),
    notes: await readNotes(folder),
    documents: await readDocuments(folder),
    dataFileLosses,
    warnings
  }
}

async function loadTemplates(folder: string, warnings: Message[]): Promise<Template[]> {
  let files: string[]
  try {
    files = (await readdir(join(folder, 'templates'))).filter((f) => f.endsWith('.json'))
  } catch {
    return []
  }
  const templates: Template[] = []
  for (const f of files.sort()) {
    try {
      const raw = JSON.parse(await readFile(join(folder, 'templates', f), 'utf8'))
      const file = f.slice(0, -5)
      const t = normalizeTemplate({ ...raw, name: raw.name ?? file })
      if (t.name !== file) t.file = file
      // due file con lo stesso "name" dentro: vale il primo, l'altro non entra nel progetto
      const first = templates.find((x) => x.name === t.name)
      if (first) {
        warnings.push(
          msg('load.duplicateTemplate', {
            name: t.name,
            file: f,
            kept: `${first.file ?? first.name}.json`
          })
        )
        continue
      }
      templates.push(t)
    } catch (e) {
      const m = messageFromError(e)
      warnings.push(
        m.key === 'error.generic'
          ? msg('load.unreadableTemplate', { file: f, error: String(m.params?.text) })
          : { ...m, params: { ...m.params, file: f } }
      )
    }
  }
  // i derivati si completano dal loro base, che va letto prima
  const resolved = resolveTemplates(templates)
  warnings.push(...resolved.problems)
  for (const t of resolved.templates) {
    const dup = duplicateNames(t)
    if (dup.length)
      warnings.push(msg('load.duplicateLayers', { template: t.name, names: dup.join(', ') }))
  }
  return resolved.templates
}
