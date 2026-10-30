// Crea il progetto del video 24 (approfondimento «il tabellone»): un tabellone quadrato di 38 × 38 cm
// vuoto, che il video riempie un pezzo alla volta, e i componenti che ci vanno sopra: un mazzo di carte,
// le tessere tonde da 30 mm, le plance dei giocatori A5 e le pedine in piedi, tutte e due con il colore
// preso dal foglio. Le icone (moneta, gemma, legno, pietra, stella, bandiera) sono variabili immagine.
// Uso: node progetto-tabellone.mjs <cartella di destinazione> <it|en>
//      oppure da un altro script: make(cartella, lingua)
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { writeIcons } from './progetto-testo.mjs'
const REPO = new URL('../..', import.meta.url).pathname
const ExcelJS = createRequire(join(REPO, 'package.json'))('exceljs')

const box = (x, y, w, h) => ({ x, y, w, h })
const fixed = { source: { kind: 'fixed' } }

export function names(lang) {
  const it = lang === 'it'
  const L = (a, b) => (it ? a : b)
  return {
    project: L('Tabellone', 'Game board'),
    folder: L('Tabellone', 'Game board'),
    // set e template
    board: L('Tabellone', 'Board'),
    cards: L('Carte', 'Cards'),
    tiles: L('Tessere', 'Tiles'),
    players: L('Giocatori', 'Players'),
    pawns: L('Pedine', 'Pawns'),
    tBoard: L('tabellone', 'board'),
    tCard: L('carta', 'card'),
    tTile: L('tessera', 'tile'),
    tPlayer: L('plancia_giocatore', 'player_board'),
    tPawn: L('pedina', 'pawn'),
    C: {
      name: L('nome', 'name'),
      color: L('colore', 'color'),
      bg: L('sfondo', 'background'),
      frame: L('bordo', 'frame'),
      icon: L('icona', 'icon'),
      text: L('testo', 'text'),
      figure: L('sagoma', 'figure')
    },
    V: {
      coin: L('moneta', 'coin'),
      gem: L('gemma', 'gem'),
      wood: L('legno', 'wood'),
      stone: L('pietra', 'stone'),
      star: L('stella', 'star'),
      flag: L('bandiera', 'flag'),
      meeple: L('omino', 'meeple')
    }
  }
}

const COLORS = {
  it: [
    ['Rosso', '#C0392B'],
    ['Blu', '#2E6DB4'],
    ['Verde', '#3D8B4F'],
    ['Giallo', '#D9A21B']
  ],
  en: [
    ['Red', '#C0392B'],
    ['Blue', '#2E6DB4'],
    ['Green', '#3D8B4F'],
    ['Yellow', '#D9A21B']
  ]
}
const CARDS = {
  it: [
    ['Carovana', 'Prendi 2 monete.'],
    ['Esploratore', 'Muovi la pedina di 3 caselle.'],
    ['Minatore', 'Prendi 1 pietra e 1 gemma.'],
    ['Taglialegna', 'Prendi 2 legni.'],
    ['Mercante', 'Scambia 2 risorse con 1 gemma.'],
    ['Costruttore', 'Paga 2 legni e 1 pietra: 3 punti.']
  ],
  en: [
    ['Caravan', 'Take 2 coins.'],
    ['Explorer', 'Move your pawn 3 spaces.'],
    ['Miner', 'Take 1 stone and 1 gem.'],
    ['Woodcutter', 'Take 2 wood.'],
    ['Merchant', 'Trade 2 resources for 1 gem.'],
    ['Builder', 'Pay 2 wood and 1 stone: 3 points.']
  ]
}

