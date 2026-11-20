import { readdir } from 'fs/promises'
import { join } from 'path'
import { exists } from '../fs'

// Separato da ttc.ts, che porta con sé i cataloghi delle icone: serve anche a chi riconosce una
// cartella trascinata nella schermata di avvio (project/launcher.ts)

/** Una cartella è un progetto Tabletop Creator se ha data/blueprints o un file .tcp */
export async function isTtcProject(folder: string): Promise<boolean> {
  if (await exists(join(folder, 'data', 'blueprints'))) return true
  try {
    return (await readdir(folder)).some((n) => n.endsWith('.tcp'))
  } catch {
    return false
  }
}
