// Video 17: backup e recupero (circa 3 minuti, senza voce), sul progetto di esempio. Salvare, annullare
// con ⌘Z / Ctrl+Z, i backup automatici e a mano, il ripristino in una cartella nuova, il cestino del
// progetto per template e set eliminati.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node --experimental-strip-types --no-warnings scripts/video/backup.mjs it|en
// FAST=1 accorcia attese e scrittura; GUIDE_HOME=/tmp/prova per provarlo mentre un altro video si registra.
import { copyFileSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { launch, makeProject, mockOpen } from './lib.mjs'
import { docs } from '../guide/lib.mjs'
const lang = process.argv[2] || 'it'
const it = lang === 'it'
const t = (a, b) => (it ? a : b)
const ud = process.env.UD || process.env.VIDEO_UD || `/tmp/stella-guide/video-ud-${lang}`

// i backup e le cartelle ripristinate delle registrazioni precedenti non devono comparire
const stella = join(docs(lang), 'Stella')
rmSync(join(stella, 'Backup'), { recursive: true, force: true })
if (existsSync(stella))
  for (const f of readdirSync(stella))
    if (/^(Esempio|Example) /.test(f)) rmSync(join(stella, f), { recursive: true, force: true })
rmSync(join(ud, 'backup-settings.json'), { force: true })

const project = makeProject(lang)
const r = await launch({ lang, ud })
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
  ? { chars: 'Personaggi', market: 'Mercato', marketTpl: 'mercato', strength: 'forza', name: 'nome' }
  : { chars: 'Characters', market: 'Market', marketTpl: 'market', strength: 'strength', name: 'name' }

const dialog = () => win.locator('[role="dialog"]').last()
const side = (name) => win.locator('.sidebar').getByText(name, { exact: true }).first()
const sideItem = (name) =>
  win
    .locator('.sidebar li')
    .filter({ has: win.getByText(name, { exact: true }) })
    .first()
const grid = () => win.locator('.card-grid').first()
const cell = (i) => grid().locator('.card-cell').nth(i)
const saveButton = () =>
  win
    .locator('header.toolbar button')
    .filter({ hasText: new RegExp(`^(${T['app.save']}|${T['app.saved']})$`) })
    .first()
const form = win.locator('.card-form')
const cardField = (col) =>
  form
    .locator('label')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${col}$`) }) })
    .locator('input, textarea')
    .first()

async function zoomTo(locs) {
  const targets = []
  for (const l of [].concat(locs)) {
    const kind = await l
      .first()
      .evaluate((el) => {
        if (el.closest('[role=dialog]')) return 'el'
        if (el.closest('.card-form')) return 'label'
        if (el.closest('.sidebar')) return 'el'
        if (el.closest('header.toolbar')) return 'el'
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
async function fill(loc, text) {
  await r.unzoom()
  await loc.scrollIntoViewIfNeeded()
  await r.click(loc, { after: 250, before: 200, ms: 450 })
  await win.keyboard.press('Control+A')
  await r.type(text)
  await win.keyboard.press('Tab')
  await r.wait(400)
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
/** un comando del menu Progetto */
async function projectMenu(key) {
  await r.click(
    win
      .locator('header.toolbar button')
      .filter({ hasText: T['app.projectMenu'] })
      .first()
  )
  await r.wait(400)
  await r.click(win.getByRole('menuitem', { name: T[key] }).first())
  await r.clear(900)
}
/** il ⋯ accanto a un set o a un template, poi una voce del menu */
async function itemMenu(name, key) {
  const li = sideItem(name)
  await li.hover()
  await r.click(li.locator('button.item-dup').first())
  await r.wait(400)
  await r.click(win.getByRole('menuitem', { name: T[key] }).first())
  await r.wait(700)
}
/** la finestra di conferma: il tasto rosso (o quello principale) */
async function confirm(text) {
  const d = dialog()
  await d.waitFor()
  if (text) await r.focus(d, text, 'below', { pad: 0, dim: false, wide: true })
  await r.click(d.locator('button.danger, button.primary').last())
  await r.clear(900)
}
async function key(combo, ms = 900) {
  await r.clear(150)
  await win.keyboard.press(combo)
  await r.wait(ms)
}
/** la sottocartella dei backup del progetto, quando il primo backup è fatto */
async function backupDir() {
  const root = join(stella, 'Backup')
  for (let i = 0; i < 100; i++) {
    if (existsSync(root)) {
      for (const d of readdirSync(root)) {
        const dir = join(root, d)
        if (readdirSync(dir).some((f) => f.endsWith('.zip'))) return dir
      }
    }
    await win.waitForTimeout(200)
  }
  throw new Error('nessun backup automatico')
}
const pad2 = (n) => String(n).padStart(2, '0')
const stamp = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}.${pad2(d.getMinutes())}.${pad2(d.getSeconds())}`

// ---- apertura
await r.overlay()
await r.title(t('Backup e recupero', 'Backups and recovery'))
await r.title(
  t(
    'Cosa salva Stella da sola, e come si torna indietro',
    'What Stella saves on its own, and how to go back'
  )
)
await r.clear()
await mockOpen(app, project)
await r.click(win.getByText(T['start.openProject']))
await r.clear(2200)
await r.overlay()

// qualche backup automatico dei giorni scorsi, copie di quello fatto all'apertura
{
  const dir = await backupDir()
  const first = readdirSync(dir).find((f) => f.endsWith('.zip'))
  const base = first.replace(/ \d{4}-\d\d-\d\d \d\d\.\d\d\.\d\d( auto)?\.zip$/, '')
  const now = Date.now()
  for (const [h, m] of [
    [52, 17],
    [27, 41],
    [21, 8]
  ]) {
    const d = new Date(now - h * 3600e3 - m * 60e3)
    copyFileSync(join(dir, first), join(dir, `${base} ${stamp(d)} auto.zip`))
  }
}

// ---- 1. salvare
await r.title(t('Salvare', 'Saving'))
await openSet(S.chars)
await gridView()
await r.click(cell(0), { after: 700 })
await fill(cardField(S.strength), '5')
await r.focus(
  sideItem(S.chars),
  t(
    'Il punto accanto al nome: ci sono modifiche non salvate',
    'The dot next to the name: there are unsaved changes'
  ),
  'right',
  { pad: 4 }
)
await r.focus(
  saveButton(),
  t('⌘S / Ctrl+S salva tutto il progetto, ovunque tu sia', '⌘S / Ctrl+S saves the whole project, wherever you are'),
  'below',
  { pad: 4 }
)
await key('Control+S', 1200)
await r.focus(
  sideItem(S.chars),
  t('Salvato: il punto sparisce', 'Saved: the dot goes away'),
  'right',
  { pad: 4 }
)

// ---- 2. annullare
await r.title(t('Annullare', 'Undo'))
await fill(cardField(S.name), t('Cavaliere nero', 'Black Knight'))
await fill(cardField(S.strength), '9')
await r.focus(
  form,
  t('Due modifiche alla carta: il nome e la forza', 'Two changes to the card: the name and the strength'),
  'left',
  { pad: 6, wide: true }
)
// ⌘Z vale sulle carte quando non si sta scrivendo in un campo
await r.click(cell(0), { after: 600 })
await r.focus(
  grid(),
  t(
    '⌘Z / Ctrl+Z annulla un passo alla volta, anche dopo molte modifiche',
    '⌘Z / Ctrl+Z undoes one step at a time, even after many changes'
  ),
  'right',
  { pad: 6, wide: true }
)
await key('Control+Z', 1400)
await key('Control+Z', 1400)
await r.focus(
  win.locator('header.toolbar button').filter({ hasText: '↶' }).first(),
  t('Le stesse frecce sono anche qui, in alto', 'The same arrows are also up here'),
  'right',
  { pad: 4 }
)
await r.focus(
  form,
  t(
    'Tornati com’erano. ⇧⌘Z / Ctrl+Y rifà; nell’editor dei template ⌘Z / Ctrl+Z annulla i livelli',
    'Back as they were. ⇧⌘Z / Ctrl+Y redoes; in the template editor ⌘Z / Ctrl+Z undoes the layers'
  ),
  'left',
  { pad: 6, wide: true }
)

// ---- 3. backup
await key('Control+S', 1000)
await r.title(t('I backup', 'Backups'))
await projectMenu('app.backup')
const bd = dialog()
await r.focus(
  bd.locator('.backup-list').first(),
  t(
    'Un backup automatico a ogni apertura del progetto, al massimo uno all’ora',
    'An automatic backup every time the project opens, at most one an hour'
  ),
  'below',
  { pad: 4 }
)
await r.click(bd.locator('.backup-actions button.primary').first(), { after: 1500 })
await r.focus(
  bd.locator('.backup-list tr').first(),
  t(
    'Crea un backup ora: utile prima di una modifica grossa',
    'Create a backup now: useful before a big change'
  ),
  'below',
  { pad: 4 }
)
await r.focus(
  bd.locator('.backup-settings').first(),
  t(
    'Si tengono gli ultimi 10 automatici; quelli a mano restano finché non li cancelli',
    'The last 10 automatic ones are kept; the manual ones stay until you delete them'
  ),
  'above',
  { pad: 4 }
)
await r.focus(
  bd.locator('.backup-folder').first(),
  t(
    'Stanno in Documenti/Stella/Backup, fuori dal progetto. Si può scegliere un’altra cartella',
    'They live in Documents/Stella/Backup, outside the project. You can choose another folder'
  ),
  'above',
  { pad: 4 }
)
await r.focus(
  bd.locator('p.muted.small').first(),
  t(
    'Occupano poco: ogni immagine è salvata una volta sola per tutti i backup',
    'They take little space: each image is stored once for all backups'
  ),
  'above',
  { pad: 4 }
)
await r.click(bd.getByRole('button', { name: T['dialog.close'], exact: true }).first())
await r.clear(700)

// ---- 4. ripristinare
await r.title(t('Ripristinare un backup', 'Restoring a backup'))
await r.click(cell(0), { after: 500 })
await key('Control+A', 900)
await r.focus(
  grid(),
  t('Un errore grosso: tutte le carte selezionate…', 'A big mistake: all the cards selected…'),
  'right',
  { pad: 6, wide: true }
)
await r.click(
  win
    .locator('section.content button')
    .filter({ hasText: new RegExp(`^${T['set.delete']}$`) })
    .first()
)
await confirm()
await key('Control+S', 1200)
await r.focus(
  win.locator('main').first(),
  t(
    '…eliminate e salvate. ⌘Z / Ctrl+Z basterebbe, ma facciamo finta di aver chiuso Stella',
    '…deleted and saved. ⌘Z / Ctrl+Z would do, but let’s pretend Stella was closed'
  ),
  'right',
  { pad: 6, wide: true }
)
await projectMenu('app.backup')
await r.click(bd.locator('.backup-list tr').first().locator('button').first(), { after: 900 })
await confirm(
  t(
    'Il backup va in una cartella nuova accanto al progetto e si apre; il progetto attuale resta com’è',
    'The backup goes into a new folder next to the project and opens; the current project stays as it is'
  )
)
await r.clear(2500)
await r.overlay()
await openSet(S.chars)
await gridView()
await r.focus(
  grid(),
  t('Le carte sono tornate', 'The cards are back'),
  'right',
  { pad: 6, wide: true }
)

// ---- 5. il cestino
await r.title(t('Il cestino del progetto', 'The project trash'))
await itemMenu(S.market, 'sidebar.delete')
await confirm(
  t(
    'Un set eliminato non sparisce: al salvataggio il suo foglio va nel cestino',
    'A deleted set does not vanish: when you save, its sheet goes to the trash'
  )
)
await key('Control+S', 1200)
await itemMenu(S.marketTpl, 'sidebar.delete')
await confirm(
  t('Anche il template va nel cestino', 'The template goes to the trash too')
)
await projectMenu('app.trash')
const td = dialog()
await r.focus(
  td.locator('.trash-list').first(),
  t(
    'Progetto → Cestino…: template, set, note e documenti eliminati',
    'Project → Trash…: deleted templates, sets, notes and documents'
  ),
  'below',
  { pad: 4 }
)
const trashRow = (kind) =>
  td
    .locator('.trash-list li')
    .filter({ has: win.locator('.trash-kind', { hasText: new RegExp(`^${T[`trash.kind.${kind}`]}$`) }) })
    .first()
await r.click(trashRow('template').locator('button').last(), { after: 1000 })
if (!(await td.isVisible().catch(() => false))) await projectMenu('app.trash')
await r.focus(
  trashRow('sheet'),
  t(
    'Prima il template, poi il set: il set ha bisogno del suo template',
    'First the template, then the set: the set needs its template'
  ),
  'below',
  { pad: 4 }
)
await r.click(trashRow('sheet').locator('button').last(), { after: 1000 })
if (await td.isVisible().catch(() => false)) await win.keyboard.press('Escape')
await r.clear(700)
await openSet(S.market)
await gridView()
await r.focus(
  sideItem(S.market),
  t(
    'Il mercato è di nuovo al suo posto. Il cestino è la cartella deleted del progetto',
    'The market is back in place. The trash is the project’s deleted folder'
  ),
  'right',
  { pad: 4 }
)
await key('Control+S', 1200)

// ---- chiusura
await r.clear()
await r.title(
  t(
    'Nella versione web conviene scegliere una cartella per i backup: quelli nel browser si perdono se cancelli i dati del sito',
    'In the web version, choose a folder for backups: the ones in the browser are lost if you clear the site data'
  ),
  5200
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
