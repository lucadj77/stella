import type { LoadedSet, ProjectFile } from '../project'
import { msg, type Message } from '../messages'
import { markupProblems, markupRefs } from './markup'
import { substituteFields } from './bind'
import { imageVariable, variableFields, type Variables } from './variables'
import { resolveAsset } from './assets'
import { today } from './system'
import type { GroupLayer, HAlign, Layer, Side, Template } from './template'
import { worldBounds } from './geometry'
import { arrangeGroup } from './arrange'
import type { Bounds } from './edit'
import { blockSizeLine, blockSizeLines, parseSetup, SETUP_FENCE, type Setup } from './setup'
import {
  cellParts,
  DEFAULT_TABLE_STYLE,
  isTableStyleLine,
  parseTableStyle,
  tableStyleSource,
  type TableStyle
} from './docTable'
import { isBoxEnd, isBoxStart, parseBoxStyle, type DocBox } from './docBox'
import { isLanguageCode, localizationOf, type Localization } from './language'

// Documenti del progetto (docs/<nome>.md): regolamento, sell sheet, appendici. Sono Markdown con
// il markup di Stella nel testo ({icona}, [testo]{.stile}) e le carte del progetto come immagini:
// ![Mago](card:Personaggi/nome=Mago) disegna la carta dal progetto, quindi si aggiorna da sola.

export const DOCUMENTS_DIR = 'docs'

/** Un'immagine scritta come ![testo](sorgente), con la posizione nel documento */
export interface DocImage {
  alt: string
  src: string
  from: number
  to: number
}

export interface DocListItem {
  text: string
  /** Livello di rientro, da 0 */
  depth: number
  ordered: boolean
  /** Numero della voce negli elenchi numerati */
  number: number
}

export type DocBlock = {
  from: number
  /** Riquadro colorato in cui sta il blocco (docBox.ts); lo stesso oggetto per tutti i suoi blocchi */
  box?: DocBox
} & (
  | { kind: 'heading'; level: 1 | 2 | 3; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: DocListItem[] }
  | { kind: 'quote'; text: string }
  | {
      kind: 'table'
      /** Vuota in una tabella senza intestazione (le proprietà del documento) */
      header: string[]
      align: (HAlign | null)[]
      rows: string[][]
      /** Bordi, sfondi e larghezze, dal commento <!-- table ... --> sotto la tabella (docTable.ts) */
      style: TableStyle
      /** Opzioni del commento <!-- table ... --> che non si capiscono */
      styleBad: string[]
      /** Fine dell'ultima riga della tabella nel testo: lo strumento tabella la riscrive */
      to: number
    }
  | { kind: 'rule' }
  | { kind: 'code'; text: string }
  /** Una riga con sole immagini: una o più carte (o immagini) affiancate */
  | { kind: 'figure'; images: DocImage[] }
  /** Anatomia di una carta: la carta con le etichette collegate ai suoi livelli */
  | ({ kind: 'anatomy'; to: number } & Anatomy)
  /** Schema della preparazione del tavolo (model/setup.ts) */
  | ({ kind: 'setup'; to: number } & Setup)
)

/** Un'etichetta dell'anatomia: il livello che indica e il testo */
export interface Callout {
  layer: string
  label: string
  /** Lato dell'etichetta; di base quello più vicino al livello */
  side?: 'left' | 'right'
  /** Faccia del livello quando l'anatomia mostra fronte e retro; di base il fronte */
  face?: Side
  /** Posizione della riga nel testo */
  from: number
  to: number
}

export interface Anatomy {
  /** Riferimento alla carta, come in card: (anche senza il prefisso) */
  card: string
  cardFrom: number
  /** Fronte e retro affiancati (riga `sides: both`): le etichette del retro stanno a destra */
  both: boolean
  callouts: Callout[]
  /** Larghezza massima del blocco in frazione della riga (`width: 60%`); null = tutta */
  width: number | null
  /** Corpo delle etichette in frazione di quello di base (`font: 90%`); null = di base */
  font: number | null
  /** Righe che non si capiscono */
  bad: { from: number; to: number }[]
}

/** Il blocco ```anatomy: le sue righe sono card: … e - livello: etichetta */
export const ANATOMY_FENCE = 'anatomy'
const CALLOUT_LINE =
  /^\s*[-*]\s*(.+?)(?:\s*\(((?:\s*(?:left|right|front|back)\s*,?)+)\))?\s*:\s*(.*)$/

function parseAnatomy(lines: string[], starts: number[]): Anatomy {
  const out: Anatomy = {
    card: '',
    cardFrom: -1,
    both: false,
    callouts: [],
    width: null,
    font: null,
    bad: []
  }
  lines.forEach((l, k) => {
    const from = starts[k]
    const to = from + l.length
    if (!l.trim() || l.trim().startsWith('#')) return
    const card = /^\s*card\s*:\s*(.*)$/i.exec(l)
    if (card) {
      out.card = card[1].trim()
      out.cardFrom = from
      return
    }
    const sides = /^\s*sides\s*:\s*(both|one)\s*$/i.exec(l)
    if (sides) {
      out.both = sides[1].toLowerCase() === 'both'
      return
    }
    const size = blockSizeLine(l)
    if (size) {
      if (size.value === null) out.bad.push({ from, to })
      else out[size.key] = size.value
      return
    }
    const m = CALLOUT_LINE.exec(l)
    if (m) {
      const opts = (m[2] ?? '').split(/[\s,]+/)
      const side = opts.find((o) => o === 'left' || o === 'right') as 'left' | 'right' | undefined
      const face = opts.find((o) => o === 'front' || o === 'back') as Side | undefined
      out.callouts.push({
        layer: m[1].trim(),
        label: m[3].trim(),
        ...(side ? { side } : {}),
        ...(face ? { face } : {}),
        from,
        to
      })
    } else out.bad.push({ from, to })
  })
  return out
}

