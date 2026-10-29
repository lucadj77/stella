// Crea il progetto dimostrativo del quarto approfondimento (video 23, le formule): «Bestiario». Otto
// creature con nome, elemento, livello, attacco, difesa e abilità; il template ha già il posto per i
// valori calcolati (forza, indole, costo, rango, numero), che il video riempie con le formule una funzione
// alla volta. Un segnalino ferita stampato in più copie e una tessera tana mostrano le variabili di sistema.
// Uso: node progetto-formule.mjs <cartella di destinazione> <it|en>
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
    project: L('Bestiario', 'Bestiary'),
    folder: L('Bestiario', 'Bestiary'),
    creatures: L('Creature', 'Creatures'),
    wounds: L('Segnalini', 'Markers'),
    lairs: L('Tane', 'Lairs'),
    tCreature: L('creatura', 'creature'),
    tMarker: L('segnalino', 'marker'),
    tLair: L('tana', 'lair'),
    // elementi: anche i nomi delle variabili icona
    E: [L('fuoco', 'fire'), L('acqua', 'water'), L('terra', 'earth')],
    I: {
      sword: L('spada', 'sword'),
      shield: L('scudo', 'shield'),
      wound: L('ferita', 'wound'),
      poison: L('veleno', 'poison'),
      lair: L('caverna', 'cave')
    },
    C: {
      name: L('nome', 'name'),
      element: L('elemento', 'element'),
      level: L('livello', 'level'),
      attack: L('attacco', 'attack'),
      defense: L('difesa', 'defense'),
      ability: L('abilita', 'ability'),
      portrait: L('ritratto', 'portrait'),
      stats: L('valori', 'stats'),
      strength: L('forza', 'strength'),
      temper: L('indole', 'temper'),
      cost: L('costo', 'cost'),
      costBg: L('costo_cerchio', 'cost_circle'),
      rank: L('rango', 'rank'),
      number: L('numero', 'number'),
      band: L('fascia', 'band'),
      frame: L('cornice', 'frame'),
      bg: L('sfondo', 'background'),
      type: L('tipo', 'type'),
      mark: L('segno', 'mark'),
      count: L('conteggio', 'count'),
      footer: L('piede', 'footer')
    }
  }
}

// i ritratti delle creature, con il nome del file nella lingua del progetto
const PORTRAITS = {
  it: ['drago', 'salamandra', 'kraken', 'spirito', 'ent', 'lupo', 'golem', 'fenice'],
  en: ['dragon', 'salamander', 'kraken', 'spirit', 'ent', 'wolf', 'golem', 'phoenix']
}
const PORTRAIT_IDS = [
  'delapouite/spiked-dragon-head',
  'lorc/salamander',
  'delapouite/kraken-tentacle',
  'lorc/ghost',
  'cathelineau/tree-face',
  'lorc/wolf-head',
  'delapouite/rock-golem',
  'lorc/bird-twitter'
]
const ICONS = (N, lang) => ({
  ...Object.fromEntries(PORTRAITS[lang].map((p, i) => [p, PORTRAIT_IDS[i]])),
  [N.E[0]]: 'sbed/fire',
  [N.E[1]]: 'sbed/water-drop',
  [N.E[2]]: 'delapouite/oak-leaf',
  [N.I.sword]: 'lorc/broadsword',
  [N.I.shield]: 'lorc/checked-shield',
  [N.I.wound]: 'lorc/broken-heart',
  [N.I.poison]: 'sbed/poison',
  [N.I.lair]: 'delapouite/cave-entrance'
})

// nome, elemento (indice), livello, attacco, difesa, abilità; il ritratto è in PORTRAITS
const CREATURES = {
  it: [
    ['Drago di brace', 0, 3, 6, 4, 'Vola. Infligge 1 danno a tutte le creature vicine.'],
    ['Salamandra', 0, 1, 3, 1, ''],
    ['Kraken', 1, 3, 5, 5, 'Afferra: la creatura bersaglio non può muoversi.'],
    ['Spirito del fiume', 1, 2, 2, 4, 'Cura 1 ferita a una creatura amica.'],
    ['Ent', 2, 3, 3, 7, ''],
    ['Lupo grigio', 2, 1, 3, 2, 'Caccia in branco: +1 attacco per ogni altro lupo.'],
    ['Golem di pietra', 2, 2, 2, 6, ''],
    ['Fenice', 0, 2, 4, 2, 'Quando muore, torna nella tua mano.']
  ],
  en: [
    ['Ember dragon', 0, 3, 6, 4, 'Flies. Deals 1 damage to every nearby creature.'],
    ['Salamander', 0, 1, 3, 1, ''],
    ['Kraken', 1, 3, 5, 5, 'Grab: the target creature cannot move.'],
    ['River spirit', 1, 2, 2, 4, 'Heal 1 wound on a friendly creature.'],
    ['Ent', 2, 3, 3, 7, ''],
    ['Grey wolf', 2, 1, 3, 2, 'Pack hunter: +1 attack for each other wolf.'],
    ['Stone golem', 2, 2, 2, 6, ''],
    ['Phoenix', 0, 2, 4, 2, 'When it dies, it returns to your hand.']
  ]
}

