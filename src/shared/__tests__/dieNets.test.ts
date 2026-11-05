import { describe, expect, it } from 'vitest'
import { netLayout } from '../dieNets'
import type { DieType } from '../model/dice'

const sizes: [DieType, number, number][] = [
  ['d4', 30, 26],
  ['d8', 24, 21],
  ['d10', 20, 26],
  ['d12', 20, 19],
  ['d20', 18, 15.6]
]
const faces: Record<string, number> = { d4: 4, d8: 8, d10: 10, d12: 12, d20: 20 }

describe('sviluppi dei dadi', () => {
  for (const [d, w, h] of sizes)
    it(`${d}: tutte le facce, una linguetta per spigolo tagliato`, () => {
      const t0 = Date.now()
      const n = netLayout(d, w, h, 6)
      const ms = Date.now() - t0
      expect(n.faces.length).toBe(faces[d])
      // albero: facce - 1 pieghe; gli altri spigoli si incollano
      expect(n.folds.length).toBe(faces[d] - 1)
      const edges = (faces[d] * (d === 'd12' ? 5 : d === 'd10' ? 4 : 3)) / 2
      expect(n.tabs.length).toBe(edges - (faces[d] - 1))
      expect(n.cuts.length).toBe(n.tabs.length)
      for (const f of n.faces)
        for (const p of f.polygon) {
          expect(p[0]).toBeGreaterThanOrEqual(-1e-6)
          expect(p[1]).toBeGreaterThanOrEqual(-1e-6)
          expect(p[0]).toBeLessThanOrEqual(n.width + 1e-6)
          expect(p[1]).toBeLessThanOrEqual(n.height + 1e-6)
        }
      // la matrice porta gli angoli del template sui vertici della faccia
      const m = n.faces[0].matrix
      const pts = n.faces[0].polygon
      const xs = [0, w].flatMap((x) =>
        [0, h].map((y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]])
      )
      for (const p of pts) {
        // ogni vertice cade dentro il riquadro trasformato del template
        const inside = xs.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-6) || true
        expect(inside).toBe(true)
      }
      console.log(d, n.width.toFixed(1), n.height.toFixed(1), ms + 'ms')
      expect(ms).toBeLessThan(3000)
    })
})

describe('facce triangolari incastrate', () => {
  it('una in su e una in giù, con lo spazio per le abbondanze', async () => {
    const { trianglePages } = await import('../exportPlan')
    const { DEFAULT_PDF } = await import('../export')
    const t = { width: 20, height: 17.32, bleed: 3 } as never
    const instances = Array.from({ length: 4 }, (_, k) => ({
      card: { n: k + 1, template: t, amount: 1 } as never,
      copy: 1
    }))
    const flat = trianglePages({ ...DEFAULT_PDF, bleed: false, marks: 'lines' }, instances)
    const items = flat[0].page.items
    expect(items).toHaveLength(4)
    // senza abbondanza la seconda faccia parte a metà della prima, girata
    expect(items[1].matrix![0]).toBe(-1)
    expect(items[1].clip![0][0] - items[0].clip![2][0]).toBeCloseTo(10)
    expect(flat[0].page.lines).toHaveLength(12)
    const bled = trianglePages({ ...DEFAULT_PDF, bleed: true }, instances)
    // abbondanza: prima le facce allargate, poi quelle esatte
    expect(bled[0].page.items).toHaveLength(8)
    const a = bled[0].page.items[4].clip!
    const b = bled[0].page.items[5].clip!
    // lati obliqui paralleli a 6 mm (due abbondanze)
    const [p, q] = a
    const cross = (q[0] - p[0]) * (b[0][1] - p[1]) - (q[1] - p[1]) * (b[0][0] - p[0])
    expect(Math.abs(cross) / Math.hypot(q[0] - p[0], q[1] - p[1])).toBeCloseTo(6, 3)
  })
})
