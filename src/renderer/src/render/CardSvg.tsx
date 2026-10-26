import { useContext, useId, useLayoutEffect, useRef, useState } from 'react'
import { arrangeGroup } from '../../../shared/model/arrange'
import { smoothStops } from './smoothGradient'
import { resolveAsset } from '../../../shared/model/assets'
import {
  anchorPoint,
  hexagonPoints,
  polygonVertices,
  shapeFrame,
  roundedPolygonPath
} from '../../../shared/model/geometry'
import { useI18n } from '../i18n/context'
import { AssetsContext, ShowEmptyContext, assetUrl } from './assets'
import { fitRect, useImageSize } from './imageSize'
import { SvgBackdrop } from './backdrop'
import { backdropInner } from '../../../shared/model/shapes'
import { cropRect } from '../../../shared/model/crop'
import { gridGeometry } from '../../../shared/model/grid'
import MarkupText from './MarkupText'
import {
  isGradient,
  linearEnds,
  parseGradient,
  type Gradient
} from '../../../shared/model/gradient'
import type {
  Fade,
  GridLayer,
  GroupLayer,
  ImageLayer,
  Layer,
  LayerBase,
  ShapeLayer,
  Side,
  Stroke,
  Template,
  TextLayer
} from '../../../shared/model/template'

// Disegna una carta in SVG, in millimetri. È lo stesso disegno che userà l'esportazione PDF.

const PT_TO_MM = 25.4 / 72
/**
 * Il testo si impagina in un sistema scalato ×10 (decimi di mm): con font di pochi px
 * Chromium applica una dimensione minima e l'impaginazione sarebbe sbagliata.
 */
const TEXT_SCALE = 10

interface Props {
  template: Template
  side?: Side
  /** Pixel per millimetro */
  scale: number
  /**
   * 'trim': carta rifilata con angoli arrotondati; 'cut': rettangolo di taglio, senza angoli
   * arrotondati (stampa); 'bleed': con l'abbondanza
   */
  mode?: 'trim' | 'cut' | 'bleed'
  /** Con l'abbondanza, la linea di taglio tratteggiata; nelle esportazioni non c'è */
  guides?: boolean
  /**
   * Area in mm da disegnare intorno alla carta, nell'editor: ciò che esce dalla carta si vede
   * tenue, così un livello spostato fuori per errore si ritrova.
   */
  pasteboard?: { x: number; y: number; w: number; h: number }
}

export default function CardSvg({
  template: t,
  side = 'front',
  scale,
  mode = 'trim',
  guides = true,
  pasteboard
}: Props): React.JSX.Element {
  const uid = useId().replace(/:/g, '')
  const b = mode === 'bleed' ? t.bleed : 0
  const layers = side === 'front' ? t.front : t.back
  const vw = t.width + 2 * b
  const vh = t.height + 2 * b
  const box = pasteboard ?? { x: -b, y: -b, w: vw, h: vh }
  // 'cut' toglie solo gli angoli arrotondati: un cerchio o un esagono restano tali
  const plainRect = (t.shape ?? 'rect') === 'rect'
  return (
    <svg
      width={box.w * scale}
      height={box.h * scale}
      viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block' }}
    >
      <defs>
        <clipPath id={`${uid}-card`}>
          {mode === 'bleed' ? (
            <rect x={-b} y={-b} width={vw} height={vh} />
          ) : mode === 'cut' && plainRect ? (
            <rect width={t.width} height={t.height} />
          ) : (
            <CardOutline template={t} />
          )}
        </clipPath>
        {pasteboard && (
          <filter id={`${uid}-lift`} x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx={0} dy={0.6} stdDeviation={1} floodOpacity={0.3} />
          </filter>
        )}
      </defs>
      {pasteboard && (
        <>
          <g opacity={0.35}>
            <LayerList layers={layers} uid={`${uid}p`} />
          </g>
          {mode === 'bleed' ? (
            <rect
              x={-b}
              y={-b}
              width={vw}
              height={vh}
              fill="#FFFFFF"
              filter={`url(#${uid}-lift)`}
            />
          ) : (
            <CardOutline template={t} fill="#FFFFFF" filter={`url(#${uid}-lift)`} />
          )}
        </>
      )}
      <g clipPath={`url(#${uid}-card)`}>
        <rect x={-b} y={-b} width={vw} height={vh} fill="#FFFFFF" />
        <LayerList layers={layers} uid={uid} />
      </g>
      {mode === 'bleed' && guides && (
        <CardOutline
          template={t}
          scale={scale}
          fill="none"
          stroke="#E5484D"
          strokeWidth={0.2}
          strokeDasharray="1 0.7"
        />
      )}
    </svg>
  )
}

