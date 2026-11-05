import { useEffect, useState } from 'react'
import type { Anchor } from '../../../shared/model/template'

// Dimensioni naturali delle immagini, per adattarle al riquadro senza dipendere da
// preserveAspectRatio: con gli SVG privi di width/height Chromium ignora "slice".

export interface ImageSize {
  w: number
  h: number
  /** Millimetri per unità: 300 dpi per le immagini raster, 96 dpi per gli SVG */
  mmPerUnit: number
}

const cache = new Map<string, Promise<ImageSize | null>>()
/** Immagini che non si sono caricate: per quelle collegate da internet, un link rotto */
const failed = new Set<string>()

function parseSvgSize(text: string): ImageSize | null {
  const root = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement
  const vb = root
    .getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number)
  const w = parseFloat(root.getAttribute('width') ?? '')
  const h = parseFloat(root.getAttribute('height') ?? '')
  if (w > 0 && h > 0) return { w, h, mmPerUnit: 25.4 / 96 }
  if (vb && vb.length === 4 && vb[2] > 0 && vb[3] > 0)
    return { w: vb[2], h: vb[3], mmPerUnit: 25.4 / 96 }
  return null
}

function load(url: string): Promise<ImageSize | null> {
  if (url.toLowerCase().endsWith('.svg')) {
    return fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then(parseSvgSize)
      .catch(() => {
        failed.add(url)
        return null
      })
  }
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () =>
      resolve(
        img.naturalWidth
          ? { w: img.naturalWidth, h: img.naturalHeight, mmPerUnit: 25.4 / 300 }
          : null
      )
    img.onerror = () => {
      failed.add(url)
      resolve(null)
    }
    img.src = url
  })
}

/** Dimensioni naturali di un'immagine, fuori da un componente */
export function imageSize(url: string): Promise<ImageSize | null> {
  if (!cache.has(url)) cache.set(url, load(url))
  return cache.get(url)!
}

/** Dopo il tentativo: l'immagine non si è caricata */
export function imageFailed(url: string): boolean {
  return failed.has(url)
}

export function useImageSize(url: string | null): ImageSize | null {
  const [state, setState] = useState<{ url: string; size: ImageSize | null } | null>(null)
  useEffect(() => {
    if (!url) return
    if (!cache.has(url)) cache.set(url, load(url))
    let alive = true
    cache.get(url)!.then((size) => alive && setState({ url, size }))
    return () => {
      alive = false
    }
  }, [url])
  return state && state.url === url ? state.size : null
}

/** Riquadro dell'immagine dentro quello del livello, secondo l'adattamento e l'allineamento */
export function fitRect(
  box: { x: number; y: number; w: number; h: number },
  size: ImageSize,
  fit: 'cover' | 'overflow' | 'contain' | 'stretch' | 'original' | 'tile',
  align: Anchor = 'center'
): { x: number; y: number; w: number; h: number } {
  if (fit === 'stretch') return box
  const s =
    fit === 'original' || fit === 'tile'
      ? size.mmPerUnit
      : fit === 'cover' || fit === 'overflow'
        ? Math.max(box.w / size.w, box.h / size.h)
        : Math.min(box.w / size.w, box.h / size.h)
  const w = size.w * s
  const h = size.h * s
  // 0 a sinistra o in alto, 0,5 al centro, 1 a destra o in basso
  const fx = align.endsWith('left') ? 0 : align.endsWith('right') ? 1 : 0.5
  const fy = align.startsWith('top') ? 0 : align.startsWith('bottom') ? 1 : 0.5
  return { x: box.x + (box.w - w) * fx, y: box.y + (box.h - h) * fy, w, h }
}
