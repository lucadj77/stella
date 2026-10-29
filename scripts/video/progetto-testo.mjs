// Crea il progetto dimostrativo degli approfondimenti sul testo (video 20 e 21): «Mercanti», un piccolo
// gioco di carovane e spezie. Otto carte azione con regole di lunghezza diversa (una troppo lunga anche
// alla dimensione minima), parole chiave formattate a mano in ogni carta (il video le trasforma in uno
// stile), una tessera porto e una plancia con le rotte che usano lo stesso markup.
// I livelli che non cambiano da carta a carta sono Fissi, così non diventano campi del set.
// Uso: node progetto-testo.mjs <cartella di destinazione> <it|en>
//      oppure da un altro script: make(cartella, lingua)
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
const REPO = new URL('../..', import.meta.url).pathname
const ExcelJS = createRequire(join(REPO, 'package.json'))('exceljs')

const box = (x, y, w, h) => ({ x, y, w, h })
const fixed = { source: { kind: 'fixed' } }

/** la formattazione delle parole chiave, ripetuta a mano: il video la trasforma nello stile keyword */
export const KEY = '{color=#2F6B4F weight=800 smallcaps}'

export function names(lang) {
  const it = lang === 'it'
  const L = (a, b) => (it ? a : b)
  return {
    project: L('Mercanti', 'Merchants'),
    folder: L('Mercanti', 'Merchants'),
    actions: L('Azioni', 'Actions'),
    ports: L('Porti', 'Ports'),
    board: L('Plancia', 'Board'),
    tAction: L('azione', 'action'),
    tPort: L('porto', 'port'),
    tBoard: L('rotte', 'routes'),
    C: {
      name: L('nome', 'name'),
      icon: L('icona', 'icon'),
      text: L('testo', 'text'),
      points: L('punti', 'points'),
      panel: L('pannello', 'panel'),
      frame: L('cornice', 'frame'),
      bg: L('sfondo', 'background'),
      label: L('etichetta', 'label'),
      title: L('titolo', 'title'),
      rules: L('regole', 'rules')
    }
  }
}

const ICONS = {
  it: {
    cammello: 'delapouite/camel',
    galeone: 'lorc/galleon',
    spezie: 'lorc/hot-spices',
    veleno: 'lorc/poison-bottle',
    mappa: 'lorc/treasure-map',
    bilancia: 'lorc/scales',
    clessidra: 'lorc/hourglass',
    pugnale: 'lorc/cloak-dagger',
    ancora: 'lorc/anchor',
    moneta: 'delapouite/two-coins'
  },
  en: {
    camel: 'delapouite/camel',
    galleon: 'lorc/galleon',
    spices: 'lorc/hot-spices',
    poison: 'lorc/poison-bottle',
    map: 'lorc/treasure-map',
    scales: 'lorc/scales',
    hourglass: 'lorc/hourglass',
    dagger: 'lorc/cloak-dagger',
    anchor: 'lorc/anchor',
    coin: 'delapouite/two-coins'
  }
}

