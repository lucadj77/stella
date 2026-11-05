import type { KindPreset } from './kinds'
import type { CardShape, Template } from './template'

// Dadi: il tipo di dado di un template di tipo faccia di dado (campo `die`) decide la forma della
// faccia, quante righe del set fanno un dado e come si esporta. Assente vale d6, così i progetti
// di prima della 1.10 non cambiano. Vedi docs/formato.md.

export const DIE_TYPES = ['d2', 'd3', 'd4', 'd6', 'd8', 'd10', 'd12', 'd20'] as const
export type DieType = (typeof DIE_TYPES)[number]
export const isDieType = (v: unknown): v is DieType =>
  typeof v === 'string' && (DIE_TYPES as readonly string[]).includes(v)

/** Il dado di un template di tipo faccia di dado (d6 se non è indicato); null per gli altri tipi */
export function dieOf(t: Pick<Template, 'kind' | 'die'> | null | undefined): DieType | null {
  if (t?.kind !== 'die') return null
  return t.die ?? 'd6'
}

/** Righe del set che fanno un dado: una per faccia (il d3 ne ha tre, ognuna su due facce) */
export const DIE_ROWS: Record<DieType, number> = {
  d2: 2,
  d3: 3,
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20
}

/** Dadi che sono un cubo: si esportano come il d6 (sviluppo a croce, modello del cubo) */
export const isCubeDie = (d: DieType | null | undefined): boolean => d === 'd6' || d === 'd3'

/** Forma della faccia; per il d6 e il d3 resta quella scelta nel template */
export type DieFaceShape = 'circle' | 'square' | 'triangle' | 'kite' | 'pentagon'
export const DIE_FACE_SHAPE: Record<DieType, DieFaceShape> = {
  d2: 'circle',
  d3: 'square',
  d4: 'triangle',
  d6: 'square',
  d8: 'triangle',
  d10: 'kite',
  d12: 'pentagon',
  d20: 'triangle'
}

/** Il dado decide la forma: per questi i controlli della forma nel template non ci sono */
export const dieOwnsShape = (d: DieType | null | undefined): boolean => !!d && !isCubeDie(d)

const TRIANGLE = Math.sqrt(3) / 2
// pentagono regolare con la punta in alto: alto 0,951 volte la larghezza
const PENTAGON = (1 + Math.cos(Math.PI / 5)) / (2 * Math.sin((2 * Math.PI) / 5))

/** Proporzione fissa della faccia (altezza / larghezza); null per il d10, che è libero */
export function dieRatio(d: DieType): number | null {
  switch (DIE_FACE_SHAPE[d]) {
    case 'triangle':
      return TRIANGLE
    case 'pentagon':
      return PENTAGON
    case 'kite':
      return null
    default:
      return 1
  }
}

/** Il d10 sta tra 1 e 2 volte la larghezza: oltre l'aquilone è troppo piatto o troppo lungo */
export const KITE_MIN = 1
export const KITE_MAX = 2
/** Proporzione proposta del d10: simile ai d10 in commercio */
export const KITE_DEFAULT = 1.25

/** Altezza della faccia data la larghezza: fissa per tutti tranne il d10, che resta nei limiti */
export function dieHeight(d: DieType, width: number, height: number): number {
  const r = dieRatio(d)
  const round = (v: number): number => Math.round(v * 100) / 100
  if (r !== null) return round(width * r)
  return round(Math.min(KITE_MAX * width, Math.max(KITE_MIN * width, height)))
}

/** Formati proposti per ogni dado; misure in mm, la larghezza è quella vera della faccia */
export function diePresets(d: DieType): KindPreset[] {
  const tri = (key: string, side: number): KindPreset => ({
    key,
    width: side,
    height: dieHeight(d, side, side)
  })
  switch (d) {
    case 'd2':
      return [
        { key: 'coin20', width: 20, height: 20, shape: 'ellipse' },
        { key: 'coin25', width: 25, height: 25, shape: 'ellipse' },
        { key: 'coin30', width: 30, height: 30, shape: 'ellipse' }
      ]
    case 'd3':
    case 'd6':
      return [
        { key: 'face16', width: 16, height: 16 },
        { key: 'face19', width: 19, height: 19 },
        { key: 'face25', width: 25, height: 25 }
      ]
    case 'd4':
      return [tri('side20', 20), tri('side25', 25), tri('side30', 30)]
    case 'd8':
      return [tri('side18', 18), tri('side22', 22), tri('side25', 25)]
    case 'd10':
      return [
        { key: 'kite16', width: 16, height: 20 },
        { key: 'kite20', width: 20, height: 25 }
      ]
    case 'd12':
      return [tri('width18', 18), tri('width22', 22), tri('width26', 26)]
    case 'd20':
      return [tri('side15', 15), tri('side18', 18), tri('side22', 22)]
  }
}

