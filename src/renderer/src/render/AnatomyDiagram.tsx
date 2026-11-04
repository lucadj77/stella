import type { ProjectMeta } from '../../../shared/model/system'
import type { LoadedSet } from '../../../shared/project'
import type { Side, Template } from '../../../shared/model/template'
import {
  anatomyCardSource,
  calloutFace,
  layerBounds,
  type Anatomy
} from '../../../shared/model/document'
import CardSvg from './CardSvg'
import { MarkupInline } from './MarkupText'
import { useBoundCard } from './useBoundCard'

// Anatomia di una carta nei documenti (```anatomy): la carta disegnata dal progetto e, ai lati,
// le etichette collegate da una linea ai livelli che spiegano; con `sides: both` fronte e retro. È un unico SVG, misurato in mm,
// così l'esportazione lo tratta come una carta (HTML, PDF e PNG nel Markdown).

/** Larghezza della colonna delle etichette, in mm: la massima e la minima */
const LABEL_W = 42
const LABEL_MIN = 26
/** Spazio tra le etichette e la carta */
const GAP = 7
/** Spazio tra fronte e retro */
const CARD_GAP = 6
/** Larghezza minima della carta quando si riduce per stare nella pagina */
const CARD_MIN = 30
const LINE = 1.25
/** Ingrandimento dei testi delle etichette dentro il foreignObject */
const ZOOM = 10
/** Spazio minimo tra due etichette */
const SPACING = 1.5
const INK = '#3a3a3c'
/** Alone sotto linee e punti, per staccarli dalle parti scure delle carte */
const HALO = '#ffffff'

/**
 * Righe stimate di un'etichetta, andando a capo tra le parole come farà il browser: serve a non
 * sovrapporre le etichette prima di averle disegnate. La stima abbonda un poco.
 */
function lines(text: string, width: number, font: number): number {
  const char = font * 0.52
  let n = 0
  for (const para of text.replace(/\{[^}]*\}/g, 'MM').split(/\n|<br\s*\/?>/i)) {
    let used = 0
    n++
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const w = word.replace(/[*_]/g, '').length * char
      if (used && used + char + w > width) {
        n++
        used = w
      } else used += (used ? char : 0) + w
    }
  }
  return n
}

interface Placed {
  label: string
  /** Punto indicato sulla carta, in mm del disegno */
  ax: number
  ay: number
  /** Alto dell'etichetta */
  y: number
  h: number
}

/** Mette le etichette di un lato all'altezza dei loro punti, spostandole se si sovrappongono */
function stack(items: Omit<Placed, 'y'>[], top: number, bottom: number): Placed[] {
  const sorted = [...items].sort((a, b) => a.ay - b.ay)
  const out = sorted.map((it) => ({ ...it, y: it.ay - it.h / 2 }))
  for (let i = 0; i < out.length; i++)
    out[i].y = Math.max(out[i].y, i ? out[i - 1].y + out[i - 1].h + SPACING : top)
  // se escono in fondo si risale, senza superare l'alto; se non ci stanno, scendono sotto la carta
  bottom = Math.max(bottom, top + out.reduce((n, p) => n + p.h + SPACING, -SPACING))
  for (let i = out.length - 1; i >= 0; i--) {
    const limit = i === out.length - 1 ? bottom : out[i + 1].y - SPACING
    out[i].y = Math.max(top, Math.min(out[i].y, limit - out[i].h))
  }
  return out
}

