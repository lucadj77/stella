// Piano di un'esportazione: quali file, pagine e fogli escono e cosa contengono. Lo usano sia il
// processo principale, che li disegna e li scrive (src/main/export/run.ts), sia l'anteprima nella
// finestra di esportazione, così l'anteprima mostra esattamente ciò che verrà scritto.

import {
  TTS_MAX_COLS,
  TTS_DIE_COLS,
  TTS_DIE_ROWS,
  TTS_MAX_DPI,
  TTS_MAX_ROWS,
  cropMarks,
  effectivePattern,
  expandCopies,
  fileName,
  gridOverflows,
  mirrorsX,
  pageSize,
  pdfGrid,
  planPdfPages,
  safeName,
  sidesOf,
  ttsAutoGrid,
  ttsScale,
  ttsSetObject,
  uniqueNames,
  cellPosition,
  type CardMode,
  type ExportCard,
  type Instance,
  type ExportSet,
  type ImageOptions,
  type Grid,
  type PdfOptions,
  type PlacedCard,
  type SceneItem,
  type SceneLabel,
  type SceneLine,
  type ScenePage,
  type TtsOptions,
  type TtsPieceKind,
  type TtsSetObject
} from './export'
import type { Side, Template } from './model/template'

/** Una carta da sola, con o senza abbondanza */
export function cardPage(t: Template, side: Side, bleed: boolean, mode: CardMode): ScenePage {
  const b = bleed ? t.bleed : 0
  return {
    width: t.width + 2 * b,
    height: t.height + 2 * b,
    items: [{ x: 0, y: 0, template: t, side, mode: bleed ? 'bleed' : mode }],
    lines: []
  }
}

// ——— Immagini ———

export interface ImageFile {
  set: string
  card: ExportCard
  side: Side
  /** Percorsi relativi senza estensione, uno per copia: le copie sono la stessa immagine */
  names: string[]
}

export const imageExtension = (o: ImageOptions): ImageOptions['format'] => o.format

/** Le immagini da scrivere, carta per carta e lato per lato, con i nomi dei file */
export function planImages(o: ImageOptions, sets: ExportSet[]): ImageFile[] {
  const pattern = effectivePattern(o)
  const sides = sidesOf(o.sides)
  // i nomi devono essere unici in tutta l'esportazione, non solo dentro un set: con uno schema
  // senza %set due set darebbero gli stessi nomi e il secondo sovrascriverebbe il primo
  const files: ImageFile[] = []
  const all: string[] = []
  for (const set of sets) {
    const digits = String(set.cards.length).length
    for (const card of set.cards)
      for (const side of sides) {
        const copies = expandCopies([card], o.copies)
        const names = copies.map(({ copy }) =>
          fileName(pattern, { set: set.name, n: card.n, digits, copy, side, fields: card.fields })
        )
        // copie diverse ({card.copy}): un'immagine per copia, altrimenti una sola per tutti i nomi
        const groups = card.perCopy
          ? copies.map((c, k) => ({ card: c.card, names: [names[k]] }))
          : [{ card, names }]
        for (const g of groups) files.push({ set: set.name, card: g.card, side, names: g.names })
        all.push(...names)
      }
  }
  // nomi ripetuti (per esempio {nome} uguale su due carte): si numerano
  const unique = uniqueNames(all)
  let k = 0
  return files.map((f) => ({ ...f, names: f.names.map(() => unique[k++]) }))
}

// ——— PDF ———

export interface PdfDocument {
  /** Nome del file senza estensione, già reso unico */
  name: string
  pages: ScenePage[]
}

export interface PdfPlan {
  docs: PdfDocument[]
  /** Set la cui griglia esce dalla pagina */
  overflow: string[]
}

