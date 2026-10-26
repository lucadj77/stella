// Aggiunge al progetto di esempio quello che serve al video 16 (generare le carte, dividere un'immagine):
// il template «gilda» con il set vuoto «Gilde», 30 ritratti in assets/images/ritratti per «Da una cartella…»,
// il template «mappa» con il set vuoto «Mappa» e l'immagine di una mappa da dividere su 3 × 2 carte.
// I livelli che non cambiano da carta a carta sono Fissi, così non diventano campi del set.
// Uso da un altro script: await extend(cartella del progetto, 'it' | 'en')
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const REPO = new URL('../..', import.meta.url).pathname
const ExcelJS = createRequire(join(REPO, 'package.json'))('exceljs')

const box = (x, y, w, h) => ({ x, y, w, h })
const fixed = { source: { kind: 'fixed' } }

// sei figure delle icone dell'esempio, cinque colori di sfondo: 30 ritratti diversi
const FIGURES = {
  it: ['cavaliere', 'arciere', 'ladro', 'monaco', 'strega', 'drago'],
  en: ['knight', 'archer', 'thief', 'monk', 'witch', 'dragon']
}
const HUES = ['#2F5DA8', '#3C7A3E', '#A8322F', '#7A4FA0', '#B07A1E']

function portraits(dest, lang) {
  const dir = join(dest, 'assets', 'images', lang === 'it' ? 'ritratti' : 'portraits')
  mkdirSync(dir, { recursive: true })
  const base = lang === 'it' ? 'ritratto' : 'portrait'
  let n = 0
  for (const hue of HUES)
    for (const f of FIGURES[lang]) {
      n++
      const svg = readFileSync(join(dest, 'assets', 'icons', f + '.svg'), 'utf8')
      const path = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
      writeFileSync(
        join(dir, `${base}-${String(n).padStart(2, '0')}.svg`),
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
          `<rect width="512" height="512" rx="40" fill="${hue}"/>` +
          `<circle cx="256" cy="256" r="210" fill="#FFFFFF" opacity="0.14"/>` +
          `<g transform="translate(76 76) scale(0.703)" fill="#FFFFFF">${path}</g></svg>\n`
      )
    }
}

export async function extend(dest, lang) {
  const it = lang === 'it'
  const L = (a, b) => (it ? a : b)
  const N = {
    suit: L('seme', 'suit'),
    number: L('numero', 'number'),
    portrait: L('ritratto', 'portrait'),
    piece: L('pezzo', 'piece')
  }
  portraits(dest, lang)
  const mapFile = L('mappa.png', 'map.png')
  execFileSync('python3', [
    new URL('./mappa.py', import.meta.url).pathname,
    join(dest, 'assets', 'images', mapFile)
  ])
  const templates = [
    {
      name: L('gilda', 'guild'),
      width: 63,
      height: 88,
      bleed: 3,
      safeMargin: 3,
      cornerRadius: 3,
      front: [
        {
          type: 'text',
          name: N.number,
          ...box(5, 4.5, 14, 13),
          text: '1',
          weight: 900,
          size: 24,
          color: '#2A241C',
          align: 'center',
          valign: 'middle'
        },
        {
          type: 'text',
          name: N.suit,
          ...box(44, 4.5, 14, 13),
          text: '',
          size: 22,
          align: 'center',
          valign: 'middle',
          lineHeight: 1
        },
        { type: 'image', name: N.portrait, ...box(9, 21, 45, 45), src: '', fit: 'contain' },
        {
          type: 'text',
          name: L('titolo', 'title'),
          ...box(5, 72, 53, 9),
          text: L('Gilda', 'Guild'),
          weight: 800,
          size: 11,
          color: '#5E5446',
          align: 'center',
          valign: 'middle',
          transform: 'upper',
          letterSpacing: 200,
          ...fixed
        },
        {
          type: 'shape',
          name: L('cornice', 'frame'),
          ...box(3, 3, 57, 82),
          radius: 2,
          fill: null,
          stroke: { color: '#CFC4B0', width: 0.6 },
          ...fixed
        },
        {
          type: 'shape',
          name: L('sfondo', 'background'),
          ...box(-3, -3, 69, 94),
          fill: '#F4EFE4',
          locked: true,
          ...fixed
        }
      ],
      back: [
        {
          type: 'shape',
          name: L('retro_sfondo', 'back_background'),
          ...box(-3, -3, 69, 94),
          fill: '#2A3550',
          ...fixed
        }
      ]
    },
    {
      name: L('mappa', 'map'),
      width: 63,
      height: 88,
      bleed: 3,
      safeMargin: 3,
      front: [
        { type: 'image', name: N.piece, ...box(-3, -3, 69, 94), src: '', fit: 'cover' },
        {
          type: 'shape',
          name: L('sfondo', 'background'),
          ...box(-3, -3, 69, 94),
          fill: '#2E5E86',
          locked: true,
          ...fixed
        }
      ]
    }
  ]
  for (const t of templates)
    writeFileSync(join(dest, 'templates', t.name + '.json'), JSON.stringify(t, null, 2) + '\n')
  const sheets = [
    [L('Gilde', 'Guilds'), templates[0].name, ['amount', N.number, N.suit, N.portrait]],
    [L('Mappa', 'Map'), templates[1].name, ['amount', N.piece]]
  ]
  const project = JSON.parse(readFileSync(join(dest, 'stella.json'), 'utf8'))
  const wb = new ExcelJS.Workbook()
  const file = join(dest, project.dataFile)
  await wb.xlsx.readFile(file)
  for (const [name, template, header] of sheets) {
    wb.addWorksheet(name).addRow(header)
    project.sets.push({ name, template })
  }
  await wb.xlsx.writeFile(file)
  writeFileSync(join(dest, 'stella.json'), JSON.stringify(project, null, 2) + '\n')
  return { guilds: sheets[0][0], map: sheets[1][0], mapFile, figures: FIGURES[lang], N }
}
