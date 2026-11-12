import { useState } from 'react'
import type { GuideSection } from '../../../shared/donate'
import { guideSectionLink } from '../guideLinks'
import { KIND_PRESETS, type KindPreset } from '../../../shared/model/kinds'
import {
  DIE_TYPES,
  dieHeight,
  diePresets,
  dieRatio,
  type DieType
} from '../../../shared/model/dice'
import { COMPONENT_KINDS, type CardShape, type ComponentKind } from '../../../shared/model/template'
import type { MessageKey } from '../i18n/en'
import { isValidTemplateName } from '../../../shared/model/normalize'
import { useI18n } from '../i18n/context'
import { useLengthUnit } from '../units'
import { UNIT_LABEL, formatLength, fromUnit, toUnit } from '../../../shared/model/units'
import { RatioLock } from './fields'
import { DieIcon, KindIcon } from '../export/exportIcons'
import { useRatioLock } from './ratioLock'
import { STARTERS, starterLayers, type StarterKey } from '../../../shared/model/starters'

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
              href={guideSectionLink(guide, lang)}
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
  /** Tipo di dado, per le facce di dado */
  die?: DieType
  /** Disposizione di partenza scelta dall'utente; senza, il template nasce vuoto */
  starter?: StarterKey
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
  const [die, setDie] = useState<DieType>('d6')
  // si parte sempre da vuoto: una disposizione si usa solo se la si sceglie
  const [starter, setStarter] = useState<StarterKey | null>(null)
  const starters = STARTERS[kind]
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
  const presets = kind === 'die' ? diePresets(die) : KIND_PRESETS[kind]
  // triangoli, pentagoni e quadrati hanno la proporzione fissa: l'altezza segue la larghezza
  const fixed = kind === 'die' ? dieRatio(die) : null
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
          if (!valid) return
          if (kind === 'die') onCreate({ name, width: w, height: dieHeight(die, w, h), kind, die })
          else
            onCreate({
              name,
              width: w,
              height: h,
              kind,
              ...(shape ? { shape } : {}),
              ...(starter ? { starter } : {})
            })
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
                  setStarter(null)
                  applyPreset(k === 'die' ? diePresets(die)[0] : KIND_PRESETS[k][0])
                }}
              >
                <KindIcon kind={k} size={22} />
                {t(`kind.${k}`)}
              </button>
            ))}
          </div>
          <p className="muted kind-choice-hint">{t(`kind.${kind}.hint`)}</p>
        </div>
        {kind === 'die' && (
          <div className="kind-choice die-choice" role="radiogroup" aria-label={t('prop.die')}>
            <span className="kind-choice-label">{t('prop.die')}</span>
            <div className="kind-choice-buttons">
              {DIE_TYPES.map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={die === d}
                  className={die === d ? 'active' : ''}
                  title={t(`die.${d}.hint`)}
                  onClick={() => {
                    setDie(d)
                    applyPreset(diePresets(d)[0])
                  }}
                >
                  <DieIcon die={d} size={22} />
                  <span className="die-choice-name">{d}</span>
                  <span className="die-choice-faces">{t(`die.${d}.faces`)}</span>
                </button>
              ))}
            </div>
            <p className="muted kind-choice-hint">{t(`die.${die}.hint`)}</p>
          </div>
        )}
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
                const v = Number(e.target.value.replace(',', '.'))
                if (fixed !== null) {
                  if (v > 0) setHeight(String(toUnit(dieHeight(die, fromUnit(v, unit), 0), unit)))
                } else follow(e.target.value, wu, hu, setHeight)
              }}
            />{' '}
            {UNIT_LABEL[unit]}
          </label>
          <RatioLock
            locked={fixed !== null || locked}
            onChange={(v) => fixed === null && setLocked(v)}
          />
          <label>
            {t('prop.height')}
            <input
              className="num"
              readOnly={fixed !== null}
              title={fixed !== null ? t('die.fixedRatio') : undefined}
              value={height}
              onChange={(e) => {
                setHeight(e.target.value)
                follow(e.target.value, hu, wu, setWidth)
              }}
            />{' '}
            {UNIT_LABEL[unit]}
          </label>
        </div>
        {starters.length > 0 && (
          <div
            className="kind-choice starter-choice"
            role="radiogroup"
            aria-label={t('starter.label')}
          >
            <span className="kind-choice-label">{t('starter.label')}</span>
            <div className="kind-choice-buttons">
              {[null, ...starters].map((k) => (
                <button
                  key={k ?? 'empty'}
                  type="button"
                  role="radio"
                  aria-checked={starter === k}
                  className={starter === k ? 'active' : ''}
                  onClick={() => setStarter(k)}
                >
                  <StarterThumb starter={k} w={w} h={h} shape={shape} />
                  {t(k ? (`starter.${k}` as MessageKey) : 'starter.empty')}
                </button>
              ))}
            </div>
          </div>
        )}
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

