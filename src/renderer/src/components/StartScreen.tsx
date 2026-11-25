import { useEffect, useState } from 'react'
import type { RecentProject } from '../../../shared/api'
import { projectFolderName } from '../../../shared/model/projectName'
import { isPrerelease } from '../../../shared/update'
import { DISCORD_URL, DONATE_URL, siteUrl, tutorialsUrl, videoUrl } from '../../../shared/donate'
import { guideLink } from '../guideLinks'
import { messageFromError, type Message } from '../../../shared/messages'
import { Dialog } from '../editor/dialogs'
import { askConfirm, showNotice } from './confirm'
import { useI18n } from '../i18n/context'
import type { MessageKey } from '../i18n/en'
import appIcon from '../assets/app-icon.png'
import DesktopFeaturesDialog from './DesktopFeaturesDialog'
import { WhatsNewDialog } from './UpdateNotice'
import { checkForUpdateNow } from './updateCheck'
import RescueDialog from './RescueDialog'
import { restoreBackupFromFile } from './restoreBackupFile'

// Schermata di ingresso: progetti recenti con miniatura, nuovo progetto, apertura e importazione.

const PARENT_KEY = 'newProjectParent'

export default function StartScreen({
  error,
  rescueFolder,
  loading,
  settings,
  onOpen,
  onChoose,
  onImport,
  onImportNandeck,
  onImportDextrous,
  onImportZip,
  onHelp
}: {
  error: Message | null
  /** Cartella del progetto che non si è aperto per il file di progetto rovinato o mancante */
  rescueFolder: string | null
  loading: boolean
  /** Dimensione dell'interfaccia, tema e lingua */
  settings: React.ReactNode
  onOpen(folder: string): void
  /** Sceglie una cartella di progetto e la apre */
  onChoose(): void
  /** Importa un progetto Tabletop Creator; con source la cartella è già scelta */
  onImport(source?: string): void
  onImportNandeck(): void
  onImportDextrous(): void
  /** Importa un progetto intero da uno ZIP */
  onImportZip(): void
  onHelp(): void
}): React.JSX.Element {
  const { t, lang } = useI18n()
  const [recent, setRecent] = useState<RecentProject[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [version, setVersion] = useState<string | null>(null)
  const [whatsNew, setWhatsNew] = useState(false)
  const [desktop, setDesktop] = useState(false)
  /** La finestra con i formati da importare */
  const [importChoice, setImportChoice] = useState(false)
  /** La finestra per ripristinare il progetto che non si apre */
  const [rescuing, setRescuing] = useState(false)

  useEffect(() => {
    window.api.appVersion().then(setVersion, () => {})
  }, [])

  useEffect(() => {
    let live = true
    window.api.recentProjects().then(
      (list) => live && setRecent(list),
      () => live && setRecent([])
    )
    return () => {
      live = false
    }
  }, [])

  /** Primo avvio, o nessun progetto recente: la schermata spiega da dove si comincia */
  const firstRun = recent !== null && recent.length === 0
  const openExample = (): void => {
    window.api.prepareExampleProject(lang).then(onOpen, (e) => console.error(e))
  }

  // una cartella di progetto trascinata qui si apre; quella di un progetto Tabletop Creator si
  // propone di importarla. Le cartelle si leggono durante l'evento: dopo non si può più.
  const [dragging, setDragging] = useState(false)
  const hasFiles = (e: React.DragEvent): boolean => e.dataTransfer.types.includes('Files')
  const onDrop = (e: React.DragEvent): void => {
    setDragging(false)
    const item = Array.from(e.dataTransfer.items).find((i) => i.kind === 'file')
    if (!item) return
    // gli .zip vanno all'importazione dei pacchetti (App), che guarda dataTransfer.files: qui si
    // guarda lo stesso elenco, perché getAsFile a volte non dà il file e lo ZIP finiva qui
    const isZip = (name?: string | null): boolean => !!name?.toLowerCase().endsWith('.zip')
    if (Array.from(e.dataTransfer.files).some((f) => isZip(f.name)) || /zip/i.test(item.type))
      return
    const file = item.getAsFile()
    if (isZip(file?.name)) return
    e.preventDefault()
    const handle =
      window.api.isWeb && 'getAsFileSystemHandle' in item
        ? (
            item as DataTransferItem & {
              getAsFileSystemHandle(): Promise<FileSystemHandle | null>
            }
          ).getAsFileSystemHandle()
        : Promise.resolve(null)
    void (async () => {
      try {
        const path = await window.api.droppedPath({ file, handle: await handle })
        if (isZip(path)) return
        const found = path ? await window.api.inspectDropped(path) : null
        if (found?.kind === 'stella') onOpen(found.folder)
        else if (found?.kind === 'ttc') {
          if (
            await askConfirm({
              title: t('start.dropTtc.title'),
              message: t('start.dropTtc', { folder: found.folder }),
              ok: t('start.dropTtc.ok')
            })
          )
            onImport(found.folder)
        } else await showNotice(t, t('start.dropNotProject'))
      } catch (err) {
        await showNotice(t, t(messageFromError(err)))
      }
    })()
  }

  const remove = async (folder: string): Promise<void> => {
    await window.api.removeRecentProject(folder)
    setRecent((list) => list && list.filter((p) => p.folder !== folder))
  }

  const date = (ms: number): string =>
    new Date(ms).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div
      className={'start' + (dragging ? ' start-dropping' : '')}
      onDragOver={(e) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
      }}
      onDrop={onDrop}
    >
      {dragging && <div className="start-drop-hint">{t('start.dropHint')}</div>}
      <header className="start-header">
        <img className="start-logo" src={appIcon} alt="" draggable={false} />
        <h1>Stella Game Center</h1>
        {version && (
          <button
            className="start-version"
            title={t('update.whatsNewTip')}
            onClick={() => setWhatsNew(true)}
          >
            {version}
            {isPrerelease(version) && <span className="beta-badge">beta</span>}
          </button>
        )}
        <span className="spacer" />
        {settings}
      </header>
      {error && (
        <div className={'banner error' + (rescueFolder ? ' closable' : '')}>
          <span>{t(error)}</span>
          {rescueFolder && (
            <button className="primary" onClick={() => setRescuing(true)}>
              {t('rescue.button')}
            </button>
          )}
        </div>
      )}
      <div className="start-body">
        {firstRun ? (
          <Welcome
            loading={loading}
            onCreate={() => setCreating(true)}
            onExample={openExample}
            onChoose={onChoose}
            onImport={() => setImportChoice(true)}
            onHelp={onHelp}
          />
        ) : (
          <div className="start-actions">
            <button
              className="primary"
              onClick={() => setCreating(true)}
              title={t('tip.newProject')}
            >
              {t('start.newProject')}
            </button>
            <button onClick={onChoose} title={t('tip.openProject')}>
              {t('start.openProject')}
            </button>
            <button onClick={() => setImportChoice(true)} title={t('tip.import')}>
              {t('start.import')}
            </button>
            <button disabled={loading} title={t('tip.example')} onClick={openExample}>
              {t('start.example')}
            </button>
            <button onClick={onHelp} title={t('tip.help')}>
              {t('app.help')}
            </button>
            {loading && <span className="muted">{t('app.loading')}</span>}
          </div>
        )}
        {!firstRun && <h2 className="start-title">{t('start.recent')}</h2>}
        <ul className="recent-list">
          {recent?.map((p) => (
            <li key={p.folder} className={p.missing ? 'missing' : ''}>
              <button
                className="recent-open"
                disabled={p.missing || loading}
                onClick={() => onOpen(p.folder)}
                title={p.missing ? t('start.missing') : p.folder}
              >
                <span className="recent-thumb">
                  {p.thumbnail ? (
                    <img src={p.thumbnail} alt="" draggable={false} />
                  ) : (
                    <span className="recent-initial">{p.name.trim().charAt(0).toUpperCase()}</span>
                  )}
                </span>
                <span className="recent-name">{p.name}</span>
                <span className="recent-meta muted small">
                  {p.missing ? t('start.missing') : date(p.openedAt)}
                </span>
                <span className="recent-path muted small">{p.folder}</span>
              </button>
              <button
                className="icon-btn recent-remove"
                title={t('start.remove')}
                onClick={() => remove(p.folder)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        {!firstRun && recent !== null && (
          <p className="start-drop-tip muted small">{t('start.dropTip')}</p>
        )}
        {!firstRun && recent !== null && (
          <p className="start-learn muted">
            {t('welcome.learnShort')}{' '}
            <a href={videoUrl('overview', lang)} target="_blank" rel="noreferrer">
              {t('welcome.overviewVideo')}
            </a>
            {' · '}
            <a href={guideLink(lang)} target="_blank" rel="noreferrer">
              {t('welcome.guide')}
            </a>
          </p>
        )}
      </div>
      <footer className="start-footer">
        <a className="about-link" href={siteUrl(lang)} target="_blank" rel="noreferrer">
          {t('start.site')}
        </a>
        <a className="about-link" href={DISCORD_URL} target="_blank" rel="noreferrer">
          {t('start.discord')}
        </a>
        <a className="about-link" href={DONATE_URL} target="_blank" rel="noreferrer">
          {t('start.support')}
        </a>
        {version && (
          <button className="about-link" onClick={() => setWhatsNew(true)}>
            {t('update.whatsNew')}
          </button>
        )}
        {window.api.isWeb ? (
          <button className="about-link" onClick={() => setDesktop(true)}>
            {t('web.desktopLink')}
          </button>
        ) : (
          <button className="about-link" onClick={checkForUpdateNow}>
            {t('update.check')}
          </button>
        )}
      </footer>
      {whatsNew && version && (
        <WhatsNewDialog version={version} onClose={() => setWhatsNew(false)} />
      )}
      {desktop && <DesktopFeaturesDialog onClose={() => setDesktop(false)} />}
      {importChoice && (
        <ImportChoiceDialog
          onChoose={(kind) => {
            setImportChoice(false)
            if (kind === 'zip') onImportZip()
            else if (kind === 'backup')
              restoreBackupFromFile(t).then(
                (folder) => folder && onOpen(folder),
                (err) => showNotice(t, t(messageFromError(err)))
              )
            else if (kind === 'ttc') onImport()
            else if (kind === 'nandeck') onImportNandeck()
            else onImportDextrous()
          }}
          onClose={() => setImportChoice(false)}
        />
      )}
      {rescuing && rescueFolder && (
        <RescueDialog folder={rescueFolder} onOpen={onOpen} onClose={() => setRescuing(false)} />
      )}
      {creating && (
        <NewProjectDialog
          onCreate={(folder) => {
            setCreating(false)
            onOpen(folder)
          }}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  )
}

type ImportKind = 'zip' | 'ttc' | 'nandeck' | 'dextrous' | 'backup'

/** Un solo tasto Importa: qui si sceglie da dove viene il progetto */
function ImportChoiceDialog({
  onChoose,
  onClose
}: {
  onChoose(kind: ImportKind): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const choices: { kind: ImportKind; title: MessageKey; text: MessageKey }[] = [
    { kind: 'zip', title: 'importProject.zip', text: 'importProject.zipText' },
    { kind: 'ttc', title: 'importProject.ttc', text: 'importProject.ttcText' },
    { kind: 'nandeck', title: 'importProject.nandeck', text: 'importProject.nandeckText' },
    { kind: 'dextrous', title: 'importProject.dextrous', text: 'importProject.dextrousText' },
    // nel browser i backup si ripristinano dalla finestra Backup del progetto
    ...(window.api.isWeb
      ? []
      : [
          {
            kind: 'backup' as const,
            title: 'importProject.backup' as const,
            text: 'importProject.backupText' as const
          }
        ])
  ]
  return (
    <Dialog title={t('importProject.title')} onClose={onClose}>
      <div className="import-choices">
        {choices.map((c) => (
          <button key={c.kind} className="welcome-choice" onClick={() => onChoose(c.kind)}>
            <span className="welcome-choice-title">{t(c.title)}</span>
            <span className="welcome-choice-text">{t(c.text)}</span>
          </button>
        ))}
      </div>
      <div className="dialog-buttons">
        <button onClick={onClose}>{t('format.cancel')}</button>
      </div>
    </Dialog>
  )
}

/** Primo avvio: due strade grandi, i tre passi di Stella e dove imparare */
function Welcome({
  loading,
  onCreate,
  onExample,
  onChoose,
  onImport,
  onHelp
}: {
  loading: boolean
  onCreate(): void
  onExample(): void
  onChoose(): void
  /** Apre la scelta del formato da importare */
  onImport(): void
  onHelp(): void
}): React.JSX.Element {
  const { t, lang } = useI18n()
  return (
    <section className="welcome">
      <h2 className="welcome-title">{t('welcome.title')}</h2>
      <p className="welcome-lead">{t('welcome.lead')}</p>
      <div className="welcome-choices">
        <button className="welcome-choice main" disabled={loading} onClick={onCreate}>
          <span className="welcome-choice-title">{t('welcome.scratch')}</span>
          <span className="welcome-choice-text">{t('welcome.scratchText')}</span>
        </button>
        <button className="welcome-choice" disabled={loading} onClick={onExample}>
          <span className="welcome-choice-title">{t('welcome.example')}</span>
          <span className="welcome-choice-text">{t('welcome.exampleText')}</span>
        </button>
      </div>
      <ol className="welcome-steps">
        <li>
          <strong>{t('welcome.step1')}</strong> {t('welcome.step1Text')}
        </li>
        <li>
          <strong>{t('welcome.step2')}</strong> {t('welcome.step2Text')}
        </li>
        <li>
          <strong>{t('welcome.step3')}</strong> {t('welcome.step3Text')}
        </li>
      </ol>
      <p className="welcome-links">
        <a href={videoUrl('overview', lang)} target="_blank" rel="noreferrer">
          {t('welcome.overviewVideo')}
        </a>
        <a href={tutorialsUrl(lang)} target="_blank" rel="noreferrer">
          {t('welcome.allVideos')}
        </a>
        <a href={guideLink(lang)} target="_blank" rel="noreferrer">
          {t('welcome.guide')}
        </a>
      </p>
      <p className="welcome-other">
        <button onClick={onChoose} title={t('tip.openProject')}>
          {t('start.openProject')}
        </button>
        <button onClick={onImport} title={t('tip.import')}>
          {t('start.import')}
        </button>
        <button onClick={onHelp} title={t('tip.help')}>
          {t('app.help')}
        </button>
        {loading && <span className="muted">{t('app.loading')}</span>}
      </p>
    </section>
  )
}

function NewProjectDialog({
  onCreate,
  onClose
}: {
  onCreate(folder: string): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [parent, setParent] = useState(() => localStorage.getItem(PARENT_KEY) ?? '')
  const [error, setError] = useState<Message | null>(null)
  const [busy, setBusy] = useState(false)
  // 'existing': il file dei dati è la copia di un file che c'è già
  const [data, setData] = useState<'xlsx' | 'ods' | 'existing'>('xlsx')
  const [existing, setExisting] = useState('')

  useEffect(() => {
    if (parent) return
    window.api.defaultProjectsFolder().then((f) => setParent((p) => p || f))
  }, [parent])

  const folderName = projectFolderName(name)
  const sep = parent.includes('\\') && !parent.includes('/') ? '\\' : '/'
  const target = folderName && parent ? parent.replace(/[\\/]+$/, '') + sep + folderName : ''

  const create = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const folder =
        data === 'existing'
          ? await window.api.createProject(name, parent.trim(), undefined, existing)
          : await window.api.createProject(name, parent.trim(), data)
      localStorage.setItem(PARENT_KEY, parent.trim())
      onCreate(folder)
    } catch (e) {
      setError(messageFromError(e))
      setBusy(false)
    }
  }

  return (
    <Dialog title={t('newProject.title')} onClose={onClose}>
      <form
        className="dialog-form new-project"
        onSubmit={(e) => {
          e.preventDefault()
          if (target && !busy && (data !== 'existing' || existing)) create()
        }}
      >
        <label>
          {t('prop.name')}
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          {t('newProject.location')}
          <span className="field-control">
            {/* nel browser la cartella si sceglie solo con la finestra: non ha un percorso vero */}
            <input
              value={parent}
              title={parent}
              readOnly={window.api.isWeb}
              onChange={(e) => setParent(e.target.value)}
            />
            <button
              type="button"
              title={t('tip.chooseFolder')}
              onClick={async () => {
                const f = await window.api.chooseFolder(parent || undefined)
                if (f) setParent(f)
              }}
            >
              {t('export.choose')}
            </button>
          </span>
        </label>
        <details className="new-project-more" open={data !== 'xlsx'}>
          <summary>{t('newProject.more')}</summary>
          <p className="field-note">{t('newProject.dataNote')}</p>
          <label>
            {t('newProject.dataFile')}
            <select value={data} onChange={(e) => setData(e.target.value as typeof data)}>
              <option value="xlsx">{t('newProject.xlsx')}</option>
              <option value="ods">{t('newProject.ods')}</option>
              {!window.api.isWeb && <option value="existing">{t('newProject.existing')}</option>}
            </select>
          </label>
          {data === 'existing' && (
            <label>
              {t('newProject.existingFile')}
              <span className="field-control">
                <input value={existing} title={existing} readOnly />
                <button
                  type="button"
                  onClick={async () => {
                    const f = await window.api.chooseDataFile()
                    if (f) setExisting(f)
                  }}
                >
                  {t('export.choose')}
                </button>
              </span>
            </label>
          )}
          {data === 'existing' && <p className="field-note">{t('newProject.existingNote')}</p>}
        </details>
        <p className="field-note">
          {target ? t('newProject.folder', { folder: target }) : t('newProject.hint')}
        </p>
        {error && <p className="field-error">{t(error)}</p>}
        <div className="dialog-buttons">
          <button type="button" onClick={onClose}>
            {t('dialog.cancel')}
          </button>
          <button
            type="submit"
            className="primary"
            disabled={!target || busy || (data === 'existing' && !existing)}
          >
            {t('newTemplate.create')}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
