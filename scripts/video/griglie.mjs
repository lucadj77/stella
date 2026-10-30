// Video 8: le griglie (circa 8 minuti, senza voce), rifatto sulla 1.8.0-beta.4. Su una plancia vuota si
// costruisce un tracciato 4 × 8: la griglia e le forme delle caselle, la casella a misura fissa, i numeri
// con l'assistente (Numero continuo: in sequenza, a serpentina, a percorso), un'icona nel contenuto, le
// regole delle caselle (caselle scelte con il clic, ogni 5 contando il numero scritto, caselle nascoste),
// un contenuto diverso per una regola e, alla fine, le formule che l'assistente ha scritto.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node --experimental-strip-types --no-warnings scripts/video/griglie.mjs it|en
// FAST=1 accorcia attese e scrittura; SNAP=<cartella> salva una schermata dopo ogni testo.
import { launch, makeProject, mockOpen } from './lib.mjs'
import { extend, TEST } from './progetto-griglie.mjs'
const lang = process.argv[2] || 'it'
const it = lang === 'it'
const t = (a, b) => (it ? a : b)
const project = makeProject(lang)
const N = await extend(project, lang)
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
const field = (label, scope = props) =>
  scope
    .locator('.field')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${label}$`) }) })
    .locator('input:not([type=range]), textarea, select')
    .first()
const colorField = (label, scope = props) =>
  scope
    .locator('.field')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${label}$`) }) })
    .locator('input.color-text')
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
async function choose(loc, value) {
  await center(loc)
  await zoomTo(loc)
  await r.click(loc, { after: 200, before: 200, ms: 450 })
  await win.keyboard.press('Escape')
  await loc.selectOption(value)
  await r.wait(600)
}
async function check(loc) {
  await center(loc)
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
/** zoom sulla carta e testo sopra: per guardare da vicino il risultato */
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

// ---- assistente formule
const sentence = () => dialog().locator('.fx-guided > .fx-sentence').first()
const choices = () => sentence().locator('select.fx-choice')
async function card(key) {
  await r.click(dialog().locator('.fx-card').filter({ hasText: T[key] }).first(), { after: 900 })
}
async function applyFx() {
  await r.click(dialog().getByRole('button', { name: T['fx.apply'], exact: true }), {
    after: 900
  })
}
/** la scelta della frase che ha tra le opzioni `value` */
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
  if (text)
    await r.focus(dialog().locator('.fx-result-box').first(), text, 'above', { pad: 4 })
}

// ---- regole delle caselle
const rule = (i) => props.locator('.cell-rule').nth(i)
const ruleCheck = (i, key, vars) => field(T[key].replace('{name}', vars ?? ''), rule(i))
async function addRule() {
  const add = button('editor.cellRuleAdd')
  await center(add)
  await r.click(add, { after: 700 })
}
async function pickCells(i, cells, text) {
  const pick = rule(i).getByRole('button', { name: T['cellPicker.open'], exact: true })
  await center(pick)
  if (text) await r.focus(pick, text, 'left')
  await r.click(pick, { after: 900 })
  for (const n of cells)
    await r.click(
      dialog()
        .locator('.cell-picker-cell')
        .nth(n - 1),
      { after: 400, ms: 380 }
    )
}
async function usePicked() {
  await r.click(dialog().getByRole('button', { name: T['cellPicker.apply'], exact: true }), {
    after: 700
  })
}
async function setRuleOpen(i, open) {
  const isOpen = await rule(i).evaluate((el) => el.classList.contains('open'))
  if (isOpen !== open) await toggleRule(i)
}
async function toggleRule(i) {
  const head = rule(i).locator('.cell-rule-toggle').first()
  await center(head)
  await r.click(head, { after: 600, ms: 400 })
}

const GRID = N.grid
const TEXT = `${GRID}_text`
const ROWS = 4
const COLUMNS = 8

