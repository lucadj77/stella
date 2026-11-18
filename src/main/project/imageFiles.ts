import { mkdir, readdir, readFile, rename, rm, writeFile } from 'fs/promises'
import { dirname, join, relative, sep } from 'path'
import type { AssetsUpdate, Sources } from '../../shared/library'
import { MessageError, msg } from '../../shared/messages'
import type { DeletedItem } from '../../shared/project'
import { isImageAsset } from '../../shared/model/assets'
import { baseOf, cleanFolder } from '../../shared/model/imageUsage'
import { assetsUpdate, readSources, updateSources } from '../library/sources'
import { exists } from '../fs'
import { freeName } from '../library/images'
import { listAssets } from './assets'

// Eliminare e spostare le immagini di assets/ dalla finestra Immagini del progetto. Le immagini
// eliminate vanno in deleted/assets/<data e ora>/<percorso in assets>, con le loro voci di
// sources.json accanto, e da lì si ripristinano al loro posto. Vedi docs/specifica.md, 3.1.

const TRASH = 'assets'
const STAMP = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})$/
const META = 'sources.json'

/** Un percorso di assets/ esistente e di un'immagine: niente da toccare fuori da assets/ */
async function checkedPaths(folder: string, paths: string[]): Promise<string[]> {
  const assets = new Set(await listAssets(folder))
  for (const p of paths)
    if (!assets.has(p) || !isImageAsset(p) || p.split('/').includes('..'))
      throw new MessageError(msg('images.notFound', { file: p }))
  return [...new Set(paths)]
}

/** Toglie le cartelle rimaste vuote da `dir` fino a `root` (esclusa) */
async function pruneEmpty(root: string, dir: string): Promise<void> {
  while (dir !== root && dir.startsWith(root + sep)) {
    try {
      if ((await readdir(dir)).length) return
      await rm(dir, { recursive: true })
    } catch {
      return
    }
    dir = dirname(dir)
  }
}

const parentOf = dirname

/** Sposta le immagini nel cestino del progetto */
export async function trashImages(folder: string, paths: string[]): Promise<AssetsUpdate> {
  const list = await checkedPaths(folder, paths)
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const dir = join(folder, 'deleted', TRASH, stamp)
  const sources = await readSources(folder)
  const kept: Sources = {}
  let previous: Sources = {}
  try {
    previous = JSON.parse(await readFile(join(dir, META), 'utf8'))
  } catch {
    // primo elenco di questa eliminazione
  }
  for (const p of list) {
    const target = join(dir, ...p.split('/'))
    await mkdir(parentOf(target), { recursive: true })
    await rename(join(folder, 'assets', ...p.split('/')), target)
    if (sources[p]) kept[p] = sources[p]
    await pruneEmpty(join(folder, 'assets'), parentOf(join(folder, 'assets', ...p.split('/'))))
  }
  if (Object.keys(kept).length)
    await writeFile(join(dir, META), JSON.stringify({ ...previous, ...kept }, null, 2) + '\n')
  return assetsUpdate(folder, await updateSources(folder, {}))
}

/**
 * Sposta le immagini in `target` (cartella sotto assets/, '' per la radice). Si ferma prima di
 * spostare se nella cartella c'è già un file con lo stesso nome, perché cambiarlo romperebbe i
 * riferimenti. Restituisce i percorsi vecchi e nuovi.
 */
export async function moveImages(
  folder: string,
  paths: string[],
  target: string
): Promise<{ update: AssetsUpdate; moves: { from: string; to: string }[] }> {
  const dest = cleanFolder(target)
  if (dest === null) throw new MessageError(msg('images.badFolder', { folder: target }))
  const list = await checkedPaths(folder, paths)
  const assets = new Set((await listAssets(folder)).map((a) => a.toLowerCase()))
  const moves = list.map((from) => ({ from, to: [dest, baseOf(from)].filter(Boolean).join('/') }))
  const names = new Set<string>()
  for (const m of moves) {
    const key = m.to.toLowerCase()
    if (m.from === m.to) continue
    if (assets.has(key) || names.has(key))
      throw new MessageError(msg('images.exists', { file: m.to }))
    names.add(key)
  }
  const sources = await readSources(folder)
  const moved: Sources = {}
  const root = join(folder, 'assets')
  for (const m of moves) {
    if (m.from === m.to) continue
    const to = join(root, ...m.to.split('/'))
    await mkdir(parentOf(to), { recursive: true })
    await rename(join(root, ...m.from.split('/')), to)
    if (sources[m.from]) moved[m.to] = sources[m.from]
    await pruneEmpty(root, parentOf(join(root, ...m.from.split('/'))))
  }
  return {
    update: await assetsUpdate(folder, await updateSources(folder, moved)),
    moves: moves.filter((m) => m.from !== m.to)
  }
}

