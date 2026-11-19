// Video 31, approfondimento: la fonte Elenco e le varianti dei template, circa 10 minuti senza voce,
// sul progetto «Torneo» di progetto-torneo.mjs, che chi guarda scarica dal sito. Capitoli: il problema
// (scrivere a mano nomi di immagini e colori), Elenco su un'immagine, su una forma e su un valore, la
// scelta nella scheda e nella tabella con l'avviso fuori elenco, tante voci (menu con la ricerca), le
// varianti, la scelta della variante, elenco o varianti, il pacchetto, riepilogo.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node scripts/video/elenchi.mjs it|en
// FAST=1 accorcia attese e scrittura; SHOT=<file.png> salva la schermata se un elemento non si trova;
// SNAP=<cartella> salva una schermata dopo ogni testo, e i testi in testi.tsv (per lo storyboard).
import { appendFileSync } from 'node:fs'
import { launch, mockOpen } from './lib.mjs'
import { docs } from '../guide/lib.mjs'
import { make, names } from './progetto-torneo.mjs'
const lang = process.argv[2] || 'it'
const it = lang === 'it'
const t = (a, b) => (it ? a : b)
const N = names(lang)
const { C } = N
const dest = `${docs(lang)}/Stella/${N.folder}`
await make(dest, lang)
const r = await launch({ lang, ...(process.env.UD ? { ud: process.env.UD } : {}) })
const { win, T } = r
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
if (process.env.SNAP) {
  let n = 0
  for (const k of ['focus', 'title']) {
    const f = r[k].bind(r)
    r[k] = async (...a) => {
      await f(...a)
      const id = String(++n).padStart(3, '0')
      await win.screenshot({ path: `${process.env.SNAP}/${id}.png` })
      const text = k === 'title' ? a[0] : a[1]
      appendFileSync(`${process.env.SNAP}/testi.tsv`, `${id}\t${k}\t${text.replace(/\s+/g, ' ')}\n`)
    }
  }
}
const click0 = r.click.bind(r)
r.click = async (loc, opts) => {
  await r.clear(150)
  await loc
    .first()
    .scrollIntoViewIfNeeded({ timeout: 3000 })
    .catch(() => {})
  return click0(loc, opts)
}

const dialog = () => win.locator('[role="dialog"]').last()
const props = win.locator('aside.properties')
const layers = () => win.locator('.layers').first()
const layer = (n) =>
  win
    .locator('.layers .layer-row')
    .filter({ has: win.locator('.layer-name', { hasText: new RegExp(`^${n}$`) }) })
    .first()
    .locator('.layer-name')
    .first()
const side = (name) => win.locator('.sidebar').getByText(name, { exact: true }).first()
const saveButton = () =>
  win
    .locator('header.toolbar button')
    .filter({ hasText: new RegExp(`^(${T['app.save']}|${T['app.saved']})$`) })
    .first()
