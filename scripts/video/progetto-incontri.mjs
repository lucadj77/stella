// Crea il progetto dimostrativo del terzo approfondimento (video 22, due campi valore): «Incontri»,
// dallo stesso mondo dei «Mercanti». Ogni carta è l'incrocio di un personaggio (mercante, pirata, spia)
// e di un luogo (porto, deserto, palazzo). Il progetto parte dal «problema»: tre carte con sette
// colonne riempite a mano (una incoerente). Il video aggiunge i livelli Valore personaggio e luogo,
// trasforma gli altri livelli in formule e genera le nove combinazioni. Le variabili ci sono già
// (icone dei luoghi e dei personaggi, colori dei luoghi, otto testi su nove: il nono lo crea il video).
// Una plancia mostra le stesse variabili fuori dalle carte.
// Uso: node progetto-incontri.mjs <cartella di destinazione> <it|en>
//      oppure da un altro script: make(cartella, lingua)
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs'
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
    project: L('Incontri', 'Encounters'),
    folder: L('Incontri', 'Encounters'),
    set: L('Incontri', 'Encounters'),
    boardSet: L('Mappa', 'Map'),
    tCard: L('incontro', 'encounter'),
    tBoard: L('mappa', 'map'),
    // valori dei due campi
    P: [L('mercante', 'merchant'), L('pirata', 'pirate'), L('spia', 'spy')],
    W: [L('porto', 'port'), L('deserto', 'desert'), L('palazzo', 'palace')],
    // suffissi dei nomi delle variabili
    icon: L('_icona', '_icon'),
    color: L('_colore', '_color'),
    // cartelle delle immagini
    places: L('luoghi', 'places'),
    people: L('personaggi', 'characters'),
    C: {
      title: L('titolo', 'title'),
      bg: L('sfondo', 'background'),
      placeIcon: L('luogo_icona', 'place_icon'),
      subject: L('soggetto', 'subject'),
      personIcon: L('personaggio_icona', 'character_icon'),
      text: L('testo', 'text'),
      points: L('punti', 'points'),
      pointsCircle: L('punti_cerchio', 'points_circle'),
      person: L('personaggio', 'character'),
      place: L('luogo', 'place'),
      encounter: L('incontro', 'encounter'),
      colour: L('colore', 'colour'),
      band: L('fascia', 'band'),
      medallion: L('medaglione', 'medallion'),
      panel: L('riquadro', 'panel'),
      frame: L('cornice', 'frame')
    }
  }
}

const PEOPLE_ICONS = ['delapouite/turban', 'delapouite/pirate-captain', 'delapouite/spy']
const PLACE_ICONS = ['lorc/anchor', 'delapouite/camel', 'delapouite/samara-mosque']
const PLACE_COLORS = ['#2A5D7C', '#A0672A', '#7A3E6B']
const PEOPLE_COLOR = '#3B3530'

// le frasi, per [personaggio][luogo]
const TEXTS = {
  it: [
    [
      'Compra 2 merci a metà prezzo.',
      'La carovana avanza di 2 città.',
      'Vendi una merce al doppio del prezzo.'
    ],
    [
      'Ruba 1 merce a ogni nave nel porto.',
      'Perso tra le dune: salta il prossimo turno.',
      'Paga 3 monete di cauzione.'
    ],
    [
      'Guarda la mano di un avversario.',
      'Segui una carovana e copia la sua azione.',
      'Scopri un segreto: pesca 2 carte.'
    ]
  ],
  en: [
    [
      'Buy 2 goods at half price.',
      'The caravan moves 2 cities ahead.',
      'Sell one good at double the price.'
    ],
    [
      'Steal 1 good from every ship in port.',
      'Lost in the dunes: skip your next turn.',
      'Pay 3 coins as bail.'
    ],
    [
      'Look at an opponent’s hand.',
      'Follow a caravan and copy its action.',
      'Uncover a secret: draw 2 cards.'
    ]
  ]
}
/** la frase che il video scrive a mano: spia a palazzo */
export const LIVE = { p: 2, w: 2 }
export const text = (lang, p, w) => TEXTS[lang][p][w]

// punti: mercante 2, pirata 3, spia 1; +2 a palazzo
const points = (p, w) => [2, 3, 1][p] + (w === 2 ? 2 : 0)

