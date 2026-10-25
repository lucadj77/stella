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
