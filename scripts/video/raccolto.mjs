// Video 14: un gioco completo, dall'idea al tavolo (circa 12-15 minuti, senza voce). «Raccolto», un
// piccolo gioco inventato apposta: 12 carte coltura (6 righe con 2 copie), 8 monete, una plancia con
// 4 campi e il tracciato del punteggio, un dado con le colture, il regolamento, il PDF e Tabletop
// Simulator. Si parte da un progetto vuoto. I livelli che non cambiano da carta a carta sono Fissi; il
// tipo, che serve solo alla formula del colore, è un livello Valore. Il filmato dentro Tabletop
// Simulator, registrato da Luca, si aggiunge al montaggio.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node --experimental-strip-types --no-warnings scripts/video/raccolto.mjs it|en
// FAST=1 accorcia attese e scrittura; SHOT=<file.png> salva la schermata se un elemento non si trova.
import { launch } from './lib.mjs'
import { docs } from '../guide/lib.mjs'
import { rmSync } from 'node:fs'
const lang = process.argv[2] || 'it'
const it = lang === 'it'
const t = (a, b) => (it ? a : b)
const r = await launch({ lang, ...(process.env.UD ? { ud: process.env.UD } : {}) })
const { win, T } = r
const typeNormal = r.type.bind(r)
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
const click0 = r.click.bind(r)
r.click = async (loc, opts) => {
  await r.clear(150)
  return click0(loc, opts)
}

const S = it
  ? {
      project: 'Raccolto',
      card: 'coltura',
      cards: 'Colture',
      coin: 'moneta',
      coins: 'Monete',
      board: 'plancia',
      boards: 'Plance',
      die: 'dado',
      dice: 'Dado',
      field: 'campo',
      garden: 'orto',
      L: {
        name: 'nome',
        icon: 'icona',
        value: 'valore',
        cost: 'costo',
        type: 'tipo',
        valueLabel: 'etichetta_valore',
        costLabel: 'etichetta_costo',
        panel: 'riquadro',
        bg: 'sfondo',
        backBg: 'retro_sfondo',
        backTitle: 'retro_titolo',
        backIcon: 'retro_icona',
        title: 'titolo',
        fields: 'campi',
        track: 'tracciato',
        face: 'faccia'
      },
      valueWord: 'Valore',
      costWord: 'Costo',
      // nome, icona, tipo, valore, costo, copie
      crops: [
        ['Grano', 'grano', 'campo', '1', '1'],
        ['Mais', 'mais', 'campo', '2', '1'],
        ['Patata', 'patata', 'campo', '2', '2'],
        ['Carota', 'carota', 'orto', '1', '1'],
        ['Zucca', 'zucca', 'orto', '3', '2'],
        ['Pomodoro', 'pomodoro', 'orto', '2', '2']
      ],
      icons: [
        ['wheat', 'grano'],
        ['corn', 'mais'],
        ['potato', 'patata'],
        ['carrot', 'carota'],
        ['pumpkin', 'zucca'],
        ['tomato', 'pomodoro'],
        ['two-coins', 'moneta']
      ],
      rules: [
        '# Raccolto',
        '',
        'Un gioco di semina e raccolto per 2-4 giocatori.',
        '',
        '## Il turno',
        '',
        'Tira il dado: la coltura uscita cresce in tutti i campi che la ospitano. Poi puoi comprare una carta coltura pagando il suo costo in {moneta} e piantarla in un campo libero.',
        '',
        'Vince chi arriva per primo a 20 punti sul tracciato.',
        ''
      ],
      cardsTitle: ['', '## Le carte coltura', ''],
      anatomy: [
        ['icona', 'La coltura'],
        ['valore', 'Il valore'],
        ['costo', 'Il costo in monete']
      ],
      setupTitle: ['', '## Preparazione', ''],
      table: { deck: 'Mazzo', market: 'Mercato', coins: 'Banca', die: 'Dado' }
    }
  : {
      project: 'Harvest',
      card: 'crop',
      cards: 'Crops',
      coin: 'coin',
      coins: 'Coins',
      board: 'board',
      boards: 'Boards',
      die: 'die',
      dice: 'Die',
      field: 'field',
      garden: 'garden',
      L: {
        name: 'name',
        icon: 'icon',
        value: 'value',
        cost: 'cost',
        type: 'type',
        valueLabel: 'value_label',
        costLabel: 'cost_label',
        panel: 'panel',
        bg: 'background',
        backBg: 'back_background',
        backTitle: 'back_title',
        backIcon: 'back_icon',
        title: 'title',
        fields: 'fields',
        track: 'track',
        face: 'face'
      },
      valueWord: 'Value',
      costWord: 'Cost',
      crops: [
        ['Wheat', 'wheat', 'field', '1', '1'],
        ['Corn', 'corn', 'field', '2', '1'],
        ['Potato', 'potato', 'field', '2', '2'],
        ['Carrot', 'carrot', 'garden', '1', '1'],
        ['Pumpkin', 'pumpkin', 'garden', '3', '2'],
        ['Tomato', 'tomato', 'garden', '2', '2']
      ],
      icons: [
        ['wheat', 'wheat'],
        ['corn', 'corn'],
        ['potato', 'potato'],
        ['carrot', 'carrot'],
        ['pumpkin', 'pumpkin'],
        ['tomato', 'tomato'],
        ['two-coins', 'coin']
      ],
      rules: [
        '# Harvest',
        '',
        'A game of sowing and harvesting for 2-4 players.',
        '',
        '## The turn',
        '',
        'Roll the die: the crop rolled grows in every field that holds it. Then you may buy a crop card, paying its cost in {coin}, and plant it in a free field.',
        '',
        'The first to reach 20 points on the track wins.',
        ''
      ],
      cardsTitle: ['', '## The crop cards', ''],
      anatomy: [
        ['icon', 'The crop'],
        ['value', 'The value'],
        ['cost', 'The cost in coins']
      ],
      setupTitle: ['', '## Setup', ''],
      table: { deck: 'Deck', market: 'Market', coins: 'Bank', die: 'Die' }
    }
