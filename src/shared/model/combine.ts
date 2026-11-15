import {
  differenceD,
  EndType,
  FillRule,
  inflatePathsD,
  intersectD,
  JoinType,
  unionD,
  xorD,
  type PathsD
} from 'clipper2-ts'
import { layerSegments, roundedCorners, segmentsToPath } from './pathEdit'
import {
  anchorPoint,
  polygonVertices,
  rotateAround,
  roundedPolygonPath,
  type Point
} from './geometry'
import { arrangeGroup } from './arrange'
import {
  findLayer,
  fitGroup,
  groupLayers,
  patchLayer,
  uniqueName,
  updateLayers,
  type Bounds
} from './edit'
import { normalizeLayer } from './normalize'
import type { GroupCombine, GroupLayer, Layer, ShapeLayer, Side, Template } from './template'

// Forme combinate: un gruppo con `combine` disegna le sue forme come un solo tracciato, la loro
// unione, intersezione, differenza o esclusione. Le curve diventano segmenti fitti (FLATNESS),
// poi Clipper2 fa l'operazione. Coordinate in mm sulla carta, come i figli dei gruppi.

/** Distanza massima tra una curva e i segmenti che la sostituiscono, in mm */
const FLATNESS = 0.01
/** Cifre decimali con cui Clipper2 lavora: il micrometro */
const PRECISION = 3

export const COMBINE_OPS = ['union', 'intersect', 'subtract', 'exclude'] as const

/** Il livello entra nella combinazione: le forme chiuse e i gruppi combinati, visibili */
export function isCombinable(l: Layer): boolean {
  if (!l.visible) return false
  if (l.type === 'shape') return l.shape !== 'line'
  return l.type === 'group' && l.combine !== 'none'
}

/** Segmenti di un arco lungo `len` mm con curvatura di raggio r, entro FLATNESS */
function steps(len: number, r = Infinity): number {
  const byRadius = Number.isFinite(r) && r > 0 ? len / Math.sqrt(8 * FLATNESS * r) : 0
  const byLength = len / 0.5
  return Math.max(2, Math.min(1000, Math.ceil(Math.max(byRadius, byLength))))
}

/**
 * I contorni di un tracciato SVG, come liste di punti. `sx` e `sy` scalano le coordinate (un
 * tracciato 0-1 nel riquadro), `ox` e `oy` le spostano. Ogni sottotracciato è chiuso.
 */
