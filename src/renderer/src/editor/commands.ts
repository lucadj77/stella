import {
  duplicateLayer,
  findLayer,
  findParent,
  groupLayers,
  insertLayer,
  insertNewLayer,
  layersFromClipboard,
  layersToClipboard,
  moveLayer,
  newLayer,
  type LayerNames,
  pasteLayers,
  patchLayer,
  removeLayers,
  translateLayer,
  ungroupLayer,
  updateLayers
} from '../../../shared/model/edit'
import type { Layer, LayerType, ShapeKind } from '../../../shared/model/template'
import type { EditorAction, EditorState } from './useEditor'

// Comandi dell'editor, condivisi tra pannello livelli, barra degli strumenti e tastiera.

export interface Commands {
  /** `props` completa il livello nuovo, per esempio con l'immagine scelta */
  add(type: LayerType, shape?: ShapeKind, props?: Partial<Layer>): void
  /** Un livello immagine per ogni immagine, in un solo passo da annullare */
  addImages(srcs: string[]): void
  remove(): void
  duplicate(): void
  /** Testo da mettere negli appunti per i livelli selezionati, o null se non ce ne sono */
  copy(): string | null
  /** Incolla i livelli copiati, anche da un altro template; false se il testo non ne contiene */
  paste(text: string): boolean
  group(): void
  ungroup(): void
  move(direction: 'up' | 'down'): void
  nudge(dx: number, dy: number): void
  toggle(id: string, prop: 'visible' | 'locked'): void
  /** Tutti i selezionati stanno nello stesso contenitore */
  canGroup: boolean
  canUngroup: boolean
  /** I selezionati si possono spostare nella lista: in un derivato solo i livelli aggiunti */
  canMove: boolean
}

/**
 * `inherited` dice se un livello viene dal template base: in un derivato quei livelli non si
 * eliminano (si nascondono), non si spostano nella lista e non si raggruppano.
 */
export function commands(
  state: EditorState,
  dispatch: React.Dispatch<EditorAction>,
  inherited: (id: string) => boolean = () => false,
  names: LayerNames = {}
): Commands {
  const { template: tpl, side, selection } = state
  const layers = tpl[side]
  const selected = selection.map((id) => findLayer(layers, id)).filter((l): l is Layer => !!l)
  const parentId = (id: string): string | null => findParent(layers, id)?.id ?? null
  const siblings =
    selection.length > 0 && selection.every((id) => parentId(id) === parentId(selection[0]))
  const change = (template: typeof tpl, sel?: string[], key?: string): void =>
    dispatch({ type: 'change', template, selection: sel, key })

  const fixed = selection.some(inherited)
  return {
    canGroup: siblings && !fixed,
    canUngroup: selected.some((l) => l.type === 'group' && !inherited(l.id)),
    canMove: selection.length > 0 && !fixed,

    add(type, shape, props) {
      const layer = { ...newLayer(tpl, type, shape, names), ...props } as Layer
      // dentro il gruppo in cui si è entrati, sopra al livello selezionato
      const scopeGroup = state.scope ? findLayer(layers, state.scope) : null
      const above =
        selection[0] ?? (scopeGroup?.type === 'group' ? scopeGroup.children[0]?.id : undefined)
      change(insertNewLayer(tpl, side, layer, above), [layer.id])
    },

    addImages(srcs) {
      let t = tpl
      const ids: string[] = []
      for (const src of srcs) {
        const layer = { ...newLayer(t, 'image', undefined, names), src } as Layer
        t = insertNewLayer(t, side, layer, ids[ids.length - 1] ?? selection[0])
        ids.push(layer.id)
      }
      if (ids.length) change(t, ids)
    },

    remove() {
      if (!selection.length) return
      const own = selection.filter((id) => !inherited(id))
      const hide = selection.filter(inherited)
      let t = removeLayers(tpl, side, own)
      for (const id of hide) t = patchLayer(t, side, id, { visible: false })
      change(t, hide)
    },

    duplicate() {
      let t = tpl
      const ids: string[] = []
      for (const l of selected) {
        const copy = duplicateLayer(t, l)
        t = insertLayer(t, side, copy, l.id)
        ids.push(copy.id)
      }
      if (ids.length) change(t, ids)
    },

    copy() {
      return layersToClipboard(tpl, side, selection)
    },

    paste(text) {
      const data = layersFromClipboard(text)
      if (!data) return false
      // come un livello nuovo: nel gruppo in cui si è entrati, sopra al livello selezionato
      const scopeGroup = state.scope ? findLayer(layers, state.scope) : null
      const above =
        selection[0] ?? (scopeGroup?.type === 'group' ? scopeGroup.children[0]?.id : undefined)
      // nello stesso template si spostano, per non coprire gli originali
      const r = pasteLayers(tpl, side, data.layers, above, data.template === tpl.name)
      change(r.template, r.ids)
      return true
    },

    group() {
      if (!siblings || fixed) return
      // l'ordine del gruppo segue quello dei livelli, non quello della selezione
      const { template, groupId } = groupLayers(tpl, side, selection)
      if (groupId) change(template, [groupId])
    },

    ungroup() {
      let t = tpl
      const ids: string[] = []
      for (const l of selected) {
        if (l.type !== 'group' || inherited(l.id)) {
          ids.push(l.id)
          continue
        }
        const r = ungroupLayer(t, side, l.id)
        t = r.template
        ids.push(...r.childIds)
      }
      change(t, ids)
    },

    move(direction) {
      if (fixed) return
      let t = tpl
      // spostando verso l'alto si parte dal primo, verso il basso dall'ultimo
      const order = direction === 'up' ? selection : [...selection].reverse()
      for (const id of order) t = moveLayer(t, side, id, direction)
      change(t)
    },

    nudge(dx, dy) {
      const ids = selected.filter((l) => !l.locked).map((l) => l.id)
      if (!ids.length) return
      change(
        updateLayers(tpl, side, (l) => (ids.includes(l.id) ? translateLayer(l, dx, dy) : l)),
        undefined,
        `nudge.${ids.join(',')}`
      )
    },

    toggle(id, prop) {
      const l = findLayer(layers, id)
      if (l) change(patchLayer(tpl, side, id, { [prop]: !l[prop] }))
    }
  }
}
