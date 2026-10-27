// Esportazione: opzioni, impaginazione del PDF, nomi dei file, griglia e oggetto di Tabletop
// Simulator. Vedi docs/specifica.md, sezione 9. Tutte le misure sono in mm.

import type { Side, Template } from './model/template'
import type { Message } from './messages'
import type { ProjectFont } from './project'
import type { Variables } from './model/variables'
import { parseTags, snapPoints, type SnapPoint } from './model/ttsSnap'

export type ExportKind = 'images' | 'pdf' | 'tts'
export type SidesChoice = 'front' | 'back' | 'both'

export interface CommonOptions {
  /** Set da esportare, per nome; vuoto vuol dire tutti */
  sets: string[]
  /** Ripete le carte secondo la colonna amount */
  copies: boolean
  /** Cartella di destinazione; vuota vuol dire export/ nel progetto */
  folder: string
}

export interface ImageOptions extends CommonOptions {
  format: 'png' | 'jpg' | 'webp' | 'svg'
  /** Qualità JPG e WebP, 1-100 */
  quality: number
  dpi: number
  bleed: boolean
  sides: SidesChoice
  /** Fuori dagli angoli arrotondati: trasparente (PNG e WebP) o bianco */
  transparent: boolean
  /** Nome dei file: %set, %n, %copy, %side, {campo}; / crea sottocartelle */
  pattern: string
}

export type PageSize = 'A4' | 'A3' | 'Letter' | 'custom'
export type MarksStyle = 'none' | 'corners' | 'lines'

export interface PdfOptions extends CommonOptions {
  page: PageSize
  /** Pagina personalizzata, verticale */
  pageWidth: number
  pageHeight: number
  landscape: boolean
  margin: number
  spacing: number
  layout: 'auto' | 'fixed'
  cols: number
  rows: number
  bleed: boolean
  /** Senza abbondanza: angoli arrotondati come nel template, o rettangolo di taglio */
  rounded: boolean
  marks: MarksStyle
  markLength: number
  markWidth: number
  markColor: string
  /** Segni di taglio sopra le carte invece che sotto */
  marksOver: boolean
  sides: SidesChoice
  /** Fronte-retro: retri su pagine alternate, specchiati per la rilegatura scelta */
  duplex: 'none' | 'long' | 'short'
  /** Spostamento dei retri per compensare il disallineamento della stampante */
  offsetX: number
  offsetY: number
  /** Un file in tutto, uno per set o uno per lato (fronti e retri separati) */
  split: 'single' | 'set' | 'side'
  /** Carte ruotate di 90° quando altrimenti non entrano nella pagina o ne entrano di più */
  autoRotate: boolean
  /** Le carte più grandi della pagina si dividono su più pagine, da unire come un poster */
  poster: boolean
  /** Sovrapposizione tra le parti del poster, in mm */
  posterOverlap: number
  /** Fronte e retro affiancati sulla stessa pagina, da piegare lungo la linea in mezzo */
  fold: boolean
  /** Un PDF in più con tutte le carte in piccolo, per controllarle */
  proof: boolean
  /** Conversione in CMYK con Ghostscript, se installato */
  cmyk: boolean
  /** Set uno dopo l'altro sulla stessa pagina, invece di cominciare ogni set su una pagina nuova */
  continuous: boolean
}

export interface TtsOptions extends Omit<CommonOptions, 'folder'> {
  grid: 'auto' | 'fixed'
  cols: number
  rows: number
  maxSize: 4096 | 8192
  /**
   * Con le copie: ogni carta una volta nel foglio e le copie nel mazzo del JSON (deck), oppure
   * ripetuta nel foglio quante volte dice amount (sheet), utile per caricare i fogli a mano
   */
  copiesIn: 'deck' | 'sheet'
  /** Retro unico, foglio dei retri o scelta automatica (unico se tutti i retri sono uguali) */
  back: 'auto' | 'single' | 'sheet'
  destination: 'project' | 'tts' | 'both'
  /** Cartella Saved Objects di Tabletop Simulator; vuota usa quella predefinita del sistema */
  ttsFolder: string
  /** Campo per Nickname e Description; vuoto per lasciarli vuoti */
  nickname: string
  description: string
  /** Oggetto da creare per ogni set, per nome del set; un set assente diventa un mazzo di carte */
  objects?: Record<string, TtsSetObject>
}

/**
 * Carte in un mazzo, segnalini ritagliati sulla sagoma, tessere con fronte, retro e bordo, plance
 * (tessere grandi, non impilabili) o dadi a sei facce (sei carte per dado)
 */
export type TtsObjectType = 'card' | 'token' | 'tile' | 'board' | 'die' | 'standee'

export interface TtsSetObject {
  type: TtsObjectType
  /** Spessore di segnalini, tessere e plance, in mm */
  thickness: number
  /** Colore del bordo (lo spessore) di tessere e plance */
  edgeColor: string
}

/** Spessore predefinito delle pedine, in mm */
export const STANDEE_THICKNESS = 10

export const DEFAULT_TTS_OBJECT: TtsSetObject = {
  type: 'card',
  thickness: 2,
  edgeColor: '#FFFFFF'
}

/** Oggetto scelto per un set, con i valori mancanti presi da quelli predefiniti */
export function ttsSetObject(
  o: Pick<TtsOptions, 'objects'>,
  set: string,
  kind?: TtsObjectType
): TtsSetObject {
  // senza una scelta nell'esportazione vale il tipo di componente del template
  const chosen = o.objects?.[set]
  const type = chosen?.type ?? kind ?? DEFAULT_TTS_OBJECT.type
  return {
    ...DEFAULT_TTS_OBJECT,
    thickness: ttsDefaultThickness(type),
    ...(kind ? { type: kind } : {}),
    ...chosen
  }
}

/** Spessore predefinito in mm: le pedine devono stare in piedi, quindi hanno una base larga */
export function ttsDefaultThickness(type: TtsObjectType): number {
  return type === 'standee' ? STANDEE_THICKNESS : DEFAULT_TTS_OBJECT.thickness
}

