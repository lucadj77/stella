import type { MessageKey } from '../i18n/en'
import HelpTip from '../components/HelpTip'
import { useContext, useId, useMemo, useState } from 'react'
import { smoothCss } from '../render/smoothGradient'
import { palette, resolveFont } from '../../../shared/model/variables'
import { VariablesContext } from '../render/assets'
import { ColorFieldsContext } from './colorFields'
import type { Fade, Shadow, Stroke } from '../../../shared/model/template'
import {
  isGradient,
  parseGradient,
  serializeGradient,
  type Gradient
} from '../../../shared/model/gradient'
import { useI18n } from '../i18n/context'
import MarkupTextarea from '../components/MarkupTextarea'
import { APP_FONTS, useProjectFonts } from '../render/fonts'
import FontPicker from '../components/FontPicker'
import { ColorSwatch } from '../components/ColorPicker'

// Campi del pannello proprietà. Ogni modifica si applica subito, mentre si scrive: cambiare
// selezione o fare clic sulla carta non la perde. Annulla (⌘Z) torna indietro.

interface Base {
  label: string
  /** Suggerimento al passaggio del mouse: di solito la colonna del foglio */
  hint?: string
  /** Spiegazione di un campo tecnico, dietro un «?» accanto al controllo */
  help?: string
  disabled?: boolean
}

export function Row({
  label,
  hint,
  help,
  disabled,
  labelProps,
  children
}: Base & {
  children: React.ReactNode
  /** Per esempio il trascinamento dell'etichetta nei campi numerici */
  labelProps?: React.HTMLAttributes<HTMLSpanElement>
}): React.JSX.Element {
  return (
    // un div e non un label: con più controlli il clic sull'etichetta attiverebbe il primo
    <div className={disabled ? 'field disabled' : 'field'} title={hint}>
      <span className="field-label" {...labelProps}>
        {label}
      </span>
      <span className="field-control">
        {children}
        {help && <HelpTip text={help} />}
      </span>
    </div>
  )
}

/**
 * Testo del campo mentre lo si modifica. Finché il campo ha il fuoco mostra ciò che si è
 * scritto (anche "1," a metà di un numero); `apply` riceve ogni versione valida.
 */
function useLive(
  value: string,
  apply: (text: string) => void,
  valid: (text: string) => boolean = () => true,
  /** Applica solo uscendo dal campo: per i valori che aprono una richiesta, come il formato */
  deferred = false
): {
  text: string
  set(text: string): void
  bind: {
    value: string
    onFocus(): void
    onBlur(): void
    onChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void
  }
} {
  const [editing, setEditing] = useState<string | null>(null)
  const text = editing ?? value
  const set = (t: string): void => {
    setEditing(t)
    if (!deferred && valid(t)) apply(t)
  }
  return {
    text,
    set,
    bind: {
      value: text,
      onFocus: () => setEditing(value),
      onBlur: () => {
        if (deferred && editing !== null && valid(editing)) apply(editing)
        setEditing(null)
      },
      onChange: (e) => set(e.target.value)
    }
  }
}

function parseNumber(s: string): number | null {
  const n = Number(s.trim().replace(',', '.'))
  return s.trim() !== '' && Number.isFinite(n) ? n : null
}

const round = (n: number): number => Math.round(n * 1000) / 1000

/** Invio conferma uscendo dal campo, come nei programmi di grafica */
const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>): void => {
  if (e.key === 'Enter') e.currentTarget.blur()
}

