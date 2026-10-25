import { useContext, useMemo, useState } from 'react'
import AssetPicker from '../components/AssetPicker'
import { ImageIcon } from '../components/icons'
import { P, Section } from './advanced'
import { findLayer, isNameTaken, patchLayers } from '../../../shared/model/edit'
import { assetRefName, isImageAsset, resolveAsset } from '../../../shared/model/assets'
import type {
  Anchor,
  CardShape,
  GridCell,
  GridLayer,
  GroupLayout,
  LayoutAlign,
  BlendMode,
  Constraints,
  GroupLayer,
  ImageLayer,
  Layer,
  ShapeKind,
  ShapeLayer,
  Template,
  TextLayer,
  ValueLayer
} from '../../../shared/model/template'
import { isArranged, walkLayers } from '../../../shared/model/normalize'
import { gridGeometry } from '../../../shared/model/grid'
import { baseLayer, baseTemplateValue, changedTemplateKeys } from '../../../shared/model/inherit'
import {
  INHERITABLE_TEMPLATE_KEYS,
  type InheritableTemplateKey
} from '../../../shared/model/template'
import { Inherit } from './inheritance'
import { InheritContext, type InheritCtx } from './inheritContext'
import { hexagonFit, lineEnds, lineFromEnds, type Point } from '../../../shared/model/geometry'
import { useI18n, type Translate } from '../i18n/context'
import { evaluateFormula } from '../../../shared/model/formula'
import {
  cardFields,
  cellFields,
  rowToCard,
  substituteFields,
  switchSource
} from '../../../shared/model/bind'
import type { MessageKey } from '../i18n/en'
import {
  AssetsContext,
  ProjectLanguagesContext,
  VariablesContext,
  assetUrl
} from '../render/assets'
import FormulaDialog, { type FormulaExpect } from '../components/FormulaDialog'
import { contentGrid } from '../../../shared/model/formulaAssist'
import CropDialog from '../components/CropDialog'
import { DisplayContext } from './displayContext'
import { cropText } from '../../../shared/model/crop'
import { traceImage } from '../render/traceImage'
import { ColorFieldsContext } from './colorFields'
import {
  CheckField,
  ColorField,
  FontField,
  NumberField,
  SizeFields,
  FillField,
  FadeFields,
  Row,
  SelectField,
  ShadowFields,
  StrokeField,
  TextField
} from './fields'
import type { EditorAction, EditorState } from './useEditor'
import type { Commands } from './commands'
import PanelSideButton from '../components/PanelSideButton'
import AlignSection from './AlignSection'
import type { PanelSide } from '../components/usePanelWidth'
import { useRatioLock, type LockKind } from './ratioLock'
import TranslationFields from '../components/TranslationFields'

interface Props {
  state: EditorState
  dispatch: React.Dispatch<EditorAction>
  cmd: Commands
  /** Intestazioni dei fogli dei set che usano il template */
  sheets: { set: string; headers: string[]; rows: string[][] }[]
  width: number
  /** Cambio di formato: chiede se scalare i livelli */
  onResize(width: number, height: number): void
  side: PanelSide
  onToggleSide(): void
  /** Template base già risolto, se il template è derivato */
  base?: Template | null
}

export default function PropertiesPanel({
  state,
  dispatch,
  cmd,
  sheets,
  width,
  onResize,
  side: panelSide,
  onToggleSide,
  base = null
}: Props): React.JSX.Element {
  const { t } = useI18n()
  const { template: tpl, side, selection } = state
  const layer = selection.length === 1 ? findLayer(tpl[side], selection[0]) : null
  // con più livelli il pannello mostra i valori del primo e ogni modifica vale per tutti
  const many = selection.length > 1 ? selection.map((id) => findLayer(tpl[side], id)) : []
  const first = many.length && many.every(Boolean) ? many[0] : null

  // nei colori si può richiamare un livello valore con {nome}
  const valueLayers = walkLayers([...tpl.front, ...tpl.back])
    .filter((x) => x.type === 'value')
    .map((x) => x.name)

  return (
    <ColorFieldsContext.Provider value={valueLayers}>
      <aside
        className={base ? 'properties derived' : 'properties'}
        data-side={panelSide}
        style={{ width }}
      >
        <PanelSideButton side={panelSide} onToggle={onToggleSide} className="corner" />
        {selection.length > 0 && <AlignSection state={state} dispatch={dispatch} />}
        {selection.length > 1 ? (
          <>
            <h2>{t('editor.multiSelectionTitle', { n: selection.length })}</h2>
            <p className="muted small">{t('editor.multiSelection')}</p>
            <div className="selection-actions">
              <button disabled={!cmd.canGroup} onClick={cmd.group} title={t('tip.group')}>
                {t('layers.group')}
              </button>
              <button onClick={cmd.duplicate} title={t('tip.duplicate')}>
                {t('layers.duplicate')}
              </button>
              <button className="danger" onClick={cmd.remove} title={t('tip.delete')}>
                {t('layers.delete')}
              </button>
            </div>
            {first && (
              <>
                <p className="muted small">{t('editor.multiEdit', { name: first.name })}</p>
                <LayerProperties
                  key={selection.join(',')}
                  layer={first}
                  targets={selection}
                  state={state}
                  dispatch={dispatch}
                  sheets={sheets}
                />
              </>
            )}
          </>
        ) : layer ? (
          <>
            <LayerProperties
              key={layer.id}
              layer={layer}
              state={state}
              dispatch={dispatch}
              sheets={sheets}
              base={base}
            />
            {layer.type === 'group' && (
              <div className="selection-actions">
                <button onClick={cmd.ungroup} title={t('tip.ungroup')}>
                  {t('layers.ungroup')}
                </button>
              </div>
            )}
          </>
        ) : (
          <TemplateProperties
            template={tpl}
            base={base}
            dispatch={dispatch}
            sheets={sheets}
            onResize={onResize}
          />
        )}
      </aside>
    </ColorFieldsContext.Provider>
  )
}

