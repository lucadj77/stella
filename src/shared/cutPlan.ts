// Esportazione per plotter da taglio (Cricut, Silhouette, Brother, ...): i componenti si
// impaginano come nel PDF, ma in un'area grande quanto quella in cui il programma del plotter
// stampa e taglia; ogni foglio diventa un PNG trasparente fuori dai componenti (Cricut Design
// Space ricava il taglio dai bordi del PNG) e i tracciati di taglio e piega diventano SVG e DXF
// con lo stesso riquadro. Vedi docs/specifica.md, sezione 9.

import { FillRule, unionD, type PathsD } from 'clipper2-ts'
import {
  DEFAULT_PDF,
  safeName,
  type CutOptions,
  type ExportSet,
  type PdfOptions,
  type SceneItem,
  type SceneLine,
  type ScenePage
} from './export'
import { planPdf } from './exportPlan'
import type { Message } from './messages'
import { flattenPath, ringsBounds } from './model/combine'
import { hexagonPoints, type Point } from './model/geometry'
import type { Template } from './model/template'

/** Distanza massima tra una curva e i segmenti che la sostituiscono, in mm */
const FLATNESS = 0.01
/** Cifre decimali di Clipper2: il micrometro */
const PRECISION = 3
/** Design Space legge le unità degli SVG come pixel a 72 per pollice, e ignora i mm */
export const SVG_PX_PER_MM = 72 / 25.4

export interface CutSheet {
  /** Nome dei file senza estensione, con le misure: «sheet-01 (18.29 x 26.97 cm)» */
  name: string
  /** La pagina ritagliata sui componenti, senza linee: si disegna nel PNG */
  page: ScenePage
  /** Contorni da tagliare in mm (esterni e fori), dall'angolo in alto a sinistra del foglio */
  cut: Point[][]
  /** Pieghe da cordonare */
  folds: SceneLine[]
  /** Misure del foglio ritagliato, in mm */
  width: number
  height: number
}

export interface CutPlan {
  /** Cartella dei file, dentro quella dell'esportazione */
  folder: string
  sheets: CutSheet[]
  /** Set con componenti più grandi dell'area */
  overflow: string[]
  notes: Message[]
}

/** Le opzioni del PDF con cui si impagina nell'area del plotter */
export function cutPdfOptions(o: CutOptions): PdfOptions {
  return {
    ...DEFAULT_PDF,
    sets: o.sets,
    copies: o.copies,
    folder: o.folder,
    page: 'custom',
    pageWidth: o.areaWidth,
    pageHeight: o.areaHeight,
    landscape: o.areaWidth > o.areaHeight,
    margin: 0,
    spacing: Math.max(0, o.spacing),
    layout: 'auto',
    bleed: false,
    // gli angoli arrotondati e le forme dei template: il PNG è trasparente fuori dalla forma
    rounded: true,
    marks: 'none',
    sides: 'front',
    duplex: 'none',
    split: 'single',
    autoRotate: true,
    poster: false,
    fold: o.fold,
    proof: false,
    cmyk: false,
    // set di misure diverse sullo stesso foglio, uno dopo l'altro
    continuous: true,
    dice: 'net',
    tabDepth: o.tabDepth,
    ink: 'color'
  }
}

/** Una misura in cm per i nomi e le istruzioni: 18.29 o 18,29 secondo la lingua */
export function cm(mm: number, locale = 'en'): string {
  return (Math.round(mm * 10) / 100).toLocaleString(locale, {
    maximumFractionDigits: 2,
    useGrouping: false
  })
}

