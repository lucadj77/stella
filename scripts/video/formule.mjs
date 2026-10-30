// Video 23, quarto approfondimento: le formule, una funzione alla volta. Circa 14 minuti senza voce, sul
// progetto «Bestiario» di progetto-formule.mjs, che chi guarda scarica dal sito. Capitoli: composizione,
// calcolo ed espressione; confronti e IF; i numeri; il testo; PICK ed elenchi; livelli Valore e colori
// calcolati; variabili di sistema; chi vince; le formule nelle griglie; errori e aiuti.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node --experimental-strip-types --no-warnings scripts/video/formule.mjs it|en
// FAST=1 accorcia attese e scrittura; SHOT=<file.png> salva la schermata se un elemento non si trova;
// SNAP=<cartella> salva una schermata dopo ogni testo.
import { launch, mockOpen } from './lib.mjs'
import { docs } from '../guide/lib.mjs'
import { make, names } from './progetto-formule.mjs'
const lang = process.argv[2] || 'it'
const it = lang === 'it'
const t = (a, b) => (it ? a : b)
const N = names(lang)
const { C, E } = N
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
      await win.screenshot({ path: `${process.env.SNAP}/${String(++n).padStart(3, '0')}.png` })
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
const source = (kind) =>
  props
    .locator('.source-line .segmented button')
    .filter({
      hasText: new RegExp(
        `^${kind === 'column' ? T['source.short.column'] : T['source.kind.' + kind]}$`
      )
    })
    .first()
const layer = (n) => win.locator('.layers .layer-name', { hasText: new RegExp(`^${n}$`) }).first()
const tool = (key) =>
  win.locator(`button.tool[title="${T[key]}"], button.tool[data-tip="${T[key]}"]`).first()
const titled = (key) => win.locator(`[title="${T[key]}"], [data-tip="${T[key]}"]`).first()
const side = (name) => win.locator('.sidebar').getByText(name, { exact: true }).first()
const varItem = (name) =>
  win
    .locator('#sidebar-variables li button')
    .filter({ hasText: `{${name}}` })
    .first()
const saveButton = () =>
  win
    .locator('header.toolbar button')
    .filter({ hasText: new RegExp(`^(${T['app.save']}|${T['app.saved']})$`) })
    .first()
