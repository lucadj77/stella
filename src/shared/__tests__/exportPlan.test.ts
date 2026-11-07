import { describe, expect, it } from 'vitest'
import { DEFAULT_IMAGE, DEFAULT_PDF, DEFAULT_TTS, type ExportCard, type ExportSet } from '../export'
import {
  dieNet,
  diePage,
  netTabDepth,
  piecePage,
  planImages,
  planPdf,
  planTts,
  posterLayout,
  sheetPage
} from '../exportPlan'
import { normalizeTemplate } from '../model/normalize'

const tpl = normalizeTemplate({ name: 't', width: 63, height: 88, bleed: 3, front: [], back: [] })
const card = (n: number, amount = 1, nome = `Carta ${n}`): ExportCard => ({
  n,
  amount,
  label: `c${n}`,
  fields: { nome },
  template: tpl
})

describe("piano dell'esportazione", () => {
  it('immagini: un file per carta e lato, nomi ripetuti numerati, copie raggruppate', () => {
    const sets = [{ name: 'eroi', cards: [card(1, 2, 'A'), card(2, 1, 'A')] }]
    const files = planImages({ ...DEFAULT_IMAGE, pattern: '%set/{nome}', copies: true }, sets)
    expect(files.map((f) => f.names)).toEqual([['eroi/A_1', 'eroi/A_2'], ['eroi/A_1_2']])
  })

  it('PDF: un documento per set con le sue pagine', () => {
    const cards = Array.from({ length: 10 }, (_, i) => card(i + 1))
    const plan = planPdf(
      { ...DEFAULT_PDF, split: 'set', sides: 'front' },
      [
        { name: 'a', cards },
        { name: 'a', cards: [card(1)] }
      ],
      'gioco'
    )
    expect(plan.docs.map((d) => [d.name, d.pages.length])).toEqual([
      ['a', 2],
      ['a_2', 1]
    ])
    expect(plan.overflow).toEqual([])
  })

  it('poster: parti che si sovrappongono almeno quanto chiesto, orientamento con meno pagine', () => {
    // plancia 400 × 300 su A4 con 10 mm di margine (190 × 277): ruotata bastano 2 × 2 pagine
    const L = posterLayout(400, 300, 190, 277, 10, true)
    expect([L.cols, L.rows, L.rotated]).toEqual([2, 2, true])
    expect(190 - L.stepX).toBeGreaterThanOrEqual(10)
    const up = posterLayout(400, 300, 190, 277, 10, false)
    expect([up.cols, up.rows]).toEqual([3, 2])
    // la fine dell'ultima parte coincide con il bordo della carta
    expect((up.cols - 1) * up.stepX + up.tileW).toBeCloseTo(400)
  })

  it('PDF: una carta più grande della pagina diventa un poster con le parti nominate', () => {
    const big = normalizeTemplate({ name: 'p', width: 400, height: 300, bleed: 3 })
    const sets = [{ name: 'plancia', cards: [{ ...card(1), template: big }] }]
    const o = { ...DEFAULT_PDF, sides: 'front' as const, bleed: false }
    const plan = planPdf(o, sets, 'gioco')
    expect(plan.overflow).toEqual([])
    const pages = plan.docs[0].pages
    expect(pages).toHaveLength(4)
    expect(pages.map((p) => p.labels?.[0].text.split(' ')[0])).toEqual(['A1', 'B1', 'A2', 'B2'])
    expect(pages[0].clip).toBeDefined()
    // senza poster resta una pagina che esce dai bordi, segnalata
    expect(planPdf({ ...o, poster: false }, sets, 'gioco').overflow).toEqual(['plancia'])
  })

  it("Tabletop Simulator: la carta nascosta occupa l'ultima posizione del foglio", () => {
    const [plan] = planTts(DEFAULT_TTS, [{ name: 's', cards: [card(1), card(2), card(3)] }])
    expect(plan.chunks).toHaveLength(1)
    const page = sheetPage(plan.chunks[0], 'front')
    const { cols, rows } = plan.chunks[0]
    expect(page.items).toHaveLength(4)
    expect(page.items[3]).toMatchObject({
      x: (cols - 1) * 63,
      y: (rows - 1) * 88,
      side: 'back'
    })
  })
})

