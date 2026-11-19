// Crea il progetto dimostrativo del video 31 (approfondimento «elenchi e varianti»): «Torneo».
// Sei cavalieri, tutti con la stessa cornice d'oro e la stessa banda rossa: il video trasforma la
// cornice, la banda, il rango e lo stemma in livelli con la fonte Elenco, poi crea le varianti del
// template. Nella cartella assets ci sono già quattro cornici (cornici/), dodici stemmi (stemmi/) e
// due motivi di sfondo (motivi/). Il rango è un livello Valore mostrato da un testo fisso {rango};
// un cavaliere ha un rango che non sarà tra le voci, per mostrare l'avviso.
// Uso: node progetto-torneo.mjs <cartella di destinazione> <it|en>
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
    project: L('Torneo', 'Tournament'),
    folder: L('Torneo', 'Tournament'),
    knights: L('Cavalieri', 'Knights'),
    tKnight: L('cavaliere', 'knight'),
    frames: L('cornici', 'frames'),
    crests: L('stemmi', 'crests'),
    patterns: L('motivi', 'patterns'),
    // cornici, dalla prima (quella del template)
    F: L(['oro', 'argento', 'bronzo', 'ferro'], ['gold', 'silver', 'bronze', 'iron']),
    // ranghi delle voci; il quarto non ci sarà
    R: L(
      ['Scudiero', 'Cavaliere', 'Campione', 'Barone'],
      ['Squire', 'Knight', 'Champion', 'Baron']
    ),
    // motivi per le varianti
    P: L(['stelle', 'raggi'], ['stars', 'rays']),
    // varianti create dal video
    V: L(['cavaliere argento', 'cavaliere porpora'], ['knight silver', 'knight purple']),
    C: {
      name: L('nome', 'name'),
      rank: L('rango', 'rank'),
      rankText: L('rango_testo', 'rank_text'),
      crest: L('stemma', 'crest'),
      frame: L('cornice', 'frame'),
      band: L('banda', 'band'),
      pattern: L('motivo', 'pattern'),
      bg: L('sfondo', 'background')
    }
  }
}

/** stemmi: nome del file → icona di game-icons.net */
const CRESTS = (it) =>
  Object.fromEntries(
    [
      ['leone', 'lion', 'lorc/lion'],
      ['aquila', 'eagle', 'lorc/eagle-emblem'],
      ['drago', 'dragon', 'lorc/dragon-head'],
      ['lupo', 'wolf', 'lorc/wolf-head'],
      ['orso', 'bear', 'delapouite/bear-head'],
      ['cervo', 'stag', 'caro-asercion/deer-head'],
      ['cinghiale', 'boar', 'caro-asercion/boar'],
      ['cavallo', 'horse', 'lorc/horse-head'],
      ['gufo', 'owl', 'lorc/owl'],
      ['torre', 'tower', 'delapouite/tower-flag'],
      ['corona', 'crown', 'lorc/crown'],
      ['giglio', 'lily', 'delapouite/fleur-de-lys']
    ].map(([i, e, id]) => [it ? i : e, id])
  )

const FRAME_COLORS = [
  ['#C9A227', '#8A6D10'],
  ['#BFC4CC', '#7C808A'],
  ['#B5713A', '#6E3F1A'],
  ['#6B6F76', '#3C3F44']
]

function frameSvg([c1, c2]) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 630 880" width="630" height="880">
<rect x="22" y="22" width="586" height="836" rx="34" fill="none" stroke="${c1}" stroke-width="40"/>
<rect x="56" y="56" width="518" height="768" rx="14" fill="none" stroke="${c2}" stroke-width="8"/>
${[
  [42, 42],
  [588, 42],
  [42, 838],
  [588, 838]
]
  .map(
    ([x, y]) =>
      `<circle cx="${x}" cy="${y}" r="30" fill="${c1}" stroke="${c2}" stroke-width="7"/><circle cx="${x}" cy="${y}" r="10" fill="${c2}"/>`
  )
  .join('\n')}
</svg>`
}

function patternSvg(kind) {
  if (kind === 0) {
    // stelle sparse
    const stars = []
    for (let y = 0; y < 9; y++)
      for (let x = 0; x < 7; x++) {
        const cx = 45 + x * 90 + (y % 2) * 45
        const cy = 50 + y * 95
        const p = []
        for (let k = 0; k < 10; k++) {
          const a = (Math.PI / 5) * k - Math.PI / 2
          const rr = k % 2 ? 7 : 17
          p.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`)
        }
        stars.push(`<polygon points="${p.join(' ')}"/>`)
      }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 630 880" width="630" height="880"><g fill="#000" fill-opacity="0.10">${stars.join('')}</g></svg>`
  }
  // raggi dal centro
  const rays = []
  for (let k = 0; k < 24; k += 2) {
    const a0 = (Math.PI * 2 * k) / 24
    const a1 = (Math.PI * 2 * (k + 1)) / 24
    const R = 900
    rays.push(
      `<polygon points="315,440 ${(315 + R * Math.cos(a0)).toFixed(0)},${(440 + R * Math.sin(a0)).toFixed(0)} ${(315 + R * Math.cos(a1)).toFixed(0)},${(440 + R * Math.sin(a1)).toFixed(0)}"/>`
    )
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 630 880" width="630" height="880"><g fill="#000" fill-opacity="0.08">${rays.join('')}</g></svg>`
}

