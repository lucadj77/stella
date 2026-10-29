import { describe, expect, it } from 'vitest'
import { bindCard, rowToCard } from '../bind'
import { normalizeTemplate } from '../normalize'
import { snapPoints } from '../ttsSnap'
import type { GridLayer, GroupLayer, Template } from '../template'
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
})
