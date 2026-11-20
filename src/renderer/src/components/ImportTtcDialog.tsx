import { useEffect, useState } from 'react'
import type { TtcImportResult } from '../../../shared/api'
import { messageFromError, type Message } from '../../../shared/messages'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import type { MessageKey } from '../i18n/en'

// Importazione di un progetto Tabletop Creator in una cartella nuova (src/main/import/ttc.ts).

type Folder = 'source' | 'target' | 'icons'

export default function ImportTtcDialog({
  source,
  onOpen,
  onClose
}: {
  /** Cartella del progetto da importare già scelta (trascinata nella schermata di avvio) */
  source?: string
  /** Apre il progetto appena creato */
  onOpen(folder: string): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const [folders, setFolders] = useState<Record<Folder, string>>({
    source: source ?? '',
    target: '',
    icons: localStorage.getItem(ICONS_KEY) ?? ''
  })
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<Message | null>(null)
  const [result, setResult] = useState<TtcImportResult | null>(null)

  const setSource = async (source: string): Promise<void> => {
    setFolders((f) => ({ ...f, source }))
    if (source) {
      const target = await window.api.defaultTtcTarget(source)
      setFolders((f) => ({ ...f, target }))
    }
  }

  // la cartella trascinata nella schermata di avvio: si propone dove mettere il progetto convertito
  useEffect(() => {
    if (!source) return
    window.api.defaultTtcTarget(source).then(
      (target) => setFolders((f) => (f.target ? f : { ...f, target })),
      (e) => console.error(e)
    )
  }, [source])

  const choose = async (key: Folder): Promise<void> => {
    const f = await window.api.chooseFolder(folders[key] || folders.source || undefined)
    if (!f) return
    if (key === 'source') await setSource(f)
    else setFolders((x) => ({ ...x, [key]: f }))
  }

  const run = async (): Promise<void> => {
    setRunning(true)
    setError(null)
    try {
      const icons = folders.icons.trim()
      localStorage.setItem(ICONS_KEY, icons)
      setResult(
        await window.api.importTtc({
          source: folders.source.trim(),
          target: folders.target.trim(),
          iconFolder: icons || undefined
        })
      )
    } catch (e) {
      setError(messageFromError(e))
    } finally {
      setRunning(false)
    }
  }

  const field = (key: Folder, label: MessageKey, hint: MessageKey): React.JSX.Element => (
    <div className="field">
      <span className="field-label">{t(label)}</span>
      <div className="field-control">
        <input
          value={folders[key]}
          title={folders[key]}
          // nel web una cartella si sceglie solo con il pulsante
          readOnly={window.api.isWeb}
          onChange={(e) =>
            key === 'source'
              ? setSource(e.target.value)
              : setFolders((f) => ({ ...f, [key]: e.target.value }))
          }
        />
        <button type="button" onClick={() => choose(key)} title={t('tip.chooseFolder')}>
          {t('export.choose')}
        </button>
      </div>
      <p className="field-note export-note">
        {t(window.api.isWeb && key === 'target' ? 'web.ttcTargetHint' : hint)}
      </p>
    </div>
  )

  if (result)
    return (
      <Dialog title={t('ttc.title')} onClose={onClose}>
        <div className="export-dialog export-result">
          <p>
            {t('ttc.done', {
              templates: result.templates,
              sets: result.sets,
              cards: result.cards,
              assets: result.assets,
              library: result.libraryIcons,
              variables: result.variables
            })}
          </p>
          <p className="muted small">{result.folder}</p>
          {result.notes.length > 0 && (
            <>
              <h3>{t('ttc.notes')}</h3>
              <ul className="import-notes">
                {result.notes.map((n, i) => (
                  <li key={i}>{t(n)}</li>
                ))}
              </ul>
            </>
          )}
          {result.missingIcons.length > 0 && (
            <>
              <h3>{t('ttc.missingIcons', { count: result.missingIcons.length })}</h3>
              <p className="muted small">{t('ttc.missingIconsHint')}</p>
              <p className="import-icons">{result.missingIcons.join(', ')}</p>
            </>
          )}
          {result.fonts.length > 0 && (
            <>
              <h3>{t('ttc.fonts')}</h3>
              <p className="muted small">{t('ttc.fontsHint')}</p>
              <p className="import-icons">{result.fonts.join(', ')}</p>
            </>
          )}
          <div className="dialog-buttons">
            <button onClick={onClose}>{t('ttc.close')}</button>
            <button className="primary" onClick={() => onOpen(result.folder)}>
              {t('ttc.open')}
            </button>
          </div>
        </div>
      </Dialog>
    )

  return (
    <Dialog title={t('ttc.title')} onClose={onClose}>
      <div className="export-dialog">
        <p className="muted small">{t('ttc.intro')}</p>
        <div className="export-fields">
          {field('source', 'ttc.source', 'ttc.sourceHint')}
          {field('target', 'ttc.target', 'ttc.targetHint')}
          {field('icons', 'ttc.icons', 'ttc.iconsHint')}
        </div>
        {error && <p className="field-error">{t(error)}</p>}
        <div className="dialog-buttons">
          <button onClick={onClose}>{t('format.cancel')}</button>
          <button
            className="primary"
            disabled={running || !folders.source.trim() || !folders.target.trim()}
            onClick={run}
          >
            {running ? t('ttc.running') : t('ttc.import')}
          </button>
        </div>
      </div>
    </Dialog>
  )
}

const ICONS_KEY = 'ttcIconFolder'