export function planCut(o: CutOptions, sets: ExportSet[], project: string, locale = 'en'): CutPlan {
  const straight = planPdf(cutPdfOptions(o), sets, project)
  let { overflow, notes } = straight
  let pages = straight.docs.flatMap((d) => d.pages)
  // le coppie da piegare non si ruotano nella griglia: si prova l'area girata e si girano i fogli
  if (o.fold && o.areaWidth !== o.areaHeight) {
    const turned = planPdf(
      cutPdfOptions({ ...o, areaWidth: o.areaHeight, areaHeight: o.areaWidth }),
      sets,
      project
    )
    const turnedPages = turned.docs.flatMap((d) => d.pages)
    if (
      turned.overflow.length <= overflow.length &&
      turnedPages.length < pages.length &&
      turnedPages.every((pg) => pg.items.every(plainItem))
    ) {
      ;({ overflow, notes } = turned)
      pages = turnedPages.map(turnPage)
    }
  }
  const digits = Math.max(2, String(pages.length).length)
  const sheets: CutSheet[] = []
  pages.forEach((p) => {
    const sheet = cropSheet(p)
    if (!sheet) return
    const n = String(sheets.length + 1).padStart(digits, '0')
    sheets.push({
      ...sheet,
      name: `sheet-${n} (${cm(sheet.width, locale)} x ${cm(sheet.height, locale)} cm)`
    })
  })
  return { folder: `${safeName(project || 'cards')}_plotter`, sheets, overflow, notes }
}

const plainItem = (it: SceneItem): boolean =>
  !it.rotate && !it.matrix && !it.flip && !it.clip && (it.zoom ?? 1) === 1

/** La pagina girata di 90° in senso orario: il punto x, y va in H − y, x */
function turnPage(p: ScenePage): ScenePage {
  const H = p.height
  const turn = (l: SceneLine): SceneLine => ({
    ...l,
    x1: H - l.y1,
    y1: l.x1,
    x2: H - l.y2,
    y2: l.x2
  })
  return {
    width: p.height,
    height: p.width,
    items: p.items.map((it) => {
      // senza abbondanza nelle coppie non c'è nulla da nascondere ai lati
      return {
        ...it,
        crop: undefined,
        x: H - it.y - it.template.height,
        y: it.x,
        matrix: [0, 1, -1, 0, H - it.y, it.x]
      }
    }),
    lines: (p.lines ?? []).map(turn),
    ...(p.folds ? { folds: p.folds.map(turn) } : {}),
    ...(p.shapes?.length
      ? {
          shapes: p.shapes.map((sh) => ({
            ...sh,
            points: sh.points.map(([x, y]) => [H - y, x] as [number, number])
          }))
        }
      : {})
  }
}

/** La pagina ritagliata sul riquadro dei componenti, con i contorni e le pieghe */
function cropSheet(p: ScenePage): Omit<CutSheet, 'name'> | null {
  const shapes: PathsD[] = [
    ...p.items.map(itemOutline),
    ...(p.shapes ?? []).map((s) => [s.points.map(([x, y]) => ({ x, y }))])
  ]
  const cut = unionD(
    shapes.map((s) => unionD(s, [], FillRule.EvenOdd, PRECISION)).flat(),
    [],
    FillRule.NonZero,
    PRECISION
  ) as Point[][]
  const box = ringsBounds(cut)
  if (!box || box.w <= 0 || box.h <= 0) return null
  const dx = box.x
  const dy = box.y
  const mv = (x: number, y: number): [number, number] => [x - dx, y - dy]
  const shift = (l: SceneLine): SceneLine => ({
    ...l,
    x1: l.x1 - dx,
    y1: l.y1 - dy,
    x2: l.x2 - dx,
    y2: l.y2 - dy
  })
  const page: ScenePage = {
    width: box.w,
    height: box.h,
    items: p.items.map((it) => ({
      ...it,
      x: it.x - dx,
      y: it.y - dy,
      ...(it.matrix
        ? {
            matrix: [
              it.matrix[0],
              it.matrix[1],
              it.matrix[2],
              it.matrix[3],
              it.matrix[4] - dx,
              it.matrix[5] - dy
            ] as SceneItem['matrix']
          }
        : {}),
      ...(it.clip ? { clip: it.clip.map(([x, y]) => mv(x, y)) } : {})
    })),
    lines: [],
    ...(p.shapes?.length
      ? { shapes: p.shapes.map((s) => ({ ...s, points: s.points.map(([x, y]) => mv(x, y)) })) }
      : {})
  }
  return {
    page,
    cut: cut.map((r) => r.map((q) => ({ x: q.x - dx, y: q.y - dy }))),
    folds: (p.folds ?? []).map(shift),
    width: box.w,
    height: box.h
  }
}