/**
 * Contorno della carta rifilata: rettangolo con gli angoli arrotondati, ellisse, esagono o
 * tracciato. Con inset il contorno si restringe (area sicura) o, negativo, si allarga.
 */
export function CardOutline({
  template: t,
  inset = 0,
  scale = 1,
  ...paint
}: {
  template: Template
  inset?: number
  /** Pixel per mm: serve al contorno di un tracciato, che non scala con la carta */
  scale?: number
} & React.SVGProps<SVGPathElement>): React.JSX.Element {
  // la forma si disegna nel suo riquadro, poi la trasformazione la gira e la specchia
  const frame = shapeFrame(
    t,
    inset,
    inset,
    Math.max(0, t.width - 2 * inset),
    Math.max(0, t.height - 2 * inset)
  )
  const { x, y, w, h, transform } = frame
  switch (t.shape ?? 'rect') {
    case 'ellipse':
      return (
        <ellipse
          cx={x + w / 2}
          cy={y + h / 2}
          rx={w / 2}
          ry={h / 2}
          transform={transform}
          {...(paint as React.SVGProps<SVGEllipseElement>)}
        />
      )
    case 'hexagon':
      return (
        <path
          d={`M${hexagonPoints(x, y, w, h)
            .map((p) => `${p.x} ${p.y}`)
            .join('L')}Z`}
          transform={transform}
          {...paint}
        />
      )
    case 'path':
      if (t.shapePath?.trim())
        return (
          <path
            d={t.shapePath}
            transform={`${transform ?? ''} translate(${x} ${y}) scale(${w} ${h})`.trim()}
            {...paint}
            // il tracciato è in coordinate 0-1: il tratto si misura in pixel dello schermo
            vectorEffect="non-scaling-stroke"
            strokeWidth={
              paint.strokeWidth !== undefined ? Number(paint.strokeWidth) * scale : undefined
            }
            strokeDasharray={
              typeof paint.strokeDasharray === 'string'
                ? paint.strokeDasharray
                    .split(/[\s,]+/)
                    .map((v) => Number(v) * scale)
                    .join(' ')
                : undefined
            }
          />
        )
      break
  }
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={Math.max(0, t.cornerRadius - inset)}
      transform={transform}
      {...(paint as React.SVGProps<SVGRectElement>)}
    />
  )
}

/** Il primo livello dell'elenco è quello in cima, come nel pannello livelli */
function LayerList({ layers, uid }: { layers: Layer[]; uid: string }): React.JSX.Element {
  return (
    <>
      {[...layers].reverse().map((l) => (
        <LayerView key={l.id} layer={l} uid={uid} />
      ))}
    </>
  )
}

