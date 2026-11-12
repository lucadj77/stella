// Prova completa dell'interfaccia: avvia l'app compilata (out/), apre una copia del progetto di
// esempio, cambia il nome di una carta dal modulo, salva e controlla il file dati, esporta un PDF
// da stampare a casa e controlla che ci sia. La usa il workflow Checks; in locale:
//   npx electron-vite build && npm i --no-save playwright-core && xvfb-run -a node scripts/e2e/smoke.mjs
// (su Mac e Windows senza xvfb-run). Esce con 1 al primo controllo che non passa.
import { _electron } from 'playwright-core'
import { cpSync, mkdtempSync, readdirSync, statSync, existsSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const REPO = new URL('../..', import.meta.url).pathname.replace(/\/$/, '')
const require = createRequire(join(REPO, 'package.json'))
const ExcelJS = require('exceljs')
const electron = require('electron')

const work = mkdtempSync(join(tmpdir(), 'stella-e2e-'))
const project = join(work, 'Example')
cpSync(join(REPO, 'resources/examples/en'), project, { recursive: true })

const step = (s) => console.log('· ' + s)
function check(ok, what) {
  if (!ok) throw new Error('failed: ' + what)
  console.log('  ok: ' + what)
}

const app = await _electron.launch({
  executablePath: electron,
  args: [join(REPO, 'out/main/index.js'), '--user-data-dir=' + join(work, 'ud'), '--no-sandbox'],
  env: { ...process.env, HOME: work, LANG: 'en_US.UTF-8' }
})
let failed = false
try {
  const win = await app.firstWindow()
  const errors = []
  win.on('pageerror', (e) => errors.push(e.message))
  await win.setViewportSize({ width: 1440, height: 900 })
  await win.evaluate(() => localStorage.setItem('language', 'en'))
  await win.reload()

  step('open the example project')
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] })
  }, project)
  await win.getByText('Open project…').click()
  await win.locator('.card-cell svg').first().waitFor({ timeout: 30000 })
  check((await win.locator('.card-cell').count()) === 6, 'the grid shows the 6 characters')

  step('change the name of the first card in the form')
  const name = win.locator('.card-form textarea, .card-form input[type=text]').nth(1)
  await win.locator('.card-cell').first().click()
  const before = await name.inputValue()
  await name.fill(before + ' E2E')
  await win.waitForTimeout(500)
  check(
    (await win.locator('.card-cell').first().textContent()).includes('E2E'),
    'the grid shows the new name'
  )

  step('save and read the data file')
  await win.keyboard.press(process.platform === 'darwin' ? 'Meta+S' : 'Control+S')
  const saved = async () => {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(join(project, 'data/cards.xlsx'))
    const cells = []
    wb.worksheets[0].eachRow((r) => r.eachCell((c) => cells.push(String(c.value ?? ''))))
    return cells.some((c) => c.includes('E2E'))
  }
  let written = false
  for (let i = 0; i < 30 && !written; i++) {
    await win.waitForTimeout(500)
    written = await saved().catch(() => false)
  }
  check(written, 'the new name is in data/cards.xlsx')
  check(
    (await win.getByRole('button', { name: 'Saved' }).count()) === 1,
    'the Save button says Saved'
  )

  step('export a PDF to print at home')
  await win
    .getByRole('button', { name: /^Export/ })
    .first()
    .click()
  await win.getByText('Print at home').first().click()
  await win.getByRole('button', { name: 'Export', exact: true }).last().click()
  const exportDir = join(project, 'export')
  const deadline = Date.now() + 60000
  let pdfs = []
  while (Date.now() < deadline) {
    pdfs = existsSync(exportDir) ? readdirSync(exportDir).filter((f) => f.endsWith('.pdf')) : []
    if (pdfs.length && statSync(join(exportDir, pdfs[0])).size > 10000) break
    await win.waitForTimeout(500)
  }
  check(pdfs.length > 0, 'a PDF is written in export/')
  check(statSync(join(exportDir, pdfs[0])).size > 10000, 'the PDF is not empty')
  check(errors.length === 0, 'no errors in the page' + (errors.length ? ': ' + errors[0] : ''))
} catch (e) {
  failed = true
  console.error(e.message)
} finally {
  await app.close().catch(() => undefined)
  rmSync(work, { recursive: true, force: true })
}
process.exit(failed ? 1 : 0)
