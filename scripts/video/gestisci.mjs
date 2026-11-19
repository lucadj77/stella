// Video 33, approfondimento: la finestra Gestisci il progetto e le immagini, circa 9 minuti senza
// voce, sul progetto «Cripta» di progetto-cripta.mjs, che chi guarda scarica dal sito. Capitoli: la
// finestra; set e template; stili e variabili; trovare le immagini; portarle nel progetto;
// trascinarle ovunque; mettere ordine; i pacchetti; riepilogo.
// Le immagini «dal computer» sono file veri (preparati da progetto-cripta.mjs in Immagini/Cripta):
// il trascinamento si mostra con una miniatura che segue il cursore e si conclude con un vero
// evento di rilascio sull'elemento sotto il cursore.
// Uso: xvfb-run -a -s "-screen 0 2000x1300x24" node scripts/video/gestisci.mjs it|en
// FAST=1 accorcia attese e scrittura; SHOT=<file.png> salva la schermata se un elemento non si trova;
// SNAP=<cartella> salva una schermata dopo ogni testo, e i testi in testi.tsv (per lo storyboard).
import { appendFileSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { launch, mockOpen } from './lib.mjs'
import { docs, home } from '../guide/lib.mjs'
import { computer, make, names } from './progetto-cripta.mjs'
const lang = process.argv[2] || 'it'
const it = lang === 'it'
const t = (a, b) => (it ? a : b)
const N = names(lang)
const { I, V } = N
const dest = `${docs(lang)}/Stella/${N.folder}`
await make(dest, lang)
const pc = await computer(home(lang), lang)
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

/** etichetta senza le parti variabili ({n}, {n:immagine|immagini}) né i puntini finali */
const lab = (key) =>
  T[key]
    .replace(/\{[^}]*\}/g, '')
    .replace(/…$/, '')
    .trim()
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const dialog = () => win.locator('[role="dialog"]').last()
const manageDlg = () =>
  win.locator('[role="dialog"]').filter({ has: win.locator('.manage-dialog') })
const body = () => win.locator('.manage-body').first()
const side = (name) => win.locator('.sidebar').getByText(name, { exact: true }).first()
const manageButton = () => win.locator('.sidebar .sidebar-manage').first()
const sectionManage = (id) => win.locator(`#sidebar-${id} .section-manage`).first()
const tab = (k) =>
  win
    .locator('.manage-tabs button')
    .filter({ hasText: T[`manage.tab.${k}`] })
    .first()
const filter = (text) =>
  body()
    .locator('.images-filters button')
    .filter({ hasText: new RegExp('^' + esc(text)) })
    .first()
const row = (name) =>
  body()
    .locator('tbody tr')
    .filter({ has: win.locator('td', { hasText: new RegExp(`^${esc(name)}$`) }) })
    .first()
const details = () => body().locator('.images-side').first()
const sideButton = (text) =>
  details()
    .locator('button')
    .filter({ hasText: new RegExp('^' + esc(text)) })
    .first()
const link = (name) =>
  details()
    .locator('button.link, a, .link')
    .filter({ hasText: new RegExp(`^${esc(name)}$`) })
    .first()
const tile = (name) =>
  body()
    .locator('.asset-tile')
    .filter({ has: win.locator('.asset-name', { hasText: new RegExp(`^${esc(name)}$`) }) })
    .first()
const group = (title) =>
  body()
    .locator('section')
    .filter({ has: win.locator('h3.asset-grid-title', { hasText: new RegExp(`^${esc(title)}`) }) })
    .first()
const bar = () => body().locator('.asset-picker-bar').first()
const barButton = (key) =>
  bar()
    .locator('button')
    .filter({ hasText: new RegExp('^' + esc(lab(key))) })
    .first()
const folderField = () => body().locator('.images-folder input').first()
const grid = () => win.locator('.card-grid').first()
const form = win.locator('.card-form')
const formField = (col) =>
  form
    .locator('.field')
    .filter({ has: win.locator('.field-label', { hasText: new RegExp(`^${col}$`) }) })
    .first()
const td = (rowI, col) => win.locator(`.data-table td[data-cell="${rowI}:${col}"]`).first()
const setTab = (key) =>
  win.locator('.set-header .segmented button').filter({ hasText: T[key] }).first()