// ================= inizio
await r.overlay()
await r.title(t('Le griglie', 'Grids'))
await r.title(
  t(
    'Una griglia sono caselle uguali dentro un riquadro: plance, tracciati, mappe, tabelle da compilare',
    'A grid is a set of equal cells inside a box: boards, tracks, maps, tables to fill in'
  ),
  5200
)
await r.clear()
await mockOpen(r.app, project)
await r.click(win.getByText(T['start.openProject']))
await r.clear(2200)
await r.overlay()
await open(N.test)
await look(
  t('Una plancia vuota: ci costruiamo un tracciato', 'An empty board: we’ll build a track on it')
)

// ---- 1. la griglia
await r.title(t('La griglia', 'The grid'))
await r.clear()
await r.focus(
  tool('tool.grid'),
  t('Lo strumento Griglia, nella barra in alto', 'The Grid tool, in the top bar'),
  'below'
)
await r.click(tool('tool.grid'))
await r.clear(600)
await fill(field(T['prop.name']), GRID)
await place(TEST.x, TEST.y, TEST.w, TEST.h)
await fill(field(T['prop.rows']), String(ROWS))
await fill(field(T['prop.columns']), String(COLUMNS))
await explain(field(T['prop.rows']), [
  t(
    `Righe ${ROWS} e colonne ${COLUMNS}: ${ROWS * COLUMNS} caselle`,
    `${ROWS} rows and ${COLUMNS} columns: ${ROWS * COLUMNS} cells`
  )
])
await look(
  t(
    'Le caselle sono tutte uguali, le più grandi che stanno nel riquadro',
    'All cells are equal, the biggest that fit in the box'
  )
)
await explain(field(T['prop.cell']), [
  t('La forma della casella', 'The shape of the cell')
])
await choose(field(T['prop.cell']), 'hex')
const interlock = () => field(T['prop.interlock'])
await check(interlock())
await look(t('Esagoni a incastro: l’alveare delle mappe', 'Interlocking hexagons: the honeycomb of maps'))
await check(interlock())
await choose(field(T['prop.cell']), 'square')
await r.title(
  t(
    'Ci sono anche caselle tonde, triangoli e rombi, e la casella può prendere la forma di un’immagine',
    'There are also round cells, triangles and diamonds, and the cell can take the shape of an image'
  ),
  5200
)
await r.clear()
await fill(field(T['prop.gap']), '1.5')
await r.focus(
  field(T['prop.gap']),
  t('Spaziatura: lo spazio tra le caselle', 'Gap: the space between cells'),
  'left'
)
await fill(colorField(T['prop.cellFill']), '#F5EEDC')
await explain(colorField(T['prop.cellFill']), [
  t(
    'Riempimento e contorno delle caselle, raggio degli angoli e sfondo della griglia',
    'Cell fill and outline, corner radius and grid background'
  )
])
await fill(field(T['prop.radius']), '2')
await look(t('Il tracciato prende forma', 'The track takes shape'))

// ---- 2. la misura delle caselle
await r.title(t('La misura delle caselle', 'Cell size'))
await r.clear()
const auto = () => field(T['prop.autoSize'])
await center(auto())
await r.focus(
  auto(),
  t(
    'Dimensioni automatiche: la casella si adatta al riquadro',
    'Automatic size: the cell adapts to the box'
  ),
  'left'
)
await check(auto())
await fill(field(T['prop.cellWidth']), '20')
await fill(field(T['prop.cellHeight']), '20')
await explain(field(T['prop.cellWidth']), [
  t(
    'Spenta: casella di 20 × 20 mm, e la griglia prende la misura che serve',
    'Turned off: 20 × 20 mm cells, and the grid takes the size it needs'
  )
])
await look(t('Caselle di 2 cm, come le pedine del gioco', '2 cm cells, like the game’s pawns'))

