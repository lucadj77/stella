import type { Translate } from '../i18n/context'
import { confirmKey } from './confirm'

// Ripristino di un backup scelto dal disco: dalla schermata iniziale (Importa) e dalla finestra
// per i progetti che non si aprono (RescueDialog)

/** Cartella che contiene `folder`, con il separatore che usa */
export function parentOf(folder: string): string {
  return folder.replace(/[\\/]+$/, '').replace(/[\\/][^\\/]*$/, '')
}

/**
 * Sceglie dal disco lo zip di un backup e la cartella in cui estrarlo; restituisce la cartella
 * del progetto ripristinato, o null se si è annullato. Solo nell'app desktop.
 */
export async function restoreBackupFromFile(
  t: Translate,
  defaultParent?: string
): Promise<string | null> {
  const file = await window.api.chooseBackupFile()
  if (!file) return null
  if (!(await confirmKey(t, 'rescue.fileConfirm'))) return null
  const parent = await window.api.chooseFolder(defaultParent ?? parentOf(parentOf(file)))
  if (!parent) return null
  return window.api.restoreBackupFile(file, parent)
}
