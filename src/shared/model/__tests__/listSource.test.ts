import { describe, expect, it } from 'vitest'
import { bindCard, rowToCard, switchSource, sourceChoice } from '../bind'
import { denormalizeTemplate, normalizeTemplate } from '../normalize'
import { listColumns, templateColumns } from '../sheet'
import { imageUsages } from '../imageUsage'
import { collectPackage } from '../package'
import { renameInTemplate } from '../rename'
import { findOption, type ImageLayer, type ShapeLayer } from '../template'

// La fonte «Elenco»: una colonna con le voci che la carta può scegliere

const carta = normalizeTemplate({
  name: 'Carta',
  width: 63,
  height: 88,
  front: [
    {
      type: 'value',
      name: 'tipo',
      value: 'Mostro',
      source: { kind: 'column', column: null, options: ['Mostro', 'Magia'] }
    },
    {
      type: 'image',
      name: 'cornice',
      src: 'cornici/rossa',
      source: {
        kind: 'column',
        column: null,
        options: ['cornici/rossa', 'cornici/blu', 'cornici/verde']
      }
    },
    {
      type: 'shape',
      name: 'bordo',
      fill: 'oro',
      source: { kind: 'column', column: null, options: ['oro', '#aa2222'] }
    },
    { type: 'text', name: 'nome', text: 'x' }
  ],
  back: []
})

const assets = [
  'images/cornici/rossa.png',
  'images/cornici/blu.png',
  'images/cornici/verde.png',
  'images/altro.png'
]

describe('fonte Elenco', () => {
  it('le voci restano nel file', () => {
    const file = denormalizeTemplate(carta) as unknown as {
      front: { source?: { options?: string[] } }[]
    }
    expect(file.front[1].source?.options).toEqual(['cornici/rossa', 'cornici/blu', 'cornici/verde'])
    const again = normalizeTemplate(file as never)
    expect(sourceChoice(again.front[1])).toBe('list')
  })

  it('la carta legge la colonna; cella vuota: il valore del template', () => {
    const b = bindCard(
      carta,
      rowToCard(['nome', 'cornice', 'bordo'], ['Drago', 'cornici/blu', '#aa2222'])
    )
    expect((b.template.front[1] as ImageLayer).src).toBe('cornici/blu')
    expect((b.template.front[2] as ShapeLayer).fill).toBe('#aa2222')
    expect(b.problems).toEqual([])
    const empty = bindCard(carta, rowToCard(['cornice'], ['']))
    expect((empty.template.front[1] as ImageLayer).src).toBe('cornici/rossa')
  })

  it('una voce fuori elenco si disegna ed è un problema della carta', () => {
    const b = bindCard(carta, rowToCard(['cornice', 'tipo'], ['cornici/bleu', 'magia']))
    expect((b.template.front[1] as ImageLayer).src).toBe('cornici/bleu')
    // maiuscole e spazi non contano
    expect(b.problems.map((p) => `${p.key}:${p.params?.value}`)).toEqual([
      'bind.notInList:cornici/bleu'
    ])
  })

  it("cambiare fonte: l'elenco parte dal valore del template e torna colonna", () => {
    const nome = carta.front[3]
    const list = switchSource(nome, 'list')
    expect(list).toEqual({ kind: 'column', column: null, options: ['x'] })
    const withList = { ...nome, source: list }
    expect(sourceChoice(withList)).toBe('list')
    expect(switchSource(withList, 'column')).toEqual({ kind: 'column', column: null })
    expect(switchSource(withList, 'fixed')).toEqual({ kind: 'fixed' })
  })

  it("colonne: quelle con l'elenco, anche le forme", () => {
    expect(templateColumns(carta)).toEqual(['amount', 'tipo', 'cornice', 'bordo', 'nome'])
    const lists = listColumns(carta)
    expect([...lists.keys()]).toEqual(['tipo', 'cornice', 'bordo'])
    expect(lists.get('bordo')).toEqual({
      type: 'shape',
      options: ['oro', '#aa2222'],
      fallback: 'oro'
    })
  })

  it('le immagini delle voci sono del template e vanno nel pacchetto', () => {
    const uses = imageUsages({ templates: [carta], sets: [], assets })
    expect(uses.get('images/cornici/verde.png')?.templates).toEqual(['Carta'])
    expect(uses.get('images/altro.png')?.templates).toEqual([])
    const pkg = collectPackage(
      {
        templates: [carta],
        sets: [],
        assets,
        variables: {},
        styles: {},
        fonts: [],
        sources: {}
      } as never,
      { kind: 'template', name: 'Carta' }
    )
    expect(pkg.assets).toEqual([
      'images/cornici/blu.png',
      'images/cornici/rossa.png',
      'images/cornici/verde.png'
    ])
  })

  it('rinominare una variabile colore rinomina la voce', () => {
    const out = renameInTemplate(carta, 'variable', 'oro', 'dorato')
    expect((out.front[2] as ShapeLayer).fill).toBe('dorato')
    expect(out.front[2].source).toEqual({
      kind: 'column',
      column: null,
      options: ['dorato', '#aa2222']
    })
  })

  it('findOption non bada a spazi e maiuscole', () => {
    expect(findOption(['Mostro', 'Magia'], ' magia ')).toBe('Magia')
    expect(findOption(['Mostro'], 'Trappola')).toBeUndefined()
  })
})
