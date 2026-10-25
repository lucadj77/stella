// Video 12: un gioco in più lingue (circa 4 minuti, senza voce), sul progetto di esempio. La finestra delle
// lingue, le colonne @lingua nel foglio, le carte mostrate nell'altra lingua, una formula che restituisce una
// variabile tradotta, i testi ancora da tradurre e l'esportazione per lingua.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node --experimental-strip-types --no-warnings scripts/video/lingue.mjs it|en
// Il video italiano aggiunge l'inglese, quello inglese l'italiano.
// FAST=1 accorcia attese e scrittura; GUIDE_HOME=/tmp/prova per provarlo mentre un altro video si registra.
import { launch } from './lib.mjs'
import { docs } from '../guide/lib.mjs'
import { rmSync } from 'node:fs'
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
      sets: ['Personaggi', 'Oggetti', 'Mercato'],
      other: 'en',
      project: 'Example',
      setNames: ['Characters', 'Items', 'Market'],
      name: 'nome',
      text: 'testo',
      strength: 'forza',
      rows: [
        [
          'Knight',
          'When you attack, draw **one card**.\n{.flavor} The castle will not fall tonight.'
        ],
        ['Archer', 'Can hit an [enemy]{.keyword} at range 2.']
      ],
      vars: [
        ['eroe', 'Eroe', 'Hero'],
        ['gregario', 'Gregario', 'Follower']
      ]
    }
  : {
      folder: 'Example',
      sets: ['Characters', 'Items', 'Market'],
      other: 'it',
      project: 'Esempio',
      setNames: ['Personaggi', 'Oggetti', 'Mercato'],
      name: 'name',
      text: 'text',
      strength: 'strength',
      rows: [
        [
          'Cavaliere',
          'Quando attacchi, pesca **una carta**.\n{.flavor} Il castello non cadrà stanotte.'
        ],
        ['Arciere', 'Può colpire un [nemico]{.keyword} a distanza 2.']
      ],
      vars: [
        ['hero', 'Hero', 'Eroe'],
        ['follower', 'Follower', 'Gregario']
      ]
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
const td = (row, col) => win.locator(`.data-table td[data-cell="${row}:${col}"]`).first()
const form = win.locator('.card-form')
const cardField = (col) =>
  form
    .locator('label')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${col}$`) }) })
    .locator('input, textarea')
    .first()
const cardRow = (col) =>
  form
    .locator('label')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${col}$`) }) })
    .first()
/** un campo di una finestra, dall'etichetta */
const dlgField = (label) =>
  dialog()
    .locator('.field, label')
    .filter({ has: win.locator('.field-label', { hasText: label }) })
    .first()
const props = () => win.locator('aside.properties').first()
const propField = (label) =>
  props()
    .locator('.field, label')
    .filter({ has: win.locator('.field-label', { hasText: label }) })
    .locator('input, textarea')
    .first()
const cardLanguage = () => win.locator('select.card-language').first()

async function zoomTo(locs) {
  const targets = []
  for (const l of [].concat(locs)) {
    const kind = await l
      .first()
      .evaluate((el) => {
        if (el.closest('[role=dialog]')) return 'el'
        if (el.closest('.card-form')) return 'label'
        if (el.matches('td, th, tr') || el.closest('td, th')) return 'el'
        if (el.closest('aside.properties')) return 'el'
        return ''
      })
      .catch(() => '')
    if (!kind) return r.unzoom()
    targets.push(kind === 'label' ? l.first().locator('xpath=ancestor-or-self::label[1]') : l)
  }
  await r.zoom(targets, { max: 1.6 })
}
const focus0 = r.focus.bind(r)
/** focus con lo zoom; wide: true lascia la vista intera (per le finestre grandi) */
r.focus = async (locs, text, sideArg, opts = {}) => {
  if (opts.wide) await r.unzoom()
  else await zoomTo(locs)
  return focus0(locs, text, sideArg, opts)
}
const title0 = r.title.bind(r)
r.title = async (...a) => {
  await r.unzoom(700)
  return title0(...a)
}
async function fill(loc, text, { tab = true } = {}) {
  await loc.scrollIntoViewIfNeeded({ timeout: 8000 }).catch(async (e) => {
    if (process.env.SHOT) await win.screenshot({ path: process.env.SHOT })
    throw e
  })
  await r.click(loc, { after: 250, before: 200, ms: 450 })
  await win.keyboard.press('Control+A')
  await r.type(text)
  if (tab) await win.keyboard.press('Tab')
  await r.wait(250)
}
async function save() {
  await r.click(saveButton())
  await r.clear(700)
}
async function cancel() {
  await r.click(dialog().getByRole('button', { name: T['dialog.cancel'], exact: true }).first())
  await r.clear(500)
}

