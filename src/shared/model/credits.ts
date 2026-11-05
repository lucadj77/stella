import type { SourceEntry, Sources } from '../library'

// Testo dei crediti per i file importati (assets/sources.json): le icone raggruppate per
// fonte, licenza e autore, poi i font. Le frasi arrivano tradotte da chi chiama.

export interface CreditsLabels {
  /** "Icone da {source}, licenza {license}" */
  icons(source: string, license: string): string
  /** "Font {family}, licenza {license}" */
  font(family: string, license: string, author?: string): string
  licenseName(spdx: string): string
  /** "Immagini da internet" */
  images?(): string
}

const LICENSE_URLS: Record<string, string> = {
  'CC-BY-3.0': 'https://creativecommons.org/licenses/by/3.0/',
  'CC0-1.0': 'https://creativecommons.org/publicdomain/zero/1.0/',
  'OFL-1.1': 'https://openfontlicense.org',
  'Apache-2.0': 'https://www.apache.org/licenses/LICENSE-2.0',
  'UFL-1.0': 'https://ubuntu.com/legal/font-licence'
}

/**
 * @param used percorsi sotto assets/ usati dalle carte e famiglie dei font usati; senza, si
 * citano tutti i file importati
 */
export function creditsText(
  sources: Sources,
  labels: CreditsLabels,
  used?: { assets: Set<string>; fonts: Set<string> },
  /** Immagini collegate con https://... dalle carte */
  links: string[] = []
): string {
  const entries = Object.entries(sources).filter(([path, e]) =>
    !used ? true : e.kind === 'font' ? used.fonts.has(e.id.toLowerCase()) : used.assets.has(path)
  )
  const lines: string[] = []

  const icons = new Map<string, Map<string, Set<string>>>()
  for (const [, e] of entries) {
    if (e.kind !== 'icon') continue
    const group = `${e.source}\n${e.license}`
    if (!icons.has(group)) icons.set(group, new Map())
    const byAuthor = icons.get(group)!
    const author = e.author ?? ''
    if (!byAuthor.has(author)) byAuthor.set(author, new Set())
    byAuthor.get(author)!.add(e.title)
  }
  for (const [group, byAuthor] of [...icons].sort(([a], [b]) => a.localeCompare(b))) {
    const [source, license] = group.split('\n')
    lines.push(`${labels.icons(source, labels.licenseName(license))}${urlOf(license)}`)
    for (const [author, titles] of [...byAuthor].sort(([a], [b]) => a.localeCompare(b)))
      lines.push(`- ${author ? `${author}: ` : ''}${[...titles].sort().join(', ')}`)
    lines.push('')
  }

  const fonts = new Map<string, SourceEntry>()
  for (const [, e] of entries) if (e.kind === 'font' && !fonts.has(e.id)) fonts.set(e.id, e)
  for (const e of [...fonts.values()].sort((a, b) => a.id.localeCompare(b.id)))
    lines.push(`${labels.font(e.id, labels.licenseName(e.license), e.author)}${urlOf(e.license)}`)

  // immagini scaricate da un indirizzo e immagini collegate: si cita da dove vengono
  const images = new Set<string>()
  for (const [, e] of entries) if (e.kind === 'image' && e.url) images.add(`${e.title}: ${e.url}`)
  for (const url of links) images.add(url)
  if (images.size && labels.images) {
    if (lines.length && lines[lines.length - 1] !== '') lines.push('')
    lines.push(labels.images())
    for (const line of [...images].sort()) lines.push(`- ${line}`)
  }

  return lines.join('\n').trim() + '\n'
}

function urlOf(spdx: string): string {
  const url = LICENSE_URLS[spdx]
  return url ? ` (${url})` : ''
}
