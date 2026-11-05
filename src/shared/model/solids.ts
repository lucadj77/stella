import { D4_CORNERS, DIE_ROWS, kiteHeightParam, type DieType } from './dice'

// Dadi in 3D per Tabletop Simulator: il solido di ogni dado, con le facce nell'ordine delle righe
// del set, l'immagine di ogni faccia presa da una cella di un foglio, e la rotazione che porta in
// alto ogni valore. I modelli si scrivono come file .obj in coordinate destrorse con Y in alto;
// Tabletop Simulator (Unity) li carica specchiando l'asse X, e le rotazioni ne tengono conto.

export type Vec = [number, number, number]

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const mul = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
]
const len = (a: Vec): number => Math.sqrt(dot(a, a))
const unit = (a: Vec): Vec => mul(a, 1 / (len(a) || 1))
const mean = (ps: Vec[]): Vec => mul(ps.reduce(add, [0, 0, 0]), 1 / ps.length)

/** Celle del foglio delle facce: colonne e righe */
export function dieAtlas(d: DieType): { cols: number; rows: number } {
  switch (d) {
    case 'd2':
      return { cols: 2, rows: 1 }
    case 'd3':
    case 'd6':
      return { cols: 3, rows: 2 }
    case 'd4':
      return { cols: 2, rows: 2 }
    case 'd8':
      return { cols: 3, rows: 3 }
    case 'd10':
    case 'd12':
      return { cols: 4, rows: 3 }
    case 'd20':
      return { cols: 5, rows: 4 }
  }
}

/** Quante facce ha il solido: il d3 è un cubo */
export const solidFaceCount = (d: DieType): number => (d === 'd3' ? 6 : DIE_ROWS[d])

/** Una faccia del solido: i vertici (indici) in senso antiorario visti da fuori e l'alto dell'immagine */
export interface SolidFace {
  verts: number[]
  normal: Vec
  up: Vec
}

export interface Solid {
  points: Vec[]
  /** Nell'ordine delle carte: la faccia k mostra la carta k del dado */
  faces: SolidFace[]
  /** Per ogni valore (carta k), la direzione che va portata in alto per leggerlo */
  upFor: Vec[]
}

// ——— Solidi di lato qualsiasi, centrati nell'origine ———

const PHI = (1 + Math.sqrt(5)) / 2

/** Facce come vertici sparsi: le ordina, ne calcola la normale verso fuori e l'alto */
function faceOf(points: Vec[], verts: number[], apex: Vec | null, up?: Vec): SolidFace {
  const ps = verts.map((i) => points[i])
  const c = mean(ps)
  const approx = unit(c)
  // ordine attorno al centro della faccia, antiorario visto da fuori
  const e1 = unit(sub(ps[0], c))
  const e2 = cross(approx, e1)
  const sorted = [...verts].sort((a, b) => {
    const pa = sub(points[a], c)
    const pb = sub(points[b], c)
    return Math.atan2(dot(pa, e2), dot(pa, e1)) - Math.atan2(dot(pb, e2), dot(pb, e1))
  })
  const q = sorted.map((i) => points[i])
  let normal = unit(cross(sub(q[1], q[0]), sub(q[2], q[0])))
  if (dot(normal, c) < 0) {
    sorted.reverse()
    normal = mul(normal, -1)
  }
  const toward = up ?? sub(apex!, c)
  const u = unit(sub(toward, mul(normal, dot(toward, normal))))
  return { verts: sorted, normal, up: u }
}

