// Video 27, quinto approfondimento: immagini e forme. Circa 13 minuti senza voce, sul progetto
// «Spedizione» di progetto-spedizione.mjs, che chi guarda scarica dal sito. Capitoli: l'immagine nel
// riquadro; Ritaglia…; colorazione; regolazioni e immagini mancanti; le forme; i riempimenti; la sezione
// Aspetto; sulla tessera e sui segnalini.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node --experimental-strip-types --no-warnings scripts/video/immagini.mjs it|en
// FAST=1 accorcia attese e scrittura; SHOT=<file.png> salva la schermata se un elemento non si trova;
// SNAP=<cartella> salva una schermata dopo ogni testo, e i testi in testi.tsv (per lo storyboard).
import { appendFileSync } from 'node:fs'
import { launch, mockOpen } from './lib.mjs'
import { docs } from '../guide/lib.mjs'
import { make, names } from './progetto-spedizione.mjs'
const lang = process.argv[2] || 'it'
const it = lang === 'it'
const t = (a, b) => (it ? a : b)
const N = names(lang)
const { C, I, A } = N
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

/** apre le Avanzate della sezione che contiene il campo */
async function advanced(label) {
  const d = props
    .locator('details.advanced')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${label}$`) }) })
    .first()
  if (await d.evaluate((el) => el.open)) return
  await r.click(d.locator('summary').first(), { after: 600 })
}
/** un colore che si può togliere (colorazione, ombra): la spunta, poi il codice */
async function nullableColor(label, color) {
  const row = prow(label)
  const box = row.locator('input[type=checkbox]').first()
  if (!(await box.isChecked())) await check(box)
  if (color) await fill(row.locator('input.color-text').first(), color)
}
async function uncheck(label) {
  const box = prow(label).locator('input[type=checkbox]').first()
  if (await box.isChecked()) await check(box)
}
/** il contorno: la spunta, il colore, lo spessore e, se c'è, il tipo di linea */
async function stroke(color, width, dash) {
  const row = prow(T['prop.stroke'])
  const box = row.locator('input[type=checkbox]').first()
  if (!(await box.isChecked())) await check(box)
  await fill(row.locator('input.color-text').first(), color)
  await fill(row.locator('input.num').first(), String(width))
  if (dash) await choose(row.locator('select').first(), dash)
}
async function place(x, y, w, h) {
  await fill(field(T['prop.w']), String(w))
  if (h !== undefined) await fill(field(T['prop.h']), String(h))
  await fill(field('X'), String(x))
  await fill(field('Y'), String(y))
}
async function top() {
  await key('Escape', 250)
  await key('Escape', 250)
}
async function shape(kind) {
  await top()
  const menu = win.locator(
    `.menu-button[title="${T['tool.shapes']}"], .menu-button[data-tip="${T['tool.shapes']}"]`
  )
  await r.click(menu.first(), { after: 500 })
  await r.click(win.locator('.menu-panel .menu-item').filter({ hasText: T[kind] }).first(), {
    after: 600
  })
  await r.clear(400)
}
const source = (kind) =>
  props
    .locator('.source-line .segmented button')
    .filter({
      hasText: new RegExp(
        `^${kind === 'column' ? T['source.short.column'] : T['source.kind.' + kind]}$`
      )
    })
    .first()
const asset = (name) =>
  dialog().locator(`.asset-tile[title*="${name}"], .asset-tile[data-tip*="${name}"]`).first()
/** il campo e un testo accanto */
async function about(loc, text, sideOf = 'left') {
  await center(loc)
  await r.focus(prow0(loc), text, sideOf, { pad: 4 })
}
const prow0 = (loc) => loc.locator('xpath=ancestor::div[contains(@class,"field")][1]')
async function fit(v, text) {
  await choose(field(T['prop.fit']), v)
  await look(text)
}

// ================= apertura
await mockOpen(r.app, dest)
await r.overlay()
await r.title(t('Immagini e forme', 'Images and shapes'))
await r.title(
  t(
    'Il progetto «Spedizione» si scarica dal link nella descrizione: aprilo e segui passo passo',
    'The “Expedition” project is in the description: open it and follow along'
  )
)
await r.clear()
await r.click(win.getByText(T['start.openProject']).first())
await r.clear(2200)
await r.overlay()
await r.focus(
  grid(),
  t(
    'Sei luoghi, quattro segnalini risorsa e quattro tessere terreno. Le illustrazioni sono messe così come sono',
    'Six places, four resource tokens and four terrain tiles. The illustrations are placed as they are'
  ),
  'right',
  { pad: 4 }
)
await openTemplate(N.tPlace, N.places, 1)
await r.focus(
  layers(),
  t(
    'Nome, risorsa e testo sono livelli Valore; l’illustrazione legge la sua colonna del foglio',
    'Name, resource and text are Value layers; the illustration reads its sheet column'
  ),
  'right',
  { pad: 4 }
)

// ================= 1. l'immagine nel riquadro
await r.title(t('1 · L’immagine nel riquadro', '1 · The image in its frame'))
await r.clear()
await r.click(layer(C.art), { after: 600 })
await about(
  field(T['prop.fit']),
  t(
    `${T['prop.fit']}: come l’immagine riempie il riquadro. ${T['imageFit.contain']} la mostra tutta, con due bande vuote`,
    `${T['prop.fit']}: how the image fills its frame. ${T['imageFit.contain']} shows all of it, with two empty bands`
  )
)
await fit(
  'cover',
  t(
    `${T['imageFit.cover']}: copre tutto il riquadro e taglia quello che avanza`,
    `${T['imageFit.cover']}: covers the whole frame and cuts what is left over`
  )
)
await fit(
  'overflow',
  t(
    `${T['imageFit.overflow']}: copre il riquadro, e quello che esce resta visibile`,
    `${T['imageFit.overflow']}: covers the frame, and what spills out stays visible`
  )
)
await fit(
  'stretch',
  t(
    `${T['imageFit.stretch']}: riempie il riquadro cambiando le proporzioni`,
    `${T['imageFit.stretch']}: fills the frame by changing the proportions`
  )
)
await fit(
  'original',
  t(
    `${T['imageFit.original']}: la misura del file, a 300 dpi per PNG e JPG`,
    `${T['imageFit.original']}: the file’s own size, at 300 dpi for PNG and JPG`
  )
)
await choose(field(T['prop.fit']), 'cover')
await choose(field(T['prop.imageAlign']), 'right')
await look(
  t(
    `${T['imageFit.cover']} con ${T['prop.imageAlign']} a destra: la vetta resta dentro`,
    `${T['imageFit.cover']} with ${T['prop.imageAlign']} on the right: the peak stays inside`
  )
)
await fill(field(T['prop.zoom']), '115')
await fill(field(T['prop.offsetX']), '-4')
await look(
  t(
    `${T['prop.zoom']} e ${T['prop.offsetX']}: per inquadrare meglio, sempre dentro il riquadro`,
    `${T['prop.zoom']} and ${T['prop.offsetX']}: to frame it better, always inside the frame`
  )
)
await previewRow(N.places, 0)
await look(
  t(
    'Le stesse scelte valgono per tutte le carte: qui il bosco',
    'The same choices apply to every card: here the forest'
  )
)
await previewRow(N.places, 1)
await r.click(layer(C.bg), { after: 600 })
await look(
  t(
    'Ora una trama di carta sopra lo sfondo: seleziono lo sfondo, perché il nuovo livello entra subito sopra quello selezionato',
    'Now a paper texture over the background: I select the background, because the new layer goes right above the selected one'
  )
)
await r.click(tool('tool.image'))
await r.clear(800)
await look(
  t(
    'Una trama è un’immagine come le altre: la scelgo tra le immagini del progetto',
    'A texture is an image like any other: I pick it from the project’s images'
  )
)
await r.click(asset(A.paper), { after: 1000 })
await r.clear(800)
await fill(field(T['prop.name']), C.texture)
await r.click(source('fixed'), { after: 600 })
await r.focus(
  props.locator('.source-line').first(),
  t(
    `${T['source.kind.fixed']}: la stessa trama su tutte le carte, senza una colonna nel foglio`,
    `${T['source.kind.fixed']}: the same texture on every card, with no sheet column`
  ),
  'left',
  { pad: 4 }
)
await place(-3, -3, 69, 94)
await look(
  t(
    `La porto a coprire tutta la carta, abbondanza compresa. Con ${T['imageFit.contain']} l’immagine si allarga per stare nel riquadro`,
    `I make it cover the whole card, bleed included. With ${T['imageFit.contain']} the image is enlarged to fit the frame`
  )
)
await fit(
  'original',
  t(
    `${T['imageFit.original']}: la trama torna alla sua misura, un quadrato di 25 mm`,
    `${T['imageFit.original']}: the texture goes back to its own size, a 25 mm square`
  )
)
await fit(
  'tile',
  t(
    `${T['imageFit.tile']}: l’immagine alla sua misura, ripetuta fino a coprire il riquadro. È il modo giusto per una trama`,
    `${T['imageFit.tile']}: the image at its own size, repeated until it covers the frame. It is the right way for a texture`
  )
)
await save()

// ================= 2. ritaglia
await r.title(t(`2 · ${T['crop.open']}`, `2 · ${T['crop.open']}`))
await r.clear()
await r.click(layer(C.art), { after: 600 })
await fill(field(T['prop.zoom']), '100')
await fill(field(T['prop.offsetX']), '0')
await choose(field(T['prop.imageAlign']), 'center')
const cropButton = props.getByRole('button', { name: T['crop.open'], exact: true })
await about(
  cropButton,
  t(
    'Ritaglia… usa solo una parte dell’immagine. Il file non cambia',
    'Crop… uses only part of the image. The file does not change'
  )
)
await r.click(cropButton, { after: 900 })
await r.focus(
  dialog(),
  t(
    `L’immagine intera e il rettangolo, con ${T['crop.lock']}: il ritaglio entra senza deformarsi`,
    `The whole image and the rectangle, with ${T['crop.lock']}: the crop fits without stretching`
  ),
  'left',
  { pad: 0 }
)
{
  const area = await dialog().locator('.crop-area').first().boundingBox()
  const se = await dialog().locator('.crop-handle.crop-se').first().boundingBox()
  const rect = await dialog().locator('.crop-rect').first().boundingBox()
  await drag(
    { x: se.x + se.width / 2, y: se.y + se.height / 2 },
    { x: se.x + se.width / 2 - rect.width * 0.45, y: se.y + se.height / 2 - rect.height * 0.45 }
  )
  const now = await dialog().locator('.crop-rect').first().boundingBox()
  await drag(
    { x: now.x + now.width / 2, y: now.y + now.height / 2 },
    { x: area.x + area.width * 0.7, y: area.y + area.height * 0.36 }
  )
}
await r.focus(
  dialog().locator('.crop-area').first(),
  t(
    'Si trascinano gli angoli e il rettangolo: la vetta da vicino',
    'Drag the corners and the rectangle: the peak up close'
  ),
  'left',
  { pad: 4 }
)
await r.click(dialog().getByRole('button', { name: T['crop.apply'], exact: true }), {
  after: 900
})
await look(
  t(
    `Il ritaglio, poi ${T['imageFit.cover']} come prima`,
    `The crop, then ${T['imageFit.cover']} as before`
  )
)
await previewRow(N.places, 0)
await look(
  t(
    'Quando l’immagine viene da una colonna, il ritaglio si prova sulla carta mostrata e vale per tutte',
    'When the image comes from a column, you try the crop on the card shown and it applies to all of them'
  )
)
await r.click(props.locator(`button[title="${T['crop.remove']}"], button[data-tip="${T['crop.remove']}"]`).first(), {
  after: 800
})
await about(
  field(T['prop.fit']),
  t('× toglie il ritaglio: torna l’immagine intera', '× removes the crop: the whole image is back')
)
await previewRow(N.places, 1)
await advanced(T['prop.flipH'])
await check(checkbox(T['prop.flipH']))
await look(
  t(
    `In Avanzate, ${T['prop.flipH']}: la vetta passa a sinistra. C’è anche il riflesso verticale`,
    `In Advanced, ${T['prop.flipH']}: the peak moves to the left. There is a vertical flip too`
  )
)
await check(checkbox(T['prop.flipH']))
await save()

// ================= 3. colorazione
await r.title(t(`3 · ${T['prop.tint']}`, `3 · ${T['prop.tint']}`))
await r.clear()
await r.click(layer(C.icon), { after: 600 })
await look(
  t(
    'L’icona della risorsa è nera: è un’icona a un colore, da colorare',
    'The resource icon is black: it is a one-color icon, to be tinted'
  )
)
await nullableColor(T['prop.tint'], '#B07A1E')
await look(
  t(
    `${T['prop.tint']} con un colore pieno: l’icona diventa oro`,
    `${T['prop.tint']} with a solid color: the icon turns gold`
  )
)
await r.click(layer(C.art), { after: 600 })
await nullableColor(T['prop.tint'], '#00000033')
await look(
  t(
    'Su un’illustrazione, un colore semitrasparente tinge senza coprire: nero al 20% la scurisce',
    'On an illustration, a semi-transparent color tints without covering: black at 20% darkens it'
  )
)
await uncheck(T['prop.tint'])
await r.wait(500)
await save()
await openTemplate(N.tToken, N.resources, 0)
await r.click(layer(C.color), { after: 600 })
await r.focus(
  [sourceLine(), layers()],
  t(
    'Sul segnalino, colore è un livello Valore con una formula su risorsa: marrone per il legno, grigio per la pietra…',
    'On the token, color is a Value layer with a formula on resource: brown for wood, gray for stone…'
  ),
  'left',
  { pad: 4 }
)
await r.click(layer(C.icon), { after: 600 })
await nullableColor(T['prop.tint'], `{${C.color}}`)
await look(
  t(
    `${T['prop.tint']}: {${C.color}}. Il campo colore legge il livello Valore`,
    `${T['prop.tint']}: {${C.color}}. The color field reads the Value layer`
  )
)
await previewRow(N.resources, 2)
await look(t('Ogni segnalino prende il suo colore', 'Each token gets its own color'))
await save()

// ================= 4. regolazioni e immagini mancanti
await r.title(t('4 · Regolazioni e immagini mancanti', '4 · Adjustments and missing images'))
await r.clear()
await openTemplate(N.tPlace, N.places, 4)
await r.click(layer(C.art), { after: 600 })
await look(
  t(
    'Le rovine sembrano una vecchia stampa: poco contrasto e una dominante gialla',
    'The ruins look like an old print: little contrast and a yellow cast'
  )
)
await advanced(T['prop.contrast'])
await fill(field(T['prop.contrast']), '135')
await fill(field(T['prop.saturation']), '125')
await fill(field(T['prop.brightness']), '95')
await about(
  field(T['prop.contrast']),
  t(
    `${T['prop.brightness']}, ${T['prop.contrast']} e ${T['prop.saturation']}: 100% è l’immagine com’è`,
    `${T['prop.brightness']}, ${T['prop.contrast']} and ${T['prop.saturation']}: 100% is the image as it is`
  )
)
await look(t('Più viva', 'Livelier'))
await previewRow(N.places, 2)
await look(
  t(
    'Le regolazioni valgono per tutte le carte: meglio ritocchi leggeri',
    'Adjustments apply to every card: keep them light'
  )
)
await fill(field(T['prop.contrast']), '110')
await fill(field(T['prop.saturation']), '105')
await fill(field(T['prop.brightness']), '100')
await check(checkbox(T['prop.grayscale']))
await look(
  t(
    `${T['prop.grayscale']}: per esempio per un luogo già esplorato`,
    `${T['prop.grayscale']}: for example for a place already explored`
  )
)
await check(checkbox(T['prop.grayscale']))
await previewRow(N.places, 5)
await look(
  t(
    'La Terra ignota non ha un’illustrazione: l’editor mostra un segnaposto',
    'The Unknown land has no illustration: the editor shows a placeholder'
  )
)
await choose(field(T['prop.missing']), 'hide')
await look(
  t(
    `${T['prop.missing']}: ${T['missing.hide']}, e resta la carta senza illustrazione`,
    `${T['prop.missing']}: ${T['missing.hide']}, and the card stays without an illustration`
  )
)
await previewRow(N.places, 1)
await about(
  field(T['prop.radius']),
  t(
    `Qui ci sono anche ${T['prop.radius']}, per arrotondare gli angoli, e ${T['prop.stroke']}`,
    `Here there are also ${T['prop.radius']}, to round the corners, and ${T['prop.stroke']}`
  )
)
await r.click(layer(C.icon), { after: 600 })
await stroke('#FFFFFF', 0.8)
await deselect()
await look(
  t(
    `${T['prop.stroke']} sull’icona: segue la sagoma, perché attorno al disegno l’immagine è trasparente`,
    `${T['prop.stroke']} on the icon: it follows the silhouette, because around the drawing the image is transparent`
  )
)
await look(
  t(
    'Su un’immagine senza trasparenza, come una foto JPG, il contorno la racchiude invece in un riquadro',
    'On an image without transparency, like a JPG photo, the stroke instead encloses it in a box'
  )
)
await previewRow(N.places, 1)
await save()

// ================= 5. le forme
await r.title(t('5 · Le forme', '5 · Shapes'))
await r.clear()
await openTemplate(N.tTile, N.terrains, 0)
await onStage(
  t(
    'La tessera terreno, esagonale: aggiungiamo tre forme dal menu Forme',
    'The hexagonal terrain tile: we add three shapes from the Shapes menu'
  ),
  'right'
)
await shape('tool.polygon')
await fill(field(T['prop.name']), C.border)
await fill(field(T['prop.sides']), '6')
await place(5, 1.65, 40, 40)
await fill(field(T['prop.rotation']), '90')
await choose(field(T['prop.fill']), 'none')
await stroke('#FFFFFF', 0.6, 'dashed')
await look(
  t(
    `Poligono con ${T['prop.sides']}: 6, ruotato di 90° come la tessera. Niente riempimento, contorno bianco tratteggiato`,
    `Polygon with ${T['prop.sides']}: 6, rotated 90° like the tile. No fill, dashed white stroke`
  )
)
await shape('tool.star')
await fill(field(T['prop.name']), C.star)
await place(19, 15.65, 12, 12)
await fill(colorField(T['prop.fill']), '#F2C14E')
await fill(field(T['prop.points']), '6')
await fill(field(T['prop.innerRatio']), '45')
await look(
  t(
    `Stella: ${T['prop.points']} e ${T['prop.innerRatio']}. Con ${T['prop.radius']} le punte si arrotondano`,
    `Star: ${T['prop.points']} and ${T['prop.innerRatio']}. With ${T['prop.radius']} the points get rounded`
  )
)
await shape('tool.line')
await fill(field(T['prop.name']), C.line)
for (const [k, v] of [
  ['Ax', 10],
  ['Ay', 34],
  ['Bx', 40],
  ['By', 34]
])
  await fill(field(k), String(v))
await stroke('#FFFFFF', 0.5, 'dotted')
await about(
  field('Ax'),
  t(
    'La linea va da un punto A a un punto B: Ax, Ay, Bx e By al posto di X, Y, L e A',
    'The line goes from a point A to a point B: Ax, Ay, Bx and By instead of X, Y, W and H'
  )
)
await look(t('Qui a punti, sotto la stella', 'Here dotted, under the star'))
await save()
await openTemplate(N.tToken, N.resources, 0)
await shape('tool.ellipse')
await fill(field(T['prop.name']), C.frame)
await choose(field(T['prop.shape']), 'path')
await about(
  field(T['prop.shape']),
  t(
    `${T['shape.path']}: la sagoma di una SVG o di una PNG con trasparenza`,
    `${T['shape.path']}: the silhouette of an SVG or of a PNG with transparency`
  )
)
await r.click(props.getByRole('button', { name: T['editor.outlinePick'], exact: true }), {
  after: 800
})
await r.click(asset(I.badge), { after: 1000 })
await place(1, 1, 23, 23)
await choose(field(T['prop.fill']), 'none')
await stroke(`{${C.color}}`, 0.6)
await look(
  t(
    'La sagoma di una stella arrotondata fa da cornice; il contorno usa {colore}, come la colorazione',
    'The silhouette of a rounded star makes a frame; the stroke uses {color}, like the tint'
  )
)
await save()

// ================= 6. i riempimenti
await r.title(t('6 · I riempimenti', '6 · Fills'))
await r.clear()
await r.click(layer(C.bg), { after: 600 })
await about(
  field(T['prop.fill']),
  t(
    `${T['prop.fill']}: nessuno, un colore o una sfumatura`,
    `${T['prop.fill']}: none, a color or a gradient`
  )
)
await choose(field(T['prop.fill']), 'gradient')
await look(
  t(
    `${T['fill.gradient']} ${T['fill.linear'].toLowerCase()}: dall’alto verso il basso, con un angolo da cambiare`,
    `${T['fill.linear']} ${T['fill.gradient'].toLowerCase()}: from top to bottom, with an angle to change`
  )
)
await choose(field(T['fill.kind']), 'radial')
await fill(prow(T['fill.stop'].replace('{n}', '1')).locator('input.color-text').first(), '#FBF4E4')
await fill(prow(T['fill.stop'].replace('{n}', '2')).locator('input.color-text').first(), '#E2CFA6')
await look(
  t(
    `${T['fill.radial']}: chiara al centro, appena più scura sul bordo. Un effetto leggero`,
    `${T['fill.radial']}: light in the middle, slightly darker at the edge. A light effect`
  )
)
await about(
  props.getByRole('button', { name: T['fill.addStop'], exact: true }),
  t(
    `${T['fill.addStop']} aggiunge un colore; ogni colore ha la sua posizione in %`,
    `${T['fill.addStop']} adds a color; each color has its own position in %`
  )
)
await previewRow(N.resources, 3)
await look(t('L’oro, con la sua cornice', 'Gold, with its frame'))
await save()

// ================= 7. la sezione aspetto
await r.title(t(`7 · La sezione ${T['editor.appearance']}`, `7 · The ${T['editor.appearance']} section`))
await r.clear()
await openTemplate(N.tPlace, N.places, 1)
await r.click(layer(C.texture), { after: 600 })
await search(T['prop.blend'])
await choose(field(T['prop.blend']), 'multiply')
await clearSearch()
await r.click(layer(C.bg), { after: 600 })
await fill(colorField(T['prop.fill']), '#D8E3C6')
await look(
  t(
    `Trama in ${T['blend.multiply']}: scurisce il colore dello sfondo che sta sotto, che ora è verde`,
    `Texture in ${T['blend.multiply']}: it darkens the background color underneath, now green`
  )
)
await r.click(layer(C.texture), { after: 600 })
await fill(field(T['prop.opacity']), '60')
await look(
  t(
    `${T['prop.opacity']} 60%: la trama si vede appena. ${T['blend.screen']} invece schiarisce`,
    `${T['prop.opacity']} 60%: the texture barely shows. ${T['blend.screen']} lightens instead`
  )
)
await r.click(layer(C.art), { after: 600 })
await search(T['prop.fade'])
await check(prow(T['prop.fade']).locator('input[type=checkbox]').first())
await clearSearch()
await advanced(T['prop.fade'])
await fill(field(T['fade.start']), '65')
await about(
  field(T['fade.start']),
  t(
    `${T['prop.fade']}: ${T['fade.dir.down']}, ${T['fade.start'].toLowerCase()} 65%`,
    `${T['prop.fade']}: ${T['fade.dir.down']}, ${T['fade.start'].toLowerCase()} 65%`
  )
)
await look(
  t(
    'L’illustrazione sfuma nella carta dove comincia il testo',
    'The illustration fades into the paper where the text begins'
  )
)
await r.click(layer(C.title), { after: 600 })
await search(T['prop.shadow'])
await nullableColor(T['prop.shadow'], '#000000AA')
await clearSearch()
await advanced(T['prop.shadow'])
await fill(field(T['prop.shadowBlur']), '0.8')
await look(
  t(
    `${T['prop.shadow']}: colore, sfocatura e scostamento. Il titolo si stacca dal cielo`,
    `${T['prop.shadow']}: color, blur and offset. The title stands out from the sky`
  )
)
await r.click(layer(C.bg), { after: 600 })
await search(T['prop.locked'])
await about(
  checkbox(T['prop.locked']),
  t(
    `Lo sfondo è ${T['prop.locked'].toLowerCase()}: sulla tela un clic non lo prende per sbaglio`,
    `The background is ${T['prop.locked'].toLowerCase()}: on the canvas a click does not grab it by mistake`
  )
)
await clearSearch()
for (const n of [0, 2, 3]) {
  await previewRow(N.places, n)
  await r.wait(1400)
}
await look(t('Tutti i luoghi con le stesse scelte', 'All the places with the same choices'))
await save()

// ================= 8. sulla tessera e sui segnalini
await r.title(t('8 · Sulla tessera e sui segnalini', '8 · On the tile and the tokens'))
await r.clear()
await openTemplate(N.tTile, N.terrains, 0)
await r.click(layer(C.art), { after: 600 })
await advanced(T['prop.fade'])
await check(prow(T['prop.fade']).locator('input[type=checkbox]').first())
await choose(prow(T['prop.fade']).locator('select').first(), 'out')
await fill(field(T['fade.start']), '55')
await fill(field(T['fade.end']), '95')
await look(
  t(
    `${T['fade.dir.out']}: il bosco svanisce nella trama, che qui è già a ${T['imageFit.tile']}`,
    `${T['fade.dir.out']}: the forest fades into the texture, which here is already set to ${T['imageFit.tile']}`
  )
)
for (const n of [1, 2]) {
  await previewRow(N.terrains, n)
  await r.wait(1200)
}
await look(t('Montagna e lago con la stessa tessera', 'Mountain and lake with the same tile'))
await save()
await openSet(N.resources)
await r.focus(
  grid(),
  t(
    'I quattro segnalini: un solo template, colori e icone dal livello Valore risorsa',
    'The four tokens: one template, colors and icons from the resource Value layer'
  ),
  'right',
  { pad: 4 }
)
await r.title(
  t(
    'Un ritratto dentro un cerchio? Serve la maschera di un gruppo: video 26',
    'A portrait inside a circle? You need a group mask: video 26'
  ),
  4200
)
await r.title(
  t(
    'Gli altri video: 11 per immagini, icone e font, 7 per gli altri componenti, 21 per le icone nel testo',
    'Other videos: 11 for images, icons and fonts, 7 for the other components, 21 for icons in text'
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
