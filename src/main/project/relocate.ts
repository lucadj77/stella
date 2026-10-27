import { cp, readdir, rename, rm, rmdir, stat } from 'fs/promises'
import { basename, isAbsolute, relative, resolve } from 'path'
import { MessageError, msg } from '../../shared/messages'
import { AGENT_LOCK_FILE, APP_STATE_FILE } from './agentLock'

// Copia e spostamento della cartella di un progetto (menu Progetto). La destinazione è una
// cartella nuova, o vuota; i file di stato dell'app e dell'IA restano dove sono.

/** File della cartella del progetto che non si copiano: dicono chi lo sta usando adesso */
const LOCAL_FILES = [APP_STATE_FILE, AGENT_LOCK_FILE]

/** Controlla che `to` si possa usare come cartella del progetto che sta in `from` */
async function checkTarget(from: string, to: string): Promise<void> {
  const a = resolve(from)
  const b = resolve(to)
  const inside = relative(a, b)
  if (!inside || (!inside.startsWith('..') && !isAbsolute(inside)))
    throw new MessageError(msg('relocate.inside'))
  const info = await stat(b).catch(() => null)
  if (!info) return
  if (!info.isDirectory() || (await readdir(b)).length > 0)
    throw new MessageError(msg('relocate.notEmpty', { folder: b }))
}

/** Copia il progetto in `to`, che diventa un progetto a sé */
export async function copyProject(from: string, to: string): Promise<void> {
  await checkTarget(from, to)
  const root = resolve(from)
  await cp(root, resolve(to), {
    recursive: true,
    errorOnExist: true,
    force: false,
    filter: (src) => resolve(src) === root || !LOCAL_FILES.includes(basename(src))
  })
}

/**
 * Sposta il progetto in `to`. Sullo stesso disco è un cambio di nome; tra dischi diversi si
 * copia e, solo se la copia è riuscita, si toglie l'originale.
 */
export async function moveProject(from: string, to: string): Promise<void> {
  await checkTarget(from, to)
  // una cartella vuota già creata (per esempio dalla finestra di scelta) si sostituisce
  await rmdir(resolve(to)).catch(() => undefined)
  try {
    await rename(resolve(from), resolve(to))
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EXDEV') throw e
    await copyProject(from, to)
    await rm(resolve(from), { recursive: true, force: true })
  }
}