export function planPdf(o: PdfOptions, sets: ExportSet[], project: string): PdfPlan {
  const page = pageSize(o)
  const overflow: string[] = []
  const mode = o.bleed ? ('bleed' as const) : o.rounded ? ('trim' as const) : ('cut' as const)
  const gridPages = (grid: Grid, instances: Instance[]): { side: Side; page: ScenePage }[] =>
    planPdfPages(o, grid, instances).map((plan) => ({
      side: plan.side,
      page: {
        width: page.width,
        height: page.height,
        items: plan.cards.map((c) => placedItem(o, grid, c, mode)),
        lines: cropMarks(o, grid, plan.cards)
      }
    }))
  // set dopo set; con continuous i set vicini che non sono poster si uniscono in un gruppo
  type Entry = { set: ExportSet; grid: Grid; kind: 'grid' | 'fold' | 'poster' }
  const entries: Entry[] = sets.map((set) => {
    const grid = pdfGrid(o, set.cards[0].template)
    // margini oltre metà pagina: nessuna area utile, né per la griglia né per un poster
    const noRoom = page.width <= 2 * o.margin || page.height <= 2 * o.margin
    const poster = gridOverflows(grid) && o.poster && !o.fold
    if (noRoom || (gridOverflows(grid) && !poster)) overflow.push(set.name)
    return { set, grid, kind: poster ? 'poster' : o.fold ? 'fold' : 'grid' }
  })
  const continuous = o.continuous && o.split !== 'set'
  const groups: Entry[][] = []
  for (const e of entries) {
    const last = groups[groups.length - 1]
    const prev = last?.[last.length - 1]
    const joins =
      continuous &&
      prev &&
      e.kind !== 'poster' &&
      prev.kind === e.kind &&
      // nella piegatura solo set con la stessa griglia; nella griglia anche misure diverse
      (e.kind === 'grid' || sameGrid(prev.grid, e.grid))
    if (joins) last.push(e)
    else groups.push([e])
  }
  const bySet = groups.map((group) => {
    const { set, grid, kind } = group[0]
    if (kind === 'poster') return { set, pages: posterPages(o, set) }
    const merged: ExportSet = { name: set.name, cards: group.flatMap((e) => e.set.cards) }
    if (kind === 'fold') return { set, pages: foldPages(o, merged, grid) }
    if (group.every((e) => sameGrid(e.grid, grid)))
      return { set, pages: gridPages(grid, expandCopies(merged.cards, o.copies)) }
    // set vicini con la stessa griglia continuano sulla stessa riga
    const runs: { grid: Grid; instances: Instance[] }[] = []
    for (const e of group) {
      const run = runs[runs.length - 1]
      const instances = expandCopies(e.set.cards, o.copies)
      if (run && sameGrid(run.grid, e.grid)) run.instances.push(...instances)
      else runs.push({ grid: e.grid, instances })
    }
    return { set, pages: shelfPages(o, runs, mode) }
  })
  const docs: PdfDocument[] = []
  const base = safeName(project || 'cards')
  if (o.split === 'set') {
    for (const s of bySet)
      docs.push({ name: safeName(s.set.name), pages: s.pages.map((p) => p.page) })
  } else if (o.split === 'side') {
    for (const side of ['front', 'back'] as const) {
      const pages = bySet.flatMap((s) => s.pages.filter((p) => p.side === side).map((p) => p.page))
      if (pages.length) docs.push({ name: `${base}_${side}`, pages })
    }
  } else docs.push({ name: base, pages: bySet.flatMap((s) => s.pages.map((p) => p.page)) })
  if (o.proof) docs.push({ name: `${base}_proof`, pages: proofPages(o, sets) })
  const names = uniqueNames(docs.map((d) => d.name))
  return {
    docs: docs.map((d, i) => ({ ...d, name: names[i] })).filter((d) => d.pages.length),
    overflow
  }
}

function sameGrid(a: Grid, b: Grid): boolean {
  const eq = (x: number, y: number): boolean => Math.abs(x - y) < 1e-6
  return (
    a.cols === b.cols &&
    a.rows === b.rows &&
    a.rotated === b.rotated &&
    eq(a.cellW, b.cellW) &&
    eq(a.cellH, b.cellH) &&
    eq(a.bleed, b.bleed)
  )
}

/** Una carta della griglia come elemento della pagina */
function placedItem(o: PdfOptions, grid: Grid, c: PlacedCard, mode: CardMode): SceneItem {
  return {
    x: c.x,
    y: c.y,
    template: c.instance.card.template,
    side: c.side,
    mode,
    // girando il foglio sul lato verticale la carta si capovolge: il retro ruota al contrario
    rotate: !grid.rotated ? 0 : c.side === 'back' && o.duplex !== 'none' && mirrorsX(o) ? 270 : 90
  }
}

