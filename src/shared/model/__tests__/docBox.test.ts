import { describe, expect, it } from 'vitest'
import { boxStartLine, DEFAULT_BOX_STYLE, parseBoxStyle, unwrapBox, wrapInBox } from '../docBox'
import { documentBoxes, parseDocument } from '../document'

describe('riquadri dei documenti', () => {
  const src =
    'Prima\n\n<!-- box fill=#fff3c4 border=#e0b000 -->\n\n# Titolo\n\nDentro\n\n<!-- /box -->\n\nDopo'

  it('i blocchi tra le due righe stanno nel riquadro', () => {
    const blocks = parseDocument(src)
    expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'heading', 'paragraph', 'paragraph'])
    expect(blocks[0].box).toBeUndefined()
    expect(blocks[1].box).toBeDefined()
    expect(blocks[2].box).toBe(blocks[1].box)
    expect(blocks[3].box).toBeUndefined()
    expect(blocks[1].box!.style.fill).toBe('#fff3c4')
    expect(blocks[1].box!.style.border).toBe('#e0b000')
  })

  it('le righe del riquadro chiudono un paragrafo o un elenco', () => {
    const blocks = parseDocument('<!-- box -->\n- uno\n- due\n<!-- /box -->\ntesto')
    expect(blocks.map((b) => [b.kind, !!b.box])).toEqual([
      ['list', true],
      ['paragraph', false]
    ])
  })

  it('opzioni sconosciute e riquadro non chiuso', () => {
    const [box] = documentBoxes('<!-- box colore=rosso -->\n\ntesto')
    expect(box.bad).toEqual(['colore=rosso'])
    expect(box.endFrom).toBeNull()
  })

  it('la riga scrive solo ciò che cambia', () => {
    expect(boxStartLine(DEFAULT_BOX_STYLE)).toBe('<!-- box -->')
    const style = { ...DEFAULT_BOX_STYLE, fill: null, border: '#000', radius: 2 }
    expect(parseBoxStyle(boxStartLine(style)).style).toEqual(style)
  })

  it('mette le righe selezionate in un riquadro e lo toglie', () => {
    const text = 'Uno\n\nDue\n\nTre'
    const at = text.indexOf('Due')
    const out = wrapInBox(text, at + 1, at + 2, DEFAULT_BOX_STYLE, 'x')
    expect(out.text).toBe('Uno\n\n<!-- box -->\n\nDue\n\n<!-- /box -->\n\nTre')
    const [box] = documentBoxes(out.text)
    expect(unwrapBox(out.text, box)).toBe(text)
  })

  it('senza selezione inserisce un riquadro con il testo di prova', () => {
    const out = wrapInBox('Uno', 3, 3, DEFAULT_BOX_STYLE, 'Prova')
    expect(out.text).toBe('Uno\n\n<!-- box -->\n\nProva\n\n<!-- /box -->\n\n')
    expect(out.text.slice(0, out.caret).endsWith('Prova')).toBe(true)
  })
})

describe('posizione dei riquadri', () => {
  it('align= al centro o a destra, scritto solo se il riquadro è più stretto e senza testo accanto', () => {
    expect(parseBoxStyle('<!-- box width=60% align=center -->').style.align).toBe('center')
    expect(parseBoxStyle('<!-- box align=right -->').style.align).toBe('right')
    expect(parseBoxStyle('<!-- box align=middle -->').bad).toEqual(['align=middle'])
    const narrow = { ...DEFAULT_BOX_STYLE, width: 0.6, align: 'center' as const }
    expect(boxStartLine(narrow)).toBe('<!-- box width=60% align=center -->')
    expect(parseBoxStyle(boxStartLine(narrow)).style).toEqual(narrow)
    expect(boxStartLine({ ...narrow, width: null })).toBe('<!-- box -->')
    expect(boxStartLine({ ...narrow, wrap: 'right' })).toBe('<!-- box width=60% wrap=right -->')
  })
})
