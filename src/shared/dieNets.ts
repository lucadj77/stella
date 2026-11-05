import type { SceneItem, SceneLine, SceneShape } from './export'
import type { DieType } from './model/dice'
import { dieSolid, type Solid } from './model/solids'
import type { Template } from './model/template'

// Sviluppi piani dei dadi che non sono cubi: il solido si apre faccia per faccia lungo un albero
// di spigoli, le facce si girano nella pagina e sugli spigoli da incollare nasce una linguetta,
// con la faccia specchiata come nello sviluppo del cubo. Ogni faccia è una carta trasformata:
// la matrice porta le coordinate del template (mm) sulla pagina.

type P = [number, number]
/** Matrice affine [a, b, c, d, e, f]: (x, y) → (a x + c y + e, b x + d y + f) */
export type Affine = [number, number, number, number, number, number]

const apply = (m: Affine, [x, y]: P): P => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
const compose = (m: Affine, n: Affine): Affine => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5]
]
const translate = (m: Affine, dx: number, dy: number): Affine => [
  m[0],
  m[1],
  m[2],
  m[3],
  m[4] + dx,
  m[5] + dy
]

/** Il moto rigido (senza specchio) che porta a1 in b1 e a2 in b2 */
function rigid(a1: P, a2: P, b1: P, b2: P): Affine {
  const ta = Math.atan2(a2[1] - a1[1], a2[0] - a1[0])
  const tb = Math.atan2(b2[1] - b1[1], b2[0] - b1[0])
  const t = tb - ta
  const c = Math.cos(t)
  const s = Math.sin(t)
  return [c, s, -s, c, b1[0] - (c * a1[0] - s * a1[1]), b1[1] - (s * a1[0] + c * a1[1])]
}

/** Specchio rispetto alla retta per p e q */
function mirror(p: P, q: P): Affine {
  const dx = q[0] - p[0]
  const dy = q[1] - p[1]
  const l2 = dx * dx + dy * dy
  const a = (dx * dx - dy * dy) / l2
  const b = (2 * dx * dy) / l2
  // x' = a x + b y + e, y' = b x - a y + f
  return [a, b, b, -a, p[0] - (a * p[0] + b * p[1]), p[1] - (b * p[0] - a * p[1])]
}

/**
 * Le facce del solido nella pagina prima di girarle, in mm veri: come la faccia sta disegnata
 * nella carta, con l'alto dell'immagine in alto. sy porta l'altezza del template su quella vera
 * (un template più alto o più basso della faccia si schiaccia per entrarci)
 */
function localFaces(solid: Solid, h: number): { at: Map<number, P>; sy: number }[] {
  return solid.faces.map((f) => {
    const right: [number, number, number] = [
      f.up[1] * f.normal[2] - f.up[2] * f.normal[1],
      f.up[2] * f.normal[0] - f.up[0] * f.normal[2],
      f.up[0] * f.normal[1] - f.up[1] * f.normal[0]
    ]
    const dot = (a: number[], b: number[]): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
    const xy = f.verts.map((i) => [dot(solid.points[i], right), dot(solid.points[i], f.up)])
    const minX = Math.min(...xy.map((p) => p[0]))
    const maxY = Math.max(...xy.map((p) => p[1]))
    const minY = Math.min(...xy.map((p) => p[1]))
    return {
      at: new Map(f.verts.map((v, k): [number, P] => [v, [xy[k][0] - minX, maxY - xy[k][1]]])),
      sy: (maxY - minY) / h
    }
  })
}

/** Due poligoni convessi si sovrappongono (toccarsi lungo un lato non conta) */
function overlap(a: P[], b: P[]): boolean {
  for (const poly of [a, b])
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]
      const q = poly[(i + 1) % poly.length]
      const n: P = [q[1] - p[1], p[0] - q[0]]
      const proj = (pts: P[]): [number, number] => {
        const v = pts.map((x) => x[0] * n[0] + x[1] * n[1])
        return [Math.min(...v), Math.max(...v)]
      }
      const [a0, a1] = proj(a)
      const [b0, b1] = proj(b)
      const eps = 1e-6 * Math.hypot(n[0], n[1]) * 100
      if (a1 <= b0 + eps || b1 <= a0 + eps) return false
    }
  return true
}