// ——— Geometria del d10 ———

/**
 * Aquilone del d10 (trapezoedro pentagonale) con il vertice di mezzo a quota ±c, raggio 1:
 * larghezza, altezza e distanza dalla punta della linea tra i due vertici laterali.
 * La punta in alto sta sull'asse; le facce restano piane per qualsiasi c.
 */
export function kiteGeometry(c: number): { w: number; h: number; mid: number; apex: number } {
  const a36 = Math.PI / 5
  const a72 = (2 * Math.PI) / 5
  const u0 = [1, 0, c]
  const l0 = [Math.cos(a36), Math.sin(a36), -c]
  const u1 = [Math.cos(a72), Math.sin(a72), c]
  const sub = (p: number[], q: number[]): number[] => p.map((v, i) => v - q[i])
  const cross = (p: number[], q: number[]): number[] => [
    p[1] * q[2] - p[2] * q[1],
    p[2] * q[0] - p[0] * q[2],
    p[0] * q[1] - p[1] * q[0]
  ]
  const dot = (p: number[], q: number[]): number => p.reduce((s, v, i) => s + v * q[i], 0)
  const len = (p: number[]): number => Math.sqrt(dot(p, p))
  const n = cross(sub(l0, u0), sub(u1, u0))
  // la punta (0, 0, apex) sta sul piano dei tre vertici
  const apex = dot(n, u0) / n[2]
  const t = [0, 0, apex]
  const m = u0.map((v, i) => (v + u1[i]) / 2)
  return { w: len(sub(u1, u0)), h: len(sub(t, l0)), mid: len(sub(m, t)), apex }
}

/** La quota c del d10 che dà la proporzione altezza / larghezza voluta */
export function kiteHeightParam(ratio: number): number {
  const r = Math.min(KITE_MAX, Math.max(KITE_MIN, ratio))
  // h / w cresce con c: si cerca per bisezione
  let lo = 0.001
  let hi = 1
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    const g = kiteGeometry(mid)
    if (g.h / g.w < r) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Vertici della faccia in coordinate 0-1 del riquadro della carta, in senso orario */
export function dieUnitPolygon(d: DieType, width: number, height: number): [number, number][] {
  switch (DIE_FACE_SHAPE[d]) {
    case 'triangle':
      return [
        [0.5, 0],
        [1, 1],
        [0, 1]
      ]
    case 'pentagon': {
      // punta in alto; i vertici laterali a 0,382 dell'altezza, la base larga 0,618 del lato
      const R = 1 / (2 * Math.sin((2 * Math.PI) / 5))
      const h = R * (1 + Math.cos(Math.PI / 5))
      const side = (R * (1 - Math.cos((2 * Math.PI) / 5))) / h
      const foot = R * Math.sin(Math.PI / 5)
      return [
        [0.5, 0],
        [1, side],
        [0.5 + foot, 1],
        [0.5 - foot, 1],
        [0, side]
      ]
    }
    case 'kite': {
      const g = kiteGeometry(kiteHeightParam(height / width))
      const y = g.mid / g.h
      return [
        [0.5, 0],
        [1, y],
        [0.5, 1],
        [0, y]
      ]
    }
    case 'circle':
    case 'square':
      return [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1]
      ]
  }
}

const num = (v: number): string => String(Math.round(v * 1e5) / 1e5)

/** Forma da scrivere nel template per il dado: il d6 e il d3 tengono la loro */
export function dieShape(
  d: DieType,
  width: number,
  height: number
): { shape?: CardShape; shapePath?: string } | null {
  if (isCubeDie(d)) return null
  if (d === 'd2') return { shape: 'ellipse', shapePath: undefined }
  const pts = dieUnitPolygon(d, width, height)
  return {
    shape: 'path',
    shapePath: `M${pts.map(([x, y]) => `${num(x)} ${num(y)}`).join('L')}Z`
  }
}

/**
 * Proprietà del template per un dado: tipo, misure con la proporzione giusta e forma. Il d6 resta
 * senza `die`, come nei file di prima
 */
export function applyDie(t: Template, d: DieType, width = t.width, height = t.height): Template {
  const h = dieHeight(d, width, height)
  const shape = dieShape(d, width, h)
  const out: Template = { ...t, kind: 'die', die: d === 'd6' ? undefined : d, width, height: h }
  if (shape) {
    out.shape = shape.shape
    out.shapePath = shape.shapePath
    out.shapeRotation = undefined
    out.shapeFlipH = undefined
    out.shapeFlipV = undefined
  } else if (t.die && !isCubeDie(t.die)) {
    // da un dado con la forma sua a un cubo: torna il quadrato
    out.shape = undefined
    out.shapePath = undefined
  }
  return out
}

