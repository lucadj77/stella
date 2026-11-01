import { net } from 'electron'
import JSZip from 'jszip'
import { mkdir, rename, writeFile } from 'fs/promises'
import { join } from 'path'
import type { CatalogUpdate, IconCatalog } from '../../shared/library'
import { MessageError, msg } from '../../shared/messages'
import {
  gameIconsCatalog,
  googleFontTags,
  googleFontsCatalog,
  tagPageIcons,
  untgz
} from './catalogParse'
import { fontCatalog, forgetCatalogs, iconCatalog, userCatalogDir } from './catalogs'

// Aggiornamento dall'app dei cataloghi di game-icons.net (archivio del repository su GitHub e
// pagine dei tag del sito) e dei font Google (pacchetto npm google-font-metadata, e gli stili dal
// repository google/fonts). Il risultato
// va nella cartella dei dati dell'utente; quelli inclusi nell'app non si toccano.

const GAME_ICONS_ZIP = 'https://github.com/game-icons/icons/archive/refs/heads/master.zip'
const TAG_PAGE = 'https://game-icons.net/tags/'
const FONT_METADATA = 'https://registry.npmjs.org/google-font-metadata/latest'
const FONT_TAGS = 'https://raw.githubusercontent.com/google/fonts/main/tags/all/families.csv'

async function get(url: string): Promise<Response> {
  let res: Response
  try {
    res = await net.fetch(url)
  } catch (e) {
    throw new MessageError(msg('catalog.network', { error: String((e as Error).message ?? e) }))
  }
  if (!res.ok) throw new MessageError(msg('catalog.httpError', { status: res.status, url }))
  return res
}

async function save(file: string, data: unknown): Promise<void> {
  await mkdir(userCatalogDir(), { recursive: true })
  const target = join(userCatalogDir(), file)
  await writeFile(target + '.tmp', JSON.stringify(data))
  await rename(target + '.tmp', target)
}

export async function updateGameIcons(): Promise<CatalogUpdate> {
  const before = await iconCatalog('game-icons')
  const zip = await JSZip.loadAsync(await (await get(GAME_ICONS_ZIP)).arrayBuffer())
  // l'archivio ha tutto in una cartella "icons-master/"
  const files = new Map<string, string>()
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue
    const path = entry.name.replace(/^[^/]+\//, '')
    if (path === 'license.txt' || /^[^/]+\/[^/]+\.svg$/.test(path))
      files.set(path, await entry.async('string'))
  }
  const catalog = gameIconsCatalog(files)
  if (catalog.icons.length < before.icons.length / 2)
    throw new MessageError(msg('catalog.tooSmall', { n: catalog.icons.length }))
  const tags = await gameIconsTags(before.tags, new Set(catalog.icons.map(([id]) => id)))
  await save('game-icons.json', { ...catalog, tags, updated: new Date().toISOString() })
  forgetCatalogs()
  return { before: before.icons.length, after: catalog.icons.length }
}

/**
 * Tag delle icone dalle pagine del sito, per i tag già noti. Se una pagina non si legge, per
 * quel tag restano le icone di prima.
 */
async function gameIconsTags(
  old: IconCatalog['tags'],
  known: Set<string>
): Promise<IconCatalog['tags']> {
  const slugs = old.groups.flatMap((g) => g.tags.map((t) => t.slug))
  const pages = new Map<string, string[]>()
  for (let i = 0; i < slugs.length; i += 8)
    await Promise.all(
      slugs.slice(i, i + 8).map(async (slug) => {
        try {
          pages.set(slug, tagPageIcons(await (await get(`${TAG_PAGE}${slug}.html`)).text()))
        } catch {
          // pagina non raggiungibile: si tengono i tag di prima
        }
      })
    )
  const icons: Record<string, string[]> = {}
  for (const [id, list] of Object.entries(old.icons))
    for (const slug of list) if (!pages.has(slug) && known.has(id)) (icons[id] ??= []).push(slug)
  for (const [slug, ids] of pages)
    for (const id of ids) if (known.has(id)) (icons[id] ??= []).push(slug)
  return {
    groups: old.groups,
    icons: Object.fromEntries(Object.entries(icons).sort(([a], [b]) => a.localeCompare(b)))
  }
}

export async function updateGoogleFonts(): Promise<CatalogUpdate> {
  const before = await fontCatalog()
  const meta = (await (await get(FONT_METADATA)).json()) as { dist?: { tarball?: string } }
  if (!meta.dist?.tarball) throw new MessageError(msg('catalog.badData'))
  const tgz = Buffer.from(await (await get(meta.dist.tarball)).arrayBuffer())
  const files = untgz(tgz, (p) =>
    ['package/data/google-fonts-v1.json', 'package/data/licenses.json'].includes(p)
  )
  const fonts = files.get('package/data/google-fonts-v1.json')
  const licenses = files.get('package/data/licenses.json')
  if (!fonts || !licenses) throw new MessageError(msg('catalog.badData'))
  const catalog = googleFontsCatalog(
    JSON.parse(fonts.toString('utf8')),
    JSON.parse(licenses.toString('utf8'))
  )
  if (catalog.families.length < before.families.length / 2)
    throw new MessageError(msg('catalog.tooSmall', { n: catalog.families.length }))
  // gli stili: se il file non si legge o è troppo piccolo resta la copia che c'è
  const tags = googleFontTags(await (await get(FONT_TAGS)).text())
  const oldTags = Object.keys(before.tags?.families ?? {}).length
  await save('google-fonts.json', { ...catalog, updated: new Date().toISOString() })
  if (Object.keys(tags.families).length >= oldTags / 2)
    await save('google-fonts-tags.json', { source: FONT_TAGS, ...tags })
  forgetCatalogs()
  return { before: before.families.length, after: catalog.families.length }
}
