// Video 2: il primo componente da zero (circa 4-5 minuti, senza voce). Progetto vuoto, template con
// testo, immagine e icone nel testo, colore dello sfondo calcolato con una formula, set con tre
// colonne, esportazione in PDF; in chiusura lo stesso metodo per un segnalino.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node --experimental-strip-types --no-warnings scripts/video/primo-componente.mjs it|en
// FAST=1 accorcia attese e scrittura, per provare il percorso senza badare al ritmo.
import { launch, mockOpen } from './lib.mjs'
import { docs } from '../guide/lib.mjs'
import { rmSync } from 'node:fs'
const lang = process.argv[2] || 'it'
const it = lang === 'it'
const r = await launch({ lang, ...(process.env.UD ? { ud: process.env.UD } : {}) })
const { win, T } = r
if (process.env.FAST) {
  const wait = r.wait.bind(r)
  r.wait = (ms) => wait(Math.min(ms, 120))
  r.type = (text) => win.keyboard.type(text, { delay: 2 })
}
// riquadro e testo spariscono prima di ogni clic: il clic apre finestre o cambia vista
const click0 = r.click.bind(r)
r.click = async (loc, opts) => {
  await r.clear(150)
  return click0(loc, opts)
}
const S = it
  ? {
      project: 'Il mio gioco',
      template: 'carta',
      set: 'Personaggi',
      token: 'segnalino',
      fire: 'Fuoco',
      water: 'Acqua',
      cards: [
        ['Drago', 'Fuoco', 'Attacco: 3 {fuoco}'],
        ['Fenice', 'Fuoco', 'Attacco: 2 {fuoco}'],
        ['Sirena', 'Acqua', 'Cura: 2 {acqua}']
      ],
      icons: ['fuoco', 'acqua'],
      name: 'nome',
      type: 'tipo',
      text: 'testo',
      emblem: 'emblema'
    }
  : {
      project: 'My game',
      template: 'card',
      set: 'Characters',
      token: 'token',
      fire: 'Fire',
      water: 'Water',
      cards: [
        ['Dragon', 'Fire', 'Attack: 3 {fire}'],
        ['Phoenix', 'Fire', 'Attack: 2 {fire}'],
        ['Mermaid', 'Water', 'Heal: 2 {water}']
      ],
      icons: ['fire', 'water'],
      name: 'name',
      type: 'type',
      text: 'text',
      emblem: 'emblem'
    }
// il progetto si crea nella cartella proposta dall'app: deve essere nuova
rmSync(`${docs(lang)}/Stella/${S.project}`, { recursive: true, force: true })

