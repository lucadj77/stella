// Video 16: generare le carte e dividere un'immagine (circa 5 minuti, senza voce), sul progetto di esempio
// con in più le gilde, 30 ritratti e una mappa (progetto-genera.mjs). Genera… nel menu Strumenti del set:
// insiemi combinati, più valori per carta, limiti e filtro, Aggiorna le carte da una cartella; poi
// Dividi immagine… per una mappa su 3 × 2 carte.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node --experimental-strip-types --no-warnings scripts/video/genera.mjs it|en
// FAST=1 accorcia attese e scrittura; GUIDE_HOME=/tmp/prova per provarlo mentre un altro video si registra.
import { launch, makeProject, mockOpen } from './lib.mjs'
import { extend } from './progetto-genera.mjs'
const lang = process.argv[2] || 'it'
const it = lang === 'it'
const t = (a, b) => (it ? a : b)
const project = makeProject(lang)
const X = await extend(project, lang)
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
      market: 'Mercato',
      guild: 'gilda',
      resources: 'risorse',
      suits: 'spada, scudo, legno, pietra, grano, moneta',
      res: 'legno\npietra\ngrano',
      stone: 'pietra',
      folder: 'images/ritratti',
      map: 'mappa'
    }
  : {
      market: 'Market',
      guild: 'guild',
      resources: 'resources',
      suits: 'sword, shield, wood, stone, wheat, coin',
      res: 'wood\nstone\nwheat',
      stone: 'stone',
      folder: 'images/portraits',
      map: 'map'
    }

const dialog = () => win.locator('[role="dialog"]').last()
const side = (name) => win.locator('.sidebar').getByText(name, { exact: true }).first()
const button = (key, scope = win, vars) =>
  scope
    .getByRole('button', {
      name: vars ? T[key].replace(/\{(\w+)\}/g, (_, k) => vars[k]) : T[key],
      exact: true
    })
    .first()
const grid = () => win.locator('.card-grid').first()
const saveButton = () =>
  win
    .locator('header.toolbar button')
    .filter({ hasText: new RegExp(`^(${T['app.save']}|${T['app.saved']})$`) })
    .first()

