import { copyFile, mkdir, writeFile } from 'fs/promises'
import { basename, extname, join } from 'path'
import { imagesTarget } from '../../shared/model/imageUsage'
import { exists } from '../fs'

// Immagini scelte dal computer, copiate in assets/images/ del progetto (o nella cartella scelta). Un file con lo stesso
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
  files: { name: string; data: Uint8Array }[],
  target?: string
): Promise<string[]> {
  const sub = imagesTarget(target)
  const dir = join(folder, 'assets', sub)
  await mkdir(dir, { recursive: true })
  const out: string[] = []
  for (const f of files) {
    const file = await freeName(dir, basename(f.name))
    await writeFile(file, f.data)
    out.push(`${sub}/${basename(file)}`)
  }
  return out
}

export async function copyImages(folder: string, files: string[], target?: string): Promise<void> {
  const dir = join(folder, 'assets', imagesTarget(target))
  await mkdir(dir, { recursive: true })
  for (const f of files) await copyFile(f, await freeName(dir, basename(f)))
}
