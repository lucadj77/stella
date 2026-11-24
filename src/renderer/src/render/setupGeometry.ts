import type { LoadedSet } from '../../../shared/project'
import type { GridLayer, Side, Template } from '../../../shared/model/template'
import {
  anatomyCardSource,
  findCard,
  isMessage,
  parseCardRef
} from '../../../shared/model/document'
import { gridGeometry } from '../../../shared/model/grid'
import { walkLayers } from '../../../shared/model/normalize'
import {
  SETUP_HAND_SPREAD,
  SETUP_ROW_GAP,
  arrowCurve,
  type Setup,
  type SetupItem,
  type SetupLabelAt
} from '../../../shared/model/setup'

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
  templates: Template[],
  scale = 1
): { w: number; h: number; side: Side } | null {
  const ref = parseCardRef(anatomyCardSource(card))
  if (isMessage(ref)) return null
  const found = findCard(ref, sets)
  if (isMessage(found)) return null
  const t = templates.find((x) => x.name === found.set.template)
  if (!t) return null
  const w = (ref.width ?? t.width) * (scale > 0 ? scale : 1)
  return { w, h: (t.height * w) / t.width, side: ref.side }
}

/** Il template della carta richiamata, o null */
function cardTemplate(card: string, sets: LoadedSet[], templates: Template[]): Template | null {
  const ref = parseCardRef(anatomyCardSource(card))
  if (isMessage(ref)) return null
  const found = findCard(ref, sets)
  if (isMessage(found)) return null
  return templates.find((x) => x.name === found.set.template) ?? null
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

/** Il riquadro dritto di un rettangolo ruotato attorno al suo centro */
export function turnedBox(b: Box, deg: number | undefined): Box {
  if (!deg) return b
  const t = turnedSize(b.w, b.h, deg)
  return { x: b.x + (b.w - t.w) / 2, y: b.y + (b.h - t.h) / 2, w: t.w, h: t.h }
}

/** Misura della carta di un elemento, anche se la carta non si trova */
export const itemCardSize = (
  card: string,
  sets: LoadedSet[],
  templates: Template[],
  scale = 1
): Size => cardSize(card, sets, templates, scale) ?? { w: MISSING.w * scale, h: MISSING.h * scale }

interface Size {
  w: number
  h: number
}

/** Una carta di una fila o di una mano: centro, misure della carta dritta e rotazione */
export interface PlacedCard {
  card: string
  cx: number
  cy: number
  w: number
  h: number
  rotate: number
}

/**
 * Le carte di una fila (in fila allineate in alto, in colonna a sinistra) o di una mano (a
 * ventaglio attorno a un perno sotto le carte, allineate sul centro in basso), e il riquadro che
 * le contiene, con l'angolo in alto a sinistra in x, y
 */
export function spreadCards(
  it: Extract<SetupItem, { kind: 'row' | 'hand' }>,
  sets: LoadedSet[],
  templates: Template[]
): { cards: PlacedCard[]; box: Box } {
  const sizes = it.cards.map((c) => itemCardSize(c, sets, templates, it.scale ?? 1))
  if (it.kind === 'row') {
    const gap = it.gap ?? SETUP_ROW_GAP
    const down = it.direction === 'down'
    let at = 0
    const cards = it.cards.map((card, i) => {
      const s = sizes[i]
      const p = down
        ? { cx: it.x + s.w / 2, cy: it.y + at + s.h / 2 }
        : { cx: it.x + at + s.w / 2, cy: it.y + s.h / 2 }
      at += (down ? s.h : s.w) + gap
      return { card, ...p, w: s.w, h: s.h, rotate: 0 }
    })
    const total = Math.max(0, at - gap)
    const across = Math.max(0, ...sizes.map((s) => (down ? s.w : s.h)))
    return {
      cards,
      box: { x: it.x, y: it.y, w: down ? across : total, h: down ? total : across }
    }
  }
  // la mano: le carte girano attorno a un perno lontano due altezze sotto il loro centro
  const n = it.cards.length
  const spread = it.spread ?? SETUP_HAND_SPREAD
  const hmax = Math.max(1, ...sizes.map((s) => s.h))
  const R = hmax * 2
  const raw = it.cards.map((card, i) => {
    const deg = n > 1 ? -spread / 2 + (i * spread) / (n - 1) : 0
    const a = (deg * Math.PI) / 180
    const s = sizes[i]
    // il fondo delle carte sta sullo stesso arco: carte più basse scendono meno
    const cx = Math.sin(a) * R
    const cy = R - Math.cos(a) * R + (hmax - s.h) / 2
    return {
      card,
      cx,
      cy,
      w: s.w,
      h: s.h,
      rotate: (((Math.round(deg * 10) / 10) % 360) + 360) % 360
    }
  })
  const corners = raw.flatMap((c) => {
    const a = (c.rotate * Math.PI) / 180
    const cos = Math.cos(a)
    const sin = Math.sin(a)
    return [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1]
    ].map(([sx, sy]) => {
      const px = (sx * c.w) / 2
      const py = (sy * c.h) / 2
      return { x: c.cx + px * cos - py * sin, y: c.cy + px * sin + py * cos }
    })
  })
  const x1 = Math.min(...corners.map((p) => p.x))
  const y1 = Math.min(...corners.map((p) => p.y))
  const x2 = Math.max(...corners.map((p) => p.x))
  const y2 = Math.max(...corners.map((p) => p.y))
  const cards = raw.map((c) => ({ ...c, cx: c.cx - x1 + it.x, cy: c.cy - y1 + it.y }))
  return { cards, box: { x: it.x, y: it.y, w: x2 - x1, h: y2 - y1 } }
}

