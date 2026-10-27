import { useContext, useState } from 'react'
import NumInput from './NumInput'
import type { Sheet } from '../../../shared/project'
import { resolveAsset } from '../../../shared/model/assets'
import { splitAspect, splitImage, splittableLayers } from '../../../shared/model/split'
import type { Template } from '../../../shared/model/template'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import { AssetsContext, assetUrl } from '../render/assets'
import { useImageSize } from '../render/imageSize'
import AssetPicker from './AssetPicker'
import { ImageIcon } from './icons'

/** Divide un'immagine grande tra le carte del set: ognuna ne mostra un pezzo */
export default function SplitImageDialog({
  sheet,
  template,
  onApply,
  onClose
}: {
  sheet: Sheet
  template: Template
  onApply(sheet: Sheet): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const assets = useContext(AssetsContext)
  const layers = splittableLayers(template)
  const [layer, setLayer] = useState(layers[0]?.name ?? '')
  const [src, setSrc] = useState('')
  const [picking, setPicking] = useState(false)
  const [cols, setCols] = useState(3)
  const [rows, setRows] = useState(3)
  const [order, setOrder] = useState<'rows' | 'columns'>('rows')
  const [outerBleed, setOuterBleed] = useState(false)
  const [start, setStart] = useState(1)

  const found = src.trim() ? resolveAsset(src, assets) : null
  const size = useImageSize(found?.ok ? assetUrl(found.path) : null)
  const ideal = splitAspect(template, { cols, rows, outerBleed })
  const off = size ? Math.abs(size.w / size.h / ideal - 1) : 0
  const n = cols * rows
  const valid = !!layer && !!found?.ok && cols >= 1 && rows >= 1 && n <= 400 && start >= 1

  const num = (v: string, set: (n: number) => void): void => {
    const x = parseInt(v, 10)
    if (Number.isFinite(x)) set(Math.max(1, Math.min(40, x)))
  }

  return (
    <Dialog title={t('split.title')} onClose={onClose}>
      <form
        className="dialog-form split-dialog"
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) return
          onApply(
            splitImage(sheet, template, {
              layer,
              src: src.trim(),
              cols,
              rows,
              order,
              outerBleed,
              start: start - 1
            })
          )
        }}
      >
        <p className="muted small">{t('split.hint')}</p>
        {!layers.length ? (
          <p className="field-error">{t('split.noLayer')}</p>
        ) : (
          <label>
            {t('split.layer')}
            <select value={layer} onChange={(e) => setLayer(e.target.value)}>
              {layers.map((l) => (
                <option key={l.id} value={l.name}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          {t('split.image')}
          <span className="split-image">
            <input
              value={src}
              placeholder={t('split.imagePlaceholder')}
              onChange={(e) => setSrc(e.target.value)}
            />
            <button type="button" className="pick-btn" onClick={() => setPicking(true)}>
              <ImageIcon />
            </button>
          </span>
        </label>
        {found && !found.ok && <p className="field-error">{t('split.imageMissing')}</p>}
        <div className="dialog-row">
          <label>
            {t('split.cols')}
            <NumInput
              min={1}
              max={40}
              value={cols}
              onChange={(e) => num(e.target.value, setCols)}
            />
          </label>
          <label>
            {t('split.rows')}
            <NumInput
              min={1}
              max={40}
              value={rows}
              onChange={(e) => num(e.target.value, setRows)}
            />
          </label>
          <label>
            {t('split.start')}
            <NumInput min={1} value={start} onChange={(e) => num(e.target.value, setStart)} />
          </label>
        </div>
        <label>
          {t('split.order')}
          <select value={order} onChange={(e) => setOrder(e.target.value as 'rows' | 'columns')}>
            <option value="rows">{t('split.byRows')}</option>
            <option value="columns">{t('split.byColumns')}</option>
          </select>
        </label>
        <label className="split-check">
          <input
            type="checkbox"
            checked={outerBleed}
            onChange={(e) => setOuterBleed(e.target.checked)}
          />
          {t('split.outerBleed', { bleed: template.bleed })}
        </label>
        <p className="muted small">
          {t('split.summary', {
            n,
            from: start,
            to: start + n - 1,
            added: Math.max(0, start - 1 + n - sheet.rows.length)
          })}
        </p>
        {size && off > 0.02 && (
          <p className="field-note">
            {t('split.aspect', {
              ideal: ideal.toFixed(3),
              actual: (size.w / size.h).toFixed(3),
              w: size.w,
              h: Math.round(size.w / ideal)
            })}
          </p>
        )}
        <div className="dialog-buttons">
          <button type="button" onClick={onClose}>
            {t('dialog.cancel')}
          </button>
          <button type="submit" className="primary" disabled={!valid}>
            {t('split.apply')}
          </button>
        </div>
      </form>
      {picking && (
        <AssetPicker
          value={src}
          onPick={(name) => setSrc(name)}
          onClose={() => setPicking(false)}
        />
      )}
    </Dialog>
  )
}
