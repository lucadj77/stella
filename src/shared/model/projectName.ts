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
