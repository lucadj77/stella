import type { ProjectMeta } from '../../../shared/model/system'
import { useContext, useId } from 'react'
import type { LoadedSet } from '../../../shared/project'
import type { Template } from '../../../shared/model/template'
import { anatomyCardSource } from '../../../shared/model/document'
import { arrowCurve, type Setup, type SetupItem } from '../../../shared/model/setup'
import { resolveAsset } from '../../../shared/model/assets'
import { backdropInner, imageBackdrop } from '../../../shared/model/shapes'
import {
  imageStrokeWidth,
  imageVariable,
  palette,
  resolveColor
} from '../../../shared/model/variables'
import { SvgBackdrop } from './backdrop'
import { TextOutline } from './outline'
import CardSvg, { CardOutline } from './CardSvg'
import Edged from './Edged'
import { MarkupInline } from './MarkupText'
import { AssetsContext, VariablesContext, assetUrl } from './assets'
import { useBoundCard } from './useBoundCard'
import {
  DECK_LAYERS,
  DECK_STEP,
  itemCardSize,
  SETUP_LINE as LINE,
  textHeight,
  type Box,
  type SetupView
} from './setupGeometry'

// Schema della preparazione del tavolo (```setup, model/setup.ts): zone, carte, mazzi, testi,
// frecce e immagini su un'area in mm. È un unico SVG, come l'anatomia: l'esportazione lo tratta
// come una carta. L'editor dello schema lo usa per disegnare e aggiunge le sue maniglie.

