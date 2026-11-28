// Conversione di un progetto Tabletop Creator (cartella di JSON) nel
// formato di Stella: blueprint → template, set → fogli, variabili → variabili del progetto.
// Qui solo la conversione dei dati; la lettura dei file e la copia delle immagini stanno in
// src/main/import/ttc.ts. Ciò che non si può riprodurre finisce nelle note dell'importazione.

import { msg, type Message } from '../messages'
import { ATTRIBUTES } from '../model/markup'
import type { RawLayer, RawTemplate } from '../model/normalize'
import { isValidTemplateName } from '../model/normalize'
import { isValidSheetName } from '../model/sheet'
import type { Variable, Variables } from '../model/variables'
import { FORMAT_VERSION, type ProjectFile, type Sheet } from '../project'
import { resolveAsset } from '../model/assets'
import { MM_TO_PT, convertRichText } from './richText'

type Json = Record<string, unknown>

export interface TtcFiles {
  project?: unknown
  /** Contenuto dei file data/blueprints/*.json */
  blueprints: unknown[]
  /** Contenuto dei file data/sets/*.json */
  sets: unknown[]
  variables?: unknown
}

export interface TtcImport {
  file: ProjectFile
  templates: RawTemplate[]
  sheets: Sheet[]
  /** Icone della libreria interna di Tabletop Creator richiamate dal progetto: "Categoria/nome" */
  libraryIcons: string[]
  notes: Message[]
}

/** Cartella di assets/ in cui vanno le icone della libreria di Tabletop Creator */
export const LIBRARY_FOLDER = 'library'

/**
 * I JSON di Tabletop Creator possono contenere a capo e tabulazioni non protetti dentro le
 * stringhe, che JSON.parse rifiuta: si proteggono prima di leggerli.
 */
export function parseTtcJson(text: string): unknown {
  let out = ''
  let inString = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (c === '\\') {
        out += c + (text[i + 1] ?? '')
        i++
        continue
      }
      if (c === '"') inString = false
      else if (c < ' ') {
        out += c === '\n' ? '\\n' : c === '\r' ? '\\r' : c === '\t' ? '\\t' : ''
        continue
      }
    } else if (c === '"') inString = true
    out += c
  }
  return JSON.parse(out)
}

// ——— valori ———

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

function num(v: unknown): number | undefined {
  if (typeof v === 'number') return v
  if (typeof v !== 'string' || v.trim() === '') return undefined
  const n = Number(v.trim())
  return Number.isFinite(n) ? n : undefined
}

const bool = (v: unknown): boolean | undefined =>
  v === true || v === 'True' || v === 'true'
    ? true
    : v === false || v === 'False'
      ? false
      : undefined

function pair(v: unknown): [number, number] | undefined {
  if (typeof v !== 'string') return undefined
  const p = v.split(',').map((x) => Number(x.trim()))
  return p.length === 2 && p.every(Number.isFinite) ? [p[0], p[1]] : undefined
}

const r3 = (n: number): number => Math.round(n * 1000) / 1000

/** #RRGGBBAA di Tabletop Creator: senza trasparenza diventa #RRGGBB, del tutto trasparente null */
function color(v: unknown): string | null | undefined {
  const s = str(v)?.trim()
  if (!s) return undefined
  const m = s.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i)
  if (!m) return s
  const alpha = m[2]?.toUpperCase()
  if (alpha === '00') return null
  return '#' + m[1].toUpperCase() + (alpha && alpha !== 'FF' ? alpha : '')
}

const isWhite = (c: string | null | undefined): boolean => !!c && /^#FFFFFF$/i.test(c)

// ——— nomi ———

/** I nomi dei livelli sono anche intestazioni di colonna: niente punti */
const cleanName = (s: string): string => s.trim().replace(/\./g, '_') || 'layer'

function unique(name: string, taken: Set<string>): string {
  let out = name
  for (let n = 2; taken.has(out); n++) out = `${name}_${n}`
  taken.add(out)
  return out
}

/** Nome di file valido per il template: senza i caratteri vietati */
const fileSafe = (s: string): string =>
  s
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/^\./, '_')
    .trim() || 'template'

// ——— variabili e riferimenti {nome} ———

