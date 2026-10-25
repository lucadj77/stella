import { describe, expect, it } from 'vitest'
import { evaluateNodeText } from '../formula'
import {
  availableSentences,
  findSentence,
  formulaText,
  openFormula,
  SENTENCES
} from '../formulaAssist'

const ctx = { inCell: false }
const repeat = SENTENCES.find((s) => s.id === 'repeatIcon')!

describe('icona ripetuta', () => {
  it('scrive {icona*quante} e la riconosce riaprendo la formula', () => {
    const n = repeat.make(ctx, {
      field: 'forza',
      icon: 'spada',
      yes: { k: 'empty' },
      no: { k: 'empty' }
    })
    const text = formulaText(n)
    expect(text).toBe('="{" & "spada" & "*" & {forza} & "}"')
    expect(evaluateNodeText(n, { forza: '3' })).toEqual({ value: '{spada*3}' })
    const again = openFormula(text).node!
    expect(findSentence(again, ctx)?.template.id).toBe('repeatIcon')
  })

  it('si propone solo per i testi', () => {
    const base = { inCell: false, condition: false, onGrid: false }
    expect(availableSentences({ ...base, text: true }).some((s) => s.id === 'repeatIcon')).toBe(
      true
    )
    expect(availableSentences(base).some((s) => s.id === 'repeatIcon')).toBe(false)
  })
})