async function zoomTo(locs) {
  const targets = []
  for (const l of [].concat(locs)) {
    const kind = await l
      .first()
      .evaluate((el) => {
        if (el.closest('[role=dialog]')) return 'el'
        if (el.closest('aside.properties')) return 'el'
        if (el.closest('.layers')) return 'el'
        return ''
      })
      .catch(() => '')
    if (!kind) return r.unzoom()
    targets.push(l)
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
async function choose(loc, value) {
  await loc.scrollIntoViewIfNeeded()
  await r.click(loc, { after: 200, before: 200, ms: 450 })
  await win.keyboard.press('Escape')
  await loc.selectOption(value)
  await r.wait(600)
}
async function check(loc) {
  await loc.scrollIntoViewIfNeeded()
  await r.click(loc, { after: 400 })
}
async function openSet(name) {
  await r.click(side(name))
  await r.clear(900)
  await r.overlay()
}
async function gridView() {
  const b = win.locator('.set-header .segmented button').filter({ hasText: T['set.grid'] }).first()
  if (await b.isVisible().catch(() => false)) await r.click(b, { after: 700 })
}
async function tools(key) {
  await r.click(win.locator('button').filter({ hasText: T['set.tools'] }).first())
  await r.wait(400)
  await r.click(win.getByRole('menuitem', { name: T[key] }).first())
  await r.clear(900)
}
const gen = () => dialog()
const genSet = (i) => gen().locator('.generate-set').nth(i)
const column = (i) => genSet(i).locator('input[list="generate-columns"]').first()
const values = (i) => genSet(i).locator('.generate-values textarea').first()
const genCheck = (i, key) =>
  genSet(i).locator('label.check').filter({ hasText: T[key] }).locator('input').first()
const preview = () => gen().locator('.generate-preview').first()
const mode = (key) =>
  gen().locator('.dialog-buttons .segmented button').filter({ hasText: T[key] }).first()
const primary = () => gen().locator('.dialog-buttons button.primary').first()

// ---- apertura
await r.overlay()
await r.title(t('Generare le carte e dividere un’immagine', 'Generating cards and splitting an image'))
await r.title(
  t(
    'Tante carte in un colpo solo, e una mappa divisa tra le carte',
    'Many cards in one go, and a map split across cards'
  )
)
await r.clear()
await mockOpen(app, project)
await r.click(win.getByText(T['start.openProject']))
await r.clear(2200)
await r.overlay()

// ---- il template: cosa viene dalle colonne, cosa è fisso
await r.title(t('Il template delle gilde', 'The guild template'))
await r.click(side(S.guild))
await r.clear(1400)
await r.overlay()
await r.focus(
  win.locator('.layers').first(),
  t(
    'Numero, seme e ritratto vengono dalle colonne del set; titolo, cornice e sfondo sono Fissi',
    'Number, suit and portrait come from the set columns; title, frame and background are Fixed'
  ),
  'right',
  { pad: 6 }
)
await r.focus(
  win.locator('.layers').first(),
  t(
    'Fisso: uguale su tutte le carte, quindi non diventa un campo del set',
    'Fixed: the same on every card, so it does not become a set field'
  ),
  'right',
  { pad: 6 }
)

// ---- 1. il caso semplice: due insiemi combinati
await r.title(t('Genera: due insiemi combinati', 'Generate: two sets combined'))
await openSet(X.guilds)
await r.focus(
  win.locator('main').first(),
  t(
    'Il set delle gilde è vuoto: le carte le crea il generatore',
    'The guild set is empty: the generator creates the cards'
  ),
  'right',
  { pad: 6, wide: true }
)
await tools('set.generate')
await r.focus(
  gen(),
  t(
    'Ogni insieme ha una colonna e un elenco di valori',
    'Each set has a column and a list of values'
  ),
  'left',
  { pad: 0, dim: false, wide: true }
)
await fill(column(0), X.N.suit)
await fill(values(0), S.suits, { tab: false })
await r.focus(
  genSet(0),
  t(
    'Sei semi. Come icona scrive {spada}: sulla carta compare l’icona',
    'Six suits. As icon writes {sword}: the card shows the icon'
  ),
  'below',
  { pad: 4 }
)
await r.click(button('generate.addSet', gen()), { after: 600 })
await fill(column(1), X.N.number)
await fill(values(1), '1-5', { tab: false })
await check(genCheck(1, 'generate.icons'))
await r.wait(700)
await r.focus(
  genSet(1),
  t(
    'I numeri da 1 a 5: 1-5 basta. Qui Come icona si toglie: sono numeri, non icone',
    'Numbers 1 to 5: 1-5 is enough. Here As icon goes off: they are numbers, not icons'
  ),
  'below',
  { pad: 4 }
)
await r.focus(
  preview(),
  t(
    '6 semi × 5 numeri = 30 carte: l’anteprima mostra le prime righe',
    '6 suits × 5 numbers = 30 cards: the preview shows the first rows'
  ),
  'above',
  { pad: 4 }
)
await r.focus(
  mode('generate.append'),
  t(
    'Aggiungi in fondo: le carte nuove vanno dopo quelle del set',
    'Add at the end: the new cards go after the ones in the set'
  ),
  'above',
  { pad: 4 }
)
await r.click(primary())
await r.clear(1500)
await gridView()
await r.focus(
  grid(),
  t('Trenta carte, una per combinazione', 'Thirty cards, one per combination'),
  'right',
  { pad: 6, wide: true }
)

// ---- 4. Aggiorna le carte: i ritratti da una cartella
await r.title(t('Aggiorna le carte: i ritratti', 'Update the cards: the portraits'))
await tools('set.generate')
await fill(column(0), X.N.portrait)
await choose(genSet(0).locator('select').first(), '/' + S.folder)
await r.focus(
  genSet(0),
  t(
    'Da una cartella…: i valori sono i nomi delle 30 immagini della cartella dei ritratti',
    'From a folder…: the values are the names of the 30 images in the portraits folder'
  ),
  'below',
  { pad: 4 }
)
await r.click(mode('generate.update'), { after: 700 })
await r.focus(
  gen().locator('.field-note').last(),
  t(
    'Aggiorna le carte scrive solo la colonna del ritratto, una carta per riga: il resto non cambia',
    'Update the cards writes only the portrait column, one card per row: the rest stays as it is'
  ),
  'above',
  { pad: 4 }
)
await r.click(primary())
await r.clear(1500)
await r.focus(
  grid(),
  t('Ogni gilda ha il suo ritratto', 'Each guild has its own portrait'),
  'right',
  { pad: 6, wide: true }
)
await r.click(saveButton())

// ---- 2. più valori per carta
await r.title(t('Più valori sulla stessa carta', 'Several values on the same card'))
await openSet(S.market)
await gridView()
await r.focus(
  grid(),
  t(
    'Le carte del mercato: ognuna chiede alcune risorse',
    'The market cards: each one asks for some resources'
  ),
  'right',
  { pad: 6, wide: true }
)
await tools('set.generate')
await fill(column(0), S.resources)
await fill(values(0), S.res, { tab: false })
await fill(genSet(0).locator('input.num').first(), '3')
await r.wait(500)
await r.focus(
  genSet(0),
  t(
    'Tre risorse su ogni carta, scelte fra legno, pietra e grano',
    'Three resources on each card, chosen from wood, stone and wheat'
  ),
  'below',
  { pad: 4 }
)
await check(genCheck(0, 'generate.repeat'))
await r.focus(
  [genCheck(0, 'generate.repeat'), preview()],
  t(
    'Con ripetizioni: la stessa risorsa può tornare, come legno legno pietra',
    'With repeats: the same resource can come back, as in wood wood stone'
  ),
  'above',
  { pad: 4 }
)

// ---- 3. limiti e filtro
await r.title(t('Limiti e filtro', 'Limits and filter'))
const limits = genSet(0).locator('details.generate-limits').first()
await r.click(limits.locator('summary').first(), { after: 600 })
const stoneMax = limits
  .locator('.generate-limit-value')
  .filter({ hasText: S.stone })
  .locator('xpath=following-sibling::input[2]')
  .first()
await fill(stoneMax, '1')
await r.focus(
  limits,
  t(
    'Limiti per valore: al massimo una pietra per carta',
    'Limits per value: at most one stone per card'
  ),
  'above',
  { pad: 4 }
)
const filter = gen().locator('.generate-filter input').first()
await fill(filter, it ? '=COUNTIN({risorse}; "grano") >= 1' : '=COUNTIN({resources}; "wheat") >= 1', {
  tab: false
})
await r.wait(700)
await r.focus(
  [gen().locator('.generate-filter').first(), preview()],
  t(
    'Il filtro tiene solo le carte con almeno un grano; fx accanto lo scrive con l’assistente',
    'The filter keeps only the cards with at least one wheat; fx next to it writes it with the assistant'
  ),
  'above',
  { pad: 4 }
)
await r.click(mode('generate.replace'), { after: 600 })
await r.click(primary())
await r.wait(800)
const ok = win.locator('[role="dialog"]').last().locator('button.danger, button.primary').last()
await r.focus(
  win.locator('[role="dialog"]').last(),
  t(
    'Sostituisci le carte cancella quelle di prima: Stella chiede conferma',
    'Replace the cards deletes the previous ones: Stella asks first'
  ),
  'below',
  { pad: 0, dim: false, wide: true }
)
await r.click(ok)
await r.clear(1500)
await r.focus(
  grid(),
  t(
    'Il nuovo mercato: tre risorse, al massimo una pietra, sempre almeno un grano',
    'The new market: three resources, at most one stone, always at least one wheat'
  ),
  'right',
  { pad: 6, wide: true }
)

// ---- 5. dividere un'immagine
await r.title(t('Dividere un’immagine tra le carte', 'Splitting an image across cards'))
await openSet(X.map)
await tools('set.split')
const split = dialog()
await fill(split.locator('.split-image input').first(), S.map)
const num = (key) =>
  split.locator('label').filter({ hasText: T[key] }).locator('input[type=number]').first()
await fill(num('split.cols'), '3')
await fill(num('split.rows'), '2')
await r.focus(
  split,
  t(
    'La mappa su 3 colonne e 2 righe di carte: il livello pezzo di ogni carta ne mostra una parte',
    'The map on 3 columns and 2 rows of cards: each card’s piece layer shows one part'
  ),
  'left',
  { pad: 0, dim: false, wide: true }
)
await r.focus(
  split.locator('p.muted.small').last(),
  t(
    'Sei pezzi; le carte che mancano si aggiungono da sole',
    'Six pieces; the missing cards are added automatically'
  ),
  'above',
  { pad: 4 }
)
await r.click(split.locator('button[type=submit]').first())
await r.clear(1500)
await gridView()
// tre carte per riga, così la mappa si ricompone
await win.evaluate(() => {
  const g = document.querySelector('.card-grid')
  const s = document.querySelector('input.thumb-size')
  if (!g || !s) return
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  for (let v = Number(s.max); v >= Number(s.min); v -= 0.1) {
    set.call(s, String(v))
    s.dispatchEvent(new Event('input', { bubbles: true }))
    const cells = [...g.querySelectorAll('.card-cell')]
    if (cells.length > 3 && cells[3].getBoundingClientRect().top > cells[2].getBoundingClientRect().top + 5)
      if (cells[2].getBoundingClientRect().top === cells[0].getBoundingClientRect().top) break
  }
})
await r.wait(800)
await r.focus(
  grid(),
  t(
    'Messe in griglia, tre per riga, le sei carte ricompongono la mappa',
    'Laid out three per row, the six cards put the map back together'
  ),
  'right',
  { pad: 6, wide: true }
)
await r.click(saveButton())

// ---- chiusura
await r.clear()
await r.title(
  t(
    'Genera e Dividi immagine stanno nel menu Strumenti del set',
    'Generate and Split image are in the set’s Tools menu'
  )
)
await r.title(
  t(
    'Tutto il resto è nella guida: stella.lucadj.eu',
    'Everything else is in the guide: stella.lucadj.eu'
  ),
  3800
)
await r.clear(600)
const p = await r.finish()
console.log('VIDEO', p)
