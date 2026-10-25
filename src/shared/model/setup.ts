// Schema della preparazione del tavolo nei documenti: un blocco ```setup con un elemento per
// riga, in mm su un'area. Lo si scrive a mano, lo scrive un agente o lo prepara l'editor
// dell'app; il documento lo disegna con le carte vere del progetto.
//
//   size 280x180
//   zone 0,0 280x60 "Giocatore 1"
//   deck Personaggi/1?side=back 20,10 count=8 "Mazzo"
//   card Personaggi/nome=Mago 60,10 rotate=90 "Il mago"
//   text 140,30 width=50 "Pesca **2** carte"
//   arrow 40,50 -> 60,80 "pesca"
//   image icons/moneta.png 200,20 width=10

export const SETUP_FENCE = 'setup'

export type SetupItem = { from: number; to: number } & (
  | { kind: 'card'; card: string; x: number; y: number; rotate: number; label: string }
  | {
      kind: 'deck'
      card: string
      x: number
      y: number
      rotate: number
      count: number
      label: string
    }
  | { kind: 'zone'; x: number; y: number; w: number; h: number; label: string }
  | { kind: 'text'; x: number; y: number; w: number; text: string }
  | { kind: 'arrow'; x: number; y: number; x2: number; y2: number; label: string }
  | { kind: 'image'; src: string; x: number; y: number; w: number; rotate: number }
)

export type SetupKind = SetupItem['kind']

export interface Setup {
  /** Misure dell'area in mm; senza, quelle degli elementi */
  size: { w: number; h: number } | null
  items: SetupItem[]
  /** Righe che non si capiscono */
  bad: { from: number; to: number }[]
}

/** Larghezza di base dei testi e delle immagini, in mm */
export const SETUP_TEXT_W = 50
export const SETUP_IMAGE_W = 15

const KINDS = new Set<SetupKind>(['card', 'deck', 'zone', 'text', 'arrow', 'image'])
const PAIR = /^(-?\d+(?:[.,]\d+)?),(-?\d+(?:[.,]\d+)?)$/
const SIZE = /^(\d+(?:[.,]\d+)?)x(\d+(?:[.,]\d+)?)$/i
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

/** Un elemento da una riga, o null se non si capisce */
function parseItem(line: string, from: number): SetupItem | null {
  const parts = tokens(line)
  if (!parts?.length || parts[0].quoted) return null
  const kind = parts[0].text.toLowerCase() as SetupKind
  if (!KINDS.has(kind)) return null
  const pairs: [number, number][] = []
  let size: [number, number] | null = null
  let name = ''
  let label: string | null = null
  const opts: Record<string, number> = {}
  for (const p of parts.slice(1)) {
    if (p.quoted) {
      if (label !== null) return null
      label = p.text
      continue
    }
    const pair = PAIR.exec(p.text)
    const sz = SIZE.exec(p.text)
    const opt = /^(rotate|count|width)=(-?\d+(?:[.,]\d+)?)$/i.exec(p.text)
    if (p.text === '->') continue
    if (pair) pairs.push([num(pair[1]), num(pair[2])])
    else if (sz && !size) size = [num(sz[1]), num(sz[2])]
    else if (opt) opts[opt[1].toLowerCase()] = num(opt[2])
    else if (!name) name = p.text
    else return null
  }
  const at = { from, to: from + line.length }
  const [x, y] = pairs[0] ?? [NaN, NaN]
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  const rotate = ((Math.round(opts.rotate ?? 0) % 360) + 360) % 360
  switch (kind) {
    case 'card':
      if (!name || size || pairs.length !== 1) return null
      return { kind, card: name, x, y, rotate, label: label ?? '', ...at }
    case 'deck':
      if (!name || size || pairs.length !== 1) return null
      return {
        kind,
        card: name,
        x,
        y,
        rotate,
        count: Math.max(1, Math.min(60, Math.round(opts.count ?? 5))),
        label: label ?? '',
        ...at
      }
    case 'zone':
      if (name || !size || pairs.length !== 1) return null
      return { kind, x, y, w: size[0], h: size[1], label: label ?? '', ...at }
    case 'text':
      if (name || size || pairs.length !== 1 || label === null) return null
      return { kind, x, y, w: opts.width ?? SETUP_TEXT_W, text: label, ...at }
    case 'arrow':
      if (name || size || pairs.length !== 2) return null
      return { kind, x, y, x2: pairs[1][0], y2: pairs[1][1], label: label ?? '', ...at }
    case 'image':
      if (!name || size || pairs.length !== 1 || label !== null) return null
      return { kind, src: decode(name), x, y, w: opts.width ?? SETUP_IMAGE_W, rotate, ...at }
  }
}

