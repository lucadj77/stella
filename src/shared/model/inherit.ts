import { msg, type Message } from '../messages'
import { fitGroup } from './edit'
import { isArranged, walkLayers } from './normalize'
import {
  INHERITABLE_TEMPLATE_KEYS,
  type AddedLayer,
  type InheritableTemplateKey,
  type Layer,
  type Side,
  type Template,
  type TemplateChanges
} from './template'

// Template derivati: un derivato tiene il nome del base e le sole differenze (docs/formato.md).
// In memoria front e back sono sempre già risolti, così carte, editor ed esportazione lavorano
// come con un template normale. I livelli ereditati hanno gli stessi id di quelli del base.

const SIDES: Side[] = ['front', 'back']

/** Proprietà dei livelli che non si confrontano: identità e struttura */
const STRUCTURAL = new Set(['id', 'type', 'name', 'children'])
const FRAME = ['x', 'y', 'w', 'h']
/** Traduzioni dei livelli fissi: facoltative, il derivato le può aggiungere */
const TRANSLATIONS = ['texts', 'values']

/** Proprietà di un livello che il derivato può cambiare */
function layerKeys(a: Layer, b: Layer): string[] {
  // il riquadro di un gruppo normale è l'ingombro dei figli: segue da sé
  const fitted = (l: Layer): boolean => l.type === 'group' && !isArranged(l)
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(
    (k) => !STRUCTURAL.has(k) && !(FRAME.includes(k) && (fitted(a) || fitted(b)))
  )
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/** Valore di una proprietà del template, con i default delle proprietà facoltative */
function templateValue(t: Template, k: InheritableTemplateKey): unknown {
  switch (k) {
    case 'shape':
      return t.shape ?? 'rect'
    case 'shapePath':
      return t.shapePath ?? ''
    case 'guides':
      return t.guides ?? { x: [], y: [] }
    case 'labelField':
      return t.labelField ?? null
    case 'kind':
      return t.kind ?? 'card'
    default:
      return t[k]
  }
}

/** Livello con id → livello, in profondità, sui due lati */
function byId(t: Template): Map<string, Layer> {
  return new Map(walkLayers([...t.front, ...t.back]).map((l) => [l.id, l]))
}

/** Applica il derivato `own` al base già risolto */
export function resolveTemplate(
  base: Template,
  own: Template
): { template: Template; problems: Message[] } {
  const problems: Message[] = []
  const c = own.changes ?? {}
  const changes = c.layers ?? {}
  const used = new Set<string>()

  const apply = (list: Layer[]): { layers: Layer[]; changed: boolean } => {
    let any = false
    const layers = list.map((l) => {
      let out: Layer = l
      let changed = false
      if (l.type === 'group') {
        const inner = apply(l.children)
        if (inner.changed) {
          out = { ...l, children: inner.layers }
          changed = true
        }
      }
      const patch = changes[l.name]
      if (patch) {
        used.add(l.name)
        const clean = Object.fromEntries(
          Object.entries(patch).filter(
            ([k]) => !STRUCTURAL.has(k) && (k in l || TRANSLATIONS.includes(k))
          )
        )
        if (Object.keys(clean).length) {
          out = { ...out, ...clean } as Layer
          // un testo cambiato senza le sue traduzioni non tiene quelle del base, che sono di un
          // altro testo
          for (const [main, tr] of [
            ['text', 'texts'],
            ['value', 'values']
          ])
            if (main in clean && !(tr in clean))
              delete (out as unknown as Record<string, unknown>)[tr]
          changed = true
        }
      }
      if (changed && out.type === 'group') out = fitGroup(out)
      any ||= changed
      return out
    })
    return { layers: any ? layers : list, changed: any }
  }

  const sides = { front: apply(base.front).layers, back: apply(base.back).layers }
  for (const name of Object.keys(changes))
    if (!used.has(name))
      problems.push(msg('inherit.lostLayer', { template: own.name, layer: name }))

  for (const a of c.added ?? []) {
    const r = insertAdded(sides[a.side], a)
    if (r) sides[a.side] = r
    else {
      // il posto non c'è più (livello del base eliminato o rinominato fuori da Stella): in cima
      problems.push(msg('inherit.lostPosition', { template: own.name, layer: a.layer.name }))
      sides[a.side] = [a.layer, ...sides[a.side]]
    }
  }

  const template: Template = {
    ...base,
    name: own.name,
    front: sides.front,
    back: sides.back,
    extends: own.extends,
    changes: own.changes
  }
  // file e origin sono del derivato, mai del base: altrimenti una rinomina del base non ancora
  // salvata farebbe rinominare o spostare in deleted/ il file del base al posto di quello del derivato
  if (own.file) template.file = own.file
  else delete template.file
  if (own.origin) template.origin = own.origin
  else delete template.origin
  for (const k of INHERITABLE_TEMPLATE_KEYS) {
    if (c.template && k in c.template) Object.assign(template, { [k]: c.template[k] })
  }
  return { template, problems }
}

/** Inserisce un livello aggiunto al suo posto; null se il posto non si trova */
function insertAdded(layers: Layer[], a: AddedLayer): Layer[] | null {
  const place = (list: Layer[]): Layer[] | null => {
    if (!a.after) return [a.layer, ...list]
    const i = list.findIndex((l) => l.name === a.after)
    if (i < 0) return null
    return [...list.slice(0, i + 1), a.layer, ...list.slice(i + 1)]
  }
  if (!a.parent) return place(layers)
  let found = false
  const visit = (list: Layer[]): Layer[] =>
    list.map((l) => {
      if (found || l.type !== 'group') return l
      if (l.name === a.parent) {
        const children = place(l.children)
        if (!children) return l
        found = true
        return fitGroup({ ...l, children })
      }
      const children = visit(l.children)
      return children === l.children || !found ? l : fitGroup({ ...l, children })
    })
  const out = visit(layers)
  return found ? out : null
}

/** Differenze di `edited` (un derivato risolto e poi modificato) dal base */
export function diffTemplate(base: Template, edited: Template): TemplateChanges {
  const out: TemplateChanges = {}

  const template: Record<string, unknown> = {}
  for (const k of INHERITABLE_TEMPLATE_KEYS) {
    const v = templateValue(edited, k)
    if (!same(v, templateValue(base, k))) template[k] = v
  }
  if (Object.keys(template).length) out.template = template as TemplateChanges['template']

  const inherited = byId(base)
  const mine = byId(edited)
  const layers: Record<string, Record<string, unknown>> = {}
  for (const [id, bl] of inherited) {
    const el = mine.get(id)
    // un livello ereditato non si elimina: sparisce dalla carta
    if (!el) {
      if (bl.visible) layers[bl.name] = { visible: false }
      continue
    }
    const patch: Record<string, unknown> = {}
    const a = bl as unknown as Record<string, unknown>
    const b = el as unknown as Record<string, unknown>
    for (const k of layerKeys(bl, el)) if (!same(a[k], b[k])) patch[k] = b[k]
    if (Object.keys(patch).length) layers[bl.name] = patch
  }
  if (Object.keys(layers).length) out.layers = layers

  const added: AddedLayer[] = []
  const collect = (list: Layer[], side: Side, parent?: string): void => {
    list.forEach((l, i) => {
      if (inherited.has(l.id)) {
        if (l.type === 'group') collect(l.children, side, l.name)
        return
      }
      const own = withoutInherited(l, inherited)
      if (!own) return
      const prev = list[i - 1]
      added.push({
        side,
        ...(parent ? { parent } : {}),
        ...(prev ? { after: prev.name } : {}),
        layer: own
      })
    })
  }
  for (const side of SIDES) collect(edited[side], side)
  if (added.length) out.added = added
  return out
}

/**
 * Un livello aggiunto senza i livelli ereditati che vi sono finiti dentro (raggruppandoli):
 * quelli restano al loro posto nel base. Un gruppo rimasto vuoto non conta.
 */
function withoutInherited(l: Layer, inherited: Map<string, Layer>): Layer | null {
  if (l.type !== 'group') return l
  const children = l.children.flatMap((c) =>
    inherited.has(c.id) ? [] : (withoutInherited(c, inherited) ?? [])
  )
  if (!children.length && l.children.length) return null
  return children.length === l.children.length ? l : fitGroup({ ...l, children })
}

/**
 * Riporta un derivato modificato nell'editor a ciò che i derivati possono fare: le differenze
 * si ricalcolano e il template si risolve di nuovo. L'ordine dei livelli ereditati torna quello
 * del base, un livello ereditato eliminato resta nascosto.
 */
export function rebase(base: Template, edited: Template): Template {
  return resolveTemplate(base, { ...edited, changes: diffTemplate(base, edited) }).template
}

/** Risolve tutti i derivati di un elenco, nell'ordine in cui i base vengono prima */
export function resolveTemplates(list: Template[]): { templates: Template[]; problems: Message[] } {
  const problems: Message[] = []
  const byName = new Map(list.map((t) => [t.name, t]))
  const done = new Map<string, Template>()
  const visiting = new Set<string>()
  const resolve = (t: Template): Template => {
    if (!t.extends) return t
    const ready = done.get(t.name)
    if (ready) return ready
    let out: Template
    const base = byName.get(t.extends)
    if (visiting.has(t.name) || !base) {
      problems.push(
        base
          ? msg('inherit.cycle', { template: t.name })
          : msg('inherit.missingBase', { template: t.name, base: t.extends })
      )
      out = { ...t, width: t.width || 63, height: t.height || 88, front: [], back: [] }
    } else {
      visiting.add(t.name)
      const r = resolveTemplate(resolve(base), t)
      visiting.delete(t.name)
      problems.push(...r.problems)
      out = r.template
    }
    done.set(t.name, out)
    return out
  }
  return { templates: list.map(resolve), problems }
}

/**
 * Dopo una modifica ai template: i derivati seguono i loro base. Un livello rinominato nel base
 * rinomina anche le differenze che lo riguardano; `changed` sono i derivati da salvare per questo.
 */
export function syncDerived(
  before: Template[],
  after: Template[]
): { templates: Template[]; changed: string[] } {
  const old = new Map(before.map((t) => [t.name, t]))
  const now = new Map(after.map((t) => [t.name, t]))
  const changed: string[] = []
  const renamed = after.map((t) => {
    if (!t.extends || !t.changes) return t
    const prev = old.get(t.extends)
    const next = now.get(t.extends)
    if (!prev || !next || prev === next) return t
    const names = new Map<string, string>()
    const nextIds = byId(next)
    for (const [id, l] of byId(prev)) {
      const n = nextIds.get(id)
      if (n && n.name !== l.name) names.set(l.name, n.name)
    }
    if (!names.size) return t
    const rename = (n?: string): string | undefined => (n === undefined ? n : (names.get(n) ?? n))
    const c = t.changes
    changed.push(t.name)
    return {
      ...t,
      changes: {
        ...c,
        ...(c.layers
          ? {
              layers: Object.fromEntries(
                Object.entries(c.layers).map(([k, v]) => [rename(k) as string, v])
              )
            }
          : {}),
        ...(c.added
          ? {
              added: c.added.map((a) => ({
                ...a,
                ...(a.parent ? { parent: rename(a.parent) } : {}),
                ...(a.after ? { after: rename(a.after) } : {})
              }))
            }
          : {})
      }
    }
  })
  return { templates: resolveTemplates(renamed).templates, changed }
}

/** Il base già risolto di un derivato, se c'è */
export function baseOf(list: Template[], t: Template): Template | null {
  return t.extends ? (list.find((x) => x.name === t.extends) ?? null) : null
}

/** I template che derivano direttamente da `name` */
export function derivedOf(list: Template[], name: string): Template[] {
  return list.filter((t) => t.extends === name)
}

/** Scegliere `base` come base di `name` creerebbe un giro */
export function wouldCycle(list: Template[], name: string, base: string): boolean {
  const byName = new Map(list.map((t) => [t.name, t]))
  for (let n: string | undefined = base; n; n = byName.get(n)?.extends) if (n === name) return true
  return false
}

/** Nuovo derivato vuoto: identico al base finché non lo si modifica */
export function newDerived(base: Template, name: string): Template {
  return resolveTemplate(base, {
    ...base,
    name,
    file: undefined,
    origin: undefined,
    extends: base.name,
    changes: {}
  }).template
}

/** Rende indipendente un derivato: diventa un template normale con i valori che ha ora */
export function detach(t: Template): Template {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { extends: _base, changes: _changes, ...plain } = t
  return plain
}

export type InheritStatus = 'inherited' | 'changed' | 'added'

/** Stato di un livello del derivato rispetto al base, e le proprietà che cambia */
export function layerStatus(base: Template, l: Layer): { status: InheritStatus; keys: string[] } {
  const bl = byId(base).get(l.id)
  if (!bl) return { status: 'added', keys: [] }
  const a = bl as unknown as Record<string, unknown>
  const b = l as unknown as Record<string, unknown>
  const keys = layerKeys(bl, l).filter((k) => !same(a[k], b[k]))
  // un gruppo cambia anche quando cambiano i suoi figli
  const inner =
    l.type === 'group' &&
    walkLayers(l.children).some((c) => layerStatus(base, c).status !== 'inherited')
  return { status: keys.length || inner ? 'changed' : 'inherited', keys }
}

/** Il livello del base da cui viene un livello ereditato */
export function baseLayer(base: Template, id: string): Layer | null {
  return byId(base).get(id) ?? null
}

/** Proprietà del template cambiate dal derivato */
export function changedTemplateKeys(base: Template, t: Template): InheritableTemplateKey[] {
  return INHERITABLE_TEMPLATE_KEYS.filter((k) => !same(templateValue(t, k), templateValue(base, k)))
}

/** Il valore del base per una proprietà del template */
export function baseTemplateValue(base: Template, k: InheritableTemplateKey): unknown {
  return templateValue(base, k)
}

/** Colonna facoltativa del foglio che sceglie il template di una singola carta */
export const TEMPLATE_COLUMN = 'template'

/**
 * Template di una carta: quello scritto nella colonna `template`, se esiste e ha le misure del
 * template del set (le carte di un set si stampano insieme), altrimenti quello del set.
 */
export function cardTemplate(
  headers: string[],
  row: string[],
  setTemplate: Template,
  list: Template[]
): { template: Template; problem?: Message } {
  const i = headers.indexOf(TEMPLATE_COLUMN)
  const name = i < 0 ? '' : (row[i] ?? '').trim()
  if (!name || name === setTemplate.name) return { template: setTemplate }
  const t = list.find((x) => x.name === name)
  if (!t) return { template: setTemplate, problem: msg('inherit.cardTemplateMissing', { name }) }
  if (t.width !== setTemplate.width || t.height !== setTemplate.height)
    return { template: setTemplate, problem: msg('inherit.cardTemplateSize', { name }) }
  return { template: t }
}

/** Riporta un livello ereditato, con i suoi figli, ai valori del base; i livelli aggiunti restano */
export function revertLayer(base: Template, t: Template, id: string): Template {
  const from = byId(base)
  const revert = (l: Layer): Layer => {
    const b = from.get(l.id)
    if (!b) return l
    const a = b as unknown as Record<string, unknown>
    let out = { ...l } as Layer
    for (const k of layerKeys(b, l)) Object.assign(out, { [k]: a[k] })
    if (out.type === 'group') out = fitGroup({ ...out, children: out.children.map(revert) })
    return out
  }
  const visit = (list: Layer[]): Layer[] =>
    list.map((l) => {
      if (l.id === id) return revert(l)
      return l.type === 'group' ? fitGroup({ ...l, children: visit(l.children) }) : l
    })
  return { ...t, front: visit(t.front), back: visit(t.back) }
}

/**
 * Dopo una modifica fatta su tutti i template risolti insieme (per esempio la rinomina di una
 * variabile): le differenze dei derivati si ricalcolano da quello che ora contengono.
 */
export function rediffDerived(list: Template[]): Template[] {
  const byName = new Map(list.map((t) => [t.name, t]))
  const rediffed = list.map((t) => {
    const base = t.extends ? byName.get(t.extends) : undefined
    return base ? { ...t, changes: diffTemplate(base, t) } : t
  })
  return resolveTemplates(rediffed).templates
}
