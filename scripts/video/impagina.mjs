// Video 26, sesto approfondimento: impaginare un template. Circa 14 minuti senza voce, sul progetto
// «Locanda» di progetto-locanda.mjs, che chi guarda scarica dal sito. Capitoli: misure e unità; spostare
// con precisione; allineare e distribuire; i gruppi; Disponi i figli e Ripeti; cambiare formato con i
// vincoli; il retro; i template derivati; copiare tra template.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node --experimental-strip-types --no-warnings scripts/video/impagina.mjs it|en
// FAST=1 accorcia attese e scrittura; SHOT=<file.png> salva la schermata se un elemento non si trova;
// SNAP=<cartella> salva una schermata dopo ogni testo, e i testi in testi.tsv (per lo storyboard).
import { appendFileSync } from 'node:fs'
import { launch, mockOpen } from './lib.mjs'
import { docs } from '../guide/lib.mjs'
import { make, names } from './progetto-locanda.mjs'
const lang = process.argv[2] || 'it'
const it = lang === 'it'
const t = (a, b) => (it ? a : b)
const N = names(lang)
const { C, I } = N
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
      const text = String(k === 'title' ? a[0] : a[1]).replace(/\s+/g, ' ')
      appendFileSync(`${process.env.SNAP}/testi.tsv`, `${id}\t${k}\t${text}\n`)
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
const prow = (label, scope = props) =>
  scope
    .locator('.field')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${label}$`) }) })
    .first()
const field = (label, scope = props) =>
  prow(label, scope)
    .locator('input:not([type=range]):not([type=checkbox]), textarea, select')
    .first()
const checkbox = (label, scope = props) =>
  prow(label, scope).locator('input[type=checkbox]').first()
const colorField = (label, scope = props) => prow(label, scope).locator('input.color-text').first()
const layers = () => win.locator('.layers').first()
const layerRow = (n) =>
  win
    .locator('.layers .layer-row')
    .filter({ has: win.locator('.layer-name', { hasText: new RegExp(`^${n}$`) }) })
    .first()
const layer = (n) => layerRow(n).locator('.layer-name').first()
const tool = (key) =>
  win.locator(`button.tool[title="${T[key]}"], button.tool[data-tip="${T[key]}"]`).first()
const titled = (key) => win.locator(`[title="${T[key]}"], [data-tip="${T[key]}"]`).first()
const side = (name) => win.locator('.sidebar').getByText(name, { exact: true }).first()
const saveButton = () =>
  win
    .locator('header.toolbar button')
    .filter({ hasText: new RegExp(`^(${T['app.save']}|${T['app.saved']})$`) })
    .first()
const grid = () => win.locator('.card-grid').first()
const stage = () => win.locator('.canvas-stage').first()
const sourceLine = () => props.locator('.source-line').first()

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
async function check(loc) {
  await center(loc)
  await r.click(loc, { after: 500, before: 200, ms: 450 })
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
/** apre un template e mostra i dati della riga n del suo set */
async function openTemplate(name, set, n = 0) {
  await r.click(side(name))
  await r.clear(1200)
  await r.overlay()
  if (set) await previewRow(set, n)
}
async function previewRow(set, n) {
  const sel = win.locator('.preview-data select')
  if (process.env.SHOT)
    await sel
      .first()
      .selectOption({ label: set }, { timeout: 5000 })
      .catch(async (e) => {
        await win.screenshot({ path: process.env.SHOT })
        throw e
      })
  await sel.first().selectOption({ label: set })
  await r.wait(300)
  await sel.nth(1).selectOption(String(n))
  await r.wait(600)
}
async function face(key) {
  await r.click(
    win
      .locator('main button, .editor button')
      .filter({ hasText: new RegExp(`^${T[key]}$`) })
      .first(),
    { after: 700 }
  )
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
  await r.wait(700)
}
/** seleziona più livelli nell'elenco: il primo con un clic, gli altri con ⇧ */
async function selectLayers(...ns) {
  await r.click(layer(ns[0]), { after: 400 })
  for (const n of ns.slice(1)) await clickWith(layer(n), 'Shift')
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
/** zoom sulla carta e testo sopra */
async function look(text) {
  await r.clear(100)
  await r.zoom(stage(), { max: 1.6, fill: 0.72 })
  await r.focus(stage(), text, 'above', { pad: 0, dim: false })
}
/** testo accanto alla carta, senza zoom */
async function onStage(text, sideOf = 'left') {
  await r.focus(stage(), text, sideOf, { pad: 0, dim: false })
}
async function arrange(key) {
  await r.click(props.locator(`button[title="${T[key]}"], button[data-tip="${T[key]}"]`).first(), {
    after: 700
  })
}
/** un clic sulla tela fuori dal componente: nessun livello selezionato, il pannello mostra il template */
async function deselect() {
  const b = await win.locator('.canvas-viewport').first().boundingBox()
  await clickAt({ x: b.x + 25, y: b.y + 25 })
}
/** cerca nelle proprietà: restano le voci che contengono il testo */
async function search(text) {
  await key('Control+F', 400)
  await r.type(text)
  await r.wait(700)
}
async function clearSearch() {
  const box = props.locator(`input[placeholder="${T['editor.searchProperties']}"]`).first()
  await box.click()
  await win.keyboard.press('Control+A')
  await win.keyboard.press('Delete')
  await key('Escape', 400)
}
const eye = (n) =>
  layerRow(n)
    .locator(
      ['layers.hide', 'layers.show']
        .map((k) => `button[title="${T[k]}"], button[data-tip="${T[k]}"]`)
        .join(', ')
    )
    .first()

/** una forma dal menu Forme: entra sopra al livello selezionato, anche dentro un gruppo */
async function shape(kind) {
  const menu = win.locator(
    `.menu-button[title="${T['tool.shapes']}"], .menu-button[data-tip="${T['tool.shapes']}"]`
  )
  await r.click(menu.first(), { after: 500 })
  await r.click(win.locator('.menu-panel .menu-item').filter({ hasText: T[kind] }).first(), {
    after: 600
  })
  await r.clear(400)
}

// ================= apertura
await mockOpen(r.app, dest)
await r.overlay()
await r.title(t('Impaginare un template', 'Laying out a template'))
await r.title(
  t(
    'Il progetto «Locanda» si scarica dal link nella descrizione: aprilo e segui passo passo',
    'The “Tavern” project is in the description: open it and follow along'
  )
)
await r.clear()
await r.click(win.getByText(T['start.openProject']).first())
await r.clear(2200)
await r.overlay()
await r.focus(
  grid(),
  t(
    'Cinque avventori, e tre nobili in un altro set: i dati ci sono, ma la carta è impaginata a occhio',
    'Five patrons, and three nobles in another set: the data is there, but the card is laid out by eye'
  ),
  'right',
  { pad: 4 }
)
await openTemplate(N.tPatron, N.patrons, 0)
await r.focus(
  layers(),
  t(
    'Nome, costo, forza, tipo e testo sono livelli Valore: i testi e le formule usano loro',
    'Name, cost, strength, type and text are Value layers: texts and formulas use them'
  ),
  'right',
  { pad: 4 }
)
await onStage(
  t(
    'Titolo e ritratto storti, icone sparse: la sistemiamo capitolo per capitolo',
    'Crooked title and portrait, scattered icons: we fix it chapter by chapter'
  )
)

// ================= 1. misure e unità
await r.title(t('1 · Misure e unità', '1 · Sizes and units'))
await r.clear()
await key('Escape', 500)
const settings = win.locator('button.settings-button').first()
await r.click(settings, { after: 700 })
const unit = win.locator('#ui-unit')
await r.focus(
  unit,
  t(
    '⚙ › Unità di misura: millimetri, centimetri o pollici',
    '⚙ › Unit of measure: millimeters, centimeters or inches'
  ),
  'left',
  { pad: 6 }
)
await unit.selectOption('cm')
await r.wait(600)
await key('Escape', 600)
await r.focus(
  props,
  t(
    'Senza livelli selezionati il pannello mostra il template: ora le misure sono in centimetri',
    'With no layer selected the panel shows the template: sizes are now in centimeters'
  ),
  'left',
  { pad: 4 }
)
await r.click(settings, { after: 700 })
await unit.selectOption('mm')
await r.wait(600)
await key('Escape', 600)
await r.focus(
  [field(T['prop.width']), field(T['prop.bleed'])],
  t(
    'Misure, abbondanza, area sicura e forma. Il testo resta sempre in punti',
    'Size, bleed, safe area and shape. Text always stays in points'
  ),
  'left',
  { pad: 4 }
)
const addGuide = props.getByRole('button', { name: T['editor.guideAddV'], exact: true }).first()
await center(addGuide)
await r.click(addGuide, { after: 700 })
await fill(field(T['editor.guideV']), it ? '31,5' : '31.5')
await onStage(
  t(
    'Una guida verticale a metà carta, 31,5 mm: i livelli ci si agganciano',
    'A vertical guide in the middle of the card, 31.5 mm: layers snap to it'
  )
)
// la barra sotto la tela: cosa si vede e a cosa ci si aggancia
const zc = win.locator('.zoom-controls').first()
const zbtn = (key, n = 0) =>
  zc
    .locator('button')
    .filter({ hasText: new RegExp(`^${T[key]}$`) })
    .nth(n)
await r.focus(
  zc,
  t(
    'Sotto la tela, i pulsanti che decidono cosa si vede e a cosa si agganciano i livelli',
    'Under the canvas, the buttons that decide what you see and what layers snap to'
  ),
  'above',
  { pad: 4 }
)
await r.click(zbtn('editor.showBleed'), { after: 400 })
await r.click(zbtn('editor.showSafe'), { after: 700 })
await onStage(
  t(
    `${T['editor.showBleed']} e ${T['editor.showSafe']} mostrano o nascondono le linee del taglio e del margine di sicurezza. Non si stampano mai`,
    `${T['editor.showBleed']} and ${T['editor.showSafe']} show or hide the trim and safety margin lines. They never print`
  )
)
await r.click(zbtn('editor.showBleed'), { after: 400 })
await r.click(zbtn('editor.showSafe'), { after: 400 })
await r.click(zbtn('editor.showGrid'), { after: 700 })
await r.focus(
  [zc.locator('.grid-step').first(), stage()],
  t(
    `${T['editor.showGrid']} disegna una quadrettatura sulla tela; il passo, qui 5 mm, si scrive accanto`,
    `${T['editor.showGrid']} draws a square grid on the canvas; the step, here 5 mm, is written next to it`
  ),
  'above',
  { pad: 4 }
)
const snapGrid = zbtn('editor.snapGrid', 1)
const gridWasOn = (await snapGrid.getAttribute('aria-pressed')) === 'true'
if (!gridWasOn) await r.click(snapGrid, { after: 600 })
await r.focus(
  [snapGrid, zbtn('editor.snapObjects')],
  t(
    `${T['editor.snap']} ${T['editor.snapGrid']}, trascinando i lati si fermano sulle righe della griglia; ${T['editor.snapObjects']}, su lati e centri degli altri livelli, del componente e delle guide. Alt trascina libero`,
    `${T['editor.snap']} ${T['editor.snapGrid']}, when dragging, edges stop on the grid lines; ${T['editor.snapObjects']}, on the edges and centers of other layers, of the component and of the guides. Alt drags freely`
  ),
  'above',
  { pad: 4 }
)
await r.click(layer(I.coin), { after: 600 })
{
  const g = await selBox()
  await drag({ x: g.cx, y: g.cy }, { x: g.cx + 45, y: g.cy + 30 }, undefined, 1800)
}
await onStage(
  t(
    'La moneta trascinata si ferma a scatti, sulle righe della griglia',
    'The dragged coin moves in steps, on the grid lines'
  )
)
await key('Control+Z', 800)
if (!gridWasOn) await r.click(snapGrid, { after: 400 })
await r.click(zbtn('editor.showGrid'), { after: 600 })
await r.focus(
  zc.locator('button').filter({ hasText: new RegExp(`^${T['editor.zoomFit']}$`) }).first(),
  t(
    `− e + cambiano lo zoom (anche con ⌘ / Ctrl e la rotella), ${T['editor.zoomFit']} riporta il componente intero nella tela`,
    `− and + change the zoom (also with ⌘ / Ctrl and the scroll wheel), ${T['editor.zoomFit']} brings the whole component back into view`
  ),
  'above',
  { pad: 4 }
)
await save()

// ================= 2. spostare con precisione
await r.title(t('2 · Spostare con precisione', '2 · Moving precisely'))
await r.clear()
await r.click(layer(C.title), { after: 600 })
let b = await selBox()
await drag({ x: b.cx, y: b.cy }, { x: b.cx + 60, y: b.cy + 8 }, 'Shift')
await onStage(
  t(
    'Trascinando con ⇧ / Maiuscolo il livello va solo in orizzontale, in verticale o a 45°',
    'Dragging with ⇧ / Shift the layer moves only horizontally, vertically or at 45°'
  )
)
for (let i = 0; i < 3; i++) await key('ArrowLeft', 350)
await onStage(
  t(
    'Le frecce spostano di 0,5 mm; con ⇧ / Maiuscolo di 5 mm. Alt trascina senza agganci, Alt+clic prende il livello sotto',
    'Arrow keys move by 0.5 mm; with ⇧ / Shift by 5 mm. Alt drags without snapping, Alt+click picks the layer underneath'
  )
)
await fill(field(T['prop.w']), '44')
await fill(field('X'), '4')
await fill(field('Y'), '5')
await r.focus(
  [field('X'), stage()],
  t(
    'Per la misura esatta si scrive nei campi: il titolo ora è largo quanto la banda',
    'For the exact size, type in the fields: the title is now as wide as the band'
  ),
  'left',
  { pad: 4 }
)
await r.click(layer(C.portrait), { after: 500 })
const yLabel = prow('Y').locator('.field-label').first()
await center(yLabel)
const yb = await yLabel.boundingBox()
await drag(
  { x: yb.x + yb.width / 2, y: yb.y + yb.height / 2 },
  { x: yb.x + yb.width / 2 + 60, y: yb.y + yb.height / 2 },
  null,
  1200
)
await r.focus(
  prow('Y'),
  t(
    'Trascinando l’etichetta di un campo il numero cambia come con un cursore',
    'Dragging a field’s label changes the number like a slider'
  ),
  'left',
  { pad: 4 }
)
await key('Control+Z', 600)
await search(t('cont', 'outl'))
await r.focus(
  props,
  t(
    '⌘F / Ctrl+F cerca nelle proprietà: «cont» lascia solo le voci che lo contengono',
    '⌘F / Ctrl+F searches the properties: “outl” leaves only the matching entries'
  ),
  'left',
  { pad: 4 }
)
await clearSearch()
await save()

// ================= 3. allineare e distribuire
await r.title(t('3 · Allineare e distribuire', '3 · Align and distribute'))
await r.clear()
await selectLayers(I.coin, I.mug, I.key)
await r.focus(
  props.locator('.align-section, .arrange').first(),
  t(
    'Tre icone selezionate con ⇧ / Maiuscolo: i pulsanti di allineamento in cima al pannello',
    'Three icons selected with ⇧ / Shift: the alignment buttons at the top of the panel'
  ),
  'left',
  { pad: 4 }
)
await choose(field(T['arrange.relativeTo']), 'selection')
await r.focus(
  field(T['arrange.relativeTo']),
  t(
    `${T['arrange.relativeTo']}: ${T['arrange.target.selection']}, così le icone si allineano fra loro e non al bordo della carta`,
    `${T['arrange.relativeTo']}: ${T['arrange.target.selection']}, so the icons line up with each other, not with the edge of the card`
  ),
  'left',
  { pad: 4 }
)
await arrange('arrange.top')
await arrange('arrange.distributeH')
await look(
  t(
    'Allinea i lati superiori, poi distribuisci in orizzontale con spazi uguali',
    'Align top edges, then distribute horizontally with equal spacing'
  )
)
await selectLayers(C.portrait, C.square)
await choose(field(T['arrange.relativeTo']), 'card')
await arrange('arrange.hcenter')
await look(
  t(
    'Rispetto al componente: ritratto e riquadro al centro della carta',
    'Relative to the component: portrait and square centered on the card'
  )
)
await selectLayers(C.description, C.footer)
await fill(colorField(T['prop.color']), '#5A2E1E')
await r.focus(
  [colorField(T['prop.color']), stage()],
  t(
    'Con più livelli selezionati una modifica vale per tutti: il colore dei due testi',
    'With several layers selected a change applies to all: the color of both texts'
  ),
  'left',
  { pad: 4 }
)
await save()

// ================= 4. i gruppi e la maschera
await r.title(t('4 · I gruppi e la maschera', '4 · Groups and masks'))
await r.clear()
await selectLayers(C.portrait, C.square)
await key('Control+G', 1000)
await fill(field(T['prop.name']), C.medallion)
await r.focus(
  layers(),
  t(
    '⌘G / Ctrl+G raggruppa: ritratto e riquadro si spostano e si nascondono insieme',
    '⌘G / Ctrl+G groups: portrait and square move and hide together'
  ),
  'right',
  { pad: 4 }
)
await onStage(
  t(
    'Vorremmo il ritratto in un tondo, non in un quadrato: serve una maschera',
    'We would like the portrait in a round frame, not a square: we need a mask'
  )
)
await r.title(
  t(
    'Una maschera è una sagoma: del gruppo si vede solo quello che sta dentro la sagoma, il resto sparisce',
    'A mask is a silhouette: only the part of the group inside the silhouette shows, the rest disappears'
  ),
  4600
)
// il cerchio nasce nel gruppo, sopra al livello selezionato
await r.click(layer(C.square), { after: 500 })
await shape('tool.ellipse')
await fill(field(T['prop.name']), C.circle)
await fill(field(T['prop.w']), '30')
await fill(field(T['prop.h']), '30')
await fill(field('X'), '16.5')
await fill(field('Y'), '16.5')
await fill(colorField(T['prop.fill']), '#E4572E')
await look(
  t(
    'Un cerchio arancione nel gruppo, grande come il riquadro: per ora copre il ritratto',
    'An orange circle in the group, as big as the square: for now it covers the portrait'
  )
)
await r.click(titled('layers.down'), { after: 800 })
await r.focus(
  [layers(), stage()],
  t(
    'Porta indietro: il cerchio scende in fondo al gruppo, sotto il riquadro, e non si vede più',
    'Send backward: the circle goes to the bottom of the group, under the square, and is no longer visible'
  ),
  'right',
  { pad: 4 }
)
await r.click(layer(C.medallion), { after: 500 })
await check(checkbox(T['prop.clip']))
await look(
  t(
    'Livello in fondo come maschera: il cerchio diventa la sagoma, e del gruppo resta solo il tondo',
    'Bottom layer as mask: the circle becomes the silhouette, and only the round part of the group is left'
  )
)
await r.focus(
  [checkbox(T['prop.clip']), stage()],
  t(
    'Il colore del cerchio non si vede: della maschera conta solo la forma',
    'The circle’s color does not show: only the shape of the mask counts'
  ),
  'left',
  { pad: 4 }
)
await r.click(layer(C.circle), { after: 500 })
await fill(field('X'), '8')
await look(
  t(
    'Si sposta il cerchio e si sposta la finestra: il ritratto resta fermo',
    'Move the circle and the window moves: the portrait stays put'
  )
)
await choose(field(T['prop.shape']), 'star')
await look(
  t(
    'Con una stella il gruppo prende la forma della stella',
    'With a star the group takes the shape of the star'
  )
)
await choose(field(T['prop.shape']), 'ellipse')
await fill(field('X'), '16.5')
await look(t('E di nuovo il tondo, al centro', 'And back to the round frame, centered'))
// la maschera da un'immagine con trasparenza: nasce sopra il cerchio, poi scende in fondo
await r.click(tool('tool.image'))
await r.clear(800)
await r.click(dialog().locator(`[title*="${I.crown}"], [data-tip*="${I.crown}"]`).first(), {
  after: 1000
})
await r.clear(600)
await fill(field(T['prop.name']), t('corona', 'crown'))
for (const [k, v] of [
  [T['prop.w'], 30],
  [T['prop.h'], 30],
  ['X', 16.5],
  ['Y', 16.5]
])
  await fill(field(k), String(v))
await r.click(titled('layers.down'), { after: 800 })
await deselect()
await look(
  t(
    'Anche un’immagine con trasparenza, PNG o SVG come questa corona, fa da maschera: conta la parte disegnata',
    'An image with transparency, PNG or SVG like this crown, works as a mask too: the drawn part is what counts'
  )
)
await r.click(layer(t('corona', 'crown')), { after: 500 })
await key('Delete', 900)
// e dal testo
await r.click(layer(C.circle), { after: 500 })
await r.click(tool('tool.text'))
await r.clear(400)
await fill(field(T['prop.name']), t('scritta', 'lettering'))
await fill(field(T['prop.text']), t('OSTE', 'HOST'))
await fill(field(T['prop.size']), '28')
await choose(field(T['prop.weight']), '900')
await choose(field(T['prop.align']), 'center')
await choose(field(T['prop.valign']), 'middle')
for (const [k, v] of [
  [T['prop.w'], 30],
  [T['prop.h'], 30],
  ['X', 16.5],
  ['Y', 16.5]
])
  await fill(field(k), String(v))
await r.click(titled('layers.down'), { after: 800 })
await deselect()
await look(
  t(
    'E anche un testo: il gruppo, ritratto e riquadro, si vede solo dentro le lettere',
    'And a text too: the group, portrait and square, shows only inside the letters'
  )
)
await r.click(layer(t('scritta', 'lettering')), { after: 500 })
await key('Delete', 900)
await look(
  t(
    'Tolgo il testo e la maschera torna il cerchio, il livello in fondo al gruppo',
    'I remove the text and the mask is the circle again, the bottom layer of the group'
  )
)
await save()

// ================= 5. disponi i figli e ripeti
await r.title(t('5 · Disponi i figli e Ripeti', '5 · Arrange children and Repeat'))
await r.clear()
await onStage(
  t(
    'Moneta, boccale e chiave: le vogliamo in riga, sempre alla stessa distanza, anche se una manca',
    'Coin, mug and key: we want them in a row, always the same distance apart, even if one is missing'
  )
)
await selectLayers(I.coin, I.mug, I.key)
await key('Control+G', 1000)
await fill(field(T['prop.name']), C.services)
await r.focus(
  layers(),
  t(
    'Per prima cosa un gruppo con le tre icone: ⌘G / Ctrl+G. Disponi i figli è una proprietà del gruppo',
    'First a group with the three icons: ⌘G / Ctrl+G. Arrange children is a property of the group'
  ),
  'right',
  { pad: 4 }
)
const explain = async (label, text) => {
  await center(field(label))
  await r.focus(prow(label), text, 'left', { pad: 4 })
}
await choose(field(T['prop.layout']), 'row')
await explain(
  T['prop.layout'],
  t(
    `${T['prop.layout']}: In riga. Le icone si mettono una dopo l’altra, nell’ordine dell’elenco dei livelli`,
    `${T['prop.layout']}: In a row. The icons line up one after the other, in the order of the layer list`
  )
)
await fill(field(T['prop.gap']), '2')
await explain(
  T['prop.gap'],
  t(`${T['prop.gap']}: 2 mm tra un’icona e l’altra`, `${T['prop.gap']}: 2 mm between one icon and the next`)
)
await explain(
  T['prop.justify'],
  t(
    `${T['prop.justify']}: dove sta la fila dentro il gruppo; ${T['prop.alignItems']}: come si allinea ogni icona in altezza`,
    `${T['prop.justify']}: where the row sits inside the group; ${T['prop.alignItems']}: how each icon lines up in height`
  )
)
await fill(field(T['prop.w']), '26')
await fill(field('X'), '7')
await fill(field('Y'), '49')
await look(
  t(
    'Il gruppo largo 26 mm, sotto il ritratto: le tre icone in riga, a 2 mm l’una dall’altra',
    'The group 26 mm wide, under the portrait: the three icons in a row, 2 mm apart'
  )
)
await r.click(eye(I.mug), { after: 700 })
await look(
  t(
    'Si nasconde il boccale e le altre icone si ricompongono, senza buchi',
    'Hide the mug and the other icons close up, with no gap'
  )
)
await r.click(eye(I.mug), { after: 700 })
await r.click(layer(I.sword), { after: 500 })
await key('Control+G', 1000)
await fill(field(T['prop.name']), C.swords)
await r.focus(
  layers(),
  t(
    'Ora le spade: un gruppo con la sola spada, da ripetere tante volte quanta è la forza',
    'Now the swords: a group with just the sword, to repeat as many times as the strength'
  ),
  'right',
  { pad: 4 }
)
await fill(field(T['prop.repeat']), `{${C.strength}}`)
await fill(field(T['prop.w']), '26')
await fill(field('X'), '31')
await look(
  t(
    'Ripeti {forza}: una spada per ogni punto di forza, dal livello Valore',
    'Repeat {strength}: one sword per strength point, from the Value layer'
  )
)
await previewRow(N.patrons, 3)
await look(t('Il capitano ha forza 4: quattro spade', 'The captain has strength 4: four swords'))
await r.focus(
  stage(),
  t(
    'Le icone ripetute nel testo scorrono con le parole (video 21); il gruppo le tiene in un punto fisso',
    'Icons repeated in text flow with the words (video 21); the group keeps them in a fixed spot'
  ),
  'left',
  { pad: 0, dim: false }
)
await save()

// ================= 6. vincoli
await r.title(t('6 · Cambiare formato con i vincoli', '6 · Changing format with constraints'))
await r.clear()
await r.click(layer(C.footer), { after: 500 })
await search(t('vincol', 'constraint'))
await choose(field(T['prop.constraintV']), 'bottom')
await r.focus(
  props,
  t(
    'Il piede: Segue il lato inferiore. Resta in fondo anche su una carta più alta',
    'The footer: Follows the bottom edge. It stays at the bottom on a taller card too'
  ),
  'left',
  { pad: 4 }
)
await r.click(layer(C.bg), { after: 500 })
await choose(field(T['prop.constraintH']), 'both')
await choose(field(T['prop.constraintV']), 'both')
await r.focus(
  props,
  t(
    'Lo sfondo si allunga con il componente, in tutte e due le direzioni',
    'The background stretches with the component, in both directions'
  ),
  'left',
  { pad: 4 }
)
await clearSearch()
await deselect()
await fill(field(T['prop.width']), it ? '31,5' : '31.5')
await r.focus(
  dialog(),
  t(
    'Da carta poker a mini poker, metà larghezza e metà altezza: Stella chiede cosa fare dei livelli',
    'From poker card to mini poker, half the width and half the height: Stella asks what to do with the layers'
  ),
  'left',
  { pad: 4 }
)
await r.click(dialog().getByRole('button', { name: T['resize.scale'], exact: true }), {
  after: 900
})
await fill(field(T['prop.height']), '44')
const scaleBtn = dialog().getByRole('button', { name: T['resize.scale'], exact: true })
if (await scaleBtn.count()) await r.click(scaleBtn, { after: 900 })
await onStage(
  t(
    `${T['resize.scale']}: tutto rimpicciolisce in proporzione, testi compresi. La carta è la stessa, in piccolo`,
    `${T['resize.scale']}: everything shrinks in proportion, text included. The same card, smaller`
  )
)
await key('Control+Z', 900)
await key('Control+Z', 900)
await onStage(
  t(
    'Annulliamo e torniamo alla poker. Ora l’altra scelta, allungando la carta in un tarocco',
    'Let’s undo and go back to poker. Now the other choice, stretching the card into a tarot card'
  )
)
await fill(field(T['prop.height']), '120')
await r.click(dialog().getByRole('button', { name: T['resize.keep'], exact: true }), {
  after: 900
})
await onStage(
  t(
    `${T['resize.keep']}: lo sfondo si è allungato e il piede è sceso, come dicono i vincoli; il resto è rimasto dov’era`,
    `${T['resize.keep']}: the background stretched and the footer moved down, as the constraints say; the rest stayed where it was`
  )
)
await fill(field(T['prop.height']), '88')
await r.click(dialog().getByRole('button', { name: T['resize.keep'], exact: true }), {
  after: 900
})
await onStage(t('E si torna al formato poker', 'And back to the poker format'))
await save()

// ================= 7. il retro
await r.title(t('7 · Il retro', '7 · The back'))
await r.clear()
await r.title(
  t(
    'Avventori e Nobili sono due set con lo stesso template: la carta è la stessa, cambiano i dati',
    'Patrons and Nobles are two sets with the same template: the card is the same, the data changes'
  ),
  4400
)
await face('preview.back')
await onStage(
  t(
    'Retro: i livelli del retro, uguali per tutte le carte o presi dai dati',
    'Back: the back’s layers, the same on every card or taken from the data'
  )
)
await r.click(layer(C.backBg), { after: 600 })
await r.focus(
  [sourceLine(), stage()],
  t(
    'Il colore dello sfondo viene dal livello Valore tipo: rosso per i popolani…',
    'The background color comes from the Value layer type: red for commoners…'
  ),
  'left',
  { pad: 4 }
)
await previewRow(N.nobles, 0)
await onStage(t('…blu per i nobili', '…blue for nobles'))
await onStage(
  t(
    'Con una formula si personalizza un dettaglio, qui il retro, senza duplicare il template',
    'With a formula you customize one detail, here the back, without duplicating the template'
  )
)
await face('preview.front')
await save()
await openSet(N.nobles)
await r.click(
  win
    .locator('aside.preview button')
    .filter({ hasText: new RegExp(`^${T['preview.back']}$`) })
    .first(),
  { after: 900 }
)
await r.focus(
  grid(),
  t(
    'Nella griglia del set, Retro mostra tutti i retri: blu per i nobili',
    'In the set grid, Back shows every back: blue for the nobles'
  ),
  'right',
  { pad: 4 }
)
await r.click(
  win
    .locator('aside.preview button')
    .filter({ hasText: new RegExp(`^${T['preview.front']}$`) })
    .first(),
  { after: 700 }
)
await openTemplate(N.tCoin, N.coins, 2)
await face('preview.back')
await onStage(
  t(
    'Anche un segnalino ha il retro: il valore davanti, la moneta dietro',
    'A token has a back too: the value in front, the coin behind'
  )
)
await face('preview.front')

// ================= 8. template derivati
await r.title(t('8 · I template derivati', '8 · Derived templates'))
await r.title(
  t(
    'Per cambiamenti più grandi, ma non di tutta la carta, un template derivato: niente formule complicate',
    'For bigger changes that do not involve the whole card, a derived template: no complicated formulas'
  ),
  4600
)
await r.clear()
const tplItem = side(N.tPatron)
await tplItem.hover()
await r.wait(300)
const more = win
  .locator('.sidebar li')
  .filter({ has: win.getByText(N.tPatron, { exact: true }) })
  .locator('button')
  .filter({ hasText: '⋯' })
  .first()
await r.click(more, { after: 600 })
await r.click(win.getByRole('menuitem', { name: T['inherit.deriveShort'] }).first(), {
  after: 800
})
await fill(dialog().locator('input').first(), N.tNoble, { tab: false })
await r.click(dialog().getByRole('button', { name: T['inherit.deriveOk'], exact: true }), {
  after: 1400
})
await r.overlay()
await r.focus(
  win.getByRole('button', { name: T['inherit.detach'] }).first(),
  t(
    'Deriva: «avventore-nobile» parte da «avventore» e ne segue tutto',
    'Derive: “patron-noble” starts from “patron” and follows all of it'
  ),
  'below',
  { pad: 4 }
)
await save()
await openSet(N.nobles)
await choose(win.locator('.set-template select').first(), N.tNoble)
await r.focus(
  win.locator('.set-template').first(),
  t('Il set Nobili ora usa il derivato', 'The Nobles set now uses the derived template'),
  'below',
  { pad: 4 }
)
await r.click(win.getByRole('button', { name: T['preview.editTemplate'] }).first(), { after: 1200 })
await r.overlay()
await r.click(layer(C.band), { after: 500 })
await fill(colorField(T['prop.fill']), '#34466E')
await r.click(layer(C.bg), { after: 500 })
await fill(colorField(T['prop.fill']), '#E6E3EF')
await r.focus(
  [props.locator('.inherit-mark').first(), stage()],
  t(
    'Si cambiano sfondo e banda. La catena: valore del base; la freccia: cambiato qui',
    'Change background and band. The chain: the base’s value; the arrow: changed here'
  ),
  'left',
  { pad: 4 }
)
await r.focus(
  layers(),
  t(
    'Anche nei livelli: la freccia segna quelli cambiati, e un clic li riporta come nel base',
    'In the layers too: the arrow marks the changed ones, and a click brings them back to the base'
  ),
  'right',
  { pad: 4 }
)
await save()
await r.click(side(N.tPatron), { after: 1000 })
await r.overlay()
await r.click(layer(C.footer), { after: 500 })
await fill(
  field(T['prop.text']),
  `${t('Locanda del Cinghiale', 'Boar’s Head Tavern')} · {card.number}/{set.cards}`
)
await save()
await openTemplate(N.tNoble, N.nobles, 0)
await onStage(
  t(
    'Il piede cambiato nel base arriva anche al derivato',
    'The footer changed in the base reaches the derived template too'
  )
)
await r.focus(
  win.getByRole('button', { name: T['inherit.detach'] }).first(),
  t(
    'Rendi indipendente lo stacca dal base, con i valori che ha in quel momento',
    'Make independent detaches it from the base, with the values it has at that moment'
  ),
  'below',
  { pad: 4 }
)
await save()

// ================= 9. copiare tra template
await r.title(t('9 · Copiare tra template', '9 · Copying between templates'))
await r.clear()
await r.click(layer(C.footer), { after: 500 })
await key('Control+C', 500)
await openTemplate(N.tRoom, N.rooms, 1)
await r.click(layer(C.title), { after: 500 })
await key('Control+V', 900)
await r.focus(
  [layers(), stage()],
  t(
    '⌘C / Ctrl+C e ⌘V / Ctrl+V: il piede arriva sulla tessera. Il nome c’era già, diventa piede_2',
    '⌘C / Ctrl+C and ⌘V / Ctrl+V: the footer lands on the tile. The name was taken, so it becomes footer_2'
  ),
  'right',
  { pad: 4 }
)
await key('Control+Z', 600)
await save()

// ================= chiusura
await r.title(
  t(
    'Gli altri video: 2 e 18 per l’editor, 21 per le icone nel testo, 8 per le griglie',
    'More videos: 2 and 18 for the editor, 21 for icons in text, 8 for grids'
  ),
  4400
)
await r.title(
  t(
    'Tutti gli approfondimenti sono nella playlist e su stella.lucadj.eu',
    'All the deep dives are in the playlist and on stella.lucadj.eu'
  ),
  4000
)
await r.clear(800)
console.log('VIDEO ' + (await r.finish()))
