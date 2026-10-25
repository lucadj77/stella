import { mkdir, writeFile } from './shims/fs'
import { join } from './shims/path'
import {
  FONTS_FOLDER,
  IMAGES_FOLDER,
  today,
  type AssetsUpdate,
  type FontVariant,
  type Sources,
  type SystemFontFamily
} from '../shared/library'
import { MessageError, msg } from '../shared/messages'
import { fontCatalog } from '../main/library/catalogs'
import { fetchLicense } from '../main/library/googleFonts'
import { cssUrl } from '../main/library/fontCss'
import { assetsUpdate, updateSources } from '../main/library/sources'
import { fontInfo } from '../main/project/fonts'
import { freeName } from '../main/library/images'
import { IMAGE_EXTENSIONS } from '../shared/model/assets'

// Font e immagini nella versione web, dove il codice dell'app desktop non va bene così com'è:
// Google Fonts dà al browser file WOFF2 divisi per alfabeto, e i font del computer si leggono con
// la Local Font Access API invece che dalle cartelle del sistema.

async function get(url: string): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url)
  } catch (e) {
    throw new MessageError(msg('fonts.network', { error: String((e as Error).message ?? e) }))
  }
  if (!res.ok) throw new MessageError(msg('fonts.httpError', { status: res.status, url }))
  return res
}

/** Blocchi @font-face del CSS di Google per l'alfabeto latino, l'unico che si salva */
function latinFaces(css: string): { italic: boolean; weight: number; url: string }[] {
  const out: { italic: boolean; weight: number; url: string }[] = []
  for (const m of css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*{([^}]*)}/g)) {
    if (m[1] !== 'latin') continue
    const url = /src:\s*url\(([^)]+)\)/.exec(m[2])?.[1]
    const weight = Number(/font-weight:\s*(\d+)/.exec(m[2])?.[1] ?? 400)
    if (url) out.push({ italic: /font-style:\s*italic/.test(m[2]), weight, url })
  }
  return out
}

/**
 * Scarica un font Google in assets/fonts/<famiglia>/. Nel browser Google dà file WOFF2 divisi per
 * alfabeto: si salva quello latino (lettere accentate comprese), un file per peso e stile.
 */
export async function downloadGoogleFont(
  folder: string,
  family: string,
  variants: FontVariant[]
): Promise<AssetsUpdate> {
  const entry = (await fontCatalog()).families.find((f) => f[0] === family)
  if (!entry) throw new MessageError(msg('fonts.unknown', { family }))
  if (!variants.length) throw new MessageError(msg('fonts.noVariant'))
  const faces = latinFaces(await (await get(cssUrl(family, variants))).text())
  if (!faces.length) throw new MessageError(msg('fonts.noFiles', { family }))

  const dir = join(folder, 'assets', FONTS_FOLDER, family)
  await mkdir(dir, { recursive: true })
  const lic = await fetchLicense(family, entry[5])
  const license = lic?.license ?? (entry[5] || 'OFL-1.1')
  if (lic) await writeFile(join(dir, lic.file), lic.text)

  const base = family.replace(/[^\p{L}\p{N}]/gu, '')
  const entries: Sources = {}
  for (const f of faces) {
    const file = `${base}-${f.weight}${f.italic ? '-italic' : ''}.woff2`
    await writeFile(join(dir, file), new Uint8Array(await (await get(f.url)).arrayBuffer()))
    entries[`${FONTS_FOLDER}/${family}/${file}`] = {
      kind: 'font',
      source: 'Google Fonts',
      id: family,
      title: `${family} ${f.weight}${f.italic ? ' italic' : ''}`,
      ...(entry[6] ? { author: entry[6] } : {}),
      license,
      url: `https://fonts.google.com/specimen/${family.replace(/ /g, '+')}`,
      imported: today()
    }
  }
  return assetsUpdate(folder, await updateSources(folder, entries))
}

// ——— Font del computer ———

interface LocalFont {
  family: string
  fullName: string
  postscriptName: string
  style: string
  blob(): Promise<Blob>
}

type FontWindow = Window & { queryLocalFonts?: () => Promise<LocalFont[]> }

let local: Promise<Map<string, LocalFont[]>> | null = null