/** Testo del blocco anatomia di una carta */
export function anatomySource(
  card: string,
  callouts: Omit<Callout, 'from' | 'to'>[],
  both = false,
  size: { width?: number | null; font?: number | null } = {}
): string {
  const opts = (c: Omit<Callout, 'from' | 'to'>): string => {
    const list = [both && c.face === 'back' ? 'back' : '', !both && c.side ? c.side : ''].filter(
      Boolean
    )
    return list.length ? ` (${list.join(', ')})` : ''
  }
  return [
    '```' + ANATOMY_FENCE,
    `card: ${card.replace(/^card:/i, '')}`,
    ...(both ? ['sides: both'] : []),
    ...blockSizeLines(size),
    ...callouts.map((c) => `- ${c.layer}${opts(c)}: ${c.label.replace(/\n/g, ' ')}`),
    '```'
  ].join('\n')
}

/**
 * Riquadro sulla carta del livello con questo nome (anche in un gruppo, dove è disegnato), o
 * null. Prima il nome esatto, poi senza badare alle maiuscole.
 */
export function layerBounds(layers: Layer[], name: string): Bounds | null {
  const find = (
    list: Layer[],
    chain: GroupLayer[],
    same: (a: string) => boolean
  ): Bounds | null => {
    for (const l of list) {
      if (same(l.name) && l.type !== 'value') return worldBounds(l, chain)
      if (l.type === 'group') {
        const found = find(arrangeGroup(l).children, [...chain, l], same)
        if (found) return found
      }
    }
    return null
  }
  return (
    find(layers, [], (a) => a === name) ??
    find(layers, [], (a) => a.toLowerCase() === name.trim().toLowerCase())
  )
}

const IMAGE = /!\[([^\]]*)\]\(([^)]*)\)/g
const ONLY_IMAGES = /^\s*(?:!\[[^\]]*\]\([^)]*\)\s*)+$/
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/
const TABLE_SEPARATOR = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/

