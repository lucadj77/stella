import { gunzipSync } from 'zlib'
import type {
  FontCatalog,
  FontFamilyEntry,
  FontTags,
  IconAuthor,
  IconCatalog
} from '../../shared/library'

// Costruzione dei cataloghi dai dati delle fonti, per l'aggiornamento dall'app. Fa lo stesso
// lavoro di scripts/make-icon-catalog.mjs, fetch-icon-tags.mjs e make-font-catalog.mjs.

/**
 * Catalogo di game-icons.net dai file del repository ufficiale: license.txt e una cartella di
 * SVG per autore. `files` ha i percorsi relativi alla radice del repository.
 */
export function gameIconsCatalog(files: Map<string, string>): Omit<IconCatalog, 'tags'> {
  // license.txt: "- Nome, sito - CC0", un autore per riga; la cartella è il nome senza spazi
  const known: Record<string, IconAuthor> = {}
  for (const line of (files.get('license.txt') ?? '').split('\n')) {
    const m = line.match(/^- ([^,]+?)(?:, (\S+))?(?: - (CC0))?\s*$/)
    if (!m) continue
    const [, name, url, cc0] = m
    known[name.toLowerCase().replace(/[^a-z0-9]/g, '')] = {
      name,
      ...(url ? { url } : {}),
      license: cc0 ? 'CC0-1.0' : 'CC-BY-3.0'
    }
  }
  const authors: Record<string, IconAuthor> = {}
  const icons: [string, string][] = []
  for (const path of [...files.keys()].sort()) {
    const m = path.match(/^([^/.][^/]*)\/([^/]+)\.svg$/)
    // badges sono elementi d'interfaccia del sito, non icone
    if (!m || m[1] === 'badges') continue
    const [, dir, name] = m
    if (!authors[dir]) {
      const key = dir.replace(/[^a-z0-9]/g, '')
      authors[dir] = known[key] ??
        Object.entries(known).find(([k]) => k.startsWith(key) || key.startsWith(k))?.[1] ?? {
          name: dir.replace(/(^|-)(\w)/g, (_, s, c) => (s ? ' ' : '') + c.toUpperCase()),
          license: 'CC-BY-3.0'
        }
    }
    const paths = [...files.get(path)!.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)]
      .map((p) => p[1])
      .filter((d) => d !== 'M0 0h512v512H0z')
    if (paths.length) icons.push([`${dir}/${name}`, paths.join(' ')])
  }
  return { source: 'https://game-icons.net', authors, icons }
}

/** Icone "autore/nome" collegate da una pagina di tag di game-icons.net */
export function tagPageIcons(html: string): string[] {
  return [...new Set([...html.matchAll(/\/1x1\/([a-z0-9-]+\/[a-z0-9-]+)\.html/g)].map((m) => m[1]))]
}

const LICENSES: Record<string, string> = {
  'SIL Open Font License, 1.1': 'OFL-1.1',
  'Apache License, Version 2.0': 'Apache-2.0',
  'Ubuntu Font License, 1.0': 'UFL-1.0'
}

interface MetadataFont {
  family: string
  category: string
  weights: number[]
  styles: string[]
  subsets: string[]
}

/** Catalogo dei font Google da google-fonts-v1.json e licenses.json di google-font-metadata */
export function googleFontsCatalog(
  fonts: Record<string, MetadataFont>,
  licenses: Record<string, { license?: { type?: string }; authors?: { copyright?: string } }>
): FontCatalog {
  const families: FontFamilyEntry[] = Object.entries(fonts)
    .filter(([, f]) => f && typeof f.family === 'string')
    .map(([id, f]) => {
      const lic = licenses[id]?.license?.type ?? ''
      return [
        f.family,
        f.category,
        f.weights ?? [400],
        f.styles?.includes('italic') ? 1 : 0,
        f.subsets ?? [],
        LICENSES[lic] ?? lic,
        licenses[id]?.authors?.copyright ?? ''
      ] as FontFamilyEntry
    })
    .sort((a, b) => a[0].localeCompare(b[0]))
  return { source: 'https://fonts.google.com', families }
}

