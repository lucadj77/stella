import type { FontCatalog, FontFamilyEntry, FontTags } from '../library'

// Ricerca dei font Google per stile, con i tag che Google stesso dà ai font (google-fonts-tags.json):
// generi pensati per i giochi, stili scelti dall'elenco dei tag, font simili a uno dato.
// Vedi docs/specifica.md, sezione 10.2.

export const FONT_GENRES = [
  'fantasy',
  'horror',
  'western',
  'scifi',
  'retro',
  'military',
  'kids',
  'elegant'
] as const

export type FontGenre = (typeof FONT_GENRES)[number]

/** Una condizione: tutti i tag col punteggio minimo, e la categoria se indicata */
interface Clause {
  tags: [string, number][]
  categories?: string[]
}

interface GenreRule {
  /** Il font è del genere se soddisfa almeno una condizione */
  any: Clause[]
  /** Tag che danno l'ordine per attinenza, col loro peso */
  rank: [string, number][]
  /** Parole che lo trovano nella ricerca, oltre al nome tradotto */
  words: string[]
}

const T = (group: string, tag: string): string => `/${group}/${tag}`

export const GENRE_RULES: Record<FontGenre, GenreRule> = {
  fantasy: {
    any: [
      { tags: [[T('Theme', 'Medieval'), 50]] },
      { tags: [[T('Theme', 'Blackletter'), 50]] },
      {
        tags: [
          [T('Expressive', 'Vintage'), 85],
          [T('Expressive', 'Fancy'), 75]
        ],
        categories: ['serif', 'display']
      }
    ],
    rank: [
      [T('Theme', 'Medieval'), 1],
      [T('Theme', 'Blackletter'), 1],
      [T('Expressive', 'Vintage'), 0.3],
      [T('Expressive', 'Fancy'), 0.3]
    ],
    words: ['fantasy', 'fantasia', 'medieval', 'medievale']
  },
  horror: {
    any: [{ tags: [[T('Seasonal', 'Halloween'), 70]] }, { tags: [[T('Theme', 'Distressed'), 70]] }],
    rank: [
      [T('Seasonal', 'Halloween'), 1],
      [T('Theme', 'Distressed'), 1]
    ],
    words: ['horror', 'paura', 'scary']
  },
  western: {
    any: [{ tags: [[T('Theme', 'Woodtype'), 50]] }, { tags: [[T('Theme', 'Tuscan'), 50]] }],
    rank: [
      [T('Theme', 'Woodtype'), 1],
      [T('Theme', 'Tuscan'), 1]
    ],
    words: ['western', 'far west', 'cowboy']
  },
  scifi: {
    any: [
      { tags: [[T('Theme', 'Techno'), 70]] },
      { tags: [[T('Expressive', 'Futuristic'), 85]], categories: ['display'] }
    ],
    rank: [
      [T('Theme', 'Techno'), 1],
      [T('Expressive', 'Futuristic'), 0.3]
    ],
    words: ['sci-fi', 'scifi', 'science fiction', 'fantascienza', 'futuro', 'future', 'space']
  },
  retro: {
    any: [{ tags: [[T('Theme', 'Pixel'), 50]] }],
    rank: [[T('Theme', 'Pixel'), 1]],
    words: ['retro', 'retrò', 'arcade', '8 bit', '8-bit', 'pixel']
  },
  military: {
    any: [{ tags: [[T('Theme', 'Stencil'), 50]] }],
    rank: [[T('Theme', 'Stencil'), 1]],
    words: ['military', 'militare', 'guerra', 'war', 'army']
  },
  kids: {
    any: [
      { tags: [[T('Expressive', 'Childlike'), 70]], categories: ['display', 'handwriting'] },
      { tags: [[T('Expressive', 'Cute'), 80]], categories: ['display', 'handwriting'] }
    ],
    rank: [
      [T('Expressive', 'Childlike'), 1],
      [T('Expressive', 'Cute'), 1]
    ],
    words: ['kids', 'children', 'bambini', 'infantile']
  },
  elegant: {
    any: [
      { tags: [[T('Script', 'Formal'), 70]] },
      {
        tags: [
          [T('Expressive', 'Fancy'), 85],
          [T('Expressive', 'Sophisticated'), 60]
        ],
        categories: ['serif']
      }
    ],
    rank: [
      [T('Script', 'Formal'), 1],
      [T('Expressive', 'Fancy'), 0.3],
      [T('Expressive', 'Sophisticated'), 0.3]
    ],
    words: ['elegant', 'elegante', 'wedding', 'matrimonio']
  }
}

