import { describe, expect, it } from 'vitest'
import {
  anchoredResize,
  duplicateLayer,
  findLayer,
  groupLayers,
  insertLayer,
  layersFromClipboard,
  layersToClipboard,
  moveLayer,
  moveLayerTo,
  newLayer,
  pasteLayers,
  patchLayer,
  patchLayers,
  removeLayers,
  resizeTemplate,
  ungroupLayer,
  uniqueName
} from '../edit'
import { normalizeTemplate, walkLayers } from '../normalize'
import type { GroupLayer, TextLayer } from '../template'

const base = normalizeTemplate({
  name: 't',
  front: [
    { type: 'text', id: 'a', name: 'nome', x: 10, y: 10, w: 20, h: 10, size: 10 },
    { type: 'shape', id: 'b', name: 'banda', x: 0, y: 30, w: 63, h: 10 },
    { type: 'shape', id: 'c', name: 'sfondo', x: 0, y: 0, w: 63, h: 88 }
  ]
})

const ids = (layers: { id: string }[]): string[] => layers.map((l) => l.id)

describe('ordine e struttura', () => {
  it('sposta su e giù nello stesso contenitore', () => {
    expect(ids(moveLayer(base, 'front', 'b', 'up').front)).toEqual(['b', 'a', 'c'])
    expect(ids(moveLayer(base, 'front', 'b', 'down').front)).toEqual(['a', 'c', 'b'])
    expect(ids(moveLayer(base, 'front', 'a', 'up').front)).toEqual(['a', 'b', 'c'])
  })

  it('sposta trascinando sopra, sotto o dentro un gruppo', () => {
    expect(ids(moveLayerTo(base, 'front', 'c', 'a', 'before').front)).toEqual(['c', 'a', 'b'])
    expect(ids(moveLayerTo(base, 'front', 'a', 'c', 'after').front)).toEqual(['b', 'c', 'a'])
    const { template, groupId } = groupLayers(base, 'front', ['a', 'b'])
    const inside = moveLayerTo(template, 'front', 'c', groupId!, 'inside')
    expect(ids((inside.front[0] as GroupLayer).children)).toEqual(['c', 'a', 'b'])
    // il gruppo si allarga per contenere il nuovo figlio
    expect(inside.front[0].h).toBe(88)
    // un gruppo non entra in se stesso
    expect(moveLayerTo(template, 'front', groupId!, 'a', 'before')).toBe(template)
  })

  it('inserisce sopra al riferimento o in cima', () => {
    const l = newLayer(base, 'text')
    expect(ids(insertLayer(base, 'front', l).front)[0]).toBe(l.id)
    expect(ids(insertLayer(base, 'front', l, 'c').front)).toEqual(['a', 'b', l.id, 'c'])
  })

  it('raggruppa fratelli e ricalcola il riquadro', () => {
    const { template, groupId } = groupLayers(base, 'front', ['a', 'b'])
    expect(template.front).toHaveLength(2)
    const g = template.front[0] as GroupLayer
    expect(g.id).toBe(groupId)
    expect(ids(g.children)).toEqual(['a', 'b'])
    expect([g.x, g.y, g.w, g.h]).toEqual([0, 10, 63, 30])
  })

  it('separa un gruppo rimettendo i figli al suo posto', () => {
    const { template, groupId } = groupLayers(base, 'front', ['b', 'c'])
    const { template: out, childIds } = ungroupLayer(template, 'front', groupId!)
    expect(childIds).toEqual(['b', 'c'])
    expect(ids(out.front)).toEqual(['a', 'b', 'c'])
  })

  it('elimina i gruppi rimasti vuoti', () => {
    const { template, groupId } = groupLayers(base, 'front', ['a'])
    const out = removeLayers(template, 'front', ['a'])
    expect(findLayer(out.front, groupId!)).toBeNull()
    expect(ids(out.front)).toEqual(['b', 'c'])
  })
})