/** Punteggio minimo di un tag per tenerlo nel catalogo: sotto non serve a cercare */
const MIN_TAG_SCORE = 20

/**
 * Tag dei font Google da tags/all/families.csv del repository google/fonts: righe "famiglia,
 * asse, /Gruppo/Tag, punteggio". I tag di qualità (usati da Google per l'ordine) si scartano. Per
 * le sensazioni (/Expressive/) il punteggio cambia col peso: vale quello del peso normale, se c'è.
 */
export function googleFontTags(csv: string): FontTags {
  const scores = new Map<string, Map<string, { score: number; normal: boolean }>>()
  for (const line of csv.split(/\r?\n/)) {
    const cells = csvCells(line)
    if (cells.length !== 4 || !cells[2].startsWith('/') || !/^\d+(\.\d+)?$/.test(cells[3])) continue
    const [family, axis, tag, value] = cells
    if (tag.startsWith('/Quality/')) continue
    const score = Math.round(Number(value))
    const normal = axis === '' || axis === 'wght@400'
    let fam = scores.get(family)
    if (!fam) scores.set(family, (fam = new Map()))
    const old = fam.get(tag)
    const keep = !old
      ? true
      : tag.startsWith('/Expressive/')
        ? normal && !old.normal
          ? true
          : normal === old.normal && score > old.score
        : score > old.score
    if (keep) fam.set(tag, { score, normal: normal || (old?.normal ?? false) })
  }
  const all = [
    ...new Set(
      [...scores.values()].flatMap((f) =>
        [...f].filter(([, v]) => v.score >= MIN_TAG_SCORE).map(([t]) => t)
      )
    )
  ].sort()
  const index = new Map(all.map((t, i) => [t, i]))
  const families: Record<string, number[]> = {}
  for (const [family, fam] of [...scores].sort(([a], [b]) => a.localeCompare(b))) {
    const flat = [...fam]
      .filter(([, v]) => v.score >= MIN_TAG_SCORE)
      .sort(([a], [b]) => index.get(a)! - index.get(b)!)
      .flatMap(([t, v]) => [index.get(t)!, v.score])
    if (flat.length) families[family] = flat
  }
  return { tags: all, families }
}

/** Celle di una riga CSV, con le virgolette per le celle che hanno virgole */
function csvCells(line: string): string[] {
  const out: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cell += '"'
        i++
      } else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === ',') {
      out.push(cell)
      cell = ''
    } else cell += c
  }
  out.push(cell)
  return out.map((c) => c.trim())
}

/** File di un archivio .tgz (come i pacchetti npm) i cui percorsi soddisfano `want` */
export function untgz(data: Buffer, want: (path: string) => boolean): Map<string, Buffer> {
  const tar = gunzipSync(data)
  const out = new Map<string, Buffer>()
  let pos = 0
  let longName: string | null = null
  while (pos + 512 <= tar.length) {
    const header = tar.subarray(pos, pos + 512)
    if (header.every((b) => b === 0)) break
    const field = (start: number, len: number): string =>
      header
        .subarray(start, start + len)
        .toString('utf8')
        .replace(/\0.*$/s, '')
    const size = parseInt(field(124, 12).trim() || '0', 8)
    const type = field(156, 1)
    const prefix = field(345, 155)
    let name = longName ?? (prefix ? `${prefix}/${field(0, 100)}` : field(0, 100))
    longName = null
    const body = tar.subarray(pos + 512, pos + 512 + size)
    if (type === 'L') longName = body.toString('utf8').replace(/\0.*$/s, '')
    else if (type === 'x') {
      // intestazione estesa pax: può contenere il percorso completo
      const m = body.toString('utf8').match(/\d+ path=([^\n]*)\n/)
      if (m) longName = m[1]
    } else if ((type === '0' || type === '') && want((name = name.replace(/^\.\//, ''))))
      out.set(name, Buffer.from(body))
    pos += 512 + Math.ceil(size / 512) * 512
  }
  return out
}
