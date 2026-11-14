import { useId } from 'react'

/** Il filo attorno ai componenti dell'anatomia e dello schema del tavolo, in mm */
const EDGE = 0.2

/**
 * Un filo scuro e leggero attorno a un componente disegnato in un'anatomia o in uno schema del
 * tavolo, perché un componente chiaro non si perda sul foglio bianco. Segue ciò che si vede: la
 * sagoma della carta o, per un segnalino senza sfondo, il disegno stesso. Il filo è una copia del
 * componente sotto di lui, allargata e riempita di scuro; il componente resta com'è, anche nel PDF.
 * `unit` è quanti mm vale un'unità del disegno in cui sta il componente.
 */
export default function Edged({
  unit = 1,
  children
}: {
  unit?: number
  children: React.ReactNode
}): React.JSX.Element {
  const id = `edge${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <>
      <defs>
        <filter
          id={`${id}f`}
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
          colorInterpolationFilters="sRGB"
        >
          <feMorphology in="SourceAlpha" operator="dilate" radius={EDGE / unit} result="grown" />
          <feFlood floodColor="#000000" floodOpacity={0.6} result="ink" />
          <feComposite in="ink" in2="grown" operator="in" result="thick" />
          <feComposite in="thick" in2="SourceAlpha" operator="out" />
        </filter>
      </defs>
      <use href={`#${id}`} filter={`url(#${id}f)`} />
      <g id={id}>{children}</g>
    </>
  )
}
