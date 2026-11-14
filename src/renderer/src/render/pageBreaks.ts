import { DOC_PAGES, type DocSettings } from '../../../shared/model/document'

/**
 * Dove cominciano le pagine del PDF, sull'anteprima continua del documento.
 *
 * Una copia nascosta della pagina si impagina in colonne alte quanto lo spazio del testo di una
 * pagina: Chromium spezza le colonne con le stesse regole della stampa (righe orfane e vedove,
 * blocchi che non si dividono, titoli che restano col testo dopo). Il primo pezzo di ogni colonna
 * dice dove comincia la pagina; la stessa riga o lo stesso blocco, sull'anteprima, dà l'altezza
 * a cui segnarla. Le altezze sono frazioni dell'altezza della pagina dell'anteprima (0 in alto,
 * 1 in fondo), che valgono con qualsiasi zoom.
 */
export function pageBreaks(page: HTMLElement, settings: DocSettings): number[] {
  return measure(page, settings).ys
}

/**
 * Porta sulla copia del documento da stampare i titoli che l'anteprima manda alla pagina dopo
 * perché non restino soli in fondo a una pagina. `clone` è una copia appena fatta di `page`.
 */
export function forcePageBreaks(
  page: HTMLElement,
  clone: HTMLElement,
  settings: DocSettings
): void {
  const { force } = measure(page, settings)
  const nodes = nodesOf(clone)
  for (const i of force) {
    const n = nodes[i]
    if (n instanceof HTMLElement) n.style.breakBefore = 'page'
  }
}

function measure(page: HTMLElement, settings: DocSettings): { ys: number[]; force: number[] } {
  const none = { ys: [], force: [] }
  const [w, h] = DOC_PAGES[settings.page]
  const inner = (n: number): string => `${Math.max(10, n - 2 * settings.margin)}mm`
  const GAP = 200
  const clone = page.cloneNode(true) as HTMLElement
  clone.style.removeProperty('zoom')
  clone.style.removeProperty('transform')
  Object.assign(clone.style, {
    padding: '0',
    margin: '0',
    width: inner(w),
    height: inner(h),
    columnWidth: inner(w),
    columnGap: `${GAP}px`,
    columnFill: 'auto',
    boxShadow: 'none',
    position: 'static'
  })
  // le carte e le immagini che non si trovano non vanno nel PDF
  clone.querySelectorAll<HTMLElement>('.doc-missing').forEach((el) => {
    ;(el.closest<HTMLElement>('figure') ?? el).style.display = 'none'
  })
  const holder = document.createElement('div')
  holder.className = 'pages-measure'
  holder.setAttribute('aria-hidden', 'true')
  holder.appendChild(clone)
  document.body.appendChild(holder)
  try {
    const box = clone.getBoundingClientRect()
    const pitch = box.width + GAP
    const column = (r: DOMRect): number => Math.max(0, Math.floor((r.left - box.left + 1) / pitch))
    const { top: pageTop, height: pageHeight } = page.getBoundingClientRect()
    if (!pageHeight) return none
    const ours = nodesOf(clone)
    const live = nodesOf(page)
    if (ours.length !== live.length) return none
    const index = new Map(ours.map((n, i) => [n, i]))

    /** Il primo pezzo di ogni pagina dopo la prima: nodo, riga (per i testi) e pagina */
    const starts = (): { i: number; k: number; c: number }[] => {
      const out: { i: number; k: number; c: number }[] = []
      let at = 0
      for (let i = 0; i < ours.length; i++) {
        // un blocco a lato (wrap) che non sta in fondo alla pagina passa da solo alla pagina dopo,
        // mentre il testo che lo segue resta sopra: la pagina comincia dove comincia il testo
        if (aside(ours[i])) continue
        const rects = rectsOf(ours[i])
        if (!rects.length) continue
        // un blocco intero che comincia su una pagina nuova: la pagina comincia dal suo bordo;
        // una riga di testo: la pagina comincia da quella riga
        const parts = ours[i] instanceof Text ? rects : rects.slice(0, 1)
        for (let k = 0; k < parts.length; k++) {
          const c = column(parts[k])
          if (c <= at) continue
          for (; at < c; at++) out.push({ i, k, c: at + 1 })
        }
      }
      return out
    }

    // un titolo rimasto in fondo alla pagina va alla pagina dopo, con il testo che lo segue; ogni
    // spostamento cambia le pagine dopo, quindi si rimisura
    let list = starts()
    for (let pass = 0; pass < 100; pass++) {
      let moved = false
      for (const s of list) {
        const title = titleBefore(ours[s.i], s.k)
        if (!title) continue
        title.style.breakBefore = 'page'
        moved = true
        break
      }
      if (!moved) break
      list = starts()
    }

    const ys: number[] = []
    for (const s of list) {
      const n = ours[s.i]
      const there = rectsOf(live[s.i])[n instanceof Text ? s.k : 0]
      if (there) ys.push((there.top - pageTop) / pageHeight)
    }
    // nella stampa si spostano gli stessi titoli; il resto la stampa lo impagina da sé
    const force: number[] = []
    for (const n of ours)
      if (n instanceof HTMLElement && n.style.breakBefore === 'page') {
        const i = index.get(n)
        if (i !== undefined) force.push(i)
      }
    return { ys, force }
  } finally {
    holder.remove()
  }
}

