import { arrangeModel } from './arrange'
import { ruleAnchor } from './cells'
import { fitFixedGrid, gridGeometry } from './grid'
import { isArranged, normalizeLayer, SNAP_SIZE, walkLayers, type RawLayer } from './normalize'
import {
  innerLayers,
  isDrawn,
  withInner,
  type Constraints,
  type GridLayer,
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
    const inner = innerLayers(l)
    if (inner) {
      const found = findLayer(inner, id)
      if (found) return found
    }
  }
  return null
}

/** Gruppo o griglia che contiene il livello (null se è al primo livello) */
export function findParent(layers: Layer[], id: string): GroupLayer | GridLayer | null {
  for (const l of layers) {
    if (l.type !== 'group' && l.type !== 'grid') continue
    const inner = innerLayers(l)!
    if (inner.some((c) => c.id === id)) return l
    const found = findParent(inner, id)
    if (found) return found
  }
  return null
}

/** Il contenitore riadattato dopo un cambio dentro: il gruppo ai figli, la griglia ai suoi gruppi */
export function refit(l: Layer): Layer {
  if (l.type === 'group') return fitGroup(l)
  if (l.type === 'grid') return placeGridGroups(l)
  return l
}

function mapLayers(layers: Layer[], fn: (l: Layer) => Layer): Layer[] {
  return layers.map((l) => {
    const mapped = fn(l)
    const inner = innerLayers(mapped)
    return inner ? refit(withInner(mapped, mapLayers(inner, fn))) : mapped
  })
}

/**
 * I gruppi della griglia che restano centrati: quello del contenuto sulla prima casella, quelli
 * delle regole sulla prima casella dove la regola vale (ruleAnchor). Gli altri restano dove sono
 */
export function placeGridGroups(g: GridLayer): GridLayer {
  if (!g.groups.length) return g
  // ogni gruppo centrato, con la casella su cui sta: la prima, o quella della sua regola
  const centered = new Map<string, number>()
  g.cellRules.forEach((r, k) => {
    if (r.content?.trim() && r.centered !== false) centered.set(r.content.trim(), ruleAnchor(g, k))
  })
  if (g.centered && g.content.trim()) centered.set(g.content.trim(), 0)
  if (!centered.size) return g
  const { centers } = gridGeometry(g)
  if (!centers.length) return g
  let changed = false
  const groups = g.groups.map((gr) => {
    const at = centered.get(gr.name)
    if (at === undefined) return gr
    const c = centers[at] ?? centers[0]
    const dx = g.x + c.x - (gr.x + gr.w / 2)
    const dy = g.y + c.y - (gr.y + gr.h / 2)
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return gr
    changed = true
    return translateLayer(gr, dx, dy) as GroupLayer
  })
  return changed ? { ...g, groups } : g
}

export function updateLayers(t: Template, side: Side, fn: (l: Layer) => Layer): Template {
  return { ...t, [side]: mapLayers(t[side], fn) }
}

