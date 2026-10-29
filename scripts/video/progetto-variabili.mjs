// Crea il progetto dimostrativo del secondo approfondimento (video 21, icone e variabili): «Contratti»,
// dallo stesso mondo dei «Mercanti» del video 20. Sei contratti di consegna con un costo in merci
// (spezie, seta, olio) scritto con le icone nel foglio, un tipo (terra o mare) che il livello immagine
// mostra con una variabile dallo sfondo tondo, un livello da 1 a 3 che una formula trasforma in una
// medaglia, i punti calcolati da COUNTIN e un colore calcolato. Ci sono già le variabili che il video non
// crea (terra, mare, le tre medaglie, i colori blu e ocra); moneta, i testi e i valori li crea il video.
// Un segnalino e un dado mostrano le stesse icone fuori dalle carte.
// Uso: node progetto-variabili.mjs <cartella di destinazione> <it|en>
//      oppure da un altro script: make(cartella, lingua)
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { writeIcons } from './progetto-testo.mjs'
const REPO = new URL('../..', import.meta.url).pathname
const ExcelJS = createRequire(join(REPO, 'package.json'))('exceljs')

const box = (x, y, w, h) => ({ x, y, w, h })
const fixed = { source: { kind: 'fixed' } }
const formula = (expr) => ({ source: { kind: 'formula', expr } })

export function names(lang) {
  const it = lang === 'it'
  const L = (a, b) => (it ? a : b)
  return {
    project: L('Contratti', 'Contracts'),
    folder: L('Contratti', 'Contracts'),
    contracts: L('Contratti', 'Contracts'),
    orders: L('Ordini', 'Orders'),
    die: L('Dado delle merci', 'Goods die'),
    tContract: L('contratto', 'contract'),
    tOrder: L('ordine', 'order'),
    tDie: L('faccia', 'face'),
    // icone (file in assets/icons) e variabili
    I: {
      spices: L('spezie', 'spices'),
      silk: L('seta', 'silk'),
      oil: L('olio', 'oil'),
      coin: L('moneta', 'coin'),
      ship: L('nave', 'ship'),
      cart: L('carro', 'cart'),
      land: L('terra', 'land'),
      sea: L('mare', 'sea'),
      medal: L('medaglia', 'medal'),
      contract: L('contratto', 'contract'),
      bronze: L('bronzo', 'bronze'),
      silver: L('argento', 'silver'),
      gold: L('oro', 'gold'),
      blue: L('blu', 'sea_blue'),
      ochre: L('ocra', 'ochre')
    },
    C: {
      name: L('nome', 'name'),
      type: L('tipo', 'type'),
      level: L('livello', 'level'),
      cost: L('costo', 'cost'),
      costLabel: L('etichetta_costo', 'cost_label'),
      text: L('testo', 'text'),
      reward: L('premio', 'reward'),
      rewardLabel: L('ricompensa', 'reward_label'),
      coins: L('monete', 'coins'),
      coinImg: L('moneta_img', 'coin_img'),
      vehicle: L('mezzo', 'vehicle'),
      medal: L('medaglia', 'medal'),
      points: L('punti', 'points'),
      pointsCircle: L('punti_cerchio', 'points_circle'),
      color: L('colore', 'color'),
      band: L('fascia', 'band'),
      frame: L('cornice', 'frame'),
      bg: L('sfondo', 'background'),
      face: L('faccia', 'face')
    }
  }
}

const ICONS = (I) => ({
  [I.spices]: 'lorc/hot-spices',
  [I.silk]: 'delapouite/rolled-cloth',
  [I.oil]: 'delapouite/amphora',
  [I.coin]: 'delapouite/two-coins',
  [I.ship]: 'lorc/galleon',
  [I.cart]: 'delapouite/old-wagon',
  [I.land]: 'lorc/mountains',
  [I.sea]: 'lorc/wave-crest',
  [I.medal]: 'delapouite/ribbon-medal',
  [I.contract]: 'delapouite/contract'
})

