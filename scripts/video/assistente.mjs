// Video 13: l'assistente formule (circa 10 minuti, senza voce), sul progetto di esempio con in più un tracciato
// del punteggio: una griglia 4 × 10 senza contenuto, come nel video sulle griglie.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node --experimental-strip-types --no-warnings scripts/video/assistente.mjs it|en
// FAST=1 accorcia attese e scrittura; SHOT=<png> salva una schermata se un elemento non si trova;
// SNAP=<cartella> salva una schermata a ogni riquadro, per controllare il percorso senza guardare il video.
import { launch } from './lib.mjs'
import { docs } from '../guide/lib.mjs'
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
const lang = process.argv[2] || 'it'
const it = lang === 'it'
const REPO = new URL('../..', import.meta.url).pathname.replace(/\/$/, '')

// il progetto di esempio com'è nell'app, con in più il tracciato: il tasto della schermata di ingresso lo apre com'è
const S = it
  ? {
      folder: 'Esempio',
      sets: ['Personaggi', 'Oggetti', 'Mercato'],
      template: 'personaggio',
      track: 'tracciato',
      cells: 'caselle',
      rank: 'rango',
      name: 'nome',
      strength: 'forza',
      monk: 'Monaco',
      low: 'Gregario',
      mid: 'Eroe',
      high: 'Leggenda',
      sep: ' · forza '
    }
  : {
      folder: 'Example',
      sets: ['Characters', 'Items', 'Market'],
      template: 'character',
      track: 'track',
      cells: 'cells',
      rank: 'rank',
      name: 'name',
      strength: 'strength',
      monk: 'Monk',
      low: 'Follower',
      mid: 'Hero',
      high: 'Legend',
      sep: ' · strength '
    }
const dest = `${docs(lang)}/Stella/${S.folder}`
rmSync(dest, { recursive: true, force: true })
mkdirSync(dest, { recursive: true })
cpSync(`${REPO}/resources/examples/${lang}`, dest, { recursive: true })
const track = {
  name: S.track,
  width: 120,
  height: 70,
  bleed: 3,
  safeMargin: 3,
  cornerRadius: 3,
  front: [
    {
      type: 'text',
      name: it ? 'titolo' : 'title',
      x: 6,
      y: 4,
      w: 108,
      h: 8,
      text: it ? 'Tracciato del punteggio' : 'Score track',
      weight: 800,
      size: 11,
      color: '#2A241C'
    },
    {
      type: 'grid',
      name: S.cells,
      x: 6,
      y: 14,
      w: 108,
      h: 52,
      cell: 'square',
      rows: 4,
      columns: 10,
      interlock: false,
      orientation: 'pointy',
      gap: 1,
      padding: 1.5,
      zoom: 1,
      fill: '#FFFFFF',
      stroke: { color: '#8C8270', width: 0.3 },
      background: '#D9D2C2',
      border: null,
      backgroundRadius: 2,
      radius: 1,
      cellRatio: 1,
      alignX: 'center',
      alignY: 'center',
      clip: false,
      content: ''
    },
    {
      type: 'shape',
      name: it ? 'sfondo' : 'background',
      shape: 'rect',
      x: -3,
      y: -3,
      w: 126,
      h: 76,
      fill: '#F6F2E8',
      stroke: null,
      locked: true
    }
  ],
  back: []
}
writeFileSync(`${dest}/templates/${S.track}.json`, JSON.stringify(track, null, 2) + '\n')

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
  mkdirSync(process.env.SNAP, { recursive: true })
  let n = 0
  const f = r.focus.bind(r)
  r.focus = async (locs, text, ...rest) => {
    const out = await f(locs, text, ...rest)
    await win.screenshot({ path: `${process.env.SNAP}/${String(++n).padStart(3, '0')}.png` })
    return out
  }
}
const click0 = r.click.bind(r)
r.click = async (loc, opts) => {
  await r.clear(150)
  return click0(loc, opts)
}

const dialog = () => win.locator('[role="dialog"]').last()
const fxd = () =>
  win
    .locator('[role="dialog"]')
    .filter({ has: win.locator('.formula-dialog') })
    .last()
