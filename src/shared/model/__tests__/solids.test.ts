import { describe, expect, it } from 'vitest'
import { D4_CORNERS, DIE_TYPES, dieHeight, type DieType } from '../dice'
import {
  dieAtlas,
  dieColliderObj,
  dieObj,
  dieSolid,
  rotationUp,
  solidFaceCount,
  type Vec
} from '../solids'

const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const size = (d: DieType, w = 20): { width: number; height: number } => ({
  width: w,
  height: dieHeight(d, w, w * 1.25)
})

/** La rotazione di Unity (prima Z, poi X, poi Y) applicata a un vettore del tavolo */
function rotate(v: Vec, r: { x: number; y: number; z: number }): Vec {
  const rad = (a: number): number => (a * Math.PI) / 180
  const [cz, sz] = [Math.cos(rad(r.z)), Math.sin(rad(r.z))]
  const [cx, sx] = [Math.cos(rad(r.x)), Math.sin(rad(r.x))]
  const a: Vec = [v[0] * cz - v[1] * sz, v[0] * sz + v[1] * cz, v[2]]
  return [a[0], a[1] * cx - a[2] * sx, a[1] * sx + a[2] * cx]
}

describe('solidi dei dadi', () => {
  for (const d of DIE_TYPES) {
    it(`${d}: facce piane, verso fuori, tante quante servono`, () => {
      const s = dieSolid(d, size(d))
      expect(s.faces).toHaveLength(solidFaceCount(d))
      const { cols, rows } = dieAtlas(d)
      expect(cols * rows).toBeGreaterThanOrEqual(s.faces.length)
      for (const f of s.faces) {
        const ps = f.verts.map((i) => s.points[i])
        const plane = dot(ps[0], f.normal)
        expect(plane).toBeGreaterThan(0)
        for (const p of ps) expect(dot(p, f.normal)).toBeCloseTo(plane, 6)
      }
    })

    it(`${d}: ogni rotazione porta in alto il suo valore`, () => {
      const s = dieSolid(d, size(d))
      for (const dir of s.upFor) {
        const n = Math.hypot(...dir)
        const table: Vec = [-dir[0] / n, dir[1] / n, dir[2] / n]
        const up = rotate(table, rotationUp(dir))
        expect(up[1]).toBeCloseTo(1, 6)
      }
    })
  }

  it('le facce opposte fanno N + 1', () => {
    for (const d of ['d8', 'd10', 'd12', 'd20'] as DieType[]) {
      const s = dieSolid(d, size(d))
      const n = s.faces.length
      s.faces.forEach((f, k) => expect(dot(f.normal, s.faces[n - 1 - k].normal)).toBeCloseTo(-1, 6))
    }
  })

  it('la prima faccia è larga quanto il template', () => {
    for (const d of ['d4', 'd8', 'd12', 'd20', 'd10', 'd6'] as DieType[]) {
      const s = dieSolid(d, size(d, 18))
      const f = s.faces[0]
      const right: Vec = [
        f.up[1] * f.normal[2] - f.up[2] * f.normal[1],
        f.up[2] * f.normal[0] - f.up[0] * f.normal[2],
        f.up[0] * f.normal[1] - f.up[1] * f.normal[0]
      ]
      const xs = f.verts.map((i) => dot(s.points[i], right))
      expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(18, 6)
    }
  })

  it('d4: la faccia k ha in alto il vertice k e in basso quelli che condivide', () => {
    const s = dieSolid('d4', size('d4'))
    s.faces.forEach((f, k) => {
      expect(new Set(f.verts)).toEqual(new Set(D4_CORNERS[k]))
      // il vertice k è quello verso l'alto dell'immagine
      const top = f.verts.reduce((a, b) =>
        dot(s.points[a], f.up) > dot(s.points[b], f.up) ? a : b
      )
      expect(top).toBe(k)
    })
  })

  it('modello: coordinate dell’immagine nella cella di ogni faccia, spigoli arrotondati', () => {
    const obj = dieObj('d20', size('d20'))
    const vt = obj
      .split('\n')
      .filter((l) => l.startsWith('vt '))
      .map((l) => l.split(' ').slice(1).map(Number))
    for (const [u, v] of vt) {
      expect(u).toBeGreaterThanOrEqual(0)
      expect(u).toBeLessThanOrEqual(1)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
    const sharp = dieObj('d20', size('d20'), { round: 0 })
    const count = (o: string): number => o.split('\n').filter((l) => l.startsWith('f ')).length
    expect(count(sharp)).toBe(20)
    expect(count(obj)).toBeGreaterThan(20)
    // la moneta: due facce e il bordo
    expect(count(dieObj('d2', size('d2'), { thickness: 2 }))).toBeGreaterThan(2 * 46)
  })

  it('collisore: spigoli vivi e meno di 255 triangoli per ogni dado', () => {
    for (const d of DIE_TYPES) {
      const o = dieColliderObj(d, size(d), 2)
      const tris = o.split('\n').filter((l) => l.startsWith('f ')).length
      expect(tris).toBeGreaterThan(3)
      expect(tris).toBeLessThan(255)
    }
  })
})