const dialog = () => win.locator('[role="dialog"]').last()
const props = win.locator('aside.properties')
const field = (label, scope = props) =>
  scope
    .locator('.field')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${label}$`) }) })
    .locator('input:not([type=range]), textarea, select')
    .first()
/** Valore sulle carte: Colonna, Fisso o Formula, una riga sola in cima alle proprietà */
const source = (kind) =>
  props
    .locator('.source-line .segmented button')
    .filter({ hasText: new RegExp(`^${kind === 'column' ? T['source.short.column'] : T['source.kind.' + kind]}$`) })
    .first()
const layer = (n) => win.locator('.layers .layer-name', { hasText: new RegExp(`^${n}$`) }).first()
// il suggerimento dell'app sposta il title in data-tip al passaggio del mouse
const tool = (key) =>
  win.locator(`button.tool[title="${T[key]}"], button.tool[data-tip="${T[key]}"]`).first()
/** campo di una finestra di dialogo: un label con il testo e il controllo dentro */
const dlgField = (label) =>
  dialog()
    .locator('label')
    .filter({ hasText: new RegExp(`^\\s*${label}`) })
    .locator('input, select')
    .first()
const side = (name) => win.locator('.sidebar').getByText(name, { exact: true }).first()
const saveButton = () =>
  win
    .locator('header.toolbar button')
    .filter({ hasText: new RegExp(`^(${T['app.save']}|${T['app.saved']})$`) })
    .first()

/** scrive in un campo: clic, seleziona tutto, scrive, Tab per confermare */
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
/** trascina con il mouse da un punto a un altro, lentamente */
async function drag(from, to, ms = 900) {
  await r.clear(150)
  await r.glide(from.x, from.y, 600)
  await r.wait(300)
  await win.mouse.down()
  await r.glide(to.x, to.y, ms)
  await r.wait(200)
  await win.mouse.up()
  await r.wait(600)
}
const center = async (loc) => {
  const b = await loc.first().boundingBox()
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}
/** scorre il pannello delle proprietà fino in fondo e torna su */
async function scrollProps() {
  await props.evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }))
  await r.wait(2200)
  await props.evaluate((el) => el.scrollTo({ top: 0, behavior: 'smooth' }))
  await r.wait(1200)
}
/** posizione e dimensioni in millimetri */
async function place(x, y, w, h) {
  await fill(field('X'), String(x))
  await fill(field('Y'), String(y))
  await fill(field(T['prop.w']), String(w))
  await fill(field(T['prop.h']), String(h))
}

await r.overlay()
await r.title(it ? 'Il tuo primo componente da zero' : 'Your first component from scratch')
await r.title(
  it
    ? 'Una carta con nome, immagine, icone nel testo e un colore che cambia con il tipo'
    : 'A card with a name, an image, icons in the text and a color that follows the type'
)
await r.clear()

// progetto vuoto
await r.focus(
  win.locator('.welcome').first(),
  it
    ? 'Al primo avvio: comincia da zero o esplora il progetto di esempio'
    : 'On first launch: start from scratch or explore the example project',
  'none',
  { pad: 4, dim: false }
)
const scratch = win.locator('.welcome-choice.main').first()
await r.focus(scratch, it ? 'Si parte da un progetto nuovo' : 'We start from a new project', 'below')
await r.click(scratch)
await r.clear(400)
await r.type(S.project)
await r.wait(400)
await r.focus(
  dialog(),
  it
    ? 'Il nome e la cartella. I dati dei componenti vanno in un file Excel'
    : 'Name and folder. The component data goes into an Excel file',
  'right',
  { pad: 0 }
)
await r.click(dialog().locator('button[type=submit]'))
await r.clear(1800)
await r.overlay()
const steps = win.locator('.first-steps').first()
await r.focus(
  steps,
  it
    ? 'Primi passi: Stella indica ogni volta il passo successivo'
    : 'First steps: Stella shows you the next step each time',
  'below',
  { pad: 4 }
)
await r.focus(
  steps.locator('button.primary'),
  it ? 'Prima il template: il disegno della carta' : 'First the template: the drawing of the card',
  'below'
)
await r.click(steps.locator('button.primary'))
await r.clear(400)
await r.type(S.template)
await r.wait(400)
await r.focus(
  dialog().locator('.kind-choice'),
  it
    ? 'Cosa stai creando: carta, segnalino, tessera, plancia o faccia di dado'
    : 'What are you making: card, token, tile, board or die face',
  'right'
)
await r.focus(
  dlgField(T['newTemplate.format']),
  it
    ? 'Il formato: poker, bridge, tarocchi, quadrato o su misura'
    : 'The size: poker, bridge, tarot, square or custom',
  'right'
)
await r.click(dialog().locator('button[type=submit]'))
await r.clear(1500)
await r.overlay()

// l'editor
await r.focus(
  win.locator('.canvas-stage').first(),
  it
    ? 'Linea rossa: il taglio con l’abbondanza. Azzurra: il margine di sicurezza'
    : 'Red line: the cut with the bleed. Blue: the safe area',
  'left',
  { pad: 0 }
)
await r.focus(
  win.locator('.editor-toolbar').first(),
  it
    ? 'Gli strumenti, con il loro nome: testo, immagine, forme, griglia, valore'
    : 'The tools, with their names: text, image, shapes, grid, value',
  'below',
  { pad: 4 }
)

// il nome
await r.title(it ? 'Il nome' : 'The name')
await r.clear()
await r.click(tool('tool.text'))
await r.clear(400)
await r.focus(
  field(T['prop.name']),
  it
    ? 'Il nome del livello è anche la colonna del foglio'
    : 'The layer name is also the sheet column',
  'left'
)
await fill(field(T['prop.name']), S.name)
await r.focus(
  props.locator('.value-source').first(),
  it
    ? 'Valore sulle carte, sempre in cima: Colonna «' + S.name + '». Ogni carta mostra il suo'
    : 'Value on cards, always on top: Column “' + S.name + '”. Each card shows its own',
  'left',
  { pad: 4 }
)
await r.clear(300)
await fill(field(T['prop.size']), '16')
await choose(field(T['prop.weight']), '700')
await choose(field(T['prop.align']), 'center')
await r.focus(
  field('X'),
  it ? 'Posizione e dimensioni, in millimetri' : 'Position and size, in millimeters',
  'left',
  { ms: 2400 }
)
await r.clear(200)
await place(6, 8, 51, 10)
await r.wait(600)

// l'immagine e le icone
await r.title(it ? 'L’immagine' : 'The image')
await r.clear()
// un livello nuovo va sopra a quello selezionato: sopra lo sfondo, sotto il nome, così nel foglio
// la colonna del nome resta la prima
await r.click(layer('background'), { after: 400 })
await r.click(tool('tool.image'))
await r.clear(800)
await r.focus(
  dialog(),
  it
    ? 'Immagine apre subito la scelta: le immagini del progetto, o dal computer'
    : 'Image opens the picker right away: the project images, or from your computer',
  'none',
  { pad: 0, dim: false }
)
await r.focus(
  dialog().getByRole('button', { name: T['assetPicker.importIcons'] }),
  it
    ? 'Le icone di game-icons.net sono già nell’app'
    : 'The game-icons.net icons are already in the app',
  'below'
)
await r.click(dialog().getByRole('button', { name: T['assetPicker.importIcons'] }))
await r.clear(1500)
await r.focus(
  [
    dialog().getByRole('button', { name: T['icons.collection.game-icons'], exact: true }),
    dialog().getByRole('button', { name: T['icons.collection.iconify'], exact: true })
  ],
  it
    ? 'Raccolte pronte: game-icons.net, Kenney (icone, carte, dadi, pedine) e, online, Iconify'
    : 'Ready collections: game-icons.net, Kenney (icons, cards, dice, pawns) and, online, Iconify',
  'below'
)
for (const [q, name] of [
  ['swords', 'crossed-swords'],
  ['flame', 'flame'],
  ['drop', 'drop']
]) {
  await fill(dialog().getByPlaceholder(T['icons.search']), q, { tab: false })
  await r.wait(900)
  await r.click(dialog().getByText(name, { exact: true }), { after: 500 })
}
const names = dialog().locator('.icon-chosen-row input')
await r.focus(
  names.nth(1),
  it
    ? 'Prima di importarle si può cambiare il nome: fiamma diventa «fuoco»'
    : 'Before importing you can rename them: flame becomes “fire”',
  'above'
)
await fill(names.nth(1), S.icons[0], { tab: false })
await fill(names.nth(2), S.icons[1], { tab: false })
await r.wait(500)
await r.focus(
  dialog().locator('button.primary'),
  it
    ? 'Tre icone: l’emblema, il fuoco e l’acqua. La licenza viene annotata'
    : 'Three icons: the emblem, fire and water. The license is recorded',
  'above'
)
await r.click(dialog().locator('button.primary'))
await r.clear(1500)
await r.click(dialog().locator('[title*="crossed-swords"]').first())
await r.clear(1000)
await fill(field(T['prop.name']), S.emblem)
if ((await source('fixed').getAttribute('aria-pressed')) !== 'true') await r.click(source('fixed'))
await r.focus(
  source('fixed'),
  it
    ? 'Questa immagine è uguale su tutte le carte: valore Fisso'
    : 'This image is the same on every card: a Fixed value',
  'left'
)
// sulla tela: trascinare, ridimensionare con le maniglie, ruotare
const stage = win.locator('.canvas-stage').first()
await r.focus(
  stage,
  it
    ? 'Sulla tela si lavora con il mouse: trascina per spostare'
    : 'On the canvas you work with the mouse: drag to move',
  'left',
  { pad: 0, ms: 2600 }
)
const body = await center(win.locator('.handle.h-se'))
const nw = await center(win.locator('.handle.h-nw'))
const mid = { x: (body.x + nw.x) / 2, y: (body.y + nw.y) / 2 }
await drag(mid, { x: mid.x, y: mid.y - 70 })
await r.focus(
  stage,
  it ? 'Le maniglie agli angoli cambiano le dimensioni' : 'The corner handles change the size',
  'left',
  { pad: 0, ms: 2400 }
)
const se = await center(win.locator('.handle.h-se'))
await drag(se, { x: se.x + 50, y: se.y + 50 })
await r.focus(stage, it ? 'Quella in alto lo ruota' : 'The one on top rotates it', 'left', {
  pad: 0,
  ms: 2200
})
const rot = await center(win.locator('.handle.rotate'))
await drag(rot, { x: rot.x + 90, y: rot.y + 20 })
await r.focus(
  props.locator('.field-grid').first(),
  it
    ? 'Per misure precise, i numeri nel pannello delle proprietà'
    : 'For exact measures, the numbers in the properties panel',
  'left',
  { ms: 2800 }
)
await r.clear(200)
await fill(field(T['prop.rotation']), '0')
await place(16, 22, 31, 31)
await r.wait(600)

// il testo con le icone
await r.title(it ? 'Il testo, con le icone' : 'The text, with icons')
await r.clear()
await r.click(tool('tool.text'))
await r.clear(400)
await fill(field(T['prop.name']), S.text)
await r.focus(
  field(T['prop.text']),
  it
    ? 'Un testo di prova. {fuoco} è l’icona del fuoco, dentro il testo'
    : 'A sample text. {fire} is the fire icon, inside the text',
  'left'
)
await fill(field(T['prop.text']), S.cards[0][2], { tab: false })
await win.keyboard.press('Tab')
await fill(field(T['prop.size']), '13')
await choose(field(T['prop.align']), 'center')
await place(6, 62, 51, 16)
await r.focus(
  win.locator('.canvas-stage').first(),
  it ? 'L’icona segue la dimensione del testo' : 'The icon follows the text size',
  'left',
  { pad: 0 }
)
await r.focus(
  props,
  it
    ? 'Nel pannello delle proprietà si imposta tutto nel dettaglio: font, colori, contorni, ombre…'
    : 'In the properties panel you set everything in detail: fonts, colors, outlines, shadows…',
  'left',
  { pad: 0, ms: 3600 }
)
await r.clear(200)
await scrollProps()

// i livelli
await r.title(it ? 'I livelli' : 'The layers')
await r.clear()
await r.focus(
  win.locator('aside.layers .layers-list').first(),
  it
    ? 'Il primo dell’elenco sta sopra a tutti; si riordinano trascinando o con le frecce'
    : 'The first in the list is on top; reorder them by dragging or with the arrows',
  'right',
  { pad: 4 }
)
await r.click(layer(S.emblem), { after: 400 })
// le scorciatoie tra parentesi cambiano con il sistema (⌘ sul Mac, Ctrl altrove)
const base = (s) => s.replace(/\s*\([^)]*\)$/, '')
const layerBtn = (key) =>
  win
    .locator(
      `aside.layers button[title^="${base(T[key])}"], aside.layers button[data-tip^="${base(T[key])}"]`
    )
    .first()
await r.click(layerBtn('layers.down'), { after: 800 })
await r.focus(
  stage,
  it ? 'Sotto lo sfondo l’emblema non si vede più' : 'Below the background the emblem is hidden',
  'left',
  { pad: 0, ms: 2600 }
)
await r.click(layerBtn('layers.up'), { after: 800 })
await r.click(layer(S.text), { after: 300 })
await r.clear(150)
await r.glide(...Object.values(await center(layer(S.emblem))), 500)
await win.keyboard.down('Shift')
await win.mouse.click(r.cx, r.cy)
await win.keyboard.up('Shift')
await r.wait(500)
await r.click(layerBtn('layers.group'), { after: 800 })
await r.focus(
  win.locator('aside.layers .layers-list').first(),
  it
    ? 'Raggruppati: si spostano e si ridimensionano insieme'
    : 'Grouped: they move and resize together',
  'right',
  { pad: 4 }
)
await r.click(layerBtn('layers.ungroup'), { after: 800 })

// la formula
await r.title(it ? 'Il colore, con una formula' : 'The color, with a formula')
await r.clear()
await r.click(layer('background'))
await r.clear(400)
await r.focus(
  source('formula'),
  it
    ? 'Lo sfondo cambia colore con il tipo: una formula, come in Excel'
    : 'The background changes color with the type: a formula, as in Excel',
  'left'
)
await r.click(source('formula'))
await r.wait(400)
await fill(field(T['source.formula']), `=IF({${S.type}}="${S.fire}"; "#F4B9A4"; "#B8CCEC")`, {
  tab: false
})
await win.keyboard.press('Tab')
await r.focus(
  props.locator('.value-source').first(),
  it
    ? 'Se il tipo è ' + S.fire + ' il rosso, altrimenti l’azzurro'
    : 'If the type is ' + S.fire + ', red; otherwise blue',
  'left',
  { pad: 4 }
)
await r.clear(300)
await r.click(saveButton())
await r.clear(800)

// il set
await r.title(it ? 'Le carte' : 'The cards')
await r.clear()
await r.focus(
  steps.locator('button.primary'),
  it
    ? 'Secondo passo, un set: le carte che usano il template'
    : 'Second step, a set: the cards that use the template',
  'below'
)
await r.click(steps.locator('button.primary'))
await r.clear(400)
await r.type(S.set)
await r.wait(400)
await r.focus(
  dialog(),
  it
    ? 'Il foglio nuovo ha già le colonne del template: ' + S.name + ' e ' + S.text
    : 'The new sheet already has the template columns: ' + S.name + ' and ' + S.text,
  'right',
  { pad: 0 }
)
await r.click(dialog().locator('button[type=submit]'))
await r.clear(1800)
await r.overlay()
await r.focus(
  win.getByRole('button', { name: T['set.addColumn'] }),
  it
    ? '+ Campo: manca la colonna «' + S.type + '», quella della formula'
    : '+ Field: the “' + S.type + '” column, used by the formula, is missing',
  'below'
)
await r.click(win.getByRole('button', { name: T['set.addColumn'] }))
await r.clear(500)
await fill(dialog().locator('input').last(), S.type, { tab: false })
await win.keyboard.press('Enter')
await r.wait(1000)

const form = win.locator('.card-form')
const cardField = (col) =>
  form
    .locator('label')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${col}$`) }) })
    .locator('input, textarea')
    .first()
