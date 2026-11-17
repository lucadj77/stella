import { describe, expect, it } from 'vitest'
import { normalizeTemplate } from '../normalize'
import { resolveTemplates } from '../inherit'
import { collectPackage, findConflicts, parseManifest, planImport } from '../package'

const base = normalizeTemplate({
  name: 'Base',
  width: 63,
  height: 88,
  front: [{ type: 'image', name: 'cornice', src: 'cornice' }],
  back: []
})
const eroe = normalizeTemplate({
  name: 'Eroe',
  width: 63,
  height: 88,
  front: [
    { type: 'image', name: 'cornice', src: 'cornice' },
    { type: 'image', name: 'ritratto', src: '' },
    { type: 'text', name: 'testo', text: 'Paga {oro} [x]{.titolo}', font: 'Lora' }
  ],
  back: []
})
const derived = normalizeTemplate({ name: 'Eroe raro', extends: 'Eroe', changes: {} } as never)
const altro = normalizeTemplate({
  name: 'Altro',
  width: 63,
  height: 88,
  front: [{ type: 'image', name: 'x', src: 'scatola' }],
  back: []
})
const templates = resolveTemplates([base, eroe, derived, altro]).templates

const project = {
  templates,
  sets: [
    {
      name: 'Eroi',
      template: 'Eroe',
      seed: 7,
      data: {
        name: 'Eroi',
        headers: ['amount', 'ritratto', 'template'],
        rows: [
          ['1', 'mago', ''],
          ['1', 'guerriero', 'Eroe raro']
        ]
      }
    },
    { name: 'Altri', template: 'Altro', data: { name: 'Altri', headers: [], rows: [] } }
  ],
  assets: [
    'images/cornice.png',
    'images/mago.png',
    'images/guerriero.png',
    'images/scatola.png',
    'icons/moneta.svg',
    'fonts/Lora/Lora-Regular.ttf',
    'fonts/Inter.ttf'
  ],
  fonts: [
    {
      path: 'fonts/Lora/Lora-Regular.ttf',
      family: 'Lora',
      weight: '400',
      style: 'normal' as const
    },
    { path: 'fonts/Inter.ttf', family: 'Inter', weight: '400', style: 'normal' as const }
  ],
  sources: {
    'icons/moneta.svg': { kind: 'icon', source: 's', license: 'CC0-1.0', title: 'm', id: 'm' }
  },
  variables: {
    oro: { type: 'image' as const, src: 'moneta' },
    ricco: { type: 'text' as const, text: 'molto {oro}' },
    rosso: { type: 'color' as const, color: '#A00' }
  },
  styles: { titolo: 'weight=800 color=rosso', sotto: 'italic' }
} as never as Parameters<typeof collectPackage>[0]

describe('pacchetti', () => {
  it('un template: immagini, font, variabili e stili che usa, anche indirettamente', () => {
    const m = collectPackage(project, { kind: 'template', name: 'Eroe' })
    expect(m.templates.map((t) => t.name)).toEqual(['Eroe'])
    expect(m.sets).toEqual([])
    expect(m.assets).toEqual([
      'fonts/Lora/Lora-Regular.ttf',
      'icons/moneta.svg',
      'images/cornice.png'
    ])
    expect(Object.keys(m.variables)).toEqual(['oro', 'rosso'])
    expect(Object.keys(m.styles)).toEqual(['titolo'])
    expect(Object.keys(m.sources)).toEqual(['icons/moneta.svg'])
  })

  it('un set: dati, template, quelli della colonna template con il loro base, immagini delle carte', () => {
    const m = collectPackage(project, { kind: 'set', name: 'Eroi' })
    expect(m.templates.map((t) => t.name)).toEqual(['Eroe', 'Eroe raro'])
    expect(m.templates[1]).toMatchObject({ extends: 'Eroe' })
    expect(m.sets[0].definition).toEqual({ name: 'Eroi', template: 'Eroe', seed: 7 })
    expect(m.sets[0].sheet.rows.length).toBe(2)
    expect(m.assets).toContain('images/mago.png')
    expect(m.assets).toContain('images/guerriero.png')
    expect(m.assets).not.toContain('images/scatola.png')
    expect(parseManifest(JSON.parse(JSON.stringify(m)))).toEqual(m)
  })

  it('importazione: conflitti e scelte', () => {
    const m = collectPackage(project, { kind: 'set', name: 'Eroi' })
    const target = {
      templates: resolveTemplates([
        normalizeTemplate({ name: 'Eroe', width: 50, height: 50, front: [], back: [] })
      ]).templates,
      sets: [{ name: 'Eroi' }],
      assets: ['images/cornice.png', 'altre/mago.svg', 'images/guerriero.png'],
      variables: { oro: { type: 'image' as const, src: 'altro' } },
      styles: { titolo: 'weight=800 color=rosso' }
    }
    const conflicts = findConflicts(m, target, (a) => a === 'images/guerriero.png')
    expect(conflicts.map((c) => `${c.kind}:${c.name}:${c.existing ?? ''}`)).toEqual([
      'template:Eroe:',
      'set:Eroi:',
      'variable:oro:',
      'asset:images/cornice.png:images/cornice.png',
      'asset:images/mago.png:altre/mago.svg'
    ])
    // proposte: tieni entrambi i template e i set, tieni variabili e file del progetto
    const plan = planImport(m, target, conflicts, {})
    expect(plan.templates.map((t) => [t.raw.name, t.raw.extends ?? ''])).toEqual([
      ['Eroe 2', ''],
      ['Eroe raro', 'Eroe 2']
    ])
    expect(plan.sets[0].set.definition).toMatchObject({ name: 'Eroi 2', template: 'Eroe 2' })
    expect(plan.sets[0].set.sheet.rows[1][2]).toBe('Eroe raro')
    expect(plan.variables).toEqual({ rosso: { type: 'color', color: '#A00' } })
    // i file uguali o con lo stesso nome restano quelli del progetto; gli altri si copiano
    expect(plan.files.map((f) => f.to)).toEqual(['fonts/Lora/Lora-Regular.ttf', 'icons/moneta.svg'])
    expect(plan.renamed).toEqual([
      { kind: 'template', from: 'Eroe', to: 'Eroe 2' },
      { kind: 'set', from: 'Eroi', to: 'Eroi 2' }
    ])
    // sostituire: il file prende il posto di quello del progetto, l'altro va nel cestino
    const replace = planImport(m, target, conflicts, {
      'template:Eroe': 'replace',
      'set:Eroi': 'keep',
      'variable:oro': 'replace',
      'asset:images/mago.png': 'replace'
    })
    expect(replace.templates[0]).toMatchObject({ raw: { name: 'Eroe' }, replace: true })
    expect(replace.sets).toEqual([])
    expect(replace.variables.oro).toEqual({ type: 'image', src: 'moneta' })
    expect(replace.files).toContainEqual({
      from: 'images/mago.png',
      to: 'altre/mago.png',
      replaces: 'altre/mago.svg'
    })
  })
})
