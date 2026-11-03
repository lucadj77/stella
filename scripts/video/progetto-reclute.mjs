// Aggiunge al progetto «Schermaglia» (progetto-statistiche.mjs) quello che serve al video 29
// (approfondimento «generare i componenti»): il template «recluta» con il set vuoto «Reclute», tre
// risorse con la loro icona (oro, legno, ferro) e 12 ritratti in assets/images/ritratti per
// «Da una cartella…».
// Sulla carta: fazione, costo e risorse vengono dalle colonne; il nome è una formula con
// {card.number}; la ricompensa è un livello Valore (colonna) e lo scambio un Valore calcolato che
// prende la risorsa dopo, con PICK({card.number}+1; …): una sequenza sfalsata di un posto.
// Uso: node progetto-reclute.mjs <cartella di destinazione> <it|en>
//      oppure da un altro script: await extend(cartella, lingua) dopo make()
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { make, names as baseNames } from './progetto-statistiche.mjs'
const REPO = new URL('../..', import.meta.url).pathname
const ExcelJS = createRequire(join(REPO, 'package.json'))('exceljs')

const box = (x, y, w, h) => ({ x, y, w, h })
const fixed = { source: { kind: 'fixed' } }

// figure da game-icons.net per i ritratti: quattro per fazione, tutte sullo stesso fondo
const FACES = [
  'delapouite/black-knight-helm',
  'delapouite/archer',
  'delapouite/monk-face',
  'delapouite/centurion-helmet',
  'delapouite/viking-head',
  'delapouite/barbarian',
  'delapouite/dwarf-face',
  'kier-heyl/dwarf-king',
  'darkzaitzev/hooded-assassin',
  'delapouite/warlock-hood',
  'cathelineau/witch-face',
  'darkzaitzev/ninja-head'
]

export function names(lang) {
  const it = lang === 'it'
  const L = (a, b) => (it ? a : b)
  return {
    ...baseNames(lang),
    recruits: L('Reclute', 'Recruits'),
    tRecruit: L('recluta', 'recruit'),
    R: {
      resources: L('risorse', 'resources'),
      reward: L('ricompensa', 'reward'),
      trade: L('scambio', 'trade'),
      barter: L('baratto', 'barter'),
      portrait: L('ritratto', 'portrait')
    },
    G: { gold: L('oro', 'gold'), wood: L('legno', 'wood'), iron: L('ferro', 'iron') },
    folder: L('images/ritratti', 'images/portraits')
  }
}

function catalog() {
  const c = JSON.parse(readFileSync(join(REPO, 'resources/catalogs/game-icons.json'), 'utf8'))
  return { c, paths: new Map(c.icons.map((i) => [i[0], i[1]])) }
}

function source(c, id) {
  const author = c.authors[id.split('/')[0]]
  return {
    kind: 'icon',
    source: 'game-icons.net',
    id,
    title: id.split('/')[1],
    author: author.name,
    license: author.license,
    url: `https://game-icons.net/1x1/${id}.html`,
    imported: '2026-11-03'
  }
}

