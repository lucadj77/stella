import { MessageError, msg } from '../messages'
import type {
  AddedLayer,
  GroupLayer,
  ManualGuides,
  ImageLayer,
  Layer,
  LayerBase,
  LayerSnap,
  ShapeLayer,
  SnapLayer,
  GridLayer,
  Template,
  TemplateChanges,
  TextLayer,
  ValueLayer
} from './template'
import { isComponentKind, isDrawn, isShapeRotation } from './template'

// Nei file i livelli riportano solo le proprietà diverse dai default; qui si completano.

const BASE_DEFAULTS: Omit<LayerBase, 'id' | 'name'> = {
  visible: true,
  locked: false,
  x: 0,
  y: 0,
  w: 20,
  h: 10,
  rotation: 0,
  anchor: 'center',
  opacity: 1,
  blend: 'normal',
  fade: null,
  shadow: null,
  constraints: { h: 'left', v: 'top' },
  exposed: [],
  source: { kind: 'column', column: null },
  snap: null
}

const TEXT_DEFAULTS: Omit<TextLayer, keyof LayerBase | 'type'> = {
  text: '',
  style: null,
  font: 'Nunito',
  weight: 400,
  italic: false,
  size: 10,
  color: '#000000',
  align: 'left',
  valign: 'top',
  lineHeight: 1.2,
  letterSpacing: 0,
  paragraphSpacing: 0,
  indent: 0,
  padding: 0,
  paddingSides: null,
  transform: 'none',
  stroke: null,
  fit: 'none',
  minSize: 6,
  underline: false,
  strike: false,
  wrap: true
}

const IMAGE_DEFAULTS: Omit<ImageLayer, keyof LayerBase | 'type'> = {
  src: '',
  fit: 'cover',
  crop: null,
  align: 'center',
  zoom: 1,
  imageRotation: 0,
  offsetX: 0,
  offsetY: 0,
  flipH: false,
  flipV: false,
  tint: null,
  grayscale: false,
  brightness: 1,
  contrast: 1,
  saturation: 1,
  radius: 0,
  stroke: null,
  missing: 'placeholder'
}

const SHAPE_DEFAULTS: Omit<ShapeLayer, keyof LayerBase | 'type'> = {
  shape: 'rect',
  fill: '#CCCCCC',
  stroke: null,
  radius: 0,
  sides: 6,
  innerRatio: 0.5,
  path: ''
}

const GRID_DEFAULTS: Omit<GridLayer, keyof LayerBase | 'type'> = {
  cell: 'square',
  rows: 4,
  columns: 4,
  cellRatio: 1,
  orientation: 'pointy',
  cellRotation: 0,
  cellPath: '',
  interlock: false,
  gap: 1,
  padding: 0,
  zoom: 1,
  alignX: 'center',
  alignY: 'center',
  clip: false,
  radius: 0,
  fill: '#FFFFFF',
  stroke: { color: '#333333', width: 0.3 },
  background: null,
  border: null,
  backgroundRadius: 0,
  content: '',
  cellRules: []
}

let idCounter = 0

function newId(): string {
  idCounter += 1
  return `l${Date.now().toString(36)}${idCounter}`
}

/** Livello come scritto nel file: solo le proprietà diverse dai default */
export type RawLayer = {
  type?: string
  name?: string
  id?: string
  children?: RawLayer[]
} & Record<string, unknown>

export type RawTemplate = Partial<Omit<Template, 'front' | 'back' | 'changes'>> & {
  name: string
  front?: RawLayer[]
  back?: RawLayer[]
  changes?: RawChanges
}

/** Differenze di un derivato come nel file: i livelli aggiunti con le sole proprietà non di base */
export type RawChanges = Omit<TemplateChanges, 'added'> & {
  added?: (Omit<AddedLayer, 'layer'> & { layer: RawLayer })[]
}