// ——— Set uno dopo l'altro ———

/**
 * Pagine con set di misure diverse, uno dopo l'altro: ogni set tiene la sua griglia (colonne,
 * rotazione, centratura orizzontale) e comincia su una riga nuova sotto il set precedente, se
 * nella pagina c'è ancora posto. Le righe della pagina si centrano in verticale. Ogni gruppo di
 * set vicini con la stessa griglia arriva qui come un solo gruppo di carte.
 */
export function shelfPages(
  o: PdfOptions,
  runs: { grid: Grid; instances: Instance[] }[],
  mode: CardMode
): { side: Side; page: ScenePage }[] {
  const page = pageSize(o)
  const availH = page.height - 2 * o.margin
  // tra un set e l'altro c'è spazio per i segni di taglio, anche quando le carte si toccano
  const marks = o.marks === 'corners' ? 2 * o.markLength + 1 : 0
  type Block = { grid: Grid; rows: Instance[][]; y: number }
  const sheets: Block[][] = [[]]
  let used = 0
  for (const run of runs) {
    const g = run.grid
    const blockGap = Math.max(g.gap, marks, 2)
    let block: Block | null = null
    for (let i = 0; i < run.instances.length; i += g.cols) {
      const row = run.instances.slice(i, i + g.cols)
      const sheet = sheets[sheets.length - 1]
      const before = block ? g.gap : sheet.length ? blockGap : 0
      if (sheet.length && used + before + g.cellH > availH + 1e-6) {
        sheets.push([])
        used = 0
        block = null
      }
      const current = sheets[sheets.length - 1]
      if (!block) {
        used += current.length ? blockGap : 0
        block = { grid: g, rows: [], y: used }
        current.push(block)
      } else used += g.gap
      block.rows.push(row)
      used += g.cellH
    }
  }
  const out: { side: Side; page: ScenePage }[] = []
  for (const sheet of sheets) {
    if (!sheet.length) continue
    const last = sheet[sheet.length - 1]
    const height =
      last.y + last.rows.length * last.grid.cellH + (last.rows.length - 1) * last.grid.gap
    const top = o.margin + Math.max(0, (availH - height) / 2)
    const sidePage = (side: Side): { side: Side; page: ScenePage } => {
      const items: SceneItem[] = []
      const lines: SceneLine[] = []
      for (const b of sheet) {
        const g = { ...b.grid, y0: top + b.y }
        const cards: PlacedCard[] = b.rows.flatMap((row, r) =>
          row.map((instance, c) => ({
            ...cellPosition(o, g, r * g.cols + c, side === 'back'),
            instance,
            side
          }))
        )
        items.push(...cards.map((c) => placedItem(o, g, c, mode)))
        lines.push(...cropMarks(o, g, cards, true))
      }
      return { side, page: { width: page.width, height: page.height, items, lines } }
    }
    if (o.duplex !== 'none') out.push(sidePage('front'), sidePage('back'))
    else for (const side of sidesOf(o.sides)) out.push(sidePage(side))
  }
  // senza fronte-retro tutti i fronti, poi tutti i retri, come nelle altre pagine
  if (o.duplex === 'none' && o.sides === 'both')
    return [...out.filter((p) => p.side === 'front'), ...out.filter((p) => p.side === 'back')]
  return out
}

// ——— Piegatura ———

/**
 * Fogli da piegare: ogni carta occupa una cella larga il doppio, con il fronte a sinistra e il
 * retro a destra, dritti. Piegando lungo la linea tratteggiata il retro finisce dietro il fronte.
 * Con l'abbondanza la coppia ha l'abbondanza solo all'esterno.
 */
