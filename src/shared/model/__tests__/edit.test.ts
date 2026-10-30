import { describe, expect, it } from 'vitest'
import {
  anchoredResize,
  attachGridGroup,
  detachGridGroup,
  insertNewLayer,
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
import type { GridLayer, GroupLayer, Layer, Template, TextLayer } from '../template'

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

describe('gruppi della griglia', () => {
  const make = (): Template =>
    normalizeTemplate({
      name: 't',
      front: [
        {
          type: 'grid',
          name: 'g',
          x: 0,
          y: 0,
          w: 40,
          h: 20,
          rows: 1,
          columns: 2,
          gap: 0,
          content: 'c',
          groups: [
            {
              type: 'group',
              name: 'c',
              children: [{ type: 'shape', name: 's', x: 5, y: 5, w: 10, h: 10 }]
            }
          ]
        }
      ]
    })
  const gridOf = (t: Template): GridLayer => t.front[0] as GridLayer

  it('si trovano e si spostano con la griglia', () => {
    const t = make()
    expect(findLayer(t.front, gridOf(t).groups[0].children[0].id)?.name).toBe('s')
    const moved = patchLayer(t, 'front', gridOf(t).id, { x: 10 })
    expect(gridOf(moved).groups[0].x).toBe(15)
  })

  it('il gruppo centrato resta sulla prima casella', () => {
    const t = make()
    const s = gridOf(t).groups[0].children[0]
    // la prima casella è 0-20 × 0-20: centro 10, 10
    const moved = patchLayer(t, 'front', s.id, { x: 0, y: 0, w: 4, h: 4 })
    const g = gridOf(moved).groups[0]
    expect(g.x + g.w / 2).toBeCloseTo(10)
    expect(g.y + g.h / 2).toBeCloseTo(10)
  })

  it('togliendo il gruppo la griglia resta senza contenuto', () => {
    const t = make()
    const out = removeLayers(t, 'front', [gridOf(t).groups[0].id])
    expect(gridOf(out).content).toBe('')
    expect(gridOf(out).groups).toEqual([])
  })

  it('una copia della griglia ha i suoi gruppi, con nomi nuovi', () => {
    const t = make()
    const copy = duplicateLayer(t, gridOf(t)) as GridLayer
    expect(copy.groups[0].name).not.toBe('c')
    expect(copy.content).toBe(copy.groups[0].name)
    expect(copy.groups[0].id).not.toBe(gridOf(t).groups[0].id)
  })

  it('tra i gruppi della griglia non entrano altri livelli', () => {
    const t = normalizeTemplate({
      name: 't',
      front: [
        { type: 'text', name: 'x' },
        {
          type: 'grid',
          name: 'g',
          content: 'c',
          groups: [{ type: 'group', name: 'c', children: [{ type: 'text', name: 'y' }] }]
        }
      ]
    })
    const g = t.front[1] as GridLayer
    expect(moveLayerTo(t, 'front', t.front[0].id, g.groups[0].id, 'before')).toBe(t)
  })
})

describe('contenuto della griglia dalla lista', () => {
  const make = (): Template =>
    normalizeTemplate({
      name: 't',
      front: [
        {
          type: 'group',
          name: 'pezzo',
          children: [{ type: 'shape', name: 'p', x: 50, y: 50, w: 6, h: 6 }]
        },
        {
          type: 'grid',
          name: 'g',
          x: 0,
          y: 0,
          w: 40,
          h: 20,
          rows: 1,
          columns: 2,
          gap: 0,
          cellRules: [{ when: '={cell.index}=2' }]
        }
      ]
    })

  it('un gruppo della lista entra nella griglia, centrato sulla prima casella', () => {
    const t = make()
    const group = t.front[0] as GroupLayer
    const out = attachGridGroup(t, 'front', t.front[1].id, 'content', group)
    expect(out.front).toHaveLength(1)
    const g = out.front[0] as GridLayer
    expect(g.content).toBe('pezzo')
    expect(g.groups[0].x + g.groups[0].w / 2).toBeCloseTo(10)
  })

  it('il gruppo di una regola, e togliendolo torna nella lista', () => {
    const t = make()
    const group = t.front[0] as GroupLayer
    const out = attachGridGroup(t, 'front', t.front[1].id, 0, group)
    const g = out.front[0] as GridLayer
    expect(g.cellRules[0]).toMatchObject({ content: 'pezzo', centered: true })
    const back = detachGridGroup(out, 'front', g.id, 0)
    expect(back.front.map((l) => l.name)).toEqual(['pezzo', 'g'])
    expect((back.front[1] as GridLayer).cellRules[0].content).toBeUndefined()
  })

  it('un livello nuovo nel gruppo della griglia prende la misura della casella', () => {
    const base = make()
    const t = attachGridGroup(
      base,
      'front',
      base.front[1].id,
      'content',
      base.front[0] as GroupLayer
    )
    const g = t.front[0] as GridLayer
    const layer = newLayer(t, 'shape', 'rect')
    const out = insertNewLayer(t, 'front', layer, g.groups[0].id)
    const inside = (out.front[0] as GridLayer).groups[0].children[0]
    expect(inside.id).toBe(layer.id)
    expect(inside).toMatchObject({ w: 20, h: 20 })
  })

  it('rinominare un gruppo o un livello del contenuto non stacca la griglia', () => {
    const base = make()
    let t = attachGridGroup(base, 'front', base.front[1].id, 'content', base.front[0] as GroupLayer)
    t = attachGridGroup(t, 'front', t.front[0].id, 0, {
      ...(base.front[0] as GroupLayer),
      id: 'r',
      name: 'altro'
    })
    t = patchLayer(t, 'front', t.front[0].id, {
      cellRules: [{ when: '=MOD({p}; 2) = 0', content: 'altro', values: { p: '1' } }]
    } as Partial<Layer>)
    const g0 = t.front[0] as GridLayer
    t = patchLayer(t, 'front', g0.groups[0].id, { name: 'pezzo2' })
    t = patchLayer(t, 'front', 'r', { name: 'altro2' })
    const p = walkLayers((t.front[0] as GridLayer).groups).find((l) => l.name === 'p')!
    t = patchLayer(t, 'front', p.id, { name: 'q' })
    const g = t.front[0] as GridLayer
    expect(g.content).toBe('pezzo2')
    expect(g.cellRules[0]).toMatchObject({
      when: '=MOD({q}; 2) = 0',
      content: 'altro2',
      values: { q: '1' }
    })
  })

  it('nel gruppo di una regola il livello nuovo va nella casella della regola', () => {
    const base = make()
    const t = attachGridGroup(base, 'front', base.front[1].id, 0, base.front[0] as GroupLayer)
    const g = t.front[0] as GridLayer
    const before = g.groups[0].children[0]
    const layer = newLayer(t, 'shape', 'rect')
    const out = insertNewLayer(t, 'front', layer, g.groups[0].id)
    const [inside, kept] = (out.front[0] as GridLayer).groups[0].children
    // la regola vale nella seconda casella, da 20 a 40
    expect(inside).toMatchObject({ x: 20, y: 0, w: 20, h: 20 })
    // il resto del gruppo non si sposta
    expect(kept).toMatchObject({ x: before.x, y: before.y })
  })
})
