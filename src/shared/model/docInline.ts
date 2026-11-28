// Immagini e componenti in linea con il testo di un documento: un ![testo](sorgente) scritto in
// mezzo a un paragrafo, a un titolo, a una nota o a una voce di elenco si disegna nella riga, come
// un'icona. Per il markup diventano un riferimento {…} con un nome che nessuno scrive a mano:
// chi disegna il testo (anteprima, Word, Markdown) lo riconosce e mette al suo posto l'immagine.

/** Un'immagine o un componente dentro il testo */
export interface InlineImage {
  alt: string
  src: string
}

/** Primo carattere del nome che prende il posto di un'immagine in linea: un uso privato */
const MARK = ''

const IMAGE = /!\[([^\]]*)\]\(([^)]*)\)/g

/**
 * Il testo con le immagini in linea al posto di {nome segnaposto}, e le immagini in ordine. Dopo
 * una ] il segnaposto si staccherebbe come attributi di [testo]{…}: lì si mette uno spazio largo
 * zero.
 */
export function inlineImages(text: string): { text: string; images: InlineImage[] } {
  const images: InlineImage[] = []
  if (!text.includes('![')) return { text, images }
  const out = text.replace(IMAGE, (_, alt: string, src: string, at: number) => {
    const k = images.push({ alt, src: src.trim() }) - 1
    const glue = at > 0 && text[at - 1] === ']' ? '​' : ''
    return `${glue}{${MARK}${k}}`
  })
  return { text: out, images }
}

/** L'indice dell'immagine in linea di un nome segnaposto; null per gli altri nomi */
export function inlineImageIndex(name: string): number | null {
  if (!name.startsWith(MARK)) return null
  const k = Number(name.slice(MARK.length))
  return Number.isInteger(k) && k >= 0 ? k : null
}

/**
 * La chiave con cui l'esportazione ritrova nella pagina il disegno dell'immagine in linea `k`
 * del blocco che inizia a `from` (`item` è la voce dell'elenco, 0 per gli altri blocchi)
 */
export const inlineImageKey = (from: number, item: number, k: number): string =>
  `${from}:${item}:${k}`

/** Altezza di un'immagine in linea: in mm, o in % dell'altezza di un'icona nel testo */
export interface InlineHeight {
  value: number
  percent: boolean
}

/** Legge height=8 o height=150%; null se non è un numero positivo */
export function parseInlineHeight(v: string): InlineHeight | null {
  const m = /^(\d+(?:\.\d+)?)\s*(%?)$/.exec(v.trim())
  if (!m || !(Number(m[1]) > 0)) return null
  return { value: Number(m[1]), percent: m[2] === '%' }
}

export const inlineHeightText = (h: InlineHeight): string => `${h.value}${h.percent ? '%' : ''}`

/** Altezza di un'icona nel testo rispetto al corpo (come le icone del markup) */
export const ICON_EM = 1.15