export function NumberField({
  label,
  hint,
  help,
  disabled,
  value,
  onChange,
  step = 0.5,
  min,
  max,
  unit,
  factor = 1,
  deferred
}: Base & {
  value: number
  deferred?: boolean
  onChange(v: number): void
  step?: number
  min?: number
  max?: number
  unit?: string
  /** Moltiplicatore per la visualizzazione, per esempio 100 per le percentuali */
  factor?: number
}): React.JSX.Element {
  const clamp = (n: number): number => {
    let v = n / factor
    if (min !== undefined) v = Math.max(min, v)
    if (max !== undefined) v = Math.min(max, v)
    return v
  }
  const live = useLive(
    String(round(value * factor)),
    (text) => {
      const v = clamp(parseNumber(text)!)
      if (v !== value) onChange(v)
    },
    (text) => parseNumber(text) !== null,
    deferred
  )
  const { t } = useI18n()
  /** Valore mostrato (moltiplicato per factor) applicato al modello */
  const applyShown = (shown: number): void => {
    const v = clamp(round(shown))
    if (v !== value) onChange(v)
  }
  // trascinando l'etichetta a destra o a sinistra il valore cresce o cala come con un cursore:
  // un passo ogni 4 pixel, Maiusc per passi da 10, Alt per decimi di passo
  const scrub = (e: React.PointerEvent<HTMLSpanElement>): void => {
    if (disabled || deferred || e.button !== 0) return
    e.preventDefault()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const startX = e.clientX
    const start = value * factor
    // il passo si arrotonda al suo ordine di grandezza, così i valori restano puliti
    const move = (ev: PointerEvent): void => {
      const k = ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1
      const steps = Math.round((ev.clientX - startX) / 4)
      const s = step * k
      applyShown(Math.round((start + steps * s) / s) * s)
    }
    const up = (): void => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }
  const bounded = min !== undefined && max !== undefined && !deferred
  return (
    <Row
      label={label}
      hint={hint}
      help={help}
      disabled={disabled}
      labelProps={
        disabled || deferred
          ? undefined
          : { className: 'field-label scrub', onPointerDown: scrub, title: t('field.scrubHint') }
      }
    >
      {bounded && (
        <input
          type="range"
          className="num-slider"
          disabled={disabled}
          min={min * factor}
          max={max * factor}
          step={step}
          value={round(value * factor)}
          onChange={(e) => applyShown(Number(e.target.value))}
        />
      )}
      <input
        className="num"
        disabled={disabled}
        {...live.bind}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            const s = step * (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1)
            live.set(String(round((parseNumber(live.text) ?? value * factor) + s)))
          } else blurOnEnter(e)
        }}
      />
      {unit && <span className="unit">{unit}</span>}
    </Row>
  )
}

export function TextField({
  label,
  hint,
  disabled,
  value,
  onChange,
  multiline,
  rows = 4,
  list,
  validate,
  placeholder,
  markupFields,
  action
}: Base & {
  value: string
  onChange(v: string): void
  multiline?: boolean
  /** Testo con markup: aiuto alla scrittura con questi campi */
  markupFields?: string[]
  rows?: number
  list?: string
  /** Messaggio di errore, oppure null se il valore va bene: un valore non valido non si applica */
  validate?(v: string): string | null
  placeholder?: string
  /** Pulsante accanto al campo, per esempio per scegliere un file */
  action?: React.ReactNode
}): React.JSX.Element {
  const live = useLive(
    value,
    (t) => t !== value && onChange(t),
    (t) => !validate || validate(t) === null
  )
  const error = validate && live.text !== value ? validate(live.text) : null
  const common = {
    ...live.bind,
    placeholder,
    disabled,
    className: error ? 'invalid' : undefined
  }
  return (
    <Row label={label} hint={error ?? hint} disabled={disabled}>
      {multiline && markupFields ? (
        <MarkupTextarea {...common} rows={rows} fields={markupFields} />
      ) : multiline ? (
        <textarea {...common} rows={rows} />
      ) : (
        <input {...common} list={list} onKeyDown={blurOnEnter} />
      )}
      {action}
      {error && <span className="field-error">{error}</span>}
    </Row>
  )
}

