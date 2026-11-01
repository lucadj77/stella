import { readFileSync } from 'fs'
import { describe, expect, it } from 'vitest'
import type { FontCatalog, FontTags } from '../../library'
import {
  FONT_GENRES,
  STYLE_GROUPS,
  filterFonts,
  hasBoldItalic,
  similarFonts,
  tagIndex,
  tagSlug,
  type FontFilter
} from '../fontSearch'

const catalog: FontCatalog = JSON.parse(
  readFileSync('resources/catalogs/google-fonts.json', 'utf8')
)
const tags: FontTags = JSON.parse(readFileSync('resources/catalogs/google-fonts-tags.json', 'utf8'))
const idx = tagIndex(tags)
const labels = { tag: (t: string) => t.split('/')[2], genre: (g: string) => g }
const none: FontFilter = {
  category: null,
  genre: null,
  style: null,
  boldItalic: false,
  subset: null,
  query: ''
}
const names = (f: FontFilter): string[] => filterFonts(catalog, idx, f, labels).map((x) => x[0])

describe('ricerca dei font per stile', () => {
  it('ogni genere trova un buon numero di font', () => {
    for (const genre of FONT_GENRES) {
      const n = names({ ...none, genre }).length
      expect(n, genre).toBeGreaterThanOrEqual(10)
    }
  })

  it('i generi trovano i font giusti, i più adatti per primi', () => {
    expect(names({ ...none, genre: 'fantasy' })).toEqual(
      expect.arrayContaining(['MedievalSharp', 'Pirata One', 'UnifrakturMaguntia'])
    )
    expect(names({ ...none, genre: 'western' }).slice(0, 10)).toContain('Rye')
    expect(names({ ...none, genre: 'retro' })).toContain('Press Start 2P')
    expect(names({ ...none, genre: 'military' })).toContain('Stardos Stencil')
  })

  it('lo stile scelto ordina per punteggio', () => {
    const list = names({ ...none, style: '/Theme/Medieval' })
    expect(list.length).toBeGreaterThan(5)
    expect(list).toContain('MedievalSharp')
  })

  it('la ricerca trova i nomi e gli stili', () => {
    expect(names({ ...none, query: 'lobster' })[0]).toBe('Lobster')
    expect(names({ ...none, query: 'medieval' })).toContain('Metamorphous')
    expect(names({ ...none, query: 'horror' })).toContain('Creepster')
  })

  it('filtra grassetto e corsivo e alfabeto', () => {
    const bi = names({ ...none, boldItalic: true })
    expect(bi).toContain('Lato')
    expect(bi).not.toContain('Bangers')
    expect(hasBoldItalic(catalog.families.find((f) => f[0] === 'Bangers')!)).toBe(false)
    expect(names({ ...none, subset: 'greek' })).not.toContain('Bangers')
  })

  it('i simili danno font dello stesso genere, senza alfabeti diversi', () => {
    const sim = similarFonts(catalog, idx, 'Pirata One').map((f) => f[0])
    expect(sim.slice(0, 10)).toContain('Germania One')
    const serif = similarFonts(catalog, idx, 'Merriweather').map((f) => f[0])
    expect(serif.some((n) => n.startsWith('Noto Serif SC'))).toBe(false)
    expect(serif).not.toContain('Merriweather Sans')
  })

  it('ogni stile ha una chiave di traduzione', () => {
    expect(tagSlug("/Seasonal/Valentine's Day")).toBe('seasonal-valentines-day')
    expect(new Set(STYLE_GROUPS.flatMap((g) => g.tags).map(tagSlug)).size).toBe(
      STYLE_GROUPS.flatMap((g) => g.tags).length
    )
  })
})
