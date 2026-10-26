// Video 7: plance, tessere, segnalini e dadi (circa 6 minuti, senza voce). Il progetto di esempio con i
// componenti di progetto-plance.mjs: tessere esagonali e un template derivato, un segnalino con la
// sagoma di un'immagine, la plancia con la mappa a esagoni e un tracciato del punteggio (le formule nelle
// caselle sono solo accennate: le spiega il video sulle griglie), il dado delle risorse con più di sei facce.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node --experimental-strip-types --no-warnings scripts/video/plance.mjs it|en
// FAST=1 accorcia attese e scrittura, per provare il percorso senza badare al ritmo.
import { launch, makeProject, mockOpen } from './lib.mjs'
import { extend, TRACK } from './progetto-plance.mjs'
const lang = process.argv[2] || 'it'
const it = lang === 'it'
const t = (a, b) => (it ? a : b)
const project = makeProject(lang)
const N = await extend(project, lang)
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
// riquadro e testo spariscono prima di ogni clic: il clic apre finestre o cambia vista
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
        // i campi delle proprietà e delle finestre; una finestra intera resta nella vista normale
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
r.focus = async (locs, ...rest) => {
  await zoomTo(locs)
  return focus0(locs, ...rest)
}
const title0 = r.title.bind(r)
r.title = async (...a) => {
  await r.unzoom(700)
  return title0(...a)
}

