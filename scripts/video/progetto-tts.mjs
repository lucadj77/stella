// Aggiunge al progetto di esempio i componenti che non sono carte, per il video su Tabletop Simulator:
// monete (segnalini rotondi), terreni (tessere esagonali), una plancia e un dado a sei facce.
// Uso da un altro script: await extend(cartella del progetto, 'it' | 'en')
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const REPO = new URL('../..', import.meta.url).pathname
const ExcelJS = createRequire(join(REPO, 'package.json'))('exceljs')

const box = (x, y, w, h) => ({ x, y, w, h })
const background = (w, h, fill, expr) => ({
  type: 'shape',
  name: 'sfondo',
  ...box(-3, -3, w + 6, h + 6),
  fill,
  ...(expr ? { source: { kind: 'formula', expr } } : {}),
  locked: true
})
const icon = (name, b, tint = '#FFFFFF', src = '') => ({
  type: 'image',
  name,
  ...b,
  src,
  fit: 'contain',
  tint
})

export async function extend(dest, lang) {
  const it = lang === 'it'
  const L = (a, b) => (it ? a : b)
  const N = {
    coin: L('moneta', 'coin'),
    wood: L('legno', 'wood'),
    stone: L('pietra', 'stone'),
    wheat: L('grano', 'wheat'),
    sword: L('spada', 'sword'),
    shield: L('scudo', 'shield'),
    value: L('valore', 'value'),
    icon: L('icona', 'icon'),
    color: L('colore', 'color'),
    title: L('titolo', 'title'),
    face: L('faccia', 'face')
  }
  const templates = [
    {
      name: L('segnalino', 'token'),
      kind: 'token',
      width: 25,
      height: 25,
      bleed: 2,
      safeMargin: 2,
      shape: 'ellipse',
      front: [
        {
          type: 'text',
          name: N.value,
          ...box(4, 13, 17, 8),
          text: '1',
          weight: 900,
          size: 16,
          color: '#FFFFFF',
          align: 'center',
          valign: 'middle'
        },
        icon('simbolo', box(7.5, 3.5, 10, 10), '#FFFFFF', N.coin),
        background(25, 25, '#B07A1E')
      ]
    },
    {
      name: L('tessera', 'tile'),
      kind: 'tile',
      width: 46,
      height: 40,
      bleed: 2,
      safeMargin: 3,
      shape: 'hexagon',
      front: [icon(N.icon, box(13, 10, 20, 20)), background(46, 40, '#5E7D3A', `{${N.color}}`)]
    },
    {
      name: L('plancia', 'board'),
      kind: 'board',
      width: 240,
      height: 160,
      bleed: 3,
      safeMargin: 5,
      front: [
        {
          type: 'text',
          name: N.title,
          ...box(10, 8, 220, 18),
          text: '',
          weight: 800,
          size: 40,
          color: '#2A241C',
          align: 'center',
          valign: 'middle',
          transform: 'upper',
          letterSpacing: 120
        },
        ...[0, 1, 2].map((i) => ({
          type: 'shape',
          name: 'zona' + (i + 1),
          ...box(14 + i * 74, 40, 64, 104),
          radius: 4,
          fill: '#FFFFFF',
          stroke: { color: '#CFC4B0', width: 1 }
        })),
        background(240, 160, '#EDE4D3')
      ]
    },
    {
      name: L('dado', 'die'),
      kind: 'die',
      width: 18,
      height: 18,
      bleed: 1,
      safeMargin: 1,
      cornerRadius: 2,
      front: [icon(N.icon, box(3, 3, 12, 12), '#2A241C'), background(18, 18, '#F4EFE4')]
    }
  ]
  for (const t of templates)
    writeFileSync(join(dest, 'templates', t.name + '.json'), JSON.stringify(t, null, 2) + '\n')

  const sheets = [
    [
      L('Monete', 'Coins'),
      templates[0].name,
      ['amount', N.value],
      [
        [10, 1],
        [6, 3],
        [4, 5]
      ]
    ],
    [
      L('Terreni', 'Lands'),
      templates[1].name,
      ['amount', N.icon, N.color],
      [
        [4, N.wood, '#5E7D3A'],
        [4, N.stone, '#7A756D'],
        [4, N.wheat, '#C49A1E']
      ]
    ],
    [L('Plancia', 'Board'), templates[2].name, ['amount', N.title], [[1, L('Il regno', 'The kingdom')]]],
    [
      L('Dado', 'Die'),
      templates[3].name,
      ['amount', N.face, N.icon],
      [
        [2, 1, N.sword],
        [1, 2, N.shield],
        [1, 3, N.coin],
        [1, 4, N.wood],
        [1, 5, N.stone],
        [1, 6, N.wheat]
      ]
    ]
  ]
  const project = JSON.parse(readFileSync(join(dest, 'stella.json'), 'utf8'))
  const wb = new ExcelJS.Workbook()
  const file = join(dest, project.dataFile)
  await wb.xlsx.readFile(file)
  for (const [name, template, header, rows] of sheets) {
    const ws = wb.addWorksheet(name)
    ws.addRow(header)
    for (const row of rows) ws.addRow(row)
    project.sets.push({ name, template })
  }
  await wb.xlsx.writeFile(file)
  writeFileSync(join(dest, 'stella.json'), JSON.stringify(project, null, 2) + '\n')
  return sheets.map((s) => s[0])
}