// nome, icona, testo. La Carovana è la carta su cui lavora il video; la Clessidra ha il testo vuoto
// (lo scrive il video); il Contrabbando non sta nel riquadro nemmeno alla dimensione minima
const k = (w) => `[${w}]${KEY}`
const CARDS = {
  it: [
    [
      'Carovana',
      'cammello',
      `Muovi la tua carovana fino a 2 città. Se sosti in un ${k('mercato')}, guadagna dalla riserva comune 4 monete.\nPuoi farlo una volta per turno.`
    ],
    [
      'Galeone',
      'galeone',
      `Scegli un ${k('porto')} libero e mettici la tua nave. Finché la nave resta lì, ogni avversario che arriva in quel ${k('porto')} ti paga 1 moneta.`
    ],
    [
      'Spezie piccanti',
      'spezie',
      `Vendi fino a 3 sacchi di spezie in un ${k('mercato')}. Ogni sacco vale 2 monete.`
    ],
    [
      'Veleno',
      'veleno',
      `Scegli un avversario: scarta una delle sue carte azione a faccia in su. Se è una carta ${k('mercato')}, prendila nella tua mano.`
    ],
    [
      'Mappa del tesoro',
      'mappa',
      `Guarda le prime 3 carte del mazzo, tienine una e rimetti le altre in fondo nell'ordine che preferisci.`
    ],
    [
      'Bilancia',
      'bilancia',
      `Scambia un sacco di spezie con un avversario. Se siete nello stesso ${k('mercato')}, guadagnate entrambi 1 moneta.`
    ],
    ['Clessidra', 'clessidra', ''],
    [
      'Contrabbando',
      'pugnale',
      `Prendi 2 sacchi di spezie dalla riserva senza pagarli. Se un avversario è nel tuo stesso ${k('porto')} può denunciarti: in quel caso restituisci i sacchi, paga 3 monete alla banca e salta il prossimo turno. Se invece nessuno ti denuncia entro la fine del round, metti i sacchi nel tuo magazzino e guadagna 1 moneta per ogni ${k('mercato')} che hai visitato in questo turno. Un giocatore che ha già denunciato qualcuno in questo round non può farlo di nuovo, e un giocatore senza monete non può denunciare. Alla fine della partita ogni carta Contrabbando giocata vale 1 punto in meno. Se due giocatori giocano il Contrabbando nello stesso turno, nessuno dei due prende i sacchi e il turno passa al giocatore successivo.`
    ]
  ],
  en: [
    [
      'Caravan',
      'camel',
      `Move your caravan up to 2 cities. If you stop at a ${k('market')}, you gain 4 coins.\nYou can do this once per turn.`
    ],
    [
      'Galleon',
      'galleon',
      `Choose a free ${k('port')} and place your ship there. While the ship stays there, every opponent who arrives at that ${k('port')} pays you 1 coin.`
    ],
    [
      'Hot spices',
      'spices',
      `Sell up to 3 bags of spices at a ${k('market')}. Each bag is worth 2 coins.`
    ],
    [
      'Poison',
      'poison',
      `Choose an opponent: they discard one of their action cards face up. If it is a ${k('market')} card, take it into your hand.`
    ],
    [
      'Treasure map',
      'map',
      `Look at the top 3 cards of the deck, keep one and put the others at the bottom in any order you like.`
    ],
    [
      'Scales',
      'scales',
      `Swap a bag of spices with an opponent. If you are at the same ${k('market')}, you both gain 1 coin.`
    ],
    ['Hourglass', 'hourglass', ''],
    [
      'Smuggling',
      'dagger',
      `Take 2 bags of spices from the supply without paying for them. If an opponent is at your same ${k('port')} they can report you: in that case return the bags, pay 3 coins to the bank and skip your next turn. If nobody reports you by the end of the round, put the bags in your warehouse and gain 1 coin for each ${k('market')} you visited this turn. A player who has already reported someone this round cannot do it again, and a player with no coins cannot report. At the end of the game every Smuggling card played is worth 1 point less. If two players play Smuggling in the same turn, neither takes the bags and the turn passes to the next player.`
    ]
  ]
}

const PORTS = {
  it: [
    ['Alessandria', '3'],
    ['Venezia', '2'],
    ['Genova', '2'],
    ['Tunisi', '1']
  ],
  en: [
    ['Alexandria', '3'],
    ['Venice', '2'],
    ['Genoa', '2'],
    ['Tunis', '1']
  ]
}

