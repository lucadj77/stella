import { describe, expect, it } from 'vitest'
import { normalizeTemplate, walkLayers } from '../normalize'
import { layerRenames, renameFieldInSheet, renameFieldInTemplate } from '../renameLayer'
import type { Template } from '../template'

const tpl = normalizeTemplate({
  name: 'reperti',
  front: [
    { type: 'image', name: 'img', x: 0, y: 0, w: 10, h: 10 },
    {
      type: 'text',
      name: 'tipo',
      x: 0,
      y: 20,
      w: 20,
      h: 10,
      size: 10,
      color: '#000000',
      source: { kind: 'formula', expr: '=IF({img}="a"; "Arma"; {img:2})' }
    },
    {
      type: 'text',
      name: 'nota',
      x: 0,
      y: 40,
      w: 20,
      h: 10,
      size: 10,
      color: '#000000',
      source: { kind: 'column', column: 'img' }
    }
  ],
  back: []
})

const rename = (t: Template, from: string, to: string): Template => ({
  ...t,
  front: t.front.map((l) => (l.name === from ? { ...l, name: to } : l))
})
const layer = (t: Template, name: string): Record<string, unknown> =>
  walkLayers([...t.front, ...t.back]).find((l) => l.name === name) as unknown as Record<
    string,
    unknown
  >

describe('rinomina di un livello', () => {
  it('riconosce il livello rinominato dal suo id', () => {
    expect(layerRenames(tpl, rename(tpl, 'img', 'rep'))).toEqual([['img', 'rep']])
    expect(layerRenames(tpl, tpl)).toEqual([])
  })

  it('non segue la rinomina se il nome vecchio resta a un altro livello', () => {
    const after = rename(tpl, 'img', 'rep')
    after.back = [{ ...after.front[0], id: 'altro', name: 'img' }]
    expect(layerRenames(tpl, after)).toEqual([])
  })

  it('cambia i richiami nelle formule e la colonna scelta, non i nomi', () => {
    const out = renameFieldInTemplate(rename(tpl, 'img', 'rep'), 'img', 'rep')
    expect(layer(out, 'tipo').source).toEqual({
      kind: 'formula',
      expr: '=IF({rep}="a"; "Arma"; {rep:2})'
    })
    expect(layer(out, 'nota').source).toEqual({ kind: 'column', column: 'rep' })
    expect(layer(out, 'rep')).toBeTruthy()
  })

  it('lascia uguale il template senza richiami', () => {
    expect(renameFieldInTemplate(tpl, 'zzz', 'yyy')).toBe(tpl)
  })

  it('rinomina colonne, proprietà, traduzioni e richiami nelle celle', () => {
    const s = {
      name: 'reperti',
      headers: ['img', 'img.tint', 'img@en', 'imgx', 'testo'],
      rows: [['a.png', 'red', 'b.png', 'x', 'vedi {img}']]
    }
    const out = renameFieldInSheet(s, 'img', 'rep')
    expect(out.headers).toEqual(['rep', 'rep.tint', 'rep@en', 'imgx', 'testo'])
    expect(out.rows[0][4]).toBe('vedi {rep}')
  })

  it('non tocca una colonna che esiste già con il nome nuovo', () => {
    const s = { name: 's', headers: ['img', 'rep'], rows: [['a', 'b']] }
    expect(renameFieldInSheet(s, 'img', 'rep').headers).toEqual(['img', 'rep'])
  })
})
