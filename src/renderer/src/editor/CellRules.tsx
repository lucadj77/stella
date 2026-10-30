import { Fragment, useContext, useState } from 'react'
import FormulaDialog from '../components/FormulaDialog'
import HelpTip from '../components/HelpTip'
import { cardFields, cellFields, defaultValue, rowToCard } from '../../../shared/model/bind'
import { evaluateFormula, truthy } from '../../../shared/model/formula'
import { gridSize } from '../../../shared/model/grid'
import { walkLayers } from '../../../shared/model/normalize'
import { numberFormatting } from '../../../shared/model/numberFormat'
import type {
  CellRule,
  GridLayer,
  GroupLayer,
  Layer,
  Template
} from '../../../shared/model/template'
import { useI18n } from '../i18n/context'
import type { MessageKey } from '../i18n/en'
import { NumberSettingsContext, VariablesContext } from '../render/assets'
import { CheckField, FillField, NumberField, StrokeField, TextField } from './fields'
import CellPicker from './CellPicker'
import { cellsCondition, pickedCells } from '../../../shared/model/cellRules'
import { Inherit } from './inheritance'

// Regole delle caselle di una griglia: dove la condizione è vera la casella cambia riempimento,
// contorno, raggio o si nasconde. Vedi docs/formato.md, "Griglia".

type Sheets = { set: string; headers: string[]; rows: string[][] }[]