function LayerView({ layer: l, uid }: { layer: Layer; uid: string }): React.JSX.Element | null {
  if (!l.visible || l.type === 'value') return null
  const id = `${uid}-${l.id}`
  const { x: ax, y: ay } = anchorPoint(l)
  return (
    <g
      transform={l.rotation ? `rotate(${l.rotation} ${ax} ${ay})` : undefined}
      opacity={l.opacity < 1 ? l.opacity : undefined}
      filter={l.shadow ? `url(#${id}-shadow)` : undefined}
      style={l.blend !== 'normal' ? { mixBlendMode: l.blend } : undefined}
    >
      {l.shadow && (
        <defs>
          <filter id={`${id}-shadow`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow
              dx={l.shadow.dx}
              dy={l.shadow.dy}
              stdDeviation={l.shadow.blur / 2}
              floodColor={l.shadow.color}
            />
          </filter>
        </defs>
      )}
      {l.fade && <FadeMask id={`${id}-fade`} layer={l} fade={l.fade} />}
      <g mask={l.fade ? `url(#${id}-fade)` : undefined}>
        {l.type === 'shape' && <ShapeView layer={l} id={id} />}
        {l.type === 'grid' && <GridView layer={l} id={id} uid={uid} />}
        {l.type === 'image' && <ImageView layer={l} id={id} />}
        {l.type === 'text' && <TextView layer={l} />}
        {l.type === 'group' && <GroupView layer={l} id={id} uid={uid} />}
      </g>
    </g>
  )
}

function strokeProps(
  s: Stroke | null,
  fontSizeMm?: number
): { stroke?: string; strokeWidth?: number; strokeDasharray?: string; strokeLinecap?: 'round' } {
  if (!s) return {}
  const w = strokeWidth(s, fontSizeMm)
  return { stroke: s.color, strokeWidth: w, ...dash(s, w) }
}

/** Trattini lunghi tre volte lo spessore; i punti sono trattini nulli con le estremità tonde */
function dash(s: Stroke, w: number): { strokeDasharray?: string; strokeLinecap?: 'round' } {
  if (s.dash === 'dashed') return { strokeDasharray: `${3 * w} ${2 * w}` }
  if (s.dash === 'dotted') return { strokeDasharray: `0 ${2 * w}`, strokeLinecap: 'round' }
  return {}
}

function strokeWidth(s: Stroke, fontSizeMm = 0): number {
  return typeof s.width === 'string' ? (parseFloat(s.width) / 100) * fontSizeMm : s.width
}

/**
 * Maschera della dissolvenza, nel riquadro del livello: bianco opaco mostra, trasparente
 * nasconde. Ciò che esce dal riquadro (ombre, contorni) prende l'opacità del bordo più vicino.
 */
function FadeMask({
  id,
  layer: l,
  fade: f
}: {
  id: string
  layer: LayerBase
  fade: Fade
}): React.JSX.Element {
  const stops = (
    <>
      <stop offset={f.start} stopColor="#FFFFFF" stopOpacity={f.from} />
      <stop offset={f.end} stopColor="#FFFFFF" stopOpacity={f.to} />
    </>
  )
  const pad = Math.max(l.w, l.h)
  return (
    <defs>
      {f.kind === 'linear' ? (
        <linearGradient id={`${id}-g`} gradientUnits="userSpaceOnUse" {...linearEnds(f.angle, l)}>
          {stops}
        </linearGradient>
      ) : (
        <radialGradient
          id={`${id}-g`}
          gradientUnits="userSpaceOnUse"
          cx={l.x + l.w / 2}
          cy={l.y + l.h / 2}
          r={Math.hypot(l.w, l.h) / 2}
        >
          {stops}
        </radialGradient>
      )}
      <mask
        id={id}
        maskUnits="userSpaceOnUse"
        x={l.x - pad}
        y={l.y - pad}
        width={l.w + 2 * pad}
        height={l.h + 2 * pad}
      >
        <rect
          x={l.x - pad}
          y={l.y - pad}
          width={l.w + 2 * pad}
          height={l.h + 2 * pad}
          fill={`url(#${id}-g)`}
        />
      </mask>
    </defs>
  )
}

/** Sfumatura di un riempimento, nel riquadro dato */
function GradientDef({
  id,
  gradient: g,
  box
}: {
  id: string
  gradient: Gradient
  box: { x: number; y: number; w: number; h: number }
}): React.JSX.Element {
  const stops = smoothStops(g.stops).map((s, i) => (
    <stop
      key={i}
      offset={s.at}
      stopColor={s.color}
      stopOpacity={s.opacity < 1 ? s.opacity : undefined}
    />
  ))
  return (
    <defs>
      {g.kind === 'linear' ? (
        <linearGradient id={id} gradientUnits="userSpaceOnUse" {...linearEnds(g.angle, box)}>
          {stops}
        </linearGradient>
      ) : (
        <radialGradient
          id={id}
          gradientUnits="userSpaceOnUse"
          cx={box.x + box.w / 2}
          cy={box.y + box.h / 2}
          r={Math.hypot(box.w, box.h) / 2}
        >
          {stops}
        </radialGradient>
      )}
    </defs>
  )
}

function ShapeView({ layer: l, id }: { layer: ShapeLayer; id: string }): React.JSX.Element {
  const gradient = isGradient(l.fill) ? parseGradient(l.fill) : null
  // il tracciato è in coordinate 0-1: la sfumatura si calcola nello stesso spazio
  const def = gradient && (
    <GradientDef
      id={`${id}-fill`}
      gradient={gradient}
      box={l.shape === 'path' ? { x: 0, y: 0, w: 1, h: 1 } : l}
    />
  )
  const fill = gradient ? `url(#${id}-fill)` : (l.fill ?? 'none')
  return (
    <>
      {def}
      <ShapeBody layer={l} fill={fill} />
    </>
  )
}

function ShapeBody({ layer: l, fill }: { layer: ShapeLayer; fill: string }): React.JSX.Element {
  const paint = { fill, ...strokeProps(l.stroke) }
  switch (l.shape) {
    case 'ellipse':
      return <ellipse cx={l.x + l.w / 2} cy={l.y + l.h / 2} rx={l.w / 2} ry={l.h / 2} {...paint} />
    case 'polygon':
    case 'star':
      return (
        <path
          d={roundedPolygonPath(polygonVertices(l), l.radius)}
          strokeLinejoin="round"
          {...paint}
        />
      )
    case 'line':
      return (
        <line
          x1={l.x}
          y1={l.y + l.h / 2}
          x2={l.x + l.w}
          y2={l.y + l.h / 2}
          {...strokeProps(
            l.stroke ?? { color: isGradient(l.fill) ? '#000' : (l.fill ?? '#000'), width: 0.3 }
          )}
        />
      )
    case 'path': {
      // il tracciato è in coordinate 0-1: lo spessore si riporta in mm dividendo per la scala
      const sw = l.stroke ? l.stroke.width : 0
      const k = (l.w + l.h) / 2
      return (
        <path
          d={l.path}
          transform={`translate(${l.x} ${l.y}) scale(${l.w} ${l.h})`}
          fill={fill}
          stroke={l.stroke?.color}
          strokeWidth={typeof sw === 'number' ? sw / k : undefined}
          {...(l.stroke && typeof sw === 'number' ? dash(l.stroke, sw / k) : {})}
        />
      )
    }
    default:
      return <rect x={l.x} y={l.y} width={l.w} height={l.h} rx={l.radius} {...paint} />
  }
}

/** Riempimento, a tinta unita o sfumato sul riquadro del livello */
function paintOf(
  color: string | null,
  id: string,
  box: { x: number; y: number; w: number; h: number }
): { fill: string; def: React.JSX.Element | null } {
  const gradient = color && isGradient(color) ? parseGradient(color) : null
  if (!gradient) return { fill: color ?? 'none', def: null }
  return { fill: `url(#${id})`, def: <GradientDef id={id} gradient={gradient} box={box} /> }
}

/** Griglia di caselle: lo sfondo col bordo, poi le caselle; vedi model/grid.ts */
/**
 * Griglia di caselle: lo sfondo col bordo, le caselle, poi il contenuto di ogni casella (il
 * gruppo scelto, legato alla casella e spostato dalla prima casella alla sua)
 */
function GridView({
  layer: l,
  id,
  uid
}: {
  layer: GridLayer
  id: string
  uid: string
}): React.JSX.Element {
  const { cells, bounds: b, centers } = gridGeometry(l)
  const first = centers[0]
  // tutto si disegna spostato nell'angolo del livello: sfumature e ritaglio partono da 0, 0
  const box = { x: 0, y: 0, w: l.w, h: l.h }
  const back = paintOf(l.background, `${id}-bg`, box)
  const cell = paintOf(l.fill, `${id}-fill`, box)
  const r = Math.max(0, Math.min(l.backgroundRadius, b.w / 2, b.h / 2))
  return (
    <>
      {back.def}
      {cell.def}
      {l.clip && (
        <defs>
          <clipPath id={`${id}-clip`}>
            <rect x={l.x} y={l.y} width={l.w} height={l.h} />
          </clipPath>
        </defs>
      )}
      <g clipPath={l.clip ? `url(#${id}-clip)` : undefined}>
        <g transform={`translate(${l.x} ${l.y})`}>
          {(l.background || l.border) && (
            <rect
              x={b.x}
              y={b.y}
              width={b.w}
              height={b.h}
              rx={r || undefined}
              fill={back.fill}
              {...strokeProps(l.border)}
            />
          )}
          {(l.fill || l.stroke) && (
            <path
              d={cells.join('')}
              fill={cell.fill}
              strokeLinejoin="round"
              {...strokeProps(l.stroke)}
            />
          )}
        </g>
        {first &&
          l.cells?.map((content, i) => {
            const c = centers[i]
            if (!c) return null
            return (
              <g key={i} transform={`translate(${c.x - first.x} ${c.y - first.y})`}>
                <LayerView layer={content} uid={`${uid}-${l.id}-c${i}`} />
              </g>
            )
          })}
      </g>
    </>
  )
}

const PRESERVE: Record<ImageLayer['fit'], string> = {
  cover: 'xMidYMid slice',
  overflow: 'xMidYMid slice',
  contain: 'xMidYMid meet',
  stretch: 'none',
  original: 'xMidYMid meet',
  tile: 'xMidYMid meet'
}

/** Ingrandisce o riduce il riquadro dell'immagine intorno al centro */
function zoomRect<B extends { x: number; y: number; w: number; h: number }>(
  r: B,
  zoom: number
): { x: number; y: number; w: number; h: number } {
  if (zoom === 1 || !(zoom > 0)) return r
  const w = r.w * zoom
  const h = r.h * zoom
  return { x: r.x + (r.w - w) / 2, y: r.y + (r.h - h) / 2, w, h }
}

function ImageView({ layer, id }: { layer: ImageLayer; id: string }): React.JSX.Element | null {
  // con lo sfondo di una variabile l'immagine sta nel quadrato interno, sopra la forma
  const l = layer.backdrop ? { ...layer, ...backdropInner(layer, layer.backdrop) } : layer
  const view = <ImageBody layer={l} id={id} />
  if (!layer.backdrop) return view
  return (
    <g>
      <SvgBackdrop box={layer} backdrop={layer.backdrop} />
      {view}
    </g>
  )
}

function ImageBody({ layer: l, id }: { layer: ImageLayer; id: string }): React.JSX.Element | null {
  const assets = useContext(AssetsContext)
  const { t } = useI18n()
  const showEmpty = useContext(ShowEmptyContext)
  const res = resolveAsset(l.src, assets)
  const natural = useImageSize(res.ok ? assetUrl(res.path) : null)
  // il ritaglio prende una parte dell'immagine, che poi si adatta come se fosse l'immagine intera
  const crop = natural ? cropRect(l.crop) : null
  const size =
    natural && crop ? { ...natural, w: natural.w * crop.w, h: natural.h * crop.h } : natural
  if (!res.ok) {
    if (res.reason === 'empty' && showEmpty) return <Placeholder layer={l} label={l.name} />
    if (l.missing === 'hide' || res.reason === 'empty') return null
    // nel template il nome viene spesso da un campo: si mostra il campo, non un errore
    if (/\{[^}]+\}/.test(l.src)) return <Placeholder layer={l} label={l.src} />
    const key = res.reason === 'ambiguous' ? 'asset.ambiguous' : 'asset.missing'
    return <Placeholder layer={l} label={t(key, { name: l.src })} />
  }
  // senza le dimensioni il ritaglio non si può applicare: meglio niente che l'immagine intera
  if (l.crop && !natural) return null
  // l'immagine ruotata si adatta al riquadro con l'ingombro che ha da ruotata
  const angle = l.imageRotation % 360
  const rad = (angle * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  const turned =
    size && angle
      ? { ...size, w: size.w * cos + size.h * sin, h: size.w * sin + size.h * cos }
      : size
  // finché non si conoscono le dimensioni si lascia fare a preserveAspectRatio
  // "riempi" ruotato: l'immagine deve contenere il riquadro, cioè coprire l'ingombro del
  // riquadro ruotato all'indietro; "adatta" usa invece l'ingombro dell'immagine ruotata
  const fitted =
    turned && size && angle && (l.fit === 'cover' || l.fit === 'overflow')
      ? fitRect(
          l,
          {
            ...turned,
            mmPerUnit: Math.max((l.w * cos + l.h * sin) / size.w, (l.w * sin + l.h * cos) / size.h)
          },
          'original',
          l.align
        )
      : turned
        ? fitRect(l, turned, l.fit, l.align)
        : l
  const z = zoomRect(fitted, l.zoom)
  const r = { ...z, x: z.x + l.offsetX, y: z.y + l.offsetY }
  const cx = r.x + r.w / 2
  const cy = r.y + r.h / 2
  // dentro l'ingombro ruotato l'immagine ha le sue proporzioni (tranne con "deforma")
  const k = size && turned && l.fit !== 'stretch' ? r.w / turned.w : 0
  const iw = k ? size!.w * k : r.w
  const ih = k ? size!.h * k : r.h
  const rect = angle
    ? { x: cx - iw / 2, y: cy - ih / 2, width: iw, height: ih }
    : { x: r.x, y: r.y, width: r.w, height: r.h }
  const turn = angle ? `rotate(${angle} ${cx} ${cy})` : undefined
  const flip =
    l.flipH || l.flipV
      ? `translate(${l.flipH ? 2 * l.x + l.w : 0} ${l.flipV ? 2 * l.y + l.h : 0}) scale(${l.flipH ? -1 : 1} ${l.flipV ? -1 : 1})`
      : undefined
  const adjusted =
    l.grayscale || l.brightness !== 1 || l.contrast !== 1 || l.saturation !== 1 || !!l.tint
  const filter = adjusted ? `url(#${id}-fx)` : undefined
  const tile = l.fit === 'tile' && size
  const place = tile ? { x: 0, y: 0, width: r.w, height: r.h } : rect
  const image =
    crop && natural ? (
      // la parte ritagliata è il viewBox di un svg annidato che contiene l'immagine intera
      <g filter={tile ? undefined : filter}>
        <svg
          {...place}
          viewBox={`${crop.x * natural.w} ${crop.y * natural.h} ${crop.w * natural.w} ${crop.h * natural.h}`}
          preserveAspectRatio="none"
          overflow="hidden"
        >
          <image
            href={assetUrl(res.path)}
            width={natural.w}
            height={natural.h}
            preserveAspectRatio="none"
          />
        </svg>
      </g>
    ) : (
      <image
        href={assetUrl(res.path)}
        {...place}
        preserveAspectRatio={size ? 'none' : PRESERVE[l.fit]}
        filter={tile ? undefined : filter}
      />
    )
  return (
    <>
      <defs>
        <clipPath id={`${id}-clip`}>
          <rect x={l.x} y={l.y} width={l.w} height={l.h} rx={l.radius} />
        </clipPath>
        {adjusted && <ImageFilter id={`${id}-fx`} layer={l} />}
        {tile && (
          // la piastrella parte dalla posizione dell'immagine allineata e si ripete in ogni verso
          <pattern
            id={`${id}-tile`}
            patternUnits="userSpaceOnUse"
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            patternTransform={turn}
          >
            {image}
          </pattern>
        )}
      </defs>
      {/* "lascia uscire": la parte fuori dal riquadro resta visibile (la carta ritaglia comunque) */}
      <g clipPath={l.fit === 'overflow' ? undefined : `url(#${id}-clip)`}>
        {tile ? (
          <rect
            x={l.x}
            y={l.y}
            width={l.w}
            height={l.h}
            fill={`url(#${id}-tile)`}
            transform={flip}
            filter={filter}
          />
        ) : (
          <g transform={flip}>
            <g transform={turn}>{image}</g>
          </g>
        )}
      </g>
      {l.stroke && (
        <rect
          x={l.x}
          y={l.y}
          width={l.w}
          height={l.h}
          rx={l.radius}
          fill="none"
          {...strokeProps(l.stroke)}
        />
      )}
    </>
  )
}

/**
 * Regolazioni dell'immagine e tinta, in quest'ordine: saturazione (zero per la scala di
 * grigi), luminosità e contrasto, poi la tinta che ricolora mantenendo la trasparenza. La tinta
 * si stende sopra l'immagine: piena la ricolora del tutto, semitrasparente (#00000033) la
 * scurisce o la colora solo in parte, e l'immagine resta opaca.
 */
function ImageFilter({ id, layer: l }: { id: string; layer: ImageLayer }): React.JSX.Element {
  const sat = l.grayscale ? 0 : l.saturation
  const slope = l.brightness * l.contrast
  const intercept = 0.5 - 0.5 * l.contrast
  return (
    <filter id={id} colorInterpolationFilters="sRGB">
      {sat !== 1 && <feColorMatrix type="saturate" values={String(sat)} result="adjusted" />}
      {(l.brightness !== 1 || l.contrast !== 1) && (
        <feComponentTransfer result="adjusted">
          <feFuncR type="linear" slope={slope} intercept={intercept} />
          <feFuncG type="linear" slope={slope} intercept={intercept} />
          <feFuncB type="linear" slope={slope} intercept={intercept} />
        </feComponentTransfer>
      )}
      {l.tint && (
        <>
          <feFlood floodColor={l.tint} />
          <feComposite in2="SourceAlpha" operator="in" />
          <feComposite
            in2={sat !== 1 || l.brightness !== 1 || l.contrast !== 1 ? 'adjusted' : 'SourceGraphic'}
            operator="over"
          />
        </>
      )}
    </filter>
  )
}

function Placeholder({ layer: l, label }: { layer: LayerBase; label: string }): React.JSX.Element {
  return (
    <g>
      <rect
        x={l.x}
        y={l.y}
        width={l.w}
        height={l.h}
        fill="#E9E4DA"
        stroke="#B3A994"
        strokeWidth={0.2}
        strokeDasharray="1 0.6"
      />
      <text
        x={l.x + l.w / 2}
        y={l.y + l.h / 2}
        fontSize={Math.min(2.4, l.h / 3)}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#6B6255"
        fontFamily="monospace"
      >
        {label}
      </text>
    </g>
  )
}

const VALIGN: Record<TextLayer['valign'], string> = {
  top: 'flex-start',
  middle: 'center',
  bottom: 'flex-end'
}

/**
 * Il contenuto disegnato (testo e immagini) esce dall'area del riquadro? scrollHeight conta
 * l'altezza di riga intera: un'icona grande in una riga alta "esce" anche se si vede tutta.
 * Qui si guardano i rettangoli dei caratteri e delle immagini, riportati nelle coordinate del
 * foreignObject; con rotazioni non multiple di 90° sono un po' più larghi del vero.
 */
function inkOverflows(fo: SVGForeignObjectElement, box: HTMLElement, inner: HTMLElement): boolean {
  const ctm = fo.getScreenCTM()
  if (!ctm) return true
  const back = ctm.inverse()
  const cs = getComputedStyle(box)
  const left = parseFloat(cs.paddingLeft) - 1.5
  const top = parseFloat(cs.paddingTop) - 1.5
  const right = box.clientWidth - parseFloat(cs.paddingRight) + 1.5
  const bottom = box.clientHeight - parseFloat(cs.paddingBottom) + 1.5
  const outside = (r: DOMRect): boolean => {
    if (!r.width && !r.height) return false
    for (const [x, y] of [
      [r.left, r.top],
      [r.right, r.top],
      [r.left, r.bottom],
      [r.right, r.bottom]
    ]) {
      const q = new DOMPoint(x, y).matrixTransform(back)
      if (q.x < left || q.x > right || q.y < top || q.y > bottom) return true
    }
    return false
  }
  const range = document.createRange()
  const walk = document.createTreeWalker(inner, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      if (!n.textContent?.trim()) continue
      range.selectNodeContents(n)
      for (const r of range.getClientRects()) if (outside(r)) return true
    } else if (
      (n as Element).childNodes.length === 0 &&
      outside((n as Element).getBoundingClientRect())
    )
      return true
  }
  return false
}

