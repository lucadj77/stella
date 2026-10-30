// Crea il progetto dimostrativo del sesto approfondimento (video 26, impaginare un template): «Locanda».
// Otto avventori (cinque popolani e tre nobili, in due set) con nome, costo, forza, tipo e testo; il template della carta ha i livelli messi a occhio
// (titolo e ritratto un po' storti, tre icone non allineate, la spada da ripetere), che il video sistema
// con allinea e distribuisci, gruppi, Disponi i figli, Ripeti e vincoli. Il retro cambia colore con il
// tipo; un segnalino moneta con il retro e una tessera stanza mostrano gli altri componenti.
// I dati del foglio arrivano sempre da livelli Valore: le formule e i testi usano solo quelli.
// Uso: node progetto-locanda.mjs <cartella di destinazione> <it|en>
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
const column = (c) => ({ source: { kind: 'column', column: c } })
const value = (name, v = '') => ({ type: 'value', name, value: v, ...box(0, 0, 10, 10) })
const ink = '#2A241C'

export function names(lang) {
  const it = lang === 'it'
  const L = (a, b) => (it ? a : b)
  return {
    project: L('Locanda', 'Tavern'),
    folder: L('Locanda', 'Tavern'),
    patrons: L('Avventori', 'Patrons'),
    nobles: L('Nobili', 'Nobles'),
    coins: L('Monete', 'Coins'),
    rooms: L('Stanze', 'Rooms'),
    tPatron: L('avventore', 'patron'),
    tNoble: L('avventore-nobile', 'patron-noble'),
    tCoin: L('moneta', 'coin'),
    tRoom: L('stanza', 'room'),
    noble: L('nobile', 'noble'),
    commoner: L('popolano', 'commoner'),
    I: {
      coin: L('moneta', 'coin'),
      mug: L('boccale', 'mug'),
      key: L('chiave', 'key'),
      sword: L('spada', 'sword'),
      sign: L('insegna', 'sign'),
      crown: L('corona', 'crown'),
      bed: L('letto', 'bed'),
      barrels: L('botti', 'barrels'),
      stairs: L('scale', 'stairs')
    },
    C: {
      name: L('nome', 'name'),
      cost: L('costo', 'cost'),
      strength: L('forza', 'strength'),
      type: L('tipo', 'type'),
      text: L('testo', 'text'),
      portrait: L('ritratto', 'portrait'),
      title: L('titolo', 'title'),
      description: L('descrizione', 'description'),
      band: L('banda', 'band'),
      bg: L('sfondo', 'background'),
      circle: L('cerchio', 'circle'),
      square: L('riquadro', 'square'),
      medallion: L('medaglione', 'medallion'),
      services: L('servizi', 'services'),
      swords: L('spade', 'swords'),
      backBg: L('sfondo_retro', 'back_background'),
      footer: L('piede', 'footer'),
      costCircle: L('costo_cerchio', 'cost_circle'),
      costText: L('costo_numero', 'cost_number'),
      costGroup: L('costo_tondo', 'cost_badge'),
      value: L('valore', 'value'),
      icon: L('icona', 'icon'),
      logo: L('logo', 'logo')
    }
  }
}

// nome, ritratto, costo, forza, tipo (0 popolano, 1 nobile), testo
const PATRONS = {
  it: [
    ['Contadina', 'contadina', 1, 1, 0, 'Paga in natura: due pagnotte valgono una moneta.'],
    ['Cuoco', 'cuoco', 1, 2, 0, 'Quando entra in cucina, tutti mangiano meglio.'],
    ['Nano minatore', 'nano', 2, 3, 0, 'Beve due boccali e ne chiede un terzo.'],
    ['Capitano', 'capitano', 2, 4, 0, 'Racconta storie di mare fino all’alba.'],
    [
      'Figura incappucciata',
      'incappucciato',
      2,
      2,
      0,
      'Nessuno sa chi sia. Paga sempre in anticipo.'
    ],
    ['Mago errante', 'mago', 3, 2, 1, 'Accende il camino con uno schiocco di dita.'],
    ['Dama elfica', 'dama', 3, 1, 1, 'Vuole la camera migliore, e la ottiene.'],
    ['Vecchio re', 're', 3, 3, 1, 'Lascia una mancia d’oro a chi lo serve.']
  ],
  en: [
    ['Farmer', 'farmer', 1, 1, 0, 'Pays in kind: two loaves are worth one coin.'],
    ['Cook', 'cook', 1, 2, 0, 'When he enters the kitchen, everyone eats better.'],
    ['Dwarf miner', 'dwarf', 2, 3, 0, 'Drinks two mugs and asks for a third.'],
    ['Captain', 'captain', 2, 4, 0, 'Tells sea stories until dawn.'],
    ['Hooded figure', 'hooded', 2, 2, 0, 'Nobody knows who they are. Always pays in advance.'],
    ['Wandering wizard', 'wizard', 3, 2, 1, 'Lights the fireplace with a snap of the fingers.'],
    ['Elven lady', 'lady', 3, 1, 1, 'Wants the best room, and gets it.'],
    ['Old king', 'king', 3, 3, 1, 'Leaves a golden tip for whoever serves him.']
  ]
}
const PORTRAIT_IDS = [
  'delapouite/farmer',
  'delapouite/cook',
  'delapouite/dwarf-face',
  'delapouite/pirate-captain',
  'darkzaitzev/hooded-figure',
  'delapouite/wizard-face',
  'delapouite/woman-elf-face',
  'cathelineau/old-king'
]