interface Context {
  notes: Message[]
  /** File di assets/ del progetto, percorsi relativi */
  assets: string[]
  /** Codice delle variabili di Tabletop Creator → nome della variabile in Stella */
  rename: Map<string, string>
  variables: Variables
  library: Set<string>
  /** Tag del testo non convertiti, per nota */
  unsupportedTags: Set<string>
  /** Nomi già usati da livelli e variabili: una variabile non può avere il nome di un campo */
  reserved: Set<string>
}

/** "Categoria/nome" della libreria interna, quando non è un file del progetto */
function libraryRef(name: string, ctx: Context): string | null {
  const n = name.trim()
  if (!/^[^/{}]+\/[^/{}]+$/.test(n) || n.split('/').some((s) => /^\.+$/.test(s))) return null
  if (resolveAsset(n, ctx.assets).ok) return null
  ctx.library.add(n)
  return `${LIBRARY_FOLDER}/${n}`
}

/** Sorgente di un'immagine: un file del progetto, un'icona della libreria o una variabile */
function imageSource(value: string, ctx: Context): string {
  const v = value.trim()
  const ref = v.match(/^\{([^{}]+)\}$/)
  if (ref) return `{${refName(ref[1], ctx)}}`
  return libraryRef(v, ctx) ?? v
}

/**
 * Nome con cui si richiama {codice}: la variabile rinominata, oppure una variabile creata per
 * un'icona richiamata direttamente (per esempio {Gui/check-mark}).
 */
function refName(code: string, ctx: Context): string {
  const c = code.trim()
  const renamed = ctx.rename.get(c)
  if (renamed) return renamed
  const lib = libraryRef(c, ctx)
  const local = !lib && resolveAsset(c, ctx.assets).ok
  if (!lib && !local) return c
  // icona richiamata per nome: una variabile che prende il colore del testo, come in Tabletop Creator
  const stem = c.slice(c.lastIndexOf('/') + 1).replace(/\.[a-z0-9]+$/i, '')
  const name = unique(variableName(stem), ctx.reserved)
  ctx.variables[name] = { type: 'image', src: lib ?? c, tint: 'currentColor', scale: ICON_SCALE }
  ctx.rename.set(c, name)
  return name
}

const variableName = (s: string): string => s.replace(/[^\p{L}\p{N}_-]/gu, '_') || 'icon'

/**
 * Altezza delle icone nel testo rispetto a quelle di Stella (1.15 em): in Tabletop Creator
 * sono alte circa 0.8 em.
 */
const ICON_SCALE = 0.7

/** Testo di Tabletop Creator: tag convertiti nel markup, {codice} con i nomi delle variabili */
function convertText(value: string, ctx: Context): string {
  const r = convertRichText(value)
  r.unsupported.forEach((t) => ctx.unsupportedTags.add(t))
  return r.text.replace(/(?<!\\)\{([^{}]+)\}/g, (m, code: string) => {
    // a inizio riga {center} sono attributi del paragrafo, già convertiti
    if (/^(left|center|right|justify)$/.test(code)) return m
    return `{${refName(code, ctx)}}`
  })
}

