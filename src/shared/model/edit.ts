import { arrangeModel } from './arrange'
import { isArranged, normalizeLayer, SNAP_SIZE, walkLayers, type RawLayer } from './normalize'
import {
  isDrawn,
  type Constraints,
  type GroupLayer,
  type Layer,
  type LayerType,
  type Side,
  type Template
} from './template'

// Operazioni sui livelli di un template. Tutte pure: restituiscono un nuovo template.
// I figli di un gruppo hanno coordinate assolute sulla carta; il riquadro del gruppo
// è l'ingombro dei figli e si ricalcola dopo ogni modifica.

export interface Bounds {
  x: number
  y: number
  w: number
  h: number
}

export function findLayer(layers: Layer[], id: string): Layer | null {
  for (const l of layers) {
    if (l.id === id) return l
    if (l.type === 'group') {
      const found = findLayer(l.children, id)
      if (found) return found
    }
  }
  return null
}

/** Gruppo che contiene il livello (null se è al primo livello) */
export function findParent(layers: Layer[], id: string): GroupLayer | null {
  for (const l of layers) {
    if (l.type !== 'group') continue
    if (l.children.some((c) => c.id === id)) return l
    const found = findParent(l.children, id)
    if (found) return found
  }
  return null
}

function mapLayers(layers: Layer[], fn: (l: Layer) => Layer): Layer[] {
  return layers.map((l) => {
    const mapped = fn(l)
    return mapped.type === 'group'
      ? fitGroup({ ...mapped, children: mapLayers(mapped.children, fn) })
      : mapped
  })
}

export function updateLayers(t: Template, side: Side, fn: (l: Layer) => Layer): Template {
  return { ...t, [side]: mapLayers(t[side], fn) }
}

