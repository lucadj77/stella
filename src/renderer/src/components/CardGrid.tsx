import { memo, useEffect, useRef, useState } from 'react'
import type { BoundCard } from '../../../shared/model/bind'
import type { Side } from '../../../shared/model/template'
import CardSvg from '../render/CardSvg'
import { useI18n } from '../i18n/context'

/** Una carta che non cambia non si ridisegna quando cambia un'altra carta */
const GridCard = memo(CardSvg)

interface Props {
  cards: BoundCard[]
  side: Side
  selected: number
  /** Tutte le carte selezionate, se più di una */
  selection?: number[]
  onSelect(index: number, e: React.MouseEvent): void
  /** Carte dentro il rettangolo tracciato trascinando sullo sfondo, nell'ordine della vista */
  onSelectArea?(indexes: number[]): void
  /**
   * Trascinando una carta (con le altre selezionate, se fa parte della selezione): vanno davanti
   * alla carta `before`, o in fondo se è il numero delle carte
   */
  onMove?(indexes: number[], before: number): void
  /** Pixel per millimetro */
  scale: number
  /** Carte mostrate, come indici, nell'ordine della vista (di base tutte) */
  order?: number[]
  /** Carte segnate dal confronto con un'altra versione: nuove o cambiate */
  marked?: Set<number>
}

