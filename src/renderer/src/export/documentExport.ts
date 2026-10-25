import type { DocExportFile } from '../../../shared/api'
import type { ProjectFont } from '../../../shared/project'
import type { HAlign } from '../../../shared/model/template'
import { parseInline, type Inline } from '../../../shared/model/markup'
import { resolveAsset } from '../../../shared/model/assets'
import { imageVariable, palette, resolveColor } from '../../../shared/model/variables'
import { imageBackdrop } from '../../../shared/model/shapes'
import {
  DOC_PAGES,
  documentText,
  isCardSource,
  parseDocument,
  splitImageSource,
  type DocSettings,
  type DocumentContext
} from '../../../shared/model/document'
import { cellImageKey, cellParts } from '../../../shared/model/docTable'
import { assetUrl } from '../render/assets'
import { dataUri, fontFaces, svgOfCard } from './toSvg'
import { backdropPng, loadImage } from './iconPng'

// Esportazione di un documento (model/document.ts) dalla sua anteprima già disegnata: una pagina
// HTML autonoma, con carte, immagini e font dentro il file, da cui si stampa anche il PDF; oppure
// Markdown semplice con le carte e le icone come file PNG accanto, per altri programmi.

/** Punti per pollice delle carte in PNG */
const PNG_DPI = 300

/** Le carte disegnate nella pagina: gli svg più esterni, non i disegni che contengono */
const cardsIn = (root: Element): SVGSVGElement[] =>
  [...root.querySelectorAll<SVGSVGElement>('svg[xmlns]')].filter(
    (el) => !el.parentElement?.closest('svg[xmlns]')
  )

