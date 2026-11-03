import { describe, expect, it } from 'vitest'
import { boxStartLine, DEFAULT_BOX_STYLE, parseBoxStyle } from '../docBox'
import {
  anatomySource,
  blockWrap,
  cardRefSource,
  figureWrap,
  imageSourceWith,
  parseCardRef,
  parseDocument,
  splitImageSource
} from '../document'
import { setupSource } from '../setup'

// testo che scorre accanto a immagini, carte, anatomie, schemi e riquadri (wrap)
describe('testo accanto', () => {
  it('immagini e carte: wrap=left|right dopo ?', () => {
    const img = splitImageSource('icone/mappa.png?width=40&wrap=right')
    expect(img.options).toEqual({ width: 40, wrap: 'right' })
    expect(img.bad).toEqual([])
    expect(imageSourceWith('a.png', { wrap: 'left' })).toBe('a.png?wrap=left')
    expect(splitImageSource('a.png?wrap=up').bad).toEqual(['wrap=up'])
    const ref = parseCardRef('card:Eroi/2?wrap=left')
    expect(ref).toMatchObject({ set: 'Eroi', row: 2, wrap: 'left' })
    expect(cardRefSource({ set: 'Eroi', row: 2, side: 'front', wrap: 'left' })).toBe(
      'card:Eroi/2?wrap=left'
    )
    expect(figureWrap([{ src: 'a.png' }, { src: 'b.png?wrap=right' }])).toBe('right')
    expect(figureWrap([{ src: 'a.png' }])).toBeNull()
  })

  it('anatomia e schema: riga wrap:', () => {
    const anatomy = anatomySource('Eroi/1', [], false, { wrap: 'right', width: 0.5 })
    expect(anatomy).toContain('wrap: right')
    const [a] = parseDocument(anatomy)
    expect(a.kind === 'anatomy' && a.wrap).toBe('right')
    expect(blockWrap(a)).toBe('right')
    const setup = setupSource({
      size: null,
      items: [{ kind: 'zone', x: 0, y: 0, w: 20, h: 10, label: '', from: 0, to: 0 }],
      wrap: 'left'
    })
    const [s] = parseDocument(setup)
    expect(s.kind === 'setup' && s.wrap).toBe('left')
    expect(s.kind === 'setup' && s.bad).toEqual([])
    const [bad] = parseDocument('```anatomy\ncard: Eroi/1\nwrap: up\n```')
    expect(bad.kind === 'anatomy' && bad.bad.length).toBe(1)
    expect(blockWrap(parseDocument('Testo')[0])).toBeNull()
  })

  it('la riga <!-- clear --> fa ripartire sotto il blocco dopo; i titoli scorrono accanto', () => {
    const blocks = parseDocument('![](a.png?wrap=left)\n\n# Titolo\n\nTesto\n<!-- clear -->\nSotto')
    expect(blocks.map((b) => b.kind)).toEqual(['figure', 'heading', 'paragraph', 'paragraph'])
    expect(blocks.map((b) => !!b.clear)).toEqual([false, false, false, true])
    expect(blocks[2].kind === 'paragraph' && blocks[2].text).toBe('Testo')
  })

  it('riquadri: width=40% e wrap=left', () => {
    const { style, bad } = parseBoxStyle('<!-- box width=40% wrap=left -->')
    expect(bad).toEqual([])
    expect(style.width).toBeCloseTo(0.4)
    expect(style.wrap).toBe('left')
    expect(boxStartLine({ ...DEFAULT_BOX_STYLE, width: 0.4, wrap: 'right' })).toBe(
      '<!-- box width=40% wrap=right -->'
    )
    expect(parseBoxStyle('<!-- box width=40 -->').bad).toEqual(['width=40'])
    expect(boxStartLine(DEFAULT_BOX_STYLE)).toBe('<!-- box -->')
  })
})
