import { useState } from 'react'
import type { NandeckImportResult, NandeckScriptInfo } from '../../../shared/api'
import { messageFromError, type Message } from '../../../shared/messages'
import { NANDECK_SKILL_PAGE, fillSkill } from '../../../shared/skill'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import type { MessageKey } from '../i18n/en'

// Importazione di un gioco nanDECK in una cartella nuova (src/main/import/nandeck.ts): si
// sceglie la cartella del gioco, poi gli script da convertire. Alla fine il riepilogo dice che
// l'importazione è parziale e come finirla con la skill nanDECK, che si scarica a parte.

type Folder = 'source' | 'target'

/** La skill porta la versione di Stella, così l'agente sa quando aggiornarla */
const withVersion = (text: string): string => fillSkill(text, __APP_VERSION__, '')

const KIND_HINT: Record<NandeckScriptInfo['kind'], MessageKey | null> = {
  deck: null,
  copy: 'nandeck.kind.copy',
  print: 'nandeck.kind.print',
  include: 'nandeck.kind.include'
}

export default function ImportNandeckDialog({
  onOpen,
  onClose
}: {
  /** Apre il progetto appena creato e la nota dell'importazione */
  onOpen(folder: string, note: string): void
  onClose(): void
}): React.JSX.Element {
  const { t, lang } = useI18n()
  const [folders, setFolders] = useState<Record<Folder, string>>({ source: '', target: '' })
  const [scripts, setScripts] = useState<NandeckScriptInfo[] | null>(null)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [name, setName] = useState('')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<Message | null>(null)
  const [result, setResult] = useState<NandeckImportResult | null>(null)
  const [skillDone, setSkillDone] = useState<Message | null>(null)
  const [skillError, setSkillError] = useState<Message | null>(null)

  const setSource = async (source: string): Promise<void> => {
    setFolders((f) => ({ ...f, source }))
    setScripts(null)
    setError(null)
    if (!source.trim()) return
    try {
      const list = await window.api.scanNandeck(source.trim())
      setScripts(list)
      setChosen(new Set(list.filter((s) => s.selected).map((s) => s.path)))
      setName(source.trim().split(/[\\/]/).filter(Boolean).pop() ?? '')
      const target = await window.api.defaultNandeckTarget(source.trim())
      setFolders((f) => ({ ...f, target }))
    } catch (e) {
      setError(messageFromError(e))
    }
  }

  const choose = async (key: Folder): Promise<void> => {
    const f = await window.api.chooseFolder(folders[key] || folders.source || undefined)
    if (!f) return
    if (key === 'source') await setSource(f)
    else setFolders((x) => ({ ...x, [key]: f }))
  }

  const toggle = (path: string): void =>
    setChosen((c) => {
      const next = new Set(c)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  const run = async (): Promise<void> => {
    setRunning(true)
    setError(null)
    try {
      setResult(
        await window.api.importNandeck({
          source: folders.source.trim(),
          target: folders.target.trim(),
          scripts: (scripts ?? []).filter((s) => chosen.has(s.path)).map((s) => s.path),
          language: lang,
          name: name.trim()
        })
      )
    } catch (e) {
      setError(messageFromError(e))
    } finally {
      setRunning(false)
    }
  }

  /** La skill nanDECK si scarica da GitHub solo quando la si chiede */
  const skill = async (how: 'copy' | 'save'): Promise<void> => {
    setSkillError(null)
    setSkillDone(null)
    try {
      if (how === 'save') {
        const folder = await window.api.chooseFolder(await window.api.skillsFolder())
        if (!folder) return
        const text = withVersion(await window.api.downloadSkill('stella-nandeck'))
        const file = await window.api.saveSkill(folder, text, 'stella-nandeck')
        setSkillDone({ key: 'ai.saved', params: { file } })
      } else {
        await navigator.clipboard.writeText(
          withVersion(await window.api.downloadSkill('stella-nandeck'))
        )
        setSkillDone({ key: 'ai.copied' })
      }
    } catch (e) {
      setSkillError(messageFromError(e))
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
              ? setFolders((f) => ({ ...f, source: e.target.value }))
              : setFolders((f) => ({ ...f, [key]: e.target.value }))
          }
          onBlur={(e) => {
            if (key === 'source' && !window.api.isWeb) void setSource(e.target.value)
          }}
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
      <Dialog title={t('nandeck.title')} onClose={onClose}>
        <div className="export-dialog export-result">
          <p>
            {t('nandeck.done', {
              templates: result.templates,
              sets: result.sets,
              cards: result.cards,
              images: result.images
            })}
          </p>
          <p className="muted small">{result.folder}</p>
          <div className="banner warning">
            {t(result.skipped ? 'nandeck.partial' : 'nandeck.partialNone', {
              count: result.skipped,
              note: result.note
            })}
          </div>
          <h3>{t('nandeck.skillTitle')}</h3>
          <p className="muted small">{t('nandeck.skillHint')}</p>
          <div className="dialog-buttons start">
            <button onClick={() => skill('copy')}>{t('nandeck.skillCopy')}</button>
            {!window.api.isWeb && (
              <button onClick={() => skill('save')}>{t('nandeck.skillSave')}</button>
            )}
            <a href={NANDECK_SKILL_PAGE} target="_blank" rel="noreferrer">
              {t('ai.openPage')}
            </a>
          </div>
          {skillDone && <p className="muted small">{t(skillDone)}</p>}
          {skillError && <div className="banner error">{t(skillError)}</div>}
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
              <h3>{t('nandeck.missingImages', { count: result.missingImages.length })}</h3>
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
            <button className="primary" onClick={() => onOpen(result.folder, result.note)}>
              {t('ttc.open')}
            </button>
          </div>
        </div>
      </Dialog>
    )

  return (
    <Dialog title={t('nandeck.title')} onClose={onClose}>
      <div className="export-dialog">
        <div className="banner warning">{t('nandeck.experimental')}</div>
        <p className="muted small">{t('nandeck.intro')}</p>
        <div className="export-fields">
          {field('source', 'nandeck.source', 'nandeck.sourceHint')}
          {scripts && (
            <div className="field">
              <span className="field-label">{t('nandeck.scripts')}</span>
              <div className="nandeck-scripts">
                {scripts.map((s) => {
                  const hint = KIND_HINT[s.kind]
                  return (
                    <label key={s.path} className="check">
                      <input
                        type="checkbox"
                        checked={chosen.has(s.path)}
                        onChange={() => toggle(s.path)}
                      />
                      <span>{s.path}</span>
                      {hint && <span className="muted small"> · {t(hint)}</span>}
                    </label>
                  )
                })}
              </div>
              <p className="field-note export-note">{t('nandeck.scriptsHint')}</p>
            </div>
          )}
          {scripts && (
            <div className="field">
              <span className="field-label">{t('nandeck.name')}</span>
              <div className="field-control">
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            </div>
          )}
          {field('target', 'ttc.target', 'ttc.targetHint')}
        </div>
        {error && <p className="field-error">{t(error)}</p>}
        <div className="dialog-buttons">
          <button onClick={onClose}>{t('format.cancel')}</button>
          <button
            className="primary"
            disabled={running || !chosen.size || !folders.source.trim() || !folders.target.trim()}
            onClick={run}
          >
            {running ? t('ttc.running') : t('ttc.import')}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
