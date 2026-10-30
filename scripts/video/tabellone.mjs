// Video 24, approfondimento: il tabellone (circa 18 minuti, senza voce). Sul progetto «Tabellone» di
// progetto-tabellone.mjs un tabellone quadrato di 38 × 38 cm, vuoto, si riempie un pezzo alla volta:
// il percorso sul bordo (griglia 11 × 11 con il centro nascosto e il numero continuo a percorso), le zone
// dei mazzi con copia e incolla, la mappa esagonale con le aree, lo spazio per le tessere tonde, titolo,
// tracciato dei round e legenda, il retro; poi la plancia giocatore e la pedina con il colore dal foglio,
// la stampa a poster su 2 × 2 fogli A4 e gli snap point e i tag per Tabletop Simulator.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node --experimental-strip-types --no-warnings scripts/video/tabellone.mjs it|en
// FAST=1 accorcia attese e scrittura; SNAP=<cartella> salva una schermata dopo ogni testo.
import { docs } from '../guide/lib.mjs'
import { launch, mockOpen } from './lib.mjs'
import { make } from './progetto-tabellone.mjs'
const lang = process.argv[2] || 'it'
const it = lang === 'it'
const t = (a, b) => (it ? a : b)
const project = `${docs(lang)}/Stella/${it ? 'Tabellone' : 'Game board'}`
const N = await make(project, lang)
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
const rx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const labelled = (label, scope = props) =>
  scope
    .locator('.field')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${rx(label)}$`) }) })
    .first()
const field = (label, scope = props) =>
  labelled(label, scope).locator('input:not([type=range]), textarea, select').first()
const colorField = (label, scope = props) => labelled(label, scope).locator('input.color-text').first()
const layer = (n) => win.locator('.layers .layer-name', { hasText: new RegExp(`^${n}$`) }).first()
const layers = () => win.locator('aside.layers .layers-list').first()
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

// al centro del pannello: in alto la barra di ricerca resta ferma e coprirebbe il campo
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
/** come fill, ma il testo entra in un colpo solo: in un gruppo centrato ogni tasto sposterebbe il gruppo */
async function put(loc, text) {
  await center(loc)
  await zoomTo(loc)
  await r.click(loc, { after: 250, before: 200, ms: 450 })
  await win.keyboard.press('Control+A')
  await win.keyboard.insertText(text)
  await win.keyboard.press('Tab')
  await r.wait(500)
}
async function choose(loc, value) {
  await center(loc)
  await zoomTo(loc)
  await r.click(loc, { after: 200, before: 200, ms: 450 })
  await win.keyboard.press('Escape')
  await loc.selectOption(value)
  await r.wait(600)
}
async function check(loc, on = true) {
  await center(loc)
  if ((await loc.isChecked()) === on) return
  await zoomTo(loc)
  await r.click(loc, { after: 500, before: 200, ms: 450 })
}
// dalla 1.6 cambiare L e A tiene fermo il centro: prima la misura, poi la posizione
async function place(x, y, w, h) {
  await fill(field(T['prop.w']), String(w))
  await fill(field(T['prop.h']), String(h))
  await fill(field('X'), String(x))
  await fill(field('Y'), String(y))
}
/** il contorno: la spunta, il colore, lo spessore e, se c'è, il tipo di linea */
async function stroke(label, color, width, dash, scope = props) {
  const row = labelled(label, scope)
  await check(row.locator('input[type=checkbox]').first())
  await fill(row.locator('input.color-text').first(), color)
  await fill(row.locator('input.num').first(), String(width))
  if (dash) await choose(row.locator('select').first(), dash)
}
/** zoom sul tabellone e testo sopra: per guardare da vicino il risultato */
async function look(text, opts = {}) {
  await r.clear(100)
  await r.zoom(stage(), { max: 1.7, fill: 0.72 })
  await focus0(stage(), text, 'above', { pad: 0, dim: false, ...opts })
  await snap()
}
async function explain(loc, texts, sideOf = 'left') {
  for (const text of texts) await r.focus(loc, text, sideOf)
}
async function open(name) {
  await r.click(side(name))
  await r.clear(1000)
  await r.overlay()
}
async function save() {
  await r.click(saveButton(), { after: 600 })
}
async function view(key) {
  await r.click(win.locator('.set-header .segmented button').filter({ hasText: T[key] }).first(), {
    after: 900
  })
}
async function face(key) {
  await r.click(
    win
      .locator('main button, .editor button')
      .filter({ hasText: new RegExp(`^${T[key]}$`) })
      .first(),
    { after: 900 }
  )
}
/** proprietà del template: niente selezionato */
async function templateProps() {
  await win.keyboard.press('Escape')
  await r.wait(300)
}
async function shape(key) {
  await r.click(win.locator(`.menu-button[title="${T['tool.shapes']}"]`).first(), { after: 500 })
  await r.click(win.locator('.menu-panel .menu-item').filter({ hasText: T[key] }).first(), {
    after: 600
  })
  await r.clear(400)
}
async function key(k, ms = 800) {
  // copia e incolla vanno ai livelli, non al campo delle proprietà rimasto attivo
  await win.evaluate(() => document.activeElement?.blur?.())
  await win.keyboard.press(k)
  await r.wait(ms)
}
/** seleziona più livelli fratelli: un clic sul primo, Maiuscole + clic sull'ultimo */
async function selectRange(a, b) {
  await r.click(layer(a), { after: 400 })
  await win.keyboard.down('Shift')
  await r.click(layer(b), { after: 400 })
  await win.keyboard.up('Shift')
}

// ---- assistente formule
const sentence = () => dialog().locator('.fx-guided > .fx-sentence').first()
const leaf = (i) => sentence().locator(':scope > .fx-leaf').nth(i)
const picker = () => dialog().locator('.fx-picker').first()
const choices = () => sentence().locator('select.fx-choice')
async function card(k) {
  await r.click(dialog().locator('.fx-card').filter({ hasText: T[k] }).first(), { after: 900 })
}
async function applyFx() {
  await r.click(dialog().getByRole('button', { name: T['fx.apply'], exact: true }), {
    after: 1000
  })
}
async function choice(value) {
  const all = choices()
  const n = await all.count()
  for (let i = 0; i < n; i++) {
    const values = await all.nth(i).evaluate((s) => [...s.options].map((o) => o.value))
    if (values.includes(value)) return all.nth(i)
  }
  throw new Error('scelta non trovata: ' + value)
}
async function pickChoice(value, text) {
  const sel = await choice(value)
  await r.click(sel, { after: 200, before: 200, ms: 450 })
  await win.keyboard.press('Escape')
  await sel.selectOption(value)
  await r.wait(700)
  if (text) await r.focus(dialog().locator('.fx-result-box').first(), text, 'above', { pad: 4 })
}
async function tab(k) {
  const b = picker().getByRole('tab', { name: T[k], exact: true })
  if ((await b.getAttribute('aria-selected')) !== 'true') await r.click(b, { after: 500, ms: 400 })
}
async function setItem(i, name, kind = 'fx.tab.variable') {
  await r.click(leaf(i), { after: 600, ms: 450 })
  await tab(kind)
  await r.click(picker().locator('.fx-list button').filter({ hasText: name }).first(), {
    after: 600,
    ms: 450
  })
}
async function setText(i, text) {
  await r.click(leaf(i), { after: 600, ms: 450 })
  const tt = picker().getByRole('tab', { name: T['fx.tab.text'], exact: true })
  if (!(await tt.count())) await r.click(picker().locator('.fx-more').first(), { after: 500 })
  await tab('fx.tab.text')
  const area = picker().locator('.fx-tab-body textarea').first()
  await r.click(area, { after: 200, ms: 400 })
  await win.keyboard.press('Control+A')
  await r.type(text)
  await r.click(picker().locator('.fx-tab-body button.primary').first(), { after: 600 })
}
async function setNumber(i, value) {
  await r.click(leaf(i), { after: 600, ms: 450 })
  await tab('fx.tab.number')
  const input = picker().locator('.fx-tab-body input').first()
  await r.click(input, { after: 200, ms: 400 })
  await win.keyboard.press('Control+A')
  await r.type(value)
  await r.click(picker().getByRole('button', { name: T['fx.use'], exact: true }), { after: 600 })
}
async function addItem() {
  await r.click(sentence().locator('.fx-add').first(), { after: 600, ms: 450 })
}
/** «Inserisci un contenuto»: 0 Valore, 1 Forma o immagine, 2 Gruppo */
async function insertContent(kind, item) {
  const insert = button('editor.gridContentInsert')
  await center(insert)
  await r.click(insert, { after: 900 })
  await r.click(dialog().locator('.cell-content-choices button').nth(kind), { after: 1000 })
  if (item)
    await r.click(dialog().locator('.cell-content-list button').filter({ hasText: item }).first(), {
      after: 1200
    })
}
/** la griglia con la casella fissa: righe, colonne, forma, misura e posizione */
async function grid(name, { rows, cols, cell = 'square', w, h = w, x, y, gap, interlock = false }) {
  await r.click(tool('tool.grid'))
  await r.clear(600)
  await fill(field(T['prop.name']), name)
  await fill(field(T['prop.rows']), String(rows))
  await fill(field(T['prop.columns']), String(cols))
  if (cell !== 'square') await choose(field(T['prop.cell']), cell)
  if (interlock) await check(field(T['prop.interlock']))
  if (gap !== undefined) await fill(field(T['prop.gap']), String(gap))
  await check(field(T['prop.autoSize']), false)
  if (cell === 'hex') await fill(field(T['prop.cellAcross']), String(w))
  else {
    await fill(field(T['prop.cellWidth']), String(w))
    await fill(field(T['prop.cellHeight']), String(h))
  }
  await fill(field('X'), String(x))
  await fill(field('Y'), String(y))
}

// ---- regole delle caselle
const rule = (i) => props.locator('.cell-rule').nth(i)
const ruleCheck = (i, k, name) => field(T[k].replace('{name}', name ?? ''), rule(i))
async function addRule() {
  const add = button('editor.cellRuleAdd')
  await center(add)
  await r.click(add, { after: 700 })
}
async function openPicker(i, text) {
  const pick = rule(i).getByRole('button', { name: T['cellPicker.open'], exact: true })
  await center(pick)
  if (text) await r.focus(pick, text, 'left')
  await r.click(pick, { after: 900 })
}
const pickCell = (n) =>
  dialog()
    .locator('.cell-picker-cell')
    .nth(n - 1)
async function pickCells(i, cells, text) {
  await openPicker(i, text)
  for (const n of cells) await r.click(pickCell(n), { after: 350, ms: 350 })
}
/** trascina sulle caselle: il mouse resta premuto e passa da una casella all'altra nell'ordine dato */
async function dragCells(path) {
  const at = async (n) => {
    const b = await pickCell(n).boundingBox()
    return [b.x + b.width / 2, b.y + b.height / 2]
  }
  await r.glide(...(await at(path[0])), 600)
  await win.mouse.down()
  for (const n of path.slice(1)) await r.glide(...(await at(n)), 700)
  await win.mouse.up()
  await r.wait(600)
}
async function usePicked() {
  await r.click(dialog().getByRole('button', { name: T['cellPicker.apply'], exact: true }), {
    after: 700
  })
}
async function setRuleOpen(i, on) {
  const isOpen = await rule(i).evaluate((el) => el.classList.contains('open'))
  if (isOpen !== on) {
    const head = rule(i).locator('.cell-rule-toggle').first()
    await center(head)
    await r.click(head, { after: 600, ms: 400 })
  }
}
async function closeRules() {
  const n = await props.locator('.cell-rule').count()
  for (let i = 0; i < n; i++) await setRuleOpen(i, false)
}
async function fillRule(i, color) {
  await check(ruleCheck(i, 'editor.cellRuleFill'))
  await fill(colorField(T['prop.cellFill'], rule(i)), color)
}
/** un testo nuovo, con le proprietà di base */
async function text(name, value, { size, weight, color, align = 'center' } = {}) {
  await r.click(tool('tool.text'))
  await r.clear(400)
  await fill(field(T['prop.name']), name)
  await fill(field(T['prop.text']), value)
  if (size) await fill(field(T['prop.size']), String(size))
  if (weight) await choose(field(T['prop.weight']), String(weight))
  if (color) await fill(colorField(T['prop.color']), color)
  if (align) await choose(field(T['prop.align']), align)
}
/** attiva lo snap (di un livello o di ogni casella) con i suoi tag */
async function snapOn(key, tags, rotated = false) {
  const box = field(T[key])
  await center(box)
  await check(box)
  await fill(field(T['prop.snapTags']), tags)
  if (rotated) await check(field(T['prop.snapRotated']))
}

const TRACK = it ? 'percorso' : 'track'
const TRACK_TEXT = `${TRACK}_text`
const MAP = it ? 'mappa' : 'map'
const ROUND = it ? 'round' : 'rounds'
const ROUND_TEXT = `${ROUND}_text`
const TILES = it ? 'tessere' : 'tiles'
const ZONE = it ? 'zona' : 'zone'
const LABEL = it ? 'scritta' : 'label'
const DECK = it ? 'mazzo' : 'deck'
const HEX = it ? 'esagono' : 'hexagon'
const AREA = it ? 'area' : 'area'
const LEGEND = it ? 'legenda' : 'legend'
const ARROW = it ? 'freccia' : 'arrow'
const GAME = it ? 'Frontiera' : 'Frontier'
const TAG = {
  pawn: it ? 'pedina' : 'pawn',
  cards: it ? 'carte' : 'cards',
  tiles: it ? 'tessere' : 'tiles',
  marker: it ? 'segnalino' : 'marker',
  hex: it ? 'esagono' : 'hex'
}
const COLORS = { forest: '#3D8B4F', lake: '#2E6DB4', mountains: '#8C8A85', plain: '#E5C76B' }
// il bordo: 11 × 11 caselle da 34 mm, da 3 a 377 mm; il centro libero va da 37 a 343
const B = { cell: 34, at: 3 }
// la griglia 11 × 11: le caselle del centro, riga per riga, a serpentina per il trascinamento
const inner = []
for (let row = 2; row <= 10; row++) {
  const a = (row - 1) * 11 + 2
  const b = (row - 1) * 11 + 10
  inner.push(...(row % 2 ? [b, a] : [a, b]))
}

// ================= inizio
await r.overlay()
await r.title(t('Il tabellone', 'The game board'))
await r.title(
  t(
    'Un tabellone di 38 × 38 cm, costruito un pezzo alla volta e poi stampato e portato su Tabletop Simulator',
    'A 38 × 38 cm game board, built one piece at a time, then printed and taken to Tabletop Simulator'
  ),
  5600
)
await r.clear()
await mockOpen(r.app, project)
await r.click(win.getByText(T['start.openProject']))
await r.clear(2200)
await r.overlay()

// ---- 1. il progetto
await r.title(t('Il progetto', 'The project'))
await r.clear()
await r.focus(
  win.locator('.sidebar').first(),
  t(
    'Il progetto «Tabellone» si scarica dal sito: il tabellone vuoto, le carte, le tessere tonde, le plance e le pedine',
    'The “Game board” project is on the site: the empty board, the cards, the round tiles, the player boards and the pawns'
  ),
  'right',
  { pad: 4 }
)
await open(N.tBoard)
await look(
  t(
    'Il template del tabellone: 380 × 380 mm, solo lo sfondo',
    'The board template: 380 × 380 mm, just the background'
  )
)

// ---- 2. il percorso sul bordo
await r.title(t('Il percorso sul bordo', 'The track around the edge'))
await r.clear()
await grid(TRACK, { rows: 11, cols: 11, w: B.cell, x: B.at, y: B.at, gap: 0 })
await fill(colorField(T['prop.cellFill']), '#F5EEDC')
await stroke(T['prop.cellStroke'], '#7A6A55', 0.6)
await look(
  t(
    'Una griglia 11 × 11 con caselle fisse di 34 mm: occupa tutto il tabellone',
    'An 11 × 11 grid with fixed 34 mm cells: it fills the whole board'
  )
)
await addRule()
await openPicker(
  0,
  t('Scegli le caselle: il centro va nascosto', 'Choose the cells: the middle must go')
)
await r.focus(
  dialog().locator('.cell-picker').first(),
  t(
    'Trascinando si scelgono più caselle in un colpo',
    'Dragging picks many cells in one go'
  ),
  'right',
  { pad: 0 }
)
await r.clear(200)
await dragCells(inner)
await usePicked()
await check(ruleCheck(0, 'editor.cellRuleHidden'))
await look(
  t('Nascondi la casella: sul bordo restano 40 caselle', 'Hide the cell: 40 cells are left on the edge')
)
await insertContent(0)
await card('fx.card.cellNumber')
await pickChoice(
  'path',
  t(
    'A percorso: il numero passa sempre alla casella accanto',
    'Along a path: the number always moves to the next cell'
  )
)
await pickChoice(
  'visible',
  t('E salta le caselle nascoste', 'And skips the hidden cells')
)
await applyFx()
await fill(field(T['prop.size']), '22')
await choose(field(T['prop.weight']), '700')
await fill(colorField(T['prop.color']), '#3B2A14')
await look(t('1, 2, 3… fanno il giro del tabellone', '1, 2, 3… go all the way around the board'))

await r.click(layer(TRACK), { after: 700 })
await setRuleOpen(0, false)
await addRule()
await r.click(rule(1).locator('button.fx-button').first(), { after: 1000 })
await card('fx.card.everyNCond')
await setNumber(0, '5')
await pickChoice(
  TRACK_TEXT,
  t(
    'Ogni 5 caselle, contando il numero scritto',
    'Every 5 cells, counting the written number'
  )
)
await applyFx()
await fillRule(1, '#F2D27A')
await look(t('Ogni 5 caselle, uno sfondo chiaro', 'Every 5 cells, a light background'))

await setRuleOpen(1, false)
await addRule()
await r.click(rule(2).locator('button.fx-button').first(), { after: 1000 })
await card('fx.card.everyNCond')
await setNumber(0, '10')
await pickChoice(TRACK_TEXT)
await applyFx()
const own = rule(2).locator('button').filter({ hasText: T['editor.ruleContent'] }).first()
await center(own)
await r.focus(
  own,
  t(
    'Ogni 10 caselle: Personalizza contenuto, per un numero più grande e una stella',
    'Every 10 cells: Customize content, for a bigger number and a star'
  ),
  'left'
)
await r.click(own, { after: 900 })
await r.click(dialog().locator('.cell-content-choices button').first(), { after: 1400 })
await card('fx.card.cellNumber')
await pickChoice('path')
await pickChoice('visible')
await applyFx()
await fill(field(T['prop.size']), '32')
await choose(field(T['prop.weight']), '800')
await fill(colorField(T['prop.color']), '#8E2B1E')
// la stella nell'angolo della casella 10: la prima della regola, in alto a destra
await r.click(tool('tool.image'))
await r.clear(800)
await r.click(dialog().locator(`[title*="${V.star}"]`).first())
await r.clear(1000)
await fill(field(T['prop.w']), '10')
await fill(field(T['prop.h']), '10')
await put(field('X'), String(B.at + 10 * B.cell - 12))
await put(field('Y'), String(B.at + 2))
await look(
  t(
    'Nelle caselle 10, 20, 30 e 40 il numero è più grande e c’è una stella',
    'In cells 10, 20, 30 and 40 the number is bigger and there is a star'
  )
)

await r.click(layer(TRACK), { after: 700 })
await closeRules()
await addRule()
await pickCells(3, [1])
await usePicked()
await check(ruleCheck(3, 'editor.cellRuleLayer', TRACK_TEXT))
await r.focus(
  ruleCheck(3, 'editor.cellRuleLayer', TRACK_TEXT),
  t(
    'Cambia il testo del contenuto, solo nella casella 1',
    'Change the content text, only in cell 1'
  ),
  'left'
)
await fill(field(T['layerType.text'], rule(3)), t('Via', 'Start'))
await look(t('La casella 1 ha la scritta «Via»', 'Cell 1 says “Start”'))
await closeRules()
await save()

// ---- 3. le zone dei mazzi
await r.title(t('Le zone dei mazzi', 'The deck spaces'))
await r.clear()
await shape('tool.rect')
await fill(field(T['prop.name']), ZONE)
await place(268, 45, 68, 93)
await fill(colorField(T['prop.fill']), '#E6DAC0')
await fill(field(T['prop.radius']), '4')
await stroke(T['prop.stroke'], '#7A6A55', 0.8, 'dashed')
await look(
  t(
    'Un rettangolo grande come una carta più 5 mm, con il contorno tratteggiato',
    'A rectangle the size of a card plus 5 mm, with a dashed outline'
  )
)
await text(LABEL, t('Pesca', 'Draw'), { size: 24, weight: 700, color: '#7A6A55' })
await choose(field(T['prop.valign']), 'middle')
await place(268, 45, 68, 93)
await selectRange(LABEL, ZONE)
await key('Control+g', 900)
await fill(field(T['prop.name']), DECK)
await r.focus(
  layers(),
  t(
    'Rettangolo e scritta in un gruppo: ⌘G / Ctrl+G',
    'Rectangle and label in a group: ⌘G / Ctrl+G'
  ),
  'right',
  { pad: 4 }
)
await key('Control+c', 700)
for (const [i, y] of [
  [2, 146],
  [3, 247]
]) {
  // senza niente selezionato la copia va in cima alla lista, non dentro il gruppo di prima
  await key('Escape', 300)
  await key('Control+v', 1000)
  await fill(field('X'), '268')
  await fill(field('Y'), String(y))
  await r.click(layer(`${LABEL}_${i}`), { after: 600 })
  await fill(field(T['prop.text']), i === 2 ? t('Scarti', 'Discard') : t('Mercato', 'Market'))
}
await look(
  t(
    'Con ⌘C / Ctrl+C e ⌘V / Ctrl+V tre zone della stessa misura: Pesca, Scarti, Mercato',
    'With ⌘C / Ctrl+C and ⌘V / Ctrl+V three spaces of the same size: Draw, Discard, Market'
  )
)
await save()

// ---- 4. la mappa esagonale
await r.title(t('La mappa esagonale', 'The hex map'))
await r.clear()
await grid(MAP, { rows: 5, cols: 6, cell: 'hex', interlock: true, w: 30, x: 47, y: 72 })
await fill(colorField(T['prop.cellFill']), COLORS.plain)
await stroke(T['prop.cellStroke'], '#5E5040', 0.6)
await look(
  t(
    'Esagoni a incastro, 6 × 5, di 30 mm: la pianura',
    'Interlocking hexagons, 6 × 5, 30 mm across: the plain'
  )
)
const areas = [
  [t('Foresta', 'Forest'), [2, 3, 8, 9, 14], COLORS.forest],
  [t('Lago', 'Lake'), [16, 17, 22, 23], COLORS.lake],
  [t('Montagne', 'Mountains'), [5, 11, 12, 18], COLORS.mountains]
]
for (let i = 0; i < areas.length; i++) {
  const [name, cells, color] = areas[i]
  if (i) await setRuleOpen(i - 1, false)
  await addRule()
  await pickCells(
    i,
    cells,
    i ? undefined : t('Una regola per area: le caselle si scelgono con il clic', 'One rule per area: click the cells')
  )
  await usePicked()
  await fillRule(i, color)
  await look(t(`${name}: regola ${i + 1}`, `${name}: rule ${i + 1}`))
}
await setRuleOpen(2, false)
await addRule()
await pickCells(3, [1, 6, 25, 30, 19])
await usePicked()
await check(ruleCheck(3, 'editor.cellRuleHidden'))
await look(
  t(
    'Qualche casella nascosta sul bordo: la costa non è più dritta',
    'A few hidden cells on the edge: the coast is no longer straight'
  )
)
await closeRules()
await save()

// ---- 5. lo spazio per le tessere tonde
await r.title(t('Lo spazio per le tessere', 'The tile space'))
await r.clear()
await grid(TILES, { rows: 2, cols: 4, cell: 'circle', w: 30, x: 47, y: 252, gap: 4 })
await fill(colorField(T['prop.cellFill']), '#E6DAC0')
await stroke(T['prop.cellStroke'], '#7A6A55', 0.6, 'dashed')
await r.focus(
  field(T['prop.cellWidth']),
  t(
    'Caselle tonde di 30 mm: la misura delle tessere del set',
    'Round 30 mm cells: the size of the set’s tiles'
  ),
  'left'
)
await look(
  t('Lo spazio dove si mettono i dischetti', 'The space where the discs go')
)
await save()

// ---- 6. il resto
await r.title(t('Il resto', 'The rest'))
await r.clear()
await text(t('titolo', 'title'), GAME, { size: 34, weight: 800, color: '#3B2A14', align: 'left' })
await place(47, 42, 200, 24)
// il tracciato dei round, con una freccia tra le caselle
await grid(ROUND, { rows: 1, cols: 10, w: 16, x: 47, y: 222, gap: 5 })
await fill(colorField(T['prop.cellFill']), '#F5EEDC')
await stroke(T['prop.cellStroke'], '#7A6A55', 0.6)
await insertContent(0)
await card('fx.card.cellNumber')
await applyFx()
await fill(field(T['prop.size']), '11')
await choose(field(T['prop.weight']), '700')
await r.click(tool('tool.text'))
await r.clear(500)
await fill(field(T['prop.name']), ARROW)
await fill(field(T['prop.text']), '→')
await fill(field(T['prop.size']), '10')
await fill(field(T['prop.w']), '5')
await fill(field(T['prop.h']), '16')
await put(field('X'), '63')
await put(field('Y'), '222')
await r.click(layer(ROUND), { after: 700 })
await addRule()
await pickCells(0, [10])
await usePicked()
await check(ruleCheck(0, 'editor.cellRuleLayer', ARROW))
await fill(field(T['layerType.text'], rule(0)), ' ')
await look(
  t(
    'Il tracciato dei round: 1-10 con una freccia; nell’ultima casella una regola la toglie',
    'The round track: 1-10 with an arrow; in the last cell a rule removes it'
  )
)
await closeRules()
// la legenda: esagono e nome, in fila
await shape('tool.polygon')
await fill(field(T['prop.name']), HEX)
await fill(field(T['prop.sides']), '6')
await place(47, 322, 9, 9)
await fill(colorField(T['prop.fill']), COLORS.forest)
await text(AREA, areas[0][0], { size: 10, weight: 600, color: '#3B2A14', align: 'left' })
await choose(field(T['prop.valign']), 'middle')
await place(58, 322, 26, 9)
await selectRange(AREA, HEX)
await key('Control+g', 900)
await fill(field(T['prop.name']), LEGEND)
await choose(field(T['prop.layout']), 'row')
await fill(field(T['prop.gap']), '3')
await selectRange(AREA, HEX)
await key('Control+c', 700)
for (let i = 0; i < 3; i++) await key('Control+v', 900)
const legend = [
  [areas[1][0], COLORS.lake],
  [areas[2][0], COLORS.mountains],
  [t('Pianura', 'Plain'), COLORS.plain]
]
for (let i = 0; i < legend.length; i++) {
  await r.click(layer(`${HEX}_${i + 2}`), { after: 500 })
  await fill(colorField(T['prop.fill']), legend[i][1])
  await r.click(layer(`${AREA}_${i + 2}`), { after: 500 })
  await fill(field(T['prop.text']), legend[i][0])
}
await r.focus(
  layers(),
  t(
    'La legenda è un gruppo con Disponi i figli: In riga. Le copie si mettono in fila da sole',
    'The legend is a group with Arrange children: In a row. The copies line up by themselves'
  ),
  'right',
  { pad: 4 }
)
await look(t('Titolo, round e legenda', 'Title, rounds and legend'))
await save()

// ---- 7. il retro
await r.title(t('Il retro', 'The back'))
await r.clear()
await face('preview.back')
await shape('tool.rect')
await fill(field(T['prop.name']), C.bg)
await place(-3, -3, 386, 386)
await fill(colorField(T['prop.fill']), '#3E5C46')
await text(t('titolo', 'title'), GAME, { size: 72, weight: 800, color: '#F5EEDC' })
await choose(field(T['prop.valign']), 'middle')
await place(40, 150, 300, 80)
await look(
  t('Il retro: un colore di fondo e il titolo grande', 'The back: a background color and a big title')
)
await r.title(
  t(
    'In Tabletop Simulator è il lato sotto del tabellone',
    'In Tabletop Simulator it is the underside of the board'
  ),
  4200
)
await r.clear()
await face('preview.front')
await save()

// ---- 8. la plancia giocatore
await r.title(t('La plancia giocatore', 'The player board'))
await r.clear()
await open(N.players)
await view('set.table')
await r.focus(
  win.locator('.data-table').first(),
  t(
    'Il set Giocatori: quattro righe, una per colore',
    'The Players set: four rows, one per color'
  ),
  'right',
  { pad: 4 }
)
await open(N.tPlayer)
await r.click(layer(C.name), { after: 600 })
await r.click(tool('tool.value'))
await r.clear(500)
await fill(field(T['prop.name']), C.color)
await r.focus(
  layers(),
  t(
    `Un livello Valore «${C.color}»: prende il colore dalla colonna del foglio`,
    `A Value layer “${C.color}”: it reads the color from the sheet column`
  ),
  'right',
  { pad: 4 }
)
await r.click(layer(C.frame), { after: 600 })
await fill(colorField(T['prop.fill']), `{${C.color}}`)
await r.focus(
  colorField(T['prop.fill']),
  t(
    `Nel riempimento del bordo si scrive {${C.color}}`,
    `In the frame fill you write {${C.color}}`
  ),
  'left'
)
await grid(t('riserve', 'supply'), { rows: 2, cols: 4, w: 30, x: 36, y: 52, gap: 6 })
await fill(colorField(T['prop.cellFill']), '#FFFFFF')
await fill(field(T['prop.radius']), '3')
await insertContent(1, `{${V.coin}}`)
await r.click(layer(T['layerName.image']), { after: 700 })
await r.click(props.locator('button.fx-button').first(), { after: 1100 })
await card('fx.card.cycle')
const icons = [V.coin, V.gem, V.wood, V.stone]
for (let i = 0; i < icons.length; i++) {
  if ((await sentence().locator(':scope > .fx-leaf').count()) <= i) await addItem()
  await setItem(i, icons[i])
}
await r.focus(
  sentence(),
  t(
    'Scorri un elenco: moneta, gemma, legno, pietra, una per colonna',
    'Cycle through a list: coin, gem, wood, stone, one per column'
  ),
  'below'
)
await applyFx()
await look(t('Le riserve delle risorse', 'The resource supply'))
await save()
await open(N.players)
await view('set.grid')
await r.focus(
  win.locator('.card-grid').first(),
  t(
    'Quattro plance uguali, ognuna del suo colore',
    'Four identical boards, each in its own color'
  ),
  'none',
  { pad: 4, dim: false }
)

// ---- 9. la pedina in piedi
await r.title(t('La pedina in piedi', 'The standee pawn'))
await r.clear()
await open(N.tPawn)
await r.click(layer(C.figure), { after: 600 })
await r.click(tool('tool.value'))
await r.clear(500)
await fill(field(T['prop.name']), C.color)
await r.click(layer(C.figure), { after: 600 })
await fill(colorField(T['prop.tint']), `{${C.color}}`)
await r.focus(
  colorField(T['prop.tint']),
  t(
    `Stesso livello Valore, e la colorazione della sagoma è {${C.color}}`,
    `Same Value layer, and the figure’s tint is {${C.color}}`
  ),
  'left'
)
await save()
await open(N.pawns)
await view('set.grid')
await r.focus(
  win.locator('.card-grid').first(),
  t(
    'Quattro pedine, con i colori delle plance',
    'Four pawns, in the colors of the boards'
  ),
  'none',
  { pad: 4, dim: false }
)
await r.title(
  t(
    'Una pedina in piedi si stampa due volte, si ritaglia e si incolla. La base serve per Tabletop Simulator',
    'A standee is printed twice, cut out and glued. The base is for Tabletop Simulator'
  ),
  5000
)
await r.clear()

// ---- 10. la stampa a poster
await r.title(t('La stampa a poster', 'Printing as a poster'))
await r.clear()
const exp = () => win.locator('[role="dialog"]').first()
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const exact = (s) => new RegExp(`^${esc(s)}$`)
const row = (k) =>
  exp()
    .locator('.export-row, .export-choice-row')
    .filter({
      has: win.locator('.export-row-label, .export-choice-label').filter({ hasText: exact(T[k]) })
    })
    .first()
const section = (k) =>
  exp()
    .locator('details.export-section')
    .filter({ has: win.locator('.export-section-title').filter({ hasText: exact(T[k]) }) })
    .first()
const live = () => exp().locator('.live-preview').first()
async function openSection(k) {
  const d = section(k)
  await d.locator('summary').scrollIntoViewIfNeeded()
  if (!(await d.evaluate((e) => e.open)))
    await r.click(d.locator('summary'), { after: 500, before: 200, ms: 450 })
}
async function only(...names) {
  const chips = exp().locator('.export-set-chip')
  for (const want of [true, false])
    for (let i = 0; i < (await chips.count()); i++) {
      const chip = chips.nth(i)
      const name = (await chip.evaluate((e) => e.firstChild?.nextSibling?.textContent ?? '')).trim()
      if (names.includes(name) !== want) continue
      if ((await chip.locator('input').isChecked()) !== want) {
        await chip.scrollIntoViewIfNeeded()
        await r.click(chip, { ms: 250, before: 80, after: 150 })
      }
    }
  await r.wait(400)
}
async function ready() {
  await r.wait(500)
  for (let i = 0; i < 80 && (await live().locator('.live-preview-wait').count()); i++)
    await win.waitForTimeout(200)
  await r.wait(300)
}
async function efill(loc, value) {
  await loc.scrollIntoViewIfNeeded()
  await r.zoom(loc, { max: 1.7 })
  await r.click(loc, { after: 250, before: 200, ms: 450 })
  await win.keyboard.press('Control+A')
  await r.type(value)
  await win.keyboard.press('Tab')
  await r.wait(500)
}
await r.click(win.locator('header.toolbar').getByText(T['app.export'], { exact: true }).first())
await r.clear(800)
await r.click(exp().locator('.export-goal').filter({ hasText: T['export.goal.home'] }).first(), {
  after: 700
})
await only(N.board)
await openSection('export.layoutSection')
await efill(row('export.margin').locator('input').first(), '5')
const poster = exp().locator('label.check', { hasText: T['export.posterSplit'] }).first()
await poster.scrollIntoViewIfNeeded()
if (!(await poster.locator('input').isChecked())) await r.click(poster, { after: 600 })
await efill(row('export.poster').locator('input.num').first(), '10')
await r.focus(
  row('export.poster'),
  t(
    'Poster: il tabellone si divide su più A4, con 10 mm di sovrapposizione per incollarli',
    'Poster: the board is split over several A4 sheets, with 10 mm of overlap to glue them'
  ),
  'below'
)
await r.unzoom(600)
await ready()
await r.focus(
  live(),
  t(
    'Margine 5 mm: 2 × 2 fogli, con i segni di taglio e il nome di ogni parte',
    '5 mm margin: 2 × 2 sheets, with crop marks and the name of each part'
  ),
  'left',
  { pad: 4 }
)
for (let i = 0; i < 3; i++) {
  await r.click(live().locator('.live-preview-nav button').last(), { after: 300 })
  await ready()
  await r.wait(600)
}
await r.clear(300)
await r.click(exp().getByRole('button', { name: T['export.close'], exact: true }), { after: 600 })

// ---- 11. Tabletop Simulator
await r.title(t('E se volessimo provare su TTS?', 'What if we want to try it in TTS?'))
await r.title(
  t(
    'Snap point dove si appoggiano le cose, e tag perché ognuna vada al suo posto (video 19)',
    'Snap points where things go, and tags so each one goes in its place (video 19)'
  ),
  4800
)
await r.clear()
await open(N.tBoard)
const snapSteps = [
  [TRACK, 'prop.snapCells', TAG.pawn, t('Il percorso: uno snap per casella, tag «pedina»', 'The track: a snap per cell, “pawn” tag')],
  [MAP, 'prop.snapCells', TAG.hex, t('La mappa: tag «esagono»', 'The map: “hex” tag')],
  [TILES, 'prop.snapCells', TAG.tiles, t('Lo spazio tessere: tag «tessere»', 'The tile space: “tiles” tag')],
  [ROUND, 'prop.snapCells', TAG.marker, t('I round: tag «segnalino»', 'The rounds: “marker” tag')]
]
for (const [name, k, tags, note] of snapSteps) {
  await r.click(layer(name), { after: 700 })
  await closeRules()
  await snapOn(k, tags)
  await r.focus(field(T['prop.snapTags']), note, 'left')
}
for (const name of [ZONE, `${ZONE}_2`, `${ZONE}_3`]) {
  await r.click(layer(name), { after: 600 })
  await snapOn('prop.snap', TAG.cards, true)
}
await r.focus(
  field(T['prop.snapRotated']),
  t(
    'Le zone dei mazzi: uno snap per zona, tag «carte», Ruotato',
    'The deck spaces: one snap per space, “cards” tag, Rotated'
  ),
  'left'
)
await look(t('I mirini degli snap point sul tabellone', 'The snap point crosshairs on the board'))
await save()
for (const [tpl, tags] of [
  [N.tCard, TAG.cards],
  [N.tTile, TAG.tiles],
  [N.tPawn, TAG.pawn]
]) {
  await open(tpl)
  await templateProps()
  await fill(field(T['prop.ttsTags']), tags)
  await r.focus(
    field(T['prop.ttsTags']),
    t(`Il template ${tpl}: tag «${tags}»`, `The ${tpl} template: “${tags}” tag`),
    'left'
  )
  await save()
}
await r.click(win.locator('header.toolbar').getByText(T['app.export'], { exact: true }).first())
await r.clear(800)
await r.click(exp().locator('.export-goal').filter({ hasText: T['export.goal.tts'] }).first(), {
  after: 700
})
await only(N.board, N.cards, N.tiles, N.pawns)
const ttsRow = (name) =>
  exp()
    .locator('.tts-object')
    .filter({ has: win.locator('.tts-object-name', { hasText: new RegExp(`^${esc(name)}\\s*\\d*$`) }) })
    .first()
await ttsRow(N.pawns).scrollIntoViewIfNeeded()
await r.focus(
  exp().locator('.tts-object').first().locator('xpath=..'),
  t(
    'Ogni set con il suo tipo e i suoi tag; per la pedina lo spessore è la base',
    'Each set with its type and tags; for the pawn the thickness is the base'
  ),
  'left',
  { pad: 4 }
)
await r.clear(300)
await r.click(exp().getByRole('button', { name: T['export.close'], exact: true }), { after: 600 })
await r.title(
  t(
    'In Tabletop Simulator ogni oggetto si aggancia al suo posto: pedine sul percorso, carte nelle zone, tessere nei dischi',
    'In Tabletop Simulator every object snaps into its place: pawns on the track, cards in the spaces, tiles in the discs'
  ),
  5600
)

// ---- chiusura
await r.title(
  t(
    'Le griglie: video 8. Snap e tag: video 19. Le formule: video 23',
    'Grids: video 8. Snaps and tags: video 19. Formulas: video 23'
  ),
  4600
)
await r.title(
  t('Il progetto si scarica dal sito: stella.lucadj.eu', 'Download the project from the site: stella.lucadj.eu'),
  4000
)
await r.clear(600)
console.log('VIDEO', await r.finish())