/** Immagini nel cestino: un elemento per file, `file` è `assets/<data e ora>/<percorso>` */
export async function listDeletedImages(folder: string): Promise<DeletedItem[]> {
  const root = join(folder, 'deleted', TRASH)
  let stamps: string[]
  try {
    stamps = (await readdir(root)) as string[]
  } catch {
    return []
  }
  const out: DeletedItem[] = []
  for (const stamp of stamps) {
    const m = STAMP.exec(stamp)
    if (!m) continue
    const date = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`
    const walk = async (dir: string, rel: string[]): Promise<void> => {
      let entries
      try {
        entries = await readdir(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const e of entries) {
        if (e.name.startsWith('.')) continue
        if (e.isDirectory()) await walk(join(dir, e.name), [...rel, e.name])
        else if (isImageAsset(e.name)) {
          const path = [...rel, e.name].join('/')
          out.push({ file: `${TRASH}/${stamp}/${path}`, kind: 'image', name: path, date })
        }
      }
    }
    await walk(join(root, stamp), [])
  }
  return out
}

/** Divide `assets/<data e ora>/<percorso>` controllando che non esca dal cestino */
export function splitDeletedImage(file: string): { stamp: string; path: string } | null {
  const parts = file.split('/')
  if (parts.length < 3 || parts[0] !== TRASH || !STAMP.test(parts[1])) return null
  const rest = parts.slice(2)
  if (rest.some((p) => !p || p === '.' || p === '..' || p.includes('\\'))) return null
  if (!isImageAsset(rest[rest.length - 1])) return null
  return { stamp: parts[1], path: rest.join('/') }
}

/**
 * Rimette le immagini al loro posto in assets/ (con un nome libero se nel frattempo ce n'è
 * un'altra) e con le loro voci di sources.json
 */
export async function restoreImages(
  folder: string,
  files: string[]
): Promise<{ update: AssetsUpdate; paths: string[] }> {
  const root = join(folder, 'assets')
  const sources: Sources = {}
  const paths: string[] = []
  for (const file of files) {
    const s = splitDeletedImage(file)
    if (!s) throw new MessageError(msg('trash.unknownFile', { file }))
    const stampDir = join(folder, 'deleted', TRASH, s.stamp)
    const from = join(stampDir, ...s.path.split('/'))
    const wanted = join(root, ...s.path.split('/'))
    await mkdir(parentOf(wanted), { recursive: true })
    const to = (await exists(wanted)) ? await freeName(parentOf(wanted), baseOf(s.path)) : wanted
    await rename(from, to)
    const rel = relative(root, to).split(sep).join('/')
    paths.push(rel)
    try {
      const meta = JSON.parse(await readFile(join(stampDir, META), 'utf8')) as Sources
      if (meta[s.path]) sources[rel] = meta[s.path]
    } catch {
      // nessuna voce
    }
    await pruneEmpty(join(folder, 'deleted', TRASH), parentOf(from))
    await dropMetaIfAlone(stampDir)
  }
  return { update: await assetsUpdate(folder, await updateSources(folder, sources)), paths }
}

/** Una cartella di eliminazione con il solo sources.json non serve più */
async function dropMetaIfAlone(stampDir: string): Promise<void> {
  try {
    const left = (await readdir(stampDir)) as string[]
    if (left.length === 1 && left[0] === META) await rm(stampDir, { recursive: true })
  } catch {
    // già tolta
  }
}

/** Toglie definitivamente immagini dal cestino */
export async function dropDeletedImages(folder: string, files: string[]): Promise<void> {
  for (const file of files) {
    const s = splitDeletedImage(file)
    if (!s) continue
    const stampDir = join(folder, 'deleted', TRASH, s.stamp)
    const path = join(stampDir, ...s.path.split('/'))
    await rm(path, { force: true })
    await pruneEmpty(join(folder, 'deleted', TRASH), parentOf(path))
    await dropMetaIfAlone(stampDir)
  }
}
