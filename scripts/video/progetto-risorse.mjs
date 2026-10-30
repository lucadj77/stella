// Crea il progetto del video 25 (approfondimento «giocare con il caso»): «Risorse», un mazzo di 12
// carte luogo. Il template ha lo sfondo e il nome; la griglia 4 × 4 delle risorse la costruisce il video.
// Le icone sono variabili immagine con nomi diversi dalle colonne del foglio (moneta / monete), così
// le colonne monete, legno, pietre e grano possono diventare livelli Valore senza confondersi.
// Le colonne del foglio sono già piene: il video le mostra e ne cambia una.
// Uso: node progetto-risorse.mjs <cartella di destinazione> <it|en>
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
    project: L('Risorse', 'Resources'),
    places: L('Luoghi', 'Places'),
    tCard: L('luogo', 'place'),
    grid: L('risorse', 'resources'),
    C: {
      name: L('nome', 'name'),
      bg: L('sfondo', 'background'),
      band: L('fascia', 'band'),
      coins: L('monete', 'coins'),
      wood: L('legno', 'wood'),
      stone: L('pietre', 'stone'),
      wheat: L('grano', 'wheat')
    },
    // le variabili immagine: al singolare, diverse dalle colonne
    V: {
      coin: L('moneta', 'coin'),
      wood: L('tronco', 'log'),
      stone: L('sasso', 'rock'),
      wheat: L('spiga', 'sheaf')
    }
  }
}

// nome, monete, legno, pietre, grano: numeri, intervalli o vuoto (quante servono)
const CARDS = {
  it: [
    ['Miniera', 2, 2, 6, ''],
    ['Fattoria', 2, 2, 2, '5-7'],
    ['Mercato', 4, '', '', ''],
    ['Bosco', 1, '6-8', 2, 2],
    ['Cava', 2, 1, '5-', 2],
    ['Porto', '3-5', 2, 2, 2],
    ['Mulino', 2, 1, 1, 6],
    ['Fornace', 2, 3, '4-6', 1],
    ['Granaio', '', 2, 2, '6-'],
    ['Segheria', 2, 5, 1, 2],
    ['Banca', '6-8', 1, 1, 1],
    ['Villaggio', 3, 3, 3, 3]
  ],
  en: [
    ['Mine', 2, 2, 6, ''],
    ['Farm', 2, 2, 2, '5-7'],
    ['Market', 4, '', '', ''],
    ['Forest', 1, '6-8', 2, 2],
    ['Quarry', 2, 1, '5-', 2],
    ['Harbor', '3-5', 2, 2, 2],
    ['Mill', 2, 1, 1, 6],
    ['Kiln', 2, 3, '4-6', 1],
    ['Granary', '', 2, 2, '6-'],
    ['Sawmill', 2, 5, 1, 2],
    ['Bank', '6-8', 1, 1, 1],
    ['Village', 3, 3, 3, 3]
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
    [V.wood]: 'delapouite/log',
    [V.stone]: 'delapouite/stone-pile',
    [V.wheat]: 'lorc/wheat'
  })

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
        ...box(6, 6, 51, 12),
        text: L('Nome', 'Name'),
        weight: 800,
        size: 14,
        color: '#FFFFFF',
        align: 'center',
        valign: 'middle',
        fit: 'shrink'
      },
      {
        type: 'shape',
        name: C.band,
        ...box(4, 4, 55, 16),
        radius: 2,
        fill: '#3E5C46',
        ...fixed
      },
      {
        type: 'shape',
        name: C.bg,
        ...box(-3, -3, 69, 94),
        fill: '#F3EBDA',
        locked: true,
        ...fixed
      }
    ],
    back: []
  }
  writeFileSync(join(dest, 'templates', card.name + '.json'), JSON.stringify(card, null, 2) + '\n')

  const dataFile = L('data/carte.xlsx', 'data/cards.xlsx')
  const wb = new ExcelJS.Workbook()
  const s = wb.addWorksheet(N.places)
  s.addRow([C.name, C.coins, C.wood, C.stone, C.wheat])
  for (const c of CARDS[lang]) s.addRow(c.map((v) => (typeof v === 'number' ? v : v)))
  s.getColumn(1).width = 16
  await wb.xlsx.writeFile(join(dest, dataFile))

  writeFileSync(
    join(dest, 'stella.json'),
    JSON.stringify(
      {
        formatVersion: 1,
        name: N.project,
        dataFile,
        sets: [{ name: N.places, template: N.tCard }],
        styles: {},
        variables: {
          [V.coin]: { type: 'image', src: V.coin, tint: '#B07A1E' },
          [V.wood]: { type: 'image', src: V.wood, tint: '#8A5A2B' },
          [V.stone]: { type: 'image', src: V.stone, tint: '#6E6A64' },
          [V.wheat]: { type: 'image', src: V.wheat, tint: '#C49A1E' }
        }
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
