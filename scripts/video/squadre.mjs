// Video 32, approfondimento: template derivati o template con varianti? Circa 9 minuti senza voce, sul
// progetto «Campionato» di progetto-squadre.mjs, che chi guarda scarica dal sito. Capitoli: lo stesso
// aspetto per squadra, due strade; un template derivato per squadra; un set per squadra con i dati
// condivisi; le modifiche al base arrivano a tutti; le varianti nel mazzo unico del mercato; quale
// scegliere; altri esempi; riepilogo.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node scripts/video/squadre.mjs it|en
// FAST=1 accorcia attese e scrittura; SHOT=<file.png> salva la schermata se un elemento non si trova;
// SNAP=<cartella> salva una schermata dopo ogni testo, e i testi in testi.tsv (per lo storyboard).
import { appendFileSync } from 'node:fs'
import { launch, mockOpen } from './lib.mjs'
import { docs } from '../guide/lib.mjs'
import { make, names, players } from './progetto-squadre.mjs'
const lang = process.argv[2] || 'it'
const it = lang === 'it'
const t = (a, b) => (it ? a : b)
const N = names(lang)
const { C } = N
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

const dialog = () => win.locator('[role="dialog"]').last()
const props = win.locator('aside.properties')
const layers = () => win.locator('.layers').first()
const layer = (n) =>
  win
    .locator('.layers .layer-row')
    .filter({ has: win.locator('.layer-name', { hasText: new RegExp(`^${n}$`) }) })
    .first()
    .locator('.layer-name')
    .first()
const side = (name) => win.locator('.sidebar').getByText(name, { exact: true }).first()
const saveButton = () =>
  win
    .locator('header.toolbar button')
    .filter({ hasText: new RegExp(`^(${T['app.save']}|${T['app.saved']})$`) })
    .first()
const grid = () => win.locator('.card-grid').first()
const cell = (i) => win.locator('.card-grid .card-cell').nth(i)
const form = win.locator('.card-form')
const formField = (col) =>
  form
    .locator('.field')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${col}$`) }) })
    .first()
const previewCard = () => win.locator('aside.preview .preview-card').first()
const problems = () => win.locator('aside.preview .problems').first()
const stage = () => win.locator('.canvas-stage').first()
const source = (kind) =>
  props
    .locator('.source-line .segmented button')
    .filter({
      hasText: new RegExp(
        `^${kind === 'column' ? T['source.short.column'] : T['source.kind.' + kind]}$`
      )
    })
    .first()
const options = () => props.locator('.list-options').first()
const optionText = (i) => options().locator('input.option-text').nth(i)
const td = (row, col) => win.locator(`.data-table td[data-cell="${row}:${col}"]`).first()
const tableTab = () =>
  win.locator('.set-header .segmented button').filter({ hasText: T['set.table'] }).first()
const gridTab = () =>
  win.locator('.set-header .segmented button').filter({ hasText: T['set.grid'] }).first()
const tile = (col, name) =>
  formField(col)
    .locator('.list-tile')
    .filter({ hasText: new RegExp(`^${name}`) })
    .first()
const variantTile = (name) =>
  form
    .locator('.variant-tile')
    .filter({ has: win.locator('.list-tile-name', { hasText: new RegExp(`^${name}$`) }) })
    .first()
const vRow = (name) =>
  dialog()
    .locator('.variants-table tbody tr')
    .filter({ has: win.locator('.variant-name', { hasText: new RegExp(`^${name}$`) }) })
    .first()
const vHead = (name) =>
  dialog().locator('.variants-table thead th').filter({ hasText: name }).first()
const vCol = async (name) => {
  const heads = await dialog().locator('.variants-table thead th').allInnerTexts()
  return heads.findIndex((h) => h.trim().startsWith(name))
}

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
  await r.wait(400)
}
async function choose(loc, value) {
  await center(loc)
  await r.click(loc, { after: 200, before: 200, ms: 450 })
  await win.keyboard.press('Escape')
  await loc.selectOption(value)
  await r.wait(600)
}
async function key(combo, ms = 700) {
  await r.clear(150)
  await win.keyboard.press(combo)
  await r.wait(ms)
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
async function openTemplate(name, set, n = 0) {
  await r.click(side(name))
  await r.clear(1200)
  await r.overlay()
  await previewData(set, n)
}
async function previewData(set, n = 0) {
  const sel = win.locator('.preview-data select')
  await sel.first().selectOption({ label: set })
  await r.wait(300)
  await sel.nth(1).selectOption(String(n))
  await r.wait(600)
}
/** zoom sulla carta dell'editor e testo sopra */
async function look(text) {
  await r.clear(100)
  await r.zoom(stage(), { max: 1.6, fill: 0.72 })
  await r.focus(stage(), text, 'above', { pad: 0, dim: false })
  await r.unzoom()
}
/** la carta n del set, con il suo modulo */
async function pick(n) {
  await r.click(cell(n), { after: 700 })
}
async function zoomCard(text) {
  await r.zoom(previewCard(), { max: 1.6, fill: 0.85 })
  await r.focus(previewCard(), text, 'left', { pad: 0, dim: false })
  await r.unzoom()
}
async function bigThumbs(v = 3) {
  await win
    .locator('input.thumb-size')
    .first()
    .evaluate((el, v) => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      set.call(el, String(v))
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, v)
  await r.wait(400)
}

const field = (label, scope = props) =>
  scope
    .locator('.field')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${label}$`) }) })
    .locator('input:not([type=range]), textarea, select')
    .first()
