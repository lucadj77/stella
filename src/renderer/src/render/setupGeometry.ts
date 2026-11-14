import type { LoadedSet } from '../../../shared/project'
import type { Side, Template } from '../../../shared/model/template'
import {
  anatomyCardSource,
  findCard,
  isMessage,
  parseCardRef
} from '../../../shared/model/document'
import { arrowCurve, type Setup, type SetupItem } from '../../../shared/model/setup'

// Misure degli elementi dello schema del tavolo (model/setup.ts), in mm: servono al disegno,
// all'area quando non è scritta e all'editor per selezionare e trascinare.

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** Misure della carta richiamata (con width=…), o null se non si trova */
export function cardSize(
  card: string,
  sets: LoadedSet[],
  templates: Template[]
): { w: number; h: number; side: Side } | null {
  const ref = parseCardRef(anatomyCardSource(card))
  if (isMessage(ref)) return null
  const found = findCard(ref, sets)
  if (isMessage(found)) return null
  const t = templates.find((x) => x.name === found.set.template)
  if (!t) return null
  const w = ref.width ?? t.width
  return { w, h: (t.height * w) / t.width, side: ref.side }
}

/** Carte del mazzo disegnate una sull'altra, e il loro scostamento in mm */
export const DECK_LAYERS = 4
export const DECK_STEP = 0.8
/** Misura di una carta che non si trova, per poterla comunque spostare */
const MISSING = { w: 63, h: 88 }

/** Riquadro dritto che contiene un rettangolo w × h ruotato di `deg` gradi attorno al centro */
export function turnedSize(w: number, h: number, deg: number): { w: number; h: number } {
  const a = (deg * Math.PI) / 180
  const c = Math.abs(Math.cos(a))
  const s = Math.abs(Math.sin(a))
  // senza gli errori di arrotondamento: a 90° la carta è esattamente girata
  const round = (n: number): number => Math.round(n * 1e6) / 1e6
  return { w: round(w * c + h * s), h: round(w * s + h * c) }
}

/** Misura della carta di un elemento, anche se la carta non si trova */
export const itemCardSize = (card: string, sets: LoadedSet[], templates: Template[]): Size =>
  cardSize(card, sets, templates) ?? MISSING

interface Size {
  w: number
  h: number
}

/**
 * Riquadro dell'elemento sul tavolo, senza le didascalie. Una carta ruotata occupa il riquadro
 * dritto che la contiene: x e y sono il suo angolo in alto a sinistra.
 */
export function itemBox(it: SetupItem, sets: LoadedSet[], templates: Template[]): Box {
  switch (it.kind) {
    case 'card':
    case 'deck': {
      const s = itemCardSize(it.card, sets, templates)
      const turned = turnedSize(s.w, s.h, it.rotate)
      const extra = it.kind === 'deck' ? (Math.min(it.count, DECK_LAYERS + 1) - 1) * DECK_STEP : 0
      return { x: it.x, y: it.y, w: turned.w + extra, h: turned.h + extra }
    }
    case 'zone':
      return { x: it.x, y: it.y, w: it.w, h: it.h }
    case 'text':
      return { x: it.x, y: it.y, w: it.w, h: 8 }
    case 'image':
      return { x: it.x, y: it.y, w: it.w, h: it.w }
    case 'arrow': {
      // con la curva conta anche il suo centro
      const { mid } = arrowCurve(it)
      const xs = [it.x, it.x2, ...(it.bend ? [mid.x] : [])]
      const ys = [it.y, it.y2, ...(it.bend ? [mid.y] : [])]
      const x = Math.min(...xs)
      const y = Math.min(...ys)
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
    }
  }
}

/** Margine di base intorno agli elementi, in mm (`margin`) */
export const SETUP_MARGIN = 3

/** Area disegnata: quella scritta, o quella che contiene gli elementi con un poco di margine */
export function setupArea(setup: Setup, boxes: Box[]): Box {
  if (setup.size) return { x: 0, y: 0, w: setup.size.w, h: setup.size.h }
  if (!boxes.length) return { x: 0, y: 0, w: 100, h: 50 }
  const pad = setup.margin ?? SETUP_MARGIN
  const x = Math.min(...boxes.map((b) => b.x)) - pad
  const y = Math.min(...boxes.map((b) => b.y)) - pad
  const w = Math.max(...boxes.map((b) => b.x + b.w)) + pad - x
  const h = Math.max(...boxes.map((b) => b.y + b.h)) + pad - y
  return { x, y, w, h }
}