const dlgButton = (text, d = dialog()) =>
  d
    .locator('button')
    .filter({ hasText: new RegExp('^' + esc(text)) })
    .last()

async function key(combo, ms = 700) {
  await r.clear(150)
  await win.keyboard.press(combo)
  await r.wait(ms)
}
async function openManage(loc = manageButton()) {
  await r.click(loc, { after: 1200 })
  await r.overlay()
}
async function closeManage() {
  await r.click(dlgButton(T['dialog.close'], manageDlg()), { after: 900 })
}
async function goTab(k) {
  await r.click(tab(k), { after: 900 })
}
async function openSet(name) {
  await r.click(side(name))
  await r.clear(1000)
  await r.overlay()
}
async function chooseGrouping(value) {
  const sel = bar().locator('.images-group select').first()
  await r.click(sel, { after: 200, before: 200, ms: 450 })
  await win.keyboard.press('Escape')
  await sel.selectOption(value)
  await r.wait(800)
}
async function typeFolder(text) {
  await r.click(folderField(), { after: 250 })
  await win.keyboard.press('Control+A')
  await r.type(text)
  await win.keyboard.press('Tab')
  await r.wait(600)
}

// ================= trascinamento «dal computer»
const fileData = (p) => ({ name: basename(p), b64: readFileSync(p).toString('base64') })
/**
 * Mostra dei file che arrivano trascinati da fuori della finestra fino a `target` e li lascia
 * cadere lì: dragenter, dragover (l'evidenza della zona si vede) e drop sull'elemento sotto il
 * cursore, con veri File
 */
async function dropFiles(paths, target, { ms = 1600, hold = 900 } = {}) {
  await r.clear(150)
  const files = paths.map(fileData)
  const loc = target.first()
  await loc.waitFor({ timeout: 10000 })
  await loc.scrollIntoViewIfNeeded().catch(() => {})
  const b = await loc.boundingBox()
  const x = b.x + b.width / 2
  const y = b.y + Math.min(b.height / 2, 60)
  // la miniatura che segue il cursore, come quella del Finder o di Esplora file
  await win.evaluate((files) => {
    document.getElementById('v-ghost')?.remove()
    const g = document.createElement('div')
    g.id = 'v-ghost'
    Object.assign(g.style, {
      position: 'fixed',
      zIndex: 999998,
      pointerEvents: 'none',
      display: 'flex',
      gap: '6px',
      alignItems: 'center',
      padding: '8px 10px',
      background: 'rgba(255,255,255,.92)',
      border: '1px solid #bbb',
      borderRadius: '10px',
      boxShadow: '0 6px 18px rgba(0,0,0,.25)',
      font: '600 15px system-ui, sans-serif',
      color: '#222',
      opacity: '0.95'
    })
    for (const f of files) {
      if (f.name.toLowerCase().endsWith('.svg')) {
        const img = document.createElement('img')
        img.src = 'data:image/svg+xml;base64,' + f.b64
        Object.assign(img.style, { width: '54px', height: '54px', objectFit: 'contain' })
        g.appendChild(img)
      } else {
        const z = document.createElement('div')
        z.textContent = 'ZIP'
        Object.assign(z.style, {
          width: '54px',
          height: '54px',
          display: 'grid',
          placeItems: 'center',
          background: '#E9D8A6',
          borderRadius: '6px',
          font: '800 16px system-ui'
        })
        g.appendChild(z)
      }
    }
    const label = document.createElement('span')
    label.textContent = files.length === 1 ? files[0].name : `${files.length} file`
    g.appendChild(label)
    document.body.appendChild(g)
    const follow = () => {
      const c = document.getElementById('v-cursor')
      if (!document.getElementById('v-ghost')) return
      if (c) {
        g.style.left = parseFloat(c.style.left) + 18 + 'px'
        g.style.top = parseFloat(c.style.top) + 18 + 'px'
      }
      requestAnimationFrame(follow)
    }
    follow()
  }, files)
  // da fuori della finestra, a destra
  const W = await win.evaluate(() => innerWidth)
  r.cx = W + 40
  r.cy = y
  await r.glide(x, y, ms)
  await win.evaluate(
    ([files, x, y]) => {
      const dt = new DataTransfer()
      for (const f of files) {
        const bin = Uint8Array.from(atob(f.b64), (ch) => ch.charCodeAt(0))
        const type = f.name.endsWith('.svg')
          ? 'image/svg+xml'
          : f.name.endsWith('.zip')
            ? 'application/zip'
            : ''
        dt.items.add(new File([bin], f.name, { type }))
      }
      const el = document.elementFromPoint(x, y)
      window.__vDrop = { el, dt, x, y }
      for (const type of ['dragenter', 'dragover'])
        el.dispatchEvent(
          new DragEvent(type, {
            bubbles: true,
            cancelable: true,
            dataTransfer: dt,
            clientX: x,
            clientY: y
          })
        )
    },
    [files, x, y]
  )
  await r.wait(hold)
  await win.evaluate(() => {
    const { el, dt, x, y } = window.__vDrop
    document.getElementById('v-ghost')?.remove()
    el.dispatchEvent(
      new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
        clientX: x,
        clientY: y
      })
    )
    delete window.__vDrop
  })
  await r.wait(1400)
}

