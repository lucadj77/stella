import type { Template } from '../../../shared/model/template'
import CardSvg from '../render/CardSvg'

/** Miniatura di un componente, dentro un riquadro alto `height` e largo `width` */
export function Thumb({
  card,
  height,
  width = height * 1.4,
  side = 'front'
}: {
  card: Template
  height: number
  width?: number
  side?: 'front' | 'back'
}): React.JSX.Element {
  const scale = Math.min(height / card.height, width / card.width)
  return (
    <span className="manage-thumb">
      <CardSvg template={card} side={side} scale={scale} />
    </span>
  )
}
