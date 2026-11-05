// Video 30, approfondimento: variabili di testo con parametri, circa 10 minuti senza voce, sul progetto
// «Gilda» di progetto-gilda.mjs, che chi guarda scarica dal sito. Capitoli: il problema (la stessa frase
// con numeri diversi), un parametro, più parametri e parametri di testo, un numero su un'icona (con il
// parametro preso da un campo, anche sul dado), variabili dentro variabili, nel regolamento, errori e
// consigli, riepilogo.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node --experimental-strip-types --no-warnings scripts/video/parametri.mjs it|en
// FAST=1 accorcia attese e scrittura; SHOT=<file.png> salva la schermata se un elemento non si trova;
// SNAP=<cartella> salva una schermata dopo ogni testo, e i testi in testi.tsv (per lo storyboard).
import { appendFileSync } from 'node:fs'
import { launch, mockOpen } from './lib.mjs'
import { docs } from '../guide/lib.mjs'
import { make, names } from './progetto-gilda.mjs'
const lang = process.argv[2] || 'it'
const it = lang === 'it'
const t = (a, b) => (it ? a : b)
const N = names(lang)
const { C, I, V } = N
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
      const id = String(++n).padStart(3, '0')
      await win.screenshot({ path: `${process.env.SNAP}/${id}.png` })
      const text = k === 'title' ? a[0] : a[1]
      appendFileSync(`${process.env.SNAP}/testi.tsv`, `${id}\t${k}\t${text.replace(/\s+/g, ' ')}\n`)
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

