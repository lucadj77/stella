// Crea il progetto dimostrativo del video 33 (approfondimento «Gestisci il progetto e le immagini»):
// «Cripta». Un progetto un po' disordinato: quasi tutte le immagini sono sciolte in assets, alcune
// non sono usate da niente, le icone importate stanno in icons/ e due sfondi in sfondi/. Ci sono
// eroi e mostri (con la variante «mostro capo»), un segnalino ferita, tre variabili icona più una
// non usata, uno stile per i danni più uno non usato e un breve regolamento.
// Fuori dal progetto, «sul computer», prepara anche le immagini nuove da portare dentro durante il
// video (cinque mostri) e il pacchetto di un altro progetto (le trappole) da trascinare sulla finestra.
// Uso: node progetto-cripta.mjs <cartella di destinazione> <it|en>
//      oppure da un altro script: make(cartella, lingua) e computer(cartella, lingua)
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const REPO = new URL('../..', import.meta.url).pathname
const require = createRequire(join(REPO, 'package.json'))
const ExcelJS = require('exceljs')
const JSZip = require('jszip')

const box = (x, y, w, h) => ({ x, y, w, h })
const fixed = { source: { kind: 'fixed' } }

export function names(lang) {
  const it = lang === 'it'
  const L = (a, b) => (it ? a : b)
  return {
    project: L('Cripta', 'Crypt'),
    folder: L('Cripta', 'Crypt'),
    heroes: L('Eroi', 'Heroes'),
    monsters: L('Mostri', 'Monsters'),
    wounds: L('Ferite', 'Wounds'),
    tHero: L('eroe', 'hero'),
    tMonster: L('mostro', 'monster'),
    tBoss: L('mostro capo', 'boss monster'),
    tWound: L('ferita', 'wound'),
    tTrap: L('trappola', 'trap'),
    doc: L('regolamento', 'rulebook'),
    style: L('danno', 'damage'),
    oldStyle: L('vecchio', 'old'),
    backgrounds: L('sfondi', 'backgrounds'),
    traps: L('trappole', 'traps'),
    // sul computer: dove stanno le immagini nuove e il pacchetto
    pictures: L('Immagini', 'Pictures'),
    downloads: L('Scaricati', 'Downloads'),
    // immagini sciolte in assets
    I: {
      frameHero: L('cornice-eroe', 'hero-frame'),
      frameMonster: L('cornice-mostro', 'monster-frame'),
      frameBoss: L('cornice-capo', 'boss-frame'),
      parchment: L('pergamena', 'parchment'),
      drop: L('goccia', 'drop'),
      draft: L('bozza-eroe', 'hero-draft'),
      oldFrame: L('cornice-vecchia', 'old-frame'),
      logo: L('logo-prova', 'test-logo'),
      stone: L('pietra', 'stone'),
      fog: L('nebbia', 'fog')
    },
    // variabili icona (in icons/), l'ultima non usata
    V: {
      sword: L('spada', 'sword'),
      shield: L('scudo', 'shield'),
      heart: L('cuore', 'heart'),
      torch: L('torcia', 'torch')
    },
    C: {
      name: L('nome', 'name'),
      portrait: L('ritratto', 'portrait'),
      attack: L('attacco', 'attack'),
      defense: L('difesa', 'defense'),
      life: L('vita', 'life'),
      text: L('testo', 'text'),
      stats: L('valori', 'stats'),
      frame: L('cornice', 'frame'),
      bg: L('sfondo', 'background'),
      icon: L('icona', 'icon')
    }
  }
}

