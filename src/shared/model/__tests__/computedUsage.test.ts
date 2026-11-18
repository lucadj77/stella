import { describe, expect, it } from 'vitest'
import { normalizeTemplate } from '../normalize'
import { definitionUsages } from '../overview'
import { isUnused } from '../usages'

const tpl = normalizeTemplate({
  name: 'carta',
  width: 63,
  height: 88,
  front: [
    { type: 'value', name: 'campo', value: 'beta' },
    { type: 'value', name: 'forza', value: '1' },
    { type: 'value', name: 'scelta', value: '=IF({forza}>2;"gamma";"beta")' },
    { type: 'shape', name: 'fondo', fill: '{campo}' },
    { type: 'text', name: 'testo', text: 'ciao' }
  ],
  back: []
})

const project = {
  templates: [tpl],
  sets: [
    {
      name: 'Mazzo',
      template: 'carta',
      data: {
        name: 'Mazzo',
        headers: ['campo', 'forza', 'testo'],
        rows: [
          ['{alfa}', '1', 'uno'],
          ['beta', '1', '# Titolo\nRegola'],
          ['', '3', '> nota']
        ]
      }
    }
  ],
  variables: {
    alfa: { type: 'color' as const, color: '#f00' },
    beta: { type: 'color' as const, color: '#00f' },
    gamma: { type: 'color' as const, color: '#0f0' },
    delta: { type: 'color' as const, color: '#000' },
    regole: { type: 'text' as const, text: '## Regole' }
  },
  styles: {},
  notes: [{ name: 'Appunti', text: '# Idee\n\ntesto' }]
}

describe('usi calcolati', () => {
  const vars = definitionUsages(project, 'variable', Object.keys(project.variables))

  it('una variabile che arriva da un campo, sulle carte che la usano', () => {
    expect(vars.get('alfa')!.sets).toEqual([{ name: 'Mazzo', index: 0, cards: [1] }])
    // «beta» da solo nella cella e come valore predefinito del campo
    expect(vars.get('beta')!.sets[0].cards).toContain(2)
  })

  it('una variabile tra virgolette in una formula', () => {
    expect(vars.get('gamma')!.templates.map((t) => t.name)).toEqual(['carta'])
  })

  it('una variabile mai richiamata resta non usata', () => {
    expect(isUnused(vars.get('delta')!)).toBe(true)
  })

  it('gli stili dei paragrafi con #, ## e >', () => {
    const styles = definitionUsages(project, 'style', ['heading1', 'heading2', 'note'])
    expect(styles.get('heading1')!.sets).toEqual([{ name: 'Mazzo', index: 0, cards: [2] }])
    expect(styles.get('heading1')!.notes).toEqual(['Appunti'])
    expect(styles.get('heading2')!.variables).toEqual(['regole'])
    expect(styles.get('note')!.sets[0].cards).toEqual([3])
  })
})
