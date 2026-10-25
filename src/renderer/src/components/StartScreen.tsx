import { useEffect, useState } from 'react'
import type { RecentProject } from '../../../shared/api'
import { projectFolderName } from '../../../shared/model/projectName'
import { isPrerelease } from '../../../shared/update'
import { DONATE_URL, siteUrl } from '../../../shared/donate'
import { messageFromError, type Message } from '../../../shared/messages'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import appIcon from '../assets/app-icon.png'
import DesktopFeaturesDialog from './DesktopFeaturesDialog'
import { WhatsNewDialog } from './UpdateNotice'
import { checkForUpdateNow } from './updateCheck'

// Schermata di ingresso: progetti recenti con miniatura, nuovo progetto, apertura e importazione.

const PARENT_KEY = 'newProjectParent'

export default function StartScreen({
  error,
  loading,
  settings,
  onOpen,
  onChoose,
  onImport,
  onHelp
}: {
  error: Message | null
  loading: boolean
  /** Dimensione dell'interfaccia, tema e lingua */
  settings: React.ReactNode
  onOpen(folder: string): void
  /** Sceglie una cartella di progetto e la apre */
  onChoose(): void
  onImport(): void
  onHelp(): void
}): React.JSX.Element {
  const { t, lang } = useI18n()
  const [recent, setRecent] = useState<RecentProject[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [version, setVersion] = useState<string | null>(null)
  const [whatsNew, setWhatsNew] = useState(false)
  const [desktop, setDesktop] = useState(false)

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

  const remove = async (folder: string): Promise<void> => {
    await window.api.removeRecentProject(folder)
    setRecent((list) => list && list.filter((p) => p.folder !== folder))
  }

  const date = (ms: number): string =>
    new Date(ms).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="start">
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
      {error && <div className="banner error">{t(error)}</div>}
      <div className="start-body">
        <div className="start-actions">
          <button className="primary" onClick={() => setCreating(true)} title={t('tip.newProject')}>
            {t('start.newProject')}
          </button>
          <button onClick={onChoose} title={t('tip.openProject')}>
            {t('start.openProject')}
          </button>
          <button onClick={onImport} title={t('tip.importTtc')}>
            {t('start.importTtc')}
          </button>
          {!window.api.isWeb && (
            <button
              disabled={loading}
              title={t('tip.example')}
              onClick={() => {
                window.api.prepareExampleProject(lang).then(onOpen, (e) => console.error(e))
              }}
            >
              {t('start.example')}
            </button>
          )}
          <button onClick={onHelp} title={t('tip.help')}>
            {t('app.help')}
          </button>
          {loading && <span className="muted">{t('app.loading')}</span>}
        </div>
        <h2 className="start-title">{t('start.recent')}</h2>
        {recent && recent.length === 0 && <p className="muted">{t('start.noRecent')}</p>}
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
      </div>
      <footer className="start-footer">
        <a className="about-link" href={siteUrl(lang)} target="_blank" rel="noreferrer">
          {t('start.site')}
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