function foldPages(o: PdfOptions, set: ExportSet, grid: Grid): { side: Side; page: ScenePage }[] {
  const page = pageSize(o)
  const plans = planPdfPages(
    { ...o, duplex: 'none', sides: 'front' },
    grid,
    expandCopies(set.cards, o.copies)
  )
  const mode = o.bleed ? ('bleed' as const) : ('cut' as const)
  const b = grid.bleed
  return plans.map((plan) => ({
    side: 'front' as const,
    page: {
      width: page.width,
      height: page.height,
      items: plan.cards.flatMap((c) => {
        const t = c.instance.card.template
        return [
          { x: c.x, y: c.y, template: t, side: 'front' as const, mode, crop: { l: 0, r: b } },
          {
            x: c.x + t.width,
            y: c.y,
            template: t,
            side: 'back' as const,
            mode,
            crop: { l: b, r: 0 }
          }
        ]
      }),
      lines: [...cropMarks(o, grid, plan.cards), ...foldMarks(o, grid, plan.cards)]
    }
  }))
}

/** Trattini della piegatura nei margini, sopra e sotto ogni coppia */
function foldMarks(o: PdfOptions, g: Grid, cards: PlacedCard[]): SceneLine[] {
  const len = Math.max(2, o.markLength)
  return cards.flatMap((c) => {
    const x = c.x + g.cellW / 2
    return [
      { x1: x, y1: c.y - len, x2: x, y2: c.y, dash: true },
      { x1: x, y1: c.y + g.cellH, x2: x, y2: c.y + g.cellH + len, dash: true }
    ]
  })
}

// ——— Fogli di prova ———

/** Larghezza di una carta nei fogli di prova, in mm */
const PROOF_CELL = 30
const PROOF_GAP = 4
const PROOF_LABEL = 2

/**
 * Tutte le carte in piccolo, una per riga del foglio (senza copie), con set e numero sotto:
 * servono a controllare il mazzo prima di stamparlo.
 */
export function proofPages(o: PdfOptions, sets: ExportSet[]): ScenePage[] {
  const page = pageSize(o)
  const margin = Math.max(5, o.margin)
  const availW = page.width - 2 * margin
  const availH = page.height - 2 * margin
  const cols = Math.max(1, Math.floor((availW + PROOF_GAP) / (PROOF_CELL + PROOF_GAP)))
  const cellW = (availW - (cols - 1) * PROOF_GAP) / cols
  const cellH = cellW * 1.5
  const rowH = cellH + PROOF_LABEL * 2 + PROOF_GAP
  const rows = Math.max(1, Math.floor((availH + PROOF_GAP) / rowH))
  const sides = o.duplex !== 'none' ? (['front', 'back'] as const) : sidesOf(o.sides)
  const cells = sets.flatMap((set) =>
    set.cards.flatMap((card) => sides.map((side) => ({ set, card, side })))
  )
  const pages: ScenePage[] = []
  for (let i = 0; i < cells.length; i += cols * rows) {
    const chunk = cells.slice(i, i + cols * rows)
    const items: SceneItem[] = []
    const labels: SceneLabel[] = []
    chunk.forEach(({ set, card, side }, k) => {
      const t = card.template
      const zoom = Math.min(cellW / t.width, cellH / t.height)
      const x = margin + (k % cols) * (cellW + PROOF_GAP)
      const y = margin + Math.floor(k / cols) * rowH
      items.push({
        x: x + (cellW - t.width * zoom) / 2,
        y: y + (cellH - t.height * zoom) / 2,
        template: t,
        side,
        mode: 'trim',
        zoom
      })
      labels.push({
        x,
        y: y + cellH + PROOF_LABEL,
        text: `${set.name} ${card.n}${side === 'back' ? ' · back' : ''}`,
        size: PROOF_LABEL
      })
    })
    pages.push({ width: page.width, height: page.height, items, lines: [], labels })
  }
  return pages
}

// ——— Poster ———

/** Lettere delle colonne delle parti di un poster: A, B, …, Z, AA, AB… */
const column = (i: number): string =>
  (i >= 26 ? column(Math.floor(i / 26) - 1) : '') + String.fromCharCode(65 + (i % 26))

export interface PosterLayout {
  cols: number
  rows: number
  /** Passo tra una parte e la successiva, in mm della carta */
  stepX: number
  stepY: number
  /** Parte visibile su ogni pagina */
  tileW: number
  tileH: number
  rotated: boolean
}

/**
 * Parti di un poster per una carta di cw × ch mm su un'area stampabile aw × ah: le parti si
 * sovrappongono almeno di `overlap`, distribuite in modo uguale. Si sceglie l'orientamento
 * della carta con meno pagine.
 */
