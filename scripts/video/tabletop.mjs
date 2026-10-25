// Video 3: da Stella a Tabletop Simulator (parte nell'app, circa 3 minuti, senza voce). Il progetto di
// esempio con in più monete, terreni, una plancia e un dado (progetto-tts.mjs): per ogni set si sceglie
// l'oggetto di Tabletop Simulator e si esporta. Il filmato dentro Tabletop Simulator si aggiunge al montaggio.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node --experimental-strip-types --no-warnings scripts/video/tabletop.mjs it|en
// FAST=1 accorcia attese e scrittura, per provare il percorso senza badare al ritmo.
import { launch, makeProject, mockOpen } from './lib.mjs'
import { extend } from './progetto-tts.mjs'
const lang = process.argv[2] || 'it'
const it = lang === 'it'
const project = makeProject(lang)
const [coins, lands, board, die] = await extend(project, lang)
const r = await launch({ lang, ...(process.env.UD ? { ud: process.env.UD } : {}) })
const { win, T, app } = r
if (process.env.FAST) {
  const wait = r.wait.bind(r)
  r.wait = (ms) => wait(Math.min(ms, 120))
  r.type = (text) => win.keyboard.type(text, { delay: 2 })
}
if (process.env.SHOT) {
  for (const k of ['focus', 'click']) {
    const f = r[k].bind(r)
    r[k] = async (...a) => {
      try {
        return await f(...a)
      } catch (e) {
        await win.screenshot({ path: process.env.SHOT })
        throw e
      }
    }
  }
}
const click0 = r.click.bind(r)
r.click = async (loc, opts) => {
  await r.clear(150)
  return click0(loc, opts)
}
const cardsSet = it ? 'Personaggi' : 'Characters'
const dialog = () => win.locator('[role="dialog"]').last()
const side = (name) => win.locator('.sidebar').getByText(name, { exact: true }).first()
const grid = () => win.locator('.card-grid').first()
const ttsRow = (name) =>
  dialog()
    .locator('.tts-object')
    .filter({ has: win.locator('.tts-object-name', { hasText: new RegExp(`^${name}$`) }) })
    .first()
async function choose(loc, value) {
  await loc.scrollIntoViewIfNeeded()
  await r.click(loc, { after: 200, before: 200, ms: 450 })
  await win.keyboard.press('Escape')
  await loc.selectOption(value)
  await r.wait(600)
}
async function openSet(name, text) {
  await r.click(side(name))
  await r.clear(900)
  await r.overlay()
  await r.focus(grid(), text, 'right', { pad: 6 })
}

await r.overlay()
await r.title(it ? 'Da Stella a Tabletop Simulator' : 'From Stella to Tabletop Simulator')
await r.title(
  it
    ? 'Carte, segnalini, tessere, plance e dadi, pronti da provare al tavolo virtuale'
    : 'Cards, tokens, tiles, boards and dice, ready to try on the virtual table'
)
await r.clear()
await mockOpen(app, project)
await r.click(win.getByText(T['start.openProject']))
await r.clear(2200)
await r.overlay()

// i componenti
await openSet(cardsSet, it ? 'Le carte: diventano un mazzo' : 'The cards: they become a deck')
await openSet(coins, it ? 'Monete rotonde: diventano segnalini' : 'Round coins: they become tokens')
await openSet(
  lands,
  it ? 'Terreni esagonali: diventano tessere' : 'Hexagonal lands: they become tiles'
)
await openSet(board, it ? 'Una plancia' : 'A board')
await openSet(
  die,
  it ? 'Sei carte quadrate: le facce di un dado' : 'Six square cards: the faces of a die'
)

// l'esportazione
await r.title(it ? 'L’esportazione' : 'The export')
await r.clear()
await r.click(win.locator('header.toolbar').getByText(T['app.export'], { exact: true }).first())
await r.clear(800)
await r.click(dialog().getByRole('button', { name: T['export.tts'], exact: true }))
await r.wait(600)
await r.focus(
  dialog().locator('.tts-objects').first(),
  it
    ? 'Per ogni set si sceglie cosa diventa in Tabletop Simulator'
    : 'For each set, choose what it becomes in Tabletop Simulator',
  'left',
  { pad: 6 }
)
for (const [name, type] of [
  [coins, 'token'],
  [lands, 'tile'],
  [board, 'board'],
  [die, 'die']
])
  await choose(ttsRow(name).locator('select').first(), type)
await r.focus(
  dialog().locator('.tts-objects').first(),
  it
    ? 'Segnalini, tessere e plance hanno anche lo spessore'
    : 'Tokens, tiles and boards also have a thickness',
  'left',
  { pad: 6 }
)
const dest = dialog()
  .locator('select')
  .filter({ has: win.locator(`option[value="both"]`) })
  .first()
await choose(dest, 'both')
await r.focus(
  dest,
  it
    ? 'I file vanno nel progetto e negli oggetti salvati di Tabletop Simulator'
    : 'The files go into the project and into Tabletop Simulator’s saved objects',
  'above'
)
const run = dialog().getByRole('button', { name: T['export.run'], exact: true })
await r.click(run)
// l'esportazione dura qualche secondo: il tasto torna attivo alla fine
await win.waitForTimeout(1000)
for (let i = 0; i < 240 && !(await run.isEnabled()); i++) await win.waitForTimeout(500)
await r.wait(1200)
await r.focus(
  dialog(),
  it
    ? 'Fatto: un oggetto per ogni set, con le immagini accanto'
    : 'Done: one object per set, with the images next to it',
  'none',
  { pad: 0, dim: false }
)
await r.click(dialog().getByRole('button', { name: T['export.close'], exact: true }))
await r.clear()
await r.title(
  it
    ? 'In Tabletop Simulator: Objects → Saved Objects'
    : 'In Tabletop Simulator: Objects → Saved Objects',
  3600
)
await r.clear(600)
const p = await r.finish()
console.log('VIDEO', p)
