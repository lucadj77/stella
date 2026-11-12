import { describe, expect, it } from 'vitest'
import { evalNumber } from '../nandeck/expr'
import { escapeMarkup, htmlToMarkup } from '../nandeck/html'
import { NandeckScript, parseRange, type NandeckEnv } from '../nandeck/interp'
import { scriptLines, splitParams, statement } from '../nandeck/script'
import { convertNandeck } from '../nandeck/convert'
import type { RawLayer } from '../../model/normalize'
import type { Sheet } from '../../project'

function env(files: Record<string, string>, sheets: Record<string, Sheet> = {}): NandeckEnv {
  return {
    files: [...Object.keys(files), ...Object.keys(sheets), 'img/a.png', 'img/b.png'],
    readText: (p) => files[p] ?? null,
    sheet: (file) => sheets[file] ?? null
  }
}

function run(text: string, sheets: Record<string, Sheet> = {}): NandeckScript {
  const s = new NandeckScript(env({ 'deck.nde': text }, sheets), 'deck.nde')
  s.run(text)
  return s
}

/** Livelli in un elenco piatto, gruppi compresi */
function flat(layers: RawLayer[] | undefined): RawLayer[] {
  return (layers ?? []).flatMap((l) => [l, ...flat(l.children as RawLayer[] | undefined)])
}

describe('expressions', () => {
  it('computes numbers and percentages', () => {
    expect(evalNumber('(1+2)*2')).toBe(6)
    expect(evalNumber('2^3')).toBe(8)
    expect(evalNumber('.5')).toBe(0.5)
    expect(evalNumber('50%', 9)).toBe(4.5)
    expect(evalNumber('100%-.8', 6)).toBeCloseTo(5.2)
    expect(evalNumber('abc')).toBeNull()
  })
})

describe('script lines', () => {
  it('skips comments and joins multi-line labels', () => {
    const lines = scriptLines(
      '; comment\n// other\n{[html]=<b>one\n</b>two}\nTEXT=1,[html]',
      'x.nde'
    )
    expect(lines.map((l) => l.text)).toEqual(['[html]=<b>one</b>two', 'TEXT=1,[html]'])
    expect(lines[1].line).toBe(5)
  })

  it('splits parameters outside quotes, brackets and frames', () => {
    expect(splitParams('1, "a,b", f(1,2), <frame, cc, 1, 1>, [x]')).toEqual([
      '1',
      '"a,b"',
      'f(1,2)',
      '<frame, cc, 1, 1>',
      '[x]'
    ])
    expect(statement('font = Arial, 10')).toMatchObject({ kind: 'command', name: 'FONT' })
    expect(statement('<f> = 0,0,1,1')).toMatchObject({ kind: 'frame', name: 'f' })
  })

  it('reads ranges', () => {
    expect(parseRange('1-3,7')).toEqual([1, 2, 3, 7])
    expect(parseRange('10#3')).toEqual([10, 11, 12])
  })
})

describe('interpreter', () => {
  it('pairs the n-th card of the range with the n-th element', () => {
    const s = run('[a]=x|y|z\nTEXT=3-5,[a],0,0,1,1')
    const op = s.ops[0]
    expect([3, 4, 5].map((c) => s.resolveParams(op, c)[0])).toEqual(['x', 'y', 'z'])
  })

  it('uses the deck position with LABELRANGE and BASERANGE', () => {
    const s = run('[a]=x|y|z|w\n[t]=1|2|1|2\nTEXT=labelrange([t],2),[a],0,0,1,1')
    const op = s.ops[0]
    expect(op.cards).toEqual([2, 4])
    expect([2, 4].map((c) => s.resolveParams(op, c)[0])).toEqual(['y', 'w'])
    const b = run('BASERANGE=1-5,ON\n[a]=a|b|c|d|e\nTEXT=3-5,[a],0,0,1,1')
    expect(b.resolveParams(b.ops[0], 3)[0]).toBe('c')
  })

  it('expands frames with alignment modifiers and %%', () => {
    const s = run(
      '<f>=1,1,4,6\nRECTANGLE=1,<f, BR, 1, 2>,#000000\nRECTANGLE=1,<f, CC, 50%%, 50%%>,#000000'
    )
    expect(s.resolveParams(s.ops[0], 1).slice(0, 4).map(Number)).toEqual([4, 5, 1, 2])
    expect(s.resolveParams(s.ops[1], 1).slice(0, 4).map(Number)).toEqual([2, 2.5, 2, 3])
  })

  it('skips sections that are off and lists unknown commands', () => {
    const s = run(
      'SECTION=a,OFF\nTEXT=1,"no",0,0,1,1\nENDSECTION\nHEXGRID=1,0,0,1,1\nTEXT=1,"yes",0,0,1,1'
    )
    expect(s.ops.map((o) => o.params[0])).toEqual(['"yes"'])
    expect(s.skipped.map((k) => [k.line, k.reason])).toEqual([[4, 'command']])
  })

  it('reads LINK data as labels', () => {
    const sheet: Sheet = {
      name: 'cards',
      headers: ['name', 'type'],
      rows: [
        ['A', 'x'],
        ['B', 'y']
      ]
    }
    const s = run('LINK=data.xlsx\nTEXT=1-{(name)},[name],0,0,1,1', { 'data.xlsx': sheet })
    expect(s.cardCount).toBe(2)
    expect(s.resolveParams(s.ops[0], 2)[0]).toBe('B')
  })
})

