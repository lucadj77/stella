import { describe, expect, it } from 'vitest'
import { followInDocuments, followProjectChanges, mapCardRefs, type RefSnapshot } from '../docRefs'
import { normalizeTemplate } from '../normalize'
import type { LoadedSet } from '../../project'
import type { Template } from '../template'

const tpl = normalizeTemplate({
  name: 'edificio',
  front: [
    { type: 'text', name: 'nome', x: 10, y: 10, w: 20, h: 10, size: 10, color: '#000000' },
    { type: 'shape', name: 'sfondo', x: 0, y: 0, w: 63, h: 88 }
  ],
  back: []
})

const set = (name: string, rows: string[][], headers = ['nome', 'costo']): LoadedSet => ({
  name,
  template: 'edificio',
  data: { name, headers, rows }
})

const base: RefSnapshot = {
  sets: [
    set('Edifici base', [
      ['CASERMA', '3'],
      ['TORRE', '2']
    ]),
    set('Eventi', [['PIOGGIA', '0']])
  ],
  templates: [tpl],
  variables: { oro: '#ffcc00' },
  styles: { titolo: 'bold' }
}

const doc = [
  '# Regole',
  '',
  'Costruisci la ![](card:Edifici base/nome=CASERMA?width=30) prima della torre.',
  '',
  '| carta | costo |',
  '| --- | --- |',
  '| ![](card:Edifici base/nome=TORRE) | {oro} [due]{.titolo} |',
  '',
  '```setup',
  'card Edifici%20base/nome=CASERMA 10,10 "La caserma"',
  'deck card:Eventi/1?side=back 40,10 count=5',
  '```',
  '',
  '```anatomy',
  'card: Edifici base/nome=CASERMA',
  '- nome (left): il nome',
  '- sfondo: lo sfondo',
  '```',
  '',
  '```',
  '![](card:Edifici base/nome=CASERMA)',
  '```'
].join('\n')

const withSets = (sets: LoadedSet[]): RefSnapshot => ({ ...base, sets })

