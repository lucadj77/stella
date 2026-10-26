// Registrazione dei video della guida: Electron con Playwright (registra la finestra), cursore finto,
// riquadri che evidenziano un elemento e testo grande accanto. Il montaggio (copertine, logo, musica) è in monta.sh.
import { _electron } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dict, docs, home, makeProject, mockOpen } from '../guide/lib.mjs'
export { makeProject, mockOpen }
const REPO = new URL('../..', import.meta.url).pathname.replace(/\/$/, '')
export const OUT = process.env.OUT || '/tmp/stella-guide/video'

export async function launch({
  lang = 'it',
  w = 1440,
  h = 900,
  // interfaccia ingrandita: 1440×900 punti diventano 1728×1080 pixel, un video a 1080p
  scale = Number(process.env.SCALE || 1.2),
  ud = process.env.VIDEO_UD || `/tmp/stella-guide/video-ud-${lang}`
} = {}) {
  const H = home(lang)
  mkdirSync(`${H}/.config`, { recursive: true })
  mkdirSync(docs(lang), { recursive: true })
  mkdirSync(`${OUT}/raw`, { recursive: true })
  writeFileSync(
    `${H}/.config/user-dirs.dirs`,
    `XDG_DOCUMENTS_DIR="$HOME/${lang === 'it' ? 'Documenti' : 'Documents'}"\n`
  )
  const app = await _electron.launch({
    env: { ...process.env, HOME: H, LANG: lang === 'it' ? 'it_IT.UTF-8' : 'en_US.UTF-8' },
    executablePath: `${REPO}/node_modules/electron/dist/electron`,
    args: [
      `${REPO}/out/main/index.js`,
      '--user-data-dir=' + ud,
      '--no-sandbox',
      '--lang=' + lang,
      '--force-device-scale-factor=' + scale,
      // ELECTRON_ARGS: per esempio --ignore-certificate-errors dietro il proxy del cloud (Google Fonts)
      ...(process.env.ELECTRON_ARGS ? process.env.ELECTRON_ARGS.split(' ') : [])
    ],
    recordVideo: {
      dir: `${OUT}/raw`,
      size: { width: Math.round(w * scale), height: Math.round(h * scale) }
    }
  })
  const version = JSON.parse(readFileSync(`${REPO}/package.json`, 'utf8')).version
  await app.evaluate(({ app }, v) => {
    app.getVersion = () => v
  }, version)
  const win = await app.firstWindow()
  await win.setViewportSize({ width: w, height: h })
  await win.evaluate(
    ([l]) => {
      localStorage.setItem('language', l)
      localStorage.setItem('theme', 'light')
    },
    [lang]
  )
  await win.reload()
  await win.waitForTimeout(800)
  const T = await dict(lang)
  return new Recorder(app, win, T, lang)
}

export class Recorder {
  constructor(app, win, T, lang) {
    Object.assign(this, { app, win, T, lang, cx: 720, cy: 450 })
  }

