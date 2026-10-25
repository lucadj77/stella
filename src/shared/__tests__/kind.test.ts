import { describe, expect, it } from 'vitest'
import { denormalizeTemplate, normalizeTemplate } from '../model/normalize'
import { resolveTemplates } from '../model/inherit'
import { ttsSetObject } from '../export'
import { kindOf } from '../model/template'

describe('tipo di componente del template', () => {
  it('si legge e si scrive solo quando non è carta', () => {
    const token = normalizeTemplate({ name: 'gettone', kind: 'token' })
    expect(kindOf(token)).toBe('token')
    expect(denormalizeTemplate(token).kind).toBe('token')
    const card = normalizeTemplate({ name: 'carta', kind: 'card' })
    expect(card.kind).toBeUndefined()
    expect('kind' in denormalizeTemplate(card)).toBe(false)
  })

  it('un valore sconosciuto vale carta', () => {
    const t = normalizeTemplate({ name: 'x', kind: 'meeple' as never })
    expect(kindOf(t)).toBe('card')
  })

  it('un derivato prende il tipo del base, e può cambiarlo', () => {
    const base = normalizeTemplate({ name: 'base', kind: 'tile' })
    const same = normalizeTemplate({ name: 'a', extends: 'base' })
    const other = normalizeTemplate({
      name: 'b',
      extends: 'base',
      changes: { template: { kind: 'board' } }
    })
    const [, a, b] = resolveTemplates([base, same, other]).templates
    expect(kindOf(a)).toBe('tile')
    expect(kindOf(b)).toBe('board')
  })

  it("Tabletop Simulator propone il tipo, ma vale la scelta dell'esportazione", () => {
    expect(ttsSetObject({}, 'Dadi', 'die').type).toBe('die')
    expect(ttsSetObject({}, 'Carte').type).toBe('card')
    expect(
      ttsSetObject({ objects: { Dadi: { type: 'card', thickness: 2, edgeColor: '#FFF' } } }, 'Dadi', 'die')
        .type
    ).toBe('card')
  })
})