/** Miniatura di una disposizione di partenza, disegnata dai suoi livelli: sempre come sarà */
function StarterThumb({
  starter,
  w,
  h,
  shape
}: {
  starter: StarterKey | null
  w: number
  h: number
  shape?: CardShape
}): React.JSX.Element {
  const W = w >= 5 ? w : 63
  const H = h >= 5 ? h : 88
  // dentro un quadrato di 56 px, con le proporzioni del componente
  const k = 56 / Math.max(W, H)
  const layers = starter ? starterLayers(starter, W, H, 3, 3, { title: '', text: '' }, shape) : []
  const outline =
    shape === 'ellipse' ? (
      <ellipse cx={W / 2} cy={H / 2} rx={W / 2} ry={H / 2} />
    ) : shape === 'hexagon' ? (
      <polygon
        points={`${W * 0.25},0 ${W * 0.75},0 ${W},${H / 2} ${W * 0.75},${H} ${W * 0.25},${H} 0,${H / 2}`}
      />
    ) : (
      <rect width={W} height={H} rx={Math.min(W, H) * 0.05} />
    )
  return (
    <svg
      className="starter-thumb"
      width={Math.round(W * k)}
      height={Math.round(H * k)}
      viewBox={`0 0 ${W} ${H}`}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={`starter-${starter ?? 'empty'}`}>{outline}</clipPath>
      </defs>
      <g className="starter-thumb-paper">{outline}</g>
      <g clipPath={`url(#starter-${starter ?? 'empty'})`}>
        {layers
          .slice()
          .reverse()
          .map((l, i) => {
            const [x, y, lw, lh] = [l.x, l.y, l.w, l.h] as number[]
            if (l.type === 'image')
              return (
                <rect key={i} className="starter-thumb-art" x={x} y={y} width={lw} height={lh} />
              )
            // un testo: una riga spessa per il titolo, righe sottili per il corpo
            const line = Math.min(lh * 0.5, Math.max(W, H) * 0.05)
            const rows = l.name === 'text' ? Math.max(1, Math.floor(lh / (line * 2.2))) : 1
            const thick = l.name === 'text' ? line * 0.6 : line * 1.4
            return (
              <g key={i} className="starter-thumb-text">
                {Array.from({ length: Math.min(rows, 6) }, (_, j) => {
                  const lw2 =
                    l.align === 'center' || rows === 1 ? lw * 0.6 : j % 3 === 2 ? lw * 0.6 : lw
                  const lx = l.align === 'center' || rows === 1 ? x + (lw - lw2) / 2 : x
                  const ly = rows === 1 ? y + (lh - thick) / 2 : y + j * line * 2.2
                  return <rect key={j} x={lx} y={ly} width={lw2} height={thick} rx={thick / 2} />
                })}
              </g>
            )
          })}
      </g>
    </svg>
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