/** Opzioni salvate con un nome, per rilanciare un'esportazione o partire da un servizio di stampa */
export type NamedProfile =
  | { name: string; kind: 'images'; options: Partial<ImageOptions> }
  | { name: string; kind: 'pdf'; options: Partial<PdfOptions> }
  | { name: string; kind: 'tts'; options: Partial<TtsOptions> }

export interface ExportProfiles {
  images?: Partial<ImageOptions>
  pdf?: Partial<PdfOptions>
  tts?: Partial<TtsOptions>
  /** Profili con nome, nell'ordine in cui sono stati creati */
  named?: NamedProfile[]
}

export const DEFAULT_IMAGE: ImageOptions = {
  sets: [],
  copies: false,
  folder: '',
  format: 'png',
  quality: 92,
  dpi: 300,
  bleed: false,
  sides: 'front',
  transparent: true,
  pattern: '%set/%n'
}

export const DEFAULT_PDF: PdfOptions = {
  sets: [],
  copies: true,
  folder: '',
  page: 'A4',
  pageWidth: 210,
  pageHeight: 297,
  landscape: false,
  margin: 10,
  spacing: 0,
  layout: 'auto',
  cols: 3,
  rows: 3,
  bleed: false,
  rounded: true,
  marks: 'corners',
  markLength: 4,
  markWidth: 0.25,
  markColor: '#000000',
  marksOver: false,
  sides: 'front',
  duplex: 'none',
  offsetX: 0,
  offsetY: 0,
  split: 'single',
  autoRotate: true,
  poster: true,
  posterOverlap: 10,
  fold: false,
  proof: false,
  cmyk: false,
  continuous: false
}

export const DEFAULT_TTS: TtsOptions = {
  sets: [],
  copies: true,
  grid: 'auto',
  cols: 10,
  rows: 7,
  maxSize: 4096,
  copiesIn: 'deck',
  back: 'auto',
  destination: 'both',
  ttsFolder: '',
  nickname: '',
  description: ''
}

/** Una carta da esportare: il template con i valori della riga già applicati */
export interface ExportCard {
  /** Posizione nel set, da 1 */
  n: number
  amount: number
  label: string
  fields: Record<string, string>
  template: Template
  /** Template di ogni copia, se cambia da copia a copia ({card.copy}) */
  perCopy?: Template[]
}

export interface ExportSet {
  name: string
  /** Tipo di componente del template del set; assente vale carta */
  kind?: TtsObjectType
  cards: ExportCard[]
}

interface JobBase {
  /** Nome del progetto: dà il nome al PDF unico e alla cartella in Tabletop Simulator */
  project: string
  sets: ExportSet[]
  /** Lingua delle carte, se non è la principale: i file vanno nella sottocartella con il suo codice */
  language?: string
}

export type ExportJob =
  | (JobBase & { kind: 'images'; options: ImageOptions })
  | (JobBase & { kind: 'pdf'; options: PdfOptions })
  | (JobBase & { kind: 'tts'; options: TtsOptions })

/** Contesto del disegno: immagini e stili del progetto aperto */
export interface ExportContext {
  assets: string[]
  fonts: ProjectFont[]
  styles: Record<string, string>
  variables?: Variables
}

/** Fino a quanti file la finestra offre di aprirli uno per uno, invece della sola cartella */
export const MAX_OPEN_FILES = 6

export interface ExportResult {
  files: number
  folders: string[]
  /** I primi file scritti (al massimo MAX_OPEN_FILES + 1): pochi si aprono uno per uno */
  paths?: string[]

  warnings: Message[]
  cancelled: boolean
}

export interface ExportProgress {
  done: number
  total: number
}

// ——— Scene: ciò che la finestra di esportazione disegna ———

export type CardMode = 'trim' | 'cut' | 'bleed'

export interface SceneItem {
  x: number
  y: number
  template: Template
  side: Side
  /** 'trim': angoli arrotondati; 'cut': rettangolo di taglio; 'bleed': con l'abbondanza */
  mode: CardMode
  /** Rotazione in senso orario: la posizione è l'angolo in alto a sinistra della carta ruotata */
  rotate?: 0 | 90 | 270
  /** Parte della carta da non disegnare a sinistra e a destra, in mm (nei fogli da piegare) */
  crop?: { l: number; r: number }
  /** Ingrandimento della carta: minore di 1 nei fogli di prova */
  zoom?: number
}

export interface SceneLine {
  x1: number
  y1: number
  x2: number
  y2: number
  /** Tratteggiata: la linea di piegatura */
  dash?: boolean
}

export interface SceneLabel {
  x: number
  y: number
  text: string
  /** Altezza del testo in mm */
  size: number
}

export interface ScenePage {
  width: number
  height: number
  items: SceneItem[]
  lines: SceneLine[]
  /** Solo questa parte della pagina mostra le carte: una parte di un poster */
  clip?: { x: number; y: number; w: number; h: number }
  /** Scritte sulla pagina, per esempio la posizione della parte di un poster */
  labels?: SceneLabel[]
}

export interface Scene {
  pages: ScenePage[]
  /** Pixel per mm */
  scale: number
  /** null: sfondo trasparente */
  background: string | null
  lineColor: string
  lineWidth: number
  linesOver: boolean
}

// ——— Carte e copie ———

export interface Instance {
  card: ExportCard
  /** Copia, da 1 */
  copy: number
}

/** La carta della copia `copy`: con perCopy ha il suo template */
export function copyOf(card: ExportCard, copy: number): ExportCard {
  const t = card.perCopy?.[copy - 1]
  return t ? { ...card, template: t } : card
}