const dialog = () => win.locator('[role="dialog"]').last()
const props = win.locator('aside.properties')
const stage = () => win.locator('.canvas-stage').first()
const grid = () => win.locator('.card-grid').first()
const field = (label, scope = props) =>
  scope
    .locator('.field')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${label}$`) }) })
    .locator('input:not([type=range]), textarea, select')
    .first()
const layer = (n) => win.locator('.layers .layer-name', { hasText: new RegExp(`^${n}$`) }).first()
const tool = (key) =>
  win.locator(`button.tool[title="${T[key]}"], button.tool[data-tip="${T[key]}"]`).first()
const source = (kind) =>
  win
    .locator('aside.properties .source-line .segmented button')
    .filter({ hasText: new RegExp(`^${kind === 'column' ? T['source.short.column'] : T['source.kind.' + kind]}$`) })
    .first()
const side = (name) => win.locator('.sidebar').getByText(name, { exact: true }).first()
// con il mouse sopra, il suggerimento dell'app sposta title in data-tip
const asset = (name) =>
  dialog().locator(`.asset-tile[title*="${name}"], .asset-tile[data-tip*="${name}"]`).first()
const saveButton = () =>
  win
    .locator('header.toolbar button')
    .filter({ hasText: new RegExp(`^(${T['app.save']}|${T['app.saved']})$`) })
    .first()

async function fill(loc, text, { tab = true } = {}) {
  await loc.scrollIntoViewIfNeeded()
  await zoomTo(loc)
  await r.click(loc, { after: 250, before: 200, ms: 450 })
  await win.keyboard.press('Control+A')
  await r.type(text)
  if (tab) await win.keyboard.press('Tab')
  await r.wait(250)
}
async function choose(loc, value) {
  await loc.scrollIntoViewIfNeeded()
  await zoomTo(loc)
  await r.click(loc, { after: 200, before: 200, ms: 450 })
  await win.keyboard.press('Escape')
  await loc.selectOption(value)
  await r.wait(600)
}
async function place(x, y, w, h) {
  await fill(field('X'), String(x))
  await fill(field('Y'), String(y))
  await fill(field(T['prop.w']), String(w))
  await fill(field(T['prop.h']), String(h))
}
/** ingrandisce la tela attorno al livello selezionato (⌘/Ctrl + rotella, come si fa con il mouse) */
async function zoomOnSelection(steps = 4) {
  const a = await win.locator('.handle.h-nw').first().boundingBox()
  const b = await win.locator('.handle.h-se').first().boundingBox()
  await r.clear(150)
  await r.glide((a.x + b.x + b.width) / 2, (a.y + b.y + b.height) / 2, 600)
  await r.wait(300)
  await win.keyboard.down('Control')
  for (let i = 0; i < steps; i++) {
    await win.mouse.wheel(0, -120)
    await r.wait(180)
  }
  await win.keyboard.up('Control')
  await r.wait(400)
  // poi la tela scorre fino a mettere il livello al centro
  const c = await win.locator('.handle.h-nw').first().boundingBox()
  const d = await win.locator('.handle.h-se').first().boundingBox()
  const v = await win.locator('.canvas-viewport').first().boundingBox()
  const dx = (c.x + d.x) / 2 - (v.x + v.width / 2)
  const dy = (c.y + d.y) / 2 - (v.y + v.height / 2)
  await win
    .locator('.canvas-viewport')
    .first()
    .evaluate((el, [dx, dy]) => el.scrollBy({ left: dx, top: dy, behavior: 'smooth' }), [dx, dy])
  await r.wait(600)
}
const zoomFit = () => r.click(win.getByRole('button', { name: T['editor.zoomFit'], exact: true }))
async function open(name) {
  await r.click(side(name))
  await r.clear(1000)
  await r.overlay()
}
async function save() {
  await r.click(saveButton())
  await r.clear(600)
}

await r.overlay()
await r.title(t('Plance, tessere, segnalini e dadi', 'Boards, tiles, tokens and dice'))
await r.title(
  t(
    'In Stella ogni componente è un template, e ogni riga del foglio è un pezzo',
    'In Stella every component is a template, and every sheet row is a piece'
  )
)
await r.clear()
await mockOpen(app, project)
await r.click(win.getByText(T['start.openProject']))
await r.clear(2200)
await r.overlay()

// ---- 1. tessere esagonali
await r.title(t('Tessere esagonali', 'Hexagonal tiles'))
await r.clear()
await open(N.land)
await choose(win.locator('.editor-toolbar select').last(), { label: N.lands })
await r.focus(
  stage(),
  t(
    'Il template dei terreni: per ora è un rettangolo di 46 × 40 mm',
    'The land template: for now it’s a 46 × 40 mm rectangle'
  ),
  'left',
  { pad: 0 }
)
await r.focus(
  field(T['prop.cardShape']),
  t('Forma della carta: esagono', 'Card shape: hexagon'),
  'left'
)
await choose(field(T['prop.cardShape']), 'hexagon')
const fit = props.locator('button', { hasText: T['editor.hexagonFit'].split('(')[0].trim() })
await r.focus(
  fit,
  t(
    'L’esagono è sempre regolare: questo tasto porta la carta alla misura giusta',
    'The hexagon is always regular: this button gives the card the right size'
  ),
  'left'
)
await r.click(fit)
await r.click(dialog().getByRole('button', { name: T['resize.scale'], exact: true }))
await r.wait(600)
await r.click(layer(N.background), { after: 500 })
await r.focus(
  field(T['source.formula']),
  t(
    'Il colore viene dal tipo di terreno: bosco verde, cava grigia, campo giallo',
    'The color comes from the land type: green forest, gray quarry, yellow field'
  ),
  'left'
)
await save()
await open(N.lands)
await r.focus(
  grid(),
  t(
    'Il set: una riga per terreno, con il numero di copie',
    'The set: one row per land, with the number of copies'
  ),
  'right',
  { pad: 6 }
)

// ---- 1b. un template derivato
await r.title(t('Una variante: il template derivato', 'A variant: the derived template'))
await r.clear()
await open(N.land)
await win.locator('.editor-toolbar select').last().selectOption({ label: N.lands })
await r.click(win.locator('.editor-toolbar .more-button').first())
await r.click(win.getByText(T['inherit.deriveShort'], { exact: true }).last())
await r.clear(500)
await win.keyboard.press('Control+A')
await r.type(N.port)
await r.wait(400)
await r.focus(
  dialog(),
  t(
    'Il porto parte dal terreno e cambia solo quello che serve',
    'The port starts from the land and changes only what it needs'
  ),
  'right',
  { pad: 0 }
)
await r.click(dialog().locator('button[type=submit]'))
await r.clear(1500)
await r.overlay()
await r.focus(
  win.locator('.editor-toolbar .derived-from').first(),
  t(
    'Deriva da «' + N.land + '»: forma, misure e livelli vengono da lì',
    'Derived from “' + N.land + '”: shape, size and layers come from there'
  ),
  'below'
)
await r.click(layer(N.icon), { after: 500 })
await r.click(source('fixed'), { after: 400 })
await r.click(props.locator('.pick-btn:not(.fx-button)').first())
await r.clear(800)
await r.click(asset(N.coin))
await r.clear(800)
await r.click(layer(N.background), { after: 500 })
await r.click(source('fixed'), { after: 400 })
await fill(
  props
    .locator('.field')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${T['prop.fill']}$`) }) })
    .locator('input.color-text')
    .first(),
  '#3E7CB1'
)
await r.click(tool('tool.text'))
await r.clear(400)
await fill(field(T['prop.name']), it ? 'scambio' : 'trade')
await fill(field(T['prop.text']), '2:1')
await fill(field(T['prop.size']), '14')
await choose(field(T['prop.weight']), '800')
await fill(field(T['prop.color']), '#FFFFFF')
await choose(field(T['prop.align']), 'center')
await place(13, 29, 20, 7)
await r.focus(
  win.locator('aside.layers .layers-list').first(),
  t(
    'Nei livelli: la freccia segna ciò che il porto ha cambiato, il + ciò che c’è solo qui',
    'In the layers: the arrow marks what the port changed, the + what exists only here'
  ),
  'right',
  { pad: 4 }
)
await save()
await r.click(win.locator('.editor-toolbar .derived-from button.link').first())
await r.clear(1000)
await r.overlay()
await r.click(layer(N.icon), { after: 500 })
await r.focus(
  props.locator('.field-grid').first(),
  t(
    'Ora nel template base l’icona diventa più grande…',
    'Now in the base template the icon gets bigger…'
  ),
  'left'
)
await place(10, 6, 26, 26)
await save()
await open(N.port)
await r.focus(
  stage(),
  t(
    '…e anche il porto la segue: tutto ciò che non ha cambiato viene dal base',
    '…and the port follows: everything it didn’t change comes from the base'
  ),
  'left',
  { pad: 0 }
)

