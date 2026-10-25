import { resolveAsset } from '../../../shared/model/assets'
import { backdropInner, shapePath, type Backdrop } from '../../../shared/model/shapes'
import { resolveColor } from '../../../shared/model/variables'
import { assetUrl } from '../render/assets'
import { dataUri } from './toSvg'

// Immagini in PNG per gli export dei documenti (Word, Markdown): le icone con la tinta e quelle
// con lo sfondo di una variabile immagine, disegnate su una tela.

export const DPI = 300

/**
 * L'immagine da un data: URL: una caricata dal progetto direttamente renderebbe la tela
 * illeggibile, come ogni immagine di un'altra origine
 */
export async function loadImage(url: string): Promise<HTMLImageElement | null> {
  const img = new Image()
  img.src = await dataUri(url)
  try {
    await img.decode()
    return img
  } catch {
    return null
  }
}

/** PNG di un'immagine a 300 punti per pollice, larga w e alta h millimetri, con la tinta */
export async function raster(
  img: HTMLImageElement,
  w: number,
  h: number,
  tint?: string
): Promise<Uint8Array> {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round((w / 25.4) * DPI))
  canvas.height = Math.max(1, Math.round((h / 25.4) * DPI))
  const c = canvas.getContext('2d')!
  c.drawImage(img, 0, 0, canvas.width, canvas.height)
  if (tint) {
    c.globalCompositeOperation = 'source-in'
    c.fillStyle = tint
    c.fillRect(0, 0, canvas.width, canvas.height)
  }
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) throw new Error('PNG encoding failed')
  return new Uint8Array(await blob.arrayBuffer())
}

const px = (mm: number): number => Math.max(1, Math.round((mm / 25.4) * DPI))

/** L'immagine contenuta nel riquadro, con la tinta se c'è */
function drawContained(
  c: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  size: number,
  tint?: string
): void {
  const r = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1
  const w = r >= 1 ? size : size * r
  const h = r >= 1 ? size / r : size
  const layer = document.createElement('canvas')
  layer.width = Math.max(1, Math.round(w))
  layer.height = Math.max(1, Math.round(h))
  const l = layer.getContext('2d')!
  l.drawImage(img, 0, 0, layer.width, layer.height)
  if (tint) {
    l.globalCompositeOperation = 'source-in'
    l.fillStyle = tint
    l.fillRect(0, 0, layer.width, layer.height)
  }
  c.drawImage(layer, x + (size - w) / 2, y + (size - h) / 2)
}

/**
 * PNG quadrato di lato `size` mm: lo sfondo di una variabile immagine (forma o immagine) e sopra,
 * al centro, l'icona. `ink` è il colore di una forma senza colore, quello del testo.
 */
export async function backdropPng(
  img: HTMLImageElement,
  d: Backdrop,
  size: number,
  opts: { assets: string[]; pal: Record<string, string>; tint?: string; ink?: string }
): Promise<Uint8Array> {
  const canvas = document.createElement('canvas')
  const s = px(size)
  canvas.width = s
  canvas.height = s
  const c = canvas.getContext('2d')!
  const color = d.color ? resolveColor(d.color, opts.pal) : undefined
  const path = d.shape ? shapePath(d.shape) : undefined
  if (path) {
    c.save()
    c.scale(s / 100, s / 100)
    c.fillStyle = color ?? opts.ink ?? '#000000'
    c.fill(new Path2D(path))
    c.restore()
  } else if (d.src) {
    const r = resolveAsset(d.src, opts.assets)
    const bg = r.ok ? await loadImage(assetUrl(r.path)) : null
    if (bg) drawContained(c, bg, 0, 0, s, color)
  }
  const inner = backdropInner({ x: 0, y: 0, w: s, h: s }, d)
  drawContained(c, img, inner.x, inner.y, inner.w, opts.tint)
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) throw new Error('PNG encoding failed')
  return new Uint8Array(await blob.arrayBuffer())
}