/** Le carte ripetute secondo amount; senza copie, una per riga (anche se amount è 0) */
export function expandCopies(cards: ExportCard[], copies: boolean): Instance[] {
  const out: Instance[] = []
  for (const card of cards) {
    const n = copies ? card.amount : 1
    for (let copy = 1; copy <= n; copy++) out.push({ card: copyOf(card, copy), copy })
  }
  return out
}

export function sidesOf(choice: SidesChoice): Side[] {
  return choice === 'both' ? ['front', 'back'] : [choice]
}

// ——— Nomi dei file ———

// caratteri non ammessi nei nomi di file su Windows, compresi quelli di controllo
// eslint-disable-next-line no-control-regex
const UNSAFE = /[\\:*?"<>|\u0000-\u001f]/g

/** Ripulisce un nome per il file system, senza uscire dalla cartella con .. */
export function safeName(s: string): string {
  const v = s.replace(UNSAFE, '_').replace(/\//g, '_').trim().replace(/^\.+/, '_')
  // nomi che Windows riserva ai dispositivi (con o senza estensione): con_1.png non si scrive
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(v)) return `_${v}`
  return v || '_'
}

export interface NameParts {
  set: string
  n: number
  /** Cifre di %n: con 12 carte 01, 02, ... */
  digits: number
  copy: number
  side: Side
  fields: Record<string, string>
}

/** Percorso relativo del file, senza estensione, dal modello di nome */
export function fileName(pattern: string, p: NameParts): string {
  const src = pattern.trim() || '%set/%n'
  const segments = src.split('/').map((seg) =>
    seg
      .replace(/%set/g, p.set)
      .replace(/%n/g, String(p.n).padStart(p.digits, '0'))
      .replace(/%copy/g, String(p.copy))
      .replace(/%side/g, p.side)
      .replace(/\{([^{}]+)\}/g, (_, f: string) => p.fields[f.trim()] ?? '')
  )
  return segments.map(safeName).join('/')
}

/** Aggiunge _2, _3, ... ai nomi già usati */
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>()
  return names.map((n) => {
    const key = n.toLowerCase()
    const count = (seen.get(key) ?? 0) + 1
    seen.set(key, count)
    return count === 1 ? n : `${n}_${count}`
  })
}

/** Completa il modello: con entrambi i lati serve %side, con le copie %copy */
export function effectivePattern(o: ImageOptions): string {
  let p = o.pattern.trim() || DEFAULT_IMAGE.pattern
  if (o.sides === 'both' && !p.includes('%side')) p += '_%side'
  if (o.copies && !p.includes('%copy')) p += '_%copy'
  return p
}

// ——— PDF ———

export const PAGE_SIZES: Record<Exclude<PageSize, 'custom'>, [number, number]> = {
  A4: [210, 297],
  A3: [297, 420],
  Letter: [215.9, 279.4]
}

export function pageSize(o: PdfOptions): { width: number; height: number } {
  const [w, h] = o.page === 'custom' ? [o.pageWidth, o.pageHeight] : PAGE_SIZES[o.page]
  const [a, b] = [Math.min(w, h), Math.max(w, h)]
  return o.landscape ? { width: b, height: a } : { width: a, height: b }
}

export interface Grid {
  cols: number
  rows: number
  /** Riquadro di una carta con l'eventuale abbondanza */
  cellW: number
  cellH: number
  gap: number
  /** Angolo in alto a sinistra della griglia, centrata nella pagina */
  x0: number
  y0: number
  bleed: number
  /** Carte ruotate di 90°: la cella ha larghezza e altezza scambiate */
  rotated: boolean
}

/**
 * Con l'abbondanza le carte si toccano: i segni di taglio restano fuori dalla griglia.
 * Senza, le carte sono separate dalla spaziatura.
 */
export function pdfGrid(
  o: PdfOptions,
  card: { width: number; height: number; bleed: number }
): Grid {
  // nella piegatura la cella è la coppia fronte e retro, che non si ruota
  const upright = gridFor(o, o.fold ? { ...card, width: 2 * card.width } : card, false)
  if (!o.autoRotate || o.layout === 'fixed' || o.fold) return upright
  const turned = gridFor(o, card, true)
  // si ruota quando la carta dritta non entra e ruotata sì, o quando ruotata ne entrano di più
  if (gridOverflows(upright) && !gridOverflows(turned)) return turned
  if (gridOverflows(turned)) return upright
  return turned.cols * turned.rows > upright.cols * upright.rows ? turned : upright
}

function gridFor(
  o: PdfOptions,
  card: { width: number; height: number; bleed: number },
  rotated: boolean
): Grid {
  const page = pageSize(o)
  const bleed = o.bleed ? card.bleed : 0
  const w = card.width + 2 * bleed
  const h = card.height + 2 * bleed
  const [cellW, cellH] = rotated ? [h, w] : [w, h]
  const gap = o.bleed ? 0 : Math.max(0, o.spacing)
  const availW = page.width - 2 * o.margin
  const availH = page.height - 2 * o.margin
  const fit = (avail: number, cell: number): number =>
    Math.max(1, Math.floor((avail + gap + 1e-6) / (cell + gap)))
  const cols = o.layout === 'fixed' ? Math.max(1, o.cols) : fit(availW, cellW)
  const rows = o.layout === 'fixed' ? Math.max(1, o.rows) : fit(availH, cellH)
  const gridW = cols * cellW + (cols - 1) * gap
  const gridH = rows * cellH + (rows - 1) * gap
  return {
    cols,
    rows,
    cellW,
    cellH,
    gap,
    x0: (page.width - gridW) / 2,
    y0: (page.height - gridH) / 2,
    bleed,
    rotated
  }
}

/** La griglia esce dalla pagina: troppe righe o colonne per il formato */
export function gridOverflows(g: Grid): boolean {
  return g.x0 < -1e-6 || g.y0 < -1e-6
}

/**
 * Specchiatura dei retri: girando il foglio sul lato lungo di una pagina verticale le colonne
 * si invertono; sul lato corto (o sul lato lungo di una pagina orizzontale) le righe.
 */
