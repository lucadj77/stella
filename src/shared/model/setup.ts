// Schema della preparazione del tavolo nei documenti: un blocco ```setup con un elemento per
// riga, in mm su un'area. Lo si scrive a mano, lo scrive un agente o lo prepara l'editor
// dell'app; il documento lo disegna con le carte vere del progetto.
//
//   size 280x180
//   margin 10                                          (senza size: margine intorno, di base 3 mm)
//   zone 0,0 280x60 "Giocatore 1"
//   zone 0,0 280x60 fill=#dfe8f5 stroke=none rotate=5  (colori, tratto, angoli, opacità)
//   deck Personaggi/1?side=back 20,10 count=8 "Mazzo"
//   card Personaggi/nome=Mago 60,10 rotate=90 scale=150% label=top "Il mago"
//   card Segnalini/1 on=@plancia cell=3,4              (al centro di una casella della plancia)
//   row Mercato/1-3,7,Eroi/nome=Mago 10,10 gap=3       (carte in fila; direction=down: in colonna)
//   hand Personaggi/1-5 10,10 spread=40                (carte a ventaglio)
//   shape ellipse 60,10 30x30 stroke=#e5484d thickness=1 "1"   (rect, ellipse, polygon, star)
//   text 140,30 width=50 color=#e5484d "Pesca **2** carte"   (align=left o right; di base al centro)
//   arrow 40,50 -> 60,80 "pesca"
//   arrow @mazzo -> @mercato                           (agganciata agli elementi con name=)
//   arrow 40,50 -> 60,80 bend=8 shift=5                (curva e spostamento della curva)
//   arrow 40,50 -> 60,80 heads=both size=150%          (punte: end, start, both, none; misura)
//   arrow 40,50 -> 60,80 thickness=1 color=red line=dash   (spessore, colore, tratteggio)
//   image icons/moneta.png 200,20 width=10
//
// Ogni elemento accetta `name=` (per agganciarci le frecce e le caselle) e `lock` (non si sceglie
// con un clic nell'editor). Con `order: free` vale l'ordine delle righe (le ultime sopra); senza,
// le zone e le forme stanno sotto, poi carte e immagini, poi testi e frecce. Con `width 60%` lo
// schema occupa al massimo il 60% della riga, con `font 90%` le didascalie hanno il 90% del corpo
// di base.

export const SETUP_FENCE = 'setup'

/** Tratto di una linea o di un bordo */
export type SetupLineStyle = 'solid' | 'dash' | 'dot'

/** Dove sta l'etichetta di un componente, di un mazzo, di una fila o di una mano; di base sotto */
export type SetupLabelAt = 'bottom' | 'top' | 'left' | 'right'

/** Le forme dello schema, come quelle dei livelli forma dei template */
export type SetupShape = 'rect' | 'ellipse' | 'polygon' | 'star'
export const SETUP_SHAPES: SetupShape[] = ['rect', 'ellipse', 'polygon', 'star']

/** Opzioni che valgono per ogni elemento */
interface Common {
  from: number
  to: number
  /** Nome con cui frecce e caselle richiamano l'elemento (`name=mazzo`, `@mazzo`) */
  name?: string
  /** Nell'editor non si sceglie con un clic sul disegno */
  lock?: boolean
  /** Solo nell'editor: nascosto mentre si lavora, non si scrive */
  hidden?: boolean
  /**
   * Sopra la casella di una plancia: nome dell'elemento e casella (riga, colonna da 1). Il centro
   * dell'elemento va al centro della casella; x e y si calcolano. Non per le frecce.
   */
  on?: { item: string; row: number; col: number }
}

/** Aspetto di zone e forme; i valori assenti sono quelli di base del tipo */
interface Paint {
  /** Colore, variabile colore o `none` */
  fill?: string
  stroke?: string
  /** Spessore del bordo in mm */
  thickness?: number
  line?: SetupLineStyle
  /** Angoli arrotondati in mm */
  radius?: number
  /** Opacità, da 0 a 1 */
  opacity?: number
}

/** Opzioni di componenti, mazzi, file e mani */
interface Cards {
  /** Misura rispetto a quella del template: 1 = 100% */
  scale?: number
  labelAt?: SetupLabelAt
}

