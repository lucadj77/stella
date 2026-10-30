import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  markupProblems,
  parseAttrs,
  serializeAttrs,
  spanAt,
  type Attrs,
  type MarkupProblem
} from '../../../shared/model/markup'
import { withoutComments } from '../../../shared/model/document'
import { highlightMarkup, type HighlightKind } from '../../../shared/model/markupHighlight'
import { suggestAt, type Suggestion, type SuggestionResult } from '../../../shared/model/markupHelp'
import { useI18n } from '../i18n/context'
import type { MessageKey } from '../i18n/en'
import { AssetsContext, SaveStyleContext, StylesContext, VariablesContext } from '../render/assets'
import FormatDialog from './FormatDialog'
import { OPEN_FORMAT_EVENT } from './editRun'
import MarkupText from '../render/MarkupText'
import { palette, resolveColor, type Variable } from '../../../shared/model/variables'

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  ref?: React.Ref<HTMLTextAreaElement>
}

/**
 * Campo di testo con l'aiuto alla scrittura del markup: dentro le graffe propone attributi,
 * stili, colori, forme, campi e immagini, ciascuno con una riga di spiegazione. Sotto il campo
 * elenca gli errori del markup. ↑↓ scelgono, Invio o Tab inseriscono, Esc chiude.
 */