function convertVariables(raw: unknown, ctx: Context): void {
  const list = ((raw as Json | undefined)?.variables as Json[] | undefined) ?? []
  // prima i nomi, così le variabili di testo possono richiamarsi tra loro
  for (const v of list) {
    const code = str(v.code)?.trim()
    if (!code || ctx.rename.has(code)) continue
    let name = variableName(code)
    if (ctx.reserved.has(name)) name = unique(`${name}_var`, ctx.reserved)
    else ctx.reserved.add(name)
    ctx.rename.set(code, name)
    if (name !== code) ctx.notes.push(msg('ttc.renamedVariable', { code, name }))
  }
  for (const v of list) {
    const code = str(v.code)?.trim()
    if (!code) continue
    const name = ctx.rename.get(code)!
    const replacement = str(v.replacement) ?? ''
    // una sostituzione con formattazione, spazi o altre variabili è un testo
    if (/[<{\s]/.test(replacement)) {
      ctx.variables[name] = { type: 'text', text: convertText(replacement, ctx) }
      continue
    }
    const tint = color(v.color)
    const out: Variable = {
      type: 'image',
      src: libraryRef(replacement, ctx) ?? replacement,
      // senza tinta forzata l'icona prende il colore del testo
      tint: bool(v.force_tint) ? (tint && !isWhite(tint) ? tint : null) : 'currentColor'
    }
    const scale = (num(v.image_scale) ?? 1) * ICON_SCALE
    out.scale = r3(scale)
    const offset = pair(v.image_offset)?.[1] ?? num(v.image_offset)
    if (offset) out.raise = r3(offset * 100)
    if (!out.tint) delete out.tint
    ctx.variables[name] = out
  }
}

// ——— pannelli → livelli ———

interface Panel {
  name: string
  data: Json
}

interface Group {
  name: string
  panels: Panel[]
}

function sideGroups(bp: Json, side: 'front' | 'back'): Group[] {
  const raw = (bp[`${side}_groups`] ?? bp[`${side}_layers`] ?? []) as Json[]
  return raw.map((g) => ({
    name: str(g.name) ?? 'group',
    panels: ((g.panels as Json[] | undefined) ?? []).map((p) => ({
      name: str(p.name) ?? 'panel',
      data: (p.data as Json | undefined) ?? {}
    }))
  }))
}

/**
 * Riquadro del livello. In Tabletop Creator la posizione è l'angolo del rettangolo che contiene
 * il pannello già ruotato; in Stella il livello ruota intorno al suo centro.
 */
function frame(d: Json): { x: number; y: number; w: number; h: number; rotation: number } {
  const [px, py] = pair(d.layout_position) ?? [0, 0]
  const [w, h] = pair(d.layout_size) ?? [20, 10]
  let rotation = num(d.layout_rotation) ?? 0
  rotation = ((((rotation + 180) % 360) + 360) % 360) - 180
  const rad = (rotation * Math.PI) / 180
  const bw = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad))
  const bh = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad))
  return {
    x: r3(px + bw / 2 - w / 2),
    y: r3(py + bh / 2 - h / 2),
    w: r3(w),
    h: r3(h),
    rotation: r3(rotation)
  }
}

const H_ALIGN: Record<string, string> = {
  left: 'left',
  center: 'center',
  right: 'right',
  justified: 'justify',
  justify: 'justify'
}
const V_ALIGN: Record<string, string> = {
  top: 'top',
  center: 'middle',
  middle: 'middle',
  bottom: 'bottom'
}
const FIT: Record<string, string> = {
  fill: 'cover',
  stretch: 'stretch',
  fit: 'contain',
  fitwidth: 'contain',
  fitheight: 'contain'
}

/** Valori di Tabletop Creator per i pannelli che non li indicano */
const TTC = {
  textSize: 4,
  autoMax: 10,
  autoMin: 2,
  lineHeight: 1.25
}

interface TemplateNotes {
  template: string
  unsupported: Map<string, Set<string>>
}

function note(tn: TemplateNotes, what: string, layer: string): void {
  if (!tn.unsupported.has(what)) tn.unsupported.set(what, new Set())
  tn.unsupported.get(what)!.add(layer)
}

/**
 * Proprietà del testo comuni a template e celle; per le celle `base` sono i dati del pannello
 * nel blueprint, da cui dipendono dimensione automatica e spaziatura dei paragrafi.
 */
function textProps(d: Json, base: Json = {}): RawLayer {
  const out: RawLayer = {}
  const auto = bool(d.text_autosize) ?? bool(base.text_autosize) ?? false
  const sizeMm = auto
    ? (num(d.text_size_max) ?? Math.max(num(d.text_size) ?? TTC.textSize, TTC.autoMax))
    : num(d.text_size)
  if (sizeMm !== undefined) out.size = r3(sizeMm * MM_TO_PT)
  if (d.text_autosize !== undefined) out.fit = auto ? 'shrink' : 'none'
  if (num(d.text_size_min) !== undefined) out.minSize = r3(num(d.text_size_min)! * MM_TO_PT)
  if (str(d.text_font)) out.font = str(d.text_font)
  if (bool(d.text_bold) !== undefined) out.weight = bool(d.text_bold) ? 700 : 400
  const c = color(d.color)
  if (c !== undefined) out.color = c ?? '#00000000'
  if (str(d.text_alignment_h)) out.align = H_ALIGN[str(d.text_alignment_h)!] ?? 'center'
  if (str(d.text_alignment_v)) out.valign = V_ALIGN[str(d.text_alignment_v)!] ?? 'middle'
  if (num(d.text_line_spacing) !== undefined)
    out.lineHeight = r3(Math.max(0.5, TTC.lineHeight + num(d.text_line_spacing)! / 100))
  // spaziatura in centesimi di em, nel template in millesimi
  if (num(d.text_char_spacing) !== undefined) out.letterSpacing = r3(num(d.text_char_spacing)! * 10)
  if (num(d.text_para_spacing) !== undefined) {
    const em = sizeMm ?? num(base.text_size) ?? TTC.textSize
    out.paragraphSpacing = r3((num(d.text_para_spacing)! / 100) * em)
  }
  return out
}

