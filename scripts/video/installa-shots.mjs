// Video 15 (installare Stella): le schermate dell'app per le diapositive, la schermata di ingresso e il menu ⚙
import { writeFileSync } from 'node:fs'
import { launch } from './lib.mjs'
const lang = process.argv[2] || 'it'
const dir = process.argv[3] || '/tmp/v/v15/cap'
const r = await launch({ lang })
const win = r.win
await win.waitForTimeout(1500)
await win.screenshot({ path: `${dir}/app-start-${lang}.png` })
// i riquadri delle diapositive, in pixel della schermata
const box = async (l) => {
  const b = await l.boundingBox()
  return [b.x, b.y, b.x + b.width, b.y + b.height].map(Math.round)
}
const T = r.T
const boxes = { check: await box(win.getByText(T['update.check'], { exact: true }).first()) }
await win.locator('.settings-button').first().click()
await win.waitForTimeout(800)
await win.screenshot({ path: `${dir}/app-settings-${lang}.png` })
const row = await box(win.getByText(T['app.channel'], { exact: true }).first())
const sel = await box(
  win.getByText(T['app.channel'], { exact: true }).first().locator('xpath=following::select[1]')
)
boxes.channel = [row[0], Math.min(row[1], sel[1]), sel[2], Math.max(row[3], sel[3])]
writeFileSync(`${dir}/app-${lang}.json`, JSON.stringify(boxes))
await r.app.close()
