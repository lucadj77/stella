// Crea il progetto del video 28 (approfondimento «le statistiche del set»): «Schermaglia», un piccolo
// gioco di schermaglie con tre set. Unità: 18 carte di tre fazioni con copie diverse, costo, forza,
// difesa e un'abilità con icone, grassetti e una variabile di testo; due costi vuoti prendono il valore
// del modello, nessuna carta costa 4 (un buco da trovare) e il Berserker costa poco ma è fortissimo
// (spicca nella dispersione). Eventi: 10 carte da mescolare alle unità nella pesca. Dadi: due dadi
// a sei facce, uno d'attacco e uno di difesa, con le icone spada e scudo.
// La potenza è un livello Valore con formula {forza} + {difesa}: forza e difesa sono livelli del modello.
// Uso: node progetto-statistiche.mjs <cartella di destinazione> <it|en>
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
    project: L('Schermaglia', 'Skirmish'),
    units: L('Unità', 'Units'),
    events: L('Eventi', 'Events'),
    dice: L('Dadi', 'Dice'),
    tUnit: L('unità', 'unit'),
    tEvent: L('evento', 'event'),
    tDie: L('dado', 'die'),
    C: {
      name: L('nome', 'name'),
      faction: L('fazione', 'faction'),
      cost: L('costo', 'cost'),
      strength: L('forza', 'strength'),
      defense: L('difesa', 'defense'),
      power: L('potenza', 'power'),
      ability: L('abilità', 'ability'),
      kind: L('tipo', 'type'),
      text: L('testo', 'text'),
      face: L('faccia', 'face'),
      die: L('dado', 'die'),
      band: L('fascia', 'band'),
      bg: L('sfondo', 'background'),
      gem: L('gemma', 'gem')
    },
    F: { kingdom: L('Regno', 'Kingdom'), clan: 'Clan', shadow: L('Ombra', 'Shadow') },
    V: { sword: L('spada', 'sword'), shield: L('scudo', 'shield'), sneak: L('furtivo', 'stealth') }
  }
}

// nome, fazione, costo (vuoto = quello del modello, 2), forza, difesa, abilità, copie
function units(lang) {
  const it = lang === 'it'
  const { F, V } = names(lang)
  const s = `{${V.sword}}`
  const d = `{${V.shield}}`
  const k = `{${V.sneak}}`
  const L = (a, b) => (it ? a : b)
  return [
    [L('Fante', 'Footman'), F.kingdom, 1, 1, 2, '', 3],
    [
      L('Arciere', 'Archer'),
      F.kingdom,
      2,
      2,
      1,
      L(`**Tiro**: ${s} a distanza`, `**Shot**: ${s} at range`),
      2
    ],
    [
      L('Cavaliere', 'Knight'),
      F.kingdom,
      3,
      3,
      3,
      L(`**Carica**: +1 ${s}`, `**Charge**: +1 ${s}`),
      2
    ],
    [L('Guardia', 'Guard'), F.kingdom, '', 1, 3, d, 2],
    [
      L('Paladino', 'Paladin'),
      F.kingdom,
      5,
      4,
      5,
      L(`${d}${d} agli alleati`, `${d}${d} to allies`),
      1
    ],
    [
      L('Re', 'King'),
      F.kingdom,
      6,
      5,
      5,
      L('**Comando**: pesca una carta', '**Command**: draw a card'),
      1
    ],
    [L('Razziatore', 'Raider'), F.clan, 1, 2, 1, '', 3],
    ['Berserker', F.clan, 1, 6, 1, L(`**Furia**: ${s}${s}`, `**Fury**: ${s}${s}`), 1],
    [L('Guerriero', 'Warrior'), F.clan, 2, 2, 2, '', 2],
    [L('Lupo', 'Wolf'), F.clan, '', 3, 1, L('**Rapido**', '**Swift**'), 2],
    [L('Sciamano', 'Shaman'), F.clan, 3, 1, 2, L('**Rito**: cura 2', '**Rite**: heal 2'), 1],
    [
      L('Capoclan', 'Chieftain'),
      F.clan,
      5,
      5,
      4,
      L(`**Comando**: ${s} a tutti`, `**Command**: ${s} to all`),
      1
    ],
    [L('Spia', 'Spy'), F.shadow, 1, 1, 1, k, 2],
    [L('Spettro', 'Wraith'), F.shadow, 2, 2, 3, d, 2],
    [L('Assassino', 'Assassin'), F.shadow, 3, 5, 1, `${k}: ${s}${s}`, 1],
    [
      L('Strega', 'Witch'),
      F.shadow,
      3,
      2,
      2,
      L(`**Maledizione**: −1 ${d}`, `**Curse**: −1 ${d}`),
      1
    ],
    [
      L('Negromante', 'Necromancer'),
      F.shadow,
      5,
      3,
      3,
      L('**Rito**: rianima', '**Rite**: raise'),
      1
    ],
    [
      L('Ombra antica', 'Elder shadow'),
      F.shadow,
      6,
      6,
      4,
      L(`${k} **Terrore**`, `${k} **Terror**`),
      1
    ]
  ]
}

