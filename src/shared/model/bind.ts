import { msg, type Message } from '../messages'
import { parseRepeat } from './arrange'
import { gridSize } from './grid'
import { isGradient, mapGradientColors } from './gradient'
import { resolveAsset } from './assets'
import { parseCrop } from './crop'
import { isGenericFont, markupFonts } from './fonts'
import { evaluateFormula, truthy, type FormulaNumbers } from './formula'
import { localizeNumber } from './number'
import type { NumberFormatting } from './numberFormat'
import { markupProblems, markupRefs } from './markup'
import { walkLayers } from './normalize'
import { imageBackdrop } from './shapes'
import { splitLanguage, translatedCells, translation, type Localization } from './language'
import { cardTemplate } from './inherit'
import { systemFields, usesSide, type SystemInfo } from './system'
import {
  combineFlip,
  imageVariable,
  palette,
  parseImageAttrs,
  resolveColor,
  variableFields,
  type Variables
} from './variables'
import {
  PRIMARY_PROPERTY,
  type CellLook,
  type GridLayer,
  type GroupLayer,
  type Layer,
  type Side,
  type Shadow,
  type Stroke,
  type Template,
  type ValueSource
} from './template'

// Applica una riga del foglio a un template: vedi docs/formato.md, "Fogli dati".

export interface CardData {
  /** Valori della riga per intestazione */
  fields: Record<string, string>
  amount: number
}

export interface BoundCard {
  template: Template
  amount: number
  problems: Message[]
  /** Nome della carta: il campo scelto nel template, o la prima colonna non vuota */
  label: string
}

export function rowToCard(headers: string[], row: string[]): CardData {
  const fields: Record<string, string> = {}
  headers.forEach((h, i) => (fields[h] = row[i] ?? ''))
  const amount = parseInt(fields.amount ?? '', 10)
  return { fields, amount: Number.isFinite(amount) && amount >= 0 ? amount : 1 }
}

/**
 * Una riga di un set applicata al suo template: quello del set, o quello scelto per la carta nella
 * colonna `template`.
 */
export function bindRow(
  headers: string[],
  row: string[],
  setTemplate: Template,
  templates: Template[],
  ctx: BindContext = {}
): BoundCard {
  const { template, problem } = cardTemplate(headers, row, setTemplate, templates)
  const bound = bindCard(template, rowToCard(headers, row), ctx)
  return problem ? { ...bound, problems: [problem, ...bound.problems] } : bound
}

/** Progetto aperto: per controllare stili, immagini e font richiamati dai testi */
export interface BindContext {
  styles?: Record<string, string>
  assets?: string[]
  /** Dice se un font è disponibile: nel progetto, nell'app o installato sul computer */
  hasFont?: (family: string) => boolean
  variables?: Variables
  /** Progetto, set e posizione della carta, per le variabili di sistema */
  system?: SystemInfo
  /** Lingua in cui disegnare la carta, se non è la principale: vedi model/language.ts */
  localization?: Localization
  /** Come si leggono i numeri nelle formule e si scrivono sulla carta: vedi model/numberFormat.ts */
  numbers?: NumberFormatting
}

/** Le opzioni dei numeri per leggere le formule, e per scrivere il risultato se `shown` */
function formulaNumbers(
  numbers: NumberFormatting | undefined,
  shown = false
): FormulaNumbers | undefined {
  if (!numbers) return undefined
  return shown ? numbers : { decimalComma: numbers.decimalComma }
}

/** Progetto e set con i nomi della lingua scelta */
function localizeSystem(system?: SystemInfo, loc?: Localization): SystemInfo | undefined {
  if (!system || !loc) return system
  return {
    ...system,
    project: loc.project ?? system.project,
    set: (system.set !== undefined && loc.sets?.[system.set]) || system.set
  }
}

/** Una formula con = (logica e calcoli) usa i valori della lingua principale */
function isExpression(expr: string): boolean {
  return expr.trimStart().startsWith('=')
}

