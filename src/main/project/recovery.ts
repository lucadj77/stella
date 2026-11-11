import { app } from 'electron'
import { createHash } from 'crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'fs/promises'
import { join } from 'path'

// File di recupero: mentre ci sono modifiche non salvate, il renderer ne manda una copia ogni
// pochi secondi, che si scrive nella cartella dell'app (non in quella del progetto). Se l'app si
// chiude male, alla riapertura del progetto Stella propone di recuperarle. Salvando, scartando le
// modifiche o chiudendo senza salvare il file si toglie.

function recoveryFile(folder: string): string {
  const id = createHash('sha1').update(folder).digest('hex').slice(0, 16)
  return join(app.getPath('userData'), 'recovery', `${id}.json`)
}

export async function writeRecovery(folder: string, json: string): Promise<void> {
  const file = recoveryFile(folder)
  await mkdir(join(file, '..'), { recursive: true })
  // prima un file a parte, poi lo scambio: un'interruzione non lascia un file a metà
  await writeFile(`${file}.tmp`, json, 'utf8')
  await rename(`${file}.tmp`, file)
}

/** Il recupero del progetto, con la data in cui è stato scritto (ms), o null */
export async function readRecovery(folder: string): Promise<{ at: number; json: string } | null> {
  const file = recoveryFile(folder)
  try {
    const [json, info] = await Promise.all([readFile(file, 'utf8'), stat(file)])
    return { at: info.mtimeMs, json }
  } catch {
    return null
  }
}

export async function clearRecovery(folder: string): Promise<void> {
  await rm(recoveryFile(folder), { force: true })
}
