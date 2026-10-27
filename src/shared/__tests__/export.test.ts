import { describe, expect, it } from 'vitest'
import {
  DEFAULT_IMAGE,
  DEFAULT_PDF,
  cellPosition,
  cropMarks,
  effectivePattern,
  expandCopies,
  fileName,
  gridOverflows,
  mirrorsX,
  pdfGrid,
  planPdfPages,
  safeName,
  ttsAutoGrid,
  ttsImageUrl,
  ttsColor,
  ttsSavedObject,
  ttsCardScale,
  ttsPieceScale,
  ttsSetObject,
  ttsSavedPieces,
  ttsSavedDice,
  ttsDieObj,
  ttsDieRotations,
  type TtsDie,
  ttsTileType,
  ttsScale,
  uniqueNames,
  type ExportCard,
  type PdfOptions,
  type TtsPiece
} from '../export'
import { normalizeTemplate } from '../model/normalize'

const tpl = normalizeTemplate({ name: 't', width: 63, height: 88, bleed: 3, front: [], back: [] })
const card = (n: number, amount = 1): ExportCard => ({
  n,
  amount,
  label: `c${n}`,
  fields: { nome: `Carta ${n}` },
  template: tpl
})
const pdf = (o: Partial<PdfOptions> = {}): PdfOptions => ({ ...DEFAULT_PDF, ...o })

describe('copie', () => {
  it('ripete le carte secondo amount, o una per riga senza copie', () => {
    const cards = [card(1, 2), card(2, 0), card(3)]
    expect(expandCopies(cards, true).map((i) => `${i.card.n}.${i.copy}`)).toEqual([
      '1.1',
      '1.2',
      '3.1'
    ])
    expect(expandCopies(cards, false)).toHaveLength(3)
  })
})

describe('nomi dei file', () => {
  const parts = {
    set: 'Eroi',
    n: 7,
    digits: 3,
    copy: 2,
    side: 'back' as const,
    fields: { nome: 'Re/Regina' }
  }
  it('sostituisce i segnaposto e crea sottocartelle con /', () => {
    expect(fileName('%set/%n_{nome}_%side_%copy', parts)).toBe('Eroi/007_Re_Regina_back_2')
  })
  it('non esce dalla cartella e toglie i caratteri non ammessi', () => {
    expect(fileName('../%set', parts)).toBe('_/Eroi')
    expect(safeName('a:b*c?')).toBe('a_b_c_')
    // nomi riservati di Windows, con o senza estensione
    expect(safeName('CON')).toBe('_CON')
    expect(safeName('aux.png')).toBe('_aux.png')
    expect(safeName('console')).toBe('console')
  })
  it('rende unici i nomi uguali a meno di maiuscole', () => {
    expect(uniqueNames(['Eroi', 'eroi', 'Mostri', 'EROI'])).toEqual([
      'Eroi',
      'eroi_2',
      'Mostri',
      'EROI_3'
    ])
  })
  it('aggiunge lato e copia quando servono', () => {
    expect(effectivePattern({ ...DEFAULT_IMAGE, sides: 'both', copies: true })).toBe(
      '%set/%n_%side_%copy'
    )
  })
  it('numera i nomi ripetuti', () => {
    expect(uniqueNames(['a', 'b', 'A'])).toEqual(['a', 'b', 'A_2'])
  })
})

