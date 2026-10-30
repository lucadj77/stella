// Video 25, approfondimento: giocare con il caso (circa 9 minuti, senza voce). Sul progetto «Risorse» di
// progetto-risorse.mjs una carta luogo riceve una griglia 4 × 4 di icone di risorse, riempita in quattro
// modi dal più libero al più controllato: tutto a caso (PICK con {cell.random}), Distribuisci a caso con le
// quantità (DEAL), le caselle vuote e le quantità carta per carta prese dal foglio con quattro livelli Valore.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node --experimental-strip-types --no-warnings scripts/video/caso.mjs it|en
// FAST=1 accorcia attese e scrittura; SNAP=<cartella> salva una schermata dopo ogni testo.
import { docs } from '../guide/lib.mjs'
import { launch, mockOpen } from './lib.mjs'
import { make } from './progetto-risorse.mjs'
const lang = process.argv[2] || 'it'
const it = lang === 'it'
const t = (a, b) => (it ? a : b)
const N = await make(`${docs(lang)}/Stella/${it ? 'Risorse' : 'Resources'}`, lang)
const project = `${docs(lang)}/Stella/${it ? 'Risorse' : 'Resources'}`
const { C, V } = N
const r = await launch({ lang, ...(process.env.UD ? { ud: process.env.UD } : {}) })
const { win, T } = r
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
/** zoom sui campi delle proprietà e delle finestre; sulla tela si torna alla vista intera */
async function zoomTo(locs) {
  const targets = []
  for (const l of [].concat(locs)) {
    const kind = await l
      .first()
      .evaluate((el) => {
        if (el.closest('[role=dialog]')) return el.closest('.field') ? 'field' : ''
        if (el.closest('aside.properties')) return el.closest('.field') ? 'field' : 'el'
        return ''
      })
      .catch(() => '')
    if (!kind) return r.unzoom()
    targets.push(
      kind === 'field' ? l.first().locator('xpath=ancestor::*[contains(@class,"field")][1]') : l
    )
  }
  await r.zoom(targets, { max: 1.8 })
}
const focus0 = r.focus.bind(r)
let snaps = 0
const snap = () =>
  process.env.SNAP
    ? win.screenshot({ path: `${process.env.SNAP}/${String(++snaps).padStart(3, '0')}.png` })
    : null
r.focus = async (locs, ...rest) => {
  await zoomTo(locs)
  const out = await focus0(locs, ...rest)
  await snap()
  return out
}
const title0 = r.title.bind(r)
r.title = async (...a) => {
  await r.unzoom(700)
  const out = await title0(...a)
  await snap()
  return out
}

