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
r.focus = async (locs, ...rest) => {
  await zoomTo(locs)
  return focus0(locs, ...rest)
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

async function fill(loc, text, { tab = true } = {}) {
  await loc.scrollIntoViewIfNeeded()
  await zoomTo(loc)
  await r.click(loc, { after: 250, before: 200, ms: 450 })
  await win.keyboard.press('Control+A')
  await r.type(text)
  if (tab) await win.keyboard.press('Tab')
  await r.wait(400)
}
async function choose(loc, value) {
  await loc.scrollIntoViewIfNeeded()
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

// ---- 2. il contenuto delle caselle
const cell = testCell()
const s = Math.round((cell.size - 1.6) * 100) / 100
await r.title(t('Il contenuto delle caselle', 'Cell content'))
await r.title(
  t(
    'In ogni casella mettiamo un quadrato bianco e un numero, riuniti in un gruppo',
    'In every cell we put a white square and a number, joined in a group'
  ),
  4200
)
await r.clear()
await r.click(tool('tool.shapes'))
await r.click(win.getByRole('menuitem', { name: T['tool.rect'] }).first())
await r.clear(500)
await fill(field(T['prop.name']), N.square)
await fill(colorField(T['prop.fill']), '#FFFFFF')
await place(120, 70, s, s)
await r.click(tool('tool.text'))
await r.clear(500)
await fill(field(T['prop.name']), N.label)
await setSource('fixed')
await fill(field(T['prop.text']), '{cell.index}')
await explain(field(T['prop.text']), [
  t(
    'Nel testo scriviamo {cell.index}: vuol dire «il numero di questa casella»',
    'In the text we write {cell.index}: it means “the number of this cell”'
  )
])
await fill(field(T['prop.size']), '14')
await choose(field(T['prop.weight']), '700')
await choose(field(T['prop.align']), 'center')
await choose(field(T['prop.valign']), 'middle')
await place(120, 70, s, s)
await r.click(layer(N.square), { after: 400 })
await win.keyboard.down('Shift')
await r.click(layer(N.label), { after: 400 })
await win.keyboard.up('Shift')
await r.focus(
  win.locator('aside.layers .layers-list').first(),
  t(
    'Selezioniamo i due livelli: clic sul primo, Maiuscolo + clic sul secondo',
    'Select both layers: click the first, Shift + click the second'
  ),
  'right',
  { pad: 4 }
)
await r.focus(groupButton(), t('Raggruppa (⌘G / Ctrl+G)', 'Group (⌘G / Ctrl+G)'), 'right')
await r.click(groupButton())
await r.wait(600)
await fill(field(T['prop.name']), N.group)
await r.focus(
  win.locator('aside.layers .layers-list').first(),
  t(
    `Il gruppo «${N.group}»: dentro ci sono il quadrato e il numero`,
    `The “${N.group}” group: the square and the number are inside`
  ),
  'right',
  { pad: 4 }
)
await r.click(layer(N.grid), { after: 500 })
const content = field(T['prop.content'])
await explain(content, [
  t(
    'Contenuto delle caselle: il gruppo da ripetere in ogni casella',
    'Cell content: the group to repeat in every cell'
  )
])
await choose(content, N.group)
const placeBtn = props.getByRole('button', { name: T['editor.gridContentPlace'], exact: true })
await r.focus(
  placeBtn,
  t(
    'Porta nella prima casella: sposta il gruppo al centro della prima casella',
    'Move to the first cell: moves the group to the center of the first cell'
  ),
  'left'
)
await r.click(placeBtn)
await r.wait(800)
await look(
  t(
    'Il gruppo sta nella prima casella, e ogni altra casella ne riceve una copia',
    'The group sits in the first cell, and every other cell gets a copy'
  )
)
await r.title(
  t(
    'Il gruppo è uno stampo: lo modifichi una volta e cambia in tutte le caselle',
    'The group is a mold: change it once and it changes in every cell'
  ),
  4600
)
await r.clear()

// ---- 3. le variabili della casella
await r.title(t('Le variabili della casella', 'The cell variables'))
await r.clear()
await r.click(layer(N.label), { after: 500 })
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
    'cell.count',
    t(
      '{cell.count}: quante caselle ha la griglia, qui 40 in tutte',
      '{cell.count}: how many cells the grid has, here 40 everywhere'
    )
  ],
  [
    'cell.random',
    t(
      '{cell.random}: un numero a caso, sempre lo stesso per quella casella',
      '{cell.random}: a random number, always the same for that cell'
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
  await fill(field(T['prop.text']), `{${v}}`)
  await look(text)
}

// ---- 4. una formula, passo per passo
await r.title(t('Scrivere una formula, passo per passo', 'Writing a formula, step by step'))
await r.title(
  t(
    'Con una formula il testo cambia da casella a casella secondo una regola',
    'With a formula the text changes from cell to cell following a rule'
  ),
  4200
)
await r.clear()
await explain(source(), [
  t('Valore sulle carte: da «Fisso» a «Formula»', 'Value on cards: from “Fixed” to “Formula”')
])
await setSource('formula')
await fill(formula(), `=IF({cell.index} = 1; "${t('Via', 'Go')}"; {cell.index})`)
await look(
  t(
    'La prima casella dice «Via», le altre il loro numero',
    'The first cell says “Go”, the others their number'
  )
)
await explain(formula(), [
  t(
    '= all’inizio: questa è una formula, come in Excel',
    '= at the start: this is a formula, like in Excel'
  ),
  t(
    'IF(condizione; se vera; se falsa): tre parti, separate dal punto e virgola',
    'IF(condition; if true; if false): three parts, separated by semicolons'
  ),
  t(
    'La condizione: {cell.index} = 1. È vera solo nella prima casella',
    'The condition: {cell.index} = 1. It is true only in the first cell'
  ),
  t(
    'Se è vera scrive "Via": un testo va sempre tra virgolette',
    'If true it writes "Go": text always goes in quotes'
  ),
  t(
    'Se è falsa scrive {cell.index}: il numero della casella',
    'If false it writes {cell.index}: the cell number'
  )
])

// MOD
await r.title(t('MOD: il resto della divisione', 'MOD: the remainder of a division'))
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
      'Resto 0 vuol dire che a è un multiplo di b',
      'A remainder of 0 means that a is a multiple of b'
    ),
    3800
  ]
])
  await r.title(line, ms)
