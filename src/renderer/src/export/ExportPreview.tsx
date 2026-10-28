import { useEffect, useMemo, useState } from 'react'
import type { ExportJob } from '../../../shared/export'
import { previewItems } from '../../../shared/exportPreview'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import ScenePageView from '../render/SceneView'

// Anteprima dell'esportazione a tutta finestra: le stesse pagine, immagini e fogli che
// l'esportazione scriverà, uno alla volta, prima di scrivere qualcosa su disco.

const BOX_W = 820
const BOX_H = 520

export default function ExportPreview({
  job,
  start = 0,
  onExport,
  onClose
}: {
  job: ExportJob
  /** L'elemento da mostrare per primo: quello che si vedeva nell'anteprima a lato */
  start?: number
  onExport(): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const { items, files, notes } = useMemo(() => previewItems(job), [job])
  const [index, setIndex] = useState(start)
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
