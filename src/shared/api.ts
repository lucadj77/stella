import type { UpdateChannel, UpdateInfo, UpdateMode } from './update'
import type {
  DeletedContent,
  DeletedItem,
  LoadedProject,
  LoadedSet,
  ProjectFont,
  PrintedState,
  ProjectFile,
  ProjectVersion,
  Sheet
} from './project'
import type { Template } from './model/template'
import type { Variables } from './model/variables'
import type { Localization } from './model/language'
import type { SheetInspection } from './dataCheck'
import type { Message } from './messages'

/** Un'IA sta lavorando sul progetto: vedi main/project/agentLock.ts */
export interface AgentLock {
  since: string
  note?: string
}
import type {
  ExportContext,
  ExportJob,
  ExportProfiles,
  ExportProgress,
  ExportResult,
  Scene
} from './export'
import type { IconifySet } from './iconify'
import type {
  AssetsUpdate,
  CatalogUpdate,
  FontCatalog,
  SystemFontFamily,
  FontVariant,
  IconCatalog,
  IconCollection,
  IconImport
} from './library'

export type Theme = 'system' | 'light' | 'dark'

export interface RecentProject {
  folder: string
  name: string
  /** Ultima apertura, in millisecondi */
  openedAt: number
  /** La cartella non c'è più o non contiene il file di progetto */
  missing: boolean
  /** Immagine della prima carta come data URL */
  thumbnail?: string
}

/** API esposta dal preload al renderer come window.api */
export interface BackupSettings {
  /** Cartella dei backup; vuota per quella di base (Documenti/Stella/Backup) */
  folder: string
  /** Backup automatico all'apertura del progetto */
  auto: boolean
  /** Quanti backup automatici tenere per progetto */
  keep: number
}

export interface BackupItem {
  file: string
  name: string
  /** Data del backup, in millisecondi */
  date: number
  /** Dimensione dello zip, senza le immagini che condivide con gli altri backup */
  size: number
  auto: boolean
  /** Nome dato al backup, per ricordare che cosa contiene */
  label?: string
}

export interface BackupState {
  /** Cartella dei backup del progetto aperto */
  folder: string
  /** Cartella di base, quando settings.folder è vuota */
  defaultFolder: string
  settings: BackupSettings
  items: BackupItem[]
  /** Spazio occupato da tutti i backup del progetto, immagini comprese */
  totalSize: number
}

/** Un file esportato di un documento, con il percorso dentro export/docs/ */
export interface DocExportFile {
  path: string
  data: string | Uint8Array
}

/**
 * Un documento da esportare nella finestra nascosta (comando stella export-doc): il testo e quel
 * che serve a disegnarlo. Per il PDF la pagina restituisce l'HTML, che il processo principale stampa.
 */
export interface DocRenderInput {
  /** Nome del progetto, per le variabili di sistema */
  project: string
  name: string
  text: string
  kind: 'pdf' | 'html' | 'md' | 'docx'
  sets: LoadedSet[]
  templates: Template[]
  assets: string[]
  fonts: ProjectFont[]
  styles: Record<string, string>
  variables: Variables
  /** Lingua delle carte del documento, se non è la principale */
  localization?: Localization
}

/** File di un documento esportato, con i dati binari in base64 per passare tra i processi */
export interface DocRenderFile {
  path: string
  text?: string
  base64?: string
}

/** Voce del menu dell'app desktop, costruita dal renderer (che conosce lingua e stato) */
export interface AppMenuItem {
  /** Comando mandato al renderer quando si sceglie la voce */
  id?: string
  label?: string
  /** Ruolo standard di Electron (copia, incolla, esci…) al posto di un comando */
  role?: string
  type?: 'separator'
  /** Scorciatoia da mostrare */
  accelerator?: string
  /** La scorciatoia la gestisce già il renderer: il menu la mostra soltanto */
  showOnly?: boolean
  enabled?: boolean
  /** Voce nascosta: serve solo per una seconda scorciatoia */
  visible?: boolean
}

export interface AppMenu {
  label: string
  items: AppMenuItem[]
}