/** Tetraedro: la faccia k ha in alto il vertice k e in basso quelli di D4_CORNERS */
function tetra(): Solid {
  const base: Vec[] = [
    [1, 1, 1],
    [1, -1, -1],
    [-1, 1, -1],
    [-1, -1, 1]
  ]
  // si cerca la disposizione dei vertici per cui ogni faccia (alto, basso a sinistra, basso a
  // destra) gira in senso antiorario vista da fuori
  const perms = permutations([0, 1, 2, 3])
  for (const p of perms) {
    const points = p.map((i) => base[i])
    const ok = D4_CORNERS.every(([top, left, right]) => {
      const a = points[top]
      const n = cross(sub(points[left], a), sub(points[right], a))
      return dot(n, mean([a, points[left], points[right]])) > 0
    })
    if (!ok) continue
    const faces = D4_CORNERS.map(([top, left, right]) => {
      const f = faceOf(points, [top, left, right], points[top])
      return f
    })
    // si legge il vertice in alto: il numero della carta k sta nel vertice k
    return { points, faces, upFor: points.map(unit) }
  }
  throw new Error('d4')
}

function permutations(xs: number[]): number[][] {
  if (xs.length <= 1) return [xs]
  return xs.flatMap((x, i) =>
    permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [x, ...rest])
  )
}

/** Facce triangolari tra vertici alla distanza `edge` l'uno dall'altro */
function triangles(points: Vec[], edge: number): number[][] {
  const near = (a: number, b: number): boolean =>
    Math.abs(len(sub(points[a], points[b])) - edge) < 1e-6
  const out: number[][] = []
  for (let a = 0; a < points.length; a++)
    for (let b = a + 1; b < points.length; b++)
      for (let c = b + 1; c < points.length; c++)
        if (near(a, b) && near(b, c) && near(a, c)) out.push([a, b, c])
  return out
}

function icosaPoints(): Vec[] {
  const out: Vec[] = []
  for (const a of [-1, 1]) for (const b of [-PHI, PHI]) out.push([0, a, b], [a, b, 0], [b, 0, a])
  return out
}

/** In alto il vertice più vicino al polo della sua metà del dado */
const apexByPole = (points: Vec[], verts: number[]): Vec => {
  const c = mean(verts.map((i) => points[i]))
  const pole: Vec = [0, c[1] >= 0 ? 1 : -1, 0]
  return verts
    .map((i) => points[i])
    .reduce((best, p) => (dot(p, pole) > dot(best, pole) + 1e-9 ? p : best))
}

/**
 * Le facce in ordine di valore: la prima libera, scendendo dall'alto, prende il valore più basso
 * ancora libero e la sua opposta quello che con lui fa N + 1, come nei dadi veri
 */
function byValue(raw: SolidFace[]): SolidFace[] {
  const n = raw.length
  const order = raw
    .map((f, i) => ({ f, i }))
    .sort(
      (a, b) =>
        b.f.normal[1] - a.f.normal[1] ||
        Math.atan2(a.f.normal[2], a.f.normal[0]) - Math.atan2(b.f.normal[2], b.f.normal[0])
    )
  const out: SolidFace[] = new Array(n)
  const used = new Set<number>()
  let v = 0
  for (const { f, i } of order) {
    if (used.has(i)) continue
    const j = raw.findIndex((g, k) => !used.has(k) && k !== i && dot(g.normal, f.normal) < -0.999)
    used.add(i)
    out[v] = f
    if (j >= 0) {
      used.add(j)
      out[n - 1 - v] = raw[j]
    }
    v++
  }
  return out
}

function polySolid(points: Vec[], faces: SolidFace[]): Solid {
  const ordered = byValue(faces)
  return { points, faces: ordered, upFor: ordered.map((f) => f.normal) }
}

function octa(): Solid {
  const points: Vec[] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1]
  ]
  const faces = triangles(points, Math.SQRT2).map((v) => faceOf(points, v, apexByPole(points, v)))
  return polySolid(points, faces)
}

function icosa(): Solid {
  const points = icosaPoints()
  const faces = triangles(points, 2).map((v) => faceOf(points, v, apexByPole(points, v)))
  return polySolid(points, faces)
}