function TemplateProperties({
  template: tpl,
  base,
  dispatch,
  sheets,
  onResize
}: {
  template: Template
  base: Template | null
  dispatch: React.Dispatch<EditorAction>
  sheets: Props['sheets']
  onResize(width: number, height: number): void
}): React.JSX.Element {
  const { t } = useI18n()
  const [locked, setLocked] = useRatioLock('template')
  const set = (p: Partial<Template>, key: string): void =>
    dispatch({ type: 'change', template: { ...tpl, ...p }, key: `template.${key}` })
  // in un derivato ogni proprietà mostra se viene dal base o è cambiata
  const changed = base ? changedTemplateKeys(base, tpl) : []
  const inherit: InheritCtx | null = base && {
    status: (k) =>
      (INHERITABLE_TEMPLATE_KEYS as readonly string[]).includes(k)
        ? changed.includes(k as InheritableTemplateKey)
          ? 'changed'
          : 'inherited'
        : null,
    revert: (keys) =>
      set(
        Object.fromEntries(
          keys.map((k) => [k, baseTemplateValue(base, k as InheritableTemplateKey) ?? undefined])
        ),
        'revert'
      )
  }
  return (
    <InheritContext.Provider value={inherit}>
      <h2>{t('editor.templateProperties')}</h2>
      <div className="field">
        <span className="field-label">{t('prop.name')}</span>
        <span className="field-control">{tpl.name}</span>
      </div>
      {base ? (
        // le misure della carta sono sempre quelle del base
        <div className="field" title={t('inherit.sizeFromBase')}>
          <span className="field-label">{t('prop.size')}</span>
          <span className="field-control muted">
            {tpl.width} × {tpl.height} mm
          </span>
        </div>
      ) : (
        <SizeFields
          labels={[t('prop.width'), t('prop.height')]}
          w={tpl.width}
          h={tpl.height}
          min={5}
          unit="mm"
          deferred
          layout="column"
          locked={locked}
          onLock={setLocked}
          // con il lucchetto l'altra misura si arrotonda al decimo di millimetro
          onChange={(w, h) =>
            locked ? onResize(Math.round(w * 10) / 10, Math.round(h * 10) / 10) : onResize(w, h)
          }
        />
      )}
      <Inherit keys={['bleed']}>
        <NumberField
          label={t('prop.bleed')}
          value={tpl.bleed}
          min={0}
          unit="mm"
          onChange={(bleed) => set({ bleed }, 'bleed')}
        />
      </Inherit>
      <Inherit keys={['safeMargin']}>
        <NumberField
          label={t('prop.safeMargin')}
          value={tpl.safeMargin}
          min={0}
          unit="mm"
          onChange={(safeMargin) => set({ safeMargin }, 'safeMargin')}
        />
      </Inherit>
      <Inherit keys={['shape']}>
        <SelectField<CardShape>
          label={t('prop.cardShape')}
          hint={t('editor.cardShapeHint')}
          value={tpl.shape ?? 'rect'}
          options={options(t, 'cardShape', ['rect', 'ellipse', 'hexagon', 'path'] as const)}
          onChange={(shape) => set({ shape }, 'shape')}
        />
      </Inherit>
      {(tpl.shape ?? 'rect') === 'rect' && (
        <Inherit keys={['cornerRadius']}>
          <NumberField
            label={t('prop.cornerRadius')}
            value={tpl.cornerRadius}
            min={0}
            unit="mm"
            onChange={(cornerRadius) => set({ cornerRadius }, 'cornerRadius')}
          />
        </Inherit>
      )}
      {tpl.shape === 'hexagon' &&
        !base &&
        (() => {
          const fit = hexagonFit(tpl.width, tpl.height)
          if (fit.w === tpl.width && fit.h === tpl.height) return null
          return (
            <div className="field">
              <span className="field-label" />
              <div className="field-control">
                <button type="button" onClick={() => onResize(fit.w, fit.h)}>
                  {t('editor.hexagonFit', { w: fit.w, h: fit.h })}
                </button>
              </div>
              <p className="field-note">{t('editor.hexagonFitHint')}</p>
            </div>
          )
        })()}
      {tpl.shape === 'path' && (
        <Inherit keys={['shapePath']}>
          <OutlineField
            hint={t('editor.cardOutlineHint')}
            empty={!tpl.shapePath?.trim()}
            onTraced={({ path }) => set({ shapePath: path }, 'shapePath')}
          />
        </Inherit>
      )}
      <Inherit keys={['guides']}>
        <GuideFields template={tpl} set={set} />
      </Inherit>
      <Inherit keys={['labelField']}>
        <SelectField<string>
          label={t('prop.labelField')}
          hint={t('editor.labelFieldHint')}
          value={tpl.labelField ?? ''}
          options={[
            ['', t('editor.labelFieldAuto')],
            ...labelChoices(tpl, sheets).map((f): [string, string] => [f, f])
          ]}
          onChange={(f) => set({ labelField: f || null }, 'labelField')}
        />
      </Inherit>
      <p className="muted small">{t('editor.noSelectionHint')}</p>
    </InheritContext.Provider>
  )
}

/** Campi che possono dare il nome alle carte: colonne dei fogli e livelli del template */
function labelChoices(tpl: Template, sheets: Props['sheets']): string[] {
  const headers = sheets.flatMap((s) => s.headers).filter((h) => h !== 'amount' && !h.includes('.'))
  const layers = walkLayers([...tpl.front, ...tpl.back])
    .filter((l) => l.type !== 'group')
    .map((l) => l.name)
  const all = [...new Set([...headers, ...layers])]
  if (tpl.labelField && !all.includes(tpl.labelField)) all.push(tpl.labelField)
  return all
}

function LayerProperties({
  layer: l,
  targets,
  state,
  dispatch,
  sheets,
  base = null
}: {
  layer: Layer
  /** Livelli selezionati quando sono più di uno: le modifiche valgono per tutti */
  targets?: string[]
  state: EditorState
  dispatch: React.Dispatch<EditorAction>
  sheets: Props['sheets']
  /** Base del template derivato */
  base?: Template | null
}): React.JSX.Element {
  const { t } = useI18n()
  const { template: tpl, side } = state
  const ids = targets && targets.length > 1 ? targets : [l.id]
  const multi = ids.length > 1
  const layers = ids.flatMap((id) => findLayer(tpl[side], id) ?? [])
  // le proprietà di un tipo compaiono solo se i livelli sono tutti di quel tipo
  const same = layers.every((x) => x.type === l.type)
  const set = (patch: Partial<Layer>): void => {
    const key = `${ids.join('+')}.${Object.keys(patch).join(',')}`
    dispatch({ type: 'change', template: patchLayers(tpl, side, ids, l, patch), key })
  }
  /** Colonna del foglio che sovrascrive la proprietà */
  const col = (prop?: string): string =>
    t('editor.columnHint', { column: prop ? `${l.name}.${prop}` : l.name })

  const validateName = (name: string): string | null => {
    if (!name.trim() || name.trim() !== name) return t('editor.nameEmpty')
    if (/[.{}[\]]/.test(name)) return t('editor.nameChars')
    if (isNameTaken(tpl, name, l.id)) return t('editor.nameTaken')
    return null
  }

  // con una formula il valore principale è calcolato: il campo del valore non serve
  const computed = l.source.kind === 'formula'

  // livello ereditato da un base: ogni proprietà mostra se è del base o cambiata
  const from = base && !multi ? baseLayer(base, l.id) : null
  const inherit: InheritCtx | null = from && {
    status: (k) => {
      const a = (from as unknown as Record<string, unknown>)[k]
      const b = (l as unknown as Record<string, unknown>)[k]
      if (b === undefined) return null
      // il riquadro di un gruppo normale segue i figli
      if (l.type === 'group' && !isArranged(l) && ['x', 'y', 'w', 'h'].includes(k)) return null
      return JSON.stringify(a) === JSON.stringify(b) ? 'inherited' : 'changed'
    },
    revert: (keys) =>
      set(
        Object.fromEntries(
          keys.map((k) => [k, (from as unknown as Record<string, unknown>)[k]])
        ) as Partial<Layer>
      )
  }

  return (
    <InheritContext.Provider value={inherit}>
      {!multi && (
        <>
          <h2>
            {t(`layerType.${l.type}` as MessageKey)}
            {l.type === 'shape' && ` · ${t(`shape.${l.shape}` as MessageKey)}`}
          </h2>
          <TextField
            label={t('prop.name')}
            // il nome di un livello ereditato è la sua colonna: si cambia nel base
            hint={from ? t('inherit.nameFromBase') : t('editor.nameHint')}
            disabled={!!from}
            value={l.name}
            validate={validateName}
            onChange={(name) => set({ name })}
          />
          {base && !from && <p className="muted small">{t('inherit.addedLayer')}</p>}
          <Inherit keys={['source']}>
            <ValueSource layer={l} template={tpl} sheets={sheets} set={set} />
          </Inherit>
        </>
      )}

      {same && l.type === 'text' && (
        <TextProperties
          l={l}
          set={set}
          col={col}
          computed={computed}
          fields={labelChoices(tpl, sheets)}
        />
      )}
      {same && l.type === 'image' && (
        <ImageProperties l={l} set={set} col={col} computed={computed} />
      )}
      {same && l.type === 'shape' && (
        <ShapeProperties l={l} set={set} col={col} computed={computed} />
      )}
      {same && l.type === 'grid' && (
        <GridProperties
          l={l}
          set={set}
          col={col}
          computed={computed}
          groups={walkLayers(tpl[side]).flatMap((x) => (x.type === 'group' ? [x] : []))}
          onPlace={(g) => {
            // il gruppo va al centro della prima casella, dove la griglia lo disegna com'è
            const c = gridGeometry(l as GridLayer).centers[0]
            if (!c) return
            const patch = { x: l.x + c.x - g.w / 2, y: l.y + c.y - g.h / 2 }
            dispatch({ type: 'change', template: patchLayers(tpl, side, [g.id], g, patch) })
          }}
        />
      )}
      {same && !multi && l.type === 'value' && (
        <ValueProperties l={l} set={set} col={col} computed={computed} />
      )}
      {same && l.type === 'group' && <GroupProperties l={l as GroupLayer} set={set} col={col} />}

      {layers.every((x) => x.type !== 'value') && (
        <DrawnProperties l={l} set={set} col={col} multi={multi} />
      )}
    </InheritContext.Provider>
  )
}

