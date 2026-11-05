import { join } from './shims/path'
import { getFile } from './shims/fs'
import { listAssets } from '../main/project/assets'
import { isRemoteImage } from '../shared/model/assets'

// Immagini e font del progetto aperto come URL blob:, al posto del protocollo gc-asset:// dell'app
// desktop. Un URL blob di un File non copia i dati: il browser legge il file quando serve.

let folder: string | null = null
const urls = new Map<string, string>()

function clear(): void {
  for (const url of urls.values()) URL.revokeObjectURL(url)
  urls.clear()
}

async function add(path: string): Promise<void> {
  if (!folder) return
  const old = urls.get(path)
  try {
    urls.set(path, URL.createObjectURL(await getFile(join(folder, 'assets', path))))
  } catch {
    urls.delete(path)
  }
  if (old) URL.revokeObjectURL(old)
}

/** Prepara gli URL di tutti i file sotto assets/ del progetto */
export async function openAssets(projectFolder: string): Promise<void> {
  clear()
  folder = projectFolder
  for (const path of await listAssets(projectFolder)) await add(path)
}

/** Un file del progetto è cambiato: se è sotto assets/ il suo URL si rifà */
export async function assetChanged(path: string): Promise<void> {
  if (!folder) return
  const prefix = join(folder, 'assets') + '/'
  if (path.startsWith(prefix)) await add(path.slice(prefix.length))
}

export function assetUrl(path: string): string {
  // un'immagine collegata si carica dal suo indirizzo
  if (isRemoteImage(path)) return path.trim()
  return urls.get(path) ?? ''
}
