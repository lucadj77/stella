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

describe('frasi guidate', () => {
  const ctx = { inCell: true }
  const d = {
    field: 'forza',
    yes: { k: 'str', v: 'A' } as const,
    no: { k: 'str', v: 'B' } as const
  }

  it('ogni modello riconosce ciò che produce', async () => {
    const { SENTENCES, findSentence } = await import('../formulaAssist')
    for (const s of SENTENCES) {
      const n = s.make(ctx, d)
      const found = findSentence(n, ctx)
      expect(found?.template.id, s.id).toBe(s.id)
      // anche dopo scrittura e rilettura
      const again = parseExpression(printExpression(n)).node!
      expect(findSentence(again, ctx)?.template.id, s.id).toBe(s.id)
    }
  })

  it('riconosce la formula della guida e le fasce', async () => {
    const { findSentence } = await import('../formulaAssist')
    const guide = parseExpression(
      'IF(MOD({cell.index}; 10) = 0; "[" & {cell.index} & "]{color=red}"; {cell.index})'
    ).node!
    expect(findSentence(guide, ctx)?.template.id).toBe('everyN')
    // fuori da una griglia non è un "ogni N": resta un IF con un confronto
    expect(findSentence(guide, { inCell: false })?.template.id).toBe('if')
    const r = findSentence(parseExpression('IF({f}>=7;"a";IF({f}>=4;"b";"c"))').node!, ctx)
    expect(r?.template.id).toBe('ranges')
    expect(r?.parts.filter((p) => 'blank' in p).length).toBe(6)
    expect(findSentence(parseExpression('UPPER({nome})').node!, ctx)).toBeNull()
  })

  it('propone i modelli secondo il contesto', async () => {
    const { availableSentences } = await import('../formulaAssist')
    const ids = (c: Parameters<typeof availableSentences>[0]): string[] =>
      availableSentences(c).map((s) => s.id)
    expect(ids({ inCell: true, condition: false, onGrid: false })).toContain('checkerboard')
    expect(ids({ inCell: false, condition: false, onGrid: false })).not.toContain('checkerboard')
    expect(ids({ inCell: false, condition: false, onGrid: false })).toContain('everyN')
    expect(ids({ inCell: false, condition: false, onGrid: true })).not.toContain('everyN')
    expect(ids({ inCell: false, condition: true, onGrid: false })).toEqual([
      'compare',
      'notEmptyCond'
    ])
  })
})

describe('frasi annidate e condizioni composte', () => {
  const node = (src: string): ReturnType<typeof parseExpression>['node'] & object =>
    parseExpression(src).node!

  it('una funzione conosciuta dentro uno spazio diventa una frase annidata', async () => {
    const { guide, guidedBlanks } = await import('../formulaAssist')
    const n = node('IF({forza} > 3; IF(MOD({cell.index}; 10) = 0; "a"; "b"); "c")')
    const parts = guide(n, { inCell: true })
    expect(parts).not.toBeNull()
    const show = parts!.find((p) => 'blank' in p && p.blank.join() === '1')
    expect(show && 'sub' in show && show.sub?.length).toBeTruthy()
    // gli spazi annidati hanno il percorso dalla radice
    expect(guidedBlanks(parts!).map((b) => b.blank.join('.'))).toContain('1.0.0.1')
  })

  it('una funzione sconosciuta dentro uno spazio porta al modo avanzato', async () => {
    const { guide } = await import('../formulaAssist')
    expect(guide(node('IF({forza} > 3; UPPER("a"); "b")'), { inCell: false })).toBeNull()
  })

  it('riconosce le condizioni con e anche / oppure', async () => {
    const { findSentence } = await import('../formulaAssist')
    const and = findSentence(node('IF(AND({forza} >= 3; {costo} < 2); "a"; "b")'), {
      inCell: false
    })
    expect(and?.template.id).toBe('if')
    expect(and!.parts.filter((p) => 'join' in p).map((p) => 'join' in p && p.fn)).toEqual(['AND'])
    expect(and!.parts.filter((p) => 'drop' in p)).toHaveLength(2)
    const single = findSentence(node('IF({forza} > 3; "a"; "b")'), { inCell: false })
    expect(single!.parts.filter((p) => 'join' in p)).toHaveLength(2)
    // nel filtro del generatore
    expect(findSentence(node('OR({forza} > 3; {costo} = 1)'), { inCell: false })?.template.id).toBe(
      'compare'
    )
  })

  it('il primo spazio da riempire è il primo vuoto', async () => {
    const { firstGuidedBlank, guide } = await import('../formulaAssist')
    const n = replaceAt(node('IF({forza} > 3; "a"; "b")'), [2], { k: 'empty' })
    expect(firstGuidedBlank(guide(n, { inCell: false }), n)).toEqual([2])
  })
})