export function patchLayer(t: Template, side: Side, id: string, patch: Partial<Layer>): Template {
  return updateLayers(t, side, (l) => {
    if (l.id !== id) return l
    let next = { ...l, ...patch } as Layer
    if (next.type === 'group' && 'clip' in patch) next = fitGroup(next)
    // con la casella fissa la misura della griglia si ricava dalle caselle
    if (next.type === 'grid') {
      next = fitFixedGrid(next)
      // spostare la griglia porta con sé i suoi gruppi
      if (l.type === 'grid' && (next.x !== l.x || next.y !== l.y))
        next = {
          ...next,
          groups: next.groups.map(
            (g) => translateLayer(g, next.x - l.x, next.y - l.y) as GroupLayer
          )
        }
      next = placeGridGroups(next as GridLayer)
    }
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
/**
 * Nuova misura di un livello che lascia fermo il suo punto di ancoraggio: con l'ancoraggio al
 * centro il livello cresce da tutti i lati, con quello a destra verso sinistra, e così via.
 */
export function anchoredResize(
  l: Layer,
  w: number,
  h: number
): { x: number; y: number; w: number; h: number } {
  const [v, hz] = l.anchor.includes('-')
    ? l.anchor.split('-')
    : l.anchor === 'top' || l.anchor === 'bottom'
      ? [l.anchor, 'center']
      : ['middle', l.anchor]
  const fx = hz === 'left' ? 0 : hz === 'right' ? 1 : 0.5
  const fy = v === 'top' ? 0 : v === 'bottom' ? 1 : 0.5
  const round = (n: number): number => Math.round(n * 1000) / 1000
  return { x: round(l.x + (l.w - w) * fx), y: round(l.y + (l.h - h) * fy), w, h }
}

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
  if (moved.type === 'grid')
    moved.groups = moved.groups.map((c) => translateLayer(c, dx, dy) as GroupLayer)
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
  // i gruppi di una griglia seguono lo spostamento; quelli centrati tornano sulla prima casella
  if (l.type === 'grid') {
    const out = fitFixedGrid({ ...l, ...b })
    return placeGridGroups({
      ...out,
      groups: l.groups.map((g) => translateLayer(g, out.x - l.x, out.y - l.y) as GroupLayer)
    })
  }
  return map(l)
}

export function removeLayers(t: Template, side: Side, ids: string[]): Template {
  const drop = (layers: Layer[]): Layer[] =>
    layers
      .filter((l) => !ids.includes(l.id))
      .map((l) => {
        const inner = innerLayers(l)
        return inner ? refit(forgetGroups(withInner(l, drop(inner)))) : l
      })
      // un gruppo rimasto vuoto non ha senso
      .filter((l) => l.type !== 'group' || l.children.length > 0)
  return { ...t, [side]: drop(t[side]) }
}

/** Una griglia dimentica i gruppi che non ha più: il contenuto e quelli delle regole */
function forgetGroups(l: Layer): Layer {
  if (l.type !== 'grid') return l
  const has = (name?: string): boolean => !!name && l.groups.some((g) => g.name === name)
  const content = l.content && !has(l.content.trim()) ? '' : l.content
  const rules = l.cellRules.some((r) => r.content && !has(r.content.trim()))
    ? l.cellRules.map((r) => {
        if (!r.content || has(r.content.trim())) return r
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { content: _gone, centered: _c, ...rest } = r
        return rest
      })
    : l.cellRules
  return content === l.content && rules === l.cellRules ? l : { ...l, content, cellRules: rules }
}

/** Inserisce sopra al livello di riferimento (o in cima se assente), nello stesso contenitore */
export function insertLayer(t: Template, side: Side, layer: Layer, aboveId?: string): Template {
  if (!aboveId) return { ...t, [side]: [layer, ...t[side]] }
  // tra i gruppi di una griglia stanno solo gruppi: un altro livello entra nel gruppo scelto
  if (layer.type !== 'group' && findParent(t[side], aboveId)?.type === 'grid')
    return moveInto(t, side, layer, aboveId)
  const ins = (layers: Layer[]): Layer[] => {
    const i = layers.findIndex((l) => l.id === aboveId)
    if (i >= 0) return [...layers.slice(0, i), layer, ...layers.slice(i)]
    return layers.map((l) => {
      const inner = innerLayers(l)
      return inner ? refit(withInner(l, ins(inner))) : l
    })
  }
  return { ...t, [side]: ins(t[side]) }
}

/** Mette il livello in cima ai figli del gruppo */
function moveInto(t: Template, side: Side, layer: Layer, groupId: string): Template {
  const put = (layers: Layer[]): Layer[] =>
    layers.map((l) => {
      if (l.id === groupId && l.type === 'group')
        return fitGroup({ ...l, children: [layer, ...l.children] })
      const inner = innerLayers(l)
      return inner ? refit(withInner(l, put(inner))) : l
    })
  return { ...t, [side]: put(t[side]) }
}

/**
 * La griglia e il gruppo della griglia in cui finisce un livello inserito sopra a `aboveId`
 */
function hostGrid(
  layers: Layer[],
  aboveId: string
): { grid: GridLayer; group: GroupLayer | null } | null {
  const parent = findParent(layers, aboveId)
  if (parent?.type === 'grid') {
    // sopra a un gruppo della griglia il livello entra in quel gruppo (insertLayer)
    const target = findLayer(layers, aboveId)
    return { grid: parent, group: target?.type === 'group' ? target : null }
  }
  if (parent?.type !== 'group') return null
  const outer = findParent(layers, parent.id)
  return outer?.type === 'grid' ? { grid: outer, group: parent } : null
}

/** Il riquadro della casella i (da 0) sulla carta; null se la griglia non ha quella casella */
export function cellBox(g: GridLayer, i: number): Bounds | null {
  const geo = gridGeometry(g)
  const c = geo.centers[i]
  if (!c) return null
  const w = Math.max(1, geo.cell.w)
  const h = Math.max(1, geo.cell.h)
  return { x: g.x + c.x - w / 2, y: g.y + c.y - h / 2, w, h }
}

/** Il riquadro della prima casella sulla carta; null se la griglia non ha caselle */
export function firstCellBox(g: GridLayer): Bounds | null {
  return cellBox(g, 0)
}

/**
 * La casella dove si disegna un gruppo della griglia: la prima per il contenuto, la prima dove
 * vale la regola per il gruppo di una regola
 */
export function groupCell(g: GridLayer, name: string): number {
  if (name === g.content.trim()) return 0
  const k = g.cellRules.findIndex((r) => r.content?.trim() === name)
  return k < 0 ? 0 : ruleAnchor(g, k)
}

/** Un livello nuovo grande quanto la casella: un testo con il corpo ai due quinti dell'altezza */
export function fitToCell(layer: Layer, box: Bounds): Layer {
  // una linea resta una linea
  const h = layer.type === 'shape' && layer.shape === 'line' ? 0 : box.h
  const out = { ...layer, x: box.x, y: box.y + (box.h - h) / 2, w: box.w, h } as Layer
  if (out.type === 'text')
    return {
      ...out,
      // in punti: 1 mm = 72/25.4 pt
      size: Math.max(4, Math.round((box.h * 0.4 * 72) / 25.4)),
      align: 'center',
      valign: 'middle'
    }
  return out
}

/**
 * Inserisce un livello nuovo: come insertLayer, ma nei gruppi di una griglia il livello prende
 * la misura della casella
 */
export function insertNewLayer(t: Template, side: Side, layer: Layer, aboveId?: string): Template {
  const host = aboveId ? hostGrid(t[side], aboveId) : null
  const box = host && cellBox(host.grid, host.group ? groupCell(host.grid, host.group.name) : 0)
  return insertLayer(t, side, box ? fitToCell(layer, box) : layer, aboveId)
}

/** Di chi è un gruppo della griglia: il contenuto di tutte le caselle o una regola (da 0) */
export type GridGroupTarget = 'content' | number

/** Il nome del gruppo che la griglia usa per il contenuto o per la regola */
export function gridGroupName(g: GridLayer, target: GridGroupTarget): string {
  return (target === 'content' ? g.content : (g.cellRules[target]?.content ?? '')).trim()
}

/** La griglia con un altro nome di gruppo per il contenuto o per la regola, centrato */
function withGroupName(g: GridLayer, target: GridGroupTarget, name: string): GridLayer {
  if (target === 'content') return { ...g, content: name, centered: name ? g.centered : true }
  return {
    ...g,
    cellRules: g.cellRules.map((r, k) => {
      if (k !== target) return r
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { content: _c, centered: _k, ...rest } = r
      return name ? { ...rest, content: name } : rest
    })
  }
}

/**
 * Il gruppo esce dalla griglia e torna un gruppo normale nella lista, sopra alla griglia. Il
 * contenuto o la regola restano senza gruppo
 */
export function detachGridGroup(
  t: Template,
  side: Side,
  gridId: string,
  target: GridGroupTarget
): Template {
  const grid = findLayer(t[side], gridId)
  if (grid?.type !== 'grid') return t
  const name = gridGroupName(grid, target)
  const group = grid.groups.find((g) => g.name === name)
  const next = withGroupName(grid, target, '')
  // un gruppo usato anche altrove nella griglia resta dentro
  const shared = group && gridGroupName(next, 'content') === name
  const still =
    shared || next.cellRules.some((r) => r.content?.trim() === name) || !group
      ? next
      : { ...next, groups: next.groups.filter((g) => g !== group) }
  let out = updateLayers(t, side, (l) => (l.id === gridId ? still : l))
  if (group && still !== next) out = insertLayer(out, side, group, gridId)
  return out
}

/**
 * Il gruppo diventa il contenuto delle caselle o quello della regola, centrato sulla prima
 * casella. Un gruppo che era nella lista vi entra; quello di prima torna nella lista
 */
export function attachGridGroup(
  t: Template,
  side: Side,
  gridId: string,
  target: GridGroupTarget,
  group: GroupLayer
): Template {
  let out =
    findLayer(t[side], gridId)?.type === 'grid' ? detachGridGroup(t, side, gridId, target) : t
  const inList = findLayer(out[side], group.id)
  if (inList) out = removeLayers(out, side, [group.id])
  return updateLayers(out, side, (l) => {
    if (l.id !== gridId || l.type !== 'grid') return l
    const g = withGroupName(l, target, group.name)
    const centered =
      target === 'content'
        ? { ...g, centered: true }
        : {
            ...g,
            cellRules: g.cellRules.map((r, k) => (k === target ? { ...r, centered: true } : r))
          }
    return placeGridGroups({ ...centered, groups: [...centered.groups, group] })
  })
}

/** Centrato o no sulla prima casella, il gruppo del contenuto o della regola */
export function setGridGroupCentered(
  t: Template,
  side: Side,
  gridId: string,
  target: GridGroupTarget,
  centered: boolean
): Template {
  return updateLayers(t, side, (l) => {
    if (l.id !== gridId || l.type !== 'grid') return l
    if (target === 'content') return { ...l, centered }
    return {
      ...l,
      cellRules: l.cellRules.map((r, k) => (k === target ? { ...r, centered } : r))
    }
  })
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
    return layers.map((l) => {
      const inner = innerLayers(l)
      return inner ? withInner(l, mv(inner)) : l
    })
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
  const own = innerLayers(layer)
  if (own && findLayer(own, targetId)) return t
  if (where === 'inside' && target.type !== 'group') return t
  // tra i gruppi di una griglia vanno solo gruppi
  const host = findParent(t[side], targetId)
  if (where !== 'inside' && host?.type === 'grid' && layer.type !== 'group') return t
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
    return layers.map((l) => {
      const inner = innerLayers(l)
      return inner ? refit(withInner(l, put(inner))) : l
    })
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
  const siblings = parent ? innerLayers(parent)! : t[side]
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
      : layers.map((l) => {
          const inner = innerLayers(l)
          return inner ? refit(withInner(l, replace(inner))) : l
        })
  return { template: { ...t, [side]: replace(t[side]) }, groupId: fitted.id }
}

export function ungroupLayer(
  t: Template,
  side: Side,
  id: string
): { template: Template; childIds: string[] } {
  const g = findLayer(t[side], id)
  if (!g || g.type !== 'group') return { template: t, childIds: [] }
  // i gruppi di una griglia non si sciolgono: dentro la griglia stanno solo gruppi
  if (findParent(t[side], id)?.type === 'grid') return { template: t, childIds: [] }
  const un = (layers: Layer[]): Layer[] =>
    layers.flatMap((l) => {
      if (l.id === id) return (l as GroupLayer).children
      const inner = innerLayers(l)
      return inner ? [refit(withInner(l, un(inner)))] : [l]
    })
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
    if (out.type === 'grid' && src.type === 'grid') copyGridGroups(out, src, copy)
    return out
  }
  return translateLayer(copy(l), 2, 2)
}

/**
 * I gruppi di una griglia copiata: nomi nuovi, e il contenuto e le regole che li seguono
 */
function copyGridGroups(out: GridLayer, src: GridLayer, copy: (l: Layer) => Layer): void {
  const names = new Map<string, string>()
  out.groups = src.groups.map((g) => {
    const c = copy(g) as GroupLayer
    names.set(g.name, c.name)
    return c
  })
  const renamed = (n: string): string => names.get(n.trim()) ?? n
  out.content = renamed(out.content)
  out.cellRules = out.cellRules.map((r) => (r.content ? { ...r, content: renamed(r.content) } : r))
}

/** Testo negli appunti per i livelli copiati: si incollano in qualsiasi template, anche di un altro progetto */
export function layersToClipboard(template: Template, side: Side, ids: string[]): string | null {
  const chosen = new Set(ids)
  // in ordine di sovrapposizione; i figli di un gruppo copiato viaggiano con il gruppo
  const layers: Layer[] = []
  const visit = (list: Layer[]): void => {
    for (const l of list) {
      if (chosen.has(l.id)) layers.push(l)
      else if (innerLayers(l)) visit(innerLayers(l)!)
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
    if (out.type === 'grid' && src.type === 'grid') copyGridGroups(out, src, copy)
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
      if (x === l.x && y === l.y && w === l.w && h === l.h) return l
      if (l.type === 'grid') return transformInto(l, { x, y, w, h })
      return { ...l, x, y, w, h } as Layer
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
    if (l.type === 'grid')
      return placeGridGroups(
        fitFixedGrid({ ...l, x, y, w, h, groups: l.groups.map((g) => scale(g) as GroupLayer) })
      )
    const out = { ...l, x, y, w, h } as Layer
    if (out.type === 'text') out.size = out.size * Math.min(sx, sy)
    return out
  }
  return { ...t, width, height, front: t.front.map(scale), back: t.back.map(scale) }
}