export function mirrorsX(o: PdfOptions): boolean {
  const page = pageSize(o)
  const portrait = page.height >= page.width
  return (o.duplex === 'long') === portrait
}

export interface PlacedCard {
  x: number
  y: number
  instance: Instance
  side: Side
}

/** Posizione della cella i di una pagina, sul fronte o sul retro specchiato */
export function cellPosition(
  o: PdfOptions,
  g: Grid,
  i: number,
  back: boolean
): { x: number; y: number } {
  const page = pageSize(o)
  const col = i % g.cols
  const row = Math.floor(i / g.cols)
  let x = g.x0 + col * (g.cellW + g.gap)
  let y = g.y0 + row * (g.cellH + g.gap)
  if (back && o.duplex !== 'none') {
    if (mirrorsX(o)) x = page.width - x - g.cellW
    else y = page.height - y - g.cellH
    x += o.offsetX
    y += o.offsetY
  }
  return { x, y }
}

export interface PdfPagePlan {
  side: Side
  cards: PlacedCard[]
}

/**
 * Pagine del PDF. Senza fronte-retro tutti i fronti, poi tutti i retri; con il fronte-retro
 * ogni pagina di fronti è seguita dalla pagina dei retri corrispondenti.
 */
export function planPdfPages(o: PdfOptions, g: Grid, instances: Instance[]): PdfPagePlan[] {
  const per = g.cols * g.rows
  const chunks: Instance[][] = []
  for (let i = 0; i < instances.length; i += per) chunks.push(instances.slice(i, i + per))
  const page = (chunk: Instance[], side: Side): PdfPagePlan => ({
    side,
    cards: chunk.map((instance, i) => ({
      ...cellPosition(o, g, i, side === 'back'),
      instance,
      side
    }))
  })
  if (o.duplex !== 'none') return chunks.flatMap((c) => [page(c, 'front'), page(c, 'back')])
  return sidesOf(o.sides).flatMap((side) => chunks.map((c) => page(c, side)))
}

/**
 * Segni di taglio di una pagina, sulle linee di rifilo delle carte. Con `local` (più set di
 * misure diverse sulla pagina) le linee verticali restano all'altezza delle carte che tagliano,
 * per non attraversare gli altri set: si taglia prima tra un set e l'altro, poi le carte.
 */
export function cropMarks(o: PdfOptions, g: Grid, cards: PlacedCard[], local = false): SceneLine[] {
  if (o.marks === 'none' || !cards.length) return []
  const page = pageSize(o)
  const trims = cards.map((c) => ({
    l: c.x + g.bleed,
    t: c.y + g.bleed,
    r: c.x + g.cellW - g.bleed,
    b: c.y + g.cellH - g.bleed
  }))
  const round = (v: number): number => Math.round(v * 1000) / 1000
  if (o.marks === 'lines') {
    const xs = [...new Set(trims.flatMap((t) => [round(t.l), round(t.r)]))]
    const ys = [...new Set(trims.flatMap((t) => [round(t.t), round(t.b)]))]
    const y1 = local ? Math.min(...cards.map((c) => c.y)) : 0
    const y2 = local ? Math.max(...cards.map((c) => c.y + g.cellH)) : page.height
    return [
      ...xs.map((x) => ({ x1: x, y1, x2: x, y2 })),
      ...ys.map((y) => ({ x1: 0, y1: y, x2: page.width, y2: y }))
    ]
  }
  // angoli: trattini che partono dal bordo dell'abbondanza e vanno verso l'esterno
  const out: SceneLine[] = []
  const len = o.markLength
  const d = g.bleed
  for (const t of trims) {
    for (const x of [t.l, t.r]) {
      out.push({ x1: x, y1: t.t - d - len, x2: x, y2: t.t - d })
      out.push({ x1: x, y1: t.b + d, x2: x, y2: t.b + d + len })
    }
    for (const y of [t.t, t.b]) {
      out.push({ x1: t.l - d - len, y1: y, x2: t.l - d, y2: y })
      out.push({ x1: t.r + d, y1: y, x2: t.r + d + len, y2: y })
    }
  }
  return out
}

// ——— Tabletop Simulator ———

export const TTS_MAX_COLS = 10
export const TTS_MAX_ROWS = 7
/** Oltre questa risoluzione le carte non guadagnano nulla in Tabletop Simulator */
export const TTS_MAX_DPI = 300

/**
 * Griglia del foglio per n carte: l'ultima posizione resta alla carta nascosta, quindi servono
 * n + 1 posizioni. Si sceglie la griglia con meno posizioni vuote e, a parità, il foglio più
 * vicino al quadrato.
 */
export function ttsAutoGrid(
  n: number,
  cardW: number,
  cardH: number
): { cols: number; rows: number } {
  let best = { cols: TTS_MAX_COLS, rows: TTS_MAX_ROWS, slots: Infinity, shape: Infinity }
  const need = Math.min(n, TTS_MAX_COLS * TTS_MAX_ROWS - 1) + 1
  for (let cols = 2; cols <= TTS_MAX_COLS; cols++)
    for (let rows = 2; rows <= TTS_MAX_ROWS; rows++) {
      const slots = cols * rows
      if (slots < need) continue
      const shape = Math.abs(Math.log((cols * cardW) / (rows * cardH)))
      if (slots < best.slots || (slots === best.slots && shape < best.shape - 1e-9))
        best = { cols, rows, slots, shape }
    }
  return { cols: best.cols, rows: best.rows }
}

/** Pixel per mm del foglio: entro la dimensione massima e senza superare 300 DPI */
export function ttsScale(
  cols: number,
  rows: number,
  cardW: number,
  cardH: number,
  maxSize: number
): number {
  const s = Math.min(maxSize / (cols * cardW), maxSize / (rows * cardH), TTS_MAX_DPI / 25.4)
  // carte di larghezza intera in pixel: Tabletop Simulator divide il foglio in parti uguali
  return Math.floor(cardW * s) / cardW
}