/** Forma presa dal contorno di un'immagine del progetto */
function OutlineField({
  hint,
  empty,
  onTraced
}: {
  hint: string
  empty: boolean
  onTraced(r: { path: string; ratio: number }): void
}): React.JSX.Element {
  const { t } = useI18n()
  const assets = useContext(AssetsContext)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState(false)
  const pick = async (name: string): Promise<void> => {
    setPicking(false)
    const r = resolveAsset(name, assets)
    try {
      if (!r.ok) throw new Error(name)
      const traced = await traceImage(assetUrl(r.path))
      if (!traced.path) throw new Error(name)
      setError(false)
      onTraced(traced)
    } catch {
      setError(true)
    }
  }
  return (
    <>
      <div className="field">
        <span className="field-label">{t('prop.outline')}</span>
        <div className="field-control">
          <button type="button" className="small-btn" onClick={() => setPicking(true)}>
            {t('editor.outlinePick')}
          </button>
          {empty && <span className="muted small">{t('editor.outlineEmpty')}</span>}
        </div>
      </div>
      {error && <p className="field-error">{t('editor.outlineFailed')}</p>}
      <p className="muted small">{hint}</p>
      {picking && <AssetPicker value="" onPick={pick} onClose={() => setPicking(false)} />}
    </>
  )
}

/** Guide manuali: si aggiungono qui e si spostano trascinandole sulla carta */
function GuideFields({
  template: tpl,
  set
}: {
  template: Template
  set(p: Partial<Template>, key: string): void
}): React.JSX.Element {
  const { t } = useI18n()
  const guides = tpl.guides ?? { x: [], y: [] }
  const change = (axis: 'x' | 'y', list: number[]): void =>
    set({ guides: { ...guides, [axis]: list } }, `guides.${axis}`)
  return (
    <>
      <h3>{t('editor.guides')}</h3>
      {(['x', 'y'] as const).map((axis) =>
        guides[axis].map((v, i) => (
          <div className="guide-row" key={`${axis}${i}`}>
            <NumberField
              label={t(axis === 'x' ? 'editor.guideV' : 'editor.guideH')}
              value={v}
              unit="mm"
              onChange={(n) =>
                change(
                  axis,
                  guides[axis].map((g, j) => (j === i ? n : g))
                )
              }
            />
            <button
              type="button"
              className="icon-btn"
              title={t('editor.guideRemove')}
              onClick={() =>
                change(
                  axis,
                  guides[axis].filter((_, j) => j !== i)
                )
              }
            >
              ×
            </button>
          </div>
        ))
      )}
      <div className="guide-buttons">
        <button
          type="button"
          className="small-btn"
          onClick={() => change('x', [...guides.x, tpl.width / 2])}
        >
          {t('editor.guideAddV')}
        </button>
        <button
          type="button"
          className="small-btn"
          onClick={() => change('y', [...guides.y, tpl.height / 2])}
        >
          {t('editor.guideAddH')}
        </button>
      </div>
      <p className="muted small">{t('editor.guidesHint')}</p>
    </>
  )
}

function GroupProperties({
  l,
  set,
  col
}: Omit<TypeProps<GroupLayer>, 'computed'>): React.JSX.Element {
  const { t } = useI18n()
  const arranged = l.layout !== 'none' || l.repeat.trim() !== '1'
  return (
    <>
      <Inherit keys={['clip']}>
        <CheckField
          label={t('prop.clip')}
          hint={t('editor.clipHint')}
          value={l.clip}
          onChange={(clip) => set({ clip })}
        />
      </Inherit>
      <h3>{t('editor.layout')}</h3>
      <Inherit keys={['layout']}>
        <SelectField<GroupLayout>
          label={t('prop.layout')}
          hint={t('editor.layoutHint')}
          value={l.layout}
          options={options(t, 'layout', ['none', 'row', 'column', 'grid'] as const)}
          onChange={(layout) => set({ layout })}
        />
      </Inherit>
      <Inherit keys={['repeat']}>
        <TextField
          label={t('prop.repeat')}
          hint={`${t('editor.repeatHint')} ${col('repeat')}`}
          value={l.repeat}
          placeholder="1"
          validate={(v) =>
            !v.trim() || /^\s*\d+\s*$/.test(v) || /\{[^}]+\}/.test(v)
              ? null
              : t('editor.repeatInvalid')
          }
          onChange={(repeat) => set({ repeat: repeat.trim() || '1' })}
        />
      </Inherit>
      {arranged && (
        <>
          <Inherit keys={['gap']}>
            <NumberField
              label={t('prop.gap')}
              value={l.gap}
              unit="mm"
              step={0.5}
              onChange={(gap) => set({ gap })}
            />
          </Inherit>
          {l.layout === 'grid' && (
            <NumberField
              label={t('prop.columns')}
              value={l.columns}
              step={1}
              min={1}
              onChange={(columns) => set({ columns: Math.max(1, Math.round(columns)) })}
            />
          )}
          <Inherit keys={['justify']}>
            <SelectField<LayoutAlign>
              label={t('prop.justify')}
              value={l.justify}
              options={options(t, l.layout === 'column' ? 'justifyV' : 'justifyH', ALIGNS)}
              onChange={(justify) => set({ justify })}
            />
          </Inherit>
          <Inherit keys={['alignItems']}>
            <SelectField<LayoutAlign>
              label={t('prop.alignItems')}
              value={l.alignItems}
              options={options(t, l.layout === 'column' ? 'justifyH' : 'justifyV', ALIGNS)}
              onChange={(alignItems) => set({ alignItems })}
            />
          </Inherit>
          <p className="muted small">{t('editor.arrangedHint')}</p>
        </>
      )}
    </>
  )
}

