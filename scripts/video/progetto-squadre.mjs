// Crea il progetto dimostrativo del video 32 (approfondimento «template derivati o varianti?»):
// «Campionato», un gioco di calcio con tre squadre. Ci sono due set:
// - Azioni: le carte azione, uguali per ogni squadra. Il video crea un template derivato per squadra
//   e un set per squadra che usa lo stesso foglio (dati condivisi).
// - Mercato: un solo mazzo con giocatori di tutte le squadre. Il video crea le varianti del template
//   giocatore, una per squadra, e ogni carta sceglie la sua.
// Gli stemmi delle squadre (stemmi/) e il pallone del template di base vengono da game-icons.net.
// Uso: node progetto-squadre.mjs <cartella di destinazione> <it|en>
//      oppure da un altro script: make(cartella, lingua)
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const REPO = new URL('../..', import.meta.url).pathname
const ExcelJS = createRequire(join(REPO, 'package.json'))('exceljs')

const box = (x, y, w, h) => ({ x, y, w, h })
const fixed = { source: { kind: 'fixed' } }

export function names(lang) {
  const it = lang === 'it'
  const L = (a, b) => (it ? a : b)
  return {
    project: L('Campionato', 'League'),
    folder: L('Campionato', 'League'),
    actions: L('Azioni', 'Actions'),
    market: L('Mercato', 'Market'),
    tAction: L('azione', 'action'),
    tPlayer: L('giocatore', 'player'),
    crests: L('stemmi', 'crests'),
    ball: L('pallone', 'ball'),
    free: L('Svincolato', 'Free agent'),
    // squadre: nome, stemma, colore
    teams: [
      { name: L('Leoni', 'Lions'), crest: L('leone', 'lion'), color: '#B3261E' },
      { name: L('Falchi', 'Hawks'), crest: L('falco', 'hawk'), color: '#1F4E8C' },
      { name: L('Lupi', 'Wolves'), crest: L('lupo', 'wolf'), color: '#2E6B3A' }
    ],
    C: {
      bg: L('sfondo', 'background'),
      band: L('banda', 'band'),
      crest: L('stemma', 'crest'),
      team: L('squadra', 'team'),
      name: L('nome', 'name'),
      text: L('testo', 'text'),
      power: L('forza', 'power'),
      circle: L('cerchio', 'circle'),
      portrait: L('ritratto', 'portrait'),
      role: L('ruolo', 'role'),
      value: L('valore', 'value')
    }
  }
}

const ICONS = (it) => ({
  [it ? 'leone' : 'lion']: 'lorc/lion',
  [it ? 'falco' : 'hawk']: 'lorc/hawk-emblem',
  [it ? 'lupo' : 'wolf']: 'lorc/wolf-head',
  [it ? 'pallone' : 'ball']: 'delapouite/soccer-ball',
  [it ? 'calciatore' : 'kicker']: 'delapouite/soccer-kick'
})

export function actions(lang) {
  return lang === 'it'
    ? [
        ['Passaggio', 'Sposta la palla fino a 2 caselle, verso un compagno.', 2],
        ['Tiro', 'Tira in porta: somma la forza al dado.', 4],
        ['Dribbling', 'Supera un avversario adiacente.', 3],
        ['Contrasto', 'Ruba la palla a un avversario adiacente.', 3],
        ['Cross', 'Lancia la palla in area da una fascia.', 2],
        ['Parata', 'Annulla un tiro avversario.', 4]
      ]
    : [
        ['Pass', 'Move the ball up to 2 spaces, toward a teammate.', 2],
        ['Shot', 'Shoot at goal: add the power to the die.', 4],
        ['Dribble', 'Get past an adjacent opponent.', 3],
        ['Tackle', 'Steal the ball from an adjacent opponent.', 3],
        ['Cross', 'Send the ball into the box from a wing.', 2],
        ['Save', 'Cancel an opponent’s shot.', 4]
      ]
}

// nome, ruolo, valore, squadra (indice in teams, -1 svincolato)
export function players(lang) {
  return lang === 'it'
    ? [
        ['Bruno Rossi', 'Attaccante', 5, 0],
        ['Paolo Verdi', 'Centrocampista', 4, 1],
        ['Enzo Fabbri', 'Attaccante', 4, 2],
        ['Marco Neri', 'Difensore', 3, 0],
        ['Dario Gallo', 'Portiere', 4, 1],
        ['Sergio Conti', 'Difensore', 3, 2],
        ['Tito Ferri', 'Centrocampista', 2, -1]
      ]
    : [
        ['Ben Ross', 'Forward', 5, 0],
        ['Paul Green', 'Midfielder', 4, 1],
        ['Eddie Fisher', 'Forward', 4, 2],
        ['Mark Black', 'Defender', 3, 0],
        ['Dan Rooster', 'Goalkeeper', 4, 1],
        ['Sam Count', 'Defender', 3, 2],
        ['Tim Smith', 'Midfielder', 2, -1]
      ]
}

const ink = '#22262B'
const neutral = '#5F6670'

function header(C, N) {
  return [
    {
      type: 'text',
      name: C.team,
      ...box(5, 3.5, 40, 11),
      text: N.free,
      weight: 800,
      size: 12,
      color: '#FFFFFF',
      align: 'left',
      valign: 'middle',
      smallCaps: true,
      ...fixed
    },
    {
      type: 'image',
      name: C.crest,
      ...box(45, 2, 14, 14),
      src: N.ball,
      fit: 'contain',
      tint: '#FFFFFF',
      ...fixed
    }
  ]
}

