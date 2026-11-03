import { useEffect, useRef, useState } from 'react'
import type { ColumnInfo } from '../../../shared/model/sheet'
import {
  ALL_COLORS,
  cleanColors,
  keyColor,
  type ColorKey,
  type SetColorColumn,
  type SetColors
} from '../../../shared/model/setColors'
import { useI18n } from '../i18n/context'

interface Props {
  /** Tutti i campi del set, anche nascosti e calcolati */
  columns: ColumnInfo[]
  colors: SetColors | undefined
  /** Valori o fasce di ogni campo */
  keysOf(column: string): ColorKey[]
  onChange(colors: SetColors | undefined): void
  open: boolean
  onOpen(open: boolean): void
  /** Campo da aprire subito, con i suoi colori */
  focus?: string | null
}

/**
 * «Colori»: quali campi colorano le celle della tabella e con quali colori. Ogni campo spuntato
 * colora la sua colonna; con un campo solo si può colorare tutta la riga.
 */
export default function ColorsMenu({
  columns,
  colors,
  keysOf,
  onChange,
  open,
  onOpen,
  focus
}: Props): React.JSX.Element {
  const { t } = useI18n()
  const boxRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  /** La chiave di cui si sceglie il colore: campo e valore */
  const [picking, setPicking] = useState<{ column: string; key: string } | null>(null)
  const [prevFocus, setPrevFocus] = useState(focus)
  if (focus !== prevFocus) {
    setPrevFocus(focus)
    if (focus) setExpanded(focus)
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent): void => {
      const target = e.target as HTMLElement
      if (!boxRef.current?.contains(target) && !target.closest('.colors-legend')) onOpen(false)
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onOpen(false)
    }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onOpen])

  const list = colors?.columns ?? []
  const fields = columns.filter(
    (c, i) =>
      c.header && !c.header.includes('.') && columns.findIndex((x) => x.header === c.header) === i
  )
  const save = (next: SetColors): void => onChange(cleanColors(next))
  const toggle = (column: string): void => {
    const on = list.some((c) => c.column === column)
    save({
      ...colors,
      columns: on ? list.filter((c) => c.column !== column) : [...list, { column }]
    })
    setExpanded(on ? null : column)
  }
  const setColor = (column: SetColorColumn, key: string, color: string | null): void => {
    const next = { ...(column.colors ?? {}) }
    if (color) next[key] = color
    else delete next[key]
    save({
      ...colors,
      columns: list.map((c) => (c.column === column.column ? { ...c, colors: next } : c))
    })
  }

  return (
    <div className="columns-menu colors-menu" ref={boxRef}>
      <button
        className={open || list.length ? 'active' : undefined}
        aria-expanded={open}
        title={t('tip.colors')}
        onClick={() => onOpen(!open)}
      >
        {t('set.colors')}
        {list.length ? ` (${list.length})` : ''}
      </button>
      {open && (
        <div className="columns-menu-panel colors-menu-panel" role="dialog">
          <p className="colors-menu-title">{t('colors.title')}</p>
          <p className="muted small">{t('colors.hint')}</p>
          <div className="colors-menu-list">
            {fields.map((c) => {
              const chosen = list.find((x) => x.column === c.header)
              const keys = chosen ? keysOf(c.header) : []
              const isOpen = chosen && expanded === c.header
              return (
                <div key={c.header} className="colors-menu-field">
                  <div className="colors-menu-row">
                    <label className="columns-menu-item">
                      <input type="checkbox" checked={!!chosen} onChange={() => toggle(c.header)} />
                      <span>
                        {c.computed && <span className="calc-mark">ƒ </span>}
                        {c.header === 'amount' ? t('cardForm.amount') : c.header}
                      </span>
                    </label>
                    {chosen && (
                      <button
                        className="colors-expand"
                        onClick={() => setExpanded(isOpen ? null : c.header)}
                      >
                        {keys.slice(0, 6).map((k) => (
                          <span
                            key={k.key}
                            className="colors-dot"
                            style={{ background: keyColor(chosen, keys, k.key) }}
                          />
                        ))}
                        {isOpen ? ' ▴' : ' ▾'}
                      </button>
                    )}
                  </div>
                  {isOpen && (
                    <div className="colors-menu-values">
                      {keys.map((k) => {
                        const color = keyColor(chosen, keys, k.key)
                        const here = picking?.column === c.header && picking.key === k.key
                        return (
                          <div key={k.key} className="colors-menu-value">
                            <button
                              className="colors-swatch"
                              style={{ background: color }}
                              title={t('colors.legendHint')}
                              onClick={() =>
                                setPicking(here ? null : { column: c.header, key: k.key })
                              }
                            />
                            <span>{k.label}</span>
                            {here && (
                              <div className="colors-palette">
                                {ALL_COLORS.map((p) => (
                                  <button
                                    key={p}
                                    className={p === color ? 'colors-swatch on' : 'colors-swatch'}
                                    style={{ background: p }}
                                    onClick={() => {
                                      setColor(chosen, k.key, p)
                                      setPicking(null)
                                    }}
                                  />
                                ))}
                                <label className="colors-other" title={t('colors.other')}>
                                  <input
                                    type="color"
                                    value={color}
                                    onChange={(e) => setColor(chosen, k.key, e.target.value)}
                                  />
                                </label>
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {chosen.colors && Object.keys(chosen.colors).length > 0 && (
                        <button
                          className="colors-reset"
                          onClick={() =>
                            save({
                              ...colors,
                              columns: list.map((x) =>
                                x.column === c.header ? { column: x.column } : x
                              )
                            })
                          }
                        >
                          {t('colors.reset')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <label
            className="columns-menu-item columns-menu-computed"
            title={t('colors.wholeRowHint')}
          >
            <input
              type="checkbox"
              disabled={list.length !== 1}
              checked={!!colors?.wholeRow && list.length === 1}
              onChange={(e) => save({ columns: list, wholeRow: e.target.checked })}
            />
            <span className={list.length !== 1 ? 'muted' : undefined}>{t('colors.wholeRow')}</span>
          </label>
        </div>
      )}
    </div>
  )
}