// ——— Contorni ———

const rect = (x: number, y: number, w: number, h: number): Point[] => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h }
]

/** Segmenti per un arco di raggio r e ampiezza a (radianti) entro FLATNESS */
function arcSteps(r: number, a: number): number {
  if (r <= FLATNESS) return 1
  const step = 2 * Math.acos(Math.max(-1, 1 - FLATNESS / r))
  return Math.max(2, Math.min(200, Math.ceil(a / step)))
}

function roundedRect(x: number, y: number, w: number, h: number, radius: number): Point[] {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2))
  if (r <= 0) return rect(x, y, w, h)
  const n = arcSteps(r, Math.PI / 2)
  const out: Point[] = []
  // angoli in senso orario dallo spigolo in alto a destra
  const corners: [number, number, number][] = [
    [x + w - r, y + r, -Math.PI / 2],
    [x + w - r, y + h - r, 0],
    [x + r, y + h - r, Math.PI / 2],
    [x + r, y + r, Math.PI]
  ]
  for (const [cx, cy, a0] of corners)
    for (let i = 0; i <= n; i++) {
      const a = a0 + (i / n) * (Math.PI / 2)
      out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
    }
  return out
}

function ellipse(x: number, y: number, w: number, h: number): Point[] {
  const rx = w / 2
  const ry = h / 2
  const n = Math.max(arcSteps(Math.max(rx, ry), 2 * Math.PI), Math.ceil((Math.PI * (w + h)) / 2))
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI
    return { x: x + rx + rx * Math.cos(a), y: y + ry + ry * Math.sin(a) }
  })
}

/**
 * Il contorno della carta rifilata in mm, come lo disegna CardOutline: la forma nel suo
 * riquadro, poi girata e specchiata (shapeFrame)
 */
export function templateOutline(t: Template): Point[][] {
  const rot = t.shapeRotation ?? 0
  const turned = rot % 180 !== 0
  const bw = turned ? t.height : t.width
  const bh = turned ? t.width : t.height
  let rings: Point[][]
  switch (t.shape ?? 'rect') {
    case 'ellipse':
      rings = [ellipse(0, 0, bw, bh)]
      break
    case 'hexagon':
      rings = [hexagonPoints(0, 0, bw, bh)]
      break
    case 'path':
      rings = t.shapePath?.trim()
        ? flattenPath(t.shapePath, bw, bh)
        : [roundedRect(0, 0, bw, bh, t.cornerRadius)]
      break
    default:
      rings = [roundedRect(0, 0, bw, bh, t.cornerRadius)]
  }
  if (!rot && !t.shapeFlipH && !t.shapeFlipV) return rings
  const a = (rot * Math.PI) / 180
  const cos = Math.round(Math.cos(a))
  const sin = Math.round(Math.sin(a))
  const fx = t.shapeFlipH ? -1 : 1
  const fy = t.shapeFlipV ? -1 : 1
  return rings.map((ring) =>
    ring.map((p) => {
      const ux = p.x - bw / 2
      const uy = p.y - bh / 2
      return {
        x: t.width / 2 + fx * (ux * cos - uy * sin),
        y: t.height / 2 + fy * (ux * sin + uy * cos)
      }
    })
  )
}

