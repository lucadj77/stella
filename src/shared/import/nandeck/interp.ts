// Interprete degli script nanDECK per l'importazione. Esegue lo script dall'alto in basso come
// nanDECK: etichette e sequenze, intervalli di carte, frame, cicli FOR, blocchi IF, LAYER. Non
// disegna: per ogni comando grafico registra un'operazione (DrawOp) con le etichette e il font
// del momento, che convert.ts trasforma in livelli valutandola carta per carta.

import type { Sheet } from '../../project'
import { evalNumber, formatNumber } from './expr'
import {
  functionCall,
  scriptLines,
  splitParams,
  statement,
  unquote,
  type ScriptLine
} from './script'

/** Quello che l'interprete legge dalla cartella del gioco (già caricato: l'interprete è sincrono) */
export interface NandeckEnv {
  /** Testo di un file, percorso relativo alla cartella del gioco con / */
  readText(path: string): string | null
  /** Tutti i file della cartella del gioco, relativi con / */
  files: string[]
  /** Un foglio di un file di dati (xlsx, ods, csv); sheet null = il primo */
  sheet(file: string, sheet: string | null): Sheet | null
}

/** Riga non convertita, con il motivo: finisce nel riepilogo e nella nota "Import nanDECK" */
export interface SkippedLine {
  file: string
  line: number
  text: string
  reason: SkipReason
}

export type SkipReason =
  | 'command' // comando senza equivalente in Stella
  | 'function' // funzione di etichetta non supportata
  | 'print' // impostazioni di stampa ed esportazione: si rifanno con gli export di Stella
  | 'macro' // macro e righe che nanDECK interpreta in modo particolare
  | 'syntax' // riga non riconosciuta
  | 'fill' // riempimento a macchia: dipende dal disegno
  | 'link' // dati collegati che non si trovano

/** Sequenza: un elemento per carta, che ricomincia dall'inizio dopo l'ultimo */
type Label =
  { seq: string[]; rangeCall?: string } | { deferred: string; labels: LabelMap; count: number }
type LabelMap = Map<string, Label>

/** Condizione di un blocco IF: il testo originale e il suo valore per carta */
export interface Condition {
  text: string
  negated: boolean
  labels: LabelMap
}

export interface FontState {
  name: string
  size: number
  flags: string
  color: string
  background: string
  dx: number
  dy: number
}

export interface HtmlFont {
  name: string
  font: string
  size: number
  flags: string
  color: string
  align: string
  /** Contorno del testo: colore e spessore (nelle unità dello script) */
  outlineColor?: string
  outline?: number
}

export interface HtmlMargins {
  left: number
  top: number
  right: number
  bottom: number
  valign: string
}

export interface LayerGroup {
  id: number
  opacity: number
}

export interface DrawOp {
  id: number
  file: string
  line: number
  text: string
  command: string
  /** Testo dell'intervallo, per riconoscere labelrange e scrivere una formula */
  rangeText: string
  /** Carte dell'intervallo; null = tutte */
  cards: number[] | null
  params: string[]
  labels: LabelMap
  frames: Map<string, string>
  font: FontState
  fontRanges: { cards: Set<number>; font: FontState }[]
  conditions: Condition[]
  layers: LayerGroup[]
  /**
   * Carte per cui l'elemento di una sequenza è quello della posizione nel mazzo e non nel
   * intervallo: tutte se l'intervallo viene da LABELRANGE, altrimenti quelle di BASERANGE ON
   */
  deckPos: Set<number> | 'all'
}

export interface LinkInfo {
  file: string
  sheet: string | null
  headers: string[]
  /** Righe dei dati, una per carta (già moltiplicate da LINKMULTI) */
  rows: string[][]
  /** Righe originali e numero di copie di ciascuna */
  source: { row: string[]; copies: number }[]
  multi: string | null
  missing: boolean
}

export interface HtmlImage {
  key: string
  file: string
  width: string
  height: string
  flags: string
}

// funzioni di intervallo che si possono rileggere (AUTORANGE no: dà carte nuove ogni volta)
const RANGE_FUNCTIONS = new Set(['labelrange', 'rangeadd', 'rangemerge', 'rangerem', 'rangeint'])

const PRINT_COMMANDS = new Set([
  'PAGE',
  'BORDER',
  'DPI',
  'DISPLAY',
  'SAVE',
  'SAVEPDF',
  'SAVEPAGES',
  'PRINT',
  'OVERSAMPLE',
  'IMAGEFILTER',
  'MARGINS',
  'GAP',
  'DUPLEX',
  'LINKUNI',
  'LINKAUTOVAR',
  'LINKCOLOR',
  'LINKFILTER',
  'LINKSEP',
  'CANVASSIZE',
  'VISUAL',
  'ENDVISUAL',
  'SECTION',
  'ENDSECTION',
  'ZOOM',
  'RECTANGLE_PRINT',
  'PAGEFONT',
  'NOTE',
  'SPLIT',
  'HEADER',
  'FOOTER',
  'PAGEIMAGE',
  'PAGESHAPE',
  'PAGETEXT',
  'MARKS',
  'CMYK',
  'COLORS',
  'FLAGS',
  'TTSCOLOR',
  'SAVEGIF',
  'ANIM'
])

/** Comandi grafici che diventano livelli */
export const DRAW_COMMANDS = new Set([
  'TEXT',
  'HTMLTEXT',
  'IMAGE',
  'RECTANGLE',
  'ROUNDRECT',
  'ELLIPSE',
  'CIRCLE',
  'LINE',
  'POLYGON',
  'RHOMBUS',
  'TRIANGLE',
  'STAR',
  'GRID',
  'BEZIER',
  'ICONS',
  'ICON_DRAW'
])

const UNITS: Record<string, number> = { CM: 10, MM: 1, INCH: 25.4, IN: 25.4 }

const DEFAULT_FONT: FontState = {
  name: 'Arial',
  size: 32,
  flags: '',
  color: '#000000',
  background: '',
  dx: 0,
  dy: 0
}

let opCounter = 0

