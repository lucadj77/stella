import { describe, expect, it } from 'vitest'
import { findMatches, replaceAll, replaceMatches } from '../findReplace'

describe('cerca e sostituisci', () => {
  const text = 'Il Re pesca. Il re regola le carte; RE!'

  it('senza opzioni non bada alle maiuscole', () => {
    expect(findMatches(text, 're').map((m) => text.slice(m.from, m.to))).toEqual([
      'Re',
      're',
      're',
      'RE'
    ])
  })

  it('con le maiuscole trova solo il testo uguale', () => {
    expect(findMatches(text, 're', { matchCase: true })).toHaveLength(2)
  })

  it('la parola intera salta le parti di parola, anche con le lettere accentate', () => {
    expect(findMatches(text, 're', { wholeWord: true })).toHaveLength(3)
    expect(findMatches('città cit', 'cit', { wholeWord: true })).toEqual([{ from: 6, to: 9 }])
  })

  it('una ricerca vuota non trova niente', () => {
    expect(findMatches(text, '')).toEqual([])
  })

  it('le occorrenze non si sovrappongono', () => {
    expect(findMatches('aaaa', 'aa')).toEqual([
      { from: 0, to: 2 },
      { from: 2, to: 4 }
    ])
  })

  it('sostituisce le occorrenze scelte o tutte', () => {
    const m = findMatches(text, 're', { wholeWord: true })
    expect(replaceMatches(text, [m[1]], 'Mago')).toBe('Il Re pesca. Il Mago regola le carte; RE!')
    expect(replaceAll(text, 're', 'Mago', { wholeWord: true })).toBe(
      'Il Mago pesca. Il Mago regola le carte; Mago!'
    )
    // il testo nuovo può contenere quello cercato
    expect(replaceAll('a b a', 'a', 'aa')).toBe('aa b aa')
  })
})