/**
 * Aspetto di ogni casella secondo le regole della griglia, in ordine: una regola dopo prevale.
 * Le condizioni leggono i campi della carta e quelli della casella; una casella nascosta
 * nasconde anche il suo contenuto. I problemi si segnalano dalla prima casella.
 */
function applyCellRules(
  grid: GridLayer,
  fields: Record<string, string>,
  say: (m: Message) => void,
  numbers?: NumberFormatting,
  card = 0
): GridLayer {
  const { rows, columns } = gridSize(grid)
  const count = rows * columns
  const base: CellLook = {
    fill: grid.fill,
    stroke: grid.stroke,
    radius: grid.radius,
    hidden: false
  }
  const looks = Array.from({ length: count }, (_, i) => {
    const f = { ...fields, ...cellFields(grid.name, i, columns, count, card) }
    let look = base
    grid.cellRules.forEach((rule, k) => {
      const when = rule.when.trim()
      if (!when) return
      const r = evaluateFormula(
        when.startsWith('=') ? when : `=${when}`,
        f,
        formulaNumbers(numbers)
      )
      if (i === 0) {
        const layer = `${grid.name} (${k + 1})`
        for (const field of r.missing) say(msg('bind.formulaField', { layer, field }))
        if (r.error)
          say(msg('bind.cellRuleError', { layer: grid.name, rule: k + 1, error: r.error }))
      }
      if (r.error || !truthy(r.value)) return
      look = {
        fill: rule.fill !== undefined ? rule.fill : look.fill,
        stroke: rule.stroke !== undefined ? rule.stroke : look.stroke,
        radius: rule.radius ?? look.radius,
        hidden: rule.hidden ?? look.hidden
      }
    })
    return look
  })
  return {
    ...grid,
    looks,
    ...(grid.cells && {
      cells: grid.cells.map((c, i) => (looks[i]?.hidden ? { ...c, visible: false } : c))
    })
  }
}

/**
 * Campi di una casella della griglia: posizione da 1 riga per riga, numero di caselle e un
 * numero a caso fisso per carta, griglia e casella, da usare con PICK.
 */
