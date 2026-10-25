// Video 10: i dati dal foglio di calcolo (circa 7 minuti, senza voce), sul progetto di esempio. Ogni riga del
// foglio è una carta: tabella, modifica delle celle, copie, nuove carte, modifica in blocco, ordinamento e
// filtro, statistiche, colonne delle proprietà, un set nuovo, il file modificato fuori da Stella, il controllo
// del file dei dati e Google Sheets.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node --experimental-strip-types --no-warnings scripts/video/dati.mjs it|en
// FAST=1 accorcia attese e scrittura, per provare il percorso senza badare al ritmo.
import { launch } from './lib.mjs'
import { docs } from '../guide/lib.mjs'
import { createRequire } from 'node:module'
import { rmSync } from 'node:fs'
const require = createRequire(import.meta.url)
const ExcelJS = require('exceljs')
const lang = process.argv[2] || 'it'
const it = lang === 'it'
const t = (a, b) => (it ? a : b)
const r = await launch({ lang, ...(process.env.UD ? { ud: process.env.UD } : {}) })
const { win, T } = r
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
      folder: 'Esempio',
      file: 'carte.xlsx',
      sets: ['Personaggi', 'Oggetti', 'Mercato'],
      name: 'nome',
      strength: 'forza',
      text: 'testo',
      portrait: 'ritratto',
      template: 'personaggio',
      bard: 'Bardo',
      bardText: 'Ogni alleato guadagna {spada} fino a fine turno.',
      monsters: 'Mostri',
      goblin: 'Goblin',
      thiefText: 'Ruba {moneta*3} a un altro giocatore.'
    }
  : {
      folder: 'Example',
      file: 'cards.xlsx',
      sets: ['Characters', 'Items', 'Market'],
      name: 'name',
      strength: 'strength',
      text: 'text',
      portrait: 'portrait',
      template: 'character',
      bard: 'Bard',
      bardText: 'Every ally gains {sword} until the end of the turn.',
      monsters: 'Monsters',
      goblin: 'Goblin',
      thiefText: 'Steal {coin*3} from another player.'
    }
const project = `${docs(lang)}/Stella/${S.folder}`
rmSync(project, { recursive: true, force: true })

const dialog = () => win.locator('[role="dialog"]').last()
const side = (name) => win.locator('.sidebar').getByText(name, { exact: true }).first()
const titled = (key) => win.locator(`[title="${T[key]}"], [data-tip="${T[key]}"]`).first()
const button = (key, scope = win) =>
  scope.getByRole('button', { name: T[key], exact: true }).first()
const saveButton = () =>
  win
    .locator('header.toolbar button')
    .filter({ hasText: new RegExp(`^(${T['app.save']}|${T['app.saved']})$`) })
    .first()
const table = () => win.locator('.data-table').first()
const td = (row, col) => win.locator(`.data-table td[data-cell="${row}:${col}"]`).first()
const rowNum = (row) => win.locator(`.data-table tr[data-row="${row}"] td.row-num`).first()
const th = (col) =>
  win
    .locator('.data-table th .th-sort')
    .filter({ hasText: new RegExp(`^${col}(?![\\w.@])`) })
    .first()
