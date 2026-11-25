import { mkdir, readFile, readdir, rename } from 'fs/promises'
import { join } from 'path'
import { exists, writeFileSafe } from '../fs'
import { MessageError, msg } from '../../shared/messages'
import { isValidNoteName, type ProjectNote } from '../../shared/project'
import { DOCUMENTS_DIR } from '../../shared/model/document'
import { deletedPath } from './deleted'

// Note e documenti del progetto: un file Markdown ciascuno, le note in notes/ e i documenti
// (regolamento, sell sheet…) in docs/, da scrivere nell'app o con un editor qualsiasi; li legge
// anche un'IA che lavora sul progetto (docs/cli.md).

interface Kind {
  dir: string
  /** Estensione nel cestino: distingue un documento eliminato da una nota */
  deleted: string
  invalid: string
  exists: string
}

const NOTES: Kind = {
  dir: 'notes',
  deleted: '.md',
  invalid: 'note.invalidName',
  exists: 'note.exists'
}
const DOCUMENTS: Kind = {
  dir: DOCUMENTS_DIR,
  deleted: '.doc.md',
  invalid: 'document.invalidName',
  exists: 'document.exists'
}

/** File .md di una cartella del progetto, in ordine alfabetico */
async function readAll(folder: string, kind: Kind): Promise<ProjectNote[]> {
  const dir = join(folder, kind.dir)
  let files: string[]
  try {
    files = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith('.md'))
  } catch {
    return []
  }
  const notes = await Promise.all(
    files.map(async (f) => ({ name: f.slice(0, -3), text: await readFile(join(dir, f), 'utf8') }))
  )
  return notes.sort((a, b) => a.name.localeCompare(b.name))
}

/** Scrive <cartella>/<name>.md; con `oldName` diverso il file cambia nome */
async function save(
  folder: string,
  kind: Kind,
  name: string,
  text: string,
  oldName?: string
): Promise<void> {
  if (!isValidNoteName(name)) throw new MessageError(msg(kind.invalid, { name }))
  const dir = join(folder, kind.dir)
  await mkdir(dir, { recursive: true })
  const target = join(dir, `${name}.md`)
  if (oldName && oldName !== name && isValidNoteName(oldName)) {
    const old = join(dir, `${oldName}.md`)
    if (await exists(target)) throw new MessageError(msg(kind.exists, { name }))
    if (await exists(old)) await rename(old, target)
  }
  // file temporaneo e rinomina: un errore a metà non tronca il testo
  await writeFileSafe(target, text)
}

/** Sposta il file in deleted/ */
async function trash(folder: string, kind: Kind, name: string): Promise<void> {
  if (!isValidNoteName(name)) return
  const file = join(folder, kind.dir, `${name}.md`)
  if (await exists(file)) await rename(file, await deletedPath(folder, name, kind.deleted))
}

/** Note in notes/*.md */
export const readNotes = (folder: string): Promise<ProjectNote[]> => readAll(folder, NOTES)
export const saveNote = (
  folder: string,
  name: string,
  text: string,
  oldName?: string
): Promise<void> => save(folder, NOTES, name, text, oldName)
export const trashNote = (folder: string, name: string): Promise<void> => trash(folder, NOTES, name)

/** Documenti in docs/*.md */
export const readDocuments = (folder: string): Promise<ProjectNote[]> => readAll(folder, DOCUMENTS)
export const saveDocument = (
  folder: string,
  name: string,
  text: string,
  oldName?: string
): Promise<void> => save(folder, DOCUMENTS, name, text, oldName)
export const trashDocument = (folder: string, name: string): Promise<void> =>
  trash(folder, DOCUMENTS, name)