// ---- 2. un segnalino con una sagoma
await r.title(t('Segnalini con una sagoma', 'Tokens with a silhouette'))
await r.clear()
await open(N.token)
await r.focus(
  stage(),
  t(
    'Un segnalino difesa da 25 mm. Il rotondo è nel video 2: qui la forma di uno scudo',
    'A 25 mm defense token. The round one is in video 2: here a shield shape'
  ),
  'left',
  { pad: 0 }
)
await choose(field(T['prop.cardShape']), 'path')
await r.click(props.getByRole('button', { name: T['editor.outlinePick'], exact: true }))
await r.clear(800)
await r.focus(
  dialog(),
  t(
    'La sagoma viene da un’immagine: una SVG o una PNG con trasparenza',
    'The silhouette comes from an image: an SVG or a PNG with transparency'
  ),
  'right',
  { pad: 0 }
)
await r.click(asset(N.shield))
await r.clear(1000)
await r.focus(
  stage(),
  t(
    'La carta prende il contorno dello scudo: è la linea di taglio',
    'The card takes the shield outline: it’s the cut line'
  ),
  'left',
  { pad: 0 }
)
await save()
await open(N.defense)
await r.focus(
  grid(),
  t(
    'Tre valori, con le copie. Per un’altra sagoma, un altro template',
    'Three values, with copies. For another silhouette, another template'
  ),
  'right',
  { pad: 6 }
)

// ---- 3. la plancia
await r.title(t('La plancia', 'The board'))
await r.clear()
await open(N.board)
await r.focus(
  stage(),
  t(
    'Una plancia da 280 × 190 mm: la mappa è un livello griglia, esagoni a incastro',
    'A 280 × 190 mm board: the map is a grid layer, interlocking hexagons'
  ),
  'left',
  { pad: 0 }
)
await r.click(layer(N.map), { after: 500 })
await r.focus(
  [field(T['prop.cell']), field(T['prop.rows'])],
  t(
    'Caselle quadrate, tonde, esagonali, triangolari o a rombo, in righe e colonne',
    'Square, round, hexagonal, triangular or diamond cells, in rows and columns'
  ),
  'left'
)

// il tracciato del punteggio, dal vivo
await r.title(t('Un tracciato del punteggio', 'A score track'))
await r.clear()
await r.click(layer(N.title), { after: 400 })
await r.click(tool('tool.grid'))
await r.clear(500)
await fill(field(T['prop.name']), it ? 'tracciato' : 'track')
await choose(field(T['prop.cell']), 'square')
await fill(field(T['prop.rows']), String(TRACK.rows))
await fill(field(T['prop.columns']), String(TRACK.columns))
await place(TRACK.x, TRACK.y, TRACK.w, TRACK.h)
await r.focus(
  stage(),
  t('Cinquanta caselle: 5 righe per 10 colonne', 'Fifty cells: 5 rows by 10 columns'),
  'left',
  { pad: 0 }
)
const content = field(T['prop.content'])
await r.focus(
  content,
  t(
    'Contenuto delle caselle: un gruppo che si ripete in ogni casella',
    'Cell content: a group repeated in every cell'
  ),
  'left'
)
await choose(content, N.cell)
await r.click(props.getByRole('button', { name: T['editor.gridContentPlace'], exact: true }))
await r.wait(800)
await r.focus(
  stage(),
  t(
    'Il gruppo ha un numero: {cell.index} vale 1, 2, 3… in ogni casella',
    'The group has a number: {cell.index} is 1, 2, 3… in each cell'
  ),
  'left',
  { pad: 0 }
)