// nome, tipo, costo, testo, copie
function events(lang) {
  const it = lang === 'it'
  const { V } = names(lang)
  const s = `{${V.sword}}`
  const d = `{${V.shield}}`
  const L = (a, b) => (it ? a : b)
  const A = L('Attacco', 'Attack')
  const D = L('Difesa', 'Defense')
  const T = L('Trucco', 'Trick')
  return [
    [L('Assalto', 'Assault'), A, 2, `+2 ${s}`, 2],
    [L('Imboscata', 'Ambush'), A, 1, `+1 ${s}`, 2],
    [L('Pioggia di frecce', 'Arrow rain'), A, 3, L(`${s} a tutti`, `${s} to all`), 1],
    [L('Muro di scudi', 'Shield wall'), D, 2, `+2 ${d}`, 2],
    [L('Ritirata', 'Retreat'), D, 1, L('Torna in mano', 'Back to hand'), 1],
    [L('Fortezza', 'Fortress'), D, 3, `+3 ${d}`, 1],
    [L('Inganno', 'Deceit'), T, 1, L('Scambia due carte', 'Swap two cards'), 1],
    [L('Nebbia', 'Fog'), T, 2, L('Nessuno attacca', 'No one attacks'), 1],
    [L('Tradimento', 'Betrayal'), T, 3, L('Prendi un’unità', 'Take a unit'), 1],
    [L('Rinforzi', 'Reinforcements'), T, 2, L('Pesca due carte', 'Draw two cards'), 1]
  ]
}

function dice(lang) {
  const { V } = names(lang)
  const s = `{${V.sword}}`
  const d = `{${V.shield}}`
  // il dado d'attacco: 3 facce con una spada, una con due, una vuota, uno scudo
  // il dado di difesa: 3 facce con uno scudo, una con due, due vuote
  return [s, s, s + s, s, '', d, d, d, d + d, d, '', '']
}

