import { useContext, useState } from 'react'
import { DEFAULT_BOX_STYLE, type BoxStyle } from '../../../shared/model/docBox'
import { palette, resolveColor } from '../../../shared/model/variables'
import { Dialog } from '../editor/dialogs'
import { ColorField, NumberField } from '../editor/fields'
import { useI18n } from '../i18n/context'
import { VariablesContext } from '../render/assets'
import { useUndo } from './useUndo'
import WrapField from './WrapField'

/**
 * Aspetto di un riquadro del documento: sfondo, bordo, spazio interno e angoli. Con `onRemove`
 * il riquadro c'è già e si può togliere.
 */
export default function BoxDialog({
  initial,
  onSave,
  onRemove,
  onClose
}: {
  initial?: BoxStyle
  onSave(style: BoxStyle): void
  onRemove?(): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const variables = useContext(VariablesContext)
  const [style, setStyle] = useState<BoxStyle>(initial ?? DEFAULT_BOX_STYLE)
  const change = (c: Partial<BoxStyle>): void => setStyle((s) => ({ ...s, ...c }))
  useUndo([style], ([s]) => setStyle(s))
  const pal = palette(variables)
  const mm = 3.78

  return (
    <Dialog title={t('documents.box')} onClose={onClose}>
      <div className="dialog-form box-dialog">
        <div
          className="box-dialog-sample"
          style={{
            background: style.fill ? resolveColor(style.fill, pal) : 'none',
            border:
              style.border && style.borderWidth > 0
                ? `${Math.max(1, style.borderWidth * mm)}px solid ${resolveColor(style.border, pal)}`
                : '1px dashed var(--border)',
            padding: style.padding * mm,
            borderRadius: style.radius * mm
          }}
        >
          {t('documents.boxSample')}
        </div>
        <ColorField
          label={t('documents.boxFill')}
          value={style.fill}
          nullable
          fallback={DEFAULT_BOX_STYLE.fill ?? '#f3f3f0'}
          onChange={(fill) => change({ fill })}
        />
        <ColorField
          label={t('documents.boxBorder')}
          value={style.border}
          nullable
          fallback="#c8c8c2"
          onChange={(border) => change({ border })}
        />
        <NumberField
          label={t('documents.boxBorderWidth')}
          value={style.borderWidth}
          disabled={!style.border}
          min={0}
          step={0.05}
          unit="mm"
          onChange={(borderWidth) => change({ borderWidth })}
        />
        <NumberField
          label={t('documents.boxPadding')}
          value={style.padding}
          min={0}
          step={0.5}
          unit="mm"
          onChange={(padding) => change({ padding })}
        />
        <NumberField
          label={t('documents.boxRadius')}
          value={style.radius}
          min={0}
          step={0.5}
          unit="mm"
          onChange={(radius) => change({ radius })}
        />
        <NumberField
          label={t('documents.boxWidth')}
          value={Math.round((style.width ?? (style.wrap ? 0.5 : 1)) * 100)}
          min={10}
          max={100}
          step={5}
          unit="%"
          onChange={(n) => change({ width: n >= 100 ? null : Math.max(10, n) / 100 })}
        />
        <WrapField
          value={style.wrap}
          // un riquadro a tutta riga non lascia posto al testo: si parte da metà
          onChange={(wrap) => change(wrap && !style.width ? { wrap, width: 0.5 } : { wrap })}
        />
        <p className="muted small">{t('documents.boxHint')}</p>
        <div className="dialog-buttons">
          {onRemove && (
            <button className="danger" title={t('documents.boxRemoveHint')} onClick={onRemove}>
              {t('documents.boxRemove')}
            </button>
          )}
          <span className="spacer" />
          <button onClick={onClose}>{t('dialog.cancel')}</button>
          <button className="primary" onClick={() => onSave(style)}>
            {t(onRemove ? 'docImage.save' : 'documents.insert')}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