// ritratti: nome del file → icona di game-icons.net e colore del tondo
const HEROES = (it) => [
  [it ? 'guerriera' : 'warrior', 'delapouite/woman-elf-face', '#9DB8D9'],
  [it ? 'mago' : 'wizard', 'delapouite/wizard-face', '#B9A6D6'],
  [it ? 'ladra' : 'thief', 'darkzaitzev/hooded-figure', '#A9C9A4'],
  [it ? 'nano' : 'dwarf', 'delapouite/dwarf-face', '#D9B48F']
]
const MONSTERS = (it) => [
  ['goblin', 'delapouite/goblin-head', '#A8C47A'],
  [it ? 'orco' : 'orc', 'delapouite/orc-head', '#8FAE7C'],
  [it ? 'scheletro' : 'skeleton', 'skoll/skeleton', '#C9C2B4'],
  [it ? 'drago' : 'dragon', 'lorc/dragon-head', '#D98F7A']
]
// le immagini nuove, sul computer
export const NEW_MONSTERS = (it) => [
  [it ? 'ragno' : 'spider', 'carl-olsen/spider-face', '#B7A0C9'],
  [it ? 'fantasma' : 'ghost', 'lorc/ghost', '#BFD3DE'],
  [it ? 'pipistrello' : 'bat', 'delapouite/bat', '#C7B29A'],
  [it ? 'mummia' : 'mummy', 'delapouite/mummy-head', '#D9CFA8'],
  [it ? 'melma' : 'slime', 'delapouite/slime', '#9CC9A0']
]
const ICONS = (it) => [
  [it ? 'spada' : 'sword', 'lorc/broadsword'],
  [it ? 'scudo' : 'shield', 'sbed/shield'],
  [it ? 'cuore' : 'heart', 'skoll/hearts'],
  [it ? 'torcia' : 'torch', 'delapouite/torch']
]

let catalog
function icon(id) {
  catalog ??= JSON.parse(readFileSync(join(REPO, 'resources/catalogs/game-icons.json'), 'utf8'))
  const i = catalog.icons.find((x) => x[0] === id)
  if (!i) throw new Error('icona mancante: ' + id)
  return i[1]
}
const plain = (id) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="${icon(id)}"/></svg>`
const portrait = (id, color) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
<circle cx="256" cy="256" r="250" fill="${color}"/>
<g transform="translate(76 76) scale(0.703)"><path d="${icon(id)}" fill="#2B2420"/></g>
</svg>`

function frameSvg(c1, c2) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 630 880" width="630" height="880">
<rect x="20" y="20" width="590" height="840" rx="34" fill="none" stroke="${c1}" stroke-width="36"/>
<rect x="52" y="52" width="526" height="776" rx="14" fill="none" stroke="${c2}" stroke-width="6"/>
<rect x="52" y="168" width="526" height="6" fill="${c2}"/>
</svg>`
}
const parchment = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 630 880" width="630" height="880">
<rect width="630" height="880" fill="#F1E6CF"/>
<g fill="#C9B48A" fill-opacity="0.18">${Array.from({ length: 40 }, (_, i) => {
    const x = (i * 157) % 630
    const y = (i * 263) % 880
    return `<circle cx="${x}" cy="${y}" r="${18 + ((i * 7) % 30)}"/>`
  }).join('')}</g>
</svg>`
const stone = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 630 880" width="630" height="880">
<rect width="630" height="880" fill="#D9D4CB"/>
<g fill="none" stroke="#A8A196" stroke-width="5">${Array.from({ length: 11 }, (_, r) =>
    Array.from({ length: 5 }, (_, c) => {
      const w = 150
      const x = c * w - (r % 2) * 75
      return `<rect x="${x}" y="${r * 80}" width="${w}" height="80" rx="6"/>`
    }).join('')
  ).join('')}</g>
</svg>`
const fog = () =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 630 880" width="630" height="880">
<rect width="630" height="880" fill="#E3E7EA"/>
<g fill="#FFFFFF" fill-opacity="0.6"><ellipse cx="160" cy="220" rx="190" ry="60"/><ellipse cx="470" cy="470" rx="210" ry="70"/><ellipse cx="240" cy="720" rx="230" ry="65"/></g>
</svg>`
const logo = (text) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240" width="600" height="240">
<rect x="10" y="10" width="580" height="220" rx="30" fill="#3A2E3F"/>
<text x="300" y="150" font-family="serif" font-size="96" font-weight="700" fill="#E9D8A6" text-anchor="middle">${text}</text>
</svg>`

const sourceOf = (id, date) => {
  catalog ??= JSON.parse(readFileSync(join(REPO, 'resources/catalogs/game-icons.json'), 'utf8'))
  const author = catalog.authors[id.split('/')[0]]
  return {
    kind: 'icon',
    source: 'game-icons.net',
    id,
    title: id.split('/')[1],
    author: author.name,
    license: author.license,
    url: `https://game-icons.net/1x1/${id}.html`,
    imported: date
  }
}