describe('PDF: set uno dopo l altro', () => {
  const cards = (n: number, t = tpl): ExportCard[] =>
    Array.from({ length: n }, (_, i) => ({ ...card(i + 1), template: t }))
  const o = { ...DEFAULT_PDF, sides: 'front' as const, autoRotate: false }

  it('stessa misura: 10 + 8 carte, 9 per pagina, stanno in 2 pagine invece di 3', () => {
    const sets = [
      { name: 'a', cards: cards(10) },
      { name: 'b', cards: cards(8) }
    ]
    expect(planPdf(o, sets, 'g').docs[0].pages).toHaveLength(3)
    const pages = planPdf({ ...o, continuous: true }, sets, 'g').docs[0].pages
    expect(pages.map((p) => p.items.length)).toEqual([9, 9])
    // con un PDF per set l'opzione non conta
    const split = planPdf({ ...o, continuous: true, split: 'set' }, sets, 'g').docs
    expect(split.map((d) => d.pages.length)).toEqual([2, 1])
  })

  it('misure diverse: il set seguente comincia su una riga nuova sotto il precedente', () => {
    const small = normalizeTemplate({ name: 's', width: 40, height: 40, front: [], back: [] })
    const sets = [
      { name: 'a', cards: cards(4) },
      { name: 'b', cards: cards(4, small) }
    ]
    const pages = planPdf({ ...o, continuous: true }, sets, 'g').docs[0].pages
    expect(pages).toHaveLength(1)
    const [page] = pages
    expect(page.items).toHaveLength(8)
    const big = page.items.filter((i) => i.template.width === 63)
    const little = page.items.filter((i) => i.template.width === 40)
    // le carte grandi in due righe, le piccole tutte in una riga sotto
    expect(new Set(big.map((i) => i.y)).size).toBe(2)
    expect(new Set(little.map((i) => i.y)).size).toBe(1)
    expect(Math.min(...little.map((i) => i.y))).toBeGreaterThan(
      Math.max(...big.map((i) => i.y)) + 88
    )
    for (const i of page.items) expect(i.y + i.template.height).toBeLessThanOrEqual(297 - 10)
    // in alto, non al centro della pagina: il taglio parte sempre dallo stesso bordo
    expect(Math.min(...big.map((i) => i.y))).toBeLessThan(10 + 5)
  })

  it('misure diverse: due set uguali seguiti da uno diverso riempiono la stessa riga', () => {
    const small = normalizeTemplate({ name: 's', width: 40, height: 40, front: [], back: [] })
    const sets = [
      { name: 'a', cards: cards(2) },
      { name: 'b', cards: cards(1) },
      { name: 'c', cards: cards(2, small) }
    ]
    const [page] = planPdf({ ...o, continuous: true }, sets, 'g').docs[0].pages
    const big = page.items.filter((i) => i.template.width === 63)
    expect(new Set(big.map((i) => i.y)).size).toBe(1)
  })

  it('carte ruotate e carte dritte con la stessa cella continuano sulla stessa riga', () => {
    const wide = normalizeTemplate({ name: 'w', width: 88, height: 63, front: [], back: [] })
    const sets = [
      { name: 'a', cards: cards(5, wide) },
      { name: 'b', cards: cards(4) }
    ]
    const opts = { ...o, autoRotate: true, continuous: true }
    const [page] = planPdf(opts, sets, 'g').docs[0].pages
    expect(page.items).toHaveLength(9)
    const turned = page.items.filter((i) => i.template.width === 88)
    const upright = page.items.filter((i) => i.template.width === 63)
    expect(turned.every((i) => i.rotate === 90)).toBe(true)
    expect(upright.every((i) => i.rotate === 0)).toBe(true)
    // la prima carta dritta prende il posto libero della seconda riga, senza spazio in più
    const rows = [...new Set(page.items.map((i) => i.y))].sort((x, y) => x - y)
    expect(rows).toHaveLength(3)
    expect(upright.filter((i) => i.y === rows[1])).toHaveLength(1)
    expect(rows[2] - rows[1]).toBeCloseTo(rows[1] - rows[0])
  })

  it('misure diverse con fronte e retro: ogni pagina di fronti seguita dai suoi retri', () => {
    const small = normalizeTemplate({ name: 's', width: 40, height: 40, front: [], back: [] })
    const sets = [
      { name: 'a', cards: cards(8) },
      { name: 'b', cards: cards(20, small) }
    ]
    const pages = planPdf({ ...o, continuous: true, duplex: 'long' }, sets, 'g').docs[0].pages
    expect(pages.length % 2).toBe(0)
    expect(pages[1].items.every((i) => i.side === 'back')).toBe(true)
    expect(pages[1].items).toHaveLength(pages[0].items.length)
    const total = pages.filter((_, k) => k % 2 === 0).reduce((n, p) => n + p.items.length, 0)
    expect(total).toBe(28)
  })
})