describe('impaginazione PDF', () => {
  it('mette 3 × 3 carte poker su un A4 con margini di 10 mm', () => {
    const g = pdfGrid(pdf(), tpl)
    expect([g.cols, g.rows]).toEqual([3, 3])
    expect(g.x0).toBeCloseTo((210 - 189) / 2)
  })
  it("con l'abbondanza le carte si toccano e la spaziatura non conta", () => {
    const g = pdfGrid(pdf({ bleed: true, spacing: 5, margin: 5, autoRotate: false }), tpl)
    expect(g.gap).toBe(0)
    expect(g.cellW).toBe(69)
    expect([g.cols, g.rows]).toEqual([2, 3])
  })
  it('ruota le carte quando ne entrano di più', () => {
    // 69 × 94 con l'abbondanza: dritte 2 × 3, ruotate 2 × 4
    const g = pdfGrid(pdf({ bleed: true, margin: 5 }), tpl)
    expect(g.rotated).toBe(true)
    expect([g.cellW, g.cellH, g.cols, g.rows]).toEqual([94, 69, 2, 4])
  })
  it('ruota una carta che dritta non entra nella pagina', () => {
    const big = normalizeTemplate({ name: 'p', width: 280, height: 200, front: [], back: [] })
    const g = pdfGrid(pdf({ margin: 5 }), big)
    expect(g.rotated).toBe(true)
    expect(gridOverflows(g)).toBe(false)
  })
  it('alterna fronti e retri e specchia i retri sul lato lungo', () => {
    const o = pdf({ duplex: 'long' })
    const g = pdfGrid(o, tpl)
    const pages = planPdfPages(o, g, expandCopies([card(1), card(2)], true))
    expect(pages.map((p) => p.side)).toEqual(['front', 'back'])
    expect(mirrorsX(o)).toBe(true)
    const front = pages[0].cards[0]
    const back = pages[1].cards[0]
    expect(back.x).toBeCloseTo(210 - front.x - 63)
    expect(back.y).toBeCloseTo(front.y)
  })
  it('sul lato corto specchia le righe, con lo spostamento dei retri', () => {
    const o = pdf({ duplex: 'short', offsetX: 1, offsetY: -0.5 })
    const g = pdfGrid(o, tpl)
    const f = cellPosition(o, g, 0, false)
    const b = cellPosition(o, g, 0, true)
    expect(b.x).toBeCloseTo(f.x + 1)
    expect(b.y).toBeCloseTo(297 - f.y - 88 - 0.5)
  })
  it('senza fronte-retro mette i retri dopo tutti i fronti', () => {
    const o = pdf({ sides: 'both' })
    const g = pdfGrid(o, tpl)
    const many = expandCopies([card(1, 12)], true)
    expect(planPdfPages(o, g, many).map((p) => p.side)).toEqual(['front', 'front', 'back', 'back'])
  })
  it("i segni agli angoli partono dal bordo dell'abbondanza", () => {
    const o = pdf({ bleed: true, markLength: 4 })
    const g = pdfGrid(o, tpl)
    const [page] = planPdfPages(o, g, expandCopies([card(1)], true))
    const marks = cropMarks(o, g, page.cards)
    expect(marks).toHaveLength(8)
    const c = page.cards[0]
    expect(marks[0]).toEqual({ x1: c.x + 3, y1: c.y - 4, x2: c.x + 3, y2: c.y })
  })
  it('le linee intere non si ripetono', () => {
    const o = pdf({ marks: 'lines' })
    const g = pdfGrid(o, tpl)
    const [page] = planPdfPages(o, g, expandCopies([card(1, 9)], true))
    // 3 colonne senza spaziatura: 4 linee verticali e 4 orizzontali
    expect(cropMarks(o, g, page.cards)).toHaveLength(8)
  })
})