export default function MarkupTextarea({
  fields,
  value,
  onChange,
  onKeyDown,
  onBlur,
  ref: outerRef,
  showProblems = true,
  toolbar,
  comments = false,
  ...rest
}: TextareaProps & {
  value: string
  /** Campi della carta, proposti dentro {...} */
  fields: string[]
  onChange(e: React.ChangeEvent<HTMLTextAreaElement>): void
  /** Errori sotto il campo; nelle celle della tabella non c'è spazio */
  showProblems?: boolean
  /** Barra sopra il campo, che prende il posto del pulsante "Formatta…" sotto */
  toolbar?(format: FormatControl): React.ReactNode
  /** Nei documenti: %% commento %% si colora come commento */
  comments?: boolean
}): React.JSX.Element {
  const { t } = useI18n()
  const assets = useContext(AssetsContext)
  const styles = useContext(StylesContext)
  const variables = useContext(VariablesContext)
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const [help, setHelp] = useState<(SuggestionResult & { index: number }) | null>(null)
  const [pos, setPos] = useState<{ x: number; y: number; top: number } | null>(null)
  // dopo Esc non si ripropone nulla finché non si scrive di nuovo
  const dismissed = useRef(false)
  const saveStyle = useContext(SaveStyleContext)
  /** Selezione da formattare: una porzione [testo]{...} esistente o un testo selezionato */
  const [target, setTarget] = useState<FormatTarget | null>(null)
  const [formatting, setFormatting] = useState<FormatTarget | null>(null)

  const overlayRef = useRef<HTMLDivElement>(null)
  // lo strato colorato ricopia misure e carattere del campo, che cambiano con il contenuto
  useLayoutEffect(() => {
    const el = ref.current
    const ov = overlayRef.current
    if (!el || !ov) return
    const sync = (): void => matchOverlay(el, ov)
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useLayoutEffect(() => {
    if (ref.current && overlayRef.current) overlayRef.current.scrollTop = ref.current.scrollTop
  })

  const setRefs = (el: HTMLTextAreaElement | null): void => {
    ref.current = el
    if (typeof outerRef === 'function') outerRef(el)
    else if (outerRef) (outerRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el
  }

  const refresh = (el: HTMLTextAreaElement): void => {
    if (showProblems) setTarget(formatTarget(el.value, el.selectionStart, el.selectionEnd))
    if (dismissed.current || el.selectionStart !== el.selectionEnd) return setHelp(null)
    const r = suggestAt(el.value, el.selectionStart, {
      fields,
      assets,
      styles: Object.keys(styles),
      variables
    })
    setHelp(r && r.items.length ? { ...r, index: 0 } : null)
    if (r) setPos(caretPosition(el, el.selectionStart))
  }

  const accept = (s: Suggestion): void => {
    const el = ref.current
    if (!el || !help) return
    const next = el.value.slice(0, help.from) + s.insert + el.value.slice(help.to)
    const caret = help.from + s.insert.length
    // si passa per il setter nativo, così React vede un normale evento di modifica
    setNativeValue(el, next)
    el.setSelectionRange(caret, caret)
    if (s.more) refresh(el)
    else setHelp(null)
  }

  // la posizione del cursore cambia anche con il mouse
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const onSelect = (): void => {
      if (document.activeElement === el) refresh(el)
    }
    document.addEventListener('selectionchange', onSelect)
    return () => document.removeEventListener('selectionchange', onSelect)
  })

  // la barra comune a più campi chiede la scheda: vale la selezione o, se manca, tutto il testo
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const open = (): void => {
      const f =
        formatTarget(el.value, el.selectionStart, el.selectionEnd) ??
        formatTarget(el.value, 0, el.value.length)
      if (f) setFormatting(f)
    }
    el.addEventListener(OPEN_FORMAT_EVENT, open)
    return () => el.removeEventListener(OPEN_FORMAT_EVENT, open)
  }, [])

  /** Sostituisce la porzione con il testo formattato e la riseleziona */
  const applyFormat = (f: FormatTarget, attrs: Attrs): void => {
    const el = ref.current
    setFormatting(null)
    if (!el) return
    const inner = el.value.slice(f.textFrom, f.textTo)
    const a = serializeAttrs(attrs)
    // senza attributi la porzione torna testo semplice
    const replacement = a ? `[${inner}]{${a}}` : inner
    setNativeValue(el, el.value.slice(0, f.from) + replacement + el.value.slice(f.to))
    el.focus()
    const start = f.from + (a ? 1 : 0)
    el.setSelectionRange(start, start + inner.length)
  }

  // nei documenti il markup dentro un commento non si controlla
  const allProblems = markupProblems(comments ? withoutComments(value) : value, styles, fields)
  // i colori stanno sul testo intero, senza dividerlo in pezzi: vedi markHighlights
  useLayoutEffect(() => {
    const node = overlayRef.current?.firstChild
    if (!HIGHLIGHTS || !(node instanceof Text)) return undefined
    return markHighlights(node, value, allProblems, comments)
  })
  const problems = showProblems ? allProblems : []
  const current = help?.items[help.index]

  return (
    <span className="markup-input">
      {toolbar?.({ enabled: !!target, open: () => target && setFormatting(target) })}
      <span className="markup-field">
        <textarea
          {...rest}
          ref={setRefs}
          onScroll={(e) => {
            if (overlayRef.current) overlayRef.current.scrollTop = e.currentTarget.scrollTop
          }}
          value={value}
          spellCheck={false}
          onChange={(e) => {
            dismissed.current = false
            onChange(e)
            refresh(e.currentTarget)
          }}
          onBlur={(e) => {
            setHelp(null)
            onBlur?.(e)
          }}
          onKeyDown={(e) => {
            if (help) {
              const n = help.items.length
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault()
                e.stopPropagation()
                const d = e.key === 'ArrowDown' ? 1 : -1
                setHelp({ ...help, index: (help.index + d + n) % n })
                return
              }
              if ((e.key === 'Enter' && !e.altKey && !e.shiftKey) || e.key === 'Tab') {
                e.preventDefault()
                e.stopPropagation()
                if (current) accept(current)
                return
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                dismissed.current = true
                setHelp(null)
                return
              }
            }
            onKeyDown?.(e)
          }}
        />
        <div className="markup-overlay" ref={overlayRef} aria-hidden>
          {HIGHLIGHTS ? `${value}\u200b` : highlighted(value, allProblems, comments)}
        </div>
      </span>
      {help && pos && (
        <div
          className="markup-help"
          // vicino al fondo della finestra si apre sopra la riga
          style={
            pos.y + 260 > window.innerHeight
              ? { left: pos.x, bottom: window.innerHeight - pos.top }
              : { left: pos.x, top: pos.y }
          }
          // il clic non deve togliere il fuoco al campo
          onMouseDown={(e) => e.preventDefault()}
        >
          <ul>
            {help.items.map((s, i) => (
              <li
                key={s.kind + s.label}
                className={i === help.index ? 'active' : undefined}
                onMouseEnter={() => setHelp({ ...help, index: i })}
                onClick={() => accept(s)}
              >
                {(s.kind === 'color' || s.swatch) && (
                  <span className="swatch" style={{ background: s.swatch ?? s.label }} />
                )}
                {s.kind === 'variable' && variables[s.label]?.type === 'image' && (
                  <span className="variable-icon">
                    <MarkupText text={`{${s.label}}`} unit={3} ratio={1} paragraphSpacing={0} />
                  </span>
                )}
                <span className="markup-help-label">{s.label}</span>
                <span className="markup-help-kind">
                  {t(`markupHelp.kind.${s.kind}` as MessageKey)}
                </span>
              </li>
            ))}
          </ul>
          {current?.kind === 'variable' && variables[current.label] && (
            <VariablePreview name={current.label} v={variables[current.label]} />
          )}
          {current?.attribute && (
            <p className="markup-help-detail">
              {t(`markupHelp.attr.${current.attribute}` as MessageKey)}
            </p>
          )}
        </div>
      )}
      {showProblems && !toolbar && (
        <span className="markup-tools">
          <button
            className="small-btn"
            disabled={!target}
            title={t('format.buttonHint')}
            // il clic non deve togliere la selezione al campo
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => target && setFormatting(target)}
          >
            {t('format.button')}
          </button>
        </span>
      )}
      {/* fuori dal campo nel DOM: gli stili del modulo della carta non toccano la finestra */}
      {formatting &&
        createPortal(
          <FormatDialog
            mode="text"
            initial={formatting.attrs}
            sample={String(value).slice(formatting.textFrom, formatting.textTo)}
            onApply={(attrs) => applyFormat(formatting, attrs)}
            onSaveStyle={
              saveStyle
                ? (name, attrs) => {
                    saveStyle(name, serializeAttrs(attrs))
                    applyFormat(formatting, { styles: [name] })
                  }
                : undefined
            }
            onClose={() => setFormatting(null)}
          />,
          document.body
        )}
      {problems.length > 0 && (
        <span className="markup-problems">
          {problems.map((p, i) => (
            <span key={i}>{t(p.message)}</span>
          ))}
        </span>
      )}
    </span>
  )
}

