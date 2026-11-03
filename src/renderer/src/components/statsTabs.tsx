import { useEffect, useMemo, useState } from 'react'
import type { LoadedSet, Sheet } from '../../../shared/project'
import { cardFields, rowToCard, type BoundCard } from '../../../shared/model/bind'
import { cardTemplate } from '../../../shared/model/inherit'
import type { NumberFormatting } from '../../../shared/model/numberFormat'
import type { Template } from '../../../shared/model/template'
import type { Variables } from '../../../shared/model/variables'
import {
  asNumber,
  atLeast,
  columnStats,
  diceDistribution,
  drawnAfter,
  fieldValues,
  MEASURES,
  nearlyUnique,
  pivot,
  rowAmounts,
  scatter,
  shuffled,
  textCounts,
  textFields,
  textHas,
  type FieldValues,
  type Measure
} from '../../../shared/model/stats'
import { useI18n } from '../i18n/context'
import type { MessageKey } from '../i18n/en'
import CardSvg from '../render/CardSvg'
import type { StatsFilter } from './StatsPanel'

// Le schede del pannello delle statistiche. Ognuna mostra una tabella che Copia può copiare, e
// un clic su un valore filtra le carte del set.

export interface StatsField {
  name: string
  /** Livello fisso o con formula: il valore si calcola, non si scrive */
  computed: boolean
  numeric: boolean
}

export interface StatsContext {
  sheet: Sheet
  rows: number[]
  /** Copie di ogni riga (1 se non si contano) */
  amounts: number[]
  copies: boolean
  fields: StatsField[]
  values(name: string): FieldValues
  template: Template | null
  templates: Template[]
  variables?: Variables
  numbers?: NumberFormatting
  /** Un numero come si scrive nella lingua dell'app, con al massimo due decimali */
  num(n: number): string
  pct(p: number): string
  comma: boolean
}

interface TabProps {
  ctx: StatsContext
  onTable(rows: string[][]): void
  filter: StatsFilter | null
  onFilter(f: StatsFilter | null): void
}

/** Il nome di un campo nei menu: ƒ davanti a quelli calcolati */
const fieldLabel = (f: StatsField): string => (f.computed ? `ƒ ${f.name}` : f.name)

function FieldSelect({
  fields,
  value,
  onChange,
  title,
  allowNone,
  noneLabel,
  disabled
}: {
  fields: StatsField[]
  value: string
  onChange(v: string): void
  title?: string
  allowNone?: boolean
  noneLabel?: string
  disabled?: boolean
}): React.JSX.Element {
  return (
    <select
      value={value}
      title={title}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {allowNone && <option value="">{noneLabel}</option>}
      {fields.map((f) => (
        <option key={f.name} value={f.name}>
          {fieldLabel(f)}
        </option>
      ))}
    </select>
  )
}

/** Riquadro di spiegazione che si chiude e resta chiuso */
function Explain({ id, children }: { id: string; children: React.ReactNode }): React.JSX.Element {
  const { t } = useI18n()
  const key = `stats.explain.${id}`
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(key) !== 'closed'
    } catch {
      return true
    }
  })
  const toggle = (): void => {
    setOpen(!open)
    try {
      localStorage.setItem(key, open ? 'closed' : 'open')
    } catch {
      // preferenza non essenziale
    }
  }
  return (
    <div className={open ? 'stats-explain open' : 'stats-explain'}>
      <button className="stats-explain-toggle" onClick={toggle} aria-expanded={open}>
        {open ? '▾' : '▸'} {t('stats.explainTitle')}
      </button>
      {open && <div className="stats-explain-body">{children}</div>}
    </div>
  )
}

/** Un numero con − e + per cambiarlo */
function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  title
}: {
  label: string
  value: number
  min: number
  max: number
  onChange(n: number): void
  title?: string
}): React.JSX.Element {
  return (
    <div className="stats-stepper" title={title}>
      <span>{label}</span>
      <button disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        −
      </button>
      <strong>{value}</strong>
      <button disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        +
      </button>
    </div>
  )
}

/** Clic su un valore: filtra le carte, o toglie il filtro se era già quello */
function useToggleFilter(
  filter: StatsFilter | null,
  onFilter: (f: StatsFilter | null) => void
): (label: string, rows: number[]) => void {
  return (label, rows) => onFilter(filter?.label === label ? null : { label, rows })
}

/** Un valore come si mostra: (vuoto), e i decimali con la virgola in italiano */
const emptyLabel = (v: string, t: ReturnType<typeof useI18n>['t'], comma = false): string =>
  v === '' ? t('stats.empty') : comma ? v.replace(/^(-?\d+)\.(\d+)$/, '$1,$2') : v

/** Il campo da mostrare per primo: un numero, o uno con pochi valori, non il nome */
function defaultField(ctx: StatsContext): string {
  return (
    ctx.fields.find((f) => f.numeric)?.name ??
    ctx.fields.find((f) => fewValues(ctx, f.name))?.name ??
    ctx.fields[0].name
  )
}

// ——— Valori ———

type SortKey = 'value' | 'count'

