// Video 28, approfondimento: le statistiche del set (circa 11 minuti, 12 capitoli, senza voce). Sul
// progetto «Schermaglia» di progetto-statistiche.mjs: il pannello Statistiche con le sue schede (Valori,
// Incrocio, Dispersione, Pesca, Dadi, Testi, Panoramica), il filtro con un clic, Copia, i colori della
// tabella e la finestra mobile. La tabella copiata si mostra incollata in LibreOffice Calc: la si
// converte in immagine con soffice e la si mostra sopra l'app.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node --experimental-strip-types --no-warnings scripts/video/statistiche.mjs it|en
// FAST=1 accorcia attese e scrittura; SNAP=<cartella> salva una schermata dopo ogni testo (testi.tsv
// accanto, per lo storyboard); SHOT=<file.png> salva una schermata quando un elemento non si trova.
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { docs } from '../guide/lib.mjs'
import { launch, mockOpen, OUT } from './lib.mjs'
import { make } from './progetto-statistiche.mjs'
const lang = process.argv[2] || 'it'
const it = lang === 'it'
const t = (a, b) => (it ? a : b)
const project = `${docs(lang)}/Stella/${it ? 'Schermaglia' : 'Skirmish'}`
const N = await make(project, lang)
const { C, V, F } = N
const r = await launch({ lang, ...(process.env.UD ? { ud: process.env.UD } : {}) })
const { win, T } = r
// il pannello parte chiuso e con le spiegazioni aperte, come per chi lo apre la prima volta
await win.evaluate(() => {
  try {
    for (const k of Object.keys(localStorage))
      if (k.startsWith('stats') || k.startsWith('panelWidth')) localStorage.removeItem(k)
  } catch {
    // niente
  }
})
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
let snaps = 0
const SNAP = process.env.SNAP
if (SNAP) {
  mkdirSync(SNAP, { recursive: true })
  writeFileSync(`${SNAP}/testi.tsv`, '')
}
const snap = async (text, kind = 'focus') => {
  if (!SNAP) return
  const n = String(++snaps).padStart(3, '0')
  await win.screenshot({ path: `${SNAP}/${n}.png` })
  appendFileSync(`${SNAP}/testi.tsv`, `${n}\t${kind}\t${String(text).replace(/\s+/g, ' ')}\n`)
}
const focus0 = r.focus.bind(r)
r.focus = async (locs, text, ...rest) => {
  const out = await focus0(locs, text, ...rest)
  await snap(text)
  return out
}
const title0 = r.title.bind(r)
r.title = async (text, ...a) => {
  await r.unzoom(700)
  const out = await title0(text, ...a)
  await snap(text, 'title')
  return out
}

const panel = () => win.locator('.stats-panel').first()
const body = () => panel().locator('.stats-body').first()
const side = (name) => win.locator('.sidebar').getByText(name, { exact: true }).first()
const saveButton = () =>
  win
    .locator('header.toolbar button')
    .filter({ hasText: new RegExp(`^(${T['app.save']}|${T['app.saved']})$`) })
    .first()
const statsButton = () =>
  win.locator('.set-actions button', { hasText: new RegExp(`^${T['set.stats']}$`) }).first()
const table = () => win.locator('.data-table').first()
const grid = () => win.locator('.card-grid').first()
const tab = (key) => panel().locator('.stats-tabs button', { hasText: T[key] }).first()
/** un menu del pannello, dall'etichetta che lo precede */
const control = (key) =>
  body()
    .locator('.stats-controls label')
    // il testo di un'etichetta comprende le voci del suo menu: si confronta solo l'inizio
    .filter({ hasText: new RegExp(`^${T[key]}`) })
    .first()
    .locator('select')
    .first()
const stepper = (key) => body().locator('.stats-stepper').filter({ hasText: T[key] }).first()
const plus = (key) => stepper(key).locator('button').nth(1)
const minus = (key) => stepper(key).locator('button').nth(0)
const row = (text) =>
  body()
    .locator('.stats-table tbody tr')
    .filter({ has: win.locator('td', { hasText: new RegExp(`^${text}( ◦)?$`) }) })
    .first()

const center = (loc) =>
  loc
    .first()
    .evaluate((el) => el.scrollIntoView({ block: 'center' }))
    .then(() => r.wait(150))