// nome, tipo, livello, costo, premio, testo
const CARDS = (lang, I) => {
  const c = (n, ...names) => names.map((x, i) => `${n[i]}{${x}}`).join(' ')
  return lang === 'it'
    ? [
        ['Spezie per Venezia', I.sea, 1, c([2], I.spices), 2, 'Consegna le spezie in un porto.'],
        [
          'Seta per Genova',
          I.sea,
          2,
          c([1, 1], I.silk, I.spices),
          3,
          'Consegna in un porto entro due turni.'
        ],
        ['Olio per il mercato', I.land, 1, c([3], I.oil), 2, 'Consegna in un mercato.'],
        [
          'La grande carovana',
          I.land,
          3,
          c([2, 2, 1], I.silk, I.oil, I.spices),
          5,
          'Consegna in un mercato lontano almeno tre città.'
        ],
        ['Il sultano', I.land, 3, c([3], I.silk), 4, 'Consegna al palazzo del sultano.'],
        [
          'Rotta dell’olio',
          I.sea,
          2,
          c([2, 1], I.oil, I.silk),
          3,
          'Consegna in un porto diverso da quello di partenza.'
        ]
      ]
    : [
        ['Spices for Venice', I.sea, 1, c([2], I.spices), 2, 'Deliver the spices to a port.'],
        [
          'Silk for Genoa',
          I.sea,
          2,
          c([1, 1], I.silk, I.spices),
          3,
          'Deliver to a port within two turns.'
        ],
        ['Oil for the market', I.land, 1, c([3], I.oil), 2, 'Deliver to a market.'],
        [
          'The great caravan',
          I.land,
          3,
          c([2, 2, 1], I.silk, I.oil, I.spices),
          5,
          'Deliver to a market at least three cities away.'
        ],
        ['The sultan', I.land, 3, c([3], I.silk), 4, 'Deliver to the sultan’s palace.'],
        [
          'The oil route',
          I.sea,
          2,
          c([2, 1], I.oil, I.silk),
          3,
          'Deliver to a port other than the one you left from.'
        ]
      ]
}

