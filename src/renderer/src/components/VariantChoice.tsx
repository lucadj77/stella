import { useEffect, useRef, useState } from 'react'
import type { Template } from '../../../shared/model/template'
import CardSvg from '../render/CardSvg'
import { useI18n } from '../i18n/context'

/** Oltre queste varianti il campo mostra la scelta attuale e apre un menu con la ricerca */
const MAX_TILES = 8

/**
 * Scelta della variante di una carta: la carta disegnata con il template e con ogni variante.
 * Il primo è il template base. Con tante varianti, la scelta attuale e un menu con la ricerca.
 */
export default function VariantChoice({
  variants,
  chosen,
  column,
  onPick
}: {
  variants: { name: string; template: Template }[]
  /** null: più carte con varianti diverse */
  chosen: string | null
  column: string
  onPick(name: string): void
}): React.JSX.Element {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const boxRef = useRef<HTMLSpanElement>(null)
  const close = (): void => {
    setOpen(false)
    setQuery('')
  }
  // un clic fuori chiude il menu
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent): void => {
      if (!boxRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    boxRef.current?.querySelector('.list-popover')?.scrollIntoView({ block: 'nearest' })
    document.addEventListener('mousedown', down)
    return () => document.removeEventListener('mousedown', down)
  }, [open])

  const tile = (v: { name: string; template: Template }, i: number): React.JSX.Element => {
    const on = chosen === v.name
    return (
      <button
        key={v.name}
        type="button"
        className={'variant-tile' + (on ? ' on' : '')}
        aria-pressed={on}
        title={v.name}
        data-column={i === 0 && !open ? column : undefined}
        onClick={(e) => {
          e.preventDefault()
          onPick(v.name)
        }}
      >
        <CardSvg template={v.template} scale={72 / Math.max(v.template.height, 1)} guides={false} />
        <span className="list-tile-name">{v.name}</span>
        {i === 0 && <span className="list-base">{t('list.base')}</span>}
      </button>
    )
  }

  if (variants.length <= MAX_TILES)
    return <span className="variant-choice">{variants.map(tile)}</span>

  const q = query.trim().toLowerCase()
  const shown = variants
    .map((v, i) => [v, i] as const)
    .filter(([v]) => !q || v.name.toLowerCase().includes(q))
  const current = variants.find((v) => v.name === chosen)
  return (
    <span className="list-choice menu" ref={boxRef}>
      <button
        type="button"
        className="list-current variant-current"
        data-column={column}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault()
          setOpen(!open)
        }}
      >
        {current && (
          <CardSvg
            template={current.template}
            scale={40 / Math.max(current.template.height, 1)}
            guides={false}
          />
        )}
        <span className="list-current-name">
          {chosen === null
            ? t('cardForm.mixed')
            : current === variants[0]
              ? t('list.baseOption', { value: current.name })
              : (current?.name ?? chosen)}
        </span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <span
          className="list-popover"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              close()
            }
          }}
        >
          <input
            type="search"
            autoFocus
            placeholder={t('variants.search', { n: String(variants.length) })}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && shown.length) {
                e.preventDefault()
                onPick(shown[0][0].name)
                close()
              }
            }}
          />
          <span className="list-popover-grid" onClick={close}>
            {shown.map(([v, i]) => tile(v, i))}
            {!shown.length && <span className="small muted">{t('list.noMatch')}</span>}
          </span>
        </span>
      )}
    </span>
  )
}
