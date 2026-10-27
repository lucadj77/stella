import { useEffect, useMemo, useState } from 'react'
import {
  safeName,
  type ExportJob,
  type Scene,
  type ScenePage,
  isTokenLike,
  type TtsPieceKind
} from '../../../shared/export'
import {
  cardPage,
  diePage,
  imageExtension,
  planImages,
  planPdf,
  piecePage,
  planTts,
  sheetPage
} from '../../../shared/exportPlan'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import type { Message } from '../../../shared/messages'
import ScenePageView from '../render/SceneView'

// Anteprima dell'esportazione: le stesse pagine, immagini e fogli che l'esportazione scriverà,
// uno alla volta, prima di scrivere qualcosa su disco.

interface PreviewItem {
  /** Nome del file come verrà scritto */
  file: string
  /** Pagina nel PDF o numero di copie */
  detail?: Message
  page: ScenePage
  scene: Omit<Scene, 'pages' | 'scale'>
}

const WHITE = { background: '#FFFFFF', lineColor: '#000', lineWidth: 0, linesOver: false }
const BOX_W = 820
const BOX_H = 520

function previewItems(job: ExportJob): { items: PreviewItem[]; files: number; notes: Message[] } {
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

export default function ExportPreview({
  job,
  onExport,
  onClose
}: {
  job: ExportJob
  onExport(): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const { items, files, notes } = useMemo(() => previewItems(job), [job])
  const [index, setIndex] = useState(0)
  const current = items[Math.min(index, items.length - 1)]
  const go = (d: number): void => setIndex((i) => Math.max(0, Math.min(items.length - 1, i + d)))

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const scale = current ? Math.min(BOX_W / current.page.width, BOX_H / current.page.height) : 1
  return (
    <Dialog title={t('export.previewTitle')} onClose={onClose}>
      <div className="export-preview">
        <p className="muted small">
          {job.kind === 'pdf'
            ? t('export.previewSummaryPdf', { files, pages: items.length })
            : job.kind === 'tts'
              ? t('export.previewSummaryTts', { files })
              : t('export.previewSummary', { files })}
        </p>
        {notes.map((n, i) => (
          <p key={i} className="field-error">
            {t(n)}
          </p>
        ))}
        <div className="export-preview-stage" style={{ height: BOX_H + 16 }}>
          {current ? (
            <ScenePageView
              className={
                current.scene.background ? 'export-preview-page' : 'export-preview-page transparent'
              }
              page={current.page}
              scene={{ ...current.scene, pages: [current.page], scale }}
            />
          ) : (
            <p className="muted">{t('export.previewEmpty')}</p>
          )}
        </div>
        {current && (
          <div className="export-preview-nav">
            <button type="button" disabled={index === 0} onClick={() => go(-1)}>
              ‹
            </button>
            <span className="export-preview-file" title={current.file}>
              {current.file}
              {current.detail && <span className="muted"> · {t(current.detail)}</span>}
            </span>
            <span className="muted">
              {index + 1} / {items.length}
            </span>
            <button type="button" disabled={index >= items.length - 1} onClick={() => go(1)}>
              ›
            </button>
          </div>
        )}
        <div className="dialog-buttons">
          <button type="button" onClick={onClose}>
            {t('export.close')}
          </button>
          <button
            type="button"
            className="primary"
            disabled={!items.length}
            onClick={() => {
              onClose()
              onExport()
            }}
          >
            {t('export.run')}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