function convertPanel(p: Panel, name: string, ctx: Context, tn: TemplateNotes): RawLayer[] {
  const d = p.data
  const type = str(d.panel_type) ?? 'text'
  const base: RawLayer = { name, ...frame(d) }
  if (bool(d.visible) === false) base.visible = false
  switch (type) {
    case 'text': {
      const layer: RawLayer = {
        type: 'text',
        ...base,
        text: convertText(str(d.value) ?? '', ctx),
        align: 'center',
        valign: 'middle',
        size: r3(TTC.textSize * MM_TO_PT),
        lineHeight: TTC.lineHeight,
        ...textProps(d)
      }
      if (layer.fit === 'shrink' && layer.minSize === undefined)
        layer.minSize = r3(TTC.autoMin * MM_TO_PT)
      if (num(d.text_outline_size))
        layer.stroke = { color: '#000000', width: `${r3(num(d.text_outline_size)! / 10)}%` }
      if (bool(d.text_wrapping) === false) note(tn, 'ttc.unsupported.noWrap', name)
      return [layer]
    }
    case 'image':
    case 'icon': {
      const value = str(d.value) ?? ''
      const layer: RawLayer = {
        type: 'image',
        ...base,
        src: imageSource(value, ctx),
        fit: type === 'icon' ? 'contain' : (FIT[str(d.img_fit_mode) ?? 'fit'] ?? 'contain')
      }
      const tint = color(d.color)
      if (tint && !isWhite(tint)) layer.tint = tint
      if (num(d.img_zoom) !== undefined) layer.zoom = num(d.img_zoom)
      const off = pair(d.img_offset)
      if (off) [layer.offsetX, layer.offsetY] = off
      if (bool(d.img_flip_h)) layer.flipH = true
      if (bool(d.img_flip_v)) layer.flipV = true
      if (num(d.img_mask_radius)) layer.radius = num(d.img_mask_radius)
      const shadow = color(d.img_effect_shadow_color)
      if (shadow) {
        const [dx, dy] = pair(d.img_effect_shadow_offset) ?? [0.3, 0.3]
        layer.shadow = { color: shadow, blur: 0, dx, dy }
      }
      if (str(d.img_fit_mode) === 'fitwidth' || str(d.img_fit_mode) === 'fitheight')
        note(tn, 'ttc.unsupported.fitSide', name)
      if (num(d.img_rotation)) layer.imageRotation = num(d.img_rotation)
      if (str(d.img_mask_value)) note(tn, 'ttc.unsupported.mask', name)
      if (num(d.img_sliced_scale) !== undefined || d.img_sliced_border_top !== undefined)
        note(tn, 'ttc.unsupported.sliced', name)
      if (bool(d.img_mask_radius_free)) note(tn, 'ttc.unsupported.cornerRadii', name)
      const out = [layer]
      // un'icona con sfondo: un rettangolo sotto
      const bg = color(d.background_color)
      if (type === 'icon' && bg) out.push({ type: 'shape', ...base, name: `${name}_bg`, fill: bg })
      return out
    }
    case 'procedural':
      return [shapeLayer(d, base, name, tn)]
    case 'value':
      return [{ type: 'value', name, value: convertText(str(d.value) ?? '', ctx) }]
    default:
      note(tn, 'ttc.unsupported.panelType', `${name} (${type})`)
      return []
  }
}