/**
 * Il titolo subito prima del blocco che apre una pagina, che resterebbe da solo in fondo alla
 * pagina prima; null se il blocco non segue un titolo
 */
function titleBefore(n: Node, k: number): HTMLElement | null {
  const el = n instanceof Element ? n : n.parentElement
  // una riga a metà di un blocco: sopra c'è già del testo che tiene compagnia al titolo
  if (n instanceof Text && (k > 0 || firstText(el?.closest('.doc-block')) !== n)) return null
  const block = el?.closest<HTMLElement>('.doc-block')
  if (!block) return null
  let prev = block.previousElementSibling
  while (prev?.matches('.wrap-left, .wrap-right')) prev = prev.previousElementSibling
  if (
    prev instanceof HTMLElement &&
    prev.matches('.doc-block') &&
    prev.children.length === 1 &&
    prev.firstElementChild?.matches('h1, h2, h3') &&
    prev.style.breakBefore !== 'page'
  )
    return prev
  return null
}

/** Il primo testo che si vede in un blocco */
function firstText(block: Element | null | undefined): Text | null {
  if (!block) return null
  const walk = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
  for (let t = walk.nextNode(); t; t = walk.nextNode())
    if ((t as Text).data.trim()) return t as Text
  return null
}

/** Dentro un blocco a lato, con il testo che gli scorre accanto */
function aside(n: Node): boolean {
  const el = n instanceof Element ? n : n.parentElement
  return !!el?.closest('.wrap-left, .wrap-right')
}

/** Gli elementi e i testi della pagina, in ordine; dentro le carte (SVG) non si scende */
function nodesOf(root: HTMLElement): Node[] {
  const out: Node[] = []
  const walk = (n: Node): void => {
    for (const c of n.childNodes) {
      if (c instanceof Text) {
        if (c.data.trim()) out.push(c)
      } else if (c instanceof Element) {
        out.push(c)
        if (!(c instanceof SVGElement)) walk(c)
      }
    }
  }
  walk(root)
  return out
}

/** I rettangoli di un elemento o le righe di un testo, quelli che si vedono */
function rectsOf(n: Node): DOMRect[] {
  let list: DOMRectList
  if (n instanceof Text) {
    const range = document.createRange()
    range.selectNodeContents(n)
    list = range.getClientRects()
  } else list = (n as Element).getClientRects()
  return [...list].filter((r) => r.width > 0 || r.height > 0)
}

/**
 * Impagina la pagina HTML del documento per la stampa con lo stesso metodo dell'anteprima: il
 * documento va in colonne alte quanto lo spazio del testo di una pagina, e ogni pagina stampata
 * mostra una colonna (una copia spostata di lato, tagliata dalla pagina). Così il PDF va a capo e
 * cambia pagina dove lo segna l'anteprima, anche vicino ai blocchi a lato, che la stampa di
 * Chromium sposterebbe in modo diverso. `w` e `h` sono la larghezza e l'altezza dello spazio del
 * testo, in mm.
 *
 * La funzione non usa nulla da fuori: la pagina del PDF la riceve come testo e la chiama da sé.
 */
export function paginate(doc: Document, w: number, h: number): number {
  const page = doc.querySelector<HTMLElement>('.doc-page')
  if (!page || doc.querySelector('.stella-sheet')) return 0
  const style = doc.createElement('style')
  style.textContent =
    `.stella-sheet { width: ${w}mm; height: ${h}mm; overflow: hidden; break-after: page }\n` +
    `.stella-sheet:last-child { break-after: auto }\n` +
    `.stella-sheet .doc-page { width: ${w}mm !important; height: ${h}mm !important;` +
    ` padding: 0 !important; margin: 0 !important; box-shadow: none !important;` +
    ` column-width: ${w}mm; column-gap: 0; column-fill: auto }\n` +
    `@media screen { .stella-sheet { margin: 0 auto 10mm; background: #fff;` +
    ` box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15) } }`
  doc.head.appendChild(style)
  const sheet = (): HTMLElement => {
    const s = doc.createElement('div')
    s.className = 'stella-sheet'
    return s
  }
  // la prima pagina, per misurare quante colonne servono
  const first = sheet()
  page.replaceWith(first)
  const shift = doc.createElement('div')
  shift.appendChild(page)
  first.appendChild(shift)
  const width = page.getBoundingClientRect().width
  const count = Math.max(1, Math.round(page.scrollWidth / width))
  for (let k = 1; k < count; k++) {
    const s = sheet()
    const moved = shift.cloneNode(true) as HTMLElement
    moved.style.transform = `translateX(${-k * width}px)`
    s.appendChild(moved)
    doc.body.appendChild(s)
  }
  return count
}
