// Pagina di prova del fronte-retro: sul fronte cinque croci, sul retro, dove le croci dovrebbero
// cadere girando il foglio, due scale in mm per ciascuna. Guardando il foglio controluce dal retro
// si legge di quanto la croce manca lo zero: il numero letto si somma allo spostamento dei retri.

import {
  mirrorsX,
  pageSize,
  type PdfOptions,
  type SceneLabel,
  type SceneLine,
  type ScenePage
} from './export'

export interface DuplexTestText {
  /** Titolo del fronte e del retro */
  front: string
  back: string
  /** Spiegazione del fronte, in poche parole */
  frontHint: string
  /** I passi da seguire, sul retro */
  steps: string[]
}

/** Distanza delle croci dai bordi della pagina, in mm */
const MARGIN = 35
/** Mezza lunghezza delle scale, in mm */
const RANGE = 5
/** Distanza delle scale dal punto, in mm: i bracci della croce sul fronte sono lunghi ARM */
const GAP = 8
const ARM = 15
const TEXT = 3
const LABEL = 1.6

/** Le croci del fronte, numerate da 1: il centro e i quattro angoli */
export function testPoints(o: PdfOptions): { x: number; y: number }[] {
  const { width: w, height: h } = pageSize(o)
  return [
    { x: w / 2, y: h / 2 },
    { x: MARGIN, y: MARGIN },
    { x: w - MARGIN, y: MARGIN },
    { x: MARGIN, y: h - MARGIN },
    { x: w - MARGIN, y: h - MARGIN }
  ]
}

/** Dove cade sul retro un punto del fronte, come per i retri delle carte, spostamento compreso */
export function backPoint(o: PdfOptions, p: { x: number; y: number }): { x: number; y: number } {
  const { width: w, height: h } = pageSize(o)
  const x = mirrorsX(o) ? w - p.x : p.x
  const y = mirrorsX(o) ? p.y : h - p.y
  return { x: x + o.offsetX, y: y + o.offsetY }
}

/** Un testo centrato su x: le scritte della scena partono da sinistra */
function centered(x: number, y: number, text: string, size: number): SceneLabel {
  return { x: x - text.length * size * 0.27, y, text, size }
}

/** Le righe di un testo lungo, a parole intere, per una larghezza in mm */
export function wrap(text: string, width: number, size: number): string[] {
  const max = Math.max(10, Math.floor(width / (size * 0.52)))
  const out: string[] = []
  let line = ''
  for (const word of text.split(/\s+/)) {
    if (line && line.length + 1 + word.length > max) {
      out.push(line)
      line = word
    } else line = line ? `${line} ${word}` : word
  }
  if (line) out.push(line)
  return out
}

/** Le due pagine della prova: il fronte con le croci, il retro con le scale */
export function duplexTestPages(o: PdfOptions, text: DuplexTestText): ScenePage[] {
  const { width: w, height: h } = pageSize(o)
  const points = testPoints(o)

  const frontLines: SceneLine[] = []
  const frontLabels: SceneLabel[] = []
  points.forEach((p, i) => {
    frontLines.push({ x1: p.x - ARM, y1: p.y, x2: p.x + ARM, y2: p.y })
    frontLines.push({ x1: p.x, y1: p.y - ARM, x2: p.x, y2: p.y + ARM })
    frontLabels.push({ x: p.x + 2, y: p.y - 4, text: String(i + 1), size: TEXT })
  })
  // il testo del fronte sta in basso tra le croci: controluce, girato su un lato o sull'altro,
  // cade dove il retro non ha scritte
  frontLabels.push(centered(w / 2, h - MARGIN - 8, text.front, 5))
  wrap(text.frontHint, w - 2 * MARGIN - 2 * ARM - 10, TEXT).forEach((l, i) =>
    frontLabels.push(centered(w / 2, h - MARGIN - 1 + i * TEXT * 1.5, l, TEXT))
  )

  const backLines: SceneLine[] = []
  const backLabels: SceneLabel[] = []
  points.forEach((p, i) => {
    const b = backPoint(o, p)
    // due scale lontane dal punto, sui bracci della croce: quella sotto legge x (la attraversa
    // il braccio verticale), quella a destra legge y (la attraversa il braccio orizzontale)
    const hy = b.y + GAP
    const vx = b.x + GAP
    backLines.push({ x1: b.x - RANGE, y1: hy, x2: b.x + RANGE, y2: hy })
    backLines.push({ x1: vx, y1: b.y - RANGE, x2: vx, y2: b.y + RANGE })
    for (let k = -RANGE * 2; k <= RANGE * 2; k++) {
      const d = k / 2
      const long = k === 0 ? 3.5 : k % 2 === 0 ? 2 : 1
      backLines.push({ x1: b.x + d, y1: hy, x2: b.x + d, y2: hy + long })
      backLines.push({ x1: vx, y1: b.y + d, x2: vx + long, y2: b.y + d })
      if (k % 4 === 0) {
        const n = d < 0 ? `−${-d}` : String(d)
        backLabels.push(centered(b.x + d, hy + 5, n, LABEL))
        backLabels.push({ x: vx + 4.2, y: b.y + d, text: n, size: LABEL })
      }
    }
    backLabels.push({ x: b.x - RANGE - 4, y: hy + 2, text: 'x', size: TEXT })
    backLabels.push({ x: vx - 1, y: b.y - RANGE - 2.5, text: 'y', size: TEXT })
    backLabels.push({ x: b.x - RANGE - 4, y: b.y - RANGE, text: String(i + 1), size: TEXT * 1.4 })
  })
  backLabels.push(centered(w / 2, MARGIN + 25, text.back, 5))
  let y = MARGIN + 34
  for (const step of text.steps) {
    for (const l of wrap(step, w - 2 * MARGIN, TEXT)) {
      backLabels.push({ x: MARGIN, y, text: l, size: TEXT })
      y += TEXT * 1.5
    }
    y += TEXT * 0.6
  }
  return [
    { width: w, height: h, items: [], lines: frontLines, labels: frontLabels },
    { width: w, height: h, items: [], lines: backLines, labels: backLabels }
  ]
}
