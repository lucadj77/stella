import { useI18n } from '../i18n/context'
import type { MessageKey } from '../i18n/en'

/** Un righello come quelli della pagina di prova, con la linea della croce vista controluce */
function RulerExample(): React.JSX.Element {
  const { t } = useI18n()
  // 1 mm = 18 px; il righello va da −5 a 5 come sulla pagina di prova
  const u = 18
  const cx = 120
  const y = 34
  const ticks: React.JSX.Element[] = []
  for (let k = -10; k <= 10; k++) {
    const d = k / 2
    const long = k === 0 ? 14 : k % 2 === 0 ? 9 : 5
    ticks.push(
      <line key={k} x1={cx + d * u} y1={y} x2={cx + d * u} y2={y + long} className="ruler-ink" />
    )
    if (k % 4 === 0)
      ticks.push(
        <text key={`n${k}`} x={cx + d * u} y={y + 28} textAnchor="middle" className="ruler-num">
          {d < 0 ? `−${-d}` : d}
        </text>
      )
  }
  const at = cx + 1.5 * u
  return (
    <figure className="offset-example">
      <svg
        viewBox="0 0 240 72"
        width="240"
        height="72"
        role="img"
        aria-label={t('export.offsetHelpExample')}
      >
        <line x1={cx - 5 * u} y1={y} x2={cx + 5 * u} y2={y} className="ruler-ink" />
        {ticks}
        <text x={cx - 5 * u - 12} y={y + 6} className="ruler-num">
          x
        </text>
        {/* la linea verticale della croce del fronte, che si vede attraverso la carta */}
        <line x1={at} y1={2} x2={at} y2={y + 18} className="ruler-cross" />
      </svg>
      <figcaption>{t('export.offsetHelpExample')}</figcaption>
    </figure>
  )
}

/** I passi per misurare lo spostamento dei retri con la pagina di prova, da aprire */
export default function OffsetHelp(): React.JSX.Element {
  const { t } = useI18n()
  const steps = [1, 2, 3, 4, 5, 6, 7].map((n) => t(`export.offsetHelp${n}` as MessageKey))
  return (
    <details className="offset-help">
      <summary>{t('export.offsetHelp')}</summary>
      <ol>
        {steps.map((s, i) => (
          <li key={i}>
            {s}
            {i === 4 && <RulerExample />}
          </li>
        ))}
      </ol>
      <p className="offset-help-title">{t('export.offsetHelpTrouble')}</p>
      <ul>
        <li>{t('export.offsetHelpScale')}</li>
        <li>{t('export.offsetHelpFlip')}</li>
        <li>{t('export.offsetHelpSame')}</li>
      </ul>
    </details>
  )
}