export interface TtsSheet {
  faceUrl: string
  backUrl: string
  cols: number
  rows: number
  uniqueBack: boolean
}

export interface TtsDeckCard {
  /** Indice del foglio (da 0) e posizione nel foglio */
  sheet: number
  slot: number
  nickname: string
  description: string
  /** Tag e snap point della carta, da ttsExtras */
  extras?: TtsExtras
}

/** Tag e snap point di un componente in Tabletop Simulator */
export interface TtsExtras {
  tags: string[]
  snaps: SnapPoint[]
}

/** Tag del template e snap point dei livelli del fronte, da un template legato ai dati */
export function ttsExtras(t: Template): TtsExtras {
  return { tags: parseTags(t.ttsTags), snaps: snapPoints(t.front) }
}

/**
 * Snap point in coordinate dell'oggetto di Tabletop Simulator. Le coordinate sono locali: si
 * moltiplicano per la scala dell'oggetto e, in larghezza, per l'allungamento con cui TTS adatta
 * il pezzo base (la carta da poker, la tessera quadrata) alle proporzioni dell'immagine. A
 * rotazione Y 180 (come gli oggetti esportati) l'immagine è dritta per chi guarda il tavolo,
 * quindi la sua destra è la X locale negativa e il suo basso la Z locale positiva. Sulle
 * tessere la rotazione di TTS va nello stesso verso di quella di Stella, sulle carte al contrario
 * (verificato in TTS, ottobre 2026: con 90 su una plancia esportata come carta l'oggetto girava
 * in senso antiorario, su una plancia tessera gli angoli tornavano solo senza invertirli)
 */
export function ttsSnapPoints(
  snaps: SnapPoint[],
  size: { w: number; h: number },
  scale: number,
  /** Allungamento in larghezza del pezzo base, da ttsStretch */
  stretch = 1,
  /** Rotazione al contrario: sulle carte */
  reversed = false
): Record<string, unknown>[] {
  const k = TTS_UNITS_PER_MM / (scale || 1)
  return snaps.map((p) => ({
    Position: {
      x: round3((-(p.x - size.w / 2) * k) / (stretch || 1)),
      y: TTS_SNAP_Y,
      z: round3((p.y - size.h / 2) * k)
    },
    ...(p.angle !== null
      ? { Rotation: { x: 0, y: round3(reversed ? (360 - p.angle) % 360 : p.angle), z: 0 } }
      : {}),
    ...(p.tags.length ? { Tags: p.tags } : {})
  }))
}

/**
 * Quanto TTS allunga in larghezza la carta da poker per darle le proporzioni dell'immagine: anche
 * gli snap point della carta si allungano. Con una plancia 126 × 88 esportata come carta uscivano
 * larghi circa il doppio, e ancora del 5% con w / 63 (ottobre 2026). Le tessere e i segnalini
 * non allungano gli snap point: la stessa plancia esportata come plancia li aveva stretti di
 * 1 / 1,43 con la correzione
 */
export function ttsStretch(kind: 'card' | TtsPieceKind, w: number, h: number): number {
  if (kind === 'card') return (w / h / (63 / POKER_HEIGHT)) * TTS_CARD_SNAP_STRETCH
  return 1
}

/** Campi Tags e AttachedSnapPoints di un oggetto, solo se servono */
function extrasFields(
  extras: TtsExtras | undefined,
  size: { w: number; h: number },
  scale: number,
  stretch: number,
  reversed = false
): Record<string, unknown> {
  if (!extras) return {}
  // in TTS i tag sono un elenco di testi: { labels: [...] } impediva di caricare l'oggetto
  return {
    ...(extras.tags.length ? { Tags: extras.tags } : {}),
    ...(extras.snaps.length
      ? { AttachedSnapPoints: ttsSnapPoints(extras.snaps, size, scale, stretch, reversed) }
      : {})
  }
}

/** Unione dei tag di più oggetti: un mazzo li prende tutti, così si aggancia come le sue carte */
function unionTags(all: (TtsExtras | undefined)[]): Record<string, unknown> {
  const tags = parseTags(all.flatMap((e) => e?.tags ?? []).join(','))
  return tags.length ? { Tags: tags } : {}
}

// Misure in Tabletop Simulator. TTS non ha una scala assoluta: un oggetto a scala 1 ha una misura
// fissa per tipo, qualunque sia la sua immagine. Queste sono misurate in TTS (ottobre 2026) con il
// righello, in unità (che TTS mostra come pollici): una carta da poker 63 × 88 è larga 2,25 (la
// carta segue le proporzioni dell'immagine con l'altezza della carta da poker), una tessera 2,06
// in altezza, un segnalino circa 3,2 in larghezza (l'altezza segue le proporzioni
// dell'immagine: una pedina alta e stretta resta larga 3,2). Le scale si calcolano in modo che
// tutto stia nelle proporzioni vere rispetto a una carta da 63 mm.

/** Unità di TTS per mm: la carta da 63 mm a scala 1 è larga 2,25 */
export const TTS_UNITS_PER_MM = 2.25 / 63
// 2 misurato su una tessera quadrata; con le plance accanto alle carte risultava grande del 3% circa
const TTS_TILE_SIZE = 2.06
/** Lato lungo della carta da poker, in mm */
const POKER_HEIGHT = 88
const TTS_TOKEN_SIZE = 3.2
/** Allungamento in più degli snap point sulle carte, misurato in TTS */
const TTS_CARD_SNAP_STRETCH = 1.05
/** Altezza degli snap point sull'oggetto, in unità locali */
const TTS_SNAP_Y = 0

const round3 = (v: number): number => Math.round(v * 1000) / 1000

/**
 * Scala di una carta alta h mm. In TTS la carta prende le proporzioni dell'immagine e a scala 1
 * è alta quanto una carta da poker (88 mm): verificato con carte 63 × 176 (scala 2) e, di
 * traverso, 126 × 88 (scala 1), ottobre 2026
 */