async function choose(loc, value) {
  await center(loc)
  await r.click(loc, { after: 200, before: 200, ms: 450 })
  await win.keyboard.press('Escape')
  await loc.selectOption(value)
  await r.wait(700)
}
async function open(name) {
  await r.click(side(name))
  await r.clear(1000)
  await r.overlay()
}
async function view(key) {
  const b = win.locator('.set-header .segmented button').filter({ hasText: T[key] }).first()
  await b.scrollIntoViewIfNeeded()
  await r.click(b, { after: 900 })
  const want = key === 'set.table' ? '.data-table' : '.card-grid'
  if (!(await win.locator(want).first().isVisible())) await r.click(b, { after: 900 })
  await win.locator(want).first().waitFor({ timeout: 8000 })
}
async function openTab(key) {
  await r.click(tab(key), { after: 900, ms: 500 })
  await body().evaluate((e) => (e.scrollTop = 0))
}
/** il riquadro «Che cosa dice questa scheda»: lo si chiude dopo averlo letto */
async function closeExplain() {
  const b = body().locator('.stats-explain.open .stats-explain-toggle').first()
  if (await b.count()) await r.click(b, { after: 500, ms: 400 })
}
async function step(button, times = 1) {
  for (let i = 0; i < times; i++) await r.click(button, { after: 450, before: 150, ms: 350 })
}
async function scrollBody(y) {
  await body().evaluate((e, y) => e.scrollTo({ top: y, behavior: 'smooth' }), y)
  await r.wait(700)
}

// ================= inizio
await r.overlay()
await r.title(t('Le statistiche del set', 'Set statistics'))
await r.title(
  t(
    'Contare, confrontare, stimare la pesca e i dadi: tutto per bilanciare il gioco',
    'Count, compare, estimate draws and dice: everything to balance your game'
  ),
  5200
)
await r.clear()
await mockOpen(r.app, project)
await r.click(win.getByText(T['start.openProject']))
await r.clear(2200)
await r.overlay()

// ---- 1. il pannello
await r.title(t('Il pannello', 'The panel'))
await r.clear()
await open(N.units)
await view('set.grid')
await r.focus(
  grid(),
  t(
    'Schermaglia: 18 unità di tre fazioni, con costo, forza, difesa e un’abilità',
    'Skirmish: 18 units from three factions, with cost, strength, defense and an ability'
  ),
  'none',
  { pad: 4, dim: false }
)
await view('set.table')
await r.focus(
  table(),
  t(
    'Alcune carte hanno più copie: la colonna Copie',
    'Some cards have more copies: the Copies column'
  ),
  'below',
  { pad: 4 }
)
await r.click(statsButton(), { after: 1200 })
await r.focus(
  panel(),
  t(
    'Statistiche apre un pannello accanto alla tabella: le carte restano in vista',
    'Statistics opens a panel next to the table: the cards stay in view'
  ),
  'left',
  { pad: 4 }
)
await r.focus(
  panel().locator('.stats-tabs').first(),
  t('Sette schede, una per ogni domanda', 'Seven tabs, one for each question'),
  'below',
  { pad: 4 }
)