// il selettore dei file del sistema: restituisce i file indicati
const mockPick = (paths) =>
  r.app.evaluate(({ dialog }, paths) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: paths })
  }, paths)
const mockSave = (dir) =>
  r.app.evaluate(({ dialog }, dir) => {
    const save = async (...a) => {
      const o = a[a.length - 1] || {}
      const name = String(o.defaultPath || 'pacchetto.stella.zip')
        .split(/[\\/]/)
        .pop()
      return { canceled: false, filePath: dir + '/' + name }
    }
    dialog.showSaveDialog = save
  }, dir)
const [spider, ghost, bat, mummy, slime] = pc.images

// ================= apertura
await mockOpen(r.app, dest)
await r.overlay()
await r.title(t('Gestisci il progetto e le immagini', 'Manage the project and its images'))
await r.title(
  t(
    'Il progetto «Cripta» si scarica dal link nella descrizione: aprilo e segui passo passo',
    'The “Crypt” project is in the description: open it and follow along'
  )
)
await r.clear()
await r.click(win.getByText(T['start.openProject']).first())
await r.clear(2200)
await r.overlay()
await openSet(N.monsters)
await r.focus(
  grid(),
  t(
    'Eroi, mostri e un segnalino. Il progetto funziona, ma le immagini sono un po’ in disordine',
    'Heroes, monsters and a token. The project works, but its images are a bit of a mess'
  ),
  'below',
  { pad: 4 }
)

// ================= 1. la finestra
await r.title(t('1 · La finestra Gestisci il progetto', '1 · The Manage the project window'))
await r.clear()
await r.focus(
  manageButton(),
  t(
    `${T['manage.button']}, in cima alla barra laterale, apre una finestra grande con tutto il progetto`,
    `${T['manage.button']}, at the top of the sidebar, opens a big window with the whole project`
  ),
  'right',
  { pad: 4 }
)
await r.focus(
  sectionManage('templates'),
  t(
    'Il ⤢ accanto a ogni sezione la apre direttamente sulla scheda di quella sezione',
    'The ⤢ next to each section opens it straight on that section’s tab'
  ),
  'right',
  { pad: 6 }
)
await openManage()
await r.focus(
  win.locator('.manage-tabs').first(),
  t(
    'Una scheda per ogni sezione della barra, più le immagini. Il numero dice quanti elementi ci sono',
    'One tab for each sidebar section, plus the images. The number says how many items there are'
  ),
  'below',
  { pad: 4 }
)
await r.focus(
  body().locator('.images-filters').first(),
  t('Ogni scheda ha i suoi filtri e una ricerca', 'Each tab has its own filters and a search box'),
  'below',
  { pad: 4 }
)

