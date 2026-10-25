import type { GridLayer } from './template'

// Geometria del livello griglia: dove stanno le caselle dentro il riquadro, in mm dall'angolo in
// alto a sinistra del livello. Le caselle sono tutte uguali; `s` è la loro altezza, e la si
// sceglie perché la griglia stia nel riquadro (zoom 1, cioè 100%) senza deformare le caselle.

export type GridSpec = Pick<
  GridLayer,
  | 'w'
  | 'h'
  | 'cell'
  | 'rows'
  | 'columns'
  | 'cellRatio'
  | 'orientation'
  | 'interlock'
  | 'gap'
  | 'padding'
  | 'zoom'
  | 'alignX'
  | 'alignY'
  | 'radius'
>

export interface GridGeometry {
  /** Tracciato SVG di ogni casella, riga per riga */
  cells: string[]
  /** Riquadro dello sfondo: le caselle più il margine interno */
  bounds: { x: number; y: number; w: number; h: number }
  /** Centro di ogni casella, nello stesso ordine */
  centers: { x: number; y: number }[]
  /** Misura di una casella in mm */
  cell: { w: number; h: number }
}

/** Limite alle caselle, per non bloccare il disegno con un numero sbagliato nel foglio */
export const MAX_CELLS = 400

/** Righe e colonne usate, dentro il limite delle caselle */
export function gridSize(g: Pick<GridLayer, 'rows' | 'columns'>): {
  rows: number
  columns: number
} {
  const rows = Math.min(MAX_CELLS, Math.max(1, Math.round(g.rows) || 1))
  const columns = Math.min(Math.floor(MAX_CELLS / rows), Math.max(1, Math.round(g.columns) || 1))
  return { rows, columns }
}

const R3 = Math.sqrt(3)

interface Placed {
  cx: number
  cy: number
  /** Triangolo con la punta in basso */
  down?: boolean
}

/** Misura della casella per un'altezza s */
function cellSize(g: GridSpec, s: number): { w: number; h: number } {
  const r = g.cellRatio > 0 ? g.cellRatio : 1
  switch (g.cell) {
    case 'hex':
      return g.orientation === 'flat' ? { w: s, h: (s * R3) / 2 } : { w: (s * R3) / 2, h: s }
    case 'triangle':
      return { w: (2 * s) / R3, h: s }
    default:
      return { w: r * s, h: s }
  }
}

/** Centri delle caselle per un'altezza s, prima di spostarle nel riquadro */
function place(g: GridSpec, s: number): Placed[] {
  const { w, h } = cellSize(g, s)
  const gap = Math.max(0, g.gap)
  const { rows, columns: cols } = gridSize(g)
  const out: Placed[] = []
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      if (!g.interlock) {
        out.push({ cx: j * (w + gap), cy: i * (h + gap) })
        continue
      }
      const odd = i % 2 === 1
      switch (g.cell) {
        case 'hex':
          if (g.orientation === 'flat')
            out.push({
              cx: j * (w * 0.75 + (gap * R3) / 2),
              cy: i * (h + gap) + (j % 2 === 1 ? (h + gap) / 2 : 0)
            })
          else
            out.push({
              cx: j * (w + gap) + (odd ? (w + gap) / 2 : 0),
              cy: i * (h * 0.75 + (gap * R3) / 2)
            })
          break
        case 'triangle':
          // punte alternate, in su e in giù, che si toccano sui lati obliqui
          out.push({ cx: j * (w / 2 + (2 * gap) / R3), cy: i * (h + gap), down: (i + j) % 2 === 1 })
          break
        case 'diamond': {
          // i rombi delle righe dispari stanno negli spazi tra quelli delle righe pari
          const len = Math.hypot(w, h)
          const dx = w / 2 + (gap * h) / len
          const dy = h / 2 + (gap * w) / len
          out.push({ cx: j * 2 * dx + (odd ? dx : 0), cy: i * dy })
          break
        }
        case 'circle':
          out.push({
            cx: j * (w + gap) + (odd ? (w + gap) / 2 : 0),
            cy: (i * (h + gap) * R3) / 2
          })
          break
        default:
          // quadrati a mattoncino
          out.push({ cx: j * (w + gap) + (odd ? (w + gap) / 2 : 0), cy: i * (h + gap) })
      }
    }
  return out
}

/** Ingombro delle caselle per un'altezza s */
function extent(g: GridSpec, s: number): { x: number; y: number; w: number; h: number } {
  const { w, h } = cellSize(g, s)
  const cells = place(g, s)
  const xs = cells.map((c) => c.cx)
  const ys = cells.map((c) => c.cy)
  const x = Math.min(...xs) - w / 2
  const y = Math.min(...ys) - h / 2
  return { x, y, w: Math.max(...xs) + w / 2 - x, h: Math.max(...ys) + h / 2 - y }
}

const n = (v: number): string => String(Math.round(v * 1000) / 1000)