export default function CellRules({
  l,
  template,
  sheets,
  onChange,
  onContent,
  onSelectGroup,
  onRemoveContent
}: {
  l: GridLayer
  template: Template
  sheets: Sheets
  onChange(rules: CellRule[]): void
  /** Apre «Inserisci un contenuto» per la regola k (da 0) */
  onContent(k: number): void
  onSelectGroup(id: string): void
  /** Il gruppo della regola esce dalla griglia */
  onRemoveContent(k: number): void
}): React.JSX.Element {
  const { t } = useI18n()
  const variables = useContext(VariablesContext)
  const numbers = numberFormatting(useContext(NumberSettingsContext))
  const [fx, setFx] = useState<number | null>(null)
  const [picking, setPicking] = useState<number | null>(null)
  // le regole aperte: all'inizio tutte chiuse, una regola nuova si apre
  const [open, setOpen] = useState<Set<number>>(() => new Set())
  const flip = (i: number): void =>
    setOpen((o) => {
      const next = new Set(o)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  const rules = l.cellRules
  const { rows, columns } = gridSize(l)
  const count = rows * columns
  // le condizioni si provano sul primo componente del primo set con righe, come le formule
  const sample = sheets.find((s) => s.rows.length)
  const fields = cardFields(
    template,
    sample ? rowToCard(sample.headers, sample.rows[0]) : { fields: {}, amount: 1 },
    variables,
    undefined,
    'front',
    numbers
  )
  const headers = [...new Set(sheets.flatMap((s) => s.headers))].filter(
    (h) => h !== 'amount' && !h.includes('.')
  )
  const condition = (when: string): string => {
    const w = when.trim()
    return !w || w.startsWith('=') ? w : `=${w}`
  }
  /** Su quante caselle vale la regola, nel componente d'esempio */
  const matches = (rule: CellRule): { n: number; error?: string } => {
    const expr = condition(rule.when)
    if (!expr) return { n: 0 }
    let n = 0
    for (let i = 0; i < count; i++) {
      const r = evaluateFormula(
        expr,
        { ...fields, ...cellFields(l.name, i, columns, count) },
        numbers && { decimalComma: numbers.decimalComma }
      )
      if (r.error) return { n: 0, error: r.error }
      if (truthy(r.value)) n++
    }
    return { n }
  }

  const change = (i: number, patch: Partial<CellRule>): void =>
    onChange(rules.map((r, k) => (k === i ? { ...r, ...patch } : r)))
  /** Una proprietà che la regola non cambia non si scrive */
  const toggle = <K extends keyof CellRule>(
    i: number,
    key: K,
    on: boolean,
    value: CellRule[K]
  ): void => {
    const rest: CellRule = { ...rules[i] }
    delete rest[key]
    onChange(rules.map((r, k) => (k === i ? (on ? { ...rest, [key]: value } : rest) : r)))
  }
  const move = (i: number, by: number): void => {
    const next = [...rules]
    const [r] = next.splice(i, 1)
    next.splice(i + by, 0, r)
    onChange(next)
    // la regola aperta resta aperta al suo nuovo posto
    setOpen((o) => {
      const out = new Set<number>()
      for (const k of o) out.add(k === i ? i + by : k === i + by ? i : k)
      return out
    })
  }
  const remove = (i: number): void => {
    onChange(rules.filter((_, k) => k !== i))
    setOpen((o) => new Set([...o].filter((k) => k !== i).map((k) => (k > i ? k - 1 : k))))
  }
  const shaped = l.cell !== 'circle' && l.cell !== 'path'
  // i livelli del contenuto delle caselle a cui una regola può dare un valore: quelli del
  // contenuto di tutte le caselle e quelli del gruppo della regola
  const groupNamed = (name?: string): GroupLayer | undefined =>
    name?.trim() ? l.groups.find((g) => g.name === name.trim()) : undefined
  const targetsOf = (rule: CellRule): Layer[] =>
    [groupNamed(l.content), groupNamed(rule.content)]
      .flatMap((g) => (g ? walkLayers([g]) : []))
      .filter((x) => x.type !== 'group')
  const setValue = (i: number, name: string, value: string | null): void => {
    const values = { ...rules[i].values }
    if (value === null) delete values[name]
    else values[name] = value
    const rule: CellRule = { ...rules[i], values }
    if (!Object.keys(values).length) delete rule.values
    onChange(rules.map((r, k) => (k === i ? rule : r)))
  }

  return (
    <Inherit keys={['cellRules']}>
      <h3>
        {t('editor.cellRules')} <HelpTip text={t('editor.cellRulesHelp')} />
      </h3>
      {!rules.length && <p className="muted small">{t('editor.cellRulesNone')}</p>}
      {rules.map((rule, i) => {
        const m = matches(rule)
        const isOpen = open.has(i)
        const own = groupNamed(rule.content)
        const targets = targetsOf(rule)
        return (
          <div className={'cell-rule' + (isOpen ? ' open' : '')} key={i}>
            <div className="cell-rule-head">
              <button
                type="button"
                className="cell-rule-toggle"
                aria-expanded={isOpen}
                title={isOpen ? t('editor.cellRuleClose') : t('editor.cellRuleOpen')}
                onClick={() => flip(i)}
              >
                <span className="cell-rule-twisty">{isOpen ? '▾' : '▸'}</span>
                <strong>{t('editor.cellRule', { n: i + 1 })}</strong>
                {typeof rule.fill === 'string' && (
                  <span className="cell-rule-swatch" style={{ background: rule.fill }} />
                )}
                {rule.hidden && (
                  <span className="cell-rule-tag">{t('editor.cellRuleHiddenTag')}</span>
                )}
                {own && <span className="cell-rule-tag">{own.name}</span>}
                {!isOpen && (
                  <span className="cell-rule-summary">
                    {m.error
                      ? t('editor.cellRuleErrorTag')
                      : rule.when.trim()
                        ? t('editor.cellRuleMatchesShort', { n: m.n, count })
                        : t('editor.cellRuleEmptyShort')}
                  </span>
                )}
              </button>
              <span className="cell-rule-tools">
                <button
                  type="button"
                  title={t('editor.cellRuleUp')}
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  title={t('editor.cellRuleDown')}
                  disabled={i === rules.length - 1}
                  onClick={() => move(i, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="danger"
                  title={t('editor.cellRuleRemove')}
                  onClick={() => remove(i)}
                >
                  ×
                </button>
              </span>
            </div>
            {isOpen && (
              <>
                <TextField
                  label={t('editor.cellRuleWhen')}
                  value={rule.when}
                  placeholder="={cell.row} = 1"
                  onChange={(when) => change(i, { when })}
                  action={
                    <button
                      type="button"
                      className="pick-btn fx-button"
                      title={t('fx.open')}
                      onClick={() => setFx(i)}
                    >
                      fx
                    </button>
                  }
                />
                <button type="button" className="cell-rule-pick" onClick={() => setPicking(i)}>
                  {t('cellPicker.open')}
                </button>
                <p className="small muted">
                  {m.error
                    ? t('source.formulaError', { error: m.error })
                    : rule.when.trim()
                      ? t('editor.cellRuleMatches', { n: m.n, count })
                      : t('editor.cellRuleEmpty')}
                </p>
                <CheckField
                  label={t('editor.cellRuleFill')}
                  value={rule.fill !== undefined}
                  onChange={(on) => toggle(i, 'fill', on, l.fill ?? '#FFFFFF')}
                />
                {rule.fill !== undefined && (
                  <FillField
                    label={t('prop.cellFill')}
                    value={rule.fill}
                    fallback="#FFFFFF"
                    onChange={(fill) => change(i, { fill })}
                  />
                )}
                <CheckField
                  label={t('editor.cellRuleStroke')}
                  value={rule.stroke !== undefined}
                  onChange={(on) =>
                    toggle(i, 'stroke', on, l.stroke ?? { color: '#333333', width: 0.3 })
                  }
                />
                {rule.stroke !== undefined && (
                  <StrokeField
                    label={t('prop.cellStroke')}
                    value={rule.stroke}
                    dashable
                    onChange={(stroke) => change(i, { stroke })}
                  />
                )}
                {shaped && (
                  <>
                    <CheckField
                      label={t('editor.cellRuleRadius')}
                      value={rule.radius !== undefined}
                      onChange={(on) => toggle(i, 'radius', on, l.radius)}
                    />
                    {rule.radius !== undefined && (
                      <NumberField
                        label={t('prop.radius')}
                        value={rule.radius}
                        min={0}
                        step={0.5}
                        unit="mm"
                        onChange={(radius) => change(i, { radius })}
                      />
                    )}
                  </>
                )}
                <CheckField
                  label={t('editor.cellRuleHidden')}
                  hint={t('editor.cellRuleHiddenHint')}
                  value={!!rule.hidden}
                  onChange={(on) => toggle(i, 'hidden', on, true)}
                />
                {targets.map((x) => {
                  const v = rule.values?.[x.name]
                  return (
                    <Fragment key={x.id}>
                      <CheckField
                        label={t('editor.cellRuleLayer', { name: x.name })}
                        hint={t('editor.cellRuleLayerHint')}
                        value={v !== undefined}
                        onChange={(on) =>
                          setValue(
                            i,
                            x.name,
                            on ? (x.type === 'image' ? x.src : (defaultValue(x) ?? '')) : null
                          )
                        }
                      />
                      {v !== undefined && (
                        <TextField
                          label={t(`layerType.${x.type}` as MessageKey)}
                          value={v}
                          placeholder={x.type === 'image' ? 'spada' : ''}
                          hint={t('editor.cellRuleLayerHint')}
                          onChange={(value) => setValue(i, x.name, value)}
                        />
                      )}
                    </Fragment>
                  )
                })}
                {!targets.length && <p className="small muted">{t('editor.cellRuleNoContent')}</p>}
                {own ? (
                  <div className="grid-content">
                    <div className="grid-content-head">
                      <span className="grid-content-name">{own.name}</span>
                      <button type="button" onClick={() => onSelectGroup(own.id)}>
                        {t('editor.gridContentSelect')}
                      </button>
                      <button type="button" onClick={() => onContent(i)}>
                        {t('editor.gridContentChange')}
                      </button>
                      <button
                        type="button"
                        title={t('editor.gridContentRemoveHint')}
                        onClick={() => onRemoveContent(i)}
                      >
                        {t('editor.gridContentRemove')}
                      </button>
                    </div>
                    <CheckField
                      label={t('prop.centered')}
                      hint={t('editor.centeredHint')}
                      value={rule.centered !== false}
                      onChange={(centered) => change(i, { centered })}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    title={t('editor.ruleContentHint')}
                    onClick={() => onContent(i)}
                  >
                    {t('editor.ruleContent')}
                  </button>
                )}
              </>
            )}
          </div>
        )
      })}
      <button
        type="button"
        onClick={() => {
          onChange([...rules, { when: '' }])
          setOpen((o) => new Set([...o, rules.length]))
        }}
      >
        {t('editor.cellRuleAdd')}
      </button>
      {picking !== null && rules[picking] && (
        <CellPicker
          grid={l}
          selected={pickedCells(rules[picking].when) ?? []}
          onApply={(cells) => change(picking, { when: cellsCondition(cells) })}
          onClose={() => setPicking(null)}
        />
      )}
      {fx !== null && rules[fx] && (
        <FormulaDialog
          title={t('editor.cellRuleFx', { n: fx + 1 })}
          value={condition(rules[fx].when)}
          expect="bool"
          condition
          columns={headers}
          layers={walkLayers([...template.front, ...template.back])
            .filter((x) => x.type !== 'group')
            .map((x) => x.name)}
          sample={{ ...fields, ...cellFields(l.name, 0, columns, count) }}
          sampleLabel={sample ? t('fx.firstCardOf', { set: sample.set }) : undefined}
          cells={{ grid: l.name, rows, columns }}
          onApply={(when) => change(fx, { when })}
          onClose={() => setFx(null)}
        />
      )}
    </Inherit>
  )
}
