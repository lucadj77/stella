import type { Scene, SceneItem, ScenePage } from '../../../shared/export'
import CardSvg from './CardSvg'

// Una pagina di una scena di esportazione: carte e segni di taglio. La usano la finestra nascosta
// di esportazione e l'anteprima nella finestra Esporta.

export default function ScenePageView({
  page: p,
  scene: s,
  className
}: {
  page: ScenePage
  scene: Scene
  className?: string
}): React.JSX.Element {
  const lines = (p.lines.length > 0 || !!p.labels?.length) && (
    <svg
      width={p.width * s.scale}
      height={p.height * s.scale}
      viewBox={`0 0 ${p.width} ${p.height}`}
      style={{ position: 'absolute', left: 0, top: 0 }}
    >
      {p.lines.map((l, i) => (
        <line
          key={i}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke={s.lineColor}
          strokeWidth={s.lineWidth}
          strokeLinecap="butt"
          strokeDasharray={l.dash ? '1 0.8' : undefined}
        />
      ))}
      {p.labels?.map((l, i) => (
        <text
          key={`t${i}`}
          x={l.x}
          y={l.y}
          fontSize={l.size}
          fontFamily="sans-serif"
          fill={s.lineColor}
          dominantBaseline="middle"
        >
          {l.text}
        </text>
      ))}
    </svg>
  )
  // le linguette degli sviluppi dei dadi, sotto le facce
  const shapes = !!p.shapes?.length && (
    <svg
      width={p.width * s.scale}
      height={p.height * s.scale}
      viewBox={`0 0 ${p.width} ${p.height}`}
      style={{ position: 'absolute', left: 0, top: 0 }}
    >
      {p.shapes.map((sh, i) => (
        <polygon key={i} points={sh.points.map((pt) => pt.join(',')).join(' ')} fill={sh.fill} />
      ))}
    </svg>
  )
  const over = p.linesOver ?? s.linesOver
  // una parte di un poster mostra le carte solo nel suo riquadro
  const c = p.clip ?? { x: 0, y: 0, w: p.width, h: p.height }
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        width: p.width * s.scale,
        height: p.height * s.scale,
        background: s.background ?? undefined
      }}
    >
      {shapes}
      {!over && lines}
      <div
        style={{
          position: 'absolute',
          overflow: 'hidden',
          left: c.x * s.scale,
          top: c.y * s.scale,
          width: c.w * s.scale,
          height: c.h * s.scale
        }}
      >
        {p.items.map((it, i) => {
          const card = (
            <CardSvg
              template={it.template}
              side={it.side}
              scale={s.scale * (it.zoom ?? 1)}
              mode={it.mode}
              guides={false}
            />
          )
          if (it.clip) {
            // una linguetta: la faccia specchiata, solo dentro la sua forma
            const pts = it.clip
              .map(([x, y]) => `${(x - c.x) * s.scale}px ${(y - c.y) * s.scale}px`)
              .join(', ')
            const flip = it.flip === 'x' ? 'scaleX(-1)' : it.flip === 'y' ? 'scaleY(-1)' : undefined
            return (
              <div key={i} style={{ position: 'absolute', inset: 0, clipPath: `polygon(${pts})` }}>
                <div
                  style={{
                    position: 'absolute',
                    left: (it.x - c.x) * s.scale,
                    top: (it.y - c.y) * s.scale,
                    transform: flip
                  }}
                >
                  {card}
                </div>
              </div>
            )
          }
          const crop = it.crop
          const ct = crop?.t ?? 0
          const cb = crop?.b ?? 0
          if (crop && (crop.l || crop.r || ct || cb)) {
            // solo la parte tra i tagli: nei fogli da piegare e negli sviluppi dei dadi
            // l'abbondanza dove la carta ne tocca un'altra non c'è
            const b = it.mode === 'bleed' ? it.template.bleed : 0
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  overflow: 'hidden',
                  left: (it.x + crop.l - c.x) * s.scale,
                  top: (it.y + ct - c.y) * s.scale,
                  width: (it.template.width + 2 * b - crop.l - crop.r) * s.scale,
                  height: (it.template.height + 2 * b - ct - cb) * s.scale
                }}
              >
                <div style={{ position: 'absolute', left: -crop.l * s.scale, top: -ct * s.scale }}>
                  {card}
                </div>
              </div>
            )
          }
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: (it.x - c.x) * s.scale,
                top: (it.y - c.y) * s.scale,
                ...turn(it, s.scale)
              }}
            >
              {card}
            </div>
          )
        })}
      </div>
      {over && lines}
    </div>
  )
}

/**
 * Rotazione di una carta intorno all'angolo in alto a sinistra, poi spostata perché la carta
 * ruotata parta dalla posizione indicata
 */
function turn(it: SceneItem, scale: number): React.CSSProperties {
  if (!it.rotate) return {}
  const b = it.mode === 'bleed' ? it.template.bleed : 0
  const w = (it.template.width + 2 * b) * scale
  const h = (it.template.height + 2 * b) * scale
  return {
    transformOrigin: '0 0',
    transform:
      it.rotate === 90
        ? `translate(${h}px, 0) rotate(90deg)`
        : `translate(0, ${w}px) rotate(-90deg)`
  }
}
