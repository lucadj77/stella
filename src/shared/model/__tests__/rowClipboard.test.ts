import { describe, expect, it } from 'vitest'
import { copyRows, lostColumns, parseCopiedRows, pasteRows, rowsToTsv } from '../rowClipboard'

const sheet = {
  name: 'carte',
  headers: ['amount', 'name', 'text'],
  rows: [
    ['1', 'Goblin', 'Colpisce'],
    ['2', 'Orco', 'Riga\ncon "virgolette"'],
    ['1', 'Troll']
  ]
}

describe('copia e incolla di componenti', () => {
  it('copia le righe scelte nell’ordine del foglio, completando le celle mancanti', () => {
    expect(copyRows(sheet, [2, 0])).toEqual({
      headers: ['amount', 'name', 'text'],
      rows: [
        ['1', 'Goblin', 'Colpisce'],
        ['1', 'Troll', '']
      ]
    })
  })

  it('scrive il testo a tabulazioni con le intestazioni e le virgolette dove servono', () => {
    expect(rowsToTsv(copyRows(sheet, [1]))).toBe(
      'amount\tname\ttext\n2\tOrco\t"Riga\ncon ""virgolette"""'
    )
  })

  it('rilegge solo il JSON delle righe', () => {
    const c = copyRows(sheet, [0])
    expect(parseCopiedRows(JSON.stringify(c))).toEqual(c)
    expect(parseCopiedRows('{"headers":[1]}')).toBeNull()
    expect(parseCopiedRows('ciao')).toBeNull()
  })

  it('incolla per nome di colonna nella posizione data', () => {
    const other = {
      name: 'mostri',
      headers: ['name', 'power', 'amount'],
      rows: [['Drago', '9', '1']]
    }
    const { sheet: out, added } = pasteRows(other, copyRows(sheet, [0, 1]), 1)
    expect(out.rows).toEqual([
      ['Drago', '9', '1'],
      ['Goblin', '', '1'],
      ['Orco', '', '2']
    ])
    expect(added).toEqual([1, 2])
    expect(lostColumns(other, copyRows(sheet, [0]))).toEqual(['text'])
  })
})
