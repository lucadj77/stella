import type { SetupLineStyle, SetupShape } from '../../../shared/model/setup'

/** Icone dei tasti dello schema del tavolo: disegnano quello che scelgono */
const box = {
  width: 26,
  height: 16,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  'aria-hidden': true
} as const

export function ShapeIcon({ shape }: { shape: SetupShape }): React.JSX.Element {
  const star = Array.from({ length: 10 }, (_, k) => {
    const a = -Math.PI / 2 + (k * Math.PI) / 5
    const r = k % 2 ? 3 : 7
    return `${13 + r * Math.cos(a)},${8.6 + r * Math.sin(a)}`
  }).join(' ')
  const hexagon = Array.from({ length: 6 }, (_, k) => {
    const a = (k * Math.PI) / 3
    return `${13 + 7 * Math.cos(a)},${8 + 6.4 * Math.sin(a)}`
  }).join(' ')
  return (
    <svg viewBox="0 0 26 16" {...box}>
      {shape === 'rect' && <rect x={6} y={2} width={14} height={12} />}
      {shape === 'ellipse' && <ellipse cx={13} cy={8} rx={8} ry={6} />}
      {shape === 'polygon' && <polygon points={hexagon} />}
      {shape === 'star' && <polygon points={star} strokeLinejoin="round" />}
    </svg>
  )
}

export function LineIcon({ line }: { line: SetupLineStyle }): React.JSX.Element {
  return (
    <svg viewBox="0 0 26 16" {...box} strokeWidth={2}>
      <line
        x1={2}
        y1={8}
        x2={24}
        y2={8}
        strokeDasharray={line === 'dash' ? '5 3' : line === 'dot' ? '0 4' : undefined}
        strokeLinecap={line === 'dot' ? 'round' : 'butt'}
      />
    </svg>
  )
}

export function HeadsIcon({
  heads
}: {
  heads: 'end' | 'start' | 'both' | 'none'
}): React.JSX.Element {
  const end = heads === 'end' || heads === 'both'
  const start = heads === 'start' || heads === 'both'
  return (
    <svg viewBox="0 0 26 16" {...box}>
      <line x1={start ? 4 : 2} y1={8} x2={end ? 22 : 24} y2={8} />
      {end && <polygon points="24,8 18,4.5 18,11.5" fill="currentColor" stroke="none" />}
      {start && <polygon points="2,8 8,4.5 8,11.5" fill="currentColor" stroke="none" />}
    </svg>
  )
}

/** La carta e, dal lato scelto, le righe dell'etichetta */
export function LabelIcon({ at }: { at: 'bottom' | 'top' | 'left' | 'right' }): React.JSX.Element {
  const card = { bottom: [9, 1], top: [9, 6], left: [15, 3], right: [5, 3] }[at]
  const lines =
    at === 'bottom'
      ? ['8,13.5 18,13.5']
      : at === 'top'
        ? ['8,2.5 18,2.5']
        : at === 'left'
          ? ['3,6.5 12,6.5', '6,9.5 12,9.5']
          : ['14,6.5 23,6.5', '14,9.5 20,9.5']
  return (
    <svg viewBox="0 0 26 16" {...box}>
      <rect x={card[0]} y={card[1]} width={7} height={9} rx={1} />
      {lines.map((p) => (
        <polyline key={p} points={p} strokeWidth={1.4} />
      ))}
    </svg>
  )
}