export function flattenPath(d: string, sx = 1, sy = 1, ox = 0, oy = 0): Point[][] {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []
  const out: Point[][] = []
  let cur: Point[] = []
  let i = 0
  let cmd = ''
  let x = 0
  let y = 0
  let startX = 0
  let startY = 0
  // ultimo punto di controllo, per S e T
  let cx = 0
  let cy = 0
  let prev = ''
  const k = Math.max(Math.abs(sx), Math.abs(sy))
  const put = (px: number, py: number): void => {
    cur.push({ x: ox + px * sx, y: oy + py * sy })
  }
  const close = (): void => {
    if (cur.length > 2) out.push(cur)
    cur = []
  }
  const num = (): number => Number(tokens[i++])
  const isNum = (): boolean => i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])
  const cubic = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void => {
    const len =
      (Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2)) * k
    const n = steps(len, len / 4)
    for (let s = 1; s <= n; s++) {
      const t = s / n
      const u = 1 - t
      put(
        u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
        u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3
      )
    }
    cx = x2
    cy = y2
    x = x3
    y = y3
  }
  const quad = (x1: number, y1: number, x2: number, y2: number): void => {
    const len = (Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1)) * k
    const n = steps(len, len / 4)
    for (let s = 1; s <= n; s++) {
      const t = s / n
      const u = 1 - t
      put(u * u * x + 2 * u * t * x1 + t * t * x2, u * u * y + 2 * u * t * y1 + t * t * y2)
    }
    cx = x1
    cy = y1
    x = x2
    y = y2
  }
  const arc = (
    rx: number,
    ry: number,
    rot: number,
    large: boolean,
    sweep: boolean,
    x2: number,
    y2: number
  ): void => {
    rx = Math.abs(rx)
    ry = Math.abs(ry)
    if (!rx || !ry || (x === x2 && y === y2)) {
      put(x2, y2)
      x = x2
      y = y2
      return
    }
    // dal punto finale al centro (SVG 1.1, appendice F.6)
    const phi = (rot * Math.PI) / 180
    const cos = Math.cos(phi)
    const sin = Math.sin(phi)
    const dx = (x - x2) / 2
    const dy = (y - y2) / 2
    const x1p = cos * dx + sin * dy
    const y1p = -sin * dx + cos * dy
    const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
    if (lambda > 1) {
      rx *= Math.sqrt(lambda)
      ry *= Math.sqrt(lambda)
    }
    const num2 = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
    const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
    let coef = Math.sqrt(Math.max(0, num2 / den))
    if (large === sweep) coef = -coef
    const cxp = (coef * rx * y1p) / ry
    const cyp = (-coef * ry * x1p) / rx
    const ccx = cos * cxp - sin * cyp + (x + x2) / 2
    const ccy = sin * cxp + cos * cyp + (y + y2) / 2
    const angle = (ux: number, uy: number, vx: number, vy: number): number =>
      Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
    const t1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    let dt = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
    if (!sweep && dt > 0) dt -= 2 * Math.PI
    if (sweep && dt < 0) dt += 2 * Math.PI
    const r = Math.max(rx, ry) * k
    const n = steps(Math.abs(dt) * r, Math.min(rx, ry) * k || r)
    for (let s = 1; s <= n; s++) {
      const t = t1 + (dt * s) / n
      const ex = rx * Math.cos(t)
      const ey = ry * Math.sin(t)
      put(cos * ex - sin * ey + ccx, sin * ex + cos * ey + ccy)
    }
    x = x2
    y = y2
  }
  while (i < tokens.length) {
    if (!isNum()) cmd = tokens[i++]
    else if (!cmd) {
      i++
      continue
    }
    const rel = cmd === cmd.toLowerCase()
    const bx = rel ? x : 0
    const by = rel ? y : 0
    const c = cmd.toUpperCase()
    if (c !== 'Z' && !isNum()) break
    switch (c) {
      case 'M': {
        close()
        x = bx + num()
        y = by + num()
        startX = x
        startY = y
        put(x, y)
        // le coppie dopo M sono L
        cmd = rel ? 'l' : 'L'
        break
      }
      case 'L':
        x = bx + num()
        y = by + num()
        put(x, y)
        break
      case 'H':
        x = bx + num()
        put(x, y)
        break
      case 'V':
        y = by + num()
        put(x, y)
        break
      case 'C': {
        const x1 = bx + num()
        const y1 = by + num()
        const x2 = bx + num()
        const y2 = by + num()
        cubic(x1, y1, x2, y2, bx + num(), by + num())
        break
      }
      case 'S': {
        const smooth = prev === 'C' || prev === 'S'
        const x1 = smooth ? 2 * x - cx : x
        const y1 = smooth ? 2 * y - cy : y
        const x2 = bx + num()
        const y2 = by + num()
        cubic(x1, y1, x2, y2, bx + num(), by + num())
        break
      }
      case 'Q': {
        const x1 = bx + num()
        const y1 = by + num()
        quad(x1, y1, bx + num(), by + num())
        break
      }
      case 'T': {
        const smooth = prev === 'Q' || prev === 'T'
        quad(smooth ? 2 * x - cx : x, smooth ? 2 * y - cy : y, bx + num(), by + num())
        break
      }
      case 'A': {
        const rx = num()
        const ry = num()
        const rot = num()
        const large = num() !== 0
        const sweep = num() !== 0
        arc(rx, ry, rot, large, sweep, bx + num(), by + num())
        break
      }
      case 'Z':
        x = startX
        y = startY
        close()
        break
      default:
        i = tokens.length
    }
    prev = c
  }
  close()
  return out
}

