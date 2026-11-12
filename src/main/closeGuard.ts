import { app, BrowserWindow, ipcMain } from 'electron'

// Chiudere la finestra o uscire dall'app con modifiche non salvate: la chiusura si sospende e il
// renderer chiede se salvare, scartare o restare. Quando ha deciso chiama closeWindow() e la
// chiusura riparte, anche l'uscita dall'app se era quella la richiesta (⌘Q, menu Esci).

/** La prossima chiusura passa senza domande: già confermata, o un aggiornamento che riavvia */
let allowed = false
/** L'uscita dall'app è in corso: chiudendo la finestra si esce */
let quitting = false
/** L'uscita sospesa da una finestra con modifiche: si riprende dopo la risposta */
let quitAfterClose = false

/** Lascia chiudere tutto senza chiedere (aggiornamento che riavvia l'app) */
export function allowClose(): void {
  allowed = true
}

export function registerCloseGuard(): void {
  app.on('before-quit', () => {
    quitting = true
  })
  ipcMain.on('app:close-confirmed', (e) => {
    allowed = true
    if (quitAfterClose) app.quit()
    else BrowserWindow.fromWebContents(e.sender)?.close()
  })
}

/** Sospende la chiusura della finestra quando isDirty() dice che ci sono modifiche */
export function guardWindow(win: BrowserWindow, isDirty: () => boolean): void {
  win.on('close', (e) => {
    if (allowed || !isDirty() || win.webContents.isDestroyed() || win.webContents.isCrashed())
      return
    e.preventDefault()
    quitAfterClose = quitting
    quitting = false
    win.webContents.send('app:close-request')
  })
  // sul Mac la finestra si può riaprire senza uscire: la conferma vale una volta sola
  win.on('closed', () => {
    allowed = false
    quitAfterClose = false
  })
}
