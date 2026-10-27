// Formato di progetto Stella: vedi docs/formato.md

import type { Template } from './model/template'
import type { Message } from './messages'
import type { ExportProfiles } from './export'
import type { Sources } from './library'
import type { Variables } from './model/variables'
import type { ListOrder } from './model/order'

export const PROJECT_FILE = 'stella.json'
/** Nomi del file dei progetti creati quando l'app si chiamava Naibi e, prima, GameCreator */
export const LEGACY_PROJECT_FILES = ['naibi.json', 'gamecreator.json']
export const FORMAT_VERSION = 1

export interface SetDefinition {
  /** Nome del set, mostrato nell'interfaccia */
  name: string
  /** Nome del template (file templates/<template>.json) */
  template: string
  /** Foglio del file dati che contiene le carte; se assente, uguale a name */
  sheet?: string
  /** Colonne nascoste nella tabella e nei campi della carta */
  hiddenColumns?: string[]
  /** Mostra anche i livelli fissi e con formula, in sola lettura */
  showComputed?: boolean
  /**
   * Proprietà dei livelli fissate nei campi della carta (colonne livello.proprietà): restano
   * visibili sotto il loro campo anche con i dettagli chiusi
   */
  pinnedProperties?: string[]
  /** Nome del set nelle altre lingue del progetto, per codice della lingua */
  names?: Record<string, string>
}

export interface ProjectFile {
  formatVersion: number
  name: string
  /** Percorso relativo del file dati (.xlsx, .ods o .csv) */
  dataFile: string
  sets: SetDefinition[]
  /**
   * Stili di testo: nome → attributi del markup, per esempio "keyword": "weight=700 color=green".
   * heading1, heading2 e note esistono sempre e si possono ridefinire.
   */
  styles?: Record<string, string>
  /** Variabili del progetto: nome → definizione (docs/specifica.md, 6.1) */
  variables?: Variables
  /** Ultime opzioni usate per ogni tipo di esportazione */
  export?: ExportProfiles
  /** Ordine scelto a mano di template, stili e variabili nella barra laterale; assente: alfabetico */
  order?: ListOrder
  /** Link del foglio Google da cui si importano i dati dei set */
  googleSheet?: string
  /** Stella non scrive nel file dati: i dati si modificano solo fuori (per esempio in Excel) */
  dataReadOnly?: boolean
  /**
   * Lingue del progetto, come codici (it, en, pt-BR): la prima è la principale. I testi tradotti
   * stanno nelle colonne `campo@lingua` (vedi model/language.ts)
   */
  languages?: string[]
  /** Nome del progetto nelle altre lingue, per codice della lingua */
  names?: Record<string, string>
}

export interface Sheet {
  name: string
  /** Nome del foglio nel file dati, se il set è stato rinominato e non ancora salvato */
  origin?: string
  headers: string[]
  /** Righe come testo, nello stesso ordine di headers */
  rows: string[][]
}

export interface LoadedSet extends SetDefinition {
  /** Foglio collegato, null se non presente nel file dati */
  data: Sheet | null
}

export interface LoadedProject {
  folder: string
  file: ProjectFile
  sets: LoadedSet[]
  /** Fogli del file dati non collegati a nessun set */
  unusedSheets: string[]
  /** Contenuto dei fogli non collegati: un set nuovo può riprenderli */
  unusedData: Sheet[]
  /** Fogli nel file dati all'ultima lettura o salvataggio: quelli che nessuno usa più si tolgono */
  diskSheets?: string[]
  /** Template letti da templates/ */
  templates: Template[]
  /** File sotto assets/, percorsi relativi */
  assets: string[]
  /** Font sotto assets/fonts/, da registrare prima di disegnare */
  fonts: ProjectFont[]
  /** Provenienza e licenza dei file importati dall'app (assets/sources.json) */
  sources: Sources
  /** Note del progetto, da notes/*.md */
  notes: ProjectNote[]
  /** Documenti del progetto (regolamento, sell sheet…), da docs/*.md: vedi model/document.ts */
  documents?: ProjectNote[]
  /** Cosa toglie dal file dati il primo salvataggio dei dati (solo .xlsx) */
  dataFileLosses?: DataFileLoss[]
  warnings: Message[]
}

/** Oggetti di un file dati .xlsx che Stella non sa riscrivere */
export type DataFileLoss = 'charts' | 'pivotTables' | 'slicers' | 'macros' | 'externalLinks'

/** Una versione del progetto da confrontare con quella di adesso */
export type ProjectVersion = Pick<LoadedProject, 'file' | 'sets' | 'templates'>

/** Impronte delle carte esportate, per set (vedi model/compare.ts); date in millisecondi */
export interface PrintedState {
  date: number
  sets: Record<string, string[]>
}

/** Un elemento del cestino del progetto (deleted/) */
export interface DeletedItem {
  /** Nome del file in deleted/ */
  file: string
  kind: 'template' | 'note' | 'document' | 'sheet'
  /** Nome del template, della nota, del documento o del foglio */
  name: string
  /** Quando è stato eliminato, ISO */
  date: string
  /** Colonne di un foglio */
  columns?: string[]
}

export type DeletedContent =
  | { kind: 'template'; template: Template }
  | { kind: 'note'; name: string; text: string }
  | { kind: 'document'; name: string; text: string }
  | { kind: 'sheet'; sheet: Sheet }

/** Una nota del progetto (notes/<name>.md) o un documento (docs/<name>.md) */
export interface ProjectNote {
  name: string
  text: string
}

/**
 * Nome di una nota o di un documento: è anche il nome del file, senza caratteri vietati nei nomi
 * di file
 */
export function isValidNoteName(name: string): boolean {
  return /^[^\\/:*?"<>|.][^\\/:*?"<>|]*$/.test(name) && name.trim() === name
}

export const FONT_EXTENSIONS = ['.ttf', '.otf', '.woff', '.woff2']

/** Un file di font del progetto, con i dati letti dal file */
export interface ProjectFont {
  /** Percorso sotto assets/ */
  path: string
  family: string
  /** Peso, o intervallo "100 900" per i font variabili */
  weight: string
  style: 'normal' | 'italic'
}