export async function make(dest, lang) {
  const it = lang === 'it'
  const L = (a, b) => (it ? a : b)
  const N = names(lang)
  const { C, V } = N
  rmSync(dest, { recursive: true, force: true })
  for (const d of ['data', 'templates', 'assets/icons'])
    mkdirSync(join(dest, d), { recursive: true })

  writeIcons(dest, {
    [V.coin]: 'delapouite/two-coins',
    [V.gem]: 'lorc/emerald',
    [V.wood]: 'delapouite/log',
    [V.stone]: 'delapouite/stone-pile',
    [V.star]: 'delapouite/star-formation',
    [V.flag]: 'delapouite/flag-objective',
    [V.meeple]: 'delapouite/meeple'
  })

  const board = {
    name: N.tBoard,
    kind: 'board',
    width: 380,
    height: 380,
    bleed: 3,
    safeMargin: 5,
    cornerRadius: 0,
    front: [
      { type: 'shape', name: C.bg, ...box(-3, -3, 386, 386), fill: '#EFE6D2', locked: true, ...fixed }
    ],
    back: []
  }

  const card = {
    name: N.tCard,
    width: 63,
    height: 88,
    bleed: 3,
    safeMargin: 3,
    cornerRadius: 3,
    front: [
      {
        type: 'text',
        name: C.name,
        ...box(6, 8, 51, 10),
        text: L('Nome', 'Name'),
        weight: 800,
        size: 13,
        color: '#3B2A14',
        align: 'center',
        valign: 'middle',
        fit: 'shrink'
      },
      {
        type: 'text',
        name: C.text,
        ...box(7, 50, 49, 28),
        text: '',
        weight: 500,
        size: 10,
        color: '#2A241C',
        align: 'center',
        valign: 'middle'
      },
      {
        type: 'image',
        name: C.icon,
        ...box(19, 22, 25, 25),
        src: V.flag,
        fit: 'contain',
        tint: '#8A5A2B',
        ...fixed
      },
      {
        type: 'shape',
        name: C.bg,
        ...box(-3, -3, 69, 94),
        fill: '#F6EEDD',
        locked: true,
        ...fixed
      }
    ],
    back: []
  }

  const tile = {
    name: N.tTile,
    kind: 'tile',
    width: 30,
    height: 30,
    shape: 'ellipse',
    bleed: 2,
    safeMargin: 2,
    cornerRadius: 0,
    front: [
      {
        type: 'image',
        name: C.icon,
        ...box(6, 6, 18, 18),
        src: V.coin,
        fit: 'contain',
        tint: '#3B2A14'
      },
      {
        type: 'shape',
        name: C.bg,
        ...box(-2, -2, 34, 34),
        shape: 'ellipse',
        fill: '#E8C26A',
        locked: true,
        ...fixed
      }
    ],
    back: []
  }

  const player = {
    name: N.tPlayer,
    kind: 'board',
    width: 210,
    height: 148,
    bleed: 3,
    safeMargin: 5,
    cornerRadius: 3,
    front: [
      {
        type: 'text',
        name: C.name,
        ...box(14, 12, 182, 16),
        text: L('Giocatore', 'Player'),
        weight: 800,
        size: 22,
        color: '#2A241C',
        align: 'center',
        valign: 'middle'
      },
      {
        type: 'shape',
        name: L('fondo', 'panel'),
        ...box(8, 8, 194, 132),
        radius: 4,
        fill: '#F6EEDD',
        ...fixed
      },
      {
        type: 'shape',
        name: C.frame,
        ...box(-3, -3, 216, 154),
        fill: '#7A756D',
        locked: true,
        ...fixed
      }
    ],
    back: []
  }

  const pawn = {
    name: N.tPawn,
    kind: 'standee',
    width: 25,
    height: 40,
    bleed: 0,
    safeMargin: 1,
    cornerRadius: 0,
    front: [
      {
        type: 'image',
        name: C.figure,
        ...box(0, 0, 25, 40),
        src: V.meeple,
        fit: 'contain',
        tint: '#7A756D',
        ...fixed
      }
    ],
    back: []
  }

  for (const t of [board, card, tile, player, pawn])
    writeFileSync(join(dest, 'templates', t.name + '.json'), JSON.stringify(t, null, 2) + '\n')

  const dataFile = L('data/componenti.xlsx', 'data/components.xlsx')
  const wb = new ExcelJS.Workbook()
  const b = wb.addWorksheet(N.board)
  b.addRow(['amount'])
  b.addRow([1])
  const c = wb.addWorksheet(N.cards)
  c.addRow([C.name, C.text])
  for (const r of CARDS[lang]) c.addRow(r)
  c.getColumn(2).width = 40
  const tl = wb.addWorksheet(N.tiles)
  tl.addRow(['amount', C.icon])
  for (const v of [V.coin, V.gem, V.wood, V.stone]) tl.addRow([4, v])
  const p = wb.addWorksheet(N.players)
  p.addRow([C.name, C.color])
  for (const r of COLORS[lang]) p.addRow(r)
  const pw = wb.addWorksheet(N.pawns)
  pw.addRow([C.name, C.color])
  for (const r of COLORS[lang]) pw.addRow(r)
  await wb.xlsx.writeFile(join(dest, dataFile))

  const tint = { coin: '#B07A1E', gem: '#2E8B6E', wood: '#8A5A2B', stone: '#6E6A64', star: '#C49A1E', flag: '#A33A2A', meeple: '#555555' }
  writeFileSync(
    join(dest, 'stella.json'),
    JSON.stringify(
      {
        formatVersion: 1,
        name: N.project,
        dataFile,
        sets: [
          { name: N.board, template: N.tBoard },
          { name: N.cards, template: N.tCard },
          { name: N.tiles, template: N.tTile },
          { name: N.players, template: N.tPlayer },
          { name: N.pawns, template: N.tPawn }
        ],
        styles: {},
        variables: Object.fromEntries(
          Object.entries(V).map(([k, name]) => [name, { type: 'image', src: name, tint: tint[k] }])
        )
      },
      null,
      2
    ) + '\n'
  )
  return N
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const [dest, lang = 'it'] = process.argv.slice(2)
  await make(dest, lang)
}
