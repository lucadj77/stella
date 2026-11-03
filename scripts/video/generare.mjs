// Video 29, approfondimento: generare i componenti (senza voce). Sul progetto «Schermaglia» con in più
// il set vuoto «Reclute» (progetto-reclute.mjs), tutto lo strumento Genera…: tutte le combinazioni con
// più valori per carta, ripetizioni, ordine e limiti; il filtro con {colonna_1}; copie e giri; i
// ritratti da una cartella su tutto il set; Aggiungi, Aggiorna e Sostituisci; A caso con i pesi
// valore*N, + Colonna, Tutte diverse e il seme; In sequenza con i quattro ordini; una sequenza
// sfalsata con PICK({card.number}+1; …); il controllo finale con le statistiche.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node --experimental-strip-types --no-warnings scripts/video/generare.mjs it|en
// FAST=1 accorcia attese e scrittura; SNAP=<cartella> salva una schermata dopo ogni testo (testi.tsv
// accanto, per lo storyboard); SHOT=<file.png> salva una schermata quando un elemento non si trova.
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { docs } from '../guide/lib.mjs'
import { launch, mockOpen } from './lib.mjs'
import { make } from './progetto-statistiche.mjs'
import { extend } from './progetto-reclute.mjs'
const lang = process.argv[2] || 'it'
const it = lang === 'it'
const t = (a, b) => (it ? a : b)
const project = `${docs(lang)}/Stella/${it ? 'Schermaglia' : 'Skirmish'}`
await make(project, lang)
const N = await extend(project, lang)
const { C, F, R, G } = N
const r = await launch({ lang, ...(process.env.UD ? { ud: process.env.UD } : {}) })
const { win, T } = r
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
  // la finestra Genera è più alta dello schermo: si scorre fino al tasto
  await loc
    .first()
    .scrollIntoViewIfNeeded({ timeout: 3000 })
    .catch(() => undefined)
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

const dialog = () => win.locator('[role="dialog"]').last()
const side = (name) => win.locator('.sidebar').getByText(name, { exact: true }).first()
const grid = () => win.locator('.card-grid').first()
const saveButton = () =>
  win
    .locator('header.toolbar button')
    .filter({ hasText: new RegExp(`^(${T['app.save']}|${T['app.saved']})$`) })
    .first()
const props = win.locator('aside.properties')
const layer = (n) => win.locator('.layers .layer-name', { hasText: new RegExp(`^${n}$`) }).first()

async function zoomTo(locs) {
  for (const l of [].concat(locs)) {
    const ok = await l
      .first()
      .evaluate((el) => !!el.closest('[role=dialog], aside.properties, .layers'))
      .catch(() => false)
    if (!ok) return r.unzoom()
  }
  await r.zoom(locs, { max: 1.6 })
}
/**
 * Più elementi insieme: un solo riquadro che li contiene tutti, così nessuno resta in ombra (il
 * riquadro scuro di lib.mjs lascia in luce solo il primo)
 */