// ---- 2. valori
await r.title(t('Valori', 'Values'))
await r.clear()
await closeExplain()
await choose(control('stats.field'), C.faction)
await r.focus(
  body().locator('.stats-table').first(),
  t(
    'Quante carte per fazione: 11 del Regno, 10 del Clan, 8 dell’Ombra',
    'How many cards per faction: 11 Kingdom, 10 Clan, 8 Shadow'
  ),
  'left',
  { pad: 4 }
)
const copies = panel().locator('.stats-scope label.check input').first()
await r.click(copies, { after: 900, ms: 450 })
await r.focus(
  panel().locator('.stats-scope').first(),
  t(
    'Senza Conta le copie si contano le righe: 6 per fazione',
    'Without Count the copies the rows are counted: 6 per faction'
  ),
  'below',
  { pad: 4 }
)
await r.click(copies, { after: 900, ms: 450 })
await choose(control('stats.field'), C.cost)
await r.focus(
  body().locator('.stats-tiles').first(),
  t(
    'Un campo di numeri: somma, media, mediana, moda, minimo, massimo e deviazione standard',
    'A number field: sum, average, median, mode, minimum, maximum and standard deviation'
  ),
  'left',
  { pad: 4 }
)
{
  // i suggerimenti del sistema non compaiono nella registrazione: il testo va nel riquadro
  const tile = body().locator('.stats-tile').nth(1)
  const tip = await tile.getAttribute('title')
  await r.zoom(tile, { max: 2 })
  await r.focus(
    tile,
    t(
      'Passandoci sopra, ogni riquadro spiega che cosa misura: ',
      'Hover any box and it explains what it measures: '
    ) + `«${tip}»`,
    'below',
    { pad: 4 }
  )
  await r.unzoom()
}
const gaps = body().locator('p.small').filter({ hasText: /4/ }).first()
await r.focus(
  gaps,
  t(
    'Numeri mancanti: nessuna carta costa 4. È un buco voluto?',
    'Missing numbers: no card costs 4. Is that gap on purpose?'
  ),
  'below',
  { pad: 4 }
)
await r.focus(
  row('2'),
  t(
    'Il pallino: 4 di queste carte hanno il costo vuoto nel foglio e prendono il 2 del modello',
    'The small circle: 4 of these cards have an empty cost in the sheet and take the template’s 2'
  ),
  'left',
  { pad: 4 }
)
const tpl = table().locator('.tpl-value').first()
await r.focus(
  tpl,
  t(
    'In tabella quelle celle mostrano il valore del modello, in grigio corsivo',
    'In the table those cells show the template’s value, in grey italics'
  ),
  'right',
  { pad: 6 }
)

// ---- 3. filtrare con un clic
await r.title(t('Filtrare con un clic', 'Filter with a click'))
await r.clear()
await r.click(row('1'), { after: 1100 })
await r.focus(
  win.locator('.stats-filter-bar').first(),
  t(
    'Un clic su un valore: la tabella mostra solo le carte di costo 1',
    'Click a value: the table shows only the cards that cost 1'
  ),
  'below',
  { pad: 4 }
)
await view('set.grid')
await r.focus(grid(), t('Anche nella griglia delle carte', 'In the card grid too'), 'none', {
  pad: 4,
  dim: false
})
await r.click(win.locator('.stats-filter-bar button').first(), { after: 900 })
await r.focus(grid(), t('Mostra tutti toglie il filtro', 'Show all removes the filter'), 'none', {
  pad: 4,
  dim: false
})
await view('set.table')

// ---- 4. incrocio
await r.title(t('Incrocio', 'Cross table'))
await r.clear()
await openTab('stats.tab.pivot')
await choose(control('stats.pivotRows'), C.faction)
await choose(control('stats.pivotCols'), C.cost)
await choose(control('stats.inCells'), 'count')
await r.focus(
  body().locator('.stats-pivot').first(),
  t(
    'Fazione per costo: quante carte di ogni fazione a ogni costo',
    'Faction by cost: how many cards each faction has at every cost'
  ),
  'left',
  { pad: 4 }
)
await choose(control('stats.inCells'), 'mean')
await choose(control('stats.of'), C.strength)
await r.focus(
  body().locator('.stats-pivot').first(),
  t(
    'Nelle celle, la media della forza: a costo 1 il Clan ha forza 3, le altre fazioni 1',
    'In the cells, the average strength: at cost 1 the Clan has strength 3, the other factions 1'
  ),
  'left',
  { pad: 4 }
)
await choose(control('stats.of'), C.power)
await r.focus(
  control('stats.of'),
  t(
    'Con la ƒ i campi calcolati: la potenza è un livello Valore, forza + difesa',
    'The ƒ marks computed fields: power is a Value layer, strength + defense'
  ),
  'below',
  { pad: 4 }
)
await r.click(body().locator('.stats-pivot td.pick').first(), { after: 1000 })
await r.focus(
  win.locator('.stats-filter-bar').first(),
  t(
    'Anche qui un clic su una cella mostra le sue carte',
    'Here too, clicking a cell shows its cards'
  ),
  'below',
  { pad: 4 }
)
await r.click(win.locator('.stats-filter-bar button').first(), { after: 700 })

