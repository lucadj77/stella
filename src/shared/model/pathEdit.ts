import { flattenPath, ringsBounds } from './combine'
import {
  anchorPoint,
  polygonVertices,
  rotateAround,
  roundedPolygonPath,
  type Point
} from './geometry'
import type { ShapeLayer } from './template'

// Modifica dei punti di una forma: il tracciato si legge come segmenti in coordinate assolute
// (in mm, nel sistema del livello non ruotato), si spostano i punti e si riscrive in coordinate
// 0-1 del riquadro, che si adatta ai punti. Le altre forme diventano prima un tracciato.

export type SegmentKind = 'M' | 'L' | 'C' | 'Q' | 'A' | 'Z'

export interface Segment {
  c: SegmentKind
  /** Punti di controllo e, per ultimo, il punto di arrivo; vuoto per Z */
  pts: Point[]
  /** Per A: raggi, rotazione, arco grande, verso */
  arc?: [number, number, number, number, number]
}

/** Legge un tracciato SVG come segmenti assoluti; H, V, S e T diventano L, C e Q */
export function parseSegments(d: string): Segment[] {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []
  const out: Segment[] = []
  let i = 0
  let cmd = ''
  let x = 0
  let y = 0
  let sx = 0
  let sy = 0
  const isNum = (): boolean => i < tokens.length && !/^[a-zA-Z]$/.test(tokens[i])
  const num = (): number => Number(tokens[i++])
  while (i < tokens.length) {
    if (!isNum()) cmd = tokens[i++]
    else if (!cmd) {
      i++
      continue
    }
    const rel = cmd === cmd.toLowerCase()
    const c = cmd.toUpperCase()
    if (c !== 'Z' && !isNum()) break
    const pt = (): Point => {
      const px = num()
      const py = num()
      return rel ? { x: x + px, y: y + py } : { x: px, y: py }
    }
    const last = out[out.length - 1]
    switch (c) {
      case 'M': {
        const p = pt()
        out.push({ c: 'M', pts: [p] })
        ;({ x, y } = p)
        sx = x
        sy = y
        cmd = rel ? 'l' : 'L'
        break
      }
      case 'L': {
        const p = pt()
        out.push({ c: 'L', pts: [p] })
        ;({ x, y } = p)
        break
      }
      case 'H': {
        const v = num()
        x = rel ? x + v : v
        out.push({ c: 'L', pts: [{ x, y }] })
        break
      }
      case 'V': {
        const v = num()
        y = rel ? y + v : v
        out.push({ c: 'L', pts: [{ x, y }] })
        break
      }
      case 'C': {
        const p1 = pt()
        const p2 = pt()
        const p = pt()
        out.push({ c: 'C', pts: [p1, p2, p] })
        ;({ x, y } = p)
        break
      }
      case 'S': {
        const p1 =
          last?.c === 'C' ? { x: 2 * x - last.pts[1].x, y: 2 * y - last.pts[1].y } : { x, y }
        const p2 = pt()
        const p = pt()
        out.push({ c: 'C', pts: [p1, p2, p] })
        ;({ x, y } = p)
        break
      }
      case 'Q': {
        const p1 = pt()
        const p = pt()
        out.push({ c: 'Q', pts: [p1, p] })
        ;({ x, y } = p)
        break
      }
      case 'T': {
        const p1 =
          last?.c === 'Q' ? { x: 2 * x - last.pts[0].x, y: 2 * y - last.pts[0].y } : { x, y }
        const p = pt()
        out.push({ c: 'Q', pts: [p1, p] })
        ;({ x, y } = p)
        break
      }
      case 'A': {
        const arc: Segment['arc'] = [num(), num(), num(), num(), num()]
        const p = pt()
        out.push({ c: 'A', pts: [p], arc })
        ;({ x, y } = p)
        break
      }
      case 'Z':
        out.push({ c: 'Z', pts: [] })
        x = sx
        y = sy
        break
      default:
        i = tokens.length
    }
  }
  return out
}

const fmt = (n: number): string => String(Math.round(n * 1e5) / 1e5)

