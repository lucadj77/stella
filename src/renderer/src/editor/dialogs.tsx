import { useState } from 'react'
import { guideSectionUrl, type GuideSection } from '../../../shared/donate'
import { KIND_PRESETS, type KindPreset } from '../../../shared/model/kinds'
import { COMPONENT_KINDS, type CardShape, type ComponentKind } from '../../../shared/model/template'
import type { MessageKey } from '../i18n/en'
import { isValidTemplateName } from '../../../shared/model/normalize'
import { useI18n } from '../i18n/context'
import { useLengthUnit } from '../units'
import { UNIT_LABEL, formatLength, fromUnit, toUnit } from '../../../shared/model/units'
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

export interface NewTemplate {
  name: string
  width: number
  height: number
  kind: ComponentKind
  shape?: CardShape
}

export function NewTemplateDialog({
  existing,
  onCreate,
  onClose
}: {
  existing: string[]
  onCreate(t: NewTemplate): void
  onClose(): void
}): React.JSX.Element {
  const { t, lang } = useI18n()
  const unit = useLengthUnit()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<ComponentKind>('card')
  // i campi sono nell'unità scelta, le misure del template in mm
  const [width, setWidth] = useState(() => String(toUnit(63, unit)))
  const [height, setHeight] = useState(() => String(toUnit(88, unit)))
  const [shape, setShape] = useState<CardShape | undefined>(undefined)
  const wu = Number(width.replace(',', '.'))
  const hu = Number(height.replace(',', '.'))
  const w = Math.round(fromUnit(wu, unit) * 100) / 100
  const h = Math.round(fromUnit(hu, unit) * 100) / 100
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
      setOther(String(Math.round(((v * other) / from) * 1000) / 1000))
  }
  const error = !name
    ? null
    : !isValidTemplateName(name)
      ? t('newTemplate.invalidName')
      : existing.includes(name)
        ? t('newTemplate.exists')
        : null
  const valid = name && !error && w >= 5 && h >= 5
  const presets = KIND_PRESETS[kind]
  const near = (a: number, b: number): boolean => Math.abs(a - b) < 0.05
  const preset =
    presets.find((p) => near(p.width, w) && near(p.height, h) && p.shape === shape)?.key ?? 'custom'
  const applyPreset = (p: KindPreset): void => {
    setWidth(String(toUnit(p.width, unit)))
    setHeight(String(toUnit(p.height, unit)))
    setShape(p.shape)
  }

  return (
    <Dialog title={t('newTemplate.title')} onClose={onClose} guide="template">
      <form
        className="dialog-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) onCreate({ name, width: w, height: h, kind, ...(shape ? { shape } : {}) })
        }}
      >
        <div className="kind-choice" role="radiogroup" aria-label={t('newTemplate.kind')}>
          <span className="kind-choice-label">{t('newTemplate.kind')}</span>
          <div className="kind-choice-buttons">
            {COMPONENT_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                className={kind === k ? 'active' : ''}
                title={t(`kind.${k}.hint`)}
                onClick={() => {
                  setKind(k)
                  applyPreset(KIND_PRESETS[k][0])
                }}
              >
                {t(`kind.${k}`)}
              </button>
            ))}
          </div>
          <p className="muted kind-choice-hint">{t(`kind.${kind}.hint`)}</p>
        </div>
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
              const p = presets.find((x) => x.key === e.target.value)
              if (p) applyPreset(p)
            }}
          >
            {presets.map((p) => (
              <option key={p.key} value={p.key}>
                {t(`format.${p.key}` as MessageKey)} · {toUnit(p.width, unit).toLocaleString(lang)}×
                {formatLength(p.height, unit, lang)}
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
                follow(e.target.value, wu, hu, setHeight)
              }}
            />{' '}
            {UNIT_LABEL[unit]}
          </label>
          <RatioLock locked={locked} onChange={setLocked} />
          <label>
            {t('prop.height')}
            <input
              className="num"
              value={height}
              onChange={(e) => {
                setHeight(e.target.value)
                follow(e.target.value, hu, wu, setWidth)
              }}
            />{' '}
            {UNIT_LABEL[unit]}
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
