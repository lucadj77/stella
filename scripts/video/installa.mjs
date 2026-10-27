// Video 15: installare Stella. Niente registrazione: diapositive con le schermate (Mac e Windows di Luca,
// sito e app catturati da installa-shots.mjs) e il testo accanto, montate con ffmpeg. Poi monta.sh come gli altri.
// Uso: node scripts/video/installa.mjs <it|en> <cartella schermate> <uscita.mp4>
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const [lang = 'it', SHOTS = '/tmp/v/v15', OUTF = `/tmp/v/v15/installa-${lang}.mp4`] =
  process.argv.slice(2)
const it = lang === 'it'
const t = (a, b) => (it ? a : b)
const W = 1728
const H = 1080
const tmp = `/tmp/v/v15/slides-${lang}`
mkdirSync(tmp, { recursive: true })
// i riquadri misurati da installa-shots.mjs e dallo script del sito
const J = (f) => JSON.parse(readFileSync(`${SHOTS}/${f}`, 'utf8'))

// ogni diapositiva: un titolo, una nota (solo testo) o un'immagine con il testo accanto; box = riquadro
// sull'immagine e region = la parte dell'immagine da mostrare, in pixel dell'immagine
const S = [
  { title: t('Installare Stella', 'Installing Stella') },
  {
    img: `cap/site-top-${lang}.png`,
    region: [100, 150, 1100, 1300],
    box: J(`cap/site-top-${lang}.json`),
    text: t(
      'Vai su stella.lucadj.eu e premi Scarica: il sito propone il file giusto per il tuo computer',
      'Go to stella.lucadj.eu and press Download: the site offers the right file for your computer'
    )
  },
  {
    img: `cap/site-download-${lang}.png`,
    box: [144, 468, 1776, 956],
    text: t(
      'Nella sezione Scarica ci sono tutti i file: Mac, Windows e Linux',
      'The Download section has every file: Mac, Windows and Linux'
    )
  },
  {
    note: t(
      'Stella è gratuita e non è firmata da Apple o Microsoft: la prima volta il sistema chiede conferma. Poi non lo chiede più.',
      'Stella is free and not signed by Apple or Microsoft: the first time, the system asks you to confirm. After that, it never asks again.'
    )
  },
  { title: t('Sul Mac', 'On a Mac') },
  {
    img: 'shots/mac-1.png',
    box: [90, 205, 460, 322],
    text: t(
      'Apri il file .dmg e trascina Stella sulla cartella Applicazioni',
      'Open the .dmg file and drag Stella onto the Applications folder'
    )
  },
  {
    img: 'shots/mac-2.png',
    box: [20, 238, 286, 274],
    text: t(
      'Apri Stella: il Mac la blocca, perché non è firmata. Premi Fine, non Sposta nel Cestino',
      'Open Stella: the Mac blocks it, because it is not signed. Press Done, not Move to Trash'
    )
  },
  {
    img: 'shots/mac-3.png',
    box: [6, 66, 380, 98],
    text: t('Apri il menu Apple → Impostazioni di Sistema', 'Open the Apple menu → System Settings')
  },
  {
    img: 'shots/mac-4.png',
    box: [704, 278, 826, 308],
    text: t(
      'Privacy e sicurezza, sezione Sicurezza: premi Apri comunque e conferma con la password',
      'Privacy & Security, Security section: press Open Anyway and confirm with your password'
    )
  },
  {
    img: 'shots/mac-5.png',
    box: [20, 284, 290, 316],
    text: t(
      'Riapri Stella e premi Apri comunque. Da qui in poi si apre normalmente',
      'Open Stella again and press Open Anyway. From now on it opens normally'
    )
  },
  { title: t('Su Windows', 'On Windows') },
  {
    img: 'shots/win-1.png',
    box: [18, 143, 172, 170],
    text: t(
      'Apri il file di installazione. Se compare l’avviso blu di SmartScreen, premi Ulteriori informazioni',
      'Open the setup file. If the blue SmartScreen warning appears, press More info'
    )
  },
  {
    img: 'shots/win-2.png',
    box: [208, 434, 368, 476],
    text: t(
      'Poi Esegui comunque: l’installazione parte e alla fine Stella è nel menu Start',
      'Then Run anyway: the setup starts, and at the end Stella is in the Start menu'
    )
  },
  { title: t('Su Linux', 'On Linux') },
  {
    note: t(
      'AppImage: rendila eseguibile (chmod +x) e avviala; richiede libfuse2. Oppure il pacchetto .deb per Debian e Ubuntu.',
      'AppImage: make it executable (chmod +x) and run it; it needs libfuse2. Or the .deb package for Debian and Ubuntu.'
    )
  },
  { title: t('Gli aggiornamenti', 'Updates') },
  {
    img: `cap/app-settings-${lang}.png`,
    region: [640, 0, 1440, 560],
    box: J(`cap/app-${lang}.json`).channel,
    text: t(
      'Stella avvisa da sola quando esce una versione nuova. Nel menu ⚙, Aggiornamenti sceglie Stabile o Beta',
      'Stella tells you when a new version is out. In the ⚙ menu, Updates chooses Stable or Beta'
    )
  },
  {
    img: `cap/app-start-${lang}.png`,
    region: [760, 780, 1440, 900],
    box: J(`cap/app-${lang}.json`).check,
    text: t(
      'Controlla aggiornamenti, in basso a destra, lo chiede subito',
      'Check for updates, bottom right, asks right away'
    )
  },
  { title: t('Senza installare nulla', 'Without installing anything') },
  {
    img: `cap/site-web-${lang}.png`,
    region: [120, 140, 1800, 730],
    box: [1360, 262, 1776, 346],
    text: t(
      'La versione web, su stella.lucadj.eu/app, funziona in Chrome, Edge e Opera e apre gli stessi progetti',
      'The web version, at stella.lucadj.eu/app, works in Chrome, Edge and Opera and opens the same projects'
    )
  },
  {
    note: t(
      'Ha qualche limite: il PDF passa dalla stampa del browser e non c’è il CMYK. Per usare tutte le funzioni conviene l’app.',
      'It has a few limits: the PDF goes through the browser’s print dialog and there is no CMYK. For every feature, use the app.'
    )
  },
  {
    title: t(
      'Tutti i dettagli nella guida: stella.lucadj.eu',
      'All the details are in the guide: stella.lucadj.eu'
    )
  }
]

