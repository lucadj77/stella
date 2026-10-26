import { mkdir, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import {
  defaultTtsFolder,
  ttsImageUrl,
  pageSize,
  safeName,
  uniqueNames,
  ttsSavedObject,
  ttsSavedPieces,
  ttsSavedDice,
  ttsDieObj,
  TTS_UNITS_PER_MM,
  ttsTileType,
  type ExportCard,
  type ExportContext,
  type ExportJob,
  type ExportProgress,
  type ExportResult,
  MAX_OPEN_FILES,
  type ExportSet,
  type ImageOptions,
  type PdfOptions,
  type Scene,
  type TtsDeckCard,
  type TtsOptions,
  type TtsPiece,
  isTokenLike,
  type TtsPieceKind,
  type TtsDie,
  type TtsSheet
} from '../../shared/export'
import {
  cardPage,
  imageExtension,
  planImages,
  planPdf,
  piecePage,
  diePage,
  planTts,
  sheetPage,
  type TtsChunk,
  type TtsPiecePlan,
  type TtsSetPlan
} from '../../shared/exportPlan'
import { plainText } from '../../shared/model/markup'
import { palette, resolveColor } from '../../shared/model/variables'
import { msg } from '../../shared/messages'
import type { Side, Template } from '../../shared/model/template'
import { isLanguageCode } from '../../shared/model/language'

// Esegue un'esportazione: prepara le scene, le fa disegnare alla finestra nascosta e scrive i file.
// La finestra arriva da chi chiama (window.ts nell'app, un iframe nella versione web), così questo
// file non dipende da Electron.

/** 96 pixel CSS per pollice: le pagine del PDF si misurano così */
const PDF_SCALE = 96 / 25.4

/** Immagine catturata, come NativeImage di Electron */
export interface CapturedImage {
  toPNG(): Buffer
  toJPEG(quality: number): Buffer
}

/** Ciò che disegna le scene: la finestra nascosta di Electron o, nel browser, un iframe */
export interface RenderWindow {
  /** Disegna la scena e aspetta che immagini, font e adattamenti del testo siano finiti */
  show(scene: Scene, width: number, height: number): Promise<void>
  capture(width: number, height: number): Promise<CapturedImage>
  toWebp(png: Buffer, quality: number): Promise<Buffer>
  toSvg(background: string | null): Promise<Buffer>
  /** PDF delle pagine; null se le pagine sono andate alla stampa del browser e non c'è un file */
  printToPdf(): Promise<Buffer | null>
  close(): void
}

export interface RunEnv {
  openWindow(context: ExportContext): Promise<RenderWindow>
  /** Conversione del PDF in CMYK; null se non riesce, assente dove non si può fare */
  toCmyk?(pdf: Buffer): Promise<Buffer | null>
  /**
   * Versione web: il percorso vero di un file sul computer (il browser ne conosce uno virtuale),
   * per gli indirizzi delle immagini di Tabletop Simulator, e il sistema a cui appartiene
   */
  realPath?(file: string): { path: string; platform: string }
  projectFolder: string
  platform: string
  home: string
  documents: string
  context: ExportContext
  onProgress(p: ExportProgress): void
  isCancelled(): boolean
}

interface Ctx {
  env: RunEnv
  win: RenderWindow
  result: ExportResult
  progress: ExportProgress
  /** Sottocartella della lingua delle carte, se non è la principale */
  language?: string
}

export async function runExport(job: ExportJob, env: RunEnv): Promise<ExportResult> {
  const result: ExportResult = { files: 0, folders: [], warnings: [], cancelled: false }
  const sets = job.sets.filter((s) => s.cards.length)
  if (!sets.length) return result
  const win = await env.openWindow(env.context)
  const ctx: Ctx = {
    env,
    win,
    result,
    progress: { done: 0, total: 0 },
    // il codice diventa il nome di una cartella: solo un codice valido
    ...(job.language && isLanguageCode(job.language) ? { language: job.language } : {})
  }
  try {
    if (job.kind === 'images') await exportImages(ctx, job.options, sets)
    else if (job.kind === 'pdf') await exportPdf(ctx, job.options, sets, job.project)
    else await exportTts(ctx, job.options, sets, job.project)
  } catch (e) {
    if (!(e instanceof Cancelled)) throw e
    result.cancelled = true
  } finally {
    win.close()
  }
  return result
}

class Cancelled extends Error {}

function step(ctx: Ctx): void {
  if (ctx.env.isCancelled()) throw new Cancelled()
  ctx.progress.done += 1
  ctx.env.onProgress({ ...ctx.progress })
}

function outputFolder(ctx: Ctx, folder: string): string {
  const base = folder.trim() ? resolve(folder) : join(ctx.env.projectFolder, 'export')
  const out = ctx.language ? join(base, ctx.language) : base
  if (!ctx.result.folders.includes(out)) ctx.result.folders.push(out)
  return out
}

async function write(ctx: Ctx, file: string, data: Buffer | string): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, data)
  ctx.result.files += 1
  const paths = (ctx.result.paths ??= [])
  if (paths.length <= MAX_OPEN_FILES) paths.push(file)
}

