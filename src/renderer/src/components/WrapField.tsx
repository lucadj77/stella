import { useI18n } from '../i18n/context'
import Segmented from './Segmented'

export type WrapSide = 'left' | 'right' | null

/**
 * Il testo che segue scorre accanto all'immagine, alla carta, all'anatomia, allo schema o al
 * riquadro: nessuno (il blocco prende la riga), con il blocco a sinistra o a destra.
 */
export default function WrapField({
  value,
  onChange
}: {
  value: WrapSide
  onChange(value: WrapSide): void
}): React.JSX.Element {
  const { t } = useI18n()
  return (
    <label title={t('documents.wrapHint')}>
      {t('documents.wrap')}
      <Segmented<'none' | 'left' | 'right'>
        value={value ?? 'none'}
        options={[
          ['none', t('documents.wrapNone')],
          ['left', t('documents.wrapLeft')],
          ['right', t('documents.wrapRight')]
        ]}
        onChange={(v) => onChange(v === 'none' ? null : v)}
      />
    </label>
  )
}
