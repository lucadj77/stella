import { describe, expect, it } from 'vitest'
import { bindCard, rowToCard } from '../bind'
import {
  localizationOf,
  missingTranslationColumns,
  projectLanguages,
  splitLanguage,
  translatedCells
} from '../language'
import { normalizeTemplate } from '../normalize'
import { addColumn, textColumns } from '../sheet'
import type { ImageLayer, TextLayer } from '../template'
import { buildSets } from '../../exportJob'
import type { LoadedProject } from '../../project'

const template = normalizeTemplate({
  name: 't',
  labelField: 'nome',
  front: [
    { type: 'text', name: 'nome', text: 'x' },
    { type: 'text', name: 'testo', text: '{nome}: {effetto}' },
    { type: 'value', name: 'tipo', value: '' },
    {
      type: 'text',
      name: 'etichetta',
      text: '',
      source: { kind: 'formula', expr: '=IF({tipo}="Attacco";"A";"D")' }
    },
    {
      type: 'text',
      name: 'titolo',
      text: '',
      source: { kind: 'formula', expr: '{nome} ({tipo})' }
    },
    { type: 'text', name: 'set', text: '{set.name}' },
    { type: 'image', name: 'icona', src: 'spada' },
    // il nome del file non si traduce
    { type: 'image', name: 'ritratto', src: '{nome}', source: { kind: 'fixed' } }
  ]
})

const headers = ['nome', 'nome@en', 'effetto', 'effetto@en', 'tipo', 'tipo@en', 'icona.src@en']
const row = ['Drago', 'Dragon', 'Brucia', '', 'Attacco', 'Attack', 'sword']

const texts = (l: { front: unknown[] }): Record<string, string> =>
  Object.fromEntries(
    (l.front as (TextLayer | ImageLayer)[]).map((x) => [x.name, x.type === 'text' ? x.text : x.src])
  )

describe('lingue', () => {
  it('riconosce le colonne tradotte', () => {
    expect(splitLanguage('nome@en')).toEqual({ base: 'nome', language: 'en' })
    expect(splitLanguage('img.src@pt-BR')).toEqual({ base: 'img.src', language: 'pt-BR' })
    expect(splitLanguage('mail@Example')).toEqual({ base: 'mail@Example', language: null })
    expect(splitLanguage('@en')).toEqual({ base: '@en', language: null })
    expect(translatedCells({ nome: 'a', 'nome@en': 'b', 'x@en': '', 'y@fr': 'c' }, 'en')).toEqual({
      nome: 'b'
    })
  })

  it('una lingua sola non conta come progetto in più lingue', () => {
    expect(projectLanguages({ languages: ['it'] })).toEqual([])
    expect(projectLanguages({ languages: ['it', 'en', 'it', 'XX'] })).toEqual(['it', 'en'])
    expect(localizationOf({ languages: ['it', 'en'] }, [], 'it')).toBeUndefined()
    expect(
      localizationOf(
        { languages: ['it', 'en'], names: { en: 'Siege' } },
        [{ name: 'Eroi', names: { en: 'Heroes' } }],
        'en'
      )
    ).toEqual({ language: 'en', project: 'Siege', sets: { Eroi: 'Heroes' } })
  })

  it('nella lingua principale le colonne tradotte non contano', () => {
    const bound = bindCard(template, rowToCard(headers, row), { system: { set: 'Eroi' } })
    expect(bound.problems).toEqual([])
    expect(texts(bound.template)).toMatchObject({
      nome: 'Drago',
      testo: 'Drago: Brucia',
      etichetta: 'A',
      titolo: 'Drago (Attacco)',
      icona: 'spada'
    })
    expect(bound.label).toBe('Drago')
  })

  it('nella lingua scelta valgono le celle tradotte; le formule con = la principale', () => {
    const bound = bindCard(template, rowToCard(headers, row), {
      system: { set: 'Eroi' },
      localization: { language: 'en', sets: { Eroi: 'Heroes' } }
    })
    expect(bound.problems).toEqual([])
    expect(texts(bound.template)).toMatchObject({
      nome: 'Dragon',
      // cella tradotta vuota: il testo della lingua principale
      testo: 'Dragon: Brucia',
      // la condizione confronta il valore italiano
      etichetta: 'A',
      titolo: 'Dragon (Attack)',
      set: 'Heroes',
      icona: 'sword',
      ritratto: 'Drago'
    })
    expect(bound.label).toBe('Dragon')
  })

  it('aggiunge le colonne da tradurre accanto alla loro', () => {
    const sheet = {
      name: 's',
      headers: ['nome', 'nome.size', 'testo', 'amount', 'effetto'],
      rows: [['a', '', 'b', '1', '3']]
    }
    // effetto ha solo numeri: non si traduce
    const cols = missingTranslationColumns(sheet, 'en', textColumns(template))
    expect(cols).toEqual(['nome@en', 'testo@en'])
    const out = addColumn(addColumn(sheet, 'nome@en'), 'nome@fr')
    expect(out.headers).toEqual([
      'nome',
      'nome.size',
      'nome@en',
      'nome@fr',
      'testo',
      'amount',
      'effetto'
    ])
    expect(out.rows[0]).toEqual(['a', '', '', '', 'b', '1', '3'])
  })

  it('esporta nella lingua scelta, con i campi tradotti per i nomi dei file', () => {
    const project = {
      folder: '/p',
      file: {
        formatVersion: 1,
        name: 'Assedio',
        dataFile: 'd.xlsx',
        languages: ['it', 'en'],
        names: { en: 'Siege' },
        sets: [{ name: 'Eroi', template: 't', names: { en: 'Heroes' } }]
      },
      sets: [
        {
          name: 'Eroi',
          template: 't',
          names: { en: 'Heroes' },
          data: { name: 'Eroi', headers, rows: [row] }
        }
      ],
      templates: [template],
      assets: [],
      fonts: [],
      sources: {},
      notes: [],
      unusedSheets: [],
      unusedData: [],
      warnings: []
    } as unknown as LoadedProject
    const [main] = buildSets(project, [])
    const [en] = buildSets(project, [], 'en')
    // i file hanno gli stessi nomi in ogni lingua: cambia la cartella
    expect(en.name).toBe('Eroi')
    expect(main.cards[0].fields.nome).toBe('Drago')
    expect(en.cards[0].fields.nome).toBe('Dragon')
    expect(en.cards[0].label).toBe('Dragon')
    expect(texts(en.cards[0].template).set).toBe('Heroes')
  })
})
