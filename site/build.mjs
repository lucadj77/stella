// Costruisce il sito di presentazione in una cartella: index.html (italiano), en/index.html, stile, script,
// immagini (logo e screenshot presi dalla guida). Uso: node site/build.mjs <cartella di uscita>
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { playlists, texts, videos } from './texts.mjs'

const here = new URL('.', import.meta.url).pathname
const repo = new URL('..', import.meta.url).pathname
const out = process.argv[2] || `${repo}pages`
const template = readFileSync(`${here}template.html`, 'utf8')
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
// bandierine nel tasto della lingua, disegnate qui per non dipendere dalle emoji del sistema
const FLAGS = {
  it: '<svg class="flag" viewBox="0 0 3 2" width="21" height="14" aria-hidden="true"><rect width="1" height="2" fill="#009246"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ce2b37"/></svg>',
  en: '<svg class="flag" viewBox="0 0 60 30" width="21" height="14" aria-hidden="true"><clipPath id="f"><rect width="60" height="30"/></clipPath><g clip-path="url(#f)"><rect width="60" height="30" fill="#012169"/><path d="M0 0l60 30M60 0L0 30" stroke="#fff" stroke-width="6"/><path d="M0 0l60 30M60 0L0 30" stroke="#c8102e" stroke-width="2"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#c8102e" stroke-width="6"/></g></svg>'
}
const shots = ['progetto.png', 'editor.png', 'documento.png', 'griglia-caselle.png']
// icone delle funzioni, a linea, nel colore della funzione (currentColor)
const icon = (d) =>
  `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`
const ICONS = [
  // livelli: tre carte sfalsate
  icon(
    '<rect x="3" y="9" width="12" height="12" rx="2"/><path d="M7 6h12v12"/><path d="M11 3h10v10"/>'
  ),
  // foglio: tabella
  icon(
    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>'
  ),
  // testo con markup
  icon('<path d="M4 18V6h5l3 6 3-6h5v12"/><path d="M4 18h4M16 18h4"/>'),
  // dado
  icon(
    '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="8.5" cy="15.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" stroke="none"/>'
  ),
  // regolamento: libro aperto
  icon(
    '<path d="M12 6c-2-1.5-4.5-2-8-2v14c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2V4c-3.5 0-6 .5-8 2z"/><path d="M12 6v14"/>'
  ),
  // importa: freccia dentro una cartella
  icon(
    '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 10v6M9.5 13.5 12 16l2.5-2.5"/>'
  )
]
// icone della sezione sui dati locali: computer con lucchetto, documento, cartella con freccia
const LOCAL_ICONS = [
  icon(
    '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><rect x="9" y="10" width="6" height="4" rx="1"/><path d="M10.5 10V8.5a1.5 1.5 0 0 1 3 0V10"/>'
  ),
  icon('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/>'),
  icon(
    '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 14h6M13 11.5 15.5 14 13 16.5"/>'
  )
]
// fregio delle sezioni: le cinque carte della stella, in fila
const ORNAMENT = `<svg class="ornament" viewBox="0 0 92 18" width="92" height="18" aria-hidden="true">${[
  '#a33a2a',
  '#c9c7f3',
  '#e5b400',
  '#2f5da8',
  '#8c9c7a'
]
  .map(
    (c, i) =>
      `<rect x="${i * 19}" y="${i % 2 ? 3 : 0}" width="14" height="14" rx="3" fill="${c}" transform="rotate(${i % 2 ? -8 : 8} ${i * 19 + 7} ${i % 2 ? 10 : 7})"/>`
  )
  .join('')}</svg>`

mkdirSync(`${out}/img/it`, { recursive: true })
mkdirSync(`${out}/img/en`, { recursive: true })
mkdirSync(`${out}/it`, { recursive: true })
for (const f of ['style.css', 'site.js']) cpSync(`${here}${f}`, `${out}/${f}`)
cpSync(`${here}fonts`, `${out}/fonts`, { recursive: true })
// pagina nascosta con i conteggi dei download (nessun link dal sito, noindex)
cpSync(`${here}dcount`, `${out}/dcount`, { recursive: true })
for (const f of ['stella.svg', 'predigarama.png']) cpSync(`${here}img/${f}`, `${out}/img/${f}`)
for (const [lang, dir] of [
  ['it', 'guida'],
  ['en', 'guide']
])
  for (const f of shots) cpSync(`${repo}docs/${dir}/img/${f}`, `${out}/img/${lang}/${f}`)