export interface Api {
  /** Versione web (src/web): alcune funzioni ci sono solo nell'app desktop */
  readonly isWeb: boolean
  /** Solo nel web: URL di un file sotto assets/; nell'app desktop c'è il protocollo gc-asset:// */
  assetUrl?(path: string): string
  chooseProjectFolder(): Promise<string | null>
  /**
   * Copia o sposta la cartella del progetto aperto in una cartella scelta dall'utente (nuova o
   * vuota). Restituisce la cartella nuova, o null se l'utente annulla. Solo nell'app desktop.
   */
  relocateProject(
    mode: 'copy' | 'move',
    /** Testi della finestra di scelta, nella lingua dell'interfaccia */
    text: { title: string; button: string; copy: string }
  ): Promise<string | null>
  /** Progetti aperti di recente, dal più recente */
  recentProjects(): Promise<RecentProject[]>
  /** Toglie un progetto dall'elenco dei recenti; la cartella non si tocca */
  removeRecentProject(folder: string): Promise<void>
  /**
   * Copia il progetto di esempio della guida in Documenti/Stella (se non c'è già) e ne
   * restituisce la cartella, da aprire con loadProject. Solo nell'app desktop.
   */
  prepareExampleProject(lang: string): Promise<string>
  /**
   * Salva la miniatura del progetto aperto disegnando il template dato (già legato ai valori
   * della carta); con onlyIfMissing non ridisegna una miniatura che esiste già
   */
  saveThumbnail(template: Template, context: ExportContext, onlyIfMissing: boolean): Promise<void>
  /** Cartella proposta per i progetti nuovi */
  defaultProjectsFolder(): Promise<string>
  /** Crea un progetto vuoto in <parent>/<nome> e ne restituisce la cartella */
  /**
   * Crea un progetto; con `existing` il file dei dati è una copia di quel file (.xlsx, .ods, .csv)
   * invece di un file nuovo
   */
  createProject(
    name: string,
    parent: string,
    data?: 'xlsx' | 'ods',
    existing?: string
  ): Promise<string>
  /** Sceglie un file di dati che c'è già (.xlsx, .ods, .csv); null se l'utente annulla */
  chooseDataFile(): Promise<string | null>
  loadProject(folder: string): Promise<LoadedProject>
  /** Salva il template nel progetto aperto */
  saveTemplate(template: Template): Promise<void>
  /** Sposta il file del template in deleted/ nel progetto; restituisce il nuovo percorso */
  deleteTemplate(file: string): Promise<string | null>
  /** Scrive la nota notes/<name>.md; con oldName diverso la rinomina */
  saveNote(name: string, text: string, oldName?: string): Promise<void>
  /** Sposta la nota in deleted/ */
  deleteNote(name: string): Promise<void>
  /** Scrive il documento docs/<name>.md; con oldName diverso lo rinomina */
  saveDocument(name: string, text: string, oldName?: string): Promise<void>
  /** Sposta il documento in deleted/ */
  deleteDocument(name: string): Promise<void>
  /** Scrive in export/docs/ i file esportati di un documento; restituisce la cartella */
  exportDocumentFiles(files: DocExportFile[]): Promise<string>
  /** PDF di una pagina HTML autonoma (solo desktop) */
  documentPdf(html: string): Promise<Uint8Array>
  /** Cestino del progetto: elementi in deleted/, il contenuto di uno, e togliere i ripristinati */
  listDeleted(): Promise<DeletedItem[]>
  readDeleted(file: string): Promise<DeletedContent>
  dropDeleted(files: string[]): Promise<void>
  /**
   * Salva i fogli modificati e, se cambiati i set, il file di progetto. Con keepParts rifiuta
   * (save.needsRewrite) di riscrivere tutto un xlsx che perderebbe grafici e simili.
   */
  saveData(changes: {
    file?: ProjectFile
    sheets: Sheet[]
    removed?: string[]
    keepParts?: boolean
  }): Promise<{ rewritten: boolean }>
  /** Rilegge il progetto aperto senza backup: serve per i dati cambiati fuori da Stella */
  reloadData(): Promise<LoadedProject>
  /** Controlla file dati: com'è fatto ogni foglio del file dati del progetto aperto */
  inspectData(): Promise<SheetInspection[]>
  /** Sceglie un altro file di dati e ne legge i fogli, per importarne uno in un set; null se annullato */
  chooseImportFile(): Promise<{ file: string; sheets: Sheet[] } | null>
  /** Chiamato quando il file dati cambia fuori da Stella; nel browser non arriva mai */
  onDataFileChanged(cb: () => void): () => void
  /** Ingrandimento di tutta l'interfaccia, 1 = 100% */
  setUiZoom(factor: number): void
  /** Tema chiaro, scuro o quello del sistema: vale anche per menu e controlli nativi */
  setTheme(theme: Theme): void
  /** Esporta immagini, PDF o Tabletop Simulator; l'avanzamento arriva a onExportProgress */
  runExport(job: ExportJob, context: ExportContext): Promise<ExportResult>
  cancelExport(): void
  onExportProgress(cb: (p: ExportProgress) => void): () => void
  chooseExportFolder(current: string): Promise<string | null>
  /** Ricorda le opzioni di esportazione nel file di progetto */
  saveExportProfiles(profiles: ExportProfiles): Promise<void>
  /** Cartelle predefinite: export/ del progetto e Saved Objects di Tabletop Simulator */
  defaultExportFolders(): Promise<{ export: string; tts: string }>
  showFolder(path: string): Promise<string>
  /** Catalogo di una raccolta di icone inclusa nell'app (game-icons.net, Kenney) */
  iconCatalog(collection: IconCollection): Promise<IconCatalog>
  /** Copia le icone in assets/icons/ (o assets/images/) e ne registra la licenza */
  importIcons(collection: IconCollection, items: IconImport[]): Promise<AssetsUpdate>
  /** Aggiorna dalla rete il catalogo di game-icons.net o dei font Google */
  updateCatalog(which: 'game-icons' | 'google-fonts'): Promise<CatalogUpdate>
  /** Collezioni di Iconify, con licenza (serve la rete) */
  iconifyCollections(): Promise<IconifySet[]>
  /** Nomi e categorie delle icone di una collezione di Iconify */
  iconifyCollection(
    prefix: string
  ): Promise<{ icons: string[]; categories: Record<string, string[]> }>
  /** Id "prefisso:nome" delle icone di Iconify trovate, in una collezione o in tutte */
  iconifySearch(query: string, prefix?: string): Promise<string[]>
  /** SVG delle icone di Iconify, per id */
  iconifySvgs(ids: string[]): Promise<Record<string, string>>
  /** Scrive le icone di Iconify in assets/icons/ (o assets/images/) e ne registra la licenza */
  importIconifyIcons(items: IconImport[]): Promise<AssetsUpdate>
  /** Elenco dei font Google incluso nell'app */
  fontCatalog(): Promise<FontCatalog>
  /** Scarica le varianti di un font Google in assets/fonts/<famiglia>/ */
  downloadFont(family: string, variants: FontVariant[]): Promise<AssetsUpdate>
  /** Font installati sul computer, per famiglia */
  systemFonts(): Promise<SystemFontFamily[]>
  /** Copia i file di un font installato in assets/fonts/<famiglia>/ */
  copySystemFont(family: string): Promise<AssetsUpdate>
  /** Copia in assets/images/ immagini scelte dal computer; null se l'utente annulla */
  addImages(): Promise<AssetsUpdate | null>
  /** Copia in assets/images/ immagini trascinate nella finestra; `paths` sono i loro percorsi in assets/ */
  dropImages(
    files: { name: string; data: Uint8Array }[]
  ): Promise<{ update: AssetsUpdate; paths: string[] }>
  /** Scrive i crediti in export/credits.txt e restituisce il percorso */
  saveCredits(text: string): Promise<string>
  /** Sceglie una cartella qualsiasi, partendo da current */
  chooseFolder(current?: string): Promise<string | null>
  /** Backup del progetto aperto e impostazioni */
  backups(): Promise<BackupState>
  /** Crea subito un backup del progetto aperto (dei file salvati), con un nome se c'è */
  createBackup(label?: string): Promise<BackupItem>
  /** Cambia il nome di un backup del progetto aperto (vuoto lo toglie) */
  labelBackup(file: string, label: string): Promise<BackupItem>
  saveBackupSettings(settings: BackupSettings): Promise<BackupState>
  /**
   * Estrae un backup in una cartella nuova accanto al progetto e ne restituisce il percorso. Nel
   * web la cartella in cui estrarlo (parent) la sceglie l'utente.
   */
  restoreBackup(file: string, parent?: string): Promise<string>
  /** Il progetto com'era in un backup del progetto aperto, per confrontarlo */
  backupVersion(file: string): Promise<ProjectVersion>
  /** Schede di un foglio Google condiviso con chiunque abbia il link */
  fetchGoogleSheet(link: string): Promise<Sheet[]>
  /** Impronte delle carte dell'ultima esportazione, se ce n'è una */
  readPrinted(): Promise<PrintedState | null>
  savePrinted(state: PrintedState): Promise<void>
  /** Cartella proposta per un progetto Tabletop Creator convertito */
  defaultTtcTarget(source: string): Promise<string>
  /** Converte un progetto Tabletop Creator in un progetto nuovo; l'originale non si modifica */
  importTtc(options: TtcImportOptions): Promise<TtcImportResult>
  /** Come lanciare il comando stella su questo computer; ready è falso se va prima compilato */
  stellaCommand(): Promise<{ command: string; ready: boolean }>
  /** L'ultima versione pubblicata, se è più recente di questa; null anche senza rete */
  checkForUpdate(): Promise<UpdateInfo | null>
  /** Canale degli aggiornamenti scelto in Impostazioni (Stabile o Beta) */
  updateChannel(): Promise<UpdateChannel>
  setUpdateChannel(channel: UpdateChannel): Promise<void>
  /** Se questa installazione si aggiorna da sola (setup di Windows, AppImage, Mac in una cartella scrivibile) */
  updateMode(): Promise<UpdateMode>
  /** Scarica la versione e riavvia l'app aggiornata; il progresso arriva a onUpdateProgress */
  installUpdate(version: string): Promise<void>
  onUpdateProgress(cb: (p: number) => void): () => void
  /** Versione dell'app, per esempio 1.2.0-beta.1 */
  appVersion(): Promise<string>
  /** Scrive la skill in <cartella>/stella/SKILL.md e ne restituisce il percorso */
  saveSkill(folder: string, text: string): Promise<string>
  /** Cartella proposta per salvare la skill: quella delle skill di Claude Code, se c'è */
  skillsFolder(): Promise<string>
  /** Progetto aperto (null alla chiusura) e modifiche non salvate, per `stella begin` */
  setAppState(folder: string | null, dirty: boolean): Promise<void>
  /** Chiamato quando un'IA inizia (con il blocco) o finisce (null) di lavorare sul progetto */
  onAgentLock(cb: (lock: AgentLock | null) => void): () => void
  /** Toglie il blocco lasciato da un'IA che non ha chiuso il lavoro */
  unlockAgent(): Promise<void>
  /** Imposta il menu dell'app desktop (nel web non c'è) */
  setAppMenu(menus: AppMenu[]): void
  /** Chiamato quando si sceglie una voce del menu dell'app, con il suo id */
  onMenuCommand(cb: (id: string) => void): () => void
  /** Solo nella finestra nascosta che disegna le esportazioni */
  exportPage: ExportPageApi
}

export interface ExportPageApi {
  onContext(cb: (c: ExportContext) => void): void
  onScene(cb: (id: number, scene: Scene) => void): void
  /** La pagina è pronta a ricevere le scene */
  ready(): void
  /** Scena disegnata, o errore */
  shown(id: number, error?: string): void
  /** La pagina sta ancora lavorando alla scena */
  alive(id: number): void
}

export interface TtcImportOptions {
  /** Cartella del progetto Tabletop Creator */
  source: string
  /** Cartella nuova (o vuota) del progetto Stella */
  target: string
  /** Cartella in cui cercare le icone della libreria che non sono nei cataloghi dell'app */
  iconFolder?: string
}

export interface TtcImportResult {
  folder: string
  templates: number
  sets: number
  cards: number
  assets: number
  variables: number
  /** Cose non convertite o convertite in modo approssimato */
  notes: Message[]
  /** Icone della libreria prese dai cataloghi dell'app (game-icons.net, Kenney) */
  libraryIcons: number
  /** Icone della libreria non trovate, come categoria/nome */
  missingIcons: string[]
  /** Caratteri usati dai testi, da installare nel sistema se mancano */
  fonts: string[]
}
