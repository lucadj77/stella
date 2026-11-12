import { VISION_MATRICES, visionMatrix, type Vision } from '../../../shared/vision'

/** I filtri, in un SVG nascosto; le carte li usano con filter: url(#vision-…) */
export default function VisionFilters(): React.JSX.Element {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        {(Object.keys(VISION_MATRICES) as Exclude<Vision, 'normal'>[]).map((v) => (
          <filter key={v} id={`vision-${v}`} colorInterpolationFilters="linearRGB">
            <feColorMatrix type="matrix" values={visionMatrix(v)} />
          </filter>
        ))}
      </defs>
    </svg>
  )
}
