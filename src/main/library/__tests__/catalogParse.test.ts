import { gzipSync } from 'zlib'
import { describe, expect, it } from 'vitest'
import {
  gameIconsCatalog,
  googleFontTags,
  googleFontsCatalog,
  tagPageIcons,
  untgz
} from '../catalogParse'

describe('gameIconsCatalog', () => {
  it('reads authors from license.txt and paths without the background', () => {
    const files = new Map([
      [
        'license.txt',
        '- Lorc, http://lorcblog.blogspot.com\n- Viscious Speed, http://x.com - CC0\n'
      ],
      ['lorc/sword.svg', '<svg><path d="M0 0h512v512H0z"/><path fill="#fff" d="M1 2L3 4"/></svg>'],
      ['viscious-speed/coin.svg', '<svg><path d="M5 5h1"/></svg>'],
      ['badges/x.svg', '<svg><path d="M1 1"/></svg>'],
      ['README.md', '#']
    ])
    const c = gameIconsCatalog(files)
    expect(c.icons).toEqual([
      ['lorc/sword', 'M1 2L3 4'],
      ['viscious-speed/coin', 'M5 5h1']
    ])
    expect(c.authors.lorc).toEqual({
      name: 'Lorc',
      url: 'http://lorcblog.blogspot.com',
      license: 'CC-BY-3.0'
    })
    expect(c.authors['viscious-speed'].license).toBe('CC0-1.0')
  })
})

describe('tagPageIcons', () => {
  it('collects the linked icons once', () => {
    const html =
      '<a href="/1x1/lorc/sword.html"></a><a href="/1x1/lorc/sword.html"></a>' +
      '<a href="/1x1/delapouite/axe.html"></a><a href="/tags/blade.html"></a>'
    expect(tagPageIcons(html)).toEqual(['lorc/sword', 'delapouite/axe'])
  })
})

describe('googleFontsCatalog', () => {
  it('maps the license names to SPDX', () => {
    const c = googleFontsCatalog(
      {
        cinzel: {
          family: 'Cinzel',
          category: 'serif',
          weights: [400, 700],
          styles: ['normal'],
          subsets: ['latin']
        }
      },
      { cinzel: { license: { type: 'SIL Open Font License, 1.1' }, authors: { copyright: 'C' } } }
    )
    expect(c.families).toEqual([['Cinzel', 'serif', [400, 700], 0, ['latin'], 'OFL-1.1', 'C']])
  })
})

/** Archivio tar minimo con un file per voce */
function tar(files: Record<string, string>): Buffer {
  const parts: Buffer[] = []
  for (const [name, text] of Object.entries(files)) {
    const body = Buffer.from(text)
    const h = Buffer.alloc(512)
    h.write(name, 0)
    h.write(body.length.toString(8).padStart(11, '0') + '\0', 124)
    h.write('0', 156)
    parts.push(h, body, Buffer.alloc((512 - (body.length % 512)) % 512))
  }
  parts.push(Buffer.alloc(1024))
  return gzipSync(Buffer.concat(parts))
}

describe('googleFontTags', () => {
  it('legge i tag, col punteggio del peso normale per le sensazioni', () => {
    const csv = [
      'Family,Axes,Tag,Weight',
      'Cinzel,wght@900,/Expressive/Loud,74',
      'Cinzel,wght@400,/Expressive/Loud,44',
      'Cinzel,,/Seasonal/Christmas,86',
      'Cinzel,,/Quality/Drawing,70',
      'Advent Pro,"wdth,wght@100,900",/Expressive/Active,40',
      'Advent Pro,"wdth,wght@100,100",/Expressive/Active,5',
      'Aladin,,/Theme/Art Nouveau,70',
      'Aladin,,/Theme/Pixel,10'
    ].join('\n')
    const t = googleFontTags(csv)
    expect(t.tags).toEqual([
      '/Expressive/Active',
      '/Expressive/Loud',
      '/Seasonal/Christmas',
      '/Theme/Art Nouveau'
    ])
    expect(t.families.Cinzel).toEqual([1, 44, 2, 86])
    // senza il peso normale vale il punteggio più alto
    expect(t.families['Advent Pro']).toEqual([0, 40])
    // sotto 20 il tag non si tiene
    expect(t.families.Aladin).toEqual([3, 70])
  })
})

describe('untgz', () => {
  it('extracts the files asked for', () => {
    const data = tar({ 'package/a.json': '{"a":1}', 'package/b.txt': 'no' })
    const out = untgz(data, (p) => p.endsWith('.json'))
    expect([...out.keys()]).toEqual(['package/a.json'])
    expect(out.get('package/a.json')!.toString()).toBe('{"a":1}')
  })
})
