// Video 22, terzo approfondimento: due campi valore, tutta la carta. Circa 12 minuti senza voce, sul
// progetto «Incontri» di progetto-incontri.mjs, che chi guarda scarica dal sito. Capitoli: il problema,
// il livello Valore, le variabili come tabelle, il luogo, il personaggio, l'incrocio, Genera, cambiare
// una regola.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node --experimental-strip-types --no-warnings scripts/video/valori.mjs it|en
// FAST=1 accorcia attese e scrittura; SHOT=<file.png> salva la schermata se un elemento non si trova;
// SNAP=<cartella> salva una schermata dopo ogni testo.
import { launch, mockOpen } from './lib.mjs'
import { docs } from '../guide/lib.mjs'
import { make, names, text, LIVE } from './progetto-incontri.mjs'
const lang = process.argv[2] || 'it'
const it = lang === 'it'
const t = (a, b) => (it ? a : b)
const N = names(lang)
const { C, P, W } = N
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

const f = (n) => `{${n}}`
const X = {
  title: `${f(C.person)} · ${f(C.place)}`,
  bg: `${N.places}/${f(C.place)}`,
  placeIcon: `${f(C.place)}${N.icon}`,
  colour: `${f(C.place)}${N.color}`,
  subject: `${N.people}/${f(C.person)}`,
  personIcon: `${f(C.person)}${N.icon}`,
  encounter: `${f(C.person)}_${f(C.place)}`,
  text: `{${f(C.encounter)}}`,
  points: `=IF(${f(C.person)}="${P[0]}"; 2; IF(${f(C.person)}="${P[1]}"; 3; 1)) + IF(${f(C.place)}="${W[2]}"; 2; 0)`,
  live: `${P[LIVE.p]}_${W[LIVE.w]}`
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
  win.locator('#sidebar-variables li button').filter({ hasText: `{${name}}` }).first()
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

async function fill(loc, text, { tab = true } = {}) {
  await loc.scrollIntoViewIfNeeded()
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
async function pick(n) {
  await r.click(cell(n), { after: 600 })
}

// generatore
const gen = () => dialog()
const genSet = (i) => gen().locator('.generate-set').nth(i)
const values = (i) => genSet(i).locator('.generate-values textarea').first()
const genCheck = (i, key) =>
  genSet(i).locator('label.check').filter({ hasText: T[key] }).locator('input').first()
const preview = () => gen().locator('.generate-preview').first()
const mode = (key) =>
  gen().locator('.dialog-buttons .segmented button').filter({ hasText: T[key] }).first()
const primary = () => gen().locator('.dialog-buttons button.primary').first()
async function tools(key) {
  const b = win.locator('button').filter({ hasText: T['set.tools'] }).first()
  await b.scrollIntoViewIfNeeded()
  await r.click(b)
  await r.wait(400)
  await r.click(win.getByRole('menuitem', { name: T[key] }).first())
  await r.clear(900)
}

// apertura
await mockOpen(r.app, dest)
await r.overlay()
await r.title(t('Due campi valore, tutta la carta', 'Two value fields, the whole card'))
await r.title(
  t(
    'Il progetto «Incontri» si scarica dal link nella descrizione: aprilo e segui passo passo',
    'The “Encounters” project is in the description: open it and follow along'
  )
)
await r.clear()
await r.click(win.getByText(T['start.openProject']).first())
await r.clear(2200)
await r.overlay()

// 1. il problema
await r.title(t('1 · Il problema', '1 · The problem'))
await r.clear()
await r.focus(
  grid(),
  t(
    'Un mazzo di incontri: ogni carta è un personaggio in un luogo',
    'A deck of encounters: each card is a character in a place'
  ),
  'right',
  { pad: 4 }
)
await pick(0)
await r.focus(
  form,
  t(
    'Sette campi da scrivere a mano per ogni carta: titolo, sfondo, icone, soggetto, testo, punti',
    'Seven fields to write by hand for each card: title, background, icons, subject, text, points'
  ),
  'left',
  { pad: 4 }
)
await pick(2)
await r.zoom(previewCard(), { max: 1.5, fill: 0.85 })
await r.focus(
  previewCard(),
  t(
    'Basta un errore: la spia è a palazzo, ma lo sfondo è il deserto',
    'One mistake is enough: the spy is at the palace, but the background is the desert'
  ),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
await r.focus(
  cardField(C.bg),
  t(
    'Eppure tutto dipende da due cose sole: chi è il personaggio e dove si trova',
    'Yet everything depends on two things only: who the character is and where they are'
  ),
  'left',
  { pad: 4 }
)

// 2. il livello Valore
await r.title(t('2 · Il livello Valore', '2 · The Value layer'))
await r.clear()
await r.click(win.getByRole('button', { name: T['preview.editTemplate'] }).first())
await r.clear(1200)
await r.overlay()
await r.focus(
  tool('tool.value'),
  t(
    'Lo strumento # crea un livello Valore: non si disegna, tiene un dato della carta',
    'The # tool creates a Value layer: it is not drawn, it holds a piece of card data'
  ),
  'below',
  { pad: 4 }
)
await valueLayer(C.person)
await r.focus(
  [layer(C.person), sourceLine()],
  t(
    'Valore da Colonna: diventa un campo del set, come un livello di testo',
    'Value from Column: it becomes a set field, like a text layer'
  ),
  'right',
  { pad: 4 }
)
await valueLayer(C.place)
await r.focus(
  win.locator('.layers').first(),
  t(
    'Personaggio e luogo: saranno gli unici campi da scrivere',
    'Character and place: they will be the only fields to write'
  ),
  'right',
  { pad: 4 }
)
await save()
await openSet(N.set)
const rows = [
  [P[1], W[0]],
  [P[0], W[1]],
  [P[2], W[2]]
]
for (const [i, [p, w]] of rows.entries()) {
  await pick(i)
  await fill(cardField(C.person), p)
  await fill(cardField(C.place), w)
}
await r.focus(
  [cardField(C.person), cardField(C.place)],
  t(
    'Le tre carte hanno i due campi nuovi; per ora gli altri restano scritti a mano',
    'The three cards have the two new fields; for now the others are still written by hand'
  ),
  'left',
  { pad: 4 }
)

// 3. le variabili come tabelle
await r.title(t('3 · Le variabili come tabelle', '3 · Variables as lookup tables'))
await r.clear()
await r.openSection('variables')
await r.focus(
  win.locator('#sidebar-variables').first(),
  t(
    'Nel progetto ci sono già le variabili, con nomi regolari: porto, porto_icona, porto_colore…',
    'The project already has variables, with regular names: port, port_icon, port_color…'
  ),
  'right',
  { pad: 4 }
)
await openVariable(W[0] + N.icon)
await prow(T['variable.bgColor'], dialog()).scrollIntoViewIfNeeded()
await r.wait(400)
await r.focus(
  [prow(T['variable.src'], dialog()), prow(T['variable.bgColor'], dialog())],
  t(
    `${W[0]}${N.icon}: l’ancora bianca in un cerchio. Il colore del cerchio è la variabile ${W[0]}${N.color}`,
    `${W[0]}${N.icon}: the white anchor in a circle. The circle color is the ${W[0]}${N.color} variable`
  ),
  'right',
  { pad: 4 }
)
await closeWith('format.cancel')
await openVariable(`${P[1]}_${W[0]}`)
await r.focus(
  dialog(),
  t(
    'Un testo per ogni incrocio: personaggio_luogo. Ne manca uno, lo scriveremo',
    'One text for each pair: character_place. One is missing, we will write it'
  ),
  'right',
  { pad: 0 }
)
await closeWith('format.cancel')
await r.title(
  t(
    'Una formula può comporre il nome della variabile da usare: {luogo}_icona',
    'A formula can build the name of the variable to use: {place}_icon'
  )
)

// 4. il luogo
await r.title(t('4 · Il luogo', '4 · The place'))
await r.clear()
await openTemplate()
await previewRow(2)
await formula(C.bg, X.bg)
await r.focus(
  [sourceLine(), stage()],
  t(
    `Sfondo: l’immagine della cartella ${N.places} con il nome del luogo. Lo sfondo della spia è giusto`,
    `Background: the image in the ${N.places} folder named after the place. The spy’s background is right`
  ),
  'left',
  { pad: 4 }
)
await formula(C.placeIcon, X.placeIcon)
await r.focus(
  [sourceLine(), stage()],
  t(
    `Icona: ${X.placeIcon} diventa ${W[2]}${N.icon}, la variabile con il suo cerchio`,
    `Icon: ${X.placeIcon} becomes ${W[2]}${N.icon}, the variable with its circle`
  ),
  'left',
  { pad: 4 }
)
await valueLayer(C.colour)
await setSource('formula')
await fill(field(T['source.formula']), X.colour, { tab: false })
await win.keyboard.press('Tab')
await r.wait(800)
await r.focus(
  sourceLine(),
  t(
    `Un livello Valore calcolato: ${C.colour} vale ${W[2]}${N.color}`,
    `A computed Value layer: ${C.colour} is ${W[2]}${N.color}`
  ),
  'left',
  { pad: 4 }
)
await r.click(layer(C.band))
await fill(
  prow(T['prop.fill']).locator('input.color-text, input[type=text]').first(),
  f(C.colour)
)
await r.focus(
  stage(),
  t(
    'La fascia del titolo prende il colore del luogo',
    'The title band takes the color of the place'
  ),
  'left',
  { pad: 0, dim: false }
)

// 5. il personaggio
await r.title(t('5 · Il personaggio', '5 · The character'))
await r.clear()
await previewRow(0)
await formula(C.subject, X.subject)
await r.focus(
  [sourceLine(), stage()],
  t(
    `Soggetto: l’immagine della cartella ${N.people} con il nome del personaggio`,
    `Subject: the image in the ${N.people} folder named after the character`
  ),
  'left',
  { pad: 4 }
)
await formula(C.personIcon, X.personIcon)
await r.focus(
  [sourceLine(), stage()],
  t('Icona: la stessa regola dei luoghi', 'Icon: the same rule as the places'),
  'left',
  { pad: 4 }
)
await formula(C.title, X.title)
await r.focus(
  [sourceLine(), stage()],
  t(
    'Titolo: una composizione dei due campi. Il livello lo scrive in maiuscolo',
    'Title: a composition of the two fields. The layer writes it in capitals'
  ),
  'left',
  { pad: 4 }
)

// 6. l'incrocio
await r.title(t('6 · L’incrocio', '6 · The pair'))
await r.clear()
await valueLayer(C.encounter)
await setSource('formula')
await fill(field(T['source.formula']), X.encounter, { tab: false })
await win.keyboard.press('Tab')
await r.wait(800)
await r.focus(
  sourceLine(),
  t(
    `Un Valore intermedio: ${C.encounter} vale ${P[1]}_${W[0]}, il nome del testo da usare`,
    `An intermediate Value: ${C.encounter} is ${P[1]}_${W[0]}, the name of the text to use`
  ),
  'left',
  { pad: 4 }
)
await formula(C.text, X.text)
await r.focus(
  [sourceLine(), stage()],
  t(
    `${X.text}: le graffe esterne richiamano la variabile con quel nome`,
    `${X.text}: the outer braces call the variable with that name`
  ),
  'left',
  { pad: 4 }
)
await previewRow(2)
await r.focus(
  stage(),
  t(
    `La spia a palazzo non ha ancora il suo testo: manca la variabile ${X.live}`,
    `The spy at the palace has no text yet: the ${X.live} variable is missing`
  ),
  'left',
  { pad: 0, dim: false }
)
await r.openSection('variables')
await r.click(titled('sidebar.newVariable'))
await r.clear(700)
await fill(field(T['variable.name'], dialog()), X.live)
await r.click(
  dialog()
    .getByRole('button', { name: T['variable.type.text'], exact: true })
    .first(),
  { after: 400 }
)
await fill(field(T['variable.text'], dialog()), text(lang, LIVE.p, LIVE.w))
await closeWith('variable.save')
await r.focus(stage(), t('Ecco il testo', 'Here is the text'), 'left', { pad: 0, dim: false })
await formula(C.points, X.points)
await r.focus(
  sourceLine(),
  t(
    `Punti: 2 al ${P[0]}, 3 al ${P[1]}, 1 alla ${P[2]}, e 2 in più a ${W[2]}`,
    `Points: 2 for the ${P[0]}, 3 for the ${P[1]}, 1 for the ${P[2]}, and 2 more at the ${W[2]}`
  ),
  'left',
  { pad: 4 }
)
await r.focus(
  stage(),
  t('1 + 2 = 3 punti', '1 + 2 = 3 points'),
  'left',
  { pad: 0, dim: false }
)
await save()

// 7. Genera
await r.title(t('7 · Genera tutte le combinazioni', '7 · Generate every combination'))
await r.clear()
await openSet(N.set)
await view('set.table')
await r.focus(
  win.locator('.data-table').first(),
  t(
    'Le vecchie colonne non servono più: le carte leggono solo personaggio e luogo',
    'The old columns are no longer needed: the cards only read character and place'
  ),
  'below',
  { pad: 4 }
)
await view('set.grid')
await tools('set.generate')
await choose(genSet(0).locator('.generate-row select').first(), C.person)
await fill(values(0), P.join(', '), { tab: false })
await r.click(genCheck(0, 'generate.icons'), { after: 400 })
await r.click(gen().getByRole('button', { name: T['generate.addSet'] }).first(), { after: 600 })
await choose(genSet(1).locator('.generate-row select').first(), C.place)
await fill(values(1), W.join(', '), { tab: false })
const icons1 = genCheck(1, 'generate.icons')
if (await icons1.isChecked()) await r.click(icons1, { after: 400 })
await r.focus(
  [genSet(0), genSet(1)],
  t(
    'Tre personaggi e tre luoghi. Come icona resta spento: sono nomi, non icone',
    'Three characters and three places. As icon stays off: they are names, not icons'
  ),
  'left',
  { pad: 4 }
)
await r.focus(
  preview(),
  t('3 × 3 = 9 carte, una per incrocio', '3 × 3 = 9 cards, one for each pair'),
  'above',
  { pad: 4 }
)
await r.click(mode('generate.replace'), { after: 600 })
await r.focus(
  mode('generate.replace'),
  t(
    'Sostituisci le carte: le tre scritte a mano lasciano il posto alle nove',
    'Replace the cards: the three written by hand make way for the nine'
  ),
  'above',
  { pad: 4 }
)
await r.click(primary(), { after: 800 })
await r.focus(
  dialog(),
  t('Stella chiede conferma: si può annullare con Ctrl+Z', 'Stella asks first: Ctrl+Z undoes it'),
  'below',
  { pad: 4 }
)
await r.click(dialog().getByRole('button', { name: T['generate.replaceConfirm.ok'], exact: true }))
await r.clear(1500)
await r.focus(
  grid(),
  t(
    'Nove carte complete: sfondo, icone, soggetto, colore, testo e punti',
    'Nine complete cards: background, icons, subject, color, text and points'
  ),
  'right',
  { pad: 4 }
)
await pick(5)
await r.focus(
  form,
  t('Ogni carta ha solo due campi', 'Each card has only two fields'),
  'left',
  { pad: 4 }
)

// 8. cambiare una regola
await r.title(t('8 · Cambiare una regola', '8 · Changing a rule'))
await r.clear()
await openVariable(W[0] + N.color)
await fill(field(T['variable.color'], dialog()), '#2F6B4F')
await closeWith('variable.save')
await r.focus(
  grid(),
  t(
    `Un colore nuovo per ${W[0]}${N.color}: fascia e cerchio cambiano su tutte le carte del ${W[0]}`,
    `A new color for ${W[0]}${N.color}: band and circle change on every ${W[0]} card`
  ),
  'right',
  { pad: 4 }
)
await openSet(N.boardSet)
await pick(0)
await r.focus(
  grid(),
  t(
    'E anche sulla plancia, che usa le stesse variabili',
    'And on the board too, which uses the same variables'
  ),
  'right',
  { pad: 4 }
)
await openSet(N.set)
await openVariable(`${P[0]}_${W[0]}`)
await fill(field(T['variable.text'], dialog()), t('Compra 3 merci a metà prezzo.', 'Buy 3 goods at half price.'))
await closeWith('variable.save')
await pick(0)
await r.zoom(previewCard(), { max: 1.5, fill: 0.85 })
await r.focus(
  previewCard(),
  t(
    'Una regola si corregge in un punto solo',
    'A rule is fixed in one place only'
  ),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
await save()
await r.title(
  t(
    'Si scrivono due campi, il resto lo calcolano formule e variabili',
    'You write two fields, formulas and variables compute the rest'
  )
)
await r.clear(800)
console.log('VIDEO ' + (await r.finish()))