/** Poligono spostato verso fuori di d[i] sul lato i (da i a i+1); il poligono gira in un verso fisso */
function offsetPolygon(pts: P[], d: number[]): P[] {
  const n = pts.length
  // verso del giro: per un poligono orario (y in basso) la normale esterna è a sinistra
  let area = 0
  for (let i = 0; i < n; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % n]
    area += p[0] * q[1] - q[0] * p[1]
  }
  const sgn = area > 0 ? 1 : -1
  const lines = pts.map((p, i) => {
    const q = pts[(i + 1) % n]
    const l = Math.hypot(q[0] - p[0], q[1] - p[1])
    const nx = (sgn * (q[1] - p[1])) / l
    const ny = (sgn * -(q[0] - p[0])) / l
    return { p: [p[0] + nx * d[i], p[1] + ny * d[i]] as P, dir: [q[0] - p[0], q[1] - p[1]] as P }
  })
  return lines.map((l, i) => {
    const m = lines[(i - 1 + n) % n]
    // intersezione della retta precedente con questa
    const den = m.dir[0] * l.dir[1] - m.dir[1] * l.dir[0]
    if (Math.abs(den) < 1e-12) return l.p
    const t = ((l.p[0] - m.p[0]) * l.dir[1] - (l.p[1] - m.p[1]) * l.dir[0]) / den
    return [m.p[0] + m.dir[0] * t, m.p[1] + m.dir[1] * t]
  })
}

/** Generatore pseudocasuale fisso: lo stesso dado dà sempre lo stesso sviluppo */
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

export interface NetLayout {
  /** Per ogni faccia, la matrice dal template alla pagina e il poligono sulla pagina */
  faces: { matrix: Affine; polygon: P[] }[]
  /** Pieghe tra due facce */
  folds: [P, P][]
  /** Lati da incollare: la faccia da cui parte la linguetta e il lato */
  tabs: { face: number; edge: [P, P]; polygon: P[] }[]
  /** Lati da tagliare senza linguetta */
  cuts: [P, P][]
  width: number
  height: number
}

/**
 * Lo sviluppo di un dado, con l'angolo in alto a sinistra in (0, 0): tra molti alberi di spigoli
 * si sceglie quello più compatto in cui facce e linguette non si sovrappongono
 */
export function netLayout(d: DieType, w: number, h: number, tab: number, pad = 0): NetLayout {
  // l'anteprima lo chiede spesso: lo stesso dado dà sempre lo stesso sviluppo
  const key = [d, w, h, tab, pad].join('|')
  const hit = layouts.get(key)
  if (hit) return hit
  const out = searchNet(d, w, h, tab, pad)
  if (layouts.size > 50) layouts.clear()
  layouts.set(key, out)
  return out
}

const layouts = new Map<string, NetLayout>()

