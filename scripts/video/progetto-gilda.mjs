// Crea il progetto dimostrativo del video 30 (approfondimento «variabili con parametri»): «Gilda».
// Sei carte azione con un costo, una figura e un testo con parole chiave scritte a mano, tutte uguali a
// parte un numero («Pesca 2: prendi 2 carte dal mazzo»): il video le sostituisce con variabili con
// parametri. Il costo è un livello Valore (colonna) e un livello di testo lo mostra come {costo}: il
// video lo trasforma in una moneta con il numero sopra, {oro:{costo}}. Ci sono già le icone moneta,
// legno e spada (variabili icona), lo stile della parola chiave, un dado del bottino e un regolamento
// con un glossario. Le variabili con parametri le crea il video.
// Uso: node progetto-gilda.mjs <cartella di destinazione> <it|en>
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
    project: L('Gilda', 'Guild'),
    folder: L('Gilda', 'Guild'),
    actions: L('Azioni', 'Actions'),
    die: L('Dado del bottino', 'Loot die'),
    tAction: L('azione', 'action'),
    tDie: L('faccia', 'face'),
    doc: L('Regolamento', 'Rules'),
    keyword: L('parola_chiave', 'keyword'),
    I: {
      coin: L('moneta', 'coin'),
      wood: L('legno', 'wood'),
      sword: L('spada', 'sword'),
      guild: L('gilda', 'guild')
    },
    // variabili create dal video
    V: {
      draw: L('pesca', 'draw'),
      trade: L('scambia', 'trade'),
      attack: L('attacca', 'attack'),
      gold: L('oro', 'gold'),
      rest: L('riposa', 'rest')
    },
    C: {
      name: L('nome', 'name'),
      cost: L('costo', 'cost'),
      costBadge: L('costo_tondo', 'cost_badge'),
      figure: L('figura', 'figure'),
      text: L('testo', 'text'),
      band: L('fascia', 'band'),
      frame: L('cornice', 'frame'),
      bg: L('sfondo', 'background'),
      face: L('faccia', 'face')
    }
  }
}

const ICONS = (I) => ({
  [I.coin]: 'delapouite/two-coins',
  [I.wood]: 'delapouite/log',
  [I.sword]: 'lorc/crossed-swords',
  [I.guild]: 'delapouite/castle',
  explorer: 'lorc/compass',
  merchant: 'lorc/swap-bag',
  scholar: 'delapouite/book-pile',
  warrior: 'cathelineau/swordwoman',
  thief: 'darkzaitzev/hooded-assassin',
  herbalist: 'delapouite/herbs-bundle'
})

// nome, costo, figura, testo
export function cards(lang, N) {
  const k = (s) => `[${s}]{.${N.keyword}}`
  const { coin, wood, sword } = N.I
  return lang === 'it'
    ? [
        ['Esploratrice', 2, 'explorer', `${k('Pesca 2')}: prendi 2 carte dal mazzo.`],
        ['Mercante', 3, 'merchant', `Dai 3{${coin}}, ricevi 1{${wood}}.`],
        ['Bibliotecario', 4, 'scholar', `${k('Pesca 3')}: prendi 3 carte dal mazzo.`],
        ['Guerriera', 3, 'warrior', `${k('Attacca 2')}: 2{${sword}} a un nemico.`],
        ['Ladro', 2, 'thief', `${k('Attacca 1')}: 1{${sword}} a ogni nemico. Ruba 1{${coin}}.`],
        ['Erborista', 1, 'herbalist', `${k('Pesca 2')}: prendi 2 carte dal mazzo, poi scarta una carta.`]
      ]
    : [
        ['Explorer', 2, 'explorer', `${k('Draw 2')}: take 2 cards from the deck.`],
        ['Merchant', 3, 'merchant', `Give 3{${coin}}, get 1{${wood}}.`],
        ['Librarian', 4, 'scholar', `${k('Draw 3')}: take 3 cards from the deck.`],
        ['Warrior', 3, 'warrior', `${k('Attack 2')}: 2{${sword}} to one enemy.`],
        ['Thief', 2, 'thief', `${k('Attack 1')}: 1{${sword}} to every enemy. Steal 1{${coin}}.`],
        ['Herbalist', 1, 'herbalist', `${k('Draw 2')}: take 2 cards from the deck, then discard a card.`]
      ]
}