function shapeLayer(d: Json, base: RawLayer, name: string, tn: TemplateNotes): RawLayer {
  const kind = str(d.procedural_type) ?? 'rectangle'
  const layer: RawLayer = { type: 'shape', ...base, shape: 'rect' }
  const border = num(d.procedural_border)
  const c = color(d.color)
  if (border) {
    // con il bordo, color è il bordo e background_color il riempimento; il bordo sta all'interno
    const bg = color(d.background_color)
    layer.fill = bg === undefined ? '#FFFFFF' : bg
    if (c) layer.stroke = { color: c, width: border }
  } else layer.fill = c === undefined ? '#FFFFFF' : c
  if (kind === 'circleellipse') layer.shape = 'ellipse'
  else if (kind === 'polygonstar') {
    const vertices = num(d.procedural_polygon_vertices) ?? 6
    const angle = num(d.procedural_polygon_star_angle)
    layer.shape = angle !== undefined ? 'star' : 'polygon'
    layer.sides = vertices
    if (angle !== undefined) layer.innerRatio = r3(Math.min(0.95, Math.max(0.1, angle / 180)))
    if (num(d.procedural_polygon_roundness)) note(tn, 'ttc.unsupported.roundness', name)
  } else if (kind === 'rectanglelegacy') {
    if (num(d.procedural_rectangle_legacy_falloff)) note(tn, 'ttc.unsupported.falloff', name)
  }
  const radius = num(d.procedural_rectangle_radius)
  if (radius && layer.shape === 'rect') layer.radius = radius
  if (bool(d.procedural_rectangle_radius_free)) note(tn, 'ttc.unsupported.cornerRadii', name)
  if (border && layer.stroke) {
    // il contorno di Stella è centrato sul bordo: si rientra di metà spessore
    const half = border / 2
    layer.x = r3((base.x as number) + half)
    layer.y = r3((base.y as number) + half)
    layer.w = r3(Math.max(0, (base.w as number) - border))
    layer.h = r3(Math.max(0, (base.h as number) - border))
    if (layer.radius) layer.radius = r3(Math.max(0, (layer.radius as number) - half))
  }
  return layer
}

// ——— blueprint → template ———

interface ConvertedTemplate {
  raw: RawTemplate
  /** Nome del pannello di Tabletop Creator → livello e tipo di pannello */
  panels: Map<string, { layer: string; type: string; data: Json }>
}

function convertBlueprint(bp: Json, ctx: Context, takenFiles: Set<string>): ConvertedTemplate {
  const ttcName = str(bp.name) ?? 'template'
  const name = isValidTemplateName(ttcName) ? ttcName : fileSafe(ttcName)
  const file = unique(fileSafe(name), takenFiles)
  const tn: TemplateNotes = { template: name, unsupported: new Map() }
  const [width, height] = pair(bp.layout_size_mm) ?? [63, 88]
  const shape = (bp.shape_settings as Json | undefined) ?? {}
  if (str(shape.shape) && str(shape.shape) !== 'rectangle')
    note(tn, 'ttc.unsupported.cardShape', name)

  const names = new Set<string>()
  const panels = new Map<string, { layer: string; type: string; data: Json }>()
  // prima i nomi dei pannelli, che sono anche le colonne: i gruppi si adattano a loro
  const all = [...sideGroups(bp, 'front'), ...sideGroups(bp, 'back')]
  for (const g of all)
    for (const p of g.panels) {
      const layer = unique(cleanName(p.name), names)
      panels.set(p.name, { layer, type: str(p.data.panel_type) ?? 'text', data: p.data })
    }
  const side = (s: 'front' | 'back'): RawLayer[] =>
    sideGroups(bp, s).map((g) => ({
      type: 'group',
      name: unique(cleanName(g.name), names),
      children: g.panels.flatMap((p) => convertPanel(p, panels.get(p.name)!.layer, ctx, tn))
    }))
  const front = side('front')
  const back = side('back')
  const main = str(bp.main_panel_name)
  const raw: RawTemplate = {
    name,
    ...(file !== name ? { file } : {}),
    width,
    height,
    bleed: num(bp.bleeding_size_mm) ?? 0,
    safeMargin: 3,
    cornerRadius: num(shape.radius) ?? 3,
    ...(main && panels.has(main) ? { labelField: panels.get(main)!.layer } : {}),
    front,
    back
  }
  for (const [what, layers] of tn.unsupported)
    ctx.notes.push(msg(what, { template: name, layers: [...layers].join(', ') }))
  return { raw, panels }
}

