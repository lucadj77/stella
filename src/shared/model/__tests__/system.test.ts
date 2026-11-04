import { describe, expect, it } from 'vitest'
import { bindCard, rowToCard } from '../bind'
import { normalizeTemplate } from '../normalize'
import { projectSystem, systemOfSet, today } from '../system'
import type { TextLayer } from '../template'
import { buildSets } from '../../exportJob'
import { expandCopies } from '../../export'
import type { LoadedProject } from '../../project'

const tpl = normalizeTemplate({
  name: 'carta',
  front: [
    {
      type: 'text',
      name: 'piede',
      text: '{project.name} · {set.name} · {template.name} {card.number}/{set.rows} ({set.cards}) {card.side}',
      source: { kind: 'fixed' }
    },
    {
      type: 'text',
      name: 'conto',
      text: 'x',
      source: { kind: 'formula', expr: '=CONCAT({card.copy}; "/"; {card.copies})' }
    }
  ],
  back: [{ type: 'text', name: 'lato', text: '{card.side} {date}', source: { kind: 'fixed' } }]
})

const text = (layers: unknown[], i: number): string => (layers[i] as TextLayer).text

describe('variabili di sistema', () => {
  const set = {
    name: 'Eroi',
    data: {
      name: 'Eroi',
      headers: ['amount', 'nome'],
      rows: [
        ['2', 'A'],
        ['', 'B'],
        ['0', 'C']
      ]
    }
  }

  it('conta righe e carte del set', () => {
    expect(systemOfSet('Gioco', set)).toEqual({ project: 'Gioco', set: 'Eroi', rows: 3, cards: 3 })
  })

  it('valgono nei testi e nelle formule, con il lato giusto sul retro', () => {
    const card = rowToCard(set.data.headers, set.data.rows[0])
    const system = { ...systemOfSet('Gioco', set), number: 1, date: '2026-10-20' }
    const bound = bindCard(tpl, card, { system })
    expect(text(bound.template.front, 0)).toBe('Gioco · Eroi · carta 1/3 (3) front')
    expect(text(bound.template.front, 1)).toBe('1/2')
    expect(text(bound.template.back, 0)).toBe('back 2026-10-20')
  })

  it('senza informazioni restano vuote, la data è oggi', () => {
    const bound = bindCard(tpl, rowToCard([], []), {})
    expect(text(bound.template.front, 0)).toBe(' ·  · carta / () front')
    expect(text(bound.template.back, 0)).toBe(`back ${today()}`)
    expect(bound.problems).toEqual([])
  })

  it("all'esportazione ogni copia ha il suo numero", () => {
    const project = {
      file: { name: 'Gioco', sets: [], formatVersion: 1, dataFile: 'd.xlsx' },
      sets: [{ ...set, template: 'carta' }],
      templates: [tpl],
      assets: []
    } as unknown as LoadedProject
    const [s] = buildSets(project, [])
    const copies = expandCopies(s.cards, true)
    expect(copies.map((c) => text(c.card.template.front, 1))).toEqual(['1/2', '2/2', '1/1'])
    // una carta che non usa {card.copy} non ha template per copia
    expect(s.cards[1].perCopy).toBeUndefined()
  })
})

describe('autore e versione del progetto', () => {
  it('si scrivono con {project.author} e {project.version}', () => {
    const t = normalizeTemplate({
      name: 'carta',
      front: [
        {
          type: 'text',
          name: 'piede',
          text: '{project.name} v{project.version} · {project.author}',
          source: { kind: 'fixed' }
        }
      ]
    })
    const meta = { name: 'Assedio', author: 'Luca', version: '0.3' }
    const set = { name: 'Unità', data: { name: 'Unità', headers: [], rows: [[]] } }
    for (const system of [projectSystem(meta), systemOfSet(meta, set as never)]) {
      const bound = bindCard(t, rowToCard([], []), { system })
      expect((bound.template.front[0] as TextLayer).text).toBe('Assedio v0.3 · Luca')
    }
    // con il solo nome restano vuoti
    const bound = bindCard(t, rowToCard([], []), { system: projectSystem('Assedio') })
    expect((bound.template.front[0] as TextLayer).text).toBe('Assedio v · ')
  })
})