export async function make(dest, lang) {
  const it = lang === 'it'
  const L = (a, b) => (it ? a : b)
  const N = names(lang)
  const C = N.C
  rmSync(dest, { recursive: true, force: true })
  for (const d of ['data', 'templates', 'assets/icons'])
    mkdirSync(join(dest, d), { recursive: true })

  const catalog = JSON.parse(readFileSync(join(REPO, 'resources/catalogs/game-icons.json'), 'utf8'))
  const paths = new Map(catalog.icons.map((i) => [i[0], i[1]]))
  const sources = {}
  for (const [name, id] of Object.entries(ICONS[lang])) {
    const d = paths.get(id)
    if (!d) throw new Error('icona mancante: ' + id)
    writeFileSync(
      join(dest, 'assets/icons', name + '.svg'),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="${d}"/></svg>`
    )
    const author = catalog.authors[id.split('/')[0]]
    sources[`icons/${name}.svg`] = {
      kind: 'icon',
      source: 'game-icons.net',
      id,
      title: id.split('/')[1],
      author: author.name,
      license: author.license,
      url: `https://game-icons.net/1x1/${id}.html`,
      imported: '2026-10-29'
    }
  }
  writeFileSync(join(dest, 'assets/sources.json'), JSON.stringify(sources, null, 2))

  const action = {
    name: N.tAction,
    width: 63,
    height: 88,
    bleed: 3,
    safeMargin: 3,
    cornerRadius: 3,
    front: [
      {
        type: 'text',
        name: C.name,
        ...box(7, 5.5, 49, 8),
        text: L('Nome', 'Name'),
        weight: 800,
        size: 13,
        color: '#FFFFFF',
        valign: 'middle',
        fit: 'shrink'
      },
      {
        type: 'image',
        name: C.icon,
        ...box(16.5, 12, 30, 26),
        src: '',
        fit: 'contain',
        tint: '#F4E3C3'
      },
      {
        type: 'shape',
        name: C.panel,
        ...box(4, 4, 55, 36),
        radius: 2,
        fill: '#9A4A2C',
        ...fixed
      },
      {
        type: 'text',
        name: C.text,
        ...box(6, 47, 51, 35),
        text: '',
        weight: 500,
        size: 9,
        color: '#2A241C',
        lineHeight: 1.25,
        fit: 'none'
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
        src: L('cammello', 'camel'),
        fit: 'contain',
        tint: '#E8C26A',
        ...fixed
      },
      {
        type: 'shape',
        name: L('retro_cornice', 'back_frame'),
        ...box(4, 4, 55, 80),
        radius: 2,
        fill: null,
        stroke: { color: '#E8C26A', width: 0.6 },
        ...fixed
      },
      {
        type: 'shape',
        name: L('retro_sfondo', 'back_background'),
        ...box(-3, -3, 69, 94),
        fill: '#5C2E1C',
        ...fixed
      }
    ]
  }

  const port = {
    name: N.tPort,
    kind: 'tile',
    width: 50,
    height: 43.3,
    shape: 'hexagon',
    bleed: 3,
    safeMargin: 2,
    cornerRadius: 0,
    front: [
      {
        type: 'text',
        name: C.name,
        ...box(6, 25, 38, 7),
        text: L('Porto', 'Port'),
        weight: 800,
        size: 10,
        color: '#FFFFFF',
        align: 'center',
        valign: 'middle',
        fit: 'shrink'
      },
      {
        type: 'text',
        name: L('punti_cerchio', 'points_circle'),
        ...box(17, 33, 16, 7),
        text: `[{${C.points}}]{bg=circle bg-color=#E8C26A color=#2A3550}`,
        weight: 800,
        size: 9,
        color: '#FFFFFF',
        align: 'center',
        valign: 'middle',
        ...fixed
      },
      {
        type: 'image',
        name: L('ancora', 'anchor'),
        ...box(17, 5, 16, 18),
        src: L('ancora', 'anchor'),
        fit: 'contain',
        tint: '#E8C26A',
        ...fixed
      },
      {
        type: 'shape',
        name: C.bg,
        ...box(-3, -3, 56, 49.3),
        fill: '#2A5D7C',
        locked: true,
        ...fixed
      }
    ],
    back: []
  }

  const routes = {
    name: N.tBoard,
    kind: 'board',
    width: 297,
    height: 210,
    bleed: 3,
    safeMargin: 5,
    cornerRadius: 0,
    front: [
      {
        type: 'text',
        name: C.title,
        ...box(15, 12, 267, 16),
        text: L('Le rotte delle spezie', 'The spice routes'),
        weight: 800,
        size: 30,
        color: '#5C2E1C',
        align: 'center',
        valign: 'middle',
        ...fixed
      },
      {
        type: 'text',
        name: C.rules,
        ...box(20, 160, 257, 34),
        text: L(
          `Ogni ${k('porto')} occupato a fine partita vale i punti scritti sulla tessera. Chi controlla più carovane in un ${k('mercato')} guadagna 3 monete.`,
          `Each occupied ${k('port')} at the end of the game is worth the points on its tile. Whoever controls the most caravans at a ${k('market')} gains 3 coins.`
        ),
        weight: 500,
        size: 16,
        color: '#2A241C',
        align: 'center',
        valign: 'middle',
        lineHeight: 1.3,
        ...fixed
      },
      {
        type: 'shape',
        name: L('mare', 'sea'),
        ...box(20, 36, 257, 116),
        radius: 6,
        fill: '#BFD6DC',
        ...fixed
      },
      {
        type: 'shape',
        name: C.bg,
        ...box(-3, -3, 303, 216),
        fill: '#F6EEDD',
        locked: true,
        ...fixed
      }
    ],
    back: []
  }
  for (const t of [action, port, routes])
    writeFileSync(join(dest, 'templates', t.name + '.json'), JSON.stringify(t, null, 2) + '\n')

  const dataFile = L('data/carte.xlsx', 'data/cards.xlsx')
  const wb = new ExcelJS.Workbook()
  const a = wb.addWorksheet(N.actions)
  a.addRow([C.name, C.icon, C.text])
  for (const c of CARDS[lang]) a.addRow(c)
  a.getColumn(1).width = 18
  a.getColumn(3).width = 90
  const p = wb.addWorksheet(N.ports)
  p.addRow([C.name, C.points])
  for (const r of PORTS[lang]) p.addRow(r)
  const b = wb.addWorksheet(N.board)
  b.addRow(['amount'])
  b.addRow([1])
  await wb.xlsx.writeFile(join(dest, dataFile))

  writeFileSync(
    join(dest, 'stella.json'),
    JSON.stringify(
      {
        formatVersion: 1,
        name: N.project,
        dataFile,
        sets: [
          { name: N.actions, template: N.tAction },
          { name: N.ports, template: N.tPort },
          { name: N.board, template: N.tBoard }
        ],
        styles: {},
        variables: {}
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