describe('html', () => {
  it('converts tags to markup', () => {
    const r = htmlToMarkup('<b>Bold</b> and <i>it</i><br><font color="#ff0000">red</font><table>')
    expect(r.text).toBe('**Bold** and *it*\n[red]{color=#ff0000}')
    expect(r.unsupported).toEqual(['table'])
  })

  it('escapes only what would format the text', () => {
    expect(escapeMarkup('+2')).toBe('+2')
    expect(escapeMarkup('**x**')).toBe('\\*\\*x\\*\\*')
    expect(escapeMarkup('- item')).toBe('\\- item')
    expect(escapeMarkup('{var} [x]')).toBe('{var} \\[x\\]')
  })
})

describe('conversion', () => {
  const sheet: Sheet = {
    name: 'cards',
    headers: ['name', 'color', 'pic'],
    rows: [
      ['Ann', 'red', 'a'],
      ['Bob', 'gold', 'b'],
      ['Cid', 'red', 'a']
    ]
  }
  const script = [
    'CARDSIZE=6,9',
    'LINK=data.xlsx',
    '[all]=1-{(name)}',
    'RECTANGLE=[all],0,0,100%,100%,#000000,#FFFFFF,0.1',
    'FONT=Arial,12,BT,#000000',
    'TEXT=[all],[name],0,0,100%,1',
    'IMAGE=[all],img\\[pic].png,1,1,4,4,0,P',
    'ELLIPSE=labelrange([color],gold),5,0,1,1,#FFD700',
    'RECTANGLE=4,0,0,100%,100%,#336699',
    'PAGE=21,29.7'
  ].join('\n')

  it('makes a template, a set and a data sheet', () => {
    const s = run(script, { 'data.xlsx': sheet })
    const p = convertNandeck([{ name: 'deck', script: s }])
    expect(p.templates).toHaveLength(1)
    const tpl = p.templates[0]
    expect(tpl.width).toBe(60)
    expect(tpl.height).toBe(90)
    const front = flat(tpl.front)
    // un livello valore per ogni colonna dei dati
    expect(front.filter((l) => l.type === 'value').map((l) => l.name)).toEqual([
      'name',
      'color',
      'pic'
    ])
    const text = front.find((l) => l.type === 'text')!
    expect(text).toMatchObject({ text: '{name}', font: 'Arial', size: 12, weight: 700 })
    const image = front.find((l) => l.type === 'image')!
    expect(image).toMatchObject({ src: 'img/{pic}.png', fit: 'contain', x: 10, y: 10, w: 40 })
    // labelrange diventa una formula di visibilità
    const group = front.find((l) => l.type === 'group')!
    expect(group.source).toEqual({ kind: 'formula', expr: '={color}="gold"' })
    expect((group.children as RawLayer[])[0]).toMatchObject({ shape: 'ellipse', fill: '#FFD700' })
    // il bordo sta dentro il riquadro, il primo livello è quello disegnato per ultimo
    const rect = front.filter((l) => l.type === 'shape').at(-1)!
    expect(rect).toMatchObject({ fill: '#FFFFFF', stroke: { color: '#000000', width: 1 }, x: 0.5 })
    // la carta 4, da sola dopo le altre, è il retro
    expect(flat(tpl.back)).toHaveLength(1)
    expect(p.sheets[0].headers).toEqual(['amount', 'name', 'color', 'pic'])
    expect(p.sheets[0].rows.map((r) => r[1])).toEqual(['Ann', 'Bob', 'Cid'])
    expect(p.images.sort()).toEqual(['img/a.png', 'img/b.png'])
    expect(p.reports[0]).toMatchObject({ cards: 3, printLines: 1, skipped: [] })
  })

  it('converts join() card by card, rotates images like nanDECK and hides empty paths', () => {
    const data: Sheet = {
      name: 'cards',
      headers: ['pers', 'unused'],
      rows: [
        ['1', 'x'],
        ['2', 'y'],
        ['', 'z']
      ]
    }
    const s = run(
      [
        'CARDSIZE=6,6',
        'LINK=data.xlsx',
        '[all]=1-{(pers)}',
        '<f>=1,1,2,2',
        'IMAGE=[all],join(img\\c,[pers],".png"),<f>,90,P',
        'IMAGE=[all],join(img\\b,{[pers]+1},".png"),0,0,1,1,0,P'
      ].join('\n'),
      { 'data.xlsx': data }
    )
    const p = convertNandeck([{ name: 'deck', script: s }])
    const front = flat(p.templates[0].front)
    // un livello valore solo per le colonne lette dai livelli
    expect(front.filter((l) => l.type === 'value').map((l) => l.name)).toEqual(['pers'])
    const a = front.find((l) => l.name === 'f')!
    // stesso verso di nanDECK; il percorso con un campo vuoto (img/c.png) si nasconde
    expect(a).toMatchObject({ src: 'img/c{pers}.png', rotation: 90, missing: 'hide' })
    // l'espressione cambia da carta a carta: una colonna con il valore di ognuna
    const b = front.find((l) => l.type === 'image' && l.name !== 'f')!
    expect(p.sheets[0].headers).toContain(b.name)
    const col = p.sheets[0].headers.indexOf(b.name as string)
    expect(p.sheets[0].rows.slice(0, 2).map((r) => r[col])).toEqual(['img/b2.png', 'img/b3.png'])
  })

  it('turns HTML image keys into image variables', () => {
    const s = run(
      'CARDSIZE=6,9\nHTMLFONT=f,Arial,10,,#000000\nHTMLIMAGE=,(a),img\\a.png,0.5,0.5\nHTMLTEXT=1,"Pay (a)",0,0,6,2,#FFFFFF,0,T,100,f'
    )
    const p = convertNandeck([{ name: 'deck', script: s }])
    expect(p.variables).toEqual({ a: { type: 'image', src: 'img/a.png' } })
    const text = flat(p.templates[0].front).find((l) => l.type === 'text')!
    expect(text.text).toMatch(/^Pay \{a( size=\d+%)?\}$/)
  })
})