const grid = () => win.locator('.card-grid').first()
const cell = (i) => win.locator('.card-grid .card-cell').nth(i)
const form = win.locator('.card-form')
const cardField = (col) =>
  form
    .locator('label')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${col}$`) }) })
    .locator('input, textarea')
    .first()
const previewCard = () => win.locator('aside.preview .preview-card').first()
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
  await r.wait(250)
}
async function choose(loc, value) {
  await loc.scrollIntoViewIfNeeded()
  await r.click(loc, { after: 200, before: 200, ms: 450 })
  await win.keyboard.press('Escape')
  await loc.selectOption(value)
  await r.wait(500)
}
async function setSource(kind) {
  const b = source(kind)
  if ((await b.getAttribute('aria-pressed')) !== 'true') await r.click(b, { after: 400 })
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
async function view(key) {
  await r.click(win.locator('.set-header .segmented button').filter({ hasText: T[key] }).first(), {
    after: 700
  })
}
async function openTemplate() {
  await r.click(side(N.tCard))
  await r.clear(1200)
  await r.overlay()
}
async function openVariable(name) {
  await r.openSection('variables')
  await r.click(varItem(name))
  await r.clear(700)
  await r.overlay()
}
async function closeWith(key) {
  await r.click(dialog().getByRole('button', { name: T[key], exact: true }))
  await r.clear(700)
}
/** nell'editor, i dati della carta n del primo set */
async function previewRow(n) {
  const sel = win.locator('.preview-data select')
  if ((await sel.first().inputValue()) !== '0') await choose(sel.first(), '0')
  await choose(sel.nth(1), String(n))
}
/** un livello passa a Formula, con la formula scritta */
async function formula(name, expr) {
  await r.click(layer(name))
  await setSource('formula')
  await fill(field(T['source.formula']), expr, { tab: false })
  await win.keyboard.press('Tab')
  await r.wait(800)
}
/** un nuovo livello Valore con il suo nome */
async function valueLayer(name) {
  await r.click(tool('tool.value'))
  await r.clear(500)
  await fill(field(T['prop.name']), name)
  await r.wait(400)
}
// regole delle caselle di una griglia
const rule = (i) => props.locator('.cell-rule').nth(i)
const ruleCheck = (i, key) => prow(T[key], rule(i)).locator('input[type=checkbox]').first()
const colorField = (label, scope = props) => prow(label, scope).locator('input.color-text').first()
async function addRule() {
  await r.click(props.getByRole('button', { name: T['editor.cellRuleAdd'], exact: true }).first(), {
    after: 700
  })
}
async function check(loc) {
  await center(loc)
  await r.click(loc, { after: 500, before: 200, ms: 450 })
}
/** zoom sulla carta e testo sopra: per leggere i numeri piccoli delle caselle */
async function look(text) {
  await r.clear(100)
  await r.zoom(stage(), { max: 1.7, fill: 0.72 })
  await r.focus(stage(), text, 'above', { pad: 0, dim: false })
}
async function pick(n) {
  await r.click(cell(n), { after: 600 })
}

const f = (n) => `{${n}}`
const AT = f(C.attack)
const DF = f(C.defense)
const LV = f(C.level)
const POWER = t('potenza', 'power')
const TEST = t('prova', 'test')
const RANKS = t('ranghi', 'ranks')
const X = {
  name: `${f(C.name)} · ${t('liv.', 'lv.')} ${LV}`,
  sum: `${AT} + ${DF}`,
  sumText: `${t('Forza', 'Strength')} ${AT} + ${DF}`,
  strength: `="${t('Forza', 'Strength')} " & (${AT} + ${DF})`,
  temper1: `=IF(${AT} > ${DF}; "${t('Aggressiva', 'Aggressive')}"; "${t('Difensiva', 'Defensive')}")`,
  temper2: `=IF(${AT} = ${DF}; "${t('Equilibrata', 'Balanced')}"; IF(${AT} > ${DF}; "${t('Aggressiva', 'Aggressive')}"; "${t('Difensiva', 'Defensive')}"))`,
  and: `=AND(${LV} = 3; ${AT} > 5)`,
  or: `=OR(${LV} = 1; ${DF} > 5)`,
  cost1: `=(${AT} + ${DF}) / 3`,
  cost2: `=ROUND((${AT} + ${DF}) / 3; 1)`,
  cost3: `=CEILING((${AT} + ${DF}) / 3)`,
  cost4: `=MIN(5; MAX(1; CEILING((${AT} + ${DF}) / 3)))`,
  abs: `=ABS(${AT} - ${DF})`,
  mod: `=MOD(${AT}; 2)`,
  ability: `=IF(ISBLANK(${f(C.ability)}); "${t('Nessuna abilità', 'No ability')}"; ${f(C.ability)})`,
  upper: `=UPPER(${f(C.name)})`,
  len: `=LEN(${f(C.name)})`,
  concat: `=CONCAT(${f(C.name)}; " ("; ${f(C.element)}; ")")`,
  countin: `=COUNTIN(${f(C.ability)}; "${t('creatur', 'creature')}")`,
  rank1: `=PICK(${LV}; "${t('Comune', 'Common')}"; "${t('Rara', 'Rare')}"; "${t('Leggendaria', 'Legendary')}")`,
  ranks: t('Comune, Rara, Leggendaria', 'Common, Rare, Legendary'),
  rank2: `=PICK(${LV}; ${f(RANKS)})`,
  power: `=${AT} + ${DF}`,
  strength2: `="${t('Forza', 'Strength')} " & ${f(POWER)}`,
  cost5: `=MIN(5; MAX(1; CEILING(${f(POWER)} / 3)))`,
  band: `=IF(${f(C.element)} = "${E[0]}"; "#B5442E"; IF(${f(C.element)} = "${E[1]}"; "#2A5D7C"; "#5B7A3A"))`,
  marker: `=IF(${f(C.type)} = "${N.I.poison}"; "#4E6B33"; "#8A2E22")`,
  number: `{card.number} / {set.cards}`,
  footer: `{project.name} · {set.name}`,
  copies: `{card.copy} / {card.copies}`,
  lair: `${t('Tana', 'Lair')} {card.number}`,
  legendBg: `=IF(${LV} = 3; "#F2DFA8"; "")`,
  typo: `="${t('Forza', 'Strength')} " & {${POWER}z}`,
  unknown: `=${t('SOMMA', 'SUM')}(${AT}; ${DF})`,
  zero: `=MOD(${AT}; 0)`,
  inlist: `=INLIST(${f(C.element)}; "${E[0]}, ${E[1]}")`,
  inlist2: `=INLIST(${LV}; "2-3")`,
  decimal: t('=2,5 * 2', '=2.5 * 2'),
  snake: '=CELLNUMBER("snake")',
  snakeVisible: '=CELLNUMBER("snake"; "visible")',
  hideRule: `={cell.index} > ${f(C.length)}`,
  everyFive: `=MOD(${f(C.points)}; 5) = 0`
}
/** scrive una formula nel livello prova e mostra il risultato sulla prima carta */
async function test(expr, text) {
  await r.click(layer(TEST))
  await fill(field(T['source.formula']), expr, { tab: false })
  await win.keyboard.press('Tab')
  await r.wait(700)
  await r.focus(sourceLine(), text, 'left', { pad: 4 })
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
/** apre un template e mostra i dati della prima riga del suo set */
async function openTemplateOf(name, set) {
  await r.click(side(name))
  await r.clear(1200)
  await r.overlay()
  const sel = win.locator('.preview-data select')
  await sel.first().selectOption({ label: set })
  await r.wait(400)
  await sel.nth(1).selectOption('0')
  await r.wait(600)
}

// apertura
await mockOpen(r.app, dest)
await r.overlay()
await r.title(t('Le formule, una funzione alla volta', 'Formulas, one function at a time'))
await r.title(
  t(
    'Il progetto «Bestiario» si scarica dal link nella descrizione: aprilo e segui passo passo',
    'The “Bestiary” project is in the description: open it and follow along'
  )
)
await r.clear()
await r.click(win.getByText(T['start.openProject']).first())
await r.clear(2200)
await r.overlay()
await r.focus(
  grid(),
  t(
    'Otto creature: nel foglio ci sono nome, elemento, livello, attacco, difesa e abilità',
    'Eight creatures: the sheet has name, element, level, attack, defense and ability'
  ),
  'right',
  { pad: 4 }
)
await r.focus(
  previewCard(),
  t(
    'Il resto della carta lo calcoleremo con le formule: forza, indole, costo, rango, numero',
    'The rest of the card will come from formulas: strength, temper, cost, rank, number'
  ),
  'left',
  { pad: 4 }
)

// 1. composizione, calcolo, espressione
await r.title(
  t('1 · Composizione, calcolo, espressione', '1 · Composition, calculation, expression')
)
await r.clear()
await r.click(win.getByRole('button', { name: T['preview.editTemplate'] }).first())
await r.clear(1200)
await r.overlay()
await formula(C.name, X.name)
await r.focus(
  [sourceLine(), stage()],
  t(
    'Composizione: il testo con i campi tra graffe. Il nome resta, si aggiunge il livello',
    'Composition: text with fields in braces. The name stays, the level is added'
  ),
  'left',
  { pad: 4 }
)
await r.focus(
  sourceLine(),
  t(
    '{nome} è la colonna del foglio, non il livello: la formula legge il dato e non gira su se stessa',
    '{name} is the sheet column, not the layer: the formula reads the data and does not loop on itself'
  ),
  'left',
  { pad: 4 }
)
await formula(C.strength, X.sum)
await r.focus(
  [sourceLine(), stage()],
  t(
    'Calcolo: solo numeri e operatori + - * /, e Stella fa la somma: 6 + 4 = 10',
    'Calculation: only numbers and the operators + - * /, and Stella does the sum: 6 + 4 = 10'
  ),
  'left',
  { pad: 4 }
)
await formula(C.strength, X.sumText)
await r.focus(
  [sourceLine(), stage()],
  t(
    'Con una parola davanti non è più un calcolo: resta il testo «6 + 4»',
    'With a word in front it is no longer a calculation: the text “6 + 4” stays'
  ),
  'left',
  { pad: 4 }
)
await formula(C.strength, X.strength)
await r.focus(
  [sourceLine(), stage()],
  t(
    'Espressione: inizia con =. Il testo va tra virgolette, & unisce testo e numeri',
    'Expression: it starts with =. Text goes in quotes, & joins text and numbers'
  ),
  'left',
  { pad: 4 }
)

// 2. confronti e IF
await r.title(t('2 · Confronti e IF', '2 · Comparisons and IF'))
await r.clear()
await formula(C.temper, X.temper1)
await r.focus(
  [sourceLine(), stage()],
  t(
    'IF(condizione; se vera; se falsa): attacco più alto della difesa, Aggressiva',
    'IF(condition; if true; if false): attack higher than defense, Aggressive'
  ),
  'left',
  { pad: 4 }
)
await previewRow(2)
await r.focus(
  stage(),
  t('Il Kraken ha 5 e 5: risulta Difensiva', 'The Kraken has 5 and 5: it comes out Defensive'),
  'left',
  { pad: 0, dim: false }
)
await formula(C.temper, X.temper2)
await r.focus(
  [sourceLine(), stage()],
  t(
    'Un IF dentro l’altro per il terzo caso. Confronti: = <> < > <= >=',
    'One IF inside another for the third case. Comparisons: = <> < > <= >='
  ),
  'left',
  { pad: 4 }
)
await valueLayer(TEST)
await setSource('formula')
await r.focus(
  layer(TEST),
  t(
    'Un livello Valore «prova» per provare le formule: sotto la formula si legge il risultato sulla prima carta',
    'A “test” Value layer to try formulas: under the formula you read the result on the first card'
  ),
  'right',
  { pad: 4 }
)
await test(
  X.and,
  t('AND: vero se tutte le condizioni sono vere', 'AND: true if every condition is true')
)
await test(
  X.or,
  t('OR: vero se almeno una è vera. NOT rovescia', 'OR: true if at least one is true. NOT flips it')
)
await test(
  X.inlist,
  t(
    'INLIST: vero se il valore è uno dell’elenco. Al posto di una catena di OR',
    'INLIST: true if the value is one of the list. Instead of a chain of OR'
  )
)
await test(
  X.inlist2,
  t(
    'Nell’elenco anche un intervallo: 2-3 vale per i livelli 2 e 3',
    'The list takes a range too: 2-3 means levels 2 and 3'
  )
)

// 3. i numeri
await r.title(t('3 · Le funzioni sui numeri', '3 · Number functions'))
await r.clear()
await previewRow(0)
await formula(C.cost, X.cost1)
await r.focus(
  [sourceLine(), stage()],
  t('Il costo: un terzo della somma, 3,33…', 'The cost: a third of the sum, 3.33…'),
  'left',
  { pad: 4 }
)
await formula(C.cost, X.cost2)
await r.focus(
  sourceLine(),
  t('ROUND arrotonda, qui a un decimale: 3,3', 'ROUND rounds, here to one decimal: 3.3'),
  'left',
  { pad: 4 }
)
await test(
  X.decimal,
  t(
    'I decimali seguono il formato dei numeri del progetto (Progetto › Lingue… › Numeri): qui all’italiana, 2,5 anche nelle formule',
    'Decimals follow the project’s number format (Project › Languages… › Numbers): here 2.5; an Italian project writes 2,5'
  )
)
await formula(C.cost, X.cost3)
await r.focus(
  [sourceLine(), stage()],
  t(
    'CEILING arrotonda per eccesso: 4. FLOOR per difetto: 3',
    'CEILING rounds up: 4. FLOOR rounds down: 3'
  ),
  'left',
  { pad: 4 }
)
await formula(C.cost, X.cost4)
await r.focus(
  [sourceLine(), stage()],
  t('MIN e MAX tengono il costo tra 1 e 5', 'MIN and MAX keep the cost between 1 and 5'),
  'left',
  { pad: 4 }
)
await test(X.abs, t('ABS: la differenza senza segno', 'ABS: the difference without sign'))
await test(
  X.mod,
  t(
    'MOD: il resto della divisione. 1, 0, 1, 0… per alternare qualcosa ogni due carte',
    'MOD: the remainder. 1, 0, 1, 0… to alternate something every two cards'
  )
)

// 4. il testo
await r.title(t('4 · Le funzioni sul testo', '4 · Text functions'))
await r.clear()
await previewRow(1)
await formula(C.ability, X.ability)
await r.focus(
  [sourceLine(), stage()],
  t(
    'ISBLANK: se l’abilità è vuota, la carta lo dice',
    'ISBLANK: when the ability is empty, the card says so'
  ),
  'left',
  { pad: 4 }
)
await test(
  X.upper,
  t('UPPER in maiuscolo, LOWER in minuscolo', 'UPPER in capitals, LOWER in lower case')
)
await test(
  X.len,
  t(
    'LEN conta i caratteri: utile per trovare i nomi troppo lunghi',
    'LEN counts the characters: handy to find names that are too long'
  )
)
await test(X.concat, t('CONCAT unisce più pezzi, come &', 'CONCAT joins several pieces, like &'))
await test(
  X.countin,
  t('COUNTIN conta quante volte compare un testo', 'COUNTIN counts how many times a text appears')
)

// 5. PICK
await r.title(t('5 · PICK e gli elenchi', '5 · PICK and lists'))
await r.clear()
await previewRow(0)
await formula(C.rank, X.rank1)
await r.focus(
  [sourceLine(), stage()],
  t(
    'PICK prende la voce numero «livello»: 3 è Leggendaria',
    'PICK takes item number “level”: 3 is Legendary'
  ),
  'left',
  { pad: 4 }
)
await r.openSection('variables')
await r.click(titled('sidebar.newVariable'))
await r.clear(700)
await fill(field(T['variable.name'], dialog()), RANKS)
await r.click(
  dialog().getByRole('button', { name: T['variable.type.value'], exact: true }).first(),
  { after: 400 }
)
await fill(field(T['variable.value'], dialog()), X.ranks)
await r.focus(
  prow(T['variable.value'], dialog()),
  t(
    'L’elenco in una variabile valore, separato da virgole',
    'The list in a value variable, separated by commas'
  ),
  'left',
  { pad: 4 }
)
await closeWith('variable.save')
await formula(C.rank, X.rank2)
await r.focus(
  [sourceLine(), stage()],
  t(
    'PICK su una variabile: l’elenco si cambia in un punto solo',
    'PICK on a variable: the list changes in one place only'
  ),
  'left',
  { pad: 4 }
)

// 6. livelli Valore e colori
await r.title(t('6 · Livelli Valore e colori calcolati', '6 · Value layers and computed colors'))
await r.clear()
await valueLayer(POWER)
await setSource('formula')
await fill(field(T['source.formula']), X.power, { tab: false })
await win.keyboard.press('Tab')
await r.wait(700)
await r.focus(
  sourceLine(),
  t(
    'Attacco più difesa torna in due formule: si calcola una volta, nel Valore «potenza»',
    'Attack plus defense appears in two formulas: compute it once, in the “power” Value'
  ),
  'left',
  { pad: 4 }
)
await formula(C.strength, X.strength2)
await formula(C.cost, X.cost5)
await r.focus(
  [sourceLine(), stage()],
  t('Forza e costo ora leggono {potenza}', 'Strength and cost now read {power}'),
  'left',
  { pad: 4 }
)
await formula(C.band, X.band)
await r.focus(
  [sourceLine(), stage()],
  t(
    'Anche un colore si calcola: la fascia prende il colore dell’elemento',
    'A color can be computed too: the band takes the color of the element'
  ),
  'left',
  { pad: 4 }
)
await save()
await openSet(N.creatures)
await r.focus(grid(), t('Tutte le carte, calcolate', 'Every card, computed'), 'right', { pad: 4 })
await openSet(N.wounds)
await view('set.table')
await r.focus(
  win.locator('.data-table').first(),
  t(
    'Nel foglio dei segnalini la colonna tipo dice ferita o veleno',
    'In the markers sheet the type column says wound or poison'
  ),
  'right',
  { pad: 4 }
)
await view('set.grid')
await openTemplateOf(N.tMarker, N.wounds)
await formula(C.bg, X.marker)
await r.focus(
  [sourceLine(), stage()],
  t(
    'Sul segnalino: rosso per le ferite, verde per il veleno',
    'On the marker: red for wounds, green for poison'
  ),
  'left',
  { pad: 4 }
)
await save()

// 7. variabili di sistema
await r.title(t('7 · Le variabili di sistema', '7 · System variables'))
await r.clear()
await r.click(layer(C.count))
await fill(field(T['prop.text']), X.copies)
await r.focus(
  [
    props
      .locator('.field')
      .filter({ has: win.locator('textarea') })
      .first(),
    stage()
  ],
  t(
    '{card.copy} / {card.copies}: le 5 copie di un segnalino si stampano da 1/5 a 5/5',
    '{card.copy} / {card.copies}: the 5 copies of a marker print from 1/5 to 5/5'
  ),
  'left',
  { pad: 4 }
)
await save()
await openTemplateOf(N.tLair, N.lairs)
await r.click(layer(C.number))
await fill(field(T['prop.text']), X.lair)
await r.focus(
  stage(),
  t(
    '{card.number}: il numero della tessera nel set',
    '{card.number}: the tile’s number in the set'
  ),
  'left',
  { pad: 0, dim: false }
)
await save()
await openTemplateOf(N.tCreature, N.creatures)
await r.click(layer(C.number))
await fill(field(T['prop.text']), X.number)
await r.focus(
  stage(),
  t(
    'In un testo Fisso «1 / 8» resta testo; in una formula sarebbe una divisione',
    'In a Fixed text “1 / 8” stays text; in a formula it would be a division'
  ),
  'left',
  { pad: 0, dim: false }
)
await face('preview.back')
await r.click(layer(C.footer))
await fill(field(T['prop.text']), X.footer)
await r.focus(
  stage(),
  t(
    'Sul retro: {project.name} e {set.name}. {card.side} dice se è il fronte o il retro',
    'On the back: {project.name} and {set.name}. {card.side} tells front from back'
  ),
  'left',
  { pad: 0, dim: false }
)
await face('preview.front')

// 8. chi vince
await r.title(t('8 · Chi vince', '8 · What wins'))
await r.clear()
await r.click(layer(C.name))
await r.focus(
  sourceLine(),
  t(
    'La colonna nome è ancora nel foglio, ma il livello ha una formula: vince la formula',
    'The name column is still in the sheet, but the layer has a formula: the formula wins'
  ),
  'left',
  { pad: 4 }
)
await formula(C.bg, X.legendBg)
await r.focus(
  [sourceLine(), stage()],
  t(
    'Per un colore un risultato vuoto lascia il valore del template: solo le leggendarie hanno lo sfondo dorato. Un testo o un’immagine restano vuoti',
    'For a color an empty result keeps the template value: only legendary cards get the gold background. A text or an image stays empty'
  ),
  'left',
  { pad: 4 }
)
await save()
await openSet(N.creatures)
await r.click(
  win
    .locator('button')
    .filter({ hasText: new RegExp(`^${T['set.addColumn'].replace('+', '\\+')}$`) })
    .first()
)
await r.clear(700)
await choose(dialog().locator('select').first(), C.name)
await r.click(
  dialog()
    .locator('.chips button')
    .filter({ hasText: /^color$/ })
    .first(),
  { after: 700 }
)
await pick(7)
await fill(cardField(`${C.name}.color`), '#F2C14E')
await r.focus(
  [cardField(`${C.name}.color`), previewCard()],
  t(
    'Una colonna nome.color cambia una proprietà su una carta sola',
    'A name.color column changes one property on a single card'
  ),
  'left',
  { pad: 4 }
)
await r.focus(
  grid(),
  t(
    'E un campo vince su una variabile con lo stesso nome: per questo Stella avvisa',
    'And a field wins over a variable with the same name: that is why Stella warns you'
  ),
  'right',
  { pad: 4 }
)

await save()

// 9. le formule nelle griglie
await r.title(t('9 · Le formule nelle griglie', '9 · Formulas in grids'))
await r.clear()
await openSet(N.tracks)
await view('set.table')
await r.focus(
  win.locator('.data-table').first(),
  t(
    'Un tracciato nel set Tracciati: la colonna lunghezza vale 26',
    'One track in the Tracks set: the length column is 26'
  ),
  'right',
  { pad: 4 }
)
await view('set.grid')
await openTemplateOf(N.tTrack, N.tracks)
await r.click(layer(C.points))
await r.focus(
  [sourceLine(), stage()],
  t(
    'Nel contenuto delle caselle valgono {cell.index}, {cell.row} e {cell.column}',
    'Inside the cells you can use {cell.index}, {cell.row} and {cell.column}'
  ),
  'left',
  { pad: 4 }
)
await formula(C.points, X.snake)
await look(
  t(
    'CELLNUMBER("snake"): a ogni riga la numerazione torna indietro',
    'CELLNUMBER("snake"): the numbering turns back on every row'
  )
)
await r.click(layer(N.grid))
await addRule()
await fill(field(T['editor.cellRuleWhen'], rule(0)), X.hideRule)
await check(ruleCheck(0, 'editor.cellRuleHidden'))
await r.focus(
  [rule(0), stage()],
  t(
    'Una regola legge anche i campi della carta: oltre la lunghezza, 26, le caselle spariscono',
    'A rule also reads the card’s fields: past the length, 26, the cells disappear'
  ),
  'left',
  { pad: 4 }
)
await formula(C.points, X.snakeVisible)
await look(
  t(
    'Con "visible" i numeri saltano le caselle nascoste: da 1 a 26',
    'With "visible" the numbers skip hidden cells: 1 to 26'
  )
)
await r.click(layer(N.grid))
await addRule()
await fill(field(T['editor.cellRuleWhen'], rule(1)), X.everyFive)
await check(ruleCheck(1, 'editor.cellRuleFill'))
await fill(colorField(T['prop.cellFill'], rule(1)), '#F2C14E')
await r.focus(
  [rule(1), stage()],
  t(
    'MOD sul numero scritto nella casella, {punti}: una casella gialla ogni 5',
    'MOD on the number written in the cell, {points}: a yellow cell every 5'
  ),
  'left',
  { pad: 4 }
)
await save()
await r.title(
  t(
    'Le regole con il mouse: video 8. DEAL e le caselle a caso: video 24 e 25',
    'Rules with the mouse: video 8. DEAL and random cells: videos 24 and 25'
  ),
  4200
)

// 10. errori e aiuti
await r.title(t('10 · Errori e aiuti', '10 · Errors and help'))
await r.clear()
await openTemplateOf(N.tCreature, N.creatures)
await previewRow(0)
await formula(C.strength, X.typo)
await r.focus(
  [sourceLine(), win.locator('.canvas-problems, .problems, .editor-problems').first()],
  t(
    'Un campo scritto male: l’errore compare sotto la carta, con il nome del livello',
    'A misspelled field: the error shows under the card, with the layer name'
  ),
  'left',
  { pad: 4 }
)
await formula(C.strength, X.strength2)
await test(X.unknown, t('Una funzione che non esiste', 'A function that does not exist'))
await test(X.zero, t('Una divisione per zero', 'A division by zero'))
await r.focus(
  props.locator('.value-source button.fx-button').first(),
  t(
    'fx apre l’assistente formule (video 13), che costruisce le formule con il mouse',
    'fx opens the formula assistant (video 13), which builds formulas with the mouse'
  ),
  'left',
  { pad: 4 }
)
await save()
await win.keyboard.press('F1')
await r.clear(1000)
await r.click(dialog().getByRole('button', { name: T['help.tab.formulas'], exact: true }), {
  after: 800
})
await r.focus(
  dialog(),
  t(
    'F1, Formule: tutte le funzioni, con un esempio ciascuna',
    'F1, Formulas: every function, with an example each'
  ),
  'right',
  { pad: 0 }
)
await win.keyboard.press('Escape')
await r.wait(500)
await r.title(
  t(
    'Le formule al lavoro: video 13 (assistente), 22 (risorse), 8 (griglie), 25 (caso)',
    'Formulas at work: videos 13 (assistant), 22 (resources), 8 (grids), 25 (chance)'
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