/** Font installati per famiglia; il browser chiede il permesso la prima volta */
function localFonts(): Promise<Map<string, LocalFont[]>> {
  local ??= (async () => {
    const query = (window as FontWindow).queryLocalFonts
    if (!query) throw new MessageError(msg('web.noLocalFonts'))
    let fonts: LocalFont[]
    try {
      fonts = await query.call(window)
    } catch {
      throw new MessageError(msg('web.noLocalFonts'))
    }
    const out = new Map<string, LocalFont[]>()
    for (const f of fonts) {
      if (f.family.startsWith('.')) continue
      const key = f.family.toLowerCase()
      out.set(key, [...(out.get(key) ?? []), f])
    }
    return out
  })()
  local.catch(() => (local = null))
  return local
}

export async function systemFonts(): Promise<SystemFontFamily[]> {
  // se un file è una raccolta o vieta l'incorporamento si scopre solo copiandolo
  return [...(await localFonts()).values()]
    .map((faces) => ({ family: faces[0].family, styles: faces.length, copyable: true }))
    .sort((a, b) => a.family.localeCompare(b.family))
}

/** Il produttore vieta l'incorporamento: bit 1 di fsType nella tabella OS/2 */
function restricted(data: DataView): boolean {
  const n = data.getUint16(4)
  for (let i = 0; i < n; i++) {
    const r = 12 + i * 16
    if (String.fromCharCode(...new Uint8Array(data.buffer, r, 4)) !== 'OS/2') continue
    const offset = data.getUint32(r + 8)
    return (data.getUint16(offset + 8) & 0x0002) !== 0
  }
  return false
}

export async function copySystemFont(folder: string, family: string): Promise<AssetsUpdate> {
  const faces = (await localFonts()).get(family.toLowerCase()) ?? []
  const name = faces[0]?.family ?? family
  const dir = join(folder, 'assets', FONTS_FOLDER, name.replace(/[\\/:*?"<>|]/g, ''))
  const entries: Sources = {}
  for (const f of faces) {
    const data = new Uint8Array(await (await f.blob()).arrayBuffer())
    const view = new DataView(data.buffer)
    const sig = String.fromCharCode(...data.subarray(0, 4))
    // una raccolta (ttc) contiene più font: il progetto usa solo file con un font
    if (data.length < 12 || sig === 'ttcf' || restricted(view)) continue
    const file = `${f.postscriptName.replace(/[\\/:*?"<>|]/g, '_')}${sig === 'OTTO' ? '.otf' : '.ttf'}`
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, file), data)
    const info = fontInfo(Buffer.from(data))
    entries[`${FONTS_FOLDER}/${dir.split('/').pop()}/${file}`] = {
      kind: 'font',
      source: 'computer',
      id: name,
      title: info
        ? `${name} ${info.weight}${info.style === 'italic' ? ' italic' : ''}`
        : f.fullName,
      license: 'unknown',
      imported: today()
    }
  }
  if (!Object.keys(entries).length) throw new MessageError(msg('fonts.cannotCopy', { family }))
  return assetsUpdate(folder, await updateSources(folder, entries))
}

// ——— Immagini ———

type PickerWindow = Window & {
  showOpenFilePicker?: (o: {
    multiple?: boolean
    id?: string
    types?: { description: string; accept: Record<string, string[]> }[]
  }) => Promise<FileSystemFileHandle[]>
}

/** Scrive in assets/images/ le immagini trascinate nella finestra */
export async function dropImages(
  folder: string,
  files: { name: string; data: Uint8Array }[]
): Promise<{ update: AssetsUpdate; paths: string[] }> {
  const dir = join(folder, 'assets', IMAGES_FOLDER)
  await mkdir(dir, { recursive: true })
  const paths: string[] = []
  for (const f of files) {
    const target = await freeName(dir, f.name)
    await writeFile(target, f.data)
    paths.push(`${IMAGES_FOLDER}/${target.slice(target.lastIndexOf('/') + 1)}`)
  }
  return { update: await assetsUpdate(folder), paths }
}

/** Copia in assets/images/ le immagini scelte; null se l'utente annulla */
export async function addImages(folder: string): Promise<AssetsUpdate | null> {
  let handles: FileSystemFileHandle[]
  try {
    handles = await (window as PickerWindow).showOpenFilePicker!({
      multiple: true,
      id: 'stella-images',
      types: [{ description: 'Images', accept: { 'image/*': IMAGE_EXTENSIONS } }]
    })
  } catch (e) {
    if ((e as DOMException).name === 'AbortError') return null
    throw e
  }
  const dir = join(folder, 'assets', IMAGES_FOLDER)
  await mkdir(dir, { recursive: true })
  for (const h of handles) {
    const file = await h.getFile()
    await writeFile(await freeName(dir, file.name), new Uint8Array(await file.arrayBuffer()))
  }
  return assetsUpdate(folder)
}