describe('Tabletop Simulator: segnalini e tessere', () => {
  it('un set di segnalini non ha fogli: un pezzo per carta con le sue copie', () => {
    const o = {
      ...DEFAULT_TTS,
      objects: { s: { type: 'token' as const, thickness: 0.3, edgeColor: '#FFF' } }
    }
    const [plan, other] = planTts(o, [
      { name: 's', cards: [card(1, 3), card(2, 0), card(3, 1)] },
      { name: 'carte', cards: [card(1)] }
    ])
    expect(plan.chunks).toEqual([])
    expect(plan.pieces.map((p) => [p.card.n, p.count])).toEqual([
      [1, 3],
      [3, 1]
    ])
    expect(plan.pieces[0].scale).toBeLessThanOrEqual(300 / 25.4)
    expect(other.object.type).toBe('card')
    expect(other.chunks).toHaveLength(1)
  })

  it('il segnalino ha un margine trasparente, la tessera è il rettangolo della carta', () => {
    const token = piecePage(tpl, 'front', 'token')
    expect([token.width, token.height]).toEqual([65, 90])
    expect(token.items[0]).toMatchObject({ x: 1, y: 1, mode: 'trim' })
    const tile = piecePage(tpl, 'back', 'tile')
    expect([tile.width, tile.height]).toEqual([63, 88])
    expect(tile.items[0]).toMatchObject({ side: 'back', mode: 'cut' })
  })
})

describe('Tabletop Simulator: dadi', () => {
  it('sei carte per dado, l ultimo completato ripetendo le sue facce', () => {
    const o = {
      ...DEFAULT_TTS,
      objects: { d: { type: 'die' as const, thickness: 2, edgeColor: '#FFF' } }
    }
    const cards = Array.from({ length: 8 }, (_, i) => card(i + 1, i === 6 ? 3 : 1))
    const [plan] = planTts(o, [{ name: 'd', cards }])
    expect(plan.chunks).toEqual([])
    expect(plan.pieces).toEqual([])
    expect(plan.dice.map((d) => d.cards.map((c) => c.n))).toEqual([
      [1, 2, 3, 4, 5, 6],
      [7, 8, 7, 8, 7, 8]
    ])
    expect(plan.dice.map((d) => [d.count, d.padded])).toEqual([
      [1, false],
      [3, true]
    ])
    const page = diePage(plan.dice[0])
    expect([page.width, page.height]).toEqual([189, 176])
    expect(page.items[4]).toMatchObject({ x: 63, y: 88, side: 'front', mode: 'cut' })
  })
})

describe('piegatura e fogli di prova', () => {
  it('piegatura: fronte e retro affiancati, abbondanza solo all esterno', () => {
    const cards = Array.from({ length: 5 }, (_, i) => card(i + 1))
    const o = { ...DEFAULT_PDF, fold: true, bleed: true, landscape: true, duplex: 'long' as const }
    const plan = planPdf(o, [{ name: 'a', cards }], 'gioco')
    const page = plan.docs[0].pages[0]
    // A4 orizzontale, 297 - 20 di margine: coppie larghe 2 × 63 + 6 → 2 per riga, 2 righe
    expect(plan.docs[0].pages).toHaveLength(2)
    const [front, back] = page.items
    expect([front.side, back.side]).toEqual(['front', 'back'])
    expect(back.x - front.x).toBe(63)
    expect(front.crop).toEqual({ l: 0, r: 3 })
    expect(back.crop).toEqual({ l: 3, r: 0 })
    // la piegatura è tratteggiata, sulla linea tra i due lati
    const fold = page.lines.filter((l) => l.dash)
    expect(fold[0].x1).toBeCloseTo(front.x + 3 + 63)
  })

  it('fogli di prova: un PDF in più con tutte le carte rimpicciolite', () => {
    const cards = Array.from({ length: 3 }, (_, i) => card(i + 1))
    const plan = planPdf(
      { ...DEFAULT_PDF, proof: true, sides: 'both' },
      [{ name: 'a', cards }],
      'gioco'
    )
    expect(plan.docs.map((d) => d.name)).toEqual(['gioco', 'gioco_proof'])
    const proof = plan.docs[1].pages[0]
    expect(proof.items).toHaveLength(6)
    expect(proof.items[0].zoom).toBeLessThan(1)
    expect(proof.labels?.map((l) => l.text).slice(0, 2)).toEqual(['a 1', 'a 1 · back'])
  })
})

