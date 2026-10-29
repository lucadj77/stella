// Copertine iniziale e finale dei video (1440x900 punti, 1728x1080 pixel) disegnate in HTML e fotografate con Chromium.
// Uso: node copertine.mjs <cartella assets> <it|en> [video]; video: panoramica (predefinito), primo-componente
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
const [dir, lang, video = 'panoramica'] = process.argv.slice(2)
const it = lang === 'it'
const SUBTITLES = {
  panoramica: ['Una panoramica delle funzioni di base', 'An overview of the basic functions'],
  'primo-componente': ['Il tuo primo componente da zero', 'Your first component from scratch'],
  'formule-testo': ['Testo, icone, stili e formule', 'Text, icons, styles and formulas'],
  documenti: ['Il regolamento e gli altri documenti', 'The rulebook and other documents'],
  tabletop: ['Da Stella a Tabletop Simulator', 'From Stella to Tabletop Simulator'],
  agente: ['Stella con un agente IA', 'Stella with an AI agent'],
  plance: ['Plance, tessere, segnalini e dadi', 'Boards, tiles, tokens and dice'],
  stampa: ['Stampare i componenti', 'Printing your components'],
  griglie: ['Le griglie e le formule nelle caselle', 'Grids and cell formulas'],
  genera: ["Generare le carte e dividere un'immagine", 'Generating cards and splitting an image'],
  backup: ['Backup e recupero', 'Backups and recovery'],
  veloce: ['Lavorare più veloce', 'Working faster'],
  raccolto: ['Un gioco completo, dall’idea al tavolo', 'A complete game, from idea to table'],
  installa: ['Installare Stella e la versione web', 'Installing Stella and the web version'],
  snap: ['Snap point e tag per Tabletop Simulator', 'Snap points and tags for Tabletop Simulator'],
  dati: ['I dati dal foglio di calcolo', 'Data from the spreadsheet'],
  icone: ['Immagini, icone e font', 'Images, icons and fonts'],
  lingue: ['Un gioco in più lingue', 'A game in several languages'],
  assistente: ['L’assistente formule', 'The formula assistant'],
  testo: ['Approfondimento: il testo', 'Deep dive: text']
}
if (!SUBTITLES[video]) throw new Error('video sconosciuto: ' + video)
const subtitle = SUBTITLES[video][it ? 0 : 1]
const logo = readFileSync(new URL('../../build/icon.svg', import.meta.url), 'utf8').replace(
  /<metadata>[\s\S]*?<\/metadata>/,
  ''
)
const pg = readFileSync(`${dir}/predigarama-logo.png`).toString('base64')
const page = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:1440px;height:900px;background:#F8F6F1;color:#2A241C;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
  .wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px}
  .logo svg{width:260px;height:260px;border-radius:58px;box-shadow:0 18px 50px rgba(42,36,28,.18)}
  h1{font-size:92px;font-weight:800;letter-spacing:.03em;margin:0}
  h1 span{font-weight:600;color:#4A4238}
  h2{font-size:44px;font-weight:500;margin:0;color:#4A4238}
  .by{font-size:30px;color:#6B6257;margin-top:28px}
  .small{font-size:30px;color:#4A4238;margin:0}
  .pg{position:absolute;right:44px;bottom:40px;display:flex;align-items:center;gap:16px;color:#6B6257;font-size:24px}
  .pg img{width:120px;height:120px}
  .url{font-size:34px;color:#2A5BA8;margin-top:10px}
</style></head><body>${body}
<div class="pg"><img src="data:image/png;base64,${pg}"></div></body></html>`
const intro = page(`<div class="wrap">
  <div class="logo">${logo}</div>
  <h1>Stella <span>Game Center</span></h1>
  <h2>${subtitle}</h2>
  <div class="by">${it ? 'di Luca Di Gialleonardo' : 'by Luca Di Gialleonardo'}</div>
</div>`)
const outro = page(`<div class="wrap">
  <div class="logo">${logo}</div>
  <h1>Stella <span>Game Center</span></h1>
  <p class="small">${it ? 'La guida completa e i download:' : 'Full guide and downloads:'}</p>
  <div class="url">stella.lucadj.eu</div>
  <div class="by">${it ? 'Un video di Luca Di Gialleonardo · Predigarama Games' : 'A video by Luca Di Gialleonardo · Predigarama Games'}</div>
</div>`)
const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox']
})
// come le registrazioni (lib.mjs): 1440×900 punti, 1728×1080 pixel
const p = await b.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: Number(process.env.SCALE || 1.2)
})
for (const [name, html] of [
  ['intro', intro],
  ['outro', outro]
]) {
  await p.setContent(html)
  await p.waitForTimeout(300)
  await p.screenshot({ path: `${dir}/${name}-${lang}.png` })
}
await b.close()
console.log('ok')
