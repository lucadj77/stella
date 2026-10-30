import { useRef, useState } from 'react'
import { gridGeometry } from '../../../shared/model/grid'
import type { GridLayer } from '../../../shared/model/template'
import { useI18n } from '../i18n/context'
import { cellsList } from '../../../shared/model/cellRules'
import { Dialog } from './dialogs'

// Scelta delle caselle di una regola con il clic: la griglia disegnata in grande com'è nel primo
// componente (colori delle altre regole, caselle nascoste tratteggiate, quello che il contenuto
// scrive) con il numero della posizione in un angolo. Un clic accende o spegne una casella;
// trascinando si fa lo stesso su quelle sotto il mouse.

/** Come appare una casella nell'anteprima */
export interface PickerCell {
  /** Riempimento, se è un colore semplice */
  fill: string | null
  hidden: boolean
  /** Il testo che il contenuto scrive nella casella, se c'è */
  label: string
}

/** Un colore che l'SVG sa disegnare da solo; le variabili e le sfumature no */
const plainColor = (c: string | null): string | null =>
  c && /^(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i.test(c.trim()) ? c.trim() : null

export default function CellPicker({
  grid,
  cells,
  selected,
  onApply,
  onClose
}: {
  grid: GridLayer
  /** Come appare ogni casella nel primo componente, senza la regola che si sta scegliendo */
  cells?: PickerCell[]
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
      <p className="muted small">{t('cellPicker.index')}</p>
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
          const look = cells?.[i]
          const label = look?.label.trim() ?? ''
          const fill = look && !look.hidden ? plainColor(look.fill) : null
          return (
            <g
              key={i}
              className={'cell-picker-cell' + (on ? ' on' : '') + (look?.hidden ? ' hidden' : '')}
              onPointerDown={(e) => {
                e.preventDefault()
                drag.current = !on
                set(n, !on)
              }}
              onPointerEnter={() => drag.current !== null && set(n, drag.current)}
            >
              <path d={d} style={fill ? { fill } : undefined} />
              {on && <path d={d} className="cell-picker-mark" />}
              {label && !look?.hidden ? (
                <>
                  <text
                    x={c.x}
                    y={c.y}
                    fontSize={font}
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {label}
                  </text>
                  <text
                    className="cell-picker-index"
                    x={c.x - geo.cell.w / 2 + font * 0.25}
                    y={c.y - geo.cell.h / 2 + font * 0.25}
                    fontSize={font * 0.38}
                    dominantBaseline="hanging"
                  >
                    {n}
                  </text>
                </>
              ) : (
                <text
                  className={label ? 'cell-picker-index' : undefined}
                  x={c.x}
                  y={c.y}
                  fontSize={font}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {n}
                </text>
              )}
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