const K = `.${N.keyword}`
const S = it
  ? {
      draw2: `[Pesca 2]{${K}}: prendi 2 carte dal mazzo`,
      draw3: `[Pesca 3]{${K}}: prendi 3 carte dal mazzo`,
      drawVar: `[Pesca {1}]{${K}}: prendi {1} carte dal mazzo`,
      drawOld: 'prendi {1} carte dal mazzo',
      drawNew: 'aggiungi alla mano {1} carte',
      tradeOld: `Dai 3{${I.coin}}, ricevi 1{${I.wood}}`,
      tradeVar: `Dai {1}{${I.coin}}, ricevi {2}{${I.wood}}`,
      attack2: `[Attacca 2]{${K}}: 2{${I.sword}} a un nemico`,
      attack1: `[Attacca 1]{${K}}: 1{${I.sword}} a ogni nemico`,
      attackVar: `[Attacca {1}]{${K}}: {1}{${I.sword}} a {2}`,
      attackTry: '2:un nemico',
      attackUse2: `{${V.attack}:2:un nemico}`,
      attackUse1: `{${V.attack}:1:ogni nemico}`,
      goldVar: '[{1}]{bg=circle bg-color=#C9A227 bg-size=170% color=white weight=800}',
      restOld: `{${V.draw}:2}, poi scarta una carta`,
      restVar: `{${V.draw}:{1}}, poi scarta una carta`,
      glossary: [
        `- {${V.draw}:X}.`,
        `- {${V.attack}:X:un bersaglio}.`,
        `- {${V.trade}:X:Y}.`
      ]
    }
  : {
      draw2: `[Draw 2]{${K}}: take 2 cards from the deck`,
      draw3: `[Draw 3]{${K}}: take 3 cards from the deck`,
      drawVar: `[Draw {1}]{${K}}: take {1} cards from the deck`,
      drawOld: 'take {1} cards from the deck',
      drawNew: 'add {1} cards to your hand',
      tradeOld: `Give 3{${I.coin}}, get 1{${I.wood}}`,
      tradeVar: `Give {1}{${I.coin}}, get {2}{${I.wood}}`,
      attack2: `[Attack 2]{${K}}: 2{${I.sword}} to one enemy`,
      attack1: `[Attack 1]{${K}}: 1{${I.sword}} to every enemy`,
      attackVar: `[Attack {1}]{${K}}: {1}{${I.sword}} to {2}`,
      attackTry: '2:one enemy',
      attackUse2: `{${V.attack}:2:one enemy}`,
      attackUse1: `{${V.attack}:1:every enemy}`,
      goldVar: '[{1}]{bg=circle bg-color=#C9A227 bg-size=170% color=white weight=800}',
      restOld: `{${V.draw}:2}, then discard a card`,
      restVar: `{${V.draw}:{1}}, then discard a card`,
      glossary: [
        `- {${V.draw}:X}.`,
        `- {${V.attack}:X:a target}.`,
        `- {${V.trade}:X:Y}.`
      ]
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
const layer = (n) => win.locator('.layers .layer-name', { hasText: new RegExp(`^${n}$`) }).first()
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
const textField = () => cardField(C.text)
const previewCard = () => win.locator('aside.preview .preview-card').first()
const problems = () => win.locator('aside.preview .problems').first()
const stage = () => win.locator('.canvas-stage').first()
const sample = () => dialog().locator('.format-preview').first()
const typeButton = (key) =>
  dialog()
    .getByRole('button', { name: T['variable.type.' + key], exact: true })
    .first()
/** chiude i suggerimenti delle graffe, se aperti (Esc chiuderebbe anche la finestra) */
async function closeHelp() {
  if (await win.locator('.markup-help').isVisible().catch(() => false))
    await win.keyboard.press('Escape')
}
const docEditor = () => win.locator('.document-editor .markup-field textarea').first()
const docPreview = () => win.locator('.document-preview').first()

async function fill(loc, text, { tab = true } = {}) {
  await loc.scrollIntoViewIfNeeded()
  await r.click(loc, { after: 250, before: 200, ms: 450 })
  await win.keyboard.press('Control+A')
  await r.type(text)
  await closeHelp()
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
async function save() {
  await r.click(saveButton())
  await r.clear(800)
}
async function openSet(name) {
  await r.click(side(name))
  await r.clear(1000)
  await r.overlay()
}
/** sostituisce una parte del testo di un campo e lo conferma uscendo */
async function replace(loc, from, to, { tab = true } = {}) {
  await loc.scrollIntoViewIfNeeded()
  await r.click(loc, { after: 250 })
  const found = await loc.evaluate(
    (el, w) => {
      el.focus()
      const a = el.value.indexOf(w)
      if (a < 0) return false
      el.setSelectionRange(a, a + w.length)
      return true
    },
    from
  )
  if (!found) throw new Error(`testo non trovato: ${from}`)
  await r.wait(400)
  await r.type(to)
  await closeHelp()
  await r.wait(300)
  if (tab) await win.keyboard.press('Tab')
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
const varText = () => field(T['variable.text'], dialog())
const tryWith = () => field(T['variable.tryWith'], dialog())
/** la carta n del set, con il suo modulo */
async function pick(n) {
  await r.click(cell(n), { after: 600 })
}
async function zoomCard(text) {
  await r.click(previewCard(), { after: 800 })
  await r.zoom(previewCard(), { max: 1.6, fill: 0.85 })
  await r.focus(previewCard(), text, 'left', { pad: 0, dim: false })
  await r.unzoom()
}
/** nell'editor, i dati della carta n del primo set */
async function previewRow(n) {
  const sel = win.locator('.preview-data select')
  if ((await sel.first().inputValue()) !== '0') await choose(sel.first(), '0')
  await choose(sel.nth(1), String(n))
}

/** carte più grandi nella griglia, perché si leggano i testi */
async function bigThumbs(v = 3.4) {
  await win.locator('input.thumb-size').first().evaluate((el, v) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    set.call(el, String(v))
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, v)
  await r.wait(400)
}

// ---- apertura
await mockOpen(r.app, dest)
await r.overlay()
await r.title(t('Variabili con parametri', 'Variables with parameters'))
await r.title(
  t(
    'Il progetto «Gilda» si scarica dal link nella descrizione: aprilo e segui passo passo',
    'The “Guild” project is in the description: open it and follow along'
  )
)
await r.clear()
await r.click(win.getByText(T['start.openProject']).first())
await r.clear(2200)
await r.overlay()
await bigThumbs()
await r.focus(
  grid(),
  t(
    'Sei azioni di una gilda di avventurieri: costo, figura e un testo con parole chiave',
    'Six actions of a guild of adventurers: cost, figure and a text with keywords'
  ),
  'left',
  { pad: 4 }
)

// ---- 1. il problema
await r.title(t('1 · Il problema: la stessa frase, numeri diversi', '1 · The problem: same sentence, different numbers'))
await r.clear()
await pick(0)
await zoomCard(
  t(
    '«Pesca 2: prendi 2 carte dal mazzo», con la parola chiave in rosso',
    '“Draw 2: take 2 cards from the deck”, with the keyword in red'
  )
)
await r.focus(
  textField(),
  t(
    'Scritta a mano nel testo della carta, con lo stile parola_chiave',
    'Written by hand in the card text, with the keyword style'
  ),
  'left',
  { pad: 4 }
)
await r.focus(
  [cell(0), cell(2), cell(5)],
  t(
    'La stessa frase su tre carte: cambia solo il numero',
    'The same sentence on three cards: only the number changes'
  ),
  'right',
  { pad: 4 }
)
await r.focus(
  [cell(3), cell(4)],
  t('E lo stesso per «Attacca»', 'And the same for “Attack”'),
  'right',
  { pad: 4 }
)
await r.focus(
  grid(),
  t(
    'Per cambiare la frase o lo stile bisognerebbe correggere ogni carta, una per una',
    'To change the wording or the style you would have to fix every card, one by one'
  ),
  'left',
  { pad: 4 }
)
await r.openSection('variables')
await r.focus(
  win.locator('#sidebar-variables').first(),
  t(
    'Una variabile di testo normale non basta: scriverebbe sempre lo stesso numero',
    'A plain text variable is not enough: it would always write the same number'
  ),
  'right',
  { pad: 4 }
)

// ---- 2. un parametro
await r.title(t('2 · Una variabile con un parametro', '2 · A variable with one parameter'))
await r.clear()
await newVariable(V.draw, 'text')
await fill(varText(), S.drawVar)
await r.focus(
  [prow(T['variable.text'], dialog()), sample()],
  t(
    '{1} è il parametro: il numero che cambia da carta a carta. Qui compare due volte',
    '{1} is the parameter: the number that changes from card to card. Here it appears twice'
  ),
  'left',
  { pad: 4 }
)
await fill(tryWith(), '3')
await r.focus(
  [prow(T['variable.tryWith'], dialog()), sample()],
  t(
    'Prova con: il valore usato nella frase di prova, qui 3',
    'Try with: the value used in the sample sentence, here 3'
  ),
  'left',
  { pad: 4 }
)
await closeWith('variable.save')
await pick(0)
await replace(textField(), S.draw2, `{${V.draw}:2}`)
await r.focus(
  textField(),
  t(
    'Nella carta: il nome, due punti e il valore. {pesca:2}',
    'On the card: the name, a colon and the value. {draw:2}'
  ),
  'left',
  { pad: 4 }
)
await zoomCard(t('La stessa frase di prima, ora dalla variabile', 'The same sentence as before, now from the variable'))
await pick(2)
await replace(textField(), S.draw3, `{${V.draw}:3}`)
await pick(5)
await replace(textField(), S.draw2, `{${V.draw}:2}`)
await r.focus(
  [cell(0), cell(2), cell(5)],
  t('{pesca:2}, {pesca:3}, {pesca:2}: una frase sola', '{draw:2}, {draw:3}, {draw:2}: one sentence'),
  'right',
  { pad: 4 }
)
await openVariable(V.draw)
await replace(varText(), S.drawOld, S.drawNew, { tab: false })
await r.focus(
  [prow(T['variable.text'], dialog()), sample()],
  t('Si cambia la frase una volta sola…', 'Change the sentence once…'),
  'left',
  { pad: 4 }
)
await closeWith('variable.save')
await r.focus(
  [cell(0), cell(2), cell(5)],
  t('…e cambia su tutte le carte', '…and it changes on every card'),
  'right',
  { pad: 4 }
)
await save()

// ---- 3. più parametri
await r.title(t('3 · Più parametri, anche di testo', '3 · More parameters, text too'))
await r.clear()
await newVariable(V.trade, 'text')
await fill(varText(), S.tradeVar)
await fill(tryWith(), '3:1')
await r.focus(
  [prow(T['variable.text'], dialog()), prow(T['variable.tryWith'], dialog()), sample()],
  t(
    'Due parametri, {1} e {2}. Nella prova, come nell’uso, sono divisi da due punti: 3:1',
    'Two parameters, {1} and {2}. In the test, as in use, they are split by a colon: 3:1'
  ),
  'left',
  { pad: 4 }
)
await closeWith('variable.save')
await pick(1)
await replace(textField(), S.tradeOld, `{${V.trade}:3:1}`)
await zoomCard(t('{scambia:3:1}: dai 3 monete, ricevi 1 legno', '{trade:3:1}: give 3 coins, get 1 wood'))
await newVariable(V.attack, 'text')
await fill(varText(), S.attackVar)
await fill(tryWith(), S.attackTry)
await r.focus(
  [prow(T['variable.text'], dialog()), prow(T['variable.tryWith'], dialog()), sample()],
  t(
    'Un parametro può essere anche un testo, con gli spazi: a chi va l’attacco',
    'A parameter can be text too, spaces included: who the attack is aimed at'
  ),
  'left',
  { pad: 4 }
)
await closeWith('variable.save')
await pick(3)
await replace(textField(), S.attack2, S.attackUse2)
await pick(4)
await replace(textField(), S.attack1, S.attackUse1)
await r.focus(
  textField(),
  t(
    'Ogni carta sceglie numero e bersaglio: {attacca:1:ogni nemico}',
    'Each card picks number and target: {attack:1:every enemy}'
  ),
  'left',
  { pad: 4 }
)
await zoomCard(
  t('Le icone nella variabile funzionano come sempre', 'Icons inside the variable work as usual')
)
await save()

// ---- 4. un numero su un'icona
await r.title(t('4 · Un numero su un’icona', '4 · A number on an icon'))
await r.clear()
await zoomCard(
  t('Il costo, in alto a sinistra, è solo un numero', 'The cost, top left, is just a number')
)
await newVariable(V.gold, 'text')
await fill(varText(), S.goldVar)
await fill(tryWith(), '3')
await r.focus(
  [prow(T['variable.text'], dialog()), sample()],
  t(
    'Il parametro è il testo, lo sfondo un cerchio dorato: una moneta con il numero sopra',
    'The parameter is the text, the background a gold circle: a coin with the number on it'
  ),
  'left',
  { pad: 4 }
)
await r.focus(
  prow(T['variable.text'], dialog()),
  t(
    'Come sfondo va bene anche un’immagine degli asset o una variabile icona',
    'An image from the assets or an icon variable works as a background too'
  ),
  'left',
  { pad: 4 }
)
await closeWith('variable.save')
await r.click(win.getByRole('button', { name: T['preview.editTemplate'] }).first())
await r.clear(1200)
await r.overlay()
await previewRow(0)
await r.click(layer(C.cost))
await r.focus(
  props,
  t(
    'Il costo è un livello Valore del template, letto dalla colonna costo',
    'The cost is a Value layer of the template, read from the cost column'
  ),
  'left',
  { pad: 4 }
)
await r.click(layer(C.costBadge))
await fill(field(T['prop.text']), `{${V.gold}:{${C.cost}}}`)
await r.focus(
  [prow(T['prop.text']), stage()],
  t(
    'Il parametro può essere un campo: {oro:{costo}} mette il costo di ogni carta nella moneta',
    'A parameter can be a field: {gold:{cost}} puts each card’s cost in the coin'
  ),
  'left',
  { pad: 4 }
)
await save()
await openSet(N.actions)
await r.focus(
  grid(),
  t('Ogni carta con la sua moneta', 'Each card with its own coin'),
  'left',
  { pad: 4 }
)
await openSet(N.die)
for (const [i, v] of ['1', '1', '2', '2', '3'].entries()) {
  await pick(i)
  await fill(cardField(C.face), `{${V.gold}:${v}}`)
}
await r.zoom([cell(0), cell(5)], { max: 2.2, fill: 0.8 })
await r.focus(
  [cell(0), cell(5)],
  t(
    'La stessa moneta sulle facce di un dado: segnalini, plance e documenti funzionano allo stesso modo',
    'The same coin on the faces of a die: tokens, boards and documents work the same way'
  ),
  'below',
  { pad: 4, dim: false }
)
await r.unzoom()
await save()

// ---- 5. variabili dentro variabili
await r.title(t('5 · Variabili dentro variabili', '5 · Variables inside variables'))
await r.clear()
await openSet(N.actions)
await openVariable(V.trade)
await replace(varText(), `{1}{${I.coin}}`, `{${V.gold}:{1}}`, { tab: false })
await r.focus(
  [prow(T['variable.text'], dialog()), sample()],
  t(
    'scambia usa oro e gli passa il suo primo parametro: {oro:{1}}',
    'trade uses gold and hands it its first parameter: {gold:{1}}'
  ),
  'left',
  { pad: 4 }
)
await closeWith('variable.save')
await pick(1)
await zoomCard(t('Il prezzo è ora una moneta con il numero', 'The price is now a coin with the number'))
await newVariable(V.rest, 'text')
await fill(varText(), S.restVar)
await fill(tryWith(), '2')
await r.focus(
  [prow(T['variable.text'], dialog()), sample()],
  t(
    'riposa è pesca più una regola: {pesca:{1}}, poi scarta una carta',
    'rest is draw plus a rule: {draw:{1}}, then discard a card'
  ),
  'left',
  { pad: 4 }
)
await closeWith('variable.save')
await pick(5)
await replace(textField(), S.restOld, `{${V.rest}:2}`)
await zoomCard(
  t(
    '{riposa:2}. Cambiando pesca cambia anche riposa',
    '{rest:2}. Change draw and rest changes too'
  )
)
await save()

// ---- 6. nel regolamento
await r.title(t('6 · Nel regolamento', '6 · In the rulebook'))
await r.clear()
await r.click(side(N.doc))
await r.clear(1200)
await r.overlay()
await r.click(docEditor(), { after: 300 })
await win.keyboard.press('Control+End')
for (const [i, row] of S.glossary.entries()) {
  await r.type(row)
  await closeHelp()
  if (i < S.glossary.length - 1) await win.keyboard.press('Enter')
  await r.wait(200)
}
await r.wait(800)
const zoomIn = docPreview().locator('.document-zoom button').last()
for (let i = 0; i < 3; i++) await r.click(zoomIn, { after: 300, ms: 350 })
await r.focus(
  docPreview(),
  t(
    'Le stesse variabili nel glossario, con una lettera al posto del numero',
    'The same variables in the glossary, with a letter instead of the number'
  ),
  'left',
  { pad: 4 }
)
await r.focus(
  docPreview(),
  t(
    'Carte e regolamento usano sempre la stessa frase: si cambia in un punto solo',
    'Cards and rulebook always use the same sentence: change it in one place'
  ),
  'left',
  { pad: 4 }
)

// ---- 7. errori e consigli
await r.title(t('7 · Errori e consigli', '7 · Mistakes and tips'))
await r.clear()
await openSet(N.actions)
await pick(1)
await replace(textField(), `{${V.trade}:3:1}`, `{${V.trade}:3}`)
await r.focus(
  [previewCard(), problems()],
  t(
    'Manca il secondo parametro: resta vuoto e la carta lo segnala, con la forma giusta',
    'The second parameter is missing: it stays empty and the card reports it, with the right form'
  ),
  'left',
  { pad: 4 }
)
await replace(textField(), `{${V.trade}:3}`, `{${V.trade}:3:1}`)
await r.focus(
  textField(),
  t(
    'Due punti dentro un parametro si scrivono \\: per esempio {attacca:2:il drago\\: rosso}',
    'A colon inside a parameter is written \\: for example {attack:2:the dragon\\: red}'
  ),
  'left',
  { pad: 4 }
)
await r.focus(
  grid(),
  t(
    'Conviene per le frasi che si ripetono con un numero o una parola diversa. Una frase che compare una volta si scrive e basta',
    'Worth it for sentences repeated with a different number or word. A sentence used once is just written'
  ),
  'left',
  { pad: 4 }
)
await save()

// ---- 8. riepilogo
await r.title(t('8 · Riepilogo', '8 · Summary'))
await r.clear()
await win.keyboard.press('F1')
await r.clear(1000)
await r.click(dialog().getByRole('button', { name: T['help.tab.variables'], exact: true }), {
  after: 800
})
await r.focus(
  dialog(),
  t(
    'F1, Campi e variabili: {pesca:2} e {scambia:2:1} sono nell’elenco',
    'F1, Fields and variables: {draw:2} and {trade:2:1} are in the list'
  ),
  'right',
  { pad: 0 }
)
await win.keyboard.press('Escape')
await r.wait(500)
await r.title(
  t(
    'Nel testo della variabile {1}, {2}… · nell’uso {nome:valore:valore} · un parametro può essere un campo o un’altra variabile',
    'In the variable text {1}, {2}… · in use {name:value:value} · a parameter can be a field or another variable'
  ),
  6000
)
await r.title(
  t(
    'Il progetto si scarica dal sito: stella.lucadj.eu',
    'Download the project from the site: stella.lucadj.eu'
  ),
  4000
)
await r.clear(600)
console.log('VIDEO', await r.finish())
