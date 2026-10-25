import { kindWords } from '../i18n/kinds'
import { dragHasFiles, importDropped } from './dropImages'
import { Fragment, useContext, useEffect, useRef, useState } from 'react'
import type { Sheet } from '../../../shared/project'
import {
  boolText,
  colorColumns,
  parseBool,
  propertyColumns,
  writeCells,
  type ColumnInfo
} from '../../../shared/model/sheet'
import { walkLayers } from '../../../shared/model/normalize'
import { splitLanguage } from '../../../shared/model/language'
import {
  PRIMARY_PROPERTY,
  type Crop,
  type ImageLayer,
  type Layer,
  type Template
} from '../../../shared/model/template'
import { TEMPLATE_COLUMN } from '../../../shared/model/inherit'
import { useI18n } from '../i18n/context'
import MarkupTextarea from './MarkupTextarea'
import AssetPicker from './AssetPicker'
import { ColorSwatch } from './ColorPicker'
import { EyeIcon, EyeOffIcon, ImageIcon, SlidersIcon } from './icons'
import { colorPartOf, propControl, propLabel } from './cardProps'
import CropDialog from './CropDialog'
import { cropText, parseCrop } from '../../../shared/model/crop'
import { resolveAsset } from '../../../shared/model/assets'
import { AssetsContext, assetUrl } from '../render/assets'

interface Props {
  sheet: Sheet
  row: number
  /** Carte selezionate quando sono più di una: ogni campo scrive in tutte */
  rows?: number[]
  template: Template | null
  /** Template che una carta può usare al posto di quello del set (colonna template) */
  templateChoices?: string[]
  /** Template del set: vale per le carte con la colonna template vuota */
  setTemplate?: string
  /** Colonne da mostrare, già senza quelle nascoste (vedi setColumns) */
  columns: ColumnInfo[]
  /** Colonne vero/falso, con il valore del template per le celle vuote */
  booleans: Map<string, boolean | null>
  /** Valori dei livelli fissi e con formula di una riga */
  computed(row: number): Record<string, string>
  /** Colonna da mettere a fuoco, per esempio dopo un clic su un livello della carta */
  focus: { column: string; seq: number } | null
  /** Campi con i dettagli del livello aperti */
  details: Set<string>
  onToggleDetails(column: string): void
  onChange(sheet: Sheet, key?: string): void
}

/**
 * Campi della carta selezionata: è la sua riga del foglio, modificabile accanto all'anteprima.
 * Le colonne dei livelli di testo hanno un campo su più righe.
 */
