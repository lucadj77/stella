import { useRef, useState } from 'react'
import NumInput from './NumInput'
import { useUndo } from './useUndo'
import type { LoadedSet } from '../../../shared/project'
import type { HAlign, Template } from '../../../shared/model/template'
import { tableSource } from '../../../shared/model/document'
import {
  DEFAULT_TABLE_STYLE,
  TABLE_LINES,
  type TableLines,
  type TableStyle
} from '../../../shared/model/docTable'
import { Dialog } from '../editor/dialogs'
import { ColorField, NumberField, SelectField } from '../editor/fields'
import { useI18n } from '../i18n/context'
import { runEdit } from './editRun'
import ImageDialog from './ImageDialog'
import InsertCardDialog from './InsertCardDialog'
import FormattedField, { TextFormatBar, ToolButton } from './TextFormatBar'
import { ImageIcon } from './icons'

// Tabella di un documento compilata in una griglia, senza scrivere il Markdown a mano. Apre
// anche la tabella su cui sta il cursore, per modificarla. Si può incollare da un foglio di
// calcolo: le celle copiate riempiono la griglia a partire da quella scelta. Le celle hanno il
// markup, immagini e carte; sotto, l'aspetto: larghezze, linee e sfondi (model/docTable.ts).

export interface TableValue {
  header: string[]
  align: (HAlign | null)[]
  rows: string[][]
  style?: TableStyle
}

const EMPTY: TableValue = {
  header: ['', '', ''],
  align: [null, null, null],
  rows: [
    ['', '', ''],
    ['', '', '']
  ]
}

