// Video 8: le griglie e le formule nelle caselle (circa 13 minuti, senza voce). Su una plancia vuota si
// costruisce una griglia da zero: le forme delle caselle, il contenuto delle caselle con le variabili
// {cell.…}, le formule spiegate un pezzo alla volta (IF, MOD, il markup), i colori a caso e le regole
// delle caselle (riempimento, contorno, caselle scelte con il clic e INLIST, caselle nascoste). Nell'ultima parte un agente IA aggiunge una griglia alla plancia del video 7 partendo
// da una richiesta a parole: le due registrazioni (app e terminale) si montano con componi.sh.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node --experimental-strip-types --no-warnings scripts/video/griglie.mjs it|en
// FAST=1 accorcia attese e scrittura, per provare il percorso senza badare al ritmo.
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { launch, makeProject, mockOpen } from './lib.mjs'
import { agentGrid, extend, TEST, testCell } from './progetto-griglie.mjs'
import { terminal } from './terminale.mjs'
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
let snaps = 0
r.focus = async (locs, ...rest) => {
  await zoomTo(locs)
  const out = await focus0(locs, ...rest)
  // SNAP=<cartella>: una schermata per ogni testo, per controllare il percorso
  if (process.env.SNAP)
    await win.screenshot({ path: `${process.env.SNAP}/${String(++snaps).padStart(3, '0')}.png` })
  return out
}
const title0 = r.title.bind(r)
r.title = async (...a) => {
  await r.unzoom(700)
  return title0(...a)
}

const props = win.locator('aside.properties')
const stage = () => win.locator('.canvas-stage').first()
const field = (label, scope = props) =>
  scope
    .locator('.field')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${label}$`) }) })
    .locator('input:not([type=range]), textarea, select')
    .first()
const colorField = (label) =>
  props
    .locator('.field')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${label}$`) }) })
    .locator('input.color-text')
    .first()
const layer = (n) => win.locator('.layers .layer-name', { hasText: new RegExp(`^${n}$`) }).first()
const layerRow = (n) =>
  win
    .locator('.layers .layer-row')
    .filter({ has: win.locator('.layer-name', { hasText: new RegExp(`^${n}$`) }) })
    .first()
const tip = (scope, key) => scope.locator(`[title="${T[key]}"], [data-tip="${T[key]}"]`).first()
const tool = (key) =>
  win.locator(`button.tool[title="${T[key]}"], button.tool[data-tip="${T[key]}"]`).first()
const side = (name) => win.locator('.sidebar').getByText(name, { exact: true }).first()
const saveButton = () =>
  win
    .locator('header.toolbar button')
    .filter({ hasText: new RegExp(`^(${T['app.save']}|${T['app.saved']})$`) })
    .first()
const groupButton = () => win.locator('.layers-actions button').filter({ hasText: '⊞' }).first()
const formula = () => field(T['source.formula'])
const source = () => props.locator('.source-line .field-label').first()
const sourceButton = (kind) =>
  props
    .locator('.source-line .segmented button')
    .filter({
      hasText: new RegExp(
        `^${kind === 'column' ? T['source.short.column'] : T['source.kind.' + kind]}$`
      )
    })
    .first()
async function setSource(kind) {
  const b = sourceButton(kind)
  await zoomTo(b)
  if ((await b.getAttribute('aria-pressed')) !== 'true') await r.click(b, { after: 400 })
}

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
// dalla 1.6 cambiare L e A tiene fermo il centro: prima la misura, poi la posizione
async function place(x, y, w, h) {
  await fill(field(T['prop.w']), String(Math.round(w * 100) / 100))
  await fill(field(T['prop.h']), String(Math.round(h * 100) / 100))
  await fill(field('X'), String(Math.round(x * 100) / 100))
  await fill(field('Y'), String(Math.round(y * 100) / 100))
}
/** zoom sulla carta e testo sopra: per guardare da vicino il risultato */
async function look(text, opts = {}) {
  await r.clear(100)
  await r.zoom(stage(), { max: 1.7, fill: 0.72 })
  await focus0(stage(), text, 'above', { pad: 0, dim: false, ...opts })
}
/** più testi, uno dopo l'altro, accanto allo stesso campo (con lo zoom) */
async function explain(loc, texts) {
  for (const text of texts) await r.focus(loc, text, 'left')
}
async function open(name) {
  await r.click(side(name))
  await r.clear(1000)
  await r.overlay()
}
async function save() {
  await r.click(saveButton())
  await r.clear(600)
}

