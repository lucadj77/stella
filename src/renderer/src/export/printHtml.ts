// Nella versione web il PDF di un documento si fa con la stampa del browser: la pagina
// dell'esportazione (con @page per formato e margini) va in una cornice nascosta e si apre la
// finestra di stampa, da cui si sceglie "Salva come PDF". Le misure restano in millimetri.

export async function printHtml(html: string, title: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
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
  frame.src = url
  document.body.appendChild(frame)
  try {
    await loaded
    const win = frame.contentWindow
    if (!win) throw new Error('print frame')
    await win.document.fonts.ready
    // il nome proposto per il file è il titolo della pagina
    win.document.title = title
    win.focus()
    win.print()
  } finally {
    // print() aspetta che la finestra di stampa si chiuda; un attimo dopo la cornice non serve più
    window.setTimeout(() => {
      frame.remove()
      URL.revokeObjectURL(url)
    }, 1000)
  }
}