export function cellFields(
  grid: string,
  index: number,
  columns: number,
  count: number,
  card = 0
): Record<string, string> {
  // FNV-1a: lo stesso numero a ogni disegno della stessa carta
  let h = 2166136261
  for (const c of `${card}|${grid}|${index}`) {
    h ^= c.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return {
    'cell.index': String(index + 1),
    'cell.row': String(Math.floor(index / columns) + 1),
    'cell.column': String((index % columns) + 1),
    'cell.count': String(count),
    'cell.random': String(((h >>> 0) % 999999) + 1)
  }
}

export function bindCard(template: Template, card: CardData, ctx: BindContext = {}): BoundCard {
  const problems: Message[] = []
  const language = ctx.localization?.language
  const system = localizeSystem(ctx.system, ctx.localization)
  // le colonne nome@lingua valgono solo nella loro lingua, al posto della colonna nome
  const cells = Object.entries(card.fields).filter(([h]) => splitLanguage(h).language === null)
  if (language) cells.push(...Object.entries(translatedCells(card.fields, language)))
  const overrides = new Map<string, Map<string, string>>()
  for (const [header, value] of cells) {
    if (value === '' || header === 'amount') continue
    const dot = header.indexOf('.')
    const layer = dot < 0 ? header : header.slice(0, dot)
    const prop = dot < 0 ? null : header.slice(dot + 1)
    // cella vuota: vale il valore del template; solo spazi svuotano il valore principale, mentre
    // per le altre proprietà (dimensione, colore...) contano come cella vuota
    if (prop !== null && value.trim() === '') continue
    if (!overrides.has(layer)) overrides.set(layer, new Map())
    overrides.get(layer)!.set(prop ?? '', value.trim() === '' ? '' : value)
  }

  // una variabile con il nome di un livello o di una colonna resta nascosta: {nome} è il campo
  if (ctx.variables) {
    const layerNames = new Set(walkLayers([...template.front, ...template.back]).map((l) => l.name))
    for (const name of Object.keys(ctx.variables)) {
      if (layerNames.has(name)) problems.push(msg('bind.variableIsLayer', { name }))
      else if (name in card.fields) problems.push(msg('bind.variableIsColumn', { name }))
    }
  }
  const nums = ctx.numbers
  const front = fieldSets(template, card, ctx.variables, system, 'front', language, nums)
  // {card.side} vale back sul retro: solo allora servono campi a parte
  const back = usesSide(template)
    ? fieldSets(template, card, ctx.variables, system, 'back', language, nums)
    : front
  const pal = palette(ctx.variables)
  // i testi tradotti valgono solo per ciò che si legge: nomi di immagini e font, colori,
  // ripetizioni e formule con = usano i valori della lingua principale. Una colonna immagine
  // tradotta (icona@en) cambia l'immagine apposta, e vale anche per {icona} nei testi.
  const bindSide = (layers: Layer[], { main, shown }: FieldSets): Layer[] => {
    const fields = main === shown ? main : { ...main }
    if (main !== shown)
      for (const l of walkLayers([...template.front, ...template.back])) {
        if (l.type !== 'image' || l.source.kind !== 'column') continue
        const column = l.source.column ?? l.name
        if (shown[column] !== main[column]) fields[column] = shown[column]
      }
    const images = imageFields(template, fields, nums)
    // i gruppi che una griglia ripete nelle caselle si disegnano solo lì
    const raw = walkLayers(layers)
    const contents = new Set(
      raw.flatMap((l) => (l.type === 'grid' && l.content.trim() ? [l.content.trim()] : []))
    )
    /**
     * Lega i livelli con i campi dati. Le caselle di una griglia ripetono il legame con i campi
     * {cell.…}; i problemi si segnalano una volta sola, dalla prima casella.
     */
    const bindWith = (
      fields: Record<string, string>,
      shown: Record<string, string>,
      inCell: boolean,
      report: boolean
    ): ((layers: Layer[]) => Layer[]) => {
      const say = (m: Message): void => {
        if (report) problems.push(m)
      }
      // nei testi i campi che sono numeri si scrivono nel formato della lingua: 2,5
      const written = nums
        ? Object.fromEntries(
            Object.entries(shown).map(([k, v]) => [k, localizeNumber(v, nums.shown)])
          )
        : shown
      const apply = (layers: Layer[]): Layer[] =>
        layers.map((layer) => {
          if (!inCell && layer.type === 'group' && contents.has(layer.name))
            return { ...layer, visible: false }
          let out: Layer = layer
          const src = layer.source
          const column = src.kind === 'column' && src.column ? src.column : layer.name
          const props = new Map(overrides.get(column))
          // il valore principale segue la fonte scelta; le colonne delle altre proprietà valgono sempre
          if (src.kind === 'fixed') {
            props.delete('')
            // un testo fisso tradotto nella lingua della carta
            const tr = layer.type === 'text' ? translation(layer.texts, language) : undefined
            if (tr !== undefined) props.set('', tr)
          }
          if (src.kind === 'formula') {
            const read = layer.type === 'text' && !isExpression(src.expr) ? shown : fields
            const r = evaluateFormula(src.expr, read, formulaNumbers(nums, layer.type === 'text'))
            for (const f of r.missing)
              say(msg('bind.formulaField', { layer: layer.name, field: f }))
            if (r.error) say(msg('bind.formulaError', { layer: layer.name, error: r.error }))
            // un testo o un valore vuoto resta vuoto; per le altre proprietà (colore, immagine,
            // numeri) un risultato vuoto lascia il valore del template
            if (r.value.trim() !== '' || layer.type === 'text' || layer.type === 'value')
              props.set('', r.value)
            else props.delete('')
          }
          // il numero di una colonna, sulla carta, nel formato della lingua
          if (nums && layer.type === 'text' && src.kind === 'column' && props.has(''))
            props.set('', localizeNumber(props.get('')!, nums.shown))
          if (props.size) {
            const patch: Record<string, unknown> = {}
            for (const [prop, raw] of props) {
              const key = prop || PRIMARY_PROPERTY[layer.type]
              if (!(key in layer)) {
                say(msg('bind.unknownProperty', { column: `${column}.${key}` }))
                continue
              }
              const parsed = parseValue(
                key,
                (layer as unknown as Record<string, unknown>)[key],
                raw
              )
              if (parsed === undefined)
                say(msg('bind.invalidValue', { column: `${column}.${key}`, value: raw }))
              else patch[key] = parsed
            }
            out = { ...layer, ...patch } as Layer
          }
          if (out.type === 'text') {
            // il font può essere una variabile o un campo: {titoli}
            out = {
              ...out,
              text: substituteFields(out.text, written, images),
              font: substituteFields(out.font, fields).trim()
            }
            if (out.visible) {
              textProblems(out.name, out.text, ctx).forEach(say)
              if (ctx.hasFont)
                for (const font of new Set([
                  out.font,
                  ...markupFonts(out.text, ctx.styles, ctx.variables)
                ]))
                  if (font.trim() && !isGenericFont(font) && !ctx.hasFont(font))
                    say(msg('bind.missingFont', { layer: out.name, font }))
            }
          }
          if (out.type === 'image') {
            out = { ...out, src: substituteFields(out.src, fields) }
            // una variabile immagine prevale su un file con lo stesso nome
            // {spada} come sorgente vale quanto spada
            const v = imageVariable(out.src.trim().replace(/^\{(.*)\}$/, '$1'), ctx.variables)
            if (v) {
              const [flipH, flipV] = combineFlip(v.flip, out.flipH, out.flipV)
              const backdrop = imageBackdrop(v, ctx.variables)
              out = {
                ...out,
                src: v.src,
                tint: out.tint ?? v.tint ?? null,
                flipH,
                flipV,
                opacity: out.opacity * (v.opacity ?? 1),
                ...(backdrop ? { backdrop } : {})
              }
            }
          }
          if (out.type === 'group') {
            // un campo vuoto vale 0; un campo che non c'è (template senza dati) resta 1
            const repeat = substituteFields(out.repeat, fields).trim() || '0'
            if (parseRepeat(repeat) === null && !/\{[^}]*\}/.test(repeat))
              say(msg('bind.invalidValue', { column: `${layer.name}.repeat`, value: repeat }))
            out = { ...out, repeat, children: apply(out.children) }
          }
          if (out.type === 'grid' && out.content.trim()) {
            const name = out.content.trim()
            const group = raw.find((l): l is GroupLayer => l.type === 'group' && l.name === name)
            if (!group) say(msg('bind.gridContent', { layer: out.name, group: name }))
            else {
              const { rows, columns } = gridSize(out)
              const grid = out
              const cells = Array.from({ length: rows * columns }, (_, i) => {
                const cell = cellFields(grid.name, i, columns, rows * columns, system?.number)
                const f = { ...fields, ...cell }
                const sh = shown === fields ? f : { ...shown, ...cell }
                return bindWith(f, sh, true, report && i === 0)([group])[0] as GroupLayer
              })
              out = { ...out, cells }
            }
          }
          if (out.type === 'grid' && out.cellRules?.length)
            out = applyCellRules(out, fields, say, nums, system?.number)
          // i tag dello snap point possono leggere i campi: {tipo}
          if (out.snap?.tags.includes('{'))
            out = { ...out, snap: { ...out.snap, tags: substituteFields(out.snap.tags, fields) } }
          return paintLayer(out, pal, fields)
        })
      return apply
    }
    return bindWith(fields, shown, false, true)(layers)
  }

  return {
    template: {
      ...template,
      ...(template.ttsTags?.includes('{')
        ? { ttsTags: substituteFields(template.ttsTags, front.main) }
        : {}),
      front: bindSide(template.front, front),
      back: bindSide(template.back, back)
    },
    amount: card.amount,
    problems,
    label: cardLabel(template, cells, front.shown)
  }
}

