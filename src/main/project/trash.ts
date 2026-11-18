import { readFile, readdir, unlink } from 'fs/promises'
import { join } from 'path'
import { MessageError, msg } from '../../shared/messages'
import type { DeletedContent, DeletedItem } from '../../shared/project'
import { normalizeTemplate } from '../../shared/model/normalize'
import { readSpreadsheet } from './spreadsheet'
import { dropDeletedImages, listDeletedImages, splitDeletedImage } from './imageFiles'

// Cestino del progetto: template, note, documenti e fogli eliminati finiscono in deleted/ con data e ora nel
// nome (deleted.ts); da qui si elencano, si leggono per ripristinarli e si tolgono una volta
// ripristinati.

const NAME = /^(.+) (\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})\.(doc\.md|json|md|xlsx|ods)$/i

const dir = (folder: string): string => join(folder, 'deleted')

function parse(file: string): Omit<DeletedItem, 'columns'> | null {
  const m = NAME.exec(file)
  if (!m) return null
  const ext = m[8].toLowerCase()
  return {
    file,
    kind:
      ext === 'json' ? 'template' : ext === 'md' ? 'note' : ext === 'doc.md' ? 'document' : 'sheet',
    name: m[1],
    date: `${m[2]}-${m[3]}-${m[4]}T${m[5]}:${m[6]}:${m[7]}Z`
  }
}

/** Un nome di file del cestino, mai un percorso: niente da leggere fuori da deleted/ */
function checked(file: string): Omit<DeletedItem, 'columns'> {
  const item = !/[/\\]/.test(file) && parse(file)
  if (!item) throw new MessageError(msg('trash.unknownFile', { file }))
  return item
}

/** Elementi del cestino, dal più recente; dei fogli anche le colonne, per scegliere il template */
export async function listDeleted(folder: string): Promise<DeletedItem[]> {
  let files: string[]
  try {
    files = await readdir(dir(folder))
  } catch {
    files = []
  }
  const out: DeletedItem[] = await listDeletedImages(folder)
  for (const f of files) {
    const item = parse(f)
    if (!item) continue
    if (item.kind !== 'sheet') {
      out.push(item)
      continue
    }
    try {
      const [sheet] = await readSpreadsheet(join(dir(folder), f))
      out.push({ ...item, columns: sheet?.headers ?? [] })
    } catch {
      // un foglio illeggibile non si può ripristinare dall'app
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name))
}

/** Contenuto di un elemento del cestino, pronto da rimettere nel progetto */
export async function readDeleted(folder: string, file: string): Promise<DeletedContent> {
  const item = checked(file)
  const path = join(dir(folder), file)
  if (item.kind === 'note' || item.kind === 'document')
    return { kind: item.kind, name: item.name, text: await readFile(path, 'utf8') }
  if (item.kind === 'template') {
    const raw = JSON.parse(await readFile(path, 'utf8'))
    return {
      kind: 'template',
      template: normalizeTemplate({ ...raw, name: raw.name ?? item.name })
    }
  }
  const [sheet] = await readSpreadsheet(path)
  if (!sheet) throw new MessageError(msg('trash.unknownFile', { file }))
  return { kind: 'sheet', sheet: { ...sheet, name: item.name } }
}

/** Toglie dal cestino gli elementi ripristinati */
export async function dropDeleted(folder: string, files: string[]): Promise<void> {
  await dropDeletedImages(
    folder,
    files.filter((f) => splitDeletedImage(f))
  )
  for (const f of files) {
    if (splitDeletedImage(f)) continue
    checked(f)
    await unlink(join(dir(folder), f)).catch(() => undefined)
  }
}
