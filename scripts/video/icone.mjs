// Video 11: immagini, icone e font (circa 5 minuti, senza voce), sul progetto di esempio. La scelta delle
// immagini di assets/, le raccolte di icone (game-icons.net, Kenney, Iconify), una variabile icona con la
// tinta usata nel testo, un font scaricato da Google Fonts e i crediti per il regolamento.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node --experimental-strip-types --no-warnings scripts/video/icone.mjs it|en
// FAST=1 accorcia attese e scrittura; GUIDE_HOME=/tmp/prova per provarlo mentre un altro video si registra.
// Iconify dal cloud non si raggiunge: risponde un'API finta con i pacchetti npm in /tmp/stella-guide/ic
// (come scripts/guide/g.mjs).
import { launch } from './lib.mjs'
import { docs } from '../guide/lib.mjs'
import { existsSync, rmSync } from 'node:fs'
const lang = process.argv[2] || 'it'
const it = lang === 'it'
const t = (a, b) => (it ? a : b)
const r = await launch({ lang, ...(process.env.UD ? { ud: process.env.UD } : {}) })
const { app, win, T } = r
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
      name: 'nome',
      text: 'testo',
      portrait: 'ritratto',
      knight: 'Cavaliere',
      search: 'castello',
      tower: 'torre'
    }
  : {
      folder: 'Example',
      sets: ['Characters', 'Items', 'Market'],
      name: 'name',
      text: 'text',
      portrait: 'portrait',
      knight: 'Knight',
      search: 'castle',
      tower: 'tower'
    }
const project = `${docs(lang)}/Stella/${S.folder}`
rmSync(project, { recursive: true, force: true })

// Iconify finto
const IC = '/tmp/stella-guide/ic/'
if (existsSync(IC))
  await app.evaluate(({ net }, base) => {
    const fs = process.mainModule.require('fs')
    const collections = JSON.parse(
      fs.readFileSync(base + 'iconify-collections-1.0.753/package/collections.json', 'utf8')
    )
    const packs = {
      mdi: JSON.parse(fs.readFileSync(base + 'iconify-json-mdi-1.2.3/package/icons.json', 'utf8')),
      twemoji: JSON.parse(
        fs.readFileSync(base + 'iconify-json-twemoji-1.2.5/package/icons.json', 'utf8')
      )
    }
    const json = (d) =>
      new Response(JSON.stringify(d), { headers: { 'content-type': 'application/json' } })
    const original = net.fetch.bind(net)
    net.fetch = async (url, init) => {
      const u = new URL(url)
      if (u.host !== 'api.iconify.design') return original(url, init)
      if (u.pathname === '/collections') return json(collections)
      if (u.pathname === '/collection')
        return json({ uncategorized: Object.keys(packs[u.searchParams.get('prefix')].icons) })
      if (u.pathname === '/search') {
        const q = u.searchParams.get('query')
        const only = u.searchParams.get('prefix')
        const ids = []
        for (const [prefix, p] of Object.entries(packs))
          if (!only || only === prefix)
            for (const n of Object.keys(p.icons)) if (n.includes(q)) ids.push(`${prefix}:${n}`)
        return json({ icons: ids.slice(0, 999) })
      }
      const m = u.pathname.match(/^\/([a-z0-9-]+)\.json$/)
      const p = packs[m[1]]
      const icons = {}
      for (const n of u.searchParams.get('icons').split(',')) if (p.icons[n]) icons[n] = p.icons[n]
      return json({ prefix: m[1], width: p.width, height: p.height, icons })
    }
  }, IC)

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
const collection = (key) => dialog().getByRole('button', { name: T[key], exact: true }).first()
const search = () => dialog().getByPlaceholder(T['icons.search'])

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
  await loc.scrollIntoViewIfNeeded()
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

