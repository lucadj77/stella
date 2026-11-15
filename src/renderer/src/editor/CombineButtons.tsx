import { useId } from 'react'
import { COMBINE_OPS } from '../../../shared/model/combine'
import type { GroupCombine } from '../../../shared/model/template'
import { useI18n } from '../i18n/context'

// Pulsanti delle forme combinate: unione, intersezione, sottrazione, esclusione. Ognuno ha
// un disegno di un quadrato (la base) e di un cerchio (sopra) con il risultato pieno.

function CombineIcon({ op }: { op: GroupCombine }): React.JSX.Element {
  const id = useId()
  const square = <rect x="3" y="9" width="15" height="15" rx="2" />
  const circle = <circle cx="19" cy="12" r="8" />
  const outline = (
    <g fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 1.5" opacity="0.6">
      {square}
      {circle}
    </g>
  )
  let solid: React.JSX.Element
  switch (op) {
    case 'intersect':
      solid = (
        <>
          <defs>
            <clipPath id={`${id}-c`}>{circle}</clipPath>
          </defs>
          <g clipPath={`url(#${id}-c)`}>{square}</g>
        </>
      )
      break
    case 'subtract':
      solid = (
        <>
          <defs>
            <mask id={`${id}-m`}>
              <rect width="32" height="32" fill="#fff" />
              <circle cx="19" cy="12" r="8" fill="#000" />
            </mask>
          </defs>
          <g mask={`url(#${id}-m)`}>{square}</g>
        </>
      )
      break
    case 'exclude':
      solid = (
        <path
          fillRule="evenodd"
          d="M5 9h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V11a2 2 0 0 1 2-2Z M27 12a8 8 0 1 1-16 0a8 8 0 1 1 16 0Z"
        />
      )
      break
    default:
      solid = (
        <>
          {square}
          {circle}
        </>
      )
  }
  return (
    <svg className="kind-icon" width="34" height="34" viewBox="0 0 30 30" aria-hidden>
      {outline}
      <g fill="currentColor">{solid}</g>
    </svg>
  )
}

/**
 * Le quattro operazioni come pulsanti grandi. `value` è l'operazione attiva di un gruppo, null
 * per una selezione ancora da combinare
 */
export default function CombineButtons({
  value,
  onPick,
  disabled
}: {
  value: GroupCombine | null
  onPick: (op: GroupCombine) => void
  disabled?: boolean
}): React.JSX.Element {
  const { t } = useI18n()
  return (
    <div className="kind-choice-buttons combine-buttons" role="group">
      {COMBINE_OPS.map((op) => (
        <button
          key={op}
          type="button"
          disabled={disabled}
          className={value === op ? 'active' : undefined}
          aria-pressed={value === null ? undefined : value === op}
          title={t(`combine.${op}Hint`)}
          onClick={() => onPick(op)}
        >
          <CombineIcon op={op} />
          {t(`combine.${op}`)}
        </button>
      ))}
    </div>
  )
}