export async function make(dest, lang) {
  const it = lang === 'it'
  const L = (a, b) => (it ? a : b)
  const N = names(lang)
  const { C, I, E } = N
  rmSync(dest, { recursive: true, force: true })
  for (const d of ['data', 'templates']) mkdirSync(join(dest, d), { recursive: true })
  writeIcons(dest, ICONS(N, lang))

  const ink = '#2A241C'
  const creature = {
    name: N.tCreature,
    width: 63,
    height: 88,
    bleed: 3,
    safeMargin: 3,
    cornerRadius: 3,
    front: [
      {
        type: 'text',
        name: C.name,
        ...box(6, 5, 51, 9),
        text: L('Nome', 'Name'),
        weight: 800,
        size: 11,
        color: '#FFFFFF',
        align: 'center',
        valign: 'middle',
        fit: 'shrink'
      },
      {
        type: 'text',
        name: C.rank,
        ...box(6, 15.5, 51, 5),
        text: '',
        italic: true,
        weight: 600,
        size: 7.5,
        color: '#6B6255',
        align: 'center',
        valign: 'middle',
        ...fixed
      },
      {
        type: 'text',
        name: C.cost,
        ...box(47, 21, 11, 11),
        text: '',
        weight: 800,
        size: 14,
        color: ink,
        align: 'center',
        valign: 'middle',
        ...fixed
      },
      {
        type: 'shape',
        name: C.costBg,
        ...box(47, 21, 11, 11),
        shape: 'ellipse',
        fill: '#E8C26A',
        ...fixed
      },
      {
        type: 'image',
        name: C.element,
        ...box(5, 21, 11, 11),
        src: E[0],
        fit: 'contain'
      },
      {
        type: 'image',
        name: C.portrait,
        ...box(18.5, 21, 26, 26),
        src: '',
        fit: 'contain',
        tint: ink
      },
      {
        type: 'text',
        name: C.stats,
        ...box(6, 49, 34, 7),
        text: `{${I.sword}} {${C.attack}}   {${I.shield}} {${C.defense}}`,
        weight: 800,
        size: 11,
        color: ink,
        valign: 'middle',
        ...fixed
      },
      {
        type: 'text',
        name: C.strength,
        ...box(40, 49, 17, 7),
        text: '',
        weight: 700,
        size: 9,
        color: ink,
        align: 'right',
        valign: 'middle',
        ...fixed
      },
      {
        type: 'text',
        name: C.temper,
        ...box(6, 57, 51, 6),
        text: '',
        italic: true,
        weight: 600,
        size: 8.5,
        color: '#6B6255',
        valign: 'middle',
        ...fixed
      },
      {
        type: 'text',
        name: C.ability,
        ...box(6, 64, 51, 15),
        text: '',
        weight: 500,
        size: 8.5,
        color: ink,
        lineHeight: 1.25
      },
      {
        type: 'text',
        name: C.number,
        ...box(30, 80, 27, 4),
        text: '',
        weight: 600,
        size: 6.5,
        color: '#6B6255',
        align: 'right',
        valign: 'middle',
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
        type: 'shape',
        name: C.frame,
        ...box(3, 3, 57, 82),
        radius: 2.5,
        fill: null,
        stroke: { color: '#5A5148', width: 0.8 },
        ...fixed
      },
      {
        type: 'shape',
        name: C.bg,
        ...box(-3, -3, 69, 94),
        fill: '#F3ECDD',
        locked: true,
        ...fixed
      }
    ],
    back: [
      {
        type: 'text',
        name: C.footer,
        ...box(6, 70, 51, 8),
        text: '',
        weight: 700,
        size: 8,
        color: '#E8C26A',
        align: 'center',
        valign: 'middle',
        ...fixed
      },
      {
        type: 'text',
        name: L('retro_titolo', 'back_title'),
        ...box(6, 36, 51, 16),
        text: L('Bestiario', 'Bestiary'),
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

  const marker = {
    name: N.tMarker,
    kind: 'token',
    width: 25,
    height: 25,
    shape: 'ellipse',
    bleed: 2,
    safeMargin: 2,
    cornerRadius: 0,
    front: [
      {
        type: 'text',
        name: C.count,
        ...box(4, 17, 17, 5),
        text: '',
        weight: 700,
        size: 7,
        color: '#FFFFFF',
        align: 'center',
        valign: 'middle',
        ...fixed
      },
      {
        type: 'image',
        name: C.mark,
        ...box(6.5, 4, 12, 12),
        src: I.wound,
        fit: 'contain',
        tint: '#FFFFFF'
      },
      {
        type: 'shape',
        name: C.bg,
        ...box(-2, -2, 29, 29),
        shape: 'ellipse',
        fill: '#8A2E22',
        ...fixed
      }
    ],
    back: []
  }

  const lair = {
    name: N.tLair,
    kind: 'tile',
    width: 40,
    height: 40,
    bleed: 2,
    safeMargin: 2,
    cornerRadius: 2,
    front: [
      {
        type: 'text',
        name: C.name,
        ...box(3, 28, 34, 8),
        text: '',
        weight: 800,
        size: 9,
        color: ink,
        align: 'center',
        valign: 'middle'
      },
      {
        type: 'text',
        name: C.number,
        ...box(3, 3, 34, 5),
        text: '',
        weight: 700,
        size: 7,
        color: '#6B6255',
        align: 'center',
        valign: 'middle',
        ...fixed
      },
      {
        type: 'image',
        name: L('icona', 'icon'),
        ...box(11, 9, 18, 18),
        src: I.lair,
        fit: 'contain',
        tint: '#5A5148',
        ...fixed
      },
      {
        type: 'shape',
        name: C.bg,
        ...box(-2, -2, 44, 44),
        fill: '#D9C7A8',
        ...fixed
      }
    ],
    back: []
  }
  for (const t of [creature, marker, lair])
    writeFileSync(join(dest, 'templates', t.name + '.json'), JSON.stringify(t, null, 2) + '\n')

  const dataFile = L('data/carte.xlsx', 'data/cards.xlsx')
  const wb = new ExcelJS.Workbook()
  const a = wb.addWorksheet(N.creatures)
  a.addRow([C.name, C.element, C.level, C.attack, C.defense, C.ability, C.portrait])
  CREATURES[lang].forEach(([n, e, lv, at, df, ab], i) =>
    a.addRow([n, E[e], lv, at, df, ab, PORTRAITS[lang][i]])
  )
  a.getColumn(1).width = 20
  a.getColumn(6).width = 50
  const m = wb.addWorksheet(N.wounds)
  m.addRow(['amount', C.type, C.mark])
  m.addRow([5, I.wound, I.wound])
  m.addRow([3, I.poison, I.poison])
  const t = wb.addWorksheet(N.lairs)
  t.addRow([C.name])
  for (const n of L(
    ['Grotta di brace', 'Fondale', 'Bosco antico', 'Cava'],
    ['Ember cave', 'Seabed', 'Old forest', 'Quarry']
  ))
    t.addRow([n])
  await wb.xlsx.writeFile(join(dest, dataFile))

  const badge = (src, bgColor) => ({
    type: 'image',
    src,
    tint: '#FFFFFF',
    bg: 'circle',
    bgColor,
    bgPad: 0.22
  })
  writeFileSync(
    join(dest, 'stella.json'),
    JSON.stringify(
      {
        formatVersion: 1,
        name: N.project,
        dataFile,
        sets: [
          { name: N.creatures, template: N.tCreature },
          { name: N.wounds, template: N.tMarker },
          { name: N.lairs, template: N.tLair }
        ],
        styles: {},
        variables: {
          [E[0]]: badge(`icons/${E[0]}`, '#B5442E'),
          [E[1]]: badge(`icons/${E[1]}`, '#2A5D7C'),
          [E[2]]: badge(`icons/${E[2]}`, '#5B7A3A'),
          [I.sword]: { type: 'image', src: `icons/${I.sword}`, tint: ink },
          [I.shield]: { type: 'image', src: `icons/${I.shield}`, tint: ink }
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