describe('modifiche', () => {
  it('spostare un gruppo sposta i figli', () => {
    const { template, groupId } = groupLayers(base, 'front', ['a', 'b'])
    const out = patchLayer(template, 'front', groupId!, { x: 5, y: 20 })
    const a = findLayer(out.front, 'a')!
    expect([a.x, a.y]).toEqual([15, 20])
    const g = findLayer(out.front, groupId!)!
    expect([g.x, g.y]).toEqual([5, 20])
  })

  it('un gruppo ritagliato occupa la sua maschera', () => {
    const { template, groupId } = groupLayers(base, 'front', ['a', 'b'])
    const out = patchLayer(template, 'front', groupId!, { clip: true } as Partial<GroupLayer>)
    const g = findLayer(out.front, groupId!)!
    // la maschera è "banda", il livello in fondo
    expect([g.x, g.y, g.w, g.h]).toEqual([0, 30, 63, 10])
  })

  it('ridimensionare un gruppo scala i figli', () => {
    const { template, groupId } = groupLayers(base, 'front', ['a', 'b'])
    const out = patchLayer(template, 'front', groupId!, { w: 126 })
    const a = findLayer(out.front, 'a')!
    expect([a.x, a.w]).toEqual([20, 40])
  })

  it('i nomi restano univoci', () => {
    expect(uniqueName(base, 'nome')).toBe('nome_2')
    expect(uniqueName(base, 'altro')).toBe('altro')
    const copy = duplicateLayer(base, base.front[0])
    expect(copy.name).toBe('nome_2')
    expect(copy.id).not.toBe('a')
    // un id mancante bloccava l'interfaccia
    expect(copy.id).toBeTruthy()
    expect([copy.x, copy.y]).toEqual([12, 12])
  })

  it('duplica un gruppo con figli dai nomi nuovi', () => {
    const { template, groupId } = groupLayers(base, 'front', ['a', 'b'])
    const copy = duplicateLayer(template, findLayer(template.front, groupId!)!)
    const names = walkLayers([copy]).map((l) => l.name)
    expect(names).toEqual(['group_2', 'nome_2', 'banda_2'])
  })

  it('cambia formato scalando o lasciando i livelli', () => {
    const scaled = resizeTemplate(base, 126, 176, 'scale')
    const a = scaled.front[0] as TextLayer
    expect([a.x, a.w, a.size]).toEqual([20, 40, 20])
    // lo sfondo che copre l'abbondanza continua a coprirla
    const bg = normalizeTemplate({
      name: 'b',
      front: [{ type: 'shape', name: 'bg', x: -3, y: -3, w: 69, h: 94 }]
    })
    const r = resizeTemplate(bg, 70, 88, 'scale').front[0]
    expect([r.x, r.y, r.w, r.h]).toEqual([-3, -3, 76, 94])
    const kept = resizeTemplate(base, 126, 176, 'keep')
    expect(kept.front[0].x).toBe(10)
    expect(kept.width).toBe(126)
  })

  it('lasciando i livelli si applicano i vincoli di ciascuno', () => {
    const t = normalizeTemplate({
      name: 'v',
      front: [
        {
          type: 'shape',
          name: 'dx',
          x: 50,
          y: 70,
          w: 10,
          h: 10,
          constraints: { h: 'right', v: 'bottom' }
        },
        {
          type: 'shape',
          name: 'mezzo',
          x: 26.5,
          y: 0,
          w: 10,
          h: 10,
          constraints: { h: 'center', v: 'top' }
        },
        {
          type: 'shape',
          name: 'banda',
          x: 0,
          y: 30,
          w: 63,
          h: 10,
          constraints: { h: 'both', v: 'scale' }
        }
      ]
    })
    const [dx, mezzo, banda] = resizeTemplate(t, 73, 98, 'keep').front
    expect([dx.x, dx.y, dx.w]).toEqual([60, 80, 10])
    expect(mezzo.x).toBe(31.5)
    expect(banda.w).toBe(73)
    expect(banda.y).toBeCloseTo((30 * 98) / 88)
  })
})