/** Stili da scegliere nell'elenco, per gruppo; gli altri tag di Google non servono a un gioco */
export const STYLE_GROUPS: {
  group: 'theme' | 'seasonal' | 'feeling' | 'shape' | 'purpose'
  tags: string[]
}[] = [
  {
    group: 'theme',
    tags: [
      'Medieval',
      'Blackletter',
      'Woodtype',
      'Tuscan',
      'Stencil',
      'Pixel',
      'Brush',
      'Distressed',
      'Techno',
      'Art Deco',
      'Art Nouveau',
      'Wacky',
      'Blobby',
      'Shaded',
      'Inline'
    ].map((t) => T('Theme', t))
  },
  {
    group: 'seasonal',
    tags: ['Halloween', 'Christmas', "Valentine's Day", 'Lunar New Year'].map((t) =>
      T('Seasonal', t)
    )
  },
  {
    group: 'feeling',
    tags: [
      'Calm',
      'Playful',
      'Vintage',
      'Rugged',
      'Fancy',
      'Sophisticated',
      'Futuristic',
      'Childlike',
      'Cute',
      'Happy',
      'Excited',
      'Active',
      'Artistic',
      'Business',
      'Competent',
      'Sincere',
      'Innovative',
      'Loud',
      'Stiff',
      'Awkward'
    ].map((t) => T('Expressive', t))
  },
  {
    group: 'shape',
    tags: [
      T('Sans', 'Geometric'),
      T('Sans', 'Humanist'),
      T('Sans', 'Rounded'),
      T('Sans', 'Grotesque'),
      T('Sans', 'Neo Grotesque'),
      T('Sans', 'Superellipse'),
      T('Sans', 'Glyphic'),
      T('Serif', 'Old Style Garalde'),
      T('Serif', 'Transitional'),
      T('Serif', 'Didone'),
      T('Serif', 'Modern'),
      T('Serif', 'Humanist Venetian'),
      T('Serif', 'Fat Face'),
      T('Serif', 'Scotch'),
      T('Slab', 'Clarendon'),
      T('Slab', 'Geometric'),
      T('Slab', 'Humanist'),
      T('Script', 'Formal'),
      T('Script', 'Informal'),
      T('Script', 'Handwritten'),
      T('Script', 'Upright Script')
    ]
  },
  { group: 'purpose', tags: [T('Purpose', 'Easy Reading'), T('Purpose', 'Learn To Write')] }
]