/** Anteprima della variabile proposta: l'icona o il testo già formattato, il colore, il valore */
function VariablePreview({ name, v }: { name: string; v: Variable }): React.JSX.Element {
  const { t } = useI18n()
  const variables = useContext(VariablesContext)
  return (
    <div className="markup-help-detail markup-help-preview">
      <span className="muted">{t(`variable.type.${v.type}`)}</span>
      {v.type === 'color' ? (
        <>
          <span
            className="swatch"
            style={{ background: resolveColor(v.color, palette(variables)) }}
          />
          <code>{v.color}</code>
        </>
      ) : v.type === 'value' ? (
        <code>{v.value}</code>
      ) : (
        <span className="markup-help-sample">
          {/* il testo di una variabile si sostituisce prima del disegno: qui si disegna il suo */}
          <MarkupText
            text={v.type === 'text' ? v.text : `{${name}}`}
            unit={4}
            ratio={1}
            paragraphSpacing={0}
          />
        </span>
      )}
    </div>
  )
}

/**
 * Il browser sa colorare parti di un testo senza dividerlo in elementi (CSS Custom Highlight API).
 * Conta: con il testo diviso in pezzi le larghezze si misurano a pezzi, con arrotondamenti
 * diversi da quelli del campo, e una parola al limite della riga va a capo nello strato colorato
 * ma non nel campo. Da lì in poi il testo che si vede non sta più sotto il cursore.
 */
const HIGHLIGHTS = typeof CSS !== 'undefined' && 'highlights' in CSS

/** Un gruppo di parti colorate per tipo, condiviso da tutti i campi della finestra */
const highlightGroups = new Map<string, Highlight>()
function highlightGroup(name: string): Highlight {
  let h = highlightGroups.get(name)
  if (!h) {
    h = new Highlight()
    highlightGroups.set(name, h)
    CSS.highlights.set(name, h)
  }
  return h
}

/** Colora il testo dello strato; restituisce la funzione che toglie i colori */
function markHighlights(
  node: Text,
  src: string,
  problems: MarkupProblem[],
  comments: boolean
): () => void {
  const ranges: [Highlight, Range][] = []
  const clamp = (n: number): number => Math.max(0, Math.min(src.length, n))
  const add = (name: string, from: number, to: number): void => {
    if (clamp(to) <= clamp(from)) return
    const r = new Range()
    r.setStart(node, clamp(from))
    r.setEnd(node, clamp(to))
    const h = highlightGroup(name)
    h.add(r)
    ranges.push([h, r])
  }
  for (const p of highlightMarkup(src, { comments })) add(`mk-${p.kind}`, p.from, p.to)
  for (const p of problems) add('mk-err', p.from, p.to)
  return () => {
    for (const [h, r] of ranges) h.delete(r)
  }
}