function dodeca(): Solid {
  const ico = icosaPoints()
  const tris = triangles(ico, 2)
  // i vertici del dodecaedro sono i centri delle facce dell'icosaedro, e ogni faccia gira
  // attorno a un vertice dell'icosaedro
  const points = tris.map((t) => mean(t.map((i) => ico[i])))
  const faces = ico.map((_, k) => {
    const verts = tris.map((t, i) => (t.includes(k) ? i : -1)).filter((i) => i >= 0)
    return faceOf(points, verts, apexByPole(points, verts))
  })
  return polySolid(points, faces)
}

/** Trapezoedro pentagonale con gli aquiloni della proporzione del template */
function trapezo(ratio: number): Solid {
  const c = kiteHeightParam(ratio)
  const a36 = Math.PI / 5
  const a72 = (2 * Math.PI) / 5
  const up = (i: number): Vec => [Math.cos(a72 * i), c, Math.sin(a72 * i)]
  const low = (i: number): Vec => [Math.cos(a36 + a72 * i), -c, Math.sin(a36 + a72 * i)]
  // la punta sta sul piano dei tre vertici dell'aquilone
  const n = cross(sub(low(0), up(0)), sub(up(1), up(0)))
  const apex = dot(n, up(0)) / n[1]
  const points: Vec[] = [
    [0, apex, 0],
    [0, -apex, 0]
  ]
  for (let i = 0; i < 5; i++) points.push(up(i))
  for (let i = 0; i < 5; i++) points.push(low(i))
  const U = (i: number): number => 2 + (i % 5)
  const L = (i: number): number => 7 + (i % 5)
  const faces: SolidFace[] = []
  for (let i = 0; i < 5; i++) {
    faces.push(faceOf(points, [0, U(i), L(i), U(i + 1)], points[0]))
    faces.push(faceOf(points, [1, L(i), U(i + 1), L(i + 1)], points[1]))
  }
  return polySolid(points, faces)
}

/** Cubo: la carta k sulla faccia del valore k + 1, opposte che fanno 7 */
const CUBE: { normal: Vec; up: Vec }[] = [
  { normal: [0, 1, 0], up: [0, 0, -1] },
  { normal: [0, 0, 1], up: [0, 1, 0] },
  { normal: [1, 0, 0], up: [0, 1, 0] },
  { normal: [-1, 0, 0], up: [0, 1, 0] },
  { normal: [0, 0, -1], up: [0, 1, 0] },
  { normal: [0, -1, 0], up: [0, 0, 1] }
]

function cube(): Solid {
  const points: Vec[] = []
  for (const x of [-0.5, 0.5])
    for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) points.push([x, y, z])
  const faces = CUBE.map(({ normal, up }) => {
    const verts = points.map((p, i) => (dot(p, normal) > 0.4 ? i : -1)).filter((i) => i >= 0)
    return faceOf(points, verts, null, up)
  })
  return { points, faces, upFor: CUBE.map((f) => f.normal) }
}

/** Moneta: un cilindro basso, testa in alto e croce in basso */
function coin(sides: number, thickness: number): Solid {
  const points: Vec[] = []
  for (const y of [thickness / 2, -thickness / 2])
    for (let i = 0; i < sides; i++) {
      const a = (2 * Math.PI * i) / sides
      points.push([0.5 * Math.cos(a), y, 0.5 * Math.sin(a)])
    }
  const top = faceOf(
    points,
    points.map((_, i) => i).filter((i) => i < sides),
    null,
    [0, 0, -1]
  )
  const bottom = faceOf(
    points,
    points.map((_, i) => i).filter((i) => i >= sides),
    null,
    [0, 0, 1]
  )
  return { points, faces: [top, bottom], upFor: [top.normal, bottom.normal] }
}

