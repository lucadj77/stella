import { describe, expect, it } from 'vitest'
import {
  combineLayers,
  combinedRings,
  combinedShape,
  convertToPath,
  flattenPath,
  shapeOutline
} from '../combine'
import type { Point } from '../geometry'
import { denormalizeLayer, normalizeLayer } from '../normalize'
import { findLayer } from '../edit'
import type { GroupCombine, GroupLayer, Layer, ShapeLayer, Template } from '../template'

const area = (rings: Point[][]): number =>
  Math.abs(
    rings.reduce((sum, r) => {
      let a = 0
      for (let i = 0; i < r.length; i++) {
        const p = r[i]
        const q = r[(i + 1) % r.length]
        a += p.x * q.y - q.x * p.y
      }
      return sum + a / 2
    }, 0)
  )

// i buchi girano al contrario: le aree con segno si sommano
const shape = (props: Record<string, unknown>): ShapeLayer =>
  normalizeLayer({ type: 'shape', name: 's', ...props }, 0) as ShapeLayer

const group = (combine: GroupCombine, children: Layer[]): GroupLayer =>
  normalizeLayer({ type: 'group', name: 'g', combine, children: children as never }, 0) as GroupLayer

// due quadrati 10 × 10 sovrapposti per metà: il primo in elenco sta sopra, l'ultimo è la base
const top = shape({ name: 'top', x: 5, y: 0, w: 10, h: 10 })
const base = shape({ name: 'base', x: 0, y: 0, w: 10, h: 10, fill: '#f00' })

describe('forme combinate', () => {
  it('calcola le quattro operazioni', () => {
    expect(area(combinedRings(group('union', [top, base])))).toBeCloseTo(150, 3)
    expect(area(combinedRings(group('intersect', [top, base])))).toBeCloseTo(50, 3)
    expect(area(combinedRings(group('subtract', [top, base])))).toBeCloseTo(50, 3)
    expect(area(combinedRings(group('exclude', [top, base])))).toBeCloseTo(100, 3)
  })

  it('sottrae dalla base, l’ultima in elenco', () => {
    const rings = combinedRings(group('subtract', [top, base]))
    const xs = rings.flat().map((p) => p.x)
    expect(Math.min(...xs)).toBeCloseTo(0, 3)
    expect(Math.max(...xs)).toBeCloseTo(5, 3)
  })

  it('un buco al centro resta un buco', () => {
    const hole = shape({ x: 3, y: 3, w: 4, h: 4 })
    expect(area(combinedRings(group('subtract', [hole, base])))).toBeCloseTo(84, 3)
  })

  it('ignora le forme nascoste e le linee', () => {
    const hidden = { ...top, visible: false }
    const line = shape({ shape: 'line', x: 0, y: 5, w: 20, h: 0 })
    expect(area(combinedRings(group('union', [hidden, line, base])))).toBeCloseTo(100, 3)
  })

  it('tiene conto della rotazione dei figli', () => {
    const turned = { ...top, rotation: 90 }
    // ruotato intorno al centro un quadrato resta dov'è
    expect(area(combinedRings(group('union', [turned, base])))).toBeCloseTo(150, 2)
  })

  it('un cerchio diventa segmenti vicini alla curva', () => {
    const c = shape({ shape: 'ellipse', x: 0, y: 0, w: 20, h: 20 })
    const [ring] = shapeOutline(c)
    expect(area([ring])).toBeCloseTo(Math.PI * 100, 0)
    for (const p of ring) expect(Math.hypot(p.x - 10, p.y - 10)).toBeCloseTo(10, 5)
  })

  it('il rettangolo arrotondato ha gli angoli tagliati', () => {
    const r = shape({ x: 0, y: 0, w: 10, h: 10, radius: 2 })
    expect(area(shapeOutline(r))).toBeCloseTo(100 - (4 - Math.PI) * 4, 0)
  })

  it('il risultato ha l’aspetto della base e un tracciato in mm', () => {
    const s = combinedShape(group('union', [top, base]))!
    expect(s.fill).toBe('#f00')
    expect(s.shape).toBe('path')
    expect(s.x).toBeCloseTo(0, 3)
    expect(s.w).toBeCloseTo(15, 3)
    expect(s.combined).toMatch(/^M/)
  })

  it('un gruppo combinato dentro un altro conta come una forma', () => {
    const inner = group('union', [top, base])
    const cut = shape({ x: 0, y: 0, w: 15, h: 5 })
    expect(area(combinedRings(group('intersect', [cut, inner])))).toBeCloseTo(75, 3)
  })
})

