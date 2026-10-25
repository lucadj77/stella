import { useContext, useMemo, useRef, useState } from 'react'
import {
  COMPARISON_OPERATORS,
  evaluateNodeText,
  printExpression,
  type BinaryOperator,
  type FormulaNode
} from '../../../shared/model/formula'
import {
  addArg,
  argSpec,
  availableSentences,
  catalogEntries,
  chainLength,
  defaultField,
  firstGuidedBlank,
  guide,
  guidedBlanks,
  type GuidedPart,
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
  type FormattedText,
  writeText,
  type CatalogContext,
  type CellContext,
  type FormulaCategory,
  type NodePath,
  type SentenceContext,
  type SentenceDefaults,
  type SentenceTemplate,
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

// Assistente formule (tasto fx). Tre modi: la schermata iniziale chiede cosa si vuole fare; il
// modo guidato mostra la formula come una frase con gli spazi da riempire; il modo avanzato la
// mostra a caselle annidate, con il testo della formula che si può anche scrivere a mano. In
// tutti i casi il risultato si vede sulla carta d'esempio. Vedi docs/specifica.md, "Formule".

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
  /**
   * Il livello è una griglia: le variazioni casella per casella non si fanno qui ma sul
   * contenuto delle caselle, che questo crea (e chiude la finestra)
   */
  onVaryCells?(): void
  /** Apre su «Cosa vuoi fare?» anche se c'è già una formula (testo appena creato nelle caselle) */
  startScreen?: boolean
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

type Mode = 'start' | 'guided' | 'advanced'

const CELL_VARIABLES = ['cell.index', 'cell.row', 'cell.column', 'cell.count', 'cell.random']
const ARITHMETIC: BinaryOperator[] = ['+', '-', '*', '/']
const STRIP = 12

const same = (a: NodePath, b: NodePath | null): boolean =>
  !!b && a.length === b.length && a.every((x, i) => x === b[i])

/** Risultati proposti dai modelli, secondo ciò che il livello si aspetta */
function defaultResults(
  expect: FormulaExpect,
  t: (k: MessageKey) => string
): [FormulaNode, FormulaNode] {
  switch (expect) {
    case 'color':
      return [
        { k: 'str', v: '#A33A2A' },
        { k: 'str', v: '#FFFFFF' }
      ]
    case 'bool':
      return [
        { k: 'bool', v: true },
        { k: 'bool', v: false }
      ]
    case 'value':
      return [
        { k: 'num', v: 1 },
        { k: 'num', v: 0 }
      ]
    case 'image':
      return [{ k: 'empty' }, { k: 'empty' }]
    default:
      return [
        { k: 'str', v: t('fx.yes.sample') },
        { k: 'str', v: t('fx.no.sample') }
      ]
  }
}

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
  onVaryCells,
  startScreen = false,
  onApply,
  onClose
}: Props): React.JSX.Element {
  const { t } = useI18n()
  const variables = useContext(VariablesContext)
  const ctx: CatalogContext = useMemo(() => ({ inCell: !!cells }), [cells])
  const sctx: SentenceContext = {
    inCell: !!cells,
    condition: !!condition,
    onGrid: !!onVaryCells,
    bool: expect === 'bool',
    text: expect === 'text'
  }
  const opened = useMemo(() => openFormula(value), [value])
  const [root, setRoot] = useState<FormulaNode>(opened.node ?? { k: 'empty' })
  const [text, setText] = useState(value)
  const [textError, setTextError] = useState(opened.error ?? null)
  /** L'ultima modifica è nel testo: si scrive com'è, senza riformattarlo */
  const [typed, setTyped] = useState(true)
  const [mode, setMode] = useState<Mode>(() =>
    startScreen || !value.trim()
      ? 'start'
      : opened.node && guide(opened.node, ctx)
        ? 'guided'
        : 'advanced'
  )
  // in modalità guidata parte selezionato il primo spazio della frase, non l'intera formula
  const [selected, setSelected] = useState<NodePath | null>(() => {
    const first = mode === 'guided' && opened.node ? guide(opened.node, ctx) : null
    return (opened.node && firstGuidedBlank(first, opened.node)) ?? []
  })

  const fields = useMemo(() => {
    const out = { ...sample }
    if (cells)
      Object.assign(out, cellFields(cells.grid, 0, cells.columns, cells.rows * cells.columns))
    return out
  }, [sample, cells])
  const known = (name: string): boolean =>
    name in fields || columns.includes(name) || layers.includes(name)
  const sentence = guide(root, ctx)
  const blanks = sentence ? guidedBlanks(sentence) : []
  // nel modo avanzato una funzione annidata si può aprire da sola: `view` è dove parte la vista
  const [focus, setFocus] = useState<NodePath>([])
  const view = focus.length && nodeAt(root, focus)?.k === 'call' ? focus : []

  const change = (next: FormulaNode, select?: NodePath | null): void => {
    setRoot(next)
    setText(formulaText(next))
    setTextError(null)
    setTyped(false)
    const g = guide(next, ctx)
    // nel modo guidato, senza una scelta, si passa al primo spazio da riempire
    if (select === null && mode === 'guided' && g) setSelected(firstGuidedBlank(g, next))
    else if (select !== undefined) setSelected(select)
    // una frase che non corrisponde più a un modello si vede solo a caselle
    if (mode === 'guided' && !g) setMode('advanced')
  }
  const typeText = (s: string): void => {
    setText(s)
    setTyped(true)
    const o = openFormula(s)
    if (o.node) {
      setRoot(o.node)
      setTextError(null)
      setSelected([])
      if (mode === 'guided' && !guide(o.node, ctx)) setMode('advanced')
    } else setTextError(o.error ?? null)
  }
  const start = (template: SentenceTemplate): void => {
    const [yes, no] = defaultResults(expect, t)
    const icon = Object.keys(variables ?? {})
      .sort((a, b) => a.localeCompare(b))
      .find((n) => variables?.[n]?.type === 'image')
    const d: SentenceDefaults = {
      field: defaultField(columns, fields, ctx.inCell),
      yes,
      no,
      icon
    }
    const n = template.make(ctx, d)
    change(n, firstGuidedBlank(guide(n, ctx), n) ?? firstEmpty(n))
    setMode('guided')
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
  /** Il nome della casella in `path`, come lo mostra la formula a caselle */
  const slotLabel = (path: NodePath): string => {
    if (!path.length) return t(condition ? 'fx.kind.condition' : 'fx.kind.result')
    const parent = nodeAt(root, path.slice(0, -1))
    const i = path[path.length - 1]
    if (parent?.k === 'call') return argLabel(t, parent, i)
    if (parent?.k === 'bin') return t(binLabel(parent.op, i))
    return t('fx.arg.number')
  }
  /** Nel modo guidato lo spazio selezionato ha il suo nome */
  /** Nel modo guidato lo spazio dice che cosa ci va: una soglia è un numero anche dentro un confronto */
  const pickerKind = (path: NodePath): SlotKind => {
    const part = mode === 'guided' ? blanks.find((p) => same(p.blank, path)) : undefined
    return part && 'blank' in part ? part.kind : slotKind(path)
  }
  /** Uno spazio per un'icona sceglie un'immagine anche dentro un testo */
  const pickerExpect = (path: NodePath): FormulaExpect => {
    const part = mode === 'guided' ? blanks.find((p) => same(p.blank, path)) : undefined
    return part && 'blank' in part && part.image ? 'image' : expect
  }
  const blankLabel = (path: NodePath): string => {
    const part = blanks.find((p) => same(p.blank, path))
    return part && 'blank' in part ? t(part.label as MessageKey) : slotLabel(path)
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

  /** I casi proposti dentro una casella: le condizioni per una condizione, i calcoli per un numero */
  const slotTemplates = (kind: SlotKind): SentenceTemplate[] => {
    if (kind === 'condition') return availableSentences({ ...sctx, condition: true })
    const all = availableSentences({ ...sctx, condition: false, bool: false })
    if (kind === 'number') return all.filter((x) => ['calc', 'if', 'ranges'].includes(x.id))
    // il testo con i campi si scrive già nel campo del testo
    return all.filter((x) => x.id !== 'join')
  }
  const slotDefaults = (kind: SlotKind): SentenceDefaults => {
    const f = defaultField(columns, fields, ctx.inCell)
    if (kind === 'number') return { field: f, yes: { k: 'num', v: 1 }, no: { k: 'num', v: 0 } }
    const [yes, no] = defaultResults(expect, t)
    return { field: f, yes, no }
  }

  const pick = (n: FormulaNode, select?: NodePath | null): void => {
    if (!selected) return
    let next = replaceAt(root, selected, n)
    // gli spazi gemelli di una frase (lo stesso campo in ogni fascia) cambiano insieme
    const part = blanks.find((p) => same(p.blank, selected))
    if (part && 'blank' in part) for (const p of part.also ?? []) next = replaceAt(next, p, n)
    // un caso scelto dentro la casella: si va al primo spazio della sua frase
    if (select === null && mode === 'guided') {
      const g = guide(next, ctx)
      const inside = g
        ? guidedBlanks(g).filter(
            (b) =>
              !b.sub &&
              b.blank.length > selected.length &&
              same(b.blank.slice(0, selected.length), selected)
          )
        : []
      const first = inside.find((b) => nodeAt(next, b.blank)?.k === 'empty') ?? inside[0]
      if (first) return change(next, first.blank)
    }
    // dopo una scelta si passa alla prossima casella da riempire
    change(next, select ?? firstEmpty(next) ?? selected)
  }

  const picker = selected && nodeAt(root, selected) && (
    <SlotPicker
      key={`${mode}-${selected.join('.')}`}
      title={t('fx.filling', {
        what: mode === 'guided' ? blankLabel(selected) : slotLabel(selected)
      })}
      node={nodeAt(root, selected)!}
      path={selected}
      kind={pickerKind(selected)}
      expect={pickerExpect(selected)}
      ctx={ctx}
      columns={columns}
      layers={layers}
      fields={fields}
      known={known}
      variables={variables}
      templates={slotTemplates(pickerKind(selected))}
      defaults={slotDefaults(pickerKind(selected))}
      onPick={pick}
      onRemove={
        canRemove(root, selected)
          ? () => change(removeArg(root, selected), selected.slice(0, -1))
          : undefined
      }
    />
  )

  const gridNotice = onVaryCells && mode !== 'start' && (
    <p className="fx-notice">
      {t('fx.gridNotice')}{' '}
      <button
        type="button"
        onClick={() => {
          onVaryCells()
          onClose()
        }}
      >
        {t('fx.gridNoticeButton')}
      </button>
    </p>
  )

  // una condizione si legge Sì o No, non true o false
  const shown = (v: string | undefined): string =>
    !v
      ? '∅'
      : expect === 'bool' && /^(true|false)$/i.test(v)
        ? t(/^true$/i.test(v) ? 'fx.yes' : 'fx.no')
        : v
  const resultLine = (
    <p className={`small ${textError || result?.error ? 'fx-error' : 'muted'}`}>
      {textError
        ? t('fx.syntaxError', { error: textError })
        : incomplete
          ? t('fx.incomplete')
          : result?.error
            ? t('fx.resultError', { error: result.error })
            : sampleLabel
              ? t('fx.result', { value: shown(result?.value), card: sampleLabel })
              : t('fx.resultDefaults', { value: shown(result?.value) })}
    </p>
  )
  const stripView = strip && (
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
  )
  const formulaBox = (
    <label className="fx-text">
      <span>{t('fx.formula')}</span>
      <textarea
        value={text}
        rows={2}
        spellCheck={false}
        onChange={(e) => typeText(e.target.value)}
      />
    </label>
  )

  return (
    <Dialog title={title ?? t('fx.title')} onClose={onClose} guide="formulaAssistant">
      <div className={`formula-dialog fx-mode-${mode}`}>
        {mode === 'start' && (
          <StartScreen
            templates={availableSentences(sctx)}
            ctx={ctx}
            onVaryCells={
              onVaryCells &&
              (() => {
                onVaryCells()
                onClose()
              })
            }
            onPick={start}
            onWrite={() => {
              setMode('advanced')
              setSelected([])
            }}
          />
        )}
        {mode === 'guided' && sentence && (
          <div className="fx-guided">
            {gridNotice}
            <Sentence
              parts={sentence}
              root={root}
              selected={selected}
              onSelect={setSelected}
              onChange={change}
            />
            <div className="fx-guided-picker">{picker}</div>
            <div className="fx-result-box">
              {resultLine}
              {stripView}
            </div>
            <details className="fx-details">
              <summary>{t('fx.showFormula')}</summary>
              {formulaBox}
            </details>
          </div>
        )}
        {mode === 'advanced' && (
          <>
            {gridNotice}
            <div className="fx-main">
              <div className="fx-tree">
                {root.k === 'empty' && <p className="fx-steps">{t('fx.steps')}</p>}
                {view.length > 0 && (
                  <nav className="fx-crumbs" aria-label={t('fx.crumbs')}>
                    {[[], ...view.map((_, i) => view.slice(0, i + 1))].map((at, i, all) => (
                      <span key={i}>
                        {i > 0 && <span className="fx-crumb-sep">›</span>}
                        {i < all.length - 1 ? (
                          <button type="button" className="link" onClick={() => setFocus(at)}>
                            {at.length ? slotLabel(at) : t('fx.formula')}
                          </button>
                        ) : (
                          <strong>{slotLabel(at)}</strong>
                        )}
                      </span>
                    ))}
                  </nav>
                )}
                <NodeView
                  node={nodeAt(root, view) ?? root}
                  path={view}
                  root={root}
                  selected={selected}
                  onSelect={setSelected}
                  onChange={change}
                  preview={preview}
                  base={view}
                  onDrill={(at) => {
                    setFocus(at)
                    setSelected(at)
                  }}
                />
                <p className="muted small">{t('fx.treeHint')}</p>
              </div>
              <div className="fx-side">{picker}</div>
            </div>
            <div className="fx-foot">
              {formulaBox}
              {resultLine}
              {stripView}
            </div>
          </>
        )}
        <div className="dialog-buttons fx-buttons">
          <span className="fx-modes">
            {mode !== 'start' && (
              <button
                type="button"
                onClick={() => {
                  change({ k: 'empty' }, [])
                  setMode('start')
                }}
              >
                {t('fx.startOver')}
              </button>
            )}
            {mode === 'guided' && (
              <button type="button" onClick={() => setMode('advanced')}>
                {t('fx.advanced')}
              </button>
            )}
            {mode === 'advanced' && sentence && (
              <button
                type="button"
                onClick={() => {
                  setMode('guided')
                  setSelected(firstGuidedBlank(sentence, root))
                }}
              >
                {t('fx.guided')}
              </button>
            )}
          </span>
          <button onClick={onClose}>{t('dialog.cancel')}</button>
          <button
            className="primary"
            disabled={mode === 'start' || !!textError || incomplete}
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

/** Etichetta dell'argomento i di una funzione, numerata se ripetibile */
function argLabel(
  t: (k: MessageKey, p?: Record<string, string | number>) => string,
  call: Extract<FormulaNode, { k: 'call' }>,
  i: number
): string {
  const spec = FUNCTION_SPECS[call.fn]
  const base = t(`fx.arg.${argSpec(call.fn, i).key}` as MessageKey)
  return spec?.variadic && i >= spec.args.length - 1 ? `${base} ${i - spec.args.length + 2}` : base
}

const binLabel = (op: BinaryOperator, i: number): MessageKey =>
  (COMPARISON_OPERATORS as readonly string[]).includes(op)
    ? i === 0
      ? 'fx.arg.compareLeft'
      : 'fx.arg.compareRight'
    : i === 0
      ? 'fx.arg.first'
      : 'fx.arg.second'

// --- schermata iniziale ---

function StartScreen({
  templates,
  ctx,
  onVaryCells,
  onPick,
  onWrite
}: {
  templates: SentenceTemplate[]
  ctx: CatalogContext
  onVaryCells?: () => void
  onPick(template: SentenceTemplate): void
  onWrite(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const card = (
    key: string,
    label: string,
    hint: string,
    onClick: () => void
  ): React.JSX.Element => (
    <button key={key} type="button" className="fx-card" onClick={onClick}>
      <strong>{label}</strong>
      <span>{hint}</span>
    </button>
  )
  const cards = templates.map((s) => {
    const k = `fx.card.${s.id}${s.counter && !ctx.inCell ? '.out' : ''}`
    return card(s.id, t(k as MessageKey), t(`${k}.hint` as MessageKey), () => onPick(s))
  })
  if (onVaryCells)
    cards.splice(
      1,
      0,
      card('vary', t('fx.start.varyCells'), t('fx.start.varyCellsHint'), onVaryCells)
    )
  return (
    <div className="fx-start-screen">
      <h3>{t('fx.start.title')}</h3>
      <div className="fx-cards">
        {cards}
        <button type="button" className="fx-card fx-card-plain" onClick={onWrite}>
          <strong>{t('fx.start.writeMyself')}</strong>
          <span>{t('fx.start.writeMyselfHint')}</span>
        </button>
      </div>
    </div>
  )
}

// --- la frase con gli spazi ---

function Sentence({
  parts,
  root,
  selected,
  onSelect,
  onChange,
  nested = false
}: {
  parts: GuidedPart[]
  root: FormulaNode
  selected: NodePath | null
  onSelect(p: NodePath): void
  onChange(n: FormulaNode, select?: NodePath | null): void
  /** Frase dentro uno spazio di un'altra frase */
  nested?: boolean
}): React.JSX.Element {
  const { t } = useI18n()
  return (
    <div className={nested ? 'fx-sentence fx-sentence-sub' : 'fx-sentence'}>
      {parts.map((p, i) => {
        if ('text' in p) return <span key={i}>{t(p.text as MessageKey)}</span>
        if ('op' in p) {
          const n = nodeAt(root, p.op)
          if (n?.k !== 'bin') return null
          return (
            <select
              key={i}
              className="fx-op"
              value={n.op}
              onChange={(e) =>
                onChange(replaceAt(root, p.op, { ...n, op: e.target.value as BinaryOperator }))
              }
            >
              {p.ops.map((o) => (
                <option key={o} value={o}>
                  {t(`fx.op.${o}` as MessageKey)}
                </option>
              ))}
            </select>
          )
        }
        if ('join' in p) {
          // un confronto in più nella condizione: e anche (AND), oppure (OR)
          const add = (): void => {
            const cond = nodeAt(root, p.join)
            if (!cond) return
            const cmp: FormulaNode = { k: 'bin', op: '=', l: { k: 'empty' }, r: { k: 'empty' } }
            if (cond.k === 'call' && cond.fn === p.fn)
              onChange(replaceAt(root, p.join, { ...cond, args: [...cond.args, cmp] }), [
                ...p.join,
                cond.args.length,
                0
              ])
            else
              onChange(replaceAt(root, p.join, { k: 'call', fn: p.fn, args: [cond, cmp] }), [
                ...p.join,
                1,
                0
              ])
          }
          return (
            <button key={i} type="button" className="fx-add" onClick={add}>
              {t(p.label as MessageKey)}
            </button>
          )
        }
        if ('drop' in p) {
          const drop = (): void => {
            const at = p.drop.slice(0, -1)
            const parent = nodeAt(root, at)
            if (parent?.k !== 'call') return
            const args = parent.args.filter((_, j) => j !== p.drop[p.drop.length - 1])
            onChange(replaceAt(root, at, args.length === 1 ? args[0] : { ...parent, args }), null)
          }
          return (
            <button
              key={i}
              type="button"
              className="fx-mini"
              title={t(p.label as MessageKey)}
              aria-label={t(p.label as MessageKey)}
              onClick={drop}
            >
              ×
            </button>
          )
        }
        if ('add' in p) {
          const add = (): void => {
            if (!p.band) {
              const target = nodeAt(root, p.add)
              const next = addArg(root, p.add)
              onChange(next, target?.k === 'call' ? [...p.add, target.args.length] : undefined)
              return
            }
            // una fascia in più prima di "altrimenti", con lo stesso campo delle altre
            const last = nodeAt(root, p.add)
            if (last?.k !== 'call') return
            const f = (p.field && nodeAt(root, p.field)) ?? { k: 'empty' }
            const band: FormulaNode = {
              k: 'call',
              fn: 'IF',
              args: [{ k: 'bin', op: '>=', l: f, r: { k: 'empty' } }, { k: 'empty' }, last.args[2]]
            }
            onChange(replaceAt(root, [...p.add, 2], band), [...p.add, 2, 0, 1])
          }
          return (
            <button key={i} type="button" className="fx-add" onClick={add}>
              {t(p.label as MessageKey)}
            </button>
          )
        }
        const n = nodeAt(root, p.blank)
        if (!n) return null
        if (p.sub) {
          // una funzione dentro lo spazio: la sua frase, in un riquadro che si può scegliere e cambiare
          const isSel = same(p.blank, selected)
          return (
            <span key={i} className={`fx-sub${isSel ? ' selected' : ''}`}>
              <button
                type="button"
                className="fx-sub-head"
                title={t('fx.subChange')}
                onClick={() => onSelect(p.blank)}
              >
                {t(p.label as MessageKey)}
              </button>
              <Sentence
                parts={p.sub}
                root={root}
                selected={selected}
                onSelect={onSelect}
                onChange={onChange}
                nested
              />
            </span>
          )
        }
        return (
          <Leaf
            key={i}
            node={n}
            selected={same(p.blank, selected)}
            title={t(p.label as MessageKey)}
            onClick={() => onSelect(p.blank)}
          />
        )
      })}
    </div>
  )
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
  /** Da dove parte la vista: la funzione aperta da sola (la radice se vuoto) */
  base: NodePath
  /** Apre da sola la funzione in `path`, con il percorso per tornare indietro */
  onDrill(path: NodePath): void
}

function NodeView(props: ViewProps): React.JSX.Element {
  const { node, path, root, selected, onSelect, onChange, preview, base, onDrill } = props
  const { t } = useI18n()
  const inner = path.length > base.length
  const holdsSelection =
    !!selected && selected.length >= path.length && same(selected.slice(0, path.length), path)
  // una funzione annidata già completa si chiude in una riga; si riapre scegliendola
  if (
    inner &&
    !holdsSelection &&
    (node.k === 'call' || (node.k === 'bin' && !readText(node))) &&
    !hasEmpty(node)
  )
    return (
      <button
        type="button"
        className="fx-collapsed"
        title={t('fx.expand')}
        onClick={() => onSelect(path)}
      >
        <code>{printExpression(node)}</code>
      </button>
    )
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
    <span className="fx-node-top">
      <button
        type="button"
        className={`fx-node-head${isSel ? ' selected' : ''}`}
        onClick={() => onSelect(path)}
      >
        <strong>{name}</strong>
        {fn && <span className="fx-fn">{fn}</span>}
      </button>
      {inner && (
        <button
          type="button"
          className="fx-mini fx-drill"
          title={t('fx.drill')}
          aria-label={t('fx.drill')}
          onClick={() => onDrill(path)}
        >
          ⤢
        </button>
      )}
    </span>
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
        {node.args.map((arg, i) => slot(argLabel(t, node, i), arg, i))}
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
        {slot(t(binLabel(node.op, 0)), node.l, 0)}
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
        {slot(t(binLabel(node.op, 1)), node.r, 1)}
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
  title,
  onClick
}: {
  node: FormulaNode
  selected: boolean
  title?: string
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
  else if (node.k === 'neg' && node.v.k === 'num')
    body = <span className="fx-chip">-{node.v.v}</span>
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
  } else {
    // una formula annidata dentro uno spazio della frase: si apre nel modo avanzato
    body = <span className="fx-chip fx-fn-chip">{node.k === 'call' ? node.fn : '…'}</span>
  }
  return (
    <button type="button" className={cls} title={title} onClick={onClick}>
      {body}
    </button>
  )
}

const isColorText = (v: string, pal: Record<string, string>): boolean =>
  /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v.trim()) || v.trim() in pal

// --- cosa mettere nella casella ---

interface PickerProps {
  title: string
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
  /** I casi di «Cosa vuoi fare?» che si possono mettere in questa casella, con i valori proposti */
  templates: SentenceTemplate[]
  defaults: SentenceDefaults
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

/** Le schede che servono di solito per questa casella; le altre sotto "Altro…" */
function relevantTabs(kind: SlotKind, expect: FormulaExpect): Tab[] {
  switch (kind) {
    case 'condition':
      return ['compare', 'formula', 'field', 'bool']
    case 'number':
      return ['number', 'field', 'system', 'formula']
    case 'text':
      return ['text', 'field', 'variable', 'formula']
    case 'value':
      return ['field', 'number', 'text', 'variable']
    default:
      switch (expect) {
        case 'color':
          return ['color', 'variable', 'field', 'formula']
        case 'image':
          return ['image', 'variable', 'field', 'formula']
        case 'bool':
          return ['bool', 'compare', 'formula', 'field']
        case 'value':
          return ['field', 'number', 'text', 'formula']
        default:
          return ['text', 'field', 'variable', 'formula']
      }
  }
}

const ALL_TABS: Tab[] = [
  'field',
  'variable',
  'system',
  'number',
  'text',
  'color',
  'image',
  'bool',
  'compare',
  'formula'
]

/** Il contenuto di una casella letto come testo con campi, se è fatto solo di quello */
function composeText(n: FormulaNode): FormattedText | null {
  if (n.k === 'empty') return { parts: [], attrs: { styles: [] } }
  if (n.k === 'field') return { parts: [{ field: n.name }], attrs: { styles: [] } }
  if (n.k === 'num') return { parts: [{ text: String(n.v) }], attrs: { styles: [] } }
  if (n.k === 'str' || n.k === 'bin') return readText(n)
  return null
}

/** Caselle in cui si compone un testo: il campo di testo resta visibile e le schede ci inseriscono */
const COMPOSE_KINDS: SlotKind[] = ['text', 'result', 'value']
const COMPOSE_TABS: Tab[] = ['field', 'system', 'variable', 'formula']

function SlotPicker(p: PickerProps): React.JSX.Element {
  const { t } = useI18n()
  // "cosa mostrare": si scrive il testo e le schede sotto inseriscono campi e variabili
  const compose =
    COMPOSE_KINDS.includes(p.kind) && !['color', 'image', 'bool'].includes(p.expect)
      ? composeText(p.node)
      : null
  // una formula nuova parte dal catalogo
  const [tab, setTab] = useState<Tab>(() =>
    compose
      ? 'field'
      : p.expect === 'image' && p.node.k === 'str' && p.variables?.[p.node.v]?.type === 'image'
        ? 'variable'
        : !p.path.length && p.node.k === 'empty'
          ? 'formula'
          : firstTab(p.kind, p.expect, p.node)
  )
  const [all, setAll] = useState(false)
  // un solo campo, un numero o un testo semplice: prima l'elenco, il testo resta chiuso in una riga.
  // Si apre da solo quando la casella contiene già testo misto, come «Forza {forza}»
  const [editing, setEditing] = useState(
    () => !!compose && (compose.parts.length > 1 || !!serializeAttrs(compose.attrs))
  )
  const [formatting, setFormatting] = useState(false)
  const [src, setSrc] = useState(compose ? templateFromParts(compose.parts) : '')
  const [attrs, setAttrs] = useState<Attrs>(compose?.attrs ?? { styles: [] })
  const area = useRef<HTMLTextAreaElement>(null)
  const [written, setWritten] = useState<FormulaNode | null>(null)
  // la casella è cambiata da fuori (per esempio svuotata): il testo la segue
  const [prevNode, setPrevNode] = useState(p.node)
  if (p.node !== prevNode) {
    setPrevNode(p.node)
    if (compose && p.node !== written) {
      setSrc(templateFromParts(compose.parts))
      setAttrs(compose.attrs)
    }
  }
  const write = (text: string, a: Attrs = attrs): void => {
    setSrc(text)
    setAttrs(a)
    const plain = !serializeAttrs(a)
    const n = Number(text.trim().replace(',', '.'))
    // un numero scritto da solo resta un numero: «3» in un confronto vale 3, non il testo "3"
    const numeric =
      plain &&
      /^-?\d+([.,]\d+)?$/.test(text.trim()) &&
      String(Math.abs(n)) === text.trim().replace(',', '.').replace(/^-/, '')
    const node: FormulaNode =
      text === '' && plain
        ? { k: 'empty' }
        : numeric
          ? n < 0
            ? { k: 'neg', v: { k: 'num', v: -n } }
            : { k: 'num', v: n }
          : writeText({ parts: partsFromTemplate(text, p.known), attrs: a })
    setWritten(node)
    p.onPick(node)
  }
  const insert = (name: string): void => {
    const el = area.current
    const from = el?.selectionStart ?? src.length
    const to = el?.selectionEnd ?? from
    const piece = `{${name}}`
    write(src.slice(0, from) + piece + src.slice(to))
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(from + piece.length, from + piece.length)
    })
  }
  // nelle schede, un campo o una variabile si inserisce nel testo invece di sostituire la casella
  const tabProps: PickerProps =
    compose && editing
      ? {
          ...p,
          onPick: (n, sel) => {
            if (n.k === 'field') insert(n.name)
            else p.onPick(n, sel)
          }
        }
      : p
  // un campo o un testo nella casella si formatta direttamente, senza passare dalla scheda Testo
  const formattable: FormattedText | null = compose
    ? null
    : p.kind === 'condition' || p.kind === 'number' || p.expect === 'image'
      ? null
      : p.node.k === 'field'
        ? { parts: [{ field: p.node.name }], attrs: { styles: [] } }
        : p.node.k === 'str' || p.node.k === 'bin'
          ? readText(p.node)
          : null
  const few = compose ? [...COMPOSE_TABS] : relevantTabs(p.kind, p.expect)
  // dentro una griglia le variabili della casella servono quasi sempre
  if (p.ctx.inCell && !few.includes('system') && p.kind !== 'condition') few.splice(2, 0, 'system')
  if (!few.includes(tab)) few.push(tab)
  const tabs = (all ? ALL_TABS : few).filter(
    (x) => (x !== 'image' || p.expect === 'image') && (x !== 'text' || !compose)
  )
  const fmt = serializeAttrs(attrs)
  return (
    <div className="fx-picker">
      <span className="fx-picker-title">{p.title}</span>
      {compose && editing && (
        <div className="fx-compose">
          <div className="fx-row">
            <textarea
              ref={area}
              rows={2}
              autoFocus
              value={src}
              placeholder={t('fx.textPlaceholder')}
              onChange={(e) => write(e.target.value)}
            />
            <button type="button" onClick={() => setFormatting(true)}>
              {t('fx.format')}
            </button>
          </div>
          <p className="muted small">
            {fmt && (
              <>
                {t('fx.formatted', { attrs: fmt })}{' '}
                <button type="button" className="link" onClick={() => write(src, { styles: [] })}>
                  {t('fx.removeFormat')}
                </button>
                <br />
              </>
            )}
            {t('fx.composeHint')}
          </p>
        </div>
      )}
      {compose && !editing && (
        <p className="fx-compose-closed">
          <span className="muted">{t('fx.textLine')}</span> <code>{src || '—'}</code>{' '}
          <button type="button" className="link" onClick={() => setEditing(true)}>
            {t('fx.editText')}
          </button>
        </p>
      )}
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
        <button type="button" className="fx-more" onClick={() => setAll(!all)}>
          {all ? t('fx.less') : t('fx.more')}
        </button>
      </div>
      <div className="fx-tab-body">
        {tab === 'field' && <FieldTab {...tabProps} />}
        {tab === 'variable' && <VariableTab {...tabProps} />}
        {tab === 'system' && <SystemTab {...tabProps} />}
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
        {formattable && (
          <button type="button" onClick={() => setFormatting(true)}>
            {t('fx.formatThis')}
          </button>
        )}
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
      {formatting && compose && (
        <FormatDialog
          initial={attrs}
          sample={src || t('fx.textSample')}
          mode="text"
          onApply={(a) => {
            setFormatting(false)
            write(src, a)
          }}
          onClose={() => setFormatting(false)}
        />
      )}
      {formatting && formattable && (
        <FormatDialog
          initial={formattable.attrs}
          sample={templateFromParts(formattable.parts) || t('fx.textSample')}
          mode="text"
          onApply={(a) => {
            setFormatting(false)
            p.onPick(writeText({ parts: formattable.parts, attrs: a }))
          }}
          onClose={() => setFormatting(false)}
        />
      )}
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
  // un campo nella casella si ritrova nel testo, pronto da formattare o completare
  const [src, setSrc] = useState(
    current ? templateFromParts(current.parts) : p.node.k === 'field' ? `{${p.node.name}}` : ''
  )
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
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            pick()
          }
        }}
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
        <button type="button" className="primary" onClick={pick}>
          {t('fx.use')}
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
      {p.templates.length > 0 && (
        <>
          <span className="fx-picker-title">{t('fx.whatHere')}</span>
          <div className="fx-cards fx-cards-small">
            {p.templates.map((x) => {
              const k = `fx.card.${x.id}${x.counter && !p.ctx.inCell ? '.out' : ''}`
              return (
                <button
                  key={x.id}
                  type="button"
                  className="fx-card"
                  title={t(`${k}.hint` as MessageKey)}
                  onClick={() => p.onPick(x.make(p.ctx, p.defaults), null)}
                >
                  <strong>{t(k as MessageKey)}</strong>
                </button>
              )
            })}
          </div>
          <span className="fx-picker-title">{t('fx.allFunctions')}</span>
        </>
      )}
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
