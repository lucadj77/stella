import { useContext, useMemo, type CSSProperties } from 'react'
import { resolveAsset } from '../../../shared/model/assets'
import {
  BLOCK_STYLE,
  isBox,
  mergeAttrs,
  parseInline,
  parseMarkup,
  resolveStyles,
  type Attrs,
  type Block,
  type Inline
} from '../../../shared/model/markup'
import {
  imageVariable,
  mergeImageSettings,
  palette,
  resolveColor,
  resolveFont,
  type ImageSettings,
  type Variables
} from '../../../shared/model/variables'
import { AssetsContext, StylesContext, VariablesContext, assetUrl } from './assets'
import { useImageSize } from './imageSize'
import { imageBackdrop, shapePath } from '../../../shared/model/shapes'

// Disegna il markup del testo (docs/specifica.md, 2.1) come HTML dentro il foreignObject del
// livello. Le misure sono nel sistema scalato del livello: `unit` pixel per millimetro.

const PT_TO_MM = 25.4 / 72

interface Scale {
  /** Pixel per millimetro */
  unit: number
  /** Riduzione applicata da "riduci per stare nel riquadro", per le dimensioni assolute */
  ratio: number
  /** Colori con nome del progetto */
  pal: Record<string, string>
  /** Variabili del progetto, per i font scritti come {variabile} negli stili */
  vars?: Variables
}

export default function MarkupText({
  text,
  unit,
  ratio,
  paragraphSpacing
}: {
  text: string
  unit: number
  ratio: number
  /** mm */
  paragraphSpacing: number
}): React.JSX.Element {
  const styles = useContext(StylesContext)
  const variables = useContext(VariablesContext)
  const pal = useMemo(() => palette(variables), [variables])
  const { blocks } = parseMarkup(text)
  const k = { unit, ratio, pal, vars: variables }
  return (
    <>
      {blocks.map((b, i) => (
        <BlockView
          key={i}
          block={b}
          k={k}
          styles={styles}
          marginTop={i ? paragraphSpacing * unit : 0}
        />
      ))}
    </>
  )
}

/**
 * Una riga di markup senza paragrafi, in HTML normale: il testo di un titolo, di una voce o di
 * una cella dei documenti. `unit` sono i pixel per millimetro.
 */
export function MarkupInline({ text, unit }: { text: string; unit: number }): React.JSX.Element {
  const styles = useContext(StylesContext)
  const variables = useContext(VariablesContext)
  const pal = useMemo(() => palette(variables), [variables])
  const { children } = parseInline(text)
  return <Inlines list={children} k={{ unit, ratio: 1, pal, vars: variables }} styles={styles} />
}

function BlockView({
  block: b,
  k,
  styles,
  marginTop
}: {
  block: Block
  k: Scale
  styles: Record<string, string>
  marginTop: number
}): React.JSX.Element {
  if (b.kind === 'rule')
    return (
      <div
        style={{
          height: 0,
          borderTop: `${0.25 * k.unit}px solid currentColor`,
          opacity: 0.45,
          margin: `${marginTop || 0.35 * k.unit * 4}px 0 ${0.35 * k.unit * 4}px`
        }}
      />
    )
  const kindStyle = BLOCK_STYLE[b.kind]
  const attrs = resolveStyles(
    kindStyle ? mergeAttrs({ styles: [kindStyle] }, b.attrs) : b.attrs,
    styles
  )
  const marker = b.kind === 'bullet' ? '•' : b.kind === 'number' ? `${b.number}.` : null
  const style: CSSProperties = {
    margin: 0,
    marginTop,
    ...textStyle(attrs, k),
    textAlign: attrs.align,
    ...(marker ? { paddingLeft: '1.2em', textIndent: '-1.2em' } : null)
  }
  return (
    <p style={style}>
      {marker && (
        <span style={{ display: 'inline-block', width: '1.2em', textIndent: 0 }}>{marker}</span>
      )}
      {b.children.length ? <Inlines list={b.children} k={k} styles={styles} /> : ' '}
    </p>
  )
}

