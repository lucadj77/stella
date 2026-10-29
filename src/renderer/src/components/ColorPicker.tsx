import {
  useContext,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { createPortal } from 'react-dom'
import {
  hslToRgb,
  hsvToRgb,
  parseHex,
  rgbToHsl,
  rgbToHsv,
  toHex,
  type Hsv,
  type Rgba
} from '../../../shared/model/colorMath'
import { palette, resolveColor } from '../../../shared/model/variables'
import { useI18n } from '../i18n/context'
import { ProjectColorsContext, VariablesContext } from '../render/assets'
import { cssColor, eyeDropper, rememberColor, useRecent } from './colorUtils'

// Selettore colore dell'app, al posto di quello di sistema: area saturazione/valore, cursori per
// tonalità e trasparenza, codice esadecimale, campi RGB o HSL, contagocce, colori del progetto e
// colori usati di recente. Scrive sempre un codice #RRGGBB (#RRGGBBAA se trasparente) o il nome
// di un colore del progetto. Vedi docs/specifica.md, sezione 6.

const MODE_KEY = 'colorPickerMode'

/**
 * Campione di colore: un clic apre il selettore sotto di sé. `value` può essere un codice, un
 * nome standard o un colore del progetto; il campione mostra il colore che indica.
 */
export function ColorSwatch({
  value,
  onChange,
  disabled,
  title
}: {
  value: string
  onChange(v: string): void
  disabled?: boolean
  title?: string
}): React.JSX.Element {
  const { t } = useI18n()
  const variables = useContext(VariablesContext)
  const pal = useMemo(() => palette(variables), [variables])
  /** Il campione da cui si è aperto il selettore, finché è aperto */
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const shown = resolveColor(value, pal)
  return (
    <>
      <button
        type="button"
        className="color-swatch"
        disabled={disabled}
        title={title ?? t('color.open')}
        onClick={(e) => {
          // dentro un'etichetta il clic non deve passare ad altri campi
          e.preventDefault()
          setAnchor(anchor ? null : e.currentTarget)
        }}
      >
        <span style={{ background: cssColor(shown) ? shown : 'transparent' }} />
      </button>
      {anchor && (
        <ColorPopover
          anchor={anchor}
          value={value}
          palette={pal}
          onChange={onChange}
          onClose={() => setAnchor(null)}
        />
      )}
    </>
  )
}

function ColorPopover({
  anchor,
  value,
  palette: pal,
  onChange,
  onClose
}: {
  anchor: HTMLElement
  value: string
  palette: Record<string, string>
  onChange(v: string): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const recent = useRecent()
  const used = useContext(ProjectColorsContext)
  const boxRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const [start] = useState(value)
  const [mode, setModeState] = useState<'rgb' | 'hsl'>(() => {
    try {
      return localStorage.getItem(MODE_KEY) === 'hsl' ? 'hsl' : 'rgb'
    } catch {
      return 'rgb'
    }
  })
  const setMode = (m: 'rgb' | 'hsl'): void => {
    setModeState(m)
    try {
      localStorage.setItem(MODE_KEY, m)
    } catch {
      // preferenza non essenziale
    }
  }

  // stato in HSV: tiene la tonalità anche sui grigi, dove l'RGB la perde. `value` è l'ultimo
  // valore visto, scritto qui o da fuori
  const [color, setColor] = useState(() => {
    const c = cssColor(resolveColor(value, pal)) ?? { r: 0, g: 0, b: 0, a: 1 }
    return { hsv: rgbToHsv(c), alpha: c.a, value }
  })
  const { hsv, alpha } = color
  const rgb = hsvToRgb(hsv, alpha)
  const hex = toHex(rgb)

  // un valore cambiato da fuori (scritto nel campo di testo) aggiorna il selettore
  if (value !== color.value) {
    const c = cssColor(resolveColor(value, pal))
    setColor(c && toHex(c) !== hex ? { hsv: rgbToHsv(c), alpha: c.a, value } : { ...color, value })
  }

  /** Scrive un valore; `next` è il colore che il selettore mostra */
  const emit = (v: string, next: { hsv: Hsv; alpha: number }): void => {
    setColor({ ...next, value: v })
    onChange(v)
  }
  const apply = (next: Hsv, a = alpha): void =>
    emit(toHex(hsvToRgb(next, a)), { hsv: next, alpha: a })
  /** Sceglie un colore della tavolozza o dei recenti, che si scrive per nome o com'è */
  const choose = (v: string): void => {
    const c = cssColor(resolveColor(v, pal))
    emit(v, c ? { hsv: rgbToHsv(c), alpha: c.a } : color)
  }
  const applyRgb = (c: Rgba): void => {
    const next = rgbToHsv(c)
    // sui grigi la tonalità resta quella di prima
    apply(next.s === 0 ? { ...next, h: hsv.h } : next, c.a)
  }

  const close = useEffectEvent((): void => {
    if (color.value !== start) rememberColor(color.value)
    onClose()
  })

  useLayoutEffect(() => {
    const r = anchor.getBoundingClientRect()
    const box = boxRef.current?.getBoundingClientRect()
    const w = box?.width ?? 260
    const h = box?.height ?? 380
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8))
    const below = r.bottom + 4
    const top = below + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 4) : below
    setPos({ left, top })
  }, [anchor])

  useEffect(() => {
    const onDown = (e: MouseEvent): void => {
      const target = e.target as Node
      if (boxRef.current?.contains(target) || anchor.contains(target)) return
      close()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      close()
    }
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [anchor])

  const dropper = typeof window !== 'undefined' && 'EyeDropper' in window
  const pick = async (): Promise<void> => {
    // lo sfondo scuro delle finestre si toglie mentre si sceglie, o i colori presi sarebbero più scuri
    document.documentElement.classList.add('picking-color')
    try {
      // prima si ridisegna senza lo sfondo scuro
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
      const r = await eyeDropper()?.open()
      const c = r && cssColor(r.sRGBHex)
      if (c) applyRgb({ ...c, a: alpha })
    } catch {
      // annullato con Esc
    } finally {
      document.documentElement.classList.remove('picking-color')
    }
  }

  const hsl = rgbToHsl(rgb)
  const fields: [string, number, number, (n: number) => void][] =
    mode === 'rgb'
      ? [
          ['R', rgb.r, 255, (n) => applyRgb({ ...rgb, r: n })],
          ['G', rgb.g, 255, (n) => applyRgb({ ...rgb, g: n })],
          ['B', rgb.b, 255, (n) => applyRgb({ ...rgb, b: n })]
        ]
      : [
          ['H', hsl.h, 360, (n) => applyRgb(hslToRgb({ ...hsl, h: n }, alpha))],
          ['S', hsl.s, 100, (n) => applyRgb(hslToRgb({ ...hsl, s: n }, alpha))],
          ['L', hsl.l, 100, (n) => applyRgb(hslToRgb({ ...hsl, l: n }, alpha))]
        ]

  const names = Object.keys(pal)
  // i codici uguali a un colore del progetto si mostrano una volta sola, col nome
  const named = new Set(
    names.flatMap((n) => {
      const c = cssColor(pal[n])
      return c ? [toHex(c)] : []
    })
  )
  const others = used.filter((c) => !named.has(c))
  const current = value.trim().toUpperCase()
  const opaque = toHex({ ...rgb, a: 1 })

  return createPortal(
    <div
      ref={boxRef}
      className="color-popover"
      role="dialog"
      aria-label={t('color.title')}
      style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <Area
        className="color-sv"
        style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
        x={hsv.s / 100}
        y={1 - hsv.v / 100}
        onMove={(x, y) => apply({ ...hsv, s: x * 100, v: (1 - y) * 100 })}
      />
      <Area
        className="color-hue"
        x={hsv.h / 360}
        onMove={(x) => apply({ ...hsv, h: Math.min(359.9, x * 360) })}
      />
      <Area
        className="color-alpha"
        style={{ ['--opaque' as string]: opaque }}
        x={alpha}
        onMove={(x) => apply(hsv, Math.round(x * 100) / 100)}
      />
      <div className="color-row">
        {dropper && (
          <button
            type="button"
            className="color-dropper"
            title={t('color.eyedropper')}
            onClick={pick}
          >
            <DropperIcon />
          </button>
        )}
        <span className="color-preview">
          <span style={{ background: hex }} />
        </span>
        <HexInput value={hex} onChange={(c) => applyRgb(c)} />
        {/* nessun colore: si scrive none, che altrimenti andrebbe digitato a mano */}
        <button
          type="button"
          className={'color-none' + (value.trim().toLowerCase() === 'none' ? ' on' : '')}
          title={t('color.noneHint')}
          onClick={() => {
            setColor({ ...color, value: 'none' })
            onChange('none')
          }}
        >
          {t('color.none')}
        </button>
      </div>
      <div className="color-row">
        <span className="color-mode">
          {(['rgb', 'hsl'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={mode === m ? 'on' : ''}
              onClick={() => setMode(m)}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </span>
        {fields.map(([label, v, max, set]) => (
          <NumberBox key={label} label={label} value={v} max={max} onChange={set} />
        ))}
        <NumberBox
          label="A"
          value={alpha * 100}
          max={100}
          unit="%"
          onChange={(n) => apply(hsv, n / 100)}
        />
      </div>
      {names.length + others.length > 0 && (
        <>
          <h4>{t('color.project')}</h4>
          <div className="color-swatches">
            {names.map((n) => (
              <button
                key={n}
                type="button"
                title={t('color.variable', { name: n, color: pal[n] })}
                className={'named' + (value.trim().replace(/^\{(.*)\}$/, '$1') === n ? ' on' : '')}
                onClick={() => choose(n)}
              >
                <span style={{ background: pal[n] }} />
              </button>
            ))}
            {others.map((c) => (
              <button
                key={c}
                type="button"
                title={c}
                className={current === c ? 'on' : ''}
                onClick={() => choose(c)}
              >
                <span style={{ background: c }} />
              </button>
            ))}
          </div>
        </>
      )}
      <h4>{t('color.recent')}</h4>
      {recent.length ? (
        <div className="color-swatches">
          {recent.map((c) => {
            const shown = resolveColor(c, pal)
            return (
              <button key={c} type="button" title={c} onClick={() => choose(c)}>
                <span style={{ background: cssColor(shown) ? shown : 'transparent' }} />
              </button>
            )
          })}
        </div>
      ) : (
        <p className="muted small">{t('color.noRecent')}</p>
      )}
    </div>,
    document.body
  )
}

/** Area in cui si trascina: restituisce la posizione tra 0 e 1 */
function Area({
  className,
  style,
  x,
  y,
  onMove
}: {
  className: string
  style?: React.CSSProperties
  x: number
  y?: number
  onMove(x: number, y: number): void
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const at = (e: React.PointerEvent): void => {
    const r = ref.current!.getBoundingClientRect()
    const cx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const cy = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    onMove(cx, cy)
  }
  return (
    <div
      ref={ref}
      className={className}
      style={style}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        at(e)
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) at(e)
      }}
    >
      <span
        className="color-knob"
        style={{ left: `${x * 100}%`, top: y === undefined ? '50%' : `${y * 100}%` }}
      />
    </div>
  )
}

function HexInput({
  value,
  onChange
}: {
  value: string
  onChange(c: Rgba): void
}): React.JSX.Element {
  const [text, setText] = useState(value)
  const [editing, setEditing] = useState(false)
  return (
    <input
      className="color-hex"
      value={editing ? text : value}
      spellCheck={false}
      onFocus={() => {
        setText(value)
        setEditing(true)
      }}
      onBlur={() => setEditing(false)}
      onChange={(e) => {
        setText(e.target.value)
        const v = e.target.value.trim()
        const c = parseHex(v.startsWith('#') ? v : '#' + v)
        if (c && /^#?([0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) onChange(c)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
    />
  )
}

function NumberBox({
  label,
  value,
  max,
  unit,
  onChange
}: {
  label: string
  value: number
  max: number
  unit?: string
  onChange(n: number): void
}): React.JSX.Element {
  const [text, setText] = useState<string | null>(null)
  return (
    <label className="color-num" title={unit ? `${label} ${unit}` : label}>
      <span>{label}</span>
      <input
        value={text ?? String(Math.round(value))}
        inputMode="numeric"
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          setText(e.target.value)
          const n = Number(e.target.value)
          if (e.target.value.trim() !== '' && Number.isFinite(n))
            onChange(Math.min(max, Math.max(0, n)))
        }}
        onBlur={() => setText(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            const step = (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1)
            setText(null)
            onChange(Math.min(max, Math.max(0, Math.round(value) + step)))
          } else if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
    </label>
  )
}

function DropperIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 4l6 6M17 3.5a2.1 2.1 0 0 1 3 3L17 9.5l-3-3zM15.5 8L6 17.5 4 20l2.5-2L16 8.5"
      />
    </svg>
  )
}