export default function TableDialog({
  initial,
  sets,
  templates,
  project,
  onSave,
  onClose
}: {
  /** La tabella da modificare; senza, una nuova */
  initial?: TableValue
  sets: LoadedSet[]
  templates: Template[]
  project: string
  /** Il Markdown della tabella */
  onSave(text: string): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const [table, setTable] = useState<TableValue>(initial ?? EMPTY)
  const [style, setStyle] = useState<TableStyle>(initial?.style ?? DEFAULT_TABLE_STYLE)
  const change = (c: Partial<TableStyle>): void => setStyle({ ...style, ...c })
  /** La cella dove si scrive: la barra, l'immagine e la carta lavorano lì */
  const cellField = useRef<HTMLTextAreaElement | null>(null)
  const [inserting, setInserting] = useState<'image' | 'card' | null>(null)
  useUndo(
    [table, style],
    ([tb, st]) => {
      setTable(tb)
      setStyle(st)
    },
    !inserting
  )
  /** Mette un'immagine o una carta al cursore della cella */
  const insert = (md: string): void => {
    setInserting(null)
    const one = md.replace(/\s*\n\s*/g, ' ').trim()
    runEdit(cellField.current, (s, a, b) => ({
      text: s.slice(0, a) + one + s.slice(b),
      from: a + one.length,
      to: a + one.length
    }))
  }
  const setColumnWidth = (c: number, w: number): void => {
    const columns = Array.from({ length: cols }, (_, k) => style.columns[k] ?? 0)
    columns[c] = w
    // senza nessuna larghezza scritta le colonne seguono il contenuto
    change({ columns: columns.some((x) => x > 0) ? columns.map((x) => x || 0) : [] })
  }
  const cols = table.header.length
  /** Righe della griglia: la prima è l'intestazione */
  const grid = [table.header, ...table.rows]

  const setGrid = (g: string[][], align = table.align): void =>
    setTable({ header: g[0], rows: g.slice(1), align })
  const setCell = (r: number, c: number, value: string): void =>
    setGrid(grid.map((row, i) => (i === r ? row.map((x, k) => (k === c ? value : x)) : row)))
  const addColumn = (): void =>
    setGrid(
      grid.map((row) => [...row, '']),
      [...table.align, null]
    )
  const removeColumn = (c: number): void => {
    setGrid(
      grid.map((row) => row.filter((_, k) => k !== c)),
      table.align.filter((_, k) => k !== c)
    )
    if (style.columns.length) change({ columns: style.columns.filter((_, k) => k !== c) })
  }
  const addRow = (): void => setGrid([...grid, Array<string>(cols).fill('')])
  const removeRow = (r: number): void => setGrid(grid.filter((_, i) => i !== r))
  const setAlign = (c: number, a: HAlign | null): void =>
    setTable({ ...table, align: table.align.map((x, k) => (k === c ? a : x)) })

  /** Incolla celle copiate da un foglio di calcolo (separate da tabulazioni e a capo) */
  const paste = (r: number, c: number, e: React.ClipboardEvent<HTMLTextAreaElement>): void => {
    const text = e.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n').replace(/\n$/, '')
    if (!text.includes('\t') && !text.includes('\n')) return
    e.preventDefault()
    const cells = text.split('\n').map((l) => l.split('\t'))
    const width = Math.max(cols, c + Math.max(...cells.map((l) => l.length)))
    const height = Math.max(grid.length, r + cells.length)
    const next = Array.from({ length: height }, (_, i) =>
      Array.from({ length: width }, (_, k) => cells[i - r]?.[k - c] ?? grid[i]?.[k] ?? '')
    )
    const align = Array.from({ length: width }, (_, k) => table.align[k] ?? null)
    setGrid(next, align)
  }

  const ok = cols > 0 && grid.some((row) => row.some((c) => c.trim()))
  return (
    <Dialog
      title={initial ? t('documents.editTable') : t('documents.insertTable')}
      onClose={onClose}
    >
      <div className="dialog-form table-dialog">
        <div className="table-dialog-tools">
          <TextFormatBar editor={cellField} />
          <ToolButton title={t('docTools.imageHint')} onClick={() => setInserting('image')}>
            <ImageIcon /> {t('docTools.image')}
          </ToolButton>
          <ToolButton title={t('documents.insertCardHint')} onClick={() => setInserting('card')}>
            {t('documents.insertCard')}
          </ToolButton>
        </div>
        <div className="table-dialog-scroll">
          <table className="table-dialog-grid">
            <thead>
              <tr>
                {table.align.map((a, c) => (
                  <th key={c}>
                    <select
                      value={a ?? ''}
                      title={t('documents.tableAlign')}
                      onChange={(e) => setAlign(c, (e.target.value || null) as HAlign | null)}
                    >
                      <option value="">{t('documents.tableAlignAuto')}</option>
                      <option value="left">{t('documents.alignLeft')}</option>
                      <option value="center">{t('documents.tableAlignCenter')}</option>
                      <option value="right">{t('documents.tableAlignRight')}</option>
                    </select>
                    <button
                      className="icon-btn danger"
                      title={t('documents.removeColumn')}
                      disabled={cols <= 1}
                      onClick={() => removeColumn(c)}
                    >
                      ×
                    </button>
                    <NumInput
                      allowEmpty
                      className="num"
                      min={0}
                      max={100}
                      title={t('documents.tableColumnWidth')}
                      placeholder={t('documents.tableAuto')}
                      value={style.columns[c] || ''}
                      onChange={(e) => setColumnWidth(c, Math.max(0, Number(e.target.value) || 0))}
                    />
                    %
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {grid.map((row, r) => (
                <tr key={r} className={r === 0 ? 'table-dialog-header' : undefined}>
                  {row.map((value, c) => (
                    <td key={c} style={{ textAlign: table.align[c] ?? undefined }}>
                      <FormattedField
                        singleLine
                        rows={1}
                        value={value}
                        placeholder={r === 0 ? t('documents.tableHeading') : ''}
                        onFocus={(el) => {
                          cellField.current = el
                        }}
                        onChange={(v) => setCell(r, c, v)}
                        onPaste={(e) => paste(r, c, e)}
                      />
                    </td>
                  ))}
                  <td>
                    {r > 0 && (
                      <button
                        className="icon-btn danger"
                        title={t('documents.removeRow')}
                        onClick={() => removeRow(r)}
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="dialog-row">
          <button onClick={addRow}>{t('documents.addRow')}</button>
          <button onClick={addColumn}>{t('documents.addColumn')}</button>
        </div>
        <p className="muted small">{t('documents.tableHint')}</p>
        <h3>{t('documents.tableLook')}</h3>
        <div className="table-dialog-look">
          <NumberField
            label={t('documents.tableWidth')}
            hint={t('documents.tableWidthHint')}
            value={style.width ?? 0}
            min={0}
            max={100}
            step={5}
            unit="%"
            onChange={(w) => change({ width: w > 0 ? w : null })}
          />
          <SelectField<TableLines>
            label={t('documents.tableLines')}
            value={style.lines}
            options={TABLE_LINES.map((l) => [l, t(`documents.tableLines.${l}`)])}
            onChange={(lines) => change({ lines })}
          />
          <ColorField
            label={t('documents.tableBorder')}
            value={style.border}
            onChange={(border) => change({ border: border ?? DEFAULT_TABLE_STYLE.border })}
          />
          <NumberField
            label={t('documents.tableBorderWidth')}
            value={style.borderWidth}
            min={0}
            step={0.05}
            unit="mm"
            onChange={(borderWidth) => change({ borderWidth })}
          />
          <ColorField
            label={t('documents.tableHeaderFill')}
            value={style.header}
            nullable
            onChange={(header) => change({ header })}
          />
          <ColorField
            label={t('documents.tableFill')}
            value={style.fill}
            nullable
            onChange={(fill) => change({ fill })}
          />
          <ColorField
            label={t('documents.tableStripes')}
            hint={t('documents.tableStripesHint')}
            value={style.stripes}
            nullable
            onChange={(stripes) => change({ stripes })}
          />
        </div>
        <div className="dialog-buttons">
          <button onClick={onClose}>{t('dialog.cancel')}</button>
          <button
            className="primary"
            disabled={!ok}
            onClick={() =>
              // le righe rimaste vuote non si scrivono
              onSave(
                tableSource(
                  table.header,
                  table.align,
                  table.rows.filter((r) => r.some((c) => c.trim())),
                  style
                )
              )
            }
          >
            {initial ? t('documents.saveTable') : t('documents.insert')}
          </button>
        </div>
      </div>
      {inserting === 'image' && <ImageDialog onSave={insert} onClose={() => setInserting(null)} />}
      {inserting === 'card' && (
        <InsertCardDialog
          sets={sets}
          templates={templates}
          project={project}
          onInsert={insert}
          onClose={() => setInserting(null)}
        />
      )}
    </Dialog>
  )
}
