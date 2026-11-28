import { describe, expect, it } from 'vitest'
import { inlineImageIndex, inlineImageKey, inlineImages, parseInlineHeight } from '../docInline'
import {
  cardRefSource,
  documentProblems,
  imageSourceWith,
  parseCardRef,
  parseDocument,
  splitImageSource,
  type CardRef
} from '../document'
import { markupRefs, parseInline } from '../markup'

describe('immagini in linea con il testo', () => {
  it('un paragrafo con testo e immagini resta un paragrafo', () => {
    const [b] = parseDocument('Pesca ![Pesca](card:Azioni/nome=Pesca?height=150%) e scartala\n')
    expect(b.kind).toBe('paragraph')
    const [f] = parseDocument('![Pesca](card:Azioni/nome=Pesca)\n')
    expect(f.kind).toBe('figure')
  })

  it('le immagini diventano segnaposto che il markup legge come {nomi}', () => {
    const { text, images } = inlineImages('Paga ![](icone/moneta.png?height=8) e ![x](card:A/1)')
    expect(images).toEqual([
      { alt: '', src: 'icone/moneta.png?height=8' },
      { alt: 'x', src: 'card:A/1' }
    ])
    const names = markupRefs(text)
    expect(names.map(inlineImageIndex)).toEqual([0, 1])
    expect(inlineImageIndex('spada')).toBeNull()
  })

  it('dopo una ] il segnaposto non diventa attributi del testo tra quadre', () => {
    const { text } = inlineImages('[parola]![](a.png)')
    const nodes = parseInline(text).children
    expect(nodes.some((n) => n.t === 'ref')).toBe(true)
  })

  it('senza immagini il testo resta com è', () => {
    expect(inlineImages('Solo {spada} testo')).toEqual({ text: 'Solo {spada} testo', images: [] })
  })

  it('le chiavi distinguono blocco, voce e immagine', () => {
    expect(inlineImageKey(12, 0, 1)).toBe('12:0:1')
  })

  it('height in mm o in percentuale', () => {
    expect(parseInlineHeight('8')).toEqual({ value: 8, percent: false })
    expect(parseInlineHeight('150%')).toEqual({ value: 150, percent: true })
    expect(parseInlineHeight('0')).toBeNull()
    expect(parseInlineHeight('alto')).toBeNull()
  })

  it('height si legge e si riscrive per immagini e carte', () => {
    const img = splitImageSource('icone/mappa.png?height=150%')
    expect(img.bad).toEqual([])
    expect(imageSourceWith(img.path, img.options)).toBe('icone/mappa.png?height=150%')
    const ref = parseCardRef('card:Azioni/nome=Pesca?height=8') as CardRef
    expect(ref.height).toEqual({ value: 8, percent: false })
    expect(cardRefSource(ref)).toBe('card:Azioni/nome=Pesca?height=8')
  })

  it('il controllo segnala le immagini in linea che non si trovano', () => {
    const ok = documentProblems('Paga ![](moneta.png) ora\n', { assets: ['moneta.png'] })
    expect(ok).toEqual([])
    const missing = documentProblems('Paga ![](sasso.png) ora\n', { assets: ['moneta.png'] })
    expect(missing.length).toBe(1)
  })
})