export function segmentsToPath(segs: Segment[]): string {
  return segs
    .map((s) => {
      if (s.c === 'Z') return 'Z'
      const pts = s.pts.map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(' ')
      if (s.c === 'A') return `A${s.arc!.map(fmt).join(' ')} ${pts}`
      return s.c + pts
    })
    .join(' ')
}

const mapSegs = (
  segs: Segment[],
  f: (p: Point) => Point,
  k?: (r: number[]) => number[]
): Segment[] =>
  segs.map((s) => ({
    ...s,
    pts: s.pts.map(f),
    ...(s.arc
      ? { arc: (k ? [...k(s.arc.slice(0, 2)), ...s.arc.slice(2)] : s.arc) as Segment['arc'] }
      : {})
  }))

/** Costante delle curve di Bézier che approssimano un quarto di cerchio */
const KAPPA = 0.5522847498

/** Il contorno della forma come tracciato 0-1 nel suo riquadro, per modificarne i punti */
export function shapeAsPath(l: ShapeLayer): string {
  switch (l.shape) {
    case 'path':
      return l.path
    case 'ellipse': {
      const k = KAPPA / 2
      return (
        `M0.5,0 C${0.5 + k},0 1,${0.5 - k} 1,0.5 C1,${0.5 + k} ${0.5 + k},1 0.5,1 ` +
        `C${0.5 - k},1 0,${0.5 + k} 0,0.5 C0,${0.5 - k} ${0.5 - k},0 0.5,0 Z`
      )
    }
    case 'polygon':
    case 'star': {
      const mm = roundedPolygonPath(polygonVertices(l), l.radius)
      return toUnit(parseSegments(mm), l)
    }
    case 'line':
      return 'M0,0.5 L1,0.5'
    default: {
      const r = Math.max(0, Math.min(l.radius, l.w / 2, l.h / 2))
      if (!r) return 'M0,0 L1,0 L1,1 L0,1 Z'
      const { x, y, w, h } = l
      const mm =
        `M${x + r},${y} L${x + w - r},${y} A${r} ${r} 0 0 1 ${x + w},${y + r} ` +
        `L${x + w},${y + h - r} A${r} ${r} 0 0 1 ${x + w - r},${y + h} L${x + r},${y + h} ` +
        `A${r} ${r} 0 0 1 ${x},${y + h - r} L${x},${y + r} A${r} ${r} 0 0 1 ${x + r},${y} Z`
      return toUnit(parseSegments(mm), l)
    }
  }
}

/** Segmenti in mm sulla carta → tracciato 0-1 nel riquadro */
function toUnit(segs: Segment[], b: { x: number; y: number; w: number; h: number }): string {
  const w = b.w || 1
  const h = b.h || 1
  return segmentsToPath(
    mapSegs(
      segs,
      (p) => ({ x: (p.x - b.x) / w, y: (p.y - b.y) / h }),
      ([rx, ry]) => [rx / w, ry / h]
    )
  )
}

/** I segmenti del tracciato di una forma `path`, in mm nel sistema del livello non ruotato */
export function layerSegments(l: ShapeLayer): Segment[] {
  return mapSegs(
    parseSegments(l.path),
    (p) => ({ x: l.x + p.x * l.w, y: l.y + p.y * l.h }),
    ([rx, ry]) => [rx * l.w, ry * l.h]
  )
}

/**
 * La forma con i segmenti nuovi (in mm, nel sistema del livello non ruotato): il riquadro si
 * adatta al tracciato e, se il livello è ruotato, si sposta in modo che i punti restino dove sono
 * sulla carta
 */
export function withSegments(l: ShapeLayer, segs: Segment[]): ShapeLayer {
  const d = segmentsToPath(segs)
  const box = ringsBounds(flattenPath(d)) ?? { x: l.x, y: l.y, w: l.w, h: l.h }
  // un tracciato piatto (una linea) tiene almeno un decimo di mm
  box.w = Math.max(box.w, 0.1)
  box.h = Math.max(box.h, 0.1)
  let dx = 0
  let dy = 0
  if (l.rotation) {
    const a0 = anchorPoint(l)
    const a1 = anchorPoint({ ...l, ...box })
    const r = rotateAround({ x: a1.x - a0.x, y: a1.y - a0.y }, { x: 0, y: 0 }, l.rotation)
    dx = r.x - (a1.x - a0.x)
    dy = r.y - (a1.y - a0.y)
  }
  const shifted = { ...box, x: box.x + dx, y: box.y + dy }
  const local = mapSegs(segs, (p) => ({ x: p.x + dx, y: p.y + dy }))
  const round = (v: number): number => Math.round(v * 1000) / 1000
  const out = { x: round(shifted.x), y: round(shifted.y), w: round(box.w), h: round(box.h) }
  return { ...l, ...out, shape: 'path', path: toUnit(local, out) }
}