/** Chiave del testo tradotto di un tag: "/Theme/Art Deco" → "theme-art-deco" */
export function tagSlug(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Punteggio minimo perché un font abbia uno stile scelto dall'elenco o trovato con la ricerca */
export const STYLE_MIN = 50
const SEARCH_MIN = 60

/** Tag di ogni famiglia come mappa tag → punteggio */
export type TagIndex = Map<string, Map<string, number>>

export function tagIndex(tags: FontTags | undefined): TagIndex {
  const out: TagIndex = new Map()
  if (!tags) return out
  for (const [family, flat] of Object.entries(tags.families)) {
    const m = new Map<string, number>()
    for (let i = 0; i + 1 < flat.length; i += 2) {
      const tag = tags.tags[flat[i]]
      if (tag) m.set(tag, flat[i + 1])
    }
    out.set(family, m)
  }
  return out
}

const score = (idx: TagIndex, family: string, tag: string): number => idx.get(family)?.get(tag) ?? 0

export function inGenre(idx: TagIndex, f: FontFamilyEntry, genre: FontGenre): boolean {
  return GENRE_RULES[genre].any.some(
    (c) =>
      (!c.categories || c.categories.includes(f[1])) &&
      c.tags.every(([tag, min]) => score(idx, f[0], tag) >= min)
  )
}

/** Il font ha lo stile, abbastanza da mostrarlo quando lo si sceglie */
export function hasStyle(idx: TagIndex, f: FontFamilyEntry, tag: string): boolean {
  return score(idx, f[0], tag) >= STYLE_MIN
}

/** Ha il grassetto e il corsivo, per il testo delle carte con ** e * */
export function hasBoldItalic(f: FontFamilyEntry): boolean {
  return f[3] === 1 && f[2].some((w) => w >= 600)
}

export interface FontFilter {
  category: string | null
  genre: FontGenre | null
  style: string | null
  boldItalic: boolean
  /** Alfabeto richiesto ("greek", "cyrillic"…) */
  subset: string | null
  /** Testo cercato; i nomi tradotti dei tag e dei generi servono a cercare per stile */
  query: string
}

export interface FontLabels {
  tag(tag: string): string
  genre(genre: FontGenre): string
}

const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/**
 * Font del catalogo che vanno coi filtri. Con un genere o uno stile l'ordine è per attinenza;
 * la ricerca trova i nomi che contengono il testo e i font che hanno lo stile cercato.
 */
export function filterFonts(
  catalog: FontCatalog,
  idx: TagIndex,
  filter: FontFilter,
  labels: FontLabels
): FontFamilyEntry[] {
  const q = norm(filter.query)
  // tag e generi il cui nome (tradotto o inglese) contiene il testo, o viceversa per i generi
  const tagHits = q
    ? STYLE_GROUPS.flatMap((g) => g.tags).filter(
        (t) => norm(labels.tag(t)).includes(q) || norm(t.split('/')[2]).includes(q)
      )
    : []
  const genreHits = q
    ? FONT_GENRES.filter(
        (g) =>
          norm(labels.genre(g)).includes(q) ||
          GENRE_RULES[g].words.some(
            (w) => norm(w).startsWith(q) || (q.length > 3 && q.includes(norm(w)))
          )
      )
    : []
  const list = catalog.families.filter(
    (f) =>
      (!filter.category || f[1] === filter.category) &&
      (!filter.genre || inGenre(idx, f, filter.genre)) &&
      (!filter.style || hasStyle(idx, f, filter.style)) &&
      (!filter.boldItalic || hasBoldItalic(f)) &&
      (!filter.subset || f[4].includes(filter.subset)) &&
      (!q ||
        norm(f[0]).includes(q) ||
        tagHits.some((t) => score(idx, f[0], t) >= SEARCH_MIN) ||
        genreHits.some((g) => inGenre(idx, f, g)))
  )
  const rank: [string, number][] = [
    ...(filter.genre ? GENRE_RULES[filter.genre].rank : []),
    ...(filter.style ? ([[filter.style, 1]] as [string, number][]) : [])
  ]
  if (q && !rank.length) {
    // con la ricerca vengono prima i nomi che la contengono, poi i font trovati per stile
    const byName = (f: FontFamilyEntry): number =>
      norm(f[0]).startsWith(q) ? 0 : norm(f[0]).includes(q) ? 1 : 2
    return list.sort((a, b) => byName(a) - byName(b) || a[0].localeCompare(b[0]))
  }
  if (!rank.length) return list
  const relevance = (f: FontFamilyEntry): number =>
    rank.reduce((sum, [t, w]) => sum + w * score(idx, f[0], t), 0)
  return list.sort((a, b) => relevance(b) - relevance(a) || a[0].localeCompare(b[0]))
}

const LATIN = new Set([
  'latin',
  'latin-ext',
  'vietnamese',
  'greek',
  'greek-ext',
  'cyrillic',
  'cyrillic-ext',
  'math',
  'symbols',
  'menu'
])

/**
 * Font più simili a `family` per le sensazioni che danno (calmo, giocoso, vintage…), dal più
 * vicino. Si scartano i font per alfabeti che quello di partenza non ha (cinese, arabo…) e le
 * varianti della stessa famiglia ("Bitcount Grid" per "Bitcount").
 */
export function similarFonts(
  catalog: FontCatalog,
  idx: TagIndex,
  family: string,
  count = 24
): FontFamilyEntry[] {
  const base = catalog.families.find((f) => f[0] === family)
  if (!base) return []
  const feel = STYLE_GROUPS.find((g) => g.group === 'feeling')!.tags
  const vec = (name: string): number[] => feel.map((t) => score(idx, name, t))
  const v = vec(family)
  const norm2 = Math.hypot(...v)
  if (!norm2) return []
  const extra = (f: FontFamilyEntry): string[] => f[4].filter((s) => !LATIN.has(s))
  const own = new Set(extra(base))
  const stem = family.split(' ')[0]
  return catalog.families
    .filter(
      (f) =>
        f[0] !== family &&
        idx.has(f[0]) &&
        extra(f).every((s) => own.has(s)) &&
        f[0].split(' ')[0] !== stem
    )
    .map((f) => {
      const w = vec(f[0])
      const n = Math.hypot(...w)
      const cos = n ? w.reduce((s, x, i) => s + x * v[i], 0) / (n * norm2) : 0
      return { f, sim: cos + (f[1] === base[1] ? 0.05 : 0) }
    })
    .sort((a, b) => b.sim - a.sim)
    .slice(0, count)
    .map((x) => x.f)
}
