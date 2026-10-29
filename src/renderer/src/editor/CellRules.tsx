import { Fragment, useContext, useState } from 'react'
import FormulaDialog from '../components/FormulaDialog'
import HelpTip from '../components/HelpTip'
import { cardFields, cellFields, defaultValue, rowToCard } from '../../../shared/model/bind'
import { evaluateFormula, truthy } from '../../../shared/model/formula'
import { gridSize } from '../../../shared/model/grid'
import { walkLayers } from '../../../shared/model/normalize'
import { numberFormatting } from '../../../shared/model/numberFormat'
import type { CellRule, GridLayer, Template } from '../../../shared/model/template'
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
  onChange
}: {
  l: GridLayer
  template: Template
  sheets: Sheets
  onChange(rules: CellRule[]): void
}): React.JSX.Element {
  const { t } = useI18n()
  const variables = useContext(VariablesContext)
  const numbers = numberFormatting(useContext(NumberSettingsContext))
  const [fx, setFx] = useState<number | null>(null)
  const [picking, setPicking] = useState<number | null>(null)
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
  }
  const shaped = l.cell !== 'circle' && l.cell !== 'path'
  // i livelli del contenuto delle caselle a cui una regola può dare un valore
  const group = walkLayers([...template.front, ...template.back]).find(
    (x) => x.type === 'group' && x.name === l.content.trim()
  )
  const targets = group ? walkLayers([group]).filter((x) => x.type !== 'group') : []
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
        return (
          <div className="cell-rule" key={i}>
            <div className="cell-rule-head">
              <strong>{t('editor.cellRule', { n: i + 1 })}</strong>
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
                  onClick={() => onChange(rules.filter((_, k) => k !== i))}
                >
                  ×
                </button>
              </span>
            </div>
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
          </div>
        )
      })}
      <button type="button" onClick={() => onChange([...rules, { when: '' }])}>
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