await r.clear()
await fill(formula(), '=MOD({cell.index}; 10)')
await look(
  t(
    'Ogni casella mostra il resto di {cell.index} diviso 10: 1, 2 … 9, poi 0, e si ricomincia',
    'Each cell shows the remainder of {cell.index} divided by 10: 1, 2 … 9, then 0, and again'
  )
)
await look(
  t(
    'Il resto è 0 nelle caselle 10, 20, 30 e 40: i multipli di 10',
    'The remainder is 0 in cells 10, 20, 30 and 40: the multiples of 10'
  )
)

// IF e MOD insieme
await r.title(t('IF e MOD insieme', 'IF and MOD together'))
await r.clear()
const red = (n) =>
  `=IF(MOD({cell.index}; ${n}) = 0; "[" & {cell.index} & "]{color=#A33A2A weight=900}"; {cell.index})`
await fill(formula(), red(10))
await look(
  t('I multipli di 10 diventano rossi e in grassetto', 'Multiples of 10 turn red and bold')
)
await explain(formula(), [
  t(
    'La condizione: MOD({cell.index}; 10) = 0, cioè «la casella è un multiplo di 10»',
    'The condition: MOD({cell.index}; 10) = 0, that is “the cell is a multiple of 10”'
  ),
  t(
    'Se è vera: [numero]{color=… weight=900}, il markup del video 4 per il rosso e il grassetto',
    'If true: [number]{color=… weight=900}, the markup from video 4 for red and bold'
  ),
  t(
    '& unisce i pezzi: "[" & 10 & "]{…}" diventa [10]{…}',
    '& joins the pieces: "[" & 10 & "]{…}" becomes [10]{…}'
  ),
  t('Se è falsa: il numero, così com’è', 'If false: the number, as it is')
])
await fill(formula(), red(5))
await look(
  t('Con 5 al posto di 10: 5, 10, 15, 20… in rosso', 'With 5 instead of 10: 5, 10, 15, 20… in red')
)
await fill(formula(), red(10))

