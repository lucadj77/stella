import { useContext, useMemo, useState } from 'react'
import {
  COMPARISON_OPERATORS,
  evaluateNodeText,
  type BinaryOperator,
  type FormulaNode
} from '../../../shared/model/formula'
import {
  addArg,
  argSpec,
  catalogEntries,
  chainLength,
  firstEmpty,
  FORMULA_CATEGORIES,
  FUNCTION_SPECS,
  formulaText,
  hasEmpty,
  nodeAt,
  openFormula,
  partsFromTemplate,
  readText,
  removeArg,
  replaceAt,
  templateFromParts,
  writeText,
  type CatalogContext,
  type CellContext,
  type FormulaCategory,
  type NodePath,
  type SlotKind
} from '../../../shared/model/formulaAssist'
import { cellFields } from '../../../shared/model/bind'
import { SYSTEM_VARIABLES } from '../../../shared/model/system'
import { palette, resolveColor } from '../../../shared/model/variables'
import { plainText, serializeAttrs, type Attrs } from '../../../shared/model/markup'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import type { MessageKey } from '../i18n/en'
import { VariablesContext } from '../render/assets'
import AssetPicker from './AssetPicker'
import { ColorSwatch } from './ColorPicker'
import FormatDialog from './FormatDialog'

// Assistente formule (tasto fx): costruisce una formula a caselle. A sinistra la formula come
// blocchi, a destra cosa mettere nella casella scelta; sotto il testo della formula, che si può
// anche scrivere a mano, e il risultato sulla carta d'esempio. Vedi docs/specifica.md, "Formule".

/** Cosa produce la formula: decide la scheda proposta per i risultati */
export type FormulaExpect = 'text' | 'image' | 'color' | 'bool' | 'value'

interface Props {
  title?: string
  value: string
  expect: FormulaExpect
  /** Colonne del foglio e livelli del template che si possono richiamare */
  columns: string[]
  layers: string[]
  /** Campi della carta d'esempio, variabili e variabili di sistema comprese */
  sample: Record<string, string>
  /** Di quale carta è l'esempio, per esempio "Drago (Mostri)" */
  sampleLabel?: string
  /** Il livello fa parte del contenuto di una griglia: valgono {cell.*} */
  cells?: CellContext | null
  /** La formula deve dare vero o falso, come il filtro del generatore */
  condition?: boolean
  onApply(expr: string): void
  onClose(): void
}

type Tab =
  | 'field'
  | 'variable'
  | 'system'
  | 'number'
  | 'text'
  | 'color'
  | 'image'
  | 'bool'
  | 'compare'
  | 'formula'

const CELL_VARIABLES = ['cell.index', 'cell.row', 'cell.column', 'cell.count', 'cell.random']
const ARITHMETIC: BinaryOperator[] = ['+', '-', '*', '/']
const STRIP = 12

const same = (a: NodePath, b: NodePath | null): boolean =>
  !!b && a.length === b.length && a.every((x, i) => x === b[i])

