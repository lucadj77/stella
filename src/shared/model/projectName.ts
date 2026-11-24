/**
 * Nome della cartella di un progetto: il nome scritto dall'utente senza i caratteri che Windows e
 * macOS non accettano nei nomi di file, con _ al posto degli spazi (più comodo nei comandi e negli
 * indirizzi). '' se non resta nulla di usabile.
 */
export function projectFolderName(name: string): string {
  const clean = name
    // eslint-disable-next-line no-control-regex
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
  if (clean === '.' || clean === '..') return ''
  return clean.replace(/ /g, '_')
}

/** Estensione dello ZIP di un progetto intero */
export const PROJECT_ZIP_EXT = '.stella-project.zip'

/** Estensione di un pacchetto, secondo cosa contiene */
export function packageExt(kind: 'template' | 'set'): string {
  return kind === 'set' ? '.stella-set.zip' : '.stella-template.zip'
}

/**
 * Il nome di uno ZIP di Stella senza estensione: "Assedio.stella-project.zip" → "Assedio". Toglie
 * anche .stella.zip (pacchetti fino alla 1.13) e .zip
 */
export function zipBaseName(file: string): string {
  const base = file.split(/[\\/]/).pop() ?? file
  return base.replace(/(\.stella(-project|-set|-template)?)?\.zip$/i, '')
}