/** Larghezza media di un carattere, in corpi (un po' abbondante: meglio un margine in più) */
const CHAR = 0.56

/**
 * Righe e larghezza della riga più lunga di un testo con il markup, andando a capo tra le parole
 * entro `width` mm: una stima, senza misurare il carattere vero
 */
export function textExtent(
  text: string,
  width: number,
  font: number
): { lines: number; w: number } {
  const plain = text
    .replace(/\[([^\]]*)\]\{[^}]*\}/g, '$1')
    .replace(/\{[^}]*\}/g, 'MM')
    .replace(/[*_~]/g, '')
  const char = font * CHAR
  let lines = 0
  let widest = 0
  for (const para of plain.split(/\n|<br\s*\/?>/i)) {
    let used = 0
    lines++
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const w = word.length * char
      if (used && used + char + w > width) {
        widest = Math.max(widest, used)
        lines++
        used = w
      } else used += (used ? char : 0) + w
    }
    widest = Math.max(widest, used)
  }
  return { lines, w: widest }
}

/**
 * Lo spazio occupato dalle didascalie di carte, mazzi e frecce e dai testi, che possono uscire dal
 * riquadro dell'elemento: l'area dello schema deve contenerli
 */
export function textBoxes(setup: Setup, boxes: Box[], font: number): Box[] {
  return setup.items.flatMap((it, i): Box[] => {
    const box = boxes[i]
    if ((it.kind === 'card' || it.kind === 'deck') && it.label) {
      // come in SetupDiagram: centrata sotto la carta, larga la carta più 15 mm per parte
      const e = textExtent(it.label, box.w + 30, font)
      const cx = box.x + box.w / 2
      return [{ x: cx - e.w / 2, y: box.y + box.h + 1, w: e.w, h: e.lines * font * SETUP_LINE }]
    }
    if (it.kind === 'arrow' && it.label) {
      const e = textExtent(it.label, 50, font)
      const { mid } = arrowCurve(it)
      const cx = mid.x
      const cy = mid.y - (font * SETUP_LINE) / 2
      return [{ x: cx - e.w / 2, y: cy, w: e.w, h: e.lines * font * SETUP_LINE }]
    }
    if (it.kind === 'text') {
      const e = textExtent(it.text, it.w, font)
      const w = Math.max(it.w, e.w)
      const x =
        it.align === 'right' ? it.x + it.w - w : it.align === 'left' ? it.x : it.x + (it.w - w) / 2
      return [{ x, y: it.y, w, h: e.lines * font * SETUP_LINE }]
    }
    return []
  })
}

/** Interlinea delle didascalie */
export const SETUP_LINE = 1.25

export interface SetupView {
  /** Area disegnata, in mm */
  area: Box
  /** Riquadro di ogni elemento, nello stesso ordine */
  boxes: Box[]
  /** Corpo delle didascalie in mm del disegno */
  font: number
}

/**
 * Area, riquadri e corpo delle didascalie. Nel documento lo schema si riduce per stare nella
 * pagina: le didascalie crescono altrettanto, così si leggono come il testo.
 */
export function setupView(
  setup: Setup,
  sets: LoadedSet[],
  templates: Template[],
  maxWidth: number,
  font: number
): SetupView {
  const boxes = setup.items.map((it) => itemBox(it, sets, templates))
  // prima si misura senza testi, per sapere quanto si riduce; poi con i testi, che possono
  // allargare l'area e quindi ridurla ancora: due giri bastano
  let f = font / Math.min(1, maxWidth / Math.max(1, setupArea(setup, boxes).w))
  let area = setupArea(setup, [...boxes, ...textBoxes(setup, boxes, f)])
  f = font / Math.min(1, maxWidth / Math.max(1, area.w))
  area = setupArea(setup, [...boxes, ...textBoxes(setup, boxes, f)])
  return { area, boxes, font: f }
}

/** Lo schema con i testi trasformati, per esempio con le variabili del progetto risolte */
export function setupWithText(setup: Setup, f: (s: string) => string): Setup {
  return {
    ...setup,
    items: setup.items.map((it) =>
      it.kind === 'text'
        ? { ...it, text: f(it.text) }
        : 'label' in it
          ? { ...it, label: f(it.label) }
          : it
    )
  }
}