function Inlines({
  list,
  k,
  styles
}: {
  list: Inline[]
  k: Scale
  styles: Record<string, string>
}): React.JSX.Element {
  return (
    <>
      {list.map((n, i) => {
        switch (n.t) {
          case 'text':
            return n.text
          case 'br':
            return <br key={i} />
          case 'ref':
            return <Ref key={i} name={n.name} count={n.count} raw={n.raw} image={n.image} />
          default:
            return (
              <SpanView key={i} attrs={resolveStyles(n.attrs, styles)} k={k} styles={styles}>
                {n.children}
              </SpanView>
            )
        }
      })}
    </>
  )
}

function SpanView({
  attrs: a,
  k,
  styles,
  children
}: {
  attrs: Attrs
  k: Scale
  styles: Record<string, string>
  children: Inline[]
}): React.JSX.Element {
  const inner = <Inlines list={children} k={k} styles={styles} />
  // fuori da un riquadro text-raise sposta il testo come raise
  if (!isBox(a))
    return (
      <span style={textStyle({ ...a, raise: (a.raise ?? 0) + (a.textRaise ?? 0) }, k)}>
        {inner}
      </span>
    )

  // riquadro: la dimensione va sul contenitore, così le misure in em valgono per entrambi;
  // il colore va sul testo, così lo sfondo prende di base il colore del testo intorno
  const { color, highlight, textRaise, ...rest } = a
  const outer = textStyle({ ...rest, styles: [] }, k)
  const textOnly = textStyle({ styles: [], color, highlight, raise: textRaise }, k)
  const [pv, ph] = a.pad ?? (a.bg ? [0, 0.4] : [0.2, 0.6])
  const fill = resolveColor(a.fill, k.pal)
  const radius =
    a.radius === 'round' ? '999px' : a.radius !== undefined ? `${a.radius * k.unit}px` : undefined
  const border = a.border
    ? `${a.border.width * k.unit}px solid ${resolveColor(a.border.color, k.pal)}`
    : undefined

  if (!a.bg)
    return (
      <span
        style={{
          ...outer,
          display: 'inline-block',
          padding: `${pv * k.unit}px ${ph * k.unit}px`,
          border,
          borderRadius: radius,
          background: fill,
          lineHeight: 1.15,
          textIndent: 0
        }}
      >
        <span style={textOnly}>{inner}</span>
      </span>
    )

  const size = a.bgSize
    ? a.bgSize.endsWith('%')
      ? `${parseFloat(a.bgSize) / 100}em`
      : `${parseFloat(a.bgSize) * k.unit}px`
    : '1.45em'
  return (
    <span
      style={{
        ...outer,
        display: 'inline-grid',
        placeItems: 'center',
        position: 'relative',
        minWidth: size,
        height: size,
        padding: `${pv * k.unit}px ${ph * k.unit}px`,
        boxSizing: 'border-box',
        verticalAlign: 'middle',
        lineHeight: 1,
        textIndent: 0,
        background: fill,
        borderRadius: radius
      }}
    >
      <Background
        name={a.bg}
        color={resolveColor(a.bgColor, k.pal)}
        border={a.border && { ...a.border, color: resolveColor(a.border.color, k.pal) }}
        unit={k.unit}
      />
      <span style={{ position: 'relative', ...textOnly }}>{inner}</span>
    </span>
  )
}

/**
 * Margini di un'immagine nel testo: un po' di spazio, più la spaziatura del testo divisa sui due
 * lati. Tutta a destra, l'ultima icona sporgerebbe e una riga centrata finirebbe spostata.
 */
const INLINE_MARGIN = '0 calc(0.04em + var(--gc-ls, 0px) / 2)'

const FILL: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%' }

