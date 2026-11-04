import type { ProjectMeta } from '../../../shared/model/system'
import { Fragment, useMemo, useRef, useState } from 'react'
import NumInput from './NumInput'
import { useUndo } from './useUndo'
import type { LoadedSet } from '../../../shared/project'
import { isDrawn, type Layer, type Side, type Template } from '../../../shared/model/template'
import { bindRow } from '../../../shared/model/bind'
import { systemOfSet } from '../../../shared/model/system'
import {
  anatomySource,
  cardRefSource,
  findCard,
  parseDocument,
  isMessage,
  parseCardRef,
  anatomyCardSource,
  calloutFace,
  gridContent,
  type Anatomy,
  type CardRef
} from '../../../shared/model/document'
import { BLOCK_FONT, BLOCK_WIDTH } from '../../../shared/model/setup'
import { gridSize } from '../../../shared/model/grid'
import { Dialog } from '../editor/dialogs'
import { useI18n } from '../i18n/context'
import CardSvg from '../render/CardSvg'
import AnatomyDiagram from '../render/AnatomyDiagram'
import { useBindContext } from '../render/assets'
import Segmented from './Segmented'
import WrapField, { type WrapSide } from './WrapField'
import CaptionField from './CaptionField'
import FormattedField, { TextFormatBar } from './TextFormatBar'

/**
 * Chiave dell'etichetta di un livello: con fronte e retro lo stesso nome può stare su entrambi;
 * un elemento di una griglia ha un'etichetta per ogni casella indicata (oltre la prima, #n)
 */
const labelKey = (face: Side, layer: string, cell = 1): string =>
  `${face}:${layer}${cell > 1 ? `#${cell}` : ''}`

/** Le etichette di un livello, con la casella di ciascuna, nell'ordine in cui sono state scritte */
function labelsOf(
  labels: Map<string, string>,
  face: Side,
  layer: string
): { key: string; cell: number }[] {
  const base = labelKey(face, layer)
  return [...labels.keys()].flatMap((key) =>
    key === base
      ? [{ key, cell: 1 }]
      : key.startsWith(`${base}#`) && /^\d+$/.test(key.slice(base.length + 1))
        ? [{ key, cell: Number(key.slice(base.length + 1)) }]
        : []
  )
}

/** Carte mostrate al massimo nella griglia: con un set grande si cerca per nome */
const MAX_SHOWN = 60

/**
 * Nomi dei livelli disegnati, anche dentro i gruppi e le griglie, con la profondità; `cells` è
 * il numero di caselle per gli elementi del contenuto di una griglia
 */
function layerNames(
  layers: Layer[],
  depth = 0,
  cells = 0
): { name: string; depth: number; cells: number }[] {
  return layers.filter(isDrawn).flatMap((l) => {
    const content = l.type === 'grid' ? gridContent(l) : null
    const size = l.type === 'grid' ? gridSize(l) : null
    return [
      { name: l.name, depth, cells },
      ...(l.type === 'group' ? layerNames(l.children, depth + 1, cells) : []),
      // il contenuto delle caselle: l'etichetta indica l'elemento in una casella scelta
      ...(content && size ? layerNames([content], depth + 1, size.rows * size.columns) : [])
    ]
  })
}

/**
 * Sceglie una carta del progetto e scrive nel documento il riferimento ![nome](card:…), senza
 * doverne ricordare la sintassi. Con `anatomy` scrive invece l'anatomia della carta: si
 * scelgono i livelli da spiegare e il testo delle etichette. Con `pick` sceglie soltanto la carta
 * (per lo schema del tavolo) e restituisce il riferimento senza card:.
 */
