// Indirizzo interno di un'immagine collegata da internet nell'app desktop:
// gc-asset://remote/<versione>/<indirizzo in base64url>[.svg]. La versione cambia quando si
// aggiornano i collegamenti, così il browser non usa la copia vecchia; .svg alla fine serve a
// chi legge le dimensioni degli SVG dal testo.

function toBase64Url(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): string {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

export function encodeRemotePath(url: string, version: number): string {
  const svg = /\.svg$/i.test(new URL(url).pathname) ? '.svg' : ''
  return `/${version}/${toBase64Url(url)}${svg}`
}

export function decodeRemotePath(pathname: string): string | null {
  const m = /^\/\d+\/([A-Za-z0-9_-]+)(?:\.svg)?$/.exec(pathname)
  if (!m) return null
  try {
    return fromBase64Url(m[1])
  } catch {
    return null
  }
}

const TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg'
}
export const IMAGE_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
}

/** Estensione dal tipo dichiarato dal sito, o dal nome nell'indirizzo */
export function imageExtension(url: string, contentType: string | null): string | null {
  const type = (contentType ?? '').split(';')[0].trim().toLowerCase()
  if (TYPES[type]) return TYPES[type]
  const path = new URL(url).pathname.toLowerCase()
  const ext = Object.keys(IMAGE_MIME).find((e) => path.endsWith(e))
  // un sito che risponde con un tipo generico (octet-stream) ma con un nome chiaro
  return ext && (!type || type === 'application/octet-stream' || type.startsWith('image/'))
    ? ext === '.jpeg'
      ? '.jpg'
      : ext
    : null
}

/** Nome proposto per il file: l'ultima parte dell'indirizzo, senza estensione */
export function nameFromUrl(url: string): string {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() ?? '')
    const name = last
      .replace(/\.[^.]+$/, '')
      .replace(/[^\p{L}\p{N} _-]+/gu, '_')
      .replace(/^[^\p{L}\p{N}]+/u, '')
      .slice(0, 80)
    return name || 'image'
  } catch {
    return 'image'
  }
}
