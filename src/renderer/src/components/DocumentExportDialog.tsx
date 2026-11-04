import { useState } from 'react'
import { messageFromError, type Message } from '../../../shared/messages'
import { browserViewable } from '../../../shared/viewable'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'

// Esportazione di un documento: PDF da stampare, HTML in un solo file, Word da modificare,
// Markdown con le immagini in una cartella accanto. I file vanno in export/docs/ del progetto.

export type DocExportKind = 'pdf' | 'html' | 'md' | 'docx'

/** Percorso di un file nella cartella, con il separatore che la cartella usa già */
function inFolder(folder: string, file: string): string {
  const sep = folder.includes('\\') && !folder.includes('/') ? '\\' : '/'
  return folder.replace(/[\\/]+$/, '') + sep + file
}

export default function DocumentExportDialog({
  name,
  problems,
  onExport,
  onClose
}: {
  name: string
  /** Problemi del documento: le carte e le immagini che non si trovano restano fuori */
  problems: number
  /** Esporta e restituisce la cartella dei file */
  onExport(kind: DocExportKind): Promise<string>
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const [busy, setBusy] = useState<DocExportKind | null>(null)
  const [done, setDone] = useState<{ kind: DocExportKind; folder: string } | null>(null)
  const [error, setError] = useState<Message | null>(null)
  const run = (kind: DocExportKind): void => {
    setBusy(kind)
    setDone(null)
    setError(null)
    onExport(kind)
      .then((folder) => setDone({ kind, folder }))
      .catch((e) => setError(messageFromError(e)))
      .finally(() => setBusy(null))
  }
  const kinds: DocExportKind[] = ['pdf', 'html', 'docx', 'md']
  /** Nel browser il PDF non è un file salvato: si apre la finestra di stampa */
  const printed = (kind: DocExportKind): boolean => window.api.isWeb && kind === 'pdf'
  const file = (kind: DocExportKind): string => (kind === 'md' ? `${name}.md` : `${name}.${kind}`)
  return (
    <Dialog title={t('documents.export')} onClose={onClose}>
      <div className="dialog-form document-export">
        {problems > 0 && <p className="muted">{t('documents.exportProblems', { n: problems })}</p>}
        <div className="document-export-kinds">
          {kinds.map((k) => (
            <button key={k} disabled={busy !== null} onClick={() => run(k)}>
              <strong>{t(`documents.export.${k}`)}</strong>
              <span className="muted small">
                {t(printed(k) ? 'documents.export.pdfWebHint' : `documents.export.${k}Hint`)}
              </span>
            </button>
          ))}
        </div>
        {busy && <p className="muted">{t('documents.exporting')}</p>}
        {window.api.isWeb && <p className="muted small">{t('documents.printHint')}</p>}
        {done && !printed(done.kind) && (
          <p>
            {t('documents.exported', { file: `export/docs/${file(done.kind)}` })}{' '}
            {/* nel browser un file che non si può mostrare (Word) si scaricherebbe di nuovo */}
            {(!window.api.isWeb || browserViewable(file(done.kind))) && (
              <button
                className="link"
                onClick={() => void window.api.showFolder(inFolder(done.folder, file(done.kind)))}
              >
                {t('documents.openFile')}
              </button>
            )}{' '}
            {/* il browser non apre le cartelle */}
            {!window.api.isWeb && (
              <button className="link" onClick={() => void window.api.showFolder(done.folder)}>
                {t('documents.openFolder')}
              </button>
            )}
          </p>
        )}
        {error && <p className="field-error">{t(error)}</p>}
        <div className="dialog-buttons">
          <button onClick={onClose}>{t('dialog.close')}</button>
        </div>
      </div>
    </Dialog>
  )
}
