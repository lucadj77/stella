import type { ProjectFont } from '../../../shared/project'
import { assetUrl } from '../render/assets'

// Esportazione in SVG di una carta disegnata nella finestra nascosta. I testi sono HTML dentro
// <foreignObject>, che i programmi di grafica non leggono: si misurano come li ha impaginati il
// browser e diventano <text>, <rect> e <image> dello stesso SVG. Immagini e font del progetto
// entrano nel file, così l'SVG non dipende dalla cartella del progetto.

const SVG_NS = 'http://www.w3.org/2000/svg'
const XLINK_NS = 'http://www.w3.org/1999/xlink'

interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** SVG autonomo della prima carta nella pagina; `background` riempie tutta l'immagine */
export async function cardToSvg(
  root: HTMLElement,
  fonts: ProjectFont[],
  background: string | null
): Promise<string> {
  const live = root.querySelector<SVGSVGElement>('svg[xmlns]')
  if (!live) throw new Error('No card to export')
  return svgOfCard(live, fonts, background)
}

/** SVG autonomo di una carta disegnata (il suo elemento svg) */
export async function svgOfCard(
  live: SVGSVGElement,
  fonts: ProjectFont[],
  background: string | null
): Promise<string> {
  const clone = live.cloneNode(true) as SVGSVGElement
  const liveFos = [...live.querySelectorAll('foreignObject')]
  const cloneFos = [...clone.querySelectorAll('foreignObject')]
  const families = new Set<string>()
  liveFos.forEach((fo, i) => {
    const g = convertForeignObject(fo, families)
    cloneFos[i].replaceWith(g)
  })

  // dimensioni in mm: il viewBox è già in mm
  const vb = live.viewBox.baseVal
  clone.setAttribute('width', `${round(vb.width)}mm`)
  clone.setAttribute('height', `${round(vb.height)}mm`)
  clone.setAttribute('xmlns:xlink', XLINK_NS)
  clone.removeAttribute('style')
  if (background) {
    const bg = document.createElementNS(SVG_NS, 'rect')
    bg.setAttribute('x', String(vb.x))
    bg.setAttribute('y', String(vb.y))
    bg.setAttribute('width', String(vb.width))
    bg.setAttribute('height', String(vb.height))
    bg.setAttribute('fill', background)
    clone.insertBefore(bg, clone.firstChild)
  }

  // maschere dei gruppi a canale alfa: mask-type non lo leggono tutti i programmi, quindi
  // diventano maschere a luminanza con il contenuto reso bianco dove è opaco
  for (const m of clone.querySelectorAll('mask')) {
    if (!/mask-type:\s*alpha/.test(m.getAttribute('style') ?? '')) continue
    m.removeAttribute('style')
    const white = document.createElementNS(SVG_NS, 'g')
    white.setAttribute('filter', 'url(#stella-white)')
    white.append(...m.childNodes)
    m.appendChild(white)
  }

  // filtro che rende bianca ogni parte opaca: le maschere delle icone colorate lo usano
  const defs = document.createElementNS(SVG_NS, 'defs')
  defs.innerHTML =
    '<filter id="stella-white"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"/></filter>'
  if (clone.querySelector('[filter="url(#stella-white)"]'))
    clone.insertBefore(defs, clone.firstChild)

  await inlineImages(clone)
  const css = await fontFaces(fonts, families)
  if (css) {
    const style = document.createElementNS(SVG_NS, 'style')
    style.textContent = css
    clone.insertBefore(style, clone.firstChild)
  }
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone)
}

// ——— Testi ———

/**
 * Il contenuto HTML di un foreignObject come elementi SVG, nelle coordinate del foreignObject.
 * Per misurare si tolgono per un momento le trasformazioni dei contenitori (rotazioni): le
 * misure del browser sono riquadri allineati alla pagina, e con una rotazione non direbbero dove
 * sta ogni lettera. L'impaginazione del testo non cambia.
 */