// il terminale dell'agente si registra insieme all'app; si vede solo nell'ultima parte
const k = await terminal(r, { lang, dir: project })
await k.sync()
k.show('app')

await r.overlay()
await r.title(t('Le griglie: caselle, contenuto e formule', 'Grids: cells, content and formulas'))
await r.title(
  t(
    'Tracciati, mappe e scacchiere con un solo livello',
    'Score tracks, maps and boards with a single layer'
  )
)
await r.clear()
await mockOpen(r.app, project)
await r.click(win.getByText(T['start.openProject']))
await r.clear(2200)
await r.overlay()
await open(N.test)
await look(
  t(
    'Una plancia vuota da 190 × 130 mm, per fare le prove',
    'An empty 190 × 130 mm board, to experiment on'
  )
)

// ---- 1. il livello griglia
await r.title(t('Il livello griglia', 'The grid layer'))
await r.clear()
await r.focus(
  tool('tool.grid'),
  t(
    'Lo strumento griglia, nella barra in alto: aggiunge un livello griglia',
    'The grid tool, in the top bar: it adds a grid layer'
  ),
  'below'
)
await r.click(tool('tool.grid'))
await r.clear(600)
await fill(field(T['prop.name']), N.grid)
await place(TEST.x, TEST.y, TEST.w, TEST.h)
await r.focus(
  field('X'),
  t(
    'Posizione e misura del riquadro: la griglia sta tutta qui dentro',
    'Position and size of the box: the whole grid stays inside it'
  ),
  'left'
)
await fill(field(T['prop.rows']), String(TEST.rows))
await fill(field(T['prop.columns']), String(TEST.columns))
await explain(field(T['prop.rows']), [
  t(
    `Righe e colonne: ${TEST.rows} × ${TEST.columns}, cioè ${TEST.rows * TEST.columns} caselle`,
    `Rows and columns: ${TEST.rows} × ${TEST.columns}, that is ${TEST.rows * TEST.columns} cells`
  )
])
await look(
  t(
    'Stella divide il riquadro in caselle tutte uguali, le più grandi che ci stanno',
    'Stella splits the box into equal cells, the biggest that fit'
  )
)
await explain(field(T['prop.gap']), [
  t('Spaziatura: lo spazio tra una casella e l’altra, in mm', 'Gap: the space between cells, in mm')
])

const shapes = [
  [
    'square',
    t('Caselle quadrate', 'Square cells'),
    t(
      'A incastro: le righe si spostano di mezza casella, come i mattoni',
      'Interlocking: rows shift by half a cell, like bricks'
    )
  ],
  [
    'circle',
    t('Caselle tonde', 'Round cells'),
    t(
      'A incastro: le righe si spostano e si stringono tra loro',
      'Interlocking: rows shift and close up'
    )
  ],
  [
    'hex',
    t('Caselle esagonali', 'Hexagonal cells'),
    t('A incastro: l’alveare, per le mappe a esagoni', 'Interlocking: the honeycomb, for hex maps')
  ],
  [
    'triangle',
    t('Caselle triangolari', 'Triangular cells'),
    t(
      'A incastro: i triangoli si alternano, con la punta in su e in giù',
      'Interlocking: triangles alternate, pointing up and down'
    )
  ],
  [
    'diamond',
    t('Caselle a rombo', 'Diamond cells'),
    t(
      'A incastro: i rombi riempiono gli spazi tra gli altri',
      'Interlocking: diamonds fill the gaps between the others'
    )
  ]
]
await explain(field(T['prop.cell']), [
  t(
    'Caselle: cinque forme. Per ognuna proviamo anche «A incastro»',
    'Cells: five shapes. For each one we also try “Interlocking”'
  )
])
const interlock = () => field(T['prop.interlock'])
for (const [value, plain, locked] of shapes) {
  if (value !== 'square') await choose(field(T['prop.cell']), value)
  await look(plain, { ms: 2600 })
  await r.click(interlock(), { after: 500 })
  await look(locked)
  await r.click(interlock(), { after: 400 })
}
await choose(field(T['prop.cell']), 'square')
await explain(field(T['prop.cellFill']), [
  t(
    'Riempimento, contorno e raggio degli angoli delle caselle',
    'Fill, outline and corner radius of the cells'
  )
])
await explain(field(T['prop.gridBackground']), [
  t(
    'Sfondo e bordo della griglia: dietro le caselle e intorno a tutte',
    'Grid background and border: behind the cells and around them all'
  )
])
await r.title(
  t(
    'In Avanzate: margine, larghezza delle caselle rispetto all’altezza, zoom e posizione nel riquadro',
    'In Advanced: padding, cell width compared to height, zoom and position in the box'
  ),
  5200
)
await r.clear()

