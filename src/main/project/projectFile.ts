import { access, readFile } from 'fs/promises'
import { basename, dirname, join } from 'path'
import { writeFileSafe } from '../fs'
import { LEGACY_PROJECT_FILES, PROJECT_FILE } from '../../shared/project'

/**
 * Percorso del file di progetto: stella.json, oppure naibi.json o gamecreator.json nei progetti
 * creati prima dei cambi di nome, che continuano a salvare nel file che hanno già. Senza nessuno dei due si
 * restituisce stella.json.
 */
export async function projectFilePath(folder: string): Promise<string> {
  for (const name of [PROJECT_FILE, ...LEGACY_PROJECT_FILES]) {
    const path = join(folder, name)
    try {
      await access(path)
      return path
    } catch {
      // si prova il nome successivo
    }
  }
  return join(folder, PROJECT_FILE)
}

/**
 * Copia della versione precedente del file di progetto, accanto a lui e nascosta: se il file si
 * rovina (per esempio un blocco della corrente durante il salvataggio) Stella propone di usarla
 */
export function projectFileCopyPath(target: string): string {
  return join(dirname(target), `.${basename(target)}.bak`)
}

/** Contenuto leggibile di un file di progetto: un oggetto JSON con il file dei dati */
export function isProjectJson(text: string): boolean {
  try {
    const f = JSON.parse(text)
    return !!f && typeof f === 'object' && typeof f.dataFile === 'string'
  } catch {
    return false
  }
}

/**
 * Scrive il file di progetto in modo sicuro, tenendo prima la copia della versione che c'era
 * (solo se è leggibile: una copia rovinata non servirebbe a niente)
 */
export async function writeProjectFile(target: string, text: string): Promise<void> {
  const previous = await readFile(target, 'utf8').catch(() => null)
  if (previous !== null && previous !== text && isProjectJson(previous))
    await writeFileSafe(projectFileCopyPath(target), previous)
  await writeFileSafe(target, text)
}