const INK = '#3a3a3c'
/** Ingrandimento dei testi dentro il foreignObject */
const ZOOM = 10
/** Alone sotto le frecce, per staccarle dalle parti scure di carte e plance */
const HALO = '#ffffff'
const ZONE = '#8e8e93'
export default function SetupDiagram({
  setup,
  view,
  sets,
  templates,
  project,
  unit,
  maxWidth,
  width,
  svgRef,
  children
}: {
  setup: Setup
  view: SetupView
  sets: LoadedSet[]
  templates: Template[]
  project?: string | ProjectMeta
  /** Pixel per mm */
  unit: number
  /** Larghezza del testo della pagina in mm */
  maxWidth: number
  /** Larghezza in pixel, per l'editor; di base quella che sta nella pagina */
  width?: number
  svgRef?: React.Ref<SVGSVGElement>
  /** Disegni sopra lo schema, nelle sue coordinate: le maniglie dell'editor */
  children?: React.ReactNode
}): React.JSX.Element {
  const { area, boxes, font } = view
  const px = width ?? Math.min(area.w, maxWidth) * unit
  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      width={px}
      height={(px * area.h) / area.w}
      viewBox={`${area.x} ${area.y} ${area.w} ${area.h}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {setup.size && (
        <rect
          x={0}
          y={0}
          width={setup.size.w}
          height={setup.size.h}
          rx={4}
          fill="none"
          stroke="#c8c8c2"
          strokeWidth={0.3}
        />
      )}
      {/* le zone sotto, poi carte e immagini, testi e frecce sopra */}
      {setup.items.map((it, i) =>
        it.kind === 'zone' ? <Item key={i} i={i} it={it} font={font} /> : null
      )}
      {setup.items.map((it, i) =>
        it.kind === 'card' || it.kind === 'deck' ? (
          <CardItem
            key={i}
            i={i}
            it={it}
            box={boxes[i]}
            font={font}
            sets={sets}
            templates={templates}
            project={project}
            scale={px / unit / area.w}
          />
        ) : it.kind === 'image' ? (
          <Item key={i} i={i} it={it} font={font} />
        ) : null
      )}
      {setup.items.map((it, i) =>
        it.kind === 'text' || it.kind === 'arrow' ? (
          <Item key={i} i={i} it={it} font={font} />
        ) : null
      )}
      {children}
    </svg>
  )
}

/** Un testo con il markup in un riquadro, centrato, a sinistra o a destra */
function Label({
  x,
  y,
  w,
  font,
  text,
  align = 'center',
  background
}: {
  x: number
  y: number
  w: number
  font: number
  text: string
  align?: 'left' | 'center' | 'right'
  background?: boolean
}): React.JSX.Element {
  // la posizione sta nel gruppo: l'esportazione in SVG converte il foreignObject da sé
  return (
    // il testo si impagina 10 volte più grande e si riduce: con un corpo di 3-4 px il browser lo
    // ingrandirebbe fino al suo minimo
    <g transform={`translate(${x} ${y}) scale(${1 / ZOOM})`}>
      <foreignObject
        width={w * ZOOM}
        height={font * LINE * 6 * ZOOM}
        // il riquadro è alto sei righe: fuori dalle parole il clic passa a ciò che sta sotto
        style={{ overflow: 'visible', pointerEvents: 'none' }}
      >
        <div style={{ fontSize: font * ZOOM, lineHeight: LINE, textAlign: align }}>
          <span
            style={{
              pointerEvents: 'auto',
              ...(background
                ? { background: 'rgba(255,255,255,0.85)', padding: `0 ${font * 0.3 * ZOOM}px` }
                : {})
            }}
          >
            <MarkupInline text={text} unit={ZOOM} />
          </span>
        </div>
      </foreignObject>
    </g>
  )
}

function CardItem({
  i,
  it,
  box,
  font,
  sets,
  templates,
  project,
  scale
}: {
  i: number
  it: Extract<SetupItem, { kind: 'card' | 'deck' }>
  box: Box
  font: number
  sets: LoadedSet[]
  templates: Template[]
  project?: string | ProjectMeta
  /** mm della pagina per un mm del tavolo: il filo attorno alle carte resta sottile uguale */
  scale: number
}): React.JSX.Element {
  const card = useBoundCard(anatomyCardSource(it.card), sets, templates, project)
  const layers = it.kind === 'deck' ? Math.min(it.count, DECK_LAYERS + 1) - 1 : 0
  const extra = layers * DECK_STEP
  // misure della carta dritta
  const { w: cw, h: ch } = itemCardSize(it.card, sets, templates)
  const t = card?.template
  const k = t ? cw / t.width : 1
  // il contorno segue la forma della carta: una moneta tonda resta tonda anche nel mazzo
  const outline = (paint: React.SVGProps<SVGPathElement>): React.JSX.Element =>
    t ? (
      <g transform={`scale(${k})`}>
        <CardOutline template={t} {...paint} scale={k} strokeWidth={0.25 / scale / k} />
      </g>
    ) : (
      <rect width={cw} height={ch} rx={3} {...(paint as React.SVGProps<SVGRectElement>)} />
    )
  const face = t ? (
    // un filo attorno alla carta, perché una faccia chiara non si perda sul foglio
    <Edged unit={scale}>
      <CardSvg template={t} side={card.ref.side} scale={k} />
    </Edged>
  ) : (
    <rect width={cw} height={ch} rx={3} fill="#f3f3f0" stroke="#e5484d" strokeDasharray="2 1" />
  )
  // la carta ruota attorno al suo centro, dentro il riquadro girato
  const vw = box.w - extra
  const vh = box.h - extra
  const rotated = (dx: number): string =>
    `translate(${it.x + dx + vw / 2} ${it.y + dx + vh / 2}) rotate(${it.rotate}) translate(${-cw / 2} ${-ch / 2})`
  return (
    <g data-item={i}>
      {Array.from({ length: layers }, (_, k) => (
        <g key={k} transform={rotated((layers - k) * DECK_STEP)}>
          {outline({ fill: '#ffffff', stroke: '#000000', strokeOpacity: 0.6 })}
        </g>
      ))}
      <g transform={rotated(0)}>{face}</g>
      {it.label && (
        <Label x={box.x - 15} y={box.y + box.h + 1} w={box.w + 30} font={font} text={it.label} />
      )}
    </g>
  )
}

function Item({
  i,
  it,
  font
}: {
  i: number
  it: SetupItem
  font: number
}): React.JSX.Element | null {
  switch (it.kind) {
    case 'zone':
      return (
        <g data-item={i}>
          <rect
            x={it.x}
            y={it.y}
            width={it.w}
            height={it.h}
            rx={3}
            fill="rgba(0,0,0,0.035)"
            stroke={ZONE}
            strokeWidth={0.3}
            strokeDasharray="1.5 1"
          />
          {it.label && (
            <Label
              x={it.x + 2}
              y={it.y + 1.2}
              w={Math.max(10, it.w - 4)}
              font={font * 0.9}
              text={`**${it.label}**`}
              align="left"
            />
          )}
        </g>
      )
    case 'text':
      return (
        <g data-item={i}>
          {/* il riquadro del testo, righe comprese, si sceglie con un clic anche tra le parole */}
          <rect
            x={it.x}
            y={it.y}
            width={it.w}
            height={textHeight(it.text, it.w, font)}
            fill="transparent"
          />
          <Label x={it.x} y={it.y} w={it.w} font={font} text={it.text} align={it.align} />
        </g>
      )
    case 'image':
      return <ImageItem i={i} it={it} />
    case 'arrow': {
      const { control: c, mid } = arrowCurve(it)
      const k = it.size ?? 1
      // lo spessore scritto vale da solo; senza, segue la misura come le punte
      const line = it.thickness ?? 0.5 * k
      const heads = it.heads ?? 'end'
      const atEnd = heads === 'end' || heads === 'both'
      const atStart = heads === 'start' || heads === 'both'
      const p0 = { x: it.x, y: it.y }
      const p2 = { x: it.x2, y: it.y2 }
      const len = quadLength(it, c)
      // la punta cresce con la linea, così una linea spessa non la copre
      const head = Math.min(Math.max(3.5 * k, line * 2.5), len / (atStart && atEnd ? 3 : 2))
      const at = (t: number): { x: number; y: number } => {
        const u = 1 - t
        return {
          x: u * u * p0.x + 2 * u * t * c.x + t * t * p2.x,
          y: u * u * p0.y + 2 * u * t * c.y + t * t * p2.y
        }
      }
      /** Il parametro del punto della curva a `dist` mm (in linea d'aria) da un estremo */
      const reach = (fromEnd: boolean, dist: number): number => {
        const end = fromEnd ? p2 : p0
        let lo = 0
        let hi = 0.5
        for (let n = 0; n < 30; n++) {
          const m = (lo + hi) / 2
          const q = at(fromEnd ? 1 - m : m)
          if (Math.hypot(q.x - end.x, q.y - end.y) < dist) lo = m
          else hi = m
        }
        return fromEnd ? 1 - lo : lo
      }
      // la punta va dall'estremo al punto della curva distante quanto è lunga; la linea entra un po'
      // dentro la punta, così non resta uno spazio tra le due quando la curva è stretta
      const a = atStart ? reach(false, head * 0.6) : 0
      const b = atEnd ? reach(true, head * 0.6) : 1
      const blossom = (u: number, v: number): { x: number; y: number } => ({
        x: (1 - u) * (1 - v) * p0.x + ((1 - u) * v + u * (1 - v)) * c.x + u * v * p2.x,
        y: (1 - u) * (1 - v) * p0.y + ((1 - u) * v + u * (1 - v)) * c.y + u * v * p2.y
      })
      const s0 = blossom(a, a)
      const s1 = blossom(a, b)
      const s2 = blossom(b, b)
      const d = `M${s0.x},${s0.y} Q${s1.x},${s1.y} ${s2.x},${s2.y}`
      // una punta in `tip`, nella direzione da `from`
      const tipAt = (tip: { x: number; y: number }, from: { x: number; y: number }): string => {
        const dx = tip.x - from.x
        const dy = tip.y - from.y
        const l = Math.hypot(dx, dy) || 1
        const ux = dx / l
        const uy = dy / l
        const bx = tip.x - ux * head
        const by = tip.y - uy * head
        const w = head * 0.55
        return `${tip.x},${tip.y} ${bx - uy * w},${by + ux * w} ${bx + uy * w},${by - ux * w}`
      }
      // la punta segue la corda fino al punto della curva alla sua base: resta allineata alla linea
      const tips = [
        ...(atEnd ? [tipAt(p2, at(reach(true, head)))] : []),
        ...(atStart ? [tipAt(p0, at(reach(false, head)))] : [])
      ]
      return (
        <g data-item={i}>
          {/* una fascia invisibile larga qualche mm: la freccia si prende anche senza mirare */}
          <path
            d={`M${p0.x},${p0.y} Q${c.x},${c.y} ${p2.x},${p2.y}`}
            fill="none"
            stroke="transparent"
            strokeWidth={Math.max(3, line * 3)}
            pointerEvents="stroke"
          />
          {/* alone chiaro sotto la freccia: resta visibile anche sopra carte e plance scure */}
          <g stroke={HALO} strokeOpacity={0.85} strokeLinecap="round" strokeLinejoin="round">
            <path d={d} fill="none" strokeWidth={line * 1.8 + 0.5} />
            {tips.map((tip, n) => (
              <polygon key={n} points={tip} fill={HALO} fillOpacity={0.85} strokeWidth={0.9} />
            ))}
          </g>
          <path d={d} fill="none" stroke={INK} strokeWidth={line} strokeLinecap="round" />
          {tips.map((tip, n) => (
            <polygon key={n} points={tip} fill={INK} />
          ))}
          {it.label && (
            <Label
              x={mid.x - 25}
              y={mid.y - (font * LINE) / 2}
              w={50}
              font={font}
              text={it.label}
              background
            />
          )}
        </g>
      )
    }
    default:
      return null
  }
}

/**
 * Un'immagine o una variabile immagine, con la sua tinta, rotazione, ribaltamento, opacità e il
 * suo sfondo
 */
function ImageItem({
  i,
  it
}: {
  i: number
  it: Extract<SetupItem, { kind: 'image' }>
}): React.JSX.Element {
  const assets = useContext(AssetsContext)
  const variables = useContext(VariablesContext)
  const id = useId().replace(/:/g, '')
  const name = it.src.replace(/^\{(.*)\}$/, '$1')
  const v = imageVariable(name, variables)
  const r = resolveAsset(v ? v.src : name, assets)
  const c = { x: it.x + it.w / 2, y: it.y + it.w / 2 }
  const box = { x: it.x, y: it.y, w: it.w, h: it.w }
  const backdrop = imageBackdrop(v, variables)
  const inner = backdrop ? backdropInner(box, backdrop) : box
  const tint = v?.tint ? resolveColor(v.tint, palette(variables)) : null
  // il contorno della variabile, in mm o in % del lato dell'immagine
  const outline = v?.stroke ? imageStrokeWidth(v.stroke, it.w) : 0
  const flip = v?.flip
  const turn = [
    v?.rotate ? `rotate(${v.rotate} ${c.x} ${c.y})` : '',
    flip
      ? `translate(${flip.includes('h') ? 2 * c.x : 0} ${flip.includes('v') ? 2 * c.y : 0}) scale(${flip.includes('h') ? -1 : 1} ${flip.includes('v') ? -1 : 1})`
      : ''
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <g
      data-item={i}
      transform={it.rotate ? `rotate(${it.rotate} ${c.x} ${c.y})` : undefined}
      opacity={v?.opacity !== undefined && v.opacity < 1 ? v.opacity : undefined}
    >
      {r.ok ? (
        <>
          {/* un riquadro trasparente: l'immagine si sceglie anche cliccando dove è vuota */}
          <rect x={it.x} y={it.y} width={it.w} height={it.w} fill="transparent" />
          {outline > 0 && v?.stroke && (
            <defs>
              <filter
                id={`${id}-outline`}
                x="-100%"
                y="-100%"
                width="300%"
                height="300%"
                primitiveUnits="userSpaceOnUse"
              >
                <TextOutline
                  r={outline}
                  color={resolveColor(v.stroke.color, palette(variables))}
                  soft={outline * 0.3}
                />
              </filter>
            </defs>
          )}
          <g filter={outline > 0 ? `url(#${id}-outline)` : undefined}>
            {backdrop && <SvgBackdrop box={box} backdrop={backdrop} />}
            {tint && (
              <defs>
                <filter id={`${id}-tint`}>
                  <feFlood floodColor={tint} />
                  <feComposite in2="SourceAlpha" operator="in" />
                </filter>
              </defs>
            )}
            <g transform={turn || undefined}>
              <image
                href={assetUrl(r.path)}
                x={inner.x}
                y={inner.y}
                width={inner.w}
                height={inner.h}
                preserveAspectRatio="xMidYMid meet"
                filter={tint ? `url(#${id}-tint)` : undefined}
              />
            </g>
          </g>
        </>
      ) : (
        <rect
          x={it.x}
          y={it.y}
          width={it.w}
          height={it.w}
          fill="none"
          stroke="#e5484d"
          strokeDasharray="1 1"
          strokeWidth={0.3}
        />
      )}
    </g>
  )
}

/** Lunghezza di una quadratica, da una spezzata di 16 tratti */
function quadLength(
  a: { x: number; y: number; x2: number; y2: number },
  c: { x: number; y: number }
): number {
  let len = 0
  let px = a.x
  let py = a.y
  for (let k = 1; k <= 16; k++) {
    const t = k / 16
    const u = 1 - t
    const x = u * u * a.x + 2 * u * t * c.x + t * t * a.x2
    const y = u * u * a.y + 2 * u * t * c.y + t * t * a.y2
    len += Math.hypot(x - px, y - py)
    px = x
    py = y
  }
  return len || 1
}