/** Divide il documento in blocchi: titoli, paragrafi, elenchi, citazioni, tabelle, immagini */
export function parseDocument(src: string): DocBlock[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const starts: number[] = []
  let pos = 0
  for (const l of lines) {
    starts.push(pos)
    pos += l.length + 1
  }
  const blocks: DocBlock[] = []
  // le impostazioni della pagina in testa non sono testo; le proprietà si mostrano solo se chiesto
  let i = frontMatterLines(lines)
  if (i && documentSettings(src).settings.showProperties) {
    const props = documentProperties(src).filter((p) => p.value.trim())
    if (props.length)
      blocks.push({
        kind: 'table',
        header: [],
        align: [null, null],
        rows: props.map((p) => [`**${p.key}**`, p.value]),
        style: { ...DEFAULT_TABLE_STYLE, header: null },
        styleBad: [],
        from: 0,
        to: starts[i - 1] + lines[i - 1].length
      })
  }
  const blank = (l: string | undefined): boolean => l === undefined || l.trim() === ''
  while (i < lines.length) {
    const line = lines[i]
    const from = starts[i]
    // le righe dei riquadri non sono blocchi: i blocchi tra le due stanno nel riquadro (in fondo)
    if (blank(line) || isBoxStart(line) || isBoxEnd(line)) {
      i++
      continue
    }
    const fence = /^\s*(```|~~~)\s*([\w-]*)/.exec(line)
    if (fence) {
      const body: string[] = []
      const first = i + 1
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith(fence[1])) body.push(lines[i++])
      const to = i < lines.length ? starts[i] + lines[i].length : src.length
      i++
      if (fence[2].toLowerCase() === SETUP_FENCE)
        blocks.push({
          kind: 'setup',
          ...parseSetup(body, starts.slice(first, first + body.length)),
          from,
          to
        })
      else if (fence[2].toLowerCase() === ANATOMY_FENCE)
        blocks.push({
          kind: 'anatomy',
          ...parseAnatomy(body, starts.slice(first, first + body.length)),
          from,
          to
        })
      else blocks.push({ kind: 'code', text: body.join('\n'), from })
      continue
    }
    const heading = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
    if (heading) {
      const level = Math.min(3, heading[1].length) as 1 | 2 | 3
      blocks.push({ kind: 'heading', level, text: heading[2], from })
      i++
      continue
    }
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push({ kind: 'rule', from })
      i++
      continue
    }
    if (/^\s{0,3}>/.test(line)) {
      const body: string[] = []
      while (i < lines.length && /^\s{0,3}>/.test(lines[i]))
        body.push(lines[i++].replace(/^\s{0,3}> ?/, ''))
      blocks.push({ kind: 'quote', text: joinLines(body), from })
      continue
    }
    if (LIST_ITEM.test(line)) {
      const items: DocListItem[] = []
      // rientri delle voci aperte: una voce più rientrata della precedente scende di livello
      const indents: number[] = []
      /** Righe di ogni voce */
      const parts: string[][] = []
      while (i < lines.length) {
        const l = lines[i]
        const m = LIST_ITEM.exec(l)
        if (m) {
          const indent = m[1].replace(/\t/g, '    ').length
          while (indents.length && indent < indents[indents.length - 1]) indents.pop()
          if (!indents.length || indent > indents[indents.length - 1]) indents.push(indent)
          const ordered = /\d/.test(m[2])
          // il numero scritto: conta solo quello della prima voce (numberItems)
          items.push({
            text: '',
            depth: indents.length - 1,
            ordered,
            number: parseInt(m[2], 10) || 0
          })
          parts.push([m[3]])
          i++
          continue
        }
        if (blank(l)) {
          // una riga vuota chiude l'elenco, a meno che dopo non venga un'altra voce dello stesso
          // tipo (puntato o numerato)
          let j = i
          while (j < lines.length && blank(lines[j])) j++
          const after = LIST_ITEM.exec(lines[j] ?? '')
          if (after && /\d/.test(after[2]) === items[0].ordered) {
            i = j
            continue
          }
          break
        }
        // riga che continua la voce: rientrata, o subito dopo senza riga vuota
        if (!startsBlock(l)) {
          parts[parts.length - 1].push(l.trim())
          i++
          continue
        }
        break
      }
      items.forEach((it, k) => (it.text = joinLines(parts[k])))
      blocks.push({ kind: 'list', items: numberItems(items), from })
      continue
    }
    if (line.includes('|') && TABLE_SEPARATOR.test(lines[i + 1] ?? '')) {
      const header = splitRow(line)
      const align = splitRow(lines[i + 1]).map((c): HAlign | null => {
        const left = c.startsWith(':')
        const right = c.endsWith(':')
        return left && right ? 'center' : right ? 'right' : left ? 'left' : null
      })
      i += 2
      const rows: string[][] = []
      while (i < lines.length && !blank(lines[i]) && lines[i].includes('|')) {
        const cells = splitRow(lines[i++])
        rows.push(header.map((_, k) => cells[k] ?? ''))
      }
      const { style, bad: styleBad } = isTableStyleLine(lines[i])
        ? parseTableStyle(lines[i++])
        : { style: { ...DEFAULT_TABLE_STYLE }, bad: [] }
      blocks.push({
        kind: 'table',
        header,
        align: header.map((_, k) => align[k] ?? null),
        rows,
        style,
        styleBad,
        from,
        to: starts[i - 1] + lines[i - 1].length
      })
      continue
    }
    // paragrafo: fino a una riga vuota o all'inizio di un altro blocco
    const body: string[] = []
    while (i < lines.length && !blank(lines[i]) && (body.length === 0 || !startsBlock(lines[i])))
      body.push(lines[i++])
    const text = body.join('\n')
    if (ONLY_IMAGES.test(text)) {
      const images: DocImage[] = []
      for (const m of text.matchAll(IMAGE)) {
        const at = from + (m.index ?? 0)
        images.push({ alt: m[1], src: m[2].trim(), from: at, to: at + m[0].length })
      }
      blocks.push({ kind: 'figure', images, from })
    } else blocks.push({ kind: 'paragraph', text: joinLines(body), from })
  }
  const boxes = documentBoxes(src)
  for (const b of blocks) {
    const inside = boxes.find((x) => b.from > x.headTo && b.from < x.to)
    if (inside) b.box = inside
  }
  return blocks
}

/** I riquadri del documento, anche quelli vuoti */
export function documentBoxes(src: string): DocBox[] {
  const out: DocBox[] = []
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  let pos = 0
  let open: DocBox | null = null
  let fence: string | null = null
  for (const line of lines) {
    const f = /^\s*(```|~~~)/.exec(line)
    if (fence) {
      if (line.trimStart().startsWith(fence)) fence = null
    } else if (f) fence = f[1]
    else if (isBoxStart(line) || isBoxEnd(line)) {
      if (open) {
        open.endFrom = isBoxEnd(line) ? pos : null
        open.to = isBoxEnd(line) ? pos + line.length : pos
        open = null
      }
      if (isBoxStart(line)) {
        const { style, bad } = parseBoxStyle(line)
        open = { style, bad, from: pos, headTo: pos + line.length, endFrom: null, to: src.length }
        out.push(open)
      }
    }
    pos += line.length + 1
  }
  return out
}

