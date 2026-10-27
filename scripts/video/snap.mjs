// Video 19: snap point e tag di Tabletop Simulator (circa 6 minuti, senza voce). Il progetto di esempio con
// i componenti del video 7 (progetto-plance.mjs, come alla fine del video) e in più due spazi per le carte
// del mercato sulla plancia. Tag dei template, livello Snap, snap ruotato, snap su un livello e su ogni
// casella di una griglia, mirini nascosti e snap disattivati, tag per set nell'esportazione. Nessuna
// ripresa dentro Tabletop Simulator.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node --experimental-strip-types --no-warnings scripts/video/snap.mjs it|en
// FAST=1 accorcia attese e scrittura, per provare il percorso senza badare al ritmo.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, makeProject, mockOpen } from './lib.mjs'
import { extend } from './progetto-plance.mjs'
const lang = process.argv[2] || 'it'
const it = lang === 'it'
const t = (a, b) => (it ? a : b)
const project = makeProject(lang)
const N = await extend(project, lang, { final: true })
const market = t('Mercato', 'Market')
const marketTpl = t('mercato', 'market')
const slotA = t('spazio_1', 'slot_1')
const slotB = t('spazio_2', 'slot_2')
const snapName = t('snap_mercato', 'market_snap')
const tagMarket = t('mercato', 'market')
const tagLand = t('terreno', 'land')

// due spazi per le carte del mercato (44 × 63) a destra della mappa, sopra e sotto il tracciato: il
// primo è disegnato in orizzontale, il secondo è una carta in verticale girata di 90°
{
  const file = join(project, 'templates', N.board + '.json')
  const board = JSON.parse(readFileSync(file, 'utf8'))
  const slot = (name, x, y, w, h, rotation = 0) => ({
    type: 'shape',
    name,
    shape: 'rect',
    x,
    y,
    w,
    h,
    rotation,
    radius: 3,
    fill: '#E3D7BF',
    stroke: { color: '#8A7B63', width: 0.6 }
  })
  board.front.splice(
    board.front.length - 1,
    0,
    slot(slotA, 198.5, 30, 63, 44),
    slot(slotB, 207.5, 126, 44, 63, 90)
  )
  writeFileSync(file, JSON.stringify(board, null, 2) + '\n')
}

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
// riquadro e testo spariscono prima di ogni clic: il clic apre finestre o cambia vista
const click0 = r.click.bind(r)
r.click = async (loc, opts) => {
  await r.clear(150)
  return click0(loc, opts)
}

