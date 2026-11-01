import { useEffect, useState } from 'react'
import { messageFromError, type Message } from '../../../shared/messages'
import { SKILL_PAGE, fillSkill } from '../../../shared/skill'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'

// Strumenti per gli agenti IA: la skill di Stella, in inglese, con il comando stella di questo
// computer già inserito, da copiare nell'agente o salvare come file. Solo le istruzioni
// intorno sono tradotte. La skill non è dentro l'app: si scarica da GitHub (quella della
// versione installata) solo quando si preme Copia o Salva. Vedi docs/cli.md.

export default function AiToolsDialog({ onClose }: { onClose(): void }): React.JSX.Element {
  const { t } = useI18n()
  const [command, setCommand] = useState<{ command: string; ready: boolean } | null>(null)
  const [done, setDone] = useState<Message | null>(null)
  const [error, setError] = useState<Message | null>(null)
  /** Testo della skill scaricato da GitHub */
  const [source, setSource] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    window.api.stellaCommand().then(setCommand, (e) => setError(messageFromError(e)))
  }, [])

  // nel web non c'è un comando di questo computer: lo cerca (o lo installa) la skill stessa
  const fill = (text: string): string =>
    command ? fillSkill(text, __APP_VERSION__, command.command) : ''

  /** La skill pronta, scaricata la prima volta che serve */
  const getSkill = async (): Promise<string> => {
    if (source !== null) return fill(source)
    setLoading(true)
    try {
      const text = await window.api.downloadSkill()
      setSource(text)
      return fill(text)
    } finally {
      setLoading(false)
    }
  }

  const copy = async (): Promise<void> => {
    setError(null)
    setDone(null)
    try {
      await navigator.clipboard.writeText(await getSkill())
      setDone({ key: 'ai.copied' })
    } catch (e) {
      setError(messageFromError(e))
    }
  }

  const save = async (): Promise<void> => {
    setError(null)
    setDone(null)
    try {
      const folder = await window.api.chooseFolder(await window.api.skillsFolder())
      if (!folder) return
      const file = await window.api.saveSkill(folder, await getSkill())
      setDone({ key: 'ai.saved', params: { file } })
    } catch (e) {
      setError(messageFromError(e))
    }
  }

  return (
    <Dialog title={t('ai.title')} onClose={onClose}>
      <div className="ai-tools">
        <p>{t('ai.intro')}</p>
        <ol>
          <li>{t('ai.step1')}</li>
          <li>{t('ai.step2')}</li>
          <li>{t('ai.step3')}</li>
        </ol>
        <p className="muted small">{t(window.api.isWeb ? 'ai.webHint' : 'ai.saveHint')}</p>
        {command && !command.ready && <div className="banner warning">{t('ai.notBuilt')}</div>}
        <p className="muted small">{t('ai.downloadHint')}</p>
        {error && (
          <div className="banner error">
            {t(error)}{' '}
            {error.key === 'ai.downloadFailed' && (
              <a href={SKILL_PAGE} target="_blank" rel="noreferrer">
                {t('ai.openPage')}
              </a>
            )}
          </div>
        )}
        {done && <div className="banner">{t(done)}</div>}
        {source !== null && (
          <textarea className="ai-skill" readOnly value={fill(source)} spellCheck={false} />
        )}
        <div className="dialog-buttons">
          <button className="primary" disabled={!command || loading} onClick={copy}>
            {loading ? t('ai.downloading') : t('ai.copy')}
          </button>
          {/* il browser non scrive fuori dalle cartelle dei progetti */}
          {!window.api.isWeb && (
            <button disabled={!command || loading} onClick={save}>
              {t('ai.save')}
            </button>
          )}
          <span className="spacer" />
          <button onClick={onClose}>{t('dialog.close')}</button>
        </div>
      </div>
    </Dialog>
  )
}