/** Una carta da sola, in pixel interi */
async function renderCard(
  ctx: Ctx,
  t: Template,
  side: Side,
  scale: number,
  opts: { bleed: boolean; mode: 'trim' | 'cut'; background: string | null }
): Promise<CapturedImage> {
  const page = cardPage(t, side, opts.bleed, opts.mode)
  const w = Math.round(page.width * scale)
  const h = Math.round(page.height * scale)
  // pixel interi: la scala si corregge di poco perché la carta riempia tutta l'immagine
  const scene: Scene = {
    pages: [page],
    scale: w / page.width,
    background: opts.background,
    lineColor: '#000',
    lineWidth: 0,
    linesOver: false
  }
  await ctx.win.show(scene, w, h)
  return ctx.win.capture(w, h)
}

// ——— Immagini ———

async function exportImages(ctx: Ctx, o: ImageOptions, sets: ExportSet[]): Promise<void> {
  const folder = outputFolder(ctx, o.folder)
  const ext = imageExtension(o)
  const files = planImages(o, sets)
  ctx.progress.total = files.length
  const scale = o.dpi / 25.4
  const transparent = o.transparent && o.format !== 'jpg'
  for (const f of files) {
    if (f.names.length && ext === 'svg') {
      const page = cardPage(f.card.template, f.side, o.bleed, 'trim')
      await ctx.win.show(
        {
          pages: [page],
          scale,
          background: null,
          lineColor: '#000',
          lineWidth: 0,
          linesOver: false
        },
        page.width * scale,
        page.height * scale
      )
      const data = await ctx.win.toSvg(o.transparent ? null : '#FFFFFF')
      for (const name of f.names) await write(ctx, join(folder, `${name}.svg`), data)
    } else if (f.names.length) {
      const img = await renderCard(ctx, f.card.template, f.side, scale, {
        bleed: o.bleed,
        mode: 'trim',
        background: transparent ? null : '#FFFFFF'
      })
      const data =
        ext === 'jpg'
          ? img.toJPEG(clampQuality(o.quality))
          : ext === 'webp'
            ? await ctx.win.toWebp(img.toPNG(), clampQuality(o.quality))
            : img.toPNG()
      // le copie sono la stessa immagine: si disegna una volta sola
      for (const name of f.names) await write(ctx, join(folder, `${name}.${ext}`), data)
    }
    step(ctx)
  }
}

function clampQuality(q: number): number {
  return Math.max(1, Math.min(100, Math.round(q) || 92))
}

// ——— PDF ———

