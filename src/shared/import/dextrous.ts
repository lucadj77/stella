// Conversione di un progetto Dextrous (dextrous.com.au) nel formato di Stella. Dextrous è
// un'app web: dal menu si scaricano il JSON del progetto (componenti e righe), il JSON di ogni
// layout (le zone della carta, in CSS) e le cartelle di immagini (ZIP). Il JSON del progetto
// richiama i layout solo con un id: `requirements` dice quali file servono, `convertDextrous`
// converte con quelli che ci sono. Qui solo la conversione dei dati; la lettura dei file e la
// copia delle immagini stanno in src/main/import/dextrous.ts.
//
// Corrispondenze:
// - componente (cardTypeArray) → template e set con lo stesso nome; token → segnalino
// - zona del layout → livello: immagine, testo, e sotto una forma per sfondo e bordo
// - colonne iN (immagine), tN (testo) della zona N → colonna del livello; sN (stile) → visibilità
// - _copies → amount, _nickname → livello valore "name" (il nome delle carte)
// - retro "same as front" → retro uguale al fronte; "unique cards" → livelli del retro con le
//   righe dei retri nella stessa riga; un retro solo → valori del template
// - inlineClasses → stili del progetto; {file.png} nel testo → variabile immagine
// Le misure sono px CSS a 96 dpi.

import { msg, type Message } from '../messages'
import { ATTRIBUTES } from '../model/markup'
import { assetRefName, resolveAsset } from '../model/assets'
import { isValidTemplateName, type RawLayer, type RawTemplate } from '../model/normalize'
import { isValidSheetName } from '../model/sheet'
import type { Variables } from '../model/variables'
import { mapGradientColors, parseGradient } from '../model/gradient'
import type { ComponentKind } from '../model/template'
import { FORMAT_VERSION, type ProjectFile, type Sheet } from '../project'
import { htmlToMarkup } from './nandeck/html'

type Json = Record<string, unknown>

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
const obj = (v: unknown): Json =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {}
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const r3 = (n: number): number => Math.round(n * 1000) / 1000

/** px CSS → mm */
export const PX_TO_MM = 25.4 / 96
const mm = (px: number): number => r3(px * PX_TO_MM)

// ——— riconoscere i file ———

/** È il JSON di un progetto Dextrous */
export const isDextrousProject = (v: unknown): boolean => Array.isArray(obj(v).cardTypeArray)
/** È il JSON di un layout Dextrous */
export const isDextrousLayout = (v: unknown): boolean =>
  !!obj(obj(v).layoutData).style || Array.isArray(obj(obj(v).layoutData).childZones)

/** Id e nome di un layout */
export function layoutInfo(v: unknown): { id: string; name: string } {
  const o = obj(v)
  return { id: str(o.id) ?? '', name: str(o.name) ?? '' }
}

// ——— componenti ———

interface Component {
  id: string
  name: string
  kind: ComponentKind
  json: Json
  frontLayout: string
  backLayout: string | null
  backType: string
  rows: Json[]
  backRows: Json[]
}

function components(project: Json): Component[] {
  const names = new Map<string, string>()
  for (const r of arr(project.componentReferencesArray)) {
    const o = obj(r)
    if (str(o.id)) names.set(str(o.id)!, str(o.name) ?? '')
  }
  const taken = new Set<string>()
  return arr(project.cardTypeArray).map((raw, i) => {
    const c = obj(raw)
    const id = str(c.id) ?? String(i)
    const backs = obj(c.backs)
    const ddd = obj(c.DDD)
    const type = str(ddd.componentType) ?? ''
    const kind: ComponentKind =
      type === 'token' ? 'token' : type === 'tile' ? 'tile' : type === 'board' ? 'board' : 'card'
    const base =
      names.get(id)?.trim() ||
      str(c.TTSNickName)?.trim() ||
      str(c.name)?.trim() ||
      `component ${i + 1}`
    return {
      id,
      name: unique(fileSafe(base), taken),
      kind,
      json: c,
      frontLayout: str(c.layoutDocID) ?? '',
      backLayout: str(backs.layoutDocID) ?? null,
      backType: str(backs.type) ?? '',
      rows: arr(c.cards).map((r) => obj(obj(r).data)),
      backRows: arr(backs.cards).map((r) => obj(obj(r).data))
    }
  })
}

const sameAsFront = (type: string): boolean => /same\s*as\s*front/i.test(type)
const noBack = (type: string): boolean => /^(none|no\s*backs?)$/i.test(type.trim())

/** Retro con il suo layout e le sue righe */
const hasOwnBack = (c: Component): boolean =>
  !!c.backLayout && !sameAsFront(c.backType) && !noBack(c.backType)

// ——— immagini richieste ———

/** Nome breve di un percorso, senza cartella */
const baseName = (p: string): string => p.slice(p.replace(/\\/g, '/').lastIndexOf('/') + 1)

/** Le icone nel testo: {albero.png} */
const ICON_RE = /\{([^{}\s][^{}]*\.(?:png|jpe?g|webp|svg|gif))\}/gi

export interface ImageRef {
  /** Come lo scrive Dextrous: "i1.png" o "sogni/sfondo.png" */
  name: string
  /** Cartella di Dextrous in cui sta: quella scritta o quella della colonna; '' = nessuna */
  folder: string
}

/** Immagini richiamate da righe, retri e layout, con la loro cartella */
function imageRefs(c: Component, layouts: Map<string, Json>): ImageRef[] {
  const out: ImageRef[] = []
  const add = (value: string, folder: string): void => {
    const v = value.trim()
    if (!v || /^https?:/i.test(v)) return
    const slash = v.replace(/\\/g, '/').lastIndexOf('/')
    out.push({ name: v, folder: slash >= 0 ? v.slice(0, slash) : folder })
  }
  const scan = (rows: Json[], folders: Json): void => {
    for (const row of rows)
      for (const [k, v] of Object.entries(row)) {
        const s = typeof v === 'string' ? v : ''
        if (/^i\d+$/.test(k)) add(s, str(folders[k]) ?? '')
        else if (/^t\d+$/.test(k))
          for (const m of s.matchAll(ICON_RE)) add(m[1], str(folders[k]) ?? '')
      }
  }
  scan(c.rows, obj(c.json.defaultImageFolders))
  if (hasOwnBack(c)) scan(c.backRows, obj(obj(c.json.backs).defaultImageFolders))
  for (const id of [c.frontLayout, hasOwnBack(c) ? c.backLayout : null]) {
    const layout = id ? layouts.get(id) : undefined
    if (!layout) continue
    const walk = (z: Json): void => {
      // solo le zone fisse: nelle altre l'immagine del layout è un'anteprima dell'editor
      if (z.isStatic === true && str(z.image)) add(str(z.image)!, str(z.imageFolder) ?? '')
      for (const m of (str(z.text) ?? '').matchAll(ICON_RE)) add(m[1], '')
      arr(z.childZones).forEach((ch) => walk(obj(ch)))
    }
    walk(obj(obj(layout).layoutData))
  }
  return out
}