// ================= 2. set e template
await r.title(t('2 · Set e template: cosa usa cosa', '2 · Sets and templates: what uses what'))
await r.clear()
await goTab('sets')
await r.click(row(N.monsters), { after: 900 })
await r.focus(
  details(),
  t(
    'A destra le prime carte del set, il template, le variabili e le immagini che usa',
    'On the right: the set’s first cards, its template, and the variables and images it uses'
  ),
  'left',
  { pad: 4 }
)
await r.focus(
  link(N.tMonster),
  t(
    'I nomi in azzurro sono collegamenti: portano all’elemento nella sua scheda',
    'The blue names are links: they take you to the item in its tab'
  ),
  'left',
  { pad: 6 }
)
await r.click(link(N.tMonster), { after: 1100 })
await r.focus(
  details(),
  t(
    `Siamo nella scheda ${T['manage.tab.templates']}: il template ${N.tMonster}, con la sua variante e il set che lo usa`,
    `We are in the ${T['manage.tab.templates']} tab: the ${N.tMonster} template, with its variant and the set that uses it`
  ),
  'left',
  { pad: 4 }
)
await r.focus(
  body().locator('.images-filters').first(),
  t(
    'I filtri dividono per tipo di componente, base e derivati, e mostrano i template non usati',
    'The filters split by component type, base and derived, and show the unused templates'
  ),
  'below',
  { pad: 4 }
)
await r.focus(
  sideButton(T['manage.openEditor']),
  t(
    `${T['manage.openEditor']} chiude la finestra e apre il template. Sotto ci sono i comandi del menu del template`,
    `${T['manage.openEditor']} closes the window and opens the template. Below are the template menu commands`
  ),
  'left',
  { pad: 4 }
)

// ================= 3. stili e variabili
await r.title(
  t('3 · Stili e variabili: dove sono usati', '3 · Styles and variables: where they are used')
)
await r.clear()
await goTab('variables')
await r.click(row(`{${V.sword}}`), { after: 900 })
await r.focus(
  details(),
  t(
    `{${V.sword}} è usata da tre template, dalle carte dei set e dal regolamento`,
    `{${V.sword}} is used by three templates, by the cards of the sets and by the rulebook`
  ),
  'left',
  { pad: 4 }
)
await r.click(filter(T['manage.filter.unused']), { after: 900 })
await r.focus(
  body().locator('table').first(),
  t(
    `Il filtro dei non usati: {${V.torch}} non compare da nessuna parte`,
    `The unused filter: {${V.torch}} appears nowhere`
  ),
  'below',
  { pad: 4 }
)
await r.click(row(`{${V.torch}}`), { after: 700 })
await r.focus(
  sideButton(T['manage.delete']),
  t(
    'Si può eliminare da qui, anche con Canc. Se fosse usata, l’app lo direbbe prima',
    'You can delete it from here, also with Delete. If it were used, the app would say so first'
  ),
  'left',
  { pad: 4 }
)
await r.click(sideButton(T['manage.delete']), { after: 900 })
const confirmDelete = dialog().locator('button.danger, button.primary').last()
if (await confirmDelete.count()) await r.click(confirmDelete, { after: 900 })
await goTab('styles')
await r.click(row('.' + N.style), { after: 900 })
await r.focus(
  details(),
  t(
    `Lo stile .${N.style}, con una frase di prova, e le carte che lo usano. .${N.oldStyle} invece non lo usa nessuno`,
    `The .${N.style} style, with a sample sentence, and the cards that use it. Nobody uses .${N.oldStyle}`
  ),
  'left',
  { pad: 4 }
)

