import type { CardShape, ComponentKind } from './template'

// Disposizioni di partenza per un nuovo template: pochi livelli già al loro posto (titolo,
// illustrazione, testo) da modificare invece che da creare. Si usano solo se l'utente le sceglie
// nella finestra «Nuovo template»: il template vuoto resta la scelta predefinita.

export type StarterKey =
  'titleArtText' | 'titleText' | 'artTitle' | 'centerIcon' | 'centerNumber' | 'titleArt' | 'figure'

/** Le disposizioni proposte per ogni tipo di componente; i dadi nascono già con il numero */
export const STARTERS: Record<ComponentKind, StarterKey[]> = {
  card: ['titleArtText', 'titleText', 'artTitle'],
  token: ['centerIcon', 'centerNumber'],
  tile: ['titleArt', 'centerIcon'],
  board: ['titleArt'],
  die: [],
  standee: ['figure']
}

/** I testi di esempio, nella lingua dell'interfaccia */
export interface StarterTexts {
  title: string
  text: string
}

interface Box {
  x: number
  y: number
  w: number
  h: number
}

const r2 = (v: number): number => Math.round(v * 100) / 100
const box = (b: Box): Box => ({ x: r2(b.x), y: r2(b.y), w: r2(b.w), h: r2(b.h) })
/** Corpo in pt che sta in un riquadro alto h mm (1 pt = 0,353 mm), con un po' di margine */
const fitSize = (h: number, share = 0.62): number => Math.max(6, Math.round((h * share) / 0.3528))

/**
 * I livelli della disposizione, il primo in cima, nel formato grezzo di normalizeLayer. `margin`
 * è il margine di sicurezza del template: i livelli ci stanno dentro; un'illustrazione a tutto
 * campo arriva fino all'abbondanza (`bleed`).
 */
export function starterLayers(
  key: StarterKey,
  w: number,
  h: number,
  margin: number,
  bleed: number,
  texts: StarterTexts,
  shape?: CardShape
): Record<string, unknown>[] {
  // un componente tondo o esagonale ha l'area utile più piccola del riquadro
  const inset = shape === 'ellipse' ? 0.15 : shape === 'hexagon' ? 0.12 : 0
  const m = margin + 1 + Math.min(w, h) * inset
  const safe: Box = { x: m, y: m, w: w - 2 * m, h: h - 2 * m }
  const title = (b: Box, align = 'center'): Record<string, unknown> => ({
    type: 'text',
    name: 'title',
    text: texts.title,
    ...box(b),
    size: fitSize(b.h),
    weight: 700,
    align,
    valign: 'middle',
    fit: 'shrink'
  })
  const art = (b: Box): Record<string, unknown> => ({
    type: 'image',
    name: 'art',
    ...box(b),
    fit: 'cover',
    missing: 'placeholder'
  })
  const body = (b: Box): Record<string, unknown> => ({
    type: 'text',
    name: 'text',
    text: texts.text,
    ...box(b),
    size: Math.min(10, fitSize(Math.min(b.h, Math.min(w, h) * 0.1))),
    align: 'left',
    valign: 'top',
    fit: 'shrink'
  })
  const gap = Math.max(1.5, Math.min(w, h) * 0.025)
  // la fascia del titolo: un decimo dell'altezza, ma mai troppo sottile o troppo grossa
  const band = Math.min(Math.max(h * 0.1, 6), 30)
  switch (key) {
    case 'titleArtText': {
      const artH = safe.h * 0.48
      const top = safe.y + band + gap
      return [
        title({ ...safe, h: band }),
        art({ ...safe, y: top, h: artH }),
        body({ ...safe, y: top + artH + gap, h: safe.y + safe.h - (top + artH + gap) })
      ]
    }
    case 'titleText':
      return [
        title({ ...safe, h: band }),
        body({ ...safe, y: safe.y + band + gap, h: safe.h - band - gap })
      ]
    case 'artTitle':
      // l'illustrazione riempie il componente fino al bordo di taglio, il titolo in basso
      return [
        title({ ...safe, y: safe.y + safe.h - band, h: band }),
        art({ x: -bleed, y: -bleed, w: w + 2 * bleed, h: h + 2 * bleed })
      ]
    case 'titleArt':
      return [
        title({ ...safe, h: band }),
        art({ ...safe, y: safe.y + band + gap, h: safe.h - band - gap })
      ]
    case 'centerIcon': {
      const s = Math.min(safe.w, safe.h)
      return [art({ x: (w - s) / 2, y: (h - s) / 2, w: s, h: s })]
    }
    case 'centerNumber':
      return [
        {
          type: 'text',
          name: 'number',
          text: '1',
          ...box(safe),
          size: fitSize(safe.h, 0.7),
          weight: 700,
          align: 'center',
          valign: 'middle',
          fit: 'shrink'
        }
      ]
    case 'figure':
      return [{ ...art({ x: 0, y: 0, w, h }), fit: 'contain' }]
  }
}
