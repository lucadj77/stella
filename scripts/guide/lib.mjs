import { _electron } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
const REPO = new URL('../..', import.meta.url).pathname.replace(/\/$/, '')
export const OUT = process.env.OUT || '/tmp/stella-guide/shots'
export async function dict(lang) {
  const m = await import(`${REPO}/src/renderer/src/i18n/${lang}.ts`)
  return m[lang]
}
// GUIDE_HOME: un'altra casa per le prove, mentre un video si registra con quella normale
export const home = (lang) => process.env.GUIDE_HOME || '/Users/luca'
export const docs = (lang) => `${home(lang)}/${lang === 'it' ? 'Documenti' : 'Documents'}`
export function makeProject(lang) {
  const dest = `${docs(lang)}/Stella/${lang === 'it' ? 'Esempio' : 'Example'}`
  execFileSync('node', [
    new URL('./crea-progetto-esempio.mjs', import.meta.url).pathname,
    REPO,
    dest,
    lang
  ])
  return dest
}
export async function launch({
  lang = 'en',
  ud = '/tmp/stella-guide/ud-' + lang,
  w = 1440,
  h = 900,
  theme = 'light',
  open = true
} = {}) {
  const H = home(lang)
  mkdirSync(`${H}/.config`, { recursive: true })
  mkdirSync(docs(lang), { recursive: true })
  writeFileSync(
    `${H}/.config/user-dirs.dirs`,
    `XDG_DOCUMENTS_DIR="$HOME/${lang === 'it' ? 'Documenti' : 'Documents'}"\n`
  )
  const app = await _electron.launch({
    env: { ...process.env, HOME: H, LANG: lang === 'it' ? 'it_IT.UTF-8' : 'en_US.UTF-8' },
    executablePath: `${REPO}/node_modules/electron/dist/electron`,
    args: [`${REPO}/out/main/index.js`, '--user-data-dir=' + ud, '--no-sandbox', '--lang=' + lang]
  })
  // la versione dell'app, non quella di Electron, nella schermata di ingresso
  const version = JSON.parse(readFileSync(`${REPO}/package.json`, 'utf8')).version
  await app.evaluate(({ app }, v) => {
    app.getVersion = () => v
  }, version)
  const win = await app.firstWindow()
  await win.setViewportSize({ width: w, height: h })
  await win.evaluate(
    ([l, t]) => {
      localStorage.setItem('language', l)
      localStorage.setItem('theme', t)
    },
    [lang, theme]
  )
  await win.reload()
  await win.waitForTimeout(800)
  const T = await dict(lang)
  let project
  if (open) {
    project = makeProject(lang)
    await mockOpen(app, project)
    await win.getByText(T['start.openProject']).click()
    await win.waitForTimeout(2500)
  }
  return { app, win, T, project }
}
export const mockOpen = (app, p) =>
  app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [p] })
  }, p)
export async function shot(win, name, opts = {}) {
  await win.waitForTimeout(400)
  await win.screenshot({ path: `${OUT}/${name}.png`, ...opts })
}
// ritaglio attorno a un elemento, con margine
export async function shotEl(win, name, locator, pad = 12) {
  const b = await locator.boundingBox()
  const vp = win.viewportSize()
  const x = Math.max(0, b.x - pad),
    y = Math.max(0, b.y - pad)
  await shot(win, name, {
    clip: {
      x,
      y,
      width: Math.min(vp.width - x, b.width + 2 * pad),
      height: Math.min(vp.height - y, b.height + 2 * pad)
    }
  })
}
// numeri sopra gli elementi, per le figure con le parti dell'interfaccia
export async function annotate(win, items) {
  const boxes = []
  for (const [loc, n, pos = 'tl'] of items) {
    const b = await loc.boundingBox({ timeout: 2000 }).catch(() => (console.log('manca', n), null))
    if (b) boxes.push({ b, n, pos })
  }
  await win.evaluate((boxes) => {
    for (const { b, n, pos } of boxes) {
      const d = document.createElement('div')
      d.className = 'guide-badge'
      d.textContent = n
      if (typeof pos === 'object') {
        pos.x0 = b.x + pos.dx
        pos.y0 = pos.dy !== undefined ? b.y + pos.dy : b.y + b.height / 2 - 13
      }
      const x =
        typeof pos === 'object'
          ? pos.x0
          : pos === 'after'
            ? b.x + b.width + 6
            : pos === 'before'
              ? b.x - 32
              : pos.includes('r')
                ? b.x + b.width - 12
                : pos.includes('c')
                  ? b.x + b.width / 2 - 13
                  : b.x - 6
      const y =
        typeof pos === 'object'
          ? pos.y0
          : pos === 'after' || pos === 'before'
            ? b.y + b.height / 2 - 13
            : pos.includes('b')
              ? b.y + b.height - 14
              : pos.includes('m')
                ? b.y + b.height / 2 - 13
                : b.y - 6
      Object.assign(d.style, {
        position: 'fixed',
        left: x + 'px',
        top: y + 'px',
        width: '26px',
        height: '26px',
        borderRadius: '13px',
        background: '#E4572E',
        color: 'white',
        font: '700 14px/26px system-ui, sans-serif',
        textAlign: 'center',
        zIndex: 99999,
        boxShadow: '0 0 0 2px white'
      })
      document.body.appendChild(d)
    }
  }, boxes)
}
export const clearAnnotations = (win) =>
  win.evaluate(() => document.querySelectorAll('.guide-badge').forEach((e) => e.remove()))