export async function make(dest, lang) {
  const it = lang === 'it'
  const L = (a, b) => (it ? a : b)
  const N = names(lang)
  const { C, I, V } = N
  rmSync(dest, { recursive: true, force: true })
  for (const d of ['data', 'templates', 'docs', 'assets/icons', `assets/${N.backgrounds}`])
    mkdirSync(join(dest, d), { recursive: true })
  const A = (p, s) => writeFileSync(join(dest, 'assets', p), s)

  for (const [n, id, c] of [...HEROES(it), ...MONSTERS(it)]) A(n + '.svg', portrait(id, c))
  A(I.frameHero + '.svg', frameSvg('#3E5C80', '#22344A'))
  A(I.frameMonster + '.svg', frameSvg('#7A2E2E', '#4A1818'))
  A(I.frameBoss + '.svg', frameSvg('#2B2420', '#C9A227'))
  A(I.oldFrame + '.svg', frameSvg('#9A9A9A', '#5A5A5A'))
  A(I.parchment + '.svg', parchment())
  A(I.drop + '.svg', plain('lorc/drop'))
  A(I.draft + '.svg', portrait('delapouite/woman-elf-face', '#DDDDDD'))
  A(I.logo + '.svg', logo(N.project))
  A(`${N.backgrounds}/${I.stone}.svg`, stone())
  A(`${N.backgrounds}/${I.fog}.svg`, fog())
  const sources = {}
  for (const [n, id] of ICONS(it)) {
    A(`icons/${n}.svg`, plain(id))
    sources[`icons/${n}.svg`] = sourceOf(id, '2026-11-12')
  }
  A('sources.json', JSON.stringify(sources, null, 2))

  const ink = '#2B2420'
  const card = (name, frame, textCol, stats, statsText) => ({
    name,
    width: 63,
    height: 88,
    bleed: 3,
    safeMargin: 3,
    cornerRadius: 3,
    front: [
      {
        type: 'text',
        name: C.name,
        ...box(6, 4.5, 51, 9),
        text: L('Nome', 'Name'),
        weight: 800,
        size: 13,
        color: ink,
        align: 'center',
        valign: 'middle',
        fit: 'shrink'
      },
      {
        type: 'text',
        name: C.stats,
        ...box(6, 52, 51, 8),
        text: statsText,
        weight: 800,
        size: 12,
        color: ink,
        align: 'center',
        valign: 'middle',
        ...fixed
      },
      {
        type: 'text',
        name: C.text,
        ...box(7, 61, 49, 20),
        text: textCol,
        size: 9,
        color: ink,
        align: 'center',
        valign: 'middle'
      },
      ...stats.map(([n, v]) => ({ type: 'value', name: n, value: v, ...box(0, 0, 10, 10) })),
      {
        type: 'image',
        name: C.portrait,
        ...box(14.5, 17, 34, 34),
        src: '',
        fit: 'contain'
      },
      {
        type: 'image',
        name: C.frame,
        ...box(0, 0, 63, 88),
        src: frame,
        fit: 'stretch',
        ...fixed
      },
      {
        type: 'image',
        name: C.bg,
        ...box(-3, -3, 69, 94),
        src: I.parchment,
        fit: 'stretch',
        locked: true,
        ...fixed
      }
    ],
    back: []
  })
  const hero = card(
    N.tHero,
    I.frameHero,
    L('Abilità', 'Ability'),
    [
      [C.attack, '2'],
      [C.defense, '2']
    ],
    `{${V.sword}} {${C.attack}}    {${V.shield}} {${C.defense}}`
  )
  hero.front[0].text = L('Eroe', 'Hero')
  const monster = card(
    N.tMonster,
    I.frameMonster,
    L('Effetto', 'Effect'),
    [
      [C.attack, '1'],
      [C.life, '2']
    ],
    `{${V.sword}} {${C.attack}}    {${V.heart}} {${C.life}}`
  )
  monster.front[0].text = L('Mostro', 'Monster')
  const boss = {
    name: N.tBoss,
    extends: N.tMonster,
    variant: true,
    variantOrder: 1,
    changes: {
      layers: {
        [C.frame]: { src: I.frameBoss },
        [C.bg]: { src: `${N.backgrounds}/${I.stone}` }
      }
    }
  }
  const wound = {
    name: N.tWound,
    kind: 'token',
    width: 25,
    height: 25,
    shape: 'ellipse',
    bleed: 2,
    safeMargin: 2,
    cornerRadius: 0,
    front: [
      {
        type: 'image',
        name: C.icon,
        ...box(5, 5, 15, 15),
        src: I.drop,
        fit: 'contain',
        tint: '#A3342A',
        ...fixed
      },
      {
        type: 'shape',
        name: C.bg,
        ...box(-2, -2, 29, 29),
        shape: 'ellipse',
        fill: '#F1E6CF',
        ...fixed
      }
    ],
    back: []
  }
  for (const t of [hero, monster, boss, wound])
    writeFileSync(join(dest, 'templates', t.name + '.json'), JSON.stringify(t, null, 2) + '\n')

  const dmg = (s) => `[${s}]{.${N.style}}`
  const dataFile = L('data/carte.xlsx', 'data/cards.xlsx')
  const wb = new ExcelJS.Workbook()
  const h = wb.addWorksheet(N.heroes)
  h.addRow([C.name, C.portrait, C.attack, C.defense, C.text])
  const H = HEROES(it).map((x) => x[0])
  for (const row of it
    ? [
        ['Elwen', H[0], 3, 2, 'Una volta per turno attacca due volte.'],
        ['Mirro', H[1], 1, 1, 'Scarta una carta: infliggi 2 danni a un mostro.'],
        ['Sera', H[2], 2, 1, 'Puoi evitare una trappola.'],
        ['Borin', H[3], 2, 3, 'Gli eroi accanto a te hanno +1 difesa.']
      ]
    : [
        ['Elwen', H[0], 3, 2, 'Once per turn, attack twice.'],
        ['Mirro', H[1], 1, 1, 'Discard a card: deal 2 damage to a monster.'],
        ['Sera', H[2], 2, 1, 'You may avoid a trap.'],
        ['Borin', H[3], 2, 3, 'Heroes next to you get +1 defense.']
      ])
    h.addRow(row)
  const m = wb.addWorksheet(N.monsters)
  m.addRow([C.name, 'template', C.portrait, C.attack, C.life, C.text])
  const M = MONSTERS(it).map((x) => x[0])
  for (const row of it
    ? [
        ['Goblin', '', M[0], 1, 2, `Ruba una moneta.`],
        ['Orco', '', M[1], 3, 4, `${dmg('Colpo pesante')}: 2 ferite.`],
        ['Scheletro', '', M[2], 2, 2, `Torna in gioco con un 6.`],
        ['Drago', N.tBoss, M[3], 5, 8, `${dmg('Fiammata')}: 1 ferita a ogni eroe.`]
      ]
    : [
        ['Goblin', '', M[0], 1, 2, `Steals a coin.`],
        ['Orc', '', M[1], 3, 4, `${dmg('Heavy blow')}: 2 wounds.`],
        ['Skeleton', '', M[2], 2, 2, `Comes back on a 6.`],
        ['Dragon', N.tBoss, M[3], 5, 8, `${dmg('Fire breath')}: 1 wound to each hero.`]
      ])
    m.addRow(row)
  const w = wb.addWorksheet(N.wounds)
  w.addRow([C.name])
  w.addRow([L('ferita', 'wound')])
  for (const s of [h, m, w]) {
    s.getColumn(1).width = 14
    s.getColumn(s === m ? 6 : 5).width = 46
  }
  await wb.xlsx.writeFile(join(dest, dataFile))

  writeFileSync(
    join(dest, 'docs', N.doc + '.md'),
    it
      ? `# ${N.project}

Gli eroi scendono nella cripta e affrontano i mostri.

## Combattere

Un eroe tira tanti dadi quanto il suo attacco {${V.sword}}. Ogni 5 o 6 toglie un {${V.heart}} al mostro. Il mostro risponde con il suo attacco, e ogni colpo che supera la difesa {${V.shield}} dell'eroe è una ferita.
`
      : `# ${N.project}

The heroes go down into the crypt and fight the monsters.

## Fighting

A hero rolls as many dice as their attack {${V.sword}}. Each 5 or 6 removes one {${V.heart}} from the monster. The monster strikes back with its attack, and each hit above the hero's defense {${V.shield}} is a wound.
`
  )

  const iconVar = (n, tint) => ({ type: 'image', src: `icons/${n}`, tint })
  writeFileSync(
    join(dest, 'stella.json'),
    JSON.stringify(
      {
        formatVersion: 1,
        name: N.project,
        dataFile,
        sets: [
          { name: N.heroes, template: N.tHero },
          { name: N.monsters, template: N.tMonster },
          { name: N.wounds, template: N.tWound }
        ],
        styles: {
          [N.style]: 'weight=800 color=#A3342A',
          [N.oldStyle]: 'italic color=#777777'
        },
        variables: {
          [V.sword]: iconVar(V.sword, '#5E6670'),
          [V.shield]: iconVar(V.shield, '#3E5C80'),
          [V.heart]: iconVar(V.heart, '#A3342A'),
          [V.torch]: iconVar(V.torch, '#B8892B')
        }
      },
      null,
      2
    ) + '\n'
  )
  return dest
}

