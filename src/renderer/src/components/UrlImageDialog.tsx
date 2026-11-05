import { useState } from 'react'
import { isRemoteImage } from '../../../shared/model/assets'
import { isValidAssetName } from '../../../shared/library'
import { nameFromUrl } from '../../../shared/model/remoteUrl'
import { messageFromError, type Message } from '../../../shared/messages'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import { publishAssetsUpdate } from '../render/assets'

/**
 * Immagine da internet (docs/specifica.md, 3.1): si scarica in assets/images, con l'indirizzo
 * ricordato in sources.json, oppure si usa il collegamento https://... al posto del nome.
 * `onPick` riceve il nome del file scaricato o l'indirizzo.
 */
export default function UrlImageDialog({
  onPick,
  onClose
}: {
  onPick(name: string): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [named, setNamed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<Message | null>(null)
  const valid = isRemoteImage(url)
  const fileName = named ? name : valid ? nameFromUrl(url.trim()) : ''

  const download = async (): Promise<void> => {
    setError(null)
    setBusy(true)
    try {
      const r = await window.api.downloadImage(url.trim(), fileName.trim())
      publishAssetsUpdate(r.update)
      onPick(fileName.trim())
      onClose()
    } catch (e) {
      setError(messageFromError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog title={t('urlImage.title')} onClose={onClose}>
      <div className="url-image-dialog">
        <label className="url-image-field">
          <span>{t('urlImage.url')}</span>
          <input
            autoFocus
            type="url"
            value={url}
            placeholder="https://"
            onChange={(e) => setUrl(e.target.value)}
          />
          <span className="muted small">{t('urlImage.urlHint')}</span>
        </label>
        <label className="url-image-field">
          <span>{t('urlImage.name')}</span>
          <input
            value={fileName}
            onChange={(e) => {
              setNamed(true)
              setName(e.target.value)
            }}
          />
          <span className="muted small">{t('urlImage.nameHint')}</span>
        </label>
        {window.api.isWeb && <p className="muted small">{t('urlImage.webNote')}</p>}
        {error && <div className="banner error">{t(error)}</div>}
        <div className="url-image-choices">
          <button
            className="primary"
            disabled={!valid || busy || !isValidAssetName(fileName.trim())}
            onClick={download}
          >
            {t('urlImage.download')}
          </button>
          <span className="muted small">{t('urlImage.downloadHint')}</span>
          <button
            disabled={!valid || busy}
            onClick={() => {
              onPick(url.trim())
              onClose()
            }}
          >
            {t('urlImage.link')}
          </button>
          <span className="muted small">{t('urlImage.linkHint')}</span>
        </div>
        <div className="dialog-buttons">
          <button onClick={onClose}>{t('dialog.cancel')}</button>
        </div>
      </div>
    </Dialog>
  )
}
