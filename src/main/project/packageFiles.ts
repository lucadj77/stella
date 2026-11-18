import { mkdir, readFile, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import type { AssetsUpdate, Sources } from '../../shared/library'
import { MessageError, msg } from '../../shared/messages'
import { assetsUpdate, updateSources } from '../library/sources'
import { listAssets } from './assets'
import { trashImages } from './imageFiles'

// File degli asset per i pacchetti di template e set (model/package.ts): si leggono per metterli
// nello ZIP e si scrivono all'importazione.

const safe = (p: string): boolean =>
  !!p && !p.includes('\\') && !p.split('/').some((x) => !x || x === '.' || x === '..')

/** I byte dei file sotto assets/ */
export async function readAssetFiles(
  folder: string,
  paths: string[]
): Promise<{ path: string; data: Uint8Array }[]> {
  const assets = new Set(await listAssets(folder))
  const out: { path: string; data: Uint8Array }[] = []
  for (const p of paths) {
    if (!assets.has(p) || !safe(p)) throw new MessageError(msg('images.notFound', { file: p }))
    out.push({
      path: p,
      data: new Uint8Array(await readFile(join(folder, 'assets', ...p.split('/'))))
    })
  }
  return out
}

/**
 * Scrive file sotto assets/ (sovrascrivendo), dopo aver messo nel cestino le immagini che
 * sostituiscono con un altro nome, e aggiunge le loro voci a sources.json
 */
export async function writeAssetFiles(
  folder: string,
  files: { path: string; data: Uint8Array }[],
  replaced: string[],
  sources: Sources
): Promise<AssetsUpdate> {
  for (const f of files)
    if (!safe(f.path)) throw new MessageError(msg('package.badFile', { file: f.path }))
  if (replaced.length) await trashImages(folder, replaced)
  for (const f of files) {
    const target = join(folder, 'assets', ...f.path.split('/'))
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, f.data)
  }
  return assetsUpdate(folder, await updateSources(folder, sources))
}
