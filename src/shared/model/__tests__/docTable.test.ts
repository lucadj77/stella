import { describe, expect, it } from 'vitest'
import {
  cellBorders,
  cellParts,
  DEFAULT_TABLE_STYLE,
  parseTableStyle,
  tableStyleSource
} from '../docTable'
import { parseDocument, tableSource } from '../document'

describe('aspetto delle tabelle', () => {
  it('legge e riscrive la riga {table ...}', () => {
    const line =
      '<!-- table width=80% columns=30,70 border=#888888 lines=rows header=none stripes=#f5f5f5 -->'
    const { style, bad } = parseTableStyle(line)
    expect(bad).toEqual([])
    expect(style.width).toBe(80)
    expect(style.columns).toEqual([30, 70])
    expect(style.lines).toBe('rows')
    expect(style.header).toBeNull()
    expect(tableStyleSource(style)).toBe(line)
    expect(tableStyleSource(DEFAULT_TABLE_STYLE)).toBe('')
  })

  it('una larghezza 0 o vuota è una colonna che segue il contenuto', () => {
    const line = '<!-- table columns=0,10,10,10,10,10 -->'
    const { style, bad } = parseTableStyle(line)
    expect(bad).toEqual([])
    expect(style.columns).toEqual([0, 10, 10, 10, 10, 10])
    expect(tableStyleSource(style)).toBe(line)
    expect(parseTableStyle('<!-- table columns=,20 -->').style.columns).toEqual([0, 20])
    expect(parseTableStyle('<!-- table columns=-5,20 -->').bad).toEqual(['columns=-5,20'])
    expect(parseTableStyle('<!-- table columns=a,20 -->').bad).toEqual(['columns=a,20'])
  })

  it('segnala le opzioni che non capisce', () => {
    expect(parseTableStyle('<!-- table width=200 colour=red -->').bad).toEqual([
      'width=200',
      'colour=red'
    ])
  })

  it('il commento sotto la tabella fa parte della tabella', () => {
    const src = tableSource(['a', 'b'], [null, null], [['1', '2']], {
      ...DEFAULT_TABLE_STYLE,
      fill: '#ffffff'
    })
    expect(src.split('\n').pop()).toBe('<!-- table fill=#ffffff -->')
    const [b] = parseDocument(src + '\n\nTesto')
    expect(b.kind === 'table' && b.style.fill).toBe('#ffffff')
    expect(b.kind === 'table' && b.to).toBe(src.length)
  })

  it('divide una cella in testo e immagini', () => {
    expect(cellParts('**Mago** ![](card:Personaggi/1?width=20) fine')).toEqual([
      { kind: 'text', text: '**Mago** ' },
      { kind: 'image', alt: '', src: 'card:Personaggi/1?width=20' },
      { kind: 'text', text: ' fine' }
    ])
  })

  it('linee: solo tra le righe non disegna le verticali', () => {
    expect(cellBorders('rows', 0, 0, 3, 2)).toEqual({
      top: true,
      bottom: true,
      left: false,
      right: false
    })
    expect(cellBorders('outer', 1, 1, 3, 2)).toEqual({
      top: false,
      bottom: false,
      left: false,
      right: true
    })
  })
})