describe('Tabletop Simulator', () => {
  it("lascia libera l'ultima posizione e riduce le posizioni vuote", () => {
    expect(ttsAutoGrid(4, 63, 88)).toEqual({ cols: 3, rows: 2 })
    expect(ttsAutoGrid(3, 63, 88)).toEqual({ cols: 2, rows: 2 })
    expect(ttsAutoGrid(69, 63, 88)).toEqual({ cols: 10, rows: 7 })
    const g = ttsAutoGrid(20, 63, 88)
    expect(g.cols * g.rows).toBeGreaterThanOrEqual(21)
  })
  it('resta entro la dimensione massima e i 300 DPI', () => {
    const s = ttsScale(10, 7, 63, 88, 4096)
    expect(10 * 63 * s).toBeLessThanOrEqual(4096)
    expect(Number.isInteger(63 * s)).toBe(true)
    expect(ttsScale(2, 2, 63, 88, 8192)).toBeLessThanOrEqual(300 / 25.4)
  })
  it('crea un mazzo con le copie e una carta sola se ce n’è una', () => {
    const sheet = { faceUrl: 'f', backUrl: 'b', cols: 3, rows: 2, uniqueBack: false }
    const deck = ttsSavedObject(
      'Eroi',
      [sheet],
      [
        { sheet: 0, slot: 0, nickname: 'A', description: '' },
        { sheet: 0, slot: 0, nickname: 'A', description: '' },
        { sheet: 0, slot: 1, nickname: 'B', description: 'x' }
      ]
    ) as { ObjectStates: Record<string, unknown>[] }
    const obj = deck.ObjectStates[0]
    expect(obj.Name).toBe('DeckCustom')
    expect(obj.DeckIDs).toEqual([100, 100, 101])
    const one = ttsSavedObject(
      'Eroi',
      [sheet],
      [{ sheet: 0, slot: 0, nickname: '', description: '' }]
    ) as { ObjectStates: Record<string, unknown>[] }
    expect(one.ObjectStates[0]).toMatchObject({ Name: 'CardCustom', CardID: 100, Nickname: 'Eroi' })
  })
  it('le carte orizzontali vanno di traverso: il lato corto misura come il lato lungo del poker', () => {
    const sheet = { faceUrl: 'f', backUrl: 'b', cols: 1, rows: 1, uniqueBack: false }
    const card = [{ sheet: 0, slot: 0, nickname: '', description: '' }]
    // plancia grande come due carte da poker affiancate: 126 × 88, giusta a scala 1
    const wide = ttsSavedObject('Plancia', [sheet], card, 126, 88) as {
      ObjectStates: { SidewaysCard: boolean; Transform: { scaleX: number } }[]
    }
    expect(wide.ObjectStates[0].SidewaysCard).toBe(true)
    expect(wide.ObjectStates[0].Transform.scaleX).toBe(1)
    const tall = ttsSavedObject('Eroi', [sheet], card, 63, 88) as typeof wide
    expect(tall.ObjectStates[0]).toMatchObject({ SidewaysCard: false, Transform: { scaleX: 1 } })
  })
  it('su Windows scrive le immagini nella forma che legge Tabletop Simulator', () => {
    const p = 'C:\\Users\\Anna\\Giochi\\Fora arma/export/tts/images/Armeria_faces_1.png'
    expect(ttsImageUrl(p, 'win32')).toBe(
      'file:///C:\\Users\\Anna\\Giochi\\Fora arma\\export\\tts\\images\\Armeria_faces_1.png'
    )
    expect(ttsImageUrl('/Users/luca/Saved Objects/città.png', 'darwin')).toBe(
      'file:////Users/luca/Saved Objects/città.png'
    )
  })
})