// ---- 2. le regole delle caselle, senza formule
const rule = (i) => props.locator('.cell-rule').nth(i)
const ruleColor = (label, i) =>
  rule(i)
    .locator('.field')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${label}$`) }) })
    .locator('input.color-text')
    .first()
const ruleWidth = (i) =>
  rule(i)
    .locator('.field')
    .filter({
      has: win.locator('.field-label', { hasText: new RegExp(`^${T['prop.cellStroke']}$`) })
    })
    .locator('input.num')
    .first()
const when = (i) => field(T['editor.cellRuleWhen'], rule(i))
const matches = (i) => rule(i).locator('p').first()
const dialog = () => win.locator('[role="dialog"]').last()
const picker = () => dialog().locator('.fx-picker').first()
const sentence = () => dialog().locator('.fx-guided > .fx-sentence').first()
async function addRule() {
  const add = props.getByRole('button', { name: T['editor.cellRuleAdd'], exact: true })
  await center(add)
  await r.click(add, { after: 600 })
}
async function check(label, i) {
  const box = field(label, rule(i))
  await center(box)
  await zoomTo(box)
  await r.click(box, { after: 500, before: 200, ms: 450 })
}
/** «Scegli le caselle…»: clic sulle caselle e «Usa queste caselle» */
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
      { after: 450, ms: 400 }
    )
  return dialog()
}
async function usePicked() {
  await r.click(dialog().getByRole('button', { name: T['cellPicker.apply'], exact: true }), {
    after: 700
  })
}
/** apre l'assistente formule della regola e sceglie una frase pronta */
async function openFx(i) {
  const fx = rule(i).locator('button.fx-button').first()
  await center(fx)
  await r.click(fx, { after: 1000 })
}
async function card(key) {
  await r.click(dialog().locator('.fx-card').filter({ hasText: T[key] }).first(), { after: 900 })
}
async function applyFx() {
  await r.click(dialog().getByRole('button', { name: T['fx.apply'], exact: true }), {
    after: 700
  })
}
const cells = TEST.rows * TEST.columns
const corners = [1, TEST.columns, cells - TEST.columns + 1, cells]

await r.title(t('Le regole delle caselle', 'Cell rules'))
await r.title(
  t(
    'Una regola dice in quali caselle vale e cosa cambia lì: il colore, il contorno, il contenuto, o se la casella c’è',
    'A rule says which cells it applies to and what changes there: the color, the outline, the content, or whether the cell is there at all'
  ),
  5600
)
await r.clear()
const heading = props.locator('h3', { hasText: T['editor.cellRules'] }).first()
await center(heading)
await r.focus(
  heading,
  t(
    'Regole delle caselle: in fondo alle proprietà della griglia',
    'Cell rules: at the bottom of the grid properties'
  ),
  'left'
)
await addRule()
await pickCells(
  0,
  [7, 18, 26, 31],
  t(
    'Il modo più semplice: Scegli le caselle… apre la griglia in grande',
    'The simplest way: Choose the cells… opens the grid drawn large'
  )
)
await r.focus(
  dialog().locator('.cell-picker').first(),
  t(
    'Un clic accende o spegne una casella; trascinando se ne scelgono di più',
    'A click turns a cell on or off; drag to pick several'
  ),
  'right',
  { pad: 0 }
)
await usePicked()
await r.focus(
  matches(0),
  t('La regola vale per 4 caselle su 40', 'The rule applies to 4 cells out of 40'),
  'left'
)
await check(T['editor.cellRuleFill'], 0)
await fill(ruleColor(T['prop.cellFill'], 0), '#F2D27A')
await look(
  t(
    'Cambia il riempimento: le caselle 7, 18, 26 e 31 diventano gialle',
    'Change the fill: cells 7, 18, 26 and 31 turn yellow'
  )
)

// caselle nascoste e snap point
await addRule()
await pickCells(1, corners)
await usePicked()
await check(T['editor.cellRuleHidden'], 1)
await look(
  t(
    'Nascondi la casella: via i quattro angoli, e la plancia non è più un rettangolo',
    'Hide the cell: the four corners are gone, and the board is no longer a rectangle'
  )
)
const snap = field(T['prop.snapCells'])
await center(snap)
await r.click(snap, { after: 600, before: 200, ms: 450 })
await r.focus(
  snap,
  t(
    'Snap point in ogni casella: in Tabletop Simulator i pezzi si agganciano al centro delle caselle',
    'Snap point in every cell: in Tabletop Simulator pieces snap to the center of the cells'
  ),
  'left'
)
await r.title(
  t(
    'Le caselle nascoste non hanno snap point. Tutto sugli snap point nel video 19',
    'Hidden cells have no snap point. Everything about snap points is in video 19'
  ),
  5000
)
await r.clear()
// i segni degli snap point coprono le caselle: per il resto del video si tolgono
await center(snap)
await r.click(snap, { after: 500, before: 200, ms: 400 })

// ---- 3. le regole con l'assistente formule
await r.title(t('Regole con l’assistente formule', 'Rules with the formula assistant'))
await r.title(
  t(
    'Per le regole che seguono uno schema ci sono frasi pronte: niente da scrivere',
    'For rules that follow a pattern there are ready sentences: nothing to type'
  ),
  4400
)
await r.clear()
await addRule()
await r.focus(
  rule(2).locator('button.fx-button').first(),
  t('fx apre l’assistente formule', 'fx opens the formula assistant'),
  'left'
)
await openFx(2)
await r.focus(
  dialog().locator('.fx-cards').first(),
  t(
    'Cosa vuoi fare? Le frasi pronte per le regole delle caselle',
    'What do you want to do? The ready sentences for cell rules'
  ),
  'right',
  { pad: 4 }
)
await card('fx.card.everyNCond')
await r.focus(
  sentence(),
  t(
    'Vero ogni 10 caselle: il 10 si può cambiare con un clic',
    'True every 10 cells: one click changes the 10'
  ),
  'below'
)
await r.focus(
  dialog().locator('.fx-strip').first(),
  t(
    'Sotto, il risultato sulle prime caselle: vero nella 10',
    'Below, the result on the first cells: true in cell 10'
  ),
  'above'
)
await applyFx()
await check(T['editor.cellRuleFill'], 2)
await fill(ruleColor(T['prop.cellFill'], 2), '#F2C9BC')
await look(
  t(
    'Le caselle 10, 20 e 30 hanno il fondo rosato (la 40 è nascosta)',
    'Cells 10, 20 and 30 get a pink background (40 is hidden)'
  )
)

// un confronto: la prima riga
await addRule()
await openFx(3)
await card('fx.card.compare')
await r.focus(
  sentence(),
  t(
    'Confronta un campo con un valore: cosa confrontare, come e con cosa',
    'Compare a field with a value: what to compare, how and with what'
  ),
  'below'
)
await r.click(picker().getByRole('tab', { name: T['fx.tab.system'], exact: true }), {
  after: 600
})
const rowItem = picker()
  .locator('.fx-list button')
  .filter({ hasText: T['fx.var.cell.row'] })
  .first()
await r.focus(
  rowItem,
  t(
    'Componente e casella: la riga della casella, {cell.row}',
    'Component & cell: the row of the cell, {cell.row}'
  ),
  'below'
)
await r.click(rowItem, { after: 700 })
await choose(sentence().locator('select').first(), '=')
await r.click(sentence().locator(':scope > .fx-leaf').last(), { after: 700 })
const numberInput = picker().locator('.fx-tab-body input[inputmode=decimal]').first()
await r.click(numberInput, { after: 200 })
await win.keyboard.press('Control+A')
await r.type('1')
await r.click(picker().getByRole('button', { name: T['fx.use'], exact: true }), { after: 700 })
await r.focus(
  sentence(),
  t('Vero quando la riga della casella è uguale a 1', 'True when the cell row equals 1'),
  'below'
)
await applyFx()
await check(T['editor.cellRuleStroke'], 3)
await fill(ruleColor(T['prop.cellStroke'], 3), '#A33A2A')
await fill(ruleWidth(3), '0.8')
await look(
  t(
    'Cambia il contorno: la prima riga ha un bordo rosso più spesso',
    'Change the outline: the first row has a thicker red border'
  )
)

// la scacchiera e l'ordine delle regole
await addRule()
await openFx(4)
await card('fx.card.checkerboardCond')
await r.focus(
  sentence(),
  t('Scacchiera: una casella sì e una no', 'Checkerboard: every other cell'),
  'below'
)
await applyFx()
await check(T['editor.cellRuleFill'], 4)
await fill(ruleColor(T['prop.cellFill'], 4), '#D9CDB4')
await look(
  t(
    'La scacchiera copre le caselle gialle e rosate: è l’ultima regola, e vince',
    'The checkerboard covers the yellow and pink cells: it is the last rule, and it wins'
  )
)
const up = (i) => rule(i).locator('.cell-rule-tools button').first()
await center(up(4))
await r.focus(
  up(4),
  t(
    'Le regole valgono in ordine. Con ↑ la scacchiera va in cima',
    'Rules apply in order. With ↑ the checkerboard goes to the top'
  ),
  'left'
)
// la scacchiera sale una posizione alla volta, finché è la prima regola
const isChecker = (v) => /cell\.row\}\s*\+\s*\{cell\.column/.test(v)
for (let tries = 0; tries < 8; tries++) {
  const whens = await props
    .locator('.cell-rule')
    .evaluateAll((els) => els.map((el) => el.querySelector('input')?.value ?? ''))
  const k = whens.findIndex(isChecker)
  if (k <= 0) break
  await center(up(k))
  await r.click(up(k), { after: 700, ms: 350 })
}
await look(
  t(
    'Ora la scacchiera è sotto, e le altre regole ci stanno sopra',
    'Now the checkerboard is underneath, and the other rules sit on top of it'
  )
)
// ordine adesso: scacchiera, gialle, angoli, ogni 10, prima riga
const YELLOW = 1
const EVERY = 3
const FIRST_ROW = 4

// ---- 4. un valore nelle caselle
await r.title(t('Un testo in ogni casella', 'A text in every cell'))
await r.clear()
const textButton = props.getByRole('button', { name: T['editor.gridContentText'], exact: true })
await center(textButton)
await r.focus(
  textButton,
  t(
    'Contenuto delle caselle: Testo in ogni casella lo crea con un clic',
    'Cell content: Text in each cell creates it in one click'
  ),
  'left'
)
await r.click(textButton, { after: 1200 })
await r.focus(
  dialog().locator('.fx-cards').first(),
  t(
    'Si apre l’assistente, per far cambiare il testo da casella a casella. Per ora il testo mostra il numero della casella',
    'The assistant opens, to make the text change from cell to cell. For now the text shows the cell number'
  ),
  'right',
  { pad: 4 }
)
await r.click(dialog().getByRole('button', { name: T['dialog.cancel'], exact: true }), {
  after: 700
})
await look(
  t(
    'In ogni casella il suo numero: 1, 2, 3… riga per riga',
    'Every cell shows its number: 1, 2, 3… row by row'
  )
)
const cellText = `${N.grid}_text`
await r.click(layer(N.grid), { after: 600 })
const valueRule = T['editor.cellRuleLayer'].replace('{name}', cellText)
const valueBox = field(valueRule, rule(YELLOW))
await center(valueBox)
await explain(valueBox, [
  t(
    `Ora ogni regola ha anche Cambia «${cellText}»: un valore per il testo, solo nelle sue caselle`,
    `Now every rule also has Change “${cellText}”: a value for the text, only in its cells`
  )
])
await check(valueRule, YELLOW)
await fill(field(T['layerType.text'], rule(YELLOW)), '+2')
await look(
  t(
    'Nelle caselle gialle il testo +2 al posto del numero',
    'In the yellow cells the text +2 instead of the number'
  )
)
await r.title(
  t(
    'Un’icona in certe caselle, un testo in altre: una regola per ciascuna, senza formule',
    'An icon in some cells, a text in others: one rule each, with no formulas'
  ),
  4600
)
await r.clear()

// ---- 5. le formule dietro le frasi
await r.title(t('Le formule dietro le frasi', 'The formulas behind the sentences'))
await r.title(
  t(
    'Ogni regola è una formula: si può leggere, cambiare o scrivere a mano',
    'Every rule is a formula: you can read it, change it or write it by hand'
  ),
  4400
)
await r.clear()
await center(when(YELLOW))
await explain(when(YELLOW), [
  t(
    'Scegli le caselle… ha scritto INLIST({cell.index}; "7, 18, 26, 31")',
    'Choose the cells… wrote INLIST({cell.index}; "7, 18, 26, 31")'
  ),
  t(
    'INLIST è vera se il primo valore è nell’elenco. A mano si scrive anche "1-5": dalla 1 alla 5',
    'INLIST is true when the first value is in the list. By hand you can also write "1-5": from 1 to 5'
  )
])
await center(when(EVERY))
await explain(when(EVERY), [
  t('Ogni 10 caselle è MOD({cell.index}; 10) = 0', 'Every 10 cells is MOD({cell.index}; 10) = 0')
])
for (const [line, ms] of [
  [
    t(
      'MOD(a; b) è il resto della divisione di a per b',
      'MOD(a; b) is the remainder of a divided by b'
    ),
    4000
  ],
  [
    t(
      'MOD(23; 10) = 3      perché 23 = 2 × 10 + 3',
      'MOD(23; 10) = 3      because 23 = 2 × 10 + 3'
    ),
    4200
  ],
  [
    t(
      'MOD(30; 10) = 0      perché 30 = 3 × 10 + 0',
      'MOD(30; 10) = 0      because 30 = 3 × 10 + 0'
    ),
    4200
  ],
  [
    t(
      'Resto 0 vuol dire che a è un multiplo di b: le caselle 10, 20, 30…',
      'A remainder of 0 means that a is a multiple of b: cells 10, 20, 30…'
    ),
    4200
  ]
])
  await r.title(line, ms)
await r.clear()
await center(when(FIRST_ROW))
await explain(when(FIRST_ROW), [
  t('La prima riga è {cell.row} = 1', 'The first row is {cell.row} = 1')
])

// le variabili della casella, sul testo
async function selectText() {
  await r.click(layer(cellText), { after: 800 })
  // il testo creato da «Testo in ogni casella» può riaprire l'assistente
  const cancel = dialog().getByRole('button', { name: T['dialog.cancel'], exact: true })
  if (await cancel.isVisible().catch(() => false)) await r.click(cancel, { after: 600 })
  if (process.env.SNAP) await win.screenshot({ path: `${process.env.SNAP}/text-${++snaps}.png` })
}
await selectText()
for (const [v, text] of [
  [
    'cell.row',
    t('{cell.row}: il numero della riga, da 1 a 5', '{cell.row}: the row number, from 1 to 5')
  ],
  [
    'cell.column',
    t(
      '{cell.column}: il numero della colonna, da 1 a 8',
      '{cell.column}: the column number, from 1 to 8'
    )
  ],
  [
    'cell.index',
    t(
      '{cell.index}: il numero della casella, 1, 2, 3… riga per riga',
      '{cell.index}: the cell number, 1, 2, 3… row by row'
    )
  ]
]) {
  const box = props.locator('.value-source textarea').first()
  await fill(box, `={${v}}`)
  if (process.env.SNAP) await win.screenshot({ path: `${process.env.SNAP}/var-${++snaps}.png` })
  await r.focus(box, t(`Nel testo: ={${v}}`, `In the text: ={${v}}`), 'left')
  await look(text)
}

// ---- 6. più complesso: un gruppo nel contenuto
await r.title(t('Più complesso: un gruppo nel contenuto', 'More complex: a group as content'))
await r.title(
  t(
    'Il contenuto è un gruppo: ci si può mettere più di un livello, per esempio una forma con i colori a caso',
    'The content is a group: it can hold more than one layer, for example a shape with random colors'
  ),
  5400
)
await r.clear()
const cell = testCell()
await selectText()
await r.click(tool('tool.shapes'))
await r.click(win.getByRole('menuitem', { name: T['tool.rect'] }).first())
await r.clear(600)
await fill(field(T['prop.name']), N.square)
const s = Math.round((cell.size - 1.6) * 100) / 100
await place(cell.x - s / 2, cell.y - s / 2, s, s)
// il nuovo livello va sopra quello selezionato: con ↓ passa sotto il testo
await r.click(win.locator('.layers-actions button').filter({ hasText: '↓' }).first(), {
  after: 600
})
await r.focus(
  win.locator('aside.layers .layers-list').first(),
  t(
    'Il quadrato è nel gruppo del contenuto: con ↓ passa sotto il testo',
    'The square is in the content group: with ↓ it goes under the text'
  ),
  'right',
  { pad: 4 }
)
await setSource('formula')
await fill(
  formula(),
  '=PICK(MOD({cell.random}; 4) + 1; "#5E7D3A"; "#7A756D"; "#C49A1E"; "#5B8DB8")'
)
await look(
  t(
    'Una mappa: ogni casella ha uno dei quattro colori, scelto a caso',
    'A map: each cell gets one of four colors, picked at random'
  )
)
await explain(formula(), [
  t(
    '{cell.random} è un numero a caso, sempre lo stesso per quella casella',
    '{cell.random} is a random number, always the same for that cell'
  ),
  t(
    'MOD(…; 4) dà 0, 1, 2 o 3; con + 1 diventa 1, 2, 3 o 4',
    'MOD(…; 4) gives 0, 1, 2 or 3; with + 1 it becomes 1, 2, 3 or 4'
  ),
  t(
    'PICK(n; a; b; c; d) prende l’elemento numero n della lista: 1 il verde, 2 il grigio, 3 il giallo, 4 l’azzurro',
    'PICK(n; a; b; c; d) takes item number n from the list: 1 green, 2 gray, 3 yellow, 4 blue'
  )
])
await r.title(
  t(
    'Il quadrato copre il riempimento delle regole: un gruppo serve quando la casella deve contenere un disegno',
    'The square covers the fill from the rules: a group is for when the cell must hold a drawing'
  ),
  5400
)
await r.clear()
await save()

// ---- 7. con un agente IA
await r.title(t('Farsi aiutare da un agente IA', 'Getting help from an AI agent'))
await r.title(
  t(
    'Le formule non vanno sapute a memoria: basta descrivere bene il risultato',
    'You don’t need to know formulas by heart: just describe the result clearly'
  ),
  4600
)
await r.clear(300)
await open(N.board)
await look(
  t(
    'La plancia del video 7: chiediamo all’agente un segnapunti sotto il tracciato',
    'The board from video 7: let’s ask the agent for a scoreboard under the track'
  )
)
await r.clear(300)
k.show('term')
await k.pause(600)
const proj = k.tilde(project)
await k.term.caption(
  t('Chiedi a parole, con tutti i dettagli', 'Ask in plain words, with every detail')
)
const ask = t(
  `Nella plancia «${N.board}», sotto il tracciato del punteggio, aggiungi una griglia di esagoni a incastro, 4 righe per 5 colonne, con il numero della casella al centro. Le caselle della prima riga devono avere il fondo azzurro, le altre bianco, con un contorno sottile.`,
  `In the “${N.board}” board, under the score track, add a grid of interlocking hexagons, 4 rows by 5 columns, with the cell number in the middle. The cells in the first row must have a light blue background, the others white, with a thin outline.`
)
await k.term.user(ask)
await k.pause(1200)
await k.term.agent(
  t(
    'Uso la skill di Stella. Prima guardo la plancia.',
    'I’m using the Stella skill. First I look at the board.'
  )
)
await k.pause(1000)
await k.run(
  `stella begin ${proj} --note "${t('Segnapunti esagonale', 'Hexagonal scoreboard')}"`,
  () => k.stella('begin', project, '--note', t('Segnapunti esagonale', 'Hexagonal scoreboard'))
)
const file = `${project}/templates/${N.board}.json`
const board = JSON.parse(readFileSync(file, 'utf8'))
await k.term.tool(t('Legge', 'Read'), `templates/${N.board}.json`)
await k.term.out(
  [
    t(
      `280 × 190 mm, livelli: ${board.front.map((l) => l.name).join(', ')}`,
      `280 × 190 mm, layers: ${board.front.map((l) => l.name).join(', ')}`
    )
  ],
  0
)
await k.pause(1800)
const plan = t(
  `Aggiungo un livello griglia «${N.track}» sotto il tracciato (esagoni, 4 × 5, a incastro) e un gruppo «${N.trackCell}» come contenuto delle caselle: un testo con {cell.index}, e una regola delle caselle che colora la prima riga.`,
  `I’m adding a “${N.track}” grid layer under the track (hexagons, 4 × 5, interlocking) and a “${N.trackCell}” group as the cell content: a text with {cell.index} and a cell rule that colors the first row.`
)
await k.term.agent(plan)
await k.read(plan)
const { grid, group } = agentGrid(N)
board.front.splice(1, 0, group, grid)
await k.edit(file, JSON.stringify(board, null, 2) + '\n', {
  lines: [
    t(
      `+ griglia «${N.track}»: esagoni, 4 × 5, a incastro, contenuto «${N.trackCell}»`,
      `+ grid “${N.track}”: hexagons, 4 × 5, interlocking, content “${N.trackCell}”`
    ),
    t(
      `+ gruppo «${N.trackCell}»: testo {cell.index}`,
      `+ group “${N.trackCell}”: text {cell.index}`
    ),
    t(
      '  regola: quando {cell.row} = 1, riempimento #9CC9E8',
      '  rule: when {cell.row} = 1, fill #9CC9E8'
    )
  ]
})
await k.run(`stella end ${proj}`, () => k.stella('end', project), { after: 700 })
const tmp = `/tmp/stella-griglie-${lang}`
rmSync(tmp, { recursive: true, force: true })
mkdirSync(tmp, { recursive: true })
await k.run(`stella render ${proj} --set ${N.boardSet}`, () =>
  k.stella('render', project, '--set', N.boardSet, '--card', '1', '--dpi', '120', '--out', tmp)
)
await k.term.images(
  [k.png(`${tmp}/${N.boardSet}/1.png`)],
  t('La plancia con il segnapunti', 'The board with the scoreboard')
)
await k.pause(4200)
await k.term.hideImages()
const done = t(
  `Fatto: il segnapunti «${N.track}» è sotto il tracciato, con i numeri da 1 a 20 e la prima riga azzurra. Per cambiare i colori basta modificare la regola delle caselle.`,
  `Done: the “${N.track}” scoreboard is under the track, numbered 1 to 20 with a light blue first row. To change the colors, just edit the cell rule.`
)
await k.term.agent(done)
await k.read(done)
k.show('app')
await layer(N.track).waitFor()
await r.wait(800)
await r.overlay()
await look(t('In Stella la plancia si è già aggiornata', 'In Stella the board has already updated'))
await r.click(layer(N.track), { after: 500 })
await explain(field(T['editor.cellRuleWhen'], props.locator('.cell-rule').first()), [
  t(
    'La regola scritta dall’agente: quando {cell.row} = 1, la prima riga, il fondo è azzurro',
    'The rule the agent wrote: when {cell.row} = 1, the first row, the background is light blue'
  )
])
await r.title(
  t(
    'Il consiglio: di’ forma e numero delle caselle, dove metterle, cosa scrivere dentro e quali caselle devono essere diverse',
    'Tip: say the shape and number of cells, where to put them, what goes inside and which cells must be different'
  ),
  7000
)

// ---- chiusura
await r.title(
  t(
    'Un gruppo, una griglia, qualche regola: ogni casella diversa',
    'One group, one grid, a few rules: every cell different'
  ),
  4600
)
await r.title(
  t(
    'Tutto il resto è nella guida: stella.lucadj.eu',
    'Everything else is in the guide: stella.lucadj.eu'
  ),
  4200
)
await r.clear(600)
await k.sync()
console.log('EDL', await k.finish('griglie'))