export class NandeckScript {
  readonly file: string
  readonly dir: string
  /** mm per unità dello script */
  unit = 10
  widthText = '6'
  heightText = '9'
  ops: DrawOp[] = []
  skipped: SkippedLine[] = []
  link: LinkInfo | null = null
  linkMulti: string | null = null
  linkNewline: string | null = null
  htmlFonts = new Map<string, HtmlFont>()
  htmlMargins = new Map<string, HtmlMargins>()
  htmlKeys: { key: string; value: string; font?: string }[] = []
  htmlImages: HtmlImage[] = []
  icons = new Map<string, string>()
  /** Comandi di stampa ed esportazione ignorati, per il conteggio */
  printLines = 0
  cardsDirective = 0
  /** Carte già usate dagli intervalli: autorange parte dalla successiva */
  private lastCard = 0
  private labels: LabelMap = new Map()
  private frames = new Map<string, string>()
  private font: FontState = DEFAULT_FONT
  private fontRanges: DrawOp['fontRanges'] = []
  private conditions: Condition[] = []
  private ifStack: { conds: Condition[]; taken: Condition[] }[] = []
  private layerStack: LayerGroup[] = []
  private layerCounter = 0
  private baseRange = new Set<number>()
  /** L'ultimo intervallo letto viene da LABELRANGE */
  private rangeFromLabel = false
  private seqCache = new Map<string, string[]>()

  constructor(
    readonly env: NandeckEnv,
    path: string
  ) {
    this.file = path
    this.dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
  }

  /** Percorso relativo alla cartella del gioco di un file scritto nello script */
  /** Vero se il file esiste nella cartella del gioco (senza distinguere maiuscole) */
  fileExists(path: string): boolean {
    if (!this.fileSet) this.fileSet = new Set(this.env.files.map((f) => f.toLowerCase()))
    return this.fileSet.has(path.toLowerCase())
  }

  private fileSet: Set<string> | null = null

  resolvePath(p: string): string {
    const clean = p.trim().replace(/\\/g, '/').replace(/^\.\//, '')
    if (/^[a-z]:\//i.test(clean) || clean.startsWith('/')) return clean
    const parts = (this.dir ? `${this.dir}/${clean}` : clean).split('/')
    const out: string[] = []
    for (const s of parts) {
      if (s === '..') out.pop()
      else if (s && s !== '.') out.push(s)
    }
    return out.join('/')
  }

  run(text: string): void {
    this.execLines(scriptLines(text, this.file), 0)
  }

  /** Dimensioni della carta in mm */
  get width(): number {
    return (evalNumber(this.substConst(this.widthText)) ?? 6) * this.unit
  }

  get height(): number {
    return (evalNumber(this.substConst(this.heightText)) ?? 9) * this.unit
  }

  /** Numero di carte dello script */
  get cardCount(): number {
    let n = Math.max(this.lastCard, this.cardsDirective, this.link?.rows.length ?? 0)
    for (const op of this.ops) if (op.cards) for (const c of op.cards) n = Math.max(n, c)
    return n || 1
  }

  private skip(l: ScriptLine, reason: SkipReason): void {
    if (reason === 'print') {
      this.printLines++
      return
    }
    this.skipped.push({ file: l.file, line: l.line, text: l.text, reason })
  }

  // ——— INCLUDE, SEQUENCE, FOR ———

  /** Esegue le righe in ordine; INCLUDE, SEQUENCE e FOR si risolvono quando si incontrano */
  private execLines(lines: ScriptLine[], depth: number): void {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i]
      const st = statement(l.text)
      if (st.kind === 'command' && st.name === 'INCLUDE') {
        const path = this.resolvePath(unquote(st.value))
        const text = depth < 5 ? this.env.readText(path) : null
        if (text === null) this.skip(l, 'command')
        else this.execLines(scriptLines(text, path), depth + 1)
        continue
      }
      if (
        st.kind === 'command' &&
        st.name === 'SECTION' &&
        /^off$/i.test(splitParams(st.value)[1] ?? '')
      ) {
        // una sezione spenta non si disegna: si salta fino a ENDSECTION
        let j = i + 1
        while (j < lines.length) {
          const s = statement(lines[j].text)
          if (s.kind === 'command' && s.name === 'ENDSECTION') break
          j++
        }
        i = j
        continue
      }
      if (st.kind === 'command' && st.name === 'SEQUENCE') {
        // le righe fino a ENDSEQUENCE sono gli elementi dell'etichetta
        const items: string[] = []
        let j = i + 1
        for (; j < lines.length; j++) {
          const s = statement(lines[j].text)
          if (s.kind === 'command' && s.name === 'ENDSEQUENCE') break
          if (s.kind === 'command' && s.name === 'INCLUDE') {
            const t = this.env.readText(this.resolvePath(unquote(s.value)))
            if (t !== null)
              items.push(
                ...t
                  .replace(/\r\n?/g, '\n')
                  .split('\n')
                  .map((x) => x.trim())
                  .filter(Boolean)
              )
            continue
          }
          items.push(lines[j].text)
        }
        this.labels = new Map(this.labels).set(st.value.toLowerCase(), { seq: items })
        this.seqCache.clear()
        i = j
        continue
      }
      if (st.kind === 'command' && st.name === 'FOR') {
        const [v, from, to] = splitParams(st.value)
        let nested = 0
        let j = i + 1
        for (; j < lines.length; j++) {
          const s = statement(lines[j].text)
          if (s.kind !== 'command') continue
          if (s.name === 'FOR') nested++
          else if (s.name === 'NEXT') {
            if (nested === 0) break
            nested--
          }
        }
        const body = lines.slice(i + 1, j)
        const a = evalNumber(this.substConst(from ?? ''))
        const b = evalNumber(this.substConst(to ?? ''))
        if (!v || a === null || b === null || Math.abs(b - a) > 500) this.skip(l, 'macro')
        else {
          const step = b >= a ? 1 : -1
          for (let k = a; step > 0 ? k <= b : k >= b; k += step)
            this.execLines(
              body.map((x) => ({ ...x, text: forVar(x.text, v.trim(), k) })),
              depth
            )
        }
        i = j
        continue
      }
      try {
        this.exec(l)
      } catch {
        this.skip(l, 'syntax')
      }
    }
  }

  // ——— esecuzione ———