export type SetupItem = Common &
  (
    | ({
        kind: 'card'
        card: string
        x: number
        y: number
        rotate: number
        label: string
      } & Cards)
    | ({
        kind: 'deck'
        card: string
        x: number
        y: number
        rotate: number
        count: number
        label: string
      } & Cards)
    | ({
        kind: 'row'
        cards: string[]
        x: number
        y: number
        /** Spazio tra le carte in mm; assente = 3 */
        gap?: number
        /** In fila verso destra (di base) o in colonna verso il basso */
        direction?: 'right' | 'down'
        label: string
      } & Cards)
    | ({
        kind: 'hand'
        cards: string[]
        x: number
        y: number
        /** Apertura del ventaglio in gradi; assente = 30 */
        spread?: number
        label: string
      } & Cards)
    | ({
        kind: 'zone'
        x: number
        y: number
        w: number
        h: number
        label: string
        /** Rotazione attorno al centro, in gradi; assente = 0 */
        rotate?: number
      } & Paint)
    | ({
        kind: 'shape'
        shape: SetupShape
        x: number
        y: number
        w: number
        h: number
        label: string
        rotate?: number
        /** Lati del poligono o punte della stella; assente = 6 e 5 */
        sides?: number
        /** Rientro della stella, da 0 a 1; assente = 0,5 */
        inner?: number
      } & Paint)
    | {
        kind: 'text'
        x: number
        y: number
        w: number
        text: string
        /** Allineamento nel riquadro largo w; di base al centro */
        align?: SetupTextAlign
        color?: string
        rotate?: number
        /** Contorno delle lettere: colore e spessore in mm */
        stroke?: string
        thickness?: number
      }
    | {
        kind: 'arrow'
        x: number
        y: number
        x2: number
        y2: number
        label: string
        /**
         * Curva: di quanti mm il centro della freccia si scosta dalla retta, a destra di chi va
         * dalla coda alla punta (a sinistra se negativo); assente o 0 = dritta
         */
        bend?: number
        /**
         * Con la curva: di quanti mm il centro si sposta lungo la freccia, verso la punta (verso la
         * coda se negativo); assente o 0 = a metà
         */
        shift?: number
        /** Dove stanno le punte; assente = solo alla fine */
        heads?: ArrowHeads
        /** Misura di linea e punta rispetto a quella di base: 1 = 100%; assente = 1 */
        size?: number
        /** Spessore della linea in mm, al posto di quello che viene dalla misura; assente = 0,5 × misura */
        thickness?: number
        color?: string
        line?: SetupLineStyle
        /** Coda e punta agganciate agli elementi con questo nome: x, y e x2, y2 non contano */
        fromItem?: string
        toItem?: string
      }
    | { kind: 'image'; src: string; x: number; y: number; w: number; rotate: number }
  )

export type SetupKind = SetupItem['kind']

/** Le punte di una freccia: alla fine (di base), all'inizio, a tutte e due, a nessuna */
export type ArrowHeads = 'end' | 'start' | 'both' | 'none'

export type SetupTextAlign = 'left' | 'center' | 'right'

export interface Setup {
  /** Misure dell'area in mm; senza, quelle degli elementi */
  size: { w: number; h: number } | null
  /** Senza misure, margine in mm intorno agli elementi e ai loro testi (`margin 10`); null = 3 */
  margin?: number | null
  items: SetupItem[]
  /** Larghezza massima in frazione della riga; null = tutta */
  width?: number | null
  /** Corpo delle didascalie in frazione di quello di base; null = di base */
  font?: number | null
  /** Didascalia dello schema (`caption: testo`); vuota = nessuna */
  caption?: string
  /** Didascalia sopra lo schema (`caption-position: top`); di base sotto */
  captionTop?: boolean
  /** Testo che scorre accanto allo schema, messo a sinistra o a destra (`wrap: left`) */
  wrap?: BlockWrap | null
  /** Vale l'ordine delle righe (`order: free`), senza gli strati per tipo */
  free?: boolean
  /** Righe che non si capiscono */
  bad: { from: number; to: number }[]
}

/** Limiti di `width:` e `font:` negli schemi del tavolo e nelle anatomie (model/document.ts), in frazione */
export const BLOCK_WIDTH = { min: 0.1, max: 1 }
export const BLOCK_FONT = { min: 0.3, max: 3 }

/**
 * Righe `width: 60%` e `font: 90%` dell'anatomia e dello schema del tavolo (anche senza i due
 * punti); value null se il valore non va bene
 */
export function blockSizeLine(
  line: string
): { key: 'width' | 'font'; value: number | null } | null {
  const m = /^\s*(width|font)\s*:?\s*(\S*)\s*$/i.exec(line)
  if (!m) return null
  const key = m[1].toLowerCase() as 'width' | 'font'
  const pct = /^(\d+(?:[.,]\d+)?)%$/.exec(m[2])
  const n = pct ? Number(pct[1].replace(',', '.')) / 100 : NaN
  const lim = key === 'width' ? BLOCK_WIDTH : BLOCK_FONT
  return { key, value: n >= lim.min && n <= lim.max ? n : null }
}

/** Le righe `width:` e `font:` da scrivere nel blocco */
export function blockSizeLines(o: { width?: number | null; font?: number | null }): string[] {
  const pct = (n: number): string => `${Math.round(n * 1000) / 10}%`
  return [
    ...(o.width && o.width < 1 ? [`width: ${pct(o.width)}`] : []),
    ...(o.font && o.font !== 1 ? [`font: ${pct(o.font)}`] : [])
  ]
}

/**
 * Righe della didascalia dell'anatomia e dello schema del tavolo: `caption: testo` e
 * `caption-position: top` (o bottom); bad se la posizione non si capisce
 */
export function blockCaptionLine(
  line: string
): { text?: string; top?: boolean; bad?: boolean } | null {
  const pos = /^\s*caption-position\s*:?\s*(\S*)\s*$/i.exec(line)
  if (pos) {
    const v = pos[1].toLowerCase()
    return v === 'top' || v === 'bottom' ? { top: v === 'top' } : { bad: true }
  }
  const text = /^\s*caption\s*:\s*(.*)$/i.exec(line)
  return text ? { text: text[1].trim() } : null
}

/** Le righe della didascalia da scrivere nel blocco */
export function blockCaptionLines(o: { caption?: string; captionTop?: boolean }): string[] {
  const text = o.caption?.replace(/\n/g, ' ').trim()
  if (!text) return []
  return [`caption: ${text}`, ...(o.captionTop ? ['caption-position: top'] : [])]
}

