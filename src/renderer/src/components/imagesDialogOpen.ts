// La finestra Immagini del progetto si apre anche da punti che non vedono il progetto (la scelta
// delle immagini): chi la mostra, App, si registra qui.

const openers = new Set<() => void>()
/** Apre la finestra da un punto che non vede il progetto (la scelta delle immagini) */
export function openImagesDialog(): void {
  openers.forEach((f) => f())
}
/** Chi mostra la finestra si registra qui */
export function onOpenImagesDialog(f: () => void): () => void {
  openers.add(f)
  return () => openers.delete(f)
}
export const canOpenImagesDialog = (): boolean => openers.size > 0