// ——— set → foglio ———

function convertSet(set: Json, tpl: ConvertedTemplate, sheetName: string, ctx: Context): Sheet {
  const headers: string[] = ['amount']
  const rows: Record<string, string>[] = []
  const unsupported = new Set<string>()
  const add = (row: Record<string, string>, header: string, value: string): void => {
    if (!headers.includes(header)) headers.push(header)
    row[header] = value
  }
  for (const item of (set.items as Json[] | undefined) ?? []) {
    const row: Record<string, string> = { amount: String(num(item.amount) ?? 1) }
    for (const det of (item.details as Json[] | undefined) ?? []) {
      const panel = tpl.panels.get(str(det.name) ?? '')
      if (!panel) continue
      const d = (det.data as Json | undefined) ?? {}
      const L = panel.layer
      for (const [k, v] of Object.entries(d)) {
        const cell = cellFor(panel.type, panel.data, k, v, d, ctx)
        if (cell === null) unsupported.add(`${L}.${k}`)
        else for (const [suffix, value] of cell) add(row, suffix ? `${L}.${suffix}` : L, value)
      }
    }
    rows.push(row)
  }
  if (unsupported.size)
    ctx.notes.push(
      msg('ttc.unsupportedCells', {
        set: str(set.name) ?? sheetName,
        fields: [...unsupported].join(', ')
      })
    )
  // ordine delle colonne: amount, poi i livelli nell'ordine del template
  const order = [...tpl.panels.values()].map((p) => p.layer)
  const rank = (h: string): number => {
    const i = order.indexOf(h.split('.')[0])
    return i < 0 ? order.length : i
  }
  const sorted = [
    headers[0],
    ...headers.slice(1).sort((a, b) => rank(a) - rank(b) || a.length - b.length)
  ]
  return { name: sheetName, headers: sorted, rows: rows.map((r) => sorted.map((h) => r[h] ?? '')) }
}

/** Celle per una proprietà cambiata da una carta: [proprietà ('' = valore principale), valore] */
function cellFor(
  type: string,
  base: Json,
  key: string,
  v: unknown,
  d: Json,
  ctx: Context
): [string, string][] | null {
  const s = str(v) ?? String(v)
  const bordered = num(d.procedural_border ?? base.procedural_border)
  switch (key) {
    case 'value':
      if (type === 'text' || type === 'value') return [['', convertText(s, ctx)]]
      if (type === 'image' || type === 'icon') return [['', imageSource(s, ctx)]]
      return [] // il testo dei rettangoli non si vede
    case 'visible':
      return [['visible', bool(v) === false ? 'false' : 'true']]
    case 'color': {
      const c = color(v)
      if (type === 'text') return [['color', c ?? '#00000000']]
      if (type === 'image' || type === 'icon') return [['tint', c && !isWhite(c) ? c : 'none']]
      if (type === 'procedural')
        return bordered ? [['stroke', `${c ?? 'none'}/${bordered}`]] : [['', c ?? 'none']]
      return null
    }
    case 'background_color':
      return type === 'procedural' ? [['', color(v) ?? 'none']] : null
    case 'img_zoom':
      return [['zoom', s]]
    case 'img_offset': {
      const p = pair(v)
      return p
        ? [
            ['offsetX', String(p[0])],
            ['offsetY', String(p[1])]
          ]
        : null
    }
    case 'img_rotation':
      return [['imageRotation', s]]
    case 'img_flip_h':
      return [['flipH', bool(v) ? 'true' : 'false']]
    case 'img_flip_v':
      return [['flipV', bool(v) ? 'true' : 'false']]
    case 'img_fit_mode':
      return [['fit', FIT[s] ?? 'contain']]
    default: {
      if (type !== 'text' || !key.startsWith('text_')) return null
      const props = textProps(d, base)
      const out: [string, string][] = []
      for (const [k, val] of Object.entries(props)) if (k !== 'color') out.push([k, String(val)])
      // la stessa proprietà può arrivare da più chiavi della stessa carta: vale una cella
      return out.filter(([k]) => KEY_PROPS[key]?.includes(k))
    }
  }
}