  private exec(l: ScriptLine): void {
    const st = statement(l.text)
    if (st.kind === 'label') return this.defineLabel(l, st.name, st.value)
    if (st.kind === 'frame') {
      this.frames = new Map(this.frames).set(st.name.toLowerCase(), st.value)
      return
    }
    if (st.kind === 'other') return this.skip(l, 'syntax')
    const name = st.name
    const p = splitParams(st.value)
    switch (name) {
      case 'UNIT':
        this.unit = UNITS[st.value.trim().toUpperCase()] ?? this.unit
        return
      case 'CARDSIZE':
        this.widthText = p[0] ?? this.widthText
        this.heightText = p[1] ?? this.heightText
        return
      case 'CARDS':
        this.cardsDirective = evalNumber(this.substConst(st.value)) ?? 0
        return
      case 'BASERANGE':
        {
          const cards =
            this.range(p[0] ?? '') ?? Array.from({ length: this.cardCount }, (_, i) => i + 1)
          const on = /on/i.test(p[1] ?? '')
          this.baseRange = new Set(this.baseRange)
          for (const c of cards) on ? this.baseRange.add(c) : this.baseRange.delete(c)
        }
        return
      case 'FONT':
        this.font = this.fontFrom(p)
        this.fontRanges = []
        return
      case 'FONTRANGE': {
        const cards = this.range(p[0])
        const font = this.fontFrom(p.slice(1))
        this.fontRanges = [...this.fontRanges, { cards: new Set(cards ?? []), font }]
        return
      }
      case 'HTMLFONT': {
        const key = (p[0] ?? '').toLowerCase()
        const c = (i: number): string => this.substConst(unquote(p[i] ?? ''))
        this.htmlFonts.set(key, {
          name: key,
          font: c(1) || 'Arial',
          size: this.fontSize(c(2)),
          flags: c(3),
          color: c(4) || '#000000',
          align: c(5) || 'left',
          outlineColor: c(10) || undefined,
          outline: evalNumber(c(11)) ?? undefined
        })
        return
      }
      case 'HTMLMARGINS': {
        const key = (p[0] ?? '').toLowerCase()
        const n = (i: number): number => evalNumber(this.substConst(p[i] ?? '')) ?? 0
        this.htmlMargins.set(key, {
          top: n(1),
          left: n(2),
          right: n(3),
          bottom: n(4),
          valign: (p[5] ?? '').toLowerCase()
        })
        return
      }
      case 'HTMLKEY':
        this.htmlKeys.push({
          key: unquote(this.substConst(p[1] ?? '')),
          value: unquote(this.substConst(p[2] ?? '')),
          font: unquote(this.substConst(p[3] ?? '')).toLowerCase() || undefined
        })
        return
      case 'HTMLIMAGE': {
        const key = unquote(this.paramConst(p[1] ?? ''))
        const file = unquote(this.paramConst(p[2] ?? ''))
        if (!key || !file) return this.skip(l, 'syntax')
        this.htmlImages.push({
          key,
          file: this.resolvePath(file),
          width: this.substConst(p[3] ?? ''),
          height: this.substConst(p[4] ?? ''),
          flags: p[5] ?? ''
        })
        return
      }
      case 'ICON': {
        const key = unquote(this.paramConst(p[1] ?? ''))
        const file = unquote(this.paramConst(p[2] ?? ''))
        if (key && file) this.icons.set(key, this.resolvePath(file))
        return
      }
      case 'LINKMULTI':
        this.linkMulti = st.value.trim().toLowerCase()
        return
      case 'LINKNEW':
        this.linkNewline = st.value.trim()
        return
      case 'LINK':
        return this.loadLink(l, st.value)
      case 'IF': {
        const c = this.condition(st.value, false)
        this.ifStack.push({ conds: this.conditions, taken: [c] })
        this.conditions = [...this.conditions, c]
        return
      }
      case 'ELSEIF':
      case 'ELSE': {
        const top = this.ifStack[this.ifStack.length - 1]
        if (!top) return this.skip(l, 'syntax')
        const not = top.taken.map((c) => ({ ...c, negated: !c.negated }))
        const conds = [...top.conds, ...not]
        if (name === 'ELSEIF') {
          const c = this.condition(st.value, false)
          top.taken.push(c)
          conds.push(c)
        }
        this.conditions = conds
        return
      }
      case 'ENDIF': {
        const top = this.ifStack.pop()
        this.conditions = top ? top.conds : []
        return
      }
      case 'LAYER': {
        const alpha = evalNumber(this.substConst(p[0] ?? '100')) ?? 100
        this.layerStack = [
          ...this.layerStack,
          { id: ++this.layerCounter, opacity: Math.max(0, Math.min(1, alpha / 100)) }
        ]
        return
      }
      case 'ENDLAYER':
        this.layerStack = this.layerStack.slice(0, -1)
        return
      case 'ICONS':
      case 'TEXT':
      case 'HTMLTEXT':
      case 'IMAGE':
      case 'RECTANGLE':
      case 'ROUNDRECT':
      case 'ELLIPSE':
      case 'CIRCLE':
      case 'LINE':
      case 'POLYGON':
      case 'RHOMBUS':
      case 'TRIANGLE':
      case 'STAR':
      case 'BEZIER':
        return this.draw(l, name, p)
      case 'FILL':
        return this.skip(l, 'fill')
      case 'ENDSEQUENCE':
      case 'NEXT':
        return
      default:
        if (PRINT_COMMANDS.has(name)) return this.skip(l, 'print')
        if (name === 'MACRO' || name === 'END' || name === 'ENDMACRO') return this.skip(l, 'macro')
        return this.skip(l, 'command')
    }
  }

  private draw(l: ScriptLine, command: string, p: string[]): void {
    let cards: number[] | null
    try {
      cards = this.range(p[0] ?? '')
    } catch {
      return this.skip(l, 'function')
    }
    if (cards && !cards.length) return
    this.ops.push({
      id: ++opCounter,
      file: l.file,
      line: l.line,
      text: l.text,
      command,
      rangeText: this.rangeSource((p[0] ?? '').trim()),
      cards,
      params: p.slice(1),
      labels: this.labels,
      frames: this.frames,
      font: this.font,
      fontRanges: this.fontRanges,
      conditions: this.conditions,
      layers: this.layerStack,
      deckPos: this.rangeFromLabel ? 'all' : this.baseRange
    })
  }