function TextView({ layer: l }: { layer: TextLayer }): React.JSX.Element {
  const showEmpty = useContext(ShowEmptyContext)
  const empty = showEmpty && !l.text.trim()
  const boxRef = useRef<HTMLDivElement>(null)
  const [fitted, setFitted] = useState<{ key: string; size: number } | null>(null)
  const fitKey = `${l.text}|${l.size}|${l.w}|${l.h}|${l.font}|${l.weight}|${l.italic}|${l.lineHeight}|${l.fit}|${l.padding}|${l.paddingSides}|${l.indent}|${l.wrap}|${l.letterSpacing}|${l.transform}|${l.align}|${l.stroke?.width ?? ''}`
  const size = fitted && fitted.key === fitKey ? fitted.size : l.size

  // "riduci per stare nel riquadro": si scende di mezzo punto finché il testo non sta
  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el || l.fit !== 'shrink') return
    const overflows =
      el.scrollHeight > el.clientHeight + 0.5 || el.scrollWidth > el.clientWidth + 0.5
    if (overflows && size - 0.5 >= l.minSize) setFitted({ key: fitKey, size: size - 0.5 })
  }, [fitKey, size, l.fit, l.minSize])

  // testo che non sta nel riquadro, anche dopo averlo ridotto: lo segnala data-overflow, che
  // la griglia e il controllo dei testi leggono; si rimisura quando cambiano font e immagini
  const [over, setOver] = useState(false)
  useLayoutEffect(() => {
    const el = boxRef.current
    const inner = el?.firstElementChild as HTMLElement | null
    if (!el || !inner) return
    const measure = (): void => {
      const cs = getComputedStyle(el)
      const h = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
      const w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      const overflows =
        (inner.scrollHeight > h + 1.5 || inner.scrollWidth > w + 1.5) &&
        inkOverflows(el.parentElement as unknown as SVGForeignObjectElement, el, inner)
      setOver(!empty && overflows && (l.fit !== 'shrink' || size - 0.5 < l.minSize))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(inner)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fitKey, size, l.fit, l.minSize, empty])

  const sizeMm = size * PT_TO_MM
  const s = TEXT_SCALE
  return (
    <g
      transform={`translate(${l.x} ${l.y}) scale(${1 / s})`}
      data-overflow={over ? l.name : undefined}
    >
      <foreignObject
        width={l.w * s}
        height={l.h * s}
        overflow={l.fit === 'none' ? 'visible' : 'hidden'}
      >
        <div
          ref={boxRef}
          style={{
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            padding: l.paddingSides
              ? l.paddingSides.map((p) => `${p * s}px`).join(' ')
              : l.padding * s,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: VALIGN[l.valign],
            // "esce dal riquadro" lascia vedere il testo in eccesso, le altre modalità lo tagliano
            overflow: l.fit === 'none' ? 'visible' : 'hidden',
            fontFamily: `'${l.font}', sans-serif`,
            fontWeight: l.weight,
            fontStyle: l.italic ? 'italic' : 'normal',
            fontSize: sizeMm * s,
            lineHeight: l.lineHeight,
            letterSpacing: `${l.letterSpacing / 1000}em`,
            // le immagini nel testo non seguono letter-spacing: la ricevono come margine
            ['--gc-ls' as string]: `${(l.letterSpacing / 1000) * sizeMm * s}px`,
            color: l.color,
            textAlign: l.align,
            textTransform:
              l.transform === 'upper'
                ? 'uppercase'
                : l.transform === 'lower'
                  ? 'lowercase'
                  : l.transform,
            textIndent: l.indent ? l.indent * s : undefined,
            textDecorationLine:
              [l.underline && 'underline', l.strike && 'line-through'].filter(Boolean).join(' ') ||
              undefined,
            whiteSpace: l.wrap ? 'pre-wrap' : 'pre',
            overflowWrap: l.wrap ? 'break-word' : 'normal',
            WebkitTextStroke: l.stroke
              ? `${strokeWidth(l.stroke, sizeMm) * 2 * s}px ${l.stroke.color}`
              : undefined,
            paintOrder: 'stroke fill'
          }}
        >
          <div style={empty ? { opacity: 0.35, fontStyle: 'italic' } : undefined}>
            {empty ? (
              <p style={{ margin: 0 }}>{l.name}</p>
            ) : (
              <MarkupText
                text={l.text}
                unit={s}
                ratio={size / l.size}
                paragraphSpacing={l.paragraphSpacing}
              />
            )}
          </div>
        </div>
      </foreignObject>
    </g>
  )
}

/**
 * Con "ritaglia" il livello in fondo al gruppo fa da maschera: non si disegna e i livelli
 * sopra si vedono solo dentro la sua forma.
 */
function GroupView({
  layer: group,
  id,
  uid
}: {
  layer: GroupLayer
  id: string
  uid: string
}): React.JSX.Element {
  const l = arrangeGroup(group)
  const mask = l.clip ? l.children[l.children.length - 1] : undefined
  if (!mask || group.children.length < 2) return <LayerList layers={l.children} uid={uid} />
  const a = anchorPoint(mask)
  return (
    <>
      <defs>
        {/* dentro clipPath non sono ammessi i <g>: la rotazione va sul clipPath */}
        <clipPath
          id={`${id}-clip`}
          transform={mask.rotation ? `rotate(${mask.rotation} ${a.x} ${a.y})` : undefined}
        >
          {mask.type === 'shape' && mask.shape !== 'line' ? (
            <ShapeBody layer={mask} fill="#000" />
          ) : (
            <rect x={mask.x} y={mask.y} width={mask.w} height={mask.h} />
          )}
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-clip)`}>
        <LayerList layers={l.children.slice(0, -1)} uid={uid} />
      </g>
    </>
  )
}