function footer(C) {
  return [
    {
      type: 'shape',
      name: C.band,
      ...box(-3, -3, 69, 21),
      fill: neutral,
      ...fixed
    },
    {
      type: 'shape',
      name: C.bg,
      ...box(-3, -3, 69, 94),
      fill: '#F4F3EE',
      locked: true,
      ...fixed
    }
  ]
}

const card = { width: 63, height: 88, bleed: 3, safeMargin: 3, cornerRadius: 3, back: [] }

export async function make(dest, lang) {
  const it = lang === 'it'
  const L = (a, b) => (it ? a : b)
  const N = names(lang)
  const { C } = N
  rmSync(dest, { recursive: true, force: true })
  for (const d of ['data', 'templates', `assets/${N.crests}`])
    mkdirSync(join(dest, d), { recursive: true })

  const catalog = JSON.parse(readFileSync(join(REPO, 'resources/catalogs/game-icons.json'), 'utf8'))
  const paths = new Map(catalog.icons.map((i) => [i[0], i[1]]))
  const sources = {}
  const crestSet = new Set(N.teams.map((t) => t.crest))
  for (const [name, id] of Object.entries(ICONS(it))) {
    const d = paths.get(id)
    if (!d) throw new Error('icona mancante: ' + id)
    const rel = crestSet.has(name) ? `${N.crests}/${name}.svg` : `${name}.svg`
    writeFileSync(
      join(dest, 'assets', rel),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="${d}"/></svg>`
    )
    const author = catalog.authors[id.split('/')[0]]
    sources[rel] = {
      kind: 'icon',
      source: 'game-icons.net',
      id,
      title: id.split('/')[1],
      author: author.name,
      license: author.license,
      url: `https://game-icons.net/1x1/${id}.html`,
      imported: '2026-11-19'
    }
  }
  writeFileSync(join(dest, 'assets/sources.json'), JSON.stringify(sources, null, 2))

  const action = {
    name: N.tAction,
    ...card,
    front: [
      ...header(C, N),
      {
        type: 'text',
        name: C.name,
        ...box(5, 23, 53, 12),
        text: L('Azione', 'Action'),
        weight: 800,
        size: 17,
        color: ink,
        align: 'center',
        valign: 'middle',
        fit: 'shrink'
      },
      {
        type: 'text',
        name: C.text,
        ...box(7, 38, 49, 26),
        text: L('Testo dell’azione.', 'Action text.'),
        size: 10.5,
        color: ink,
        align: 'center',
        valign: 'middle',
        fit: 'shrink'
      },
      {
        type: 'text',
        name: C.power,
        ...box(24, 68, 15, 15),
        text: '1',
        weight: 800,
        size: 20,
        color: ink,
        align: 'center',
        valign: 'middle'
      },
      {
        type: 'shape',
        name: C.circle,
        ...box(24, 68, 15, 15),
        radius: 7.5,
        fill: '#E1DFD6',
        ...fixed
      },
      ...footer(C)
    ]
  }
  const player = {
    name: N.tPlayer,
    ...card,
    front: [
      ...header(C, N),
      {
        type: 'image',
        name: C.portrait,
        ...box(16.5, 21, 30, 30),
        src: L('calciatore', 'kicker'),
        fit: 'contain',
        tint: '#3A3F45',
        ...fixed
      },
      {
        type: 'text',
        name: C.name,
        ...box(5, 53, 53, 10),
        text: L('Nome', 'Name'),
        weight: 800,
        size: 15,
        color: ink,
        align: 'center',
        valign: 'middle',
        fit: 'shrink'
      },
      {
        type: 'text',
        name: C.role,
        ...box(5, 62, 53, 7),
        text: L('Ruolo', 'Role'),
        weight: 600,
        size: 10,
        color: '#5A5F66',
        align: 'center',
        valign: 'middle',
        smallCaps: true
      },
      {
        type: 'text',
        name: C.value,
        ...box(24, 70, 15, 15),
        text: '1',
        weight: 800,
        size: 20,
        color: ink,
        align: 'center',
        valign: 'middle'
      },
      {
        type: 'shape',
        name: C.circle,
        ...box(24, 70, 15, 15),
        radius: 7.5,
        fill: '#E1DFD6',
        ...fixed
      },
      ...footer(C)
    ]
  }
  for (const t of [action, player])
    writeFileSync(join(dest, 'templates', t.name + '.json'), JSON.stringify(t, null, 2) + '\n')

  const dataFile = L('data/carte.xlsx', 'data/cards.xlsx')
  const wb = new ExcelJS.Workbook()
  const a = wb.addWorksheet(N.actions)
  a.addRow([C.name, C.text, C.power])
  for (const row of actions(lang)) a.addRow(row)
  a.getColumn(1).width = 16
  a.getColumn(2).width = 48
  const m = wb.addWorksheet(N.market)
  m.addRow([C.name, C.role, C.value])
  for (const [n, r, v] of players(lang)) m.addRow([n, r, v])
  m.getColumn(1).width = 18
  m.getColumn(2).width = 18
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
          { name: N.market, template: N.tPlayer }
        ]
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