// ——— Facce e righe ———

/**
 * Le sei facce di un dado cubico dalle sue righe: per il d6 una riga per faccia, per il d3 ogni
 * riga su due facce opposte (1-6, 2-5, 3-4). Se mancano righe si ripetono le prime
 */
export function cubeFaces<T>(rows: T[], d: DieType): T[] {
  const order = d === 'd3' ? [0, 1, 2, 2, 1, 0] : [0, 1, 2, 3, 4, 5]
  return order.map((k) => rows[k % rows.length])
}

/**
 * Vertici del d4: per ogni faccia (riga 1-4 del dado) le righe che danno il valore ai vertici in
 * alto, in basso a sinistra e in basso a destra. Il vertice in alto è quello della riga stessa;
 * gli altri due vengono dalle facce che li condividono, così che a dado chiuso ogni vertice porti
 * lo stesso numero sulle tre facce che vi si toccano (giro antiorario visto da fuori).
 */
export const D4_CORNERS: [number, number, number][] = [
  [0, 2, 3],
  [1, 3, 2],
  [2, 0, 1],
  [3, 1, 0]
]

/**
 * I valori dei tre vertici della faccia della riga `number` (da 1) di un set di d4, presi dai
 * valori delle righe. Righe che mancano all'ultimo dado danno un vertice vuoto
 */
export function d4Corners(values: string[], number: number): [string, string, string] {
  const i = number - 1
  const base = i - (i % 4)
  const local = i % 4
  return D4_CORNERS[local].map((k) => values[base + k] ?? '') as [string, string, string]
}

/** Raggruppa le righe di un set in dadi del tipo indicato */
export function dieGroups<T>(rows: T[], d: DieType): T[][] {
  const n = DIE_ROWS[d]
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += n) out.push(rows.slice(i, i + n))
  return out
}

// ——— Poligoni ———

/**
 * Poligono convesso rientrato della stessa distanza su ogni lato (negativa: allargato). I vertici
 * vanno in un verso qualsiasi; se il rientro è troppo grande il poligono si chiude nel centro
 */
export function insetPolygon(points: [number, number][], d: number): [number, number][] {
  const n = points.length
  if (n < 3 || !d) return points
  const area = points.reduce((s, [x, y], i) => {
    const [x2, y2] = points[(i + 1) % n]
    return s + x * y2 - x2 * y
  }, 0)
  const sign = area > 0 ? 1 : -1
  // ogni lato spostato verso l'interno
  const lines = points.map(([x1, y1], i) => {
    const [x2, y2] = points[(i + 1) % n]
    const len = Math.hypot(x2 - x1, y2 - y1) || 1
    // normale verso l'interno: con l'area positiva (y verso il basso, senso orario) è (-dy, dx)
    const nx = (-(y2 - y1) / len) * sign
    const ny = ((x2 - x1) / len) * sign
    return { x1: x1 + nx * d, y1: y1 + ny * d, x2: x2 + nx * d, y2: y2 + ny * d }
  })
  const out = lines.map((a, i) => {
    const b = lines[(i + n - 1) % n]
    const dax = a.x2 - a.x1
    const day = a.y2 - a.y1
    const dbx = b.x2 - b.x1
    const dby = b.y2 - b.y1
    const den = dbx * day - dby * dax
    if (Math.abs(den) < 1e-12) return [a.x1, a.y1] as [number, number]
    const t = ((a.x1 - b.x1) * day - (a.y1 - b.y1) * dax) / den
    return [b.x1 + t * dbx, b.y1 + t * dby] as [number, number]
  })
  // rientro oltre il centro: qualche lato si è girato
  const flipped = out.some(([x, y], i) => {
    const [x2, y2] = out[(i + 1) % n]
    const [px, py] = points[i]
    const [qx, qy] = points[(i + 1) % n]
    return (x2 - x) * (qx - px) + (y2 - y) * (qy - py) < 0
  })
  if (d > 0 && flipped) {
    const cx = points.reduce((s, p) => s + p[0], 0) / n
    const cy = points.reduce((s, p) => s + p[1], 0) / n
    return points.map(() => [cx, cy])
  }
  return out
}

