import type { Layer } from '../../../shared/model/template'
import { en, type MessageKey } from '../i18n/en'

// Come si modificano le proprietà di un livello per una sola carta, nel modulo accanto
// all'anteprima: etichetta tradotta e controllo adatto (menu, numero, colore, casella).

export type PropControl =
  | { kind: 'select'; options: [string, MessageKey | null][] }
  | { kind: 'number'; step: number; percent?: boolean }
  | { kind: 'bool' }
  | { kind: 'color' }
  | { kind: 'text'; hint?: MessageKey }

const ANCHORS = [
  'top-left',
  'top',
  'top-right',
  'left',
  'center',
  'right',
  'bottom-left',
  'bottom',
  'bottom-right'
]

const opts = (prefix: string, values: (string | number)[]): [string, MessageKey | null][] =>
  values.map((v) => {
    const key = `${prefix}.${v}`
    return [String(v), key in en ? (key as MessageKey) : null]
  })

/** Controllo per la proprietà `key` di un livello di quel tipo */
export function propControl(l: Layer, key: string): PropControl {
  const value = (l as unknown as Record<string, unknown>)[key]
  switch (key) {
    case 'anchor':
      return { kind: 'select', options: opts('anchor', ANCHORS) }
    case 'blend':
      return { kind: 'select', options: opts('blend', ['normal', 'multiply', 'screen', 'overlay']) }
    case 'shape':
      return {
        kind: 'select',
        options: opts('shape', ['rect', 'ellipse', 'polygon', 'star', 'line', 'path'])
      }
    case 'cell':
      return {
        kind: 'select',
        options: opts('gridCell', ['square', 'circle', 'hex', 'triangle', 'diamond'])
      }
    case 'orientation':
      return { kind: 'select', options: opts('gridOrientation', ['pointy', 'flat']) }
    case 'alignX':
      return { kind: 'select', options: opts('justifyH', ['start', 'center', 'end']) }
    case 'alignY':
      return { kind: 'select', options: opts('justifyV', ['start', 'center', 'end']) }
    case 'background':
      return { kind: 'color' }
    case 'border':
      return { kind: 'text', hint: 'cardProps.strokeHint' }
    case 'weight':
      return {
        kind: 'select',
        options: opts('weight', [100, 200, 300, 400, 500, 600, 700, 800, 900])
      }
    case 'valign':
      return { kind: 'select', options: opts('valign', ['top', 'middle', 'bottom']) }
    case 'transform':
      return {
        kind: 'select',
        options: opts('transform', ['none', 'upper', 'lower', 'capitalize'])
      }
    case 'missing':
      return { kind: 'select', options: opts('missing', ['placeholder', 'hide']) }
    case 'fit':
      return l.type === 'image'
        ? {
            kind: 'select',
            options: opts('imageFit', [
              'cover',
              'overflow',
              'contain',
              'stretch',
              'original',
              'tile'
            ])
          }
        : { kind: 'select', options: opts('textFit', ['none', 'shrink', 'grow', 'truncate']) }
    case 'align':
      return l.type === 'image'
        ? { kind: 'select', options: opts('anchor', ANCHORS) }
        : { kind: 'select', options: opts('align', ['left', 'center', 'right', 'justify']) }
    case 'color':
    case 'tint':
    case 'fill':
      return { kind: 'color' }
    case 'stroke':
      return { kind: 'text', hint: 'cardProps.strokeHint' }
    case 'shadow':
      return { kind: 'text', hint: 'cardProps.shadowHint' }
    case 'crop':
      return { kind: 'text', hint: 'cardProps.cropHint' }
    case 'opacity':
    case 'zoom':
    case 'cellRatio':
      return { kind: 'number', step: 0.05, percent: true }
  }
  if (typeof value === 'boolean') return { kind: 'bool' }
  if (typeof value === 'number') return { kind: 'number', step: Number.isInteger(value) ? 1 : 0.1 }
  return { kind: 'text' }
}

/** Etichetta tradotta della proprietà, o il suo nome se non ce n'è una */
export function propLabel(l: Layer, key: string): MessageKey | null {
  const special = l.type === 'image' && key === 'align' ? 'prop.imageAlign' : `prop.${key}`
  return special in en ? (special as MessageKey) : null
}

/** Proprietà scritte come testo che cominciano con un colore: "colore/spessore/…" */
const COLOR_FIRST = new Set(['stroke', 'border', 'shadow'])

/**
 * Colore di una proprietà scritta come testo (contorno, bordo, ombra) e come cambiarlo: si
 * sostituisce la prima parte, il resto resta. Con la cella vuota si parte dal valore del template.
 */
export function colorPartOf(
  key: string,
  text: string,
  template: unknown
): { color: string; set(color: string): string } | null {
  if (!COLOR_FIRST.has(key)) return null
  const base = text.trim() || templateText(key, template)
  const parts = base ? base.split('/') : ['']
  return {
    color: parts[0].trim(),
    set: (color) => [color, ...parts.slice(1)].join('/')
  }
}

/** Contorno o ombra del template nella forma che si scrive nelle celle */
function templateText(key: string, v: unknown): string {
  if (!v || typeof v !== 'object') return ''
  const o = v as Record<string, unknown>
  if (key === 'shadow') return [o.color, o.blur, o.dx, o.dy].join('/')
  return [o.color, o.width, ...(o.dash ? [o.dash] : [])].join('/')
}