function CardForm({
  sheet,
  row,
  rows,
  template,
  templateChoices = [],
  setTemplate,
  columns,
  booleans,
  computed,
  focus,
  details,
  onToggleDetails,
  onChange
}: Props): React.JSX.Element {
  const { t } = useI18n()
  const words = kindWords(t, template)
  const boxRef = useRef<HTMLDivElement>(null)
  const columnsOf = (type: 'text' | 'image'): Set<string> => {
    const out = new Set(
      template
        ? walkLayers([...template.front, ...template.back])
            .filter((l) => l.type === type && l.source.kind === 'column')
            .map((l) => (l.source.kind === 'column' && l.source.column) || l.name)
        : []
    )
    // le traduzioni (nome@en) si scrivono come la loro colonna
    for (const h of sheet.headers) if (out.has(splitLanguage(h).base)) out.add(h)
    return out
  }
  const textColumns = columnsOf('text')
  const imageColumns = columnsOf('image')
  /** Colonna di cui si sta scegliendo l'immagine */
  const [picking, setPicking] = useState<string | null>(null)
  /** Colonna del ritaglio (livello.crop) che si sta modificando nella finestra */
  const [cropping, setCropping] = useState<string | null>(null)
  const assets = useContext(AssetsContext)

  const colors = template ? colorColumns(template) : new Map<string, string | null>()

  useEffect(() => {
    if (!focus) return
    const el = boxRef.current?.querySelector<HTMLInputElement>(
      `[data-column="${CSS.escape(focus.column)}"]`
    )
    el?.focus()
    el?.select()
  }, [focus])

  const fields = [
    ...new Set([
      ...sheet.headers.filter((h) => h !== 'amount' && !h.includes('.')),
      ...(template
        ? walkLayers([...template.front, ...template.back])
            .filter((l) => l.type !== 'group')
            .map((l) => l.name)
        : [])
    ])
  ]
  const targets = rows && rows.length > 1 ? rows : [row]
  const multi = targets.length > 1
  // con più carte un campo mostra il valore solo se è uguale in tutte; vuoto vuol dire "diversi"
  const same = (vs: string[]): string | null => (new Set(vs).size === 1 ? vs[0] : null)
  const valueOf = (h: string, calc = false): string | null => {
    const index = sheet.headers.indexOf(h)
    return same(
      targets.map((r) =>
        calc ? (computed(r)[h] ?? '') : index < 0 ? '' : (sheet.rows[r]?.[index] ?? '')
      )
    )
  }
  // ordine delle proprietà di un livello fissato alla prima modifica, finché si resta sulla
  // stessa carta: altrimenti la proprietà appena cambiata salterebbe in cima all'elenco
  const cardKey = targets.join(',')
  const [frozen, setFrozen] = useState<{ card: string; order: Record<string, string[]> } | null>(
    null
  )
  const write = (h: string, v: string): void => {
    const column = h.includes('.') ? h.slice(0, h.indexOf('.')) : null
    if (column && details.has(column)) {
      const order = frozen?.card === cardKey ? frozen.order : {}
      if (!order[column])
        setFrozen({ card: cardKey, order: { ...order, [column]: propertiesOf(column) } })
    }
    onChange(writeCells(sheet, targets, h, v), `cell:${cardKey}:${h}`)
  }

  // livello di ogni campo: le sue proprietà si aprono con l'icona accanto al campo
  const layerOf = new Map<string, Layer>()
  for (const l of template ? walkLayers([...template.front, ...template.back]) : []) {
    if (l.type === 'group') continue
    const column = l.source.kind === 'column' && l.source.column ? l.source.column : l.name
    if (!layerOf.has(column)) layerOf.set(column, l)
  }
  /** Immagine della carta mostrata per un livello immagine: quella della sua colonna o del template */
  const cropImage = (l: ImageLayer): string | null => {
    const column = l.source.kind === 'column' ? (l.source.column ?? l.name) : null
    const index = column ? sheet.headers.indexOf(column) : -1
    const src = (index >= 0 && sheet.rows[row]?.[index]?.trim()) || l.src
    const r = resolveAsset(src, assets)
    return r.ok ? assetUrl(r.path) : null
  }
  const shown = new Set(columns.map((c) => c.header))
  const baseOf = (h: string): string => h.slice(0, h.indexOf('.'))
  // le colonne delle proprietà stanno nei dettagli del loro campo, se il campo è mostrato
  const inDetails = (h: string): boolean =>
    h.includes('.') && shown.has(baseOf(h)) && layerOf.has(baseOf(h))

  /** Proprietà del livello modificabili carta per carta, prima quelle già usate */
  const propertiesOf = (column: string): string[] => {
    const l = layerOf.get(column)
    if (!l || !template) return []
    // il valore principale è già il campo stesso
    const keys = propertyColumns(template, l.name)
      .map((c) => c.slice(c.indexOf('.') + 1))
      .filter((k) => k !== PRIMARY_PROPERTY[l.type] && k !== 'visible')
    const own = keys.filter((k) => !COMMON_KEYS.includes(k))
    const common = COMMON_KEYS.filter((k) => keys.includes(k))
    const all = [...own, ...common].map((k) => `${column}.${k}`)
    const kept = frozen?.card === cardKey ? frozen.order[column] : undefined
    if (kept)
      return [...kept.filter((h) => all.includes(h)), ...all.filter((h) => !kept.includes(h))]
    const used = all.filter((h) => valueOf(h)?.trim())
    return [...used, ...all.filter((h) => !used.includes(h))]
  }
  const usedProperties = (column: string): number =>
    sheet.headers.filter((h) => h.startsWith(column + '.') && valueOf(h)?.trim()).length

  const field = (
    h: string,
    opts: { index: number; calc: boolean; prop?: boolean }
  ): React.JSX.Element => {
    const { index, calc } = opts
    const value = valueOf(h, calc)
    const dot = h.indexOf('.')
    const layer = dot > 0 ? layerOf.get(h.slice(0, dot)) : undefined
    // valore del template per le proprietà: suggerimento nel campo vuoto
    const fallback =
      layer && dot > 0 ? (layer as unknown as Record<string, unknown>)[h.slice(dot + 1)] : undefined
    const hint =
      fallback === undefined || fallback === null
        ? ''
        : typeof fallback === 'object'
          ? h.endsWith('.crop')
            ? cropText(fallback as Crop)
            : ''
          : String(fallback)
    const common = {
      'data-column': h,
      value: value ?? '',
      placeholder: value === null ? t('cardForm.mixed') : hint,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        write(h, e.target.value)
    }
    const className = ['field', h.includes('.') && 'prop-field', calc && 'calc-field']
      .filter(Boolean)
      .join(' ')
    const propKey = h.slice(dot + 1)
    const labelKey = opts.prop && layer ? propLabel(layer, propKey) : null
    const label =
      h === 'amount' ? t('cardForm.amount') : opts.prop ? (labelKey ? t(labelKey) : propKey) : h
    const labelTitle = h === 'amount' ? t('cardForm.amountHint') : undefined
    // visibilità del livello su questa carta: la colonna livello.visible
    const visibleColumn = `${h}.visible`
    const ownVisible = layerOf.has(h) ? parseBool(valueOf(visibleColumn) ?? '') : null
    const isVisible = ownVisible ?? layerOf.get(h)?.visible ?? true
    const tools = !opts.prop && (
      <span className="field-tools">
        {layerOf.has(h) && !calc && (
          <button
            className={'icon-btn' + (details.has(h) ? ' on' : '')}
            aria-expanded={details.has(h)}
            title={t('cardForm.details')}
            onClick={(e) => {
              // i pulsanti sono dentro l'etichetta: senza questo il clic va al campo
              e.preventDefault()
              onToggleDetails(h)
            }}
          >
            <SlidersIcon />
            {usedProperties(h) > 0 && <span className="field-count">{usedProperties(h)}</span>}
          </button>
        )}
        {layerOf.has(h) && !calc && (
          <button
            className={'icon-btn' + (isVisible ? '' : ' off')}
            aria-pressed={!isVisible}
            title={t('cardForm.toggleVisible')}
            onClick={(e) => {
              e.preventDefault()
              // tornando come nel template la cella si svuota
              write(
                visibleColumn,
                !isVisible === (layerOf.get(h)?.visible ?? true)
                  ? ''
                  : boolText(sheet, visibleColumn, !isVisible)
              )
            }}
          >
            {isVisible ? <EyeIcon /> : <EyeOffIcon />}
          </button>
        )}
      </span>
    )
    if (h === TEMPLATE_COLUMN && templateChoices.length) {
      // il template della carta si sceglie tra quelli con le misure del set
      const own = value?.trim() ?? ''
      return (
        <label key={h} className={className} title={t('cardForm.templateHint')}>
          <span className="field-label">{t('cardForm.template')}</span>
          <span className="field-control">
            <select
              data-column={h}
              className={own ? undefined : 'from-template'}
              value={own}
              onChange={(e) => write(h, e.target.value)}
            >
              <option value="">{t('cardForm.setTemplate', { name: setTemplate ?? '' })}</option>
              {templateChoices
                .filter((n) => n !== setTemplate)
                .map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              {own && !templateChoices.includes(own) && <option value={own}>{own}</option>}
            </select>
          </span>
        </label>
      )
    }
    if (calc)
      return (
        <label key={h} className={className} title={t('table.computedHint')}>
          <span className="field-label">ƒ {label}</span>
          <span className="field-control">
            <input {...common} placeholder="" readOnly onChange={undefined} />
          </span>
          {tools}
        </label>
      )
    const control = opts.prop && layer ? propControl(layer, propKey) : null
    if (control?.kind === 'select' || control?.kind === 'number' || control?.kind === 'text') {
      const colorPart = control.kind === 'text' ? colorPartOf(propKey, value ?? '', fallback) : null
      const optionLabel = (v: string): string => {
        const found = control.kind === 'select' && control.options.find(([o]) => o === v)
        return found && found[1] ? t(found[1]) : v
      }
      return (
        <label key={h} className={className}>
          <span className="field-label" title={labelTitle}>
            {label}
          </span>
          <span className="field-control">
            {control.kind === 'select' ? (
              <select
                data-column={h}
                className={value?.trim() ? undefined : 'from-template'}
                value={value ?? ''}
                onChange={(e) => write(h, e.target.value)}
              >
                {/* vuoto: vale il template */}
                <option value="">
                  {t('cardProps.fromTemplate', { value: optionLabel(hint) })}
                </option>
                {control.options.map(([v, key]) => (
                  <option key={v} value={v}>
                    {key ? t(key) : v}
                  </option>
                ))}
              </select>
            ) : (
              <input
                {...common}
                type={control.kind === 'number' ? 'number' : undefined}
                className={control.kind === 'number' ? 'num' : undefined}
                step={control.kind === 'number' ? control.step : undefined}
                title={control.kind === 'text' && control.hint ? t(control.hint) : undefined}
                placeholder={
                  value === null
                    ? t('cardForm.mixed')
                    : hint || (control.kind === 'text' && control.hint ? t(control.hint) : '')
                }
              />
            )}
            {colorPart && (
              <ColorSwatch
                title={t('cardForm.pickColor')}
                value={colorPart.color}
                onChange={(c) => write(h, colorPart.set(c))}
              />
            )}
            {layer?.type === 'image' && propKey === 'crop' && (
              <button
                className="pick-btn"
                disabled={!cropImage(layer)}
                onClick={(e) => {
                  e.preventDefault()
                  setCropping(h)
                }}
              >
                {t('crop.open')}
              </button>
            )}
          </span>
        </label>
      )
    }
    const boolDefault = booleans.has(h)
      ? booleans.get(h)
      : typeof fallback === 'boolean'
        ? fallback
        : undefined
    if (boolDefault !== undefined) {
      const own = value === null ? null : parseBool(value)
      return (
        <label key={h} className={className}>
          <span className="field-label" title={labelTitle}>
            {label}
          </span>
          <span className="field-control">
            <input
              type="checkbox"
              data-column={h}
              className={value?.trim() ? undefined : 'bool-default'}
              title={value?.trim() ? value : t('table.boolDefault')}
              checked={own ?? (value === null ? false : (boolDefault ?? false))}
              ref={(el) => {
                if (el) el.indeterminate = value === null
              }}
              onChange={(e) => write(h, boolText(sheet, h, e.target.checked))}
            />
          </span>
          {tools}
        </label>
      )
    }
    // contorno, bordo e ombra scritti come testo anche fuori dai dettagli: il colore è la prima parte
    const strokePart =
      dot > 0 && !colors.has(h) ? colorPartOf(propKey, common.value, fallback) : null
    return (
      <label key={h} className={index < 0 && !opts.prop ? className + ' new-field' : className}>
        <span className="field-label" title={labelTitle}>
          {label}
        </span>
        <span className="field-control">
          {textColumns.has(h) ? (
            <MarkupTextarea
              {...common}
              fields={fields}
              rows={Math.min(8, Math.max(2, common.value.split('\n').length))}
            />
          ) : colors.has(h) ? (
            <span className="color-cell">
              <input
                {...common}
                placeholder={value === null ? common.placeholder : (colors.get(h) ?? '')}
              />
              <ColorSwatch
                title={t('cardForm.pickColor')}
                // senza valore nella cella il selettore parte dal colore del template
                value={common.value.trim() || colors.get(h) || ''}
                onChange={(v) => write(h, v)}
              />
            </span>
          ) : strokePart ? (
            <span className="color-cell">
              <input {...common} />
              <ColorSwatch
                title={t('cardForm.pickColor')}
                value={strokePart.color}
                onChange={(c) => write(h, strokePart.set(c))}
              />
            </span>
          ) : imageColumns.has(h) ? (
            <>
              <input
                {...common}
                onDragOver={(e) => {
                  if (dragHasFiles(e)) e.preventDefault()
                }}
                onDrop={async (e) => {
                  if (!dragHasFiles(e)) return
                  e.preventDefault()
                  const [name] = await importDropped(e)
                  if (name) write(h, name)
                }}
              />
              <button
                className="pick-btn"
                title={t('assetPicker.open')}
                onClick={(e) => {
                  e.preventDefault()
                  setPicking(h)
                }}
              >
                <ImageIcon />
              </button>
            </>
          ) : (
            <input {...common} />
          )}
        </span>
        {tools}
      </label>
    )
  }

  return (
    <div className="card-form" ref={boxRef}>
      <h3>
        {multi
          ? t('cardForm.multiTitle', { what: words.count(targets.length) })
          : t('cardForm.title', { what: words.title, n: row + 1 })}
      </h3>
      {multi && <p className="muted small">{t('cardForm.multiHint')}</p>}
      {/* il template della carta è sempre a portata di mano, anche senza la colonna nel foglio */}
      {templateChoices.some((n) => n !== setTemplate) &&
        field(TEMPLATE_COLUMN, { index: sheet.headers.indexOf(TEMPLATE_COLUMN), calc: false })}
      {columns
        .filter(
          (c) =>
            !inDetails(c.header) &&
            !(c.header === TEMPLATE_COLUMN && templateChoices.some((n) => n !== setTemplate))
        )
        .map(({ header: h, index, computed: calc }) => (
          <Fragment key={h}>
            {field(h, { index, calc })}
            {details.has(h) && layerOf.has(h) && (
              <div className="field-details">
                {propertiesOf(h).map((p) =>
                  field(p, { index: sheet.headers.indexOf(p), calc: false, prop: true })
                )}
              </div>
            )}
          </Fragment>
        ))}
      {cropping !== null &&
        (() => {
          const l = layerOf.get(baseOf(cropping))
          const url = l?.type === 'image' ? cropImage(l) : null
          if (!l || l.type !== 'image' || !url) return null
          const own = valueOf(cropping)?.trim()
          return (
            <CropDialog
              url={url}
              value={own ? (parseCrop(own) ?? null) : l.crop}
              frame={{ w: l.w, h: l.h }}
              onApply={(c) => {
                // senza ritaglio: "none" se il template ne ha uno, altrimenti la cella vuota
                write(cropping, c ? cropText(c) : l.crop ? 'none' : '')
                setCropping(null)
              }}
              onClose={() => setCropping(null)}
            />
          )
        })()}
      {picking !== null && (
        <AssetPicker
          value={valueOf(picking) ?? ''}
          onPick={(name) => write(picking, name)}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  )
}

/** Proprietà comuni a tutti i livelli: nei dettagli vengono dopo quelle del tipo */
const COMMON_KEYS = ['opacity', 'x', 'y', 'w', 'h', 'rotation', 'anchor', 'blend', 'shadow']

export default CardForm