/** Sfondo del riquadro: una forma predefinita o un'immagine degli asset, colorabile */
function Background({
  name,
  color,
  border,
  unit
}: {
  name: string
  color?: string
  border?: { color: string; width: number }
  unit: number
}): React.JSX.Element {
  const assets = useContext(AssetsContext)
  const variables = useContext(VariablesContext)
  const shape = shapePath(name)
  if (shape)
    return (
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ ...FILL, overflow: 'visible' }}
      >
        <path
          d={shape}
          fill={color ?? 'currentColor'}
          stroke={border?.color}
          strokeWidth={border ? border.width * unit : undefined}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    )
  // una variabile immagine prevale su un file con lo stesso nome, e porta la sua tinta
  const v = imageVariable(name, variables)
  const tint = color ?? (v?.tint ? resolveColor(v.tint, palette(variables)) : undefined)
  const res = resolveAsset(v?.src ?? name, assets)
  if (!res.ok) return <span style={{ ...FILL, border: '1px dashed #E5484D' }} title={name} />
  const url = assetUrl(res.path)
  // con un colore l'immagine fa da maschera: ricolora le icone monocromatiche
  if (tint)
    return (
      <span
        style={{
          ...FILL,
          background: tint,
          WebkitMask: `url("${url}") center / contain no-repeat`
        }}
      />
    )
  return <img src={url} style={{ ...FILL, objectFit: 'contain' }} alt="" />
}

/** {nome} rimasto dopo i campi: un'immagine degli asset, ripetuta; altrimenti un errore */
function Ref({
  name,
  count,
  raw,
  image
}: {
  name: string
  count: number
  raw: string
  /** Attributi scritti nel testo, che prevalgono su quelli della variabile */
  image?: ImageSettings
}): React.JSX.Element {
  const assets = useContext(AssetsContext)
  const variables = useContext(VariablesContext)
  const v = imageVariable(name, variables)
  const res = name ? resolveAsset(v?.src ?? name, assets) : null
  const set = mergeImageSettings(v, image)
  const size = useImageSize(res?.ok && set.tint ? assetUrl(res.path) : null)
  const scale = set.scale ?? 1
  const height = 1.15 * scale
  if (!res?.ok)
    return v ? (
      // variabile immagine con il file mancante: un riquadro al posto dell'icona
      <span
        title={`${name}: ${v.src}`}
        style={{
          display: 'inline-block',
          width: `${height * 0.8}em`,
          height: `${height * 0.8}em`,
          verticalAlign: `${-0.12 * scale}em`,
          margin: INLINE_MARGIN,
          border: '0.06em dashed #E5484D',
          borderRadius: '0.15em',
          boxSizing: 'border-box'
        }}
      />
    ) : (
      <span style={{ textDecoration: 'underline wavy #E5484D', textDecorationSkipInk: 'none' }}>
        {raw}
      </span>
    )
  const url = assetUrl(res.path)
  const transform = [
    set.rotate ? `rotate(${set.rotate}deg)` : '',
    set.flip ? `scale(${set.flip.includes('h') ? -1 : 1}, ${set.flip.includes('v') ? -1 : 1})` : ''
  ]
    .filter(Boolean)
    .join(' ')
  const style: CSSProperties = {
    height: `${height}em`,
    verticalAlign: `${-0.22 * scale + (set.raise ?? 0) / 100}em`,
    margin: INLINE_MARGIN,
    transform: transform || undefined,
    opacity: set.opacity
  }
  const tint = set.tint ? resolveColor(set.tint, palette(variables)) : null
  const backdrop = imageBackdrop(v, variables)
  if (backdrop) {
    // lo sfondo della variabile: un quadrato alto quanto l'icona, con l'immagine al centro
    const inner = height * (1 - 2 * backdrop.pad)
    const one: CSSProperties = {
      ...style,
      transform: undefined,
      display: 'inline-grid',
      placeItems: 'center',
      position: 'relative',
      width: `${height}em`
    }
    const icon: CSSProperties = {
      position: 'relative',
      height: `${inner}em`,
      transform: transform || undefined
    }
    return (
      <>
        {Array.from({ length: count }, (_, i) => (
          <span key={i} style={one}>
            <Background
              name={backdrop.shape ?? backdrop.src ?? ''}
              color={backdrop.color ? resolveColor(backdrop.color, palette(variables)) : undefined}
              unit={1}
            />
            {tint ? (
              <span
                style={{
                  ...icon,
                  display: 'inline-block',
                  width: `${size ? (inner * size.w) / size.h : inner}em`,
                  background: tint,
                  WebkitMask: `url("${url}") center / contain no-repeat`
                }}
              />
            ) : (
              <img src={url} alt="" style={{ ...icon, width: 'auto' }} />
            )}
          </span>
        ))}
      </>
    )
  }
  return (
    <>
      {Array.from({ length: count }, (_, i) =>
        tint ? (
          // la tinta usa l'immagine come maschera: serve la larghezza, presa dalle proporzioni
          <span
            key={i}
            style={{
              ...style,
              display: 'inline-block',
              width: `${size ? (height * size.w) / size.h : height}em`,
              background: tint,
              WebkitMask: `url("${url}") center / contain no-repeat`
            }}
          />
        ) : (
          <img key={i} src={url} alt="" style={{ ...style, width: 'auto' }} />
        )
      )}
    </>
  )
}

