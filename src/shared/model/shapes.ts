import { BUILTIN_SHAPES } from './markup'
import { imageVariable, type ImageVariable, type Variables } from './variables'

// Forme predefinite degli sfondi (bg= nel markup, sfondo delle variabili immagine) come tracciati
// in un quadrato 100 × 100: le usano l'SVG delle carte e dei documenti e il canvas dell'export
// in Word. E lo sfondo di una variabile immagine, risolto una volta per tutti.

export const SHAPE_PATHS: Record<(typeof BUILTIN_SHAPES)[number], string> = {
  circle: 'M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0Z',
  square: 'M0 0H100V100H0Z',
  rounded:
    'M22 0H78A22 22 0 0 1 100 22V78A22 22 0 0 1 78 100H22A22 22 0 0 1 0 78V22A22 22 0 0 1 22 0Z',
  // esagono regolare: alto √3 / 2 della larghezza, al centro del quadrato
  hexagon: 'M25 6.7H75L100 50L75 93.3H25L0 50Z',
  diamond: 'M50 0L100 50L50 100L0 50Z'
}

export const shapePath = (name: string): string | undefined =>
  Object.prototype.hasOwnProperty.call(SHAPE_PATHS, name)
    ? SHAPE_PATHS[name as keyof typeof SHAPE_PATHS]
    : undefined

/** Spazio di base tra l'immagine e il bordo dello sfondo, per parte */
export const BACKDROP_PAD = 0.18

/**
 * Sfondo di una variabile immagine: una forma o un file (anche da un'altra variabile, con la sua
 * tinta), il colore (null = quello di base) e lo spazio attorno all'immagine
 */
export interface Backdrop {
  shape?: string
  src?: string
  color: string | null
  pad: number
}

export function imageBackdrop(
  v: ImageVariable | undefined,
  vars: Variables | undefined
): Backdrop | null {
  const name = v?.bg?.trim().replace(/^\{(.*)\}$/, '$1')
  if (!v || !name) return null
  const pad = Math.min(0.45, Math.max(0, v.bgPad ?? BACKDROP_PAD))
  const color = v.bgColor?.trim() || null
  if (shapePath(name)) return { shape: name, color, pad }
  // un'altra variabile: il suo file e la sua tinta, ma non il suo sfondo
  const other = name !== v.src ? imageVariable(name, vars) : undefined
  if (other && other !== v) return { src: other.src, color: color ?? (other.tint || null), pad }
  return { src: name, color, pad }
}

interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** Il quadrato dello sfondo: il più grande che sta nel riquadro, al centro */
export function backdropSquare(b: Box): Box {
  const s = Math.min(b.w, b.h)
  return { x: b.x + (b.w - s) / 2, y: b.y + (b.h - s) / 2, w: s, h: s }
}

/** Dove va l'immagine sopra lo sfondo */
export function backdropInner(b: Box, d: Pick<Backdrop, 'pad'>): Box {
  const q = backdropSquare(b)
  const m = q.w * d.pad
  return { x: q.x + m, y: q.y + m, w: q.w - 2 * m, h: q.h - 2 * m }
}
