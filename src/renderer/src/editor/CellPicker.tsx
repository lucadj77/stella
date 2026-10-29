import { useRef, useState } from 'react'
import { gridGeometry } from '../../../shared/model/grid'
import type { GridLayer } from '../../../shared/model/template'
import { useI18n } from '../i18n/context'
import { cellsList } from '../../../shared/model/cellRules'
import { Dialog } from './dialogs'

// Scelta delle caselle di una regola con il clic: la griglia disegnata in grande, con i numeri.
// Un clic accende o spegne una casella; trascinando si fa lo stesso su quelle sotto il mouse.

export default function CellPicker({
  grid,
  selected,
  onApply,
  onClose
}: {
  grid: GridLayer
  selected: number[]
  onApply(cells: number[]): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const geo = gridGeometry(grid)
  const [picked, setPicked] = useState(() => new Set(selected))
  // trascinando: accende o spegne come la prima casella toccata
  const drag = useRef<boolean | null>(null)
  const set = (n: number, on: boolean): void =>
    setPicked((p) => {
      if (p.has(n) === on) return p
      const next = new Set(p)
      if (on) next.add(n)
      else next.delete(n)
      return next
    })
  const b = geo.bounds
  const font = Math.max(1.5, Math.min(geo.cell.w, geo.cell.h) * 0.32)
  return (
    <Dialog title={t('cellPicker.title')} onClose={onClose}>
      <p className="muted small">{t('cellPicker.hint')}</p>
      <svg
        className="cell-picker"
        viewBox={`${b.x - 1} ${b.y - 1} ${b.w + 2} ${b.h + 2}`}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
      >
        {geo.cells.map((d, i) => {
          const n = i + 1
          const on = picked.has(n)
          const c = geo.centers[i]
          return (
            <g
              key={i}
              className={'cell-picker-cell' + (on ? ' on' : '')}
              onPointerDown={(e) => {
                e.preventDefault()
                drag.current = !on
                set(n, !on)
              }}
              onPointerEnter={() => drag.current !== null && set(n, drag.current)}
            >
              <path d={d} />
              <text x={c.x} y={c.y} fontSize={font} textAnchor="middle" dominantBaseline="central">
                {n}
              </text>
            </g>
          )
        })}
      </svg>
      <p className="small">
        {picked.size
          ? t('cellPicker.count', { n: picked.size, list: cellsList([...picked]) })
          : t('cellPicker.none')}
      </p>
      <div className="dialog-buttons">
        <button type="button" onClick={() => setPicked(new Set())}>
          {t('cellPicker.clear')}
        </button>
        <button type="button" onClick={() => setPicked(new Set(geo.cells.map((_, i) => i + 1)))}>
          {t('cellPicker.all')}
        </button>
        <span className="spacer" />
        <button type="button" onClick={onClose}>
          {t('dialog.cancel')}
        </button>
        <button
          type="button"
          className="primary"
          disabled={!picked.size}
          onClick={() => {
            onApply([...picked])
            onClose()
          }}
        >
          {t('cellPicker.apply')}
        </button>
      </div>
    </Dialog>
  )
}