  /** cursore finto e stili dei riquadri: da rifare dopo ogni cambio di pagina (reload) */
  overlay() {
    return this.win.evaluate(() => {
      if (document.getElementById('v-cursor')) return
      const c = document.createElement('div')
      c.id = 'v-cursor'
      c.innerHTML =
        '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M5 3l14 9-6 1 4 7-3 1-4-7-5 4z" fill="#111" stroke="#fff" stroke-width="1.5"/></svg>'
      Object.assign(c.style, {
        position: 'fixed',
        left: '720px',
        top: '450px',
        zIndex: 999999,
        pointerEvents: 'none',
        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.5))',
        transition: 'transform .15s'
      })
      document.body.appendChild(c)
      const st = document.createElement('style')
      st.id = 'v-style'
      st.textContent = `
        [role=tooltip], .tooltip { display: none !important }
        .v-box { position: fixed; z-index: 999990; pointer-events: none; border: 4px solid #E4572E; border-radius: 10px; box-shadow: 0 0 0 9999px rgba(0,0,0,.28), 0 0 0 3px rgba(255,255,255,.9) inset; transition: all .35s ease; }
        .v-box.plain { box-shadow: 0 0 0 3px rgba(255,255,255,.9) inset }
        .v-call { position: fixed; z-index: 999991; pointer-events: none; background: #E4572E; color: #fff; font: 700 30px/1.25 system-ui, sans-serif; padding: 14px 22px; border-radius: 12px; max-width: 480px; box-shadow: 0 6px 20px rgba(0,0,0,.35); opacity: 0; transition: opacity .3s; }
        .v-call::after { content: ''; position: absolute; width: 0; height: 0; border: 14px solid transparent; }
        .v-call.right::after { left: -28px; top: 24px; border-right-color: #E4572E }
        .v-call.left::after { right: -28px; top: 24px; border-left-color: #E4572E }
        .v-call.below::after { top: -28px; left: 36px; border-bottom-color: #E4572E }
        .v-call.above::after { bottom: -28px; left: 36px; border-top-color: #E4572E }
        .v-call.none::after { display: none }`
      document.head.appendChild(st)
    })
  }

  wait(ms) {
    return this.win.waitForTimeout(ms)
  }

  /** il cursore scivola fino a (x, y) */
  async glide(x, y, ms = 700) {
    const steps = Math.max(8, Math.round(ms / 25))
    for (let i = 1; i <= steps; i++) {
      const k = 1 - Math.pow(1 - i / steps, 3)
      const px = this.cx + (x - this.cx) * k,
        py = this.cy + (y - this.cy) * k
      await this.win.mouse.move(px, py)
      await this.win.evaluate(
        ([px, py]) => {
          const c = document.getElementById('v-cursor')
          if (c) {
            c.style.left = px + 'px'
            c.style.top = py + 'px'
          }
        },
        [px, py]
      )
    }
    this.cx = x
    this.cy = y
  }

  /** clic su un elemento, con una pausa prima e dopo */
  /** apre una sezione della barra laterale chiusa (stili e variabili si chiudono da sole se sono tante) */
  async openSection(id) {
    const closed = this.win.locator(`#sidebar-${id}.closed .section-toggle`)
    if (await closed.count()) await this.click(closed.first(), { after: 500 })
  }

  async click(loc0, { ms = 700, before = 400, after = 900 } = {}) {
    const loc = loc0.first()
    await loc.waitFor({ timeout: 10000 })
    let b = await loc.boundingBox()
    // con lo zoom l'elemento può essere fuori dallo schermo: si torna alla vista intera
    const vw = await this.win.evaluate(() => [
      innerWidth,
      innerHeight,
      !!document.getElementById('root')?.dataset.vz
    ])
    if (vw[2] && (b.x < 0 || b.y < 0 || b.x + b.width > vw[0] || b.y + b.height > vw[1])) {
      await this.unzoom()
      b = await loc.boundingBox()
    }
    await this.glide(b.x + b.width / 2, b.y + b.height / 2, ms)
    await this.wait(before)
    await this.win.evaluate(() => {
      const c = document.getElementById('v-cursor')
      if (!c) return
      c.style.transform = 'scale(.8)'
      setTimeout(() => (c.style.transform = ''), 150)
    })
    await this.win.mouse.click(this.cx, this.cy)
    await this.wait(after)
  }

  /** scrive un testo lettera per lettera, come una persona */
  async type(text, { delay = 70 } = {}) {
    await this.win.keyboard.type(text, { delay })
  }

  /** riquadro attorno a uno o più elementi e testo grande accanto; la durata dipende dalla lunghezza del testo */
  async focus(locs, text, side = 'right', { ms, dim = true, pad = 8 } = {}) {
    const boxes = []
    for (const l of [].concat(locs)) {
      await l
        .first()
        .waitFor({ timeout: 10000 })
        .catch(() => {})
      const b = await l.first().boundingBox()
      if (b) boxes.push(b)
    }
    if (!boxes.length) throw new Error('focus: elemento non trovato per "' + text + '"')
    await this.win.evaluate(
      ([boxes, text, side, dim, pad]) => {
        document.querySelectorAll('.v-box, .v-call').forEach((e) => e.remove())
        const W = innerWidth,
          H = innerHeight
        boxes.forEach((b, i) => {
          const d = document.createElement('div')
          d.className = 'v-box' + (dim && i === 0 ? '' : ' plain')
          Object.assign(d.style, {
            left: b.x - pad + 'px',
            top: b.y - pad + 'px',
            width: b.width + 2 * pad + 'px',
            height: b.height + 2 * pad + 'px'
          })
          document.body.appendChild(d)
        })
        const b = boxes[0]
        const c = document.createElement('div')
        c.className = 'v-call ' + side
        c.textContent = text
        document.body.appendChild(c)
        const cw = c.offsetWidth,
          ch = c.offsetHeight
        let x, y
        if (side === 'right') {
          x = b.x + b.width + pad + 30
          y = b.y - pad
        } else if (side === 'left') {
          x = b.x - pad - 30 - cw
          y = b.y - pad
        } else if (side === 'below') {
          x = b.x - pad
          y = b.y + b.height + pad + 30
        } else if (side === 'above') {
          x = b.x - pad
          y = b.y - pad - 30 - ch
        } else {
          x = b.x + b.width / 2 - cw / 2
          y = b.y + b.height / 2 - ch / 2
        } // 'none': al centro dell'elemento
        x = Math.max(12, Math.min(W - cw - 12, x))
        y = Math.max(12, Math.min(H - ch - 12, y))
        c.style.left = x + 'px'
        c.style.top = y + 'px'
        requestAnimationFrame(() => (c.style.opacity = 1))
      },
      [boxes, text, side, dim, pad]
    )
    await this.wait(ms ?? Math.max(2600, 1500 + 65 * text.length))
  }

  /**
   * ingrandisce l'app attorno a uno o più elementi (zoom morbido, il testo resta nitido perché è l'app a
   * essere ridisegnata in scala); i riquadri e il cursore restano fuori dallo zoom. unzoom() torna indietro
   */
  async zoom(locs, { max = 2, fill = 0.75, ms = 900 } = {}) {
    const boxes = []
    for (const l of [].concat(locs)) {
      await l.first().waitFor({ timeout: 10000 })
      await l.first().scrollIntoViewIfNeeded()
      boxes.push(await l.first().boundingBox())
    }
    await this.win.evaluate(
      ([boxes, max, fill]) => {
        // i riquadri sono nella vista di prima: si tolgono prima di muoverla
        document.querySelectorAll('.v-box, .v-call').forEach((e) => e.remove())
        const root = document.getElementById('root')
        const W = innerWidth,
          H = innerHeight
        // le misure sono già nello zoom attuale: si riportano alla vista intera
        const [s0, x0, y0] = (root.dataset.vz || '1,0,0').split(',').map(Number)
        const un = (b) => ({
          x: (b.x - x0) / s0,
          y: (b.y - y0) / s0,
          w: b.width / s0,
          h: b.height / s0
        })
        const bs = boxes.map(un)
        const l = Math.min(...bs.map((b) => b.x)),
          t = Math.min(...bs.map((b) => b.y)),
          r = Math.max(...bs.map((b) => b.x + b.w)),
          bt = Math.max(...bs.map((b) => b.y + b.h))
        const s = Math.max(1, Math.min(max, (W * fill) / (r - l), (H * fill) / (bt - t)))
        let x = W / 2 - ((l + r) / 2) * s,
          y = H / 2 - ((t + bt) / 2) * s
        x = Math.min(0, Math.max(W - W * s, x))
        y = Math.min(0, Math.max(H - H * s, y))
        document.documentElement.style.overflow = document.body.style.overflow = 'hidden'
        Object.assign(root.style, {
          transformOrigin: '0 0',
          transition: 'transform .8s cubic-bezier(.4,0,.2,1)',
          transform: `translate(${x}px, ${y}px) scale(${s})`
        })
        root.dataset.vz = [s, x, y].join(',')
      },
      [boxes, max, fill]
    )
    // la transizione dura 0,8 s anche nelle prove veloci: le misure dopo lo zoom devono essere quelle finali
    await this.win.waitForTimeout(Math.max(850, ms))
  }

  async unzoom(ms = 900) {
    const zoomed = await this.win.evaluate(() => {
      const root = document.getElementById('root')
      if (!root.dataset.vz) return false
      document.querySelectorAll('.v-box, .v-call').forEach((e) => e.remove())
      root.style.transform = 'translate(0px, 0px) scale(1)'
      delete root.dataset.vz
      return true
    })
    if (zoomed) await this.win.waitForTimeout(Math.max(850, ms))
  }

  /** testo grande al centro, senza riquadro (titoli di sezione) */
  async title(text, ms) {
    await this.win.evaluate(
      ([text]) => {
        document.querySelectorAll('.v-box, .v-call').forEach((e) => e.remove())
        const d = document.createElement('div')
        d.className = 'v-box plain'
        Object.assign(d.style, {
          left: '-20px',
          top: '-20px',
          width: innerWidth + 40 + 'px',
          height: innerHeight + 40 + 'px',
          boxShadow: '0 0 0 9999px rgba(0,0,0,.28)',
          border: 'none'
        })
        document.body.appendChild(d)
        const c = document.createElement('div')
        c.className = 'v-call none'
        c.textContent = text
        Object.assign(c.style, {
          font: '700 44px/1.25 system-ui, sans-serif',
          padding: '22px 36px',
          maxWidth: '900px',
          textAlign: 'center'
        })
        document.body.appendChild(c)
        c.style.left = (innerWidth - c.offsetWidth) / 2 + 'px'
        c.style.top = (innerHeight - c.offsetHeight) / 2 + 'px'
        requestAnimationFrame(() => (c.style.opacity = 1))
      },
      [text]
    )
    await this.wait(ms ?? Math.max(2400, 1400 + 60 * text.length))
  }

  clear(ms = 500) {
    return this.win
      .evaluate(() => document.querySelectorAll('.v-box, .v-call').forEach((e) => e.remove()))
      .then(() => this.wait(ms))
  }

  /** chiude l'app e restituisce il percorso del video grezzo (webm) */
  async finish() {
    const video = this.win.video()
    await this.app.close()
    return video.path()
  }
}
