import { mkdir, rename, writeFile } from 'fs/promises'
import { exists } from '../fs'
import { join } from 'path'
import {
  denormalizeTemplate,
  isValidTemplateName,
  type RawTemplate
} from '../../shared/model/normalize'
import type { Template } from '../../shared/model/template'
import { MessageError, msg } from '../../shared/messages'
import { deletedPath } from './deleted'

/** Scrive templates/<file>.json con le sole proprietà diverse dai default */
export async function saveTemplate(folder: string, template: Template): Promise<void> {
  const file = template.file ?? template.name
  if (!isValidTemplateName(file))
    throw new MessageError(msg('template.invalidName', { name: file }))
  const dir = join(folder, 'templates')
  await mkdir(dir, { recursive: true })
  const target = join(dir, `${file}.json`)
  // template rinominato: il file vecchio si toglie, così non torna come template a sé
  if (template.origin && template.origin !== file && isValidTemplateName(template.origin)) {
    const old = join(dir, `${template.origin}.json`)
    if (await exists(old)) {
      // un file con il nome nuovo che l'app non ha caricato (illeggibile): va in deleted/,
      // non si sovrascrive e non resta il file vecchio a far tornare il template
      if (await exists(target)) await rename(target, await deletedPath(folder, file, '.json'))
      await rename(old, target)
    }
  }
  // con file diverso dal nome il nome va scritto, altrimenti si ricava dal file
  const content: Partial<RawTemplate> = denormalizeTemplate(template)
  if (!template.file) delete content.name
  // scrittura in un file temporaneo e rinomina: un errore a metà non tronca il template
  const tmp = `${target}.tmp`
  await writeFile(tmp, formatTemplate(content) + '\n', 'utf8')
  await rename(tmp, target)
}

/**
 * Sposta templates/<file>.json in deleted/ dentro il progetto, con data e ora nel nome: da lì si
 * recupera rimettendolo in templates/. Restituisce il percorso, null se il file non c'era.
 */
export async function trashTemplate(folder: string, file: string): Promise<string | null> {
  if (!isValidTemplateName(file))
    throw new MessageError(msg('template.invalidName', { name: file }))
  const target = join(folder, 'templates', `${file}.json`)
  // mai salvato: non c'è nulla da spostare
  if (!(await exists(target))) return null
  try {
    const moved = await deletedPath(folder, file, '.json')
    await rename(target, moved)
    return moved
  } catch (e) {
    throw new MessageError(
      msg('template.deleteFailed', { name: file, text: (e as Error).message ?? String(e) })
    )
  }
}

/**
 * JSON con un livello per riga, come i file scritti a mano: le differenze in git restano
 * leggibili. I gruppi vanno a capo per mostrare i figli.
 */
export function formatTemplate(value: unknown, indent = ''): string {
  const inner = indent + '  '
  if (Array.isArray(value)) {
    if (!value.length) return '[]'
    return `[\n${value.map((v) => inner + formatTemplate(v, inner)).join(',\n')}\n${indent}]`
  }
  if (value && typeof value === 'object') {
    // come JSON.stringify, le chiavi senza valore non si scrivono
    const entries = Object.entries(value).filter(([, v]) => v !== undefined)
    const isLayer = 'type' in value
    if (isLayer && !('children' in value)) return oneLine(value)
    return `{\n${entries
      .map(([k, v]) => `${inner}${JSON.stringify(k)}: ${formatTemplate(v, inner)}`)
      .join(',\n')}\n${indent}}`
  }
  return JSON.stringify(value)
}

function oneLine(value: object): string {
  const body = Object.entries(value)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${JSON.stringify(k)}: ${inline(v)}`)
    .join(', ')
  return `{ ${body} }`
}

/** Valori annidati su una riga, con spazi dopo : e , solo fuori dalle stringhe */
function inline(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(inline).join(', ')}]`
  if (v && typeof v === 'object')
    return `{${Object.entries(v)
      .filter(([, x]) => x !== undefined)
      .map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`)
      .join(', ')}}`
  return JSON.stringify(v)
}