function searchNet(d: DieType, w: number, h: number, tab: number, pad: number): NetLayout {
  const solid = dieSolid(d, { width: w, height: h })
  const lf = localFaces(solid, h)
  const local = lf.map((f) => f.at)
  const n = solid.faces.length
  // spigoli tra facce: lo spigolo (u, v) è condiviso da due facce
  const edgeFaces = new Map<string, number[]>()
  solid.faces.forEach((f, fi) =>
    f.verts.forEach((v, i) => {
      const u = f.verts[(i + 1) % f.verts.length]
      const key = v < u ? `${v}-${u}` : `${u}-${v}`
      edgeFaces.set(key, [...(edgeFaces.get(key) ?? []), fi])
    })
  )
  const neighbors = solid.faces.map((_, fi) =>
    [...edgeFaces.entries()]
      .filter(([, fs]) => fs.includes(fi))
      .map(([key, fs]) => ({ key, other: fs[0] === fi ? fs[1] : fs[0] }))
  )
  // la linguetta piena; se non entra, più stretta verso i vertici, poi più bassa
  const tabPolygon = (p: P, q: P, outward: P, len: number, variant: number): P[] => {
    const dd = Math.min(tab, len * 0.45) * [1, 1, 0.7, 0.5, 0.35][variant]
    const inset = Math.min(dd * (variant ? 1.8 : 0.9), len * (variant ? 0.42 : 0.3))
    const t: P = [(q[0] - p[0]) / len, (q[1] - p[1]) / len]
    return [
      p,
      q,
      [q[0] + outward[0] * dd - t[0] * inset, q[1] + outward[1] * dd - t[1] * inset],
      [p[0] + outward[0] * dd + t[0] * inset, p[1] + outward[1] * dd + t[1] * inset]
    ]
  }

  let best: { layout: NetLayout; score: number } | null = null
  const random = rng(n * 7919 + Math.round(w * 13))
  for (let attempt = 0; attempt < 400; attempt++) {
    const root = attempt % n
    const placed: (Affine | null)[] = new Array(n).fill(null)
    placed[root] = [1, 0, 0, 1, 0, 0]
    const tree = new Set<string>()
    const frontier: number[] = [root]
    const polys: (P[] | null)[] = new Array(n).fill(null)
    const polyOf = (fi: number, m: Affine): P[] =>
      solid.faces[fi].verts.map((v) => apply(m, local[fi].get(v)!))
    polys[root] = polyOf(root, placed[root]!)
    let ok = true
    while (frontier.length) {
      // a volte si continua dall'ultima faccia (strisce lunghe), a volte da una a caso
      const pick = random() < 0.5 ? frontier.length - 1 : Math.floor(random() * frontier.length)
      const fi = frontier[pick]
      const free = neighbors[fi].filter((x) => !placed[x.other])
      if (!free.length) {
        frontier.splice(pick, 1)
        continue
      }
      const { key, other } = free[Math.floor(random() * free.length)]
      const [u, v] = key.split('-').map(Number)
      const m = placed[fi]!
      const pu = apply(m, local[fi].get(u)!)
      const pv = apply(m, local[fi].get(v)!)
      const g = rigid(local[other].get(u)!, local[other].get(v)!, pu, pv)
      const poly = polyOf(other, g)
      if (polys.some((q) => q && overlap(q, poly))) {
        // questa faccia non sta lì: si prova un altro spigolo più avanti
        neighbors[fi] = neighbors[fi].filter((x) => x.key !== key || x.other !== other)
        if (!neighbors[fi].some((x) => !placed[x.other])) frontier.splice(pick, 1)
        continue
      }
      placed[other] = g
      polys[other] = poly
      tree.add(key)
      frontier.push(other)
    }
    // ripristina i vicini per il tentativo dopo
    for (let fi = 0; fi < n; fi++)
      neighbors[fi] = [...edgeFaces.entries()]
        .filter(([, fs]) => fs.includes(fi))
        .map(([key, fs]) => ({ key, other: fs[0] === fi ? fs[1] : fs[0] }))
    if (placed.some((m) => !m)) continue
    // gli spigoli tagliati compaiono due volte: la linguetta va su uno dei due
    const occurrences = new Map<string, { face: number; edge: [P, P]; out: P; len: number }[]>()
    solid.faces.forEach((f, fi) =>
      f.verts.forEach((v, i) => {
        const u = f.verts[(i + 1) % f.verts.length]
        const key = v < u ? `${v}-${u}` : `${u}-${v}`
        if (tree.has(key)) return
        const p = apply(placed[fi]!, local[fi].get(v)!)
        const q = apply(placed[fi]!, local[fi].get(u)!)
        const len = Math.hypot(q[0] - p[0], q[1] - p[1])
        // verso fuori dalla faccia: lontano dal suo centro
        const c = polys[fi]!.reduce((s, x) => [s[0] + x[0], s[1] + x[1]], [0, 0])
        const cx = c[0] / polys[fi]!.length
        const cy = c[1] / polys[fi]!.length
        let out: P = [(q[1] - p[1]) / len, -(q[0] - p[0]) / len]
        const mid: P = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
        if ((mid[0] - cx) * out[0] + (mid[1] - cy) * out[1] < 0) out = [-out[0], -out[1]]
        occurrences.set(key, [
          ...(occurrences.get(key) ?? []),
          { face: fi, edge: [p, q], out, len }
        ])
      })
    )
    const shapes: P[][] = polys.map((p) => p!)
    const tabs: NetLayout['tabs'] = []
    const cuts: [P, P][] = []
    let shrunk = 0
    for (const occ of occurrences.values()) {
      let done = false
      for (let variant = 0; variant < 5 && !done; variant++)
        for (const o of occ) {
          const poly = tabPolygon(o.edge[0], o.edge[1], o.out, o.len, variant)
          if (shapes.some((s) => overlap(s, poly))) continue
          shapes.push(poly)
          tabs.push({ face: o.face, edge: o.edge, polygon: poly })
          shrunk += variant
          done = true
          break
        }
      if (!done) {
        ok = false
        break
      }
      for (const o of occ) if (!tabs.some((t) => t.edge === o.edge)) cuts.push(o.edge)
    }
    if (!ok) continue
    const all = shapes.flat()
    const minX = Math.min(...all.map((p) => p[0]))
    const maxX = Math.max(...all.map((p) => p[0]))
    const minY = Math.min(...all.map((p) => p[1]))
    const maxY = Math.max(...all.map((p) => p[1]))
    const W = maxX - minX
    const H = maxY - minY
    // più compatto e meno allungato: entra meglio in una pagina
    const score = W * H * (1 + 0.15 * Math.abs(Math.log(W / H))) * (1 + 0.03 * shrunk)
    if (best && score >= best.score) continue
    const dx = pad - minX
    const dy = pad - minY
    const mv = (p: P): P => [p[0] + dx, p[1] + dy]
    const folds: [P, P][] = []
    solid.faces.forEach((f, fi) =>
      f.verts.forEach((v, i) => {
        const u = f.verts[(i + 1) % f.verts.length]
        const key = v < u ? `${v}-${u}` : `${u}-${v}`
        if (!tree.has(key) || v > u) return
        folds.push([
          mv(apply(placed[fi]!, local[fi].get(v)!)),
          mv(apply(placed[fi]!, local[fi].get(u)!))
        ])
      })
    )
    best = {
      score,
      layout: {
        faces: placed.map((m, fi) => ({
          matrix: translate(compose(m!, [1, 0, 0, lf[fi].sy, 0, 0]), dx, dy),
          polygon: polys[fi]!.map(mv)
        })),
        folds,
        tabs: tabs.map((t) => ({
          face: t.face,
          edge: [mv(t.edge[0]), mv(t.edge[1])],
          polygon: t.polygon.map(mv)
        })),
        cuts: cuts.map(([p, q]) => [mv(p), mv(q)]),
        width: W + 2 * pad,
        height: H + 2 * pad
      }
    }
  }
  if (!best) throw new Error(`net ${d}`)
  return best.layout
}

