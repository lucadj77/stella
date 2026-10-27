import { describe, expect, it } from 'vitest'
import type { Template } from '../template'
import { denormalizeTemplate, normalizeTemplate } from '../normalize'
import { bindCard } from '../bind'
import { parseTags, snapPoints } from '../ttsSnap'
import { ttsExtras, ttsSavedObject, ttsSavedPieces, ttsSnapPoints, ttsStretch } from '../../export'

const plancia = (front: Record<string, unknown>[], extra: Record<string, unknown> = {}): Template =>
  normalizeTemplate({ name: 'plancia', width: 120, height: 88, front, ...extra } as never)

describe('snap point di Tabletop Simulator', () => {
  it('tag separati da virgole, senza vuoti né doppi', () => {
    expect(parseTags(' legno, Pietra,,legno ')).toEqual(['legno', 'Pietra'])
    expect(parseTags(undefined)).toEqual([])
  })

  it('il livello snap point è il centro del suo riquadro e si salva senza i default', () => {
    const t = plancia([{ type: 'snap', name: 'p', x: 10, y: 20 }])
    expect(t.front[0]).toMatchObject({
      w: 6,
      h: 6,
      snap: { tags: '', rotated: false, angle: null }
    })
    expect(snapPoints(t.front)).toEqual([{ x: 13, y: 23, angle: null, tags: [] }])
    expect(denormalizeTemplate(t).front?.[0]).toEqual({ type: 'snap', name: 'p', x: 10, y: 20 })
  })

  it('un livello qualsiasi con snap: centro, rotazione del livello o propria', () => {
    const t = plancia([
      {
        type: 'shape',
        name: 'a',
        x: 0,
        y: 0,
        w: 20,
        h: 10,
        rotation: 30,
        snap: { tags: 'x', rotated: true, angle: null }
      },
      {
        type: 'shape',
        name: 'b',
        x: 0,
        y: 0,
        w: 20,
        h: 10,
        rotation: 30,
        snap: { tags: '', rotated: true, angle: 90 }
      },
      { type: 'shape', name: 'c', x: 50, y: 0, w: 20, h: 10 }
    ])
    expect(snapPoints(t.front)).toEqual([
      { x: 10, y: 5, angle: 30, tags: ['x'] },
      { x: 10, y: 5, angle: 90, tags: [] }
    ])
  })

  it('una griglia con snap ne ha uno per casella; i livelli nascosti no', () => {
    const t = plancia([
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
        snap: { tags: '', rotated: false, angle: null }
      },
      { type: 'snap', name: 'h', visible: false }
    ])
    expect(snapPoints(t.front)).toEqual([
      { x: 10, y: 10, angle: null, tags: [] },
      { x: 30, y: 10, angle: null, tags: [] }
    ])
  })

  it('i gruppi ruotati spostano il punto', () => {
    const t = plancia([
      {
        type: 'group',
        name: 'gr',
        rotation: 90,
        anchor: 'top-left',
        children: [
          {
            type: 'snap',
            name: 's',
            x: 0,
            y: 0,
            w: 10,
            h: 10,
            snap: { tags: '', rotated: true, angle: null }
          }
        ]
      }
    ])
    const [p] = snapPoints(t.front)
    expect(p.x).toBeCloseTo(-5)
    expect(p.y).toBeCloseTo(5)
    expect(p.angle).toBe(90)
  })

  it('tag del template e dello snap con i campi della carta', () => {
    const t = plancia(
      [{ type: 'snap', name: 's', snap: { tags: '{tipo}, base', rotated: false, angle: null } }],
      {
        ttsTags: '{tipo}, carta'
      }
    )
    const bound = bindCard(t, { fields: { tipo: 'edificio' }, amount: 1 }).template
    expect(ttsExtras(bound)).toMatchObject({
      tags: ['edificio', 'carta'],
      snaps: [{ tags: ['edificio', 'base'] }]
    })
    expect(denormalizeTemplate(t).ttsTags).toBe('{tipo}, carta')
    // i tag del set (esportazione) si aggiungono a quelli del template
    expect(ttsExtras(bound, 'nemici, carta').tags).toEqual(['edificio', 'carta', 'nemici'])
  })

  it('posizioni locali: destra = X negativa, basso = Z positiva, divise per scala e allungamento', () => {
    const [p] = ttsSnapPoints(
      [{ x: 120, y: 88, angle: 45, tags: ['a'] }],
      { w: 120, h: 88 },
      2,
      1.5
    )
    const k = 2.25 / 63 / 2 / 1.05
    expect(p.Position).toEqual({
      x: Math.round((-60 * k * 1000) / 1.5) / 1000,
      y: 0,
      z: Math.round(44 * k * 1000) / 1000
    })
    // stesso verso di Stella
    expect(p.Rotation).toEqual({ x: 0, y: 45, z: 0 })
    expect(p.Tags).toEqual(['a'])
    const [q] = ttsSnapPoints([{ x: 60, y: 44, angle: null, tags: [] }], { w: 120, h: 88 }, 1)
    expect(q).toEqual({ Position: { x: -0, y: 0, z: 0 } })
  })

  it('allungamento: solo le carte, dalla carta da poker', () => {
    expect(ttsStretch('card', 63, 88)).toBeCloseTo(1)
    expect(ttsStretch('card', 126, 88)).toBeCloseTo(2)
    expect(ttsStretch('board', 120, 88)).toBe(1)
    expect(ttsStretch('token', 30, 50)).toBe(1)
  })

  it('nel file: tag e snap sugli oggetti, il mazzo prende i tag di tutte le carte', () => {
    const sheet = { faceUrl: 'f', backUrl: 'b', cols: 2, rows: 1, uniqueBack: false }
    const snaps = [{ x: 31.5, y: 44, angle: null, tags: [] }]
    const deck = ttsSavedObject(
      'd',
      [sheet],
      [
        { sheet: 0, slot: 0, nickname: '', description: '', extras: { tags: ['a'], snaps } },
        {
          sheet: 0,
          slot: 1,
          nickname: '',
          description: '',
          extras: { tags: ['b', 'a'], snaps: [] }
        }
      ]
    ) as { ObjectStates: Record<string, unknown>[] }
    const obj = deck.ObjectStates[0] as Record<string, unknown> & {
      ContainedObjects: Record<string, unknown>[]
    }
    expect(obj.Tags).toEqual(['a', 'b'])
    expect(obj.ContainedObjects[0].Tags).toEqual(['a'])
    expect(obj.ContainedObjects[0].AttachedSnapPoints).toHaveLength(1)
    expect(obj.ContainedObjects[1]).not.toHaveProperty('AttachedSnapPoints')

    const board = ttsSavedPieces(
      'p',
      'board',
      { thickness: 2, edgeColor: '#FFFFFF' },
      0,
      [
        {
          faceUrl: 'f',
          backUrl: 'b',
          nickname: '',
          description: '',
          count: 1,
          extras: { tags: ['t'], snaps },
          card: { w: 120, h: 88 }
        }
      ],
      { w: 120, h: 88 }
    ) as { ObjectStates: Record<string, unknown>[] }
    expect(board.ObjectStates[0].Tags).toEqual(['t'])
    expect(board.ObjectStates[0].AttachedSnapPoints).toHaveLength(1)
    // senza tag né snap il file resta come prima
    const plain = ttsSavedPieces(
      'p',
      'tile',
      { thickness: 2, edgeColor: '#FFFFFF' },
      0,
      [{ faceUrl: 'f', backUrl: 'b', nickname: '', description: '', count: 1 }],
      { w: 45, h: 45 }
    ) as { ObjectStates: Record<string, unknown>[] }
    expect(plain.ObjectStates[0]).not.toHaveProperty('Tags')
  })
})