describe('Tabletop Simulator: segnalini e tessere', () => {
  const piece = (n: number, count = 1): TtsPiece => ({
    faceUrl: `file:///f${n}.png`,
    backUrl: `file:///b${n}.png`,
    nickname: `P${n}`,
    description: '',
    count
  })

  it('forma della tessera dalla forma della carta', () => {
    expect(ttsTileType({ shape: 'rect', cornerRadius: 0 })).toBe(0)
    expect(ttsTileType({ cornerRadius: 3 })).toBe(3)
    expect(ttsTileType({ shape: 'hexagon', cornerRadius: 3 })).toBe(1)
    expect(ttsTileType({ shape: 'ellipse', cornerRadius: 0 })).toBe(2)
    expect(ttsTileType({ shape: 'path', cornerRadius: 3 })).toBe(0)
  })

  it('colori da #RGB e #RRGGBB, bianco se non si capisce', () => {
    expect(ttsColor('#FF0000')).toEqual({ r: 1, g: 0, b: 0 })
    expect(ttsColor('#0f0')).toEqual({ r: 0, g: 1, b: 0 })
    expect(ttsColor('rosso')).toEqual({ r: 1, g: 1, b: 1 })
  })

  it('un pezzo solo è l oggetto stesso, con il nome del set se non ne ha uno', () => {
    const saved = ttsSavedPieces(
      'Monete',
      'token',
      { thickness: 2.8, edgeColor: '#000' },
      0,
      [{ ...piece(1), nickname: '' }],
      { w: 29, h: 29 }
    )
    expect(saved).toMatchObject({
      ObjectStates: [
        {
          Name: 'Custom_Token',
          Nickname: 'Monete',
          CustomImage: {
            ImageURL: 'file:///f1.png',
            ImageSecondaryURL: '',
            CustomToken: { Thickness: 0.1 }
          }
        }
      ]
    })
  })

  it('le pedine sono segnalini in piedi, con la sola immagine del fronte', () => {
    const saved = ttsSavedPieces(
      'Eroi',
      'standee',
      { thickness: 3, edgeColor: '#000' },
      0,
      [piece(1)],
      { w: 27, h: 52 }
    )
    expect(saved).toMatchObject({
      ObjectStates: [
        {
          Name: 'Custom_Token',
          CustomImage: {
            ImageSecondaryURL: '',
            CustomToken: { StandUp: true, Thickness: 0.107 }
          },
          // la figura sta nel piano X-Y: la scala non va su Z, lo spessore
          Transform: { scaleX: 0.301, scaleY: 0.301, scaleZ: 1 }
        }
      ]
    })
  })

  it('più pezzi vanno in un sacchetto, copie comprese; le tessere hanno retro e bordo colorato', () => {
    const saved = ttsSavedPieces(
      'Terreni',
      'tile',
      { thickness: 2.8, edgeColor: '#0000FF' },
      1,
      [piece(1, 2), piece(2)],
      { w: 45, h: 40 }
    ) as { ObjectStates: { Name: string; ContainedObjects: { Nickname: string }[] }[] }
    const [bag] = saved.ObjectStates
    expect(bag).toMatchObject({ Name: 'Bag', Nickname: 'Terreni' })
    expect(bag.ContainedObjects.map((o) => o.Nickname)).toEqual(['P1', 'P1', 'P2'])
    expect(bag.ContainedObjects[2]).toMatchObject({
      Name: 'Custom_Tile',
      ColorDiffuse: { r: 0, g: 0, b: 1 },
      CustomImage: {
        ImageSecondaryURL: 'file:///b2.png',
        CustomTile: { Type: 1, Thickness: 0.1, Stretch: true }
      }
    })
  })

  it('scale nelle proporzioni vere rispetto a una carta da 63 mm', () => {
    // la carta si misura sull'altezza: 63 × 88 a scala 1, 63 × 176 a scala 2, mini 44 × 63
    expect(ttsCardScale(88)).toBe(1)
    expect(ttsCardScale(176)).toBe(2)
    expect(ttsCardScale(63)).toBeCloseTo(0.716, 3)
    // misurati in TTS (la tessera poi corretta del 3% con le plance accanto alle carte): stella da 27 mm (29 con il margine) 3
    expect(ttsPieceScale('tile', 45, 45)).toBeCloseTo(0.78, 3)
    expect(ttsPieceScale('token', 29, 29)).toBeCloseTo(0.324, 3)
    // la tessera si misura sull'altezza: plance 120 × 88 e 63 × 176 provate in TTS
    expect(ttsPieceScale('board', 120, 88)).toBeCloseTo(1.526, 3)
    expect(ttsPieceScale('board', 63, 176)).toBeCloseTo(3.051, 3)
    // il segnalino si misura sulla larghezza: una pedina 25 × 50 (27 × 52 con il margine) è larga
    // 27 mm, non 52
    expect(ttsPieceScale('standee', 27, 52)).toBeCloseTo(0.301, 3)
  })

  it('le pedine hanno uno spessore predefinito di 10 mm, gli altri pezzi di 2 mm', () => {
    expect(ttsSetObject({}, 'Eroi', 'standee').thickness).toBe(10)
    expect(ttsSetObject({}, 'Segnalini', 'token').thickness).toBe(2)
    expect(
      ttsSetObject(
        { objects: { Eroi: { type: 'standee', thickness: 20, edgeColor: '#FFFFFF' } } },
        'Eroi'
      ).thickness
    ).toBe(20)
  })
})

