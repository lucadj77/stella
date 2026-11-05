// Icone e font da importare nel progetto: cataloghi inclusi nell'app e dati di licenza.
// Vedi docs/specifica.md, sezione 10.

import type { ProjectFont } from './project'

/** Una voce di assets/sources.json: da dove viene un file e con quale licenza */
export interface SourceEntry {
  /** image: un'immagine scaricata da un indirizzo (url), da poter riscaricare */
  kind: 'icon' | 'font' | 'image'
  /** Nome della fonte, per esempio "game-icons.net" o "Google Fonts" */
  source: string
  /** Identificativo nella fonte: "lorc/broadsword", "Cinzel" */
  id: string
  title: string
  author?: string
  /** Identificativo SPDX: CC-BY-3.0, CC0-1.0, OFL-1.1, Apache-2.0... */
  license: string
  url?: string
  /** Data dell'importazione, AAAA-MM-GG */
  imported: string
}

/** File importati: percorso sotto assets/ → provenienza */
export type Sources = Record<string, SourceEntry>

export const SOURCES_FILE = 'sources.json'

export interface IconAuthor {
  name: string
  url?: string
  license: string
}

export interface IconCatalog {
  source: string
  /** "path": tracciati a un colore (il default); "image": immagini già pronte */
  kind?: 'path' | 'image'
  /** Autore di tutte le icone, quando è uno solo */
  author?: IconAuthor
  /** Autori per cartella: l'id è "cartella/nome" */
  authors: Record<string, IconAuthor>
  /** [id "cartella/nome", tracciato SVG in un riquadro 512 × 512, o data URL di un'immagine] */
  icons: [string, string][]
  tags: IconTags
}

/** Raccolte di icone incluse nell'app */
export const ICON_COLLECTIONS = ['game-icons', 'kenney-icons', 'kenney-images'] as const
export type IconCollection = (typeof ICON_COLLECTIONS)[number]

/** Cartella di assets/ in cui finiscono le icone importate da una raccolta */
export const collectionFolder = (c: IconCollection): string =>
  c === 'kenney-images' ? IMAGES_FOLDER : ICONS_FOLDER

/** Estensione del file di un'icona: svg per i tracciati, quella del data URL per le immagini */
export function iconExtension(value: string): string {
  const m = value.match(/^data:image\/(png|jpeg|webp|svg\+xml)[;,]/)
  if (!m) return 'svg'
  return m[1] === 'jpeg' ? 'jpg' : m[1] === 'svg+xml' ? 'svg' : m[1]
}

export interface IconTags {
  /** Gruppi di tag come sul sito, ognuno con i suoi tag */
  groups: { label: string; tags: { slug: string; label: string }[] }[]
  /** id dell'icona → tag */
  icons: Record<string, string[]>
}

/** [famiglia, categoria, pesi, corsivo 0/1, alfabeti, licenza SPDX o "", copyright] */
export type FontFamilyEntry = [string, string, number[], 0 | 1, string[], string, string]

export interface FontCatalog {
  source: string
  families: FontFamilyEntry[]
  /** Stili dei font secondo Google (google-fonts-tags.json), se il catalogo dei tag c'è */
  tags?: FontTags
}

/**
 * Tag di Google Fonts (google/fonts, tags/all/families.csv): gli stessi dei filtri del sito
 * fonts.google.com. Ogni famiglia ha coppie piatte [indice del tag, punteggio 0-100, ...].
 */
export interface FontTags {
  /** "/Theme/Medieval", "/Expressive/Calm"… */
  tags: string[]
  families: Record<string, number[]>
}

export interface IconImport {
  /** id nel catalogo, "lorc/broadsword" */
  id: string
  /** nome del file senza estensione, sotto assets/icons/ */
  name: string
}

/** Famiglia di font installata sul computer */
export interface SystemFontFamily {
  family: string
  /** Numero di stili (pesi e corsivi) */
  styles: number
  /** Si può copiare in assets/fonts/ */
  copyable: boolean
  /** Perché non si copia: è solo in una raccolta (ttc) o il produttore vieta l'incorporamento */
  reason?: 'collection' | 'restricted'
}

export interface FontVariant {
  weight: number
  italic: boolean
}

/** Esito dell'aggiornamento di un catalogo: numero di voci prima e dopo */
export interface CatalogUpdate {
  before: number
  after: number
}

/** Stato degli asset dopo un'importazione, per aggiornare il progetto aperto */
export interface AssetsUpdate {
  assets: string[]
  fonts: ProjectFont[]
  sources: Sources
}

export const ICONS_FOLDER = 'icons'
export const IMAGES_FOLDER = 'images'
export const FONTS_FOLDER = 'fonts'

/** Nome di file valido per un'icona: lettere, cifre, - e _ */
export function isValidAssetName(name: string): boolean {
  return /^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u.test(name) && name.length <= 80
}

export function today(): string {
  return new Date().toISOString().slice(0, 10)
}
