import JSZip from 'jszip'
import { createHash } from 'crypto'
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'fs/promises'
import { basename, dirname, extname, join, relative, resolve, sep } from 'path'
import { exists } from '../fs'
import type { BackupItem, BackupSettings } from '../../shared/api'

// Copie di sicurezza del progetto: un file zip con la cartella del progetto, tranne export/ e i
// file nascosti, in una cartella fuori dal progetto (così non finisce nei backup successivi e
// non si sincronizza con il progetto). Vedi docs/specifica.md, sezione 12.
// I file di assets/ (immagini, font) cambiano di rado: non vanno nello zip ma in una cartella
// comune a tutti i backup del progetto, una sola volta per contenuto, con il nome dato dal loro
// hash; lo zip ne contiene l'elenco. Così dieci backup non sono dieci copie delle immagini.

export const DEFAULT_BACKUP_SETTINGS: BackupSettings = { folder: '', auto: true, keep: 10 }

/** Un backup automatico non si ripete se l'ultimo ha meno di un'ora */
const AUTO_MIN_INTERVAL = 60 * 60 * 1000

/** Estensioni già compresse: zipparle di nuovo costa tempo senza ridurle */
const STORED = ['.png', '.jpg', '.jpeg', '.webp', '.zip', '.woff', '.woff2', '.gz']

