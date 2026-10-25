import { useContext, useId } from 'react'
import type { LoadedSet } from '../../../shared/project'
import type { Template } from '../../../shared/model/template'
import { anatomyCardSource } from '../../../shared/model/document'
import type { Setup, SetupItem } from '../../../shared/model/setup'
import { resolveAsset } from '../../../shared/model/assets'
import { backdropInner, imageBackdrop } from '../../../shared/model/shapes'
import { imageVariable, palette, resolveColor } from '../../../shared/model/variables'
import { SvgBackdrop } from './backdrop'
import CardSvg from './CardSvg'
import { MarkupInline } from './MarkupText'
import { AssetsContext, VariablesContext, assetUrl } from './assets'
import { useBoundCard } from './useBoundCard'
import {
  DECK_LAYERS,
  DECK_STEP,
  itemCardSize,
  SETUP_LINE as LINE,
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
  project?: string
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

/** Un testo con il markup in un riquadro, centrato o a sinistra */
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
  align?: 'left' | 'center'
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
        style={{ overflow: 'visible' }}
      >
        <div style={{ fontSize: font * ZOOM, lineHeight: LINE, textAlign: align }}>
          <span
            style={
              background
                ? { background: 'rgba(255,255,255,0.85)', padding: `0 ${font * 0.3 * ZOOM}px` }
                : undefined
            }
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
  project
}: {
  i: number
  it: Extract<SetupItem, { kind: 'card' | 'deck' }>
  box: Box
  font: number
  sets: LoadedSet[]
  templates: Template[]
  project?: string
}): React.JSX.Element {
  const card = useBoundCard(anatomyCardSource(it.card), sets, templates, project)
  const layers = it.kind === 'deck' ? Math.min(it.count, DECK_LAYERS + 1) - 1 : 0
  const extra = layers * DECK_STEP
  // misure della carta dritta
  const { w: cw, h: ch } = itemCardSize(it.card, sets, templates)
  const t = card?.template
  const radius = t ? (t.cornerRadius * cw) / t.width : 3
  const face = t ? (
    <CardSvg template={t} side={card.ref.side} scale={cw / t.width} />
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
          <rect
            width={cw}
            height={ch}
            rx={radius}
            fill="#ffffff"
            stroke="#a1a1a6"
            strokeWidth={0.25}
          />
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
          <Label x={it.x} y={it.y} w={it.w} font={font} text={it.text} align="left" />
        </g>
      )
    case 'image':
      return <ImageItem i={i} it={it} />
    case 'arrow': {
      const dx = it.x2 - it.x
      const dy = it.y2 - it.y
      const len = Math.hypot(dx, dy) || 1
      const ux = dx / len
      const uy = dy / len
      const head = Math.min(3.5, len / 2)
      const bx = it.x2 - ux * head
      const by = it.y2 - uy * head
      const w = head * 0.55
      const tip = `${it.x2},${it.y2} ${bx - uy * w},${by + ux * w} ${bx + uy * w},${by - ux * w}`
      return (
        <g data-item={i}>
          {/* alone chiaro sotto la freccia: resta visibile anche sopra carte e plance scure */}
          <g stroke={HALO} strokeOpacity={0.85} strokeLinecap="round" strokeLinejoin="round">
            <line x1={it.x} y1={it.y} x2={bx} y2={by} strokeWidth={1.4} />
            <polygon points={tip} fill={HALO} fillOpacity={0.85} strokeWidth={0.9} />
          </g>
          <line
            x1={it.x}
            y1={it.y}
            x2={bx}
            y2={by}
            stroke={INK}
            strokeWidth={0.5}
            strokeLinecap="round"
          />
          <polygon points={tip} fill={INK} />
          {it.label && (
            <Label
              x={(it.x + it.x2) / 2 - 25}
              y={(it.y + it.y2) / 2 - (font * LINE) / 2}
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
