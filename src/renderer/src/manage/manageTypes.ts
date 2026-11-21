import { createContext, useContext } from 'react'
import type { MenuItem } from '../components/Menu'
import type { RefKind } from '../../../shared/model/rename'

// Schede della finestra «Gestisci il progetto», azioni che App le presta e collegamenti fra le
// schede. La finestra si apre anche da punti che non vedono il progetto (la scelta delle
// immagini): chi la mostra, App, si registra qui.

export type ManageTab =
  'sets' | 'templates' | 'styles' | 'variables' | 'images' | 'documents' | 'notes'

export const MANAGE_TABS: ManageTab[] = [
  'sets',
  'templates',
  'styles',
  'variables',
  'images',
  'documents',
  'notes'
]

/** Le funzioni di App, le stesse della barra laterale e dei suoi menu */
export interface ManageActions {
  /** Chiudono la finestra e aprono l'elemento */
  openSet(index: number): void
  openTemplate(name: string): void
  openDocument(name: string): void
  openNote(name: string): void
  setMenu(index: number): MenuItem[]
  templateMenu(name: string): MenuItem[]
  documentMenu(name: string): MenuItem[]
  newSet(): void
  newTemplate(): void
  newDocument(): void
  newNote(): void
  deleteNote(name: string): void
  /** Una sola conferma per tutti; quelli usati dai set restano */
  deleteTemplates(names: string[]): Promise<void>
  /** Apre la finestra di modifica ('' per una nuova) sopra questa */
  editVariable(name: string): void
  editStyle(name: string): void
  /** Restituisce il nome della copia */
  duplicateDefinition(kind: RefKind, name: string): string | null
  deleteDefinitions(kind: RefKind, names: string[]): void
  /** Dopo uno spostamento di immagini: riscrive i riferimenti con la cartella */
  imagesMoved(moves: { from: string; to: string }[]): void
}

export interface ManageNav {
  go(tab: ManageTab, key?: string): void
}

export const ManageNavContext = createContext<ManageNav>({ go: () => undefined })
export const useManageNav = (): ManageNav => useContext(ManageNavContext)

const openers = new Set<(tab?: ManageTab, key?: string) => void>()
/** Apre la finestra, sulla scheda indicata o sull'ultima usata */
export function openManage(tab?: ManageTab, key?: string): void {
  openers.forEach((f) => f(tab, key))
}
/** Chi mostra la finestra si registra qui */
export function onOpenManage(f: (tab?: ManageTab, key?: string) => void): () => void {
  openers.add(f)
  return () => openers.delete(f)
}
export const canOpenManage = (): boolean => openers.size > 0

const TAB_KEY = 'manageTab'
export function lastManageTab(): ManageTab {
  try {
    const v = localStorage.getItem(TAB_KEY) as ManageTab | null
    return v && MANAGE_TABS.includes(v) ? v : 'sets'
  } catch {
    return 'sets'
  }
}
export function storeManageTab(tab: ManageTab): void {
  try {
    localStorage.setItem(TAB_KEY, tab)
  } catch {
    // preferenza non essenziale
  }
}
