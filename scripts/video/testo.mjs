// Video 20, primo approfondimento: il testo (formattazione, adattamento e stili), circa 15 minuti senza
// voce, sul progetto «Mercanti» di progetto-testo.mjs, che chi guarda scarica dal sito. Capitoli: il
// livello di testo, quando il testo non sta, Formatta, il markup che Formatta scrive, Markdown, parole
// da tenere insieme, attributi scritti a mano, stili, il markup nel foglio con aiuti ed errori.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node --experimental-strip-types --no-warnings scripts/video/testo.mjs it|en
// FAST=1 accorcia attese e scrittura; SHOT=<file.png> salva la schermata se un elemento non si trova.
import { launch, mockOpen } from './lib.mjs'
import { docs } from '../guide/lib.mjs'
import { make, names, KEY } from './progetto-testo.mjs'
const lang = process.argv[2] || 'it'
const it = lang === 'it'
const t = (a, b) => (it ? a : b)
const N = names(lang)
const C = N.C
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
  // una schermata per ogni testo, per controllare il video senza guardarlo tutto
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
      label: 'Azione',
      // la Carovana: la carta su cui lavora quasi tutto il video
      once: 'una volta',
      two: '2',
      caravan: 'carovana',
      coins: '4 monete',
      market: 'mercato',
      // la Clessidra, scritta da zero
      md: [
        '## Effetto',
        'Scegli **una** fase del turno e giocala *di nuovo*:',
        '1. Raccolta',
        '2. ==Commercio==',
        '3. Viaggio',
        'Non vale per la ~~stessa~~ fase ++due volte++.\\',
        'Si usa dal 2^o^ turno.',
        '---',
        '> La sabbia scorre per tutti, tranne che per te.'
      ],
      quick: '[Rapida]{border=#9A4A2C radius=round pad=0.3/1.2 color=#9A4A2C size=80%} ',
      bigCaravan: '[carovana]{size=+1 weight=800 color=#9A4A2C}',
      centerLine: '## Effetto',
      bad: '[stessa]{.keywrd}',
      badFixed: '[stessa]{.keyword}',
      scales: 'Bilancia'
    }
  : {
      label: 'Action',
      once: 'once per turn',
      two: '2',
      caravan: 'caravan',
      coins: '4 coins',
      market: 'market',
      md: [
        '## Effect',
        'Choose **one** phase of the turn and play it *again*:',
        '1. Harvest',
        '2. ==Trade==',
        '3. Travel',
        'It does not work for the ~~same~~ phase ++twice++.\\',
        'Usable from the 2^nd^ turn.',
        '---',
        '> The sand runs for everyone, except for you.'
      ],
      quick: '[Quick]{border=#9A4A2C radius=round pad=0.3/1.2 color=#9A4A2C size=80%} ',
      bigCaravan: '[caravan]{size=+1 weight=800 color=#9A4A2C}',
      centerLine: '## Effect',
      bad: '[same]{.keywrd}',
      badFixed: '[same]{.keyword}',
      scales: 'Scales'
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
const side = (name) => win.locator('.sidebar').getByText(name, { exact: true }).first()
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
const fmtButton = () => win.getByRole('button', { name: T['format.button'] }).first()
const td = (row, col) => win.locator(`.data-table td[data-cell="${row}:${col}"]`).first()

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
async function place(x, y, w, h) {
  // prima le misure: cambiarle tiene fermo il punto di ancoraggio (il centro) e sposterebbe X e Y
  await fill(field(T['prop.w']), String(w))
  await fill(field(T['prop.h']), String(h))
  await fill(field('X'), String(x))
  await fill(field('Y'), String(y))
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
/** apre le Avanzate della sezione che contiene il campo */
async function advanced(label) {
  const d = props
    .locator('details.advanced')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${label}$`) }) })
    .first()
  if (!(await d.evaluate((e) => e.open))) await r.click(d.locator('summary'), { after: 500 })
  return d
}
/** seleziona una parte del testo di un campo (l'n-esima occorrenza) */
async function select(loc, text, nth = 0) {
  await loc.evaluate(
    (el, [w, n]) => {
      el.focus()
      let a = -1
      for (let i = 0; i <= n; i++) a = el.value.indexOf(w, a + 1)
      el.setSelectionRange(a, a + w.length)
      el.dispatchEvent(new Event('select', { bubbles: true }))
    },
    [text, nth]
  )
  await r.wait(400)
}
/** il cursore subito dopo un testo del campo */
async function caretAfter(loc, text) {
  await loc.evaluate((el, w) => {
    el.focus()
    const a = el.value.indexOf(w) + w.length
    el.setSelectionRange(a, a)
  }, text)
  await r.wait(250)
}
async function caretAt(loc, text) {
  await loc.evaluate((el, w) => {
    el.focus()
    const a = el.value.indexOf(w)
    el.setSelectionRange(a, a)
  }, text)
  await r.wait(250)
}
async function formatDialog() {
  await r.click(fmtButton())
  await r.clear(700)
  await r.overlay()
}
async function closeDialogWith(key) {
  await r.click(dialog().getByRole('button', { name: T[key], exact: true }))
  await r.clear(700)
}

// apertura
await mockOpen(r.app, dest)
await r.overlay()
await r.title(t('Il testo: formattazione, adattamento e stili', 'Text: formatting, fit and styles'))
await r.title(
  t(
    'Il progetto «Mercanti» si scarica dal link nella descrizione: aprilo e segui passo passo',
    'The “Merchants” project is in the description: open it and follow along'
  )
)
await r.clear()
await r.click(win.getByText(T['start.openProject']).first())
await r.clear(2200)
await r.overlay()
await r.focus(
  win.locator('.sidebar').first(),
  t(
    'Un mazzo di carte azione, una tessera porto e la plancia con le rotte',
    'A deck of action cards, a port tile and the board with the routes'
  ),
  'right',
  { pad: 0 }
)

// 1. il livello di testo
await r.title(t('1 · Il livello di testo', '1 · The text layer'))
await r.clear()
await r.click(side(N.tAction))
await r.clear(1200)
await r.overlay()
const dataSel = win.locator('.preview-data select').first()
await r.focus(
  dataSel,
  t(
    'Dati: il template mostra le carte del set, con i loro testi veri',
    'Data: the template shows the cards of the set, with their real text'
  ),
  'left',
  { pad: 4 }
)
await choose(dataSel, '0')
await r.click(layer(C.name))
await r.focus(
  props.locator('.source-line').first(),
  t(
    'Il nome viene dalla colonna «nome» del foglio: cambia da carta a carta',
    'The name comes from the “name” column of the sheet: it changes from card to card'
  ),
  'left',
  { pad: 4 }
)
await r.click(tool('tool.text'))
await r.clear(500)
await fill(field(T['prop.name']), C.label)
await setSource('fixed')
await r.focus(
  props.locator('.source-line').first(),
  t(
    'L’etichetta è Fissa: uguale su tutte le carte. Con Colonna diventerebbe un campo del set',
    'The label is Fixed: the same on every card. With Column it would become a field of the set'
  ),
  'left',
  { pad: 4 }
)
await fill(field(T['prop.text']), S.label)
await place(6, 41, 51, 5)
await fill(field(T['prop.size']), '7')
await choose(field(T['prop.weight']), '700')
await fill(field(T['prop.color']), '#9A4A2C')
await choose(field(T['prop.align']), 'center')
await r.focus(
  props,
  t(
    'Font, peso, dimensione, colore, allineamento: le voci più usate sono sempre in vista',
    'Font, weight, size, color, alignment: the most used options are always in view'
  ),
  'left',
  { pad: 0, dim: false }
)
// le Avanzate: spaziatura delle lettere e maiuscole
await advanced(T['prop.letterSpacing'])
await r.zoom(props, { max: 1.6, fill: 0.9 })
await r.focus(
  props.locator('details.advanced[open]').first(),
  t(
    'Nelle Avanzate: spaziature, rientro, margini interni, maiuscole, sottolineato, a capo, contorno',
    'In Advanced: spacing, indent, padding, case, underline, wrapping, stroke'
  ),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
await fill(field(T['prop.letterSpacing']), '300')
await choose(field(T['prop.transform']), 'upper')
await r.zoom(stage(), { max: 1.8, fill: 0.8 })
await r.focus(
  stage(),
  t('AZIONE, in maiuscolo e spaziato', 'ACTION, in capitals and spaced out'),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
// trascinare l'etichetta di un campo numerico
const sizeLabel = prow(T['prop.size']).locator('.field-label').first()
await sizeLabel.scrollIntoViewIfNeeded()
{
  const b = await sizeLabel.boundingBox()
  await r.glide(b.x + b.width / 2, b.y + b.height / 2, 600)
  await win.mouse.down()
  for (let i = 1; i <= 12; i++) {
    await r.glide(b.x + b.width / 2 + i * 6, b.y + b.height / 2, 60)
  }
  await r.focus(
    prow(T['prop.size']),
    t(
      'Trascinando l’etichetta di un numero il valore cambia come con un cursore',
      'Dragging the label of a number changes the value like a slider'
    ),
    'left',
    { pad: 4, ms: process.env.FAST ? 200 : 3600 }
  )
  for (let i = 11; i >= 0; i--) {
    await r.glide(b.x + b.width / 2 + i * 6, b.y + b.height / 2, 60)
  }
  await win.mouse.up()
  await r.clear(300)
}
await fill(field(T['prop.size']), '7')
// il contorno delle lettere sul nome
await r.click(layer(C.name))
const strokeRow = prow(T['prop.stroke'])
await advanced(T['prop.stroke'])
const strokeBox = strokeRow.locator('input[type=checkbox]').first()
if (await strokeBox.count()) await r.click(strokeBox, { after: 400 })
await r.zoom([stage()], { max: 1.8, fill: 0.8 })
await r.focus(
  stage(),
  t(
    'Contorno delle lettere: il nome si stacca dall’illustrazione',
    'Letter stroke: the name stands out from the illustration'
  ),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
await save()

// 2. quando il testo non sta
await r.title(t('2 · Quando il testo non sta', '2 · When the text does not fit'))
await r.clear()
const rowSel = win.locator('.preview-data select').nth(1)
await choose(rowSel, '7')
await r.click(layer(C.text))
await r.focus(
  stage(),
  t(
    'Il Contrabbando ha troppo testo: esce dal riquadro e copre il bordo',
    'Smuggling has too much text: it spills out of the box over the border'
  ),
  'left',
  { pad: 0, dim: false }
)
const fit = field(T['prop.fit'])
await r.focus(
  prow(T['prop.fit']),
  t('Adattamento decide cosa fare', 'Fit decides what to do'),
  'left',
  { pad: 4 }
)
await choose(fit, 'truncate')
await r.focus(
  stage(),
  t(
    `${T['textFit.truncate']}: il resto non si vede`,
    `${T['textFit.truncate']}: the rest is hidden`
  ),
  'left',
  { pad: 0, dim: false }
)
await choose(fit, 'shrink')
await r.focus(
  stage(),
  t(
    `${T['textFit.shrink']}: la dimensione scende finché il testo sta`,
    `${T['textFit.shrink']}: the size goes down until the text fits`
  ),
  'left',
  { pad: 0, dim: false }
)
await fill(field(T['prop.minSize']), '7')
await r.focus(
  prow(T['prop.minSize']),
  t(
    'Ma non sotto la dimensione minima: sotto i 7 pt il testo non si legge più',
    'But not below the minimum size: under 7 pt the text is no longer readable'
  ),
  'left',
  { pad: 4 }
)
await r.zoom(stage(), { max: 1.7, fill: 0.85 })
await r.focus(
  stage(),
  t(
    'A 7 pt il Contrabbando non sta ancora: va accorciato',
    'At 7 pt Smuggling still does not fit: it needs to be shorter'
  ),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
await save()
// Controlla testi nel set
await openSet(N.actions)
await view('set.grid')
const tools = win.getByRole('button', { name: new RegExp(`^${T['set.tools']}`) }).first()
await r.click(tools)
await r.click(win.getByText(T['set.textCheck'], { exact: true }).first(), { after: 2000 })
await r.overlay()
await r.focus(
  dialog(),
  t(
    'Controlla testi trova le carte in cui nemmeno la dimensione minima basta',
    'Check text finds the cards where even the minimum size is not enough'
  ),
  'left',
  { pad: 0, dim: false }
)
await r.click(dialog().locator('.dialog-buttons button.primary').first())
await r.clear(500)

// 3. Formatta
await r.title(t('3 · Formattare una parte del testo', '3 · Formatting part of the text'))
await r.clear()
await r.click(cell(0))
await r.clear(500)
const text = textField()
await r.focus(
  text,
  t(
    'Il testo della Carovana. Si seleziona una parte da formattare',
    'The Caravan’s text. Select the part to format'
  ),
  'left'
)
await select(text, S.once)
await r.focus(fmtButton(), t('Poi Aa Formatta…', 'Then Aa Format…'), 'left', { pad: 4 })
await formatDialog()
await r.focus(
  dialog(),
  t(
    'Carattere, riquadro, sfondo: tutto con il mouse, senza scrivere niente',
    'Characters, box, background: all with the mouse, without typing code'
  ),
  'left',
  { pad: 0, dim: false }
)
await color(T['format.color'], dialog(), '#A33A2A')
await choose(field(T['format.weight'], dialog()), '800')
await color(T['format.border'], dialog(), '#A33A2A')
await fill(field(T['format.radius'], dialog()), 'round')
await fill(field(T['format.pad'], dialog()), '0.3/1')
await r.focus(
  dialog().locator('.format-preview').first(),
  t('In alto l’anteprima', 'At the top, the preview'),
  'below',
  { pad: 4 }
)
await closeDialogWith('format.apply')
await r.zoom(previewCard(), { max: 1.6, fill: 0.85 })
await r.focus(
  previewCard(),
  t('«una volta» in rosso, in un riquadro arrotondato', '“once per turn” in red, in a rounded box'),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
// togliere la formattazione
await caretAfter(text, '[' + S.once.slice(0, 3))
await formatDialog()
await r.focus(
  dialog().getByRole('button', { name: T['format.clear'], exact: true }),
  t(
    'Troppo? Con il cursore dentro la parte formattata, Togli la formattazione',
    'Too much? With the cursor in the formatted part, Remove formatting'
  ),
  'above',
  { pad: 4 }
)
await closeDialogWith('format.clear')
// il numero nel cerchio
await select(text, S.two)
await formatDialog()
await r.click(dialog().locator(`[title="${T['format.bgPick']}"]`).first(), { after: 900 })
await r.focus(
  win.locator('[role="dialog"]').last(),
  t(
    'Lo sfondo: una forma, un’immagine del progetto o una variabile',
    'The background: a shape, a project image or a variable'
  ),
  'left',
  { pad: 0, dim: false }
)
await r.click(win.locator('[role="dialog"]').last().getByText('circle', { exact: true }).first(), {
  after: 800
})
await color(T['format.bgColor'], dialog(), '#9A4A2C')
await color(T['format.color'], dialog(), '#FFFFFF')
await choose(field(T['format.weight'], dialog()), '800')
await r.focus(
  dialog().locator('.format-raw').first(),
  t(
    `${T['format.raw']}: ogni scelta diventa testo`,
    `${T['format.raw']}: every choice becomes text`
  ),
  'above',
  { pad: 4 }
)
await closeDialogWith('format.apply')
await r.zoom(previewCard(), { max: 1.6, fill: 0.85 })
await r.focus(
  previewCard(),
  t('Il 2 in un cerchio, come su un dado', 'The 2 in a circle, like on a die'),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()

// 4. il markup
await r.title(t('4 · Quello che Formatta scrive: il markup', '4 · What Format writes: markup'))
await r.clear()
await r.zoom(text, { max: 1.8, fill: 0.7 })
await r.focus(
  text,
  t(
    'Formatta ha scritto [2]{…}: tra quadre il testo, tra graffe come formattarlo',
    'Format wrote [2]{…}: the text in brackets, how to format it in braces'
  ),
  'left',
  { pad: 4 }
)
await r.focus(
  text,
  t(
    'Chi lo trova comodo può scriverlo o correggerlo qui, senza aprire Formatta',
    'If you find it handy, write or fix it here, without opening Format'
  ),
  'left',
  { pad: 4 }
)
await r.unzoom()
await save()

// 5. Markdown
await r.title(t('5 · Markdown', '5 · Markdown'))
await r.clear()
await r.click(cell(6))
await r.clear(500)
await r.focus(text, t('La Clessidra non ha ancora testo', 'The Hourglass has no text yet'), 'left')
await r.click(text, { after: 250 })
const typeLine = async (s, last = false) => {
  await r.type(s)
  await win.keyboard.press('Escape').catch(() => {})
  if (!last) await win.keyboard.press('Enter')
  await r.wait(300)
}
await typeLine(S.md[0])
await typeLine(S.md[1])
await r.zoom([text, previewCard()], { max: 1.3, fill: 0.9 })
await r.focus(
  previewCard(),
  t(
    '## è un titolo, **due asterischi** il grassetto, *uno* il corsivo',
    '## is a heading, **two asterisks** bold, *one* italic'
  ),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
await typeLine(S.md[2])
await typeLine(S.md[3])
await typeLine(S.md[4])
await r.zoom([text, previewCard()], { max: 1.3, fill: 0.9 })
await r.focus(
  previewCard(),
  t(
    '1. 2. 3. fanno un elenco numerato, - un elenco puntato; ==testo== evidenzia',
    '1. 2. 3. make a numbered list, - a bulleted one; ==text== highlights'
  ),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
await typeLine(S.md[5])
await typeLine(S.md[6])
await r.zoom([text, previewCard()], { max: 1.3, fill: 0.9 })
await r.focus(
  previewCard(),
  t(
    '~~barrato~~, ++sottolineato++, ^apice^. Ogni a capo è un paragrafo; \\ a fine riga va a capo nello stesso',
    '~~strikethrough~~, ++underline++, ^superscript^. Each line is a paragraph; \\ at the end breaks the line inside it'
  ),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
await typeLine(S.md[7])
await typeLine(S.md[8], true)
await r.zoom([text, previewCard()], { max: 1.3, fill: 0.9 })
await r.focus(
  previewCard(),
  t(
    '--- traccia una linea, > fa una nota: lo stile note, che si può cambiare',
    '--- draws a line, > makes a note: the note style, which you can change'
  ),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
await save()

// 6. tenere insieme le parole
await r.title(t('6 · Tenere insieme le parole', '6 · Keeping words together'))
await r.clear()
await r.click(cell(0))
await r.clear(500)
await r.zoom(previewCard(), { max: 1.6, fill: 0.85 })
await r.focus(
  previewCard(),
  t(
    `«${S.coins}» va a capo a metà: il numero resta solo`,
    `“${S.coins}” breaks in the middle: the number is left alone`
  ),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
await caretAt(text, S.coins)
await r.type('_')
await caretAfter(text, S.coins)
await r.type('_')
await win.keyboard.press('Escape').catch(() => {})
await r.wait(500)
await r.zoom([text, previewCard()], { max: 1.3, fill: 0.9 })
await r.focus(
  previewCard(),
  t(
    `_${S.coins}_ non va mai a capo. È uguale a [${S.coins}]{nowrap}`,
    `_${S.coins}_ never breaks. Same as [${S.coins}]{nowrap}`
  ),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
await r.title(
  t(
    'Un trattino basso dentro una parola, come nome_file, resta com’è. Per uno isolato: \\_',
    'An underscore inside a word, like file_name, stays as it is. For a lone one: \\_'
  )
)
await r.clear()

// 7. gli attributi scritti a mano
await r.title(t('7 · Gli attributi scritti a mano', '7 · Writing attributes by hand'))
await r.clear()
await caretAfter(text, 'circle')
await r.click(text, { after: 200 })
await caretAfter(text, 'circle')
await r.type(' bg-size=140%')
await win.keyboard.press('Escape').catch(() => {})
await r.wait(500)
await r.zoom([text, previewCard()], { max: 1.3, fill: 0.9 })
await r.focus(
  previewCard(),
  t('bg-size: un cerchio più grande del numero', 'bg-size: a circle bigger than the number'),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
await select(text, S.caravan)
await r.type(S.bigCaravan)
await win.keyboard.press('Escape').catch(() => {})
await r.wait(500)
await r.zoom([text, previewCard()], { max: 1.3, fill: 0.9 })
await r.focus(
  previewCard(),
  t(
    'size=+1 un punto in più, weight=800 più spesso, color= il colore. Anche size=80% o size=12',
    'size=+1 one point bigger, weight=800 bolder, color= the color. Also size=80% or size=12'
  ),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
// l'etichetta Rapida all'inizio
await text.evaluate((el) => {
  el.focus()
  el.setSelectionRange(0, 0)
})
await r.type(S.quick)
await win.keyboard.press('Escape').catch(() => {})
await r.wait(500)
await r.zoom([text, previewCard()], { max: 1.3, fill: 0.9 })
await r.focus(
  previewCard(),
  t(
    'border, radius=round, pad: un’etichetta a pillola',
    'border, radius=round, pad: a pill-shaped label'
  ),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
await caretAfter(text, 'size=80%')
await r.type(' text-raise=0.4')
await win.keyboard.press('Escape').catch(() => {})
await r.wait(500)
await r.zoom([text, previewCard()], { max: 1.3, fill: 0.9 })
await r.focus(
  previewCard(),
  t(
    'text-raise alza il testo dentro il riquadro; raise sposterebbe tutto il riquadro',
    'text-raise lifts the text inside the box; raise would move the whole box'
  ),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
// un paragrafo centrato nella Clessidra
await r.click(cell(6))
await r.clear(500)
await caretAt(text, S.centerLine)
await r.type('{center}')
await win.keyboard.press('Escape').catch(() => {})
await r.wait(500)
await r.zoom([text, previewCard()], { max: 1.3, fill: 0.9 })
await r.focus(
  previewCard(),
  t(
    '{center} a inizio riga centra solo quel paragrafo, qui il titolo. Anche left, right, justify',
    '{center} at the start of a line centers only that paragraph, here the heading. Also left, right, justify'
  ),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
await save()

// 8. gli stili
await r.title(t('8 · Gli stili', '8 · Styles'))
await r.clear()
await r.click(cell(1))
await r.clear(500)
await r.zoom([text, previewCard()], { max: 1.3, fill: 0.9 })
await r.focus(
  text,
  t(
    'Le parole chiave sono formattate a mano su ogni carta: colore, peso, maiuscoletto',
    'The keywords are formatted by hand on every card: color, weight, small caps'
  ),
  'left',
  { pad: 4 }
)
await r.unzoom()
await caretAfter(text, '[' + (it ? 'po' : 'po'))
await formatDialog()
await r.click(dialog().getByRole('button', { name: T['format.saveStyle'], exact: true }))
await r.type('keyword')
await r.focus(
  dialog().locator('.format-save').first(),
  t(
    'Salva come stile: la formattazione diventa uno stile con un nome',
    'Save as style: the formatting becomes a style with a name'
  ),
  'above',
  { pad: 4 }
)
await r.click(dialog().locator('.format-save button.primary').first(), { after: 900 })
await r.clear(500)
await r.overlay()
if (await dialog().count()) {
  const apply = dialog().getByRole('button', { name: T['format.apply'], exact: true })
  if (await apply.count()) await r.click(apply)
}
await r.zoom(text, { max: 1.8, fill: 0.7 })
await r.focus(text, t('Qui ora c’è {.keyword}', 'Here it now says {.keyword}'), 'left', { pad: 4 })
await r.unzoom()
// cerca e sostituisci in tutto il progetto
await r.click(
  win
    .locator('header.toolbar button')
    .filter({ hasText: new RegExp(`^${T['app.projectMenu']}`) })
    .first()
)
await r.click(win.getByText(T['findAll.menu'], { exact: true }).first(), { after: 900 })
await r.overlay()
const findInputs = dialog().locator('.find-row input:not([type=checkbox])')
await r.click(findInputs.nth(0), { after: 200 })
await r.type(KEY.slice(1, -1))
await r.click(findInputs.nth(1), { after: 200 })
await r.type('.keyword')
await r.wait(600)
await r.focus(
  dialog().locator('.find-results').first(),
  t(
    'Le altre carte, la tessera e la plancia: tutte insieme con Cerca e sostituisci (⇧⌘F / Ctrl+Shift+F)',
    'The other cards, the tile and the board: all at once with Find and replace (⇧⌘F / Ctrl+Shift+F)'
  ),
  'left',
  { pad: 4, dim: false }
)
await r.click(dialog().locator('.dialog-buttons button.primary').first(), { after: 1200 })
await r.focus(
  dialog().locator('.banner').first(),
  t('Prima di sostituire, un backup', 'Before replacing, a backup'),
  'below',
  { pad: 4 }
)
await r.click(
  dialog().locator('.dialog-close, [aria-label]').first().or(dialog().getByRole('button').last())
)
await r.clear(500)
await win.keyboard.press('Escape').catch(() => {})
// lo stile si cambia una volta sola
const styleItem = side('.keyword')
await r.click(styleItem, { after: 900 })
await r.overlay()
await r.focus(
  prow(T['format.basedOn'], dialog()),
  t(
    'Uno stile può basarsi su un altro e ereditarne gli attributi',
    'A style can be based on another and inherit its attributes'
  ),
  'left',
  { pad: 4 }
)
await color(T['format.color'], dialog(), '#7A3FA0')
await closeDialogWith('format.saveStyleConfirm')
await r.focus(
  win.locator('.card-grid').first(),
  t(
    'Un colore nuovo per la parola chiave: cambia su tutte le carte',
    'A new color for the keyword: it changes on every card'
  ),
  'right',
  { pad: 0, dim: false }
)
// note, heading1 e heading2: gli stili predefiniti
await r.click(cell(6))
await r.clear(500)
await r.click(side('.note'), { after: 900 })
await r.overlay()
await r.focus(
  dialog(),
  t(
    'note è lo stile di >; heading1 e heading2 quelli di # e ##. Si possono ridefinire',
    'note is the style of >; heading1 and heading2 those of # and ##. You can redefine them'
  ),
  'left',
  { pad: 0, dim: false }
)
await color(T['format.color'], dialog(), '#6B6255')
await choose(field(T['format.align'], dialog()), 'center')
await closeDialogWith('format.saveStyleConfirm')
await r.zoom(previewCard(), { max: 1.6, fill: 0.85 })
await r.focus(
  previewCard(),
  t('La nota ora è grigia e centrata', 'The note is now gray and centered'),
  'left',
  { pad: 0, dim: false }
)
await r.unzoom()
await r.title(
  t(
    'Uno stile si usa su una porzione, [testo]{.keyword}, o su tutto un paragrafo, con {.flavor} a inizio riga',
    'A style works on a part, [text]{.keyword}, or on a whole paragraph, with {.flavor} at the start of the line'
  )
)
await r.clear()
await save()
// gli stessi stili sulla plancia e sulla tessera
await openSet(N.board)
await r.focus(
  win.locator('.card-grid .card-cell').first(),
  t(
    'Anche sulla plancia le parole chiave usano lo stile',
    'On the board too the keywords use the style'
  ),
  'left',
  { pad: 0, dim: false }
)
await openSet(N.ports)
await r.focus(
  previewCard(),
  t(
    'Il markup vale per carte, plance, segnalini, tessere e dadi: qui i punti nel cerchio',
    'Markup works on cards, boards, tokens, tiles and dice: here the points in a circle'
  ),
  'left',
  { pad: 0, dim: false }
)

// 9. il foglio, gli aiuti e gli errori
await r.title(
  t('9 · Il markup nel foglio, aiuti ed errori', '9 · Markup in the sheet, help and errors')
)
await r.clear()
await openSet(N.actions)
await view('set.table')
{
  const c = td(5, C.text)
  await c.scrollIntoViewIfNeeded()
  const b = await c.boundingBox()
  await r.glide(b.x + b.width / 2, b.y + b.height / 2, 600)
  await r.wait(300)
  await win.mouse.dblclick(r.cx, r.cy)
  await r.wait(500)
  await win.keyboard.press('Control+End')
  await r.type(' ' + S.bad.slice(0, -5))
  await r.wait(600)
  await r.focus(
    win.locator('.markup-help').first(),
    t(
      'Dopo { compaiono stili, attributi, campi e variabili',
      'After { you get styles, attributes, fields and variables'
    ),
    'below',
    { pad: 4, dim: false }
  )
  await r.clear(150)
  const ed = win.locator('.data-table textarea').first()
  if (await ed.count()) {
    await ed.focus()
    await win.keyboard.press('Control+End')
  } else {
    await win.mouse.dblclick(r.cx, r.cy)
    await r.wait(400)
    await win.keyboard.press('Control+End')
  }
  await r.type(S.bad.slice(-5))
  await r.wait(300)
  await win.keyboard.press('Enter')
  await r.wait(700)
  await win.keyboard.press('ArrowUp')
  await r.wait(600)
}
await r.focus(
  win.locator('aside.preview .problems').first(),
  t(
    'Uno stile che non esiste: sotto la carta il problema, con la spiegazione',
    'A style that does not exist: the problem is shown under the card, with an explanation'
  ),
  'left',
  { pad: 4 }
)
{
  const c = td(5, C.text)
  const b = await c.boundingBox()
  await r.glide(b.x + b.width / 2, b.y + b.height / 2, 600)
  await win.mouse.dblclick(r.cx, r.cy)
  await r.wait(400)
  await win.keyboard.press('Control+End')
  await win.keyboard.press('ArrowLeft')
  await win.keyboard.press('Backspace')
  await win.keyboard.press('Backspace')
  await r.type('ord')
  await r.wait(400)
  // un clic fuori conferma la cella e chiude i suggerimenti
  await r.click(previewCard(), { after: 600 })
  await r.wait(800)
}
await r.title(
  t(
    'Lo stesso markup si scrive nelle celle del file Excel, LibreOffice o Google Sheets',
    'The same markup works in the cells of the Excel, LibreOffice or Google Sheets file'
  )
)
await r.clear()
await save()
await win.keyboard.press('F1')
await r.wait(1200)
await r.overlay()
const helpTab = dialog().getByRole('button', { name: T['help.tab.text'], exact: true })
if (await helpTab.count()) await r.click(helpTab, { after: 800 })
await r.focus(
  dialog(),
  t('F1, scheda Testo: tutto il markup in una pagina', 'F1, Text tab: all the markup on one page'),
  'left',
  { pad: 0, dim: false }
)
await win.keyboard.press('Escape')
await r.wait(500)
await r.title(
  t(
    'Nel prossimo approfondimento: icone e variabili nel testo',
    'In the next deep dive: icons and variables in the text'
  )
)
await r.clear(800)
console.log('VIDEO ' + (await r.finish()))