/** Contorno della forma sulla carta, con la sua rotazione */
export function shapeOutline(l: ShapeLayer): Point[][] {
  let rings: Point[][]
  switch (l.shape) {
    case 'ellipse': {
      const rx = l.w / 2
      const ry = l.h / 2
      const n = steps(Math.PI * (rx + ry), Math.min(rx, ry) || Math.max(rx, ry))
      const ring: Point[] = []
      for (let s = 0; s < n; s++) {
        const a = (s * 2 * Math.PI) / n
        ring.push({ x: l.x + rx + rx * Math.cos(a), y: l.y + ry + ry * Math.sin(a) })
      }
      rings = [ring]
      break
    }
    case 'polygon':
    case 'star':
      rings = flattenPath(roundedPolygonPath(polygonVertices(l), l.radius))
      break
    case 'path':
      rings = pathRings(l)
      break
    case 'line':
      rings = []
      break
    default: {
      const r = Math.max(0, Math.min(l.radius, l.w / 2, l.h / 2))
      const { x, y, w, h } = l
      rings = r
        ? flattenPath(
            `M${x + r},${y}H${x + w - r}A${r},${r} 0 0 1 ${x + w},${y + r}V${y + h - r}` +
              `A${r},${r} 0 0 1 ${x + w - r},${y + h}H${x + r}A${r},${r} 0 0 1 ${x},${y + h - r}` +
              `V${y + r}A${r},${r} 0 0 1 ${x + r},${y}Z`
          )
        : [
            [
              { x, y },
              { x: x + w, y },
              { x: x + w, y: y + h },
              { x, y: y + h }
            ]
          ]
    }
  }
  if (!l.rotation) return rings
  const a = anchorPoint(l)
  return rings.map((ring) => ring.map((p) => rotateAround(p, a, l.rotation)))
}

/** Le forme dei figli (dall'ultimo, la base, al primo) già ognuna senza sovrapposizioni interne */
function operands(children: Layer[]): PathsD[] {
  return children
    .filter(isCombinable)
    .reverse()
    .map((c) => {
      const rings =
        c.type === 'shape'
          ? shapeOutline(c)
          : c.type === 'group'
            ? groupRotated(c, combinedRings(arrangeGroup(c)))
            : []
      return merge(rings)
    })
}

/** Un contorno solo, senza sovrapposizioni interne (regola nonzero, come l'SVG) */
const merge = (p: PathsD): PathsD => unionD(p, [], FillRule.NonZero, PRECISION)

function groupRotated(g: GroupLayer, rings: Point[][]): Point[][] {
  if (!g.rotation) return rings
  const a = anchorPoint(g)
  return rings.map((ring) => ring.map((p) => rotateAround(p, a, g.rotation)))
}

/**
 * I contorni del risultato di un gruppo combinato, nel sistema dei suoi figli (senza la
 * rotazione del gruppo). I figli devono già essere al loro posto (arrangeGroup).
 */
export function combinedRings(g: GroupLayer): Point[][] {
  return roundRings(combineRings(g.combine, operands(g.children)), g.radius ?? 0)
}

export function combineRings(op: GroupCombine, shapes: PathsD[]): Point[][] {
  if (!shapes.length || op === 'none') return []
  const [base, ...rest] = shapes
  if (!rest.length) return base
  switch (op) {
    case 'intersect':
      return rest.reduce((acc, s) => intersectD(acc, s, FillRule.NonZero, PRECISION), base)
    case 'subtract':
      return differenceD(base, merge(rest.flat()), FillRule.NonZero, PRECISION)
    case 'exclude':
      return rest.reduce((acc, s) => xorD(acc, s, FillRule.NonZero, PRECISION), base)
    default:
      return merge(shapes.flat())
  }
}

