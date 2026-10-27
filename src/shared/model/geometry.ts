import type { GroupLayer, Layer, LayerBase, ShapeLayer } from './template'
import { findLayer, type Bounds } from './edit'
import { arrangeGroup } from './arrange'

// Geometria dei livelli: punti di ancoraggio, rotazioni, selezione con il puntatore e
// ridimensionamento con le maniglie. Coordinate in mm, angoli in gradi in senso orario.

export interface Point {
  x: number
  y: number
}

export function anchorPoint(l: LayerBase): Point {
  const [v, h] = l.anchor.includes('-')
    ? (l.anchor.split('-') as [string, string])
    : l.anchor === 'top' || l.anchor === 'bottom'
      ? [l.anchor, 'center']
      : ['middle', l.anchor]
  const x = h === 'left' ? l.x : h === 'right' ? l.x + l.w : l.x + l.w / 2
  const y = v === 'top' ? l.y : v === 'bottom' ? l.y + l.h : l.y + l.h / 2
  return { x, y }
}

export function rotateAround(p: Point, c: Point, deg: number): Point {
  if (!deg) return p
  const r = (deg * Math.PI) / 180
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  const dx = p.x - c.x
  const dy = p.y - c.y
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos }
}

/** Dal sistema del contenitore a quello del livello non ruotato */
export function toLocal(l: LayerBase, p: Point): Point {
  return rotateAround(p, anchorPoint(l), -l.rotation)
}

/** Gruppi che contengono il livello, dal più esterno */
export function ancestorsOf(layers: Layer[], id: string): GroupLayer[] {
  for (const l of layers) {
    if (l.id === id) return []
    if (l.type === 'group') {
      if (findLayer(l.children, id)) return [l, ...ancestorsOf(l.children, id)]
    }
  }
  return []
}

/** Porta un punto della carta nel sistema dei figli dell'ultimo gruppo della catena */
export function toFrame(p: Point, chain: GroupLayer[]): Point {
  return chain.reduce((q, g) => toLocal(g, q), p)
}

/** Tolleranza in mm per i livelli molto sottili, come le linee */
const HIT_PAD = 0.6

/**
 * Il punto cade sul livello. `pad` è la tolleranza per i livelli sottili, in mm: chi disegna a
 * un certo ingrandimento la calcola dai pixel, così una linea si prende anche da lontano.
 * Nei gruppi disposti o ripetuti contano i figli dove sono disegnati.
 */
export function hitTest(l: Layer, p: Point, pad = HIT_PAD): boolean {
  if (!l.visible || l.type === 'value') return false
  const q = toLocal(l, p)
  if (l.type === 'group') return arrangeGroup(l).children.some((c) => hitTest(c, q, pad))
  const px = l.w < 2 * pad ? pad : 0
  const py = l.h < 2 * pad ? pad : 0
  return q.x >= l.x - px && q.x <= l.x + l.w + px && q.y >= l.y - py && q.y <= l.y + l.h + py
}