describe('modifiche a più livelli', () => {
  const tpl = normalizeTemplate({
    name: 't',
    width: 63,
    height: 88,
    front: [
      {
        type: 'shape',
        name: 'a',
        x: 0,
        y: 0,
        w: 10,
        h: 10,
        fill: '#FF0000',
        stroke: { color: '#000000', width: 1 }
      },
      {
        type: 'shape',
        name: 'b',
        x: 20,
        y: 0,
        w: 10,
        h: 10,
        fill: '#00FF00',
        stroke: { color: '#FFFFFF', width: 2 }
      }
    ]
  })
  const [a, b] = tpl.front
  it('applica la stessa modifica a tutti', () => {
    const out = patchLayers(tpl, 'front', [a.id, b.id], a, { opacity: 0.5 })
    expect(out.front.map((l) => l.opacity)).toEqual([0.5, 0.5])
    expect(out.front.map((l) => l.x)).toEqual([0, 20])
  })
  it('nelle proprietà composte cambia solo la voce modificata', () => {
    const sa = (a as { stroke: { color: string; width: number } }).stroke
    const out = patchLayers(tpl, 'front', [a.id, b.id], a, { stroke: { ...sa, width: 3 } } as never)
    expect(out.front.map((l) => (l as unknown as { stroke: unknown }).stroke)).toEqual([
      { color: '#000000', width: 3 },
      { color: '#FFFFFF', width: 3 }
    ])
  })
})

describe('copia e incolla tra template', () => {
  const other = normalizeTemplate({
    name: 'altro',
    front: [{ type: 'text', id: 'x', name: 'nome', x: 0, y: 0, w: 20, h: 10 }]
  })

  it('copia in ordine di sovrapposizione, con i figli dei gruppi', () => {
    const { template, groupId } = groupLayers(base, 'front', ['a', 'b'])
    const text = layersToClipboard(template, 'front', ['c', groupId!])!
    const data = layersFromClipboard(text)!
    expect(data.template).toBe('t')
    expect(data.layers.map((l) => l.name)).toEqual(['group', 'sfondo'])
    expect(walkLayers(data.layers)).toHaveLength(4)
    expect(layersToClipboard(base, 'front', [])).toBeNull()
    expect(layersFromClipboard('testo qualsiasi')).toBeNull()
    expect(layersFromClipboard('{"a":1}')).toBeNull()
  })

  it('incolla in un altro template con nomi liberi e la stessa colonna', () => {
    const data = layersFromClipboard(layersToClipboard(base, 'front', ['a', 'b'])!)!
    const r = pasteLayers(other, 'front', data.layers)
    expect(r.template.front.map((l) => l.name)).toEqual(['nome_2', 'banda', 'nome'])
    expect(r.ids).toEqual([r.template.front[0].id, r.template.front[1].id])
    expect(r.ids).not.toContain('a')
    const pasted = r.template.front[0]
    // stessa posizione: il template è un altro
    expect([pasted.x, pasted.y]).toEqual([10, 10])
    // rinominato, continua a leggere la colonna nome
    expect(pasted.source).toEqual({ kind: 'column', column: 'nome' })
    expect(r.template.front[1].source).toEqual({ kind: 'column', column: null })
  })

  it('incolla sopra al livello indicato, spostando se richiesto', () => {
    const data = layersFromClipboard(layersToClipboard(base, 'front', ['a', 'b'])!)!
    const r = pasteLayers(base, 'front', data.layers, 'c', true)
    expect(r.template.front.map((l) => l.name)).toEqual([
      'nome',
      'banda',
      'nome_2',
      'banda_2',
      'sfondo'
    ])
    expect([r.template.front[2].x, r.template.front[2].y]).toEqual([12, 12])
  })
})

describe('misura dal pannello', () => {
  const box = (anchor: string): TextLayer =>
    normalizeTemplate({
      name: 'a',
      front: [{ type: 'text', name: 'x', x: 10, y: 20, w: 30, h: 10, anchor }]
    } as never).front[0] as TextLayer
  it('resta fermo il punto di ancoraggio', () => {
    expect(anchoredResize(box('center'), 40, 20)).toEqual({ x: 5, y: 15, w: 40, h: 20 })
    expect(anchoredResize(box('top-left'), 40, 20)).toEqual({ x: 10, y: 20, w: 40, h: 20 })
    expect(anchoredResize(box('bottom-right'), 40, 20)).toEqual({ x: 0, y: 10, w: 40, h: 20 })
    expect(anchoredResize(box('top'), 40, 20)).toEqual({ x: 5, y: 20, w: 40, h: 20 })
    expect(anchoredResize(box('left'), 40, 20)).toEqual({ x: 10, y: 15, w: 40, h: 20 })
  })
})
