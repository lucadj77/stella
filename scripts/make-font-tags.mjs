// Rigenera resources/catalogs/google-fonts-tags.json, gli stili dei font Google usati dai filtri
// della scelta dei font (gli stessi del sito fonts.google.com). Uso: node scripts/make-font-tags.mjs
// I dati vengono da tags/all/families.csv del repository google/fonts; la lettura è quella
// dell'aggiornamento dall'app (src/main/library/catalogParse.ts), caricata con jiti.
import { createJiti } from 'jiti'
import { writeFileSync } from 'fs'

const URL = 'https://raw.githubusercontent.com/google/fonts/main/tags/all/families.csv'
const jiti = createJiti(import.meta.url)
const { googleFontTags } = await jiti.import('../src/main/library/catalogParse.ts')
const res = await fetch(URL)
if (!res.ok) throw new Error(`${res.status} ${URL}`)
const tags = googleFontTags(await res.text())
writeFileSync('resources/catalogs/google-fonts-tags.json', JSON.stringify({ source: URL, ...tags }))
console.log(`${Object.keys(tags.families).length} famiglie, ${tags.tags.length} tag`)
