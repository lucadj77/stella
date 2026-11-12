import { describe, expect, it } from 'vitest'
import { KIND_PRESETS } from '../kinds'
import { normalizeLayer } from '../normalize'
import { STARTERS, starterLayers } from '../starters'
import { COMPONENT_KINDS } from '../template'

const texts = { title: 'Title', text: 'Rules' }

describe('starter layouts', () => {
  it('fit every preset of every kind, inside the safe area or up to the bleed', () => {
    for (const kind of COMPONENT_KINDS)
      for (const p of KIND_PRESETS[kind])
        for (const key of STARTERS[kind]) {
          const layers = starterLayers(key, p.width, p.height, 3, 3, texts, p.shape)
          expect(layers.length).toBeGreaterThan(0)
          for (const l of layers) {
            const { x, y, w, h } = l as { x: number; y: number; w: number; h: number }
            const where = `${kind} ${p.key} ${key} ${String(l.name)}`
            expect(w, where).toBeGreaterThan(0)
            expect(h, where).toBeGreaterThan(0)
            expect(x, where).toBeGreaterThanOrEqual(-3)
            expect(y, where).toBeGreaterThanOrEqual(-3)
            expect(x + w, where).toBeLessThanOrEqual(p.width + 3 + 0.01)
            expect(y + h, where).toBeLessThanOrEqual(p.height + 3 + 0.01)
          }
        }
  })

  it('makes valid layers with distinct names', () => {
    const layers = starterLayers('titleArtText', 63, 88, 3, 3, texts).map((l, i) =>
      normalizeLayer(l, i)
    )
    expect(layers.map((l) => l.type)).toEqual(['text', 'image', 'text'])
    expect(new Set(layers.map((l) => l.name)).size).toBe(3)
    expect(layers[0]).toMatchObject({ name: 'title', text: 'Title', y: 4 })
  })

  it('offers no layout for dice, which start with their number', () => {
    expect(STARTERS.die).toEqual([])
  })
})