for (const [i, [name, type, text]] of S.cards.entries()) {
  if (i === 0 && !(await form.count())) {
    const first = win.getByRole('button', { name: T['set.addFirst'], exact: true }).first()
    await r.focus(
      first,
      it
        ? 'Il set è vuoto: si aggiunge il primo componente'
        : 'The set is empty: add the first component',
      'below'
    )
    await r.click(first)
    await r.clear(600)
  } else if (i > 0) {
    await r.click(win.getByRole('button', { name: T['kind.card.add'], exact: true }).first())
    await r.clear(600)
  }
  if (i === 0)
    await r.focus(
      form.first(),
      it ? 'Il modulo della carta: un campo per colonna' : 'The card form: one field per column',
      'left',
      { pad: 4 }
    )
  await r.clear(200)
  await fill(cardField(S.name), name)
  await fill(cardField(S.type), type)
  await fill(cardField(S.text), text)
  await r.wait(700)
}
await r.focus(
  win.locator('.card-grid').first(),
  it
    ? 'Tre carte, tre righe del foglio. Il colore segue il tipo'
    : 'Three cards, three rows of the sheet. The color follows the type',
  'above',
  { pad: 4 }
)
await r.click(saveButton())
await r.clear(800)

// una modifica al template vale per tutte le carte
await r.title(
  it ? 'Si cambia il template, cambiano tutte le carte' : 'Change the template, every card changes'
)
await r.clear()
const editTemplate = win.getByRole('button', { name: T['preview.editTemplate'] }).first()
await r.click(editTemplate)
await r.clear(1200)
await r.overlay()
await r.click(layer(S.name), { after: 400 })
await r.focus(
  field(T['prop.size']),
  it ? 'Il nome più grande e di un altro colore' : 'A bigger name, in another color',
  'left'
)
await fill(field(T['prop.size']), '20')
await fill(field(T['prop.color']), '#7A2412')
await r.wait(600)
await r.click(side(S.set))
await r.clear(1200)
await r.overlay()
await r.focus(
  win.locator('.card-grid').first(),
  it ? 'Tutte e tre le carte sono già aggiornate' : 'All three cards are already updated',
  'above',
  { pad: 4 }
)
await r.click(saveButton())
await r.clear(800)