/** Riquadro sulla carta di un livello, con le rotazioni sue e dei gruppi che lo contengono */
export function worldBounds(l: Layer, chain: GroupLayer[] = []): Bounds {
  const corners = [
    { x: l.x, y: l.y },
    { x: l.x + l.w, y: l.y },
    { x: l.x, y: l.y + l.h },
    { x: l.x + l.w, y: l.y + l.h }
  ].map((p) =>
    [l, ...[...chain].reverse()].reduce((q, c) => rotateAround(q, anchorPoint(c), c.rotation), p)
  )
  const xs = corners.map((p) => p.x)
  const ys = corners.map((p) => p.y)
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export function handlePosition(b: Bounds, h: Handle): Point {
  const x = h.includes('w') ? b.x : h.includes('e') ? b.x + b.w : b.x + b.w / 2
  const y = h.includes('n') ? b.y : h.includes('s') ? b.y + b.h : b.y + b.h / 2
  return { x, y }
}

export function snap(v: number, step: number): number {
  return step > 0 ? Math.round(v / step) * step : v
}

const MIN_SIZE = 0.5

/**
 * Nuovo riquadro trascinando una maniglia. `local` è il puntatore nel sistema del livello
 * all'inizio del gesto. Il lato opposto resta fermo anche se il livello è ruotato.
 */
export function resizeWithHandle(
  start: LayerBase,
  handle: Handle,
  local: Point,
  opts: { keepRatio?: boolean; step?: number; fromCenter?: boolean } = {}
): Bounds {
  const step = opts.step ?? 0
  let left = start.x
  let top = start.y
  let right = start.x + start.w
  let bottom = start.y + start.h
  const cx = start.x + start.w / 2
  const cy = start.y + start.h / 2
  if (opts.fromCenter) {
    // dal centro: il lato opposto si muove in modo simmetrico
    if (handle.includes('w') || handle.includes('e')) {
      const half = Math.max(Math.abs(snap(local.x, step) - cx), MIN_SIZE / 2)
      left = cx - half
      right = cx + half
    }
    if (handle.includes('n') || handle.includes('s')) {
      const half = Math.max(Math.abs(snap(local.y, step) - cy), MIN_SIZE / 2)
      top = cy - half
      bottom = cy + half
    }
  } else {
    if (handle.includes('w')) left = Math.min(snap(local.x, step), right - MIN_SIZE)
    if (handle.includes('e')) right = Math.max(snap(local.x, step), left + MIN_SIZE)
    if (handle.includes('n')) top = Math.min(snap(local.y, step), bottom - MIN_SIZE)
    if (handle.includes('s')) bottom = Math.max(snap(local.y, step), top + MIN_SIZE)
  }

  if (opts.keepRatio && handle.length === 2 && start.w > 0 && start.h > 0) {
    const s = Math.max((right - left) / start.w, (bottom - top) / start.h)
    const w = start.w * s
    const h = start.h * s
    if (opts.fromCenter) {
      left = cx - w / 2
      right = cx + w / 2
      top = cy - h / 2
      bottom = cy + h / 2
    } else {
      if (handle.includes('w')) left = right - w
      else right = left + w
      if (handle.includes('n')) top = bottom - h
      else bottom = top + h
    }
  } else if (opts.keepRatio && start.w > 0 && start.h > 0) {
    // maniglia su un lato: l'altra misura segue, centrata sull'asse che non si trascina
    if (handle === 'e' || handle === 'w') {
      const h = (start.h * (right - left)) / start.w
      top = start.y + (start.h - h) / 2
      bottom = top + h
    } else {
      const w = (start.w * (bottom - top)) / start.h
      left = start.x + (start.w - w) / 2
      right = left + w
    }
  }

  const b = { x: left, y: top, w: right - left, h: bottom - top }
  if (!start.rotation) return b
  // il punto di ancoraggio si sposta con il riquadro: si trasla per compensare la rotazione
  const a = anchorPoint(start)
  const a2 = anchorPoint({ ...start, ...b })
  const moved = rotateAround(a2, a, start.rotation)
  return { ...b, x: b.x + moved.x - a2.x, y: b.y + moved.y - a2.y }
}

/** Angolo in gradi della direzione da c a p, con 0 verso l'alto */
export function angleFrom(c: Point, p: Point): number {
  return (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI + 90
}

/** Riporta un angolo nell'intervallo (-180, 180] */
export function normalizeAngle(deg: number): number {
  const a = ((((deg + 180) % 360) + 360) % 360) - 180
  return a === -180 ? 180 : a
}

/** Vertici di un poligono regolare o di una stella inscritti nel riquadro, dall'alto in senso orario */
export function polygonVertices(l: ShapeLayer): Point[] {
  const n = Math.max(3, Math.round(l.sides))
  const cx = l.x + l.w / 2
  const cy = l.y + l.h / 2
  const count = l.shape === 'star' ? n * 2 : n
  const pts: Point[] = []
  for (let i = 0; i < count; i++) {
    const r = l.shape === 'star' && i % 2 === 1 ? l.innerRatio : 1
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / count
    pts.push({ x: cx + (Math.cos(a) * r * l.w) / 2, y: cy + (Math.sin(a) * r * l.h) / 2 })
  }
  return pts
}

const fmt = (n: number): string => String(Math.round(n * 1000) / 1000)

/**
 * Tracciato SVG di un poligono chiuso con gli angoli arrotondati da archi di raggio r (mm).
 * Se il lato è troppo corto il raggio si riduce, così due archi vicini non si sovrappongono.
 */
export function roundedPolygonPath(pts: Point[], r: number): string {
  const n = pts.length
  if (r <= 0 || n < 3) return 'M' + pts.map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(' L') + ' Z'
  const dist = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y)
  const parts: string[] = []
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n]
    const p = pts[i]
    const b = pts[(i + 1) % n]
    const la = dist(p, a)
    const lb = dist(p, b)
    const ua = { x: (a.x - p.x) / la, y: (a.y - p.y) / la }
    const ub = { x: (b.x - p.x) / lb, y: (b.y - p.y) / lb }
    // angolo interno al vertice e distanza dal vertice a cui l'arco tocca i lati
    const theta = Math.acos(Math.max(-1, Math.min(1, ua.x * ub.x + ua.y * ub.y)))
    const tan = Math.tan(theta / 2)
    let d = tan > 1e-9 ? r / tan : 0
    d = Math.min(d, la / 2, lb / 2)
    const radius = d * tan
    const p1 = { x: p.x + ua.x * d, y: p.y + ua.y * d }
    const p2 = { x: p.x + ub.x * d, y: p.y + ub.y * d }
    // svolta a destra sullo schermo (y verso il basso): arco in senso orario
    const cross = (p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x)
    parts.push(
      `${i ? 'L' : 'M'}${fmt(p1.x)},${fmt(p1.y)}`,
      `A${fmt(radius)},${fmt(radius)} 0 0 ${cross > 0 ? 1 : 0} ${fmt(p2.x)},${fmt(p2.y)}`
    )
  }
  return parts.join(' ') + ' Z'
}

/** Rapporto tra il lato corto e il lato lungo del riquadro di un esagono regolare (√3 / 2) */
export const HEXAGON_RATIO = Math.sqrt(3) / 2