/** Errori del markup di un testo, e {nome} che non è né un campo né un'immagine */
function textProblems(layer: string, text: string, ctx: BindContext): Message[] {
  const out = markupProblems(text, ctx.styles).map((p) =>
    msg('bind.markup', { layer, problem: p.message })
  )
  if (ctx.assets)
    for (const name of new Set(markupRefs(text))) {
      if (!name) continue
      // di una variabile immagine si controlla il file
      const v = imageVariable(name, ctx.variables)
      const r = resolveAsset(v ? v.src : name, ctx.assets)
      if (r.ok) continue
      if (v && r.reason !== 'ambiguous')
        out.push(msg('bind.missingVariableImage', { layer, name, src: v.src }))
      else
        out.push(
          msg(r.reason === 'ambiguous' ? 'bind.ambiguousRef' : 'bind.unknownRef', {
            layer,
            name: v ? v.src : name
          })
        )
    }
  return out
}

function cardLabel(
  template: Template,
  cells: [string, string][],
  fields: Record<string, string>
): string {
  if (template.labelField) return fields[template.labelField] ?? ''
  // le celle tradotte sono in fondo: valgono quelle, al posto della colonna nella lingua principale
  const byColumn = new Map(cells)
  const first = [...byColumn].find(
    ([h, v]) => h !== 'amount' && !h.includes('.') && v.trim() !== ''
  )
  return first?.[1] ?? ''
}

