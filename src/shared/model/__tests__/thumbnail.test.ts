import { describe, expect, it } from 'vitest'
import { normalizeTemplate } from '../normalize'
import { thumbnailTemplate } from '../thumbnail'
import type { ImageLayer, TextLayer } from '../template'
import type { LoadedProject, ProjectCover } from '../../project'

const tpl = normalizeTemplate({
  name: 'carta',
  width: 63,
  height: 88,
  front: [{ type: 'text', name: 'nome', text: '{nome}' }],
  back: [{ type: 'text', name: 'dorso', text: 'retro {nome}', source: { kind: 'fixed' } }]
})

function project(cover?: ProjectCover): LoadedProject {
  const data = { name: 'Unità', headers: ['nome'], rows: [['Fante'], ['Arciere']] }
  return {
    folder: '/tmp/p',
    file: { formatVersion: 1, name: 'P', dataFile: 'data/cards.xlsx', sets: [], cover },
    sets: [{ name: 'Unità', template: 'carta', data }],
    templates: [tpl],
    assets: ['scatola.png'],
    fonts: [],
    unusedSheets: [],
    unusedData: []
  } as unknown as LoadedProject
}

const text = (t: ReturnType<typeof thumbnailTemplate>): string => (t!.front[0] as TextLayer).text

describe('copertina del progetto', () => {
  it('di base è la prima carta del primo set', () => {
    expect(text(thumbnailTemplate(project()))).toBe('Fante')
  })

  it('può essere una riga scelta, anche dal retro', () => {
    expect(text(thumbnailTemplate(project({ set: 'Unità', row: 2 })))).toBe('Arciere')
    expect(text(thumbnailTemplate(project({ set: 'Unità', row: 2, side: 'back' })))).toBe(
      'retro Arciere'
    )
    // una riga che non c'è più diventa l'ultima; un set che non c'è più, la copertina di base
    expect(text(thumbnailTemplate(project({ set: 'Unità', row: 9 })))).toBe('Arciere')
    expect(text(thumbnailTemplate(project({ set: 'Altro', row: 1 })))).toBe('Fante')
  })

  it('può essere un componente scritto come nei documenti', () => {
    expect(text(thumbnailTemplate(project({ card: 'Unità/2' })))).toBe('Arciere')
    expect(text(thumbnailTemplate(project({ card: 'Unità/nome=Arciere?side=back' })))).toBe(
      'retro Arciere'
    )
    expect(text(thumbnailTemplate(project({ card: 'Unità/nome=Mago' })))).toBe('Fante')
  })

  it("può essere un'immagine, con la sua proporzione", () => {
    const t = thumbnailTemplate(project({ image: 'scatola.png' }), 2)!
    expect([t.width, t.height]).toEqual([100, 50])
    const img = t.front[0] as ImageLayer
    expect([img.src, img.fit, img.w, img.h]).toEqual(['scatola.png', 'contain', 100, 50])
    // il nome breve, come nei livelli immagine
    expect((thumbnailTemplate(project({ image: 'scatola' }), 2)!.front[0] as ImageLayer).src).toBe(
      'scatola.png'
    )
    // un'immagine tolta dal progetto lascia la copertina di base
    expect(text(thumbnailTemplate(project({ image: 'logo.png' })))).toBe('Fante')
  })
})