// ---- 5. dispersione
await r.title(t('Dispersione', 'Scatter'))
await r.clear()
await openTab('stats.tab.scatter')
await choose(control('stats.axisX'), C.cost)
await choose(control('stats.axisY'), C.strength)
await r.focus(
  body().locator('.stats-scatter').first(),
  t(
    'Costo in orizzontale, forza in verticale: un punto per carta, la linea è la tendenza',
    'Cost across, strength up: one dot per card, the line is the trend'
  ),
  'left',
  { pad: 4 }
)
// il Berserker: il punto più in alto tra quelli più a sinistra
const points = body().locator('.stats-scatter .point')
const berserker = await points.evaluateAll((els) => {
  const b = els.map((e) => e.getBoundingClientRect())
  const left = Math.min(...b.map((x) => x.left))
  let best = -1
  b.forEach((x, i) => {
    if (x.left - left < 4 && (best < 0 || x.top < b[best].top)) best = i
  })
  return best
})
const outlier = points.nth(berserker)
await r.focus(
  outlier,
  t(
    'I punti rossi sono lontani dalla linea: carte fuori scala, come questa',
    'The red dots are far from the line: cards out of scale, like this one'
  ),
  'right',
  { pad: 10 }
)
{
  const b = await outlier.boundingBox()
  await r.glide(b.x + b.width / 2, b.y + b.height / 2, 700)
  await win.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await r.wait(900)
}
await r.focus(
  body().locator('.stats-hover').first(),
  t(
    'Passandoci sopra si vede la carta: il Berserker costa 1 e ha forza 6',
    'Hover it to see the card: the Berserker costs 1 and has strength 6'
  ),
  'left',
  { pad: 4 }
)

// ---- 6. pesca
await r.title(t('Pesca', 'Draw'))
await r.clear()
await openTab('stats.tab.draw')
await r.focus(
  body().locator('.stats-explain').first(),
  t(
    'Conta solo quante carte peschi: non quelle che giochi o scarti',
    'Only the cards you draw count: not those you play or discard'
  ),
  'left',
  { pad: 4 }
)
await closeExplain()
await choose(control('stats.drawField'), C.cost)
await r.focus(
  stepper('stats.handSize'),
  t(
    'Quante carte nella mano iniziale e quante a ogni turno',
    'How many cards in the starting hand and how many each turn'
  ),
  'below',
  { pad: 4 }
)
await step(plus('stats.handSize'), 2)
await r.focus(
  body().locator('.stats-table').first(),
  t(
    'Probabilità di avere almeno una carta di ogni costo, nella mano e turno dopo turno',
    'The chance of having at least one card of each cost, in the hand and turn after turn'
  ),
  'left',
  { pad: 4 }
)
await step(plus('stats.atLeast'))
await r.focus(
  stepper('stats.atLeast'),
  t('Almeno quante: ora almeno 2', 'At least how many: now at least 2'),
  'below',
  { pad: 4 }
)
await step(minus('stats.atLeast'))
const mix = body().locator('.stats-mix label').filter({ hasText: N.events }).locator('input')
await r.click(mix, { after: 1000, ms: 450 })
await r.focus(
  body().locator('.stats-mix').first(),
  t(
    'Mescolato con gli Eventi: il mazzo passa da 29 a 42 carte e le probabilità scendono',
    'Shuffled together with the Events: the deck grows from 29 to 42 cards and the odds drop'
  ),
  'below',
  { pad: 4 }
)
const hand = body().locator('.stats-hand').first()
await center(hand)
await r.focus(
  hand,
  t(
    'Una mano di prova, pescata dal mazzo mescolato',
    'A sample hand, drawn from the shuffled deck'
  ),
  'above',
  { pad: 4 }
)
await r.click(hand.locator('button').first(), { after: 1100 })
await r.click(hand.locator('button').nth(1), { after: 1100 })
await r.focus(
  hand,
  t(
    'Rimescola per un’altra mano, o pesca una carta in più',
    'Shuffle again for another hand, or draw one more card'
  ),
  'above',
  { pad: 4 }
)
await r.click(mix, { after: 600, ms: 450 })