async function exportPdf(
  ctx: Ctx,
  o: PdfOptions,
  sets: ExportSet[],
  project: string
): Promise<void> {
  const folder = outputFolder(ctx, o.folder)
  const page = pageSize(o)
  const { docs, overflow } = planPdf(o, sets, project)
  let cmykWarned = false
  let printed = false
  for (const set of overflow) ctx.result.warnings.push(msg('export.gridOverflow', { set }))
  ctx.progress.total = docs.length
  for (const doc of docs) {
    const scene: Scene = {
      pages: doc.pages,
      scale: PDF_SCALE,
      background: '#FFFFFF',
      lineColor: o.markColor,
      lineWidth: o.markWidth,
      linesOver: o.marksOver
    }
    await ctx.win.show(scene, page.width * PDF_SCALE, page.height * PDF_SCALE)
    let pdf = await ctx.win.printToPdf()
    if (!pdf) {
      printed = true
      step(ctx)
      continue
    }
    if (o.cmyk) {
      const converted = ctx.env.toCmyk ? await ctx.env.toCmyk(pdf) : null
      if (converted) pdf = converted
      else if (!cmykWarned) {
        ctx.result.warnings.push(msg('export.cmykUnavailable'))
        cmykWarned = true
      }
    }
    await write(ctx, join(folder, `${doc.name}.pdf`), pdf)
    step(ctx)
  }
  if (printed) ctx.result.warnings.push(msg('export.printed'))
}

// ——— Tabletop Simulator ———

interface RenderedSheet {
  face: Buffer
  back: Buffer
  cols: number
  rows: number
  uniqueBack: boolean
}

async function exportTts(
  ctx: Ctx,
  o: TtsOptions,
  sets: ExportSet[],
  project: string
): Promise<void> {
  const env = ctx.env
  const targets: string[] = []
  const lang = ctx.language ? [ctx.language] : []
  if (o.destination !== 'tts') targets.push(join(env.projectFolder, 'export', ...lang, 'tts'))
  if (o.destination !== 'project') {
    const root = o.ttsFolder.trim() || defaultTtsFolder(env.platform, env.home, env.documents)
    targets.push(join(root, safeName(project || 'Stella'), ...lang))
  }
  for (const t of targets) if (!ctx.result.folders.includes(t)) ctx.result.folders.push(t)

  const plans = planTts(o, sets)
  ctx.progress.total = plans.reduce(
    (n, p) =>
      n +
      p.chunks.length * 2 +
      p.pieces.length * (p.object.type === 'token' || p.object.type === 'standee' ? 1 : 2) +
      p.dice.length +
      1,
    0
  )

  // set con nomi che differiscono solo per caratteri non ammessi (a/b e a_b) non si sovrascrivono
  const stems = uniqueNames(plans.map((p) => safeName(p.set.name)))
  for (const [index, plan] of plans.entries()) {
    if (plan.pieces.length) {
      await exportPieces(ctx, o, plan, stems[index], targets)
      continue
    }
    if (plan.dice.length) {
      await exportDice(ctx, o, plan, stems[index], targets)
      continue
    }
    const { set, chunks, uniqueBack: unique } = plan
    if (!chunks.length) continue
    const t0 = chunks[0].cards[0].template

    const sheets: RenderedSheet[] = []
    let singleBack: Buffer | null = null
    for (const chunk of chunks) {
      const face = await renderSheet(ctx, chunk, 'front')
      step(ctx)
      let back: Buffer
      if (unique) back = await renderSheet(ctx, chunk, 'back')
      else {
        singleBack ??= (
          await renderCard(ctx, t0, 'back', chunk.scale, {
            bleed: false,
            mode: 'cut',
            background: '#FFFFFF'
          })
        ).toPNG()
        back = singleBack
      }
      step(ctx)
      sheets.push({ face, back, cols: chunk.cols, rows: chunk.rows, uniqueBack: unique })
    }
    const thumb = (
      await renderCard(ctx, t0, 'front', 256 / t0.width, {
        bleed: false,
        mode: 'trim',
        background: null
      })
    ).toPNG()
    step(ctx)

    const deck: TtsDeckCard[] = []
    chunks.forEach((chunk, sheet) =>
      chunk.cards.forEach((card, slot) => {
        for (let i = 0; i < chunk.counts[slot]; i++)
          deck.push({
            sheet,
            slot,
            nickname: fieldText(card, o.nickname),
            description: fieldText(card, o.description)
          })
      })
    )

    const stem = stems[index]
    for (const target of targets) {
      const ttsSheets: TtsSheet[] = []
      for (let i = 0; i < sheets.length; i++) {
        const s = sheets[i]
        const faceFile = join(target, 'images', `${stem}_faces_${i + 1}.png`)
        await write(ctx, faceFile, s.face)
        let backFile: string
        if (s.uniqueBack) {
          backFile = join(target, 'images', `${stem}_backs_${i + 1}.png`)
          await write(ctx, backFile, s.back)
        } else {
          backFile = join(target, 'images', `${stem}_back.png`)
          if (i === 0) await write(ctx, backFile, s.back)
        }
        ttsSheets.push({
          faceUrl: imageUrl(env, faceFile),
          backUrl: imageUrl(env, backFile),
          cols: s.cols,
          rows: s.rows,
          uniqueBack: s.uniqueBack
        })
      }
      const object = ttsSavedObject(set.name, ttsSheets, deck, t0.width, t0.height)
      await write(ctx, join(target, `${stem}.json`), JSON.stringify(object, null, 2) + '\n')
      // miniatura mostrata da Tabletop Simulator tra gli oggetti salvati
      await write(ctx, join(target, `${stem}.png`), thumb)
    }
  }
}

