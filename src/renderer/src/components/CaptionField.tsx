import { useI18n } from '../i18n/context'
import Segmented from './Segmented'

/**
 * La didascalia di un'immagine, di una carta, di un'anatomia o di uno schema del tavolo, con il
 * posto dove si vede: sotto (di base) o sopra il disegno.
 */
export default function CaptionField({
  value,
  top,
  onChange,
  onTop
}: {
  value: string
  top: boolean
  onChange(value: string): void
  onTop(top: boolean): void
}): React.JSX.Element {
  const { t } = useI18n()
  return (
    <div className="dialog-row caption-field">
      <label className="grow">
        {t('documents.caption')}
        <input value={value} onChange={(e) => onChange(e.target.value)} />
      </label>
      <label title={t('documents.captionPositionHint')}>
        {t('documents.captionPosition')}
        <Segmented<'bottom' | 'top'>
          value={top ? 'top' : 'bottom'}
          options={[
            ['bottom', t('documents.captionBelow')],
            ['top', t('documents.captionAbove')]
          ]}
          onChange={(v) => onTop(v === 'top')}
        />
      </label>
    </div>
  )
}