async function projectMenu(key) {
  const menu = win
    .locator('header.toolbar button')
    .filter({ hasText: T['app.projectMenu'] })
    .first()
  await r.click(menu)
  await r.wait(400)
  if (!(await win.locator('[role=menu]').count())) await r.click(menu)
  await r.click(win.locator('[role=menu] .menu-item').filter({ hasText: T[key] }).first())
  await r.wait(900)
}
async function setLanguage(l) {
  const sel = cardLanguage()
  await r.click(sel, { after: 200 })
  await win.keyboard.press('Escape')
  await sel.selectOption(l)
  await r.wait(1200)
}
const lname = (l) => new Intl.DisplayNames([lang], { type: 'language' }).of(l)

// ---- apertura
await r.overlay()
await r.title(t('Un gioco in più lingue', 'A game in several languages'))
await r.title(
  t(
    'Le stesse carte in italiano e in inglese, dallo stesso progetto',
    'The same cards in English and Italian, from the same project'
  )
)
await r.clear()
await r.click(button('start.example'))
await r.clear(2200)
await r.overlay()
await r.click(side(S.sets[0]))
await r.clear(900)
await r.overlay()
await r.click(
  win.locator('.set-header .segmented button').filter({ hasText: T['set.table'] }).first(),
  {
    after: 700
  }
)

// ---- la finestra delle lingue
await r.title(t('Aggiungere una lingua', 'Adding a language'))
await projectMenu('app.languages')
await r.focus(
  dialog(),
  t(
    'Progetto → Lingue: la prima lingua è la principale, quella delle colonne di sempre',
    'Project → Languages: the first language is the main one, used by the usual columns'
  ),
  'left',
  { pad: 0, dim: false, wide: true }
)
const code = dialog().getByPlaceholder(T['languages.codePlaceholder'])
await fill(code, S.other, { tab: false })
await r.focus(
  code,
  t(
    'Il codice della lingua: en per l’inglese, fr, de, es…',
    'The language code: it for Italian, fr, de, es…'
  ),
  'below'
)
await r.click(dialog().getByRole('button', { name: T['languages.add'], exact: true }).first())
await r.clear(800)
const names = dialog().locator('table.language-names input')
await fill(names.nth(0), S.project)
for (const [i, n] of S.setNames.entries()) await fill(names.nth(i + 1), n)
await r.focus(
  dialog().locator('table.language-names').first(),
  t(
    'I nomi del progetto e dei set nell’altra lingua',
    'The names of the project and the sets in the other language'
  ),
  'below'
)
const check = dialog().locator('label.language-check').first()
if (await check.count())
  await r.focus(
    check,
    t(
      'Salva aggiunge ai fogli una colonna da tradurre per ogni testo: nome@en, testo@en',
      'Save adds a column to translate for each text to the sheets: name@it, text@it'
    ),
    'above'
  )
await r.click(dialog().locator('button.primary').last())
await r.clear(1200)

// ---- le colonne tradotte
await r.title(t('Le colonne da tradurre', 'The columns to translate'))
const th = (col) =>
  win
    .locator('.data-table th .th-sort')
    .filter({ hasText: new RegExp(`^${col}$`) })
    .first()
await th(`${S.name}@${S.other}`).scrollIntoViewIfNeeded()
await r.focus(
  [th(`${S.name}@${S.other}`), th(`${S.text}@${S.other}`)],
  t(
    'Accanto a nome, la colonna nome@en: stesso nome, @ e il codice della lingua',
    'Next to name, the name@it column: same name, @ and the language code'
  ),
  'below'
)
await r.unzoom()
await td(0, S.name).scrollIntoViewIfNeeded()
await r.click(td(0, S.name))
await r.clear(600)
for (const [i, [n, txt]] of S.rows.entries()) {
  if (i > 0) {
    await r.unzoom()
    await td(i, S.name).scrollIntoViewIfNeeded()
    await r.click(td(i, S.name))
    await r.clear(500)
  }
  await fill(cardField(`${S.name}@${S.other}`), n)
  // il testo a capo: Invio nella scheda della carta va a capo, come Alt+Invio in Excel
  const [first, ...rest] = txt.split('\n')
  await fill(cardField(`${S.text}@${S.other}`), first, { tab: false })
  for (const line of rest) {
    await win.keyboard.press('Enter')
    await r.type(line)
  }
  await win.keyboard.press('Tab')
  await r.wait(300)
  if (i === 0)
    await r.focus(
      cardRow(`${S.text}@${S.other}`),
      t(
        'Si traduce nella scheda della carta, nella tabella o direttamente in Excel',
        'Translate in the card form, in the table or directly in Excel'
      ),
      'left'
    )
}
await r.unzoom()
await save()

