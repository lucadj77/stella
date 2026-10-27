import { describe, expect, it } from 'vitest'
import { findInProject, replaceInProject, type FindScope } from '../projectFind'
import { normalizeTemplate, walkLayers } from '../normalize'
import { newDerived } from '../inherit'
import type { TextLayer, ValueLayer } from '../template'

const base = normalizeTemplate({
  name: 'edificio',
  front: [
    { type: 'text', name: 'titolo', text: 'Caserma', x: 0, y: 0, w: 20, h: 10 },
    {
      type: 'text',
      name: 'regola',
      text: '',
      x: 0,
      y: 10,
      w: 20,
      h: 10,
      source: { kind: 'formula', expr: '=IF({costo}>2; "Caserma cara"; "")' }
    },
    { type: 'value', name: 'caserma', value: 'caserma' }
  ],
  back: []
})

const scope: FindScope = {
  documents: [{ name: 'regolamento', text: '# Caserma\n\nLa caserma costa 3.\nNiente qui.' }],
  notes: [{ name: 'idee', text: 'caserme da rivedere' }],
  sets: [
    {
      name: 'Edifici',
      template: 'edificio',
      data: {
        name: 'Edifici',
        headers: ['nome', 'template', 'amount'],
        rows: [
          ['Caserma', 'edificio', '1'],
          ['Torre', 'edificio', '1']
        ]
      }
    },
    // stesso foglio: si cerca una volta
    {
      name: 'Edifici bis',
      template: 'edificio',
      data: { name: 'Edifici', headers: ['nome'], rows: [['Caserma']] }
    }
  ],
  templates: [base, newDerived(base, 'edificio2')],
  variables: {
    nota: { type: 'text', text: 'Vedi la caserma' },
    colore: { type: 'color', color: '#caserma' }
  }
}

describe('cerca in tutto il progetto', () => {
  it('trova documenti, note, celle, livelli e variabili ma non i nomi', () => {
    const hits = findInProject(scope, 'caserma')
    expect(hits.map((h) => h.key)).toEqual([
      'document:regolamento:0',
      'document:regolamento:2',
      'cell:Edifici:0:0',
      `layer:edificio:${base.front[0].id}:text`,
      `layer:edificio:${base.front[1].id}:formula`,
      `layer:edificio:${base.front[2].id}:value`,
      'variable:nota'
    ])
  })

  it('con le opzioni di ricerca', () => {
    expect(findInProject(scope, 'Caserma', { matchCase: true })).toHaveLength(4)
    expect(findInProject(scope, 'caserm', { wholeWord: true })).toEqual([])
  })

  it('sostituisce solo i risultati scelti', () => {
    const hits = findInProject(scope, 'caserma')
    const chosen = hits.filter((h) => h.key !== 'document:regolamento:0')
    const r = replaceInProject(scope, chosen, 'Fortezza')
    expect(r.count).toBe(6)
    expect(r.documents).toEqual([
      { name: 'regolamento', text: '# Caserma\n\nLa Fortezza costa 3.\nNiente qui.' }
    ])
    expect(r.notes).toEqual([])
    expect(r.sets[0].data!.rows[0]).toEqual(['Fortezza', 'edificio', '1'])
    expect(r.sets[1]).toBe(scope.sets[1])
    const layers = walkLayers(r.templates[0].front)
    expect((layers[0] as TextLayer).text).toBe('Fortezza')
    expect(layers[1].source).toEqual({
      kind: 'formula',
      expr: '=IF({costo}>2; "Fortezza cara"; "")'
    })
    expect(layers[2].name).toBe('caserma')
    expect((layers[2] as ValueLayer).value).toBe('Fortezza')
    expect(r.variables.nota).toEqual({ type: 'text', text: 'Vedi la Fortezza' })
    expect(r.templates[1]).toBe(scope.templates[1])
  })

  it('niente da sostituire lascia tutto com’è', () => {
    const r = replaceInProject(scope, [], 'x')
    expect(r.count).toBe(0)
    expect(r.sets).toBe(scope.sets)
    expect(r.templates).toBe(scope.templates)
    expect(r.variables).toBe(scope.variables)
  })
})