const css = `
* { margin: 0; box-sizing: border-box }
body { width: ${W}px; height: ${H}px; background: #F6F5EE; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; gap: 56px; padding: 0 72px; overflow: hidden }
.call { background: #E4572E; color: #fff; font: 700 40px/1.3 system-ui, sans-serif; padding: 26px 34px; border-radius: 14px; box-shadow: 0 6px 20px rgba(0,0,0,.25); max-width: 540px; position: relative }
.call.side::after { content: ''; position: absolute; left: -32px; top: 40px; border: 16px solid transparent; border-right-color: #E4572E }
.title { font-size: 56px; max-width: 1100px; text-align: center }
.note { font: 600 44px/1.4 system-ui, sans-serif; color: #2b2a26; max-width: 1200px; text-align: center }
.shot { position: relative; flex: none; box-shadow: 0 10px 40px rgba(0,0,0,.22) }
.shot img { display: block; width: 100%; height: 100%; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,.22) }
.box { position: absolute; border: 5px solid #E4572E; border-radius: 10px; box-shadow: 0 0 0 4px rgba(255,255,255,.9) }
`
function size(f) {
  const out = execFileSync('python3', [
    '-c',
    `from PIL import Image;print(*Image.open('${f}').size)`
  ])
  return out.toString().trim().split(' ').map(Number)
}
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: W, height: H } })
const list = []
for (const [i, s] of S.entries()) {
  let html
  let words
  if (s.img) {
    const f = `${SHOTS}/${s.img}`
    const [iw, ih] = size(f)
    const [rx1, ry1, rx2, ry2] = s.region || [0, 0, iw, ih]
    // la parte mostrata occupa al massimo 1000 × 940 px, ingrandita fino al doppio se è piccola
    const k = Math.min(1000 / (rx2 - rx1), 940 / (ry2 - ry1), 2)
    const dw = Math.round((rx2 - rx1) * k)
    const dh = Math.round((ry2 - ry1) * k)
    const data = readFileSync(f).toString('base64')
    const [x1, y1, x2, y2] = s.box
    const pad = 6
    html = `<div class="shot" style="width:${dw}px;height:${dh}px;overflow:hidden;border-radius:12px"><img src="data:image/png;base64,${data}" style="position:absolute;left:${-rx1 * k}px;top:${-ry1 * k}px;width:${iw * k}px;height:${ih * k}px;border-radius:0;box-shadow:none"><div class="box" style="left:${(x1 - rx1) * k - pad}px;top:${(y1 - ry1) * k - pad}px;width:${(x2 - x1) * k + 2 * pad}px;height:${(y2 - y1) * k + 2 * pad}px"></div></div><div class="call side">${s.text}</div>`
    words = s.text
  } else if (s.title) {
    html = `<div class="call title">${s.title}</div>`
    words = s.title
  } else {
    html = `<div class="note">${s.note}</div>`
    words = s.note
  }
  await p.setContent(`<style>${css}</style>${html}`)
  await p.waitForTimeout(100)
  const png = `${tmp}/s${String(i).padStart(2, '0')}.png`
  await p.screenshot({ path: png })
  // tempo di lettura senza voce: come i titoli dei video, un po' più lento
  const sec = Math.max(s.title ? 2.6 : 4.5, 1.6 + 0.075 * words.length)
  list.push([png, sec])
}
await b.close()
// ogni diapositiva con una dissolvenza breve in entrata e in uscita, poi in fila
const parts = []
for (const [i, [png, sec]] of list.entries()) {
  const v = `${tmp}/v${String(i).padStart(2, '0')}.mp4`
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-loop',
    '1',
    '-framerate',
    '30',
    '-t',
    String(sec),
    '-i',
    png,
    '-vf',
    `format=yuv420p,fade=t=in:st=0:d=0.3,fade=t=out:st=${(sec - 0.3).toFixed(2)}:d=0.3`,
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '18',
    '-r',
    '30',
    v
  ])
  parts.push(`file '${v}'`)
}
writeFileSync(`${tmp}/list.txt`, parts.join('\n'))
execFileSync('ffmpeg', [
  '-v',
  'error',
  '-y',
  '-f',
  'concat',
  '-safe',
  '0',
  '-i',
  `${tmp}/list.txt`,
  '-c',
  'copy',
  OUTF
])
console.log('VIDEO', OUTF, list.reduce((a, [, s]) => a + s, 0).toFixed(1), 's')
