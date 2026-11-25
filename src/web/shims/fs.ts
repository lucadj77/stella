import { Buffer } from 'buffer'
import { fsError, rootOf } from '../fs/roots'

// fs/promises di Node nella versione web, sopra la File System Access API: solo le funzioni che
// usa il codice del progetto (src/main/project, src/main/export/run.ts), con gli stessi codici
// d'errore (ENOENT, EEXIST), così quel codice gira com'è.

type Encoding =
  BufferEncoding | { encoding?: BufferEncoding | null; flag?: string; flush?: boolean } | null

/** Chiamato dopo ogni scrittura o eliminazione di un file, con il suo percorso */
let changeListener: ((path: string) => Promise<void>) | null = null

export function onFileChange(cb: ((path: string) => Promise<void>) | null): void {
  changeListener = cb
}

async function changed(path: string): Promise<void> {
  if (changeListener) await changeListener(path)
}

function encodingOf(opts: Encoding | undefined): BufferEncoding | null {
  if (!opts) return null
  return typeof opts === 'string' ? opts : (opts.encoding ?? null)
}

function notFound(e: unknown, path: string): Error {
  const name = (e as DOMException)?.name
  if (name === 'NotFoundError') return fsError('ENOENT', path)
  if (name === 'TypeMismatchError') return fsError('ENOTDIR', path)
  if (name === 'NotAllowedError') return fsError('EACCES', path)
  return e as Error
}

async function dirHandle(path: string, create = false): Promise<FileSystemDirectoryHandle> {
  const { handle, parts } = rootOf(path)
  let dir = handle
  try {
    for (const p of parts) dir = await dir.getDirectoryHandle(p, { create })
  } catch (e) {
    throw notFound(e, path)
  }
  return dir
}

async function parentAndName(path: string): Promise<[FileSystemDirectoryHandle, string]> {
  const i = path.replace(/\/+$/, '').lastIndexOf('/')
  const name = path.slice(i + 1)
  if (!name) throw fsError('EISDIR', path)
  return [await dirHandle(path.slice(0, i)), name]
}

async function fileHandle(path: string, create = false): Promise<FileSystemFileHandle> {
  const [dir, name] = await parentAndName(path)
  try {
    return await dir.getFileHandle(name, { create })
  } catch (e) {
    throw notFound(e, path)
  }
}

/** File o cartella al percorso, null se non c'è */
async function entry(path: string): Promise<FileSystemHandle | null> {
  const { parts } = rootOf(path)
  if (!parts.length) return rootOf(path).handle
  try {
    const [dir, name] = await parentAndName(path)
    try {
      return await dir.getFileHandle(name)
    } catch {
      return await dir.getDirectoryHandle(name)
    }
  } catch {
    return null
  }
}

export async function getFile(path: string): Promise<File> {
  try {
    return await (await fileHandle(path)).getFile()
  } catch (e) {
    throw notFound(e, path)
  }
}

/** File inclusi nella build (cataloghi), vedi assetFiles in vite.web.config.mts */
const BUILD_FILE = 'web-asset:'

export async function readFile(path: string, opts?: Encoding): Promise<string | Buffer> {
  const data = path.startsWith(BUILD_FILE)
    ? Buffer.from(await (await fetch(path.slice(BUILD_FILE.length))).arrayBuffer())
    : Buffer.from(await (await getFile(path)).arrayBuffer())
  const enc = encodingOf(opts)
  return enc ? data.toString(enc) : data
}

export async function writeFile(
  path: string,
  data: string | Uint8Array | ArrayBuffer,
  opts?: Encoding
): Promise<void> {
  const flag = opts && typeof opts === 'object' ? opts.flag : undefined
  if (flag === 'wx' && (await entry(path))) throw fsError('EEXIST', path)
  const handle = await fileHandle(path, true)
  const w = await handle.createWritable()
  try {
    const bytes = typeof data === 'string' ? Buffer.from(data, encodingOf(opts) ?? 'utf8') : data
    await w.write(bytes as FileSystemWriteChunkType)
    await w.close()
  } catch (e) {
    await w.abort().catch(() => undefined)
    throw e
  }
  await changed(path)
}

export async function access(path: string): Promise<void> {
  if (!(await entry(path))) throw fsError('ENOENT', path)
}

export async function mkdir(path: string, opts?: { recursive?: boolean }): Promise<void> {
  if (!opts?.recursive) {
    const [dir, name] = await parentAndName(path)
    if (await entry(path)) throw fsError('EEXIST', path)
    await dir.getDirectoryHandle(name, { create: true })
    return
  }
  await dirHandle(path, true)
}

interface Dirent {
  name: string
  isDirectory(): boolean
  isFile(): boolean
}

export async function readdir(
  path: string,
  opts?: { withFileTypes?: boolean }
): Promise<string[] | Dirent[]> {
  const dir = await dirHandle(path)
  const out: Dirent[] = []
  for await (const [name, h] of dir.entries())
    out.push({ name, isDirectory: () => h.kind === 'directory', isFile: () => h.kind === 'file' })
  out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  return opts?.withFileTypes ? out : out.map((d) => d.name)
}

export async function stat(path: string): Promise<{
  size: number
  mtimeMs: number
  isFile(): boolean
  isDirectory(): boolean
}> {
  const h = await entry(path)
  if (!h) throw fsError('ENOENT', path)
  if (h.kind === 'directory')
    return { size: 0, mtimeMs: 0, isFile: () => false, isDirectory: () => true }
  const f = await (h as FileSystemFileHandle).getFile()
  return { size: f.size, mtimeMs: f.lastModified, isFile: () => true, isDirectory: () => false }
}

export async function rm(
  path: string,
  opts?: { recursive?: boolean; force?: boolean }
): Promise<void> {
  try {
    const [dir, name] = await parentAndName(path)
    await dir.removeEntry(name, { recursive: !!opts?.recursive })
  } catch (e) {
    const err = notFound(e, path) as Error & { code?: string }
    if (opts?.force && err.code === 'ENOENT') return
    throw err
  }
  await changed(path)
}

export const unlink = (path: string): Promise<void> => rm(path)

export async function copyFile(from: string, to: string): Promise<void> {
  await writeFile(to, await (await getFile(from)).arrayBuffer())
}

/** Il browser non sposta i file: si copia e si cancella. Basta per i file temporanei .tmp */
export async function rename(from: string, to: string): Promise<void> {
  const h = await entry(from)
  if (!h) throw fsError('ENOENT', from)
  if (h.kind === 'directory') throw fsError('EISDIR', from)
  await copyFile(from, to)
  await rm(from)
}

const promises = {
  readFile,
  writeFile,
  access,
  mkdir,
  readdir,
  stat,
  rm,
  unlink,
  copyFile,
  rename
}

export default promises