export function convertForeignObject(
  fo: SVGForeignObjectElement,
  families: Set<string> = new Set()
): SVGGElement {
  const g = document.createElementNS(SVG_NS, 'g')
  const content = fo.firstElementChild as HTMLElement | null
  if (!content) return g
  const ancestors: SVGElement[] = []
  // fino al disegno più esterno: anche le carte dentro un altro disegno (schema del tavolo)
  for (
    let el = fo.parentElement;
    el instanceof SVGElement && el.ownerSVGElement;
    el = el.parentElement
  )
    ancestors.push(el)
  const saved = ancestors.map((el) => el.style.transform)
  ancestors.forEach((el) => (el.style.transform = 'none'))
  try {
    const origin = content.getBoundingClientRect()
    const k = origin.width / (content.offsetWidth || 1) || 1
    const local = (r: DOMRect): Box => ({
      x: (r.left - origin.left) / k,
      y: (r.top - origin.top) / k,
      w: r.width / k,
      h: r.height / k
    })
    const w = Number(fo.getAttribute('width')) || content.offsetWidth
    const h = Number(fo.getAttribute('height')) || content.offsetHeight
    if (fo.getAttribute('overflow') === 'hidden') {
      const id = `fo${Math.random().toString(36).slice(2, 9)}`
      const clip = document.createElementNS(SVG_NS, 'clipPath')
      clip.id = id
      clip.appendChild(rect({ x: 0, y: 0, w, h }))
      g.appendChild(clip)
      g.setAttribute('clip-path', `url(#${id})`)
    }
    walk(content, g, local, families)
  } finally {
    ancestors.forEach((el, i) => (el.style.transform = saved[i]))
  }
  return g
}

function walk(
  el: Element,
  out: SVGElement,
  local: (r: DOMRect) => Box,
  families: Set<string>
): void {
  const cs = getComputedStyle(el)
  if (cs.display === 'none' || cs.visibility === 'hidden') return
  const opacity = parseFloat(cs.opacity)
  let target = out
  if (opacity < 1) {
    target = document.createElementNS(SVG_NS, 'g')
    target.setAttribute('opacity', String(opacity))
    out.appendChild(target)
  }
  const tag = el.tagName.toLowerCase()
  if (tag === 'svg') {
    // forma di sfondo di un riquadro: si copia, nel posto dove è disegnata
    const b = local(el.getBoundingClientRect())
    const svg = el.cloneNode(true) as SVGSVGElement
    svg.removeAttribute('style')
    svg.setAttribute('x', String(round(b.x)))
    svg.setAttribute('y', String(round(b.y)))
    svg.setAttribute('width', String(round(b.w)))
    svg.setAttribute('height', String(round(b.h)))
    svg.setAttribute('overflow', 'visible')
    target.appendChild(svg)
    return
  }
  if (tag === 'img') {
    const b = local(el.getBoundingClientRect())
    const img = image((el as HTMLImageElement).src, b)
    img.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    target.appendChild(img)
    return
  }
  boxDecorations(el, cs, target, local)
  for (const child of el.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) textRuns(child as Text, cs, target, local, families)
    else if (child.nodeType === Node.ELEMENT_NODE) walk(child as Element, target, local, families)
  }
}

/** Sfondo, bordo e icona colorata (maschera) di un elemento */
function boxDecorations(
  el: Element,
  cs: CSSStyleDeclaration,
  out: SVGElement,
  local: (r: DOMRect) => Box
): void {
  const fill = visible(cs.backgroundColor) ? cs.backgroundColor : null
  const side = (n: 'Top' | 'Right' | 'Bottom' | 'Left'): { w: number; color: string } | null => {
    const w = parseFloat(cs.getPropertyValue(`border-${n.toLowerCase()}-width`)) || 0
    const style = cs.getPropertyValue(`border-${n.toLowerCase()}-style`)
    const color = cs.getPropertyValue(`border-${n.toLowerCase()}-color`)
    return w > 0 && style !== 'none' && visible(color) ? { w, color } : null
  }
  const sides = (['Top', 'Right', 'Bottom', 'Left'] as const).map(side)
  // bordo uguale su tutti i lati: un rettangolo; altrimenti una linea per lato (come le righe ---)
  const all = sides.every((x) => x && x.w === sides[0]!.w && x.color === sides[0]!.color)
  const bw = all ? sides[0]!.w : 0
  const stroke = all ? sides[0]!.color : null
  if (!all && sides.some(Boolean)) {
    for (const r of el.getClientRects()) {
      const b = local(r)
      const ends: [number, number, number, number][] = [
        [b.x, b.y, b.x + b.w, b.y],
        [b.x + b.w, b.y, b.x + b.w, b.y + b.h],
        [b.x, b.y + b.h, b.x + b.w, b.y + b.h],
        [b.x, b.y, b.x, b.y + b.h]
      ]
      sides.forEach((sd, i) => {
        if (!sd) return
        const [x1, y1, x2, y2] = ends[i]
        // la linea sta dentro il riquadro, come il bordo CSS
        const off = (i === 0 || i === 3 ? 1 : -1) * (sd.w / 2)
        const line = document.createElementNS(SVG_NS, 'line')
        const vertical = i % 2 === 1
        line.setAttribute('x1', String(round(vertical ? x1 + off : x1)))
        line.setAttribute('y1', String(round(vertical ? y1 : y1 + off)))
        line.setAttribute('x2', String(round(vertical ? x2 + off : x2)))
        line.setAttribute('y2', String(round(vertical ? y2 : y2 + off)))
        line.setAttribute('stroke', sd.color)
        line.setAttribute('stroke-width', String(round(sd.w)))
        out.appendChild(line)
      })
    }
  }
  const mask = cs.webkitMaskImage || cs.maskImage
  const maskUrl = mask && mask !== 'none' ? /url\("?([^")]+)"?\)/.exec(mask)?.[1] : undefined
  if (!fill && !stroke) return
  const radius = parseFloat(cs.borderTopLeftRadius) || 0
  for (const r of el.getClientRects()) {
    const b = local(r)
    if (maskUrl && fill) {
      // icona ricolorata: il colore passa attraverso la forma dell'immagine
      const id = `m${Math.random().toString(36).slice(2, 9)}`
      const m = document.createElementNS(SVG_NS, 'mask')
      m.id = id
      const img = image(maskUrl, b)
      img.setAttribute('preserveAspectRatio', 'xMidYMid meet')
      // la maschera usa la luminanza: l'icona diventa bianca dove è opaca
      img.setAttribute('filter', 'url(#stella-white)')
      m.appendChild(img)
      out.appendChild(m)
      const shape = rect(b)
      shape.setAttribute('fill', fill)
      shape.setAttribute('mask', `url(#${id})`)
      out.appendChild(shape)
      continue
    }
    const shape = rect(stroke ? { x: b.x + bw / 2, y: b.y + bw / 2, w: b.w - bw, h: b.h - bw } : b)
    if (radius) shape.setAttribute('rx', String(round(Math.min(radius, b.w / 2, b.h / 2))))
    shape.setAttribute('fill', fill ?? 'none')
    if (stroke) {
      shape.setAttribute('stroke', stroke)
      shape.setAttribute('stroke-width', String(round(bw)))
    }
    out.appendChild(shape)
  }
}