/** Nome della sottocartella dei backup di un progetto */
export function backupDirName(projectName: string): string {
  return projectName.replace(/[\\/:*?"<>|]/g, '-').trim() || 'progetto'
}

/** File nella cartella dei backup che dice a quale progetto (cartella) appartiene */
const OWNER = '.stella-project'
/** Lo stesso file, scritto quando l'app si chiamava Naibi */
const OLD_OWNER = '.naibi-project'

/**
 * Cartella dei backup del progetto `folder` dentro `root`: `<nome>`, oppure `<nome> 2`, `<nome> 3`...
 * se un altro progetto con lo stesso nome la usa già. Una cartella senza il file di proprietà
 * (backup di versioni precedenti) viene presa dal primo progetto che la usa.
 */
export async function projectBackupDir(
  root: string,
  name: string,
  folder: string
): Promise<string> {
  const mine = resolve(folder)
  for (let n = 1; ; n++) {
    const dir = join(root, n === 1 ? name : `${name} ${n}`)
    const marker = join(dir, OWNER)
    let owner: string | null = null
    for (const file of [marker, join(dir, OLD_OWNER)]) {
      try {
        owner = JSON.parse(await readFile(file, 'utf8')).folder
        break
      } catch {
        // cartella nuova o senza proprietario
      }
    }
    if (owner === mine) return dir
    if (owner === null) {
      // il proprietario si scrive solo se la cartella esiste già (o al primo backup): elencare
      // i backup di un progetto nuovo non deve creare cartelle
      if (await exists(dir)) await writeFile(marker, JSON.stringify({ folder: mine }) + '\n')
      return dir
    }
  }
}

function stamp(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}`
}

/** Cartella comune dei file di assets/, dentro la cartella dei backup del progetto */
const STORE = 'assets'
/** Elenco dei file di assets/ nello zip: percorso nel progetto → file nella cartella comune */
export const MANIFEST = 'stella-backup.json'
/** Il manifesto dei backup fatti quando l'app si chiamava Naibi */
const OLD_MANIFEST = 'naibi-backup.json'
/** File del backup che non fanno parte del progetto */
export const isManifest = (name: string): boolean => name === MANIFEST || name === OLD_MANIFEST

interface Manifest {
  version: 1
  assets: Record<string, string>
}

const NAME_RE = /^(.*) (\d{4})-(\d\d)-(\d\d) (\d\d)\.(\d\d)\.(\d\d)( auto)?(?: - (.+))?\.zip$/

/**
 * Nome dato a un backup fatto a mano, scritto nel nome del file dopo la data: senza i caratteri
 * che i sistemi non accettano nei nomi dei file, su una riga, non troppo lungo
 */
export function cleanBackupLabel(label: string | undefined): string {
  return (label ?? '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.+$/, '')
    .slice(0, 80)
    .trim()
}

export async function listBackups(dir: string): Promise<BackupItem[]> {
  let names: string[]
  try {
    names = await readdir(dir)
  } catch {
    return []
  }
  const items: BackupItem[] = []
  for (const name of names) {
    const m = NAME_RE.exec(name)
    if (!m) continue
    const [, , y, mo, d, h, mi, s, auto, label] = m
    const date = new Date(+y, +mo - 1, +d, +h, +mi, +s).getTime()
    const size = (await stat(join(dir, name))).size
    items.push({
      file: join(dir, name),
      name,
      date,
      size,
      auto: !!auto,
      ...(label ? { label } : {})
    })
  }
  return items.sort((a, b) => b.date - a.date)
}

/** File del progetto da salvare, con percorsi relativi e "/" come separatore */
async function projectFiles(folder: string, exclude: string[]): Promise<string[]> {
  const out: string[] = []
  const walk = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const full = join(dir, entry.name)
      if (exclude.some((e) => full === e || full.startsWith(e + sep))) continue
      if (entry.isDirectory()) await walk(full)
      else if (entry.isFile()) out.push(relative(folder, full).split(sep).join('/'))
    }
  }
  await walk(folder)
  return out.sort()
}

export async function createBackup(
  folder: string,
  projectName: string,
  dir: string,
  auto = false,
  now = new Date(),
  label?: string
): Promise<BackupItem> {
  const root = resolve(folder)
  const files = await projectFiles(root, [join(root, 'export'), resolve(dir)])
  const zip = new JSZip()
  const manifest: Manifest = { version: 1, assets: {} }
  await mkdir(join(dir, STORE), { recursive: true })
  if (!(await exists(join(dir, OWNER))))
    await writeFile(join(dir, OWNER), JSON.stringify({ folder: root }) + '\n')
  for (const f of files) {
    const data = await readFile(join(root, f))
    if (f.startsWith('assets/')) {
      const blob = createHash('sha256').update(data).digest('hex') + extname(f).toLowerCase()
      const target = join(dir, STORE, blob)
      if (!(await exists(target))) {
        await copyFile(join(root, f), target + '.tmp')
        await rename(target + '.tmp', target)
      }
      manifest.assets[f] = blob
      continue
    }
    const lower = f.toLowerCase()
    zip.file(f, data, {
      compression: STORED.some((e) => lower.endsWith(e)) ? 'STORE' : 'DEFLATE'
    })
  }
  zip.file(MANIFEST, JSON.stringify(manifest, null, 1))
  const clean = cleanBackupLabel(label)
  const name = `${backupDirName(projectName)} ${stamp(now)}${auto ? ' auto' : ''}${clean ? ` - ${clean}` : ''}.zip`
  const file = join(dir, name)
  const tmp = file + '.tmp'
  // lo zip si fa in memoria: i file di assets/ non ci sono, quindi resta piccolo (e così si
  // scrive anche nella versione web, che non ha gli stream di Node)
  await writeFile(tmp, await zip.generateAsync({ type: 'nodebuffer', streamFiles: true }))
  await rename(tmp, file)
  return {
    file,
    name,
    date: now.getTime(),
    size: (await stat(file)).size,
    auto,
    ...(clean ? { label: clean } : {})
  }
}

/** Cambia (o toglie, se vuoto) il nome di un backup: si rinomina il file */
export async function labelBackup(file: string, label: string): Promise<BackupItem> {
  const m = NAME_RE.exec(basename(file))
  if (!m) throw new Error('not a backup')
  const clean = cleanBackupLabel(label)
  // tutto fino alla data (e a " auto"), poi il nome nuovo
  const head = basename(file).slice(
    0,
    basename(file).length - '.zip'.length - (m[9] ? m[9].length + 3 : 0)
  )
  const name = `${head}${clean ? ` - ${clean}` : ''}.zip`
  const target = join(dirname(file), name)
  if (target !== file) await rename(file, target)
  const item = (await listBackups(dirname(file))).find((b) => b.name === name)
  if (!item) throw new Error('not a backup')
  return item
}

async function readManifest(zip: JSZip): Promise<Manifest> {
  const entry = zip.file(MANIFEST) ?? zip.file(OLD_MANIFEST)
  if (!entry) return { version: 1, assets: {} }
  const m = JSON.parse(await entry.async('string'))
  return { version: 1, assets: m && typeof m.assets === 'object' ? m.assets : {} }
}

/**
 * Toglie i backup automatici oltre i più recenti `keep` (quelli fatti a mano e quelli con un
 * nome restano), poi i file della cartella comune che nessun backup rimasto usa
 */
export async function pruneBackups(dir: string, keep: number): Promise<void> {
  const auto = (await listBackups(dir)).filter((b) => b.auto && !b.label)
  for (const b of auto.slice(Math.max(0, keep))) await rm(b.file, { force: true })
  const used = new Set<string>()
  for (const b of await listBackups(dir)) {
    try {
      const m = await readManifest(await JSZip.loadAsync(await readFile(b.file)))
      Object.values(m.assets).forEach((blob) => used.add(blob))
    } catch {
      // uno zip illeggibile non deve far cancellare i file degli altri: non si pulisce nulla
      return
    }
  }
  let blobs: string[]
  try {
    blobs = await readdir(join(dir, STORE))
  } catch {
    return
  }
  for (const blob of blobs) if (!used.has(blob)) await rm(join(dir, STORE, blob), { force: true })
}

/** Spazio occupato da tutti i backup del progetto, cartella comune compresa */
export async function backupsSize(dir: string): Promise<number> {
  let total = 0
  for (const sub of [dir, join(dir, STORE)]) {
    let names: string[]
    try {
      names = await readdir(sub)
    } catch {
      continue
    }
    for (const n of names) {
      const st = await stat(join(sub, n))
      if (st.isFile()) total += st.size
    }
  }
  return total
}

/** Backup all'apertura: solo se l'ultimo è abbastanza vecchio. Restituisce null se non serve */
export async function autoBackup(
  folder: string,
  projectName: string,
  dir: string,
  settings: BackupSettings,
  now = new Date()
): Promise<BackupItem | null> {
  if (!settings.auto) return null
  const last = (await listBackups(dir))[0]
  if (last && now.getTime() - last.date < AUTO_MIN_INTERVAL) return null
  const item = await createBackup(folder, projectName, dir, true, now)
  await pruneBackups(dir, settings.keep)
  return item
}

/**
 * Estrae un backup in una cartella nuova accanto al progetto, senza toccare l'originale.
 * Restituisce la cartella creata.
 */
export async function restoreBackup(file: string, parent: string): Promise<string> {
  const zip = await JSZip.loadAsync(await readFile(file))
  const manifest = await readManifest(zip)
  const base = basename(file, '.zip').replace(/ auto( - |$)/, '$1')
  // il nome del backup contiene già la data: basta aggiungere un numero se esiste
  let target = join(parent, base)
  for (let n = 2; await exists(target); n++) target = join(parent, `${base} ${n}`)
  const root = resolve(target)
  // un nome come ../x uscirebbe dalla cartella: si ignora
  const inside = (name: string): string | null => {
    const out = resolve(root, name)
    return out.startsWith(root + sep) ? out : null
  }
  for (const entry of Object.values(zip.files)) {
    const out = inside(entry.name)
    if (entry.dir || isManifest(entry.name) || !out) continue
    await mkdir(dirname(out), { recursive: true })
    await writeFile(out, await entry.async('nodebuffer'))
  }
  const store = resolve(dirname(file), STORE)
  const missing: string[] = []
  for (const [path, blob] of Object.entries(manifest.assets)) {
    const out = inside(path)
    const source = resolve(store, blob)
    if (!out || dirname(source) !== store) continue
    await mkdir(dirname(out), { recursive: true })
    await copyFile(source, out).catch(() => missing.push(path))
  }
  await mkdir(root, { recursive: true })
  if (missing.length) console.error('backup: missing assets', missing)
  return root
}

// --- impostazioni, nei dati dell'app come i progetti recenti ---

export async function readBackupSettings(file: string): Promise<BackupSettings> {
  try {
    const s = JSON.parse(await readFile(file, 'utf8'))
    return {
      folder: typeof s.folder === 'string' ? s.folder : '',
      auto: typeof s.auto === 'boolean' ? s.auto : DEFAULT_BACKUP_SETTINGS.auto,
      keep:
        Number.isFinite(s.keep) && s.keep >= 1 ? Math.round(s.keep) : DEFAULT_BACKUP_SETTINGS.keep
    }
  } catch {
    return { ...DEFAULT_BACKUP_SETTINGS }
  }
}

export async function writeBackupSettings(file: string, settings: BackupSettings): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(settings, null, 2) + '\n', 'utf8')
}