/** Il solido del dado, scalato perché la prima faccia sia larga quanto il template */
export function dieSolid(
  d: DieType,
  size: { width: number; height: number },
  thickness = 2,
  coinSides = 48
): Solid {
  const raw =
    d === 'd2'
      ? coin(coinSides, thickness / size.width)
      : d === 'd4'
        ? tetra()
        : d === 'd8'
          ? octa()
          : d === 'd10'
            ? trapezo(size.height / size.width)
            : d === 'd12'
              ? dodeca()
              : d === 'd20'
                ? icosa()
                : cube()
  const f0 = raw.faces[0]
  const xs = f0.verts.map((i) => dot(raw.points[i], cross(f0.up, f0.normal)))
  const k = size.width / (Math.max(...xs) - Math.min(...xs))
  return { ...raw, points: raw.points.map((p) => mul(p, k)) }
}

// ——— Rotazioni ———

/**
 * Rotazione (gradi, come gli angoli di Eulero di Unity) che porta verso l'alto la direzione
 * data nel file .obj: prima attorno a Z, poi attorno a X
 */
export function rotationUp(dir: Vec): { x: number; y: number; z: number } {
  // la X del file è la −X del tavolo
  const n = unit([-dir[0], dir[1], dir[2]])
  const deg = (r: number): number => {
    const v = ((((r * 180) / Math.PI) % 360) + 360) % 360
    return (Math.round(v * 1000) / 1000) % 360 || 0
  }
  const z = Math.atan2(n[0], n[1])
  const x = Math.atan2(-n[2], Math.hypot(n[0], n[1]))
  return { x: deg(x), y: 0, z: deg(z) }
}

// ——— Modello .obj ———

/**
 * Il modello del dado con gli spigoli arrotondati: le facce piane portano tutta l'immagine della
 * loro cella, gli spigoli e i vertici prendono il colore del bordo delle facce vicine.
 * `round` è il raggio degli spigoli in rapporto al lato (0 = spigoli vivi).
 */