const ALIGNS = ['start', 'center', 'end'] as const

/** Geometria e aspetto: i livelli valore non li hanno */
function DrawnProperties({
  l,
  set,
  col,
  multi = false
}: Omit<TypeProps<Layer>, 'computed'> & {
  /** Più livelli: posizione e dimensioni restano di ciascuno (per quelle c'è Allinea) */
  multi?: boolean
}): React.JSX.Element {
  const { t } = useI18n()
  const [locked, setLocked] = useRatioLock(l.type as LockKind)
  const line = l.type === 'shape' && l.shape === 'line'
  const [a, b] = lineEnds(l)
  const ends = (p: Point, q: Point): void => set(lineFromEnds(l, p, q))
  const r = (v: number): number => Math.round(v * 100) / 100
  return (
    <>
      <Section scope="geometry" title={t('editor.geometry')}>
        {multi ? null : line ? (
          <Inherit keys={['x', 'y', 'w', 'rotation']}>
            <div className="field-grid">
              <NumberField
                label="Ax"
                value={r(a.x)}
                unit="mm"
                onChange={(x) => ends({ ...a, x }, b)}
              />
              <NumberField
                label="Ay"
                value={r(a.y)}
                unit="mm"
                onChange={(y) => ends({ ...a, y }, b)}
              />
              <NumberField
                label="Bx"
                value={r(b.x)}
                unit="mm"
                onChange={(x) => ends(a, { ...b, x })}
              />
              <NumberField
                label="By"
                value={r(b.y)}
                unit="mm"
                onChange={(y) => ends(a, { ...b, y })}
              />
              <NumberField
                label="L"
                hint={t('prop.length')}
                value={r(l.w)}
                min={0}
                unit="mm"
                onChange={(w) => set({ w })}
              />
            </div>
          </Inherit>
        ) : (
          <Inherit keys={['x', 'y', 'w', 'h']}>
            <div className="field-grid">
              <NumberField
                label="X"
                hint={col('x')}
                value={l.x}
                unit="mm"
                onChange={(x) => set({ x })}
              />
              <NumberField
                label="Y"
                hint={col('y')}
                value={l.y}
                unit="mm"
                onChange={(y) => set({ y })}
              />
              <SizeFields
                labels={[t('prop.w'), t('prop.h')]}
                hints={[col('w'), col('h')]}
                w={l.w}
                h={l.h}
                min={0.5}
                unit="mm"
                locked={locked}
                onLock={setLocked}
                onChange={(w, h) => set({ w, h })}
              />
            </div>
          </Inherit>
        )}
        {line && !multi && <p className="muted small">{t('editor.lineHint')}</p>}
        <P id="rotation">
          <NumberField
            label={t('prop.rotation')}
            hint={col('rotation')}
            value={l.rotation}
            step={1}
            min={-360}
            max={360}
            unit="°"
            onChange={(rotation) => set({ rotation })}
          />
        </P>
        <P id="anchor" adv>
          <SelectField<Anchor>
            label={t('prop.anchor')}
            hint={t('editor.anchorHint')}
            value={l.anchor}
            options={ANCHORS.map((a) => [a, t(`anchor.${a}` as MessageKey)])}
            onChange={(anchor) => set({ anchor })}
          />
        </P>
        <P id="constraintH" adv>
          <SelectField<Constraints['h']>
            label={t('prop.constraintH')}
            hint={t('editor.constraintsHint')}
            value={l.constraints.h}
            options={options(t, 'constraintH', [
              'left',
              'right',
              'center',
              'both',
              'scale'
            ] as const)}
            onChange={(h) => set({ constraints: { ...l.constraints, h } })}
          />
        </P>
        <P id="constraintV" adv>
          <SelectField<Constraints['v']>
            label={t('prop.constraintV')}
            hint={t('editor.constraintsHint')}
            value={l.constraints.v}
            options={options(t, 'constraintV', [
              'top',
              'bottom',
              'center',
              'both',
              'scale'
            ] as const)}
            onChange={(v) => set({ constraints: { ...l.constraints, v } })}
          />
        </P>
      </Section>
      <Section scope="appearance" title={t('editor.appearance')}>
        <P id="opacity">
          <NumberField
            label={t('prop.opacity')}
            hint={col('opacity')}
            value={l.opacity}
            factor={100}
            step={5}
            min={0}
            max={1}
            unit="%"
            onChange={(opacity) => set({ opacity })}
          />
        </P>
        <P id="blend" adv>
          <SelectField<BlendMode>
            label={t('prop.blend')}
            hint={col('blend')}
            value={l.blend}
            options={options(t, 'blend', ['normal', 'multiply', 'screen', 'overlay'] as const)}
            onChange={(blend) => set({ blend })}
          />
        </P>
        <P id="fade" adv>
          <FadeFields
            value={l.fade}
            hint={t('editor.fadeHint')}
            onChange={(fade) => set({ fade })}
          />
        </P>
        <P id="shadow" adv>
          <ShadowFields
            value={l.shadow}
            hint={col('shadow')}
            onChange={(shadow) => set({ shadow })}
          />
        </P>
        <P id="visible">
          <CheckField
            label={t('prop.visible')}
            hint={l.type === 'group' ? col() : col('visible')}
            disabled={l.type === 'group' && l.source.kind === 'formula'}
            value={l.visible}
            onChange={(visible) => set({ visible })}
          />
        </P>
        <P id="locked" adv>
          <CheckField
            label={t('prop.locked')}
            hint={t('editor.lockedHint')}
            value={l.locked}
            onChange={(locked) => set({ locked })}
          />
        </P>
      </Section>
    </>
  )
}

type SetFn<T> = (patch: Partial<T>) => void
interface TypeProps<T> {
  l: T
  set: SetFn<Layer>
  col(prop?: string): string
  /** Il valore principale viene da una formula */
  computed: boolean
  /** Campi della carta, per l'aiuto alla scrittura del markup */
  fields?: string[]
}

function options<T extends string>(
  t: Translate,
  prefix: string,
  values: readonly T[]
): [T, string][] {
  return values.map((v) => [v, t(`${prefix}.${v}` as MessageKey)])
}

const ANCHORS: Anchor[] = [
  'top-left',
  'top',
  'top-right',
  'left',
  'center',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right'
]
const WEIGHTS = [100, 200, 300, 400, 500, 600, 700, 800, 900]