const props = win.locator('aside.properties')
const stage = () => win.locator('.canvas-stage').first()
const dialog = () => win.locator('[role="dialog"]').last()
const field = (label, scope = props) =>
  scope
    .locator('.field')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${label}$`) }) })
    .locator('input:not([type=range]), textarea, select')
    .first()
const layer = (n) => win.locator('.layers .layer-name', { hasText: new RegExp(`^${n}$`) }).first()
const tool = (key) =>
  win.locator(`button.tool[title="${T[key]}"], button.tool[data-tip="${T[key]}"]`).first()
const side = (name) => win.locator('.sidebar').getByText(name, { exact: true }).first()
const saveButton = () =>
  win
    .locator('header.toolbar button')
    .filter({ hasText: new RegExp(`^(${T['app.save']}|${T['app.saved']})$`) })
    .first()
const button = (key, scope = props) =>
  scope.getByRole('button', { name: T[key], exact: true }).first()
const source = (kind) =>
  props
    .locator('.source-line .segmented button')
    .filter({
      hasText: new RegExp(
        `^${kind === 'column' ? T['source.short.column'] : T['source.kind.' + kind]}$`
      )
    })
    .first()

const center = (loc) =>
  loc
    .first()
    .evaluate((el) => el.scrollIntoView({ block: 'center' }))
    .then(() => r.wait(150))
async function fill(loc, text, { tab = true } = {}) {
  await center(loc)
  await zoomTo(loc)
  await r.click(loc, { after: 250, before: 200, ms: 450 })
  await win.keyboard.press('Control+A')
  await r.type(text)
  if (tab) await win.keyboard.press('Tab')
  await r.wait(400)
}
async function check(loc) {
  await center(loc)
  await zoomTo(loc)
  await r.click(loc, { after: 500, before: 200, ms: 450 })
}
async function place(x, y, w, h) {
  await fill(field(T['prop.w']), String(w))
  await fill(field(T['prop.h']), String(h))
  await fill(field('X'), String(x))
  await fill(field('Y'), String(y))
}
async function look(text, opts = {}) {
  await r.clear(100)
  await r.zoom(stage(), { max: 1.7, fill: 0.72 })
  await focus0(stage(), text, 'above', { pad: 0, dim: false, ...opts })
  await snap()
}
async function open(name) {
  await r.click(side(name))
  await r.clear(1000)
  await r.overlay()
}
async function view(key) {
  const b = win.locator('.set-header .segmented button').filter({ hasText: T[key] }).first()
  await b.scrollIntoViewIfNeeded()
  await r.click(b, { after: 900 })
  // la vista a volte non cambia al primo clic, quando il clic arriva mentre la griglia si ridisegna
  const want = key === 'set.table' ? '.data-table' : '.card-grid'
  if (!(await win.locator(want).first().isVisible())) await r.click(b, { after: 900 })
  await win
    .locator(want)
    .first()
    .waitFor({ timeout: 8000 })
    .catch(async (e) => {
      if (process.env.SHOT) await win.screenshot({ path: process.env.SHOT })
      throw e
    })
}
const cards = () => win.locator('.card-grid').first()
async function lookCards(text) {
  await view('set.grid')
  await r.clear(300)
  await r.focus(cards(), text, 'none', { pad: 4, dim: false })
}

// ---- assistente formule
const sentence = () => dialog().locator('.fx-guided > .fx-sentence').first()
const leaf = (i) => sentence().locator(':scope > .fx-leaf').nth(i)
const picker = () => dialog().locator('.fx-picker').first()
async function card(key) {
  await r.click(dialog().locator('.fx-card').filter({ hasText: T[key] }).first(), { after: 900 })
}
async function applyFx() {
  await r.click(dialog().getByRole('button', { name: T['fx.apply'], exact: true }), {
    after: 1000
  })
}
async function startOver() {
  await r.click(dialog().getByRole('button', { name: T['fx.startOver'], exact: true }), {
    after: 900
  })
}
async function openFx() {
  const fx = props.locator('button.fx-button').first()
  await center(fx)
  await r.click(fx, { after: 1100 })
}
async function tab(key) {
  const b = picker().getByRole('tab', { name: T[key], exact: true })
  if ((await b.getAttribute('aria-selected')) !== 'true') await r.click(b, { after: 500, ms: 400 })
}
/** una voce: la variabile immagine o il campo con quel nome */
async function setItem(i, name, kind = 'fx.tab.variable') {
  await r.click(leaf(i), { after: 600, ms: 450 })
  await tab(kind)
  await r.click(picker().locator('.fx-list button').filter({ hasText: name }).first(), {
    after: 600,
    ms: 450
  })
}
/** quante volte: un numero, un intervallo o niente */
async function setTimes(i, value) {
  await r.click(leaf(i), { after: 600, ms: 450 })
  await tab('fx.tab.number')
  const input = picker().locator('.fx-tab-body input').first()
  await r.click(input, { after: 200, ms: 400 })
  await win.keyboard.press('Control+A')
  if (value) await r.type(value)
  else await win.keyboard.press('Backspace')
  await r.click(picker().getByRole('button', { name: T['fx.use'], exact: true }), { after: 600 })
}
/** una voce vuota: un testo vuoto, dalla scheda Testo sotto Altro… */
async function setEmptyItem(i) {
  await r.click(leaf(i), { after: 600, ms: 450 })
  const text = picker().getByRole('tab', { name: T['fx.tab.text'], exact: true })
  if (!(await text.count())) await r.click(picker().locator('.fx-more').first(), { after: 500 })
  await tab('fx.tab.text')
  const area = picker().locator('.fx-tab-body textarea').first()
  await r.click(area, { after: 200, ms: 400 })
  await win.keyboard.press('Control+A')
  await win.keyboard.press('Backspace')
  await r.click(picker().locator('.fx-tab-body button.primary').first(), { after: 600 })
}
async function addItem() {
  await r.click(sentence().locator('.fx-add').first(), { after: 600, ms: 450 })
}
const result = () => dialog().locator('.fx-result-box').first()

const IMG = T['layerName.image']
const ICONS = [V.coin, V.wood, V.stone, V.wheat]

// ================= inizio
await r.overlay()
await r.title(t('Giocare con il caso', 'Playing with chance'))
await r.title(
  t(
    'Una griglia di risorse su ogni carta, riempita in quattro modi: dal più libero al più controllato',
    'A grid of resources on every card, filled in four ways: from the freest to the most controlled'
  ),
  5600
)
await r.clear()
await mockOpen(r.app, project)
await r.click(win.getByText(T['start.openProject']))
await r.clear(2200)
await r.overlay()

// ---- 1. il mazzo
await r.title(t('Il mazzo', 'The deck'))
await r.clear()
await open(N.tCard)
await look(
  t(
    'Una carta luogo: il nome in alto, sotto c’è posto per le risorse',
    'A place card: the name at the top, room for the resources below'
  )
)
await r.click(tool('tool.grid'))
await r.clear(600)
await fill(field(T['prop.name']), N.grid)
await fill(field(T['prop.rows']), '4')
await fill(field(T['prop.columns']), '4')
await check(field(T['prop.autoSize']))
await fill(field(T['prop.cellWidth']), '12')
await fill(field(T['prop.cellHeight']), '12')
await fill(field('X'), '6')
await fill(field('Y'), '26')
await r.focus(
  field(T['prop.cellWidth']),
  t('Griglia 4 × 4, casella fissa di 12 mm', '4 × 4 grid, fixed 12 mm cells'),
  'left'
)
const insert = button('editor.gridContentInsert')
await center(insert)
await r.click(insert, { after: 900 })
await r.click(dialog().locator('.cell-content-choices button').nth(1), { after: 800 })
await r.focus(
  dialog().locator('.cell-content-list').last(),
  t(
    'Forma o immagine: le icone del progetto sono variabili immagine',
    'Shape or image: the project’s icons are image variables'
  ),
  'right',
  { pad: 4 }
)
await r.click(
  dialog().locator('.cell-content-list button').filter({ hasText: `{${V.coin}}` }).first(),
  { after: 1200 }
)
await look(t('Una moneta in ogni casella', 'A coin in every cell'))

// ---- 2. tutto a caso
await r.title(t('Tutto a caso', 'All random'))
await r.clear()
await r.click(layer(IMG), { after: 700 })
await openFx()
await card('fx.card.random')
for (let i = 0; i < ICONS.length; i++) {
  if (i >= 2) await addItem()
  await setItem(i, ICONS[i])
}
await r.focus(
  sentence(),
  t(
    'Scegli a caso: in ogni casella una delle quattro icone',
    'Pick at random: one of the four icons in every cell'
  ),
  'below'
)
await applyFx()
await look(t('Ogni casella ha la sua icona, scelta a caso', 'Every cell gets its own icon, picked at random'))
await r.click(saveButton(), { after: 600 })
await open(N.places)
await lookCards(
  t(
    'Le 12 carte: ognuna è diversa, e resta uguale a ogni esportazione',
    'The 12 cards: each one is different, and stays the same at every export'
  )
)
await r.title(
  t(
    'Il limite: su una carta possono uscire 9 monete e un solo grano',
    'The catch: one card might get 9 coins and a single wheat'
  ),
  4600
)
await r.clear()

// ---- 3. a caso, con le quantità
await r.title(t('A caso, con le quantità', 'At random, with quantities'))
await r.clear()
await open(N.tCard)
await r.click(layer(IMG), { after: 700 })
await openFx()
await startOver()
await card('fx.card.deal')
await addItem()
await addItem()
for (let i = 0; i < ICONS.length; i++) {
  await setItem(2 * i, ICONS[i])
  await setTimes(2 * i + 1, '4')
}
await r.focus(
  sentence(),
  t(
    'Distribuisci a caso: ogni icona 4 volte, in posti diversi',
    'Deal at random: each icon 4 times, in different places'
  ),
  'below'
)
await applyFx()
await look(t('4 monete, 4 legni, 4 pietre, 4 grani', '4 coins, 4 logs, 4 stones, 4 wheat'))
await open(N.places)
await lookCards(
  t(
    'Tutte le carte hanno le stesse risorse, in posti diversi',
    'Every card has the same resources, in different places'
  )
)

async function deal(times, text, cardsText) {
  await open(N.tCard)
  await r.click(layer(IMG), { after: 700 })
  await openFx()
  for (let i = 0; i < times.length; i++) await setTimes(2 * i + 1, times[i])
  await r.focus(result(), text, 'above', { pad: 4 })
  await applyFx()
  await look(text)
  await open(N.places)
  await lookCards(cardsText)
}
await deal(
  ['5', '3', '', ''],
  t(
    'Moneta 5, legno 3, pietra e grano vuoti: quante ne servono a riempire',
    'Coin 5, wood 3, stone and wheat empty: as many as it takes to fill'
  ),
  t(
    'Su ogni carta 5 monete e 3 legni; pietre e grani cambiano da carta a carta',
    'On every card 5 coins and 3 logs; stones and wheat change from card to card'
  )
)
await deal(
  ['2-4', '3-', '', '-2'],
  t(
    'Moneta da 2 a 4, legno almeno 3, grano al massimo 2, la pietra riempie',
    'Coin 2 to 4, wood at least 3, wheat at most 2, stone fills the rest'
  ),
  t(
    'Ogni carta pesca quantità diverse dentro i limiti',
    'Every card draws different amounts within the limits'
  )
)
await r.title(
  t(
    'Un numero, un intervallo come 3-5, 3- (almeno), -5 (al massimo), o vuoto',
    'A number, a range like 3-5, 3- (at least), -5 (at most), or empty'
  ),
  5000
)
await r.clear()

// ---- 4. le caselle vuote
await r.title(t('Le caselle vuote', 'Empty cells'))
await r.clear()
await deal(
  ['3', '3', '2', '0'],
  t(
    'Moneta 3, legno 3, pietra 2, grano 0: le 8 caselle che restano sono vuote, sparse a caso',
    'Coin 3, wood 3, stone 2, wheat 0: the 8 cells left over are empty, scattered at random'
  ),
  t(
    'Su ogni carta 8 caselle vuote, in posti diversi',
    'On every card 8 empty cells, in different places'
  )
)
await open(N.tCard)
await r.click(layer(IMG), { after: 700 })
await openFx()
await addItem()
// la voce vuota: si lascia vuota, e le si dà una quantità sua
await setEmptyItem(8)
await setTimes(9, '4-6')
await setTimes(7, '')
await r.focus(
  sentence(),
  t(
    'Una voce vuota con la sua quantità, da 4 a 6: le caselle vuote cambiano da carta a carta',
    'An empty item with its own quantity, 4 to 6: the empty cells change from card to card'
  ),
  'below'
)
await applyFx()
await open(N.places)
await lookCards(
  t('Ogni carta ha da 4 a 6 caselle vuote', 'Every card has 4 to 6 empty cells')
)

// ---- 5. le quantità carta per carta
await r.title(t('Le quantità carta per carta', 'Quantities card by card'))
await r.title(
  t(
    'Ogni luogo ha le sue risorse: le quantità vengono dal foglio',
    'Every place has its own resources: the quantities come from the sheet'
  ),
  4400
)
await r.clear()
await open(N.tCard)
await r.click(layer(C.name), { after: 600 })
for (const name of [C.coins, C.wood, C.stone, C.wheat]) {
  await r.click(tool('tool.value'))
  await r.clear(500)
  await fill(field(T['prop.name']), name)
}
await r.focus(
  win.locator('aside.layers .layers-list').first(),
  t(
    `Quattro livelli Valore: ${C.coins}, ${C.wood}, ${C.stone}, ${C.wheat}. Non si disegnano, prendono il numero dal foglio`,
    `Four Value layers: ${C.coins}, ${C.wood}, ${C.stone}, ${C.wheat}. They are not drawn, they read the number from the sheet`
  ),
  'right',
  { pad: 4 }
)
await r.click(layer(IMG), { after: 700 })
await openFx()
// via la voce vuota: si torna alle quattro icone
await startOver()
await card('fx.card.deal')
await addItem()
await addItem()
const fields = [C.coins, C.wood, C.stone, C.wheat]
for (let i = 0; i < ICONS.length; i++) {
  await setItem(2 * i, ICONS[i])
  await setItem(2 * i + 1, fields[i], 'fx.tab.field')
}
await r.focus(
  sentence(),
  t(
    `Al posto dei numeri, i campi: {${C.coins}}, {${C.wood}}…`,
    `Fields instead of numbers: {${C.coins}}, {${C.wood}}…`
  ),
  'below'
)
await applyFx()
await r.click(saveButton(), { after: 600 })
await open(N.places)
await view('set.table')
await r.focus(
  win.locator('.data-table').first(),
  t(
    'Nel foglio, per ogni luogo, numeri e intervalli diversi',
    'In the sheet, different numbers and ranges for every place'
  ),
  'right',
  { pad: 4 }
)
await lookCards(
  t(
    'La Miniera ha 6 pietre, la Fattoria da 5 a 7 grani, il Mercato 4 monete e il resto a caso',
    'The Mine has 6 stones, the Farm 5 to 7 wheat, the Market 4 coins and the rest at random'
  )
)
// si cambia un valore nel foglio: la carta si aggiorna subito
await view('set.table')
const td = (row, col) => win.locator(`.data-table td[data-cell="${row}:${col}"]`).first()
const cell = td(0, C.coins)
await cell.scrollIntoViewIfNeeded()
const b = await cell.boundingBox()
await r.glide(b.x + b.width / 2, b.y + b.height / 2, 600)
await win.mouse.dblclick(r.cx, r.cy)
await r.wait(400)
await win.keyboard.press('Control+A')
await r.type('6')
await win.keyboard.press('Enter')
await r.wait(500)
await win.keyboard.press('ArrowUp')
await r.wait(800)
await lookCards(
  t('Miniera: 6 monete invece di 2, e la carta cambia subito', 'Mine: 6 coins instead of 2, and the card changes at once')
)
await r.title(
  t(
    'Una cella vuota vuol dire «quante servono». Per non avere una risorsa si scrive 0',
    'An empty cell means “as many as needed”. To have none of a resource, write 0'
  ),
  5200
)
await r.clear()
await r.click(saveButton(), { after: 600 })

// ---- chiusura
await r.title(
  t(
    'Le stesse formule valgono per i tabelloni (video 24) e per i segnalini',
    'The same formulas work for game boards (video 24) and tokens'
  ),
  4600
)
await r.title(
  t(
    'E per creare le righe del set a caso c’è Genera: video 16',
    'And to create the set’s rows at random there is Generate: video 16'
  ),
  4400
)
await r.title(
  t('Il progetto si scarica dal sito: stella.lucadj.eu', 'Download the project from the site: stella.lucadj.eu'),
  4000
)
await r.clear(600)
console.log('VIDEO', await r.finish())