export function ttsCardScale(h: number): number {
  return round3(h / POKER_HEIGHT)
}

/** Scala di un segnalino o di una tessera la cui immagine misura w × h mm */
export function ttsPieceScale(kind: TtsPieceKind, w: number, h: number): number {
  // il segnalino si misura sulla larghezza
  if (isTokenLike(kind)) return round3((w * TTS_UNITS_PER_MM) / TTS_TOKEN_SIZE)
  // la tessera si misura sull'altezza: giuste in TTS una plancia 120 × 88 a scala 1,5 circa e
  // una 63 × 176 con la scala calcolata sull'altezza (ottobre 2026)
  return round3((h * TTS_UNITS_PER_MM) / TTS_TILE_SIZE)
}

/**
 * Posizione sul tavolo: le carte a faccia in giù, segnalini e tessere a faccia in su. La pedina
 * (segnalino in piedi) ha la figura nel piano X-Y: lì va la scala, e Z, lo spessore, resta 1
 * (verificato in TTS, ottobre 2026: con la scala su Z la pedina era alta e stretta)
 */
function transform(
  y = 1,
  faceDown = true,
  scale = 1,
  x = 0,
  standUp = false
): Record<string, number> {
  return {
    posX: x,
    posY: y,
    posZ: 0,
    rotX: 0,
    rotY: 180,
    rotZ: faceDown ? 180 : 0,
    // lo spessore si dà a parte: in altezza la scala resta 1
    scaleX: scale,
    scaleY: standUp ? scale : 1,
    scaleZ: standUp ? 1 : scale
  }
}

/** Oggetto salvato di Tabletop Simulator: un mazzo, o una carta sola se ce n'è una */
export function ttsSavedObject(
  name: string,
  sheets: TtsSheet[],
  cards: TtsDeckCard[],
  /** Larghezza della carta in mm, per la scala */
  cardWidth = 63,
  /** Altezza della carta in mm: le carte orizzontali sono "di traverso" in TTS */
  cardHeight = 88
): Record<string, unknown> {
  // una carta orizzontale va messa di traverso; la scala viene sempre dall'altezza
  const sideways = cardWidth > cardHeight
  const scale = ttsCardScale(cardHeight)
  const customDeck = (i: number): Record<string, unknown> => ({
    [String(i + 1)]: {
      FaceURL: sheets[i].faceUrl,
      BackURL: sheets[i].backUrl,
      NumWidth: sheets[i].cols,
      NumHeight: sheets[i].rows,
      BackIsHidden: true,
      UniqueBack: sheets[i].uniqueBack,
      Type: 0
    }
  })
  const cardId = (c: TtsDeckCard): number => (c.sheet + 1) * 100 + c.slot
  const cardObject = (c: TtsDeckCard): Record<string, unknown> => ({
    Name: 'Card',
    Transform: transform(1, true, scale),
    Nickname: c.nickname,
    Description: c.description,
    CardID: cardId(c),
    CustomDeck: customDeck(c.sheet),
    Locked: false,
    Grid: true,
    Snap: true,
    Hands: true,
    SidewaysCard: sideways,
    ...extrasFields(
      c.extras,
      { w: cardWidth, h: cardHeight },
      scale,
      ttsStretch('card', cardWidth, cardHeight),
      true
    )
  })
  // "CardCustom" e "DeckCustom" sono i nomi che TTS dà agli oggetti fatti con Objects > Custom:
  // solo con questi il menu dell'oggetto ha la voce Custom. Un mazzo con più fogli resta "Deck"
  const object =
    cards.length === 1
      ? { ...cardObject(cards[0]), Name: 'CardCustom', Nickname: cards[0].nickname || name }
      : {
          Name: sheets.length === 1 ? 'DeckCustom' : 'Deck',
          Transform: transform(1, true, scale),
          Nickname: name,
          Description: '',
          DeckIDs: cards.map(cardId),
          CustomDeck: Object.assign({}, ...sheets.map((_, i) => customDeck(i))),
          ContainedObjects: cards.map(cardObject),
          Locked: false,
          Grid: true,
          Snap: true,
          Hands: false,
          SidewaysCard: sideways,
          ...unionTags(cards.map((c) => c.extras))
        }
  return savedFile(object)
}

function savedFile(
  object: Record<string, unknown> | Record<string, unknown>[]
): Record<string, unknown> {
  return {
    SaveName: '',
    GameMode: '',
    Gravity: 0.5,
    PlayArea: 0.5,
    Date: '',
    Table: '',
    Sky: '',
    Note: '',
    Rules: '',
    XmlUI: '',
    LuaScript: '',
    LuaScriptState: '',
    ObjectStates: Array.isArray(object) ? object : [object],
    TabStates: {},
    VersionNumber: ''
  }
}

/** Un segnalino o una tessera, con le sue immagini */
export interface TtsPiece {
  faceUrl: string
  /** Retro delle tessere; i segnalini mostrano sotto il fronte specchiato */
  backUrl: string
  nickname: string
  description: string
  /** Quante copie mettere nel sacchetto */
  count: number
  /** Tag e snap point, da ttsExtras */
  extras?: TtsExtras
  /** Misure della carta in mm, per la posizione degli snap point */
  card?: { w: number; h: number }
}

/** Forme delle tessere di Tabletop Simulator: quadrata, esagonale, rotonda, con angoli arrotondati */
export function ttsTileType(t: Pick<Template, 'shape' | 'cornerRadius'>): 0 | 1 | 2 | 3 {
  if (t.shape === 'hexagon') return 1
  if (t.shape === 'ellipse') return 2
  if ((t.shape ?? 'rect') === 'rect' && t.cornerRadius > 0) return 3
  return 0
}

