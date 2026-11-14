import { BrowserWindow } from 'electron'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

// PDF di un documento: la pagina HTML autonoma dell'esportazione (con @page per formato e
// margini) stampata da Chromium in una finestra nascosta.

export async function htmlToPdf(html: string): Promise<Uint8Array> {
  // un file e non un data: URL, che con molte immagini supererebbe i limiti di lunghezza
  const dir = await mkdtemp(join(tmpdir(), 'stella-doc-'))
  const file = join(dir, 'document.html')
  await writeFile(file, html)
  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true, backgroundThrottling: false }
  })
  try {
    await win.loadFile(file)
    // con i caratteri pronti la pagina si divide nelle pagine dell'anteprima (stellaPaginate)
    await win.webContents.executeJavaScript(
      'document.fonts.ready.then(() => { window.stellaPaginate?.(); return true })'
    )
    return await win.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true })
  } finally {
    win.destroy()
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}

/** La finestra dell'anteprima PDF, una sola: una nuova anteprima la aggiorna */
let previewWin: BrowserWindow | null = null
/** Il file del PDF mostrato, da togliere quando la finestra si chiude o mostra il successivo */
let previewDir: string | null = null

/**
 * Mostra il PDF del documento com'è stampato, nel visore PDF di Chromium: pagine, margini e
 * interruzioni sono quelli del file esportato.
 */
export async function previewPdf(
  html: string,
  title: string,
  parent: BrowserWindow | null
): Promise<void> {
  const pdf = await htmlToPdf(html)
  const dir = await mkdtemp(join(tmpdir(), 'stella-pdf-'))
  // il nome del file è quello che il visore propone salvando
  const file = join(dir, `${title.replace(/[\\/:*?"<>|]/g, '_') || 'document'}.pdf`)
  await writeFile(file, pdf)
  const old = previewDir
  previewDir = dir
  if (!previewWin || previewWin.isDestroyed()) {
    const bounds = parent?.getBounds()
    previewWin = new BrowserWindow({
      width: 900,
      height: bounds ? Math.max(600, bounds.height - 60) : 1000,
      title,
      autoHideMenuBar: true,
      webPreferences: { plugins: true }
    })
    previewWin.on('closed', () => {
      previewWin = null
      if (previewDir) void rm(previewDir, { recursive: true, force: true }).catch(() => undefined)
      previewDir = null
    })
  }
  previewWin.setTitle(title)
  await previewWin.loadFile(file)
  previewWin.show()
  previewWin.focus()
  if (old) await rm(old, { recursive: true, force: true }).catch(() => undefined)
}
