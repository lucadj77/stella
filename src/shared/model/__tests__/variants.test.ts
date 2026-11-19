import { describe, expect, it } from 'vitest'
import { denormalizeTemplate, normalizeTemplate } from '../normalize'
import { bindRow } from '../bind'
import {
  descendantsOf,
  detach,
  isVariant,
  newDerived,
  rebase,
  reorderVariants,
  resolveTemplates,
  variantFamily,
  variantsOf
} from '../inherit'
import { collectPackage } from '../package'
import { patchLayer } from '../edit'
import type { ImageLayer, Template } from '../template'

// Varianti: derivati del template che stanno dentro di lui e si scelgono carta per carta

const carta = normalizeTemplate({
  name: 'Carta',
  width: 63,
  height: 88,
  front: [
    { type: 'image', name: 'cornice', src: 'cornici/rossa' },
    { type: 'text', name: 'nome', text: 'x' }
  ],
  back: []
})

const blu = (() => {
  const v = newDerived(carta, 'Carta blu', true)
  const id = v.front[0].id
  return rebase(carta, patchLayer(v, 'front', id, { src: 'cornici/blu' } as never))
})()

const all: Template[] = [carta, blu]

describe('varianti', () => {
  it('nel file: solo le differenze e il segno di variante', () => {
    const raw = denormalizeTemplate(blu) as unknown as Record<string, unknown>
    expect(raw).toEqual({
      name: 'Carta blu',
      extends: 'Carta',
      variant: true,
      changes: { layers: { cornice: { src: 'cornici/blu' } } }
    })
    const again = resolveTemplates([carta, normalizeTemplate(raw as never)]).templates[1]
    expect(again.variant).toBe(true)
    expect((again.front[0] as ImageLayer).src).toBe('cornici/blu')
  })

  it('un derivato normale non è una variante', () => {
    const d = newDerived(carta, 'Altra')
    expect(d.variant).toBeUndefined()
    expect(denormalizeTemplate(d)).not.toHaveProperty('variant')
    expect(isVariant([carta, d], d)).toBe(false)
  })

  it('famiglia: il base e le sue varianti, anche dal template di una variante', () => {
    expect(variantsOf(all, 'Carta').map((x) => x.name)).toEqual(['Carta blu'])
    expect(isVariant(all, blu)).toBe(true)
    expect(variantFamily(all, carta).map((x) => x.name)).toEqual(['Carta', 'Carta blu'])
    expect(variantFamily(all, blu).map((x) => x.name)).toEqual(['Carta', 'Carta blu'])
    expect(variantFamily([carta], carta)).toEqual([])
    // senza il base una variante resta un template qualsiasi
    expect(isVariant([blu], blu)).toBe(false)
  })

  it('la carta sceglie la variante nella colonna template', () => {
    const b = bindRow(['template', 'nome'], ['Carta blu', 'Drago'], carta, all)
    expect((b.template.front[0] as ImageLayer).src).toBe('cornici/blu')
    expect(b.problems).toEqual([])
  })

  it('rendere indipendente una variante toglie anche il segno', () => {
    expect(detach(blu)).not.toHaveProperty('variant')
  })

  it('il pacchetto del template porta le sue varianti', () => {
    const pkg = collectPackage(
      {
        templates: all,
        sets: [],
        assets: [],
        variables: {},
        styles: {},
        fonts: [],
        sources: {}
      } as never,
      { kind: 'template', name: 'Carta' }
    )
    expect(pkg.templates.map((x) => x.name)).toEqual(['Carta', 'Carta blu'])
  })

  it('ordine: il posto nel file, le varianti senza posto dopo', () => {
    const a = newDerived(carta, 'A', true, 2)
    const b = newDerived(carta, 'B', true)
    const c = newDerived(carta, 'C', true, 1)
    const list = [carta, a, b, c]
    expect(variantsOf(list, 'Carta').map((x) => x.name)).toEqual(['C', 'A', 'B'])
    const raw = denormalizeTemplate(a) as unknown as Record<string, unknown>
    expect(raw.variantOrder).toBe(2)
    const again = resolveTemplates([carta, normalizeTemplate(raw as never)]).templates[1]
    expect(again.variantOrder).toBe(2)
    expect(detach(a)).not.toHaveProperty('variantOrder')
    // un derivato normale non tiene il posto
    expect(newDerived(carta, 'D', false, 3)).not.toHaveProperty('variantOrder')
  })

  it('riordinare: solo le varianti che cambiano posto', () => {
    const a = newDerived(carta, 'A', true, 1)
    const b = newDerived(carta, 'B', true, 2)
    const c = newDerived(carta, 'C', true, 3)
    const changed = reorderVariants([carta, a, b, c], 'Carta', ['A', 'C', 'B'])
    expect(changed.map((x) => [x.name, x.variantOrder])).toEqual([
      ['C', 2],
      ['B', 3]
    ])
  })

  it('discendenti: anche i derivati dei derivati', () => {
    const d = newDerived(carta, 'D')
    const e = newDerived(d, 'E')
    expect(descendantsOf([carta, blu, d, e], 'Carta').map((x) => x.name)).toEqual([
      'Carta blu',
      'D',
      'E'
    ])
  })
})