// ================= 4. trovare le immagini
await r.title(t('4 · Le immagini: trovarle', '4 · Images: finding them'))
await r.clear()
await goTab('images')
await chooseGrouping('none')
await r.focus(
  body().locator('.images-grid-wrap').first(),
  t(
    'Tutte le immagini del progetto, con sotto dove sono usate',
    'All the project images, with where they are used underneath'
  ),
  'right',
  { pad: 4, dim: false }
)
await r.click(filter(T['images.filter.sets']), { after: 800 })
await r.focus(
  body().locator('.images-grid-wrap').first(),
  t(
    `${T['images.filter.sets']}: i ritratti, scelti carta per carta da una colonna. Nessun template li scrive`,
    `${T['images.filter.sets']}: the portraits, picked card by card from a column. No template names them`
  ),
  'none',
  { pad: 4, dim: false }
)
await r.click(filter(T['images.filter.unused']), { after: 800 })
await r.focus(
  body().locator('.images-grid-wrap').first(),
  t(
    `${T['images.filter.unused']}: bozze e prove rimaste nel progetto, e la torcia della variabile appena eliminata`,
    `${T['images.filter.unused']}: drafts and tests left in the project, and the torch of the variable we just deleted`
  ),
  'right',
  { pad: 4, dim: false }
)
await r.click(filter(T['images.filter.all']), { after: 800 })
await r.click(tile(I.parchment), { after: 900 })
await r.focus(
  details(),
  t(
    'Un clic su un’immagine mostra a destra dove compare: template, set, documenti, variabili',
    'Click an image to see on the right where it appears: templates, sets, documents, variables'
  ),
  'left',
  { pad: 4 }
)
await chooseGrouping('template')
await r.focus(
  bar().locator('.images-group').first(),
  t(
    `${T['images.groupBy']} ${T['images.groupBy.template']}: le immagini di ogni template, comprese quelle delle sue carte`,
    `${T['images.groupBy']} ${T['images.groupBy.template']}: the images of each template, including those of its cards`
  ),
  'below',
  { pad: 4 }
)
await chooseGrouping('folder')
await r.focus(
  body().locator('.images-grid-wrap').first(),
  t(
    `Per ${T['images.groupBy.folder']}: quasi tutto è sciolto in assets. È solo una vista, i file restano dove sono`,
    `By ${T['images.groupBy.folder']}: almost everything sits loose in assets. It is only a view, the files stay where they are`
  ),
  'right',
  { pad: 4, dim: false }
)

// ================= 5. mettere ordine
await r.title(t('5 · Mettere ordine', '5 · Tidying up'))
await r.clear()
await r.click(filter(T['images.filter.unused']), { after: 900 })
await r.click(body().locator('.asset-tile').first(), { after: 500 })
await key('Control+a', 800)
await r.focus(
  body().locator('.images-grid-wrap').first(),
  t(
    'Le immagini non usate: ⌘A / Ctrl+A le seleziona tutte, Canc le elimina',
    'The unused images: ⌘A / Ctrl+A selects them all, Delete removes them'
  ),
  'right',
  { pad: 4, dim: false }
)
await key('Delete', 1000)
await r.focus(
  dialog(),
  t(
    'Non sono usate da nessuna parte. Vanno nel cestino del progetto, da cui si recuperano',
    'They are used nowhere. They go to the project trash, where you can get them back'
  ),
  'left',
  { pad: 4 }
)
await r.click(dlgButton(T['images.delete.ok']), { after: 1500 })
await r.click(filter(T['images.filter.all']), { after: 800 })
await r.focus(
  body().locator('.images-folders-tool').first(),
  t(
    `${T['images.groupByTemplate']} mette in una cartella con il nome del template le immagini che usa solo lui`,
    `${T['images.groupByTemplate']} puts the images used by one template only into a folder named after it`
  ),
  'left',
  { pad: 4 }
)
await r.click(body().locator('.images-folders-tool button').first(), { after: 1200 })
await r.focus(
  dialog(),
  t(
    'Prima dice quante immagini sposta e dove. Quelle usate da più template restano dove sono',
    'First it says how many images it moves and where. Those used by several templates stay where they are'
  ),
  'left',
  { pad: 4 }
)
await r.click(dlgButton(T['images.groupByTemplate.ok']), { after: 1800 })
await r.focus(
  body().locator('.images-grid-wrap').first(),
  t(
    `Ora ci sono le cartelle ${N.tHero}, ${N.tWound} e ${N.tMonster}. In assets restano le immagini in comune, come la pergamena`,
    `Now there are the ${N.tHero}, ${N.tWound} and ${N.tMonster} folders. The shared images, like the parchment, stay in assets`
  ),
  'right',
  { pad: 4, dim: false }
)
await closeManage()
await r.focus(
  grid(),
  t(
    'Le carte non sono cambiate: i nomi delle immagini bastano a trovarle, in qualunque cartella',
    'The cards have not changed: image names are enough to find them, in any folder'
  ),
  'below',
  { pad: 4 }
)
await r.click(
  win
    .locator('header.toolbar button')
    .filter({ hasText: /^Progetto|^Project/ })
    .first(),
  {
    after: 700
  }
)
await r.click(win.locator('.menu-panel .menu-item').filter({ hasText: T['app.trash'] }).first(), {
  after: 1500
})
await r.focus(
  dialog(),
  t(
    `Le immagini eliminate sono qui, in ${T['app.trash'].replace('…', '')}: ${T['trash.restore']} le rimette al loro posto`,
    `The deleted images are here, in ${T['app.trash'].replace('…', '')}: ${T['trash.restore']} puts them back`
  ),
  'left',
  { pad: 4 }
)
await r.click(dlgButton(T['dialog.close']), { after: 900 })

