import { readFile, rename, stat } from 'fs/promises'
import { dirname, resolve } from 'path'
import { exists, writeFileSafe } from '../fs'
import { MessageError, msg } from '../../shared/messages'
import type { ProjectRescue } from '../../shared/api'
import { findBackupDir, listBackups, restoreBackup } from './backup'
import { isProjectJson, projectFileCopyPath, projectFilePath } from './projectFile'

// Un progetto che non si apre (file di progetto rovinato o mancante): che cosa c'è per rimetterlo
// in piedi senza aprirlo. La copia del salvataggio precedente accanto al file, e i backup della
// sua cartella. Vedi docs/specifica.md, sezione 12.

/** Copia del file di progetto e backup del progetto `folder`, cercati in `backupRoot` */
export async function projectRescue(
  folder: string,
  backupRoot: string,
  nameHint?: string
): Promise<ProjectRescue> {
  const copyFile = projectFileCopyPath(await projectFilePath(folder))
  let copy: ProjectRescue['copy'] = null
  try {
    if (isProjectJson(await readFile(copyFile, 'utf8')))
      copy = { date: (await stat(copyFile)).mtimeMs }
  } catch {
    // nessuna copia: progetto mai salvato con questa versione
  }
  const dir = await findBackupDir(backupRoot, folder, nameHint)
  return { copy, backups: dir ? await listBackups(dir) : [], backupFolder: dir }
}

/**
 * Rimette la copia al posto del file di progetto. Il file rovinato non si cancella: diventa
 * <nome>.damaged, accanto, nel caso servisse.
 */
export async function restoreProjectFileCopy(folder: string): Promise<void> {
  const target = await projectFilePath(folder)
  const text = await readFile(projectFileCopyPath(target), 'utf8').catch(() => '')
  if (!isProjectJson(text)) throw new MessageError(msg('rescue.noCopy'))
  if (await exists(target)) await rename(target, `${target}.damaged`)
  await writeFileSafe(target, text)
}

/**
 * Estrae un backup del progetto `folder` in una cartella nuova dentro `parent` (di base accanto
 * al progetto). Solo un backup della cartella dei backup di quel progetto.
 */
export async function restoreProjectBackup(
  folder: string,
  file: string,
  backupRoot: string,
  nameHint?: string,
  parent?: string
): Promise<string> {
  const { backups } = await projectRescue(folder, backupRoot, nameHint)
  if (!backups.some((b) => resolve(b.file) === resolve(file))) throw new Error('not a backup')
  return restoreBackup(file, parent ?? dirname(folder))
}