/** Colore di Tabletop Simulator (componenti da 0 a 1) da un colore #RGB o #RRGGBB */
export function ttsColor(hex: string): { r: number; g: number; b: number } {
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3 || h.length === 4)
    h = h
      .slice(0, 3)
      .split('')
      .map((c) => c + c)
      .join('')
  const v = /^[0-9a-f]{6}/i.test(h) ? parseInt(h.slice(0, 6), 16) : 0xffffff
  const c = (n: number): number => Math.round((n / 255) * 1000) / 1000
  return { r: c((v >> 16) & 255), g: c((v >> 8) & 255), b: c(v & 255) }
}

/** Oggetti fatti da un'immagine per carta: segnalini, tessere e plance */
export type TtsPieceKind = 'token' | 'tile' | 'board' | 'standee'

/** Segnalini e pedine: Custom_Token ritagliato sulla sagoma, con la sola immagine del fronte */
export const isTokenLike = (kind: TtsPieceKind): boolean => kind === 'token' || kind === 'standee'

/**
 * Oggetto salvato con segnalini, tessere o plance. Segnalini e tessere: uno solo se il set ne ha
 * uno, altrimenti un sacchetto che li contiene tutti, copie comprese (le copie usano le stesse
 * immagini, quindi si impilano). Le plance non vanno in un sacchetto: si mettono una accanto
 * all'altra sul tavolo e non si impilano.
 */
export function ttsSavedPieces(
  name: string,
  kind: TtsPieceKind,
  settings: Pick<TtsSetObject, 'thickness' | 'edgeColor'>,
  tileType: 0 | 1 | 2 | 3,
  pieces: TtsPiece[],
  /** Misure dell'immagine in mm, per la scala */
  size: { w: number; h: number }
): Record<string, unknown> {
  const thickness = round3(Math.max(0.1, settings.thickness) * TTS_UNITS_PER_MM)
  const scale = ttsPieceScale(kind, size.w, size.h)
  const pieceObject = (p: TtsPiece, x = 0): Record<string, unknown> => ({
    Name: isTokenLike(kind) ? 'Custom_Token' : 'Custom_Tile',
    Transform: transform(1, false, scale, x, kind === 'standee'),
    Nickname: p.nickname,
    Description: p.description,
    // nelle tessere e nelle plance la tinta colora solo i lati, non le immagini
    ColorDiffuse: isTokenLike(kind) ? { r: 1, g: 1, b: 1 } : ttsColor(settings.edgeColor),
    Locked: false,
    Grid: true,
    Snap: true,
    Hands: false,
    CustomImage: {
      ImageURL: p.faceUrl,
      ImageSecondaryURL: isTokenLike(kind) ? '' : p.backUrl,
      ImageScalar: 1,
      WidthScale: 0,
      ...(isTokenLike(kind)
        ? {
            // la pedina sta in piedi sul tavolo
            CustomToken: {
              Thickness: thickness,
              MergeDistancePixels: 15,
              StandUp: kind === 'standee',
              Stackable: true
            }
          }
        : {
            // Stretch (in TTS "Stretch to Aspect Ratio"): la tessera prende le proporzioni
            // dell'immagine, cioè della carta; senza, arriva quadrata. Le plance sono "Rounded"
            CustomTile: {
              Type: kind === 'board' ? 3 : tileType,
              Thickness: thickness,
              Stackable: kind === 'tile',
              Stretch: true
            }
          })
    },
    ...extrasFields(
      p.extras,
      p.card ?? size,
      scale,
      ttsStretch(kind, (p.card ?? size).w, (p.card ?? size).h)
    )
  })
  const all = pieces.flatMap((p) => Array.from({ length: Math.max(1, p.count) }, () => p))
  if (kind === 'board') {
    // una accanto all'altra, con un po' di spazio in mezzo
    const step = Math.max(size.w, size.h) * TTS_UNITS_PER_MM + 1
    return savedFile(
      all.map((p, i) => ({
        ...pieceObject(p, round3(i * step)),
        Nickname: p.nickname || (all.length === 1 ? name : `${name} ${i + 1}`)
      }))
    )
  }
  const object =
    all.length === 1
      ? { ...pieceObject(all[0]), Nickname: all[0].nickname || name }
      : bag(
          name,
          all.map((p) => pieceObject(p))
        )
  return savedFile(object)
}

function bag(name: string, contained: Record<string, unknown>[]): Record<string, unknown> {
  return {
    Name: 'Bag',
    Transform: transform(1, false),
    Nickname: name,
    Description: '',
    ColorDiffuse: { r: 0.7, g: 0.7, b: 0.7 },
    Locked: false,
    Grid: true,
    Snap: true,
    Hands: false,
    ContainedObjects: contained
  }
}

// Un dado a sei facce è un modello 3D fatto da Stella: un cubo (file .obj) con la sua immagine,
// sei carte in un foglio 3 × 2. La carta k (da 0) va sulla faccia del valore k + 1; le facce
// opposte fanno 7 come nei dadi veri. Il modello è scritto in coordinate destrorse con Y in alto,
// come tutti i file .obj; Tabletop Simulator (Unity) lo carica specchiando l'asse X, quindi nelle
// rotazioni la faccia +X del file diventa la −X del tavolo.

type Vec = [number, number, number]

/** Faccia di ogni valore nel file .obj: direzione verso fuori e "in alto" dell'immagine */
const DIE_FACES: { value: number; normal: Vec; up: Vec }[] = [
  { value: 1, normal: [0, 1, 0], up: [0, 0, -1] },
  { value: 2, normal: [0, 0, 1], up: [0, 1, 0] },
  { value: 3, normal: [1, 0, 0], up: [0, 1, 0] },
  { value: 4, normal: [-1, 0, 0], up: [0, 1, 0] },
  { value: 5, normal: [0, 0, -1], up: [0, 1, 0] },
  { value: 6, normal: [0, -1, 0], up: [0, 0, 1] }
]