/** Famiglia di font: propone quelle del progetto e avvisa se il font non c'è */
export function FontField({
  label,
  hint,
  value,
  placeholder,
  onChange
}: Base & { value: string; placeholder?: string; onChange(v: string): void }): React.JSX.Element {
  const { t } = useI18n()
  const fonts = useProjectFonts()
  const listId = useId()
  const [picking, setPicking] = useState(false)
  const variables = useContext(VariablesContext)
  const families = [...new Set([...fonts.families, ...APP_FONTS])]
  // le variabili di testo si propongono come {nome}: cambiandole cambia il font di tutti i livelli
  const textVars = Object.entries(variables ?? {})
    .filter(([, v]) => v.type === 'text')
    .map(([name]) => `{${name}}`)
  const resolved = resolveFont(value, variables)
  return (
    <>
      <TextField
        label={label}
        hint={hint}
        value={value}
        list={listId}
        placeholder={placeholder}
        onChange={onChange}
        action={
          <button
            className="pick-btn"
            title={t('fonts.openPicker')}
            onClick={() => setPicking(true)}
          >
            Aa
          </button>
        }
      />
      {picking && <FontPicker value={value} onPick={onChange} onClose={() => setPicking(false)} />}
      <datalist id={listId}>
        {[...textVars, ...families].map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>
      {resolved !== value && (
        <p className="field-note">{t('editor.fontFromVariable', { font: resolved })}</p>
      )}
      {resolved.trim() && !/^\{.*\}$/.test(resolved.trim()) && !fonts.has(resolved) && (
        <p className="field-note">{t('editor.fontMissing')}</p>
      )}
    </>
  )
}

export function SelectField<T extends string | number>({
  label,
  hint,
  help,
  disabled,
  value,
  options,
  onChange
}: Base & {
  value: T
  options: [T, string][]
  onChange(v: T): void
}): React.JSX.Element {
  return (
    <Row label={label} hint={hint} help={help} disabled={disabled}>
      <select
        value={String(value)}
        disabled={disabled}
        onChange={(e) => {
          const found = options.find(([v]) => String(v) === e.target.value)
          if (found) onChange(found[0])
        }}
      >
        {options.map(([v, text]) => (
          <option key={String(v)} value={String(v)}>
            {text}
          </option>
        ))}
      </select>
    </Row>
  )
}

export function CheckField({
  label,
  hint,
  disabled,
  value,
  onChange
}: Base & { value: boolean; onChange(v: boolean): void }): React.JSX.Element {
  return (
    <Row label={label} hint={hint} disabled={disabled}>
      <input
        type="checkbox"
        checked={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </Row>
  )
}

/** Codice esadecimale completo, nome di colore o colore del progetto: le versioni a metà non si applicano */
const isColor = (t: string): boolean =>
  /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(t.trim()) ||
  /^\{?[\p{L}_][\p{L}\p{N}_-]*\}?$/u.test(t.trim())

function ColorInput({
  value,
  onChange,
  disabled
}: {
  value: string
  onChange(v: string): void
  disabled?: boolean
}): React.JSX.Element {
  const live = useLive(value, (t) => t.trim() !== value && onChange(t.trim()), isColor)
  // i colori del progetto si scrivono per nome: il campione mostra il colore che indicano
  const variables = useContext(VariablesContext)
  const pal = useMemo(() => palette(variables), [variables])
  const listId = useId()
  const fields = useContext(ColorFieldsContext)
  return (
    <>
      <ColorSwatch value={value} disabled={disabled} onChange={onChange} />
      <input
        className="color-text"
        disabled={disabled}
        list={listId}
        {...live.bind}
        onKeyDown={blurOnEnter}
      />
      <datalist id={listId}>
        {Object.keys(pal).map((n) => (
          <option key={n} value={n} />
        ))}
        {fields.map((n) => (
          <option key={`{${n}}`} value={`{${n}}`} />
        ))}
      </datalist>
    </>
  )
}

export function ColorField({
  label,
  hint,
  disabled,
  value,
  onChange,
  nullable,
  fallback = '#000000'
}: Base & {
  value: string | null
  onChange(v: string | null): void
  nullable?: boolean
  /** Colore proposto quando si riattiva un colore assente */
  fallback?: string
}): React.JSX.Element {
  const { t } = useI18n()
  return (
    <Row label={label} hint={hint} disabled={disabled}>
      {nullable && (
        <input
          type="checkbox"
          checked={value !== null}
          disabled={disabled}
          title={t('field.enabled')}
          onChange={(e) => onChange(e.target.checked ? fallback : null)}
        />
      )}
      {value !== null ? (
        <ColorInput value={value} onChange={onChange} disabled={disabled} />
      ) : (
        <span className="muted">{t('field.none')}</span>
      )}
    </Row>
  )
}

export function StrokeField({
  label,
  hint,
  value,
  onChange,
  allowPercent,
  dashable
}: Base & {
  value: Stroke | null
  onChange(v: Stroke | null): void
  /** Il testo accetta lo spessore in % della dimensione */
  allowPercent?: boolean
  /** Linea continua, tratteggiata o a punti (non per il contorno del testo) */
  dashable?: boolean
}): React.JSX.Element {
  const { t } = useI18n()
  const isPercent = (s: string): boolean => !!allowPercent && /^\d+([.,]\d+)?%$/.test(s.trim())
  const width = useLive(
    String(value?.width ?? ''),
    (s) => {
      if (!value) return
      const w = isPercent(s) ? s.trim().replace(',', '.') : parseNumber(s)!
      if (w !== value.width) onChange({ ...value, width: w })
    },
    (s) => isPercent(s) || (parseNumber(s) ?? -1) >= 0
  )
  return (
    <Row label={label} hint={hint}>
      <input
        type="checkbox"
        checked={value !== null}
        title={t('field.enabled')}
        onChange={(e) => onChange(e.target.checked ? { color: '#000000', width: 0.3 } : null)}
      />
      {value ? (
        <>
          <ColorInput value={value.color} onChange={(color) => onChange({ ...value, color })} />
          <input
            className="num narrow"
            title={allowPercent ? t('field.strokeWidthPercent') : t('field.strokeWidth')}
            {...width.bind}
            onKeyDown={blurOnEnter}
          />
          {dashable && (
            <select
              className="narrow-select"
              title={t('field.dash')}
              value={value.dash ?? 'solid'}
              onChange={(e) => {
                const { dash: _old, ...rest } = value
                void _old
                const d = e.target.value
                onChange(d === 'dashed' || d === 'dotted' ? { ...rest, dash: d } : rest)
              }}
            >
              <option value="solid">{t('dash.solid')}</option>
              <option value="dashed">{t('dash.dashed')}</option>
              <option value="dotted">{t('dash.dotted')}</option>
            </select>
          )}
        </>
      ) : (
        <span className="muted">{t('field.none')}</span>
      )}
    </Row>
  )
}

export function ShadowFields({
  value,
  onChange,
  hint
}: {
  value: Shadow | null
  onChange(v: Shadow | null): void
  hint?: string
}): React.JSX.Element {
  const { t } = useI18n()
  return (
    <>
      <ColorField
        label={t('prop.shadow')}
        hint={hint}
        value={value?.color ?? null}
        nullable
        fallback="#00000080"
        onChange={(color) =>
          onChange(color === null ? null : { blur: 0.5, dx: 0.3, dy: 0.3, ...value, color })
        }
      />
      {value && (
        <div className="field-group">
          <NumberField
            label={t('prop.shadowBlur')}
            value={value.blur}
            min={0}
            step={0.1}
            unit="mm"
            onChange={(blur) => onChange({ ...value, blur })}
          />
          <NumberField
            label={t('prop.shadowDx')}
            value={value.dx}
            step={0.1}
            unit="mm"
            onChange={(dx) => onChange({ ...value, dx })}
          />
          <NumberField
            label={t('prop.shadowDy')}
            value={value.dy}
            step={0.1}
            unit="mm"
            onChange={(dy) => onChange({ ...value, dy })}
          />
        </div>
      )}
    </>
  )
}

/** Lucchetto classico tra larghezza e altezza: chiuso, le due misure cambiano in proporzione */
export function RatioLock({
  locked,
  onChange
}: {
  locked: boolean
  onChange(locked: boolean): void
}): React.JSX.Element {
  const { t } = useI18n()
  return (
    <button
      type="button"
      className={locked ? 'ratio-lock on' : 'ratio-lock'}
      aria-pressed={locked}
      title={locked ? t('tip.ratioLocked') : t('tip.ratioUnlocked')}
      onClick={() => onChange(!locked)}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
        <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
        <path
          d={locked ? 'M5.5 7V5a2.5 2.5 0 0 1 5 0v2' : 'M5.5 7V5a2.5 2.5 0 0 1 5 0'}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          transform={locked ? undefined : 'translate(2.5 -1.5)'}
        />
      </svg>
    </button>
  )
}

/**
 * Larghezza e altezza con il lucchetto: `row` le mette affiancate (geometria dei livelli),
 * `column` una sotto l'altra con il lucchetto a destra (formato del template).
 */
export function SizeFields({
  labels,
  hints,
  w,
  h,
  min,
  unit,
  deferred,
  layout = 'row',
  locked,
  onLock,
  onChange
}: {
  labels: [string, string]
  hints?: [string, string]
  w: number
  h: number
  min?: number
  unit?: string
  deferred?: boolean
  layout?: 'row' | 'column'
  locked: boolean
  onLock(locked: boolean): void
  onChange(w: number, h: number): void
}): React.JSX.Element {
  // l'altra misura non si limita al minimo: cambierebbe le proporzioni
  const other = (size: number, from: number, to: number): number =>
    from > 0 ? round((size * to) / from) : to
  return (
    <div className={`size-fields ${layout}`}>
      <NumberField
        label={labels[0]}
        hint={hints?.[0]}
        value={w}
        min={min}
        unit={unit}
        deferred={deferred}
        onChange={(v) => onChange(v, locked ? other(v, w, h) : h)}
      />
      <RatioLock locked={locked} onChange={onLock} />
      <NumberField
        label={labels[1]}
        hint={hints?.[1]}
        value={h}
        min={min}
        unit={unit}
        deferred={deferred}
        onChange={(v) => onChange(locked ? other(v, h, w) : w, v)}
      />
    </div>
  )
}

/**
 * Riempimento di una forma: nessuno, un colore o una sfumatura. La sfumatura ha tipo, angolo
 * (lineare) e almeno due colori, ciascuno con la sua posizione.
 */
export function FillField({
  label,
  hint,
  value,
  fallback,
  onChange
}: Base & {
  value: string | null
  fallback: string
  onChange(v: string | null): void
}): React.JSX.Element {
  const { t } = useI18n()
  const g = isGradient(value) ? parseGradient(value) : null
  const mode = value === null ? 'none' : g ? 'gradient' : 'color'
  const setG = (next: Gradient): void => onChange(serializeGradient(next))
  return (
    <>
      <Row label={label} hint={hint}>
        <select
          value={mode}
          onChange={(e) => {
            const m = e.target.value
            if (m === 'none') onChange(null)
            else if (m === 'color') onChange(g ? g.stops[0].color : fallback)
            else
              setG({
                kind: 'linear',
                angle: 180,
                stops: [
                  { color: value ?? fallback, at: 0 },
                  { color: '#FFFFFF', at: 1 }
                ]
              })
          }}
        >
          <option value="none">{t('fill.none')}</option>
          <option value="color">{t('fill.color')}</option>
          <option value="gradient">{t('fill.gradient')}</option>
        </select>
        {mode === 'color' && value !== null && <ColorInput value={value} onChange={onChange} />}
      </Row>
      {g && (
        <div className="gradient-field">
          <div
            className="gradient-preview"
            style={{ background: smoothCss(g.kind, g.angle, g.stops) }}
          />
          <Row label={t('fill.kind')}>
            <select
              value={g.kind}
              onChange={(e) => setG({ ...g, kind: e.target.value as Gradient['kind'] })}
            >
              <option value="linear">{t('fill.linear')}</option>
              <option value="radial">{t('fill.radial')}</option>
            </select>
            {g.kind === 'linear' && (
              <>
                <input
                  className="num narrow"
                  type="number"
                  step={15}
                  title={t('fill.angle')}
                  value={g.angle}
                  onChange={(e) => {
                    const a = parseNumber(e.target.value)
                    if (a !== null) setG({ ...g, angle: a })
                  }}
                />
                <span className="unit">°</span>
              </>
            )}
          </Row>
          {g.stops.map((s, i) => (
            <Row key={i} label={t('fill.stop', { n: i + 1 })}>
              <ColorInput
                value={s.color}
                onChange={(color) =>
                  setG({ ...g, stops: g.stops.map((x, k) => (k === i ? { ...x, color } : x)) })
                }
              />
              <input
                className="num narrow"
                type="number"
                min={0}
                max={100}
                title={t('fill.position')}
                value={Math.round(s.at * 100)}
                onChange={(e) => {
                  const p = parseNumber(e.target.value)
                  if (p === null) return
                  const at = Math.max(0, Math.min(1, p / 100))
                  setG({ ...g, stops: g.stops.map((x, k) => (k === i ? { ...x, at } : x)) })
                }}
              />
              <span className="unit">%</span>
              {g.stops.length > 2 && (
                <button
                  type="button"
                  className="icon-btn"
                  title={t('fill.removeStop')}
                  onClick={() => setG({ ...g, stops: g.stops.filter((_, k) => k !== i) })}
                >
                  ×
                </button>
              )}
            </Row>
          ))}
          <button
            type="button"
            className="small-btn"
            onClick={() => {
              // il nuovo colore va a metà tra gli ultimi due
              const a = g.stops[g.stops.length - 2]
              const b = g.stops[g.stops.length - 1]
              const stops = [...g.stops]
              stops.splice(stops.length - 1, 0, { color: b.color, at: (a.at + b.at) / 2 })
              setG({ ...g, stops })
            }}
          >
            {t('fill.addStop')}
          </button>
        </div>
      )}
    </>
  )
}

/** Dissolvenza dell'opacità del livello */
type FadeDirection = 'down' | 'up' | 'right' | 'left' | 'angle' | 'out' | 'in'

const FADE_ANGLES: Partial<Record<FadeDirection, number>> = {
  down: 180,
  up: 0,
  right: 90,
  left: 270
}

/** Direzione della dissolvenza come la si sceglie nel pannello */
function fadeDirection(f: Fade): FadeDirection {
  if (f.kind === 'radial') return f.from >= f.to ? 'out' : 'in'
  const d = (Object.keys(FADE_ANGLES) as FadeDirection[]).find(
    (k) => FADE_ANGLES[k] === ((f.angle % 360) + 360) % 360
  )
  return d ?? 'angle'
}

/**
 * Dissolvenza: il livello diventa trasparente in una direzione. Si scelgono la direzione, dove
 * comincia e dove finisce la dissolvenza, e quanto resta visibile alla fine.
 */
export function FadeFields({
  value,
  onChange,
  hint
}: {
  value: Fade | null
  onChange(v: Fade | null): void
  hint?: string
}): React.JSX.Element {
  const { t } = useI18n()
  const pct = (v: number): number => Math.round(v * 100)
  const dir = value ? fadeDirection(value) : 'down'
  // il lato trasparente: 'to' per tutte le direzioni tranne "dai bordi verso il centro"
  const faint = value ? (dir === 'in' ? value.from : value.to) : 0
  const setDir = (d: FadeDirection): void => {
    if (!value) return
    if (d === 'out') onChange({ ...value, kind: 'radial', from: 1, to: faint })
    else if (d === 'in') onChange({ ...value, kind: 'radial', from: faint, to: 1 })
    else
      onChange({
        ...value,
        kind: 'linear',
        angle: FADE_ANGLES[d] ?? value.angle,
        from: 1,
        to: faint
      })
  }
  const setFaint = (v: number): void => {
    if (!value) return
    onChange(dir === 'in' ? { ...value, from: v } : { ...value, to: v })
  }
  const slider = (label: MessageKey, v: number, set: (n: number) => void): React.JSX.Element => (
    <Row label={t(label)}>
      <span className="slider-row">
        <input
          type="range"
          min={0}
          max={100}
          value={pct(v)}
          onChange={(e) => set(Number(e.target.value) / 100)}
        />
        <input
          className="num narrow"
          type="number"
          min={0}
          max={100}
          value={pct(v)}
          onChange={(e) => {
            const n = parseNumber(e.target.value)
            if (n !== null) set(Math.max(0, Math.min(1, n / 100)))
          }}
        />
        <span className="unit">%</span>
      </span>
    </Row>
  )
  const a = value ? pct(value.from) / 100 : 1
  const b = value ? pct(value.to) / 100 : 0
  return (
    <>
      <Row label={t('prop.fade')} hint={hint}>
        <input
          type="checkbox"
          checked={value !== null}
          title={t('field.enabled')}
          onChange={(e) =>
            onChange(
              e.target.checked
                ? { kind: 'linear', angle: 180, from: 1, to: 0, start: 0.5, end: 1 }
                : null
            )
          }
        />
        {value ? (
          <select value={dir} onChange={(e) => setDir(e.target.value as FadeDirection)}>
            {(['down', 'up', 'right', 'left', 'out', 'in', 'angle'] as const).map((d) => (
              <option key={d} value={d}>
                {t(`fade.dir.${d}` as MessageKey)}
              </option>
            ))}
          </select>
        ) : (
          <span className="muted">{t('field.none')}</span>
        )}
      </Row>
      {value && (
        <div className="field-group">
          {dir === 'angle' && (
            <Row label={t('fill.angle')}>
              <input
                className="num narrow"
                type="number"
                step={15}
                value={value.angle}
                onChange={(e) => {
                  const n = parseNumber(e.target.value)
                  if (n !== null) onChange({ ...value, angle: n })
                }}
              />
              <span className="unit">°</span>
            </Row>
          )}
          {slider('fade.start', value.start, (start) =>
            onChange({ ...value, start: Math.min(start, value.end) })
          )}
          {slider('fade.end', value.end, (end) =>
            onChange({ ...value, end: Math.max(end, value.start) })
          )}
          {slider('fade.faint', faint, setFaint)}
          <div
            className="fade-preview"
            title={t('fade.preview')}
            style={{
              backgroundImage: `linear-gradient(to right, rgba(60,60,60,${a}) ${pct(value.start)}%, rgba(60,60,60,${b}) ${pct(value.end)}%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)`
            }}
          />
          <p className="muted small">
            {t(dir === 'out' || dir === 'in' ? 'fade.radialHint' : 'fade.linearHint')}
          </p>
        </div>
      )}
    </>
  )
}
