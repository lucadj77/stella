import { useState } from 'react'
import type { DextrousImportResult, DextrousScan } from '../../../shared/api'
import { messageFromError, type Message } from '../../../shared/messages'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import type { MessageKey } from '../i18n/en'

// Importazione di un progetto Dextrous (src/main/import/dextrous.ts). Dextrous è un'app web: si
// scaricano a mano il JSON del progetto, i JSON dei layout e le cartelle di immagini. Si sceglie la
// cartella in cui li si mette: la finestra legge il progetto, dice quali layout e cartelle di
// immagini servono e quali ci sono già, e cosa non si converte del tutto. «Controlla di nuovo»
// rilegge la cartella dopo aver scaricato il resto; l'importazione crea il progetto comunque.

const KIND: Record<string, MessageKey> = {
  card: 'dextrous.kind.card',
  token: 'dextrous.kind.token',
  tile: 'dextrous.kind.tile',
  board: 'dextrous.kind.board'
}

export default function ImportDextrousDialog({
  onOpen,
  onClose
}: {
  /** Apre il progetto appena creato */
  onOpen(folder: string): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const [source, setSourceText] = useState('')
  const [target, setTarget] = useState('')
  const [targetEdited, setTargetEdited] = useState(false)
  const [scan, setScan] = useState<DextrousScan | null>(null)
  /** Cartella dell'ultimo controllo */
  const [checked, setChecked] = useState('')
  const [name, setName] = useState('')
  const [checking, setChecking] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<Message | null>(null)
  const [result, setResult] = useState<DextrousImportResult | null>(null)

  const check = async (folder: string, project?: string): Promise<void> => {
    setError(null)
    if (!folder.trim()) {
      setScan(null)
      return
    }
    setChecking(true)
    setChecked(folder)
    try {
      const s = await window.api.scanDextrous(folder.trim(), project)
      setScan(s)
      if (!scan || s.project !== scan.project) setName(s.title)
      if (!targetEdited) setTarget(await window.api.defaultDextrousTarget(folder.trim(), s.title))
    } catch (e) {
      setScan(null)
      setError(messageFromError(e))
    } finally {
      setChecking(false)
    }
  }

  const chooseSource = async (): Promise<void> => {
    const f = await window.api.chooseFolder(source || undefined)
    if (!f) return
    setSourceText(f)
    await check(f)
  }

  const chooseTarget = async (): Promise<void> => {
    const f = await window.api.chooseFolder(target || source || undefined)
    if (!f) return
    setTarget(f)
    setTargetEdited(true)
  }

  const run = async (): Promise<void> => {
    setRunning(true)
    setError(null)
    try {
      setResult(
        await window.api.importDextrous({
          source: source.trim(),
          project: scan?.project,
          target: target.trim(),
          name: name.trim()
        })
      )
    } catch (e) {
      setError(messageFromError(e))
    } finally {
      setRunning(false)
    }
  }

  if (result)
    return (
      <Dialog title={t('dextrous.title')} onClose={onClose}>
        <div className="export-dialog export-result">
          <p>
            {t('dextrous.done', {
              templates: result.templates,
              sets: result.sets,
              cards: result.cards,
              images: result.images
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
          {result.missingImages.length > 0 && (
            <>
              <h3>{t('dextrous.missingImages', { count: result.missingImages.length })}</h3>
              <p className="muted small">{t('dextrous.missingImagesHint')}</p>
              <p className="import-icons">{result.missingImages.join(', ')}</p>
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

  const missingLayouts = scan
    ? new Set(
        scan.components
          .flatMap((c) => c.layouts)
          .filter((l) => !l.found)
          .map((l) => l.id)
      ).size
    : 0
  const folderName = (n: string): string => n || t('dextrous.noFolder')

  return (
    <Dialog title={t('dextrous.title')} onClose={onClose}>
      <div className="export-dialog">
        <details className="import-how" open={!scan}>
          <summary>{t('dextrous.how')}</summary>
          <ol className="muted small">
            <li>{t('dextrous.step1')}</li>
            <li>{t('dextrous.step2')}</li>
            <li>{t('dextrous.step3')}</li>
            <li>{t('dextrous.step4')}</li>
          </ol>
        </details>
        <div className="export-fields">
          <div className="field">
            <span className="field-label">{t('dextrous.source')}</span>
            <div className="field-control">
              <input
                value={source}
                title={source}
                readOnly={window.api.isWeb}
                onChange={(e) => setSourceText(e.target.value)}
                onBlur={(e) => {
                  if (!window.api.isWeb && e.target.value !== checked) void check(e.target.value)
                }}
              />
              <button type="button" onClick={chooseSource} title={t('tip.chooseFolder')}>
                {t('export.choose')}
              </button>
            </div>
            <p className="field-note export-note">{t('dextrous.sourceHint')}</p>
          </div>
          {scan && scan.projects.length > 1 && (
            <div className="field">
              <span className="field-label">{t('dextrous.project')}</span>
              <div className="field-control">
                <select value={scan.project} onChange={(e) => void check(source, e.target.value)}>
                  {scan.projects.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
        {scan && (
          <div className="dextrous-check">
            <h3>{t('dextrous.components')}</h3>
            <ul className="import-notes">
              {scan.components.map((c) => (
                <li key={c.name}>
                  {t('dextrous.component', {
                    name: c.name,
                    kind: t(KIND[c.kind] ?? 'dextrous.kind.card'),
                    cards: c.cards
                  })}
                  <ul>
                    {c.layouts.map((l) => {
                      const side = t(
                        l.side === 'front' ? 'dextrous.side.front' : 'dextrous.side.back'
                      )
                      return (
                        <li key={l.side} className={l.found ? 'ok' : 'missing'}>
                          {l.found ? '✓ ' : '✗ '}
                          {l.found
                            ? t('dextrous.layoutFound', { side, name: l.found })
                            : t('dextrous.layoutMissing', { side, id: l.id })}
                        </li>
                      )
                    })}
                  </ul>
                </li>
              ))}
            </ul>
            <h3>{t('dextrous.folders')}</h3>
            {scan.folders.length ? (
              <ul className="import-notes">
                {scan.folders.map((f) => (
                  <li key={f.name} className={f.missing.length ? 'missing' : 'ok'}>
                    {f.missing.length ? '✗ ' : '✓ '}
                    {f.missing.length
                      ? t('dextrous.folderMissing', {
                          name: folderName(f.name),
                          found: f.found,
                          images: f.images,
                          missing: f.missing.join(', ')
                        })
                      : t('dextrous.folderOk', { name: folderName(f.name), images: f.images })}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">{t('dextrous.noImages')}</p>
            )}
            <p className="muted small">
              {t('dextrous.available', { images: scan.images, zips: scan.zips.length })}
            </p>
            <div className="dialog-buttons start">
              <button disabled={checking} onClick={() => check(source, scan.project)}>
                {t('dextrous.recheck')}
              </button>
            </div>
            <h3>{t('dextrous.preview')}</h3>
            {scan.notes.length ? (
              <ul className="import-notes">
                {scan.notes.map((n, i) => (
                  <li key={i}>{t(n)}</li>
                ))}
              </ul>
            ) : (
              <p className="muted small">{t('dextrous.previewNone')}</p>
            )}
            {missingLayouts > 0 && (
              <div className="banner warning">
                {t('dextrous.missingWarning', { count: missingLayouts })}
              </div>
            )}
            <div className="export-fields">
              <div className="field">
                <span className="field-label">{t('nandeck.name')}</span>
                <div className="field-control">
                  <input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <span className="field-label">{t('ttc.target')}</span>
                <div className="field-control">
                  <input
                    value={target}
                    title={target}
                    readOnly={window.api.isWeb}
                    onChange={(e) => {
                      setTarget(e.target.value)
                      setTargetEdited(true)
                    }}
                  />
                  <button type="button" onClick={chooseTarget} title={t('tip.chooseFolder')}>
                    {t('export.choose')}
                  </button>
                </div>
                <p className="field-note export-note">
                  {t(window.api.isWeb ? 'web.ttcTargetHint' : 'ttc.targetHint')}
                </p>
              </div>
            </div>
          </div>
        )}
        {error && <p className="field-error">{t(error)}</p>}
        <div className="dialog-buttons">
          <button onClick={onClose}>{t('format.cancel')}</button>
          <button
            className="primary"
            disabled={running || checking || !scan || !target.trim()}
            onClick={run}
          >
            {running ? t('ttc.running') : t('ttc.import')}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
