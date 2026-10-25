import { useState } from 'react'
import { guideSectionUrl, type GuideSection } from '../../../shared/donate'
import { isValidTemplateName } from '../../../shared/model/normalize'
import { useI18n } from '../i18n/context'
import { RatioLock } from './fields'
import { useRatioLock } from './ratioLock'

export function Dialog({
  title,
  children,
  onClose,
  className,
  guide
}: {
  title: string
  children: React.ReactNode
  onClose(): void
  /** Classe in più per lo sfondo, per esempio per stare sopra le altre finestre */
  className?: string
  /** Sezione della guida aperta dal «?» accanto al titolo */
  guide?: GuideSection
}): React.JSX.Element {
  const { t, lang } = useI18n()
  return (
    <div
      className={'dialog-backdrop' + (className ? ' ' + className : '')}
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return
        // una finestra aperta sopra un'altra si chiude da sola
        e.stopPropagation()
        onClose()
      }}
    >
      <div className="dialog" role="dialog" aria-label={title}>
        <h2>
          {title}
          {guide && (
            <a
              className="dialog-guide"
              href={guideSectionUrl(guide, lang)}
              target="_blank"
              rel="noreferrer"
              title={t('dialog.guide')}
              aria-label={t('dialog.guide')}
            >
              ?
            </a>
          )}
        </h2>
        {children}
      </div>
    </div>
  )
}

/** Formati comuni in mm: vedi docs/specifica.md, sezione 8.1 */
const PRESETS: [string, number, number][] = [
  ['poker', 63, 88],
  ['bridge', 56, 87],
  ['miniEuro', 44, 68],
  ['miniUs', 41, 63],
  ['tarot', 70, 120],
  ['square', 70, 70],
  ['a6', 105, 148]
]

export function NewTemplateDialog({
  existing,
  onCreate,
  onClose
}: {
  existing: string[]
  onCreate(name: string, width: number, height: number): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [width, setWidth] = useState('63')
  const [height, setHeight] = useState('88')
  const w = Number(width.replace(',', '.'))
  const h = Number(height.replace(',', '.'))
  const [locked, setLocked] = useRatioLock('template')
  /** Con il lucchetto chiuso l'altra misura segue in proporzione */
  const follow = (
    text: string,
    from: number,
    other: number,
    setOther: (s: string) => void
  ): void => {
    const v = Number(text.replace(',', '.'))
    if (locked && v > 0 && from > 0 && other > 0)
      setOther(String(Math.round(((v * other) / from) * 100) / 100))
  }
  const error = !name
    ? null
    : !isValidTemplateName(name)
      ? t('newTemplate.invalidName')
      : existing.includes(name)
        ? t('newTemplate.exists')
        : null
  const valid = name && !error && w >= 5 && h >= 5
  const preset = PRESETS.find(([, pw, ph]) => pw === w && ph === h)?.[0] ?? 'custom'

  return (
    <Dialog title={t('newTemplate.title')} onClose={onClose} guide="template">
      <form
        className="dialog-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) onCreate(name, w, h)
        }}
      >
        <label>
          {t('prop.name')}
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        {error && <p className="field-error">{error}</p>}
        <label>
          {t('newTemplate.format')}
          <select
            value={preset}
            onChange={(e) => {
              const p = PRESETS.find(([k]) => k === e.target.value)
              if (p) {
                setWidth(String(p[1]))
                setHeight(String(p[2]))
              }
            }}
          >
            {PRESETS.map(([k, pw, ph]) => (
              <option key={k} value={k}>
                {t(`format.${k}` as Parameters<typeof t>[0])} · {pw}×{ph} mm
              </option>
            ))}
            <option value="custom">{t('format.custom')}</option>
          </select>
        </label>
        <div className="dialog-row">
          <label>
            {t('prop.width')}
            <input
              className="num"
              value={width}
              onChange={(e) => {
                setWidth(e.target.value)
                follow(e.target.value, w, h, setHeight)
              }}
            />{' '}
            mm
          </label>
          <RatioLock locked={locked} onChange={setLocked} />
          <label>
            {t('prop.height')}
            <input
              className="num"
              value={height}
              onChange={(e) => {
                setHeight(e.target.value)
                follow(e.target.value, h, w, setWidth)
              }}
            />{' '}
            mm
          </label>
        </div>
        <div className="dialog-buttons">
          <button type="button" onClick={onClose}>
            {t('dialog.cancel')}
          </button>
          <button type="submit" className="primary" disabled={!valid}>
            {t('newTemplate.create')}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

export function ResizeDialog({
  from,
  to,
  onChoose,
  onClose
}: {
  from: [number, number]
  to: [number, number]
  onChoose(mode: 'scale' | 'keep'): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  return (
    <Dialog title={t('resize.title')} onClose={onClose}>
      <p>
        {t('resize.question', {
          from: `${from[0]}×${from[1]}`,
          to: `${to[0]}×${to[1]}`
        })}
      </p>
      <div className="dialog-buttons">
        <button onClick={onClose}>{t('dialog.cancel')}</button>
        <button onClick={() => onChoose('keep')} title={t('tip.resizeKeep')}>
          {t('resize.keep')}
        </button>
        {/* niente autoFocus: l'Invio che ha confermato il campo premerebbe il pulsante */}
        <button className="primary" onClick={() => onChoose('scale')} title={t('tip.resizeScale')}>
          {t('resize.scale')}
        </button>
      </div>
    </Dialog>
  )
}