const props = win.locator('aside.properties')
const row = (label, scope = props) =>
  scope
    .locator('.field')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${label}$`) }) })
    .first()
const field = (label, scope = props) =>
  row(label, scope)
    .locator('input:not([type=range]):not([type=checkbox]), textarea, select')
    .first()
const layer = (n) => win.locator('.layers .layer-name', { hasText: new RegExp(`^${n}$`) }).first()
const side = (name) => win.locator('.sidebar').getByText(name, { exact: true }).first()
const saveButton = () =>
  win
    .locator('header.toolbar button')
    .filter({ hasText: new RegExp(`^(${T['app.save']}|${T['app.saved']})$`) })
    .first()
const grid = () => win.locator('.card-grid').first()
const button = (key, scope = fxd()) => scope.getByRole('button', { name: T[key], exact: true })
// la frase principale e i suoi spazi; quelli di una frase annidata sono dentro .fx-sub
const sentence = () => fxd().locator('.fx-guided > .fx-sentence')
const leaf = (i) => sentence().locator(':scope > .fx-leaf').nth(i)
const subLeaf = (i) => fxd().locator('.fx-sub .fx-leaf').nth(i)
const picker = () => fxd().locator('.fx-picker').first()
const result = () => fxd().locator('.fx-result-box').first()
const card = (key) => fxd().locator('.fx-card').filter({ hasText: T[key] }).first()
const tab = (key) => picker().getByRole('tab', { name: T[key], exact: true })

/** apre un set dalla barra laterale, nella vista a griglia */
async function openSet(name) {
  await r.click(side(name))
  await r.clear(1000)
  await r.overlay()
  const g = win.getByRole('button', { name: T['set.grid'], exact: true }).first()
  if (await g.count()) await g.click()
  await r.wait(400)
}
async function openTemplate(name) {
  await r.click(side(name))
  await r.clear(1200)
  await r.overlay()
}
/** la riga del testo chiusa («Testo: … modifica») si apre per scriverci */
async function openText() {
  const edit = picker().locator('.fx-compose-closed button')
  if (await edit.count()) await r.click(edit.first(), { after: 400, ms: 450 })
}
/** un numero nello spazio scelto: la scheda Numero si apre da sola */
async function number(loc, v) {
  await r.click(loc, { after: 400 })
  await openText()
  // in un confronto lo spazio è un valore: si scrive nel campo del testo, e un numero resta un numero
  const area = picker().locator('.fx-compose textarea')
  if (await area.count()) {
    await area.focus()
    await win.keyboard.press('Control+A')
    await r.type(String(v))
    await r.wait(600)
    return
  }
  const input = picker().locator('.fx-tab-body input[inputmode=decimal]').first()
  if (!(await input.count())) await r.click(tab('fx.tab.number'), { after: 400 })
  await input.focus()
  await win.keyboard.press('Control+A')
  await r.type(String(v))
  await r.wait(300)
  await win.keyboard.press('Enter')
  await r.wait(600)
}
/** un testo nello spazio scelto: il campo del testo è sempre visibile */
async function words(loc, text) {
  await r.click(loc, { after: 400 })
  await openText()
  const area = picker().locator('.fx-compose textarea')
  await area.focus()
  await win.keyboard.press('Control+A')
  await r.type(text)
  await r.wait(600)
}
async function fxOpen() {
  await r.click(props.locator('.value-source button.fx-button').first())
  await r.clear(800)
}
async function color(label, scope, value) {
  const box = row(label, scope).locator('input[type=checkbox]')
  if ((await box.count()) && !(await box.isChecked())) await r.click(box, { after: 300, ms: 450 })
  const f = field(label, scope)
  await r.click(f, { after: 250, before: 200, ms: 450 })
  await win.keyboard.press('Control+A')
  await r.type(value)
  await win.keyboard.press('Tab')
  await r.wait(300)
}
async function choose(loc, value) {
  await loc.scrollIntoViewIfNeeded()
  await r.click(loc, { after: 200, before: 200, ms: 450 })
  await win.keyboard.press('Escape')
  await loc.selectOption(value)
  await r.wait(500)
}

// --- 1. apertura ---
await r.overlay()
await r.title(
  it
    ? 'L’assistente formule: una formula senza scriverla'
    : 'The formula assistant: a formula without writing it'
)
await r.title(
  it ? 'Per carte, plance, segnalini, tessere e dadi' : 'For cards, boards, tokens, tiles and dice'
)
await r.title(
  it
    ? 'Sul progetto di esempio: aprilo anche tu e segui passo passo'
    : 'On the example project: open it too and follow along'
)
await r.clear()
const example = win.locator('.welcome-choice').filter({ hasText: T['welcome.example'] }).first()
await r.focus(
  example,
  it ? 'Il progetto di esempio è a un clic' : 'The example project is one click away',
  'below'
)
await r.click(example)
await r.clear(2200)
await r.overlay()

// --- 2. dove si trova ---
await r.title(it ? 'Dove si trova' : 'Where to find it')
await r.clear()
await openTemplate(S.template)
await r.click(layer(S.rank))
await r.clear(500)
const source = props.locator('.value-source').first()
await source.scrollIntoViewIfNeeded()
await r.zoom(source, { max: 1.8 })
await r.focus(
  props.locator('.value-source button.fx-button').first(),
  it
    ? 'Il rango è una formula: il tasto fx accanto apre l’assistente'
    : 'The rank is a formula: the fx button next to it opens the assistant',
  'left',
  { pad: 4 }
)
await r.unzoom()
await r.click(layer(S.name))
await r.clear(500)
await r.zoom(props.locator('.value-source').first(), { max: 1.8 })
await r.focus(
  props.locator('.value-source button.fx-button').first(),
  it
    ? 'Ogni livello ha fx accanto a «Valore sulle carte»: apre l’assistente'
    : 'Every layer has fx next to “Value on cards”: it opens the assistant',
  'left',
  { pad: 4 }
)
await r.unzoom()

// --- 3. cosa vuoi fare? basso, medio, alto ---
await r.title(it ? 'Cosa vuoi fare?' : 'What do you want to do?')
await r.clear()
await r.click(layer(S.rank))
await r.clear(400)
await fxOpen()
await r.focus(
  sentence(),
  it
    ? 'La formula del rango letta come una frase: Se forza è almeno 4 mostra Eroe…'
    : 'The rank formula read as a sentence: If strength is at least 4 show Hero…',
  'below',
  { pad: 6 }
)
await r.click(button('fx.startOver'))
await r.wait(600)
await r.focus(
  fxd().locator('.fx-cards').first(),
  it
    ? '«Ricomincia» porta alle schede: si sceglie cosa fare, non quale funzione usare'
    : '“Start over” shows the cards: you choose what to do, not which function to use',
  'above',
  { pad: 4 }
)
await r.zoom(fxd().locator('.fx-cards .fx-card').nth(0), { max: 1.6, fill: 0.5 })
await r.wait(1600)
await r.unzoom()
await r.click(card('fx.card.ranges'))
await r.wait(500)
await r.zoom(sentence(), { max: 1.7 })
await r.focus(
  sentence(),
  it
    ? 'La frase è già riempita: ogni spazio è un pulsante che si può cambiare'
    : 'The sentence is already filled in: each blank is a button you can change',
  'below',
  { pad: 6 }
)
await r.unzoom()
await number(leaf(1), 5)
await words(leaf(2), S.high)
await number(leaf(3), 3)
await words(leaf(4), S.mid)
await words(leaf(5), S.low)
await r.zoom([sentence(), result()], { max: 1.6 })
await r.focus(
  result(),
  it
    ? 'Sotto, il risultato sulla prima carta del set: il Cavaliere, forza 4, è Eroe'
    : 'Below, the result on the first card of the set: the Knight, strength 4, is a Hero',
  'below',
  { pad: 4 }
)
await r.unzoom()
await r.focus(
  sentence().locator('.fx-add').first(),
  it ? '«+ Fascia» aggiunge un gradino' : '“+ Range” adds one more step',
  'below',
  { pad: 4 }
)
await r.click(button('fx.apply'))
await r.wait(600)
await r.zoom(field(T['source.formula']), { max: 1.8 })
await r.focus(
  field(T['source.formula']),
  it
    ? 'La formula scritta dall’assistente, al posto giusto'
    : 'The formula written by the assistant, in the right place',
  'left',
  { pad: 4 }
)
await r.unzoom()
await r.click(saveButton())
await openSet(S.sets[0])
await r.focus(grid(), it ? 'Tre ranghi su tutte le carte' : 'Three ranks on every card', 'above', {
  pad: 4
})

// --- 4. una frase dentro l'altra ---
await r.title(it ? 'Una frase dentro l’altra' : 'One sentence inside another')
await r.title(
  it
    ? 'Lo stesso rango, costruito liberamente, con un’eccezione per il Monaco'
    : 'The same rank, built freely, with an exception for the Monk'
)
await r.clear()
await openTemplate(S.template)
await r.click(layer(S.rank))
await r.clear(400)
await fxOpen()
await r.click(button('fx.startOver'))
await r.click(card('fx.card.if'))
await r.wait(500)
await r.zoom(sentence(), { max: 1.7 })
await r.focus(
  sentence(),
  it
    ? 'Se forza è maggiore di 3 mostra… altrimenti…'
    : 'If strength is greater than 3 show… otherwise…',
  'below',
  { pad: 6 }
)
await r.unzoom()
await r.click(leaf(2), { after: 500 })
await r.click(tab('fx.tab.formula'), { after: 500 })
await r.focus(
  picker().locator('.fx-cards').first(),
  it
    ? 'Nello spazio «mostra», la scheda Formula chiede: cosa vuoi metterci?'
    : 'In the “show” blank, the Formula tab asks: what do you want to put here?',
  'left',
  { pad: 4 }
)
await r.click(picker().locator('.fx-card').filter({ hasText: T['fx.card.if'] }).first())
await r.wait(600)
await r.zoom(sentence(), { max: 1.6 })
await r.focus(
  fxd().locator('.fx-sub').first(),
  it
    ? 'Una seconda condizione: la sua frase sta in un riquadro, dentro la prima'
    : 'A second condition: its sentence sits in a box, inside the first one',
  'below',
  { pad: 4 }
)
await r.unzoom()
await number(subLeaf(1), 5)
await words(subLeaf(2), S.high)
await words(subLeaf(3), S.mid)
await words(leaf(2), S.low)
await r.zoom([sentence(), result()], { max: 1.5 })
await r.focus(
  sentence(),
  it
    ? 'Sopra 5 Leggenda, sopra 3 Eroe, altrimenti Gregario'
    : 'Above 5 Legend, above 3 Hero, otherwise Follower',
  'below',
  { pad: 6 }
)
await r.unzoom()
const or = sentence().locator(':scope > .fx-add').filter({ hasText: T['fx.addOr'] })
await r.focus(
  sentence().locator(':scope > .fx-add'),
  it
    ? 'Un confronto in più: «+ e anche» vuole tutti e due, «+ oppure» ne basta uno'
    : 'One more comparison: “+ and also” needs both, “+ or” needs just one',
  'below',
  { pad: 4 }
)
await r.click(or)
await r.wait(500)
await r.click(tab('fx.tab.field'), { after: 400 })
await r.click(
  picker()
    .locator('.fx-list button')
    .filter({ hasText: new RegExp(`^${S.name}`) })
    .first()
)
await r.wait(500)
await openText()
const area = picker().locator('.fx-compose textarea')
await area.focus()
await win.keyboard.press('Control+A')
await r.type(S.monk)
await r.wait(600)
await r.zoom(sentence(), { max: 1.6 })
await r.focus(
  sentence(),
  it
    ? 'forza maggiore di 3 oppure nome uguale a Monaco: il Monaco diventa Eroe'
    : 'strength greater than 3 or name equal to Monk: the Monk becomes a Hero',
  'below',
  { pad: 6 }
)
await r.focus(
  sentence().locator(':scope > .fx-mini').first(),
  it ? 'La × toglie un confronto' : 'The × removes a comparison',
  'below',
  { pad: 4 }
)
await r.unzoom()

// il modo avanzato: le parti complete chiuse, una funzione aperta da sola
await r.click(button('fx.advanced'))
await r.wait(600)
await r.focus(
  fxd().locator('.fx-tree').first(),
  it
    ? 'Avanzato: la stessa formula a caselle, con il valore sotto ogni parte'
    : 'Advanced: the same formula as boxes, with the value under each part',
  'right',
  { pad: 4 }
)
await r.focus(
  fxd().locator('.fx-collapsed').first(),
  it
    ? 'Le parti già complete restano chiuse in una riga'
    : 'Finished parts stay closed in one line',
  'right',
  { pad: 4 }
)
// la condizione annidata nel «Se vero»: si apre e poi si guarda da sola
const nested = fxd()
  .locator('.fx-slot')
  .filter({ has: win.locator(':scope > .fx-slot-label', { hasText: T['fx.arg.ifTrue'] }) })
  .first()
await r.click(nested.locator('.fx-collapsed').first())
await r.wait(500)
await r.focus(
  nested.locator('.fx-drill').first(),
  it
    ? '⤢ apre questa funzione da sola, senza il resto intorno'
    : '⤢ opens this function on its own, without the rest around it',
  'right',
  { pad: 4 }
)
await r.click(nested.locator('.fx-drill').first())
await r.wait(600)
await r.zoom(fxd().locator('.fx-crumbs'), { max: 1.8, fill: 0.5 })
await r.focus(
  fxd().locator('.fx-crumbs'),
  it ? 'In alto, dove sei nella formula' : 'At the top, where you are in the formula',
  'above',
  { pad: 4 }
)
await r.unzoom()
await r.click(fxd().locator('.fx-crumbs button').first())
await r.wait(500)
await r.zoom(fxd().locator('.fx-foot .fx-text').first(), { max: 1.6 })
await r.focus(
  fxd().locator('.fx-foot .fx-text').first(),
  it
    ? 'E sotto, la formula scritta: la si può anche correggere a mano'
    : 'And below, the written formula: you can also edit it by hand',
  'above',
  { pad: 4 }
)
await r.unzoom()
await r.click(button('fx.apply'))
await r.wait(600)
await r.click(saveButton())
await openSet(S.sets[0])
await r.focus(
  grid().locator('.card-cell').nth(4),
  it ? 'Il Monaco, forza 1, ora è Eroe' : 'The Monk, strength 1, is now a Hero',
  'right',
  { pad: 4 }
)

// --- 5. il testo con dentro i campi ---
await r.title(it ? 'Un testo con dentro i campi' : 'A text with fields inside')
await r.clear()
await openTemplate(S.template)
await r.click(layer(S.name))
await r.clear(400)
await r.click(props.locator('.value-source button.fx-button').first())
await r.clear(800)
await r.click(card('fx.card.join'))
await r.wait(500)
await openText()
const text = picker().locator('.fx-compose textarea')
await r.zoom(picker().locator('.fx-compose'), { max: 1.6, fill: 0.6 })
await r.focus(
  text,
  it
    ? 'Nel campo del testo si scrive e si inseriscono i campi'
    : 'In the text field you type and insert the fields',
  'below',
  { pad: 4 }
)
await r.unzoom()
await text.focus()
await win.keyboard.press('Control+A')
await r.click(tab('fx.tab.field'), { after: 300 })
await r.click(
  picker()
    .locator('.fx-list button')
    .filter({ hasText: new RegExp(`^${S.name}`) })
    .first()
)
await r.click(text, { after: 200 })
await win.keyboard.press('Control+End')
await r.type(S.sep)
await r.click(
  picker()
    .locator('.fx-list button')
    .filter({ hasText: new RegExp(`^${S.strength}`) })
    .first()
)
await r.wait(400)
await r.zoom([picker().locator('.fx-compose'), result()], { max: 1.5 })
await r.focus(
  result(),
  it
    ? 'La scheda Campo inserisce {nome} e {forza} dove c’è il cursore'
    : 'The Field tab inserts {name} and {strength} at the cursor',
  'below',
  { pad: 4 }
)
await r.unzoom()
await r.click(picker().locator('.fx-compose button').filter({ hasText: T['fx.format'] }).first())
await r.wait(700)
await color(T['format.color'], dialog(), '#2F5DA8')
await choose(field(T['format.weight'], dialog()), '800')
await r.click(dialog().getByRole('button', { name: T['format.apply'], exact: true }))
await r.wait(600)
await r.zoom(picker().locator('.fx-compose'), { max: 1.6, fill: 0.6 })
await r.focus(
  picker().locator('.fx-compose p').first(),
  it
    ? '«Formatta…» vale per tutto il testo; «Togli» la toglie'
    : '“Format…” applies to the whole text; “Remove” takes it off',
  'below',
  { pad: 4 }
)
await r.unzoom()
await r.focus(
  button('dialog.cancel'),
  it ? 'Era una prova: si annulla' : 'It was just a try: cancel',
  'above',
  { pad: 4 }
)
await r.click(button('dialog.cancel'))
await r.wait(500)

// --- 5b. un'icona ripetuta ---
await r.title(it ? 'Un’icona ripetuta' : 'A repeated icon')
await r.clear()
await r.click(layer(S.name))
await r.clear(400)
await fxOpen()
await r.zoom(card('fx.card.repeatIcon'), { max: 1.6 })
await r.focus(
  card('fx.card.repeatIcon'),
  it
    ? 'Ripeti un’icona: tante icone quanto dice un campo'
    : 'Repeat an icon: as many icons as a field says',
  'below',
  { pad: 4 }
)
await r.unzoom()
await r.click(card('fx.card.repeatIcon'))
await r.wait(600)
// l'icona: una variabile immagine del progetto
await r.click(leaf(0), { after: 400 })
const swordVar = picker()
  .locator('.fx-list button')
  .filter({ hasText: new RegExp(`^${it ? 'spada' : 'sword'}`) })
  .first()
if (!(await swordVar.count())) await r.click(tab('fx.tab.variable'), { after: 300 })
// l'elenco è lungo: si cerca
const search = picker().locator('input[type=search], input[placeholder]').first()
if (await search.count()) {
  await r.click(search, { after: 200, ms: 450 })
  await r.type(it ? 'spada' : 'sword')
  await r.wait(400)
}
await swordVar.scrollIntoViewIfNeeded()
await r.click(swordVar)
await r.wait(400)
// quante volte: il campo forza
await r.click(leaf(1), { after: 400 })
const strengthField = picker()
  .locator('.fx-list button')
  .filter({ hasText: new RegExp(`^${S.strength}`) })
  .first()
if (!(await strengthField.count())) await r.click(tab('fx.tab.field'), { after: 300 })
await strengthField.scrollIntoViewIfNeeded()
await r.click(strengthField)
await r.wait(600)
await r.zoom([sentence(), result()], { max: 1.5 })
await r.focus(
  sentence(),
  it
    ? 'Mostra l’icona spada tante volte quanto la forza'
    : 'Show the sword icon as many times as the strength',
  'below',
  { pad: 4 }
)
await r.focus(
  result(),
  it
    ? 'Nel testo diventa {spada*4}: con forza 4, quattro spade sulla carta'
    : 'In the text it becomes {sword*4}: with strength 4, four swords on the card',
  'below',
  { pad: 4 }
)
await r.unzoom()
await r.click(button('dialog.cancel'))
await r.wait(500)

// --- 6. ogni N caselle, su una griglia ---
await r.title(it ? 'Ogni N caselle, su una griglia' : 'Every N cells, on a grid')
await r.clear()
await openTemplate(S.track)
await r.click(layer(S.cells))
await r.clear(500)
const create = props.locator('.fx-content-create').first()
await create.scrollIntoViewIfNeeded()
await r.zoom(create, { max: 1.7, fill: 0.6 })
await r.focus(
  create,
  it
    ? 'Per le caselle serve un contenuto: «Testo in ogni casella» lo crea e apre l’assistente'
    : 'Cells need content: “Text in each cell” creates it and opens the assistant',
  'left',
  { pad: 4 }
)
await r.unzoom()
await r.click(create.getByRole('button', { name: T['editor.gridContentText'], exact: true }))
await r.wait(900)
await r.click(card('fx.card.everyN'))
await r.wait(500)
await r.zoom(sentence(), { max: 1.7 })
await r.focus(
  sentence(),
  it ? 'Ogni 10 caselle, mostra… altrimenti…' : 'Every 10 cells, show… otherwise…',
  'below',
  { pad: 6 }
)
await r.unzoom()
async function cellNumber(loc, format) {
  await r.click(loc, { after: 400 })
  await openText()
  const a = picker().locator('.fx-compose textarea')
  await a.focus()
  await win.keyboard.press('Control+A')
  await win.keyboard.press('Backspace')
  await r.wait(300)
  await r.click(tab('fx.tab.system'), { after: 300 })
  await r.click(
    picker().locator('.fx-list button').filter({ hasText: T['fx.var.cell.index'] }).first()
  )
  if (!format) return
  await r.click(picker().locator('.fx-compose button').filter({ hasText: T['fx.format'] }).first())
  await r.wait(700)
  await color(T['format.color'], dialog(), '#A33A2A')
  await choose(field(T['format.weight'], dialog()), '800')
  await r.click(dialog().getByRole('button', { name: T['format.apply'], exact: true }))
  await r.wait(600)
}
await cellNumber(leaf(1), true)
await r.focus(
  picker(),
  it
    ? 'Il numero della casella, dalla scheda «Componente e casella», rosso e grassetto'
    : 'The cell number, from the “Card & cell” tab, red and bold',
  'left',
  { pad: 4 }
)
await cellNumber(leaf(2), false)
await r.zoom([sentence(), result()], { max: 1.5 })
await r.focus(
  fxd().locator('.fx-strip').first(),
  it
    ? 'La striscia mostra le prime caselle: la decima è rossa'
    : 'The strip shows the first cells: the tenth is red',
  'below',
  { pad: 4 }
)
await r.unzoom()
await number(leaf(0), 6)
await r.zoom([sentence(), result()], { max: 1.5 })
await r.focus(
  fxd().locator('.fx-strip').first(),
  it
    ? '10 diventa 6: rosse la sesta e la dodicesima'
    : '10 becomes 6: the sixth and twelfth are red',
  'below',
  { pad: 4 }
)
await r.unzoom()
await r.click(button('fx.apply'))
await r.wait(800)
const canvas = win.locator('.canvas-stage').first()
await r.focus(
  canvas,
  it ? 'Un numero rosso ogni sei caselle' : 'A red number every six cells',
  'below',
  { pad: 0 }
)
await r.click(saveButton())

// --- 7. il filtro del generatore ---
await r.title(it ? 'Il filtro del generatore' : 'The generator filter')
await r.clear()
await openSet(S.sets[0])
await r.click(win.locator('button').filter({ hasText: T['set.tools'] }).first())
await r.wait(400)
await r.click(win.getByRole('menuitem', { name: T['set.generate'] }).first())
await r.wait(800)
const gen = dialog()
const col = gen.locator('.generate-set input[list="generate-columns"]').first()
await r.click(col, { after: 200 })
await win.keyboard.press('Control+A')
await r.type(S.strength)
await r.click(gen.locator('.generate-values textarea').first(), { after: 200 })
await r.type('1, 2, 3, 4, 5, 6')
await r.wait(500)
const genFx = gen.locator('.generate-filter button.fx-button').first()
await r.focus(
  genFx,
  it
    ? 'Sei carte con forza da 1 a 6; fx accanto al Filtro apre l’assistente'
    : 'Six cards with strength 1 to 6; fx next to Filter opens the assistant',
  'above',
  { pad: 4 }
)
await r.click(genFx)
await r.wait(700)
await r.focus(
  fxd().locator('.fx-cards').first(),
  it
    ? 'Qui le schede sono condizioni: vero o falso'
    : 'Here the cards are conditions: true or false',
  'above',
  { pad: 4 }
)
await r.click(card('fx.card.compare'))
await r.wait(500)
await r.click(sentence().locator(':scope > .fx-add').filter({ hasText: T['fx.addAnd'] }))
await r.wait(400)
await r.click(tab('fx.tab.field'), { after: 300 })
await r.click(
  picker()
    .locator('.fx-list button')
    .filter({ hasText: new RegExp(`^${S.strength}`) })
    .first()
)
await r.wait(400)
await choose(sentence().locator('select.fx-op').nth(1), '<')
await number(leaf(3), 6)
await r.zoom([sentence(), result()], { max: 1.6 })
await r.focus(
  sentence(),
  it
    ? 'forza maggiore di 3 e anche minore di 6: sotto, Sì o No sulla prima carta generata'
    : 'strength greater than 3 and also less than 6: below, Yes or No on the first generated card',
  'below',
  { pad: 6 }
)
await r.unzoom()
await r.click(button('fx.apply'))
await r.wait(700)
await r.focus(
  gen.locator('.generate-filter').first(),
  it
    ? 'Il filtro è scritto: restano due carte, forza 4 e 5'
    : 'The filter is written: two cards remain, strength 4 and 5',
  'above',
  { pad: 4 }
)
await r.click(gen.getByRole('button', { name: T['dialog.cancel'], exact: true }).first())
await r.wait(500)

// --- 8. chiusura ---
await r.clear()
await r.title(
  it
    ? 'Scegli cosa vuoi fare, riempi gli spazi, guarda il risultato'
    : 'Choose what to do, fill in the blanks, check the result'
)
await r.title(
  it
    ? 'Tutto il resto è nella guida: stella.lucadj.eu'
    : 'Everything else is in the guide: stella.lucadj.eu',
  3800
)
await r.clear(600)
const p = await r.finish()
console.log('VIDEO', p)
