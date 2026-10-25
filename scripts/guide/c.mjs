// gruppo C: editor dei template
import { launch, shot, shotEl, annotate, clearAnnotations } from './lib.mjs'
const lang = process.argv[2]
const it = lang === 'it'
const { app, win, T } = await launch({ lang, h: 1000 })
const props = win.locator('aside.properties')
const layer = (name) =>
  win.locator('.layers .layer-name', { hasText: new RegExp(`^${name}$`) }).first()
await win.getByText(T['preview.editTemplate']).click()
await win.waitForTimeout(1500)
await win.locator('.preview-data select').first().selectOption('0')
await win.waitForTimeout(800)
await layer(it ? 'testo' : 'text').click()
await win.waitForTimeout(500)
await annotate(win, [
  [win.locator('.editor-toolbar button').first(), 1, { dx: -14, dy: -14 }],
  [win.locator('aside.layers h2').first(), 2, { dx: 70 }],
  [win.locator('.editor-center').first(), 3, 'tl'],
  [props.locator('h3, h2').first(), 4, { dx: 120 }],
  [win.getByRole('button', { name: T['editor.zoomFit'], exact: true }), 5, 'after'],
  [win.locator('.preview-data').first(), 6, 'before']
])
await shot(win, `${lang}/editor`)
// riquadro del pannello delle proprietà (la sua larghezza cambia con le versioni)
const panel = async (h) => {
  const b = await props.boundingBox()
  return { clip: { x: b.x, y: 96, width: Math.min(b.width, 1440 - b.x), height: h } }
}
await clearAnnotations(win)
// pannello del testo con Avanzate aperte
const adv = props.getByText(/^(Avanzate|Advanced) \(/).first()
await adv.click()
await win.waitForTimeout(500)
await shot(win, `${lang}/proprieta-testo`, await panel(904))
await adv.click()
// formula: livello rango
await layer(it ? 'rango' : 'rank').click()
await win.waitForTimeout(500)
await shotEl(win, `${lang}/formula`, props.locator('.value-source').first(), 14)
// immagine
await layer(it ? 'ritratto' : 'portrait').click()
await win.waitForTimeout(500)
await shot(win, `${lang}/proprieta-immagine`, await panel(904))
// forma: banda, con il menu del riempimento
await layer(it ? 'banda' : 'band').click()
await win.waitForTimeout(500)
await shot(win, `${lang}/proprieta-forma`, await panel(904))
// allineamento: due livelli
await layer(it ? 'forza' : 'strength').click()
await layer(it ? 'rango' : 'rank').click({ modifiers: ['Shift'] })
await win.waitForTimeout(500)
await shot(win, `${lang}/allinea`, await panel(260))
// retro
await win.getByRole('button', { name: T['preview.back'], exact: true }).first().click()
await win.waitForTimeout(800)
await shot(win, `${lang}/editor-retro`)
await win.getByRole('button', { name: T['preview.front'], exact: true }).first().click()
// nuovo template
await win.getByTitle(T['sidebar.newTemplate']).first().click()
await win.waitForTimeout(600)
// un segnalino: il tipo propone i formati tondi
await win.locator('[role="dialog"]').getByRole('radio', { name: T['kind.token'] }).click()
await win
  .locator('[role="dialog"] input')
  .first()
  .fill(it ? 'segnalino' : 'token')
await shotEl(win, `${lang}/nuovo-template`, win.locator('[role="dialog"]').first(), 24)
await win.keyboard.press('Escape')
// template mercato: livello valore
await win
  .locator('.sidebar')
  .getByText(it ? 'mercato' : 'market', { exact: true })
  .first()
  .click()
await win.waitForTimeout(1200)
await win.locator('.preview-data select').first().selectOption({ index: 1 })
await win.waitForTimeout(600)
await layer(it ? 'punti' : 'points').click()
await win.waitForTimeout(600)
await shot(win, `${lang}/livello-valore`)
await app.close()
