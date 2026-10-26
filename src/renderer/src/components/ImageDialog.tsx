import { useContext, useState } from 'react'
import NumInput from './NumInput'
import { resolveAsset } from '../../../shared/model/assets'
import { imageSourceWith, splitImageSource, type FigureAlign } from '../../../shared/model/document'
import { imageVariable } from '../../../shared/model/variables'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import { AssetsContext, VariablesContext, assetUrl } from '../render/assets'
import AssetPicker from './AssetPicker'
import Segmented from './Segmented'

/** Un'immagine del documento come è scritta: ![didascalia](sorgente) */
export interface DocImageValue {
  alt: string
  src: string
}

/**
 * Inserisce o modifica un'immagine degli asset nel documento: il file, la larghezza in mm (vuota
 * per la misura dell'immagine), l'allineamento della riga e la didascalia.
 */
export default function ImageDialog({
  initial,
  onSave,
  onClose
}: {
  initial?: DocImageValue
  onSave(markdown: string): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const assets = useContext(AssetsContext)
  const variables = useContext(VariablesContext)
  const start = initial ? splitImageSource(initial.src) : null
  const [path, setPath] = useState(start?.path ?? '')
  const [width, setWidth] = useState(start?.options.width ? String(start.options.width) : '')
  const [align, setAlign] = useState<FigureAlign>(start?.options.align ?? 'center')
  const [alt, setAlt] = useState(initial?.alt ?? '')
  const [picking, setPicking] = useState(!initial)

  const name = path.replace(/^\{(.*)\}$/, '$1')
  const v = imageVariable(name, variables)
  const found = path ? resolveAsset(v ? v.src : name, assets) : null
  const text = `![${alt.replace(/[[\]]/g, '')}](${imageSourceWith(path, { width: Number(width) > 0 ? Number(width) : undefined, align })})`

  return (
    <Dialog title={t(initial ? 'docImage.edit' : 'docImage.insert')} onClose={onClose}>
      <div className="dialog-form doc-image-dialog">
        <div className="doc-image-pick">
          <div className="doc-image-thumb">
            {found?.ok ? (
              <img src={assetUrl(found.path)} alt="" />
            ) : (
              <span className="muted small">
                {path ? t('docImage.notFound') : t('docImage.none')}
              </span>
            )}
          </div>
          <div className="doc-image-file">
            <code>{path || '—'}</code>
            <button onClick={() => setPicking(true)}>{t('docImage.choose')}</button>
          </div>
        </div>
        <div className="dialog-row">
          <label>
            {t('documents.width')}
            <NumInput
              allowEmpty
              className="num"
              min={1}
              value={width}
              placeholder={t('docImage.auto')}
              onChange={(e) => setWidth(e.target.value)}
            />
          </label>
          <label>
            {t('docImage.align')}
            <Segmented<FigureAlign>
              value={align}
              options={[
                ['left', t('align.left')],
                ['center', t('align.center')],
                ['right', t('align.right')]
              ]}
              onChange={setAlign}
            />
          </label>
        </div>
        <p className="muted small">{t('docImage.alignHint')}</p>
        <label>
          {t('documents.caption')}
          <input value={alt} onChange={(e) => setAlt(e.target.value)} />
        </label>
        <code className="insert-card-code">{text}</code>
        <div className="dialog-buttons">
          <button onClick={onClose}>{t('dialog.cancel')}</button>
          <button className="primary" disabled={!path} onClick={() => onSave(text)}>
            {t(initial ? 'docImage.save' : 'documents.insert')}
          </button>
        </div>
      </div>
      {picking && (
        <AssetPicker
          value={path}
          onPick={(p) => {
            setPicking(false)
            setPath(p)
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </Dialog>
  )
}