/** Valore principale di un livello come testo, quello che vale se la riga non lo cambia */
export function defaultValue(l: Layer): string | null {
  switch (l.type) {
    case 'text':
      return l.text
    case 'image':
      return l.src
    case 'shape':
    case 'grid':
      return l.fill ?? ''
    case 'value':
      return l.value
    default:
      return null
  }
}

/**
 * Fonte del livello dopo il cambio di tipo. Passando a formula si parte dal valore attuale,
 * così la carta non cambia; restando sullo stesso tipo non cambia nulla.
 */
export function switchSource(l: Layer, kind: ValueSource['kind']): ValueSource {
  if (l.source.kind === kind) return l.source
  if (kind === 'column') return { kind, column: null }
  if (kind === 'fixed') return { kind }
  const v = defaultValue(l)
  return { kind, expr: v?.trim() ? v : `{${l.name}}` }
}

/**
 * Campi disponibili per formule e {campo}: i valori del template come base, sopra le celle non
 * vuote della riga, poi i livelli valore calcolati in ordine (uno può usare i precedenti).
 */
export function cardFields(
  template: Template,
  card: CardData,
  variables?: Variables,
  system?: SystemInfo,
  side: Side = 'front',
  numbers?: NumberFormatting
): Record<string, string> {
  return fieldSets(template, card, variables, system, side, undefined, numbers).main
}

/** I campi di una carta nella lingua principale e in quella scelta */
export interface FieldSets {
  /** Valori della lingua principale: li usano le formule con = */
  main: Record<string, string>
  /** Valori che si vedono: le celle tradotte al posto di quelle della lingua principale */
  shown: Record<string, string>
}

/**
 * Come cardFields, nella lingua principale e in `language`: senza lingua (o senza celle tradotte)
 * i due insiemi sono uguali.
 */
