// Conversione degli script nanDECK già eseguiti (interp.ts) in template, fogli e variabili di
// Stella. Ogni comando grafico diventa un livello; ciò che cambia da carta a carta va nel foglio
// (una colonna per l'etichetta o per la proprietà del livello). Gli intervalli diventano la
// visibilità del livello: una formula quando vengono da labelrange o da un IF sulle colonne,
// altrimenti una colonna livello.visible. Le carte che non hanno comandi in comune con le altre
// formano un retro (una carta sola dopo le altre) o un template a parte.

import { msg, type Message } from '../../messages'
import { evaluateFormula } from '../../model/formula'
import type { RawLayer, RawTemplate } from '../../model/normalize'
import { isValidSheetName } from '../../model/sheet'
import type { Variables } from '../../model/variables'
import type { ProjectFile, Sheet } from '../../project'
import { evalNumber, formatNumber } from './expr'
import { escapeMarkup, htmlToMarkup } from './html'
import {
  KEEP_CLOSE,
  KEEP_OPEN,
  NOT_SYMBOLIC,
  type DrawOp,
  type HtmlFont,
  type NandeckScript,
  type SkippedLine
} from './interp'
import { functionCall, unquote } from './script'

/** Millimetri per punto tipografico */
const PT = 25.4 / 72

export interface ScriptReport {
  /** Script, relativo alla cartella del gioco */
  script: string
  templates: string[]
  cards: number
  layers: number
  skipped: SkippedLine[]
  /** Comandi convertiti in modo approssimato, già raggruppati */
  notes: Message[]
  /** Righe di stampa ed esportazione ignorate */
  printLines: number
}

export interface NandeckProject {
  templates: RawTemplate[]
  sheets: Sheet[]
  sets: ProjectFile['sets']
  variables: Variables
  /** Immagini usate, relative alla cartella del gioco */
  images: string[]
  fonts: string[]
  reports: ScriptReport[]
}

interface Built {
  type: 'text' | 'image' | 'shape'
  hint: string
  props: Record<string, unknown>
  /** Proprietà principale scritta con i campi ({nome}), uguale per tutte le carte */
  symbolic?: string
}

interface Context {
  script: NandeckScript
  variables: Variables
  variableNames: Set<string>
  /** Tasto di ICON → nome della variabile */
  iconVars: Map<string, string>
  /** Tasto di HTMLIMAGE → nome della variabile */
  /** Immagini di HTMLIMAGE: altezza in mm, o in proporzione al carattere (flag F) */
  htmlVars: { key: string; name: string; height: number | null; relative: boolean }[]
  images: Set<string>
  fonts: Set<string>
  notes: Map<string, Set<string>>
  unsupportedTags: Set<string>
}

const note = (ctx: Context, key: string, what: string): void => {
  if (!ctx.notes.has(key)) ctx.notes.set(key, new Set())
  ctx.notes.get(key)!.add(what)
}

const r3 = (n: number): number => Math.round(n * 1000) / 1000

/** Nome di colonna e di livello: lettere, cifre, _ e -; niente punti */
export function cleanName(s: string): string {
  return (
    s
      .trim()
      .replace(/[^\p{L}\p{N}_-]+/gu, '_')
      .replace(/^_+|_+$/g, '') || 'layer'
  )
}

function unique(name: string, taken: Set<string>): string {
  let out = name
  for (let n = 2; taken.has(out.toLowerCase()); n++) out = `${name}_${n}`
  taken.add(out.toLowerCase())
  return out
}

// ——— colori ———