export function posterLayout(
  cw: number,
  ch: number,
  aw: number,
  ah: number,
  overlap: number,
  autoRotate: boolean
): PosterLayout {
  const axis = (size: number, avail: number): { n: number; step: number; tile: number } => {
    if (size <= avail + 1e-6) return { n: 1, step: 0, tile: size }
    // senza area utile (margini oltre metà pagina) una sola parte: il conto darebbe infinito
    if (!(avail > 0)) return { n: 1, step: 0, tile: 0 }
    const ov = Math.min(Math.max(0, overlap), avail / 2)
    const n = Math.max(2, Math.ceil((size - ov) / (avail - ov) - 1e-6))
    return { n, step: (size - avail) / (n - 1), tile: avail }
  }
  const make = (w: number, h: number, rotated: boolean): PosterLayout => {
    const x = axis(w, aw)
    const y = axis(h, ah)
    return {
      cols: x.n,
      rows: y.n,
      stepX: x.step,
      stepY: y.step,
      tileW: x.tile,
      tileH: y.tile,
      rotated
    }
  }
  const upright = make(cw, ch, false)
  if (!autoRotate) return upright
  const turned = make(ch, cw, true)
  return turned.cols * turned.rows < upright.cols * upright.rows ? turned : upright
}

/**
 * Pagine di un set le cui carte non entrano nella pagina: ogni carta (e ogni copia) si divide
 * in parti che si sovrappongono. Sulla pagina: i segni di taglio della carta dove cadono, i
 * segni dell'inizio della sovrapposizione nei margini, e il nome della parte (A1, B1…).
 * I retri seguono i fronti come pagine a parte, senza fronte-retro.
 */
function posterPages(o: PdfOptions, set: ExportSet): { side: Side; page: ScenePage }[] {
  const page = pageSize(o)
  const aw = page.width - 2 * o.margin
  const ah = page.height - 2 * o.margin
  const out: { side: Side; page: ScenePage }[] = []
  const sides = o.duplex !== 'none' ? (['front', 'back'] as const) : sidesOf(o.sides)
  for (const side of sides)
    for (const inst of expandCopies(set.cards, o.copies)) {
      const t = inst.card.template
      const b = o.bleed ? t.bleed : 0
      const w0 = t.width + 2 * b
      const h0 = t.height + 2 * b
      const L = posterLayout(w0, h0, aw, ah, o.posterOverlap, o.autoRotate)
      const [cw, ch] = L.rotated ? [h0, w0] : [w0, h0]
      // la parte sta in alto a sinistra dell'area stampabile, centrata se la carta è più piccola
      const x0 = o.margin + (aw - L.tileW) / 2
      const y0 = o.margin + (ah - L.tileH) / 2
      for (let r = 0; r < L.rows; r++)
        for (let c = 0; c < L.cols; c++) {
          const ox = c * L.stepX
          const oy = r * L.stepY
          const clip = { x: x0, y: y0, w: L.tileW, h: L.tileH }
          // bordi di taglio della carta in coordinate della pagina
          const trim = {
            l: x0 - ox + b,
            t: y0 - oy + b,
            r: x0 - ox + cw - b,
            b: y0 - oy + ch - b
          }
          const lines: SceneLine[] = []
          const len = Math.min(o.markLength, o.margin)
          const inX = (x: number): boolean => x >= clip.x - 1e-6 && x <= clip.x + clip.w + 1e-6
          const inY = (y: number): boolean => y >= clip.y - 1e-6 && y <= clip.y + clip.h + 1e-6
          if (o.marks !== 'none' && len > 0) {
            for (const x of [trim.l, trim.r])
              if (inX(x)) {
                lines.push({ x1: x, y1: clip.y - len, x2: x, y2: clip.y })
                lines.push({ x1: x, y1: clip.y + clip.h, x2: x, y2: clip.y + clip.h + len })
              }
            for (const y of [trim.t, trim.b])
              if (inY(y)) {
                lines.push({ x1: clip.x - len, y1: y, x2: clip.x, y2: y })
                lines.push({ x1: clip.x + clip.w, y1: y, x2: clip.x + clip.w + len, y2: y })
              }
          }
          // dove comincia la parte accanto: lì si sovrappone, o si taglia per accostare
          const half = len / 2
          if (c + 1 < L.cols) {
            const x = clip.x + L.stepX
            lines.push({ x1: x, y1: clip.y - half, x2: x, y2: clip.y })
            lines.push({ x1: x, y1: clip.y + clip.h, x2: x, y2: clip.y + clip.h + half })
          }
          if (r + 1 < L.rows) {
            const y = clip.y + L.stepY
            lines.push({ x1: clip.x - half, y1: y, x2: clip.x, y2: y })
            lines.push({ x1: clip.x + clip.w, y1: y, x2: clip.x + clip.w + half, y2: y })
          }
          const name = `${column(c)}${r + 1}`
          const size = Math.min(3, Math.max(1.5, o.margin / 3))
          out.push({
            side,
            page: {
              width: page.width,
              height: page.height,
              items: [
                {
                  x: x0 - ox,
                  y: y0 - oy,
                  template: t,
                  side,
                  mode: o.bleed ? 'bleed' : o.rounded ? 'trim' : 'cut',
                  rotate: L.rotated ? 90 : 0
                }
              ],
              lines,
              clip,
              labels:
                L.cols * L.rows > 1
                  ? [
                      {
                        x: clip.x,
                        y: Math.min(page.height - size / 2, clip.y + clip.h + size * 1.5),
                        text: `${name} · ${set.name} ${inst.card.n}${side === 'back' ? ' · back' : ''}`,
                        size
                      }
                    ]
                  : undefined
            }
          })
        }
    }
  return out
}