export function fieldSets(
  template: Template,
  card: CardData,
  variables?: Variables,
  system?: SystemInfo,
  side: Side = 'front',
  language?: string,
  numbers?: NumberFormatting
): FieldSets {
  const parse = formulaNumbers(numbers)
  const all = walkLayers([...template.front, ...template.back])
  // le variabili di testo e valore valgono come campi, ma un campo con lo stesso nome vince;
  // sotto ancora le variabili di sistema
  const fields: Record<string, string> = {
    ...systemFields(system, template, card.amount, side),
    ...variableFields(variables)
  }
  for (const l of all) {
    const v = defaultValue(l)
    if (v !== null) fields[l.name] = v
  }
  for (const [k, v] of Object.entries(card.fields))
    if (v !== '' || !(k in fields)) fields[k] = v.trim() === '' ? '' : v
  const local = language ? translatedCells(card.fields, language) : {}
  // variabili tradotte: valgono dove il campo è ancora quello della variabile (un livello o una
  // colonna con lo stesso nome vince, come nella lingua principale)
  const mainVars = language ? variableFields(variables) : {}
  const localVars = language ? variableFields(variables, language) : {}
  const varChanges = Object.keys(localVars).filter(
    (k) => localVars[k] !== mainVars[k] && fields[k] === mainVars[k]
  )
  const translated =
    Object.keys(local).length > 0 ||
    varChanges.length > 0 ||
    all.some(
      (l) => l.type === 'value' && l.source.kind === 'fixed' && translation(l.values, language)
    )
  // con un formato dei numeri i valori calcolati si vedono scritti in quel formato
  const separate = translated || numbers !== undefined
  const shown = separate ? { ...fields } : fields
  for (const k of varChanges) shown[k] = localVars[k]
  for (const [k, v] of Object.entries(local)) shown[k] = v.trim() === '' ? '' : v
  for (const l of all) {
    if (l.type !== 'value') continue
    const src = l.source
    if (src.kind === 'fixed') {
      fields[l.name] = l.value
      shown[l.name] = translation(l.values, language) ?? l.value
    } else if (src.kind === 'formula') {
      fields[l.name] = evaluateFormula(src.expr, fields, parse).value
      if (separate)
        shown[l.name] = isExpression(src.expr)
          ? numbers
            ? evaluateFormula(src.expr, fields, numbers).value
            : fields[l.name]
          : evaluateFormula(src.expr, shown, numbers).value
    } else if (src.column) {
      const cell = card.fields[src.column]
      fields[l.name] = cell ? (cell.trim() ? cell : '') : l.value
      if (translated && src.column in local)
        shown[l.name] = local[src.column].trim() ? local[src.column] : ''
      else if (separate) shown[l.name] = fields[l.name]
    }
  }
  return { main: fields, shown }
}

/**
 * Valore principale dei livelli fissi e con formula per una carta: il valore del template o il
 * risultato della formula. Si mostrano in tabella, senza poterli modificare.
 */
export function computedValues(
  template: Template,
  card: CardData,
  variables?: Variables,
  numbers?: NumberFormatting
): Record<string, string> {
  const fields = cardFields(template, card, variables, undefined, 'front', numbers)
  const parse = formulaNumbers(numbers)
  const out: Record<string, string> = {}
  for (const l of walkLayers([...template.front, ...template.back])) {
    if (l.source.kind === 'column' || l.type === 'group') continue
    out[l.name] =
      l.type === 'value'
        ? (fields[l.name] ?? '')
        : l.source.kind === 'formula'
          ? evaluateFormula(l.source.expr, fields, parse).value
          : (defaultValue(l) ?? '')
  }
  return out
}

/** {spada} o {spada tint=red} come valore di un campo: il riferimento senza le graffe */
function unbrace(value: string): string {
  const v = value.trim()
  const m = /^\{([^{}*]+)\}$/.exec(v)
  return m ? m[1].trim() : v
}

/**
 * Campi che danno un'immagine: il nome di ogni livello immagine (e la colonna da cui prende il
 * valore) con l'immagine che mostra sulla carta. Nel testo {campo} di questi campi disegna
 * l'immagine invece di scriverne il nome.
 */
export function imageFields(
  template: Template,
  fields: Record<string, string>,
  numbers?: NumberFormatting
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const l of walkLayers([...template.front, ...template.back])) {
    if (l.type !== 'image') continue
    const src = l.source
    const column = src.kind === 'column' && src.column ? src.column : l.name
    const raw =
      src.kind === 'formula'
        ? evaluateFormula(src.expr, fields, formulaNumbers(numbers)).value
        : src.kind === 'fixed'
          ? l.src
          : (fields[column] ?? l.src)
    const value = unbrace(substituteFields(raw, fields))
    if (!value || /[{}]/.test(value)) continue
    out[l.name] = value
    if (src.kind === 'column') out[column] ??= value
  }
  return out
}

