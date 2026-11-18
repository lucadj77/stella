import { useI18n } from '../i18n/context'
import Segmented from './Segmented'
import type { ThumbBackground } from './thumbBackground'

/** Nessuno sfondo, chiaro o scuro per le miniature: vedi thumbBackground.ts */
export default function ThumbBackgroundSwitch({
  value,
  onChange
}: {
  value: ThumbBackground
  onChange(v: ThumbBackground): void
}): React.JSX.Element {
  const { t } = useI18n()
  return (
    <span className="thumb-bg" title={t('thumbBg.hint')}>
      <Segmented
        value={value}
        onChange={onChange}
        options={[
          ['none', t('thumbBg.none')],
          ['light', t('thumbBg.light')],
          ['dark', t('thumbBg.dark')]
        ]}
      />
    </span>
  )
}