describe('tracciati SVG', () => {
  it('legge comandi relativi, H, V e Z', () => {
    const [r] = flattenPath('m1 1 h2 v2 h-2 z')
    expect(area([r])).toBeCloseTo(4, 6)
  })

  it('scala un tracciato 0-1 nel riquadro', () => {
    const [r] = flattenPath('M0 0 L1 0 L1 1 L0 1 Z', 20, 10, 5, 5)
    expect(area([r])).toBeCloseTo(200, 6)
    expect(r[0]).toEqual({ x: 5, y: 5 })
  })

  it('segue gli archi', () => {
    const [r] = flattenPath('M0 5 A5 5 0 1 1 10 5 A5 5 0 1 1 0 5 Z')
    expect(area([r])).toBeCloseTo(Math.PI * 25, 0)
  })

  it('segue le curve di Bézier', () => {
    const [r] = flattenPath('M0 0 C0 10 10 10 10 0 Z')
    // area sotto la cubica: ∫ y dx = 1800 ∫ t²(1 − t)² dt = 60
    expect(area([r])).toBeCloseTo(60, 0)
  })
})

const template = (layers: Layer[]): Template =>
  ({ name: 't', width: 63, height: 88, front: layers, back: [] }) as unknown as Template

describe('modifica', () => {
  it('raggruppa le forme selezionate in un gruppo combinato', () => {
    const t = template([top, base])
    const r = combineLayers(t, 'front', [top.id, base.id], 'subtract')
    const g = findLayer(r.template.front, r.groupId!) as GroupLayer
    expect(g.combine).toBe('subtract')
    expect(g.children.map((c) => c.name)).toEqual(['top', 'base'])
  })

  it('su un gruppo cambia solo l’operazione', () => {
    const g = group('union', [top, base])
    const r = combineLayers(template([g]), 'front', [g.id], 'exclude')
    expect((r.template.front[0] as GroupLayer).combine).toBe('exclude')
  })

  it('converte in tracciato con il nome del gruppo', () => {
    const g = { ...group('union', [top, base]), name: 'badge' }
    const r = convertToPath(template([g]), 'front', g.id)
    const p = r.template.front[0] as ShapeLayer
    expect(p.type).toBe('shape')
    expect(p.shape).toBe('path')
    expect(p.name).toBe('badge')
    expect(p.w).toBeCloseTo(15, 3)
    expect(p.fill).toBe('#f00')
    expect(p.combined).toBeUndefined()
  })

  it('con altri livelli resta un gruppo con il tracciato in fondo', () => {
    const text = normalizeLayer({ type: 'text', name: 'label', x: 0, y: 0, w: 10, h: 5 }, 0)
    const g = group('union', [text, top, base])
    const r = convertToPath(template([g]), 'front', g.id)
    const out = r.template.front[0] as GroupLayer
    expect(out.type).toBe('group')
    expect(out.combine).toBe('none')
    expect(out.children.map((c) => c.type)).toEqual(['text', 'shape'])
  })

  it('salva combine solo se diverso da none, e rifiuta i valori sconosciuti', () => {
    expect(denormalizeLayer(group('none', [top]))).not.toHaveProperty('combine')
    expect(denormalizeLayer(group('union', [top]))).toHaveProperty('combine', 'union')
    expect(group('magic' as GroupCombine, [top]).combine).toBe('none')
  })
})