// le formule nelle caselle: solo un accenno, i dettagli sono nel video sulle griglie
await r.focus(
  stage(),
  t(
    'Con le formule ogni casella può cambiare: numeri evidenziati, colori diversi, caselle nascoste',
    'With formulas each cell can change: highlighted numbers, different colors, hidden cells'
  ),
  'left',
  { pad: 0 }
)
await r.title(
  t(
    'Come si scrivono queste formule lo vediamo con calma nel video sulle griglie',
    'We’ll see how to write these formulas, step by step, in the grids video'
  ),
  4200
)
await r.clear()
await save()
await r.title(
  t(
    'Per stamparla su più fogli A4 c’è il PDF a poster: lo vediamo nel video sulla stampa',
    'To print it on several A4 sheets there’s the poster PDF: we’ll see it in the printing video'
  ),
  4200
)
await r.clear()

// ---- 4. il dado
await r.title(t('Il dado', 'The die'))
await r.clear()
await open(N.dice)
await r.focus(
  grid(),
  t(
    'Un template quadrato da 18 mm e sei righe: le sei facce del dado',
    'An 18 mm square template and six rows: the six faces of the die'
  ),
  'right',
  { pad: 6 }
)
await r.focus(
  grid(),
  t(
    'Nell’ordine del foglio: la prima riga va sulla faccia 1. Le facce opposte fanno 7',
    'In sheet order: the first row goes on face 1. Opposite faces add up to 7'
  ),
  'right',
  { pad: 6 }
)
await r.title(
  t(
    'Ogni sei righe, un dado. Con 12 righe: due dadi, le righe 1-6 e 7-12',
    'Every six rows, one die. With 12 rows: two dice, rows 1-6 and 7-12'
  ),
  4600
)
await r.clear()
const form = win.locator('.card-form')
const cardField = (col) =>
  form
    .locator('label')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${col}$`) }) })
    .locator('input, textarea')
    .first()
for (const [face, icon] of [
  [7, N.coin],
  [8, N.sword]
]) {
  await r.click(win.locator(`button[title="${T['tip.addCard']}"], button[data-tip="${T['tip.addCard']}"]`).first())
  await r.clear(600)
  await fill(cardField(N.face), String(face))
  await fill(cardField(N.icon), icon)
  await r.wait(600)
}
await r.focus(
  grid(),
  t(
    'Otto righe non sono un multiplo di sei: il secondo dado ha solo due facce diverse',
    'Eight rows aren’t a multiple of six: the second die has only two different faces'
  ),
  'right',
  { pad: 6 }
)
await r.title(
  t(
    'Il secondo dado le ripete a turno: 7, 8, 7, 8, 7, 8',
    'The second die repeats them in turn: 7, 8, 7, 8, 7, 8'
  ),
  4200
)
await r.clear()
await save()
await r.click(win.locator('header.toolbar').getByText(T['app.export'], { exact: true }).first())
await r.clear(800)
await r.click(dialog().locator('.export-goal').filter({ hasText: T['export.goal.tts'] }).first())
await r.wait(600)
// solo il set del dado
const sets = dialog().locator('.export-sets label')
for (let i = 0; i < (await sets.count()); i++) {
  const label = sets.nth(i)
  if ((await label.innerText()).trim() !== N.dice)
    await r.click(label, { ms: 250, before: 100, after: 150 })
}
const ttsRow = dialog()
  .locator('.tts-object')
  .filter({ has: win.locator('.tts-object-name', { hasText: new RegExp(`^${N.dice}$`) }) })
  .first()
await choose(ttsRow.locator('select').first(), 'die')
await r.focus(
  ttsRow,
  t(
    'In Tabletop Simulator il set diventa un dado vero (lo mostra il video 3)',
    'In Tabletop Simulator the set becomes a real die (video 3 shows it)'
  ),
  'left',
  { pad: 4 }
)
const run = dialog().getByRole('button', { name: T['export.run'], exact: true })
await r.click(run)
await win.waitForTimeout(1000)
for (let i = 0; i < 240 && !(await run.isEnabled()); i++) await win.waitForTimeout(500)
await r.wait(800)
await r.focus(
  dialog().locator('.export-result').first(),
  t(
    'L’esportazione lo segnala: l’ultimo dado ripete le sue facce',
    'The export warns you: the last die repeats its faces'
  ),
  'above',
  { pad: 4 }
)
await r.title(
  t(
    'Le copie di ogni dado sono quelle della sua prima faccia',
    'The copies of each die are those of its first face'
  ),
  3800
)
await r.clear()
await r.click(dialog().getByRole('button', { name: T['export.close'], exact: true }))
await r.wait(600)

// ---- chiusura
await r.title(
  t(
    'Carte, tessere, segnalini, plance e dadi: un template per ogni componente',
    'Cards, tiles, tokens, boards and dice: one template for each component'
  ),
  4600
)
await r.title(
  t(
    'Tutto il resto è nella guida: stella.lucadj.eu',
    'Everything else is in the guide: stella.lucadj.eu'
  ),
  4600
)
await r.clear(600)
const p = await r.finish()
console.log('VIDEO', p)
