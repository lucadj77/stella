import { describe, expect, it } from 'vitest'
import type { LoadedSet, ProjectFile } from '../../../shared/project'
import type { Template } from '../../../shared/model/template'
import { describeStep, futureAfter, futureBefore, stateAfter, type HistoryEntry } from '../history'

const tpl = (layers: object[], extra: object = {}): Template =>
  ({ name: 'carta', width: 63, height: 88, front: layers, back: [], ...extra }) as Template
const text = (id: string, name: string, more: object = {}): object => ({
  id,
  type: 'text',
  name,
  x: 0,
  y: 0,
  ...more
})
const file = { sets: [] } as unknown as ProjectFile
const set = (name: string, rows: string[][]): LoadedSet =>
  ({ name, template: 'carta', data: { name, headers: ['nome', 'forza'], rows } }) as LoadedSet

describe('cronologia', () => {
  it('descrive un livello modificato nel template, con le proprietà', () => {
    const a = tpl([text('1', 'titolo')])
    const b = tpl([text('1', 'titolo', { x: 5, size: 12 })])
    const e: HistoryEntry = {
      sets: [],
      file,
      templates: [a],
      tplOnly: true,
      where: { kind: 'template', name: 'carta' }
    }
    expect(describeStep(e, { sets: [], file, templates: [b] })).toEqual({
      key: 'history.layerChanged',
      params: { tpl: 'carta', layers: 'titolo', props: 'x,size' }
    })
  })

  it('descrive livelli aggiunti ed eliminati e le proprietà del template', () => {
    const a = tpl([text('1', 'titolo')])
    const b = tpl([text('1', 'titolo'), text('2', 'testo')])
    const where = { kind: 'template', name: 'carta' } as const
    const add = describeStep(
      { sets: [], file, templates: [a], tplOnly: true, where },
      { sets: [], file, templates: [b] }
    )
    expect(add).toMatchObject({ key: 'history.layerAdded', params: { layers: 'testo' } })
    const del = describeStep(
      { sets: [], file, templates: [b], tplOnly: true, where },
      { sets: [], file, templates: [a] }
    )
    expect(del).toMatchObject({ key: 'history.layerRemoved', params: { layers: 'testo' } })
    const own = describeStep(
      { sets: [], file, templates: [a], tplOnly: true, where },
      { sets: [], file, templates: [{ ...a, bleed: 3 }] }
    )
    expect(own).toMatchObject({ key: 'history.templateProps', params: { props: 'bleed' } })
  })

  it('descrive celle, righe e set', () => {
    const before = set('eroi', [['Ada', '3']])
    const cell = set('eroi', [['Ada', '4']])
    const rows = set('eroi', [
      ['Ada', '3'],
      ['Bo', '1']
    ])
    expect(describeStep({ sets: [before], file }, { sets: [cell], file, templates: [] })).toEqual({
      key: 'history.cell',
      params: { set: 'eroi', row: 1, col: 'forza' }
    })
    expect(
      describeStep({ sets: [before], file }, { sets: [rows], file, templates: [] })
    ).toMatchObject({ key: 'history.rowsAdded', params: { n: 1 } })
    expect(
      describeStep({ sets: [], file }, { sets: [before], file, templates: [] })
    ).toMatchObject({ key: 'history.setAdded', params: { set: 'eroi' } })
  })

  it('confronta ogni passo con quello dopo, e l’ultimo con lo stato attuale', () => {
    const s0 = set('eroi', [['Ada', '1']])
    const s1 = set('eroi', [['Ada', '2']])
    const s2 = set('eroi', [['Ada', '3']])
    const past: HistoryEntry[] = [
      { sets: [s0], file },
      { sets: [s1], file }
    ]
    const now = { sets: [s2], file, templates: [] }
    expect(stateAfter(past, 0, now).sets).toEqual([s1])
    expect(stateAfter(past, 1, now)).toBe(now)
    // passi annullati: in fondo il primo da ripristinare, che parte dallo stato attuale
    const future: HistoryEntry[] = [
      { sets: [s2], file },
      { sets: [s1], file }
    ]
    const cur = { sets: [s0], file, templates: [] }
    expect(futureBefore(future, 1, cur).sets).toEqual([s0])
    expect(futureBefore(future, 0, cur).sets).toEqual([s1])
    expect(futureAfter(future[0], cur).sets).toEqual([s2])
  })
})