/** Lato verso cui va un blocco con il testo che gli scorre accanto (`wrap: left`) */
export type BlockWrap = 'left' | 'right'

/**
 * Riga `wrap: left` (o right, o none) dell'anatomia e dello schema del tavolo: il blocco va su
 * quel lato e il testo che segue gli scorre accanto; bad se il lato non si capisce
 */
export function blockWrapLine(line: string): { wrap: BlockWrap | null } | { bad: true } | null {
  const m = /^\s*wrap\s*:?\s*(\S*)\s*$/i.exec(line)
  if (!m) return null
  const v = m[1].toLowerCase()
  if (v === 'left' || v === 'right') return { wrap: v }
  return v === 'none' ? { wrap: null } : { bad: true }
}

/** La riga `wrap:` da scrivere nel blocco */
export function blockWrapLines(o: { wrap?: BlockWrap | null }): string[] {
  return o.wrap ? [`wrap: ${o.wrap}`] : []
}

/** Frazione della riga presa di base da un blocco con il testo accanto, senza `width:` */
export const WRAP_WIDTH = 0.5

/** Larghezza di base dei testi e delle immagini, in mm */
export const SETUP_TEXT_W = 50
export const SETUP_IMAGE_W = 15
/** Spazio di base tra le carte di una fila e apertura di base di una mano */
/** Spessore di base del contorno di un testo, in mm */
export const SETUP_TEXT_OUTLINE = 0.4
export const SETUP_ROW_GAP = 3
export const SETUP_HAND_SPREAD = 30
/** Carte al massimo in una fila o in una mano */
export const SETUP_MAX_CARDS = 60

const KINDS = new Set<SetupKind>([
  'card',
  'deck',
  'row',
  'hand',
  'zone',
  'shape',
  'text',
  'arrow',
  'image'
])
const PAIR = /^(-?\d+(?:[.,]\d+)?),(-?\d+(?:[.,]\d+)?)$/
const SIZE = /^(\d+(?:[.,]\d+)?)x(\d+(?:[.,]\d+)?)$/i
const NAME = /^[\p{L}\p{N}_-]+$/u
const num = (s: string): number => Number(s.replace(',', '.'))
const decode = (s: string): string => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** Le parole di una riga: le virgolette tengono insieme un testo, \" è una virgoletta */
function tokens(line: string): { text: string; quoted: boolean }[] | null {
  const out: { text: string; quoted: boolean }[] = []
  let i = 0
  while (i < line.length) {
    if (/\s/.test(line[i])) {
      i++
      continue
    }
    if (line[i] === '"') {
      let s = ''
      i++
      while (i < line.length && line[i] !== '"') {
        if (line[i] === '\\' && (line[i + 1] === '"' || line[i + 1] === '\\')) i++
        s += line[i++]
      }
      if (i >= line.length) return null
      i++
      out.push({ text: s, quoted: true })
      continue
    }
    let s = ''
    while (i < line.length && !/\s/.test(line[i])) s += line[i++]
    out.push({ text: s, quoted: false })
  }
  return out
}

/**
 * Le carte di una fila o di una mano: riferimenti separati da virgole, con gli intervalli
 * (`Mercato/1-3`) e i numeri che continuano il set di prima (`Mercato/1,4,7`); null se non va
 */
export function parseCardList(s: string): string[] | null {
  const out: string[] = []
  let set: string | null = null
  for (const raw of s.split(',')) {
    const part = raw.trim()
    if (!part) return null
    const q = part.indexOf('?')
    const path = q < 0 ? part : part.slice(0, q)
    const query = q < 0 ? '' : part.slice(q)
    const slash = path.indexOf('/')
    let sel: string
    if (slash > 0) {
      set = path.slice(0, slash)
      sel = path.slice(slash + 1)
    } else if (set !== null) sel = path
    else return null
    if (!sel) return null
    const range = /^(\d+)-(\d+)$/.exec(sel)
    if (range) {
      const a = Number(range[1])
      const b = Number(range[2])
      if (a < 1 || b < a || out.length + b - a + 1 > SETUP_MAX_CARDS) return null
      for (let n = a; n <= b; n++) out.push(`${set}/${n}${query}`)
    } else if (slash > 0 || /^\d+$/.test(sel)) out.push(`${set}/${sel}${query}`)
    else return null
    if (out.length > SETUP_MAX_CARDS) return null
  }
  return out.length ? out : null
}

/** Le carte scritte in breve: i numeri di fila dello stesso set diventano un intervallo */
export function cardListSource(cards: string[]): string {
  const toks: { full: boolean; set: string; from?: number; to?: number; text: string }[] = []
  for (const card of cards) {
    const c = card.replace(/ /g, '%20')
    const slash = c.indexOf('/')
    const set = slash > 0 ? c.slice(0, slash) : ''
    const sel = slash > 0 ? c.slice(slash + 1) : c
    const n = /^\d+$/.test(sel) ? Number(sel) : null
    const last = toks[toks.length - 1]
    if (n !== null && last?.set === set && last.to !== undefined && n === last.to + 1) {
      last.to = n
      continue
    }
    // un numero dopo un'altra carta dello stesso set non ripete il set
    if (n !== null) toks.push({ full: last?.set !== set, set, from: n, to: n, text: '' })
    else toks.push({ full: true, set, text: c })
  }
  return toks
    .map((t) =>
      t.from !== undefined
        ? `${t.full ? `${t.set}/` : ''}${t.from === t.to ? t.from : `${t.from}-${t.to}`}`
        : t.text
    )
    .join(',')
}