/** Un punto modificabile: l'arrivo di un segmento (anchor) o un suo punto di controllo */
export interface PathHandle {
  seg: number
  pt: number
  kind: 'anchor' | 'control'
  at: Point
  /** Per i controlli: il punto a cui sono legati, da unire con una linea */
  to?: Point
}

const same = (a: Point, b: Point): boolean =>
  Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6

/** Inizio del sottotracciato del segmento i */
function subpathStart(segs: Segment[], i: number): number {
  for (let k = i; k >= 0; k--) if (segs[k].c === 'M') return k
  return 0
}

/** Il segmento dopo i nello stesso sottotracciato, o (chiuso) quello dopo il suo M */
function endOf(segs: Segment[], i: number): Point | null {
  const s = segs[i]
  if (!s || s.c === 'Z') return null
  return s.pts[s.pts.length - 1]
}

/**
 * Le maniglie dei punti: un arrivo che coincide con l'inizio del sottotracciato (un tracciato
 * chiuso con un ultimo segmento che torna al punto di partenza) ne ha una sola
 */
export function pathHandles(segs: Segment[]): PathHandle[] {
  const out: PathHandle[] = []
  segs.forEach((s, i) => {
    if (s.c === 'Z') return
    const end = s.pts[s.pts.length - 1]
    const start = segs[subpathStart(segs, i)].pts[0]
    const prev = i > 0 ? endOf(segs, i - 1) : null
    if (s.c === 'C') {
      if (prev) out.push({ seg: i, pt: 0, kind: 'control', at: s.pts[0], to: prev })
      out.push({ seg: i, pt: 1, kind: 'control', at: s.pts[1], to: end })
    } else if (s.c === 'Q') {
      out.push({ seg: i, pt: 0, kind: 'control', at: s.pts[0], to: end })
    }
    const closes = s.c !== 'M' && same(end, start) && segs[i + 1]?.c === 'Z'
    if (!closes) out.push({ seg: i, pt: s.pts.length - 1, kind: 'anchor', at: end })
  })
  return out
}

/**
 * Sposta un punto. Un arrivo si porta dietro i controlli che gli stanno accanto e, se chiude il
 * sottotracciato, l'arrivo dell'ultimo segmento che torna lì
 */
export function movePathPoint(segs: Segment[], seg: number, pt: number, to: Point): Segment[] {
  const out = segs.map((s) => ({ ...s, pts: s.pts.map((p) => ({ ...p })) }))
  const s = out[seg]
  if (!s || !s.pts[pt]) return segs
  const from = { ...s.pts[pt] }
  const dx = to.x - from.x
  const dy = to.y - from.y
  const shift = (p: Point): void => {
    p.x += dx
    p.y += dy
  }
  const anchor = pt === s.pts.length - 1
  if (!anchor) {
    s.pts[pt] = { ...to }
    return out
  }
  const moveAnchor = (i: number): void => {
    const t = out[i]
    shift(t.pts[t.pts.length - 1])
    if (t.c === 'C') shift(t.pts[1])
    const next = out[i + 1]
    if (next?.c === 'C') shift(next.pts[0])
  }
  moveAnchor(seg)
  // il punto di partenza di un sottotracciato chiuso: anche l'ultimo arrivo, se coincide
  if (s.c === 'M') {
    let k = seg + 1
    while (k < out.length && out[k].c !== 'M' && out[k].c !== 'Z') k++
    const last = k - 1
    if (out[k]?.c === 'Z' && last > seg && same(segs[last].pts[segs[last].pts.length - 1], from)) {
      moveAnchor(last)
    }
  }
  return out
}