/** Il testo diviso in pezzi colorati; gli errori sono sottolineati */
function highlighted(src: string, problems: MarkupProblem[], comments: boolean): React.ReactNode[] {
  const pieces = highlightMarkup(src, { comments })
  const cuts = new Set([0, src.length])
  for (const p of [...pieces, ...problems]) {
    cuts.add(Math.max(0, Math.min(src.length, p.from)))
    cuts.add(Math.max(0, Math.min(src.length, p.to)))
  }
  const points = [...cuts].sort((a, b) => a - b)
  const out: React.ReactNode[] = []
  let k = 0
  for (let i = 0; i + 1 < points.length; i++) {
    const [a, b] = [points[i], points[i + 1]]
    while (k < pieces.length && pieces[k].to <= a) k++
    const kind: HighlightKind | undefined =
      pieces[k] && pieces[k].from <= a && pieces[k].to >= b ? pieces[k].kind : undefined
    const err = problems.some((p) => p.from < b && p.to > a)
    const text = src.slice(a, b)
    out.push(
      kind || err ? (
        <span key={a} className={[kind && `mk-${kind}`, err && 'mk-err'].filter(Boolean).join(' ')}>
          {text}
        </span>
      ) : (
        text
      )
    )
  }
  // un a capo finale occupa una riga anche nello strato colorato
  out.push('\u200b')
  return out
}

const COPIED = [
  'boxSizing',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderTopStyle',
  'borderRightStyle',
  'borderBottomStyle',
  'borderLeftStyle',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'lineHeight',
  'letterSpacing',
  'wordSpacing',
  'textIndent',
  'tabSize'
] as const

/** Porta lo strato colorato esattamente sopra il testo del campo */
function matchOverlay(el: HTMLTextAreaElement, ov: HTMLDivElement): void {
  const cs = getComputedStyle(el)
  for (const p of COPIED) ov.style[p] = cs[p]
  // la barra di scorrimento del campo restringe il testo: lo strato ne ha una uguale, invisibile,
  // così va a capo negli stessi punti. Misurarla non basta: le misure in pixel sono arrotondate, e
  // mezzo pixel di differenza manda a capo una parola in più o in meno
  ov.style.overflowY = el.scrollHeight > el.clientHeight ? 'scroll' : 'hidden'
  const box = el.getBoundingClientRect()
  ov.style.top = `${el.offsetTop}px`
  ov.style.left = `${el.offsetLeft}px`
  ov.style.width = `${box.width}px`
  ov.style.height = `${box.height}px`
  ov.scrollTop = el.scrollTop
}

function setNativeValue(el: HTMLTextAreaElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
  setter?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

/**
 * Posizione dei suggerimenti: in orizzontale al cursore, in verticale appena fuori dal campo.
 * Per trovare il cursore si copia il testo in un elemento
 * invisibile con lo stesso stile e si misura dove cade il segno nel punto del cursore.
 */
function caretPosition(
  el: HTMLTextAreaElement,
  pos: number
): { x: number; y: number; top: number } {
  const cs = getComputedStyle(el)
  const mirror = document.createElement('div')
  for (const p of [
    'boxSizing',
    'width',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'lineHeight',
    'letterSpacing',
    'tabSize'
  ] as const)
    mirror.style[p] = cs[p]
  Object.assign(mirror.style, {
    position: 'fixed',
    visibility: 'hidden',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    top: '0',
    left: '0'
  })
  mirror.textContent = el.value.slice(0, pos)
  const mark = document.createElement('span')
  mark.textContent = '​'
  mirror.appendChild(mark)
  document.body.appendChild(mirror)
  const box = el.getBoundingClientRect()
  const x = box.left + mark.offsetLeft - el.scrollLeft
  document.body.removeChild(mirror)
  // i suggerimenti stanno fuori dal campo, sotto o sopra: così non coprono il testo
  return {
    x: Math.max(4, Math.min(x, window.innerWidth - 300)),
    y: box.bottom + 2,
    top: box.top - 2
  }
}

/** Il "Formatta…" del campo, per una barra esterna */
export interface FormatControl {
  /** C'è un testo selezionato o una porzione [testo]{...} sotto il cursore */
  enabled: boolean
  open(): void
}

interface FormatTarget {
  /** Parte del testo sostituita */
  from: number
  to: number
  /** Testo da formattare */
  textFrom: number
  textTo: number
  attrs: Attrs
}

/**
 * Cosa formatta il pulsante: la porzione [testo]{...} in cui sta la selezione o il cursore,
 * altrimenti il testo selezionato (che diventa una porzione nuova).
 */
function formatTarget(text: string, from: number, to: number): FormatTarget | null {
  const span = spanAt(text, from, to)
  if (span && from >= span.start)
    return {
      from: span.start,
      to: span.end,
      textFrom: span.textFrom,
      textTo: span.textTo,
      attrs: parseAttrs(text.slice(span.attrsFrom, span.attrsTo)).attrs
    }
  if (from === to || text.slice(from, to).includes('\n')) return null
  return { from, to, textFrom: from, textTo: to, attrs: { styles: [] } }
}
