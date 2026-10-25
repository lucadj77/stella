import { useEffect, useState } from 'react'
import { messageFromError, type Message } from '../../../shared/messages'
import { fillSkill } from '../../../shared/skill'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import skillSource from '../../../../skill/stella/SKILL.md?raw'

// Strumenti per gli agenti IA: la skill di Stella, in inglese, con il comando stella di questo
// computer già inserito, da copiare nell'agente o salvare come file. Solo le istruzioni
// intorno sono tradotte. Vedi docs/cli.md.

export default function AiToolsDialog({ onClose }: { onClose(): void }): React.JSX.Element {
  const { t } = useI18n()
  const [command, setCommand] = useState<{ command: string; ready: boolean } | null>(null)
  const [done, setDone] = useState<Message | null>(null)
  const [error, setError] = useState<Message | null>(null)

  useEffect(() => {
    window.api.stellaCommand().then(setCommand, (e) => setError(messageFromError(e)))
  }, [])

  // nel web non c'è un comando di questo computer: lo cerca (o lo installa) la skill stessa
  const skill = command ? fillSkill(skillSource, __APP_VERSION__, command.command) : ''

  const copy = async (): Promise<void> => {
    setError(null)
    try {
      await navigator.clipboard.writeText(skill)
      setDone({ key: 'ai.copied' })
    } catch (e) {
      setError(messageFromError(e))
    }
  }

  const save = async (): Promise<void> => {
    setError(null)
    try {
      const folder = await window.api.chooseFolder(await window.api.skillsFolder())
      if (!folder) return
      const file = await window.api.saveSkill(folder, skill)
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
        {error && <div className="banner error">{t(error)}</div>}
        {done && <div className="banner">{t(done)}</div>}
        <textarea className="ai-skill" readOnly value={skill} spellCheck={false} />
        <div className="dialog-buttons">
          <button className="primary" disabled={!command} onClick={copy}>
            {t('ai.copy')}
          </button>
          {/* il browser non scrive fuori dalle cartelle dei progetti */}
          {!window.api.isWeb && (
            <button disabled={!command} onClick={save}>
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
