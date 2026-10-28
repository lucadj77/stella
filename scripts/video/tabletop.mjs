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
  for (const k of ['focus', 'click', 'zoom']) {
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
    .filter({ has: win.locator('.tts-object-name', { hasText: new RegExp(`^${name}\\s*\\d*$`) }) })
    .first()
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
await r.click(dialog().locator('.export-goal').filter({ hasText: T['export.goal.tts'] }).first())
await r.wait(600)
await r.focus(
  dialog().locator('.tts-table').first(),
  it
    ? 'Ogni set diventa un oggetto di Tabletop Simulator: Stella lo propone dal tipo del template'
    : 'Each set becomes a Tabletop Simulator object: Stella suggests it from the template’s kind',
  'right',
  { pad: 6 }
)
await r.zoom(ttsRow(coins), { max: 1.7 })
await r.click(ttsRow(coins).locator('.kind-picker'), { after: 500 })
await r.unzoom(500)
const kinds = () => win.locator('[role="menu"]').last()
await r.focus(
  kinds(),
  it
    ? 'Si può cambiare: carte, segnalini, pedine in piedi, tessere, plance o dadi'
    : 'You can change it: cards, tokens, standees, tiles, boards or dice',
  'right'
)
await r.click(
  kinds().locator('.kind-menu-item').filter({ hasText: T['export.ttsToken'] }).first(),
  { after: 600 }
)
await r.zoom(ttsRow(coins), { max: 1.7 })
await r.focus(
  ttsRow(coins).locator('.tts-object-details'),
  it
    ? 'Segnalini, tessere e plance hanno anche lo spessore. I tag servono agli snap point'
    : 'Tokens, tiles and boards also have a thickness. Tags are for snap points',
  'below'
)
await r.unzoom(500)
await r.focus(
  dialog().locator('.live-preview').first(),
  it
    ? 'L’anteprima mostra le immagini che vanno in Tabletop Simulator'
    : 'The preview shows the images that go into Tabletop Simulator',
  'left',
  { pad: 4 }
)
const dest = dialog()
  .locator('.export-choice-row')
  .filter({ has: win.locator('.export-choice-label', { hasText: T['export.destination'] }) })
  .first()
await dest.scrollIntoViewIfNeeded()
await r.click(dest.locator('.export-choice').filter({ hasText: T['export.destBoth'] }).first(), {
  after: 500
})
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
  dialog().locator('.export-result').first(),
  it
    ? 'Fatto: un oggetto per ogni set, con le immagini accanto'
    : 'Done: one object per set, with the images next to it',
  'above'
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