export interface PolyNet {
  width: number
  height: number
  items: SceneItem[]
  tabs: SceneItem[]
  shapes: SceneShape[]
  cut: SceneLine[]
  folds: SceneLine[]
}

/** Colore sotto le linguette, dove la faccia è trasparente */
const TAB_FILL = '#E3E3E3'
/** Quanto una faccia entra sotto la vicina lungo una piega, in mm */
const FOLD_OVERLAP = 0.1

/**
 * Lo sviluppo di un dado con le sue carte, a partire da (x, y). Con l'abbondanza ogni faccia la
 * tiene sui lati da tagliare
 */
export function polyNet(
  layout: NetLayout,
  faces: Template[],
  bleed: boolean,
  x = 0,
  y = 0
): PolyNet {
  const mv = (p: P): P => [p[0] + x, p[1] + y]
  const line = (a: P, z: P, dash?: boolean): SceneLine => ({
    x1: a[0] + x,
    y1: a[1] + y,
    x2: z[0] + x,
    y2: z[1] + y,
    ...(dash ? { dash: true } : {})
  })
  const isCut = (p: P, q: P): boolean =>
    layout.cuts.some(
      ([a, b]) =>
        (Math.hypot(a[0] - p[0], a[1] - p[1]) < 1e-6 &&
          Math.hypot(b[0] - q[0], b[1] - q[1]) < 1e-6) ||
        (Math.hypot(a[0] - q[0], a[1] - q[1]) < 1e-6 && Math.hypot(b[0] - p[0], b[1] - p[1]) < 1e-6)
    )
  // con l'abbondanza ogni faccia esce due volte: prima allargata sui lati da tagliare, poi
  // esatta sopra tutte, così l'abbondanza di una faccia non copre mai una faccia vicina
  const face = (k: number, withBleed: boolean): SceneItem => {
    const t = faces[k]
    const b = withBleed ? t.bleed : 0
    const poly = layout.faces[k].polygon
    // sulle pieghe la faccia entra di poco nella vicina: senza, resta una riga bianca sottile
    const clip = offsetPolygon(
      poly,
      poly.map((p, i) => (isCut(p, poly[(i + 1) % poly.length]) ? b : FOLD_OVERLAP))
    )
    return {
      x: 0,
      y: 0,
      template: t,
      side: 'front' as const,
      mode: bleed ? ('bleed' as const) : ('cut' as const),
      matrix: translate(layout.faces[k].matrix, x, y),
      clip: clip.map(mv)
    }
  }
  const exact = layout.faces.map((_, k) => face(k, false))
  const items: SceneItem[] = bleed
    ? [...layout.faces.map((_, k) => face(k, true)), ...exact]
    : exact
  const tabs: SceneItem[] = layout.tabs.map((tb) => {
    const m = compose(mirror(tb.edge[0], tb.edge[1]), layout.faces[tb.face].matrix)
    return {
      x: 0,
      y: 0,
      template: faces[tb.face],
      side: 'front' as const,
      mode: 'cut' as const,
      matrix: translate(m, x, y),
      clip: offsetPolygon(tb.polygon, [-FOLD_OVERLAP * 2, 0, 0, 0]).map(mv)
    }
  })
  const shapes: SceneShape[] = layout.tabs.map((tb) => ({
    points: tb.polygon.map(mv),
    fill: TAB_FILL
  }))
  const cut: SceneLine[] = [
    ...layout.cuts.map(([p, q]) => line(p, q)),
    ...layout.tabs.flatMap((tb) => {
      const [p, q, q2, p2] = tb.polygon
      return [line(q, q2), line(q2, p2), line(p2, p)]
    })
  ]
  const folds: SceneLine[] = [
    ...layout.folds.map(([p, q]) => line(p, q, true)),
    ...layout.tabs.map((tb) => line(tb.edge[0], tb.edge[1], true))
  ]
  return { width: layout.width, height: layout.height, items, tabs, shapes, cut, folds }
}

export { offsetPolygon }