/**
 * Riquadro dell'elemento sul tavolo, senza le didascalie. Una carta ruotata occupa il riquadro
 * dritto che la contiene: x e y sono il suo angolo in alto a sinistra. Zone, forme e testi
 * ruotano invece attorno al loro centro: x e y restano quelli del rettangolo dritto.
 */
export function itemBox(it: SetupItem, sets: LoadedSet[], templates: Template[]): Box {
  switch (it.kind) {
    case 'card':
    case 'deck': {
      const s = itemCardSize(it.card, sets, templates, it.scale ?? 1)
      const turned = turnedSize(s.w, s.h, it.rotate)
      const extra = it.kind === 'deck' ? (Math.min(it.count, DECK_LAYERS + 1) - 1) * DECK_STEP : 0
      return { x: it.x, y: it.y, w: turned.w + extra, h: turned.h + extra }
    }
    case 'row':
    case 'hand':
      return spreadCards(it, sets, templates).box
    case 'zone':
    case 'shape':
      return turnedBox({ x: it.x, y: it.y, w: it.w, h: it.h }, it.rotate)
    case 'text':
      return turnedBox({ x: it.x, y: it.y, w: it.w, h: 8 }, it.rotate)
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

/** Il primo elemento con questo nome, senza badare alle maiuscole */
export function namedItem(items: SetupItem[], name: string): number {
  const n = name.toLowerCase()
  return items.findIndex((it) => it.kind !== 'arrow' && it.name?.toLowerCase() === n)
}

/** Spazio tra la punta di una freccia agganciata e il bordo dell'elemento, in mm */
const ARROW_GAP = 1.5
/** Lo stacco dal testo, che non ha un bordo netto: più piccolo */
const TEXT_ARROW_GAP = 0.8

/** Il punto del bordo del riquadro sulla retta dal centro verso `to`, un poco fuori */
function edgePoint(
  b: Box,
  to: { x: number; y: number },
  gap = ARROW_GAP
): { x: number; y: number } {
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  const dx = to.x - cx
  const dy = to.y - cy
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return { x: cx, y: cy }
  const t = Math.min(
    Math.abs(dx) > 1e-9 ? b.w / 2 / Math.abs(dx) : Infinity,
    Math.abs(dy) > 1e-9 ? b.h / 2 / Math.abs(dy) : Infinity
  )
  // dentro il riquadro: la freccia arriva al centro
  if (t >= 1) return { x: to.x, y: to.y }
  return { x: cx + dx * t + (dx / len) * gap, y: cy + dy * t + (dy / len) * gap }
}

/** La griglia di un template su cui si appoggia un segnalino: la prima del fronte (o del retro) */
function boardGrid(t: Template, side: Side): GridLayer | null {
  const layers = side === 'back' ? t.back : t.front
  return (walkLayers(layers).find((l) => l.type === 'grid') as GridLayer | undefined) ?? null
}

/** Le caselle della plancia disegnata nel riquadro `box`, sul tavolo; null senza griglia */
export function boardCells(
  board: SetupItem,
  box: Box,
  sets: LoadedSet[],
  templates: Template[]
): { cells: { row: number; col: number; x: number; y: number }[]; size: number } | null {
  if (board.kind !== 'card' && board.kind !== 'deck') return null
  const t = cardTemplate(board.card, sets, templates)
  const size = cardSize(board.card, sets, templates, board.scale ?? 1)
  if (!t || !size) return null
  const grid = boardGrid(t, size.side)
  if (!grid || grid.columns < 1 || grid.rows < 1) return null
  const geo = gridGeometry(grid)
  const k = size.w / t.width
  const a = (board.rotate * Math.PI) / 180
  // in un mazzo la carta in cima sta nell'angolo in alto a sinistra del riquadro
  const turned = turnedSize(size.w, size.h, board.rotate)
  const cx = box.x + turned.w / 2
  const cy = box.y + turned.h / 2
  // dalla carta dritta (mm del template) al tavolo: misura, rotazione attorno al centro, posto
  const cells = geo.centers.map((c, n) => {
    const px = (grid.x + c.x) * k - size.w / 2
    const py = (grid.y + c.y) * k - size.h / 2
    return {
      row: Math.floor(n / grid.columns) + 1,
      col: (n % grid.columns) + 1,
      x: cx + px * Math.cos(a) - py * Math.sin(a),
      y: cy + px * Math.sin(a) + py * Math.cos(a)
    }
  })
  return { cells, size: Math.min(geo.cell.w, geo.cell.h) * k }
}

/**
 * Il centro della casella `row`, `col` (da 1) della griglia della plancia disegnata nel riquadro
 * `box`, o null se la plancia o la casella non ci sono
 */
export function cellCenter(
  board: SetupItem,
  box: Box,
  row: number,
  col: number,
  sets: LoadedSet[],
  templates: Template[]
): { x: number; y: number } | null {
  const b = boardCells(board, box, sets, templates)
  return b?.cells.find((c) => c.row === row && c.col === col) ?? null
}

/** La casella della plancia sotto un punto del tavolo, o null se il punto non ne ha una vicina */
export function cellAt(
  board: SetupItem,
  box: Box,
  x: number,
  y: number,
  sets: LoadedSet[],
  templates: Template[]
): { row: number; col: number; x: number; y: number; size: number } | null {
  const b = boardCells(board, box, sets, templates)
  if (!b) return null
  let best: (typeof b.cells)[number] | null = null
  let dist = Infinity
  for (const c of b.cells) {
    const d = Math.hypot(c.x - x, c.y - y)
    if (d < dist) {
      dist = d
      best = c
    }
  }
  return best && dist <= b.size * 0.75 ? { ...best, size: b.size } : null
}

/**
 * Gli elementi con le posizioni che dipendono da altri: i segnalini sulle caselle di una plancia
 * e le frecce agganciate. Restituisce gli elementi e i loro riquadri, nello stesso ordine.
 */
export function resolveItems(
  items: SetupItem[],
  sets: LoadedSet[],
  templates: Template[],
  font?: number
): { items: SetupItem[]; boxes: Box[] } {
  const out = items.slice()
  const boxes = items.map((it) => itemBox(it, sets, templates))
  // per le frecce un testo vale per le righe scritte, non per il riquadro largo che lo contiene
  const ink = (k: number): Box => {
    const it = out[k]
    if (it.kind !== 'text' || font === undefined) return boxes[k]
    const e = textExtent(it.text, it.w, font)
    const w = Math.min(it.w, Math.max(e.w, font))
    const h = Math.max(1, e.lines) * font * SETUP_LINE
    const x =
      it.align === 'right' ? it.x + it.w - w : it.align === 'left' ? it.x : it.x + (it.w - w) / 2
    // sopra la prima riga e sotto l'ultima c'è metà interlinea vuota: non fa parte delle lettere
    const lead = ((SETUP_LINE - 1) / 2) * font
    if (!it.rotate) return { x, y: it.y + lead, w, h: h - 2 * lead }
    // ruotato: attorno al centro del riquadro intero, come lo disegna lo schema
    const cx = it.x + it.w / 2
    const cy = it.y + h / 2
    const r = (it.rotate * Math.PI) / 180
    const dx = x + w / 2 - cx
    const nx = cx + dx * Math.cos(r)
    const ny = cy + dx * Math.sin(r)
    return turnedBox({ x: nx - w / 2, y: ny - h / 2, w, h }, it.rotate)
  }
  // i segnalini: al centro della casella, ruotati come vogliono
  // i segnalini, e ogni altro elemento sopra una casella: il centro al centro della casella
  out.forEach((it, i) => {
    if (it.kind === 'arrow' || !it.on) return
    const b = namedItem(out, it.on.item)
    if (b < 0 || b === i) return
    const board = out[b]
    if (board.kind !== 'arrow' && board.on) return
    const c = cellCenter(board, boxes[b], it.on.row, it.on.col, sets, templates)
    if (!c) return
    // un testo si centra con le sue righe, se si sa il corpo
    const own =
      it.kind === 'text' && font !== undefined
        ? turnedBox({ x: it.x, y: it.y, w: it.w, h: textHeight(it.text, it.w, font) }, it.rotate)
        : boxes[i]
    const tenth = (n: number): number => Math.round(n * 100) / 100
    const dx = c.x - (own.x + own.w / 2)
    const dy = c.y - (own.y + own.h / 2)
    out[i] = { ...it, x: tenth(it.x + dx), y: tenth(it.y + dy) }
    boxes[i] = { ...boxes[i], x: boxes[i].x + dx, y: boxes[i].y + dy }
  })
  // le frecce: dal bordo di un elemento al bordo dell'altro
  out.forEach((it, i) => {
    if (it.kind !== 'arrow' || (!it.fromItem && !it.toItem)) return
    const a = it.fromItem ? namedItem(out, it.fromItem) : -1
    const b = it.toItem ? namedItem(out, it.toItem) : -1
    const center = (k: number): { x: number; y: number } => {
      const r = ink(k)
      return { x: r.x + r.w / 2, y: r.y + r.h / 2 }
    }
    const p0 = a >= 0 ? center(a) : { x: it.x, y: it.y }
    const p2 = b >= 0 ? center(b) : { x: it.x2, y: it.y2 }
    // con la curva la freccia esce verso il suo centro, non verso l'altro estremo
    const mid = arrowCurve({ x: p0.x, y: p0.y, x2: p2.x, y2: p2.y, bend: it.bend, shift: it.shift })
    // dal testo, che non ha un bordo, la freccia parte più vicina
    const gap = (k: number): number => (out[k].kind === 'text' ? TEXT_ARROW_GAP : ARROW_GAP)
    const s = a >= 0 ? edgePoint(ink(a), it.bend ? mid.control : p2, gap(a)) : p0
    const e = b >= 0 ? edgePoint(ink(b), it.bend ? mid.control : p0, gap(b)) : p2
    out[i] = { ...it, x: s.x, y: s.y, x2: e.x, y2: e.y }
    boxes[i] = itemBox(out[i], sets, templates)
  })
  return { items: out, boxes }
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
 * Famiglia di caratteri con cui si misurano i testi dello schema: quella del documento, che
 * setupView riceve. Il documento e le sue finestre usano lo stesso carattere, quindi basta una.
 */
let measureFamily: string | undefined
let measureCtx: CanvasRenderingContext2D | null | undefined

/** Larghezza di un testo in corpi, misurata con il carattere vero; null fuori dal browser */
function measured(s: string): number | null {
  if (measureCtx === undefined)
    measureCtx =
      typeof document === 'undefined'
        ? null
        : (() => {
            try {
              return document.createElement('canvas').getContext('2d')
            } catch {
              return null
            }
          })()
  if (!measureCtx) return null
  const family =
    measureFamily ??
    (typeof getComputedStyle === 'function' && document.body
      ? getComputedStyle(document.body).fontFamily
      : 'sans-serif')
  measureCtx.font = `100px ${family}`
  // il grassetto e il markup allargano un poco: meglio un margine
  return (measureCtx.measureText(s).width / 100) * 1.04
}

/**
 * Righe e larghezza della riga più lunga di un testo con il markup, andando a capo tra le parole
 * entro `width` mm: misurate con il carattere del documento nel browser, stimate altrove
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
  const space = (measured(' ') ?? CHAR) * font
  const char = space
  const wordW = (word: string): number => (measured(word) ?? word.length * CHAR) * font
  let lines = 0
  let widest = 0
  for (const para of plain.split(/\n|<br\s*\/?>/i)) {
    let used = 0
    lines++
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const w = wordW(word)
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

/** Larghezza del riquadro di un'etichetta messa a sinistra o a destra, in mm */
const SIDE_LABEL_W = 40

/**
 * Dove sta l'etichetta di un componente, di un mazzo, di una fila o di una mano: sotto (di
 * base), sopra, a sinistra o a destra del riquadro
 */
export function cardLabelPlace(
  box: Box,
  at: SetupLabelAt | undefined,
  text: string,
  font: number
): { x: number; y: number; w: number; align: 'left' | 'center' | 'right' } {
  if (at === 'left' || at === 'right') {
    // il riquadro cresce con il corpo e con la parola più lunga: non entra mai nell'oggetto
    const longest = Math.max(
      0,
      ...text.split(/\s+/).map((word) => textExtent(word, Infinity, font).w * 1.15)
    )
    const w = Math.max(SIDE_LABEL_W, font * 12, longest)
    const lines = textExtent(text, w, font).lines
    const y = box.y + box.h / 2 - (lines * font * SETUP_LINE) / 2
    return at === 'left'
      ? { x: box.x - 1.5 - w, y, w, align: 'right' }
      : { x: box.x + box.w + 1.5, y, w, align: 'left' }
  }
  const w = box.w + 30
  if (at === 'top') {
    const lines = textExtent(text, w, font).lines
    return { x: box.x - 15, y: box.y - 1 - lines * font * SETUP_LINE, w, align: 'center' }
  }
  return { x: box.x - 15, y: box.y + box.h + 1, w, align: 'center' }
}

/** Il riquadro del testo scritto in un posto, secondo il suo allineamento */
function placedText(
  p: { x: number; y: number; w: number; align: 'left' | 'center' | 'right' },
  text: string,
  font: number
): Box {
  const e = textExtent(text, p.w, font)
  const x = p.align === 'right' ? p.x + p.w - e.w : p.align === 'left' ? p.x : p.x + (p.w - e.w) / 2
  return { x, y: p.y, w: e.w, h: e.lines * font * SETUP_LINE }
}

/**
 * Lo spazio occupato dalle didascalie di carte, mazzi, file, mani, forme e frecce e dai testi,
 * che possono uscire dal riquadro dell'elemento: l'area dello schema deve contenerli
 */
export function textBoxes(setup: Setup, boxes: Box[], font: number): Box[] {
  return setup.items.flatMap((it, i): Box[] => {
    const box = boxes[i]
    if (
      (it.kind === 'card' || it.kind === 'deck' || it.kind === 'row' || it.kind === 'hand') &&
      it.label
    )
      return [placedText(cardLabelPlace(box, it.labelAt, it.label, font), it.label, font)]
    if (it.kind === 'arrow' && it.label) {
      const e = textExtent(it.label, 50, font)
      const { mid } = arrowCurve(it)
      const cx = mid.x
      const cy = mid.y - (font * SETUP_LINE) / 2
      return [{ x: cx - e.w / 2, y: cy, w: e.w, h: e.lines * font * SETUP_LINE }]
    }
    if (it.kind === 'text' && !it.rotate) {
      const e = textExtent(it.text, it.w, font)
      const w = Math.max(it.w, e.w)
      const x =
        it.align === 'right' ? it.x + it.w - w : it.align === 'left' ? it.x : it.x + (it.w - w) / 2
      return [{ x, y: it.y, w, h: e.lines * font * SETUP_LINE }]
    }
    return []
  })
}

/** Altezza di un testo dello schema: le sue righe, almeno una */
export function textHeight(text: string, width: number, font: number): number {
  return Math.max(1, textExtent(text, width, font).lines) * font * SETUP_LINE
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
  /**
   * Gli elementi con le posizioni che dipendono da altri già calcolate (segnalini sulle caselle,
   * frecce agganciate); assente = quelli dello schema
   */
  items?: SetupItem[]
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
  font: number,
  /** Famiglia di caratteri del documento (CSS); senza, quella della pagina */
  family?: string
): SetupView {
  measureFamily = family
  // le frecce agganciate ai testi dipendono dal corpo, che dipende dall'area: si risolve col corpo
  // di base, poi di nuovo con quello trovato
  let resolved = resolveItems(setup.items, sets, templates, font)
  let s = { ...setup, items: resolved.items }
  let boxes = resolved.boxes
  // prima si misura senza testi, per sapere quanto si riduce; poi con i testi, che possono
  // allargare l'area e quindi ridurla ancora: due giri bastano
  const sizedWith = (f: number): Box[] =>
    s.items.map((it, i) =>
      it.kind === 'text'
        ? turnedBox({ x: it.x, y: it.y, w: it.w, h: textHeight(it.text, it.w, f) }, it.rotate)
        : boxes[i]
    )
  let f = font / Math.min(1, maxWidth / Math.max(1, setupArea(s, boxes).w))
  const byFont = (it: SetupItem): boolean =>
    it.kind === 'arrow' ? !!(it.fromItem || it.toItem) : it.kind === 'text' && !!it.on
  if (f !== font && setup.items.some(byFont)) {
    resolved = resolveItems(setup.items, sets, templates, f)
    s = { ...setup, items: resolved.items }
    boxes = resolved.boxes
  }
  let sized = sizedWith(f)
  let area = setupArea(s, [...sized, ...textBoxes(s, sized, f)])
  f = font / Math.min(1, maxWidth / Math.max(1, area.w))
  sized = sizedWith(f)
  area = setupArea(s, [...sized, ...textBoxes(s, sized, f)])
  // un testo è alto quanto le sue righe, con il corpo con cui si disegna
  return { area, boxes: sized, font: f, items: s.items }
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
