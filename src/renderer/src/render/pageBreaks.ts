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
    if (!pageHeight) return []
    const ours = nodesOf(clone)
    const live = nodesOf(page)
    if (ours.length !== live.length) return []
    const out: number[] = []
    let at = 0
    for (let i = 0; i < ours.length; i++) {
      const rects = rectsOf(ours[i])
      if (!rects.length) continue
      // un blocco intero che comincia su una pagina nuova: la pagina comincia dal suo bordo;
      // una riga di testo: la pagina comincia da quella riga
      const parts = ours[i] instanceof Text ? rects : rects.slice(0, 1)
      for (let k = 0; k < parts.length; k++) {
        const c = column(parts[k])
        if (c <= at) continue
        const there = rectsOf(live[i])[ours[i] instanceof Text ? k : 0]
        if (!there) continue
        const y = (there.top - pageTop) / pageHeight
        for (; at < c; at++) out.push(y)
      }
    }
    return out
  } finally {
    holder.remove()
  }
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
