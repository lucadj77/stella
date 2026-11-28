import { useI18n } from '../i18n/context'
import { parseInlineHeight } from '../../../shared/model/docInline'

/**
 * Immagine o componente in linea con il testo: la casella e, accesa, l'altezza nella riga (in mm,
 * o in % di un'icona del testo; vuota per l'altezza di un'icona)
 */
export default function InlineField({
  inline,
  height,
  onInline,
  onHeight
}: {
  inline: boolean
  height: string
  onInline(on: boolean): void
  onHeight(text: string): void
}): React.JSX.Element {
  const { t } = useI18n()
  const bad = height.trim() !== '' && !parseInlineHeight(height)
  return (
    <div className="dialog-row inline-field">
      <label className="check" title={t('documents.inlineHint')}>
        <input type="checkbox" checked={inline} onChange={(e) => onInline(e.target.checked)} />
        {t('documents.inline')}
      </label>
      {inline && (
        <label title={t('documents.inlineHeightHint')}>
          {t('documents.inlineHeight')}
          <input
            className={bad ? 'num invalid' : 'num'}
            value={height}
            placeholder={t('documents.inlineHeightAuto')}
            onChange={(e) => onHeight(e.target.value)}
          />
        </label>
      )}
    </div>
  )
}