const colorField = () =>
  props
    .locator('.field')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${T['prop.fill']}$`) }) })
    .locator('input.color-text')
    .first()
const asset = (name) =>
  dialog().locator(`.asset-tile[title*="${name}"], .asset-tile[data-tip*="${name}"]`).first()
const menuItem = (key) => win.locator('.menu-panel .menu-item').filter({ hasText: T[key] }).first()
const derivedName = (team) => `${N.tAction} ${team.name}`
const [lions, hawks, wolves] = N.teams

/** crea il derivato di «azione» per una squadra; con quiet niente testi */
async function derive(team, quiet = false) {
  await openTemplate(N.tAction, N.actions, 1)
  await r.click(win.locator('.editor-toolbar .more-button').first(), { after: 500 })
  if (!quiet)
    await r.focus(
      menuItem('inherit.deriveShort'),
      t(
        `${T['inherit.deriveShort']}, nel menu ⋯ del template, crea un template che parte da questo`,
        `${T['inherit.deriveShort']}, in the template’s ⋯ menu, creates a template that starts from this one`
      ),
      'right',
      { pad: 4 }
    )
  await r.click(menuItem('inherit.deriveShort'))
  await r.clear(500)
  await win.keyboard.press('Control+A')
  await r.type(derivedName(team))
  await r.wait(400)
  await r.click(dialog().locator('button[type=submit]'))
  await r.clear(1500)
  await r.overlay()
  if (!quiet)
    await r.focus(
      win.locator('.editor-toolbar .derived-from').first(),
      t(
        `Deriva da «${N.tAction}»: misure, livelli e posizioni vengono da lì`,
        `Derived from “${N.tAction}”: size, layers and positions come from there`
      ),
      'below'
    )
  await r.click(layer(C.band), { after: 500 })
  await fill(colorField(), team.color)
  await r.click(layer(C.crest), { after: 500 })
  await r.click(props.locator('.pick-btn:not(.fx-button)').first())
  await r.clear(800)
  await r.click(asset(team.crest))
  await r.clear(800)
  await r.click(layer(C.team), { after: 500 })
  await fill(field(T['prop.text']), team.name)
  if (!quiet) {
    await r.focus(
      win.locator('aside.layers .layers-list').first(),
      t(
        'Cambiano solo banda, stemma e nome della squadra: la freccia segna i livelli cambiati',
        'Only the band, the crest and the team name change: the arrow marks the changed layers'
      ),
      'right',
      { pad: 4 }
    )
    await look(
      t(
        `Il template con i colori dei ${team.name}. Le carte arrivano con il set, tra poco`,
        `The template in the ${team.name} colors. The cards come with the set, in a moment`
      )
    )
  }
  await save()
}

/** un set per la squadra, sul foglio delle azioni */
async function teamSet(team, quiet = false) {
  await r.click(
    win.locator(`[title="${T['sidebar.newSet']}"], [data-tip="${T['sidebar.newSet']}"]`).first()
  )
  await r.clear(400)
  await r.type(team.name)
  await r.wait(400)
  await choose(dialog().locator('select').first(), derivedName(team))
  await choose(dialog().locator('select').nth(1), N.actions)
  if (!quiet) {
    await r.focus(
      dialog().locator('select').nth(1),
      t(
        `Come foglio scegliamo quello delle ${N.actions}, tra i ${T['newSet.sharedGroup'].toLowerCase()}`,
        `For the sheet we pick the ${N.actions} one, under ${T['newSet.sharedGroup']}`
      ),
      'right',
      { pad: 4 }
    )
    await r.focus(
      dialog().locator('p.muted.small').first(),
      t(
        'Il nuovo set usa le stesse righe: nessuna carta da copiare',
        'The new set uses the same rows: no cards to copy'
      ),
      'right',
      { pad: 4 }
    )
  }
  await r.click(dialog().getByRole('button', { name: T['newSet.create'], exact: true }))
  await r.clear(1200)
  await r.overlay()
}

// ================= apertura
await mockOpen(r.app, dest)
await r.overlay()
await r.title(t('Template derivati o varianti?', 'Derived templates or variants?'))
await r.title(
  t(
    'Il progetto «Campionato» si scarica dal link nella descrizione: aprilo e segui passo passo',
    'The “League” project is in the description: open it and follow along'
  )
)
await r.clear()
await r.click(win.getByText(T['start.openProject']).first())
await r.clear(2200)
await r.overlay()
await bigThumbs()

// ================= 1. il problema
await r.title(
  t('1 · Tre squadre, due modi di dare i colori', '1 · Three teams, two ways to give them colors')
)
await r.clear()
await r.focus(
  grid(),
  t(
    `Le ${N.actions}: sei carte uguali per tutte le squadre. Ogni squadra avrà il suo mazzo, con i suoi colori`,
    `The ${N.actions}: six cards, the same for every team. Each team gets its own deck, in its own colors`
  ),
  'right',
  { pad: 4 }
)
await openSet(N.market)
await r.focus(
  grid(),
  t(
    `Il ${N.market}: un solo mazzo con giocatori di tutte le squadre, ognuno con i colori della sua`,
    `The ${N.market}: a single deck with players from every team, each in their team’s colors`
  ),
  'right',
  { pad: 4 }
)
await r.title(
  t(
    'Per le azioni useremo i template derivati, per il mercato le varianti. Vediamo perché',
    'For the actions we will use derived templates, for the market variants. Let’s see why'
  )
)

// ================= 2. un derivato per squadra
await r.title(
  t('2 · Un template derivato per ogni squadra', '2 · A derived template for each team')
)
await r.clear()
await derive(lions)
await r.title(
  t(
    `Lo stesso per ${hawks.name} e ${wolves.name}`,
    `The same for the ${hawks.name} and ${wolves.name}`
  )
)
await r.clear()
await derive(hawks, true)
await derive(wolves, true)
await r.focus(
  win
    .locator('.sidebar ul')
    .filter({ has: win.getByText(N.tPlayer, { exact: true }) })
    .first(),
  t(
    'Nella barra laterale i tre derivati sono template a sé, ognuno con il suo nome',
    'In the sidebar the three derived templates are templates of their own, each with its name'
  ),
  'right',
  { pad: 4 }
)

// ================= 3. un set per squadra, dati condivisi
await r.title(
  t('3 · Un set per squadra, sugli stessi dati', '3 · A set for each team, on the same data')
)
await r.clear()
await teamSet(lions)
await r.focus(
  grid(),
  t(
    `Il set ${lions.name}: le sei azioni, con il template dei ${lions.name}`,
    `The ${lions.name} set: the six actions, with the ${lions.name} template`
  ),
  'right',
  { pad: 4 }
)
await teamSet(hawks, true)
await teamSet(wolves, true)
await r.focus(
  win
    .locator('.sidebar ul')
    .filter({ has: win.getByText(N.market, { exact: true }) })
    .first(),
  t(
    `Quattro set sullo stesso foglio: ${N.actions}, ${lions.name}, ${hawks.name} e ${wolves.name}`,
    `Four sets on the same sheet: ${N.actions}, ${lions.name}, ${hawks.name} and ${wolves.name}`
  ),
  'right',
  { pad: 4 }
)
await openSet(lions.name)
await pick(1)
await fill(formField(C.power).locator('input, textarea').first(), '5')
await r.focus(
  formField(C.power),
  t(
    'Nei Leoni il Tiro passa da forza 4 a 5…',
    'In the Lions the Shot goes from power 4 to 5…'
  ).replace(/Leoni|Lions/, lions.name),
  'left',
  { pad: 4 }
)
await openSet(hawks.name)
await r.zoom(cell(1), { max: 1.6, fill: 0.7 })
await r.focus(
  cell(1),
  t(
    `…e cambia anche nei ${hawks.name}: i dati sono uno solo, per tutti i set del foglio`,
    `…and it changes in the ${hawks.name} too: there is one set of data for every set on the sheet`
  ),
  'right',
  { pad: 4, dim: false }
)
await r.unzoom()
await save()
await r.title(
  t(
    'I derivati non servono solo con un foglio condiviso: qui il foglio condiviso mostra quanto rendono',
    'Derived templates are not only for a shared sheet: here the shared sheet shows how much they pay off'
  )
)

// ================= 4. il base comanda
await r.title(
  t('4 · Una modifica al base arriva a tutti', '4 · A change to the base reaches them all')
)
await r.clear()
await openTemplate(N.tAction, N.actions, 1)
await r.click(layer(C.circle), { after: 500 })
await fill(colorField(), '#F2C94C')
await look(
  t(
    `Nel template «${N.tAction}» il cerchio della forza diventa giallo`,
    `In the “${N.tAction}” template the power circle turns yellow`
  )
)
await save()
await openSet(wolves.name)
await r.focus(
  grid(),
  t(
    'Anche i Lupi lo ricevono: i derivati prendono dal base tutto ciò che non cambiano',
    'The Wolves get it too: derived templates take from the base everything they do not change'
  ).replace(/Lupi|Wolves/, wolves.name),
  'right',
  { pad: 4 }
)

// ================= 5. le varianti
await r.title(t('5 · Un solo mazzo: le varianti', '5 · A single deck: variants'))
await r.clear()
await openTemplate(N.tPlayer, N.market, 0)
await r.click(win.locator('.editor-toolbar .more-button').first(), { after: 500 })
await r.click(menuItem('variants.menu'), { after: 900 })
for (const team of N.teams) {
  await fill(dialog().getByPlaceholder(T['variants.newName']), team.name, { tab: false })
  await r.click(dialog().getByRole('button', { name: T['variants.add'] }), { after: 700 })
}
await r.focus(
  dialog().locator('.variants-table').first(),
  t(
    `Nel template «${N.tPlayer}» una variante per squadra, dalla finestra ${T['variants.menu']}`,
    `In the “${N.tPlayer}” template one variant per team, from the ${T['variants.menu']} window`
  ),
  'below',
  { pad: 4 }
)
const addCol = () =>
  dialog()
    .locator(
      `select[title="${T['variants.addColumnHint']}"], select[data-tip="${T['variants.addColumnHint']}"]`
    )
    .first()
for (const l of [C.band, C.crest, C.team]) {
  const sel = addCol()
  await r.click(sel, { after: 200 })
  await win.keyboard.press('Escape')
  const id = await sel.evaluate(
    (el, name) => [...el.options].find((o) => o.textContent === name)?.value,
    l
  )
  await sel.selectOption(id)
  await r.wait(600)
}
const bandCol = await vCol(C.band)
const crestCol = await vCol(C.crest)
const teamCol = await vCol(C.team)
for (const team of N.teams) {
  const row = vRow(team.name)
  await fill(row.locator('td, th').nth(bandCol).locator('input[type=text]').first(), team.color)
  await r.click(row.locator('td, th').nth(crestCol).locator('.option-pick').first(), { after: 900 })
  await r.click(asset(team.crest), { after: 900 })
  await fill(row.locator('td, th').nth(teamCol).locator('input[type=text]').first(), team.name)
}
await r.focus(
  dialog().locator('.variants-table').first(),
  t(
    'Le stesse tre modifiche dei derivati: banda, stemma e nome. Ma tutto sta in una finestra',
    'The same three changes as the derived templates: band, crest and name. But all in one window'
  ),
  'below',
  { pad: 4 }
)
await r.click(dialog().getByRole('button', { name: T['dialog.close'], exact: true }), {
  after: 900
})
await r.focus(
  win.locator('.sidebar .variants-count').first(),
  t(
    'Nella barra laterale il template compare una volta sola, con il numero delle varianti',
    'In the sidebar the template appears once, with the number of its variants'
  ),
  'right',
  { pad: 4 }
)
await save()
await openSet(N.market)
await pick(0)
await r.focus(
  form.locator('.variant-field').first(),
  t(
    `Ogni carta sceglie la sua squadra nel campo ${T['cardForm.variant']}`,
    `Each card picks its team in the ${T['cardForm.variant']} field`
  ),
  'left',
  { pad: 4 }
)
const roster = players(lang)
for (let i = 0; i < roster.length; i++) {
  const team = roster[i][3]
  if (team < 0) continue
  if (i > 0) await pick(i)
  await r.click(variantTile(N.teams[team].name), { after: 700 })
}
await r.focus(
  grid(),
  t(
    `Un solo mazzo, tre squadre. ${roster[roster.length - 1][0]} resta sul template: è uno svincolato`,
    `One deck, three teams. ${roster[roster.length - 1][0]} stays on the template: a free agent`
  ),
  'right',
  { pad: 4 }
)
await r.title(
  t(
    'La scelta va nella colonna template del foglio, come gli altri dati della carta',
    'The choice goes into the sheet’s template column, like the card’s other data'
  )
)
await save()

// ================= 6. quale scegliere
await r.title(t('6 · Quale scegliere?', '6 · Which one to choose?'))
await r.title(
  t(
    'Chiediti quanti mazzi stampi. Uno per gruppo, con le stesse carte: template derivati e set sullo stesso foglio',
    'Ask yourself how many decks you print. One per group, with the same cards: derived templates and sets on the same sheet'
  )
)
await r.title(
  t(
    'Uno solo, con carte di aspetto diverso: varianti, e ogni carta sceglie la sua',
    'Just one, with cards that look different: variants, and each card picks its own'
  )
)
await r.title(
  t(
    'Un derivato serve anche da solo: ogni volta che un template parte da un altro, ne cambia una parte e ne segue le modifiche',
    'A derived template is useful on its own too: whenever a template starts from another, changes part of it and follows its changes'
  )
)
await r.title(
  t(
    'Con i derivati ogni mazzo è un set: si esporta da solo, e in Tabletop Simulator è un mazzo a sé',
    'With derived templates each deck is a set: it exports on its own, and in Tabletop Simulator it is a deck of its own'
  )
)
await r.title(
  t(
    'Con le varianti le carte stanno in un set solo, e si mescolano nello stesso mazzo',
    'With variants the cards live in a single set, and get shuffled in the same deck'
  )
)

// ================= 7. altri esempi
await r.title(t('7 · Altri esempi', '7 · More examples'))
await r.title(
  t(
    'Derivati: un mazzo iniziale per ogni colore di giocatore, un’edizione in un’altra lingua, una versione spoglia per i playtest',
    'Derived: a starting deck for each player color, an edition in another language, a bare version for playtests'
  )
)
await r.title(
  t(
    'Varianti: la rarità (comune, rara, epica) con cornici diverse, i tipi di carta, poche carte promo in mezzo alle altre',
    'Variants: rarity (common, rare, epic) with different frames, card types, a few promo cards among the others'
  )
)

// ================= riepilogo
await r.title(t('Riepilogo', 'Summary'))
await r.title(
  t(
    'Derivati: template che partono da un altro e ne seguono le modifiche. Con un foglio condiviso, un mazzo per gruppo con le stesse carte',
    'Derived: templates that start from another and follow its changes. With a shared sheet, one deck per group with the same cards'
  )
)
await r.title(
  t(
    'Varianti: versioni del template scelte carta per carta, in un solo mazzo',
    'Variants: versions of the template picked card by card, in a single deck'
  )
)
await r.clear()
const raw = await r.finish()
console.log(raw)