/** Il contorno di un elemento della pagina, in mm sulla pagina */
export function itemOutline(it: SceneItem): Point[][] {
  // facce e linguette degli sviluppi: si vede solo la parte dentro il poligono
  if (it.clip) return [it.clip.map(([x, y]) => ({ x, y }))]
  const t = it.template
  const b = it.mode === 'bleed' ? t.bleed : 0
  const w = t.width + 2 * b
  const h = t.height + 2 * b
  const local: Point[][] =
    it.mode === 'trim' ? templateOutline(t) : [rect(-b, -b, w, h).map((p) => ({ x: p.x, y: p.y }))]
  const z = it.zoom ?? 1
  // coordinate dall'angolo dell'elemento: con l'abbondanza la carta parte b più in là
  const card = local.map((r) =>
    r.map((p) => {
      let x = p.x + b
      let y = p.y + b
      if (it.flip === 'x') x = w - x
      if (it.flip === 'y') y = h - y
      return { x: x * z, y: y * z }
    })
  )
  if (it.matrix) {
    const [a, bb, c, d, e, f] = it.matrix
    return card.map((r) =>
      r.map((p) => ({
        x: a * (p.x - b) + c * (p.y - b) + e,
        y: bb * (p.x - b) + d * (p.y - b) + f
      }))
    )
  }
  const W = w * z
  const H = h * z
  return card.map((r) =>
    r.map((p) =>
      it.rotate === 90
        ? { x: it.x + H - p.y, y: it.y + p.x }
        : it.rotate === 270
          ? { x: it.x + p.y, y: it.y + W - p.x }
          : { x: it.x + p.x, y: it.y + p.y }
    )
  )
}

// ——— File ———

const fmt = (n: number): string => String(Math.round(n * 1000) / 1000)

const ringD = (ring: Point[], k: number): string =>
  'M' + ring.map((p) => `${fmt(p.x * k)},${fmt(p.y * k)}`).join(' L') + ' Z'

/**
 * SVG del foglio, in pixel a 72 per pollice senza unità: così Design Space lo carica alla misura
 * giusta. «cut» i contorni (con i fori), «folds» le pieghe
 */