// ——— Tabletop Simulator ———

export interface TtsChunk {
  cards: ExportCard[]
  /** Quante carte del mazzo usano ogni posizione del foglio */
  counts: number[]
  cols: number
  rows: number
  /** Pixel per mm del foglio */
  scale: number
}

/** Segnalino o tessera: un'immagine per lato, le copie nel sacchetto */
export interface TtsPiecePlan {
  card: ExportCard
  count: number
  /** Pixel per mm */
  scale: number
}

/** Dado: sei carte, una per faccia, in un foglio 3 × 2 */
export interface TtsDiePlan {
  cards: ExportCard[]
  count: number
  /** Le ultime facce ripetono le prime: le carte non erano un multiplo di sei */
  padded: boolean
  /** Pixel per mm */
  scale: number
}

export interface TtsSetPlan {
  set: ExportSet
  object: TtsSetObject
  /** Fogli del mazzo; vuoto per segnalini e tessere */
  chunks: TtsChunk[]
  /** Segnalini, tessere o plance; vuoto per le carte e i dadi */
  pieces: TtsPiecePlan[]
  /** Dadi a sei facce: le carte prese sei alla volta */
  dice: TtsDiePlan[]
  /** Un foglio dei retri per ogni foglio di fronti, invece di un retro unico */
  uniqueBack: boolean
}

