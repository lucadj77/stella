// Un secondo schermo per i video che mostrano altri programmi accanto a Stella (video 10): Xvfb con il
// gestore dei file (pcmanfm) e LibreOffice Calc, registrato con ffmpeg. I comandi a tastiera e mouse
// passano da xkeys.py. Come terminale.mjs scrive l'elenco dei pezzi (EDL) per componi.sh: la scrivania
// è la sorgente 'term', e ogni suo pezzo può avere una didascalia che componi.sh disegna in basso.
// Uso: const s = await scrivania(r, { lang }); s.show('app' | 'term' | null, didascalia); … ; await s.finish(nome)
// Serve pcmanfm (apt-get install pcmanfm) oltre a LibreOffice, ffmpeg e python3-xlib.
import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { OUT } from './lib.mjs'

const HERE = new URL('.', import.meta.url).pathname
const W = 1728,
  H = 1080

export async function scrivania(r, { lang, display = ':77' }) {
  const FAST = !!process.env.FAST
  const home = `/tmp/stella-guide/scrivania-${lang}`
  rmSync(home, { recursive: true, force: true })
  mkdirSync(`${home}/.config/pcmanfm/default`, { recursive: true })
  writeFileSync(
    `${home}/.config/pcmanfm/default/pcmanfm.conf`,
    '[ui]\nview_mode=list\nshow_statusbar=1\nside_pane_mode=places\n'
  )
  writeFileSync(
    `${home}/.config/mimeapps.list`,
    '[Default Applications]\napplication/vnd.openxmlformats-officedocument.spreadsheetml.sheet=libreoffice-calc.desktop\n'
  )
  const env = {
    ...process.env,
    DISPLAY: display,
    HOME: home,
    LANG: lang === 'it' ? 'it_IT.UTF-8' : 'en_US.UTF-8',
    // testi più grandi, leggibili nel video a 1080p
    GDK_DPI_SCALE: '1.4',
    SAL_FORCEDPI: '134'
  }
  // profilo di LibreOffice: una prima apertura senza finestre, poi niente suggerimenti all'avvio e
  // niente completamento automatico (cambierebbe il testo scritto)
  execFileSync('soffice', ['--headless', '--terminate_after_init'], { env, stdio: 'ignore' })
  const loVersion = execFileSync('soffice', ['--version'], { encoding: 'utf8' }).match(
    /(\d+\.\d+)/
  )[1]
  const reg = `${home}/.config/libreoffice/4/user/registrymodifications.xcu`
  const item = (path, prop, value) =>
    `<item oor:path="${path}"><prop oor:name="${prop}" oor:op="fuse"><value>${value}</value></prop></item>\n`
  writeFileSync(
    reg,
    readFileSync(reg, 'utf8').replace(
      '</oor:items>',
      item('/org.openoffice.Office.Common/Misc', 'ShowTipOfTheDay', 'false') +
        item('/org.openoffice.Office.Common/Misc', 'FirstRun', 'false') +
        item('/org.openoffice.Office.Calc/Input', 'AutoInput', 'false') +
        // senza la versione dell'ultima apertura compare la barra "che cosa c'è di nuovo"
        item('/org.openoffice.Setup/Product', 'ooSetupLastVersion', loVersion) +
        item('/org.openoffice.Office.Common/AutoCorrect', 'SingleQuoteAtStart', '0') +
        '</oor:items>'
    )
  )

  const procs = []
  // l'ffmpeg della registrazione si chiude per ultimo, con q, in finish()
  const xvfb = spawn('Xvfb', [display, '-screen', '0', `${W}x${H}x24`, '-nolisten', 'tcp'], {
    stdio: 'ignore'
  })
  procs.push(xvfb)
  await new Promise((ok) => setTimeout(ok, 2000))
  const keys = (...cmds) =>
    execFileSync('python3', [`${HERE}/xkeys.py`, display, ...cmds], { stdio: 'inherit' })
  keys('bg:#3b4a5a')
  const rec = `${OUT}/raw/scrivania-${lang}.mp4`
  const ff = spawn(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-f',
      'x11grab',
      '-framerate',
      '30',
      '-video_size',
      `${W}x${H}`,
      '-i',
      display,
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-crf',
      '16',
      '-pix_fmt',
      'yuv420p',
      rec
    ],
    { stdio: ['pipe', 'ignore', 'ignore'] }
  )
  // se lo script si ferma per un errore, niente programmi rimasti aperti sulla scrivania
  process.on('exit', () => {
    for (const p of procs) {
      try {
        p.kill()
      } catch {
        // già chiuso
      }
    }
  })
  await new Promise((ok) => setTimeout(ok, 800))

  /** avvia un programma sulla scrivania */
  function run(cmd, args) {
    const p = spawn(cmd, args, { env, stdio: 'ignore', detached: true })
    procs.push(p)
    return p
  }

  const edl = []
  let cur = null
  /** da qui in poi il video mostra src ('app' o 'term', con una didascalia); null taglia (attese) */
  function show(src, caption) {
    const now = Date.now()
    if (cur && cur.src) edl.push({ src: cur.src, from: cur.at, to: now, caption: cur.caption })
    cur = { src, at: now, caption }
  }
  /** lampo magenta in entrambe le registrazioni: componi.sh li ritrova */
  const marks = { app: [], term: [] }
  const FLASH = `(() => { const d = document.createElement('div'); d.id = 'v-sync'; d.style.cssText = 'position:fixed;inset:0;background:#f0f;z-index:2147483647'; document.body.appendChild(d) })()`
  async function sync() {
    await r.win.evaluate(FLASH)
    marks.app.push(Date.now())
    marks.term.push(Date.now())
    keys('flash:700')
    await r.win.evaluate(`document.getElementById('v-sync').remove()`)
    await new Promise((ok) => setTimeout(ok, 400))
  }
  const pause = (ms) => new Promise((ok) => setTimeout(ok, FAST ? Math.min(ms, 100) : ms))
  /** didascalia sulla scrivania: si legge per un tempo che dipende dalla lunghezza */
  async function say(text, min = 2600) {
    show('term', text)
    await pause(Math.max(min, 1500 + 65 * text.length))
  }
  const type = (text) => keys(`type:${text}`)

  async function finish(name) {
    show(null)
    ff.stdin.write('q')
    await new Promise((ok) => ff.on('exit', ok))
    const termEnd = Date.now()
    for (const p of procs.reverse()) {
      try {
        process.kill(-p.pid)
      } catch {
        try {
          p.kill()
        } catch {
          // già chiuso
        }
      }
    }
    const appVideo = await r.finish()
    const out = {
      term: { file: rec, end: termEnd, marks: marks.term },
      app: { file: appVideo, end: Date.now(), marks: marks.app },
      edl
    }
    const file = `${OUT}/${name}-${lang}.json`
    writeFileSync(file, JSON.stringify(out, null, 2))
    return file
  }
  return { keys, run, show, sync, say, pause, type, finish, home, env }
}
