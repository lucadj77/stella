// gruppo M: assistente formule (tasto fx) sul numero del tracciato del punteggio
import { launch, makeProject, mockOpen, shot, shotEl } from './lib.mjs'
import { writeFileSync } from 'node:fs'
const lang = process.argv[2]
const it = lang === 'it'
const { app, win, T } = await launch({ lang, open: false })
const project = makeProject(lang)

// lo stesso tracciato di l.mjs: una griglia 4 × 10 con il numero di ogni casella
const trackName = it ? 'tracciato' : 'track'
const numName = it ? 'numero' : 'number'
const track = {
  name: trackName,
  width: 120,
  height: 70,
  bleed: 3,
  safeMargin: 3,
  cornerRadius: 3,
  front: [
    {
      type: 'text',
      name: it ? 'titolo' : 'title',
      x: 6,
      y: 4,
      w: 108,
      h: 8,
      text: it ? 'Tracciato del punteggio' : 'Score track',
      weight: 800,
      size: 11,
      color: '#2A241C'
    },
    {
      type: 'grid',
      name: it ? 'caselle' : 'cells',
      x: 6,
      y: 14,
      w: 108,
      h: 52,
      cell: 'square',
      rows: 4,
      columns: 10,
      interlock: false,
      orientation: 'pointy',
      gap: 1,
      padding: 1.5,
      zoom: 1,
      fill: '#FFFFFF',
      stroke: { color: '#8C8270', width: 0.3 },
      background: '#D9D2C2',
      border: null,
      backgroundRadius: 2,
      radius: 1,
      cellRatio: 1,
      alignX: 'center',
      alignY: 'center',
      clip: false,
      content: it ? 'casella' : 'cell'
    },
    {
      type: 'group',
      name: it ? 'casella' : 'cell',
      layout: 'none',
      gap: 0,
      columns: 1,
      justify: 'center',
      alignItems: 'center',
      clip: false,
      children: [
        {
          type: 'text',
          name: numName,
          x: 7.5,
          y: 19.3,
          w: 9.6,
          h: 9.6,
          text: '1',
          weight: 700,
          size: 9,
          color: '#2A241C',
          align: 'center',
          valign: 'middle',
          source: {
            kind: 'formula',
            expr: '=IF(MOD({cell.index}; 10) = 0; "[" & {cell.index} & "]{color=#A33A2A weight=800}"; {cell.index})'
          }
        }
      ]
    },
    {
      type: 'shape',
      name: it ? 'sfondo' : 'background',
      shape: 'rect',
      x: -3,
      y: -3,
      w: 126,
      h: 76,
      fill: '#F6F2E8',
      stroke: null,
      locked: true
    }
  ],
  back: []
}
writeFileSync(`${project}/templates/${track.name}.json`, JSON.stringify(track, null, 2))
await mockOpen(app, project)
await win.getByText(T['start.openProject']).click()
await win.waitForTimeout(2500)

await win.locator('.sidebar').getByText(trackName, { exact: true }).first().click()
await win.waitForTimeout(1500)
await win.locator('aside.layers').getByText(numName, { exact: true }).first().click()
await win.waitForTimeout(800)
await win.locator('.value-source .fx-button').click()
await win.waitForTimeout(800)
// la formula del numero riconosciuta come frase «Ogni 10 caselle…»
await shot(win, `${lang}/assistente-formule`, { clip: await win.locator('.dialog').boundingBox() })
// «Ricomincia»: la schermata «Cosa vuoi fare?»
await win.getByRole('button', { name: T['fx.startOver'] }).click()
await win.waitForTimeout(500)
await shot(win, `${lang}/assistente-formule-inizio`, {
  clip: await win.locator('.dialog').boundingBox()
})
await win.getByRole('button', { name: T['dialog.cancel'] }).click()
await win.waitForTimeout(400)
// la griglia senza contenuto: i pulsanti che creano il testo o la forma nelle caselle
await win
  .locator('aside.layers')
  .getByText(it ? 'caselle' : 'cells', { exact: true })
  .first()
  .click()
await win.waitForTimeout(800)
await win
  .locator('.properties select')
  .filter({ has: win.locator(`option[value="${it ? 'casella' : 'cell'}"]`) })
  .last()
  .selectOption('')
await win.waitForTimeout(500)
const create = win.locator('.fx-content-create')
await create.scrollIntoViewIfNeeded()
await win.waitForTimeout(300)
await shotEl(win, `${lang}/griglia-contenuto-crea`, create)
await app.close()