/** Colore nanDECK: #RRGGBB, sfumature #A#B@angolo (lineari), "empty" e vuoto = nessuno */
function color(v: string | undefined): string | null | undefined {
  const s = unquote(v ?? '').trim()
  if (!s) return undefined
  if (/^empty$/i.test(s)) return null
  const grad = /^((?:#[0-9a-f]{6})+)(?:@(-?\d+(?:\.\d+)?))?$/i.exec(s)
  if (grad) {
    const stops = grad[1].match(/#[0-9a-f]{6}/gi)!.map((c) => c.toUpperCase())
    if (stops.length === 1) return stops[0]
    // in nanDECK 0° va da sinistra a destra e l'angolo cresce in senso antiorario; in CSS 90deg
    // va da sinistra a destra in senso orario
    const angle = grad[2] === undefined ? 90 : 90 - Number(grad[2])
    return `linear-gradient(${formatNumber(angle)}deg, ${stops.join(', ')})`
  }
  if (/^#[0-9a-f]{8}$/i.test(s)) return s.toUpperCase()
  if (/^#[0-9a-f]{3}$/i.test(s)) return s.toUpperCase()
  return s
}

// ——— conversione di un'operazione ———

interface Geometry {
  x: number
  y: number
  w: number
  h: number
}

function geometry(ctx: Context, p: string[], from: number): Geometry | null {
  const s = ctx.script
  const W = s.widthUnits
  const H = s.heightUnits
  const v = [0, 1, 2, 3].map((i) => evalNumber(p[from + i] ?? '', i % 2 ? H : W))
  if (v.some((x) => x === null)) return null
  const [x, y, w, h] = (v as number[]).map((n) => n * s.unit)
  return { x: r3(x), y: r3(y), w: r3(w), h: r3(h) }
}

const lengthMm = (ctx: Context, v: string | undefined, ref = ctx.script.widthUnits): number =>
  (evalNumber(v ?? '', ref) ?? 0) * ctx.script.unit

/** Rotazione di Stella (gradi in senso orario) da un angolo nanDECK (antiorario) */
const rotation = (angle: number): number => {
  const r = (((-angle % 360) + 540) % 360) - 180
  return r3(r === -180 ? 180 : r)
}

/** Riquadro e rotazione: a 90° e 270° il testo nanDECK riempie il riquadro, che in Stella ruota */
function rotatedBox(g: Geometry, angle: number): Record<string, number> {
  const rot = rotation(angle)
  if (Math.abs(Math.abs(rot) - 90) < 0.01) {
    const cx = g.x + g.w / 2
    const cy = g.y + g.h / 2
    return { x: r3(cx - g.h / 2), y: r3(cy - g.w / 2), w: g.h, h: g.w, rotation: rot }
  }
  return { ...g, ...(rot ? { rotation: rot } : {}) }
}

/** Contorno di Stella, centrato sul bordo: si rientra di metà spessore come nanDECK */
function insetStroke(g: Geometry, width: number): Geometry {
  const half = width / 2
  return {
    x: r3(g.x + half),
    y: r3(g.y + half),
    w: r3(Math.max(0, g.w - width)),
    h: r3(Math.max(0, g.h - width))
  }
}

const H_ALIGN: Record<string, string> = {
  left: 'left',
  center: 'center',
  centre: 'center',
  right: 'right',
  justify: 'justify',
  justified: 'justify'
}

function textAlign(v: string | undefined): string {
  return H_ALIGN[(v ?? '').trim().toLowerCase()] ?? 'center'
}

/** Allineamento verticale e a capo: wordwrap, wwtop, wwcenter, wwbottom */
function textValign(v: string | undefined): { valign: string; wrap: boolean } {
  const s = (v ?? '').trim().toLowerCase()
  const wrap = s.startsWith('ww') || s === 'wordwrap'
  const rest = s.replace(/^wordwrap$/, 'center').replace(/^ww/, '')
  const valign = rest.startsWith('top') ? 'top' : rest.startsWith('bottom') ? 'bottom' : 'middle'
  return { valign, wrap }
}

function fontProps(
  name: string,
  size: number,
  flags: string,
  col: string
): Record<string, unknown> {
  const f = flags.toUpperCase()
  const out: Record<string, unknown> = { font: name, size: r3(size) }
  if (f.includes('B')) out.weight = 700
  if (f.includes('I')) out.italic = true
  if (f.includes('U')) out.underline = true
  if (f.includes('S')) out.strike = true
  if (f.includes('F')) out.fit = 'shrink'
  const c = color(col)
  if (c) out.color = c
  return out
}

/** Nome di un livello da un testo: la prima etichetta o il nome del file */
function hintFrom(raw: string, fallback: string): string {
  const field = /\[([^[\]]+)\]/.exec(raw)?.[1]
  if (field) return cleanName(field)
  const file = /([^\\/"]+)\.(png|jpe?g|gif|bmp|svg|webp)/i.exec(raw)?.[1]
  if (file) return cleanName(file)
  return fallback
}

/** Testo con i segni dei campi lasciati dalla sostituzione simbolica: [nome] → {nome} */
const fieldsOf = (s: string): string =>
  s.replace(
    new RegExp(`${KEEP_OPEN}([^${KEEP_CLOSE}]*)${KEEP_CLOSE}`, 'g'),
    (_, n: string) => `{${cleanName(n)}}`
  )

function build(
  ctx: Context,
  op: DrawOp,
  p: string[],
  sym: string[] | null,
  card: number
): Built | null {
  const s = ctx.script
  const raw = op.params
  switch (op.command) {
    case 'TEXT': {
      const g = geometry(ctx, p, 1)
      if (!g) return null
      const font = s.fontFor(op, card)
      const { valign, wrap } = textValign(p[6])
      const props: Record<string, unknown> = {
        ...rotatedBox(g, evalNumber(p[7] ?? '') ?? 0),
        text: escapeMarkup(unquote(p[0] ?? '')),
        ...fontProps(font.name, font.size, font.flags, font.color),
        align: textAlign(p[5]),
        valign,
        wrap,
        lineHeight: 1.15
      }
      const alpha = evalNumber(p[8] ?? '')
      if (alpha !== null && alpha < 100) props.opacity = r3(Math.max(0, alpha) / 100)
      // FONT, outline x/y: il testo è ripetuto da -x a +x, cioè ingrossato di x per lato
      const grow = Math.max(font.dx, font.dy)
      if (grow > 0)
        props.stroke = { color: color(font.color) ?? '#000000', width: r3(2 * grow * s.unit) }
      // TEXT, outline width: testo disegnato come contorno
      const outline = evalNumber(p[9] ?? '')
      if (outline)
        props.stroke = { color: color(font.color) ?? '#000000', width: r3(outline * s.unit) }
      // senza la lettera T nanDECK riempie il rettangolo con il colore di sfondo
      if (!/[TO]/i.test(font.flags)) note(ctx, 'nandeck.note.fontBackground', String(op.line))
      ctx.fonts.add(font.name)
      return {
        type: 'text',
        hint: hintFrom(raw[0] ?? '', 'text'),
        props,
        symbolic: sym ? fieldsOf(escapeMarkup(unquote(sym[0] ?? ''))) : undefined
      }
    }
    case 'HTMLTEXT': {
      const g = geometry(ctx, p, 1)
      if (!g) return null
      // il font di tutto il testo (htmlfont1) o di ogni paragrafo (htmlfont2)
      const fontKey =
        [p[9], p[10]].map((k) => (k ?? '').trim().toLowerCase()).find((k) => s.htmlFonts.has(k)) ??
        ''
      const hf = s.htmlFonts.get(fontKey)
      const htmlFlags = (p[7] ?? '').toUpperCase()
      const margins = s.htmlMargins.get(fontKey)
      const props: Record<string, unknown> = {
        ...rotatedBox(g, evalNumber(p[6] ?? '') ?? 0),
        ...(hf
          ? fontProps(hf.font, hf.size, hf.flags, hf.color)
          : { font: 'Arial', size: 12, color: '#000000' }),
        align: textAlign(hf?.align),
        valign: 'top',
        lineHeight: 1.15
      }
      if (hf) ctx.fonts.add(hf.font)
      if (hf?.outlineColor && hf.outline)
        props.stroke = {
          color: color(hf.outlineColor) ?? '#000000',
          width: r3(hf.outline * s.unit)
        }
      if (margins) {
        const pad = [margins.top, margins.right, margins.bottom, margins.left].map((v) =>
          r3(v * s.unit)
        )
        if (pad.some(Boolean)) props.paddingSides = pad
        if (margins.valign) props.valign = textValign(margins.valign).valign
      }
      const alpha = evalNumber(p[8] ?? '')
      if (alpha !== null && alpha < 100) props.opacity = r3(Math.max(0, alpha) / 100)
      if (/[FS]/.test(htmlFlags)) props.fit = 'shrink'
      else if (htmlFlags.includes('J')) props.fit = 'grow'
      // senza T o B nanDECK riempie il rettangolo con il colore di sfondo
      if (!/[TB]/.test(htmlFlags) && color(p[5]) && color(p[5]) !== '#FFFFFF')
        note(ctx, 'nandeck.note.htmlBackground', String(op.line))
      props.text = html(ctx, unquote(p[0] ?? ''), hf?.size ?? 12)
      return {
        type: 'text',
        hint: hintFrom(raw[0] ?? '', 'text'),
        props,
        symbolic:
          sym && !sym[0]?.includes(NOT_SYMBOLIC)
            ? fieldsOf(html(ctx, unquote(sym[0] ?? ''), hf?.size ?? 12))
            : undefined
      }
    }
    case 'IMAGE': {
      const g = geometry(ctx, p, 1)
      if (!g) return null
      const flags = (p[6] ?? '').toUpperCase()
      const file = s.resolvePath(unquote(p[0] ?? ''))
      if (file) ctx.images.add(file)
      const props: Record<string, unknown> = {
        ...g,
        src: file,
        fit: flags.includes('X')
          ? 'tile'
          : flags.includes('P')
            ? 'contain'
            : flags.includes('C')
              ? 'cover'
              : 'stretch'
      }
      if (flags.includes('H')) props.flipH = true
      if (flags.includes('V')) props.flipV = true
      const vert = flags.includes('U') ? 'top' : flags.includes('S') ? 'bottom' : ''
      const horiz = flags.includes('W') ? 'left' : flags.includes('E') ? 'right' : ''
      if (vert || horiz) props.align = [vert, horiz].filter(Boolean).join('-')
      const rot = rotation(evalNumber(p[5] ?? '') ?? 0)
      if (rot) props.rotation = rot
      const alpha = evalNumber(p[7] ?? '')
      if (alpha !== null && alpha < 100) props.opacity = r3(Math.max(0, alpha) / 100)
      if (flags.includes('G')) props.grayscale = true
      let symbolic: string | undefined
      if (sym && sym[0] && !sym[0].includes(NOT_SYMBOLIC)) {
        const t = unquote(sym[0])
        // un percorso con un campo: img/{nome}.png
        // eslint-disable-next-line no-control-regex
        if (t.includes(KEEP_OPEN) && !/^\s*\u0003[^\u0004]*\u0004\s*$/.test(t))
          symbolic = fieldsOf(s.resolvePath(t.replace(/\\/g, '/')))
      }
      return { type: 'image', hint: hintFrom(raw[0] ?? '', 'image'), props, symbolic }
    }
    case 'RECTANGLE':
    case 'ROUNDRECT':
    case 'ELLIPSE':
    case 'CIRCLE':
    case 'RHOMBUS':
    case 'POLYGON':
    case 'STAR': {
      const g = geometry(ctx, p, 0)
      if (!g) return null
      const poly = op.command === 'POLYGON' || op.command === 'STAR'
      // STAR ha in più il fattore delle punte, prima dei colori
      const c0 = op.command === 'STAR' ? 7 : poly ? 6 : 4
      const props: Record<string, unknown> = {}
      const c1 = color(p[c0])
      const c2 = color(p[c0 + 1])
      const thick = lengthMm(ctx, p[c0 + 2])
      let box = g
      if (c2 === undefined) {
        props.fill = c1 ?? null
      } else {
        props.fill = c2
        if (c1 && thick > 0) {
          props.stroke = { color: c1, width: r3(thick) }
          box = insetStroke(g, thick)
        } else if (c1 && c2 === null) {
          // senza spessore nanDECK disegna un bordo sottile
          props.stroke = { color: c1, width: 0.2 }
        }
      }
      Object.assign(props, box)
      if (op.command === 'ROUNDRECT') {
        const rx = lengthMm(ctx, p[c0 + 3])
        const ry = lengthMm(ctx, p[c0 + 4], s.heightUnits)
        const rad = Math.min(rx || ry, ry || rx)
        if (rad > 0) props.radius = r3(Math.max(0, rad - (box === g ? 0 : thick / 2)))
        props.shape = 'rect'
      } else if (op.command === 'ELLIPSE' || op.command === 'CIRCLE') props.shape = 'ellipse'
      else if (op.command === 'RHOMBUS') {
        props.shape = 'path'
        props.path = 'M0.5 0 L1 0.5 L0.5 1 L0 0.5 Z'
      } else if (poly) {
        const sides = Math.max(3, Math.round(evalNumber(p[4] ?? '') ?? 6))
        props.shape = op.command === 'STAR' ? 'star' : 'polygon'
        props.sides = sides
        if (op.command === 'STAR') {
          // fattore: 0 = punte sottili, 100 = poligono
          const f = evalNumber(p[6] ?? '') ?? 50
          props.innerRatio = r3(Math.min(1, Math.max(0.05, f / 100)))
        }
        // in nanDECK l'angolo è quello del primo vertice (90 = in alto); in Stella il primo
        // vertice è in alto
        const rot = r3((((90 - (evalNumber(p[5] ?? '') ?? 90)) % 360) + 360) % 360)
        if (rot) props.rotation = rot > 180 ? r3(rot - 360) : rot
      } else props.shape = 'rect'
      return { type: 'shape', hint: op.command.toLowerCase(), props }
    }
    case 'LINE': {
      const W = s.widthUnits
      const H = s.heightUnits
      const v = [0, 1, 2, 3].map((i) => evalNumber(p[i] ?? '', i % 2 ? H : W))
      if (v.some((x) => x === null)) return null
      const [x1, y1, x2, y2] = (v as number[]).map((n) => n * s.unit)
      const len = Math.hypot(x2 - x1, y2 - y1)
      const thick = Math.max(0.1, lengthMm(ctx, p[5]))
      const cx = (x1 + x2) / 2
      const cy = (y1 + y2) / 2
      const props: Record<string, unknown> = {
        shape: 'line',
        x: r3(cx - len / 2),
        y: r3(cy - thick / 2),
        w: r3(len),
        h: r3(thick),
        fill: null,
        stroke: { color: color(p[4]) ?? '#000000', width: r3(thick) }
      }
      const rot = r3((Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI)
      if (rot) props.rotation = rot
      return { type: 'shape', hint: 'line', props }
    }
    case 'TRIANGLE': {
      const W = s.widthUnits
      const H = s.heightUnits
      const v = [0, 1, 2, 3, 4, 5].map((i) => evalNumber(p[i] ?? '', i % 2 ? H : W))
      if (v.some((x) => x === null)) return null
      const pts = (v as number[]).map((n) => n * s.unit)
      const xs = [pts[0], pts[2], pts[4]]
      const ys = [pts[1], pts[3], pts[5]]
      const x = Math.min(...xs)
      const y = Math.min(...ys)
      const w = Math.max(...xs) - x || 1
      const h = Math.max(...ys) - y || 1
      const path =
        'M' +
        [0, 1, 2]
          .map((i) => `${formatNumber((xs[i] - x) / w)} ${formatNumber((ys[i] - y) / h)}`)
          .join(' L') +
        ' Z'
      const c1 = color(p[6])
      const c2 = color(p[7])
      const thick = lengthMm(ctx, p[8])
      return {
        type: 'shape',
        hint: 'triangle',
        props: {
          shape: 'path',
          path,
          x: r3(x),
          y: r3(y),
          w: r3(w),
          h: r3(h),
          fill: c2 === undefined ? (c1 ?? null) : c2,
          ...(c2 !== undefined && c1 && thick > 0
            ? { stroke: { color: c1, width: r3(thick) } }
            : {})
        }
      }
    }
    case 'ICONS': {
      const g = geometry(ctx, p, 1)
      if (!g) return null
      const iconH = lengthMm(ctx, p[6], s.heightUnits) || g.h
      const keys = unquote(p[0] ?? '')
      const text = iconText(ctx, keys)
      // un'icona nel testo è alta 1,15 volte il corpo
      const size = r3(Math.max(4, iconH / 1.15 / PT))
      return {
        type: 'text',
        hint: hintFrom(raw[0] ?? '', 'icons'),
        props: {
          ...g,
          text,
          size,
          align: textAlign(p[9] || 'center'),
          valign: textValign(p[10] || 'center').valign,
          wrap: true,
          lineHeight: 1
        }
      }
    }
    default:
      return null
  }
}

/** Testo di ICONS: ogni tasto diventa la variabile della sua icona */
function iconText(ctx: Context, keys: string): string {
  let out = ''
  for (const ch of keys) {
    const v = ctx.iconVars.get(ch)
    out += v ? `{${v}}` : ch === ' ' ? ' ' : escapeMarkup(ch)
  }
  return out
}

/** Attributi del markup per un font di HTMLFONT usato come tag */
function fontAttrs(f: HtmlFont): string {
  const out = [`font=${f.font.replace(/\s+/g, '_')}`, `size=${r3(f.size)}`]
  const c = color(f.color)
  if (c) out.push(`color=${c}`)
  const flags = f.flags.toUpperCase()
  if (flags.includes('B')) out.push('bold')
  if (flags.includes('I')) out.push('italic')
  if (flags.includes('U')) out.push('underline')
  if (flags.includes('S')) out.push('strike')
  return out.join(' ')
}

/** Testo di HTMLTEXT: tasti di HTMLKEY, immagini di HTMLIMAGE come variabili, poi i tag */
function html(ctx: Context, text: string, fontSize: number): string {
  let t = text
  // i tasti di HTMLKEY con un font diventano un tag di quel font
  for (const k of ctx.script.htmlKeys)
    if (k.key)
      t = t
        .split(k.key)
        .join(
          k.font && ctx.script.htmlFonts.has(k.font) ? `<${k.font}>${k.value}</${k.font}>` : k.value
        )
  // le chiavi più lunghe prima: (2oro) non deve diventare (2{oro})
  const vars = [...ctx.htmlVars].sort((a, b) => b.key.length - a.key.length)
  const marks: string[] = []
  for (const v of vars)
    if (t.includes(v.key)) {
      t = t.split(v.key).join(`\u0006${marks.length}\u0007`)
      // un'icona nel testo è alta 1,15 volte il corpo: size= è l'altezza rispetto a quella
      const ratio =
        v.height === null ? 1 : v.relative ? v.height / 1.15 : v.height / (fontSize * PT * 1.15)
      const pct = Math.round(ratio * 100)
      marks.push(pct > 0 && Math.abs(pct - 100) > 5 ? `{${v.name} size=${pct}%}` : `{${v.name}}`)
    }
  const fonts = new Map<string, string>()
  for (const [key, f] of ctx.script.htmlFonts) fonts.set(key, fontAttrs(f))
  const r = htmlToMarkup(t.replace(/\n/g, '<br>'), fonts)
  r.unsupported.forEach((u) => ctx.unsupportedTags.add(u))
  // eslint-disable-next-line no-control-regex
  return r.text.replace(/\u0006(\d+)\u0007/g, (_, i: string) => marks[Number(i)])
}

// ——— visibilità ———

/** Formula di Stella per un confronto di labelrange o di IF su una colonna */
function compareFormula(column: string, op: string, value: string): string {
  const v = unquote(value.trim())
  const field = `{${column}}`
  if (op === '@') return `COUNTIN(${field}; "${v.replace(/"/g, '""')}")>0`
  if (v === '') return op === '<>' ? `NOT(ISBLANK(${field}))` : `ISBLANK(${field})`
  const numeric = /^-?\d+(\.\d+)?$/.test(v)
  return `${field}${op}${numeric ? v : `"${v.replace(/"/g, '""')}"`}`
}

/**
 * Formula di visibilità per l'intervallo di un'operazione: LABELRANGE diventa un confronto,
 * RANGEINT un AND e RANGEADD un OR. undefined = tutte le carte, null = nessuna formula.
 */
function rangeFormula(
  script: NandeckScript,
  op: DrawOp,
  text: string,
  cards: number[],
  columns: Map<string, string>,
  depth = 0
): string | null | undefined {
  const t = script.rangeCallOf(op, text)
  if (!t || depth > 6) return t ? null : undefined
  const covered = script.rangeOf(op, t)
  if (covered === null || cards.every((c) => covered.includes(c))) return undefined
  const call = functionCall(t)
  if (!call) return null
  if (call.name === 'labelrange') {
    // il terzo argomento sposta le carte (i retri dopo i fronti): il confronto sui dati è lo stesso
    if (call.args.length > 3) return null
    const label = /^\[([^[\]]+)\]$/.exec(call.args[0]?.trim() ?? '')?.[1]
    const column = label ? columns.get(label.toLowerCase()) : undefined
    if (!column) return null
    const m = /^(<>|<=|>=|=|<|>|@)?(.*)$/s.exec((call.args[1] ?? '').trim())!
    return compareFormula(column, m[1] ?? '=', m[2])
  }
  const join = call.name === 'rangeint' ? 'AND' : /^range(add|merge)$/.test(call.name) ? 'OR' : null
  if (!join) return null
  const parts: string[] = []
  for (const arg of call.args) {
    const f = rangeFormula(script, op, arg, cards, columns, depth + 1)
    if (f === null) return null
    if (f === undefined) {
      // con OR un argomento che vale per tutte le carte rende vero tutto
      if (join === 'OR') return undefined
      continue
    }
    parts.push(f)
  }
  if (!parts.length) return undefined
  return parts.length === 1 ? parts[0] : `${join}(${parts.join('; ')})`
}

function conditionFormula(
  text: string,
  negated: boolean,
  columns: Map<string, string>
): string | null {
  const m = /^\s*\[([^[\]]+)\]\s*(<>|<=|>=|=|<|>)\s*(.*)$/s.exec(text)
  if (!m) return null
  const column = columns.get(m[1].trim().toLowerCase())
  if (!column) return null
  const f = compareFormula(column, m[2], m[3])
  return negated ? `NOT(${f})` : f
}

// ——— script → template e set ———

interface LayerOut {
  layer: RawLayer
  /** Formula di visibilità (senza =), o null */
  formula: string | null
  /** Gruppi LAYER di nanDECK, dal più esterno */
  groups: { id: number; opacity: number }[]
}

/** Gruppi di carte collegate da comandi comuni (unione di insiemi) */
function clusters(cardSets: number[][], all: number[]): number[][] {
  const parent = new Map<number, number>(all.map((c) => [c, c]))
  const find = (c: number): number => {
    let r = c
    while (parent.get(r) !== r) r = parent.get(r)!
    parent.set(c, r)
    return r
  }
  for (const cards of cardSets)
    for (let i = 1; i < cards.length; i++) {
      const a = find(cards[0])
      const b = find(cards[i])
      if (a !== b) parent.set(b, a)
    }
  const used = new Set(cardSets.flat())
  const groups = new Map<number, number[]>()
  for (const c of all) {
    if (!used.has(c)) continue
    const r = find(c)
    if (!groups.has(r)) groups.set(r, [])
    groups.get(r)!.push(c)
  }
  return [...groups.values()].sort((a, b) => b.length - a.length || a[0] - b[0])
}

export interface ScriptInput {
  /** Nome dello script senza estensione: diventa il nome di template e set */
  name: string
  script: NandeckScript
}

export function convertNandeck(inputs: ScriptInput[]): NandeckProject {
  const templates: RawTemplate[] = []
  const sheets: Sheet[] = []
  const sets: ProjectFile['sets'] = []
  const variables: Variables = {}
  const variableNames = new Set<string>()
  const images = new Set<string>()
  const fonts = new Set<string>()
  const reports: ScriptReport[] = []
  const templateNames = new Set<string>()
  const sheetNames = new Set<string>()

  for (const input of inputs) {
    const s = input.script
    const ctx: Context = {
      script: s,
      variables,
      variableNames,
      iconVars: new Map(),
      htmlVars: [],
      images,
      fonts,
      notes: new Map(),
      unsupportedTags: new Set()
    }
    // icone di ICON e immagini di HTMLIMAGE: variabili immagine del progetto
    const iconVar = (key: string, file: string, prefix: string): string => {
      const base = cleanName(key.replace(/^\(|\)$/g, '')) || 'icon'
      // la stessa immagine con lo stesso tasto in un altro script (un INCLUDE comune): stessa variabile
      const existing = Object.entries(variables).find(
        ([n, v]) =>
          v.type === 'image' &&
          v.src === file &&
          (n.toLowerCase() === base.toLowerCase() ||
            n.toLowerCase().startsWith(`${base.toLowerCase()}_`) ||
            n.toLowerCase() === `${prefix}${base}`.toLowerCase())
      )
      if (existing) return existing[0]
      const name = unique(
        /^\d/.test(base) || base === 'layer' ? `${prefix}${base}` : base,
        variableNames
      )
      variables[name] = { type: 'image', src: file }
      images.add(file)
      return name
    }
    for (const [key, file] of s.icons) ctx.iconVars.set(key, iconVar(key, file, 'icon_'))
    for (const h of s.htmlImages) {
      const relative = /F/i.test(h.flags)
      const height = evalNumber(h.height, relative ? null : s.heightUnits)
      ctx.htmlVars.push({
        key: h.key,
        name: iconVar(h.key, h.file, 'img_'),
        height: height === null ? null : relative ? height : height * s.unit,
        relative
      })
    }

    const total = s.cardCount
    const all = Array.from({ length: total }, (_, i) => i + 1)
    // carte di ogni operazione, tenendo conto degli IF
    const active = new Map<number, number[]>()
    for (const op of s.ops) {
      const cards = (op.cards ?? all).filter((c) =>
        op.conditions.every((cond) => s.test(cond, c, s.posOf(op, c)))
      )
      active.set(op.id, cards)
    }
    const groups = clusters(
      [...active.values()].filter((c) => c.length),
      all
    )
    const report: ScriptReport = {
      script: s.file,
      templates: [],
      cards: 0,
      layers: 0,
      skipped: s.skipped,
      notes: [],
      printLines: s.printLines
    }
    reports.push(report)
    if (!groups.length) continue

    // il retro, dopo tutte le carte del gruppo principale: una carta sola (uguale per tutte)
    // o tante carte quante il fronte, nello stesso ordine (fronti e poi retri)
    const main = groups[0]
    const backIndex = groups.findIndex(
      (g, i) =>
        i > 0 && (g.length === 1 || g.length === main.length) && g[0] > main[main.length - 1]
    )
    const parts = groups
      .map((cards, i) => ({ cards, back: i === backIndex }))
      .filter((g) => !g.back)

    // colonne dei dati: le etichette con più elementi usate dai comandi, e quelle del LINK
    const linkHeaders = new Map<string, string>()
    for (const h of s.link?.headers ?? [])
      if (h.trim()) linkHeaders.set(h.trim().toLowerCase(), h.trim())
    const used = new Set<string>()
    for (const op of s.ops) {
      const texts = [op.rangeText, ...op.params, ...op.conditions.map((c) => c.text)]
      for (const t of texts)
        for (const m of t.matchAll(/\[([^[\]]+)\]/g)) used.add(m[1].trim().toLowerCase())
    }
    const columns = new Map<string, string>()
    const columnNames = new Set<string>()
    for (const [k, h] of linkHeaders) columns.set(k, unique(cleanName(h), columnNames))
    for (const name of used)
      if (!columns.has(name) && s.count(name) > 1)
        columns.set(name, unique(cleanName(name), columnNames))
    const keep = new Set(columns.keys())
    const byClean = new Map<string, string>()
    for (const [k, c] of columns) byClean.set(cleanName(k).toLowerCase(), c)

    parts.forEach((part, partIndex) => {
      const name = unique(
        partIndex === 0 ? input.name : `${input.name} ${partIndex + 1}`,
        templateNames
      )
      report.templates.push(name)
      // i livelli non prendono il nome di una variabile: {nome} mostrerebbe il livello
      const layerNames = new Set<string>(
        [...columnNames, ...variableNames].map((c) => c.toLowerCase())
      )
      const rows: Record<string, string>[] = part.cards.map(() => ({}))
      const headers: string[] = []
      const addCell = (header: string, i: number, value: string): void => {
        if (!headers.includes(header)) headers.push(header)
        rows[i][header] = value
      }
      // valori delle colonne dei dati, carta per carta
      const cardFields = part.cards.map(() => ({}) as Record<string, string>)
      for (const [label, column] of columns) {
        // la posizione dell'elemento è quella del primo comando che usa l'etichetta sulla carta
        const users = s.ops.filter((op) =>
          op.params.some((t) => t.toLowerCase().includes(`[${label}]`))
        )
        part.cards.forEach((c, i) => {
          const op = users.find((o) => !o.cards || o.cards.includes(c))
          const v = s.element(label, c, op ? s.posOf(op, c) : c - 1, finalLabels(s)) ?? ''
          cardFields[i][column] = v
          addCell(column, i, v)
        })
      }

      const convertSide = (cards: number[], rowsIndex: (c: number) => number): LayerOut[] => {
        const out: LayerOut[] = []
        for (const op of s.ops) {
          const on = new Set(active.get(op.id))
          const here = cards.filter((c) => on.has(c))
          if (!here.length) continue
          const built: (Built | null)[] = here.map((c) => {
            try {
              return build(ctx, op, s.resolveParams(op, c), s.resolveParams(op, c, keep), c)
            } catch {
              return null
            }
          })
          const okIdx = built.map((b, i) => (b ? i : -1)).filter((i) => i >= 0)
          if (!okIdx.length) {
            s.skipped.push({ file: op.file, line: op.line, text: op.text, reason: 'syntax' })
            continue
          }
          const firstBuilt = built[okIdx[0]]!
          const layerName = unique(firstBuilt.hint, layerNames)
          const layer: RawLayer = { type: firstBuilt.type, name: layerName }
          const mainKey =
            firstBuilt.type === 'text' ? 'text' : firstBuilt.type === 'image' ? 'src' : 'fill'
          // proprietà uguali per tutte le carte nel template, le altre nel foglio
          const keys = new Set(okIdx.flatMap((i) => Object.keys(built[i]!.props)))
          // i campi nel valore prendono il nome della colonna dei dati ({nome} → {NOME})
          const symbolic = okIdx.map((i) =>
            built[i]!.symbolic?.replace(
              /\{([^{}\s]+)\}/g,
              (_m, n: string) => `{${byClean.get(n.toLowerCase()) ?? n}}`
            )
          )
          // il valore con i campi vale solo se, con i dati di ogni carta, dà lo stesso testo
          const fill = (t: string, fields: Record<string, string>): string =>
            t.replace(/\{([^{}\s]+)\}/g, (m, n: string) => fields[n] ?? m)
          const mainOf = (b: Built): unknown =>
            b.props[b.type === 'text' ? 'text' : b.type === 'image' ? 'src' : 'fill']
          const sameSymbolic =
            symbolic[0] !== undefined &&
            !symbolic[0].includes(NOT_SYMBOLIC) &&
            symbolic.every((x) => x === symbolic[0]) &&
            okIdx.every(
              (i) => fill(symbolic[0]!, cardFields[rowsIndex(here[i])] ?? {}) === mainOf(built[i]!)
            )
          for (const key of keys) {
            const values = okIdx.map((i) => built[i]!.props[key])
            const same = values.every((v) => JSON.stringify(v) === JSON.stringify(values[0]))
            if (key === mainKey && sameSymbolic && symbolic[0] !== values[0]) {
              layer[key] = symbolic[0]
              continue
            }
            if (same || cards.length === 1) {
              if (values[0] !== undefined) layer[key] = values[0]
              continue
            }
            const header = key === mainKey ? layerName : `${layerName}.${key}`
            const cell = (v: unknown): string | null =>
              v === undefined || v === null
                ? key === 'fill' || key === 'stroke'
                  ? 'none'
                  : ''
                : typeof v === 'object'
                  ? 'color' in (v as object) && 'width' in (v as object) && key === 'stroke'
                    ? `${(v as { color: string }).color}/${(v as { width: number }).width}`
                    : null
                  : String(v)
            if (values.some((v) => cell(v) === null)) {
              // proprietà composte che cambiano: vale la prima carta
              layer[key] = values[0]
              note(ctx, 'nandeck.note.firstCard', `${layerName}.${key}`)
              continue
            }
            // il template tiene il valore della prima carta, il foglio quello di ognuna
            layer[key] = values[0]
            okIdx.forEach((i) => addCell(header, rowsIndex(here[i]), cell(built[i]!.props[key])!))
          }
          // visibilità
          let formula: string | null = null
          if (here.length < cards.length) {
            const parts: string[] = []
            let ok = true
            const rf = rangeFormula(s, op, op.rangeText, cards, columns)
            if (rf === null) ok = false
            else if (rf) parts.push(rf)
            for (const c of op.conditions) {
              const f = conditionFormula(c.text, c.negated, columns)
              if (f === null) ok = false
              else parts.push(f)
            }
            if (ok && parts.length) {
              const expr = parts.length === 1 ? `=${parts[0]}` : `=AND(${parts.join('; ')})`
              // la formula deve dare le stesse carte dell'intervallo
              const onSet = new Set(here)
              const matches = cards.every((c) => {
                const r = evaluateFormula(expr, cardFields[rowsIndex(c)] ?? {})
                return (r.value.toUpperCase() === 'TRUE') === onSet.has(c)
              })
              if (matches) formula = parts.length === 1 ? parts[0] : `AND(${parts.join('; ')})`
            }
            if (!formula) {
              const header = `${layerName}.visible`
              cards.forEach((c) => addCell(header, rowsIndex(c), onSet(here, c) ? 'true' : 'false'))
            }
          }
          out.push({ layer, formula, groups: op.layers })
        }
        return out
      }

      const index = new Map(part.cards.map((c, i) => [c, i]))
      const front = convertSide(part.cards, (c) => index.get(c)!)
      const back =
        partIndex === 0 && backIndex > 0
          ? convertSide(groups[backIndex], (c) =>
              groups[backIndex].length === 1 ? 0 : groups[backIndex].indexOf(c)
            )
          : []
      report.cards += part.cards.length
      report.layers += front.length + back.length

      // livelli valore delle colonne dei dati, in cima: le formule e i testi li leggono
      const values: RawLayer[] = [...columns.values()].map((c) => ({ type: 'value', name: c }))
      const template: RawTemplate = {
        name,
        width: r3(s.width),
        height: r3(s.height),
        bleed: 0,
        safeMargin: 3,
        cornerRadius: 0,
        front: [...values, ...nest(front, layerNames)],
        back: nest(back, layerNames)
      }
      const label = [...columns.values()].find((c) => /^(nome|name|titolo|title)$/i.test(c))
      if (label) template.labelField = label
      templates.push(template)
      // né le variabili degli script dopo prendono il nome di un livello
      for (const n of layerNames) variableNames.add(n)

      // foglio: righe uguali e consecutive diventano copie
      const sheetName = unique(sheetNameFor(name), sheetNames)
      const sheetRows: string[][] = []
      const amounts: number[] = []
      let prev = ''
      for (const r of rows) {
        const line = headers.map((h) => r[h] ?? '')
        const key = JSON.stringify(line)
        if (key === prev && sheetRows.length) amounts[amounts.length - 1]++
        else {
          sheetRows.push(line)
          amounts.push(1)
        }
        prev = key
      }
      sheets.push({
        name: sheetName,
        headers: ['amount', ...headers],
        rows: sheetRows.map((r, i) => [String(amounts[i]), ...r])
      })
      sets.push({ name, template: name, ...(sheetName !== name ? { sheet: sheetName } : {}) })
    })

    for (const [key, what] of ctx.notes)
      report.notes.push(msg(key, { lines: [...what].slice(0, 12).join(', ') }))
    if (ctx.unsupportedTags.size)
      report.notes.push(
        msg('nandeck.note.htmlTags', {
          tags: [...ctx.unsupportedTags].map((t) => `<${t}>`).join(' ')
        })
      )
  }

  return {
    templates,
    sheets,
    sets,
    variables,
    images: [...images].sort(),
    fonts: [...fonts].filter(Boolean).sort(),
    reports
  }
}

const onSet = (cards: number[], c: number): boolean => cards.includes(c)

/** Le etichette alla fine dello script: per i valori delle colonne */
function finalLabels(s: NandeckScript): Parameters<NandeckScript['element']>[3] {
  const last = s.ops[s.ops.length - 1]
  return last ? last.labels : (new Map() as Parameters<NandeckScript['element']>[3])
}

/**
 * Livelli nell'ordine di Stella (il primo è sopra) con i gruppi: i gruppi LAYER di nanDECK
 * (opacità) e, dentro, i livelli consecutivi con la stessa formula di visibilità.
 */
function nest(items: LayerOut[], names: Set<string>): RawLayer[] {
  const build = (list: LayerOut[], depth: number): RawLayer[] => {
    const out: RawLayer[] = []
    for (let i = 0; i < list.length;) {
      const g = list[i].groups[depth]
      if (g) {
        let j = i
        while (j < list.length && list[j].groups[depth]?.id === g.id) j++
        out.push({
          type: 'group',
          name: unique('layer', names),
          opacity: r3(g.opacity),
          children: build(list.slice(i, j), depth + 1)
        })
        i = j
        continue
      }
      const f = list[i].formula
      if (f) {
        let j = i
        while (j < list.length && list[j].formula === f && !list[j].groups[depth]) j++
        out.push({
          type: 'group',
          name: unique(groupName(f), names),
          source: { kind: 'formula', expr: `=${f}` },
          children: list
            .slice(i, j)
            .map((x) => x.layer)
            .reverse()
        })
        i = j
        continue
      }
      out.push(list[i].layer)
      i++
    }
    return out.reverse()
  }
  return build(items, 0)
}

/** Nome del gruppo di una formula: if_colonna_valore */
function groupName(formula: string): string {
  const m = /\{([^}]+)\}\s*(?:=|<>)?\s*"?([^"]*)"?/.exec(formula)
  return cleanName(m ? `if_${m[1]}_${m[2]}` : 'if').slice(0, 40)
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
