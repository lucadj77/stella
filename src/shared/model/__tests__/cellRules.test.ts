import { describe, expect, it } from 'vitest'
import { bindCard, rowToCard } from '../bind'
import { evaluateFormula } from '../formula'
import { cellsCondition, pickedCells } from '../cellRules'
import { normalizeTemplate } from '../normalize'
import { snapPoints } from '../ttsSnap'
import type { GridLayer, GroupLayer, ImageLayer, Template, TextLayer } from '../template'
import type { BoundCard } from '../bind'

const template = (rules: GridLayer['cellRules'], extra: Partial<GridLayer> = {}): Template =>
  normalizeTemplate({
    name: 't',
    front: [
      {
        type: 'group',
        name: 'numero',
        children: [{ type: 'text', name: 'n', text: '{cell.index}' }]
      },
      {
        type: 'grid',
        name: 'tracciato',
        rows: 2,
        columns: 3,
        content: 'numero',
        fill: '#FFFFFF',
        cellRules: rules,
        ...extra
      }
    ]
  })

const grid = (
  t: Template,
  fields: string[] = [],
  values: string[] = []
): { grid: GridLayer; r: BoundCard } => {
  const r = bindCard(t, rowToCard(fields, values))
  return { grid: r.template.front.find((l) => l.type === 'grid') as GridLayer, r }
}

describe('regole delle caselle', () => {
  it('senza regole le caselle restano tutte uguali', () => {
    expect(grid(template([])).grid.looks).toBeUndefined()
  })

  it('applica le regole in ordine, con i campi della casella e della carta', () => {
    const { grid: g, r } = grid(
      template([
        { when: '=MOD({cell.index}; 2) = 0', fill: '#C62828' },
        { when: '{cell.row} = {riga}', stroke: { color: '#000000', width: 1 }, radius: 2 },
        { when: '=AND({cell.row} = 1; {cell.column} = 1)', hidden: true },
        { when: '={cell.index} = 6', fill: null }
      ]),
      ['riga'],
      ['2']
    )
    expect(r.problems).toEqual([])
    const looks = g.looks!
    expect(looks.map((l) => l.fill)).toEqual([
      '#FFFFFF',
      '#C62828',
      '#FFFFFF',
      '#C62828',
      '#FFFFFF',
      null
    ])
    expect(looks.map((l) => l.hidden)).toEqual([true, false, false, false, false, false])
    expect(looks[3].stroke).toEqual({ color: '#000000', width: 1 })
    expect(looks[3].radius).toBe(2)
    expect(looks[0].stroke).toEqual(g.stroke)
    // la casella nascosta nasconde il suo contenuto
    expect((g.cells as GroupLayer[]).map((c) => c.visible)).toEqual([
      false,
      true,
      true,
      true,
      true,
      true
    ])
  })

  it('segnala una regola sbagliata una volta sola', () => {
    const { r, grid: g } = grid(template([{ when: '=MIN(', fill: '#000000' }]))
    expect(r.problems).toHaveLength(1)
    expect(r.problems[0].key).toBe('bind.cellRuleError')
    expect(g.looks!.every((l) => l.fill === '#FFFFFF')).toBe(true)
  })

  it('una casella nascosta non ha snap point', () => {
    const t = template([{ when: '={cell.index} <= 2', hidden: true }], {
      content: '',
      snap: { tags: '', rotated: false }
    } as Partial<GridLayer>)
    expect(snapPoints([grid(t).grid])).toHaveLength(4)
  })

  it('INLIST: elenchi, intervalli e testi', () => {
    const is = (expr: string, fields: Record<string, string> = {}): string =>
      evaluateFormula(expr, fields).value
    expect(is('=INLIST(8; "3, 8, 11")')).toBe('true')
    expect(is('=INLIST(9; "3, 8, 11")')).toBe('false')
    expect(is('=INLIST(4; "1-5, 9")')).toBe('true')
    expect(is('=INLIST(6; "1-5, 9")')).toBe('false')
    expect(is('=INLIST(11; 3; 8; 11)')).toBe('true')
    expect(is('=INLIST({tipo}; "drago, orco")', { tipo: 'Orco' })).toBe('true')
    expect(is('=INLIST({tipo}; "drago, orco")', { tipo: 'elfo' })).toBe('false')
  })

  it('le regole danno valori ai livelli del contenuto', () => {
    const t = normalizeTemplate({
      name: 't',
      front: [
        {
          type: 'group',
          name: 'casella',
          children: [
            { type: 'text', name: 'scritta', text: '' },
            { type: 'image', name: 'icona', src: '' }
          ]
        },
        {
          type: 'grid',
          name: 'g',
          rows: 3,
          columns: 5,
          content: 'casella',
          cellRules: [
            { when: '=INLIST({cell.index}; "3, 8, 11")', values: { icona: 'spada' } },
            { when: '=INLIST({cell.index}; "5, 6, 13")', values: { scritta: 'xyz' } },
            {
              when: '=INLIST({cell.index}; "2, 4, 10")',
              values: { scritta: 'Casella {cell.index} di {nome}', icona: 'scudo' }
            },
            { when: '={cell.index} = 1', values: { manca: 'x' } },
            { when: '={cell.index} = 14', values: { scritta: '+2' } },
            { when: '={cell.index} = 15', values: { scritta: '1-3 "{nome}"' } }
          ]
        }
      ]
    })
    const r = bindCard(t, rowToCard(['nome'], ['Plancia']))
    expect(r.problems.map((p) => p.key)).toEqual(['bind.cellRuleLayer'])
    const g = r.template.front.find((l) => l.type === 'grid') as GridLayer
    const cell = (i: number): { text: string; src: string } => {
      const [text, image] = g.cells![i - 1].children as [TextLayer, ImageLayer]
      return { text: text.text, src: image.src }
    }
    expect(cell(3)).toEqual({ text: '', src: 'spada' })
    expect(cell(5)).toEqual({ text: 'xyz', src: '' })
    expect(cell(10)).toEqual({ text: 'Casella 10 di Plancia', src: 'scudo' })
    expect(cell(7)).toEqual({ text: '', src: '' })
    // un valore senza = resta un testo, anche con + o -
    expect(cell(14).text).toBe('+2')
    expect(cell(15).text).toBe('1-3 "Plancia"')
  })

  it('le caselle scelte con il clic diventano una condizione e tornano indietro', () => {
    expect(cellsCondition([10, 2, 4, 11, 12, 1])).toBe('=INLIST({cell.index}; "1, 2, 4, 10-12")')
    expect(pickedCells('=INLIST({cell.index}; "1, 2, 4, 10-12")')).toEqual([1, 2, 4, 10, 11, 12])
    expect(pickedCells('={cell.row} = 1')).toBeNull()
  })
})