/** Fogli di ogni set: fino a 69 carte per foglio, l'ultima posizione alla carta nascosta */
export function planTts(o: TtsOptions, sets: ExportSet[]): TtsSetPlan[] {
  const fixed = o.grid === 'fixed'
  const cols = Math.min(TTS_MAX_COLS, Math.max(2, o.cols))
  const rows = Math.min(TTS_MAX_ROWS, Math.max(2, o.rows))
  const perSheet = fixed ? cols * rows - 1 : TTS_MAX_COLS * TTS_MAX_ROWS - 1
  return sets.map((set) => {
    // senza copie ogni riga è una carta; con le copie le righe a 0 non entrano nel mazzo
    const kept = set.cards.filter((c) => !o.copies || c.amount > 0)
    const object = ttsSetObject(o, set.name, set.kind)
    if (object.type === 'die') {
      const dice: TtsDiePlan[] = []
      for (let i = 0; i < kept.length; i += 6) {
        const group = kept.slice(i, i + 6)
        const t = group[0].template
        dice.push({
          cards: Array.from({ length: 6 }, (_, j) => group[j % group.length]),
          count: o.copies ? group[0].amount : 1,
          padded: group.length < 6,
          scale: Math.min(
            TTS_MAX_DPI / 25.4,
            o.maxSize / (TTS_DIE_COLS * t.width),
            o.maxSize / (TTS_DIE_ROWS * t.height)
          )
        })
      }
      return { set, object, chunks: [], pieces: [], dice, uniqueBack: false }
    }
    if (object.type !== 'card') {
      const pieces = kept.map((card) => ({
        card,
        count: o.copies ? card.amount : 1,
        scale: pieceScale(card.template, o.maxSize)
      }))
      return { set, object, chunks: [], pieces, dice: [], uniqueBack: false }
    }
    // copie nel foglio: ogni copia ha la sua posizione e nel mazzo compare una volta
    const inSheet = o.copies && o.copiesIn === 'sheet'
    const cards = inSheet ? expandCopies(kept, true).map((i) => i.card) : kept
    const counts = cards.map((c) => (o.copies && !inSheet ? c.amount : 1))
    const chunks: TtsChunk[] = []
    for (let i = 0; i < cards.length; i += perSheet) {
      const chunk = cards.slice(i, i + perSheet)
      const t0 = chunk[0].template
      const g = fixed ? { cols, rows } : ttsAutoGrid(chunk.length, t0.width, t0.height)
      chunks.push({
        cards: chunk,
        counts: counts.slice(i, i + perSheet),
        ...g,
        scale: ttsScale(g.cols, g.rows, t0.width, t0.height, o.maxSize)
      })
    }
    const backs = cards.map((c) => JSON.stringify(c.template.back))
    const sameBacks = backs.every((b) => b === backs[0])
    return {
      set,
      object,
      chunks,
      pieces: [],
      dice: [],
      uniqueBack: o.back === 'sheet' || (o.back === 'auto' && !sameBacks)
    }
  })
}

/** Foglio di carte a griglia; l'ultima posizione mostra il retro, come carta nascosta */
export function sheetPage(chunk: TtsChunk, side: Side): ScenePage {
  const { cards, cols, rows } = chunk
  const t0 = cards[0].template
  const items = cards.map((c, i) => ({
    x: (i % cols) * t0.width,
    y: Math.floor(i / cols) * t0.height,
    template: c.template,
    side,
    mode: 'cut' as const
  }))
  const last = cols * rows - 1
  items.push({
    x: (last % cols) * t0.width,
    y: Math.floor(last / cols) * t0.height,
    template: t0,
    side: 'back',
    mode: 'cut'
  })
  return { width: cols * t0.width, height: rows * t0.height, items, lines: [] }
}

/** Pixel per mm di un segnalino o di una tessera: entro la dimensione massima e 300 DPI */
function pieceScale(t: Template, maxSize: number): number {
  return Math.min(TTS_MAX_DPI / 25.4, maxSize / Math.max(t.width, t.height))
}

/** Margine trasparente attorno ai segnalini: Tabletop Simulator ne ritaglia meglio la sagoma */
export const TOKEN_MARGIN = 1

/**
 * Immagine di un segnalino o di una tessera. Il segnalino è la carta ritagliata sulla sua forma,
 * su fondo trasparente con un piccolo margine; la tessera è il rettangolo della carta, perché la
 * forma (esagono, cerchio, angoli arrotondati) la dà Tabletop Simulator.
 */
export function piecePage(t: Template, side: Side, kind: TtsPieceKind): ScenePage {
  if (kind !== 'token') return cardPage(t, side, false, 'cut')
  const m = TOKEN_MARGIN
  return {
    width: t.width + 2 * m,
    height: t.height + 2 * m,
    items: [{ x: m, y: m, template: t, side, mode: 'trim' }],
    lines: []
  }
}

/** Foglio delle facce di un dado: le sei carte in 3 colonne e 2 righe, senza abbondanza */
export function diePage(die: TtsDiePlan): ScenePage {
  const t0 = die.cards[0].template
  return {
    width: TTS_DIE_COLS * t0.width,
    height: TTS_DIE_ROWS * t0.height,
    items: die.cards.map((c, k) => ({
      x: (k % TTS_DIE_COLS) * t0.width,
      y: Math.floor(k / TTS_DIE_COLS) * t0.height,
      template: c.template,
      side: 'front' as const,
      mode: 'cut' as const
    })),
    lines: []
  }
}