// ---- 3. i numeri
await r.title(t('I numeri', 'The numbers'))
await r.clear()
const insert = button('editor.gridContentInsert')
await center(insert)
await r.focus(
  insert,
  t(
    'Inserisci un contenuto in tutte le caselle',
    'Insert content in all cells'
  ),
  'left'
)
await r.click(insert, { after: 900 })
await r.focus(
  dialog().locator('.cell-content-choices').first(),
  t(
    'Un valore, una forma o immagine, o un gruppo che c’è già',
    'A value, a shape or image, or a group you already have'
  ),
  'right',
  { pad: 4 }
)
await r.click(dialog().locator('.cell-content-choices button').first(), { after: 1400 })
await r.focus(
  dialog().locator('.fx-cards').first(),
  t(
    'Valore apre l’assistente formule: il testo può cambiare da casella a casella',
    'Value opens the formula assistant: the text can change from cell to cell'
  ),
  'right',
  { pad: 4 }
)
await card('fx.card.cellNumber')
await r.focus(
  sentence(),
  t(
    'Numero continuo: crescente, per riga, in sequenza, da 1',
    'Running number: ascending, by row, in sequence, from 1'
  ),
  'below'
)
await pickChoice('snake', t('A serpentina: ogni riga torna indietro', 'Snaking: each row turns back'))
await pickChoice(
  'path',
  t(
    'A percorso: sempre alla casella accanto. Su una griglia piena gira a spirale',
    'Along a path: always to the next cell. On a full grid it spirals'
  )
)
await r.title(
  t(
    'A percorso serve per i tracciati, come quello attorno a un tabellone (video 24)',
    'Along a path is for tracks, like the one around a game board (video 24)'
  ),
  4800
)
await r.clear()
await pickChoice('snake')
await applyFx()
await look(t('I numeri a serpentina: 1-8, poi 9-16 all’indietro', 'Snaking numbers: 1-8, then 9-16 backwards'))
await r.focus(
  win.locator('aside.layers .layers-list').first(),
  t(
    'Nella lista dei livelli il gruppo «contenuto» sta dentro la griglia',
    'In the layer list the “content” group sits inside the grid'
  ),
  'right',
  { pad: 4 }
)

// ---- 4. un'icona nel contenuto
await r.title(t('Un’icona nel contenuto', 'An icon in the content'))
await r.clear()
await r.click(layer(TEXT), { after: 700 })
await r.click(tool('tool.image'))
await r.clear(800)
await r.click(dialog().locator(`[title*="${N.coin ?? (it ? 'moneta' : 'coin')}"]`).first())
await r.clear(1000)
await look(
  t(
    'Il nuovo livello entra nel gruppo e prende la misura della casella',
    'The new layer goes into the group and takes the size of the cell'
  )
)
// nel gruppo centrato ogni tasto sposterebbe tutto il gruppo: X e Y si scrivono in un colpo solo
await fill(field(T['prop.w']), '7')
await fill(field(T['prop.h']), '7')
for (const [k, v] of [['X', TEST.x + 1.5], ['Y', TEST.y + 1.5]]) {
  const box = field(k)
  await center(box)
  await zoomTo(box)
  await r.click(box, { after: 250, before: 200, ms: 450 })
  await win.keyboard.press('Control+A')
  await win.keyboard.insertText(String(v))
  await win.keyboard.press('Tab')
  await r.wait(500)
}
await look(
  t(
    'Lo rimpicciolisco e lo metto in un angolo: si ripete in tutte le caselle',
    'I make it smaller and move it to a corner: it repeats in every cell'
  )
)
await r.click(layer(GRID), { after: 700 })
const centered = field(T['prop.centered'])
await center(centered)
await r.focus(
  centered,
  t(
    'Centrato con le caselle resta acceso: il contenuto segue la griglia',
    'Centered on the cells stays on: the content follows the grid'
  ),
  'left'
)

