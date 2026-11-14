import { describe, expect, it } from 'vitest'
import { suggestAt } from '../markupHelp'

const ctx = {
  fields: ['forza', 'nome'],
  assets: ['icons/spada.svg', 'icons/scudo.png'],
  styles: ['keyword']
}
const at = (text: string): ReturnType<typeof suggestAt> =>
  suggestAt(text, text.indexOf('|') < 0 ? text.length : text.indexOf('|'), ctx)
const labels = (text: string): string[] =>
  at(text.replace('|', ''))?.items.map((s) => s.label) ?? []

describe('aiuto alla scrittura del markup', () => {
  it('fuori dalle graffe non propone nulla', () => {
    expect(at('testo [a]{color=red} altro')).toBeNull()
  })

  it('dopo ] propone gli attributi che cominciano con quanto scritto', () => {
    expect(labels('[a]{co')).toEqual(['color=', 'bg-color='])
    expect(labels('[a]{b')).toEqual(['bg=', 'bold', 'border=', 'bg-size=', 'bg-color='])
  })

  it('propone i valori: colori, forme e immagini', () => {
    expect(labels('[a]{color=dark').slice(0, 2)).toEqual(['darkred', 'darkblue'])
    expect(labels('[a]{bg=s')).toEqual(['scudo', 'spada', 'square'])
    const r = at('[a]{.keyword color=re')!
    expect(r.from).toBe('[a]{.keyword color='.length)
  })

  it('dopo il punto propone gli stili', () => {
    expect(labels('[a]{.k')).toEqual(['.keyword'])
    expect(labels('[a]{.h')).toEqual(['.heading1', '.heading2'])
  })

  it('nelle altre graffe propone campi e immagini, e chiude la graffa', () => {
    const r = at('Bonus {s')!
    expect(r.items.map((s) => [s.label, s.insert])).toEqual([
      ['scudo', 'scudo}'],
      ['spada', 'spada}'],
      // poi le variabili di sistema, prima quelle che cominciano con s
      ['set.name', 'set.name}'],
      ['set.seed', 'set.seed}'],
      ['set.rows', 'set.rows}'],
      ['set.cards', 'set.cards}'],
      ['project.version', 'project.version}'],
      ['card.copies', 'card.copies}'],
      ['card.side', 'card.side}']
    ])
    expect(at('{')!.items.some((s) => s.kind === 'system')).toBe(false)
    expect(labels('{spada*f')).toEqual(['forza'])
  })
})
