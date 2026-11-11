import qrcode from 'qrcode-generator'

// Codici QR come immagini: «qr:» seguito da un testo o un indirizzo, al posto del nome di un file
// in un livello immagine (o in una colonna, o in una formula). Il disegno è un SVG nero su bianco,
// con un margine bianco di due moduli perché si legga anche su uno sfondo scuro.

const PREFIX = /^qr:/i

/** «qr:testo»: un codice QR invece di un file */
export function isQrImage(name: string): boolean {
  return PREFIX.test(name.trim())
}

/** Il testo da codificare, senza «qr:» */
export function qrText(name: string): string {
  return name.trim().replace(PREFIX, '').trim()
}

/** Quiet zone, in moduli */
const MARGIN = 2

/** Il codice come SVG, un'unità per modulo; null se il testo è troppo lungo per un QR */
export function qrSvg(text: string): string | null {
  const qr = qrcode(0, 'M')
  try {
    // la libreria prende un byte per carattere: il testo va prima in UTF-8
    qr.addData(String.fromCharCode(...new TextEncoder().encode(text)), 'Byte')
    qr.make()
  } catch {
    return null
  }
  const n = qr.getModuleCount()
  const size = n + 2 * MARGIN
  let d = ''
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + MARGIN} ${r + MARGIN}h1v1h-1z`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size * 10}" height="${size * 10}" ` +
    `viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
    `<rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`
  )
}

/** L'indirizzo data: dell'SVG, per un'immagine; vuoto se il testo non entra in un QR */
export function qrDataUrl(text: string): string {
  const svg = qrSvg(text)
  return svg ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) : ''
}