  /** Corpo del font in punti; in percentuale è una parte dell'altezza della carta */
  private fontSize(text: string): number {
    return evalNumber(text, this.height / (25.4 / 72)) ?? 12
  }

  private fontFrom(p: string[]): FontState {
    const c = (i: number): string => unquote(this.substConst(p[i] ?? ''))
    return {
      name: c(0) || 'Arial',
      size: this.fontSize(c(1)),
      flags: c(2),
      color: c(3) || '#000000',
      background: c(4),
      dx: evalNumber(c(5)) ?? 0,
      dy: evalNumber(c(6)) ?? 0
    }
  }

  private condition(text: string, negated: boolean): Condition {
    return { text, negated, labels: this.labels }
  }

  private loadLink(l: ScriptLine, value: string): void {
    const raw = unquote(this.substConst(value))
    const bang = raw.lastIndexOf('!')
    const file = bang > 0 ? raw.slice(0, bang) : raw
    const sheetName = bang > 0 ? raw.slice(bang + 1) : null
    const path = this.resolvePath(file)
    const sheet = /^https?:/i.test(file) ? null : this.env.sheet(path, sheetName)
    if (!sheet) {
      this.link = {
        file: path,
        sheet: sheetName,
        headers: [],
        rows: [],
        source: [],
        multi: null,
        missing: true
      }
      this.skip(l, 'link')
      return
    }
    const multiIndex = this.linkMulti
      ? sheet.headers.findIndex((h) => h.trim().toLowerCase() === this.linkMulti)
      : -1
    // le righe vuote in fondo non sono carte
    const data = sheet.rows.filter((r) => r.some((c) => c.trim() !== ''))
    const source = data.map((row) => {
      const n = multiIndex >= 0 ? Math.round(Number(row[multiIndex]) || 0) : 1
      return { row, copies: Math.max(0, n) }
    })
    const rows = source.flatMap((s) => Array.from({ length: s.copies }, () => s.row))
    this.link = {
      file: path,
      sheet: sheetName,
      headers: sheet.headers,
      rows,
      source,
      multi: multiIndex >= 0 ? sheet.headers[multiIndex] : null,
      missing: false
    }
    const labels = new Map(this.labels)
    sheet.headers.forEach((h, i) => {
      if (!h.trim()) return
      const nl = this.linkNewline
      labels.set(h.trim().toLowerCase(), {
        seq: rows.map((r) => {
          const v = r[i] ?? ''
          return nl ? v.split(nl).join('\n') : v
        })
      })
    })
    this.labels = labels
  }

  // ——— etichette ———

  private defineLabel(l: ScriptLine, rawName: string, value: string): void {
    const name = rawName.toLowerCase()
    if (/[(),%°]/.test(name)) return this.skip(l, 'macro')
    if (this.framebox(l, name, value)) return
    let label: Label
    try {
      label = this.labelValue(value)
    } catch (e) {
      if (e instanceof FrameDefinition) return
      return this.skip(l, 'function')
    }
    this.labels = new Map(this.labels).set(name, label)
    this.seqCache.clear()
    // i frame creati da framebox prendono il nome dell'etichetta
    void name
  }

  private labelValue(value: string): Label {
    const call = functionCall(value)
    if (call)
      return {
        seq: this.callSeq(call.name, call.args, value),
        rangeCall: RANGE_FUNCTIONS.has(call.name) ? value.trim() : undefined
      }
    const parts = splitTop(value, '|')
    // [x]=[y] copia la sequenza
    const only = /^\[([^\][]+)\]$/.exec(value.trim())
    if (only && this.labels.has(only[1].toLowerCase()))
      return this.labels.get(only[1].toLowerCase())!
    const multi = referencedLabels(value).some((n) => this.count(n) > 1)
    if (multi && parts.length === 1)
      return {
        deferred: value,
        labels: this.labels,
        count: Math.max(...referencedLabels(value).map((n) => this.count(n)))
      }
    return { seq: parts.map((p) => unquote(this.substConst(p))) }
  }

  /** Quanti elementi ha un'etichetta */
  count(name: string, labels: LabelMap = this.labels): number {
    const l = labels.get(name.toLowerCase())
    if (!l) return 0
    return 'seq' in l ? l.seq.length : l.count
  }

  /** Tutti gli elementi di un'etichetta */
  sequence(name: string, labels: LabelMap = this.labels): string[] | null {
    const l = labels.get(name.toLowerCase())
    if (!l) return null
    if ('seq' in l) return l.seq
    return Array.from({ length: l.count }, (_, i) => this.subst(l.deferred, i + 1, i, l.labels))
  }

  /** Elemento di un'etichetta per una carta */
  element(name: string, card: number, pos: number, labels: LabelMap): string | null {
    const l = labels.get(name.toLowerCase())
    if (!l) return null
    if ('deferred' in l) return this.subst(l.deferred, card, pos, l.labels)
    if (!l.seq.length) return ''
    const i = pos % l.seq.length
    return l.seq[(i + l.seq.length) % l.seq.length]
  }

  /** Sostituzione con i valori della prima carta: per etichette e parametri costanti */
  substConst(text: string): string {
    return this.subst(text, 1, 0, this.labels)
  }

  private paramConst(text: string): string {
    const call = functionCall(text)
    if (call) {
      const seq = this.callSeq(call.name, call.args, text)
      return seq[0] ?? ''
    }
    return this.substConst(text)
  }