export default function AnatomyDiagram({
  anatomy,
  sets,
  templates,
  project,
  unit,
  maxWidth,
  font
}: {
  anatomy: Anatomy
  sets: LoadedSet[]
  templates: Template[]
  project?: string | ProjectMeta
  /** Pixel per mm */
  unit: number
  /** Larghezza del testo della pagina in mm: carta ed etichette si riducono per starci */
  maxWidth: number
  /** Corpo delle etichette in mm */
  font: number
}): React.JSX.Element | null {
  const card = useBoundCard(anatomyCardSource(anatomy.card), sets, templates, project)
  if (!card) return null
  const t = card.template
  // con fronte e retro le due facce stanno affiancate: le etichette del fronte a sinistra, quelle
  // del retro a destra; con una faccia sola ogni etichetta sta dalla parte del suo livello
  const faces: Side[] = anatomy.both ? ['front', 'back'] : [card.ref.side]
  const found = anatomy.callouts
    .map((c) => {
      const face = calloutFace(anatomy, c, card.ref.side)
      return { c, face, b: layerBounds(face === 'front' ? t.front : t.back, c.layer, c.cell) }
    })
    .filter((x) => x.b !== null)
  const sideOf = (c: (typeof found)[number]): 'left' | 'right' =>
    anatomy.both
      ? c.face === 'front'
        ? 'left'
        : 'right'
      : (c.c.side ?? (c.b!.x + c.b!.w / 2 < t.width / 2 ? 'left' : 'right'))
  const columns = new Set(found.map(sideOf)).size
  const gaps = (faces.length - 1) * CARD_GAP
  // prima si stringono le etichette, poi le carte (se la larghezza non è scritta)
  let width = card.ref.width ?? t.width
  let labelW = LABEL_W
  const room = (): number => (maxWidth - gaps - columns * (labelW + GAP)) / faces.length
  if (width > room())
    labelW = Math.max(
      LABEL_MIN,
      (maxWidth - gaps - width * faces.length) / Math.max(1, columns) - GAP
    )
  if (width > room() && !card.ref.width) width = Math.max(CARD_MIN, room())
  const s = width / t.width
  const height = t.height * s

  const hasLeft = found.some((f) => sideOf(f) === 'left')
  const left = hasLeft ? labelW + GAP : 0
  /** Inizio di ciascuna faccia nel disegno */
  const faceX = (face: Side): number => left + faces.indexOf(face) * (width + CARD_GAP)
  const cardsEnd = left + faces.length * width + gaps

  const sides: Record<'left' | 'right', Omit<Placed, 'y'>[]> = { left: [], right: [] }
  for (const f of found) {
    const b = f.b!
    const side = sideOf(f)
    // il punto sta dentro il livello, vicino al bordo dalla parte dell'etichetta
    const inset = Math.min(2.5, (b.w * s) / 2)
    const ax = faceX(f.face) + (side === 'left' ? b.x * s + inset : (b.x + b.w) * s - inset)
    const h = lines(f.c.label, labelW, font) * font * LINE
    sides[side].push({ label: f.c.label, ax, ay: (b.y + b.h / 2) * s, h })
  }
  const right = sides.right.length ? labelW + GAP : 0
  const placedL = stack(sides.left, 0, height)
  const placedR = stack(sides.right, 0, height)
  const total = Math.max(height, ...[...placedL, ...placedR].map((p) => p.y + p.h))
  const w = cardsEnd + right

  const label = (p: Placed, side: 'left' | 'right', k: number): React.JSX.Element => {
    const x = side === 'left' ? 0 : cardsEnd + GAP
    const ex = side === 'left' ? labelW + 1 : x - 1
    const ey = p.y + Math.min(p.h, font * LINE) / 2
    const points = `${ex},${ey} ${side === 'left' ? left - GAP / 2 : cardsEnd + GAP / 2},${ey} ${p.ax},${p.ay}`
    return (
      <g key={`${side}${k}`}>
        {/* alone chiaro sotto la linea: resta visibile anche sopra le parti scure della carta */}
        <polyline
          points={points}
          fill="none"
          stroke={HALO}
          strokeOpacity={0.85}
          strokeWidth={1.1}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polyline
          points={points}
          fill="none"
          stroke={INK}
          strokeWidth={0.3}
          strokeLinejoin="round"
        />
        <circle cx={p.ax} cy={p.ay} r={0.9} fill={INK} stroke={HALO} strokeWidth={0.45} />
        {/* la posizione sta nel gruppo: l'esportazione in SVG converte il foreignObject da sé */}
        {/* il testo si impagina 10 volte più grande e si riduce: con un corpo di 3-4 px il
            browser lo ingrandisce fino al suo minimo e il foreignObject lo taglia */}
        <g transform={`translate(${x} ${p.y}) scale(${1 / ZOOM})`}>
          <foreignObject
            width={labelW * ZOOM}
            height={(p.h + font) * ZOOM}
            style={{ overflow: 'visible' }}
          >
            <div
              style={{
                fontSize: font * ZOOM,
                lineHeight: LINE,
                textAlign: side === 'left' ? 'right' : 'left',
                color: 'inherit'
              }}
            >
              <MarkupInline text={p.label} unit={ZOOM} />
            </div>
          </foreignObject>
        </g>
      </g>
    )
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={w * unit}
      height={total * unit}
      viewBox={`0 0 ${w} ${total}`}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {faces.map((face) => (
        <g key={face} transform={`translate(${faceX(face)} 0)`}>
          <CardSvg template={t} side={face} scale={s} />
        </g>
      ))}
      {placedL.map((p, k) => label(p, 'left', k))}
      {placedR.map((p, k) => label(p, 'right', k))}
    </svg>
  )
}