/** zoom sui campi delle proprietà e delle finestre; sulla tela si torna alla vista intera */
async function zoomTo(locs) {
  const targets = []
  for (const l of [].concat(locs)) {
    const kind = await l
      .first()
      .evaluate((el) => {
        if (el.closest('[role=dialog]')) return el.closest('.field') ? 'field' : 'el'
        if (el.closest('aside.properties')) return el.closest('.field') ? 'field' : 'el'
        return ''
      })
      .catch(() => '')
    if (!kind) return r.unzoom()
    targets.push(
      kind === 'field' ? l.first().locator('xpath=ancestor::*[contains(@class,"field")][1]') : l
    )
  }
  await r.zoom(targets, { max: 1.8 })
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

const dialog = () => win.locator('[role="dialog"]').last()
const props = win.locator('aside.properties')
const stage = () => win.locator('.canvas-stage').first()
const field = (label, scope = props) =>
  scope
    .locator('.field')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${label}$`) }) })
    .locator('input:not([type=range]), textarea, select')
    .first()
const layer = (n) => win.locator('.layers .layer-name', { hasText: new RegExp(`^${n}$`) }).first()
const layerRow = (n) =>
  win
    .locator('.layers .layer-row')
    .filter({ has: win.locator('.layer-name', { hasText: new RegExp(`^${n}$`) }) })
    .first()
const tool = (key) =>
  win.locator(`button.tool[title="${T[key]}"], button.tool[data-tip="${T[key]}"]`).first()
const snapToggle = () =>
  win
    .locator('button[aria-pressed]')
    .filter({ hasText: new RegExp(`^${T['editor.showSnaps']}$`) })
    .first()
const side = (name) => win.locator('.sidebar').getByText(name, { exact: true }).first()
const saveButton = () =>
  win
    .locator('header.toolbar button')
    .filter({ hasText: new RegExp(`^(${T['app.save']}|${T['app.saved']})$`) })
    .first()

async function fill(loc, text, { tab = true } = {}) {
  await loc.scrollIntoViewIfNeeded()
  await zoomTo(loc)
  await r.click(loc, { after: 250, before: 200, ms: 450 })
  await win.keyboard.press('Control+A')
  await r.type(text)
  if (tab) await win.keyboard.press('Tab')
  await r.wait(250)
}
async function check(loc) {
  await loc.scrollIntoViewIfNeeded()
  await zoomTo(loc)
  await r.click(loc, { after: 600, before: 200, ms: 450 })
}
async function open(name) {
  await r.click(side(name))
  await r.clear(1000)
  await r.overlay()
}
async function save() {
  await r.click(saveButton())
  await r.clear(600)
}
/** proprietà del template: si deseleziona tutto con un clic sul fondo della tela */
async function templateProps() {
  await win.keyboard.press('Escape')
  await r.wait(300)
}

await r.overlay()
await r.title(
  t('Snap point e tag per Tabletop Simulator', 'Snap points and tags for Tabletop Simulator')
)
await r.title(
  t(
    'Uno snap point è un punto dove un oggetto si aggancia quando lo lasci vicino',
    'A snap point is a spot where an object snaps into place when you drop it nearby'
  ),
  4600
)
await r.title(
  t(
    'Un tag dice quali oggetti si possono agganciare: solo quelli con lo stesso tag',
    'A tag says which objects can snap there: only those with the same tag'
  ),
  4600
)
await r.title(
  t(
    'Funziona con carte, plance, segnalini, tessere e pedine; i dadi non hanno tag',
    'It works with cards, boards, tokens, tiles and standees; dice have no tags'
  ),
  4600
)
await r.clear()
await mockOpen(app, project)
await r.click(win.getByText(T['start.openProject']))
await r.clear(2200)
await r.overlay()

// ---- 1. i tag del template
await r.title(t('I tag del template', 'Template tags'))
await r.clear()
await open(marketTpl)
await templateProps()
await r.focus(
  field(T['prop.kind']),
  t(
    'Nelle proprietà del template, subito sotto il tipo di componente…',
    'In the template properties, right below the component type…'
  ),
  'left'
)
await r.focus(field(T['prop.ttsTags']), t('…il campo Tag TTS', '…the TTS tags field'), 'left')
await fill(field(T['prop.ttsTags']), tagMarket)
await r.focus(
  field(T['prop.ttsTags']),
  t(
    'Più tag si separano con le virgole. Un campo tra graffe, come {tipo}, prende il valore di ogni carta',
    'Separate several tags with commas. A field in braces, like {type}, takes each card’s value'
  ),
  'left'
)
await r.title(
  t(
    'Ogni carta del mercato avrà il tag «' +
      tagMarket +
      '»; il mazzo prende i tag di tutte le sue carte',
    'Every market card gets the “' + tagMarket + '” tag; the deck takes the tags of all its cards'
  ),
  5000
)
await r.clear()
await save()

// ---- 2. il livello Snap
await r.title(t('Il livello Snap', 'The Snap layer'))
await r.clear()
await open(N.board)
await r.focus(
  stage(),
  t(
    'La plancia ha due spazi per le carte del mercato: vogliamo che le carte vi si aggancino',
    'The board has two spaces for the market cards: we want the cards to snap into them'
  ),
  'left',
  { pad: 0 }
)
await r.focus(
  tool('tool.snap'),
  t(
    'Lo strumento Snap (tasto P) mette uno snap point',
    'The Snap tool (P key) places a snap point'
  ),
  'below'
)
await r.click(tool('tool.snap'))
await r.clear(500)
await fill(field(T['prop.name']), snapName)
// il mirino è largo 6 mm: lo si centra nel primo spazio
await fill(field('X'), '227')
await fill(field('Y'), '49')
await r.focus(
  stage(),
  t(
    'Il mirino segna il punto, al centro del primo spazio. Si vede solo qui: non si stampa e non compare nelle anteprime',
    'The crosshair marks the spot, in the middle of the first space. It only shows here: it isn’t printed or shown in previews'
  ),
  'left',
  { pad: 0 }
)
const section = props.locator('h3', { hasText: new RegExp(`^${T['editor.ttsSnap']}$`) }).first()
await section.scrollIntoViewIfNeeded()
await r.focus(
  field(T['prop.snapTags']),
  t(
    'Nella sezione Tabletop Simulator: i tag dello snap',
    'In the Tabletop Simulator section: the snap tags'
  ),
  'left'
)
await fill(field(T['prop.snapTags']), tagMarket)
await r.focus(
  field(T['prop.snapTags']),
  t(
    'Con il tag «' +
      tagMarket +
      '» qui si agganciano solo le carte del mercato. Senza tag, qualsiasi oggetto',
    'With the “' + tagMarket + '” tag only market cards snap here. With no tags, any object does'
  ),
  'left'
)

// ---- 3. snap ruotato
await r.title(t('Uno snap che ruota l’oggetto', 'A snap that turns the object'))
await r.clear()
await r.focus(
  field(T['prop.snapRotated']),
  t(
    'Ruotato: l’oggetto agganciato prende anche la rotazione dello snap',
    'Rotated: the snapped object also takes the snap’s rotation'
  ),
  'left'
)
await check(field(T['prop.snapRotated']))
await r.focus(
  field(T['prop.snapFollow']),
  t(
    'Di base lo snap ha la rotazione del livello. Togliendo la spunta si sceglie un angolo',
    'By default the snap has the layer’s rotation. Untick it to choose an angle'
  ),
  'left'
)
await check(field(T['prop.snapFollow']))
await fill(field(T['prop.snapAngle']), '90')
await r.focus(
  stage(),
  t(
    'La freccia indica dove andrà il lato alto della carta: qui la carta si mette di traverso',
    'The arrow shows where the top of the card will go: here the card lies sideways'
  ),
  'left',
  { pad: 0 }
)
await save()

// ---- 4. lo snap di un livello qualsiasi
await r.title(t('Lo snap su un livello', 'A snap on a layer'))
await r.clear()
await r.click(layer(slotB), { after: 500 })
await r.focus(
  stage(),
  t(
    'Il secondo spazio è un rettangolo girato di 90°: non serve un livello in più',
    'The second space is a rectangle turned 90°: no extra layer needed'
  ),
  'left',
  { pad: 0 }
)
await props
  .locator('h3', { hasText: new RegExp(`^${T['editor.ttsSnap']}$`) })
  .first()
  .scrollIntoViewIfNeeded()
await r.focus(
  field(T['prop.snap']),
  t(
    'Ogni livello ha la casella Snap point: lo snap va al centro del livello',
    'Every layer has the Snap point box: the snap goes to the middle of the layer'
  ),
  'left'
)
await check(field(T['prop.snap']))
await fill(field(T['prop.snapTags']), tagMarket)
await check(field(T['prop.snapRotated']))
await r.focus(
  stage(),
  t(
    'Con «Stessa rotazione del livello» la freccia segue il rettangolo: 90°',
    'With “Same rotation as the layer” the arrow follows the rectangle: 90°'
  ),
  'left',
  { pad: 0 }
)
await fill(field(T['prop.rotation']), '270')
await r.focus(
  stage(),
  t(
    'Giro il rettangolo a 270°: la freccia lo segue. Se sposti o ridimensioni il livello, lo snap viene con lui',
    'I turn the rectangle to 270°: the arrow follows. Move or resize the layer and the snap goes with it'
  ),
  'left',
  { pad: 0 }
)
await check(field(T['prop.snapFollow']))
await r.focus(
  field(T['prop.snapAngle']),
  t(
    'Senza la spunta lo snap ha un angolo suo, indipendente dal livello',
    'Without the tick the snap has its own angle, independent of the layer'
  ),
  'left'
)
await fill(field(T['prop.snapAngle']), '90')
await r.wait(800)
await save()

// ---- 5. uno snap per casella
await r.title(t('Uno snap in ogni casella', 'A snap in every cell'))
await r.clear()
await r.click(layer(N.map), { after: 500 })
await props
  .locator('h3', { hasText: new RegExp(`^${T['editor.ttsSnap']}$`) })
  .first()
  .scrollIntoViewIfNeeded()
await r.focus(
  field(T['prop.snapCells']),
  t('Una griglia può avere uno snap in ogni casella', 'A grid can have a snap in every cell'),
  'left'
)
await check(field(T['prop.snapCells']))
await fill(field(T['prop.snapTags']), tagLand)
await r.focus(
  stage(),
  t(
    'Sessantatré esagoni, sessantatré snap con il tag «' + tagLand + '»',
    'Sixty-three hexagons, sixty-three snaps with the “' + tagLand + '” tag'
  ),
  'left',
  { pad: 0 }
)
await save()
await open(N.land)
await templateProps()
await fill(field(T['prop.ttsTags']), tagLand)
await r.focus(
  field(T['prop.ttsTags']),
  t(
    'Le tessere dei terreni hanno lo stesso tag: solo loro si agganciano alla mappa',
    'The land tiles have the same tag: only they snap onto the map'
  ),
  'left'
)
await save()

// ---- 6. nascondere i mirini e disattivare uno snap
await r.title(t('Nascondere e disattivare', 'Hiding and turning off'))
await r.clear()
await open(N.board)
await r.focus(
  snapToggle(),
  t(
    'Il tasto Snap sopra la tela nasconde i mirini mentre lavori. Gli snap restano',
    'The Snap button above the canvas hides the crosshairs while you work. The snaps stay'
  ),
  'below'
)
await r.click(snapToggle(), { after: 1200 })
await r.focus(stage(), t('Mirini nascosti', 'Crosshairs hidden'), 'left', { pad: 0 })
await r.click(snapToggle(), { after: 1200 })
const eye = layerRow(snapName).locator(`button[title="${T['layers.hide']}"]`).first()
await r.focus(
  eye,
  t(
    'L’occhio invece nasconde il livello: lo snap non c’è più, neanche nell’esportazione',
    'The eye instead hides the layer: the snap is gone, from the export too'
  ),
  'right'
)
await r.click(eye, { after: 1200 })
await r.focus(
  stage(),
  t('Lo snap del primo spazio è sparito', 'The first space’s snap is gone'),
  'left',
  {
    pad: 0
  }
)
await r.click(layerRow(snapName).locator(`button[title="${T['layers.show']}"]`).first(), {
  after: 1000
})
await save()

// ---- 7. i tag per set nell'esportazione
await r.title(t('I tag nell’esportazione', 'Tags in the export'))
await r.clear()
await r.click(win.locator('header.toolbar').getByText(T['app.export'], { exact: true }).first())
await r.clear(800)
await r.click(dialog().locator('.export-goal').filter({ hasText: T['export.goal.tts'] }).first())
await r.wait(600)
const ttsRow = (name) =>
  dialog()
    .locator('.tts-object')
    .filter({ has: win.locator('.tts-object-name', { hasText: new RegExp(`^${name}$`) }) })
    .first()
const tags = (name) => ttsRow(name).locator('input.tts-object-tags').first()
await ttsRow(market).scrollIntoViewIfNeeded()
await r.focus(
  tags(market),
  t(
    'Ogni set ha il suo campo dei tag, già con quelli del template',
    'Each set has its own tags field, already filled with the template’s'
  ),
  'left',
  { pad: 4 }
)
await fill(tags(market), t('mercato, iniziale', 'market, starting'))
await r.focus(
  ttsRow(market),
  t(
    'Se lo cambi, i tag del set prendono il posto di quelli del template: due set con lo stesso template possono avere tag diversi',
    'If you change it, the set’s tags replace the template’s: two sets with the same template can have different tags'
  ),
  'left',
  { pad: 4 }
)
await r.title(
  t(
    'Snap e tag arrivano in Tabletop Simulator con l’oggetto: non c’è niente da impostare là',
    'Snaps and tags reach Tabletop Simulator with the object: nothing to set up there'
  ),
  4600
)
await r.clear()
await r.click(dialog().getByRole('button', { name: T['export.close'], exact: true }))
await r.wait(600)

// ---- chiusura
await r.title(
  t(
    'Tag sui template, snap su livelli e griglie, tag per set nell’esportazione',
    'Tags on templates, snaps on layers and grids, tags per set in the export'
  ),
  4600
)
await r.title(
  t(
    'Tutto il resto è nella guida: stella.lucadj.eu',
    'Everything else is in the guide: stella.lucadj.eu'
  ),
  4600
)
await r.clear(600)
const p = await r.finish()
console.log('VIDEO', p)
