import { describe, expect, it } from 'vitest'
import type { LoadedSet, ProjectFile } from '../../project'
import type { Template } from '../template'
import { renameTemplate } from '../renameTemplate'

const tpl = (name: string, extra: Partial<Template> = {}): Template => ({
  name,
  width: 63,
  height: 88,
  bleed: 3,
  safeMargin: 3,
  cornerRadius: 3,
  front: [],
  back: [],
  ...extra
})

function project(): { templates: Template[]; sets: LoadedSet[]; file: ProjectFile } {
  const defs = [
    { name: 'Eroi', template: 'carta' },
    { name: 'Mostri', template: 'mostro' }
  ]
  return {
    templates: [tpl('carta'), tpl('oro', { extends: 'carta' }), tpl('mostro')],
    sets: [
      {
        ...defs[0],
        data: {
          name: 'Eroi',
          headers: ['nome', 'template'],
          rows: [
            ['A', ''],
            ['B', 'oro']
          ]
        }
      },
      {
        ...defs[1],
        data: { name: 'Mostri', headers: ['nome', 'template'], rows: [['C', ' carta ']] }
      }
    ],
    file: {
      formatVersion: 1,
      name: 'Gioco',
      dataFile: 'dati.xlsx',
      sets: defs,
      order: { templates: ['mostro', 'carta', 'oro'] }
    }
  }
}

describe('renameTemplate', () => {
  it('rinomina il template e tutti i punti che lo richiamano', () => {
    const p = project()
    const out = renameTemplate(p, 'carta', 'base')
    expect(out.templates[0]).toMatchObject({ name: 'base', origin: 'carta' })
    expect(out.templates[1].extends).toBe('base')
    expect(out.templates[2]).toBe(p.templates[2])
    expect(out.file.sets.map((d) => d.template)).toEqual(['base', 'mostro'])
    expect(out.sets[0].template).toBe('base')
    expect(out.sets[1].data?.rows).toEqual([['C', 'base']])
    // il set senza riferimenti nella colonna tiene lo stesso foglio
    expect(out.sets[0].data).toBe(p.sets[0].data)
    expect(out.file.order?.templates).toEqual(['mostro', 'base', 'oro'])
  })

  it('il file sul disco resta quello di prima fino al salvataggio', () => {
    const p = project()
    p.templates[0] = tpl('carta', { file: 'vecchio' })
    const a = renameTemplate(p, 'carta', 'nuovo')
    expect(a.templates[0].file).toBeUndefined()
    expect(a.templates[0].origin).toBe('vecchio')
    const b = renameTemplate(a, 'nuovo', 'vecchio')
    expect(b.templates[0].origin).toBeUndefined()
  })
})

describe('renameTemplate e generatore', () => {
  it('rinomina il template nei valori della colonna template delle generazioni salvate', () => {
    const p = project()
    const column = {
      column: 'template',
      values: ['carta', 'oro'],
      sequence: ['carta', 'oro', 'oro'],
      weights: { oro: 2 },
      pick: 1,
      repeat: false,
      ordered: false,
      icons: false,
      separator: '',
      text: 'carta\noro*2'
    }
    const other = { ...column, column: 'nome', text: 'oro' }
    const spec = { columns: [column, other], filter: '', copies: 1 }
    p.sets[0] = { ...p.sets[0], generations: [{ name: 'g', spec, mode: 'append' }] }
    p.file.sets[0] = { ...p.file.sets[0], generator: { spec, from: 0 } }
    const r = renameTemplate(p, 'oro', 'argento')
    const c = r.sets[0].generations![0].spec.columns[0] as typeof column
    expect(c.values).toEqual(['carta', 'argento'])
    expect(c.sequence).toEqual(['carta', 'argento', 'argento'])
    expect(c.weights).toEqual({ argento: 2 })
    expect(c.text).toBe('carta\nargento*2')
    // le altre colonne restano come sono
    expect(r.sets[0].generations![0].spec.columns[1]).toBe(other)
    const f = r.file.sets[0].generator!.spec.columns[0] as typeof column
    expect(f.values).toEqual(['carta', 'argento'])
  })
})