  /**
   * Sostituisce in un testo le etichette [nome] con l'elemento della carta, § con il numero
   * della carta e calcola le espressioni tra graffe ({(nome)} è il numero di elementi, {nome?n}
   * l'elemento n). Le etichette che non esistono restano come sono.
   */
  subst(text: string, card: number, pos: number, labels: LabelMap, keep?: Set<string>): string {
    let s = text.replace(/\\(\d+)\\/g, (_, n: string) => String.fromCharCode(Number(n)))
    // etichette, dalle più interne: [[tipo]] usa il valore di [tipo] come nome
    for (let guard = 0; guard < 20; guard++) {
      let changed = false
      s = s.replace(/\[([^[\]]+)\]/g, (_m, name: string) => {
        if (keep?.has(name.trim().toLowerCase())) return `${KEEP_OPEN}${name.trim()}${KEEP_CLOSE}`
        const v = this.element(name.trim(), card, pos, labels)
        if (v === null) return `\u0001${name}\u0002`
        changed = true
        return v
      })
      if (!changed) break
    }
    // eslint-disable-next-line no-control-regex
    s = s.replace(/\u0001/g, '[').replace(/\u0002/g, ']')
    s = s.replace(/§/g, String(card))
    for (let guard = 0; guard < 20; guard++) {
      let changed = false
      s = s.replace(/\{([^{}]*)\}/g, (_m, body: string) => {
        changed = true
        return this.braces(body, card, labels)
      })
      if (!changed) break
    }
    return s
  }

  private braces(body: string, card: number, labels: LabelMap): string {
    if (body.includes(KEEP_OPEN)) return NOT_SYMBOLIC
    const at = /^\s*([A-Za-z_][\w]*)\s*\?\s*(.*)$/.exec(body)
    if (at) {
      const n = at[2].trim() ? evalNumber(at[2]) : card
      const seq = this.sequence(at[1], labels)
      if (!seq || n === null || !seq.length) return ''
      return seq[(Math.round(n) - 1 + seq.length * 1000) % seq.length] ?? ''
    }
    const counted = body.replace(/\(\s*([A-Za-z_][\w]*)\s*\)/g, (m, name: string) =>
      labels.has(name.toLowerCase()) ? String(this.count(name, labels)) : m
    )
    const lengths = counted.replace(/length\(([^()]*)\)/gi, (_m, a: string) =>
      String(unquote(a).length)
    )
    const v = evalNumber(lengths)
    return v === null ? lengths : formatNumber(v)
  }

  // ——— intervalli ———

  /** Testo dell'intervallo; un'etichetta fatta con LABELRANGE diventa la sua chiamata */
  private rangeSource(text: string): string {
    const only = /^\[([^\][]+)\]$/.exec(text)
    const label = only ? this.labels.get(only[1].trim().toLowerCase()) : undefined
    return label && 'seq' in label && label.rangeCall ? label.rangeCall : text
  }

  /** Testo di un intervallo con le etichette fatte da funzioni di intervallo sostituite dalla chiamata */
  private expandRange(text: string, depth = 0): string {
    if (depth > 6) return text
    return text.replace(/\[([^\][]+)\]/g, (m, name: string) => {
      const label = this.labels.get(name.trim().toLowerCase())
      return label && 'seq' in label && label.rangeCall
        ? this.expandRange(label.rangeCall, depth + 1)
        : m
    })
  }

  /** Carte di un intervallo con le etichette di un'operazione */
  rangeOf(op: DrawOp, text: string): number[] | null {
    const saved = this.labels
    const from = this.rangeFromLabel
    this.labels = op.labels
    try {
      return this.range(text)
    } catch {
      return []
    } finally {
      this.labels = saved
      this.rangeFromLabel = from
    }
  }

  /** Testo di un intervallo scritto con un'etichetta, con le etichette di un'operazione */
  rangeCallOf(op: DrawOp, text: string): string {
    const only = /^\[([^\][]+)\]$/.exec(text.trim())
    const label = only ? op.labels.get(only[1].trim().toLowerCase()) : undefined
    return label && 'seq' in label && label.rangeCall ? label.rangeCall : text.trim()
  }