export function ValuesTab({
  ctx,
  onTable,
  filter,
  onFilter,
  field,
  onField
}: TabProps & { field: string | null; onField(f: string): void }): React.JSX.Element {
  const { t } = useI18n()
  const name = field && ctx.fields.some((f) => f.name === field) ? field : defaultField(ctx)
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 } | null>(null)
  const pick = useToggleFilter(filter, onFilter)
  const fv = ctx.values(name)
  const s = useMemo(
    () => columnStats(name, fv.values, ctx.amounts, fv.fromTemplate),
    [name, fv, ctx.amounts]
  )
  const numeric = !!s.numeric
  const groups = useMemo(() => {
    const out = [...s.groups]
    if (!sort) return out
    const empty = (v: string): number => (v === '' ? 1 : 0)
    if (sort.key === 'count')
      out.sort((a, b) => empty(a.value) - empty(b.value) || sort.dir * (a.cards - b.cards))
    else if (!numeric)
      out.sort(
        (a, b) => empty(a.value) - empty(b.value) || sort.dir * a.value.localeCompare(b.value)
      )
    else
      out.sort(
        (a, b) =>
          empty(a.value) - empty(b.value) || sort.dir * (asNumber(a.value)! - asNumber(b.value)!)
      )
    return out
  }, [s, sort, numeric])
  // il cumulato ha senso solo con i numeri in ordine crescente
  const cumulative = numeric && (!sort || (sort.key === 'value' && sort.dir === 1))
  const top = Math.max(1, ...groups.map((g) => g.cards))
  const total = s.cards || 1
  const lines: { g: (typeof groups)[number]; cum: number }[] = []
  for (let k = 0, running = 0; k < groups.length; k++) {
    if (groups[k].value !== '') running += groups[k].cards
    lines.push({ g: groups[k], cum: running })
  }
  const label = (v: string): string => `${name} = ${emptyLabel(v, t, ctx.comma)}`

  useEffect(() => {
    onTable([
      [t('stats.value'), t('stats.cards'), '%', ...(cumulative ? [t('stats.cumulative')] : [])],
      ...lines.map(({ g, cum }) => [
        emptyLabel(g.value, t, ctx.comma),
        String(g.cards),
        ctx.pct(g.cards / total),
        ...(cumulative ? [g.value === '' ? '' : ctx.pct(cum / total)] : [])
      ])
    ])
  }, [lines.map((l) => `${l.g.value}:${l.g.cards}`).join('|'), cumulative]) // eslint-disable-line react-hooks/exhaustive-deps

  const clickSort = (key: SortKey) => (): void =>
    setSort((cur) =>
      cur?.key === key
        ? { key, dir: cur.dir === 1 ? -1 : 1 }
        : { key, dir: key === 'count' ? -1 : 1 }
    )
  const arrow = (key: SortKey): string => (sort?.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : '')
  const n = s.numeric
  const tiles: [MessageKey, string, MessageKey][] = n
    ? [
        ['stats.sum', ctx.num(n.sum), 'stats.tip.sum'],
        ['stats.mean', ctx.num(n.mean), 'stats.tip.mean'],
        ['stats.median', ctx.num(n.median), 'stats.tip.median'],
        ['stats.mode', n.mode.map(ctx.num).join(', '), 'stats.tip.mode'],
        ['stats.min', ctx.num(n.min), 'stats.tip.min'],
        ['stats.max', ctx.num(n.max), 'stats.tip.max'],
        ['stats.sd', ctx.num(n.sd), 'stats.tip.sd'],
        ['stats.count', String(n.count), 'stats.tip.count']
      ]
    : []
  const fromTpl = s.groups.reduce((a, g) => a + (g.fromTemplate ?? 0), 0)

  return (
    <div className="stats-tab">
      <div className="stats-controls">
        <label>
          {t('stats.field')}
          <FieldSelect fields={ctx.fields} value={name} onChange={onField} />
        </label>
      </div>
      <p className="muted small">
        {t('stats.summary', { values: s.groups.filter((g) => g.value !== '').length })}
        {fromTpl > 0 && ` ${t('stats.fromTemplateSummary', { n: fromTpl })}`}
      </p>
      {tiles.length > 0 && (
        <div className="stats-tiles">
          {tiles.map(([k, v, tip]) => (
            <div key={k} className="stats-tile" title={t(tip)}>
              <span>{t(k)}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
      )}
      {s.gaps && s.gaps.length > 0 && (
        <p className="small" title={t('stats.tip.gaps')}>
          {t('stats.gaps', { list: s.gaps.join(', ') })}
        </p>
      )}
      <table className="stats-table">
        <thead>
          <tr>
            <th className="th-sort" onClick={clickSort('value')} title={t('stats.sortHint')}>
              {t('stats.value')}
              {arrow('value')}
            </th>
            <th className="num th-sort" onClick={clickSort('count')} title={t('stats.sortHint')}>
              {t('stats.cards')}
              {arrow('count')}
            </th>
            <th className="num" title={t('stats.tip.percent')}>
              %
            </th>
            {cumulative && (
              <th className="num" title={t('stats.tip.cumulative')}>
                {t('stats.cumulative')}
              </th>
            )}
            <th />
          </tr>
        </thead>
        <tbody>
          {lines.map(({ g, cum }) => {
            const on = filter?.label === label(g.value)
            return (
              <tr
                key={g.value}
                className={on ? 'stats-row on' : 'stats-row'}
                title={t('stats.filterHint')}
                onClick={() =>
                  pick(
                    label(g.value),
                    ctx.rows.filter((_, k) => fv.values[k] === g.value)
                  )
                }
              >
                <td>
                  {g.value === '' ? (
                    <em className="muted">{t('stats.empty')}</em>
                  ) : (
                    emptyLabel(g.value, t, ctx.comma)
                  )}
                  {g.fromTemplate ? (
                    <span
                      className="stats-tpl"
                      title={t('stats.fromTemplate', { n: g.fromTemplate })}
                    >
                      {' '}
                      ◦
                    </span>
                  ) : null}
                </td>
                <td className="num" title={t('stats.rowsHint', { n: g.rows })}>
                  {g.cards}
                </td>
                <td className="num">{ctx.pct(g.cards / total)}</td>
                {cumulative && (
                  <td className="num muted">{g.value === '' ? '' : ctx.pct(cum / total)}</td>
                )}
                <td className="bar">
                  <span style={{ width: `${(g.cards / top) * 100}%` }} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ——— Incrocio ———

/** Un campo con pochi valori diversi: va bene per righe e colonne dell'incrocio */
function fewValues(ctx: StatsContext, name: string, max = 12): boolean {
  const vs = new Set(ctx.values(name).values)
  return vs.size > 1 && vs.size <= max
}

export function PivotTab({ ctx, onTable, filter, onFilter }: TabProps): React.JSX.Element {
  const { t } = useI18n()
  const pick = useToggleFilter(filter, onFilter)
  const groupable = ctx.fields.filter((f) => fewValues(ctx, f.name, 40))
  const numeric = ctx.fields.filter((f) => f.numeric)
  const pickable = groupable.length ? groupable : ctx.fields
  const [rowField, setRowField] = useState(pickable[0]?.name ?? '')
  const [colField, setColField] = useState(pickable[1]?.name ?? '')
  const [kind, setKind] = useState<Measure>(numeric.length ? 'mean' : 'count')
  const [of, setOf] = useState(numeric.find((f) => f.name !== rowField)?.name ?? '')
  const rowName = ctx.fields.some((f) => f.name === rowField) ? rowField : pickable[0].name
  const colName = ctx.fields.some((f) => f.name === colField) ? colField : ''
  const ofName = numeric.some((f) => f.name === of) ? of : (numeric[0]?.name ?? '')
  const used: Measure = ofName ? kind : 'count'
  const p = useMemo(
    () =>
      pivot(
        ctx.rows,
        ctx.values(rowName).values,
        colName ? ctx.values(colName).values : null,
        ofName ? ctx.values(ofName).values : null,
        used,
        ctx.amounts
      ),
    [ctx, rowName, colName, ofName, used]
  )
  const show = (v: number[] | null): string => (v === null ? '' : v.map(ctx.num).join(', '))
  const all = p.cells.flat().flatMap((c) => (c.value ? [c.value[0]] : []))
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const shade = (v: number[] | null): string | undefined => {
    if (v === null || !Number.isFinite(lo) || hi === lo) return undefined
    return `rgb(47 111 222 / ${(0.08 + ((v[0] - lo) / (hi - lo)) * 0.6).toFixed(2)})`
  }
  const head = (v: string): string => emptyLabel(v, t, ctx.comma)

  useEffect(() => {
    onTable([
      [`${rowName} \\ ${colName}`, ...p.colKeys.map(head), t('stats.total')],
      ...p.rowKeys.map((r, i) => [
        head(r),
        ...p.cells[i].map((c) => show(c.value)),
        show(p.rowTotals[i].value)
      ]),
      [t('stats.total'), ...p.colTotals.map((c) => show(c.value)), show(p.total.value)]
    ])
  }, [p]) // eslint-disable-line react-hooks/exhaustive-deps

  const cellLabel = (r: string, c: string | null): string =>
    c === null ? `${rowName} = ${head(r)}` : `${rowName} = ${head(r)}, ${colName} = ${head(c)}`

  return (
    <div className="stats-tab">
      <div className="stats-controls">
        <label>
          {t('stats.pivotRows')}
          <FieldSelect fields={ctx.fields} value={rowName} onChange={setRowField} />
        </label>
        <label>
          {t('stats.pivotCols')}
          <FieldSelect
            fields={ctx.fields.filter((f) => f.name !== rowName)}
            value={colName}
            onChange={setColField}
            allowNone
            noneLabel={t('stats.none')}
          />
        </label>
        <label>
          {t('stats.inCells')}
          <select value={used} onChange={(e) => setKind(e.target.value as Measure)}>
            {MEASURES.filter((m) => m === 'count' || ofName).map((m) => (
              <option key={m} value={m}>
                {t(`stats.m.${m}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>
        <label className={used === 'count' ? 'disabled' : undefined}>
          {t('stats.of')}
          <FieldSelect
            fields={numeric}
            value={ofName}
            onChange={setOf}
            disabled={used === 'count'}
            title={used === 'count' ? t('stats.ofCountHint') : undefined}
          />
        </label>
      </div>
      <div className="stats-pivot-wrap">
        <table className="stats-table stats-pivot">
          <thead>
            <tr>
              <th>{colName ? `${rowName} \\ ${colName}` : rowName}</th>
              {p.colKeys.map((c) => (
                <th key={c} className="num">
                  {head(c)}
                </th>
              ))}
              <th className="num">{t('stats.total')}</th>
            </tr>
          </thead>
          <tbody>
            {p.rowKeys.map((r, i) => (
              <tr key={r}>
                <th>{head(r)}</th>
                {p.cells[i].map((c, j) => {
                  const l = cellLabel(r, p.colKeys[j])
                  return (
                    <td
                      key={j}
                      className={filter?.label === l ? 'num pick on' : 'num pick'}
                      style={{ background: shade(c.value) }}
                      title={t('stats.cellHint', { n: c.cards })}
                      onClick={() => c.cards && pick(l, c.rows)}
                    >
                      {show(c.value)}
                    </td>
                  )
                })}
                <td
                  className="num pick total"
                  title={t('stats.cellHint', { n: p.rowTotals[i].cards })}
                  onClick={() => pick(cellLabel(r, null), p.rowTotals[i].rows)}
                >
                  {show(p.rowTotals[i].value)}
                </td>
              </tr>
            ))}
            <tr className="total">
              <th>{t('stats.total')}</th>
              {p.colTotals.map((c, j) => (
                <td key={j} className="num">
                  {show(c.value)}
                </td>
              ))}
              <td className="num">{show(p.total.value)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ——— Dispersione ———

export function ScatterTab({
  ctx,
  onTable,
  cards,
  onShowCard
}: TabProps & { cards: BoundCard[]; onShowCard(row: number): void }): React.JSX.Element {
  const { t } = useI18n()
  const numeric = ctx.fields.filter((f) => f.numeric)
  const [xField, setX] = useState(numeric[0]?.name ?? '')
  const [yField, setY] = useState(numeric[1]?.name ?? '')
  const [hover, setHover] = useState<number | null>(null)
  const xn = numeric.some((f) => f.name === xField) ? xField : (numeric[0]?.name ?? '')
  const yn = numeric.some((f) => f.name === yField)
    ? yField
    : (numeric.find((f) => f.name !== xn)?.name ?? '')
  const sc = useMemo(
    () =>
      xn && yn
        ? scatter(ctx.rows, ctx.values(xn).values, ctx.values(yn).values, ctx.amounts)
        : null,
    [ctx, xn, yn]
  )
  const nameField = ctx.fields.find((f) => !f.numeric)?.name
  const nameOf = (row: number): string => {
    const k = ctx.rows.indexOf(row)
    return (nameField && ctx.values(nameField).values[k]) || `#${row + 1}`
  }
  useEffect(() => {
    onTable(
      sc
        ? [
            [nameField ?? '#', xn, yn, t('stats.cards'), t('stats.outlierHead')],
            ...sc.points.map((p) => [
              nameOf(p.row),
              ctx.num(p.x),
              ctx.num(p.y),
              String(p.weight),
              p.outlier ? '✓' : ''
            ])
          ]
        : []
    )
  }, [sc]) // eslint-disable-line react-hooks/exhaustive-deps

  if (numeric.length < 2) return <p className="muted stats-tab">{t('stats.scatterNeedsTwo')}</p>

  const W = 460
  const H = 300
  const pad = { l: 40, r: 14, t: 14, b: 34 }
  const xs = sc!.points.map((p) => p.x)
  const ys = sc!.points.map((p) => p.y)
  const range = (vs: number[]): [number, number] => {
    if (!vs.length) return [0, 1]
    const a = Math.min(...vs)
    const b = Math.max(...vs)
    return a === b ? [a - 1, b + 1] : [a, b]
  }
  const [x0, x1] = range(xs)
  const [y0, y1] = range(ys)
  const X = (v: number): number => pad.l + ((v - x0) / (x1 - x0)) * (W - pad.l - pad.r)
  const Y = (v: number): number => H - pad.b - ((v - y0) / (y1 - y0)) * (H - pad.t - pad.b)
  const ticks = (a: number, b: number): number[] => {
    const span = b - a
    const step = span <= 10 ? 1 : span <= 25 ? 5 : Math.pow(10, Math.floor(Math.log10(span)))
    const out: number[] = []
    for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(v)
    return out.slice(0, 15)
  }
  // punti uguali uno accanto all'altro, non uno sopra l'altro
  const seen = new Map<string, number>()
  const placed = sc!.points.map((p) => {
    const key = `${p.x}|${p.y}`
    const n = seen.get(key) ?? 0
    seen.set(key, n + 1)
    return { ...p, dx: n * 8 }
  })
  const tr = sc!.trend
  const hp = hover === null ? null : placed.find((p) => p.row === hover)
  const card = hover === null ? undefined : cards[hover]

  return (
    <div className="stats-tab">
      <div className="stats-controls">
        <label>
          {t('stats.axisX')}
          <FieldSelect fields={numeric} value={xn} onChange={setX} />
        </label>
        <button
          className="stats-swap"
          title={t('stats.swapAxes')}
          onClick={() => {
            setX(yn)
            setY(xn)
          }}
        >
          ⇄
        </button>
        <label>
          {t('stats.axisY')}
          <FieldSelect fields={numeric} value={yn} onChange={setY} />
        </label>
      </div>
      <div className="stats-scatter">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('stats.tab.scatter')}>
          {ticks(y0, y1).map((v) => (
            <g key={`y${v}`}>
              <line className="grid" x1={pad.l} x2={W - pad.r} y1={Y(v)} y2={Y(v)} />
              <text x={pad.l - 6} y={Y(v) + 4} textAnchor="end">
                {ctx.num(v)}
              </text>
            </g>
          ))}
          {ticks(x0, x1).map((v) => (
            <text key={`x${v}`} x={X(v)} y={H - pad.b + 16} textAnchor="middle">
              {ctx.num(v)}
            </text>
          ))}
          <text x={(W + pad.l) / 2} y={H - 4} textAnchor="middle" className="axis">
            {xn}
          </text>
          <text
            x={12}
            y={(H - pad.b) / 2}
            textAnchor="middle"
            className="axis"
            transform={`rotate(-90 12 ${(H - pad.b) / 2})`}
          >
            {yn}
          </text>
          {tr && (
            <line
              className="trend"
              x1={X(x0)}
              y1={Y(tr.slope * x0 + tr.intercept)}
              x2={X(x1)}
              y2={Y(tr.slope * x1 + tr.intercept)}
            />
          )}
          {placed.map((p) => (
            <circle
              key={p.row}
              className={p.outlier ? 'point outlier' : 'point'}
              cx={X(p.x) + p.dx}
              cy={Y(p.y)}
              r={hover === p.row ? 7 : 5}
              onMouseEnter={() => setHover(p.row)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onShowCard(p.row)}
            />
          ))}
        </svg>
        {hp && (
          <div
            className="stats-hover"
            style={(() => {
              // vicino ai bordi la scheda si appoggia al bordo invece di uscire dal pannello
              const at = (X(hp.x) / W) * 100
              if (at < 30) return { left: `${at}%`, transform: 'none' }
              if (at > 70) return { left: `${at}%`, transform: 'translateX(-100%)' }
              return { left: `${at}%` }
            })()}
          >
            {card && (
              <CardSvg template={card.template} side="front" scale={110 / card.template.height} />
            )}
            <span>
              <strong>{nameOf(hp.row)}</strong>
              <br />
              {xn} {ctx.num(hp.x)} · {yn} {ctx.num(hp.y)}
            </span>
          </div>
        )}
      </div>
      <p className="muted small">{t('stats.scatterHint')}</p>
      {sc!.points.some((p) => p.outlier) && (
        <p className="small">
          <span className="stats-dot outlier" /> {t('stats.outliers')}{' '}
          {sc!.points
            .filter((p) => p.outlier)
            .map((p) => nameOf(p.row))
            .join(', ')}
        </p>
      )}
    </div>
  )
}

// ——— Pesca e mano di prova ———

interface DeckCard {
  set: LoadedSet
  row: number
}

export function DrawTab({
  ctx,
  onTable,
  set,
  sets,
  cards,
  bindOther
}: TabProps & {
  set: LoadedSet
  sets: LoadedSet[]
  cards: BoundCard[]
  bindOther(set: LoadedSet, row: number): BoundCard | null
}): React.JSX.Element {
  const { t } = useI18n()
  const [field, setField] = useState(
    ctx.fields.find((f) => fewValues(ctx, f.name))?.name ?? ctx.fields[0].name
  )
  const [hand, setHand] = useState(5)
  const [perTurn, setPerTurn] = useState(1)
  const [need, setNeed] = useState(1)
  const [mixed, setMixed] = useState<string[]>([])
  const [seed, setSeed] = useState(1)
  const [extra, setExtra] = useState(0)
  const name = ctx.fields.some((f) => f.name === field) ? field : ctx.fields[0].name
  const others = sets.filter((s) => s !== set && s.data && s.data.rows.length)

  // il mazzo: le carte di questo set (quelle contate) e quelle degli altri set scelti, con le copie
  const deck = useMemo(() => {
    const groups = new Map<string, number>()
    const list: DeckCard[] = []
    const addSet = (s: LoadedSet, rows: number[], values: string[], amounts: number[]): void => {
      rows.forEach((r, k) => {
        const n = amounts[k] ?? 1
        if (n <= 0) return
        groups.set(values[k], (groups.get(values[k]) ?? 0) + n)
        for (let i = 0; i < n; i++) list.push({ set: s, row: r })
      })
    }
    addSet(set, ctx.rows, ctx.values(name).values, rowAmounts(ctx.sheet, ctx.rows))
    for (const s of sets) {
      if (s === set || !s.data || !mixed.includes(s.name)) continue
      const sheet = s.data
      const rows = sheet.rows.map((_, i) => i)
      const tpl = ctx.templates.find((x) => x.name === s.template) ?? null
      const values = fieldValues(
        sheet,
        name,
        rows,
        tpl,
        ctx.templates,
        ctx.variables,
        ctx.numbers
      ).values
      addSet(s, rows, values, rowAmounts(sheet, rows))
    }
    return { groups, list }
  }, [ctx, name, set, sets, mixed])

  const N = deck.list.length
  const turns = [1, 2, 3]
  const keys = useMemo(
    () =>
      columnStats('', [...deck.groups.keys()], [...deck.groups.values()]).groups.map(
        (g) => g.value
      ),
    [deck]
  )
  const prob = (K: number, turn: number): number =>
    atLeast(N, K, drawnAfter(turn, hand, perTurn), need)
  const head = (turn: number): string =>
    turn === 1
      ? t('stats.drawHand', { n: hand })
      : t('stats.drawTurn', { turn, n: drawnAfter(turn, hand, perTurn) })

  useEffect(() => {
    onTable([
      [t('stats.value'), t('stats.inDeck'), ...turns.map(head)],
      ...keys.map((v) => {
        const K = deck.groups.get(v) ?? 0
        return [emptyLabel(v, t, ctx.comma), String(K), ...turns.map((tu) => ctx.pct(prob(K, tu)))]
      })
    ])
  }, [deck, hand, perTurn, need]) // eslint-disable-line react-hooks/exhaustive-deps

  const sample = useMemo(
    () => shuffled(deck.list, seed).slice(0, Math.min(N, hand + extra)),
    [deck, seed, hand, extra, N]
  )
  const thumb = (c: DeckCard, i: number): React.JSX.Element => {
    const b = c.set === set ? cards[c.row] : bindOther(c.set, c.row)
    return (
      <div key={i} className="stats-hand-card" title={c.set === set ? undefined : c.set.name}>
        {b ? (
          <CardSvg template={b.template} side="front" scale={130 / b.template.height} />
        ) : (
          <span className="muted">{c.set.name}</span>
        )}
      </div>
    )
  }

  return (
    <div className="stats-tab">
      <Explain id="draw">
        <p>{t('stats.drawExplain1')}</p>
        <p>{t('stats.drawExplain2')}</p>
        <p>{t('stats.drawExplain3')}</p>
      </Explain>
      <div className="stats-controls">
        <label>
          {t('stats.drawField')}
          <FieldSelect fields={ctx.fields} value={name} onChange={setField} />
        </label>
      </div>
      {others.length > 0 && (
        <div className="stats-mix" title={t('stats.mixHint')}>
          <span>{t('stats.mixWith')}</span>
          {others.map((s) => (
            <label key={s.name} className="check">
              <input
                type="checkbox"
                checked={mixed.includes(s.name)}
                onChange={(e) =>
                  setMixed(
                    e.target.checked ? [...mixed, s.name] : mixed.filter((x) => x !== s.name)
                  )
                }
              />
              {s.name}
            </label>
          ))}
        </div>
      )}
      <div className="stats-steppers">
        <Stepper label={t('stats.handSize')} value={hand} min={1} max={20} onChange={setHand} />
        <Stepper
          label={t('stats.perTurn')}
          value={perTurn}
          min={0}
          max={6}
          onChange={setPerTurn}
          title={t('stats.perTurnHint')}
        />
        <Stepper label={t('stats.atLeast')} value={need} min={1} max={6} onChange={setNeed} />
      </div>
      <p className="muted small">{t('stats.deckSize', { n: N, need })}</p>
      <table className="stats-table">
        <thead>
          <tr>
            <th>{t('stats.value')}</th>
            <th className="num" title={t('stats.inDeckHint')}>
              {t('stats.inDeck')}
            </th>
            {turns.map((tu) => (
              <th key={tu} className="num">
                {head(tu)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keys.map((v) => {
            const K = deck.groups.get(v) ?? 0
            return (
              <tr key={v}>
                <td>
                  {v === '' ? (
                    <em className="muted">{t('stats.empty')}</em>
                  ) : (
                    emptyLabel(v, t, ctx.comma)
                  )}
                </td>
                <td className="num">{K}</td>
                {turns.map((tu) => {
                  const p = prob(K, tu)
                  return (
                    <td
                      key={tu}
                      className={p > 0.6 ? 'num prob strong' : 'num prob'}
                      style={{ background: `rgb(47 111 222 / ${(0.06 + p * 0.8).toFixed(2)})` }}
                    >
                      {ctx.pct(p)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="stats-hand">
        <div className="stats-hand-head">
          <h3>{t('stats.sampleHand')}</h3>
          <button
            onClick={() => {
              setSeed(seed + 1)
              setExtra(0)
            }}
          >
            {t('stats.reshuffle')}
          </button>
          <button disabled={hand + extra >= N} onClick={() => setExtra(extra + 1)}>
            {t('stats.drawOne')}
          </button>
        </div>
        <div className="stats-hand-cards">{sample.map(thumb)}</div>
      </div>
    </div>
  )
}

// ——— Dadi ———

type DiceCount =
  | { kind: 'sum'; field: string }
  | { kind: 'eq'; field: string; value: string }
  | { kind: 'icon'; name: string }

export function DiceTab({ ctx, onTable }: TabProps): React.JSX.Element {
  const { t } = useI18n()
  // ogni dado sono sei righe, una per faccia; le copie del dado sono quelle della prima faccia
  const dice = useMemo(() => {
    const out: { label: string; rows: number[]; ks: number[]; amount: number }[] = []
    const amounts = rowAmounts(ctx.sheet, ctx.rows)
    for (let i = 0; i < ctx.rows.length; i += 6) {
      const ks = ctx.rows.slice(i, i + 6).map((_, j) => i + j)
      out.push({
        label: t('stats.dieName', {
          n: out.length + 1,
          from: ctx.rows[i] + 1,
          to: ctx.rows[ks[ks.length - 1]] + 1
        }),
        rows: ks.map((k) => ctx.rows[k]),
        ks,
        amount: Math.max(1, amounts[i] ?? 1)
      })
    }
    return out
  }, [ctx, t])
  const images = useMemo(
    () =>
      new Set(
        Object.entries(ctx.variables ?? {})
          .filter(([, v]) => v.type === 'image')
          .map(([k]) => k)
      ),
    [ctx.variables]
  )
  const texts = useMemo(() => textFields(ctx.template ? [ctx.template] : []), [ctx.template])
  const iconsPerFace = useMemo(
    () =>
      ctx.rows.map((_, k) => {
        const m = new Map<string, number>()
        for (const f of texts) {
          const c = textCounts(ctx.values(f).values[k] ?? '', {}, images, new Set())
          for (const [n, v] of c.icons) m.set(n, (m.get(n) ?? 0) + v)
        }
        return m
      }),
    [ctx, texts, images]
  )
  const options = useMemo(() => {
    const out: { id: string; label: string; count: DiceCount }[] = []
    for (const f of ctx.fields.filter((x) => x.numeric))
      out.push({
        id: `sum:${f.name}`,
        label: t('stats.diceSum', { field: f.name }),
        count: { kind: 'sum', field: f.name }
      })
    const icons = new Set<string>()
    for (const m of iconsPerFace) for (const n of m.keys()) icons.add(n)
    for (const n of icons)
      out.push({
        id: `icon:${n}`,
        label: t('stats.diceIcon', { icon: n }),
        count: { kind: 'icon', name: n }
      })
    for (const f of ctx.fields.filter((x) => !x.numeric && fewValues(ctx, x.name, 12)))
      for (const v of new Set(ctx.values(f.name).values))
        if (v)
          out.push({
            id: `eq:${f.name}:${v}`,
            label: t('stats.diceEq', { field: f.name, value: v }),
            count: { kind: 'eq', field: f.name, value: v }
          })
    return out
  }, [ctx, iconsPerFace, t])
  const [choice, setChoice] = useState(options[0]?.id ?? '')
  const [counts, setCounts] = useState<Record<number, number>>({})
  const opt = options.find((o) => o.id === choice) ?? options[0]
  const faceValue = (k: number): number => {
    if (!opt) return 0
    const c = opt.count
    if (c.kind === 'sum') return asNumber(ctx.values(c.field).values[k] ?? '') ?? 0
    if (c.kind === 'eq') return ctx.values(c.field).values[k] === c.value ? 1 : 0
    return iconsPerFace[k]?.get(c.name) ?? 0
  }
  const howMany = (i: number): number => counts[i] ?? dice[i].amount
  const thrown = dice.flatMap((d, i) =>
    Array.from({ length: howMany(i) }, () => d.ks.map(faceValue))
  )
  const dist = diceDistribution(thrown)
  const top = Math.max(1e-9, ...dist)
  const mean = dist.reduce((s, p, k) => s + p * k, 0)
  const lines: { k: number; p: number; ge: number }[] = []
  for (let k = 0, left = 1; k < dist.length; k++) {
    lines.push({ k, p: dist[k], ge: left })
    left -= dist[k]
  }

  useEffect(() => {
    onTable([
      [t('stats.diceTotal'), t('stats.diceExact'), t('stats.diceAtLeast')],
      ...lines.map((l) => [String(l.k), ctx.pct(l.p), ctx.pct(Math.max(0, l.ge))])
    ])
  }, [dist.join('|')]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!dice.length || !options.length)
    return <p className="muted stats-tab">{t('stats.diceNone')}</p>

  return (
    <div className="stats-tab">
      <Explain id="dice">
        <p>{t('stats.diceExplain')}</p>
      </Explain>
      <div className="stats-controls">
        <label>
          {t('stats.diceCount')}
          <select value={opt.id} onChange={(e) => setChoice(e.target.value)}>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="stats-steppers">
        {dice.map((d, i) => (
          <Stepper
            key={i}
            label={d.label}
            title={d.ks.map(faceValue).join(', ')}
            value={howMany(i)}
            min={0}
            max={12}
            onChange={(n) => setCounts({ ...counts, [i]: n })}
          />
        ))}
      </div>
      <p className="small">{t('stats.diceMean', { mean: ctx.num(mean) })}</p>
      <table className="stats-table">
        <thead>
          <tr>
            <th className="num">{t('stats.diceTotal')}</th>
            <th className="num" title={t('stats.tip.diceExact')}>
              {t('stats.diceExact')}
            </th>
            <th className="num" title={t('stats.tip.diceAtLeast')}>
              {t('stats.diceAtLeast')}
            </th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.k}>
              <td className="num">{l.k}</td>
              <td className="num">{ctx.pct(l.p)}</td>
              <td className="num muted">{ctx.pct(Math.max(0, l.ge))}</td>
              <td className="bar">
                <span style={{ width: `${(l.p / top) * 100}%` }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ——— Testi ———

interface TextRow {
  label: string
  /** Quante in tutto, con le copie */
  total: number
  /** Su quante carte, con le copie */
  cards: number
  rows: number[]
}

export function TextsTab({ ctx, onTable, filter, onFilter }: TabProps): React.JSX.Element {
  const { t } = useI18n()
  const pick = useToggleFilter(filter, onFilter)
  const rowTemplates = useMemo(
    () =>
      ctx.template
        ? ctx.rows.map(
            (r) =>
              cardTemplate(ctx.sheet.headers, ctx.sheet.rows[r] ?? [], ctx.template!, ctx.templates)
                .template
          )
        : [],
    [ctx]
  )
  const all = useMemo(() => textFields([...new Set(rowTemplates)]), [rowTemplates])
  const [off, setOff] = useState<string[]>([])
  const on = useMemo(() => all.filter((f) => !off.includes(f)), [all, off])
  const [query, setQuery] = useState('')
  const images = useMemo(
    () =>
      new Set(
        Object.entries(ctx.variables ?? {})
          .filter(([, v]) => v.type === 'image')
          .map(([k]) => k)
      ),
    [ctx.variables]
  )
  const textVars = useMemo(
    () =>
      new Set(
        Object.entries(ctx.variables ?? {})
          .filter(([, v]) => v.type === 'text')
          .map(([k]) => k)
      ),
    [ctx.variables]
  )
  const groups = useMemo(() => {
    const maps = {
      icons: new Map<string, TextRow>(),
      variables: new Map<string, TextRow>(),
      bold: new Map<string, TextRow>()
    }
    ctx.rows.forEach((r, k) => {
      const tpl = rowTemplates[k]
      const fields = tpl
        ? cardFields(tpl, rowToCard(ctx.sheet.headers, ctx.sheet.rows[r] ?? []), ctx.variables)
        : {}
      const w = ctx.amounts[k] ?? 1
      const seen = new Set<string>()
      for (const f of on) {
        const c = textCounts(ctx.values(f).values[k] ?? '', fields, images, textVars)
        for (const kind of ['icons', 'variables', 'bold'] as const)
          for (const [name, n] of c[kind]) {
            const m = maps[kind]
            const label = kind === 'bold' ? `**${name}**` : `{${name}}`
            const row = m.get(label) ?? { label, total: 0, cards: 0, rows: [] }
            row.total += n * w
            if (!seen.has(`${kind}:${label}`)) {
              seen.add(`${kind}:${label}`)
              row.cards += w
              row.rows.push(r)
            }
            m.set(label, row)
          }
      }
    })
    const sorted = (m: Map<string, TextRow>): TextRow[] =>
      [...m.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label))
    return [
      { title: t('stats.textIcons'), hint: t('stats.textIconsHint'), rows: sorted(maps.icons) },
      {
        title: t('stats.textVariables'),
        hint: t('stats.textVariablesHint'),
        rows: sorted(maps.variables)
      },
      { title: t('stats.textBold'), hint: t('stats.textBoldHint'), rows: sorted(maps.bold) }
    ]
  }, [ctx, rowTemplates, on, images, textVars, t])

  const q = query.trim()
  const hits = q
    ? ctx.rows.filter((_, k) => on.some((f) => textHas(ctx.values(f).values[k] ?? '', q)))
    : []
  const hitCards = hits.reduce((s, r) => s + (ctx.amounts[ctx.rows.indexOf(r)] ?? 1), 0)
  const inFields = on.length < all.length ? ` (${on.join(', ')})` : ''

  useEffect(() => {
    onTable([
      ['', t('stats.textTotal'), t('stats.cards')],
      ...groups.flatMap((g) => [
        [g.title, '', ''],
        ...g.rows.map((r) => [r.label, String(r.total), String(r.cards)])
      ])
    ])
  }, [groups]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!all.length) return <p className="muted stats-tab">{t('stats.textNone')}</p>

  return (
    <div className="stats-tab">
      <div className="stats-mix" title={t('stats.textFieldsHint')}>
        <span>{t('stats.textFields')}</span>
        {all.map((f) => (
          <label key={f} className="check">
            <input
              type="checkbox"
              checked={!off.includes(f)}
              onChange={(e) => setOff(e.target.checked ? off.filter((x) => x !== f) : [...off, f])}
            />
            {f}
          </label>
        ))}
      </div>
      <div className="stats-controls">
        <input
          type="search"
          value={query}
          placeholder={t('stats.textSearch')}
          onChange={(e) => setQuery(e.target.value)}
        />
        {q && (
          <button
            disabled={!hits.length}
            className={
              filter?.label === `${t('stats.contains', { text: q })}${inFields}` ? 'on' : undefined
            }
            onClick={() => pick(`${t('stats.contains', { text: q })}${inFields}`, hits)}
            title={t('stats.filterHint')}
          >
            {t('stats.textFound', { n: hitCards })}
          </button>
        )}
      </div>
      {groups.map((g) => {
        const top = Math.max(1, ...g.rows.map((r) => r.total))
        return (
          <div key={g.title} className="stats-text-group">
            <h3>
              {g.title} <span className="muted small">{g.hint}</span>
            </h3>
            {!g.rows.length ? (
              <p className="muted small">{t('stats.textNoneFound')}</p>
            ) : (
              <table className="stats-table">
                <tbody>
                  {g.rows.map((r) => {
                    const label = `${t('stats.contains', { text: r.label })}${inFields}`
                    return (
                      <tr
                        key={r.label}
                        className={filter?.label === label ? 'stats-row on' : 'stats-row'}
                        title={t('stats.filterHint')}
                        onClick={() => pick(label, r.rows)}
                      >
                        <td>
                          <code>{r.label}</code>
                        </td>
                        <td className="num" title={t('stats.textTotal')}>
                          {r.total}
                        </td>
                        <td className="num muted">{t('stats.onCards', { n: r.cards })}</td>
                        <td className="bar">
                          <span style={{ width: `${(r.total / top) * 100}%` }} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ——— Panoramica ———

export function OverviewTab({
  ctx,
  onTable,
  onOpen
}: TabProps & { onOpen(field: string): void }): React.JSX.Element {
  const { t } = useI18n()
  const list = useMemo(
    () =>
      ctx.fields.map((f) => {
        const fv = ctx.values(f.name)
        return { f, s: columnStats(f.name, fv.values, ctx.amounts, fv.fromTemplate) }
      }),
    [ctx]
  )
  const shown = list.filter((x) => !nearlyUnique(x.s))
  const unique = list.filter((x) => nearlyUnique(x.s))

  useEffect(() => {
    onTable([
      [
        t('stats.field'),
        t('stats.overviewValues'),
        t('stats.mean'),
        t('stats.min'),
        t('stats.max')
      ],
      ...list.map(({ f, s }) => [
        f.name,
        String(s.groups.filter((g) => g.value !== '').length),
        s.numeric ? ctx.num(s.numeric.mean) : '',
        s.numeric ? ctx.num(s.numeric.min) : '',
        s.numeric ? ctx.num(s.numeric.max) : ''
      ])
    ])
  }, [list]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="stats-tab stats-overview">
      {shown.map(({ f, s }) => {
        const filled = s.groups.filter((g) => g.value !== '')
        const bars = filled.slice(0, 8)
        const rest = filled.slice(8).reduce((a, g) => a + g.cards, 0)
        const empty = s.groups.find((g) => g.value === '')?.cards ?? 0
        const top = Math.max(1, ...bars.map((g) => g.cards), rest)
        return (
          <button
            key={f.name}
            className="stats-ov"
            title={t('stats.overviewOpen')}
            onClick={() => onOpen(f.name)}
          >
            <span className="stats-ov-head">
              <strong>{fieldLabel(f)}</strong>
              <span className="muted small">
                {t('stats.overviewSub', { n: filled.length })}
                {s.numeric && ` · ${t('stats.mean')} ${ctx.num(s.numeric.mean)}`}
                {empty > 0 && ` · ${t('stats.overviewEmpty', { n: empty })}`}
              </span>
            </span>
            {bars.map((g) => (
              <span key={g.value} className="stats-ov-bar">
                <span className="stats-ov-label">{emptyLabel(g.value, t, ctx.comma)}</span>
                <span className="bar">
                  <span style={{ width: `${(g.cards / top) * 100}%` }} />
                </span>
                <span className="num">{g.cards}</span>
              </span>
            ))}
            {rest > 0 && (
              <span className="stats-ov-bar muted">
                <span className="stats-ov-label">
                  {t('stats.overviewRest', { n: filled.length - 8 })}
                </span>
                <span className="bar">
                  <span style={{ width: `${(rest / top) * 100}%` }} />
                </span>
                <span className="num">{rest}</span>
              </span>
            )}
          </button>
        )
      })}
      {unique.length > 0 && (
        <p className="muted small">
          {t('stats.overviewUnique', { list: unique.map((x) => x.f.name).join(', ') })}
        </p>
      )}
    </div>
  )
}
