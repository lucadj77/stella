// Crea il progetto dimostrativo del quinto approfondimento (video 27, immagini e forme): «Spedizione».
// Sei carte luogo con un'illustrazione grande, quattro segnalini risorsa e quattro tessere terreno
// esagonali. L'illustrazione della carta parte messa così com'è (Adatta dentro) e la trama della carta
// alla sua misura: il video le sistema con adattamenti, ritaglio, colorazione, regolazioni, forme,
// riempimenti e la sezione Aspetto. Le illustrazioni sono di illustrazioni-spedizione.py, in
// assets/spedizione. I dati del foglio che entrano nelle formule arrivano sempre da livelli Valore.
// Uso: node progetto-spedizione.mjs <cartella di destinazione> <it|en>
//      oppure da un altro script: make(cartella, lingua)
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync, rmSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'
import { writeIcons } from './progetto-testo.mjs'
const REPO = new URL('../..', import.meta.url).pathname
const ExcelJS = createRequire(join(REPO, 'package.json'))('exceljs')
const ART = new URL('./assets/spedizione/', import.meta.url).pathname

const box = (x, y, w, h) => ({ x, y, w, h })
const fixed = { source: { kind: 'fixed' } }
const formula = (expr) => ({ source: { kind: 'formula', expr } })
const column = (c) => ({ source: { kind: 'column', column: c } })
const value = (name, v = '') => ({ type: 'value', name, value: v, ...box(0, 0, 10, 10) })
const ink = '#2A241C'

export function names(lang) {
  const it = lang === 'it'
  const L = (a, b) => (it ? a : b)
  return {
    project: L('Spedizione', 'Expedition'),
    folder: L('Spedizione', 'Expedition'),
    places: L('Luoghi', 'Places'),
    resources: L('Risorse', 'Resources'),
    terrains: L('Terreni', 'Terrains'),
    tPlace: L('luogo', 'place'),
    tToken: L('risorsa', 'resource'),
    tTile: L('terreno', 'terrain'),
    // le immagini, nella cartella assets/images del progetto
    A: {
      forest: L('bosco', 'forest'),
      mountain: L('montagna', 'mountain'),
      lake: L('lago', 'lake'),
      desert: L('deserto', 'desert'),
      ruins: L('rovine', 'ruins'),
      paper: L('carta', 'paper')
    },
    I: {
      wood: L('legno', 'wood'),
      stone: L('pietra', 'stone'),
      food: L('cibo', 'food'),
      gold: L('oro', 'gold'),
      sun: L('sole', 'sun')
    },
    C: {
      name: L('nome', 'name'),
      resource: L('risorsa', 'resource'),
      text: L('testo', 'text'),
      color: L('colore', 'color'),
      art: L('illustrazione', 'illustration'),
      title: L('titolo', 'title'),
      icon: L('icona', 'icon'),
      description: L('descrizione', 'description'),
      footer: L('piede', 'footer'),
      texture: L('trama', 'texture'),
      bg: L('sfondo', 'background'),
      frame: L('cornice', 'frame'),
      border: L('bordo', 'border'),
      star: L('stella', 'star'),
      line: L('linea', 'line')
    }
  }
}

// nome, illustrazione, risorsa, testo
const PLACES = {
  it: [
    ['Bosco antico', 'forest', 'wood', 'Raccogli 2 legno. Con un’ascia, 3.'],
    ['Picco del Corvo', 'mountain', 'stone', 'Raccogli 2 pietra. La salita costa 1 cibo.'],
    ['Lago d’argento', 'lake', 'food', 'Raccogli 2 cibo e riparti subito.'],
    ['Dune rosse', 'desert', 'gold', 'Raccogli 1 oro. Senza acqua perdi 1 cibo.'],
    ['Rovine perdute', 'ruins', 'gold', 'Raccogli 2 oro, ma pesca una carta pericolo.'],
    ['Terra ignota', '', 'food', 'Nessuno l’ha ancora disegnata.']
  ],
  en: [
    ['Ancient forest', 'forest', 'wood', 'Gather 2 wood. With an axe, 3.'],
    ['Raven Peak', 'mountain', 'stone', 'Gather 2 stone. The climb costs 1 food.'],
    ['Silver lake', 'lake', 'food', 'Gather 2 food and leave at once.'],
    ['Red dunes', 'desert', 'gold', 'Gather 1 gold. Without water lose 1 food.'],
    ['Lost ruins', 'ruins', 'gold', 'Gather 2 gold, but draw a danger card.'],
    ['Unknown land', '', 'food', 'Nobody has drawn it yet.']
  ]
}
const FILES = {
  forest: 'bosco.jpg',
  mountain: 'montagna.jpg',
  lake: 'lago.jpg',
  desert: 'deserto.jpg',
  ruins: 'rovine.jpg',
  paper: 'carta.png'
}
const COLORS = { wood: '#7A5230', stone: '#66707A', food: '#5E7F34', gold: '#B8862B' }