/** Rotazione (gradi, come in Unity) che porta in alto la faccia di ogni valore */
const DIE_ROTATIONS: Record<number, Vec> = {
  1: [0, 0, 0],
  6: [180, 0, 0],
  2: [270, 0, 0],
  5: [90, 0, 0],
  // la +X del file è la −X del tavolo
  3: [0, 0, 270],
  4: [0, 0, 90]
}

const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
]

/** Celle del foglio delle facce di un dado */
export const TTS_DIE_COLS = 3
export const TTS_DIE_ROWS = 2

/**
 * Cubo di lato `side` (unità di Tabletop Simulator) centrato nell'origine, con le coordinate
 * dell'immagine: la carta k nella cella (k % 3, k / 3) del foglio, dritta guardandola da fuori.
 */
export function ttsDieObj(side: number): string {
  const h = side / 2
  const f = (n: number): string => String(Math.round(n * 1e5) / 1e5 || 0)
  const vs: string[] = []
  const vts: string[] = []
  const fs: string[] = []
  // un filo di margine dentro la cella, perché il filtro non prenda la carta vicina
  const inset = 0.004
  for (const [i, face] of DIE_FACES.entries()) {
    const n = face.normal
    const u = face.up
    const r = cross(u, n)
    const at = (a: number, b: number): Vec =>
      [0, 1, 2].map((j) => (n[j] + a * r[j] + b * u[j]) * h) as Vec
    // in basso a sinistra, in basso a destra, in alto a destra, in alto a sinistra: antiorario
    for (const [a, b] of [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1]
    ])
      vs.push(`v ${at(a, b).map(f).join(' ')}`)
    const k = face.value - 1
    const col = k % TTS_DIE_COLS
    const row = Math.floor(k / TTS_DIE_COLS)
    const u0 = col / TTS_DIE_COLS + inset
    const u1 = (col + 1) / TTS_DIE_COLS - inset
    // v cresce dal basso dell'immagine
    const v1 = 1 - row / TTS_DIE_ROWS - inset
    const v0 = 1 - (row + 1) / TTS_DIE_ROWS + inset
    vts.push(
      `vt ${f(u0)} ${f(v0)}`,
      `vt ${f(u1)} ${f(v0)}`,
      `vt ${f(u1)} ${f(v1)}`,
      `vt ${f(u0)} ${f(v1)}`
    )
    const c = (j: number): string => `${i * 4 + j}/${i * 4 + j}`
    fs.push(`f ${c(1)} ${c(2)} ${c(3)}`, `f ${c(1)} ${c(3)} ${c(4)}`)
  }
  return ['# Stella: dado a sei facce', 'o die', ...vs, ...vts, ...fs].join('\n') + '\n'
}

/** Un dado: l'immagine delle sei facce e i valori */
export interface TtsDie {
  imageUrl: string
  /** Valore mostrato da Tabletop Simulator per ogni faccia, dalla 1 alla 6 */
  values: string[]
  nickname: string
  description: string
  count: number
}

/** Per ogni faccia del dado, il valore e la rotazione che la porta in alto */
export function ttsDieRotations(values: string[]): Record<string, unknown>[] {
  return DIE_FACES.map((face) => {
    const [x, y, z] = DIE_ROTATIONS[face.value]
    return { Value: values[face.value - 1] || String(face.value), Rotation: { x, y, z } }
  })
}

/** Oggetto salvato con i dadi del set: uno solo, o un sacchetto con tutti, copie comprese */
export function ttsSavedDice(
  name: string,
  dice: TtsDie[],
  meshUrl: string
): Record<string, unknown> {
  const dieObject = (d: TtsDie): Record<string, unknown> => ({
    Name: 'Custom_Model',
    Transform: transform(1, false),
    Nickname: d.nickname,
    Description: d.description,
    ColorDiffuse: { r: 1, g: 1, b: 1 },
    Locked: false,
    Grid: true,
    Snap: true,
    Hands: true,
    RotationValues: ttsDieRotations(d.values),
    CustomMesh: {
      MeshURL: meshUrl,
      DiffuseURL: d.imageUrl,
      NormalURL: '',
      ColliderURL: '',
      Convex: true,
      MaterialIndex: 0,
      // 2: dado, si tira e mostra il valore della faccia in alto
      TypeIndex: 2,
      CustomShader: {
        SpecularColor: { r: 1, g: 1, b: 1 },
        SpecularIntensity: 0,
        SpecularSharpness: 2,
        FresnelStrength: 0
      },
      CastShadows: true
    }
  })
  const all = dice.flatMap((d) => Array.from({ length: Math.max(1, d.count) }, () => d))
  const object =
    all.length === 1
      ? { ...dieObject(all[0]), Nickname: all[0].nickname || name }
      : bag(name, all.map(dieObject))
  return savedFile(object)
}

/** Cartella Saved Objects di Tabletop Simulator per sistema operativo */
export function defaultTtsFolder(platform: string, home: string, documents: string): string {
  if (platform === 'darwin') return `${home}/Library/Tabletop Simulator/Saves/Saved Objects`
  if (platform === 'win32')
    return `${documents}\\My Games\\Tabletop Simulator\\Saves\\Saved Objects`
  return `${home}/.local/share/Tabletop Simulator/Saves/Saved Objects`
}

/**
 * Indirizzo di un'immagine locale per i FaceURL/BackURL di Tabletop Simulator: file:/// seguito
 * dal percorso così com'è, senza codifica (spazi e lettere accentate come sono). Su Windows TTS
 * legge solo la forma che scrive lui stesso, con le \; con le / e i %20 di un URL standard non
 * carica le carte. Sul Mac e su Linux il percorso comincia con /, quindi file:////Users/...: è la
 * forma di Tabletop Creator, l'unica con cui "Upload all loaded files" del Cloud Manager di TTS
 * trova i file (con file:///Users/... o con i %20 si blocca).
 */
export function ttsImageUrl(path: string, platform: string): string {
  return 'file:///' + (platform === 'win32' ? path.replace(/\//g, '\\') : path)
}