export function dieObj(
  d: DieType,
  size: { width: number; height: number },
  opts: { thickness?: number; round?: number; segments?: number } = {}
): string {
  const solid = dieSolid(d, size, opts.thickness)
  const { cols, rows } = dieAtlas(d)
  const { points, faces } = solid
  const S = Math.max(1, opts.segments ?? 3)
  // distanza delle facce dal centro: è la stessa per tutte
  const rho = Math.min(...faces.map((f) => dot(points[f.verts[0]], f.normal)))
  const edges = faces.flatMap((f) =>
    f.verts.map((v, i) => len(sub(points[f.verts[(i + 1) % f.verts.length]], points[v])))
  )
  const edge = d === 'd2' ? 0 : Math.min(...edges)
  const r = Math.min((opts.round ?? 0.06) * edge, 0.12 * rho)
  const k = (rho - r) / rho

  // coordinate dell'immagine di ogni vertice di ogni faccia, nella sua cella
  const uvs = faces.map((f, fi) => {
    const right = cross(f.up, f.normal)
    const c = mean(f.verts.map((i) => points[i]))
    const xy = f.verts.map((i) => [dot(sub(points[i], c), right), dot(sub(points[i], c), f.up)])
    const minX = Math.min(...xy.map((p) => p[0]))
    const maxX = Math.max(...xy.map((p) => p[0]))
    const minY = Math.min(...xy.map((p) => p[1]))
    const maxY = Math.max(...xy.map((p) => p[1]))
    const col = fi % cols
    const row = Math.floor(fi / cols)
    const map = xy.map(([x, y]): [number, number] => [
      (col + (x - minX) / (maxX - minX)) / cols,
      1 - (row + 1) / rows + (y - minY) / (maxY - minY) / rows
    ])
    const center: [number, number] = [
      map.reduce((s, p) => s + p[0], 0) / map.length,
      map.reduce((s, p) => s + p[1], 0) / map.length
    ]
    return { map, center }
  })
  // verso il centro della faccia: le facce di poco, i bordi di più, per non prendere il bianco
  const uvAt = (fi: number, vi: number, pull: number): [number, number] => {
    const { map, center } = uvs[fi]
    const p = map[faces[fi].verts.indexOf(vi)]
    return [p[0] + (center[0] - p[0]) * pull, p[1] + (center[1] - p[1]) * pull]
  }

  const f = (n: number): string => String(Math.round(n * 1e5) / 1e5 || 0)
  const vs: string[] = []
  const vts: string[] = []
  const vns: string[] = []
  const fs: string[] = []
  const tri = (
    p: [Vec, Vec, Vec],
    t: [[number, number], [number, number], [number, number]],
    n: [Vec, Vec, Vec]
  ): void => {
    // verso fuori: il solido è convesso e centrato nell'origine
    const out = dot(cross(sub(p[1], p[0]), sub(p[2], p[0])), add(add(p[0], p[1]), p[2])) > 0
    const ids = (out ? [0, 1, 2] : [0, 2, 1]).map((j) => {
      vs.push(`v ${p[j].map(f).join(' ')}`)
      vts.push(`vt ${f(t[j][0])} ${f(t[j][1])}`)
      vns.push(`vn ${n[j].map(f).join(' ')}`)
      const id = vs.length
      return `${id}/${id}/${id}`
    })
    fs.push(`f ${ids.join(' ')}`)
  }
  const inner = (vi: number): Vec => mul(points[vi], k)
  const slerp = (a: Vec, b: Vec, t: number): Vec => {
    const th = Math.acos(Math.max(-1, Math.min(1, dot(a, b))))
    if (th < 1e-6) return a
    const s = Math.sin(th)
    return add(mul(a, Math.sin((1 - t) * th) / s), mul(b, Math.sin(t * th) / s))
  }

  // facce piane
  faces.forEach((face, fi) => {
    const ps = face.verts.map((vi) => add(inner(vi), mul(face.normal, r)))
    const ts = face.verts.map((vi) => uvAt(fi, vi, 0.01))
    for (let j = 1; j + 1 < ps.length; j++)
      tri(
        [ps[0], ps[j], ps[j + 1]],
        [ts[0], ts[j], ts[j + 1]],
        [face.normal, face.normal, face.normal]
      )
  })
  if (d === 'd2') {
    // il bordo della moneta: la metà in alto col colore del bordo della testa, l'altra della croce
    const n = points.length / 2
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      const [t0, t1, b0, b1] = [points[i], points[j], points[n + i], points[n + j]]
      const m0: Vec = [t0[0], 0, t0[2]]
      const m1: Vec = [t1[0], 0, t1[2]]
      const n0 = unit(m0)
      const n1 = unit(m1)
      const ta = uvAt(0, i, 0.04)
      const tb = uvAt(0, j, 0.04)
      tri([t0, t1, m1], [ta, tb, tb], [n0, n1, n1])
      tri([t0, m1, m0], [ta, tb, ta], [n0, n1, n0])
      const ba = uvAt(1, n + i, 0.04)
      const bb = uvAt(1, n + j, 0.04)
      tri([m0, m1, b1], [ba, bb, bb], [n0, n1, n1])
      tri([m0, b1, b0], [ba, bb, ba], [n0, n1, n0])
    }
    return finish(d, vs, vts, vns, fs)
  }
  if (r <= 0) return finish(d, vs, vts, vns, fs)

  // spigoli: ogni coppia di facce vicine
  const owners = new Map<string, number[]>()
  faces.forEach((face, fi) =>
    face.verts.forEach((v, i) => {
      const w = face.verts[(i + 1) % face.verts.length]
      const key = v < w ? `${v}-${w}` : `${w}-${v}`
      owners.set(key, [...(owners.get(key) ?? []), fi])
    })
  )
  for (const [key, [A, B]] of owners) {
    if (B === undefined) continue
    const [va, vb] = key.split('-').map(Number)
    const nA = faces[A].normal
    const nB = faces[B].normal
    for (let i = 0; i < S; i++) {
      const d0 = slerp(nA, nB, i / S)
      const d1 = slerp(nA, nB, (i + 1) / S)
      const own = (i + 0.5) / S < 0.5 ? A : B
      const a0 = add(inner(va), mul(d0, r))
      const b0 = add(inner(vb), mul(d0, r))
      const a1 = add(inner(va), mul(d1, r))
      const b1 = add(inner(vb), mul(d1, r))
      const ta = uvAt(own, va, 0.04)
      const tb = uvAt(own, vb, 0.04)
      tri([a0, b0, b1], [ta, tb, tb], [d0, d0, d1])
      tri([a0, b1, a1], [ta, tb, ta], [d0, d1, d1])
    }
  }
  // vertici: un ventaglio tra le facce che vi si toccano
  points.forEach((p, vi) => {
    const around = faces
      .map((face, fi) => (face.verts.includes(vi) ? fi : -1))
      .filter((x) => x >= 0)
    if (around.length < 3) return
    const axis = unit(p)
    const e1 = unit(sub(faces[around[0]].normal, mul(axis, dot(faces[around[0]].normal, axis))))
    const e2 = cross(axis, e1)
    const ang = (fi: number): number => {
      const n = faces[fi].normal
      return Math.atan2(dot(n, e2), dot(n, e1))
    }
    around.sort((a, b) => ang(a) - ang(b))
    const ring: { dir: Vec; own: number }[] = []
    around.forEach((fi, j) => {
      const next = around[(j + 1) % around.length]
      ring.push({ dir: faces[fi].normal, own: fi })
      for (let t = 1; t < S; t++)
        ring.push({
          dir: slerp(faces[fi].normal, faces[next].normal, t / S),
          own: t / S < 0.5 ? fi : next
        })
    })
    const mid = unit(around.reduce((s, fi) => add(s, faces[fi].normal), [0, 0, 0] as Vec))
    const q = inner(vi)
    const center = add(q, mul(mid, r))
    ring.forEach((b, j) => {
      const c = ring[(j + 1) % ring.length]
      const t = uvAt(b.own, vi, 0.04)
      tri([center, add(q, mul(b.dir, r)), add(q, mul(c.dir, r))], [t, t, t], [mid, b.dir, c.dir])
    })
  })
  return finish(d, vs, vts, vns, fs)
}