// ---- 5. colori a caso, dal contenuto
await r.title(t('Colori a caso', 'Random colors'))
await r.clear()
await r.click(layer(N.square), { after: 500 })
await explain(source(), [
  t(
    'Il quadrato del contenuto: anche il suo colore può venire da una formula',
    'The square in the content: its color can come from a formula too'
  )
])
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
    'Per tutto il resto non serve una forma nel contenuto: ci sono le regole delle caselle',
    'For everything else you don’t need a shape in the content: there are cell rules'
  ),
  4800
)
await r.clear()
await r.click(tip(layerRow(N.square), 'layers.hide'), { after: 500 })
await look(
  t(
    'Nascondiamo il quadrato: si vedono di nuovo le caselle della griglia',
    'We hide the square: the grid cells show again'
  )
)

// ---- 6. le regole delle caselle
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
async function addRule() {
  const add = props.getByRole('button', { name: T['editor.cellRuleAdd'], exact: true })
  await add.scrollIntoViewIfNeeded()
  await r.click(add, { after: 600 })
}
async function check(label, i) {
  const box = field(label, rule(i))
  await box.scrollIntoViewIfNeeded()
  await zoomTo(box)
  await r.click(box, { after: 500, before: 200, ms: 450 })
}

await r.title(t('Le regole delle caselle', 'Cell rules'))
await r.title(
  t(
    'Ogni regola ha una condizione: dove è vera, la casella cambia aspetto',
    'Each rule has a condition: where it is true, the cell changes its look'
  ),
  4400
)
await r.clear()
await r.click(layer(N.grid), { after: 500 })
const heading = props.locator('h3', { hasText: T['editor.cellRules'] }).first()
await heading.scrollIntoViewIfNeeded()
await r.focus(
  heading,
  t(
    'Regole delle caselle: in fondo alle proprietà della griglia',
    'Cell rules: at the bottom of the grid properties'
  ),
  'left'
)
await addRule()
await fill(when(0), '=MOD({cell.index}; 10) = 0')
await explain(when(0), [
  t(
    'Quando: la stessa condizione di prima, «la casella è un multiplo di 10»',
    'When: the same condition as before, “the cell is a multiple of 10”'
  )
])
await r.focus(
  matches(0),
  t(
    'Stella conta per quante caselle vale: 4 su 40',
    'Stella counts how many cells it applies to: 4 out of 40'
  ),
  'left'
)
await check(T['editor.cellRuleFill'], 0)
await fill(ruleColor(T['prop.cellFill'], 0), '#F2C9BC')
await look(
  t(
    'Cambia il riempimento: le caselle 10, 20, 30 e 40 hanno il fondo rosato',
    'Change the fill: cells 10, 20, 30 and 40 get a pink background'
  )
)

// il contorno, con l'assistente formule
await addRule()
await fill(when(1), '={cell.column} = 1')
const fxButton = rule(1).locator('button.fx-button').first()
await r.focus(
  fxButton,
  t(
    'fx apre l’assistente formule, anche per le condizioni delle regole',
    'fx opens the formula assistant, for rule conditions too'
  ),
  'left'
)
await r.click(fxButton, { after: 900 })
await r.focus(
  dialog().locator('.fx-sentence').first(),
  t(
    'La condizione letta come una frase: colonna della casella uguale a 1',
    'The condition read as a sentence: cell column equals 1'
  ),
  'below'
)
await r.focus(
  dialog().locator('.fx-strip').first(),
  t(
    'Sotto, il risultato sulle prime caselle: vero nella 1 e nella 9, l’inizio di ogni riga',
    'Below, the result on the first cells: true in 1 and 9, the start of each row'
  ),
  'above'
)
await r.click(dialog().getByRole('button', { name: T['fx.apply'], exact: true }), { after: 600 })
await check(T['editor.cellRuleStroke'], 1)
await fill(ruleColor(T['prop.cellStroke'], 1), '#A33A2A')
await fill(ruleWidth(1), '0.8')
await look(
  t(
    'Cambia il contorno: la prima colonna ha un bordo rosso più spesso',
    'Change the outline: the first column has a thicker red border'
  )
)