const grid = () => win.locator('.card-grid').first()
const cell = (i) => win.locator('.card-grid .card-cell').nth(i)
const form = win.locator('.card-form')
const formField = (col) =>
  form
    .locator('.field')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${col}$`) }) })
    .first()
const previewCard = () => win.locator('aside.preview .preview-card').first()
const problems = () => win.locator('aside.preview .problems').first()
const stage = () => win.locator('.canvas-stage').first()
const source = (kind) =>
  props
    .locator('.source-line .segmented button')
    .filter({
      hasText: new RegExp(
        `^${kind === 'column' ? T['source.short.column'] : T['source.kind.' + kind]}$`
      )
    })
    .first()
const options = () => props.locator('.list-options').first()
const optionText = (i) => options().locator('input.option-text').nth(i)
const td = (row, col) => win.locator(`.data-table td[data-cell="${row}:${col}"]`).first()
const tableTab = () =>
  win.locator('.set-header .segmented button').filter({ hasText: T['set.table'] }).first()
const gridTab = () =>
  win.locator('.set-header .segmented button').filter({ hasText: T['set.grid'] }).first()
const tile = (col, name) =>
  formField(col)
    .locator('.list-tile')
    .filter({ hasText: new RegExp(`^${name}`) })
    .first()
const variantTile = (name) =>
  form
    .locator('.variant-tile')
    .filter({ has: win.locator('.list-tile-name', { hasText: new RegExp(`^${name}$`) }) })
    .first()
const vRow = (name) =>
  dialog()
    .locator('.variants-table tbody tr')
    .filter({ has: win.locator('.variant-name', { hasText: new RegExp(`^${name}$`) }) })
    .first()
const vHead = (name) =>
  dialog().locator('.variants-table thead th').filter({ hasText: name }).first()
const vCol = async (name) => {
  const heads = await dialog().locator('.variants-table thead th').allInnerTexts()
  return heads.findIndex((h) => h.trim().startsWith(name))
}

// al centro del pannello: in alto la barra di ricerca resta ferma e coprirebbe il campo
const center = (loc) =>
  loc
    .first()
    .evaluate((el) => el.scrollIntoView({ block: 'center' }))
    .then(() => r.wait(150))
async function fill(loc, text, { tab = true } = {}) {
  await center(loc)
  await r.click(loc, { after: 250, before: 200, ms: 450 })
  await win.keyboard.press('Control+A')
  await r.type(text)
  if (tab) await win.keyboard.press('Tab')
  await r.wait(400)
}
async function choose(loc, value) {
  await center(loc)
  await r.click(loc, { after: 200, before: 200, ms: 450 })
  await win.keyboard.press('Escape')
  await loc.selectOption(value)
  await r.wait(600)
}
async function key(combo, ms = 700) {
  await r.clear(150)
  await win.keyboard.press(combo)
  await r.wait(ms)
}
async function save() {
  await r.click(saveButton())
  await r.clear(800)
}
async function openSet(name) {
  await r.click(side(name))
  await r.clear(1000)
  await r.overlay()
}
async function openTemplate(name, n = 0) {
  await r.click(side(name))
  await r.clear(1200)
  await r.overlay()
  const sel = win.locator('.preview-data select')
  await sel.first().selectOption({ label: N.knights })
  await r.wait(300)
  await sel.nth(1).selectOption(String(n))
  await r.wait(600)
}
/** zoom sulla carta dell'editor e testo sopra */
async function look(text) {
  await r.clear(100)
  await r.zoom(stage(), { max: 1.6, fill: 0.72 })
  await r.focus(stage(), text, 'above', { pad: 0, dim: false })
  await r.unzoom()
}
/** la carta n del set, con il suo modulo */
async function pick(n) {
  await r.click(cell(n), { after: 700 })
}
async function zoomCard(text) {
  await r.zoom(previewCard(), { max: 1.6, fill: 0.85 })
  await r.focus(previewCard(), text, 'left', { pad: 0, dim: false })
  await r.unzoom()
}
async function bigThumbs(v = 3) {
  await win
    .locator('input.thumb-size')
    .first()
    .evaluate((el, v) => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      set.call(el, String(v))
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, v)
  await r.wait(400)
}
async function editorMenu(key) {
  await r.click(win.locator('.editor-toolbar .more-button').first(), { after: 500 })
  await r.click(win.locator('.menu-panel .menu-item').filter({ hasText: T[key] }).first(), {
    after: 900
  })
}

// ================= apertura
await mockOpen(r.app, dest)
await r.overlay()
await r.title(t('Elenchi e varianti', 'Lists and variants'))
await r.title(
  t(
    'Il progetto «Torneo» si scarica dal link nella descrizione: aprilo e segui passo passo',
    'The “Tournament” project is in the description: open it and follow along'
  )
)
await r.clear()
await r.click(win.getByText(T['start.openProject']).first())
await r.clear(2200)
await r.overlay()
await bigThumbs()
await r.focus(
  grid(),
  t(
    'Sei cavalieri di un torneo: nome, stemma e rango cambiano da carta a carta',
    'Six knights of a tournament: name, crest and rank change from card to card'
  ),
  'left',
  { pad: 4 }
)

// ================= 1. il problema
await r.title(
  t('1 · Il problema: scrivere a mano nomi e colori', '1 · The problem: typing names and colors')
)
await r.clear()
await r.focus(
  [cell(0), cell(1), cell(2)],
  t(
    'Tutte con la stessa cornice d’oro e la stessa banda rossa. Vorremmo cornici e colori diversi',
    'All with the same gold frame and the same red band. We want different frames and colors'
  ),
  'below',
  { pad: 4 }
)
await r.title(
  t(
    'Con una colonna si scrive a mano «argento» o «#1F4E8C» in ogni carta: basta un errore di battitura',
    'With a column you type “silver” or “#1F4E8C” on every card: one typo is enough'
  )
)
await r.title(
  t(
    'Con un Elenco le voci si decidono nel template, e ogni carta sceglie tra quelle',
    'With a List the choices live in the template, and each card picks one of them'
  )
)

// ================= 2. Elenco su un'immagine
await r.title(t('2 · Un elenco di immagini: la cornice', '2 · A list of images: the frame'))
await r.clear()
await openTemplate(N.tKnight, 0)
await r.click(layer(C.frame), { after: 600 })
await r.focus(
  props.locator('.source-line').first(),
  t(
    `La cornice è ${T['source.kind.fixed']}: la stessa immagine su tutte le carte`,
    `The frame is ${T['source.kind.fixed']}: the same image on every card`
  ),
  'left',
  { pad: 4 }
)
await r.click(source('list'), { after: 800 })
await r.focus(
  options(),
  t(
    `${T['source.kind.list']}: le voci tra cui ogni carta sceglie. La prima è l’immagine che c’era già`,
    `${T['source.kind.list']}: the choices each card picks from. The first is the image that was already there`
  ),
  'left',
  { pad: 4 }
)
await choose(options().locator('select').first(), '/' + N.frames)
await r.focus(
  options(),
  t(
    `${T['source.optionsFromFolder']} aggiunge tutte le immagini di una cartella: ecco le quattro cornici`,
    `${T['source.optionsFromFolder']} adds every image of a folder: here are the four frames`
  ),
  'left',
  { pad: 4 }
)
await r.focus(
  options().locator('input[type=radio]').first(),
  t(
    'Il pallino segna la voce di base: vale per le carte che non ne scelgono un’altra',
    'The dot marks the default choice: it applies to the cards that pick no other'
  ),
  'left',
  { pad: 6 }
)
await r.focus(
  options().locator('.option-tools').first(),
  t(
    'Le frecce cambiano l’ordine, ✕ toglie una voce',
    'The arrows change the order, ✕ removes a choice'
  ),
  'left',
  { pad: 4 }
)
await r.focus(
  layer(C.frame),
  t(
    'Nell’elenco dei livelli il simbolo ☰ segna i livelli con un elenco',
    'In the layer list the ☰ symbol marks the layers with a list'
  ),
  'right',
  { pad: 4 }
)

// ================= 3. Elenco su una forma e su un valore
await r.title(t('3 · Un elenco di colori e uno di testi', '3 · A list of colors and one of texts'))
await r.clear()
await r.click(layer(C.band), { after: 600 })
await r.click(source('list'), { after: 800 })
for (const c of ['#1F4E8C', '#2E6B3A']) {
  await r.click(options().getByRole('button', { name: T['source.optionAdd'] }), { after: 500 })
  const n = await options().locator('input.option-text').count()
  await fill(optionText(n - 1), c)
}
await r.focus(
  options(),
  t(
    'Per una forma le voci sono colori: si scrivono, o si scelgono dal campione',
    'For a shape the choices are colors: type them, or pick them from the swatch'
  ),
  'left',
  { pad: 4 }
)
await r.click(layer(C.rank), { after: 600 })
await r.focus(
  props.locator('.source-line').first(),
  t(
    'Il rango è un livello Valore: il testo sotto lo stemma lo mostra con {rango}',
    'The rank is a Value layer: the text below the crest shows it with {rank}'
  ),
  'left',
  { pad: 4 }
)
await r.click(source('list'), { after: 800 })
// il rango del template (Cavaliere) è già la prima voce
for (const v of [N.R[0], N.R[2]]) {
  await r.click(options().getByRole('button', { name: T['source.optionAdd'] }), { after: 500 })
  const n = await options().locator('input.option-text').count()
  await fill(optionText(n - 1), v)
}
await r.focus(
  options(),
  t(
    'Per un testo o un valore le voci sono parole: Scudiero, Cavaliere, Campione',
    'For a text or a value the choices are words: Squire, Knight, Champion'
  ),
  'left',
  { pad: 4 }
)
await save()

// ================= 4. la scelta nella carta e nella tabella
await r.title(t('4 · Ogni carta sceglie la sua voce', '4 · Each card picks its choice'))
await r.clear()
await openSet(N.knights)
await pick(1)
await r.focus(
  formField(C.frame),
  t(
    'Nella scheda della carta le immagini dell’elenco sono miniature: un clic sceglie',
    'In the card form the list images are thumbnails: a click picks one'
  ),
  'left',
  { pad: 4 }
)
await r.click(tile(C.frame, N.F[1]), { after: 800 })
await r.focus(formField(C.band), t('I colori sono campioni', 'Colors are swatches'), 'left', {
  pad: 4
})
await r.click(formField(C.band).locator('.list-tile').nth(1), { after: 800 })
await r.focus(
  formField(C.rank),
  t('Testi e valori si scelgono da una tendina', 'Texts and values are picked from a drop-down'),
  'left',
  { pad: 4 }
)
await zoomCard(t('Cornice d’argento e banda blu', 'Silver frame and blue band'))
await r.focus(
  tile(C.frame, N.F[0]),
  t(
    'La voce «di base» lascia la cella vuota: la carta segue il template',
    'The “default” choice leaves the cell empty: the card follows the template'
  ),
  'left',
  { pad: 6 }
)
await pick(2)
await r.click(tile(C.frame, N.F[2]), { after: 700 })
await r.click(formField(C.band).locator('.list-tile').nth(2), { after: 700 })
await r.click(tableTab(), { after: 900 })
await r.focus(
  td(4, C.rank),
  t(
    `Ser Ottone ha «${N.R[3]}», che non è tra le voci: la cella è segnata`,
    `Sir Otto has “${N.R[3]}”, which is not one of the choices: the cell is marked`
  ),
  'below',
  { pad: 4 }
)
await r.click(td(4, C.name), { after: 500 })
await r.focus(
  problems(),
  t(
    'La carta si disegna lo stesso, e il controllo segnala il valore fuori elenco',
    'The card is still drawn, and the check reports the value outside the list'
  ),
  'left',
  { pad: 4 }
)
await r.click(td(4, C.rank), { after: 300 })
await key('Enter', 600)
await r.focus(
  win.locator('.data-table select.cell-select').first(),
  t(
    'Nella tabella una cella con l’elenco apre una tendina: non si scrive a mano',
    'In the table a cell with a list opens a drop-down: no typing by hand'
  ),
  'below',
  { pad: 4 }
)
await win.locator('.data-table select.cell-select').first().selectOption(N.R[2])
await r.wait(600)
await key('Enter', 600)
await r.focus(
  td(4, C.rank),
  t(`Ora è «${N.R[2]}», e l’avviso sparisce`, `Now it is “${N.R[2]}”, and the warning is gone`),
  'below',
  { pad: 4 }
)
await r.click(gridTab(), { after: 900 })
await save()

// ================= 5. tante voci
await r.title(t('5 · Tante voci: il menu con la ricerca', '5 · Many choices: the menu with search'))
await r.clear()
await openTemplate(N.tKnight, 0)
await r.click(layer(C.crest), { after: 600 })
await r.click(source('list'), { after: 800 })
await choose(options().locator('select').first(), '/' + N.crests)
await r.focus(
  options(),
  t('Dodici stemmi, dalla cartella stemmi', 'Twelve crests, from the crests folder'),
  'left',
  { pad: 4 }
)
await save()
await openSet(N.knights)
await pick(3)
await r.focus(
  formField(C.crest),
  t(
    'Oltre otto voci la scheda mostra la scelta attuale, invece di tutte le miniature',
    'Beyond eight choices the form shows the current choice, instead of every thumbnail'
  ),
  'left',
  { pad: 4 }
)
await r.click(formField(C.crest).locator('.list-current').first(), { after: 700 })
await r.focus(
  formField(C.crest).locator('.list-popover').first(),
  t('Un clic apre il menu con le miniature', 'A click opens the menu with the thumbnails'),
  'left',
  { pad: 4 }
)
await r.type(t('dra', 'dra'))
await r.wait(600)
await r.focus(
  formField(C.crest).locator('.list-popover').first(),
  t(
    'Si cerca per nome; Invio sceglie la prima voce trovata, Esc chiude',
    'Search by name; Enter picks the first match, Esc closes'
  ),
  'left',
  { pad: 4 }
)
await key('Enter', 800)
await zoomCard(t('Dama Ilaria ora ha il drago', 'Lady Ilaria now has the dragon'))
await save()

// ================= 6. le varianti
await r.title(t('6 · Le varianti del template', '6 · Template variants'))
await r.clear()
await r.title(
  t(
    'A volte più livelli cambiano insieme: sfondo e motivo per un’edizione speciale',
    'Sometimes several layers change together: background and pattern for a special edition'
  )
)
await r.clear()
await openTemplate(N.tKnight, 0)
await r.click(win.locator('.editor-toolbar .more-button').first(), { after: 500 })
await r.focus(
  win.locator('.menu-panel .menu-item').filter({ hasText: T['variants.menu'] }).first(),
  t(
    `${T['variants.menu']} è nel menu ⋯ del template, accanto a ${T['inherit.deriveShort']}`,
    `${T['variants.menu']} is in the template’s ⋯ menu, next to ${T['inherit.deriveShort']}`
  ),
  'right',
  { pad: 4 }
)
await r.click(
  win.locator('.menu-panel .menu-item').filter({ hasText: T['variants.menu'] }).first(),
  {
    after: 900
  }
)
await r.focus(
  dialog().locator('.variants-dialog').first(),
  t(
    'La finestra delle varianti: per ora c’è solo il template di base',
    'The variants window: for now only the default template is there'
  ),
  'left',
  { pad: 4 }
)
for (const v of N.V) {
  await fill(dialog().getByPlaceholder(T['variants.newName']), v, { tab: false })
  await r.click(dialog().getByRole('button', { name: T['variants.add'] }), { after: 800 })
}
await r.focus(
  dialog().locator('.variants-table').first(),
  t('Due varianti, per ora uguali al template', 'Two variants, identical to the template for now'),
  'left',
  { pad: 4 }
)
for (const l of [C.bg, C.pattern]) {
  const sel = dialog().locator(`select[title="${T['variants.addColumnHint']}"], select[data-tip="${T['variants.addColumnHint']}"]`).first()
  await r.click(sel, { after: 200 })
  await win.keyboard.press('Escape')
  const id = await sel.evaluate(
    (el, name) => [...el.options].find((o) => o.textContent === name)?.value,
    l
  )
  await sel.selectOption(id)
  await r.wait(700)
}
await r.focus(
  dialog().locator(`select[title="${T['variants.addColumnHint']}"], select[data-tip="${T['variants.addColumnHint']}"]`).first(),
  t(
    `${T['variants.addColumn']} aggiunge una colonna per un livello: qui sfondo e motivo`,
    `${T['variants.addColumn']} adds a column for a layer: here background and pattern`
  ),
  'below',
  { pad: 4 }
)
const bgCol = await vCol(C.bg)
const patCol = await vCol(C.pattern)
const colors = ['#E3E7EE', '#EADCF0']
for (let i = 0; i < N.V.length; i++) {
  const row = vRow(N.V[i])
  await fill(row.locator('td, th').nth(bgCol).locator('input[type=text]').first(), colors[i])
  await r.click(row.locator('td, th').nth(patCol).locator('.option-pick').first(), { after: 900 })
  await r.click(
    dialog().locator(`.asset-tile[title*="${N.P[i]}"], .asset-tile[data-tip*="${N.P[i]}"]`).first(),
    { after: 900 }
  )
}
await r.focus(
  dialog().locator('.variants-table').first(),
  t(
    'Ogni variante cambia sfondo e motivo insieme; le miniature mostrano il risultato',
    'Each variant changes background and pattern together; the thumbnails show the result'
  ),
  'below',
  { pad: 4 }
)
await r.focus(
  vRow(N.V[0]).locator('.variant-tools').first(),
  t(
    'Apri porta la variante nell’editor, per cambiare qualunque altra cosa; ✕ la elimina',
    'Open takes the variant to the editor, to change anything else; ✕ deletes it'
  ),
  'left',
  { pad: 4 }
)
await r.click(dialog().getByRole('button', { name: T['dialog.close'], exact: true }), {
  after: 900
})
await r.focus(
  win.locator('.editor-toolbar .variant-switch').first(),
  t(
    'Nell’editor i nomi del template e delle varianti passano dall’uno all’altro',
    'In the editor the names of the template and its variants switch between them'
  ),
  'below',
  { pad: 4 }
)
await r.focus(
  win.locator('.sidebar .variants-count').first(),
  t(
    'Nella barra laterale il template compare una volta sola, con il numero delle varianti',
    'In the sidebar the template appears once, with the number of its variants'
  ),
  'right',
  { pad: 4 }
)
await save()

// ================= 7. la carta sceglie la variante
await r.title(t('7 · Ogni carta sceglie la sua variante', '7 · Each card picks its variant'))
await r.clear()
await openSet(N.knights)
await pick(1)
await r.focus(
  form.locator('.variant-field').first(),
  t(
    `Il campo ${T['cardForm.variant']} mostra la carta stessa con il template e con ogni variante`,
    `The ${T['cardForm.variant']} field shows the card itself with the template and each variant`
  ),
  'left',
  { pad: 4 }
)
await r.click(variantTile(N.V[1]), { after: 900 })
await zoomCard(
  t(
    'Dama Bianca: variante porpora, con la sua cornice d’argento e la banda blu',
    'Lady Blanche: purple variant, with her silver frame and blue band'
  )
)
await pick(0)
await r.click(variantTile(N.V[0]), { after: 900 })
await r.focus(
  grid(),
  t(
    'Le scelte degli elenchi restano: la variante cambia solo i livelli che non sceglie la carta',
    'The list choices stay: the variant changes only the layers the card does not pick'
  ),
  'left',
  { pad: 4 }
)
await r.title(
  t(
    'La scelta va nella colonna template del foglio: vuota vuol dire il template del set',
    'The choice goes into the sheet’s template column: empty means the set’s template'
  )
)
await save()

// ================= 8. elenco o varianti
await r.title(t('8 · Elenco o varianti?', '8 · List or variants?'))
await r.title(
  t(
    'Elenco: ogni livello si sceglie per conto suo. Cornice, banda e rango si combinano liberamente',
    'List: each layer is picked on its own. Frame, band and rank combine freely'
  )
)
await r.title(
  t(
    'Varianti: più livelli cambiano insieme, e la carta sceglie la combinazione con un clic',
    'Variants: several layers change together, and the card picks the combination with one click'
  )
)

// ================= 9. il pacchetto
await r.title(t('9 · Tutto viaggia con il template', '9 · Everything travels with the template'))
await r.clear()
await openTemplate(N.tKnight, 0)
await r.click(win.locator('.editor-toolbar .more-button').first(), { after: 500 })
await r.focus(
  win.locator('.menu-panel .menu-item').filter({ hasText: T['package.exportMenu'] }).first(),
  t(
    'Il pacchetto del template porta con sé le immagini di tutte le voci e le varianti, anche quelle che nessuna carta usa',
    'The template’s package carries the images of every choice and the variants, even those no card uses'
  ),
  'right',
  { pad: 4 }
)
await key('Escape', 500)

// ================= riepilogo
await r.title(t('Riepilogo', 'Summary'))
await r.title(
  t(
    'Elenco: le voci nel template, miniature, campioni o tendina nella carta, avviso fuori elenco',
    'List: choices in the template, thumbnails, swatches or drop-down in the card, warning outside the list'
  )
)
await r.title(
  t(
    'Varianti: versioni preimpostate del template, scelte carta per carta con le miniature',
    'Variants: preset versions of the template, picked card by card with thumbnails'
  )
)
await r.clear()
const raw = await r.finish()
console.log(raw)
