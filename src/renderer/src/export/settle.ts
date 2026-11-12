import { waitForAll, within, type Pending } from '../../../shared/exportWait'
import { imageSize } from '../render/imageSize'

// Attesa che una pagina disegnata per l'esportazione sia completa: immagini e font caricati,
// testi adattati. La usano la finestra nascosta delle carte e quella dei documenti.

/** Senza che finisca di caricarsi nessuna immagine o font per così tanto, qualcosa è bloccato */
const LOAD_IDLE = 60000
/** Dopo l'ultimo caricamento, la scena deve smettere di cambiare entro questo tempo */
const STABLE = 20000
/** Una pagina che non disegna fotogrammi per così tanto non verrà catturata */
const FRAME_TIMEOUT = 10000

/**
 * Oltre questo tempo non si aspetta più la decodifica di un'immagine già caricata: su Windows,
 * nella finestra nascosta, decode() di immagini grandi può non rispondere mai. La carta si
 * disegna lo stesso, decodificando l'immagine quando serve.
 */
const DECODE_WAIT = 2000

const loaded = new Map<string, Promise<void>>()
const ready = new Set<string>()

/** Carica l'immagine (e prova a decodificarla) prima della cattura */
function load(src: string): Promise<void> {
  let p = loaded.get(src)
  if (!p) {
    p = new Promise<void>((resolve) => {
      const img = new Image()
      img.onload = () => {
        // un'immagine grande (una PNG di 4724 × 4724 px) chiede più tempo per la decodifica:
        // un secondo in più ogni 4 milioni di pixel, fino a 15 secondi
        const megapixels = (img.naturalWidth * img.naturalHeight) / 1e6
        const wait = Math.min(15000, DECODE_WAIT + Math.round(megapixels / 4) * 1000)
        within(img.decode(), wait, 'decode')
          .catch(() => undefined)
          // anche le dimensioni lette dai livelli immagine (adatta, riempi, ritaglio) e dalle
          // icone colorate: senza, la carta si cattura con l'immagine non ancora sistemata
          .then(() => imageSize(src))
          .catch(() => undefined)
          .then(() => resolve())
      }
      img.onerror = () => resolve()
      img.src = src
    }).then(() => void ready.add(src))
    loaded.set(src, p)
  }
  return p
}

/** Nome leggibile di un'immagine per i messaggi d'errore */
function imageName(src: string): string {
  if (src.startsWith('data:')) return 'embedded image'
  try {
    const parts = decodeURIComponent(new URL(src).pathname).split('/').filter(Boolean)
    return parts.slice(-2).join('/') || src
  } catch {
    return src
  }
}

/** Immagini e font della scena non ancora pronti */
function loading(root: HTMLElement): Pending[] {
  const srcs = new Set<string>()
  root.querySelectorAll('image').forEach((el) => {
    const href = el.getAttribute('href')
    if (href) srcs.add(href)
  })
  root.querySelectorAll('img').forEach((el) => el.src && srcs.add(el.src))
  const items: Pending[] = [...srcs]
    .filter((src) => !ready.has(src))
    .map((src) => ({ label: imageName(src), promise: load(src) }))
  document.fonts.forEach((f) => {
    if (f.status === 'loading') items.push({ label: `font ${f.family}`, promise: f.loaded })
  })
  return items
}

const frame = (): Promise<void> =>
  within(
    new Promise((r) => requestAnimationFrame(() => r())),
    FRAME_TIMEOUT,
    `the export page drew no frame for ${FRAME_TIMEOUT / 1000} s`
  )
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/**
 * Aspetta che la scena smetta di cambiare: font caricati, immagini decodificate, dimensioni
 * delle immagini lette e testi ridotti per stare nel riquadro. Non c'è un limite al tempo
 * totale, che cresce con le carte del foglio: ci si ferma solo quando niente procede più.
 */
export async function settle(root: HTMLElement): Promise<void> {
  let deadline = Date.now() + STABLE
  let last = Date.now()
  const observer = new MutationObserver(() => (last = Date.now()))
  observer.observe(root, { subtree: true, childList: true, attributes: true, characterData: true })
  try {
    while (Date.now() < deadline) {
      try {
        // ogni immagine o font che arriva dà altro tempo alla scena per sistemarsi
        await waitForAll(loading(root), LOAD_IDLE, () => (deadline = Date.now() + STABLE))
      } catch (e) {
        throw new Error(`images or fonts did not load: ${(e as Error).message}`, { cause: e })
      }
      await frame()
      await frame()
      if (Date.now() - last > 150) break
      await sleep(50)
    }
    // la pagina non si ferma: meglio un errore che un'immagine a cui manca qualcosa
    if (Date.now() >= deadline)
      throw new Error(`the page kept changing for ${STABLE / 1000} s after loading`)
  } finally {
    observer.disconnect()
  }
  await frame()
  await frame()
}
