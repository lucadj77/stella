import { MessageError, msg } from './messages'

// Inserisce versione e comando nella skill di Stella (skill/stella/SKILL.md). Sostituisce solo
// la riga «This skill is for Stella {{STELLA_VERSION}}.» e la riga del blocco del comando, che
// contiene soltanto {{STELLA_COMMAND}}: le frasi che nominano i segnaposto (passi 1 e 4) restano
// com'erano, così l'agente sa cosa cercare quando aggiorna la skill da GitHub.

export const VERSION_PLACEHOLDER = '{{STELLA_VERSION}}'
export const COMMAND_PLACEHOLDER = '{{STELLA_COMMAND}}'

export function fillSkill(source: string, version: string, command: string): string {
  return source
    .split('\n')
    .map((line) => {
      if (line.startsWith('This skill is for Stella '))
        return line.replace(VERSION_PLACEHOLDER, version)
      if (command && line.trim() === COMMAND_PLACEHOLDER)
        return line.replace(COMMAND_PLACEHOLDER, command)
      return line
    })
    .join('\n')
}

const SKILL_PATH = 'skill/stella/SKILL.md'
const RAW = 'https://raw.githubusercontent.com/lucadj77/stella'

/** Pagina GitHub della skill, per scaricarla a mano se l'app non ci riesce */
export const SKILL_PAGE = `https://github.com/lucadj77/stella/blob/main/${SKILL_PATH}`

/**
 * Indirizzi da cui scaricare la skill: quella della versione installata (il suo tag), poi quella
 * di main, per le versioni di sviluppo che non hanno un tag
 */
export function skillUrls(version: string): string[] {
  return [`${RAW}/v${version}/${SKILL_PATH}`, `${RAW}/main/${SKILL_PATH}`]
}

/**
 * Scarica la skill da GitHub: non è dentro l'app, si scarica solo quando la si chiede nella
 * finestra Strumenti IA. `get` è fetch nel browser, net.fetch nell'app desktop.
 */
export async function downloadSkill(
  version: string,
  get: (url: string) => Promise<Response>
): Promise<string> {
  let last: unknown = null
  for (const url of skillUrls(version)) {
    try {
      const res = await get(url)
      if (!res.ok) {
        last = new Error(`HTTP ${res.status}`)
        continue
      }
      const text = await res.text()
      if (text.startsWith('---') && text.includes('name: stella')) return text
      last = new Error('unexpected content')
    } catch (e) {
      last = e
    }
  }
  throw new MessageError(
    msg('ai.downloadFailed', {
      error: String((last as Error)?.message ?? last),
      url: SKILL_PAGE
    })
  )
}