// ---- apertura
await r.overlay()
await r.title(t('Immagini, icone e font', 'Images, icons and fonts'))
await r.title(
  t(
    'Le immagini del progetto, migliaia di icone pronte e i font di Google',
    'Your project images, thousands of ready icons and Google fonts'
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
await r.click(td(0, S.name))
await r.clear(600)

// ---- la scelta delle immagini
await r.title(t('Le immagini del progetto', 'Your project images'))
await r.focus(
  cardRow(S.portrait),
  t(
    'Il ritratto è il nome di un file della cartella assets: si scrive, o si sceglie',
    'The portrait is the name of a file in the assets folder: type it, or pick it'
  ),
  'left'
)
await r.click(form.locator('.pick-btn').first())
await r.clear(1200)
await r.focus(
  dialog(),
  t(
    'Scegli un’immagine: tutte le immagini di assets, con le anteprime',
    'Pick an image: every image in assets, with previews'
  ),
  'left',
  { pad: 0, dim: false, wide: true }
)
await fill(dialog().getByPlaceholder(T['assetPicker.search']), it ? 'dra' : 'dra', { tab: false })
await r.wait(900)
await r.focus(
  dialog().getByPlaceholder(T['assetPicker.search']),
  t('Si cerca per nome o per cartella', 'Search by name or folder'),
  'below'
)
await fill(dialog().getByPlaceholder(T['assetPicker.search']), '', { tab: false })
await r.wait(600)
await r.focus(
  dialog().getByRole('button', { name: T['assetPicker.addImages'] }).first(),
  t(
    'Aggiungi immagini copia nel progetto i tuoi disegni, dal computer',
    'Add images copies your own drawings into the project, from your computer'
  ),
  'above'
)
await cancel()

// ---- una variabile icona: si importa l'icona e si colora
await r.title(t('Un’icona nel testo', 'An icon in the text'))
await r.focus(
  side('{' + (it ? 'scudo' : 'shield') + '}'),
  t(
    'Le variabili icona si scrivono nel testo tra graffe: {scudo} diventa lo scudo',
    'Icon variables go in the text between braces: {shield} becomes the shield'
  ),
  'right'
)
await r.click(titled('sidebar.newVariable'))
await r.clear(900)
await fill(dlgField(T['variable.name']).locator('input').first(), S.tower)
await r.focus(
  dialog().getByRole('button', { name: T['assetPicker.importIcons'] }).first(),
  t(
    'Una variabile nuova, «torre». L’icona arriva da Importa icone',
    'A new variable, “tower”. The icon comes from Import icons'
  ),
  'below'
)
await r.click(dialog().getByRole('button', { name: T['assetPicker.importIcons'] }).first())
await r.clear(1800)
await r.focus(
  [collection('icons.collection.game-icons'), collection('icons.collection.iconify')],
  t(
    'Quattro raccolte: game-icons.net e Kenney sono già nell’app, anche senza rete',
    'Four collections: game-icons.net and Kenney are already in the app, even offline'
  ),
  'below',
  { wide: true }
)
// Kenney: carte, dadi e pedine
await r.click(collection('icons.collection.kenney-images'))
await r.clear(1200)
await fill(search(), it ? 'dad' : 'dice', { tab: false })
await r.wait(1200)
await r.focus(
  dialog().locator('.asset-tile, .icon-tile').first(),
  t(
    'Kenney: carte, dadi, pedine e segnalini, liberi da usare (CC0)',
    'Kenney: cards, dice, pawns and tokens, free to use (CC0)'
  ),
  'right',
  { wide: true }
)
if (existsSync(IC)) {
  await r.click(collection('icons.collection.iconify'))
  await r.clear(1800)
  await r.focus(
    collection('icons.collection.iconify'),
    t(
      'Iconify, con la rete: oltre 200 000 icone; la licenza di ogni raccolta viene annotata',
      'Iconify, when online: over 200,000 icons; each collection’s license is recorded'
    ),
    'below',
    { wide: true }
  )
}
// game-icons.net, la ricerca anche in italiano
await r.click(collection('icons.collection.game-icons'))
await r.clear(1200)
await fill(search(), S.search, { tab: false })
await r.wait(1400)
await r.focus(
  search(),
  t(
    'La ricerca capisce anche l’italiano: castello trova torri e fortezze',
    'Search by meaning: castle finds towers and fortresses'
  ),
  'below',
  { wide: true }
)
await r.click(dialog().getByText('white-tower', { exact: true }).first(), { after: 600 })
const tint = dialog().locator('.icon-tint').first()
await r.focus(
  [tint, dialog().getByText(T['icons.darkBackground']).first()],
  t(
    'L’anteprima si può colorare e vedere su fondo scuro: il file resta a un colore, da tingere',
    'The preview can be tinted and shown on a dark background: the file stays one color, to tint'
  ),
  'below',
  { wide: true }
)
const names = dialog().locator('.icon-chosen-row input')
await fill(names.first(), S.tower, { tab: false })
await r.focus(names.first(), t('Il nome del file: «torre»', 'The file name: “tower”'), 'above', {
  wide: true
})
await r.click(dialog().locator('button.primary').last())
await r.clear(1500)
// la tinta e la dimensione
const tintRow = dlgField(T['variable.tint'])
await r.click(tintRow.locator('input[type=checkbox]').first())
await r.wait(500)
const hex = tintRow.locator('input:not([type=checkbox]):not([type=color])').first()
if (await hex.count()) await fill(hex, '#B07A1E')
await r.focus(
  tintRow,
  t(
    'La tinta ricolora l’icona: qui l’oro dei personaggi',
    'The tint recolors the icon: here the characters’ gold'
  ),
  'below'
)
await r.focus(
  dlgField(T['variable.scale']),
  t(
    'Dimensione, spostamento, rotazione: come sta nella riga di testo',
    'Size, raise, rotation: how it sits in the line of text'
  ),
  'below'
)
await r.focus(
  dialog().locator('.format-preview').first(),
  t('L’anteprima mostra il risultato', 'The preview shows the result'),
  'right'
)
await r.click(dialog().locator('button.primary').last())
await r.clear(900)
// nel testo del Cavaliere
const text = cardField(S.text)
await text.scrollIntoViewIfNeeded()
await r.click(text, { after: 300 })
await win.keyboard.press('Control+End')
await r.type(` {${S.tower}}`)
await win.keyboard.press('Tab')
await r.wait(900)
await r.focus(
  win.locator('.sidebar-preview, .card-preview, .preview').first(),
  t(
    'Scritta {torre} nel testo, l’icona compare sulla carta',
    'Type {tower} in the text and the icon appears on the card'
  ),
  'left',
  { wide: true, pad: 4 }
)
await save()

// ---- i font
await r.title(t('I font', 'Fonts'))
await r.click(win.getByText(T['preview.editTemplate']).first())
await r.clear(1600)
await r.click(win.locator('.layers .layer-name', { hasText: new RegExp(`^${S.name}$`) }).first(), {
  after: 600
})
const aa = win.locator('aside.properties').getByRole('button', { name: 'Aa', exact: true }).first()
await r.focus(
  aa,
  t(
    'Il livello del nome: il pulsante Aa apre la scelta del font con l’anteprima',
    'The name layer: the Aa button opens the font picker with a preview'
  ),
  'left'
)
await r.click(aa)
await r.clear(1500)
await r.click(dialog().getByText(T['fonts.tabProject'], { exact: true }).first())
await r.wait(900)
await r.focus(
  dialog(),
  t(
    'Nel progetto: i font di assets/fonts e Nunito, incluso nell’app',
    'In the project: the fonts in assets/fonts and Nunito, built into the app'
  ),
  'left',
  { pad: 0, dim: false, wide: true }
)
await r.click(dialog().getByText(T['fonts.tabSystem'], { exact: true }).first())
await r.wait(2000)
await r.focus(
  dialog(),
  t(
    'Sul computer: i font installati, da copiare nel progetto quando la licenza lo permette',
    'On this computer: the installed fonts, copied into the project when the license allows'
  ),
  'left',
  { pad: 0, dim: false, wide: true }
)
await r.click(dialog().getByText('Google Fonts', { exact: true }).first())
await r.wait(2500)
await fill(dialog().getByPlaceholder(T['fonts.search']), 'Cinzel', { tab: false })
await r.wait(2200)
await r.click(
  dialog()
    .locator('.font-row-main')
    .filter({ hasText: /^Cinzel/ })
    .first(),
  { after: 900 }
)
await r.focus(
  dialog(),
  t(
    'Google Fonts: oltre 1700 font liberi, anche per i giochi stampati. Si scelgono gli stili',
    'Google Fonts: over 1,700 free fonts, printed games included. Pick the styles'
  ),
  'left',
  { pad: 0, dim: false, wide: true }
)
await r.click(dialog().locator('.font-row.open button.primary').first())
await r.clear(3500)
await r.focus(
  win.locator('.canvas-stage').first(),
  t(
    'Il font è scaricato in assets/fonts: funziona anche senza rete, e viaggia con il progetto',
    'The font is downloaded to assets/fonts: it works offline too, and travels with the project'
  ),
  'left',
  { pad: 0, wide: true }
)
await save()
await r.click(side(S.sets[0]))
await r.clear(800)
await r.click(
  win.locator('.set-header .segmented button').filter({ hasText: T['set.grid'] }).first(),
  {
    after: 900
  }
)
await r.focus(
  win.locator('.card-grid').first(),
  t('Tutte le carte del set, con il nuovo font', 'Every card in the set, with the new font'),
  'right',
  { pad: 6, wide: true }
)

// ---- i crediti
await r.title(t('I crediti', 'Credits'))
await r.click(win.locator('header.toolbar button').filter({ hasText: T['app.export'] }).first())
await r.clear(1000)
await r.click(dialog().getByRole('button', { name: T['credits.open'] }).first())
await r.clear(1000)
await r.focus(
  dialog(),
  t(
    'Stella annota autore e licenza di ogni icona e font importato: i crediti sono pronti da copiare nel regolamento',
    'Stella records the author and license of every imported icon and font: the credits are ready to copy into the rulebook'
  ),
  'left',
  { pad: 0, dim: false, wide: true }
)
await win.keyboard.press('Escape')
await r.wait(500)
await win.keyboard.press('Escape')
await r.wait(500)

// ---- chiusura
await r.title(
  t(
    'Immagini tue, icone pronte, font liberi: tutto dentro la cartella del progetto',
    'Your images, ready icons, free fonts: all inside the project folder'
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
