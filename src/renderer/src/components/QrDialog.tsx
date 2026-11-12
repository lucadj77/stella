import { useState } from 'react'
import { isQrImage, qrDataUrl, qrText } from '../../../shared/model/qr'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'

/**
 * Un codice QR come immagine: il testo o l'indirizzo diventa «qr:testo», che il livello immagine
 * disegna. `value` è il valore attuale del livello, per correggere un QR già scelto.
 */
export default function QrDialog({
  value,
  onPick,
  onClose
}: {
  value: string
  onPick(name: string): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const [text, setText] = useState(isQrImage(value) ? qrText(value) : '')
  const trimmed = text.trim()
  const url = trimmed ? qrDataUrl(trimmed) : ''
  return (
    <Dialog title={t('qr.title')} onClose={onClose}>
      <div className="qr-dialog">
        <label className="url-image-field">
          <span>{t('qr.text')}</span>
          <textarea
            autoFocus
            rows={3}
            value={text}
            placeholder="https://"
            onChange={(e) => setText(e.target.value)}
          />
          <span className="muted small">{t('qr.hint')}</span>
        </label>
        <div className="qr-preview">
          {url ? (
            <img src={url} alt="" />
          ) : (
            <span className="muted small">{trimmed ? t('qr.tooLong') : t('qr.empty')}</span>
          )}
        </div>
        <div className="dialog-buttons">
          <button onClick={onClose}>{t('dialog.cancel')}</button>
          <button
            className="primary"
            disabled={!url}
            onClick={() => {
              onPick(`qr:${trimmed}`)
              onClose()
            }}
          >
            {t('qr.use')}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
