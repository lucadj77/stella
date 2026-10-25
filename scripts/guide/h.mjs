// gruppo H: finestra Aiuto
import { launch, shotEl } from './lib.mjs'
import { rmSync } from 'node:fs'
const lang = process.argv[2]
rmSync('/tmp/stella-guide/ud-h' + lang, { recursive: true, force: true })
const { app, win, T } = await launch({ lang, ud: '/tmp/stella-guide/ud-h' + lang })
await win.getByRole('button', { name: T['app.help'], exact: true }).first().click()
await win.waitForTimeout(800)
const dialog = win.locator('[role="dialog"]').first()
// con una memoria nuova l'Aiuto si apre su Primi passi
await shotEl(win, `${lang}/aiuto-primi-passi`, dialog, 24)
await win.getByRole('button', { name: T['help.tab.text'], exact: true }).click()
await win.waitForTimeout(600)
await shotEl(win, `${lang}/aiuto`, dialog, 24)
await win.getByRole('button', { name: T['help.tab.variables'], exact: true }).click()
await win.waitForTimeout(600)
// in vista le variabili di sistema
await win.evaluate((title) => {
  const body = document.querySelector('.help-body')
  const h = [...body.querySelectorAll('h3, h4, strong, p, div')].find(
    (e) => e.textContent.trim() === title
  )
  if (h) body.scrollTop = h.offsetTop - body.offsetTop - 8
}, T['help.system'] ?? '')
await win.waitForTimeout(300)
await shotEl(win, `${lang}/aiuto-variabili`, dialog, 24)
await app.close()
