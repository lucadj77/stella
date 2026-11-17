import { useState } from 'react'
import NumInput from '../components/NumInput'
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

/**
 * I numeri letti sulla croce 1 si scrivono qui e Stella li somma allo spostamento che c'è:
 * chi stampa la prova non deve fare conti, nemmeno la seconda volta
 */
function ReadingForm({
  offsetX,
  offsetY,
  onCorrect
}: {
  offsetX: number
  offsetY: number
  onCorrect(dx: number, dy: number): void
}): React.JSX.Element {
  const { t, lang } = useI18n()
  const [x, setX] = useState('')
  const [y, setY] = useState('')
  const parse = (v: string): number => {
    const n = parseFloat(v.replace(',', '.').replace('−', '-'))
    return Number.isFinite(n) ? n : 0
  }
  const fmt = (n: number): string =>
    (Math.round(n * 100) / 100).toLocaleString(lang, { maximumFractionDigits: 2 })
  const ready = x.trim() !== '' || y.trim() !== ''
  return (
    <div className="offset-reading">
      <span className="offset-reading-label">{t('export.offsetHelpRead')}</span>
      <span className="export-pair">
        <span className="unit">x</span>
        <NumInput className="num" allowEmpty value={x} onChange={(e) => setX(e.target.value)} />
      </span>
      <span className="export-pair">
        <span className="unit">y</span>
        <NumInput className="num" allowEmpty value={y} onChange={(e) => setY(e.target.value)} />
        <span className="unit">mm</span>
      </span>
      <button
        className="primary"
        disabled={!ready}
        onClick={() => {
          onCorrect(parse(x), parse(y))
          setX('')
          setY('')
        }}
      >
        {t('export.offsetHelpApply')}
      </button>
      <span className="offset-reading-now">
        {t('export.offsetHelpNow', { x: fmt(offsetX), y: fmt(offsetY) })}
      </span>
    </div>
  )
}

/** I passi per misurare lo spostamento dei retri con la pagina di prova, da aprire */
export default function OffsetHelp({
  offsetX,
  offsetY,
  onCorrect
}: {
  /** Lo spostamento di ora, in mm */
  offsetX: number
  offsetY: number
  /** Somma ai retri la lettura della croce 1, in mm */
  onCorrect(dx: number, dy: number): void
}): React.JSX.Element {
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
            {i === 5 && <ReadingForm offsetX={offsetX} offsetY={offsetY} onCorrect={onCorrect} />}
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
