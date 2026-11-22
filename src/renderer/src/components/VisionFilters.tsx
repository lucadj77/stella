import { VISION_MATRICES, visionMatrix, type Vision } from '../../../shared/vision'

/**
 * I filtri, in un SVG nascosto; le carte li usano con filter: url(#vision-…). Con `blur` (la
 * sfocatura come frazione di larghezza e altezza della carta, che vale per ogni dimensione della
 * miniatura) ogni filtro sfoca anche, e c'è vision-normal con la sola sfocatura.
 */
export default function VisionFilters({
  blur
}: {
  blur?: [number, number] | null
}): React.JSX.Element {
  const visions = ['normal', ...Object.keys(VISION_MATRICES)] as Vision[]
  const std = blur ? `${blur[0]} ${blur[1]}` : null
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        {visions.map((v) => (
          <filter
            key={v}
            id={`vision-${v}`}
            colorInterpolationFilters="linearRGB"
            primitiveUnits={std ? 'objectBoundingBox' : undefined}
          >
            {v === 'normal' ? (
              <feColorMatrix type="identity" />
            ) : (
              <feColorMatrix type="matrix" values={visionMatrix(v)} />
            )}
            {std && <feGaussianBlur stdDeviation={std} />}
          </filter>
        ))}
      </defs>
    </svg>
  )
}