export async function extend(dest, lang) {
  const it = lang === 'it'
  const L = (a, b) => (it ? a : b)
  const N = names(lang)
  const { C, F, R, G } = N
  const { c, paths } = catalog()
  const sources = JSON.parse(readFileSync(join(dest, 'assets/sources.json'), 'utf8'))

  // le icone delle risorse
  const res = {
    [G.gold]: 'delapouite/two-coins',
    [G.wood]: 'delapouite/wood-pile',
    [G.iron]: 'lorc/metal-bar'
  }
  for (const [name, id] of Object.entries(res)) {
    writeFileSync(
      join(dest, 'assets/icons', name + '.svg'),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="${paths.get(id)}"/></svg>`
    )
    sources[`icons/${name}.svg`] = source(c, id)
  }
  // i ritratti
  const dir = join(dest, 'assets', N.folder)
  mkdirSync(dir, { recursive: true })
  const base = L('ritratto', 'portrait')
  FACES.forEach((id, i) => {
    const d = paths.get(id)
    if (!d) throw new Error('icona mancante: ' + id)
    const file = `${base}-${String(i + 1).padStart(2, '0')}.svg`
    writeFileSync(
      join(dir, file),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
        `<rect width="512" height="512" rx="36" fill="#4A4038"/>` +
        `<circle cx="256" cy="256" r="214" fill="#F6EEDD" opacity="0.12"/>` +
        `<g transform="translate(66 66) scale(0.742)" fill="#F6EEDD"><path d="${d}"/></g></svg>\n`
    )
    sources[`${N.folder}/${file}`] = source(c, id)
  })
  writeFileSync(join(dest, 'assets/sources.json'), JSON.stringify(sources, null, 2))

  const bandFill = `=IF({${C.faction}}="${F.kingdom}";"#3D5A8C";IF({${C.faction}}="${F.clan}";"#9A4A2C";"#5B3F7A"))`
  const icons = [G.gold, G.wood, G.iron].map((g) => `"{${g}}"`).join('; ')
  const recruit = {
    name: N.tRecruit,
    width: 63,
    height: 88,
    bleed: 3,
    safeMargin: 3,
    cornerRadius: 3,
    front: [
      { type: 'value', name: R.reward, ...box(0, 0, 10, 10) },
      {
        type: 'value',
        name: R.trade,
        ...box(0, 0, 10, 10),
        source: { kind: 'formula', expr: `=PICK({card.number}+1; ${icons})` }
      },
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
        text: '',
        weight: 800,
        size: 12,
        color: '#FFFFFF',
        valign: 'middle',
        fit: 'shrink',
        source: { kind: 'formula', expr: `="${L('Recluta', 'Recruit')} " & {card.number}` }
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
        type: 'image',
        name: R.portrait,
        ...box(11.5, 21, 40, 40),
        src: '',
        fit: 'contain'
      },
      {
        type: 'text',
        name: R.resources,
        ...box(6, 66, 24, 14),
        text: '',
        size: 15,
        valign: 'middle'
      },
      {
        type: 'text',
        name: R.barter,
        ...box(32, 66, 25, 14),
        text: '',
        size: 13,
        align: 'right',
        valign: 'middle',
        color: '#2A241C',
        source: {
          kind: 'formula',
          expr: `=IF({${R.reward}}=""; ""; {${R.reward}} & " → " & {${R.trade}})`
        }
      },
      {
        type: 'shape',
        name: L('fondo_ritratto', 'portrait_frame'),
        ...box(10.5, 20, 42, 42),
        radius: 2,
        fill: '#E7DCC4',
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
  writeFileSync(
    join(dest, 'templates', recruit.name + '.json'),
    JSON.stringify(recruit, null, 2) + '\n'
  )

  // il set vuoto: un foglio con le sole intestazioni
  const p = JSON.parse(readFileSync(join(dest, 'stella.json'), 'utf8'))
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(join(dest, p.dataFile))
  const s = wb.addWorksheet(N.recruits)
  s.addRow(['amount', C.faction, C.cost, R.resources, R.portrait, R.reward])
  await wb.xlsx.writeFile(join(dest, p.dataFile))
  p.sets.push({ name: N.recruits, template: N.tRecruit })
  const tints = { [G.gold]: '#C08A12', [G.wood]: '#7A4E26', [G.iron]: '#5E6E80' }
  for (const g of [G.gold, G.wood, G.iron])
    p.variables[g] = { type: 'image', src: g, tint: tints[g] }
  writeFileSync(join(dest, 'stella.json'), JSON.stringify(p, null, 2) + '\n')
  return N
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const [dest, lang = 'it'] = process.argv.slice(2)
  await make(dest, lang)
  await extend(dest, lang)
}
