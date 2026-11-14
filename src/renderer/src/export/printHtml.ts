// Nella versione web il PDF di un documento si fa con la stampa del browser: la pagina
// dell'esportazione (con @page per formato e margini) va in una cornice nascosta e si apre la
// finestra di stampa, da cui si sceglie "Salva come PDF". Le misure restano in millimetri.

import { paginate } from '../render/pageBreaks'

/** `text` è lo spazio del testo di una pagina in mm: il documento si divide nelle pagine
 *  dell'anteprima prima di stampare */
export async function printHtml(
  html: string,
  title: string,
  text?: [number, number]
): Promise<void> {
  const frame = document.createElement('iframe')
  frame.title = title
  Object.assign(frame.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '0',
    height: '0',
    border: '0',
    visibility: 'hidden'
  })
  const loaded = new Promise<void>((resolve, reject) => {
    frame.onload = () => resolve()
    frame.onerror = () => reject(new Error('print frame'))
  })
  // srcdoc e non un indirizzo blob: la pagina della web app permette solo cornici 'self'
  // (frame-src), e una cornice blob: bloccata diventa una pagina di un'altra origine
  frame.srcdoc = html
  document.body.appendChild(frame)
  try {
    await loaded
    const win = frame.contentWindow
    if (!win) throw new Error('print frame')
    await win.document.fonts.ready
    if (text) paginate(win.document, text[0], text[1])
    // il nome proposto per il file è il titolo della pagina
    win.document.title = title
    win.focus()
    win.print()
  } finally {
    // print() aspetta che la finestra di stampa si chiuda; un attimo dopo la cornice non serve più
    window.setTimeout(() => {
      frame.remove()
    }, 1000)
  }
}