/**
 * «Il computer»: le immagini nuove in <home>/<Immagini>/<progetto> e il pacchetto delle trappole
 * (fatto da un altro progetto) in <home>/<Scaricati>; restituisce i percorsi
 */
export async function computer(home, lang) {
  const it = lang === 'it'
  const N = names(lang)
  const pics = join(home, N.pictures, N.project)
  rmSync(pics, { recursive: true, force: true })
  mkdirSync(pics, { recursive: true })
  const images = NEW_MONSTERS(it).map(([n, id, c]) => {
    const p = join(pics, n + '.svg')
    writeFileSync(p, portrait(id, c))
    return p
  })
  const down = join(home, N.downloads)
  mkdirSync(down, { recursive: true })
  const spikes = it ? 'spuntoni' : 'spikes'
  const caltrops = it ? 'chiodi' : 'caltrops'
  const trap = {
    name: N.tTrap,
    kind: 'tile',
    width: 40,
    height: 40,
    bleed: 2,
    safeMargin: 2,
    cornerRadius: 2,
    front: [
      {
        type: 'text',
        name: names(lang).C.name,
        ...box(3, 31, 34, 6),
        text: it ? 'Trappola' : 'Trap',
        weight: 800,
        size: 11,
        color: '#2B2420',
        align: 'center',
        valign: 'middle'
      },
      {
        type: 'image',
        name: names(lang).C.icon,
        ...box(8, 5, 24, 24),
        src: `${N.traps}/${spikes}`,
        fit: 'contain',
        tint: '#4A3B30',
        source: {
          kind: 'column',
          column: null,
          options: [`${N.traps}/${spikes}`, `${N.traps}/${caltrops}`]
        }
      },
      {
        type: 'shape',
        name: names(lang).C.bg,
        ...box(-2, -2, 44, 44),
        fill: '#D9D4CB',
        ...fixed
      }
    ],
    back: []
  }
  const assets = [`${N.traps}/${spikes}.svg`, `${N.traps}/${caltrops}.svg`]
  const sources = {
    [assets[0]]: sourceOf('sbed/spikes', '2026-11-15'),
    [assets[1]]: sourceOf('delapouite/caltrops', '2026-11-15')
  }
  const manifest = {
    format: 1,
    kind: 'template',
    name: N.tTrap,
    templates: [trap],
    sets: [],
    variables: {},
    styles: {},
    assets,
    sources
  }
  const zip = new JSZip()
  zip.file('stella-package.json', JSON.stringify(manifest, null, 2) + '\n')
  zip.file(`assets/${assets[0]}`, plain('sbed/spikes'))
  zip.file(`assets/${assets[1]}`, plain('delapouite/caltrops'))
  const pkg = join(down, `${N.tTrap}.stella.zip`)
  writeFileSync(pkg, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
  return { images, pkg }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const [dest, lang = 'it'] = process.argv.slice(2)
  await make(dest, lang)
  console.log(await computer(join(dest, '..', 'computer'), lang))
}