export async function make(dest, lang) {
  const it = lang === 'it'
  const L = (a, b) => (it ? a : b)
  const N = names(lang)
  const { C, I } = N
  rmSync(dest, { recursive: true, force: true })
  for (const d of ['data', 'templates']) mkdirSync(join(dest, d), { recursive: true })
  writeIcons(dest, ICONS(I))

  const ink = '#2A241C'
  const contract = {
    name: N.tContract,
    width: 63,
    height: 88,
    bleed: 3,
    safeMargin: 3,
    cornerRadius: 3,
    front: [
      {
        type: 'text',
        name: C.name,
        ...box(6, 5, 51, 10),
        text: L('Nome', 'Name'),
        weight: 800,
        size: 11,
        color: '#FFFFFF',
        valign: 'middle',
        fit: 'shrink'
      },
      {
        type: 'image',
        name: C.medal,
        ...box(5, 19, 11, 11),
        src: I.bronze,
        fit: 'contain',
        ...formula(`=PICK({${C.level}}; "${I.bronze}"; "${I.silver}"; "${I.gold}")`)
      },
      {
        type: 'text',
        name: C.vehicle,
        ...box(18, 19, 27, 11),
        text: '',
        size: 22,
        color: ink,
        align: 'center',
        valign: 'middle',
        ...fixed
      },
      {
        type: 'image',
        name: C.type,
        ...box(47, 19, 11, 11),
        src: I.sea,
        fit: 'contain'
      },
      {
        type: 'text',
        name: C.costLabel,
        ...box(6, 33, 12, 10),
        text: L('Costo:', 'Cost:'),
        weight: 700,
        size: 10,
        color: ink,
        valign: 'middle',
        ...fixed
      },
      {
        type: 'text',
        name: C.cost,
        ...box(18, 33, 28, 10),
        text: '',
        weight: 700,
        size: 10,
        color: ink,
        lineHeight: 1.2,
        valign: 'middle'
      },
      {
        type: 'text',
        name: C.text,
        ...box(6, 45, 51, 20),
        text: '',
        weight: 500,
        size: 8.5,
        color: ink,
        lineHeight: 1.25
      },
      {
        type: 'text',
        name: C.rewardLabel,
        ...box(6, 69, 16, 8),
        text: L('Premio:', 'Reward:'),
        weight: 700,
        size: 9,
        color: ink,
        valign: 'middle',
        ...fixed
      },
      {
        type: 'group',
        name: C.coins,
        ...box(22, 69, 24, 8),
        visible: false,
        layout: 'row',
        gap: 0.8,
        justify: 'start',
        alignItems: 'center',
        repeat: `{${C.reward}}`,
        children: [
          {
            type: 'image',
            name: C.coinImg,
            ...box(0, 0, 5, 5),
            src: I.coin,
            fit: 'contain',
            tint: '#B8892B',
            ...fixed
          }
        ]
      },
      {
        type: 'text',
        name: C.pointsCircle,
        ...box(47, 67, 11, 11),
        text: `[{${C.points}}]{bg=circle bg-color=#E8C26A bg-size=150%}`,
        weight: 800,
        size: 12,
        color: ink,
        align: 'center',
        valign: 'middle',
        ...fixed
      },
      {
        type: 'value',
        name: C.points,
        value: '0',
        ...box(0, 0, 10, 10),
        ...formula(`=COUNTIN({${C.cost}}; "${I.silk}")*3 + {${C.reward}}`)
      },
      {
        type: 'value',
        name: C.color,
        value: '',
        ...box(0, 0, 10, 10),
        ...formula(`=IF({${C.type}}="${I.sea}"; "${I.blue}"; "${I.ochre}")`)
      },
      {
        type: 'shape',
        name: C.band,
        ...box(4, 4, 55, 12),
        radius: 2,
        fill: '#5A5148',
        ...fixed
      },
      {
        type: 'shape',
        name: C.frame,
        ...box(3, 3, 57, 82),
        radius: 2.5,
        fill: null,
        stroke: { color: '#D2C2A2', width: 0.6 },
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
    back: [
      {
        type: 'image',
        name: L('retro_icona', 'back_icon'),
        ...box(16.5, 29, 30, 30),
        src: I.contract,
        fit: 'contain',
        tint: '#E8C26A',
        ...fixed
      },
      {
        type: 'shape',
        name: L('retro_sfondo', 'back_background'),
        ...box(-3, -3, 69, 94),
        fill: '#3B3530',
        ...fixed
      }
    ]
  }

  const order = {
    name: N.tOrder,
    kind: 'token',
    width: 30,
    height: 30,
    shape: 'ellipse',
    bleed: 2,
    safeMargin: 2,
    cornerRadius: 0,
    front: [
      {
        type: 'text',
        name: C.cost,
        ...box(3, 7, 24, 16),
        text: '',
        weight: 700,
        size: 16,
        color: ink,
        align: 'center',
        valign: 'middle',
        lineHeight: 1.1
      },
      {
        type: 'shape',
        name: C.bg,
        ...box(-2, -2, 34, 34),
        shape: 'ellipse',
        fill: '#E8D9B8',
        stroke: { color: '#B8892B', width: 0.8 },
        ...fixed
      }
    ],
    back: []
  }

  const face = {
    name: N.tDie,
    kind: 'die',
    width: 16,
    height: 16,
    bleed: 1,
    safeMargin: 1,
    cornerRadius: 2,
    front: [
      {
        type: 'text',
        name: C.face,
        ...box(1, 1, 14, 14),
        text: '',
        size: 24,
        color: ink,
        align: 'center',
        valign: 'middle'
      },
      {
        type: 'shape',
        name: C.bg,
        ...box(-1, -1, 18, 18),
        fill: '#F6EEDD',
        ...fixed
      }
    ],
    back: []
  }
  for (const t of [contract, order, face])
    writeFileSync(join(dest, 'templates', t.name + '.json'), JSON.stringify(t, null, 2) + '\n')

  const dataFile = L('data/carte.xlsx', 'data/cards.xlsx')
  const wb = new ExcelJS.Workbook()
  const a = wb.addWorksheet(N.contracts)
  a.addRow([C.name, C.type, C.level, C.cost, C.reward, C.text])
  for (const c of CARDS(lang, I)) a.addRow(c)
  a.getColumn(1).width = 22
  a.getColumn(4).width = 28
  a.getColumn(6).width = 60
  const o = wb.addWorksheet(N.orders)
  o.addRow([C.cost])
  for (const c of CARDS(lang, I).slice(0, 3)) o.addRow([c[3]])
  const d = wb.addWorksheet(N.die)
  d.addRow([C.face])
  for (const f of [I.spices, I.spices, I.silk, I.oil, I.oil, I.ship]) d.addRow([`{${f}}`])
  await wb.xlsx.writeFile(join(dest, dataFile))

  const medal = (tint) => ({ type: 'image', src: I.medal, tint })
  const badge = (src, bgColor) => ({
    type: 'image',
    src,
    tint: '#FFFFFF',
    bg: 'circle',
    bgColor,
    bgPad: 0.2
  })
  writeFileSync(
    join(dest, 'stella.json'),
    JSON.stringify(
      {
        formatVersion: 1,
        name: N.project,
        dataFile,
        sets: [
          { name: N.contracts, template: N.tContract },
          { name: N.orders, template: N.tOrder },
          { name: N.die, template: N.tDie }
        ],
        styles: {},
        variables: {
          [I.land]: badge(I.land, '#A0672A'),
          [I.sea]: badge(I.sea, '#2A5D7C'),
          [I.bronze]: medal('#A0672A'),
          [I.silver]: medal('#8A8F96'),
          [I.gold]: medal('#C9A227'),
          [I.blue]: { type: 'color', color: '#2A5D7C' },
          [I.ochre]: { type: 'color', color: '#A0672A' }
        }
      },
      null,
      2
    ) + '\n'
  )
  return dest
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const [dest, lang = 'it'] = process.argv.slice(2)
  await make(dest, lang)
}
