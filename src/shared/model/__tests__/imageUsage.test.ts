import { describe, expect, it } from 'vitest'
import { normalizeTemplate } from '../normalize'
import {
  cleanFolder,
  groupByTemplate,
  imageUsages,
  isUnusedImage,
  matchesFilter,
  movedRefs,
  retargetImageRefs
} from '../imageUsage'

const eroe = normalizeTemplate({
  name: 'Eroe',
  width: 63,
  height: 88,
  front: [
    { type: 'image', name: 'cornice', src: 'cornice' },
    { type: 'image', name: 'ritratto', src: '' },
    { type: 'text', name: 'testo', text: 'Paga {oro}' },
    { type: 'text', name: 'nota', text: '[x]{bg=nuvola}' }
  ],
  back: []
})
const mostro = normalizeTemplate({
  name: 'Mostro',
  width: 63,
  height: 88,
  front: [{ type: 'image', name: 'figura', src: '' }],
  back: []
})

const assets = [
  'images/cornice.png',
  'images/mago.png',
  'images/guerriero.png',
  'images/orco.png',
  'icons/moneta.svg',
  'images/nuvola.png',
  'images/regole.png',
  'images/scatola.png',
  'images/vecchia.png',
  'fonts/x.ttf'
]

const project = {
  templates: [eroe, mostro],
  sets: [
    {
      name: 'Eroi',
      template: 'Eroe',
      data: {
        name: 'Eroi',
        headers: ['amount', 'ritratto'],
        rows: [
          ['1', 'mago'],
          ['1', 'images/guerriero']
        ]
      }
    },
    {
      name: 'Mostri',
      template: 'Mostro',
      data: { name: 'Mostri', headers: ['amount', 'figura'], rows: [['2', 'orco']] }
    }
  ],
  documents: [{ name: 'Regolamento', text: '# Regole\n![Scatola](regole?width=50)\nCosta {oro}' }],
  assets,
  variables: { oro: { type: 'image' as const, src: 'moneta' } },
  styles: {},
  cover: { image: 'scatola' }
}

describe('dove sono usate le immagini', () => {
  const u = imageUsages(project)

  it('solo le immagini, non i font', () => {
    expect([...u.keys()]).not.toContain('fonts/x.ttf')
  })

  it('nei template, anche con bg= e con una variabile immagine', () => {
    expect(u.get('images/cornice.png')!.templates).toEqual(['Eroe'])
    expect(u.get('images/nuvola.png')!.templates).toEqual(['Eroe'])
    expect(u.get('icons/moneta.svg')!).toMatchObject({
      templates: ['Eroe'],
      documents: ['Regolamento'],
      variables: ['oro']
    })
  })

  it('solo nei set, scelte dalle colonne', () => {
    expect(u.get('images/mago.png')!).toMatchObject({ templates: [], sets: ['Eroi'] })
    expect(u.get('images/guerriero.png')!.sets).toEqual(['Eroi'])
    expect(matchesFilter(u.get('images/orco.png')!, 'sets')).toBe(true)
    expect(matchesFilter(u.get('images/cornice.png')!, 'sets')).toBe(false)
  })

  it('nei documenti, nella copertina, non usate', () => {
    expect(u.get('images/regole.png')!.documents).toEqual(['Regolamento'])
    expect(u.get('images/scatola.png')!.cover).toBe(true)
    expect(isUnusedImage(u.get('images/vecchia.png')!)).toBe(true)
    expect(isUnusedImage(u.get('images/scatola.png')!)).toBe(false)
  })

  it('raggruppa per template le immagini di un solo template', () => {
    expect(groupByTemplate(u, project.templates, project.sets)).toEqual([
      { path: 'images/cornice.png', folder: 'images/Eroe' },
      { path: 'images/guerriero.png', folder: 'images/Eroe' },
      { path: 'images/mago.png', folder: 'images/Eroe' },
      { path: 'images/nuvola.png', folder: 'images/Eroe' },
      { path: 'images/orco.png', folder: 'images/Mostro' }
    ])
  })
})

describe('spostamenti', () => {
  it('riscrive i riferimenti con la cartella, non quelli con il solo nome', () => {
    const r = retargetImageRefs(
      {
        templates: project.templates,
        sets: project.sets,
        documents: [{ name: 'D', text: '![a](assets/images/guerriero.png) images/guerriero-2' }],
        variables: {},
        styles: {}
      },
      movedRefs([
        { from: 'images/guerriero.png', to: 'images/Eroe/guerriero.png' },
        { from: 'images/mago.png', to: 'images/Eroe/mago.png' }
      ])
    )
    expect(r.count).toBe(2)
    expect(r.sets[0].data!.rows).toEqual([
      ['1', 'mago'],
      ['1', 'images/Eroe/guerriero']
    ])
    expect(r.sets[1]).toBe(project.sets[1])
    expect(r.templates).toBe(project.templates)
    expect(r.documents[0].text).toBe('![a](assets/images/Eroe/guerriero.png) images/guerriero-2')
  })

  it("cartelle scritte dall'utente", () => {
    expect(cleanFolder(' images / Eroi ')).toBe('images/Eroi')
    expect(cleanFolder('')).toBe('')
    expect(cleanFolder('../x')).toBeNull()
    expect(cleanFolder('a:b')).toBeNull()
  })
})

describe('cartella delle immagini nuove', () => {
  it('di base images, altrimenti la cartella scelta, ripulita', async () => {
    const { imagesTarget } = await import('../imageUsage')
    expect(imagesTarget(undefined)).toBe('images')
    expect(imagesTarget('  ')).toBe('images')
    expect(imagesTarget('images\\eroi/ ')).toBe('images/eroi')
    expect(() => imagesTarget('../fuori')).toThrow()
  })
})