let probe: CanvasRenderingContext2D | null = null

/** Discesa del font sotto la linea di base, in px: serve a trovare la base delle righe */
function descent(cs: CSSStyleDeclaration): number {
  probe ??= document.createElement('canvas').getContext('2d')
  const size = parseFloat(cs.fontSize) || 16
  if (!probe) return size * 0.25
  probe.font = `${cs.fontStyle} ${cs.fontWeight} ${size}px ${cs.fontFamily}`
  const d = probe.measureText('Hg').fontBoundingBoxDescent
  return Number.isFinite(d) ? d : size * 0.25
}

/**
 * Un nodo di testo come <text>, uno per riga: le lettere si raggruppano finché restano sulla
 * stessa riga, e la riga parte dove il browser l'ha messa.
 */
function textRuns(
  node: Text,
  cs: CSSStyleDeclaration,
  out: SVGElement,
  local: (r: DOMRect) => Box,
  families: Set<string>
): void {
  const text = node.data
  if (!text.trim()) return
  const range = document.createRange()
  const runs: { x: number; right: number; bottom: number; text: string }[] = []
  let cur: { x: number; right: number; top: number; bottom: number; text: string } | null = null
  for (let i = 0; i < text.length; i++) {
    // le coppie surrogate (emoji) restano insieme
    const len = text.codePointAt(i)! > 0xffff ? 2 : 1
    range.setStart(node, i)
    range.setEnd(node, i + len)
    const ch = text.slice(i, i + len)
    i += len - 1
    const r = range.getClientRects()[0]
    if (!r || ch === '\n') {
      if (cur) runs.push(cur)
      cur = null
      continue
    }
    const b = local(r)
    if (cur && Math.abs(b.y - cur.top) < b.h / 2) {
      cur.text += ch
      if (ch.trim()) cur.right = b.x + b.w
    } else {
      if (cur) runs.push(cur)
      cur = { x: b.x, right: b.x + b.w, top: b.y, bottom: b.y + b.h, text: ch }
    }
  }
  if (cur) runs.push(cur)
  const d = descent(cs)
  const family = cs.fontFamily
  for (const f of family.split(',')) families.add(f.trim().replace(/^['"]|['"]$/g, ''))
  for (const run of runs) {
    // gli spazi a fine riga non servono e spostano il testo allineato a destra
    const value = transformText(run.text.replace(/\s+$/, ''), cs.textTransform)
    if (!value.trim()) continue
    const t = document.createElementNS(SVG_NS, 'text')
    t.setAttribute('x', String(round(run.x)))
    t.setAttribute('y', String(round(run.bottom - d)))
    t.setAttribute('font-family', family)
    t.setAttribute('font-size', String(round(parseFloat(cs.fontSize))))
    if (cs.fontWeight !== '400') t.setAttribute('font-weight', cs.fontWeight)
    if (cs.fontStyle !== 'normal') t.setAttribute('font-style', cs.fontStyle)
    t.setAttribute('fill', cs.color)
    const ls = parseFloat(cs.letterSpacing)
    if (ls) t.setAttribute('letter-spacing', String(round(ls)))
    const deco = cs.textDecorationLine
    if (deco && deco !== 'none') t.setAttribute('text-decoration', deco)
    const sw = parseFloat(cs.webkitTextStrokeWidth)
    if (sw > 0) {
      t.setAttribute('stroke', cs.webkitTextStrokeColor)
      t.setAttribute('stroke-width', String(round(sw)))
      t.setAttribute('paint-order', 'stroke fill')
      t.setAttribute('stroke-linejoin', 'round')
    }
    // la larghezza misurata tiene il testo al suo posto anche se chi apre il file non ha il font
    if (value.length > 1) {
      t.setAttribute('textLength', String(round(run.right - run.x)))
      t.setAttribute('lengthAdjust', 'spacing')
    }
    t.setAttribute('xml:space', 'preserve')
    t.textContent = value
    out.appendChild(t)
  }
}

function transformText(s: string, transform: string): string {
  if (transform === 'uppercase') return s.toUpperCase()
  if (transform === 'lowercase') return s.toLowerCase()
  if (transform === 'capitalize')
    return s.replace(/(^|\s)(\p{L})/gu, (_, a, b) => a + b.toUpperCase())
  return s
}

// ——— Immagini e font ———

function rect(b: Box): SVGRectElement {
  const r = document.createElementNS(SVG_NS, 'rect')
  r.setAttribute('x', String(round(b.x)))
  r.setAttribute('y', String(round(b.y)))
  r.setAttribute('width', String(round(Math.max(0, b.w))))
  r.setAttribute('height', String(round(Math.max(0, b.h))))
  return r
}

function image(href: string, b: Box): SVGImageElement {
  const img = document.createElementNS(SVG_NS, 'image')
  img.setAttribute('href', href)
  img.setAttribute('x', String(round(b.x)))
  img.setAttribute('y', String(round(b.y)))
  img.setAttribute('width', String(round(b.w)))
  img.setAttribute('height', String(round(b.h)))
  return img
}

/** Le immagini del progetto entrano nel file come data URI */
async function inlineImages(svg: SVGSVGElement): Promise<void> {
  const cache = new Map<string, Promise<string>>()
  await Promise.all(
    [...svg.querySelectorAll('image')].map(async (img) => {
      const href = img.getAttribute('href') ?? img.getAttributeNS(XLINK_NS, 'href')
      if (!href || href.startsWith('data:')) return
      if (!cache.has(href)) cache.set(href, dataUri(href))
      img.setAttribute('href', await cache.get(href)!)
    })
  )
}

export async function dataUri(url: string): Promise<string> {
  try {
    const res = await fetch(url)
    if (!res.ok) return url
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(blob)
    })
  } catch {
    return url
  }
}

/**
 * @font-face dei font usati: quelli del progetto e quelli dell'app (Nunito). I font installati
 * sul computer non si possono includere: l'SVG li chiede per nome.
 */
export async function fontFaces(fonts: ProjectFont[], families: Set<string>): Promise<string> {
  const rules: string[] = []
  for (const f of fonts) {
    if (!families.has(f.family)) continue
    rules.push(
      `@font-face { font-family: '${f.family}'; font-weight: ${f.weight}; font-style: ${f.style}; src: url("${await dataUri(assetUrl(f.path))}"); }`
    )
  }
  const own = new Set(fonts.map((f) => f.family))
  for (const sheet of document.styleSheets) {
    let list: CSSRuleList
    try {
      list = sheet.cssRules
    } catch {
      continue
    }
    for (const rule of list) {
      if (!(rule instanceof CSSFontFaceRule)) continue
      const family = rule.style.getPropertyValue('font-family').replace(/^['"]|['"]$/g, '')
      if (!families.has(family) || own.has(family)) continue
      const src = /url\("?([^")]+)"?\)/.exec(rule.style.getPropertyValue('src'))?.[1]
      if (!src) continue
      const url = new URL(src, sheet.href ?? location.href).href
      rules.push(
        rule.cssText.replace(/url\([^)]*\)(\s*format\([^)]*\))?/, `url("${await dataUri(url)}")`)
      )
    }
  }
  return rules.join('\n')
}

function visible(color: string): boolean {
  return !!color && color !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(color)
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}