// ---- le carte nell'altra lingua
await r.title(t('Le carte in inglese', 'The cards in Italian'))
await r.focus(
  cardLanguage(),
  t(
    'Il menu accanto al nome del progetto sceglie la lingua delle carte',
    'The menu next to the project name chooses the card language'
  ),
  'below',
  { wide: true }
)
await setLanguage(S.other)
await r.click(
  win.locator('.set-header .segmented button').filter({ hasText: T['set.grid'] }).first(),
  {
    after: 900
  }
)
await r.focus(
  win.locator('.card-grid').first(),
  t(
    'Cavaliere e Arciere sono tradotti; le altre carte usano l’italiano finché la cella è vuota',
    'Knight and Archer are translated; the other cards use English while the cell is empty'
  ),
  'right',
  { pad: 6, wide: true }
)
await r.focus(
  win.locator('.card-grid .card-cell').first(),
  t(
    'Ma «Eroe» viene da una formula: non è nel foglio',
    'But “Hero” comes from a formula: it is not in the sheet'
  ),
  'right',
  { wide: true }
)

// ---- la formula che restituisce una variabile
await r.title(t('Una formula tradotta', 'A translated formula'))
for (const [v, main, tr] of S.vars) {
  await r.click(titled('sidebar.newVariable'))
  await r.clear(900)
  await fill(dlgField(T['variable.name']).locator('input').first(), v)
  await r.click(
    dlgField(T['variable.type'])
      .getByRole('button', { name: T['variable.type.value'], exact: true })
      .first(),
    { after: 500 }
  )
  await fill(
    dlgField(new RegExp(`^${T['variable.value']}$`))
      .locator('input, textarea')
      .first(),
    main
  )
  const trField = dlgField(new RegExp(`^${T['variable.value']} · `))
    .locator('input, textarea')
    .first()
  await fill(trField, tr)
  if (v === S.vars[0][0])
    await r.focus(
      dlgField(new RegExp(`^${T['variable.value']} · `)),
      t(
        'Una variabile valore con la sua traduzione: «Eroe», in inglese «Hero»',
        'A value variable with its translation: “Hero”, in Italian “Eroe”'
      ),
      'below'
    )
  await r.click(dialog().locator('button.primary').last())
  await r.clear(800)
}
await r.click(win.getByText(T['preview.editTemplate']).first())
await r.clear(1600)
await r.click(
  win.locator('.layers .layer-name', { hasText: new RegExp(`^${it ? 'rango' : 'rank'}$`) }).first(),
  { after: 600 }
)
const formula = propField(new RegExp(`^${T['source.formula']}$`))
await r.focus(
  formula,
  t(
    'Il rango è una formula che scrive «Eroe» o «Gregario»',
    'The rank is a formula that writes “Hero” or “Follower”'
  ),
  'left'
)
await fill(formula, `=IF({${S.strength}}>=4; "{${S.vars[0][0]}}"; "{${S.vars[1][0]}}")`, {
  tab: true
})
await r.wait(900)
await r.focus(
  formula,
  t(
    'Restituisce la variabile, che si scrive nella lingua della carta',
    'It returns the variable, which is written in the card language'
  ),
  'left'
)
await save()
await r.click(side(S.sets[0]))
await r.clear(900)
await r.focus(
  win.locator('.card-grid').first(),
  t('Ora il rango è in inglese: HERO, FOLLOWER', 'Now the rank is in Italian: EROE, GREGARIO'),
  'right',
  { pad: 6, wide: true }
)
await setLanguage(lang)
await r.focus(
  win.locator('.card-grid').first(),
  t('E in italiano resta come prima', 'And in English it stays as before'),
  'right',
  { pad: 6, wide: true }
)

// ---- quanto resta da tradurre, l'esportazione
await r.title(t('Quanto resta da tradurre', 'What is left to translate'))
await projectMenu('app.languages')
await r.focus(
  dialog().locator('.language-list').first(),
  t(
    'La finestra Lingue conta i testi ancora da tradurre; stella check li elenca uno per uno',
    'The Languages window counts the texts still to translate; stella check lists them one by one'
  ),
  'below'
)
await cancel()
await r.click(win.locator('header.toolbar button').filter({ hasText: T['app.export'] }).first())
await r.clear(1000)
await r.focus(
  dlgField(new RegExp(`^${T['export.language']}$`)),
  t(
    'In Esporta si sceglie la lingua, o tutte: le altre vanno in export/en',
    'In Export choose the language, or all of them: the others go to export/it'
  ),
  'below'
)
await r.click(dialog().getByRole('button', { name: T['dialog.close'], exact: true }).first())
await r.clear(600)

// ---- chiusura
await r.title(
  t(
    'Anche il regolamento: language: en nella testa del documento',
    'The rulebook too: language: it in the document header'
  ),
  4200
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
