import { describe, expect, it } from 'vitest'
import { denormalizeTemplate, isValidTemplateName, normalizeTemplate } from '../normalize'

describe('denormalizeTemplate', () => {
  it('scrive solo le proprietà diverse dai default', () => {
    const raw = {
      name: 't',
      front: [
        { type: 'text', name: 'nome', x: 4, text: 'Ciao', size: 12 },
        { type: 'group', name: 'g', children: [{ type: 'shape', name: 's', fill: null }] }
      ]
    }
    const t = normalizeTemplate(raw)
    t.front[0].y = 1.0000000001
    const out = denormalizeTemplate(t)
    expect(out.front).toEqual([
      { type: 'text', name: 'nome', x: 4, y: 1, text: 'Ciao', size: 12 },
      { type: 'group', name: 'g', children: [{ type: 'shape', name: 's', fill: null }] }
    ])
    // il giro completo non perde nulla
    const again = normalizeTemplate(out)
    expect(denormalizeTemplate(again)).toEqual(out)
  })

  it('accetta solo nomi utilizzabili come file', () => {
    expect(isValidTemplateName('personaggio')).toBe(true)
    expect(isValidTemplateName('carta grande')).toBe(true)
    expect(isValidTemplateName('../x')).toBe(false)
    expect(isValidTemplateName('a/b')).toBe(false)
    expect(isValidTemplateName(' a')).toBe(false)
    expect(isValidTemplateName('')).toBe(false)
  })
})

describe('forma della carta e guide', () => {
  it('salva forma, tracciato e guide solo se servono', () => {
    const plain = denormalizeTemplate(normalizeTemplate({ name: 't', guides: { x: [], y: [] } }))
    expect(plain).not.toHaveProperty('shape')
    expect(plain).not.toHaveProperty('guides')
    const t = normalizeTemplate({
      name: 't',
      shape: 'path',
      shapePath: 'M0 0 L1 0 L0.5 1 Z',
      guides: { x: [31.5000001], y: [] }
    })
    expect(denormalizeTemplate(t)).toMatchObject({
      shape: 'path',
      shapePath: 'M0 0 L1 0 L0.5 1 Z',
      guides: { x: [31.5], y: [] }
    })
    expect(denormalizeTemplate({ ...t, shape: 'ellipse' })).not.toHaveProperty('shapePath')
  })

  it('salva rotazione e specchi della forma, e scarta una rotazione non valida', () => {
    const t = normalizeTemplate({ name: 't', shape: 'hexagon', shapeRotation: 90, shapeFlipV: true })
    expect(denormalizeTemplate(t)).toMatchObject({ shapeRotation: 90, shapeFlipV: true })
    expect(denormalizeTemplate(t)).not.toHaveProperty('shapeFlipH')
    const odd = normalizeTemplate({ name: 't', shapeRotation: 45 as never })
    expect(odd).not.toHaveProperty('shapeRotation')
  })
})