/**
 * Sostituisce {campo} con il valore della riga e, in {icona*campo}, il campo con il suo valore;
 * le altre graffe restano per le variabili e le immagini. Con `images` (vedi imageFields) i
 * campi immagine diventano l'immagine: {img} e {img*3} disegnano l'immagine del campo img.
 */
export function substituteFields(
  text: string,
  fields: Record<string, string>,
  images: Record<string, string> = {}
): string {
  const has = (name: string): boolean => Object.prototype.hasOwnProperty.call(fields, name.trim())
  const image = (name: string): string | undefined =>
    Object.prototype.hasOwnProperty.call(images, name.trim()) ? images[name.trim()] : undefined
  return (
    text
      // font={titoli}: nel markup gli spazi del nome diventano _ (font=Open_Sans)
      .replace(/\bfont=\{([^{}*\s]+)\}/g, (m, name: string) =>
        has(name) ? `font=${fields[name.trim()].trim().replace(/\s+/g, '_')}` : m
      )
      .replace(/(?<!\\)\{([^{}*]+)\}/g, (m, inner: string) => {
        const img = image(inner)
        if (img !== undefined) return `{${img}}`
        if (has(inner)) return fields[inner.trim()]
        // {icona tint=red}: il campo dà il nome dell'immagine, gli attributi restano
        const at = inner.trim().search(/\s/)
        const name = at > 0 ? inner.trim().slice(0, at) : ''
        return name && (image(name) ?? has(name)) && parseImageAttrs(inner.trim().slice(at))
          ? `{${image(name) ?? unbrace(fields[name])}${inner.trim().slice(at)}}`
          : m
      })
      // {spada*{quanti}} è già diventato {spada*quanti} se quanti è un campo
      .replace(
        /(?<!\\)\{([^{}*]+)\*([^{}*\s]+)(\s[^{}]*)?\}/g,
        (m, name: string, count: string, rest?: string) => {
          const n = has(count) ? fields[count.trim()].trim() : count
          // {img*3}: il nome può essere un campo che dà un'immagine; i suoi attributi
          // ({spada tint=red}) vanno dopo il numero
          const ref = image(name) ?? (has(name) ? unbrace(fields[name.trim()]) : name)
          const at = ref.search(/\s/)
          const [base, attrs] = at > 0 ? [ref.slice(0, at), ref.slice(at)] : [ref, '']
          const out = `{${base}*${n}${attrs}${rest ?? ''}}`
          return /[{}]/.test(base) || !base ? m : out
        }
      )
  )
}

/**
 * Colore di una proprietà: {campo} prende il valore del campo della carta (per esempio un
 * livello valore calcolato), poi i nomi della tavolozza diventano il loro valore. Come nei
 * testi, un campo vince su una variabile con lo stesso nome; un campo vuoto non colora.
 */
export function paintColor(
  color: string,
  pal: Record<string, string>,
  fields: Record<string, string> = {}
): string {
  const m = /^\{([^{}]+)\}$/.exec(color.trim())
  const name = m?.[1].trim()
  if (name !== undefined && Object.prototype.hasOwnProperty.call(fields, name)) {
    const v = fields[name].trim()
    return v ? resolveColor(v, pal) : 'transparent'
  }
  return resolveColor(color, pal)
}

