// Video 18: lavorare più veloce (circa 5 minuti, senza voce), sul progetto di esempio. Le scorciatoie
// dell'editor (T, R, E, duplica, frecce, raggruppa, Alt+clic, blocco), i gesti sulla tela con ⇧, ⌘ / Ctrl
// e Alt, copiare livelli tra template, e nel set PagSu / PagGiù, ⌘A / Ctrl+A, il doppio clic sulla
// carta e i suggerimenti di {; infine F1. Le scorciatoie si scrivono sempre nelle due forme.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node --experimental-strip-types --no-warnings scripts/video/veloce.mjs it|en
// FAST=1 accorcia attese e scrittura; GUIDE_HOME=/tmp/prova per provarlo mentre un altro video si registra.
import { launch, makeProject, mockOpen } from './lib.mjs'
const lang = process.argv[2] || 'it'
const it = lang === 'it'
const t = (a, b) => (it ? a : b)
const project = makeProject(lang)
const r = await launch({ lang, ...(process.env.UD ? { ud: process.env.UD } : {}) })
const { app, win, T } = r
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
const S = it
  ? {
      item: 'oggetto',
      character: 'personaggio',
      chars: 'Personaggi',
      cost: 'costo',
      frame: 'riquadro',
      name: 'nome',
      text: 'testo'
    }
  : {
      item: 'item',
      character: 'character',
      chars: 'Characters',
      cost: 'cost',
      frame: 'panel',
      name: 'name',
      text: 'text'
    }

const dialog = () => win.locator('[role="dialog"]').last()
const side = (name) => win.locator('.sidebar').getByText(name, { exact: true }).first()
const props = win.locator('aside.properties')
const field = (label) =>
  props
    .locator('.field')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${label}$`) }) })
    .locator('input:not([type=range]), textarea, select')
    .first()
const layers = () => win.locator('.layers').first()
const row = (i) => win.locator('.layers .layer-row').nth(i)
const layerRow = (n) =>
  win
    .locator('.layers .layer-row')
    .filter({ has: win.locator('.layer-name', { hasText: new RegExp(`^${n}$`) }) })
    .first()
const canvas = () => win.locator('.canvas-viewport').first()
const grid = () => win.locator('.card-grid').first()
const cell = (i) => grid().locator('.card-cell').nth(i)
const form = win.locator('.card-form')
const cardField = (col) =>
  form
    .locator('label')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${col}$`) }) })
    .locator('input, textarea')
    .first()
const previewCard = () => win.locator('.preview-card').first()