// esportare
await r.title(it ? 'Il PDF per la stampa' : 'The PDF for printing')
await r.clear()
await r.click(win.locator('header.toolbar').getByText(T['app.export'], { exact: true }).first())
await r.clear(800)
const goal = (g) => dialog().locator('.export-goal').filter({ hasText: T['export.goal.' + g] }).first()
await r.focus(
  dialog().locator('.export-goals'),
  it
    ? 'Cosa vuoi fare? Stampare a casa, in tipografia, Tabletop Simulator o immagini'
    : 'What do you want to do? Print at home, print shop, Tabletop Simulator or images',
  'below',
  { pad: 4 }
)
await r.click(goal('home'))
await r.wait(600)
await r.focus(
  dialog(),
  it
    ? 'Le carte disposte sul foglio, con i segni di taglio'
    : 'The cards laid out on the page, with crop marks',
  'none',
  { pad: 0, dim: false }
)
await r.focus(
  goal('shop'),
  it
    ? 'Per la tipografia: abbondanza e segni di taglio già impostati'
    : 'For a print shop: bleed and crop marks already set',
  'below'
)
await r.click(dialog().getByRole('button', { name: T['export.run'], exact: true }))
await r.wait(3000)
await r.focus(
  dialog(),
  it ? 'Il PDF è nella cartella export del progetto' : 'The PDF is in the project’s export folder',
  'left',
  { pad: 0, dim: false }
)
await r.clear(300)
await r.click(dialog().getByRole('button', { name: T['export.close'], exact: true }))
await r.wait(600)

