// gruppo D: testo, markup, variabili, stili
import { launch, shot, shotEl } from './lib.mjs'
const lang = process.argv[2]
const it = lang === 'it'
const { app, win, T } = await launch({ lang, h: 1000 })
const dialog = () => win.locator('[role="dialog"]').first()
// i set si aprono nella griglia: per le righe serve la tabella
await win.getByRole('button', { name: T['set.table'], exact: true }).click()
await win.waitForTimeout(600)
// suggerimenti nel campo testo della carta 3 (Strega/Witch)
await win.locator('table tbody tr').nth(2).click()
await win.waitForTimeout(500)
// il campo del testo lungo: dopo ci sono anche i campi del retro
const areas = win.locator('.card-form textarea')
const ta = areas.nth(await areas.evaluateAll((els) => els.findIndex((e) => e.value.length > 30)))
await ta.click()
await win.keyboard.press('Control+End')
await win.keyboard.type(it ? '\nPrendi {sp' : '\nTake {sw', { delay: 40 })
await win.waitForTimeout(700)
await shot(win, `${lang}/suggerimenti`, { clip: { x: 1080, y: 380, width: 360, height: 620 } })
await win.keyboard.press('Escape')
// errore: variabile inesistente
await win.keyboard.type(it ? 'ada} e {pugnale}' : 'ord} and {dagger}', { delay: 20 })
await win.waitForTimeout(700)
await shot(win, `${lang}/errori-markup`, { clip: { x: 1080, y: 380, width: 360, height: 620 } })
// formatta: seleziona "due carte"/"two cards"
await win.keyboard.press('Control+z')
await win.keyboard.press('Control+z')
await win.keyboard.press('Control+z')
await win.waitForTimeout(300)
await ta.evaluate(
  (el, w) => {
    const i = el.value.indexOf(w)
    el.focus()
    el.setSelectionRange(i, i + w.length)
  },
  it ? 'due carte' : 'two cards'
)
// il pulsante del campo con la selezione, l'unico attivo
await win
  .locator('.card-form button:not([disabled])', { hasText: T['format.button'] })
  .first()
  .click()
await win.waitForTimeout(800)
await dialog().locator('input[type=checkbox]').first().check()
await dialog()
  .locator('select')
  .nth(1)
  .selectOption({ index: 8 })
  .catch((e) => console.log(e.message))
await win.waitForTimeout(500)
await shotEl(win, `${lang}/formatta`, dialog(), 24)
await dialog().getByRole('button', { name: T['format.cancel'], exact: true }).click()
await win.waitForTimeout(300)
// variabile icona: con più di sei voci la sezione delle variabili parte chiusa
await win
  .locator('#sidebar-variables .section-toggle[aria-expanded="false"]')
  .click({ timeout: 2000 })
  .catch(() => {})
await win.waitForTimeout(300)
await win
  .locator('.sidebar')
  .getByText(it ? '{spada}' : '{sword}', { exact: true })
  .click()
await win.waitForTimeout(800)
await shotEl(win, `${lang}/variabile-icona`, dialog(), 24)
await dialog().getByRole('button', { name: T['dialog.cancel'], exact: true }).click()
await win
  .locator('.sidebar')
  .getByText(it ? '{rapida}' : '{quick}', { exact: true })
  .click()
await win.waitForTimeout(800)
await shotEl(win, `${lang}/variabile-testo`, dialog(), 24)
await dialog().getByRole('button', { name: T['dialog.cancel'], exact: true }).click()
// stile
await win.locator('.sidebar').getByText('.keyword', { exact: true }).click()
await win.waitForTimeout(800)
await shotEl(win, `${lang}/stile`, dialog(), 24)
await win.keyboard.press('Escape')
await app.close()