// ---- 7. dadi
await r.title(t('Dadi', 'Dice'))
await r.clear()
await open(N.dice)
await view('set.grid')
await r.focus(
  grid(),
  t(
    'Un set di dadi: ogni dado sono sei facce, qui uno d’attacco e uno di difesa',
    'A dice set: every die is six faces, here an attack die and a defense die'
  ),
  'none',
  { pad: 4, dim: false }
)
await r.focus(
  tab('stats.tab.dice'),
  t('Per i dadi, Pesca diventa Dadi', 'For dice, Draw becomes Dice'),
  'below',
  { pad: 4 }
)
await openTab('stats.tab.dice')
await closeExplain()
const dieSteppers = body().locator('.stats-stepper')
await step(dieSteppers.nth(0).locator('button').nth(1))
await step(dieSteppers.nth(1).locator('button').nth(0))
await r.focus(
  body().locator('.stats-table').first(),
  t(
    'Due dadi d’attacco: probabilità di ogni numero di spade, esatto o almeno',
    'Two attack dice: the chance of each number of swords, exactly or at least'
  ),
  'left',
  { pad: 4 }
)
await step(dieSteppers.nth(1).locator('button').nth(1))
await choose(control('stats.diceCount'), `icon:${V.shield}`)
await r.focus(
  body().locator('.stats-table').first(),
  t(
    'Si mescolano dadi diversi e si sceglie che cosa contare: ora gli scudi',
    'Mix different dice and choose what to count: now the shields'
  ),
  'left',
  { pad: 4 }
)

// ---- 8. testi
await r.title(t('Testi', 'Texts'))
await r.clear()
await open(N.units)
await view('set.table')
await openTab('stats.tab.texts')
await closeExplain()
// le icone di forza e difesa sono su tutte le carte: si leggono solo le abilità
const textField = (name) =>
  body()
    .locator('label.check')
    .filter({ hasText: new RegExp(`^${name}$`) })
    .locator('input')
    .first()
for (const f of [
  C.name,
  C.faction,
  C.cost,
  C.strength,
  C.defense,
  it ? 'icona_forza' : 'strength_icon',
  it ? 'icona_difesa' : 'defense_icon'
])
  if (
    await textField(f)
      .isChecked()
      .catch(() => false)
  )
    await r.click(textField(f), { after: 350, before: 120, ms: 300 })
await r.focus(
  body().locator('.stats-mix').first(),
  t(
    'Si scelgono i testi da leggere: qui solo le abilità',
    'Choose the texts to read: here only the abilities'
  ),
  'left',
  { pad: 4 }
)
await r.focus(
  body().locator('.stats-text-group').first(),
  t(
    'Quante icone ci sono nelle abilità, e su quante carte',
    'How many icons there are in the abilities, and on how many cards'
  ),
  'left',
  { pad: 4 }
)
await center(body().locator('.stats-text-group').nth(1))
await r.focus(
  [body().locator('.stats-text-group').nth(1), body().locator('.stats-text-group').nth(2)],
  t(
    'Poi le variabili di testo, come {furtivo}, e le parole in grassetto',
    'Then the text variables, like {stealth}, and the words in bold'
  ).replace(it ? '{furtivo}' : '{stealth}', `{${V.sneak}}`),
  'left',
  { pad: 4 }
)
await scrollBody(0)
await r.click(body().locator('.stats-text-group tbody tr').first(), { after: 1000 })
await r.focus(
  table(),
  t(
    'Un clic e restano le carte con la spada',
    'One click and only the cards with the sword are left'
  ),
  'right',
  { pad: 4 }
)
await r.click(win.locator('.stats-filter-bar button').first(), { after: 700 })

// ---- 9. panoramica
await r.title(t('Panoramica', 'Overview'))
await r.clear()
await openTab('stats.tab.overview')
await r.focus(
  body(),
  t(
    'Tutti i campi in un colpo d’occhio: valori diversi, i più frequenti, minimo e massimo',
    'All the fields at a glance: distinct values, the most common, minimum and maximum'
  ),
  'left',
  { pad: 4 }
)
await r.click(body().locator('.stats-ov').filter({ hasText: C.defense }).first(), {
  after: 1000
})
await r.focus(
  body(),
  t('Un clic su un campo lo apre in Valori', 'Click a field to open it in Values'),
  'left',
  { pad: 4 }
)