const firstFamily = (css: string): string =>
  css
    .split(',')[0]
    .trim()
    .replace(/^['"]|['"]$/g, '')

/**
 * Pagina HTML autonoma del documento. `page` è la pagina dell'anteprima (.doc-page), da
 * mostrare senza riduzione mentre si esporta: le carte si misurano come le ha disegnate il
 * browser.
 */
export async function documentHtml(
  page: HTMLElement,
  title: string,
  settings: DocSettings,
  fonts: ProjectFont[]
): Promise<string> {
  const clone = page.cloneNode(true) as HTMLElement
  clone.style.removeProperty('zoom')
  clone.querySelectorAll('[data-from]').forEach((el) => el.removeAttribute('data-from'))
  // le carte e le immagini che non si trovano restano fuori, con la loro didascalia
  clone.querySelectorAll('.doc-missing').forEach((el) => (el.closest('figure') ?? el).remove())
  // il carattere di base dell'app, che fuori dall'app non c'è se non lo si scrive
  const base = getComputedStyle(page).fontFamily
  clone.style.fontFamily = base

  // le carte diventano SVG con i testi, le immagini e i font dentro
  const live = cardsIn(page)
  const copies = cardsIn(clone)
  for (let i = 0; i < live.length; i++) {
    const svg = new DOMParser().parseFromString(
      await svgOfCard(live[i], fonts, null),
      'image/svg+xml'
    ).documentElement
    svg.setAttribute('width', live[i].getAttribute('width') ?? '')
    svg.setAttribute('height', live[i].getAttribute('height') ?? '')
    svg.setAttribute('style', 'display: block')
    copies[i].replaceWith(document.importNode(svg, true))
  }
  await inlineUrls(clone)

  // i font usati dal testo (quelli delle carte sono già dentro le carte)
  const families = new Set<string>([firstFamily(base)])
  for (const el of [page, ...page.querySelectorAll<HTMLElement>('*')]) {
    if (el.closest('svg')) continue
    families.add(firstFamily(getComputedStyle(el).fontFamily))
  }
  const faces = await fontFaces(fonts, families)

  const [w, h] = DOC_PAGES[settings.page]
  const css = documentRules()
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
@page { size: ${w}mm ${h}mm; margin: ${settings.margin}mm }
html { background: #e8e8e4 }
body { margin: 0; padding: 10mm 0 }
* { print-color-adjust: exact; -webkit-print-color-adjust: exact }
${faces}
${css}
.doc-figure figure, .doc-page tr, .doc-page pre, .doc-page blockquote, .doc-item { break-inside: avoid }
.doc-page h1, .doc-page h2, .doc-page h3 { break-after: avoid }
@media print {
  html { background: none }
  body { padding: 0 }
  .doc-page { width: auto !important; padding: 0 !important; margin: 0 !important; box-shadow: none !important }
}
</style>
</head>
<body>
${clone.outerHTML}
</body>
</html>
`
}

/** Le regole di main.css per la pagina del documento */
function documentRules(): string {
  const out: string[] = []
  for (const sheet of document.styleSheets) {
    let list: CSSRuleList
    try {
      list = sheet.cssRules
    } catch {
      continue
    }
    for (const rule of list)
      if (rule instanceof CSSStyleRule && /\.doc-/.test(rule.selectorText))
        out.push(rule.cssText.replace(/cursor:\s*text;?/, ''))
  }
  return out.join('\n')
}

/** Le immagini (anche quelle usate come maschera dalle icone colorate) entrano nel file */
async function inlineUrls(root: HTMLElement): Promise<void> {
  for (const img of root.querySelectorAll('img')) {
    const src = img.getAttribute('src')
    if (src && !src.startsWith('data:')) img.setAttribute('src', await dataUri(src))
  }
  for (const el of root.querySelectorAll<HTMLElement>('[style*="url("]')) {
    if (el.closest('svg')) continue
    let style = el.getAttribute('style') ?? ''
    for (const m of [...style.matchAll(/url\("([^"]+)"\)/g)])
      if (!m[1].startsWith('data:')) style = style.replace(m[1], await dataUri(m[1]))
    el.setAttribute('style', style)
  }
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ——— Markdown ———

/**
 * Markdown semplice del documento, con le immagini in una cartella accanto: le carte come PNG,
 * le icone e le altre immagini come i loro file. Restano grassetto, corsivo e barrato; gli altri
 * stili del markup di Stella si perdono. Le impostazioni della pagina non si scrivono.
 */
export async function documentMarkdown(
  page: HTMLElement,
  name: string,
  text: string,
  ctx: DocumentContext,
  fonts: ProjectFont[]
): Promise<DocExportFile[]> {
  const dir = `${name} images`
  const files: DocExportFile[] = []
  const used = new Map<string, string>()
  const link = (file: string): string =>
    `${dir}/${file}`.split('/').map(encodeURIComponent).join('/')

  /** Il file di un'immagine degli asset, copiato una volta sola */
  const asset = async (path: string): Promise<string> => {
    let file = used.get(path)
    if (!file) {
      file = path.replace(/\//g, '-')
      used.set(path, file)
      const res = await fetch(assetUrl(path))
      files.push({ path: `${dir}/${file}`, data: new Uint8Array(await res.arrayBuffer()) })
    }
    return link(file)
  }
  const imageOf = async (src: string): Promise<string | null> => {
    const n = splitImageSource(src).path.replace(/^\{(.*)\}$/, '$1')
    const v = imageVariable(n, ctx.variables)
    const r = resolveAsset(v ? v.src : n, ctx.assets ?? [])
    if (!r.ok) return null
    const backdrop = imageBackdrop(v, ctx.variables)
    if (!backdrop) return asset(r.path)
    // con lo sfondo della variabile si scrive un PNG con l'icona già sopra lo sfondo
    let file = used.get(`{${n}}`)
    if (!file) {
      const img = await loadImage(assetUrl(r.path))
      if (!img) return null
      const pal = palette(ctx.variables)
      file = `${safeName(n)}-bg.png`
      used.set(`{${n}}`, file)
      const data = await backdropPng(img, backdrop, 12, {
        assets: ctx.assets ?? [],
        pal,
        tint: v?.tint ? resolveColor(v.tint, pal) : undefined
      })
      files.push({ path: `${dir}/${file}`, data })
    }
    return link(file)
  }

  const inline = async (s: string): Promise<string> =>
    inlinesMd(parseInline(documentText(s, ctx)).children, imageOf)

  let cards = 0
  /** Una carta (in PNG) o un'immagine; `key` ritrova nella pagina la carta disegnata */
  const figureMd = async (src: string, rawAlt: string, key: number | string): Promise<string> => {
    const alt = rawAlt.replace(/[[\]]/g, '')
    if (isCardSource(src)) {
      const svg = page.querySelector<SVGSVGElement>(`figure[data-from="${key}"] svg[xmlns]`)
      if (!svg) return ''
      cards++
      const file = `${String(cards).padStart(2, '0')}${alt ? ' ' + safeName(alt) : ''}.png`
      files.push({ path: `${dir}/${file}`, data: await cardPng(svg, fonts) })
      return `![${alt}](${link(file)})`
    }
    if (/^https?:\/\//i.test(src)) return `![${alt}](${src})`
    const url = await imageOf(src)
    return url ? `![${alt}](${url})` : ''
  }
  const out: string[] = []
  for (const b of parseDocument(text)) {
    switch (b.kind) {
      case 'heading':
        out.push(`${'#'.repeat(b.level)} ${await inline(b.text)}`)
        break
      case 'paragraph':
        out.push(await inline(b.text))
        break
      case 'quote':
        out.push(
          (await inline(b.text))
            .split('\n')
            .map((l) => `> ${l}`)
            .join('\n')
        )
        break
      case 'rule':
        out.push('---')
        break
      case 'code':
        out.push('```\n' + b.text + '\n```')
        break
      case 'list': {
        const lines: string[] = []
        for (const it of b.items)
          lines.push(
            `${'   '.repeat(it.depth)}${it.ordered ? `${it.number}.` : '-'} ${(await inline(it.text)).replace(/\n/g, '  \n')}`
          )
        out.push(lines.join('\n'))
        break
      }
      case 'table': {
        // l'aspetto della tabella non ha un Markdown: restano testo e immagini delle celle
        const head = b.header.length > 0
        const cellMd = async (c: string, row: number, col: number): Promise<string> => {
          let s = ''
          const parts = cellParts(c)
          for (let k = 0; k < parts.length; k++) {
            const p = parts[k]
            s +=
              p.kind === 'text'
                ? await inline(p.text)
                : await figureMd(p.src, p.alt, cellImageKey(b.from, row, col, k))
          }
          return s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
        }
        const row = async (cells: string[], r: number): Promise<string> =>
          `| ${(await Promise.all(cells.map((c, k) => cellMd(c, r, k)))).join(' | ')} |`
        const sep = (a: HAlign | null): string =>
          a === 'center' ? ':---:' : a === 'right' ? '---:' : a === 'left' ? ':---' : '---'
        out.push(
          [
            // Markdown vuole un'intestazione: vuota per le proprietà
            await row(head ? b.header : b.align.map(() => ''), head ? 0 : -1),
            `| ${b.align.map(sep).join(' | ')} |`,
            ...(await Promise.all(b.rows.map((r, i) => row(r, head ? i + 1 : i))))
          ].join('\n')
        )
        break
      }
      case 'anatomy': {
        // l'anatomia è un disegno solo: un PNG come le carte
        const svg = page.querySelector<SVGSVGElement>(`figure[data-from="${b.from}"] svg[xmlns]`)
        if (!svg) break
        cards++
        const file = `${String(cards).padStart(2, '0')} ${safeName(
          b.card
            .replace(/^card:/i, '')
            .split('?')[0]
            .replace(/\//g, ' ')
        )}.png`
        files.push({ path: `${dir}/${file}`, data: await cardPng(svg, fonts) })
        out.push(`![](${link(file)})`)
        break
      }
      case 'setup': {
        const svg = page.querySelector<SVGSVGElement>(`figure[data-from="${b.from}"] svg[xmlns]`)
        if (!svg) break
        cards++
        const file = `${String(cards).padStart(2, '0')} setup.png`
        files.push({ path: `${dir}/${file}`, data: await cardPng(svg, fonts) })
        out.push(`![](${link(file)})`)
        break
      }
      case 'figure': {
        const imgs: string[] = []
        for (const img of b.images) {
          const md = await figureMd(img.src, img.alt, img.from)
          if (md) imgs.push(md)
        }
        if (imgs.length) out.push(imgs.join(' '))
        break
      }
    }
  }
  files.unshift({ path: `${name}.md`, data: out.join('\n\n') + '\n' })
  return files
}

/** Nome di file senza i caratteri che i sistemi non accettano */
const safeName = (s: string): string =>
  s
    .replace(/[\\/:*?"<>|#%]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)

/** Testo Markdown di un pezzo di markup: grassetto, corsivo e barrato, le immagini come file */
async function inlinesMd(
  list: Inline[],
  imageOf: (name: string) => Promise<string | null>
): Promise<string> {
  let out = ''
  for (const n of list) {
    if (n.t === 'text') out += n.text.replace(/([\\`*_[\]])/g, '\\$1')
    else if (n.t === 'br') out += '\\\n'
    else if (n.t === 'ref') {
      const url = await imageOf(n.name)
      out += url ? `![${n.name}](${url})`.repeat(n.count) : n.raw
    } else {
      let inner = await inlinesMd(n.children, imageOf)
      // i segni devono stare attaccati al testo: gli spazi restano fuori
      const lead = /^\s*/.exec(inner)![0]
      const tail = /\s*$/.exec(inner)![0]
      inner = inner.trim()
      if (inner) {
        if (n.attrs.strike) inner = `~~${inner}~~`
        if (n.attrs.italic) inner = `*${inner}*`
        if ((n.attrs.weight ?? 400) >= 600) inner = `**${inner}**`
      }
      out += lead + inner + tail
    }
  }
  return out
}

/** PNG di una carta disegnata, alla sua misura nel documento e a 300 punti per pollice */
export async function cardPng(svg: SVGSVGElement, fonts: ProjectFont[]): Promise<Uint8Array> {
  const text = await svgOfCard(svg, fonts, null)
  // le misure dell'elemento sono in pixel a 96 punti per pollice
  const w = Math.round((Number(svg.getAttribute('width')) / 96) * PNG_DPI)
  const h = Math.round((Number(svg.getAttribute('height')) / 96) * PNG_DPI)
  // un data: URL, perché la pagina dell'app non carica immagini blob:
  const img = new Image()
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text)
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, w)
  canvas.height = Math.max(1, h)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
  if (!blob) throw new Error('PNG encoding failed')
  return new Uint8Array(await blob.arrayBuffer())
}
