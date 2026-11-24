import JSZip from 'jszip'
import { mkdir, readFile, readdir, writeFile } from 'fs/promises'
import { join, relative, resolve, sep } from 'path'
import { exists } from '../fs'
import { MessageError, msg } from '../../shared/messages'
import { LEGACY_PROJECT_FILES, PROJECT_FILE } from '../../shared/project'
import { projectFolderName } from '../../shared/model/projectName'
import type { ProjectZipSummary } from '../../shared/api'

// Un progetto intero in un file ZIP, per mandarlo a qualcuno o spostarlo: dentro ci sono i file
// della cartella del progetto (senza export/, deleted/ e i file nascosti), alla radice. Si importa estraendolo in una
// cartella nuova. Diverso dai pacchetti (package.ts), che portano un template o un set dentro un
// progetto già aperto, e dai backup (backup.ts), che tengono le immagini fuori dallo ZIP.

const PROJECT_FILES = [PROJECT_FILE, ...LEGACY_PROJECT_FILES]
/** Estensioni già compresse: zipparle di nuovo costa tempo senza ridurle */
const STORED = ['.png', '.jpg', '.jpeg', '.webp', '.zip', '.woff', '.woff2', '.gz', '.xlsx', '.ods']
const IMAGE = /\.(png|jpe?g|webp|gif|svg|avif|bmp)$/i
const FONT = /\.(ttf|otf|woff2?)$/i

/** File del progetto da mettere nello ZIP, relativi e con "/" */
async function projectFiles(folder: string): Promise<string[]> {
  const skip = [join(folder, 'export'), join(folder, 'deleted')]
  const out: string[] = []
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const full = join(dir, entry.name)
      if (skip.includes(full)) continue
      if (entry.isDirectory()) await walk(full)
      else if (entry.isFile()) out.push(relative(folder, full).split(sep).join('/'))
    }
  }
  await walk(folder)
  return out.sort()
}

/**
 * Lo ZIP del progetto, com'è sul disco, con i file alla radice: importandolo (o estraendolo con
 * Finder o Esplora file) la cartella prende il nome dello ZIP. Gli ZIP della 1.13, con i file in
 * una cartella, si importano lo stesso (projectRoot)
 */
export async function buildProjectZip(folder: string): Promise<Uint8Array> {
  const root = resolve(folder)
  const zip = new JSZip()
  for (const f of await projectFiles(root)) {
    const lower = f.toLowerCase()
    zip.file(f, await readFile(join(root, f)), {
      compression: STORED.some((e) => lower.endsWith(e)) ? 'STORE' : 'DEFLATE'
    })
  }
  return zip.generateAsync({ type: 'uint8array' })
}

/** La cartella dentro lo ZIP che contiene stella.json ('' se sta alla radice), o null */
function projectRoot(zip: JSZip): string | null {
  let best: string | null = null
  for (const name of Object.keys(zip.files)) {
    if (name.startsWith('__MACOSX/') || zip.files[name].dir) continue
    const parts = name.split('/')
    const file = parts.pop()!.toLowerCase()
    // alla radice o in una sola cartella: lo ZIP di una cartella di progetto
    if (!PROJECT_FILES.includes(file) || parts.length > 1) continue
    const prefix = parts.length ? parts[0] + '/' : ''
    if (best === null || prefix.length < best.length) best = prefix
  }
  return best
}

async function openZip(data: Uint8Array): Promise<JSZip | null> {
  try {
    return await JSZip.loadAsync(data)
  } catch {
    return null
  }
}

/** Che cosa contiene lo ZIP di un progetto; null se non è il progetto di Stella */
export async function inspectProjectZip(data: Uint8Array): Promise<ProjectZipSummary | null> {
  const zip = await openZip(data)
  if (!zip) return null
  const prefix = projectRoot(zip)
  if (prefix === null) return null
  const files = Object.values(zip.files).filter(
    (f) => !f.dir && f.name.startsWith(prefix) && !f.name.startsWith('__MACOSX/')
  )
  const rel = files.map((f) => f.name.slice(prefix.length))
  const projectFile = rel.find((n) => PROJECT_FILES.includes(n.toLowerCase()))!
  let file: { name?: string; dataFile?: string; sets?: { name?: string }[] } = {}
  try {
    file = JSON.parse(await zip.file(prefix + projectFile)!.async('string'))
  } catch {
    // stella.json rovinato: lo dirà l'apertura del progetto
  }
  const count = (re: RegExp): number => rel.filter((n) => re.test(n)).length
  const name = typeof file.name === 'string' && file.name.trim() ? file.name.trim() : ''
  const folderName = prefix.slice(0, -1) || projectFolderName(name) || 'project'
  return {
    name: name || folderName,
    folderName,
    sets: (Array.isArray(file.sets) ? file.sets : [])
      .map((s) => (typeof s?.name === 'string' ? s.name : ''))
      .filter(Boolean),
    templates: count(/^templates\/[^/]+\.json$/i),
    documents: count(/^docs\/[^/]+\.md$/i),
    notes: count(/^notes\/[^/]+\.md$/i),
    images: rel.filter(
      (n) => n.startsWith('assets/') && !n.startsWith('assets/fonts/') && IMAGE.test(n)
    ).length,
    fonts: rel.filter((n) => n.startsWith('assets/fonts/') && FONT.test(n)).length,
    dataFile:
      typeof file.dataFile === 'string' && rel.includes(file.dataFile) ? file.dataFile : null,
    files: files.length
  }
}

/**
 * Estrae lo ZIP di un progetto nella cartella nuova parent/name e restituisce la cartella. Una
 * cartella che esiste già e non è vuota non si tocca.
 */
export async function extractProjectZip(
  data: Uint8Array,
  parent: string,
  name: string
): Promise<string> {
  const zip = await openZip(data)
  const prefix = zip ? projectRoot(zip) : null
  if (!zip || prefix === null) throw new MessageError(msg('projectZip.notProjectZip'))
  const clean = projectFolderName(name)
  if (!clean) throw new MessageError(msg('projectZip.badName'))
  const root = resolve(parent, clean)
  if ((await exists(root)) && (await readdir(root)).some((n) => !n.startsWith('.')))
    throw new MessageError(msg('projectZip.targetExists', { folder: root }))
  await mkdir(root, { recursive: true })
  for (const entry of Object.values(zip.files)) {
    if (entry.dir || !entry.name.startsWith(prefix) || entry.name.startsWith('__MACOSX/')) continue
    const relName = entry.name.slice(prefix.length)
    if (relName.split('/').some((p) => p.startsWith('._'))) continue
    // un nome come ../x uscirebbe dalla cartella: si ignora
    const out = resolve(root, relName)
    if (!out.startsWith(root + sep)) continue
    await mkdir(resolve(out, '..'), { recursive: true })
    await writeFile(out, await entry.async('uint8array'))
  }
  return root
}