export function cutSvg(sheet: CutSheet, what: 'cut' | 'folds'): string {
  const k = SVG_PX_PER_MM
  const w = fmt(sheet.width * k)
  const h = fmt(sheet.height * k)
  const outline = `<path d="${sheet.cut.map((r) => ringD(r, k)).join(' ')}" fill="none" stroke="#000000" stroke-width="0.5"/>`
  const folds = sheet.folds
    .map(
      (l) =>
        `<line x1="${fmt(l.x1 * k)}" y1="${fmt(l.y1 * k)}" x2="${fmt(l.x2 * k)}" y2="${fmt(l.y2 * k)}"/>`
    )
    .join('')
  // Design Space ritaglia l'SVG sul riquadro di ciò che contiene: con le sole pieghe non si
  // allineerebbe al PNG. Il contorno dei pezzi va prima, così nei livelli di Design Space (che
  // li elenca al contrario) le pieghe sono il primo gruppo e il contorno, da cancellare, il secondo
  const g =
    what === 'cut'
      ? outline
      : `<g id="outline">${outline}</g><g id="folds" fill="none" stroke="#0000FF" stroke-width="0.5">${folds}</g>`
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${g}</svg>\n`
}

/**
 * DXF R12 in mm: i contorni come polilinee chiuse sul livello CUT, le pieghe come linee sul
 * livello FOLD. L'asse y del DXF va in su: y = altezza del foglio − y
 */
export function cutDxf(sheet: CutSheet): string {
  const H = sheet.height
  const out: string[] = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009']
  out.push('9', '$INSUNITS', '70', '4', '0', 'ENDSEC')
  out.push('0', 'SECTION', '2', 'ENTITIES')
  for (const ring of sheet.cut) {
    if (ring.length < 3) continue
    out.push('0', 'POLYLINE', '8', 'CUT', '66', '1', '70', '1', '10', '0', '20', '0', '30', '0')
    for (const p of ring)
      out.push('0', 'VERTEX', '8', 'CUT', '10', fmt(p.x), '20', fmt(H - p.y), '30', '0')
    out.push('0', 'SEQEND', '8', 'CUT')
  }
  for (const l of sheet.folds)
    out.push(
      '0',
      'LINE',
      '8',
      'FOLD',
      '10',
      fmt(l.x1),
      '20',
      fmt(H - l.y1),
      '30',
      '0',
      '11',
      fmt(l.x2),
      '21',
      fmt(H - l.y2),
      '31',
      '0'
    )
  out.push('0', 'ENDSEC', '0', 'EOF')
  return out.join('\r\n') + '\r\n'
}

/** I file di un foglio: il PNG si scrive a parte */
export function sheetFiles(
  o: Pick<CutOptions, 'machine'>,
  sheet: CutSheet
): { name: string; kind: 'cut' | 'folds' | 'dxf' }[] {
  const out: { name: string; kind: 'cut' | 'folds' | 'dxf' }[] = []
  if (o.machine !== 'cricut') {
    out.push({ name: `${sheet.name} cut.svg`, kind: 'cut' })
    out.push({ name: `${sheet.name} cut.dxf`, kind: 'dxf' })
  }
  if (sheet.folds.length) out.push({ name: `${sheet.name} folds.svg`, kind: 'folds' })
  return out
}

/** Testo di un messaggio nella lingua dell'app */
export type Translate = (key: string, params?: Record<string, string | number>) => string

/** Lingua delle istruzioni e dei numeri nei nomi dei file */
export interface CutTexts {
  tr: Translate
  locale: string
}

/** Il file istruzioni.txt: i passi per il programma del plotter e le misure di ogni foglio */
export function cutInstructions(
  o: CutOptions,
  plan: CutPlan,
  tr: Translate,
  locale = 'en'
): string {
  const lines: string[] = [tr('cut.instr.title'), '']
  lines.push(tr(o.machine === 'cricut' ? 'cut.instr.cricut' : 'cut.instr.other'), '')
  lines.push(tr('cut.instr.sheets'))
  for (const s of plan.sheets) {
    lines.push(
      tr('cut.instr.sheet', {
        file: `${s.name}.png`,
        w: cm(s.width, locale),
        h: cm(s.height, locale)
      })
    )
    for (const f of sheetFiles(o, s))
      lines.push(
        tr(f.kind === 'folds' ? 'cut.instr.foldsFile' : 'cut.instr.cutFile', { file: f.name })
      )
  }
  return lines.join('\n').replace(/\n/g, '\r\n') + '\r\n'
}

// ——— PNG ———

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/**
 * Il PNG con la risoluzione scritta (blocco pHYs), per i programmi che la leggono: Design Space
 * la ignora, Silhouette Studio e altri no. Un pHYs già presente resta com'è
 */
export function pngWithDpi(png: Uint8Array, dpi: number): Uint8Array {
  // firma (8 byte), poi IHDR: lunghezza, tipo, 13 byte di dati, CRC
  const ihdrEnd = 8 + 4 + 4 + 13 + 4
  if (png.length < ihdrEnd) return png
  const text = String.fromCharCode(...png.subarray(0, Math.min(png.length, 4096)))
  if (text.includes('pHYs')) return png
  const ppm = Math.round(dpi / 0.0254)
  const chunk = new Uint8Array(4 + 4 + 9 + 4)
  const view = new DataView(chunk.buffer)
  view.setUint32(0, 9)
  chunk.set([0x70, 0x48, 0x59, 0x73], 4)
  view.setUint32(8, ppm)
  view.setUint32(12, ppm)
  chunk[16] = 1
  view.setUint32(17, crc32(chunk.subarray(4, 17)))
  const out = new Uint8Array(png.length + chunk.length)
  out.set(png.subarray(0, ihdrEnd), 0)
  out.set(chunk, ihdrEnd)
  out.set(png.subarray(ihdrEnd), ihdrEnd + chunk.length)
  return out
}
