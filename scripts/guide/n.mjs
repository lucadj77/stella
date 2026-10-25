// gruppo N: benvenuto del primo avvio e striscia Primi passi
import { launch, shot } from './lib.mjs'
import { rmSync } from 'node:fs'
const lang = process.argv[2]
// una casa vuota, senza progetti recenti né progetto di esempio
process.env.GUIDE_HOME = '/tmp/stella-guide/home-n-' + lang
rmSync(process.env.GUIDE_HOME, { recursive: true, force: true })
rmSync('/tmp/stella-guide/ud-n' + lang, { recursive: true, force: true })
const { app, win, T } = await launch({ lang, open: false, ud: '/tmp/stella-guide/ud-n' + lang })
await shot(win, `${lang}/benvenuto`, { clip: { x: 0, y: 0, width: 1440, height: 540 } })
const dialog = win.locator('[role="dialog"]')
await win.getByText(T['welcome.scratch']).first().click()
await win.waitForTimeout(500)
await dialog
  .locator('input')
  .first()
  .fill(lang === 'it' ? 'Il mio gioco' : 'My game')
await dialog.locator('button.primary').last().click()
await win.waitForTimeout(2000)
// primo passo: il template; secondo: il set, che resta vuoto
for (const name of [lang === 'it' ? 'carta' : 'card', lang === 'it' ? 'mazzo' : 'deck']) {
  await win.locator('.first-steps button').first().click()
  await win.waitForTimeout(500)
  await dialog.locator('input').first().fill(name)
  await dialog.locator('button.primary').last().click()
  await win.waitForTimeout(1500)
}
await shot(win, `${lang}/primi-passi`)
await app.close()