// caselle scelte con il clic, con un valore nel contenuto
await r.title(
  t(
    'Caselle scelte una per una: senza scrivere formule',
    'Cells picked one by one: without writing formulas'
  ),
  3800
)
await r.clear()
await addRule()
const pick = rule(2).getByRole('button', { name: T['cellPicker.open'], exact: true })
await r.focus(
  pick,
  t('Scegli le caselle… apre la griglia in grande', 'Choose the cells… opens the grid drawn large'),
  'left'
)
await r.click(pick, { after: 900 })
const pickCell = (n) =>
  dialog()
    .locator('.cell-picker-cell')
    .nth(n - 1)
for (const n of [7, 18, 26, 31]) await r.click(pickCell(n), { after: 450, ms: 400 })
await r.focus(
  dialog().locator('.cell-picker').first(),
  t(
    'Un clic accende o spegne una casella; trascinando se ne scelgono di più',
    'A click turns a cell on or off; drag to pick several'
  ),
  'right',
  { pad: 0 }
)
await r.click(dialog().getByRole('button', { name: T['cellPicker.apply'], exact: true }), {
  after: 600
})
await explain(when(2), [
  t(
    'La condizione si è scritta da sola: INLIST, «il numero della casella è nell’elenco»',
    'The condition wrote itself: INLIST, “the cell number is in the list”'
  ),
  t(
    'A mano si può scrivere anche un intervallo: "1-5" vale per le caselle da 1 a 5',
    'By hand you can also write a range: "1-5" covers cells 1 to 5'
  )
])
await check(T['editor.cellRuleFill'], 2)
await fill(ruleColor(T['prop.cellFill'], 2), '#F2D27A')
const labelRule = T['editor.cellRuleLayer'].replace('{name}', N.label)
await explain(field(labelRule, rule(2)), [
  t(
    `Cambia «${N.label}»: la regola dà un valore a un livello del contenuto`,
    `Change “${N.label}”: the rule gives a value to a layer of the content`
  )
])
await check(labelRule, 2)
await fill(field(T['layerType.text'], rule(2)), '+2')
await look(
  t(
    'Nelle caselle 7, 18, 26 e 31: il fondo giallo e il testo +2 al posto del numero',
    'In cells 7, 18, 26 and 31: a yellow background and the text +2 instead of the number'
  )
)
await r.title(
  t(
    'Un’icona in certe caselle e un testo in altre: una regola per ciascuna',
    'An icon in some cells and a text in others: one rule for each'
  ),
  4200
)
await r.clear()

// ---- caselle nascoste
await r.title(t('Caselle nascoste', 'Hidden cells'))
await r.clear()
await addRule()
await fill(
  when(3),
  `=INLIST({cell.index}; "1, ${TEST.columns}, ${TEST.columns * (TEST.rows - 1) + 1}, ${TEST.columns * TEST.rows}")`
)
await explain(when(3), [
  t(
    'INLIST si scrive anche a mano: le caselle dei quattro angoli',
    'INLIST can be typed by hand too: the cells in the four corners'
  )
])
await check(T['editor.cellRuleHidden'], 3)
await look(
  t(
    'Nascondi la casella: i quattro angoli spariscono, con il loro contenuto',
    'Hide the cell: the four corners disappear, with their content'
  )
)
await r.title(
  t(
    'Le regole valgono in ordine: se due cambiano la stessa cosa, vince l’ultima',
    'Rules apply in order: if two change the same thing, the last one wins'
  ),
  4400
)
await r.title(
  t(
    'Le regole ricordano i numeri delle caselle: se cambi righe o colonne, ricontrollale',
    'Rules remember cell numbers: if you change rows or columns, check them again'
  ),
  4600
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
