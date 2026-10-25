// gruppo B: finestra del progetto e dati
import { launch, shot, shotEl, annotate, clearAnnotations } from './lib.mjs'
const lang = process.argv[2]
const { app, win, T } = await launch({ lang })
const it = lang === 'it'
// panoramica annotata
await annotate(win, [
  [win.locator('.toolbar .project-name').first(), 1, 'after'],
  [win.getByText(T['sidebar.sets'], { exact: true }).first(), 2, { dx: 70 }],
  [win.getByText(T['sidebar.templates'], { exact: true }).first(), 3, { dx: it ? 105 : 120 }],
  // stili e variabili hanno il numero delle voci accanto al titolo
  [win.locator('#sidebar-styles .section-toggle'), 4, { dx: it ? 100 : 110 }],
  [win.locator('#sidebar-variables .section-toggle'), 5, { dx: it ? 125 : 135 }],
  [win.locator('.card-grid').first(), 6, { dx: -14, dy: 0 }],
  [win.locator('.preview-header h2').first(), 7, 'after'],
  [win.locator('.card-form h3').first(), 8, { dx: 60 }]
])
await shot(win, `${lang}/progetto`)
await clearAnnotations(win)
// griglia
await win.getByRole('button', { name: T['set.grid'], exact: true }).click()
await win.waitForTimeout(1200)
await shot(win, `${lang}/griglia`)
// retro
await win.getByRole('button', { name: T['preview.back'], exact: true }).first().click()
await win.waitForTimeout(800)
await shot(win, `${lang}/griglia-retro`)
await win.getByRole('button', { name: T['preview.front'], exact: true }).first().click()
await win.getByRole('button', { name: T['set.table'], exact: true }).click()
await win.waitForTimeout(800)
// ordinamento: clic sull'intestazione forza
await win
  .locator('th', { hasText: it ? 'forza' : 'strength' })
  .first()
  .click()
await win.waitForTimeout(300)
await win
  .locator('th', { hasText: it ? 'forza' : 'strength' })
  .first()
  .click()
await win.getByPlaceholder(T['set.filter']).fill(it ? 'carte' : 'cards')
await win.mouse.move(700, 700)
await win.waitForTimeout(800)
await shot(win, `${lang}/ordina-filtra`, { clip: { x: 220, y: 46, width: 900, height: 520 } })
await win
  .getByRole('button', { name: T['set.clearView'] })
  .click()
  .catch(() => {})
await win.getByPlaceholder(T['set.filter']).fill('')
await win.waitForTimeout(500)
// nuovo set
// il + della sezione Set (il title può essere già passato al tooltip dell'app)
await win.locator('.sidebar button', { hasText: /^\+$/ }).first().click()
await win.waitForTimeout(600)
await shotEl(win, `${lang}/nuovo-set`, win.locator('[role="dialog"]').first(), 24)
await win.keyboard.press('Escape')
// aggiungi colonna
await win.getByRole('button', { name: T['set.addColumn'] }).click()
await win.waitForTimeout(600)
await shotEl(win, `${lang}/aggiungi-colonna`, win.locator('[role="dialog"]').first(), 24)
await win.keyboard.press('Escape')
await app.close()