export function normalizeLayer(raw: RawLayer, index: number): Layer {
  const base = {
    ...BASE_DEFAULTS,
    id: raw.id ?? newId(),
    name: raw.name ?? `${raw.type ?? 'layer'}${index + 1}`
  }
  switch (raw.type) {
    case 'text':
      return {
        ...base,
        ...TEXT_DEFAULTS,
        ...(raw as Partial<TextLayer>),
        id: base.id,
        type: 'text'
      }
    case 'image':
      return {
        ...base,
        ...IMAGE_DEFAULTS,
        ...(raw as Partial<ImageLayer>),
        id: base.id,
        type: 'image'
      }
    case 'shape':
      return {
        ...base,
        ...SHAPE_DEFAULTS,
        ...(raw as Partial<ShapeLayer>),
        id: base.id,
        type: 'shape'
      }
    case 'grid':
      return {
        ...base,
        ...GRID_DEFAULTS,
        ...(raw as Partial<GridLayer>),
        id: base.id,
        type: 'grid'
      }
    case 'value':
      return {
        ...base,
        value: '',
        ...(raw as Partial<ValueLayer>),
        id: base.id,
        type: 'value'
      }
    case 'snap':
      return {
        ...base,
        w: SNAP_SIZE,
        h: SNAP_SIZE,
        ...(raw as Partial<SnapLayer>),
        snap: { ...SNAP_DEFAULTS, ...((raw.snap as Partial<LayerSnap> | null) ?? {}) },
        id: base.id,
        type: 'snap'
      }
    case 'group': {
      const children = (raw.children ?? []).map(normalizeLayer)
      const g: GroupLayer = {
        ...base,
        ...GROUP_DEFAULTS,
        ...(raw as Partial<GroupLayer>),
        id: base.id,
        type: 'group',
        children
      }
      // il riquadro di un gruppo è l'ingombro dei figli, o della maschera se ritaglia;
      // con la disposizione automatica è salvato nel file
      if (isArranged(g) && raw.w !== undefined && raw.h !== undefined) return g
      return { ...g, ...extent(raw.clip && children.length > 1 ? children.slice(-1) : children) }
    }
    default:
      throw new MessageError(
        msg('template.unknownLayerType', { layer: base.name, type: String(raw.type) })
      )
  }
}

/** Lato del mirino di un livello snap point, in mm */
export const SNAP_SIZE = 6
export const SNAP_DEFAULTS: LayerSnap = { tags: '', rotated: false, angle: null }

const GROUP_DEFAULTS = {
  clip: false,
  layout: 'none',
  gap: 2,
  columns: 3,
  justify: 'start',
  alignItems: 'center',
  repeat: '1'
} as const

/** Il gruppo dispone i figli da sé: ha un riquadro proprio invece dell'ingombro dei figli */
export function isArranged(g: GroupLayer): boolean {
  return g.layout !== 'none' || g.repeat.trim() !== '1'
}

function extent(all: Layer[]): Partial<LayerBase> {
  const layers = all.filter(isDrawn)
  if (!layers.length) return {}
  const x = Math.min(...layers.map((l) => l.x))
  const y = Math.min(...layers.map((l) => l.y))
  const w = Math.max(...layers.map((l) => l.x + l.w)) - x
  const h = Math.max(...layers.map((l) => l.y + l.h)) - y
  return { x, y, w, h }
}

export function normalizeTemplate(raw: RawTemplate): Template {
  // un derivato si completa risolvendolo sul base (resolveTemplates): qui solo le differenze
  if (raw.extends) {
    const c = raw.changes ?? {}
    return {
      name: raw.name,
      ...(raw.file ? { file: raw.file } : {}),
      width: 0,
      height: 0,
      bleed: 0,
      safeMargin: 0,
      cornerRadius: 0,
      front: [],
      back: [],
      extends: raw.extends,
      changes: {
        ...(c.template ? { template: c.template } : {}),
        ...(c.layers ? { layers: c.layers } : {}),
        ...(c.added?.length
          ? {
              added: c.added.map((a, i) => ({
                ...a,
                side: a.side === 'back' ? 'back' : 'front',
                layer: normalizeLayer(a.layer, i)
              }))
            }
          : {})
      }
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { changes: _ignored, kind, shapeRotation, ...plain } = raw
  return {
    ...(isComponentKind(kind) && kind !== 'card' ? { kind } : {}),
    width: 63,
    height: 88,
    bleed: 3,
    safeMargin: 3,
    cornerRadius: 3,
    ...plain,
    ...(isShapeRotation(shapeRotation) && shapeRotation ? { shapeRotation } : {}),
    front: (raw.front ?? []).map(normalizeLayer),
    back: (raw.back ?? []).map(normalizeLayer)
  }
}

/** Tutti i livelli in profondità, gruppi compresi */
export function walkLayers(layers: Layer[]): Layer[] {
  return layers.flatMap((l) => (l.type === 'group' ? [l, ...walkLayers(l.children)] : [l]))
}

/** Nomi duplicati tra fronte e retro di un template */
export function duplicateNames(t: Template): string[] {
  const seen = new Set<string>()
  const dup = new Set<string>()
  for (const l of walkLayers([...t.front, ...t.back])) {
    if (seen.has(l.name)) dup.add(l.name)
    seen.add(l.name)
  }
  return [...dup]
}

const TYPE_DEFAULTS: Record<Layer['type'], Record<string, unknown>> = {
  text: TEXT_DEFAULTS,
  image: IMAGE_DEFAULTS,
  shape: SHAPE_DEFAULTS,
  grid: GRID_DEFAULTS,
  group: GROUP_DEFAULTS,
  value: { value: '' },
  snap: { w: SNAP_SIZE, h: SNAP_SIZE, snap: SNAP_DEFAULTS }
}

/** Arrotonda ai millesimi: dopo spostamenti e scalature restano code come 12.000000001 */
function tidy(v: unknown): unknown {
  if (typeof v === 'number') return Math.round(v * 1000) / 1000
  if (Array.isArray(v)) return v.map(tidy)
  if (v && typeof v === 'object')
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, tidy(x)]))
  return v
}