  /** Carte di un intervallo; null = tutte (intervallo vuoto) */
  range(text: string): number[] | null {
    const t = text.trim()
    this.rangeFromLabel = false
    if (!t) return null
    const call = functionCall(t)
    let spec: string
    if (call) spec = this.callRange(call.name, call.args)
    else spec = unquote(this.substConst(t))
    // un intervallo fatto (anche in parte) con LABELRANGE prende gli elementi per posizione nel mazzo
    this.rangeFromLabel = /labelrange\s*\(/i.test(this.expandRange(t))
    const cards = parseRange(spec)
    for (const c of cards) this.lastCard = Math.max(this.lastCard, c)
    return cards
  }

  private callRange(name: string, args: string[]): string {
    const seq = this.callSeq(name, args, `${name}(${args.join(',')})`)
    return seq.join(',')
  }

  // ——— funzioni ———

  /** Elementi di un argomento: una funzione, un'etichetta intera o un testo (con | sono più) */
  private seqArg(arg: string): string[] {
    const call = functionCall(arg)
    if (call) return this.callSeq(call.name, call.args, arg)
    const only = /^\[([^\][]+)\]$/.exec(arg.trim())
    if (only) {
      const s = this.sequence(only[1])
      if (s) return s
    }
    return splitTop(arg, '|').map((p) => unquote(this.substConst(p)))
  }

  private num(arg: string | undefined, fallback = 0): number {
    if (arg === undefined || !arg.trim()) return fallback
    const v = evalNumber(this.paramConst(arg))
    return v === null ? fallback : v
  }

  callSeq(name: string, args: string[], key: string): string[] {
    const cached = this.seqCache.get(key)
    if (cached) return cached
    const out = this.callSeqUncached(name, args)
    this.seqCache.set(key, out)
    return out
  }

  private callSeqUncached(name: string, args: string[]): string[] {
    switch (name) {
      case 'expand': {
        const seq = this.seqArg(args[0] ?? '')
        const times = Math.max(1, Math.round(this.num(args[1], 1)))
        const each = Math.max(1, Math.round(this.num(args[2], 1)))
        const out: string[] = []
        for (let t = 0; t < times; t++)
          for (const e of seq) for (let k = 0; k < each; k++) out.push(e)
        return out
      }
      case 'join': {
        const seqs = args.map((a) => this.seqArg(a))
        const n = Math.max(1, ...seqs.map((s) => s.length))
        return Array.from({ length: n }, (_, i) =>
          seqs.map((s) => (s.length ? s[i % s.length] : '')).join('')
        )
      }
      case 'concat': {
        // concat(testo, volte, testo, volte...): il testo ripetuto, poi diviso sulle |
        let text = ''
        for (let i = 0; i < args.length; i += 2) {
          const piece = unquote(this.substConst(args[i]))
          const times = args[i + 1] === undefined ? 1 : Math.round(this.num(args[i + 1], 1))
          for (let k = 0; k < times; k++) text += piece
        }
        const parts = text.split('|')
        if (parts.length > 1 && parts[parts.length - 1] === '') parts.pop()
        return parts
      }
      case 'autolabel': {
        const a = Math.round(this.num(args[0], 1))
        const b = Math.round(this.num(args[1], a))
        const step = b >= a ? 1 : -1
        const out: string[] = []
        for (let k = a; step > 0 ? k <= b : k >= b; k += step) out.push(String(k))
        return out
      }
      case 'tokenizeseq':
      case 'tokenize': {
        const seq = this.seqArg(args[0] ?? '')
        const n = Math.round(this.num(args[1], 1))
        const sep = unquote(args[2] ?? ' ') || ' '
        return seq.map((e) => e.split(sep)[n - 1] ?? '')
      }
      case 'stringsub': {
        const seq = this.seqArg(args[0] ?? '')
        return seq.map((e, i) => {
          const from = this.numFor(args[1], i, 1)
          const len = args[2] === undefined ? e.length : this.numFor(args[2], i, e.length)
          return e.substr(Math.max(0, from - 1), Math.max(0, len))
        })
      }
      case 'length':
        return this.seqArg(args[0] ?? '').map((e) => String(e.length))
      case 'replace': {
        const seq = this.seqArg(args[0] ?? '')
        const from = this.seqArg(args[1] ?? '')
        const to = this.seqArg(args[2] ?? '')
        const bySeq = /s/i.test(args[3] ?? '')
        return seq.map((e, i) => {
          if (bySeq) {
            const f = from[i % Math.max(1, from.length)] ?? ''
            const t = to[i % Math.max(1, to.length)] ?? ''
            return f && e === f ? t : e
          }
          let out = e
          from.forEach((f, k) => {
            if (f) out = out.split(f).join(to[k] ?? to[0] ?? '')
          })
          return out
        })
      }
      case 'eval':
        return this.seqArg(args[0] ?? '').map((e) => {
          const v = evalNumber(e)
          return v === null ? e : formatNumber(v)
        })
      case 'group':
        return [...new Set(this.seqArg(args[0] ?? ''))]
      case 'dirfiles': {
        const dir = this.resolvePath(unquote(this.substConst(args[0] ?? '')))
        const pattern = unquote(this.substConst(args[1] ?? '*')) || '*'
        const re = wildcard(
          pattern.includes('.') || pattern.includes('*') ? pattern : `*.${pattern}`
        )
        const prefix = dir ? `${dir}/` : ''
        const local = this.dir ? `${this.dir}/` : ''
        return this.env.files
          .filter((f) => f.startsWith(prefix) && re.test(f.slice(f.lastIndexOf('/') + 1)))
          .sort((a, b) => a.localeCompare(b))
          .map((f) => (f.startsWith(local) ? f.slice(local.length) : f).replace(/\//g, '\\'))
      }
      case 'labelrange': {
        const seq = this.seqArg(args[0] ?? '')
        const test = matcher(unquote(this.substConst(args[1] ?? '')))
        const offset = Math.round(this.num(args[2], 0))
        const out: number[] = []
        seq.forEach((e, i) => {
          if (test(e)) out.push(i + 1 + offset)
        })
        return [rangeText(out)]
      }
      case 'autorange': {
        const n = Math.max(0, Math.round(this.num(args[0], 0)))
        if (!n) return ['']
        const from = this.lastCard + 1
        this.lastCard += n
        return [`${from}-${from + n - 1}`]
      }
      case 'rangeadd':
      case 'rangemerge': {
        const set = new Set<number>()
        for (const a of args) for (const c of this.rangeArg(a)) set.add(c)
        return [rangeText([...set])]
      }
      case 'rangerem': {
        const [first, ...rest] = args
        const remove = new Set(rest.flatMap((a) => this.rangeArg(a)))
        return [rangeText(this.rangeArg(first ?? '').filter((c) => !remove.has(c)))]
      }
      case 'rangeint': {
        const [first, ...rest] = args
        let cards = this.rangeArg(first ?? '')
        for (const a of rest) {
          const other = new Set(this.rangeArg(a))
          cards = cards.filter((c) => other.has(c))
        }
        return [rangeText(cards)]
      }
      case 'framebox': {
        throw new FrameDefinition()
      }
      default:
        throw new Error(`function ${name}`)
    }
  }

  private numFor(arg: string | undefined, i: number, fallback: number): number {
    if (arg === undefined || !arg.trim()) return fallback
    const v = evalNumber(this.subst(arg, i + 1, i, this.labels))
    return v === null ? fallback : Math.round(v)
  }

  private rangeArg(arg: string): number[] {
    const call = functionCall(arg)
    if (call) return parseRange(this.callRange(call.name, call.args))
    return parseRange(unquote(this.substConst(arg)))
  }

  /** framebox(x, y, l, a, lf, af, flag, zx, zy): crea i frame <nome1>, <nome2>... */
  defineFrameBox(name: string, args: string[]): void {
    const n = (i: number, fallback = 0): string => args[i] ?? String(fallback)
    const vals = [0, 1, 2, 3, 4, 5].map((i) => this.substConst(n(i)))
    const flag = (args[6] ?? '').toUpperCase()
    const zx = evalNumber(this.substConst(args[7] ?? '100')) ?? 100
    const zy = evalNumber(this.substConst(args[8] ?? '100')) ?? 100
    const W = this.widthUnits
    const H = this.heightUnits
    const [x, y, w, h, fw, fh] = vals.map((v, i) => evalNumber(v, i % 2 ? H : W) ?? 0)
    if (fw <= 0 || fh <= 0) return
    const cols = Math.max(1, Math.floor(w / fw + 1e-6))
    const rows = Math.max(1, Math.floor(h / fh + 1e-6))
    const frames = new Map(this.frames)
    let k = 0
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        k++
        const cw = (fw * zx) / 100
        const ch = (fh * zy) / 100
        const fx = x + c * fw + (fw - cw) / 2
        const fy = y + r * fh + (fh - ch) / 2
        const suffix = /C|E|R/.test(flag)
          ? `${c + 1}${flag.includes('_') ? '_' : ''}${r + 1}`
          : /L/.test(flag)
            ? String.fromCharCode(64 + k)
            : flag.includes('P')
              ? String(k).padStart(2, '0')
              : flag.includes('N')
                ? String(k)
                : ''
        frames.set(
          `${name}${suffix}`.toLowerCase(),
          [fx, fy, cw, ch].map((v) => formatNumber(v)).join(',')
        )
      }
    this.frames = frames
  }

  // ——— parametri di un'operazione per una carta ———

  /**
   * Parametri di un comando per una carta: etichette e funzioni sostituite, frame `<nome>`
   * espansi in quattro numeri (x, y, larghezza, altezza nelle unità dello script)
   */
  resolveParams(op: DrawOp, card: number, keep?: Set<string>): string[] {
    const pos = this.posOf(op, card)
    const out: string[] = []
    for (const p of op.params) {
      const frame = /^<(.*)>$/s.exec(p.trim())
      if (frame) {
        const box = this.frameBox(frame[1], op, card, pos, 0)
        if (box) {
          out.push(...box.map(formatNumber))
          continue
        }
      }
      const call = functionCall(p)
      // join di etichette, testi ed espressioni: si calcola carta per carta, così le etichette
      // diventano campi ({nome}) e le espressioni ({[pers]-1}) prendono il valore della carta
      if (call && call.name === 'join' && call.args.every((a) => !functionCall(a))) {
        out.push(call.args.map((a) => unquote(this.subst(a, card, pos, op.labels, keep))).join(''))
        continue
      }
      if (call && KNOWN_FUNCTIONS.has(call.name)) {
        if (keep) {
          out.push(NOT_SYMBOLIC)
          continue
        }
        const saved = this.labels
        this.labels = op.labels
        try {
          const seq = this.callSeq(call.name, call.args, `${op.id}:${p}`)
          const i = pos % Math.max(1, seq.length)
          out.push(seq[i] ?? '')
        } catch {
          out.push(p)
        } finally {
          this.labels = saved
        }
        continue
      }
      out.push(this.subst(p, card, pos, op.labels, keep))
    }
    return out
  }

  /** Riquadro di un frame, con i modificatori <nome, posizione, l, a> */
  private frameBox(
    body: string,
    op: DrawOp,
    card: number,
    pos: number,
    depth: number
  ): number[] | null {
    if (depth > 8) return null
    const parts = splitParams(body)
    const def = op.frames.get(parts[0].trim().toLowerCase())
    if (def === undefined) return null
    const W = this.widthUnits
    const H = this.heightUnits
    const vals = splitParams(def)
    let base: number[]
    const inner = /^<(.*)>$/s.exec(def.trim())
    if (inner) {
      const b = this.frameBox(inner[1], op, card, pos, depth + 1)
      if (!b || b.length !== 4) return null
      base = b
    } else {
      if (vals.length < 4) return null
      base = vals
        .slice(0, 4)
        .map((v, i) => evalNumber(this.subst(v, card, pos, op.labels), i % 2 ? H : W) ?? NaN)
      if (base.some((v) => !Number.isFinite(v))) return null
    }
    let [x, y, w, h] = base
    const mod = (parts[1] ?? '').trim().toLowerCase()
    // punti: <f, PTL>, <f, PTL, PBR>, metà del riquadro <f, HTL>, frecce <f, TTC>, lati <f, ET>
    const point = (code: string): number[] | null => {
      const m = /^p([tcb])([lcr])$/.exec(code)
      if (!m) return null
      const px = m[2] === 'l' ? x : m[2] === 'c' ? x + w / 2 : x + w
      const py = m[1] === 't' ? y : m[1] === 'c' ? y + h / 2 : y + h
      return [px, py]
    }
    const TL = [x, y]
    const TR = [x + w, y]
    const BL = [x, y + h]
    const BR = [x + w, y + h]
    const shapes: Record<string, number[][]> = {
      htl: [TL, TR, BL],
      htr: [TL, TR, BR],
      hbl: [TL, BL, BR],
      hbr: [TR, BL, BR],
      et: [TL, TR],
      eb: [BL, BR],
      el: [TL, BL],
      er: [TR, BR],
      ed: [TL, BR],
      eg: [TR, BL],
      ttl: [TL, [x + w, y + h / 2], [x + w / 2, y + h]],
      ttc: [[x + w / 2, y], BL, BR],
      ttr: [TR, [x + w / 2, y + h], [x, y + h / 2]],
      tcl: [[x, y + h / 2], TR, BR],
      tcr: [[x + w, y + h / 2], TL, BL],
      tbl: [BL, [x + w / 2, y], [x + w, y + h / 2]],
      tbc: [[x + w / 2, y + h], TL, TR],
      tbr: [BR, [x, y + h / 2], [x + w / 2, y]]
    }
    if (shapes[mod]) return shapes[mod].flat()
    if (point(mod)) {
      const pts = parts.slice(1).map((c) => point(c.trim().toLowerCase()))
      return pts.every(Boolean) ? (pts as number[][]).flat() : null
    }
    if (parts.length >= 3) {
      // %% è una parte del frame, % una parte della carta
      const a = (s: string | undefined, frame: number, card: number): number | null => {
        if (s === undefined) return null
        const t = this.subst(s, card, pos, op.labels)
        return t.includes('%%') ? evalNumber(t, frame) : evalNumber(t, card)
      }
      const place = (at: number, size: number, inner: number, how: string): number =>
        how === 'c' ? at + (size - inner) / 2 : how === 'r' || how === 'b' ? at + size - inner : at
      if (/^(ts|bs|sl|sr)$/.test(mod)) return null
      if (mod.length === 2 && /h/.test(mod) && parts.length === 3) {
        const nw = a(parts[2], w, W) ?? w
        x = place(x, w, nw, mod.replace('h', ''))
        w = nw
      } else if (mod.length === 2 && /w/.test(mod) && parts.length === 3) {
        const nh = a(parts[2], h, H) ?? h
        y = place(y, h, nh, mod.replace('w', ''))
        h = nh
      } else {
        const nw = a(parts[2], w, W) ?? w
        const nh = a(parts[3], h, H) ?? nw
        x = place(x, w, nw, mod[1] ?? 'c')
        y = place(y, h, nh, mod[0] ?? 'c')
        w = nw
        h = nh
      }
    }
    return [x, y, w, h]
  }

  /**
   * Posizione (da 0) dell'elemento delle sequenze per una carta: l'n-esima carta
   * dell'intervallo prende l'n-esimo elemento, o la posizione nel mazzo con LABELRANGE e
   * BASERANGE ON
   */
  posOf(op: DrawOp, card: number): number {
    if (op.deckPos === 'all' || op.deckPos.has(card) || !op.cards) return card - 1
    const i = op.cards.indexOf(card)
    return i < 0 ? card - 1 : i
  }

  /** Valore di una condizione IF per una carta */
  test(cond: Condition, card: number, pos: number): boolean {
    const t = this.subst(cond.text, card, pos, cond.labels)
    const m = /^(.*?)(<>|<=|>=|=|<|>)(.*)$/s.exec(t)
    const v = m ? compare(unquote(m[1]), m[2], unquote(m[3])) : !!t.trim() && t.trim() !== '0'
    return cond.negated ? !v : v
  }

  /** Font del comando per una carta, tenendo conto di FONTRANGE */
  fontFor(op: DrawOp, card: number): FontState {
    let f = op.font
    for (const r of op.fontRanges) if (r.cards.has(card)) f = r.font
    return f
  }

  get widthUnits(): number {
    return this.width / this.unit
  }

  get heightUnits(): number {
    return this.height / this.unit
  }

  /** Esegue la definizione di un'etichetta framebox: chiamata da defineLabel */
  framebox(l: ScriptLine, name: string, value: string): boolean {
    const call = functionCall(value)
    if (!call || call.name !== 'framebox') return false
    this.defineFrameBox(name, call.args)
    void l
    return true
  }
}

class FrameDefinition extends Error {}

/** Segni di un'etichetta lasciata come campo nella sostituzione simbolica: diventa {nome} */
export const KEEP_OPEN = '\u0003'
export const KEEP_CLOSE = '\u0004'
/** Un parametro che non si può scrivere con i campi: si usa il valore di ogni carta */
export const NOT_SYMBOLIC = '\u0005'

const KNOWN_FUNCTIONS = new Set([
  'expand',
  'join',
  'concat',
  'autolabel',
  'tokenizeseq',
  'tokenize',
  'stringsub',
  'length',
  'replace',
  'eval',
  'group',
  'dirfiles'
])

/** Sostituisce la variabile del ciclo: {A} diventa il numero, {nome?A} l'elemento A */
function forVar(text: string, v: string, k: number): string {
  const esc = v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(/\{([^{}]*)\}/g, (m, body: string) => {
    const replaced = body.replace(new RegExp(`(^|[^\\w])${esc}(?=$|[^\\w])`, 'g'), `$1${k}`)
    return replaced === body ? m : `{${replaced}}`
  })
}

/** Divide sulle | che stanno fuori da parentesi, quadre, graffe e virgolette */
export function splitTop(text: string, sep: string): string[] {
  return splitParams(text, sep)
}

/** Nomi delle etichette scritte come [nome] in un testo */
function referencedLabels(text: string): string[] {
  return [...text.matchAll(/\[([^[\]]+)\]/g)].map((m) => m[1].trim())
}

/** "1-5,7,9-10" → [1,2,3,4,5,7,9,10] */
export function parseRange(spec: string): number[] {
  const out = new Set<number>()
  for (const part of spec.split(/[,;]/)) {
    const p = part.trim()
    if (!p) continue
    const m = /^(\d+)\s*-\s*(\d+)$/.exec(p)
    if (m) {
      const a = Number(m[1])
      const b = Number(m[2])
      if (b - a > 10000) throw new Error('range')
      for (let k = Math.min(a, b); k <= Math.max(a, b); k++) out.add(k)
      continue
    }
    // 10#5: cinque carte a partire dalla 10
    const count = /^(\d+)\s*#\s*(\d+)$/.exec(p)
    if (count) {
      const a = Number(count[1])
      const n = Math.min(10000, Number(count[2]))
      for (let k = 0; k < n; k++) out.add(a + k)
      continue
    }
    const v = evalNumber(p)
    if (v === null || v < 1) throw new Error(`range ${p}`)
    out.add(Math.round(v))
  }
  return [...out].sort((a, b) => a - b)
}

/** [1,2,3,5] → "1-3,5" */
export function rangeText(cards: number[]): string {
  const sorted = [...new Set(cards)].filter((c) => c >= 1).sort((a, b) => a - b)
  const parts: string[] = []
  for (let i = 0; i < sorted.length; i++) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++
    parts.push(j > i ? `${sorted[i]}-${sorted[j]}` : String(sorted[i]))
    i = j
  }
  return parts.join(',')
}

/**
 * Confronto di labelrange: "valore" (uguale), "<>valore", "<>" (non vuoto), "<=3", ">2",
 * "=valore", "@testo" (contiene). Senza badare alle maiuscole; i numeri si confrontano come numeri.
 */
export function matcher(spec: string): (value: string) => boolean {
  const m = /^(<>|<=|>=|=|<|>|@)?(.*)$/s.exec(spec.trim())!
  const op = m[1] ?? '='
  const want = unquote(m[2].trim())
  return (value: string) => compare(value, op, want)
}

export function compare(a: string, op: string, b: string): boolean {
  const x = a.trim()
  const y = b.trim()
  if (op === '@') return x.toLowerCase().includes(y.toLowerCase())
  const nx = Number(x)
  const ny = Number(y)
  const numeric = x !== '' && y !== '' && Number.isFinite(nx) && Number.isFinite(ny)
  const c = numeric ? nx - ny : x.toLowerCase().localeCompare(y.toLowerCase())
  switch (op) {
    case '<>':
      return c !== 0
    case '<=':
      return c <= 0
    case '>=':
      return c >= 0
    case '<':
      return c < 0
    case '>':
      return c > 0
    default:
      return c === 0
  }
}

function wildcard(pattern: string): RegExp {
  const esc = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(`^${esc}$`, 'i')
}