/** Proprietà del carattere come stile CSS */
function textStyle(a: Attrs, k: Scale): CSSProperties {
  const pt = PT_TO_MM * k.unit
  const s: CSSProperties = {}
  if (a.color) s.color = resolveColor(a.color, k.pal)
  if (a.highlight) {
    s.backgroundColor = resolveColor(a.highlight, k.pal)
    s.boxDecorationBreak = 'clone'
    s.WebkitBoxDecorationBreak = 'clone'
  }
  if (a.size) {
    const v = parseFloat(a.size)
    s.fontSize = a.size.endsWith('%')
      ? `${v / 100}em`
      : /^[+-]/.test(a.size)
        ? `calc(1em + ${v * pt * k.ratio}px)`
        : `${v * pt * k.ratio}px`
  }
  if (a.font) s.fontFamily = `'${resolveFont(a.font, k.vars)}', sans-serif`
  if (a.weight) s.fontWeight = a.weight
  if (a.italic) s.fontStyle = 'italic'
  const deco = [a.underline && 'underline', a.strike && 'line-through'].filter(Boolean)
  if (deco.length) s.textDecorationLine = deco.join(' ')
  if (a.script) {
    s.verticalAlign = a.script === 'sup' ? 'super' : 'sub'
    if (!a.size) s.fontSize = '0.7em'
    s.lineHeight = 0
  }
  if (a.stroke) {
    const w =
      typeof a.stroke.width === 'string'
        ? `${(parseFloat(a.stroke.width) / 100) * 2}em`
        : `${a.stroke.width * 2 * k.unit}px`
    s.WebkitTextStroke = `${w} ${resolveColor(a.stroke.color, k.pal)}`
    s.paintOrder = 'stroke fill'
  }
  if (a.spacing !== undefined) {
    s.letterSpacing = `${a.spacing / 1000}em`
    ;(s as Record<string, string>)['--gc-ls'] = `${a.spacing / 1000}em`
  }
  if (a.raise) {
    s.position = 'relative'
    s.top = `${-a.raise * pt}px`
  }
  if (a.transform === 'upper') s.textTransform = 'uppercase'
  if (a.transform === 'lower') s.textTransform = 'lowercase'
  if (a.transform === 'smallcaps') s.fontVariant = 'small-caps'
  if (a.nowrap) s.whiteSpace = 'nowrap'
  return s
}
