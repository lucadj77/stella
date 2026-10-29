// Il progetto del video 8 (le griglie): il progetto di esempio con i componenti come alla fine del video 7 e una plancia
// vuota di prova, dove la griglia si costruisce da zero. agentGrid() è la griglia che l'agente IA aggiunge
// alla plancia del video 7, nell'ultima parte del video.
// Uso da un altro script: const N = await extend(cartella del progetto, 'it' | 'en')
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gridGeometry } from '../../src/shared/model/grid.ts'
import { extend as extendBoards } from './progetto-plance.mjs'

/** la griglia di prova: la si disegna nel video con questi valori */
export const TEST = { x: 10, y: 14, w: 170, h: 108, rows: 5, columns: 8 }
/** i valori di un livello griglia appena creato, per calcolare dove cadono le caselle */
const GRID = {
  cell: 'square',
  interlock: false,
  orientation: 'pointy',
  gap: 1,
  padding: 0,
  zoom: 1,
  cellRatio: 1,
  alignX: 'center',
  alignY: 'center',
  radius: 0
}
/** misura e centro della prima casella della griglia di prova */
export function testCell() {
  const g = gridGeometry({ ...GRID, ...TEST })
  const size = g.centers[1].x - g.centers[0].x - GRID.gap
  return { size, x: TEST.x + g.centers[0].x, y: TEST.y + g.centers[0].y }
}

export async function extend(dest, lang) {
  const it = lang === 'it'
  const N = await extendBoards(dest, lang, { final: true })
  Object.assign(N, {
    test: it ? 'prova' : 'test',
    grid: it ? 'griglia' : 'grid',
    square: it ? 'quadrato' : 'square',
    label: it ? 'numero' : 'number',
    group: it ? 'casella' : 'cell',
    track: it ? 'segnapunti' : 'scoreboard',
    trackCell: it ? 'casella_segnapunti' : 'scoreboard_cell',
    // nomi diversi da quelli della mappa e del tracciato: in un template i nomi non si ripetono
    trackLabel: it ? 'punti' : 'points'
  })
  const template = {
    name: N.test,
    width: 190,
    height: 130,
    bleed: 3,
    safeMargin: 5,
    cornerRadius: 3,
    front: [
      {
        type: 'shape',
        name: N.background,
        shape: 'rect',
        x: -3,
        y: -3,
        w: 196,
        h: 136,
        fill: '#EDE4D3',
        stroke: null,
        locked: true
      }
    ],
    back: []
  }
  writeFileSync(join(dest, 'templates', N.test + '.json'), JSON.stringify(template, null, 2) + '\n')
  return N
}

/** la griglia che l'agente aggiunge sotto il tracciato: esagoni a incastro, prima riga azzurra con una regola */
export function agentGrid(N) {
  const grid = {
    type: 'grid',
    name: N.track,
    x: 186,
    y: 128,
    w: 88,
    h: 56,
    cell: 'hex',
    rows: 4,
    columns: 5,
    interlock: true,
    orientation: 'pointy',
    gap: 1,
    padding: 0,
    zoom: 1,
    cellRatio: 1,
    alignX: 'center',
    alignY: 'center',
    radius: 0,
    fill: '#FFFFFF',
    stroke: { color: '#333333', width: 0.4 },
    content: N.trackCell,
    cellRules: [{ when: '={cell.row} = 1', fill: '#9CC9E8' }]
  }
  const g = gridGeometry(grid)
  const first = g.centers[0]
  const w = g.centers[1].x - first.x - grid.gap
  const group = {
    type: 'group',
    name: N.trackCell,
    layout: 'none',
    gap: 0,
    columns: 1,
    justify: 'center',
    alignItems: 'center',
    clip: false,
    children: [
      {
        type: 'text',
        name: N.trackLabel,
        x: grid.x + first.x - (w * 0.8) / 2,
        y: grid.y + first.y - (w * 0.5) / 2,
        w: w * 0.8,
        h: w * 0.5,
        text: '{cell.index}',
        weight: 700,
        size: 10,
        color: '#2A241C',
        align: 'center',
        valign: 'middle'
      }
    ]
  }
  return { grid, group }
}