// ================= 6. portarle nel progetto
await r.title(t('6 · Portare immagini nel progetto', '6 · Bringing images into the project'))
await r.clear()
await openManage()
await goTab('images')
await r.focus(
  [barButton('assetPicker.addImages'), barButton('assetPicker.importIcons')],
  t(
    `${T['assetPicker.addImages']} sceglie file dal computer, ${T['assetPicker.importIcons']} apre le raccolte di icone`,
    `${T['assetPicker.addImages']} picks files from the computer, ${T['assetPicker.importIcons']} opens the icon collections`
  ),
  'below',
  { pad: 4 }
)
await r.focus(
  folderField(),
  t(
    `${T['images.folder']}: dove finiscono le immagini nuove. Di base è images`,
    `${T['images.folder']}: where new images go. By default it is images`
  ),
  'below',
  { pad: 6 }
)
await typeFolder(N.tMonster)
await r.focus(
  folderField(),
  t(
    `Stiamo per aggiungere mostri: scriviamo ${N.tMonster}. Il progetto ricorda la cartella`,
    `We are about to add monsters: let’s type ${N.tMonster}. The project remembers the folder`
  ),
  'below',
  { pad: 6 }
)
await chooseGrouping('none')
await mockPick([ghost])
await r.click(barButton('assetPicker.addImages'), { after: 1500 })
await r.focus(
  details(),
  t(
    `Il fantasma scelto dal computer è in assets/${N.tMonster}, già selezionato`,
    `The ghost picked from the computer is in assets/${N.tMonster}, already selected`
  ),
  'left',
  { pad: 4 }
)
await dropFiles([mummy], body().locator('.images-grid-wrap'))
await r.focus(
  details(),
  t(
    'Si possono anche trascinare dal computer sulla scheda: vanno nella stessa cartella',
    'You can also drag them from the computer onto the tab: they go into the same folder'
  ),
  'left',
  { pad: 4 }
)
await chooseGrouping('folder')
await dropFiles([bat], group(`assets/${N.backgrounds}`))
await r.focus(
  group(`assets/${N.backgrounds}`),
  t(
    'Con il raggruppamento per cartella, un’immagine lasciata su un gruppo va in quella cartella',
    'When grouped by folder, an image dropped on a group goes into that folder'
  ),
  'right',
  { pad: 4 }
)
await r.click(sideButton(lab('images.move')), { after: 900 })
await r.focus(
  dialog(),
  t(
    `Ma il pipistrello non è uno sfondo: ${T['images.move']} lo sposta, in una cartella che c’è o in una nuova`,
    `But the bat is not a background: ${T['images.move']} moves it, to an existing folder or a new one`
  ),
  'left',
  { pad: 4 }
)
await r.click(
  dialog()
    .locator('.images-folder-list button')
    .filter({ hasText: new RegExp(`/${esc(N.tMonster)}$`) })
    .first(),
  { after: 600 }
)
await r.click(dlgButton(lab('images.moveOk')), { after: 1400 })
await r.focus(
  group(`assets/${N.tMonster}`),
  t(
    'Fatto. Le carte che lo usassero continuerebbero a trovarlo',
    'Done. Any card using it would keep finding it'
  ),
  'right',
  { pad: 4 }
)
await closeManage()

