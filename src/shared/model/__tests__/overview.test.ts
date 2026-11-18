import { describe, expect, it } from 'vitest'
import { normalizeTemplate } from '../normalize'
import { imageUsages } from '../imageUsage'
import { copyName, countCards, definitionUsages, firstLine, usesIndex, usesOf } from '../overview'

const tpl = normalizeTemplate({
  name: 'carta',
  width: 63,
  height: 88,
  front: [
    { type: 'text', name: 'testo', text: 'Paga 2 {oro}' },
    { type: 'image', name: 'arte', src: 'drago' },
    { type: 'text', name: 'titolo', text: '[x]{.titolo}' }
  ],
  back: []
})

const project = {
  templates: [tpl],
  sets: [
    {
      name: 'Mercato',
      template: 'carta',
      data: {
        name: 'Mercato',
        headers: ['amount', 'testo'],
        rows: [
          ['2', 'prendi {rosso}'],
          ['1', 'niente']
        ]
      }
    }
  ],
  variables: {
    oro: { type: 'image' as const, src: 'oro' },
    rosso: { type: 'color' as const, color: '#A00' },
    libero: { type: 'value' as const, value: '3' }
  },
  styles: { titolo: 'weight=800', nota: 'italic' },
  documents: [{ name: 'Regole', text: '# Regole\n\nOgni {oro} vale [uno]{.nota}.' }]
}

describe('gestisci il progetto', () => {
  const vars = definitionUsages(project, 'variable', Object.keys(project.variables))
  const styles = definitionUsages(project, 'style', Object.keys(project.styles))

  it('trova gli usi anche nei documenti', () => {
    expect(vars.get('oro')!.documents).toEqual(['Regole'])
    expect(vars.get('oro')!.templates.map((x) => x.name)).toEqual(['carta'])
    expect(vars.get('rosso')!.sets.map((x) => x.name)).toEqual(['Mercato'])
    expect(vars.get('libero')!.documents).toEqual([])
    expect(styles.get('nota')!.documents).toEqual(['Regole'])
  })

  it('al contrario: cosa usa ogni template, set e documento', () => {
    const images = imageUsages({ ...project, assets: ['drago.png', 'oro.png'] })
    const idx = usesIndex(vars, styles, images)
    expect(usesOf(idx.templates, 'carta')).toEqual({
      variables: ['oro'],
      styles: ['titolo'],
      // anche l'immagine della variabile {oro}
      images: ['drago.png', 'oro.png']
    })
    expect(usesOf(idx.sets, 'Mercato').variables).toContain('rosso')
    expect(usesOf(idx.documents, 'Regole')).toEqual({
      variables: ['oro'],
      styles: ['nota'],
      images: ['oro.png']
    })
    expect(usesOf(idx.documents, 'Altro')).toEqual({ variables: [], styles: [], images: [] })
  })

  it('nomi liberi per le copie', () => {
    expect(copyName('oro', ['oro'], '-')).toBe('oro-2')
    expect(copyName('oro-2', ['oro', 'oro-2', 'ORO-3'], '-')).toBe('oro-4')
    expect(copyName('Mazzo', ['Mazzo', 'Mazzo 2'])).toBe('Mazzo 3')
  })

  it("l'inizio di un testo, senza markup", () => {
    expect(firstLine('# Titolo\n\nUn [testo]{.nota} con ![](img.png) immagine')).toBe(
      'Titolo Un testo con immagine'
    )
    expect(firstLine('a'.repeat(200), 10)).toBe('aaaaaaaaa…')
  })

  it('conta le carte con la colonna amount', () => {
    expect(countCards(project.sets[0].data)).toBe(3)
  })
})
