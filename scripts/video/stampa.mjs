// Video 8: stampare i componenti (circa 7 minuti, senza voce). Il progetto di esempio con i componenti
// del video 7 finiti (progetto-plance.mjs, final): immagini, PDF con abbondanza e segni di taglio,
// fronte-retro e piegatura, la plancia a poster su più A4, preset e profili, foglio di prova, crediti.
// I risultati si vedono con l'anteprima dell'esportazione.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node --experimental-strip-types --no-warnings scripts/video/stampa.mjs it|en
// FAST=1 accorcia attese e scrittura, per provare il percorso senza badare al ritmo.
import { launch, makeProject, mockOpen } from './lib.mjs'
import { extend } from './progetto-plance.mjs'
const lang = process.argv[2] || 'it'
const it = lang === 'it'
const t = (a, b) => (it ? a : b)
const project = makeProject(lang)
const N = await extend(project, lang, { final: true })
const r = await launch({ lang, ...(process.env.UD ? { ud: process.env.UD } : {}) })
const { win, T, app } = r
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
const focus0 = r.focus.bind(r)
r.focus = async (locs, ...rest) => {
  const first = Array.isArray(locs) ? locs[0] : locs
  await first.first().scrollIntoViewIfNeeded()
  return focus0(locs, ...rest)
}

const title0 = r.title.bind(r)
r.title = async (...a) => {
  await r.unzoom(700)
  return title0(...a)
}
/** zoom sui campi e riquadro con il testo sotto (o sopra, se il campo è in basso) */
async function zf(locs, text) {
  await r.zoom(locs, { max: 1.7 })
  const b = await [].concat(locs)[0].first().boundingBox()
  const H = await win.evaluate(() => innerHeight)
  await r.focus(locs, text, b.y + b.height / 2 > H * 0.55 ? 'above' : 'below')
}

const goal = (g) =>
  exp().locator('.export-goal').filter({ hasText: T['export.goal.' + g] }).first()
