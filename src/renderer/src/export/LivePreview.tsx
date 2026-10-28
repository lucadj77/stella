import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PreviewItem, PreviewPlan } from '../../../shared/exportPreview'
import { useI18n } from '../i18n/context'
import ScenePageView from '../render/SceneView'
import { settle } from './settle'

// Anteprima vera, in piccolo, a lato della finestra Esporta: la pagina, l'immagine o il foglio
// che l'esportazione scriverà, disegnato come nell'esportazione. Si disegna solo quello mostrato;
// gli altri si disegnano quando li si sceglie con ‹ ›. Finché la pagina non è pronta (immagini e
// font) c'è «Attendere…», e intanto la finestra resta usabile.

export default function LivePreview({
  plan,
  pending,
  index,
  onIndex,
  onEnlarge
}: {
  plan: PreviewPlan | null
  /** Le opzioni sono cambiate e l'anteprima non le segue ancora */
  pending: boolean
  index: number
  onIndex(i: number): void
  onEnlarge(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const stage = useRef<HTMLDivElement>(null)
  const page = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  /** La pagina già pronta da mostrare: quando cambia, si aspetta che la nuova sia completa */
  const [readyFor, setReadyFor] = useState<PreviewItem | null>(null)
  const items = plan?.items ?? []
  const i = Math.min(index, Math.max(0, items.length - 1))
  const current = items[i]

  useLayoutEffect(() => {
    const el = stage.current
    if (!el) return
    const measure = (): void => setBox({ w: el.clientWidth - 16, h: el.clientHeight - 16 })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const scale =
    current && box.w > 0 && box.h > 0
      ? Math.min(box.w / current.page.width, box.h / current.page.height)
      : 0

  // una pagina nuova si mostra quando ha finito di caricare immagini e font
  const drawn = scale > 0
  useEffect(() => {
    if (!current || !drawn || !page.current) return
    let alive = true
    settle(page.current)
      .catch(() => undefined)
      .then(() => alive && setReadyFor(current))
    return () => {
      alive = false
    }
  }, [current, drawn])

  const waiting = pending || readyFor !== current
  return (
    <div className="live-preview">
      <div className="live-preview-head">
        <span className="live-preview-title">{t('export.livePreview')}</span>
        <button
          type="button"
          className="link"
          disabled={!current}
          title={t('export.enlargeHint')}
          onClick={onEnlarge}
        >
          {t('export.enlarge')}
        </button>
      </div>
      <div ref={stage} className="live-preview-stage">
        {current && scale > 0 && (
          <div
            ref={page}
            className="live-preview-page"
            style={{ visibility: waiting ? 'hidden' : 'visible' }}
          >
            <ScenePageView
              className={
                current.scene.background ? 'export-preview-page' : 'export-preview-page transparent'
              }
              page={current.page}
              scene={{ ...current.scene, pages: [current.page], scale }}
            />
          </div>
        )}
        {!current && !pending && <p className="muted small">{t('export.previewEmpty')}</p>}
        {(current || pending) && waiting && <p className="live-preview-wait">{t('export.wait')}</p>}
      </div>
      {current && (
        <div className="live-preview-nav">
          <button type="button" disabled={i === 0} onClick={() => onIndex(i - 1)}>
            ‹
          </button>
          <span className="live-preview-file" title={current.file}>
            {current.file}
            {current.detail && <span className="muted"> · {t(current.detail)}</span>}
          </span>
          <button type="button" disabled={i >= items.length - 1} onClick={() => onIndex(i + 1)}>
            ›
          </button>
        </div>
      )}
      {current && new Set(items.map((x) => x.file)).size > 1 && (
        <p className="muted small live-preview-count">
          {t('export.previewOf', { n: i + 1, total: items.length })}
        </p>
      )}
    </div>
  )
}