// nome, rango (indice in R), stemma
export function knights(lang) {
  return lang === 'it'
    ? [
        ['Ser Aldo', 1, 'leone'],
        ['Dama Bianca', 2, 'aquila'],
        ['Ser Guido', 0, 'lupo'],
        ['Dama Ilaria', 1, 'cervo'],
        ['Ser Ottone', 3, 'orso'],
        ['Ser Tancredi', 0, 'torre']
      ]
    : [
        ['Sir Aldo', 1, 'lion'],
        ['Lady Blanche', 2, 'eagle'],
        ['Sir Guy', 0, 'wolf'],
        ['Lady Ilaria', 1, 'stag'],
        ['Sir Otto', 3, 'bear'],
        ['Sir Tancred', 0, 'tower']
      ]
}

export async function make(dest, lang) {
  const it = lang === 'it'
  const L = (a, b) => (it ? a : b)
  const N = names(lang)
  const { C } = N
  rmSync(dest, { recursive: true, force: true })
  for (const d of [
    'data',
    'templates',
    `assets/${N.frames}`,
    `assets/${N.crests}`,
    `assets/${N.patterns}`
  ])
    mkdirSync(join(dest, d), { recursive: true })

  N.F.forEach((f, i) =>
    writeFileSync(join(dest, 'assets', N.frames, f + '.svg'), frameSvg(FRAME_COLORS[i]))
  )
  N.P.forEach((p, i) => writeFileSync(join(dest, 'assets', N.patterns, p + '.svg'), patternSvg(i)))
  const catalog = JSON.parse(readFileSync(join(REPO, 'resources/catalogs/game-icons.json'), 'utf8'))
  const paths = new Map(catalog.icons.map((i) => [i[0], i[1]]))
  const sources = {}
  for (const [name, id] of Object.entries(CRESTS(it))) {
    const d = paths.get(id)
    if (!d) throw new Error('icona mancante: ' + id)
    writeFileSync(
      join(dest, 'assets', N.crests, name + '.svg'),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="${d}"/></svg>`
    )
    const author = catalog.authors[id.split('/')[0]]
    sources[`${N.crests}/${name}.svg`] = {
      kind: 'icon',
      source: 'game-icons.net',
      id,
      title: id.split('/')[1],
      author: author.name,
      license: author.license,
      url: `https://game-icons.net/1x1/${id}.html`,
      imported: '2026-11-18'
    }
  }
  writeFileSync(join(dest, 'assets/sources.json'), JSON.stringify(sources, null, 2))

  const ink = '#2B2420'
  const crestNames = Object.keys(CRESTS(it))
  const knight = {
    name: N.tKnight,
    width: 63,
    height: 88,
    bleed: 3,
    safeMargin: 3,
    cornerRadius: 3,
    front: [
      {
        type: 'text',
        name: C.name,
        ...box(9, 8.5, 45, 10),
        text: L('Nome', 'Name'),
        weight: 800,
        size: 13,
        color: '#FFFFFF',
        align: 'center',
        valign: 'middle',
        fit: 'shrink'
      },
      {
        type: 'text',
        name: C.rankText,
        ...box(9, 70, 45, 8),
        text: `{${C.rank}}`,
        weight: 700,
        size: 11,
        color: ink,
        align: 'center',
        valign: 'middle',
        smallCaps: true,
        ...fixed
      },
      {
        type: 'image',
        name: C.crest,
        ...box(16.5, 27, 30, 36),
        src: crestNames[0],
        fit: 'contain',
        tint: '#4A3B30'
      },
      {
        type: 'value',
        name: C.rank,
        value: N.R[1],
        ...box(0, 0, 10, 10)
      },
      {
        type: 'image',
        name: C.frame,
        ...box(0, 0, 63, 88),
        src: N.F[0],
        fit: 'stretch',
        ...fixed
      },
      {
        type: 'shape',
        name: C.band,
        ...box(7, 7.5, 49, 12),
        radius: 1.5,
        fill: '#8B1E1E',
        ...fixed
      },
      {
        type: 'image',
        name: C.pattern,
        ...box(-3, -3, 69, 94),
        src: '',
        fit: 'stretch',
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
    back: []
  }
  writeFileSync(
    join(dest, 'templates', knight.name + '.json'),
    JSON.stringify(knight, null, 2) + '\n'
  )

  const dataFile = L('data/carte.xlsx', 'data/cards.xlsx')
  const wb = new ExcelJS.Workbook()
  const a = wb.addWorksheet(N.knights)
  a.addRow([C.name, C.rank, C.crest])
  for (const [n, r, s] of knights(lang)) a.addRow([n, N.R[r], s])
  a.getColumn(1).width = 18
  a.getColumn(3).width = 18
  await wb.xlsx.writeFile(join(dest, dataFile))

  writeFileSync(
    join(dest, 'stella.json'),
    JSON.stringify(
      {
        formatVersion: 1,
        name: N.project,
        dataFile,
        sets: [{ name: N.knights, template: N.tKnight }]
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
