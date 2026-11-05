import { app, net } from 'electron'
import { createHash } from 'crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import { IMAGES_FOLDER, isValidAssetName, today, type AssetsUpdate } from '../../shared/library'
import { isRemoteImage } from '../../shared/model/assets'
import { MessageError, msg } from '../../shared/messages'
import { IMAGE_MIME, imageExtension } from '../../shared/model/remoteUrl'
import { assetsUpdate, readSources, updateSources } from './sources'

// Immagini da internet (docs/specifica.md, 3.1): scaricate in assets/images/ con l'indirizzo
// d'origine in sources.json, oppure collegate con https://... e tenute in una cache di questo
// computer, fuori dal progetto.

const MAX_BYTES = 50 * 1024 * 1024
const TIMEOUT = 30_000

async function fetchImage(url: string): Promise<{ data: Uint8Array; ext: string }> {
  if (!isRemoteImage(url)) throw new MessageError(msg('urlImage.badUrl', { url }))
  let res: Response
  try {
    res = await net.fetch(url, { signal: AbortSignal.timeout(TIMEOUT) })
  } catch (e) {
    throw new MessageError(
      msg('urlImage.unreachable', { url, error: e instanceof Error ? e.message : String(e) })
    )
  }
  if (!res.ok) throw new MessageError(msg('urlImage.http', { url, status: res.status }))
  const ext = imageExtension(url, res.headers.get('content-type'))
  if (!ext) throw new MessageError(msg('urlImage.notImage', { url }))
  const data = new Uint8Array(await res.arrayBuffer())
  if (data.length > MAX_BYTES) throw new MessageError(msg('urlImage.tooBig', { url }))
  return { data, ext }
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file)
    return true
  } catch {
    return false
  }
}

/** Scarica un'immagine in assets/images/<name> e ne ricorda l'indirizzo */
export async function downloadImage(
  folder: string,
  url: string,
  name: string
): Promise<{ update: AssetsUpdate; path: string }> {
  if (!isValidAssetName(name)) throw new MessageError(msg('icons.invalidName', { name }))
  const { data, ext } = await fetchImage(url.trim())
  const path = `${IMAGES_FOLDER}/${name}${ext}`
  const file = join(folder, 'assets', path)
  const sources = await readSources(folder)
  // lo stesso file scaricato dallo stesso indirizzo si può sovrascrivere, un altro no
  if ((await exists(file)) && sources[path]?.url !== url.trim())
    throw new MessageError(msg('urlImage.exists', { name: path }))
  await mkdir(join(folder, 'assets', IMAGES_FOLDER), { recursive: true })
  await writeFile(file, data)
  const host = new URL(url).hostname
  const entries = {
    [path]: {
      kind: 'image' as const,
      source: host,
      id: url.trim(),
      title: name,
      license: '',
      url: url.trim(),
      imported: today()
    }
  }
  return { update: await assetsUpdate(folder, await updateSources(folder, entries)), path }
}

/** Riscarica un'immagine scaricata in precedenza, dallo stesso indirizzo */
export async function redownloadImage(folder: string, path: string): Promise<AssetsUpdate> {
  const sources = await readSources(folder)
  const entry = sources[path]
  if (entry?.kind !== 'image' || !entry.url)
    throw new MessageError(msg('urlImage.noSource', { name: path }))
  const { data, ext } = await fetchImage(entry.url)
  const old = path.slice(path.lastIndexOf('.')).toLowerCase()
  if (ext !== (old === '.jpeg' ? '.jpg' : old))
    throw new MessageError(msg('urlImage.typeChanged', { name: path, ext }))
  await writeFile(join(folder, 'assets', path), data)
  return assetsUpdate(
    folder,
    await updateSources(folder, { [path]: { ...entry, imported: today() } })
  )
}

// cache delle immagini collegate: un file per indirizzo, con accanto il tipo

const cacheDir = (): string => join(app.getPath('userData'), 'remote-images')
const cacheKey = (url: string): string => createHash('sha256').update(url).digest('hex')
const pending = new Map<string, Promise<{ data: Uint8Array; type: string } | null>>()

async function cached(url: string): Promise<{ data: Uint8Array; type: string } | null> {
  const base = join(cacheDir(), cacheKey(url))
  try {
    const [data, type] = await Promise.all([readFile(base), readFile(base + '.type', 'utf8')])
    return { data, type }
  } catch {
    return null
  }
}

/** Un'immagine collegata: dalla cache se c'è, altrimenti da internet (e poi nella cache) */
export async function remoteImage(url: string): Promise<{ data: Uint8Array; type: string } | null> {
  const hit = await cached(url)
  if (hit) return hit
  if (!pending.has(url))
    pending.set(
      url,
      (async () => {
        try {
          const { data, ext } = await fetchImage(url)
          const base = join(cacheDir(), cacheKey(url))
          await mkdir(cacheDir(), { recursive: true })
          await writeFile(base, data)
          await writeFile(base + '.type', IMAGE_MIME[ext])
          return { data, type: IMAGE_MIME[ext] }
        } catch {
          return null
        } finally {
          pending.delete(url)
        }
      })()
    )
  return pending.get(url)!
}

/** Toglie dalla cache le immagini collegate, che al prossimo disegno si riscaricano */
export async function forgetRemoteImages(urls: string[]): Promise<void> {
  for (const url of urls) {
    const base = join(cacheDir(), cacheKey(url))
    await rm(base, { force: true })
    await rm(base + '.type', { force: true })
  }
}