export async function make(dest, lang) {
  const it = lang === 'it'
  const L = (a, b) => (it ? a : b)
  const N = names(lang)
  const { C, I, A } = N
  rmSync(dest, { recursive: true, force: true })
  for (const d of ['data', 'templates', 'assets/images']) mkdirSync(join(dest, d), { recursive: true })
  writeIcons(dest, {
    [I.wood]: 'delapouite/wood-pile',
    [I.stone]: 'delapouite/stone-pile',
    [I.food]: 'lorc/wheat',
    [I.gold]: 'delapouite/gold-nuggets',
    [I.sun]: 'lorc/sun'
  })
  for (const [k, f] of Object.entries(FILES))
    copyFileSync(join(ART, f), join(dest, 'assets/images', A[k] + f.slice(f.lastIndexOf('.'))))
  const paper = (b, fit, align = 'center') => ({
    type: 'image',
    name: C.texture,
    ...b,
    src: `images/${A.paper}`,
    fit,
    align,
    ...fixed
  })
  // il colore della risorsa, calcolato dal livello Valore risorsa
  const colorExpr =
    '=' +
    ['wood', 'stone', 'food']
      .map((k) => `IF({${C.resource}} = "${I[k]}"; "${COLORS[k]}"; `)
      .join('') +
    `"${COLORS.gold}"` +
    ')))'

  // la carta luogo: illustrazione ancora da inquadrare, trama alla sua misura
  const place = {
    name: N.tPlace,
    kind: 'card',
    width: 63,
    height: 88,
    bleed: 3,
    safeMargin: 3,
    cornerRadius: 3,
    labelField: C.name,
    front: [
      value(C.name, L('Luogo', 'Place')),
      value(C.resource, I.wood),
      value(C.text),
      {
        type: 'text',
        name: C.title,
        ...box(5, 5, 53, 9),
        text: `{${C.name}}`,
        weight: 800,
        size: 13,
        color: '#FFFFFF',
        align: 'center',
        valign: 'middle',
        fit: 'shrink',
        ...fixed
      },
      {
        type: 'image',
        name: C.icon,
        ...box(26, 46, 11, 11),
        src: '',
        fit: 'contain',
        ...formula(`{${C.resource}}`)
      },
      {
        type: 'text',
        name: C.description,
        ...box(6, 59, 51, 16),
        text: `{${C.text}}`,
        weight: 500,
        size: 8.5,
        color: ink,
        align: 'center',
        valign: 'middle',
        lineHeight: 1.25,
        ...fixed
      },
      {
        type: 'text',
        name: C.footer,
        ...box(6, 79, 51, 4),
        text: `${N.project} · {card.number}/{set.cards}`,
        weight: 600,
        size: 6,
        color: '#7A6A55',
        align: 'center',
        valign: 'middle',
        ...fixed
      },
      {
        type: 'image',
        name: C.art,
        ...box(-3, -3, 69, 56),
        src: '',
        fit: 'contain',
        ...column(C.art)
      },
      paper(box(-3, -3, 69, 94), 'original', 'bottom'),
      {
        type: 'shape',
        name: C.bg,
        ...box(-3, -3, 69, 94),
        fill: '#F3ECDD',
        locked: true,
        ...fixed
      }
    ],
    back: []
  }

  // il segnalino risorsa: l'icona viene dal livello Valore risorsa, il colore da una formula
  const token = {
    name: N.tToken,
    kind: 'token',
    width: 25,
    height: 25,
    shape: 'ellipse',
    bleed: 2,
    safeMargin: 2,
    cornerRadius: 0,
    labelField: C.resource,
    front: [
      value(C.resource, I.wood),
      { ...value(C.color), ...formula(colorExpr) },
      {
        type: 'image',
        name: C.icon,
        ...box(6.5, 6.5, 12, 12),
        src: '',
        fit: 'contain',
        ...formula(`{${C.resource}}`)
      },
      {
        type: 'shape',
        name: C.bg,
        ...box(-2, -2, 29, 29),
        shape: 'ellipse',
        fill: '#F1E6CE',
        ...fixed
      }
    ],
    back: []
  }

  // la tessera terreno esagonale
  const tile = {
    name: N.tTile,
    kind: 'tile',
    width: 50,
    height: 43.3,
    shape: 'hexagon',
    bleed: 2,
    safeMargin: 2,
    cornerRadius: 0,
    labelField: C.name,
    front: [
      value(C.name, L('Terreno', 'Terrain')),
      {
        type: 'image',
        name: C.art,
        ...box(-2, -2, 54, 47.3),
        src: '',
        fit: 'cover',
        ...column(C.art)
      },
      paper(box(-2, -2, 54, 47.3), 'tile'),
      {
        type: 'shape',
        name: C.bg,
        ...box(-2, -2, 54, 47.3),
        fill: '#E7D6B4',
        locked: true,
        ...fixed
      }
    ],
    back: []
  }
  for (const t of [place, token, tile])
    writeFileSync(join(dest, 'templates', t.name + '.json'), JSON.stringify(t, null, 2) + '\n')

  const dataFile = L('data/spedizione.xlsx', 'data/expedition.xlsx')
  const wb = new ExcelJS.Workbook()
  const p = wb.addWorksheet(N.places)
  p.addRow([C.name, C.art, C.resource, C.text])
  for (const [n, a, res, tx] of PLACES[lang]) p.addRow([n, a ? A[a] : '', I[res], tx])
  p.getColumn(1).width = 22
  p.getColumn(4).width = 50
  const r = wb.addWorksheet(N.resources)
  r.addRow(['amount', C.resource])
  for (const k of ['wood', 'stone', 'food', 'gold']) r.addRow([8, I[k]])
  const t = wb.addWorksheet(N.terrains)
  t.addRow(['amount', C.name, C.art])
  t.addRow([6, L('Bosco', 'Forest'), A.forest])
  t.addRow([4, L('Montagna', 'Mountain'), A.mountain])
  t.addRow([4, L('Lago', 'Lake'), A.lake])
  t.addRow([3, L('Deserto', 'Desert'), A.desert])
  await wb.xlsx.writeFile(join(dest, dataFile))

  writeFileSync(
    join(dest, 'stella.json'),
    JSON.stringify(
      {
        formatVersion: 1,
        name: N.project,
        ...(it ? { numberFormat: 'it' } : {}),
        dataFile,
        sets: [
          { name: N.places, template: N.tPlace },
          { name: N.resources, template: N.tToken },
          { name: N.terrains, template: N.tTile }
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