/** Una riga che apre un blocco nuovo anche senza una riga vuota prima */
function startsBlock(l: string): boolean {
  return (
    /^\s{0,3}(#{1,6}\s|>|```|~~~)/.test(l) ||
    isBoxStart(l) ||
    isBoxEnd(l) ||
    LIST_ITEM.test(l) ||
    /^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(l)
  )
}

/** Numeri delle voci: ogni elenco numerato riparte dal numero scritto nella sua prima voce */
function numberItems(items: DocListItem[]): DocListItem[] {
  /** Prossimo numero per livello; si azzera quando si torna a un livello più esterno */
  const next: (number | undefined)[] = []
  return items.map((it) => {
    next.length = it.depth + 1
    if (!it.ordered) {
      next[it.depth] = undefined
      return { ...it, number: 0 }
    }
    const number = next[it.depth] ?? (it.number || 1)
    next[it.depth] = number + 1
    return { ...it, number }
  })
}

/**
 * Righe di un paragrafo unite come nel Markdown: un a capo semplice è uno spazio; due spazi o
 * "\" a fine riga vanno a capo
 */
function joinLines(lines: string[]): string {
  let out = ''
  lines.forEach((l, k) => {
    if (k === lines.length - 1) {
      out += l.trim()
      return
    }
    if (/ {2,}$/.test(l) || /(^|[^\\])\\$/.test(l.trimEnd())) {
      out += l.trimEnd().replace(/\\$/, '') + '\n'
      return
    }
    out += l.trim() + ' '
  })
  return out.trim()
}

/** Testo Markdown di una tabella, con le colonne allineate perché si legga anche così */
export function tableSource(
  header: string[],
  align: (HAlign | null)[],
  rows: string[][],
  style: TableStyle = DEFAULT_TABLE_STYLE
): string {
  const cell = (s: string): string => s.replace(/\r?\n/g, ' ').replace(/\\?\|/g, '\\|').trim()
  const all = [header, ...rows].map((r) => header.map((_, k) => cell(r[k] ?? '')))
  const width = header.map((_, k) => Math.max(3, ...all.map((r) => r[k].length)))
  const line = (r: string[]): string => `| ${r.map((c, k) => c.padEnd(width[k])).join(' | ')} |`
  const sep = header.map((_, k) => {
    const a = align[k]
    const dashes = '-'.repeat(width[k] - (a === 'center' ? 2 : a ? 1 : 0))
    return a === 'center'
      ? `:${dashes}:`
      : a === 'right'
        ? `${dashes}:`
        : a === 'left'
          ? `:${dashes}`
          : dashes
  })
  const look = tableStyleSource(style)
  return [
    line(all[0]),
    `| ${sep.join(' | ')} |`,
    ...all.slice(1).map(line),
    ...(look ? [look] : [])
  ].join('\n')
}

/** Celle di una riga di tabella; \| è una barra nel testo */
function splitRow(line: string): string[] {
  let l = line.trim()
  if (l.startsWith('|')) l = l.slice(1)
  if (l.endsWith('|') && !l.endsWith('\\|')) l = l.slice(0, -1)
  const cells: string[] = []
  let cell = ''
  for (let k = 0; k < l.length; k++) {
    if (l[k] === '\\' && l[k + 1] === '|') {
      cell += '|'
      k++
    } else if (l[k] === '|') {
      cells.push(cell.trim())
      cell = ''
    } else cell += l[k]
  }
  cells.push(cell.trim())
  return cells
}

// ——— Pagina ———

/** Aspetto della pagina, scritto in testa al documento tra due righe --- */
export interface DocSettings {
  page: DocPage
  /** Margini in mm */
  margin: number
  /** Famiglia del testo; vuota per quella di base */
  font: string
  /** Famiglia dei titoli; vuota per quella del testo */
  headingFont: string
  /** Corpo del testo in punti */
  size: number
  /** Interlinea, in multipli del corpo */
  lineHeight: number
  /** Spazio dopo ogni paragrafo, in punti */
  paragraphSpacing: number
  align: 'left' | 'justify'
  color: string
  /** Colore dei titoli; vuoto per quello del testo */
  headingColor: string
  /** Le proprietà del documento (tags, autore…) si mostrano in testa, in una tabella */
  showProperties: boolean
  /** Lingua delle carte, degli schemi e del nome del progetto; vuota per la principale */
  language: string
}

export type DocPage = 'A4' | 'A5' | 'Letter'

/** Larghezza e altezza delle pagine in mm */
export const DOC_PAGES: Record<DocPage, [number, number]> = {
  A4: [210, 297],
  A5: [148, 210],
  Letter: [215.9, 279.4]
}

export const DEFAULT_DOC_SETTINGS: DocSettings = {
  page: 'A4',
  margin: 18,
  font: '',
  headingFont: '',
  size: 11,
  lineHeight: 1.4,
  paragraphSpacing: 6,
  align: 'left',
  color: '#1d1d1f',
  headingColor: '',
  showProperties: false,
  language: ''
}

const SETTING_KEYS = Object.keys(DEFAULT_DOC_SETTINGS) as (keyof DocSettings)[]
const FRONT_LINE = /^\s*([A-Za-z\u00C0-\u024F][\w\u00C0-\u024F-]*)\s*:(.*)$/

/**
 * Righe della testa del documento (--- chiave: valore ---, come il frontmatter YAML di Obsidian),
 * 0 se non c'è. La prima riga piena deve essere una chiave; le righe che non lo sono continuano il
 * valore della chiave sopra (elenchi `- voce`, testi su più righe).
 */
function frontMatterLines(lines: string[]): number {
  if (lines[0]?.trim() !== '---') return 0
  let keyed = false
  for (let k = 1; k < lines.length; k++) {
    const l = lines[k]
    if (l.trim() === '---') return keyed ? k + 1 : 0
    if (!l.trim() || l.trim().startsWith('#')) continue
    if (!keyed && !FRONT_LINE.test(l)) return 0
    keyed = true
  }
  return 0
}

/** Una voce della testa: chiave, valore (con le righe che lo continuano) e posizione */
interface FrontEntry {
  key: string
  /** Righe del valore: la prima dopo i due punti, poi quelle che la continuano */
  value: string[]
  /** Righe della testa (contando da quella dopo ---) che la voce occupa */
  first: number
  last: number
  from: number
  to: number
}

function frontEntries(lines: string[]): FrontEntry[] {
  const end = frontMatterLines(lines)
  const out: FrontEntry[] = []
  let pos = lines[0].length + 1
  for (let k = 1; k < end - 1; k++) {
    const l = lines[k]
    const at = pos
    pos += l.length + 1
    // una chiave sta a inizio riga; più a destra è un valore annidato, che continua quello sopra
    const m = /^\S/.test(l) && !l.trim().startsWith('#') ? FRONT_LINE.exec(l) : null
    if (m) out.push({ key: m[1], value: [m[2]], first: k, last: k, from: at, to: at + l.length })
    else if (out.length && l.trim() && !l.trim().startsWith('#')) {
      const e = out[out.length - 1]
      e.value.push(l)
      e.last = k
      e.to = at + l.length
    }
  }
  return out
}

/** Una proprietà del documento: la chiave e il valore come testo, o come elenco */
export interface DocProperty {
  key: string
  value: string
  /** Il valore è un elenco ([a, b] o righe - voce): nel campo le voci sono separate da virgole */
  list: boolean
}

const unquote = (v: string): string => {
  const t = v.trim()
  if (/^"(.*)"$/s.test(t))
    return t
      .slice(1, -1)
      .replace(/\\(["\\])/g, '$1')
      .replace(/\\n/g, '\n')
  if (/^'(.*)'$/s.test(t)) return t.slice(1, -1).replace(/''/g, "'")
  return t
}

/** Il valore YAML di una voce, letto alla buona: testo, testo tra virgolette su più righe, elenco */
function propertyOf(e: FrontEntry): DocProperty {
  const [head, ...rest] = e.value
  const first = head.trim()
  const items = rest.map((l) => l.trim())
  if (!first && items.length && items.every((l) => l.startsWith('- ')))
    return { key: e.key, value: items.map((l) => unquote(l.slice(2))).join(', '), list: true }
  if (/^\[.*\]$/s.test(first) && !items.length)
    return {
      key: e.key,
      value: first
        .slice(1, -1)
        .split(',')
        .map(unquote)
        .filter((x) => x !== '')
        .join(', '),
      list: true
    }
  // un testo su più righe: le righe si uniscono con uno spazio, come in YAML
  return { key: e.key, value: unquote([first, ...items].join(' ')), list: false }
}

/** Le proprietà del documento: le voci della testa che non sono impostazioni della pagina */
export function documentProperties(src: string): DocProperty[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  return frontEntries(lines)
    .filter((e) => !settingKey(e.key))
    .map(propertyOf)
}

/** Un valore scritto in YAML: tra virgolette quando serve */
function yamlValue(p: DocProperty): string {
  const scalar = (v: string): string =>
    v === '' ||
    /^[\s[\]{}"'#&*!|>%@`,-]|[\s]$|: | #|\n/.test(v) ||
    /^(true|false|null|yes|no|~)$/i.test(v)
      ? JSON.stringify(v)
      : v
  if (!p.list) return p.value === '' ? '' : scalar(p.value)
  const items = p.value
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
  return `[${items.map((x) => (/[,[\]]/.test(x) ? JSON.stringify(x) : scalar(x))).join(', ')}]`
}

/**
 * Il documento con le proprietà cambiate: si riscrivono le voci delle proprietà, nell'ordine dato,
 * e le impostazioni della pagina restano com'erano
 */
export function withDocumentProperties(src: string, props: DocProperty[]): string {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const end = frontMatterLines(lines)
  const entries = frontEntries(lines)
  const settingLines = entries
    .filter((e) => settingKey(e.key))
    .flatMap((e) => lines.slice(e.first, e.last + 1))
  // una proprietà che non è cambiata resta scritta com'era (virgolette, elenco su più righe)
  const kept = new Map(
    entries.filter((e) => !settingKey(e.key)).map((e) => [e.key, { e, p: propertyOf(e) }])
  )
  const propLines = props
    .filter((p) => p.key.trim())
    .flatMap((p) => {
      const old = kept.get(p.key.trim())
      if (old && old.p.value === p.value && old.p.list === p.list)
        return lines.slice(old.e.first, old.e.last + 1)
      return [`${p.key.trim()}:${yamlValue(p) ? ' ' + yamlValue(p) : ''}`]
    })
  const head = [...propLines, ...settingLines]
  let body = lines.slice(end).join('\n')
  if (!head.length) return end ? body.replace(/^\n+/, '') : body
  if (!end) body = '\n' + body
  return ['---', ...head, '---', body].join('\n')
}

/**
 * Il nome di una proprietà: lettere, cifre, - e _, che comincia con una lettera, e non quello di
 * un'impostazione della pagina (font, size…), che si legge come impostazione
 */
export function isPropertyKey(key: string): boolean {
  return /^[A-Za-z\u00C0-\u024F][\w\u00C0-\u024F-]*$/.test(key) && !settingKey(key)
}

/** L'impostazione con questo nome, senza badare alle maiuscole */
function settingKey(name: string): keyof DocSettings | undefined {
  // lang si capisce come language
  if (name.toLowerCase() === 'lang') return 'language'
  return SETTING_KEYS.find((x) => x.toLowerCase() === name.toLowerCase())
}

/** Distanza tra due parole (lettere da cambiare, aggiungere o togliere) */
function editDistance(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]
    d[0] = i
    for (let j = 1; j <= b.length; j++) {
      const t = d[j]
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = t
    }
  }
  return d[b.length]
}

/** Un valore valido per l'impostazione, o null */
function settingValue<K extends keyof DocSettings>(key: K, raw: string): DocSettings[K] | null {
  const v = raw
    .trim()
    .replace(/^(["'])(.*)\1$/, '$2')
    .trim()
  const num = (min: number, max: number): number | null => {
    const n = Number(v.replace(',', '.'))
    return v !== '' && Number.isFinite(n) && n >= min && n <= max ? n : null
  }
  let out: unknown
  switch (key) {
    case 'page':
      out = (Object.keys(DOC_PAGES) as DocPage[]).find((p) => p.toLowerCase() === v.toLowerCase())
      break
    case 'margin':
      out = num(0, 60)
      break
    case 'size':
      out = num(5, 30)
      break
    case 'lineHeight':
      out = num(0.8, 3)
      break
    case 'paragraphSpacing':
      out = num(0, 40)
      break
    case 'align':
      out = v === 'left' || v === 'justify' ? v : null
      break
    case 'showProperties':
      out = /^(true|yes|sì|si)$/i.test(v) ? true : /^(false|no)$/i.test(v) ? false : null
      break
    case 'language':
      out = v === '' || isLanguageCode(v) ? v : null
      break
    default:
      out = v
  }
  return (out ?? null) as DocSettings[K] | null
}

/** Impostazioni della pagina scritte in testa al documento, con quelle scritte male */
export function documentSettings(src: string): {
  settings: DocSettings
  problems: DocumentProblem[]
} {
  const settings = { ...DEFAULT_DOC_SETTINGS }
  const problems: DocumentProblem[] = []
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  for (const e of frontEntries(lines)) {
    const at = { from: e.from, to: e.to }
    const key = settingKey(e.key)
    if (!key) {
      // le altre voci sono proprietà del documento; una quasi uguale a un'impostazione è un errore
      if (SETTING_KEYS.some((x) => editDistance(x.toLowerCase(), e.key.toLowerCase()) <= 1))
        problems.push({ message: msg('doc.setting.unknown', { name: e.key }), ...at })
      continue
    }
    const value = settingValue(key, e.value.join(' '))
    if (value === null)
      problems.push({
        message: msg('doc.setting.bad', { name: key, value: e.value.join(' ').trim() }),
        ...at
      })
    else (settings as Record<string, unknown>)[key] = value
  }
  return { settings, problems }
}

/**
 * Il documento con le impostazioni cambiate: si riscrive solo la testa; quelle tornate al valore
 * di base si tolgono, e senza impostazioni la testa sparisce
 */
export function withDocumentSettings(src: string, change: Partial<DocSettings>): string {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const end = frontMatterLines(lines)
  const head = end ? lines.slice(1, end - 1) : []
  let body = lines.slice(end).join('\n')
  for (const key of Object.keys(change) as (keyof DocSettings)[]) {
    const value = change[key]
    const at = head.findIndex((l) => settingKey(FRONT_LINE.exec(l)?.[1] ?? '') === key)
    const keep = value !== undefined && value !== DEFAULT_DOC_SETTINGS[key]
    const line = `${key}: ${value}`
    if (at >= 0) {
      if (keep) head[at] = line
      else head.splice(at, 1)
    } else if (keep) head.push(line)
  }
  if (!head.some((l) => l.trim())) return end ? body.replace(/^\n+/, '') : body
  if (!end) body = '\n' + body
  return ['---', ...head, '---', body].join('\n')
}

// ——— Testo ———

/** Ciò che il testo di un documento richiama del progetto */
export interface DocumentContext {
  project?: string
  sets?: LoadedSet[]
  assets?: string[]
  styles?: Record<string, string>
  variables?: Variables
  /** Per controllare i livelli richiamati dalle anatomie delle carte */
  templates?: Template[]
  /** Lingue del progetto (la principale per prima), per controllare quella del documento */
  languages?: string[]
  /** Lingua del documento, se non è la principale: le variabili di testo si traducono */
  language?: string
}

/**
 * La lingua in cui il documento disegna le carte: `override` (export-doc --lang) o la sua
 * impostazione language; nessuna traduzione per la lingua principale o senza impostazione
 */
export function documentLocalization(
  file: Pick<ProjectFile, 'languages' | 'names'>,
  sets: Pick<LoadedSet, 'name' | 'names'>[],
  src: string,
  override?: string
): Localization | undefined {
  return localizationOf(file, sets, override || documentSettings(src).settings.language)
}

/**
 * Testo di un blocco pronto per il markup: variabili di testo e valore e {project.name} e {date}
 * sostituite; un collegamento [testo](indirizzo) diventa testo sottolineato
 */
export function documentText(text: string, ctx: DocumentContext): string {
  const fields = {
    ...variableFields(ctx.variables, ctx.language),
    'project.name': ctx.project ?? '',
    date: today()
  }
  return substituteFields(text, fields).replace(
    /(?<![!\\])\[([^\]]+)\]\(([^)\s]+)\)/g,
    (_, label: string) => `[${label}]{underline}`
  )
}

// ——— Carte ———

/** Una carta richiamata con card:Set/3 o card:Set/campo=valore, con le opzioni dopo ? */
export interface CardRef {
  set: string
  /** Riga del set, da 1 */
  row?: number
  field?: string
  value?: string
  side: Side
  /** Larghezza in mm; di base la misura vera della carta */
  width?: number
  /** Allineamento della riga di immagini; di base al centro */
  align?: FigureAlign
}

export type FigureAlign = 'left' | 'center' | 'right'
const ALIGNS: FigureAlign[] = ['left', 'center', 'right']

/** Opzioni di un'immagine degli asset, dopo ? come per le carte: icone/mappa.png?width=40 */
export interface ImageOptions {
  /** Larghezza in mm; di base la misura dell'immagine, ridotta se non ci sta */
  width?: number
  align?: FigureAlign
}

/**
 * La sorgente di un'immagine degli asset divisa nel nome del file e nelle opzioni; un indirizzo
 * web resta intero, perché ? fa parte dell'indirizzo. `bad` sono le opzioni che non si capiscono.
 */
export function splitImageSource(src: string): {
  path: string
  options: ImageOptions
  bad: string[]
} {
  const raw = src.trim()
  const q = raw.indexOf('?')
  if (q < 0 || /^https?:\/\//i.test(raw)) return { path: raw, options: {}, bad: [] }
  const options: ImageOptions = {}
  const bad: string[] = []
  for (const part of raw.slice(q + 1).split('&')) {
    if (!part.trim()) continue
    const [k, v = ''] = part.split('=').map((x) => decode(x).trim())
    if (k === 'width' && Number(v) > 0) options.width = Number(v)
    else if (k === 'align' && ALIGNS.includes(v as FigureAlign)) options.align = v as FigureAlign
    else bad.push(part)
  }
  return { path: raw.slice(0, q).trim(), options, bad }
}

/** La sorgente di un'immagine degli asset con le sue opzioni, come la legge splitImageSource */
export function imageSourceWith(path: string, options: ImageOptions): string {
  const opts = [
    options.width ? `width=${options.width}` : '',
    options.align && options.align !== 'center' ? `align=${options.align}` : ''
  ].filter(Boolean)
  return `${path}${opts.length ? `?${opts.join('&')}` : ''}`
}

/** Allineamento di una riga di immagini: il primo scritto, di base al centro */
export function figureAlign(images: { src: string }[]): FigureAlign {
  for (const img of images) {
    const ref = isCardSource(img.src) ? parseCardRef(img.src) : splitImageSource(img.src).options
    if (!isMessage(ref) && ref.align) return ref.align
  }
  return 'center'
}

export const CARD_PREFIX = 'card:'

export const isCardSource = (src: string): boolean =>
  src.trim().toLowerCase().startsWith(CARD_PREFIX)

const decode = (s: string): string => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** Legge card:Set/3?side=back&width=40; un errore se è scritto male */
export function parseCardRef(src: string): CardRef | Message {
  const raw = src.trim()
  const bad = msg('doc.card.badRef', { ref: raw })
  if (!isCardSource(raw)) return bad
  const body = raw.slice(CARD_PREFIX.length)
  const q = body.indexOf('?')
  const path = q < 0 ? body : body.slice(0, q)
  const slash = path.indexOf('/')
  if (slash <= 0) return bad
  const set = decode(path.slice(0, slash)).trim()
  const selector = decode(path.slice(slash + 1)).trim()
  if (!set || !selector) return bad
  const ref: CardRef = { set, side: 'front' }
  const eq = selector.indexOf('=')
  if (eq > 0) {
    ref.field = selector.slice(0, eq).trim()
    ref.value = selector.slice(eq + 1).trim()
  } else if (/^\d+$/.test(selector) && Number(selector) > 0) ref.row = Number(selector)
  else return bad
  if (q >= 0)
    for (const part of body.slice(q + 1).split('&')) {
      if (!part.trim()) continue
      const [k, v = ''] = part.split('=').map((x) => decode(x).trim())
      if (k === 'side' && (v === 'front' || v === 'back')) ref.side = v
      else if (k === 'width' && Number(v) > 0) ref.width = Number(v)
      else if (k === 'align' && ALIGNS.includes(v as FigureAlign)) ref.align = v as FigureAlign
      else return msg('doc.card.badOption', { option: part, ref: raw })
    }
  return ref
}

/** Testo da scrivere per richiamare una carta, come lo legge parseCardRef */
export function cardRefSource(ref: CardRef): string {
  // una parentesi chiusa o un ? finirebbero il riferimento: si scrivono codificati
  const enc = (s: string): string =>
    s.replace(/[%)?&]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
  const selector = ref.field ? `${enc(ref.field)}=${enc(ref.value ?? '')}` : String(ref.row ?? 1)
  const opts = [
    ref.side === 'back' ? 'side=back' : '',
    ref.width ? `width=${ref.width}` : '',
    ref.align && ref.align !== 'center' ? `align=${ref.align}` : ''
  ].filter(Boolean)
  return `${CARD_PREFIX}${enc(ref.set)}/${selector}${opts.length ? `?${opts.join('&')}` : ''}`
}

const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase()

/** Il set e la riga (da 0) della carta richiamata, o il motivo per cui non c'è */
export function findCard(
  ref: CardRef,
  sets: LoadedSet[]
): { set: LoadedSet; row: number } | Message {
  const set = sets.find((s) => s.name === ref.set) ?? sets.find((s) => same(s.name, ref.set))
  if (!set) return msg('doc.card.noSet', { set: ref.set })
  const rows = set.data?.rows ?? []
  if (ref.row !== undefined) {
    if (ref.row > rows.length) return msg('doc.card.noRow', { set: set.name, n: ref.row })
    return { set, row: ref.row - 1 }
  }
  const headers = set.data?.headers ?? []
  const field = ref.field ?? ''
  const col =
    headers.indexOf(field) >= 0 ? headers.indexOf(field) : headers.findIndex((h) => same(h, field))
  if (col < 0) return msg('doc.card.noField', { set: set.name, field })
  const value = ref.value ?? ''
  let row = rows.findIndex((r) => (r[col] ?? '').trim() === value)
  if (row < 0) row = rows.findIndex((r) => same(r[col] ?? '', value))
  if (row < 0) return msg('doc.card.noValue', { set: set.name, field: headers[col], value })
  return { set, row }
}

export const isMessage = (x: object): x is Message => 'key' in x

// ——— Controllo ———

export interface DocumentProblem {
  message: Message
  /** Posizione nel documento */
  from: number
  to: number
}

/**
 * Problemi di un documento: carte e immagini che non si trovano, errori del markup, stili e
 * {nomi} sconosciuti
 */
export function documentProblems(src: string, ctx: DocumentContext): DocumentProblem[] {
  const { settings, problems: settingProblems } = documentSettings(src)
  const out: DocumentProblem[] = [...settingProblems]
  if (settings.language && ctx.languages && !ctx.languages.includes(settings.language)) {
    const lines = src.replace(/\r\n?/g, '\n').split('\n')
    const at = frontEntries(lines).find((e) => settingKey(e.key) === 'language')
    out.push({
      message: msg('doc.language.unknown', { language: settings.language }),
      from: at?.from ?? 0,
      to: at?.to ?? 0
    })
  }
  const texts: { text: string; from: number }[] = []
  for (const box of documentBoxes(src)) {
    const at = { from: box.from, to: box.headTo }
    if (box.bad.length)
      out.push({ message: msg('doc.box.badOption', { option: box.bad[0] }), ...at })
    if (box.endFrom === null) out.push({ message: msg('doc.box.notClosed'), ...at })
  }
  for (const b of parseDocument(src)) {
    switch (b.kind) {
      case 'heading':
      case 'paragraph':
      case 'quote':
        texts.push({ text: b.text, from: b.from })
        break
      case 'list':
        b.items.forEach((it) => texts.push({ text: it.text, from: b.from }))
        break
      case 'table':
        if (b.styleBad.length)
          out.push({
            message: msg('doc.table.badOption', { option: b.styleBad[0] }),
            from: b.from,
            to: b.to
          })
        ;[b.header, ...b.rows].forEach((r) =>
          r.forEach((c) => {
            for (const part of cellParts(c)) {
              if (part.kind === 'text') texts.push({ text: part.text, from: b.from })
              else {
                const problem = imageProblem(part.src, ctx)
                if (problem) out.push({ message: problem, from: b.from, to: b.to })
              }
            }
          })
        )
        break
      case 'figure':
        for (const img of b.images) {
          const problem = imageProblem(img.src, ctx)
          if (problem) out.push({ message: problem, from: img.from, to: img.to })
        }
        break
      case 'setup':
        out.push(...b.bad.map((r) => ({ message: msg('doc.setup.badLine'), ...r })))
        for (const it of b.items) {
          const problem =
            it.kind === 'card' || it.kind === 'deck'
              ? imageProblem(anatomyCardSource(it.card), ctx)
              : it.kind === 'image'
                ? imageProblem(it.src, ctx)
                : null
          if (problem) out.push({ message: problem, from: it.from, to: it.to })
          if (it.kind === 'text') texts.push({ text: it.text, from: it.from })
          if ('label' in it && it.label) texts.push({ text: it.label, from: it.from })
        }
        break
      case 'anatomy':
        out.push(...anatomyProblems(b, ctx))
        b.callouts.forEach((c) => texts.push({ text: c.label, from: c.from }))
        break
    }
  }
  for (const { text, from } of texts) {
    const prepared = documentText(text, ctx)
    const at = { from, to: from + Math.max(1, text.length) }
    for (const p of markupProblems(prepared, ctx.styles ?? {}))
      out.push({ message: p.message, ...at })
    if (ctx.assets)
      for (const name of new Set(markupRefs(prepared))) {
        if (!name) continue
        const v = imageVariable(name, ctx.variables)
        const r = resolveAsset(v ? v.src : name, ctx.assets)
        if (r.ok) continue
        out.push({
          message: v
            ? msg('doc.missingVariableImage', { name, src: v.src })
            : msg(r.reason === 'ambiguous' ? 'doc.ambiguousRef' : 'doc.unknownRef', { name }),
          ...at
        })
      }
  }
  return out.sort((a, b) => a.from - b.from)
}

/** Il riferimento card: di un'anatomia, scritto con o senza il prefisso */
export const anatomyCardSource = (card: string): string =>
  isCardSource(card) ? card.trim() : CARD_PREFIX + card.trim()

/** La faccia della carta su cui sta il livello di un'etichetta */
export const calloutFace = (
  a: Pick<Anatomy, 'both'>,
  c: Pick<Callout, 'face'>,
  side: Side
): Side => (a.both ? (c.face ?? 'front') : side)

function anatomyProblems(b: Anatomy & { from: number }, ctx: DocumentContext): DocumentProblem[] {
  const out: DocumentProblem[] = b.bad.map((r) => ({ message: msg('doc.anatomy.badLine'), ...r }))
  if (!b.card) return [{ message: msg('doc.anatomy.noCard'), from: b.from, to: b.from + 3 }, ...out]
  const at = { from: b.cardFrom, to: b.cardFrom + 5 + b.card.length }
  const src = anatomyCardSource(b.card)
  const problem = imageProblem(src, ctx)
  if (problem) return [{ message: problem, ...at }, ...out]
  const ref = parseCardRef(src)
  const found = !isMessage(ref) && ctx.sets ? findCard(ref, ctx.sets) : null
  const template =
    found && !isMessage(found) ? ctx.templates?.find((x) => x.name === found.set.template) : null
  if (!template || isMessage(ref)) return out
  for (const c of b.callouts)
    if (!layerBounds(template[calloutFace(b, c, ref.side)], c.layer))
      out.push({
        message: msg('doc.anatomy.noLayer', { layer: c.layer, template: template.name }),
        from: c.from,
        to: c.to
      })
  return out
}

/** Perché un'immagine del documento non si può mostrare, o null se si trova */
export function imageProblem(src: string, ctx: DocumentContext): Message | null {
  if (isCardSource(src)) {
    const ref = parseCardRef(src)
    if (isMessage(ref)) return ref
    if (!ctx.sets) return null
    const found = findCard(ref, ctx.sets)
    return isMessage(found) ? found : null
  }
  if (/^https?:\/\//i.test(src)) return null
  const { path, bad } = splitImageSource(src)
  if (bad.length) return msg('doc.image.badOption', { option: bad[0], ref: src })
  if (!ctx.assets) return null
  const name = path.replace(/^\{(.*)\}$/, '$1')
  const v = imageVariable(name, ctx.variables)
  const r = resolveAsset(v ? v.src : name, ctx.assets)
  if (r.ok) return null
  return msg(r.reason === 'ambiguous' ? 'doc.ambiguousRef' : 'doc.missingImage', { name: src })
}