function finish(d: DieType, vs: string[], vts: string[], vns: string[], fs: string[]): string {
  return [`# Stella: dado ${d}`, 'o die', ...vs, ...vts, ...vns, ...fs].join('\n') + '\n'
}

/**
 * Il solido per gli urti: spigoli vivi e pochi triangoli. Unity accetta collisori convessi fino a
 * 255 triangoli: oltre semplifica il modello e il dado si posa male (su uno spigolo o una punta)
 */
export function dieColliderObj(
  d: DieType,
  size: { width: number; height: number },
  thickness = 2
): string {
  const { points, faces } = dieSolid(d, size, thickness, 24)
  const f = (n: number): string => String(Math.round(n * 1e5) / 1e5 || 0)
  const fs: string[] = []
  for (const face of faces)
    for (let j = 1; j + 1 < face.verts.length; j++)
      fs.push(`f ${face.verts[0] + 1} ${face.verts[j] + 1} ${face.verts[j + 1] + 1}`)
  if (d === 'd2') {
    // il bordo della moneta
    const n = points.length / 2
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      fs.push(`f ${i + 1} ${n + j + 1} ${j + 1}`, `f ${i + 1} ${n + i + 1} ${n + j + 1}`)
    }
  }
  return (
    [
      `# Stella: urti del dado ${d}`,
      'o collider',
      ...points.map((p) => `v ${p.map(f).join(' ')}`),
      ...fs
    ].join('\n') + '\n'
  )
}
