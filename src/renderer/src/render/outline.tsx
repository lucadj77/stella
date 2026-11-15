// Contorno che segue la sagoma di ciò che si disegna: per i testi con contorno, i livelli
// immagine e le immagini nel testo (docs/specifica.md, 6.1).

import { softOf } from './outlineFilter'

/**
 * Le primitive del filtro, dentro un <filter>: la sagoma (alfa) allargata di r in ogni direzione.
 * feMorphology allarga solo a rettangolo; tre rettangoli (largo, alto, quadrato a 45°) insieme
 * fanno quasi un cerchio, e una sfocatura riportata a bordo netto toglie i gradini. Lo stesso
 * filtro per l'SVG esportato è in outlineFilter.ts.
 */
export function TextOutline({
  r,
  color,
  soft = softOf(r)
}: {
  r: number
  color: string
  /** la sfocatura che toglie i gradini, nelle unità del filtro (il testo è ingrandito, l'immagine in mm) */
  soft?: number
}): React.JSX.Element {
  const k = Math.SQRT2 - 1
  const d = Math.SQRT1_2
  return (
    <>
      <feMorphology in="SourceAlpha" operator="dilate" radius={`${r} ${r * k}`} result="o1" />
      <feMorphology in="SourceAlpha" operator="dilate" radius={`${r * k} ${r}`} result="o2" />
      <feMorphology in="SourceAlpha" operator="dilate" radius={`${r * d} ${r * d}`} result="o3" />
      <feMerge result="grown">
        <feMergeNode in="o1" />
        <feMergeNode in="o2" />
        <feMergeNode in="o3" />
      </feMerge>
      {/* i gradini dei rettangoli si ammorbidiscono: sfocatura, poi di nuovo un bordo netto a metà */}
      <feGaussianBlur in="grown" stdDeviation={soft} />
      <feComponentTransfer result="smooth">
        <feFuncA type="linear" slope={8} intercept={-3.5} />
      </feComponentTransfer>
      <feFlood floodColor={color} />
      <feComposite in2="smooth" operator="in" />
      <feMerge>
        <feMergeNode />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </>
  )
}