/** Legge le righe del blocco; `starts` è la posizione di ogni riga nel documento */
export function parseSetup(lines: string[], starts: number[]): Setup {
  const out: Setup = { size: null, items: [], bad: [] }
  lines.forEach((l, k) => {
    const from = starts[k]
    if (!l.trim() || l.trim().startsWith('#')) return
    const size = /^\s*size\s*:?\s*(\S+)\s*$/i.exec(l)
    const sz = size && SIZE.exec(size[1])
    if (sz) {
      out.size = { w: num(sz[1]), h: num(sz[2]) }
      return
    }
    const item = parseItem(l, from)
    if (item) out.items.push(item)
    else out.bad.push({ from, to: from + l.length })
  })
  return out
}

const r = (n: number): string => String(Math.round(n * 10) / 10)
const quote = (s: string): string => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
const text = (s: string): string => (s ? ` ${quote(s.replace(/\n/g, ' '))}` : '')
const rot = (n: number): string => (n ? ` rotate=${n}` : '')

/** La riga di un elemento */
export function setupLine(it: SetupItem): string {
  switch (it.kind) {
    case 'card':
      return `card ${it.card.replace(/ /g, '%20')} ${r(it.x)},${r(it.y)}${rot(it.rotate)}${text(it.label)}`
    case 'deck':
      return `deck ${it.card.replace(/ /g, '%20')} ${r(it.x)},${r(it.y)} count=${it.count}${rot(it.rotate)}${text(it.label)}`
    case 'zone':
      return `zone ${r(it.x)},${r(it.y)} ${r(it.w)}x${r(it.h)}${text(it.label)}`
    case 'text':
      return `text ${r(it.x)},${r(it.y)} width=${r(it.w)} ${quote(it.text.replace(/\n/g, ' '))}`
    case 'arrow':
      return `arrow ${r(it.x)},${r(it.y)} -> ${r(it.x2)},${r(it.y2)}${text(it.label)}`
    case 'image':
      return `image ${it.src.replace(/%/g, '%25').replace(/ /g, '%20')} ${r(it.x)},${r(it.y)} width=${r(it.w)}${rot(it.rotate)}`
  }
}

/** Il testo del blocco ```setup */
export function setupSource(s: Pick<Setup, 'size' | 'items'>): string {
  return [
    '```' + SETUP_FENCE,
    ...(s.size ? [`size ${r(s.size.w)}x${r(s.size.h)}`] : []),
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
 * Strato in cui il disegno mette l'elemento: le zone sotto, poi carte, mazzi e immagini, poi testi
 * e frecce. Dentro uno strato vale l'ordine delle righe: le ultime stanno sopra.
 */
export const setupLayer = (kind: SetupKind): number =>
  kind === 'zone' ? 0 : kind === 'text' || kind === 'arrow' ? 2 : 1

export type SetupOrder = 'up' | 'down' | 'top' | 'bottom'

/**
 * Porta l'elemento avanti o indietro tra quelli dello stesso strato; restituisce le righe e la
 * nuova posizione dell'elemento
 */
export function reorderSetupItem(
  items: SetupItem[],
  index: number,
  to: SetupOrder
): { items: SetupItem[]; index: number } {
  const it = items[index]
  if (!it) return { items, index }
  const layer = setupLayer(it.kind)
  const same = items.flatMap((x, i) => (setupLayer(x.kind) === layer ? [i] : []))
  const k = same.indexOf(index)
  const goal =
    to === 'up'
      ? Math.min(same.length - 1, k + 1)
      : to === 'down'
        ? Math.max(0, k - 1)
        : to === 'top'
          ? same.length - 1
          : 0
  if (goal === k) return { items, index }
  const order = same.filter((i) => i !== index)
  order.splice(goal, 0, index)
  // le posizioni dello strato restano le stesse, cambia solo chi le occupa
  const out = [...items]
  same.forEach((slot, n) => (out[slot] = items[order[n]]))
  return { items: out, index: same[goal] }
}

/** Si può portare avanti (o indietro) tra gli elementi dello stesso strato? */
export function canReorderSetupItem(items: SetupItem[], index: number, up: boolean): boolean {
  const it = items[index]
  if (!it) return false
  const layer = setupLayer(it.kind)
  return items.some((x, i) => (up ? i > index : i < index) && setupLayer(x.kind) === layer)
}