const L = S.L
// il progetto si crea nella cartella proposta dall'app: deve essere nuova
rmSync(`${docs(lang)}/Stella/${S.project}`, { recursive: true, force: true })

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
const layersList = () => win.locator('aside.layers .layers-list').first()
const tool = (key) =>
  win.locator(`button.tool[title="${T[key]}"], button.tool[data-tip="${T[key]}"]`).first()
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
const stage = () => win.locator('.canvas-stage').first()
const steps = () => win.locator('.first-steps').first()
const grid = () => win.locator('.card-grid').first()
const form = win.locator('.card-form')
const cardField = (col) =>
  form
    .locator('label')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${col}$`) }) })
    .locator('input, textarea')
    .first()
const fxd = () =>
  win
    .locator('[role="dialog"]')
    .filter({ has: win.locator('.formula-dialog') })
    .last()
const sentence = () => fxd().locator('.fx-guided > .fx-sentence')
const leaf = (i) => sentence().locator(':scope > .fx-leaf').nth(i)
const picker = () => fxd().locator('.fx-picker').first()
const result = () => fxd().locator('.fx-result-box').first()
const fxTab = (key) => picker().getByRole('tab', { name: T[key], exact: true })

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
async function place(x, y, w, h) {
  // prima le misure: cambiarle tiene fermo il punto di ancoraggio (il centro) e sposterebbe X e Y
  await fill(field(T['prop.w']), String(w))
  await fill(field(T['prop.h']), String(h))
  await fill(field('X'), String(x))
  await fill(field('Y'), String(y))
}
async function fillColor(value) {
  await fill(props.locator('input.color-text').first(), value)
}
async function setSource(kind) {
  const b = source(kind)
  if ((await b.getAttribute('aria-pressed')) !== 'true') await r.click(b, { after: 400 })
}
async function save() {
  await r.click(saveButton())
  await r.clear(800)
}
/** il riquadro grande che non serve più: la tela torna libera */
async function canvasEmpty() {
  const b = await win.locator('.canvas-viewport').first().boundingBox()
  await r.clear(150)
  await r.glide(b.x + 24, b.y + b.height - 24, 500)
  await win.mouse.click(b.x + 24, b.y + b.height - 24)
  await r.wait(300)
}
/** un testo: nome del livello, poi Colonna o Fisso */
async function text(name, { fixedText, size, weight, color, box, align = 'center' }) {
  await r.click(tool('tool.text'))
  await r.clear(400)
  await fill(field(T['prop.name']), name)
  if (fixedText !== undefined) {
    await setSource('fixed')
    await fill(field(T['prop.text']), fixedText)
  }
  if (size) await fill(field(T['prop.size']), String(size))
  if (weight) await choose(field(T['prop.weight']), String(weight))
  if (align) await choose(field(T['prop.align']), align)
  await choose(field(T['prop.valign']), 'middle').catch(() => {})
  if (color) await fill(field(T['prop.color']), color)
  if (box) await place(...box)
}
/** un rettangolo con R: nome, colore, posizione; Fisso */
async function rect(name, { color, box, radius }) {
  await canvasEmpty()
  await win.keyboard.press('r')
  await r.wait(600)
  await fill(field(T['prop.name']), name)
  await setSource('fixed')
  await fillColor(color)
  if (radius !== undefined) await fill(field(T['prop.radius']), String(radius))
  await place(...box)
}
async function newTemplate(name, kind) {
  await r.click(
    win
      .locator(`[title="${T['sidebar.newTemplate']}"], [data-tip="${T['sidebar.newTemplate']}"]`)
      .first()
  )
  await r.clear(400)
  await r.type(name)
  await r.click(
    dialog()
      .locator('.kind-choice button')
      .filter({ hasText: T['kind.' + kind] })
      .first()
  )
  await r.wait(600)
}
async function newSet(name, template) {
  await r.click(
    win.locator(`[title="${T['sidebar.newSet']}"], [data-tip="${T['sidebar.newSet']}"]`).first()
  )
  await r.clear(400)
  await r.type(name)
  await r.wait(400)
  await choose(dialog().locator('select').first(), template)
}
async function gridView() {
  const b = win.getByRole('button', { name: T['set.grid'], exact: true }).first()
  if (await b.isVisible().catch(() => false)) await r.click(b, { after: 700 })
}
/** 'first': il tasto del set vuoto; altrimenti il tipo di componente, per «+ Carta», «+ Segnalino»… */
async function addCard(kind) {
  if (kind === 'first') {
    await r.click(win.getByRole('button', { name: T['set.addFirst'], exact: true }).first())
  } else {
    await r.click(
      win.getByRole('button', { name: T['kind.' + kind + '.add'], exact: true }).first()
    )
  }
  await r.clear(600)
}
const copiesField = () =>
  form
    .locator('label')
    .filter({
      has: win.locator('.field-label', { hasText: new RegExp(`^${it ? 'Copie' : 'Copies'}$`) })
    })
    .locator('input')
    .first()

// ============ apertura
await r.overlay()
await r.title(t('Un gioco completo, dall’idea al tavolo', 'A complete game, from idea to table'))
await r.title(
  t(
    '«Raccolto»: carte, monete, una plancia e un dado, fino al PDF e a Tabletop Simulator',
    '“Harvest”: cards, coins, a board and a die, all the way to the PDF and Tabletop Simulator'
  )
)
await r.title(
  t(
    'Non vediamo ogni opzione: per i dettagli ci sono gli altri video',
    'We won’t see every option: the other videos have the details'
  )
)
await r.clear()

// ============ 1. progetto vuoto
await r.title(t('Il progetto', 'The project'))
const scratch = win.locator('.welcome-choice.main').first()
await r.click(scratch)
await r.clear(400)
await r.type(S.project)
await r.wait(400)
await r.focus(
  dialog(),
  t(
    'Un progetto vuoto: il nome e la cartella. Le carte vanno in un file Excel',
    'An empty project: name and folder. The cards go into an Excel file'
  ),
  'right',
  { pad: 0 }
)
await r.click(dialog().locator('button[type=submit]'))
await r.clear(1800)
await r.overlay()
await r.focus(
  steps(),
  t(
    'I primi passi: si spuntano da soli mentre lavoriamo',
    'The first steps: they tick themselves off as we work'
  ),
  'below',
  { pad: 4 }
)

// ============ 2. la carta coltura
await r.title(t('La carta coltura', 'The crop card'))
await r.click(steps().locator('button.primary'))
await r.clear(400)
await r.type(S.card)
await r.wait(400)
await r.focus(dialog(), t('Una carta, formato poker', 'A card, poker size'), 'right', { pad: 0 })
await r.click(dialog().locator('button[type=submit]'))
await r.clear(1500)
await r.overlay()

// le icone, prima di tutto: sei colture e la moneta
await r.click(tool('tool.image'))
await r.clear(800)
await r.click(dialog().getByRole('button', { name: T['assetPicker.importIcons'] }))
await r.clear(1500)
for (const [q] of S.icons) {
  await fill(dialog().getByPlaceholder(T['icons.search']), q, { tab: false })
  await r.wait(900)
  await r.click(dialog().getByText(q, { exact: true }).first(), { after: 400 })
}
const names = dialog().locator('.icon-chosen-row input')
for (const [i, [, n]] of S.icons.entries())
  if (n !== S.icons[i][0]) await fill(names.nth(i), n, { tab: false })
await r.focus(
  dialog().locator('.icon-chosen-row').first().locator('xpath=..'),
  t(
    'Sei colture e una moneta da game-icons.net, con i nomi in italiano',
    'Six crops and a coin from game-icons.net'
  ),
  'left',
  { pad: 4 }
)
await r.click(dialog().locator('button.primary'))
await r.clear(1500)
await r.click(dialog().locator(`[title*="${S.icons[0][1]}"]`).first())
await r.clear(1000)
// l'icona della coltura: cambia da carta a carta, quindi Colonna
await fill(field(T['prop.name']), L.icon)
await place(14, 18, 35, 35)
await r.focus(
  props.locator('.value-source').first(),
  t(
    'L’icona cambia da carta a carta: Colonna «' + L.icon + '». Il grano è solo l’anteprima',
    'The icon changes from card to card: Column “' + L.icon + '”. The wheat is just a preview'
  ),
  'left',
  { pad: 4 }
)

// lo sfondo c'è già, in fondo all'elenco: si rinomina e si colora
await r.click(layer('background'), { after: 400 })
await fill(field(T['prop.name']), L.bg)
await fillColor('#EBD9A0')
await r.focus(
  layer(L.bg),
  t(
    'Lo sfondo c’è già in ogni template nuovo. Tra poco il colore lo deciderà il tipo',
    'Every new template already has a background. Soon the type will decide its color'
  ),
  'right',
  { pad: 4 }
)

// nome in alto
await r.click(layer(L.icon), { after: 400 })
await text(L.name, { size: 16, weight: 800, color: '#3B2A14', box: [6, 6, 51, 10] })
await fill(field(T['prop.text']), S.crops[0][0])
await r.focus(
  props.locator('.value-source').first(),
  t('Il nome: Colonna. Ogni coltura ha il suo', 'The name: Column. Each crop has its own'),
  'left',
  { pad: 4 }
)

// il riquadro dei numeri e le etichette: Fissi
await r.click(layer(L.bg), { after: 400 })
await rect(L.panel, { color: '#FFFDF6', box: [6, 58, 51, 25], radius: 3 })
await r.click(layer(L.panel), { after: 300 })
await text(L.valueLabel, {
  fixedText: S.valueWord,
  size: 8,
  weight: 700,
  color: '#7A6A4F',
  box: [9, 76, 20, 5]
})
await text(L.costLabel, {
  fixedText: S.costWord,
  size: 8,
  weight: 700,
  color: '#7A6A4F',
  box: [34, 76, 20, 5]
})
await r.focus(
  source('fixed'),
  t(
    'Riquadro ed etichette sono uguali su tutte le carte: Fisso. Così non diventano campi del set',
    'The panel and labels are the same on every card: Fixed. So they don’t become set fields'
  ),
  'left',
  { pad: 4 }
)
await text(L.value, { size: 22, weight: 900, color: '#3B2A14', box: [9, 60, 20, 15] })
await fill(field(T['prop.text']), '1')
await text(L.cost, { size: 22, weight: 900, color: '#8A5A12', box: [34, 60, 20, 15] })
await fill(field(T['prop.text']), `{${S.coin}} 1`)
await r.focus(
  props.locator('.value-source').first(),
  t(
    'Valore e costo: Colonna. Nel costo, l’icona della moneta prima del numero',
    'Value and cost: Column. In the cost, the coin icon before the number'
  ),
  'left',
  { pad: 4 }
)

// il tipo: un livello Valore
await r.click(tool('tool.value'))
await r.clear(500)
await fill(field(T['prop.name']), L.type)
await r.focus(
  layer(L.type),
  t(
    'Il tipo non si vede sulla carta, decide solo il colore: un livello Valore',
    'The type is not drawn on the card, it only decides the color: a Value layer'
  ),
  'right',
  { pad: 4 }
)
await r.focus(
  layer(L.type),
  t(
    'Così è chiaro a cosa serve, e la formula dello sfondo lo trova',
    'This way its purpose is clear, and the background formula can find it'
  ),
  'right',
  { pad: 4 }
)

// la formula dello sfondo con l'assistente
await r.title(t('Il colore, con l’assistente formule', 'The color, with the formula assistant'))
await r.click(layer(L.bg), { after: 400 })
await setSource('formula')
await r.click(props.locator('.value-source button.fx-button').first())
await r.clear(800)
// l'assistente parte dal valore di adesso, il colore fisso: Ricomincia porta alle schede
await r.click(fxd().getByRole('button', { name: T['fx.startOver'], exact: true }), { after: 600 })
await r.click(fxd().locator('.fx-card').filter({ hasText: T['fx.card.if'] }).first())
await r.wait(600)
await r.focus(sentence(), t('Se … allora … altrimenti …', 'If … then … otherwise …'), 'below', {
  pad: 6
})
// la condizione: tipo uguale a orto
await r.click(leaf(0), { after: 400 })
await r.click(
  picker()
    .locator('.fx-list button')
    .filter({ hasText: new RegExp(`^${L.type}`) })
    .first(),
  { after: 500 }
)
await sentence().locator('select').first().selectOption({ label: T['fx.op.='] })
await r.wait(500)
/** un testo nello spazio scelto */
async function words(loc, value) {
  await r.click(loc, { after: 400 })
  const edit = picker().locator('.fx-compose-closed button')
  if (await edit.count()) await r.click(edit.first(), { after: 400, ms: 450 })
  let area = picker().locator('.fx-compose textarea')
  let enter = false
  // uno spazio che vale un numero apre la scheda Numero: il testo ha la sua scheda
  if (!(await area.count())) {
    await r.click(fxTab('fx.tab.text'), { after: 400 })
    area = picker().locator('.fx-text-tab textarea')
    enter = true
  }
  await area.focus()
  await win.keyboard.press('Control+A')
  await r.type(value)
  await r.wait(400)
  if (enter) await win.keyboard.press('Enter')
  await r.wait(500)
}
await words(leaf(1), S.garden)
/** un colore nello spazio scelto: la scheda Colore, il quadratino, il codice e Usa */
async function hue(loc, hex) {
  await r.click(loc, { after: 400 })
  await r.click(picker().locator('.fx-tab-body .color-swatch').first(), { after: 500 })
  const input = win.locator('.color-popover input.color-hex').first()
  await input.focus()
  await win.keyboard.press('Control+A')
  await r.type(hex)
  await win.keyboard.press('Enter')
  await r.wait(500)
  // un clic sul titolo chiude il quadratino senza chiudere l'assistente
  await r.click(picker().locator('.fx-picker-title').first(), { after: 300 })
  await r.click(picker().locator('.fx-tab-body button.primary').first(), { after: 500 })
}
await hue(leaf(2), '#C9DFB0')
await hue(leaf(3), '#EBD9A0')
await r.focus(
  sentence(),
  t(
    'Se il tipo è «' + S.garden + '» lo sfondo è verde, altrimenti giallo grano',
    'If the type is “' + S.garden + '” the background is green, otherwise wheat yellow'
  ),
  'below',
  { pad: 6 }
)
await r.click(fxd().getByRole('button', { name: T['fx.apply'], exact: true }))
await r.wait(700)
await r.focus(
  field(T['source.formula']),
  t('La formula, scritta dall’assistente', 'The formula, written by the assistant'),
  'left',
  { pad: 4 }
)
await save()

// il retro: tutto Fisso
await r.title(t('Il retro', 'The back'))
await r.click(
  win
    .locator('.editor-toolbar button, .editor-header button')
    .filter({ hasText: new RegExp(`^${T['preview.back']}$`) })
    .first(),
  { after: 900 }
)
await r.click(layer('back_background'), { after: 400 })
await fill(field(T['prop.name']), L.backBg)
await setSource('fixed')
await fillColor('#E9C46A')
await r.click(tool('tool.image'))
await r.clear(800)
await r.click(dialog().locator(`[title*="${S.icons[0][1]}"]`).first())
await r.clear(1000)
await fill(field(T['prop.name']), L.backIcon)
await setSource('fixed')
await place(14, 14, 35, 35)
await text(L.backTitle, {
  fixedText: S.project,
  size: 22,
  weight: 900,
  color: '#3B2A14',
  box: [4, 56, 55, 14]
})
await r.focus(
  stage(),
  t(
    'Sfondo, icona e titolo del gioco: tutti Fissi, il retro è uguale per tutte le carte',
    'Background, icon and game title: all Fixed, the back is the same for every card'
  ),
  'left',
  { pad: 0 }
)
await r.click(
  win
    .locator('.editor-toolbar button, .editor-header button')
    .filter({ hasText: new RegExp(`^${T['preview.front']}$`) })
    .first(),
  { after: 700 }
)
await save()

// ============ 3. il set delle colture
await r.title(t('Il set delle colture', 'The crop set'))
await r.click(steps().locator('button.primary'))
await r.clear(400)
await r.type(S.cards)
await r.wait(400)
await r.focus(
  dialog(),
  t(
    'Le colonne nascono dai livelli Colonna e Valore del template: niente + Campo',
    'The columns come from the template’s Column and Value layers: no + Field needed'
  ),
  'right',
  { pad: 0 }
)
await r.click(dialog().locator('button[type=submit]'))
await r.clear(1800)
await r.overlay()
async function quickly(on) {
  if (process.env.FAST) return
  if (on) {
    r._type = r.type
    r._wait = r.wait
    const w = r._wait.bind(r)
    r.type = (text) => win.keyboard.type(text, { delay: 18 })
    r.wait = (ms) => w(Math.min(ms, 150))
  } else {
    r.type = r._type
    r.wait = r._wait
  }
}
for (const [i, [name, icon, type, value, cost]] of S.crops.entries()) {
  await addCard(i === 0 ? 'first' : 'card')
  if (i === 0)
    await r.focus(
      form.first(),
      t('Il modulo della carta: un campo per colonna', 'The card form: one field per column'),
      'left',
      { pad: 4 }
    )
  if (i === 2) {
    await r.focus(
      grid(),
      t('Le altre colture, più in fretta', 'The other crops, faster'),
      'right',
      { pad: 6 }
    )
    await quickly(true)
  }
  await fill(cardField(L.name), name)
  await fill(cardField(L.icon), icon)
  await fill(cardField(L.type), type)
  await fill(cardField(L.value), value)
  await fill(cardField(L.cost), `{${S.coin}} ${cost}`)
  await fill(copiesField(), '2')
  if (i === 0)
    await r.focus(
      copiesField(),
      t('Copie: 2. Sei righe danno dodici carte', 'Copies: 2. Six rows make twelve cards'),
      'left',
      { pad: 4 }
    )
}
await quickly(false)
await gridView()
await r.focus(
  grid(),
  t(
    'Sei colture, due copie ciascuna: il colore segue il tipo',
    'Six crops, two copies each: the color follows the type'
  ),
  'right',
  { pad: 6 }
)
await r.click(win.getByRole('button', { name: T['preview.back'], exact: true }).first(), {
  after: 800
})
await r.focus(
  win.locator('.preview-card').first(),
  t('E il retro, uguale per tutte', 'And the back, the same for all'),
  'left',
  { pad: 4 }
)
await r.click(win.getByRole('button', { name: T['preview.front'], exact: true }).first(), {
  after: 600
})
await save()

// ============ 4. la moneta
await r.title(t('La moneta', 'The coin'))
await newTemplate(S.coin, 'token')
await r.focus(dialog(), t('Segnalino: tondo, 25 mm', 'Token: round, 25 mm'), 'right', { pad: 0 })
await r.click(dialog().locator('button[type=submit]'))
await r.clear(1500)
await r.overlay()
await r.click(layer('background'), { after: 400 })
await setSource('fixed')
await fillColor('#E9C46A')
await text(L.value, { size: 30, weight: 900, color: '#6B4A12', box: [2.5, 2.5, 20, 20] })
await fill(field(T['prop.text']), '1')
await save()
await newSet(S.coins, S.coin)
await r.click(dialog().locator('button[type=submit]'))
await r.clear(1500)
await r.overlay()
for (const [i, [v, n]] of [
  ['1', '5'],
  ['5', '3']
].entries()) {
  await addCard(i === 0 ? 'first' : 'token')
  await fill(cardField(L.value), v)
  await fill(copiesField(), n)
}
await gridView()
await r.focus(
  grid(),
  t('Due righe: cinque monete da 1 e tre da 5', 'Two rows: five 1-coins and three 5-coins'),
  'right',
  { pad: 6 }
)
await save()

// ============ 5. la plancia
await r.title(t('La plancia', 'The board'))
await newTemplate(S.board, 'board')
const dimField = (label) =>
  dialog().locator('label').filter({ hasText: label }).locator('input').first()
await fill(dimField(T['prop.width']), '240')
await fill(dimField(T['prop.height']), '160')
await r.focus(dialog(), t('Plancia: 240 × 160 mm', 'Board: 240 × 160 mm'), 'right', { pad: 0 })
await r.click(dialog().locator('button[type=submit]'))
await r.clear(1500)
await r.overlay()
await r.click(layer('background'), { after: 400 })
await setSource('fixed')
await fillColor('#DCC9A3')
await text(L.title, {
  fixedText: S.project,
  size: 30,
  weight: 900,
  color: '#3B2A14',
  box: [10, 6, 220, 16]
})
// i quattro campi
await r.click(tool('tool.grid'))
await r.clear(500)
await fill(field(T['prop.name']), L.fields)
await setSource('fixed').catch(() => {})
await choose(field(T['prop.cell']), 'square')
await fill(field(T['prop.rows']), '2')
await fill(field(T['prop.columns']), '2')
await place(12, 28, 120, 120)
await r.focus(
  stage(),
  t('Un livello griglia: 2 × 2, i quattro campi', 'A grid layer: 2 × 2, the four fields'),
  'left',
  { pad: 0 }
)
// il tracciato da 1 a 20
await r.click(tool('tool.grid'))
await r.clear(500)
await fill(field(T['prop.name']), L.track)
await setSource('fixed').catch(() => {})
await choose(field(T['prop.cell']), 'square')
await fill(field(T['prop.rows']), '5')
await fill(field(T['prop.columns']), '4')
await place(142, 28, 88, 110)
await r.click(props.getByRole('button', { name: T['editor.gridContentText'], exact: true }))
// l'assistente si apre da solo sul testo nuovo: il numero della casella va già bene, quindi Annulla
await fxd()
  .waitFor({ timeout: 4000 })
  .catch(() => {})
if (
  await fxd()
    .isVisible()
    .catch(() => false)
)
  await r.click(fxd().getByRole('button', { name: T['dialog.cancel'], exact: true }), {
    after: 800
  })
await r.click(layer(L.track), { after: 400 })
await r.focus(
  stage(),
  t(
    'Il tracciato: 20 caselle e «Testo in ogni casella», che scrive il numero da 1 a 20',
    'The track: 20 cells and “Text in each cell”, which writes the number from 1 to 20'
  ),
  'left',
  { pad: 0 }
)
await save()
await newSet(S.boards, S.board)
await r.click(dialog().locator('button[type=submit]'))
await r.clear(1500)
await r.overlay()
await addCard('first')
await gridView()
await r.focus(
  grid(),
  t(
    'Tutto è Fisso: il set ha una riga sola, una plancia',
    'Everything is Fixed: the set has a single row, one board'
  ),
  'right',
  { pad: 6 }
)
await save()

// ============ 6. il dado
await r.title(t('Il dado', 'The die'))
await newTemplate(S.die, 'die')
await r.click(dialog().locator('button[type=submit]'))
await r.clear(1500)
await r.overlay()
await r.click(layer('background'), { after: 400 })
await setSource('fixed')
await fillColor('#E8A27C')
await r.click(tool('tool.image'))
await r.clear(800)
await r.click(dialog().locator(`[title*="${S.icons[0][1]}"]`).first())
await r.clear(1000)
await fill(field(T['prop.name']), L.face)
await place(2, 2, 12, 12)
await save()
await newSet(S.dice, S.die)
await r.click(dialog().locator('button[type=submit]'))
await r.clear(1500)
await r.overlay()
await quickly(true)
for (const [i, [, icon]] of S.crops.entries()) {
  await addCard(i === 0 ? 'first' : 'die')
  await fill(cardField(L.face), icon)
}
await quickly(false)
await gridView()
await r.focus(
  grid(),
  t('Sei righe, sei facce: una coltura per faccia', 'Six rows, six faces: one crop per face'),
  'right',
  { pad: 6 }
)
await save()

// ============ 7. il regolamento
await r.title(t('Il regolamento', 'The rulebook'))
await r.click(
  win
    .locator(
      '[title="' + T['sidebar.newDocument'] + '"], [data-tip="' + T['sidebar.newDocument'] + '"]'
    )
    .first()
)
await r.clear(1200)
await r.overlay()
const editor = () => win.locator('.document-editor .markup-field textarea').first()
const docPreview = () => win.locator('.document-preview').first()
const tb = (key) =>
  win.locator('.document-toolbar button', { hasText: new RegExp(`^${T[key]}$`) }).first()
async function lines(rows) {
  for (const [i, row] of rows.entries()) {
    if (row) await r.type(row)
    await win.keyboard.press('Escape')
    if (i < rows.length - 1) await win.keyboard.press('Enter')
    await r.wait(150)
  }
  await r.wait(400)
}
await r.click(editor(), { after: 300 })
await quickly(true)
await lines(S.rules)
await quickly(false)
await r.focus(
  docPreview(),
  t(
    'Il testo in Markdown, con le icone del gioco: {moneta} è l’icona della moneta',
    'Text in Markdown, with the game icons: {coin} is the coin icon'
  ),
  'left',
  { pad: 0 }
)
// l'anatomia della carta: le parti della carta con le etichette
await editor().focus()
await win.keyboard.press('Control+End')
await lines(S.cardsTitle)
await r.click(tb('documents.anatomy'))
await r.clear(900)
await r.click(dialog().getByText(S.crops[4][0], { exact: true }).first(), { after: 500 })
const layerRow = (n) =>
  dialog()
    .locator('.anatomy-layer')
    .filter({ has: win.locator('label', { hasText: new RegExp(`^\\s*${n}\\s*$`) }) })
    .first()
await quickly(true)
for (const [n, label] of S.anatomy) {
  await r.click(layerRow(n).locator('input[type=checkbox]'), { after: 200, ms: 350 })
  await fill(layerRow(n).locator('textarea'), label, { tab: false })
}
await quickly(false)
await r.focus(
  dialog().locator('.anatomy-layers').first(),
  t(
    'L’anatomia della carta: si spuntano le parti e si scrivono le etichette',
    'The card anatomy: tick the parts and write the labels'
  ),
  'left',
  { pad: 4 }
)
await r.click(dialog().locator('button.primary').last())
await r.clear(1000)

// lo schema del tavolo apparecchiato: plancia, mazzo coperto, mercato, monete e dado
await editor().focus()
await win.keyboard.press('Control+End')
await lines(S.setupTitle)
await r.click(tb('documents.setup'))
await r.clear(900)
const add = (label) => dialog().getByRole('button', { name: label, exact: true })
const pos = dialog().locator('.setup-props input')
/** aggiunge una carta o un mazzo dal set, dal lato e dalla riga scelti, e la mette in x, y (mm) */
async function piece(kind, set, { row = 0, back = false, x, y, label }) {
  await r.click(add(kind === 'deck' ? (it ? 'Mazzo' : 'Deck') : it ? 'Carta' : 'Card'))
  await r.clear(700)
  await choose(dialog().locator('select').first(), set)
  if (back)
    await r.click(dialog().getByRole('button', { name: T['documents.back'], exact: true }).first())
  await r.click(dialog().locator('.insert-card-grid button').nth(row), { after: 300 })
  await r.click(dialog().locator('button.primary').last())
  await r.clear(600)
  await fill(pos.nth(0), String(x))
  await fill(pos.nth(1), String(y))
  if (label) await fill(dialog().locator('.setup-text textarea').last(), label, { tab: false })
}
await quickly(true)
await piece('card', S.boards, { x: 0, y: 0 })
await piece('deck', S.cards, { back: true, x: 252, y: 0, label: S.table.deck })
await piece('card', S.cards, { row: 0, x: 325, y: 0, label: S.table.market })
await piece('card', S.cards, { row: 2, x: 395, y: 0 })
await piece('deck', S.coins, { row: 0, x: 255, y: 105, label: S.table.coins })
await piece('deck', S.coins, { row: 1, x: 290, y: 105 })
await piece('card', S.dice, { row: 0, x: 335, y: 110, label: S.table.die })
await quickly(false)
await r.click(dialog().getByRole('button', { name: T['editor.zoomFit'], exact: true }).first())
await r.wait(600)
await r.focus(
  dialog(),
  t(
    'Il tavolo apparecchiato: plancia, mazzo coperto, due carte scoperte, monete e dado',
    'The table set up: board, face-down deck, two face-up cards, coins and die'
  ),
  'none',
  { pad: 0, dim: false }
)
await r.click(dialog().locator('button.primary').last())
await r.clear(1000)
await r.focus(
  docPreview(),
  t(
    'Il regolamento: testo, anatomia della carta e schema del tavolo',
    'The rulebook: text, card anatomy and table setup'
  ),
  'left',
  { pad: 0 }
)

// ============ 8. stampare
await r.title(t('Stampare', 'Printing'))
await r.click(win.locator('header.toolbar').getByText(T['app.export'], { exact: true }).first())
await r.clear(800)
const goal = (g) =>
  dialog()
    .locator('.export-goal')
    .filter({ hasText: T['export.goal.' + g] })
    .first()
await r.click(goal('home'))
await r.wait(600)
await r.focus(
  dialog().locator('.export-set-chips').first(),
  t(
    'Stampare a casa: tutti i set in un PDF, con i segni di taglio',
    'Print at home: every set in one PDF, with crop marks'
  ),
  'below',
  { pad: 4 }
)
// l'anteprima a lato: le pagine come verranno stampate
const live = () => dialog().locator('.live-preview').first()
async function ready() {
  await r.wait(400)
  for (let i = 0; i < 80 && (await live().locator('.live-preview-wait').count()); i++)
    await win.waitForTimeout(200)
}
await ready()
await r.focus(
  live(),
  t(
    'L’anteprima a lato mostra le pagine prima di stampare: carte, monete, plancia e dado',
    'The preview on the side shows the pages before printing: cards, coins, board and die'
  ),
  'left',
  { pad: 4 }
)
const nextPage = live().locator('.live-preview-nav button').last()
for (let i = 0; i < 3 && (await nextPage.isEnabled().catch(() => false)); i++) {
  await r.click(nextPage, { after: 400 })
  await ready()
  await r.wait(900)
}
await r.clear(400)
const run = dialog().getByRole('button', { name: T['export.run'], exact: true })
await r.click(run)
await win.waitForTimeout(1000)
for (let i = 0; i < 240 && !(await run.isEnabled()); i++) await win.waitForTimeout(500)
await r.wait(800)
await r.focus(
  dialog().locator('.export-result').first(),
  t('Il PDF è nella cartella export del progetto', 'The PDF is in the project’s export folder'),
  'above'
)

// ============ 9. Tabletop Simulator
await r.title(t('Tabletop Simulator', 'Tabletop Simulator'))
await r.click(goal('tts'))
await r.wait(800)
// l'anteprima resta sulla pagina vista prima: si torna alla prima
const firstPage = live().locator('.live-preview-nav button').first()
while ((await firstPage.count()) && (await firstPage.isEnabled())) await firstPage.click()
await ready()
await r.focus(
  dialog().locator('.tts-table').first(),
  t(
    'Ogni set diventa un oggetto, dal tipo del suo template: mazzo, segnalini, plancia, dado',
    'Each set becomes an object, from its template’s kind: deck, tokens, board, die'
  ),
  'right',
  { pad: 4 }
)
await r.click(run)
await win.waitForTimeout(1000)
for (let i = 0; i < 240 && !(await run.isEnabled()); i++) await win.waitForTimeout(500)
await r.wait(800)
await r.focus(
  dialog().locator('.export-result').first(),
  t(
    'Pronto per Tabletop Simulator: si apre dagli Oggetti salvati',
    'Ready for Tabletop Simulator: open it from Saved Objects'
  ),
  'above'
)
await r.click(dialog().getByRole('button', { name: T['export.close'], exact: true }))
await r.wait(600)
await r.clear()
// qui, al montaggio, il filmato di Luca in Tabletop Simulator
console.log('TTS_CUT', Date.now())
await r.title(
  t(
    'Tutto il resto è nella guida: stella.lucadj.eu',
    'Everything else is in the guide: stella.lucadj.eu'
  ),
  3800
)
await r.clear(600)
const p = await r.finish()
console.log('END', Date.now())
console.log('VIDEO', p)