/** Segnalini o tessere di un set: un'immagine per lato di ogni carta, un sacchetto con le copie */
async function exportPieces(
  ctx: Ctx,
  o: TtsOptions,
  plan: TtsSetPlan,
  stem: string,
  targets: string[]
): Promise<void> {
  const kind = plan.object.type as TtsPieceKind
  const images: { face: Buffer; back: Buffer | null }[] = []
  for (const p of plan.pieces) {
    const face = await renderPiece(ctx, p, 'front', kind)
    step(ctx)
    let back: Buffer | null = null
    if (!isTokenLike(kind)) {
      back = await renderPiece(ctx, p, 'back', kind)
      step(ctx)
    }
    images.push({ face, back })
  }
  const t0 = plan.pieces[0].card.template
  const thumb = (
    await renderCard(ctx, t0, 'front', 256 / Math.max(t0.width, t0.height), {
      bleed: false,
      mode: 'trim',
      background: null
    })
  ).toPNG()
  step(ctx)

  const env = ctx.env
  // numeri con gli zeri davanti: i file restano in ordine anche nelle cartelle
  const digits = String(plan.pieces.length).length
  for (const target of targets) {
    const pieces: TtsPiece[] = []
    for (const [i, p] of plan.pieces.entries()) {
      const n = String(i + 1).padStart(digits, '0')
      const faceFile = join(target, 'images', `${stem}_${n}.png`)
      await write(ctx, faceFile, images[i].face)
      let backUrl = ''
      if (images[i].back) {
        const backFile = join(target, 'images', `${stem}_${n}_back.png`)
        await write(ctx, backFile, images[i].back as Buffer)
        backUrl = imageUrl(env, backFile)
      }
      pieces.push({
        faceUrl: imageUrl(env, faceFile),
        backUrl,
        nickname: fieldText(p.card, o.nickname),
        description: fieldText(p.card, o.description),
        count: p.count
      })
    }
    // il colore del bordo può essere un colore del progetto, scritto per nome
    const edgeColor = resolveColor(plan.object.edgeColor, palette(env.context.variables))
    const settings = { ...plan.object, edgeColor }
    const size = piecePage(t0, 'front', kind)
    const object = ttsSavedPieces(plan.set.name, kind, settings, ttsTileType(t0), pieces, {
      w: size.width,
      h: size.height
    })
    await write(ctx, join(target, `${stem}.json`), JSON.stringify(object, null, 2) + '\n')
    await write(ctx, join(target, `${stem}.png`), thumb)
  }
}

/**
 * Dadi di un set: per ogni dado il foglio delle sei facce; il modello del cubo è uno per set,
 * perché tutte le carte del set hanno la stessa misura
 */
