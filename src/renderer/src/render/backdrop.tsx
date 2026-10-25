import { useContext, useId } from 'react'
import { resolveAsset } from '../../../shared/model/assets'
import { backdropSquare, shapePath, type Backdrop } from '../../../shared/model/shapes'
import { palette, resolveColor } from '../../../shared/model/variables'
import { AssetsContext, VariablesContext, assetUrl } from './assets'

// Sfondo di una variabile immagine dentro un SVG (livelli immagine delle carte, schema del
// tavolo): la forma o l'immagine occupa il quadrato più grande che sta nel riquadro, al centro,
// e l'immagine della variabile va nel quadrato interno (backdropInner in model/shapes.ts).

export function SvgBackdrop({
  box,
  backdrop: d
}: {
  box: { x: number; y: number; w: number; h: number }
  backdrop: Backdrop
}): React.JSX.Element | null {
  const assets = useContext(AssetsContext)
  const variables = useContext(VariablesContext)
  const id = useId().replace(/:/g, '')
  const q = backdropSquare(box)
  const color = d.color ? resolveColor(d.color, palette(variables)) : null
  const path = d.shape ? shapePath(d.shape) : undefined
  if (path)
    return (
      <path
        d={path}
        transform={`translate(${q.x} ${q.y}) scale(${q.w / 100})`}
        fill={color ?? 'currentColor'}
      />
    )
  const res = resolveAsset(d.src ?? '', assets)
  if (!res.ok) return null
  const url = assetUrl(res.path)
  const image = (
    <image
      href={url}
      x={q.x}
      y={q.y}
      width={q.w}
      height={q.h}
      preserveAspectRatio="xMidYMid meet"
    />
  )
  if (!color) return image
  // con un colore conta solo la forma dell'immagine, come la tinta delle icone
  return (
    <>
      <defs>
        <filter id={`${id}-bg`}>
          <feFlood floodColor={color} />
          <feComposite in2="SourceAlpha" operator="in" />
        </filter>
      </defs>
      <g filter={`url(#${id}-bg)`}>{image}</g>
    </>
  )
}
