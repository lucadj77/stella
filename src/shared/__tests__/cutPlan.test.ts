import { describe, expect, it } from 'vitest'
import { DEFAULT_CUT, type CutOptions, type ExportCard } from '../export'
import {
  cm,
  cutDxf,
  cutInstructions,
  cutSvg,
  itemOutline,
  planCut,
  pngWithDpi,
  sheetFiles,
  templateOutline
} from '../cutPlan'
import { ringsBounds } from '../model/combine'
import { normalizeTemplate } from '../model/normalize'
import type { Template } from '../model/template'

const card = (template: Template, n = 1, amount = 1): ExportCard => ({
  n,
  amount,
  label: `c${n}`,
  fields: {},
  template
})
const poker = normalizeTemplate({
  name: 'p',
  width: 63.5,
  height: 88,
  bleed: 3,
  cornerRadius: 3,
  front: [],
  back: []
})
const cards = (n: number, t: Template = poker): ExportCard[] =>
  Array.from({ length: n }, (_, i) => card(t, i + 1))

describe('esportazione per plotter da taglio', () => {
  it('Cricut A4: 4 carte poker per foglio, con il foglio ritagliato sui componenti', () => {
    const plan = planCut(DEFAULT_CUT, [{ name: 'mazzo', cards: cards(6) }], 'gioco')
    expect(plan.sheets).toHaveLength(2)
    const [first, second] = plan.sheets
    expect(first.page.items).toHaveLength(4)
    // 2 colonne da 63,5 e 2 righe da 88 con 4 mm tra le carte, entro 171,4 × 234,9 mm
    expect(first.width).toBeCloseTo(2 * 63.5 + 4, 2)
    expect(first.height).toBeCloseTo(2 * 88 + 4, 2)
    expect(first.name).toBe('sheet-01 (13.1 x 18 cm)')
    // un contorno chiuso per carta, nessun foro, e il primo comincia in 0, 0
    expect(first.cut).toHaveLength(4)
    const box = ringsBounds(first.cut)!
    expect(box.x).toBeCloseTo(0, 2)
    expect(box.y).toBeCloseTo(0, 2)
    expect(second.page.items).toHaveLength(2)
    expect(plan.folder).toBe('gioco_plotter')
    expect(plan.overflow).toEqual([])
  })

  it('contorno della carta: angoli arrotondati entro un centesimo di mm', () => {
    const [ring] = templateOutline(poker)
    const box = ringsBounds([ring])!
    expect([box.x, box.y, box.w, box.h]).toEqual([0, 0, 63.5, 88])
    // il punto a metà dell'angolo in alto a sinistra sta sull'arco di raggio 3
    const mid = ring.reduce((best, p) =>
      Math.hypot(p.x, p.y) < Math.hypot(best.x, best.y) ? p : best
    )
    expect(Math.hypot(mid.x - 3, mid.y - 3)).toBeCloseTo(3, 1)
  })

  it('carta ruotata di 90°: il contorno occupa la cella ruotata', () => {
    const rings = itemOutline({
      x: 10,
      y: 20,
      template: poker,
      side: 'front',
      mode: 'trim',
      rotate: 90
    })
    const box = ringsBounds(rings)!
    expect(box.x).toBeCloseTo(10)
    expect(box.y).toBeCloseTo(20)
    expect(box.w).toBeCloseTo(88)
    expect(box.h).toBeCloseTo(63.5)
  })

  it('segnalino con il foro: il foro resta un contorno a sé', () => {
    const ring = normalizeTemplate({
      name: 'r',
      width: 30,
      height: 30,
      bleed: 0,
      shape: 'path',
      // quadrato con un quadrato più piccolo dentro, in coordinate 0-1 (evenodd)
      shapePath: 'M0,0 L1,0 L1,1 L0,1 Z M0.4,0.4 L0.6,0.4 L0.6,0.6 L0.4,0.6 Z',
      front: [],
      back: []
    })
    const plan = planCut(DEFAULT_CUT, [{ name: 's', cards: [card(ring)] }], 'g')
    expect(plan.sheets[0].cut).toHaveLength(2)
  })

  it('fronte e retro da piegare: la coppia è un pezzo solo con la piega al centro', () => {
    const o: CutOptions = { ...DEFAULT_CUT, fold: true }
    const plan = planCut(o, [{ name: 'm', cards: cards(1) }], 'g')
    const [sheet] = plan.sheets
    expect(sheet.cut).toHaveLength(1)
    expect(sheet.width).toBeCloseTo(127, 2)
    expect(sheet.folds).toHaveLength(1)
    expect(sheet.folds[0].x1).toBeCloseTo(63.5, 2)
    expect(sheet.folds[0].y2 - sheet.folds[0].y1).toBeCloseTo(88, 2)
    expect(sheetFiles(o, sheet).map((f) => f.kind)).toEqual(['folds'])
  })

  it('coppie da piegare: se girando il foglio ne entrano di più, il foglio si gira', () => {
    const o: CutOptions = {
      ...DEFAULT_CUT,
      fold: true,
      paper: 'custom',
      areaWidth: 182.9,
      areaHeight: 269.7
    }
    const plan = planCut(o, [{ name: 'm', cards: cards(4) }], 'g')
    // dritte ne entrano 2 (127 x 88, tre righe non stanno in 269,7); girate 4
    expect(plan.sheets).toHaveLength(1)
    const [sheet] = plan.sheets
    expect(sheet.cut).toHaveLength(4)
    expect(sheet.width).toBeCloseTo(2 * 88 + 4, 2)
    expect(sheet.height).toBeCloseTo(2 * 127 + 4, 2)
    expect(sheet.page.items.every((it) => it.matrix)).toBe(true)
    // le pieghe ora sono orizzontali, a metà di ogni coppia
    expect(sheet.folds).toHaveLength(4)
    expect(sheet.folds.every((f) => Math.abs(f.y1 - f.y2) < 1e-6)).toBe(true)
    const box = ringsBounds(sheet.cut)!
    expect([box.x, box.y]).toEqual([0, 0])
  })

  it('dado da piegare: un pezzo solo con le linguette e le pieghe', () => {
    const face = normalizeTemplate({
      name: 'd',
      kind: 'die',
      width: 18,
      height: 18,
      bleed: 0,
      front: [],
      back: []
    })
    const plan = planCut(DEFAULT_CUT, [{ name: 'd', kind: 'die', cards: cards(6, face) }], 'g')
    const [sheet] = plan.sheets
    expect(sheet.cut).toHaveLength(1)
    // 5 pieghe tra le facce e una per linguetta
    expect(sheet.folds.length).toBeGreaterThanOrEqual(5)
  })

  it('area troppo piccola: il set si segnala', () => {
    const plan = planCut(
      { ...DEFAULT_CUT, areaWidth: 50, areaHeight: 50, paper: 'custom' },
      [{ name: 'grandi', cards: cards(1) }],
      'g'
    )
    expect(plan.overflow).toEqual(['grandi'])
  })

  it('SVG in pixel a 72 per pollice, DXF in mm con y in su', () => {
    const plan = planCut(DEFAULT_CUT, [{ name: 'm', cards: cards(1) }], 'g')
    const [sheet] = plan.sheets
    const svg = cutSvg(sheet, 'cut')
    // 63,5 mm = 180 px e 88 mm = 249,449 px a 72 per pollice
    expect(svg).toContain('width="180" height="249.449"')
    expect(svg).not.toMatch(/mm"/)
    const folds = cutSvg(sheet, 'folds')
    expect(folds.indexOf('id="outline"')).toBeLessThan(folds.indexOf('id="folds"'))
    const dxf = cutDxf(sheet)
    expect(dxf).toContain('POLYLINE')
    expect(dxf.trim().endsWith('EOF')).toBe(true)
    expect(sheetFiles({ machine: 'other' }, sheet).map((f) => f.kind)).toEqual(['cut', 'dxf'])
  })

  it('istruzioni con le misure di ogni foglio, nella lingua scelta', () => {
    const plan = planCut(DEFAULT_CUT, [{ name: 'm', cards: cards(1) }], 'g', 'it')
    const text = cutInstructions(
      DEFAULT_CUT,
      plan,
      (key, p) => `${key}${p ? ' ' + JSON.stringify(p) : ''}`,
      'it'
    )
    expect(text).toContain('"w":"6,35","h":"8,8"')
    expect(plan.sheets[0].name).toBe('sheet-01 (6,35 x 8,8 cm)')
    expect(cm(182.9)).toBe('18.29')
  })

  it('PNG: la risoluzione si scrive dopo IHDR', () => {
    const png = new Uint8Array(8 + 25 + 12)
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
    const out = pngWithDpi(png, 300)
    expect(out.length).toBe(png.length + 21)
    expect(String.fromCharCode(...out.subarray(37, 41))).toBe('pHYs')
    // 300 dpi = 11811 pixel per metro
    expect(new DataView(out.buffer).getUint32(41)).toBe(11811)
    expect(pngWithDpi(out, 300)).toBe(out)
  })
})