const fmt = (n: number): string => String(Math.round(n * 1000) / 1000)

/** Tracciato SVG dei contorni, con riquadro mappato su `box` se dato (coordinate 0-1) */
export function ringsToPath(rings: Point[][], box?: Bounds): string {
  const sx = box && box.w ? 1 / box.w : 1
  const sy = box && box.h ? 1 / box.h : 1
  const ox = box?.x ?? 0
  const oy = box?.y ?? 0
  const f = box ? (n: number): string => String(Math.round(n * 1e6) / 1e6) : fmt
  return rings
    .filter((r) => r.length > 2)
    .map((r) => 'M' + r.map((p) => `${f((p.x - ox) * sx)},${f((p.y - oy) * sy)}`).join(' L') + ' Z')
    .join(' ')
}

export function ringsBounds(rings: Point[][]): Bounds | null {
  const pts = rings.flat()
  if (!pts.length) return null
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] < x1) x1 = xs[i]
    if (xs[i] > x2) x2 = xs[i]
    if (ys[i] < y1) y1 = ys[i]
    if (ys[i] > y2) y2 = ys[i]
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

/** La forma che dà l'aspetto al risultato: la base, l'ultima forma tra i figli */
export function combineBase(g: GroupLayer): ShapeLayer | null {
  for (let i = g.children.length - 1; i >= 0; i--) {
    const c = g.children[i]
    if (!isCombinable(c)) continue
    if (c.type === 'shape') return c
    if (c.type === 'group') return combineBase(c)
  }
  return null
}

const cache = new WeakMap<GroupLayer, ShapeLayer | null>()

/**
 * Il risultato di un gruppo combinato come una forma da disegnare, con l'aspetto della base:
 * `combined` è il tracciato in mm. null se non c'è nessuna forma o il risultato è vuoto.
 * I figli devono già essere al loro posto (arrangeGroup).
 */
export function combinedShape(g: GroupLayer): ShapeLayer | null {
  if (cache.has(g)) return cache.get(g)!
  const base = combineBase(g)
  const rings = base ? combinedRings(g) : []
  const box = ringsBounds(rings)
  const out =
    base && box
      ? {
          ...base,
          id: `${g.id}-combined`,
          ...box,
          rotation: 0,
          visible: true,
          shape: 'path' as const,
          path: ringsToPath(rings, box),
          combined: ringsToPath(rings)
        }
      : null
  cache.set(g, out)
  return out
}

/**
 * Il gruppo combinato come una forma `path` sola, con l'aspetto della base. Con `bake` la
 * rotazione del gruppo entra nel tracciato; senza, il tracciato resta nel sistema dei figli.
 * `others`: gli altri figli (testi, immagini, linee). null se non c'è nessuna forma.
 */
export function flattenCombined(
  g: GroupLayer,
  bake: boolean
): { path: ShapeLayer; others: Layer[] } | null {
  const base = combineBase(g)
  if (!base) return null
  const rings = combinedRings(g)
  const box = ringsBounds(bake ? groupRotated(g, rings) : rings)
  if (!box) return null
  const bound = Object.fromEntries(
    Object.entries(base.bound ?? {}).filter(([k]) => !GEOMETRY.includes(k))
  )
  const path: ShapeLayer = {
    ...base,
    ...box,
    rotation: 0,
    anchor: 'center',
    visible: true,
    shape: 'path',
    path: ringsToPath(bake ? groupRotated(g, rings) : rings, box),
    opacity: bake ? base.opacity * g.opacity : base.opacity
  }
  if (Object.keys(bound).length) path.bound = bound
  else delete path.bound
  delete path.combined
  return { path, others: g.children.filter((c) => !isCombinable(c)) }
}

