// Video 21, secondo approfondimento: icone e variabili nel testo, circa 13 minuti senza voce, sul progetto
// «Contratti» di progetto-variabili.mjs, che chi guarda scarica dal sito. Capitoli: tre modi di mettere
// un'icona nel testo, la variabile icona opzione per opzione, gli altri tipi di variabile, icone ripetute,
// icone nei dati, icone dalle formule, riepilogo.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node --experimental-strip-types --no-warnings scripts/video/variabili.mjs it|en
// FAST=1 accorcia attese e scrittura; SHOT=<file.png> salva la schermata se un elemento non si trova;
// SNAP=<cartella> salva una schermata dopo ogni testo.
import { launch, mockOpen } from './lib.mjs'
import { docs } from '../guide/lib.mjs'
import { make, names } from './progetto-variabili.mjs'
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

const S = it
  ? {
      earn: '\nGuadagna 2{moneta}.',
      late: '\nSe arrivi tardi perdi {moneta tint=red size=150%}.',
      green: '[Guadagna 2{moneta}]{color=#2F6B4F weight=800}',
      earnPlain: 'Guadagna 2{moneta}',
      earnVar: 'guadagna',
      earnText: '[Guadagna]{weight=800 color=#2F6B4F}',
      earnUse: '\n{guadagna} 3{moneta}.',
      earnNew: 'incassa',
      purple: 'porpora',
      silkOnly: '\n[Solo seta di prima scelta]{color=porpora weight=700}',
      hand: 'max_mano',
      handUse: ' Mano massima: {max_mano} carte.',
      repeat: '\n{moneta*3}',
      vehicle: '=IF({tipo}="mare"; "{nave}"; "{carro}")'
    }
  : {
      earn: '\nGain 2{coin}.',
      late: '\nIf you arrive late you lose {coin tint=red size=150%}.',
      green: '[Gain 2{coin}]{color=#2F6B4F weight=800}',
      earnPlain: 'Gain 2{coin}',
      earnVar: 'gain',
      earnText: '[Gain]{weight=800 color=#2F6B4F}',
      earnUse: '\n{gain} 3{coin}.',
      earnNew: 'collect',
      purple: 'purple_dye',
      silkOnly: '\n[Finest silk only]{color=purple_dye weight=700}',
      hand: 'max_hand',
      handUse: ' Hand limit: {max_hand} cards.',
      repeat: '\n{coin*3}',
      vehicle: '=IF({type}="sea"; "{ship}"; "{cart}")'
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
const layerRow = (n) =>
  win
    .locator('.layers .layer-row')
    .filter({ has: win.locator('.layer-name', { hasText: new RegExp(`^${n}$`) }) })
    .first()
const titled = (key) => win.locator(`[title="${T[key]}"], [data-tip="${T[key]}"]`).first()
const side = (name) => win.locator('.sidebar').getByText(name, { exact: true }).first()
const varItem = (name) =>
  win.locator('#sidebar-variables li button').filter({ hasText: `{${name}}` }).first()
const saveButton = () =>
  win
    .locator('header.toolbar button')
    .filter({ hasText: new RegExp(`^(${T['app.save']}|${T['app.saved']})$`) })
    .first()
const cell = (i) => win.locator('.card-grid .card-cell').nth(i)
const form = win.locator('.card-form')
const cardField = (col) =>
  form
    .locator('label')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${col}$`) }) })
    .locator('input, textarea')
    .first()
const textField = () => cardField(C.text)
const previewCard = () => win.locator('aside.preview .preview-card').first()
const stage = () => win.locator('.canvas-stage').first()
const sample = () => dialog().locator('.format-preview').first()
const typeButton = (key) =>
  dialog()
    .getByRole('button', { name: T['variable.type.' + key], exact: true })
    .first()

async function fill(loc, text, { tab = true } = {}) {
  await loc.scrollIntoViewIfNeeded()
  await r.click(loc, { after: 250, before: 200, ms: 450 })
  await win.keyboard.press('Control+A')
  await r.type(text)
  if (tab) await win.keyboard.press('Tab')
  await r.wait(250)
}
/** un colore che può mancare: prima la casella che lo attiva, poi il codice */
async function color(label, scope, value) {
  const box = prow(label, scope).locator('input[type=checkbox]')
  if ((await box.count()) && !(await box.isChecked())) await r.click(box, { after: 300, ms: 450 })
  await fill(
    prow(label, scope).locator('input.color-text, input:not([type=checkbox])').first(),
    value
  )
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
/** scrive in fondo al testo di una carta (il campo si conferma uscendo) */
async function append(loc, text) {
  await r.click(loc, { after: 250 })
  await win.keyboard.press('Control+End')
  await r.type(text)
  await r.wait(300)
}
/** sostituisce una parte del testo di un campo */
async function replace(loc, from, to) {
  await loc.evaluate(
    (el, w) => {
      el.focus()
      const a = el.value.indexOf(w)
      el.setSelectionRange(a, a + w.length)
    },
    from
  )
  await r.wait(300)
  await r.type(to)
  await r.wait(300)
}
async function newVariable(name, type) {
  await r.openSection('variables')
  await r.click(titled('sidebar.newVariable'))
  await r.clear(700)
  await fill(field(T['variable.name'], dialog()), name)
  if (type !== 'image') await r.click(typeButton(type), { after: 400 })
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
/** la carta n del set Contratti, nella griglia, con il suo modulo */
async function pick(n) {
  await r.click(cell(n), { after: 600 })
}

// apertura
await mockOpen(r.app, dest)
await r.overlay()
await r.title(t('Icone e variabili nel testo', 'Icons and variables in the text'))
await r.title(
  t(
    'Il progetto «Contratti» si scarica dal link nella descrizione: aprilo e segui passo passo',
    'The “Contracts” project is in the description: open it and follow along'
  )
)
await r.clear()
await r.click(win.getByText(T['start.openProject']).first())
await r.clear(2200)
await r.overlay()
await r.focus(
  win.locator('.card-grid').first(),
  t(
    'Contratti di consegna: ogni carta chiede delle merci e dà un premio',
    'Delivery contracts: each card asks for goods and gives a reward'
  ),
  'left',
  { pad: 4 }
)

// 1. tre modi
await r.title(t('1 · Tre modi di mettere un’icona nel testo', '1 · Three ways to put an icon in text'))
await r.clear()
await pick(0)
await append(textField(), S.earn)
await r.click(previewCard(), { after: 800 })
await r.zoom(previewCard(), { max: 1.6, fill: 0.85 })
await r.focus(
  previewCard(),
  t(
    '{moneta} senza variabile: l’immagine moneta di assets/, alta quanto la riga',
    '{coin} with no variable: the coin image in assets/, as tall as the line'
  ),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
await newVariable(I.coin, 'image')
await fill(field(T['variable.src'], dialog()), I.coin)
await color(T['variable.tint'], dialog(), '#B8892B')
await r.focus(
  sample(),
  t(
    'Una variabile icona: un nome, un’immagine e come mostrarla. Qui dorata',
    'An icon variable: a name, an image and how to show it. Here in gold'
  ),
  'below',
  { pad: 4 }
)
await closeWith('variable.save')
await r.zoom(previewCard(), { max: 1.6, fill: 0.85 })
await r.focus(
  previewCard(),
  t(
    'Ora {moneta} è la variabile: cambiandola cambia ovunque',
    'Now {coin} is the variable: change it and it changes everywhere'
  ),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
await append(textField(), S.late)
await r.click(previewCard(), { after: 800 })
await r.zoom(previewCard(), { max: 1.6, fill: 0.85 })
await r.focus(
  previewCard(),
  t(
    'Gli attributi dopo il nome valgono solo lì: tint=red size=150%',
    'Attributes after the name apply only there: tint=red size=150%'
  ),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
await r.focus(
  textField(),
  t(
    'Per scrivere una graffa vera, una barra prima: \\{moneta} resta testo',
    'To write a real brace, put a backslash first: \\{coin} stays text'
  ),
  'left',
  { pad: 4 }
)

// 2. la variabile icona
await r.title(t('2 · La variabile icona, opzione per opzione', '2 · The icon variable, option by option'))
await r.clear()
await openVariable(I.coin)
const opt = async (label, value, text) => {
  await fill(field(label, dialog()), value)
  await r.focus([prow(label, dialog()), sample()], text, 'left', { pad: 4 })
}
await r.focus(
  sample(),
  t(
    'La frase di prova mostra ogni modifica prima di salvare',
    'The sample sentence shows every change before you save'
  ),
  'below',
  { pad: 4 }
)
await opt(T['variable.scale'], '130', t('Dimensione: più grande della riga', 'Size: larger than the line'))
await opt(
  T['variable.raise'],
  '12',
  t(
    'Sposta in alto: per un’icona che sembra troppo bassa rispetto al testo',
    'Raise: for an icon that sits too low next to the text'
  )
)
await opt(T['variable.rotate'], '20', t('Rotazione, in gradi', 'Rotation, in degrees'))
await r.click(dialog().getByRole('button', { name: T['variable.flip.h'], exact: true }), {
  after: 600
})
await r.focus(sample(), t('Ribaltamento orizzontale', 'Horizontal flip'), 'below', { pad: 4 })
await opt(T['variable.opacity'], '50', t('Opacità', 'Opacity'))
// si torna a una moneta normale
await fill(field(T['variable.rotate'], dialog()), '0')
await r.click(dialog().getByRole('button', { name: T['variable.flip.none'], exact: true }), {
  after: 300
})
await fill(field(T['variable.opacity'], dialog()), '100')
await fill(field(T['variable.raise'], dialog()), '0')
const textColor = dialog().locator('label.variable-text-color input').first()
await r.click(textColor, { after: 600 })
await r.focus(
  [dialog().locator('label.variable-text-color').first(), sample()],
  t(
    'Colore del testo in cui è inserita: la moneta prende il colore delle parole intorno',
    'Color of the text it is in: the coin takes the color of the words around it'
  ),
  'left',
  { pad: 4 }
)
await closeWith('variable.save')
await replace(textField(), S.earnPlain, S.green)
await r.click(previewCard(), { after: 800 })
await r.zoom(previewCard(), { max: 1.6, fill: 0.85 })
await r.focus(
  previewCard(),
  t(
    'In una frase verde la moneta è verde, nel resto del testo è scura',
    'In a green sentence the coin is green, in the rest of the text it is dark'
  ),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
await openVariable(I.coin)
await r.click(textColor, { after: 400 })
await color(T['variable.tint'], dialog(), '#FFFFFF')
await fill(field(T['variable.bg'], dialog()), 'circle')
await color(T['variable.bgColor'], dialog(), '#B8892B')
await fill(field(T['variable.bgPad'], dialog()), '22')
await r.focus(
  [prow(T['variable.bg'], dialog()), sample()],
  t(
    'Sfondo: una forma (cerchio, quadrato, esagono…), un’immagine o un’altra variabile',
    'Background: a shape (circle, square, hexagon…), an image or another variable'
  ),
  'left',
  { pad: 4 }
)
await r.focus(
  sample(),
  t(
    'La moneta bianca nel cerchio dorato. Lo sfondo vale ovunque: testi, livelli immagine, documenti',
    'The white coin in a gold circle. The background works everywhere: texts, image layers, documents'
  ),
  'below',
  { pad: 4 }
)
await closeWith('variable.save')
await r.zoom(previewCard(), { max: 1.6, fill: 0.85 })
await r.focus(
  previewCard(),
  t(
    'Tutte le monete della carta sono cambiate insieme',
    'All the coins on the card changed together'
  ),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
await save()

// 3. gli altri tipi
await r.title(t('3 · Gli altri tipi di variabile', '3 · The other kinds of variable'))
await r.clear()
await newVariable(S.earnVar, 'text')
await fill(field(T['variable.text'], dialog()), S.earnText)
await r.focus(
  [prow(T['variable.text'], dialog()), sample()],
  t(
    'Testo: una parola o una frase con la sua formattazione, anche con altre variabili',
    'Text: a word or a sentence with its formatting, other variables included'
  ),
  'left',
  { pad: 4 }
)
await closeWith('variable.save')
await pick(2)
await append(textField(), S.earnUse)
await r.click(previewCard(), { after: 800 })
await r.zoom(previewCard(), { max: 1.6, fill: 0.85 })
await r.focus(
  previewCard(),
  t('{guadagna} scrive la parola già formattata', '{gain} writes the word already formatted'),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
await newVariable(S.purple, 'color')
await fill(field(T['variable.color'], dialog()), '#7A3FA0')
await closeWith('variable.save')
await pick(1)
await append(textField(), S.silkOnly)
await r.click(previewCard(), { after: 800 })
await r.zoom(previewCard(), { max: 1.6, fill: 0.85 })
await r.focus(
  previewCard(),
  t(
    'Colore: un nome per un colore, da usare in color=, bg-color=, border= e nei livelli',
    'Color: a name for a color, to use in color=, bg-color=, border= and in layers'
  ),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
await newVariable('red', 'color')
await fill(field(T['variable.color'], dialog()), '#A33A2A')
await r.focus(
  prow(T['variable.name'], dialog()),
  t(
    'Una variabile colore con il nome di un colore standard lo ridefinisce in tutto il progetto',
    'A color variable named like a standard color redefines it in the whole project'
  ),
  'left',
  { pad: 4 }
)
await closeWith('variable.save')
await pick(0)
await r.zoom(previewCard(), { max: 1.6, fill: 0.85 })
await r.focus(
  previewCard(),
  t(
    'tint=red ora è il rosso mattone del progetto',
    'tint=red is now the project’s brick red'
  ),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
await newVariable(S.hand, 'value')
await fill(field(T['variable.value'], dialog()), '5')
await r.focus(
  [prow(T['variable.value'], dialog())],
  t(
    'Valore: un numero o un testo fisso, nei testi e nelle formule, per esempio IF({premio} > {max_mano}…)',
    'Value: a fixed number or text, in texts and formulas, for example IF({reward} > {max_hand}…)'
  ),
  'left',
  { pad: 4 }
)
await closeWith('variable.save')
await pick(3)
await append(textField(), S.handUse)
await r.click(previewCard(), { after: 800 })
await r.focus(
  previewCard(),
  t('Le regole citano il valore: si cambia in un punto solo', 'The rules quote the value: change it in one place'),
  'left',
  { pad: 0, dim: false }
)
// rinominare
await openVariable(S.earnVar)
await fill(field(T['variable.name'], dialog()), S.earnNew)
await r.focus(
  prow(T['variable.name'], dialog()),
  t('Rinominare una variabile…', 'Renaming a variable…'),
  'left',
  { pad: 4 }
)
await closeWith('variable.save')
await pick(2)
await r.focus(
  textField(),
  t(
    '…aggiorna i richiami nelle carte, nei template e nelle altre variabili',
    '…updates the references in cards, templates and other variables'
  ),
  'left',
  { pad: 4 }
)
await newVariable(C.reward, 'value')
await r.focus(
  dialog(),
  t(
    'Un nome già usato da una colonna: nelle carte vincerebbe il campo, e Stella lo dice',
    'A name already used by a column: on the cards the field would win, and Stella says so'
  ),
  'left',
  { pad: 4 }
)
await closeWith('format.cancel')
await save()

// 4. icone ripetute
await r.title(t('4 · Icone ripetute', '4 · Repeated icons'))
await r.clear()
await pick(4)
await append(textField(), S.repeat)
await r.click(previewCard(), { after: 800 })
await r.zoom(previewCard(), { max: 1.6, fill: 0.85 })
await r.focus(
  previewCard(),
  t('{moneta*3}: la stessa icona tre volte', '{coin*3}: the same icon three times'),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
await r.click(win.getByRole('button', { name: T['preview.editTemplate'] }).first())
await r.clear(1200)
await r.overlay()
await previewRow(3)
await r.click(layer(C.rewardLabel))
await r.click(field(T['prop.text']), { after: 250 })
await win.keyboard.press('Control+End')
await r.type(` {${I.coin}*${C.reward}}`)
await win.keyboard.press('Tab')
await r.wait(800)
await r.focus(
  stage(),
  t(
    '{moneta*premio}: tante monete quanto vale il premio della carta',
    '{coin*reward}: as many coins as the card’s reward'
  ),
  'left',
  { pad: 0, dim: false }
)
// si toglie la ripetizione dal testo e si mostra il gruppo, per confrontare
await fill(field(T['prop.text']), t('Premio:', 'Reward:'))
const eye = layerRow(C.coins).locator(`button[title="${T['layers.show']}"]`).first()
await r.focus(
  layerRow(C.coins),
  t(
    'L’altro modo: il gruppo «monete» ripete un’immagine {premio} volte',
    'The other way: the “coins” group repeats an image {reward} times'
  ),
  'right',
  { pad: 2 }
)
await r.click(eye, { after: 1000 })
await r.focus(
  stage(),
  t(
    'Nel testo le icone scorrono con le parole; il gruppo le tiene in un punto fisso della carta',
    'In text the icons flow with the words; the group keeps them in a fixed spot on the card'
  ),
  'left',
  { pad: 0, dim: false }
)
await save()

// 5. icone nei dati
await r.title(t('5 · Icone nei dati', '5 · Icons in the data'))
await r.clear()
await openSet(N.contracts)
await view('set.table')
await r.focus(
  win.locator('.data-table').first(),
  t(
    'Il costo è scritto nel foglio con le icone: 2{seta} 1{spezie}. Anche nel file Excel o LibreOffice',
    'The cost is written in the sheet with icons: 2{silk} 1{spices}. In the Excel or LibreOffice file too'
  ),
  'below',
  { pad: 4 }
)
await view('set.grid')
await pick(3)
await r.zoom(previewCard(), { max: 1.6, fill: 0.85 })
await r.focus(
  previewCard(),
  t(
    'Il tipo, terra o mare, è il nome di una variabile: il livello immagine la mostra con il suo sfondo',
    'The type, land or sea, is the name of a variable: the image layer shows it with its background'
  ),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
await openSet(N.orders)
await pick(0)
await previewCard().scrollIntoViewIfNeeded()
await r.focus(
  [win.locator('.card-grid').first(), previewCard()],
  t('Le stesse icone su un segnalino…', 'The same icons on a token…'),
  'right',
  { pad: 4 }
)
await openSet(N.die)
await pick(0)
await previewCard().scrollIntoViewIfNeeded()
await r.focus(
  [win.locator('.card-grid').first(), previewCard()],
  t('…e sulle facce di un dado', '…and on the faces of a die'),
  'right',
  { pad: 4 }
)

// 6. icone dalle formule
await r.title(t('6 · Icone dalle formule', '6 · Icons from formulas'))
await r.clear()
await r.click(side(N.tContract))
await r.clear(1200)
await r.overlay()
await previewRow(0)
await r.click(layer(C.vehicle))
await setSource('formula')
await fill(field(T['source.formula']), S.vehicle, { tab: false })
await win.keyboard.press('Tab')
await r.wait(800)
await r.focus(
  [props.locator('.source-line').first(), stage()],
  t(
    'Una formula sceglie l’icona: la nave per i contratti di mare…',
    'A formula picks the icon: the ship for sea contracts…'
  ),
  'left',
  { pad: 4 }
)
await previewRow(2)
await r.focus(stage(), t('…il carro per quelli di terra', '…the cart for land ones'), 'left', {
  pad: 0,
  dim: false
})
await r.click(layer(C.medal))
await r.focus(
  props.locator('.source-line').first(),
  t(
    'PICK sceglie la medaglia dal livello: 1 bronzo, 2 argento, 3 oro, tre variabili con tinte diverse',
    'PICK chooses the medal from the level: 1 bronze, 2 silver, 3 gold, three variables with different tints'
  ),
  'left',
  { pad: 4 }
)
await r.click(layer(C.points))
await r.focus(
  props.locator('.source-line').first(),
  t(
    'COUNTIN conta la seta nel costo: ogni contratto con la seta vale 3 punti in più',
    'COUNTIN counts the silk in the cost: each contract with silk is worth 3 more points'
  ),
  'left',
  { pad: 4 }
)
await r.click(layer(C.color))
await r.focus(
  props.locator('.source-line').first(),
  t(
    'Anche un colore si calcola: blu per il mare, ocra per la terra, due variabili colore',
    'A color can be computed too: blue for the sea, ochre for land, two color variables'
  ),
  'left',
  { pad: 4 }
)
await r.click(layer(C.band))
await fill(prow(T['prop.fill']).locator('input.color-text, input[type=text]').first(), `{${C.color}}`)
await r.focus(
  stage(),
  t('La fascia del nome prende il colore calcolato', 'The name band takes the computed color'),
  'left',
  { pad: 0, dim: false }
)
await save()
await openSet(N.contracts)
await r.focus(
  win.locator('.card-grid').first(),
  t(
    'Si scrivono solo tipo, livello e costo: icone, medaglie, punti e colori seguono da soli',
    'You only write type, level and cost: icons, medals, points and colors follow by themselves'
  ),
  'right',
  { pad: 4 }
)

// 7. riepilogo
await r.title(t('7 · Riepilogo', '7 · Summary'))
await r.clear()
await win.keyboard.press('F1')
await r.clear(1000)
await r.click(dialog().getByRole('button', { name: T['help.tab.variables'], exact: true }), {
  after: 800
})
await r.focus(
  dialog(),
  t(
    'F1, Campi e variabili: tutto quello che hai visto, su una pagina',
    'F1, Fields and variables: everything you saw, on one page'
  ),
  'right',
  { pad: 0 }
)
await win.keyboard.press('Escape')
await r.wait(500)
await r.title(
  t(
    'Nel prossimo approfondimento: due campi valore e tutta la carta calcolata',
    'In the next deep dive: two value fields and the whole card computed'
  )
)
await r.clear(800)
console.log('VIDEO ' + (await r.finish()))