function TextProperties({
  l,
  set: setLayer,
  col,
  computed,
  fields
}: TypeProps<TextLayer>): React.JSX.Element {
  const { t } = useI18n()
  const set = setLayer as SetFn<TextLayer>
  const translatable = useContext(ProjectLanguagesContext).length > 1
  return (
    <>
      {/* con una formula il valore è il suo risultato: il campo non serve */}
      {!computed && (
        <Inherit keys={['text']}>
          <TextField
            label={t('prop.text')}
            hint={col()}
            value={l.text}
            multiline
            markupFields={fields}
            onChange={(text) => set({ text })}
          />
        </Inherit>
      )}
      {/* le traduzioni valgono solo per un testo fisso: una colonna si traduce con nome@lingua */}
      {l.source.kind === 'fixed' && translatable && (
        <Inherit keys={['texts']}>
          <TranslationFields
            label={t('prop.text')}
            value={l.texts}
            multiline
            markupFields={fields}
            onChange={(texts) => set({ texts })}
          />
        </Inherit>
      )}
      <Section scope="text" title={t('editor.typography')}>
        <P id="font">
          <FontField
            label={t('prop.font')}
            hint={col('font')}
            value={l.font}
            onChange={(font) => set({ font })}
          />
        </P>
        <P id="weight">
          <SelectField<number>
            label={t('prop.weight')}
            hint={col('weight')}
            value={l.weight}
            options={WEIGHTS.map((w) => [w, `${w} · ${t(`weight.${w}` as MessageKey)}`])}
            onChange={(weight) => set({ weight })}
          />
        </P>
        <P id="italic">
          <CheckField
            label={t('prop.italic')}
            hint={col('italic')}
            value={l.italic}
            onChange={(italic) => set({ italic })}
          />
        </P>
        <P id="size">
          <NumberField
            label={t('prop.size')}
            hint={col('size')}
            value={l.size}
            min={1}
            unit="pt"
            onChange={(size) => set({ size })}
          />
        </P>
        <P id="color">
          <ColorField
            label={t('prop.color')}
            hint={col('color')}
            value={l.color}
            onChange={(color) => color && set({ color })}
          />
        </P>
        <P id="align">
          <SelectField
            label={t('prop.align')}
            hint={col('align')}
            value={l.align}
            options={options(t, 'align', ['left', 'center', 'right', 'justify'] as const)}
            onChange={(align) => set({ align })}
          />
        </P>
        <P id="valign">
          <SelectField
            label={t('prop.valign')}
            hint={col('valign')}
            value={l.valign}
            options={options(t, 'valign', ['top', 'middle', 'bottom'] as const)}
            onChange={(valign) => set({ valign })}
          />
        </P>
        <P id="lineHeight">
          <NumberField
            label={t('prop.lineHeight')}
            hint={col('lineHeight')}
            value={l.lineHeight}
            step={0.05}
            min={0.5}
            onChange={(lineHeight) => set({ lineHeight })}
          />
        </P>
        <P id="letterSpacing" adv>
          <NumberField
            label={t('prop.letterSpacing')}
            hint={col('letterSpacing')}
            value={l.letterSpacing}
            step={10}
            onChange={(letterSpacing) => set({ letterSpacing })}
          />
        </P>
        <P id="paragraphSpacing" adv>
          <NumberField
            label={t('prop.paragraphSpacing')}
            hint={col('paragraphSpacing')}
            value={l.paragraphSpacing}
            min={0}
            unit="mm"
            onChange={(paragraphSpacing) => set({ paragraphSpacing })}
          />
        </P>
        <P id="indent" adv>
          <NumberField
            label={t('prop.indent')}
            hint={col('indent')}
            value={l.indent}
            unit="mm"
            onChange={(indent) => set({ indent })}
          />
        </P>
        <P id="padding" adv>
          <NumberField
            label={t('prop.padding')}
            hint={col('padding')}
            value={l.padding}
            min={0}
            unit="mm"
            disabled={!!l.paddingSides}
            onChange={(padding) => set({ padding })}
          />
        </P>
        <P id="paddingSides" adv>
          <CheckField
            label={t('prop.paddingSides')}
            hint={t('editor.paddingSidesHint')}
            value={!!l.paddingSides}
            onChange={(on) =>
              set({ paddingSides: on ? [l.padding, l.padding, l.padding, l.padding] : null })
            }
          />
          {l.paddingSides && (
            <div className="field-grid sides-grid">
              {(['top', 'right', 'bottom', 'left'] as const).map((side, i) => (
                <NumberField
                  key={side}
                  label={t(`side.${side}` as MessageKey)}
                  value={l.paddingSides![i]}
                  min={0}
                  unit="mm"
                  onChange={(v) => {
                    const next = [...l.paddingSides!] as [number, number, number, number]
                    next[i] = v
                    set({ paddingSides: next })
                  }}
                />
              ))}
            </div>
          )}
        </P>
        <P id="transform" adv>
          <SelectField
            label={t('prop.transform')}
            hint={col('transform')}
            value={l.transform}
            options={options(t, 'transform', ['none', 'upper', 'lower', 'capitalize'] as const)}
            onChange={(transform) => set({ transform })}
          />
        </P>
        <P id="underline" adv>
          <CheckField
            label={t('prop.underline')}
            hint={col('underline')}
            value={l.underline}
            onChange={(underline) => set({ underline })}
          />
        </P>
        <P id="strike" adv>
          <CheckField
            label={t('prop.strike')}
            hint={col('strike')}
            value={l.strike}
            onChange={(strike) => set({ strike })}
          />
        </P>
        <P id="wrap" adv>
          <CheckField
            label={t('prop.wrap')}
            hint={col('wrap')}
            value={l.wrap}
            onChange={(wrap) => set({ wrap })}
          />
        </P>
        <P id="stroke" adv>
          <StrokeField
            label={t('prop.stroke')}
            hint={col('stroke')}
            value={l.stroke}
            allowPercent
            onChange={(stroke) => set({ stroke })}
          />
        </P>
        <P id="fit">
          <SelectField
            label={t('prop.fit')}
            hint={col('fit')}
            value={l.fit}
            options={options(t, 'textFit', ['none', 'shrink', 'truncate'] as const)}
            onChange={(fit) => set({ fit })}
          />
        </P>
        {l.fit === 'shrink' && (
          <P id="minSize">
            <NumberField
              label={t('prop.minSize')}
              hint={col('minSize')}
              value={l.minSize}
              min={1}
              unit="pt"
              onChange={(minSize) => set({ minSize })}
            />
          </P>
        )}
      </Section>
    </>
  )
}

/** Nomi brevi dei file immagine: è come si scrivono nel foglio */
function useAssetNames(): string[] {
  const assets = useContext(AssetsContext)
  return useMemo(
    () => [...new Set(assets.filter(isImageAsset).map((a) => assetRefName(a, assets)))].sort(),
    [assets]
  )
}