// ---- 10. copia
await r.title(t('Copia', 'Copy'))
await r.clear()
await openTab('stats.tab.pivot')
await choose(control('stats.pivotRows'), C.faction)
await choose(control('stats.pivotCols'), C.cost)
await choose(control('stats.inCells'), 'count')
const copyMenu = panel().locator('.stats-head .menu-button').first()
await r.click(copyMenu, { after: 700 })
const tsvItem = win
  .locator('.menu-panel .menu-item')
  .filter({ hasText: T['stats.copyTsv'] })
  .first()
await r.focus(
  win.locator('.menu-panel').first(),
  t(
    'Copia la tabella della scheda: per Excel e i fogli di calcolo, o in Markdown',
    'Copy the tab’s table: for Excel and spreadsheets, or as Markdown'
  ),
  'left',
  { pad: 4 }
)
await r.click(tsvItem, { after: 700 })
const tsv = await r.app.evaluate(({ clipboard }) => clipboard.readText())
const calc = await calcImage(tsv)
await showImage(
  calc,
  t(
    'Incollata in LibreOffice Calc: righe e colonne restano al loro posto',
    'Pasted into LibreOffice Calc: rows and columns stay in place'
  )
)

// ---- 11. colori della tabella
await r.title(t('Colori della tabella', 'Table colors'))
await r.clear()
await r.click(panel().locator('.stats-head .note-close').first(), { after: 900 })
const colorsBtn = win.locator('.colors-menu > button').first()
await r.click(colorsBtn, { after: 800 })
const colorsPanel = () => win.locator('.colors-menu-panel').first()
const colorField = (name) =>
  colorsPanel()
    .locator('.colors-menu-field')
    .filter({ has: win.locator('label span', { hasText: new RegExp(`^(ƒ )?${name}$`) }) })
    .first()
await r.click(colorField(C.faction).locator('input[type=checkbox]'), { after: 900, ms: 450 })
await r.focus(
  colorsPanel(),
  t(
    'Colori: si spuntano i campi, ogni valore ha il suo colore',
    'Colors: tick the fields, every value gets its own color'
  ),
  'left',
  { pad: 4 }
)
await r.click(colorField(C.cost).locator('input[type=checkbox]'), { after: 900, ms: 450 })
await r.focus(
  colorField(C.cost),
  t(
    'Per i numeri, tre fasce: dal tono più chiaro al più scuro',
    'For numbers, three bands: from the lightest shade to the darkest'
  ),
  'left',
  { pad: 4 }
)
await r.click(colorField(C.faction).locator('.colors-expand'), { after: 700, ms: 450 })
await r.click(colorField(C.faction).locator('.colors-swatch').first(), { after: 700, ms: 450 })
await r.focus(
  colorField(C.faction).locator('.colors-palette').first(),
  t('Clic su un colore per cambiarlo', 'Click a color to change it'),
  'left',
  { pad: 4 }
)
await r.click(colorField(C.faction).locator('.colors-palette .colors-swatch').nth(10), {
  after: 900,
  ms: 450
})
await r.click(win.locator('.set-header h2, .set-header').first(), { after: 700 })
await r.focus(
  table(),
  t(
    'Ogni campo colora la sua colonna: si vedono subito fazioni e costi',
    'Each field colors its own column: factions and costs stand out at once'
  ),
  'right',
  { pad: 4 }
)
await r.click(colorsBtn, { after: 800 })
await r.click(colorField(C.cost).locator('input[type=checkbox]'), { after: 700, ms: 450 })
const wholeRow = colorsPanel().locator('.columns-menu-computed input').first()
await r.click(wholeRow, { after: 900, ms: 450 })
await r.focus(
  wholeRow.locator('xpath=..'),
  t(
    'Con un solo campo si può colorare tutta la riga',
    'With a single field the whole row can be colored'
  ),
  'left',
  { pad: 4 }
)
await r.click(win.locator('.set-header').first(), { after: 700 })
await r.focus(
  win.locator('.colors-legend').first(),
  t(
    'La legenda sopra la tabella; un clic riapre i colori. Si salvano con il progetto',
    'The legend above the table; a click opens the colors again. They are saved with the project'
  ),
  'below',
  { pad: 4 }
)
await r.click(saveButton(), { after: 600 })