// ——— cosa serve ———

export interface DextrousRequirements {
  title: string
  components: {
    name: string
    kind: ComponentKind
    cards: number
    /** Layout del fronte e, se ha un retro suo, del retro */
    layouts: { side: 'front' | 'back'; id: string; found: string | null }[]
  }[]
  /** Cartelle di immagini di Dextrous, con le immagini richieste e quelle trovate */
  folders: { name: string; images: number; found: number; missing: string[] }[]
}

/**
 * Cosa serve per importare il progetto: i layout dei componenti (trovati o no tra quelli dati)
 * e le cartelle di immagini, con le immagini trovate tra `available` (percorsi qualsiasi: si
 * confronta il nome del file).
 */
export function requirements(
  projectJson: unknown,
  layoutsJson: unknown[],
  available: string[]
): DextrousRequirements {
  const project = obj(projectJson)
  const layouts = layoutMap(layoutsJson)
  const names = new Set(available.map((a) => baseName(a).toLowerCase()))
  const comps = components(project)
  const folders = new Map<string, { images: Set<string>; missing: Set<string> }>()
  for (const c of comps)
    for (const ref of imageRefs(c, layouts)) {
      const f = folders.get(ref.folder) ?? { images: new Set(), missing: new Set() }
      folders.set(ref.folder, f)
      const n = baseName(ref.name)
      f.images.add(n.toLowerCase())
      if (!names.has(n.toLowerCase())) f.missing.add(n)
    }
  return {
    title: str(project.title) ?? '',
    components: comps.map((c) => ({
      name: c.name,
      kind: c.kind,
      cards: c.rows.length,
      layouts: [
        { side: 'front' as const, id: c.frontLayout, found: layoutName(layouts, c.frontLayout) },
        ...(hasOwnBack(c)
          ? [
              {
                side: 'back' as const,
                id: c.backLayout!,
                found: layoutName(layouts, c.backLayout!)
              }
            ]
          : [])
      ]
    })),
    folders: [...folders.entries()]
      .map(([name, f]) => ({
        name,
        images: f.images.size,
        found: f.images.size - f.missing.size,
        missing: [...f.missing].sort()
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
}

function layoutMap(list: unknown[]): Map<string, Json> {
  const out = new Map<string, Json>()
  for (const l of list) {
    const { id } = layoutInfo(l)
    if (id && !out.has(id)) out.set(id, obj(l))
  }
  return out
}

function layoutName(layouts: Map<string, Json>, id: string): string | null {
  const l = layouts.get(id)
  return l ? str(l.name) || id : null
}

// ——— CSS ———

/** Numero in px: "96px", 96, "1.5em" (con la base) */
function px(v: unknown, em = 16): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined
  const s = str(v)?.trim()
  if (!s) return undefined
  const m = s.match(/^(-?\d*\.?\d+(?:e-?\d+)?)\s*(px|em|rem|pt|%)?$/i)
  if (!m) return undefined
  const n = parseFloat(m[1])
  switch ((m[2] ?? 'px').toLowerCase()) {
    case 'em':
      return n * em
    case 'rem':
      return n * 16
    case 'pt':
      return (n * 96) / 72
    case '%':
      return undefined
    default:
      return n
  }
}

const NAMED: Record<string, string> = {
  black: '#000000',
  white: '#FFFFFF',
  red: '#FF0000',
  green: '#008000',
  blue: '#0000FF',
  yellow: '#FFFF00',
  gray: '#808080',
  grey: '#808080',
  orange: '#FFA500',
  purple: '#800080'
}

const hex2 = (n: number): string =>
  Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, '0')
    .toUpperCase()

/** Colore CSS → #RRGGBB o #RRGGBBAA; null se del tutto trasparente, undefined se non è un colore */
export function cssColor(v: unknown): string | null | undefined {
  const s = str(v)?.trim().toLowerCase()
  if (!s) return undefined
  if (s === 'transparent' || s === 'none') return null
  if (NAMED[s]) return NAMED[s]
  const h = s.match(/^#([0-9a-f]{3,8})$/)
  if (h) {
    let x = h[1]
    if (x.length === 3 || x.length === 4) x = [...x].map((c) => c + c).join('')
    if (x.length === 8 && x.endsWith('00')) return null
    return '#' + (x.length === 8 && x.endsWith('ff') ? x.slice(0, 6) : x).toUpperCase()
  }
  const m = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/)
  if (!m) return undefined
  let a = m[4] === undefined ? 1 : parseFloat(m[4])
  if (m[4]?.endsWith('%')) a /= 100
  if (a <= 0) return null
  const rgb = '#' + hex2(+m[1]) + hex2(+m[2]) + hex2(+m[3])
  return a >= 1 ? rgb : rgb + hex2(a * 255)
}

/** La sfumatura dentro un `background` CSS, con i colori di Stella */
function cssGradient(v: string): string | null {
  const start = v.search(/(linear|radial)-gradient\(/i)
  if (start < 0) return null
  let depth = 0
  let end = -1
  for (let i = v.indexOf('(', start); i < v.length; i++) {
    if (v[i] === '(') depth++
    if (v[i] === ')' && --depth === 0) {
      end = i
      break
    }
  }
  if (end < 0) return null
  // le forme e le posizioni del radiale ("circle at 30% 40%") Stella non le ha: si tolgono
  let g = v
    .slice(start, end + 1)
    .replace(
      /^radial-gradient\(\s*(?:(?:circle|ellipse|closest|farthest)[^,]*?|at [^,]*?),/i,
      'radial-gradient('
    )
  g = mapGradientColors(g, (c) => cssColor(c) ?? '#00000000')
  return parseGradient(g) ? g : null
}

/** Riempimento da `background` / `backgroundColor`: colore, sfumatura, o null */
function fillOf(style: Json): string | null {
  const bg = str(style.background) ?? ''
  const g = cssGradient(bg)
  if (g) return g
  const color = cssColor(str(style.backgroundColor)) ?? cssColor(bg.split(/\s+(?![^(]*\))/)[0])
  return color ?? null
}

/** Punti di un clip-path polygon(), in frazioni del riquadro */
function polygon(v: string, w: number, h: number): [number, number][] | null {
  const m = v.match(/^\s*polygon\(([\s\S]*)\)\s*$/i)
  if (!m) return null
  const pts: [number, number][] = []
  for (const p of m[1].split(',')) {
    const xy = p.trim().split(/\s+/)
    if (xy.length !== 2) return null
    const c = xy.map((s, i) =>
      s.endsWith('%') ? parseFloat(s) / 100 : (px(s) ?? NaN) / (i ? h : w)
    )
    if (c.some((n) => !Number.isFinite(n))) return null
    pts.push([c[0], c[1]])
  }
  return pts.length >= 3 ? pts : null
}

/** Il poligono è un cerchio (o un'ellisse) disegnato con molti punti */
const isRound = (pts: [number, number][]): boolean =>
  pts.length >= 12 && pts.every(([x, y]) => Math.abs(Math.hypot(x - 0.5, y - 0.5) - 0.5) < 0.02)

const pathOf = (pts: [number, number][]): string =>
  'M ' + pts.map(([x, y]) => `${r3(x)} ${r3(y)}`).join(' L ') + ' Z'

/** Forma del ritaglio di una zona */
type Clip = { kind: 'ellipse' } | { kind: 'path'; path: string } | null

function clipOf(style: Json, w: number, h: number): Clip | 'unknown' {
  const c = str(style.clipPath)?.trim()
  if (c && c !== 'none') {
    if (/^(circle|ellipse)\(/i.test(c)) return { kind: 'ellipse' }
    const pts = polygon(c, w, h)
    if (!pts) return 'unknown'
    return isRound(pts) ? { kind: 'ellipse' } : { kind: 'path', path: pathOf(pts) }
  }
  const r = px(str(style.borderRadius)?.trim().split(/\s+/)[0])
  if (r !== undefined && r >= Math.min(w, h) / 2 - 0.5 && w > 0) return { kind: 'ellipse' }
  return null
}

/** Raggio degli angoli in px (il primo dei quattro) */
const radiusOf = (style: Json): number => px(str(style.borderRadius)?.trim().split(/\s+/)[0]) ?? 0

/** Bordo (border) o contorno (outline, con lo stile impostato): spessore, colore, rientro in px */
function edgeOf(
  style: Json
): { width: number; color: string; inset: number; dash?: 'dashed' | 'dotted' } | null {
  const border = (prefix: 'border' | 'outline'): typeof out => {
    const kind = str(style[`${prefix}Style`])?.trim().toLowerCase()
    const width = px(style[`${prefix}Width`])
    const color = cssColor(style[`${prefix}Color`]) ?? '#000000'
    if (!kind || kind === 'none' || kind === 'hidden' || !width) return null
    const dash = kind === 'dashed' || kind === 'dotted' ? kind : undefined
    // il bordo sta dentro il riquadro; il contorno fuori, spostato di outlineOffset
    const offset = prefix === 'outline' ? (px(style.outlineOffset) ?? 0) : -width
    return { width, color, inset: -(offset + width / 2), ...(dash ? { dash } : {}) }
  }
  let out: { width: number; color: string; inset: number; dash?: 'dashed' | 'dotted' } | null = null
  out = border('border') ?? border('outline')
  return out
}

// ——— testo ———

interface TextContext {
  styles: Map<string, string>
  variables: Variables
  /** Nomi già usati da livelli, attributi e variabili */
  reserved: Set<string>
  /** Immagine richiamata → variabile */
  icons: Map<string, string>
  unsupportedTags: Set<string>
  image(name: string, folder: string): string
}

/** HTML di Dextrous → markup di Stella; le icone {file.png} diventano variabili immagine */
function convertText(html: string, ctx: TextContext, folder = ''): string {
  if (!html) return ''
  const r = htmlToMarkup(html, ctx.styles)
  r.unsupported.forEach((t) => ctx.unsupportedTags.add(t))
  return r.text.replace(ICON_RE, (_, file: string) => `{${iconVariable(file, folder, ctx)}}`)
}

function iconVariable(file: string, folder: string, ctx: TextContext): string {
  const key = file.toLowerCase()
  const known = ctx.icons.get(key)
  if (known) return known
  const stem = baseName(file).replace(/\.[a-z0-9]+$/i, '')
  const name = unique(stem.replace(/[^\p{L}\p{N}_-]/gu, '_') || 'icon', ctx.reserved)
  ctx.variables[name] = { type: 'image', src: ctx.image(file, folder), tint: null }
  ctx.icons.set(key, name)
  return name
}

/** Stile CSS di una classe di testo → attributi del markup */
function styleAttributes(style: Json): string {
  const out: string[] = []
  const size = str(style.fontSize)?.trim()
  if (size) {
    const em = size.match(/^([\d.]+)\s*em$/i)
    const pct = size.match(/^([\d.]+)\s*%$/)
    if (em) out.push(`size=${Math.round(parseFloat(em[1]) * 100)}%`)
    else if (pct) out.push(`size=${Math.round(parseFloat(pct[1]))}%`)
    else if (px(size) !== undefined) out.push(`size=${r3(px(size)! * 0.75)}`)
  }
  const color = cssColor(style.color)
  if (color) out.push(`color=${color}`)
  const font = fontName(style)
  if (font) out.push(`font=${font.replace(/\s+/g, '_')}`)
  const weight =
    str(style.fontWeight) ?? (typeof style.fontWeight === 'number' ? String(style.fontWeight) : '')
  if (weight === 'bold' || weight === 'bolder') out.push('bold')
  else if (/^\d+$/.test(weight)) out.push(`weight=${weight}`)
  if (str(style.fontStyle) === 'italic') out.push('italic')
  const deco = str(style.textDecoration) ?? str(style.textDecorationLine) ?? ''
  if (deco.includes('underline')) out.push('underline')
  if (deco.includes('line-through')) out.push('strike')
  const tt = str(style.textTransform)
  if (tt === 'uppercase') out.push('upper')
  if (tt === 'lowercase') out.push('lower')
  const bg = cssColor(style.backgroundColor ?? style.background)
  if (bg) out.push(`highlight=${bg}`)
  return out.join(' ')
}

function fontName(style: Json): string | undefined {
  const f = str(style.fontFamily) ?? str(style.fontName)
  const first = f
    ?.split(',')[0]
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .trim()
  return first && !/^(inherit|initial|serif|sans-serif|monospace)$/i.test(first) ? first : undefined
}

// ——— zone → livelli ———

/** Proprietà del testo che passano dalla zona madre alle figlie, come in CSS */
const INHERITED = [
  'fontFamily',
  'fontName',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'color',
  'textAlign',
  'lineHeight',
  'letterSpacing',
  'textTransform'
]

interface LayoutContext extends TextContext {
  notes: Message[]
  /** Proprietà non convertite: messaggio → livelli */
  unsupported: Map<string, Set<string>>
  fonts: Set<string>
}

interface ZoneLayers {
  /** id della zona → livello che prende i dati iN / tN */
  zones: Map<string, { name: string; type: 'image' | 'text' }>
  layers: RawLayer[]
}

function unsupported(ctx: LayoutContext, key: string, layer: string): void {
  if (!ctx.unsupported.has(key)) ctx.unsupported.set(key, new Set())
  ctx.unsupported.get(key)!.add(layer)
}

const V_ALIGN: Record<string, 'top' | 'middle' | 'bottom'> = {
  'flex-start': 'top',
  start: 'top',
  center: 'middle',
  'flex-end': 'bottom',
  end: 'bottom'
}
const H_ALIGN: Record<string, 'left' | 'center' | 'right' | 'justify'> = {
  left: 'left',
  start: 'left',
  center: 'center',
  right: 'right',
  end: 'right',
  justify: 'justify'
}

function imageFit(style: Json): { fit: string; zoom?: number } {
  const size = str(style.backgroundSize)?.trim().toLowerCase() ?? ''
  if (size === 'cover') return { fit: 'cover' }
  if (size === 'contain') return { fit: 'contain' }
  if (/^100%\s+100%$/.test(size)) return { fit: 'stretch' }
  const pct = size.match(/^([\d.]+)%(?:\s+auto)?$/)
  if (pct) return { fit: 'contain', zoom: r3(parseFloat(pct[1]) / 100) }
  if (size === 'auto' || size === '') return { fit: 'contain' }
  return { fit: 'contain' }
}

function imageAlign(style: Json): string {
  const pos = (v: unknown, a: string, b: string): string => {
    const n = parseFloat(str(v) ?? '50')
    return n <= 25 ? a : n >= 75 ? b : ''
  }
  const x = pos(style.backgroundPositionX, 'left', 'right')
  const y = pos(style.backgroundPositionY, 'top', 'bottom')
  return x && y ? `${y}-${x}` : x || y || 'center'
}

/**
 * Livelli di una zona e delle sue figlie, in coordinate della carta (mm), dal più in alto al più
 * in basso come nel pannello di Stella. `ox`, `oy` sono la posizione della zona madre in px.
 */
function zoneLayers(
  z: Json,
  ox: number,
  oy: number,
  /** Misura della zona madre in px: una zona senza misura la riempie */
  pw: number,
  ph: number,
  inherited: Json,
  names: Set<string>,
  suffix: string,
  out: ZoneLayers,
  ctx: LayoutContext,
  root: boolean
): RawLayer[] {
  const style = obj(z.style)
  const own: Json = { ...inherited }
  for (const k of INHERITED) if (style[k] !== undefined && style[k] !== '') own[k] = style[k]
  const parentEm = px(inherited.fontSize) ?? 16
  const fontPx = px(own.fontSize, parentEm) ?? 16
  const x = root ? 0 : ox + (px(style.left) ?? 0)
  const y = root ? 0 : oy + (px(style.top) ?? 0)
  const w = px(style.width) ?? Math.max(0, pw - (root ? 0 : (px(style.left) ?? 0)))
  const h = px(style.height) ?? Math.max(0, ph - (root ? 0 : (px(style.top) ?? 0)))
  /** Zona fissa: il contenuto è quello del layout; le altre lo prendono dai dati */
  const fixed = z.isStatic === true
  const type = str(z.type) ?? 'image'
  const id = String(z.id ?? '')
  const key = type === 'text' ? str(z.textDataKey) : str(z.imageDataKey)
  const name = unique(cleanName((key || `zone${id}`) + suffix), names)
  // la rotazione sta in `rotation` o, più spesso, in transform: rotate(36deg)
  const turn = (typeof z.rotation === 'number' ? z.rotation : 0) + rotateOf(str(style.transform))
  const rotation = ((((turn + 180) % 360) + 360) % 360) - 180
  const frame: RawLayer = {
    x: mm(x),
    y: mm(y),
    w: mm(w),
    h: mm(h),
    ...(rotation ? { rotation: r3(rotation) } : {})
  }
  if (
    style.opacity !== undefined &&
    Number.isFinite(Number(style.opacity)) &&
    Number(style.opacity) < 1
  )
    frame.opacity = r3(Number(style.opacity))
  if (str(style.display) === 'none') frame.visible = false

  const clip = clipOf(style, w, h)
  if (clip === 'unknown') unsupported(ctx, 'dextrous.unsupported.clip', name)
  const radius = radiusOf(style)
  const layers: RawLayer[] = []

  // sotto: lo sfondo e il bordo della zona (la carta li ha nel template, vedi convertLayout)
  // un contenitore è una fila flex: il suo contorno a puntini si vede solo nell'editor di Dextrous
  const container = type === 'container'
  const fill = fillOf(style)
  const edge = container ? null : edgeOf(style)
  if (!root && (fill || edge)) {
    const bg: RawLayer = {
      type: 'shape',
      name: unique(`${name}_bg`, names),
      ...frame,
      shape: 'rect',
      fill: fill ?? null
    }
    shapeClip(bg, clip, radius)
    if (edge) applyEdge(bg, edge)
    // una zona che si nasconde senza contenuto nasconde anche lo sfondo
    if (z.toggleIfNoContent === true && key) bg.visible = `=LEN({${name}})>0`
    layers.push(bg)
  }

  if (type === 'image') {
    const { fit, zoom } = imageFit(style)
    const layer: RawLayer = {
      type: 'image',
      name,
      ...frame,
      // il contenuto del layout di una zona non fissa è solo un'anteprima dell'editor di Dextrous
      src: fixed && str(z.image) ? ctx.image(str(z.image)!, str(z.imageFolder) ?? '') : '',
      ...(fixed ? { source: { kind: 'fixed' } } : {}),
      fit,
      ...(zoom !== undefined && zoom !== 1 ? { zoom } : {})
    }
    const align = imageAlign(style)
    if (align !== 'center') layer.align = align
    if (clip && clip !== 'unknown') {
      if (clip.kind === 'ellipse') layer.radius = r3(Math.min(mm(w), mm(h)) / 2)
      else unsupported(ctx, 'dextrous.unsupported.imageClip', name)
    } else if (radius) layer.radius = mm(radius)
    if (Math.abs(w - h) > 1 && clip && clip !== 'unknown' && clip.kind === 'ellipse')
      unsupported(ctx, 'dextrous.unsupported.imageClip', name)
    // senza un'immagine nel layout né nei dati la zona è solo sfondo: niente livello vuoto
    if (key || fixed) {
      layers.unshift(layer)
      if (id && !fixed) out.zones.set(id, { name, type: 'image' })
    } else names.delete(name)
  } else if (type === 'text') {
    const font = fontName(own)
    if (font) ctx.fonts.add(font)
    const weight =
      str(own.fontWeight) ?? (typeof own.fontWeight === 'number' ? String(own.fontWeight) : '')
    const pad = (k: string): number => mm(px(style[k], fontPx) ?? px(style.padding, fontPx) ?? 0)
    const sides: [number, number, number, number] = [
      pad('paddingTop'),
      pad('paddingRight'),
      pad('paddingBottom'),
      pad('paddingLeft')
    ]
    const lh = own.lineHeight
    const lineHeight =
      typeof lh === 'number'
        ? lh
        : /^[\d.]+$/.test(str(lh) ?? '')
          ? parseFloat(str(lh)!)
          : px(lh, fontPx) !== undefined
            ? r3(px(lh, fontPx)! / fontPx)
            : 1.2
    const layer: RawLayer = {
      type: 'text',
      name,
      ...frame,
      text: fixed ? convertText(str(z.text) ?? '', ctx) : '',
      ...(fixed ? { source: { kind: 'fixed' } } : {}),
      size: r3(fontPx * 0.75),
      color: cssColor(own.color) ?? '#000000',
      align: H_ALIGN[str(own.textAlign) ?? 'left'] ?? 'left',
      valign: V_ALIGN[str(style.alignItems) ?? str(style.justifyContent) ?? 'center'] ?? 'middle',
      lineHeight: r3(lineHeight)
    }
    if (font) layer.font = font
    if (weight === 'bold' || weight === 'bolder') layer.weight = 700
    else if (/^\d+$/.test(weight)) layer.weight = Number(weight)
    if (str(own.fontStyle) === 'italic') layer.italic = true
    if (sides.some((s) => s)) layer.paddingSides = sides
    const ls = px(own.letterSpacing, fontPx)
    if (ls) layer.letterSpacing = r3((ls / fontPx) * 1000)
    const tt = str(own.textTransform)
    if (tt === 'uppercase') layer.transform = 'upper'
    else if (tt === 'lowercase') layer.transform = 'lower'
    else if (tt === 'capitalize') layer.transform = 'capitalize'
    if (str(style.whiteSpace) === 'nowrap' || str(style.textWrap) === 'nowrap') layer.wrap = false
    if (z.allowTextShrink === true || z.allowTextSquash === true) {
      layer.fit = 'shrink'
      layer.minSize = r3(Math.max(4, fontPx * 0.75 * 0.3))
    }
    const strokeWidth = px(
      style['-webkit-text-stroke-width'] ?? style.WebkitTextStrokeWidth,
      fontPx
    )
    const strokeColor = cssColor(style['-webkit-text-stroke-color'] ?? style.WebkitTextStrokeColor)
    if (strokeWidth && strokeColor && strokeWidth < fontPx / 2)
      layer.stroke = { color: strokeColor, width: mm(strokeWidth) }
    const shadow = textShadow(str(style.textShadow))
    if (shadow) layer.shadow = shadow
    if (obj(z.dexStyle).ct === true) unsupported(ctx, 'dextrous.unsupported.curvedText', name)
    if (Number(style.columnCount) > 1) unsupported(ctx, 'dextrous.unsupported.columns', name)
    layers.unshift(layer)
    if (id && !fixed) out.zones.set(id, { name, type: 'text' })
  } else {
    if (!container) unsupported(ctx, 'dextrous.unsupported.zoneType', `${name} (${type})`)
    names.delete(name)
  }

  const display = str(style.display)
  const children = arr(z.childZones).map(obj)
  const flex =
    !root && (container || display === 'flex' || display === 'inline-flex') && children.length > 0
  // in Dextrous la zona dopo sta sopra: in Stella il primo livello è in cima
  const kids: RawLayer[] = []
  for (const ch of children) {
    const ls = zoneLayers(ch, x, y, w, h, own, names, suffix, out, ctx, false)
    // in un contenitore flex ogni figlia (con il suo sfondo) è un elemento della fila
    kids.unshift(...(flex && ls.length > 1 ? [childGroup(ls, names)] : ls))
  }
  if (!kids.length) return layers
  if (flex) {
    // contenitore flex → gruppo con la disposizione: l'ordine della fila è quello delle zone
    const layout = flexLayout(style, name, ctx, container)
    const items = [...kids].reverse()
    shrinkItems(items, layout, w, h)
    const group: RawLayer = {
      type: 'group',
      name: unique(`${name}_group`, names),
      ...frame,
      clip: str(style.overflow) === 'hidden',
      ...layout,
      children: items
    }
    return layers.length ? [group, ...layers] : [group]
  }
  if (root || str(style.overflow) !== 'hidden') return [...kids, ...layers]
  // le figlie di una zona che taglia: un gruppo che taglia al riquadro della zona
  return [
    {
      type: 'group',
      name: unique(`${name}_group`, names),
      ...frame,
      clip: true,
      children: [...kids, ...layers]
    }
  ]
}

/** Più livelli di una zona figlia di un contenitore flex: un gruppo, che nella fila conta uno */
function childGroup(layers: RawLayer[], names: Set<string>): RawLayer {
  const xs = layers.map((l) => [
    l.x as number,
    l.y as number,
    (l.x as number) + (l.w as number),
    (l.y as number) + (l.h as number)
  ])
  const x = Math.min(...xs.map((b) => b[0]))
  const y = Math.min(...xs.map((b) => b[1]))
  return {
    type: 'group',
    name: unique(`${layers.find((l) => l.type !== 'shape')?.name ?? layers[0].name}_item`, names),
    x: r3(x),
    y: r3(y),
    w: r3(Math.max(...xs.map((b) => b[2])) - x),
    h: r3(Math.max(...xs.map((b) => b[3])) - y),
    children: layers
  }
}

const FLEX_ALIGN: Record<string, 'start' | 'center' | 'end'> = {
  'flex-start': 'start',
  start: 'start',
  left: 'start',
  top: 'start',
  normal: 'start',
  stretch: 'start',
  baseline: 'start',
  center: 'center',
  'flex-end': 'end',
  end: 'end',
  right: 'end',
  bottom: 'end'
}

/** Proprietà flex → disposizione del gruppo di Stella */
function flexLayout(
  style: Json,
  name: string,
  ctx: LayoutContext,
  /** Contenitore di Dextrous: senza allineamenti scritti, gli elementi stanno al centro */
  container: boolean
): RawLayer {
  const dir = str(style.flexDirection) ?? 'row'
  const column = dir.startsWith('column')
  const gap =
    px(column ? (style.rowGap ?? style.gap) : (style.columnGap ?? style.gap)) ?? px(style.gap) ?? 0
  const justify = str(style.justifyContent) ?? (container ? 'center' : 'flex-start')
  if (/space-/.test(justify)) unsupported(ctx, 'dextrous.unsupported.flexSpace', name)
  if (dir.endsWith('reverse')) unsupported(ctx, 'dextrous.unsupported.flexReverse', name)
  if (/^wrap/.test(str(style.flexWrap) ?? ''))
    unsupported(ctx, 'dextrous.unsupported.flexWrap', name)
  return {
    layout: column ? 'column' : 'row',
    gap: mm(gap),
    justify: FLEX_ALIGN[justify] ?? 'center',
    alignItems: FLEX_ALIGN[str(style.alignItems) ?? (container ? 'center' : 'stretch')] ?? 'start'
  }
}

/**
 * Come flex-shrink in CSS: se gli elementi non stanno nella fila, si stringono nella direzione
 * della fila in proporzione alla loro misura. Stella invece li lascerebbe uscire.
 */
function shrinkItems(items: RawLayer[], layout: RawLayer, wPx: number, hPx: number): void {
  if (!items.length || layout.flexWrap) return
  const column = layout.layout === 'column'
  const key = column ? 'h' : 'w'
  const pos = column ? 'y' : 'x'
  const space = mm(column ? hPx : wPx) - (layout.gap as number) * (items.length - 1)
  const total = items.reduce((n, l) => n + ((l[key] as number) || 0), 0)
  if (total <= space || space <= 0) return
  const f = space / total
  const scale = (l: RawLayer, origin: number): void => {
    l[pos] = r3(origin + ((l[pos] as number) - origin) * f)
    l[key] = r3((l[key] as number) * f)
    l.children?.forEach((c) => scale(c, origin))
  }
  items.forEach((l) => scale(l, l[pos] as number))
}

/** Gradi di transform: rotate(…) (deg, turn, rad) */
function rotateOf(v: string | undefined): number {
  const m = v?.match(/rotate(?:z)?\(\s*(-?[\d.]+)\s*(deg|turn|rad)?\s*\)/i)
  if (!m) return 0
  const n = parseFloat(m[1])
  const unit = (m[2] ?? 'deg').toLowerCase()
  return unit === 'turn' ? n * 360 : unit === 'rad' ? (n * 180) / Math.PI : n
}

function textShadow(v: string | undefined): RawLayer['shadow'] | undefined {
  if (!v || v === 'none') return undefined
  const first = v.split(/,(?![^(]*\))/)[0].trim()
  const color = first.match(/(rgba?\([^)]*\)|#[0-9a-f]{3,8}|\b[a-z]+\b)/i)?.[1]
  const nums = first
    .replace(/rgba?\([^)]*\)|#[0-9a-f]{3,8}/gi, '')
    .trim()
    .split(/\s+/)
    .map((s) => px(s))
    .filter((n): n is number => n !== undefined)
  if (nums.length < 2) return undefined
  return {
    color: cssColor(color) ?? '#000000',
    dx: mm(nums[0]),
    dy: mm(nums[1]),
    blur: mm(nums[2] ?? 0)
  }
}

function shapeClip(layer: RawLayer, clip: Clip | 'unknown', radius: number): void {
  if (clip && clip !== 'unknown') {
    if (clip.kind === 'ellipse') layer.shape = 'ellipse'
    else {
      layer.shape = 'path'
      layer.path = clip.path
    }
  } else if (radius) layer.radius = mm(radius)
}

/** Bordo come contorno di Stella, che è centrato sul bordo della forma: si rientra */
function applyEdge(
  layer: RawLayer,
  edge: { width: number; color: string; inset: number; dash?: 'dashed' | 'dotted' }
): void {
  layer.stroke = {
    color: edge.color,
    width: mm(edge.width),
    ...(edge.dash ? { dash: edge.dash } : {})
  }
  const d = mm(edge.inset)
  if (!d) return
  layer.x = r3((layer.x as number) + d)
  layer.y = r3((layer.y as number) + d)
  layer.w = r3(Math.max(0, (layer.w as number) - 2 * d))
  layer.h = r3(Math.max(0, (layer.h as number) - 2 * d))
  if (typeof layer.radius === 'number' && layer.radius)
    layer.radius = r3(Math.max(0, layer.radius - d))
}

interface ConvertedLayout {
  width: number
  height: number
  cornerRadius: number
  shape?: 'ellipse' | 'path'
  shapePath?: string
  layers: RawLayer[]
  zones: Map<string, { name: string; type: 'image' | 'text' }>
}

/** Un layout → misure della carta e livelli di una faccia */
function convertLayout(
  layout: Json,
  names: Set<string>,
  suffix: string,
  ctx: LayoutContext
): ConvertedLayout {
  const root = obj(layout.layoutData)
  const style = obj(root.style)
  const w = px(style.width) ?? 238
  const h = px(style.height) ?? 333
  const out: ZoneLayers = { zones: new Map(), layers: [] }
  const clip = clipOf(style, w, h)
  const radius = radiusOf(style)
  const layers = zoneLayers(root, 0, 0, w, h, {}, names, suffix, out, ctx, true)
  // lo sfondo e il bordo della carta: una forma grande quanto la carta, in fondo
  const fill = fillOf(style)
  const edge = edgeOf(style)
  if (fill || edge) {
    const bg: RawLayer = {
      type: 'shape',
      name: unique(`background${suffix}`, names),
      x: 0,
      y: 0,
      w: mm(w),
      h: mm(h),
      shape: 'rect',
      fill: fill ?? null
    }
    shapeClip(bg, clip === 'unknown' ? null : clip, radius)
    if (edge) applyEdge(bg, edge)
    layers.push(bg)
  }
  if (clip === 'unknown') unsupported(ctx, 'dextrous.unsupported.clip', 'card')
  return {
    width: mm(w),
    height: mm(h),
    cornerRadius: clip ? 0 : mm(radius),
    ...(clip && clip !== 'unknown'
      ? clip.kind === 'ellipse'
        ? { shape: 'ellipse' as const }
        : { shape: 'path' as const, shapePath: clip.path }
      : {}),
    layers,
    zones: out.zones
  }
}

// ——— nomi ———

const cleanName = (s: string): string =>
  s
    .trim()
    .replace(/[.{}[\]]/g, '_')
    .replace(/\s+/g, '_') || 'layer'

function unique(name: string, taken: Set<string>): string {
  let out = name
  for (let n = 2; taken.has(out.toLowerCase()) || taken.has(out); n++) out = `${name}_${n}`
  taken.add(out)
  return out
}

const fileSafe = (s: string): string =>
  s
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/^\./, '_')
    .trim() || 'template'

function sheetNameFor(name: string): string {
  if (isValidSheetName(name)) return name
  return (
    name
      .replace(/[[\]:*?/\\]/g, '_')
      .slice(0, 31)
      .trim() || 'set'
  )
}

// ——— progetto ———

export interface DextrousImport {
  file: ProjectFile
  templates: RawTemplate[]
  sheets: Sheet[]
  notes: Message[]
  /** Immagini richiamate e non trovate, come le scrive Dextrous */
  missingImages: string[]
  /** Componenti senza il layout: hanno un template vuoto */
  missingLayouts: string[]
  fonts: string[]
}

/**
 * Converte il progetto. `layouts` sono i JSON dei layout scaricati (quelli che mancano danno un
 * template vuoto), `assets` le immagini che saranno nel progetto, relative ad assets/.
 */
export function convertDextrous(
  projectJson: unknown,
  layoutsJson: unknown[],
  assets: string[]
): DextrousImport {
  const project = obj(projectJson)
  const layouts = layoutMap(layoutsJson)
  const notes: Message[] = []
  const missingImages = new Set<string>()
  const missingLayouts: string[] = []
  const reserved = new Set<string>(Object.keys(ATTRIBUTES))

  // stili del testo: le classi di Dextrous
  const styles: Record<string, string> = {}
  const styleTags = new Map<string, string>()
  for (const raw of arr(project.inlineClasses)) {
    const c = obj(raw)
    const n = str(c.name)?.trim()
    if (!n) continue
    const name = n.replace(/[^\p{L}\p{N}_-]/gu, '_')
    const attrs = styleAttributes(obj(c.style))
    styles[name] = attrs
    styleTags.set(n.toLowerCase(), `.${name}`)
    styleTags.set(`.${n.toLowerCase()}`, `.${name}`)
    if (str(c.image) || str(c.imgUrl)) notes.push(msg('dextrous.styleImage', { style: n }))
  }

  const image = (value: string, folder: string): string => {
    const v = value.trim()
    if (!v) return ''
    if (/^https?:/i.test(v)) return v
    const path = v.replace(/\\/g, '/')
    const full = path.includes('/') ? path : folder ? `${folder}/${path}` : path
    const found = [full, path, baseName(path)].map((n) => resolveAsset(n, assets)).find((r) => r.ok)
    if (found && found.ok) return assetRefName(found.path, assets)
    // con lo stesso nome in più cartelle: quella di Dextrous se c'è
    const all = resolveAsset(baseName(path), assets)
    if (!all.ok && all.reason === 'ambiguous') {
      const pick = all.candidates.find((c) => c.toLowerCase().endsWith(full.toLowerCase()))
      return (pick ?? all.candidates[0]).replace(/\.[^.]+$/, '')
    }
    missingImages.add(full)
    return baseName(path).replace(/\.[^.]+$/, '')
  }

  const variables: Variables = {}
  const ctx: LayoutContext = {
    styles: styleTags,
    variables,
    reserved,
    icons: new Map(),
    unsupportedTags: new Set(),
    image,
    notes,
    unsupported: new Map(),
    fonts: new Set()
  }

  const templates: RawTemplate[] = []
  const sheets: Sheet[] = []
  const sets: ProjectFile['sets'] = []
  const sheetNames = new Set<string>()
  const comps = components(project)
  for (const c of comps) {
    // i nomi dei livelli sono unici nel template e diversi da attributi e variabili
    const names = new Set<string>([...Object.keys(ATTRIBUTES), ...Object.keys(variables)])
    const front = layouts.get(c.frontLayout)
    const back = hasOwnBack(c) && c.backLayout ? layouts.get(c.backLayout) : undefined
    if (!front) missingLayouts.push(c.name)
    if (hasOwnBack(c) && !back) missingLayouts.push(`${c.name} (back)`)
    ctx.unsupported = new Map()

    const f = front ? convertLayout(front, names, '', ctx) : null
    const b = back ? convertLayout(back, names, '_back', ctx) : null
    names.forEach((n) => reserved.add(n))

    const nickname = c.rows.some((r) => str(r._nickname)?.trim())
    const frontLayers = [...(f?.layers ?? [])]
    if (nickname) frontLayers.push({ type: 'value', name: unique('name', names), value: '' })

    // un retro solo per tutte le carte: i suoi valori vanno nel template
    const singleBack = hasOwnBack(c) && !/unique/i.test(c.backType) && c.backRows.length <= 1
    let backLayers = b?.layers ?? []
    if (singleBack && b && c.backRows[0])
      backLayers = withValues(backLayers, b.zones, c.backRows[0], ctx, folders(c, true))

    const raw: RawTemplate = {
      name: isValidTemplateName(c.name) ? c.name : fileSafe(c.name),
      ...(c.kind !== 'card' ? { kind: c.kind } : {}),
      width: f?.width ?? 63,
      height: f?.height ?? 88,
      bleed: 0,
      safeMargin: 3,
      cornerRadius: f?.cornerRadius ?? 3,
      ...(f?.shape ? { shape: f.shape } : {}),
      ...(f?.shapePath ? { shapePath: f.shapePath } : {}),
      ...(sameAsFront(c.backType) ? { backFromFront: true } : {}),
      ...(nickname ? { labelField: 'name' } : {}),
      front: frontLayers,
      back: backLayers
    }
    templates.push(raw)
    if (b && f && (Math.abs(b.width - f.width) > 0.5 || Math.abs(b.height - f.height) > 0.5))
      notes.push(msg('dextrous.backSize', { template: raw.name }))
    for (const [key, layers] of ctx.unsupported)
      notes.push(msg(key, { template: raw.name, layers: [...layers].join(', ') }))

    // righe
    const headers = ['amount', ...(nickname ? ['name'] : [])]
    const rows: Record<string, string>[] = []
    const styleCells = new Set<string>()
    const ttsCells = { value: false }
    const fill = (
      row: Record<string, string>,
      data: Json,
      conv: ConvertedLayout | null,
      back: boolean
    ): void => {
      if (!conv) return
      const fold = folders(c, back)
      for (const [k, v] of Object.entries(data)) {
        const m = k.match(/^([its])(\d+)$/)
        if (!m) {
          if ((k === '_TTSDesc' || k === '_TTSData') && str(v)?.trim()) ttsCells.value = true
          continue
        }
        const zone = conv.zones.get(m[2])
        const s = typeof v === 'string' ? v : v == null ? '' : String(v)
        if (m[1] === 's') {
          if (!s.trim()) continue
          if (!zone) continue
          const vis = visibility(s)
          if (vis === null) styleCells.add(zone.name)
          else set(row, headers, `${zone.name}.visible`, vis)
          continue
        }
        if (!zone || !s.trim()) continue
        if (m[1] === 'i' && zone.type === 'image')
          set(row, headers, zone.name, image(s, str(fold[k]) ?? ''))
        else if (m[1] === 't' && zone.type === 'text')
          set(row, headers, zone.name, convertText(s, ctx, str(fold[k]) ?? ''))
      }
    }
    const count = Math.max(c.rows.length, hasOwnBack(c) && !singleBack ? c.backRows.length : 0)
    for (let i = 0; i < count; i++) {
      const data = c.rows[i] ?? {}
      const copies = Number(data._copies)
      const row: Record<string, string> = {
        amount: String(Number.isFinite(copies) && data._copies !== '' ? copies : 1)
      }
      if (nickname) row.name = str(data._nickname) ?? ''
      fill(row, data, f, false)
      if (hasOwnBack(c) && !singleBack) fill(row, c.backRows[i] ?? {}, b, true)
      rows.push(row)
    }
    if (hasOwnBack(c) && !singleBack && c.backRows.length !== c.rows.length)
      notes.push(
        msg('dextrous.backCount', { set: c.name, fronts: c.rows.length, backs: c.backRows.length })
      )
    if (styleCells.size)
      notes.push(msg('dextrous.styleColumn', { set: c.name, layers: [...styleCells].join(', ') }))
    if (ttsCells.value) notes.push(msg('dextrous.ttsData', { set: c.name }))
    const csv = str(c.json.csvURL)?.trim()
    if (csv) notes.push(msg('dextrous.googleSheet', { set: c.name, url: csv }))
    if (str(c.json.luaScript)?.trim()) notes.push(msg('dextrous.lua', { set: c.name }))

    // colonne nell'ordine dei livelli
    const order = layerOrder([...frontLayers, ...backLayers])
    const rank = (h: string): number => {
      const i = order.indexOf(h.split('.')[0])
      return i < 0 ? order.length : i
    }
    const sorted = [
      ...headers.filter((h) => h === 'amount' || h === 'name'),
      ...headers
        .filter((h) => h !== 'amount' && h !== 'name')
        .sort((a, b) => rank(a) - rank(b) || a.length - b.length)
    ]
    const sheetName = unique(sheetNameFor(c.name), sheetNames)
    sheets.push({
      name: sheetName,
      headers: sorted,
      rows: rows.map((r) => sorted.map((h) => r[h] ?? ''))
    })
    sets.push({
      name: c.name,
      template: raw.name,
      ...(sheetName !== c.name ? { sheet: sheetName } : {})
    })
  }

  if (ctx.unsupportedTags.size)
    notes.push(
      msg('dextrous.unsupportedTags', {
        tags: [...ctx.unsupportedTags].map((t) => `<${t}>`).join(' ')
      })
    )
  if (arr(project.variables).length || str(project.variablesCSV)?.trim())
    notes.push(msg('dextrous.variables'))
  if (missingLayouts.length)
    notes.unshift(msg('dextrous.missingLayouts', { components: missingLayouts.join(', ') }))

  const file: ProjectFile = {
    formatVersion: FORMAT_VERSION,
    name: str(project.title)?.trim() || 'Dextrous',
    dataFile: 'data/cards.xlsx',
    sets,
    ...(Object.keys(styles).length ? { styles } : {}),
    ...(Object.keys(variables).length ? { variables } : {})
  }
  return {
    file,
    templates,
    sheets,
    notes,
    missingImages: [...missingImages].sort(),
    missingLayouts,
    fonts: [...ctx.fonts].sort()
  }
}

/** Cartelle predefinite delle colonne di immagini del fronte o del retro */
const folders = (c: Component, back: boolean): Json =>
  obj(back ? obj(c.json.backs).defaultImageFolders : c.json.defaultImageFolders)

function set(row: Record<string, string>, headers: string[], header: string, value: string): void {
  if (!headers.includes(header)) headers.push(header)
  row[header] = value
}

/** Valore di una colonna di stile: mostra o nasconde la zona; null se non si sa */
function visibility(v: string): string | null {
  const s = v.trim().toLowerCase()
  if (/^(hide|hidden|none|false|0|off|no)$/.test(s) || /display\s*:\s*none/.test(s)) return 'false'
  if (/^(show|shown|visible|true|1|on|yes|block|flex)$/.test(s)) return 'true'
  return null
}

/** I valori di una riga scritti nei livelli del template (per un retro uguale per tutte le carte) */
function withValues(
  layers: RawLayer[],
  zones: Map<string, { name: string; type: 'image' | 'text' }>,
  data: Json,
  ctx: LayoutContext,
  fold: Json
): RawLayer[] {
  const values = new Map<string, { type: string; value: string; key: string }>()
  for (const [k, v] of Object.entries(data)) {
    const m = k.match(/^([it])(\d+)$/)
    const zone = m && zones.get(m[2])
    if (!zone || typeof v !== 'string' || !v.trim()) continue
    values.set(zone.name, { type: m![1], value: v, key: k })
  }
  const walk = (list: RawLayer[]): RawLayer[] =>
    list.map((l) => {
      const v = values.get(l.name ?? '')
      if (l.children) return { ...l, children: walk(l.children) }
      if (!v) return l
      if (v.type === 'i' && l.type === 'image')
        return { ...l, src: ctx.image(v.value, str(fold[v.key]) ?? '') }
      if (v.type === 't' && l.type === 'text') return { ...l, text: convertText(v.value, ctx) }
      return l
    })
  return walk(layers)
}

function layerOrder(layers: RawLayer[]): string[] {
  const out: string[] = []
  // nell'ordine del pannello: prima i livelli in cima
  const walk = (list: RawLayer[]): void =>
    list.forEach((l) => {
      if (l.name) out.push(l.name)
      if (l.children) walk(l.children)
    })
  walk(layers)
  return out
}
