import { describe, expect, it } from 'vitest'
import { decodeRemotePath, encodeRemotePath } from '../remoteUrl'
import { isRemoteImage, resolveAsset } from '../assets'

describe('immagini da internet', () => {
  it('riconosce gli indirizzi', () => {
    expect(isRemoteImage('https://example.com/a.png')).toBe(true)
    expect(isRemoteImage(' http://x.it/img?id=3 ')).toBe(true)
    expect(isRemoteImage('spada')).toBe(false)
    expect(isRemoteImage('https://a b.png')).toBe(false)
  })

  it('un indirizzo si risolve in sé stesso', () => {
    expect(resolveAsset('https://example.com/a.png', [])).toEqual({
      ok: true,
      path: 'https://example.com/a.png'
    })
  })

  it("l'indirizzo interno torna quello di partenza", () => {
    const url = 'https://example.com/è/icona.svg?x=1&y=é'
    const path = encodeRemotePath(url, 3)
    expect(path.startsWith('/3/')).toBe(true)
    expect(decodeRemotePath(path)).toBe(url)
    expect(encodeRemotePath('https://example.com/a.svg', 0).endsWith('.svg')).toBe(true)
    expect(decodeRemotePath(encodeRemotePath('https://example.com/a.svg', 0))).toBe(
      'https://example.com/a.svg'
    )
  })
})

describe('tipo e nome da un indirizzo', async () => {
  const { imageExtension, nameFromUrl } = await import('../remoteUrl')
  it('estensione dal tipo o dal nome', () => {
    expect(imageExtension('https://x.it/a', 'image/png')).toBe('.png')
    expect(imageExtension('https://x.it/a.JPEG', 'application/octet-stream')).toBe('.jpg')
    expect(imageExtension('https://x.it/a.svg', null)).toBe('.svg')
    expect(imageExtension('https://x.it/pagina.html', 'text/html')).toBe(null)
    expect(imageExtension('https://x.it/a.gif', 'image/gif')).toBe(null)
  })
  it('nome proposto', () => {
    expect(nameFromUrl('https://x.it/img/Drago%20rosso.png?w=3')).toBe('Drago rosso')
    expect(nameFromUrl('https://x.it/')).toBe('image')
    expect(nameFromUrl('https://x.it/a(1).png')).toBe('a_1_')
  })
})

describe('crediti delle immagini da internet', async () => {
  const { creditsText } = await import('../credits')
  const labels = {
    icons: (s: string) => `Icone ${s}`,
    font: (f: string) => `Font ${f}`,
    licenseName: (x: string) => x,
    images: () => 'Immagini da internet:'
  }
  it('cita le immagini scaricate e quelle collegate', () => {
    const text = creditsText(
      {
        'images/drago.png': {
          kind: 'image',
          source: 'x.it',
          id: 'https://x.it/drago.png',
          title: 'drago',
          license: '',
          url: 'https://x.it/drago.png',
          imported: '2026-11-05'
        }
      },
      labels,
      undefined,
      ['https://y.it/mappa.jpg']
    )
    expect(text).toBe(
      'Immagini da internet:\n- drago: https://x.it/drago.png\n- https://y.it/mappa.jpg\n'
    )
  })
})