const cards = it ? 'Personaggi' : 'Characters'
const items = it ? 'Oggetti' : 'Items'
const market = it ? 'Mercato' : 'Market'
const exp = () => win.locator('[role="dialog"]').first()
const dialog = () => win.locator('[role="dialog"]').last()
const efield = (key) =>
  exp()
    .locator('.field')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${T[key]}$`) }) })
    .first()
const control = (key, sel = 'select, input') => efield(key).locator(sel).first()
const check = (key) => exp().locator('label.check', { hasText: T[key] }).first()
const button = (key, scope = exp()) => scope.getByRole('button', { name: T[key], exact: true })

async function choose(loc, value) {
  await r.zoom(loc, { max: 1.7 })
  await r.click(loc, { after: 200, before: 200, ms: 450 })
  await win.keyboard.press('Escape')
  await loc.selectOption(value)
  await r.wait(600)
}
async function fill(loc, text) {
  await r.zoom(loc, { max: 1.7 })
  await r.click(loc, { after: 250, before: 200, ms: 450 })
  await win.keyboard.press('Control+A')
  await r.type(text)
  await win.keyboard.press('Tab')
  await r.wait(400)
}
async function tick(key, on = true) {
  const box = check(key).locator('input')
  await r.zoom(check(key), { max: 1.7 })
  if ((await box.isChecked()) !== on) await r.click(check(key), { after: 600 })
}
/** lascia selezionati solo questi set: prima si aggiungono, poi si tolgono gli altri (nessuno scelto vale tutti) */
async function only(...names) {
  const labels = exp().locator('.export-sets label')
  for (const want of [true, false])
    for (let i = 0; i < (await labels.count()); i++) {
      const label = labels.nth(i)
      if (names.includes((await label.innerText()).trim()) !== want) continue
      if ((await label.locator('input').isChecked()) !== want)
        await r.click(label, { ms: 250, before: 80, after: 150 })
    }
  await r.wait(400)
}
/** apre l'anteprima, mostra le pagine con un testo e la chiude */
async function preview(text, { pages = 0, side = 'left' } = {}) {
  await r.unzoom(600)
  await r.click(button('export.preview'))
  await r.clear(1200)
  const stage = dialog().locator('.export-preview-stage').first()
  await r.focus(stage, text, side, { pad: 4 })
  for (let i = 0; i < pages; i++) {
    await r.click(dialog().locator('.export-preview-nav button').last(), { after: 900 })
  }
  await r.click(button('export.close', dialog()))
  await r.wait(500)
}

await r.overlay()
await r.title(t('Stampare i componenti', 'Printing your components'))
await r.title(
  t(
    'Dal PDF per la stampante di casa ai file per la tipografia',
    'From a PDF for your home printer to files for a print shop'
  )
)
await r.clear()
await mockOpen(app, project)
await r.click(win.getByText(T['start.openProject']))
await r.clear(2200)
await r.overlay()
await r.click(win.locator('header.toolbar').getByText(T['app.export'], { exact: true }).first())
await r.clear(800)
await r.focus(
  exp().locator('.export-goals'),
  t(
    'Si comincia da cosa vuoi fare: stampa a casa, tipografia, Tabletop Simulator o immagini',
    'You start from what you want to do: home printing, print shop, Tabletop Simulator or images'
  ),
  'below'
)
await r.clear()

// ---- 1. le immagini
await r.title(t('Le immagini', 'Images'))
await r.clear()
await r.click(goal('images'))
await r.wait(600)
await only(cards)
await zf(
  efield('export.format'),
  t(
    'Un file per carta: PNG, JPG, WebP o SVG, che si apre nei programmi di grafica',
    'One file per card: PNG, JPG, WebP or SVG, which opens in graphics programs'
  )
)
await zf(
  efield('export.resolution'),
  t(
    'La risoluzione: 300 DPI per la stampa, 150 per lo schermo',
    'The resolution: 300 DPI for print, 150 for the screen'
  )
)
await zf(
  [efield('export.bleed'), efield('export.sides')],
  t(
    'Con o senza abbondanza, solo fronte, solo retro o tutti e due',
    'With or without bleed, front only, back only or both'
  )
)
await fill(control('export.pattern', 'input'), '%set/%side/%n')
await zf(
  efield('export.pattern'),
  t(
    'Il nome dei file: %set, %n, %side e i campi tra graffe. La / crea le cartelle',
    'File names: %set, %n, %side and fields in braces. The / makes folders'
  )
)
await preview(
  t(
    'L’anteprima mostra i file prima di scriverli, con il loro nome',
    'The preview shows the files before writing them, with their names'
  ),
  { pages: 2 }
)

// ---- 2. il PDF
await r.title(t('Il PDF da stampare', 'The PDF to print'))
await r.clear()
await r.click(goal('home'))
await r.wait(600)
await only(cards, items)
await zf(
  [efield('export.page'), efield('export.margin')],
  t('Pagina, orientamento e margini', 'Page, orientation and margins')
)
await zf(
  efield('export.layout'),
  t(
    'Quante carte entrano: Stella le conta da sola, oppure righe × colonne',
    'How many cards fit: Stella counts them, or rows × columns'
  )
)
await preview(
  t(
    'Senza abbondanza le carte sono distanziate, con i segni di taglio agli angoli',
    'Without bleed the cards are spaced out, with crop marks at the corners'
  )
)
await tick('export.bleedTouch')
await choose(control('export.marks'), 'lines')
await zf(
  [efield('export.bleed'), efield('export.marks')],
  t(
    'Con l’abbondanza le carte si toccano: i segni di taglio, qui a linee intere, restano fuori',
    'With bleed the cards touch: the crop marks, here full lines, stay outside'
  )
)
await preview(
  t(
    'Il colore dello sfondo arriva oltre la linea di taglio: niente bordi bianchi se il taglio non è perfetto',
    'The background color goes past the cut line: no white edges if the cut isn’t perfect'
  )
)
await tick('export.autoRotate')
await zf(
  check('export.autoRotate'),
  t(
    'Rotazione: le carte si girano se così ne entrano di più',
    'Rotation: cards are turned when more of them fit that way'
  )
)
await tick('export.continuousCheck')
await zf(
  check('export.continuousCheck'),
  t(
    'Uno dopo l’altro: un set comincia subito dopo il precedente, senza pagine mezze vuote',
    'One after another: a set starts right after the previous one, no half-empty pages'
  )
)

// ---- 3. fronte e retro
await r.title(t('Fronte e retro', 'Front and back'))
await r.clear()
await choose(control('export.duplex'), 'long')
await zf(
  efield('export.duplex'),
  t(
    'Fronte-retro: i retri vanno sulle pagine pari, specchiati per il lato lungo o corto del foglio',
    'Double-sided: backs go on the even pages, mirrored for the long or short edge'
  )
)
await preview(
  t(
    'Pagina 1 i fronti, pagina 2 i retri nella posizione giusta',
    'Page 1 the fronts, page 2 the backs in the right position'
  ),
  { pages: 1 }
)
await zf(
  efield('export.offset'),
  t(
    'Molte stampanti non allineano bene i due lati: lo spostamento dei retri lo corregge',
    'Many printers don’t align both sides well: the back offset fixes it'
  )
)
for (const [line, ms] of [
  [t('1. Stampa una sola pagina fronte-retro', '1. Print a single double-sided page'), 3200],
  [
    t(
      '2. Guarda il foglio controluce e misura di quanto il retro è spostato rispetto al fronte',
      '2. Hold the sheet up to the light and measure how far the back is shifted from the front'
    ),
    4600
  ],
  [
    t(
      '3. Scrivi quei millimetri in x e y, poi stampa tutto',
      '3. Enter those millimeters in x and y, then print everything'
    ),
    3600
  ]
])
  await r.title(line, ms)
await r.clear()
await fill(control('export.offset', 'input'), '1.5')
await r.wait(400)
await tick('export.foldPairs')
await zf(
  efield('export.fold'),
  t(
    'Senza stampante fronte-retro: la piegatura mette fronte e retro affiancati',
    'Without a duplex printer: folding puts front and back side by side'
  )
)
await preview(
  t(
    'Si piega il foglio a metà sulla linea centrale e si ritaglia: carte già fronte-retro',
    'Fold the sheet in half on the center line and cut: cards already double-sided'
  )
)
await tick('export.foldPairs', false)

// ---- 4. la plancia su più fogli
await r.title(t('La plancia su più fogli', 'The board on several sheets'))
await r.clear()
await only(N.boardSet)
await choose(control('export.duplex'), 'none')
await tick('export.bleedTouch', false)
// ruotata, la plancia entra in un A4: senza rotazione si divide
await tick('export.autoRotate', false)
await tick('export.posterSplit')
await zf(
  efield('export.poster'),
  t(
    'Poster: una plancia più grande della pagina si divide su più A4, con un po’ di sovrapposizione',
    'Poster: a board bigger than the page is split over several A4 sheets, with some overlap'
  )
)
await preview(
  t(
    'Ogni parte ha il suo nome (A1, B1…) e i segni per accostarle',
    'Each part has its name (A1, B1…) and marks to line them up'
  ),
  { pages: 3 }
)
await tick('export.posterSplit', false)
await tick('export.autoRotate')

// ---- 5. per la tipografia
await r.title(t('Per la tipografia', 'For a print shop'))
await r.clear()
await r.click(goal('shop'))
await r.wait(600)
await zf(
  goal('shop'),
  t(
    'Tipografia: PDF con abbondanza e segni di taglio, già impostati',
    'Print shop: a PDF with bleed and crop marks, already set'
  )
)
const profile = exp().locator('.profile-bar select').first()
await zf(
  profile,
  t(
    'I preset: MakePlayingCards, The Game Crafter, stampa in casa su A4 o Letter',
    'Presets: MakePlayingCards, The Game Crafter, home printing on A4 or Letter'
  )
)
await choose(profile, T['preset.mpc'])
await r.unzoom(600)
await r.focus(
  exp(),
  t(
    'MakePlayingCards vuole un’immagine per carta a 300 DPI con l’abbondanza: è tutto impostato',
    'MakePlayingCards wants one image per card at 300 DPI with bleed: it’s all set'
  ),
  'none',
  { pad: 0, dim: false }
)
await r.title(
  t(
    'Le specifiche possono cambiare: controllale sempre sul sito della tipografia',
    'Specifications can change: always check them on the print shop’s website'
  ),
  3800
)
await r.clear()
await choose(profile, T['preset.homeA4'])
await only(cards, items)
await r.click(button('export.profileSaveAs'))
await r.clear(300)
await r.type(t('Stampa di prova', 'Test print'))
await r.wait(400)
await zf(
  exp().locator('.profile-bar').first(),
  t(
    'Salva come…: le opzioni diventano un profilo del progetto, da rilanciare con un clic',
    'Save as…: the options become a project profile, to run again with one click'
  )
)
await r.click(exp().locator('.profile-bar button.primary').first())
await r.wait(600)
await tick('export.proof')
await zf(
  efield('export.extras'),
  t(
    'Il foglio di prova: tutte le carte in piccolo, per controllarle prima di consumare carta',
    'The proof sheet: every card small, to check them before using up paper'
  )
)
await zf(
  check('export.cmyk'),
  t(
    'Se la tipografia vuole il CMYK, Stella converte il PDF (serve Ghostscript sul computer)',
    'If the print shop wants CMYK, Stella converts the PDF (it needs Ghostscript on the computer)'
  )
)
const run = button('export.run')
await r.click(run)
await win.waitForTimeout(1000)
for (let i = 0; i < 240 && !(await run.isEnabled()); i++) await win.waitForTimeout(500)
await r.wait(800)
await zf(
  exp().locator('.export-result').first(),
  t(
    'Fatto: il PDF e il foglio di prova sono nella cartella export del progetto',
    'Done: the PDF and the proof sheet are in the project’s export folder'
  )
)

// ---- 6. i crediti
await r.title(t('I crediti', 'Credits'))
await r.clear()
await r.click(button('credits.open'))
await r.clear(1000)
await r.focus(
  dialog(),
  t(
    'Icone e font usati, con fonte, licenza e autore: da mettere nel regolamento o sulla scatola',
    'Icons and fonts used, with source, license and author: for the rulebook or the box'
  ),
  'left',
  { pad: 0 }
)
await r.clear(300)
await r.zoom(dialog().locator('textarea, pre').first(), { max: 1.8, fill: 0.85 })
await r.wait(3500)
await r.unzoom()
await r.click(dialog().getByRole('button', { name: T['dialog.close'], exact: true }).last())
await r.wait(500)
await r.click(button('export.close'))
await r.wait(500)

// ---- chiusura
await r.title(
  t('Dal file alla carta: prova, stampa, ritaglia', 'From file to paper: test, print, cut'),
  4200
)
await r.title(
  t(
    'Tutto il resto è nella guida: stella.lucadj.eu',
    'Everything else is in the guide: stella.lucadj.eu'
  ),
  4200
)
await r.clear(600)
const p = await r.finish()
console.log('VIDEO', p)