/** Valore di un colore: esadecimale, nome, variabile tra graffe o none */
const COLOR = /^(#[0-9a-f]{3,8}|[a-z]+|\{[^{}\s]+\}|[\p{L}\p{N}_-]+)$/iu

type OptKind = 'num' | 'pct' | 'color' | 'flag' | 'word' | 'cell' | 'ref'
/** Le opzioni `chiave=valore` e a quali elementi si applicano */
const OPTIONS: Record<string, { type: OptKind; kinds: SetupKind[]; words?: string[] }> = {
  name: {
    type: 'word',
    kinds: ['card', 'deck', 'row', 'hand', 'zone', 'shape', 'text', 'image']
  },
  lock: {
    type: 'flag',
    kinds: ['card', 'deck', 'row', 'hand', 'zone', 'shape', 'text', 'arrow', 'image']
  },
  scale: { type: 'pct', kinds: ['card', 'deck', 'row', 'hand'] },
  label: {
    type: 'word',
    kinds: ['card', 'deck', 'row', 'hand'],
    words: ['top', 'bottom', 'left', 'right']
  },
  on: { type: 'ref', kinds: ['card', 'deck', 'row', 'hand', 'zone', 'shape', 'text', 'image'] },
  cell: { type: 'cell', kinds: ['card', 'deck', 'row', 'hand', 'zone', 'shape', 'text', 'image'] },
  gap: { type: 'num', kinds: ['row'] },
  direction: { type: 'word', kinds: ['row'], words: ['right', 'down'] },
  spread: { type: 'num', kinds: ['hand'] },
  fill: { type: 'color', kinds: ['zone', 'shape'] },
  stroke: { type: 'color', kinds: ['zone', 'shape', 'text'] },
  color: { type: 'color', kinds: ['text', 'arrow'] },
  thickness: { type: 'num', kinds: ['zone', 'shape', 'arrow', 'text'] },
  line: { type: 'word', kinds: ['zone', 'shape', 'arrow'], words: ['solid', 'dash', 'dot'] },
  radius: { type: 'num', kinds: ['zone', 'shape'] },
  opacity: { type: 'pct', kinds: ['zone', 'shape'] },
  sides: { type: 'num', kinds: ['shape'] },
  inner: { type: 'pct', kinds: ['shape'] },
  align: { type: 'word', kinds: ['text'], words: ['left', 'center', 'right'] },
  heads: { type: 'word', kinds: ['arrow'], words: ['end', 'start', 'both', 'none'] },
  size: { type: 'pct', kinds: ['arrow'] },
  shift: { type: 'num', kinds: ['arrow'] },
  // queste le leggevano tutti gli elementi anche prima: dove non servono non contano
  rotate: { type: 'num', kinds: KINDS_ALL() },
  count: { type: 'num', kinds: KINDS_ALL() },
  width: { type: 'num', kinds: KINDS_ALL() },
  bend: { type: 'num', kinds: KINDS_ALL() }
}
function KINDS_ALL(): SetupKind[] {
  return ['card', 'deck', 'row', 'hand', 'zone', 'shape', 'text', 'arrow', 'image']
}

/** Un elemento da una riga, o null se non si capisce */
function parseItem(line: string, from: number): SetupItem | null {
  const parts = tokens(line)
  if (!parts?.length || parts[0].quoted) return null
  const kind = parts[0].text.toLowerCase() as SetupKind
  if (!KINDS.has(kind)) return null
  /** I punti: coordinate o `@nome` di un elemento */
  const points: ({ x: number; y: number } | string)[] = []
  let size: [number, number] | null = null
  let name = ''
  let label: string | null = null
  const opts: Record<string, string | number | boolean | { row: number; col: number }> = {}
  for (const p of parts.slice(1)) {
    if (p.quoted) {
      if (label !== null) return null
      label = p.text
      continue
    }
    if (p.text === '->') continue
    const pair = PAIR.exec(p.text)
    const sz = SIZE.exec(p.text)
    const kv = /^([a-z]+)=(.*)$/i.exec(p.text)
    const opt = kv && !p.text.includes('/') ? OPTIONS[kv[1].toLowerCase()] : undefined
    const flag = OPTIONS[p.text.toLowerCase()]
    if (pair) points.push({ x: num(pair[1]), y: num(pair[2]) })
    else if (sz && !size) size = [num(sz[1]), num(sz[2])]
    else if (/^@[\p{L}\p{N}_-]+$/u.test(p.text) && kind === 'arrow') points.push(p.text.slice(1))
    else if (flag?.type === 'flag') {
      if (!flag.kinds.includes(kind)) return null
      opts[p.text.toLowerCase()] = true
    } else if (opt && kv) {
      const key = kv[1].toLowerCase()
      if (!opt.kinds.includes(kind) || key in opts) return null
      const v = kv[2]
      switch (opt.type) {
        case 'num': {
          if (!/^-?\d+(?:[.,]\d+)?$/.test(v)) return null
          opts[key] = num(v)
          break
        }
        case 'pct': {
          const m = /^(\d+(?:[.,]\d+)?)%$/.exec(v)
          if (!m) return null
          opts[key] = num(m[1]) / 100
          break
        }
        case 'color':
          if (!COLOR.test(v)) return null
          opts[key] = v
          break
        case 'word':
          if (opt.words ? !opt.words.includes(v.toLowerCase()) : !NAME.test(v)) return null
          opts[key] = opt.words ? v.toLowerCase() : v
          break
        case 'ref': {
          const m = /^@?([\p{L}\p{N}_-]+)$/u.exec(v)
          if (!m) return null
          opts[key] = m[1]
          break
        }
        case 'cell': {
          const m = /^(\d+),(\d+)$/.exec(v)
          if (!m || Number(m[1]) < 1 || Number(m[2]) < 1) return null
          opts[key] = { row: Number(m[1]), col: Number(m[2]) }
          break
        }
        default:
          return null
      }
    } else if (!name) name = p.text
    else return null
  }
  const n = (k: string): number | undefined =>
    typeof opts[k] === 'number' ? (opts[k] as number) : undefined
  const s = (k: string): string | undefined =>
    typeof opts[k] === 'string' ? (opts[k] as string) : undefined
  const on = s('on')
  const common = {
    from,
    to: from + line.length,
    ...(s('name') ? { name: s('name') } : {}),
    ...(opts.lock ? { lock: true } : {}),
    ...(on ? { on: { item: on, ...(opts.cell as { row: number; col: number }) } } : {})
  }
  const coords = points.filter((p): p is { x: number; y: number } => typeof p !== 'string')
  // sopra una casella la posizione si calcola: non si scrive
  const [x, y] = coords[0] ? [coords[0].x, coords[0].y] : on ? [0, 0] : [NaN, NaN]
  const placed = coords.length === (on ? 0 : 1)
  const rotate = ((Math.round(n('rotate') ?? 0) % 360) + 360) % 360
  const cards = {
    ...(n('scale') && n('scale') !== 1 ? { scale: n('scale') } : {}),
    ...(s('label') && s('label') !== 'bottom' ? { labelAt: s('label') as SetupLabelAt } : {})
  }
  const paint = {
    ...(s('fill') ? { fill: s('fill') } : {}),
    ...(s('stroke') ? { stroke: s('stroke') } : {}),
    ...(n('thickness') !== undefined && n('thickness')! >= 0 ? { thickness: n('thickness') } : {}),
    ...(s('line') ? { line: s('line') as SetupLineStyle } : {}),
    ...(n('radius') !== undefined && n('radius')! >= 0 ? { radius: n('radius') } : {}),
    ...(n('opacity') !== undefined && n('opacity')! < 1
      ? { opacity: Math.max(0, n('opacity')!) }
      : {})
  }
  if ((on === undefined) !== (opts.cell === undefined)) return null
  if (kind !== 'arrow' && points.length !== coords.length) return null
  if (kind !== 'arrow' && !on && !(Number.isFinite(x) && Number.isFinite(y))) return null
  switch (kind) {
    case 'card':
      if (!name || size || !placed) return null
      return { kind, card: name, x, y, rotate, label: label ?? '', ...cards, ...common }
    case 'deck':
      if (!name || size || !placed) return null
      return {
        kind,
        card: name,
        x,
        y,
        rotate,
        count: Math.max(1, Math.min(60, Math.round(n('count') ?? 5))),
        label: label ?? '',
        ...cards,
        ...common
      }
    case 'row':
    case 'hand': {
      const list = name ? parseCardList(name) : null
      if (!list || size || !placed) return null
      return kind === 'row'
        ? {
            kind,
            cards: list,
            x,
            y,
            label: label ?? '',
            ...(n('gap') !== undefined && n('gap') !== SETUP_ROW_GAP ? { gap: n('gap') } : {}),
            ...(s('direction') === 'down' ? { direction: 'down' as const } : {}),
            ...cards,
            ...common
          }
        : {
            kind,
            cards: list,
            x,
            y,
            label: label ?? '',
            ...(n('spread') !== undefined && n('spread') !== SETUP_HAND_SPREAD
              ? { spread: Math.max(0, Math.min(180, n('spread')!)) }
              : {}),
            ...cards,
            ...common
          }
    }
    case 'zone':
      if (name || !size || !placed) return null
      return {
        kind,
        x,
        y,
        w: size[0],
        h: size[1],
        label: label ?? '',
        ...(rotate ? { rotate } : {}),
        ...paint,
        ...common
      }
    case 'shape': {
      const shape = name.toLowerCase() as SetupShape
      if (!SETUP_SHAPES.includes(shape) || !size || !placed) return null
      const sides = n('sides')
      return {
        kind,
        shape,
        x,
        y,
        w: size[0],
        h: size[1],
        label: label ?? '',
        ...(rotate ? { rotate } : {}),
        ...(sides !== undefined ? { sides: Math.max(3, Math.min(40, Math.round(sides))) } : {}),
        ...(n('inner') !== undefined ? { inner: Math.max(0.05, Math.min(1, n('inner')!)) } : {}),
        ...paint,
        ...common
      }
    }
    case 'text':
      if (name || size || !placed || label === null) return null
      return {
        kind,
        x,
        y,
        w: n('width') ?? SETUP_TEXT_W,
        text: label,
        ...(s('align') && s('align') !== 'center' ? { align: s('align') as SetupTextAlign } : {}),
        ...(s('color') ? { color: s('color') } : {}),
        ...(rotate ? { rotate } : {}),
        ...(s('stroke') && s('stroke') !== 'none' ? { stroke: s('stroke') } : {}),
        ...(s('stroke') && n('thickness') !== undefined && n('thickness')! > 0
          ? { thickness: n('thickness') }
          : {}),
        ...common
      }
    case 'arrow': {
      if (name || size || points.length !== 2) return null
      const [a, b] = points
      const bend = n('bend')
      const shift = n('shift')
      const thickness = n('thickness')
      const scale = n('size')
      return {
        kind,
        x: typeof a === 'string' ? 0 : a.x,
        y: typeof a === 'string' ? 0 : a.y,
        x2: typeof b === 'string' ? 0 : b.x,
        y2: typeof b === 'string' ? 0 : b.y,
        label: label ?? '',
        ...(typeof a === 'string' ? { fromItem: a } : {}),
        ...(typeof b === 'string' ? { toItem: b } : {}),
        ...(bend ? { bend } : {}),
        ...(bend && shift ? { shift } : {}),
        ...(thickness && thickness > 0 ? { thickness } : {}),
        ...(s('heads') && s('heads') !== 'end' ? { heads: s('heads') as ArrowHeads } : {}),
        ...(scale !== undefined && scale > 0 && scale !== 1 ? { size: scale } : {}),
        ...(s('color') ? { color: s('color') } : {}),
        ...(s('line') && s('line') !== 'solid' ? { line: s('line') as SetupLineStyle } : {}),
        ...common
      }
    }
    case 'image':
      if (!name || size || !placed || label !== null) return null
      return {
        kind,
        src: decode(name),
        x,
        y,
        w: n('width') ?? SETUP_IMAGE_W,
        rotate,
        ...common
      }
  }
}

/** Legge le righe del blocco; `starts` è la posizione di ogni riga nel documento */
export function parseSetup(lines: string[], starts: number[]): Setup {
  const out: Setup = {
    size: null,
    margin: null,
    items: [],
    width: null,
    font: null,
    caption: '',
    captionTop: false,
    wrap: null,
    free: false,
    bad: []
  }
  lines.forEach((l, k) => {
    const from = starts[k]
    if (!l.trim() || l.trim().startsWith('#')) return
    const wrap = blockWrapLine(l)
    if (wrap) {
      if ('bad' in wrap) out.bad.push({ from, to: from + l.length })
      else out.wrap = wrap.wrap
      return
    }
    const block = blockSizeLine(l)
    if (block) {
      if (block.value === null) out.bad.push({ from, to: from + l.length })
      else out[block.key] = block.value
      return
    }
    const caption = blockCaptionLine(l)
    if (caption) {
      if (caption.bad) out.bad.push({ from, to: from + l.length })
      if (caption.text !== undefined) out.caption = caption.text
      if (caption.top !== undefined) out.captionTop = caption.top
      return
    }
    const order = /^\s*order\s*:?\s*(\S*)\s*$/i.exec(l)
    if (order) {
      const v = order[1].toLowerCase()
      if (v === 'free' || v === 'layers') out.free = v === 'free'
      else out.bad.push({ from, to: from + l.length })
      return
    }
    const size = /^\s*size\s*:?\s*(\S+)\s*$/i.exec(l)
    const sz = size && SIZE.exec(size[1])
    if (sz) {
      out.size = { w: num(sz[1]), h: num(sz[2]) }
      return
    }
    const margin = /^\s*margin\s*:?\s*(\d+(?:[.,]\d+)?)\s*(?:mm)?\s*$/i.exec(l)
    if (margin) {
      out.margin = Number(margin[1].replace(',', '.'))
      return
    }
    const item = parseItem(l, from)
    if (item) out.items.push(item)
    else out.bad.push({ from, to: from + l.length })
  })
  return out
}

const r = (n: number): string => String(Math.round(n * 10) / 10)
const pct = (n: number): string => `${Math.round(n * 1000) / 10}%`
const quote = (s: string): string => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
const text = (s: string): string => (s ? ` ${quote(s.replace(/\n/g, ' '))}` : '')
const rot = (n: number | undefined): string => (n ? ` rotate=${n}` : '')
const ref = (s: string): string => s.replace(/ /g, '%20')
/** La posizione: le coordinate, o la casella della plancia su cui sta */
const at = (it: SetupItem): string =>
  it.on && it.kind !== 'arrow'
    ? `on=@${it.on.item} cell=${it.on.row},${it.on.col}`
    : `${r(it.x)},${r(it.y)}`

/** Le opzioni comuni, il nome e il blocco, in fondo alla riga prima dell'etichetta */
function commonOpts(it: SetupItem): string {
  return `${it.name ? ` name=${it.name}` : ''}${it.lock ? ' lock' : ''}`
}
function paintOpts(it: Paint): string {
  return [
    it.fill ? ` fill=${it.fill}` : '',
    it.stroke ? ` stroke=${it.stroke}` : '',
    it.thickness !== undefined ? ` thickness=${r(it.thickness)}` : '',
    it.line ? ` line=${it.line}` : '',
    it.radius !== undefined ? ` radius=${r(it.radius)}` : '',
    it.opacity !== undefined && it.opacity < 1 ? ` opacity=${pct(it.opacity)}` : ''
  ].join('')
}
function cardOpts(it: Cards): string {
  return `${it.scale && it.scale !== 1 ? ` scale=${pct(it.scale)}` : ''}${it.labelAt && it.labelAt !== 'bottom' ? ` label=${it.labelAt}` : ''}`
}

/** La riga di un elemento */
export function setupLine(it: SetupItem): string {
  const end = (label: string): string => `${commonOpts(it)}${text(label)}`
  switch (it.kind) {
    case 'card':
      return `card ${ref(it.card)} ${at(it)}${rot(it.rotate)}${cardOpts(it)}${end(it.label)}`
    case 'deck':
      return `deck ${ref(it.card)} ${at(it)} count=${it.count}${rot(it.rotate)}${cardOpts(it)}${end(it.label)}`
    case 'row':
      return `row ${cardListSource(it.cards)} ${at(it)}${it.gap !== undefined ? ` gap=${r(it.gap)}` : ''}${it.direction === 'down' ? ' direction=down' : ''}${cardOpts(it)}${end(it.label)}`
    case 'hand':
      return `hand ${cardListSource(it.cards)} ${at(it)}${it.spread !== undefined ? ` spread=${r(it.spread)}` : ''}${cardOpts(it)}${end(it.label)}`
    case 'zone':
      return `zone ${at(it)} ${r(it.w)}x${r(it.h)}${rot(it.rotate)}${paintOpts(it)}${end(it.label)}`
    case 'shape':
      return `shape ${it.shape} ${at(it)} ${r(it.w)}x${r(it.h)}${rot(it.rotate)}${it.sides !== undefined ? ` sides=${it.sides}` : ''}${it.inner !== undefined ? ` inner=${pct(it.inner)}` : ''}${paintOpts(it)}${end(it.label)}`
    case 'text':
      return `text ${at(it)} width=${r(it.w)}${it.align && it.align !== 'center' ? ` align=${it.align}` : ''}${it.color ? ` color=${it.color}` : ''}${it.stroke ? ` stroke=${it.stroke}${it.thickness ? ` thickness=${r(it.thickness)}` : ''}` : ''}${rot(it.rotate)}${commonOpts(it)} ${quote(it.text.replace(/\n/g, ' '))}`
    case 'arrow': {
      const a = it.fromItem ? `@${it.fromItem}` : `${r(it.x)},${r(it.y)}`
      const b = it.toItem ? `@${it.toItem}` : `${r(it.x2)},${r(it.y2)}`
      return `arrow ${a} -> ${b}${it.bend ? ` bend=${r(it.bend)}` : ''}${it.bend && it.shift ? ` shift=${r(it.shift)}` : ''}${it.heads && it.heads !== 'end' ? ` heads=${it.heads}` : ''}${it.size && it.size !== 1 ? ` size=${Math.round(it.size * 100)}%` : ''}${it.thickness ? ` thickness=${r(it.thickness)}` : ''}${it.color ? ` color=${it.color}` : ''}${it.line && it.line !== 'solid' ? ` line=${it.line}` : ''}${end(it.label)}`
    }
    case 'image':
      return `image ${it.src.replace(/%/g, '%25').replace(/ /g, '%20')} ${at(it)} width=${r(it.w)}${rot(it.rotate)}${commonOpts(it)}`
  }
}

/** Il testo del blocco ```setup */
export function setupSource(
  s: Pick<Setup, 'size' | 'items' | 'width' | 'font' | 'caption' | 'captionTop' | 'wrap'> & {
    margin?: number | null
    free?: boolean
  }
): string {
  return [
    '```' + SETUP_FENCE,
    ...(s.size ? [`size ${r(s.size.w)}x${r(s.size.h)}`] : []),
    ...(!s.size && s.margin != null ? [`margin ${r(s.margin)}`] : []),
    ...blockSizeLines(s),
    ...blockWrapLines(s),
    ...blockCaptionLines(s),
    ...(s.free ? ['order: free'] : []),
    ...s.items.map(setupLine),
    '```'
  ].join('\n')
}

// Disposizione degli elementi nell'editor dello schema: spostamento, allineamento, distribuzione
// e ordine. I riquadri (render/setupGeometry.ts) arrivano da fuori, nello stesso ordine.

interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** L'elemento spostato di dx, dy mm; la freccia si sposta con tutte e due le punte */
export function moveSetupItem(it: SetupItem, dx: number, dy: number): SetupItem {
  const tenth = (n: number): number => Math.round(n * 10) / 10
  const moved = { ...it, x: tenth(it.x + dx), y: tenth(it.y + dy) }
  return moved.kind === 'arrow'
    ? { ...moved, x2: tenth(moved.x2 + dx), y2: tenth(moved.y2 + dy) }
    : moved
}

interface Pt {
  x: number
  y: number
}

/**
 * La curva di una freccia, una Bézier quadratica: `control` è il punto di controllo, `mid` il
 * centro della curva (dove sta la didascalia e la maniglia della curva), `normal` la direzione in
 * cui una curva positiva si scosta
 */
export function arrowCurve(it: {
  x: number
  y: number
  x2: number
  y2: number
  bend?: number
  shift?: number
}): {
  control: Pt
  mid: Pt
  normal: Pt
} {
  const dx = it.x2 - it.x
  const dy = it.y2 - it.y
  const len = Math.hypot(dx, dy) || 1
  const along = { x: dx / len, y: dy / len }
  // a destra di chi va dalla coda alla punta, con le y verso il basso
  const normal = { x: -along.y, y: along.x }
  const b = it.bend ?? 0
  const s = b ? (it.shift ?? 0) : 0
  const cx = (it.x + it.x2) / 2
  const cy = (it.y + it.y2) / 2
  const ox = normal.x * b + along.x * s
  const oy = normal.y * b + along.y * s
  return {
    // il centro di una quadratica sta a metà tra la corda e il punto di controllo
    control: { x: cx + ox * 2, y: cy + oy * 2 },
    mid: { x: cx + ox, y: cy + oy },
    normal
  }
}

/**
 * La curva di una freccia che passa per un punto: di quanto il punto si scosta dalla retta e di
 * quanto dal centro lungo la freccia, al decimo
 */
export function bendTowards(
  it: { x: number; y: number; x2: number; y2: number },
  p: Pt
): { bend: number; shift: number } {
  const { normal } = arrowCurve(it)
  const rx = p.x - (it.x + it.x2) / 2
  const ry = p.y - (it.y + it.y2) / 2
  const r = (n: number): number => Math.round(n * 10) / 10
  return { bend: r(rx * normal.x + ry * normal.y), shift: r(rx * normal.y - ry * normal.x) }
}

export type SetupAlign = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'

/** Allinea gli elementi scelti al riquadro che li contiene tutti */
export function alignSetupItems(
  items: SetupItem[],
  boxes: Box[],
  chosen: number[],
  mode: SetupAlign
): SetupItem[] {
  const list = chosen.filter((i) => boxes[i])
  if (list.length < 2) return items
  const x1 = Math.min(...list.map((i) => boxes[i].x))
  const y1 = Math.min(...list.map((i) => boxes[i].y))
  const x2 = Math.max(...list.map((i) => boxes[i].x + boxes[i].w))
  const y2 = Math.max(...list.map((i) => boxes[i].y + boxes[i].h))
  return items.map((it, i) => {
    if (!list.includes(i)) return it
    const b = boxes[i]
    const dx =
      mode === 'left'
        ? x1 - b.x
        : mode === 'right'
          ? x2 - (b.x + b.w)
          : mode === 'hcenter'
            ? (x1 + x2) / 2 - (b.x + b.w / 2)
            : 0
    const dy =
      mode === 'top'
        ? y1 - b.y
        : mode === 'bottom'
          ? y2 - (b.y + b.h)
          : mode === 'vcenter'
            ? (y1 + y2) / 2 - (b.y + b.h / 2)
            : 0
    return dx || dy ? moveSetupItem(it, dx, dy) : it
  })
}

/** Spazi uguali tra gli elementi scelti, lasciando fermi il primo e l'ultimo */
export function distributeSetupItems(
  items: SetupItem[],
  boxes: Box[],
  chosen: number[],
  axis: 'h' | 'v'
): SetupItem[] {
  const list = chosen.filter((i) => boxes[i])
  if (list.length < 3) return items
  const pos = (i: number): number => (axis === 'h' ? boxes[i].x : boxes[i].y)
  const len = (i: number): number => (axis === 'h' ? boxes[i].w : boxes[i].h)
  const sorted = [...list].sort((a, b) => pos(a) - pos(b))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const total = sorted.reduce((s, i) => s + len(i), 0)
  const gap = (pos(last) + len(last) - pos(first) - total) / (sorted.length - 1)
  const target = new Map<number, number>()
  let at = pos(first)
  for (const i of sorted) {
    target.set(i, at)
    at += len(i) + gap
  }
  return items.map((it, i) => {
    const t = target.get(i)
    if (t === undefined) return it
    const d = t - pos(i)
    return Math.abs(d) < 0.05 ? it : moveSetupItem(it, axis === 'h' ? d : 0, axis === 'v' ? d : 0)
  })
}

/**
 * Strato in cui il disegno mette l'elemento senza `order: free`: le zone e le forme sotto, poi
 * carte, mazzi, file, mani e immagini, poi testi e frecce. Dentro uno strato vale l'ordine delle
 * righe: le ultime stanno sopra.
 */
export const setupLayer = (kind: SetupKind): number =>
  kind === 'zone' || kind === 'shape' ? 0 : kind === 'text' || kind === 'arrow' ? 2 : 1

/** Gli elementi nell'ordine in cui li disegnano gli strati: con `order: free` lo stesso aspetto */
export function sortByLayer<T extends { kind: SetupKind }>(items: T[]): T[] {
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => setupLayer(a.it.kind) - setupLayer(b.it.kind) || a.i - b.i)
    .map((x) => x.it)
}