describe('riferimenti alle carte nei documenti', () => {
  it('mapCardRefs passa immagini, tabelle, schemi e anatomie ma non il codice', () => {
    const seen: string[] = []
    const r = mapCardRefs(doc, (ref) => {
      seen.push(`${ref.set}/${ref.field ?? ref.row}=${ref.value ?? ''}`)
      return null
    })
    expect(r.text).toBe(doc)
    expect(r.count).toBe(0)
    expect(seen).toEqual([
      'Edifici base/nome=CASERMA',
      'Edifici base/nome=TORRE',
      'Edifici base/nome=CASERMA',
      'Eventi/1=',
      'Edifici base/nome=CASERMA'
    ])
  })

  it('un set rinominato cambia in ogni tipo di riferimento, con le opzioni', () => {
    const after = withSets([{ ...base.sets[0], name: 'Edifici nuovi' }, base.sets[1]])
    const r = followProjectChanges(doc, base, after)
    expect(r.count).toBe(4)
    expect(r.text).toContain('![](card:Edifici nuovi/nome=CASERMA?width=30)')
    expect(r.text).toContain('| ![](card:Edifici nuovi/nome=TORRE) |')
    expect(r.text).toContain('card Edifici%20nuovi/nome=CASERMA 10,10 "La caserma"')
    expect(r.text).toContain('card: Edifici nuovi/nome=CASERMA\n')
    // il blocco di codice resta com'è
    expect(r.text).toContain('```\n![](card:Edifici base/nome=CASERMA)\n```')
  })

  it('spostare i set non è una rinomina', () => {
    const r = followProjectChanges(doc, base, withSets([base.sets[1], base.sets[0]]))
    expect(r.text).toBe(doc)
  })

  it('il valore cambiato di una carta segue nei riferimenti', () => {
    const s = base.sets[0]
    const after = withSets([
      { ...s, data: { ...s.data!, rows: [['CASERMA2', '3'], s.data!.rows[1]] } },
      base.sets[1]
    ])
    const r = followProjectChanges(doc, base, after)
    expect(r.count).toBe(3)
    expect(r.text).toContain('card:Edifici base/nome=CASERMA2?width=30')
    expect(r.text).toContain('card Edifici%20base/nome=CASERMA2 10,10')
    expect(r.text).toContain('card: Edifici base/nome=CASERMA2')
    expect(r.text).toContain('nome=TORRE')
  })

  it("se un'altra carta ha ancora il valore vecchio, il riferimento resta", () => {
    const s = base.sets[0]
    const rows = [
      ['CASERMA', '3'],
      ['TORRE', '2'],
      ['CASERMA', '5']
    ]
    const before = withSets([{ ...s, data: { ...s.data!, rows } }, base.sets[1]])
    const after = withSets([
      { ...s, data: { ...s.data!, rows: [['FORTE', '3'], rows[1], rows[2]] } },
      base.sets[1]
    ])
    expect(followProjectChanges(doc, before, after).text).toBe(doc)
  })

  it('un valore svuotato non cambia il riferimento; le righe tolte nemmeno', () => {
    const s = base.sets[0]
    const empty = withSets([
      { ...s, data: { ...s.data!, rows: [['', '3'], s.data!.rows[1]] } },
      base.sets[1]
    ])
    expect(followProjectChanges(doc, base, empty).text).toBe(doc)
    const fewer = withSets([{ ...s, data: { ...s.data!, rows: [s.data!.rows[1]] } }, base.sets[1]])
    expect(followProjectChanges(doc, base, fewer).text).toBe(doc)
  })

  it('una colonna rinominata cambia nei riferimenti del suo set', () => {
    const s = base.sets[0]
    const after = withSets([
      { ...s, data: { ...s.data!, headers: ['titolo', 'costo'] } },
      base.sets[1]
    ])
    const r = followProjectChanges(doc, base, after)
    expect(r.text).toContain('card:Edifici base/titolo=CASERMA?width=30')
    expect(r.text).toContain('card:Edifici base/titolo=TORRE')
    expect(r.text).toContain('deck card:Eventi/1?side=back')
  })

  it('un livello rinominato cambia nelle anatomie delle carte del suo template', () => {
    const renamed: Template = {
      ...tpl,
      front: tpl.front.map((l) => (l.name === 'sfondo' ? { ...l, name: 'fondo' } : l))
    }
    const r = followProjectChanges(doc, base, { ...base, templates: [renamed] })
    expect(r.count).toBe(1)
    expect(r.text).toContain('- fondo: lo sfondo')
    expect(r.text).toContain('- nome (left): il nome')
  })

  it('variabili e stili rinominati cambiano nel testo', () => {
    const r = followProjectChanges(doc, base, {
      ...base,
      variables: { denaro: '#ffcc00' },
      styles: { grande: 'bold' }
    })
    expect(r.text).toContain('| {denaro} [due]{.grande} |')
  })

  it('i fine riga \\r\\n restano', () => {
    const src = doc.replace(/\n/g, '\r\n')
    const after = withSets([{ ...base.sets[0], name: 'Edifici nuovi' }, base.sets[1]])
    const r = followProjectChanges(src, base, after)
    expect(r.text).toBe(followProjectChanges(doc, base, after).text.replace(/\n/g, '\r\n'))
  })

  it('followInDocuments restituisce solo i documenti cambiati', () => {
    const after = withSets([{ ...base.sets[0], name: 'Edifici nuovi' }, base.sets[1]])
    const r = followInDocuments(
      [
        { name: 'regolamento', text: doc },
        { name: 'vuoto', text: 'niente carte' }
      ],
      base,
      after
    )
    expect(r.changed.map((d) => d.name)).toEqual(['regolamento'])
    expect(r.count).toBe(4)
  })
})