/** Colori del livello con campi e nomi della tavolozza del progetto sostituiti dal loro valore */
function paintLayer(
  l: Layer,
  pal: Record<string, string>,
  fields: Record<string, string> = {}
): Layer {
  if (!Object.keys(pal).length && !Object.keys(fields).length) return l
  const paint = (c: string): string => paintColor(c, pal, fields)
  const stroke = (s: Stroke | null): Stroke | null => s && { ...s, color: paint(s.color) }
  const shadow = l.shadow && { ...l.shadow, color: paint(l.shadow.color) }
  switch (l.type) {
    case 'text':
      return { ...l, shadow, color: paint(l.color), stroke: stroke(l.stroke) }
    case 'shape':
      return {
        ...l,
        shadow,
        fill: l.fill && (isGradient(l.fill) ? mapGradientColors(l.fill, paint) : paint(l.fill)),
        stroke: stroke(l.stroke)
      }
    case 'image':
      return {
        ...l,
        shadow,
        tint: l.tint && paint(l.tint),
        stroke: stroke(l.stroke),
        ...(l.backdrop
          ? { backdrop: { ...l.backdrop, color: l.backdrop.color && paint(l.backdrop.color) } }
          : {})
      }
    case 'grid':
      return {
        ...l,
        shadow,
        fill: l.fill && (isGradient(l.fill) ? mapGradientColors(l.fill, paint) : paint(l.fill)),
        stroke: stroke(l.stroke),
        ...(l.looks && {
          looks: l.looks.map((k) => ({
            ...k,
            fill: k.fill && (isGradient(k.fill) ? mapGradientColors(k.fill, paint) : paint(k.fill)),
            stroke: stroke(k.stroke)
          }))
        }),
        background:
          l.background &&
          (isGradient(l.background) ? mapGradientColors(l.background, paint) : paint(l.background)),
        border: stroke(l.border)
      }
    default:
      return { ...l, shadow }
  }
}

const NULLABLE = new Set([
  'fill',
  'tint',
  'style',
  'stroke',
  'shadow',
  'crop',
  'background',
  'border'
])

/** Converte il testo di una cella nel tipo della proprietà, usando il valore attuale come guida */
const PERCENT = new Set(['zoom', 'opacity', 'cellRatio'])

export function parseValue(key: string, current: unknown, raw: string): unknown {
  const v = raw.trim()
  // lo snap point si imposta nel template, non da una cella
  if (key === 'snap') return undefined
  if (NULLABLE.has(key) && v.toLowerCase() === 'none') return null
  if (key === 'stroke' || key === 'border') return parseStroke(v)
  if (key === 'shadow') return parseShadow(v)
  if (key === 'crop') return parseCrop(v)
  if (typeof current === 'number') {
    // zoom e opacità si possono scrivere anche in percentuale: 120% = 1.2
    if (PERCENT.has(key) && v.endsWith('%')) {
      const p = Number(v.slice(0, -1).trim().replace(',', '.'))
      return Number.isFinite(p) ? p / 100 : undefined
    }
    const n = Number(v.replace(',', '.'))
    return Number.isFinite(n) ? n : undefined
  }
  if (typeof current === 'boolean') {
    const s = v.toLowerCase()
    if (['true', 'yes', 'y', '1', 'x', 'sì', 'si'].includes(s)) return true
    if (['false', 'no', 'n', '0'].includes(s)) return false
    return undefined
  }
  return v
}

/** "colore/spessore/tratteggio", spessore in mm o in %, tratteggio dashed o dotted */
function parseStroke(v: string): Stroke | undefined {
  const [color, width, style] = v.split('/').map((p) => p.trim())
  if (!color) return undefined
  const dash: Pick<Stroke, 'dash'> = style === 'dashed' || style === 'dotted' ? { dash: style } : {}
  if (width === undefined || width === '') return { color, width: 0.3, ...dash }
  if (width.endsWith('%')) return { color, width, ...dash }
  const n = Number(width.replace(',', '.'))
  return Number.isFinite(n) ? { color, width: n, ...dash } : undefined
}

/** "colore/sfocatura/dx/dy" in mm */
function parseShadow(v: string): Shadow | undefined {
  const [color, ...nums] = v.split('/').map((p) => p.trim())
  const [blur = 0.5, dx = 0.3, dy = 0.3] = nums.map((n) => Number(n.replace(',', '.')))
  if (!color || [blur, dx, dy].some((n) => !Number.isFinite(n))) return undefined
  return { color, blur, dx, dy }
}