export async function make(dest, lang) {
  const it = lang === 'it'
  const L = (a, b) => (it ? a : b)
  const N = names(lang)
  const { C, I } = N
  rmSync(dest, { recursive: true, force: true })
  for (const d of ['data', 'templates']) mkdirSync(join(dest, d), { recursive: true })
  writeIcons(dest, {
    ...Object.fromEntries(PATRONS[lang].map((p, i) => [p[1], PORTRAIT_IDS[i]])),
    [I.coin]: 'delapouite/two-coins',
    [I.mug]: 'lorc/beer-stein',
    [I.key]: 'delapouite/house-keys',
    [I.sword]: 'delapouite/rusty-sword',
    [I.sign]: 'delapouite/tavern-sign',
    [I.crown]: 'delapouite/jewel-crown',
    [I.bed]: 'delapouite/bed',
    [I.barrels]: 'delapouite/cellar-barrels',
    [I.stairs]: 'delapouite/stairs'
  })
  const icon = (name, b, tint = ink) => ({
    type: 'image',
    name,
    ...b,
    src: `icons/${name}`,
    fit: 'contain',
    tint,
    ...fixed
  })

  // la carta: livelli messi a occhio, da impaginare nel video
  const patron = {
    name: N.tPatron,
    kind: 'card',
    width: 63,
    height: 88,
    bleed: 3,
    safeMargin: 3,
    cornerRadius: 3,
    labelField: C.name,
    front: [
      value(C.name, L('Nome', 'Name')),
      value(C.cost, '1'),
      value(C.strength, '1'),
      value(C.type, N.commoner),
      value(C.text),
      {
        type: 'group',
        name: C.costGroup,
        ...box(50, 2, 11, 11),
        layout: 'none',
        children: [
          {
            type: 'text',
            name: C.costText,
            ...box(50, 2, 11, 11),
            text: `{${C.cost}}`,
            weight: 800,
            size: 13,
            color: ink,
            align: 'center',
            valign: 'middle',
            ...fixed
          },
          {
            type: 'shape',
            name: C.costCircle,
            ...box(50, 2, 11, 11),
            shape: 'ellipse',
            fill: '#E8C26A',
            stroke: { color: ink, width: 0.4 },
            ...fixed
          }
        ]
      },
      {
        type: 'text',
        name: C.title,
        ...box(7.5, 5, 40, 8),
        text: `{${C.name}}`,
        weight: 800,
        size: 11,
        color: '#FFFFFF',
        align: 'center',
        valign: 'middle',
        fit: 'shrink',
        ...fixed
      },
      {
        type: 'image',
        name: C.portrait,
        ...box(19.5, 18.5, 24, 24),
        src: '',
        fit: 'contain',
        tint: ink,
        ...column(C.portrait)
      },
      {
        type: 'shape',
        name: C.square,
        ...box(15, 16.5, 30, 30),
        fill: '#E3CFA8',
        ...fixed
      },
      {
        type: 'shape',
        name: C.circle,
        ...box(15, 16.5, 30, 30),
        shape: 'ellipse',
        fill: '#C9B48A',
        ...fixed
      },
      icon(I.coin, box(7, 49, 6, 6)),
      icon(I.mug, box(15.5, 50.5, 6, 6)),
      icon(I.key, box(27, 48.5, 6, 6)),
      icon(I.sword, box(44, 49, 6, 6), '#7A3E2B'),
      {
        type: 'text',
        name: C.description,
        ...box(6, 58, 51, 18),
        text: `{${C.text}}`,
        weight: 500,
        size: 8.5,
        color: ink,
        align: 'center',
        valign: 'middle',
        lineHeight: 1.25,
        ...fixed
      },
      {
        type: 'text',
        name: C.footer,
        ...box(6, 79, 51, 4),
        text: `${N.project} · {card.number}/{set.cards}`,
        weight: 600,
        size: 6,
        color: '#7A6A55',
        align: 'center',
        valign: 'middle',
        ...fixed
      },
      {
        type: 'shape',
        name: C.band,
        ...box(4, 4, 44, 10),
        fill: '#7A3E2B',
        radius: 2,
        ...fixed
      },
      {
        type: 'shape',
        name: C.bg,
        ...box(-3, -3, 69, 94),
        fill: '#F3E7CF',
        locked: true,
        ...fixed
      }
    ],
    // il retro cambia colore con il tipo dell'avventore
    back: [
      {
        type: 'text',
        name: L('nome_locanda', 'tavern_name'),
        ...box(6, 66, 51, 10),
        text: N.project.toUpperCase(),
        weight: 800,
        size: 14,
        color: '#FFFFFF',
        align: 'center',
        valign: 'middle',
        ...fixed
      },
      icon(C.logo, box(16.5, 22, 30, 30), '#FFFFFF'),
      {
        type: 'shape',
        name: C.backBg,
        ...box(-3, -3, 69, 94),
        fill: '#7A3E2B',
        locked: true,
        ...formula(`=IF({${C.type}} = "${N.noble}"; "#34466E"; "#7A3E2B")`)
      }
    ]
  }
  // il logo del retro è l'insegna della locanda
  patron.back[1].src = `icons/${I.sign}`

  // il segnalino moneta: il valore sul fronte, l'icona sul retro
  const coin = {
    name: N.tCoin,
    kind: 'token',
    width: 25,
    height: 25,
    shape: 'ellipse',
    bleed: 2,
    safeMargin: 2,
    cornerRadius: 0,
    front: [
      value(C.value, '1'),
      {
        type: 'text',
        name: L('numero', 'number'),
        ...box(4, 4, 17, 17),
        text: `{${C.value}}`,
        weight: 800,
        size: 26,
        color: ink,
        align: 'center',
        valign: 'middle',
        ...fixed
      },
      {
        type: 'shape',
        name: C.bg,
        ...box(-2, -2, 29, 29),
        shape: 'ellipse',
        fill: '#E8C26A',
        ...fixed
      }
    ],
    back: [
      icon(C.icon, box(5, 5, 15, 15)),
      {
        type: 'shape',
        name: C.backBg,
        ...box(-2, -2, 29, 29),
        shape: 'ellipse',
        fill: '#C99A3B',
        ...fixed
      }
    ]
  }
  coin.back[0].src = `icons/${I.coin}`

  // la tessera stanza: ha già un piede, così il piede incollato dalla carta prende un altro nome
  const room = {
    name: N.tRoom,
    kind: 'tile',
    width: 50,
    height: 50,
    bleed: 2,
    safeMargin: 2,
    cornerRadius: 2,
    front: [
      value(C.name, L('Stanza', 'Room')),
      value(C.icon, I.bed),
      {
        type: 'text',
        name: C.title,
        ...box(4, 4, 42, 8),
        text: `{${C.name}}`,
        weight: 800,
        size: 11,
        color: ink,
        align: 'center',
        valign: 'middle',
        ...fixed
      },
      {
        type: 'image',
        name: L('immagine', 'image'),
        ...box(13, 14, 24, 24),
        src: '',
        fit: 'contain',
        tint: '#5A4632',
        ...formula(`{${C.icon}}`)
      },
      {
        type: 'text',
        name: C.footer,
        ...box(4, 41, 42, 4),
        text: N.project,
        weight: 600,
        size: 6,
        color: '#7A6A55',
        align: 'center',
        valign: 'middle',
        ...fixed
      },
      {
        type: 'shape',
        name: C.bg,
        ...box(-2, -2, 54, 54),
        fill: '#E3CFA8',
        locked: true,
        ...fixed
      }
    ],
    back: []
  }
  for (const t of [patron, coin, room])
    writeFileSync(join(dest, 'templates', t.name + '.json'), JSON.stringify(t, null, 2) + '\n')

  const dataFile = L('data/locanda.xlsx', 'data/tavern.xlsx')
  const wb = new ExcelJS.Workbook()
  // popolani e nobili in due set: il video dà ai nobili un template derivato
  for (const noble of [0, 1]) {
    const a = wb.addWorksheet(noble ? N.nobles : N.patrons)
    a.addRow([C.name, C.cost, C.strength, C.type, C.text, C.portrait])
    for (const [n, p, c, s, k, tx] of PATRONS[lang])
      if (k === noble) a.addRow([n, c, s, k ? N.noble : N.commoner, tx, p])
    a.getColumn(1).width = 22
    a.getColumn(5).width = 50
  }
  const m = wb.addWorksheet(N.coins)
  m.addRow(['amount', C.value])
  m.addRow([10, 1])
  m.addRow([6, 2])
  m.addRow([4, 5])
  const s = wb.addWorksheet(N.rooms)
  s.addRow([C.name, C.icon])
  s.addRow([L('Camera', 'Bedroom'), I.bed])
  s.addRow([L('Cantina', 'Cellar'), I.barrels])
  s.addRow([L('Scale', 'Stairs'), I.stairs])
  await wb.xlsx.writeFile(join(dest, dataFile))

  writeFileSync(
    join(dest, 'stella.json'),
    JSON.stringify(
      {
        formatVersion: 1,
        name: N.project,
        ...(it ? { numberFormat: 'it' } : {}),
        dataFile,
        sets: [
          { name: N.patrons, template: N.tPatron },
          { name: N.nobles, template: N.tPatron },
          { name: N.coins, template: N.tCoin },
          { name: N.rooms, template: N.tRoom }
        ],
        styles: {},
        variables: {
          [I.bed]: { type: 'image', src: `icons/${I.bed}` },
          [I.barrels]: { type: 'image', src: `icons/${I.barrels}` },
          [I.stairs]: { type: 'image', src: `icons/${I.stairs}` }
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
