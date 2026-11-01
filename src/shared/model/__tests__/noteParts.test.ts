import { describe, expect, it } from 'vitest'
import { noteParts } from '../noteParts'

describe('noteParts', () => {
  it('separa le tabelle dal testo', () => {
    const parts = noteParts('# Idee\n\nPrima\n\n| A | B |\n|---|:-:|\n| 1 | 2 |\n\nDopo')
    expect(parts.map((p) => p.kind)).toEqual(['text', 'table', 'text'])
    expect(parts[0]).toEqual({ kind: 'text', text: '# Idee\n\nPrima' })
    const t = parts[1].kind === 'table' ? parts[1].table : null
    expect(t?.header).toEqual(['A', 'B'])
    expect(t?.rows).toEqual([['1', '2']])
    expect(t?.align).toEqual([null, 'center'])
    expect(parts[2]).toEqual({ kind: 'text', text: 'Dopo' })
  })

  it('una nota senza tabelle resta un solo testo', () => {
    expect(noteParts('ciao\n\n- uno')).toEqual([{ kind: 'text', text: 'ciao\n\n- uno' }])
  })

  it('una nota vuota non ha pezzi', () => {
    expect(noteParts('  \n')).toEqual([])
  })
})
