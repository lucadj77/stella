import {
  expandCopies,
  isTokenLike,
  safeName,
  type ExportJob,
  type Scene,
  type ScenePage,
  type TtsPieceKind
} from './export'
import {
  cardPage,
  diePage,
  imageExtension,
  planImages,
  planPdf,
  piecePage,
  planTts,
  sheetPage
} from './exportPlan'
import type { Message } from './messages'

// Le pagine, immagini e fogli che un'esportazione scriverà, uno per uno, e i numeri per la frase
// di riepilogo della finestra. Li usano l'anteprima a lato, quella a tutta finestra e il menu
// «Ripeti l'ultima esportazione».

export interface PreviewItem {
  /** Nome del file come verrà scritto */
  file: string
  /** Pagina nel PDF o numero di copie */
  detail?: Message
  page: ScenePage
  scene: Omit<Scene, 'pages' | 'scale'>
}

export interface PreviewPlan {
  items: PreviewItem[]
  /** File che l'esportazione scriverà (per Tabletop Simulator senza i .json) */
  files: number
  notes: Message[]
}

const WHITE = { background: '#FFFFFF', lineColor: '#000', lineWidth: 0, linesOver: false }

export function previewItems(job: ExportJob): PreviewPlan {
  const sets = job.sets.filter((s) => s.cards.length)
  if (job.kind === 'images') {
    const o = job.options
    const ext = imageExtension(o)
    const scene = { ...WHITE, background: o.transparent && ext === 'png' ? null : '#FFFFFF' }
    const files = planImages(o, sets).filter((f) => f.names.length)
    return {
      files: files.reduce((n, f) => n + f.names.length, 0),
      notes: [],
      items: files.map((f) => ({
        file: `${f.names[0]}.${ext}`,
        detail:
          f.names.length > 1
            ? { key: 'export.previewCopies', params: { n: f.names.length } }
            : undefined,
        page: cardPage(f.card.template, f.side, o.bleed, 'trim'),
        scene
      }))
    }
  }
  if (job.kind === 'pdf') {
    const o = job.options
    const { docs, overflow } = planPdf(o, sets, job.project)
    const scene = {
      background: '#FFFFFF',
      lineColor: o.markColor,
      lineWidth: o.markWidth,
      linesOver: o.marksOver
    }
    return {
      files: docs.length,
      notes: overflow.map((set) => ({ key: 'export.gridOverflow', params: { set } })),
      items: docs.flatMap((d) =>
        d.pages.map((page, i) => ({
          file: `${d.name}.pdf`,
          detail: { key: 'export.previewPage', params: { n: i + 1, total: d.pages.length } },
          page,
          scene
        }))
      )
    }
  }
  const items: PreviewItem[] = []
  const notes: Message[] = []
  for (const { set, chunks, pieces, dice, object, uniqueBack } of planTts(job.options, sets)) {
    const stem = safeName(set.name)
    const kind = object.type as TtsPieceKind
    const dieDigits = String(dice.length).length
    dice.forEach((d, i) => {
      items.push({
        file: `${stem}_die_${String(i + 1).padStart(dieDigits, '0')}.png`,
        detail: d.count > 1 ? { key: 'export.previewCopies', params: { n: d.count } } : undefined,
        page: diePage(d),
        scene: WHITE
      })
    })
    if (dice.some((d) => d.padded))
      notes.push({ key: 'export.ttsDicePadded', params: { set: set.name } })
    const digits = String(pieces.length).length
    pieces.forEach((p, i) => {
      const n = String(i + 1).padStart(digits, '0')
      const detail: Message | undefined =
        p.count > 1 ? { key: 'export.previewCopies', params: { n: p.count } } : undefined
      items.push({
        file: `${stem}_${n}.png`,
        detail,
        page: piecePage(p.card.template, 'front', kind),
        scene: isTokenLike(kind) ? { ...WHITE, background: null } : WHITE
      })
      if (!isTokenLike(kind))
        items.push({
          file: `${stem}_${n}_back.png`,
          detail,
          page: piecePage(p.card.template, 'back', kind),
          scene: WHITE
        })
    })
    chunks.forEach((chunk, i) => {
      items.push({
        file: `${stem}_faces_${i + 1}.png`,
        page: sheetPage(chunk, 'front'),
        scene: WHITE
      })
      if (uniqueBack)
        items.push({
          file: `${stem}_backs_${i + 1}.png`,
          page: sheetPage(chunk, 'back'),
          scene: WHITE
        })
      else if (i === 0)
        items.push({
          file: `${stem}_back.png`,
          page: cardPage(chunk.cards[0].template, 'back', false, 'cut'),
          scene: WHITE
        })
    })
  }
  return { files: items.length, notes, items }
}

/** I numeri della frase di riepilogo sopra il pulsante Esporta */
export interface ExportSummary {
  /** Componenti esportati, contando le copie se l'esportazione le ripete */
  components: number
  /** Set con almeno un componente */
  sets: number
  /** File scritti: PDF, immagini, oppure immagini e .json di Tabletop Simulator */
  files: number
  /** PDF: pagine dei documenti, senza il foglio di prova */
  pages: number
  /** PDF: fogli da stampare (metà delle pagine in fronte-retro) */
  sheets: number
  /** Tabletop Simulator: oggetti (un .json per set) */
  objects: number
  /** Tabletop Simulator: immagini da scrivere */
  images: number
}

export function exportSummary(
  job: ExportJob,
  plan: PreviewPlan = previewItems(job)
): ExportSummary {
  const sets = job.sets.filter((s) => s.cards.length)
  const copies = job.options.copies
  const components = sets.reduce((n, s) => n + expandCopies(s.cards, copies).length, 0)
  const base = { components, sets: sets.length, pages: 0, sheets: 0, objects: 0, images: 0 }
  if (job.kind === 'images') return { ...base, files: plan.files }
  if (job.kind === 'pdf') {
    const o = job.options
    const pages = plan.items.filter((i) => !(o.proof && i.file.endsWith('_proof.pdf'))).length
    const duplex = !o.fold && o.duplex !== 'none'
    return { ...base, files: plan.files, pages, sheets: duplex ? Math.ceil(pages / 2) : pages }
  }
  const objects = planTts(job.options, sets).filter(
    (p) => p.chunks.length || p.pieces.length || p.dice.length
  ).length
  return { ...base, files: plan.items.length + objects, objects, images: plan.items.length }
}