function ImageProperties({
  l,
  set: setLayer,
  col,
  computed
}: TypeProps<ImageLayer>): React.JSX.Element {
  const { t } = useI18n()
  const set = setLayer as SetFn<ImageLayer>
  const names = useAssetNames()
  const assets = useContext(AssetsContext)
  const res = resolveAsset(l.src, assets)
  const listId = `assets-${l.id}`
  const [picking, setPicking] = useState(false)
  const [cropping, setCropping] = useState(false)
  const display = useContext(DisplayContext)
  // l'immagine da ritagliare: quella del livello, o quella della carta mostrata se il livello la
  // prende da una colonna, o la prima del foglio di un set
  const cropSrc = ((): string | null => {
    if (res.ok) return assetUrl(res.path)
    const shown = display.template
      ? walkLayers([...display.template.front, ...display.template.back]).find((x) => x.id === l.id)
      : undefined
    const candidates = [shown?.type === 'image' ? shown.src : '']
    const column = l.source.kind === 'column' ? (l.source.column ?? l.name) : null
    if (column)
      for (const s of display.sheets) {
        const i = s.headers.indexOf(column)
        if (i >= 0) candidates.push(...s.rows.map((r) => r[i] ?? ''))
      }
    for (const c of candidates) {
      const r = c.trim() ? resolveAsset(c, assets) : null
      if (r?.ok) return assetUrl(r.path)
    }
    return null
  })()
  return (
    <>
      {/* con una formula il valore è il suo risultato: il campo non serve */}
      {!computed && (
        <Inherit keys={['src']}>
          <TextField
            label={t('prop.src')}
            hint={col()}
            value={l.src}
            list={listId}
            placeholder={t('editor.srcPlaceholder')}
            onChange={(src) => set({ src })}
            action={
              <button
                className="pick-btn"
                title={t('assetPicker.open')}
                onClick={() => setPicking(true)}
              >
                <ImageIcon />
              </button>
            }
          />
        </Inherit>
      )}
      {cropping && cropSrc && (
        <CropDialog
          url={cropSrc}
          value={l.crop}
          frame={{ w: l.w, h: l.h }}
          onApply={(crop) => {
            set({ crop })
            setCropping(false)
          }}
          onClose={() => setCropping(false)}
        />
      )}
      {picking && (
        <AssetPicker
          value={l.src}
          onPick={(src) => set({ src })}
          onClose={() => setPicking(false)}
        />
      )}
      <datalist id={listId}>
        {names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      {!computed && !res.ok && res.reason !== 'empty' && !l.src.includes('{') && (
        <p className="field-note">
          {res.reason === 'ambiguous'
            ? t('editor.srcAmbiguous', { files: res.candidates.join(', ') })
            : t('editor.srcMissing')}
        </p>
      )}
      <Section scope="image">
        <P id="fit">
          <SelectField
            label={t('prop.fit')}
            hint={col('fit')}
            value={l.fit}
            options={options(t, 'imageFit', [
              'cover',
              'overflow',
              'contain',
              'stretch',
              'original',
              'tile'
            ] as const)}
            onChange={(fit) => set({ fit })}
          />
        </P>
        <P id="crop">
          <Row label={t('prop.crop')} hint={`${t('editor.cropHint')} ${col('crop')}`}>
            <span className="crop-summary">
              {l.crop ? cropText(l.crop).replace(/ /g, ' · ') : t('crop.none')}
            </span>
            <button disabled={!cropSrc} onClick={() => setCropping(true)}>
              {t('crop.open')}
            </button>
            {l.crop && (
              <button
                className="icon-btn"
                title={t('crop.remove')}
                onClick={() => set({ crop: null })}
              >
                ×
              </button>
            )}
          </Row>
        </P>
        {l.fit !== 'stretch' && (
          <P id="align">
            <SelectField<Anchor>
              label={t('prop.imageAlign')}
              hint={col('align')}
              value={l.align}
              options={ANCHORS.map((a) => [a, t(`anchor.${a}` as MessageKey)])}
              onChange={(align) => set({ align })}
            />
          </P>
        )}
        <P id="zoom">
          <NumberField
            label={t('prop.zoom')}
            hint={`${t('editor.zoomImageHint')} ${col('zoom')}`}
            value={l.zoom}
            factor={100}
            step={5}
            min={0.01}
            unit="%"
            onChange={(zoom) => set({ zoom })}
          />
        </P>
        <P id="imageRotation">
          <NumberField
            label={t('prop.imageRotation')}
            hint={`${t('editor.imageRotationHint')} ${col('imageRotation')}`}
            value={l.imageRotation}
            step={90}
            min={-360}
            max={360}
            unit="°"
            onChange={(imageRotation) => set({ imageRotation })}
          />
        </P>
        <P id="offsetX">
          <NumberField
            label={t('prop.offsetX')}
            hint={col('offsetX')}
            value={l.offsetX}
            unit="mm"
            onChange={(offsetX) => set({ offsetX })}
          />
        </P>
        <P id="offsetY">
          <NumberField
            label={t('prop.offsetY')}
            hint={col('offsetY')}
            value={l.offsetY}
            unit="mm"
            onChange={(offsetY) => set({ offsetY })}
          />
        </P>
        <P id="flipH" adv>
          <CheckField
            label={t('prop.flipH')}
            hint={col('flipH')}
            value={l.flipH}
            onChange={(flipH) => set({ flipH })}
          />
        </P>
        <P id="flipV" adv>
          <CheckField
            label={t('prop.flipV')}
            hint={col('flipV')}
            value={l.flipV}
            onChange={(flipV) => set({ flipV })}
          />
        </P>
        <P id="tint">
          <ColorField
            label={t('prop.tint')}
            hint={col('tint')}
            value={l.tint}
            nullable
            onChange={(tint) => set({ tint })}
          />
        </P>
        <P id="grayscale" adv>
          <CheckField
            label={t('prop.grayscale')}
            hint={col('grayscale')}
            value={l.grayscale}
            onChange={(grayscale) => set({ grayscale })}
          />
        </P>
        <P id="brightness" adv>
          <NumberField
            label={t('prop.brightness')}
            hint={col('brightness')}
            value={l.brightness}
            factor={100}
            step={5}
            min={0}
            unit="%"
            onChange={(brightness) => set({ brightness })}
          />
        </P>
        <P id="contrast" adv>
          <NumberField
            label={t('prop.contrast')}
            hint={col('contrast')}
            value={l.contrast}
            factor={100}
            step={5}
            min={0}
            unit="%"
            onChange={(contrast) => set({ contrast })}
          />
        </P>
        {!l.grayscale && (
          <P id="saturation" adv>
            <NumberField
              label={t('prop.saturation')}
              hint={col('saturation')}
              value={l.saturation}
              factor={100}
              step={5}
              min={0}
              unit="%"
              onChange={(saturation) => set({ saturation })}
            />
          </P>
        )}
        <P id="radius" adv>
          <NumberField
            label={t('prop.radius')}
            hint={col('radius')}
            value={l.radius}
            min={0}
            unit="mm"
            onChange={(radius) => set({ radius })}
          />
        </P>
        <P id="stroke" adv>
          <StrokeField
            label={t('prop.stroke')}
            hint={col('stroke')}
            value={l.stroke}
            dashable
            onChange={(stroke) => set({ stroke })}
          />
        </P>
        <P id="missing" adv>
          <SelectField
            label={t('prop.missing')}
            hint={col('missing')}
            value={l.missing}
            options={options(t, 'missing', ['placeholder', 'hide'] as const)}
            onChange={(missing) => set({ missing })}
          />
        </P>
      </Section>
    </>
  )
}

function ValueProperties({
  l,
  set: setLayer,
  col,
  computed
}: TypeProps<ValueLayer>): React.JSX.Element {
  const { t } = useI18n()
  const set = setLayer as SetFn<ValueLayer>
  const translatable = useContext(ProjectLanguagesContext).length > 1
  return (
    <>
      {/* con una formula il valore è il suo risultato: il campo non serve */}
      {!computed && (
        <Inherit keys={['value']}>
          <TextField
            label={t('prop.value')}
            hint={col()}
            value={l.value}
            onChange={(value) => set({ value })}
          />
        </Inherit>
      )}
      {l.source.kind === 'fixed' && translatable && (
        <Inherit keys={['values']}>
          <TranslationFields
            label={t('prop.value')}
            value={l.values}
            onChange={(values) => set({ values })}
          />
        </Inherit>
      )}
      <p className="small muted">{t('editor.valueHint', { name: l.name })}</p>
    </>
  )
}

const SHAPES: ShapeKind[] = ['rect', 'ellipse', 'polygon', 'star', 'line', 'path']

function ShapeProperties({
  l,
  set: setLayer,
  col,
  computed
}: TypeProps<ShapeLayer>): React.JSX.Element {
  const { t } = useI18n()
  const set = setLayer as SetFn<ShapeLayer>
  return (
    <>
      <Section scope="shape">
        <P id="shape">
          <SelectField<ShapeKind>
            label={t('prop.shape')}
            hint={col('shape')}
            value={l.shape}
            options={options(t, 'shape', SHAPES)}
            onChange={(shape) => set({ shape })}
          />
        </P>
        {/* con una formula il valore è il suo risultato: il campo non serve */}
        {!computed && (
          <P id="fill">
            <FillField
              label={t('prop.fill')}
              hint={col()}
              value={l.fill}
              fallback="#CCCCCC"
              onChange={(fill) => set({ fill })}
            />
          </P>
        )}
        <P id="stroke">
          <StrokeField
            label={t('prop.stroke')}
            hint={col('stroke')}
            value={l.stroke}
            dashable
            onChange={(stroke) => set({ stroke })}
          />
        </P>
        {(l.shape === 'rect' || l.shape === 'polygon' || l.shape === 'star') && (
          <P id="radius">
            <NumberField
              label={t('prop.radius')}
              hint={col('radius')}
              value={l.radius}
              min={0}
              unit="mm"
              onChange={(radius) => set({ radius })}
            />
          </P>
        )}
        {(l.shape === 'polygon' || l.shape === 'star') && (
          <P id="sides">
            <NumberField
              label={l.shape === 'star' ? t('prop.points') : t('prop.sides')}
              hint={col('sides')}
              value={l.sides}
              step={1}
              min={3}
              max={64}
              onChange={(sides) => set({ sides: Math.round(sides) })}
            />
            {Math.abs(l.w - l.h) > 1e-6 && (
              <button
                type="button"
                title={t('editor.regularHint')}
                // poligono regolare: riquadro quadrato, con il lato più lungo, intorno allo stesso centro
                onClick={() => {
                  const s = Math.max(l.w, l.h)
                  set({ x: l.x + (l.w - s) / 2, y: l.y + (l.h - s) / 2, w: s, h: s })
                }}
              >
                {t('editor.regular')}
              </button>
            )}
          </P>
        )}
        {l.shape === 'star' && (
          <P id="innerRatio">
            <NumberField
              label={t('prop.innerRatio')}
              hint={col('innerRatio')}
              value={l.innerRatio}
              factor={100}
              step={5}
              min={0.05}
              max={1}
              unit="%"
              onChange={(innerRatio) => set({ innerRatio })}
            />
          </P>
        )}
        {l.shape === 'path' && (
          <Inherit keys={['path']}>
            <OutlineField
              hint={t('editor.outlineHint')}
              empty={!l.path.trim()}
              // l'altezza segue le proporzioni dell'immagine
              onTraced={({ path, ratio }) =>
                set({ path, h: Math.round((l.w / ratio) * 100) / 100 })
              }
            />
          </Inherit>
        )}
      </Section>
    </>
  )
}

const GRID_CELLS: GridCell[] = ['square', 'circle', 'hex', 'triangle', 'diamond']

/** Griglia: caselle, disposizione, misura nel riquadro, colori; vedi model/grid.ts */
function GridProperties({
  l,
  set: setLayer,
  col,
  computed,
  groups,
  onPlace
}: TypeProps<GridLayer> & {
  /** Gruppi dello stesso lato, da ripetere nelle caselle */
  groups: GroupLayer[]
  /** Porta il gruppo del contenuto nella prima casella */
  onPlace(group: GroupLayer): void
}): React.JSX.Element {
  const { t } = useI18n()
  const set = setLayer as SetFn<GridLayer>
  const count = (v: number): number => Math.max(1, Math.round(v))
  const content = groups.find((g) => g.name === l.content)
  // esagoni e triangoli hanno le proporzioni fisse
  const ratio = l.cell === 'square' || l.cell === 'circle' || l.cell === 'diamond'
  return (
    <>
      <Section scope="grid">
        <P id="cell">
          <SelectField<GridCell>
            label={t('prop.cell')}
            hint={col('cell')}
            value={l.cell}
            options={options(t, 'gridCell', GRID_CELLS)}
            onChange={(cell) => set({ cell })}
          />
        </P>
        <P id="rows">
          <NumberField
            label={t('prop.rows')}
            hint={col('rows')}
            value={l.rows}
            step={1}
            min={1}
            onChange={(rows) => set({ rows: count(rows) })}
          />
        </P>
        <P id="columns">
          <NumberField
            label={t('prop.columns')}
            hint={col('columns')}
            value={l.columns}
            step={1}
            min={1}
            onChange={(columns) => set({ columns: count(columns) })}
          />
        </P>
        <P id="interlock">
          <CheckField
            label={t('prop.interlock')}
            hint={`${t(`editor.interlockHint.${l.cell}` as MessageKey)} ${col('interlock')}`}
            value={l.interlock}
            onChange={(interlock) => set({ interlock })}
          />
        </P>
        {l.cell === 'hex' && (
          <P id="orientation">
            <SelectField<GridLayer['orientation']>
              label={t('prop.orientation')}
              hint={col('orientation')}
              value={l.orientation}
              options={options(t, 'gridOrientation', ['pointy', 'flat'] as const)}
              onChange={(orientation) => set({ orientation })}
            />
          </P>
        )}
        <P id="gap">
          <NumberField
            label={t('prop.gap')}
            hint={col('gap')}
            value={l.gap}
            min={0}
            step={0.5}
            unit="mm"
            onChange={(gap) => set({ gap })}
          />
        </P>
        {!computed && (
          <P id="fill">
            <FillField
              label={t('prop.cellFill')}
              hint={col()}
              value={l.fill}
              fallback="#FFFFFF"
              onChange={(fill) => set({ fill })}
            />
          </P>
        )}
        <P id="stroke">
          <StrokeField
            label={t('prop.cellStroke')}
            hint={col('stroke')}
            value={l.stroke}
            dashable
            onChange={(stroke) => set({ stroke })}
          />
        </P>
        {l.cell !== 'circle' && (
          <P id="radius">
            <NumberField
              label={t('prop.radius')}
              hint={col('radius')}
              value={l.radius}
              min={0}
              step={0.5}
              unit="mm"
              onChange={(radius) => set({ radius })}
            />
          </P>
        )}
        <P id="background">
          <FillField
            label={t('prop.gridBackground')}
            hint={`${t('editor.gridBackgroundHint')} ${col('background')}`}
            value={l.background}
            fallback="#EEEEEE"
            onChange={(background) => set({ background })}
          />
        </P>
        <P id="border">
          <StrokeField
            label={t('prop.gridBorder')}
            hint={col('border')}
            value={l.border}
            dashable
            onChange={(border) => set({ border })}
          />
        </P>
        <P id="padding" adv>
          <NumberField
            label={t('prop.padding')}
            hint={`${t('editor.gridPaddingHint')} ${col('padding')}`}
            value={l.padding}
            min={0}
            step={0.5}
            unit="mm"
            onChange={(padding) => set({ padding })}
          />
        </P>
        <P id="backgroundRadius" adv>
          <NumberField
            label={t('prop.backgroundRadius')}
            hint={col('backgroundRadius')}
            value={l.backgroundRadius}
            min={0}
            step={0.5}
            unit="mm"
            onChange={(backgroundRadius) => set({ backgroundRadius })}
          />
        </P>
        {ratio && (
          <P id="cellRatio" adv>
            <NumberField
              label={t('prop.cellRatio')}
              hint={`${t('editor.cellRatioHint')} ${col('cellRatio')}`}
              value={l.cellRatio}
              factor={100}
              step={5}
              min={0.05}
              unit="%"
              onChange={(cellRatio) => set({ cellRatio })}
            />
          </P>
        )}
        <P id="zoom" adv>
          <NumberField
            label={t('prop.zoom')}
            hint={`${t('editor.gridZoomHint')} ${col('zoom')}`}
            value={l.zoom}
            factor={100}
            step={5}
            min={0.01}
            unit="%"
            onChange={(zoom) => set({ zoom })}
          />
        </P>
        <P id="gridAlign" adv>
          <SelectField<LayoutAlign>
            label={t('prop.alignX')}
            hint={col('alignX')}
            value={l.alignX}
            options={options(t, 'justifyH', ALIGNS)}
            onChange={(alignX) => set({ alignX })}
          />
          <SelectField<LayoutAlign>
            label={t('prop.alignY')}
            hint={col('alignY')}
            value={l.alignY}
            options={options(t, 'justifyV', ALIGNS)}
            onChange={(alignY) => set({ alignY })}
          />
        </P>
        <P id="clip" adv>
          <CheckField
            label={t('prop.gridClip')}
            hint={col('clip')}
            value={l.clip}
            onChange={(clip) => set({ clip })}
          />
        </P>
      </Section>
      <h3>{t('editor.gridContent')}</h3>
      <Inherit keys={['content']}>
        <SelectField<string>
          label={t('prop.content')}
          hint={`${t('editor.gridContentHint')} ${col('content')}`}
          value={l.content}
          options={[
            ['', t('editor.gridContentNone')],
            ...groups.map((g): [string, string] => [g.name, g.name]),
            // un nome scritto a mano o dal foglio che non è un gruppo resta visibile
            ...(l.content && !groups.some((g) => g.name === l.content)
              ? [[l.content, l.content] as [string, string]]
              : [])
          ]}
          onChange={(content) => set({ content })}
        />
      </Inherit>
      {content ? (
        <button type="button" onClick={() => onPlace(content)}>
          {t('editor.gridContentPlace')}
        </button>
      ) : (
        !groups.length && <p className="muted small">{t('editor.gridContentNoGroups')}</p>
      )}
      <p className="muted small">{t('editor.gridContentFields')}</p>
    </>
  )
}

/** Valore principale sulle carte: colonna del foglio, valore fisso o formula */
function ValueSource({
  layer: l,
  template,
  sheets,
  set
}: {
  layer: Layer
  template: Template
  sheets: Props['sheets']
  set(patch: Partial<Layer>): void
}): React.JSX.Element {
  const { t } = useI18n()
  const src = l.source
  const column = src.kind === 'column' && src.column ? src.column : l.name
  const found = sheets.filter((s) => s.headers.includes(column)).map((s) => s.set)
  const others = [
    ...new Set(sheets.flatMap((s) => s.headers.filter((h) => h.startsWith(column + '.'))))
  ]
  const headers = [...new Set(sheets.flatMap((s) => s.headers))].filter(
    (h) => h !== 'amount' && !h.includes('.')
  )
  // anteprima della formula sulla prima riga disponibile, o con i soli valori del template
  const sample = sheets.find((s) => s.rows.length)
  const variables = useContext(VariablesContext)
  const cells = contentGrid(template, l.id)
  const fields = {
    ...cardFields(
      template,
      sample ? rowToCard(sample.headers, sample.rows[0]) : { fields: {}, amount: 1 },
      variables
    ),
    // nel contenuto di una griglia l'anteprima è quella della prima casella
    ...(cells && cellFields(cells.grid, 0, cells.columns, cells.rows * cells.columns))
  }
  const result = src.kind === 'formula' ? evaluateFormula(src.expr, fields) : null
  // come sulla carta: i {campo} rimasti nel risultato si sostituiscono
  const preview = result && { ...result, value: substituteFields(result.value, fields) }
  const [assistant, setAssistant] = useState(false)
  const fx = (
    <button
      type="button"
      className="pick-btn fx-button"
      title={t('fx.open')}
      onClick={() => setAssistant(true)}
    >
      fx
    </button>
  )
  const listId = `columns-${l.id}`

  return (
    <div className="value-source">
      <SelectField<ValueSourceKind>
        label={t('source.label')}
        value={src.kind}
        options={[
          ['column', t('source.kind.column')],
          ['fixed', t('source.kind.fixed')],
          ['formula', t('source.kind.formula')]
        ]}
        onChange={(kind) => set({ source: switchSource(l, kind) })}
      />
      {src.kind === 'column' && (
        <>
          <TextField
            label={t('source.column')}
            value={src.column ?? ''}
            placeholder={l.name}
            list={listId}
            hint={t('source.columnHint')}
            onChange={(c) => set({ source: { kind: 'column', column: c.trim() || null } })}
          />
          <datalist id={listId}>
            {headers.map((h) => (
              <option key={h} value={h} />
            ))}
          </datalist>
        </>
      )}
      {src.kind === 'formula' && (
        <TextField
          label={t('source.formula')}
          value={src.expr}
          hint={t('source.formulaHint')}
          multiline
          rows={3}
          onChange={(expr) => set({ source: { kind: 'formula', expr } })}
          action={fx}
        />
      )}
      {src.kind !== 'formula' && (
        <button type="button" className="fx-start" onClick={() => setAssistant(true)}>
          <span className="fx-button">fx</span> {t('fx.start')}
        </button>
      )}
      {assistant && (
        <FormulaDialog
          value={src.kind === 'formula' ? src.expr : ''}
          expect={FORMULA_EXPECT[l.type]}
          columns={headers}
          layers={walkLayers([...template.front, ...template.back])
            .filter((x) => x.id !== l.id && x.type !== 'group')
            .map((x) => x.name)}
          sample={fields}
          sampleLabel={sample ? t('fx.firstCardOf', { set: sample.set }) : undefined}
          cells={cells}
          onApply={(expr) => set({ source: { kind: 'formula', expr } })}
          onClose={() => setAssistant(false)}
        />
      )}
      {src.kind === 'formula' && <p className="small muted">{t('source.formulaHelp')}</p>}
      <p className="small muted">
        {src.kind === 'fixed'
          ? t('source.fixedNote')
          : src.kind === 'formula'
            ? preview?.error
              ? t('source.formulaError', { error: preview.error })
              : sample
                ? t('source.formulaPreview', { value: preview?.value || '∅', set: sample.set })
                : t('source.formulaPreviewDefaults', { value: preview?.value || '∅' })
            : l.type === 'value' && !found.length && !src.column
              ? t('source.valueColumn', { column })
              : found.length
                ? t('source.columnFound', { column, sets: found.join(', ') })
                : t('source.columnMissing', { column })}
        {others.length > 0 && (
          <>
            <br />
            {t('source.properties', { columns: others.join(', ') })}
          </>
        )}
      </p>
    </div>
  )
}

type ValueSourceKind = Layer['source']['kind']

/** Cosa dà la formula di un livello: il valore principale del suo tipo */
const FORMULA_EXPECT: Record<Layer['type'], FormulaExpect> = {
  text: 'text',
  image: 'image',
  shape: 'color',
  grid: 'color',
  group: 'bool',
  value: 'value'
}