// ---- 12. finestra mobile
await r.title(t('Una finestra mobile', 'A floating window'))
await r.clear()
await r.click(statsButton(), { after: 1000 })
await openTab('stats.tab.values')
const detach = panel().locator('.stats-head .icon-btn').first()
await r.click(detach, { after: 1100 })
{
  const head = panel().locator('.stats-head h2').first()
  const b = await head.boundingBox()
  await r.glide(b.x + 20, b.y + b.height / 2, 600)
  await win.mouse.move(b.x + 20, b.y + b.height / 2)
  await win.mouse.down()
  for (let i = 1; i <= 20; i++) {
    await win.mouse.move(b.x + 20 - i * 12, b.y + b.height / 2 + i * 6)
    await r.wait(30)
  }
  await win.mouse.up()
  await r.wait(600)
}
await r.focus(
  panel(),
  t(
    'Staccato, il pannello diventa una finestra da spostare e ridimensionare dall’angolo',
    'Detached, the panel becomes a window you can move and resize from the corner'
  ),
  'right',
  { pad: 4 }
)
await r.click(panel().locator('.stats-head .icon-btn').first(), { after: 1000 })
await r.focus(panel(), t('Un clic e torna al suo posto', 'One click and it docks again'), 'left', {
  pad: 4
})

// ---- chiusura
await r.title(
  t(
    'Le stesse statistiche dalla riga di comando: stella stats, con --pivot e --draw',
    'The same statistics from the command line: stella stats, with --pivot and --draw'
  ),
  4600
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

/**
 * La tabella copiata, aperta in LibreOffice Calc su uno schermo a parte (Xvfb) e fotografata. Calc ci
 * mette una ventina di secondi: l'immagine si tiene per contenuto, così la prova veloce la prepara e la
 * registrazione vera la ritrova senza attese.
 */
async function calcImage(text) {
  const dir = `${OUT}/calc-${lang}`
  mkdirSync(dir, { recursive: true })
  const key = createHash('sha1').update(text).digest('hex').slice(0, 12)
  const png = `${dir}/${key}.png`
  if (existsSync(png)) return readFileSync(png).toString('base64')
  const name = t('incrocio', 'cross')
  const home = `${dir}/home`
  rmSync(home, { recursive: true, force: true })
  mkdirSync(home, { recursive: true })
  writeFileSync(`${dir}/${name}.csv`, text)
  const display = ':78'
  const xvfb = spawn('Xvfb', [display, '-screen', '0', '1400x800x24', '-nolisten', 'tcp'], {
    stdio: 'ignore'
  })
  await new Promise((ok) => setTimeout(ok, 2000))
  const env = { ...process.env, DISPLAY: display, HOME: home, SAL_FORCEDPI: '134' }
  const lo = spawn(
    'soffice',
    ['--norestore', '--nologo', '--infilter=CSV:9,34,76,1', '--calc', `${dir}/${name}.csv`],
    { env, stdio: 'ignore', detached: true }
  )
  await new Promise((ok) => setTimeout(ok, 25000))
  execFileSync('import', ['-display', display, '-window', 'root', `${dir}/shot.png`])
  // la barra dei menu, la tabella e qualche riga vuota sotto
  execFileSync('convert', [`${dir}/shot.png`, '-crop', '900x330+0+0', '+repage', png])
  try {
    process.kill(-lo.pid)
  } catch {
    // già chiuso
  }
  xvfb.kill()
  return readFileSync(png).toString('base64')
}

/** un'immagine sopra l'app, con il suo testo, poi via */
async function showImage(b64, text) {
  await win.evaluate((src) => {
    const d = document.createElement('div')
    d.id = 'v-image'
    d.style.cssText =
      'position:fixed;inset:0;background:rgba(20,24,30,.55);display:flex;align-items:center;justify-content:center;z-index:2147483000'
    const img = document.createElement('img')
    img.src = 'data:image/png;base64,' + src
    img.style.cssText =
      'width:60vw;background:#fff;border-radius:6px;box-shadow:0 12px 40px rgba(0,0,0,.35)'
    d.appendChild(img)
    document.body.appendChild(d)
  }, b64)
  await r.wait(600)
  await r.focus(win.locator('#v-image img'), text, 'below', { pad: 4, dim: false })
  await win.evaluate(() => document.getElementById('v-image')?.remove())
  await r.clear(300)
}