/** Proprietà del livello che ciascuna chiave di testo di Tabletop Creator può cambiare */
const KEY_PROPS: Record<string, string[]> = {
  text_size: ['size'],
  text_size_max: ['size'],
  text_size_min: ['minSize'],
  text_autosize: ['fit', 'size'],
  text_font: ['font'],
  text_bold: ['weight'],
  text_alignment_h: ['align'],
  text_alignment_v: ['valign'],
  text_line_spacing: ['lineHeight'],
  text_char_spacing: ['letterSpacing'],
  text_para_spacing: ['paragraphSpacing']
}

// ——— progetto ———

export function convertTtcProject(files: TtcFiles, assets: string[]): TtcImport {
  const notes: Message[] = []
  // l'ordine dell'elenco in Tabletop Creator
  const byHint = (a: Json, b: Json): number =>
    (num(a.hint_order_index) ?? 0) - (num(b.hint_order_index) ?? 0)
  const blueprints = files.blueprints
    .flatMap((f) => ((f as Json)?.blueprints as Json[]) ?? [])
    .sort(byHint)
  const sets = files.sets.flatMap((f) => ((f as Json)?.sets as Json[]) ?? []).sort(byHint)
  // i nomi di livelli e attributi non possono essere nomi di variabile: {nome} sarebbe il campo
  const reserved = new Set<string>(Object.keys(ATTRIBUTES))
  for (const bp of blueprints)
    for (const s of ['front', 'back'] as const)
      for (const g of sideGroups(bp, s)) {
        reserved.add(cleanName(g.name))
        g.panels.forEach((p) => reserved.add(cleanName(p.name)))
      }
  const ctx: Context = {
    notes,
    assets,
    rename: new Map(),
    variables: {},
    library: new Set(),
    unsupportedTags: new Set(),
    reserved
  }
  convertVariables(files.variables, ctx)

  const takenFiles = new Set<string>()
  const templates = new Map<string, ConvertedTemplate>()
  for (const bp of blueprints) {
    const t = convertBlueprint(bp, ctx, takenFiles)
    templates.set(str(bp.name) ?? t.raw.name, t)
  }

  const sheets: Sheet[] = []
  const setDefs: ProjectFile['sets'] = []
  const sheetNames = new Set<string>()
  for (const set of sets) {
    const name = str(set.name) ?? 'set'
    const tpl = templates.get(str(set.blueprint_name) ?? '')
    if (!tpl) {
      notes.push(
        msg('ttc.missingBlueprint', { set: name, blueprint: str(set.blueprint_name) ?? '' })
      )
      continue
    }
    const sheetName = unique(sheetNameFor(name), sheetNames)
    sheets.push(convertSet(set, tpl, sheetName, ctx))
    setDefs.push({
      name,
      template: tpl.raw.name,
      ...(sheetName !== name ? { sheet: sheetName } : {})
    })
  }
  if (ctx.unsupportedTags.size)
    notes.push(
      msg('ttc.unsupportedTags', { tags: [...ctx.unsupportedTags].map((t) => `<${t}>`).join(' ') })
    )

  const info = ((files.project as Json | undefined)?.project_info as Json | undefined) ?? {}
  const file: ProjectFile = {
    formatVersion: FORMAT_VERSION,
    name: str(info.name) ?? 'Tabletop Creator',
    dataFile: 'data/cards.xlsx',
    sets: setDefs,
    ...(Object.keys(ctx.variables).length ? { variables: ctx.variables } : {})
  }
  return {
    file,
    templates: [...templates.values()].map((t) => t.raw),
    sheets,
    libraryIcons: [...ctx.library].sort(),
    notes
  }
}

/** Nome del foglio: Excel accetta al massimo 31 caratteri e non tutti i simboli */
function sheetNameFor(name: string): string {
  if (isValidSheetName(name)) return name
  return (
    name
      .replace(/[[\]:*?/\\]/g, '_')
      .slice(0, 31)
      .trim() || 'set'
  )
}
