import { outlinePath } from '../../../shared/model/outline'

/** Lato più lungo dell'immagine nel calcolo del contorno, in pixel */
const SIZE = 400

/**
 * Contorno di un'immagine (PNG, SVG, JPG...) come tracciato 0-1, e il rapporto larghezza/altezza
 * dell'immagine. Conta la trasparenza; in un'immagine senza trasparenza contano i pixel scuri.
 */
export async function traceImage(url: string): Promise<{ path: string; ratio: number }> {
  let blob = await (await fetch(url)).blob()
  if (/\.svg$/i.test(url) || blob.type.includes('svg')) blob = sizedSvg(await blob.text())
  // la politica dei contenuti ammette data: ma non blob: per le immagini
  const src = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
  const img = new Image()
  img.src = src
  await img.decode()
  const iw = img.naturalWidth || SIZE
  const ih = img.naturalHeight || SIZE
  const k = SIZE / Math.max(iw, ih)
  const w = Math.max(1, Math.round(iw * k))
  const h = Math.max(1, Math.round(ih * k))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, w, h)
  const d = ctx.getImageData(0, 0, w, h).data
  const alpha = new Uint8Array(w * h)
  let opaque = true
  for (let i = 0; i < w * h; i++) {
    alpha[i] = d[i * 4 + 3]
    if (alpha[i] < 250) opaque = false
  }
  if (opaque)
    for (let i = 0; i < w * h; i++) {
      const lum = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]
      alpha[i] = 255 - lum
    }
  // un'immagine tutta semitrasparente ha comunque una sagoma: la soglia scende a metà dell'alfa
  // più alto
  let top = 0
  for (let i = 0; i < w * h; i++) if (alpha[i] > top) top = alpha[i]
  const threshold = Math.min(128, Math.max(1, Math.ceil(top / 2)))
  return { path: outlinePath(alpha, w, h, { threshold }), ratio: iw / ih }
}

/**
 * Un SVG con solo il viewBox non ha dimensioni proprie e non si disegna bene sul canvas: gli si
 * danno larghezza e altezza in proporzione al viewBox. Il tipo del blob dev'essere quello SVG.
 */
function sizedSvg(text: string): Blob {
  const root = /<svg\b[^>]*>/i.exec(text)
  if (root && !/\swidth\s*=/.test(root[0])) {
    const vb = /viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(
      root[0]
    )
    const [vw, vh] = vb ? [Number(vb[1]), Number(vb[2])] : [1, 1]
    const k = SIZE / Math.max(vw, vh)
    const sized = root[0].replace(/^<svg/i, `<svg width="${vw * k}" height="${vh * k}"`)
    text = text.replace(root[0], sized)
  }
  return new Blob([text], { type: 'image/svg+xml' })
}
