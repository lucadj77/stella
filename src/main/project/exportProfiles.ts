import { readFile } from 'fs/promises'
import type { ProjectFile } from '../../shared/project'
import { projectFilePath, writeProjectFile } from './projectFile'
import type { ExportProfiles } from '../../shared/export'

/**
 * Ricorda le opzioni dell'ultima esportazione nel file di progetto. Si tocca solo la chiave
 * export del file su disco: le altre modifiche non salvate restano al comando Salva.
 */
export async function saveExportProfiles(folder: string, profiles: ExportProfiles): Promise<void> {
  const target = await projectFilePath(folder)
  const file: ProjectFile = JSON.parse(await readFile(target, 'utf8'))
  file.export = profiles
  await writeProjectFile(target, JSON.stringify(file, null, 2) + '\n')
}