// ---- scene dei luoghi: forme piatte, niente sfumature, 690×940 come la carta con l'abbondanza
const scene = (sky, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 690 940"><rect width="690" height="940" fill="${sky}"/>${body}</svg>`
const SCENES = [
  // porto: mare, molo, una vela
  scene(
    '#CFE3EA',
    '<circle cx="520" cy="190" r="70" fill="#F3E3B5"/>' +
      '<path d="M0 520 Q170 490 345 520 T690 520 V940 H0Z" fill="#4F86A3"/>' +
      '<path d="M0 600 Q170 575 345 600 T690 600 V940 H0Z" fill="#2A5D7C"/>' +
      '<rect x="0" y="560" width="250" height="40" fill="#8A6A48"/>' +
      '<rect x="40" y="600" width="18" height="180" fill="#6E5236"/><rect x="190" y="600" width="18" height="180" fill="#6E5236"/>' +
      '<path d="M470 500 h150 l-25 45 h-100z" fill="#5A4030"/><path d="M540 300 v195 h-90z" fill="#F6EEDD"/><rect x="537" y="290" width="6" height="210" fill="#5A4030"/>'
  ),
  // deserto: dune e sole
  scene(
    '#F2E2BE',
    '<circle cx="180" cy="200" r="80" fill="#F7C873"/>' +
      '<path d="M0 560 Q200 430 420 540 T690 500 V940 H0Z" fill="#E2B56C"/>' +
      '<path d="M0 700 Q250 590 480 690 T690 660 V940 H0Z" fill="#C9934B"/>' +
      '<path d="M0 820 Q300 760 690 830 V940 H0Z" fill="#A0672A"/>'
  ),
  // palazzo: cupole e torri sullo sfondo
  scene(
    '#E9DCE6',
    '<path d="M0 640 H690 V940 H0Z" fill="#D9C7A8"/>' +
      '<rect x="120" y="380" width="450" height="260" fill="#C9A9C0"/>' +
      '<path d="M235 380 Q345 190 455 380Z" fill="#9C6A8E"/><rect x="341" y="200" width="8" height="40" fill="#7A3E6B"/>' +
      '<rect x="60" y="300" width="50" height="340" fill="#B48AA8"/><path d="M60 300 Q85 240 110 300Z" fill="#7A3E6B"/>' +
      '<rect x="580" y="300" width="50" height="340" fill="#B48AA8"/><path d="M580 300 Q605 240 630 300Z" fill="#7A3E6B"/>' +
      '<path d="M300 640 V540 Q345 480 390 540 V640Z" fill="#7A3E6B"/>'
  )
]

/** un'icona di game-icons in un file svg, per i soggetti grandi */
function iconSvg(id) {
  const catalog = JSON.parse(readFileSync(join(REPO, 'resources/catalogs/game-icons.json'), 'utf8'))
  const d = catalog.icons.find((i) => i[0] === id)?.[1]
  if (!d) throw new Error('icona mancante: ' + id)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="${d}"/></svg>`
}

export async function make(dest, lang) {
  const it = lang === 'it'
  const L = (a, b) => (it ? a : b)
  const N = names(lang)
  const { C, P, W } = N
  rmSync(dest, { recursive: true, force: true })
  for (const d of ['data', 'templates', `assets/${N.places}`, `assets/${N.people}`])
    mkdirSync(join(dest, d), { recursive: true })
  // icone piccole (per le variabili) in assets/icons, con le fonti
  const placeIcons = [L('ancora', 'anchor'), L('cammello', 'camel'), L('moschea', 'mosque')]
  writeIcons(dest, Object.fromEntries(placeIcons.map((n, i) => [n, PLACE_ICONS[i]])))
  // scene dei luoghi e soggetti grandi
  W.forEach((w, i) => writeFileSync(join(dest, 'assets', N.places, w + '.svg'), SCENES[i]))
  P.forEach((p, i) => writeFileSync(join(dest, 'assets', N.people, p + '.svg'), iconSvg(PEOPLE_ICONS[i])))
  const sources = JSON.parse(readFileSync(join(dest, 'assets/sources.json'), 'utf8'))
  P.forEach((p, i) => {
    const id = PEOPLE_ICONS[i]
    sources[`${N.people}/${p}.svg`] = {
      ...sources[`icons/${placeIcons[0]}.svg`],
      id,
      title: id.split('/')[1],
      author: 'Delapouite',
      license: 'CC BY 3.0',
      url: `https://game-icons.net/1x1/${id}.html`
    }
  })
  writeFileSync(join(dest, 'assets/sources.json'), JSON.stringify(sources, null, 2))

  const ink = '#2A241C'
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
        name: C.title,
        ...box(6, 5, 51, 9),
        text: L('Titolo', 'Title'),
        weight: 800,
        size: 11,
        color: '#FFFFFF',
        align: 'center',
        valign: 'middle',
        transform: 'upper',
        fit: 'shrink'
      },
      {
        type: 'text',
        name: C.pointsCircle,
        ...box(48, 71, 10, 10),
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
        ...box(0, 0, 10, 10)
      },
      {
        type: 'text',
        name: C.text,
        ...box(7, 59, 40, 22),
        text: '',
        weight: 600,
        size: 10,
        color: ink,
        lineHeight: 1.2,
        valign: 'middle'
      },
      {
        type: 'image',
        name: C.personIcon,
        ...box(5, 17, 11, 11),
        src: '',
        fit: 'contain'
      },
      {
        type: 'image',
        name: C.placeIcon,
        ...box(47, 17, 11, 11),
        src: '',
        fit: 'contain'
      },
      {
        type: 'image',
        name: C.subject,
        ...box(19.5, 21, 24, 24),
        src: '',
        fit: 'contain',
        tint: ink
      },
      {
        type: 'shape',
        name: C.medallion,
        ...box(15.5, 17, 32, 32),
        shape: 'ellipse',
        fill: '#F6EEDD',
        opacity: 0.85,
        ...fixed
      },
      {
        type: 'shape',
        name: C.panel,
        ...box(4, 56, 55, 28),
        radius: 2,
        fill: '#F6EEDD',
        opacity: 0.92,
        ...fixed
      },
      {
        type: 'shape',
        name: C.band,
        ...box(4, 4, 55, 11),
        radius: 2,
        fill: '#5A5148',
        ...fixed
      },
      {
        type: 'image',
        name: C.bg,
        ...box(-3, -3, 69, 94),
        src: '',
        fit: 'cover',
        locked: true
      }
    ],
    back: [
      {
        type: 'text',
        name: L('retro_titolo', 'back_title'),
        ...box(6, 36, 51, 16),
        text: L('Incontro', 'Encounter'),
        weight: 800,
        size: 16,
        color: '#E8C26A',
        align: 'center',
        valign: 'middle',
        transform: 'upper',
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

  // la plancia: tre caselle luogo, con l'icona e il colore delle stesse variabili
  const board = {
    name: N.tBoard,
    kind: 'board',
    width: 180,
    height: 90,
    bleed: 3,
    safeMargin: 3,
    cornerRadius: 0,
    front: [
      {
        type: 'text',
        name: C.title,
        ...box(10, 6, 160, 12),
        text: '',
        weight: 800,
        size: 16,
        color: '#3B3530',
        align: 'center',
        valign: 'middle',
        transform: 'upper'
      },
      ...W.flatMap((w, i) => [
        {
          type: 'text',
          name: `${w}${L('_nome', '_name')}`,
          ...box(14 + i * 55, 62, 42, 10),
          text: w,
          weight: 800,
          size: 12,
          color: ink,
          align: 'center',
          valign: 'middle',
          transform: 'upper',
          ...fixed
        },
        {
          type: 'image',
          name: `${w}${L('_casella', '_space')}`,
          ...box(20 + i * 55, 22, 30, 30),
          src: w + N.icon,
          fit: 'contain',
          ...fixed
        }
      ]),
      {
        type: 'shape',
        name: L('fondo', 'base'),
        ...box(-3, -3, 186, 96),
        fill: '#E8D9B8',
        ...fixed
      }
    ],
    back: []
  }
  for (const t of [card, board])
    writeFileSync(join(dest, 'templates', t.name + '.json'), JSON.stringify(t, null, 2) + '\n')

  // il «problema»: tre carte con tutte le colonne scritte a mano; la terza ha lo sfondo sbagliato
  const dataFile = L('data/carte.xlsx', 'data/cards.xlsx')
  const wb = new ExcelJS.Workbook()
  const a = wb.addWorksheet(N.set)
  a.addRow([C.title, C.bg, C.placeIcon, C.subject, C.personIcon, C.text, C.points])
  const row = (p, w, title, bgW = w) => [
    title,
    `${N.places}/${W[bgW]}`,
    W[w] + N.icon,
    `${N.people}/${P[p]}`,
    P[p] + N.icon,
    text(lang, p, w),
    points(p, w)
  ]
  a.addRow(row(1, 0, L('Pirata · porto', 'Pirate · port')))
  a.addRow(row(0, 1, L('Mercante · deserto', 'Merchant · desert')))
  a.addRow(row(2, 2, L('Spia · palazzo', 'Spy · palace'), 1))
  a.getColumn(1).width = 20
  a.getColumn(2).width = 18
  a.getColumn(6).width = 46
  const b = wb.addWorksheet(N.boardSet)
  b.addRow([C.title])
  b.addRow([L('Le tre città', 'The three cities')])
  await wb.xlsx.writeFile(join(dest, dataFile))

  const variables = {}
  W.forEach((w, i) => {
    variables[w + N.icon] = {
      type: 'image',
      src: `icons/${placeIcons[i]}`,
      tint: '#FFFFFF',
      bg: 'circle',
      // lo sfondo prende il colore del luogo: cambiare porto_colore cambia anche l'icona
      bgColor: w + N.color,
      bgPad: 0.22
    }
    variables[w + N.color] = { type: 'color', color: PLACE_COLORS[i] }
  })
  P.forEach((p) => {
    variables[p + N.icon] = {
      type: 'image',
      src: `${N.people}/${p}`,
      tint: '#FFFFFF',
      bg: 'circle',
      bgColor: PEOPLE_COLOR,
      bgPad: 0.22
    }
  })
  P.forEach((p, pi) =>
    W.forEach((w, wi) => {
      if (pi === LIVE.p && wi === LIVE.w) return
      variables[`${p}_${w}`] = { type: 'text', text: text(lang, pi, wi) }
    })
  )
  writeFileSync(
    join(dest, 'stella.json'),
    JSON.stringify(
      {
        formatVersion: 1,
        name: N.project,
        dataFile,
        sets: [
          { name: N.set, template: N.tCard },
          { name: N.boardSet, template: N.tBoard }
        ],
        styles: {},
        variables
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
