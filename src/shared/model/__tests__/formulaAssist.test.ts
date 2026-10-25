import { describe, expect, it } from 'vitest'
import { evaluateFormula, parseExpression, printExpression } from '../formula'
import {
  addArg,
  CATALOG,
  chainLength,
  formulaText,
  openFormula,
  readText,
  removeArg,
  replaceAt,
  writeText
} from '../formulaAssist'
import { serializeAttrs } from '../markup'

const roundTrip = (src: string): string => printExpression(parseExpression(src).node!)

describe('albero delle formule', () => {
  it('rilegge ciò che scrive', () => {
    const cases = [
      'IF(MOD({cell.index}; 10) = 0; "[" & {cell.index} & "]{color=red}"; {cell.index})',
      '({a}+{b})*2',
      '{a}-({b}-{c})',
      '{a}-{b}-{c}',
      '-({a}+1)',
      '"Lui disse ""ciao"""',
      'AND({forza} > 3; NOT({tipo} = "eroe"))',
      '({a} = 1) = TRUE',
      '{a} & ({b}+1)'
    ]
    for (const c of cases) {
      const once = roundTrip(c)
      expect(roundTrip(once)).toBe(once)
      const f = { a: '5', b: '2', c: '1', forza: '4', tipo: 'mostro', 'cell.index': '10' }
      expect(evaluateFormula('=' + once, f)).toEqual(evaluateFormula('=' + c, f))
    }
    expect(roundTrip('if( {a}>3 , "x" , "y" )')).toBe('IF({a} > 3; "x"; "y")')
  })

  it('tiene i campi letti anche con un errore', () => {
    const p = parseExpression('IF({a}>3; {b}')
    expect(p.fields).toEqual(['a', 'b'])
    expect(p.error).toBeTruthy()
  })
})

describe('assistente', () => {
  it('modifica l’albero per percorsi', () => {
    let n = CATALOG.condition[0].make({ inCell: false })
    n = replaceAt(n, [0], {
      k: 'bin',
      op: '>',
      l: { k: 'field', name: 'forza' },
      r: { k: 'num', v: 3 }
    })
    n = replaceAt(n, [1], { k: 'str', v: 'Forte' })
    n = replaceAt(n, [2], { k: 'str', v: 'Debole' })
    expect(formulaText(n)).toBe('=IF({forza} > 3; "Forte"; "Debole")')
    const p = CATALOG.selection[0].make({ inCell: false })
    expect(addArg(p, []).k === 'call' && (addArg(p, []) as { args: unknown[] }).args.length).toBe(4)
    expect((removeArg(p, [2]) as { args: unknown[] }).args.length).toBe(2)
  })

  it('le ricette usano la casella dentro una griglia, altrimenti il componente', () => {
    const every = CATALOG.recipes.find((e) => e.id === 'everyN')!
    expect(printExpression(every.make({ inCell: true }))).toContain('{cell.index}')
    expect(printExpression(every.make({ inCell: false }))).toContain('{card.number}')
    expect(chainLength(CATALOG.condition[1].make({ inCell: false }))).toBe(2)
  })

  it('riconosce il testo formattato', () => {
    const n = parseExpression('"[" & {cell.index} & "]{color=red}"').node!
    const t = readText(n)!
    expect(t.parts).toEqual([{ field: 'cell.index' }])
    expect(serializeAttrs(t.attrs)).toBe('color=red')
    expect(printExpression(writeText(t))).toBe('"[" & {cell.index} & "]{color=red}"')
    const plain = readText(parseExpression('"[Forte]{bold}"').node!)!
    expect(plain.parts).toEqual([{ text: 'Forte' }])
    expect(serializeAttrs(plain.attrs)).toBe('bold')
  })

  it('apre le composizioni e le riscrive senza =', () => {
    expect(formulaText(openFormula('{nome}.png').node!)).toBe('{nome}.png')
    expect(formulaText(openFormula('Forza {forza}').node!)).toBe('Forza {forza}')
    expect(formulaText(openFormula('{forza}+2').node!)).toBe('={forza}+2')
    expect(openFormula('=IF(').error).toBeTruthy()
    expect(openFormula('').node).toEqual({ k: 'empty' })
  })
})