describe('casi limite', () => {
  it('immagini: nomi unici tra set diversi anche senza %set', () => {
    const sets = [
      { name: 'eroi', cards: [card(1, 1, 'A')] },
      { name: 'mostri', cards: [card(1, 1, 'A')] }
    ]
    const files = planImages({ ...DEFAULT_IMAGE, pattern: '{nome}' }, sets)
    expect(files.map((f) => f.names[0])).toEqual(['A', 'A_2'])
  })

  it('poster: senza area utile il conto delle parti resta finito', () => {
    const L = posterLayout(63, 88, 0, 77, 10, true)
    expect(Number.isFinite(L.cols) && Number.isFinite(L.rows)).toBe(true)
    expect(L.cols * L.rows).toBeLessThanOrEqual(4)
    const big = normalizeTemplate({ name: 'big', width: 300, height: 400, front: [], back: [] })
    const sets = [{ name: 'eroi', cards: [{ ...card(1), template: big }] }]
    const plan = planPdf({ ...DEFAULT_PDF, poster: true, margin: 105, sides: 'front' }, sets, 'p')
    expect(plan.overflow).toEqual(['eroi'])
    expect(plan.docs.every((d) => d.pages.length < 100)).toBe(true)
    const grid = planPdf({ ...DEFAULT_PDF, margin: 200, sides: 'front' }, sets, 'p')
    expect(grid.overflow).toEqual(['eroi'])
  })
  it('TTS: copie nel mazzo o ripetute nel foglio', () => {
    const sets = [{ name: 's', cards: [card(1, 3), card(2, 0), card(3, 1)] }]
    const [deck] = planTts(DEFAULT_TTS, sets)
    expect(deck.chunks[0].cards.map((c) => c.n)).toEqual([1, 3])
    expect(deck.chunks[0].counts).toEqual([3, 1])
    const [sheet] = planTts({ ...DEFAULT_TTS, copiesIn: 'sheet' }, sets)
    expect(sheet.chunks[0].cards.map((c) => c.n)).toEqual([1, 1, 1, 3])
    expect(sheet.chunks[0].counts).toEqual([1, 1, 1, 1])
    // senza copie la scelta non conta: una carta per riga
    const [none] = planTts({ ...DEFAULT_TTS, copies: false, copiesIn: 'sheet' }, sets)
    expect(none.chunks[0].cards.map((c) => c.n)).toEqual([1, 2, 3])
    expect(none.chunks[0].counts).toEqual([1, 1, 1])
  })
  it('TTS: le copie ripetute nel foglio usano il template di ogni copia', () => {
    const t2 = normalizeTemplate({ name: 't2', width: 63, height: 88, front: [], back: [] })
    const c = { ...card(1, 2), perCopy: [tpl, t2] }
    const [plan] = planTts({ ...DEFAULT_TTS, copiesIn: 'sheet' }, [{ name: 's', cards: [c] }])
    expect(plan.chunks[0].cards.map((x) => x.template.name)).toEqual(['t', 't2'])
  })

  describe('sviluppo dei dadi', () => {
    const face = normalizeTemplate({ name: 'd', kind: 'die', width: 20, height: 20, bleed: 2 })
    const die = (n: number, amount = 1): ExportCard => ({ ...card(n, amount), template: face })
    const dice = (cards: ExportCard[]): ExportSet[] => [
      { name: 'dadi', kind: 'die' as const, cards }
    ]

    it('croce di sei facce con le opposte che fanno 7, sette linguette e cinque pieghe interne', () => {
      const net = dieNet(Array(6).fill(face), false)
      const d = netTabDepth(20)
      expect(d).toBe(5)
      // un dado piccolo ha comunque linguette da 5 mm; si possono chiedere più grandi
      expect(netTabDepth(12)).toBe(5)
      expect(netTabDepth(12, 8)).toBe(8)
      expect(netTabDepth(12, 50)).toBe(20)
      expect([net.width, net.height]).toEqual([80 + 2 * d, 60 + 2 * d])
      const at = net.items.map((it) => [(it.x - d) / 20, (it.y - d) / 20])
      // 1 al centro, 6 dall'altra parte della fila; 2 e 5 ai lati; 3 sopra e 4 sotto
      expect(at).toEqual([
        [1, 1],
        [0, 1],
        [1, 0],
        [1, 2],
        [2, 1],
        [3, 1]
      ])
      expect(net.shapes).toHaveLength(7)
      // le linguette sono la faccia da cui partono, specchiata e ritagliata sulla loro forma
      expect(net.tabs).toHaveLength(7)
      expect(net.tabs[0]).toMatchObject({ x: d, flip: 'y', template: face })
      expect(net.tabs[0].y).toBeCloseTo(d + 0.2)
      expect(net.tabs[0].clip?.slice(2)).toEqual(net.shapes[0].points.slice(2))
      const right = net.tabs.find((t) => t.flip === 'x')
      expect([right?.x, right?.y]).toEqual([d + 80 - 0.2, d + 20])
      expect(net.folds.filter((l) => l.dash)).toHaveLength(5 + 7)
      // il contorno: 7 lati senza linguetta e 3 tratti per linguetta
      expect(net.cut).toHaveLength(7 + 7 * 3)
      expect(net.items.every((it) => it.mode === 'cut' && !it.crop)).toBe(true)
    })

    it("con l'abbondanza ogni faccia la perde dove tocca un'altra", () => {
      const net = dieNet(Array(6).fill(face), true)
      expect(net.items[0].crop).toEqual({ l: 2, r: 2, t: 2, b: 2 })
      expect(net.items[1].crop).toEqual({ l: 0, r: 2, t: 0, b: 0 })
      expect(net.items[2].crop).toEqual({ l: 0, r: 0, t: 0, b: 2 })
      expect(net.items.every((it) => it.mode === 'bleed')).toBe(true)
    })

    it('PDF: un dado ogni sei facce, con le copie del primo, linee solo con i segni di taglio', () => {
      const cards = [die(1, 2), ...Array.from({ length: 5 }, (_, i) => die(i + 2))]
      const o = { ...DEFAULT_PDF, dice: 'net' as const, copies: true }
      const plan = planPdf(o, dice(cards), 'gioco')
      const page = plan.docs[0].pages[0]
      expect(page.items).toHaveLength(12 + 14)
      expect(page.shapes).toHaveLength(14)
      expect(page.lines.length).toBeGreaterThan(0)
      expect(page.linesOver).toBe(true)
      const none = planPdf({ ...o, marks: 'none' }, dice(cards), 'gioco')
      expect(none.docs[0].pages[0].lines).toEqual([])
      expect(plan.notes).toEqual([])
    })

    it('PDF: facce non quadrate o set incompleti lo dicono', () => {
      const wide = normalizeTemplate({ name: 'w', kind: 'die', width: 20, height: 25 })
      const o = { ...DEFAULT_PDF, dice: 'net' as const }
      const odd = planPdf(o, dice([{ ...die(1), template: wide }]), 'g')
      expect(odd.notes[0].key).toBe('export.dieNotSquare')
      expect(odd.docs[0].pages[0].shapes).toBeUndefined()
      const short = planPdf(o, dice([die(1), die(2)]), 'g')
      expect(short.notes[0].key).toBe('export.ttsDicePadded')
      expect(short.docs[0].pages[0].items).toHaveLength(6 + 7)
    })

    it('PDF: con il fronte-retro ogni pagina di dadi ha una pagina vuota dietro', () => {
      const cards = Array.from({ length: 6 }, (_, i) => die(i + 1))
      const plan = planPdf({ ...DEFAULT_PDF, dice: 'net', duplex: 'long' }, dice(cards), 'g')
      expect(plan.docs[0].pages.map((p) => p.items.length)).toEqual([6 + 7, 0])
    })

    it('con le facce separate i dadi restano come prima', () => {
      const cards = Array.from({ length: 6 }, (_, i) => die(i + 1))
      const plan = planPdf(DEFAULT_PDF, dice(cards), 'g')
      expect(plan.docs[0].pages[0].shapes).toBeUndefined()
    })
  })
})