/** Inverso di normalizeLayer: solo le proprietà diverse dai default, senza id */
export function denormalizeLayer(l: Layer): RawLayer {
  const defaults: Record<string, unknown> = { ...BASE_DEFAULTS, ...TYPE_DEFAULTS[l.type] }
  const out: RawLayer = { type: l.type, name: l.name }
  for (const [k, v] of Object.entries(l)) {
    if (k === 'id' || k === 'type' || k === 'name' || k === 'children') continue
    // il riquadro di un gruppo si ricava dai figli
    // (salvo con la disposizione automatica, dove è il riquadro in cui si dispongono)
    const fitted = l.type === 'value' || (l.type === 'group' && !isArranged(l))
    if (fitted && ['x', 'y', 'w', 'h'].includes(k)) continue
    // un valore non si disegna: delle proprietà comuni conta solo la fonte
    if (l.type === 'value' && k !== 'source' && k !== 'value') continue
    const value = tidy(v)
    const frame = l.type === 'group' && ['x', 'y', 'w', 'h'].includes(k)
    if (!frame && k in defaults && JSON.stringify(value) === JSON.stringify(defaults[k])) continue
    out[k] = value
  }
  if (l.type === 'group') out.children = l.children.map(denormalizeLayer)
  return out
}

export function denormalizeTemplate(t: Template): RawTemplate {
  if (t.extends) {
    const c = t.changes ?? {}
    const layers = Object.fromEntries(
      Object.entries(c.layers ?? {})
        .filter(([, v]) => Object.keys(v).length)
        .map(([k, v]) => [k, tidy(v) as Record<string, unknown>])
    )
    const changes: RawChanges = {
      ...(c.template && Object.keys(c.template).length
        ? { template: tidy(c.template) as RawChanges['template'] }
        : {}),
      ...(Object.keys(layers).length ? { layers } : {}),
      ...(c.added?.length
        ? { added: c.added.map((a) => ({ ...a, layer: denormalizeLayer(a.layer) })) }
        : {})
    }
    return { name: t.name, extends: t.extends, changes }
  }
  return {
    name: t.name,
    ...(t.kind && t.kind !== 'card' ? { kind: t.kind } : {}),
    width: t.width,
    height: t.height,
    bleed: t.bleed,
    safeMargin: t.safeMargin,
    cornerRadius: t.cornerRadius,
    ...(t.shape && t.shape !== 'rect' ? { shape: t.shape } : {}),
    ...(t.shape === 'path' && t.shapePath ? { shapePath: t.shapePath } : {}),
    ...(t.shapeRotation ? { shapeRotation: t.shapeRotation } : {}),
    ...(t.shapeFlipH ? { shapeFlipH: true } : {}),
    ...(t.shapeFlipV ? { shapeFlipV: true } : {}),
    ...(t.guides && (t.guides.x.length || t.guides.y.length)
      ? { guides: tidy(t.guides) as ManualGuides }
      : {}),
    ...(t.labelField ? { labelField: t.labelField } : {}),
    ...(t.ttsTags?.trim() ? { ttsTags: t.ttsTags } : {}),
    front: t.front.map(denormalizeLayer),
    back: t.back.map(denormalizeLayer)
  }
}

/** Il nome di un template è anche il nome del suo file */
export function isValidTemplateName(name: string): boolean {
  return /^[^\\/:*?"<>|.][^\\/:*?"<>|]*$/.test(name) && name.trim() === name
}