/** Le righe sono già nell'ordine degli strati? Allora `order: free` non cambia niente */
export function layerOrdered(items: { kind: SetupKind }[]): boolean {
  return items.every((it, i) => i === 0 || setupLayer(items[i - 1].kind) <= setupLayer(it.kind))
}

export type SetupOrder = 'up' | 'down' | 'top' | 'bottom'

/**
 * Porta l'elemento avanti o indietro tra tutti gli elementi (l'ordine diventa libero);
 * restituisce le righe e la nuova posizione dell'elemento
 */
export function reorderSetupItem(
  items: SetupItem[],
  index: number,
  to: SetupOrder
): { items: SetupItem[]; index: number } {
  const it = items[index]
  if (!it) return { items, index }
  const goal =
    to === 'up'
      ? Math.min(items.length - 1, index + 1)
      : to === 'down'
        ? Math.max(0, index - 1)
        : to === 'top'
          ? items.length - 1
          : 0
  if (goal === index) return { items, index }
  const out = items.filter((_, i) => i !== index)
  out.splice(goal, 0, it)
  return { items: out, index: goal }
}

/** Si può portare avanti (o indietro)? */
export function canReorderSetupItem(items: SetupItem[], index: number, up: boolean): boolean {
  if (!items[index]) return false
  return up ? index < items.length - 1 : index > 0
}