export function patchLayer(t: Template, side: Side, id: string, patch: Partial<Layer>): Template {
  return updateLayers(t, side, (l) => {
    if (l.id !== id) return l
    let next = { ...l, ...patch } as Layer
    if (next.type === 'group' && 'clip' in patch) next = fitGroup(next)
    // spostare o ridimensionare un gruppo dal pannello proprietà trascina i figli
    if (l.type === 'group' && ('x' in patch || 'y' in patch || 'w' in patch || 'h' in patch)) {
      return transformInto(l, next as Bounds)
    }
    return next
  })
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Stessa modifica a più livelli selezionati. Il pannello mostra i valori di `from` e costruisce
 * le modifiche a partire da lì: nelle proprietà composte (contorno, ombra, vincoli...) agli altri
 * livelli arrivano solo le voci cambiate rispetto a `from`, il resto resta il loro.
 */
export function patchLayers(
  t: Template,
  side: Side,
  ids: string[],
  from: Layer,
  patch: Partial<Layer>
): Template {
  let next = t
  for (const id of ids) {
    const own = findLayer(t[side], id)
    if (!own) continue
    if (id === from.id) {
      next = patchLayer(next, side, id, patch)
      continue
    }
    const mine: Record<string, unknown> = {}
    const base = from as unknown as Record<string, unknown>
    const target = own as unknown as Record<string, unknown>
    for (const [k, v] of Object.entries(patch)) {
      if (isRecord(v) && isRecord(base[k]) && isRecord(target[k])) {
        const changed = Object.entries(v).filter(
          ([kk, vv]) => vv !== (base[k] as Record<string, unknown>)[kk]
        )
        mine[k] = { ...target[k], ...Object.fromEntries(changed) }
      } else mine[k] = v
    }
    next = patchLayer(next, side, id, mine as Partial<Layer>)
  }
  return next
}

/** Ingombro di un insieme di livelli, senza tener conto della rotazione */
export function boundsOf(all: Layer[]): Bounds {
  const layers = all.filter(isDrawn)
  if (!layers.length) return { x: 0, y: 0, w: 0, h: 0 }
  const x1 = Math.min(...layers.map((l) => l.x))
  const y1 = Math.min(...layers.map((l) => l.y))
  const x2 = Math.max(...layers.map((l) => l.x + l.w))
  const y2 = Math.max(...layers.map((l) => l.y + l.h))
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

export function fitGroup(g: GroupLayer): GroupLayer {
  // con la disposizione automatica il riquadro resta e i figli vi si dispongono
  if (isArranged(g)) return arrangeModel(g)
  if (!g.children.some(isDrawn)) return g
  // un gruppo ritagliato occupa solo la sua maschera, il livello in fondo
  if (g.clip && g.children.length > 1) return { ...g, ...boundsOf(g.children.slice(-1)) }
  return { ...g, ...boundsOf(g.children) }
}

export function translateLayer(l: Layer, dx: number, dy: number): Layer {
  const moved = { ...l, x: l.x + dx, y: l.y + dy }
  if (moved.type === 'group') moved.children = moved.children.map((c) => translateLayer(c, dx, dy))
  return moved
}

/** Porta il livello nel nuovo riquadro, scalando in proporzione i figli dei gruppi */
export function transformInto(l: Layer, b: Bounds): Layer {
  // un gruppo che dispone i figli cambia solo il riquadro, i figli tengono la loro misura
  if (l.type === 'group' && isArranged(l)) return arrangeModel({ ...l, ...b })
  const sx = l.w ? b.w / l.w : 1
  const sy = l.h ? b.h / l.h : 1
  const map = (c: Layer): Layer => {
    const out = {
      ...c,
      x: b.x + (c.x - l.x) * sx,
      y: b.y + (c.y - l.y) * sy,
      w: c.w * sx,
      h: c.h * sy
    } as Layer
    if (out.type === 'group') out.children = out.children.map(map)
    return out
  }
  return map(l)
}

export function removeLayers(t: Template, side: Side, ids: string[]): Template {
  const drop = (layers: Layer[]): Layer[] =>
    layers
      .filter((l) => !ids.includes(l.id))
      .map((l) => (l.type === 'group' ? fitGroup({ ...l, children: drop(l.children) }) : l))
      // un gruppo rimasto vuoto non ha senso
      .filter((l) => l.type !== 'group' || l.children.length > 0)
  return { ...t, [side]: drop(t[side]) }
}

/** Inserisce sopra al livello di riferimento (o in cima se assente), nello stesso contenitore */
export function insertLayer(t: Template, side: Side, layer: Layer, aboveId?: string): Template {
  if (!aboveId) return { ...t, [side]: [layer, ...t[side]] }
  const ins = (layers: Layer[]): Layer[] => {
    const i = layers.findIndex((l) => l.id === aboveId)
    if (i >= 0) return [...layers.slice(0, i), layer, ...layers.slice(i)]
    return layers.map((l) =>
      l.type === 'group' ? fitGroup({ ...l, children: ins(l.children) }) : l
    )
  }
  return { ...t, [side]: ins(t[side]) }
}

/** Sposta di una posizione nell'ordine di sovrapposizione: 'up' verso la cima */
export function moveLayer(t: Template, side: Side, id: string, direction: 'up' | 'down'): Template {
  const mv = (layers: Layer[]): Layer[] => {
    const i = layers.findIndex((l) => l.id === id)
    if (i >= 0) {
      const j = direction === 'up' ? i - 1 : i + 1
      if (j < 0 || j >= layers.length) return layers
      const out = [...layers]
      ;[out[i], out[j]] = [out[j], out[i]]
      return out
    }
    return layers.map((l) => (l.type === 'group' ? { ...l, children: mv(l.children) } : l))
  }
  return { ...t, [side]: mv(t[side]) }
}

/**
 * Sposta un livello accanto a un altro, anche in un contenitore diverso: 'before' sopra al
 * riferimento, 'after' sotto, 'inside' come primo figlio di un gruppo.
 */
export function moveLayerTo(
  t: Template,
  side: Side,
  id: string,
  targetId: string,
  where: 'before' | 'after' | 'inside'
): Template {
  const layer = findLayer(t[side], id)
  const target = findLayer(t[side], targetId)
  if (!layer || !target || id === targetId) return t
  // un gruppo non può finire dentro se stesso
  if (layer.type === 'group' && findLayer(layer.children, targetId)) return t
  if (where === 'inside' && target.type !== 'group') return t
  const without = removeLayers(t, side, [id])
  if (!findLayer(without[side], targetId)) return t
  const put = (layers: Layer[]): Layer[] => {
    const i = layers.findIndex((l) => l.id === targetId)
    if (i >= 0) {
      if (where === 'inside') {
        const g = layers[i] as GroupLayer
        const out = [...layers]
        out[i] = fitGroup({ ...g, children: [layer, ...g.children] })
        return out
      }
      const at = where === 'before' ? i : i + 1
      return [...layers.slice(0, at), layer, ...layers.slice(at)]
    }
    return layers.map((l) =>
      l.type === 'group' ? fitGroup({ ...l, children: put(l.children) }) : l
    )
  }
  return { ...without, [side]: put(without[side]) }
}

export function uniqueName(t: Template, base: string): string {
  const names = new Set(walkLayers([...t.front, ...t.back]).map((l) => l.name))
  const stem = base.replace(/_\d+$/, '')
  if (!names.has(stem)) return stem
  for (let i = 2; ; i++) if (!names.has(`${stem}_${i}`)) return `${stem}_${i}`
}

export function isNameTaken(t: Template, name: string, exceptId: string): boolean {
  return walkLayers([...t.front, ...t.back]).some((l) => l.name === name && l.id !== exceptId)
}

/**
 * Raggruppa livelli fratelli. Se non stanno nello stesso contenitore restituisce il template
 * invariato: l'interfaccia lo impedisce prima.
 */
export function groupLayers(
  t: Template,
  side: Side,
  ids: string[]
): { template: Template; groupId: string | null } {
  if (!ids.length) return { template: t, groupId: null }
  const parent = findParent(t[side], ids[0])
  const siblings = parent ? parent.children : t[side]
  if (!ids.every((id) => siblings.some((l) => l.id === id))) return { template: t, groupId: null }

  const members = siblings.filter((l) => ids.includes(l.id))
  const group = normalizeLayer(
    { type: 'group', name: uniqueName(t, 'group'), children: members as unknown as [] },
    0
  ) as GroupLayer
  const fitted = fitGroup({ ...group, children: members })
  const firstIndex = siblings.findIndex((l) => ids.includes(l.id))
  const rebuilt = siblings.filter((l) => !ids.includes(l.id))
  rebuilt.splice(firstIndex, 0, fitted)

  const replace = (layers: Layer[]): Layer[] =>
    layers === siblings
      ? rebuilt
      : layers.map((l) =>
          l.type === 'group' ? fitGroup({ ...l, children: replace(l.children) }) : l
        )
  return { template: { ...t, [side]: replace(t[side]) }, groupId: fitted.id }
}

export function ungroupLayer(
  t: Template,
  side: Side,
  id: string
): { template: Template; childIds: string[] } {
  const g = findLayer(t[side], id)
  if (!g || g.type !== 'group') return { template: t, childIds: [] }
  const un = (layers: Layer[]): Layer[] =>
    layers.flatMap((l) =>
      l.id === id
        ? (l as GroupLayer).children
        : l.type === 'group'
          ? [fitGroup({ ...l, children: un(l.children) })]
          : [l]
    )
  return { template: { ...t, [side]: un(t[side]) }, childIds: g.children.map((c) => c.id) }
}

/** Copia con nuovi id e nomi univoci, sfalsata di 2 mm */
export function duplicateLayer(t: Template, l: Layer): Layer {
  let current = t
  const copy = (src: Layer): Layer => {
    const name = uniqueName(current, src.name)
    const out = normalizeLayer(
      { ...(src as unknown as Record<string, unknown>), id: undefined, name },
      0
    )
    // il nome appena preso deve risultare occupato per i fratelli successivi
    current = { ...current, front: [...current.front, out] }
    if (out.type === 'group' && src.type === 'group') out.children = src.children.map(copy)
    return out
  }
  return translateLayer(copy(l), 2, 2)
}

/** Testo negli appunti per i livelli copiati: si incollano in qualsiasi template, anche di un altro progetto */
export function layersToClipboard(template: Template, side: Side, ids: string[]): string | null {
  const chosen = new Set(ids)
  // in ordine di sovrapposizione; i figli di un gruppo copiato viaggiano con il gruppo
  const layers: Layer[] = []
  const visit = (list: Layer[]): void => {
    for (const l of list) {
      if (chosen.has(l.id)) layers.push(l)
      else if (l.type === 'group') visit(l.children)
    }
  }
  visit(template[side])
  if (!layers.length) return null
  return JSON.stringify({ stella: 'layers', template: template.name, layers })
}

/** I livelli negli appunti, o null se il testo non viene da layersToClipboard */
export function layersFromClipboard(text: string): { template: string; layers: Layer[] } | null {
  try {
    const data = JSON.parse(text)
    if (data?.stella !== 'layers' || !Array.isArray(data.layers) || !data.layers.length) return null
    return {
      template: typeof data.template === 'string' ? data.template : '',
      layers: data.layers.map((l: RawLayer, i: number) => normalizeLayer(l, i))
    }
  } catch {
    return null
  }
}

/**
 * Incolla livelli copiati: nuovi id, nomi liberi nel template, sopra al livello `aboveId`.
 * Un livello che cambia nome continua a leggere la colonna di prima. Con `offset` si spostano
 * di 2 mm, come una duplicazione, per non coprire gli originali.
 */
export function pasteLayers(
  t: Template,
  side: Side,
  layers: Layer[],
  aboveId?: string,
  offset = false
): { template: Template; ids: string[] } {
  let current = t
  const copy = (src: Layer): Layer => {
    const name = uniqueName(current, src.name)
    const keepColumn = name !== src.name && src.source.kind === 'column' && !src.source.column
    const out = normalizeLayer(
      {
        ...(src as unknown as Record<string, unknown>),
        id: undefined,
        name,
        ...(keepColumn ? { source: { kind: 'column', column: src.name } } : {})
      },
      0
    )
    current = { ...current, front: [...current.front, out] }
    if (out.type === 'group' && src.type === 'group') out.children = src.children.map(copy)
    return out
  }
  const copies = layers.map((l) => (offset ? translateLayer(copy(l), 2, 2) : copy(l)))
  // senza livello di riferimento si inserisce in cima: dall'ultimo per mantenere l'ordine
  let out = t
  if (aboveId) for (const c of copies) out = insertLayer(out, side, c, aboveId)
  else for (const c of [...copies].reverse()) out = insertLayer(out, side, c)
  return { template: out, ids: copies.map((c) => c.id) }
}

/** Nomi dei livelli nuovi nella lingua dell'interfaccia; mancano: i nomi inglesi */
export interface LayerNames {
  text?: string
  image?: string
  value?: string
  grid?: string
  shape?: string
  snap?: string
  /** Il testo di prova di un livello di testo nuovo */
  sample?: string
  /** Nomi delle forme: rect, ellipse, polygon, star, line, path */
  shapes?: Partial<Record<string, string>>
}

export function newLayer(
  t: Template,
  type: LayerType,
  shape?: string,
  names: LayerNames = {}
): Layer {
  // testo largo e basso, forme e immagini quadrate
  const w = Math.round(t.width * (type === 'text' ? 0.6 : 0.4))
  // una linea è orizzontale: il riquadro alto 0 serve solo a selezionarla
  const h = type === 'text' ? 10 : shape === 'line' ? 0 : w
  const base = {
    x: Math.round((t.width - w) / 2),
    y: Math.round((t.height - h) / 2),
    w,
    h
  }
  switch (type) {
    case 'text':
      return normalizeLayer(
        {
          type,
          name: uniqueName(t, names.text ?? 'text'),
          text: names.sample ?? 'Text',
          ...base
        },
        0
      )
    case 'image':
      return normalizeLayer({ type, name: uniqueName(t, names.image ?? 'image'), ...base }, 0)
    case 'value':
      return normalizeLayer({ type, name: uniqueName(t, names.value ?? 'value') }, 0)
    case 'grid':
      return normalizeLayer({ type, name: uniqueName(t, names.grid ?? 'grid'), ...base }, 0)
    case 'snap':
      // piccolo: il punto è il centro; parte dal centro della carta
      return normalizeLayer(
        {
          type,
          name: uniqueName(t, names.snap ?? 'snap'),
          // si accende e si spegne con una colonna solo se serve: di base è fisso
          source: { kind: 'fixed' },
          x: t.width / 2 - SNAP_SIZE / 2,
          y: t.height / 2 - SNAP_SIZE / 2
        },
        0
      )
    default: {
      const base0 = shape ? (names.shapes?.[shape] ?? shape) : (names.shape ?? 'shape')
      return normalizeLayer(
        { type: 'shape', shape: shape ?? 'rect', name: uniqueName(t, base0), ...base },
        0
      )
    }
  }
}

/** Posizione e dimensione su un asse quando la carta passa da `from` a `to` mm, secondo il vincolo */
export function constrain(
  c: Constraints['h'] | Constraints['v'],
  start: number,
  size: number,
  from: number,
  to: number
): [number, number] {
  const d = to - from
  switch (c) {
    case 'right':
    case 'bottom':
      return [start + d, size]
    case 'center':
      return [start + d / 2, size]
    case 'both':
      return [start, Math.max(0.5, size + d)]
    case 'scale':
      return from > 0 ? [(start * to) / from, (size * to) / from] : [start, size]
    default:
      return [start, size]
  }
}

/** Cambio di formato del template: vedi docs/specifica.md, sezione 8.1 */
export function resizeTemplate(
  t: Template,
  width: number,
  height: number,
  mode: 'scale' | 'keep'
): Template {
  if (mode === 'keep') {
    const follow = (l: Layer): Layer => {
      if (l.type === 'group' && isArranged(l)) {
        const [x, w] = constrain(l.constraints.h, l.x, l.w, t.width, width)
        const [y, h] = constrain(l.constraints.v, l.y, l.h, t.height, height)
        return arrangeModel({ ...l, x, y, w, h, children: l.children.map(follow) })
      }
      if (l.type === 'group') return fitGroup({ ...l, children: l.children.map(follow) })
      const [x, w] = constrain(l.constraints.h, l.x, l.w, t.width, width)
      const [y, h] = constrain(l.constraints.v, l.y, l.h, t.height, height)
      return x === l.x && y === l.y && w === l.w && h === l.h ? l : ({ ...l, x, y, w, h } as Layer)
    }
    return { ...t, width, height, front: t.front.map(follow), back: t.back.map(follow) }
  }
  const sx = width / t.width
  const sy = height / t.height
  const b = t.bleed
  const eps = 0.01
  // i bordi che arrivano all'abbondanza (sfondi a tutta carta) restano sull'abbondanza
  const edge = (
    start: number,
    size: number,
    from: number,
    to: number,
    k: number
  ): [number, number] => {
    const end = start + size
    const a = start <= -b + eps ? start : start * k
    const z = end >= from + b - eps ? end - from + to : end * k
    return [a, z - a]
  }
  const scale = (l: Layer): Layer => {
    const [x, w] = edge(l.x, l.w, t.width, width, sx)
    const [y, h] = edge(l.y, l.h, t.height, height, sy)
    if (l.type === 'group' && isArranged(l))
      return arrangeModel({
        ...l,
        x,
        y,
        w,
        h,
        gap: l.gap * Math.min(sx, sy),
        children: l.children.map(scale)
      })
    if (l.type === 'group') return fitGroup({ ...l, children: l.children.map(scale) })
    const out = { ...l, x, y, w, h } as Layer
    if (out.type === 'text') out.size = out.size * Math.min(sx, sy)
    return out
  }
  return { ...t, width, height, front: t.front.map(scale), back: t.back.map(scale) }
}