export default function InsertCardDialog({
  sets,
  templates,
  project,
  anatomy,
  initial,
  pick,
  bare = false,
  onInsert,
  onClose
}: {
  sets: LoadedSet[]
  templates: Template[]
  project: string | ProjectMeta
  anatomy?: boolean
  /** L'anatomia da modificare */
  initial?: Anatomy
  /** Sceglie solo la carta: il riferimento scritto ora, o '' per una nuova */
  pick?: string
  /** Con pick: senza larghezza e senza il riferimento scritto, come per la copertina */
  bare?: boolean
  /** Il testo da inserire: ![didascalia](card:…) o il blocco ```anatomy */
  onInsert(text: string): void
  onClose(): void
}): React.JSX.Element {
  const { t } = useI18n()
  // la carta dell'anatomia da modificare, se si trova ancora
  const start = (() => {
    const card = initial?.card ?? pick
    if (!card) return null
    const ref = parseCardRef(anatomyCardSource(card))
    if (isMessage(ref)) return null
    const found = findCard(ref, sets)
    return isMessage(found) ? null : { ref, set: found.set.name, row: found.row }
  })()
  const [setName, setSetName] = useState(start?.set ?? '')
  const bindCtx = useBindContext()
  const { usable, set, template, cards } = useMemo(() => {
    const usable = sets.filter((s) => s.data?.rows.length)
    const set = usable.find((s) => s.name === setName) ?? usable[0]
    const template = set && templates.find((x) => x.name === set.template)
    const info = set ? systemOfSet(project, set) : null
    const cards =
      set?.data && template && info
        ? set.data.rows.map((row, i) =>
            bindRow(set.data!.headers, row, template, templates, {
              ...bindCtx,
              system: { ...info, number: i + 1 }
            })
          )
        : []
    return { usable, set, template, cards }
  }, [sets, setName, templates, bindCtx, project])
  const headers = (set?.data?.headers ?? []).filter((h) => h && h !== 'amount' && !h.includes('.'))

  const [query, setQuery] = useState('')
  const [row, setRow] = useState(start?.row ?? 0)
  // di base si cerca la carta per il campo del nome: il riferimento regge se le righe cambiano ordine
  const defaultKey =
    (template?.labelField && headers.includes(template.labelField)
      ? template.labelField
      : headers[0]) ?? ''
  const [keyChoice, setKey] = useState<string | null>(start ? (start.ref.field ?? '') : null)
  const key =
    keyChoice !== null && (keyChoice === '' || headers.includes(keyChoice)) ? keyChoice : defaultKey
  const [side, setSide] = useState<Side>(start?.ref.side ?? 'front')
  /** Anatomia con fronte e retro affiancati */
  const [both, setBoth] = useState(initial?.both ?? false)
  const [width, setWidth] = useState(start?.ref.width ? String(start.ref.width) : '')
  /** Larghezza massima dell'anatomia nel documento e corpo delle etichette, in % (width: e font:) */
  const [blockWidth, setBlockWidth] = useState(String(Math.round((initial?.width ?? 1) * 100)))
  const [blockFont, setBlockFont] = useState(String(Math.round((initial?.font ?? 1) * 100)))
  /** Etichette dell'anatomia per faccia e livello (labelKey); un livello senza voce non si spiega */
  const [labels, setLabels] = useState<Map<string, string>>(
    () =>
      new Map(
        initial?.callouts.map((c) => [
          labelKey(calloutFace(initial, c, start?.ref.side ?? 'front'), c.layer, c.cell),
          c.label
        ]) ?? []
      )
  )
  const [caption, setCaption] = useState<string | null>(initial ? initial.caption : null)
  /** Didascalia sopra il disegno invece che sotto */
  const [captionTop, setCaptionTop] = useState(initial?.captionTop ?? false)
  /** Testo che scorre accanto, con la carta o l'anatomia a sinistra o a destra */
  const [wrap, setWrapSide] = useState<WrapSide>((initial ? initial.wrap : start?.ref.wrap) ?? null)
  // un'anatomia a tutta riga non lascia posto al testo: si parte da metà
  const setWrap = (w: WrapSide): void => {
    setWrapSide(w)
    if (w && anatomy && Number(blockWidth) >= 100) setBlockWidth('50')
  }
  useUndo([setName, row, keyChoice, side, both, width, labels, caption, captionTop], (s) => {
    setSetName(s[0])
    setRow(s[1])
    setKey(s[2])
    setSide(s[3])
    setBoth(s[4])
    setWidth(s[5])
    setLabels(s[6])
    setCaption(s[7])
    setCaptionTop(s[8])
  })
  /** L'ultima etichetta dell'anatomia in cui si è scritto: la barra di formattazione agisce lì */
  const labelField = useRef<HTMLTextAreaElement | null>(null)

  const shown = cards
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => !query.trim() || c.label.toLowerCase().includes(query.trim().toLowerCase()))
  const current = cards[row] ? row : 0
  const col = set?.data?.headers.indexOf(key) ?? -1
  const value = col >= 0 ? (set?.data?.rows[current]?.[col] ?? '').trim() : ''
  const repeated =
    col >= 0 &&
    value !== '' &&
    (set?.data?.rows.filter((r) => (r[col] ?? '').trim() === value).length ?? 0) > 1
  // per campo solo se il valore c'è e distingue la carta; altrimenti per numero
  const byField = key !== '' && value !== '' && !repeated
  const ref: CardRef | null = set
    ? {
        set: set.name,
        ...(byField ? { field: key, value } : { row: current + 1 }),
        side: anatomy && both ? 'front' : side,
        ...(Number(width) > 0 ? { width: Number(width) } : {}),
        ...(!anatomy && pick === undefined && captionTop ? { captionTop: true } : {}),
        ...(!anatomy && pick === undefined && wrap ? { wrap } : {})
      }
    : null
  const alt = caption ?? cards[current]?.label ?? ''
  /** Le facce di cui si spiegano i livelli, ciascuna con i suoi */
  const faces: { face: Side; layers: ReturnType<typeof layerNames> }[] = template
    ? (anatomy && both ? (['front', 'back'] as Side[]) : [side]).map((face) => ({
        face,
        layers: layerNames(face === 'front' ? template.front : template.back)
      }))
    : []
  const text = !ref
    ? ''
    : pick !== undefined
      ? cardRefSource(ref).replace(/^card:/i, '')
      : anatomy
        ? anatomySource(
            cardRefSource(ref),
            faces.flatMap(({ face, layers }) =>
              layers.flatMap((l) =>
                labelsOf(labels, face, l.name).map(({ key, cell }) => ({
                  layer: l.name,
                  label: labels.get(key)!.trim() || l.name,
                  face,
                  side: initial?.callouts.find((c) => c.layer === l.name && (c.cell ?? 1) === cell)
                    ?.side,
                  ...(cell > 1 ? { cell } : {})
                }))
              )
            ),
            both,
            {
              width: percent(blockWidth, BLOCK_WIDTH),
              font: percent(blockFont, BLOCK_FONT),
              caption: caption ?? '',
              captionTop,
              wrap
            }
          )
        : `![${alt.replace(/[[\]]/g, '')}](${cardRefSource(ref)})`

  // l'anatomia come uscirà nel documento, aggiornata mentre si scelgono livelli ed etichette
  const block = anatomy && text ? parseDocument(text)[0] : undefined
  const preview = block?.kind === 'anatomy' ? block : undefined

  const choose = set && (
    <div className="dialog-row">
      <label>
        {t('documents.set')}
        <select
          value={set.name}
          onChange={(e) => {
            setSetName(e.target.value)
            setRow(0)
            setKey(null)
            if (!anatomy) setCaption(null)
          }}
        >
          {usable.map((s) => (
            <option key={s.name}>{s.name}</option>
          ))}
        </select>
      </label>
      <label className="grow">
        {t('documents.search')}
        <input
          autoFocus
          value={query}
          placeholder={t('documents.searchHint')}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
    </div>
  )
  const grid = (
    <div className="insert-card-grid">
      {shown.slice(0, MAX_SHOWN).map(({ c, i }) => (
        <button
          key={i}
          className={i === current ? 'active' : ''}
          title={c.label}
          onClick={() => {
            setRow(i)
            setCaption(null)
          }}
        >
          <CardSvg template={c.template} side={side} scale={80 / c.template.width} />
          <span>{c.label || `#${i + 1}`}</span>
        </button>
      ))}
      {shown.length > MAX_SHOWN && (
        <p className="muted small">{t('documents.more', { n: shown.length - MAX_SHOWN })}</p>
      )}
    </div>
  )
  const options = (
    <>
      <div className="dialog-row">
        <label>
          {t('documents.side')}
          {anatomy ? (
            <Segmented<Side | 'both'>
              value={both ? 'both' : side}
              options={[
                ['front', t('documents.front')],
                ['back', t('documents.back')],
                ['both', t('documents.bothSides')]
              ]}
              onChange={(v) => {
                setBoth(v === 'both')
                if (v !== 'both') setSide(v)
              }}
            />
          ) : (
            <Segmented<Side>
              value={side}
              options={[
                ['front', t('documents.front')],
                ['back', t('documents.back')]
              ]}
              onChange={setSide}
            />
          )}
        </label>
        {!bare && (
          <label>
            {t('documents.width')}
            <NumInput
              allowEmpty
              className="num"
              min={5}
              value={width}
              placeholder={template ? String(template.width) : ''}
              onChange={(e) => setWidth(e.target.value)}
            />
          </label>
        )}
        <label className="grow">
          {t('documents.findBy')}
          <select value={key} onChange={(e) => setKey(e.target.value)}>
            <option value="">{t('documents.byNumber')}</option>
            {headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </label>
      </div>
      {anatomy && (
        <div className="dialog-row" title={t('documents.blockSizeHint')}>
          <label>
            {t('documents.blockWidth')}
            <NumInput
              allowEmpty
              className="num"
              min={10}
              max={100}
              value={blockWidth}
              onChange={(e) => setBlockWidth(e.target.value)}
            />
          </label>
          <label>
            {t('documents.blockFont')}
            <NumInput
              allowEmpty
              className="num"
              min={30}
              max={300}
              value={blockFont}
              onChange={(e) => setBlockFont(e.target.value)}
            />
          </label>
        </div>
      )}
      {anatomy && (
        <div className="dialog-row">
          <WrapField value={wrap} onChange={setWrap} />
        </div>
      )}
      {anatomy && (
        <CaptionField
          value={caption ?? ''}
          top={captionTop}
          onChange={setCaption}
          onTop={setCaptionTop}
        />
      )}
      {key !== '' && !byField && (
        <p className="muted small">
          {t(repeated ? 'documents.repeatedValue' : 'documents.emptyValue', { field: key })}
        </p>
      )}
    </>
  )
  const layerList = (
    <div className="anatomy-layers">
      <p className="muted small">{t('documents.anatomyHint')}</p>
      {labels.size > 0 && <TextFormatBar editor={labelField} />}
      {faces.map(({ face, layers }) => (
        <Fragment key={face}>
          {faces.length > 1 && (
            <h4>{t(face === 'front' ? 'documents.front' : 'documents.back')}</h4>
          )}
          {layers.map((l) => {
            const k = labelKey(face, l.name)
            const own = labelsOf(labels, face, l.name)
            const field = (key: string): React.JSX.Element => (
              <FormattedField
                singleLine
                value={labels.get(key) ?? ''}
                placeholder={t('documents.anatomyLabel')}
                onFocus={(el) => {
                  labelField.current = el
                }}
                onChange={(v) => setLabels(new Map(labels).set(key, v))}
              />
            )
            /** Sposta l'etichetta su un'altra casella, al suo posto nell'ordine */
            const moveTo = (key: string, cell: number): void => {
              const to = labelKey(face, l.name, cell)
              if (to === key || labels.has(to)) return
              setLabels(new Map([...labels].map(([k2, v]) => [k2 === key ? to : k2, v])))
            }
            return (
              <div key={k} className="anatomy-layer" style={{ paddingLeft: l.depth * 14 }}>
                <label>
                  <input
                    type="checkbox"
                    checked={own.length > 0}
                    onChange={(e) => {
                      const next = new Map(labels)
                      if (e.target.checked) next.set(k, l.name)
                      else own.forEach((o) => next.delete(o.key))
                      setLabels(next)
                    }}
                  />
                  {l.name}
                </label>
                {own.length > 0 && l.cells === 0 && field(k)}
                {own.length > 0 && l.cells > 0 && (
                  <div className="anatomy-cells">
                    {own.map(({ key, cell }) => (
                      <div key={key} className="anatomy-cell">
                        <label title={t('documents.anatomyCellHint', { n: l.cells })}>
                          {t('documents.anatomyCell')}
                          <NumInput
                            className="num"
                            min={1}
                            max={l.cells}
                            value={String(cell)}
                            onChange={(e) => {
                              const n = Number(e.target.value)
                              if (Number.isInteger(n) && n >= 1 && n <= l.cells) moveTo(key, n)
                            }}
                          />
                        </label>
                        {field(key)}
                        {own.length > 1 && (
                          <button
                            type="button"
                            className="icon-btn"
                            title={t('documents.anatomyCellRemove')}
                            onClick={() => {
                              const next = new Map(labels)
                              next.delete(key)
                              setLabels(next)
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    {own.length < l.cells && (
                      <button
                        type="button"
                        className="link"
                        onClick={() => {
                          let n = 1
                          while (own.some((o) => o.cell === n)) n++
                          setLabels(new Map(labels).set(labelKey(face, l.name, n), l.name))
                        }}
                      >
                        {t('documents.anatomyCellAdd')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </Fragment>
      ))}
    </div>
  )

  return (
    <Dialog
      title={t(
        pick !== undefined
          ? 'documents.pickCard'
          : anatomy
            ? initial
              ? 'documents.editAnatomy'
              : 'documents.insertAnatomy'
            : 'documents.insertCard'
      )}
      onClose={onClose}
    >
      <div className={anatomy ? 'dialog-form insert-card anatomy-mode' : 'dialog-form insert-card'}>
        {!set ? (
          <p className="muted">{t('documents.noCards')}</p>
        ) : anatomy ? (
          // l'anatomia ha due colonne: a sinistra la carta da scegliere, a destra la carta scelta
          // con i livelli da spiegare; ciascuna scorre per conto suo e la finestra sta nello schermo
          <>
            <div className="anatomy-columns">
              <div className="anatomy-pick">
                {choose}
                {grid}
                {options}
              </div>
              <div className="anatomy-detail">
                {preview && (
                  <div className="anatomy-card">
                    <AnatomyDiagram
                      anatomy={preview}
                      sets={sets}
                      templates={templates}
                      project={project}
                      unit={3}
                      maxWidth={160 * (preview.width ?? 1)}
                      font={3.2 * (preview.font ?? 1)}
                    />
                  </div>
                )}
                {layerList}
              </div>
            </div>
            <code className="insert-card-code">{text}</code>
          </>
        ) : (
          <>
            {choose}
            {grid}
            {options}
            {pick !== undefined ? null : (
              <>
                <CaptionField
                  value={alt}
                  top={captionTop}
                  onChange={setCaption}
                  onTop={setCaptionTop}
                />
                <div className="dialog-row">
                  <WrapField value={wrap} onChange={setWrap} />
                </div>
              </>
            )}
            {!bare && <code className="insert-card-code">{text}</code>}
          </>
        )}
        <div className="dialog-buttons">
          <button onClick={onClose}>{t('dialog.cancel')}</button>
          <button
            className="primary"
            disabled={!text || (anatomy && !labels.size)}
            onClick={() => onInsert(text)}
          >
            {t(
              pick !== undefined
                ? 'documents.pick'
                : initial
                  ? 'documents.saveAnatomy'
                  : 'documents.insert'
            )}
          </button>
        </div>
      </div>
    </Dialog>
  )
}

/** Un campo in % come frazione dentro i limiti, o null se è vuoto o fuori */
function percent(text: string, lim: { min: number; max: number }): number | null {
  const n = Number(text.replace(',', '.')) / 100
  return text.trim() !== '' && n >= lim.min && n <= lim.max ? n : null
}