// copertine dei video copiate nel sito durante la costruzione: chi visita non scarica niente da YouTube
// finché non apre un video. Se il download non riesce resta l'indirizzo di YouTube.
const ytId = (url) => (url.match(/(?:v=|youtu\.be\/)([\w-]+)/) || [])[1]
const thumbs = {}
mkdirSync(`${out}/img/yt`, { recursive: true })
for (const id of videos.flatMap((v) => Object.values(v.url).map(ytId)).filter(Boolean)) {
  try {
    const res = await fetch(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`)
    if (!res.ok) throw new Error(res.status)
    writeFileSync(`${out}/img/yt/${id}.jpg`, Buffer.from(await res.arrayBuffer()))
    thumbs[id] = `img/yt/${id}.jpg`
  } catch (e) {
    console.warn(`copertina di ${id} non scaricata (${e.message}): resta quella di YouTube`)
  }
}

for (const lang of ['it', 'en']) {
  const t = texts[lang]
  const data = {
    ...t,
    flag: FLAGS[t.otherLang],
    toTop: lang === 'it' ? 'Torna a inizio pagina' : 'Back to top',
    zoomClose: lang === 'it' ? 'Chiudi' : 'Close',
    guideDir: lang === 'it' ? 'guida' : 'guide',
    guideDirOther: lang === 'it' ? 'guide' : 'guida',
    playlistHref: playlists[lang],
    installHref:
      lang === 'it'
        ? 'https://github.com/lucadj77/stella/blob/main/docs/guida/README.md#installare-stella'
        : 'https://github.com/lucadj77/stella/blob/main/docs/guide/README.md#installing-stella',
    ornament: ORNAMENT,
    'features.items': t.features.items
      .map(
        ([h, p], i) =>
          `<div class="feature"><div class="icon">${ICONS[i] ?? ''}</div><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`
      )
      .join('\n'),
    'local.items': t.local.items
      .map(
        ([h, p], i) =>
          `<div class="local-item"><div class="icon">${LOCAL_ICONS[i]}</div><div><h3>${esc(h)}</h3><p>${esc(p)}</p></div></div>`
      )
      .join('\n'),
    'shots.items': t.shots.items
      .map(
        ([f, c]) =>
          `<figure><img class="zoomable" src="${t.img}${f}" alt="${esc(c)}" loading="lazy"><figcaption>${esc(c)}</figcaption></figure>`
      )
      .join('\n'),
    videos:
      videos.length && videos.some((v) => v.url[lang])
        ? videos
            .filter((v) => v.url[lang])
            .map((v) => {
              const id = ytId(v.url[lang])
              const thumb = id
                ? `<img src="${thumbs[id] ? t.root + thumbs[id] : `https://i.ytimg.com/vi/${id}/hqdefault.jpg`}" alt="" loading="lazy">`
                : esc(v[lang])
              return `<a class="video" href="${esc(v.url[lang])}"><div class="thumb">${thumb}</div><div class="meta"><h3>${esc(v[lang])}</h3><span>${v.minutes} min</span></div></a>`
            })
            .join('\n')
        : `<p>${esc(t.tutorial.soon)}</p>`,
    downloadJson: JSON.stringify({
      zoomOpen: lang === 'it' ? 'Clic per ingrandire' : 'Click to enlarge',
      ...t.download,
      download: t.hero.download,
      downloadGeneric: t.hero.downloadGeneric,
      version: t.hero.version
    })
  }
  const get = (key) => {
    if (key in data) return typeof data[key] === 'string' ? data[key] : ''
    const v = key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), data)
    if (typeof v !== 'string') throw new Error(`chiave mancante nel template: ${key}`)
    return v
  }
  const raw = new Set([
    'features.items',
    'local.items',
    'shots.items',
    'videos',
    'downloadJson',
    'flag',
    'ornament'
  ])
  const html = template.replace(/\{\{([\w.]+)\}\}/g, (_, key) =>
    raw.has(key) ? get(key) : esc(get(key))
  )
  writeFileSync(lang === 'en' ? `${out}/index.html` : `${out}/it/index.html`, html)
}
console.log(`sito in ${out}`)