export default function FormulaDialog({
  title,
  value,
  expect,
  columns,
  layers,
  sample,
  sampleLabel,
  cells,
  condition,
  onApply,
  onClose
}: Props): React.JSX.Element {
  const { t } = useI18n()
  const variables = useContext(VariablesContext)
  const opened = useMemo(() => openFormula(value), [value])
  const [root, setRoot] = useState<FormulaNode>(opened.node ?? { k: 'empty' })
  const [text, setText] = useState(value)
  const [textError, setTextError] = useState(opened.error ?? null)
  /** L'ultima modifica è nel testo: si scrive com'è, senza riformattarlo */
  const [typed, setTyped] = useState(true)
  const [selected, setSelected] = useState<NodePath | null>([])
  const ctx: CatalogContext = { inCell: !!cells }

  const fields = useMemo(() => {
    const out = { ...sample }
    if (cells)
      Object.assign(out, cellFields(cells.grid, 0, cells.columns, cells.rows * cells.columns))
    return out
  }, [sample, cells])
  const known = (name: string): boolean =>
    name in fields || columns.includes(name) || layers.includes(name)

  const change = (next: FormulaNode, select?: NodePath | null): void => {
    setRoot(next)
    setText(formulaText(next))
    setTextError(null)
    setTyped(false)
    if (select !== undefined) setSelected(select)
  }
  const typeText = (s: string): void => {
    setText(s)
    setTyped(true)
    const o = openFormula(s)
    if (o.node) {
      setRoot(o.node)
      setTextError(null)
      setSelected([])
    } else setTextError(o.error ?? null)
  }

  const preview = (n: FormulaNode): { value: string; error?: string } | null =>
    hasEmpty(n) ? null : evaluateNodeText(n, fields)
  const result = preview(root)
  const incomplete = hasEmpty(root)
  const unchanged = typed && text === value

  /** Che cosa ci si aspetta nella casella in `path` */
  const slotKind = (path: NodePath): SlotKind => {
    if (!path.length) return condition ? 'condition' : 'result'
    const parent = nodeAt(root, path.slice(0, -1))
    const i = path[path.length - 1]
    if (parent?.k === 'call') return argSpec(parent.fn, i).kind
    if (parent?.k === 'bin')
      return parent.op === '&' ? 'text' : ARITHMETIC.includes(parent.op) ? 'number' : 'value'
    return 'number'
  }

  // dentro una griglia si mostra la formula sulle prime caselle
  const strip = useMemo(() => {
    if (!cells || incomplete) return null
    const count = cells.rows * cells.columns
    return Array.from({ length: Math.min(STRIP, count) }, (_, i) => {
      const f = { ...sample, ...cellFields(cells.grid, i, cells.columns, count) }
      return evaluateNodeText(root, f)
    })
  }, [cells, incomplete, root, sample])

  const view = (
    <NodeView
      node={root}
      path={[]}
      root={root}
      selected={selected}
      onSelect={setSelected}
      onChange={change}
      preview={preview}
    />
  )

  return (
    <Dialog title={title ?? t('fx.title')} onClose={onClose}>
      <div className="formula-dialog">
        <div className="fx-main">
          <div className="fx-tree">
            {view}
            <p className="muted small">{t('fx.treeHint')}</p>
          </div>
          <div className="fx-side">
            {selected && nodeAt(root, selected) && (
              <SlotPicker
                key={selected.join('.')}
                node={nodeAt(root, selected)!}
                path={selected}
                kind={slotKind(selected)}
                expect={expect}
                ctx={ctx}
                columns={columns}
                layers={layers}
                fields={fields}
                known={known}
                variables={variables}
                onPick={(n, select) => {
                  const next = replaceAt(root, selected, n)
                  // dopo una scelta si passa alla prossima casella da riempire
                  change(next, select ?? firstEmpty(next) ?? selected)
                }}
                onRemove={
                  canRemove(root, selected)
                    ? () => change(removeArg(root, selected), selected.slice(0, -1))
                    : undefined
                }
              />
            )}
          </div>
        </div>
        <div className="fx-foot">
          <label className="fx-text">
            <span>{t('fx.formula')}</span>
            <textarea
              value={text}
              rows={2}
              spellCheck={false}
              onChange={(e) => typeText(e.target.value)}
            />
          </label>
          <p className={`small ${textError || result?.error ? 'fx-error' : 'muted'}`}>
            {textError
              ? t('fx.syntaxError', { error: textError })
              : incomplete
                ? t('fx.incomplete')
                : result?.error
                  ? t('fx.resultError', { error: result.error })
                  : sampleLabel
                    ? t('fx.result', { value: result?.value || '∅', card: sampleLabel })
                    : t('fx.resultDefaults', { value: result?.value || '∅' })}
          </p>
          {strip && (
            <div className="fx-strip" aria-label={t('fx.cells')}>
              <span className="muted small">{t('fx.cells')}</span>
              {strip.map((r, i) => (
                <span
                  key={i}
                  className={r.error ? 'fx-error' : undefined}
                  title={r.error ?? r.value}
                  style={{ color: r.error ? undefined : markupColor(r.value) }}
                >
                  {r.error ? '!' : plainText(r.value) || '∅'}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="dialog-buttons">
          <button onClick={onClose}>{t('dialog.cancel')}</button>
          <button
            className="primary"
            disabled={!!textError || incomplete}
            onClick={() => {
              onApply(unchanged ? value : typed ? text.trim() : formulaText(root))
              onClose()
            }}
          >
            {t('fx.apply')}
          </button>
        </div>
      </div>
    </Dialog>
  )
}

/** Il colore di un testo formattato tutto insieme, [10]{color=red}, per la striscia delle caselle */
function markupColor(v: string): string | undefined {
  const m = /^\[[^\]]*\]\{[^}]*\bcolor=([^\s}]+)/.exec(v.trim())
  return m ? m[1] : undefined
}

/** Un argomento oltre il minimo di una funzione con argomenti ripetibili si può togliere */
function canRemove(root: FormulaNode, path: NodePath): boolean {
  if (!path.length) return false
  const parent = nodeAt(root, path.slice(0, -1))
  if (parent?.k !== 'call') return false
  const spec = FUNCTION_SPECS[parent.fn]
  return !!spec?.variadic && parent.args.length > (spec.min ?? spec.args.length)
}

// --- la formula a caselle ---

interface ViewProps {
  node: FormulaNode
  path: NodePath
  root: FormulaNode
  selected: NodePath | null
  onSelect(p: NodePath): void
  onChange(n: FormulaNode, select?: NodePath | null): void
  preview(n: FormulaNode): { value: string; error?: string } | null
}

function NodeView(props: ViewProps): React.JSX.Element {
  const { node, path, root, selected, onSelect, onChange, preview } = props
  const { t } = useI18n()
  const sub = (child: FormulaNode, i: number): React.JSX.Element => (
    <NodeView {...props} node={child} path={[...path, i]} />
  )
  const slot = (
    label: string,
    child: FormulaNode,
    i: number,
    extra?: React.ReactNode
  ): React.JSX.Element => (
    <div className="fx-slot" key={i}>
      <span className="fx-slot-label">
        {label}
        {extra}
      </span>
      <div className="fx-slot-body">
        {sub(child, i)}
        <Preview node={child} preview={preview} />
      </div>
    </div>
  )
  const isSel = same(path, selected)
  const head = (name: string, fn?: string): React.JSX.Element => (
    <button
      type="button"
      className={`fx-node-head${isSel ? ' selected' : ''}`}
      onClick={() => onSelect(path)}
    >
      <strong>{name}</strong>
      {fn && <span className="fx-fn">{fn}</span>}
    </button>
  )

  // una catena di IF è un elenco di casi
  if (chainLength(node) >= 2) {
    const n = chainLength(node)
    const rows: React.JSX.Element[] = []
    for (let i = 0; i < n; i++) {
      const at = Array<number>(i).fill(2)
      const ifNode = nodeAt(node, at) as Extract<FormulaNode, { k: 'call' }>
      const remove = (): void => onChange(replaceAt(root, [...path, ...at], ifNode.args[2]), path)
      rows.push(
        <div className="fx-case" key={i}>
          <div className="fx-slot">
            <span className="fx-slot-label">
              {t('fx.arg.when', { n: i + 1 })}
              <button type="button" className="fx-mini" title={t('fx.removeCase')} onClick={remove}>
                ×
              </button>
            </span>
            <div className="fx-slot-body">
              <NodeView {...props} node={ifNode.args[0]} path={[...path, ...at, 0]} />
              <Preview node={ifNode.args[0]} preview={preview} />
            </div>
          </div>
          <div className="fx-slot">
            <span className="fx-slot-label">{t('fx.arg.then')}</span>
            <div className="fx-slot-body">
              <NodeView {...props} node={ifNode.args[1]} path={[...path, ...at, 1]} />
              <Preview node={ifNode.args[1]} preview={preview} />
            </div>
          </div>
        </div>
      )
    }
    const lastAt = Array<number>(n).fill(2)
    const otherwise = nodeAt(node, lastAt)!
    const addCase = (): void =>
      onChange(
        replaceAt(root, [...path, ...lastAt], {
          k: 'call',
          fn: 'IF',
          args: [{ k: 'empty' }, { k: 'empty' }, otherwise]
        }),
        [...path, ...lastAt, 0]
      )
    return (
      <div className="fx-node">
        {head(t('fx.entry.cases'), 'IF')}
        {rows}
        <div className="fx-slot">
          <span className="fx-slot-label">{t('fx.arg.otherwise')}</span>
          <div className="fx-slot-body">
            <NodeView {...props} node={otherwise} path={[...path, ...lastAt]} />
            <Preview node={otherwise} preview={preview} />
          </div>
        </div>
        <button type="button" className="fx-add" onClick={addCase}>
          {t('fx.addCase')}
        </button>
      </div>
    )
  }

  if (node.k === 'call') {
    const spec = FUNCTION_SPECS[node.fn]
    return (
      <div className="fx-node">
        {head(t(`fx.fn.${node.fn}` as MessageKey), node.fn)}
        {node.args.map((arg, i) =>
          slot(
            spec?.variadic && i >= spec.args.length - 1
              ? `${t(`fx.arg.${argSpec(node.fn, i).key}` as MessageKey)} ${i - spec.args.length + 2}`
              : t(`fx.arg.${argSpec(node.fn, i).key}` as MessageKey),
            arg,
            i
          )
        )}
        {spec?.variadic && (
          <button
            type="button"
            className="fx-add"
            onClick={() => onChange(addArg(root, path), [...path, node.args.length])}
          >
            {t('fx.addArg', {
              what: t(`fx.arg.${argSpec(node.fn, node.args.length).key}` as MessageKey)
            })}
          </button>
        )}
      </div>
    )
  }

  if (node.k === 'bin' && !readText(node)) {
    const ops: readonly BinaryOperator[] = COMPARISON_OPERATORS.includes(node.op as never)
      ? COMPARISON_OPERATORS
      : ARITHMETIC.includes(node.op)
        ? ARITHMETIC
        : ['&']
    const kind = node.op === '&' ? 'join' : ARITHMETIC.includes(node.op) ? 'calc' : 'compare'
    return (
      <div className="fx-node">
        {head(t(`fx.entry.${kind}` as MessageKey))}
        {slot(t('fx.arg.left'), node.l, 0)}
        {ops.length > 1 && (
          <div className="fx-slot">
            <span className="fx-slot-label">{t('fx.arg.operator')}</span>
            <select
              className="fx-op"
              value={node.op}
              onChange={(e) =>
                onChange(replaceAt(root, path, { ...node, op: e.target.value as BinaryOperator }))
              }
            >
              {ops.map((o) => (
                <option key={o} value={o}>
                  {o} · {t(`fx.op.${o}` as MessageKey)}
                </option>
              ))}
            </select>
          </div>
        )}
        {slot(t('fx.arg.right'), node.r, 1)}
      </div>
    )
  }

  if (node.k === 'neg')
    return (
      <div className="fx-node">
        {head(t('fx.negative'))}
        {slot(t('fx.arg.number'), node.v, 0)}
      </div>
    )

  return <Leaf node={node} selected={isSel} onClick={() => onSelect(path)} />
}

function Preview({
  node,
  preview
}: {
  node: FormulaNode
  preview: ViewProps['preview']
}): React.JSX.Element | null {
  const { t } = useI18n()
  if (node.k === 'empty' || node.k === 'num' || node.k === 'str' || node.k === 'bool') return null
  const p = preview(node)
  if (!p) return null
  return (
    <span className={`fx-preview${p.error ? ' fx-error' : ''}`}>
      {p.error ? t('fx.resultError', { error: p.error }) : `= ${p.value || '∅'}`}
    </span>
  )
}

/** Nome comprensibile di un campo: le variabili di sistema e di casella hanno il loro */
function useFieldLabel(): (name: string) => string {
  const { t } = useI18n()
  return (name) =>
    (SYSTEM_VARIABLES as readonly string[]).includes(name) || CELL_VARIABLES.includes(name)
      ? t(`fx.var.${name}` as MessageKey)
      : name
}

function Leaf({
  node,
  selected,
  onClick
}: {
  node: FormulaNode
  selected: boolean
  onClick(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const label = useFieldLabel()
  const variables = useContext(VariablesContext)
  const pal = useMemo(() => palette(variables), [variables])
  const cls = `fx-leaf${selected ? ' selected' : ''}`
  const text = node.k === 'bin' || node.k === 'str' ? readText(node) : null
  let body: React.ReactNode
  if (node.k === 'empty') body = <span className="fx-empty">{t('fx.choose')}</span>
  else if (node.k === 'num') body = <span className="fx-chip">{node.v}</span>
  else if (node.k === 'bool')
    body = <span className="fx-chip">{node.v ? t('fx.yes') : t('fx.no')}</span>
  else if (node.k === 'field') body = <span className="fx-chip fx-var">{label(node.name)}</span>
  else if (text) {
    const attrs = serializeAttrs(text.attrs)
    const color = node.k === 'str' && isColorText(node.v, pal) ? resolveColor(node.v, pal) : null
    body = (
      <>
        {color && <span className="fx-swatch" style={{ background: color }} />}
        {text.parts.length === 0 && <span className="fx-chip fx-txt">“”</span>}
        {text.parts.map((p, i) =>
          'text' in p ? (
            <span key={i} className="fx-chip fx-txt">
              “{p.text}”
            </span>
          ) : (
            <span key={i} className="fx-chip fx-var">
              {label(p.field)}
            </span>
          )
        )}
        {attrs && <span className="fx-chip fx-attrs">{attrs}</span>}
      </>
    )
  } else body = <span className="fx-chip">?</span>
  return (
    <button type="button" className={cls} onClick={onClick}>
      {body}
    </button>
  )
}

const isColorText = (v: string, pal: Record<string, string>): boolean =>
  /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v.trim()) || v.trim() in pal

// --- cosa mettere nella casella ---

interface PickerProps {
  node: FormulaNode
  path: NodePath
  kind: SlotKind
  expect: FormulaExpect
  ctx: CatalogContext
  columns: string[]
  layers: string[]
  fields: Record<string, string>
  known(name: string): boolean
  variables: React.ContextType<typeof VariablesContext>
  onPick(n: FormulaNode, select?: NodePath | null): void
  onRemove?(): void
}

function firstTab(kind: SlotKind, expect: FormulaExpect, node: FormulaNode): Tab {
  if (node.k === 'call' || (node.k === 'bin' && !readText(node))) return 'formula'
  if (node.k === 'field') return 'field'
  if (node.k === 'num') return 'number'
  if (node.k === 'bool') return 'bool'
  if (kind === 'condition') return 'compare'
  if (kind === 'number') return 'number'
  if (kind === 'text') return 'text'
  if (kind === 'value') return 'field'
  return expect === 'value' ? 'field' : expect === 'bool' ? 'bool' : expect
}

function SlotPicker(p: PickerProps): React.JSX.Element {
  const { t } = useI18n()
  // una formula nuova parte dal catalogo
  const [tab, setTab] = useState<Tab>(() =>
    !p.path.length && p.node.k === 'empty' ? 'formula' : firstTab(p.kind, p.expect, p.node)
  )
  const tabs: Tab[] = [
    'field',
    'variable',
    'system',
    'number',
    'text',
    'color',
    ...(p.expect === 'image' ? (['image'] as Tab[]) : []),
    'bool',
    'compare',
    'formula'
  ]
  return (
    <div className="fx-picker">
      <span className="fx-picker-title">{t(`fx.kind.${p.kind}` as MessageKey)}</span>
      <div className="fx-tabs" role="tablist">
        {tabs.map((x) => (
          <button
            key={x}
            type="button"
            role="tab"
            aria-selected={tab === x}
            className={tab === x ? 'on' : undefined}
            onClick={() => setTab(x)}
          >
            {t(`fx.tab.${x}` as MessageKey)}
          </button>
        ))}
      </div>
      <div className="fx-tab-body">
        {tab === 'field' && <FieldTab {...p} />}
        {tab === 'variable' && <VariableTab {...p} />}
        {tab === 'system' && <SystemTab {...p} />}
        {tab === 'number' && <NumberTab {...p} />}
        {tab === 'text' && <TextTab {...p} />}
        {tab === 'color' && <ColorTab {...p} />}
        {tab === 'image' && <ImageTab {...p} />}
        {tab === 'bool' && (
          <div className="fx-row">
            <button type="button" onClick={() => p.onPick({ k: 'bool', v: true })}>
              {t('fx.yes')}
            </button>
            <button type="button" onClick={() => p.onPick({ k: 'bool', v: false })}>
              {t('fx.no')}
            </button>
          </div>
        )}
        {tab === 'compare' && <CompareTab {...p} />}
        {tab === 'formula' && <FormulaTab {...p} />}
      </div>
      <div className="fx-row fx-picker-actions">
        {p.node.k !== 'empty' && (
          <button type="button" onClick={() => p.onPick({ k: 'empty' })}>
            {t('fx.clear')}
          </button>
        )}
        {p.onRemove && (
          <button type="button" onClick={p.onRemove}>
            {t('fx.removeArg')}
          </button>
        )}
      </div>
    </div>
  )
}

function PickList({
  items,
  onPick,
  empty
}: {
  items: { key: string; label: string; detail?: string }[]
  onPick(key: string): void
  empty: string
}): React.JSX.Element {
  const { t } = useI18n()
  const [filter, setFilter] = useState('')
  const f = filter.trim().toLowerCase()
  const shown = items.filter(
    (i) => !f || i.label.toLowerCase().includes(f) || i.key.toLowerCase().includes(f)
  )
  if (!items.length) return <p className="muted small">{empty}</p>
  return (
    <>
      {items.length > 8 && (
        <input
          className="fx-filter"
          placeholder={t('fx.filter')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      )}
      <div className="fx-list">
        {shown.map((i) => (
          <button key={i.key} type="button" onClick={() => onPick(i.key)}>
            <span>{i.label}</span>
            {i.detail !== undefined && <small>{i.detail}</small>}
          </button>
        ))}
      </div>
    </>
  )
}

const short = (v: string | undefined): string =>
  v === undefined ? '' : v.length > 24 ? v.slice(0, 23) + '…' : v || '∅'

function FieldTab(p: PickerProps): React.JSX.Element {
  const { t } = useI18n()
  const names = [...new Set([...p.columns, ...p.layers])]
  return (
    <PickList
      empty={t('fx.noFields')}
      items={names.map((n) => ({ key: n, label: n, detail: short(p.fields[n]) }))}
      onPick={(name) => p.onPick({ k: 'field', name })}
    />
  )
}

function VariableTab(p: PickerProps): React.JSX.Element {
  const { t } = useI18n()
  const vars = Object.entries(p.variables ?? {}).sort(([a], [b]) => a.localeCompare(b))
  return (
    <PickList
      empty={t('fx.noVariables')}
      items={vars.map(([name, v]) => ({
        key: name,
        label: name,
        detail: t(`fx.varType.${v.type}` as MessageKey)
      }))}
      onPick={(name) => {
        const v = p.variables?.[name]
        // i colori e le immagini valgono per nome; testi e valori come campi
        p.onPick(
          v?.type === 'color' || v?.type === 'image' ? { k: 'str', v: name } : { k: 'field', name }
        )
      }}
    />
  )
}

function SystemTab(p: PickerProps): React.JSX.Element {
  const { t } = useI18n()
  const label = useFieldLabel()
  const names = [...(p.ctx.inCell ? CELL_VARIABLES : []), ...SYSTEM_VARIABLES]
  return (
    <>
      {!p.ctx.inCell && <p className="muted small">{t('fx.cellsOnlyInGrid')}</p>}
      <PickList
        empty=""
        items={names.map((n) => ({ key: n, label: label(n), detail: `{${n}}` }))}
        onPick={(name) => p.onPick({ k: 'field', name })}
      />
    </>
  )
}

function NumberTab(p: PickerProps): React.JSX.Element {
  const { t } = useI18n()
  const [v, setV] = useState(p.node.k === 'num' ? String(p.node.v) : '')
  const n = Number(v.replace(',', '.'))
  const ok = v.trim() !== '' && Number.isFinite(n)
  const pick = (): void => {
    if (ok) p.onPick(n < 0 ? { k: 'neg', v: { k: 'num', v: -n } } : { k: 'num', v: n })
  }
  return (
    <div className="fx-row">
      <input
        type="text"
        inputMode="decimal"
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && pick()}
      />
      <button type="button" className="primary" disabled={!ok} onClick={pick}>
        {t('fx.use')}
      </button>
    </div>
  )
}

function TextTab(p: PickerProps): React.JSX.Element {
  const { t } = useI18n()
  const current = p.node.k === 'str' || p.node.k === 'bin' ? readText(p.node) : null
  const [src, setSrc] = useState(current ? templateFromParts(current.parts) : '')
  const [attrs, setAttrs] = useState<Attrs>(current?.attrs ?? { styles: [] })
  const [formatting, setFormatting] = useState(false)
  const names = [...new Set([...p.columns, ...p.layers])]
  const label = useFieldLabel()
  const insertable = [...names, ...(p.ctx.inCell ? CELL_VARIABLES : []), ...SYSTEM_VARIABLES]
  const pick = (): void => p.onPick(writeText({ parts: partsFromTemplate(src, p.known), attrs }))
  const fmt = serializeAttrs(attrs)
  return (
    <div className="fx-text-tab">
      <textarea
        rows={2}
        autoFocus
        value={src}
        placeholder={t('fx.textPlaceholder')}
        onChange={(e) => setSrc(e.target.value)}
      />
      <div className="fx-row">
        <select
          value=""
          onChange={(e) => e.target.value && setSrc(src + `{${e.target.value}}`)}
          aria-label={t('fx.insertField')}
        >
          <option value="">{t('fx.insertField')}</option>
          {insertable.map((n) => (
            <option key={n} value={n}>
              {label(n)}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => setFormatting(true)}>
          {t('fx.format')}
        </button>
      </div>
      {fmt && (
        <p className="small">
          {t('fx.formatted', { attrs: fmt })}{' '}
          <button type="button" className="link" onClick={() => setAttrs({ styles: [] })}>
            {t('fx.removeFormat')}
          </button>
        </p>
      )}
      <p className="muted small">{t('fx.textHint')}</p>
      <button type="button" className="primary" onClick={pick}>
        {t('fx.use')}
      </button>
      {formatting && (
        <FormatDialog
          initial={attrs}
          sample={src || t('fx.textSample')}
          mode="text"
          onApply={(a) => {
            setAttrs(a)
            setFormatting(false)
          }}
          onClose={() => setFormatting(false)}
        />
      )}
    </div>
  )
}

function ColorTab(p: PickerProps): React.JSX.Element {
  const { t } = useI18n()
  const [v, setV] = useState(p.node.k === 'str' ? p.node.v : '#A33A2A')
  return (
    <div className="fx-row">
      <ColorSwatch value={v} onChange={setV} />
      <span className="mono small">{v}</span>
      <button type="button" className="primary" onClick={() => p.onPick({ k: 'str', v })}>
        {t('fx.use')}
      </button>
    </div>
  )
}

function ImageTab(p: PickerProps): React.JSX.Element {
  const { t } = useI18n()
  const [picking, setPicking] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setPicking(true)}>
        {t('fx.chooseImage')}
      </button>
      {picking && (
        <AssetPicker
          value={p.node.k === 'str' ? p.node.v : ''}
          onPick={(name) => {
            setPicking(false)
            p.onPick({ k: 'str', v: name })
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  )
}

function CompareTab(p: PickerProps): React.JSX.Element {
  const { t } = useI18n()
  const left = p.node.k === 'empty' || isComparison(p.node) ? null : p.node
  return (
    <>
      <p className="muted small">{left ? t('fx.compareKeep') : t('fx.compareHint')}</p>
      <div className="fx-list">
        {COMPARISON_OPERATORS.map((op) => (
          <button
            key={op}
            type="button"
            onClick={() =>
              p.onPick({ k: 'bin', op, l: left ?? { k: 'empty' }, r: { k: 'empty' } }, [
                ...p.path,
                left ? 1 : 0
              ])
            }
          >
            <span>{t(`fx.op.${op}` as MessageKey)}</span>
            <small className="mono">{op}</small>
          </button>
        ))}
      </div>
    </>
  )
}

const isComparison = (n: FormulaNode): boolean =>
  n.k === 'bin' && (COMPARISON_OPERATORS as readonly string[]).includes(n.op)

function FormulaTab(p: PickerProps): React.JSX.Element {
  const { t } = useI18n()
  const [category, setCategory] = useState<FormulaCategory>(
    p.kind === 'condition' ? 'condition' : p.ctx.inCell ? 'recipes' : 'condition'
  )
  const filled = p.node.k !== 'empty'
  const [wrap, setWrap] = useState(false)
  return (
    <>
      <div className="fx-categories">
        {FORMULA_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            className={category === c ? 'on' : undefined}
            onClick={() => setCategory(c)}
          >
            {t(`fx.cat.${c}` as MessageKey)}
          </button>
        ))}
      </div>
      {filled && (
        <label className="fx-row small">
          <input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.target.checked)} />
          {t('fx.wrap')}
        </label>
      )}
      <div className="fx-list">
        {catalogEntries(category, p.ctx).map((e) => (
          <button
            key={e.id}
            type="button"
            title={t(`fx.entry.${e.id}.hint` as MessageKey)}
            onClick={() => {
              let n = e.make(p.ctx)
              // il valore della casella diventa il primo argomento della funzione scelta
              if (wrap && filled && n.k === 'call') n = { ...n, args: [p.node, ...n.args.slice(1)] }
              else if (wrap && filled && n.k === 'bin') n = { ...n, l: p.node }
              p.onPick(n, null)
            }}
          >
            <span>{t(`fx.entry.${e.id}` as MessageKey)}</span>
            <small>{e.fn ?? ''}</small>
            <em>{t(`fx.entry.${e.id}.hint` as MessageKey)}</em>
          </button>
        ))}
      </div>
    </>
  )
}
