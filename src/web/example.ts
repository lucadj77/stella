import { mkdir, readFile, writeFile } from './shims/fs'
import { dirname } from './shims/path'
import { DATA_ROOT } from './fs/roots'

// Il progetto di esempio nella versione web: gli stessi file di resources/examples/<lingua>,
// inclusi nella build. Alla prima richiesta si copiano nello spazio privato del sito (DATA_ROOT),
// dove si modificano e si salvano come una cartella scelta, senza chiedere permessi.

const FILES = import.meta.glob('../../resources/examples/**/*', {
  query: '?url',
  import: 'default',
  eager: true
}) as Record<string, string>

/** Percorso dentro l'esempio, se il file è della lingua data */
function inLanguage(key: string, lang: string): string | null {
  const m = /\/examples\/([^/]+)\/(.+)$/.exec(key)
  return m && m[1] === lang ? m[2] : null
}

/** Prepara l'esempio nella lingua dell'interfaccia (inglese se manca) e ne dà la cartella */
export async function prepareWebExample(lang: string): Promise<string> {
  const l = Object.keys(FILES).some((k) => inLanguage(k, lang)) ? lang : 'en'
  const dest = `${DATA_ROOT}/${l === 'it' ? 'Esempio' : 'Example'}`
  try {
    await readFile(`${dest}/stella.json`)
    return dest
  } catch {
    // non c'è ancora: si copia
  }
  for (const [key, url] of Object.entries(FILES)) {
    const rel = inLanguage(key, l)
    if (!rel) continue
    const data = new Uint8Array(await (await fetch(url)).arrayBuffer())
    await mkdir(dirname(`${dest}/${rel}`), { recursive: true })
    await writeFile(`${dest}/${rel}`, data)
  }
  return dest
}