/** Poligono con gli angoli arrotondati di raggio r (ridotto se i lati sono corti) */
function roundedPolygon(points: [number, number][], r: number): string {
  if (r <= 0) return `M${points.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}Z`
  const k = points.length
  let d = ''
  for (let i = 0; i < k; i++) {
    const [px, py] = points[(i - 1 + k) % k]
    const [x, y] = points[i]
    const [nx, ny] = points[(i + 1) % k]
    const a = Math.hypot(px - x, py - y)
    const b = Math.hypot(nx - x, ny - y)
    // il taglio sui due lati, non oltre metà lato: angoli vicini non si sovrappongono
    const cut = Math.min(r, a / 2, b / 2)
    const sx = x + ((px - x) / a) * cut
    const sy = y + ((py - y) / a) * cut
    const ex = x + ((nx - x) / b) * cut
    const ey = y + ((ny - y) / b) * cut
    d += `${i ? 'L' : 'M'}${n(sx)} ${n(sy)}Q${n(x)} ${n(y)} ${n(ex)} ${n(ey)}`
  }
  return d + 'Z'
}

/** Tracciato di una casella centrata in cx, cy */
function cellPath(g: GridSpec, c: Placed, w: number, h: number): string {
  const { cx, cy } = c
  const r = Math.max(0, g.radius)
  switch (g.cell) {
    case 'circle': {
      const rx = w / 2
      const ry = h / 2
      return `M${n(cx - rx)} ${n(cy)}A${n(rx)} ${n(ry)} 0 1 0 ${n(cx + rx)} ${n(cy)}A${n(rx)} ${n(ry)} 0 1 0 ${n(cx - rx)} ${n(cy)}Z`
    }
    case 'hex':
      return roundedPolygon(
        g.orientation === 'flat'
          ? [
              [cx - w / 2, cy],
              [cx - w / 4, cy - h / 2],
              [cx + w / 4, cy - h / 2],
              [cx + w / 2, cy],
              [cx + w / 4, cy + h / 2],
              [cx - w / 4, cy + h / 2]
            ]
          : [
              [cx, cy - h / 2],
              [cx + w / 2, cy - h / 4],
              [cx + w / 2, cy + h / 4],
              [cx, cy + h / 2],
              [cx - w / 2, cy + h / 4],
              [cx - w / 2, cy - h / 4]
            ],
        r
      )
    case 'triangle':
      return roundedPolygon(
        c.down
          ? [
              [cx - w / 2, cy - h / 2],
              [cx + w / 2, cy - h / 2],
              [cx, cy + h / 2]
            ]
          : [
              [cx, cy - h / 2],
              [cx + w / 2, cy + h / 2],
              [cx - w / 2, cy + h / 2]
            ],
        r
      )
    case 'diamond':
      return roundedPolygon(
        [
          [cx, cy - h / 2],
          [cx + w / 2, cy],
          [cx, cy + h / 2],
          [cx - w / 2, cy]
        ],
        r
      )
    default:
      return roundedPolygon(
        [
          [cx - w / 2, cy - h / 2],
          [cx + w / 2, cy - h / 2],
          [cx + w / 2, cy + h / 2],
          [cx - w / 2, cy + h / 2]
        ],
        Math.min(r, w / 2, h / 2)
      )
  }
}

/** Le caselle della griglia e il riquadro dello sfondo, in mm nel riquadro del livello */
export function gridGeometry(g: GridSpec): GridGeometry {
  const pad = Math.max(0, g.padding)
  // l'ingombro cresce in modo lineare con s: due misure bastano per trovare la s che ci sta
  const e1 = extent(g, 1)
  const e2 = extent(g, 2)
  const fit = (room: number, a: number, b: number): number =>
    b - a > 0 ? (room - (2 * a - b)) / (b - a) : Infinity
  const fitted = Math.min(fit(g.w - 2 * pad, e1.w, e2.w), fit(g.h - 2 * pad, e1.h, e2.h))
  const s = Math.max(0, Number.isFinite(fitted) ? fitted : 0) * Math.max(0, g.zoom)
  const { w, h } = cellSize(g, s)
  const e = extent(g, s)
  const bw = e.w + 2 * pad
  const bh = e.h + 2 * pad
  const at = (align: GridSpec['alignX'], room: number, size: number): number =>
    align === 'start' ? 0 : align === 'end' ? room - size : (room - size) / 2
  const bx = at(g.alignX, g.w, bw)
  const by = at(g.alignY, g.h, bh)
  // le caselle partono dall'angolo dello sfondo più il margine
  const dx = bx + pad - e.x
  const dy = by + pad - e.y
  const placed = s > 0 ? place(g, s).map((c) => ({ ...c, cx: c.cx + dx, cy: c.cy + dy })) : []
  return {
    cells: placed.map((c) => cellPath(g, c, w, h)),
    bounds: { x: bx, y: by, w: bw, h: bh },
    centers: placed.map((c) => ({ x: c.cx, y: c.cy })),
    cell: { w, h }
  }
}
