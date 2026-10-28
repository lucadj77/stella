import { MAX_OPEN_FILES, type ExportProgress, type ExportResult } from '../../../shared/export'
import { browserViewable } from '../../../shared/viewable'
import type { Message } from '../../../shared/messages'
import { useI18n } from '../i18n/context'
import type { KindOptions } from './exportRun'

// L'avviso in basso a destra di «Ripeti l'ultima esportazione»: l'avanzamento con Interrompi, poi
// quanti file sono stati scritti, gli avvisi e il collegamento alla cartella.

export interface ExportRun {
  what: KindOptions
  /** Presente finché l'esportazione è in corso */
  progress?: ExportProgress
  result?: ExportResult
  error?: Message
}

export default function ExportToast({
  run,
  onClose
}: {
  run: ExportRun
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const { progress, result, error } = run
  return (
    <div className="export-toast" role="status">
      {progress ? (
        <div className="export-toast-row">
          <span>
            {progress.total
              ? t('export.toast.progress', { done: progress.done, total: progress.total })
              : t('export.toast.preparing')}
          </span>
          <span className="spacer" />
          <button type="button" onClick={() => window.api.cancelExport()}>
            {t('export.cancel')}
          </button>
        </div>
      ) : (
        <>
          <div className="export-toast-row">
            <strong>
              {error
                ? t(error)
                : result?.cancelled
                  ? t('export.cancelled', { n: result.files })
                  : t('export.done', { n: result?.files ?? 0 })}
            </strong>
            <span className="spacer" />
            <button
              type="button"
              className="icon-btn"
              title={t('export.close')}
              aria-label={t('export.close')}
              onClick={onClose}
            >
              ×
            </button>
          </div>
          {!!result?.warnings.length && (
            <details>
              <summary>{t('export.toast.warnings', { n: result.warnings.length })}</summary>
              {result.warnings.map((w, i) => (
                <p key={i} className="field-error">
                  {t(w)}
                </p>
              ))}
            </details>
          )}
          {result && <ResultLinks result={result} />}
        </>
      )}
    </div>
  )
}

/** I collegamenti ai file scritti, se sono pochi, e alle cartelle */
export function ResultLinks({ result }: { result: ExportResult }): React.JSX.Element {
  const { t } = useI18n()
  return (
    <>
      {/* pochi file (un PDF, un mazzo): si aprono direttamente */}
      {/* nel browser si aprono solo i file che sa mostrare: gli altri sono già nella cartella */}
      {(result.paths?.length ?? 0) <= MAX_OPEN_FILES &&
        result.paths
          ?.filter((f) => !window.api.isWeb || browserViewable(f))
          .map((f) => (
            <button key={f} type="button" className="link" onClick={() => window.api.showFolder(f)}>
              {t('export.openFile', { file: f.split(/[\\/]/).pop() ?? f })}
            </button>
          ))}
      {result.folders.map((f) =>
        // il browser non apre le cartelle: si dice solo dove sono i file
        window.api.isWeb ? (
          <p key={f} className="muted small">
            {f}
          </p>
        ) : (
          <button key={f} type="button" className="link" onClick={() => window.api.showFolder(f)}>
            {t('export.openFolder', { folder: f })}
          </button>
        )
      )}
    </>
  )
}
