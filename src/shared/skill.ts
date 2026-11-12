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
/** Skill che finisce a mano l'importazione da nanDECK: è separata da quella di Stella */
const NANDECK_SKILL_PATH = 'skill/stella-nandeck/SKILL.md'
const RAW = 'https://raw.githubusercontent.com/lucadj77/stella'

/** Pagina GitHub della skill, per scaricarla a mano se l'app non ci riesce */
export const SKILL_PAGE = `https://github.com/lucadj77/stella/blob/main/${SKILL_PATH}`
export const NANDECK_SKILL_PAGE = `https://github.com/lucadj77/stella/blob/main/${NANDECK_SKILL_PATH}`

export type SkillKind = 'stella' | 'stella-nandeck'

const PATHS: Record<SkillKind, string> = {
  stella: SKILL_PATH,
  'stella-nandeck': NANDECK_SKILL_PATH
}
const PAGES: Record<SkillKind, string> = {
  stella: SKILL_PAGE,
  'stella-nandeck': NANDECK_SKILL_PAGE
}

/**
 * Indirizzi da cui scaricare la skill: quella della versione installata (il suo tag), poi quella
 * di main, per le versioni di sviluppo che non hanno un tag
 */
export function skillUrls(version: string, kind: SkillKind = 'stella'): string[] {
  const path = PATHS[kind]
  return [`${RAW}/v${version}/${path}`, `${RAW}/main/${path}`]
}

/**
 * Scarica la skill da GitHub: non è dentro l'app, si scarica solo quando la si chiede nella
 * finestra Strumenti IA. `get` è fetch nel browser, net.fetch nell'app desktop.
 */
export async function downloadSkill(
  version: string,
  get: (url: string) => Promise<Response>,
  kind: SkillKind = 'stella'
): Promise<string> {
  let last: unknown = null
  for (const url of skillUrls(version, kind)) {
    try {
      const res = await get(url)
      if (!res.ok) {
        last = new Error(`HTTP ${res.status}`)
        continue
      }
      const text = await res.text()
      if (text.startsWith('---') && text.includes(`name: ${kind}\n`)) return text
      last = new Error('unexpected content')
    } catch (e) {
      last = e
    }
  }
  throw new MessageError(
    msg('ai.downloadFailed', {
      error: String((last as Error)?.message ?? last),
      url: PAGES[kind]
    })
  )
}
