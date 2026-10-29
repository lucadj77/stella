import { describe, expect, it } from 'vitest'
import { arithmetic, evaluateFormula } from '../formula'

describe('formule', () => {
  it('calcola le espressioni numeriche', () => {
    expect(evaluateFormula('{forza}+2', { forza: '3' }).value).toBe('5')
    expect(evaluateFormula('({a} + {b}) * 2', { a: '1,5', b: '2' }).value).toBe('7')
    expect(evaluateFormula('{a}/3', { a: '1' }).value).toBe('0.333333')
  })

  it('non scambia la virgola dei decimali per un separatore di argomenti', () => {
    expect(evaluateFormula('=MIN(2,5; 3)', {}).error).toMatch(/2\.5/)
    expect(evaluateFormula('=MIN(2; 5)', {}).value).toBe('2')
    expect(evaluateFormula('=MIN(2, 5)', {}).value).toBe('2')
    // un campo con la virgola resta com'è scritto, ma si calcola
    expect(evaluateFormula('=IF({a} > 1; {a}; 0)', { a: '1,5' }).value).toBe('1,5')
    expect(evaluateFormula('={a} * 2', { a: '1,5' }).value).toBe('3')
  })

  it('compone testo quando non è un calcolo', () => {
    expect(evaluateFormula('{nome}.png', { nome: 'Drago' }).value).toBe('Drago.png')
    expect(evaluateFormula('Forza {forza}', { forza: '3' }).value).toBe('Forza 3')
    expect(evaluateFormula('{data}', { data: '2026-10-18' }).value).toBe('2026-10-18')
  })

  it('segnala i campi mancanti', () => {
    expect(evaluateFormula('{x}+1', {}).missing).toEqual(['x'])
  })

  it('non calcola ciò che non è aritmetica', () => {
    expect(arithmetic('12')).toBe(12)
    expect(arithmetic('2-')).toBeNull()
    expect(arithmetic('(1')).toBeNull()
    expect(arithmetic('1.2.3')).toBeNull()
    expect(arithmetic('abc')).toBeNull()
  })
})

describe('espressioni con =', () => {
  const f = { forza: '4', nome: 'Drago', costo: '', tipo: 'mostro' }
  const ev = (e: string): string => evaluateFormula(e, f).value

  it('IF con confronti, testo e numeri', () => {
    expect(ev('=IF({forza}>3; "Forte"; "Debole")')).toBe('Forte')
    expect(ev('=IF({forza}>=5, "Forte", "Debole")')).toBe('Debole')
    expect(ev('=IF({tipo}="MOSTRO"; 1; 0)')).toBe('1')
    expect(ev('=IF(ISBLANK({costo}); "gratis"; {costo})')).toBe('gratis')
  })

  it('aritmetica, concatenazione e funzioni', () => {
    expect(ev('={forza}*2+1')).toBe('9')
    expect(ev('={nome} & " (" & {forza} & ")"')).toBe('Drago (4)')
    expect(ev('=ROUND(10/3; 2)')).toBe('3.33')
    expect(ev('=UPPER({nome})')).toBe('DRAGO')
    expect(ev('=AND({forza}>1; NOT({tipo}="eroe"))')).toBe('true')
    expect(ev('=MAX({forza}; 7)')).toBe('7')
    expect(evaluateFormula('=MIN()', {}).error).toContain('MIN')
  })

  it('IF non calcola il ramo scartato', () => {
    expect(evaluateFormula('=IF(FALSE; 1/0; "ok")', f).error).toBeUndefined()
  })

  it('segnala errori e campi mancanti', () => {
    expect(evaluateFormula('=IF({forza}>3; "a"', f).error).toBeTruthy()
    expect(evaluateFormula('=PIPPO(1)', f).error).toContain('PIPPO')
    expect(evaluateFormula('={x}+1', f).missing).toEqual(['x'])
    expect(evaluateFormula('={nome}+1', f).error).toBeTruthy()
  })
})

describe('numeri con il formato del foglio', () => {
  const f = { prob: '50%', costo: '1 234.50 €', forza: '3' }
  const ev = (e: string): string => evaluateFormula(e, f).value

  it('calcola con percentuali, valute e migliaia', () => {
    expect(ev('{prob}*2')).toBe('1')
    expect(ev('=({prob}*{forza})')).toBe('1.5')
    expect(ev('={costo}+0.5')).toBe('1235')
    expect(ev('=IF({prob}>0.4; "alta"; "bassa")')).toBe('alta')
    expect(ev('=ROUND({costo})')).toBe('1235')
  })

  it('il valore resta com è scritto quando non si calcola', () => {
    expect(ev('{prob}')).toBe('50%')
    expect(ev('Probabilità {prob}')).toBe('Probabilità 50%')
    expect(ev('=IF({forza}>1; {prob}; "")')).toBe('50%')
  })
})

describe('MOD e PICK', () => {
  it('MOD ha il segno del divisore, come in Excel', () => {
    expect(evaluateFormula('=MOD(7; 3)', {}).value).toBe('1')
    expect(evaluateFormula('=MOD(-7; 3)', {}).value).toBe('2')
    expect(evaluateFormula('=IF(MOD({n}; 10) = 0; "x"; "y")', { n: '20' }).value).toBe('x')
  })

  it('PICK sceglie dalla lista e ricomincia dopo l’ultimo', () => {
    expect(evaluateFormula('=PICK(2; "a"; "b"; "c")', {}).value).toBe('b')
    expect(evaluateFormula('=PICK(4; "a"; "b"; "c")', {}).value).toBe('a')
    expect(evaluateFormula('=PICK({n}; {lista})', { n: '3', lista: 'a, b, c' }).value).toBe('c')
  })
})