/** Un tracciato fatto solo di segmenti (M, L, Z con numeri) come poligono; null altrimenti */
export function pathPolygon(path: string | undefined): [number, number][] | null {
  const p = path?.trim()
  if (!p || !/^M[\d\s.,eE+-]+(L[\d\s.,eE+-]+)+Z?$/i.test(p)) return null
  const nums = p
    .replace(/[MLZ]/gi, ' ')
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  if (nums.length < 6 || nums.length % 2 || nums.some((v) => !Number.isFinite(v))) return null
  const out: [number, number][] = []
  for (let i = 0; i < nums.length; i += 2) out.push([nums[i], nums[i + 1]])
  return out
}

/** Il contorno della faccia di un dado in mm, se il dado ne ha uno suo (non d6, d3, d2) */
export function dieOutline(t: Template): [number, number][] | null {
  const d = dieOf(t)
  if (!d || !dieOwnsShape(d) || d === 'd2') return null
  return dieUnitPolygon(d, t.width, t.height).map(([x, y]) => [x * t.width, y * t.height])
}

// ——— Template di partenza ———

/** Centro della faccia, dove va il numero, in mm */
function faceCenter(d: DieType, w: number, h: number): [number, number] {
  switch (DIE_FACE_SHAPE[d]) {
    case 'triangle':
      return [w / 2, (2 * h) / 3]
    case 'pentagon':
      return [w / 2, h * 0.55]
    case 'kite': {
      const y = dieUnitPolygon(d, w, h)[1][1]
      return [w / 2, h * Math.max(0.35, y)]
    }
    default:
      return [w / 2, h / 2]
  }
}

/**
 * Livelli con cui nasce una faccia di dado, sopra lo sfondo: il numero al centro, letto dalla
 * colonna `value`. Il d4 ha invece un livello Valore `value` e i tre numeri ai vertici, già
 * ruotati verso il centro, che leggono {die.corner1}, {die.corner2} e {die.corner3}
 */
export function dieStarterLayers(d: DieType, w: number, h: number): Record<string, unknown>[] {
  const text = {
    type: 'text',
    weight: 700,
    color: '#1A1A1A',
    align: 'center',
    valign: 'middle',
    fit: 'shrink'
  }
  if (d === 'd4') {
    const pts: [number, number][] = [
      [w / 2, 0],
      [0, h],
      [w, h]
    ]
    const g: [number, number] = [w / 2, (2 * h) / 3]
    const box = Math.round(w * 0.3 * 10) / 10
    const size = Math.max(6, Math.round(w * 0.55))
    return [
      { type: 'value', name: 'value', x: 0, y: 0, w: 5, h: 5, value: '1' },
      ...pts.map(([px, py], i) => {
        const cx = px + (g[0] - px) * 0.42
        const cy = py + (g[1] - py) * 0.42
        return {
          ...text,
          name: `corner${i + 1}`,
          text: `{die.corner${i + 1}}`,
          source: { kind: 'fixed' },
          size,
          x: Math.round((cx - box / 2) * 100) / 100,
          y: Math.round((cy - box / 2) * 100) / 100,
          w: box,
          h: box,
          rotation: [0, -120, 120][i]
        }
      })
    ]
  }
  const [cx, cy] = faceCenter(d, w, h)
  const tri = DIE_FACE_SHAPE[d] === 'triangle'
  const bw = Math.round(w * (tri ? 0.5 : 0.7) * 10) / 10
  const bh = Math.round(Math.min(h * 0.5, bw) * 10) / 10
  return [
    {
      ...text,
      name: 'value',
      text: '1',
      size: Math.max(6, Math.round(Math.min(w, h) * (tri ? 0.6 : 0.9))),
      x: Math.round((cx - bw / 2) * 100) / 100,
      y: Math.round((cy - bh / 2) * 100) / 100,
      w: bw,
      h: bh
    }
  ]
}

/**
 * Un foglio nuovo per un set di facce di dado: un dado già pronto, una riga per faccia con i
 * valori da 1 a N nella colonna che dà il nome alle carte (o in `value`, se c'è)
 */
export function dieSheet<S extends { headers: string[]; rows: string[][] }>(
  sheet: S,
  t: Template | null
): S {
  const d = dieOf(t)
  if (!d || sheet.rows.length) return sheet
  const field = t?.labelField && sheet.headers.includes(t.labelField) ? t.labelField : 'value'
  const col = sheet.headers.indexOf(field)
  if (col < 0) return sheet
  const amount = sheet.headers.indexOf('amount')
  const rows = Array.from({ length: DIE_ROWS[d] }, (_, k) =>
    sheet.headers.map((_, j) => (j === col ? String(k + 1) : j === amount ? '1' : ''))
  )
  return { ...sheet, rows }
}
