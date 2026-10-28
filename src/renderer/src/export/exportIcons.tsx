import type { ComponentKind } from '../../../shared/model/template'

// I disegni delle scelte di esportazione e dei tipi di componente: SVG in linea, a un colore
// (quello del testo) con l'accento dove serve, così seguono il tema chiaro e scuro. Gli stessi
// disegni stanno nella finestra Esporta, nella scelta del tipo di un template nuovo e nella guida.

export type ChoiceIcon =
  | 'duplex-none'
  | 'duplex-long'
  | 'duplex-short'
  | 'marks-none'
  | 'marks-corners'
  | 'marks-lines'
  | 'bleed-off'
  | 'bleed-on'
  | 'dest-project'
  | 'dest-tts'
  | 'dest-both'

const line = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
} as const
const accent = { fill: 'var(--accent-soft)', stroke: 'var(--accent)', strokeWidth: 1.5 } as const

/** Una pagina con una lettera: F per i fronti, R per i retri */
function Page({
  x,
  y,
  letter,
  back
}: {
  x: number
  y: number
  letter: string
  back?: boolean
}): React.JSX.Element {
  return (
    <g>
      <rect x={x} y={y} width={16} height={22} rx={1.5} {...(back ? accent : line)} />
      <text
        x={x + 8}
        y={y + 15.5}
        textAnchor="middle"
        fontSize={10}
        fontWeight={700}
        fill={back ? 'var(--accent)' : 'currentColor'}
      >
        {letter}
      </text>
    </g>
  )
}

/** La carta al centro dei disegni dei segni di taglio e dell'abbondanza */
const CARD = { x: 13, y: 6, width: 18, height: 24 }

function corners(): React.JSX.Element {
  const { x, y, width: w, height: h } = CARD
  const d = [
    [x, y, -1, -1],
    [x + w, y, 1, -1],
    [x, y + h, -1, 1],
    [x + w, y + h, 1, 1]
  ]
    .map(([cx, cy, sx, sy]) => `M${cx + sx * 2} ${cy}h${sx * 5}M${cx} ${cy + sy * 2}v${sy * 5}`)
    .join('')
  return <path d={d} {...line} />
}

function choicePicture(name: ChoiceIcon): React.JSX.Element {
  switch (name) {
    case 'duplex-none':
      return (
        <>
          <Page x={4} y={7} letter="F" />
          <Page x={24} y={7} letter="R" back />
        </>
      )
    case 'duplex-long':
      return (
        <>
          <Page x={18} y={4} letter="R" back />
          <Page x={10} y={9} letter="F" />
          {/* si gira come una pagina di un libro: sul lato lungo */}
          <path d="M5 33c3 2 9 2 12 0" {...line} />
          <path d="M15 31.5l2 1.5-2.2 1.2" {...line} />
        </>
      )
    case 'duplex-short':
      return (
        <>
          <Page x={18} y={4} letter="R" back />
          <Page x={10} y={9} letter="F" />
          {/* si gira dal basso verso l'alto: sul lato corto */}
          <path d="M38 30c2-3 2-9 0-12" {...line} />
          <path d="M36.5 20l1.5-2 1.2 2.2" {...line} />
        </>
      )
    case 'marks-none':
      return <rect {...CARD} rx={2} {...line} />
    case 'marks-corners':
      return (
        <>
          <rect {...CARD} rx={2} {...line} strokeOpacity={0.45} />
          {corners()}
        </>
      )
    case 'marks-lines':
      return (
        <>
          <rect {...CARD} rx={2} {...line} strokeOpacity={0.45} />
          <path d="M13 1v34M31 1v34M3 6h38M3 30h38" {...line} strokeWidth={1} />
        </>
      )
    case 'bleed-off':
      return (
        <>
          <rect {...CARD} rx={2} {...line} />
          <path d="M18 14h8M18 18h8M18 22h5" {...line} strokeOpacity={0.6} />
        </>
      )
    case 'bleed-on':
      return (
        <>
          {/* lo sfondo continua oltre il taglio: la zona che si butta via */}
          <rect x={9} y={2} width={26} height={32} rx={1} {...accent} />
          <rect {...CARD} {...line} strokeDasharray="2.5 2" />
          <path d="M18 14h8M18 18h8M18 22h5" {...line} strokeOpacity={0.6} />
        </>
      )
    case 'dest-project':
      return <path d="M8 10h9l3 3h16v16H8z" {...line} />
    case 'dest-tts':
      return (
        <>
          {/* il tavolo con un mazzo sopra */}
          <path d="M4 26l8-10h20l8 10z" {...line} />
          <rect x={18} y={12} width={8} height={10} rx={1} {...accent} />
          <path d="M8 26v5M36 26v5" {...line} />
        </>
      )
    case 'dest-both':
      return (
        <>
          <path d="M3 7h6l2 2h9v10H3z" {...line} />
          <path d="M18 29l5-7h14l5 7z" {...line} />
          <rect x={27} y={19} width={6} height={6} rx={1} {...accent} />
        </>
      )
  }
}