// ================= 7. trascinare ovunque
await r.title(t('7 · Trascinare ovunque', '7 · Drag and drop anywhere'))
await r.clear()
await openSet(N.monsters)
await r.click(win.locator('.set-actions button').first(), { after: 1200 })
await r.focus(
  formField(N.C.portrait),
  t(
    'Una carta nuova: trasciniamo un ritratto dal computer sul campo dell’immagine',
    'A new card: let’s drag a portrait from the computer onto the image field'
  ),
  'left',
  { pad: 4 }
)
await dropFiles([spider], formField(N.C.portrait).locator('input').first())
await r.focus(
  formField(N.C.portrait),
  t(
    `Il campo ora richiama l’immagine, copiata in assets/${N.tMonster}`,
    `The field now names the image, copied into assets/${N.tMonster}`
  ),
  'left',
  { pad: 4 }
)
await r.click(formField(N.C.name).locator('textarea, input').first(), { after: 300 })
await r.type(t('Ragno', 'Spider'))
await win.keyboard.press('Tab')
await r.wait(700)
await r.click(setTab('set.table'), { after: 1200 })
await r.focus(
  td(1, N.C.portrait),
  t(
    'Nella tabella si lascia un’immagine su una cella: diventa il suo valore',
    'In the table you drop an image on a cell: it becomes its value'
  ),
  'below',
  { pad: 4 }
)
await dropFiles([slime], td(1, N.C.portrait))
await r.focus(
  td(1, N.C.portrait),
  t(
    'L’orco ha ora il ritratto della melma. Funziona anche sulla tela dell’editor (un livello nuovo) e nella scelta delle immagini',
    'The orc now has the slime portrait. It also works on the editor canvas (a new layer) and in the image picker'
  ),
  'below',
  { pad: 4 }
)
await key('Control+Z', 900)
await r.click(setTab('set.grid'), { after: 1200 })
await r.title(
  t(
    'Ovunque si trascini, la cartella delle immagini nuove è la stessa: quella scelta in Gestisci › Immagini, nella scelta delle immagini o nel collegamento',
    'Wherever you drop, the folder for new images is the same: the one chosen in Manage › Images, in the image picker or for a link'
  )
)

// ================= 8. pacchetti
await r.title(t('8 · I pacchetti', '8 · Packages'))
await r.clear()
await mockSave(join(home(lang), N.downloads))
await openManage(sectionManage('templates'))
await r.click(row(N.tWound), { after: 900 })
await r.focus(
  sideButton(lab('package.exportMenu')),
  t(
    `${T['package.exportMenu']} salva il template con le sue immagini, variabili e stili in un file .stella.zip`,
    `${T['package.exportMenu']} saves the template with its images, variables and styles in a .stella.zip file`
  ),
  'left',
  { pad: 4 }
)
await r.click(sideButton(lab('package.exportMenu')), { after: 1500 })
const notice = dialog().locator('button.primary').last()
if (await notice.count()) await r.click(notice, { after: 900 })
await closeManage()
await r.title(
  t(
    'Per usarlo in un altro progetto, basta trascinare il file sulla finestra',
    'To use it in another project, just drag the file onto the window'
  )
)
await dropFiles([pc.pkg], grid(), { hold: 600 })
await r.focus(
  dialog(),
  t(
    `Un pacchetto di trappole fatto in un altro progetto: la finestra dice cosa porta e cosa c’è già`,
    `A traps package made in another project: the window says what it brings and what is already here`
  ),
  'below',
  { pad: 4 }
)
await r.click(dlgButton(T['package.import']), { after: 1800 })
await r.focus(
  side(N.tTrap),
  t(
    `Il template ${N.tTrap} è nel progetto, con le sue immagini in assets/${N.traps}`,
    `The ${N.tTrap} template is in the project, with its images in assets/${N.traps}`
  ),
  'right',
  { pad: 4 }
)

// ================= 9. riepilogo
await r.title(t('Riepilogo', 'Summary'))
await r.title(
  t(
    'Gestisci il progetto: una scheda per sezione, nomi collegati, filtri e dove è usato ogni elemento',
    'Manage the project: one tab per section, linked names, filters and where each item is used'
  )
)
await r.title(
  t(
    'Le immagini nuove vanno nella Cartella scelta, che si aggiungano, si trascinino o si scarichino',
    'New images go into the chosen Folder, whether added, dragged or downloaded'
  )
)
await r.title(
  t(
    'Sposta in cartella, Crea cartelle per template e il cestino per mettere ordine senza rompere le carte',
    'Move to folder, Make template folders and the trash to tidy up without breaking the cards'
  )
)
await r.title(
  t(
    'Un pacchetto .stella.zip si trascina sulla finestra di un progetto per importarlo',
    'Drag a .stella.zip package onto a project window to import it'
  )
)
await r.clear()
const raw = await r.finish()
console.log(raw)