const DOC = (lang, N) =>
  lang === 'it'
    ? `# ${N.project}

Ogni giocatore guida una gilda di avventurieri. Al tuo turno gioca una carta azione pagando il suo costo in monete, poi fai quello che dice il testo.

## Parole chiave

Le parole in grassetto rosso sono parole chiave: hanno sempre lo stesso significato.

`
    : `# ${N.project}

Each player leads a guild of adventurers. On your turn play an action card by paying its cost in coins, then do what its text says.

## Keywords

The words in bold red are keywords: they always mean the same thing.

`

export async function make(dest, lang) {
  const it = lang === 'it'
  const L = (a, b) => (it ? a : b)
  const N = names(lang)
  const { C, I } = N
  rmSync(dest, { recursive: true, force: true })
  for (const d of ['data', 'templates', 'docs']) mkdirSync(join(dest, d), { recursive: true })
  writeIcons(dest, ICONS(I))

  const ink = '#2B2420'
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
        name: C.costBadge,
        ...box(4.5, 4, 12, 12),
        text: `{${C.cost}}`,
        weight: 800,
        size: 15,
        color: '#FFFFFF',
        align: 'center',
        valign: 'middle',
        ...fixed
      },
      {
        type: 'text',
        name: C.name,
        ...box(18, 5, 40, 10),
        text: L('Nome', 'Name'),
        weight: 800,
        size: 12,
        color: '#FFFFFF',
        valign: 'middle',
        fit: 'shrink'
      },
      {
        type: 'image',
        name: C.figure,
        ...box(16.5, 20, 30, 30),
        src: 'explorer',
        fit: 'contain',
        tint: '#5B4636'
      },
      {
        type: 'text',
        name: C.text,
        ...box(7, 54, 49, 26),
        text: '',
        weight: 500,
        size: 9,
        color: ink,
        lineHeight: 1.3,
        align: 'center',
        valign: 'middle',
        fit: 'shrink'
      },
      {
        type: 'value',
        name: C.cost,
        value: '0',
        ...box(0, 0, 10, 10)
      },
      {
        type: 'shape',
        name: C.band,
        ...box(4, 4, 55, 12),
        radius: 2,
        fill: '#6E2B22',
        ...fixed
      },
      {
        type: 'shape',
        name: C.frame,
        ...box(3, 3, 57, 82),
        radius: 2.5,
        fill: null,
        stroke: { color: '#CDB79A', width: 0.6 },
        ...fixed
      },
      {
        type: 'shape',
        name: C.bg,
        ...box(-3, -3, 69, 94),
        fill: '#F4ECDD',
        locked: true,
        ...fixed
      }
    ],
    back: [
      {
        type: 'image',
        name: L('retro_icona', 'back_icon'),
        ...box(16.5, 29, 30, 30),
        src: I.guild,
        fit: 'contain',
        tint: '#E3B95B',
        ...fixed
      },
      {
        type: 'shape',
        name: L('retro_sfondo', 'back_background'),
        ...box(-3, -3, 69, 94),
        fill: '#6E2B22',
        ...fixed
      }
    ]
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
        size: 22,
        weight: 800,
        color: ink,
        align: 'center',
        valign: 'middle'
      },
      {
        type: 'shape',
        name: C.bg,
        ...box(-1, -1, 18, 18),
        fill: '#F4ECDD',
        ...fixed
      }
    ],
    back: []
  }
  for (const t of [action, face])
    writeFileSync(join(dest, 'templates', t.name + '.json'), JSON.stringify(t, null, 2) + '\n')

  const dataFile = L('data/carte.xlsx', 'data/cards.xlsx')
  const wb = new ExcelJS.Workbook()
  const a = wb.addWorksheet(N.actions)
  a.addRow([C.name, C.cost, C.figure, C.text])
  for (const c of cards(lang, N)) a.addRow(c)
  a.getColumn(1).width = 18
  a.getColumn(4).width = 70
  const d = wb.addWorksheet(N.die)
  d.addRow([C.face])
  for (const f of ['1', '1', '2', '2', '3', `{${I.wood}}`]) d.addRow([f])
  await wb.xlsx.writeFile(join(dest, dataFile))

  writeFileSync(join(dest, 'docs', N.doc + '.md'), DOC(lang, N))

  writeFileSync(
    join(dest, 'stella.json'),
    JSON.stringify(
      {
        formatVersion: 1,
        name: N.project,
        dataFile,
        sets: [
          { name: N.actions, template: N.tAction },
          { name: N.die, template: N.tDie }
        ],
        styles: { [N.keyword]: 'weight=800 color=#A3342A' },
        variables: {
          [I.coin]: { type: 'image', src: I.coin, tint: '#B8892B' },
          [I.wood]: { type: 'image', src: I.wood, tint: '#7A5230' },
          [I.sword]: { type: 'image', src: I.sword, tint: '#5E6670' }
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