const grid = () => win.locator('.card-grid').first()
const form = win.locator('.card-form')
const cardField = (col) =>
  form
    .locator('label')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${col}$`) }) })
    .locator('input, textarea')
    .first()
const preview = () => win.locator('.sidebar-preview, .card-preview, .preview').first()

/** zoom su celle, righe, intestazioni e campi; la vista intera per tutto il resto */
async function zoomTo(locs) {
  const targets = []
  for (const l of [].concat(locs)) {
    const kind = await l
      .first()
      .evaluate((el) => {
        if (el.closest('[role=dialog]'))
          return el.closest('.dialog-form label, .field') ? 'label' : ''
        if (el.closest('.card-form')) return 'label'
        if (el.matches('td, th, tr, .th-sort') || el.closest('td, th')) return 'el'
        return ''
      })
      .catch(() => '')
    if (!kind) return r.unzoom()
    targets.push(kind === 'label' ? l.first().locator('xpath=ancestor-or-self::label[1]') : l)
  }
  await r.zoom(targets, { max: 1.7 })
}
const focus0 = r.focus.bind(r)
r.focus = async (locs, ...rest) => {
  await zoomTo(locs)
  return focus0(locs, ...rest)
}
const title0 = r.title.bind(r)
r.title = async (...a) => {
  await r.unzoom(700)
  return title0(...a)
}
/** un clic con un tasto premuto (Maiuscolo per aggiungere alla selezione) */
async function clickWith(loc, key) {
  await r.clear(150)
  const b = await loc.first().boundingBox()
  await r.glide(b.x + b.width / 2, b.y + b.height / 2, 600)
  await r.wait(300)
  await win.keyboard.down(key)
  await win.mouse.click(r.cx, r.cy)
  await win.keyboard.up(key)
  await r.wait(700)
}
/** doppio clic su una cella, nuovo valore, Invio */
async function editCell(row, col, value) {
  await r.unzoom()
  const c = td(row, col)
  await c.scrollIntoViewIfNeeded()
  await r.clear(150)
  const b = await c.boundingBox()
  await r.glide(b.x + b.width / 2, b.y + b.height / 2, 600)
  await r.wait(300)
  await win.mouse.dblclick(r.cx, r.cy)
  await r.wait(400)
  await win.keyboard.press('Control+A')
  await r.type(value)
  await r.wait(300)
  await win.keyboard.press('Enter')
  await r.wait(700)
}
async function view(key) {
  await r.click(win.locator('.set-header .segmented button').filter({ hasText: T[key] }).first(), {
    after: 700
  })
}
async function save() {
  await r.click(saveButton())
  await r.clear(700)
}
async function closeDialog() {
  await r.clear(150)
  await win.keyboard.press('Escape')
  await r.wait(600)
}

// ---- apertura
await r.overlay()
await r.title(t('I dati dal foglio di calcolo', 'Data from the spreadsheet'))
await r.title(
  t(
    'Ogni riga del foglio è una carta: tabella, copie, colonne e file Excel',
    'Every row of the sheet is a card: table, copies, columns and the Excel file'
  )
)
await r.clear()
const example = button('start.example')
await r.click(example)
await r.clear(2200)
await r.overlay()
await r.click(side(S.sets[0]))
await r.clear(900)
await r.overlay()
await view('set.grid')
await r.focus(
  grid(),
  t(
    'Il set Personaggi: ogni carta viene da una riga del foglio Personaggi',
    'The Characters set: every card comes from a row of the Characters sheet'
  ),
  'right',
  { pad: 6 }
)
await r.focus(
  win.locator('.data-readonly').first(),
  t(
    `Il foglio sta nel file ${S.file}, nella cartella data del progetto`,
    `The sheet is in the ${S.file} file, in the project’s data folder`
  ),
  'right'
)

// ---- la tabella
await r.title(t('La tabella', 'The table'))
await view('set.table')
await r.focus(
  table(),
  t(
    'Tabella mostra lo stesso set come un foglio di calcolo',
    'Table shows the same set as a spreadsheet'
  ),
  'below',
  { pad: 4 }
)
await r.focus(
  win.locator('.data-table thead tr').first(),
  t(
    'Una colonna per ogni campo che il template legge: nome, forza, ritratto, testo…',
    'One column for every field the template reads: name, strength, portrait, text…'
  ),
  'below'
)
await r.focus(
  win.locator('.data-table tbody tr').nth(3),
  t('E una riga per ogni carta', 'And one row for every card'),
  'below'
)
await editCell(3, S.strength, '7')
await r.focus(
  td(3, S.strength),
  t(
    'Doppio clic su una cella, il valore nuovo, Invio: la carta cambia subito',
    'Double-click a cell, type the new value, Enter: the card changes at once'
  ),
  'below'
)
await r.focus(
  preview(),
  t(
    'L’anteprima a destra mostra la carta della riga selezionata',
    'The preview on the right shows the card of the selected row'
  ),
  'left',
  { pad: 4 }
)

// ---- le copie
await r.title(t('Quante copie', 'How many copies'))
await r.focus(
  th('amount'),
  t(
    'La colonna amount dice quante copie stampare di ogni carta. Vuota vale 1',
    'The amount column says how many copies of each card to print. Empty means 1'
  ),
  'below'
)
await editCell(0, 'amount', '3')
await r.focus(
  win.locator('.set-header .set-template').first(),
  t('Il conteggio delle carte tiene conto delle copie', 'The card count includes the copies'),
  'below'
)

// ---- carte nuove
await r.title(t('Carte nuove', 'New cards'))
await r.click(rowNum(4))
await r.focus(
  button('set.duplicate'),
  t(
    'Duplica copia la riga selezionata: si parte da una carta simile',
    'Duplicate copies the selected row: start from a similar card'
  ),
  'below'
)
await r.click(button('set.duplicate'))
await editCell(5, S.name, S.bard)
await editCell(5, 'amount', '1')
await editCell(5, S.text, S.bardText)
await r.focus(
  win.locator('.data-table tbody tr').nth(5),
  t(
    'Un nuovo personaggio, il Bardo, scritto direttamente nella tabella',
    'A new character, the Bard, written straight into the table'
  ),
  'below'
)
await r.focus(
  button('set.addCard'),
  t(
    '+ Carta aggiunge una riga vuota, Elimina toglie le righe selezionate',
    '+ Card adds an empty row, Delete removes the selected rows'
  ),
  'below'
)

// ---- più carte insieme
await r.title(t('Più carte insieme', 'Several cards at once'))
await r.click(rowNum(1))
await clickWith(rowNum(2), 'Shift')
await r.focus(
  win.locator('.data-table tbody tr.selected').first(),
  t(
    'Clic sul numero di riga, poi Maiuscolo e clic: due righe selezionate',
    'Click a row number, then Shift-click: two rows selected'
  ),
  'below'
)
const str = cardField(S.strength)
await r.focus(
  str,
  t(
    'Il modulo a destra le modifica tutte e due: ciò che scrivi va in entrambe',
    'The form on the right edits both: what you type goes into both'
  ),
  'left'
)
await r.click(str, { after: 250 })
await win.keyboard.press('Control+A')
await r.type('5')
await win.keyboard.press('Tab')
await r.wait(700)
await r.focus(
  win.locator('.data-table tbody tr.selected').first(),
  t('Arciere e Strega ora hanno forza 5', 'Archer and Witch now have strength 5'),
  'below'
)

// ---- ordinare e filtrare
await r.title(t('Ordinare e filtrare', 'Sorting and filtering'))
await r.click(th(S.strength))
await r.focus(
  th(S.strength),
  t(
    'Un clic sull’intestazione ordina le righe: crescente, poi decrescente, poi l’ordine del foglio',
    'A click on the header sorts the rows: ascending, then descending, then the sheet order'
  ),
  'below'
)
await r.focus(
  table(),
  t(
    'L’ordine cambia solo la vista: il foglio e l’esportazione restano come sono',
    'Sorting only changes the view: the sheet and the export stay as they are'
  ),
  'below',
  { pad: 4 }
)
const filter = win.getByPlaceholder(T['set.filter']).first()
await r.click(filter, { after: 250 })
await r.type(t('carta', 'card'))
await r.wait(800)
await r.focus(
  filter,
  t(
    'Filtra mostra solo le righe che contengono un testo, in tutte le colonne o in una sola',
    'Filter shows only the rows that contain a text, in every column or in just one'
  ),
  'below'
)
await r.click(button('set.clearView'))
await r.wait(600)

// ---- statistiche
await r.title(t('Statistiche', 'Statistics'))
await r.click(
  win.locator('.set-header ~ * button, button').filter({ hasText: T['set.checks'] }).first()
)
await r.wait(400)
await r.click(win.getByRole('menuitem', { name: T['set.stats'] }).first())
await r.wait(800)
await dialog().locator('select').first().selectOption(S.strength)
await r.wait(700)
await r.focus(
  dialog().locator('.stats-table-wrap').first(),
  t(
    'Quante carte hanno ogni valore: serve a bilanciare il set',
    'How many cards have each value: useful to balance the set'
  ),
  'left',
  { pad: 4 }
)
await r.focus(
  dialog().locator('.stats-numbers').first(),
  t(
    'Per i numeri anche somma, media, minimo e massimo. Le copie contano',
    'For numbers also sum, mean, minimum and maximum. Copies count'
  ),
  'left',
  { pad: 4 }
)
await closeDialog()

// ---- colonne delle proprietà
await r.title(t('Colonne delle proprietà', 'Property columns'))
await r.click(button('set.addColumn'))
await r.wait(700)
const layerSelect = dialog().locator('select').first()
await layerSelect.selectOption(S.name)
await r.wait(600)
await r.focus(
  layerSelect,
  t(
    'Ogni proprietà di un livello può cambiare carta per carta: qui il colore del nome',
    'Every property of a layer can change card by card: here the color of the name'
  ),
  'below'
)
await r.click(
  dialog()
    .locator('.chips button')
    .filter({ hasText: /^color$/ })
    .first()
)
await r.wait(800)
await editCell(3, `${S.name}.color`, '#FFD27A')
await r.focus(
  td(3, `${S.name}.color`),
  t(
    'La colonna nome.color: il Drago ha il nome dorato, le altre carte quello del template',
    'The name.color column: the Dragon has a golden name, the other cards the template’s'
  ),
  'below'
)
await r.focus(preview(), t('Il nome del Drago è dorato', 'The Dragon’s name is golden'), 'left', {
  pad: 4
})
await r.focus(
  button('columns.button'),
  t(
    'Colonne sceglie quali colonne mostrare nella tabella e nel modulo',
    'Columns chooses which columns to show in the table and in the form'
  ),
  'below'
)
await save()

// ---- un set nuovo
await r.title(t('Un set nuovo', 'A new set'))
await r.click(titled('sidebar.newSet'))
await r.wait(700)
const nameInput = dialog().locator('input').first()
await r.click(nameInput, { after: 200 })
await r.type(S.monsters)
await dialog().locator('select').first().selectOption(S.template)
await r.wait(600)
await r.focus(
  dialog().locator('.dialog-form').first(),
  t(
    'Nome, template e foglio: un foglio nuovo con le colonne che il template legge',
    'Name, template and sheet: a new sheet with the columns the template reads'
  ),
  'left',
  { pad: 4 }
)
await r.click(button('newSet.create', dialog()))
await r.clear(1000)
await view('set.table')
await r.click(button('set.addCard'))
await r.wait(600)
await editCell(0, S.name, S.goblin)
await editCell(0, S.strength, '2')
await editCell(0, S.portrait, it ? 'ladro' : 'thief')
await r.focus(
  win.locator('.data-table tbody tr').first(),
  t(
    'Il set Mostri ha il suo foglio nel file dei dati, e la prima carta',
    'The Monsters set has its own sheet in the data file, and its first card'
  ),
  'below'
)
await save()

// ---- il file fuori da Stella
await r.title(t('Il file dei dati in Excel', 'The data file in Excel'))
await r.click(side(S.sets[0]))
await r.clear(900)
await view('set.table')
await r.title(
  t(
    'Il file dei dati è un normale foglio di calcolo: si apre con Excel, LibreOffice o Numbers, anche con il progetto aperto',
    'The data file is an ordinary spreadsheet: it opens in Excel, LibreOffice or Numbers, even with the project open'
  ),
  5200
)
// un altro programma cambia il testo del Ladro e salva il file
const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(`${project}/data/${S.file}`)
const ws = wb.getWorksheet(S.sets[0])
const heads = ws.getRow(1).values
const col = heads.indexOf(S.text)
ws.eachRow((row, i) => {
  if (i > 1 && row.getCell(heads.indexOf(S.name)).value === (it ? 'Ladro' : 'Thief'))
    row.getCell(col).value = S.thiefText
})
await wb.xlsx.writeFile(`${project}/data/${S.file}`)
await r.wait(2500)
const thief = win
  .locator('.data-table tbody tr')
  .filter({ hasText: it ? 'Ladro' : 'Thief' })
  .first()
await r.focus(
  thief,
  t(
    'Qui il file è stato cambiato da un altro programma: appena lo salvi, Stella lo rilegge da sola',
    'Here another program changed the file: as soon as you save it, Stella reads it again by itself'
  ),
  'below'
)
await r.focus(
  win.locator('.data-readonly').first(),
  t(
    'Per modificare i dati solo in Excel: in sola lettura, e Stella non scrive più nel file',
    'To edit the data only in Excel: read-only, and Stella no longer writes to the file'
  ),
  'right'
)
const check = button('sidebar.checkData')
await check.scrollIntoViewIfNeeded()
await r.click(check)
await r.wait(900)
await r.focus(
  dialog(),
  t(
    'Controlla file dati mostra come Stella legge ogni foglio e le anomalie, senza toccare il file',
    'Check data file shows how Stella reads each sheet and any anomalies, without touching the file'
  ),
  'left',
  { pad: 0, dim: false }
)
await closeDialog()

// ---- Google Sheets
const projectMenu = win
  .locator('header.toolbar button')
  .filter({ hasText: T['app.projectMenu'] })
  .first()
await r.click(projectMenu)
await r.wait(400)
if (!(await win.locator('[role=menu]').count())) await r.click(projectMenu)
await r.click(
  win.locator('[role=menu] .menu-item').filter({ hasText: T['app.googleSheets'] }).first()
)
await r.wait(900)
await r.focus(
  dialog(),
  t(
    'I dati possono arrivare anche da un foglio Google condiviso con il link: Progetto → Google Sheets',
    'The data can also come from a Google sheet shared by link: Project → Google Sheets'
  ),
  'left',
  { pad: 0, dim: false }
)
await closeDialog()

// ---- chiusura
await r.title(
  t(
    'Un foglio di calcolo, tante carte: modificale dove ti è più comodo',
    'One spreadsheet, many cards: edit them wherever suits you'
  ),
  4600
)
await r.title(
  t(
    'Tutto il resto è nella guida: stella.lucadj.eu',
    'Everything else is in the guide: stella.lucadj.eu'
  ),
  4000
)
await r.clear(600)
const p = await r.finish()
console.log('VIDEO', p)