/** Il disegno di una scelta: 44 × 36 */
export function ChoicePicture({ name }: { name: ChoiceIcon }): React.JSX.Element {
  return (
    <svg className="choice-picture" viewBox="0 0 44 36" aria-hidden="true">
      {choicePicture(name)}
    </svg>
  )
}

/** Meeple: la pedina per eccellenza */
const MEEPLE =
  'M12 2.5a3.2 3.2 0 0 1 3.2 3.2c0 .9-.3 1.6-.8 2.2l5.2 1.4c1.3.4 1.9 1.1 1.9 1.9 0 1-.9 1.6-2.3 1.6' +
  'l-3.6-.2 3.4 7.3c.4 1-.2 1.9-1.3 1.9h-3l-2.7-4.6-2.7 4.6H6.1c-1.1 0-1.7-.9-1.3-1.9l3.4-7.3' +
  '-3.6.2c-1.4 0-2.3-.6-2.3-1.6 0-.8.6-1.5 1.9-1.9l5.2-1.4c-.5-.6-.8-1.3-.8-2.2A3.2 3.2 0 0 1 12 2.5z'

function kindPicture(kind: ComponentKind): React.JSX.Element {
  switch (kind) {
    case 'card':
      return (
        <>
          <rect x={6} y={3} width={12} height={18} rx={2} {...line} />
          <rect x={8.5} y={5.5} width={7} height={6} rx={0.5} {...accent} strokeWidth={1} />
        </>
      )
    case 'token':
      return (
        <>
          <circle cx={12} cy={12} r={8.5} {...line} />
          <circle cx={12} cy={12} r={4.5} {...accent} strokeWidth={1} />
        </>
      )
    case 'tile':
      return (
        <path
          d="M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9z"
          {...line}
          fill="var(--accent-soft)"
          stroke="currentColor"
        />
      )
    case 'board':
      return (
        <>
          <rect x={3} y={4} width={18} height={16} rx={1} {...line} />
          <path d="M9 4v16M15 4v16M3 9.3h18M3 14.6h18" {...line} strokeWidth={0.9} />
          <rect x={9} y={9.3} width={6} height={5.3} fill="var(--accent)" opacity={0.5} />
        </>
      )
    case 'die':
      return (
        <>
          <rect x={4} y={4} width={16} height={16} rx={3.5} {...line} />
          {[
            [8, 8],
            [16, 8],
            [12, 12],
            [8, 16],
            [16, 16]
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.4} fill="currentColor" />
          ))}
        </>
      )
    case 'standee':
      return <path d={MEEPLE} {...line} fill="var(--accent-soft)" strokeWidth={1.3} />
  }
}

/** L'icona di un tipo di componente: 24 × 24 */
export function KindIcon({
  kind,
  size = 20
}: {
  kind: ComponentKind
  size?: number
}): React.JSX.Element {
  return (
    <svg className="kind-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {kindPicture(kind)}
    </svg>
  )
}
