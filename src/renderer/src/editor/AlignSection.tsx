import { useState } from 'react'
import {
  alignLayers,
  arrangeGrid,
  distributeLayers,
  type AlignMode,
  type AlignTarget
} from '../../../shared/model/align'
import { useI18n } from '../i18n/context'
import type { MessageKey } from '../i18n/en'
import type { EditorAction, EditorState } from './useEditor'

// Allineamento, distribuzione e griglia dei livelli selezionati, in cima al pannello proprietà.

const TARGET_KEY = 'alignTarget'

function loadTarget(): AlignTarget {
  try {
    const v = localStorage.getItem(TARGET_KEY)
    return v === 'card' || v === 'safe' || v === 'selection' ? v : 'selection'
  } catch {
    return 'selection'
  }
}

const ALIGN: AlignMode[] = ['left', 'hcenter', 'right', 'top', 'vcenter', 'bottom']

export default function AlignSection({
  state,
  dispatch
}: {
  state: EditorState
  dispatch: React.Dispatch<EditorAction>
}): React.JSX.Element {
  const { t } = useI18n()
  const { template: tpl, side, selection } = state
  const [target, setTarget] = useState(loadTarget)
  const [grid, setGrid] = useState({ columns: '3', rows: '', gapX: '', gapY: '' })
  const many = selection.length > 1
  // con un solo livello la selezione non fa da riferimento: si allinea alla carta
  const effective: AlignTarget = !many && target === 'selection' ? 'card' : target

  const choose = (v: AlignTarget): void => {
    setTarget(v)
    try {
      localStorage.setItem(TARGET_KEY, v)
    } catch {
      // preferenza non essenziale
    }
  }
  const change = (template: typeof tpl): void => {
    if (template !== tpl) dispatch({ type: 'change', template })
  }
  const num = (s: string): number | null => {
    const n = Number(s.replace(',', '.'))
    return s.trim() !== '' && Number.isFinite(n) ? n : null
  }
  const columns = Math.max(1, Math.round(num(grid.columns) ?? 1))

  return (
    <div className="align-section">
      <div className="align-row">
        {ALIGN.map((mode) => (
          <button
            key={mode}
            className="tool"
            title={t(`arrange.${mode}` as MessageKey)}
            aria-label={t(`arrange.${mode}` as MessageKey)}
            onClick={() => change(alignLayers(tpl, side, selection, mode, effective))}
          >
            <AlignIcon mode={mode} />
          </button>
        ))}
        {many && (
          <>
            <span className="align-sep" />
            <button
              className="tool"
              title={t('arrange.distributeH')}
              aria-label={t('arrange.distributeH')}
              onClick={() => change(distributeLayers(tpl, side, selection, 'h', effective))}
            >
              <DistributeIcon axis="h" />
            </button>
            <button
              className="tool"
              title={t('arrange.distributeV')}
              aria-label={t('arrange.distributeV')}
              onClick={() => change(distributeLayers(tpl, side, selection, 'v', effective))}
            >
              <DistributeIcon axis="v" />
            </button>
          </>
        )}
      </div>
      <div className="field">
        <span className="field-label">{t('arrange.relativeTo')}</span>
        <span className="field-control">
          <select
            value={effective}
            title={t('arrange.relativeToHint')}
            onChange={(e) => choose(e.target.value as AlignTarget)}
          >
            <option value="selection" disabled={!many}>
              {t('arrange.target.selection')}
            </option>
            <option value="card">{t('arrange.target.card')}</option>
            <option value="safe">{t('arrange.target.safe')}</option>
          </select>
        </span>
      </div>
      {many && (
        <details className="align-grid">
          <summary>{t('arrange.grid')}</summary>
          <div className="align-grid-fields">
            <label title={t('arrange.columnsHint')}>
              {t('arrange.columns')}
              <input
                className="num"
                value={grid.columns}
                onChange={(e) => setGrid({ ...grid, columns: e.target.value })}
              />
            </label>
            <label title={t('arrange.rowsHint')}>
              {t('arrange.rows')}
              <input
                className="num"
                value={grid.rows}
                placeholder={String(Math.ceil(selection.length / columns))}
                onChange={(e) => setGrid({ ...grid, rows: e.target.value })}
              />
            </label>
            <label title={t('arrange.gapHint')}>
              {t('arrange.gapX')}
              <input
                className="num"
                value={grid.gapX}
                placeholder={t('arrange.auto')}
                onChange={(e) => setGrid({ ...grid, gapX: e.target.value })}
              />
            </label>
            <label title={t('arrange.gapHint')}>
              {t('arrange.gapY')}
              <input
                className="num"
                value={grid.gapY}
                placeholder={t('arrange.auto')}
                onChange={(e) => setGrid({ ...grid, gapY: e.target.value })}
              />
            </label>
          </div>
          <button
            title={t('arrange.arrangeHint')}
            onClick={() =>
              change(
                arrangeGrid(
                  tpl,
                  side,
                  selection,
                  {
                    columns,
                    rows: num(grid.rows) ?? 1,
                    gapX: num(grid.gapX),
                    gapY: num(grid.gapY)
                  },
                  effective
                )
              )
            }
          >
            {t('arrange.arrange')}
          </button>
        </details>
      )}
    </div>
  )
}

/** Icone di allineamento: una linea di riferimento e due barre */
export function AlignIcon({ mode }: { mode: AlignMode }): React.JSX.Element {
  const vertical = mode === 'left' || mode === 'hcenter' || mode === 'right'
  const bars = vertical
    ? (() => {
        const x = mode === 'left' ? 3 : mode === 'right' ? 13 : 8
        const at = (w: number): number =>
          mode === 'left' ? 3 : mode === 'right' ? 13 - w : 8 - w / 2
        return (
          <>
            <path d={`M${x} 1.5V14.5`} />
            <rect x={at(9)} y="3.5" width="9" height="3" fill="currentColor" stroke="none" />
            <rect x={at(5)} y="9.5" width="5" height="3" fill="currentColor" stroke="none" />
          </>
        )
      })()
    : (() => {
        const y = mode === 'top' ? 3 : mode === 'bottom' ? 13 : 8
        const at = (h: number): number =>
          mode === 'top' ? 3 : mode === 'bottom' ? 13 - h : 8 - h / 2
        return (
          <>
            <path d={`M1.5 ${y}H14.5`} />
            <rect x="3.5" y={at(9)} width="3" height="9" fill="currentColor" stroke="none" />
            <rect x="9.5" y={at(5)} width="3" height="5" fill="currentColor" stroke="none" />
          </>
        )
      })()
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      aria-hidden="true"
    >
      {bars}
    </svg>
  )
}

export function DistributeIcon({ axis }: { axis: 'h' | 'v' }): React.JSX.Element {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      style={axis === 'v' ? { transform: 'rotate(90deg)' } : undefined}
    >
      <rect x="1" y="4" width="3" height="8" />
      <rect x="6.5" y="2" width="3" height="12" />
      <rect x="12" y="5" width="3" height="6" />
    </svg>
  )
}