const GEOMETRY = ['x', 'y', 'w', 'h', 'rotation', 'visible', 'shape', 'path', 'radius', 'sides']

/**
 * Converti in tracciato: il gruppo combinato diventa una forma `path` con il suo nome. Se ha
 * anche altri livelli resta un gruppo, senza combinazione, con il tracciato in fondo.
 * Restituisce il template invariato se il livello non è un gruppo combinato con delle forme.
 */
export function convertToPath(
  t: Template,
  side: Side,
  id: string
): { template: Template; id: string | null } {
  const g = findLayer(t[side], id)
  if (!g || g.type !== 'group' || g.combine === 'none') return { template: t, id: null }
  const arranged = arrangeGroup(g)
  const alone = !arranged.children.some((c) => !isCombinable(c))
  const flat = flattenCombined(arranged, alone)
  if (!flat) return { template: t, id: null }
  const path = normalizeLayer(
    {
      ...(flat.path as unknown as Record<string, unknown>),
      id: undefined,
      name: alone ? g.name : flat.path.name
    },
    0
  ) as ShapeLayer
  const replacement: Layer = alone
    ? path
    : fitGroup({
        ...arranged,
        combine: 'none',
        layout: 'none',
        repeat: '1',
        children: [...flat.others, path]
      })
  return {
    template: updateLayers(t, side, (l) => (l.id === id ? replacement : l)),
    id: replacement.id
  }
}

/**
 * Combina le forme selezionate: se è un gruppo solo cambia la sua operazione, altrimenti le
 * raggruppa (devono stare nello stesso contenitore) in un gruppo combinato.
 */
export function combineLayers(
  t: Template,
  side: Side,
  ids: string[],
  op: GroupCombine
): { template: Template; groupId: string | null } {
  const only = ids.length === 1 ? findLayer(t[side], ids[0]) : null
  if (only?.type === 'group')
    return { template: patchLayer(t, side, only.id, { combine: op }), groupId: only.id }
  if (ids.length < 2) return { template: t, groupId: null }
  const r = groupLayers(t, side, ids)
  if (!r.groupId) return r
  const named = patchLayer(r.template, side, r.groupId, {
    combine: op,
    name: uniqueName(r.template, 'shape')
  })
  return { template: named, groupId: r.groupId }
}

/**
 * Angoli arrotondati di un contorno qualsiasi, di raggio r mm: prima quelli rientranti (si allarga
 * e si restringe), poi quelli sporgenti (si restringe e si allarga), con giunzioni tonde
 */
export function roundRings(rings: Point[][], r: number): Point[][] {
  if (!(r > 0) || !rings.length) return rings
  const grow = (p: PathsD, d: number): PathsD =>
    inflatePathsD(p, d, JoinType.Round, EndType.Polygon, 2, PRECISION, FLATNESS)
  const closed = grow(grow(rings, r), -r)
  return grow(grow(closed, -r), r)
}

/**
 * Il contorno di una forma `path` in mm, nel sistema del livello non ruotato: con gli angoli dei
 * singoli punti (`corners`) e quello di tutta la forma (`radius`)
 */
export function pathRings(l: ShapeLayer): Point[][] {
  const segs = layerSegments(l)
  const cornered = l.corners ? roundedCorners(segs, l.corners) : segs
  return roundRings(flattenPath(segmentsToPath(cornered)), l.radius)
}

/**
 * Il tracciato in mm di una forma `path` con angoli arrotondati, da disegnare al posto del
 * tracciato 0-1; null se non ne ha. Con i soli angoli dei punti restano archi veri
 */
export function roundedPathD(l: ShapeLayer): string | null {
  const corners = l.corners && Object.values(l.corners).some((r) => r > 0)
  if (!corners && !(l.radius > 0)) return null
  if (!(l.radius > 0)) return segmentsToPath(roundedCorners(layerSegments(l), l.corners!))
  return ringsToPath(pathRings(l))
}