/**
 * Esagono regolare, il più grande che sta nel riquadro, al centro: con i lati piatti in alto se
 * il riquadro è più largo che alto, altrimenti con le punte in alto. Riempie il riquadro quando
 * il lato corto è il lato lungo × √3 / 2 (vedi hexagonFit).
 */
export function hexagonPoints(x: number, y: number, w: number, h: number): Point[] {
  const flat = w >= h
  // lato lungo L (da punta a punta) e lato corto L × √3 / 2 (tra i lati piatti)
  const long = flat ? Math.min(w, h / HEXAGON_RATIO) : Math.min(h, w / HEXAGON_RATIO)
  const short = long * HEXAGON_RATIO
  const [bw, bh] = flat ? [long, short] : [short, long]
  const x0 = x + (w - bw) / 2
  const y0 = y + (h - bh) / 2
  const p = (u: number, v: number): Point => ({ x: x0 + u * bw, y: y0 + v * bh })
  return flat
    ? [p(0.25, 0), p(0.75, 0), p(1, 0.5), p(0.75, 1), p(0.25, 1), p(0, 0.5)]
    : [p(0.5, 0), p(1, 0.25), p(1, 0.75), p(0.5, 1), p(0, 0.75), p(0, 0.25)]
}

/** Misure che l'esagono regolare riempie: cambia il lato corto, il lato lungo resta */
export function hexagonFit(w: number, h: number): { w: number; h: number } {
  const r = (v: number): number => Math.round(v * 10) / 10
  return w >= h ? { w, h: r(w * HEXAGON_RATIO) } : { w: r(h * HEXAGON_RATIO), h }
}

/**
 * Estremi di una linea: il segmento orizzontale a metà altezza del riquadro, ruotato con il
 * livello. Il riquadro serve solo a selezionarla.
 */
export function lineEnds(l: LayerBase): [Point, Point] {
  const c = anchorPoint(l)
  const y = l.y + l.h / 2
  return [
    rotateAround({ x: l.x, y }, c, l.rotation),
    rotateAround({ x: l.x + l.w, y }, c, l.rotation)
  ]
}

/** Posizione, lunghezza e rotazione di una linea da A a B, tenendo altezza e ancoraggio */
export function lineFromEnds(
  l: LayerBase,
  a: Point,
  b: Point
): Pick<LayerBase, 'x' | 'y' | 'w' | 'rotation'> {
  const w = Math.hypot(b.x - a.x, b.y - a.y)
  const rotation = w ? normalizeAngle((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI) : 0
  // frazioni del punto di ancoraggio nel riquadro
  const probe = anchorPoint({ ...l, x: 0, y: 0, w: 1, h: 1 })
  const h = l.h
  // A è l'estremo sinistro del segmento non ruotato: A = P + R·(A₀ − P)
  const r = (rotation * Math.PI) / 180
  const dx = -probe.x * w
  const dy = h / 2 - probe.y * h
  const px = a.x - (dx * Math.cos(r) - dy * Math.sin(r))
  const py = a.y - (dx * Math.sin(r) + dy * Math.cos(r))
  const round = (v: number): number => Math.round(v * 1000) / 1000
  return {
    x: round(px - probe.x * w),
    y: round(py - probe.y * h),
    w: round(w),
    rotation: round(rotation)
  }
}

/** Asse a cui si limita uno spostamento con Maiuscolo: il più vicino tra i due assi e 45° */
export function constrainAxis(dx: number, dy: number): 'x' | 'y' | 'diagonal' | null {
  if (!dx && !dy) return null
  const a = (Math.atan2(Math.abs(dy), Math.abs(dx)) * 180) / Math.PI
  return a < 22.5 ? 'x' : a > 67.5 ? 'y' : 'diagonal'
}

/**
 * Riquadro in cui si disegna la forma della carta prima di girarla, e la trasformazione SVG che
 * la porta nel riquadro x, y, w, h: rotazione a passi di 90° intorno al centro, poi gli
 * specchi. Con 90° e 270° il riquadro ha i lati scambiati, così la forma ruotata lo riempie.
 * Senza rotazione né specchi la trasformazione è vuota.
 */
export function shapeFrame(
  t: { shapeRotation?: number; shapeFlipH?: boolean; shapeFlipV?: boolean },
  x: number,
  y: number,
  w: number,
  h: number
): { x: number; y: number; w: number; h: number; transform?: string } {
  const rot = t.shapeRotation ?? 0
  if (!rot && !t.shapeFlipH && !t.shapeFlipV) return { x, y, w, h }
  const turned = rot % 180 !== 0
  const bw = turned ? h : w
  const bh = turned ? w : h
  const parts = [`translate(${x + w / 2} ${y + h / 2})`]
  if (t.shapeFlipH || t.shapeFlipV)
    parts.push(`scale(${t.shapeFlipH ? -1 : 1} ${t.shapeFlipV ? -1 : 1})`)
  if (rot) parts.push(`rotate(${rot})`)
  parts.push(`translate(${-bw / 2} ${-bh / 2})`)
  return { x: 0, y: 0, w: bw, h: bh, transform: parts.join(' ') }
}
