import { useContext, useMemo, useState } from 'react'
import UsagesSection, { type UsagesNav } from './UsagesSection'
import GroupField from './GroupField'
import { substituteFields } from '../../../shared/model/bind'
import {
  VARIABLE_TYPES,
  emptyVariable,
  isValidVariableName,
  palette,
  resolveColor,
  variableFields,
  type Flip,
  type Variable,
  type VariableType,
  type Variables
} from '../../../shared/model/variables'
import { BUILTIN_SHAPES } from '../../../shared/model/markup'
import { BACKDROP_PAD } from '../../../shared/model/shapes'
import { Dialog } from '../editor/dialogs'
import { ColorField, NumberField, TextField } from '../editor/fields'
import { useI18n } from '../i18n/context'
import MarkupText from '../render/MarkupText'
import { AssetsContext, VariablesContext } from '../render/assets'
import TranslationFields from './TranslationFields'
import AssetPicker from './AssetPicker'
import IconBrowser from './IconBrowser'
import Segmented from './Segmented'
import { ImageIcon } from './icons'

// Editor di una variabile del progetto (docs/specifica.md, 6.1), con l'anteprima in una frase.

const IMAGE_LIST = 'variable-images'
const BG_LIST = 'variable-backgrounds'

export default function VariableDialog({
  name: initialName,
  group: initialGroup = '',
  groups = [],
  usages,
  fieldNames,
  onSave,
  onDelete,
  onClose
}: {
  /** '' per una variabile nuova */
  name: string
  /** Gruppo nella barra laterale e gruppi già usati */
  group?: string
  groups?: string[]
  /** Dove è usata la variabile, per una variabile che esiste già */
  usages?: UsagesNav
  /** Nomi dei livelli e delle colonne del progetto: una variabile con lo stesso nome resta nascosta */
  fieldNames?: Set<string>
  onSave(name: string, v: Variable, group: string): void
  onDelete(): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  const variables = useContext(VariablesContext)
  const assets = useContext(AssetsContext)
  const [name, setName] = useState(initialName)
  const [group, setGroup] = useState(initialGroup)
  const [v, setV] = useState<Variable>(variables[initialName] ?? emptyVariable('image'))
  // si tiene il contenuto di ogni tipo, così cambiare tipo per prova non lo perde
  const [byType, setByType] = useState<Partial<Record<VariableType, Variable>>>({})
  const [picking, setPicking] = useState(false)
  const [pickingBg, setPickingBg] = useState(false)
  const [importing, setImporting] = useState(false)
  const pickImage = (src: string): void => {
    setV((cur) => (cur.type === 'image' ? { ...cur, src } : cur))
    // una variabile nuova senza nome prende quello dell'immagine
    setName((n) => n || (isValidVariableName(src) && !(src in variables) ? src : n))
  }
  const changeType = (type: VariableType): void => {
    setByType((b) => ({ ...b, [v.type]: v }))
    setV(byType[type] ?? emptyVariable(type))
  }

  const nameError = !name
    ? null
    : !isValidVariableName(name)
      ? t('variable.invalidName')
      : name !== initialName && name in variables
        ? t('variable.exists')
        : null
  const nameWarning =
    !nameError && name && fieldNames?.has(name) ? t('variable.fieldName', { name }) : null

  // l'anteprima usa la versione in modifica al posto di quella salvata
  const draft = useMemo<Variables>(() => {
    const out = { ...variables }
    delete out[initialName]
    out[name || '_'] = v
    return out
  }, [variables, initialName, name, v])
  const ref = `{${name || '_'}}`
  const sample =
    v.type === 'color'
      ? `[${t('variable.sampleText')}]{color=${name || '_'}} [ 7 ]{bg=circle bg-color=${name || '_'} color=white}`
      : substituteFields(`${t('variable.sampleBefore')} ${ref} ${t('variable.sampleAfter')}`, {
          ...variableFields(draft)
        })

  const images = [
    ...new Set(
      assets.map((p) => {
        const base = p.slice(p.lastIndexOf('/') + 1)
        return base.slice(0, base.lastIndexOf('.'))
      })
    )
  ].sort()

  return (
    <Dialog title={t('variable.title')} onClose={onClose}>
      <div className="format-dialog">
        <div className="format-preview">
          <VariablesContext.Provider value={draft}>
            <MarkupText text={sample} unit={4} ratio={1} paragraphSpacing={0} />
          </VariablesContext.Provider>
        </div>
        <div className="format-fields">
          <TextField
            label={t('variable.name')}
            hint={t('variable.nameHint')}
            value={name}
            validate={(x) => (!x || isValidVariableName(x) ? null : t('variable.invalidName'))}
            onChange={setName}
          />
          <GroupField value={group} groups={groups} onChange={setGroup} />
          {usages && <UsagesSection {...usages} />}
          <div className="field">
            <span className="field-label">{t('variable.type')}</span>
            <span className="field-control">
              <Segmented<VariableType>
                value={v.type}
                options={VARIABLE_TYPES.map((x) => [x, t(`variable.type.${x}`)])}
                onChange={changeType}
              />
            </span>
          </div>
          {v.type === 'image' && (
            <>
              <TextField
                label={t('variable.src')}
                hint={t('variable.srcHint')}
                value={v.src}
                list={IMAGE_LIST}
                onChange={(src) => setV({ ...v, src })}
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
              <div className="field">
                <span className="field-label" />
                <span className="field-control">
                  <button onClick={() => setImporting(true)}>{t('assetPicker.importIcons')}</button>
                </span>
              </div>
              <datalist id={IMAGE_LIST}>
                {images.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
              {v.tint !== TEXT_COLOR && (
                <ColorField
                  label={t('variable.tint')}
                  hint={t('variable.tintHint')}
                  value={v.tint ?? null}
                  nullable
                  onChange={(tint) => setV({ ...v, tint })}
                />
              )}
              <label className="check variable-text-color" title={t('variable.textColorHint')}>
                <input
                  type="checkbox"
                  checked={v.tint === TEXT_COLOR}
                  onChange={(e) => setV({ ...v, tint: e.target.checked ? TEXT_COLOR : undefined })}
                />
                {t('variable.textColor')}
              </label>
              <NumberField
                label={t('variable.scale')}
                hint={t('variable.scaleHint')}
                value={v.scale ?? 1}
                factor={100}
                step={5}
                min={0.1}
                unit="%"
                onChange={(scale) => setV({ ...v, scale })}
              />
              <NumberField
                label={t('variable.raise')}
                hint={t('variable.raiseHint')}
                value={v.raise ?? 0}
                step={5}
                unit="%"
                onChange={(raise) => setV({ ...v, raise })}
              />
              <NumberField
                label={t('variable.rotate')}
                hint={t('variable.rotateHint')}
                value={v.rotate ?? 0}
                step={15}
                unit="°"
                onChange={(rotate) => setV({ ...v, rotate })}
              />
              <div className="field">
                <span className="field-label">{t('variable.flip')}</span>
                <span className="field-control">
                  <Segmented<Flip | 'none'>
                    value={v.flip ?? 'none'}
                    options={(['none', 'h', 'v', 'hv'] as const).map((x) => [
                      x,
                      t(`variable.flip.${x}`)
                    ])}
                    onChange={(f) => setV({ ...v, flip: f === 'none' ? undefined : f })}
                  />
                </span>
              </div>
              <NumberField
                label={t('variable.opacity')}
                value={v.opacity ?? 1}
                factor={100}
                step={5}
                min={0}
                max={1}
                unit="%"
                onChange={(opacity) => setV({ ...v, opacity })}
              />
              <TextField
                label={t('variable.bg')}
                hint={t('variable.bgHint')}
                value={v.bg ?? ''}
                list={BG_LIST}
                onChange={(bg) => setV({ ...v, bg: bg || undefined })}
                action={
                  <button
                    className="pick-btn"
                    title={t('assetPicker.open')}
                    onClick={() => setPickingBg(true)}
                  >
                    <ImageIcon />
                  </button>
                }
              />
              <datalist id={BG_LIST}>
                {[
                  ...BUILTIN_SHAPES,
                  ...Object.keys(variables)
                    .filter((n) => n !== name && variables[n].type === 'image')
                    .sort(),
                  ...images
                ].map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
              {v.bg?.trim() && (
                <>
                  <ColorField
                    label={t('variable.bgColor')}
                    hint={t('variable.bgColorHint')}
                    value={v.bgColor ?? null}
                    nullable
                    onChange={(bgColor) => setV({ ...v, bgColor: bgColor ?? undefined })}
                  />
                  <NumberField
                    label={t('variable.bgPad')}
                    hint={t('variable.bgPadHint')}
                    value={v.bgPad ?? BACKDROP_PAD}
                    factor={100}
                    step={2}
                    min={0}
                    max={0.45}
                    unit="%"
                    onChange={(bgPad) => setV({ ...v, bgPad })}
                  />
                </>
              )}
              <p className="muted small">{t('variable.attrsHint')}</p>
            </>
          )}
          {v.type === 'text' && (
            <TextField
              label={t('variable.text')}
              hint={t('variable.textHint')}
              value={v.text}
              multiline
              markupFields={[]}
              onChange={(text) => setV({ ...v, text })}
            />
          )}
          {v.type === 'text' && (
            <TranslationFields
              label={t('variable.text')}
              value={v.texts}
              multiline
              markupFields={[]}
              onChange={(texts) => setV({ ...v, texts })}
            />
          )}
          {v.type === 'color' && (
            <ColorField
              label={t('variable.color')}
              value={v.color}
              onChange={(color) => setV({ ...v, color: color ?? '#000000' })}
            />
          )}
          {v.type === 'value' && (
            <TextField
              label={t('variable.value')}
              hint={t('variable.valueHint')}
              value={v.value}
              onChange={(value) => setV({ ...v, value })}
            />
          )}
          {v.type === 'value' && (
            <TranslationFields
              label={t('variable.value')}
              value={v.values}
              onChange={(values) => setV({ ...v, values })}
            />
          )}
        </div>
        <div className="dialog-buttons">
          {initialName && (
            <button className="spacer-right danger" onClick={onDelete}>
              {t('variable.delete')}
            </button>
          )}
          <button onClick={onClose}>{t('format.cancel')}</button>
          <button
            className="primary"
            disabled={!name || !!nameError}
            onClick={() => onSave(name, clean(v), group)}
          >
            {t('variable.save')}
          </button>
        </div>
        {nameError && <span className="field-error">{nameError}</span>}
        {nameWarning && <span className="field-error">{nameWarning}</span>}
      </div>
      {picking && (
        <AssetPicker
          value={v.type === 'image' ? v.src : ''}
          onPick={pickImage}
          onClose={() => setPicking(false)}
        />
      )}
      {pickingBg && v.type === 'image' && (
        <AssetPicker
          extras
          value={v.bg ?? ''}
          onPick={(bg) => setV({ ...v, bg })}
          onClose={() => setPickingBg(false)}
        />
      )}
      {importing && (
        <IconBrowser
          onImported={(names) => names.length === 1 && pickImage(names[0])}
          onClose={() => setImporting(false)}
        />
      )}
    </Dialog>
  )
}

/** Nel file si scrivono solo i valori diversi dai default */
function clean(v: Variable): Variable {
  if (v.type !== 'image') return v
  const out: Variable = { type: 'image', src: v.src.trim() }
  if (v.tint) out.tint = v.tint
  if (v.scale !== undefined && v.scale !== 1) out.scale = v.scale
  if (v.raise) out.raise = v.raise
  if (v.rotate) out.rotate = v.rotate
  if (v.flip) out.flip = v.flip
  if (v.opacity !== undefined && v.opacity !== 1) out.opacity = v.opacity
  if (v.bg?.trim()) {
    out.bg = v.bg.trim()
    if (v.bgColor) out.bgColor = v.bgColor
    if (v.bgPad !== undefined && v.bgPad !== BACKDROP_PAD) out.bgPad = v.bgPad
  }
  return out
}

/** Anteprima di una riga nell'elenco della barra laterale */
export function VariableSwatch({
  v,
  variables
}: {
  v: Variable
  variables: Variables
}): React.JSX.Element {
  if (v.type === 'color')
    return (
      <span
        className="variable-swatch"
        style={{ background: resolveColor(v.color, palette(variables)) }}
      />
    )
  if (v.type === 'image')
    return (
      <span className="variable-icon">
        <VariablesContext.Provider value={{ ...variables, _: v }}>
          <MarkupText text="{_}" unit={3} ratio={1} paragraphSpacing={0} />
        </VariablesContext.Provider>
      </span>
    )
  return <span className="muted small variable-text">{v.type === 'text' ? v.text : v.value}</span>
}

/** Tinta che prende il colore del testo in cui l'icona è inserita */
const TEXT_COLOR = 'currentColor'