/** Toglie un punto (l'arrivo di un segmento); il tracciato resta con almeno due punti */
export function removePathPoint(segs: Segment[], seg: number): Segment[] {
  const drawn = segs.filter((s) => s.c !== 'Z' && s.c !== 'M').length
  if (drawn < 3 || !segs[seg]) return segs
  const out = segs.map((s) => ({ ...s, pts: [...s.pts] }))
  if (out[seg].c === 'M') {
    // il segmento dopo diventa l'inizio
    const next = out[seg + 1]
    if (!next || next.c === 'Z' || next.c === 'M') return segs
    out.splice(seg, 2, { c: 'M', pts: [next.pts[next.pts.length - 1]] })
    return out
  }
  out.splice(seg, 1)
  return out
}

/** Punto della quadratica o della cubica a t */
function at(p0: Point, s: Segment, t: number): Point {
  const u = 1 - t
  if (s.c === 'C') {
    const [a, b, c] = s.pts
    return {
      x: u * u * u * p0.x + 3 * u * u * t * a.x + 3 * u * t * t * b.x + t * t * t * c.x,
      y: u * u * u * p0.y + 3 * u * u * t * a.y + 3 * u * t * t * b.y + t * t * t * c.y
    }
  }
  if (s.c === 'Q') {
    const [a, b] = s.pts
    return {
      x: u * u * p0.x + 2 * u * t * a.x + t * t * b.x,
      y: u * u * p0.y + 2 * u * t * a.y + t * t * b.y
    }
  }
  const e = s.pts[s.pts.length - 1]
  return { x: p0.x + (e.x - p0.x) * t, y: p0.y + (e.y - p0.y) * t }
}

const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t
})

/**
 * Aggiunge un punto sul segmento più vicino a p, entro `reach` mm. Le curve si dividono in due
 * senza cambiare forma; un arco diventa due tratti dritti. null se nessun segmento è vicino
 */
export function insertPathPoint(segs: Segment[], p: Point, reach: number): Segment[] | null {
  let best: { i: number; t: number; d: number } | null = null
  let start: Point = { x: 0, y: 0 }
  let cur: Point = { x: 0, y: 0 }
  segs.forEach((s, i) => {
    if (s.c === 'M') {
      start = cur = s.pts[0]
      return
    }
    const p0 = cur
    const seg: Segment = s.c === 'Z' ? { c: 'L', pts: [start] } : s
    for (let k = 1; k < 64; k++) {
      const q = at(p0, seg, k / 64)
      const d = Math.hypot(q.x - p.x, q.y - p.y)
      if (!best || d < best.d) best = { i, t: k / 64, d }
    }
    cur = s.c === 'Z' ? start : s.pts[s.pts.length - 1]
  })
  const found = best as { i: number; t: number; d: number } | null
  if (!found || found.d > reach) return null
  const { i, t } = found
  // il punto di partenza del segmento
  let p0: Point = { x: 0, y: 0 }
  let st: Point = { x: 0, y: 0 }
  for (let k = 0; k < i; k++) {
    const s = segs[k]
    if (s.c === 'M') st = s.pts[0]
    p0 = s.c === 'Z' ? st : s.pts[s.pts.length - 1]
  }
  const s = segs[i]
  const out = [...segs]
  if (s.c === 'C') {
    const [a, b, c] = s.pts
    const ab = lerp(p0, a, t)
    const bc = lerp(a, b, t)
    const cd = lerp(b, c, t)
    const abc = lerp(ab, bc, t)
    const bcd = lerp(bc, cd, t)
    const m = lerp(abc, bcd, t)
    out.splice(i, 1, { c: 'C', pts: [ab, abc, m] }, { c: 'C', pts: [bcd, cd, c] })
  } else if (s.c === 'Q') {
    const [a, b] = s.pts
    const q0 = lerp(p0, a, t)
    const q1 = lerp(a, b, t)
    out.splice(i, 1, { c: 'Q', pts: [q0, lerp(q0, q1, t)] }, { c: 'Q', pts: [q1, b] })
  } else if (s.c === 'Z') {
    out.splice(i, 0, { c: 'L', pts: [lerp(p0, st, t)] })
  } else {
    const e = s.pts[s.pts.length - 1]
    out.splice(i, 1, { c: 'L', pts: [lerp(p0, e, t)] }, { c: 'L', pts: [e] })
  }
  return out
}
