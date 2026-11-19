import { useSyncExternalStore } from 'react'

// La cartella sotto assets/ dove vanno le immagini nuove, in qualunque modo arrivino: scelte dal
// computer, trascinate su tela, tabella, modulo o finestre, scaricate da un indirizzo. Sta nel
// progetto (ProjectFile.imagesFolder); l'app la tiene qui perché la usino anche i punti che non
// vedono il progetto, e la cambia con il gestore registrato da App.

let current: string | undefined
let handler: ((folder: string | undefined) => void) | null = null
const listeners = new Set<() => void>()

/** La cartella scelta; undefined: images */
export const getImagesFolder = (): string | undefined => current

/** App: la cartella del progetto aperto */
export function setImagesFolderState(folder: string | undefined): void {
  if (folder === current) return
  current = folder
  for (const l of listeners) l()
}

/** App: cosa fare quando si sceglie un'altra cartella (la scrive nel progetto) */
export function onImagesFolderChange(fn: ((folder: string | undefined) => void) | null): void {
  handler = fn
}

const subscribe = (l: () => void): (() => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Sceglie un'altra cartella: la scrive nel progetto, con il gestore di App */
export function changeImagesFolder(folder: string | undefined): void {
  handler?.(folder)
}

/** La cartella scelta, che si aggiorna quando cambia */
export function useImagesFolder(): string | undefined {
  return useSyncExternalStore(subscribe, getImagesFolder)
}