async function zoomTo(locs) {
  const targets = []
  for (const l of [].concat(locs)) {
    const kind = await l
      .first()
      .evaluate((el) => {
        if (el.closest('[role=dialog]')) return 'el'
        if (el.closest('.card-form')) return 'label'
        if (el.closest('aside.properties')) return 'el'
        if (el.closest('.layers')) return 'el'
        return ''
      })
      .catch(() => '')
    if (!kind) return r.unzoom()
    targets.push(kind === 'label' ? l.first().locator('xpath=ancestor-or-self::label[1]') : l)
  }
  await r.zoom(targets, { max: 1.6 })
}
const focus0 = r.focus.bind(r)
/** focus con lo zoom; wide: true lascia la vista intera */
r.focus = async (locs, text, sideArg, opts = {}) => {
  if (opts.wide) await r.unzoom()
  else await zoomTo(locs)
  return focus0(locs, text, sideArg, opts)
}
const title0 = r.title.bind(r)
r.title = async (...a) => {
  await r.unzoom(700)
  return title0(...a)
}
async function key(combo, ms = 700) {
  await r.clear(150)
  await win.keyboard.press(combo)
  await r.wait(ms)
}
/** un clic con un tasto premuto */
async function clickWith(loc, mod) {
  await r.clear(150)
  const b = await loc.first().boundingBox()
  await r.glide(b.x + b.width / 2, b.y + b.height / 2, 600)
  await r.wait(300)
  await win.keyboard.down(mod)
  await win.mouse.click(r.cx, r.cy)
  await win.keyboard.up(mod)
  await r.wait(800)
}
async function clickAt(p, mod) {
  await r.clear(150)
  await r.glide(p.x, p.y, 600)
  await r.wait(300)
  if (mod) await win.keyboard.down(mod)
  await win.mouse.click(p.x, p.y)
  if (mod) await win.keyboard.up(mod)
  await r.wait(800)
}
/** trascina lentamente, con un tasto tenuto premuto */
async function drag(from, to, mod, ms = 1300) {
  await r.clear(150)
  await r.glide(from.x, from.y, 600)
  await r.wait(300)
  // il tasto dopo aver premuto: ⇧ al clic cambierebbe la selezione
  await win.mouse.down()
  if (mod) await win.keyboard.down(mod)
  await r.glide(to.x, to.y, ms)
  await r.wait(300)
  await win.mouse.up()
  if (mod) await win.keyboard.up(mod)
  await r.wait(800)
}
/** il riquadro della selezione sulla tela, dalle maniglie */
async function selBox() {
  const boxes = await win
    .locator('.canvas-overlay .handle:not(.rotate):not(.line-end)')
    .evaluateAll((els) =>
      els.map((e) => {
        const b = e.getBoundingClientRect()
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
      })
    )
  const xs = boxes.map((b) => b.x)
  const ys = boxes.map((b) => b.y)
  const x0 = Math.min(...xs)
  const y0 = Math.min(...ys)
  const x1 = Math.max(...xs)
  const y1 = Math.max(...ys)
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }
}
const handle = async (cls) => {
  const b = await win.locator(`.canvas-overlay .handle.${cls}`).first().boundingBox()
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}
/** un riquadro senza elemento: un rettangolo della finestra */
async function focusBox(box, text, sideArg = 'right') {
  await win.evaluate((b) => {
    let d = document.getElementById('v-anchor')
    if (!d) {
      d = document.createElement('div')
      d.id = 'v-anchor'
      d.style.position = 'fixed'
      d.style.pointerEvents = 'none'
      document.body.appendChild(d)
    }
    Object.assign(d.style, { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px' })
  }, box)
  await focus0(win.locator('#v-anchor'), text, sideArg, { pad: 10, dim: false })
}

// ---- apertura
await r.overlay()
await r.title(t('Lavorare più veloce', 'Working faster'))
await r.title(
  t(
    'Scorciatoie e gesti per il lavoro di tutti i giorni, su Mac e su Windows',
    'Shortcuts and gestures for everyday work, on Mac and on Windows'
  )
)
await r.clear()
await mockOpen(app, project)
await r.click(win.getByText(T['start.openProject']))
await r.clear(2200)
await r.overlay()

// ---- 1. nell'editor
await r.title(t('Nell’editor dei template', 'In the template editor'))
await r.click(side(S.item))
await r.clear(1400)
await r.overlay()
await clickAt(await (async () => {
  const b = await canvas().boundingBox()
  return { x: b.x + 30, y: b.y + b.height - 30 }
})())
await key('e', 1000)
// una moneta piccola e dorata, invece del cerchio grigio
async function setField(loc, text) {
  await loc.scrollIntoViewIfNeeded()
  await r.click(loc, { after: 200, before: 150, ms: 400 })
  await win.keyboard.press('Control+A')
  await r.type(text)
  await win.keyboard.press('Tab')
  await r.wait(250)
}
const fillHex = props.locator('input.color-text').first()
await setField(fillHex, '#C9A227')
await setField(field(T['prop.w']), '9')
await setField(field(T['prop.h']), '9')
await setField(field('X'), '6')
await setField(field('Y'), '40')
await r.click(row(0), { after: 500 })
await r.focus(
  [layers(), win.locator('.canvas-overlay').first()],
  t(
    'E: un’ellisse nuova. T fa un testo, R un rettangolo',
    'E: a new ellipse. T makes a text, R a rectangle'
  ),
  'right',
  { pad: 4, wide: true }
)
await key('Control+D', 900)
await key('Control+D', 900)
await r.focus(
  layers(),
  t('⌘D / Ctrl+D duplica: tre ellissi', '⌘D / Ctrl+D duplicates: three ellipses'),
  'right',
  { pad: 4 }
)
for (let i = 0; i < 6; i++) await key('ArrowRight', 250)
await r.focus(
  field('X'),
  t('Le frecce spostano di 0,5 mm…', 'The arrow keys move by 0.5 mm…'),
  'left',
  { pad: 4 }
)
for (let i = 0; i < 2; i++) await key('Shift+ArrowDown', 400)
await r.focus(
  field('Y'),
  t('…e con ⇧ / Maiuscolo di 5 mm', '…and with ⇧ / Shift by 5 mm'),
  'left',
  { pad: 4 }
)
// le tre ellissi sono in cima all'elenco dei livelli
await r.click(row(0), { after: 500 })
await clickWith(row(2), 'Shift')
await key('Control+G', 1000)
await r.focus(
  layers(),
  t(
    '⇧-clic nell’elenco ne prende più di uno; ⌘G / Ctrl+G li raggruppa',
    '⇧-click in the list picks several; ⌘G / Ctrl+G groups them'
  ),
  'right',
  { pad: 4 }
)
// Alt+clic: il livello sotto quello in cima
await r.click(layerRow(S.cost), { after: 600 })
const costBox = await selBox()
await clickAt({ x: costBox.cx, y: costBox.cy })
await r.focus(
  layers(),
  t(
    'Un clic sulla carta prende il livello in cima: il testo del costo',
    'A click on the card picks the top layer: the cost text'
  ),
  'right',
  { pad: 4 }
)
await clickAt({ x: costBox.cx, y: costBox.cy }, 'Alt')
await r.focus(
  layers(),
  t(
    'Alt+clic prende quello sotto: il cerchio dietro il costo',
    'Alt+click picks the one below: the circle behind the cost'
  ),
  'right',
  { pad: 4 }
)
const lock = layerRow(S.frame).locator(`button[title="${T['layers.lock']}"]`).first()
await layerRow(S.frame).hover()
await r.click(lock, { after: 700 })
await r.focus(
  layerRow(S.frame),
  t(
    'Il lucchetto: un livello bloccato non si sposta e non si prende per sbaglio sulla carta',
    'The padlock: a locked layer does not move and is not picked by mistake on the card'
  ),
  'right',
  { pad: 4 }
)

// ---- 2. sulla tela
await r.title(t('Sulla tela', 'On the canvas'))
await r.click(row(0), { after: 700 })
let g = await selBox()
// si prende la prima moneta, in alto a sinistra: al centro del gruppo c'è l'immagine
{
  const p0 = { x: g.x + g.w * 0.22, y: g.y + g.h * 0.22 }
  await drag(p0, { x: p0.x + 40, y: p0.y - 150 }, 'Shift')
}
g = await selBox()
await focusBox(
  { x: g.x, y: g.y, w: g.w, h: g.h },
  t(
    'Trascinando con ⇧ / Maiuscolo si va dritti: in orizzontale, in verticale o a 45°',
    'Dragging with ⇧ / Shift goes straight: horizontal, vertical or 45°'
  )
)
const rot = await handle('rotate')
await drag(rot, { x: rot.x + 90, y: rot.y + 40 }, 'Shift')
g = await selBox()
await focusBox(
  { x: g.x, y: g.y, w: g.w, h: g.h },
  t('Ruotando con ⇧ / Maiuscolo: scatti di 15°', 'Rotating with ⇧ / Shift: steps of 15°')
)
await key('Control+Z', 900)
const se = await handle('h-se')
await drag(se, { x: se.x + 40, y: se.y + 30 }, 'Control')
g = await selBox()
await focusBox(
  { x: g.x, y: g.y, w: g.w, h: g.h },
  t(
    'Ridimensionando con ⌘ / Ctrl si cresce dal centro. Alt sposta senza agganciarsi',
    'Resizing with ⌘ / Ctrl grows from the center. Alt moves without snapping'
  )
)
{
  const b = await canvas().boundingBox()
  await r.clear(150)
  await r.glide(b.x + b.width / 2, b.y + b.height / 2, 600)
  await win.keyboard.down('Control')
  for (let i = 0; i < 5; i++) {
    await win.mouse.wheel(0, -120)
    await r.wait(160)
  }
  await win.keyboard.up('Control')
  await r.wait(700)
  await focusBox(
    { x: b.x + 20, y: b.y + 20, w: b.width - 40, h: b.height - 40 },
    t('⌘ / Ctrl + rotella: zoom sulla tela', '⌘ / Ctrl + wheel: zoom on the canvas'),
    'none'
  )
  await r.clear(150)
  await win.keyboard.down('Control')
  for (let i = 0; i < 5; i++) {
    await win.mouse.wheel(0, 120)
    await r.wait(160)
  }
  await win.keyboard.up('Control')
  await r.wait(700)
}

// ---- 3. tra template
await r.title(t('Copiare livelli tra template', 'Copying layers between templates'))
await r.click(row(0), { after: 500 })
await key('Control+C', 700)
await r.focus(
  row(0),
  t('⌘C / Ctrl+C copia il gruppo…', '⌘C / Ctrl+C copies the group…'),
  'right',
  { pad: 4 }
)
await r.click(side(S.character))
await r.clear(1400)
await r.overlay()
await clickAt(await (async () => {
  const b = await canvas().boundingBox()
  return { x: b.x + 30, y: b.y + b.height - 30 }
})())
await key('Control+V', 1200)
await r.focus(
  [layers(), win.locator('.canvas-overlay').first()],
  t(
    '…e ⌘V / Ctrl+V lo incolla in un altro template, con tutte le sue proprietà',
    '…and ⌘V / Ctrl+V pastes it into another template, with all its properties'
  ),
  'right',
  { pad: 4, wide: true }
)
await key('Control+Z', 900)

// ---- 4. nel set
await r.title(t('Nel set', 'In the set'))
await r.click(side(S.chars))
await r.clear(1200)
await r.overlay()
const gridBtn = win.locator('.set-header .segmented button').filter({ hasText: T['set.grid'] }).first()
if (await gridBtn.isVisible().catch(() => false)) await r.click(gridBtn, { after: 700 })
await r.click(cell(0), { after: 600 })
await r.click(cardField(S.name), { after: 500 })
await r.focus(
  cardField(S.name),
  t('Si scrive nel modulo della carta…', 'You type in the card form…'),
  'left',
  { pad: 4 }
)
for (let i = 0; i < 3; i++) await key('PageDown', 1100)
await r.focus(
  [cardField(S.name), grid()],
  t(
    '…e PagGiù / PagSu passa alla carta dopo o prima, senza lasciare il campo',
    '…and PgDn / PgUp moves to the next or previous card, without leaving the field'
  ),
  'left',
  { pad: 4, wide: true }
)
await r.click(cell(0), { after: 600 })
await key('Control+A', 1000)
await r.focus(
  [grid(), form],
  t(
    '⌘A / Ctrl+A seleziona tutte le carte: ciò che scrivi nel modulo va in tutte. Esc torna a una',
    '⌘A / Ctrl+A selects all the cards: what you type in the form goes into all of them. Esc goes back to one'
  ),
  'left',
  { pad: 4, wide: true }
)
await key('Escape', 800)
// doppio clic sul testo della carta
{
  const b = await previewCard().boundingBox()
  const p = { x: b.x + b.width / 2, y: b.y + b.height * 0.08 }
  await r.clear(150)
  await r.glide(p.x, p.y, 600)
  await r.wait(300)
  await win.mouse.dblclick(p.x, p.y)
  await r.wait(900)
  await win.keyboard.press('Control+A')
  await r.type(t('Paladino', 'Paladin'))
  await r.wait(500)
  await r.focus(
    previewCard(),
    t(
      'Doppio clic su un testo della carta: si corregge lì. Ctrl+Invio o un clic fuori per chiudere',
      'Double-click a text on the card: fix it right there. Ctrl+Enter or a click outside to close'
    ),
    'left',
    { pad: 4, wide: true }
  )
  await key('Control+Enter', 900)
}
const text = cardField(S.text)
await text.scrollIntoViewIfNeeded()
await r.click(text, { after: 400 })
await win.keyboard.press('Control+End')
await r.type(' {')
await r.wait(900)
await r.focus(
  [text, win.locator('.markup-help').first()],
  t(
    'Scrivendo { compaiono campi, variabili e icone: ↑ ↓ per scegliere, Invio per inserire',
    'Typing { shows fields, variables and icons: ↑ ↓ to choose, Enter to insert'
  ),
  'left',
  { pad: 4, wide: true }
)
await key('ArrowDown', 500)
await key('ArrowDown', 500)
await key('Enter', 1000)
await r.click(cell(1), { after: 600 })

// ---- 5. aiuto
await r.title(t('Tutte le scorciatoie', 'All the shortcuts'))
await key('F1', 1200)
await r.click(dialog().getByRole('button', { name: T['help.tab.keys'], exact: true }), { after: 900 })
await r.focus(
  dialog(),
  t(
    'F1 apre l’aiuto: la scheda Scorciatoie le elenca tutte, con Ctrl su Windows e Linux',
    'F1 opens the help: the Shortcuts tab lists them all, with Ctrl on Windows and Linux'
  ),
  'left',
  { pad: 0, dim: false, wide: true }
)
await key('Escape', 700)

// ---- chiusura
await r.clear()
await r.title(
  t(
    'Tutto il resto è nella guida: stella.lucadj.eu',
    'Everything else is in the guide: stella.lucadj.eu'
  ),
  3800
)
await r.clear(600)
const p = await r.finish()
console.log('VIDEO', p)
