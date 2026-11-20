import { readdir, stat, writeFile } from 'fs/promises'
import { basename, dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { exists } from '../fs'
import { isTtcProject } from '../import/ttcDetect'
import { LAUNCHER_EXT, LEGACY_PROJECT_FILES, PROJECT_FILE } from '../../shared/project'
import { projectFolderName } from '../../shared/model/projectName'

// Aprire un progetto senza passare dalla finestra «Apri progetto»: con un doppio clic sul file
// .stella della cartella (associato all'app dall'installazione) o trascinando la cartella nella
// schermata di avvio.

const PROJECT_FILES = [PROJECT_FILE, ...LEGACY_PROJECT_FILES]

/** Il file è uno di quelli che indicano la cartella del progetto: il .stella o stella.json */
export function isLauncherFile(path: string): boolean {
  const name = basename(path).toLowerCase()
  return name.endsWith(LAUNCHER_EXT) || PROJECT_FILES.includes(name)
}

/** Il progetto da aprire tra gli argomenti con cui è partita l'app (Windows e Linux) */
export function launcherFromArgs(args: string[]): string | null {
  for (let i = args.length - 1; i > 0; i--) {
    // Linux (Exec … %U) può passare un indirizzo file:// invece del percorso
    const arg = args[i].startsWith('file://') ? fileURLToPath(args[i]) : args[i]
    if (!arg.startsWith('-') && isLauncherFile(arg)) return dirname(arg)
  }
  return null
}

/**
 * Scrive nella cartella del progetto il file che lo apre con un doppio clic, se non c'è già un
 * .stella (anche con un altro nome: il progetto può essere stato rinominato). Dentro c'è solo una
 * spiegazione: l'app usa la cartella che lo contiene.
 */
export async function ensureLauncher(folder: string, name: string): Promise<void> {
  const files = await readdir(folder)
  if (files.some((n) => n.toLowerCase().endsWith(LAUNCHER_EXT))) return
  const file = (projectFolderName(name) || basename(folder) || 'project') + LAUNCHER_EXT
  await writeFile(
    join(folder, file),
    JSON.stringify(
      {
        stella: PROJECT_FILE,
        about:
          'Double-click this file to open the project in Stella Game Center. ' +
          'Fai doppio clic su questo file per aprire il progetto in Stella Game Center.'
      },
      null,
      2
    ) + '\n'
  )
}

export type DroppedKind = 'stella' | 'ttc' | null

/**
 * Che cosa è stato lasciato cadere: la cartella di un progetto Stella, di un progetto Tabletop
 * Creator, o altro. Un file stella.json o .stella vale per la cartella che lo contiene.
 */
export async function inspectDropped(path: string): Promise<{ folder: string; kind: DroppedKind }> {
  let folder = path
  try {
    if (!(await stat(path)).isDirectory()) {
      if (!isLauncherFile(path)) return { folder: path, kind: null }
      folder = dirname(path)
    }
  } catch {
    return { folder: path, kind: null }
  }
  for (const n of PROJECT_FILES)
    if (await exists(join(folder, n))) return { folder, kind: 'stella' }
  if (await isTtcProject(folder)) return { folder, kind: 'ttc' }
  return { folder, kind: null }
}