async function union(locs) {
  const list = [].concat(locs)
  if (list.length < 2) return locs
  const boxes = []
  for (const l of list) {
    await l
      .first()
      .scrollIntoViewIfNeeded({ timeout: 2000 })
      .catch(() => {})
    const b = await l.first().boundingBox()
    if (b) boxes.push(b)
  }
  await win.evaluate((boxes) => {
    document.getElementById('v-union')?.remove()
    const x = Math.min(...boxes.map((b) => b.x))
    const y = Math.min(...boxes.map((b) => b.y))
    const d = document.createElement('div')
    d.id = 'v-union'
    Object.assign(d.style, {
      position: 'fixed',
      pointerEvents: 'none',
      left: x + 'px',
      top: y + 'px',
      width: Math.max(...boxes.map((b) => b.x + b.width)) - x + 'px',
      height: Math.max(...boxes.map((b) => b.y + b.height)) - y + 'px'
    })
    document.body.appendChild(d)
  }, boxes)
  return win.locator('#v-union')
}
const focus0 = r.focus.bind(r)
/** focus con lo zoom; wide: true lascia la vista intera (per le finestre grandi) */
r.focus = async (locs, text, sideArg, opts = {}) => {
  if (opts.wide) await r.unzoom()
  else await zoomTo(locs)
  const out = await focus0(await union(locs), text, sideArg, opts)
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
async function fill(loc, text, { tab = true } = {}) {
  await loc.first().scrollIntoViewIfNeeded()
  await r.click(loc, { after: 250, before: 200, ms: 450 })
  await win.keyboard.press('Control+A')
  await r.type(text)
  if (tab) await win.keyboard.press('Tab')
  await r.wait(300)
}
async function choose(loc, value) {
  await loc.first().scrollIntoViewIfNeeded()
  await r.click(loc, { after: 200, before: 200, ms: 450 })
  await win.keyboard.press('Escape')
  await loc.selectOption(value)
  await r.wait(600)
}
async function check(loc) {
  await loc.first().scrollIntoViewIfNeeded()
  await r.click(loc, { after: 400 })
}
async function openSet(name) {
  await r.click(side(name))
  await r.clear(900)
  await r.overlay()
}
async function view(key) {
  const b = win.locator('.set-header .segmented button').filter({ hasText: T[key] }).first()
  if (!(await b.isVisible().catch(() => false))) return
  await r.click(b, { after: 800 })
}
async function tools(key) {
  const b = win.locator('button').filter({ hasText: T['set.tools'] }).first()
  await b.scrollIntoViewIfNeeded()
  await r.click(b)
  await r.wait(400)
  await r.click(win.getByRole('menuitem', { name: T[key] }).first())
  await r.clear(900)
}
const gen = () => dialog()
const genSet = (i) => gen().locator('.generate-set').nth(i)
const column = (i) => genSet(i).locator('.generate-row select').first()
const values = (i) => genSet(i).locator('.generate-values textarea').first()
const genCheck = (i, key) =>
  genSet(i).locator('label.check').filter({ hasText: T[key] }).locator('input').first()
const pickIn = (i) => genSet(i).locator('.generate-row').first().locator('input.num').first()
const preview = () => gen().locator('.generate-preview').first()
const row = (key) =>
  gen()
    .locator('.generate-row')
    .filter({ has: win.locator('span', { hasText: new RegExp(`^${T[key]}$`) }) })
    .first()
const labelled = (key) =>
  gen()
    .locator('label')
    .filter({ hasText: new RegExp('^' + T[key]) })
    .locator('input')
    .first()
const kindButton = (key) =>
  gen()
    .locator('.generate-row')
    .first()
    .locator('.segmented button')
    .filter({ hasText: T[key] })
    .first()
const mode = (key) =>
  gen().locator('.dialog-buttons .segmented button').filter({ hasText: T[key] }).first()
const orderButton = (key) =>
  row('generate.order').locator('.segmented button').filter({ hasText: T[key] }).first()
const primary = () => gen().locator('.dialog-buttons button.primary').first()
const howSet = () => row('generate.howMany').locator('input[type=radio]').first()
const roundsIn = () => row('generate.howMany').locator('input.num').first()
/** la colonna da riempire, dall'elenco */
async function setColumn(i, name) {
  await choose(column(i), name)
}
const iconsOff = (i) => check(genCheck(i, 'generate.icons'))
const gridView = () => view('set.grid')

// ================= inizio
await r.overlay()
await r.title(t('Generare i componenti', 'Generating components'))
await r.title(
  t(
    'Combinazioni, cartelle, estrazioni a caso e sequenze: un set intero in pochi passi',
    'Combinations, folders, random draws and sequences: a whole set in a few steps'
  ),
  5200
)
await r.clear()
await mockOpen(r.app, project)
await r.click(win.getByText(T['start.openProject']))
await r.clear(2200)
await r.overlay()

// ---- 1. il set da riempire
await r.title(t('Il set da riempire', 'The set to fill'))
await r.click(side(N.tRecruit))
await r.clear(1400)
await r.overlay()
await r.focus(
  win.locator('.layers').first(),
  t(
    'Il template delle reclute: fazione, costo, risorse, ritratto e ricompensa vengono dalle colonne',
    'The recruit template: faction, cost, resources, portrait and reward come from the columns'
  ),
  'right',
  { pad: 6 }
)
await r.focus(
  layer(C.name),
  t(
    'Il nome è una formula con {card.number}: Recluta 1, Recluta 2…',
    'The name is a formula with {card.number}: Recruit 1, Recruit 2…'
  ),
  'right',
  { pad: 4 }
)
await openSet(N.recruits)
await r.focus(
  win.locator('main').first(),
  t(
    'Il set Reclute è vuoto: le righe le scrive Genera, nel menu Strumenti',
    'The Recruits set is empty: Generate, in the Tools menu, writes the rows'
  ),
  'right',
  { pad: 6, wide: true }
)

// ---- 2. tutte le combinazioni
await r.title(t('Tutte le combinazioni', 'All combinations'))
await tools('set.generate')
await r.focus(
  kindButton('generate.all'),
  t(
    'Tutte le combinazioni: un componente per ogni modo di unire i valori degli insiemi',
    'All combinations: one component for every way of joining the values of the sets'
  ),
  'below',
  { pad: 4 }
)
await setColumn(0, C.faction)
await fill(values(0), `${F.kingdom}, ${F.clan}, ${F.shadow}`, { tab: false })
await iconsOff(0)
await r.focus(
  genSet(0),
  t(
    'Il primo insieme: la colonna fazione e i suoi tre valori. Non sono icone: Come icona si toglie',
    'The first set: the faction column and its three values. They are not icons: As icon goes off'
  ),
  'below',
  { pad: 4 }
)
await r.click(gen().getByRole('button', { name: T['generate.addSet'], exact: true }).first(), {
  after: 600
})
await setColumn(1, C.cost)
await fill(values(1), '1-3', { tab: false })
await iconsOff(1)
await r.focus(
  [genSet(1), preview()],
  t(
    'Il costo da 1 a 3: 3 fazioni × 3 costi = 9 componenti',
    'Cost from 1 to 3: 3 factions × 3 costs = 9 components'
  ),
  'above',
  { pad: 4 }
)
await r.click(gen().getByRole('button', { name: T['generate.addSet'], exact: true }).first(), {
  after: 600
})
await setColumn(2, R.resources)
await fill(values(2), `${G.gold}, ${G.wood}, ${G.iron}`, { tab: false })
await fill(pickIn(2), '2')
await r.focus(
  genSet(2),
  t(
    'Due risorse per recluta, scelte fra tre: Come icona scrive {oro}, e sulla carta c’è l’icona',
    'Two resources per recruit, out of three: As icon writes {gold}, and the card shows the icon'
  ),
  'above',
  { pad: 4 }
)
await r.focus(
  genSet(2).locator('.generate-row').last(),
  t(
    'Il separatore va tra i due valori nella cella; a destra quante scelte dà l’insieme: 3',
    'The separator goes between the two values in the cell; on the right, how many choices the set gives: 3'
  ),
  'above',
  { pad: 4 }
)
await check(genCheck(2, 'generate.repeat'))
await r.focus(
  [genCheck(2, 'generate.repeat'), genSet(2).locator('.generate-row').last()],
  t(
    'Con ripetizioni: anche due volte la stessa risorsa, come legno legno. Le scelte diventano 6',
    'With repeats: the same resource twice too, as in wood wood. The choices become 6'
  ),
  'above',
  { pad: 4 }
)
await check(genCheck(2, 'generate.ordered'))
await r.focus(
  [genCheck(2, 'generate.ordered'), genSet(2).locator('.generate-row').last()],
  t(
    'Conta l’ordine: oro legno e legno oro diventano due carte diverse. Qui non serve',
    'Count order: gold wood and wood gold become two different cards. Not needed here'
  ),
  'above',
  { pad: 4 }
)
await check(genCheck(2, 'generate.ordered'))
const limits = genSet(2).locator('details.generate-limits').first()
await r.click(limits.locator('summary').first(), { after: 600 })
const goldAt = (
  await limits
    .locator('.generate-limit-value')
    .evaluateAll((els) => els.map((e) => e.textContent.trim()))
).findIndex((v) => v.includes(G.gold))
await fill(limits.locator('.generate-limit-grid input').nth(goldAt * 2 + 1), '1')
await r.focus(
  limits,
  t(
    'Limiti per valore: al massimo un oro per recluta. Niente più oro oro: 5 scelte',
    'Limits per value: at most one gold per recruit. No more gold gold: 5 choices'
  ),
  'above',
  { pad: 4 }
)
await r.focus(
  preview(),
  t(
    '3 fazioni × 3 costi × 5 coppie di risorse = 45 componenti',
    '3 factions × 3 costs × 5 resource pairs = 45 components'
  ),
  'above',
  { pad: 4 }
)

// ---- 3. il filtro
await r.title(t('Il filtro', 'The filter'))
const filter = gen().locator('.generate-filter input').first()
await fill(filter, `=OR({${C.cost}}=3; {${R.resources}_1}<>{${R.resources}_2})`, { tab: false })
await r.wait(700)
await r.focus(
  gen().locator('.generate-filter').first(),
  t(
    `Il filtro tiene solo i componenti per cui è vero. {${R.resources}_1} e {${R.resources}_2} sono la prima e la seconda risorsa`,
    `The filter keeps only the components for which it is true. {${R.resources}_1} and {${R.resources}_2} are the first and the second resource`
  ),
  'above',
  { pad: 4 }
)
await r.focus(
  [gen().locator('.generate-filter').first(), preview()],
  t(
    'Due risorse uguali solo a costo 3: restano 33 componenti su 45',
    'Two equal resources only at cost 3: 33 components out of 45 remain'
  ),
  'above',
  { pad: 4 }
)
await r.focus(
  gen().locator('.generate-filter .fx-button').first(),
  t(
    'fx accanto al filtro apre l’assistente formule, con la prima combinazione come esempio',
    'fx next to the filter opens the formula assistant, with the first combination as a sample'
  ),
  'above',
  { pad: 4 }
)

// ---- 4. copie e giri
await r.title(t('Copie e giri', 'Copies and rounds'))
await fill(labelled('generate.copies'), '2')
await r.focus(
  labelled('generate.copies'),
  t(
    'Copie: ogni componente generato con 2 copie, nella colonna amount',
    'Copies: every generated component with 2 copies, in the amount column'
  ),
  'above',
  { pad: 4 }
)
await fill(labelled('generate.copies'), '1')
await fill(roundsIn(), '2')
await r.focus(
  [row('generate.howMany'), preview()],
  t(
    'Giri: finite le 33 combinazioni si ricomincia dalla prima. Con 2 giri, 66 componenti',
    'Rounds: when the 33 combinations run out, they start again from the first. With 2 rounds, 66 components'
  ),
  'above',
  { pad: 4 }
)
await fill(roundsIn(), '1')
await r.focus(primary(), t('Un giro solo: 33 reclute', 'One round only: 33 recruits'), 'above', {
  pad: 4
})
await r.click(primary())
await r.clear(1500)
await gridView()
await r.focus(
  grid(),
  t(
    'Le 33 reclute: ogni fazione con i suoi costi e le sue coppie di risorse',
    'The 33 recruits: each faction with its costs and its resource pairs'
  ),
  'right',
  { pad: 6, wide: true }
)

// ---- 5. da una cartella
await r.title(t('Da una cartella', 'From a folder'))
await tools('set.generate')
await setColumn(0, R.portrait)
await choose(
  genSet(0)
    .locator('select')
    .filter({ has: win.locator('option', { hasText: T['generate.fromFolder'] }) })
    .first(),
  '/' + N.folder
)
await r.focus(
  genSet(0),
  t(
    'Da una cartella…: i valori sono i nomi delle 12 immagini della cartella dei ritratti',
    'From a folder…: the values are the names of the 12 images in the portraits folder'
  ),
  'below',
  { pad: 4 }
)
await r.focus(
  genCheck(0, 'generate.icons').locator('xpath=..'),
  t(
    'Il ritratto è un livello immagine: Come icona è già tolto, nella cella va il nome dell’immagine',
    'The portrait is an image layer: As icon is already off, the cell gets the image name'
  ),
  'below',
  { pad: 4 }
)
await check(howSet())
await r.focus(
  [row('generate.howMany'), preview()],
  t(
    'Tutti i componenti del set: 12 ritratti per 33 reclute, i giri ricominciano finché il set è pieno',
    'All the components of the set: 12 portraits for 33 recruits, the rounds start over until the set is full'
  ),
  'above',
  { pad: 4 }
)

// ---- 6. aggiungi, aggiorna, sostituisci
await r.title(t('Aggiungi, Aggiorna, Sostituisci', 'Add, Update, Replace'))
await r.click(mode('generate.append'), { after: 600 })
await r.focus(
  mode('generate.append'),
  t(
    'Aggiungi in fondo: 33 componenti nuovi dopo quelli che ci sono già',
    'Add at the end: 33 new components after the ones already there'
  ),
  'above',
  { pad: 4 }
)
await r.click(mode('generate.replace'), { after: 600 })
await r.focus(
  mode('generate.replace'),
  t(
    'Sostituisci: si cancellano i componenti del set e restano solo quelli generati, dopo una conferma',
    'Replace: the set components are deleted and only the generated ones stay, after a confirmation'
  ),
  'above',
  { pad: 4 }
)
await r.click(mode('generate.update'), { after: 600 })
await r.focus(
  gen().locator('.field-note').last(),
  t(
    'Aggiorna: scrive solo la colonna ritratto nelle 33 righe; fazione, costo e risorse restano',
    'Update: writes only the portrait column in the 33 rows; faction, cost and resources stay'
  ),
  'above',
  { pad: 4 }
)
await r.click(primary())
await r.clear(1500)
await r.focus(
  grid(),
  t('Ogni recluta ha il suo ritratto', 'Each recruit has its own portrait'),
  'right',
  { pad: 6, wide: true }
)
await r.click(saveButton())

// ---- 7. a caso
await r.title(t('A caso', 'Random'))
await tools('set.generate')
await r.click(kindButton('generate.random'), { after: 700 })
await r.focus(
  kindButton('generate.random'),
  t(
    'A caso: quanti componenti vuoi, con i valori estratti dagli insiemi',
    'Random: as many components as you want, with values drawn from the sets'
  ),
  'below',
  { pad: 4 }
)
await setColumn(0, C.faction)
await fill(values(0), `${F.kingdom}*3, ${F.clan}*2, ${F.shadow}`, { tab: false })
await iconsOff(0)
await r.focus(
  genSet(0),
  t(
    `valore*N è il peso: ${F.kingdom}*3 esce tre volte più spesso di ${F.shadow}`,
    `value*N is the weight: ${F.kingdom}*3 comes out three times as often as ${F.shadow}`
  ),
  'below',
  { pad: 4 }
)
await r.click(gen().getByRole('button', { name: T['generate.addSet'], exact: true }).first(), {
  after: 600
})
await setColumn(1, R.resources)
await fill(values(1), `${G.gold}, ${G.wood}, ${G.iron}`, { tab: false })
await r.click(
  genSet(1).getByRole('button', { name: T['generate.addField'], exact: true }).first(),
  {
    after: 600
  }
)
await choose(genSet(1).locator('.generate-more select').first(), R.reward)
await r.focus(
  genSet(1),
  t(
    '+ Colonna: lo stesso insieme riempie anche la ricompensa, con la sua estrazione',
    '+ Column: the same set also fills the reward, with its own draw'
  ),
  'below',
  { pad: 4 }
)
await fill(labelled('generate.count'), '12')
await check(labelled('generate.unique'))
await r.focus(
  [
    labelled('generate.count').locator('xpath=ancestor::div[contains(@class,"generate-row")]'),
    preview()
  ],
  t(
    'Dodici componenti. Tutte diverse toglie i doppioni',
    'Twelve components. All different removes duplicates'
  ),
  'above',
  { pad: 4 }
)
await fill(labelled('generate.seed'), '7')
await r.focus(
  labelled('generate.seed'),
  t(
    'Il seme: con lo stesso numero escono sempre gli stessi componenti',
    'The seed: the same number always gives the same components'
  ),
  'above',
  { pad: 4 }
)
await r.click(
  gen()
    .getByRole('button', { name: new RegExp(T['generate.shuffle']) })
    .first(),
  {
    after: 700
  }
)
await r.focus(
  preview(),
  t('Rimescola: un seme nuovo, altri componenti', 'Shuffle: a new seed, other components'),
  'above',
  { pad: 4 }
)
await r.click(gen().getByRole('button', { name: T['dialog.cancel'], exact: true }).first())
await r.clear(900)

// ---- 8. in sequenza
await r.title(t('In sequenza', 'In sequence'))
await tools('set.generate')
await r.click(kindButton('generate.sequence'), { after: 700 })
await setColumn(0, R.reward)
await fill(values(0), `${G.gold}, ${G.wood}, ${G.iron}`, { tab: false })
await r.focus(
  [genSet(0), preview()],
  t(
    'In sequenza: i valori uno dopo l’altro, e poi da capo. Ogni recluta riceve una risorsa',
    'In sequence: the values one after the other, then from the start. Each recruit gets one resource'
  ),
  'above',
  { pad: 4 }
)
await r.focus(
  row('generate.howMany'),
  t(
    'Su tutti i 33 componenti del set, aggiornando la colonna ricompensa',
    'On all 33 components of the set, updating the reward column'
  ),
  'above',
  { pad: 4 }
)
await r.click(orderButton('generate.orderBlock'), { after: 700 })
await r.focus(
  [row('generate.order'), preview()],
  t(
    'Mescola ogni giro: in ogni gruppo di tre ci sono tutte le risorse, in un ordine a caso',
    'Shuffle each round: every group of three has all the resources, in a random order'
  ),
  'above',
  { pad: 4 }
)
await r.click(orderButton('generate.orderDistinct'), { after: 700 })
await r.focus(
  [row('generate.order'), preview()],
  t(
    'Ogni giro un ordine diverso: con tre valori ci sono 6 ordini, poi si ricomincia',
    'A different order each round: with three values there are 6 orders, then it starts over'
  ),
  'above',
  { pad: 4 }
)
await r.click(orderButton('generate.orderAll'), { after: 700 })
await r.focus(
  [row('generate.order'), preview()],
  t(
    'Mescola tutto: le quantità restano 11, 11 e 11, ma l’ordine è libero',
    'Shuffle all: the amounts stay 11, 11 and 11, but the order is free'
  ),
  'above',
  { pad: 4 }
)
await r.click(orderButton('generate.orderNone'), { after: 700 })
await fill(values(0), `${G.gold}, ${G.wood}*2, ${G.iron}*2`, { tab: false })
await r.focus(
  [genSet(0), preview()],
  t(
    `In sequenza valore*N ripete il valore: ${G.gold}, ${G.wood} ${G.wood}, ${G.iron} ${G.iron}, poi da capo`,
    `In sequence value*N repeats the value: ${G.gold}, ${G.wood} ${G.wood}, ${G.iron} ${G.iron}, then from the start`
  ),
  'above',
  { pad: 4 }
)
await fill(values(0), `${G.gold}, ${G.wood}, ${G.iron}`, { tab: false })
await r.focus(
  primary(),
  t(
    'Qui una risorsa per volta, come scritto: aggiorna le 33 reclute',
    'Here one resource at a time, as written: update the 33 recruits'
  ),
  'above',
  { pad: 4 }
)
await r.click(primary())
await r.clear(1500)

// ---- 9. sequenze sfalsate
await r.title(t('Una sequenza sfalsata', 'An offset sequence'))
await r.click(side(N.tRecruit))
await r.clear(1400)
await r.overlay()
await r.click(layer(R.trade), { after: 900 })
await r.focus(
  props.locator('.source-line').first(),
  t(
    'Lo scambio è un livello Valore: PICK({card.number}+1; …) prende la risorsa che viene dopo nella sequenza',
    'The trade is a Value layer: PICK({card.number}+1; …) takes the resource that comes next in the sequence'
  ),
  'left',
  { pad: 4 }
)
await r.focus(
  layer(R.barter),
  t(
    'Il baratto unisce ricompensa e scambio: oro → legno, legno → ferro, ferro → oro',
    'The barter joins reward and trade: gold → wood, wood → iron, iron → gold'
  ),
  'right',
  { pad: 4 }
)
await openSet(N.recruits)
await gridView()
const cells = [0, 1, 2, 3].map((i) => win.locator('.card-grid .card-cell').nth(i))
await r.zoom(cells, { max: 1.8 })
const shifted = t(
  'Una sequenza spostata di un posto: mai la stessa risorsa. Vale con l’ordine Come scritto',
  'A sequence shifted by one: never the same resource. It works with the As written order'
)
await focus0(await union(cells), shifted, 'below', { pad: 6 })
await snap(shifted)
await r.unzoom(700)

// ---- 10. il controllo
await r.title(t('Il controllo', 'The check'))
const statsButton = win
  .locator('.set-actions button', { hasText: new RegExp(`^${T['set.stats']}$`) })
  .first()
await r.click(statsButton, { after: 1200 })
const panel = win.locator('.stats-panel').first()
const field = panel
  .locator('.stats-controls label')
  .filter({ hasText: new RegExp(`^${T['stats.field']}`) })
  .first()
  .locator('select')
  .first()
await choose(field, C.faction)
await r.focus(
  panel.locator('.stats-body').first(),
  t(
    'Le statistiche del set: 11 reclute per fazione',
    'The set statistics: 11 recruits per faction'
  ),
  'left',
  { pad: 4 }
)
await choose(field, R.reward)
await r.focus(
  panel.locator('.stats-body').first(),
  t(
    'E 11 per ogni ricompensa: la sequenza le ha distribuite in parti uguali',
    'And 11 for each reward: the sequence spread them out evenly'
  ),
  'left',
  { pad: 4 }
)
await r.click(saveButton(), { after: 600 })

// ---- chiusura
await r.title(
  t(
    'Genera è nel menu Strumenti del set; le statistiche nel video 28',
    'Generate is in the set’s Tools menu; statistics in video 28'
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