// ---- 5. le regole
await r.title(t('Le regole delle caselle', 'Cell rules'))
await r.title(
  t(
    'Una regola sceglie alcune caselle e cambia il loro aspetto',
    'A rule picks some cells and changes how they look'
  ),
  4200
)
await r.clear()
// regola 1: tre caselle scelte con il clic, gialle
await addRule()
await pickCells(
  0,
  [6, 13, 27],
  t('Scegli le caselle… apre la griglia in grande', 'Choose the cells… opens the grid drawn large')
)
await r.focus(
  dialog().locator('.cell-picker').first(),
  t(
    'Un clic accende o spegne una casella. Il numero piccolo è la posizione, {cell.index}',
    'A click turns a cell on or off. The small number is the position, {cell.index}'
  ),
  'right',
  { pad: 0 }
)
await usePicked()
await check(ruleCheck(0, 'editor.cellRuleFill'))
await fill(colorField(T['prop.cellFill'], rule(0)), '#F2D27A')
await look(t('Regola 1: tre caselle gialle', 'Rule 1: three yellow cells'))

// regola 2: ogni 5, contando il numero scritto
await addRule()
await r.click(rule(1).locator('button.fx-button').first(), { after: 1000 })
await card('fx.card.everyNCond')
await r.click(sentence().locator('.fx-leaf').filter({ hasText: /^10$/ }).first(), { after: 600 })
const picker = dialog().locator('.fx-picker').first()
const numberInput = picker.locator('.fx-tab-body input[inputmode=decimal]').first()
await r.click(numberInput, { after: 200 })
await win.keyboard.press('Control+A')
await r.type('5')
await r.click(picker.getByRole('button', { name: T['fx.use'], exact: true }), { after: 700 })
const counting = await choice('cell.index')
await r.focus(
  counting,
  t(
    'Contando: la posizione della casella ({cell.index}) o il valore che si vede nella casella',
    'Counting: the cell position ({cell.index}) or the value shown in the cell'
  ),
  'below'
)
await pickChoice(
  TEXT,
  t(
    'Scelgo il testo del contenuto: la regola segue i numeri scritti, anche quando cambiano',
    'I pick the content text: the rule follows the written numbers, even when they change'
  )
)
await applyFx()
await check(ruleCheck(1, 'editor.cellRuleStroke'))
await fill(colorField(T['prop.cellStroke'], rule(1)), '#C0392B')
await fill(
  rule(1)
    .locator('.field')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${T['prop.cellStroke']}$`) }) })
    .locator('input.num')
    .first(),
  '0.8'
)
await look(
  t('Regola 2: il contorno rosso sulle caselle 5, 10, 15…', 'Rule 2: a red outline on 5, 10, 15…')
)

// regola 3: caselle nascoste, e il numero continuo le salta
await addRule()
await pickCells(2, [17, 18, 31, 32])
await usePicked()
await check(ruleCheck(2, 'editor.cellRuleHidden'))
await look(
  t(
    'Regola 3: quattro caselle nascoste. Ma i numeri contano ancora anche quelle',
    'Rule 3: four hidden cells. But the numbers still count them'
  )
)
await r.click(layer(TEXT), { after: 800 })
const fxText = props.locator('button.fx-button').first()
await center(fxText)
await r.click(fxText, { after: 1000 })
await pickChoice(
  'visible',
  t('Salta le caselle nascoste', 'Skip hidden cells')
)
await applyFx()
await look(
  t(
    'Ora la numerazione salta le caselle nascoste, e la regola 2 la segue',
    'Now the numbering skips the hidden cells, and rule 2 follows it'
  )
)

// ---- 6. un contenuto diverso per una regola
await r.title(t('Un contenuto diverso per una regola', 'Different content for a rule'))
await r.clear()
await r.click(layer(GRID), { after: 700 })
await setRuleOpen(0, true)
const own = rule(0).locator('button').filter({ hasText: T['editor.ruleContent'] }).first()
await center(own)
await r.focus(
  own,
  t('Personalizza contenuto, sulla regola 1', 'Customize content, on rule 1'),
  'left'
)
await r.click(own, { after: 900 })
await r.click(dialog().locator('.cell-content-choices button').nth(1), { after: 800 })
await r.click(
  dialog().locator('.cell-content-list button').filter({ hasText: T['shape.star'] }).first(),
  { after: 1200 }
)
await look(
  t(
    'Nelle tre caselle gialle la stella prende il posto del numero',
    'In the three yellow cells the star replaces the number'
  )
)
await r.focus(
  win.locator('aside.layers .layers-list').first(),
  t(
    'Due gruppi nella griglia: «contenuto» per tutte le caselle, «regola 1» solo per le sue',
    'Two groups in the grid: “content” for all cells, “rule 1” only for its own'
  ),
  'right',
  { pad: 4 }
)
await r.title(
  t(
    'Nelle caselle della regola si disegna il suo gruppo al posto di quello comune, non sopra',
    'In the rule’s cells its own group is drawn instead of the common one, not on top'
  ),
  5200
)
await r.clear()
const starLayer = win
  .locator('.layers .layer-name')
  .filter({ hasText: new RegExp(T['shape.star'], 'i') })
  .first()
await r.click(starLayer, { after: 700 })
await fill(colorField(T['prop.fill']), '#C0392B')
await look(
  t('Cambio il colore della stella: cambia solo lì', 'I change the star’s color: it only changes there')
)

// ---- 7. ordine
await r.click(layer(GRID), { after: 700 })
for (let i = 0; i < 3; i++) await setRuleOpen(i, false)
await r.focus(
  props.locator('.cell-rule').first(),
  t(
    'Le regole si chiudono: l’intestazione dice colore, nascoste, contenuto e quante caselle',
    'Rules collapse: the header shows color, hidden, content and how many cells'
  ),
  'left'
)

// ---- 8. le formule dietro
await r.title(t('Le formule dietro', 'The formulas behind'))
await r.clear()
await r.click(layer(TEXT), { after: 800 })
const textFormula = field(T['source.formula'])
await explain(textFormula, [
  t(
    'Il numero continuo è la funzione CELLNUMBER: verso, ordine, percorso, caselle, inizio',
    'The running number is the CELLNUMBER function: direction, order, path, cells, start'
  )
])
await r.click(layer(GRID), { after: 700 })
for (const i of [0, 1]) await setRuleOpen(i, true)
await explain(field(T['editor.cellRuleWhen'], rule(0)), [
  t(
    'Scegli le caselle ha scritto INLIST({cell.index}; "6, 13, 27")',
    'Choose the cells wrote INLIST({cell.index}; "6, 13, 27")'
  )
])
await explain(field(T['editor.cellRuleWhen'], rule(1)), [
  t(
    'Ogni 5 caselle è MOD: il resto della divisione per 5 è zero',
    'Every 5 cells is MOD: the remainder of dividing by 5 is zero'
  )
])
await r.title(
  t(
    'Le formule si possono anche scrivere a mano: tutto nel video 23',
    'You can also write formulas by hand: all in video 23'
  ),
  4200
)
await r.clear()
await r.click(saveButton(), { after: 600 })

// ---- chiusura
await r.title(
  t(
    'Le griglie hanno anche gli snap point per Tabletop Simulator (video 19)',
    'Grids also have snap points for Tabletop Simulator (video 19)'
  ),
  4400
)
await r.title(
  t(
    'E la distribuzione a caso con le quantità: video 25',
    'And random dealing with quantities: video 25'
  ),
  4000
)
await r.title(
  t('Tutto il resto è nella guida: stella.lucadj.eu', 'Everything else is in the guide: stella.lucadj.eu'),
  4000
)
await r.clear(600)
console.log('VIDEO', await r.finish())