// stesso metodo, altro formato
await r.title(
  it
    ? 'Segnalini, tessere e plance: stesso metodo, cambia il formato'
    : 'Tokens, tiles and boards: same method, different size'
)
await r.clear()
await r.click(win.getByTitle(T['sidebar.newTemplate']).first())
await r.clear(400)
await r.type(S.token)
await r.click(dialog().locator('.kind-choice button').filter({ hasText: T['kind.token'] }).first())
await r.wait(500)
await r.focus(
  dialog(),
  it
    ? 'Segnalino: il formato proposto è tondo, 25 mm'
    : 'Token: the suggested format is round, 25 mm',
  'right',
  { pad: 0 }
)
await r.click(dialog().locator('button[type=submit]'))
await r.clear(1500)
await r.overlay()
await r.focus(
  win.locator('.canvas-stage').first(),
  it
    ? 'Forma rotonda; poi livelli, set ed export come per la carta'
    : 'Round shape; then layers, sets and export as for the card',
  'left',
  { pad: 0 }
)
await r.clear()
await r.title(
  it
    ? 'Tutto il resto è nella guida: stella.lucadj.eu'
    : 'Everything else is in the guide: stella.lucadj.eu',
  3800
)
await r.clear(600)
const p = await r.finish()
console.log('VIDEO', p)
