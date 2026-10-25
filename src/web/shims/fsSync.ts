// fs di Node nella versione web: le funzioni sincrone non si possono fare sopra la File System
// Access API. Il codice dei progetti le usa solo per piccoli controlli dell'app desktop, come i
// backup rimasti nella cartella Naibi: nel browser non c'è niente da trovare.

export const existsSync = (): boolean => false

const desktopOnly = (): never => {
  throw new Error('desktop only')
}
export const readFileSync = desktopOnly
export const rmSync = desktopOnly
export const cpSync = desktopOnly
export const watch = desktopOnly
export const constants = {}
