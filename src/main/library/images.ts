import { copyFile, mkdir, writeFile } from 'fs/promises'
import { basename, extname, join } from 'path'
import { IMAGES_FOLDER } from '../../shared/library'
import { exists } from '../fs'

// Immagini scelte dal computer, copiate in assets/images/ del progetto. Un file con lo stesso
// nome non si sovrascrive: la copia prende un numero, come "mappa 2.png".

/** Percorso libero in dir per il file name */
export async function freeName(dir: string, name: string): Promise<string> {
  const ext = extname(name)
  const base = basename(name, ext)
  let target = join(dir, name)
  for (let n = 2; await exists(target); n++) target = join(dir, `${base} ${n}${ext}`)
  return target
}

/** Scrive in assets/images/ le immagini trascinate nella finestra; restituisce i loro percorsi in assets/ */
export async function writeImages(
  folder: string,
  files: { name: string; data: Uint8Array }[]
): Promise<string[]> {
  const dir = join(folder, 'assets', IMAGES_FOLDER)
  await mkdir(dir, { recursive: true })
  const out: string[] = []
  for (const f of files) {
    const target = await freeName(dir, basename(f.name))
    await writeFile(target, f.data)
    out.push(`${IMAGES_FOLDER}/${basename(target)}`)
  }
  return out
}

export async function copyImages(folder: string, files: string[]): Promise<void> {
  const dir = join(folder, 'assets', IMAGES_FOLDER)
  await mkdir(dir, { recursive: true })
  for (const f of files) await copyFile(f, await freeName(dir, basename(f)))
}