describe('Tabletop Simulator: plance e dadi', () => {
  it('le plance non vanno in un sacchetto e non si impilano: una accanto all altra', () => {
    const board = (n: number, count = 1): TtsPiece => ({
      faceUrl: `file:///f${n}.png`,
      backUrl: `file:///b${n}.png`,
      nickname: '',
      description: '',
      count
    })
    const saved = ttsSavedPieces(
      'Mappa',
      'board',
      { thickness: 3, edgeColor: '#000' },
      0,
      [board(1, 2), board(2)],
      { w: 300, h: 200 }
    ) as { ObjectStates: { Nickname: string; Transform: { posX: number } }[] }
    expect(saved.ObjectStates.map((o) => o.Nickname)).toEqual(['Mappa 1', 'Mappa 2', 'Mappa 3'])
    const xs = saved.ObjectStates.map((o) => o.Transform.posX)
    expect(xs[0]).toBe(0)
    expect(xs[1] - xs[0]).toBeGreaterThan((300 * 2.25) / 63)
    expect(saved.ObjectStates[2]).toMatchObject({
      Name: 'Custom_Tile',
      // le plance sono sempre "Rounded" (3), qualunque forma abbia la carta
      CustomImage: {
        ImageSecondaryURL: 'file:///b2.png',
        CustomTile: { Type: 3, Stackable: false, Stretch: true }
      }
    })
  })

  it('il cubo del dado: facce verso fuori, ogni valore nella sua cella e dritto', () => {
    const lines = ttsDieObj(2).split('\n')
    const v = lines.filter((l) => l.startsWith('v ')).map((l) => l.slice(2).split(' ').map(Number))
    const vt = lines
      .filter((l) => l.startsWith('vt '))
      .map((l) => l.slice(3).split(' ').map(Number))
    const f = lines.filter((l) => l.startsWith('f ')).map((l) => l.slice(2).split(' '))
    expect([v.length, vt.length, f.length]).toEqual([24, 24, 12])
    // valore k + 1: normale verso fuori, cella (k % 3, k / 3) del foglio
    const normals = [
      [0, 1, 0],
      [0, 0, 1],
      [1, 0, 0],
      [-1, 0, 0],
      [0, 0, -1],
      [0, -1, 0]
    ]
    for (let k = 0; k < 6; k++) {
      const [a, b, c] = f[k * 2].map((s) => v[Number(s.split('/')[0]) - 1])
      const e1 = [0, 1, 2].map((j) => b[j] - a[j])
      const e2 = [0, 1, 2].map((j) => c[j] - a[j])
      const n = [
        e1[1] * e2[2] - e1[2] * e2[1],
        e1[2] * e2[0] - e1[0] * e2[2],
        e1[0] * e2[1] - e1[1] * e2[0]
      ].map((x) => Math.sign(x) + 0)
      expect(n).toEqual(normals[k])
      const uv = vt.slice(k * 4, k * 4 + 4)
      const cu = uv.reduce((s, p) => s + p[0], 0) / 4
      const cv = uv.reduce((s, p) => s + p[1], 0) / 4
      expect(Math.floor(cu * 3)).toBe(k % 3)
      expect(Math.floor((1 - cv) * 2)).toBe(Math.floor(k / 3))
    }
    // facce laterali: il bordo alto dell'immagine è in alto sul dado
    const top = vt[4 + 2][1]
    expect(v[4 + 2][1]).toBe(1)
    expect(top).toBeGreaterThan(vt[4][1])
  })

  it('valori e rotazioni del dado; più dadi in un sacchetto', () => {
    const rot = ttsDieRotations(['A', '', 'C'])
    expect(rot.map((r) => r.Value)).toEqual(['A', '2', 'C', '4', '5', '6'])
    expect(rot[5]).toMatchObject({ Rotation: { x: 180, y: 0, z: 0 } })
    const die = (n: number, count = 1): TtsDie => ({
      imageUrl: `file:///d${n}.png`,
      values: ['1', '2', '3', '4', '5', '6'],
      nickname: `D${n}`,
      description: '',
      count
    })
    const one = ttsSavedDice('Dadi', [{ ...die(1), nickname: '' }], 'file:///d6.obj')
    expect(one).toMatchObject({
      ObjectStates: [
        {
          Name: 'Custom_Model',
          Nickname: 'Dadi',
          CustomMesh: { MeshURL: 'file:///d6.obj', DiffuseURL: 'file:///d1.png', TypeIndex: 2 }
        }
      ]
    })
    const many = ttsSavedDice('Dadi', [die(1, 2), die(2)], 'file:///d6.obj') as {
      ObjectStates: { Name: string; ContainedObjects: { Nickname: string }[] }[]
    }
    expect(many.ObjectStates[0].Name).toBe('Bag')
    expect(many.ObjectStates[0].ContainedObjects.map((o) => o.Nickname)).toEqual(['D1', 'D1', 'D2'])
  })
})
