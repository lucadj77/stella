import { readFile } from 'fs/promises'
import { join } from 'path'
import type { ProjectFile, Sheet } from '../../shared/project'
import { projectFilePath, writeProjectFile } from './projectFile'
import { MessageError, msg } from '../../shared/messages'
import { keepDeletedSheets, writeSpreadsheet } from './spreadsheet'

export interface DataChanges {
  /** File di progetto aggiornato, se sono cambiati i set */
  file?: ProjectFile
  /** Fogli modificati o nuovi */
  sheets: Sheet[]
  /** Fogli dei set eliminati: escono dal file dati e vanno in deleted/ */
  removed?: string[]
  /**
   * Rifiuta (save.needsRewrite) un salvataggio che riscriverebbe tutto l'xlsx perdendo grafici e
   * simili: chi salva chiede prima conferma e riprova senza
   */
  keepParts?: boolean
}

export interface SaveResult {
  /** Il file dati è stato riscritto tutto: ciò che exceljs non conosce non c'è più */
  rewritten: boolean
}

/** Salva i fogli e, se serve, il file di progetto; prima i dati, così un set nuovo ha già il foglio */
export async function saveData(folder: string, changes: DataChanges): Promise<SaveResult> {
  // il file dati si legge dal progetto su disco: il renderer non sceglie dove scrivere
  const target = await projectFilePath(folder)
  const current: ProjectFile = JSON.parse(await readFile(target, 'utf8'))
  const data = join(folder, current.dataFile)
  const removed = changes.removed ?? []
  // in sola lettura il file dati non si tocca, qualunque cosa chieda il renderer
  const readOnly = (changes.file ?? current).dataReadOnly
  if (readOnly && (changes.sheets.length || removed.length))
    throw new MessageError(msg('data.readOnly'))
  // la copia in deleted/ prima di toglierli: se non riesce il file dati resta com'era
  await keepDeletedSheets(folder, data, removed)
  const rewritten =
    changes.sheets.length || removed.length
      ? await writeSpreadsheet(data, changes.sheets, removed, { keepParts: changes.keepParts })
      : false
  if (changes.file) {
    changes.file.dataFile = current.dataFile
    await writeProjectFile(target, JSON.stringify(changes.file, null, 2) + '\n')
  }
  return { rewritten }
}