function CardGrid({
  cards,
  side,
  selected,
  selection,
  onSelect,
  onSelectArea,
  onMove,
  scale,
  order,
  marked
}: Props): React.JSX.Element {
  const { t } = useI18n()
  const [dragging, setDragging] = useState<number | null>(null)
  /**
   * Rettangolo di selezione, in coordinate della finestra, con le carte già selezionate a cui
   * si aggiunge (con Maiuscolo o ⌘)
   */
  const [area, setArea] = useState<{
    x0: number
    y0: number
    x1: number
    y1: number
    base: number[]
  } | null>(null)
  const [drop, setDrop] = useState<{ index: number; after: boolean } | null>(null)
  const reset = (): void => {
    setDragging(null)
    setDrop(null)
  }
  const shown = order ?? cards.map((_, i) => i)
  /** Carte che si spostano trascinando quella data: la selezione intera, se ne fa parte */
  const moving = (i: number): number[] =>
    selection && selection.length > 1 && selection.includes(i) ? selection : [i]

  const areaHits = (a: NonNullable<typeof area>): number[] => {
    const [l, r] = [Math.min(a.x0, a.x1), Math.max(a.x0, a.x1)]
    const [t, b] = [Math.min(a.y0, a.y1), Math.max(a.y0, a.y1)]
    const hits = new Set<number>()
    for (const el of gridRef.current?.querySelectorAll<HTMLElement>('.card-cell') ?? []) {
      const c = el.getBoundingClientRect()
      if (c.right >= l && c.left <= r && c.bottom >= t && c.top <= b)
        hits.add(Number(el.dataset.index))
    }
    return shown.filter((i) => hits.has(i))
  }
  /**
   * Posto tra le carte più vicino a un punto fuori dalle carte: davanti alla prima carta che
   * nell'ordine di lettura viene dopo il punto, altrimenti dopo l'ultima
   */
  const gapAt = (x: number, y: number): { index: number; after: boolean } | null => {
    const els = [...(gridRef.current?.querySelectorAll<HTMLElement>('.card-cell') ?? [])]
    if (!els.length) return null
    for (const el of els) {
      const c = el.getBoundingClientRect()
      if (c.top > y || (c.bottom >= y && c.left + c.width / 2 > x))
        return { index: Number(el.dataset.index), after: false }
    }
    return { index: Number(els[els.length - 1].dataset.index), after: true }
  }
  const gridRef = useRef<HTMLDivElement>(null)
  // dopo il primo disegno le carte fuori vista si saltano (content-visibility nel CSS)
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setSettled(true), 1500)
    return () => clearTimeout(id)
  }, [])
  // la carta scelta resta visibile anche quando cambia da tastiera (PagSu, PagGiù)
  useEffect(() => {
    gridRef.current?.querySelector('.card-cell.selected')?.scrollIntoView({ block: 'nearest' })
  }, [selected])
  return (
    <div
      className={settled ? 'card-grid settled' : 'card-grid'}
      ref={gridRef}
      // trascinando sullo sfondo si selezionano le carte nel rettangolo
      onPointerDown={(e) => {
        if (e.target !== e.currentTarget || e.button !== 0 || !onSelectArea) return
        e.currentTarget.setPointerCapture(e.pointerId)
        const add = e.shiftKey || e.metaKey || e.ctrlKey
        setArea({
          x0: e.clientX,
          y0: e.clientY,
          x1: e.clientX,
          y1: e.clientY,
          base: add ? (selection ?? [selected]) : []
        })
      }}
      onPointerMove={(e) => {
        if (!area || !e.currentTarget.hasPointerCapture(e.pointerId)) return
        const next = { ...area, x1: e.clientX, y1: e.clientY }
        setArea(next)
        // un movimento minimo è un clic, non una selezione
        if (Math.hypot(next.x1 - next.x0, next.y1 - next.y0) < 4) return
        const hits = areaHits(next).filter((i) => !next.base.includes(i))
        if (hits.length || next.base.length) onSelectArea!([...next.base, ...hits])
      }}
      onPointerUp={() => setArea(null)}
      onPointerCancel={() => setArea(null)}
      // sullo spazio vuoto, per esempio dopo l'ultima carta, la carta va al posto più vicino
      onDragOver={(e) => {
        if (dragging === null || (e.target as Element).closest('.card-cell')) return
        e.preventDefault()
        const next = gapAt(e.clientX, e.clientY)
        if (next && (drop?.index !== next.index || drop.after !== next.after)) setDrop(next)
      }}
      onDrop={(e) => {
        if ((e.target as Element).closest('.card-cell')) return
        e.preventDefault()
        const at = gapAt(e.clientX, e.clientY)
        if (dragging !== null && at && onMove)
          onMove(moving(dragging), at.index + (at.after ? 1 : 0))
        reset()
      }}
    >
      {area && (
        <div
          className="select-area"
          style={{
            left: Math.min(area.x0, area.x1),
            top: Math.min(area.y0, area.y1),
            width: Math.abs(area.x1 - area.x0),
            height: Math.abs(area.y1 - area.y0)
          }}
        />
      )}
      {shown.map((i) => {
        const c = cards[i]
        if (!c) return null
        return (
          <button
            key={i}
            data-index={i}
            className={[
              'card-cell',
              i === selected && 'selected',
              i !== selected && selection?.includes(i) && 'selected-also',
              marked?.has(i) && 'changed',
              dragging !== null && moving(dragging).includes(i) && 'dragging',
              drop?.index === i && dragging !== i && (drop.after ? 'drop-after' : 'drop-before')
            ]
              .filter(Boolean)
              .join(' ')}
            // misura della cella finché è fuori vista (content-visibility nel CSS)
            style={{
              containIntrinsicSize: `auto ${Math.round(c.template.width * scale + 12)}px auto ${Math.round(c.template.height * scale + 36)}px`
            }}
            onClick={(e) => onSelect(i, e)}
            draggable={!!onMove}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move'
              e.dataTransfer.setData(
                'text/plain',
                moving(i)
                  .map((r) => r + 1)
                  .join(',')
              )
              setDragging(i)
            }}
            onDragEnd={reset}
            onDragOver={(e) => {
              if (dragging === null) return
              e.preventDefault()
              // metà sinistra: prima della carta, metà destra: dopo
              const r = e.currentTarget.getBoundingClientRect()
              const after = e.clientX > r.left + r.width / 2
              if (drop?.index !== i || drop.after !== after) setDrop({ index: i, after })
            }}
            onDrop={(e) => {
              e.preventDefault()
              if (dragging !== null && drop && onMove)
                onMove(moving(dragging), drop.index + (drop.after ? 1 : 0))
              reset()
            }}
          >
            <GridCard template={c.template} side={side} scale={scale} />
            <span className="card-caption" title={`${i + 1}`}>
              {marked?.has(i) && <span className="compare-dot" title={t('compare.changedCard')} />}
              <span className="card-label">{c.label || i + 1}</span>
              {c.amount !== 1 && <span className="muted"> {t('set.copies', { n: c.amount })}</span>}
              {c.problems.length > 0 && <span className="problem-dot" aria-label="!" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default CardGrid