async function exportDice(
  ctx: Ctx,
  o: TtsOptions,
  plan: TtsSetPlan,
  stem: string,
  targets: string[]
): Promise<void> {
  const images: Buffer[] = []
  for (const die of plan.dice) {
    const page = diePage(die)
    const w = Math.round(page.width * die.scale)
    const h = Math.round(page.height * die.scale)
    const scene: Scene = {
      pages: [page],
      scale: w / page.width,
      background: '#FFFFFF',
      lineColor: '#000',
      lineWidth: 0,
      linesOver: false
    }
    await ctx.win.show(scene, w, h)
    images.push((await ctx.win.capture(w, h)).toPNG())
    step(ctx)
  }
  if (plan.dice.some((d) => d.padded))
    ctx.result.warnings.push(msg('export.ttsDicePadded', { set: plan.set.name }))
  const t0 = plan.dice[0].cards[0].template
  const thumb = (
    await renderCard(ctx, t0, 'front', 256 / Math.max(t0.width, t0.height), {
      bleed: false,
      mode: 'trim',
      background: null
    })
  ).toPNG()
  step(ctx)

  const env = ctx.env
  const digits = String(plan.dice.length).length
  const mesh = ttsDieObj(t0.width * TTS_UNITS_PER_MM)
  for (const target of targets) {
    const meshFile = join(target, 'models', `${stem}_d6.obj`)
    await write(ctx, meshFile, Buffer.from(mesh))
    const dice: TtsDie[] = []
    for (const [i, die] of plan.dice.entries()) {
      const n = String(i + 1).padStart(digits, '0')
      const file = join(target, 'images', `${stem}_die_${n}.png`)
      await write(ctx, file, images[i])
      const first = die.cards[0]
      dice.push({
        imageUrl: imageUrl(env, file),
        values: die.cards.map((c, k) => fieldText(c, o.nickname) || String(k + 1)),
        nickname: plan.dice.length === 1 ? plan.set.name : `${plan.set.name} ${i + 1}`,
        description: fieldText(first, o.description),
        count: die.count
      })
    }
    const object = ttsSavedDice(plan.set.name, dice, imageUrl(env, meshFile))
    await write(ctx, join(target, `${stem}.json`), JSON.stringify(object, null, 2) + '\n')
    await write(ctx, join(target, `${stem}.png`), thumb)
  }
}

async function renderPiece(
  ctx: Ctx,
  p: TtsPiecePlan,
  side: Side,
  kind: TtsPieceKind
): Promise<Buffer> {
  const page = piecePage(p.card.template, side, kind)
  const w = Math.round(page.width * p.scale)
  const h = Math.round(page.height * p.scale)
  const scene: Scene = {
    pages: [page],
    scale: w / page.width,
    // le tessere hanno il fondo bianco; i segnalini trasparente, perché TTS li ritaglia lì
    background: isTokenLike(kind) ? null : '#FFFFFF',
    lineColor: '#000',
    lineWidth: 0,
    linesOver: false
  }
  await ctx.win.show(scene, w, h)
  return (await ctx.win.capture(w, h)).toPNG()
}

/** Indirizzo di un'immagine scritta per Tabletop Simulator, come lo legge TTS */
function imageUrl(env: RunEnv, file: string): string {
  const real = env.realPath?.(file) ?? { path: file, platform: env.platform }
  return ttsImageUrl(real.path, real.platform)
}

function fieldText(card: ExportCard, field: string): string {
  if (!field) return ''
  return plainText(card.fields[field] ?? '').trim()
}

/** Foglio di carte a griglia, in pixel interi */
async function renderSheet(ctx: Ctx, chunk: TtsChunk, side: Side): Promise<Buffer> {
  const page = sheetPage(chunk, side)
  const scene: Scene = {
    pages: [page],
    scale: chunk.scale,
    background: '#FFFFFF',
    lineColor: '#000',
    lineWidth: 0,
    linesOver: false
  }
  const w = Math.round(page.width * chunk.scale)
  const h = Math.round(page.height * chunk.scale)
  await ctx.win.show(scene, w, h)
  return (await ctx.win.capture(w, h)).toPNG()
}
