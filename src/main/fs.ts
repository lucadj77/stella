import { access, rename, writeFile } from 'fs/promises'

/** Il file o la cartella esiste */
export async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/**
 * Scrive un file senza mai lasciarlo a metà: prima un file a parte, forzato sul disco (flush, cioè
 * fsync), poi lo scambio con rename. Senza il flush il sistema può registrare il rename prima dei
 * dati: se la corrente salta in quel momento resta un file della lunghezza giusta ma pieno di zeri.
 * Così dopo un'interruzione c'è la versione di prima o quella nuova.
 */
export async function writeFileSafe(
  path: string,
  data: string | Uint8Array,
  encoding?: BufferEncoding
): Promise<void> {
  const tmp = `${path}.tmp`
  await writeFile(tmp, data, {
    encoding: encoding ?? (typeof data === 'string' ? 'utf8' : null),
    flush: true
  })
  await rename(tmp, path)
}