export async function make(dest, lang) {
  const it = lang === 'it'
  const L = (a, b) => (it ? a : b)
  const N = names(lang)
  const { C, F, V } = N
  rmSync(dest, { recursive: true, force: true })
  for (const d of ['data', 'templates', 'assets/icons'])
    mkdirSync(join(dest, d), { recursive: true })

  writeIcons(dest, { [V.sword]: 'lorc/broadsword', [V.shield]: 'lorc/checked-shield' })

  const bandFill = `=IF({${C.faction}}="${F.kingdom}";"#3D5A8C";IF({${C.faction}}="${F.clan}";"#9A4A2C";"#5B3F7A"))`
  const unit = {
    name: N.tUnit,
    width: 63,
    height: 88,
    bleed: 3,
    safeMargin: 3,
    cornerRadius: 3,
    front: [
      {
        type: 'value',
        name: C.power,
        ...box(0, 0, 10, 10),
        source: { kind: 'formula', expr: `={${C.strength}}+{${C.defense}}` }
      },
      {
        type: 'text',
        name: C.cost,
        ...box(5, 5, 10, 10),
        text: '2',
        weight: 800,
        size: 14,
        color: '#2A241C',
        align: 'center',
        valign: 'middle'
      },
      {
        type: 'shape',
        name: C.gem,
        ...box(4.5, 4.5, 11, 11),
        shape: 'ellipse',
        fill: '#F2D98B',
        ...fixed
      },
      {
        type: 'text',
        name: C.name,
        ...box(17, 5, 41, 7),
        text: L('Nome', 'Name'),
        weight: 800,
        size: 12,
        color: '#FFFFFF',
        valign: 'middle',
        fit: 'shrink'
      },
      {
        type: 'text',
        name: C.faction,
        ...box(17, 11.5, 41, 4),
        text: F.kingdom,
        weight: 600,
        size: 7,
        color: '#F1E6D0',
        valign: 'middle'
      },
      {
        type: 'shape',
        name: C.band,
        ...box(3, 3, 57, 15),
        radius: 2,
        fill: '#3D5A8C',
        source: { kind: 'formula', expr: bandFill }
      },
      {
        type: 'text',
        name: C.ability,
        ...box(6, 24, 51, 36),
        text: '',
        weight: 500,
        size: 10,
        color: '#2A241C',
        align: 'center',
        valign: 'middle',
        lineHeight: 1.25
      },
      {
        type: 'text',
        name: C.strength,
        ...box(16, 68, 12, 13),
        text: '1',
        weight: 800,
        size: 16,
        color: '#9A2C2C',
        valign: 'middle'
      },
      {
        type: 'text',
        name: L('icona_forza', 'strength_icon'),
        ...box(6, 68, 10, 13),
        text: `{${V.sword}}`,
        size: 16,
        valign: 'middle',
        ...fixed
      },
      {
        type: 'text',
        name: C.defense,
        ...box(45, 68, 12, 13),
        text: '1',
        weight: 800,
        size: 16,
        color: '#2C5A9A',
        valign: 'middle'
      },
      {
        type: 'text',
        name: L('icona_difesa', 'defense_icon'),
        ...box(35, 68, 10, 13),
        text: `{${V.shield}}`,
        size: 16,
        valign: 'middle',
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
  const event = {
    name: N.tEvent,
    width: 63,
    height: 88,
    bleed: 3,
    safeMargin: 3,
    cornerRadius: 3,
    front: [
      {
        type: 'text',
        name: C.cost,
        ...box(5, 5, 10, 10),
        text: '1',
        weight: 800,
        size: 14,
        color: '#2A241C',
        align: 'center',
        valign: 'middle'
      },
      {
        type: 'shape',
        name: C.gem,
        ...box(4.5, 4.5, 11, 11),
        shape: 'ellipse',
        fill: '#F2D98B',
        ...fixed
      },
      {
        type: 'text',
        name: C.name,
        ...box(17, 5, 41, 7),
        text: L('Nome', 'Name'),
        weight: 800,
        size: 12,
        color: '#FFFFFF',
        valign: 'middle',
        fit: 'shrink'
      },
      {
        type: 'text',
        name: C.kind,
        ...box(17, 11.5, 41, 4),
        text: L('Attacco', 'Attack'),
        weight: 600,
        size: 7,
        color: '#F1E6D0',
        valign: 'middle'
      },
      {
        type: 'shape',
        name: C.band,
        ...box(3, 3, 57, 15),
        radius: 2,
        fill: '#4A6B3A',
        ...fixed
      },
      {
        type: 'text',
        name: C.text,
        ...box(6, 26, 51, 52),
        text: '',
        weight: 600,
        size: 12,
        color: '#2A241C',
        align: 'center',
        valign: 'middle',
        lineHeight: 1.25
      },
      {
        type: 'shape',
        name: C.bg,
        ...box(-3, -3, 69, 94),
        fill: '#EEF0E2',
        locked: true,
        ...fixed
      }
    ],
    back: []
  }
  const die = {
    name: N.tDie,
    kind: 'die',
    width: 20,
    height: 20,
    bleed: 0,
    cornerRadius: 3,
    front: [
      {
        type: 'text',
        name: C.face,
        ...box(1, 1, 18, 18),
        text: '',
        size: 16,
        color: '#2A241C',
        align: 'center',
        valign: 'middle'
      },
      {
        type: 'shape',
        name: C.bg,
        ...box(0, 0, 20, 20),
        fill: '#F6EEDD',
        locked: true,
        ...fixed
      }
    ],
    back: []
  }
  for (const t of [unit, event, die])
    writeFileSync(join(dest, 'templates', t.name + '.json'), JSON.stringify(t, null, 2) + '\n')

  const dataFile = L('data/carte.xlsx', 'data/cards.xlsx')
  const wb = new ExcelJS.Workbook()
  const u = wb.addWorksheet(N.units)
  u.addRow([C.name, C.faction, C.cost, C.strength, C.defense, C.ability, 'amount'])
  for (const r of units(lang)) u.addRow(r)
  u.getColumn(1).width = 16
  u.getColumn(6).width = 30
  const e = wb.addWorksheet(N.events)
  e.addRow([C.name, C.kind, C.cost, C.text, 'amount'])
  for (const r of events(lang)) e.addRow(r)
  e.getColumn(1).width = 18
  const d = wb.addWorksheet(N.dice)
  d.addRow([C.face, C.die])
  dice(lang).forEach((f, i) =>
    d.addRow([f, i < 6 ? L('Attacco', 'Attack') : L('Difesa', 'Defense')])
  )
  await wb.xlsx.writeFile(join(dest, dataFile))

  writeFileSync(
    join(dest, 'stella.json'),
    JSON.stringify(
      {
        formatVersion: 1,
        name: N.project,
        dataFile,
        sets: [
          { name: N.units, template: N.tUnit },
          { name: N.events, template: N.tEvent },
          { name: N.dice, template: N.tDie }
        ],
        styles: {},
        variables: {
          [V.sword]: { type: 'image', src: V.sword, tint: '#9A2C2C' },
          [V.shield]: { type: 'image', src: V.shield, tint: '#2C5A9A' },
          [V.sneak]: {
            type: 'text',
            text: L('[Furtivo]{weight=800 color=#5B3F7A}', '[Stealth]{weight=800 color=#5B3F7A}')
          }
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
