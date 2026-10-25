// Video 3, seconda parte: il filmato dentro Tabletop Simulator registrato da Luca sul Mac, portato alla misura
// dei video (1728×1080, con due bande scure) e con le didascalie arancioni dello stesso stile dell'app.
// Uso: node scripts/video/tabletop-tts.mjs <filmato.mp4> <it|en> <uscita.mp4>
// Il filmato va prima ridotto a 1080p (l'originale .mov a 1440p pesa quasi 1 GB):
//   ffmpeg -i originale.mov -an -vf "scale=1920:-2,fps=30" -c:v libx264 -crf 22 -pix_fmt yuv420p filmato.mp4
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [src, lang = 'it', out] = process.argv.slice(2)
const it = lang === 'it'
const t = (a, b) => (it ? a : b)
const W = 1728
const H = 1080
const VH = 972 // il filmato a 16:9 dentro i 16:10 dei video
const FADE = 0.3

// [da, a, testo] in secondi del filmato di Luca (3 min 01 s)
const CAPTIONS = [
  [
    0.3,
    5.5,
    t(
      'In Tabletop Simulator si apre una partita: Create',
      'In Tabletop Simulator, start a game: Create'
    )
  ],
  [7.5, 14.5, t('Il menu Objects, poi Saved Objects', 'The Objects menu, then Saved Objects')],
  [
    15.5,
    23,
    t('Qui ci sono gli oggetti esportati da Stella', 'Here are the objects exported from Stella')
  ],
  [
    23.5,
    42,
    t('Un clic su ogni oggetto e arriva sul tavolo', 'Click each object to put it on the table')
  ],
  [
    44.5,
    58,
    t(
      'Carte, plancia, monete, tessere e dado: un oggetto per ogni set',
      'Cards, board, coins, tiles and die: one object per set'
    )
  ],
  [
    59,
    79,
    t(
      'Si usano come al tavolo vero: il mazzo si mescola…',
      'They work like at a real table: the deck shuffles…'
    )
  ],
  [79.5, 96, t('…le tessere si girano, le monete si impilano', '…tiles flip over, coins stack')],
  [
    96.5,
    111,
    t('Il dado ha le facce disegnate in Stella', 'The die has the faces you drew in Stella')
  ],
  [
    111.5,
    120,
    t(
      'Di base gli oggetti leggono le immagini dal tuo computer: a ogni nuova esportazione si aggiornano',
      'By default the objects read the images from your computer: every new export updates them'
    )
  ],
  [
    120.5,
    127,
    t(
      'Per provare il gioco con altri le immagini devono stare online: il Cloud Manager',
      'To test the game with others, the images must be online: the Cloud Manager'
    )
  ],
  [
    127.5,
    134,
    t(
      '«Upload all» manda le immagini nello Steam Cloud',
      '“Upload all” sends the images to the Steam Cloud'
    )
  ],
  [
    134.5,
    150,
    t(
      'Ora anche gli altri giocatori vedono le tue carte, le monete e le tessere',
      'Now the other players see your cards, coins and tiles too'
    )
  ],
  [
    150.5,
    178,
    t(
      'Dopo ogni modifica in Stella: esporta di nuovo e, se giochi con altri, rifai Upload all',
      'After every change in Stella: export again and, if you play with others, do Upload all again'
    )
  ]
]

const tmp = mkdtempSync(join(tmpdir(), 'tts-'))
const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1.2
})
const pngs = []
for (const [i, [, , text]] of CAPTIONS.entries()) {
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>
    html, body { margin: 0; background: transparent }
    div { display: inline-block; background: #E4572E; color: #fff; font: 700 30px/1.25 system-ui, sans-serif; padding: 14px 22px; border-radius: 12px; max-width: 560px; box-shadow: 0 6px 20px rgba(0,0,0,.35); margin: 20px }
  </style><div>${text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])}</div>`)
  const file = join(tmp, `c${i}.png`)
  await page.locator('div').screenshot({ path: file, omitBackground: true })
  pngs.push(file)
}
await browser.close()

// le didascalie in alto a sinistra, sul legno del tavolo, lontano dai pannelli di Tabletop Simulator
const inputs = ['-i', src]
for (const p of pngs) inputs.push('-loop', '1', '-framerate', '30', '-i', p)
let f = `[0:v]scale=${W}:${VH},setsar=1,pad=${W}:${H}:0:${(H - VH) / 2}:color=0x1d1a16,fps=30,format=yuv420p[b0]`
CAPTIONS.forEach(([a, b], i) => {
  f += `;[${i + 1}:v]format=rgba,fade=t=in:st=${a}:d=${FADE}:alpha=1,fade=t=out:st=${b - FADE}:d=${FADE}:alpha=1[c${i}]`
  f += `;[b${i}][c${i}]overlay=40:${(H - VH) / 2 + 40}:enable='between(t,${a},${b})':shortest=1[b${i + 1}]`
})
execFileSync(
  'ffmpeg',
  [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    ...inputs,
    '-filter_complex',
    f,
    '-map',
    `[b${CAPTIONS.length}]`,
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-r',
    '30',
    out
  ],
  { stdio: 'inherit' }
)
rmSync(tmp, { recursive: true, force: true })
console.log('TTS', out)
